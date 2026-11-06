function sendDailyReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const invSheet = ss.getSheetByName('Inventory');
  const ordersSheet = ss.getSheetByName('Orders');
  const invData = invSheet.getDataRange().getValues();
  const orderData = ordersSheet.getDataRange().getValues();

  let soldToday = [], available = [], reserved = [];
  let totalRevenue = 0, totalCost = 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);

  for (let i = 1; i < invData.length; i++) {
    const row = invData[i];
    if (!row[0]) continue;
    const status = String(row[5] || '').toLowerCase();
    const buy = Number(row[2]) || 0;
    const soldFor = Number(row[7]) || 0;
    const soldDate = row[10] ? new Date(row[10]) : null;

    if (status === 'sold') {
      totalRevenue += soldFor; totalCost += buy;
      if (soldDate && soldDate >= today)
        soldToday.push({ id: row[0], size: row[3], target: row[4], soldFor: soldFor, profit: soldFor - buy });
    } else if (status === 'available') available.push({ id: row[0], size: row[3], target: row[4] });
    else if (status === 'reserved') reserved.push({ id: row[0], size: row[3], target: row[4] });
  }

  let newBookings = [];
  for (let i = 1; i < orderData.length; i++) {
    const row = orderData[i];
    if (!row[0]) continue;
    const orderDate = row[6] ? new Date(row[6]) : null;
    if (orderDate && orderDate >= today)
      newBookings.push({ orderId: row[0], shoeId: row[1], name: row[2], phone: row[3], location: row[4], status: row[7] });
  }

  let html = `
    <h2>📊 Daily Shoe Report</h2>
    <p><b>Date:</b> ${new Date().toLocaleDateString()}</p>
    <h3>💰 Financial</h3>
    <table border="1" cellpadding="6" style="border-collapse:collapse">
      <tr><td><b>Revenue</b></td><td>${CURRENCY} ${totalRevenue.toLocaleString()}</td></tr>
      <tr><td><b>Cost</b></td><td>${CURRENCY} ${totalCost.toLocaleString()}</td></tr>
      <tr><td><b>Profit</b></td><td>${CURRENCY} ${(totalRevenue - totalCost).toLocaleString()}</td></tr>
    </table>
    <h3>✅ Sold Today (${soldToday.length})</h3>
    ${soldToday.length === 0 ? '<p>No sales today.</p>' :
      `<table border="1" cellpadding="6" style="border-collapse:collapse">
        <tr><th>ID</th><th>Size</th><th>Target</th><th>Sold For</th><th>Profit</th></tr>
        ${soldToday.map(s => `<tr><td>${s.id}</td><td>${s.size}</td><td>${s.target}</td><td>${s.soldFor}</td><td>${s.profit}</td></tr>`).join('')}
      </table>`}
    <h3>📅 New Enquiries Today (${newBookings.length})</h3>
    ${newBookings.length === 0 ? '<p>None.</p>' :
      `<table border="1" cellpadding="6" style="border-collapse:collapse">
        <tr><th>Order</th><th>Shoe</th><th>Name</th><th>Phone</th><th>Location</th><th>Status</th></tr>
        ${newBookings.map(b => `<tr><td>${b.orderId}</td><td>${b.shoeId}</td><td>${b.name}</td><td>${b.phone}</td><td>${b.location}</td><td>${b.status}</td></tr>`).join('')}
      </table>`}
    <h3>📦 Inventory</h3>
    <p><b>Available:</b> ${available.length} | <b>Reserved:</b> ${reserved.length}</p>
    <h3>🟢 Available</h3>
    <table border="1" cellpadding="6" style="border-collapse:collapse">
      <tr><th>ID</th><th>Size</th><th>Target</th></tr>
      ${available.map(s => `<tr><td>${s.id}</td><td>${s.size}</td><td>${s.target}</td></tr>`).join('')}
    </table>
    <hr><p style="color:#888;font-size:12px">Auto-report from Shoe Business System</p>
  `;

  MailApp.sendEmail({
    to: ADMIN_EMAIL,
    subject: '📊 Daily Shoe Report - ' + new Date().toLocaleDateString(),
    htmlBody: html
  });
}

function setupDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'sendDailyReport') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendDailyReport')
    .timeBased().atHour(20).everyDays(1)
    .inTimezone(Session.getScriptTimeZone()).create();
  Logger.log('Daily 8PM trigger set up.');
}