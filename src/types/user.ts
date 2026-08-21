export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  username: string;
  photoURL: string;
  bio?: string;
  followedElephants: string[]; // Elephant IDs
  createdAt?: any;
  updatedAt?: any;
}
