/* PTT Search Hub – app.js v5.0
 * 통합 검색: Task Key (Status/Detail) + Model Code + Jira Issue Key
 */

const PTT_BASE   = 'https://live.pttgps.com';
const SEARCH_URL = PTT_BASE + '/track/asig/search.php';
const DETAIL_BASE = PTT_BASE + '/track/asig_alt/displaya_new.php';

const TASK_MAX = 100;
const TASK_DELAY = 900;
const MJ_MAX = 20;

const STORAGE_KEY = 'hubResults';

// ─── State ────────────────────────────────────────────────────────────────────
let currentTab = 'task';            // 'task' | 'model' | 'jira'
let taskMode = 'status';            // 'status' | 'detail' (task tab only)
let isSearching = false;
let shouldStop = false;

// Per-tab results. task: array, model/jira: { key: [requests] }
const tabData = {
  task:  { results: [], mode: 'status' },
  model: { results: {} },
  jira:  { results: {} }
};

// ─── Tab metadata ─────────────────────────────────────────────────────────────
const TAB_CONFIG = {
  task: {
    max: TASK_MAX,
    label: 'Task Keys <span class="label-hint">(Max ' + TASK_MAX + ', newline or comma)</span>',
    placeholder: 'Enter PTT Task Keys, e.g.:\nWPLGEAI-12345\nWPLGEAI-12346',
    unit: 'keys'
  },
  model: {
    max: MJ_MAX,
    label: 'Model Codes <span class="label-hint">(Max ' + MJ_MAX + ', newline or comma)</span>',
    placeholder: 'Enter model codes, e.g.:\nMH21BBY\nMH21BBY.32U889S\nMH21RRY.32U889S',
    unit: 'codes'
  },
  jira: {
    max: MJ_MAX,
    label: 'Jira Issue Keys <span class="label-hint">(Max ' + MJ_MAX + ', newline or comma)</span>',
    placeholder: 'Enter Jira Issue Keys, e.g.:\nLGCOMTW-3224\nLGCOMTW-3021',
    unit: 'keys'
  }
};

const MODE_DESC = {
  task_status: 'Status Search: retrieves basic info from search results — Status, Project, Due Date, Owner, etc. (~1 sec/key)',
  task_detail: 'Detail Search: additionally opens each task\'s detail page and retrieves all fields (Request data / Workflow details). ~2x slower.',
  model: 'Searches PTT tasks by model code within 1 year range. Multiple code search may take long time.',
  jira: 'Searches PTT tasks by Jira Issue Key within 1 year range. Multiple key search may take long time.'
};

// ─── Shared UI helpers ────────────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function emptyHtml(msg) {
  return '<div class="results-empty"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><span>' + msg + '</span></div>';
}

function setStatus(msg, type = 'info') {
  const b = $('statusBox');
  b.textContent = msg;
  b.className = 'status-box' + (type !== 'info' ? ' ' + type : '');
}

function setProgress(pct, txt) {
  $('progressSection').classList.add('visible');
  $('progressBarFill').style.width = pct + '%';
  $('progressText').textContent = txt;
}
function hideProgress() { $('progressSection').classList.remove('visible'); }

function getSearchKeys() {
  const raw = $('searchInput').value;
  const keys = raw.split(/[\n,;\t\r]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
  return [...new Set(keys)].slice(0, TAB_CONFIG[currentTab].max);
}

function updateCounter() {
  const cfg = TAB_CONFIG[currentTab];
  const n = getSearchKeys().length;
  const el = $('inputCounter');
  el.textContent = n + ' / ' + cfg.max + ' ' + cfg.unit + ' entered';
  el.className = 'input-counter' + (n >= cfg.max ? ' warn' : '');
}

function saveResults() {
  chrome.storage.local.set({ [STORAGE_KEY]: tabData });
}

function getStatusClass(s) {
  if (!s) return 'default';
  const l = s.toLowerCase();
  if (l.includes('cancel')) return 'cancelled';
  if (l.includes('close')) return 'closed';
  if (l.includes('review')) return 'review';
  return 'open';
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────
async function fetchUrl(url, ms = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, credentials: 'include' });
    clearTimeout(t); return r;
  } catch (e) { clearTimeout(t); throw e; }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * TASK KEY ENGINE (from PTT Bulk Task Search)
 * ═══════════════════════════════════════════════════════════════════════════ */

function buildTaskUrl(key) {
  const today = new Date();
  const ago = new Date(today);
  ago.setFullYear(ago.getFullYear() - 10);
  const p = n => String(n).padStart(2, '0');
  return SEARCH_URL + '?' + new URLSearchParams({
    searchString: key, fdProject: '0',
    fStmonth: p(ago.getMonth() + 1), fStday: p(ago.getDate()), fStyear: ago.getFullYear(),
    fEnmonth: p(today.getMonth() + 1), fEnday: p(today.getDate()), fEnyear: today.getFullYear(),
    search: 'Search', type: 'quick', Search: 'Search'
  });
}

function parseTaskStatus(html, key) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const linkEl = doc.querySelector('a[href*="displaya_new.php"]');
  const editid = linkEl ? new URL(linkEl.href).searchParams.get('editid') : null;
  const detailUrl = editid ? (DETAIL_BASE + '?editid=' + editid) : null;

  const tables = doc.querySelectorAll('table');
  for (const t of tables) {
    const rows = t.querySelectorAll('tr');
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].querySelectorAll('td');
      if (cells.length < 4) continue;
      const cellTexts = Array.from(cells).map(c => c.textContent.trim());
      if (cellTexts[3] && cellTexts[3].includes(key)) {
        return {
          taskKey: key, found: true,
          priority: cellTexts[1] || '-', complexity: cellTexts[2] || '-',
          request: cellTexts[3] || '-', project: cellTexts[4] || '-',
          description: (cellTexts[5] || '-').slice(0, 100),
          dueDate: cellTexts[6] || '-', pd: cellTexts[7] || '-',
          status: (cellTexts[8] || '-').replace(/\*/g, '').trim(),
          owner: cellTexts[9] || '-', country: cellTexts[10] || '-',
          subtype: cellTexts[11] || '-', timeEst: cellTexts[12] || '-', dlu: cellTexts[13] || '-',
          detailUrl, editid
        };
      }
    }
  }
  return { taskKey: key, found: false, status: 'NOT FOUND', detailUrl: null };
}

function parseTaskDetail(html, key, base) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const result = { ...base, taskKey: key, found: true };

  let authUrlLabel = '';
  let authUrlValue = '';
  let refUrlValue = '';
  let liveUrlValue = '';

  const elems = doc.querySelectorAll('.assignment-element');
  elems.forEach(el => {
    const lblEl = el.querySelector('.assignment-element-lable');
    const inpEl = el.querySelector('.assignment-element-input');
    if (!lblEl || !inpEl) return;
    const label = lblEl.textContent.trim().replace(/^\*/, '').replace(/:$/, '').trim();
    if (!label || label.length > 80) return;

    const aTag = inpEl.querySelector('a[href]');
    const value = aTag ? aTag.href.trim() : inpEl.textContent.trim();

    result['_field_' + label] = value;

    const lbl = label.toLowerCase();
    if (lbl.includes('live url')) {
      liveUrlValue = value;
    } else if (lbl.includes('reference page url') || lbl === 'reference page url(s)') {
      refUrlValue = value;
    } else if (lbl.includes('url') && !lbl.includes('live') && !lbl.includes('reference') && !lbl.includes('dam')) {
      if (!authUrlValue) {
        authUrlValue = value;
        authUrlLabel = label;
      }
    }
  });

  result._authUrlValue = authUrlValue;
  result._authUrlLabel = authUrlLabel;
  result._refUrlValue = refUrlValue;
  result._liveUrlValue = liveUrlValue;
  result['_field_Project'] = base.project || '-';

  const allTh = doc.querySelectorAll('th');
  for (const th of allTh) {
    const txt = th.textContent.trim();
    const td = th.closest('tr') ? th.closest('tr').querySelector('td') : null;
    if (!td) continue;
    if (txt === 'Task owner:') result.currentOwner = td.textContent.trim();
    if (txt === 'Submit to step:') result.currentStep = td.textContent.trim();
    if (txt === 'Step description:') result.stepDescription = td.textContent.trim();
  }

  return result;
}

const TASK_STATUS_COLS = [
  ['taskKey', 'Task Key'], ['status', 'Status'], ['project', 'Project'],
  ['description', 'Description'], ['dueDate', 'Due Date'], ['pd', 'PD'],
  ['owner', 'Owner'], ['priority', 'Pri.'], ['complexity', 'Comp.'],
  ['country', 'Country'], ['subtype', 'Subtype'], ['timeEst', 'Time Est.'], ['dlu', 'DLU']
];

const TASK_DETAIL_COLS = [
  ['taskKey', 'Task Key'],
  ['status', 'Status'],
  ['_field_Project', 'Project'],
  ['dueDate', 'Due Date'],
  ['_field_Target publishing date', 'Pub.Date'],
  ['currentStep', 'Current Step'],
  ['currentOwner', 'Owner'],
  ['_field_Offering subtype', 'Subtype'],
  ['_field_Priority', 'Priority'],
  ['_field_Site', 'Site'],
  ['_field_Business unit', 'BU'],
  ['_field_Super Category', 'Super Cat.'],
  ['_field_Category', 'Cat.'],
  ['_field_Sub Category', 'Sub Cat.'],
  ['_field_Model Name', 'Model'],
  ['_field_Time estimation', 'Time Est.'],
  ['_field_Task title', 'Task Title'],
  ['_authUrlValue', 'Auth.URL(Y/N)', true],
  ['_refUrlValue', 'Ref.URL(Y/N)', true],
  ['_liveUrlValue', 'Live URL(Y/N)', true],
];

function yn(val) {
  return (val && val.trim() && val.trim() !== '-' && val.trim() !== 'N/A') ? 'Y' : 'N';
}

function renderTaskResults() {
  const container = $('resultsContainer');
  const countEl = $('resultsCount');
  const results = tabData.task.results;
  const mode = tabData.task.mode;

  if (!results.length) {
    container.innerHTML = emptyHtml('Results will appear here when you start the search.');
    countEl.style.display = 'none';
    return;
  }

  const found = results.filter(r => r.found).length;
  countEl.style.display = '';
  countEl.textContent = results.length + ' searched · Found ' + found + ' · Not found ' + (results.length - found);

  const cols = mode === 'detail' ? TASK_DETAIL_COLS : TASK_STATUS_COLS;
  let h = '<div class="results-table-wrap"><table class="results-table"><thead><tr><th>#</th>';
  cols.forEach(c => { h += '<th>' + esc(c[1]) + '</th>'; });
  h += '</tr></thead><tbody>';

  results.forEach((r, i) => {
    const sc = r.found ? 'cf' : (String(r.status || '').startsWith('ERROR') ? 'ce' : 'cn');
    h += '<tr><td>' + (i + 1) + '</td>';
    cols.forEach(([k, , isYN]) => {
      const v = r[k] || '';
      if (isYN) {
        const display = yn(v);
        h += '<td class="' + (display === 'Y' ? 'cf' : 'cn') + '">' + display + '</td>';
      } else if (k === 'taskKey') {
        h += '<td class="key-cell">' + esc(v || '-') + '</td>';
      } else if (k === 'status') {
        h += '<td class="' + sc + '">' + esc(v || '-') + '</td>';
      } else {
        h += '<td>' + esc(String(v || '-').slice(0, 100)) + '</td>';
      }
    });
    h += '</tr>';
  });

  container.innerHTML = h + '</tbody></table></div>';
}

async function runTaskSearch(keys) {
  tabData.task.results = [];
  tabData.task.mode = taskMode;
  const results = tabData.task.results;

  setStatus('🚀 Starting search... ' + keys.length + ' items (' + (taskMode === 'detail' ? 'Detail' : 'Status') + ' search)');

  for (let i = 0; i < keys.length; i++) {
    if (shouldStop) {
      setStatus('⛔ Stopped — ' + i + ' items processed (Found: ' + results.filter(r => r.found).length + ')', 'warning');
      break;
    }
    const key = keys[i];
    setProgress(Math.round((i + 1) / keys.length * 100), (i + 1) + ' / ' + keys.length + ' · 🔍 ' + key);
    setStatus('🔍 Searching (' + (i + 1) + '/' + keys.length + '): ' + key);

    try {
      const sResp = await fetchUrl(buildTaskUrl(key));
      const sHtml = await sResp.text();
      let result = parseTaskStatus(sHtml, key);

      if (taskMode === 'detail' && result.found && result.detailUrl) {
        setStatus('🔍 Detail (' + (i + 1) + '/' + keys.length + '): ' + key + ' → Loading details...');
        try {
          const dResp = await fetchUrl(result.detailUrl);
          const dHtml = await dResp.text();
          result = parseTaskDetail(dHtml, key, result);
          result.detailFetched = true;
        } catch (e) {
          result.detailError = e.message;
          result.detailFetched = false;
        }
      }
      results.push(result);
    } catch (e) {
      results.push({ taskKey: key, found: false, status: 'ERROR: ' + e.message });
    }

    renderTaskResults();
    saveResults();

    if (i < keys.length - 1 && !shouldStop) {
      await new Promise(r => setTimeout(r, TASK_DELAY));
    }
  }

  if (!shouldStop) {
    const found = results.filter(r => r.found).length;
    setStatus('✅ Complete — Total ' + keys.length + ' · Found ' + found + ' · Not found ' + (keys.length - found), 'success');
  }
  return results.length > 0;
}

function exportTaskCSV() {
  const results = tabData.task.results;
  const mode = tabData.task.mode;
  if (!results.length) return;
  const ce = v => '"' + String(v || '').replace(/"/g, '""') + '"';

  let headers, rows;

  if (mode === 'status') {
    headers = ['#', 'Task Key', 'Found', 'Status', 'Project', 'Description', 'Due Date', 'PD',
      'Owner', 'Priority', 'Complexity', 'Country', 'Subtype', 'Time Est.', 'DLU'];
    rows = results.map((r, i) => [
      i + 1, r.taskKey, r.found ? 'YES' : 'NO', r.status || '',
      r.project, r.description, r.dueDate, r.pd, r.owner,
      r.priority, r.complexity, r.country, r.subtype, r.timeEst, r.dlu
    ].map(ce).join(','));
  } else {
    const fieldKeys = new Set();
    results.forEach(r => {
      Object.keys(r).forEach(k => { if (k.startsWith('_field_')) fieldKeys.add(k); });
    });
    const orderedFields = [
      '_field_Task ID', '_field_Submit date', '_field_Project', '_field_Submitter',
      '_field_Target staging date', '_field_Target publishing date',
      '_field_B2B/B2C', '_field_Offering type', '_field_Offering subtype',
      '_field_Drill Down Reason', '_field_Priority', '_field_Page Type',
      '_field_Site', '_field_Business unit', '_field_Super Category',
      '_field_Category', '_field_Sub Category', '_field_Time estimation',
      '_field_Model Name', '_field_Pg#', '_field_LDM date (yyyy-mm-dd hh:MM:ss)',
      '_field_DAM Contents', '_field_DAM Asset Name', '_field_Sales Model Code',
      '_field_PTT ID (Translation - Task id)', '_field_Gallery', '_field_Spec',
      '_field_Feature', '_field_Event', '_field_Ticket ID',
      '_field_Global Request Title', '_field_BU Request Date', '_field_BU Requestor Name',
      '_field_Global / HQ NPI request title', '_field_System',
      '_field_Clarification remarks', '_field_Exception Type',
      '_field_Transfer Year', '_field_Transfer Month', '_field_New Sales model code',
      '_field_Exception Confirmation', '_field_Energy Category', '_field_Energy Class',
      '_field_Requestor Email ID', '_field_PIM SKU', '_field_GP1 Product ID',
      '_field_New Model code', '_field_Content Portal Content',
      '_field_Content Portal Content date used', '_field_Comments',
      '_field_Task title', '_field_Task details'
    ];
    const remaining = [...fieldKeys].filter(k => !orderedFields.includes(k)).sort();
    const allFieldKeys = [...orderedFields.filter(k => fieldKeys.has(k)), ...remaining];

    const fixedHdr = ['#', 'Task Key', 'Found', 'Status (Search)', 'Current Step', 'Current Owner', 'Step Description',
      'Auth URL Label', 'Auth URL', 'Reference Page URL', 'Live URL'];
    const fieldHdr = allFieldKeys.map(k => k.replace(/^_field_/, ''));
    headers = [...fixedHdr, ...fieldHdr];

    rows = results.map((r, i) => {
      const fixed = [
        i + 1, r.taskKey, r.found ? 'YES' : 'NO',
        r.status || '',
        r.currentStep || '', r.currentOwner || '', r.stepDescription || '',
        r._authUrlLabel || '', r._authUrlValue || '',
        r._refUrlValue || '', r._liveUrlValue || ''
      ];
      const fieldVals = allFieldKeys.map(k => r[k] || '');
      return [...fixed, ...fieldVals].map(ce).join(',');
    });
  }

  downloadCSV(headers.map(ce).join(',') + '\n' + rows.join('\n'),
    'PTT_Task_' + (mode === 'detail' ? 'Detail' : 'Status') + '_' + tsStamp() + '.csv');
}

/* ═══════════════════════════════════════════════════════════════════════════
 * MODEL CODE / JIRA KEY ENGINE (from PTT SKU, Jira Search)
 * ═══════════════════════════════════════════════════════════════════════════ */

const MODEL_COLS = [
  { key: 'groupKey', label: 'Model Code' },
  { key: 'wf_salesModel', label: 'Sales Model Code' },
  { key: 'wf_modelName', label: 'Model Name' },
  { key: 'requestId', label: 'Request ID' },
  { key: 'wf_ticketId', label: 'Ticket ID' },
  { key: 'rd_project', label: 'Project' },
  { key: 'status', label: 'Status' },
  { key: 'offSubtype', label: 'Off. Subtype' },
  { key: 'rd_submitDate', label: 'Submit date' }
];

const JIRA_COLS = [
  { key: 'groupKey', label: 'Jira Issue Key' },
  { key: 'wf_ticketId', label: 'Ticket ID' },
  { key: 'requestId', label: 'Request ID' },
  { key: 'wf_salesModel', label: 'Sales Model Code' },
  { key: 'wf_modelName', label: 'Model Name' },
  { key: 'rd_project', label: 'Project' },
  { key: 'status', label: 'Status' },
  { key: 'offSubtype', label: 'Off. Subtype' },
  { key: 'rd_submitDate', label: 'Submit date' }
];

function getMJDateRange() {
  const to = new Date(), from = new Date(to);
  from.setFullYear(from.getFullYear() - 1);
  const f = d => ({ month: d.getMonth() + 1, day: d.getDate(), year: d.getFullYear() });
  return { fSt: f(from), fEn: f(to) };
}

async function mjSearch(keyword) {
  const dr = getMJDateRange();
  const params = new URLSearchParams({
    searchString: keyword, fdProject: 0,
    fStmonth: dr.fSt.month, fStday: dr.fSt.day, fStyear: dr.fSt.year,
    fEnmonth: dr.fEn.month, fEnday: dr.fEn.day, fEnyear: dr.fEn.year,
    search: 'Search', type: 'quick', Search: 'Search'
  });
  const res = await fetchUrl(SEARCH_URL + '?' + params);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return parseMJSearchResults(await res.text(), keyword);
}

function parseMJSearchResults(html, keyword) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const requests = [];
  doc.querySelectorAll('a[href*="displaya_new.php"],a[href*="editid="]').forEach(link => {
    const href = link.getAttribute('href') || '';
    const m = href.match(/editid=(\d+)/);
    if (!m) return;
    const row = link.closest('tr');
    if (!row) return;
    const cells = row.querySelectorAll('td');
    const get = i => cells[i] ? cells[i].textContent.trim() : '';
    requests.push({
      editid: m[1], keyword,
      requestId: link.textContent.trim(),
      project: get(4), description: get(5),
      dueDate: get(6), pd: get(7), status: get(8),
      owner: get(9), offSubtype: get(11), timeEst: get(12),
      detailUrl: DETAIL_BASE + '?editid=' + m[1],
      loading: true,
      wf_salesModel: '', wf_modelName: '', wf_ticketId: '',
      rd_project: '', rd_submitDate: ''
    });
  });
  return requests;
}

async function fetchMJDetail(editid) {
  const res = await fetchUrl(DETAIL_BASE + '?editid=' + editid);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return parseMJDetail(await res.text());
}

function parseMJDetail(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = { requestData: {}, workflowDetails: {}, requestDetails: {} };
  const map = { 'Request data': out.requestData, 'Workflow details': out.workflowDetails, 'Request details': out.requestDetails };
  doc.querySelectorAll('.bar-blue-med-dark.space').forEach(bar => {
    const target = map[bar.textContent.trim()]; if (!target) return;
    let el = bar.nextElementSibling;
    const seen = new Set();
    while (el && !el.classList.contains('bar-blue-med-dark')) {
      const lbls = el.querySelectorAll('.assignment-element-lable');
      const inps = el.querySelectorAll('.assignment-element-input');
      for (let i = 0; i < lbls.length && i < inps.length; i++) {
        const k = lbls[i].textContent.trim().replace(/^\*\s*/, '').replace(/:$/, '').trim();
        const v = inps[i].textContent.trim();
        if (k && !seen.has(k)) { seen.add(k); target[k] = v; }
      }
      el = el.nextElementSibling;
    }
  });
  return out;
}

function mapMJDetail(req, detail) {
  const wf = detail.workflowDetails || {}, rd = detail.requestData || {};
  req.wf_salesModel = wf['Sales Model Code'] || '';
  req.wf_modelName = wf['Model Name'] || '';
  req.wf_ticketId = wf['Ticket ID'] || '';
  req.rd_project = rd['Project'] || '';
  req.rd_submitDate = rd['Submit date'] || '';
  req.detail = detail;
}

function getMJVal(req, key) {
  const m = {
    wf_salesModel: req.wf_salesModel, wf_modelName: req.wf_modelName,
    wf_ticketId: req.wf_ticketId, rd_project: req.rd_project || req.project,
    rd_submitDate: req.rd_submitDate, offSubtype: req.offSubtype
  };
  return m[key] !== undefined ? m[key] : (req[key] || '');
}

function renderMJResults(tab) {
  const container = $('resultsContainer');
  const countEl = $('resultsCount');
  const results = tabData[tab].results;
  const cols = tab === 'model' ? MODEL_COLS : JIRA_COLS;
  const badgeCls = tab === 'model' ? '' : 'jira-badge';
  const mcs = Object.keys(results);

  if (mcs.length === 0) {
    container.innerHTML = emptyHtml('Results will appear here when you start the search.');
    countEl.style.display = 'none'; return;
  }

  let total = 0; mcs.forEach(k => total += results[k].length);
  countEl.style.display = '';
  countEl.textContent = mcs.length + ' key(s), ' + total + ' request(s)';

  let html = '<div class="results-table-wrap"><table class="results-table"><thead><tr>';
  cols.forEach(c => { html += '<th>' + esc(c.label) + '</th>'; });
  html += '</tr></thead><tbody>';

  mcs.forEach((key, mIdx) => {
    const reqs = results[key];
    const parity = mIdx % 2 === 0 ? 'group-even' : 'group-odd';

    if (reqs.length === 0) {
      html += '<tr class="' + parity + ' model-first-row"><td class="key-cell"><span class="key-badge ' + badgeCls + '">' + esc(key) + '</span></td>';
      for (let i = 1; i < cols.length - 1; i++) html += '<td class="cell-nodata">—</td>';
      html += '<td class="cell-nodata">No results</td></tr>';
      return;
    }

    reqs.forEach((req, rIdx) => {
      const isFirst = rIdx === 0;
      html += '<tr class="' + parity + (isFirst ? ' model-first-row' : '') + '">';
      cols.forEach(col => {
        if (col.key === 'groupKey') {
          html += '<td class="key-cell">' + (isFirst ? '<span class="key-badge ' + badgeCls + '">' + esc(key) + '</span>' : '') + '</td>';
        } else if (col.key === 'requestId') {
          html += '<td class="cell-req-id"><a href="' + esc(req.detailUrl) + '" target="_blank">' + esc(req.requestId) + '</a></td>';
        } else if (col.key === 'status') {
          const cls = getStatusClass(req.status);
          const lbl = (req.status || '').replace(/\[WPL\]\s*/g, '').replace(/\*/g, '').trim();
          html += '<td><span class="status-badge ' + cls + '">' + esc(lbl) + '</span></td>';
        } else if (req.loading) {
          html += '<td><span class="loading-spinner"></span></td>';
        } else {
          const val = getMJVal(req, col.key);
          html += '<td>' + (val ? esc(val) : '<span class="cell-nodata">—</span>') + '</td>';
        }
      });
      html += '</tr>';
    });
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

async function runMJSearch(keys, tab) {
  tabData[tab].results = {};
  const results = tabData[tab].results;

  // Phase 1: search each key
  for (let i = 0; i < keys.length; i++) {
    if (shouldStop) break;
    const key = keys[i];
    setProgress(Math.round(i / keys.length * 30), 'Searching "' + key + '" (' + (i + 1) + '/' + keys.length + ')...');
    setStatus('Searching: ' + key);
    try {
      const reqs = await mjSearch(key);
      results[key] = reqs;
    } catch (e) {
      console.error(key, e);
      results[key] = [];
      setStatus('Warning: failed for ' + key + ': ' + e.message, 'warning');
    }
    renderMJResults(tab);
  }

  // Phase 2: fetch details
  const allReqs = Object.values(results).flat();
  const total = allReqs.length; let done = 0;

  for (const reqs of Object.values(results)) {
    for (const req of reqs) {
      if (shouldStop) break;
      done++;
      setProgress(30 + Math.round(done / Math.max(total, 1) * 65), 'Fetching detail ' + done + '/' + total + ': ' + req.requestId);
      try {
        const detail = await fetchMJDetail(req.editid);
        mapMJDetail(req, detail); req.loading = false;
      } catch (e) { req.loading = false; req.error = e.message; }
      renderMJResults(tab);
      await new Promise(r => setTimeout(r, 250));
    }
    if (shouldStop) break;
  }

  saveResults();

  const ft = Object.values(results).reduce((s, r) => s + r.length, 0);
  const mk = Object.keys(results).length;
  setStatus((shouldStop ? 'Stopped. ' : 'Complete! ') + 'Found ' + ft + ' request(s) across ' + mk + ' key(s).', shouldStop ? 'warning' : 'success');
  return ft > 0;
}

function exportMJCSV(tab) {
  const results = tabData[tab].results;
  const isModel = tab === 'model';
  const groupLabel = isModel ? 'Model Code' : 'Jira Issue Key';
  const filename = (isModel ? 'ptt-model-search_' : 'ptt-jira-search_') + tsStamp() + '.csv';

  const rdF = new Set(), wfF = new Set(), rqF = new Set();
  Object.values(results).forEach(reqs => reqs.forEach(req => {
    if (!req.detail) return;
    Object.keys(req.detail.requestData || {}).forEach(k => rdF.add(k));
    Object.keys(req.detail.workflowDetails || {}).forEach(k => wfF.add(k));
    Object.keys(req.detail.requestDetails || {}).forEach(k => rqF.add(k));
  }));

  const baseHdrs = [groupLabel, 'Request ID', 'Project', 'Description', 'Due Date', 'PD', 'Status', 'Owner', 'Off. Subtype', 'Time Est.', 'Detail URL'];
  const headers = [...baseHdrs, ...[...rdF], ...[...wfF], ...[...rqF]];

  const ce = v => '"' + String(v || '').replace(/\r/g, '').replace(/\n/g, ' ').replace(/"/g, '""') + '"';
  const rows = [headers.map(ce).join(',')];

  Object.entries(results).forEach(([key, reqs]) => {
    reqs.forEach(req => {
      const row = {};
      row[groupLabel] = key;
      row['Request ID'] = req.requestId || ''; row['Project'] = req.project || '';
      row['Description'] = req.description || ''; row['Due Date'] = req.dueDate || '';
      row['PD'] = req.pd || ''; row['Status'] = req.status || '';
      row['Owner'] = req.owner || ''; row['Off. Subtype'] = req.offSubtype || '';
      row['Time Est.'] = req.timeEst || ''; row['Detail URL'] = req.detailUrl || '';
      if (req.detail) {
        Object.entries(req.detail.requestData || {}).forEach(([k, v]) => row[k] = v);
        Object.entries(req.detail.workflowDetails || {}).forEach(([k, v]) => row[k] = v);
        Object.entries(req.detail.requestDetails || {}).forEach(([k, v]) => row[k] = v);
      }
      rows.push(headers.map(h => ce(row[h] || '')).join(','));
    });
  });

  downloadCSV(rows.join('\n'), filename);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * SHARED: CSV download, tab switching, search dispatch, init
 * ═══════════════════════════════════════════════════════════════════════════ */

function tsStamp() {
  return new Date().toISOString().slice(0, 10);
}

function downloadCSV(content, filename) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function hasResults(tab) {
  if (tab === 'task') return tabData.task.results.length > 0;
  return Object.values(tabData[tab].results).some(r => r.length > 0) || Object.keys(tabData[tab].results).length > 0;
}

function renderCurrentTab() {
  if (currentTab === 'task') renderTaskResults();
  else renderMJResults(currentTab);
  $('exportBtn').disabled = !hasResults(currentTab);
}

function updateModeDesc() {
  const key = currentTab === 'task' ? 'task_' + taskMode : currentTab;
  $('modeDesc').textContent = MODE_DESC[key];
}

function switchTab(tab) {
  if (isSearching) return;
  currentTab = tab;

  $('tabTask').classList.toggle('active', tab === 'task');
  $('tabModel').classList.toggle('active', tab === 'model');
  $('tabJira').classList.toggle('active', tab === 'jira');

  $('taskSubModes').style.display = tab === 'task' ? '' : 'none';

  const cfg = TAB_CONFIG[tab];
  $('inputLabel').innerHTML = cfg.label;
  $('searchInput').placeholder = cfg.placeholder;
  $('searchInput').value = '';

  updateModeDesc();
  updateCounter();
  hideProgress();
  setStatus('Enter search terms and click Start Search.');
  renderCurrentTab();
}

function switchTaskMode(m) {
  if (isSearching) return;
  taskMode = m;
  $('subStatus').classList.toggle('active', m === 'status');
  $('subDetail').classList.toggle('active', m === 'detail');
  updateModeDesc();
}

async function startSearch() {
  if (isSearching) {
    shouldStop = true;
    const btn = $('startBtn');
    btn.textContent = '⏹ Stopping...'; btn.classList.add('stopping');
    return;
  }
  const keys = getSearchKeys();
  if (keys.length === 0) { setStatus('Please enter at least one search key.', 'error'); return; }

  isSearching = true; shouldStop = false;
  const btn = $('startBtn');
  btn.textContent = '⏹ Stop'; btn.classList.remove('stopping');
  $('exportBtn').disabled = true;
  $('resultsContainer').innerHTML = emptyHtml('Searching...');
  $('resultsCount').style.display = 'none';

  const tabAtStart = currentTab;

  try {
    let any;
    if (tabAtStart === 'task') {
      any = await runTaskSearch(keys);
    } else {
      any = await runMJSearch(keys, tabAtStart);
    }
    setProgress(100, 'Complete!');
    setTimeout(hideProgress, 2000);
    $('exportBtn').disabled = !any;
  } catch (e) {
    setStatus('Error: ' + e.message, 'error'); hideProgress();
  } finally {
    isSearching = false; shouldStop = false;
    btn.textContent = '▶ Start Search'; btn.classList.remove('stopping');
    saveResults();
    renderCurrentTab();
  }
}

function clearAll() {
  if (isSearching) return;
  if (currentTab === 'task') { tabData.task.results = []; }
  else { tabData[currentTab].results = {}; }
  $('searchInput').value = '';
  updateCounter();
  $('exportBtn').disabled = true;
  $('resultsCount').style.display = 'none';
  $('resultsContainer').innerHTML = emptyHtml('Results will appear here when you start the search.');
  hideProgress();
  setStatus('Cleared. Enter search terms and click Start Search.');
  saveResults();
}

function exportCSV() {
  if (currentTab === 'task') exportTaskCSV();
  else exportMJCSV(currentTab);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // ── Auth check: block UI if not signed in ──
  const user = await getUser();
  if (!user) {
    document.body.innerHTML =
      '<div style="font-family:Segoe UI,Arial,sans-serif;text-align:center;padding:60px;color:#555;">' +
      '<p style="font-size:15px;margin-bottom:12px;">🔒 Please sign in first.</p>' +
      '<p style="font-size:12px;color:#888;">Click the extension icon to sign in with Google.</p>' +
      '</div>';
    return;
  }

  // ── Render user info in header ──
  const hdrUser  = $('hdrUser');
  const hdrPic   = $('hdrPic');
  const hdrEmail = $('hdrEmail');
  if (user.picture) { hdrPic.src = user.picture; hdrPic.style.display = ''; }
  hdrEmail.textContent = user.email;
  hdrUser.style.display = '';

  // ── Sign-out button ──
  $('btnSignOut').addEventListener('click', async () => {
    if (!confirm('Sign out from PTT Search Hub?')) return;
    await signOut();
    document.body.innerHTML =
      '<div style="font-family:Segoe UI,Arial,sans-serif;text-align:center;padding:60px;color:#555;">' +
      '<p style="font-size:15px;">Signed out. You can close this tab.</p>' +
      '</div>';
  });

  // ── Tabs & controls ──
  $('tabTask').addEventListener('click', () => switchTab('task'));
  $('tabModel').addEventListener('click', () => switchTab('model'));
  $('tabJira').addEventListener('click', () => switchTab('jira'));
  $('subStatus').addEventListener('click', () => switchTaskMode('status'));
  $('subDetail').addEventListener('click', () => switchTaskMode('detail'));
  $('searchInput').addEventListener('input', updateCounter);
  $('startBtn').addEventListener('click', startSearch);
  $('exportBtn').addEventListener('click', exportCSV);
  $('clearAllBtn').addEventListener('click', clearAll);

  // ── Restore saved results ──
  chrome.storage.local.get(STORAGE_KEY, (d) => {
    const saved = d[STORAGE_KEY];
    if (saved) {
      if (saved.task)  { tabData.task.results = saved.task.results || []; tabData.task.mode = saved.task.mode || 'status'; taskMode = tabData.task.mode; }
      if (saved.model) { tabData.model.results = saved.model.results || {}; }
      if (saved.jira)  { tabData.jira.results = saved.jira.results || {}; }
      switchTaskMode(taskMode);
    }
    switchTab('task');
    if (tabData.task.results.length) {
      setStatus('Previous search results restored. (Total: ' + tabData.task.results.length + ')', 'success');
    }
  });
});
