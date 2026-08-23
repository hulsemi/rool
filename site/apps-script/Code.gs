/**
 * ELECTRON SEMI — Google Apps Script backend
 * -----------------------------------------------------------------------
 * Receives POSTs from the GitHub Pages website, routes by form type,
 * writes to the matching Google Sheet tab, uploads career resumes to
 * Drive, and sends an email notification.
 *
 * Deploy this as a Web App (Deploy > New deployment > Web app).
 *   - Execute as: Me
 *   - Who has access: Anyone
 *
 * See README.md / the setup checklist for full step-by-step instructions.
 * -----------------------------------------------------------------------
 */

// ======================= 1. CONFIGURATION — EDIT THESE =====================

// Where notification emails are sent.
const NOTIFY_EMAIL = "sahil.remail@gmail.com"; // PLACEHOLDER — replace me

// Google Drive folder ID where career-application resumes are stored.
// See the setup checklist for how to create the folder and find its ID.
const RESUME_FOLDER_ID = "1WxfPvmxjzbQtjqT7zJ8LhDvCd674JxPM"; // PLACEHOLDER — replace me

// Sheet tab names — must exist in the spreadsheet this script is bound to.
const SHEETS = {
  service: "Service Enquiries",
  career: "Career Applications",
  contact: "Contact Messages"
};

// Company name used in notification email subjects.
const COMPANY_NAME = "Electron Semi";

// =============================================================================

/**
 * Handles POST requests from the website's forms.
 * Body is JSON sent as text/plain (see js/script.js) to avoid CORS preflight.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ result: "error", message: "No data received." });
    }

    const data = JSON.parse(e.postData.contents);
    const formType = data.formType;

    if (!SHEETS[formType]) {
      return jsonResponse({ result: "error", message: "Unknown form type." });
    }

    // Basic server-side validation — never trust the client alone.
    const validationError = validate(formType, data);
    if (validationError) {
      return jsonResponse({ result: "error", message: validationError });
    }

    let resumeUrl = "";
    if (formType === "career" && data.resume && data.resume.base64Data) {
      resumeUrl = saveResumeToDrive(data.resume, data.fullName);
    }

    appendToSheet(formType, data, resumeUrl);
    sendNotificationEmail(formType, data, resumeUrl);

    return jsonResponse({ result: "success" });
  } catch (err) {
    return jsonResponse({ result: "error", message: "Server error: " + err.message });
  }
}

/**
 * Optional: lets you sanity-check the deployment by visiting the Web App
 * URL directly in a browser.
 */
function doGet() {
  return ContentService
    .createTextOutput("Electron Semi Apps Script endpoint is running.")
    .setMimeType(ContentService.MimeType.TEXT);
}

// ----------------------------------------------------------------------------
// Validation
// ----------------------------------------------------------------------------
function validate(formType, data) {
  const required = {
    service: ["fullName", "companyName", "workEmail", "serviceRequired", "projectDescription"],
    career: ["fullName", "email", "phone", "position", "experienceLevel", "coverMessage"],
    contact: ["name", "email", "subject", "message"]
  };

  for (const field of required[formType]) {
    if (!data[field] || String(data[field]).trim() === "") {
      return "Missing required field: " + field;
    }
  }

  const emailField = formType === "service" ? "workEmail" : "email";
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(String(data[emailField]).trim())) {
    return "Invalid email address.";
  }

  // Reject absurdly long input as a basic malformed-submission guard.
  for (const key in data) {
    if (typeof data[key] === "string" && data[key].length > 5000) {
      return "Submission too large.";
    }
  }

  return null; // valid
}

// ----------------------------------------------------------------------------
// Sheets
// ----------------------------------------------------------------------------
function appendToSheet(formType, data, resumeUrl) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS[formType]);
  if (!sheet) throw new Error("Sheet tab not found: " + SHEETS[formType]);

  const timestamp = new Date();

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headerRowFor(formType));
  }

  let row;
  if (formType === "service") {
    row = [
      timestamp, data.fullName, data.companyName, data.workEmail, data.phone || "",
      data.serviceRequired, data.technologyNode || "", data.projectDescription,
      data.expectedTimeline || "", data.additionalRequirements || ""
    ];
  } else if (formType === "career") {
    row = [
      timestamp, data.fullName, data.email, data.phone, data.position, data.experienceLevel,
      data.location || "", data.linkedinUrl || "", data.portfolioUrl || "",
      data.coverMessage, resumeUrl || ""
    ];
  } else {
    row = [timestamp, data.name, data.email, data.phone || "", data.subject, data.message];
  }

  sheet.appendRow(row);
}

function headerRowFor(formType) {
  if (formType === "service") {
    return ["Timestamp", "Full Name", "Company Name", "Work Email", "Phone", "Service Required",
      "Technology Node", "Project Description", "Expected Timeline", "Additional Requirements"];
  }
  if (formType === "career") {
    return ["Timestamp", "Full Name", "Email", "Phone", "Position", "Experience Level",
      "Location", "LinkedIn URL", "Portfolio URL", "Cover Message", "Resume URL"];
  }
  return ["Timestamp", "Name", "Email", "Phone", "Subject", "Message"];
}

// ----------------------------------------------------------------------------
// Drive (resume upload workaround)
//
// Apps Script Web Apps cannot reliably accept multipart/form-data file
// uploads from a cross-origin fetch(). The workaround used here: the browser
// reads the resume file, base64-encodes it client-side, and sends it as a
// field inside the JSON payload. Apps Script then decodes it back into a
// Blob and saves it to Drive. This avoids multipart entirely.
// ----------------------------------------------------------------------------
function saveResumeToDrive(resume, applicantName) {
  const folder = DriveApp.getFolderById(RESUME_FOLDER_ID);
  const bytes = Utilities.base64Decode(resume.base64Data);
  const safeName = (applicantName || "Applicant").replace(/[^a-zA-Z0-9]/g, "_");
  const fileName = safeName + "_" + Date.now() + "_" + resume.fileName;
  const blob = Utilities.newBlob(bytes, resume.mimeType, fileName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

// ----------------------------------------------------------------------------
// Email
// ----------------------------------------------------------------------------
function sendNotificationEmail(formType, data, resumeUrl) {
  let subject, body;

  if (formType === "service") {
    subject = "New Service Enquiry – " + data.serviceRequired;
    body = [
      "New service enquiry received on the " + COMPANY_NAME + " website.", "",
      "Full Name: " + data.fullName,
      "Company: " + data.companyName,
      "Work Email: " + data.workEmail,
      "Phone: " + (data.phone || "-"),
      "Service Required: " + data.serviceRequired,
      "Technology Node: " + (data.technologyNode || "-"),
      "Expected Timeline: " + (data.expectedTimeline || "-"),
      "Additional Requirements: " + (data.additionalRequirements || "-"), "",
      "Project Description:", data.projectDescription
    ].join("\n");
  } else if (formType === "career") {
    subject = "New Career Application – " + data.position;
    body = [
      "New career application received on the " + COMPANY_NAME + " website.", "",
      "Full Name: " + data.fullName,
      "Email: " + data.email,
      "Phone: " + data.phone,
      "Position: " + data.position,
      "Experience Level: " + data.experienceLevel,
      "Location: " + (data.location || "-"),
      "LinkedIn: " + (data.linkedinUrl || "-"),
      "Portfolio: " + (data.portfolioUrl || "-"),
      "Resume: " + (resumeUrl || "No resume uploaded"), "",
      "Cover Message:", data.coverMessage
    ].join("\n");
  } else {
    subject = "New Website Contact Message";
    body = [
      "New contact message received on the " + COMPANY_NAME + " website.", "",
      "Name: " + data.name,
      "Email: " + data.email,
      "Phone: " + (data.phone || "-"),
      "Subject: " + data.subject, "",
      "Message:", data.message
    ].join("\n");
  }

  MailApp.sendEmail(NOTIFY_EMAIL, subject, body);
}

// ----------------------------------------------------------------------------
// Response helper
// ----------------------------------------------------------------------------
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
