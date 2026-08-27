import {
  collection,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  arrayRemove,
  setDoc
} from 'firebase/firestore';
import { db, auth } from './config';
import { Elephant, CulturalEvent } from '../types/elephant';

const ELEPHANTS_COLLECTION = 'elephants';
const EVENTS_COLLECTION = 'cultural_events';
const POSTS_COLLECTION = 'elephant_posts';
const USERS_COLLECTION = 'users';

const CACHE_ELEPHANTS_KEY = 'alimedia_cached_elephants';
const CACHE_EVENTS_KEY = 'alimedia_cached_events';

// Timeout helper to avoid infinite hanging when network or firestore rules are unreachable
function withTimeout<T>(promise: Promise<T>, timeoutMs = 10000, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs))
  ]);
}

// Timeout helper that rejects the promise on timeout for write operations
function withTimeoutReject<T>(promise: Promise<T>, timeoutMs = 15000, errorMsg = 'Operation timed out'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), timeoutMs))
  ]);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a Firestore read a few times before giving up. This exists because the SDK
 * can throw "Failed to get document because the client is offline" transiently -
 * e.g. right after page load, before its realtime channel has finished connecting,
 * even though the network is actually fine a moment later. Without this, actions
 * like "delete elephant" could fail immediately on a read that would have
 * succeeded on the very next try.
 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 800): Promise<T> {
  let lastError: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const isOfflineErr =
        err?.code === 'unavailable' ||
        /offline/i.test(err?.message || '');
      if (!isOfflineErr || i === attempts - 1) {
        throw err;
      }
      await delay(delayMs * (i + 1));
    }
  }
  throw lastError;
}

// Sanitizer helper to completely strip 'undefined' properties for Firestore SDK compatibility
export function sanitizeForFirestore(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (obj instanceof Date) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map(sanitizeForFirestore);
  }
  if (typeof obj === 'object') {
    // Keep Firestore FieldValue / Timestamp as is
    if (obj.constructor?.name === 'Timestamp' || obj.constructor?.name === 'FieldValueImpl') {
      return obj;
    }
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned;
  }
  return obj;
}

/**
  * Fetch all elephants from Cloud Firestore with robust fallback.
 */
export async function getElephants(): Promise<Elephant[]> {
  try {
    const fetchPromise = (async () => {
      const elephantsCol = collection(db, ELEPHANTS_COLLECTION);
      const q = query(elephantsCol);
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return [];
      }

      const list: Elephant[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        
        // Ensure photos & cloudinaryPhotos compatibility
        const rawPhotos: string[] = Array.isArray(data.photos) ? data.photos : [];
        const rawCloudinary: { url: string; publicId: string }[] = Array.isArray(data.cloudinaryPhotos)
          ? data.cloudinaryPhotos
          : [];
        
        const finalPhotos = rawPhotos.length > 0
          ? rawPhotos
          : rawCloudinary.map((cp) => (typeof cp === 'string' ? cp : cp?.url)).filter(Boolean);

        const finalCloudinary = rawCloudinary.length > 0
          ? rawCloudinary
          : finalPhotos.map((p) => ({ url: p, publicId: '' }));

        list.push({
          id: docSnap.id,
          name: data.name || 'Unnamed Elephant',
          sinhalaName: data.sinhalaName || '',
          otherNames: Array.isArray(data.otherNames) ? data.otherNames : [],
          gender: data.gender || 'male',
          type: data.type || 'elephant',
          dateOfBirth: data.dateOfBirth || '',
          age: data.age !== undefined && data.age !== null ? data.age : '',
          location: data.location || '',
          organization: data.organization || '',
          mahout: data.mahout || '',
          tusks: data.tusks || '',
          physicalCharacteristics: data.physicalCharacteristics || '',
          description: data.description || '',
          peraheraParticipation: Array.isArray(data.peraheraParticipation) ? data.peraheraParticipation : [],
          photos: finalPhotos,
          cloudinaryPhotos: finalCloudinary,
          sources: Array.isArray(data.sources) ? data.sources : [],
          verified: data.verified !== undefined ? Boolean(data.verified) : true,
          status: data.status || 'living',
          isFeatured: Boolean(data.isFeatured),
          isLive: Boolean(data.isLive),
          customBadge: data.customBadge || '',
          followerCount: data.followerCount || 0,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });

      return list;
    })();

    const list = await withTimeout(fetchPromise, 10000, null as Elephant[] | null);

    // A real (possibly empty) response from Firestore is authoritative - reflect it as-is.
    if (list !== null) {
      try {
        localStorage.setItem(CACHE_ELEPHANTS_KEY, JSON.stringify(list));
      } catch (e) {}
      return list;
    }

    // Only reached on a network timeout - fall back to the last known real snapshot,
    // never to placeholder/demo data.
    try {
      const cached = localStorage.getItem(CACHE_ELEPHANTS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {}

    return [];
  } catch (error) {
    console.warn('Error fetching elephants from Firestore:', error);
    try {
      const cached = localStorage.getItem(CACHE_ELEPHANTS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {}
    return [];
  }
}

/**
 * Get single elephant profile by document ID
 */
export async function getElephantById(id: string): Promise<Elephant | null> {
  try {
    const docRef = doc(db, ELEPHANTS_COLLECTION, id);
    const docSnap = await withRetry(() => getDoc(docRef));

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    const rawPhotos: string[] = Array.isArray(data.photos) ? data.photos : [];
    const rawCloudinary: { url: string; publicId: string }[] = Array.isArray(data.cloudinaryPhotos)
      ? data.cloudinaryPhotos
      : [];
    
    const finalPhotos = rawPhotos.length > 0
      ? rawPhotos
      : rawCloudinary.map((cp) => (typeof cp === 'string' ? cp : cp?.url)).filter(Boolean);

    const finalCloudinary = rawCloudinary.length > 0
      ? rawCloudinary
      : finalPhotos.map((p) => ({ url: p, publicId: '' }));

    return {
      id: docSnap.id,
      name: data.name || '',
      sinhalaName: data.sinhalaName || '',
      otherNames: Array.isArray(data.otherNames) ? data.otherNames : [],
      gender: data.gender || 'male',
      type: data.type || 'elephant',
      dateOfBirth: data.dateOfBirth || '',
      age: data.age !== undefined && data.age !== null ? data.age : '',
      location: data.location || '',
      organization: data.organization || '',
      mahout: data.mahout || '',
      tusks: data.tusks || '',
      physicalCharacteristics: data.physicalCharacteristics || '',
      description: data.description || '',
      peraheraParticipation: Array.isArray(data.peraheraParticipation) ? data.peraheraParticipation : [],
      photos: finalPhotos,
      cloudinaryPhotos: finalCloudinary,
      sources: Array.isArray(data.sources) ? data.sources : [],
      verified: data.verified !== undefined ? Boolean(data.verified) : true,
      status: data.status || 'living',
      isFeatured: Boolean(data.isFeatured),
      isLive: Boolean(data.isLive),
      customBadge: data.customBadge || '',
      followerCount: data.followerCount || 0,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  } catch (error) {
    console.error(`Error fetching elephant with id ${id}:`, error);
    throw error;
  }
}

/**
 * Add a new elephant record into Firestore
 */
export async function addElephant(elephantData: Omit<Elephant, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  try {
    console.log('[FIRESTORE] [1] Starting addElephant write...');
    console.log('[FIRESTORE] [2] Authenticated user UID:', auth.currentUser?.uid || 'no-auth-user');
    
    const elephantsCol = collection(db, ELEPHANTS_COLLECTION);
    const docRef = doc(elephantsCol);
    const id = docRef.id;

    console.log('[FIRESTORE] [3] Generated Document ID:', id);

    const payload = sanitizeForFirestore({
      ...elephantData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('[FIRESTORE] [4] Writing payload to path:', docRef.path);
    console.log('[FIRESTORE] [5] Payload preview:', {
      name: payload.name,
      photosCount: payload.photos?.length || 0,
      cloudinaryPhotosCount: payload.cloudinaryPhotos?.length || 0,
    });

    // Await database write with 30-second timeout for full robustness
    await withTimeoutReject(
      setDoc(docRef, payload),
      30000,
      'Firestore write timed out (30s limit). Please check your internet connection and try again.'
    );

    console.log('[FIRESTORE] [6] Firestore write confirmed SUCCESS for document ID:', id);
    return id;
  } catch (error: any) {
    console.error('[FIRESTORE] Fatal error writing elephant document:', error);
    throw error;
  }
}

/**
 * Update an existing elephant document in Firestore
 */
export async function updateElephant(id: string, elephantData: Partial<Elephant>): Promise<void> {
  try {
    console.log('[FIRESTORE] [1] Starting updateElephant for ID:', id);
    const docRef = doc(db, ELEPHANTS_COLLECTION, id);
    const { id: _, ...rest } = elephantData;

    const payload = sanitizeForFirestore({
      ...rest,
      updatedAt: new Date(),
    });

    console.log('[FIRESTORE] [2] Submitting update payload to path:', docRef.path);

    await withTimeoutReject(
      setDoc(docRef, payload, { merge: true }),
      30000,
      'Firestore update timed out (30s limit). Please check your internet connection.'
    );

    console.log('[FIRESTORE] [3] Firestore update confirmed SUCCESS for ID:', id);
  } catch (error: any) {
    console.error(`[FIRESTORE] Error updating elephant ${id}:`, error);
    throw error;
  }
}

/**
 * Quick toggle verification status
 */
export async function toggleElephantVerification(id: string, verified: boolean): Promise<void> {
  await updateElephant(id, { verified });
}

/**
 * Quick toggle featured status
 */
export async function toggleElephantFeatured(id: string, isFeatured: boolean): Promise<void> {
  await updateElephant(id, { isFeatured });
}

/**
 * Quick toggle live status
 */
export async function toggleElephantLive(id: string, isLive: boolean): Promise<void> {
  await updateElephant(id, { isLive });
}

/**
 * Delete an elephant document from Firestore
 */
export async function deleteElephant(id: string): Promise<void> {
  try {
    const docRef = doc(db, ELEPHANTS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting elephant ${id}:`, error);
    throw error;
  }
}

/**
 * Permanently delete an elephant and CASCADE delete all connected data:
 * 1. Delete all community posts and stories associated with this elephant from `elephant_posts`
 * 2. Remove this elephant ID from all users' `followedElephants` lists in `users`
 * 3. Remove this elephant from any `cultural_events` participation lists
 * 4. Delete the elephant document itself from `elephants`
 *
 * `knownName` / `knownSinhalaName` should be passed in whenever the caller already
 * has the elephant loaded (e.g. from the live admin list) - this avoids an extra
 * Firestore read on the delete path entirely, which previously could fail with a
 * "client is offline" error and abort the whole deletion even though nothing was
 * actually wrong with the write itself.
 */
export async function deleteElephantCascade(
  elephantId: string,
  knownName?: string,
  knownSinhalaName?: string
): Promise<{
  deletedElephantName: string;
  postsDeleted: number;
  usersUpdated: number;
  eventsUpdated: number;
}> {
  try {
    const elephantRef = doc(db, ELEPHANTS_COLLECTION, elephantId);

    // Only hit the network for the name if the caller didn't already give it to us.
    let elephantName = knownName || '';
    let elephantSinhalaName = knownSinhalaName || '';
    if (!elephantName) {
      try {
        const elephantSnap = await withRetry(() => getDoc(elephantRef));
        const elephantData = elephantSnap.exists() ? elephantSnap.data() : null;
        elephantName = elephantData?.name || '';
        elephantSinhalaName = elephantData?.sinhalaName || '';
      } catch (lookupErr) {
        console.warn(`Could not read elephant ${elephantId} before delete (continuing anyway):`, lookupErr);
      }
    }

    // 2. Cascade delete all community posts and stories for this elephant
    let postsDeletedCount = 0;
    const deletedPostIds = new Set<string>();
    const deletePostPromises: Promise<void>[] = [];

    try {
      const postsCol = collection(db, POSTS_COLLECTION);
      
      // Find by elephantId
      const postsQueryById = query(postsCol, where('elephantId', '==', elephantId));
      const postsSnapById = await getDocs(postsQueryById);
      postsSnapById.forEach((postDoc) => {
        deletedPostIds.add(postDoc.id);
        deletePostPromises.push(deleteDoc(postDoc.ref));
        postsDeletedCount++;
      });

      // Also check by elephant name in case of legacy records
      if (elephantName) {
        const postsQueryByName = query(postsCol, where('elephantName', '==', elephantName));
        const postsSnapByName = await getDocs(postsQueryByName);
        postsSnapByName.forEach((postDoc) => {
          if (!deletedPostIds.has(postDoc.id)) {
            deletedPostIds.add(postDoc.id);
            deletePostPromises.push(deleteDoc(postDoc.ref));
            postsDeletedCount++;
          }
        });
      }

      await Promise.all(deletePostPromises);
    } catch (postErr) {
      console.warn('Could not clean up some elephant posts:', postErr);
    }

    // 3. Clean up user followedElephants arrays
    let usersUpdatedCount = 0;
    try {
      const usersCol = collection(db, USERS_COLLECTION);
      const usersQuery = query(usersCol, where('followedElephants', 'array-contains', elephantId));
      const usersSnap = await getDocs(usersQuery);
      const userUpdates: Promise<void>[] = [];

      usersSnap.forEach((userDoc) => {
        usersUpdatedCount++;
        userUpdates.push(
          updateDoc(userDoc.ref, {
            followedElephants: arrayRemove(elephantId),
            updatedAt: serverTimestamp(),
          })
        );
      });

      await Promise.all(userUpdates);
    } catch (userErr) {
      console.warn('Could not clean up user follows:', userErr);
    }

    // 4. Clean up cultural events participation lists
    let eventsUpdatedCount = 0;
    try {
      const eventsCol = collection(db, EVENTS_COLLECTION);
      const eventsSnap = await getDocs(eventsCol);
      const eventUpdates: Promise<void>[] = [];

      eventsSnap.forEach((eventDoc) => {
        const evData = eventDoc.data();
        const participating: string[] = Array.isArray(evData.participatingElephants) ? evData.participatingElephants : [];
        const hasReference = participating.some(
          (p) =>
            p === elephantId ||
            (elephantName && p.toLowerCase().includes(elephantName.toLowerCase())) ||
            (elephantSinhalaName && p.includes(elephantSinhalaName))
        );

        if (hasReference) {
          eventsUpdatedCount++;
          const filtered = participating.filter(
            (p) =>
              p !== elephantId &&
              (!elephantName || !p.toLowerCase().includes(elephantName.toLowerCase())) &&
              (!elephantSinhalaName || !p.includes(elephantSinhalaName))
          );
          eventUpdates.push(
            updateDoc(eventDoc.ref, {
              participatingElephants: filtered,
              updatedAt: serverTimestamp(),
            })
          );
        }
      });

      await Promise.all(eventUpdates);
    } catch (eventErr) {
      console.warn('Could not clean up cultural events references:', eventErr);
    }

    // 5. Delete the main elephant document from Firestore
    await withRetry(() => deleteDoc(elephantRef));

    return {
      deletedElephantName: elephantName || elephantId,
      postsDeleted: postsDeletedCount,
      usersUpdated: usersUpdatedCount,
      eventsUpdated: eventsUpdatedCount,
    };
  } catch (error) {
    console.error(`Error executing cascade delete for elephant ${elephantId}:`, error);
    throw error;
  }
}

// -------------------------------------------------------------
// Cultural Events Service
// -------------------------------------------------------------

export async function getCulturalEvents(): Promise<CulturalEvent[]> {
  try {
    const fetchPromise = (async () => {
      const eventsCol = collection(db, EVENTS_COLLECTION);
      const snapshot = await getDocs(eventsCol);
      if (snapshot.empty) {
        return [];
      }
      const events: CulturalEvent[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        events.push({
          id: docSnap.id,
          title: data.title || '',
          sinhalaTitle: data.sinhalaTitle || '',
          description: data.description || '',
          location: data.location || '',
          date: data.date || '',
          type: data.type || 'perahera',
          participatingElephants: Array.isArray(data.participatingElephants) ? data.participatingElephants : [],
          isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });
      return events;
    })();

    const events = await withTimeout(fetchPromise, 2000, null as CulturalEvent[] | null);

    if (events !== null) {
      try {
        localStorage.setItem(CACHE_EVENTS_KEY, JSON.stringify(events));
      } catch (e) {}
      return events;
    }

    try {
      const cached = localStorage.getItem(CACHE_EVENTS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {}

    return [];
  } catch (error) {
    console.warn('Error fetching cultural events:', error);
    try {
      const cached = localStorage.getItem(CACHE_EVENTS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {}
    return [];
  }
}

export async function addCulturalEvent(eventData: Omit<CulturalEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  try {
    const eventsCol = collection(db, EVENTS_COLLECTION);
    const docRef = doc(eventsCol);
    const id = docRef.id;

    const payload = sanitizeForFirestore({
      ...eventData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await setDoc(docRef, payload);
    return id;
  } catch (error) {
    console.error('Error adding cultural event:', error);
    throw error;
  }
}

export async function updateCulturalEvent(id: string, eventData: Partial<CulturalEvent>): Promise<void> {
  try {
    const docRef = doc(db, EVENTS_COLLECTION, id);
    const { id: _, ...rest } = eventData;

    const payload = sanitizeForFirestore({
      ...rest,
      updatedAt: new Date(),
    });

    await updateDoc(docRef, payload);
  } catch (error) {
    console.error(`Error updating cultural event ${id}:`, error);
    throw error;
  }
}

export async function deleteCulturalEvent(id: string): Promise<void> {
  const docRef = doc(db, EVENTS_COLLECTION, id);
  await deleteDoc(docRef);
}
