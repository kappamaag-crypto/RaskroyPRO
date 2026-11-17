(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KompasImport = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const PROFILE = /(?:труб[аы]|швеллер|уголок|уголков|двутавр|балка|арматур|профил[ьи]|круг(?:лый)?|пруток|полоса|квадрат(?:ный)?|рельс)/i;
  const HEADER = {
    pos: /^(?:поз(?:иция)?\.?|№\s*(?:поз)?|обозначение|поз\.)$/i,
    profile: /(?:наименование|профиль|сечение|материал|прокат|описание)/i,
    grade: /(?:марка\s*стали|сталь|марка\s*материала)/i,
    length: /(?:длина|дл\.?\s*(?:мм)?|length)/i,
    qty: /(?:количество|кол\.?\s*(?:шт)?|кол-во|шт\.?|qty)/i
  };

  function text(x) { return String(x == null ? '' : x).replace(/\u00a0/g, ' ').replace(/[\u200b-\u200d\ufeff]/g, '').trim(); }
  function num(x) {
    const s = text(x).replace(/\s+/g, '').replace(',', '.');
    if (!/^\d+(?:\.\d+)?$/.test(s)) return NaN;
    return Number(s);
  }
  function validLength(x) { return Number.isFinite(x) && x > 0 && x <= 100000000 && Math.abs(Math.round(x * 1000) - x * 1000) < 1e-5; }
  function validQty(x) { return Number.isSafeInteger(x) && x > 0 && x <= 10000000; }
  function lengthFromDescription(s) {
    const x = text(s);
    const m = x.match(/(?:^|[^а-яёa-z0-9])(?:L|ℓ|длина|дл\.?|дл\s+профиля)\s*[:=]\s*(\d+(?:[,.]\d{1,3})?)(?:\s*(?:мм|mm))?(?=$|[^\d,.])/i);
    return m ? Number(m[1].replace(',', '.')) : NaN;
  }
  function stripLength(s) {
    return text(s).replace(/(?:\s*[@\/;,-]*\s*(?:L|ℓ|длина|дл\.?)(?:\s*профиля)?\s*[:=]\s*\d+(?:[,.]\d+)?\s*(?:мм|mm)?)+\s*$/gi, '').replace(/[\s\/;,]+$/g, '').trim();
  }
  function parseProfile(full, gradeCell) {
    let combined = stripLength(full);
    let grade = text(gradeCell);
    const separated = combined.match(/^(.*?)\s*\/\s*(.+)$/);
    if (separated && /^(?:Ст\s*\d+\s*(?:пс|сп|кп)?|С\s*\d{3}|09Г2С|10ХСНД|[0-9]{2}Х[0-9A-ЯЁ-]*)(?=\s|$)/i.test(separated[2])) {
      combined = separated[1].trim();
      if (!grade) grade = separated[2].trim();
    } else {
      const tail = combined.match(/^(.*?)\s+((?:Ст\s*\d+\s*(?:пс|сп|кп)?|С\s*\d{3}|09Г2С|10ХСНД)(?:\s+ГОСТ\s*[\d-]+)?)$/i);
      if (tail) {
        combined = tail[1].trim();
        if (!grade) grade = tail[2].trim();
      }
    }
    return {profile: combined.replace(/\s+/g, ' ').trim(), grade: grade.replace(/\s+/g, ' ').trim()};
  }
  function findColumns(header) {
    const out = {pos:-1, profile:-1, grade:-1, length:-1, qty:-1};
    const names = header.map(x => text(x).toLowerCase());
    for (const key of Object.keys(out)) out[key] = names.findIndex(v => HEADER[key].test(v) && !/^column\d+$/i.test(v));
    return out;
  }
  function headerAt(rows) {
    let best = {i:-1, cols:{pos:-1,profile:-1,grade:-1,length:-1,qty:-1}, score:0};
    for (let i = 0; i < Math.min(rows.length, 45); i++) {
      const cols = findColumns(rows[i]);
      let score = Object.values(cols).filter(n=>n>=0).length;
      if (cols.qty >= 0) score += 2;
      if (cols.profile >= 0) score += 2;
      if (cols.length >= 0) score += 1;
      if (score > best.score) best = {i, cols, score};
    }
    return best.score >= 3 ? best : {i:-1,cols:{pos:-1,profile:-1,grade:-1,length:-1,qty:-1},score:0};
  }
  function parseRows(rows, sheetName) {
    if (!Array.isArray(rows)) throw new TypeError('Ожидалась таблица строк.');
    const hdr = headerAt(rows), list = [];
    for (let i = hdr.i + 1; i < rows.length && list.length < 1500; i++) {
      const cells = (Array.isArray(rows[i]) ? rows[i] : []).map(text);
      if (!cells.some(Boolean)) continue;
      if (cells.some(x => /^\s*(?:итого|всего|общая масса|раздел|продолжение таблицы)\b/i.test(x)) && !cells.some(x => PROFILE.test(x))) continue;
      if (i !== hdr.i && findColumns(cells).qty >= 0 && findColumns(cells).profile >= 0) continue;
      const joined = cells.filter(Boolean).join(' | ');
      const profileCell = hdr.cols.profile >= 0 ? cells[hdr.cols.profile] : '';
      const sourceName = PROFILE.test(profileCell) ? profileCell : (cells.find(x=>PROFILE.test(x)) || '');
      if (!sourceName) {
        if (cells.some(x => /(?:основание|пластин|болт|гайка|шайба|закл[её]п)/i.test(x)))
          list.push({sheet:sheetName||'', row:i+1, status:'skip', selected:false, pos:'', profile:'', grade:'', length:'', qty:'', note:joined.slice(0,220), reason:'Не относится к линейному профилю'});
        continue;
      }
      const parsed = parseProfile(sourceName, hdr.cols.grade >= 0 ? cells[hdr.cols.grade] : '');
      let length = hdr.cols.length >= 0 ? num(cells[hdr.cols.length]) : NaN;
      if (!validLength(length)) length = lengthFromDescription(sourceName);
      if (!validLength(length)) length = lengthFromDescription(joined);
      let qty = hdr.cols.qty >= 0 ? num(cells[hdr.cols.qty]) : NaN;
      if (!validQty(qty)) {
        // Fallback for KOMPAS reports with anonymous column1/column2/... headings.
        // Rightmost independent whole number is typically quantity; do not use dimensions or position.
        const other = cells.map((x,j)=>({j,x,n:num(x)}))
          .filter(x => x.j !== hdr.cols.length && x.j !== hdr.cols.pos && x.x !== sourceName && validQty(x.n) && x.n !== length);
        if (other.length) qty = other[other.length-1].n;
      }
      const pos = hdr.cols.pos >= 0 ? cells[hdr.cols.pos] : '';
      const reason = [
        !parsed.profile || !PROFILE.test(parsed.profile) ? 'Профиль не распознан' : '',
        !validLength(length) ? 'Укажите длину профиля (мм)' : '',
        !validQty(qty) ? 'Укажите количество (шт.)' : ''
      ].filter(Boolean).join('; ');
      list.push({
        sheet:sheetName||'',row:i+1,status:reason?'review':'ok',selected:!reason,
        pos:pos || 'К-' + String(i+1).padStart(3,'0'),
        profile:parsed.profile,grade:parsed.grade,
        length:validLength(length)?length:'',qty:validQty(qty)?qty:'',
        note: 'КОМПАС, лист '+(sheetName||'1')+', строка '+(i+1),
        reason, source:joined.slice(0,280)
      });
    }
    return {rows:list, ready:list.filter(x=>x.status==='ok').length, review:list.filter(x=>x.status==='review').length, skipped:list.filter(x=>x.status==='skip').length, header:hdr};
  }
  function selectSheet(sheets) {
    if (!Array.isArray(sheets) || !sheets.length) throw new Error('Книга не содержит листов.');
    const parsed=sheets.map(x=>({name:x.name, ...parseRows(x.rows,x.name)}));
    parsed.sort((a,b)=>(b.ready*4+b.review)-(a.ready*4+a.review));
    return {best:parsed[0],sheets:parsed};
  }
  return {parseRows,selectSheet,validLength,validQty,lengthFromDescription,parseProfile};
});
