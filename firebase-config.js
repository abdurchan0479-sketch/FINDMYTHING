/**
 * FINDMYTHING - Firebase Configuration & Initialization
 * 
 * Modular Firebase JavaScript SDK (v11) Configuration
 * Replace the placeholder values below with your actual project credentials from the Firebase Console.
 * 
 * To get your credentials:
 * 1. Go to https://console.firebase.google.com/
 * 2. Select or create your project.
 * 3. Go to Project Settings > General > "Your apps" > Add Web App (</> icon).
 * 4. Copy the firebaseConfig object into this file.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js';
import { getAuth, setPersistence, browserSessionPersistence } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js';

// --- YOUR FIREBASE CONFIGURATION ---
// Insert your actual Firebase project credentials here:
export const firebaseConfig = {
  apiKey: "AIzaSyBkGg03v6w1bENrr3mm9NtESs7l3FR0KnE",
  authDomain: "findmything-687b8.firebaseapp.com",
  projectId: "findmything-687b8",
  storageBucket: "findmything-687b8.firebasestorage.app",
  messagingSenderId: "737569202041",
  appId: "1:737569202041:web:9a9d837fa590d07642d9a8",
  measurementId: "G-PHZK40P6SH"
};

/**
 * Validates whether the user has supplied real Firebase credentials
 * rather than placeholder strings.
 */
export function isFirebaseConfigured() {
  return (
    Boolean(firebaseConfig) &&
    typeof firebaseConfig.apiKey === 'string' &&
    firebaseConfig.apiKey.trim() !== '' &&
    firebaseConfig.apiKey !== 'YOUR_API_KEY' &&
    firebaseConfig.projectId !== 'YOUR_PROJECT_ID' &&
    !firebaseConfig.apiKey.includes('YOUR_')
  );
}

// Initialize Firebase services conditionally (Auth & Firestore only)
let app = null;
let auth = null;
let db = null;


if (isFirebaseConfigured()) {
  try {
    app = initializeApp(firebaseConfig);

    // Initialize Firebase Authentication
    auth = getAuth(app);

    // Initialize Firestore
    db = getFirestore(app);

    console.info(
      '[FINDMYTHING] Firebase initialized successfully with project:',
      firebaseConfig.projectId
    );
  } catch (err) {
    console.error('[FINDMYTHING] Failed to initialize Firebase:', err);
  }
} else {
  console.warn(
    '[FINDMYTHING] Firebase is not yet configured. Running in local fallback mode.'
  );
}

// Set session persistence before authentication operations
export const authReady = auth
  ? setPersistence(auth, browserSessionPersistence)
  : Promise.resolve();

export { app, auth, db };
