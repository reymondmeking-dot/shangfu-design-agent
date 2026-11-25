import base64
import binascii
import hashlib
import json
import os
from typing import Any, Literal
from fastapi import APIRouter
from pydantic import BaseModel, Field
from . import db
from .domain import BusinessError
from .schema import Ident

router=APIRouter()
View=Literal['garment','detail','on-body']
SPECS={'garment':(1500,1000),'detail':(1200,1200),'on-body':(1200,1500)}
LIMIT=2*1024*1024


class ImageUpload(BaseModel):
    solutionId:Ident
    version:int=Field(ge=1,le=40)
    solution:dict[str,Any]
    image:dict[str,Any]
    verifiedByEdge:bool=False


class VisualEvent(BaseModel):
    eventId:Ident
    solutionId:Ident
    version:int=Field(ge=1,le=40)
    type:Literal['approve-photo','photo-feedback']
    photoKey:View
    imageReceipt:str|None=Field(None,max_length=255)
    feedback:str=Field('',max_length=400)
    action:Literal['redraw','requirements']|None=None
    checks:list[str]=Field(default_factory=list,max_length=12)


def demand(ok,code,message,status=422):
    if not ok:raise BusinessError(code,message,status)


def dimensions(data):
    if not data.startswith(b'\xff\xd8') or not data.endswith(b'\xff\xd9'):return None
    i=2
    while i+9<len(data) and data[i]==255:
        while i<len(data) and data[i]==255:i+=1
        if i+9>=len(data):return None
        marker=data[i];i+=1
        span=int.from_bytes(data[i:i+2],'big')
        if marker in (0xd9,0xda) or span<2 or i+span>len(data):return None
        if marker in (0xc0,0xc1,0xc2) and span>=8:return (int.from_bytes(data[i+5:i+7],'big'),int.from_bytes(data[i+3:i+5],'big'))
        i+=span
    return None


@router.post('/v1/projects/{pid}/visual-images')
def store(pid:str,req:ImageUpload):
    image=dict(req.image)
    key=image.get('key','')
    demand(req.verifiedByEdge and key in SPECS,'PHOTO_RECEIPT_REQUIRED','须由入口先核验同版模型签名。')
    data=image.pop('data','')
    demand(isinstance(data,str) and len(data)<=4*((LIMIT+2)//3),'PHOTO_TOO_LARGE','每张 JPEG 上限为 2 MiB。')
    try:raw=base64.b64decode(data,validate=True)
    except (binascii.Error,ValueError):raise BusinessError('PHOTO_DATA_INVALID','无法读取 JPEG 数据。')
    digest=hashlib.sha256(raw).hexdigest()
    demand(len(raw)<=LIMIT and dimensions(raw)==SPECS[key] and digest==image.get('sha256'),'PHOTO_SPEC_MISMATCH','文件摘要或实际 JPEG 尺寸不符。')
    receipt=image.get('receipt')
    demand(isinstance(receipt,str) and len(receipt)<256,'PHOTO_RECEIPT_REQUIRED','图片签名缺失。')
    image.pop('approved',None)
    with db.connection() as con,db.transaction(con):
        project=db.require_project(con,pid)
        record=db.stage(con,pid,'solution',req.solutionId)
        demand(record and record['version']==req.version and all(record['solution'].get(k)==req.solution.get(k) for k in
            ('id','version','cad','requirements','sourceText','color','selected','scene')),'PHOTO_REVISION_STALE','图片与入库方案不符。')
        old=con.execute('SELECT receipt,length(bytes) FROM visual_image WHERE project=? AND solution=? AND key=?',(pid,req.solutionId,key)).fetchone()
        if old and old[0]==receipt:return {'stored':True,'sha256':digest,'receipt':receipt}
        demand(project['solution']==req.solutionId and project['phase'] in ('generated','approved','archived'),'PHOTO_REVISION_STALE','更新的图片须对应当前方案。',409)
        if old:
            demand(project['phase']=='generated','NEW_REVISION_REQUIRED','复核或归档后重出图片须建立新版。',409)
            history=con.execute("SELECT data FROM stage WHERE project=? AND kind='visual-event' AND parent=? ORDER BY rowid DESC",(pid,req.solutionId))
            demand(any(e['type']=='photo-feedback' and e['photoKey']==key and e['imageReceipt']==old[0] and e.get('action')=='redraw'
                       for e in (json.loads(row[0]) for row in history)),'PHOTO_REPLACEMENT_REQUIRED','重出前请记录当前图片的修改意见。',409)
        if key=='garment' and old:
            con.execute("DELETE FROM visual_image WHERE project=? AND solution=? AND key!='garment'",(pid,req.solutionId))
        if key!='garment':
            mother=con.execute("SELECT digest FROM visual_image WHERE project=? AND solution=? AND key='garment'",(pid,req.solutionId)).fetchone()
            demand(mother and mother[0]==image.get('parent'),'PHOTO_REFERENCE_STALE','缺少同版母图或母图已改变。',409)
        delta=len(raw)-(old[1] if old else 0)
        per_project,total=con.execute('SELECT COALESCE(SUM(CASE WHEN project=? THEN length(bytes) ELSE 0 END),0),COALESCE(SUM(length(bytes)),0) FROM visual_image',(pid,)).fetchone()
        demand(per_project+delta<=int(os.getenv('SHANGFU_PROJECT_PHOTO_QUOTA_BYTES',64*1024**2)) and total+delta<=int(os.getenv('SHANGFU_PHOTO_QUOTA_BYTES',512*1024**2)),
               'PHOTO_STORAGE_FULL','项目库图片存储配额已用完。',507)
        con.execute('INSERT OR REPLACE INTO visual_image VALUES(?,?,?,?,?,?,?,0)',(pid,req.solutionId,key,receipt,digest,db.dump(image),raw))
        db.event(con,pid,{'type':'visual-photo','actor':'Agent','changedAt':db.now(),'message':'保存同版模型签名图片','solutionId':req.solutionId,
            'version':req.version,'photoKey':key,'imageReceipt':receipt})
        return {'stored':True,'sha256':digest,'receipt':receipt}


@router.get('/v1/projects/{pid}/visual-images/{sid}')
def images(pid:str,sid:str):
    with db.connection() as con:
        con.execute('BEGIN')
        db.require_project(con,pid)
        demand(db.stage(con,pid,'solution',sid),'SOLUTION_NOT_FOUND','找不到此项目的方案。',404)
        rows=con.execute("SELECT meta,bytes,approved FROM visual_image WHERE project=? AND solution=? ORDER BY CASE key WHEN 'garment' THEN 0 WHEN 'detail' THEN 1 ELSE 2 END",(pid,sid))
        events=con.execute("SELECT data FROM stage WHERE project=? AND kind='visual-event' AND parent=? ORDER BY rowid",(pid,sid))
        return {'solutionId':sid,'images':[{**json.loads(r[0]),'data':base64.b64encode(r[1]).decode(),'approved':bool(r[2])} for r in rows],
                'events':[json.loads(r[0]) for r in events]}


@router.post('/v1/projects/{pid}/visual-events')
def save_event(pid:str,req:VisualEvent):
    with db.connection() as con,db.transaction(con):
        project=db.require_project(con,pid)
        record=db.stage(con,pid,'solution',req.solutionId)
        demand(record and record['version']==req.version,'PHOTO_REVISION_STALE','图片意见与项目方案不符。')
        old=db.stage(con,pid,'visual-event',req.eventId)
        body=req.model_dump()
        if old:
            demand(all(old.get(k)==v for k,v in body.items()),'VISUAL_EVENT_CONFLICT','事件编号已经使用。',409)
            return {'event':old}
        photo=con.execute('SELECT receipt FROM visual_image WHERE project=? AND solution=? AND key=?',(pid,req.solutionId,req.photoKey)).fetchone()
        demand((photo and photo[0]==req.imageReceipt) or (not photo and not req.imageReceipt and req.type=='photo-feedback'),
               'PHOTO_RECEIPT_MISMATCH','请对本版的已登记图片操作。')
        if req.type=='approve-photo':
            defined=next((p['checks'] for p in record['brief']['prompts'] if p['key']==req.photoKey),[])
            demand(bool(defined) and req.checks==defined,'PHOTO_CHECKS_REQUIRED','请逐项核对同版验收要点。')
            past=con.execute("SELECT data FROM stage WHERE project=? AND kind='visual-event' AND parent=?",(pid,req.solutionId))
            demand(not any(e['type']=='photo-feedback' and e['imageReceipt']==req.imageReceipt for e in (json.loads(r[0]) for r in past)),
                   'PHOTO_REJECTED','该图片已有退回意见，须先完成修改。')
        else:demand(bool(req.feedback.strip()),'PHOTO_FEEDBACK_REQUIRED','请填写具体修改意见。')
        if photo:con.execute('UPDATE visual_image SET approved=? WHERE project=? AND solution=? AND key=?',(int(req.type=='approve-photo'),pid,req.solutionId,req.photoKey))
        if req.type=='photo-feedback' and req.photoKey=='garment' and req.action=='redraw':
            if project['phase']=='generated' and project['solution']==req.solutionId:
                con.execute("DELETE FROM visual_image WHERE project=? AND solution=? AND key!='garment'",(pid,req.solutionId))
        event={**body,'actor':'定制顾问','changedAt':db.now(),'projectId':pid,'message':('顾问核对：'+'、'.join(req.checks) if req.type=='approve-photo' else '顾问反馈：'+req.feedback)}
        db.insert(con,pid,'visual-event',req.eventId,event,req.solutionId,req.version)
        db.event(con,pid,event)
        return {'event':event}
