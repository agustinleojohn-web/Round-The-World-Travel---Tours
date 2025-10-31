// ========== CONFIGURATION ==========
// IMPORTANT: Replace this with your actual Google Sheet ID
const SHEET_ID = '1M8LG_5F7Su1hVP2kRh7X9sDDAO3gzsNPjmy7O3PUnhs';

// Example: const SHEET_ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890';

// Sheet names
const PACKAGES_SHEET_NAME = 'Packages';
const CONTACTS_SHEET_NAME = 'Contacts';
const BOOKINGS_SHEET_NAME = 'Bookings';
const GALLERY_SHEET_NAME = 'Gallery';
const TESTIMONIALS_SHEET_NAME = 'Testimonials';

// ========== MAIN FUNCTIONS ==========

/**
 * Handle GET requests - Used to fetch packages
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    
    if (action === 'getPackages') {
      return getPackages();
    } else if (action === 'getGallery') {
      return getGallery();
    } else if (action === 'getTestimonials') {
      return getTestimonials();
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Invalid action'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle POST requests - Used to submit forms
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    if (action === 'submitContact') {
      return submitContact(data.data);
    } else if (action === 'submitBooking') {
      return submitBooking(data.data, data.packages);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Invalid action'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ========== GET PACKAGES ==========

/**
 * Fetch all packages from Google Sheets
 */
function getPackages() {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(PACKAGES_SHEET_NAME);
    
    if (!sheet) {
      throw new Error('Packages sheet not found. Please create a sheet named "' + PACKAGES_SHEET_NAME + '"');
    }
    
    const data = sheet.getDataRange().getValues();
    
    // Remove header row
    const headers = data[0];
    const rows = data.slice(1);
    
    // Convert rows to objects
    const packages = rows.map(row => {
      const pkg = {};
      headers.forEach((header, index) => {
        pkg[header.toLowerCase()] = row[index];
      });
      
      // Ensure proper data types and include ALL fields
      return {
        id: String(pkg.id || ''),
        name: String(pkg.name || ''),
        destination: String(pkg.destination || ''),
        duration: String(pkg.duration || ''),
        price: Number(pkg.price) || 0,
        image: String(pkg.image || ''),
        tourType: String(pkg.tourtype || ''),
        rating: Number(pkg.rating) || 0,
        availability: String(pkg.availability || 'Available'),
        featured: Boolean(pkg.featured),
        // NEW FIELDS - All optional
        inclusions: String(pkg.inclusions || ''),
        exclusions: String(pkg.exclusions || ''),
        highlights: String(pkg.highlights || ''),
        travelDates: String(pkg.traveldates || ''),
        hotelDetails: String(pkg.hoteldetails || ''),
        flightDetails: String(pkg.flightdetails || ''),
        visaRequirements: String(pkg.visarequirements || ''),
        itinerary: String(pkg.itinerary || '')
      };
    }).filter(pkg => pkg.id && pkg.name); // Filter out empty rows
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      packages: packages,
      count: packages.length
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ========== SUBMIT CONTACT FORM ==========

/**
 * Save contact form submission to Google Sheets
 */
function submitContact(formData) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(CONTACTS_SHEET_NAME);
    
    if (!sheet) {
      throw new Error('Contacts sheet not found. Please create a sheet named "' + CONTACTS_SHEET_NAME + '"');
    }
    
    const timestamp = new Date();
    
    // Append new row
    sheet.appendRow([
      timestamp,
      formData.name || '',
      formData.email || '',
      formData.phone || '',
      formData.subject || '',
      formData.message || ''
    ]);
    
    // Send email notification (optional)
    sendContactEmailNotification(formData);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Contact form submitted successfully'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ========== SUBMIT BOOKING FORM ==========

/**
 * Save booking form submission to Google Sheets
 */
function submitBooking(formData, packages) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(BOOKINGS_SHEET_NAME);
    
    if (!sheet) {
      throw new Error('Bookings sheet not found. Please create a sheet named "' + BOOKINGS_SHEET_NAME + '"');
    }
    
    const timestamp = new Date();
    
    // Calculate total amount
    let totalAmount = 0;
    let packagesList = [];
    
    if (packages && packages.length > 0) {
      packages.forEach(item => {
        const subtotal = item.package.price * item.quantity;
        totalAmount += subtotal;
        packagesList.push(`${item.package.name} (x${item.quantity}) - ₱${subtotal.toLocaleString()}`);
      });
    }
    
    // Append new row
    sheet.appendRow([
      timestamp,
      formData.fullName || '',
      formData.email || '',
      formData.phone || '',
      formData.travelDate || '',
      formData.adults || '',
      formData.children || '0',
      formData.budgetRange || '',
      formData.accommodationType || '',
      formData.specialRequests || '',
      formData.contactMethod || 'email',
      packagesList.join('; '),
      totalAmount
    ]);
    
    // Send email notification (optional)
    sendBookingEmailNotification(formData, packages, totalAmount);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Booking submitted successfully'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ========== EMAIL NOTIFICATIONS ==========

/**
 * Send email notification for contact form submission
 */
function sendContactEmailNotification(formData) {
  try {
    const recipient = 'rtwtravelandtours2025@gmail.com'; // Change to your email
    const subject = `New Contact Form: ${formData.subject}`;
    
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .info-row { margin-bottom: 15px; padding: 12px; background: white; border-left: 4px solid #2563eb; border-radius: 4px; }
    .label { font-weight: bold; color: #1f2937; margin-bottom: 5px; }
    .value { color: #4b5563; }
    .message-box { background: white; padding: 20px; border-radius: 8px; margin-top: 20px; border: 1px solid #e5e7eb; }
    .footer { background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📧 New Contact Form Submission</h1>
    </div>
    <div class="content">
      <div class="info-row">
        <div class="label">Name:</div>
        <div class="value">${formData.name}</div>
      </div>
      <div class="info-row">
        <div class="label">Email:</div>
        <div class="value"><a href="mailto:${formData.email}">${formData.email}</a></div>
      </div>
      <div class="info-row">
        <div class="label">Phone:</div>
        <div class="value"><a href="tel:${formData.phone}">${formData.phone}</a></div>
      </div>
      <div class="info-row">
        <div class="label">Subject:</div>
        <div class="value">${formData.subject}</div>
      </div>
      <div class="message-box">
        <div class="label">Message:</div>
        <div class="value">${formData.message}</div>
      </div>
    </div>
    <div class="footer">
      This is an automated message from RTW Travel & Tours website.<br>
      Please respond to the customer within 24 hours.
    </div>
  </div>
</body>
</html>
    `;
    
    MailApp.sendEmail({
      to: recipient,
      subject: subject,
      htmlBody: htmlBody
    });
    
    // Send auto-reply to customer
    sendContactAutoReply(formData);
    
  } catch (error) {
    console.error('Error sending contact email:', error);
  }
}

/**
 * Send auto-reply to customer for contact form
 */
function sendContactAutoReply(formData) {
  try {
    const subject = 'We Received Your Message - Round-The-World Travel & Tours';
    
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 0; }
    .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 10px 0 0 0; font-size: 14px; opacity: 0.9; }
    .logo img { max-width: 120px !important; height: auto !important; width: 100% !important; }
    .content { background: white; padding: 20px; }
    .greeting { font-size: 18px; color: #1f2937; margin-bottom: 20px; }
    .message { color: #4b5563; margin-bottom: 20px; }
    .highlight-box { background: #eff6ff; border-left: 4px solid #2563eb; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .contact-info { background: #f9fafb; padding: 20px; border-radius: 8px; margin-top: 20px; }
    .contact-item { margin-bottom: 10px; }
    .icon { color: #2563eb; margin-right: 8px; }
    .footer { background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
    .footer a { color: #60a5fa; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">
        <img src="https://scontent.fmnl13-3.fna.fbcdn.net/v/t39.30808-6/472300464_122200841444213657_1942670998381380726_n.jpg?_nc_cat=101&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=tPf4P4zhHVAQ7kNvwG4WBaZ&_nc_oc=AdkuLAhVMrvWhdeXtcfzb5vPc0PO98q977yQ10XI4eklYjztBKcm0BUZGhsc8vzYsI5HGEJRSvn1_CBSVPk208us&_nc_zt=23&_nc_ht=scontent.fmnl13-3.fna&_nc_gid=5KoVqgBsD6nV6rEBWNZq8Q&oh=00_AfdMQVtLx74hHJPNrH9oUmyQxEmdbGpiTKixOEJmuPCRtg&oe=68EEBC49" alt="RTW Travel & Tours" style="background: white; padding: 10px; border-radius: 8px;">
      </div>
      <h1>Round-The-World Travel & Tours</h1>
      <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">Your One-Stop Travel Solutions Provider!</p>
    </div>
    <div class="content">
      <div class="greeting">Dear ${formData.name},</div>
      
      <div class="message">
        Thank you for reaching out to Round-The-World Travel & Tours!
      </div>
      
      <div class="highlight-box">
        <strong>✓ Your message has been received!</strong><br>
        We will review your inquiry and respond within <strong>24 hours</strong>.
      </div>
      
      <div class="message">
        <strong>Your Message:</strong><br>
        Subject: ${formData.subject}<br>
        ${formData.message}
      </div>
      
      <div class="contact-info">
        <div style="font-weight: bold; margin-bottom: 15px; color: #1f2937;">Need immediate assistance?</div>
        <div class="contact-item">
          <span class="icon">📞</span> <strong>Phone:</strong> <a href="tel:09668212256">0966 821 2256</a>
        </div>
        <div class="contact-item">
          <span class="icon">📧</span> <strong>Email:</strong> <a href="mailto:roundtheworldtraveltours@gmail.com">roundtheworldtraveltours@gmail.com</a>
        </div>
        <div class="contact-item">
          <span class="icon">📍</span> <strong>Location:</strong> Santa Rosa, Laguna, Philippines
        </div>
        <div class="contact-item">
          <span class="icon">🕐</span> <strong>Hours:</strong> Monday - Saturday: 9:00 AM - 6:00 PM
        </div>
      </div>
      
      <div class="message" style="margin-top: 20px;">
        Best regards,<br>
        <strong>Round-The-World Travel & Tours Team</strong>
      </div>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} Round-The-World Travel & Tours. All rights reserved.<br>
      Santa Rosa, Laguna, Philippines<br>
      <a href="https://www.facebook.com/roundtheworldtraveltours">Visit us on Facebook</a>
    </div>
  </div>
</body>
</html>
    `;
    
    MailApp.sendEmail({
      to: formData.email,
      subject: subject,
      htmlBody: htmlBody
    });
    
  } catch (error) {
    console.error('Error sending contact auto-reply:', error);
  }
}

/**
 * Send email notification for booking submission
 */
function sendBookingEmailNotification(formData, packages, totalAmount) {
  try {
    const recipient = 'rtwtravelandtours2025@gmail.com'; // Change to your email
    const subject = `🎉 New Booking Request from ${formData.fullName}`;
    
    let packagesTableRows = '';
    if (packages && packages.length > 0) {
      packages.forEach(item => {
        const subtotal = item.package.price * item.quantity;
        packagesTableRows += `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.package.name}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.package.destination}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.package.duration}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">₱${item.package.price.toLocaleString()}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">₱${subtotal.toLocaleString()}</td>
          </tr>
        `;
      });
    }
    
    const contactMethodText = formData.contactMethod || 'email';
    const contactValue = contactMethodText === 'email' ? formData.email : formData.phone;
    
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 700px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 26px; }
    .logo { margin-bottom: 15px; }
    .logo img { max-width: 120px !important; height: auto !important; width: 100% !important; }
    .content { background: white; padding: 30px; border: 1px solid #e5e7eb; }
    .section { margin-bottom: 30px; }
    .section-title { background: #eff6ff; color: #1e40af; padding: 12px 15px; font-weight: bold; border-left: 4px solid #2563eb; margin-bottom: 15px; border-radius: 4px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    .info-item { background: #f9fafb; padding: 12px; border-radius: 6px; border-left: 3px solid #2563eb; }
    .info-label { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
    .info-value { font-weight: bold; color: #1f2937; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; background: white; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    th { background: #1f2937; color: white; padding: 12px; text-align: left; font-weight: 600; }
    td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
    .total-row { background: #eff6ff; }
    .total-row td { font-weight: bold; font-size: 16px; color: #1e40af; padding: 15px 12px; }
    .special-requests { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px; margin-top: 15px; }
    .footer { background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: bold; }
    .badge-blue { background: #dbeafe; color: #1e40af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">
        <img src="https://scontent.fmnl13-3.fna.fbcdn.net/v/t39.30808-6/472300464_122200841444213657_1942670998381380726_n.jpg?_nc_cat=101&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=tPf4P4zhHVAQ7kNvwG4WBaZ&_nc_oc=AdkuLAhVMrvWhdeXtcfzb5vPc0PO98q977yQ10XI4eklYjztBKcm0BUZGhsc8vzYsI5HGEJRSvn1_CBSVPk208us&_nc_zt=23&_nc_ht=scontent.fmnl13-3.fna&_nc_gid=5KoVqgBsD6nV6rEBWNZq8Q&oh=00_AfdMQVtLx74hHJPNrH9oUmyQxEmdbGpiTKixOEJmuPCRtg&oe=68EEBC49" alt="RTW Travel & Tours" style="background: white; padding: 10px; border-radius: 8px;">
      </div>
      <h1>🎉 New Booking Request</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">Your One-Stop Travel Solutions Provider!</p>
    </div>
    
    <div class="content">
      <!-- Customer Information -->
      <div class="section">
        <div class="section-title">👤 Customer Information</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Full Name</div>
            <div class="info-value">${formData.fullName}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Email Address</div>
            <div class="info-value"><a href="mailto:${formData.email}" style="color: #2563eb;">${formData.email}</a></div>
          </div>
          <div class="info-item">
            <div class="info-label">Phone Number</div>
            <div class="info-value"><a href="tel:${formData.phone}" style="color: #2563eb;">${formData.phone}</a></div>
          </div>
          <div class="info-item">
            <div class="info-label">Preferred Contact</div>
            <div class="info-value"><span class="badge badge-blue">${contactMethodText.toUpperCase()}</span></div>
          </div>
        </div>
      </div>
      
      <!-- Travel Details -->
      <div class="section">
        <div class="section-title">✈️ Travel Details</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Travel Date</div>
            <div class="info-value">${formData.travelDate}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Number of Adults</div>
            <div class="info-value">${formData.adults} Adult(s)</div>
          </div>
          <div class="info-item">
            <div class="info-label">Number of Children</div>
            <div class="info-value">${formData.children || '0'} Child(ren)</div>
          </div>
          <div class="info-item">
            <div class="info-label">Budget Range</div>
            <div class="info-value">${formData.budgetRange || 'Not specified'}</div>
          </div>
          <div class="info-item" style="grid-column: span 2;">
            <div class="info-label">Accommodation Type</div>
            <div class="info-value">${formData.accommodationType}</div>
          </div>
        </div>
      </div>
      
      <!-- Selected Packages -->
      <div class="section">
        <div class="section-title">📦 Selected Packages</div>
        <table>
          <thead>
            <tr>
              <th>Package Name</th>
              <th>Destination</th>
              <th>Duration</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Price</th>
              <th style="text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${packagesTableRows}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="5" style="text-align: right;">TOTAL AMOUNT:</td>
              <td style="text-align: right;">₱${totalAmount.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      
      <!-- Special Requests -->
      ${formData.specialRequests ? `
      <div class="section">
        <div class="section-title">📝 Special Requests</div>
        <div class="special-requests">
          ${formData.specialRequests}
        </div>
      </div>
      ` : ''}
      
      <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; border-radius: 4px; margin-top: 20px;">
        <strong style="color: #dc2626;">⚠️ Action Required:</strong><br>
        Please respond to ${formData.fullName} within 24 hours via ${contactMethodText}.
      </div>
    </div>
    
    <div class="footer">
      This is an automated message from RTW Travel & Tours website.<br>
      © ${new Date().getFullYear()} Round-The-World Travel & Tours. All rights reserved.
    </div>
  </div>
</body>
</html>
    `;
    
    MailApp.sendEmail({
      to: recipient,
      subject: subject,
      htmlBody: htmlBody
    });
    
    // Send customer auto-reply
    sendBookingAutoReply(formData, packages, totalAmount, contactMethodText, contactValue);
    
  } catch (error) {
    console.error('Error sending booking email:', error);
  }
}

/**
 * Send auto-reply to customer for booking request
 */
function sendBookingAutoReply(formData, packages, totalAmount, contactMethodText, contactValue) {
  try {
    const subject = '✓ Booking Request Received - Round-The-World Travel & Tours';
    
    let packagesTableRows = '';
    if (packages && packages.length > 0) {
      packages.forEach(item => {
        const subtotal = item.package.price * item.quantity;
        packagesTableRows += `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.package.name}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.package.destination}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">₱${subtotal.toLocaleString()}</td>
          </tr>
        `;
      });
    }
    
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 650px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 35px; text-align: center; border-radius: 8px 8px 0 0; }
    .logo { margin-bottom: 15px; }
    .logo img { max-width: 120px !important; height: auto !important; width: 100% !important; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: white; padding: 35px; border: 1px solid #e5e7eb; }
    .greeting { font-size: 20px; color: #1f2937; margin-bottom: 20px; font-weight: 600; }
    .message { color: #4b5563; margin-bottom: 20px; line-height: 1.8; }
    .highlight-box { background: #d1fae5; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 4px; }
    .highlight-box strong { color: #047857; }
    .section-title { background: #eff6ff; color: #1e40af; padding: 12px 15px; font-weight: bold; border-left: 4px solid #2563eb; margin: 25px 0 15px 0; border-radius: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; background: white; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    th { background: #f3f4f6; color: #1f2937; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #d1d5db; }
    td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
    .total-row { background: #eff6ff; }
    .total-row td { font-weight: bold; font-size: 18px; color: #1e40af; padding: 15px 12px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 15px 0; }
    .info-item { background: #f9fafb; padding: 12px; border-radius: 6px; }
    .info-label { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
    .info-value { font-weight: 600; color: #1f2937; }
    .contact-box { background: #fef3c7; border: 2px solid #fbbf24; padding: 20px; border-radius: 8px; margin-top: 25px; }
    .contact-item { margin-bottom: 12px; font-size: 15px; }
    .icon { margin-right: 8px; }
    .footer { background: #1f2937; color: #9ca3af; padding: 25px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; line-height: 1.8; }
    .footer a { color: #60a5fa; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">
        <img src="https://scontent.fmnl13-3.fna.fbcdn.net/v/t39.30808-6/472300464_122200841444213657_1942670998381380726_n.jpg?_nc_cat=101&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=tPf4P4zhHVAQ7kNvwG4WBaZ&_nc_oc=AdkuLAhVMrvWhdeXtcfzb5vPc0PO98q977yQ10XI4eklYjztBKcm0BUZGhsc8vzYsI5HGEJRSvn1_CBSVPk208us&_nc_zt=23&_nc_ht=scontent.fmnl13-3.fna&_nc_gid=5KoVqgBsD6nV6rEBWNZq8Q&oh=00_AfdMQVtLx74hHJPNrH9oUmyQxEmdbGpiTKixOEJmuPCRtg&oe=68EEBC49" alt="RTW Travel & Tours" style="background: white; padding: 10px; border-radius: 8px;">
      </div>
      <h1>Round-The-World Travel & Tours</h1>
      <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">Your One-Stop Travel Solutions Provider!</p>
    </div>
    
    <div class="content">
      <div class="greeting">Dear ${formData.fullName},</div>
      
      <div class="message">
        Thank you for choosing <strong>Round-The-World Travel & Tours</strong> for your upcoming adventure!
      </div>
      
      <div class="highlight-box">
        <strong>✓ Your booking request has been successfully received!</strong><br>
        Our travel consultants will review your request and send you a detailed quotation within <strong>24 hours</strong>.
      </div>
      
      <!-- Booking Summary -->
      <div class="section-title">📦 Your Booking Summary</div>
      <table>
        <thead>
          <tr>
            <th>Package Name</th>
            <th>Destination</th>
            <th style="text-align: center;">Quantity</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${packagesTableRows}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="3" style="text-align: right;">TOTAL AMOUNT:</td>
            <td style="text-align: right;">₱${totalAmount.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>
      
      <!-- Travel Details -->
      <div class="section-title">✈️ Your Travel Details</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Travel Date</div>
          <div class="info-value">${formData.travelDate}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Number of Travelers</div>
          <div class="info-value">${formData.adults} Adult(s), ${formData.children || '0'} Child(ren)</div>
        </div>
        <div class="info-item">
          <div class="info-label">Budget Range</div>
          <div class="info-value">${formData.budgetRange || 'Not specified'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Accommodation</div>
          <div class="info-value">${formData.accommodationType}</div>
        </div>
      </div>
      
      ${formData.specialRequests ? `
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px; margin-top: 15px;">
        <strong>Your Special Requests:</strong><br>
        ${formData.specialRequests}
      </div>
      ` : ''}
      
      <div class="contact-box">
        <div style="font-weight: bold; margin-bottom: 15px; color: #92400e; font-size: 16px;">
          📞 We'll Contact You Via: <span style="color: #2563eb;">${contactMethodText.toUpperCase()}</span>
        </div>
        <div class="contact-item">
          <span class="icon">✉️</span> <strong>Contact Info:</strong> ${contactValue}
        </div>
        
        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #fbbf24;">
          <strong>Need immediate assistance?</strong>
        </div>
        <div class="contact-item">
          <span class="icon">📞</span> <strong>Phone:</strong> <a href="tel:09668212256" style="color: #2563eb;">0966 821 2256</a>
        </div>
        <div class="contact-item">
          <span class="icon">📧</span> <strong>Email:</strong> <a href="mailto:roundtheworldtraveltours@gmail.com" style="color: #2563eb;">roundtheworldtraveltours@gmail.com</a>
        </div>
        <div class="contact-item">
          <span class="icon">📍</span> <strong>Office:</strong> Santa Rosa, Laguna, Philippines
        </div>
        <div class="contact-item">
          <span class="icon">🕐</span> <strong>Hours:</strong> Monday - Saturday: 9:00 AM - 6:00 PM
        </div>
      </div>
      
      <div class="message" style="margin-top: 25px;">
        We're excited to help you create unforgettable travel memories!<br><br>
        Best regards,<br>
        <strong>Round-The-World Travel & Tours Team</strong>
      </div>
    </div>
    
    <div class="footer">
      © ${new Date().getFullYear()} Round-The-World Travel & Tours. All rights reserved.<br>
      Santa Rosa, Laguna, Philippines<br>
      <a href="https://www.facebook.com/roundtheworldtraveltours">Visit us on Facebook</a> | 
      <a href="tel:09668212256">0966 821 2256</a> | 
      <a href="mailto:roundtheworldtraveltours@gmail.com">Contact Us</a>
    </div>
  </div>
</body>
</html>
    `;
    
    MailApp.sendEmail({
      to: formData.email,
      subject: subject,
      htmlBody: htmlBody
    });
    
  } catch (error) {
    console.error('Error sending booking auto-reply:', error);
  }
}

// ========== GET GALLERY ==========

/**
 * Fetch all gallery images from Google Sheets
 */
function getGallery() {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(GALLERY_SHEET_NAME);
    
    if (!sheet) {
      throw new Error('Gallery sheet not found. Please create a sheet named "' + GALLERY_SHEET_NAME + '"');
    }
    
    const data = sheet.getDataRange().getValues();
    
    // Remove header row
    const headers = data[0];
    const rows = data.slice(1);
    
    // Convert rows to objects
    const gallery = rows.map((row, index) => {
      const item = {};
      headers.forEach((header, headerIndex) => {
        // Store both original case and lowercase
        const normalizedHeader = header.trim().toLowerCase();
        item[normalizedHeader] = row[headerIndex];
        item[header.trim()] = row[headerIndex]; // Keep original case too
      });
      
      // Ensure proper data types
      // Support multiple images separated by pipe (|) or commas (,)
      const imagesField = String(item.images || item.Images || '');
      const imagesArray = imagesField ? imagesField.split('|').map(url => url.trim()).filter(url => url) : [];
      
      return {
        id: String(item.id || item.Id || `gal-${index + 1}`),
        title: String(item.title || item.Title || ''),
        destination: String(item.destination || item.Destination || ''),
        tourType: String(item.tourtype || item.tourType || item.TourType || ''),
        year: String(item.year || item.Year || ''),
        images: imagesArray,  // Array of image URLs
        thumbnail: String(item.thumbnail || item.Thumbnail || (imagesArray.length > 0 ? imagesArray[0] : '')),
        description: String(item.description || item.Description || ''),
        clientName: String(item.clientname || item.clientName || item.ClientName || item.title || item.Title || '')
      };
    }).filter(item => item.images && item.images.length > 0); // Filter out empty rows
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      gallery: gallery,
      count: gallery.length
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ========== GET TESTIMONIALS ==========

/**
 * Fetch all testimonials from Google Sheets
 */
function getTestimonials() {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TESTIMONIALS_SHEET_NAME);
    
    if (!sheet) {
      throw new Error('Testimonials sheet not found. Please create a sheet named "' + TESTIMONIALS_SHEET_NAME + '"');
    }
    
    const data = sheet.getDataRange().getValues();
    
    // Remove header row
    const headers = data[0];
    const rows = data.slice(1);
    
    // Convert rows to objects
    const testimonials = rows.map((row, index) => {
      const item = {};
      headers.forEach((header, headerIndex) => {
        // Store both original case and lowercase
        const normalizedHeader = header.trim().toLowerCase();
        item[normalizedHeader] = row[headerIndex];
        item[header.trim()] = row[headerIndex]; // Keep original case too
      });
      
      // Ensure proper data types
      return {
        id: String(item.id || item.Id || `test-${index + 1}`), // Auto-generate ID if missing
        name: String(item.name || item.Name || ''),
        location: String(item.location || item.Location || ''),
        rating: Number(item.rating || item.Rating) || 5,
        text: String(item.text || item.Text || ''),
        date: String(item.date || item.Date || ''),
        package: String(item.package || item.Package || ''),
        avatar: String(item.avatar || item.Avatar || '')
      };
    }).filter(item => item.name); // Filter out empty rows (only need name)
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      testimonials: testimonials,
      count: testimonials.length
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ========== UTILITY FUNCTIONS ==========

/**
 * Test function - Run this to verify setup
 */
function testSetup() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    Logger.log('✓ Spreadsheet found: ' + ss.getName());
    
    const packagesSheet = ss.getSheetByName(PACKAGES_SHEET_NAME);
    if (packagesSheet) {
      Logger.log('✓ Packages sheet found');
      const data = packagesSheet.getDataRange().getValues();
      Logger.log('  Packages count: ' + (data.length - 1));
    } else {
      Logger.log('✗ Packages sheet NOT found');
    }
    
    const contactsSheet = ss.getSheetByName(CONTACTS_SHEET_NAME);
    if (contactsSheet) {
      Logger.log('✓ Contacts sheet found');
    } else {
      Logger.log('✗ Contacts sheet NOT found');
    }
    
    const bookingsSheet = ss.getSheetByName(BOOKINGS_SHEET_NAME);
    if (bookingsSheet) {
      Logger.log('✓ Bookings sheet found');
    } else {
      Logger.log('✗ Bookings sheet NOT found');
    }
    
    Logger.log('\nSetup complete! Ready to deploy.');
    
  } catch (error) {
    Logger.log('✗ Error: ' + error.toString());
  }
}