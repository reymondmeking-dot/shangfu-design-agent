import { orderDisposition } from './download-names.mjs';
import { createSolution, extractRequirements, makeVisualBrief, matchResources } from './engine.mjs';
import { describeDrawing, makeDrawing } from './exports.mjs';
import { makeProjectWorkbook } from './reports.mjs';

const base = '/design';
const repo = 'https://github.com/reymondmeking-dot/shangfu-design-agent';
const releaseVideo = repo + '/releases/latest/download/shangfu-design-agent-demo.mp4';
const videoPath = base + '/media/shangfu-design-agent-demo.mp4';
// Refresh these values together with the public MP4 so viewers get its new cache key.
const videoRelease = { bytes:16622531, revision:'dc4fc796bc4b' };
const videoUrl = videoPath + '?v=' + videoRelease.revision;
const csp = "default-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'none'; style-src 'self'; img-src 'self'; media-src 'self' https://github.com https://release-assets.githubusercontent.com https://objects.githubusercontent.com";
const steps = ['需求录入','需求解构','人工确认','资源匹配','方案初稿','图纸与提示词','版师复核','归档导出','复盘复用'];
const cases = {
  concierge: {
    id:'DEMO-SH-01', title:'迎宾团队职业服', scene:'group', label:'团体职业服', cover:'concierge-garment.jpg',
    finalVersion:2, text:'礼宾团队有40人，需要统一深藏蓝的职业夹克。大堂接待和门口迎宾要轮岗，搬运行李时手臂要抬得起来。希望商务利落。护理必须可机洗，后续还需补货。',
    question:'预计多长时间洗一次？哪些动作需要重点试穿？',
    nextText:'新开的会客厅有12人，需要藏蓝色礼宾夹克，接待时常抬臂取物。必须可机洗。', nextTitle:'门厅接待组夹克',
    review:'在站立迎宾和提起行李两种动作下试穿，核对袖窿及袋口受力。', reuse:'试穿时分别记录迎宾站姿和搬运行李的活动量。',
  },
  atelier: {
    id:'DEMO-SH-02', title:'会面用新中式外套', scene:'private', label:'海派高端私定', cover:'jacquard.webp',
    finalVersion:3, text:'我去出席一场正式会面，要一件宽松的新中式外套，想试交领。开襟必须无扣，布面要细暗纹。抬臂时肩背要舒展，主色先看样布。',
    changedText:'参加正式会面，需要新中式宽松外套。这次必须低立领，开襟必须无扣。希望细暗纹面料，肩背和手臂要有活动空间。主色看实物再定。',
    question:'主色需对照哪组实物色卡？领口和肩部活动量如何试穿？',
    nextText:'我要一件交领的会客外套。希望宽松，选细暗纹，前面必须无扣开襟。', nextTitle:'春季会面外套',
    nextChangedText:'我要一件低立领的会客外套。领型必须低立领，前面必须无扣开襟。希望宽松，选细暗纹。',
    review:'用样布核对暗纹尺度，试穿时检查领高、肩点和袖窿松量。', reuse:'看实物色卡后再定主色，试穿记录肩背和抬臂感受。',
  },
};
// Only these prepared, synthetic examples and presentation illustrations are public.
// Nothing in this map routes to the authenticated workspace or its source archives.
const assets = new Map([
  ['site.css','/showcase/site.css'],['video-cover.jpg','/showcase/video-cover.jpg'],['radix.css','/assets/radix.css'],
  ['jacquard.webp','/assets/swatch-jacquard.webp'],
  ['twill.webp','/assets/swatch-twill.webp'],['concierge-garment.jpg','/assets/photo-group-v1-garment.jpg'],
  ['concierge-detail.jpg','/assets/photo-group-v1-detail.jpg'],['concierge-on-body.jpg','/assets/photo-group-v1-on-body.jpg'],
]);
const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const illustration = key => base+'/assets/'+key;
const exampleUrl = (key,step,version,followup=false) => base+'/?case='+key+'&amp;step='+step+'&amp;v='+version+(followup?'&amp;followup=1':'')+'#case';
const exampleFile = (key,version,format,followup=false) => base+'/examples/'+key+'/v'+version+'.'+format+(followup?'?followup=1':'');
const sourceLabels = {customer:'客户原话',advisor:'顾问确认',agent:'方案建议',pending:'待确认'};
const typeLabels = {pattern:'版型',fabric:'面料',craft:'工艺',case:'历史参考'};
const dimensionNames = ['风格调性','廓形要求','面料质感','工艺细节','色彩体系','场景适配度'];

function setup(key, version, followup=false) {
  const initial=cases[key];
  const firstText=followup?initial.nextText:initial.text;
  const changed=key==='atelier' && version===initial.finalVersion;
  const project={...initial,id:initial.id+(followup?'B':''),title:followup?initial.nextTitle:initial.title,
    firstText,text:changed?(followup?initial.nextChangedText:initial.changedText):firstText};
  const requirements=extractRequirements(project);
  if(followup)requirements.reusedChecks=[initial.reuse];
  const match=matchResources({requirements,scene:project.scene});
  const solution=createSolution({...project,requirements,selected:match.recommended,version,placketWidth:version===1?30:35});
  solution.id=project.id+'-SOL-V'+version;
  const reqNumber=changed?2:1;
  const trace={intakeId:project.id+'-IN-'+reqNumber,requirementId:project.id+'-REQ-'+reqNumber,matchId:project.id+'-MATCH-'+reqNumber};
  return {project,requirements,match,solution,trace,followup};
}

function headings(title,description,pathname,contents) {
  const nav=[['/design','案例体验'],['/design/overview','项目简介'],['/design/video','演示视频']];
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${escape(description)}"><title>${escape(title)}｜海派定制顾问</title>
<link rel="stylesheet" href="/design/assets/radix.css"><link rel="stylesheet" href="/design/assets/site.css"></head>
<body><a class="skip" href="#main">跳到正文</a><header class="mast"><div class="shell mast-inner">
<a class="brand" href="/design" aria-label="海派定制顾问，作品首页"><strong>海派定制顾问</strong><span class="brand-caption">上海服装集团命题</span></a>
<nav aria-label="作品导航">${nav.map(([url,label])=>`<a href="${url}"${pathname===url?' aria-current="page"':''}>${label}</a>`).join('')}</nav></div></header>
<main id="main" class="shell">${contents}</main><footer><div class="shell foot"><span>海派定制顾问</span><div><a href="/design-agent">业务工作台</a><a href="${repo}">GitHub 源码</a></div></div></footer></body></html>`;
}

function figure(src,alt,caption,css='') {
  return `<figure class="${css}"><img src="${src}" alt="${escape(alt)}" loading="lazy"><figcaption>${escape(caption)}</figcaption></figure>`;
}

function chips(key,step,version,followup) {
  const choices=key==='atelier'?[[1,'交领无扣'],[3,'低立领无扣']]:[[1,'30 mm'],[2,'35 mm']];
  return `<nav class="versions" aria-label="比较订单版本">${choices.map(([v,label])=>`<a href="${exampleUrl(key,step,v,followup)}"${v===version?' aria-current="true"':''}>V${v}　${label}</a>`).join('')}</nav>${key==='atelier'?'<p class="fine">可比较 V1 初稿和 V3 领型修订稿。中间试稿 V2 略。</p>':''}`;
}

function stage(key,step,v,data) {
  const {project:p,requirements:req,solution:s,trace,followup}=data;
  const isPrivate=key==='atelier';
  const headcount=req.fields.find(field=>field.key==='headcount')?.value;
  const final=p.finalVersion;
  const downloadPath=format=>exampleFile(key,v,format,followup);
  const dimensionKeys=['style','silhouette','fabric','craft','color','scene'];
  const pairs=rows=>`<dl class="pairs">${rows.map(([a,b])=>`<div><dt>${escape(a)}</dt><dd>${escape(b)}</dd></div>`).join('')}</dl>`;
  const intro=(h,body)=>`<h3>${escape(h)}</h3><p>${escape(body)}</p>`;
  const button=(url,label,download=false)=>`<a class="button outline" href="${url}"${download?' download':''}>${label}</a>`;
  if(step===1) return `<h3>客户原话</h3><blockquote>${escape(p.text)}</blockquote>${pairs([['项目编号',p.id],['使用场景',p.label],['输入来源','模拟订单'],...(followup?[['上一单批准复用的检查项',s.reusedChecks[0]]]:[])])}`;
  if(step===2) return `<h3>六项设计参数</h3><dl class="fields">${dimensionKeys.map((key,index)=>{
    const f=req.fields.find(item=>item.key===key);
    return `<div><dt>${dimensionNames[index]}</dt><dd>${escape(f.value||'待确认')}</dd><dd class="source">${escape(sourceLabels[f.source]||'待确认')}${f.evidence?'　'+escape(f.evidence):''}</dd></div>`;
  }).join('')}</dl><p class="fine">审美标签　${escape(req.aestheticTags.join('、')||'待确认')}</p>`;
  if(step===3) return intro('顾问核对原话',isPrivate&&v===3?'客户要求改为低立领。顾问保留原记录，按新要求确认并重选版型。':'先核对客户明确提出的要求。没有说清的地方留待追问。')+
    pairs([['客户已说明',isPrivate?s.cad.collarLabel+'、无扣开襟、细暗纹':headcount+'，必须可机洗、采用藏蓝'],['还需询问',p.question],['确认记录',trace.requirementId]]);
  if(step===4) return `<h3>本版选用的资源</h3>${pairs(s.assets.map(a=>[typeLabels[a.type],a.id+'　'+a.name]))}<p class="fine">${escape(isPrivate?s.cad.collarLabel+'对应所选版型。面料选细暗纹，门襟配无扣贴边。主色待客户查看实物色卡。':'这单必须可机洗。护理卡没有注明洗法的面料留待核实。')}</p>`;
  if(step===5) return `<h3>${escape(p.title)}参考初稿</h3><p>${escape(s.summary)}</p>${pairs(s.sections.map(row=>[row.title,row.body]).concat([['可行性提示',s.checks[0]],...(followup?[['上一单的检查项',s.reusedChecks[0]]]:[])]))}`;
  if(step===6) {
    const b=makeVisualBrief(s,describeDrawing(s));
    return `<h3>款式图与 AI 绘图提示词</h3>
    <a class="drawing" href="${downloadPath('svg')}" aria-label="打开本版完整款式图"><img src="${downloadPath('svg')}" alt="本版款式技术图，含正背轮廓、六个毫米测点及 100 mm 校尺" loading="lazy"></a>
    <div class="actions">${button(downloadPath('dxf'),'下载 CAD 图（DXF）',true)}${button(downloadPath('svg'),'下载矢量图（SVG）',true)}</div>
    <div class="prompt-list">${b.prompts.map(pr=>`<details><summary>${escape(pr.title)}<small>${pr.width} × ${pr.height} px</small></summary><p>${escape(pr.text)}</p></details>`).join('')}</div>`;
  }
  if(step===7) {
    const review=isPrivate?(v===1?'V1 是交领无扣外套。客户提出改为低立领，版师请顾问重新确认领型。':'顾问确认低立领是必备条件，改用 PAT-002，沿用无扣开襟。版师已复核 V3。'):(v===1?'版师退回 V1，要求将门襟从 30 mm 加宽至 35 mm 后再交图。':'V2 门襟已改为 35 mm。版师复核通过，可交业务人员归档。');
    return intro(isPrivate?'版师复核领型变更':'版师复核门襟宽度',review)+
      pairs([[isPrivate?'本版领型':'本版测点',isPrivate?s.cad.collarLabel+'、无扣开襟':s.cad.placketWidth+' mm'],['试穿时检查',p.review]])+
      '<div class="actions">'+button(exampleUrl(key,3,isPrivate?final:v,followup),isPrivate?'回到新版需求确认':'查看已确认要求')+button(exampleUrl(key,6,final,followup),'核对 V'+final+' 图纸')+'</div>';
  }
  if(step===8) return intro('本版业务台账','五张工作表记录原话、选料、测点、修改意见和归档版本。')+
    pairs([['项目编号',p.id],['方案编号',s.id],['归档状态',v!==1?'版师复核通过，业务人员已归档':isPrivate?'领型变更已退回顾问确认':'图纸已退回，旧版存档备查']])+
    `<div class="actions">${button(downloadPath('xlsx'),'下载可编辑台账（XLSX）',true)}${button(downloadPath('json'),'下载案例参数（JSON）',true)}</div>`;
  if(v===1)return intro('查看已批准的检查项','V1 已退回。已批准的检查项保存在归档版 V'+final+' 中。')+
    '<div class="actions">'+button(exampleUrl(key,9,final,followup),'查看 V'+final+' 复用检查项 →')+'</div>';
  return intro('下一单可沿用的检查项','新单重新录入客户原话，再核对这条检查项是否适用。')+
    pairs([['顾问已批准',p.reuse],['仅随本单保存','客户原话、个人尺寸和本版选料']])+
    (followup?'':'<div class="actions">'+button(exampleUrl(key,1,1,true),'沿用检查项开新单 →')+'</div>');
}

function landing(url) {
  const key=url.searchParams.get('case')==='atelier'?'atelier':'concierge';
  const supplied=Number(url.searchParams.get('step'));
  const step=Number.isInteger(supplied)&&supplied>=1&&supplied<=9?supplied:1;
  const v=Number(url.searchParams.get('v'))===cases[key].finalVersion?cases[key].finalVersion:1;
  const followup=url.searchParams.get('followup')==='1';
  const data=setup(key,v,followup);
  const returned=step===7 && v===1;
  const nextStep=returned?(key==="atelier"?3:6):step+1;
  const nextVersion=returned?cases[key].finalVersion:v;
  const nextLabel=returned?(key==="atelier"?"回到 V3 需求确认":"转到 V2 修订图纸"):"下一步　"+steps[step];
  return headings('案例体验','查看两份模拟订单的原话、选料、图纸和台账。',base,`
<section class="hero"><div class="hero-copy"><span class="eyebrow">高级定制与团体职业服</span><h1>海派定制顾问</h1><p>选择一份订单，核对客户要求、选料依据和图纸改动，下载已归档的台账。</p><div class="actions"><a class="button solid" href="#case">查看模拟订单 <span aria-hidden="true">↓</span></a><a class="button outline" href="/design-agent">进入业务工作台</a></div></div>
<div class="hero-visual"><img src="${illustration('concierge-garment.jpg')}" alt="藏蓝礼宾夹克的正面和背面参考图" width="1500" height="1000" fetchpriority="high"><span>礼宾夹克　成衣正背面参考</span></div></section>
<section id="case" class="case-section"><div class="section-row"><div><span class="eyebrow">模拟订单</span><h2>订单办理过程</h2></div><nav class="case-picker" aria-label="选择业务案例">${Object.entries(cases).map(([k,c])=>`<a href="${exampleUrl(k,step,v===1?1:c.finalVersion)}"${key===k?' aria-current="true"':''}>${c.label}</a>`).join('')}</nav></div>
<div class="studio"><nav class="stage-nav" aria-label="九个业务节点">${steps.map((label,i)=>`<a href="${exampleUrl(key,i+1,v,followup)}"${step===i+1?' aria-current="step"':''}><span>${String(i+1).padStart(2,'0')}</span>${label}</a>`).join('')}</nav>
<article class="case-content" aria-label="${escape(data.project.title)}，${steps[step-1]}"><div class="case-meta"><span>${escape(data.project.title)}</span><span>V${v} / ${data.project.id}</span></div>
${chips(key,step,v,followup)}${stage(key,step,v,data)}<div class="pager">${step>1?`<a href="${exampleUrl(key,step-1,v,followup)}">← 上一步</a>`:'<span></span>'}${step<9?`<a href="${exampleUrl(key,nextStep,nextVersion,followup)}">${nextLabel} →</a>`:`<a href="${exampleUrl(key==='atelier'?'concierge':'atelier',1,1)}">查看另一案例 →</a>`}</div></article></div></section>`);
}

function overview() {
  const rows=[
    ['01 需求录入','FastAPI / SQLite','为原话建立项目编号并单独保存'],['02 需求解构','Ollama / Qwen3 / Pydantic','整理六项设计参数，并标出对应原话'],
    ['03 人工确认','FastAPI / SQLite','保存顾问核对过的需求'],['04 资源匹配','SQLite / Python','从四类资源中筛选符合必备条件的候选项'],
    ['05 方案初稿','Jinja2','列出场景、版型、选料和设计亮点'],['06 图纸与提示词','ezdxf / SVG / Jinja2','生成本版款式图和三组绘图提示词'],
    ['07 版师复核','FastAPI / 版本库','版师签认图纸，或退回需求、尺寸修改'],['08 归档导出','SQLite / XlsxWriter','按已复核的版本导出台账和案例包'],
    ['09 复盘复用','SQLite','向下一单带入已批准的检查项'],
  ];
  return headings('项目简介','海派定制顾问的应用场景、工作流程、技术与职责边界。',base+'/overview',`
<section class="page-head"><span class="eyebrow">项目简介</span><h1>定制订单怎样办理</h1><p>定制业务专员、职业服方案设计师和高级定制企划人员可按项目编号查看原话、选料、方案、图纸和归档版本。</p></section>
<section class="editorial"><h2>两份模拟订单</h2><div class="case-tiles"><article>${figure(illustration('jacquard.webp'),'低对比织花面料纹理','面料质感示意')}<h3>海派高端私定</h3><p>客户把交领改为低立领。对照 V1 和 V3，查看新需求如何改变版型，怎样保留无扣开襟。</p><a href="${exampleUrl('atelier',1,1)}">查看私定订单 →</a></article>
<article>${figure(illustration('concierge-detail.jpg'),'藏蓝斜纹夹克口袋细节','礼宾制服工艺参考')}<h3>团体职业服</h3><p>40 人礼宾团队需要可机洗的藏蓝夹克。查看门襟从 30 mm 改到 35 mm 后的图纸和归档记录。</p><a href="${exampleUrl('concierge',1,1)}">查看团服订单 →</a></article></div></section>
<section class="editorial"><h2>办理流程与技术组件</h2><p>需求按风格调性、廓形要求、面料质感、工艺细节、色彩体系和场景适配度整理。资源库有 31 项模拟版型、面料、工艺和历史案例。</p><div class="route-table" role="table" aria-label="指定技术栈与流程"><div class="route-row table-head" role="row"><strong role="columnheader">业务节点</strong><strong role="columnheader">技术组件</strong><strong role="columnheader">阶段输出</strong></div>${rows.map(row=>`<div class="route-row" role="row">${row.map(item=>`<span role="cell">${item}</span>`).join('')}</div>`).join('')}</div>
<p class="fine">表中列出 FastAPI 版的组件。线上业务工作台使用 Cloudflare Workers AI，项目保存在浏览器。免密案例可浏览固定模拟订单，不保存访客数据。</p></section>
<section class="editorial"><h2>订单交付物</h2>
<div class="route-table" role="table" aria-label="五类交付物">${[
 ['资产知识库','按标签、风格或场景查找版型、面料、工艺和历史案例，查看分类清单与使用规范。'],
 ['需求解构','六维参数清单和情绪审美标签报告保留原话出处。没有依据的项目留给顾问确认。'],
 ['方案初稿','初稿列出资产编号、选择理由和可行性提示，注明必须满足的条件和待试穿项目。'],
 ['视觉需求包','提供成衣正背面、工艺特写和上身场景三组提示词及图像尺寸，附同版 SVG 与毫米单位 DXF 图纸。'],
 ['业务台账','五张可编辑 XLSX 工作表汇总项目、需求、方案、资源使用和复核记录，可查旧版、退回原因与确认人。']
 ].map(([label,value])=>`<div class="route-row" role="row"><strong role="rowheader">${label}</strong><span role="cell" class="wide-cell">${value}</span></div>`).join('')}</div></section>
<section class="editorial"><h2>试点安排与风险</h2><p>先用两份模拟订单核对交付文件，由顾问、设计师和版师检查术语、搭配和图纸。进入试点前，需取得素材授权，明确资源维护和审批责任。</p><p>效果图不能确认实际尺寸和质感。更改领型、门襟或面料后须重新出图，请版师复核，再用色卡、样布和试穿确认。</p></section>
<section class="editorial boundary"><h2>Agent 能力边界清单</h2><p>Agent 整理需求、检索模拟资源、起草方案、生成绘图提示词和款式图，并汇总台账。顾问确认必备条件和选料，版师复核尺寸与图纸。定制终审、版型定稿、报价、商务洽谈、签约和生产下单由业务人员负责。</p><p>演示只使用模拟资产，不连接生产系统或真实定制业务接口。</p><div class="actions"><a class="button solid" href="/design">查看模拟订单</a><a class="button outline" href="${repo}/blob/main/docs/architecture.md">架构与接口说明</a></div></section>`);
}

function video(url) {
  const chapters = [
    {id:'intake',time:0,label:'录入酒店订单',clock:'00:00'},
    {id:'confirm',time:5.38,label:'对照客户原话',clock:'00:05'},
    {id:'assets',time:13,label:'选择可机洗面料',clock:'00:13'},
    {id:'visual',time:22.5,label:'查看成衣、袋口和上身图',clock:'00:23'},
    {id:'cad',time:28,label:'门襟从 30 改为 35 毫米',clock:'00:28'},
    {id:'archive',time:35.53,label:'复核归档并开新单',clock:'00:36'}
  ];
  const selected=chapters.find(c=>c.id===url.searchParams.get('chapter'));
  const offset=selected?'#t='+selected.time:'';
  return headings('演示视频','观看礼宾夹克从需求录入到归档复用的过程。',base+'/video',`
<section class="page-head"><span class="eyebrow">操作演示</span><h1>酒店礼宾服订单演示</h1><p>45 秒，小米 MiMo 普通话配音，中英字幕。</p></section>
<section class="film" id="player" aria-label="作品演示播放器"><video controls playsinline preload="metadata" poster="${illustration('video-cover.jpg')}" aria-label="海派定制顾问项目演示">
<source src="${videoUrl}${offset}" type="video/mp4"><source src="${releaseVideo}${offset}" type="video/mp4"><a href="${releaseVideo}">下载 MP4 演示视频</a></video>
<nav class="film-links" aria-label="视频章节">${chapters.map(c=>`<a href="/design/video?chapter=${c.id}#player"${selected===c?' aria-current="true"':''}>${c.clock}　${c.label}</a>`).join('')}</nav>
<div class="film-links"><a href="${videoUrl}" download>下载 MP4</a><a href="${releaseVideo}">GitHub 备用下载</a><a href="/design#case">查看模拟订单 →</a></div></section>`);
}

function exportExample(key,version,format,followup) {
  const currentData=setup(key,version,followup);
  const {project,requirements,solution}=currentData;
  const isPrivate=key==='atelier';
  const drawing=makeDrawing(solution);
  if(format==='svg')return new Response(drawing.svg,{headers:{'Content-Type':'image/svg+xml; charset=utf-8','Content-Disposition':orderDisposition(project,version,'svg','inline')}});
  if(format==='dxf')return new Response(drawing.dxf,{headers:{'Content-Type':'application/dxf','Content-Disposition':orderDisposition(project,version,'dxf')}});
  const stamp=(rev,minute)=>'2026-01-'+(rev===1?'12':'13')+'T09:'+String(minute).padStart(2,'0')+':00Z';
  function record(data,d) {
    const {project:p,requirements:r,solution:s,match:m,trace}=data;
    return {scene:p.scene,text:p.text,requirements:r,match:m,solution:s,drawing:d,brief:makeVisualBrief(s,d),version:s.version,trace,
      changedAt:stamp(s.version,20),reason:s.version===1?'建立模拟初稿':isPrivate?'重新确认新原话，交领改为低立领，无扣开襟沿用；中间试稿 V2 略。':'门襟宽 30 → 35 mm，按版师意见修改',actor:'模拟顾问'};
  }
  const current=record(currentData,drawing);
  let history=[];
  if(version===project.finalVersion){
    const before=setup(key,1,followup);
    history=[record(before,describeDrawing(before.solution))];
  }
  const events=[];
  for(const rev of [...history,current]){
    const fields={...rev.trace,projectId:project.id,version:rev.version,solutionId:rev.solution.id,drawingId:rev.drawing.id};
    const add=(type,minute,actor,message,extra={})=>events.push({...fields,id:rev.solution.id+'-'+type,type,changedAt:stamp(rev.version,minute),actor,message,...extra});
    if(rev.version===1 || isPrivate){
      add('extract',5,'系统',rev.version===1?'将本单原话解构为六维参数':'顾问录入新原话，重新解构低立领硬要求');
      add('match',10,'业务人员','确认需求并筛选模拟资产');
    }
    add(rev.version===1?'solution':'revision',20,'业务人员',rev.reason);
    add('visual',25,'系统','生成同版款式图及三类提示词');
    const reviewId=rev.solution.id+'-REVIEW';
    const comment=isPrivate?(rev.version===1?'客户希望把交领改为低立领，退回需求确认。':'已核对新版低立领、无扣开襟和技术图。'):(rev.version===1?'门襟从 30 mm 调整至 35 mm 后重新送审。':'已核对本版本门襟 35 mm 及技术图。');
    const decision=rev.version===1?(isPrivate?'revise-requirements':'revise-pattern'):'approved';
    add('pattern-review',30,'版师',comment,{reviewId,comment,decision});
    if(rev.version===project.finalVersion){
      add('archive',35,'业务人员','模拟归档已复核的参考稿',{reviewId});
      add('reuse',40,'业务人员','批准通用检查项：'+project.reuse);
    }
  }
  if(format==='json'){
    const example={projectId:project.id,scene:project.scene,title:project.title,source:'公开虚构案例',sourceText:project.text,
      version,trace:current.trace,requirements:requirements.fields,aestheticTags:requirements.aestheticTags,
      assets:solution.selected,solutionId:solution.id,drawing:describeDrawing(solution),prompts:current.brief.prompts,
      reusedChecks:solution.reusedChecks,history:history.map(r=>({version:r.version,sourceText:r.text,trace:r.trace,solutionId:r.solution.id})),events};
    return new Response(JSON.stringify(example,null,2),{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':orderDisposition(project,version,'json')}});
  }
  const revisions=[...history,current];
  const confirmed=revisions.filter((rev,i)=>revisions.findIndex(item=>item.trace.requirementId===rev.trace.requirementId)===i);
  const intakes=confirmed.map(rev=>({id:rev.trace.intakeId,projectId:project.id,rawText:rev.text,createdAt:stamp(rev.version,5),actor:'模拟顾问'}));
  const confirmations=confirmed.map(rev=>({id:rev.trace.requirementId,projectId:project.id,intakeId:rev.trace.intakeId,fields:rev.requirements.fields,changedAt:stamp(rev.version,10),actor:'模拟顾问'}));
  const bytes=makeProjectWorkbook({...current,id:project.id,title:project.title,currentRevision:current,history,intakes,confirmations,events,archivedVersions:version===project.finalVersion?[version]:[]});
  return new Response(bytes,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':orderDisposition(project,version,'xlsx')}});
}

function rangedFallback(upstream,request) {
  const total=Number(upstream.headers.get('content-length')) || videoRelease.bytes;
  const range=request.headers.get('range');
  if(upstream.status!==200||!range||!Number.isSafeInteger(total)||total<=0||upstream.headers.get('content-encoding'))return upstream;
  const ifRange=request.headers.get('if-range');
  if(ifRange && ifRange!==upstream.headers.get('etag') && ifRange!==upstream.headers.get('last-modified'))return upstream;
  const parsed=/^bytes=(\d*)-(\d*)$/.exec(range);
  if(!parsed || (!parsed[1]&&!parsed[2]))return upstream;
  const first=parsed[1]?Number(parsed[1]):Math.max(0,total-Number(parsed[2]));
  const last=parsed[1]&&parsed[2]?Math.min(Number(parsed[2]),total-1):total-1;
  const headers=new Headers(upstream.headers);
  if(!Number.isSafeInteger(first)||!Number.isSafeInteger(last)||first>last||first>=total){
    if(upstream.body)void upstream.body.cancel().catch(()=>{});
    headers.set('Content-Range','bytes */'+total);headers.set('Content-Length','0');
    return new Response(null,{status:416,headers});
  }
  headers.set('Content-Range',`bytes ${first}-${last}/${total}`);headers.set('Content-Length',String(last-first+1));
  if(!upstream.body)return new Response(null,{status:206,headers});
  const reader=upstream.body.getReader();
  let position=0;
  const body=new ReadableStream({
    async pull(controller){
      while(position<=last){
        const {done,value}=await reader.read();
        if(done){controller.close();return;}
        const prior=position;position+=value.byteLength;
        const from=Math.max(first-prior,0),to=Math.min(last+1-prior,value.byteLength);
        if(from<to)controller.enqueue(value.subarray(from,to));
        if(position>last){controller.close();void reader.cancel().catch(()=>{});return;}
        if(from<to)return;
      }
    },cancel(reason){return reader.cancel(reason);}
  });
  return new Response(body,{status:206,headers});
}

async function publishedAsset(request,env,path,media=false) {
  const target=new URL(request.url);target.pathname=path;target.search='';
  const pass=new Headers();
  if(media)pass.set('Accept-Encoding','identity');
  for(const name of ['if-none-match','if-modified-since',...(media?['range','if-range']:[])]){
    if(request.headers.has(name))pass.set(name,request.headers.get(name));
  }
  const asset=await env.ASSETS.fetch(new Request(target,{method:request.method,headers:pass}));
  const result=media?rangedFallback(asset,request):asset;
  const headers=new Headers(result.headers);
  if(media && result.ok){
    headers.set('Content-Type','video/mp4');
    headers.set('Accept-Ranges','bytes');
    const bytes=Number(headers.get('Content-Length')) || (result.status===200 ? videoRelease.bytes : 0);
    if(bytes && !headers.has('Content-Encoding')){
      headers.set('Content-Length',String(bytes));
      // A Worker streaming a full response must expose its length to the edge range cache.
      if(result.body && typeof FixedLengthStream!=='undefined'){
        const fixed=new FixedLengthStream(bytes);
        void result.body.pipeTo(fixed.writable).catch(()=>{});
        return new Response(fixed.readable,{status:result.status,headers});
      }
    }
  }
  return new Response(result.body,{status:result.status,headers});
}

export async function showcase(request,env) {
  const url=new URL(request.url),path=url.pathname.replace(/\/$/,'');
  if(path!==base && !path.startsWith(base+'/'))return null;
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
  let res;
  if([base,base+'/overview',base+'/video'].includes(path)){
    const html=request.method==='HEAD'?null:path===base?landing(url):path.endsWith('/overview')?overview():video(url);
    res=new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8'}});
  }else if(path===videoPath){
    res=await publishedAsset(request,env,'/design-media/shangfu-design-agent-demo.mp4',true);
    if(res.status===404)res=Response.redirect(releaseVideo,302);
  }else if(path.startsWith(base+'/assets/')&&assets.has(path.slice((base+'/assets/').length))){
    res=await publishedAsset(request,env,assets.get(path.slice((base+'/assets/').length)));
  }else{
    const file=/^\/design\/examples\/(concierge|atelier)\/v([123])\.(dxf|svg|xlsx|json)$/.exec(path);
    const allowed=file && [1,cases[file[1]].finalVersion].includes(Number(file[2]));
    res=allowed?exportExample(file[1],Number(file[2]),file[3],url.searchParams.get('followup')==='1'):new Response('Not found',{status:404});
  }
  const headers=new Headers(res.headers);
  headers.set('Content-Security-Policy',csp);headers.set('X-Content-Type-Options','nosniff');
  headers.set('Referrer-Policy','strict-origin-when-cross-origin');
  const cacheableFilm=path===videoPath && (res.ok || res.status===304);
  headers.set('Cache-Control',cacheableFilm?'public, max-age=3600, s-maxage=86400, no-transform':res.ok?'public, no-cache':'no-store');
  return new Response(request.method==='HEAD'?null:res.body,{status:res.status,headers});
}
