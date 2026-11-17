// 연구실 찾기 화면에서 관리자가 끈 교수님을 빼요 (인쇄용 labfinder.pdf에는 모두 나와요).
// 테스트 추천(quiz.js)은 카드가 숨겨졌는지를 보고 빼요
import { hiddenLabs } from './firebase.js';

const off = await hiddenLabs();
if (off.size) {
  const cards = [...document.querySelectorAll('.card')];
  for (const c of cards) c.hidden = off.has(c.id);
  // 빈자리가 생기지 않게 종류(기초·임상)마다 보이는 카드를 첫 쪽에 모아 이어서 보여 줘요
  for (const kind of ['기초', '임상']) {
    const pages = [...document.querySelectorAll(`.page[data-kind="${kind}"]`)];
    if (!pages.length) continue;
    const grid = pages[0].querySelector('.grid');
    const shown = cards.filter(c => c.dataset.kind === kind && !c.hidden);
    grid.append(...shown);
    pages[0].classList.add('flow');
    pages.slice(1).forEach(p => (p.hidden = true));
    pages[0].hidden = !shown.length;
  }
  // 표지: 찾아보기와 숫자
  document.querySelectorAll('.index li[data-name]').forEach(li => (li.hidden = off.has(li.dataset.name)));
  const shown = cards.filter(c => !c.hidden);
  const n = {
    all: shown.length,
    기초: shown.filter(c => c.dataset.kind === '기초').length,
    임상: shown.filter(c => c.dataset.kind === '임상').length,
    dept: new Set(shown.map(c => c.dataset.dept)).size,
  };
  document.querySelectorAll('[data-n]').forEach(b => (b.textContent = n[b.dataset.n]));
  document.querySelector('.index small').textContent = '가나다순';   // 쪽 번호는 인쇄본 기준이라 화면에서는 안 맞아요
  document.querySelectorAll('.index li b, .index li i').forEach(el => (el.hidden = true));
}
