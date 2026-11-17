// 공개 화면(연구실 찾기·신청)이 읽는 데이터. 누구나 읽는 Firestore 문서라 SDK 없이 REST로 가볍게 읽어요.
//   교수님: Firestore profs/{id}. 아직 가져오기 전이거나 못 읽으면 data/profs.json
//   모집 안내: Firestore config/notice. 없으면 js/notice.js의 DEFAULT_NOTICE
import { firebaseConfig } from './firebase-config.js';

const REST = firebaseConfig
  && `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;
const KEY = firebaseConfig && `key=${firebaseConfig.apiKey}`;

// Firestore REST 값 → 보통 값
const val = v => ('stringValue' in v ? v.stringValue
  : 'booleanValue' in v ? v.booleanValue
  : 'integerValue' in v ? Number(v.integerValue)
  : 'doubleValue' in v ? v.doubleValue
  : 'arrayValue' in v ? (v.arrayValue.values || []).map(val)
  : 'mapValue' in v ? fields(v.mapValue.fields)
  : 'timestampValue' in v ? v.timestampValue
  : null);
const fields = f => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, val(v)]));

// 칸이 비어 있어도 화면이 깨지지 않게
export function normProf(p) {
  return {
    id: p.id, name: p.name || '', rank: p.rank || '', dept: p.dept || '', kind: p.kind === '임상' ? '임상' : '기초',
    line: p.line || '', keywords: p.keywords || [], links: p.links || [], contact: p.contact || null,
    style: p.style || [], topics: p.topics || [], photo: p.photo || '', email: p.email || '', source: p.source || '',
    hidden: !!p.hidden,
  };
}

const ko = (a, b) => a.localeCompare(b, 'ko');
// 기초 → 임상, 교실 가나다, 이름 가나다
export const sortProfs = ps => ps.slice().sort((a, b) =>
  (a.kind === b.kind ? 0 : a.kind === '기초' ? -1 : 1) || ko(a.dept, b.dept) || ko(a.name, b.name));

async function restList(path) {
  const docs = [];
  let token = '';
  do {
    const r = await fetch(`${REST}/${path}?pageSize=300&${KEY}${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`);
    if (!r.ok) throw new Error(`${path} ${r.status}`);
    const j = await r.json();
    docs.push(...(j.documents || []).map(d => ({ id: d.name.split('/').pop(), ...fields(d.fields) })));
    token = j.nextPageToken || '';
  } while (token);
  return docs;
}

// 모든 교수님 (끈 분 포함, hidden으로 표시). source: 'firestore' | 'file'
export async function loadProfs() {
  if (REST) {
    try {
      const docs = await restList('profs');
      if (docs.length) return { profs: sortProfs(docs.map(normProf)), source: 'firestore' };
    } catch (err) {
      console.error(err);
    }
  }
  const j = await fetch('data/profs.json').then(r => r.json());
  return { profs: sortProfs(j.profs.map(normProf)), source: 'file' };
}

// 모집 안내 (없으면 null → 기본값)
export async function loadNotice() {
  if (!REST) return null;
  try {
    const r = await fetch(`${REST}/config/notice?${KEY}`);
    if (!r.ok) return null;
    return fields((await r.json()).fields);
  } catch (err) {
    console.error(err);
    return null;
  }
}
