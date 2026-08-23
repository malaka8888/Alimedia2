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
  where,
  orderBy,
  arrayUnion,
  arrayRemove,
  increment
} from 'firebase/firestore';
import { db } from './config';
import { ElephantPost } from '../types/elephant';
import { INITIAL_POSTS } from '../data/initialPosts';

const POSTS_COLLECTION = 'elephant_posts';
const ELEPHANTS_COLLECTION = 'elephants';
const CACHE_POSTS_KEY = 'alimedia_cached_posts';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Check if a timestamp is within 24 hours
 */
export function isWithin24Hours(createdAt: any): boolean {
  if (!createdAt) return true; // If new / local, consider active
  let timeMs = 0;
  if (typeof createdAt?.toMillis === 'function') {
    timeMs = createdAt.toMillis();
  } else if (typeof createdAt?.toDate === 'function') {
    timeMs = createdAt.toDate().getTime();
  } else if (createdAt instanceof Date) {
    timeMs = createdAt.getTime();
  } else if (typeof createdAt === 'number') {
    timeMs = createdAt;
  } else if (typeof createdAt === 'string') {
    const parsed = Date.parse(createdAt);
    if (!isNaN(parsed)) timeMs = parsed;
  } else if (createdAt?.seconds) {
    timeMs = createdAt.seconds * 1000;
  }

  if (!timeMs) return true;
  const now = Date.now();
  return now - timeMs < TWENTY_FOUR_HOURS_MS;
}

/**
 * Format relative time (e.g., 2h ago / පැය 2කට පෙර)
 */
export function formatRelativeTime(createdAt: any, language: 'si' | 'en' = 'si'): string {
  if (!createdAt) return language === 'si' ? 'මෑතකදී' : 'Just now';
  let timeMs = 0;
  if (typeof createdAt?.toMillis === 'function') {
    timeMs = createdAt.toMillis();
  } else if (typeof createdAt?.toDate === 'function') {
    timeMs = createdAt.toDate().getTime();
  } else if (createdAt instanceof Date) {
    timeMs = createdAt.getTime();
  } else if (typeof createdAt === 'number') {
    timeMs = createdAt;
  } else if (typeof createdAt === 'string') {
    const parsed = Date.parse(createdAt);
    if (!isNaN(parsed)) timeMs = parsed;
  } else if (createdAt?.seconds) {
    timeMs = createdAt.seconds * 1000;
  }

  if (!timeMs) return language === 'si' ? 'මෑතකදී' : 'Just now';
  const diffSec = Math.max(0, Math.floor((Date.now() - timeMs) / 1000));

  if (diffSec < 60) {
    return language === 'si' ? 'දැන්' : 'Just now';
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return language === 'si' ? `මිනිත්තු ${diffMin}කට පෙර` : `${diffMin}m ago`;
  }
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return language === 'si' ? `පැය ${diffHr}කට පෙර` : `${diffHr}h ago`;
  }
  const diffDays = Math.floor(diffHr / 24);
  return language === 'si' ? `දින ${diffDays}කට පෙර` : `${diffDays}d ago`;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs = 2500, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs))
  ]);
}

/**
 * Clean up expired story-only posts (> 24 hours) from Firestore
 */
async function purgeExpiredStoryOnlyPosts(posts: ElephantPost[]) {
  try {
    for (const p of posts) {
      if (p.isStoryOnly && p.id && !isWithin24Hours(p.createdAt)) {
        deleteElephantPost(p.id).catch(() => {});
      }
    }
  } catch (err) {
    // Non-blocking cleanup
  }
}

/**
 * Add a new user-submitted photo/post or story for an elephant
 */
export async function addElephantPost(
  postData: Omit<ElephantPost, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  try {
    const postsCol = collection(db, POSTS_COLLECTION);
    const docRef = await addDoc(postsCol, {
      ...postData,
      likesCount: postData.likesCount || 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Also link the photo into the Elephant profile's photo gallery if not story only
    if (postData.elephantId && postData.photoUrl && !postData.isStoryOnly) {
      try {
        const elephantRef = doc(db, ELEPHANTS_COLLECTION, postData.elephantId);
        await updateDoc(elephantRef, {
          photos: arrayUnion(postData.photoUrl),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Could not append photo to elephant document:', err);
      }
    }

    return docRef.id;
  } catch (error) {
    console.error('Error adding elephant post to Firestore:', error);
    throw error;
  }
}

/**
 * Fetch all community posts for the global feed & stories
 */
export async function getAllElephantPosts(): Promise<ElephantPost[]> {
  try {
    const fetchPromise = (async () => {
      const postsCol = collection(db, POSTS_COLLECTION);
      const q = query(postsCol);
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return [];
      }

      const posts: ElephantPost[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        posts.push({
          id: docSnap.id,
          elephantId: data.elephantId,
          elephantName: data.elephantName || 'Unknown Elephant',
          elephantSinhalaName: data.elephantSinhalaName || '',
          photoUrl: data.photoUrl,
          caption: data.caption || '',
          authorUid: data.authorUid || '',
          authorName: data.authorName || 'Anonymous',
          authorUsername: data.authorUsername || '@user',
          authorPhotoURL: data.authorPhotoURL || '',
          likesCount: data.likesCount || 0,
          likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
          isStory: data.isStory !== undefined ? data.isStory : true,
          isStoryOnly: !!data.isStoryOnly,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });

      // Filter out expired story-only posts and trigger background db purge
      purgeExpiredStoryOnlyPosts(posts);

      const validPosts = posts.filter((p) => {
        if (p.isStoryOnly) {
          return isWithin24Hours(p.createdAt);
        }
        return true;
      });

      // Sort by createdAt descending
      validPosts.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });

      return validPosts;
    })();

    const posts = await withTimeout(fetchPromise, 15000, [] as ElephantPost[]);

    if (posts && posts.length > 0) {
      try {
        localStorage.setItem(CACHE_POSTS_KEY, JSON.stringify(posts));
      } catch (e) {}
      return posts;
    }

    try {
      const cached = localStorage.getItem(CACHE_POSTS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((p: any) => !p.isStoryOnly || isWithin24Hours(p.createdAt));
        }
      }
    } catch (e) {}

    return INITIAL_POSTS;
  } catch (error) {
    console.warn('Error fetching all elephant posts:', error);
    try {
      const cached = localStorage.getItem(CACHE_POSTS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((p: any) => !p.isStoryOnly || isWithin24Hours(p.createdAt));
        }
      }
    } catch (e) {}
    return INITIAL_POSTS;
  }
}

/**
 * Fetch community posts specific to an elephant
 */
export async function getPostsForElephant(elephantId: string): Promise<ElephantPost[]> {
  try {
    const postsCol = collection(db, POSTS_COLLECTION);
    const q = query(postsCol, where('elephantId', '==', elephantId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return [];
    }

    const posts: ElephantPost[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      posts.push({
        id: docSnap.id,
        elephantId: data.elephantId,
        elephantName: data.elephantName || 'Unknown Elephant',
        elephantSinhalaName: data.elephantSinhalaName || '',
        photoUrl: data.photoUrl,
        caption: data.caption || '',
        authorUid: data.authorUid || '',
        authorName: data.authorName || 'Anonymous',
        authorUsername: data.authorUsername || '@user',
        authorPhotoURL: data.authorPhotoURL || '',
        likesCount: data.likesCount || 0,
        likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
        isStory: data.isStory !== undefined ? data.isStory : true,
        isStoryOnly: !!data.isStoryOnly,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    });

    return posts.filter((p) => !p.isStoryOnly || isWithin24Hours(p.createdAt));
  } catch (error) {
    console.warn(`Error fetching posts for elephant ${elephantId}:`, error);
    return [];
  }
}

/**
 * Delete a community post or expired story
 */
export async function deleteElephantPost(postId: string): Promise<void> {
  try {
    const docRef = doc(db, POSTS_COLLECTION, postId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting elephant post:', error);
    throw error;
  }
}

/**
 * Accurately toggle or add a like to a post/story by a user ID
 */
export async function toggleLikeElephantPost(
  postId: string,
  userUid: string,
  forceLikeOnly: boolean = false
): Promise<{ isLiked: boolean; newCount: number }> {
  try {
    const postRef = doc(db, POSTS_COLLECTION, postId);
    const snap = await getDoc(postRef);

    if (!snap.exists()) {
      return { isLiked: true, newCount: 1 };
    }

    const data = snap.data();
    const likedBy: string[] = Array.isArray(data.likedBy) ? data.likedBy : [];
    const currentLikes: number = typeof data.likesCount === 'number' ? data.likesCount : 0;
    const isCurrentlyLiked = likedBy.includes(userUid);

    if (forceLikeOnly) {
      if (!isCurrentlyLiked) {
        const newCount = Math.max(0, currentLikes + 1);
        await updateDoc(postRef, {
          likedBy: arrayUnion(userUid),
          likesCount: increment(1),
          updatedAt: serverTimestamp(),
        });
        return { isLiked: true, newCount };
      }
      return { isLiked: true, newCount: currentLikes };
    }

    if (isCurrentlyLiked) {
      // Remove like
      const newCount = Math.max(0, currentLikes - 1);
      await updateDoc(postRef, {
        likedBy: arrayRemove(userUid),
        likesCount: increment(-1),
        updatedAt: serverTimestamp(),
      });
      return { isLiked: false, newCount };
    } else {
      // Add like
      const newCount = Math.max(0, currentLikes + 1);
      await updateDoc(postRef, {
        likedBy: arrayUnion(userUid),
        likesCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      return { isLiked: true, newCount };
    }
  } catch (error) {
    console.warn(`Error toggling like for post ${postId}:`, error);
    return { isLiked: true, newCount: 1 };
  }
}
