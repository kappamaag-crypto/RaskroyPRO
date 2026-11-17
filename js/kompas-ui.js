(function (root) {
  'use strict';
  var readerPromise=null;
  var READER='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';

  function reader() {
    if (root.XLSX && root.XLSX.read) return Promise.resolve(root.XLSX);
    if (readerPromise) return readerPromise;
    readerPromise=new Promise(function(resolve,reject){
      var node=document.createElement('script');
      node.src=READER;
      node.async=true;
      node.onload=function(){root.XLSX&&root.XLSX.read?resolve(root.XLSX):reject(new Error('Библиотека XLS/XLSX загрузилась некорректно.'));};
      node.onerror=function(){reject(new Error('Не удалось загрузить средство чтения Excel. Для первого использования требуется интернет. Можно сохранить ведомость в CSV и использовать обычный импорт.'));};
      document.head.appendChild(node);
    }).catch(function(e){readerPromise=null;throw e;});
    return readerPromise;
  }
  function node(tag,props,parent) {
    var el=document.createElement(tag);
    if(props)Object.keys(props).forEach(function(key){if(key==='text')el.textContent=String(props[key]);else if(key==='className')el.className=props[key];else el[key]=props[key];});
    if(parent)parent.appendChild(el);
    return el;
  }
  function renderRows(parsed) {
    var box=document.getElementById('kompas-rows');
    box.replaceChildren();
    var included=0, pieces=0, missed=0;
    var tbl=node('table',null,box);
    var thead=node('thead',null,tbl),tr=node('tr',null,thead);
    ['Выбрать','Стр.','Позиция','Профиль / сечение','Сталь','Длина, мм','Шт.','Проверка'].forEach(function(h){node('th',{text:h},tr);});
    var tb=node('tbody',null,tbl);
    parsed.rows.forEach(function(r){
      var row=node('tr',{className:r.status==='skip'?'kompas-skip':r.status==='review'?'kompas-review':''},tb);
      var cb=node('input',{type:'checkbox',checked:!!r.selected,disabled:r.status==='skip'},node('td',null,row));
      cb.setAttribute('aria-label','Импортировать строку '+r.row);
      cb.onchange=function(){r.selected=cb.checked;updateSummary(parsed);};
      node('td',{text:String(r.row)},row);
      [['pos','Позиция'],['profile','Профиль'],['grade','Марка стали'],['length','Длина мм'],['qty','Количество']].forEach(function(c){
        var td=node('td',null,row);
        var input=node('input',{type:'text',value:String(r[c[0]]==null?'':r[c[0]]),disabled:r.status==='skip'},td);
        input.setAttribute('aria-label',c[1]+' для строки '+r.row);
        input.oninput=function(){r[c[0]]=input.value;updateSummary(parsed);};
      });
      node('td',{text:r.reason|| (r.status==='skip'?'Исключено':'Распознано')},row);
    });
    updateSummary(parsed);
  }
  function selectedParts(parsed) {
    var errors=[],out=[];
    for(var i=0;i<parsed.rows.length;i++){
      var row=parsed.rows[i];
      if(!row.selected)continue;
      var profile=String(row.profile||'').trim(),l=root.KompasImport ? Number(String(row.length).trim().replace(',','.')):NaN;
      var qty=Number(String(row.qty).trim().replace(',','.'));
      if(!profile || !root.KompasImport.validLength(l) || !root.KompasImport.validQty(qty)) {
        errors.push('строка '+row.row+' (профиль, длина или количество)');
        continue;
      }
      out.push({pos:String(row.pos||'К-'+row.row).trim(),material:profile,grade:String(row.grade||'').trim(),length:l,qty:qty,note:String(row.note||'')});
    }
    return {parts:out,errors:errors};
  }
  function updateSummary(parsed) {
    var checked=selectedParts(parsed);
    var qty=checked.parts.reduce(function(n,p){return n+p.qty;},0);
    var length=checked.parts.reduce(function(n,p){return n+p.length*p.qty;},0);
    document.getElementById('kompas-summary').textContent=
      'Выбрано позиций: '+checked.parts.length+' · деталей: '+qty+' · чистая длина: '+Math.round(length*1000)/1000+' мм'+
      ' · требуют исправления: '+checked.errors.length+
      ' · изначально нераспознано: '+parsed.review+' · исключено: '+parsed.skipped;
  }
  async function open(file,commit) {
    if(!file || typeof commit!=='function')return;
    if(!/\.(?:xls|xlsx)$/i.test(file.name))throw new Error('Нужен файл КОМПАС .xls или .xlsx. Для CSV используется отдельная кнопка.');
    if(file.size>25*1024*1024)throw new Error('Файл больше 25 МБ. Уменьшите отчёт или используйте CSV.');
    var dialog=document.getElementById('kompas-dialog');
    var status=document.getElementById('kompas-status');
    var sheetEl=document.getElementById('kompas-sheet');
    var apply=document.getElementById('kompas-apply');
    var loadMsg='Загрузка библиотеки чтения Excel...';
    status.textContent=loadMsg;
    sheetEl.replaceChildren();
    document.getElementById('kompas-rows').replaceChildren();
    document.getElementById('kompas-summary').textContent='';
    dialog.showModal();
    try {
      var XLSX=await reader();
      status.textContent='Чтение ведомости '+file.name+'...';
      var workbook=XLSX.read(new Uint8Array(await file.arrayBuffer()),{type:'array',cellDates:false,cellFormula:false});
      var sheets=workbook.SheetNames.slice(0,30).map(function(name){
        return {name:name,rows:XLSX.utils.sheet_to_json(workbook.Sheets[name],{header:1,raw:false,blankrows:false,defval:''})};
      });
      var scan=root.KompasImport.selectSheet(sheets);
      var all=scan.sheets;
      for(var i=0;i<all.length;i++){
        var opt=node('option',{text:all[i].name+' ('+all[i].ready+' распознано, '+all[i].review+' проверить)'},sheetEl);
        opt.value=String(i);
      }
      var current=all[0];
      sheetEl.onchange=function(){current=all[Number(sheetEl.value)];renderRows(current);};
      renderRows(current);
      status.textContent='Файл: '+file.name+'. Подходящих листов: '+all.length+'. Отметьте нужные строки и проверьте все данные до импорта.';
      apply.onclick=async function(){
        var chosen=selectedParts(current);
        if(chosen.errors.length){alert('Исправьте выбранные строки: '+chosen.errors.slice(0,8).join(', '));return;}
        if(!chosen.parts.length){alert('Нет выбранных деталей. Проверьте распознавание и отметьте строки.');return;}
        var mode=document.getElementById('kompas-mode').value;
        apply.disabled=true;
        try {
          var accepted=await commit(chosen.parts,mode,file.name);
          if(accepted!==false) dialog.close();
        } catch(err) {
          alert('Не удалось перенести ведомость: '+err.message);
        } finally {apply.disabled=false;}
      };
    }catch(err){
      status.textContent='Ошибка: '+(err.message||err);
      document.getElementById('kompas-summary').textContent='Файл не изменил ни одной позиции калькулятора.';
    }
  }
  root.KompasImportUI={open:open,selectedParts:selectedParts};
})(typeof window!=='undefined'?window:globalThis);
