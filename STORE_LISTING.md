# Chrome Web Store 등록 정보 — PTT Search Hub v5.0 (업데이트)

기존 "PTT Bulk Task Search" listing을 그대로 업데이트. Extension ID 유지되므로
OAuth Client, 설치 사용자, 리뷰 모두 유지됨.

---

## 1. 기본 정보 (변경)

**확장 프로그램 이름** (변경)
```
PTT Search Hub
```

**요약 (Summary, 132자 이내)** (변경)
```
Search PTT tasks on live.pttgps.com by task key, model code, or Jira issue key, and export to CSV. For authorized Google Group members.
```

**카테고리** (유지)
```
Productivity
```

---

## 2. 상세 설명 (Description) (변경)

```
PTT Search Hub lets authorized team members search PTT tasks on
live.pttgps.com three different ways from a single interface, and export
all results as CSV — saving hours of manual one-by-one lookups.

🔍 THREE SEARCH TYPES
• Task Key Search — bulk-search up to 100 PTT task keys at once.
  - Status mode: quickly retrieves Status, Project, Due Date, Owner,
    Priority, Complexity, and more (~1 sec/key).
  - Detail mode: additionally opens each task's detail page and pulls
    every field (Request data, Workflow details, URLs, Business Unit,
    Category, Model Name, etc.) for deeper reporting (~2 sec/key).
• Model Code Search — find all PTT requests for up to 20 model codes
  within the last year, including Sales Model Code, Model Name, and
  Ticket ID from each request's detail page.
• Jira Issue Key Search — find all PTT requests linked to up to 20 Jira
  issue keys within the last year.

📋 KEY FEATURES
• One extension, three search types — switch with a single tab click
• Live progress bar with current key and completion count
• Results table with color-coded status badges
• One-click CSV export per search type (UTF-8 BOM, Excel-friendly)
• Search runs in its own tab — keep working in other tabs while it runs
• Results are auto-saved locally per tab and restored next time

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
3. Pick a search type: Task Key, Model Code, or Jira Key
4. Paste your keys and click "Start Search"
5. Click "Export CSV" when done
```

---

## 3. 권한 정당화 (Permission Justification) (대부분 유지)

### Permissions — 변경 없음 (identity / storage / tabs 동일)

**identity** (유지)
```
Used to authenticate the user via Google Sign-In (chrome.identity.getAuthToken)
with the userinfo.email scope only. The resulting token is verified against
Google's token-info endpoint and checked against an authorized Google Group
membership list before granting access to the extension's features.
```

**storage** (유지)
```
Used to store the signed-in user's session info (email/name) and search
results locally via chrome.storage.local, so users don't need to re-search
or re-authenticate every time they open the extension.
```

**tabs** (유지)
```
Used to open the search interface (app.html) in a new browser tab via
chrome.tabs.create, since the search runs as a long-lived process that
should not be interrupted by the popup closing.
```

### Host permissions — 변경 없음

**https://live.pttgps.com/*** (유지)
```
Required to fetch task search results and detail pages from the PTT
platform using the user's existing authenticated session (cookies).
This is the core data source for the extension's search functionality.
```

**https://script.google.com/* and https://script.googleusercontent.com/*** (유지)
```
Required to call a Google Apps Script Web App endpoint that verifies the
signed-in user's Google Group membership for access control. No search
data is sent to this endpoint — only an OAuth access token for
verification.
```

### Remote code / external endpoints disclosure (유지)
```
This extension calls one external endpoint (a Google Apps Script Web App
under the developer's Google account) solely to verify Google Group
membership at sign-in time. No user search data, task keys, or results
are transmitted to this or any other external endpoint.
```

---

## 4. 단일 목적 설명 (Single Purpose) (변경)

```
The single purpose of this extension is to allow authorized users to
search PTT tasks on live.pttgps.com — by task key, model code, or Jira
issue key — and export the results as CSV.
```

---

## 5. Privacy Policy URL (유지, 내용만 보강 권장)

```
https://aiwesley1971.github.io/ptt-bulk-task-search/privacy-policy.html
```

privacy-policy.html 수정 권장 사항:
- 제목/본문의 "PTT Bulk Task Search" → "PTT Search Hub"
- "task keys" 언급 → "task keys, model codes, and Jira issue keys"
- Last updated 날짜 갱신

---

## 6. 스크린샷 (교체 필요 — 1280x800 또는 640x400, 1~5장)

- [ ] 1. 로그인 팝업 (launcher.html, "PTT Search Hub v5.0" 표시 상태)
- [ ] 2. Task Key 탭 — Status 검색 결과 화면
- [ ] 3. Task Key 탭 — Detail 검색 결과 화면
- [ ] 4. Model Code 탭 검색 결과 화면
- [ ] 5. Jira Key 탭 검색 결과 화면

기존 스크린샷은 옛 UI라 전부 교체 권장. 아이콘(icon128.png)은 그대로 사용 가능.

---

## 7. 데이터 사용 설문 (Data Usage Form) — 변경 없음

| 항목 | 답변 |
|------|------|
| Personally identifiable information | 수집함 — 이메일 주소 (로그인 인증 목적) |
| Authentication information | 수집함 — Google 로그인 토큰 (검증만, 저장 안 함) |
| Web history | 수집 안 함 |
| User activity | 수집 안 함 |
| Website content | 수집함 — live.pttgps.com 페이지 데이터 (로컬 처리만) |
| Location / Financial / Health | 수집 안 함 |

체크박스 3개(판매 안 함 / 무관 목적 사용 안 함 / 신용평가 사용 안 함) 동일하게 체크.

---

## 8. 업로드 전 체크리스트

- [ ] manifest.json에서 `"key"` 필드 제거했는지 확인 (로컬 테스트 전용)
- [ ] manifest version이 게시된 버전(4.5)보다 높은지 확인 → 5.0 OK
- [ ] ptt-search-hub 폴더만 zip으로 압축 (상위 폴더 포함하지 않기)
```
