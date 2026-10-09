
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
const RECEIPT_DIR = path.join(DATA_DIR, "receipts");
const SUBMISSIONS_FILE = path.join(DATA_DIR, "payments.jsonl");

fs.mkdirSync(RECEIPT_DIR, { recursive: true });

app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));

// Serve the existing frontend from this project directory.
// Keep private-data outside any publicly served directory.
app.use(express.static(__dirname, {
  index: "index.html",
  dotfiles: "deny"
}));

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
const notificationEmail =
  process.env.NOTIFICATION_EMAIL ||
  "brooklynhousing64@gmail.com";

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
    return { error: "Amount must be between $1 and $100,000." };
  }

  if (body.currency !== "USD") {
    return { error: "Only USD payments are accepted." };
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

async function notifyOwner(subject, text) {
  if (!mailer) {
    console.warn(
      "Email is not configured. Set SMTP credentials in .env."
    );
    return false;
  }

  await mailer.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: notificationEmail,
    subject,
    text
  });

  return true;
}

function saveSubmission(record) {
  fs.appendFileSync(
    SUBMISSIONS_FILE,
    JSON.stringify(record) + "\n",
    { encoding: "utf8", mode: 0o600 }
  );
}

// Health check: visit /api/health in your browser.
app.get("/api/health", (req, res) => {
  res.json({
    status: "running",
    service: "Brooklyn's Rentals Payments",
    currency: "USD",
    cardCheckoutConfigured: false,
    bankTransferSubmissions: true
  });
});

// CARD CHECKOUT
// A real provider must be integrated before accepting card payments.
// Do not collect or store card numbers or CVVs on this server.
app.post("/api/payments/card/checkout", (req, res) => {
  return res.status(503).json({
    message:
      "Card checkout is not configured yet. Connect a payment provider " +
      "that supports Visa and Verve for your USD merchant account."
  });
});

// Configure private receipt storage.
const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, RECEIPT_DIR);
  },

  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, crypto.randomUUID() + extension);
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  },

  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const allowed = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".pdf": "application/pdf"
    };

    if (
      !allowed[extension] ||
      allowed[extension] !== file.mimetype
    ) {
      return callback(
        new Error("Upload a JPG, PNG, or PDF receipt.")
      );
    }

    callback(null, true);
  }
});

// BANK TRANSFER RECEIPT SUBMISSION
app.post(
  "/api/payments/bank-transfer",
  upload.single("receipt"),
  async (req, res) => {
    let savedFile = req.file ? req.file.path : null;

    try {
      const validation = validCustomer(req.body);

      if (validation.error) {
        if (savedFile) fs.unlinkSync(savedFile);
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
        if (savedFile) fs.unlinkSync(savedFile);

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
        "BR-" + crypto.randomUUID().replace(/-/g, "")
          .slice(0, 12).toUpperCase();

      const record = {
        reference,
        fullName: customer.fullName,
        email: customer.email,
        amount: customer.amount,
        currency: "USD",
        method: "Bank Transfer",
        transferReference,
        receiptFilename: path.basename(req.file.filename),
        status: "PENDING_VERIFICATION",
        submittedAt: new Date().toISOString()
      };

      // Save privately before reporting successful submission.
      saveSubmission(record);

      let emailSent = false;

      try {
        emailSent = await notifyOwner(
          "Brooklyn's Rentals: Transfer Awaiting Verification",
          [
            "A bank-transfer submission has been received.",
            "",
            `Submission ID: ${reference}`,
            `Customer: ${customer.fullName}`,
            `Customer email: ${customer.email}`,
            `Amount claimed: $${customer.amount.toFixed(2)} USD`,
            `Transfer reference: ${transferReference}`,
            `Receipt filename: ${path.basename(req.file.filename)}`,
            "Status: PENDING VERIFICATION",
            "",
            "Verify the funds in your account before marking this payment paid.",
            "The receipt is stored privately on the server."
          ].join("\n")
        );
      } catch (emailError) {
        console.error("Notification email failed:", emailError.message);
      }

      return res.status(201).json({
        message:
          "Receipt submitted. Payment is pending verification.",
        reference,
        status: "PENDING_VERIFICATION",
        notificationSent: emailSent
      });
    } catch (error) {
      console.error("Transfer submission error:", error);

      // Preserve a receipt if a record may already have been saved.
      return res.status(500).json({
        message: "Unable to process your submission. Please try again."
      });
    }
  }
);

// JSON error responses for upload and request errors.
app.use((err, req, res, next) => {
  console.error("Request error:", err.message);

  if (res.headersSent) {
    return next(err);
  }

  const status =
    err instanceof multer.MulterError ? 400 : 400;

  res.status(status).json({
    message: err.message || "Invalid request."
  });
});

// Do not expose internal errors or private receipt paths.
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      message: "API endpoint not found."
    });
  }

  res.status(404).send("Page not found.");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Brooklyn's Rentals server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
