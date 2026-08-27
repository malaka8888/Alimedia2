import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './config';

/**
 * Checks whether the given UID exists in the /admins allowlist collection.
 * This is the single source of truth for "is this user an admin" and is
 * mirrored by firestore.rules, so a user can only ever write to protected
 * collections if this same check would also return true server-side.
 */
export async function checkIsAdmin(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch (err) {
    console.error('[ADMIN AUTH] Failed to verify admin status:', err);
    return false;
  }
}

/**
 * Signs in with a real Firebase Auth email/password account and verifies
 * that the account is a registered admin. If the account is valid but is
 * NOT an admin, it is immediately signed out again so no non-admin session
 * lingers, and an error is thrown.
 */
export async function signInAdmin(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  const isAdmin = await checkIsAdmin(credential.user.uid);

  if (!isAdmin) {
    await firebaseSignOut(auth);
    throw new Error('NOT_ADMIN');
  }

  return credential.user;
}

export async function signOutAdmin(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Subscribes to the admin's auth state. Fires with `null` whenever there is
 * no signed-in user OR the signed-in user is not on the admin allowlist
 * (e.g. the anonymous session the app creates for regular visitors).
 */
export function subscribeAdminAuthState(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, async (user) => {
    if (!user || user.isAnonymous) {
      callback(null);
      return;
    }
    const isAdmin = await checkIsAdmin(user.uid);
    callback(isAdmin ? user : null);
  });
}

export function getAdminAuthErrorMessage(err: any): string {
  const code = err?.code || '';
  if (err?.message === 'NOT_ADMIN') {
    return 'This account is not authorized as an admin.';
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Incorrect email or password.';
  }
  if (code === 'auth/invalid-email') {
    return 'Please enter a valid email address.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network error. Please check your connection and try again.';
  }
  return err?.message || 'Sign in failed. Please try again.';
}
