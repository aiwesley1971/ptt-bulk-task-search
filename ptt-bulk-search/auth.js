/* PTT Bulk Task Search – auth.js v4.4
 *
 * 원본 GAS (Session.getActiveUser) 사용
 *
 * Flow:
 *  1. fetch(GAS_URL, { credentials: 'include' })
 *     → 브라우저에 로그인된 Google 계정의 쿠키를 GAS에 전달
 *     → GAS의 Session.getActiveUser()가 이메일을 반환
 *  2. GAS가 Google Group 멤버 여부를 확인하고 결과 반환
 *  3. 허용된 경우 chrome.storage.local에 사용자 정보 저장
 *
 * GAS URL: 원본 배포 URL (Session.getActiveUser 버전)
 */

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwZWW_s7YwkfPvOTBDrKL8iCSMyIMdP8Ikr1GLwQLb-vspYkuM3mskpfTbsMIUwUxJZlw/exec';
const AUTH_KEY = 'pttUser';

/** 저장된 사용자 반환. 없으면 null. */
async function getUser() {
  return new Promise(resolve => {
    chrome.storage.local.get(AUTH_KEY, d => resolve(d[AUTH_KEY] || null));
  });
}

/** GAS 호출 → 그룹 멤버 확인 → 사용자 저장 */
async function signIn() {
  let data;
  try {
    const resp = await fetch(GAS_URL, { credentials: 'include' });
    const ct = resp.headers.get('content-type') || '';
    if (!ct.includes('json')) {
      throw new Error('Google 계정에 로그인되어 있는지 확인 후 다시 시도해주세요.');
    }
    data = await resp.json();
  } catch (e) {
    throw new Error(e.message || 'Connection failed. Please try again.');
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
  const user = { email: data.user, name: data.user, picture: '' };
  await chrome.storage.local.set({ [AUTH_KEY]: user });
  return user;
}

/** 로그아웃: 로컬 저장 데이터 삭제 */
async function signOut() {
  return new Promise(resolve => {
    chrome.storage.local.remove([AUTH_KEY, 'pttResults'], resolve);
  });
}
