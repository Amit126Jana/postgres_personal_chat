// Firebase is used client-side only, for phone-number OTP verification
// (RecaptchaVerifier + signInWithPhoneNumber). It never talks to our own server —
// once a code is verified, we send the resulting Firebase ID token to
// /api/auth/otp, which checks it with firebase-admin and issues our own app JWT.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBR3BulVmw-0oZ5MXVGYNAJvnpNNnjv7xc",
  authDomain: "makefriends-c8f18.firebaseapp.com",
  projectId: "makefriends-c8f18",
  storageBucket: "makefriends-c8f18.firebasestorage.app",
  messagingSenderId: "64384501797",
  appId: "1:64384501797:web:25d75c0f3dc6d2f4dcd7cc",
  measurementId: "G-5NNGLWNWRT",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
