/**
 * ============================================================
 *   MEDIA MONITORING OTOMATIS & AI AGENT VIRTUAL OFFICE
 *   Organisasi: BPS Provinsi Lampung
 *   Versi: 6.7.0 (Clean Refactor — Bugfix, Auto-Provision, Guard)
 * ============================================================
 */

// ============================================================
// 0. KONFIGURASI GLOBAL
// ============================================================
const CONFIG = {
  API_KEY_PROPERTY: 'GEMINI_API_KEY',
  MODEL: 'gemini-3.5-flash-lite',
  SEARCH_QUERY: [
    '"BPS Provinsi Lampung"',
    '"BPS Lampung"',
    '"Badan Pusat Statistik Provinsi Lampung"',
    '(("BPS Provinsi Lampung" OR "BPS Lampung" OR "Badan Pusat Statistik Provinsi Lampung") ' +
      '(site:lampung.rilis.id OR site:rmollampung.id OR site:lampung77.com OR ' +
      'site:pikiranlampung.com OR site:krakatoa.id OR site:pelitaekspres.com))',
    '(("BPS Provinsi Lampung" OR "BPS Lampung" OR "Badan Pusat Statistik Provinsi Lampung") ' +
      '(site:deklarasinews.com OR site:lampung.radar24.co.id OR site:warta-palapa.com OR ' +
      'site:koraneditor.co OR site:d-actual.id OR site:idnnewspublish.com OR site:lampung.nu.or.id))'
  ],
  MAX_ITEMS: 15,
  MAX_ANALYSIS_PER_RUN: 12,       // Batas aman agar tidak timeout
  SLEEP_BETWEEN_CALLS_MS: 1500,   // Jeda antar panggilan Gemini API
  SHEET_NAME: 'Monitoring',
  HEADER: ['Tanggal', 'Judul', 'Media', 'Link', 'Analisis'],
  TANGGAL_SIAGA_AWAL: 1,
  TANGGAL_SIAGA_AKHIR: 6,
  JAM_NORMAL: [7, 15],
  TIMEZONE: 'Asia/Jakarta'
};

const USERS_HEADER = ['Email', 'OTP', 'Expired_At', 'Attempts', 'Last_Sent', 'Session_Token', 'Last_Login', 'Role'];
const AGENT_HEADER = ['agent_id', 'nama', 'status', 'pesan', 'updated_at', 'output_url'];

const BRS_CONFIG = {
  TEMPLATE_DOC_ID: '1Ikd87qaGpGzK22IuuGX2kRQ1nm_pHALAQCZE9o8ZceQ',
  BENCHMARK_RUTIN_ID: '1eDw8Q0IrWmiEKatBPAVmJGoF7thOMTRP',
  BENCHMARK_GABUNGAN_ID: '1TFMv4OvAOqmDEbByFlb_zX9FvCwx5qH8'
};

// ============================================================
// 1. UTILITAS DASAR & SPREADSHEET
// ============================================================
function getApiBridgeToken_() {
  const token = PropertiesService.getScriptProperties().getProperty('API_BRIDGE_TOKEN');
  return token || 'BPS_Lampung_Humas_2026_SecureKey';
}

function getTargetSpreadsheet_() {
  const ssId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (ssId) {
    try {
      return SpreadsheetApp.openById(ssId);
    } catch (e) {
      Logger.log('⚠️ Gagal buka Spreadsheet via ID, fallback ke Active: ' + e.message);
    }
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function ensureSheet_(ss, name, header) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(header);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function ensureAgentStateSheet_(ss) {
  const sheet = ensureSheet_(ss, 'Agent_State', AGENT_HEADER);
  if (sheet.getLastRow() < 2) {
    const defaults = [
      ['crawler', 'Agent Media Crawler', 'IDLE', '-', '', '-'],
      ['drafter', 'Agent Penulis BRS',   'IDLE', '-', '', '-'],
      ['auditor', 'Agent Auditor & PR',  'DONE', 'Menunggu validasi angka & sentimen...', '-', '-']
    ];
    sheet.getRange(2, 1, defaults.length, AGENT_HEADER.length).setValues(defaults);
  }
  return sheet;
}

function getTargetSheet(ss) {
  ss = ss || getTargetSpreadsheet_();
  if (!CONFIG.SHEET_NAME) return ss.getActiveSheet();
  return ensureSheet_(ss, CONFIG.SHEET_NAME, CONFIG.HEADER);
}

function pastikanHeaderAda(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, CONFIG.HEADER.length)
      .setValues([CONFIG.HEADER])
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

// ============================================================
// 2. AUTENTIKASI EMAIL OTP @bps.go.id
// ============================================================
function getAuthenticatedUser_(token) {
  if (!token) return null;
  const cleanToken = String(token).trim();

  if (cleanToken === getApiBridgeToken_()) {
    return { email: 'system@bps.go.id', role: 'admin' };
  }

  const ss = getTargetSpreadsheet_();
  const sheet = ss.getSheetByName('Users');
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  const idx = USERS_HEADER.reduce((acc, h, i) => (acc[h] = i, acc), {});

  for (let i = 1; i < data.length; i++) {
    const saved = String(data[i][idx.Session_Token] || '').trim();
    if (saved && saved === cleanToken) {
      return {
        email: String(data[i][idx.Email]).trim(),
        role: String(data[i][idx.Role] || 'viewer').trim().toLowerCase()
      };
    }
  }
  return null;
}

function handleEmailAuth_(payload) {
  const ss = getTargetSpreadsheet_();
  const sheet = ensureSheet_(ss, 'Users', USERS_HEADER);
  const idx = USERS_HEADER.reduce((acc, h, i) => (acc[h] = i, acc), {});

  const email = String(payload.email || '').trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@bps\.go\.id$/.test(email)) {
    return { status: 'error', message: 'Akses ditolak. Gunakan email resmi @bps.go.id.' };
  }

  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.Email]).trim().toLowerCase() === email) {
      rowIndex = i + 1;
      break;
    }
  }

  const now = Date.now();

  // ---- STEP 1: Request OTP ----
  if (payload.step === 'request_otp') {
    if (rowIndex !== -1) {
      const lastSentRaw = data[rowIndex - 1][idx.Last_Sent];
      const lastSent = lastSentRaw ? new Date(lastSentRaw).getTime() : 0;
      const delta = now - lastSent;
      if (lastSent && delta < 60000) {
        const sisa = Math.ceil((60000 - delta) / 1000);
        return { status: 'error', message: `Tunggu ${sisa} detik sebelum meminta OTP baru.` };
      }
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiredAt = new Date(now + 10 * 60 * 1000).toISOString();
    const sentAt = new Date(now).toISOString();

    if (rowIndex === -1) {
      const newRow = new Array(USERS_HEADER.length).fill('');
      newRow[idx.Email] = email;
      newRow[idx.OTP] = otp;
      newRow[idx.Expired_At] = expiredAt;
      newRow[idx.Attempts] = 0;
      newRow[idx.Last_Sent] = sentAt;
      newRow[idx.Role] = 'viewer';
      sheet.appendRow(newRow);
    } else {
      sheet.getRange(rowIndex, idx.OTP + 1, 1, 4)
        .setValues([[otp, expiredAt, 0, sentAt]]);
    }

    try {
      MailApp.sendEmail({
        to: email,
        subject: `[SigerHub BPS Lampung] Kode Verifikasi: ${otp}`,
        htmlBody: `
          <div style="font-family:'Segoe UI',sans-serif;padding:24px;border:1px solid #e2e8f0;border-radius:12px;max-width:440px;background:#fff;">
            <div style="display:inline-block;padding:5px 10px;background:#fff7ed;color:#ea580c;font-weight:700;font-size:11px;border-radius:6px;margin-bottom:12px;">
              SIGERHUB • HUMAS BPS PROVINSI LAMPUNG
            </div>
            <h2 style="color:#0f172a;margin:0 0 8px;font-size:18px;">Kode Akses Dashboard</h2>
            <p style="color:#475569;font-size:14px;line-height:1.5;margin:0 0 16px;">
              Halo <b>${email}</b>, masukkan 6 digit kode berikut untuk membuka akses SigerHub:
            </p>
            <div style="font-size:30px;font-weight:800;letter-spacing:8px;padding:14px;background:#0f172a;color:#f97316;text-align:center;border-radius:10px;margin:16px 0;">
              ${otp}
            </div>
            <p style="font-size:12px;color:#94a3b8;margin:16px 0 0;">
              Kode berlaku 10 menit (maksimal 3x percobaan input).
            </p>
          </div>`
      });
      return { status: 'otp_sent', message: `Kode OTP terkirim ke ${email}` };
    } catch (err) {
      return { status: 'error', message: 'Gagal mengirim email OTP: ' + err.message };
    }
  }

  // ---- STEP 2: Verify OTP ----
  if (payload.step === 'verify_otp') {
    if (rowIndex === -1) {
      return { status: 'error', message: 'Silakan minta kode OTP terlebih dahulu.' };
    }

    const row = sheet.getRange(rowIndex, 1, 1, USERS_HEADER.length).getValues()[0];
    const savedOtp = String(row[idx.OTP] || '').trim();
    const expiredAtRaw = row[idx.Expired_At];
    const expiredAt = expiredAtRaw ? new Date(expiredAtRaw).getTime() : 0;
    const attempts = Number(row[idx.Attempts] || 0);
    const existingToken = String(row[idx.Session_Token] || '').trim();
    const userRole = String(row[idx.Role] || 'viewer').trim().toLowerCase();

    if (!savedOtp || !expiredAt || now > expiredAt) {
      return { status: 'error', message: 'Kode OTP sudah kedaluwarsa. Silakan minta kode baru.' };
    }

    if (String(payload.otp || '').trim() !== savedOtp) {
      const nextAttempts = attempts + 1;
      if (nextAttempts >= 3) {
        sheet.getRange(rowIndex, idx.OTP + 1, 1, 3).setValues([['', '', 0]]);
        return { status: 'error', message: 'Salah 3 kali. Kode OTP hangus, silakan minta kode baru.' };
      }
      sheet.getRange(rowIndex, idx.Attempts + 1).setValue(nextAttempts);
      return { status: 'error', message: `Kode OTP salah (percobaan ${nextAttempts}/3).` };
    }

    const sessionToken = existingToken || Utilities.getUuid();
    const waktuLogin = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm:ss') + ' WIB';

    sheet.getRange(rowIndex, idx.OTP + 1, 1, 6)
      .setValues([['', '', 0, '', sessionToken, waktuLogin]]);

    return { status: 'ok', token: sessionToken, email: email, role: userRole };
  }

  return { status: 'error', message: 'Parameter step autentikasi tidak valid.' };
}

// ============================================================
// 3. ANALISIS MANUAL DI SHEETS
// ============================================================
function ANALISIS_BERITA(judul, isi) {
  if (!judul) return 'Masukkan judul berita';
  return panggilGemini(judul, isi || judul);
}

// ============================================================
// 4. ORKESTRATOR JADWAL & CRAWLER RSS
// ============================================================
function jalankanAutonomousOffice() {
  const now = new Date();
  const tgl = Number(Utilities.formatDate(now, CONFIG.TIMEZONE, 'd'));
  const jam = Number(Utilities.formatDate(now, CONFIG.TIMEZONE, 'H'));

  const isMasaSiaga = tgl >= CONFIG.TANGGAL_SIAGA_AWAL && tgl <= CONFIG.TANGGAL_SIAGA_AKHIR;
  const isJamNormal = CONFIG.JAM_NORMAL.includes(jam);

  if (!isMasaSiaga && !isJamNormal) {
    Logger.log(`⏭️ Dilewati (tgl ${tgl}, jam ${jam}:00 WIB di luar jadwal).`);
    return;
  }
  tarikBeritaOtomatis();
}

function tarikBeritaOtomatis() {
  const ss = getTargetSpreadsheet_();
  const sheet = getTargetSheet(ss);
  pastikanHeaderAda(sheet);
  ensureAgentStateSheet_(ss);

  updateAgentStatus('crawler', 'WORKING', 'Memindai Google News RSS untuk berita BPS Provinsi Lampung...', ss.getUrl());

  const queries = Array.isArray(CONFIG.SEARCH_QUERY) ? CONFIG.SEARCH_QUERY : [CONFIG.SEARCH_QUERY];
  let totalDicek = 0;
  let totalDianalisis = 0;

  try {
    const lastRow = sheet.getLastRow();
    let existingData = [];
    let existingLinks = [];

    if (lastRow >= 2) {
      existingData = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
      existingLinks = existingData.map(r => normalizeLink(r[3])).filter(Boolean);
    }

   const newRows = [];
    const batasTanggal = new Date('2026-01-01T00:00:00+07:00');

    for (const query of queries) {
      const rssUrl = buildRssUrl(query);
      try {
        const xml = UrlFetchApp.fetch(rssUrl, { muteHttpExceptions: true }).getContentText();
        const channel = XmlService.parse(xml).getRootElement().getChild('channel');
        if (!channel) continue;

        const items = channel.getChildren('item');
        totalDicek += items.length;

        for (let i = 0; i < Math.min(items.length, CONFIG.MAX_ITEMS); i++) {
          if (totalDianalisis >= CONFIG.MAX_ANALYSIS_PER_RUN) break;

          const item = items[i];
          const title = item.getChildText('title') || '(Tanpa Judul)';
          const link = item.getChildText('link') || '';
          const desc = item.getChildText('description') || title;
          const media = getMediaName(item);

          const teks = (title + ' ' + desc).toLowerCase();
          const relevan =
            teks.includes('badan pusat statistik provinsi lampung') ||
            teks.includes('bps provinsi lampung') ||
            teks.includes('bps lampung');

          if (!relevan || !link) continue;
          if (existingLinks.includes(normalizeLink(link))) continue;

          const rawPub = item.getChildText('pubDate');
          const dateObj = rawPub ? new Date(rawPub) : new Date(0);

          // Batasi hanya berita yang terbit mulai 1 November 2026
          if (isNaN(dateObj.getTime()) || dateObj < batasTanggal) {
            continue;
          }

          updateAgentStatus('crawler', 'WORKING',
            `Menganalisis: ${title.substring(0, 60)}...`, ss.getUrl());

          const analisis = panggilGemini(title, desc);
          newRows.push({
            dateObj,
            row: [formatPubDate(rawPub), title, media, link, analisis]
          });

          existingLinks.push(normalizeLink(link));
          totalDianalisis++;
          Utilities.sleep(CONFIG.SLEEP_BETWEEN_CALLS_MS);
        }
      } catch (err) {
        Logger.log(`⚠️ Gagal query "${query}": ` + err);
      }
    }

    const allRows = newRows.map(n => n.row).concat(existingData);
    if (allRows.length > 0) {
      allRows.sort((a, b) => parseDateCustom(b[0]) - parseDateCustom(a[0]));
      sheet.getRange(2, 1, allRows.length, 5).setValues(allRows);
    }

    Logger.log(`✅ Crawling | dicek: ${totalDicek} | baru: ${newRows.length}`);
    if (newRows.length > 0) {
      updateAgentStatus('crawler', 'DONE', `Selesai: ${newRows.length} berita baru.`, ss.getUrl());
    } else {
      updateAgentStatus('crawler', 'IDLE', `Pemindaian selesai (${totalDicek} item, belum ada baru).`, ss.getUrl());
    }
    return newRows.length;
  } catch (error) {
    Logger.log('❌ Crawler error: ' + error);
    updateAgentStatus('crawler', 'ERROR', 'Gagal menarik berita: ' + error.message, '-');
    throw error;
  }
}

function parseDateCustom(dateStr) {
  if (!dateStr) return new Date(0);
  if (dateStr instanceof Date) return isNaN(dateStr) ? new Date(0) : dateStr;
  const str = String(dateStr);
  if (str === '-') return new Date(0);

  const parts = str.split('/');
  if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

// ============================================================
// 5. GEMINI — TEXT
// ============================================================
function panggilGemini(judul, isi) {
  const prompt = `Bertindaklah sebagai Public Relations Analyst profesional di BPS Provinsi Lampung. Analisis artikel berita berikut:
Judul Berita: "${judul}"
Isi/Kutipan: "${isi}"

Berikan hasil analisis dalam format persis seperti ini tanpa teks tambahan:
RINGKASAN: [3 poin ringkasan singkat]
SENTIMEN: [Positif / Netral / Negatif]
REKOMENDASI: [1 kalimat rekomendasi taktis humas]`;

  return eksekusiFetchGemini(prompt);
}

function eksekusiFetchGemini(promptText) {
  const apiKey = PropertiesService.getScriptProperties().getProperty(CONFIG.API_KEY_PROPERTY);
  if (!apiKey) return 'Error: API Key belum diatur.';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.MODEL}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 16384 }
  };

  try {
    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    const code = res.getResponseCode();
    if (code !== 200) return `Error AI (HTTP ${code}).`;

    const data = JSON.parse(res.getContentText());
    const part = data.candidates?.[0]?.content?.parts?.[0];
    return part?.text ? part.text.trim() : 'Gagal memproses AI.';
  } catch (err) {
    return 'Error AI: ' + err.toString();
  }
}

// ============================================================
// 6. UTILITAS RSS
// ============================================================
function buildRssUrl(query) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=id&gl=ID&ceid=ID:id`;
}

function normalizeLink(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    return (u.origin + u.pathname).toLowerCase().replace(/\/$/, '');
  } catch (e) {
    return String(url).trim().toLowerCase();
  }
}

function getMediaName(item) {
  try {
    const el = item.getChild('source');
    if (el && el.getText()) return el.getText().trim();
  } catch (e) {}
  return 'Google News / Media Online';
}

function formatPubDate(pubDateStr) {
  if (!pubDateStr) return '-';
  const d = new Date(pubDateStr);
  if (isNaN(d.getTime())) return '-';
  return Utilities.formatDate(d, CONFIG.TIMEZONE, 'dd/MM/yyyy');
}

// ============================================================
// 7. DO GET — API BRIDGE
// ============================================================
function doGet(e) {
  try {
    const token = e?.parameter?.token || '';
    const user = getAuthenticatedUser_(token);
    if (!user) {
      return jsonOut_({ status: 'unauthorized', error: 'Invalid or missing token.' });
    }

    const ss = getTargetSpreadsheet_();
    const mode = e?.parameter?.mode || '';

    if (mode === 'verifyAdmin') {
      return jsonOut_({ authorized: user.role === 'admin', email: user.email, role: user.role });
    }

    if (mode === 'agents') {
      const stateSheet = ss.getSheetByName('Agent_State');
      const agents = [];
      if (stateSheet) {
        const rows = stateSheet.getDataRange().getValues();
        for (let i = 1; i < rows.length; i++) {
          if (!rows[i][0]) continue;
          const rawUpdated = rows[i][4];
          const formattedUpdated = rawUpdated instanceof Date
            ? Utilities.formatDate(rawUpdated, CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm:ss') + ' WIB'
            : String(rawUpdated || '-').trim();

          agents.push({
            id: rows[i][0],
            name: rows[i][1],
            status: rows[i][2],
            pesan: rows[i][3],
            updated_at: formattedUpdated,
            output_url: rows[i][5]
          });
        }
      }

      const newsSheet = ss.getSheetByName('Monitoring') || ss.getSheets()[0];
      const newsRows = newsSheet.getDataRange().getValues();
      const recentNews = [];
      for (let i = 1; i < Math.min(newsRows.length, 11); i++) {
        if (!newsRows[i][1]) continue;
        recentNews.push({
          tanggal: newsRows[i][0] instanceof Date
            ? Utilities.formatDate(newsRows[i][0], CONFIG.TIMEZONE, 'dd/MM/yyyy')
            : String(newsRows[i][0]),
          judul: String(newsRows[i][1]),
          media: String(newsRows[i][2]),
          link: String(newsRows[i][3])
        });
      }

      return jsonOut_({
        status: 'ok', user, agents, recentNews,
        latestBrs: getLatestBrsFromSheet(ss)
      });
    }

    const sheet = ss.getSheetByName('Monitoring') || ss.getSheets()[0];
    const rows = sheet.getDataRange().getValues();
    const data = [];
    for (let i = 1; i < rows.length; i++) {
      if (!rows[i][1]) continue;
      data.push({
        tanggal: rows[i][0] instanceof Date
          ? Utilities.formatDate(rows[i][0], CONFIG.TIMEZONE, 'dd/MM/yyyy')
          : String(rows[i][0]).trim(),
        judul: String(rows[i][1]).trim(),
        media: String(rows[i][2]).trim(),
        link: String(rows[i][3]).trim(),
        analisis: String(rows[i][4]).trim()
      });
    }
    return jsonOut_(data);
  } catch (err) {
    return jsonOut_({ error: err.message });
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getLatestBrsFromSheet(ss) {
  const sheet = ss.getSheetByName('Latest_BRS');
  if (!sheet || sheet.getLastRow() < 2) return null;
  const row = sheet.getRange(2, 1, 1, 5).getValues()[0];
  if (!row[1]) return null;
  return { nomorSurat: row[0], judul: row[1], isiNaskah: row[2], docUrl: row[3], waktuSelesai: row[4] };
}

// ============================================================
// 8. DO POST — UPLOAD BRS & AUTH
// ============================================================
function doPost(e) {
  try {
    if (!e?.postData?.contents) throw new Error('Payload POST kosong.');
    const data = JSON.parse(e.postData.contents);

    if (data.action === 'auth') {
      return jsonOut_(handleEmailAuth_(data));
    }

    const user = getAuthenticatedUser_(data.token);
    if (!user) return jsonOut_({ status: 'unauthorized', error: 'Invalid token.' });

    if (data.action === 'uploadBrs') {
      if (user.role !== 'admin') {
        return jsonOut_({
          status: 'error',
          error: 'Akses ditolak: hanya admin Humas yang dapat mengunggah paparan BRS.'
        });
      }
      return jsonOut_(handleUploadBrs_(data, user));
    }

    return jsonOut_({ status: 'success' });
  } catch (err) {
    Logger.log('Error doPost: ' + err);
    updateAgentStatus('drafter', 'ERROR', 'Gagal menyusun BRS: ' + err.message, '-');
    return jsonOut_({ status: 'error', error: err.toString() });
  }
}

function handleUploadBrs_(data, user) {
  const allowedMime = [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'application/pdf'
  ];
  const nameLower = String(data.filename || '').toLowerCase();
  const hasExt = /\.(pptx|ppt|pdf)$/.test(nameLower);
  if (!hasExt || !allowedMime.includes(data.mimeType)) {
    throw new Error('Format tidak diizinkan. Hanya .pptx, .ppt, atau .pdf.');
  }

  const folderId = PropertiesService.getScriptProperties().getProperty('FOLDER_ID_BRS');
  if (!folderId) throw new Error('FOLDER_ID_BRS belum dikonfigurasi.');
  const folder = DriveApp.getFolderById(folderId);

  const bytes = Utilities.base64Decode(data.fileData);
  const blob = Utilities.newBlob(bytes, data.mimeType, data.filename);
  const uploaded = folder.createFile(blob);

  updateAgentStatus('drafter', 'WORKING',
    `Menganalisis paparan (${user.email}): ${data.filename}`, uploaded.getUrl());

  const isGabungan = /gabungan|triwulan|november|mei|tahunan/.test(nameLower);
  const benchDocId = isGabungan ? BRS_CONFIG.BENCHMARK_GABUNGAN_ID : BRS_CONFIG.BENCHMARK_RUTIN_ID;

  let benchmarkText = '';
  try {
    benchmarkText = DocumentApp.openById(benchDocId).getBody().getText();
  } catch (err) {
    Logger.log('Benchmark dilewati: ' + err.message);
  }

  const rawNarrative = callGeminiForPressRelease(data.fileData, data.mimeType, benchmarkText, isGabungan);
  const narrative = cleanBrsHeaderLines_(rawNarrative);
  const resultDoc = createFormattedBrsDoc(folder, narrative, data.filename);
  const preview = parseNarrativeForWallPreview(narrative, data.filename);
  const selesai = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm') + ' WIB';
  const nomor = 'B-' + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'ddMM') +
                '/18000/HM.240/' + new Date().getFullYear();

  simpanLatestBrsToSheet({
    nomorSurat: nomor,
    judul: preview.judul,
    isiNaskah: preview.isiNaskah,
    docUrl: resultDoc.docUrl,
    waktuSelesai: selesai
  });

  updateAgentStatus('drafter', 'DONE', 'Siaran pers siap ditinjau: ' + preview.judul, resultDoc.docUrl);

  return { status: 'success', fileTitle: resultDoc.docTitle, fileUrl: resultDoc.docUrl };
}

// ============================================================
// 9. GEMINI — MULTIMODAL BRS
// ============================================================
function callGeminiForPressRelease(fileBase64, mimeType, benchmarkText, isGabungan) {
  const apiKey = PropertiesService.getScriptProperties().getProperty(CONFIG.API_KEY_PROPERTY);
  if (!apiKey) throw new Error('GEMINI_API_KEY belum diatur.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.MODEL}:generateContent?key=${apiKey}`;
  const scope = isGabungan
    ? 'cakupan rilis strategis makro (PDRB, IPM, Ketenagakerjaan, KSA Padi & Jagung, Kemiskinan, dll)'
    : 'cakupan rilis rutin bulanan (Inflasi IHK, Ekspor-Impor, NTP, Pariwisata, Transportasi)';

  const systemPrompt =
    'Anda adalah Public Relations Strategist dan Penulis Kehumasan profesional di BPS Provinsi Lampung.\n' +
    'Tugas Anda membaca data materi paparan Berita Resmi Statistik (BRS) dengan ' + scope +
    ', lalu mengubahnya menjadi Naskah Siaran Pers (Press Release) lengkap, komprehensif, dan utuh dari awal hingga paragraf penutup tanpa terpotong.\n\n' +
    'ATURAN MUTLAK PENULISAN (SANGAT KETAT):\n' +
    '1. DILARANG KERAS MENULIS ULANG KOP SURAT ATAU HEADER DOKUMEN! ' +
    'Template resmi dokumen BRS Google Docs SUDAH MEMILIKI KOP SURAT RESMI LENGKAP (Logo BPS, Nama Instansi, tulisan SIARAN PERS, dan Nomor Surat otomatis). ' +
    'Oleh karena itu, DILARANG KERAS menuliskan kembali kata/frasa seperti "SIARAN PERS", "BPS PROVINSI LAMPUNG", "BADAN PUSAT STATISTIK PROVINSI LAMPUNG", maupun "Nomor : ..." di awal teks maupun di badan teks.\n' +
    '2. OUTPUT TEKS HARUS DIMULAI LANGSUNG DARI JUDUL BERITA pada baris paling pertama! ' +
    'Jangan menyertakan awalan seperti "Judul:", "Headline:", tanda pagar (#), atau format tanda bintang (**). Langsung tuliskan judul berita yang memikat, formal, dan mencerminkan tema data utama.\n' +
    '3. Baris kedua langsung merupakan Paragraf Pembuka (Lead Berita): Tempat, Tanggal rilis, dan temuan statistik paling krusial menggunakan prinsip Piramida Terbalik.\n' +
    '4. Bentuk Narasi Jurnalistik Mengalir. DILARANG menggunakan bullet points mentah di badan berita.\n' +
    '5. Presisi Angka & Konteks: masukkan seluruh indikator statistik dari materi paparan secara akurat dan natural.\n' +
    '6. Wajib menyertakan kutipan langsung (direct quote) dari Kepala BPS Provinsi Lampung, Bapak Ahmadriswan Nasution.\n' +
    '7. JANGAN GUNAKAN TANDA BINTANG MARKDOWN (* atau **).\n' +
    '8. Pastikan naskah LENGKAP SAMPAI SELESAI, jangan memotong kalimat di tengah.\n\n' +
    '--- DOKUMEN CONTOH BENCHMARK GAYA PENULISAN ---\n' +
    (benchmarkText || 'Gunakan standar penulisan berita resmi BPS yang mengalir dan profesional.') +
    '\n-----------------------------------------------\n\n';

  const payload = {
    contents: [{
      parts: [
        { text: systemPrompt + 'Berikut berkas bahan paparan rilis mentah terbaru. Ekstrak seluruh angka, grafik, tabel, dan indikator secara utuh:' },
        { inlineData: { mimeType, data: fileBase64 } }
      ]
    }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 16384 }
  };

  const maxRetries = 4;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      const code = res.getResponseCode();
      const text = res.getContentText();

      if (code === 200) {
        const json = JSON.parse(text);
        const out = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (out) return cleanBrsHeaderLines_(out);
      }

      const retryable = code === 503 || code === 429 ||
        text.includes('UNAVAILABLE') || text.includes('high demand');

      if (retryable && attempt < maxRetries) {
        updateAgentStatus('drafter', 'WORKING',
          `Server AI padat. Retry ke-${attempt} dalam 6 detik...`, '-');
        Utilities.sleep(6000);
        continue;
      }
      if (!retryable) throw new Error(`HTTP ${code}: ${text}`);
    } catch (err) {
      const msg = err.toString();
      const soft = msg.includes('503') || msg.includes('429') ||
        msg.includes('UNAVAILABLE') || msg.includes('high demand');
      if (soft && attempt < maxRetries) {
        Utilities.sleep(6000);
        continue;
      }
      throw attempt >= maxRetries
        ? new Error('⚠️ Server AI Gemini padat. Coba lagi beberapa saat.')
        : err;
    }
  }
  throw new Error('⚠️ Gagal terhubung ke Gemini setelah beberapa percobaan.');
}

// ============================================================
// 10. DOKUMEN BRS & STATUS AGEN
// ============================================================

/**
 * Pembersih regex otomatis untuk menghapus baris kop surat (SIARAN PERS,
 * BPS PROVINSI LAMPUNG, Nomor Surat, dsb) di awal teks output AI sebelum
 * disuntikkan ke template dokumen Google Docs.
 */
function cleanBrsHeaderLines_(rawText) {
  if (!rawText) return '';
  const lines = rawText.split('\n');
  const cleanedLines = [];
  let pastHeader = false;

  const isHeaderLine = function(line) {
    // Bersihkan karakter markdown pembungkus (#, *, _, >, -, kutip, spasi)
    const s = line.replace(/^[#*_\s>"-]+|[#*_\s<"-]+$/g, '').trim();
    if (!s) return false;

    // 1. Baris Siaran Pers / Press Release
    if (/^(?:siaran\s+pers|press\s+release)(?:\s*[-–:]\s*(?:bps|badan\s+pusat\s+statistik).*)?$/i.test(s)) return true;

    // 2. Baris Nama Lembaga BPS / BPS Lampung
    if (/^(?:bps|badan\s+pusat\s+statistik)(?:\s+provinsi\s+lampung)?\s*(?:[-–:]\s*siaran\s+pers)?$/i.test(s)) return true;

    // 3. Baris Nomor Surat / No. Rilis (termasuk No :, No. :, Nomor :)
    if (/^(?:nomor|no|no\.)\s*[:.]\s*.+$/i.test(s)) return true;

    // 4. Baris metadata kop lainnya
    if (/^(?:tanggal|rilis|embargo|untuk\s+diterbitkan(?:\s+segera)?)\s*[:.].*$/i.test(s)) return true;

    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const stripped = rawLine.replace(/^[#*_\s>"-]+|[#*_\s<"-]+$/g, '').trim();

    if (!pastHeader) {
      // Lewati baris kosong di awal teks
      if (!stripped) continue;

      // Cek apakah baris ini adalah header kop surat
      if (isHeaderLine(rawLine)) {
        Logger.log('🧹 [cleanBrsHeaderLines] Menghapus header kop surat: ' + rawLine);
        continue;
      }

      // Baris non-header pertama ditemukan -> ini adalah Judul Berita
      pastHeader = true;
    }

    // Bersihkan prefix label judul seperti "Judul: " atau "Headline: " jika ada
    if (cleanedLines.length === 0) {
      const unPrefixed = rawLine.replace(/^([#*_\s>"-]*)(?:judul|headline)\s*:\s*/i, '$1');
      cleanedLines.push(unPrefixed);
    } else {
      cleanedLines.push(rawLine);
    }
  }

  return cleanedLines.join('\n').trim();
}

function createFormattedBrsDoc(folder, content, releaseName) {
  const template = DriveApp.getFileById(BRS_CONFIG.TEMPLATE_DOC_ID);
  const cleanName = releaseName.replace(/\.[^/.]+$/, '');
  const docTitle = 'Siaran Pers BRS - ' + cleanName;

  const copied = template.makeCopy(docTitle, folder);
  const doc = DocumentApp.openById(copied.getId());
  const body = doc.getBody();

  // Bersihkan teks dari kop surat berlebih sebelum dimasukkan ke {{KONTEN_UTAMA}}
  content = cleanBrsHeaderLines_(content);

  let targetParagraph = null;
  const paragraphs = body.getParagraphs();
  for (let i = 0; i < paragraphs.length; i++) {
    if (paragraphs[i].getText().indexOf('{{KONTEN_UTAMA}}') !== -1) {
      targetParagraph = paragraphs[i];
      break;
    }
  }

  if (targetParagraph) {
    let insertIdx = body.getChildIndex(targetParagraph);
    targetParagraph.removeFromParent();

    const lines = content.split('\n');
    let isFirstLine = true;

    for (let k = 0; k < lines.length; k++) {
      const line = lines[k].trim();
      const cleanLine = line
        .replace(/\(\*([^*]+)\*\)/g, '($1)')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/[*_]/g, '')
        .trim();

      if (cleanLine.length === 0) continue;

      let newElement;
      if (isFirstLine) {
        newElement = body.insertParagraph(insertIdx, cleanLine.replace(/#/g, '').trim());
        const titleStyle = newElement.asParagraph().editAsText();
        titleStyle.setFontFamily('Arial').setFontSize(14).setBold(true);
        newElement.asParagraph().setSpacingBefore(6).setSpacingAfter(10);
        isFirstLine = false;
      } else if (line.startsWith('#')) {
        newElement = body.insertParagraph(insertIdx, cleanLine.replace(/#/g, '').trim());
        const textStyle = newElement.asParagraph().editAsText();
        textStyle.setFontFamily('Arial').setFontSize(14).setBold(true);
        newElement.asParagraph().setSpacingBefore(12).setSpacingAfter(4);
      } else {
        newElement = body.insertParagraph(insertIdx, cleanLine);
        const bodyStyle = newElement.asParagraph().editAsText();
        bodyStyle.setFontFamily('Arial').setFontSize(11).setBold(false);
        newElement.asParagraph().setLineSpacing(1.15).setSpacingAfter(6);
      }
      insertIdx++;
    }
  } else {
    // Fallback jika {{KONTEN_UTAMA}} berada dalam bentuk teks biasa
    body.replaceText('{{KONTEN_UTAMA}}', content);
    body.appendParagraph('\n' + content);
  }

  doc.saveAndClose();
  return { docTitle: docTitle, docUrl: copied.getUrl() };
}

function parseNarrativeForWallPreview(rawNarrative, fallbackFileName) {
  const cleaned = cleanBrsHeaderLines_(rawNarrative);
  const lines = cleaned.split('\n')
    .map(l => l.replace(/\(\*([^*]+)\*\)/g, '($1)').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/^[#]+\s*/, '').replace(/[*_]/g, '').trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) {
    return { judul: 'Siaran Pers BRS - ' + fallbackFileName.replace(/\.[^/.]+$/, ''), isiNaskah: '' };
  }
  return { judul: lines[0], isiNaskah: lines.slice(1).join('\n\n') };
}

function simpanLatestBrsToSheet(payload) {
  try {
    const ss = getTargetSpreadsheet_();
    if (!ss) return;
    const sheet = ensureSheet_(ss, 'Latest_BRS', ['Nomor_Surat', 'Judul', 'Isi_Naskah', 'Doc_URL', 'Waktu_Selesai']);

    sheet.getRange(2, 1, 1, 5).setValues([[
      payload.nomorSurat || 'DRAFT-BPS-1800',
      payload.judul || 'Siaran Pers Resmi BPS Provinsi Lampung',
      payload.isiNaskah || '',
      payload.docUrl || '#',
      payload.waktuSelesai || ''
    ]]);
    SpreadsheetApp.flush();
  } catch (e) {
    Logger.log('Gagal menyimpan ke Latest_BRS: ' + e.message);
  }
}

function updateAgentStatus(agentId, status, pesan, outputUrl) {
  try {
    const ss = getTargetSpreadsheet_();
    if (!ss) return;
    const sheet = ensureAgentStateSheet_(ss);

    const data = sheet.getDataRange().getValues();
    const waktu = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm:ss') + ' WIB';

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === String(agentId).trim().toLowerCase()) {
        sheet.getRange(i + 1, 3, 1, 4).setValues([[status, pesan, waktu, outputUrl || '-']]);
        SpreadsheetApp.flush();
        break;
      }
    }
  } catch (err) {
    Logger.log('Info Agent_State dilewati: ' + err.message);
  }
}

function otorisasiIzinEmail_() {
  Logger.log('Sisa kuota email harian: ' + MailApp.getRemainingDailyQuota());
}