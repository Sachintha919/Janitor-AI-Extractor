const CHANNEL="JANITOR_EXTRACTOR_BRIDGE",VERSION=1,HEARTBEAT=2500,TIMEOUT=8500;
function nonce() {return globalThis.crypto?.randomUUID?globalThis.crypto.randomUUID():"nx-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2);}
export class ExtensionBridge {
  constructor({onStatus=()=>{},onMessage=()=>{}}={}) {
    this.onStatus=onStatus;this.onMessage=onMessage;this.nonce=nonce();this.connected=false;this.lastSeen=0;
    this.handle=this.handle.bind(this);window.addEventListener("message",this.handle);this.probe();
    this.timer=window.setInterval(()=>this.tick(),HEARTBEAT);
  }
  envelope(type,payload={}) {return {channel:CHANNEL,source:"janitor-extractor-app",type,protocolVersion:VERSION,nonce:this.nonce,payload};}
  probe() {window.postMessage(this.envelope("HELLO",{sentAt:new Date().toISOString()}),window.location.origin);}
  tick() {
    if(!this.connected){this.probe();return;}
    if(Date.now()-this.lastSeen>TIMEOUT){this.setStatus(false);this.probe();return;}
    window.postMessage(this.envelope("PING",{sentAt:new Date().toISOString()}),window.location.origin);
  }
  send(type,payload={}) {if(!this.connected)return false;window.postMessage(this.envelope(type,payload),window.location.origin);return true;}
  handle(event) {
    if(event.source!==window||event.origin!==window.location.origin)return;
    const message=event.data;
    if(!message||message.channel!==CHANNEL||message.source!=="janitor-extractor-extension"||message.protocolVersion!==VERSION||message.nonce!==this.nonce)return;
    if(message.type==="HELLO_ACK"){this.lastSeen=Date.now();this.setStatus(true,message.payload?.extensionVersion||"unknown");this.onMessage({type:"EXTENSION_READY",payload:message.payload||{}});return;}
    if(!this.connected)return;
    this.lastSeen=Date.now();
    if(message.type!=="PONG"&&["CAPTURED_REQUEST","CHARACTER_DATA","CAPTURE_STATE","EXTENSION_ERROR"].includes(message.type))this.onMessage(message);
  }
  setStatus(connected,version=null) {
    if(this.connected===connected&&(!connected||this.version===version))return;
    this.connected=connected;this.version=connected?String(version||"unknown"):null;
    this.onStatus({connected,extensionVersion:this.version,lastSeen:connected?new Date(this.lastSeen).toISOString():null});
  }
  destroy(){window.clearInterval(this.timer);window.removeEventListener("message",this.handle);this.setStatus(false);}
}
