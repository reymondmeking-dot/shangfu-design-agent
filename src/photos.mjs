import { catalog, catalogVersion, demoCases, extractRequirements, makeVisualBrief, normalizeRequirements } from './engine.mjs';
import { describeDrawing } from './exports.mjs';
import {canConstrainPlacket,editPlacket,placketEditInfo} from './placket-edit.mjs';

const model = '@cf/black-forest-labs/flux-2-klein-4b';
const root = '/design-agent/assets/';
const encoder = new TextEncoder();
const hashPattern = /^[a-f0-9]{64}$/;
const photos = [
  { key: 'garment', title: '成衣正背面', width: 1500, height: 1000, native: [1536,1024], filename: '01-成衣正背面.jpg' },
  { key: 'detail', title: '工艺与材质特写', width: 1200, height: 1200, native: [1200,1200], filename: '02-工艺与材质特写.jpg' },
  { key: 'on-body', title: '上身与场景氛围', width: 1200, height: 1500, native: [1216,1520], filename: '03-上身与场景氛围.jpg' },
];
const maxImageBytes = 2 * 1024 * 1024;
const signatureScheme = 'design-agent-photos/v1';
const reviewCandidates = [
  { id: 'group-v1', scene: 'group', version: 1, text: demoCases[1].text,
    archivedFieldsSha256: 'c962d9c69b6be54efd202f12dbc2ab9a39a5fa34bb43059ac6adca38d20f88c4',
    selected: ['PAT-004','FAB-003','TEC-004','CAS-004'], color: '深藏蓝',
    cad: ['lapel','西装翻驳领',30,690,470,585] },
];
const assetTypes = ['pattern','fabric','craft','case'];
const normalizeOriginal = value => String(value ?? '').trim().replace(/。+/gu, '。');
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
function fieldIdentity(fields) {
  return normalizeRequirements(fields).map(field => [field.key, field.value, field.level, ['customer','advisor'].includes(field.source) ? 'confirmed' : field.source,
    normalizeOriginal(field.evidence), field.canonical ?? null, field.excluded ?? null, field.conflict ?? false])
    .sort((a,b) => a[0].localeCompare(b[0]));
}
const legacyTemplate = 'shangfu-sim-1';
const baselineFields = reviewCandidates.map(candidate => {
  const requirements = extractRequirements(candidate);
  if (candidate.legacy) {
    const field = requirements.fields.find(item=>item.key==='craft');
    field.value = '暗扣或隐式门襟';
    requirements.fields = requirements.fields.filter(item=>item.key!=='bodyDescription');
  }
  return fieldIdentity(requirements);
});
async function findReviewedCase(solution, sourceText) {
  const tuple = assetTypes.map(type => solution.selected[type] || null);
  const cad = solution.cad;
  if (cad.units !== 'mm' || ![legacyTemplate,catalogVersion].includes(cad.templateVersion) || (cad.placketWidthMm != null && cad.placketWidthMm !== cad.placketWidth)) return null;
  const dimensions = [cad.collar,cad.collarLabel,cad.placketWidth,cad.garmentLength,cad.shoulderWidth,cad.sleeveLength];
  const raw = normalizeOriginal(solution.sourceText || sourceText);
  const fields = fieldIdentity(solution.requirements);
  const archivedHash = solution.scene === 'group' ? await sha(encoder.encode(JSON.stringify(fields))) : null;
  return reviewCandidates.find((candidate,index) => candidate.scene === solution.scene && candidate.version === solution.version
    && (candidate.scene === 'group' || cad.templateVersion === (candidate.legacy ? legacyTemplate : catalogVersion))
    && normalizeOriginal(candidate.text) === raw && same(candidate.selected,tuple) && candidate.color === solution.color
    && same(candidate.cad,dimensions) && (same(fields,baselineFields[index]) || candidate.archivedFieldsSha256 === archivedHash));
}
const error = (status, code, message) => Object.assign(new Error(message), {status,code,expose:true});
function view(key) {
  const value = photos.find(item => item.key === key);
  if (!value) throw error(422,'PHOTO_VIEW_INVALID','请选择成衣、特写或上身效果图。');
  return value;
}
function descriptor({key,title,width,height}) { return {key,title,width,height,mime:'image/jpeg'}; }
async function staticAsset(env, origin, name) {
  return env.ASSETS.fetch(new Request(new URL('/assets/' + name, origin)));
}
export async function getPhotoSet(solution, env, origin, sourceText, includeBytes=false, requiredView=null) {
  const common = {solutionId:solution.id,version:solution.version};
  const empty = {...common,mode:'generate',images:[]};
  const candidate = await findReviewedCase(solution,sourceText);
  if (!candidate || !env.ASSETS) return empty;
  const res = await staticAsset(env,origin,'photo-reviews.json');
  if (res.status === 404) return empty;
  if (!res.ok) throw error(503,'PHOTO_REVIEW_UNAVAILABLE','效果图核对记录暂时无法读取，请重试。');
  const set = (await res.json())[candidate.id];
  if (!set || !photos.every(({key}) => hashPattern.test(set[key]?.sha256 ?? '') && Array.isArray(set[key].checks) && set[key].checks.length > 0)) return empty;
  const images = await Promise.all(photos.filter(spec=>!requiredView || spec.key===requiredView).map(async spec => {
    const name = 'photo-' + candidate.id + '-' + spec.key + '.jpg';
    const image = await staticAsset(env,origin,name);
    if (!image.ok) throw error(503,'PHOTO_ASSET_MISSING','暂时打不开已核对的效果图，请稍后重试。');
    const bytes = new Uint8Array(await image.arrayBuffer());
    if (await sha(bytes) !== set[spec.key].sha256) throw error(503,'PHOTO_ASSET_CHANGED','写实图文件已变化，须重新核对。');
    try { assertJpeg(bytes,spec); }
    catch { throw error(503,'PHOTO_ASSET_CHANGED','已登记的写实图尺寸或文件格式有误，须重新核对。'); }
    return {...descriptor(spec), source:'ImageGen', reviewStatus:'reviewed', checks:set[spec.key].checks,
      url:root+name, sha256:set[spec.key].sha256, ...(includeBytes ? {bytes} : {})};
  }));
  return {...common, mode:'reviewed', images};
}
// Prior photography is only an editing reference. A revised image always receives a fresh pending receipt.
async function revisionReference(solution,key,env,origin) {
  const raw = normalizeOriginal(solution.sourceText);
  for (const c of reviewCandidates) {
    const first = normalizeOriginal(c.text);
    if (solution.scene !== c.scene || solution.version < c.version || !raw.startsWith(first)) continue;
    const tail = raw.slice(first.length).replace(/(?:补充|客户|改款)反馈[：:]/gu,'').trim();
    if (tail && !/^[\s，。；：:门襟的宽度目标必须要求尺寸设为改成从至到调毫米厘米公分为最终约\d.．±~～–—\-mci]+$/iu.test(tail)) continue;
    const baseline = {...solution,sourceText:c.text,version:c.version,
      requirements:solution.requirements.filter(f=>f.key !== 'placketWidthRequest'),
      cad:{...solution.cad,placketWidth:c.cad[2],placketWidthMm:c.cad[2]}};
    if (await findReviewedCase(baseline) !== c) continue;
    const reviewed = await getPhotoSet(baseline,env,origin,c.text,true,key);
    return reviewed.images.find(image=>image.key===key) ?? null;
  }
  return null;
}
function bytesOf(data,limit=maxImageBytes) {
  if (typeof data !== 'string' || data.length > Math.ceil(limit / 3)*4 || data.length < 100) {
    throw error(422,'PHOTO_DATA_INVALID','效果图数据缺失或超过大小限制。');
  }
  try { return Uint8Array.from(atob(data), c => c.charCodeAt(0)); }
  catch { throw error(422,'PHOTO_DATA_INVALID','效果图数据无法解码。'); }
}
const hex = value => Array.from(new Uint8Array(value), b => b.toString(16).padStart(2,'0')).join('');
const sha = async bytes => hex(await crypto.subtle.digest('SHA-256',bytes));
function asBase64(bytes) {
  let binary = '';
  for (let i=0;i<bytes.length;i+=0x8000) binary += String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(binary);
}
// Check the JPEG frame itself. File names, provider metadata and browser fields are insufficient.
function assertJpeg(bytes,spec) {
  if (bytes.length <= maxImageBytes && bytes[0] === 255 && bytes[1] === 216 && bytes.at(-2) === 255 && bytes.at(-1) === 217) {
    for (let i=2; i+9 < bytes.length && bytes[i] === 255;) {
      while (i < bytes.length && bytes[i] === 255) i++;
      const marker = bytes[i++];
      if (marker === 0xda || marker === 0xd9) break;
      const size = bytes[i]*256+bytes[i+1];
      if (size < 2 || i+size > bytes.length) break;
      if ([0xc0,0xc1,0xc2].includes(marker)) {
        if (size >= 8 && bytes[i+3]*256+bytes[i+4] === spec.height && bytes[i+5]*256+bytes[i+6] === spec.width) return;
        break;
      }
      i += size;
    }
  }
  throw error(422,'PHOTO_SPEC_MISMATCH','效果图的 JPEG 格式或实际像素与本视角不符。');
}
function canonical(solution) {
  return {...solution, assets:assetTypes.map(type=>catalog.find(a=>a.id === solution.selected[type] && a.type === type)).filter(Boolean)};
}
async function fingerprint(solution) {
  // SQLite snapshots and API clients may reorder JSON properties. Keep the
  // original CAD field order used by existing receipts while normalizing reads.
  const order=['units','collar','collarLabel','placketWidth','placketWidthMm','garmentLength','shoulderWidth','sleeveLength','placketWidthSource','patternId','templateVersion','source'];
  const drawing=Object.fromEntries([...order,...Object.keys(solution.cad).filter(k=>!order.includes(k)).sort()]
    .filter(k=>Object.hasOwn(solution.cad,k)).map(k=>[k,solution.cad[k]]));
  return sha(encoder.encode(JSON.stringify([signatureScheme,model,solution.cad.templateVersion,solution.id,solution.version,solution.scene,
    solution.sourceText || '',assetTypes.map(type => solution.selected[type] ?? null),solution.color,
    drawing,fieldIdentity(solution.requirements)])));
}
async function secret(env) {
  if (typeof env.SESSION_SECRET !== 'string' || env.SESSION_SECRET.length < 32) {
    throw error(503,'PHOTO_SERVICE_UNAVAILABLE','暂时无法核实图片来源，请联系工作台管理员。');
  }
  return crypto.subtle.importKey('raw',encoder.encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
const receiptData = (identity,key,digest,parent,designRef,method) => encoder.encode(
  [signatureScheme,identity,key,digest,parent,...(designRef ? [designRef] : []),...(method ? [method] : [])].join('|'));
async function verifiedImage(input, identity, signingKey) {
  const spec = view(input?.key);
  const bytes = bytesOf(input.data);
  assertJpeg(bytes,spec);
  const receipt = typeof input.receipt === 'string' ? /^(v[123])\.(0|[a-f0-9]{64})\.(?:([a-f0-9]{64})\.)?([a-f0-9]{64})$/.exec(input.receipt) : null;
  const digest = await sha(bytes);
  const edit = receipt?.[1] === 'v3' ? placketEditInfo(spec.key,receipt[3]) : null;
  if (!receipt || (receipt[1] !== 'v1') !== Boolean(receipt[3]) || receipt[1] === 'v3' && !edit || (spec.key === 'garment') !== (receipt[2] === '0') ||
    !await crypto.subtle.verify('HMAC',signingKey,Uint8Array.from(receipt[4].match(/../g), v=>parseInt(v,16)),
      receiptData(identity,spec.key,digest,receipt[2],receipt[3],edit?.editMethod))) {
    throw error(422,'PHOTO_RECEIPT_MISMATCH','图片记录与本版方案或所选视角对不上，请重新生成。');
  }
  return {...descriptor(spec),bytes,sha256:digest,parent:receipt[2],designReferenceSha256:receipt[3] || null,receipt:input.receipt,source:model,...edit};
}
export async function verifyPhotoForStorage(solution,image,env){
  const {bytes,...metadata}=await verifiedImage(image,await fingerprint(canonical(solution)),await secret(env));
  return {...metadata,data:asBase64(bytes),reviewStatus:'pending'};
}
const construction = {
  'PAT-001':'A straight H-line, slightly dropped shoulders, crossover front collar.',
  'PAT-002':'A straight relaxed H-line with lightly dropped shoulders and a low rounded upright Mandarin collar, no crossover.',
  'PAT-003':'Only overall silhouette is documented. Keep unconfirmed details neutral.',
  'PAT-004':'Straight service jacket, western notched lapels and room around the armholes for luggage handling.',
  'PAT-005':'A structured straight jacket with a high standing collar.',
  'PAT-006':'A straight concierge jacket with low standing collar and mobile armholes.',
  'PAT-007':'A roomy round-neck Chinese jacket with wide comfortable sleeves; no crossover.',
  'PAT-008':'Fitted double-breasted jacket with shaped waist and notched lapels.',
  'FAB-001':'Quiet low-contrast tone-on-tone silk jacquard with a restrained drape, subtle weave in grazing light.',
  'FAB-002':'Fine closely woven Song brocade with discreet woven ornament.',
  'FAB-003':'Deep navy easy-care blend with fine matte diagonal twill.',
  'FAB-004':'Fine smooth blue-grey worsted wool.',
  'FAB-005':'Wrinkle-resistant deep navy cotton-rich twill.',
  'FAB-006':'Soft matte textured gambiered silk (Xiangyunsha).',
  'FAB-007':'Supple satin with a soft reflected sheen.',
  'FAB-008':'Dark grey birdseye weave with a fine, periodical texture.',
  'TEC-001':'Concealed center/crossover front closure according to the selected pattern: no visible buttons, snaps, toggles or knots.',
  'TEC-002':'Visible traditional hand-knotted straight frog fasteners.',
  'TEC-003':'Restrained narrow contrasting piping.',
  'TEC-004':'Show unobtrusive tonal bartack reinforcement at the two functional pocket openings; no ornamental hardware.',
  'TEC-005':'Low-contrast tonal embroidery swatch only, no invented logo.',
  'TEC-006':'Fine tone-on-tone topstitching along the tailored lapel edge.',
  'TEC-007':'Discreet underarm articulation for movement.',
  'TEC-008':'Fine low-bulk hand-finishing along the fabric edge.',
  'TEC-009':'Buttonless edge-to-edge opening with a shallow overlap near the centre front. Cut-on front facing, straight cuffs with inside facings, a small gusset behind each lower side slit. No snaps, knots, buttons, zip or ties.',
};
function imagePrompt(solution,key,sourceView,feedback) {
  const fixed = canonical(solution);
  const brief = makeVisualBrief(fixed,describeDrawing(fixed));
  const p = brief.parameters;
  const viewText = {
    garment: (sourceView ? 'Edit the first reference product photo. Preserve the garment, collar, pocket configuration, sleeves, front/back layout and background, except for requested corrections. Follow the current facing or placket width. ' : '')+
      'Studio product diptych: same jacket, front left and back right. All edges visible, both views same scale.',
    detail: (sourceView ? 'Follow the first reference macro framing; the second image shows the current cloth area. ' : '')+
      (solution.selected.craft==='TEC-004'?'Extreme macro photo ONLY of one end of a horizontal double-welt hip pocket; the opening meets a tiny same-color bar tack. Diagonal woven twill fills every corner. No collar, silhouette, person or garment edges in the frame.':
        solution.selected.craft==='TEC-009'?'Macro of the front edge at the slight overlap, with a small section turned over to show the cut-on facing; no hardware or separate sewn-on trim. Capture the real woven texture in raking light.':
        'Extreme macro photo ONLY of the construction detail in the reference crop. Fabric fibers and seam fill every corner. No complete garment, mannequin or person.'),
    'on-body': (sourceView ? 'Keep exactly the first reference photograph framing, hotel environment or private room, person, full body and gesture. Dress the person in the jacket from the second reference. ' : '')+
      'Full-length environmental portrait. Show the complete head, feet, shoes and visible floor beneath both shoes. Camera far enough back for 10% headroom and ground. One person, photographed at a natural distance.',
  };
  const visualText = String(solution.sourceText || '').slice(0,4200)
    .replace(/(?:联系人|姓名|手机号|电话|邮箱|收件地址|家庭住址|身份证号)\s*[：:]\s*[^。；，\r\n]*/gu,'')
    .replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/giu,'').replace(/(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/gu,'');
  const recentFeedback = visualText.split(/[\r\n]/u).filter(line=>/^(?:补充反馈|客户反馈|改款反馈|反馈改款|调整要求)[：:]/u.test(line)).slice(-2).join(' ').slice(0,700);
  const context = key === 'on-body' ? [p.environment,p.wearers,p.activity].filter(Boolean).join('，') : '';
  const concierge = key==='on-body' && solution.scene==='group' && /搬运|行李/.test(p.activity) ?
    'Hotel concierge at a glass hotel lobby entrance: carrying a small suitcase clear of the floor with one hand and welcoming a guest with the other.' : '';
  const weltPockets = solution.selected.pattern==='PAT-004' && solution.selected.craft==='TEC-004'
    ? 'Match the technical flat exactly at both hips. Each pocket is a completely flat horizontal slit between two narrow self-fabric welts, with tiny tonal bartacks at the ends. The front fabric immediately below each slit is a continuous smooth panel. No hanging or rectangular pocket flaps, no projecting lips, no patch pockets. Keep that construction identical across the product and person views.' : '';
  return [viewText[key],feedback ? 'Correct this view as requested by the reviewer: '+feedback : '',weltPockets,concierge,
    key === 'detail' ? construction[solution.selected.fabric] : solution.selected.craft==='TEC-009' && solution.selected.pattern==='PAT-001'
      ? 'Straight H-line with gently dropped shoulders; a long narrow V opening that skims the near-vertical centre front. No diagonal wrap across the torso.' : construction[solution.selected.pattern],
    key !== 'detail' && solution.selected.craft==='TEC-009' && solution.selected.fabric==='FAB-001' ? construction['FAB-001'] : '',
    solution.selected.pattern==='PAT-004' && key!=='detail' ? 'Visible NOTCH on each folded tailored LAPEL. No shirt collar.'+(sourceView?' Two horizontal welt hip pockets ONLY, no chest pockets, flaps, buttons, badges or epaulettes.':'') : '',
    construction[solution.selected.craft],p.color.value+' '+(p.color.hex || '')+(solution.selected.craft==='TEC-009'?'. Cut-on facing reference width ':'. Placket overlap ')+p.dimensions.placketWidthMm+' mm.',
    context,sourceView ? '' : p.designDetail, recentFeedback ? 'Latest garment requirements: '+recentFeedback : '',
    !sourceView && !recentFeedback ? visualText.slice(0,450) : '', 'Natural optical photography. No text or diagrams.',
  ].filter(Boolean).join(' ');
}
async function renderJpeg(env,bytes,spec,reference=false,trim=null) {
  const input = new Response(bytes).body;
  const transform = reference ? {width:480,height:480,fit:'scale-down',...(trim ? {trim} : {})} : {width:spec.width,height:spec.height,fit:'cover'};
  const output = await env.IMAGES.input(input).transform(transform).output({format:'image/jpeg',quality:reference?85:91});
  const response = output.response();
  if (!response.ok) throw new Error('transform');
  return new Uint8Array(await response.arrayBuffer());
}
export async function generatePhoto(solution, key, reference, env, request, feedback='') {
  const spec = view(key), identity = await fingerprint(solution), signingKey = await secret(env);
  if (typeof feedback !== 'string' || feedback.length>400) throw error(422,'PHOTO_FEEDBACK_INVALID','单张效果图的修改意见须在400字以内。');
  if (key !== 'garment' && reference?.key !== 'garment') throw error(422,'PHOTO_REFERENCE_REQUIRED','请先生成这版成衣的正背面，再用它生成特写或上身图。');
  const base = key === 'garment' ? null : await verifiedImage(reference,identity,signingKey);
  const sourceView = await revisionReference(solution,key,env,new URL(request.url).origin);
  if (canConstrainPlacket(solution,key,sourceView,feedback) && (!base || base.editMethod === 'local-placket-edit')) {
    const {bytes,...edit}=editPlacket(sourceView,solution.cad.placketWidth-30);
    assertJpeg(bytes,spec);
    const digest=await sha(bytes),parent=base?.sha256 || '0',designRef=sourceView.sha256;
    const signature=hex(await crypto.subtle.sign('HMAC',signingKey,receiptData(identity,key,digest,parent,designRef,edit.editMethod)));
    return {solutionId:solution.id,version:solution.version,image:{...descriptor(spec),data:asBase64(bytes),
      receipt:'v3.'+parent+'.'+designRef+'.'+signature,sha256:digest,designReferenceSha256:designRef,...edit,reviewStatus:'pending'}};
  }
  if (!env.AI?.run || !env.IMAGES?.input) throw error(503,'PHOTO_SERVICE_UNAVAILABLE','暂时不能生成写实图。可先复制绘图提示词。');
  if (env.MODEL_LIMITER && !(await env.MODEL_LIMITER.limit({key:'photo:'+ (request.headers.get('cf-connecting-ip') || 'local')})).success) {
    throw error(429,'PHOTO_RATE_LIMITED','出图请求较多，请稍后重试。');
  }
  const form = new FormData();
  form.set('prompt',imagePrompt(solution,key,sourceView,feedback));
  form.set('width',String(spec.native[0]));
  form.set('height',String(spec.native[1]));
  try {
    if (sourceView) form.set('input_image_0',new Blob([await renderJpeg(env,sourceView.bytes,null,true)],{type:'image/jpeg'}),'design-reference.jpg');
    if (base) {
      const area = solution.selected.craft === 'TEC-004' ? {left:195,top:485,width:300,height:300}
        : solution.selected.craft === 'TEC-007' ? {left:110,top:225,width:300,height:300} : {left:230,top:62,width:350,height:350};
      const trim = key === 'detail' ? {mode:'area',...area} : null;
      const data = await renderJpeg(env,base.bytes,null,true,trim);
      form.set(sourceView?'input_image_1':'input_image_0',new Blob([data],{type:'image/jpeg'}),'current-garment.jpg');
    }
    const multipart = new Response(form);
    const response = await env.AI.run(model,{multipart:{body:multipart.body,contentType:multipart.headers.get('content-type')}});
    if (typeof response?.image !== 'string') throw new Error('model response');
    const bytes = await renderJpeg(env,bytesOf(response.image,10*1024*1024),spec);
    assertJpeg(bytes,spec);
    const digest = await sha(bytes), parent = base?.sha256 || '0';
    const designRef = sourceView?.sha256;
    const signature = hex(await crypto.subtle.sign('HMAC',signingKey,receiptData(identity,key,digest,parent,designRef)));
    return {solutionId:solution.id,version:solution.version,image:{...descriptor(spec),data:asBase64(bytes),
      receipt:(designRef?'v2.'+parent+'.'+designRef:'v1.'+parent)+'.'+signature,sha256:digest,designReferenceSha256:designRef || null,source:model,reviewStatus:'pending'}};
  } catch {
    throw error(502,'PHOTO_GENERATION_FAILED','这次生成的图片未通过检查，请重新生成。');
  }
}
export async function archivePhotos(project,env,origin) {
  const solution = project.solution;
  const photosIn = project.photos;
  if (photosIn != null && (!Array.isArray(photosIn) || photosIn.length > photos.length ||
      new Set(photosIn.map(p=>p?.key)).size !== photosIn.length)) throw error(422,'PHOTO_LIST_INVALID','效果图清单重复或格式无效。');
  let records = [];
  if (photosIn?.length) {
    const identity = await fingerprint(solution), signingKey = await secret(env);
    const prompts = makeVisualBrief(canonical(solution),describeDrawing(solution)).prompts;
    const events = Array.isArray(project.events) ? project.events : [];
    records = await Promise.all(photosIn.map(async input=>{
      const record = await verifiedImage(input,identity,signingKey);
      const checks = prompts.find(prompt=>prompt.key === record.key).checks;
      const approval = input.approved === true && events.some(event=>event?.type === 'approve-photo' &&
        event.version === solution.version && event.solutionId === solution.id && event.photoKey === record.key &&
        event.imageReceipt === record.receipt && Array.isArray(event.checks) && checks.every(value=>event.checks.includes(value)));
      return {...record,checks,reviewStatus:input.rejected === true ? 'changes-requested' : approval ? 'advisor-reviewed' : 'pending'};
    }));
    const garment = records.find(item=>item.key === 'garment');
    if (records.some(item=>item.key !== 'garment' && item.parent !== garment?.sha256)) {
      throw error(422,'PHOTO_REFERENCE_MISMATCH','特写或上身图使用的正背面参考与本次归档不同。');
    }
  } else if (project.currentRevision?.photoMode !== 'redraw') {
    const set = await getPhotoSet(solution,env,origin,project.currentRevision?.text ?? project.text,true);
    records = set.images;
  }
  return records.map(record=>{
    const feedback = (Array.isArray(project.events) ? project.events : []).filter(event=>event?.type === 'photo-feedback' &&
      event.version === solution.version && event.solutionId === solution.id && event.photoKey === record.key &&
      (event.imageReceipt ?? event.receipt ?? null) === (record.receipt ?? null))
      .map(event=>String(event.feedback || event.reason || event.message || '').slice(0,500)).filter(Boolean);
    const reviewStatus = feedback.length ? 'changes-requested' : record.reviewStatus;
    const dir = reviewStatus === 'changes-requested' ? '待调整效果图/' : reviewStatus === 'pending' ? '待复核效果图/' : '写实效果图/';
    return {...record,reviewStatus,feedback,file:dir+view(record.key).filename};
  });
}
