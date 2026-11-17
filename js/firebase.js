// Firebase SDK를 필요할 때만 불러와요. 신청 페이지는 신청서를 낼 때만 Firestore, 관리자 페이지는 로그인까지 써요.
// 공개 화면이 읽기만 하는 데이터는 js/data.js가 SDK 없이 읽어요.
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

