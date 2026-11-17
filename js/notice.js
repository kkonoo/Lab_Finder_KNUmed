// 신청 페이지의 모집 안내. 관리자 화면 ‘모집 안내’에서 고치면 Firestore config/notice에 저장돼요.
// 저장한 적이 없으면 아래 기본값을 보여 줘요 (관리자 화면도 이 값으로 채워서 시작해요)
import { esc } from './firebase.js';

export const DEFAULT_NOTICE = {
  round: '2026 동계',
  open: true,
  title: '2026학년도 동계 학부생 연구 인턴십',
  lead: '의과대학 학부생이 6주 동안 교내 연구실이나 DGIST 연구실에서 연구에 참여해요. 어떤 연구실이 맞을지 모르겠다면 먼저 연구실 찾기에서 2분 테스트를 해 보세요.',
  facts: [
    { name: '활동 기간', text: '2026. 12. 21.(월) ~ 2027. 1. 29.(금), 6주 동안 Full-time\n연구 일정과 시간은 참여 연구실 지도교수님과 협의해요' },
    { name: '지원 자격', text: '경북대학교 의과대학 재학생' },
    { name: '운영 트랙', text: 'Track 1 교내 연구 인턴십 · 경북대학교 교내 연구실\nTrack 2 DGIST 연계 연구 연수 · DGIST 참여 연구실' },
    { name: '지원 내용', text: '인턴 수료증 (결과보고서 제출과 연구 성과발표회 참석 시)\n시상금 (최종 평가 결과에 따라 차등)\n참여 연구실에 연구활동비 지원' },
    { name: '일정', text: '신청 · 2026. 11. 25.(수) 13시까지\n선발과 연구실 매칭 · 2026. 12. 2.(수)까지\n연구 인턴십 · 2026. 12. 21.(월) ~ 2027. 1. 29.(금)\n연구 성과발표회 · 2027년 2월 초' },
    { name: '참여 학생이 할 일', text: '배정된 연구실에서 성실하게 인턴 참여\n연구 성과발표회에서 연구 결과 구두 발표\n연구 결과보고서 제출' },
    { name: '문의', text: '053-420-4855 · hgysu03@knu.ac.kr' },
  ],
  mail: 'hgysu03@knu.ac.kr',
  retention: '프로그램 종료(2027년 2월) 후 1년, 이후 파기',
};

// 저장된 값에 빠진 칸은 기본값으로
export const withDefaults = n => ({ ...DEFAULT_NOTICE, ...(n || {}) });

// 안내 항목 ↔ 관리자 화면의 글 칸: 빈 줄로 항목을 나누고, 항목의 첫 줄이 이름, 나머지가 내용
export const factsToText = facts => facts.map(f => `${f.name}\n${f.text}`).join('\n\n');
export const textToFacts = text => String(text).replace(/\r/g, '').split(/\n\s*\n/).map(b => b.trim()).filter(Boolean)
  .map(b => { const [name, ...rest] = b.split('\n'); return { name: name.trim(), text: rest.join('\n').trim() }; });

// 글 → HTML: 줄바꿈은 그대로, 이메일·주소는 링크로
export const rich = text => esc(text)
  .replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}">${u}</a>`)
  .replace(/(^|[\s(])([^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,})/gi, (m, pre, mail) => `${pre}<a href="mailto:${mail}">${mail}</a>`)
  .replace(/\n/g, '<br>');
