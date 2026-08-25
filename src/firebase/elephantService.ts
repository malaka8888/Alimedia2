import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
  arrayRemove,
  writeBatch,
  setDoc
} from 'firebase/firestore';
import { db, auth } from './config';
import { Elephant, CulturalEvent } from '../types/elephant';
import { INITIAL_VERIFIED_ELEPHANTS } from '../data/initialVerifiedData';
import { uploadPhotoToCloudinary } from './cloudinaryService';

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

/**
 * Initial default cultural events / perahera updates
 */
export const INITIAL_EVENTS: CulturalEvent[] = [
  {
    id: "kandy-esala-2024",
    title: "Kandy Esala Perahera 2024 (මහනුවර ඇසළ මහා පෙරහැර)",
    sinhalaTitle: "මහනුවර ඇසළ මහා පෙරහැර මංගල්‍යය",
    description: "The Grand Pageant of Sri Lanka carrying the sacred tooth relic casket. Chief ceremonial tuskers leading the Maligawa procession.",
    location: "Kandy (මහනුවර)",
    date: "August 10 - 20, 2024",
    type: "perahera",
    participatingElephants: ["Indiraja", "Myan Kumara", "Vasana"],
    isActive: true
  },
  {
    id: "kelaniya-duruthu-2025",
    title: "Kelaniya Duruthu Maha Perahera (කැලණිය දුරුතු පෙරහැර)",
    sinhalaTitle: "කැලණිය රජ මහා විහාර දුරුතු මහා පෙරහැර",
    description: "Historic annual religious pageant celebrating the Buddha's visit to Kelaniya Raja Maha Vihara.",
    location: "Kelaniya, Colombo",
    date: "January 2025",
    type: "perahera",
    participatingElephants: ["Kandula"],
    isActive: true
  },
  {
    id: "bellanwila-esala-2024",
    title: "Bellanwila Esala Perahera (බෙල්ලන්විල ඇසළ පෙරහැර)",
    sinhalaTitle: "බෙල්ලන්විල රජ මහා විහාර ඇසළ පෙරහැර",
    description: "Traditional Colombo cultural festival with leading domesticated tuskers and elephants.",
    location: "Bellanwila, Colombo",
    date: "September 2024",
    type: "perahera",
    participatingElephants: ["Abhaya"],
    isActive: true
  }
];

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

    const list = await withTimeout(fetchPromise, 10000, [] as Elephant[]);

    if (list && list.length > 0) {
      try {
        localStorage.setItem(CACHE_ELEPHANTS_KEY, JSON.stringify(list));
      } catch (e) {}
      return list;
    }

    // Check cached data if Firestore returned empty or timed out
    try {
      const cached = localStorage.getItem(CACHE_ELEPHANTS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {}

    return INITIAL_VERIFIED_ELEPHANTS;
  } catch (error) {
    console.warn('Firestore elephant query fallback active:', error);
    try {
      const cached = localStorage.getItem(CACHE_ELEPHANTS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {}
    return INITIAL_VERIFIED_ELEPHANTS;
  }
}

/**
 * Get single elephant profile by document ID
 */
export async function getElephantById(id: string): Promise<Elephant | null> {
  try {
    const docRef = doc(db, ELEPHANTS_COLLECTION, id);
    const docSnap = await getDoc(docRef);

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

    // Await database write with 20-second timeout for full robustness
    await withTimeoutReject(
      setDoc(docRef, payload),
      20000,
      'Firestore write timed out (20s limit). Please check your internet connection and try again.'
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
      updateDoc(docRef, payload),
      20000,
      'Firestore update timed out (20s limit). Please check your internet connection.'
    );

    console.log('[FIRESTORE] [3] Firestore update confirmed SUCCESS for ID:', id);
  } catch (error: any) {
    console.error(`[FIRESTORE] Error updating elephant ${id}:`, error);
    throw error;
  }
}

/**
 * Independent Diagnostic Tests to verify each layer individually
 */
export async function runCompleteSystemDiagnostics(): Promise<{
  firebaseConnection: { status: boolean; message: string };
  authStatus: { status: boolean; uid?: string; email?: string };
  firestoreWrite: { status: boolean; docId?: string; message: string };
  firestoreRead: { status: boolean; count?: number; message: string };
  cloudinaryUpload: { status: boolean; url?: string; publicId?: string; message: string };
}> {
  const results = {
    firebaseConnection: { status: false, message: 'Not run' },
    authStatus: { status: false, uid: undefined as string | undefined, email: undefined as string | undefined },
    firestoreWrite: { status: false, docId: undefined as string | undefined, message: 'Not run' },
    firestoreRead: { status: false, count: 0, message: 'Not run' },
    cloudinaryUpload: { status: false, url: undefined as string | undefined, publicId: undefined as string | undefined, message: 'Not run' },
  };

  // 1. Firebase config & connection check
  try {
    if (db && db.app) {
      results.firebaseConnection = {
        status: true,
        message: `Connected to Firebase app [${db.app.name}] with Project ID: ${db.app.options.projectId}`,
      };
    }
  } catch (e: any) {
    results.firebaseConnection = { status: false, message: e.message || 'Firebase initialization check failed' };
  }

  // 2. Auth State Check
  const currentUser = auth.currentUser;
  if (currentUser) {
    results.authStatus = {
      status: true,
      uid: currentUser.uid,
      email: currentUser.email || 'Anonymous',
    };
  } else {
    results.authStatus = {
      status: false,
      uid: undefined,
      email: 'No active Firebase Auth user session (operating in public/client session)',
    };
  }

  // 3. Firestore Write Check
  try {
    const testDocRef = doc(collection(db, 'diagnostics'), `diag_${Date.now()}`);
    await setDoc(testDocRef, {
      diagnosticTest: true,
      timestamp: new Date(),
      agent: 'Alimedia Diagnostic Suite',
    });
    results.firestoreWrite = {
      status: true,
      docId: testDocRef.id,
      message: `Successfully wrote test document to /diagnostics/${testDocRef.id}`,
    };
  } catch (e: any) {
    results.firestoreWrite = {
      status: false,
      docId: undefined,
      message: `Firestore Write Failed: ${e.message || e}`,
    };
  }

  // 4. Firestore Read Check
  try {
    const elephantsSnap = await getDocs(collection(db, ELEPHANTS_COLLECTION));
    results.firestoreRead = {
      status: true,
      count: elephantsSnap.size,
      message: `Successfully read ${elephantsSnap.size} elephant document(s) from collection /elephants`,
    };
  } catch (e: any) {
    results.firestoreRead = {
      status: false,
      count: 0,
      message: `Firestore Read Failed: ${e.message || e}`,
    };
  }

  // 5. Cloudinary Upload Check
  try {
    // 1x1 test image
    const test1x1Data = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    const uploadRes = await uploadPhotoToCloudinary(test1x1Data);
    results.cloudinaryUpload = {
      status: true,
      url: uploadRes.url,
      publicId: uploadRes.publicId,
      message: `Successfully uploaded image to Cloudinary: ${uploadRes.url}`,
    };
  } catch (e: any) {
    results.cloudinaryUpload = {
      status: false,
      url: undefined,
      publicId: undefined,
      message: `Cloudinary Upload Failed: ${e.message || e}`,
    };
  }

  return results;
}

/**
 * Temporary diagnostic test write to Firestore
 */
export async function runFirestoreDiagnosticTest(): Promise<string> {
  try {
    console.log('[DIAGNOSTIC] [1] Starting connection test write...');
    // We write to a dedicated collection 'diagnostics' to avoid polluting elephant data
    const docRef = doc(collection(db, 'diagnostics'), 'test_connection');
    
    console.log('[DIAGNOSTIC] [2] Target doc path:', docRef.path);
    console.log('[DIAGNOSTIC] [3] auth.currentUser?.uid:', auth.currentUser?.uid || 'no-user-auth');
    
    const payload = {
      test: true,
      timestamp: serverTimestamp(),
      testedBy: 'Admin Console Diagnostic',
      testedAt: new Date(),
    };
    
    console.log('[DIAGNOSTIC] [4] Submitting payload to Firestore...');
    // Await with 10-second timeout
    await withTimeoutReject(
      setDoc(docRef, payload),
      10000,
      'Diagnostic Firestore write timed out (10s limit). Connection or configuration issue.'
    );
    
    console.log('[DIAGNOSTIC] [5] Write completed successfully!');
    return 'SUCCESS';
  } catch (err: any) {
    console.error('[DIAGNOSTIC] Test write failed:', err);
    throw err;
  }
}

/**
 * Perform a fast batch commit of multiple elephant creations/updates in one network trip
 */
export async function saveElephantsBatch(
  operations: {
    data: Omit<Elephant, 'id' | 'createdAt' | 'updatedAt'>;
    id?: string;
  }[]
): Promise<void> {
  try {
    const batch = writeBatch(db);
    const elephantsCol = collection(db, ELEPHANTS_COLLECTION);

    operations.forEach((op) => {
      if (op.id) {
        const docRef = doc(db, ELEPHANTS_COLLECTION, op.id);
        const rest = op.data;
        batch.update(docRef, {
          ...rest,
          updatedAt: new Date(),
        });
      } else {
        const docRef = doc(elephantsCol); // Auto-generate ref ID
        batch.set(docRef, {
          ...op.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    });

    // Commit in background so it doesn't block UI when offline/slow
    batch.commit().catch((error) => {
      console.warn('Background batch commit sync notice:', error);
    });
  } catch (error) {
    console.error('Error in batch commit:', error);
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
 */
export async function deleteElephantCascade(elephantId: string): Promise<{
  deletedElephantName: string;
  postsDeleted: number;
  usersUpdated: number;
  eventsUpdated: number;
}> {
  try {
    // 1. Fetch elephant document to retrieve names for reference matching
    const elephantRef = doc(db, ELEPHANTS_COLLECTION, elephantId);
    const elephantSnap = await getDoc(elephantRef);
    const elephantData = elephantSnap.exists() ? elephantSnap.data() : null;
    const elephantName = elephantData?.name || '';
    const elephantSinhalaName = elephantData?.sinhalaName || '';

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
    await deleteDoc(elephantRef);

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

/**
 * Seed initial verified Sri Lankan domesticated elephants into Firestore
 */
export async function seedInitialVerifiedData(): Promise<number> {
  try {
    // 1. Delete all existing elephants to make it fully clean and clear
    const elephantsCol = collection(db, ELEPHANTS_COLLECTION);
    const elephantSnap = await getDocs(elephantsCol);
    const deleteEleBatch = writeBatch(db);
    elephantSnap.forEach((docSnap) => {
      deleteEleBatch.delete(docSnap.ref);
    });
    await deleteEleBatch.commit();
    
    // 2. Delete all existing cultural events
    const eventsCol = collection(db, EVENTS_COLLECTION);
    const eventSnap = await getDocs(eventsCol);
    const deleteEventBatch = writeBatch(db);
    eventSnap.forEach((docSnap) => {
      deleteEventBatch.delete(docSnap.ref);
    });
    await deleteEventBatch.commit();

    // 3. Delete all existing community posts to keep it completely clean
    const postsCol = collection(db, POSTS_COLLECTION);
    const postSnap = await getDocs(postsCol);
    const deletePostBatch = writeBatch(db);
    postSnap.forEach((docSnap) => {
      deletePostBatch.delete(docSnap.ref);
    });
    await deletePostBatch.commit();

    // Now seed fresh records with stable IDs
    let count = 0;
    // We can write elephants in batches to be super fast and robust
    const seedBatch = writeBatch(db);
    
    for (const elephant of INITIAL_VERIFIED_ELEPHANTS) {
      const { id, ...data } = elephant;
      const docRef = doc(db, ELEPHANTS_COLLECTION, id || `ele_${count}`);
      seedBatch.set(docRef, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      count++;
    }

    // Also seed default cultural events with their defined IDs
    for (const ev of INITIAL_EVENTS) {
      const { id, ...data } = ev;
      const docRef = doc(db, EVENTS_COLLECTION, id || `ev_${count}`);
      seedBatch.set(docRef, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await seedBatch.commit();
    return count;
  } catch (error) {
    console.error('Error seeding verified elephant records:', error);
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

    const events = await withTimeout(fetchPromise, 2000, [] as CulturalEvent[]);

    if (events && events.length > 0) {
      try {
        localStorage.setItem(CACHE_EVENTS_KEY, JSON.stringify(events));
      } catch (e) {}
      return events;
    }

    try {
      const cached = localStorage.getItem(CACHE_EVENTS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {}

    return INITIAL_EVENTS;
  } catch (error) {
    console.warn('Error fetching events, returning defaults:', error);
    try {
      const cached = localStorage.getItem(CACHE_EVENTS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {}
    return INITIAL_EVENTS;
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
