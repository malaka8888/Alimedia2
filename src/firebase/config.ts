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

// Initialize Firestore using standard getFirestore or fallback to guarantee it is initialized exactly once.
// Do NOT force long-polling by default in all environments since it can cause 60-second gateway timeouts on hosting providers like Vercel.
let dbInstance;
try {
  if (dbId) {
    dbInstance = getFirestore(app, dbId);
  } else {
    dbInstance = getFirestore(app);
  }
} catch (e) {
  console.warn('Standard getFirestore failed or already initialized, attempting alternative init:', e);
  try {
    if (dbId) {
      dbInstance = initializeFirestore(app, {}, dbId);
    } else {
      dbInstance = initializeFirestore(app, {});
    }
  } catch (innerErr) {
    console.error('Fatal Firestore initialization error:', innerErr);
    dbInstance = getFirestore(app);
  }
}

export const db = dbInstance;
export const auth = getAuth(app);
export default app;
