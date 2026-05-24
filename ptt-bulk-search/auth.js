/* PTT Bulk Task Search – auth.js v4.2
 *
 * Authentication flow:
 *  1. chrome.identity.getAuthToken → Google OAuth token (Chrome Extension type)
 *  2. access_token → Google userinfo API → get name/picture
 *  3. access_token → GAS endpoint → verify token + check Google Group membership
 *  4. If allowed: save user to chrome.storage.local
 *
 * Sign-out: removes cached token + clears local storage
 */

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwXHRBwMGZsfs6xLEQh7wFQ1TOfWmaO4g8i50pZtAYSBcaAj-JRNiVmay_2XCVgTJFv6g/exec';

const AUTH_KEY = 'pttUser';

/** Returns the stored user object, or null if not signed in. */
async function getUser() {
  return new Promise(resolve => {
    chrome.storage.local.get(AUTH_KEY, d => resolve(d[AUTH_KEY] || null));
  });
}

/** Sign in via chrome.identity.getAuthToken → GAS group check. */
async function signIn() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, async (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!token) {
        reject(new Error('No access token received.'));
        return;
      }

      try {
        // ── 1. Get profile info ──
        const uResp = await fetch(
          'https://www.googleapis.com/oauth2/v1/userinfo?access_token=' + token
        );
        const uInfo = await uResp.json();

        // ── 2. GAS: verify token + check Google Group membership ──
        const gasResp = await fetch(GAS_URL + '?' + new URLSearchParams({ token }));
        const gasData = await gasResp.json();

        if (gasData.allowed === true) {
          const user = {
            email:   gasData.user,
            name:    uInfo.name    || gasData.user,
            picture: uInfo.picture || ''
          };
          await chrome.storage.local.set({ [AUTH_KEY]: user });
          resolve(user);

        } else if (gasData.status === 'denied') {
          // Remove cached token so next attempt shows account picker
          chrome.identity.removeCachedAuthToken({ token });
          const err = new Error('not_in_group');
          err.userEmail = gasData.user;
          err.joinUrl   = gasData.joinUrl;
          reject(err);

        } else {
          reject(new Error(gasData.message || 'Authorization check failed.'));
        }

      } catch (e) {
        reject(new Error('Failed to verify access: ' + e.message));
      }
    });
  });
}

/**
 * Sign out: removes cached token and clears stored user + search results.
 */
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
