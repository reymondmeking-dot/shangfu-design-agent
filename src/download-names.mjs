function filePart(value, fallback, budget) {
  const clean=String(value || '').normalize('NFC').replace(/[<>:"/\\|?*_\u0000-\u001f\u007f]+/g,'-').trim();
  let text='', bytes=0;
  for (const char of clean) {
    const code=char.codePointAt(0);
    const width=code<128?1:code<2048?2:code<65536?3:4;
    if (bytes+width>budget) break;
    text+=code>=0xd800&&code<=0xdfff?'�':char;
    bytes+=width;
  }
  return text.replace(/[. ]+$/,'') || fallback;
}
function orderFileName(project, version, role, extension) {
  return filePart(project.title,'定制项目',72)+'_'+filePart(project.id,'未编号',84)+'_V'+version+'_'+role+'.'+extension;
}
const formats={
  xlsx:['业务台账','xlsx'], bundle:['内部工作包','zip'], delivery:['核对版交付包','zip'],
  svg:['款式图','svg'], dxf:['款式图','dxf'], json:['案例记录','json']
};
export function orderDisposition(project, version, kind, mode='attachment') {
  const [role,ext]=formats[kind];
  const full=orderFileName(project,version,role,ext);
  const id=filePart(project.id,'project',84).replace(/[^a-zA-Z0-9.-]/g,'-');
  const fallback=id+'-V'+version+(ext==='zip'?'-'+kind:'')+'.'+ext;
  const encoded=encodeURIComponent(full).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
  return mode+'; filename="'+fallback+'"'+ "; filename*=UTF-8''" + encoded;
}
