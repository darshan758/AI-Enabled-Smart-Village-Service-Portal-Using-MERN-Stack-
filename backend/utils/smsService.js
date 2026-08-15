const https = require("https");

// =========================
// TWILIO SETUP
// =========================

let twilioClient = null;

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
} = process.env;

const twilioReady =
  TWILIO_ACCOUNT_SID &&
  TWILIO_AUTH_TOKEN &&
  TWILIO_PHONE_NUMBER &&
  TWILIO_ACCOUNT_SID !== "ACc1ad990858fe805a76115fd4f5203c16";

if (twilioReady && process.env.USE_FAST2SMS !== "true") {
  try {
    const twilio = require("twilio");

    twilioClient = twilio(
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN
    );

    console.log("[SMS] Twilio connected");
  } catch {
    console.warn(
      "[SMS] Install Twilio → npm install twilio"
    );
  }
}

// =========================
// FAST2SMS SETUP
// =========================

const fast2smsReady =
  process.env.USE_FAST2SMS === "true" &&
  !!process.env.FAST2SMS_API_KEY;

// =========================
// PHONE FORMAT
// =========================

const formatPhone = (phone) => {
  if (!phone) return null;

  const digits = String(phone)
    .replace(/\D/g, "");

  if (digits.length === 10)
    return `+91${digits}`;

  if (
    digits.length === 12 &&
    digits.startsWith("91")
  )
    return `+${digits}`;

  if (phone.startsWith("+"))
    return phone;

  return null;
};

// =========================
// FAST2SMS SEND
// =========================

const sendViaFast2SMS = (
  to,
  message
) =>
  new Promise((resolve, reject) => {
    const digits = to
      .replace(/\D/g, "")
      .replace(/^91/, "");

    const body = JSON.stringify({
      route: "q",
      language: "english",
      flash: 0,
      numbers: digits,
      message,
    });

    const options = {
      hostname: "www.fast2sms.com",
      path: "/dev/bulkV2",
      method: "POST",

      headers: {
        authorization:
          process.env.FAST2SMS_API_KEY,

        "Content-Type":
          "application/json",
      },
    };

    const req = https.request(
      options,
      (res) => {
        let data = "";

        res.on(
          "data",
          (chunk) =>
            (data += chunk)
        );

        res.on(
          "end",
          () => {
            try {
              const parsed =
                JSON.parse(
                  data
                );

              if (
                parsed.return
              )
                resolve();
              else
                reject(
                  new Error(
                    parsed.message
                  )
                );
            } catch (e) {
              reject(e);
            }
          }
        );
      }
    );

    req.on(
      "error",
      reject
    );

    req.write(body);

    req.end();
  });

// =========================
// MAIN SMS FUNCTION
// =========================

const sendSMS = async (
  phone,
  message
) => {
  const formatted =
    formatPhone(phone);

  if (!formatted) {
    console.warn(
      "[SMS] Invalid phone:",
      phone
    );

    return;
  }

  if (fast2smsReady) {
    try {
      await sendViaFast2SMS(
        formatted,
        message
      );

      console.log(
        "[SMS] Fast2SMS sent"
      );
    } catch (err) {
      console.error(
        "[SMS]",
        err.message
      );
    }

    return;
  }

  if (twilioClient) {
    try {
      const result =
        await twilioClient.messages.create(
          {
            body: message,

            from:
              TWILIO_PHONE_NUMBER,

            to: formatted,
          }
        );

      console.log(
        "[SMS] Sent:",
        result.sid
      );
    } catch (err) {
      console.error(
        "[SMS ERROR]",
        err.message
      );
    }

    return;
  }

  console.warn(
    "[SMS] No provider configured"
  );
};

module.exports = sendSMS;