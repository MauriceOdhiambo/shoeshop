/**
 * SHOE BUSINESS MANAGEMENT SYSTEM - Backend
 */

const SHEET_INVENTORY = 'Inventory';
const SHEET_ORDERS = 'Orders';
const SHEET_ADMINS = 'Admins';
const SHEET_HISTORY = 'History';
const ADMIN_EMAIL = 'YOUR_ADMIN_EMAIL'; // archived legacy setting; do not reuse for production
const CURRENCY = 'KSh';
const DRIVE_FOLDER_NAME = 'ShoeShop_Images';

// ============ WEB APP ENTRY ============
function doGet(e) {
  try { ensureSheets(); } catch (err) { Logger.log('ensureSheets: ' + err); }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Shoe Shop')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=5')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ============ AUTO-CREATE SHEETS ============
function ensureSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return;
  if (!ss.getSheetByName(SHEET_INVENTORY)) {
    const s = ss.insertSheet(SHEET_INVENTORY);
    s.appendRow(['ID','Picture','Buying Price','size','Target Price','Status','method Payment','price sold','Profit Margin','comment','Date','Category','Stock Type']);
    styleHeader(s, 13);
  }
  if (!ss.getSheetByName(SHEET_ORDERS)) {
    const s = ss.insertSheet(SHEET_ORDERS);
    s.appendRow(['Order ID','Shoe ID','Customer Name','Phone','Location','Comment','Date','Status']);
    styleHeader(s, 8);
  }
  if (!ss.getSheetByName(SHEET_ADMINS)) {
    const s = ss.insertSheet(SHEET_ADMINS);
    s.appendRow(['Email', 'Password']);
    s.appendRow(['REDACTED', 'REDACTED - insecure legacy default removed']);
    styleHeader(s, 2);
  }
  if (!ss.getSheetByName(SHEET_HISTORY)) {
    const s = ss.insertSheet(SHEET_HISTORY);
    s.appendRow(['Timestamp','Shoe ID','Field Changed','Old Value','New Value','Changed By','Full Row Snapshot','Action']);
    styleHeader(s, 8);
  }
}

function styleHeader(sheet, cols) {
  sheet.getRange(1, 1, 1, cols).setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
}

// Convert values to types supported by google.script.run. Date objects cannot be
// returned directly to the browser, so serialize them as ISO-like local date strings.
function toClientSafeValue(value) {
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '';
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
  }
  if (Array.isArray(value)) return value.map(toClientSafeValue);
  if (value && typeof value === 'object') {
    const safe = {};
    Object.keys(value).forEach(function(key) { safe[key] = toClientSafeValue(value[key]); });
    return safe;
  }
  return value === undefined ? null : value;
}

// ============ DIAGNOSTIC ============
function TEST_everything() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('Spreadsheet: ' + ss.getName());
  const adm = ss.getSheetByName(SHEET_ADMINS);
  const creds = adm.getDataRange().getValues();
  if (creds.length > 1) {
    const email = String(creds[1][0]);
    const pass = String(creds[1][1]);
    const inv = getAdminInventory(email, pass);
    Logger.log('Inventory: success=' + inv.success + ' count=' + (inv.shoes ? inv.shoes.length : 'null'));
    const ord = getOrders(email, pass);
    Logger.log('Orders: success=' + ord.success + ' count=' + (ord.orders ? ord.orders.length : 'null'));
  }
}

// ============ CUSTOMER API ============
function getLatestPublicStockNumber(data) {
  // Stock # (Inventory column M) is the stock batch identifier.
  // The customer shop displays ONLY the newest stock batch.
  let latest = null;
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    const raw = data[i][12];
    const n = Number(raw);
    if (isFinite(n) && n > 0) {
      if (latest === null || n > latest) latest = n;
    }
  }
  return latest === null ? 1 : latest;
}

function getPublicInventory() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_INVENTORY);
    const ordSheet = ss.getSheetByName(SHEET_ORDERS);
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    const ordData = ordSheet ? ordSheet.getDataRange().getValues() : [[]];
    const shoes = [];
    const enquiries = {};

    // Count enquiries per shoe ID.
    for (let i = 1; i < ordData.length; i++) {
      const order = ordData[i];
      if (!order[0] || !order[1]) continue;
      const shoeId = String(order[1]);
      enquiries[shoeId] = (enquiries[shoeId] || 0) + 1;
    }

    // Include qualifying inventory from every batch, not just the latest batch.
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;

      const status = String(row[5] || '').trim();
      const normalizedStatus = status.toLowerCase();
      if (normalizedStatus !== 'available' &&
          normalizedStatus !== 'reserved' &&
          normalizedStatus !== 'sold') continue;

      const id = String(row[0]);
      const enquiryCount = enquiries[id] || 0;
      shoes.push({
        id: id,
        picture: row[1] || '',
        size: row[3],
        targetPrice: Number(row[4]) || 0,
        status: status,
        category: row[11] || 'General',
        stockType: Number(row[12]) || 1,
        enquiryCount: enquiryCount,
        isHot: enquiryCount >= 2
      });
    }
    return shoes;
  } catch (err) {
    Logger.log('getPublicInventory: ' + err);
    return [];
  }
}

function getFilterOptions() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_INVENTORY);
    if (!sheet) return { categories: [], sizes: [] };
    const data = sheet.getDataRange().getValues();
    const cats = new Set();
    const sizes = new Set();

    // Build filters across all stock batches so older inventory remains discoverable.
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      const status = String(row[5] || '').trim().toLowerCase();
      if (status !== 'available' && status !== 'reserved' && status !== 'sold') continue;
      if (row[11]) cats.add(row[11]);
      if (row[3] !== '' && row[3] !== null && row[3] !== undefined) sizes.add(row[3]);
    }
    return {
      categories: Array.from(cats).sort(),
      sizes: Array.from(sizes).sort(function(a, b) { return Number(a) - Number(b); })
    };
  } catch (err) {
    Logger.log('getFilterOptions: ' + err);
    return { categories: [], sizes: [] };
  }
}

// ============ CUSTOMER BOOKING ============
function submitBooking(formData) {
  try {
    ensureSheets();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ordSheet = ss.getSheetByName(SHEET_ORDERS);
    const invSheet = ss.getSheetByName(SHEET_INVENTORY);
    const orderId = 'ORD-' + new Date().getTime();
    ordSheet.appendRow([orderId, formData.shoeId, formData.name, formData.phone, formData.location, formData.comment || '', new Date(), 'New Enquiry']);
    const invData = invSheet.getDataRange().getValues();
    for (let i = 1; i < invData.length; i++) {
      if (String(invData[i][0]) === String(formData.shoeId)) {
        const prev = invData[i][9] || '';
        const note = '📞 ' + formData.name + ' (' + formData.phone + ') enquired';
        invSheet.getRange(i + 1, 10).setValue(prev ? prev + ' | ' + note : note);
        break;
      }
    }
    try {
      MailApp.sendEmail({
        to: ADMIN_EMAIL,
        subject: '🔔 New Booking: ' + formData.shoeId,
        htmlBody: '<p><b>Shoe:</b> ' + formData.shoeId + '</p><p><b>Name:</b> ' + formData.name + '</p><p><b>Phone:</b> ' + formData.phone + '</p>'
      });
    } catch (e) { Logger.log('Email: ' + e); }
    return { success: true, orderId: orderId };
  } catch (err) { return { success: false, message: 'Error: ' + err.toString() }; }
}

// ============ ADMIN AUTH ============
function adminLogin(email, password) {
  try {
    ensureSheets();
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ADMINS);
    if (!sheet) return { success: false, message: 'Admins sheet missing' };
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === String(email || '').trim().toLowerCase() && String(data[i][1]).trim() === String(password || '').trim()) {
        return { success: true, email: data[i][0] };
      }
    }
    return { success: false, message: 'Invalid credentials' };
  } catch (err) { return { success: false, message: 'Error: ' + err.toString() }; }
}

// ============ HISTORY LOG ============
function logHistory(shoeId, field, oldVal, newVal, changedBy, fullRow, action) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let h = ss.getSheetByName(SHEET_HISTORY);
    if (!h) {
      h = ss.insertSheet(SHEET_HISTORY);
      h.appendRow(['Timestamp','Shoe ID','Field Changed','Old Value','New Value','Changed By','Full Row Snapshot','Action']);
      styleHeader(h, 8);
    }
    h.appendRow([new Date(), shoeId, field, String(oldVal||''), String(newVal||''), changedBy, JSON.stringify(fullRow||{}), action]);
  } catch (err) { Logger.log('logHistory: ' + err); }
}

// ============ ADMIN INVENTORY ============
function getAdminInventory(email, password) {
  try {
    ensureSheets();
    const auth = adminLogin(email, password);
    if (!auth.success) return { success: false, message: 'Unauthorized', shoes: [], count: 0 };
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_INVENTORY);
    if (!sheet) return { success: false, message: 'Inventory sheet missing', shoes: [], count: 0 };
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return { success: true, shoes: [], count: 0 };
    const shoes = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      shoes.push({
        rowIndex: i + 1,
        id: String(row[0] || ''),
        picture: String(row[1] || ''),
        buyingPrice: row[2], size: row[3], targetPrice: row[4],
        status: String(row[5] || ''),
        payment: String(row[6] || ''),
        priceSold: row[7], profitMargin: row[8],
        comment: String(row[9] || ''),
        date: row[10],
        category: String(row[11] || ''),
        stockType: row[12] !== undefined && row[12] !== null ? row[12] : ''
      });
    }
    return toClientSafeValue({ success: true, shoes: shoes, count: shoes.length });
  } catch (err) {
    Logger.log('getAdminInventory EXCEPTION: ' + err);
    return { success: false, message: 'Error: ' + err.toString(), shoes: [], count: 0 };
  }
}

// ============ UPDATE SHOE ============
function updateShoe(email, password, shoeId, updates) {
  try {
    const auth = adminLogin(email, password);
    if (!auth.success) return { success: false, message: 'Unauthorized' };
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_INVENTORY);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(shoeId)) {
        const colMap = { picture: 2, buyingPrice: 3, size: 4, targetPrice: 5, status: 6, payment: 7, priceSold: 8, comment: 10, category: 12, stockType: 13 };
        const before = { id: data[i][0], status: data[i][5] };
        Object.keys(updates).forEach(function(f){
          if (colMap[f]) {
            const oldV = data[i][colMap[f] - 1];
            const newV = updates[f];
            if (String(oldV) !== String(newV)) {
              sheet.getRange(i + 1, colMap[f]).setValue(newV);
              logHistory(shoeId, f, oldV, newV, email, before, 'Update Shoe');
            }
          }
        });
        if (updates.buyingPrice !== undefined || updates.priceSold !== undefined) {
          const nb = Number(updates.buyingPrice !== undefined ? updates.buyingPrice : data[i][2]);
          const ns = Number(updates.priceSold !== undefined ? updates.priceSold : data[i][7]);
          if (nb && ns) sheet.getRange(i + 1, 9).setValue((ns - nb) / ns);
        }
        return { success: true, message: 'Updated' };
      }
    }
    return { success: false, message: 'Not found' };
  } catch (err) { return { success: false, message: 'Error: ' + err.toString() }; }
}

// ============ IMAGE UPLOAD ============
function getOrCreateFolder() {
  const f = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  if (f.hasNext()) return f.next();
  return DriveApp.createFolder(DRIVE_FOLDER_NAME);
}
function uploadImage(base64Data, fileName, mimeType) {
  try {
    const folder = getOrCreateFolder();
    const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, fileName);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { success: true, url: 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1000', fileId: file.getId() };
  } catch (err) { return { success: false, message: err.toString() }; }
}

// ============ ADD SHOE ============
function addShoe(email, password, shoe) {
  const lock = LockService.getScriptLock();
  let lockAcquired = false;

  try {
    ensureSheets();
    const auth = adminLogin(email, password);
    if (!auth || !auth.success) return { success: false, message: 'Unauthorized' };
    if (!shoe || typeof shoe !== 'object') {
      return { success: false, message: 'Invalid shoe details.' };
    }

    lock.waitLock(10000);
    lockAcquired = true;

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_INVENTORY);
    if (!sheet) return { success: false, message: 'Inventory sheet missing.' };

    const data = sheet.getDataRange().getValues();
    let maxBatch = 0;
    for (let i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      const batch = Number(data[i][12]);
      if (Number.isFinite(batch) && batch > maxBatch) maxBatch = batch;
    }

    const enteredBatch = String(
      shoe.stockType === null || shoe.stockType === undefined ? '' : shoe.stockType
    ).trim();
    const stockType = enteredBatch === '' ? maxBatch + 1 : Number(enteredBatch);
    if (!Number.isInteger(stockType) || stockType < 1) {
      return { success: false, message: 'Enter a valid stock number or leave it blank for a new batch.' };
    }

    const buyingPrice = Number(shoe.buyingPrice);
    const targetPrice = Number(shoe.targetPrice);
    if (!Number.isFinite(buyingPrice) || buyingPrice < 0) {
      return { success: false, message: 'Enter a valid buying price.' };
    }
    if (!Number.isFinite(targetPrice) || targetPrice < 0) {
      return { success: false, message: 'Enter a valid target price.' };
    }

    const id = 'SHOE-' + Utilities.getUuid();
    // Append a new row only; never clear or overwrite older stock records.
    sheet.appendRow([
      id, shoe.picture || '', buyingPrice, shoe.size, targetPrice,
      shoe.status || 'Available', '', '', '', shoe.comment || '', '',
      shoe.category || 'General', stockType
    ]);
    SpreadsheetApp.flush();

    try {
      logHistory(id, 'all', '', '', email,
        { id: id, stockType: stockType }, 'Add Shoe');
    } catch (historyError) {
      Logger.log('Stock added, but history logging failed: ' + historyError);
    }

    return { success: true, id: id, stockType: stockType };
  } catch (err) {
    Logger.log('addShoe error: ' + err);
    return { success: false, message: 'Error: ' + err.toString() };
  } finally {
    if (lockAcquired) lock.releaseLock();
  }
}

// ============ UPDATE STATUS ============
function updateShoeStatus(email, password, shoeId, newStatus, priceSold, payment) {
  try {
    const auth = adminLogin(email, password);
    if (!auth.success) return { success: false, message: 'Unauthorized' };
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_INVENTORY);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(shoeId)) {
        const oldS = data[i][5];
        sheet.getRange(i + 1, 6).setValue(newStatus);
        if (priceSold) sheet.getRange(i + 1, 8).setValue(Number(priceSold));
        if (payment) sheet.getRange(i + 1, 7).setValue(payment);
        if (newStatus === 'Sold') sheet.getRange(i + 1, 11).setValue(new Date());
        const b = Number(data[i][2]), s = Number(priceSold);
        if (priceSold && b) sheet.getRange(i + 1, 9).setValue((s - b) / s);
        logHistory(shoeId, 'status', oldS, newStatus, email, { id: data[i][0] }, 'Status Change');
        return { success: true };
      }
    }
    return { success: false, message: 'Not found' };
  } catch (err) { return { success: false, message: 'Error: ' + err.toString() }; }
}

function updateShoeComment(email, password, shoeId, comment) {
  try {
    const auth = adminLogin(email, password);
    if (!auth.success) return { success: false, message: 'Unauthorized' };
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_INVENTORY);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(shoeId)) {
        sheet.getRange(i + 1, 10).setValue(comment);
        return { success: true };
      }
    }
    return { success: false };
  } catch (err) { return { success: false, message: 'Error: ' + err.toString() }; }
}

// ============ HISTORY LIST ============
function getHistory(email, password) {
  try {
    const auth = adminLogin(email, password);
    if (!auth.success) return { success: false, message: 'Unauthorized', history: [] };
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_HISTORY);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_HISTORY);
      sheet.appendRow(['Timestamp','Shoe ID','Field Changed','Old Value','New Value','Changed By','Full Row Snapshot','Action']);
      styleHeader(sheet, 8);
      return { success: true, history: [] };
    }
    const data = sheet.getDataRange().getValues();
    const history = [];
    for (let i = data.length - 1; i >= 1; i--) {
      if (!data[i][0]) continue;
      history.push({ timestamp: data[i][0], shoeId: data[i][1], field: data[i][2], oldValue: data[i][3], newValue: data[i][4], changedBy: data[i][5], snapshot: data[i][6], action: data[i][7] });
      if (history.length >= 200) break;
    }
    return toClientSafeValue({ success: true, history: history, count: history.length });
  } catch (err) { return { success: false, message: 'Error: ' + err.toString(), history: [] }; }
}

// ============ UPDATE ORDER ============
function updateOrderStatus(email, password, orderId, newStatus) {
  try {
    const auth = adminLogin(email, password);
    if (!auth.success) return { success: false, message: 'Unauthorized' };
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ORDERS);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(orderId)) {
        sheet.getRange(i + 1, 8).setValue(newStatus);
        return { success: true };
      }
    }
    return { success: false, message: 'Not found' };
  } catch (err) { return { success: false, message: 'Error: ' + err.toString() }; }
}

// ============ STATS ============
function getAdminStats(email, password) {
  const empty = { success: false, message: 'Unauthorized', total: 0, sold: 0, available: 0, reserved: 0, revenue: 0, cost: 0, profit: 0, categories: [], trendLabels: [], trendData: [] };
  try {
    const auth = adminLogin(email, password);
    if (!auth.success) return empty;
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_INVENTORY);
    if (!sheet) return empty;
    const data = sheet.getDataRange().getValues();
    let total = 0, sold = 0, available = 0, reserved = 0, revenue = 0, cost = 0;
    const catMap = {}, salesByDay = {};
    for (let i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      total++;
      const st = String(data[i][5] || '').toLowerCase();
      const buy = Number(data[i][2]) || 0;
      const soldFor = Number(data[i][7]) || 0;
      const cat = data[i][11] || 'General';
      const dateSold = data[i][10] ? new Date(data[i][10]) : null;
      if (!catMap[cat]) catMap[cat] = { total: 0, sold: 0 };
      catMap[cat].total++;
      if (st === 'sold') {
        sold++; revenue += soldFor; cost += buy; catMap[cat].sold++;
        if (dateSold) {
          const key = Utilities.formatDate(dateSold, Session.getScriptTimeZone(), 'yyyy-MM-dd');
          salesByDay[key] = (salesByDay[key] || 0) + soldFor;
        }
      } else if (st === 'available') available++;
      else if (st === 'reserved') reserved++;
    }
    const trendLabels = [], trendData = [];
    for (let d = 6; d >= 0; d--) {
      const dt = new Date(); dt.setDate(dt.getDate() - d);
      const key = Utilities.formatDate(dt, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      trendLabels.push(Utilities.formatDate(dt, Session.getScriptTimeZone(), 'MMM d'));
      trendData.push(salesByDay[key] || 0);
    }
    return {
      success: true, total: total, sold: sold, available: available, reserved: reserved,
      revenue: revenue, cost: cost, profit: revenue - cost,
      categories: Object.keys(catMap).map(function(k){ return { name: k, total: catMap[k].total, sold: catMap[k].sold }; }),
      trendLabels: trendLabels, trendData: trendData
    };
  } catch (err) { Logger.log('getAdminStats: ' + err); return empty; }
}

// ============ ORDERS ============
function getOrders(email, password) {
  try {
    ensureSheets();
    const auth = adminLogin(email, password);
    if (!auth.success) return { success: false, message: 'Unauthorized', orders: [], count: 0 };
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ORDERS);
    if (!sheet) return { success: false, message: 'Orders sheet missing', orders: [], count: 0 };
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return { success: true, orders: [], count: 0 };
    const orders = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      orders.push({
        orderId: String(row[0] || ''), shoeId: String(row[1] || ''),
        name: String(row[2] || ''), phone: String(row[3] || ''),
        location: String(row[4] || ''), comment: String(row[5] || ''),
        date: row[6], status: String(row[7] || '')
      });
    }
    orders.reverse();
    return toClientSafeValue({ success: true, orders: orders, count: orders.length });
  } catch (err) {
    Logger.log('getOrders EXCEPTION: ' + err);
    return { success: false, message: 'Error: ' + err.toString(), orders: [], count: 0 };
  }
}