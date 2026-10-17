/* TEST ONLY. Explicit API double, never in manifest.json. */
(function () {
  const data = {}, listeners = new Set(), receivers = new Set();
  const T = globalThis.GTNTest = {failNextWrite:false,writes:[],popupStatus:null,unsupported:false};
  const clone = v => v === undefined ? undefined : structuredClone(v);
  const emit = changes => queueMicrotask(()=>{for(const fn of listeners)fn(clone(changes),'local');});
  const runtime={id:'gtn-test-runtime',onMessage:{addListener:f=>receivers.add(f),removeListener:f=>receivers.delete(f)}};
  T.send=async type=>{
    if(T.unsupported)throw Error('mock: no receiver');
    if(T.popupStatus)return clone(T.popupStatus);
    return new Promise((resolve,reject)=>{let replied=false;for(const f of receivers)f({type},{id:runtime.id},v=>{replied=true;resolve(clone(v));});if(!replied)reject(Error('mock: no receiver'));});
  };
  globalThis.chrome={runtime,tabs:{query:async()=>[{id:1}],sendMessage:async(_id,msg)=>T.send(msg.type)},storage:{
    local:{
      get:async keys=>keys===null?clone(data):Object.fromEntries((Array.isArray(keys)?keys:[keys]).filter(k=>k in data).map(k=>[k,clone(data[k])])),
      set:async entries=>{if(T.failNextWrite){T.failNextWrite=false;throw Error('mock: storage full');}const c={};T.writes.push(clone(entries));for(const[k,v]of Object.entries(entries)){c[k]={oldValue:clone(data[k]),newValue:clone(v)};data[k]=clone(v);}emit(c);},
      remove:async keys=>{if(T.failNextWrite){T.failNextWrite=false;throw Error('mock: storage full');}const c={};for(const k of Array.isArray(keys)?keys:[keys]){c[k]={oldValue:clone(data[k])};delete data[k];}emit(c);},
      clear:async()=>{const c={};for(const k of Object.keys(data)){c[k]={oldValue:clone(data[k])};delete data[k];}emit(c);}
    },onChanged:{addListener:f=>listeners.add(f),removeListener:f=>listeners.delete(f)}
  }};
})();
