import hashlib
import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from .domain import BusinessError, bridge


def uid(kind):
    return kind+'-'+str(uuid4())


def now():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')


def dump(value):
    return json.dumps(value,ensure_ascii=False,separators=(',',':'),sort_keys=True)


def connect():
    path=Path(os.getenv('SHANGFU_DB','./var/design-agent.sqlite3'))
    path.parent.mkdir(exist_ok=True,parents=True)
    con=sqlite3.connect(path,timeout=10,isolation_level=None)
    con.row_factory=sqlite3.Row
    con.execute('PRAGMA foreign_keys=ON')
    return con


def initialize():
    payload=bridge('assets',{})
    with connection() as con:
        con.execute('PRAGMA journal_mode=WAL')
        con.executescript("""
        CREATE TABLE IF NOT EXISTS project(id TEXT PRIMARY KEY,title TEXT NOT NULL,scene TEXT NOT NULL,
          created TEXT NOT NULL,revision INTEGER NOT NULL,phase TEXT NOT NULL,intake TEXT,requirement TEXT,
          match TEXT,solution TEXT,version INTEGER NOT NULL DEFAULT 0,review TEXT,note TEXT,reused TEXT);
        CREATE TABLE IF NOT EXISTS stage(id TEXT NOT NULL,project TEXT NOT NULL REFERENCES project(id),kind TEXT NOT NULL,
          version INTEGER NOT NULL,parent TEXT,created TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(project,kind,id));
        CREATE INDEX IF NOT EXISTS stage_history ON stage(project,kind,version,created);
        CREATE UNIQUE INDEX IF NOT EXISTS public_stage_id ON stage(kind,id) WHERE kind IN ('solution','reuse');
        CREATE TABLE IF NOT EXISTS event(seq INTEGER PRIMARY KEY,project TEXT NOT NULL REFERENCES project(id), data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS receipt(project TEXT NOT NULL,request TEXT NOT NULL,fingerprint TEXT NOT NULL,
          response TEXT NOT NULL,PRIMARY KEY(project,request));
        CREATE TABLE IF NOT EXISTS asset(id TEXT PRIMARY KEY,ordinal INTEGER NOT NULL,data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS asset_scene(id TEXT NOT NULL REFERENCES asset(id),scene TEXT NOT NULL,PRIMARY KEY(id,scene));
        CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS visual_image(project TEXT NOT NULL REFERENCES project(id),solution TEXT NOT NULL,
          key TEXT NOT NULL,receipt TEXT NOT NULL,digest TEXT NOT NULL,meta TEXT NOT NULL,bytes BLOB NOT NULL,
          approved INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(project,solution,key));
        """)
        with transaction(con):
            con.execute('DELETE FROM asset_scene')
            con.execute('DELETE FROM asset')
            for position,item in enumerate(payload['catalog']):
                con.execute('INSERT INTO asset VALUES(?,?,?)',(item['id'],position,dump(item)))
                con.executemany('INSERT INTO asset_scene VALUES(?,?)',[(item['id'],scene) for scene in item['scenes']])
            con.execute('INSERT OR REPLACE INTO settings VALUES(?,?)',('catalog',dump({k:v for k,v in payload.items() if k!='catalog'})))


@contextmanager
def connection():
    con=connect()
    try:yield con
    finally:con.close()


@contextmanager
def transaction(con):
    con.execute('BEGIN IMMEDIATE')
    try:
        yield
        con.execute('COMMIT')
    except BaseException:
        con.execute('ROLLBACK')
        raise


def require_project(con,pid,*,include_deleted=False):
    row=con.execute('SELECT * FROM project WHERE id=?',(pid,)).fetchone()
    if row is not None and not include_deleted and row['phase']=='deleted':
        raise BusinessError('PROJECT_NOT_FOUND','项目已删除。',404)
    if row is None:raise BusinessError('PROJECT_NOT_FOUND','未找到此项目。',404)
    return dict(row)


def available_reuse_note(con,note_id):
    return con.execute("""SELECT s.data FROM stage AS s JOIN project AS p ON p.id=s.project
        WHERE s.kind='reuse' AND s.id=? AND p.phase!='deleted'""",(note_id,)).fetchone()


def new_project(con,pid,title,scene,note=None):
    if note:
        found=available_reuse_note(con,note)
        if not found or json.loads(found[0])['scene']!=scene:
            raise BusinessError('REUSE_NOT_APPROVED','来源项目尚未批准此场景的复用记录。')
    con.execute('INSERT INTO project(id,title,scene,created,revision,phase,reused) VALUES(?,?,?,?,0,?,?)',
                (pid,title,scene,now(),'intake',note))


def stage(con,pid,kind,key):
    row=con.execute('SELECT data FROM stage WHERE project=? AND kind=? AND id=?',(pid,kind,key)).fetchone()
    return json.loads(row[0]) if row else None


def stages(con,pid,kind):
    return [json.loads(row[0]) for row in con.execute('SELECT data FROM stage WHERE project=? AND kind=? ORDER BY rowid',(pid,kind))]


def return_decision(con,p):
    row=con.execute("SELECT data FROM stage WHERE project=? AND kind='review' AND parent=? ORDER BY rowid DESC LIMIT 1",
                    (p['id'],p['solution'])).fetchone()
    return json.loads(row[0])['decision'] if row else None


def insert(con,pid,kind,key,data,parent=None,version=0):
    try:con.execute('INSERT INTO stage VALUES(?,?,?,?,?,?,?)',(key,pid,kind,version,parent,now(),dump(data)))
    except sqlite3.IntegrityError as exc:raise BusinessError('STAGE_ID_CONFLICT','该阶段编号已被使用，请刷新项目。',409) from exc


def event(con,pid,data):
    con.execute('INSERT INTO event(project,data) VALUES(?,?)',(pid,dump(data)))


def mutate(pid,req,operation,action,create=None):
    data=req.model_dump()
    if operation=='create' and data.get('rawText') is None:
        # Match request receipts from before draft text could be saved at creation.
        data.pop('rawText',None)
        data['title']=data['title'].strip()
    fingerprint=hashlib.sha256(dump([operation,data]).encode()).hexdigest()
    with connection() as con,transaction(con):
        if create and not con.execute('SELECT 1 FROM project WHERE id=?',(pid,)).fetchone():
            new_project(con,pid,*create)
        project=require_project(con,pid)
        if req.requestId:
            prior=con.execute('SELECT fingerprint,response FROM receipt WHERE project=? AND request=?',(pid,req.requestId)).fetchone()
            if prior:
                if prior[0]!=fingerprint:raise BusinessError('REQUEST_ID_CONFLICT','请求编号对应的操作不同。',409)
                return json.loads(prior[1])
        if req.expectedRevision is not None and req.expectedRevision!=project['revision']:
            raise BusinessError('REVISION_CONFLICT','项目已更新，请读取最新版本。',409)
        payload,changes=action(con,project)
        changes['revision']=project['revision']+1
        con.execute('UPDATE project SET '+','.join(k+'=?' for k in changes)+' WHERE id=?',(*changes.values(),pid))
        p=require_project(con,pid)
        payload['workflow']={'projectId':pid,'intakeId':p['intake'],'requirementId':p['requirement'],'matchId':p['match'],
            'solutionId':p['solution'],'reviewId':p['review'],'version':p['version'],'revision':p['revision'],'phase':p['phase']}
        if req.requestId:con.execute('INSERT INTO receipt VALUES(?,?,?,?)',(pid,req.requestId,fingerprint,dump(payload)))
        return payload
