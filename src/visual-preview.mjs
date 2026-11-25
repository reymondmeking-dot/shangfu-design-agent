import { makeVisualBrief } from './engine.mjs';
import { getDrawingSilhouettes, makeDrawing } from './exports.mjs';

const palette = { paper:'#fdfdfc', canvas:'#f9f9f8', tint:'#f1f0ef', border:'#dad9d6', muted:'#63635e', ink:'#21201c', teal:'#0d3d38', jade:'#d6f1e3' };
const fallbackViews = [
  {key:'garment',title:'成衣正背面',width:1500,height:1000},
  {key:'detail',title:'工艺与材质特写',width:1200,height:1200},
  {key:'on-body',title:'上身与场景氛围',width:1200,height:1500},
];
const number = value => Number(Number(value).toFixed(3));
const phrase = (value, limit = 34) => Array.from(String(value ?? '').trim()).slice(0, limit).join('');
const xml = value => String(value ?? '').replace(/[\u0000-\u001f\ufffe\uffff]/g, '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));

function text(x,y,value,{size=28,weight=500,anchor='start',color=palette.ink}={}) {
  return `<text x="${x}" y="${y}" fill="${color}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" font-family="Microsoft YaHei, Noto Sans CJK SC, sans-serif">${xml(value)}</text>`;
}

function tone(color, target, weight) {
  const part = (hex, offset) => Number.parseInt(hex.slice(offset, offset+2),16);
  return '#' + [1,3,5].map(offset => Math.round(part(color,offset)*(1-weight)+part(target,offset)*weight).toString(16).padStart(2,'0')).join('');
}

function fabricTexture(asset) {
  const label=[asset?.name, ...(asset?.tags ?? [])].join(' ');
  if (/暗纹|织花|宋锦/.test(label)) return {size:34,mark:'<path d="M17 4c4 8 8 10 13 13-8 4-10 8-13 13C13 22 9 20 4 17c8-4 10-8 13-13Z" fill="none" stroke="white" stroke-width="1.15"/><circle cx="17" cy="17" r="2.1" fill="white"/>',opacity:.19};
  if (/鸟眼/.test(label)) return {size:13,mark:'<circle cx="3" cy="3" r="1.25" fill="white"/><circle cx="9.5" cy="9.5" r="1.25" fill="white"/>',opacity:.22};
  if (/斜纹|精纺|棉混纺/.test(label)) return {size:13,mark:'<path d="M-3 3 3-3M0 13 13 0M10 16 16 10" fill="none" stroke="white" stroke-width="1.3"/>',opacity:.17};
  return {size:14,mark:'',opacity:0};
}

function fabricDefs(color, texture) {
  const shade=tone(color,palette.ink,.24), light=tone(color,palette.paper,.18);
  return `<linearGradient id="cloth"><stop stop-color="${shade}"/><stop offset=".5" stop-color="${color}"/><stop offset=".74" stop-color="${light}"/><stop offset="1" stop-color="${shade}"/></linearGradient>
  <pattern id="grain" width="${texture.size}" height="${texture.size}" patternUnits="userSpaceOnUse">${texture.mark}</pattern>`;
}

function entityPath(item) {
  const points=item.type==='line'?[item.from,item.to]:item.points;
  return 'M'+points.map(point=>point.map(number).join(' ')).join('L')+(item.closed?'Z':'');
}

function garment(view,color,texture) {
  const outline=view.entities.find(item=>item.layer==='OUTLINE'&&item.closed);
  const d=entityPath(outline);
  const seams=view.entities.filter(item=>!item.hidden&&(item.layer==='STRUCTURE'||item.layer==='CRAFT')).map(item=>{
    const craft=item.layer==='CRAFT';
    const contrast=craft?tone(color,palette.paper,.36):tone(color,palette.ink,.67);
    return `<path d="${entityPath(item)}" fill="none" stroke="${contrast}" stroke-width="${craft?2.2:3}" stroke-linecap="round" stroke-linejoin="round"${craft?' stroke-dasharray="4 4"':''}/>`;
  }).join('');
  const inside = view.landmarks.insideNeck;
  const lining = inside ? `<path d="${entityPath({points:inside,closed:true})}" fill="${tone(color,palette.ink,.65)}"/>` : '';
  return `<path d="${d}" fill="url(#cloth)" stroke="${tone(color,palette.ink,.67)}" stroke-width="4.2" stroke-linejoin="round"/>
  ${texture.opacity?`<path d="${d}" fill="url(#grain)" opacity="${texture.opacity}"/>`:''}${lining}${seams}`;
}

function fit(view,[x,y,width,height],color,texture) {
  const [left,top,right,bottom]=view.bounds;
  const scale=Math.min(width/(right-left),height/(bottom-top));
  const tx=x+(width-(right-left)*scale)/2-left*scale;
  const ty=y+(height-(bottom-top)*scale)/2-top*scale;
  return {markup:`<g transform="translate(${number(tx)} ${number(ty)}) scale(${number(scale)})">${garment(view,color,texture)}</g>`,
    map:([px,py])=>[number(tx+px*scale),number(ty+py*scale)]};
}

function swatch(x,y,w,h,color) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${color}"/>`;
}

function sheet(view,title,desc,version,defs,body) {
  const {width,height}=view;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title caption"><title id="title">${xml(title)}</title><desc id="caption">${xml(desc)}</desc>
  <defs>${defs}</defs><rect width="${width}" height="${height}" fill="${palette.paper}"/>
  ${text(62,68,title,{size:38,weight:700})}${text(width-62,63,`V${version} 参数示意`,{anchor:'end',size:21,color:palette.muted})}
  <path d="M62 91H${width-62}" stroke="${palette.border}"/>${body}</svg>`;
}

function garmentSheet({front,back},color,texture,details) {
  return `<rect x="62" y="122" width="1376" height="688" fill="${palette.canvas}"/>
  ${fit(front,[92,153,640,605],color,texture).markup}${fit(back,[768,153,640,605],color,texture).markup}
  ${text(412,792,'正面',{anchor:'middle',size:24})}${text(1088,792,'背面',{anchor:'middle',size:24})}
  <path d="M750 153V774" stroke="${palette.border}"/>
  ${swatch(62,854,26,26,color)}${text(102,875,details.color,{size:24})}
  ${text(62,930,`${details.pattern} / ${details.collar}`,{size:29,weight:700})}${text(1438,929,details.craft,{anchor:'end',size:23,color:palette.muted})}`;
}

function detailSheet(front,color,texture,details,measurements) {
  const [left,top,right,bottom]=front.bounds;
  const placket=front.landmarks.placket;
  const center=front.landmarks.craftFocus ?? (placket?.length===2
    ? [(placket[0][0]+placket[1][0])/2,placket[0][1]+72] : [(left+right)/2,top+(bottom-top)*.37]);
  const scale=1.52;
  return `<clipPath id="detail-window"><rect x="62" y="125" width="513" height="675" rx="6"/></clipPath>
  <rect x="62" y="125" width="513" height="675" fill="${palette.tint}"/>
  <g clip-path="url(#detail-window)"><g transform="translate(${number(318-center[0]*scale)} ${number(446-center[1]*scale)}) scale(${scale})">${garment(front,color,texture)}</g></g>
  <rect x="606" y="125" width="532" height="675" rx="6" fill="url(#cloth)"/>
  ${texture.opacity?`<rect x="606" y="125" width="532" height="675" rx="6" fill="url(#grain)" opacity="${number(texture.opacity*1.38)}"/>`:''}
  ${text(62,844,phrase(details.craft,21),{size:28,weight:700})}${text(606,844,phrase(details.fabric,19),{size:28,weight:700})}
  ${text(62,890,phrase(measurements.placketStructure,24),{size:22,color:palette.muted})}${text(62,927,phrase(measurements.placketClosure,25),{size:22,color:palette.muted})}
  ${text(606,890,texture.opacity?'模拟样卡的纹理示意':'示意色块，纹理待核',{size:22,color:palette.muted})}
  <path d="M62 974H1138" stroke="${palette.border}"/>
  ${text(62,1031,`${measurements.placketWidthDatum?'襟缘至贴边内口':'门襟'} ${number(measurements.placketWidthMm)} mm`,{size:31,weight:700})}
  ${text(62,1092,`领宽 ${number(measurements.collarWidthMm)} mm　肩点落差 ${number(measurements.shoulderDropMm)} mm`,{size:25})}
  ${text(62,1144,'测量以同版技术图为准',{size:22,color:palette.muted})}`;
}

function stage(environment) {
  const exterior=/室外|户外|外场|园林/.test(environment);
  const interior=/室内|大堂|会客|展览|画廊/.test(environment)||(!exterior&&/酒店|接待/.test(environment));
  const lobby=interior?'<path d="M85 1087V427H367V1087M96 501H367M139 427V1087M314 427V1087" stroke="#dad9d6" stroke-width="4" fill="none"/>':'';
  const outside=exterior?'<path d="M856 1087c0-183 79-241 134-328 23 95 75 160 92 328" fill="#e2e1de"/><path d="M972 1087V809" stroke="#cfceca" stroke-width="3"/>':'';
  return `<rect x="62" y="124" width="1076" height="1135" fill="${palette.canvas}"/>${lobby}${outside}<path d="M62 1090H1138" stroke="${palette.border}"/><ellipse cx="600" cy="1196" rx="263" ry="28" fill="${palette.tint}"/>`;
}

function onBodySheet(front,color,texture,details,environment,activity) {
  const fitted=fit(front,[300,324,600,520],color,texture);
  const [cx,cy]=fitted.map([front.landmarks.centreX,front.landmarks.neckRight[1]]);
  const lower=fitted.map([front.landmarks.centreX,front.bounds[3]])[1];
  const [cuffX,cuffY]=fitted.map(front.landmarks.sleeveLength[1]);
  const legHeight=1190-(lower-28);
  const luggage=/行李/.test(activity)?'<path d="M923 1140v-134h72v134" fill="none" stroke="#8d8d86" stroke-width="7"/><rect x="894" y="1081" width="128" height="119" rx="16" fill="#8d8d86"/><path d="M926 1103v73m62-73v73" stroke="#bcbbb5" stroke-width="4"/>':'';
  return `${stage(environment)}${luggage}<g transform="translate(${cx} ${cy})">
  <path d="M-57 30V-51H57V30Z" fill="#d5c3aa"/>
  <path d="M-100 -105c0-97 43-142 100-142s100 47 100 142l-23 57c-18 47-47 62-77 62s-60-15-77-62Z" fill="#d5c3aa" transform="translate(0 -27) scale(.75)"/>
  <path d="M-73 -168c22-47 53-53 77-53 34 0 69 23 82 59-22-13-28-30-42-31-34 23-60 39-117 39Z" fill="#474541"/>
  </g><g transform="translate(${cx} ${lower-28})">
  <path d="M-109 0H109L88 ${legHeight-16}H22L0 ${number(legHeight*.34)}-22 ${legHeight-16}H-88Z" fill="#55534e"/>
  <path d="M-88 ${legHeight-24}h65l-4 32h-94q-4-13 33-32Zm111 0h65q38 20 36 32H27Z" fill="#2b2a27"/></g>
  <ellipse cx="${cuffX}" cy="${cuffY+14}" rx="18" ry="30" fill="#d5c3aa"/><ellipse cx="${2*cx-cuffX}" cy="${cuffY+14}" rx="18" ry="30" fill="#d5c3aa"/>
  ${fitted.markup}
  ${text(62,1330,phrase(environment,32),{size:29,weight:700})}
  ${text(62,1383,`${details.collar} / ${details.color}`,{size:24})}
  ${text(62,1435,'站姿示意，活动量和上身效果以试穿为准',{size:22,color:palette.muted})}`;
}

export function makeVisualPreviews(solution,{brief,drawing}={}) {
  drawing ??= makeDrawing(solution);
  brief ??= makeVisualBrief(solution,drawing);
  const {front,back}=getDrawingSilhouettes(solution);
  const measurements=drawing.measurements;
  const parameters=brief.parameters ?? {};
  const lookup=type=>solution.assets?.find(item=>item.type===type);
  const colorValue=parameters.color?.hex;
  const color=typeof colorValue==='string'&&/^#[\da-f]{6}$/i.test(colorValue)?colorValue:'#8d8d86';
  const usingSample=parameters.color?.status==='pending'||colorValue!==color;
  const environment=phrase(parameters.environment || '场景待确认',42);
  const details={pattern:lookup('pattern')?.name ?? '版型待确认',fabric:lookup('fabric')?.name ?? '面料待确认',
    craft:lookup('craft')?.name ?? '工艺待确认',collar:measurements.collar,
    color:usingSample?`${phrase(parameters.color?.value || '待确认色样',17)}，当前为示意色`:phrase(parameters.color?.value || solution.color)};
  const texture=fabricTexture(lookup('fabric'));
  const defs=fabricDefs(color,texture);
  const bodies=[garmentSheet({front,back},color,texture,details),detailSheet(front,color,texture,details,measurements),onBodySheet(front,color,texture,details,environment,parameters.activity)];
  const images=fallbackViews.map((view,index)=>{
    const alt=`${view.title}，V${solution.version}，${details.collar}，${details.color}，${details.fabric}，${details.craft}`;
    return {...view,id:`${solution.id}-V${solution.version}-${view.key}`,alt,
      svg:sheet(view,view.title,alt,solution.version,defs,bodies[index])};
  });
  const mode='parameter-preview';
  const manifest={solutionId:solution.id,version:solution.version,mode,assets:solution.selected,
    color:{...parameters.color,displayHex:color,usesSampleColor:usingSample},dimensions:measurements,scene:environment,
    views:images.map(({key,id,width,height})=>({key,id,width,height}))};
  return {solutionId:solution.id,version:solution.version,mode,images,manifest};
}
