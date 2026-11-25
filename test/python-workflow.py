"""Exercise the Python service over real HTTP, restarting it with the same SQLite file."""
import concurrent.futures
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import ProxyHandler, Request, build_opener

ROOT=Path(__file__).resolve().parents[1]


class ProjectStages(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        with socket.socket() as sock:
            sock.bind(('127.0.0.1',0))
            self.port=sock.getsockname()[1]
        self.env={**os.environ,'SHANGFU_DB':str(Path(self.temp.name)/'demo.sqlite3'),'SHANGFU_SERVICE_TOKEN':'service-test'}
        self.client=build_opener(ProxyHandler({}))
        for key in ('OLLAMA_URL','SHANGFU_OLLAMA_URL'):self.env.pop(key,None)
        self.start()
        self.addCleanup(self.stop)

    def start(self):
        self.server=subprocess.Popen([sys.executable,'-m','uvicorn','python_service.app:app','--host','127.0.0.1','--port',str(self.port),'--log-level','warning'],cwd=ROOT,env=self.env)
        for _ in range(100):
            try:
                if self.http('/health')[0]==200:return
            except OSError:time.sleep(.05)
        self.fail('Python service did not start')

    def stop(self):
        self.server.terminate()
        self.server.wait(timeout=15)

    def http(self,path,data=None,*,method=None,base=None,origin=None):
        headers={'Authorization':'Bearer service-test','Content-Type':'application/json'}
        if origin is not None:headers['Origin']=origin
        url=(base or 'http://127.0.0.1:'+str(self.port))+path
        req=Request(url,method=method or ('GET' if data is None else 'POST'),
            data=None if data is None else json.dumps(data,ensure_ascii=False).encode(),headers=headers)
        try:
            with self.client.open(req,timeout=30) as response:return response.status,json.load(response)
        except HTTPError as exc:return exc.code,json.load(exc)

    def ok(self,path,data=None):
        code,body=self.http(path,data)
        self.assertEqual(code,200,body)
        return body

    def test_server_owned_workflow(self):
        cat=self.ok('/v1/catalog')
        self.assertEqual(len(cat['catalog']),31)
        sample=cat['cases'][1]
        base={'projectId':'project-a','scene':sample['scene']}
        self.assertEqual(self.http('/v1/extract',{**base,'text':' \r\n\t '})[0],422)
        raw={'text':' \t\r\n'+sample['text']+'\r\n  ',**base,'intakeId':'IN-a','requestId':'first','expectedRevision':0}
        parameters=self.ok('/v1/extract',raw)
        self.assertEqual(parameters['mode'],'rules-fallback')
        self.assertEqual(parameters['sourceText'],raw['text'])
        self.assertEqual(parameters,self.ok('/v1/extract',raw))
        self.assertEqual(self.http('/v1/extract',{**raw,'text':raw['text']+' xx'})[0],409)
        args={**base,'requirements':{k:v for k,v in parameters.items() if k!='workflow'},'intakeId':'IN-a','requirementId':'REQ-a','matchId':'MAT-a'}
        bad={**args,'requirements':{**args['requirements'],'fields':[dict(f) for f in parameters['fields']]}}
        bad['requirements']['fields'][0].update(evidence='虚构证据',source='customer')
        self.assertEqual(self.http('/v1/match',bad)[1]['code'],'EVIDENCE_MISMATCH')
        m=self.ok('/v1/match',args)
        self.assertFalse(m['blocked'])
        self.assertEqual(m['recommended']['fabric'],'FAB-003')
        p={**args,'selected':m['recommended'],'version':1,'solutionId':'SOL-PY-1'}
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(lambda i:self.http('/v1/solution',{**p,'requestId':'race-'+str(i),'expectedRevision':2}),[1,2]))
        self.assertEqual(sorted(r[0] for r in results),[200,409],results)
        result=next(r[1] for r in results if r[0]==200)
        self.assertEqual(result['solution']['id'],'SOL-PY-1')
        ref={'version':1,'solutionId':result['solution']['id'],'drawingId':result['drawing']['id']}
        path='/v1/projects/project-a/'
        self.assertEqual(self.http(path+'archive',{**ref,'reviewId':'missing'})[1]['code'],'DELIVERY_PATTERN_REVIEW_REQUIRED')
        changes=self.ok(path+'review',{**ref,'decision':'revise-pattern','comment':'请复核门襟宽度后重出图纸。','reviewId':'REV-1'})
        self.assertEqual(changes['workflow']['phase'],'revise-pattern')
        self.assertEqual(self.http('/v1/solution',{**p,'version':2,'solutionId':'SOL-PY-2'})[1]['code'],'DRAWING_UNCHANGED')
        second=self.ok('/v1/solution',{**p,'version':2,'solutionId':'SOL-PY-2','placketWidth':35})
        ref.update(version=2,solutionId='SOL-PY-2',drawingId=second['drawing']['id'])
        self.ok(path+'review',{**ref,'decision':'approved','comment':'核对本版门襟和领型。','reviewId':'REV-2'})
        self.assertEqual(self.http(path+'archive',{**ref,'reviewId':'REV-1'})[0],422)
        self.ok(path+'archive',{**ref,'reviewId':'REV-2'})
        self.ok(path+'reuse',{'solutionId':'SOL-PY-2','version':2,'noteId':'NOTE-1','checklist':['比对补货样卡']})
        self.stop()
        self.start()
        snapshot=self.ok('/v1/projects/project-a')
        self.assertEqual(snapshot['intakes'][0]['rawText'],raw['text'])
        self.assertEqual(snapshot['archivedVersions'],[2])
        self.assertEqual(snapshot['history'][0]['trace']['requirementId'],'REQ-a')
        self.assertEqual(snapshot['events'][-2]['reviewId'],'REV-2')
        self.assertEqual(len(snapshot['confirmations']),1)
        subprocess.run(
            ['node','test/verify-exports.mjs'],cwd=ROOT,check=True,
            env={**self.env,'SHANGFU_ORIGIN':'http://127.0.0.1:'+str(self.port)},
        )
        self.ok('/v1/projects',{'projectId':'project-b','scene':'group','reuseNoteId':'NOTE-1'})
        follow=self.ok('/v1/projects/project-b')
        self.assertEqual(follow['reused']['checklist'],['比对补货样卡'])
        self.assertEqual(follow['text'],'')
        self.assertIsNone(follow['solution'])
        self.ok('/v1/extract',{'projectId':'project-b','scene':'group','text':'接待团队外套，必须可机洗。'})
        self.assertEqual(self.ok('/v1/projects/project-b')['reused']['id'],'NOTE-1')

        revision=str(snapshot['revision'])
        url='/v1/projects/project-a?expectedRevision='+revision
        self.assertEqual(self.http(url,method='DELETE',origin='https://foreign.example')[0],403)
        self.assertEqual(self.http('/v1/projects/project-a?expectedRevision=0',method='DELETE')[0],409)
        self.assertEqual(self.http('/v1/projects/project-a',method='DELETE')[0],422)
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            attempts=list(pool.map(lambda _:self.http(url,method='DELETE'),range(2)))
        self.assertEqual(attempts,[(200,{'id':'project-a','deleted':True})]*2)
        self.stop()
        self.start()
        self.assertEqual(self.http(url,method='DELETE'),attempts[0])
        self.assertEqual(self.http('/v1/projects/missing?expectedRevision=1',method='DELETE')[0],404)
        self.assertEqual(self.http('/v1/projects/project-a')[0],404)
        self.assertEqual(self.http('/v1/projects/project-a/visual-images/SOL-PY-2')[0],404)
        self.assertEqual(self.http('/v1/extract',raw)[0],404,'a saved request receipt must not revive a deleted project')
        self.assertEqual(self.ok('/v1/notes')['notes'],[])
        self.assertEqual(self.ok('/v1/projects/project-b')['reused']['checklist'],['比对补货样卡'])
        self.assertEqual(self.http('/v1/projects',{'projectId':'project-c','scene':'group','reuseNoteId':'NOTE-1'})[1]['code'],'REUSE_NOT_APPROVED')
        project_list=self.ok('/v1/projects')
        self.assertEqual([p['id'] for p in project_list['projects']],['project-b'])
        self.assertEqual(project_list['deletedProjectIds'],['project-a'])

    def test_save_draft_before_extracting(self):
        path='/v1/projects'
        raw='  顾客说：“领口低一点”。\n  肩部想宽松。\t'
        title='  礼宾夹克 初稿  '
        args={'projectId':'draft-a','title':title,'rawText':raw,'scene':'group','expectedRevision':0,'requestId':'save'}
        saved=self.ok(path,args)
        self.assertEqual(saved['workflow']['phase'],'intake')
        self.assertEqual(saved['workflow']['intakeId'],saved['intake']['id'])
        self.assertEqual(saved['intake']['actor'],'定制顾问')
        self.assertEqual(self.ok(path,args),saved)
        self.assertEqual(self.http(path,{**args,'rawText':'不同的原话'})[1]['code'],'REQUEST_ID_CONFLICT')
        self.stop()
        self.start()
        record=self.ok(path+'/draft-a')
        self.assertEqual((record['title'],record['text'],record['intakes'],record['requirements'],record['solution']),
                         (title,raw,[saved['intake']],None,None))
        self.assertEqual(self.ok(path)['projects'][0]['phase'],'intake')
        result=self.ok('/v1/extract',{'projectId':'draft-a','text':raw,'scene':'group','expectedRevision':1})
        self.assertEqual(result['workflow']['intakeId'],saved['intake']['id'])
        self.assertEqual(result['sourceText'],raw)
        self.assertEqual(self.ok(path+'/draft-a')['title'],title)
        self.assertEqual(len(self.ok(path+'/draft-a')['intakes']),1)
        self.assertEqual(self.ok('/v1/extract',{'projectId':'draft-a','text':raw+'修改','scene':'group','expectedRevision':2})['workflow']['phase'],'extracted')
        self.assertEqual(len(self.ok(path+'/draft-a')['intakes']),2)
        self.assertEqual(self.ok(path,{'projectId':'empty-draft','rawText':''})['workflow']['intakeId'],None)
        self.assertEqual(self.http(path,{'projectId':'oversized','rawText':'字'*4201})[0],422)

    def test_delete_through_workbench_api(self):
        with socket.socket() as sock:
            sock.bind(('127.0.0.1',0))
            port=sock.getsockname()[1]
        origin='http://127.0.0.1:'+str(port)
        proxy=subprocess.Popen(['node','src/local.mjs'],cwd=ROOT,env={
            **self.env,'SHANGFU_ORIGIN':'http://127.0.0.1:'+str(self.port),'PORT':str(port),'HOST':'127.0.0.1',
            'REQUIRE_PASSWORD':'0','SHANGFU_REMOTE_IMAGES':'0',
        },stdout=subprocess.DEVNULL)
        try:
            for _ in range(100):
                try:
                    if self.http('/design-agent/api/health',base=origin)[0]==200:break
                except OSError:time.sleep(.05)
            else:self.fail('Workbench did not start')
            path='/design-agent/api/projects'
            pid='delete-proxy-test'
            self.assertEqual(self.http(path,{'projectId':pid},base=origin,origin=origin)[0],200)
            record=self.http(path+'/'+pid,base=origin)[1]
            target=path+'/'+pid+'?expectedRevision='+str(record['revision'])
            for bad in [None,'https://foreign.example']:
                self.assertEqual(self.http(target,method='DELETE',base=origin,origin=bad)[0],403)
            self.assertEqual(self.http(path+'/'+pid+'?expectedRevision=0',method='DELETE',base=origin,origin=origin)[0],409)
            self.assertEqual(self.http(path+'/'+pid+'?expectedRevision=invalid',method='DELETE',base=origin,origin=origin)[0],422)
            self.assertEqual(self.http(target,method='DELETE',base=origin,origin=origin),(200,{'id':pid,'deleted':True}))
            self.assertEqual(self.http(path+'/'+pid,base=origin)[0],404)
        finally:
            proxy.terminate()
            proxy.wait(timeout=15)

    def test_structured_ollama_protocol_and_evidence(self):
        received=[]
        class OllamaProtocol(BaseHTTPRequestHandler):
            def log_message(self,*args):pass
            def do_POST(self):
                request=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                received.append(request)
                self.send_response(200);self.end_headers()
                quote='面料有磨砂触感' if len(received)==1 else '面料有未提及的药效'
                content=json.dumps({'observations':[{'key':'fabric','value':quote[3:],'quote':quote}]},ensure_ascii=False)
                self.wfile.write(json.dumps({'message':{'content':content}},ensure_ascii=False).encode())
        stub=ThreadingHTTPServer(('127.0.0.1',0),OllamaProtocol)
        threading.Thread(target=stub.serve_forever,daemon=True).start()
        self.addCleanup(stub.server_close);self.addCleanup(stub.shutdown)
        self.stop()
        self.env['SHANGFU_OLLAMA_URL']='http://127.0.0.1:'+str(stub.server_port)
        self.env['SHANGFU_OLLAMA_MODEL']='qwen3:4b'
        self.start()
        data={'text':'面料有磨砂触感','scene':'private'}
        valid=self.ok('/v1/extract',data)
        self.assertEqual(valid['mode'],'ollama');self.assertEqual(valid['modelEvidence'][0]['quote'],data['text'])
        self.assertEqual(received[0]['model'],'qwen3:4b')
        self.assertEqual(received[0]['format']['properties']['observations']['type'],'array')
        invalid=self.ok('/v1/extract',data)
        self.assertEqual(invalid['mode'],'rules-fallback')
        self.assertEqual(invalid['inference']['reason'],'OLLAMA_NO_VALID_EVIDENCE')
        self.assertEqual(invalid['inference']['modelStatus'],'no-valid-evidence')


if __name__=='__main__':unittest.main()
