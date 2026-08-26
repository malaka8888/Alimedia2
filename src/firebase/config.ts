import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import firebaseConfigData from '../../firebase-applet-config.json';

const firebaseConfig = {
  projectId: firebaseConfigData.projectId || 'elephant-sl',
  appId: firebaseConfigData.appId,
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  firestoreDatabaseId: firebaseConfigData.firestoreDatabaseId || '(default)',
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const dbId =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? firebaseConfig.firestoreDatabaseId
    : undefined;

let dbInstance;
try {
  const options = {
    experimentalForceLongPolling: true,
  };
  dbInstance = dbId ? initializeFirestore(app, options, dbId) : initializeFirestore(app, options);
} catch (e) {
  try {
    dbInstance = dbId ? getFirestore(app, dbId) : getFirestore(app);
  } catch (innerErr) {
    console.warn('Fallback getFirestore initialization used:', innerErr);
    dbInstance = getFirestore(app);
  }
}

export const db = dbInstance;
export const auth = getAuth(app);

// Ensure every visitor has a Firebase Auth identity, even if they never sign in
// with Google. Some Firestore Security Rule setups (including ones deployed
// later, or on a different project than the bundled firestore.rules file)
// require `request.auth != null` before allowing writes. Without this, Admin
// actions like Add/Edit/Delete can fail with a silent "permission-denied"
// error while reads (which are usually public) keep working fine - which is
// exactly the "reads work, writes don't" symptom this app has shown.
// This is safe to run even when rules are fully public, and it never
// interferes with a real Google sign-in (onAuthStateChanged simply stops
// firing for the anonymous session once a real user signs in).
onAuthStateChanged(auth, (user) => {
  if (!user) {
    signInAnonymously(auth).catch((err) => {
      console.warn(
        '[FIREBASE] Anonymous sign-in failed. If your Firestore rules require request.auth != null, writes (add/edit/delete) will fail until Anonymous Authentication is enabled in Firebase Console > Authentication > Sign-in method.',
        err
      );
    });
  }
});

export default app;

