// Sends and checks phone-number OTPs using Twilio Verify. Replaces Firebase phone
// auth: the client no longer talks to any auth provider directly — it just calls
// our /api/auth/otp/send and /api/auth/otp/verify endpoints below, and we do the
// SMS send + code check server-side via Twilio.
//
// Needs three env vars, all from the Twilio Console (never commit these):
//   TWILIO_ACCOUNT_SID        Console → Account → Account SID (starts "AC...")
//   TWILIO_API_KEY_SID        Console → Account → API keys & tokens (starts "SK...")
//   TWILIO_API_KEY_SECRET     shown once when you create that API key
//   TWILIO_VERIFY_SERVICE_SID Console → Verify → Services (starts "VA...")
import twilio from "twilio";

let client = null;
let verifyServiceSid = null;

function getClient() {
  if (client) return client;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !apiKeySid || !apiKeySecret || !verifyServiceSid) {
    throw new Error(
      "Twilio env vars missing — need TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, " +
        "TWILIO_API_KEY_SECRET, TWILIO_VERIFY_SERVICE_SID. OTP login/register is unavailable until set."
    );
  }

  // API Key auth (recommended over the raw Auth Token): apiKeySid/secret authenticate
  // the request, accountSid says which account they act on.
  client = twilio(apiKeySid, apiKeySecret, { accountSid });
  return client;
}

// Kicks off an OTP SMS to `phone` (E.164, e.g. "+919876543210").
export async function sendOtp(phone) {
  const c = getClient();
  await c.verify.v2.services(verifyServiceSid).verifications.create({
    to: phone,
    channel: "sms",
  });
}

// Checks the 6-digit code the user entered. Returns true/false — never throws for
// a merely-wrong code, only for real errors (bad phone format, Twilio outage, etc).
export async function checkOtp(phone, code) {
  const c = getClient();
  const result = await c.verify.v2
    .services(verifyServiceSid)
    .verificationChecks.create({ to: phone, code });
  return result.status === "approved";
}
