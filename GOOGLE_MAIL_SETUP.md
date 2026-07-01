// Clé secrète de sécurité pour empêcher que quelqu'un d'autre n'utilise votre script
var SECRET_TOKEN = "DDB_SECRET_TOKEN_2026"; 

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    // Vérification de sécurité
    if (!data.token || data.token !== SECRET_TOKEN) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Non autorisé" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Décodage et création de la pièce jointe (Billet PDF)
    var attachmentsList = [];
    if (data.pdfBase64 && data.pdfName) {
      var pdfBlob = Utilities.newBlob(
        Utilities.base64Decode(data.pdfBase64), 
        "application/pdf", 
        data.pdfName
      );
      attachmentsList.push(pdfBlob);
    }
    
    // Envoi de l'e-mail via votre compte Gmail
    GmailApp.sendEmail(data.email, data.subject, "", {
      htmlBody: data.htmlContent,
      attachments: attachmentsList
    });
    
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
