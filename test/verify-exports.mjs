// The Python integration test runs this after a real HTTP review and archive.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {unzipSync,strFromU8} from 'fflate';
import {handle} from '../src/worker.mjs';

const env = {...process.env, ASSETS: {async fetch(req) {
  return new Response(await readFile(new URL('../public'+new URL(req.url).pathname,import.meta.url)));
}}};
const root='http://localhost/design-agent/api';
const snapshot=await (await handle(new Request(root+'/projects/project-a'),env)).json();
for (const kind of ['xlsx','bundle']) {
  const req=new Request(root+'/export/'+kind,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot)});
  const result=await handle(req,env);
  if (!result.ok) throw new Error(await result.text());
  assert.equal(result.headers.get('X-Agent-Backend'),'fastapi');
  const files=unzipSync(new Uint8Array(await result.arrayBuffer()));
  if (kind==='xlsx') {
    assert.ok(files['xl/workbook.xml']);
    assert.match(strFromU8(files['xl/workbook.xml']),/方案与资源/);
    continue;
  }
  for (const ext of ['.xlsx','.dxf','.svg','.csv','.md']) assert.ok(Object.keys(files).some(name=>name.endsWith(ext)));
  const dxf=Object.keys(files).find(name=>name.endsWith('.dxf'));
  assert.match(strFromU8(files[dxf]),/CALIBRATION/);
  const proposal=Object.keys(files).find(name=>name.includes('整体方案初稿'));
  assert.match(strFromU8(files[proposal]),/人工复核/);
}
