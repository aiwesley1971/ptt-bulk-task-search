function doGet(e) {
  const groupEmail = "lge-wpc@googlegroups.com";

  try {
    // 1. 현재 접속한 사용자의 이메일 가져오기
    const userEmail = Session.getActiveUser().getEmail();

    // 2. 그룹 정보 가져오기
    const group = GroupsApp.getGroupByEmail(groupEmail);

    if (!group) {
      throw new Error("그룹을 찾을 수 없습니다.");
    }

    // 3. 멤버 여부 확인
    const isMember = group.hasUser(userEmail);

    if (isMember) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        allowed: true,
        user: userEmail,
        message: "Authorized member."
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        status: "denied",
        allowed: false,
        user: userEmail,
        message: "No Authorized member. Apply here",
        joinUrl: "https://groups.google.com/g/lge-wpc"
      })).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
