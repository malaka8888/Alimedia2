import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { db, auth } from './config';
import { UserProfile } from '../types/user';

const USERS_COLLECTION = 'users';
const ELEPHANTS_COLLECTION = 'elephants';

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
