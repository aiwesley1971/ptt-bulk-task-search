
/* PTT Bulk Task Search – app.js v2.4 */

const BASE = 'https://live.pttgps.com/track/asig/search.php';
const DETAIL_BASE = 'https://live.pttgps.com/track/asig_alt/displaya_new.php';
const MAX = 100;
const DELAY = 900;

const MODE_DESC = {
  status: 'Retrieves basic information from the search results table: Status, Project, Due Date, Owner, etc. (~1 second per key)',
  detail: 'Additionally retrieves all fields from the detail page (Request data / Workflow details / Request details). Takes ~2x longer as each key requires one extra page visit.'
};

let mode = 'status';
let stopFlag = false;
let results = [];
let running = false;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('tabStatus').addEventListener('click', () => setMode('status'));
  document.getElementById('tabDetail').addEventListener('click', () => setMode('detail'));
  document.getElementById('keys').addEventListener('input', updateKeyCount);
  document.getElementById('btnStart').addEventListener('click', startSearch);
  document.getElementById('btnStop').addEventListener('click', () => { stopFlag = true; });
  document.getElementById('btnExport').addEventListener('click', exportCSV);
  document.getElementById('btnClear').addEventListener('click', clearAll);
  setMode('status');
  chrome.storage.local.get('pttResults', (d) => {
    if (d.pttResults && d.pttResults.results && d.pttResults.results.length) {
      results = d.pttResults.results;
      mode = d.pttResults.mode || 'status';
      setMode(mode);
      renderResults();
      banner('Previous search results restored. (Total: ' + results.length + ')', 'ok');
      document.getElementById('btnExport').disabled = false;
    }
  });
});



function setMode(m) {
  mode = m;
  document.getElementById('tabStatus').classList.toggle('on', m === 'status');
  document.getElementById('tabDetail').classList.toggle('on', m === 'detail');
  document.getElementById('modeDesc').textContent = MODE_DESC[m];
}

function parseKeys(txt) {
  return [...new Set(
    txt.split(/[\n,;\t\r]+/).map(k => k.trim().toUpperCase()).filter(k => k.length > 0)
  )].slice(0, MAX);
}

function updateKeyCount() {
  const k = parseKeys(document.getElementById('keys').value);
  const el = document.getElementById('kcnt');
  el.textContent = k.length + ' items entered' + (k.length >= MAX ? ' (Max 100)' : '');
  el.style.color = k.length >= MAX ? '#c0392b' : '#888';
}

function banner(msg, type) {
  const el = document.getElementById('banner');
  el.textContent = msg;
  el.className = 'banner ban-' + (type || 'info');
}

function setProgress(idx, total, key) {
  document.getElementById('prog').style.display = '';
  const pct = total > 0 ? ((idx + 1) / total * 100).toFixed(1) : 0;
  document.getElementById('pfill').style.width = pct + '%';
  document.getElementById('pcnt').textContent = (idx + 1) + ' / ' + total;
  document.getElementById('pkey').textContent = key ? ('🔍 ' + key) : '-';
}

function lockUI(lock) {
  document.getElementById('btnStart').disabled = lock;
  document.getElementById('btnStop').style.display = lock ? '' : 'none';
  document.getElementById('btnExport').disabled = lock || results.length === 0;
}

function buildUrl(key) {
  const today = new Date();
  const ago = new Date(today);
  ago.setFullYear(ago.getFullYear() - 10); // 10 years ago
  const p = n => String(n).padStart(2, '0');
  return BASE + '?' + new URLSearchParams({
    searchString: key, fdProject: '0',
    fStmonth: p(ago.getMonth() + 1), fStday: p(ago.getDate()), fStyear: ago.getFullYear(),
    fEnmonth: p(today.getMonth() + 1), fEnday: p(today.getDate()), fEnyear: today.getFullYear(),
    search: 'Search', type: 'quick', Search: 'Search'
  });
}

function parseStatus(html, key) {
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

/* ── [수정 1] parseDetail: URL 필드를 label 이름에 무관하게 동적 감지 ── */
function parseDetail(html, key, base) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const result = { ...base, taskKey: key, found: true };

  // URL 관련 필드 동적 수집용 (label에 'url' 포함 여부로 판단)
  // authUrlValue: "Authoring"/"Test"/"Staging" URL 등 첫 번째 authoring-류 URL
  // refUrlValue: Reference Page URL
  // liveUrlValue: Live URL
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

    // _field_ 맵에 저장 (원본 label 그대로)
    result['_field_' + label] = value;

    // URL 필드 동적 감지
    const lbl = label.toLowerCase();
    if (lbl.includes('live url')) {
      liveUrlValue = value;
    } else if (lbl.includes('reference page url') || lbl === 'reference page url(s)') {
      refUrlValue = value;
    } else if (lbl.includes('url') && !lbl.includes('live') && !lbl.includes('reference') && !lbl.includes('dam')) {
      // Authoring URL(s), Test URL(s), Staging URL(s) 등 첫 번째 것을 사용
      if (!authUrlValue) {
        authUrlValue = value;
        authUrlLabel = label;
      }
    }
  });

  // 통합 URL 필드로 저장 (화면 Y/N용)
  result._authUrlValue = authUrlValue;
  result._authUrlLabel = authUrlLabel;
  result._refUrlValue = refUrlValue;
  result._liveUrlValue = liveUrlValue;

  // Ensure Project field in detail mode always uses the accurate project value from parseStatus
  result['_field_Project'] = base.project || '-';

  // Workflow step selection
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

async function startSearch() {
  if (running) return;
  const keys = parseKeys(document.getElementById('keys').value);
  if (!keys.length) { banner('⚠️ Please enter a Task Key.', 'warn'); return; }

  running = true;
  stopFlag = false;
  results = [];
  lockUI(true);
  document.getElementById('prog').style.display = '';
  document.getElementById('pfill').style.width = '0%';
  document.getElementById('pcnt').textContent = '0 / ' + keys.length;
  document.getElementById('twrap').innerHTML = '';
  document.getElementById('rcnt').textContent = '';
  banner('🚀 Starting search... ' + keys.length + ' items (' + (mode === 'detail' ? 'Detail' : 'Status') + ' search)', 'info');

  for (let i = 0; i < keys.length; i++) {
    if (stopFlag) {
      banner('⛔ Stopped — ' + i + ' items processed (Found: ' + results.filter(r => r.found).length + ')', 'warn');
      break;
    }
    const key = keys[i];
    setProgress(i, keys.length, key);
    banner('🔍 Searching (' + (i + 1) + '/' + keys.length + '): ' + key, 'info');

    try {
      const sResp = await fetch(buildUrl(key), { credentials: 'include' });
      const sHtml = await sResp.text();
      let result = parseStatus(sHtml, key);

      if (mode === 'detail' && result.found && result.detailUrl) {
        banner('🔍 Detail (' + (i + 1) + '/' + keys.length + '): ' + key + ' → Loading details...', 'info');
        try {
          const dResp = await fetch(result.detailUrl, { credentials: 'include' });
          const dHtml = await dResp.text();
          result = parseDetail(dHtml, key, result);
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

    renderResults();
    chrome.storage.local.set({ pttResults: { results, mode } });

    if (i < keys.length - 1 && !stopFlag) {
      await new Promise(r => setTimeout(r, DELAY));
    }
  }

  if (!stopFlag) {
    const found = results.filter(r => r.found).length;
    banner('✅ Complete — Total ' + keys.length + ' · Found ' + found + ' · Not found ' + (keys.length - found), 'ok');
    setProgress(keys.length - 1, keys.length, 'Done');
  }
  running = false;
  lockUI(false);
  document.getElementById('btnExport').disabled = false;
}

const STATUS_COLS = [
  ['taskKey', 'Task Key'], ['status', 'Status'], ['project', 'Project'],
  ['description', 'Description'], ['dueDate', 'Due Date'], ['pd', 'PD'],
  ['owner', 'Owner'], ['priority', 'Pri.'], ['complexity', 'Comp.'],
  ['country', 'Country'], ['subtype', 'Subtype'], ['timeEst', 'Time Est.'], ['dlu', 'DLU']
];

/* ── [수정 2] 화면 컬럼: 고정 필드명 대신 동적 _authUrlValue 사용 ── */
const DETAIL_SCREEN_COLS = [
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
  ['_authUrlValue', 'Auth.URL(Y/N)', true],    // ← 동적 저장 키 사용
  ['_refUrlValue', 'Ref.URL(Y/N)', true],
  ['_liveUrlValue', 'Live URL(Y/N)', true],
];

function yn(val) {
  return (val && val.trim() && val.trim() !== '-' && val.trim() !== 'N/A' && val.trim() !== '') ? 'Y' : 'N';
}

function renderResults() {
  const wrap = document.getElementById('twrap');
  const found = results.filter(r => r.found).length;
  document.getElementById('rcnt').textContent =
    results.length + ' searched · Found ' + found + ' · Not found ' + (results.length - found);

  if (!results.length) {
    wrap.innerHTML = '<div class="empty">Results will appear here when you start the search.</div>';
    return;
  }

  const cols = mode === 'detail' ? DETAIL_SCREEN_COLS : STATUS_COLS;
  let h = '<table><thead><tr><th>#</th>';
  cols.forEach(c => { h += '<th>' + c[1] + '</th>'; });
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
        h += '<td><strong>' + (v || '-') + '</strong></td>';
      } else if (k === 'status') {
        h += '<td class="' + sc + '">' + (v || '-') + '</td>';
      } else {
        h += '<td>' + String(v || '-').slice(0, 100) + '</td>';
      }
    });
    h += '</tr>';
  });

  wrap.innerHTML = h + '</tbody></table>';
  wrap.scrollTop = wrap.scrollHeight;
}

function clearAll() {
  if (running) return;
  results = [];
  document.getElementById('twrap').innerHTML = '<div class="empty">Results will appear here when you start the search.</div>';
  document.getElementById('rcnt').textContent = '';
  document.getElementById('prog').style.display = 'none';
  document.getElementById('pfill').style.width = '0%';
  document.getElementById('btnExport').disabled = true;
  banner('Cleared. Enter a Task Key and start the search.', 'info');
  chrome.storage.local.remove('pttResults');
}

function exportCSV() {
  if (!results.length) return;
  const esc = v => '"' + String(v || '').replace(/"/g, '""') + '"';

  let headers, rows;

  if (mode === 'status') {
    headers = ['#', 'Task Key', 'Found', 'Status', 'Project', 'Description', 'Due Date', 'PD',
      'Owner', 'Priority', 'Complexity', 'Country', 'Subtype', 'Time Est.', 'DLU'];
    rows = results.map((r, i) => [
      i + 1, r.taskKey, r.found ? 'YES' : 'NO', r.status || '',
      r.project, r.description, r.dueDate, r.pd, r.owner,
      r.priority, r.complexity, r.country, r.subtype, r.timeEst, r.dlu
    ].map(esc).join(','));
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
      return [...fixed, ...fieldVals].map(esc).join(',');
    });
  }

  const csv = '\uFEFF' + headers.map(esc).join(',') + '\n' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().slice(0, 16).replace(/[T:-]/g, '').slice(0, 13);
  a.href = url;
  a.download = 'PTT_' + (mode === 'detail' ? 'Detail' : 'Status') + '_' + ts + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}
