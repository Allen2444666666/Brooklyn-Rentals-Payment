require("dotenv").config();

const express = require("express");
const multer = require("multer");
const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const DATA_DIR = path.join(__dirname, "private-data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const SUBMISSIONS_FILE = path.join(DATA_DIR, "payments.jsonl");

fs.mkdirSync(UPLOAD_DIR, { recursive: true, mode: 0o700 });

if (!fs.existsSync(SUBMISSIONS_FILE)) {
  fs.writeFileSync(SUBMISSIONS_FILE, "", { mode: 0o600 });
}

app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));

// Block direct access to private payment records and environment files.
app.use((req, res, next) => {
  if (/^\/(private-data|\.env)(\/|$)/i.test(req.path)) {
    return res.status(404).send("Not found.");
  }
  next();
});

app.use(express.static(__dirname, {
  index: "index.html",
  dotfiles: "deny"
}));

const notificationEmail =
  process.env.NOTIFICATION_EMAIL ||
  "brooklynhousing64@gmail.com";

const adminToken = process.env.ADMIN_TOKEN;

const publicBaseUrl =
  (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");

// EMAIL CONFIGURATION
function createMailer() {
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_PORT ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

const mailer = createMailer();

// SAVE PAYMENT RECORDS
function appendRecord(record) {
  fs.appendFileSync(
    SUBMISSIONS_FILE,
    JSON.stringify(record) + "\n",
    {
      encoding: "utf8",
      mode: 0o600
    }
  );
}

// Read the latest record for each payment reference.
function getPayments() {
  const map = new Map();

  const lines = fs.readFileSync(
    SUBMISSIONS_FILE,
    "utf8"
  ).split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const record = JSON.parse(line);

      if (record.reference) {
        map.set(record.reference, record);
      }
    } catch (_) {
      // Ignore malformed records.
    }
  }

  return [...map.values()];
}

function getPayment(reference) {
  return getPayments().find(
    payment => payment.reference === reference
  );
}

// VALIDATE CUSTOMER DETAILS
function validCustomer(body) {
  const fullName =
    typeof body.fullName === "string"
      ? body.fullName.trim()
      : "";

  const email =
    typeof body.email === "string"
      ? body.email.trim()
      : "";

  const amount = Number(body.amount);

  if (!fullName || fullName.length > 120) {
    return { error: "Enter a valid full name." };
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254
  ) {
    return { error: "Enter a valid email address." };
  }

  if (
    !Number.isFinite(amount) ||
    amount < 1 ||
    amount > 100000
  ) {
    return {
      error: "Amount must be between $1 and $100,000."
    };
  }

  if (body.currency !== "USD") {
    return {
      error: "Only USD payments are accepted."
    };
  }

  return {
    customer: {
      fullName,
      email,
      amount: Math.round(amount * 100) / 100,
      currency: "USD"
    }
  };
}

// SEND EMAIL
async function sendMail({ to, subject, text, html }) {
  if (!mailer) return false;

  await mailer.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    ...(html ? { html } : {})
  });

  return true;
}

async function notifyOwner(subject, text) {
  return sendMail({
    to: notificationEmail,
    subject,
    text
  });
}

// PROTECT ADMIN ENDPOINTS
function requireAdmin(req, res, next) {
  if (!adminToken) {
    return res.status(503).json({
      message:
        "Admin access is not configured. Set ADMIN_TOKEN in .env."
    });
  }

  const supplied = req.get("x-admin-token") || "";

  const a = Buffer.from(supplied);
  const b = Buffer.from(adminToken);

  if (
    a.length !== b.length ||
    !crypto.timingSafeEqual(a, b)
  ) {
    return res.status(401).json({
      message: "Unauthorized."
    });
  }

  next();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

function money(amount) {
  return "$" + Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + " USD";
}

// SERVER STATUS
app.get("/api/health", (req, res) => {
  res.json({
    status: "running",
    service: "Brooklyn's Rentals Payments",
    currency: "USD",
    cardCheckoutConfigured: false,
    bankTransferSubmissions: true,
    officialReceipts: true
  });
});

// CARD PAYMENTS ARE DISABLED
app.post("/api/payments/card/checkout", (req, res) => {
  res.status(503).json({
    message:
      "Card payments are disabled. Please use bank transfer."
  });
});

// PRIVATE UPLOAD STORAGE
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },

  filename: (req, file, cb) => {
    cb(
      null,
      crypto.randomUUID() +
      path.extname(file.originalname).toLowerCase()
    );
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  },

  fileFilter: (req, file, cb) => {
    const ext =
      path.extname(file.originalname).toLowerCase();

    const allowed = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".pdf": "application/pdf"
    };

    if (
      !allowed[ext] ||
      allowed[ext] !== file.mimetype
    ) {
      return cb(
        new Error("Upload a JPG, PNG, or PDF receipt.")
      );
    }

    cb(null, true);
  }
});

// BANK TRANSFER SUBMISSION
app.post(
  "/api/payments/bank-transfer",
  upload.single("receipt"),
  async (req, res) => {
    let savedFile = req.file ? req.file.path : null;

    try {
      const validation = validCustomer(req.body);

      if (validation.error) {
        if (savedFile && fs.existsSync(savedFile)) {
          fs.unlinkSync(savedFile);
        }

        return res.status(400).json({
          message: validation.error
        });
      }

      const transferReference =
        typeof req.body.transferReference === "string"
          ? req.body.transferReference.trim()
          : "";

      if (
        !transferReference ||
        transferReference.length > 150
      ) {
        if (savedFile && fs.existsSync(savedFile)) {
          fs.unlinkSync(savedFile);
        }

        return res.status(400).json({
          message: "Enter a valid transfer reference."
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "Please upload your transfer receipt."
        });
      }

      const customer = validation.customer;

      const reference =
        "BR-" +
        crypto.randomUUID()
          .replace(/-/g, "")
          .slice(0, 12)
          .toUpperCase();

      const record = {
        reference,
        fullName: customer.fullName,
        email: customer.email,
        amount: customer.amount,
        currency: "USD",
        method: "Bank Transfer",
        transferReference,
        uploadFilename: path.basename(req.file.filename),
        status: "PENDING_VERIFICATION",
        submittedAt: new Date().toISOString()
      };

      // Save privately before confirming the submission.
      appendRecord(record);

      let emailSent = false;

      try {
        emailSent = await notifyOwner(
          "Brooklyn's Rentals: Transfer Awaiting Verification",
          [
            "A bank-transfer submission has been received.",
            `Submission ID: ${reference}`,
            `Customer: ${customer.fullName}`,
            `Customer email: ${customer.email}`,
            `Amount claimed: ${money(customer.amount)}`,
            `Transfer reference: ${transferReference}`,
            `Uploaded proof file: ${record.uploadFilename}`,
            "Status: PENDING VERIFICATION",
            "",
            "Verify the funds in your bank account before approving this payment.",
            "Open the admin panel on your website to review and approve."
          ].join("\n")
        );
      } catch (error) {
        console.error(
          "Owner notification email failed:",
          error.message
        );
      }

      return res.status(201).json({
        message:
          "Transfer proof submitted. This is an acknowledgement only; payment is not yet confirmed.",
        reference,
        status: record.status,
        notificationSent: emailSent
      });

    } catch (error) {
      console.error(
        "Transfer submission error:",
        error.message
      );

      return res.status(500).json({
        message:
          "Unable to process your submission. Please try again."
      });
    }
  }
);

// ADMIN PANEL
// Open /admin and enter the ADMIN_TOKEN from your .env file.
app.get("/admin", (req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Brooklyn's Rentals Admin</title>
<style>
body{font:16px Arial,sans-serif;background:#eef4ff;color:#1d2b3a;margin:0;padding:20px}
.wrap{max-width:900px;margin:auto;background:white;padding:22px;border-radius:14px}
input,button{font:inherit;padding:11px;border-radius:8px;border:1px solid #ccd6e5}
button{cursor:pointer;background:#315cff;color:white;border:0}
article{border:1px solid #dfe7f1;border-radius:10px;padding:14px;margin:12px 0;overflow-wrap:anywhere}
.muted{color:#65758a}.danger{color:#a32121}
</style>
</head>
<body>
<div class="wrap">
<h1>Brooklyn's Rentals — Admin</h1>
<p class="muted">Review transfers and approve only after the money has arrived in your account.</p>
<label>Admin token
<input id="token" type="password" autocomplete="current-password" style="width:min(100%,400px)">
</label>
<button id="load">Load payments</button>
<p id="status"></p>
<div id="items"></div>
</div>

<script>
const token=document.getElementById('token');
const items=document.getElementById('items');
const status=document.getElementById('status');

token.value=sessionStorage.getItem('brAdminToken')||'';

async function api(url,opts={}){
  const r=await fetch(url,{
    ...opts,
    headers:{
      'Content-Type':'application/json',
      'x-admin-token':token.value,
      ...(opts.headers||{})
    }
  });

  const d=await r.json();

  if(!r.ok) throw Error(d.message||'Request failed');

  return d;
}

async function load(){
  sessionStorage.setItem('brAdminToken',token.value);
  status.textContent='Loading…';
  items.innerHTML='';

  try{
    const d=await api('/api/admin/payments');
    status.textContent=d.payments.length+' payment record(s)';

    for(const p of d.payments){
      const a=document.createElement('article');

      a.innerHTML=
        '<h3>'+esc(p.fullName)+' — '+esc(p.reference)+'</h3>'+
        '<p><b>Amount claimed:</b> '+esc(money(p.amount))+'</p>'+
        '<p><b>Email:</b> '+esc(p.email)+'</p>'+
        '<p><b>Transfer reference:</b> '+esc(p.transferReference)+'</p>'+
        '<p><b>Status:</b> '+esc(p.status)+'</p>'+
        '<p><b>Submitted:</b> '+esc(p.submittedAt)+'</p>';

      if(p.status==='PENDING_VERIFICATION'){
        const b=document.createElement('button');
        b.textContent='Approve as PAID';

        b.onclick=async()=>{
          if(!confirm(
            'Confirm you have independently verified the funds in your bank account?'
          )) return;

          try{
            const result=await api(
              '/api/admin/payments/'+encodeURIComponent(p.reference)+'/approve',
              {method:'POST',body:'{}'}
            );

            alert(
              'Payment approved. Receipt email '+
              (result.emailSent?'sent.':'not sent (check SMTP settings).')+
              '\\nReceipt: '+result.receiptUrl
            );

            load();
          }catch(e){
            alert(e.message);
          }
        };

        a.appendChild(b);
      }else if(p.status==='PAID'){
        const s=document.createElement('p');
        s.textContent='Receipt number: '+(p.receiptNumber||'');
        a.appendChild(s);
      }

      items.appendChild(a);
    }
  }catch(e){
    status.textContent=e.message;
    status.className='danger';
  }
}

function esc(s){
  return String(s??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function money(n){
  return '$'+Number(n).toFixed(2)+' USD';
}

document.getElementById('load').onclick=load;
</script>
</body>
</html>`);
});

// LIST PAYMENT RECORDS — ADMIN ONLY
app.get("/api/admin/payments", requireAdmin, (req, res) => {
  const payments = getPayments().map(p => ({
    reference: p.reference,
    fullName: p.fullName,
    email: p.email,
    amount: p.amount,
    transferReference: p.transferReference,
    status: p.status,
    submittedAt: p.submittedAt,
    receiptNumber: p.receiptNumber
  }));

  res.json({
    payments: payments.sort(
      (a, b) => b.submittedAt.localeCompare(a.submittedAt)
    )
  });
});

// APPROVE PAYMENT AND GENERATE OFFICIAL RECEIPT
app.post(
  "/api/admin/payments/:reference/approve",
  requireAdmin,
  async (req, res) => {
    try {
      const current = getPayment(req.params.reference);

      if (!current) {
        return res.status(404).json({
          message: "Payment not found."
        });
      }

      if (current.status === "PAID") {
        return res.json({
          message: "Payment was already approved.",
          receiptNumber: current.receiptNumber,
          emailSent: false
        });
      }

      if (current.status !== "PENDING_VERIFICATION") {
        return res.status(409).json({
          message:
            "This payment cannot be approved in its current state."
        });
      }

      const receiptToken = crypto.randomBytes(32).toString("hex");
      const paidAt = new Date().toISOString();

      const receiptNumber =
        "BRR-" +
        new Date().getUTCFullYear() +
        "-" +
        crypto.randomBytes(5).toString("hex").toUpperCase();

      const updated = {
        ...current,
        status: "PAID",
        receiptNumber,
        paidAt,
        receiptTokenHash: crypto
          .createHash("sha256")
          .update(receiptToken)
          .digest("hex")
      };

      appendRecord(updated);

      const base = publicBaseUrl ||
        (req.secure ? "https://" : "http://") + req.get("host");

      const receiptUrl = `${base}/receipt/${receiptToken}`;

      let emailSent = false;

      try {
        emailSent = await sendMail({
          to: updated.email,
          subject:
            `Brooklyn's Rentals payment receipt ${receiptNumber}`,

          text: [
            `Hello ${updated.fullName},`,
            "",
            "Your bank transfer has been verified and marked as PAID.",
            `Receipt number: ${receiptNumber}`,
            `Amount received: ${money(updated.amount)}`,
            `Payment date: ${paidAt}`,
            `Transfer reference: ${updated.transferReference}`,
            `View, print, or save your receipt as PDF: ${receiptUrl}`,
            "",
            "Thank you for choosing Brooklyn's Rentals."
          ].join("\n"),

          html:
            `<p>Hello ${escapeHtml(updated.fullName)},</p>` +
            `<p>Your bank transfer has been verified and marked as <b>PAID</b>.</p>` +
            `<p><b>Receipt number:</b> ${escapeHtml(receiptNumber)}<br>` +
            `<b>Amount received:</b> ${escapeHtml(money(updated.amount))}<br>` +
            `<b>Payment date:</b> ${escapeHtml(paidAt)}<br>` +
            `<b>Transfer reference:</b> ${escapeHtml(updated.transferReference)}</p>` +
            `<p><a href="${escapeHtml(receiptUrl)}">View, print, or save your receipt as PDF</a></p>` +
            `<p>Thank you for choosing Brooklyn's Rentals.</p>`
        });
      } catch (error) {
        console.error(
          "Customer receipt email failed:",
          error.message
        );
      }

      try {
        await notifyOwner(
          "Brooklyn's Rentals: Payment Approved",
          [
            `Payment approved: ${updated.reference}`,
            `Receipt number: ${receiptNumber}`,
            `Customer: ${updated.fullName} (${updated.email})`,
            `Amount received: ${money(updated.amount)}`,
            `Transfer reference: ${updated.transferReference}`,
            `Receipt URL: ${receiptUrl}`
          ].join("\n")
        );
      } catch (error) {
        console.error(
          "Approval notification failed:",
          error.message
        );
      }

      res.json({
        message: "Payment marked as PAID.",
        receiptNumber,
        emailSent,
        receiptUrl
      });

    } catch (error) {
      console.error("Approval error:", error.message);

      res.status(500).json({
        message: "Unable to approve this payment."
      });
    }
  }
);

// CUSTOMER RECEIPT — SECRET LINK, ONLY FOR APPROVED PAYMENTS
app.get("/receipt/:token", (req, res) => {
  const token = req.params.token;

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return res.status(404).send("Receipt not found.");
  }

  const hash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const payment = getPayments().find(
    p => p.status === "PAID" && p.receiptTokenHash === hash
  );

  if (!payment) {
    return res.status(404).send(
      "Receipt not found or link is invalid."
    );
  }

  const date =
    new Date(payment.paidAt).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC"
    }) + " UTC";

  res.set("Cache-Control", "no-store");

  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Payment Receipt ${escapeHtml(payment.receiptNumber)}</title>
<style>
body{font:16px Arial,sans-serif;background:#f0f3f8;color:#1d2b3a;margin:0;padding:24px}
.receipt{max-width:680px;margin:20px auto;background:white;padding:34px;border-radius:14px;box-shadow:0 8px 30px #0001}
.top{display:flex;justify-content:space-between;gap:15px;align-items:center;border-bottom:2px solid #e6edf6;padding-bottom:18px}
.brand{font-size:22px;font-weight:bold;color:#193d32}
.paid{color:#176b39;font-weight:bold;border:1px solid #9ed3af;padding:8px 12px;border-radius:20px}
.row{display:flex;justify-content:space-between;gap:20px;padding:12px 0;border-bottom:1px solid #edf0f5}
.row span:first-child{color:#65758a}
.amount{font-size:30px;font-weight:bold;color:#193d32;margin:24px 0}
.buttons{max-width:680px;margin:0 auto;display:flex;gap:10px}
.buttons button{padding:12px 18px;border:0;border-radius:8px;background:#315cff;color:white;font-size:16px}
.note{color:#65758a;font-size:13px;line-height:1.5}
@media print{
  body{background:white;padding:0}
  .receipt{box-shadow:none;margin:0 auto}
  .buttons{display:none}
}
</style>
</head>
<body>
<main class="receipt">
  <div class="top">
    <div>
      <div class="brand">BROOKLYN'S RENTALS</div>
      <p>Official Payment Receipt</p>
    </div>
    <div class="paid">PAID</div>
  </div>

  <p><b>Receipt number:</b> ${escapeHtml(payment.receiptNumber)}</p>
  <p><b>Payment date:</b> ${escapeHtml(date)}</p>

  <div class="amount">${escapeHtml(money(payment.amount))}</div>

  <div class="row">
    <span>Customer name</span>
    <b>${escapeHtml(payment.fullName)}</b>
  </div>

  <div class="row">
    <span>Customer email</span>
    <b>${escapeHtml(payment.email)}</b>
  </div>

  <div class="row">
    <span>Payment method</span>
    <b>Bank transfer</b>
  </div>

  <div class="row">
    <span>Transfer reference</span>
    <b>${escapeHtml(payment.transferReference)}</b>
  </div>

  <div class="row">
    <span>Payment status</span>
    <b>PAID — funds verified</b>
  </div>

  <p class="note">
    This receipt confirms that Brooklyn's Rentals has marked the payment
    above as received after verification. Keep this receipt for your records.
  </p>
</main>

<div class="buttons">
  <button onclick="window.print()">Print / Save as PDF</button>
</div>
</body>
</html>`);
});

// ERROR HANDLING
app.use((err, req, res, next) => {
  console.error("Request error:", err.message);

  if (res.headersSent) return next(err);

  res.status(err instanceof multer.MulterError ? 400 : 400).json({
    message: err.message || "Invalid request."
  });
});

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      message: "API endpoint not found."
    });
  }

  res.status(404).send("Page not found.");
});

// START SERVER
app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Brooklyn's Rentals server running on port ${PORT}`
  );
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
});