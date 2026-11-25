import './overview.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {unzipSync} from 'fflate';
import {handle} from '../src/worker.mjs';
import {catalog, demoCases, createSolution, extractRequirements, makeVisualBrief, matchResources} from '../src/engine.mjs';
import {makeDrawing} from '../src/exports.mjs';
import {getPhotoSet} from '../src/photos.mjs';
import {sourceContextFor} from '../src/source-cases.mjs';

const env = {ASSETS:{async fetch(request) {
  const url = new URL(request.url);
  const asset = new URL('../public' + url.pathname, import.meta.url);
  return new Response(await readFile(asset));
}}};
const expectedViews = [['garment',1500,1000],['detail',1200,1200],['on-body',1200,1500]];

for (const sample of demoCases) {
  test(sample.title, async () => {
    const requirements=extractRequirements(sample);
    const matched=matchResources({requirements,scene:sample.scene});
    assert.equal(matched.blocked,false);
    assert.equal(sourceContextFor(sample.text,sample.scene).title,sample.title);
    assert.equal(sourceContextFor(sample.text+'另选颜色。',sample.scene),null);
    assert.deepEqual(Object.keys(matched.recommended),['pattern','fabric','craft','case']);
    for (const id of Object.values(matched.recommended)) assert.ok(catalog.some(row=>row.id===id));
    const args={requirements,scene:sample.scene,selected:matched.recommended,title:sample.title};
    const solution=createSolution({...args,version:1});
    const drawing=makeDrawing(solution);
    const brief=makeVisualBrief(solution,drawing);
    assert.equal(solution.sourceText,sample.text);
    assert.equal(drawing.measurements.unit,'mm');
    assert.equal(drawing.measurements.rulerMm,100);
    assert.match(drawing.dxf,/CALIBRATION/);
    assert.match(drawing.svg,/<svg/);
    assert.deepEqual(brief.prompts.map(({key,width,height})=>[key,width,height]),expectedViews);
    assert.ok(brief.prompts.every(p=>p.dimensionReference.drawingId===drawing.id));
    const set=await getPhotoSet(solution,env,'http://localhost',sample.text);
    assert.equal(set.mode,sample.scene==='group'?'reviewed':'generate');
    if (sample.scene==='group') {
      assert.deepEqual(set.images.map(({key,width,height})=>[key,width,height]),expectedViews);
      assert.ok(set.images.every(image=>image.sha256.length===64 && image.checks.length));
    }
    const v2=createSolution({...args,version:2,placketWidth:35});
    const updated=makeDrawing(v2);
    assert.equal(updated.measurements.placketWidthMm,35);
    assert.notEqual(updated.id,drawing.id);
    const changed=await getPhotoSet(v2,env,'http://localhost',sample.text);
    assert.equal(changed.mode,'generate');
  });
}

const utf8 = new TextDecoder('utf-8', {fatal:true});
const formats = {
  xlsx:['业务台账','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  json:['案例记录','application/json'], svg:['款式图','image/svg+xml'], dxf:['款式图','application/dxf'],
};

async function caseDownload(order, version, ext) {
  const url = 'http://localhost/design/examples/'+order.key+'/v'+version+'.'+ext+(order.next?'?followup=1':'');
  const response = await handle(new Request(url),env);
  assert.equal(response.status,200,url);
  const [role,mime] = formats[ext];
  assert.equal(response.headers.get('Content-Type').split(';')[0],mime);
  const header = response.headers.get('Content-Disposition');
  assert.equal(header.match(/filename="([^"]+)"/)[1],order.id+'-V'+version+'.'+ext);
  assert.equal(decodeURIComponent(header.match(/filename\*=UTF-8''([^;]+)/i)[1]),
    order.title+'_'+order.id+'_V'+version+'_'+role+'.'+ext);
  return new Uint8Array(await response.arrayBuffer());
}

function sheetRows(zip, n) {
  const xml = utf8.decode(zip['xl/worksheets/sheet'+n+'.xml']);
  return [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(row =>
    Object.fromEntries([...row[1].matchAll(/<c r="([A-Z]+)\d+"[^>]*>([\s\S]*?)<\/c>/g)].map(cell =>
      [cell[1],cell[2].match(/<(?:t\b[^>]*|v)>([\s\S]*?)<\/(?:t|v)>/)[1]])));
}

function checkDxf(bytes, version, width) {
  const text = utf8.decode(bytes).replaceAll('\r\n','\n');
  assert.match(text,/\n9\n\$INSUNITS\n70\n4\n/);
  assert.ok(text.includes('\nV'+version+' | mm | '));
  const lines=text.trimEnd().split('\n');
  const dimensions=[];
  let current;
  for (let i=0;i<lines.length;i+=2) {
    const [code,value]=[lines[i],lines[i+1]];
    if (code==='0') {
      current=value==='DIMENSION'?new Map():null;
      if (current) dimensions.push(current);
    } else if (current) current.set(code,value);
  }
  assert.deepEqual(dimensions.map(d=>d.get('1')).sort(),['A <>','B <>','C <>','D <>','E <>','F <>']);
  const placket=dimensions.find(d=>d.get('1')==='C <>');
  assert.equal(Number(placket.get('50')),0,'placket uses a horizontal dimension');
  assert.equal(Math.abs(Number(placket.get('14'))-Number(placket.get('13'))),width);
}

test('公开订单的下载名、项目编号、版次、台账和图纸尺寸一致', async () => {
  for (const order of [
    {key:'concierge',id:'DEMO-SH-01',title:'迎宾团队职业服',scene:'group',final:2},
    {key:'atelier',id:'DEMO-SH-02',title:'会面用新中式外套',scene:'private',final:3},
    {key:'concierge',id:'DEMO-SH-01B',title:'门厅接待组夹克',scene:'group',final:2,next:true},
    {key:'atelier',id:'DEMO-SH-02B',title:'春季会面外套',scene:'private',final:3,next:true},
  ]) {
    for (const v of [1,order.final]) {
      const width=v===1?30:35;
      const [xlsx,json,svg,dxf]=await Promise.all(Object.keys(formats).map(ext=>caseDownload(order,v,ext)));
      const record=JSON.parse(utf8.decode(json));
      assert.deepEqual([record.projectId,record.title,record.version,record.scene],[order.id,order.title,v,order.scene]);
      assert.equal(record.drawing.id,'CAD-'+record.solutionId+'-V'+v);
      assert.equal(record.drawing.measurements.placketWidthMm,width);
      const drawing=utf8.decode(svg);
      assert.ok(drawing.startsWith('<svg ') && drawing.includes('技术图 V'+v+' / 毫米') && drawing.includes('>C '+width+' mm</text>'));
      checkDxf(dxf,v,width);
      const zip=unzipSync(xlsx);
      assert.deepEqual([...utf8.decode(zip['xl/workbook.xml']).matchAll(/<sheet name="([^"]+)"/g)].map(m=>m[1]),
        ['项目汇总','需求与审美','方案与资源','视觉与图纸','操作与版本']);
      const overview=Object.fromEntries(sheetRows(zip,1).map(row=>[row.A,row.B]));
      assert.deepEqual([overview['项目编号'],overview['项目名称'],Number(overview['当前版本']),overview['客户原话']],
        [order.id,order.title,v,record.sourceText]);
      const widths=sheetRows(zip,4).filter(row=>row.B==='门襟宽（mm）').map(row=>[Number(row.A),Number(row.C)]);
      assert.deepEqual(widths,v===1?[[1,30]]:[[1,30],[v,35]]);
      const archive=record.events.find(e=>e.type==='archive');
      if (v===1) assert.equal(overview['归档时间（UTC）'],undefined);
      else assert.equal(Math.round((Number(overview['归档时间（UTC）'])-25569)*86400000),Date.parse(archive.changedAt));
    }
  }
});
