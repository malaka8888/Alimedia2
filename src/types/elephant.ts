export type ElephantType = 'tusker' | 'elephant'; // tusker = ඇතා, elephant = අලියා
export type Gender = 'male' | 'female'; // male = පිරිමි, female = ගැහැණු

export interface ElephantSource {
  title: string;
  url?: string;
  publisher?: string;
  verifiedDate?: string;
}

export interface Elephant {
  id?: string;
  name: string; // Primary name (e.g., "Indiraja" / "ඉන්දිරාජා")
  sinhalaName?: string; // Sinhala script name
  otherNames?: string[]; // Aliases or previous names
  gender: Gender;
  type: ElephantType;
  dateOfBirth?: string; // If verified, otherwise null/empty
  age?: number | string; // Age in years or text if verified
  location: string; // e.g., "Kandy", "Colombo", "Kegalle", "Kataragama"
  organization: string; // e.g., "Sri Dalada Maligawa (ශ්‍රී දළදා මාළිගාව)", "Bellanwila Raja Maha Viharaya", "Pinnawala Elephant Orphanage"
  mahout?: string; // Publicly available & verified mahout info
  tusks?: string; // Description of tusks (e.g. "Twin symmetrical tusks (දළ යුගල)", "Nil-dath", "N/A")
  physicalCharacteristics?: string; // Height, back slope, ear shape, temporal marking
  description: string; // Comprehensive background, sacred perahera history, guardianship
  peraheraParticipation?: string[]; // Festivals (e.g., "Kandy Esala Perahera", "Kelaniya Duruthu Perahera")
  photos: string[]; // URLs of authentic photos
  coverPhotoIndex?: number;
  sources: ElephantSource[]; // Verified references and documentation
  verified: boolean; // Verification badge
  status?: 'living' | 'memorial'; // Living or legendary/historical memorial
  isFeatured?: boolean; // Featured in top stories / spotlight
  isLive?: boolean; // Currently active/live badge
  customBadge?: string; // e.g. "National Treasure", "Chief Casket Bearer"
  followerCount?: number; // Total followers
  createdAt?: any;
  updatedAt?: any;
}

export interface CulturalEvent {
  id?: string;
  title: string;
  sinhalaTitle?: string;
  description: string;
  location: string;
  date: string;
  type: 'perahera' | 'ceremony' | 'conservation' | 'general';
  participatingElephants?: string[];
  isActive: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface FilterOptions {
  type: string;
  gender: string;
  location: string;
  organization: string;
  status: string;
  verifiedOnly: boolean;
  searchQuery: string;
  sortBy: 'name' | 'age' | 'recent';
}
