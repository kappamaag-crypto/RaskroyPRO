'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const embedded=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(embedded,'missing inline JS');
const cutoff=embedded.indexOf('\nrenderAll();events();');
assert.ok(cutoff>0,'UI bootstrap marker missing');
const js=embedded.slice(0,cutoff);
const context=vm.createContext({console,localStorage:{getItem(){return null;}},document:{querySelector(){return null;},querySelectorAll(){return [];}}});
vm.runInContext(js,context,{filename:'index.html script'});
const issue=message=>vm.runInContext(`describeValidationIssue(${JSON.stringify(message)})`,context);

test('empty source stock points to the stock block and add button',()=>{
 const result=issue('Добавьте хотя бы один исходный хлыст.');
 assert.equal(result.block,'block-03');
 assert.equal(result.fallback,'addstock');
});
test('part length and quantity errors point to the exact detail field',()=>{
 const length=issue('Деталь 2: длина должна быть положительной.');
 assert.deepEqual({...length},{message:'Деталь 2: длина должна быть положительной.',block:'block-02',table:'parts',rowIndex:1,field:'length',fallback:'addpart'});
 const quantity=issue('Деталь 3: количество должно быть целым положительным числом.');
 assert.equal(quantity.block,'block-02');
 assert.equal(quantity.rowIndex,2);
 assert.equal(quantity.field,'qty');
});
test('stock length error points to its stock table row',()=>{
 const result=issue('Хлыст 4: длина должна быть положительной.');
 assert.equal(result.block,'block-03');
 assert.equal(result.table,'stocks');
 assert.equal(result.rowIndex,3);
 assert.equal(result.field,'length');
});
test('page contains the sticky accessible banner and no duplicated summary error',()=>{
 assert.match(html,/id="error-banner"[^>]*role="alert"[^>]*aria-live="assertive"/);
 assert.match(html,/\.error-banner\{position:sticky/);
 assert.match(html,/data-error-target="validation"/);
 assert.match(html,/Исправьте данные по сообщению над формой/);
 assert.doesNotMatch(html,/\$\('#panel-summary'\)\.innerHTML='<div class="error">'\+esc\(e\.message\)/);
});
