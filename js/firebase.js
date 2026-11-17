// Firebase SDK를 필요할 때만 불러와요. 신청 페이지는 Firestore만, 관리자 페이지는 로그인까지 써요.
import { firebaseConfig } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/12.19.0';

export const enabled = !!firebaseConfig;

let appP, dbP, authP;

function app() {
  return appP ??= import(`${SDK}/firebase-app.js`).then(m => m.initializeApp(firebaseConfig));
}

// { db, fs } — fs는 firebase-firestore 모듈 (collection, doc 등)
export function firestore() {
  return dbP ??= Promise.all([app(), import(`${SDK}/firebase-firestore.js`)]).then(([a, fs]) => ({ db: fs.getFirestore(a), fs }));
}

// { auth, fa } — fa는 firebase-auth 모듈
export function auth() {
  return authP ??= Promise.all([app(), import(`${SDK}/firebase-auth.js`)]).then(([a, fa]) => ({ auth: fa.getAuth(a), fa }));
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// 관리자가 끈 교수님 이름 (Firestore config/labs의 off). 누구나 읽는 문서라 SDK 없이 REST로 가볍게 읽어요.
// 설정 전이거나 못 읽으면 빈 목록 = 모두 보여요
export async function hiddenLabs() {
  if (!enabled) return new Set();
  try {
    const { projectId, apiKey } = firebaseConfig;
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/config/labs?key=${apiKey}`);
    if (!r.ok) return new Set();
    const doc = await r.json();
    return new Set((doc.fields?.off?.arrayValue?.values || []).map(v => v.stringValue));
  } catch (err) {
    console.error(err);
    return new Set();
  }
}
