const BASE='/design-agent', STORE='haipai-design-agent.v1';
const STEPS=[
 ['intake','需求录入','需求录入'],
 ['requirements','设计参数','确认设计参数'],
 ['match','资源匹配','资源匹配'],
 ['plan','方案初稿','参考方案'],
 ['visual','效果图与图纸','效果图与图纸'],
 ['ledger','归档与复盘','版本台账']
];
const TYPES={pattern:'版型',fabric:'面料',craft:'工艺',case:'历史案例'}, SCENES={private:'高端海派私定',group:'团体职业服'};
const CATALOG_STYLES=['新中式','商务','正式','简约','休闲','演出','传统工艺'];
const ACTOR={advisor:'定制顾问',agent:'Agent',archive:'业务人员',pattern:'版师'};
const SOURCES={customer:'客户原话',agent:'系统建议',pending:'待核实',advisor:'顾问确认'};
const LEVELS={required:'硬要求',preferred:'偏好',unspecified:'未指定'};
const SWATCHES={
 'FAB-001':{file:'swatch-jacquard.webp',label:'模拟面料',tone:'jacquard'},
 'FAB-003':{file:'swatch-twill.webp',label:'模拟面料',tone:'twill'},
 'TEC-001':{file:'stitch-detail.webp',label:'模拟工艺',tone:'stitch'}
};
const COLLAR_LABELS={cross:'交领开襟','low-stand':'低立领',stand:'立领',lapel:'西装翻驳领',round:'圆领',unknown:'待核实'};
const CARE_LABELS={machine:'可机洗',dry:'干洗',hand:'手洗',unknown:'待核实'};
const FABRIC_WEIGHTS={light:'轻薄',medium:'中等'};
const main=document.getElementById('main'), sidebar=document.getElementById('sidebar'), toast=document.getElementById('toast');
let saved;
try {saved=JSON.parse(localStorage.getItem(STORE))||{};} catch {saved={};}
const now=()=>new Date().toISOString(), uid=()=>globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2);
function newProject({title='未命名定制项目',scene='private',text='',reused=null}={}) {
 return {id:uid(),title,scene,text,reused,createdAt:now(),requirements:null,match:null,selected:{},solution:null,brief:null,drawing:null,
  currentRevision:null,history:[],events:[],caseNote:null,archivedVersions:[],stale:false,extractedText:'',extractedScene:'',status:'intake'};
}
let projects=Array.isArray(saved.projects)&&saved.projects.length?saved.projects:[newProject()];
let activeId=projects.some(p=>p.id===saved.activeId)?saved.activeId:projects[0].id;
let notes=Array.isArray(saved.notes)?saved.notes:[], page='intake', versionView=null;
let catalog=[], cases=[], catalogError='', busy=false, toastTimer, filterType='all', filterScene='', filterStyle='', query='';
let reviewedSamples={};
let remote=false, sourceIndex=[], referenceSources=[], catalogReady;
const previews=new Map(), photoSets=new Map(), deliveryMessages=new Map();
const PHOTO_VIEWS=[
 {key:'garment',title:'成衣正背面',width:1500,height:1000},
 {key:'detail',title:'工艺与材质特写',width:1200,height:1200},
 {key:'on-body',title:'上身与场景',width:1200,height:1500}
];
let photoDatabase;
function current(){return projects.find(p=>p.id===activeId)||projects[0];}
function persist(){try{localStorage.setItem(STORE,JSON.stringify({projects,activeId,notes}));}catch{notify('浏览器存储空间不足，请先导出台账。',true);}}
function notify(text,error=false){clearTimeout(toastTimer);toast.dataset.error=String(error);toast.textContent=text;toast.hidden=false;toastTimer=setTimeout(()=>{toast.hidden=true;},error?6400:3700);return toastTimer;}
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const caseTitle=title=>title;
const generatedCopy=value=>plain(value).replace(/\s+\u00b7\s+/g,'，');
const list=value=>Array.isArray(value)?value:!value?[]:typeof value==='object'?Object.values(value).flat():[value];
function plain(value){if(value==null)return '';if(Array.isArray(value))return value.map(plain).filter(Boolean).join('、');
 if(typeof value==='object')return plain(value.label??value.text??value.description??value.reason??value.value??'');return String(value);}
const evidence=value=>typeof value==='object'&&value?plain(value.quote??value.text??value):plain(value);
function time(date){try{return new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(date));}catch{return '未记录';}}
const btn=(text,action,css='button-light',attrs='')=>`<button class="button ${css}" type="button" data-action="${action}" ${attrs}>${text}</button>`;
const go=(text,step,css)=>btn(text,'step',css,`data-step="${step}"`);
const fields=p=>Array.isArray(p.requirements?.fields)?p.requirements.fields:[];
function stale(p){
 if(p.stale||p.text!==p.extractedText||p.scene!==p.extractedScene)return true;
 return Boolean(p.solution&&p.match&&Object.keys(TYPES).some(type=>{
  const choice=p.selected[type]??p.match.recommended?.[type]??'';
  return choice!==(p.solution.selected[type]||'');
 }));
}
function makeEvent(p,type,message,actor=ACTOR.advisor,version=p.solution?.version||0){
 return {type,message,actor,version,changedAt:now()};
}
function event(p,type,message,actor,version){p.events.push(makeEvent(p,type,message,actor,version));}
function revisionReview(p,rev=p.currentRevision){
 const solution=rev?.solution,drawing=rev?.drawing;
 if(!solution||!drawing)return {};
 const belongs=row=>row.projectId===p.id&&row.solutionId===solution.id&&row.drawingId===drawing.id&&row.version===solution.version;
 const index=p.events.findLastIndex(row=>row.type==='pattern-review'&&belongs(row));
 const latest=p.events[index];
 if(latest?.actor!==ACTOR.pattern||latest.decision!=='approved'||!latest.reviewId||!latest.comment?.trim()||!Number.isFinite(Date.parse(latest.changedAt)))return {latest};
 const archive=p.events.slice(index+1).findLast(row=>row.type==='archive'&&belongs(row)&&row.actor===ACTOR.archive&&row.reviewId===latest.reviewId&&Date.parse(row.changedAt)>=Date.parse(latest.changedAt));
 return {latest,approved:latest,archive};
}
function archiveLabel(p,rev){
 if(!p.archivedVersions.includes(rev?.version))return '';
 return revisionReview(p,rev).archive?'已归档':'历史归档，复核未记录';
}
function recordIntake(p,text){
 const list=p.intakes??=[];
 if(list.at(-1)?.rawText===text&&list.at(-1).scene===p.scene)return list.at(-1);
 const entry={id:'IN-'+uid(),projectId:p.id,rawText:text,scene:p.scene,createdAt:now(),actor:ACTOR.advisor};
 list.push(entry);
 p.events.push({...makeEvent(p,'intake','提交客户原话',ACTOR.advisor,0),projectId:p.id,intakeId:entry.id});
 return entry;
}
const serialize=value=>JSON.parse(JSON.stringify(value));
function highest(p){if(!p.requirements||p.text!==p.extractedText||p.scene!==p.extractedScene)return 0;
 if(!p.match)return 1;if(!p.solution||stale(p))return 2;return 5;}
function allowed(p,step){return STEPS.findIndex(s=>s[0]===step)<=highest(p)||Boolean(p.solution&&step==='ledger');}
function sidebarMarkup(p){
 const max=highest(p);
 return `<div class="sidebar-inner"><div class="project-select"><label for="project-select">当前项目</label>
 <select id="project-select">${projects.map(item=>`<option value="${e(item.id)}"${p.id===item.id?' selected':''}>${e(caseTitle(item.title))}</option>`).join('')}</select></div>
 <nav class="sidebar-nav" aria-label="流程阶段">${STEPS.map(([key,label],index)=>{
  const complete=index<max&&(index<4||p.archivedVersions.length), active=page===key, enabled=allowed(p,key);
  return `<button type="button" class="stage-link${active?' active':''}${enabled?'':' locked'}" data-action="step" data-step="${key}" ${active?'aria-current="step"':''} ${enabled?'':'disabled'}><span class="stage-circle${complete?' done':''}" aria-hidden="true">${complete?'✓':index+1}</span><span>${label}</span></button>`;
 }).join('')}</nav>
 <p class="sidebar-note">${remote?'已提交的版本保存在项目库。':'项目保存在当前浏览器。'}</p></div>`;
}
function deliverableLink(text,url,name,css='button-light') {
 const version=document.querySelector('script[src*="/assets/ui.js"]')?.src.split('?')[1] || 'v=20261125.12';
 return `<a class="button ${css}" href="${BASE}${url}?${e(version)}" download="${e(name)}">${text}</a>`;
}
function boundaryPanel(){
 return `<section class="panel boundary-panel"><h2>项目资料</h2><div class="actions"><a class="button button-light" href="https://planto-ai.com/design/overview" target="_blank" rel="noreferrer">项目简介与技术路线</a></div></section>`;
}
function render(){
 const p=current();
 document.querySelectorAll('.top-link').forEach(button=>{
  const active=button.dataset.action===(page==='catalog'?'catalog':'workspace');
  button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
 });
 sidebar.innerHTML=sidebarMarkup(p);
 if(page==='catalog'){main.innerHTML=catalogMarkup();return;}
 const [,,heading]=STEPS.find(step=>step[0]===page)||STEPS[0];
 const markup={intake:intakeMarkup,requirements:requirementsMarkup,match:matchMarkup,plan:planMarkup,visual:visualMarkup,ledger:ledgerMarkup}[page]||intakeMarkup;
 const displayedVersion=(page==='plan'||page==='visual'?viewed(p)?.version:null)??p.solution?.version;
 const status=p.solution&&page!=='ledger'?(stale(p)?'<span class="chip warn">待生成新版</span>':
  `<span class="chip"><strong>V${e(displayedVersion)}</strong> ${archiveLabel(p,displayedVersion===p.solution.version?p.currentRevision:p.history.find(item=>item.version===displayedVersion))||'参考稿'}</span>`):'';
 main.innerHTML=`<div class="page-header"><h1>${heading}</h1>${status}</div>${markup(p)}${page==='intake'?boundaryPanel():''}`;
 document.querySelectorAll('.example-thumb img').forEach(image=>{
  if(image.complete&&!image.naturalWidth)image.hidden=true;
  image.addEventListener('error',()=>{image.hidden=true;},{once:true});
 });
 if(page==='visual'){
  const rev=viewed(p);
  loadPreviews(p,rev);loadPhotos(p,rev);
 }
}
function setPage(next,preserve=false){
 const p=current();
 if(next!=='catalog'){
  if(!allowed(p,next)){notify('请先完成前面的步骤。',true);return;}
  p.status=next;
 }
 if(!preserve&&next!=='visual'&&next!=='plan')versionView=null;
 page=next;persist();render();main.focus({preventScroll:true});window.scrollTo({top:0,behavior:'auto'});
}
function hasSample(scene,version){
 if(scene!=='group'||version!==1)return false;
 const row=reviewedSamples['group-v1'];
 return PHOTO_VIEWS.every(spec=>Array.isArray(row?.[spec.key]?.checks)&&row[spec.key].checks.length&&/^[a-f0-9]{64}$/.test(row[spec.key].sha256));
}
function sampleLink(scene,version,title){
 if(!hasSample(scene,version))return '';
 return btn(title,'sample-photos','button-quiet',`data-case-scene="${scene==='group'?'group':'private'}" data-case-version="${version}"`);
}
function casePanel(){
 if(catalogError)return `<section class="panel example-panel"><div class="panel-header"><h2>模拟案例</h2></div><p class="notice error">${e(catalogError)}</p><div class="actions">${btn('重试','retry-catalog')}</div></section>`;
 return `<section class="panel example-panel"><div class="panel-header"><h2>模拟案例</h2></div>${cases.length?`<div class="example-grid">${cases.map(item=>`<div class="example-entry"><button type="button" class="example" data-action="use-case" data-id="${e(item.id)}">
   <span class="example-thumb ${item.scene==='group'?'group':''}" aria-hidden="true">${hasSample(item.scene,1)?`<img src="${samplePhotoPath(item.scene,'on-body',1)}" alt="" decoding="async">`:''}</span>
   <span><strong>${e(caseTitle(item.title))}</strong><small>载入需求</small></span><span class="example-arrow" aria-hidden="true">↗</span></button>
   <div class="actions">${sampleLink(item.scene,1,'查看礼宾款效果图')}</div></div>`).join('')}</div>`:'<p class="loading">正在加载…</p>'}</section>`;
}
function intakeMarkup(p){
 const reuse=notes.filter(note=>note.scene===p.scene).slice(-4).reverse();
 const references=(p.scene==='group'?['FAB-003']:['FAB-001','TEC-001']).map(lookup).filter(Boolean);
 return `<div class="workspace-grid"><section class="panel">
 <form class="form" data-form="extract">
 ${p.reviewReturn?.target==='requirements'?`<p class="notice warn">版师要求重新核对客户需求：${e(p.reviewReturn.comment)}。请录入客户确认的改动。</p>`:''}
 <label class="field" for="title">项目名称<input class="input" id="title" data-project-field="title" name="title" maxlength="120" value="${e(caseTitle(p.title))}" autocomplete="off" required></label>
 <fieldset class="select-scene"><legend class="field-label">使用场景</legend>${Object.entries(SCENES).map(([val,label])=>`<label class="scene-option"><input type="radio" data-project-field="scene" name="scene" value="${val}" ${p.scene===val?'checked':''}>${label}</label>`).join('')}</fieldset>
 <label class="field" for="raw-text">客户原话<textarea id="raw-text" data-project-field="text" name="text" maxlength="4200" placeholder="输入场合、款式偏好和必备条件" required>${e(p.text)}</textarea></label>
 ${p.reused?`<div class="notice"><strong>已引用 ${e(caseTitle(p.reused.title))}</strong><ul class="text-list">${p.reused.checklist.map(v=>`<li>${e(v)}</li>`).join('')}</ul></div>`:''}
 <div class="form-actions"><button type="submit" class="button button-dark">提取设计参数</button></div></form></section>
 <div class="stack side-details">${casePanel()}${reuse.length?`<section class="panel"><div class="panel-header"><h2>可复用检查项</h2></div><div class="asset-list">${reuse.map(note=>`<div class="asset-row"><strong>${e(caseTitle(note.title))}</strong><p>${e(note.checklist.join('、'))}</p><div>${btn('带入当前项目','use-note','button-light',`data-id="${e(note.id)}"`)}</div></div>`).join('')}</div></section>`:
 referenceBoard(references,'场景样卡',true)}</div></div>`;
}
function requirementsMarkup(p){
 const req=p.requirements, tags=list(req?.aestheticTags), questions=list(req?.questions);
 const visualEvidence=list(req?.aestheticEvidence).filter(item=>typeof item?.quote==='string'&&item.quote&&plain(p.extractedText).includes(item.quote));
 if(!req)return '<p class="notice">请先录入客户原话。</p>';
 const fromModel=/ollama|llm|model|ai/i.test(req.mode||'')&&!/fallback|manual/i.test(req.mode||'');
 return `<div class="workspace-grid"><section class="panel"><div class="panel-header"><span class="chip">${fromModel?'模型提取':'规则提取'}</span></div>
 <form class="form" data-form="confirm"><div class="analysis-grid">${fields(p).map((field,index)=>`<article class="dimension">
 <div class="dimension-top"><label for="dimension-${index}">${e(field.label||field.key)}</label><span class="chip ${field.source==='pending'?'warn':''}" data-source-label="${index}">${e(SOURCES[field.source]||'待核实')}</span></div>
 <input class="input" id="dimension-${index}" type="text" data-field-index="${index}" data-field-property="value" maxlength="240" value="${e(plain(field.value))}" placeholder="未指定">
 <select data-field-index="${index}" data-field-property="level" aria-label="${e(field.label||field.key)}约束等级">${Object.entries(LEVELS).map(([val,label])=>`<option value="${val}"${(field.level||'unspecified')===val?' selected':''}>${label}</option>`).join('')}</select>
 ${evidence(field.evidence)?`<p class="evidence">原话“${e(evidence(field.evidence))}”</p>`:''}</article>`).join('')}</div>
 <div class="form-actions">${go('返回录入','intake','button-quiet')}<button type="submit" class="button button-dark">确认参数并匹配</button></div></form></section>
 <div class="stack side-details"><section class="panel"><div class="panel-header"><h2>客户原话</h2></div><p class="source-text">${e(p.extractedText||p.text)}</p></section>
 ${req.modelEvidence?.length?`<details class="panel fold"><summary>模型摘录（${req.modelEvidence.length}）</summary>${factList(req.modelEvidence.map(item=>[fields(p).find(f=>f.key===item.key)?.label||item.key,item.quote]),'atelier-asset-facts')}</details>`:''}
 ${tags.length||questions.length?`<section class="panel stack">${tags.length?`<div><h2>审美标签</h2><div class="chip-row">${tags.map(tag=>`<span class="chip">${e(generatedCopy(tag))}</span>`).join('')}</div>
 ${visualEvidence.length?`<details class="fold"><summary>对应原话</summary>${factList(visualEvidence.map(({tag,quote})=>[tag,quote]),'atelier-asset-facts')}</details>`:''}</div>`:''}
 ${questions.length?`<div><h2>待确认项</h2><ul class="text-list">${questions.map(q=>`<li>${e(generatedCopy(q))}</li>`).join('')}</ul></div>`:''}</section>`:''}</div></div>`;
}
const assetId=entry=>String(entry?.id||entry?.assetId||'');
const lookup=id=>catalog.find(item=>item.id===id);
const assetType=entry=>entry?.type||lookup(assetId(entry))?.type;
const assets=rows=>list(rows).filter(Boolean).map(item=>typeof item==='string'?lookup(item)||{id:item,name:item}:item);
function sampleSwatch(item,showName=false){
 const id=assetId(item), sample=Object.hasOwn(SWATCHES,id)?SWATCHES[id]:null;
 if(!sample)return '';
 return `<figure class="atelier-swatch" data-swatch-id="${e(id)}">
 <div class="atelier-swatch-image ${sample.tone}"><img src="${BASE}/assets/${sample.file}" alt="" loading="lazy" decoding="async"></div>
 <figcaption>${showName?`<strong>${e(item.name||item.title||id)}</strong>`:''}<span>${sample.label}</span>${showName?`<small>${e(id)}</small>`:''}</figcaption>
 </figure>`;
}
function referenceBoard(items,title,showCatalog=false){
 const swatches=assets(items).map(item=>sampleSwatch(item,true)).filter(Boolean);
 if(!swatches.length)return '';
 return `<section class="panel atelier-sample-board"><div class="panel-header"><h2>${title}</h2>
 ${showCatalog?btn('查资产库','catalog','button-quiet'):''}</div>
 <div class="atelier-sample-grid">${swatches.join('')}</div></section>`;
}
function factList(facts,style){
 const present=facts.filter(([,value])=>value!==null&&value!==undefined&&value!=='');
 if(!present.length)return '';
 return `<dl class="${style}">${present.map(([label,value])=>`<div><dt>${e(label)}</dt><dd>${e(value)}</dd></div>`).join('')}</dl>`;
}
function catalogFacts(item){
 if(item.type==='fabric')return factList([['模拟护理',CARE_LABELS[item.care]],['布重类型',FABRIC_WEIGHTS[item.weightClass]]],'atelier-asset-facts');
 if(item.type==='pattern')return factList([['领型',COLLAR_LABELS[item.collar]],['抬臂活动',item.mobility===true?'有活动结构':item.mobility===false?'受限':item.mobility===null?'待核实':null]],'atelier-asset-facts');
 if(item.type==='craft') {
  const collars=list(item.collars).map(value=>COLLAR_LABELS[value]).filter(Boolean).join('、');
  const weights=list(item.weightClasses).map(value=>FABRIC_WEIGHTS[value]).filter(Boolean).join('、');
  return factList([['适用领型',collars],['适用布重',weights]],'atelier-asset-facts');
 }
 return '';
}
function assetRows(rows){return assets(rows).map(item=>`<article class="asset-row"><div><strong>${e(item.name||item.title||assetId(item))}</strong><small>${e(assetId(item))} ${e(TYPES[assetType(item)]||'')}</small></div>
 <p>${e(generatedCopy(item.reason||item.description||item.limits))}</p></article>`).join('');}
function matchMarkup(p){
 const m=p.match;if(!m)return '<p class="notice">请先确认设计参数。</p>';
 const ranked=assets(m.eligible), excluded=assets(m.rejected), pending=assets(m.needsReview);
 return `<div class="workspace-grid"><section class="panel"><div class="panel-header"><h2>${m.blocked?'候选组合':'推荐组合'}</h2></div>
 ${m.blocked?`<p class="notice warn">${e(generatedCopy(m.reason)||'缺少符合硬要求的资产。请返回核对参数。')}</p>`:''}
 <form class="form" data-form="solution"><div class="asset-select-grid">${Object.entries(TYPES).map(([type,label])=>{
  const candidates=ranked.filter(item=>assetType(item)===type);
  const recommended=m.recommended?.[type], choice=(p.selected[type]??(typeof recommended==='object'?assetId(recommended):recommended))||'';
  const pick=candidates.find(item=>assetId(item)===choice);
  return `<label class="asset-picker"><span class="field-label">${label}</span>
   <select name="${type}" data-asset="${type}" aria-label="${label}"><option value="">${type==='case'?'可选参考':candidates.length?'请选择':'暂无候选'}</option>
   ${candidates.map(item=>`<option value="${e(assetId(item))}"${assetId(item)===choice?' selected':''}>${e(item.name||assetId(item))}</option>`).join('')}</select>
   <span class="asset-selection" data-asset-cue="${type}">${e(generatedCopy(pick?.reason))}</span></label>`;
 }).join('')}</div><div class="form-actions">${go(m.blocked?'返回需求参数核对':'修改参数','requirements',m.blocked?'button-dark':'button-quiet')}<button type="submit" class="button ${m.blocked?'button-light':'button-dark'}" ${m.blocked?'disabled':''}>生成参考方案</button></div></form></section>
 <section class="panel stack side-details"><h2>筛选结果</h2>
 ${[[m.blocked?'通过单项筛选':'符合条件',ranked],['待核实',pending],['已排除',excluded]].map(([label,items])=>`<details class="fold"><summary>${label}（${items.length}）</summary><div class="asset-list">${assetRows(items)||'<p class="empty">无记录</p>'}</div></details>`).join('')}</section></div>`;
}
function viewed(p){return (versionView!==null&&versionView!==p.solution?.version?p.history.find(item=>item.version===versionView):null)||p.currentRevision;}
function versions(p){
 const rows=p.history.concat(p.currentRevision?[p.currentRevision]:[]);
 return `<div class="version-viewers" aria-label="历史版本">${rows.map(item=>`<button type="button" class="button ${(versionView??p.solution.version)===item.version?'button-dark':'button-light'} version-button" data-action="view-version" data-version="${e(item.version)}">V${e(item.version)}</button>`).join('')}</div>`;
}
function planMarkup(p){
 const solution=viewed(p)?.solution;if(!solution)return '<p class="notice">请先完成匹配并生成参考方案。</p>';
 const checks=list(solution.checks).map(plain).filter(Boolean);
 return `<div class="workspace-grid"><section class="panel stack"><div class="version-ribbon"><h2>${e(caseTitle(solution.title||p.title))}</h2>${versions(p)}</div>
 <div class="plan-content">${list(solution.sections).map(section=>`<div class="plan-section"><h3>${e(section.title||section.label||'方案说明')}</h3><p>${e(generatedCopy(section.body||section.text||section))}</p></div>`).join('')}</div>
 <p class="help">终审、报价、签约和下单由业务人员负责。</p><div class="actions">${go('查看效果图与图纸','visual','button-dark')}${go('补充客户原话','intake','button-quiet')}</div></section>
 <div class="stack side-details">${referenceBoard(solution.assets||Object.values(solution.selected||{}),'方案用料与工艺')}<section class="panel"><div class="panel-header"><h2>引用资产</h2></div><div class="asset-list">${assetRows(solution.assets||Object.values(solution.selected||{}))}</div></section>
 ${checks.length?`<section class="panel"><div class="panel-header"><h2>交接前待核实</h2></div><ul class="text-list">${checks.map(v=>`<li>${e(generatedCopy(v))}</li>`).join('')}</ul></section>`:''}</div></div>`;
}
function widthOf(rev){const value=rev?.solution?.cad?.placketWidth;return value!==undefined&&value!==null&&Number.isFinite(Number(value))?Number(value):null;}
function drawingMarkup(drawing){
 if(typeof drawing?.svg!=='string'||!drawing.svg)return '<p class="notice warn">当前版暂无技术图预览。</p>';
 const tokens={
  '#25394b':'--sand-12','#485f71':'--teal-12','#6a7888':'--sand-11','#006b64':'--teal-11','#435969':'--sand-11',
  '#fcfdfb':'--sand-1','#dce5e4':'--sand-6','#f0f6f5':'--teal-2','#d6e6e2':'--teal-6','#b1c9c1':'--teal-8',
 };
 const palette=getComputedStyle(document.documentElement);
 const preview=drawing.svg.replace(/\s+\u00b7\s+/g,' / ').replace(/\b(fill|stroke)="(#[\da-f]{6})"/gi,(attribute,property,color)=>{
  const token=tokens[color.toLowerCase()];
  const value=token&&palette.getPropertyValue(token).trim();
  return value?`${property}="${value}"`:attribute;
 });
 return `<img class="drawing-image" alt="款式正背平面图与结构标注" src="data:image/svg+xml;charset=utf-8,${e(encodeURIComponent(preview))}">`;
}
function technicalSheet(rev){
 const drawing=rev.drawing, measures=drawing?.measurements, cad=rev.solution.cad;
 if(!measures)return drawingMarkup(drawing);
 const mm=value=>Number.isFinite(value)?Number(value.toFixed(2))+' mm':null;
 const ruler=mm(measures.rulerMm);
 return `<figure class="atelier-technical-sheet">
 <div class="atelier-sheet-heading"><strong>正背款式及结构标注</strong></div>
 ${drawingMarkup(drawing)}
 <figcaption><div class="atelier-sheet-edition"><span>版型 <strong>${e(cad?.patternId||rev.solution.selected?.pattern||'待核实')}</strong></span>
 ${cad?.templateVersion?`<span>基版版本 <strong>${e(cad.templateVersion)}</strong></span>`:''}</div>
 ${factList([['领型',measures.collar||cad?.collarLabel],['领宽',mm(measures.collarWidthMm)],['肩点落差',mm(measures.shoulderDropMm)],['肩点距前中线',mm(measures.shoulderOffsetMm)],['衣长',mm(measures.bodyLengthMm)],['肩宽',mm(measures.shoulderWidthMm)],['袖长',mm(measures.sleeveLengthMm)],['门襟结构',measures.placketStructure]],'atelier-drawing-facts')}
 ${measures.collarWidthDatum||measures.shoulderDropDatum?`<details class="atelier-layer-key"><summary>测量基准</summary>${factList([['领宽',measures.collarWidthDatum],['肩点落差',measures.shoulderDropDatum],['扣合方式',measures.placketClosure]],'atelier-asset-facts')}</details>`:''}
 ${ruler?`<p class="atelier-sheet-tip">导入 DXF 后用 ${e(ruler)} 校尺核对比例。</p>`:''}</figcaption>
 </figure>
 ${drawing.dxf?`<details class="atelier-layer-key"><summary>查看 DXF 图层</summary><dl>
 <div><dt>OUTLINE</dt><dd>外轮廓</dd></div><div><dt>STRUCTURE</dt><dd>结构线</dd></div><div><dt>CRAFT</dt><dd>工艺线</dd></div>
 <div><dt>DIMENSIONS</dt><dd>尺寸标注</dd></div><div><dt>CALIBRATION</dt><dd>校尺</dd></div><div><dt>NOTES</dt><dd>图面说明</dd></div>
 </dl></details>`:''}`;
}
function samplePhotoPath(scene,key,version){return BASE+'/assets/photo-group-v1-'+key+'.jpg';}
function photoSource(image){return image.url||'data:image/jpeg;base64,'+image.data;}
function photoDb(){
 if(!photoDatabase)photoDatabase=new Promise((resolve,reject)=>{
  if(!window.indexedDB){reject(new Error('浏览器未开放图片存储。'));return;}
  const open=window.indexedDB.open('haipai-design-agent.photos',1);
  open.onupgradeneeded=()=>open.result.createObjectStore('versions');
  open.onsuccess=()=>resolve(open.result);
  open.onerror=()=>reject(open.error);
 });
 return photoDatabase;
}
async function savedPhotos(id,images){
 const db=await photoDb(),writing=images!==undefined;
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('versions',writing?'readwrite':'readonly'),store=tx.objectStore('versions');
  const op=writing?store.put(images,id):store.get(id);
  tx.oncomplete=()=>resolve(writing?undefined:op.result);
  tx.onabort=tx.onerror=()=>reject(tx.error||new Error('浏览器图片存储失败。'));
 });
}
async function keepPhotos(id,entry){
 try{await savedPhotos(id,entry.images);entry.storageWarning='';}
 catch{entry.storageWarning='图片仅在本次打开期间可用，请及时下载案例输出包。';}
}
function visualUrl(p){return '/projects/'+encodeURIComponent(p.id);}
async function recordedVisualEvent(p,entry){
 const {type,solutionId,version,photoKey,imageReceipt,checks,feedback,action}=entry;
 const result=await request(visualUrl(p)+'/visual-events',{eventId:uid(),type,solutionId,version,photoKey,imageReceipt:imageReceipt||null,
  ...(checks?{checks}:{}),...(feedback?{feedback}:{}),...(action?{action}:{})});
 return result.event;
}
async function cloudImages(p,id){
 const result=await request(visualUrl(p)+'/visual-images/'+encodeURIComponent(id));
 if(result.solutionId!==id||!Array.isArray(result.images))throw new Error('无法核对项目库中的图片版本。');
 const seen=new Set(p.events.map(entry=>entry.eventId).filter(Boolean));
 for(const entry of result.events||[])if(entry.solutionId===id&&entry.eventId&&!seen.has(entry.eventId)){p.events.push(entry);seen.add(entry.eventId);}
 persist();
 return result.images;
}
function checkedPhoto(image,spec,reviewed){
 if(!image||image.key!==spec.key||image.width!==spec.width||image.height!==spec.height)return false;
 return reviewed?image.reviewStatus==='reviewed'&&/^\/design-agent\/assets\/photo-group-v1-(garment|detail|on-body)\.jpg$/.test(image.url)&&image.url.endsWith('-'+spec.key+'.jpg'):
  image.mime==='image/jpeg'&&typeof image.data==='string'&&image.data.startsWith('/9j/')&&Boolean(image.receipt);
}
function lastPhotoFeedback(p,rev,image){
 return p.events.findLast(item=>item.type==='photo-feedback'&&item.solutionId===rev.solution.id&&item.photoKey===image.key&&item.imageReceipt===(image.receipt||null));
}
function reviewItems(rev,key){
 const prompt=rev.brief?.prompts?.find(item=>item.key===key);
 return list(prompt?.checks).map(plain).filter(Boolean);
}
function cardPhoto(p,rev,image,entry){
 const feedback=lastPhotoFeedback(p,rev,image),reviewed=entry.mode==='reviewed',spec=PHOTO_VIEWS.find(item=>item.key===image.key);
 const attrs='data-photo="'+e(image.key)+'"',checks=reviewed&&Array.isArray(image.checks)?image.checks.map(plain).filter(Boolean):reviewItems(rev,image.key);
 const status=feedback?'待调整':reviewed?'设计核对通过':image.approved?'顾问已核对':'待顾问核对';
 const pending=!reviewed&&!image.approved&&!feedback;
 const mayRedraw=p.solution.id===rev.solution.id&&!stale(p)&&!entry.generating&&!entry.redrawPending;
 const editNote=image.editMethod==='local-placket-edit'?'按同款图局部调整，毫米数以图纸为准。':image.editMethod==='unchanged-detail-reference'?'沿用同款袋口特写，本次门襟不在画面内。':'';
 return '<figure class="photo-card" data-photo-key="'+e(image.key)+'"><button class="photo-open" type="button" data-action="open-photo" '+attrs+' aria-label="放大查看'+e(spec.title)+'"><img width="'+image.width+'" height="'+image.height+'" src="'+e(photoSource(image))+'" alt="'+e(caseTitle(rev.solution.title))+' V'+rev.version+' '+e(spec.title)+'"></button>'+
  '<figcaption><div class="photo-caption"><h3>'+e(spec.title)+'</h3><span class="chip'+(pending||feedback?' warn':'')+'">'+status+'</span></div><p class="help">'+image.width+' × '+image.height+' px</p>'+
  (editNote?'<p class="help">'+editNote+'</p>':'')+(feedback?'<p class="notice warn">反馈：'+e(feedback.feedback)+'</p>':'')+
  (checks.length?'<details class="photo-checks"><summary>核对要点</summary><ul class="text-list">'+checks.map(check=>'<li>'+e(check)+'</li>').join('')+'</ul></details>':'')+
  '<div class="actions">'+btn('下载 JPG','download-photo','button-quiet',attrs)+
  (pending?btn('逐项核对','approve-photo','button-light',attrs):'')+
  (mayRedraw?btn(feedback?'按意见重出':'退回重出','redo-photo','button-quiet',attrs):'')+
  (!feedback?btn('反馈并改款','feedback-photo','button-quiet',attrs):'')+'</div></figcaption></figure>';
}
function photoPanel(p,rev){
 const entry=photoSets.get(rev.solution.id),mode=entry?.mode||'loading',images=entry?.images||[];
 let body='';
 if(mode==='reviewed'||mode==='generate'){
  const parameters=rev.brief?.parameters,color=parameters?.color;
  const shade=color?.value?(color.status==='pending'?color.value+'（示意色，待确认）':color.value):rev.solution.color;
  const facts=[parameters?.collar,parameters?.assets?.fabric?.name,parameters?.assets?.craft?.name,shade].filter(Boolean);
  body='<p class="help">'+e(facts.join(' / '))+'</p>';
  if(images.length)body+='<div class="photo-grid">'+images.map(image=>cardPhoto(p,rev,image,entry)).join('')+'</div>';
  if(entry.generating)body+='<p class="help" role="status">正在生成'+e(PHOTO_VIEWS.find(spec=>spec.key===entry.generating)?.title)+'…</p>';
  else if(mode==='generate'&&images.length<3)body+='<div class="actions">'+btn(images.length?'继续出图':'生成三张效果图','generate-photos','button-dark')+'</div>';
  if(entry.storageWarning)body+='<p class="notice warn">'+e(entry.storageWarning)+'</p>';
 }
 if(mode==='loading')body='<p class="help" role="status">正在读取本版效果图…</p>';
 if(entry?.error)body+='<p class="notice warn" role="status">'+e(entry.error)+'</p>'+(mode==='error'?btn('重新读取','retry-photos'):'');
 return '<section class="panel stack photo-panel" id="visual-photos" data-mode="'+e(mode)+'"><div class="version-ribbon"><h2>AI 写实效果图</h2>'+versions(p)+'</div>'+body+'</section>';
}
function refreshPhotos(p,rev){
 if(page!=='visual'||current()!==p||viewed(p)?.solution?.id!==rev.solution.id)return;
 const panel=document.getElementById('visual-photos');
 if(panel)panel.outerHTML=photoPanel(p,rev);
}
async function loadPhotos(p,rev){
 const id=rev?.solution?.id;
 if(!id||photoSets.has(id))return;
 const entry={mode:'loading',images:[]};photoSets.set(id,entry);
 try{
  const result=await request('/visual/photos',{solution:rev.solution,sourceText:rev.text,forceGenerate:rev.photoMode==='redraw'});
  if(result.solutionId!==id||result.version!==rev.version||!['reviewed','generate'].includes(result.mode))throw new Error('效果图与当前方案版本不符，请重新读取。');
  if(result.mode==='reviewed'){
   if(remote&&p.serverRevision)await cloudImages(p,id);
   const sorted=PHOTO_VIEWS.map(spec=>result.images?.find(image=>image.key===spec.key));
   const album='group-v1';
   if(!sorted.every((image,i)=>checkedPhoto(image,PHOTO_VIEWS[i],true)&&image.url===BASE+'/assets/photo-'+album+'-'+image.key+'.jpg'))throw new Error('案例图像信息不完整，请重新读取。');
   entry.images=sorted;
   if(!p.events.some(item=>item.type==='visual-photo'&&item.solutionId===id)){
    p.events.push({...makeEvent(p,'visual-photo','读取 V'+rev.version+' 三张经设计核对的 AI 写实效果图',ACTOR.agent,rev.version),solutionId:id});persist();
   }
  }else{
   let existing=[];
   if(remote&&p.serverRevision)existing=await cloudImages(p,id);
   else try{existing=await savedPhotos(id)||[];}catch{entry.storageWarning='此浏览器可能无法长期保存新图，完成后请下载。';}
   entry.images=PHOTO_VIEWS.flatMap(spec=>existing.filter(image=>checkedPhoto(image,spec,false)).slice(0,1));
  }
  entry.mode=result.mode;
 }catch(error){entry.mode='error';entry.error=error.message||'读取效果图失败。';}
 refreshPhotos(p,rev);
}
async function generatePhotos(p,rev,redrawKey=''){
 const id=rev?.solution.id,entry=photoSets.get(id);
 if(entry?.mode!=='generate'||entry.generating)return;
 entry.error='';entry.controller=new AbortController();
 try{
  for(const spec of PHOTO_VIEWS){
   const previous=entry.images.find(image=>image.key===spec.key);
   if(spec.key!==redrawKey&&(previous||redrawKey&&spec.key!=='garment'))continue;
   const mother=entry.images.find(image=>image.key==='garment');
   if(spec.key!=='garment'&&(!mother||lastPhotoFeedback(p,rev,mother)))throw new Error('请先完成被退回的成衣正背面重出，再生成同款细节和上身图。');
   entry.generating=spec.key;refreshPhotos(p,rev);
   const reference=spec.key!=='garment'&&mother?{key:mother.key,data:mother.data,receipt:mother.receipt}:undefined;
   const feedback=rev.photoCorrections?.[spec.key]||'';
   const result=await request('/visual/photo',{solution:rev.solution,key:spec.key,sourceText:rev.text,reference,feedback},false,entry.controller.signal);
   if(entry.controller.signal.aborted)return;
   if(result.solutionId!==id||result.version!==rev.version||!checkedPhoto(result.image,spec,false))throw new Error('服务返回的效果图版本、格式或像素尺寸不符。');
   if(lastPhotoFeedback(p,rev,result.image))throw new Error('返回的是已退回的原图，请再次重出。');
   if(remote&&p.serverRevision)await request(visualUrl(p)+'/visual-images',{solutionId:id,version:rev.version,solution:rev.solution,image:result.image});
   if(spec.key==='garment'&&previous)entry.images=[];
   entry.images=PHOTO_VIEWS.map(view=>view.key===spec.key?{...result.image,approved:false}:entry.images.find(image=>image.key===view.key)).filter(Boolean);
   deliveryMessages.delete(id);
   if(!remote)await keepPhotos(id,entry);
   p.events.push({...makeEvent(p,'visual-photo','生成 V'+rev.version+' '+spec.title+'，待顾问核对',ACTOR.agent,rev.version),solutionId:id,photoKey:spec.key});persist();
  }
 }catch(error){if(!entry.controller.signal.aborted)entry.error=error.message||'出图失败，已完成的图片仍可使用。';}
 finally{entry.generating='';entry.controller=null;refreshPhotos(p,rev);}
}
async function redrawPhoto(p,rev,image,feedback){
 const entry=photoSets.get(rev.solution.id),key=image.key,title=PHOTO_VIEWS.find(spec=>spec.key===key).title;
 if(entry.generating||p.solution.id!==rev.solution.id||stale(p))return;
 const change={...makeEvent(p,'photo-feedback','顾问退回 V'+rev.version+' '+title+'：'+feedback,ACTOR.advisor,rev.version),
  solutionId:rev.solution.id,photoKey:key,imageReceipt:image.receipt||null,feedback,action:'redraw'};
 p.events.push(remote&&p.serverRevision?await recordedVisualEvent(p,change):change);
 persist();refreshPhotos(p,rev);
 if(p.archivedVersions.includes(rev.version)||revisionReview(p,rev).approved||entry.mode==='reviewed'){
  const reason='按原方案重出'+title+'。'+feedback;
  await run(async()=>{await createVersion(p,{requirements:rev.requirements,scene:rev.scene,selected:rev.solution.selected,version:rev.version+1,
   placketWidth:widthOf(rev),title:rev.solution.title},reason,{type:'revision',actor:ACTOR.advisor});
  const next=p.currentRevision;next.photoMode='redraw';next.photoCorrections={...rev.photoCorrections,[key]:feedback};
  photoSets.set(next.solution.id,{mode:'generate',images:[]});
  event(p,'photo-redraw','沿用 V'+rev.version+' 需求和资源，重新生成 '+title,ACTOR.advisor,next.version);
  setPage('visual');void generatePhotos(p,next,key);},'正在建立视觉修订版…');return;
 }
 rev.photoCorrections={...rev.photoCorrections,[key]:feedback};
 if(key==='garment'&&entry.images.length>1){
  entry.images=entry.images.filter(item=>item.key==='garment');
  event(p,'photo-invalidated','成衣正背面已退回，撤下基于原图生成的特写与上身图',ACTOR.agent,rev.version);
  await keepPhotos(rev.solution.id,entry);
 }
 persist();await generatePhotos(p,rev,key);
}
async function downloadPhoto(p,rev,image){
 let blob;
 if(image.data)blob=new Blob([Uint8Array.from(atob(image.data),ch=>ch.charCodeAt(0))],{type:'image/jpeg'});
 else{
  const response=await fetch(image.url);
  if(!response.ok||(response.headers.get('content-type')||'').split(';')[0]!=='image/jpeg')throw new Error('下载失败，请重新登录工作台后重试。');
  blob=await response.blob();
 }
 const buffer=await blob.arrayBuffer(),bytes=new Uint8Array(buffer);
 if(bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw new Error('图像文件格式不符，请重新读取。');
 if(image.sha256&&crypto.subtle){
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',buffer));
  const hex=Array.from(digest,value=>value.toString(16).padStart(2,'0')).join('');
  if(hex!==image.sha256)throw new Error('图片与该版核对记录不符，请重新读取。');
 }
 saveFile(blob,safeName(p.title)+'-V'+rev.version+'-'+image.key+'.jpg');
 event(p,'download-photo','下载 V'+rev.version+' '+image.title+' 写实效果图',ACTOR.advisor,rev.version);persist();
}
function showPhotoDialog(title,content){
 const dialog=document.createElement('dialog');
 dialog.className='photo-dialog';dialog.setAttribute('aria-label',title);
 dialog.innerHTML='<div class="photo-dialog-head"><h2>'+e(title)+'</h2>'+btn('关闭','close-photo','button-light')+'</div>'+content;
 document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
 return dialog;
}
function closePhotoDialog(dialog){if(typeof dialog?.close==='function')dialog.close();else dialog?.remove();}
function previewPanel(rev){
 const entry=previews.get(rev.solution.id);
 const heading=`<div class="panel-header"><h2>款式结构示意</h2><span class="chip">V${e(rev.version)}</span></div>`;
 let content=rev.drawing?.measurements?.sleeveLengthDatum?'<p class="help" role="status">正在生成同版示意…</p>':'<p class="help">此版本保留原始图纸。补标生成新版后可查看效果示意。</p>';
 if(entry?.error)content=`<p class="notice warn">${e(entry.error)}</p><div class="actions">${btn('重试','retry-preview')}</div>`;
 if(entry?.images)content=`<div class="preview-grid">${entry.images.map(image=>`<figure class="preview-item">
 <img alt="${e(image.alt)}" width="${e(image.width)}" height="${e(image.height)}" src="data:image/svg+xml;charset=utf-8,${e(encodeURIComponent(image.svg))}">
 <figcaption><strong>${e(image.title)}</strong><span class="help">${e(image.width)} × ${e(image.height)} px</span>${btn('下载 SVG','download-preview','button-quiet',`data-preview="${e(image.key)}" aria-label="下载${e(image.title)} SVG"`)}</figcaption></figure>`).join('')}</div>`;
 return `<section class="panel stack" id="visual-previews">${heading}${content}</section>`;
}
function refreshPreviews(p,rev){
 if(page==='visual'&&current()===p&&viewed(p)?.solution?.id===rev.solution.id){
  const panel=document.getElementById('visual-previews');
  if(panel)panel.outerHTML=previewPanel(rev);
 }
}
async function loadPreviews(p,rev){
 const id=rev?.solution?.id;
 if(!id||!rev.drawing?.measurements?.sleeveLengthDatum||previews.has(id))return;
 if(previews.size>=18)previews.delete(previews.keys().next().value);
 previews.set(id,{});
 try{
  const result=await request('/visual/previews',{solution:rev.solution});
  if(result.solutionId!==id||result.version!==rev.version||result.images?.length!==3)throw new Error('效果示意的版本校验失败。');
  previews.set(id,result);
  if(!p.events.some(item=>item.type==='visual-preview'&&item.version===rev.version)){
   event(p,'visual-preview','生成 V'+rev.version+' 三张参数效果示意',ACTOR.agent,rev.version);persist();
  }
 }catch(error){previews.set(id,{error:error.message||'效果示意生成失败。'});}
 refreshPreviews(p,rev);
}
function visualMarkup(p){
 const rev=viewed(p);if(!rev?.solution)return '<p class="notice">请先生成参考方案。</p>';
 const {drawing,brief}=rev, prompts=list(brief?.prompts), previous=p.history.filter(v=>v.version<rev.version).at(-1);
 const width=widthOf(rev)??30, oldWidth=widthOf(previous);
 const compare=oldWidth!==null&&oldWidth!==width?`<div class="compare"><div><span class="help">V${e(previous.version)} 门襟宽</span><strong>${e(oldWidth)} mm</strong></div>
 <div><span class="help">V${e(rev.version)} 门襟宽</span><strong>${e(width)} mm</strong></div></div>`:'';
 return `${photoPanel(p,rev)}<div class="workspace-grid"><div class="stack"><section class="panel stack">
 <div class="panel-header"><h2>款式平面图</h2></div>${technicalSheet(rev)}
 <div class="measurements"><span class="chip">门襟 ${e(width)} mm</span><span class="chip warn">模拟技术图</span></div>${compare}
 <div class="actions">${drawing?.dxf?btn('下载 DXF','download-dxf'):''}${drawing?.svg?btn('下载 SVG','download-svg'):''}${rev.version===p.solution.version&&!stale(p)&&!drawing?.measurements?.sleeveLengthDatum?btn('补标生成新版','complete-drawing'):''}${go('查看台账','ledger','button-quiet')}</div></section>${previewPanel(rev)}
 ${rev.version===p.solution.version&&!stale(p)?`<section class="panel"><div class="panel-header"><h2>图纸参数修订</h2></div>${p.reviewReturn?.target==='pattern'?`<p class="notice warn">版师修改意见：${e(p.reviewReturn.comment)}</p>`:''}<form class="form" data-form="revise">
 <div class="field-row"><label class="field" for="placket">门襟宽（mm）<input class="input" name="width" id="placket" type="number" min="20" max="50" step="0.1" value="${e(width)}" required></label>
 <label class="field" for="reason">修改原因<input class="input" name="reason" id="reason" maxlength="200" required></label></div>
 <div class="form-actions"><button type="submit" class="button button-dark">保存为 V${e(rev.version+1)}</button></div></form></section>`:''}</div>
 <div class="stack"><section class="panel stack"><h2>视觉提示词</h2>
 ${prompts.length?prompts.map((item,index)=>`<div class="prompt-card"><h3>${e(generatedCopy(item.title||item.name||'视觉参考'))}</h3>${item.ratio?`<span class="help">${e(item.ratio)}　${e(item.width)} × ${e(item.height)} px</span>`:''}<p>${e(generatedCopy(item.text||item.prompt))}</p>${btn('复制提示词','copy-prompt','button-light',`data-index="${index}"`)}</div>`).join(''):'<p class="help">暂无提示词。</p>'}</section>${referenceBoard(rev.solution.assets||Object.values(rev.solution.selected||{}),'方案用料与工艺')}</div></div>`;
}
function deliveryStatus(p){
 const rev=p.currentRevision,entry=photoSets.get(rev.solution.id),lastError=deliveryMessages.get(rev.solution.id);
 if(lastError)return {message:lastError,needsReview:true};
 if(!entry?.images||!['reviewed','generate'].includes(entry.mode))return {message:'',needsReview:false};
 const rejected=entry.images.filter(image=>lastPhotoFeedback(p,rev,image)).length;
 if(rejected)return {message:rejected+' 张效果图有待处理的退回意见。',needsReview:true};
 if(entry.mode==='reviewed'&&entry.images.length===3)return {message:'三张案例效果图已通过设计核对。',needsReview:false};
 const approved=entry.images.filter(image=>image.approved).length;
 if(approved===3&&!entry.generating)return {message:'三张生成效果图已通过顾问核对。',needsReview:false};
 return {message:'本版已出图 '+entry.images.length+'/3，顾问核对 '+approved+'/3。',needsReview:true};
}
function patternReviewMarkup(p,review){
 const rev=p.currentRevision,trace=rev.trace||{};
 const refs=[['项目编号',p.id],['原话编号',trace.intakeId],['需求确认编号',trace.requirementId],['匹配编号',trace.matchId],['方案编号',rev.solution.id],['图纸编号',rev.drawing?.id]];
 const reference=`<details class="fold"><summary>查看本版编号和客户原话</summary><dl>${refs.map(([label,id])=>`<dt>${label}</dt><dd>${e(id||'历史未记录')}</dd>`).join('')}</dl><p>${e(rev.text||rev.solution.sourceText||'历史未记录')}</p></details>`;
 const latest=review.latest;
 const last=latest?`<p class="help">${e(latest.actor)}　${e(time(latest.changedAt))}　${e(latest.comment)}</p>`:'';
 if(review.archive||review.approved)return `<section class="panel stack"><h2>版师复核已通过</h2>${last}${reference}</section>`;
 if(stale(p))return '';
 if(p.reviewReturn?.target==='pattern')return `<section class="panel stack"><h2>待修订图纸</h2>${last}${go('修改图纸参数','visual','button-dark')}${reference}</section>`;
 return `<section class="panel stack"><h2>版师复核</h2>${reference}${last}
 <form class="form" data-form="pattern-review" data-solution="${e(rev.solution.id)}" data-drawing="${e(rev.drawing?.id)}">
 <label class="field">复核结果<select name="decision"><option value="approved">通过本版参考方案及图纸</option><option value="revise-requirements">退回核对客户需求</option><option value="revise-pattern">退回修订图纸参数</option></select></label>
 <label class="field">版师意见<textarea name="comment" rows="2" maxlength="400" required></textarea></label>
 <div class="actions">${go('查看本版图纸','visual','button-quiet')}<button type="submit" class="button button-dark">记录版师复核</button></div></form></section>`;
}
function ledgerMarkup(p){
 if(!p.solution||!p.currentRevision)return '<p class="notice">生成第一版方案后即可查看台账。</p>';
 if(remote&&!p.serverRevision&&!p.remoteOnly)return `<section class="panel stack"><h2>浏览器历史项目</h2><p>可下载浏览器保存的工作包，或沿用原话在项目库建单。</p><div class="actions">${btn('沿用原话建单','rebuild-cloud','button-dark')}${!stale(p)?btn('下载原工作包','export-bundle')+btn('导出原台账','export-xlsx'):''}</div></section>`;
 const all=[...p.history,p.currentRevision],review=revisionReview(p),approved=Boolean(review.archive&&p.archivedVersions.includes(p.solution.version));
 const delivery=deliveryStatus(p);
 const baseline=p.scene==='group'?'核对可机洗证据\n上身核验抬臂活动与衣袖松量\n同岗位补货前核对批次色差':'核对肩背松量\n试穿检查抬臂活动';
 return `<div class="workspace-grid"><div class="stack"><section class="panel stack"><div class="panel-header"><h2>${e(caseTitle(p.title))}</h2><span class="chip">V${e(p.solution.version)} ${approved?'已归档':'待归档'}</span></div>
 ${stale(p)?'<p class="notice warn">需求或资源已修改。请生成新版再归档。</p>':`<div class="actions">${approved?btn('下载核对版交付包','export-delivery','button-dark'):review.approved?btn('确认归档当前版','archive','button-dark'):''}${btn('导出台账（XLSX）','export-xlsx')}${btn('下载内部工作包','export-bundle')}</div>
 ${!approved&&p.archivedVersions.includes(p.solution.version)?'<p class="notice warn">此版有历史归档标记，需补全版师复核并重新确认归档。</p>':''}
 ${approved&&delivery.message?`<div id="delivery-status" role="status"><p class="help">${e(delivery.message)}</p>${delivery.needsReview?go('查看本版效果图','visual','button-quiet'):''}</div>`:''}`}</section>${patternReviewMarkup(p,review)}
 <section class="panel"><div class="panel-header"><h2>方案版本记录</h2></div>${[...all].reverse().map(item=>`<article class="timeline-row"><div class="timeline-head"><strong>V${e(item.version)} ${archiveLabel(p,item)}</strong><time class="help" datetime="${e(item.changedAt)}">${e(time(item.changedAt))}</time></div>
 <p>${e(item.reason||'初始生成')}</p>${widthOf(item)!==null?`<p>门襟宽 ${e(widthOf(item))} mm</p>`:''}<div>${btn('查看图纸','inspect-version','button-quiet',`data-version="${e(item.version)}"`)}</div></article>`).join('')}</section>
 <section class="panel"><details class="fold"><summary>操作记录（${p.events.length}）</summary><div class="asset-list">${[...p.events].reverse().map(item=>`<div class="timeline-row"><div class="timeline-head"><p>${e(plain(item.message).replace(legacyCaseTitle,privateCaseTitle))}</p><span class="help">${item.actor?`${e(item.actor)}　`:''}<time datetime="${e(item.changedAt)}">${e(time(item.changedAt))}</time></span></div></div>`).join('')}</div></details></section></div>
 <section class="panel"><div class="panel-header"><h2>复盘检查项</h2></div>
 ${p.caseNote?.version===p.solution.version?`<div class="stack"><span class="chip">V${e(p.caseNote.version)} 已批准复用</span><ul class="text-list">${p.caseNote.checklist.map(item=>`<li>${e(item)}</li>`).join('')}</ul><div>${btn('沿用检查项新建项目','reuse-next','button-dark',`data-id="${e(p.caseNote.id)}"`)}</div></div>`:
 !approved||stale(p)?'<p class="help">确认归档后可编辑。</p>':`<form class="form" data-form="case-note"><label class="field" for="checklist">检查事项<textarea id="checklist" name="checklist" rows="4" maxlength="600" required>${e(baseline)}</textarea><small>每行一项</small></label><button type="submit" class="button button-dark">批准复用检查项</button></form>`}</section></div>`;
}
function catalogResults(){
 const keywords=query.trim().toLocaleLowerCase('zh-CN').split(/\s+/u).filter(Boolean);
 const hits=catalog.filter(item=>{
  if((filterType!=='all'&&item.type!==filterType)||(filterScene&&!list(item.scenes).includes(filterScene))||(filterStyle&&!list(item.tags).includes(filterStyle)))return false;
  const sceneTerms=list(item.scenes).flatMap(scene=>scene==='private'?[SCENES.private,'海派高端私定','海派高级定制']:[SCENES[scene]]);
  const terms=[item.id,item.name,plain(item.description),plain(item.limits),...list(item.tags),...sceneTerms];
  const searchable=terms.join(' ').toLocaleLowerCase('zh-CN');
  return keywords.every(keyword=>searchable.includes(keyword));
 });
 return `<p class="help" aria-live="polite">共 ${hits.length} 项模拟资产</p><div class="catalog-grid">${hits.map(item=>`<article class="panel catalog-card">
  <div class="catalog-meta"><span>${e(TYPES[item.type]||item.type)}</span><span>${e(item.id)}</span></div><h2>${e(item.name||item.title)}</h2>${sampleSwatch(item)}<p>${e(plain(item.description))}</p>
  ${catalogFacts(item)}
  <div class="chip-row">${list(item.tags).slice(0,5).map(tag=>`<span class="chip">${e(generatedCopy(tag))}</span>`).join('')}</div>
  ${item.limits?`<p class="limits">${e(plain(item.limits))}</p>`:''}</article>`).join('')}</div>${!hits.length?'<p class="empty">没有找到符合条件的资源。</p>':''}${catalogReferences(keywords)}`;
}
function catalogReferences(keywords){
 const matches=row=>keywords.every(word=>JSON.stringify(row).toLowerCase().includes(word));
 const sources=sourceIndex.filter(matches),knowledge=referenceSources.filter(matches);
 return `<div class="stack">${sources.length?`<details class="panel fold"><summary>模拟案例索引（${sources.length}）</summary>${sources.map(row=>`<article class="asset-row"><strong>${e(row.title)}</strong><small>${e(row.id)}　${e(row.pages)}</small><p>${e(row.adaptation)}</p><p>${e(plain(row.design))}</p></article>`).join('')}</details>`:''}
 ${knowledge.length?`<details class="panel fold"><summary>专业参考依据（${knowledge.length}）</summary>${knowledge.map(row=>`<article class="asset-row"><strong>${e(row.title)}</strong><p>${e(row.guidance)}</p><p>${e(row.scope)}</p>${/^https:\/\//.test(row.sourceUrl)?`<a rel="noreferrer" target="_blank" href="${e(row.sourceUrl)}">${e(row.sourceTitle)}</a>`:''}</article>`).join('')}</details>`:''}</div>`;
}
function catalogMarkup(){return `<div class="page-header"><h1>定制资产库</h1><div class="actions">${deliverableLink('下载分类清单','/api/catalog.csv','模拟资产分类清单.csv')}</div></div>
 <div class="catalog-tools"><div class="catalog-filters" aria-label="资产类别">${[['all','全部'],...Object.entries(TYPES)].map(([type,label])=>btn(label,'filter-catalog',filterType===type?'button-dark':'button-light',`data-type="${type}" aria-pressed="${filterType===type}"`)).join('')}</div>
 <div class="catalog-fields"><label class="field" for="search-catalog">搜索资源<input id="search-catalog" class="input" data-search="catalog" type="search" value="${e(query)}" placeholder="名称、编号、标签或场景"></label>
 <label class="field" for="catalog-scene">适用场景<select id="catalog-scene"><option value="">全部场景</option>${Object.entries(SCENES).map(([key,label])=>`<option value="${key}"${filterScene===key?' selected':''}>${label}</option>`).join('')}</select></label>
 <label class="field" for="catalog-style">风格标签<select id="catalog-style"><option value="">全部风格</option>${CATALOG_STYLES.map(style=>`<option value="${style}"${filterStyle===style?' selected':''}>${style}</option>`).join('')}</select></label></div></div>
 <div id="catalog-results">${catalogError?`<p class="notice error">${e(catalogError)}</p>${btn('重试','retry-catalog')}`:catalogResults()}</div>`;}
async function request(path,payload,binary=false,signal){
 const type=path==='/export/bundle'||path==='/export/delivery'?'application/zip':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
 const headers={accept:binary?type:'application/json'};
 if(payload!==undefined)headers['content-type']='application/json';
 const response=await fetch(BASE+'/api'+path,payload===undefined?{headers,signal}:{method:'POST',headers,body:JSON.stringify(payload),signal});
 if(!response.ok){
  let problem={};
  try {problem=await response.json();} catch {}
  const pending=problem.code==='DELIVERY_PHOTOS_REQUIRED'&&Array.isArray(problem.pending)?PHOTO_VIEWS.filter(image=>problem.pending.includes(image.key)).map(image=>image.title):[];
  const message=pending.length?'请先处理'+pending.join('、')+'的缺图、待核或退回记录。':plain(problem.error);
  throw Object.assign(new Error(message||'服务暂不可用，请稍后重试。'),{status:response.status,code:problem.code});
 }
 return binary?response.blob():response.json();
}
async function loadCatalog(){
 try{
  const [result,reviewed]=await Promise.all([request('/catalog'),fetch(BASE+'/assets/photo-reviews.json',{cache:'no-cache'}).then(response=>response.ok?response.json():{}).catch(()=>({}))]);
  reviewedSamples=reviewed||{};
  catalog=Array.isArray(result.catalog)?result.catalog:[];cases=Array.isArray(result.cases)?result.cases:[];
  catalogError='';
  sourceIndex=result.sourceCases||[];referenceSources=result.knowledgeSources||[];
  remote=result.backend==='fastapi'||result.backend?.name==='fastapi'||result.storage==='sqlite';
  if(remote)await loadRemoteList();
 }catch{catalogError='模拟资产加载失败。';}
 render();
}
async function loadRemoteList(){
 const [index,approved]=await Promise.all([request('/projects'),request('/notes')]);
 for(const item of index.projects){
  const local=projects.find(row=>row.id===item.id);
  if(!local)projects.push({...newProject(item),id:item.id,remoteOnly:true,serverRevision:item.revision});
  else if((local.serverRevision??0)<item.revision)local.remoteOnly=true;
 }
 for(const item of approved.notes){if(!notes.some(n=>n.id===item.id))notes.push(item);}
 if(current().remoteOnly)await loadRemoteProject(current());
 persist();
}
async function loadRemoteProject(p){
 const s=await request('/projects/'+encodeURIComponent(p.id));
 const phase=s.phase,map={intake:'intake',extracted:'requirements',blocked:'match',matched:'match',generated:'plan',approved:'ledger',archived:'ledger','revise-pattern':'visual','revise-requirements':'intake'};
 const review=s.events.findLast(row=>row.type==='pattern-review');
 const extra=p.events.filter(row=>['photo-feedback','approve-photo','visual-photo','photo-redraw','photo-invalidated','export-delivery','export-xlsx','export-bundle','copy-prompt','download-dxf','download-svg','download-preview'].includes(row.type));
 Object.assign(p,s,{remoteOnly:false,serverRevision:s.revision,selected:s.solution?.selected||{},
  extractedText:phase==='revise-requirements'?'':s.text,extractedScene:s.scene,status:map[phase]||'intake',
  stale:Boolean(s.solution&&['extracted','matched','blocked','revise-requirements'].includes(phase)),
  reviewReturn:phase==='revise-pattern'||phase==='revise-requirements'?{target:phase==='revise-pattern'?'pattern':'requirements',comment:review?.comment,reviewId:review?.reviewId,previousText:s.text}:null,
  events:[...s.events,...extra.filter(row=>!s.events.some(evt=>evt.type===row.type&&evt.changedAt===row.changedAt))]});
 return p;
}
async function stageRequest(p,path,data){
 if(catalogReady)await catalogReady;
 if(catalogError)throw new Error('请先重新载入工作台服务。');
 if(!remote)return request(path,data);
 const semantic={...data};delete semantic.requirementId;delete semantic.matchId;delete semantic.reviewId;delete semantic.noteId;
 const fingerprint=JSON.stringify([path,p.serverRevision??0,semantic]);
 if(p.lastAttempt?.fingerprint!==fingerprint){
  p.lastAttempt={fingerprint,payload:{...data,projectId:p.id,expectedRevision:p.serverRevision??0,requestId:uid()}};persist();
 }
 let result;
 try{result=await request(path,p.lastAttempt.payload);}
 catch(error){
  if(error.status===409&&error.code==='REVISION_CONFLICT'){
   await loadRemoteProject(p);delete p.lastAttempt;persist();setPage(allowed(p,p.status)?p.status:'intake');
   throw new Error('已载入其他操作保存的新版，请核对后继续。');
  }
  throw error;
 }
 if(!result.workflow||result.workflow.projectId!==p.id)throw new Error('服务未确认项目编号，请刷新工作台。');
 delete p.lastAttempt;p.serverRevision=result.workflow.revision;return result;
}
function pending(p){p.match=null;p.selected={};p.stale=Boolean(p.solution);}
function appendProject(p){projects.push(p);activeId=p.id;versionView=null;setPage('intake');}
function reqPayload(p){return p.reused?.checklist?.length?{...p.requirements,reusedChecks:[...p.reused.checklist]}:p.requirements;}
async function run(work,message){
 if(busy)return;
 busy=true;
 const controls=[...document.querySelectorAll('button, select, input, textarea')].map(item=>[item,item.disabled]);
 controls.forEach(([item])=>{item.disabled=true;});
 document.getElementById('shell').setAttribute('aria-busy','true');const loading=notify(message);
 try{await work();}catch(error){notify(error.message||'操作未完成，请重试。',true);}
 finally{
  if(toastTimer===loading){clearTimeout(loading);toast.hidden=true;}
  busy=false;controls.forEach(([item,wasDisabled])=>{item.disabled=wasDisabled;});document.getElementById('shell').removeAttribute('aria-busy');
 }
}
function saveFile(blob,filename){
 const element=document.createElement('a'), url=URL.createObjectURL(blob);
 element.href=url;element.download=filename;document.body.append(element);element.click();element.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const safeName=name=>String(name||'海派定制').replace(/[<>:"/\\|?*\u0000-\u001f]+/g,'-').slice(0,48);
async function createVersion(p,settings,reason,{type='solution',actor=ACTOR.advisor}={}){
 const result=await stageRequest(p,'/solution',remote?{...settings,matchId:p.matchId,reason,actor}:settings);
 if(!result?.solution||!result?.brief||!result?.drawing)throw new Error('服务未返回完整的方案、图纸和提示词。');
 if(p.reviewReturn?.target==='pattern'&&p.solution&&
   ['pattern','fabric','craft'].every(key=>p.solution.selected[key]===result.solution.selected[key])&&
   JSON.stringify(p.solution.cad)===JSON.stringify(result.solution.cad))throw new Error('图纸参数与退回版相同，请先根据版师意见修订。');
 if(p.currentRevision)p.history.push(p.currentRevision);
 p.solution=result.solution;p.brief=result.brief;p.drawing=result.drawing;p.stale=false;p.reviewReturn=null;
 const trace=result.trace||{projectId:p.id,intakeId:p.intakeId??null,requirementId:p.requirementId??null,matchId:p.matchId??null,solutionId:p.solution.id,drawingId:p.drawing.id};
 p.currentRevision=serialize({version:p.solution.version,reason,changedAt:result.changedAt||now(),actor,solution:p.solution,
  requirements:reqPayload(p),match:p.match,brief:p.brief,drawing:p.drawing,text:p.text,scene:p.scene,trace});
 p.events.push({...makeEvent(p,type,reason,actor),...trace});
 p.events.push({...makeEvent(p,'visual','生成 V'+p.solution.version+' 模拟技术图与三类视觉提示词',ACTOR.agent),...trace});versionView=null;persist();
}
function exportSnapshot(p,exportEvent){
 return {id:p.id,title:p.title,scene:p.scene,text:p.text,createdAt:p.createdAt,intakes:p.intakes||[],confirmations:p.confirmations||[],matchRuns:p.matchRuns||[],requirements:reqPayload(p),match:p.match,
  solution:p.solution,brief:p.brief,drawing:p.drawing,history:[...p.history],events:exportEvent?[...p.events,exportEvent]:p.events,
  caseNote:p.caseNote,archivedVersions:p.archivedVersions,currentRevision:p.currentRevision};
}
async function exportPhotoRecords(p,delivery=false){
 const rev=p.currentRevision,id=rev.solution.id,entry=photoSets.get(id);
 if(delivery&&entry?.generating)throw Object.assign(new Error('本版正在出图，请完成三张图的核对后再下载交付包。'),{code:'DELIVERY_PHOTOS_PENDING'});
 if(remote&&p.serverRevision){
  const images=await cloudImages(p,id);
  return images.map(image=>({key:image.key,data:image.data,receipt:image.receipt,approved:Boolean(image.approved&&!lastPhotoFeedback(p,rev,image)),rejected:Boolean(lastPhotoFeedback(p,rev,image))}));
 }
 if(entry?.mode==='reviewed')return [];
 let images=entry?.mode==='generate'?entry.images:null;
 if(!images){
  try{images=await savedPhotos(id)||[];}catch{images=[];}
 }
 return images.map(image=>({key:image.key,data:image.data,receipt:image.receipt,approved:Boolean(image.approved&&!lastPhotoFeedback(p,rev,image)),rejected:Boolean(lastPhotoFeedback(p,rev,image))}));
}
function updateField(p,input,property){
 const field=fields(p)[Number(input.dataset.fieldIndex)];
 if(!field)return;
 field[property]=input.value;field.source='advisor';
 const label=document.querySelector('[data-source-label="'+input.dataset.fieldIndex+'"]');
 if(label){label.textContent='顾问确认';label.classList.remove('warn');}
 pending(p);persist();
}
document.addEventListener('input',eventObject=>{
 if(busy)return;
 const input=eventObject.target,p=current();
 if(input.dataset.projectField&&input.type!=='radio'){p[input.dataset.projectField]=input.value;persist();}
 if(input.dataset.search==='catalog'){query=input.value;const results=document.getElementById('catalog-results');if(results)results.innerHTML=catalogResults();}
 if(input.dataset.fieldIndex!==undefined&&input.dataset.fieldProperty==='value')updateField(p,input,'value');
});
document.addEventListener('change',eventObject=>{
 if(busy)return;
 const input=eventObject.target,p=current();
 if(input.id==='catalog-scene'||input.id==='catalog-style'){
  if(input.id==='catalog-scene')filterScene=input.value;
  else filterStyle=input.value;
  document.getElementById('catalog-results').innerHTML=catalogResults();return;
 }
 if(input.id==='project-select'){
  activeId=input.value;versionView=null;
  if(remote&&current().remoteOnly)return run(async()=>{const project=await loadRemoteProject(current());setPage(allowed(project,project.status)?project.status:'intake');},'正在读取项目…');
  const project=current(),last=project.status||'intake';
  return setPage(allowed(project,last)?last:'intake');
 }
 if(input.dataset.projectField==='scene'){
  p.scene=input.value;
  if(p.reused?.scene!==p.scene)p.reused=null;
  persist();render();document.querySelector('input[name="scene"]:checked')?.focus();
 }
 if(input.dataset.fieldIndex!==undefined&&input.dataset.fieldProperty==='level')updateField(p,input,'level');
 if(input.dataset.asset){
  p.selected[input.dataset.asset]=input.value;
  persist();render();document.querySelector('[data-asset="'+input.dataset.asset+'"]')?.focus();
 }
});
document.addEventListener('submit',eventObject=>{
 const form=eventObject.target,kind=form.dataset.form;
 if(!kind)return;
 eventObject.preventDefault();
 if(busy)return;
 const p=current(),data=new FormData(form);
 if(kind==='pattern-review'){
  const rev=p.currentRevision,solution=rev?.solution,drawing=rev?.drawing;
  if(!solution||!drawing||stale(p)||p.reviewReturn?.target==='pattern'||revisionReview(p).archive||solution.id!==form.dataset.solution||drawing.id!==form.dataset.drawing)return notify('请复核当前方案和图纸。',true);
  const comment=String(data.get('comment')||'').trim(),decision=String(data.get('decision')||'');
  const labels={approved:'通过', 'revise-requirements':'退回需求核对','revise-pattern':'退回图纸参数修订'};
  if(!comment||comment.length>400||!Object.hasOwn(labels,decision))return notify('请填写 400 字以内的版师意见并选择复核结果。',true);
  const review={...makeEvent(p,'pattern-review','版师复核 V'+solution.version+'，'+labels[decision]+'：'+comment,ACTOR.pattern,solution.version),
   ...(rev.trace||{}),projectId:p.id,solutionId:solution.id,drawingId:drawing.id,reviewId:'REV-'+uid(),decision,comment};
  const applyReview=review=>{
  p.events.push(review);
  if(decision==='revise-requirements'){
   p.reviewReturn={target:'requirements',comment,reviewId:review.reviewId,previousText:rev.text??solution.sourceText};
   pending(p);p.extractedText='';setPage('intake');document.getElementById('raw-text')?.focus();return;
  }
  if(decision==='revise-pattern'){
   p.reviewReturn={target:'pattern',comment,reviewId:review.reviewId};
   versionView=null;setPage('visual');document.getElementById('placket')?.focus();return;
  }
  persist();render();document.querySelector('[data-action=archive]')?.focus();
  };
  if(remote)return run(async()=>{const saved=await stageRequest(p,'/projects/'+encodeURIComponent(p.id)+'/review',{solutionId:solution.id,drawingId:drawing.id,version:solution.version,decision,comment,reviewId:review.reviewId});applyReview(saved.event);},'正在保存版师复核…');
  return applyReview(review);
 }
 if(kind==='photo-feedback'||kind==='photo-approval'||kind==='photo-redraw'){
  const rev=viewed(p),entry=photoSets.get(rev?.solution?.id),key=form.dataset.key;
  const image=entry?.images?.find(item=>item.key===key);
  if(!image||form.dataset.solution!==rev.solution.id||(image.receipt||'')!==form.dataset.receipt||kind!=='photo-redraw'&&lastPhotoFeedback(p,rev,image))return notify('当前图片状态已变化，请重新打开。',true);
  const label=PHOTO_VIEWS.find(item=>item.key===key).title;
  if(kind==='photo-redraw'){
   const feedback=String(data.get('feedback')||'').trim();
   if(!feedback||feedback.length>400)return notify('请填写 400 字以内的画面修正意见。',true);
   if(entry.generating||entry.redrawPending)return;
   closePhotoDialog(form.closest('dialog'));entry.redrawPending=true;
   return redrawPhoto(p,rev,image,feedback).catch(error=>notify(error.message||'重出失败，请重试。',true)).finally(()=>{entry.redrawPending=false;refreshPhotos(p,rev);});
  }else if(kind==='photo-feedback'){
   const feedback=String(data.get('feedback')||'').trim();
   if(!feedback)return notify('请输入具体修改意见。',true);
   const updated=p.text+'\n客户反馈：'+feedback;
   if(updated.length>4200)return notify('补充后超过 4200 字，请精简意见或先整理客户原话。',true);
   const change={...makeEvent(p,'photo-feedback','V'+rev.version+' '+label+' 需调整：'+feedback,ACTOR.advisor,rev.version),solutionId:rev.solution.id,photoKey:key,feedback,imageReceipt:image.receipt||null};
   const apply=recorded=>{p.events.push(recorded);
   entry.controller?.abort();
   p.text=updated;pending(p);closePhotoDialog(form.closest('dialog'));setPage('intake');
   document.getElementById('raw-text')?.focus();notify('意见已写入需求，可重新提取参数。');
   };
   if(remote&&p.serverRevision)return run(async()=>apply(await recordedVisualEvent(p,change)),'正在保存客户意见…');
   apply(change);
  }else{
   const checks=reviewItems(rev,key),values=data.getAll('check');
   if(!checks.length||values.length!==checks.length||!checks.every((_,i)=>values.includes(String(i))))return notify('请逐项核对图像后再保存。',true);
   return run(async()=>{
    const approval={...makeEvent(p,'approve-photo','顾问核对 V'+rev.version+' '+label+'：'+checks.join('；'),ACTOR.advisor,rev.version),solutionId:rev.solution.id,photoKey:key,imageReceipt:image.receipt,checks};
    p.events.push(remote&&p.serverRevision?await recordedVisualEvent(p,approval):approval);
    image.approved=true;deliveryMessages.delete(rev.solution.id);if(!remote)await keepPhotos(rev.solution.id,entry);
    persist();closePhotoDialog(form.closest('dialog'));refreshPhotos(p,rev);notify('本图的顾问核对记录已保存。');
   },'正在保存核对记录…');
  }
  return;
 }
 if(kind==='extract'){
  const text=String(data.get('text')||''),title=String(data.get('title')||'').trim();
  if(!title||!text.trim())return notify('请填项目名称和客户原话。',true);
  if(p.reviewReturn?.target==='requirements'&&text.trim()===p.reviewReturn.previousText?.trim())return notify('请先录入客户确认的改动，再重新提取。',true);
  return run(async()=>{
   const intake=recordIntake(p,text);persist();
   if(catalogReady)await catalogReady;
   const payload=remote?{text,scene:p.scene,title,intakeId:intake.id,reuseNoteId:p.reused?.id??null}:{text,scene:p.scene};
   const result=await stageRequest(p,'/extract',payload);
   p.intakeId=result.workflow?.intakeId??intake.id;p.requirementId=null;p.matchId=null;
   p.text=text;p.title=title;p.requirements=result;p.extractedText=text;p.extractedScene=p.scene;pending(p);
   p.events.push({...makeEvent(p,'extract','生成需求解构草稿',ACTOR.agent,0),projectId:p.id,intakeId:intake.id});setPage('requirements');
   },'正在提取设计参数…');
 }
 if(kind==='confirm'){
  if(!p.requirements||p.text!==p.extractedText||p.scene!==p.extractedScene)return notify('请先重新提取当前客户原话。',true);
  if(fields(p).some(field=>field.level==='required'&&!plain(field.value).trim()))return notify('硬要求须填写明确的参数。也可将等级调整为未指定。',true);
  return run(async()=>{
   const rid='REQ-'+uid(),mid='MAT-'+uid();
   const result=await stageRequest(p,'/match',{requirements:reqPayload(p),scene:p.scene,...(remote?{intakeId:p.intakeId,requirementId:rid,matchId:mid}:{})});
   p.requirementId=result.workflow?.requirementId??rid;p.matchId=result.workflow?.matchId??mid;
   const trace={projectId:p.id,intakeId:p.intakeId??null,requirementId:p.requirementId,matchId:p.matchId};
   (p.confirmations??=[]).push({id:p.requirementId,projectId:p.id,intakeId:trace.intakeId,changedAt:now(),actor:ACTOR.advisor,fields:serialize(fields(p))});
   (p.matchRuns??=[]).push({id:p.matchId,projectId:p.id,requirementId:p.requirementId,changedAt:now(),blocked:Boolean(result.blocked),reason:result.reason||'',recommended:result.recommended,eligibleIds:assets(result.eligible).map(assetId)});
   p.events.push({...makeEvent(p,'confirm','顾问确认设计参数',ACTOR.advisor,0),...trace});
   p.events.push({...makeEvent(p,'match',result.blocked?'无合格组合，返回需求核对':'匹配模拟资产',ACTOR.agent,0),...trace});
   p.match=result;p.selected={};setPage('match');
   },'正在匹配资产…');
 }
 if(kind==='solution'){
  if(!p.match||p.text!==p.extractedText||p.scene!==p.extractedScene)return notify('请先完成当前需求的解构、确认和匹配。',true);
  const selected=Object.fromEntries(Object.keys(TYPES).map(type=>[type,String(data.get(type)||'')]));
  if(['pattern','fabric','craft'].some(type=>!selected[type]))return notify('请选定版型、面料和工艺。',true);
  if(p.match?.blocked)return notify('请先处理当前匹配冲突。',true);
  const version=Number(p.solution?.version||0)+1,reason=version>1?'更新需求或确认新的资源组合后生成 V'+version:'生成 V1 初稿';
  const hasWidthRequest=fields(p).some(field=>field.key==='placketWidthRequest'&&field.value&&field.level!=='unspecified');
  return run(async()=>{
   await createVersion(p,{requirements:reqPayload(p),scene:p.scene,selected,version,placketWidth:hasWidthRequest?undefined:widthOf(p.currentRevision)??undefined,title:p.title},reason);
    p.selected=selected;setPage('plan');
  },'正在生成参考方案与图纸…');
 }
 if(kind==='revise'){
  const width=Number(data.get('width')),reason=String(data.get('reason')||'').trim(),prior=widthOf(p.currentRevision);
  if(!Number.isFinite(width)||width<20||width>50||!reason)return notify('填写 20–50 mm 的尺寸及修改原因。',true);
  if(width===prior)return notify('图纸尺寸未变化，请填写修订后的门襟宽。',true);
  const version=Number(p.solution.version)+1;
  return run(async()=>{
   await createVersion(p,{requirements:reqPayload(p),scene:p.scene,selected:p.solution.selected,version,placketWidth:width,title:p.title},
    '门襟宽 '+prior+' → '+width+' mm。'+reason,{type:'revision',actor:ACTOR.pattern});
    setPage('visual');
  },'正在重算图纸与提示词…');
 }
 if(kind==='case-note'){
  if(!revisionReview(p).archive||stale(p))return notify('先完成当前版本版师复核与归档。',true);
  const checklist=String(data.get('checklist')||'').split(/[\r\n]+/).map(value=>value.trim()).filter(Boolean).slice(0,12);
  if(!checklist.length)return notify('请填写检查事项。',true);
  if(checklist.some(item=>/\d+(?:\.\d+)?\s*(?:mm|cm|毫米|厘米)/i.test(item)))return notify('请将客户专属尺寸留在原台账，复用记录写成检查事项。',true);
  if(checklist.some(item=>/(?:^|[^\d])(?:\+?86[\s-]?)?1[3-9]\d{9}(?!\d)|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(item)))return notify('请移除客户联系方式，再批准通用检查事项。',true);
  const note={id:uid(),title:p.title,projectId:p.id,scene:p.scene,version:p.solution.version,checklist,approvedAt:now()};
   const applyNote=note=>{p.caseNote=note;notes.push(note);event(p,'reuse','批准复用 '+checklist.length+' 项检查事项',ACTOR.archive);persist();render();
   document.querySelector('[data-action="reuse-next"]')?.focus();
   };
   if(remote)return run(async()=>{const saved=await stageRequest(p,'/projects/'+encodeURIComponent(p.id)+'/reuse',{solutionId:p.solution.id,version:p.solution.version,noteId:note.id,checklist});applyNote(saved.note);},'正在保存复用检查项…');
   return applyNote(note);
 }
});
document.addEventListener('click',eventObject=>{
 const button=eventObject.target.closest('button[data-action]');
 if(!button||busy)return;
 const action=button.dataset.action,p=current();
 if(action==='close-photo')return closePhotoDialog(button.closest('dialog'));
 if(action==='sample-photos'){
  const scene=button.dataset.caseScene,ver=Number(button.dataset.caseVersion);
  if(!hasSample(scene,ver))return;
  const label='云汀会馆礼宾夹克 V1';
  const note='深藏蓝礼宾夹克，翻驳领，重点核对袋口加固。';
  return showPhotoDialog(label,'<p class="help">AI 写实效果图。'+note+'</p><div class="sample-gallery">'+PHOTO_VIEWS.map(spec=>'<figure><img src="'+samplePhotoPath(scene,spec.key,ver)+'" width="'+spec.width+'" height="'+spec.height+'" alt="'+e(label+' '+spec.title)+'"><figcaption><strong>'+e(spec.title)+'</strong><a href="'+samplePhotoPath(scene,spec.key,ver)+'" download="'+e(label+'-'+spec.title)+'.jpg">下载 JPG</a></figcaption></figure>').join('')+'</div>');
 }
 if(action==='step')return setPage(button.dataset.step);
 if(action==='workspace')return setPage(allowed(p,p.status)?p.status:'intake');
 if(action==='catalog')return setPage('catalog');
 if(action==='new-project')return appendProject(newProject());
 if(action==='rebuild-cloud'&&remote&&!p.serverRevision)return appendProject(newProject({title:p.title,scene:p.scene,text:p.text}));
 if(action==='retry-catalog')return run(loadCatalog,'正在读取资产…');
 if(action==='use-case'){
  const item=cases.find(v=>v.id===button.dataset.id);if(!item)return;
   const title=caseTitle(item.title);
   if(p.solution||p.requirements||p.text.trim())appendProject(newProject({title,scene:item.scene,text:item.text}));
   else{Object.assign(p,{title,scene:item.scene,text:item.text,reused:null});persist();render();document.getElementById('raw-text')?.focus();}
   return;
 }
 if(action==='filter-catalog'){
  filterType=button.dataset.type;render();document.querySelector('[data-action="filter-catalog"][aria-pressed="true"]')?.focus();return;
 }
 if(action==='view-version'||action==='inspect-version'){
  versionView=Number(button.dataset.version);
  if(action==='inspect-version'){
   page='visual';render();main.focus({preventScroll:true});window.scrollTo({top:0,behavior:'auto'});
   return;
  }
  render();document.querySelector('[data-action="view-version"][data-version="'+versionView+'"]')?.focus();return;
 }
 const rev=viewed(p);
 if(action==='retry-photos'&&rev){
  photoSets.delete(rev.solution.id);refreshPhotos(p,rev);loadPhotos(p,rev);return;
 }
 if(action==='generate-photos'&&rev)return generatePhotos(p,rev);
 if(['open-photo','download-photo','feedback-photo','approve-photo','redo-photo'].includes(action)&&rev){
  const entry=photoSets.get(rev.solution.id),image=entry?.images?.find(item=>item.key===button.dataset.photo);
  if(!image)return;
  const title=PHOTO_VIEWS.find(spec=>spec.key===image.key).title+' V'+rev.version;
  if(action==='download-photo')return run(()=>downloadPhoto(p,rev,image),'正在读取 JPG…');
  if(action==='open-photo')return showPhotoDialog(title,'<img class="photo-full" src="'+e(photoSource(image))+'" alt="'+e(title)+'">');
  const formAttrs='data-key="'+e(image.key)+'" data-solution="'+e(rev.solution.id)+'" data-receipt="'+e(image.receipt||'')+'"';
  if(action==='redo-photo'){
   if(p.solution.id!==rev.solution.id||stale(p)||entry.generating||entry.redrawPending)return;
   const newVersion=p.archivedVersions.includes(rev.version)||revisionReview(p,rev).approved||entry.mode==='reviewed';
   const hint=newVersion?'沿用原方案建立 V'+(rev.version+1)+' 视觉修订版。历史版本保留。':image.key==='garment'?'重画正背面后，特写和上身图需要基于新图生成。':'沿用本版成衣正背面，只重画所选视角。';
   const feedback=lastPhotoFeedback(p,rev,image)?.feedback||'';
   return showPhotoDialog('退回重出 '+title,'<form class="form" data-form="photo-redraw" '+formAttrs+'><p class="help">'+e(hint)+'</p><label class="field">画面修正意见<textarea name="feedback" rows="3" maxlength="400" required placeholder="例如：需拍到鞋尖，保持原方案的外套下摆">'+e(feedback)+'</textarea></label><button class="button button-dark" type="submit">退回并重出</button></form>');
  }
  if(action==='feedback-photo')return showPhotoDialog('反馈并改款','<form class="form" data-form="photo-feedback" '+formAttrs+'><strong>'+e(title)+'</strong><label class="field">客户修改意见<textarea name="feedback" maxlength="400" rows="3" required placeholder="请记录需要调整的部位和改法"></textarea></label><button class="button button-dark" type="submit">写入需求并返回修改</button></form>');
  if(entry.mode!=='generate'||image.approved||lastPhotoFeedback(p,rev,image))return;
  const checks=reviewItems(rev,image.key);
  return showPhotoDialog('逐项核对 '+title,'<div class="photo-review"><img src="'+e(photoSource(image))+'" alt="'+e(title)+'"><form class="form" data-form="photo-approval" '+formAttrs+'><fieldset><legend>本版验收要点</legend>'+checks.map((check,i)=>'<label><input type="checkbox" name="check" required value="'+i+'"> '+e(check)+'</label>').join('')+'</fieldset><button type="submit" class="button button-dark">保存顾问核对结果</button></form></div>');
 }
 if(action==='retry-preview'&&rev){
  previews.delete(rev.solution.id);refreshPreviews(p,rev);loadPreviews(p,rev);return;
 }
 if(action==='download-preview'&&rev){
  const image=previews.get(rev.solution.id)?.images?.find(item=>item.key===button.dataset.preview);
  if(!image)return;
  saveFile(new Blob([image.svg],{type:'image/svg+xml'}),safeName(p.title)+'-V'+rev.version+'-'+image.key+'.svg');
  event(p,'download-preview','下载 V'+rev.version+' '+image.title,ACTOR.advisor,rev.version);persist();return;
 }
 if(action==='complete-drawing'&&rev?.version===p.solution?.version&&!stale(p)){
  return run(async()=>{
   await createVersion(p,{requirements:reqPayload(p),scene:p.scene,selected:p.solution.selected,version:p.solution.version+1,placketWidth:widthOf(rev)??30,title:p.title},
    '补齐原生尺寸标注及同版效果示意',{type:'revision',actor:ACTOR.pattern});
   setPage('visual');
  },'正在生成补标后的技术图…');
 }
 const drawingFormat=action==='download-dxf'?'dxf':action==='download-svg'?'svg':null;
 if(drawingFormat&&rev?.drawing?.[drawingFormat]){
  const mime=drawingFormat==='dxf'?'application/dxf':'image/svg+xml';
  saveFile(new Blob([rev.drawing[drawingFormat]],{type:mime}),safeName(p.title)+'-V'+rev.version+'.'+drawingFormat);
  event(p,action,'下载 V'+rev.version+' '+drawingFormat.toUpperCase()+' 图纸',ACTOR.advisor,rev.version);persist();return;
 }
 if(action==='copy-prompt'){
   const item=list(rev?.brief?.prompts)[Number(button.dataset.index)],text=generatedCopy(item?.text||item?.prompt);
  if(!text)return;
  if(!navigator.clipboard)return notify('当前浏览器未开放剪贴板，请选中对应文字复制。',true);
  navigator.clipboard.writeText(text).then(()=>{event(p,'copy-prompt','复制 V'+rev.version+' 视觉提示词',ACTOR.advisor,rev.version);persist();notify('提示词已复制。');},()=>notify('请选中对应文字复制。',true));return;
 }
 if(action==='archive'){
  if(!p.solution||stale(p))return notify('先生成当前需求对应的新版本。',true);
  const review=revisionReview(p);
  if(!review.approved||review.archive)return notify('请先由版师复核当前方案和图纸。',true);
  const applyArchive=entry=>{if(!p.archivedVersions.includes(p.solution.version))p.archivedVersions.push(p.solution.version);
   p.events.push(entry);persist();render();document.querySelector('[data-action="export-delivery"]')?.focus();};
  const refs={solutionId:p.solution.id,drawingId:p.drawing.id,reviewId:review.approved.reviewId,version:p.solution.version};
  if(remote)return run(async()=>{const saved=await stageRequest(p,'/projects/'+encodeURIComponent(p.id)+'/archive',refs);applyArchive(saved.event);},'正在归档当前版…');
  return applyArchive({...makeEvent(p,'archive','业务人员确认归档 V'+p.solution.version+' 参考稿',ACTOR.archive),...(p.currentRevision.trace||{}),projectId:p.id,...refs});
 }
 if(['export-delivery','export-bundle','export-xlsx'].includes(action)){
  if(!p.solution||stale(p))return notify('先生成当前需求对应的新版本。',true);
  const delivery=action==='export-delivery',bundle=action!=='export-xlsx';
  if(delivery&&!revisionReview(p).archive)return notify('请完成本版图纸复核并确认归档。',true);
  const name=delivery?'核对版交付包':bundle?'内部工作包':'台账',suffix=bundle?'.zip':'.xlsx';
  const entry=makeEvent(p,action,'导出'+name);
  return run(async()=>{
   let blob;
   try{
    const photos=await exportPhotoRecords(p,delivery);
    const snapshot={...exportSnapshot(p,entry),photos};
    blob=await request(delivery?'/export/delivery':bundle?'/export/bundle':'/export/xlsx',snapshot,true);
   }catch(error){
    if(delivery&&(error.status===409||error.status===422||String(error.code||'').startsWith('DELIVERY_'))){
     deliveryMessages.set(p.solution.id,error.message);render();document.getElementById('delivery-status')?.scrollIntoView?.({block:'nearest'});
    }
    throw error;
   }
   saveFile(blob,safeName(p.title)+'-V'+p.solution.version+'-'+name+suffix);
   if(delivery)deliveryMessages.delete(p.solution.id);
   p.events.push(entry);persist();render();notify(name+'已下载。');
  },'正在整理'+name+'…');
 }
 if(action==='reuse-next'||action==='use-note'){
  const note=notes.find(item=>item.id===button.dataset.id);if(!note)return;
  if(action==='reuse-next'){
   const next=newProject({scene:note.scene,reused:note});event(next,'reuse','引用已批准检查项，来源 '+note.title+' V'+note.version);appendProject(next);
  }else{p.reused=note;pending(p);if(remote)p.extractedText='';event(p,'reuse','引用已批准检查项，来源 '+note.title+' V'+note.version);persist();render();}
   return;
 }
});
const p=current();
if(STEPS.some(s=>s[0]===p.status)&&allowed(p,p.status))page=p.status;
const logo=document.getElementById('group-logo');
const logoFallback=document.getElementById('group-logo-fallback');
if(logo&&logoFallback){
 const showLogo=()=>{
  if(!logo.naturalWidth)return;
  logo.hidden=false;logoFallback.hidden=true;
 };
 if(logo.complete)showLogo();
 else logo.addEventListener('load',showLogo,{once:true});
}
render();catalogReady=loadCatalog();
