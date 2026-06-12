/* PTT Search Hub – auth.js v5.0
 *
 * Chrome Extension: chrome.identity.getAuthToken() 방식
 *
 * Flow:
 *  1. chrome.identity.getAuthToken({ interactive: true })
 *     → Chrome에 로그인된 Google 계정의 Access Token 발급
 *  2. GAS에 access_token을 쿼리 파라미터로 전달
 *  3. GAS가 tokeninfo API로 이메일 확인 후 Google Group 멤버 여부 반환
 *  4. 허용된 경우 chrome.storage.local에 사용자 정보 저장
 */

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwXHRBwMGZsfs6xLEQh7wFQ1TOfWmaO4g8i50pZtAYSBcaAj-JRNiVmay_2XCVgTJFv6g/exec';
const AUTH_KEY = 'pttUser';

/** 저장된 사용자 반환. 없으면 null. */
async function getUser() {
  return new Promise(resolve => {
    chrome.storage.local.get(AUTH_KEY, d => resolve(d[AUTH_KEY] || null));
  });
}

/** Access Token 발급 → GAS 호출 → 그룹 멤버 확인 → 사용자 저장 */
async function signIn() {
  // 1. Chrome Identity API로 Access Token 발급
  const token = await new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(token);
      }
    });
  });

  // 2. GAS 호출 (access_token 파라미터로 전달, Google 세션 쿠키 미전송)
  let data;
  try {
    const resp = await fetch(GAS_URL + '?access_token=' + encodeURIComponent(token), { credentials: 'omit' });
    data = await resp.json();
  } catch (e) {
    throw new Error('Failed to connect to authorization server.');
  }

  if (data.status === 'error') {
    throw new Error(data.message || 'Authorization error.');
  }

  if (data.status === 'denied') {
    const err = new Error('not_in_group');
    err.userEmail = data.user;
    err.joinUrl   = data.joinUrl;
    throw err;
  }

  // success → 저장
  const user = {
    email:   data.user,
    name:    data.name    || data.user,
    picture: data.picture || ''
  };
  await chrome.storage.local.set({ [AUTH_KEY]: user });
  return user;
}

/** 로그아웃: 로컬 저장 데이터 삭제 */
async function signOut() {
  return new Promise(resolve => {
    chrome.storage.local.remove([AUTH_KEY, 'pttResults', 'hubResults'], resolve);
  });
}
