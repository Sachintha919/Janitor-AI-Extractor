import {ExtensionBridge} from "./core/extension-bridge.js";
import {FIELD_SCHEMA,parseSource,readPNGCharacterCard,cloneData} from "./importers/character-importer.js";
import {downloadBlob,downloadText,safeFilename,zipStore} from "./utils/download.js";

const $=selector=>document.querySelector(selector),$$=selector=>[...document.querySelectorAll(selector)];
const state={character:{},extraFields:{},original:null,assets:[],lorebooks:[],sources:[],card:{html:"",css:""},sourceUrl:"",importedAt:null,captures:[],selectedCapture:null};
let bridge=null,captureEnabled=false,toastTimer=0;

function toast(message) {const el=$("#toast");el.textContent=message;el.classList.add("is-visible");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("is-visible"),3200);}
function esc(value) {return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function valueText(value) {return value===null||value===undefined?"":typeof value==="object"?JSON.stringify(value,null,2):String(value);}
function setEnabled(ids,on) {ids.forEach(id=>{if($("#"+id))$("#"+id).disabled=!on;});}
function badge(el,label,kind) {el.textContent=label;el.classList.add("status-badge");el.classList.remove("status-success","status-muted","status-warning");el.classList.add("status-"+kind);}
function message(id,text,error=false) {const el=$("#"+id);el.textContent=text;el.classList.add("is-visible");el.classList.toggle("is-error",error);}
function snapshot() {state.original={character:cloneData(state.character),extraFields:cloneData(state.extraFields),assets:cloneData(state.assets),lorebooks:cloneData(state.lorebooks),card:cloneData(state.card),sources:cloneData(state.sources),sourceUrl:state.sourceUrl};}
function currentDefinitions() {return {...cloneData(state.extraFields),...cloneData(state.character)};}
function displayField(value) {return valueText(value);}
function updateField(input,key,isExtra=false) {
  const target=isExtra?state.extraFields:state.character,old=target[key],raw=input.value;
  if(raw==="" ){target[key]="";return;}
  if(old&&typeof old==="object") {try{target[key]=JSON.parse(raw);}catch{target[key]=raw;}}
  else target[key]=raw;
}
function renderDefinitions() {
  const html=FIELD_SCHEMA.map(field=>{
    const value=state.character[field.key],available=value!==undefined&&value!==null&&value!=="";
    return '<label class="definition-field surface"><span class="definition-label">'+esc(field.label)+'</span><small class="field-availability '+(available?"is-available":"")+'">'+(available?"Imported":"Not available in source")+'</small><textarea data-field="'+esc(field.key)+'" spellcheck="false" placeholder="Not available in imported data">'+esc(displayField(value))+'</textarea>'+(field.kind==="json"?'<small class="editor-hint">Edit arrays and objects as valid JSON to retain their structure.</small>':"")+"</label>";
  }).join("");
  const extra=Object.entries(state.extraFields).map(([key,value])=>'<article class="definition-field surface extra-field"><div class="extra-field-heading"><span class="definition-label">'+esc(key)+'</span><button class="icon-button danger" type="button" data-remove-extra="'+esc(key)+'" aria-label="Remove field">×</button></div><textarea data-extra="'+esc(key)+'" spellcheck="false">'+esc(displayField(value))+'</textarea><small class="editor-hint">Additional source field.</small></article>').join("");
  $("#definition-fields").innerHTML=html+extra;
  $$("[data-field]").forEach(input=>input.addEventListener("input",()=>{updateField(input,input.dataset.field);input.closest(".definition-field").querySelector(".field-availability").textContent="Edited in this session";input.closest(".definition-field").querySelector(".field-availability").classList.add("is-available");}));
  $$("[data-extra]").forEach(input=>input.addEventListener("input",()=>updateField(input,input.dataset.extra,true)));
  $$("[data-remove-extra]").forEach(button=>button.addEventListener("click",()=>{delete state.extraFields[button.dataset.removeExtra];renderDefinitions();}));
  const has=Object.keys(state.character).length||Object.keys(state.extraFields).length;
  setEnabled(["download-txt","download-json","download-card","download-session"],Boolean(has));
}
function renderAssets() {
  const assets=state.assets,books=state.lorebooks;
  $("#asset-count").textContent=String(assets.length+books.length);
  setEnabled(["download-lorebook"],books.length>0);setEnabled(["download-assets-zip"],assets.length+books.length>0);
  if(!assets.length&&!books.length){$("#asset-results").innerHTML='<div class="empty-card surface compact-empty"><div class="asset-icon asset-violet">▧</div><h3>No assets imported</h3><p>Import a supported source or local image file to display assets here.</p></div>';return;}
  const imageHtml=assets.map((asset,i)=>'<article class="asset-card surface"><div class="asset-preview-wrap"><img class="asset-thumb" src="'+esc(asset.url)+'" alt="'+esc(asset.label||"Image")+'" loading="lazy" referrerpolicy="no-referrer"></div><h3>'+esc(asset.label||"Image")+'</h3><p class="asset-url">'+esc(asset.url.length>150?asset.url.slice(0,147)+"…":asset.url)+'</p><div class="asset-actions"><button class="button button-quiet" data-asset="'+i+'" type="button">Download image</button><a class="text-link" href="'+esc(asset.url)+'" target="_blank" rel="noopener noreferrer">Open source</a></div></article>').join("");
  const bookHtml=books.map((book,i)=>'<article class="asset-card surface"><div class="asset-icon asset-teal">▤</div><h3>'+esc(book.name||"Lorebook")+'</h3><p>Imported lorebook / world-info object.</p><button type="button" class="button button-quiet" data-book="'+i+'">Download JSON</button></article>').join("");
  $("#asset-results").innerHTML='<div class="asset-grid">'+imageHtml+bookHtml+"</div>";
  $$("[data-asset]").forEach(button=>button.addEventListener("click",async()=>{const asset=assets[Number(button.dataset.asset)];try{const response=await fetch(asset.url,{mode:"cors",credentials:"omit"});if(!response.ok)throw new Error("HTTP "+response.status);const blob=await response.blob();const ext=(asset.url.match(/\.(png|jpe?g|gif|webp|avif|svg)(?:[?#]|$)/i)||[])[1]||"img";downloadBlob(safeFilename(asset.label)+"."+ext,blob);}catch{window.open(asset.url,"_blank","noopener,noreferrer");toast("Direct download was blocked; opened the source instead.");}}));
  $$("[data-book]").forEach(button=>button.addEventListener("click",()=>{const book=books[Number(button.dataset.book)];downloadText(safeFilename(book.name||"lorebook")+".json",JSON.stringify(book.data,null,2),"application/json;charset=utf-8");}));
}
function updateCard() {
  state.card.html=$("#card-html").value;state.card.css=$("#card-css").value;
  const html='<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src https: data:; style-src \'unsafe-inline\' https:; font-src https: data:;"><style>body{margin:14px;background:#f5f5f5;color:#222;font:14px/1.5 Arial,sans-serif}'+state.card.css+"</style></head><body>"+state.card.html+"</body></html>";
  $("#card-preview").srcdoc=html;setEnabled(["download-html"],Boolean(state.card.html));setEnabled(["download-css"],Boolean(state.card.css));
}
function refresh() {
  renderDefinitions();renderAssets();$("#card-html").value=state.card.html;$("#card-css").value=state.card.css;updateCard();
  $("#source-summary").textContent=state.importedAt?"Last imported "+new Date(state.importedAt).toLocaleString():"No source imported";
  setEnabled(["download-original"],state.sources.length>0);
}
function applyImport(result) {
  Object.assign(state.character,result.character||{});Object.assign(state.extraFields,result.extraFields||{});
  state.assets.push(...(result.assets||[]));state.lorebooks.push(...(result.lorebooks||[]));
  state.assets=[...new Map(state.assets.map(item=>[item.url,item])).values()];
  state.lorebooks=[...new Map(state.lorebooks.map(item=>[(item.name||"book")+JSON.stringify(item.data),item])).values()];
  if(result.html)state.card.html=result.html;if(result.css)state.card.css=result.css;if(result.sourceUrl)state.sourceUrl=result.sourceUrl;
  if(result.rawText!==undefined)state.sources.push({name:result.sourceName||"Imported source",content:result.rawText,type:result.rawType||"text"});
  state.importedAt=new Date().toISOString();snapshot();refresh();
  message("parse-message","Import complete: "+(Object.keys(state.character).length+Object.keys(state.extraFields).length)+" definition field(s), "+state.assets.length+" image(s), "+state.lorebooks.length+" lorebook(s).");
  toast("Imported data is available in this browser session.");
}
function snapshot(){state.original={character:cloneData(state.character),extraFields:cloneData(state.extraFields),assets:cloneData(state.assets),lorebooks:cloneData(state.lorebooks),card:cloneData(state.card),sources:cloneData(state.sources),sourceUrl:state.sourceUrl};}
function validateCharacterUrl(value) {
  const url=new URL(value),host=url.hostname.toLowerCase();
  if(!(host==="janitorai.com"||host==="www.janitorai.com"||host.endsWith(".janitorai.com"))||!/^\/characters?\//i.test(url.pathname))throw new Error("Enter a valid Janitor AI character URL.");
  return url;
}
function fileDataUrl(file) {return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error||new Error("Could not read image."));reader.readAsDataURL(file);});}
async function importFile(file) {
  if(file.size>25*1024*1024)throw new Error(file.name+" exceeds 25 MB.");
  if(file.type.startsWith("image/")) {
    const data=await fileDataUrl(file);
    if(file.type==="image/png") {
      const card=await readPNGCharacterCard(file);
      if(card) {const parsed=parseSource(card,{fileName:file.name});parsed.assets.unshift({id:"local-"+Date.now(),url:data,label:file.name,source:"Local PNG card",type:"image"});applyImport(parsed);return;}
    }
    state.assets.push({id:"local-"+Date.now(),url:data,label:file.name,source:"Local file",type:"image"});snapshot();refresh();toast("Image added to Assets.");return;
  }
  const content=await file.text(),ext=file.name.split(".").pop().toLowerCase();
  if(ext==="css"){state.card.css=content;snapshot();refresh();toast("CSS imported into Card Design.");return;}
  applyImport(parseSource(content,{fileName:file.name,sourceUrl:state.sourceUrl}));
}
function restoreOriginal() {
  if(!state.original){toast("There is no imported version to restore.");return;}
  state.character=cloneData(state.original.character)||{};state.extraFields=cloneData(state.original.extraFields)||{};
  state.assets=cloneData(state.original.assets)||[];state.lorebooks=cloneData(state.original.lorebooks)||[];state.card=cloneData(state.original.card)||{html:"",css:""};refresh();toast("Restored the original imported data.");
}
function addExtra() {
  const key=$("#custom-field-name").value.trim();if(!key){toast("Enter a field name.");return;}
  if(Object.hasOwn(state.character,key)||Object.hasOwn(state.extraFields,key)){toast("That field already exists.");return;}
  let value=$("#custom-field-value").value;try{value=JSON.parse(value);}catch{}
  state.extraFields[key]=value;$("#custom-field-name").value="";$("#custom-field-value").value="";renderDefinitions();
}
function reset() {
  state.character={};state.extraFields={};state.original=null;state.assets=[];state.lorebooks=[];state.sources=[];state.card={html:"",css:""};state.sourceUrl="";state.importedAt=null;
  $("#source-data").value="";$("#source-file").value="";$("#parse-message").classList.remove("is-visible");refresh();toast("Current extraction session cleared.");
}
function makeCharacterCard() {
  const d=currentDefinitions();
  return {spec:"chara_card_v2",spec_version:"2.0",data:{...d,name:valueText(d.name),description:valueText(d.description),personality:valueText(d.personality),scenario:valueText(d.scenario),first_mes:valueText(d.first_mes),mes_example:valueText(d.mes_example),creator_notes:valueText(d.creator_notes),system_prompt:valueText(d.system_prompt),post_history_instructions:valueText(d.post_history_instructions),alternate_greetings:Array.isArray(d.alternate_greetings)?d.alternate_greetings:(d.alternate_greetings?[valueText(d.alternate_greetings)]:[]),tags:Array.isArray(d.tags)?d.tags:(d.tags?valueText(d.tags).split(",").map(x=>x.trim()).filter(Boolean):[]),extensions:d.extensions&&typeof d.extensions==="object"?d.extensions:{}}};
}
function currentDefinitions() {return {...cloneData(state.extraFields),...cloneData(state.character)};}
function exportSession() {
  const data={schema:"janitor-ai-extractor-session",schemaVersion:1,exportedAt:new Date().toISOString(),sourceUrl:state.sourceUrl,importedAt:state.importedAt,definitions:currentDefinitions(),assets:state.assets,lorebooks:state.lorebooks,cardDesign:state.card};
  downloadText(safeFilename(state.character.name||"character")+"-extraction-session.json",JSON.stringify(data,null,2),"application/json;charset=utf-8");
}
function renderCapture() {
  
  $("#capture-history-summary").textContent=state.captures.length+" request(s) in this browser session";
  setEnabled(["download-request-txt","download-request-json","download-history","clear-history"],state.captures.length>0);
  if(!state.captures.length){$("#capture-list").innerHTML='<div class="capture-list-empty">No requests captured yet.</div>';$("#request-display").innerHTML='<div class="request-empty"><div class="radar"><span></span><b>⌁</b></div><h3>Waiting for a message</h3><p>Connect the Brave extension, enable capture, then send a message in Janitor AI.</p></div>';return;}
  $("#capture-list").innerHTML=state.captures.map(item=>'<button class="capture-list-item '+(item.id===state.selectedCapture?"is-active":"")+'" type="button" data-capture="'+esc(item.id)+'"><span class="capture-list-top"><b>'+esc(new Date(item.capturedAt).toLocaleTimeString())+'</b><small>'+esc(item.method)+'</small></span><span class="capture-list-model">'+esc(item.request.model||"Unknown model")+'</span><span class="capture-list-meta">'+(Array.isArray(item.request.messages)?item.request.messages.length:0)+' message(s) · '+esc(item.source)+'</span></button>').join("");
  $$("[data-capture]").forEach(button=>button.addEventListener("click",()=>{state.selectedCapture=button.dataset.capture;renderCapture();}));
  const item=state.captures.find(entry=>entry.id===state.selectedCapture)||state.captures[0],req=item.request;
  const messages=Array.isArray(req.messages)?req.messages:[];
  const messageHtml=messages.map((m,i)=>'<article class="message-item"><div><b>'+esc(String(m.role||"message").toUpperCase())+'</b><span>#'+(i+1)+'</span></div><pre>'+esc(valueText(m.content??m))+'</pre></article>').join("");
  $("#request-display").innerHTML='<div class="capture-detail-head"><div><b>REQUEST '+esc(item.id.slice(0,18))+'</b><small>'+esc(item.capturedAt)+'</small></div><span class="capture-source">'+esc(item.source)+'</span></div><div class="message-list">'+(messageHtml||"<p>No messages array. Inspect raw JSON.</p>")+'</div><details class="raw-request"><summary>View complete request JSON</summary><pre>'+esc(JSON.stringify(req,null,2))+'</pre></details>';
}
function addCapture(payload,source="Brave extension") {
  let request=payload.request??payload.body??payload;if(typeof request==="string"){try{request=JSON.parse(request);}catch{request={raw:request};}}
  if(!request||typeof request!=="object")throw new Error("Captured request body is invalid.");
  let url="Unknown endpoint";try{const parsed=new URL(payload.url||payload.requestUrl);url=parsed.origin+parsed.pathname;}catch{}
  const item={id:String(payload.id||payload.requestId||"capture-"+Date.now()),capturedAt:payload.capturedAt||new Date().toISOString(),source,url,method:String(payload.method||"POST").toUpperCase(),responseMode:payload.responseMode||"mock",request};
  state.captures=[item,...state.captures.filter(old=>old.id!==item.id)].slice(0,100);state.selectedCapture=item.id;renderCapture();badge($("#capture-status"),"Request captured","success");
}
function updateCaptureControls() {
  const connected=Boolean(bridge?.connected);
  $("#start-capture").disabled=!connected||captureEnabled;$("#stop-capture").disabled=!connected||!captureEnabled;
  $("#capture-state-text").textContent=!connected?"Waiting for the companion extension.":captureEnabled?"Listening for the next Janitor AI chat request.":"Extension connected. Start capture when ready.";
}
function extensionStatus(info) {
  badge($("#extension-status"),info.connected?"Extension connected · v"+info.extensionVersion:"Extension disconnected",info.connected?"success":"muted");
  $("#extension-status-detail").textContent=info.connected?"The companion extension is responding.":"Install and open the separate companion extension to enable live extraction and prompt capture.";
  if(!info.connected){captureEnabled=false;badge($("#capture-status"),"Extension disconnected","muted");}
  updateCaptureControls();
}
function extensionMessage(event) {
  const p=event.payload||{};
  if(event.type==="CAPTURED_REQUEST") {try{addCapture(p);toast("Janitor AI request captured.");}catch(error){toast(error.message);}}
  if(event.type==="CHARACTER_DATA") {
    const parsed=parseSource(p.character||p.definitions||p.data||{},{fileName:"Brave extension capture",sourceUrl:p.sourceUrl||""});
    parsed.assets.push(...(p.assets||[]));parsed.lorebooks.push(...(p.lorebooks||[]));parsed.html=p.cardDesign?.html||parsed.html;parsed.css=p.cardDesign?.css||parsed.css;applyImport(parsed);toast("Character data received from extension.");
  }
  if(event.type==="CAPTURE_STATE"){captureEnabled=Boolean(p.enabled);badge($("#capture-status"),captureEnabled?"Listening for requests":"Capture stopped",captureEnabled?"success":"muted");updateCaptureControls();}
  if(event.type==="EXTENSION_ERROR")toast("Extension: "+String(p.message||"Unknown error"));
}
function init() {
  $$(".nav-link").forEach(button=>button.addEventListener("click",()=>{const name=button.dataset.view;$("#normal-view").classList.toggle("is-active",name==="normal");$("#prompt-view").classList.toggle("is-active",name==="prompt");$$(".nav-link").forEach(x=>x.classList.toggle("is-active",x===button));$("#crumb-current").textContent=name==="normal"?"Normal extraction":"Prompt capture";}));
  $$(".tab").forEach(button=>button.addEventListener("click",()=>{$$(".tab").forEach(x=>{x.classList.toggle("is-active",x===button);x.setAttribute("aria-selected",String(x===button));});$$(".panel-view").forEach(panel=>{const active=panel.id===button.dataset.panel+"-panel";panel.classList.toggle("is-active",active);panel.hidden=!active;});}));
  $("#character-form").addEventListener("submit",event=>{event.preventDefault();try{const url=validateCharacterUrl($("#character-url").value.trim());state.sourceUrl=url.href;if(bridge?.connected)bridge.send("SET_TARGET_URL",{url:url.href});window.open(url.href,"_blank","noopener,noreferrer");message("url-message","Character page opened. The companion extension can send accessible data back when connected.");}catch(error){message("url-message",error.message,true);}});
  $("#parse-source").addEventListener("click",()=>{const raw=$("#source-data").value.trim();if(!raw){toast("Paste JSON, HTML or labelled text first.");return;}try{applyImport(parseSource(raw,{sourceUrl:state.sourceUrl}));}catch(error){toast("Import failed: "+error.message);}});
  $("#source-file").addEventListener("change",async event=>{for(const file of [...event.target.files||[]])try{await importFile(file);}catch(error){toast(file.name+": "+error.message);}event.target.value="";});
  $("#clear-source").addEventListener("click",()=>{$("#source-data").value="";$("#source-file").value="";$("#parse-message").classList.remove("is-visible");});
  $("#clear-session").addEventListener("click",reset);
  $("#restore-original").addEventListener("click",restoreOriginal);
  $("#add-custom-field").addEventListener("click",addExtra);
  $("#custom-field-name").addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();addExtra();}});
  $("#download-txt").addEventListener("click",()=>downloadText(safeFilename(state.character.name)+".txt",Object.entries(currentDefinitions()).map(([key,value])=>{const field=FIELD_SCHEMA.find(x=>x.key===key);return (field?.label||key)+"\n"+valueText(value);}).join("\n\n")));
  $("#download-json").addEventListener("click",()=>downloadText(safeFilename(state.character.name)+".json",JSON.stringify(currentDefinitions(),null,2),"application/json;charset=utf-8"));
  $("#download-card").addEventListener("click",()=>downloadText(safeFilename(state.character.name)+"-character-card.json",JSON.stringify(makeCharacterCard(),null,2),"application/json;charset=utf-8"));
  $("#download-session").addEventListener("click",exportSession);
  $("#download-original").addEventListener("click",()=>{const item=state.sources[state.sources.length-1];if(item)downloadText(safeFilename(item.name)+(item.type==="json"?".json":".txt"),item.content,item.type==="json"?"application/json;charset=utf-8":"text/plain;charset=utf-8");});
  $("#download-lorebook").addEventListener("click",()=>downloadText("lorebooks.json",JSON.stringify(state.lorebooks,null,2),"application/json;charset=utf-8"));
  $("#download-assets-zip").addEventListener("click",async()=>{
    const files=[];
    for(const [i,asset] of state.assets.entries())try{const response=await fetch(asset.url,{mode:"cors",credentials:"omit"});if(!response.ok)continue;const blob=await response.blob();const ext=(asset.url.match(/\.(png|jpe?g|gif|webp|avif|svg)(?:[?#]|$)/i)||[])[1]||"img";files.push({name:"images/"+safeFilename(asset.label||"image-"+i)+"."+ext,data:new Uint8Array(await blob.arrayBuffer())});}catch{}
    state.lorebooks.forEach((book,i)=>files.push({name:"lorebooks/"+safeFilename(book.name||"book-"+i)+".json",data:new TextEncoder().encode(JSON.stringify(book.data,null,2))}));
    if(!files.length){toast("No assets could be bundled; some image hosts block downloads.");return;}downloadBlob("character-assets.zip",zipStore(files));toast("ZIP created with "+files.length+" file(s).");
  });
  $("#card-html").addEventListener("input",updateCard);$("#card-css").addEventListener("input",updateCard);
  $("#download-html").addEventListener("click",()=>downloadText("character-card.html",state.card.html,"text/html;charset=utf-8"));
  $("#download-css").addEventListener("click",()=>downloadText("character-card.css",state.card.css,"text/css;charset=utf-8"));
  $("#start-capture").addEventListener("click",()=>{if(!bridge?.send("SET_CAPTURE_ENABLED",{enabled:true})){toast("The companion extension is not connected.");return;}captureEnabled=true;badge($("#capture-status"),"Listening for requests","success");updateCaptureControls();});
  $("#stop-capture").addEventListener("click",()=>{bridge?.send("SET_CAPTURE_ENABLED",{enabled:false});captureEnabled=false;badge($("#capture-status"),"Capture stopped","muted");updateCaptureControls();});
  $("#manual-request-import").addEventListener("click",()=>{try{const raw=JSON.parse($("#manual-request").value);addCapture({id:"manual-"+Date.now(),request:raw,method:"MANUAL",url:"Manual JSON import"},"Manual import");badge($("#capture-status"),"Manual request imported","success");}catch(error){toast("Invalid request JSON: "+error.message);}});
  $("#download-request-json").addEventListener("click",()=>{const item=state.captures.find(x=>x.id===state.selectedCapture);if(item)downloadText("captured-request.json",JSON.stringify(item,null,2),"application/json;charset=utf-8");});
  $("#download-request-txt").addEventListener("click",()=>{const item=state.captures.find(x=>x.id===state.selectedCapture);if(item)downloadText("captured-request.txt",JSON.stringify(item.request,null,2));});
  $("#download-history").addEventListener("click",()=>downloadText("prompt-capture-history.json",JSON.stringify(state.captures,null,2),"application/json;charset=utf-8"));
  $("#clear-history").addEventListener("click",()=>{state.captures=[];state.selectedCapture=null;renderCapture();badge($("#capture-status"),"Waiting for a message","muted");});
  $("#clear-manual").addEventListener("click",()=>$("#manual-request").value="");
  $("#help-button").addEventListener("click",()=>toast("Live extraction and prompt interception require the separate Brave extension. Manual imports are available now."));
  refresh();renderCapture();updateCaptureControls();
  setEnabled(["download-request-txt","download-request-json","download-history","clear-history"],false);
  bridge=new ExtensionBridge({onStatus:extensionStatus,onMessage:extensionMessage});
  window.addEventListener("beforeunload",()=>bridge?.destroy());
}
document.addEventListener("DOMContentLoaded",init);
