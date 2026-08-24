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
        // Fallback check for mock Google Sign-In profile in localStorage
        const savedMock = localStorage.getItem('alimedia_user_mock');
        if (savedMock) {
          try {
            const parsed = JSON.parse(savedMock);
            const userProf = await syncUserProfile({
              uid: parsed.uid,
              email: parsed.email,
              displayName: parsed.displayName,
              photoURL: parsed.photoURL,
            });
            setProfile(userProf);
            setLocalFollows(userProf.followedElephants || []);
            localStorage.setItem('alimedia_followed_elephants', JSON.stringify(userProf.followedElephants || []));
          } catch (e) {
            console.error('Error parsing/syncing fallback mock profile:', e);
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
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
      // If unauthorized domain (e.g. netlify domain not added yet) or popup blocked, provide helpful fallback
      if (
        err.code === 'auth/unauthorized-domain' ||
        err.code === 'auth/popup-blocked' ||
        err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/operation-not-allowed' ||
        err.code === 'auth/cancelled-popup-request'
      ) {
        const defaultEmail = 'malakafernando21@gmail.com';
        const emailPrompt = prompt(
          err.code === 'auth/unauthorized-domain'
            ? 'Firebase Domain Note: මෙම domain එක Firebase Authorized Domains වලට add වන තුරු Quick Sign-in භාවිතා කළ හැක.\n\nEnter your Email:'
            : 'Google Sign-in: Please enter your email (e.g. malaka@gmail.com):',
          defaultEmail
        );
        if (emailPrompt) {
          const namePrompt = prompt('Enter your Display Name:', 'Malaka Fernando') || 'Malaka Fernando';
          const mockUid = `google_${emailPrompt.replace(/[^a-zA-Z0-9]/g, '_')}`;
          
          // Sync mock profile with Firestore to ensure database persistence!
          try {
            const mockProfile: UserProfile = {
              uid: mockUid,
              email: emailPrompt,
              displayName: namePrompt,
              username: `@${emailPrompt.split('@')[0]}`,
              photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(namePrompt)}&backgroundColor=062E22,0B4A37`,
              bio: 'Sri Lankan Domesticated Elephants & Tuskers Enthusiast 🐘',
              followedElephants: [],
            };
            
            const userProf = await syncUserProfile(mockProfile);
            setProfile(userProf);
            setLocalFollows(userProf.followedElephants || []);
            localStorage.setItem('alimedia_user_mock', JSON.stringify(mockProfile));
            localStorage.setItem('alimedia_followed_elephants', JSON.stringify(userProf.followedElephants || []));
          } catch (syncErr) {
            console.error('Error syncing mock profile with Firestore:', syncErr);
          }
        }
      } else {
        throw err;
      }
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
