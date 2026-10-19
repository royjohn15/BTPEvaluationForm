// Backend for the Project Evaluation form.
// Paste into Extensions → Apps Script of the Google Sheet, then deploy as a Web app
// (Execute as: Me, Who has access: Anyone). See README.md.

const ADMIN_PASSWORD = 'change-me';

// Sheet tabs. "Students" must exist (A: Roll No, B: Name, row 1 = headers).
// "Criteria" and "Grades" are created automatically if missing.
const STUDENTS = 'Students';
const CRITERIA = 'Criteria';
const GRADES = 'Grades';
const FIXED_COLS = ['Timestamp', 'Evaluator', 'Roll No', 'Name', 'Total'];

function doGet(e) {
  const p = e.parameter || {};
  if (p.action === 'init') {
    return json({
      students: getStudents(),
      criteria: getCriteria(),
      graded: p.evaluator ? getGradedBy(p.evaluator) : {}
    });
  }
  return json({ error: 'Unknown action' });
}

function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (d.action === 'grade') return json(saveGrade(d));
    if (d.action === 'login') return json({ ok: d.password === ADMIN_PASSWORD });
    if (d.action === 'saveCriteria') {
      if (d.password !== ADMIN_PASSWORD) return json({ error: 'Wrong admin password' });
      return json(saveCriteria(d.criteria));
    }
    return json({ error: 'Unknown action' });
  } catch (err) {
    return json({ error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (headers) sh.appendRow(headers);
  }
  return sh;
}

function rows(sh) {
  return sh.getDataRange().getValues().slice(1);
}

function getStudents() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STUDENTS);
  if (!sh) throw new Error('No "' + STUDENTS + '" tab in the spreadsheet');
  return rows(sh)
    .filter(r => String(r[0]).trim())
    .map(r => ({ roll: String(r[0]).trim(), name: String(r[1]).trim() }));
}

function getCriteria() {
  return rows(sheet(CRITERIA, ['Criterion', 'Max Marks']))
    .filter(r => String(r[0]).trim())
    .map(r => ({ name: String(r[0]).trim(), max: Number(r[1]) || 0 }));
}

// Grades sheet headers: FIXED_COLS, then one column per criterion (ever used).
function gradesSheet() {
  return sheet(GRADES, FIXED_COLS);
}

function headers(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
}

// { roll: { criterionName: mark, ... } } for everything this evaluator has saved.
function getGradedBy(evaluator) {
  const sh = gradesSheet();
  const h = headers(sh);
  const out = {};
  rows(sh).forEach(r => {
    if (String(r[1]).trim().toLowerCase() !== evaluator.trim().toLowerCase()) return;
    const marks = {};
    h.forEach((name, i) => {
      if (i >= FIXED_COLS.length && r[i] !== '') marks[name] = r[i];
    });
    out[String(r[2]).trim()] = marks;
  });
  return out;
}

// One row per (evaluator, student); saving again overwrites that row.
function saveGrade(d) {
  const evaluator = String(d.evaluator || '').trim();
  if (!evaluator) throw new Error('Evaluator name missing');
  const student = getStudents().find(s => s.roll === String(d.roll));
  if (!student) throw new Error('Unknown roll number: ' + d.roll);

  const criteria = getCriteria();
  const sh = gradesSheet();
  let h = headers(sh);
  criteria.forEach(c => {
    if (h.indexOf(c.name) === -1) {
      sh.getRange(1, h.length + 1).setValue(c.name);
      h.push(c.name);
    }
  });

  const row = new Array(h.length).fill('');
  let total = 0;
  criteria.forEach(c => {
    const v = d.marks[c.name];
    if (v === '' || v === null || v === undefined) return;
    const n = Number(v);
    if (isNaN(n) || n < 0 || n > c.max) throw new Error(c.name + ' must be between 0 and ' + c.max);
    row[h.indexOf(c.name)] = n;
    total += n;
  });
  row[0] = new Date();
  row[1] = evaluator;
  row[2] = student.roll;
  row[3] = student.name;
  row[4] = total;

  const existing = rows(sh).findIndex(r =>
    String(r[1]).trim().toLowerCase() === evaluator.toLowerCase() &&
    String(r[2]).trim() === student.roll);
  if (existing === -1) {
    sh.appendRow(row);
  } else {
    sh.getRange(existing + 2, 1, 1, row.length).setValues([row]);
  }
  return { ok: true, total: total };
}

// criteria: [{ name, max, oldName }] in display order. oldName is set when a
// criterion was renamed, so its column in Grades is renamed too.
function saveCriteria(criteria) {
  const clean = criteria.map(c => ({
    name: String(c.name || '').trim(),
    max: Number(c.max),
    oldName: c.oldName ? String(c.oldName).trim() : ''
  }));
  const names = clean.map(c => c.name);
  if (names.some(n => !n)) throw new Error('Criterion names cannot be empty');
  if (new Set(names.map(n => n.toLowerCase())).size !== names.length) throw new Error('Criterion names must be unique');
  if (names.some(n => FIXED_COLS.indexOf(n) !== -1)) throw new Error('"' + FIXED_COLS.join('", "') + '" are reserved names');
  if (clean.some(c => !(c.max > 0))) throw new Error('Max marks must be greater than 0');

  // Check every rename before touching the sheet, so a bad one changes nothing.
  const gs = gradesSheet();
  const h = headers(gs);
  const renames = clean.filter(c => c.oldName && c.oldName !== c.name && h.indexOf(c.oldName) >= FIXED_COLS.length);
  renames.forEach(c => {
    const clash = h.indexOf(c.name);
    if (clash !== -1 && !renames.some(r => r.oldName === c.name)) {
      throw new Error('Cannot rename "' + c.oldName + '" to "' + c.name + '": the Grades sheet already has a column with that name');
    }
  });
  const cols = renames.map(c => h.indexOf(c.oldName));
  renames.forEach((c, k) => gs.getRange(1, cols[k] + 1).setValue(c.name));

  const cs = sheet(CRITERIA, ['Criterion', 'Max Marks']);
  cs.clear();
  cs.getRange(1, 1, clean.length + 1, 2)
    .setValues([['Criterion', 'Max Marks']].concat(clean.map(c => [c.name, c.max])));
  return { ok: true, criteria: getCriteria() };
}
