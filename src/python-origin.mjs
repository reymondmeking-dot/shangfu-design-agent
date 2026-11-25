// Only the deployment config chooses the origin. Never forward browser headers or cookies.
export async function pythonRequest(env, path, body, method = body === undefined ? 'GET' : 'POST') {
  const base = new URL(env.SHANGFU_ORIGIN);
  const loopback = ['localhost','127.0.0.1','[::1]'].includes(base.hostname);
  if ((base.protocol !== 'https:' && !(loopback && base.protocol === 'http:')) ||
      base.username || base.password || base.search || base.hash || (!loopback && !env.SHANGFU_SERVICE_TOKEN)) {
    throw Object.assign(new Error('业务服务地址或授权未配置。'),{status:503,expose:true});
  }
  const url = new URL('/v1' + path,base);
  const headers = { Accept: '*/*' };
  if (env.SHANGFU_SERVICE_TOKEN) headers.Authorization = 'Bearer ' + env.SHANGFU_SERVICE_TOKEN;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    const res = await fetch(url, {method,headers,
      body:body === undefined ? undefined : JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(95000)});
    const output = new Headers({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Agent-Backend':'fastapi',
      'Content-Type':res.headers.get('content-type') || 'application/octet-stream'});
    return new Response(res.body,{status:res.status,headers:output});
  } catch {
    throw Object.assign(new Error('业务服务暂未响应。请稍后重试同一项目。'),{status:503,expose:true,code:'PYTHON_ORIGIN_UNAVAILABLE'});
  }
}
