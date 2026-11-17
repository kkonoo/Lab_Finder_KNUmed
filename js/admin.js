// 관리자: 구글 로그인 → 인턴십 신청 보기, 선정·미선정과 메모, 삭제, CSV 받기, 보여 줄 교수님 켜고 끄기, 관리자 넣고 빼기
// 누가 무엇을 할 수 있는지는 firestore.rules가 지켜요 (admins/{이메일} 문서가 있으면 관리자)
import { enabled, auth, firestore, esc } from './firebase.js';

const $ = s => document.querySelector(s);
const STATUS = { submitted: '접수', approved: '선정', rejected: '미선정' };
const TRACK = { 1: 'Track 1 교내', 2: 'Track 2 DGIST' };
const p2 = n => String(n).padStart(2, '0');
const when = ts => (ts ? (d => `${d.getMonth() + 1}.${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`)(ts.toDate()) : '');
const fullWhen = ts => (ts ? (d => `${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`)(ts.toDate()) : '');

let toastTimer;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2800);
}

function showGate(html) {
  $('#gate').innerHTML = html;
  $('#gate').hidden = false;
  $('#app').hidden = true;
}

if (!enabled) {
  showGate('<p>Firebase 설정이 필요해요. README의 ‘처음 설정’대로 <code>js/firebase-config.js</code>를 채우면 이 화면에서 로그인할 수 있어요.</p>');
} else {
  start().catch(err => {
    console.error(err);
    showGate('<p>관리자 화면을 열지 못했어요. 잠시 후 새로 고침해 주세요.</p>');
  });
}

async function start() {
  const [{ auth: a, fa }, { db, fs }] = await Promise.all([auth(), firestore()]);
  // 로그아웃하면 새로 고쳐서 이전 계정의 화면이 남지 않게 해요
  $('#logoutBtn').addEventListener('click', () => fa.signOut(a).then(() => location.reload()));
  let started = false;
  fa.onAuthStateChanged(a, async user => {
    $('#account').hidden = !user;
    if (!user) {
      showGate(`<p>관리자로 등록된 구글 계정으로 로그인해 주세요.</p>
        <p class="row"><button class="btn primary" type="button" id="loginBtn">구글 계정으로 로그인</button></p>`);
      $('#loginBtn').addEventListener('click', () => {
        fa.signInWithPopup(a, new fa.GoogleAuthProvider()).catch(err => {
          if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(err.code)) {
            console.error(err);
            toast('로그인하지 못했어요. 다시 해 주세요.');
          }
        });
      });
      return;
    }
    const email = user.email.toLowerCase();
    $('#accountEmail').textContent = email;
    let admin = false;
    try {
      admin = (await fs.getDoc(fs.doc(db, 'admins', email))).exists();
    } catch (err) {
      console.error(err);
    }
    if (!admin) {
      showGate(`<p>${esc(email)} 계정은 아직 관리자가 아니에요. 다른 관리자에게 아래 ‘관리자’에서 추가해 달라고 부탁해 주세요.</p>`);
      return;
    }
    $('#gate').hidden = true;
    $('#app').hidden = false;
    if (started) return;
    started = true;
    const ctx = { db, fs, email };
    initApplications(ctx);
    initLabs(ctx);
    initAdmins(ctx);
  });
}

// 탭: 신청 · 보여 줄 교수님 · 관리자
document.querySelector('.tabs').addEventListener('click', e => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  document.querySelectorAll('.tabs [data-tab]').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('[data-panel]').forEach(p => (p.hidden = p.dataset.panel !== b.dataset.tab));
});

// ---------- 신청 ----------
async function initApplications({ db, fs, email }) {
  let apps = [];
  let current = null;
  let types = {}, topics = [];
  try {
    const quiz = await fetch('data/quiz.json').then(r => r.json());
    types = quiz.types;
    topics = quiz.topics;
  } catch (err) {
    console.error(err);
  }
  const styleName = s => (types[s] ? `${types[s][0]} ${types[s][1]}` : s || '');
  const topicNames = ts => (ts || []).map(k => topics.find(t => t[0] === k)?.[2] || k).join(', ');

  async function load() {
    try {
      const snap = await fs.getDocs(fs.collection(db, 'applications'));
      apps = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((x, y) => (y.createdAt?.toMillis() || 0) - (x.createdAt?.toMillis() || 0));
    } catch (err) {
      console.error(err);
      toast('신청 목록을 불러오지 못했어요.');
    }
    render();
  }

  // 고르는 칸: 지금 고른 값을 지키면서 건수를 다시 세요
  function options(sel, all, entries) {
    const v = sel.value;
    sel.innerHTML = `<option value="">${all}</option>` + entries.map(([k, label]) =>
      `<option value="${esc(k)}"${k === v ? ' selected' : ''}>${esc(label)}</option>`).join('');
  }
  function filtered() {
    const r = $('#fRound').value, t = $('#fTrack').value, s = $('#fStatus').value;
    return apps.filter(x => (!r || x.round === r) && (!t || x.track === t) && (!s || x.status === s));
  }
  function render() {
    const rounds = [...new Set(apps.map(x => x.round))];
    const count = f => apps.filter(f).length;
    options($('#fRound'), `모든 회차 (${apps.length}건)`, rounds.map(r => [r, `${r} (${count(x => x.round === r)}건)`]));
    options($('#fTrack'), '모든 트랙', Object.entries(TRACK).map(([k, v]) => [k, `${v} (${count(x => x.track === k)}건)`]));
    options($('#fStatus'), '모든 상태', Object.entries(STATUS).map(([k, v]) => [k, `${v} (${count(x => x.status === k)}건)`]));
    const list = filtered();
    $('#rows').innerHTML = list.length ? list.map(x => `<tr data-id="${esc(x.id)}" tabindex="0">
        <td>${when(x.createdAt)}</td>
        <td>${esc(x.name)}<br><small>${esc(x.sid)}</small></td>
        <td>${esc(x.year)}</td>
        <td>${esc(TRACK[x.track] || x.track)}</td>
        <td>${(x.labs || []).map((l, i) => `${i + 1}. ${esc(l)}`).join('<br>')}</td>
        <td>${esc(styleName(x.style))}</td>
        <td><span class="state ${esc(x.status)}">${esc(STATUS[x.status] || x.status)}</span></td>
      </tr>`).join('')
      : `<tr><td colspan="7" class="none">${apps.length ? '고른 조건에 맞는 신청이 없어요.' : '아직 들어온 신청이 없어요.'}</td></tr>`;
  }

  function open(x) {
    current = x;
    $('#dlgTitle').textContent = `${x.name} · ${x.year}`;
    const rows = [
      ['회차', x.round],
      ['신청', fullWhen(x.createdAt)],
      ['상태', `${STATUS[x.status] || x.status}${x.decidedBy ? ` (${x.decidedBy}, ${fullWhen(x.decidedAt)})` : ''}`],
      ['학번', x.sid],
      ['연락처', x.phone],
      ['이메일', x.email],
      ['트랙', TRACK[x.track] || x.track],
      ['희망 연구실', (x.labs || []).map((l, i) => `${i + 1}지망 ${l}`).join('\n')],
      ['연구 스타일', [styleName(x.style), topicNames(x.topics)].filter(Boolean).join(' · ')],
      ['지원 동기', x.motive],
      ['연구 경험', x.experience],
    ].filter(([, v]) => v);
    $('#info').innerHTML = rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${k === '이메일'
      ? `<a href="mailto:${esc(v)}?subject=${encodeURIComponent('[연구 인턴십] 결과 안내')}">${esc(v)}</a>` : esc(v)}</dd></div>`).join('');
    $('#dlgForm').elements.note.value = x.note || '';
    $('#dlg').showModal();
  }

  ['#fRound', '#fTrack', '#fStatus'].forEach(id => $(id).addEventListener('change', render));
  $('#refreshBtn').addEventListener('click', load);
  $('#rows').addEventListener('click', e => {
    const tr = e.target.closest('tr[data-id]');
    if (tr) open(apps.find(x => x.id === tr.dataset.id));
  });
  $('#rows').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('tr[data-id]')) open(apps.find(x => x.id === e.target.dataset.id));
  });

  $('#dlgForm').addEventListener('submit', async e => {
    const status = e.submitter?.value;
    if (!(status in STATUS)) return;   // 닫기
    e.preventDefault();
    const x = current;
    const note = e.target.elements.note.value.trim();
    try {
      await fs.updateDoc(fs.doc(db, 'applications', x.id), { status, note, decidedAt: fs.serverTimestamp(), decidedBy: email });
      Object.assign(x, { status, note, decidedBy: email, decidedAt: fs.Timestamp.now() });
      render();
      $('#dlg').close();
      toast(`‘${STATUS[status]}’ 상태로 저장했어요.${status === 'submitted' ? '' : ' 학생에게는 메일이나 전화로 알려 주세요.'}`);
    } catch (err) {
      console.error(err);
      toast('저장하지 못했어요. 다시 해 주세요.');
    }
  });

  $('#deleteBtn').addEventListener('click', async () => {
    const x = current;
    if (!confirm(`${x.name} 학생의 신청을 지울까요? 되돌릴 수 없어요.`)) return;
    try {
      await fs.deleteDoc(fs.doc(db, 'applications', x.id));
      apps = apps.filter(y => y.id !== x.id);
      render();
      $('#dlg').close();
      toast('지웠어요.');
    } catch (err) {
      console.error(err);
      toast('지우지 못했어요. 다시 해 주세요.');
    }
  });

  // 지금 거른 목록을 CSV로 (엑셀에서 바로 열려요). 수식으로 읽히지 않게 앞에 '를 붙여요
  const cell = v => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  $('#csvBtn').addEventListener('click', () => {
    const list = filtered();
    if (!list.length) return toast('받을 신청이 없어요.');
    const head = ['회차', '신청', '상태', '이름', '학번', '학년', '연락처', '이메일', '트랙', '1지망', '2지망', '3지망',
      '연구 스타일', '관심 주제', '지원 동기', '연구 경험', '메모'];
    const lines = [head.map(cell).join(',')].concat(list.map(x => [
      x.round, fullWhen(x.createdAt), STATUS[x.status] || x.status, x.name, x.sid, x.year, x.phone, x.email,
      TRACK[x.track] || x.track, ...[0, 1, 2].map(i => x.labs?.[i]), styleName(x.style), topicNames(x.topics),
      x.motive, x.experience, x.note,
    ].map(cell).join(',')));
    const t = new Date();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    link.download = `인턴십신청_${t.getFullYear()}${p2(t.getMonth() + 1)}${p2(t.getDate())}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });

  load();
}

// ---------- 보여 줄 교수님 ----------
// Firestore config/labs의 off(끈 교수님 이름 목록). 누구나 읽고(js/firebase.js hiddenLabs) 관리자만 써요
async function initLabs({ db, fs, email }) {
  const box = $('#labGroups');
  const ko = (a, b) => a.localeCompare(b, 'ko');
  let profs = [], off = new Set();
  try {
    const [data, snap] = await Promise.all([fetch('data/profs.json').then(r => r.json()), fs.getDoc(fs.doc(db, 'config', 'labs'))]);
    profs = data.profs;
    off = new Set(snap.exists() ? snap.data().off || [] : []);
  } catch (err) {
    console.error(err);
    // 규칙에 config/labs가 없으면 새로 고쳐도 안 돼요. 그때는 규칙을 다시 게시하라고 알려요
    box.innerHTML = err.code === 'permission-denied'
      ? '<p class="msg">보여 줄 교수님 설정을 읽을 권한이 없어요. Firebase 콘솔 › Firestore › 규칙에 저장소의 최신 <code>firestore.rules</code>를 붙여 넣고 게시해 주세요.</p>'
      : '<p class="msg">교수님 목록을 불러오지 못했어요. 새로 고침해 주세요.</p>';
    return;
  }

  function render(focus) {
    const on = ps => ps.filter(p => !off.has(p.name)).length;
    $('#labCount').textContent = `보이는 교수님 ${on(profs)} / ${profs.length}`;
    box.innerHTML = ['기초', '임상'].map(kind => {
      const ps = profs.filter(p => p.kind === kind);
      if (!ps.length) return '';
      const depts = [...new Set(ps.map(p => p.dept))].sort(ko);
      return `<h3 class="sec">${kind} <small>${on(ps)} / ${ps.length}</small></h3>` + depts.map(d => `<div class="dept-row">
        <p>${esc(d)}</p>
        <div class="choices">${ps.filter(p => p.dept === d).sort((a, b) => ko(a.name, b.name)).map(p => `<label>
          <input type="checkbox" value="${esc(p.name)}"${off.has(p.name) ? '' : ' checked'}> ${esc(p.name)}${p.line ? '' : ' <small>소개 없음</small>'}</label>`).join('')}</div>
      </div>`).join('');
    }).join('');
    if (focus) box.querySelector(`input[value="${CSS.escape(focus)}"]`)?.focus();
  }

  // 화면을 먼저 바꾸고 저장해요. 못 하면 되돌려요 (빨리 여러 번 눌러도 순서대로 저장돼요)
  async function save(next, done, focus) {
    const prev = off;
    off = next;
    render(focus);
    try {
      await fs.setDoc(fs.doc(db, 'config', 'labs'), { off: [...next].sort(ko), updatedAt: fs.serverTimestamp(), updatedBy: email });
      toast(done);
    } catch (err) {
      console.error(err);
      off = prev;
      render(focus);
      toast('저장하지 못했어요. 다시 해 주세요.');
    }
  }

  box.addEventListener('change', e => {
    const c = e.target;
    if (!c.matches('input[type=checkbox]')) return;
    const next = new Set(off);
    if (c.checked) next.delete(c.value);
    else next.add(c.value);
    save(next, `${c.value} 교수님을 ${c.checked ? '켰어요' : '껐어요'}.`, c.value);
  });
  $('#allOnBtn').addEventListener('click', () => save(new Set(), '모두 켰어요.'));
  $('#allOffBtn').addEventListener('click', () => {
    if (confirm('모든 교수님을 끌까요? 연구실 찾기에 아무도 안 보이게 돼요.')) save(new Set(profs.map(p => p.name)), '모두 껐어요.');
  });
  render();
}

// ---------- 관리자 ----------
function initAdmins({ db, fs, email }) {
  const list = $('#adminList');
  const form = $('#adminForm');
  async function load() {
    try {
      const snap = await fs.getDocs(fs.collection(db, 'admins'));
      list.innerHTML = snap.docs.map(d => `<li><span>${esc(d.id)}${d.id === email ? ' <small>(나)</small>' : ''}</span>
        ${d.id === email ? '' : `<button class="btn danger" type="button" data-remove="${esc(d.id)}">빼기</button>`}</li>`).join('');
    } catch (err) {
      console.error(err);
      list.innerHTML = '<li class="msg">관리자 목록을 불러오지 못했어요.</li>';
    }
  }
  list.addEventListener('click', async e => {
    const b = e.target.closest('[data-remove]');
    if (!b || !confirm(`${b.dataset.remove} 계정을 관리자에서 뺄까요?`)) return;
    try {
      await fs.deleteDoc(fs.doc(db, 'admins', b.dataset.remove));
      toast('관리자에서 뺐어요.');
      load();
    } catch (err) {
      console.error(err);
      toast('빼지 못했어요. 다시 해 주세요.');
    }
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const add = form.elements.email.value.trim().toLowerCase();
    try {
      await fs.setDoc(fs.doc(db, 'admins', add), { addedBy: email, addedAt: fs.serverTimestamp() });
      form.reset();
      toast('관리자를 추가했어요.');
      load();
    } catch (err) {
      console.error(err);
      toast('추가하지 못했어요. 다시 해 주세요.');
    }
  });
  load();
}
