import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {strFromU8, unzipSync} from 'fflate';
import {showcase} from '../src/showcase.mjs';

test('项目简介的款式图、照片、顾问原话与复核行均来自公开案例', async()=>{
  const env={ASSETS:{async fetch(request){
    const file=new URL('../public'+new URL(request.url).pathname,import.meta.url);
    try {return new Response(await readFile(file));}
    catch(err){if(err.code==='ENOENT')return new Response(null,{status:404});throw err;}
  }}};
  const get=path=>showcase(new Request('https://demo.invalid'+path),env);
  const page=await get('/design/overview');
  assert.equal(page.status,200);
  const html=await page.text();
  const images=[...html.matchAll(/<img\b[^>]*>/g)].map(([tag])=>{
    assert.match(tag,/alt="[^"]+"/);
    return tag.match(/src="([^"]+)"/)[1];
  });
  assert.ok(images.includes('/design/examples/concierge/v2.svg'));
  for(const src of images){
    assert.match(src,/^\/design\/(assets|examples)\//);
    assert.equal((await get(src)).status,200,src);
  }
  const getData=async(key,v)=>(await get('/design/examples/'+key+'/v'+v+'.json')).json();
  for(const [key,v,quote] of [['concierge',1,'大堂接待和门口迎宾要轮岗，搬运行李时手臂要抬得起来。'],['atelier',3,'这次必须低立领，开襟必须无扣。']]){
    assert.ok((await getData(key,v)).sourceText.includes(quote));
    assert.ok(html.includes(quote));
  }
  for(const [key,versions] of [['atelier',[1,3]],['concierge',[1,2]]]){
    for(const v of versions){
      const plate='/design/assets/overview-'+key+'-v'+v+'.svg';
      assert.ok(images.includes(plate));
      const art=await (await get(plate)).text();
      const original=await (await get('/design/examples/'+key+'/v'+v+'.svg')).text();
      if(key==='concierge'){
        const m=(await getData(key,v)).drawing.measurements.placketWidthMm;
        assert.ok(art.includes('C '+m+' mm') && original.includes('C '+m+' mm'));
      }else{
        const outlines=[...art.matchAll(/<polygon[^>]* points="([^"]+)"/g)];
        assert.ok(outlines.length && outlines.every(([,points])=>original.includes('points="'+points+'"')));
      }
    }
  }
  const xlsx=await get('/design/examples/concierge/v2.xlsx');
  const sheets=unzipSync(new Uint8Array(await xlsx.arrayBuffer()));
  const operations=strFromU8(sheets['xl/worksheets/sheet5.xml']);
  const excerpt=html.match(/<tbody>([\s\S]*?)<\/tbody>/)[1];
  const notes=[...excerpt.matchAll(/<td>([^<]+)<\/td><\/tr>/g)].map(m=>m[1]);
  assert.equal(notes.length,3);
  for(const note of notes)assert.ok(operations.includes(note));
  assert.match(html,/<h2 id="ov-boundary">Agent 能力边界清单<\/h2>/);
  for(const txt of ['试点安排与风险合规','九个业务节点与技术架构','Ollama / Qwen3 / Pydantic','XlsxWriter','生产下单'])assert.ok(html.includes(txt),txt);
});
