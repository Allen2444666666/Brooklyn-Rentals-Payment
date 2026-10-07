<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>Secure USD Payment</title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: linear-gradient(135deg, #eef4ff, #edf0ff);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .page {
      width: 100%;
      max-width: 560px;
    }

    .checkout-card {
      background: #ffffff;
      border-radius: 18px;
      padding: 28px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.08);
    }

    .secure-badge {
      display: inline-block;
      background: #ebf9ef;
      color: #175f35;
      padding: 7px 12px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 700;
      margin-bottom: 18px;
    }

    .header h1 {
      margin: 0;
      font-size: 2rem;
      color: #1d2b3a;
    }

    .header p {
      margin: 8px 0 22px;
      color: #65758a;
    }

    .summary {
      background: #f7f9fc;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      gap: 15px;
      margin-bottom: 8px;
    }

    .summary-row:last-child {
      margin-bottom: 0;
    }

    .summary-row strong {
      text-align: right;
    }

    .field {
      margin-bottom: 18px;
    }

    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 600;
      color: #2b3b4d;
    }

    input {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid #dfe7f1;
      border-radius: 10px;
      font-size: 1rem;
      outline: none;
    }

    input:focus {
      border-color: #5a7cff;
    }

    input[type="file"] {
      background: #ffffff;
      padding: 10px;
    }

    .toggle {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .method-btn {
      padding: 12px 14px;
      border-radius: 10px;
      border: 1px solid #dfe7ff;
      background: #edf2ff;
      font-weight: 600;
      cursor: pointer;
      color: #2c3e50;
    }

    .method-btn.active {
      background: #3f66ff;
      border-color: #3f66ff;
      color: #ffffff;
    }

    .payment-panel {
      margin-top: 8px;
    }

    .card-info {
      background: #f7f9fc;
      border: 1px solid #e6edf6;
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 18px;
      color: #536579;
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .accepted-cards {
      display: flex;
      gap: 10px;
      margin: 12px 0;
      flex-wrap: wrap;
    }

    .card-badge {
      background: #ffffff;
      border: 1px solid #dfe7f1;
      border-radius: 8px;
      padding: 8px 16px;
      font-weight: 700;
      color: #1d2b3a;
    }

    .visa-badge {
      border-color: #3157d5;
      color: #3157d5;
    }

    .verve-badge {
      border-color: #1d5e35;
      color: #1d5e35;
    }

    .bank-box {
      background: #f7f9fc;
      border: 1px solid #e6edf6;
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 18px;
    }

    .bank-box h3 {
      margin-top: 0;
      margin-bottom: 12px;
      color: #1d2b3a;
    }

    .bank-row {
      display: flex;
      justify-content: space-between;
      gap: 15px;
      padding: 9px 0;
      border-bottom: 1px solid #e6edf6;
    }

    .bank-row:last-child {
      border-bottom: none;
    }

    .bank-row span:first-child {
      color: #65758a;
    }

    .bank-row strong {
      text-align: right;
      word-break: break-word;
    }

    .copy-btn {
      margin-top: 12px;
      width: 100%;
      padding: 10px;
      border: none;
      border-radius: 8px;
      background: #e8edff;
      color: #3157d5;
      font-weight: 600;
      cursor: pointer;
    }

    .copy-btn:hover {
      background: #dce4ff;
    }

    .upload-box {
      border: 2px dashed #cbd6e5;
      border-radius: 10px;
      padding: 14px;
      background: #fafcff;
    }

    .upload-help {
      display: block;
      margin-top: 8px;
      color: #65758a;
      font-size: 0.85rem;
      line-height: 1.4;
    }

    .file-name {
      display: none;
      margin-top: 8px;
      color: #175f35;
      font-size: 0.88rem;
      font-weight: 600;
    }

    .limit-note {
      background: #fff8e6;
      border: 1px solid #f0d58a;
      color: #735700;
      padding: 12px;
      border-radius: 10px;
      margin-top: 10px;
      font-size: 0.85rem;
      line-height: 1.4;
    }

    .pay-btn {
      width: 100%;
      border: none;
      border-radius: 12px;
      padding: 15px 16px;
      font-size: 1rem;
      font-weight: 700;
      background: linear-gradient(135deg, #2b5cff, #4b7af9);
      color: #ffffff;
      cursor: pointer;
      transition: opacity 0.2s ease;
    }

    .pay-btn:hover:not(:disabled) {
      opacity: 0.9;
    }

    .pay-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .status-message {
      margin-top: 18px;
      border-radius: 10px;
      padding: 14px 16px;
      font-weight: 600;
      display: none;
      line-height: 1.5;
    }

    .status-success {
      background: #ebf9ef;
      border: 1px solid #bee5c6;
      color: #175f35;
    }

    .status-error {
      background: #fff0f0;
      border: 1px solid #f1bcbc;
      color: #a32020;
    }

    .footer-note {
      text-align: center;
      margin-top: 18px;
      color: #7a8899;
      font-size: 0.82rem;
      line-height: 1.5;
    }

    @media (max-width: 480px) {
      .checkout-card {
        padding: 20px;
      }

      .toggle {
        grid-template-columns: 1fr;
      }

      .bank-row {
        flex-direction: column;
        gap: 3px;
      }

      .bank-row strong {
        text-align: left;
      }
    }
  </style>
</head>

<body>

  <div class="page">

    <div class="checkout-card">

      <div class="secure-badge">
        🔒 Secure Checkout
      </div>

      <div class="header">
        <h1>Secure Payment</h1>
        <p>Complete your payment in USD.</p>
      </div>

      <!-- PAYMENT SUMMARY -->
      <div class="summary">

        <div class="summary-row">
          <span>Item</span>
          <strong>Premium Service</strong>
        </div>

        <div class="summary-row">
          <span>Currency</span>
          <strong>USD ($)</strong>
        </div>

        <div class="summary-row">
          <span>Amount</span>
          <strong id="amountDisplay">$100.00</strong>
        </div>

      </div>


      <!-- PAYMENT FORM -->
      <form
        id="paymentForm"
        enctype="multipart/form-data"
      >

        <!-- FULL NAME -->
        <div class="field">

          <label for="fullName">
            Full Name
          </label>

          <input
            type="text"
            id="fullName"
            name="fullName"
            placeholder="Enter your full name"
            required
          />

        </div>


        <!-- EMAIL -->
        <div class="field">

          <label for="email">
            Email Address
          </label>

          <input
            type="email"
            id="email"
            name="email"
            placeholder="you@example.com"
            required
          />

        </div>


        <!-- AMOUNT -->
        <div class="field">

          <label for="amount">
            Amount (USD)
          </label>

          <input
            type="number"
            id="amount"
            name="amount"
            min="1"
            max="3999.99"
            step="0.01"
            value="0"
            required
          />

          <div class="limit-note">
            💵 Individual customer payments are limited
            to <strong>$3,999.99</strong> per payment.
          </div>

        </div>


        <!-- PAYMENT METHOD -->
        <div class="field">

          <label>
            Payment Method
          </label>

          <div class="toggle">

            <button
              type="button"
              class="method-btn active"
              data-method="card"
            >
              💳 Card Payment
            </button>

            <button
              type="button"
              class="method-btn"
              data-method="bank"
            >
              🏦 Bank Transfer
            </button>

          </div>

        </div>


        <!-- CARD PAYMENT -->
        <div
          id="cardFields"
          class="payment-panel"
        >

          <div class="card-info">

            <strong>
              💳 Card Payment
            </strong>

            <br><br>

            <strong>
              Accepted Cards:
            </strong>

            <div class="accepted-cards">

              <span class="card-badge visa-badge">
                VISA
              </span>

              <span class="card-badge verve-badge">
                VERVE
              </span>

            </div>

            Only <strong>Visa</strong> and
            <strong>Verve</strong> cards are accepted
            for card payments.

            <br><br>

            Click the payment button below to continue
            to the secure card-payment page.

            <br><br>

            Your card number, CVV, PIN and OTP are
            handled by the secure payment processor,
            not stored by this website.

          </div>

        </div>


        <!-- BANK TRANSFER -->
        <div
          id="bankFields"
          class="payment-panel"
          style="display:none;"
        >

          <div class="bank-box">

            <h3>
              Your USD Account Details
            </h3>


            <div class="bank-row">

              <span>
                Bank Name
              </span>

              <strong>
                Lead
              </strong>

            </div>


            <div class="bank-row">

              <span>
                Account Number
              </span>

              <strong id="accountNumber">
                210599253695
              </strong>

            </div>


            <div class="bank-row">

              <span>
                ACH Routing
              </span>

              <strong>
                101019644
              </strong>

            </div>


            <div class="bank-row">

              <span>
                Wire Routing
              </span>

              <strong>
                101019644
              </strong>

            </div>


            <div class="bank-row">

              <span>
                Account Type
              </span>

              <strong>
                Checking
              </strong>

            </div>


            <div class="bank-row">

              <span>
                Bank Address
              </span>

              <strong>
                1801 Main St., Kansas City, MO 64108
              </strong>

            </div>


            <button
              type="button"
              class="copy-btn"
              id="copyAccount"
            >
              Copy Account Number
            </button>

          </div>


          <!-- TRANSFER REFERENCE -->
          <div class="field">

            <label for="transferReference">
              Transfer Reference
            </label>

            <input
              type="text"
              id="transferReference"
              name="transferReference"
              placeholder="Enter your transfer reference"
              required
            />

          </div>


          <!-- PAYMENT SCREENSHOT -->
          <div class="field">

            <label for="paymentScreenshot">
              Payment Screenshot / Receipt
            </label>

            <div class="upload-box">

              <input
                type="file"
                id="paymentScreenshot"
                name="paymentScreenshot"
                accept=".jpg,.jpeg,.png,.pdf"
                required
              />

              <span class="upload-help">
                Upload a screenshot or receipt showing
                that the USD transfer was completed.
                Accepted formats: JPG, JPEG, PNG or PDF.
                Maximum size: 10 MB.
              </span>

              <span
                id="fileName"
                class="file-name"
              ></span>

            </div>

          </div>

        </div>


        <!-- SUBMIT BUTTON -->
        <button
          type="submit"
          class="pay-btn"
          id="payBtn"
        >
          Pay $0.00
        </button>

      </form>


      <!-- STATUS -->
      <div
        id="statusMessage"
        class="status-message"
      ></div>


      <div class="footer-note">
        Payments are processed securely.
        Never share your card PIN, password or OTP.
      </div>

    </div>

  </div>


  <script>

    /* =========================
       ELEMENTS
    ========================== */

    const paymentForm =
      document.getElementById("paymentForm");

    const cardFields =
      document.getElementById("cardFields");

    const bankFields =
      document.getElementById("bankFields");

    const amountInput =
      document.getElementById("amount");

    const amountDisplay =
      document.getElementById("amountDisplay");

    const payBtn =
      document.getElementById("payBtn");

    const statusMessage =
      document.getElementById("statusMessage");

    const methodButtons =
      document.querySelectorAll(".method-btn");

    const transferReference =
      document.getElementById("transferReference");

    const paymentScreenshot =
      document.getElementById("paymentScreenshot");

    const fileName =
      document.getElementById("fileName");


    /* =========================
       PAYMENT LIMIT
    ========================== */

    const MAX_INDIVIDUAL_PAYMENT =
      3999.99;


    /* =========================
       SELECTED PAYMENT METHOD
    ========================== */

    let selectedMethod = "card";


    /* =========================
       FORMAT USD
    ========================== */

    function formatUSD(amount) {

      return Number(amount || 0).toLocaleString(
        "en-US",
        {
          style: "currency",
          currency: "USD"
        }
      );

    }


    /* =========================
       UPDATE AMOUNT DISPLAY
    ========================== */

    function updateAmountDisplay() {

      const amount =
        Number(amountInput.value || 0);

      amountDisplay.textContent =
        formatUSD(amount);

      if (selectedMethod === "card") {

        payBtn.textContent =
          `Pay ${formatUSD(amount)}`;

      } else {

        payBtn.textContent =
          "Submit Transfer for Verification";

      }

    }


    /* =========================
       PAYMENT METHOD
    ========================== */

    function setPaymentMethod(method) {

      selectedMethod = method;

      methodButtons.forEach((button) => {

        button.classList.toggle(
          "active",
          button.dataset.method === method
        );

      });


      if (method === "card") {

        cardFields.style.display =
          "block";

        bankFields.style.display =
          "none";

        transferReference.required =
          false;

        paymentScreenshot.required =
          false;

      } else {

        cardFields.style.display =
          "none";

        bankFields.style.display =
          "block";

        transferReference.required =
          true;

        paymentScreenshot.required =
          true;

      }

      updateAmountDisplay();

    }


    /* =========================
       STATUS MESSAGE
    ========================== */

    function showStatus(message, type) {

      statusMessage.textContent =
        message;

      statusMessage.className =
        `status-message status-${type}`;

      statusMessage.style.display =
        "block";

    }


    function hideStatus() {

      statusMessage.style.display =
        "none";

    }


    /* =========================
       COPY ACCOUNT NUMBER
    ========================== */

    document
      .getElementById("copyAccount")
      .addEventListener(
        "click",
        async () => {

          const accountNumber =
            document
              .getElementById("accountNumber")
              .textContent
              .trim();

          try {

            await navigator.clipboard.writeText(
              accountNumber
            );

            showStatus(
              "Account number copied successfully.",
              "success"
            );

          } catch (error) {

            showStatus(
              "Unable to copy the account number.",
              "error"
            );

          }

        }
      );


    /* =========================
       FILE SELECTION
    ========================== */

    paymentScreenshot.addEventListener(
      "change",
      () => {

        const file =
          paymentScreenshot.files[0];

        if (!file) {

          fileName.style.display =
            "none";

          fileName.textContent =
            "";

          return;

        }

        fileName.textContent =
          `Selected file: ${file.name}`;

        fileName.style.display =
          "block";

      }
    );


    /* =========================
       AMOUNT LISTENER
    ========================== */

    amountInput.addEventListener(
      "input",
      () => {

        let amount =
          Number(amountInput.value);

        /*
         * Prevent frontend input
         * from exceeding $3,999.99.
         */

        if (amount > MAX_INDIVIDUAL_PAYMENT) {

          amountInput.value =
            MAX_INDIVIDUAL_PAYMENT;

        }

        updateAmountDisplay();

      }
    );


    /* =========================
       PAYMENT METHOD BUTTONS
    ========================== */

    methodButtons.forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          hideStatus();

          setPaymentMethod(
            button.dataset.method
          );

        }
      );

    });


    /* =========================
       FORM SUBMISSION
    ========================== */

    paymentForm.addEventListener(
      "submit",
      async (event) => {

        event.preventDefault();

        hideStatus();


        /* =========================
           GET CUSTOMER INFORMATION
        ========================== */

        const fullName =
          document
            .getElementById("fullName")
            .value
            .trim();

        const email =
          document
            .getElementById("email")
            .value
            .trim();

        const amount =
          Number(amountInput.value);


        /* =========================
           BASIC VALIDATION
        ========================== */

        if (
          !fullName ||
          !email ||
          !amount ||
          amount <= 0
        ) {

          showStatus(
            "Please complete all required fields.",
            "error"
          );

          return;

        }


        /* =========================
           INDIVIDUAL PAYMENT LIMIT
        ========================== */

        if (
          amount >
          MAX_INDIVIDUAL_PAYMENT
        ) {

          showStatus(
            "Individual payments are limited to $3,999.99. Please enter a lower amount.",
            "error"
          );

          return;

        }


        /* =========================
           CARD PAYMENT
        ========================== */

        if (selectedMethod === "card") {

          payBtn.disabled =
            true;

          payBtn.textContent =
            "Connecting to secure payment...";


          try {

            const response =
              await fetch(
                "/api/create-checkout",
                {
                  method: "POST",

                  headers: {
                    "Content-Type":
                      "application/json"
                  },

                  body: JSON.stringify({

                    fullName:
                      fullName,

                    email:
                      email,

                    amount:
                      amount,

                    description:
                      "Premium Service",

                    allowedCards: [
                      "visa",
                      "verve"
                    ]

                  })

                }
              );


            const result =
              await response.json();


            if (!response.ok) {

              throw new Error(
                result.error ||
                "Unable to start payment."
              );

            }


            if (result.checkoutUrl) {

              window.location.href =
                result.checkoutUrl;

              return;

            }


            throw new Error(
              "Payment session was not created."
            );


          } catch (error) {

            showStatus(
              error.message ||
              "Unable to connect to the payment server.",
              "error"
            );

            payBtn.disabled =
              false;

            updateAmountDisplay();

          }

          return;

        }


        /* =========================
           BANK TRANSFER
        ========================== */

        if (selectedMethod === "bank") {

          const reference =
            transferReference
              .value
              .trim();

          const screenshot =
            paymentScreenshot
              .files[0];


          /* =========================
             TRANSFER REFERENCE
          ========================== */

          if (!reference) {

            showStatus(
              "Please enter your transfer reference.",
              "error"
            );

            return;

          }


          /* =========================
             SCREENSHOT
          ========================== */

          if (!screenshot) {

            showStatus(
              "Please upload your payment screenshot or receipt.",
              "error"
            );

            return;

          }


          /* =========================
             ALLOWED FILE TYPES
          ========================== */

          const allowedTypes = [
            "image/jpeg",
            "image/png",
            "application/pdf"
          ];


          if (
            !allowedTypes.includes(
              screenshot.type
            )
          ) {

            showStatus(
              "Please upload a JPG, PNG or PDF file.",
              "error"
            );

            return;

          }


          /* =========================
             10 MB FILE LIMIT
          ========================== */

          const maxSize =
            10 * 1024 * 1024;


          if (
            screenshot.size >
            maxSize
          ) {

            showStatus(
              "The payment screenshot must be 10 MB or smaller.",
              "error"
            );

            return;

          }


          /* =========================
             SUBMIT TRANSFER
          ========================== */

          payBtn.disabled =
            true;

          payBtn.textContent =
            "Submitting for verification...";


          try {

            const formData =
              new FormData();


            formData.append(
              "fullName",
              fullName
            );


            formData.append(
              "email",
              email
            );


            formData.append(
              "amount",
              amount
            );


            formData.append(
              "transferReference",
              reference
            );


            formData.append(
              "paymentScreenshot",
              screenshot
            );


            const response =
              await fetch(
                "/api/create-transfer",
                {
                  method: "POST",
                  body: formData
                }
              );


            const result =
              await response.json();


            if (!response.ok) {

              throw new Error(
                result.error ||
                "Unable to submit transfer."
              );

            }


            showStatus(
              result.message ||
              "Transfer submitted successfully. Your payment will be verified.",
              "success"
            );


            /* =========================
               RESET FORM
            ========================== */

            paymentForm.reset();

            amountInput.value =
              100;

            setPaymentMethod(
              "card"
            );

            fileName.style.display =
              "none";

            fileName.textContent =
              "";


          } catch (error) {

            showStatus(
              error.message ||
              "Unable to connect to the payment server.",
              "error"
            );

          }


          payBtn.disabled =
            false;

          updateAmountDisplay();

        }

      }
    );


    /* =========================
       INITIALIZE
    ========================== */

    setPaymentMethod("card");

    updateAmountDisplay();

  </script>

</body>
</html>
