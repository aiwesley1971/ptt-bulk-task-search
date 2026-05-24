/**
 * PTT Bulk Task Search – GAS Group Auth v2
 *
 * Deployment: Execute as "Me (admin)" / Who can access: "Anyone with Google Account"
 *
 * Flow:
 *  1. Extension calls: GET ?token=ACCESS_TOKEN
 *  2. This script verifies the token via Google tokeninfo API
 *  3. Extracts the verified email from tokeninfo
 *  4. Checks membership in the Google Group
 *  5. Returns JSON { status, allowed, user, message, [joinUrl] }
 */

const GROUP_EMAIL = "lge-wpc@googlegroups.com";

function doGet(e) {
  try {
    const token = e.parameter.token;
    if (!token) {
      return jsonOut({ status: "error", message: "Missing token." });
    }

    // ── Step 1: Verify access_token and extract email via Google tokeninfo ──
    const tokenResp = UrlFetchApp.fetch(
      "https://oauth2.googleapis.com/tokeninfo?access_token=" + encodeURIComponent(token),
      { muteHttpExceptions: true }
    );
    const tokenInfo = JSON.parse(tokenResp.getContentText());

    if (tokenInfo.error_description || !tokenInfo.email) {
      return jsonOut({ status: "error", message: "Invalid or expired token. Please sign in again." });
    }

    const email = tokenInfo.email;

    // ── Step 2: Check Google Group membership ──
    const group = GroupsApp.getGroupByEmail(GROUP_EMAIL);
    if (!group) {
      return jsonOut({ status: "error", message: "Group not found." });
    }

    const isMember = group.hasUser(email);

    if (isMember) {
      return jsonOut({
        status: "success",
        allowed: true,
        user: email,
        message: "Authorized member."
      });
    } else {
      return jsonOut({
        status: "denied",
        allowed: false,
        user: email,
        message: "Not an authorized member. Please request access.",
        joinUrl: "https://groups.google.com/g/lge-wpc"
      });
    }

  } catch (err) {
    return jsonOut({ status: "error", message: err.message });
  }
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
