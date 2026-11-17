// 인턴십 신청: 모집 안내를 보여 주고, 로그인 없이 누구나 Firestore applications에 신청서를 내요 (보는 건 관리자만, firestore.rules).
// 모집 안내(회차·안내 항목·메일·신청 받기)는 관리자 화면에서 고쳐요 (config/notice, 없으면 js/notice.js 기본값)
// 연구실 찾기 테스트 결과는 주소로 넘어와요: apply.html?style=WQ&topics=cancer,brain
import { enabled, firestore, esc } from './firebase.js';
import { loadNotice, loadProfs } from './data.js';
import { withDefaults, rich } from './notice.js';

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;   // firestore.rules와 같게

const $ = s => document.querySelector(s);
const form = $('#applyForm');
const msg = $('#msg');
const say = (text, kind = '') => { msg.textContent = text; msg.className = `msg ${kind}`; };

const params = new URLSearchParams(location.search);
const style = /^[WEDP][QS]$/.test(params.get('style') || '') ? params.get('style') : '';
const topics = (params.get('topics') || '').split(',').filter(t => /^[a-z]{1,20}$/.test(t)).slice(0, 2);

const notice = withDefaults(await loadNotice());
const MAIL = notice.mail;
document.title = `${notice.title} 신청`;
$('#nTitle').textContent = notice.title;
$('#nLead').textContent = notice.lead;
$('#nFacts').innerHTML = notice.facts.map(f => `<div><dt>${esc(f.name)}</dt><dd>${rich(f.text)}</dd></div>`).join('');
$('#nMailLink').textContent = MAIL;
$('#nMailLink').href = `mailto:${MAIL}?subject=${encodeURIComponent('[연구 인턴십 신청]')}`;
$('#nRetention').textContent = notice.retention;
$('#notice').hidden = false;

function showGate(html) {
  const gate = $('#gate');
  gate.innerHTML = html;
  gate.hidden = false;
}

if (!enabled) {
  showGate(`<p>온라인 신청은 아직 준비하고 있어요. 지원서와 개인정보 이용 동의서를 <a href="mailto:${esc(MAIL)}">${esc(MAIL)}</a>로 보내 주세요.</p>`);
} else if (!notice.open) {
  showGate(`<p>지금은 온라인 신청을 받지 않아요. 궁금한 점은 <a href="mailto:${esc(MAIL)}">${esc(MAIL)}</a>로 물어봐 주세요.</p>`);
} else {
  form.hidden = false;
  init();
}

async function init() {
  // 희망 연구실 목록(관리자가 끈 교수님은 빼고)과 테스트 결과 이름 (못 불러와도 신청서는 쓸 수 있어요)
  try {
    const [{ profs }, quiz] = await Promise.all([loadProfs(), fetch('data/quiz.json').then(r => r.json())]);
    $('#labList').innerHTML = profs.filter(p => !p.hidden)
      .map(p => `<option value="${esc(`${p.name} · ${p.dept}`)}">`).join('');
    if (style) {
      const [icon, name] = quiz.types[style];
      const labels = topics.map(k => quiz.topics.find(t => t[0] === k)?.[2]).filter(Boolean);
      const note = $('#styleNote');
      note.textContent = `연구 스타일 테스트 결과 ${icon} ${name}${labels.length ? ` · 관심 주제 ${labels.join(', ')}` : ''}도 함께 보내요.`;
      note.hidden = false;
    }
  } catch (err) {
    console.error(err);
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const f = form.elements;
    const v = name => f[name].value.trim();
    const email = v('email').toLowerCase();
    if (!EMAIL_OK.test(email)) return say('이메일 주소를 확인해 주세요. 결과를 이 주소로 알려 드려요.', 'bad');
    const app = {
      round: notice.round,
      name: v('name'), sid: v('sid'), year: f.year.value, phone: v('phone'), email,
      track: f.track.value,
      labs: ['lab1', 'lab2', 'lab3'].map(v).filter(Boolean),
      style, topics,
      motive: v('motive'), experience: v('experience'),
      agree: f.agree.checked,
      status: 'submitted',
    };
    const button = $('#submitBtn');
    button.disabled = true;
    say('보내는 중…');
    try {
      const { db, fs } = await firestore();
      await fs.addDoc(fs.collection(db, 'applications'), { ...app, createdAt: fs.serverTimestamp() });
      form.reset();
      say('신청했어요. 선발 결과는 적어 주신 이메일이나 연락처로 알려 드려요.', 'ok');
    } catch (err) {
      console.error(err);
      say(`보내지 못했어요. 잠시 후 다시 해 보고, 계속 안 되면 ${MAIL}로 메일을 보내 주세요.`, 'bad');
    }
    button.disabled = false;
  });
}
