// 연구 스타일 테스트: 9문항(둘 중 하나) + 관심 주제(두 개까지) -> 유형 + 잘 맞는 교수님
// 방법 4가지(실험·공학·데이터·사람·임상)는 둘씩 한 번씩 맞붙여(6문항) 많이 고른 쪽, 목표(원리·해결)는 3문항 중 많이 고른 쪽
(() => {
  const D = JSON.parse(document.getElementById("quiz-data").textContent);
  const box = document.getElementById("quiz");
  const N = D.questions.length;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(v => v[1]);
  const PER = 5;  // 추천 목록 한 쪽에 5분
  let step = -1, ans = [], picks = [], opts = [], code = "", recs = [], rpage = 0;
  // 관리자가 끈 교수님(js/labs.js가 카드를 숨김)과 소개가 아직 없는 분(style 없음)은 추천에서 빼요
  const pool = () => D.profs.filter(p => p.style.length && !document.getElementById(p.name)?.hidden);

  function intro() {
    return `<p class="label">의과대학 · 2분 테스트</p>
      <h2>나에게 맞는 연구 스타일은?</h2>
      <p class="lead">정답은 없어요. 마음이 가는 쪽을 골라 주세요. 실험 · 공학 · 데이터 · 사람·임상 중 어떤 방식이 나에게 맞는지 알려 드리고, 잘 맞는 교수님 연구실을 추천해 드려요.</p>
      <div class="row"><button class="btn primary" data-act="start">테스트 시작</button>
      <a class="btn" href="#book">교수진 바로 보기 ↓</a>
      <a class="btn" href="apply.html">인턴십 신청</a></div>`;
  }

  function head(i) {
    return `<div class="bar"><i style="width:${(i / (N + 1)) * 100}%"></i></div>
      <p class="label">${i + 1} / ${N + 1}</p>`;
  }

  function question() {
    const q = D.questions[step];
    return head(step) + `<h3 class="q">${esc(q.q)}</h3>
      <div class="opts">${opts[step].map(([k, t]) =>
        `<button class="opt${ans[step] === k ? " on" : ""}" data-act="pick" data-k="${k}">${esc(t)}</button>`).join("")}</div>
      <button class="back" data-act="back">← 이전</button>`;
  }

  function topics() {
    return head(N) + `<h3 class="q">가장 궁금한 주제는? <small>두 개까지</small></h3>
      <div class="chips">${D.topics.filter(([k]) => pool().some(p => p.topics.includes(k))).map(([k, icon, label]) => {
        const on = picks.includes(k);
        return `<button class="chip${on ? " on" : ""}" data-act="topic" data-k="${k}" aria-pressed="${on}"
          ${!on && picks.length >= 2 ? "disabled" : ""}>${icon} ${esc(label)}</button>`;
      }).join("")}</div>
      <div class="row"><button class="btn primary" data-act="done" ${picks.length ? "" : "disabled"}>결과 보기</button></div>
      <button class="back" data-act="back">← 이전</button>`;
  }

  // 유형과 추천 목록은 결과에 들어갈 때 한 번만 정한다 (넘길 때마다 섞이지 않게)
  function finish() {
    const pts = {};
    for (const k of ans) pts[k] = (pts[k] || 0) + 1;
    const n = k => pts[k] || 0;
    const ms = D.methods.map(m => m[0]);
    const top = Math.max(...ms.map(n));
    let tied = ms.filter(m => n(m) === top);
    // 둘이 같으면 그 둘을 맞붙인 문항에서 고른 쪽. 셋이 같으면 그중 하나
    if (tied.length === 2) tied = [ans[D.questions.findIndex(q => q.a.every(([k]) => tied.includes(k)))]];
    const method = shuffle(tied)[0];
    const [g1, g2] = D.goals.map(g => g[0]);
    const goal = n(g1) > n(g2) ? g1 : g2;
    code = method + goal;
    // 주제가 겹치면 3점 + 방법 점수(0~3, 내가 그 방법을 고른 횟수) + 목표가 같으면 1점. 유형이 여럿이면 가장 가까운 것
    // 동점은 섞어서 매번 조금씩 다르게
    const scored = shuffle(pool()).map(p => {
      const hit = p.topics.filter(t => picks.includes(t)).length;
      const fit = Math.max(...p.style.map(st => n(st[0]) + (st[1] === goal ? 1 : 0)));
      const ok = p.style.includes(code) || (hit > 0 && p.style.some(st => st[0] === method));
      return { p, s: 3 * hit + fit, ok };
    }).sort((x, y) => y.s - x.s);
    // 같은 유형 전부 + 방법이 같고 주제가 겹치는 분. 5분이 안 되면 다음으로 가까운 분으로 채움
    const ok = scored.filter(r => r.ok);
    recs = (ok.length >= PER ? ok : ok.concat(scored.filter(r => !r.ok).slice(0, PER - ok.length))).map(r => r.p);
    rpage = 0;
  }

  function result() {
    const [icon, name, text] = D.types[code];
    const m = D.methods.find(x => x[0] === code[0]);
    const g = D.goals.find(x => x[0] === code[1]);
    const pages = Math.ceil(recs.length / PER);
    const shown = recs.slice(rpage * PER, rpage * PER + PER);
    const apply = `apply.html?style=${code}&topics=${picks.join(",")}`;
    return `<p class="label">나의 연구 스타일</p>
      <div class="type"><span class="emoji">${icon}</span><div><h2>${esc(name)}</h2>
        <p class="code">${m[1]} ${esc(m[2])} · ${g[1]} ${esc(g[2])}</p></div></div>
      <p class="lead">${esc(text)}</p>
      <h3 class="rec-title">이런 교수님 연구실이 잘 맞을 수 있어요 <small>${recs.length}분 · 잘 맞는 순</small></h3>
      <ul class="recs">${shown.map(p => `<li><a href="#${encodeURIComponent(p.name)}">
        <img src="${esc(p.photo)}" alt=""><span><b>${esc(p.name)}</b> ${esc(p.rank)}<br>
        <small>${esc(p.dept)} · ${p.page}쪽</small><br><small class="tags">${p.keywords.map(k => "#" + esc(k)).join(" ")}</small></span></a></li>`).join("")}</ul>
      ${pages > 1 ? `<div class="pager"><button class="btn" data-act="prev" ${rpage ? "" : "disabled"}>‹ 이전</button>
        <span>${rpage + 1} / ${pages}</span>
        <button class="btn" data-act="next" ${rpage < pages - 1 ? "" : "disabled"}>다음 ›</button></div>` : ""}
      <div class="row"><a class="btn primary" href="${esc(apply)}">이 결과로 인턴십 신청</a>
      <a class="btn" href="#book">전체 교수진 보기 ↓</a>
      <button class="btn" data-act="again">다시 하기</button></div>`;
  }

  function render(target) {
    box.innerHTML = step < 0 ? intro() : step < N ? question() : step === N ? topics() : result();
    const el = target && (box.querySelector(target) || box);
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView();
  }

  box.addEventListener("click", e => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    if (act === "start") { opts = D.questions.map(q => shuffle(q.a)); ans = []; picks = []; step = 0; }
    else if (act === "pick") { ans[step] = b.dataset.k; step++; }
    else if (act === "back") step--;
    else if (act === "topic") {
      const k = b.dataset.k;
      picks = picks.includes(k) ? picks.filter(x => x !== k) : picks.concat(k);
    }
    else if (act === "done") { finish(); step = N + 1; }
    else if (act === "again") step = -1;
    else if (act === "prev" || act === "next") { rpage += act === "next" ? 1 : -1; return render(".rec-title"); }
    render("#quiz");
  });

  render(null);
})();
