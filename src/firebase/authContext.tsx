import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from './config';
import { UserProfile } from '../types/user';
import { syncUserProfile, toggleFollowElephantInDb, updateUserProfile } from './userService';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  toggleFollowElephant: (elephantId: string) => Promise<boolean>;
  isFollowing: (elephantId: string) => boolean;
  followedElephantIds: string[];
  updateBio: (newBio: string, newUsername?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [localFollows, setLocalFollows] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('alimedia_followed_elephants');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userProf = await syncUserProfile({
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
          });

          setProfile(userProf);
          setLocalFollows(userProf.followedElephants || []);
          localStorage.setItem('alimedia_followed_elephants', JSON.stringify(userProf.followedElephants || []));
        } catch (e) {
          console.error('Error fetching user profile:', e);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        const userProf = await syncUserProfile({
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
        });
        setProfile(userProf);
        setLocalFollows(userProf.followedElephants || []);
        localStorage.setItem('alimedia_followed_elephants', JSON.stringify(userProf.followedElephants || []));
      }
    } catch (err: any) {
      console.warn('Google sign-in error or cancelled:', err);
      // Surface a clear, actionable message instead of silently creating an
      // unverified account for whatever email the visitor happens to type in.
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        // User dismissed the popup themselves - nothing to report.
        return;
      }
      if (err.code === 'auth/unauthorized-domain') {
        alert(
          'This domain is not yet authorized for Google Sign-In in the Firebase console. Please add it under Authentication > Settings > Authorized domains.'
        );
        return;
      }
      if (err.code === 'auth/popup-blocked') {
        alert('Your browser blocked the sign-in popup. Please allow popups for this site and try again.');
        return;
      }
      throw err;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.warn('Firebase sign out error:', e);
    }
    setUser(null);
    setProfile(null);
    localStorage.removeItem('alimedia_user_mock');
    localStorage.removeItem('alimedia_followed_elephants');
    setLocalFollows([]);
  };

  const isFollowing = (elephantId: string): boolean => {
    if (!elephantId) return false;
    const currentList = profile?.followedElephants || localFollows;
    return currentList.includes(elephantId);
  };

  const toggleFollowElephant = async (elephantId: string): Promise<boolean> => {
    if (!elephantId) return false;
    if (!profile) {
      alert(
        localStorage.getItem('alimedia_lang') === 'si'
          ? 'ඇත්තු/අලි Follow කිරීමට කරුණාකර පළමුව Google (Gmail) ගිණුමෙන් පිවිසෙන්න!'
          : 'Please sign in with your Google (Gmail) account first to follow tuskers and elephants!'
      );
      return false;
    }
    const currently = isFollowing(elephantId);
    const newStatus = !currently;

    // Update local state instantly
    let updatedList: string[];
    if (currently) {
      updatedList = profile.followedElephants.filter((id) => id !== elephantId);
    } else {
      updatedList = [...profile.followedElephants, elephantId];
    }

    setLocalFollows(updatedList);
    localStorage.setItem('alimedia_followed_elephants', JSON.stringify(updatedList));

    setProfile({
      ...profile,
      followedElephants: updatedList,
    });

    // Update in Firestore (supports both real and synced mock fallback accounts)
    const activeUid = user?.uid || profile?.uid;
    if (activeUid) {
      await toggleFollowElephantInDb(activeUid, elephantId, currently);
    }

    return newStatus;
  };

  const updateBio = async (newBio: string, newUsername?: string) => {
    if (!profile) return;
    const updated: UserProfile = {
      ...profile,
      bio: newBio,
      ...(newUsername ? { username: newUsername } : {}),
    };
    setProfile(updated);
    if (user?.uid) {
      await updateUserProfile(user.uid, { bio: newBio, ...(newUsername ? { username: newUsername } : {}) });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signInWithGoogle,
        signOut,
        toggleFollowElephant,
        isFollowing,
        followedElephantIds: profile?.followedElephants || localFollows,
        updateBio,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
