PTT Bulk Task Search v2.2 - Chrome Extension
==============================================

[v3.1 Key Changes]
✅ Popup closing issue completely resolved!
   - Now runs in a separate tab (chrome-extension://...).
   - The search window stays open even when clicking other tabs/windows.
   - Browse freely while a search is in progress.

✅ Service Worker removed
   - popup → launcher.html (opens tab only)
   - Actual search runs directly in app.html + app.js (separate tab)
   - Stable operation without complex Worker communication

✅ Two search modes
   📋 Status Search: Basic info from search results (~1 sec/key)
   🔍 Detail Search: All fields from the detail page (~2 sec/key)

[Installation]
1. Unzip ptt-bulk-search-v2.2.zip
2. Chrome → chrome://extensions/ → Enable Developer mode
3. Click "Load unpacked" → Select the ptt-bulk-search folder
※ Recommended to remove the previous version before reinstalling

[How to Use]
1. Log in to live.pttgps.com
2. Click the P icon in the Chrome toolbar → Click "Open Search Window"
3. The search window opens in a new tab
4. Select search mode (📋 Status / 🔍 Detail)
5. Enter Task Keys (up to 100)
6. Set the date range, then click ▶ Start Search
7. The search continues even if you work in another tab!
8. When done, click ↓ Export CSV
