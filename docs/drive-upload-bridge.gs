/** Shoe Studio Drive upload and order email bridge. Set DRIVE_FOLDER_ID and UPLOAD_TOKEN in Script Properties. */
function doGet() {
  return ContentService.createTextOutput('Shoe Studio Drive Upload is running.').setMimeType(ContentService.MimeType.TEXT);
}

// Run this once from the Apps Script editor to grant the MailApp permission.
function authorizeShoeStudioMail() {
  return MailApp.getRemainingDailyQuota();
}

function doPost(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    const expectedToken = props.getProperty('UPLOAD_TOKEN');
    const folderId = props.getProperty('DRIVE_FOLDER_ID');
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!expectedToken || !folderId) return json_({ success:false, message:'Drive upload bridge is missing DRIVE_FOLDER_ID or UPLOAD_TOKEN script properties.' });
    if (!body.token || body.token !== expectedToken) return json_({ success:false, message:'Unauthorized request.' });

    if (body.action === 'notifyOrder') {
      const recipients = Array.isArray(body.recipients) ? [...new Set(body.recipients.map(String).filter(isEmail_))] : [];
      if (!recipients.length) return json_({ success:false, message:'No valid administrator email recipients were supplied.' });
      const order = body.order || {};
      const subject = 'New Shoe Studio enquiry · ' + safe_(order.orderId || 'New order');
      const photo = String(order.shoePicture || '');
      const html = '<div style="font-family:Arial,sans-serif;color:#17232b;max-width:640px;margin:auto">' +
        '<div style="background:#142128;color:#fff;padding:22px 26px"><div style="font-size:12px;letter-spacing:2px;color:#d18a4e">SHOE STUDIO</div><h2 style="margin:8px 0 0">New customer enquiry</h2></div>' +
        '<div style="padding:24px;border:1px solid #e4e8eb"><p>A customer has submitted a booking request.</p>' +
        (photo ? '<p><img src="' + escapeHtml_(photo) + '" alt="Shoe photo" style="width:220px;max-width:100%;height:auto;border-radius:10px"></p>' : '') +
        '<h3>Product details</h3><p><b>Item:</b> ' + escapeHtml_(order.shoeId) + '<br><b>Category:</b> ' + escapeHtml_(order.shoeCategory) + '<br><b>Size:</b> ' + escapeHtml_(order.shoeSize) + '<br><b>Price:</b> KSh ' + escapeHtml_(order.shoePrice) + '</p>' +
        '<h3>Customer details</h3><p><b>Name:</b> ' + escapeHtml_(order.customerName) + '<br><b>Phone:</b> ' + escapeHtml_(order.customerPhone) + '<br><b>Email:</b> ' + escapeHtml_(order.customerEmail) + '<br><b>Location:</b> ' + escapeHtml_(order.customerLocation) + '<br><b>Message:</b> ' + escapeHtml_(order.customerComment) + '</p>' +
        '<p><b>Order reference:</b> ' + escapeHtml_(order.orderId) + '<br><b>Submitted:</b> ' + escapeHtml_(order.orderDate) + '</p>' +
        '<p style="color:#65727a;font-size:12px">Please sign in to the Shoe Studio admin workspace to follow up.</p></div></div>';
      const plain = 'New Shoe Studio enquiry ' + safe_(order.orderId) + '\nCustomer: ' + safe_(order.customerName) + '\nPhone: ' + safe_(order.customerPhone) + '\nEmail: ' + safe_(order.customerEmail) + '\nLocation: ' + safe_(order.customerLocation) + '\nShoe: ' + safe_(order.shoeId) + ' / ' + safe_(order.shoeCategory) + ' / Size ' + safe_(order.shoeSize) + '\nPrice: KSh ' + safe_(order.shoePrice) + '\nMessage: ' + safe_(order.customerComment) + '\nPhoto: ' + photo;
      const quota = MailApp.getRemainingDailyQuota();
      if (quota < 1) return json_({success:false,message:'Google Apps Script has no remaining daily email quota.'});
      let sentTo = 0; const deliveryErrors = [];
      recipients.forEach(function(recipient){ try { MailApp.sendEmail({ to:recipient, subject:subject, body:plain, htmlBody:html, name:'Shoe Studio' }); sentTo++; } catch (mailError) { deliveryErrors.push(recipient + ': ' + (mailError && mailError.message ? mailError.message : 'send failed')); } });
      if (sentTo < 1) return json_({success:false,message:'No administrator email could be delivered. ' + deliveryErrors.join('; ')});
      return json_({ success:true, sentTo:sentTo, failed:deliveryErrors });
    }

    if (body.action === 'notifyNewStock') {
      const rawSubscribers = Array.isArray(body.subscribers) ? body.subscribers.filter(function(s){ return s && isEmail_(s.email) && String(s.unsubscribeToken || '').length >= 24; }) : [];
      const unique = {};
      rawSubscribers.forEach(function(s){ const key = String(s.email).trim().toLowerCase(); if (!unique[key]) unique[key] = { email:key, unsubscribeToken:String(s.unsubscribeToken) }; });
      const subscribers = Object.keys(unique).map(function(key){ return unique[key]; });
      if (!subscribers.length) return json_({ success:true, sentTo:0, message:'No active subscribers.' });
      const shoe = body.shoe || {};
      const siteUrl = String(body.siteUrl || '').replace(/\/$/, '');
      if (!/^https:\/\//i.test(siteUrl)) return json_({success:false,message:'The website URL is missing or invalid. Set NEXT_PUBLIC_SITE_URL to the live Shoe Studio URL and redeploy.'});
      // Send one new-stock announcement per calendar day, even when several shoes are uploaded.
      // This prevents a burst of separate messages while still linking customers to the full live collection.
      const dayKey = 'SHOE_STUDIO_STOCK_ALERT_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
      const scriptProps = PropertiesService.getScriptProperties();
      if (scriptProps.getProperty(dayKey) === 'SENT') return json_({success:true,sentTo:0,alreadySent:true,message:'Today’s new-stock announcement has already been sent.'});
      const subject = 'New stock is available at Shoe Studio';
      const image = String(shoe.picture || '');
      const baseHtml = '<div style="font-family:Arial,sans-serif;color:#17232b;max-width:620px;margin:auto"><div style="background:#142128;color:#fff;padding:22px"><b style="color:#d18a4e;letter-spacing:2px">SHOE STUDIO</b><h2>New stock has arrived</h2></div><div style="padding:24px;border:1px solid #e5e9ec">' + (image ? '<p><img src="'+escapeHtml_(image)+'" alt="New shoe" style="width:260px;max-width:100%;border-radius:12px"></p>' : '') + '<h2>'+escapeHtml_(shoe.category || 'New arrival')+'</h2><p>Size: '+escapeHtml_(shoe.size || 'See website')+'<br>Price: KSh '+escapeHtml_(shoe.price || '')+'<br>Reference: '+escapeHtml_(shoe.id || '')+'</p><p>Explore the full collection to see all current arrivals.</p><p><a href="'+escapeHtml_(siteUrl)+'" style="display:inline-block;background:#b97943;color:white;padding:13px 20px;border-radius:8px;text-decoration:none">View the collection</a></p><p style="font-size:12px;color:#667">You received this because you subscribed to Shoe Studio new-stock alerts.</p>';
      const plain = 'New stock has arrived at Shoe Studio. Explore the full collection: '+siteUrl;
      let sent = 0; const failed = [];
      subscribers.forEach(function(subscriber){
        const recipientKey = dayKey + '_' + Utilities.base64EncodeWebSafe(subscriber.email).replace(/=+$/g, '');
        if (scriptProps.getProperty(recipientKey) === 'SENT') return;
        const unsubscribeUrl = siteUrl+'/api/unsubscribe?token='+encodeURIComponent(subscriber.unsubscribeToken);
        const html = baseHtml + '<p><a href="'+escapeHtml_(unsubscribeUrl)+'">Unsubscribe</a></p></div></div>';
        try { MailApp.sendEmail({to:subscriber.email,subject:subject,body:plain+'\nUnsubscribe: '+unsubscribeUrl,htmlBody:html,name:'Shoe Studio'}); scriptProps.setProperty(recipientKey, 'SENT'); sent++; }
        catch (mailError) { failed.push(subscriber.email + ': ' + (mailError && mailError.message ? mailError.message : 'send failed')); }
      });
      if (failed.length === 0) scriptProps.setProperty(dayKey, 'SENT');
      return json_({success:failed.length === 0,sentTo:sent,failed:failed,alreadySent:false,message:failed.length ? 'Some subscriber emails failed. Retry the stock notification to send only to those addresses.' : 'Daily new-stock alert completed.'});
    }

    if (!body.base64 || !body.mimeType || !String(body.mimeType).startsWith('image/')) return json_({ success:false, message:'A valid image file is required.' });
    const bytes = Utilities.base64Decode(body.base64);
    if (bytes.length > 4 * 1024 * 1024) return json_({ success:false, message:'Photo must be 4 MB or smaller.' });
    const originalName = String(body.fileName || 'shoe-photo').replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100);
    const blob = Utilities.newBlob(bytes, body.mimeType, Date.now() + '-' + originalName);
    const file = DriveApp.getFolderById(folderId).createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return json_({ success:true, fileId:file.getId(), name:file.getName(), picture:'https://drive.google.com/thumbnail?id=' + encodeURIComponent(file.getId()) + '&sz=w1000' });
  } catch (error) { return json_({ success:false, message:error && error.message ? error.message : 'Drive upload or email notification failed.' }); }
}
function isEmail_(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '')); }
function safe_(value) { return String(value == null ? '' : value).replace(/[\r\n]/g, ' ').slice(0, 500); }
function escapeHtml_(value) { return safe_(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
