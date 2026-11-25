import json
import os
import re
import subprocess
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import ProxyHandler, Request, build_opener
from pydantic import ValidationError
from .schema import ModelInterpretation, ModelObservation, Parameters

ROOT = Path(__file__).resolve().parents[1]


class BusinessError(Exception):
    def __init__(self,code,message,status=422):
        self.code,self.message,self.status=code,message,status


def bridge(operation, payload):
    try:
        result = subprocess.run(
            [os.getenv('NODE_BINARY','node'),str(ROOT/'python_service'/'domain_bridge.mjs')],
            input=json.dumps({'op':operation,'p':payload},ensure_ascii=False).encode(),
            capture_output=True,check=True,timeout=20
        )
        message=json.loads(result.stdout)
    except (OSError,subprocess.SubprocessError,ValueError) as exc:
        raise BusinessError('DOMAIN_UNAVAILABLE','模拟资源规则服务暂不可用。',503) from exc
    if not message['ok']:
        raise BusinessError(message['code'],message['error'])
    return message['result']


EVIDENCE_TERMS = {
    'style': r'新中式|中式|商务|正式|简约|大气|气质|利落|干净|优雅|端庄|复古|典雅|克制|雅致|摩登|低调|雾感|知性|休闲|沉稳|国风',
    'silhouette': r'微落肩|落肩|宽松|直身|收腰|修身|松量|贴身|阔形|廓形|肩背留量|肩袖放量|[HAＨＡ]\s*型',
    'fabric': r'真丝|羊毛|棉混纺|亚麻|羊绒|织花|暗纹|提花|宋锦|精纺|斜纹|醋酸|香云纱|磨砂|触感|手感|垂感|垂坠|肌理|质感|柔软|透气|轻薄|哑光|光泽',
    'craft': r'一体式贴边|贴边|收边|包边|滚边|盘扣|暗扣|明扣|无扣开襟|明线|压线|打枣|加固|双嵌线|拼接|刺绣|侧衩|开衩|开衩挡布',
    'color': r'深藏蓝|藏青|藏蓝|海军蓝|墨绿|米白|墨黑|炭灰|[深浅暗暖冷灰雾淡酒砖玫天宝藏墨粉米象牙]*[红橙黄绿青蓝紫灰白黑棕粉](?:色)?|[\u4e00-\u9fff]{1,5}色',
    'scene': r'室外迎宾|室内接待|酒店礼宾|酒店|接待|迎宾|前台|办公室|通勤|会客|见客|宴会|庆典|会议|正式场合|舞台|户外演出|展厅|颁奖',
    'activity': r'抬手搬运行李|搬运行李|搬行李|抬手|抬臂|伸手|久站|久坐|站立|走动|坐奏|弯腰|骑行|不卡手臂|不压肩',
}
EVIDENCE_TERMS = {key: re.compile(pattern) for key, pattern in EVIDENCE_TERMS.items()}
COLOR_VALUE = re.compile(r'(?:深藏蓝|藏青|藏蓝|海军蓝|墨绿|米白|墨黑|炭灰|[深浅暗暖冷灰雾淡酒砖玫天宝藏墨粉米象牙]{0,4}[红橙黄绿青蓝紫灰白黑棕粉]色?|[\u4e00-\u9fff]{1,5}色)')
VAGUE_COLOR = re.compile(r'颜色|色彩|色调|配色|选色|染色|肤色|[冷热深浅]色|褪色|掉色|色牢度|角色|特色|景色|成色|本色|出色|神色|面色|音色')
NEGATIVE_PREFIX = re.compile(r'(?:不要|不用|不做|不喜欢|不想要|不需要|不能|避免|排除|禁止|不接受|取消|并非|不选)[^，、,。；;！!?？]{0,6}$')
MODEL_READER_PROMPT = (
    '从客户原话找服装设计证据。只输出 observations 数组，每项含 key、quote、value。'
    'quote 必须逐字复制原话中的连续片段，value 是该片段里最短的设计词。每个 key 最多一次。'
    '字段含义：style 是审美风格，silhouette 是衣服轮廓或松量，fabric 是面料材质或手感，'
    'craft 是缝制、扣件或贴边工艺，color 只指真实颜色词，scene 是穿着地点或岗位，activity 是人体动作。'
    '例如“通勤时要方便骑行，面料有磨砂触感”可写 scene=通勤、activity=骑行、fabric=磨砂触感。'
    '人数、机洗干洗、领型和人体尺寸由其他字段处理，绝不可塞入上述栏目。'
    '原文没说、已否定或无法确定所属字段就省略，可以返回空数组。先考虑有直接词证的不同字段。'
)


def accepted_observations(payload, text):
    if not isinstance(payload,dict) or set(payload) != {'observations'}:
        raise ValueError('unexpected observation envelope')
    rows=payload['observations']
    if not isinstance(rows,list) or len(rows)>7:
        raise ValueError('invalid observation list')
    accepted={}
    for row in rows:
        try:
            item=ModelObservation.model_validate(row)
        except ValidationError:
            continue
        key,quote,value=item.key,item.quote.strip(),item.value.strip()
        if (not value or not quote or len(value)>32 or value not in quote or quote not in text
                or re.search(r'[，,。；;！!?？\n]|不要|不能用|不用|不喜欢|排除|不接受|尚未确定|没想好',value)
                or not EVIDENCE_TERMS[key].search(value)):
            continue
        if key=='color' and (not COLOR_VALUE.fullmatch(value) or VAGUE_COLOR.search(value)):
            continue
        offset=quote.index(value)
        positions=[match.start()+offset for match in re.finditer(re.escape(quote),text)]
        if not any(not NEGATIVE_PREFIX.search(text[max(0,index-16):index]) and
                   not re.match(r'(?:不要|不用|不喜欢|除外)',text[index+len(value):]) for index in positions):
            continue
        # Keep one verifiable observation per field. A second wording cannot silently replace the first.
        accepted.setdefault(key, {'key':key,'quote':quote,'value':value})
    return list(accepted.values()), len(rows)-len(accepted)


def extract(text,scene):
    baseline=bridge('extract',{'text':text,'scene':scene})
    result=Parameters.model_validate(baseline).model_dump()
    result['sourceText']=text
    url=os.getenv('SHANGFU_OLLAMA_URL') or os.getenv('OLLAMA_URL')
    model=os.getenv('SHANGFU_OLLAMA_MODEL') or os.getenv('OLLAMA_MODEL','qwen3:4b')
    result.update(mode='rules-fallback', modelEvidence=[],
                  inference={'provider':'rules','reason':'OLLAMA_NOT_CONFIGURED','modelStatus':'not-configured','evidenceCount':0})
    if not url:
        return result
    endpoint=urlsplit(url)
    if endpoint.scheme not in {'http','https'} or endpoint.username or endpoint.password:
        result['inference'].update(reason='OLLAMA_INVALID_URL',modelStatus='invalid-configuration')
        return result
    clauses=[s.strip() for s in re.split(r'[。；，,;！!?？\n]+',text) if s.strip()]
    prompt=[{'role':'system','content':MODEL_READER_PROMPT},
            {'role':'user','content':json.dumps({'客户原话':text,'可逐字引用的分句':clauses},ensure_ascii=False)}]
    body={'model':model,'stream':False,'think':False,'format':ModelInterpretation.model_json_schema(),
          'messages':prompt,'options':{'temperature':0,'num_predict':750}}
    token=os.getenv('OLLAMA_TOKEN','')
    headers={'Content-Type':'application/json'}
    if token:headers['Authorization']='Bearer '+token
    try:
        request=Request(url.rstrip('/')+'/api/chat',data=json.dumps(body,ensure_ascii=False).encode(),headers=headers,method='POST')
        with build_opener(ProxyHandler({})).open(request,timeout=float(os.getenv('OLLAMA_TIMEOUT','28'))) as response:
            envelope=json.loads(response.read(512_001))
        observations,rejected=accepted_observations(json.loads(envelope['message']['content']),text)
    except OSError:
        result['inference'].update(reason='OLLAMA_UNAVAILABLE',modelStatus='unavailable',attemptedModel=model)
        return result
    except (ValueError,KeyError,TypeError):
        result['inference'].update(reason='OLLAMA_INVALID_RESPONSE',modelStatus='invalid-response',attemptedModel=model)
        return result
    result['inference'].update(model=model,format='Pydantic',rejectedCount=rejected)
    if not observations:
        result['inference'].update(reason='OLLAMA_NO_VALID_EVIDENCE',modelStatus='no-valid-evidence')
        return result
    fields={f['key']:f for f in result['fields']}
    updated=0
    for item in observations:
        field=fields[item['key']]
        if field['source']=='pending' and not field['evidence'] and field['level']=='unspecified':
            field.update(value=item['value'],source='customer',level='preferred',evidence=item['quote'])
            updated+=1
    result['modelEvidence']=observations
    result['mode']='ollama'
    result['inference']={'provider':'ollama','strategy':'rules+ollama','model':model,'format':'Pydantic',
                         'modelStatus':'partial' if rejected else 'accepted','evidenceCount':len(observations),
                         'rejectedCount':rejected,'updatedFieldCount':updated}
    return result


def norm(value):
    return re.sub('深藏蓝|海军蓝|藏青','藏蓝',value.lower())


def rank_assets(connection,requirements,scene):
    aid=bridge('evidence',{'requirements':requirements,'scene':scene})
    fields=aid['fields']
    text=' '.join(norm(f['value']+' '+f.get('evidence','')) for f in fields.values())
    buckets={'eligible':[],'rejected':[],'needsReview':[]}
    # This SQL filter and the combination search below own stage 04. The JS
    # helper supplies garment terminology for hard evidence and source citations.
    query="""SELECT asset.data, EXISTS(SELECT 1 FROM asset_scene s
             WHERE s.id=asset.id AND s.scene=?) AS fits FROM asset ORDER BY ordinal"""
    for encoded,fits in connection.execute(query,(scene,)):
        item=json.loads(encoded)
        aid_row=aid['evidence'][item['id']]
        kind=item['type']
        check=None
        if not fits:
            check=('rejected','这项资源用于高级私定，本单为团体职业服。' if scene=='group' else '这项资源用于团体职业服，本单为高级私定。')
        key={'pattern':'collar','fabric':'care'}.get(kind)
        if fits and key:
            field=fields[key]
            actual=item.get(key)
            if key=='collar' and actual=='stand' and fields.get('collarHeightRequest',{}).get('value','').startswith('领高偏低'):
                check=('needsReview','客户希望领口低一些，请先核对这款立领基版的实际领高。')
            elif field['level']=='required':
                codes,excluded=field.get('codes',[]),field.get('excluded',[])
                if field.get('unrecognized') or not (codes or excluded):
                    check=('needsReview','请和客户核对「'+field['value']+'」的具体含义，再按'+field['label']+'筛选。')
                elif actual in (None,'unknown'):
                    label='护理方式' if key=='care' else field['label']
                    check=('needsReview','资料卡未注明'+label+'，还不能确认是否符合「'+field['value']+'」。')
                elif actual in excluded or codes and actual not in codes:
                    recorded=aid['choiceLabels'][key].get(actual,actual)
                    check=('rejected','本单要求「'+field['value']+'」，资料卡登记为「'+recorded+'」。')
        check=check or aid_row['check']
        if check:
            buckets[check[0]].append({**item,'reason':check[1]})
            continue
        hits=[tag for tag in item['tags'] if norm(tag) in text]
        keys=aid['criteria'][kind]+([key] if key else [])
        required=[fields[k]['value'] for k in keys if fields.get(k,{}).get('level')=='required']
        reasons=(['符合本单要求：'+'、'.join(required)] if required else [])
        reasons.append('对应标签：'+'、'.join(hits) if hits else ('适合团体职业服' if scene=='group' else '适合高级私定'))
        if aid_row['reference']:reasons.append(aid['sourceId']+' 模拟案例参考：'+aid_row['reference'])
        score=item['rank']+len(hits)*3+5*bool(key and item.get(key) in fields[key].get('codes',[]))+24*bool(aid_row['reference'])+15*aid_row['preferredFabric']
        buckets['eligible'].append({**item,'score':score,'reason':'。'.join(reasons)})
    buckets['eligible'].sort(key=lambda i:(-i['score'],i['id']))
    types={t:[r for r in buckets['eligible'] if r['type']==t] for t in ('pattern','fabric','craft','case')}
    chosen={t:None for t in types}
    if types['case']:chosen['case']=types['case'][0]['id']
    reason=scope_conflict(requirements,aid)
    if not reason:
        for pattern in types['pattern']:
            for fabric in types['fabric']:
                for craft in types['craft']:
                    if ('collars'in craft and pattern['collar'] not in craft['collars']
                            or craft.get('mobility') and pattern.get('mobility') is not True
                            or 'weightClasses'in craft and fabric.get('weightClass') not in craft['weightClasses']):
                        continue
                    chosen.update(pattern=pattern['id'],fabric=fabric['id'],craft=craft['id'])
                    return {**buckets,'recommended':chosen,'blocked':False,'reason':'这组版型、面料与工艺可以搭配，已核对领型、肩袖活动量和面料厚度。'}
    if not reason:
        absent=next((label for key,label in [('pattern','版型'),('fabric','面料'),('craft','工艺')] if not types[key]),None)
        reason=('还没有符合本单要求的'+absent+'。请核对已排除和待核对的资源。' if absent
                else '候选版型、面料和工艺暂时配不成一套，请核对领型、活动量和面料厚度。')
    return {**buckets,'recommended':chosen,'blocked':True,'reason':reason}


def scope_conflict(requirements,aid):
    fields=aid['fields']
    if any(f['level']=='required' and f['key'] not in aid['knownKeys'] for f in requirements['fields']):
        return '有一项必选条件尚未纳入模拟资源库，请回到设计参数页核对。'
    if re.search('连衣裙|半身裙|西裤|长裤|衬衫|马甲|短裙|短裤',fields.get('garmentScope',{}).get('value','')):
        return '模拟库只有外套、夹克和西装上衣基版，请确认分单范围。'
    if fields.get('designDetail',{}).get('level')=='required':return '还没有可核对的花型样卡，请先确认客户指定的纹样。'
    if any(fields[k].get('conflict') for k in ('care','collar')):return '领型或护理要求存在冲突，请顾问重新确认。'
    if fields.get('placketWidthRequest',{}).get('level')=='required':
        width=aid['width']
        if not width or (width.get('min') or 0)>50 or (width.get('max') or float('inf'))<20:
            return '要求的门襟宽度超出模拟基版的 20–50 mm 范围，请版师核对。' if width else '请先确认门襟宽度的数值、单位或允许范围。'
    return ''
