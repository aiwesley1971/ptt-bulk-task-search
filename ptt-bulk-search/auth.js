/* PTT Bulk Task Search – auth.js v4.1
 *
 * Authentication flow:
 *  1. launchWebAuthFlow → Google OAuth popup (independent of browser account)
 *     - Always shows account picker (prompt=select_account)
 *  2. access_token → Google userinfo API → get name/picture
 *  3. access_token → GAS endpoint → verify token + check Google Group membership
 *  4. If allowed: save user to chrome.storage.local
 *
 * ── SETUP REQUIRED ──────────────────────────────────────────────────────────
 *  1. Go to https://console.cloud.google.com/
 *  2. APIs & Services → Credentials → Create → OAuth 2.0 Client ID
 *     · Application type: Web application
 *     · Authorized redirect URIs: add the value of chrome.identity.getRedirectURL()
 *       (Open browser console in the extension popup and run: chrome.identity.getRedirectURL())
 *       Format: https://<extension-id>.chromiumapp.org/
 *  3. Copy the client_id below.
 * ────────────────────────────────────────────────────────────────────────────
 */

const OAUTH_CLIENT_ID = 'REPLACE_WITH_YOUR_CLIENT_ID.apps.googleusercontent.com';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwZWW_s7YwkfPvOTBDrKL8iCSMyIMdP8Ikr1GLwQLb-vspYkuM3mskpfTbsMIUwUxJZlw/exec';

const AUTH_KEY = 'pttUser';

/** Returns the stored user object, or null if not signed in. */
async function getUser() {
  return new Promise(resolve => {
    chrome.storage.local.get(AUTH_KEY, d => resolve(d[AUTH_KEY] || null));
  });
}

/**
 * Sign in with Google via launchWebAuthFlow.
 * Opens an account picker independently of the browser's signed-in account.
 * Resolves with user object { email, name, picture } on success.
 */
async function signIn() {
  const redirectURL = chrome.identity.getRedirectURL();

  const authURL = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id:     OAUTH_CLIENT_ID,
    response_type: 'token',
    redirect_uri:  redirectURL,
    scope:         'openid email profile',
    prompt:        'select_account'   // Always show account picker → independent of browser account
  });

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authURL, interactive: true },
      async (responseURL) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!responseURL) {
          reject(new Error('Authentication cancelled.'));
          return;
        }

        // Extract access_token from URL fragment (#access_token=...&...)
        const fragment = new URL(responseURL).hash.substring(1);
        const token = new URLSearchParams(fragment).get('access_token');
        if (!token) {
          reject(new Error('No access token received.'));
          return;
        }

        try {
          // ── 1. Get profile info (name, picture) ──
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
      }
    );
  });
}

/**
 * Sign out: clears stored user and search results.
 * The Google OAuth token expires on its own; no revocation needed for launchWebAuthFlow.
 */
async function signOut() {
  return new Promise(resolve => {
    chrome.storage.local.remove([AUTH_KEY, 'pttResults'], resolve);
  });
}
