const basePath = '/design-agent';
const palettePath = basePath + '/assets/radix.css';
const cookieName = 'planto_design_session';
const ttl = 8 * 60 * 60;
const encoder = new TextEncoder();
const recent = new Map();

export function protectedDeployment(env) {
  return env.REQUIRE_PASSWORD === '1' || Boolean(env.ACCESS_PASSWORD_HASH);
}

const now = () => Math.floor(Date.now() / 1000);
const hex = bytes => Array.from(new Uint8Array(bytes), item=>item.toString(16).padStart(2,'0')).join('');

function constantEquals(left,right) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i=0;i<left.length;i++) mismatch |= left.charCodeAt(i)^right.charCodeAt(i);
  return mismatch===0;
}

async function key(env) {
  return crypto.subtle.importKey('raw',encoder.encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}

async function makeSession(env) {
  const body = (now()+ttl)+'.'+hex(crypto.getRandomValues(new Uint8Array(12)));
  const signature = await crypto.subtle.sign('HMAC',await key(env),encoder.encode(body));
  return body+'.'+hex(signature);
}

async function hasSession(request,env) {
  const cookie = request.headers.get('cookie')?.split(';').map(part=>part.trim()).find(part=>part.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if (!cookie || !/^\d{10}\.\w{24}\.[0-9a-f]{64}$/.test(cookie)) return false;
  const [expiry,nonce,signature] = cookie.split('.');
  if (Number(expiry) <= now() || Number(expiry) > now()+ttl+30) return false;
  const bytes = Uint8Array.from(signature.match(/../g),part=>parseInt(part,16));
  return await crypto.subtle.verify('HMAC',await key(env),bytes,encoder.encode(expiry+'.'+nonce));
}

const redirect = (where,extra={}) => new Response(null,{status:303,headers:{Location:where,'Cache-Control':'no-store',...extra}});
function cookie(request,value,max) {
  const https = new URL(request.url).protocol === 'https:';
  return cookieName+'='+value+'; Path='+basePath+'; Max-Age='+max+'; HttpOnly; SameSite=Strict'+(https?'; Secure':'');
}

function page(message='',status=200) {
  const messageMarkup = message ? '<p role="alert" class="error">'+message+'</p>' : '';
  return new Response(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>海派定制顾问</title><link rel="stylesheet" href="${palettePath}?v=3.0.0"><style>
*{box-sizing:border-box}
body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:20px;color:var(--sand-12);background:var(--sand-2);font:14px/1.5 "PingFang SC","Microsoft YaHei",sans-serif}
main{width:min(100%,400px);padding:32px;background:var(--sand-1);border:.5px solid var(--sand-6);border-radius:10px}
h1{font:600 34px/1.2 "Songti SC","SimSun",serif;color:var(--teal-12);margin:0 0 8px}
.group-name{font-size:12px;color:var(--sand-11);margin:0 0 26px}
form{display:grid;gap:8px}
input,button{width:100%;min-height:44px;padding:10px 12px;border-radius:5px;font:inherit}
input{background:var(--sand-1);border:.5px solid var(--sand-7);color:var(--sand-12)}
input:hover{border-color:var(--sand-8)}
input:focus-visible,button:focus-visible{outline:.5px solid var(--teal-11);outline-offset:3px}
button{border:0;background:var(--teal-9);color:var(--sand-12);margin-top:8px;font-weight:650;cursor:pointer}
button:active{background:var(--teal-12);color:var(--sand-1)}
@media(hover:hover) and (pointer:fine){button:hover:not(:active){background:var(--teal-10)}}
.error{margin:0 0 4px;color:var(--red-11)}
@media(max-width:390px){main{padding:24px}}
</style></head><body><main><h1>海派定制顾问</h1><p class="group-name">模拟定制工作台</p><form method="post" action="/design-agent/unlock">${messageMarkup}<label for="password">访问密码</label><input id="password" name="password" type="password" autocomplete="current-password" maxlength="128" required><button type="submit">进入工作台</button></form></main></body></html>`,{status,headers:{
    'Content-Type':'text/html; charset=utf-8',
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'same-origin',
    'Content-Security-Policy':"default-src 'none'; style-src 'self' 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'"
  }});
}

function reject(status,error) {
  return Response.json({error},{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}

async function loginBody(request) {
  if (!request.headers.get('content-type')?.includes('application/x-www-form-urlencoded') ||
      Number(request.headers.get('content-length')||0)>2048 || !request.body) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let output='', size=0;
  try {
    while(true) {
      const {value,done}=await reader.read();
      if(done) break;
      size+=value.byteLength;
      if(size>2048) {
        await reader.cancel();
        return null;
      }
      output+=decoder.decode(value,{stream:true});
    }
    return new URLSearchParams(output+decoder.decode()).get('password');
  } finally {
    reader.releaseLock();
  }
}

async function allowAttempt(request,env) {
  const IP = request.headers.get('CF-Connecting-IP') || 'local';
  if (env.LOGIN_LIMITER) {
    try {return (await env.LOGIN_LIMITER.limit({key:IP})).success;} catch {}
  }
  const tick=now(), last=recent.get(IP);
  if (last && last.until>tick) return ++last.count<=8;
  if (recent.size>=1024) {
    for (const [key,entry] of recent) if (entry.until<=tick) recent.delete(key);
    if (recent.size>=1024) recent.delete(recent.keys().next().value);
  }
  recent.set(IP,{until:tick+60,count:1});
  return true;
}

function sameOriginForm(request,origin) {
  const submittedOrigin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  if (site === 'cross-site') return false;
  // Forms opened before the login response policy changed can still send Origin: null.
  return !submittedOrigin || submittedOrigin === origin ||
    (submittedOrigin === 'null' && site === 'same-origin');
}
export async function accessGuard(request,env) {
  if (!protectedDeployment(env)) return null;
  const {pathname,origin} = new URL(request.url);
  if (pathname !== basePath && !pathname.startsWith(basePath+'/')) return null;
  if (pathname === palettePath && (request.method === 'GET' || request.method === 'HEAD')) return null;
  const isApi = pathname === basePath+'/api' || pathname.startsWith(basePath+'/api/');
  if (!/^[0-9a-f]{64}$/.test(env.ACCESS_PASSWORD_HASH??'') || (env.SESSION_SECRET?.length??0)<32) {
    return isApi ? reject(503,'访问验证尚未配置。') : page('访问验证尚未配置。',503);
  }
  if (pathname === basePath+'/unlock') {
    if (request.method === 'GET' || request.method === 'HEAD') return (await hasSession(request,env))?redirect(basePath):page();
    if (request.method !== 'POST') return reject(405,'请求方式无效。');
    if (!sameOriginForm(request,origin)) return page('请从当前页面登录。',403);
    if (!await allowAttempt(request,env)) return page('尝试过多，请稍后再试。',429);
    const supplied = await loginBody(request);
    if (!supplied || supplied.length>128) return page('请输入有效的访问密码。',400);
    const hashed = hex(await crypto.subtle.digest('SHA-256',encoder.encode(supplied)));
    if (!constantEquals(hashed,env.ACCESS_PASSWORD_HASH)) return page('访问密码错误，请重试。',401);
    return redirect(basePath,{'Set-Cookie':cookie(request,await makeSession(env),ttl)});
  }
  if (pathname === basePath+'/logout' && request.method === 'POST') {
    if (!sameOriginForm(request,origin)) return reject(403,'请从当前页面退出。');
    return redirect(basePath+'/unlock',{'Set-Cookie':cookie(request,'',0)});
  }
  if (await hasSession(request,env)) return null;
  return isApi ? reject(401,'请先输入访问密码。') : redirect(basePath+'/unlock');
}
