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
  arrayRemove
} from 'firebase/firestore';
import { db } from './config';
import { Elephant, CulturalEvent } from '../types/elephant';
import { INITIAL_VERIFIED_ELEPHANTS } from '../data/initialVerifiedData';

const ELEPHANTS_COLLECTION = 'elephants';
const EVENTS_COLLECTION = 'cultural_events';
const POSTS_COLLECTION = 'elephant_posts';
const USERS_COLLECTION = 'users';

const CACHE_ELEPHANTS_KEY = 'alimedia_cached_elephants';
const CACHE_EVENTS_KEY = 'alimedia_cached_events';

// Timeout helper to avoid infinite hanging when network or firestore rules are unreachable
function withTimeout<T>(promise: Promise<T>, timeoutMs = 2500, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs))
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

/**
 * Fetch all elephants from Cloud Firestore with instant fallback so the app NEVER gets stuck.
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
          photos: Array.isArray(data.photos) ? data.photos : [],
          sources: Array.isArray(data.sources) ? data.sources : [],
          verified: data.verified !== undefined ? Boolean(data.verified) : true,
          status: data.status || 'living',
          isFeatured: Boolean(data.isFeatured),
          isLive: Boolean(data.isLive),
          customBadge: data.customBadge || '',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });

      return list;
    })();

    const list = await withTimeout(fetchPromise, 2500, [] as Elephant[]);

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

    // Fallback to verified Sri Lankan initial data
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
      photos: Array.isArray(data.photos) ? data.photos : [],
      sources: Array.isArray(data.sources) ? data.sources : [],
      verified: data.verified !== undefined ? Boolean(data.verified) : true,
      status: data.status || 'living',
      isFeatured: Boolean(data.isFeatured),
      isLive: Boolean(data.isLive),
      customBadge: data.customBadge || '',
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
    const elephantsCol = collection(db, ELEPHANTS_COLLECTION);
    const docRef = await addDoc(elephantsCol, {
      ...elephantData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding elephant to Firestore:', error);
    throw error;
  }
}

/**
 * Update an existing elephant document in Firestore
 */
export async function updateElephant(id: string, elephantData: Partial<Elephant>): Promise<void> {
  try {
    const docRef = doc(db, ELEPHANTS_COLLECTION, id);
    const { id: _, ...rest } = elephantData;
    await updateDoc(docRef, {
      ...rest,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error(`Error updating elephant ${id}:`, error);
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
    const elephantsCol = collection(db, ELEPHANTS_COLLECTION);
    let count = 0;
    
    for (const elephant of INITIAL_VERIFIED_ELEPHANTS) {
      await addDoc(elephantsCol, {
        ...elephant,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      count++;
    }

    // Also seed default cultural events if empty
    const eventsCol = collection(db, EVENTS_COLLECTION);
    const eventSnap = await getDocs(eventsCol);
    if (eventSnap.empty) {
      for (const ev of INITIAL_EVENTS) {
        await addDoc(eventsCol, {
          ...ev,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

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

    const events = await withTimeout(fetchPromise, 2500, [] as CulturalEvent[]);

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
  const eventsCol = collection(db, EVENTS_COLLECTION);
  const docRef = await addDoc(eventsCol, {
    ...eventData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateCulturalEvent(id: string, eventData: Partial<CulturalEvent>): Promise<void> {
  const docRef = doc(db, EVENTS_COLLECTION, id);
  const { id: _, ...rest } = eventData;
  await updateDoc(docRef, {
    ...rest,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCulturalEvent(id: string): Promise<void> {
  const docRef = doc(db, EVENTS_COLLECTION, id);
  await deleteDoc(docRef);
}
