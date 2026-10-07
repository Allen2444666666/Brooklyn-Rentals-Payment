/*
===========================================================
 SECURE USD PAYMENT BACKEND
===========================================================

 Frontend endpoints:

   POST /api/create-checkout
   POST /api/create-transfer

 Flutterwave:

   POST /api/flutterwave-webhook
   GET  /payment-success

 Admin:

   GET /api/admin/transfers

 Health:

   GET /api/health

===========================================================
*/

require("dotenv").config();

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");


/* ========================================================
   EXPRESS
======================================================== */

const app = express();

const PORT =
  process.env.PORT || 3000;


/* ========================================================
   CONFIGURATION
======================================================== */

const MAX_INDIVIDUAL_PAYMENT =
  3999.99;

const MAX_UPLOAD_SIZE =
  10 * 1024 * 1024;

const FLW_SECRET_KEY =
  process.env.FLW_SECRET_KEY;

const FLW_SECRET_HASH =
  process.env.FLW_SECRET_HASH;

const BASE_URL =
  process.env.BASE_URL ||
  `http://localhost:${PORT}`;

const ADMIN_KEY =
  process.env.ADMIN_KEY;


/* ========================================================
   DIRECTORIES
======================================================== */

const UPLOAD_DIR =
  path.join(
    __dirname,
    "private_uploads"
  );


const DATA_DIR =
  path.join(
    __dirname,
    "payment_data"
  );


if (!fs.existsSync(UPLOAD_DIR)) {

  fs.mkdirSync(
    UPLOAD_DIR,
    {
      recursive: true
    }
  );

}


if (!fs.existsSync(DATA_DIR)) {

  fs.mkdirSync(
    DATA_DIR,
    {
      recursive: true
    }
  );

}


/* ========================================================
   MULTER STORAGE
======================================================== */

const storage =
  multer.diskStorage({

    destination:
      function (
        req,
        file,
        callback
      ) {

        callback(
          null,
          UPLOAD_DIR
        );

      },


    filename:
      function (
        req,
        file,
        callback
      ) {

        const extension =
          path.extname(
            file.originalname
          ).toLowerCase();


        const filename =
          Date.now() +
          "-" +
          crypto.randomUUID() +
          extension;


        callback(
          null,
          filename
        );

      }

  });


/* ========================================================
   FILE VALIDATION
======================================================== */

const allowedMimeTypes = [

  "image/jpeg",

  "image/png",

  "application/pdf"

];


const fileFilter =
  function (
    req,
    file,
    callback
  ) {

    if (
      allowedMimeTypes.includes(
        file.mimetype
      )
    ) {

      callback(
        null,
        true
      );

    } else {

      callback(
        new Error(
          "Only JPG, JPEG, PNG and PDF files are allowed."
        )
      );

    }

  };


const upload =
  multer({

    storage,

    fileFilter,

    limits: {

      fileSize:
        MAX_UPLOAD_SIZE,

      files: 1

    }

  });


/* ========================================================
   BODY PARSERS
======================================================== */

/*
 IMPORTANT:

 We don't use express.json() globally before the
 Flutterwave webhook because the webhook signature
 needs the original raw request body.

 Normal JSON routes are handled separately below.
*/


app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb"
  })
);


/* ========================================================
   FRONTEND
======================================================== */

app.use(
  express.static(
    path.join(
      __dirname,
      "public"
    )
  )
);


/* ========================================================
   UTILITY FUNCTIONS
======================================================== */

function createReference(
  prefix
) {

  return (
    prefix +
    "-" +
    Date.now() +
    "-" +
    crypto
      .randomBytes(6)
      .toString("hex")
      .toUpperCase()
  );

}


function cleanText(
  value,
  maxLength = 500
) {

  if (
    typeof value !== "string"
  ) {

    return "";

  }

  return value
    .trim()
    .slice(
      0,
      maxLength
    );

}


function validEmail(
  email
) {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(email);

}


function validateAmount(
  amount
) {

  const value =
    Number(amount);


  if (
    !Number.isFinite(value)
  ) {

    return {

      valid: false,

      message:
        "Invalid payment amount."

    };

  }


  if (
    value <= 0
  ) {

    return {

      valid: false,

      message:
        "Payment amount must be greater than zero."

    };

  }


  if (
    value >
    MAX_INDIVIDUAL_PAYMENT
  ) {

    return {

      valid: false,

      message:
        "Individual payments are limited to $3,999.99."

    };

  }


  return {

    valid: true,

    amount:
      Math.round(
        value * 100
      ) / 100

  };

}


/* ========================================================
   HEALTH CHECK
======================================================== */

app.get(
  "/api/health",
  (req, res) => {

    res.json({

      success: true,

      status:
        "online",

      message:
        "USD payment server is running."

    });

  }
);


/* ========================================================
   CREATE CARD CHECKOUT
======================================================== */

app.post(
  "/api/create-checkout",

  express.json({
    limit: "1mb"
  }),

  async (req, res) => {

    try {

      const fullName =
        cleanText(
          req.body.fullName,
          150
        );


      const email =
        cleanText(
          req.body.email,
          200
        );


      const description =
        cleanText(
          req.body.description ||
          "Premium Service",
          200
        );


      const amount =
        req.body.amount;


      /* -----------------------------------------------
         VALIDATE NAME
      ------------------------------------------------ */

      if (
        !fullName
      ) {

        return res.status(400).json({

          error:
            "Full name is required."

        });

      }


      /* -----------------------------------------------
         VALIDATE EMAIL
      ------------------------------------------------ */

      if (
        !validEmail(email)
      ) {

        return res.status(400).json({

          error:
            "Please provide a valid email address."

        });

      }


      /* -----------------------------------------------
         VALIDATE AMOUNT
      ------------------------------------------------ */

      const amountResult =
        validateAmount(
          amount
        );


      if (
        !amountResult.valid
      ) {

        return res.status(400).json({

          error:
            amountResult.message

        });

      }


      /* -----------------------------------------------
         CHECK FLUTTERWAVE KEY
      ------------------------------------------------ */

      if (
        !FLW_SECRET_KEY
      ) {

        console.error(
          "FLW_SECRET_KEY is missing."
        );

        return res.status(500).json({

          error:
            "Payment server is not configured."

        });

      }


      /* -----------------------------------------------
         CREATE TRANSACTION REFERENCE
      ------------------------------------------------ */

      const txRef =
        createReference(
          "USD"
        );


      /* -----------------------------------------------
         CREATE FLUTTERWAVE CHECKOUT
      ------------------------------------------------ */

      const flutterwaveResponse =
        await fetch(
          "https://api.flutterwave.com/v3/payments",
          {

            method:
              "POST",

            headers: {

              Authorization:
                `Bearer ${FLW_SECRET_KEY}`,

              "Content-Type":
                "application/json",

              Accept:
                "application/json"

            },

            body:
              JSON.stringify({

                tx_ref:
                  txRef,

                amount:
                  amountResult.amount,

                currency:
                  "USD",

                redirect_url:
                  `${BASE_URL}/payment-success`,

                customer: {

                  email:
                    email,

                  name:
                    fullName

                },

                customizations: {

                  title:
                    "Secure USD Payment",

                  description:
                    description

                },

                payment_options:
                  "card",

                meta: {

                  allowed_cards:
                    "visa,verve"

                }

              })

          }
        );


      const result =
        await flutterwaveResponse.json();


      /* -----------------------------------------------
         FLUTTERWAVE ERROR
      ------------------------------------------------ */

      if (
        !flutterwaveResponse.ok ||
        result.status !== "success"
      ) {

        console.error(
          "Flutterwave checkout error:",
          result
        );

        return res.status(502).json({

          error:
            result.message ||
            "Unable to create payment checkout."

        });

      }


      /* -----------------------------------------------
         SAVE PENDING PAYMENT
      ------------------------------------------------ */

      const paymentRecord = {

        txRef,

        fullName,

        email,

        amount:
          amountResult.amount,

        currency:
          "USD",

        paymentMethod:
          "card",

        status:
          "pending",

        createdAt:
          new Date().toISOString()

      };


      saveJSONRecord(
        "card",
        txRef,
        paymentRecord
      );


      /* -----------------------------------------------
         SEND CHECKOUT URL TO FRONTEND
      ------------------------------------------------ */

      return res.json({

        success: true,

        txRef,

        checkoutUrl:
          result.data.link

      });

    } catch (error) {

      console.error(
        "Create checkout error:",
        error
      );

      return res.status(500).json({

        error:
          "Unable to create payment checkout."

      });

    }

  }
);


/* ========================================================
   BANK TRANSFER
======================================================== */

app.post(
  "/api/create-transfer",

  upload.single(
    "paymentScreenshot"
  ),

  async (req, res) => {

    try {

      const fullName =
        cleanText(
          req.body.fullName,
          150
        );


      const email =
        cleanText(
          req.body.email,
          200
        );


      const transferReference =
        cleanText(
          req.body.transferReference,
          200
        );


      const amount =
        req.body.amount;


      /* -----------------------------------------------
         VALIDATE NAME
      ------------------------------------------------ */

      if (
        !fullName
      ) {

        removeUploadedFile(
          req.file
        );

        return res.status(400).json({

          error:
            "Full name is required."

        });

      }


      /* -----------------------------------------------
         VALIDATE EMAIL
      ------------------------------------------------ */

      if (
        !validEmail(email)
      ) {

        removeUploadedFile(
          req.file
        );

        return res.status(400).json({

          error:
            "Please provide a valid email address."

        });

      }


      /* -----------------------------------------------
         VALIDATE REFERENCE
      ------------------------------------------------ */

      if (
        !transferReference
      ) {

        removeUploadedFile(
          req.file
        );

        return res.status(400).json({

          error:
            "Transfer reference is required."

        });

      }


      /* -----------------------------------------------
         VALIDATE AMOUNT
      ------------------------------------------------ */

      const amountResult =
        validateAmount(
          amount
        );


      if (
        !amountResult.valid
      ) {

        removeUploadedFile(
          req.file
        );

        return res.status(400).json({

          error:
            amountResult.message

        });

      }


      /* -----------------------------------------------
         CHECK RECEIPT
      ------------------------------------------------ */

      if (
        !req.file
      ) {

        return res.status(400).json({

          error:
            "Payment screenshot or receipt is required."

        });

      }


      /* -----------------------------------------------
         CREATE SUBMISSION ID
      ------------------------------------------------ */

      const submissionId =
        createReference(
          "TRF"
        );


      /* -----------------------------------------------
         CREATE TRANSFER RECORD
      ------------------------------------------------ */

      const transferRecord = {

        submissionId,

        customer: {

          fullName,

          email

        },

        amount:
          amountResult.amount,

        currency:
          "USD",

        transferReference,

        paymentMethod:
          "bank_transfer",

        receipt: {

          storedFilename:
            req.file.filename,

          originalFilename:
            req.file.originalname,

          mimeType:
            req.file.mimetype,

          size:
            req.file.size

        },

        status:
          "pending_verification",

        submittedAt:
          new Date().toISOString()

      };


      /* -----------------------------------------------
         SAVE RECORD
      ------------------------------------------------ */

      saveJSONRecord(
        "transfer",
        submissionId,
        transferRecord
      );


      console.log(
        "NEW BANK TRANSFER:",
        submissionId
      );


      /* -----------------------------------------------
         RESPONSE
      ------------------------------------------------ */

      return res.status(201).json({

        success: true,

        submissionId,

        message:
          "Transfer submitted successfully. Your payment will be verified."

      });

    } catch (error) {

      console.error(
        "Bank transfer error:",
        error
      );


      removeUploadedFile(
        req.file
      );


      return res.status(500).json({

        error:
          "Unable to submit transfer."

      });

    }

  }
);


/* ========================================================
   FLUTTERWAVE REDIRECT
======================================================== */

app.get(
  "/payment-success",
  async (req, res) => {

    try {

      const {

        status,

        tx_ref,

        transaction_id

      } = req.query;


      if (
        !tx_ref
      ) {

        return res.status(400).send(
          paymentPage(
            "Payment Error",
            "No transaction reference was provided."
          )
        );

      }


      /*
       IMPORTANT:

       The redirect itself is NOT proof that payment
       succeeded.

       We verify the transaction with Flutterwave
       directly below.
      */


      if (
        !transaction_id
      ) {

        return res.send(
          paymentPage(
            "Payment Received",
            "Your payment is being checked. Please wait for confirmation."
          )
        );

      }


      /* -----------------------------------------------
         VERIFY TRANSACTION
      ------------------------------------------------ */

      const verification =
        await verifyFlutterwaveTransaction(
          transaction_id
        );


      if (
        !verification.success
      ) {

        return res.send(
          paymentPage(
            "Payment Verification",
            "We could not verify this transaction yet. Please contact support."
          )
        );

      }


      const transaction =
        verification.data;


      /* -----------------------------------------------
         VERIFY REFERENCE
      ------------------------------------------------ */

      if (
        transaction.tx_ref !==
        tx_ref
      ) {

        return res.status(400).send(
          paymentPage(
            "Payment Error",
            "Transaction reference mismatch."
          )
        );

      }


      /* -----------------------------------------------
         VERIFY STATUS
      ------------------------------------------------ */

      if (
        transaction.status !==
        "successful"
      ) {

        return res.send(
          paymentPage(
            "Payment Not Completed",
            "The payment has not been confirmed as successful."
          )
        );

      }


      /* -----------------------------------------------
         VERIFY CURRENCY
      ------------------------------------------------ */

      if (
        transaction.currency !==
        "USD"
      ) {

        return res.status(400).send(
          paymentPage(
            "Payment Error",
            "Currency verification failed."
          )
        );

      }


      /* -----------------------------------------------
         VERIFY AMOUNT
      ------------------------------------------------ */

      const storedPayment =
        loadJSONRecord(
          "card",
          tx_ref
        );


      if (
        storedPayment &&
        Number(transaction.amount) <
        Number(storedPayment.amount)
      ) {

        return res.status(400).send(
          paymentPage(
            "Payment Error",
            "Payment amount verification failed."
          )
        );

      }


      /* -----------------------------------------------
         MARK PAYMENT SUCCESSFUL
      ------------------------------------------------ */

      const successfulPayment = {

        ...(storedPayment || {}),

        txRef:
          tx_ref,

        transactionId:
          transaction.id,

        status:
          "paid",

        flutterwaveStatus:
          transaction.status,

        verifiedAmount:
          transaction.amount,

        verifiedCurrency:
          transaction.currency,

        verifiedAt:
          new Date().toISOString()

      };


      saveJSONRecord(
        "card",
        tx_ref,
        successfulPayment
      );


      /* -----------------------------------------------
         SUCCESS PAGE
      ------------------------------------------------ */

      return res.send(
        paymentPage(
          "Payment Successful",
          `
            Your USD payment has been verified successfully.

            <br><br>

            Transaction reference:
            <strong>
              ${escapeHTML(tx_ref)}
            </strong>
          `
        )
      );

    } catch (error) {

      console.error(
        "Payment verification error:",
        error
      );

      return res.status(500).send(
        paymentPage(
          "Payment Error",
          "We were unable to verify the payment at this time."
        )
      );

    }

  }
);


/* ========================================================
   FLUTTERWAVE TRANSACTION VERIFICATION
======================================================== */

async function verifyFlutterwaveTransaction(
  transactionId
) {

  try {

    if (
      !FLW_SECRET_KEY
    ) {

      return {

        success: false

      };

    }


    const response =
      await fetch(
        `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`,
        {

          method:
            "GET",

          headers: {

            Authorization:
              `Bearer ${FLW_SECRET_KEY}`,

            Accept:
              "application/json"

          }

        }
      );


    const result =
      await response.json();


    if (
      !response.ok ||
      result.status !== "success"
    ) {

      console.error(
        "Transaction verification failed:",
        result
      );

      return {

        success: false

      };

    }


    return {

      success: true,

      data:
        result.data

    };

  } catch (error) {

    console.error(
      "Flutterwave verification error:",
      error
    );

    return {

      success: false

    };

  }

}


/* ========================================================
   FLUTTERWAVE WEBHOOK
======================================================== */

/*
 IMPORTANT:

 Flutterwave webhook requests need their original
 request body for secure signature checking.

 This route therefore uses express.raw().
*/

app.post(
  "/api/flutterwave-webhook",

  express.raw({
    type: "application/json"
  }),

  async (req, res) => {

    try {

      if (
        !FLW_SECRET_HASH
      ) {

        console.error(
          "FLW_SECRET_HASH is missing."
        );

        return res
          .status(500)
          .end();

      }


      const receivedHash =
        req.headers[
          "verif-hash"
        ];


      if (
        !receivedHash
      ) {

        return res
          .status(401)
          .end();

      }


      const expectedBuffer =
        Buffer.from(
          FLW_SECRET_HASH,
          "utf8"
        );


      const receivedBuffer =
        Buffer.from(
          String(
            receivedHash
          ),
          "utf8"
        );


      if (
        expectedBuffer.length !==
        receivedBuffer.length
      ) {

        return res
          .status(401)
          .end();

      }


      const validSignature =
        crypto.timingSafeEqual(
          expectedBuffer,
          receivedBuffer
        );


      if (
        !validSignature
      ) {

        return res
          .status(401)
          .end();

      }


      /* -----------------------------------------------
         PARSE WEBHOOK
      ------------------------------------------------ */

      const payload =
        JSON.parse(
          req.body.toString(
            "utf8"
          )
        );


      console.log(
        "Flutterwave webhook received."
      );


      /*
       Always respond quickly to the webhook.

       Transaction verification should be performed
       against Flutterwave rather than trusting the
       webhook payload by itself.
      */


      const transactionId =
        payload?.data?.id;


      const txRef =
        payload?.data?.tx_ref;


      if (
        transactionId &&
        txRef
      ) {

        const verification =
          await verifyFlutterwaveTransaction(
            transactionId
          );


        if (
          verification.success
        ) {

          const transaction =
            verification.data;


          if (
            transaction.status ===
            "successful" &&

            transaction.currency ===
            "USD" &&

            transaction.tx_ref ===
            txRef
          ) {

            const existing =
              loadJSONRecord(
                "card",
                txRef
              );


            const updated = {

              ...(existing || {}),

              txRef,

              transactionId,

              status:
                "paid",

              verifiedAmount:
                transaction.amount,

              verifiedCurrency:
                transaction.currency,

              verifiedAt:
                new Date().toISOString()

            };


            saveJSONRecord(
              "card",
              txRef,
              updated
            );


            console.log(
              "Payment verified:",
              txRef
            );

          }

        }

      }


      return res
        .status(200)
        .end();

    } catch (error) {

      console.error(
        "Webhook error:",
        error
      );

      return res
        .status(400)
        .end();

    }

  }
);


/* ========================================================
   ADMIN - VIEW TRANSFERS
======================================================== */

app.get(
  "/api/admin/transfers",
  (req, res) => {

    try {

      const suppliedKey =
        req.headers[
          "x-admin-key"
        ];


      if (
        !ADMIN_KEY ||
        !suppliedKey
      ) {

        return res.status(401).json({

          error:
            "Unauthorized."

        });

      }


      const provided =
        Buffer.from(
          String(
            suppliedKey
          )
        );


      const expected =
        Buffer.from(
          String(
            ADMIN_KEY
          )
        );


      if (
        provided.length !==
        expected.length ||
        !crypto.timingSafeEqual(
          provided,
          expected
        )
      ) {

        return res.status(401).json({

          error:
            "Unauthorized."

        });

      }


      const transferDirectory =
        path.join(
          DATA_DIR,
          "transfer"
        );


      if (
        !fs.existsSync(
          transferDirectory
        )
      ) {

        return res.json({

          success: true,

          count: 0,

          transfers: []

        });

      }


      const files =
        fs.readdirSync(
          transferDirectory
        );


      const transfers = [];


      for (
        const filename
        of files
      ) {

        if (
          !filename.endsWith(
            ".json"
          )
        ) {

          continue;

        }


        try {

          const data =
            JSON.parse(
              fs.readFileSync(
                path.join(
                  transferDirectory,
                  filename
                ),
                "utf8"
              )
            );


          transfers.push(
            data
          );

        } catch (error) {

          console.error(
            "Unable to read:",
            filename
          );

        }

      }


      return res.json({

        success: true,

        count:
          transfers.length,

        transfers

      });

    } catch (error) {

      console.error(
        "Admin error:",
        error
      );

      return res.status(500).json({

        error:
          "Unable to load transfers."

      });

    }

  }
);


/* ========================================================
   ADMIN - VIEW CARD PAYMENTS
======================================================== */

app.get(
  "/api/admin/payments",
  (req, res) => {

    try {

      const suppliedKey =
        req.headers[
          "x-admin-key"
        ];


      if (
        !ADMIN_KEY ||
        !suppliedKey
      ) {

        return res.status(401).json({

          error:
            "Unauthorized."

        });

      }


      const provided =
        Buffer.from(
          String(
            suppliedKey
          )
        );


      const expected =
        Buffer.from(
          String(
            ADMIN_KEY
          )
        );


      if (
        provided.length !==
        expected.length ||
        !crypto.timingSafeEqual(
          provided,
          expected
        )
      ) {

        return res.status(401).json({

          error:
            "Unauthorized."

        });

      }


      const cardDirectory =
        path.join(
          DATA_DIR,
          "card"
        );


      if (
        !fs.existsSync(
          cardDirectory
        )
      ) {

        return res.json({

          success: true,

          count: 0,

          payments: []

        });

      }


      const files =
        fs.readdirSync(
          cardDirectory
        );


      const payments = [];


      for (
        const filename
        of files
      ) {

        if (
          !filename.endsWith(
            ".json"
          )
        ) {

          continue;

        }


        try {

          const data =
            JSON.parse(
              fs.readFileSync(
                path.join(
                  cardDirectory,
                  filename
                ),
                "utf8"
              )
            );


          payments.push(
            data
          );

        } catch (error) {

          console.error(
            "Unable to read:",
            filename
          );

        }

      }


      return res.json({

        success: true,

        count:
          payments.length,

        payments

      });

    } catch (error) {

      console.error(
        "Admin payment error:",
        error
      );

      return res.status(500).json({

        error:
          "Unable to load payments."

      });

    }

  }
);


/* ========================================================
   GENERIC ERROR HANDLER
======================================================== */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {

    console.error(
      "SERVER ERROR:",
      error
    );


    if (
      error instanceof
      multer.MulterError
    ) {

      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {

        return res.status(400).json({

          error:
            "Receipt file is too large. Maximum size is 10 MB."

        });

      }


      return res.status(400).json({

        error:
          "File upload error."

      });

    }


    if (
      error.message &&
      error.message.includes(
        "Only JPG"
      )
    ) {

      return res.status(400).json({

        error:
          error.message

      });

    }


    return res.status(500).json({

      error:
        "Something went wrong on the payment server."

    });

  }
);


/* ========================================================
   FALLBACK
======================================================== */

app.use(
  (req, res) => {

    if (
      req.path.startsWith(
        "/api/"
      )
    ) {

      return res.status(404).json({

        error:
          "API endpoint not found."

      });

    }


    const indexPath =
      path.join(
        __dirname,
        "public",
        "index.html"
      );


    if (
      fs.existsSync(
        indexPath
      )
    ) {

      return res.sendFile(
        indexPath
      );

    }


    return res.status(404).send(
      "Frontend not found."
    );

  }
);


/* ========================================================
   STORAGE FUNCTIONS
======================================================== */

function saveJSONRecord(
  type,
  id,
  data
) {

  const directory =
    path.join(
      DATA_DIR,
      type
    );


  if (
    !fs.existsSync(
      directory
    )
  ) {

    fs.mkdirSync(
      directory,
      {
        recursive: true
      }
    );

  }


  const filename =
    path.join(
      directory,
      `${id}.json`
    );


  fs.writeFileSync(
    filename,
    JSON.stringify(
      data,
      null,
      2
    ),
    "utf8"
  );

}


function loadJSONRecord(
  type,
  id
) {

  try {

    const filename =
      path.join(
        DATA_DIR,
        type,
        `${id}.json`
      );


    if (
      !fs.existsSync(
        filename
      )
    ) {

      return null;

    }


    return JSON.parse(
      fs.readFileSync(
        filename,
        "utf8"
      )
    );

  } catch (error) {

    console.error(
      "Unable to load record:",
      error
    );

    return null;

  }

}


function removeUploadedFile(
  file
) {

  if (
    !file ||
    !file.path
  ) {

    return;

  }


  try {

    if (
      fs.existsSync(
        file.path
      )
    ) {

      fs.unlinkSync(
        file.path
      );

    }

  } catch (error) {

    console.error(
      "Unable to remove upload:",
      error
    );

  }

}


/* ========================================================
   HTML HELPERS
======================================================== */

function escapeHTML(
  value
) {

  return String(
    value
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


function paymentPage(
  title,
  message
) {

  return `
<!DOCTYPE html>

<html lang="en">

<head>

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>
    ${escapeHTML(title)}
  </title>

  <style>

    * {
      box-sizing: border-box;
    }

    body {

      margin: 0;

      min-height: 100vh;

      display: flex;

      align-items: center;

      justify-content: center;

      padding: 20px;

      font-family:
        Arial,
        sans-serif;

      background:
        linear-gradient(
          135deg,
          #eef4ff,
          #edf0ff
        );

    }

    .box {

      width: 100%;

      max-width: 520px;

      background: white;

      border-radius: 18px;

      padding: 32px;

      text-align: center;

      box-shadow:
        0 16px 40px
        rgba(
          0,
          0,
          0,
          0.08
        );

    }

    h1 {

      color:
        #1d2b3a;

    }

    p {

      color:
        #65758a;

      line-height:
        1.6;

    }

    .message {

      background:
        #f7f9fc;

      border-radius:
        10px;

      padding:
        16px;

      line-height:
        1.6;

    }

  </style>

</head>

<body>

  <div class="box">

    <h1>
      ${escapeHTML(title)}
    </h1>

    <div class="message">
      ${message}
    </div>

  </div>

</body>

</html>
`;

}


/* ========================================================
   START SERVER
======================================================== */

app.listen(
  PORT,
  () => {

    console.log("");
    console.log(
      "======================================"
    );

    console.log(
      " USD PAYMENT SERVER"
    );

    console.log(
      "======================================"
    );

    console.log(
      `Server:
      ${BASE_URL}`
    );

    console.log(
      `Maximum individual payment:
      $${MAX_INDIVIDUAL_PAYMENT.toFixed(2)}`
    );

    console.log(
      "======================================"
    );

  }
);