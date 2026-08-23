import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  getDoc,
  updateDoc
} from 'firebase/firestore';
import { db } from './config';
import { handleFirestoreError, OperationType } from './firestoreErrorHelper';

const VISITORS_COLLECTION = 'visitors';

export interface VisitorInfo {
  id: string;
  displayName: string;
  email: string;
  sessionStart: any;
  lastActive: any;
}

// Generate or retrieve visitor ID
export function getVisitorId(): string {
  try {
    let visitorId = localStorage.getItem('alimedia_visitor_id');
    if (!visitorId) {
      visitorId = 'visitor_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('alimedia_visitor_id', visitorId);
    }
    return visitorId;
  } catch {
    return 'visitor_fallback';
  }
}

/**
 * Tracks the visitor's presence in Firestore.
 * Updates lastActive. Creates the doc with sessionStart if it doesn't exist.
 */
export async function trackVisitorPresence(displayName?: string, email?: string): Promise<void> {
  const visitorId = getVisitorId();
  const visitorRef = doc(db, VISITORS_COLLECTION, visitorId);

  try {
    const snap = await getDoc(visitorRef);
    const resolvedName = displayName || 'Guest Visitor';
    const resolvedEmail = email || 'Guest';

    if (!snap.exists()) {
      await setDoc(visitorRef, {
        id: visitorId,
        displayName: resolvedName,
        email: resolvedEmail,
        sessionStart: serverTimestamp(),
        lastActive: serverTimestamp(),
      });
    } else {
      await updateDoc(visitorRef, {
        displayName: resolvedName,
        email: resolvedEmail,
        lastActive: serverTimestamp(),
      });
    }
  } catch (error) {
    // Non-blocking track error
    console.warn('Presence tracking error:', error);
  }
}

/**
 * Periodically updates the active presence of the visitor in Firestore
 */
export function startPresenceHeartbeat(displayName?: string, email?: string): () => void {
  // Run immediately
  trackVisitorPresence(displayName, email);

  // Interval of 30 seconds
  const intervalId = setInterval(() => {
    // Only update if tab is visible
    if (document.visibilityState === 'visible') {
      trackVisitorPresence(displayName, email);
    }
  }, 30000);

  return () => {
    clearInterval(intervalId);
  };
}

/**
 * Real-time subscription to ALL visitors
 */
export function subscribeToVisitors(onUpdate: (visitors: VisitorInfo[]) => void): () => void {
  const visitorsCol = collection(db, VISITORS_COLLECTION);
  const q = query(visitorsCol);

  return onSnapshot(
    q,
    (snapshot) => {
      const list: VisitorInfo[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          displayName: data.displayName || 'Guest Visitor',
          email: data.email || 'Guest',
          sessionStart: data.sessionStart,
          lastActive: data.lastActive,
        });
      });
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, VISITORS_COLLECTION);
    }
  );
}
