// Paste the Web app URL from Apps Script (Deploy → Manage deployments) here.
const API_URL = 'PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE';

const EVALUATOR_KEY = 'evaluatorName';

function getEvaluator() {
  try { return localStorage.getItem(EVALUATOR_KEY) || ''; } catch (e) { return ''; }
}

function setEvaluator(name) {
  try {
    if (name) localStorage.setItem(EVALUATOR_KEY, name);
    else localStorage.removeItem(EVALUATOR_KEY);
  } catch (e) { /* private mode: name just won't be remembered */ }
}

async function apiGet(params) {
  const res = await fetch(API_URL + '?' + new URLSearchParams(params));
  return check(await res.json());
}

// text/plain keeps this a "simple" request, so the browser skips the CORS
// preflight that Apps Script cannot answer.
async function apiPost(body) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body)
  });
  return check(await res.json());
}

function check(data) {
  if (data.error) throw new Error(data.error);
  return data;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toast(msg, isError) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = 'show' + (isError ? ' error' : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = ''; }, isError ? 5000 : 2500);
}
