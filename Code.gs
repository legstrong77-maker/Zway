// ==========================================
// Zi Wei Dou Shu Form - Google Apps Script
// ==========================================
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // 如果沒有標頭，先建立標頭 (包含命宮與流年欄位)
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["時間戳記", "姓名", "公曆生日", "出生時辰", "本命命宮資訊", "2026 流年資訊"]);
    }
    
    var name = e.parameter.name || "";
    var birthday = e.parameter.birthday || "";
    var birthtime = e.parameter.birthtime || "";
    var lifePalace = e.parameter.lifePalace || "";
    var yearlyFortune = e.parameter.yearlyFortune || "";
    var timestamp = new Date();
    
    var data = sheet.getDataRange().getDisplayValues();
    var isDuplicate = false;
    
    // 從第 2 列開始檢查是否有重複的使用者資訊 (姓名、生日、時間一模一樣)
    for (var i = 1; i < data.length; i++) {
      if (data[i][1] == name && data[i][2] == birthday && data[i][3] == birthtime) {
        isDuplicate = true;
        // 如果發現重複，我們只更新最新的排盤時間與命盤資料
        var row = i + 1;
        sheet.getRange(row, 1).setValue(timestamp);
        sheet.getRange(row, 5).setValue(lifePalace);
        sheet.getRange(row, 6).setValue(yearlyFortune);
        break;
      }
    }
    
    // 若無重複才新增一行
    if (!isDuplicate) {
      sheet.appendRow([timestamp, name, birthday, birthtime, lifePalace, yearlyFortune]);
    }
    
    // 回傳成功
    return ContentService.createTextOutput(JSON.stringify({"result": "success"}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({"error": error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
