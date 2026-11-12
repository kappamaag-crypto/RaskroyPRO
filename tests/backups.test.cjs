'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const embedded=source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(embedded,'missing inline JS');
const cutoff=embedded.indexOf('\nrenderAll();events();');
assert.ok(cutoff>0);
const js=embedded.slice(0,cutoff);
function environment(saved=null){
 const storage={value:saved?JSON.stringify(saved):null,setItem(k,v){this.value=String(v);},getItem(){return this.value;}};
 const context=vm.createContext({console,localStorage:storage,document:{querySelector(){return null;},querySelectorAll(){return [];}},window:{},clearTimeout,setTimeout});
 vm.runInContext(js,context,{filename:'index.html script'});
 return {context,storage,run:(expr)=>vm.runInContext(expr,context)};
}
test('migration preserves order, parts, warehouse and journal',()=>{
 const legacy={version:6,meta:{order:'LEGACY-001'},settings:{kerf:2},parts:[{id:1,pos:'D1',material:'X',length:950,qty:1}],stocks:[{id:2,material:'X',length:1200,qty:5,kind:'remnant'}],journal:[{order:'ORD-1'}],bookedOrders:['ord-1']};
 const {run}=environment(legacy);
 assert.equal(run('state.version'),7);
 assert.equal(run('state.meta.order'),'LEGACY-001');
 assert.equal(run('state.stocks[0].qty'),5);
 assert.equal(run('state.journal.length'),1);
 assert.equal(run('state.bookedOrders[0]'),'ord-1');
 assert.equal(run('startupLock'),true,'migration must wait until old snapshot exists');
});
test('unknown future data cannot be silently overwritten',()=>{
 const future={version:999,parts:[],stocks:[],settings:{}};
 const {run,storage}=environment(future);
 assert.equal(run('startupLock'),true);
 assert.match(run('startupLoadError'),/более новой версии/);
 assert.equal(run('persist()'),false);
 assert.equal(JSON.parse(storage.value).version,999);
});
test('normalizer rejects damaged input instead of creating demo project',()=>{
 const {run}=environment();
 assert.equal(run('state.version'),7);
 for(const payload of ['{parts:[]}', '{version:7,parts:null,stocks:[]}', '{version:800,parts:[],stocks:[]}']){
  const value=payload.replaceAll("'",'"');
  assert.throws(()=>run('normalizeProject('+value+')'));
 }
});
test('checksum changes when data changes',()=>{
 const {run}=environment();
 const before=run("projectFingerprint(JSON.stringify({stocks:[{qty:1}]}))");
 const after=run("projectFingerprint(JSON.stringify({stocks:[{qty:2}]}))");
 assert.notEqual(before,after);
});