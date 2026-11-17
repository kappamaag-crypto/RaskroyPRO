const test=require('node:test');
const assert=require('node:assert/strict');
const parser=require('../js/kompas-import.js');

// Structure and values reproduced from the user's original KOMPAS-3D Excel 97-2003 report:
// «пупупу.xls», sheet «Report», header: Наименование | Количество | Масса | Длина профиля.
const header=['Наименование','Количество','Масса','Длина профиля'];
const name='Профиль@/Труба 40х40х2,5 ГОСТ 8639-82 / Ст3пс ГОСТ 13663-86';
const rows=[
 header,
 ['Основание',1,7.510773277436887,''],
 ['Пластина для колес',4,1.5552390741640911,''],
 [name+' @/L = 85 мм',4,0.9125430754720052,85],
 [name+' @/L = 285 мм',4,3.1664108226993823,285],
 [name+' @/L = 470 мм',2,2.6028727085401044,470],
 [name+' @/L = 500 мм',2,2.8174031687002103,500]
];
test('KOMPAS real-export structure recognises four tube cuts and excludes plates',()=>{
 const result=parser.parseRows(rows,'Report');
 assert.equal(result.ready,4);
 assert.equal(result.skipped,2);
 assert.equal(result.review,0);
 const parts=result.rows.filter(x=>x.selected);
 assert.equal(parts.reduce((n,x)=>n+x.qty,0),12);
 assert.equal(parts.reduce((n,x)=>n+x.length*x.qty,0),3420);
 assert.deepEqual(parts.map(x=>x.length),[85,285,470,500]);
 for(const x of parts){
  assert.equal(x.profile,'Труба 40х40х2,5 ГОСТ 8639-82');
  assert.equal(x.grade,'Ст3пс ГОСТ 13663-86');
  assert.equal(x.status,'ok');
  assert.match(x.note,/Report/);
 }
 assert.equal(result.rows.find(x=>x.status==='skip').selected,false);
});
test('KOMPAS 3D name and engineering steel grade detected without length column',()=>{
 const parsed=parser.parseRows([['Наименование','Количество'],[name+' @/L = 500 мм',2]],'Report');
 assert.equal(parsed.ready,1);
 assert.equal(parsed.rows[0].length,500);
 assert.equal(parsed.rows[0].grade,'Ст3пс ГОСТ 13663-86');
});
