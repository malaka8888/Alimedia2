import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from './config';
import { handleFirestoreError, OperationType } from './firestoreErrorHelper';

const ELEPHANTS_COLLECTION = 'elephants';
const POSTS_COLLECTION = 'elephant_posts';

/**
 * Reset all followerCount on elephants and likesCount/likedBy on posts to 0 / empty in Firestore
 */
export async function resetAllCountsInFirestore(): Promise<{ elephantsReset: number; postsReset: number }> {
  try {
    const batch = writeBatch(db);
    let elephantsReset = 0;
    let postsReset = 0;

    // 1. Get and reset elephants
    const elephantsCol = collection(db, ELEPHANTS_COLLECTION);
    const elephantsSnap = await getDocs(elephantsCol);
    
    elephantsSnap.forEach((docSnap) => {
      batch.update(docSnap.ref, {
        followerCount: 0
      });
      elephantsReset++;
    });

    // 2. Get and reset posts
    const postsCol = collection(db, POSTS_COLLECTION);
    const postsSnap = await getDocs(postsCol);

    postsSnap.forEach((docSnap) => {
      batch.update(docSnap.ref, {
        likesCount: 0,
        likedBy: []
      });
      postsReset++;
    });

    // Commit batch
    await batch.commit();

    console.log(`Successfully reset metrics: ${elephantsReset} elephants, ${postsReset} posts.`);
    return { elephantsReset, postsReset };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'migration/resetAllCounts');
  }
}
