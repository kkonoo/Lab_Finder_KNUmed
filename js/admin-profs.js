// 관리자 › 교수님: Firestore profs/{id} 가져오기(처음 한 번), 켜고 끄기, 더하기·고치기·지우기
// 누가 쓸 수 있는지와 칸 한도는 firestore.rules의 validProf가 지켜요
import { esc } from './firebase.js';
import { normProf, sortProfs } from './data.js';

const $ = s => document.querySelector(s);
const ko = (a, b) => a.localeCompare(b, 'ko');
const PHOTO_MAX = 150000;   // 사진(data URL) 글자 수 한도. firestore.rules와 같게

// 사진: 가운데·위쪽(얼굴)을 남겨 3:4(300×400)로 자르고 JPEG로 줄여요
async function shrinkPhoto(file) {
  const img = await createImageBitmap(file);
  const W = 300, H = 400;
  const k = Math.max(W / img.width, H / img.height);
  const w = img.width * k, h = img.height * k;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  c.getContext('2d').drawImage(img, (W - w) / 2, (H - h) * 0.2, w, h);
  for (const q of [0.85, 0.7, 0.55]) {
    const url = c.toDataURL('image/jpeg', q);
    if (url.length <= PHOTO_MAX) return url;
  }
  throw new Error('photo too big');
}

// 글 칸 ↔ 저장 값
const linksToText = links => links.map(l => `${l.url} ${l.label}`).join('\n');
function textToLinks(text) {
  const links = [];
  for (const line of text.split('\n').map(x => x.trim()).filter(Boolean)) {
    const [url, ...rest] = line.split(/\s+/);
    if (!/^https?:\/\/\S+$/.test(url)) return null;
    links.push({ url, label: rest.join(' ') || '링크' });
  }
  return links;
}

export async function initProfs({ db, fs, email, toast }) {
  let profs = [];
  let quiz = { types: {}, topics: [] };
  let current = null;   // 고치는 중인 교수님 (더하기면 null)
  let photo = '';       // 대화 상자에서 고른 사진 (경로 또는 data URL)
  const form = $('#profForm');

  try {
    quiz = await fetch('data/quiz.json').then(r => r.json());
  } catch (err) {
    console.error(err);
  }
  $('#styleChoices').innerHTML = Object.entries(quiz.types).map(([k, [icon, name]]) =>
    `<label><input type="checkbox" name="style" value="${k}"> ${icon} ${esc(name)}</label>`).join('');
  $('#topicChoices').innerHTML = quiz.topics.map(([k, icon, label]) =>
    `<label><input type="checkbox" name="topic" value="${k}"> ${icon} ${esc(label)}</label>`).join('');

  async function load() {
    try {
      const snap = await fs.getDocs(fs.collection(db, 'profs'));
      profs = sortProfs(snap.docs.map(d => normProf({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
      $('#profsEmpty').hidden = true;
      $('#profsMain').hidden = false;
      $('#labGroups').innerHTML = err.code === 'permission-denied'
        ? '<p class="msg">교수님 목록을 읽을 권한이 없어요. Firebase 콘솔 › Firestore › 규칙에 저장소의 최신 <code>firestore.rules</code>를 붙여 넣고 게시해 주세요.</p>'
        : '<p class="msg">교수님 목록을 불러오지 못했어요. 새로 고침해 주세요.</p>';
      return;
    }
    $('#profsEmpty').hidden = profs.length > 0;
    $('#profsMain').hidden = !profs.length;
    render();
  }

  function render(focus) {
    const on = ps => ps.filter(p => !p.hidden).length;
    $('#labCount').textContent = `보이는 교수님 ${on(profs)} / ${profs.length}`;
    $('#deptList').innerHTML = [...new Set(profs.map(p => p.dept))].sort(ko).map(d => `<option value="${esc(d)}">`).join('');
    $('#labGroups').innerHTML = ['기초', '임상'].map(kind => {
      const ps = profs.filter(p => p.kind === kind);
      if (!ps.length) return '';
      const depts = [...new Set(ps.map(p => p.dept))].sort(ko);
      return `<h3 class="sec">${kind} <small>${on(ps)} / ${ps.length}</small></h3>` + depts.map(d => `<div class="dept-row">
        <p>${esc(d)}</p>
        <div class="choices">${ps.filter(p => p.dept === d).map(p => `<span class="prof">
          <label><input type="checkbox" data-id="${esc(p.id)}"${p.hidden ? '' : ' checked'}> ${esc(p.name)}${p.line ? '' : ' <small>소개 없음</small>'}</label>
          <button class="edit" type="button" data-edit="${esc(p.id)}" aria-label="${esc(p.name)} 교수님 고치기">✎</button></span>`).join('')}</div>
      </div>`).join('');
    }).join('');
    if (focus) $(`#labGroups input[data-id="${CSS.escape(focus)}"]`)?.focus();
  }

  const stamp = () => ({ updatedAt: fs.serverTimestamp(), updatedBy: email });

  // 처음 한 번: 저장소의 data/profs.json을 Firestore로
  $('#importBtn').addEventListener('click', async () => {
    const b = $('#importBtn');
    b.disabled = true;
    try {
      const { profs: seed } = await fetch('data/profs.json').then(r => r.json());
      const batch = fs.writeBatch(db);
      for (const p of seed) {
        const { id, ...doc } = normProf(p);
        batch.set(fs.doc(db, 'profs', id), { ...doc, ...stamp() });
      }
      await batch.commit();
      toast(`${seed.length}분을 가져왔어요.`);
      await load();
    } catch (err) {
      console.error(err);
      toast('가져오지 못했어요. 규칙을 게시했는지 확인하고 다시 해 주세요.');
    }
    b.disabled = false;
  });

  // 켜고 끄기: 화면을 먼저 바꾸고 저장해요. 못 하면 되돌려요
  async function setHidden(ids, hidden, done, focus) {
    const prev = new Map(profs.map(p => [p.id, p.hidden]));
    profs.forEach(p => { if (ids.includes(p.id)) p.hidden = hidden; });
    render(focus);
    try {
      const batch = fs.writeBatch(db);
      ids.forEach(id => batch.update(fs.doc(db, 'profs', id), { hidden, ...stamp() }));
      await batch.commit();
      toast(done);
    } catch (err) {
      console.error(err);
      profs.forEach(p => (p.hidden = prev.get(p.id)));
      render(focus);
      toast('저장하지 못했어요. 다시 해 주세요.');
    }
  }
  $('#labGroups').addEventListener('change', e => {
    const c = e.target;
    if (!c.matches('input[data-id]')) return;
    const p = profs.find(x => x.id === c.dataset.id);
    setHidden([p.id], !c.checked, `${p.name} 교수님을 ${c.checked ? '켰어요' : '껐어요'}.`, p.id);
  });
  $('#allOnBtn').addEventListener('click', () => setHidden(profs.map(p => p.id), false, '모두 켰어요.'));
  $('#allOffBtn').addEventListener('click', () => {
    if (confirm('모든 교수님을 끌까요? 연구실 찾기에 아무도 안 보이게 돼요.')) setHidden(profs.map(p => p.id), true, '모두 껐어요.');
  });

  // 더하기·고치기
  function open(p) {
    current = p;
    form.reset();
    $('#profMsg').textContent = '';
    const q = p || normProf({});
    $('#profTitle').textContent = p ? `${p.name} 교수님 고치기` : '교수님 더하기';
    const f = form.elements;
    f.name.value = q.name;
    f.rank.value = q.rank;
    f.dept.value = q.dept;
    f.kind.value = p ? q.kind : '';
    f.line.value = q.line;
    f.keywords.value = q.keywords.join(', ');
    form.querySelectorAll('input[name=style]').forEach(c => (c.checked = q.style.includes(c.value)));
    form.querySelectorAll('input[name=topic]').forEach(c => (c.checked = q.topics.includes(c.value)));
    f.links.value = linksToText(q.links);
    f.email.value = q.email;
    f.contact.value = q.contact ? [q.contact.name, q.contact.info].filter(Boolean).join(', ') : '';
    f.shown.checked = !q.hidden;
    photo = q.photo;
    if (photo) $('#profPhoto').src = photo;
    else $('#profPhoto').removeAttribute('src');
    $('#profDeleteBtn').hidden = !p;
    $('#profDlg').showModal();
  }
  $('#addProfBtn').addEventListener('click', () => open(null));
  $('#labGroups').addEventListener('click', e => {
    const b = e.target.closest('[data-edit]');
    if (b) open(profs.find(p => p.id === b.dataset.edit));
  });

  form.elements.photoFile.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      photo = await shrinkPhoto(file);
      $('#profPhoto').src = photo;
    } catch (err) {
      console.error(err);
      $('#profMsg').textContent = '이 사진은 쓸 수 없어요. 다른 사진(JPG·PNG)을 골라 주세요.';
    }
  });

  form.addEventListener('submit', async e => {
    if (e.submitter?.value !== 'save') return;   // 닫기
    e.preventDefault();
    const f = form.elements;
    const links = textToLinks(f.links.value);
    if (!links) return ($('#profMsg').textContent = '링크는 줄마다 https://로 시작하는 주소 다음에 글자를 적어요.');
    if (links.length > 5) return ($('#profMsg').textContent = '링크는 5개까지 넣을 수 있어요.');
    const keywords = f.keywords.value.split(/[,，]/).map(k => k.trim()).filter(Boolean);
    if (keywords.length > 6) return ($('#profMsg').textContent = '키워드는 6개까지 넣을 수 있어요.');
    const [cName, ...cInfo] = f.contact.value.split(/[,，]/).map(x => x.trim());
    const data = {
      name: f.name.value.trim(), rank: f.rank.value.trim(), dept: f.dept.value.trim(), kind: f.kind.value,
      line: f.line.value.trim(), keywords, links,
      contact: cName ? { name: cName, info: cInfo.join(', ') } : null,
      style: [...form.querySelectorAll('input[name=style]:checked')].map(c => c.value),
      topics: [...form.querySelectorAll('input[name=topic]:checked')].map(c => c.value),
      photo, email: f.email.value.trim(), source: current ? current.source : 'admin', hidden: !f.shown.checked,
      ...stamp(),
    };
    try {
      const ref = current ? fs.doc(db, 'profs', current.id) : fs.doc(fs.collection(db, 'profs'));
      await fs.setDoc(ref, data);
      $('#profDlg').close();
      toast(current ? `${data.name} 교수님을 고쳤어요.` : `${data.name} 교수님을 더했어요.`);
      await load();
    } catch (err) {
      console.error(err);
      $('#profMsg').textContent = '저장하지 못했어요. 다시 해 주세요.';
    }
  });

  $('#profDeleteBtn').addEventListener('click', async () => {
    const p = current;
    if (!p || !confirm(`${p.name} 교수님을 지울까요? 되돌릴 수 없어요. 잠시 안 보이게 하려면 지우지 말고 꺼 두세요.`)) return;
    try {
      await fs.deleteDoc(fs.doc(db, 'profs', p.id));
      $('#profDlg').close();
      toast('지웠어요.');
      await load();
    } catch (err) {
      console.error(err);
      $('#profMsg').textContent = '지우지 못했어요. 다시 해 주세요.';
    }
  });

  load();
}
