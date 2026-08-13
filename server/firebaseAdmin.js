// Verifies Firebase phone-auth ID tokens sent up from the client after a successful
// OTP verification. This never sends OTPs itself — Firebase's client SDK handles that
// (see client/src/firebase.js) — this just confirms the token the client got back is
// genuinely signed by Firebase before we trust the phone number inside it.
//
// Needs a Firebase service account (Project settings → Service accounts → Generate new
// private key in the Firebase console) supplied as one JSON blob in the
// FIREBASE_SERVICE_ACCOUNT env var. Never commit that file — env var only.
import admin from "firebase-admin";

let app = null;

function getFirebaseAdminApp() {
  if (app) return app;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT env var is not set — OTP login/register is unavailable until it is."
    );
  }
  const serviceAccount = JSON.parse(raw);
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  return app;
}

// Returns the verified phone number (E.164, e.g. "+919876543210") from a Firebase
// phone-auth ID token, or throws if the token is invalid/expired/not a phone-auth token.
export async function verifyOtpIdToken(idToken) {
  const decoded = await admin.auth(getFirebaseAdminApp()).verifyIdToken(idToken);
  if (!decoded.phone_number) {
    throw new Error("This sign-in token isn't a verified phone number.");
  }
  return decoded.phone_number;
}
