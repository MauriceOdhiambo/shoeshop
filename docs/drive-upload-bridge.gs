/**
 * Shoe Studio Google Drive upload bridge.
 * Deploy this Apps Script as a Web App that executes as your Google account.
 * Set Script Properties named DRIVE_FOLDER_ID and UPLOAD_TOKEN before deployment.
 */
function doPost(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    const expectedToken = props.getProperty('UPLOAD_TOKEN');
    const folderId = props.getProperty('DRIVE_FOLDER_ID');
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    if (!expectedToken || !folderId) {
      return json_({ success: false, message: 'Drive upload bridge is missing DRIVE_FOLDER_ID or UPLOAD_TOKEN script properties.' });
    }
    if (!body.token || body.token !== expectedToken) {
      return json_({ success: false, message: 'Unauthorized upload request.' });
    }
    if (!body.base64 || !body.mimeType || !String(body.mimeType).startsWith('image/')) {
      return json_({ success: false, message: 'A valid image file is required.' });
    }

    const bytes = Utilities.base64Decode(body.base64);
    if (bytes.length > 4 * 1024 * 1024) {
      return json_({ success: false, message: 'Photo must be 4 MB or smaller.' });
    }
    const originalName = String(body.fileName || 'shoe-photo').replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100);
    const blob = Utilities.newBlob(bytes, body.mimeType, Date.now() + '-' + originalName);
    const file = DriveApp.getFolderById(folderId).createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return json_({
      success: true,
      fileId: file.getId(),
      name: file.getName(),
      picture: 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(file.getId()) + '&sz=w1000'
    });
  } catch (error) {
    return json_({ success: false, message: error && error.message ? error.message : 'Drive upload failed.' });
  }
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
