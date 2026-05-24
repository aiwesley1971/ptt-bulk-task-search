/* PTT Bulk Task Search – auth.js v4.3
 *
 * Flow:
 *  1. chrome.identity.getAuthToken  → Google access token
 *  2. GAS ?token=TOKEN              → tokeninfo 검증 + 그룹 멤버 확인
 *  3. Google userinfo API           → name / picture
 *  4. 결과를 chrome.storage.local 에 저장
 */

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwXHRBwMGZsfs6xLEQh7wFQ1TOfWmaO4g8i50pZtAYSBcaAj-JRNiVmay_2XCVgTJFv6g/exec';
const AUTH_KEY = 'pttUser';

/** 저장된 사용자 반환. 없으면 null. */
async function getUser() {
  return new Promise(resolve => {
    chrome.storage.local.get(AUTH_KEY, d => resolve(d[AUTH_KEY] || null));
  });
}

/** Google 로그인 → GAS 그룹 체크 → 사용자 저장 */
async function signIn() {
  // 1. Chrome identity로 access token 획득
  const token = await new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (t) => {
      if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
      if (!t) { reject(new Error('Failed to get access token.')); return; }
      resolve(t);
    });
  });

  // 2. GAS 호출 (tokeninfo 검증 + 그룹 멤버 확인)
  let gasData;
  try {
    const resp = await fetch(GAS_URL + '?token=' + encodeURIComponent(token));
    const ct = resp.headers.get('content-type') || '';
    if (!ct.includes('json')) {
      throw new Error('Unexpected response from server. Please try again.');
    }
    gasData = await resp.json();
  } catch (e) {
    throw new Error('Group check failed: ' + e.message);
  }

  if (gasData.status === 'error') {
    throw new Error(gasData.message || 'Authorization error.');
  }

  if (gasData.status === 'denied') {
    chrome.identity.removeCachedAuthToken({ token });
    const err = new Error('not_in_group');
    err.userEmail = gasData.user;
    err.joinUrl   = gasData.joinUrl;
    throw err;
  }

  // 3. 프로필 정보 (이름, 사진) 가져오기
  let name = gasData.user, picture = '';
  try {
    const uResp = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?access_token=' + token);
    const uInfo = await uResp.json();
    name    = uInfo.name    || gasData.user;
    picture = uInfo.picture || '';
  } catch (_) { /* 프로필 실패해도 이메일로 진행 */ }

  // 4. 저장
  const user = { email: gasData.user, name, picture };
  await chrome.storage.local.set({ [AUTH_KEY]: user });
  return user;
}

/** 로그아웃: 캐시 토큰 제거 + 로컬 데이터 삭제 */
async function signOut() {
  return new Promise(resolve => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (token) {
        fetch('https://accounts.google.com/o/oauth2/revoke?token=' + token);
        chrome.identity.removeCachedAuthToken({ token });
      }
      chrome.storage.local.remove([AUTH_KEY, 'pttResults'], resolve);
    });
  });
}
