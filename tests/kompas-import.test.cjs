const test=require('node:test');
const assert=require('node:assert/strict');
const importer=require('../js/kompas-import.js');

const name='Труба квадратная 40х40х2,5 ГОСТ 8639-82 / Ст3пс ГОСТ 13663-86';
const expected=[{l:85,q:4},{l:285,q:4},{l:470,q:2},{l:500,q:2}];
function sampleRows(header){
 const base=expected.map((x,i)=>[
  'К-'+String(i+1).padStart(3,'0'),
  name+' @/L = '+x.l,
  x.q
 ]);
 return header?[['Спецификация проекта'],['Позиция','Наименование','Количество'],...base,['5','Основание',1],['6','Пластина для колёс',4]]:
 [['column1','column2','column3'],...base,['Основание','',1]];
}

test('Преобразование примера КОМПАС из XLS: 4 позиции, 12 деталей, 3420 мм',()=>{
 const data=importer.parseRows(sampleRows(true),'Report');
 const ok=data.rows.filter(r=>r.status==='ok');
 assert.equal(ok.length,4);
 assert.equal(data.skipped,2);
 assert.deepEqual(ok.map(r=>r.length),[85,285,470,500]);
 assert.deepEqual(ok.map(r=>r.qty),[4,4,2,2]);
 assert.equal(ok.reduce((s,r)=>s+r.qty,0),12);
 assert.equal(ok.reduce((s,r)=>s+r.length*r.qty,0),3420);
 for(const row of ok){
  assert.equal(row.profile,'Труба квадратная 40х40х2,5 ГОСТ 8639-82');
  assert.equal(row.grade,'Ст3пс ГОСТ 13663-86');
  assert.equal(row.selected,true);
 }
});
test('Распознаётся экспорт КОМПАС с заголовками column1/column2/column3',()=>{
 const data=importer.parseRows(sampleRows(false),'Report');
 assert.equal(data.ready,4);
 assert.equal(data.skipped,1);
 assert.equal(data.rows.filter(x=>x.selected).reduce((s,x)=>s+x.qty,0),12);
});
test('Поддерживаются раздельные поля «Длина, мм» и «Количество»',()=>{
 const rows=[
 ['Позиция','Наименование','Длина, мм','Количество','Марка стали'],
 ['1','Уголок 50х50х5 ГОСТ 8509-93','1570','3','09Г2С'],
 ['2','Швеллер 10П','1000,25','1','С245']
 ];
 const parsed=importer.parseRows(rows,'Детали');
 assert.equal(parsed.ready,2);
 assert.deepEqual(parsed.rows.map(r=>r.length),[1570,1000.25]);
 assert.deepEqual(parsed.rows.map(r=>r.grade),['09Г2С','С245']);
});
test('Профили без длины или количества не выбираются автоматически',()=>{
 const rows=[['Позиция','Наименование','Количество'],['1','Труба 40х40х2 ГОСТ 8639-82',4],['2','Полоса 40x5 L=1500','']];
 const parsed=importer.parseRows(rows,'Лист1');
 assert.equal(parsed.review,2);
 assert.equal(parsed.rows.every(r=>r.selected===false),true);
 assert.match(parsed.rows[0].reason,/длину/);
 assert.match(parsed.rows[1].reason,/количество/);
});
test('Не принимается длина из размеров сечения без отдельного L',()=>{
 assert.ok(Number.isNaN(importer.lengthFromDescription('Труба 40×40×2,5 ГОСТ 8639-82')));
 assert.equal(importer.lengthFromDescription('Уголок 40×4 /L=6000,5 мм'),6000.5);
 assert.equal(importer.validLength(6000.1234),false);
 assert.equal(importer.validQty(2.5),false);
});
test('Выбирается лучший лист книги, а не титульный',()=>{
 const out=importer.selectSheet([{name:'Титул',rows:[['Отчёт КОМПАС'],['2026']]},{name:'Report',rows:sampleRows(true)}]);
 assert.equal(out.best.name,'Report');
 assert.equal(out.best.ready,4);
});
