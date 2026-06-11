/**
 * Google Group Auth – GAS Web App
 * ─────────────────────────────────
 * 배포 설정:
 *   - Execute as: Me
 *   - Who has access: Anyone
 *
 * Chrome Extension → ?access_token=TOKEN
 * Web App          → ?id_token=TOKEN
 * (둘 다 처리 가능)
 */

const GROUP_EMAIL = "lge-wpc@googlegroups.com";
const JOIN_URL    = "https://groups.google.com/g/lge-wpc";

function doGet(e) {
  const accessToken = e.parameter.access_token;
  const idToken     = e.parameter.id_token;

  if (!accessToken && !idToken) {
    return jsonResponse({ status: "error", message: "No token provided." });
  }

  try {
    // 토큰 종류에 따라 tokeninfo URL 선택
    const tokenInfoUrl = accessToken
      ? "https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=" + encodeURIComponent(accessToken)
      : "https://www.googleapis.com/oauth2/v3/tokeninfo?id_token="     + encodeURIComponent(idToken);

    const tokenInfoResp = UrlFetchApp.fetch(tokenInfoUrl);
    const tokenInfo     = JSON.parse(tokenInfoResp.getContentText());

    if (tokenInfoResp.getResponseCode() !== 200 || !tokenInfo.email) {
      throw new Error("Invalid or expired token.");
    }

    const userEmail   = tokenInfo.email;
    const userName    = tokenInfo.name    || userEmail;
    const userPicture = tokenInfo.picture || "";

    // Google Group 멤버 여부 확인
    const group    = GroupsApp.getGroupByEmail(GROUP_EMAIL);
    const isMember = group.hasUser(userEmail);

    if (isMember) {
      return jsonResponse({
        status:  "success",
        user:    userEmail,
        name:    userName,
        picture: userPicture,
        message: "Authorized member."
      });
    } else {
      return jsonResponse({
        status:  "denied",
        user:    userEmail,
        name:    userName,
        picture: userPicture,
        message: "Not an authorized member.",
        joinUrl: JOIN_URL
      });
    }

  } catch (err) {
    return jsonResponse({ status: "error", message: err.message });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
