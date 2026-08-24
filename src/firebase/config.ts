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

// Initialize Firestore with experimentalForceLongPolling enabled by default to prevent gRPC / WebSocket connection drops in Sri Lanka (e.g. Dialog/Mobitel)
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
  console.warn('Standard initializeFirestore with long polling failed or already initialized, attempting fallback:', e);
  try {
    if (dbId) {
      dbInstance = getFirestore(app, dbId);
    } else {
      dbInstance = getFirestore(app);
    }
  } catch (innerErr) {
    console.error('Fatal Firestore initialization error:', innerErr);
    dbInstance = getFirestore(app);
  }
}

export const db = dbInstance;
export const auth = getAuth(app);
export default app;
