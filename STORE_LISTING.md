# Chrome Web Store 등록 정보

## 1. 기본 정보

**확장 프로그램 이름**
```
PTT Bulk Task Search
```

**요약 (Summary, 132자 이내)**
```
Bulk-search PTT task keys on live.pttgps.com and export results to CSV. Access restricted to authorized Google Group members.
```

**카테고리**
```
Productivity
```

**언어**
```
English (기본), 필요 시 한국어 추가
```

---

## 2. 상세 설명 (Description)

```
PTT Bulk Task Search lets you search up to 100 PTT task keys at once on
live.pttgps.com and export the results as a CSV file — saving hours of
manual one-by-one lookups.

🔍 TWO SEARCH MODES
• Status Search — quickly retrieves Status, Project, Due Date, Owner,
  Priority, Complexity, and more for each task key (~1 sec/key).
• Detail Search — additionally opens each task's detail page and pulls
  every field (Request data, Workflow details, Authoring/Reference/Live
  URLs, Business Unit, Category, Model Name, etc.) for deeper reporting
  (~2 sec/key).

📋 KEY FEATURES
• Search up to 100 task keys per run (paste, comma, or newline separated)
• Live progress bar with current key and completion count
• Results table with color-coded Found / Not Found status
• One-click CSV export (UTF-8 BOM, Excel-friendly)
• Search runs in its own tab — keep working in other tabs while it runs
• Results are auto-saved locally and restored next time you open the tab

🔒 ACCESS & SIGN-IN
This extension is intended for authorized team members only. Sign in with
your Google account; access is granted only to members of a designated
Google Group. No search data is ever sent to the developer — all results
stay on your device. See the Privacy Policy for full details.

📌 REQUIREMENTS
• You must be logged in to live.pttgps.com in the same browser
• Your Google account must belong to the authorized Google Group

HOW TO USE
1. Click the extension icon and sign in with Google
2. Click "Open Search Window" (opens in a new tab)
3. Choose Status Search or Detail Search
4. Paste your task keys (up to 100)
5. Click "Start Search"
6. Click "Export CSV" when done
```

---

## 3. 권한 정당화 (Permission Justification — 심사 시 입력)

### Permissions

**identity**
```
Used to authenticate the user via Google Sign-In (chrome.identity.getAuthToken)
with the userinfo.email scope only. The resulting token is verified against
Google's token-info endpoint and checked against an authorized Google Group
membership list before granting access to the extension's features.
```

**storage**
```
Used to store the signed-in user's session info (email/name) and search
results locally via chrome.storage.local, so users don't need to re-search
or re-authenticate every time they open the extension.
```

**tabs**
```
Used to open the search interface (app.html) in a new browser tab via
chrome.tabs.create, since the search runs as a long-lived process that
should not be interrupted by the popup closing.
```

### Host permissions

**https://live.pttgps.com/***
```
Required to fetch task search results and detail pages from the PTT
platform using the user's existing authenticated session (cookies).
This is the core data source for the extension's search functionality.
```

**https://script.google.com/* and https://script.googleusercontent.com/***
```
Required to call a Google Apps Script Web App endpoint that verifies the
signed-in user's Google Group membership for access control. No search
data is sent to this endpoint — only an OAuth access token for
verification.
```

### Remote code / external endpoints disclosure

```
This extension calls one external endpoint (a Google Apps Script Web App
under the developer's Google account) solely to verify Google Group
membership at sign-in time. No user search data, task keys, or results
are transmitted to this or any other external endpoint.
```

---

## 4. 단일 목적 설명 (Single Purpose)

```
The single purpose of this extension is to allow authorized users to
bulk-search PTT (Print/Production Task Tracker) task keys on
live.pttgps.com and export the results as CSV.
```

---

## 5. Privacy Policy URL

GitHub Pages로 호스팅 후 아래 형식의 URL 입력:
```
https://aiwesley1971.github.io/ptt-bulk-task-search/privacy-policy.html
```

(`docs/privacy-policy.html`을 GitHub Pages로 배포 — Settings → Pages →
Source: main branch /docs 폴더)

---

## 6. 스크린샷 준비 체크리스트

Chrome Web Store는 **1280x800 또는 640x400** 스크린샷 1~5장 필요.

- [ ] 1. Sign in with Google 팝업 (launcher.html, 로그인 전 화면)
- [ ] 2. 로그인 후 "Open Search Window" 화면
- [ ] 3. Status Search 결과 화면 (app.html, 데이터 채워진 상태)
- [ ] 4. Detail Search 결과 화면
- [ ] 5. CSV Export 후 엑셀에서 연 모습 (선택)

아이콘은 `icon128.png` 그대로 사용 가능 (Store 아이콘 요구사항: 128x128).

---

## 7. 데이터 사용 설문 (Data Usage Form — Chrome Web Store Developer Dashboard)

| 항목 | 답변 |
|------|------|
| Personally identifiable information | **수집함** — 이메일 주소 (로그인 인증 목적) |
| Authentication information | **수집함** — Google 로그인 토큰 (서버 전송 안 함, 검증만) |
| Web history | 수집 안 함 |
| User activity | 수집 안 함 |
| Website content | **수집함** — live.pttgps.com 페이지 데이터 (로컬 처리만, 외부 전송 안 함) |
| Location | 수집 안 함 |
| Financial / Health info | 수집 안 함 |

체크박스:
- [x] Data is **not** sold to third parties
- [x] Data is **not** used for purposes unrelated to the extension's core functionality
- [x] Data is **not** used to determine creditworthiness or for lending purposes
```
