// 연구실 찾기: 교수님 데이터를 읽어 숫자·칩·카드·쪽 넘기기를 그리고, 연구 스타일 테스트(quiz.js)를 시작해요.
// 관리자가 끈 교수님(hidden)은 어디에도 나오지 않아요
import { loadProfs } from './data.js';
import { esc } from './firebase.js';

const PER = 12;   // 한 쪽에 12분 (네 줄·세 줄·두 줄 칸에 모두 맞아요)
const $ = s => document.querySelector(s);
const ko = (a, b) => a.localeCompare(b, 'ko');
// 찾기용 글자: 띄어쓰기·대소문자·가운뎃점 무시 ('생화학 세포' = '생화학·세포')
const fold = s => String(s || '').toLowerCase().replace(/[\s·・,.\-_/()]+/g, '');
const shortDept = d => d.replace(/교실$/, '');

$('#count').textContent = '불러오는 중…';
let quiz, profs;
try {
  const [q, { profs: all }] = await Promise.all([fetch('data/quiz.json').then(r => r.json()), loadProfs()]);
  quiz = q;
  profs = all.filter(p => !p.hidden);
} catch (err) {
  console.error(err);
  $('#count').textContent = '교수님 목록을 불러오지 못했어요. 잠시 후 새로 고침해 주세요.';
  throw err;
}
const topics = quiz.topics.filter(([k]) => profs.some(p => p.topics.includes(k)));
const state = { q: '', kind: '', dept: '', topic: '', page: 0 };

// 첫머리 숫자
const n = { all: profs.length, 기초: 0, 임상: 0, dept: new Set(profs.map(p => p.dept)).size };
profs.forEach(p => n[p.kind]++);
document.querySelectorAll('[data-n]').forEach(b => (b.textContent = n[b.dataset.n]));

function matches(p) {
  const words = state.q.trim().split(/\s+/).map(fold).filter(Boolean);
  if (!words.length) return true;
  const hay = fold([p.name, p.dept, p.rank, p.line, ...p.keywords].join(' '));
  return words.every(w => hay.includes(w));
}
const inKind = p => !state.kind || p.kind === state.kind;
const filtered = () => profs.filter(p => inKind(p) && (!state.dept || p.dept === state.dept)
  && (!state.topic || p.topics.includes(state.topic)) && matches(p));

// 칩: 고른 칩을 한 번 더 누르면 전체로
function chip(key, value, label, count) {
  const on = state[key] === value;
  return `<button class="chip${on ? ' on' : ''}" type="button" data-f="${key}" data-v="${esc(value)}" aria-pressed="${on}">${label}${count == null ? '' : ` <small>${count}</small>`}</button>`;
}
function renderFilters() {
  const kindPs = profs.filter(inKind);
  $('#fKind').innerHTML = chip('kind', '', '전체', profs.length) + ['기초', '임상'].map(k => chip('kind', k, k, n[k])).join('');
  const depts = [...new Set(kindPs.map(p => p.dept))].sort(ko);
  $('#fDept').innerHTML = chip('dept', '', '전체') + depts.map(d => chip('dept', d, esc(shortDept(d)), kindPs.filter(p => p.dept === d).length)).join('');
  $('#fTopic').innerHTML = chip('topic', '', '전체') + topics.map(([k, icon, label]) =>
    chip('topic', k, `${icon} ${esc(label)}`, kindPs.filter(p => p.topics.includes(k)).length)).join('');
}

function card(p) {
  const kws = p.keywords.map(k => `<li>${esc(k)}</li>`).join('');
  const links = p.links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} →</a>`).join('');
  // 담당자가 교수님 본인이고 연락처가 이메일과 같으면 한 번만
  const c = p.contact && !(p.contact.name === p.name && p.contact.info === p.email) ? p.contact : null;
  return `<article class="card" id="p-${esc(p.id)}">
    <img class="photo" src="${esc(p.photo)}" alt="" loading="lazy">
    <div class="id">
      <h3><span class="name">${esc(p.name)}</span><span class="rank">${esc(p.rank)}</span></h3>
      <p class="dept">${esc(p.dept)}</p>
      ${p.email ? `<p class="mail"><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></p>` : ''}
      ${c ? `<p class="contact"><span>담당자</span> ${esc(c.name)}${c.info ? `<br>${esc(c.info)}` : ''}</p>` : ''}
    </div>
    <div class="about">
      ${p.line ? `<p class="line">${esc(p.line)}</p>` : '<p class="line none">연구 소개를 준비하고 있어요.</p>'}
      <ul class="kw">${kws}</ul>
      ${links ? `<p class="go">${links}</p>` : ''}
    </div>
  </article>`;
}

// 쪽 번호: 9쪽까지는 모두, 그보다 많으면 1 … 4 5 6 … 20 처럼 처음·끝과 지금 쪽 둘레만
function pageNumbers(cur, last) {
  if (last <= 9) return Array.from({ length: last }, (_, i) => i + 1);
  const keep = [...new Set([1, cur - 1, cur, cur + 1, last])].filter(x => x >= 1 && x <= last).sort((a, b) => a - b);
  return keep.flatMap((x, i) => (i && x - keep[i - 1] > 1 ? ['…', x] : [x]));
}

function render() {
  const list = filtered();
  const last = Math.max(1, Math.ceil(list.length / PER));
  state.page = Math.min(state.page, last - 1);
  const filtering = state.q.trim() || state.kind || state.dept || state.topic;
  $('#count').innerHTML = filtering ? `<b>${list.length}명</b> / ${profs.length}명` : `<b>${profs.length}명</b>`;
  $('#cards').innerHTML = list.length ? list.slice(state.page * PER, state.page * PER + PER).map(card).join('')
    : '<p class="empty">맞는 교수님이 없어요. 찾는 말이나 칩을 바꿔 보세요.</p>';
  $('#cards').classList.toggle('cards', list.length > 0);
  const cur = state.page + 1;
  $('#pages').innerHTML = last < 2 ? '' : `<button type="button" data-page="${cur - 1}" ${cur > 1 ? '' : 'disabled'} aria-label="이전 쪽">‹</button>`
    + pageNumbers(cur, last).map(x => (x === '…' ? '<span class="gap">…</span>'
      : `<button type="button" data-page="${x}"${x === cur ? ' class="on" aria-current="page"' : ''}>${x}</button>`)).join('')
    + `<button type="button" data-page="${cur + 1}" ${cur < last ? '' : 'disabled'} aria-label="다음 쪽">›</button>`;
}

const top = () => { if ($('#book').getBoundingClientRect().top < 0) $('#book').scrollIntoView(); };

document.querySelector('.filters').addEventListener('click', e => {
  const b = e.target.closest('[data-f]');
  if (!b) return;
  const { f, v } = b.dataset;
  state[f] = state[f] === v ? '' : v;
  // 구분을 바꾸면 그 구분에 없는 교실은 풀어요
  if (f === 'kind' && state.dept && !profs.some(p => inKind(p) && p.dept === state.dept)) state.dept = '';
  state.page = 0;
  renderFilters();
  render();
});
$('#q').addEventListener('input', e => {
  state.q = e.target.value;
  state.page = 0;
  render();
});
$('#pages').addEventListener('click', e => {
  const b = e.target.closest('[data-page]');
  if (!b || b.disabled) return;
  state.page = Number(b.dataset.page) - 1;
  render();
  top();
});

// 테스트 추천에서 교수님을 누르면: 거르기를 풀고 그분이 있는 쪽을 열어 카드를 보여 줘요
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-prof]');
  if (!a) return;
  e.preventDefault();
  Object.assign(state, { q: '', kind: '', dept: '', topic: '' });
  $('#q').value = '';
  state.page = Math.floor(profs.findIndex(p => p.id === a.dataset.prof) / PER);
  renderFilters();
  render();
  const el = document.getElementById(`p-${a.dataset.prof}`);
  if (!el) return;
  el.scrollIntoView({ block: 'center' });
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1600);
});

renderFilters();
render();
window.startQuiz({ ...quiz, topics, profs: profs.map(({ id, name, rank, dept, photo, keywords, style, topics: t }) => ({ id, name, rank, dept, photo, keywords, style, topics: t })) });
