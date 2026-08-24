import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfigData from '../../firebase-applet-config.json';

const firebaseConfig = {
  projectId: firebaseConfigData.projectId || 'jumping-quota-nxctm',
  appId: firebaseConfigData.appId,
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  firestoreDatabaseId: firebaseConfigData.firestoreDatabaseId || '(default)',
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? firebaseConfig.firestoreDatabaseId
  : undefined;

// Use initializeFirestore with experimentalForceLongPolling to support mobile networks in Sri Lanka (e.g. Dialog/Mobitel)
// that throttle or drop long-lived WebSocket/gRPC streams, preventing infinite loading.
// Wrap in try-catch with getFirestore fallback to guarantee it is initialized exactly once even during reload/evaluation.
let dbInstance;
try {
  if (dbId) {
    dbInstance = initializeFirestore(app, {
      experimentalForceLongPolling: true,
    }, dbId);
  } else {
    dbInstance = initializeFirestore(app, {
      experimentalForceLongPolling: true,
    });
  }
} catch (e) {
  try {
    if (dbId) {
      dbInstance = getFirestore(app, dbId);
    } else {
      dbInstance = getFirestore(app);
    }
  } catch (innerErr) {
    console.error('Fatal Firestore initialization error:', innerErr);
    // Ultimate fallback to getFirestore
    dbInstance = getFirestore(app);
  }
}

export const db = dbInstance;
export const auth = getAuth(app);
export default app;
