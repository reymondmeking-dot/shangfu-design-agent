import { orderDisposition } from './download-names.mjs';
import {
  catalog, catalogVersion, demoCases, extractRequirements, matchResources,
  createSolution, makeVisualBrief, normalizeRequirements, normalizeScene, suggestCaseNote
} from './engine.mjs';
import { archiveMetadata, makeDrawing } from './exports.mjs';
import { patternReviewState } from './pattern-review.mjs';
import { makeArtifactPack, makeCatalogCsv, makeProjectWorkbook, preparePythonExport } from './reports.mjs';
import { pythonRequest } from './python-origin.mjs';
import { sourceCases } from './source-cases.mjs';
import { knowledgeSources } from './knowledge.mjs';
import { makeVisualPreviews } from './visual-preview.mjs';
import * as photoApi from './photos.mjs';
const { archivePhotos, generatePhoto, getPhotoSet } = photoApi;
import { interpretText, modelReady } from './inference.mjs';
import { accessGuard } from './auth.mjs';

import { showcase } from './showcase.mjs';
const root = '/design-agent';
const revision = '20261125.12.3';
const responseHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Design-Agent-Release': revision
};
const contentPolicy = "default-src 'self'; base-uri 'self'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; object-src 'none'; frame-ancestors 'self'";
const defaultLimit = 64 * 1024;
const exportLimit = 1500 * 1024;
const photoLimit = 3 * 1024 * 1024;

function json(data, status = 200) {
  return Response.json(data, { status, headers: { ...responseHeaders, 'Cache-Control': 'no-store' } });
}

function clientError(message, status = 422) {
  return Object.assign(new Error(message), { status });
}

async function readBody(request, limit) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw clientError('请使用 JSON 提交数据。', 415);
  }
  const size = Number(request.headers.get('content-length') || 0);
  if (size > limit) throw clientError('提交的数据太大。', 413);
  if (!request.body) throw clientError('缺少请求内容。', 400);
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let tally = 0;
  let text = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      tally += value.byteLength;
      if (tally > limit) {
        await reader.cancel();
        throw clientError('提交的数据太大。', 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw clientError('请求内容不是有效的 JSON 对象。', 400);
  }
}

function demandRequirements(body) {
  const fields = Array.isArray(body.requirements) ? body.requirements : body.requirements?.fields;
  if (!Array.isArray(fields) || !fields.length || fields.length > 30) {
    throw clientError('请先从客户原话提取参数，再由顾问确认。');
  }
  const keys = new Set();
  for (const field of fields) {
    if (typeof field?.key !== 'string' || keys.has(field.key) || field.key.length > 40 ||
        typeof field.value !== 'string' || field.value.length > 350 ||
        (field.evidence != null && (typeof field.evidence !== 'string' || field.evidence.length > 900))) {
      throw clientError('设计参数有重复项或未填对的值，请回到参数页核对。');
    }
    keys.add(field.key);
  }
  return body.requirements;
}

function validateSolutionSnapshot(solution) {
  if (!solution || !/^[\w-]{1,80}$/.test(solution.id ?? '') ||
      !Number.isInteger(solution.version) || solution.version < 1 || solution.version > 40 ||
      !['private','group'].includes(solution.scene) || !Array.isArray(solution.requirements) ||
      !Array.isArray(solution.assets) || !solution.assets.every(used => catalog.some(item => item.id === used?.id && item.type === used.type &&
        item.name === used.name && item.description === used.description && JSON.stringify(item.colors ?? []) === JSON.stringify(used.colors ?? []))) ||
      !['pattern','fabric','craft'].every(type => catalog.some(item => item.type === type && item.id === solution.selected?.[type])) ||
      !Number.isFinite(solution.cad?.placketWidth) || solution.cad.placketWidth < 20 || solution.cad.placketWidth > 50) {
    throw clientError('无法核对方案、尺寸或资源编号，请重新打开这版方案。');
  }
  const pattern = catalog.find(item => item.id === solution.selected.pattern);
  if (pattern.collar !== solution.cad.collar || solution.cad.patternId !== pattern.id ||
      [solution.cad.garmentLength, solution.cad.shoulderWidth, solution.cad.sleeveLength].some(value => !Number.isFinite(value) || value <= 0) ||
      !['pattern','fabric','craft'].every(type => solution.assets.some(item => item.type === type && item.id === solution.selected[type]))) {
    throw clientError('方案的图纸或资源与所选组合不一致。');
  }
}

function validateArchive(project) {
  if (!project.solution || !project.requirements || !Array.isArray(project.history) || project.history.length > 40) {
    throw clientError('还没有可用的方案版本，请先生成参考方案。');
  }
  validateSolutionSnapshot(project.solution);
  const expectedDrawing = 'CAD-' + project.solution.id + '-V' + project.solution.version;
  if (project.drawing && project.drawing.id !== expectedDrawing) {
    throw clientError('图纸与当前方案版本不一致。');
  }
  if (project.currentRevision && (project.currentRevision.version !== project.solution.version ||
      (project.currentRevision.solution && project.currentRevision.solution.id !== project.solution.id))) {
    throw clientError('当前台账与方案版本不一致。');
  }
  const versions = new Set();
  for (const record of project.history) {
    const version = record?.version ?? record?.solution?.version;
    if (!Number.isInteger(version) || version < 1 || version >= project.solution.version || versions.has(version) ||
        (record.solution?.version && record.solution.version !== version)) {
      throw clientError('台账的版本记录不一致，请刷新项目后再导出。');
    }
    versions.add(version);
  }
}

async function api(request, env, path) {
  if (env.SHANGFU_ORIGIN) {
    if (request.method === 'GET' && ['/health','/catalog'].includes(path)) {
      const upstream = await pythonRequest(env,path);
      if (!upstream.ok) return upstream;
      const result = await upstream.json();
      const response = json(path === '/catalog' ? {...result,backend:'fastapi',version:result.catalogVersion,storage:'sqlite'} :
        {...result,backend:'fastapi',release:revision,catalogVersion,storage:'sqlite',modelName:result.model,
          model:result.ollamaReady?'available':'rules',inference:result.ollamaReady?'ollama':'rules-fallback',
          photoBindings:env.AI && env.IMAGES && env.SESSION_SECRET?'configured':'unavailable'});
      response.headers.set('X-Agent-Backend','fastapi');
      return response;
    }
    if (request.method === 'GET' && (['/projects','/notes'].includes(path) || /^\/projects\/[\w-]{1,100}(?:\/visual-images\/[\w-]{1,100})?$/.test(path))) {
      return pythonRequest(env,path);
    }
    if (request.method === 'POST' && /^\/projects\/[\w-]{1,100}\/visual-images$/.test(path)) {
      const body = await readBody(request,3.5 * 1024 * 1024);
      validateSolutionSnapshot(body.solution);
      body.image=await photoApi.verifyPhotoForStorage(body.solution,body.image,env);
      body.verifiedByEdge=true;
      return pythonRequest(env,path,body);
    }
    if (request.method === 'POST' && (['/projects','/extract','/match','/solution'].includes(path) ||
          /^\/projects\/[\w-]{1,100}\/(?:review|archive|reuse|visual-events)$/.test(path))) {
      const body = await readBody(request,defaultLimit);
      return pythonRequest(env,path,body);
    }
  }
  switch (request.method + ' ' + path) {
    case 'GET /health':
      return json({ ready: true, release: revision, catalogVersion, model: modelReady(env) ? 'available' : 'rules', inference: env.OLLAMA_URL ? 'ollama' : env.AI ? 'workers-ai' : 'rules', photoBindings: env.AI && env.IMAGES && env.SESSION_SECRET ? 'configured' : 'unavailable', backend: 'worker', storage: 'browser' });
    case 'GET /catalog':
      return json({ catalog, cases: demoCases, version: catalogVersion,sourceCases,knowledgeSources,backend:'worker',storage:'browser' });
    case 'GET /catalog.csv':
      return new Response(makeCatalogCsv(), { headers: {
        ...responseHeaders, 'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': "attachment; filename=design-asset-catalog.csv; filename*=UTF-8''%E5%AE%9A%E5%88%B6%E8%B5%84%E6%BA%90%E5%88%86%E7%B1%BB%E6%B8%85%E5%8D%95.csv",
        'Cache-Control': 'no-store'
      } });
    case 'POST /extract': {
      const body = await readBody(request, defaultLimit);
      const { text } = body;
      if (typeof text !== 'string' || !text.trim() || text.length > 4200) {
        throw clientError('请输入 1–4200 字的客户需求。');
      }
      const scene = normalizeScene(body.scene);
      const result = extractRequirements({ text: text.trim(), scene });
      let modelEnv = env;
      if (env.MODEL_LIMITER) {
        const key = request.headers.get('cf-connecting-ip') || 'local';
        try {
          if (!(await env.MODEL_LIMITER.limit({ key })).success) modelEnv = {};
        } catch {
          modelEnv = {};
        }
      }
      const interpreted = await interpretText({ env: modelEnv, text: text.trim(), scene, result });
      if (modelEnv !== env) interpreted.mode = 'rules-fallback';
      return json(interpreted);
    }
    case 'POST /match': {
      const body = await readBody(request, defaultLimit);
      const requirements = demandRequirements(body);
      return json(matchResources({ requirements, scene: body.scene }));
    }
    case 'POST /solution': {
      const body = await readBody(request, defaultLimit);
      const requirements = demandRequirements(body);
      if (body.title != null && (typeof body.title !== 'string' || body.title.length > 120)) {
        throw clientError('项目名称须在 120 字以内。');
      }
      if (body.version != null && (!Number.isInteger(body.version) || body.version < 1 || body.version > 40)) {
        throw clientError('当前方案版本号无效。');
      }
      const solution = createSolution({ ...body, requirements });
      const drawing = makeDrawing(solution);
      return json({ solution, brief: makeVisualBrief(solution,drawing), drawing, suggestedCaseNote: suggestCaseNote(solution.scene) });
    }
    case 'POST /visual/previews': {
      const {solution} = await readBody(request, defaultLimit);
      validateSolutionSnapshot(solution);
      return json(makeVisualPreviews(solution));
    }
    case 'POST /visual/photos': {
      const {solution,sourceText,forceGenerate} = await readBody(request,defaultLimit);
      validateSolutionSnapshot(solution);
      if (forceGenerate === true) return json({solutionId:solution.id,version:solution.version,mode:'generate',images:[]});
      return json(await getPhotoSet(solution,env,new URL(request.url).origin,sourceText));
    }
    case 'POST /visual/photo': {
      const {solution,key,reference,feedback} = await readBody(request,photoLimit);
      validateSolutionSnapshot(solution);
      return json(await generatePhoto(solution,key,reference,env,request,feedback));
    }
    case 'POST /export/xlsx': {
      const body = await readBody(request, exportLimit + 3 * photoLimit);
      validateArchive(body);
      const photos = await archivePhotos(body,env,new URL(request.url).origin);
      if (env.SHANGFU_ORIGIN) return pythonExport(env,'xlsx',body,photos);
      return new Response(makeProjectWorkbook(body,photos), { headers: {
        ...responseHeaders,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': orderDisposition(body,body.solution.version,'xlsx'),
        'Cache-Control': 'no-store'
      } });
    }
    case 'POST /export/delivery':
    case 'POST /export/bundle': {
      let body = await readBody(request, exportLimit + 3 * photoLimit);
      validateArchive(body);
      const delivery = path === '/export/delivery';
      if (delivery) {
        if (env.SHANGFU_ORIGIN) {
          const authoritative = await archivedProject(env,body);
          if (authoritative instanceof Response) return authoritative;
          body=authoritative;
        }
        const archive = archiveMetadata(body,body.solution.version);
        const hasArchiveEvent = Array.isArray(body.events) && body.events.some(event=>
          event?.type === 'archive' && Number(event.version) === body.solution.version && typeof event.actor === 'string' && event.actor.trim());
        const currentText = body.text ?? body.currentRevision?.text ?? '';
        if (typeof currentText !== 'string' || currentText.trim() !== body.solution.sourceText?.trim() ||
            JSON.stringify(normalizeRequirements(body.requirements)) !== JSON.stringify(normalizeRequirements(body.solution.requirements))) {
          return json({code:'DELIVERY_REVISION_STALE',error:'客户需求已有改动，请按新需求生成方案。'},422);
        }
        const review = patternReviewState(body);
        if (!review.approved || (hasArchiveEvent && !review.archive)) {
          return json({code:'DELIVERY_PATTERN_REVIEW_REQUIRED',error:'请由版师核对这版方案和图纸。复核通过后，再确认归档。'},422);
        }
        if (archive.status !== '已归档' || !review.archive || !Number.isFinite(Date.parse(archive.archivedAt))) {
          return json({code:'DELIVERY_ARCHIVE_REQUIRED',error:'这版方案还没归档，请先确认归档。'},422);
        }
      }
      const photographs = await archivePhotos(body,env,new URL(request.url).origin);
      if (delivery) {
        const accepted = new Set(photographs.filter(p=>['reviewed','advisor-reviewed'].includes(p.reviewStatus)).map(p=>p.key));
        const pending = ['garment','detail','on-body'].filter(key=>!accepted.has(key));
        if (pending.length) return json({code:'DELIVERY_PHOTOS_REQUIRED',error:'请到效果图页核对成衣、工艺特写和上身图。缺图先补，退回的图改后再核。',pending},422);
      }
      if (env.SHANGFU_ORIGIN) return pythonExport(env,delivery?'delivery':'bundle',body,photographs);
      return new Response(makeArtifactPack(body,photographs,delivery), { headers: {
        ...responseHeaders, 'Content-Type': 'application/zip',
        'Content-Disposition': orderDisposition(body,body.solution.version,delivery?'delivery':'bundle'),
        'Cache-Control': 'no-store'
      } });
    }
    default:
      return json({ error: '此接口不存在。' }, 404);
  }
}

async function archivedProject(env,submitted) {
  if (!/^[\w-]{1,100}$/.test(submitted.id || '')) return json({error:'缺少项目编号。'},422);
  const base='/projects/'+encodeURIComponent(submitted.id);
  const response=await pythonRequest(env,base);
  if (!response.ok) return response;
  const stored=await response.json();
  if (stored.phase!=='archived' || stored.solution?.id!==submitted.solution.id || stored.solution.version!==submitted.solution.version ||
      stored.solution.sourceText?.trim()!==submitted.text?.trim() ||
      JSON.stringify(normalizeRequirements(stored.requirements))!==JSON.stringify(normalizeRequirements(submitted.requirements))) {
    return json({code:'DELIVERY_REVISION_STALE',error:'这次提交的需求或方案与归档版本不同，请打开已归档的版本。'},422);
  }
  const photos=await pythonRequest(env,base+'/visual-images/'+encodeURIComponent(stored.solution.id));
  if (!photos.ok) return photos;
  const supplemental=(submitted.events||[]).filter(row=>['export-delivery','export-xlsx','export-bundle','copy-prompt','download-dxf','download-svg','download-preview','download-photo','visual-preview'].includes(row?.type));
  return {...stored,photos:(await photos.json()).images,events:[...stored.events,...supplemental].sort((a,b)=>String(a.changedAt).localeCompare(String(b.changedAt)))};
}

async function pythonExport(env,kind,project,photos) {
  const model = {...preparePythonExport(project,photos,kind === 'delivery'),projectTitle:project.title};
  const res = await pythonRequest(env,'/render/'+kind,{model,projectId:project.id,solutionId:project.solution.id,version:project.solution.version});
  if (res.ok) {
    res.headers.set('Content-Disposition',orderDisposition(project,project.solution.version,kind));
    res.headers.set('X-Design-Agent-Release',revision);
  }
  return res;
}

async function asset(request, env, path, entry) {
  const url = new URL(request.url);
  url.pathname = path;
  url.search = '';
  const upstream = await env.ASSETS.fetch(new Request(url, { method: request.method }));
  const headers = new Headers(upstream.headers);
  for (const [key, value] of Object.entries(responseHeaders)) headers.set(key, value);
  if (entry) {
    headers.set('Content-Security-Policy', contentPolicy);
    headers.set('Cache-Control', 'no-cache');
  } else if (path.startsWith('/assets/photo-') || /\.(?:pdf|md|zip|xmind|js)$/.test(path)) {
    headers.set('Cache-Control', 'private, no-cache');
  } else {
    headers.set('Cache-Control', 'private, max-age=3600');
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}

export async function handle(request, env) {
  const publicPage = await showcase(request, env);
  if (publicPage) return publicPage;
  const locked = await accessGuard(request, env);
  if (locked) return locked;
  const { pathname, origin } = new URL(request.url);
  if (pathname === root + '/api' || pathname.startsWith(root + '/api/')) {
    if (request.method === 'POST' && request.headers.has('origin') && request.headers.get('origin') !== origin) {
      return json({ error: '请从工作台提交。' }, 403);
    }
    try {
      return await api(request, env, pathname.slice((root + '/api').length));
    } catch (error) {
      const status = Number.isInteger(error?.status) ? error.status : 500;
      if (status >= 500) console.warn('[design-agent]', error?.name || 'Error');
      const mayExplain = status < 500 || error?.expose === true;
      return json({ error: mayExplain ? error.message : '服务暂时无法完成此操作，请重试。', ...(mayExplain && error?.code ? { code:error.code } : {}) }, status);
    }
  }
  if (request.method === 'GET' || request.method === 'HEAD') {
    if (pathname === root || pathname === root + '/') return asset(request, env, '/index.html', true);
    if (/^\/design-agent\/assets\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(pathname)) {
      return asset(request, env, pathname.slice(root.length), false);
    }
  }
  return new Response('Not found', { status: 404, headers: responseHeaders });
}

export default { fetch: handle };
