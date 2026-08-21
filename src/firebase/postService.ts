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
  increment
} from 'firebase/firestore';
import { db } from './config';
import { ElephantPost } from '../types/elephant';

const POSTS_COLLECTION = 'elephant_posts';
const ELEPHANTS_COLLECTION = 'elephants';

/**
 * Add a new user-submitted photo/post for an elephant
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

    // Also link the photo into the Elephant profile's photo gallery
    if (postData.elephantId && postData.photoUrl) {
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
 * Fetch all community posts for the global feed
 */
export async function getAllElephantPosts(): Promise<ElephantPost[]> {
  try {
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

    // Sort by createdAt descending
    posts.sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || 0;
      const timeB = b.createdAt?.toMillis?.() || 0;
      return timeB - timeA;
    });

    return posts;
  } catch (error) {
    console.warn('Error fetching all elephant posts:', error);
    return [];
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

    return posts;
  } catch (error) {
    console.warn(`Error fetching posts for elephant ${elephantId}:`, error);
    return [];
  }
}

/**
 * Delete a community post
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
