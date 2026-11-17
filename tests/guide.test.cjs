'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const guide=fs.readFileSync(path.join(root,'instrukciya.html'),'utf8');
const app=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'css/seo-pages.css'),'utf8');

test('complete guide has consistent metadata, 20 topics and working TOC links',()=>{
  assert.match(guide,/<html lang="ru">/);
  assert.match(guide,/<link rel="canonical" href="https:\/\/raskroy\.spk-effa\.ru\/instrukciya\.html">/);
  assert.equal((guide.match(/<h1\b/g)||[]).length,1);
  const ids=[...guide.matchAll(/<section class="seo-panel seo-step" id="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(ids.length,20);
  assert.equal(new Set(ids).size,20);
  for(const id of ids)assert.ok(guide.includes('href="#'+id+'"'),'TOC anchor missing: '+id);
  for(const feature of ['КОМПАС-3D','Сводка','Карты раскроя','Сравнение длин','Журнал операций','Резервные копии','JSON','CSV','Excel','Провести склад','Сбросить на пример','Отчёт Excel','Новый заказ','SheetJS']){
    assert.ok(guide.includes(feature),'Feature absent from manual: '+feature);
  }
  assert.doesNotMatch(guide,/<script\b/i);
});
test('built-in guide links full manual and original calculator UI remains functional',()=>{
  assert.match(app,/<div id="panel-guide" class="tabPanel guide hide">/);
  assert.match(app,/подробную инструкцию \(20 разделов\)/);
  assert.match(app,/href="\/instrukciya\.html"/);
  for(const id of ['solve','book','neworder','save','load','xlsx','csv','coords','print','importcsv','importkompas','pasteparts','pastestocks','snapshot-now','backup-list']){
    assert.ok(app.includes('id="'+id+'"'),'App UI control missing: '+id);
  }
});
test('guide styles support mobile tables and printed version',()=>{
  assert.match(css,/\.seo-page \.guide-toc/);
  assert.match(css,/\.seo-page \.guide-table-wrap/);
  assert.match(css,/@media\(max-width:680px\)/);
  assert.match(css,/@media print/);
});
