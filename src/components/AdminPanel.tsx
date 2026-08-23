import React, { useState, useEffect, useRef } from 'react';
import {
  Elephant,
  CulturalEvent,
  ElephantPost,
  ElephantType,
  Gender,
  ElephantSource
} from '../types/elephant';
import {
  ShieldCheck,
  ShieldAlert,
  Crown,
  Sparkles,
  Search,
  Plus,
  Trash2,
  Edit,
  Save,
  Eye,
  LogOut,
  Lock,
  Mail,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Database,
  Calendar,
  Image as ImageIcon,
  Building2,
  User,
  Star,
  Radio,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  X,
  FileText,
  Download,
  FileSpreadsheet,
  Upload,
  UploadCloud,
  Camera,
  Loader2,
  Check,
  LayoutDashboard,
  MessageSquare,
  Flame,
  Heart,
  Share2,
  Layers,
  Settings,
  HelpCircle,
  Clock,
  MapPin,
  Tag
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Language, translations } from '../utils/translations';
import { BulkImportElephants } from './BulkImportElephants';
import { getAllElephantPosts, deleteElephantPost } from '../firebase/postService';

// Utility to compress high-resolution gallery images to web-optimized JPEG data URLs
const compressImageFile = (file: File, maxWidth = 1280, maxHeight = 1280, quality = 0.85): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selected file is not an image'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

interface AdminPanelProps {
  elephants: Elephant[];
  events: CulturalEvent[];
  onSaveElephant: (elephant: Omit<Elephant, 'id' | 'createdAt' | 'updatedAt'>, id?: string, skipRefresh?: boolean) => Promise<void>;
  onDeleteElephant: (id: string) => Promise<{
    deletedElephantName: string;
    postsDeleted: number;
    usersUpdated: number;
    eventsUpdated: number;
  } | void>;
  onToggleVerification: (id: string, verified: boolean) => Promise<void>;
  onToggleFeatured: (id: string, isFeatured: boolean) => Promise<void>;
  onToggleLive: (id: string, isLive: boolean) => Promise<void>;
  onSaveEvent: (event: Omit<CulturalEvent, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
  onSeedDatabase: () => Promise<void>;
  onViewElephant: (elephant: Elephant) => void;
  onClose: () => void;
  language: Language;
}

const DEFAULT_ADMIN_EMAIL = 'admin@alimedia.com';
const DEFAULT_ADMIN_PASS = 'admin@alimedia';

const POPULAR_PERAHERAS = [
  'Kandy Esala Perahera (මහනුවර ඇසළ පෙරහැර)',
  'Kelaniya Duruthu Maha Perahera (කැලණිය පෙරහැර)',
  'Bellanwila Esala Perahera (බෙල්ලන්විල පෙරහැර)',
  'Ruhunu Maha Kataragama Esala Perahera (කතරගම පෙරහැර)',
  'Gangarama Navam Maha Perahera (නවම් පෙරහැර)',
  'Kotte Sri Rajamaha Vihara Perahera (කෝට්ටේ පෙරහැර)',
  'Devinuwara Esala Perahera (දෙවිනුවර පෙරහැර)',
  'Aluth Sahal Mangallaya (අලුත් සහල් මංගල්‍යය)',
  'Seenigama Devalaya Perahera (සීනිගම දේවාල පෙරහැර)'
];

const PRESET_ELEPHANT_PHOTOS = [
  'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1581852017103-68ac65514cf7?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1549366021-9f761d450615?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1534567153574-2b12153a87f0?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1603855073959-f23247076a03?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1564760055775-d63b17a55c44?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1560807707-8cc77767d783?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1544979590-37e9b47eb705?auto=format&fit=crop&w=1200&q=80'
];

export type AdminCategoryTab =
  | 'overview'
  | 'elephants'
  | 'editor'
  | 'posts'
  | 'events'
  | 'bulk_import'
  | 'database';

export const AdminPanel: React.FC<AdminPanelProps> = ({
  elephants,
  events,
  onSaveElephant,
  onDeleteElephant,
  onToggleVerification,
  onToggleFeatured,
  onToggleLive,
  onSaveEvent,
  onDeleteEvent,
  onSeedDatabase,
  onViewElephant,
  onClose,
  language,
}) => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('alimedia_admin_auth') === 'true';
  });
  const [emailInput, setEmailInput] = useState<string>('admin@alimedia.com');
  const [passwordInput, setPasswordInput] = useState<string>('admin@alimedia');
  const [authError, setAuthError] = useState<string | null>(null);

  // Admin Navigation Tabs (Categorized & Mobile-friendly)
  const [adminTab, setAdminTab] = useState<AdminCategoryTab>('overview');
  
  // Search and Filter State for Elephants
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<
    'all' | 'tusker' | 'elephant' | 'verified' | 'unverified' | 'featured' | 'live' | 'living' | 'memorial'
  >('all');

  // Community Posts State
  const [communityPosts, setCommunityPosts] = useState<ElephantPost[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [postsSearch, setPostsSearch] = useState('');
  const [postFilter, setPostFilter] = useState<'all' | 'stories' | 'feed'>('all');

  // Form Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<Elephant, 'id' | 'createdAt' | 'updatedAt'>>({
    name: '',
    sinhalaName: '',
    otherNames: [],
    gender: 'male',
    type: 'tusker',
    dateOfBirth: '',
    age: '',
    location: '',
    organization: '',
    mahout: '',
    tusks: '',
    physicalCharacteristics: '',
    description: '',
    peraheraParticipation: [],
    photos: [PRESET_ELEPHANT_PHOTOS[0]],
    sources: [{ title: 'Department of Wildlife Conservation / Temple Custodians', url: '', publisher: 'Official Registry', verifiedDate: '2024' }],
    verified: true,
    status: 'living',
    isFeatured: false,
    isLive: false,
    customBadge: '',
  });

  // Helpers for text inputs
  const [otherNamesText, setOtherNamesText] = useState('');
  const [peraheraText, setPeraheraText] = useState('');

  // Event Editing State
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventFormData, setEventFormData] = useState<Omit<CulturalEvent, 'id' | 'createdAt' | 'updatedAt'>>({
    title: '',
    sinhalaTitle: '',
    description: '',
    location: '',
    date: '',
    type: 'perahera',
    participatingElephants: [],
    isActive: true,
  });
  const [eventElephantsText, setEventElephantsText] = useState('');

  // Action status
  const [isSaving, setIsSaving] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Gallery Image Upload State & Ref
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);

  // Cascade Deletion Confirmation Modal State
  const [deletingElephantTarget, setDeletingElephantTarget] = useState<Elephant | null>(null);
  const [isDeletingCascade, setIsDeletingCascade] = useState(false);

  const showToast = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Load community posts when entering moderation tab or overview
  useEffect(() => {
    if (isAuthenticated) {
      loadCommunityPosts();
    }
  }, [isAuthenticated, adminTab]);

  const loadCommunityPosts = async () => {
    try {
      setIsLoadingPosts(true);
      const posts = await getAllElephantPosts();
      setCommunityPosts(posts);
    } catch (err) {
      console.warn('Could not load community posts:', err);
    } finally {
      setIsLoadingPosts(false);
    }
  };

  // Handle Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      emailInput.trim().toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase() &&
      passwordInput === DEFAULT_ADMIN_PASS
    ) {
      setIsAuthenticated(true);
      localStorage.setItem('alimedia_admin_auth', 'true');
      setAuthError(null);
    } else {
      setAuthError('වැරදි විද්‍යුත් තැපෑල හෝ මුරපදයකි! (Invalid Username or Password)');
    }
  };

  // Handle Logout
  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('alimedia_admin_auth');
  };

  // Open Create Elephant Form
  const handleOpenCreateForm = () => {
    setEditingId(null);
    setFormData({
      name: '',
      sinhalaName: '',
      otherNames: [],
      gender: 'male',
      type: 'tusker',
      dateOfBirth: '',
      age: '',
      location: '',
      organization: '',
      mahout: '',
      tusks: 'දිගු සවිමත් යුගල දළ (Twin symmetrical ivory tusks)',
      physicalCharacteristics: '',
      description: '',
      peraheraParticipation: [],
      photos: [PRESET_ELEPHANT_PHOTOS[0]],
      sources: [{ title: 'Department of Wildlife Conservation / Temple Registry', url: '', publisher: 'Official Custodians', verifiedDate: '2024' }],
      verified: true,
      status: 'living',
      isFeatured: false,
      isLive: false,
      customBadge: '',
    });
    setOtherNamesText('');
    setPeraheraText('');
    setAdminTab('editor');
  };

  // Open Edit Elephant Form
  const handleOpenEditForm = (elephant: Elephant) => {
    setEditingId(elephant.id || null);
    setFormData({
      name: elephant.name || '',
      sinhalaName: elephant.sinhalaName || '',
      otherNames: elephant.otherNames || [],
      gender: elephant.gender || 'male',
      type: elephant.type || 'tusker',
      dateOfBirth: elephant.dateOfBirth || '',
      age: elephant.age !== undefined ? elephant.age : '',
      location: elephant.location || '',
      organization: elephant.organization || '',
      mahout: elephant.mahout || '',
      tusks: elephant.tusks || '',
      physicalCharacteristics: elephant.physicalCharacteristics || '',
      description: elephant.description || '',
      peraheraParticipation: elephant.peraheraParticipation || [],
      photos: elephant.photos && elephant.photos.length > 0 ? elephant.photos : [PRESET_ELEPHANT_PHOTOS[0]],
      sources: elephant.sources && elephant.sources.length > 0 ? elephant.sources : [{ title: '', url: '', publisher: '', verifiedDate: '' }],
      verified: elephant.verified ?? true,
      status: elephant.status || 'living',
      isFeatured: Boolean(elephant.isFeatured),
      isLive: Boolean(elephant.isLive),
      customBadge: elephant.customBadge || '',
    });
    setOtherNamesText((elephant.otherNames || []).join(', '));
    setPeraheraText((elephant.peraheraParticipation || []).join(', '));
    setAdminTab('editor');
  };

  // Save Elephant
  const handleSubmitElephant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('අලියාගේ නම (Elephant Name) ඇතුළත් කිරීම අනිවාර්යයි.');
      return;
    }

    try {
      setIsSaving(true);
      const parsedOtherNames = otherNamesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const parsedPeraheras = peraheraText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const cleanedPhotos = formData.photos.filter((p) => p && p.trim().length > 0);
      if (cleanedPhotos.length === 0) {
        cleanedPhotos.push(PRESET_ELEPHANT_PHOTOS[0]);
      }

      const cleanedSources = formData.sources.filter((s) => s.title && s.title.trim().length > 0);

      const payload: Omit<Elephant, 'id' | 'createdAt' | 'updatedAt'> = {
        ...formData,
        otherNames: parsedOtherNames,
        peraheraParticipation: parsedPeraheras,
        photos: cleanedPhotos,
        sources: cleanedSources.length > 0 ? cleanedSources : [{ title: 'Official Custodians Documentation', publisher: 'Verified Registry', verifiedDate: '2024' }],
      };

      await onSaveElephant(payload, editingId || undefined);
      showToast(editingId ? 'පැතිකඩ සාර්ථකව යාවත්කාලීන විය!' : 'නව අලි පැතිකඩ සාර්ථකව ලියාපදිංචි කෙරිණි!');
      setAdminTab('elephants');
    } catch (err: any) {
      alert(`Error saving elephant: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Quick Verification Toggle
  const handleQuickVerify = async (elephant: Elephant) => {
    if (!elephant.id) return;
    const newStatus = !elephant.verified;
    await onToggleVerification(elephant.id, newStatus);
    showToast(`${elephant.name} Verification badge ${newStatus ? 'සක්‍රිය කෙරිණි (Verified)' : 'අක්‍රිය කෙරිණි (Unverified)'}`);
  };

  // Quick Featured Toggle
  const handleQuickFeatured = async (elephant: Elephant) => {
    if (!elephant.id) return;
    const newStatus = !elephant.isFeatured;
    await onToggleFeatured(elephant.id, newStatus);
    showToast(`${elephant.name} Featured Story ${newStatus ? 'එක් කරන ලදී (Featured)' : 'ඉවත් කරන ලදී'}`);
  };

  // Quick Live Toggle
  const handleQuickLive = async (elephant: Elephant) => {
    if (!elephant.id) return;
    const newStatus = !elephant.isLive;
    await onToggleLive(elephant.id, newStatus);
    showToast(`${elephant.name} LIVE Status ${newStatus ? 'සක්‍රියයි (LIVE)' : 'අක්‍රියයි'}`);
  };

  // Trigger Cascade Delete Confirmation Modal
  const handleTriggerCascadeDelete = (elephant: Elephant) => {
    setDeletingElephantTarget(elephant);
  };

  // Confirm Cascade Deletion from Firestore
  const handleConfirmCascadeDelete = async () => {
    if (!deletingElephantTarget || !deletingElephantTarget.id) return;
    try {
      setIsDeletingCascade(true);
      const res = await onDeleteElephant(deletingElephantTarget.id);
      
      const postsCount = res && typeof res === 'object' && 'postsDeleted' in res ? res.postsDeleted : 0;
      showToast(
        `"${deletingElephantTarget.name}" සහ සම්බන්ධිත සියලු දත්ත (${postsCount} posts/stories/links) Database එකෙන් ස්ථිරවම ඉවත් කරන ලදී!`
      );
      setDeletingElephantTarget(null);
      await loadCommunityPosts();
    } catch (err: any) {
      console.error('Error cascading deleting elephant:', err);
      alert(`දත්ත ඉවත් කිරීමේදී දෝෂයක් මතු විය: ${err.message || err}`);
    } finally {
      setIsDeletingCascade(false);
    }
  };

  // Moderate / Delete Single Community Post
  const handleDeletePost = async (postId: string) => {
    if (confirm('ඔබට මෙම පරිශීලක පළකිරීම/Story එක database එකෙන් ස්ථිරවම මකා දැමීමට අවශ්‍යද?')) {
      try {
        await deleteElephantPost(postId);
        setCommunityPosts((prev) => prev.filter((p) => p.id !== postId));
        showToast('පළකිරීම සාර්ථකව මකා දමන ලදී.');
      } catch (err: any) {
        alert(`Error deleting post: ${err.message || err}`);
      }
    }
  };

  // Photo handlers & Gallery Uploader
  const handleGalleryFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    try {
      setIsUploadingGallery(true);
      const compressedUrls = await Promise.all(
        fileArray.map((file) => compressImageFile(file, 1280, 1280, 0.85))
      );

      setFormData((prev) => {
        const currentPhotos = prev.photos.filter(Boolean);
        return {
          ...prev,
          photos: [...compressedUrls, ...currentPhotos],
        };
      });

      showToast(`ඡායාරූප ${fileArray.length} ක් Gallery එකෙන් එක් කරන ලදී!`);
    } catch (err: any) {
      console.error('Gallery upload error:', err);
      alert('ඡායාරූපය upload කිරීමේදී දෝෂයක් මතු විය. කරුණාකර නැවත උත්සාහ කරන්න.');
    } finally {
      setIsUploadingGallery(false);
      if (galleryInputRef.current) {
        galleryInputRef.current.value = '';
      }
    }
  };

  const handleSetMainPhoto = (index: number) => {
    setFormData((prev) => {
      const selected = prev.photos[index];
      if (!selected) return prev;
      const remaining = prev.photos.filter((_, i) => i !== index);
      return { ...prev, photos: [selected, ...remaining] };
    });
    showToast('ප්‍රධාන ඡායාරූපය (Main Cover Photo) ලෙස සකසන ලදී!');
  };

  const handleAddPhotoField = () => {
    setFormData((prev) => ({ ...prev, photos: [...prev.photos, ''] }));
  };

  const handleUpdatePhotoField = (index: number, val: string) => {
    setFormData((prev) => {
      const next = [...prev.photos];
      next[index] = val;
      return { ...prev, photos: next };
    });
  };

  const handleRemovePhotoField = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };

  // Source handlers
  const handleAddSource = () => {
    setFormData((prev) => ({
      ...prev,
      sources: [...prev.sources, { title: '', url: '', publisher: '', verifiedDate: '' }],
    }));
  };

  const handleUpdateSource = (index: number, field: keyof ElephantSource, val: string) => {
    setFormData((prev) => {
      const next = [...prev.sources];
      next[index] = { ...next[index], [field]: val };
      return { ...prev, sources: next };
    });
  };

  const handleRemoveSource = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      sources: prev.sources.filter((_, i) => i !== index),
    }));
  };

  // Event handlers
  const handleOpenCreateEvent = () => {
    setEditingEventId(null);
    setEventFormData({
      title: '',
      sinhalaTitle: '',
      description: '',
      location: '',
      date: '',
      type: 'perahera',
      participatingElephants: [],
      isActive: true,
    });
    setEventElephantsText('');
  };

  const handleOpenEditEvent = (ev: CulturalEvent) => {
    setEditingEventId(ev.id || null);
    setEventFormData({
      title: ev.title,
      sinhalaTitle: ev.sinhalaTitle || '',
      description: ev.description,
      location: ev.location,
      date: ev.date,
      type: ev.type,
      participatingElephants: ev.participatingElephants || [],
      isActive: ev.isActive,
    });
    setEventElephantsText((ev.participatingElephants || []).join(', '));
  };

  const handleSubmitEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventFormData.title.trim()) {
      alert('Event title is required.');
      return;
    }
    const parsedElephants = eventElephantsText.split(',').map((s) => s.trim()).filter(Boolean);
    await onSaveEvent(
      {
        ...eventFormData,
        participatingElephants: parsedElephants,
      },
      editingEventId || undefined
    );
    showToast(editingEventId ? 'Event updated!' : 'Event created!');
    handleOpenCreateEvent();
  };

  // Filtered Elephants
  const filteredElephants = elephants.filter((el) => {
    if (filterType === 'tusker' && el.type !== 'tusker') return false;
    if (filterType === 'elephant' && el.type !== 'elephant') return false;
    if (filterType === 'verified' && !el.verified) return false;
    if (filterType === 'unverified' && el.verified) return false;
    if (filterType === 'featured' && !el.isFeatured) return false;
    if (filterType === 'live' && !el.isLive) return false;
    if (filterType === 'living' && el.status === 'memorial') return false;
    if (filterType === 'memorial' && el.status !== 'memorial') return false;

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      el.name.toLowerCase().includes(q) ||
      (el.sinhalaName && el.sinhalaName.includes(q)) ||
      (el.location && el.location.toLowerCase().includes(q)) ||
      (el.organization && el.organization.toLowerCase().includes(q))
    );
  });

  // Filtered Community Posts
  const filteredCommunityPosts = communityPosts.filter((post) => {
    if (postFilter === 'stories' && !post.isStory && !post.isStoryOnly) return false;
    if (postFilter === 'feed' && post.isStoryOnly) return false;

    if (!postsSearch) return true;
    const q = postsSearch.toLowerCase();
    return (
      post.elephantName.toLowerCase().includes(q) ||
      post.authorName.toLowerCase().includes(q) ||
      post.authorUsername.toLowerCase().includes(q) ||
      (post.caption && post.caption.toLowerCase().includes(q))
    );
  });

  // Export JSON Backup
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(elephants, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `alimedia_elephants_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Export Excel (.xlsx)
  const handleExportExcel = () => {
    const flattened = elephants.map((el, i) => ({
      '#': i + 1,
      'Elephant Name': el.name,
      'Sinhala Name': el.sinhalaName || '',
      'Other Names': (el.otherNames || []).join(', '),
      'Type': el.type,
      'Gender': el.gender,
      'Age': el.age || '',
      'Date of Birth': el.dateOfBirth || '',
      'Location': el.location,
      'Organization': el.organization,
      'Mahout': el.mahout || '',
      'Tusks Details': el.tusks || '',
      'Physical Characteristics': el.physicalCharacteristics || '',
      'Description': el.description,
      'Perahera Participation': (el.peraheraParticipation || []).join(', '),
      'Photos': (el.photos || []).join(', '),
      'Status': el.status || 'living',
      'Verified': el.verified ? 'TRUE' : 'FALSE',
      'Featured': el.isFeatured ? 'TRUE' : 'FALSE',
      'LIVE': el.isLive ? 'TRUE' : 'FALSE',
      'Custom Badge': el.customBadge || '',
    }));

    const ws = XLSX.utils.json_to_sheet(flattened);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Elephants');
    XLSX.writeFile(wb, `alimedia_elephants_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Export CSV (.csv)
  const handleExportCSV = () => {
    const flattened = elephants.map((el, i) => ({
      '#': i + 1,
      'Elephant Name': el.name,
      'Sinhala Name': el.sinhalaName || '',
      'Other Names': (el.otherNames || []).join(', '),
      'Type': el.type,
      'Gender': el.gender,
      'Age': el.age || '',
      'Date of Birth': el.dateOfBirth || '',
      'Location': el.location,
      'Organization': el.organization,
      'Mahout': el.mahout || '',
      'Tusks Details': el.tusks || '',
      'Physical Characteristics': el.physicalCharacteristics || '',
      'Description': el.description,
      'Perahera Participation': (el.peraheraParticipation || []).join(', '),
      'Photos': (el.photos || []).join(', '),
      'Status': el.status || 'living',
      'Verified': el.verified ? 'TRUE' : 'FALSE',
      'Featured': el.isFeatured ? 'TRUE' : 'FALSE',
      'LIVE': el.isLive ? 'TRUE' : 'FALSE',
      'Custom Badge': el.customBadge || '',
    }));

    const ws = XLSX.utils.json_to_sheet(flattened);
    const csvOutput = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alimedia_elephants_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // -------------------------------------------------------------
  // VIEW: Admin Login Screen
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 bg-[#062E22]/90 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-[#FAF9F5] w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-zinc-200 text-[#062E22] space-y-6 animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white border border-zinc-200 p-1 flex items-center justify-center shadow-md">
                <img
                  src="https://i.ibb.co/hRkdzTMy/file-0000000042e0820781e860d5f21352ee.png"
                  alt="අලිMedia Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h2 className="text-xl font-extrabold tracking-tight">අලිMedia Admin</h2>
                <p className="text-xs text-zinc-500 font-medium">පාලක මණ්ඩල ප්‍රවේශය (Full Control)</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-700 rounded-full hover:bg-zinc-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Error Alert */}
          {authError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs font-bold text-red-700 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-emerald-700" />
                <span>Admin Username / Email</span>
              </label>
              <input
                type="text"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="admin@alimedia.com"
                required
                className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none shadow-2xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-700" />
                <span>Password (මුරපදය)</span>
              </label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none shadow-2xs"
              />
            </div>

            {/* Quick Demo Credentials helper */}
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-xs text-emerald-950 space-y-1">
              <div className="font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>Default Admin Credentials:</span>
              </div>
              <p className="text-[11px] font-mono">
                Username: <b>admin@alimedia.com</b> <br />
                Password: <b>admin@alimedia</b>
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-[#062E22] hover:bg-emerald-800 text-white rounded-xl text-sm font-extrabold shadow-lg shadow-emerald-950/20 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>Login to Admin Console (ප්‍රවේශ වන්න)</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: Authenticated Full Admin Dashboard
  // -------------------------------------------------------------
  return (
    <div className="fixed inset-0 z-50 bg-[#F7F8F4] overflow-y-auto flex flex-col text-[#062E22] animate-fadeIn pb-16 sm:pb-8">
      {/* Toast feedback */}
      {statusMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#062E22] text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 text-xs font-bold animate-fadeIn border border-emerald-500/30">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Cascading Deletion Confirmation Modal */}
      {deletingElephantTarget && (
        <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-red-200 space-y-5 animate-scaleUp">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-red-950">
                  ස්ථිර මකා දැමීම (Cascade Delete)
                </h3>
                <p className="text-xs text-red-700 font-medium">
                  මෙම ක්‍රියාව ආපසු හැරවිය නොහැක (Permanent Action)
                </p>
              </div>
            </div>

            {/* Elephant Target Info */}
            <div className="bg-red-50/70 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
              <img
                src={deletingElephantTarget.photos?.[0] || PRESET_ELEPHANT_PHOTOS[0]}
                alt={deletingElephantTarget.name}
                className="w-14 h-14 rounded-xl object-cover border border-red-200"
              />
              <div className="min-w-0">
                <h4 className="font-extrabold text-sm text-red-950 truncate">
                  {deletingElephantTarget.name}
                </h4>
                <p className="text-xs text-red-800 font-sinhala truncate">
                  {deletingElephantTarget.sinhalaName || 'අලි පැතිකඩ'}
                </p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-200 text-red-900">
                  ID: {deletingElephantTarget.id}
                </span>
              </div>
            </div>

            {/* Cascade Cleanup Warning List */}
            <div className="space-y-2 text-xs text-zinc-700 bg-zinc-50 p-4 rounded-2xl border border-zinc-200">
              <p className="font-bold text-zinc-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-red-600" />
                <span>පහත සියලුම දත්ත Cloud Firestore වෙතින් ස්ථිරවම මකා දැමෙනු ඇත:</span>
              </p>
              <ul className="space-y-1.5 pl-5 list-disc text-zinc-600 text-[11px]">
                <li><b>Master Elephant Profile:</b> අලියාගේ සියලු ජීව දත්ත හා විස්තර</li>
                <li><b>Community Posts & Stories:</b> මෙම අලියාට අදාළව පරිශීලකයින් පළ කළ සියලු ඡායාරූප, Stories හා Posts</li>
                <li><b>Followers:</b> සියලු Users ගේ Followed Elephant lists වලින් ඉවත් කිරීම</li>
                <li><b>Cultural Events:</b> පෙරහැර සහභාගීත්ව සටහන් වලින් ඉවත් කිරීම</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingElephantTarget(null)}
                disabled={isDeletingCascade}
                className="px-4 py-2.5 rounded-xl border border-zinc-300 text-zinc-700 text-xs font-bold hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                අවලංගු කරන්න (Cancel)
              </button>
              <button
                type="button"
                onClick={handleConfirmCascadeDelete}
                disabled={isDeletingCascade}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold shadow-lg shadow-red-600/30 transition-all cursor-pointer flex items-center gap-2"
              >
                {isDeletingCascade ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>මකා දමමින් පවතී...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>ඔව්, සියල්ල මකා දමන්න (Delete All)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Top Header (Mobile Optimized) */}
      <header className="sticky top-0 z-40 bg-[#FAF9F5] border-b border-zinc-200/80 px-3 sm:px-6 py-2.5 sm:py-3 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo & Identity */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white border border-zinc-200 p-0.5 flex items-center justify-center shadow-md flex-shrink-0">
              <img
                src="https://i.ibb.co/hRkdzTMy/file-0000000042e0820781e860d5f21352ee.png"
                alt="අලිMedia Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-black text-sm sm:text-base tracking-tight text-[#062E22] truncate">
                  Admin <span className="text-emerald-600">Console</span>
                </h1>
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 uppercase">
                  Super Admin
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 font-mono truncate hidden sm:block">
                {DEFAULT_ADMIN_EMAIL}
              </p>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <button
              onClick={onClose}
              className="flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-xl text-xs font-bold text-[#062E22] shadow-2xs transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-emerald-700" />
              <span className="hidden sm:inline">View Website</span>
              <span className="sm:hidden">Exit</span>
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-xs font-bold text-red-700 transition-colors cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Categorized Navigation Bar (Responsive Scrollable Tabs) */}
      <div className="bg-white border-b border-zinc-200/90 sticky top-[49px] sm:top-[57px] z-30 shadow-xs px-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-2.5 no-scrollbar scroll-smooth">
          {/* Overview */}
          <button
            onClick={() => setAdminTab('overview')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 flex-shrink-0 ${
              adminTab === 'overview'
                ? 'bg-[#062E22] text-white shadow-sm'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>සාරාංශය (Overview)</span>
          </button>

          {/* Elephants List */}
          <button
            onClick={() => setAdminTab('elephants')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 flex-shrink-0 ${
              adminTab === 'elephants'
                ? 'bg-[#062E22] text-white shadow-sm'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>අලි නාමාවලිය ({elephants.length})</span>
          </button>

          {/* New / Edit Profile */}
          <button
            onClick={handleOpenCreateForm}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 flex-shrink-0 ${
              adminTab === 'editor'
                ? 'bg-[#062E22] text-white shadow-sm'
                : 'bg-emerald-700 text-white hover:bg-emerald-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{editingId ? 'සංස්කරණය (Edit)' : '+ නව අලියෙකු (Add Profile)'}</span>
          </button>

          {/* Community Posts & Stories */}
          <button
            onClick={() => setAdminTab('posts')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 flex-shrink-0 ${
              adminTab === 'posts'
                ? 'bg-[#062E22] text-white shadow-sm'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>පළකිරීම් & Stories ({communityPosts.length})</span>
          </button>

          {/* Cultural Events */}
          <button
            onClick={() => setAdminTab('events')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 flex-shrink-0 ${
              adminTab === 'events'
                ? 'bg-[#062E22] text-white shadow-sm'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>පෙරහැර වැඩසටහන් ({events.length})</span>
          </button>

          {/* Bulk Import */}
          <button
            onClick={() => setAdminTab('bulk_import')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 flex-shrink-0 ${
              adminTab === 'bulk_import'
                ? 'bg-[#062E22] text-white shadow-sm'
                : 'bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-xs'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Bulk Import (Excel/CSV)</span>
          </button>

          {/* Database & Tools */}
          <button
            onClick={() => setAdminTab('database')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 flex-shrink-0 ${
              adminTab === 'database'
                ? 'bg-[#062E22] text-white shadow-sm'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>පද්ධති උපස්ථ (Backup & DB)</span>
          </button>
        </div>
      </div>

      {/* Main Admin Content Container */}
      <main className="max-w-7xl mx-auto w-full p-3 sm:p-6 space-y-6 flex-1">
        {/* ============================================================= */}
        {/* CATEGORY 1: OVERVIEW & DASHBOARD                              */}
        {/* ============================================================= */}
        {adminTab === 'overview' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
              <div className="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-2xs">
                <div className="text-[10px] font-extrabold text-zinc-400 uppercase">Total Elephants</div>
                <div className="text-2xl font-black text-[#062E22] mt-1">{elephants.length}</div>
                <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">ලියාපදිංචි අලි</div>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-2xs">
                <div className="text-[10px] font-extrabold text-amber-600 uppercase flex items-center gap-1">
                  <Crown className="w-3 h-3" />
                  <span>Tuskers</span>
                </div>
                <div className="text-2xl font-black text-amber-900 mt-1">
                  {elephants.filter((e) => e.type === 'tusker').length}
                </div>
                <div className="text-[10px] text-zinc-400 font-semibold mt-0.5">දළ ඇතුන්</div>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-2xs">
                <div className="text-[10px] font-extrabold text-emerald-600 uppercase flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Verified</span>
                </div>
                <div className="text-2xl font-black text-emerald-900 mt-1">
                  {elephants.filter((e) => e.verified).length}
                </div>
                <div className="text-[10px] text-zinc-400 font-semibold mt-0.5">සත්‍යාපිත ලාංඡන</div>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-2xs">
                <div className="text-[10px] font-extrabold text-purple-600 uppercase flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  <span>Featured</span>
                </div>
                <div className="text-2xl font-black text-purple-900 mt-1">
                  {elephants.filter((e) => e.isFeatured).length}
                </div>
                <div className="text-[10px] text-zinc-400 font-semibold mt-0.5">Stories Spotlight</div>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-2xs">
                <div className="text-[10px] font-extrabold text-blue-600 uppercase flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  <span>Posts & Stories</span>
                </div>
                <div className="text-2xl font-black text-blue-900 mt-1">
                  {communityPosts.length}
                </div>
                <div className="text-[10px] text-zinc-400 font-semibold mt-0.5">පරිශීලක පළකිරීම්</div>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-2xs">
                <div className="text-[10px] font-extrabold text-rose-600 uppercase flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>Events</span>
                </div>
                <div className="text-2xl font-black text-rose-900 mt-1">{events.length}</div>
                <div className="text-[10px] text-zinc-400 font-semibold mt-0.5">පෙරහැර වැඩසටහන්</div>
              </div>
            </div>

            {/* Quick Action Shortcuts Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={handleOpenCreateForm}
                className="p-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl shadow-sm text-left transition-all cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <h4 className="font-extrabold text-sm flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    <span>නව අලියෙකු ලියාපදිංචි කරන්න</span>
                  </h4>
                  <p className="text-xs text-emerald-100 mt-1">
                    ඡායාරූප, ඇත් දළ විස්තර, පෙරහැර සහභාගීත්ව සටහන් එක් කරන්න.
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-emerald-200 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => setAdminTab('bulk_import')}
                className="p-4 bg-amber-500 hover:bg-amber-600 text-zinc-950 rounded-2xl shadow-sm text-left transition-all cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <h4 className="font-extrabold text-sm flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Excel / CSV තොග ඇතුළත් කිරීම</span>
                  </h4>
                  <p className="text-xs text-amber-950/80 mt-1">
                    අලි ඇතුන් 100+ ක් එකවර ක්ෂණිකව upload කරන්න.
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-900 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => setAdminTab('posts')}
                className="p-4 bg-[#062E22] hover:bg-emerald-950 text-white rounded-2xl shadow-sm text-left transition-all cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <h4 className="font-extrabold text-sm flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    <span>පරිශීලක Posts Moderation</span>
                  </h4>
                  <p className="text-xs text-zinc-300 mt-1">
                    පරිශීලකයින් submit කළ ඡායාරූප පරීක්ෂා කර පාලනය කරන්න.
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-400 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Recent Elephants Quick Peek */}
            <div className="bg-white rounded-3xl p-4 sm:p-6 border border-zinc-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black text-base text-[#062E22]">
                    අලුත්ම අලි පැතිකඩ (Recent Profiles)
                  </h3>
                  <p className="text-xs text-zinc-500 font-medium">
                    පද්ධතියේ ලියාපදිංචි කර ඇති ප්‍රමුඛ අලි ඇතුන්
                  </p>
                </div>
                <button
                  onClick={() => setAdminTab('elephants')}
                  className="text-xs font-extrabold text-emerald-700 hover:underline flex items-center gap-1"
                >
                  <span>සියල්ල බලන්න (View All)</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {elephants.slice(0, 6).map((el) => (
                  <div
                    key={el.id}
                    className="p-3 bg-zinc-50 rounded-2xl border border-zinc-200/80 flex items-center justify-between gap-3 hover:bg-emerald-50/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={el.photos?.[0] || PRESET_ELEPHANT_PHOTOS[0]}
                        alt={el.name}
                        className="w-11 h-11 rounded-xl object-cover border border-zinc-200 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-[#062E22] truncate flex items-center gap-1">
                          <span>{el.name}</span>
                          {el.verified && <ShieldCheck className="w-3 h-3 text-emerald-600" />}
                        </div>
                        <p className="text-[11px] text-zinc-500 font-sinhala truncate">
                          {el.sinhalaName || el.organization || 'Sri Lanka'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleOpenEditForm(el)}
                        className="p-1.5 text-zinc-500 hover:text-emerald-700 rounded-lg hover:bg-white transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleTriggerCascadeDelete(el)}
                        className="p-1.5 text-zinc-400 hover:text-red-600 rounded-lg hover:bg-white transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* CATEGORY 2: ELEPHANT DIRECTORY MANAGEMENT                      */}
        {/* ============================================================= */}
        {adminTab === 'elephants' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Search and Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3.5 sm:p-4 rounded-2xl border border-zinc-200 shadow-2xs">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="නම, ස්ථානය හෝ විහාරය සොයන්න..."
                  className="w-full pl-9 pr-3 py-2 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                />
              </div>

              {/* Filter chips (Mobile friendly scroll) */}
              <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar py-0.5">
                {[
                  { id: 'all', label: `All (${elephants.length})` },
                  { id: 'tusker', label: 'Tuskers (ඇත්තු)' },
                  { id: 'elephant', label: 'Elephants (අලින්)' },
                  { id: 'verified', label: 'Verified' },
                  { id: 'unverified', label: 'Unverified' },
                  { id: 'featured', label: 'Featured Stories' },
                  { id: 'live', label: 'LIVE' },
                  { id: 'memorial', label: 'Memorial' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilterType(f.id as any)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${
                      filterType === f.id
                        ? 'bg-[#062E22] text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile View: Responsive Elephant Cards */}
            <div className="block lg:hidden space-y-3">
              {filteredElephants.length === 0 ? (
                <div className="bg-white p-8 text-center rounded-3xl border border-zinc-200 text-zinc-400 text-xs">
                  කිසිදු හීලෑ අලියෙකු හමු නොවීය.
                </div>
              ) : (
                filteredElephants.map((el) => {
                  const isTusker = el.type === 'tusker';
                  const photo = el.photos?.[0] || PRESET_ELEPHANT_PHOTOS[0];

                  return (
                    <div
                      key={el.id}
                      className="bg-white rounded-2xl p-4 border border-zinc-200 shadow-2xs space-y-3"
                    >
                      {/* Top Row: Photo + Name + Type */}
                      <div className="flex items-center gap-3">
                        <img
                          src={photo}
                          alt={el.name}
                          className="w-14 h-14 rounded-2xl object-cover border border-zinc-200 flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-extrabold text-sm text-[#062E22] truncate">
                              {el.name}
                            </h4>
                            {el.verified && (
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600/20" />
                            )}
                          </div>
                          {el.sinhalaName && (
                            <p className="text-xs text-emerald-800 font-sinhala truncate">
                              {el.sinhalaName}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                isTusker ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                              }`}
                            >
                              {isTusker ? 'Tusker (ඇතා)' : 'Elephant (අලියා)'}
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              {el.age ? `${el.age} yrs` : 'N/A'} • {el.location || 'SL'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Quick Toggles Row (Touch optimized) */}
                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-zinc-100">
                        {/* Verified Toggle */}
                        <button
                          onClick={() => handleQuickVerify(el)}
                          className={`py-1.5 px-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${
                            el.verified
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : 'bg-zinc-100 text-zinc-500'
                          }`}
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>{el.verified ? 'Verified' : 'Verify'}</span>
                        </button>

                        {/* Featured Toggle */}
                        <button
                          onClick={() => handleQuickFeatured(el)}
                          className={`py-1.5 px-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${
                            el.isFeatured
                              ? 'bg-purple-100 text-purple-900 border border-purple-300'
                              : 'bg-zinc-100 text-zinc-500'
                          }`}
                        >
                          <Star className="w-3 h-3" />
                          <span>{el.isFeatured ? 'Featured' : 'Feature'}</span>
                        </button>

                        {/* Live Toggle */}
                        <button
                          onClick={() => handleQuickLive(el)}
                          className={`py-1.5 px-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${
                            el.isLive
                              ? 'bg-rose-100 text-rose-900 border border-rose-300'
                              : 'bg-zinc-100 text-zinc-500'
                          }`}
                        >
                          <Radio className="w-3 h-3" />
                          <span>{el.isLive ? 'LIVE' : 'Go LIVE'}</span>
                        </button>
                      </div>

                      {/* Card Action Buttons (Edit, View, Delete) */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-100">
                        <button
                          onClick={() => onViewElephant(el)}
                          className="flex-1 py-2 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-zinc-700 flex items-center justify-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                        <button
                          onClick={() => handleOpenEditForm(el)}
                          className="flex-1 py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-xs font-bold text-emerald-800 flex items-center justify-center gap-1.5"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleTriggerCascadeDelete(el)}
                          className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center"
                          title="Cascade Delete Elephant"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop View: High-density Table */}
            <div className="hidden lg:block bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF9F5] border-b border-zinc-200 text-zinc-500 font-extrabold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Elephant Profile</th>
                      <th className="py-3.5 px-3">Type & Age</th>
                      <th className="py-3.5 px-3">Organization / Location</th>
                      <th className="py-3.5 px-3 text-center">Verification Badge</th>
                      <th className="py-3.5 px-3 text-center">Featured Story</th>
                      <th className="py-3.5 px-3 text-center">LIVE Badge</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredElephants.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-zinc-400">
                          කිසිදු හීලෑ අලියෙකු හමු නොවීය.
                        </td>
                      </tr>
                    ) : (
                      filteredElephants.map((elephant) => {
                        const isTusker = elephant.type === 'tusker';
                        const photo = elephant.photos?.[0] || PRESET_ELEPHANT_PHOTOS[0];

                        return (
                          <tr key={elephant.id} className="hover:bg-zinc-50/80 transition-colors">
                            {/* Profile (Photo + Name) */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-full overflow-hidden bg-zinc-100 border-2 border-zinc-200 flex-shrink-0">
                                  <img
                                    src={photo}
                                    alt={elephant.name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <div className="font-extrabold text-sm text-[#062E22] truncate flex items-center gap-1.5">
                                    <span>{elephant.name}</span>
                                    {elephant.verified && (
                                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600/20" />
                                    )}
                                  </div>
                                  {elephant.sinhalaName && (
                                    <p className="text-[11px] text-emerald-800 font-sinhala truncate">
                                      {elephant.sinhalaName}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Type & Age */}
                            <td className="py-3 px-3">
                              <div className="space-y-1">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isTusker ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                                  }`}
                                >
                                  {isTusker ? 'Tusker (ඇතා)' : 'Elephant (අලියා)'}
                                </span>
                                <div className="text-[11px] text-zinc-400 font-mono">
                                  {elephant.age ? `${elephant.age} Years` : 'Age: N/A'}
                                </div>
                              </div>
                            </td>

                            {/* Organization & Location */}
                            <td className="py-3 px-3">
                              <div className="text-zinc-700 font-semibold truncate max-w-[180px]">
                                {elephant.organization || 'තොරතුරු නොමැත'}
                              </div>
                              <div className="text-[11px] text-zinc-400 truncate">
                                {elephant.location || 'Sri Lanka'}
                              </div>
                            </td>

                            {/* Verification Badge Toggle */}
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => handleQuickVerify(elephant)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-all cursor-pointer shadow-2xs ${
                                  elephant.verified
                                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200'
                                    : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600'
                                }`}
                              >
                                <ShieldCheck className="w-3 h-3" />
                                <span>{elephant.verified ? 'Verified (සත්‍යාපිතයි)' : 'Unverified'}</span>
                              </button>
                            </td>

                            {/* Featured Story Toggle */}
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => handleQuickFeatured(elephant)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-all cursor-pointer shadow-2xs ${
                                  elephant.isFeatured
                                    ? 'bg-purple-100 text-purple-900 border border-purple-300 hover:bg-purple-200'
                                    : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600'
                                }`}
                              >
                                <Star className="w-3 h-3" />
                                <span>{elephant.isFeatured ? 'Featured Story' : 'Standard'}</span>
                              </button>
                            </td>

                            {/* LIVE Badge Toggle */}
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => handleQuickLive(elephant)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-all cursor-pointer shadow-2xs ${
                                  elephant.isLive
                                    ? 'bg-rose-100 text-rose-900 border border-rose-300 animate-pulse hover:bg-rose-200'
                                    : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600'
                                }`}
                              >
                                <Radio className="w-3 h-3" />
                                <span>{elephant.isLive ? 'LIVE ACTIVE' : 'Offline'}</span>
                              </button>
                            </td>

                            {/* Actions (View / Edit / Delete) */}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => onViewElephant(elephant)}
                                  className="p-1.5 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
                                  title="View on Website"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleOpenEditForm(elephant)}
                                  className="p-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                  title="Edit Elephant"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleTriggerCascadeDelete(elephant)}
                                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Permanently Delete and Cascade Clean DB"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* CATEGORY 3: PROFILE EDITOR (ADD / EDIT FORM)                   */}
        {/* ============================================================= */}
        {adminTab === 'editor' && (
          <form onSubmit={handleSubmitElephant} className="space-y-6 animate-fadeIn pb-12">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-zinc-200 shadow-2xs">
              <div>
                <h3 className="text-base sm:text-lg font-black text-[#062E22] flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-500" />
                  <span>
                    {editingId ? `සංස්කරණය: ${formData.name || 'Elephant'}` : 'නව හීලෑ අලි පැතිකඩක් ලියාපදිංචි කිරීම'}
                  </span>
                </h3>
                <p className="text-xs text-zinc-500 font-medium">
                  ශ්‍රී ලාංකීය හීලෑ අලි ඇතුන්ගේ තොරතුරු නිවැරදිව ඇතුළත් කරන්න.
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setAdminTab('elephants')}
                  className="flex-1 sm:flex-initial px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  අවලංගු කරන්න (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 sm:flex-initial px-5 py-2 bg-[#062E22] hover:bg-emerald-800 text-white rounded-xl text-xs font-extrabold shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>සුරකිමින්...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>{editingId ? 'යාවත්කාලීන කරන්න' : 'සුරකින්න (Save)'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Section 1: Basic Identity */}
            <div className="bg-white rounded-3xl p-4 sm:p-6 border border-zinc-200 shadow-2xs space-y-4">
              <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-4 h-4 text-emerald-700" />
                <span>1. මූලික අනන්‍යතාව (Basic Identity & Profile Badges)</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Primary English Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-700">
                    Primary Name (English)*
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Indiraja / Kandula"
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>

                {/* Sinhala Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-700">
                    Sinhala Script Name (සිංහල නම)
                  </label>
                  <input
                    type="text"
                    value={formData.sinhalaName || ''}
                    onChange={(e) => setFormData({ ...formData, sinhalaName: e.target.value })}
                    placeholder="e.g. ඉන්දිරාජා"
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none font-sinhala"
                  />
                </div>

                {/* Type: Tusker vs Elephant */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-700">Type (වර්ගය)</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as ElephantType })}
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  >
                    <option value="tusker">Tusker (ඇතා - දළ සහිත)</option>
                    <option value="elephant">Elephant (අලියා / ඇලියා)</option>
                  </select>
                </div>

                {/* Gender */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-700">Gender (ස්ත්‍රී / පුරුෂ භාවය)</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as Gender })}
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  >
                    <option value="male">Male (පිරිමි)</option>
                    <option value="female">Female (ගැහැණු / ඇතින්න)</option>
                  </select>
                </div>

                {/* Age */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-700">Age / වයස (Years)</label>
                  <input
                    type="text"
                    value={formData.age || ''}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    placeholder="e.g. 45 or 40-45"
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-700">Status (තත්ත්වය)</label>
                  <select
                    value={formData.status || 'living'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  >
                    <option value="living">Living (ජීවත්වන)</option>
                    <option value="memorial">Memorial (අභාවප්‍රාප්ත / අනුස්මරණ)</option>
                  </select>
                </div>

                {/* Custom Badge */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-700">Custom Title / Badge</label>
                  <input
                    type="text"
                    value={formData.customBadge || ''}
                    onChange={(e) => setFormData({ ...formData, customBadge: e.target.value })}
                    placeholder="e.g. National Treasure / මංගල හස්තිරාජයා"
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>

                {/* Other Aliases */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-zinc-700">Other Aliases / වෙනත් නම් (Comma Separated)</label>
                  <input
                    type="text"
                    value={otherNamesText}
                    onChange={(e) => setOtherNamesText(e.target.value)}
                    placeholder="e.g. Maligawa Indiraja, Raja, Baby"
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Guardianship & Physical Characteristics */}
            <div className="bg-white rounded-3xl p-4 sm:p-6 border border-zinc-200 shadow-2xs space-y-4">
              <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-700" />
                <span>2. භාරකාරත්වය හා දේහ ලක්ෂණ (Guardianship & Physical Attributes)</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Organization */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-700">
                    Custodian / Temple / Organization (භාරකාර විහාරය / ආයතනය)
                  </label>
                  <input
                    type="text"
                    value={formData.organization}
                    onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                    placeholder="e.g. Sri Dalada Maligawa (ශ්‍රී දළදා මාළිගාව)"
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>

                {/* Location */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-700">Location (ස්ථානය / දිස්ත්‍රික්කය)</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. Kandy / මහනුවර"
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>

                {/* Mahout */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-700">Mahout / ඇත්ගොව්වා</label>
                  <input
                    type="text"
                    value={formData.mahout || ''}
                    onChange={(e) => setFormData({ ...formData, mahout: e.target.value })}
                    placeholder="e.g. K. G. Sunil / අනුර මහතා"
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>

                {/* Tusks Details */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-700">Tusk Characteristics (ඇත් දළ විස්තර)</label>
                  <input
                    type="text"
                    value={formData.tusks || ''}
                    onChange={(e) => setFormData({ ...formData, tusks: e.target.value })}
                    placeholder="e.g. දිගු සවිමත් යුගල දළ (Twin symmetrical curved tusks)"
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>

                {/* Physical Characteristics */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-zinc-700">
                    Physical Marks & Height (ශාරීරික ලක්ෂණ සහ උස)
                  </label>
                  <input
                    type="text"
                    value={formData.physicalCharacteristics || ''}
                    onChange={(e) => setFormData({ ...formData, physicalCharacteristics: e.target.value })}
                    placeholder="e.g. උස අඩි 9.5, තේජවන්ත පෙනුම, පුළුල් කුම්භස්ථලය, සමමිතික පිටිකොන්ද"
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>

                {/* Detailed Description */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-zinc-700">
                    Comprehensive Biography & Sacred History (සම්පූර්ණ ඉතිහාසය හා පසුබිම)*
                  </label>
                  <textarea
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="හීලෑ අලියාගේ ඓතිහාසික පසුබිම, පෙරහැර මංගල්‍යයන්හි ධාතු කරඬුව වැඩමවීම, පුදසත්කාර සහ සංස්කෘතික වටිනාකම..."
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Perahera Participation */}
            <div className="bg-white rounded-3xl p-4 sm:p-6 border border-zinc-200 shadow-2xs space-y-4">
              <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-700" />
                <span>3. පෙරහැර සහභාගීත්වය (Perahera Participation Checklist)</span>
              </h4>

              {/* Quick Select Chips */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-zinc-500">ප්‍රධාන පෙරහැර ඉක්මන් තේරීම:</div>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_PERAHERAS.map((p) => {
                    const cleanP = p.split('(')[0].trim();
                    const isSelected = peraheraText.includes(cleanP) || peraheraText.includes(p);
                    return (
                      <button
                        type="button"
                        key={p}
                        onClick={() => {
                          if (isSelected) {
                            setPeraheraText((prev) =>
                              prev
                                .split(',')
                                .map((s) => s.trim())
                                .filter((s) => !s.includes(cleanP))
                                .join(', ')
                            );
                          } else {
                            setPeraheraText((prev) => (prev ? `${prev}, ${p}` : p));
                          }
                        }}
                        className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-800 text-white shadow-xs'
                            : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '} {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700">
                  Selected Peraheras (Custom or Comma Separated)
                </label>
                <input
                  type="text"
                  value={peraheraText}
                  onChange={(e) => setPeraheraText(e.target.value)}
                  placeholder="Kandy Esala Perahera, Kelaniya Duruthu Perahera..."
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                />
              </div>
            </div>

            {/* Section 4: Photo Gallery & Mobile Compressed Uploader */}
            <div className="bg-white rounded-3xl p-4 sm:p-6 border border-zinc-200 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-emerald-700" />
                    <span>4. ඡායාරූප ගැලරිය (Photo Gallery & Mobile Upload)</span>
                  </h4>
                  <p className="text-[11px] text-zinc-500">
                    උපාංගයේ ඇති ඕනෑම ඡායාරූපයක් හෝ Image URLs එක් කරන්න.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={galleryInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files && handleGalleryFiles(e.target.files)}
                  />
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={isUploadingGallery}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    {isUploadingGallery ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Camera className="w-3.5 h-3.5" />
                    )}
                    <span>Upload from Phone / PC</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAddPhotoField}
                    className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    + Add URL
                  </button>
                </div>
              </div>

              {/* Photo Thumbnails List */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
                {formData.photos.map((photoUrl, idx) => (
                  <div
                    key={idx}
                    className="relative group bg-zinc-100 rounded-2xl overflow-hidden border border-zinc-200 aspect-square shadow-2xs"
                  >
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={`Elephant ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 p-2 text-center text-[10px]">
                        <ImageIcon className="w-5 h-5 mb-1" />
                        <span>No image</span>
                      </div>
                    )}

                    {/* Main Cover Badge */}
                    {idx === 0 && (
                      <span className="absolute top-2 left-2 bg-emerald-800/90 text-white px-2 py-0.5 rounded-full text-[9px] font-black shadow-md">
                        COVER PHOTO
                      </span>
                    )}

                    {/* Actions Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2">
                      {idx !== 0 && (
                        <button
                          type="button"
                          onClick={() => handleSetMainPhoto(idx)}
                          className="px-2 py-1 bg-white text-zinc-900 rounded-lg text-[10px] font-extrabold shadow-md hover:bg-emerald-50 cursor-pointer"
                        >
                          Make Cover
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemovePhotoField(idx)}
                        className="p-1.5 bg-red-600 text-white rounded-lg text-xs shadow-md hover:bg-red-700 cursor-pointer"
                        title="Remove photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 5: Sources & Verified Documentation */}
            <div className="bg-white rounded-3xl p-4 sm:p-6 border border-zinc-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-700" />
                  <span>5. මූලාශ්‍ර සහ ලේඛන (Sources & References)</span>
                </h4>
                <button
                  type="button"
                  onClick={handleAddSource}
                  className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  + Add Source Reference
                </button>
              </div>

              <div className="space-y-3">
                {formData.sources.map((src, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[#FAF9F5] rounded-2xl border border-zinc-200 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center"
                  >
                    <input
                      type="text"
                      placeholder="Source Title (e.g. Wildlife Dept Registry)"
                      value={src.title}
                      onChange={(e) => handleUpdateSource(idx, 'title', e.target.value)}
                      className="px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Publisher / Official Custodian"
                      value={src.publisher || ''}
                      onChange={(e) => handleUpdateSource(idx, 'publisher', e.target.value)}
                      className="px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Year / Verified Date (e.g. 2024)"
                        value={src.verifiedDate || ''}
                        onChange={(e) => handleUpdateSource(idx, 'verifiedDate', e.target.value)}
                        className="flex-1 px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                      />
                      {formData.sources.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSource(idx)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sticky Mobile / Desktop Action Bar */}
            <div className="sticky bottom-4 z-30 bg-[#062E22] text-white p-4 rounded-3xl shadow-2xl flex items-center justify-between gap-4 border border-emerald-500/30 animate-fadeIn">
              <div className="text-xs font-bold truncate">
                {editingId ? `සංස්කරණය: ${formData.name}` : 'නව අලි පැතිකඩක් ලියාපදිංචි කිරීම'}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAdminTab('elephants')}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  අවලංගු කරන්න
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{editingId ? 'යාවත්කාලීන කරන්න' : 'සුරකින්න (Save)'}</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ============================================================= */}
        {/* CATEGORY 4: COMMUNITY POSTS & STORIES MODERATION               */}
        {/* ============================================================= */}
        {adminTab === 'posts' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={postsSearch}
                  onChange={(e) => setPostsSearch(e.target.value)}
                  placeholder="අලියාගේ නම, පරිශීලකයා සොයන්න..."
                  className="w-full pl-9 pr-3 py-2 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <div className="flex gap-1 bg-zinc-100 p-1 rounded-xl">
                  <button
                    onClick={() => setPostFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      postFilter === 'all' ? 'bg-[#062E22] text-white' : 'text-zinc-600'
                    }`}
                  >
                    All ({communityPosts.length})
                  </button>
                  <button
                    onClick={() => setPostFilter('stories')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      postFilter === 'stories' ? 'bg-[#062E22] text-white' : 'text-zinc-600'
                    }`}
                  >
                    Stories Only
                  </button>
                  <button
                    onClick={() => setPostFilter('feed')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      postFilter === 'feed' ? 'bg-[#062E22] text-white' : 'text-zinc-600'
                    }`}
                  >
                    Feed Posts
                  </button>
                </div>

                <button
                  onClick={loadCommunityPosts}
                  disabled={isLoadingPosts}
                  className="p-2 bg-zinc-100 hover:bg-zinc-200 rounded-xl text-zinc-700"
                  title="Refresh Posts"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingPosts ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Posts Grid */}
            {isLoadingPosts ? (
              <div className="p-12 text-center text-zinc-400 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
                <span className="text-xs font-medium">පරිශීලක පළකිරීම් load වෙමින් පවතී...</span>
              </div>
            ) : filteredCommunityPosts.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-zinc-200 text-zinc-400 text-xs">
                පළකිරීම් කිසිවක් හමු නොවීය.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredCommunityPosts.map((post) => (
                  <div
                    key={post.id}
                    className="bg-white rounded-2xl overflow-hidden border border-zinc-200 shadow-2xs flex flex-col justify-between"
                  >
                    <div>
                      {/* Photo Thumbnail */}
                      <div className="relative aspect-4/3 bg-zinc-100 overflow-hidden">
                        <img
                          src={post.photoUrl}
                          alt={post.elephantName}
                          className="w-full h-full object-cover"
                        />
                        {post.isStoryOnly ? (
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-900/90 text-purple-200 backdrop-blur-xs">
                            STORY ONLY
                          </span>
                        ) : post.isStory ? (
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-900/90 text-emerald-200 backdrop-blur-xs">
                            FEED + STORY
                          </span>
                        ) : (
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-black bg-zinc-900/90 text-zinc-200 backdrop-blur-xs">
                            FEED
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-3.5 space-y-2">
                        {/* Target Elephant */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-emerald-800 flex items-center gap-1">
                            <Crown className="w-3.5 h-3.5 text-amber-500" />
                            <span>{post.elephantName}</span>
                          </span>
                          <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                            <Heart className="w-3 h-3 text-red-500 fill-red-500" />
                            <span>{post.likesCount || 0}</span>
                          </span>
                        </div>

                        {/* Caption */}
                        {post.caption && (
                          <p className="text-xs text-zinc-700 line-clamp-2">
                            "{post.caption}"
                          </p>
                        )}

                        {/* Author Info */}
                        <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                          <div className="w-6 h-6 rounded-full bg-zinc-200 overflow-hidden">
                            {post.authorPhotoURL ? (
                              <img
                                src={post.authorPhotoURL}
                                alt={post.authorName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-full h-full p-1 text-zinc-500" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold text-zinc-800 truncate">
                              {post.authorName}
                            </div>
                            <div className="text-[10px] text-zinc-400 font-mono truncate">
                              {post.authorUsername}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Delete Action Footer */}
                    <div className="p-3 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between">
                      <span className="text-[10px] text-zinc-400">Post ID: {post.id?.slice(0, 8)}...</span>
                      <button
                        onClick={() => post.id && handleDeletePost(post.id)}
                        className="px-3 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================= */}
        {/* CATEGORY 5: CULTURAL & PERAHERA EVENTS                         */}
        {/* ============================================================= */}
        {adminTab === 'events' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Event Form */}
            <div className="bg-white rounded-3xl p-4 sm:p-6 border border-zinc-200 shadow-2xs space-y-4">
              <h3 className="text-base font-black text-[#062E22] flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-700" />
                <span>
                  {editingEventId ? 'පෙරහැර නිවේදනය සංස්කරණය' : 'නව පෙරහැර / සංස්කෘතික නිවේදනයක් පළ කිරීම'}
                </span>
              </h3>

              <form onSubmit={handleSubmitEvent} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-700">Event Title (English)*</label>
                    <input
                      type="text"
                      required
                      value={eventFormData.title}
                      onChange={(e) => setEventFormData({ ...eventFormData, title: e.target.value })}
                      placeholder="e.g. Kandy Esala Perahera 2025"
                      className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-700">Sinhala Title (සිංහල නම)</label>
                    <input
                      type="text"
                      value={eventFormData.sinhalaTitle || ''}
                      onChange={(e) => setEventFormData({ ...eventFormData, sinhalaTitle: e.target.value })}
                      placeholder="e.g. මහනුවර ඇසළ මහා පෙරහැර මංගල්‍යය"
                      className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none font-sinhala"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-700">Location (ස්ථානය)</label>
                    <input
                      type="text"
                      value={eventFormData.location}
                      onChange={(e) => setEventFormData({ ...eventFormData, location: e.target.value })}
                      placeholder="e.g. Kandy / මහනුවර"
                      className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-700">Date & Schedule (දිනය)</label>
                    <input
                      type="text"
                      value={eventFormData.date}
                      onChange={(e) => setEventFormData({ ...eventFormData, date: e.target.value })}
                      placeholder="e.g. August 10 - 20, 2025"
                      className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-bold text-zinc-700">
                      Participating Elephants (සහභාගී වන අලි ඇතුන් - Comma separated)
                    </label>
                    <input
                      type="text"
                      value={eventElephantsText}
                      onChange={(e) => setEventElephantsText(e.target.value)}
                      placeholder="Indiraja, Myan Kumara, Vasana, Kandula..."
                      className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-bold text-zinc-700">Description (විස්තරය)</label>
                    <textarea
                      rows={3}
                      value={eventFormData.description}
                      onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })}
                      placeholder="පෙරහැර පිළිබඳ විශේෂ සටහන් සහ තොරතුරු..."
                      className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  {editingEventId && (
                    <button
                      type="button"
                      onClick={handleOpenCreateEvent}
                      className="px-4 py-2 bg-zinc-100 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-200"
                    >
                      Clear / New
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#062E22] hover:bg-emerald-800 text-white rounded-xl text-xs font-extrabold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    <span>{editingEventId ? 'යාවත්කාලීන කරන්න' : 'නිවේදනය පළ කරන්න (Publish)'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Events List */}
            <div className="space-y-3">
              <h4 className="font-extrabold text-sm text-[#062E22]">
                පළ කර ඇති පෙරහැර නිවේදන ({events.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h5 className="font-extrabold text-sm text-[#062E22]">{ev.title}</h5>
                          {ev.sinhalaTitle && (
                            <p className="text-xs text-emerald-800 font-sinhala">{ev.sinhalaTitle}</p>
                          )}
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900">
                          {ev.type}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-600 mt-2 line-clamp-2">{ev.description}</p>
                      <div className="text-[11px] text-zinc-500 font-medium mt-2 space-y-0.5">
                        <div>📍 {ev.location}</div>
                        <div>📅 {ev.date}</div>
                        {ev.participatingElephants && ev.participatingElephants.length > 0 && (
                          <div className="text-emerald-700 font-semibold truncate">
                            🐘 {ev.participatingElephants.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                      <button
                        onClick={() => handleOpenEditEvent(ev)}
                        className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => ev.id && onDeleteEvent(ev.id)}
                        className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* CATEGORY 6: BULK IMPORT (EXCEL / CSV)                          */}
        {/* ============================================================= */}
        {adminTab === 'bulk_import' && (
          <div className="animate-fadeIn">
            <BulkImportElephants
              onSaveElephant={onSaveElephant}
              existingElephants={elephants}
              language={language}
              onFinished={async () => {
                showToast('Bulk import finished successfully!');
                setAdminTab('elephants');
              }}
            />
          </div>
        )}

        {/* ============================================================= */}
        {/* CATEGORY 7: DATABASE TOOLS & BACKUPS                           */}
        {/* ============================================================= */}
        {adminTab === 'database' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Backup Cards */}
            <div className="bg-white rounded-3xl p-4 sm:p-6 border border-zinc-200 shadow-2xs space-y-4">
              <h3 className="text-base font-black text-[#062E22] flex items-center gap-2">
                <Download className="w-5 h-5 text-emerald-700" />
                <span>දත්ත ගොනු උපස්ථ කිරීම (Export Full Database)</span>
              </h3>
              <p className="text-xs text-zinc-500 font-medium">
                Cloud Firestore හි ඇති සියලුම හීලෑ අලි ඇතුන්ගේ තොරතුරු JSON, Excel හෝ CSV ආකාරයෙන් බාගත කරගන්න.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <button
                  onClick={handleExportExcel}
                  className="p-4 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-950 text-left transition-all cursor-pointer space-y-1 group"
                >
                  <div className="flex items-center justify-between">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
                    <Download className="w-4 h-4 text-emerald-700 group-hover:translate-y-0.5 transition-transform" />
                  </div>
                  <div className="font-extrabold text-sm mt-2">Export Excel (.xlsx)</div>
                  <div className="text-[11px] text-emerald-800">Microsoft Excel Spreadsheet</div>
                </button>

                <button
                  onClick={handleExportCSV}
                  className="p-4 rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-950 text-left transition-all cursor-pointer space-y-1 group"
                >
                  <div className="flex items-center justify-between">
                    <FileText className="w-5 h-5 text-blue-700" />
                    <Download className="w-4 h-4 text-blue-700 group-hover:translate-y-0.5 transition-transform" />
                  </div>
                  <div className="font-extrabold text-sm mt-2">Export CSV (.csv)</div>
                  <div className="text-[11px] text-blue-800">Comma-Separated Values Data</div>
                </button>

                <button
                  onClick={handleExportJSON}
                  className="p-4 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-950 text-left transition-all cursor-pointer space-y-1 group"
                >
                  <div className="flex items-center justify-between">
                    <Database className="w-5 h-5 text-amber-700" />
                    <Download className="w-4 h-4 text-amber-700 group-hover:translate-y-0.5 transition-transform" />
                  </div>
                  <div className="font-extrabold text-sm mt-2">Export JSON Backup</div>
                  <div className="text-[11px] text-amber-800">Raw JSON Structure Format</div>
                </button>
              </div>
            </div>

            {/* Seed Verified Data */}
            <div className="bg-white rounded-3xl p-4 sm:p-6 border border-zinc-200 shadow-2xs space-y-4">
              <h3 className="text-base font-black text-[#062E22] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <span>සත්‍යාපිත මූලික දත්ත ඇතුළත් කිරීම (Seed Verified Elephants)</span>
              </h3>
              <p className="text-xs text-zinc-500 font-medium">
                ශ්‍රී ලංකාවේ ප්‍රමුඛ දළ ඇතුන් (ඉන්දිරාජා, මියන් කුමාර, වාසනා, කණ්ඩුල ඇතුළු) සත්‍යාපිත දත්ත ගොනුව ක්ෂණිකව Firestore වෙත seed කරන්න.
              </p>

              <button
                onClick={async () => {
                  if (confirm('සත්‍යාපිත මූලික දත්ත Database එකට එක් කිරීමට ඔබට අවශ්‍යද?')) {
                    setIsSeeding(true);
                    await onSeedDatabase();
                    setIsSeeding(false);
                    showToast('මූලික දත්ත සාර්ථකව Firestore වෙත ඇතුළත් කෙරිණි!');
                  }
                }}
                disabled={isSeeding}
                className="px-5 py-3 bg-[#062E22] hover:bg-emerald-800 text-white rounded-xl text-xs font-extrabold shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                <span>{isSeeding ? 'දත්ත Seed වෙමින් පවතී...' : 'Seed Verified Elephant Registry'}</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
