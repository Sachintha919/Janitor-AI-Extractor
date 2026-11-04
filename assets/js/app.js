(() => {
"use strict";
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const state={character:{},assets:[],lorebooks:[],html:"",css:"",request:null,requestId:null,endpoint:"http://127.0.0.1:8787",poller:null};
const FIELD_MAP={
 name:["name","char_name","character_name","title"],
 description:["description","desc","char_description"],
 personality:["personality","persona"],
 scenario:["scenario","context"],
 first_mes:["first_mes","first_message","greeting","initial_message"],
 alternate_greetings:["alternate_greetings","greetings"],
 mes_example:["mes_example","example_dialogue","example_messages"],
 creator_notes:["creator_notes","notes"],
 system_prompt:["system_prompt","system"],
 post_history_instructions:["post_history_instructions","jailbreak","jailbreak_prompt"],
 creator:["creator","author"], character_version:["character_version","version"], tags:["tags"]
};
const LABELS={name:"Character name",description:"Description",personality:"Personality",scenario:"Scenario",first_mes:"First message",alternate_greetings:"Alternate greetings",mes_example:"Example dialogue",creator_notes:"Creator notes",system_prompt:"System prompt",post_history_instructions:"Post-history instructions",creator:"Creator",character_version:"Version",tags:"Tags"};
function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("is-visible");clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove("is-visible"),3000)}
function download(name,data,type="text/plain;charset=utf-8"){const blob=new Blob([data],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function safeName(s){return String(s||"character").normalize("NFKD").replace(/[^a-z0-9_-]+/gi,"-").replace(/^-|-$/g,"").slice(0,70)||"character"}
function textValue(v){if(v==null)return "";if(Array.isArray(v))return v.map(x=>typeof x==="string"?x:JSON.stringify(x,null,2)).join("\n\n");if(typeof v==="object")return JSON.stringify(v,null,2);return String(v)}
function deepFind(obj,keys,depth=0){if(!obj||typeof obj!=="object"||depth>7)return undefined;for(const k of keys)if(Object.prototype.hasOwnProperty.call(obj,k)&&obj[k]!=null&&obj[k]!=="")return obj[k];for(const v of Object.values(obj)){if(v&&typeof v==="object"){const got=deepFind(v,keys,depth+1);if(got!==undefined)return got}}}
function collectAssets(obj){const found=new Map(),books=[];const imageKey=/^(avatar|image|image_url|img|thumbnail|background|cover|icon|url)$/i;const walk=(v,path="",depth=0)=>{if(!v||typeof v!=="object"||depth>9)return;if(Array.isArray(v)){v.forEach((x,i)=>walk(x,path+"["+i+"]",depth+1));return}
for(const [k,val] of Object.entries(v)){if(/lore.?book|world.?info|character.?book/i.test(k)&&val&&typeof val==="object")books.push({name:k,data:val});
if(typeof val==="string"&&/^https?:\/\//i.test(val)&&(/image|avatar|thumbnail|background|cover|icon|photo/i.test(k)||/\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(val))){found.set(val,{url:val,label:k||"Image",source:path})}
else if(typeof val==="object")walk(val,path?path+"."+k:k,depth+1);
}}
;walk(obj);return {assets:[...found.values()],books};}
function parseSource(raw){
 let obj=null,html=raw,parseError="";
 try{obj=JSON.parse(raw)}catch(e){parseError=e.message}
 if(!obj){const match=raw.match(/<script[^>]+type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i);if(match){try{obj=JSON.parse(match[1])}catch{}}}
 const data=obj?.data&&typeof obj.data==="object"?obj.data:obj;
 const character={};
 for(const [field,aliases] of Object.entries(FIELD_MAP)){const value=deepFind(data,aliases);if(value!==undefined)character[field]=value}
 if(!character.name){const m=raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);if(m)character.name=m[1].replace(/<[^>]+>/g,"").trim()}
 if(!character.description){const m=raw.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i);if(m)character.description=m[1]}
 const {assets,books}=obj?collectAssets(obj):{assets:[],books:[]};
 const imageMatches=[...raw.matchAll(/(?:src|content|href)=["'](https?:\/\/[^"']+\.(?:png|jpe?g|gif|webp|avif)(?:\?[^"']*)?)["']/gi)];
 for(const m of imageMatches)if(!assets.some(a=>a.url===m[1]))assets.push({url:m[1],label:"Image",source:"HTML"});
 const loreMatch=raw.match(/<script[^>]+id=["'][^"']*(?:lore|world)[^"']*["'][^>]*>([\s\S]*?)<\/script>/i);
 if(loreMatch){try{books.push({name:"Embedded lorebook",data:JSON.parse(loreMatch[1])})}catch{}}
 const htmlMatch=raw.match(/<!--[\s\S]*?CARD_HTML_START[\s\S]*?-->([\s\S]*?)<!--[\s\S]*?CARD_HTML_END[\s\S]*?-->/i);
 const cssMatch=raw.match(/<!--[\s\S]*?CARD_CSS_START[\s\S]*?-->([\s\S]*?)<!--[\s\S]*?CARD_CSS_END[\s\S]*?-->/i);
 return {character,assets,books,html:htmlMatch?.[1]?.trim()||"",css:cssMatch?.[1]?.trim()||"",isHtml:/<([a-z][\s\S]*?)>/i.test(html),parseError};
}
function characterCard(){const c=state.character;return {spec:"chara_card_v2",spec_version:"2.0",data:{name:textValue(c.name),description:textValue(c.description),personality:textValue(c.personality),scenario:textValue(c.scenario),first_mes:textValue(c.first_mes),mes_example:textValue(c.mes_example),creator_notes:textValue(c.creator_notes),system_prompt:textValue(c.system_prompt),post_history_instructions:textValue(c.post_history_instructions),alternate_greetings:Array.isArray(c.alternate_greetings)?c.alternate_greetings:textValue(c.alternate_greetings).split(/\n\s*\n/).filter(Boolean),tags:Array.isArray(c.tags)?c.tags:textValue(c.tags).split(",").map(x=>x.trim()).filter(Boolean),creator:textValue(c.creator),character_version:textValue(c.character_version),extensions:{}}}}
function setEnabled(ids,on){ids.forEach(id=>{const e=$("#"+id);if(e)e.disabled=!on})}
function renderFields(){const host=$("#definition-fields");const entries=Object.entries(LABELS).filter(([k])=>state.character[k]!==undefined&&textValue(state.character[k])!=="");if(!entries.length){host.innerHTML='<div class="empty-card surface compact-empty"><h3>No definition fields detected</h3><p>Try importing a character card JSON or pasted text with labels such as Personality:, Scenario: and First message:.</p></div>';setEnabled(["download-txt","download-json","download-card"],false);return}
host.innerHTML=entries.map(([key,label])=>'<label class="definition-field surface"><span>'+label+'</span><textarea data-field="'+key+'" spellcheck="false">'+escapeHTML(textValue(state.character[key]))+'</textarea></label>').join("");
$$("[data-field]",host).forEach(el=>el.addEventListener("input",()=>{state.character[el.dataset.field]=el.value}));
setEnabled(["download-txt","download-json","download-card"],true)}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function renderAssets(){const host=$("#asset-results");$("#asset-count").textContent=state.assets.length+state.lorebooks.length;
if(!state.assets.length&&!state.lorebooks.length){host.innerHTML='<div class="empty-card surface compact-empty"><div class="asset-icon asset-violet">▧</div><h3>No assets imported</h3><p>Import character JSON or HTML containing accessible image links or lorebook data.</p></div>';setEnabled(["download-lorebook","download-assets-zip"],false);return}
let html='<div class="asset-grid">';
state.assets.forEach((a,i)=>{html+='<article class="asset-card surface"><img class="asset-thumb" src="'+escapeHTML(a.url)+'" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'"><h3>'+escapeHTML(a.label)+'</h3><p class="asset-url">'+escapeHTML(a.url)+'</p><button class="button button-quiet" data-asset="'+i+'">Download image</button></article>'});
state.lorebooks.forEach((b,i)=>{html+='<article class="asset-card surface"><div class="asset-icon asset-teal">▤</div><h3>'+escapeHTML(b.name)+'</h3><p>Imported lorebook / world-info data.</p><button class="button button-quiet" data-book="'+i+'">Download JSON</button></article>'});
host.innerHTML=html+'</div>';
$$("[data-asset]",host).forEach(b=>b.addEventListener("click",()=>downloadAsset(state.assets[+b.dataset.asset])));
$$("[data-book]",host).forEach(b=>b.addEventListener("click",()=>download(safeName(state.lorebooks[+b.dataset.book].name)+".json",JSON.stringify(state.lorebooks[+b.dataset.book].data,null,2),"application/json")));
setEnabled(["download-lorebook","download-assets-zip"],state.lorebooks.length>0||state.assets.length>0)}
async function downloadAsset(asset){try{const r=await fetch(asset.url,{mode:"cors"});if(!r.ok)throw Error("HTTP "+r.status);const blob=await r.blob();const a=document.createElement("a"),u=URL.createObjectURL(blob);a.href=u;a.download=(safeName(asset.label)||"asset")+extensionFor(blob.type,asset.url);document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000)}catch{window.open(asset.url,"_blank","noopener");toast("The host blocked direct download. Opened the original image in a new tab instead.")}}
function extensionFor(type,url){const ext=(url.match(/\.(png|jpe?g|gif|webp|avif)(?:\?|$)/i)||[])[1];return ext?"."+ext.toLowerCase():(type.includes("png")?".png":type.includes("webp")?".webp":".img")}
function updatePreview(){state.html=$("#card-html").value;state.css=$("#card-css").value;const doc='<!doctype html><html><head><meta charset="utf-8"><style>body{margin:12px;background:#f5f5f5;color:#222;font:14px sans-serif}'+state.css+'</style></head><body>'+state.html+'</body></html>';$("#card-preview").srcdoc=doc;setEnabled(["download-html"],!!state.html);setEnabled(["download-css"],!!state.css)}
function applyParsed(result){state.character=result.character;state.assets=result.assets;state.lorebooks=result.books;if(result.html)$("#card-html").value=result.html;if(result.css)$("#card-css").value=result.css;renderFields();renderAssets();updatePreview();const n=Object.keys(state.character).length;$("#parse-message").textContent="Imported "+n+" definition field(s), "+state.assets.length+" image(s), and "+state.lorebooks.length+" lorebook item(s).";$("#parse-message").classList.add("is-visible");toast("Import processed in this browser session.")}
function labeledText(raw){const keys={name:"name",description:"description",personality:"personality",persona:"personality",scenario:"scenario",firstmessage:"first_mes",first_mes:"first_mes",greeting:"first_mes",exampledialogue:"mes_example",mes_example:"mes_example",systemprompt:"system_prompt",system_prompt:"system_prompt",posthistoryinstructions:"post_history_instructions",creatornotes:"creator_notes"};const out={};const lines=raw.split(/\r?\n/);let current=null;for(const line of lines){const m=line.match(/^\s*([\w -]{2,35})\s*:\s*(.*)$/);const key=m?.[1].toLowerCase().replace(/[\s-]/g,"");if(m&&keys[key]){current=keys[key];out[current]=m[2]}else if(current&&line.trim())out[current]+="\n"+line}return out}
function inspectRequest(obj){if(!obj||typeof obj!=="object")throw Error("Request JSON must be an object.");const messages=Array.isArray(obj.messages)?obj.messages:[];state.request=obj;state.requestId=obj.id||null;renderRequest(messages,obj);setEnabled(["download-request-txt","download-request-json"],true)}
function renderRequest(messages,obj){const el=$("#request-display");if(!messages.length){el.innerHTML='<h3>Request received</h3><p>No messages array found. Raw request can still be downloaded as JSON.</p>'}else{el.innerHTML='<div class="message-list">'+messages.map((m,i)=>'<article class="message-item"><div><b>'+escapeHTML(String(m.role||"message").toUpperCase())+'</b><span>#'+(i+1)+'</span></div><pre>'+escapeHTML(textValue(m.content??m))+'</pre></article>').join("")+'</div>'}
$("#request-subtitle").textContent="Captured "+messages.length+" message(s) · "+new Date().toLocaleTimeString();$("#request-status").innerHTML="<i></i> Request captured";$("#request-status").classList.add("captured");}
async function connectReceiver(){const base=$("#endpoint-url").value.trim().replace(/\/$/,"");state.endpoint=base;try{const r=await fetch(base+"/health",{cache:"no-store"});if(!r.ok)throw Error("Server returned "+r.status);const data=await r.json();$("#request-status").innerHTML="<i></i> Connected";$("#request-status").classList.add("captured");$("#request-subtitle").textContent="Receiver online · "+(data.mode||"temporary memory");$("#connection-label").textContent="Local receiver connected";if(state.poller)clearInterval(state.poller);state.poller=setInterval(pollReceiver,1800);await pollReceiver();toast("Receiver connected.")}catch(e){$("#request-status").innerHTML="<i></i> Offline";$("#request-status").classList.remove("captured");$("#request-subtitle").textContent="Cannot reach receiver: "+e.message;$("#connection-label").textContent="Receiver offline";toast("Could not connect. Start the Node receiver first.")}}
async function pollReceiver(){try{const r=await fetch(state.endpoint+"/api/latest",{cache:"no-store"});if(!r.ok)return;const d=await r.json();if(d.request&&d.id!==state.requestId){state.requestId=d.id;inspectRequest(d.request)}}catch{}}
function bind(id,fn){const e=$("#"+id);if(e)e.addEventListener("click",fn)}
function init(){
$$(".nav-link").forEach(b=>b.addEventListener("click",()=>{const name=b.dataset.view;Object.entries({normal:"#normal-view",prompt:"#prompt-view"}).forEach(([k,s])=>$(s).classList.toggle("is-active",k===name));$$(".nav-link").forEach(x=>x.classList.toggle("is-active",x===b));$("#crumb-current").textContent=name==="normal"?"Normal extraction":"Prompt capture"}));
$$(".tab").forEach(b=>b.addEventListener("click",()=>{$$(".tab").forEach(x=>{x.classList.toggle("is-active",x===b);x.setAttribute("aria-selected",String(x===b))});$$(".panel-view").forEach(p=>{const active=p.id===b.dataset.panel+"-panel";p.classList.toggle("is-active",active);p.hidden=!active})}));
$("#character-form").addEventListener("submit",e=>{e.preventDefault();try{const u=new URL($("#character-url").value);if(!/(^|\.)janitorai\.com$/i.test(u.hostname)||!u.pathname.includes("/characters/"))throw Error("Use a Janitor AI character page URL.");window.open(u.href,"_blank","noopener,noreferrer");$("#url-message").textContent="Opened the character page. To import its data, paste accessible content below; automatic signed-in page reading needs the future extension.";$("#url-message").classList.add("is-visible")}catch(err){$("#url-message").textContent=err.message;$("#url-message").classList.add("is-visible")}});
bind("parse-source",()=>{const raw=$("#source-data").value.trim();if(!raw){toast("Paste or import source content first.");return}const result=parseSource(raw);if(!Object.keys(result.character).length){Object.assign(result.character,labeledText(raw))}if(!result.html&&/<[a-z][\s\S]*>/i.test(raw)){$("#card-html").value=raw.slice(0,200000)}applyParsed(result)});
$("#source-file").addEventListener("change",async e=>{const f=e.target.files[0];if(f){$("#source-data").value=await f.text();toast("Loaded "+f.name+" — choose Extract fields to process it.")}});
bind("clear-source",()=>{$("#source-data").value="";$("#parse-message").classList.remove("is-visible")});
bind("download-txt",()=>download(safeName(state.character.name)+".txt",Object.entries(state.character).map(([k,v])=>(LABELS[k]||k)+"\n"+textValue(v)).join("\n\n")));
bind("download-json",()=>download(safeName(state.character.name)+".json",JSON.stringify(state.character,null,2),"application/json"));
bind("download-card",()=>download(safeName(state.character.name)+"-character-card.json",JSON.stringify(characterCard(),null,2),"application/json"));
bind("download-lorebook",()=>download("lorebooks.json",JSON.stringify(state.lorebooks,null,2),"application/json"));
bind("download-assets-zip",()=>makeZip());
bind("download-html",()=>download("character-card.html",state.html,"text/html"));
bind("download-css",()=>download("character-card.css",state.css,"text/css"));
$("#card-html").addEventListener("input",updatePreview);$("#card-css").addEventListener("input",updatePreview);
bind("connect-endpoint",connectReceiver);
bind("inspect-request",()=>{try{inspectRequest(JSON.parse($("#manual-request").value));toast("Request inspected.")}catch(e){toast("Invalid request JSON: "+e.message)}});
bind("clear-manual",()=>$("#manual-request").value="");
bind("clear-request",async()=>{state.request=null;state.requestId=null;$("#request-display").innerHTML='<div class="radar"><span></span><b>⌁</b></div><h3>Capture cleared</h3><p>Waiting for the next request.</p>';setEnabled(["download-request-txt","download-request-json"],false);try{await fetch(state.endpoint+"/api/clear",{method:"POST"})}catch{}});
bind("download-request-json",()=>state.request&&download("captured-request.json",JSON.stringify(state.request,null,2),"application/json"));
bind("download-request-txt",()=>state.request&&download("captured-request.txt",(state.request.messages||[]).map(m=>"["+m.role+"]\n"+textValue(m.content)).join("\n\n")));
bind("help-button",()=>toast("Import accessible JSON/HTML/text. Prompt capture requires the optional local Node receiver."));
if($("#request-display"))setEnabled(["download-request-txt","download-request-json"],false);
}
async function makeZip(){const files=[];for(const a of state.assets){try{const r=await fetch(a.url);if(!r.ok)continue;files.push({name:"images/"+safeName(a.label)+extensionFor(r.headers.get("content-type")||"",a.url),data:new Uint8Array(await r.arrayBuffer())})}catch{}}
state.lorebooks.forEach((b,i)=>files.push({name:"lorebooks/"+safeName(b.name||"lorebook-"+i)+".json",data:new TextEncoder().encode(JSON.stringify(b.data,null,2))}));
if(!files.length){toast("No downloadable assets were fetched. Individual image links may still be opened.");return}
const blob=zipStore(files);const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download="character-assets.zip";a.click();setTimeout(()=>URL.revokeObjectURL(u),1500);toast("ZIP archive created.")}
function crc32(bytes){let c=~0;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(~c)>>>0}
function zipStore(files){const enc=new TextEncoder(),parts=[],central=[];let offset=0;for(const f of files){const name=enc.encode(f.name),data=f.data,crc=crc32(data),h=new Uint8Array(30+name.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);h.set(name,30);parts.push(h,data);const c=new Uint8Array(46+name.length),d=new DataView(c.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint32(16,crc,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);c.set(name,46);central.push(c);offset+=h.length+data.length}const centralSize=central.reduce((n,x)=>n+x.length,0),end=new Uint8Array(22),dv=new DataView(end.buffer);dv.setUint32(0,0x06054b50,true);dv.setUint16(8,files.length,true);dv.setUint16(10,files.length,true);dv.setUint32(12,centralSize,true);dv.setUint32(16,offset,true);return new Blob([...parts,...central,end],{type:"application/zip"})}
document.addEventListener("DOMContentLoaded",init);
})();