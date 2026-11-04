(() => {
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const state = {
  character: {}, assets: [], lorebooks: [], html: "", css: "",
  request: null, requestId: null, endpoint: "http://127.0.0.1:8787",
  poller: null, busy: false
};
const FIELD_MAP = {
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
const LABELS = {
  name:"Character name", description:"Description", personality:"Personality",
  scenario:"Scenario", first_mes:"First message", alternate_greetings:"Alternate greetings",
  mes_example:"Example dialogue", creator_notes:"Creator notes", system_prompt:"System prompt",
  post_history_instructions:"Post-history instructions", creator:"Creator",
  character_version:"Version", tags:"Tags"
};
function toast(message) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("is-visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("is-visible"), 3200);
}
function download(name, data, type = "text/plain;charset=utf-8") {
  const blob = new Blob([data], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function safeName(value) {
  return String(value || "character").normalize("NFKD")
    .replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "").slice(0, 70) || "character";
}
function textValue(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(x => typeof x === "string" ? x : JSON.stringify(x, null, 2)).join("\n\n");
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function deepFind(object, keys, depth = 0) {
  if (!object || typeof object !== "object" || depth > 8) return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(object, key) && object[key] != null && object[key] !== "") return object[key];
  }
  for (const value of Object.values(object)) {
    if (value && typeof value === "object") {
      const found = deepFind(value, keys, depth + 1);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}
function collectAssets(object) {
  const found = new Map(), books = [];
  const visited = new WeakSet();
  function walk(value, path = "", depth = 0) {
    if (!value || typeof value !== "object" || depth > 10 || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, path + "[" + index + "]", depth + 1));
      return;
    }
    for (const [key, item] of Object.entries(value)) {
      if (/lore.?book|world.?info|character.?book/i.test(key) && item && typeof item === "object") {
        books.push({name:key, data:item});
      }
      if (typeof item === "string" &&
          (/^https?:\/\//i.test(item) || /^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(item)) &&
          (/image|avatar|thumbnail|background|cover|icon|photo|^url$/i.test(key) ||
           /\.(png|jpe?g|gif|webp|avif)(?:[?#]|$)/i.test(item))) {
        found.set(item, {url:item, label:key || "Image", source:path || "Imported JSON"});
      } else if (item && typeof item === "object") {
        walk(item, path ? path + "." + key : key, depth + 1);
      }
    }
  }
  walk(object);
  return {assets:[...found.values()], books};
}
function parseSource(raw) {
  let object = null;
  try { object = JSON.parse(raw); } catch {}
  if (!object) {
    const match = raw.match(/<script[^>]+type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i);
    if (match) { try { object = JSON.parse(match[1]); } catch {} }
  }
  const data = object?.data && typeof object.data === "object" ? object.data : object;
  const character = {};
  if (data && typeof data === "object") {
    for (const [field, aliases] of Object.entries(FIELD_MAP)) {
      const value = deepFind(data, aliases);
      if (value !== undefined) character[field] = value;
    }
  }
  const title = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = raw.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i);
  if (!character.name && title) character.name = title[1].replace(/<[^>]+>/g, "").trim();
  if (!character.description && description) character.description = description[1];
  const {assets, books} = object ? collectAssets(object) : {assets:[],books:[]};
  let html = "", css = "";
  if (/<(?:html|body|div|section|article)\b/i.test(raw)) {
    try {
      const parsed = new DOMParser().parseFromString(raw, "text/html");
      html = parsed.body?.innerHTML || raw;
      css = [...parsed.querySelectorAll("style")].map(node => node.textContent).join("\n\n");
    } catch { html = raw; }
  }
  const imagePattern = /(?:src|content|href)=["'](https?:\/\/[^"']+\.(?:png|jpe?g|gif|webp|avif)(?:\?[^"']*)?)["']/gi;
  for (const match of raw.matchAll(imagePattern)) {
    if (!assets.some(asset => asset.url === match[1])) assets.push({url:match[1],label:"Image",source:"Imported HTML"});
  }
  const loreMatch = raw.match(/<script[^>]+id=["'][^"']*(?:lore|world)[^"']*["'][^>]*>([\s\S]*?)<\/script>/i);
  if (loreMatch) { try { books.push({name:"Embedded lorebook",data:JSON.parse(loreMatch[1])}); } catch {} }
  const htmlMatch = raw.match(/<!--[\s\S]*?CARD_HTML_START[\s\S]*?-->([\s\S]*?)<!--[\s\S]*?CARD_HTML_END[\s\S]*?-->/i);
  const cssMatch = raw.match(/<!--[\s\S]*?CARD_CSS_START[\s\S]*?-->([\s\S]*?)<!--[\s\S]*?CARD_CSS_END[\s\S]*?-->/i);
  return {character,assets,books,html:htmlMatch?.[1]?.trim() || html,css:cssMatch?.[1]?.trim() || css};
}
async function readPNGCharacterCard(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = [137,80,78,71,13,10,26,10];
  if (bytes.length < 8 || !signature.every((value,index)=>bytes[index]===value)) return null;
  const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const decoder = new TextDecoder();
  async function inflate(input) {
    if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot decompress PNG metadata.");
    const stream = new Blob([input]).stream().pipeThrough(new DecompressionStream("deflate"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  function splitNull(data,start=0) {
    let end=start;
    while(end<data.length && data[end]!==0) end++;
    return {value:decoder.decode(data.subarray(start,end)),next:end+1};
  }
  for(let offset=8;offset+12<=bytes.length;) {
    const length=view.getUint32(offset);
    if(length>bytes.length-offset-12) break;
    const type=decoder.decode(bytes.subarray(offset+4,offset+8));
    const chunk=bytes.subarray(offset+8,offset+8+length);
    offset+=length+12;
    let key="",valueBytes=null;
    try {
      if(type==="tEXt") {
        const part=splitNull(chunk);key=part.value;valueBytes=chunk.subarray(part.next);
      } else if(type==="zTXt") {
        const part=splitNull(chunk);key=part.value;
        if(chunk[part.next]===0)valueBytes=await inflate(chunk.subarray(part.next+1));
      } else if(type==="iTXt") {
        const part=splitNull(chunk);key=part.value;
        let cursor=part.next,compressed=chunk[cursor++]===1;
        cursor++; // compression method
        cursor=splitNull(chunk,cursor).next; // language tag
        cursor=splitNull(chunk,cursor).next; // translated keyword
        valueBytes=chunk.subarray(cursor);
        if(compressed)valueBytes=await inflate(valueBytes);
      }
      if(!["chara","ccv3","chara_card"].includes(key)||!valueBytes?.length) continue;
      const text=decoder.decode(valueBytes);
      try { return JSON.parse(text); } catch {}
      try {
        const binary=atob(text.trim());
        const decoded=new TextDecoder().decode(Uint8Array.from(binary,c=>c.charCodeAt(0)));
        return JSON.parse(decoded);
      } catch {}
    } catch {}
  }
  return null;
}
function fileAsDataURL(file) {
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result));
    reader.onerror=()=>reject(reader.error||new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}
function parseLabeledText(raw) {
  const aliases = {
    name:"name",charactername:"name",description:"description",personality:"personality",
    persona:"personality",scenario:"scenario",firstmessage:"first_mes",firstmes:"first_mes",
    greeting:"first_mes",alternategreetings:"alternate_greetings",exampledialogue:"mes_example",
    mesexample:"mes_example",systemprompt:"system_prompt",posthistoryinstructions:"post_history_instructions",
    creatornotes:"creator_notes",creator:"creator",tags:"tags"
  };
  const result = {};
  let current = null;
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z][\w -]{1,34})\s*:\s*(.*)$/);
    const key = match?.[1].toLowerCase().replace(/[\s_-]/g, "");
    if (match && aliases[key]) {
      current = aliases[key];
      result[current] = match[2];
    } else if (current && line.trim()) {
      result[current] += "\n" + line;
    }
  }
  return result;
}
function characterCard() {
  const c = state.character;
  return {spec:"chara_card_v2",spec_version:"2.0",data:{
    name:textValue(c.name),description:textValue(c.description),personality:textValue(c.personality),
    scenario:textValue(c.scenario),first_mes:textValue(c.first_mes),mes_example:textValue(c.mes_example),
    creator_notes:textValue(c.creator_notes),system_prompt:textValue(c.system_prompt),
    post_history_instructions:textValue(c.post_history_instructions),
    alternate_greetings:Array.isArray(c.alternate_greetings) ? c.alternate_greetings : textValue(c.alternate_greetings).split(/\n\s*\n/).filter(Boolean),
    tags:Array.isArray(c.tags) ? c.tags : textValue(c.tags).split(",").map(x=>x.trim()).filter(Boolean),
    creator:textValue(c.creator),character_version:textValue(c.character_version),extensions:{}
  }};
}
function setEnabled(ids, enabled) {
  ids.forEach(id => { const element = $("#"+id); if (element) element.disabled = !enabled; });
}
function renderFields() {
  const host = $("#definition-fields");
  const entries = Object.entries(LABELS).filter(([key]) => state.character[key] !== undefined && textValue(state.character[key]) !== "");
  if (!entries.length) {
    host.innerHTML = '<div class="empty-card surface compact-empty"><h3>No definition fields detected</h3><p>Try a Character Card JSON file or labelled text containing Personality:, Scenario: and First message:.</p></div>';
    setEnabled(["download-txt","download-json","download-card"], false);
    return;
  }
  host.innerHTML = entries.map(([key,label]) =>
    '<label class="definition-field surface"><span>'+escapeHTML(label)+'</span><textarea data-field="'+key+'" spellcheck="false">'+escapeHTML(textValue(state.character[key]))+'</textarea></label>'
  ).join("");
  $$("[data-field]", host).forEach(element => element.addEventListener("input", () => {
    state.character[element.dataset.field] = element.value;
  }));
  setEnabled(["download-txt","download-json","download-card"], true);
}
function extensionFor(type, url) {
  const ext = (String(url).match(/\.(png|jpe?g|gif|webp|avif)(?:[?#]|$)/i) || [])[1];
  return ext ? "."+ext.toLowerCase() : (String(type).includes("png") ? ".png" : String(type).includes("webp") ? ".webp" : ".img");
}
async function downloadAsset(asset) {
  if (asset.url.startsWith("data:image/")) {
    const match = asset.url.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (match) { download(safeName(asset.label)+extensionFor(match[1],asset.label), Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0)), match[1]); return; }
  }
  try {
    const response = await fetch(asset.url, {mode:"cors"});
    if (!response.ok) throw new Error("HTTP "+response.status);
    const blob = await response.blob(), url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href=url; a.download=safeName(asset.label)+extensionFor(blob.type,asset.url);
    document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1200);
  } catch {
    window.open(asset.url,"_blank","noopener,noreferrer");
    toast("Direct download was blocked by the image host. Opened the original resource instead.");
  }
}
function renderAssets() {
  const host = $("#asset-results");
  $("#asset-count").textContent = state.assets.length + state.lorebooks.length;
  if (!state.assets.length && !state.lorebooks.length) {
    host.innerHTML = '<div class="empty-card surface compact-empty"><div class="asset-icon asset-violet">▧</div><h3>No assets imported</h3><p>Import JSON or HTML containing accessible image links or lorebook data.</p></div>';
    setEnabled(["download-lorebook","download-assets-zip"], false);
    return;
  }
  let markup = '<div class="asset-grid">';
  state.assets.forEach((asset,index) => {
    const preview = asset.url.startsWith("data:image/") ? asset.url : asset.url;
    markup += '<article class="asset-card surface"><img class="asset-thumb" src="'+escapeHTML(preview)+'" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'"><h3>'+escapeHTML(asset.label)+'</h3><p class="asset-url">'+escapeHTML(asset.url.length>180?asset.url.slice(0,177)+"…":asset.url)+'</p><button class="button button-quiet" data-asset="'+index+'">Download image</button></article>';
  });
  state.lorebooks.forEach((book,index) => {
    markup += '<article class="asset-card surface"><div class="asset-icon asset-teal">▤</div><h3>'+escapeHTML(book.name)+'</h3><p>Imported lorebook / world-info data.</p><button class="button button-quiet" data-book="'+index+'">Download JSON</button></article>';
  });
  host.innerHTML = markup + "</div>";
  $$("[data-asset]",host).forEach(button=>button.addEventListener("click",()=>downloadAsset(state.assets[+button.dataset.asset])));
  $$("[data-book]",host).forEach(button=>button.addEventListener("click",()=>{
    const book=state.lorebooks[+button.dataset.book];
    download(safeName(book.name)+".json",JSON.stringify(book.data,null,2),"application/json");
  }));
  setEnabled(["download-lorebook","download-assets-zip"], true);
}
function updatePreview() {
  state.html=$("#card-html").value;
  state.css=$("#card-css").value;
  const documentText='<!doctype html><html><head><meta charset="utf-8"><style>body{margin:12px;background:#f5f5f5;color:#222;font:14px sans-serif}'+state.css+'</style></head><body>'+state.html+'</body></html>';
  $("#card-preview").srcdoc=documentText;
  setEnabled(["download-html"],!!state.html);
  setEnabled(["download-css"],!!state.css);
}
function applyParsed(result) {
  state.character=result.character;
  state.assets=result.assets;
  state.lorebooks=result.books;
  if(result.html) $("#card-html").value=result.html;
  if(result.css) $("#card-css").value=result.css;
  renderFields(); renderAssets(); updatePreview();
  const count=Object.keys(state.character).length;
  $("#parse-message").textContent="Imported "+count+" definition field(s), "+state.assets.length+" image(s), and "+state.lorebooks.length+" lorebook item(s).";
  $("#parse-message").classList.add("is-visible");
  toast("Import processed in this browser session.");
}
function authHeaders(json=false) {
  const headers = {};
  if (json) headers["Content-Type"]="application/json";
  const key=$("#receiver-key")?.value.trim();
  if (key) headers.Authorization="Bearer "+key;
  return headers;
}
function inspectRequest(request, captureId=null) {
  if (!request || typeof request !== "object") throw new Error("Request JSON must be an object.");
  state.request=request;
  if (captureId) state.requestId=captureId;
  const messages=Array.isArray(request.messages)?request.messages:[];
  renderRequest(messages,request);
  setEnabled(["download-request-txt","download-request-json"],true);
}
function renderRequest(messages,request) {
  const host=$("#request-display");
  let markup='<div class="message-list">';
  if(messages.length) {
    markup += messages.map((message,index) => {
      const role=escapeHTML(String(message.role||"message").toUpperCase());
      const content=escapeHTML(textValue(message.content ?? message));
      return '<article class="message-item"><div><b>'+role+'</b><span>#'+(index+1)+'</span></div><pre>'+content+'</pre></article>';
    }).join("");
  } else {
    markup += '<p>No messages array was found. The raw request can still be downloaded as JSON.</p>';
  }
  markup += '<article class="message-item"><div><b>REQUEST DETAILS</b><span>metadata</span></div><pre>'+escapeHTML(JSON.stringify({
    model:request.model||null,temperature:request.temperature??null,max_tokens:request.max_tokens??null,
    stream:!!request.stream,message_count:messages.length
  },null,2))+'</pre></article></div>';
  host.innerHTML=markup;
  $("#request-subtitle").textContent="Captured "+messages.length+" message(s) · "+new Date().toLocaleTimeString();
  $("#request-status").innerHTML="<i></i> Request captured";
  $("#request-status").classList.add("captured");
}
async function connectReceiver() {
  const base=$("#endpoint-url").value.trim().replace(/\/+$/,"");
  if(!/^https?:\/\//i.test(base)){toast("Enter a valid receiver URL.");return;}
  state.endpoint=base;
  try {
    const response=await fetch(base+"/health",{headers:authHeaders(),cache:"no-store"});
    if(!response.ok) throw new Error("Receiver returned HTTP "+response.status);
    const data=await response.json();
    $("#request-status").innerHTML="<i></i> Connected";
    $("#request-status").classList.add("captured");
    $("#request-subtitle").textContent="Receiver online · "+(data.mode||"temporary memory");
    $("#connection-label").textContent="Receiver connected";
    if(state.poller) clearInterval(state.poller);
    state.poller=setInterval(pollReceiver,1600);
    await pollReceiver();
    toast("Receiver connected. Send a test message in Janitor AI.");
  } catch(error) {
    $("#request-status").innerHTML="<i></i> Offline";
    $("#request-status").classList.remove("captured");
    $("#request-subtitle").textContent="Cannot reach receiver: "+error.message;
    $("#connection-label").textContent="Receiver offline";
    toast("Could not connect. Start the Node receiver and check the URL / access key.");
  }
}
async function pollReceiver() {
  try {
    const response=await fetch(state.endpoint+"/api/latest",{headers:authHeaders(),cache:"no-store"});
    if(!response.ok) return;
    const capture=await response.json();
    if(capture.request && capture.id!==state.requestId) inspectRequest(capture.request,capture.id);
  } catch {}
}
function bind(id,callback) { const element=$("#"+id); if(element) element.addEventListener("click",callback); }
function init() {
  $$(".nav-link").forEach(button=>button.addEventListener("click",()=>{
    const name=button.dataset.view;
    Object.entries({normal:"#normal-view",prompt:"#prompt-view"}).forEach(([key,selector])=>$(selector).classList.toggle("is-active",key===name));
    $$(".nav-link").forEach(item=>item.classList.toggle("is-active",item===button));
    $("#crumb-current").textContent=name==="normal"?"Normal extraction":"Prompt capture";
  }));
  $$(".tab").forEach(button=>button.addEventListener("click",()=>{
    $$(".tab").forEach(item=>{item.classList.toggle("is-active",item===button);item.setAttribute("aria-selected",String(item===button));});
    $$(".panel-view").forEach(panel=>{const active=panel.id===button.dataset.panel+"-panel";panel.classList.toggle("is-active",active);panel.hidden=!active;});
  }));
  $("#character-form").addEventListener("submit",event=>{
    event.preventDefault();
    try {
      const url=new URL($("#character-url").value);
      if(!/(^|\.)janitorai\.com$/i.test(url.hostname)||!/^\/characters?\//.test(url.pathname)) throw new Error("Enter a valid Janitor AI character page URL.");
      window.open(url.href,"_blank","noopener,noreferrer");
      $("#url-message").textContent="Character page opened. Automatic signed-in page reading requires the future Brave extension. For now, import accessible page data below.";
      $("#url-message").classList.add("is-visible");
    } catch(error) {
      $("#url-message").textContent=error.message;
      $("#url-message").classList.add("is-visible");
    }
  });
  bind("parse-source",()=>{
    const raw=$("#source-data").value.trim();
    if(!raw){toast("Paste or import source content first.");return;}
    const result=parseSource(raw);
    if(!Object.keys(result.character).length) Object.assign(result.character,parseLabeledText(raw));
    if(!result.html&&/<[a-z][\s\S]*>/i.test(raw)) $("#card-html").value=raw.slice(0,200000);
    applyParsed(result);
  });
  $("#source-file").addEventListener("change",async event=>{
    const file=event.target.files?.[0];
    if(!file)return;
    if(file.size>15*1024*1024){toast("Please choose a file smaller than 15 MB.");event.target.value="";return;}
    try {
      if(file.type.startsWith("image/")) {
        const dataURL=await fileAsDataURL(file);
        const imageAsset={url:dataURL,label:file.name,source:"Local image upload"};
        if(file.type==="image/png") {
          const cardData=await readPNGCharacterCard(file);
          if(cardData) {
            const parsed=parseSource(JSON.stringify(cardData));
            parsed.assets.unshift(imageAsset);
            applyParsed(parsed);
            toast("PNG character card metadata imported.");
            return;
          }
        }
        state.assets=[imageAsset];
        renderAssets();
        toast("Image added to the Assets tab.");
        return;
      }
      const content=await file.text();
      if(file.name.toLowerCase().endsWith(".css")) {
        $("#card-css").value=content;
        updatePreview();
        toast("CSS loaded into Card Design.");
        return;
      }
      $("#source-data").value=content;
      toast("Loaded "+file.name+". Choose Extract fields to process it.");
    } catch(error) {
      toast("Could not import file: "+error.message);
    }
  });
  bind("clear-source",()=>{
    $("#source-data").value="";$("#source-file").value="";
    $("#parse-message").classList.remove("is-visible");
  });
  bind("download-txt",()=>download(safeName(state.character.name)+".txt",Object.entries(state.character).map(([key,value])=>(LABELS[key]||key)+"\n"+textValue(value)).join("\n\n")));
  bind("download-json",()=>download(safeName(state.character.name)+".json",JSON.stringify(state.character,null,2),"application/json"));
  bind("download-card",()=>download(safeName(state.character.name)+"-character-card.json",JSON.stringify(characterCard(),null,2),"application/json"));
  bind("download-lorebook",()=>download("lorebooks.json",JSON.stringify(state.lorebooks,null,2),"application/json"));
  bind("download-assets-zip",makeZip);
  bind("download-html",()=>download("character-card.html",state.html,"text/html"));
  bind("download-css",()=>download("character-card.css",state.css,"text/css"));
  $("#card-html").addEventListener("input",updatePreview);
  $("#card-css").addEventListener("input",updatePreview);
  bind("connect-endpoint",connectReceiver);
  bind("inspect-request",()=>{
    try{inspectRequest(JSON.parse($("#manual-request").value));toast("Request inspected in this browser session.");}
    catch(error){toast("Invalid request JSON: "+error.message);}
  });
  bind("clear-manual",()=>$("#manual-request").value="");
  bind("clear-request",async()=>{
    state.request=null;state.requestId=null;
    $("#request-display").innerHTML='<div class="radar"><span></span><b>⌁</b></div><h3>Capture cleared</h3><p>Waiting for the next request.</p>';
    $("#request-subtitle").textContent="Waiting for a new request.";
    setEnabled(["download-request-txt","download-request-json"],false);
    try{await fetch(state.endpoint+"/api/clear",{method:"POST",headers:authHeaders()});}catch{}
  });
  bind("download-request-json",()=>state.request&&download("captured-request.json",JSON.stringify(state.request,null,2),"application/json"));
  bind("download-request-txt",()=>state.request&&download("captured-request.txt",(state.request.messages||[]).map(message=>"["+String(message.role||"message")+"]\n"+textValue(message.content)).join("\n\n")));
  bind("help-button",()=>toast("Import data you are authorized to access. Prompt capture needs the local Node receiver. Automatic signed-in page inspection is deferred until the extension phase."));
  setEnabled(["download-txt","download-json","download-card","download-lorebook","download-assets-zip","download-html","download-css","download-request-txt","download-request-json"],false);
  updatePreview();
}
async function makeZip() {
  if(state.busy){toast("Preparing the archive…");return;}
  state.busy=true;
  const files=[];
  for(const asset of state.assets) {
    try {
      if(asset.url.startsWith("data:image/")) {
        const match=asset.url.match(/^data:(image\/[^;]+);base64,(.+)$/);
        if(match) files.push({name:"images/"+safeName(asset.label)+extensionFor(match[1],asset.label),data:Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0))});
      } else {
        const response=await fetch(asset.url,{mode:"cors"});
        if(response.ok) files.push({name:"images/"+safeName(asset.label)+extensionFor(response.headers.get("content-type")||"",asset.url),data:new Uint8Array(await response.arrayBuffer())});
      }
    } catch {}
  }
  state.lorebooks.forEach((book,index)=>files.push({
    name:"lorebooks/"+safeName(book.name||"lorebook-"+index)+".json",
    data:new TextEncoder().encode(JSON.stringify(book.data,null,2))
  }));
  state.busy=false;
  if(!files.length){toast("No assets could be bundled. Some image hosts block browser downloads; try individual links.");return;}
  const blob=zipStore(files),url=URL.createObjectURL(blob),anchor=document.createElement("a");
  anchor.href=url;anchor.download="character-assets.zip";document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
  toast("ZIP archive created with "+files.length+" file(s).");
}
function crc32(bytes) {
  let crc=~0;
  for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (~crc)>>>0;
}
function zipStore(files) {
  const encoder=new TextEncoder(),local=[],central=[];
  let offset=0;
  for(const file of files) {
    const name=encoder.encode(file.name),data=file.data,crc=crc32(data);
    const header=new Uint8Array(30+name.length),view=new DataView(header.buffer);
    view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);
    view.setUint32(14,crc,true);view.setUint32(18,data.length,true);view.setUint32(22,data.length,true);
    view.setUint16(26,name.length,true);header.set(name,30);local.push(header,data);
    const entry=new Uint8Array(46+name.length),centralView=new DataView(entry.buffer);
    centralView.setUint32(0,0x02014b50,true);centralView.setUint16(4,20,true);centralView.setUint16(6,20,true);
    centralView.setUint32(16,crc,true);centralView.setUint32(20,data.length,true);centralView.setUint32(24,data.length,true);
    centralView.setUint16(28,name.length,true);centralView.setUint32(42,offset,true);entry.set(name,46);
    central.push(entry);offset+=header.length+data.length;
  }
  const centralSize=central.reduce((sum,item)=>sum+item.length,0),end=new Uint8Array(22),view=new DataView(end.buffer);
  view.setUint32(0,0x06054b50,true);view.setUint16(8,files.length,true);view.setUint16(10,files.length,true);
  view.setUint32(12,centralSize,true);view.setUint32(16,offset,true);
  return new Blob([...local,...central,end],{type:"application/zip"});
}
document.addEventListener("DOMContentLoaded",init);
})();