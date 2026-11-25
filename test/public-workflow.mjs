import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
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
