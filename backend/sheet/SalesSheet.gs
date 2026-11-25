/**
 * SALES FMS  <->  Google Sheet connector            (brand-new sheet, sales columns only)
 * ------------------------------------------------------------------
 * THE SHEET HAS ONE TAB CALLED "Leads". The sales team types ONLY these columns:
 *
 *     Timestamp | Lead Name | Lead Email | Lead Phone | Assigned To | Workshop Date | Workshop Name | WhatsApp Link
 *     (Timestamp fills itself the moment a phone number is typed.)
 *
 * The website fills these columns BACK on the same row after a caller updates the lead (grey, don't type):
 *     Interest Level | Profession | City | Call Status
 *
 * Every new row goes straight to FU1 on the assigned caller's "Today Follow-ups". There are no Day 1 / Day 2 stages.
 *   - Workshop Date (dd/mm/yyyy) and Workshop Name: which workshop the lead is for. Type a NEW workshop name and the website shows a filter for it.
 *   - WhatsApp Link: the lead's WhatsApp chat / group link — it powers the green WhatsApp button on the lead.
 *   - Assigned To: pick a name from the dropdown (names come from the "_Team" tab). Leave blank = shared out automatically.
 *
 * SETUP (once, about 3 minutes)
 *  1. Create a NEW blank Google Sheet.  Extensions -> Apps Script.  Delete what is there and paste this whole file.
 *  2. Fill the two values just below (SECRET_KEY, SYNC_URL) — OR use the website's Settings -> "Copy Apps Script" button,
 *     which pastes them in for you.
 *  3. Save, choose  setupSalesSheet  and press Run (allow access). It builds the "Leads" and "_Team" tabs for you.
 *  4. Type your callers' names (exactly as in the website's Team page -> Caller name) in the "_Team" tab, column A.
 *  5. Run  setupInstantSync  once (new rows then reach the website in seconds).
 *  6. Deploy -> New deployment -> type "Web app".  Execute as: Me.  Who has access: Anyone.  Deploy and copy the Web app URL.
 *  7. Website: Settings -> Sales sheet -> paste the URL -> Save -> Test connection.
 *
 *  Tabs starting with an underscore (_Team, _Notes ...) and hidden tabs are ignored. You may add more lead tabs
 *  (duplicate "Leads" and rename it) — every tab that has "Lead Name" and "Lead Phone" headers is read.
 *  If you edit this file later: Deploy -> Manage deployments -> edit -> New version.
 */

var SECRET_KEY = "__SECRET_KEY__";   // filled in by the website's "Copy Apps Script" button
var SYNC_URL   = "__SYNC_URL__";     // the website address that is told "a row just arrived" (same button)
var TIME_ZONE  = "Asia/Kolkata";

var LEADS_TAB = "Leads";
var TEAM_TAB  = "_Team";
var TYPED_HEADERS   = ["Timestamp", "Lead Name", "Lead Email", "Lead Phone", "Assigned To", "Workshop Date", "Workshop Name", "WhatsApp Link"];
var WEBSITE_HEADERS = ["Interest Level", "Profession", "City", "Call Status"];   // filled by the website
var INTEREST_OPTIONS = ["Hot", "Warm", "Cold", "N/A"];

// what the website receives: [name it expects, how to recognise the header in this sheet]
var COLUMNS = [
  ["Timestamp", /timestamp/], ["Lead Name", /lead.*name|^name$/], ["Lead Email", /email/], ["Lead Phone", /phone/],
  ["UTW Date", /workshop.*date|^date$/],                            // the website calls this the Workshop Date
  ["Assigned To", /assigned/],
  ["Workshop Name", /workshop.*name/],
  ["WhatsApp Link", /whatsapp|link/],
  ["Level", /interest|level/], ["Profession", /profession/], ["City", /city/],
  ["Msg Sent", /^\b$/], ["Call Status", /call.*status/]
];

/* ---------------------------------------------------------------- web app */

function doGet(e) {
  try { check_(e.parameter.token); return json_({ ok: true, rows: readRows_() }); }
  catch (err) { return json_({ ok: false, error: String(err.message || err) }); }
}

// the website says either "delete the rows of these phone numbers" (leads deleted on the website)
// or: "write Interest Level / Profession / City / Call Status for these phone numbers"
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var body = JSON.parse(e.postData.contents);
    check_(body.token);
    lock.waitLock(20000);
    if (body.deletes) return json_(Object.assign({ ok: true }, deleteRows_(body.deletes)));
    return json_(Object.assign({ ok: true }, writeBack_(body.updates || [])));
  } catch (err) { return json_({ ok: false, error: String(err.message || err) }); }
  finally { try { lock.releaseLock(); } catch (x) {} }
}

function check_(token) {
  if (!SECRET_KEY || SECRET_KEY.indexOf("__") === 0) throw new Error("Secret key not set in the script");
  if (token !== SECRET_KEY) throw new Error("Wrong secret key");
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ------------------------------------------------------------- finding tabs */

function skipTab_(sh) { return sh.getName().charAt(0) === "_" || sh.isSheetHidden(); }

// a lead tab = a header row (within the first 15 rows) that has both "phone" and "name"
function inspect_(sh) {
  var rows = Math.min(sh.getLastRow(), 15), cols = sh.getLastColumn();
  if (rows < 1 || cols < 1) return null;
  var top = sh.getRange(1, 1, rows, cols).getValues();
  for (var i = 0; i < top.length; i++) {
    var head = top[i].map(function (h) { return String(h).trim().toLowerCase(); });
    if (head.some(function (h) { return /phone/.test(h); }) && head.some(function (h) { return /name/.test(h); })) return { sheet: sh, hi: i, head: head };
  }
  return null;
}
function leadTabs_() {
  var out = [];
  SpreadsheetApp.getActiveSpreadsheet().getSheets().forEach(function (sh) { if (skipTab_(sh)) return; var t = inspect_(sh); if (t) out.push(t); });
  return out;
}
function findCol_(head, re) { for (var i = 0; i < head.length; i++) if (re.test(head[i])) return i; return -1; }

// dates are sent as dd/MM/yyyy [HH:mm:ss] in India time, whatever the sheet's own locale is
function cell_(v) {
  if (v instanceof Date) {
    var midnight = Utilities.formatDate(v, TIME_ZONE, "HH:mm:ss") === "00:00:00";
    return Utilities.formatDate(v, TIME_ZONE, midnight ? "dd/MM/yyyy" : "dd/MM/yyyy HH:mm:ss");
  }
  return v === null || v === undefined ? "" : String(v);
}

/* ------------------------------------------------------------------- read */

function readRows_() {
  var out = [COLUMNS.map(function (c) { return c[0]; })];
  leadTabs_().forEach(function (t) {
    var sh = t.sheet, last = sh.getLastRow();
    if (last <= t.hi + 1) return;
    var idx = COLUMNS.map(function (c) { return findCol_(t.head, c[1]); });
    var vals = sh.getRange(t.hi + 2, 1, last - t.hi - 1, sh.getLastColumn()).getValues();
    vals.forEach(function (r) {
      if (String(r[idx[3]]).trim() === "") return;                      // no phone = not a lead row
      out.push(idx.map(function (i) { return i < 0 ? "" : cell_(r[i]); }));
    });
  });
  return out;
}

/* ------------------------------------------------------------- write-back */

function last10_(v) { return String(v || "").replace(/\D/g, "").slice(-10); }

function writeBack_(updates) {
  var wanted = {}, found = {};
  updates.forEach(function (u) { var p = last10_(u.phone); if (p) wanted[p] = u; });

  leadTabs_().forEach(function (t) {
    var sh = t.sheet, last = sh.getLastRow(), head = t.head.slice();
    if (last <= t.hi + 1) return;
    var n = last - t.hi - 1, phoneCol = findCol_(head, /phone/);
    var phones = sh.getRange(t.hi + 2, phoneCol + 1, n, 1).getValues();
    var rowsOf = {}, any = false;
    for (var i = 0; i < n; i++) {
      var p = last10_(phones[i][0]);
      if (p && wanted[p]) { (rowsOf[p] = rowsOf[p] || []).push(i); found[p] = true; any = true; }
    }
    if (!any) return;

    // [header to write, regex that finds it, key in the website's update]
    [["Interest Level", /interest|level/, "level"], ["Profession", /profession/, "profession"], ["City", /city/, "city"], ["Call Status", /call.*status/, "callStatus"]]
      .forEach(function (x) {
        var c = findCol_(head, x[1]);
        if (c < 0) {                                                    // this tab has no such column yet: add it
          c = head.length; head.push(x[0].toLowerCase());
          if (c + 1 > sh.getMaxColumns()) sh.insertColumnAfter(sh.getMaxColumns());
          sh.getRange(t.hi + 1, c + 1).setValue(x[0]).setFontWeight("bold");
        }
        var range = sh.getRange(t.hi + 2, c + 1, n, 1), vals = range.getValues(), changed = false;
        Object.keys(rowsOf).forEach(function (p) {
          var v = wanted[p][x[2]];
          if (v === undefined || v === null || String(v) === "") return;   // never blank out a cell
          rowsOf[p].forEach(function (ri) { if (String(vals[ri][0]) !== String(v)) { vals[ri][0] = v; changed = true; } });
        });
        if (changed) range.setValues(vals);
      });
  });
  SpreadsheetApp.flush();
  return { updated: Object.keys(found).length, missing: Object.keys(wanted).filter(function (p) { return !found[p]; }) };
}

// Removes every lead row whose phone number (last 10 digits) is in the list — used when leads are deleted on the website,
// so the next sync does not bring them back.
function deleteRows_(phones) {
  var gone = {}, deleted = 0;
  phones.forEach(function (p) { var k = last10_(p); if (k) gone[k] = true; });
  leadTabs_().forEach(function (t) {
    var sh = t.sheet, last = sh.getLastRow();
    if (last <= t.hi + 1) return;
    var phoneCol = findCol_(t.head, /phone/), n = last - t.hi - 1;
    var vals = sh.getRange(t.hi + 2, phoneCol + 1, n, 1).getValues();
    for (var i = n - 1; i >= 0; i--) {                       // bottom-up so row numbers stay valid
      if (gone[last10_(vals[i][0])]) { sh.deleteRow(t.hi + 2 + i); deleted++; }
    }
  });
  SpreadsheetApp.flush();
  return { deleted: deleted };
}

/* ------------------------------------------------------ one-time set-up */

// Builds the whole sales sheet: "Leads" tab (headers, dropdowns, colours, frozen header) and the "_Team" tab.
function setupSalesSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var team = ss.getSheetByName(TEAM_TAB) || ss.insertSheet(TEAM_TAB);
  if (team.getLastRow() < 1) {
    team.getRange(1, 1, 1, 2).setValues([["Caller name", "How to use"]]).setFontWeight("bold");
    team.getRange(2, 2).setValue("Type each caller's name in column A, exactly like the website's Team page → Caller name. They appear in the Assigned To dropdown.");
    team.getRange(2, 1, 3, 1).setValues([["Caller 1"], ["Caller 2"], ["Caller 3"]]);
    team.setColumnWidth(1, 200); team.setColumnWidth(2, 520); team.setFrozenRows(1);
  }

  var sh = ss.getSheetByName(LEADS_TAB) || ss.getSheets()[0];
  if (sh.getName() !== LEADS_TAB) sh.setName(LEADS_TAB);
  var all = TYPED_HEADERS.concat(WEBSITE_HEADERS), nCols = all.length;
  sh.getRange(1, 1, 1, nCols).setValues([all]);
  sh.getRange(1, 1, 1, nCols).setFontWeight("bold").setFontColor("#ffffff").setVerticalAlignment("middle").setHorizontalAlignment("left");
  sh.getRange(1, 1, 1, TYPED_HEADERS.length).setBackground("#0f766e");                       // typed by the team
  sh.getRange(1, TYPED_HEADERS.length + 1, 1, WEBSITE_HEADERS.length).setBackground("#64748b");   // filled by the website
  sh.setRowHeight(1, 34); sh.setFrozenRows(1); sh.setFrozenColumns(2);
  var widths = [150, 170, 210, 140, 140, 130, 190, 280, 120, 150, 120, 130];
  widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  if (sh.getMaxRows() < 500) sh.insertRowsAfter(sh.getMaxRows(), 500 - sh.getMaxRows());

  var rows = sh.getMaxRows() - 1;
  sh.getRange(2, 1, rows, 1).setNumberFormat("dd/MM/yyyy HH:mm:ss");
  sh.getRange(2, 4, rows, 1).setNumberFormat("@");                                           // phone numbers stay text
  sh.getRange(2, 6, rows, 1).setNumberFormat("dd/MM/yyyy");                                  // Workshop Date
  var asg = SpreadsheetApp.newDataValidation().requireValueInRange(team.getRange("A2:A"), true).setAllowInvalid(true).build();
  sh.getRange(2, 5, rows, 1).setDataValidation(asg);
  var lvl = SpreadsheetApp.newDataValidation().requireValueInList(INTEREST_OPTIONS, true).setAllowInvalid(true).build();
  sh.getRange(2, TYPED_HEADERS.length + 1, rows, 1).setDataValidation(lvl);
  var grey = sh.getRange(2, TYPED_HEADERS.length + 1, rows, WEBSITE_HEADERS.length);
  grey.setBackground("#f1f5f9");
  sh.getRange(2, 1, rows, 1).setBackground("#f1f5f9");                                       // timestamp is automatic too
  sh.getRange(1, 1).setNote("Fills itself when a phone number is typed.");
  sh.getRange(1, TYPED_HEADERS.length + 1).setNote("Filled in by the website after a caller updates the lead. No need to type here.");
  sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function (p) { if (p.getDescription() === "Filled by the website") p.remove(); });
  grey.protect().setDescription("Filled by the website").setWarningOnly(true);
  sh.getRange(1, 1, sh.getMaxRows(), nCols).setFontFamily("Inter, Arial");
  sh.setTabColor("#0d9488"); team.setTabColor("#94a3b8");

  // one example row so the team sees the format (delete it before going live)
  if (sh.getRange(2, 2).getValue() === "") {
    sh.getRange(2, 2, 1, 7).setValues([["Sample Lead (delete this row)", "sample@example.com", "9999999999", "", "25/12/2026", "Sample Workshop", "https://wa.me/919999999999"]]);
    stampAll_();
  }
  SpreadsheetApp.getUi().alert("Sales sheet is ready ✅\n\nNext:\n1. Type your callers' names in the _Team tab (column A).\n2. Run setupInstantSync.\n3. Deploy → New deployment → Web app (Execute as Me, Anyone).\n4. Paste the Web app URL in the website: Settings → Sales sheet.");
}

// Shows which tabs the website will read and which are ignored (and why).
function checkTabs() {
  var read = [], skipped = [];
  SpreadsheetApp.getActiveSpreadsheet().getSheets().forEach(function (sh) {
    var name = sh.getName();
    if (name.charAt(0) === "_") return skipped.push(name + "  (starts with _)");
    if (sh.isSheetHidden()) return skipped.push(name + "  (hidden)");
    var info = inspect_(sh);
    if (!info) return skipped.push(name + "  (no 'Lead Name' + 'Lead Phone' header row)");
    read.push(name + "  (" + Math.max(sh.getLastRow() - info.hi - 1, 0) + " rows)");
  });
  SpreadsheetApp.getUi().alert("READ by the website:\n" + (read.join("\n") || "none") + "\n\nIGNORED:\n" + (skipped.join("\n") || "none"));
}

/* ----------------------------------------------------------- timestamps */

function stampRows_(sh, r1, r2, phoneCol, tsCol) {
  var n = r2 - r1 + 1, phones = sh.getRange(r1, phoneCol, n, 1).getValues();
  var stamps = sh.getRange(r1, tsCol, n, 1), vals = stamps.getValues(), now = new Date(), changed = false;
  for (var i = 0; i < n; i++) if (String(phones[i][0]).trim() !== "" && String(vals[i][0]).trim() === "") { vals[i][0] = now; changed = true; }
  if (changed) stamps.setValues(vals).setNumberFormat("dd/MM/yyyy HH:mm:ss");
}

// Simple trigger: when a phone is typed/pasted in any lead tab, rows with a phone but no Timestamp get the current time.
function onEdit(e) {
  try {
    var sh = e.range.getSheet();
    if (skipTab_(sh)) return;
    var info = inspect_(sh);
    if (!info) return;
    var phoneCol = findCol_(info.head, /phone/) + 1, tsCol = findCol_(info.head, /timestamp/) + 1;
    if (!phoneCol || !tsCol) return;
    var c1 = e.range.getColumn(), c2 = c1 + e.range.getNumColumns() - 1;
    if (phoneCol < c1 || phoneCol > c2) return;
    var r1 = Math.max(e.range.getRow(), info.hi + 2), r2 = e.range.getRow() + e.range.getNumRows() - 1;
    if (r2 >= r1) stampRows_(sh, r1, r2, phoneCol, tsCol);
  } catch (err) {}
}
function stampAll_() {
  leadTabs_().forEach(function (t) {
    var last = t.sheet.getLastRow(), phoneCol = findCol_(t.head, /phone/) + 1, tsCol = findCol_(t.head, /timestamp/) + 1;
    if (last >= t.hi + 2 && phoneCol && tsCol) stampRows_(t.sheet, t.hi + 2, last, phoneCol, tsCol);
  });
}
function fillMissingTimestamps() { stampAll_(); SpreadsheetApp.getUi().alert("Timestamps filled ✅"); }

/* ------------------------------------------------------- instant sync */

function notifyWebsite_() {
  if (!SYNC_URL || SYNC_URL.indexOf("__") === 0) return "SYNC_URL is not set — use the website's “Copy Apps Script” button again";
  try {
    var res = UrlFetchApp.fetch(SYNC_URL + "?token=" + encodeURIComponent(SECRET_KEY), { method: "post", muteHttpExceptions: true, followRedirects: true });
    var code = res.getResponseCode();
    return code === 200 ? "ok" : "website answered HTTP " + code + ": " + String(res.getContentText()).slice(0, 120);
  } catch (err) { return "could not reach the website: " + err.message; }
}

function onSheetChange_(e) {
  var lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(10000)) { notifyWebsite_(); return; }
    try { stampAll_(); } catch (x) {}
    SpreadsheetApp.flush();
  } finally { try { lock.releaseLock(); } catch (y) {} }
  notifyWebsite_();
}

// Run ONCE: installs the "row added" trigger so new leads reach the website within seconds.
function setupInstantSync() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "onSheetChange_") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("onSheetChange_").forSpreadsheet(ss).onChange().create();
  if (ss.getFormUrl()) ScriptApp.newTrigger("onSheetChange_").forSpreadsheet(ss).onFormSubmit().create();
  var r = notifyWebsite_();
  SpreadsheetApp.getUi().alert(r === "ok"
    ? "Instant sync is ON ✅\nNew rows now reach the website within seconds."
    : "Triggers installed, but the website did not answer yet:\n" + r + "\n\nCheck the secret key in Settings and that the website is running, then run setupInstantSync again.");
}
function testWebsitePing() { SpreadsheetApp.getUi().alert("Website answer: " + notifyWebsite_()); }
