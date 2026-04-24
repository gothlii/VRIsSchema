import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

function valueOrFallback(value: string | undefined, fallback: string) {
  return value && value.trim().length > 0 ? value : fallback;
}

const firebaseConfig = {
  apiKey: valueOrFallback(import.meta.env.VITE_FIREBASE_API_KEY, "AIzaSyDPiUeOotJpW_NImkrW_aRLEdnzIpVoAOI"),
  authDomain: valueOrFallback(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, "vrisschema.firebaseapp.com"),
  projectId: valueOrFallback(import.meta.env.VITE_FIREBASE_PROJECT_ID, "vrisschema"),
  storageBucket: valueOrFallback(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, "vrisschema.firebasestorage.app"),
  messagingSenderId: valueOrFallback(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, "115114233233"),
  appId: valueOrFallback(import.meta.env.VITE_FIREBASE_APP_ID, "1:115114233233:web:11fd61460e2c92811b9e30"),
  measurementId: valueOrFallback(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID, "G-G9DYNJL2DS"),
};

export const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean);

const app = hasFirebaseConfig ? initializeApp(firebaseConfig) : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
