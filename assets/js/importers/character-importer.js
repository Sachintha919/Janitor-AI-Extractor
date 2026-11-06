export const FIELD_SCHEMA = [
  ["name","Character name",["name","char_name","character_name","title"]],
  ["description","Description",["description","desc","char_description"]],
  ["personality","Personality",["personality","persona"]],
  ["scenario","Scenario",["scenario","context"]],
  ["first_mes","First message",["first_mes","first_message","greeting","initial_message"]],
  ["alternate_greetings","Alternate greetings",["alternate_greetings","greetings"]],
  ["mes_example","Example dialogue",["mes_example","example_dialogue","example_messages"]],
  ["creator_notes","Creator notes",["creator_notes","notes"]],
  ["system_prompt","System prompt",["system_prompt","system"]],
  ["post_history_instructions","Post-history instructions",["post_history_instructions","jailbreak","jailbreak_prompt"]],
  ["creator","Creator",["creator","author"]],
  ["character_version","Character version",["character_version","version"]],
  ["tags","Tags",["tags"]],
  ["group_only_greetings","Group-only greetings",["group_only_greetings"]],
  ["extensions","Extensions",["extensions"]],
  ["character_book","Character book / lorebook",["character_book","characterBook"]]
].map(([key,label,aliases])=>({key,label,aliases,kind:["alternate_greetings","tags","group_only_greetings","extensions","character_book"].includes(key)?"json":"text"}));

const KNOWN = new Set(FIELD_SCHEMA.flatMap(field=>field.aliases.map(x=>x.toLowerCase())));
const WRAPPERS = new Set(["spec","spec_version","data","character","character_data","characterdata","bot"]);

export function cloneData(value) {
  if (value===undefined) return undefined;
  try { return JSON.parse(JSON.stringify(value)); } catch { return value; }
}
function isObject(value) { return Boolean(value)&&typeof value==="object"&&!Array.isArray(value); }
function findValue(root,aliases,maxDepth=7) {
  const queue=[{value:root,depth:0}],seen=new WeakSet();
  while(queue.length) {
    const current=queue.shift(),value=current.value;
    if(!value||typeof value!=="object"||seen.has(value)||current.depth>maxDepth) continue;
    seen.add(value);
    for(const alias of aliases) if(Object.prototype.hasOwnProperty.call(value,alias)&&value[alias]!==null&&value[alias]!=="") return value[alias];
    for(const child of Object.values(value)) if(child&&typeof child==="object"&&current.depth<maxDepth) queue.push({value:child,depth:current.depth+1});
  }
}
function characterRoot(source) {
  if(!isObject(source)) return {};
  if(isObject(source.data)) return source.data;
  for(const key of ["character","character_data","characterData","bot"]) if(isObject(source[key])) return source[key];
  return source;
}
function extractFields(source) {
  const root=characterRoot(source),character={},extraFields={};
  for(const field of FIELD_SCHEMA) {
    const value=findValue(root,field.aliases);
    if(value!==undefined) character[field.key]=cloneData(value);
  }
  for(const [key,value] of Object.entries(root)) if(!KNOWN.has(key.toLowerCase())&&!WRAPPERS.has(key.toLowerCase())) extraFields[key]=cloneData(value);
  return {character,extraFields};
}
const TEXT_LABELS=new Map([
  ["name","name"],["charactername","name"],["description","description"],["personality","personality"],["persona","personality"],
  ["scenario","scenario"],["firstmessage","first_mes"],["firstmes","first_mes"],["greeting","first_mes"],
  ["alternategreetings","alternate_greetings"],["exampledialogue","mes_example"],["mesexample","mes_example"],
  ["creatornotes","creator_notes"],["systemprompt","system_prompt"],["posthistoryinstructions","post_history_instructions"],
  ["creator","creator"],["author","creator"],["version","character_version"],["characterversion","character_version"],["tags","tags"]
]);
function parseText(raw) {
  const result={}; let current=null;
  for(const line of String(raw).split(/\r?\n/)) {
    const match=line.match(/^\s*([A-Za-z][\w -]{1,48})\s*:\s*(.*)$/);
    const key=match?TEXT_LABELS.get(match[1].toLowerCase().replace(/[\s_-]+/g,"")):null;
    if(key) { current=key; result[key]=match[2]; }
    else if(current&&line.trim()) result[current]+="\n"+line;
  }
  return result;
}
function collectResources(source) {
  const assets=new Map(),lorebooks=[],seen=new WeakSet();
  const imageData=/^data:image\/(?:png|jpeg|jpg|webp|gif|avif|svg\+xml);base64,/i;
  const imageExt=/\.(?:png|jpe?g|gif|webp|avif|svg)(?:[?#]|$)/i;
  function walk(value,path="Imported source",depth=0) {
    if(!value||typeof value!=="object"||depth>12||seen.has(value)) return;
    seen.add(value);
    if(Array.isArray(value)) { value.forEach((item,i)=>walk(item,path+"["+i+"]",depth+1)); return; }
    for(const [key,item] of Object.entries(value)) {
      if(/lore.?book|world.?info|character.?book/i.test(key)&&item&&typeof item==="object") lorebooks.push({name:key,data:cloneData(item),source:path});
      if(typeof item==="string") {
        const isImage=imageData.test(item)||(/^https?:\/\//i.test(item)&&(/image|avatar|thumbnail|background|cover|icon|photo|banner|^url$/i.test(key)||imageExt.test(item)));
        if(isImage&&!assets.has(item)) assets.set(item,{id:"asset-"+(assets.size+1),url:item,label:key||"Image",source:path,type:"image"});
      } else if(item&&typeof item==="object") walk(item,path+"."+key,depth+1);
    }
  }
  walk(source);
  return {assets:[...assets.values()],lorebooks};
}
export function extractJanitorSections(doc) {
  const character={},extraFields={};
  const normalise=value=>String(value||"")
    .replace(/\(\s*\d+\s*tokens?\s*\)/ig,"")
    .replace(/\s+/g," ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g," ")
    .trim();
  const map=new Map([
    ["personality","personality"],["persona","personality"],
    ["scenario","scenario"],["initial messages","first_mes"],
    ["initial message","first_mes"],["first message","first_mes"],
    ["first messages","first_mes"],["example dialogs","mes_example"],
    ["example dialog","mes_example"],["example dialogue","mes_example"],
    ["example dialogues","mes_example"],["description","description"],
    ["creator notes","creator_notes"],["alternate greetings","alternate_greetings"],
    ["system prompt","system_prompt"],["post history instructions","post_history_instructions"],
    ["character book","character_book"],["character lorebook","character_book"],
    ["lorebook","character_book"],["world info","character_book"],
    ["creator","creator"],["tags","tags"]
  ]);
  const sections=[...new Set(doc.querySelectorAll('[id^="info-"], [class*="characterInfoAccordionItem"]'))];
  for(const section of sections) {
    const button=section.querySelector("button[aria-controls]")||section.querySelector("button");
    const titleNode=button?.querySelector(".characterInfoAccordionTitleText, [class*='AccordionTitleText']")||button;
    const heading=normalise(titleNode?.textContent||"");
    if(!heading) continue;
    const panelId=button?.getAttribute("aria-controls");
    const panel=(panelId&&doc.getElementById(panelId))
      ||section.querySelector('[role="region"], [id^="panel-info-"], [class*="AccordionPanel"]');
    if(!panel) continue;
    const content=panel.querySelector(".characterInfoMarkdownContainer, [class*='MarkdownContainer']")||panel;
    const value=String(content.innerText||content.textContent||"")
      .replace(/\r/g,"")
      .replace(/\u00a0/g," ")
      .replace(/[ \t]+\n/g,"\n")
      .replace(/\n{3,}/g,"\n\n")
      .trim();
    if(!value) continue;
    const key=map.get(heading);
    if(key) {
      character[key]=character[key] ? character[key]+"\n\n"+value : value;
    } else {
      const label=heading.replace(/\b\w/g,c=>c.toUpperCase());
      extraFields[label||"Additional section "+(Object.keys(extraFields).length+1)]=value;
    }
  }
  if(!character.name) {
    const heading=doc.querySelector(".characterInfoMarkdownContainer h1, [class*='characterInfoMarkdownContainer'] h1");
    if(heading) character.name=heading.textContent.trim();
  }
  return {character,extraFields};
}
function parseHtml(raw,sourceUrl="") {
  const result={object:null,html:"",css:"",assets:[],meta:{},sections:{character:{},extraFields:{}}};
  if(typeof DOMParser==="undefined"||!/<(?:html|body|div|section|article|main)\b/i.test(raw)) return result;
  const doc=new DOMParser().parseFromString(raw,"text/html");
  for(const script of doc.querySelectorAll('script[type="application/json"],script#__NEXT_DATA__,script#__NUXT_DATA__')) {
    try { const value=JSON.parse(script.textContent||""); if(isObject(value)) { result.object=value; break; } } catch {}
  }
  const title=doc.querySelector('meta[property="og:title"]')?.content||doc.title;
  const description=doc.querySelector('meta[name="description"]')?.content||doc.querySelector('meta[property="og:description"]')?.content;
  if(title) result.meta.name=title;
  if(description) result.meta.description=description;
  result.sections=extractJanitorSections(doc);
  result.html=doc.querySelector('[class*="characterInfoAccordionWrapper"]')?.innerHTML
    ||doc.querySelector("main")?.innerHTML||doc.body?.innerHTML||"";
  result.css=[...doc.querySelectorAll("style")].map(node=>node.textContent||"").filter(Boolean).join("\n\n");

  const seen=new Set();
  const addAsset=(rawUrl,label,source)=>{
    if(!rawUrl) return;
    const candidate=String(rawUrl).trim().split(/\s+/)[0];
    let url=candidate;
    try { url=new URL(candidate,sourceUrl||doc.baseURI).href; } catch {}
    if(!/^(https?:\/\/|data:image\/)/i.test(url)||seen.has(url)) return;
    seen.add(url);
    result.assets.push({id:"html-image-"+result.assets.length,url,label:label||"Image",source,type:"image"});
  };
  for(const image of doc.querySelectorAll("img,source")) {
    const label=image.getAttribute("alt")||image.getAttribute("title")||"Image";
    addAsset(image.getAttribute("src"),label,"Janitor AI page image");
    addAsset(image.getAttribute("data-src"),label,"Janitor AI lazy-loaded image");
    addAsset(image.getAttribute("data-original"),label,"Janitor AI original image");
    addAsset(image.getAttribute("data-lazy-src"),label,"Janitor AI lazy image");
    const srcset=image.getAttribute("srcset")||"";
    for(const entry of srcset.split(",")) addAsset(entry.trim().split(/\s+/)[0],label,"Janitor AI responsive image");
  }
  for(const node of doc.querySelectorAll('[style*="background-image"]')) {
    const match=(node.getAttribute("style")||"").match(/url\(["']?([^"')]+)["']?\)/i);
    if(match) addAsset(match[1],"Background image","Janitor AI card background");
  }
  return result;
}
export function parseSource(raw,options={}) {
  const text=typeof raw==="string"?raw:JSON.stringify(raw??{});
  let sourceObject=null,validJson=false;
  try { sourceObject=typeof raw==="string"?JSON.parse(text):cloneData(raw); validJson=Boolean(sourceObject&&typeof sourceObject==="object"); } catch {}
  const html=parseHtml(text,options.sourceUrl||"");
  if(!sourceObject&&html.object) sourceObject=html.object;
  const extracted=sourceObject&&typeof sourceObject==="object"?extractFields(sourceObject):{character:parseText(text),extraFields:{}};
  Object.assign(extracted.character,html.sections?.character||{});
  Object.assign(extracted.extraFields,html.sections?.extraFields||{});
  if(!extracted.character.name&&html.meta.name) extracted.character.name=html.meta.name;
  if(!extracted.character.description&&html.meta.description) extracted.character.description=html.meta.description;
  const resources=sourceObject?collectResources(sourceObject):{assets:[],lorebooks:[]};
  const assets=[...new Map([...resources.assets,...html.assets].map(item=>[item.url,item])).values()];
  return {
    ...extracted,assets,lorebooks:resources.lorebooks,html:html.html,css:html.css,
    rawData:cloneData(sourceObject),rawText:text,rawType:validJson?"json":"text",
    sourceName:options.fileName||"Pasted source",sourceUrl:options.sourceUrl||""
  };
}
export async function readPNGCharacterCard(file) {
  const bytes=new Uint8Array(await file.arrayBuffer()),signature=[137,80,78,71,13,10,26,10];
  if(bytes.length<8||!signature.every((v,i)=>bytes[i]===v)||typeof DecompressionStream==="undefined") return null;
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),decoder=new TextDecoder();
  const inflate=async data=>new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate"))).arrayBuffer());
  const readNull=(data,start)=>{let end=start;while(end<data.length&&data[end]!==0)end++;return {value:decoder.decode(data.subarray(start,end)),next:end+1};};
  const decode=data=>{
    const value=decoder.decode(data).trim();
    try{return JSON.parse(value);}catch{}
    try {const binary=atob(value);return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary,c=>c.charCodeAt(0))));}catch{return null;}
  };
  for(let offset=8;offset+12<=bytes.length;) {
    const length=view.getUint32(offset); if(length>bytes.length-offset-12) break;
    const type=decoder.decode(bytes.subarray(offset+4,offset+8)),chunk=bytes.subarray(offset+8,offset+8+length);offset+=length+12;
    let keyword="",value=null;
    try {
      if(type==="tEXt") {const part=readNull(chunk,0);keyword=part.value;value=chunk.subarray(part.next);}
      else if(type==="zTXt") {const part=readNull(chunk,0);keyword=part.value;if(chunk[part.next]===0)value=await inflate(chunk.subarray(part.next+1));}
      else if(type==="iTXt") {
        const part=readNull(chunk,0);keyword=part.value;let cursor=part.next;const compressed=chunk[cursor++]===1;cursor++;
        cursor=readNull(chunk,cursor).next;cursor=readNull(chunk,cursor).next;value=chunk.subarray(cursor);if(compressed)value=await inflate(value);
      }
      if(["chara","ccv3","chara_card"].includes(keyword)&&value?.length) {const card=decode(value);if(card&&typeof card==="object")return card;}
    } catch {}
  }
  return null;
}
