// The edit operates on quantized JPEG blocks of a pinned, already-reviewed photograph.
// All blocks outside the front overlap keep their original DC and AC coefficients.
const specs = {
  garment: {sha:'45ce7e0ab7a6f60bf5480da6c5f3186ab3df64068f083e6cf6590741b0b540bc',left:352,top:512,width:64,height:392},
  detail: {sha:'edb6746e461d819a0ec6815fa51848840864bd38465fc12b8f6bbd209110380a'},
  'on-body': {sha:'6cf7bd4ffce7edf35b285ead5781f09f67bc5cee92720f23418e14dda558f187',left:576,top:512,width:48,height:240},
};
export function placketEditInfo(key,referenceHash) {
  const spec=specs[key];
  if (!spec || spec.sha!==referenceHash) return null;
  if (key==='detail') return {editMethod:'unchanged-detail-reference',editRegion:null,lockedRegion:null,
    source:'ImageGen 已核同款细节沿用',note:'沿用已核对的同款袋口特写。门襟不在画面内，本视角没有重新生成。'};
  const {left,top,width,height}=spec;
  const area={left,top,width,height};
  return {editMethod:'local-placket-edit',editRegion:area,lockedRegion:area,
    source:'ImageGen 参考图局部结构示意',note:'仅调整可见门襟边缘的局部示意，矩形外保留原图像素。实际叠合宽度以同版图纸及样衣为准。'};
}
export function canConstrainPlacket(solution,key,sourceView,feedback) {
  const change=solution.cad.placketWidth-30;
  if (solution.scene!=='group' || solution.version<=1 || Math.abs(change)<4 || Math.abs(change)>10 ||
      !placketEditInfo(key,sourceView?.sha256)) return false;
  // A separate free-form change to the person, cloth, construction or scene needs a new render.
  if (!feedback?.trim()) return true;
  return feedback.length<=180 && /去掉|移除|删除|不要|不应出现|不能出现|禁止/u.test(feedback) &&
    /胸袋|胸部口袋|袖扣|明扣/u.test(feedback) &&
    /^(?:请|务必|全部|仅|把|将|去掉|移除|删除|不要|不应出现|不能出现|禁止|出现|额外|新增|多出|外露|的|任何|胸袋|胸部口袋|袖扣|明扣|和|与|及|也|再|[，,、。；;！!\s])+$/u.test(feedback);
}
function fail() { throw new Error('Unsupported source JPEG for the constrained placket edit'); }
function huffman(counts,values) {
  const table=new Uint16Array(65536);
  let code=0,index=0;
  for (let len=1;len<=16;len++) {
    code*=2;
    for(let i=0;i<counts[len-1];i++,code++){
      const start=code<<(16-len), end=(code+1)<<(16-len);
      table.fill((len<<8)|values[index++],start,end);
    }
  }
  return table;
}
function readHeader(bytes) {
  const tables=new Map(),components=new Map(),quantizers=new Map();
  let width,height,maxH=0,maxV=0;
  for(let pos=2;pos+3<bytes.length;){
    const marker=(bytes[pos]<<8)|bytes[pos+1], size=(bytes[pos+2]<<8)|bytes[pos+3], end=pos+2+size;
    let k=pos+4;
    if(size<2||end>bytes.length)fail();
    if(marker===0xffc4){
      while(k<end){
        const id=bytes[k++], counts=bytes.subarray(k,k+16);
        k+=16;
        const n=counts.reduce((a,b)=>a+b,0);
        tables.set(id,huffman(counts,bytes.subarray(k,k+n)));k+=n;
      }
    }else if(marker===0xffdb){
      while(k<end){const id=bytes[k++];if(id>3)fail();quantizers.set(id,bytes.slice(k,k+64));k+=64;}
    }else if(marker===0xffc0){
      if(bytes[k++]!==8)fail();
      height=bytes[k++]*256+bytes[k++];width=bytes[k++]*256+bytes[k++];
      const n=bytes[k++];
      for(let i=0;i<n;i++){
        const id=bytes[k++],sampling=bytes[k++],quant=bytes[k++];
        const h=sampling>>4,v=sampling&15;maxH=Math.max(maxH,h);maxV=Math.max(maxV,v);
        components.set(id,{id,h,v,quant});
      }
    }else if(marker===0xffdd||marker===0xffc2){fail();}
    else if(marker===0xffda){
      if(!width||!height||width>1600||height>1600)fail();
      const n=bytes[k++], scans=[];
      for(let i=0;i<n;i++){
        const comp=components.get(bytes[k++]),ids=bytes[k++];
        if(!comp||comp.h!==maxH||comp.v!==maxV)fail();
        scans.push({...comp,quant:quantizers.get(comp.quant),dcId:ids>>4,acId:ids&15,dcTable:tables.get(ids>>4),acTable:tables.get(16+(ids&15))});
      }
      if(scans.length!==3||bytes[k++]!==0||bytes[k++]!==63||bytes[k]!==0)fail();
      return {width,height,maxH,maxV,scans,sos:pos,start:end};
    }
    pos=end;
  }
  fail();
}
function entropyBytes(bytes,start) {
  const data=new Uint8Array(bytes.length-start+3);
  let out=0;
  for(let i=start;i<bytes.length;i++){
    const b=bytes[i];
    if(b===255){
      const next=bytes[++i];if(next===217)break;
      if(next!==0)fail();
    }
    data[out++]=b;
  }
  return data;
}
function forwardBlocks(header,fn) {
  const mx=Math.ceil(header.width/(8*header.maxH)),my=Math.ceil(header.height/(8*header.maxV));
  const nx=mx*header.maxH;
  for(let y=0;y<my;y++)for(let x=0;x<mx;x++)for(const s of header.scans){
    for(let row=0;row<s.v;row++)for(let col=0;col<s.h;col++){
      const bx=x*s.h+col,by=y*s.v+row;
      fn(s,by*nx+bx,bx,by);
    }
  }
}
const bitRead=(bytes,bit,count)=>{
  const b=bit>>>3, value=(bytes[b]<<16)|(bytes[b+1]<<8)|bytes[b+2];
  return (value>>>(24-(bit&7)-count))&((1<<count)-1);
};
function dissect(header,bytes) {
  const n=Math.ceil(header.width/(8*header.maxH))*header.maxH*Math.ceil(header.height/(8*header.maxV))*header.maxV;
  let bit=0;
  function symbol(table) {
    const entry=table[bitRead(bytes,bit,16)];
    if(!entry)fail();bit+=entry>>8;return entry&255;
  }
  for(const s of header.scans){s.dc=new Int16Array(n);s.start=new Uint32Array(n);s.end=new Uint32Array(n);s.last=0;}
  forwardBlocks(header,(s,i)=>{
    const size=symbol(s.dcTable),raw=bitRead(bytes,bit,size);bit+=size;
    s.last+=size&&raw<(1<<(size-1))?raw-((1<<size)-1):raw;
    s.dc[i]=s.last;s.start[i]=bit;
    for(let k=1;k<64;){
      const ac=symbol(s.acTable);
      if(ac===0)break;
      if(ac===240){k+=16;continue;}
      k+=(ac>>4)+1;bit+=ac&15;
    }
    s.end[i]=bit;
  });
}
const zig=[0,1,8,16,9,2,3,10,17,24,32,25,18,11,4,5,12,19,26,33,40,48,41,34,27,20,13,6,7,14,21,28,35,42,49,56,57,50,43,36,29,22,15,23,30,37,44,51,58,59,52,45,38,31,39,46,53,60,61,54,47,55,62,63];
const matrix=Array.from({length:8},(_,x)=>Array.from({length:8},(_,u)=>0.5*(u?1:Math.SQRT1_2)*Math.cos((2*x+1)*u*Math.PI/16)));
const transposed=matrix.map((row,i)=>row.map((_,j)=>matrix[j][i]));
function transformBlock(input,coeff){
  const tmp=new Float64Array(64),result=new Float64Array(64);
  for(let y=0;y<8;y++)for(let x=0;x<8;x++)for(let u=0;u<8;u++)tmp[8*y+x]+=coeff[x][u]*input[8*y+u];
  for(let y=0;y<8;y++)for(let x=0;x<8;x++)for(let v=0;v<8;v++)result[8*y+x]+=coeff[y][v]*tmp[8*v+x];
  return result;
}
function originalAc(raw,s,i,visit){
  for(let bit=s.start[i];bit<s.end[i];){
    const entry=s.acTable[bitRead(raw,bit,16)],ac=entry&255,size=ac&15;
    bit+=entry>>8;
    const val=bitRead(raw,bit,size);bit+=size;visit(ac,val);
  }
}
function smooth(r) {const t=Math.max(0,Math.min(1,r));return t*t*(3-2*t);}
function warpedBlocks(header,raw,region,delta) {
  const columns=Math.ceil(header.width/(8*header.maxH))*header.maxH;
  const {left,top,width,height}=region;
  for(const s of header.scans){
    const pixels=new Float64Array(width*height);
    const blockIndex=(x,y)=>((top+y)/8)*columns+(left+x)/8;
    for(let y=0;y<height;y+=8)for(let x=0;x<width;x+=8){
      const i=blockIndex(x,y),coeff=new Float64Array(64);coeff[0]=s.dc[i]*s.quant[0];
      let k=1;
      originalAc(raw,s,i,(ac,v)=>{
        if(!ac)return;
        if(ac===240){k+=16;return;}
        k+=ac>>4;const size=ac&15;
        coeff[zig[k]]=(v<(1<<(size-1))?v-((1<<size)-1):v)*s.quant[k];k++;
      });
      const decoded=transformBlock(coeff,matrix);
      for(let by=0;by<8;by++)pixels.set(decoded.subarray(by*8,by*8+8),(y+by)*width+x);
    }
    s.changed=new Map();
    for(let y=0;y<height;y+=8)for(let x=0;x<width;x+=8){
      const values=new Float64Array(64);
      for(let by=0;by<8;by++)for(let bx=0;bx<8;bx++){
        const py=y+by,px=x+bx;
        const influence=smooth(Math.min(py,height-1-py)/66)*smooth(Math.min(px,width-1-px)/14);
        const sample=Math.max(0,Math.min(width-1,px+delta*0.9*influence));
        const a=Math.floor(sample),b=Math.min(width-1,a+1);
        values[by*8+bx]=pixels[py*width+a]*(1-(sample-a))+pixels[py*width+b]*(sample-a);
      }
      const dct=transformBlock(values,transposed);
      s.changed.set(blockIndex(x,y),Int16Array.from(zig,(p,k)=>Math.round(dct[p]/s.quant[k])));
    }
  }
}
function writeScan(header,raw,region,delta) {
  warpedBlocks(header,raw,region,delta);
  const out=[];let waiting=0,pending=0;
  function bits(v,n){
    pending=(pending<<n)|v;waiting+=n;
    while(waiting>=8){waiting-=8;const value=(pending>>>waiting)&255;out.push(value);if(value===255)out.push(0);}
    pending &= (1<<waiting)-1;
  }
  for(const s of header.scans)s.last=0;
  // Use a complete canonical AC table: interpolation can introduce a run that the optimized source table omitted.
  const acBits=(ac,v)=>{
    const size=ac&15;
    bits(ac===0?0:ac===240?1:2+(ac>>4)*10+size-1,8);
    if(size)bits(v,size);
  };
  forwardBlocks(header,(s,i)=>{
    const changed=s.changed.get(i),dc=changed ? changed[0] : s.dc[i];
    const diff=dc-s.last;s.last=dc;
    const cat=diff ? 32-Math.clz32(Math.abs(diff)) : 0;
    if(cat>11)fail();
    bits(cat,4);
    if(cat)bits(diff<0?diff+((1<<cat)-1):diff,cat);
    if(!changed){originalAc(raw,s,i,acBits);return;}
    let zeros=0;
    for(let k=1;k<64;k++){
      const v=changed[k];
      if(!v){zeros++;continue;}
      while(zeros>=16){acBits(240,0);zeros-=16;}
      const size=32-Math.clz32(Math.abs(v));if(size>10)fail();
      acBits((zeros<<4)|size,v<0?v+((1<<size)-1):v);zeros=0;
    }
    if(zeros)acBits(0,0);
  });
  if(waiting)bits((1<<(8-waiting))-1,8-waiting);
  return Uint8Array.from(out);
}
function completeHuffmanTables(scans) {
  // A shifted neighbour can create a DC difference absent from an optimized source table.
  const body=[];
  for(const id of new Set(scans.map(s=>s.dcId))){
    body.push(id,0,0,0,12,...new Array(12).fill(0));
    for(let i=0;i<=11;i++)body.push(i);
  }
  for(const id of new Set(scans.map(s=>s.acId))){
    body.push(16|id,0,0,0,0,0,0,0,162,0,0,0,0,0,0,0,0,0,240);
    for(let run=0;run<16;run++)for(let size=1;size<=10;size++)body.push((run<<4)|size);
  }
  const length=body.length+2;
  return Uint8Array.from([255,196,length>>8,length&255,...body]);
}
export function editPlacket(sourceView,delta) {
  const info=placketEditInfo(sourceView.key,sourceView.sha256);
  if(!info)fail();
  if(!info.editRegion)return {bytes:sourceView.bytes,...info};
  const input=sourceView.bytes,header=readHeader(input),raw=entropyBytes(input,header.start);
  dissect(header,raw);
  const scan=writeScan(header,raw,info.editRegion,delta),tables=completeHuffmanTables(header.scans);
  const result=new Uint8Array(header.start+tables.length+scan.length+2);
  result.set(input.subarray(0,header.sos));
  result.set(tables,header.sos);
  result.set(input.subarray(header.sos,header.start),header.sos+tables.length);
  result.set(scan,header.start+tables.length);
  result.set([255,217],result.length-2);
  return {bytes:result,...info};
}
