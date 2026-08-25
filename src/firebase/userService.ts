import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { db, auth } from './config';
import { UserProfile } from '../types/user';

const USERS_COLLECTION = 'users';
const ELEPHANTS_COLLECTION = 'elephants';
const ELEPHANT_POSTS_COLLECTION = 'elephant_posts';

/**
 * Get or initialize user profile in Firestore after Google Sign-in
 */
export async function syncUserProfile(user: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}): Promise<UserProfile> {
  const userRef = doc(db, USERS_COLLECTION, user.uid);
  const email = user.email || '';
  const emailHandle = email ? email.split('@')[0].toLowerCase().replace(/[^a-z0-9._]/g, '') : 'user';
  const defaultUsername = `@${emailHandle}`;

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      const updatedProfile: UserProfile = {
        uid: user.uid,
        email: email || data.email || '',
        displayName: user.displayName || data.displayName || 'Elephant Fan',
        username: data.username || defaultUsername,
        photoURL: user.photoURL || data.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        bio: data.bio || 'Revered Sri Lankan Elephant enthusiast & heritage lover 🐘✨',
        followedElephants: Array.isArray(data.followedElephants) ? data.followedElephants : [],
        createdAt: data.createdAt,
        updatedAt: serverTimestamp(),
      };

      // Keep photo and display name updated from Google
      await setDoc(userRef, updatedProfile, { merge: true });
      return updatedProfile;
    } else {
      const newProfile: UserProfile = {
        uid: user.uid,
        email: email,
        displayName: user.displayName || 'Elephant Fan',
        username: defaultUsername,
        photoURL: user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        bio: 'Revered Sri Lankan Elephant enthusiast & heritage lover 🐘✨',
        followedElephants: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(userRef, newProfile);
      return newProfile;
    }
  } catch (error) {
    console.warn('Error syncing user profile with Firestore:', error);
    // Fallback profile if Firestore is offline
    return {
      uid: user.uid,
      email: email,
      displayName: user.displayName || 'Elephant Fan',
      username: defaultUsername,
      photoURL: user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      bio: 'Revered Sri Lankan Elephant enthusiast & heritage lover 🐘✨',
      followedElephants: [],
    };
  }
}

/**
 * Fetch a user profile by UID
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userRef = doc(db, USERS_COLLECTION, uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        uid: data.uid,
        email: data.email,
        displayName: data.displayName,
        username: data.username,
        photoURL: data.photoURL,
        bio: data.bio,
        followedElephants: Array.isArray(data.followedElephants) ? data.followedElephants : [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

/**
 * Toggle following an elephant
 */
export async function toggleFollowElephantInDb(
  userId: string,
  elephantId: string,
  currentlyFollowing: boolean
): Promise<string[]> {
  const userRef = doc(db, USERS_COLLECTION, userId);
  const elephantRef = doc(db, ELEPHANTS_COLLECTION, elephantId);

  try {
    if (currentlyFollowing) {
      // Unfollow
      await updateDoc(userRef, {
        followedElephants: arrayRemove(elephantId),
        updatedAt: serverTimestamp(),
      });
      try {
        await updateDoc(elephantRef, {
          followerCount: increment(-1),
        });
      } catch (e) {
        // Ignore if elephant doc is read-only
      }
    } else {
      // Follow
      await updateDoc(userRef, {
        followedElephants: arrayUnion(elephantId),
        updatedAt: serverTimestamp(),
      });
      try {
        await updateDoc(elephantRef, {
          followerCount: increment(1),
        });
      } catch (e) {
        // Ignore if elephant doc is read-only
      }
    }
  } catch (error) {
    console.warn('Error updating follow in Firestore:', error);
  }

  return [];
}

/**
 * Update user bio or username
 */
export async function updateUserProfile(
  userId: string,
  data: Partial<UserProfile>
): Promise<void> {
  const userRef = doc(db, USERS_COLLECTION, userId);
  await updateDoc(userRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Fetch every registered user profile (Admin use)
 */
export async function getAllUsers(): Promise<UserProfile[]> {
  try {
    const usersCol = collection(db, USERS_COLLECTION);
    const snap = await getDocs(usersCol);
    const users: UserProfile[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      users.push({
        uid: data.uid || docSnap.id,
        email: data.email || '',
        displayName: data.displayName || 'Elephant Fan',
        username: data.username || '@user',
        photoURL: data.photoURL || '',
        bio: data.bio || '',
        followedElephants: Array.isArray(data.followedElephants) ? data.followedElephants : [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    });
    // Newest first when createdAt is available
    users.sort((a: any, b: any) => {
      const aMs = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const bMs = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return bMs - aMs;
    });
    return users;
  } catch (error) {
    console.error('Error fetching all users:', error);
    return [];
  }
}

/**
 * Permanently remove a user's profile (Admin use only).
 * Cleans up their Firestore profile document, cascades removal from the
 * followerCount of any elephants they followed, and deletes their
 * community posts/stories so no orphaned data is left behind.
 *
 * Note: this only removes the Firestore-side account data. The underlying
 * Firebase Auth identity (if any) is not deleted from here since that
 * requires elevated Admin SDK privileges not available client-side; the
 * user will simply no longer have a profile/content on the platform and
 * would be treated as a brand-new user if they ever sign in again.
 */
export async function deleteUserAccount(userId: string): Promise<{
  postsDeleted: number;
  elephantsUpdated: number;
}> {
  let postsDeleted = 0;
  let elephantsUpdated = 0;

  const userRef = doc(db, USERS_COLLECTION, userId);
  const userSnap = await getDoc(userRef);
  const followedElephants: string[] = userSnap.exists()
    ? (userSnap.data().followedElephants || [])
    : [];

  // 1. Decrement followerCount on every elephant this user followed
  if (followedElephants.length > 0) {
    const updates = followedElephants.map(async (elephantId) => {
      try {
        const elephantRef = doc(db, ELEPHANTS_COLLECTION, elephantId);
        await updateDoc(elephantRef, { followerCount: increment(-1) });
        elephantsUpdated++;
      } catch (e) {
        // Elephant may no longer exist; ignore
      }
    });
    await Promise.all(updates);
  }

  // 2. Delete this user's community posts/stories
  try {
    const postsCol = collection(db, ELEPHANT_POSTS_COLLECTION);
    const postsQuery = query(postsCol, where('authorUid', '==', userId));
    const postsSnap = await getDocs(postsQuery);
    const deletions: Promise<void>[] = [];
    postsSnap.forEach((postDoc) => {
      deletions.push(deleteDoc(postDoc.ref));
      postsDeleted++;
    });
    await Promise.all(deletions);
  } catch (e) {
    console.warn('Could not clean up user posts during account deletion:', e);
  }

  // 3. Delete the user's profile document itself
  await deleteDoc(userRef);

  return { postsDeleted, elephantsUpdated };
}
