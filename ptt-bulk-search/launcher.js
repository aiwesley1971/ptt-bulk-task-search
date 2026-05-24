/* PTT Bulk Task Search – launcher.js v4.0 */

document.addEventListener('DOMContentLoaded', async () => {
  const stateLoading   = document.getElementById('stateLoading');
  const stateLogin     = document.getElementById('stateLogin');
  const stateLoggedIn  = document.getElementById('stateLoggedIn');
  const btnGoogleLogin = document.getElementById('btnGoogleLogin');
  const loginError     = document.getElementById('loginError');
  const btnOpen        = document.getElementById('btnOpen');
  const btnLogout      = document.getElementById('btnLogout');
  const userPic        = document.getElementById('userPic');
  const userName       = document.getElementById('userName');
  const userEmail      = document.getElementById('userEmail');

  function showLogin()    { stateLoading.style.display = 'none'; stateLogin.style.display = ''; stateLoggedIn.style.display = 'none'; }
  function showLoggedIn() { stateLoading.style.display = 'none'; stateLogin.style.display = 'none'; stateLoggedIn.style.display = ''; }

  function renderUser(user) {
    userPic.src    = user.picture || '';
    userPic.style.display = user.picture ? '' : 'none';
    userName.textContent  = user.name  || '';
    userEmail.textContent = user.email || '';
    showLoggedIn();
  }

  // ── Check existing session ──
  const user = await getUser();
  if (user) {
    renderUser(user);
  } else {
    showLogin();
  }

  // ── Google Sign-In ──
  btnGoogleLogin.addEventListener('click', async () => {
    loginError.textContent = '';
    btnGoogleLogin.disabled = true;
    btnGoogleLogin.textContent = 'Signing in...';
    try {
      const user = await signIn();
      renderUser(user);
    } catch (e) {
      loginError.textContent = e.message || 'Sign-in failed. Please try again.';
      btnGoogleLogin.disabled = false;
      btnGoogleLogin.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 18 18">
          <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
          <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
          <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
        </svg>
        Sign in with Google`;
    }
  });

  // ── Open Search Window ──
  btnOpen.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('app.html') });
    window.close();
  });

  // ── Sign Out ──
  btnLogout.addEventListener('click', async () => {
    btnLogout.textContent = 'Signing out...';
    btnLogout.disabled = true;
    await signOut();
    showLogin();
    loginError.textContent = '';
  });
});
