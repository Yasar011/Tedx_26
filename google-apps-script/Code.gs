/**
 * TEDxNIFT Jodhpur — outbound mail relay.
 *
 * Deployed as a Google Apps Script Web App and called ONLY from the
 * platform's server-side API route, never from the browser, so the URL and
 * shared secret are never exposed to applicants.
 *
 * Why Apps Script: sending costs nothing, and every send is logged to a
 * Sheet you can read. The daily quota is real and low, so this returns the
 * remaining allowance with every response and refuses politely rather than
 * failing silently once it runs out.
 *
 * ── WHICH ADDRESS DOES MAIL COME FROM? ───────────────────────────────
 * Whichever Google account DEPLOYS this script. So sign in as the TEDx
 * address first, then deploy — applicants will then see mail from TEDx
 * rather than from a personal account.
 *
 * That choice also sets your daily limit:
 *   • free @gmail.com account ............ 100 emails/day
 *   • Google Workspace account ........... 1,500 emails/day
 * If the TEDx address is on Workspace you get 15x the headroom, which
 * matters once you are past ~100 applicants.
 *
 * ── SETUP ────────────────────────────────────────────────────────────
 * 0. Sign in to Google as the TEDx account you want mail sent FROM.
 * 1. Create a Google Sheet. Note its ID from the URL:
 *      docs.google.com/spreadsheets/d/THIS_PART/edit
 * 2. Extensions > Apps Script. Delete the sample, paste this file.
 * 3. Set SHEET_ID and SHARED_SECRET below. The secret must match
 *    APPS_SCRIPT_SHARED_SECRET in the platform's environment variables.
 * 4. Deploy > New deployment > type "Web app"
 *      Execute as:        Me
 *      Who has access:    Anyone
 *    ("Anyone" is required for the server to reach it; the shared secret
 *     is what actually authorises callers.)
 * 5. Copy the /exec URL into APPS_SCRIPT_URL in the platform's env.
 * ─────────────────────────────────────────────────────────────────────
 */

var SHEET_ID = '1x3BYRcfdSMTNa950LPtDTOrXP0P6mW723v8_IJu4JBo';
var SHARED_SECRET = 'CT7cE17cdFARQLKVGKpJBlPbPw4onGZPIG8LZ-RRsYo';
var SHEET_NAME = 'EmailLog';
var FROM_NAME = 'TEDxNIFT Jodhpur';

/**
 * Optional. Leave '' to send from the deploying account (the usual case).
 * Only set this to an address already verified under Gmail >
 * Settings > Accounts > "Send mail as" — an unverified alias is ignored
 * by Gmail and mail still goes out from the deploying account.
 */
var FROM_ALIAS = '';

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    if (!body.secret || body.secret !== SHARED_SECRET) {
      return json({ ok: false, error: 'unauthorised' });
    }

    // Allows the platform to show the remaining allowance without sending.
    if (body.action === 'quota') {
      return json({ ok: true, remaining: MailApp.getRemainingDailyQuota() });
    }

    var to = body.to;
    var subject = body.subject;
    var heading = body.heading || subject;
    var message = body.message || '';
    var detail = body.detail || '';
    var senderName = body.senderName || '';
    var senderTitle = body.senderTitle || '';

    if (!to || !subject) {
      return json({ ok: false, error: 'missing to/subject' });
    }

    var remaining = MailApp.getRemainingDailyQuota();
    if (remaining <= 0) {
      log_(to, subject, 'SKIPPED', 'daily quota exhausted');
      return json({ ok: false, error: 'quota_exhausted', remaining: 0 });
    }

    var options = {
      to: to,
      subject: subject,
      htmlBody: template_(heading, message, detail, senderName, senderTitle),
      name: FROM_NAME,
    };
    if (FROM_ALIAS) options.from = FROM_ALIAS;
    // GmailApp honours verified "send mail as" aliases; MailApp does not.
    if (FROM_ALIAS) {
      GmailApp.sendEmail(to, subject, '', options);
    } else {
      MailApp.sendEmail(options);
    }

    log_(to, subject, 'SENT', '');
    return json({ ok: true, remaining: MailApp.getRemainingDailyQuota() - 1 });
  } catch (err) {
    try {
      log_('-', '-', 'ERROR', String(err));
    } catch (ignored) {}
    return json({ ok: false, error: String(err) });
  }
}

/** Lets you confirm the deployment is live by opening the URL in a browser. */
function doGet() {
  return json({ ok: true, service: 'TEDxNIFT mail relay', remaining: MailApp.getRemainingDailyQuota() });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function log_(to, subject, status, note) {
  if (!SHEET_ID || SHEET_ID === 'PASTE_YOUR_SHEET_ID_HERE') return;
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['Timestamp', 'To', 'Subject', 'Status', 'Note', 'Remaining quota']);
  }
  sheet.appendRow([
    new Date(),
    to,
    subject,
    status,
    note,
    MailApp.getRemainingDailyQuota(),
  ]);
}

function template_(heading, message, detail, senderName, senderTitle) {
  var detailBlock = detail
    ? '<div style="margin:20px 0;padding:14px 16px;background:#f5f5f5;border-radius:8px;' +
      'font-size:14px;color:#333;line-height:1.6">' +
      escape_(detail).replace(/\n/g, '<br>') +
      '</div>'
    : '';

  return (
    '<div style="margin:0;padding:24px;background:#fafafa;font-family:Arial,Helvetica,sans-serif">' +
    '<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;' +
    'overflow:hidden;border:1px solid #e5e5e5">' +
    '<div style="padding:22px 24px;border-bottom:1px solid #eee">' +
    '<span style="color:#EB0028;font-weight:bold;font-size:20px;letter-spacing:-0.5px">TEDx</span>' +
    '<span style="color:#111;font-size:20px"> NIFT Jodhpur</span>' +
    '</div>' +
    '<div style="padding:26px 24px">' +
    '<h1 style="margin:0 0 12px;font-size:19px;color:#111">' + escape_(heading) + '</h1>' +
    '<p style="margin:0;font-size:15px;line-height:1.65;color:#444">' +
    escape_(message).replace(/\n/g, '<br>') +
    '</p>' +
    detailBlock +
    signature_(senderName, senderTitle) +
    '</div>' +
    '<div style="padding:16px 24px;border-top:1px solid #eee;font-size:12px;color:#888">' +
    'This is an automated message from the TEDxNIFT Jodhpur organising platform.<br>' +
    'This independent TEDx event is operated under licence from TED.' +
    '</div>' +
    '</div></div>'
  );
}

/** Signs the mail with the actual person who acted, not just the event. */
function signature_(name, title) {
  if (!name) return '';
  return (
    '<div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:14px;color:#444">' +
    '<div style="color:#666">Sent by</div>' +
    '<div style="font-weight:bold;color:#111">' + escape_(name) + '</div>' +
    (title ? '<div style="color:#666">' + escape_(title) + '</div>' : '') +
    '</div>'
  );
}

function escape_(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
