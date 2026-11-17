// 관리자 › 모집 안내: 신청 페이지 맨 위 안내를 Firestore config/notice에 저장해요 (누구나 읽음, 관리자만 씀)
import { DEFAULT_NOTICE, withDefaults, factsToText, textToFacts } from './notice.js';

const $ = s => document.querySelector(s);

export async function initNotice({ db, fs, email, toast }) {
  const form = $('#noticeForm');
  const msg = $('#noticeMsg');
  const ref = fs.doc(db, 'config', 'notice');

  function fill(n) {
    const f = form.elements;
    f.open.checked = n.open;
    f.round.value = n.round;
    f.mail.value = n.mail;
    f.title.value = n.title;
    f.lead.value = n.lead;
    f.facts.value = factsToText(n.facts);
    f.retention.value = n.retention;
  }

  try {
    const snap = await fs.getDoc(ref);
    fill(withDefaults(snap.exists() ? snap.data() : null));
    msg.textContent = snap.exists() ? '' : '아직 저장한 적이 없어서 기본값을 보여 주고 있어요.';
  } catch (err) {
    console.error(err);
    fill(DEFAULT_NOTICE);
    msg.textContent = '저장된 안내를 읽지 못했어요. 규칙을 게시했는지 확인해 주세요.';
  }

  $('#noticeDefaultBtn').addEventListener('click', () => {
    if (confirm('지금 칸을 기본값(2026 동계 안내)으로 바꿀까요? 저장을 눌러야 신청 페이지에 반영돼요.')) fill(DEFAULT_NOTICE);
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const f = form.elements;
    const facts = textToFacts(f.facts.value);
    if (facts.length > 20) return (msg.textContent = '안내 항목은 20개까지 넣을 수 있어요.');
    const data = {
      open: f.open.checked, round: f.round.value.trim(), mail: f.mail.value.trim(), title: f.title.value.trim(),
      lead: f.lead.value.trim(), facts, retention: f.retention.value.trim(),
      updatedAt: fs.serverTimestamp(), updatedBy: email,
    };
    try {
      await fs.setDoc(ref, data);
      msg.textContent = '';
      toast('모집 안내를 저장했어요.');
    } catch (err) {
      console.error(err);
      msg.textContent = '저장하지 못했어요. 다시 해 주세요.';
    }
  });
}
