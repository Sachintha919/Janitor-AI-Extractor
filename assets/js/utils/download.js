export function safeFilename(value) {
  return String(value||"character").normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9_-]+/gi,"-").replace(/^-+|-+$/g,"").slice(0,72)||"character";
}
export function downloadBlob(filename,blob) {
  const url=URL.createObjectURL(blob),anchor=document.createElement("a");
  anchor.href=url;anchor.download=filename;anchor.rel="noopener";document.body.append(anchor);anchor.click();anchor.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1500);
}
export function downloadText(filename,content,mime="text/plain;charset=utf-8") {
  downloadBlob(filename,new Blob([content],{type:mime}));
}
export function zipStore(files) {
  const encoder=new TextEncoder(),local=[],central=[];let offset=0;
  for(const file of files) {
    const name=encoder.encode(file.name),data=file.data instanceof Uint8Array?file.data:new Uint8Array(file.data),crc=crc32(data);
    const header=new Uint8Array(30+name.length),v=new DataView(header.buffer);
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint32(14,crc,true);
    v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);header.set(name,30);local.push(header,data);
    const entry=new Uint8Array(46+name.length),c=new DataView(entry.buffer);
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint32(16,crc,true);
    c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);entry.set(name,46);central.push(entry);
    offset+=header.length+data.length;
  }
  const centralSize=central.reduce((sum,item)=>sum+item.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);
  v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);
  return new Blob([...local,...central,end],{type:"application/zip"});
}
function crc32(bytes) {
  let crc=0xffffffff;
  for(const byte of bytes) {crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (~crc)>>>0;
}
