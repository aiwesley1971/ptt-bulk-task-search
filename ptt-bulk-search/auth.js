/* PTT Bulk Task Search – auth.js v4.0
 *
 * Google OAuth utilities shared by launcher and app.
 *
 * SETUP REQUIRED:
 *  1. Go to https://console.cloud.google.com/
 *  2. Create a project → APIs & Services → Credentials
 *  3. Create OAuth 2.0 Client ID (Chrome Extension type)
 *  4. Copy the client_id into manifest.json → "oauth2" → "client_id"
 *
 * OPTIONAL – restrict to a specific domain (e.g. "company.com"):
 *  Set ALLOWED_DOMAIN below. Leave empty to allow any Google account.
 */

const ALLOWED_DOMAIN = ''; // e.g. 'concentrix.com'
const AUTH_KEY = 'pttUser';

/** Returns the stored user object, or null if not signed in. */
async function getUser() {
  return new Promise(resolve => {
    chrome.storage.local.get(AUTH_KEY, d => resolve(d[AUTH_KEY] || null));
  });
}

/** Sign in with Google. Resolves with user object on success. */
async function signIn() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, async (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      try {
        const resp = await fetch(
          `https://www.googleapis.com/oauth2/v1/userinfo?access_token=${token}`
        );
        const info = await resp.json();

        if (ALLOWED_DOMAIN && !info.email.endsWith('@' + ALLOWED_DOMAIN)) {
          // Revoke token and block access
          fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);
          chrome.identity.removeCachedAuthToken({ token });
          reject(new Error(
            `Access restricted to @${ALLOWED_DOMAIN} accounts.\n` +
            `Signed in as: ${info.email}`
          ));
          return;
        }

        const user = {
          email: info.email,
          name:  info.name,
          picture: info.picture
        };
        await chrome.storage.local.set({ [AUTH_KEY]: user });
        resolve(user);
      } catch (e) {
        reject(e);
      }
    });
  });
}

/** Sign out: revoke token, clear stored user and search results. */
async function signOut() {
  return new Promise(resolve => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (token) {
        fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);
        chrome.identity.removeCachedAuthToken({ token });
      }
      chrome.storage.local.remove([AUTH_KEY, 'pttResults'], resolve);
    });
  });
}
