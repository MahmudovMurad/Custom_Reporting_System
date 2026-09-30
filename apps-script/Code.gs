/**
 * SR Reporting — Google Sheet → server körpüsü.
 * Bu kod "data baza" Sheet-inin öz Apps Script-inə yapışdırılır (Extensions → Apps Script).
 * Main Data və Real Stock-u oxuyur, dəyişiklik varsa serverə göndərir. Dəyişiklik yoxdursa yalnız kiçik yoxlama sorğusu gedir.
 *
 * Quraşdırma: Sheet-də "SR Reporting → Quraşdır" (açarı soruşur, triggerləri yaradır, ilk göndərişi edir).
 * Dəyişiklik olan kimi: onChange triggeri "dəyişib" qeyd edir, hər dəqiqəlik taymer son dəyişiklikdən 20 san sonra göndərir
 * (ardıcıl redaktələr bir göndərişə yığılır). Dəyişiklik olmasa da 15 dəqiqədən bir yoxlama göndərişi gedir.
 * Açar (SYNC_SECRET) quraşdıran istifadəçinin şəxsi xassələrində saxlanılır — digər redaktorlar onu görmür.
 */
var SR = {
  endpoint: 'https://custom-reporting-system.vercel.app/api/ingest',
  mainGid: 0,              // Main Data
  stockGid: 1048230805,    // Real Stock
  partRows: 60000,         // bir sorğuda göndərilən sətir sayı (Vercel sorğu limiti 4.5 MB — gzip-dən sonra ~1 MB)
  quietMs: 20000,          // son redaktədən bu qədər sonra göndərilir (redaktələr bitsin)
  fullMs: 15 * 60000,      // dəyişiklik qeyd olunmasa da bu intervalla yoxlanılır (formula/import dəyişiklikləri üçün)
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('SR Reporting')
    .addItem('İndi göndər', 'menuSend')
    .addItem('Quraşdır (açar + avtomatik göndəriş)', 'setup')
    .addItem('Taymeri dayandır', 'stopTimer')
    .addToUi();
}

function setup() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('SR Reporting — quraşdırma', 'Sync açarını (SYNC_SECRET) yapışdırın:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var secret = r.getResponseText().trim();
  if (secret.length < 32) { ui.alert('Açar çox qısadır — düzgün kopyaladığınızı yoxlayın.'); return; }
  var props = PropertiesService.getUserProperties();
  props.setProperty('SYNC_SECRET', secret);
  props.setProperty('SHEET_ID', SpreadsheetApp.getActiveSpreadsheet().getId());
  stopTimer_();
  ScriptApp.newTrigger('timerSend').timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger('onSheetChange').forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet()).onChange().create();
  var res = send_('menu', null);
  ui.alert('Quraşdırıldı — Sheet dəyişən kimi (təxminən 1 dəqiqə ərzində) avtomatik göndəriləcək.\n\nİlk göndəriş: ' + res.message);
}

/** Installable onChange: yalnız "dəyişib" qeyd edir (göndəriş taymerdədir — ardıcıl redaktələr bir dəfə göndərilsin). */
function onSheetChange() {
  PropertiesService.getUserProperties().setProperty('DIRTY_AT', String(Date.now()));
}

function stopTimer() {
  stopTimer_();
  SpreadsheetApp.getUi().alert('Avtomatik göndəriş dayandırıldı.');
}

function stopTimer_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var h = t.getHandlerFunction();
    if (h === 'timerSend' || h === 'onSheetChange') ScriptApp.deleteTrigger(t);
  });
}

function menuSend() {
  var res = send_('menu', null);
  SpreadsheetApp.getUi().alert(res.message);
}

/** Hər dəqiqə: son redaktədən 20 san keçibsə və ya 15 dəqiqədir göndəriş olmayıbsa göndərir; əks halda dərhal çıxır. */
function timerSend() {
  var props = PropertiesService.getUserProperties(), now = Date.now();
  var dirty = +(props.getProperty('DIRTY_AT') || 0), last = +(props.getProperty('LAST_SEND') || 0);
  var due = (dirty && now - dirty >= SR.quietMs) || now - last >= SR.fullMs;
  if (!due) return;
  var res = send_('timer', null);
  if (!res.ok) console.error(res.message);
}

/** Paneldəki "Yenilə" düyməsi (web app kimi dərc olunanda): server {token, requestedBy} göndərir. */
function doPost(e) {
  var secret = PropertiesService.getUserProperties().getProperty('SYNC_SECRET');
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { /* boş */ }
  var out = (!secret || body.token !== secret) ? { ok: false, message: 'unauthorized' } : send_('web', body.requestedBy || null);
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function send_(trigger, requestedBy) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, message: 'Başqa göndəriş artıq gedir.' };
  try {
    var props = PropertiesService.getUserProperties();
    var secret = props.getProperty('SYNC_SECRET');
    if (!secret) return { ok: false, message: 'Quraşdırılmayıb: "SR Reporting → Quraşdır" menyusundan açarı daxil edin.' };
    // göndərişdən sonra gələn redaktələr itməsin: yalnız oxumağa başladığımız ana qədərki "dəyişib" qeydi silinir
    var dirtyAt = props.getProperty('DIRTY_AT');
    props.setProperty('LAST_SEND', String(Date.now()));
    var ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(props.getProperty('SHEET_ID'));
    var main = sheet_(ss, SR.mainGid, 'Main Data');
    var stock = sheet_(ss, SR.stockGid, 'Real Stock');
    if (!main) return { ok: false, message: '"Main Data" vərəqi tapılmadı.' };

    // ekranda göründüyü kimi (tarix "2-Jan-26" və s.) — köhnə paneldəki CSV exportu ilə eyni
    var mainV = main.getDataRange().getDisplayValues();
    var stockJson = stock ? JSON.stringify(stock.getDataRange().getDisplayValues()) : 'null';
    if (props.getProperty('DIRTY_AT') === dirtyAt) props.deleteProperty('DIRTY_AT');   // oxunarkən yeni redaktə olubsa qeyd qalır
    var parts = [];
    for (var i = 0; i < mainV.length; i += SR.partRows) parts.push(JSON.stringify(mainV.slice(i, i + SR.partRows)));
    mainV = null;
    var sourceHash = sha256_(parts.map(sha256_).join('|') + '|' + sha256_(stockJson));
    var meta = '"trigger":' + JSON.stringify(trigger) + ',"requestedBy":' + JSON.stringify(requestedBy) + ',"sourceHash":' + JSON.stringify(sourceHash);

    // 1) kiçik yoxlama: dəyişiklik yoxdursa burada bitir
    var check = post_(secret, '{"kind":"check",' + meta + '}');
    if (check.error) return { ok: false, message: check.error };
    if (check.status === 'unchanged') return { ok: true, message: 'Dəyişiklik yoxdur.', result: check };

    // 2) data hissələrlə (gzip)
    var uploadId = Utilities.getUuid(), last = null;
    for (var p = 0; p < parts.length; p++) {
      var json = '{"kind":"part",' + meta + ',"uploadId":"' + uploadId + '","part":' + p + ',"total":' + parts.length
        + ',"main":' + parts[p] + (p === 0 ? ',"stock":' + stockJson : '') + '}';
      last = post_(secret, json, true);
      if (last.error) return { ok: false, message: last.error };
    }
    return { ok: last.status !== 'error', message: last.message || 'Göndərildi.', result: last };
  } catch (err) {
    return { ok: false, message: 'Xəta: ' + (err && err.message ? err.message : err) };
  } finally {
    lock.releaseLock();
  }
}

function sheet_(ss, gid, name) {
  var all = ss.getSheets();
  for (var i = 0; i < all.length; i++) if (all[i].getSheetId() === gid) return all[i];
  return ss.getSheetByName(name);
}

function post_(secret, json, gzip) {
  var blob = Utilities.newBlob(json, 'application/json');
  var res = UrlFetchApp.fetch(SR.endpoint, {
    method: 'post',
    contentType: gzip ? 'application/octet-stream' : 'application/json',
    payload: gzip ? Utilities.gzip(blob).getBytes() : blob.getBytes(),
    headers: { Authorization: 'Bearer ' + secret },
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode(), text = res.getContentText();
  var body = {};
  try { body = JSON.parse(text); } catch (e) { body = {}; }
  if (code === 401) return { error: 'Server açarı qəbul etmədi — "Quraşdır" menyusundan açarı yenidən daxil edin.' };
  if (code >= 400 && !body.status) return { error: 'Server xətası ' + code + ': ' + (body.error || text.slice(0, 200)) };
  return body;
}

function sha256_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}
