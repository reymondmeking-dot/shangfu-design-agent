import hmac
import json
import os
import re
from urllib.request import Request as UrlRequest, urlopen
from contextlib import asynccontextmanager
from typing import Literal
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from . import db
from .domain import BusinessError, bridge, extract, rank_assets
from .schema import Archive, Extract, Match, NewProject, RenderJob, Reuse, Review, Solution
from .visual_store import router as visual_router


@asynccontextmanager
async def lifespan(app):
    db.initialize()
    yield


app=FastAPI(title='海派定制业务服务',version='1.0',lifespan=lifespan,docs_url=None,redoc_url=None,openapi_url=None)
app.include_router(visual_router)


@app.middleware('http')
async def protect(request:Request,call_next):
    secret=os.getenv('SHANGFU_SERVICE_TOKEN','')
    if secret and not hmac.compare_digest(request.headers.get('authorization','').encode(),('Bearer '+secret).encode()):
        return JSONResponse({'code':'SERVICE_AUTH_REQUIRED','error':'需要服务授权。'},status_code=401)
    return await call_next(request)


@app.exception_handler(BusinessError)
async def business_error(request,exc):
    return JSONResponse({'code':exc.code,'error':exc.message},status_code=exc.status)


@app.exception_handler(RequestValidationError)
async def invalid(request,exc):
    return JSONResponse({'code':'SCHEMA_INVALID','error':'输入未通过结构校验。','fields':[e['loc'] for e in exc.errors()]},status_code=422)


@app.get('/health')
@app.get('/v1/health')
def health():
    with db.connection() as con:
        count=con.execute('SELECT COUNT(*) FROM asset').fetchone()[0]
    model=os.getenv('SHANGFU_OLLAMA_MODEL') or os.getenv('OLLAMA_MODEL','qwen3:4b')
    base=os.getenv('SHANGFU_OLLAMA_URL') or os.getenv('OLLAMA_URL','')
    ready=False
    if base:
        token=os.getenv('OLLAMA_TOKEN','')
        try:
            check=UrlRequest(base.rstrip('/')+'/api/tags',headers={'Authorization':'Bearer '+token} if token else {})
            with urlopen(check,timeout=3) as upstream:
                ready=any(row.get('name')==model for row in json.load(upstream).get('models',[]))
        except (OSError,ValueError):
            pass
    return {'ready':bool(count),'service':'fastapi','store':'sqlite','catalogCount':count,
            'model':model,'ollamaReady':ready}


@app.get('/v1/catalog')
def catalog():
    with db.connection() as con:
        result=json.loads(con.execute("SELECT data FROM settings WHERE key='catalog'").fetchone()[0])
        result['catalog']=[json.loads(r[0]) for r in con.execute('SELECT data FROM asset ORDER BY ordinal')]
        result.update(backend='fastapi',storage='sqlite')
        return result


def ensure(condition,code,message,status=409):
    if not condition:raise BusinessError(code,message,status)


def stamp(kind,message,actor,version=0,**refs):
    return {'type':kind,'message':message,'actor':actor,'version':version,'changedAt':db.now(),**refs}


@app.post('/v1/projects')
def create(req:NewProject):
    pid=req.projectId or db.uid('PRJ')
    def action(con,p):
        ensure(p['revision']==0,'PROJECT_EXISTS','项目编号已存在。')
        if req.reuseNoteId:db.event(con,pid,stamp('reuse','新项目引用已批准的通用检查项','定制顾问',projectId=pid,noteId=req.reuseNoteId))
        return {'id':pid,'title':req.title,'scene':req.scene},{}
    return db.mutate(pid,req,'create',action,create=(req.title,req.scene,req.reuseNoteId))


@app.post('/v1/extract')
def extract_stage(req:Extract):
    result=extract(req.text,req.scene)
    if not req.projectId:return result
    pid=req.projectId
    def action(con,p):
        if db.return_decision(con,p)=='revise-requirements':
            previous=db.stage(con,pid,'solution',p['solution'])
            ensure(previous['text'].strip()!=req.text.strip(),'CUSTOMER_UPDATE_REQUIRED','请先录入客户确认的修改。')
        iid=req.intakeId or db.uid('IN')
        previous=db.stage(con,pid,'intake',iid)
        intake={'id':iid,'projectId':pid,'rawText':req.text,'scene':req.scene,'createdAt':db.now(),'actor':'定制顾问'}
        if previous:
            ensure(previous['rawText']==req.text and previous['scene']==req.scene,'INTAKE_ID_CONFLICT','原话编号已对应另一份输入。')
        else:
            db.insert(con,pid,'intake',iid,intake)
            db.event(con,pid,stamp('intake','顾问提交客户原话','定制顾问',projectId=pid,intakeId=iid))
        reuse=req.reuseNoteId if 'reuseNoteId' in req.model_fields_set else p['reused']
        if reuse and (p['reused']!=reuse or p['scene']!=req.scene):
            note=con.execute("SELECT data FROM stage WHERE kind='reuse' AND id=?",(reuse,)).fetchone()
            ensure(note and json.loads(note[0])['scene']==req.scene,'REUSE_NOT_APPROVED','复用记录须已批准并适配本单场景。',422)
        db.insert(con,pid,'extraction',db.uid('EXT'),result,iid)
        db.event(con,pid,stamp('extract','根据客户原话生成需求解构草稿','Agent',projectId=pid,intakeId=iid))
        return dict(result),{'title':req.title,'scene':req.scene,'phase':'extracted','intake':iid,'requirement':None,'match':None,'review':None,'reused':reuse}
    return db.mutate(pid,req,'extract',action,create=(req.title,req.scene,req.reuseNoteId))


def check_customer_evidence(parameters,source):
    for field in parameters['fields']:
        if field['source']!='customer' or not field['evidence']:continue
        if any(part.strip() and part.strip() not in source for part in re.split(r'\s*｜\s*',field['evidence'])):
            raise BusinessError('EVIDENCE_MISMATCH','客户证据须可回到原话；顾问新的判断请标记为顾问确认。')


@app.post('/v1/match')
def match_stage(req:Match):
    parameters=req.parameters()
    with db.connection() as con:result=rank_assets(con,parameters,req.scene)
    if not req.projectId:return result
    pid=req.projectId
    def action(con,p):
        ensure(p['phase'] not in ('intake','revise-requirements') and p['intake'],'EXTRACTION_REQUIRED','请先提取当前原话。')
        ensure(not req.intakeId or req.intakeId==p['intake'],'INTAKE_STALE','原话版本已变化。')
        intake=db.stage(con,pid,'intake',p['intake'])
        ensure(parameters['sourceText']==intake['rawText'] and req.scene==p['scene'],'INTAKE_STALE','确认的参数与原话或业务场景不同。')
        check_customer_evidence(parameters,intake['rawText'])
        rid=req.requirementId or db.uid('REQ')
        mid=req.matchId or db.uid('MAT')
        params={'id':rid,'intakeId':p['intake'],'projectId':pid,'actor':'定制顾问','changedAt':db.now(),**parameters}
        db.insert(con,pid,'requirement',rid,params,p['intake'])
        db.insert(con,pid,'match',mid,{**result,'id':mid,'requirementId':rid,'projectId':pid,'changedAt':db.now()},rid)
        refs={'projectId':pid,'intakeId':p['intake'],'requirementId':rid,'matchId':mid}
        db.event(con,pid,stamp('confirm','顾问确认设计参数','定制顾问',**refs))
        db.event(con,pid,stamp('match','当前组合需澄清' if result['blocked'] else '完成资源匹配','Agent',**refs))
        return dict(result),{'phase':'blocked' if result['blocked'] else 'matched','requirement':rid,'match':mid,'review':None}
    return db.mutate(pid,req,'match',action)


def make_proposal(req,parameters):
    settings={**req.model_dump(exclude_none=True),'requirements':parameters}
    result=bridge('proposal',settings)
    from .render import render_solution
    result.update(render_solution(result['solution'],result['drawing'],result['brief']))
    return result


@app.post('/v1/solution')
def solution_stage(req:Solution):
    parameters=req.parameters()
    if not req.projectId:return make_proposal(req,parameters)
    pid=req.projectId
    def action(con,p):
        ensure(p['phase'] in ('matched','generated','approved','archived','revise-pattern') and p['match'],'MATCH_REQUIRED','请先完成当前原话的确认和合格匹配。')
        ensure(req.version==p['version']+1,'VERSION_CONFLICT','请基于当前方案生成下一版。')
        ensure(not req.matchId or req.matchId==p['match'],'MATCH_STALE','资源匹配版本已变化。')
        ensure(req.scene==p['scene'],'MATCH_STALE','业务场景已变更。')
        recorded=db.stage(con,pid,'requirement',p['requirement'])
        ensure(recorded['fields']==parameters['fields'] and recorded['sourceText']==parameters['sourceText'],'REQUIREMENTS_STALE','输入参数须与顾问已确认版本一致。')
        reusable=(con.execute("SELECT data FROM stage WHERE kind='reuse' AND id=?",(p['reused'],)).fetchone() if p['reused'] else None)
        if reusable:parameters['reusedChecks']=json.loads(reusable[0])['checklist']
        elif parameters.get('reusedChecks'):
            raise BusinessError('REUSE_NOT_APPROVED','请先关联已批准的复用记录。')
        matched=db.stage(con,pid,'match',p['match'])
        ensure(not matched['blocked'],'MATCH_BLOCKED','请先处理资源证据缺口。')
        chosen={**matched['recommended'],**(req.selected or {})}
        ensure(all(not aid or any(i['id']==aid and i['type']==kind for i in matched['eligible']) for kind,aid in chosen.items()),
               'RESOURCE_INELIGIBLE','所选资源不在本次可用候选中。',422)
        result=make_proposal(req.model_copy(update={'selected':chosen}),parameters)
        sol,drawing=result['solution'],result['drawing']
        if db.return_decision(con,p)=='revise-pattern':
            prior=db.stage(con,pid,'solution',p['solution'])['solution']
            ensure(prior['cad']!=sol['cad'] or any(prior['selected'].get(k)!=sol['selected'].get(k) for k in ('pattern','fabric','craft')),
                   'DRAWING_UNCHANGED','版师退回的图纸尚未修订。')
        trace={'projectId':pid,'intakeId':p['intake'],'requirementId':p['requirement'],'matchId':p['match'],'solutionId':sol['id'],'drawingId':drawing['id']}
        record={**result,'version':req.version,'reason':req.reason or '生成参考方案与图纸','actor':req.actor,'changedAt':db.now(),'requirements':parameters,
                'text':recorded['sourceText'],'scene':req.scene,'match':matched,'trace':trace}
        db.insert(con,pid,'solution',sol['id'],record,p['match'],req.version)
        db.event(con,pid,stamp('revision' if req.version>1 else 'solution',record['reason'],req.actor,req.version,**trace))
        db.event(con,pid,stamp('visual','生成同版图纸和三套视觉提示词','Agent',req.version,**trace))
        return {**result,'trace':trace,'changedAt':record['changedAt']},{'phase':'generated','solution':sol['id'],'version':req.version,'review':None}
    return db.mutate(pid,req,'solution',action)


def revision(con,p,req):
    ensure(p['solution']==req.solutionId and p['version']==req.version,'REVISION_STALE','操作与当前方案版本不符。')
    record=db.stage(con,p['id'],'solution',req.solutionId)
    if hasattr(req,'drawingId'):
        ensure(req.drawingId==record['drawing']['id'],'DRAWING_STALE','图纸与当前方案版本不符。')
    return record


@app.post('/v1/projects/{pid}/review')
def review(pid:str,req:Review):
    def action(con,p):
        record=revision(con,p,req)
        ensure(p['phase'] in ('generated','approved'),'NEW_REVISION_REQUIRED','请先完成当前退回或建立新版。')
        key=req.reviewId or db.uid('REV')
        e=stamp('pattern-review','版师复核：'+req.comment,'版师',req.version,**record['trace'],reviewId=key,decision=req.decision,comment=req.comment)
        db.insert(con,pid,'review',key,e,p['solution'],req.version)
        db.event(con,pid,e)
        return {'event':e},{'phase':req.decision,'review':key}
    return db.mutate(pid,req,'review',action)


@app.post('/v1/projects/{pid}/archive')
def archive(pid:str,req:Archive):
    def action(con,p):
        record=revision(con,p,req)
        ensure(p['phase']=='approved' and p['review']==req.reviewId,'DELIVERY_PATTERN_REVIEW_REQUIRED','当前图纸须先通过版师复核。',422)
        decision=db.stage(con,pid,'review',req.reviewId)
        ensure(decision and decision['decision']=='approved' and decision['drawingId']==req.drawingId,'DELIVERY_PATTERN_REVIEW_REQUIRED','未找到同版版师意见。',422)
        e=stamp('archive','业务人员确认归档参考稿','业务人员',req.version,**record['trace'],reviewId=req.reviewId)
        db.insert(con,pid,'archive',req.solutionId,e,req.reviewId,req.version)
        db.event(con,pid,e)
        return {'event':e},{'phase':'archived'}
    return db.mutate(pid,req,'archive',action)


@app.post('/v1/projects/{pid}/reuse')
def approve_reuse(pid:str,req:Reuse):
    def action(con,p):
        revision(con,p,req)
        ensure(p['phase']=='archived','ARCHIVE_REQUIRED','归档后方可批准通用检查事项。')
        for entry in req.checklist:
            ensure(not re.search(r'\d+(?:\.\d+)?\s*(?:mm|cm|毫米|厘米)|1[3-9]\d{9}|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}',entry,re.I),'PERSONAL_REUSE','请从复用记录移除客户尺寸或联系方式。',422)
        key=req.noteId or db.uid('NOTE')
        note={'id':key,'title':p['title'],'projectId':pid,'scene':p['scene'],'version':req.version,'checklist':req.checklist,'approvedAt':db.now()}
        db.insert(con,pid,'reuse',key,note,p['solution'],req.version)
        db.event(con,pid,stamp('reuse','业务人员批准通用复用检查项','业务人员',req.version,noteId=key))
        return {'note':note},{'note':key}
    return db.mutate(pid,req,'reuse',action)


@app.get('/v1/notes')
def notes():
    with db.connection() as con:return {'notes':[json.loads(r[0]) for r in con.execute("SELECT data FROM stage WHERE kind='reuse' ORDER BY rowid DESC")]}


@app.get('/v1/projects')
def projects():
    with db.connection() as con:
        return {'projects':[dict(r) for r in con.execute('SELECT id,title,scene,phase,revision,version,created FROM project ORDER BY rowid DESC')]}


@app.get('/v1/projects/{pid}')
def get_project(pid:str):
    with db.connection() as con:
        con.execute('BEGIN')
        p=db.require_project(con,pid)
        requirements=db.stage(con,pid,'requirement',p['requirement'])
        if not requirements and p['intake']:
            row=con.execute("SELECT data FROM stage WHERE project=? AND kind='extraction' AND parent=? ORDER BY rowid DESC LIMIT 1",(pid,p['intake'])).fetchone()
            if row:requirements=json.loads(row[0])
        history=db.stages(con,pid,'solution')
        current=history[-1] if history else {}
        archives=db.stages(con,pid,'archive')
        intakes=db.stages(con,pid,'intake')
        last=db.stage(con,pid,'intake',p['intake']) or {}
        note=con.execute("SELECT data FROM stage WHERE kind='reuse' AND id=?",(p['reused'],)).fetchone() if p['reused'] else None
        return {**p,'createdAt':p['created'],'projectId':pid,'intakeId':p['intake'],'requirementId':p['requirement'],'matchId':p['match'],'solutionId':p['solution'],
            'text':last.get('rawText',''),'intakes':intakes,'requirements':requirements,'confirmations':db.stages(con,pid,'requirement'),
            'matchRuns':db.stages(con,pid,'match'),'match':db.stage(con,pid,'match',p['match']),'history':history[:-1],'currentRevision':current or None,
            'solution':current.get('solution'),'drawing':current.get('drawing'),'brief':current.get('brief'),
            'reused':json.loads(note[0]) if note else None,'caseNote':db.stage(con,pid,'reuse',p['note']),
            'archivedVersions':[r['version'] for r in archives],'events':[json.loads(r[0]) for r in con.execute('SELECT data FROM event WHERE project=? ORDER BY seq',(pid,))]}


@app.post('/v1/render/{kind}')
def render(kind:Literal['xlsx','bundle','delivery'],req:RenderJob):
    if kind=='delivery':
        ensure(req.projectId and req.solutionId and req.version,'DELIVERY_ARCHIVE_REQUIRED','核对版需要已归档的持久化项目。',422)
        with db.connection() as con:
            p=db.require_project(con,req.projectId)
            ensure(p['phase']=='archived' and p['solution']==req.solutionId and p['version']==req.version and db.stage(con,p['id'],'archive',req.solutionId),
                   'DELIVERY_PATTERN_REVIEW_REQUIRED','数据库未找到当前方案的版师复核及正式归档。',422)
            recorded=db.stage(con,p['id'],'solution',p['solution'])
            archived=db.stage(con,p['id'],'archive',p['solution'])
            solution=req.model.get('solution',{})
            manifest=req.model.get('manifest',{})
            ensure(manifest.get('projectId')==req.projectId and manifest.get('solutionId')==req.solutionId and
                   manifest.get('version')==req.version and solution.get('id')==req.solutionId and solution.get('version')==req.version and
                   req.model.get('drawing',{}).get('id')==recorded['drawing']['id'] and
                   all(solution.get(k)==recorded['solution'].get(k) for k in ('selected','cad','requirements','sourceText','scene')) and
                   archived['reviewId']==p['review'],'DELIVERY_MODEL_STALE','交付数据、图纸和入库复核版本须一致。',422)
            for photo in manifest.get('visual',{}).get('photos',{}).get('views',[]):
                if photo.get('reviewStatus')=='advisor-reviewed':
                    saved=con.execute('SELECT digest,approved FROM visual_image WHERE project=? AND solution=? AND key=?',
                                      (p['id'],p['solution'],photo.get('key'))).fetchone()
                    ensure(saved and saved[0]==photo.get('sha256') and saved[1],'DELIVERY_PHOTOS_REQUIRED','归档中的生成图须对应版本库中已逐张核对的原图。',422)
    from .render import render_export
    blob=render_export(req.model,kind)
    media='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' if kind=='xlsx' else 'application/zip'
    return Response(content=blob,media_type=media,headers={'Cache-Control':'no-store'})
