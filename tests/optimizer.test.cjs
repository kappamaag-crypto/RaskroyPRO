'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let code=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(code,'Embedded solver script not found');
const cutoff=code.indexOf('\nrenderAll();events();');
assert.ok(cutoff>0,'Do not execute UI bootstrap inside unit tests');
code=code.slice(0,cutoff);
const context=vm.createContext({console,localStorage:{getItem(){return null;}},document:{querySelector(){return null;},querySelectorAll(){return [];}}});
vm.runInContext(code,context,{filename:'index-script.js'});
const run=(config,mode)=>{context.config={...config,searchMode:mode};return vm.runInContext('solveAll(config)',context)};
function validPlan(config,result){
 const expected=config.parts.reduce((a,p)=>a+p.qty,0);
 assert.equal(result.stats.pieceCount,expected);
 const used=new Map();
 const actualParts=new Map();
 for(const b of result.bars){
  assert.ok(b.tail>=-1e-7,'negative tail');
  assert.ok(Math.abs(b.stock.length-b.tail-b.trim-b.kerf-b.pieceLength)<1e-5,'bar length conservation');
  used.set(b.stock.id,(used.get(b.stock.id)||0)+1);
  for(const p of b.entries)actualParts.set(p.id,(actualParts.get(p.id)||0)+1);
 }
 for(const p of config.parts)assert.equal(actualParts.get(p.id),p.qty,'part count must be preserved');
 for(const stock of config.stocks)assert.ok((used.get(stock.id)||0)<=stock.qty,'stock quota exceeded');
 assert.ok(Math.abs(result.stats.stockLength-result.stats.raw-result.stats.kerf-result.stats.trim-result.stats.tail)<1e-5,'global length conservation');
}
function base(parts,stocks,opts={}){return {parts:parts.map(([length,qty],i)=>({id:i+1,pos:'D'+(i+1),material:'A',grade:'S',length,qty})),stocks:stocks.map(([length,qty,kind,price],i)=>({id:i+10,material:'A',grade:'S',length,qty,price:price??null,kind:kind||'new'})),kerf:opts.kerf??3,trim:opts.trim??0,remnantMin:opts.remnantMin??500,objective:opts.objective??'purchase',warehousePolicy:opts.warehousePolicy??'economic'};}
test('exact B&B proves optimum for uniform 6m bars',()=>{
 const c=base([[1700,10],[1200,3],[500,6]],[[6000,100,'new',null]]);
 const r=run(c,'exact');validPlan(c,r);
 assert.equal(r.stats.newBars,5);
 assert.equal(r.proofs[0].proven,true);
 assert.match(r.proofs[0].method,/Branch & Bound/);
});
test('integer pattern enumeration proves optimal solution for mixed stocks',()=>{
 const c=base([[700,2],[400,2]],[[1200,5,'new',80],[1500,5,'new',90]],{kerf:0,trim:0,remnantMin:300});
 const r=run(c,'exact');validPlan(c,r);
 assert.equal(r.proofs[0].proven,true);
 assert.equal(r.proofs[0].method,'Integer patterns');
});
test('strict consumption can use more remnants than economic',()=>{
 const c=base([[5000,2],[250,4]],[[6000,99,'new',100],[1000,4,'remnant',null]],{kerf:0,remnantMin:300});
 const e=run(c,'deep');validPlan(c,e);
 c.warehousePolicy='strict';const s=run(c,'deep');validPlan(c,s);
 assert.ok(s.stats.remnantsUsed>e.stats.remnantsUsed);
 assert.equal(s.stats.remnantsUsed,4);
});
test('fractional millimeter parts, bars, trim and kerf conserve length',()=>{
 const c=base([[1200.5,1],[900.25,2]],[[4000.5,4,'new',50]],{kerf:2.5,trim:1.25});
 for(const mode of ['quick','balanced','deep','exact'])validPlan(c,run(c,mode));
});
test('larger exact request is explicitly not certified',()=>{
 const c=base([[900,30]],[[2100,100,'new',50],[2500,100,'new',60]],{kerf:0,trim:0});
 const r=run(c,'exact');validPlan(c,r);
 assert.equal(r.proofs[0].proven,false);
});
test('all deeper modes preserve or improve metric across deterministic inputs',()=>{
 let x=0x198401;const rnd=()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/0x100000000};
 for(let i=0;i<100;i++){
  const pieces=Array.from({length:1+Math.floor(rnd()*4)},()=>[200+Math.floor(rnd()*200)*10+(i%5===0?.5:0),1+Math.floor(rnd()*4)]);
  const m=Math.max(...pieces.map(p=>p[0]));
  const stocks=Array.from({length:1+Math.floor(rnd()*3)},()=>[m+200+Math.floor(rnd()*300)*10,99,'new',50+Math.floor(rnd()*120)]);
  if(i%3===0)stocks.push([m+600,3,'remnant',null]);
  const c=base(pieces,stocks,{kerf:i%3===0?.5:3,objective:['purchase','cost','waste'][i%3],warehousePolicy:i%2?'strict':'economic',remnantMin:500});
  let last=null;
  for(const mode of ['quick','balanced','deep','exact']){
   const r=run(c,mode);validPlan(c,r);
   const score=vm.runInContext('metric(scoreStats,config,config.stocks.every(s=>s.kind===\'remnant\'||s.price!==null))',Object.assign(context,{scoreStats:r.stats,config:c}));
   const scoreArr=Array.from(score);
   if(last){const isWorse=vm.runInContext('better(previousScore,currentScore)',Object.assign(context,{previousScore:last,currentScore:scoreArr}));assert.equal(isWorse,false,'mode regression on case '+i+' ('+mode+')');}
   last=scoreArr;
  }
 }
});


test('local search moves a detail to another bar and releases its source bar',()=>{
 const cfg=base([[400,1],[600,1]],[[1000,2,'new',50]],{kerf:0,trim:0,remnantMin:350});
 const stock=cfg.stocks[0],p400=cfg.parts[0],p600=cfg.parts[1];
 const bars=[{stock,entries:[p400],pieceLength:400,kerf:0,trim:0,tail:600},{stock,entries:[p600],pieceLength:600,kerf:0,trim:0,tail:400}];
 context.swapBars=bars;context.swapConfig=cfg;
 const result=vm.runInContext('localSearchSwap(swapBars,swapConfig,true,4)',context);
 assert.equal(result.length,1,'single-bar plan must result after relocation');
 assert.equal(result[0].tail,0);
 assert.equal(result[0].entries.length,2);
});

test('local search exchanges two pieces to reduce unusable end pieces',()=>{
 const cfg=base([[700,1],[400,1]],[[1000,1,'new',60],[800,1,'new',40]],{kerf:0,trim:0,remnantMin:350,objective:'waste'});
 const [s1000,s800]=cfg.stocks,[p700,p400]=cfg.parts;
 const bars=[{stock:s1000,entries:[p700],pieceLength:700,kerf:0,trim:0,tail:300},{stock:s800,entries:[p400],pieceLength:400,kerf:0,trim:0,tail:400}];
 context.swapBars=bars;context.swapConfig=cfg;
 const result=vm.runInContext('localSearchSwap(swapBars,swapConfig,true,4)',context);
 assert.equal(result.length,2);
 assert.equal(result[0].entries[0].length,400);
 assert.equal(result[1].entries[0].length,700);
 assert.equal(result[0].tail,600);
 assert.equal(result[1].tail,100);
});
