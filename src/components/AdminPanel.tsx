import React, { useState, useEffect, useRef } from 'react';
import {
  Elephant,
  CulturalEvent,
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
  Check
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Language, translations } from '../utils/translations';
import { BulkImportElephants } from './BulkImportElephants';

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
  onSaveElephant: (elephant: Omit<Elephant, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => Promise<void>;
  onDeleteElephant: (id: string) => Promise<void>;
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
  'Aluth Sahal Mangallaya (අලුත් සහල් මංගල්‍යය)'
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

  // Admin Navigation Tabs
  const [adminTab, setAdminTab] = useState<'elephants' | 'editor' | 'bulk_import' | 'events' | 'database'>('elephants');
  
  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'tusker' | 'elephant' | 'verified' | 'unverified' | 'featured'>('all');

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
  const [isDraggingOverGallery, setIsDraggingOverGallery] = useState(false);

  const showToast = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
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

  // Delete Elephant
  const handleDeleteElephantClick = async (elephant: Elephant) => {
    if (!elephant.id) return;
    if (confirm(`ඔබට "${elephant.name}" දත්ත ගොනුව ස්ථිරවම මකා දැමීමට අවශ්‍යද?`)) {
      await onDeleteElephant(elephant.id);
      showToast(`${elephant.name} දත්ත ගොනුව මකා දමන ලදී.`);
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

      showToast(`ඡායාරූප ${fileArray.length} ක් Gallery එකෙන් සාර්ථකව එක් කරන ලදී! (${fileArray.length} photo(s) uploaded)`);
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

  const handleSinglePhotoFile = async (index: number, file: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    try {
      setIsUploadingGallery(true);
      const compressedUrl = await compressImageFile(file, 1280, 1280, 0.85);
      setFormData((prev) => {
        const next = [...prev.photos];
        next[index] = compressedUrl;
        return { ...prev, photos: next };
      });
      showToast('ඡායාරූපය යාවත්කාලීන කරන ලදී! (Photo updated from gallery)');
    } catch (err) {
      console.error(err);
      alert('ඡායාරූපය upload කිරීමට නොහැකි විය.');
    } finally {
      setIsUploadingGallery(false);
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

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      el.name.toLowerCase().includes(q) ||
      (el.sinhalaName && el.sinhalaName.includes(q)) ||
      (el.location && el.location.toLowerCase().includes(q)) ||
      (el.organization && el.organization.toLowerCase().includes(q))
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
    <div className="fixed inset-0 z-50 bg-[#F7F8F4] overflow-y-auto flex flex-col text-[#062E22] animate-fadeIn">
      {/* Toast feedback */}
      {statusMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#062E22] text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 text-xs font-bold animate-fadeIn border border-emerald-500/30">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Admin Top Header */}
      <header className="sticky top-0 z-40 bg-[#FAF9F5] border-b border-zinc-200/80 px-4 py-3 shadow-2xs">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Logo & Admin Identity */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-zinc-200 p-0.5 flex items-center justify-center shadow-md">
              <img
                src="https://i.ibb.co/hRkdzTMy/file-0000000042e0820781e860d5f21352ee.png"
                alt="අලිMedia Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base sm:text-lg tracking-tight text-[#062E22]">
                  අලිMedia <span className="text-emerald-600">Admin Control</span>
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                  SUPER ADMIN
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 font-mono">
                Logged in as: {DEFAULT_ADMIN_EMAIL}
              </p>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-xl text-xs font-bold text-[#062E22] shadow-2xs transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-emerald-700" />
              <span>View Website (වෙබ් අඩවිය)</span>
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-xs font-bold text-red-700 transition-colors cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Admin Body Container */}
      <div className="max-w-6xl mx-auto w-full p-4 sm:p-6 space-y-6 flex-1">
        {/* Metric Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-2xs">
            <div className="text-[11px] font-bold text-zinc-400 uppercase">Total Elephants</div>
            <div className="text-2xl font-black text-[#062E22] mt-1">{elephants.length}</div>
            <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">ලියාපදිංචි අලි ඇතුන්</div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-2xs">
            <div className="text-[11px] font-bold text-amber-600 uppercase flex items-center gap-1">
              <Crown className="w-3 h-3" />
              <span>Tuskers (ඇත්තු)</span>
            </div>
            <div className="text-2xl font-black text-amber-900 mt-1">
              {elephants.filter((e) => e.type === 'tusker').length}
            </div>
            <div className="text-[10px] text-zinc-400 font-semibold mt-0.5">දළ ඇතුන් සංඛ්‍යාව</div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-2xs">
            <div className="text-[11px] font-bold text-emerald-600 uppercase flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              <span>Verified Badges</span>
            </div>
            <div className="text-2xl font-black text-emerald-900 mt-1">
              {elephants.filter((e) => e.verified).length}
            </div>
            <div className="text-[10px] text-zinc-400 font-semibold mt-0.5">සත්‍යාපිත ලාංඡන</div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-2xs">
            <div className="text-[11px] font-bold text-purple-600 uppercase flex items-center gap-1">
              <Star className="w-3 h-3" />
              <span>Featured Stories</span>
            </div>
            <div className="text-2xl font-black text-purple-900 mt-1">
              {elephants.filter((e) => e.isFeatured).length}
            </div>
            <div className="text-[10px] text-zinc-400 font-semibold mt-0.5">විශේෂාංග කතා</div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-2xs col-span-2 sm:col-span-1">
            <div className="text-[11px] font-bold text-blue-600 uppercase flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>Cultural Events</span>
            </div>
            <div className="text-2xl font-black text-blue-900 mt-1">{events.length}</div>
            <div className="text-[10px] text-zinc-400 font-semibold mt-0.5">පෙරහැර වැඩසටහන්</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3">
          <button
            onClick={() => setAdminTab('elephants')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              adminTab === 'elephants'
                ? 'bg-[#062E22] text-white shadow-sm'
                : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Elephant Profiles & Toggles (නාමාවලි පාලනය)</span>
          </button>

          <button
            onClick={handleOpenCreateForm}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              adminTab === 'editor'
                ? 'bg-[#062E22] text-white shadow-sm'
                : 'bg-emerald-700 text-white hover:bg-emerald-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{editingId ? 'Edit Elephant (සංස්කරණය)' : '+ New Elephant Profile (නව අලියෙකු එක් කරන්න)'}</span>
          </button>

          <button
            onClick={() => setAdminTab('bulk_import')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              adminTab === 'bulk_import'
                ? 'bg-[#062E22] text-white shadow-sm'
                : 'bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-xs'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Bulk Import (Excel / CSV තොග ඇතුළත් කිරීම)</span>
          </button>

          <button
            onClick={() => setAdminTab('events')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              adminTab === 'events'
                ? 'bg-[#062E22] text-white shadow-sm'
                : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Cultural & Perahera Events (පෙරහැර නිවේදන)</span>
          </button>

          <button
            onClick={() => setAdminTab('database')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              adminTab === 'database'
                ? 'bg-[#062E22] text-white shadow-sm'
                : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>System & Database Backup (දත්ත පද්ධතිය)</span>
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: Elephant Profiles & Quick Toggle Control Table */}
        {/* ------------------------------------------------------------- */}
        {adminTab === 'elephants' && (
          <div className="space-y-4">
            {/* Search and Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs">
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

              {/* Filter chips */}
              <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'tusker', label: 'Tuskers (ඇත්තු)' },
                  { id: 'elephant', label: 'Elephants (අලින්)' },
                  { id: 'verified', label: 'Verified' },
                  { id: 'unverified', label: 'Unverified' },
                  { id: 'featured', label: 'Featured' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilterType(f.id as any)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
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

            {/* Elephants List Table / Cards */}
            <div className="bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-sm">
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
                        const photo = elephant.photos && elephant.photos[0]
                          ? elephant.photos[0]
                          : PRESET_ELEPHANT_PHOTOS[0];

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

                            {/* Verification Badge Toggle (Requested feature) */}
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => handleQuickVerify(elephant)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer border ${
                                  elephant.verified
                                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200'
                                    : 'bg-zinc-100 text-zinc-500 border-zinc-300 hover:bg-zinc-200'
                                }`}
                                title="Click to Toggle Verification"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>{elephant.verified ? 'Verified ✓' : 'Unverified'}</span>
                              </button>
                            </td>

                            {/* Featured Story Toggle */}
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => handleQuickFeatured(elephant)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer border ${
                                  elephant.isFeatured
                                    ? 'bg-purple-100 text-purple-900 border-purple-300 hover:bg-purple-200'
                                    : 'bg-zinc-100 text-zinc-400 border-zinc-200 hover:bg-zinc-200'
                                }`}
                                title="Click to Toggle Story Spotlight"
                              >
                                <Star className="w-3.5 h-3.5" />
                                <span>{elephant.isFeatured ? 'Featured ⭐' : 'Regular'}</span>
                              </button>
                            </td>

                            {/* LIVE Badge Toggle */}
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => handleQuickLive(elephant)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer border ${
                                  elephant.isLive
                                    ? 'bg-red-100 text-red-900 border-red-300 hover:bg-red-200 animate-pulse'
                                    : 'bg-zinc-100 text-zinc-400 border-zinc-200 hover:bg-zinc-200'
                                }`}
                                title="Click to Toggle LIVE status"
                              >
                                <Radio className="w-3.5 h-3.5" />
                                <span>{elephant.isLive ? 'LIVE 🔴' : 'Off'}</span>
                              </button>
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => onViewElephant(elephant)}
                                  className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg transition-colors cursor-pointer"
                                  title="View Public Profile"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleOpenEditForm(elephant)}
                                  className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-lg transition-colors cursor-pointer"
                                  title="Edit Elephant Profile"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteElephantClick(elephant)}
                                  className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors cursor-pointer"
                                  title="Delete Profile"
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

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: Full Elephant Profile Creator & Editor Form */}
        {/* ------------------------------------------------------------- */}
        {adminTab === 'editor' && (
          <form onSubmit={handleSubmitElephant} className="space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200 shadow-sm space-y-6">
              {/* Form Title */}
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setAdminTab('elephants')}
                    className="p-2 text-zinc-500 hover:text-zinc-800 rounded-xl bg-zinc-100 hover:bg-zinc-200 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h2 className="text-xl font-extrabold text-[#062E22]">
                      {editingId ? 'Edit Elephant Profile (පැතිකඩ සංස්කරණය)' : 'Register New Elephant (නව අලියෙකු ලියාපදිංචි කිරීම)'}
                    </h2>
                    <p className="text-xs text-zinc-500">
                      සත්‍යාපිත තොරතුරු පමණක් ඇතුළත් කරන්න (Verified Data Only)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAdminTab('elephants')}
                    className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2 bg-[#062E22] hover:bg-emerald-800 text-white rounded-xl text-xs font-extrabold shadow-md flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSaving ? 'සුරැකෙමින් පවතී...' : 'Save Profile (සුරකින්න)'}</span>
                  </button>
                </div>
              </div>

              {/* 1. Basic Identifiers */}
              <div className="space-y-4">
                <h3 className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-700" />
                  <span>1. මූලික හඳුනාගැනීම (Primary Identity)</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-700 block mb-1">
                      Primary Name (ඉංග්‍රීසි නම) *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Indiraja"
                      required
                      className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-bold text-[#062E22] focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-700 block mb-1">
                      Sinhala Name (සිංහල නම)
                    </label>
                    <input
                      type="text"
                      value={formData.sinhalaName || ''}
                      onChange={(e) => setFormData({ ...formData, sinhalaName: e.target.value })}
                      placeholder="e.g. ඉන්දිරාජා"
                      className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-bold font-sinhala text-[#062E22] focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-700 block mb-1">
                      Aliases / Other Names (වෙනත් නම් - කොමා වලින් වෙන් කරන්න)
                    </label>
                    <input
                      type="text"
                      value={otherNamesText}
                      onChange={(e) => setOtherNamesText(e.target.value)}
                      placeholder="e.g. Indi Raja, Maligawa Indiraja"
                      className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs text-[#062E22] focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-1">
                  <div>
                    <label className="text-xs font-bold text-zinc-700 block mb-1">
                      Type (වර්ගය)
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as ElephantType })}
                      className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-bold text-[#062E22] focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    >
                      <option value="tusker">Tusker (ඇතා - දළ ඇතා)</option>
                      <option value="elephant">Elephant (අලියා / ඇතින්න)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-700 block mb-1">
                      Gender (ස්ත්‍රී / පුරුෂ භාවය)
                    </label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value as Gender })}
                      className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-bold text-[#062E22] focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    >
                      <option value="male">Male (පිරිමි)</option>
                      <option value="female">Female (ගැහැණු / ඇතින්න)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-700 block mb-1">
                      Estimated Age (වයස)
                    </label>
                    <input
                      type="number"
                      value={formData.age !== undefined ? formData.age : ''}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value ? Number(e.target.value) : '' })}
                      placeholder="e.g. 44"
                      className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-bold text-[#062E22] focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-700 block mb-1">
                      Status (තත්ත්වය)
                    </label>
                    <select
                      value={formData.status || 'living'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-bold text-[#062E22] focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    >
                      <option value="living">Living (ජීවතුන් අතර)</option>
                      <option value="memorial">Memorial / National Treasure (ජාතික වස්තුවක් වූ)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. Custody & Location */}
              <div className="space-y-4 pt-4 border-t border-zinc-100">
                <h3 className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-emerald-700" />
                  <span>2. භාරකාරත්වය සහ පිහිටීම (Custody & Location)</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-700 block mb-1">
                      Organization / Temple (විහාරය / භාරකාර ආයතනය)
                    </label>
                    <input
                      type="text"
                      value={formData.organization}
                      onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                      placeholder="e.g. Sri Dalada Maligawa (ශ්‍රී දළදා මාළිගාව)"
                      className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-semibold text-[#062E22] focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-700 block mb-1">
                      Location (නගරය / ප්‍රදේශය)
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="e.g. Kandy (මහනුවර)"
                      className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs font-semibold text-[#062E22] focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-700 block mb-1">
                      Mahout (ඇත්ගොව්වාගේ නම - තොරතුරු නොමැති නම් හිස්ව තබන්න)
                    </label>
                    <input
                      type="text"
                      value={formData.mahout || ''}
                      onChange={(e) => setFormData({ ...formData, mahout: e.target.value })}
                      placeholder="e.g. Somapala Mahout"
                      className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs text-[#062E22] focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Physical & Tusks */}
              <div className="space-y-4 pt-4 border-t border-zinc-100">
                <h3 className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-emerald-700" />
                  <span>3. දළ සහ ශාරීරික ලක්ෂණ (Tusks & Physical Characteristics)</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-700 block mb-1">
                      Tusks Description (දළ පිළිබඳ විස්තරය)
                    </label>
                    <input
                      type="text"
                      value={formData.tusks || ''}
                      onChange={(e) => setFormData({ ...formData, tusks: e.target.value })}
                      placeholder="e.g. දිගු සවිමත් යුගල දළ (Twin symmetrical ivory tusks)"
                      className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs text-[#062E22] focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-700 block mb-1">
                      Physical Characteristics (ශාරීරික ලක්ෂණ / උස)
                    </label>
                    <input
                      type="text"
                      value={formData.physicalCharacteristics || ''}
                      onChange={(e) => setFormData({ ...formData, physicalCharacteristics: e.target.value })}
                      placeholder="e.g. අඩි 9.8 ක උස, කැපී පෙනෙන කුම්භස්ථල, ගාම්භීර ගමන් විලාසය"
                      className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs text-[#062E22] focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-700 block mb-1">
                    Comprehensive Story & Historical Description (ඓතිහාසික පසුබිම සහ විස්තරය)
                  </label>
                  <textarea
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="අලියාගේ සම්භවය, ශ්‍රී දළදා මාළිගාවට පූජා කළ ආකාරය සහ සුවිශේෂී ඓතිහාසික තොරතුරු..."
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs text-[#062E22] focus:ring-2 focus:ring-emerald-700 focus:outline-none leading-relaxed"
                  />
                </div>
              </div>

              {/* 4. Perahera Participation */}
              <div className="space-y-3 pt-4 border-t border-zinc-100">
                <h3 className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-700" />
                  <span>4. පෙරහැර සහභාගීත්වය (Perahera Participation)</span>
                </h3>

                <input
                  type="text"
                  value={peraheraText}
                  onChange={(e) => setPeraheraText(e.target.value)}
                  placeholder="e.g. Kandy Esala Perahera, Kelaniya Duruthu Perahera (කොමා වලින් වෙන් කරන්න)"
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F5] border border-zinc-200 rounded-xl text-xs text-[#062E22] focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                />

                {/* Quick Add popular peraheras */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[11px] font-bold text-zinc-400 py-1">Quick Add:</span>
                  {POPULAR_PERAHERAS.map((perahera, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        const current = peraheraText ? peraheraText.split(',').map((s) => s.trim()) : [];
                        if (!current.includes(perahera)) {
                          setPeraheraText([...current, perahera].join(', '));
                        }
                      }}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-lg text-[11px] font-semibold border border-emerald-200 transition-colors cursor-pointer"
                    >
                      + {perahera.split('(')[0].trim()}
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. Photos Gallery Management (Direct Gallery Upload & URL Support) */}
              <div className="space-y-4 pt-4 border-t border-zinc-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-emerald-700" />
                      <span>5. ඡායාරූප සහ ගැලරිය (Photographs & Gallery)</span>
                    </h3>
                    <p className="text-[11px] text-zinc-500">
                      දුරකතනයේ Gallery එකෙන් කෙලින්ම ඡායාරූප upload කරන්න හෝ Photo URL එක්කරන්න.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Hidden Multi-file input for Gallery */}
                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => e.target.files && handleGalleryFiles(e.target.files)}
                    />
                    
                    <button
                      type="button"
                      disabled={isUploadingGallery}
                      onClick={() => galleryInputRef.current?.click()}
                      className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isUploadingGallery ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UploadCloud className="w-3.5 h-3.5" />
                      )}
                      <span>ගැලරියෙන් ඡායාරූප තෝරන්න (From Gallery)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleAddPhotoField}
                      className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>URL එකක් එක් කරන්න</span>
                    </button>
                  </div>
                </div>

                {/* Primary Gallery Drag & Drop / Click-to-Upload Banner */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingOverGallery(true);
                  }}
                  onDragLeave={() => setIsDraggingOverGallery(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingOverGallery(false);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      handleGalleryFiles(e.dataTransfer.files);
                    }
                  }}
                  onClick={() => galleryInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-4 sm:p-5 text-center cursor-pointer transition-all ${
                    isDraggingOverGallery
                      ? 'border-emerald-600 bg-emerald-50 scale-[1.01]'
                      : 'border-emerald-200 bg-[#FAF9F5] hover:bg-emerald-50/40 hover:border-emerald-500'
                  }`}
                >
                  {isUploadingGallery ? (
                    <div className="flex flex-col items-center justify-center py-2 space-y-2">
                      <Loader2 className="w-8 h-8 text-emerald-700 animate-spin" />
                      <p className="text-xs font-bold text-emerald-900">
                        ඡායාරූප සකසමින් පවතී... (Optimizing & Loading photos...)
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center space-y-1.5">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center">
                        <Camera className="w-5 h-5" />
                      </div>
                      <div className="font-bold text-xs text-[#062E22]">
                        දුරකතනයේ / පරිගණකයේ Gallery එකෙන් ඡායාරූප මෙතැනට Drag & Drop කරන්න හෝ Click කරන්න
                      </div>
                      <p className="text-[10px] text-zinc-500">
                        JPG, PNG, WebP (එක්වර ඡායාරූප කිහිපයක් තෝරාගත හැක / Multiple photos supported)
                      </p>
                    </div>
                  )}
                </div>

                {/* Photos List & Controls */}
                <div className="space-y-3">
                  {formData.photos.map((photo, idx) => {
                    const isMainCover = idx === 0;
                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-2xl border transition-all ${
                          isMainCover
                            ? 'bg-amber-50/60 border-amber-300 shadow-2xs'
                            : 'bg-[#FAF9F5] border-zinc-200'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          {/* Image preview & badges */}
                          <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className="relative w-14 h-14 rounded-xl bg-zinc-200 border border-zinc-300 overflow-hidden flex-shrink-0 shadow-inner">
                              {photo ? (
                                <img src={photo} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <ImageIcon className="w-5 h-5 text-zinc-400 m-auto mt-4" />
                              )}
                              {isMainCover && (
                                <div className="absolute top-0 left-0 bg-amber-400 text-zinc-950 p-0.5 rounded-br-lg shadow-sm">
                                  <Crown className="w-3 h-3" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-xs text-[#062E22]">
                                  Photo #{idx + 1}
                                </span>
                                {isMainCover ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-300 text-amber-950 border border-amber-400">
                                    ★ Cover Photo (ප්‍රධාන ඡායාරූපය)
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleSetMainPhoto(idx)}
                                    className="text-[10px] font-bold text-emerald-800 hover:text-emerald-950 hover:underline cursor-pointer flex items-center gap-0.5"
                                  >
                                    <Crown className="w-3 h-3 text-amber-500" />
                                    <span>ප්‍රධාන ඡායාරූපය කරන්න</span>
                                  </button>
                                )}
                              </div>

                              <div className="flex items-center gap-2 mt-1">
                                {/* Single photo gallery file picker */}
                                <label className="px-2.5 py-1 rounded-lg bg-white border border-zinc-300 hover:bg-zinc-50 text-[10px] font-bold text-zinc-700 cursor-pointer flex items-center gap-1 shadow-2xs">
                                  <Camera className="w-3 h-3 text-emerald-700" />
                                  <span>{photo ? 'ගැලරියෙන් මාරු කරන්න' : 'Gallery එකෙන් තෝරන්න'}</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleSinglePhotoFile(idx, file);
                                    }}
                                  />
                                </label>
                              </div>
                            </div>
                          </div>

                          {/* URL text input & delete button */}
                          <div className="flex items-center gap-2 w-full sm:flex-1 sm:max-w-md">
                            <input
                              type="text"
                              value={photo}
                              onChange={(e) => handleUpdatePhotoField(idx, e.target.value)}
                              placeholder="Image URL හෝ Base64 Data..."
                              className="flex-1 px-3 py-1.5 bg-white border border-zinc-300 rounded-xl text-[11px] text-[#062E22] focus:ring-2 focus:ring-emerald-700 focus:outline-none font-mono"
                            />
                            {formData.photos.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemovePhotoField(idx)}
                                className="p-2 text-red-600 hover:bg-red-100 rounded-xl transition-colors cursor-pointer shrink-0"
                                title="Delete photo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Preset Authentic Sri Lankan Elephant Photos Pickers */}
                <div className="pt-2 bg-[#FAF9F5] p-3 rounded-2xl border border-zinc-200/80">
                  <span className="text-[11px] font-bold text-zinc-600 block mb-1.5 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>හෝ සත්‍යාපිත පෙරහැර ඡායාරූප එකතුවෙන් තෝරන්න (Preset Photo Library):</span>
                  </span>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {PRESET_ELEPHANT_PHOTOS.map((preset, i) => (
                      <div
                        key={i}
                        onClick={() => {
                          if (!formData.photos.includes(preset)) {
                            setFormData({ ...formData, photos: [preset, ...formData.photos.filter(Boolean)] });
                            showToast('Preset photo added!');
                          }
                        }}
                        className="relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 border-transparent hover:border-emerald-600 transition-all group shadow-2xs"
                      >
                        <img src={preset} alt="" className="w-full h-full object-cover group-hover:scale-105" />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white text-[10px] font-bold">
                          + Use
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 6. Admin Control Toggles (Verification, Featured, LIVE) */}
              <div className="space-y-4 pt-4 border-t border-zinc-100">
                <h3 className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>6. පාලන ලාංඡන (Administrative Badges & Spotlight)</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Verified Toggle */}
                  <label className="flex items-center gap-3 p-3.5 bg-[#FAF9F5] rounded-2xl border border-zinc-200 cursor-pointer hover:border-emerald-500 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.verified}
                      onChange={(e) => setFormData({ ...formData, verified: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <div>
                      <div className="font-bold text-xs text-[#062E22] flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Verified Badge (සත්‍යාපිත ලාංඡනය)</span>
                      </div>
                      <p className="text-[10px] text-zinc-500">Show blue/green official verification mark</p>
                    </div>
                  </label>

                  {/* Featured Story Toggle */}
                  <label className="flex items-center gap-3 p-3.5 bg-[#FAF9F5] rounded-2xl border border-zinc-200 cursor-pointer hover:border-purple-500 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.isFeatured}
                      onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <div>
                      <div className="font-bold text-xs text-[#062E22] flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-purple-600" />
                        <span>Featured in Stories (විශේෂාංග කතාවක්)</span>
                      </div>
                      <p className="text-[10px] text-zinc-500">Pin to top horizontal carousel on Discover</p>
                    </div>
                  </label>

                  {/* LIVE Status Toggle */}
                  <label className="flex items-center gap-3 p-3.5 bg-[#FAF9F5] rounded-2xl border border-zinc-200 cursor-pointer hover:border-red-500 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.isLive}
                      onChange={(e) => setFormData({ ...formData, isLive: e.target.checked })}
                      className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                    />
                    <div>
                      <div className="font-bold text-xs text-[#062E22] flex items-center gap-1">
                        <Radio className="w-3.5 h-3.5 text-red-600" />
                        <span>LIVE Status Badge (සජීවී ලාංඡනය)</span>
                      </div>
                      <p className="text-[10px] text-zinc-500">Show animated pulsing LIVE mark</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* 7. Verified Sources */}
              <div className="space-y-3 pt-4 border-t border-zinc-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider">
                    7. සත්‍යාපිත මූලාශ්‍ර (Verifiable Sources)
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddSource}
                    className="px-3 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Source</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.sources.map((src, idx) => (
                    <div key={idx} className="p-3.5 bg-[#FAF9F5] rounded-2xl border border-zinc-200 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={src.title}
                          onChange={(e) => handleUpdateSource(idx, 'title', e.target.value)}
                          placeholder="Source Title (e.g. Maligawa Registry)"
                          className="px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs"
                        />
                        <input
                          type="text"
                          value={src.publisher || ''}
                          onChange={(e) => handleUpdateSource(idx, 'publisher', e.target.value)}
                          placeholder="Publisher / Authority"
                          className="px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs"
                        />
                        <input
                          type="url"
                          value={src.url || ''}
                          onChange={(e) => handleUpdateSource(idx, 'url', e.target.value)}
                          placeholder="Reference URL (Optional)"
                          className="px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-mono"
                        />
                      </div>
                      {formData.sources.length > 1 && (
                        <div className="text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveSource(idx)}
                            className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
                          >
                            Remove Source
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Action Submit Button */}
              <div className="pt-6 border-t border-zinc-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAdminTab('elephants')}
                  className="px-6 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-8 py-3 bg-[#062E22] hover:bg-emerald-800 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-emerald-950/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Saving to Database...' : 'Save Elephant Profile (සුරකින්න)'}</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: Cultural & Perahera Events Manager */}
        {/* ------------------------------------------------------------- */}
        {adminTab === 'events' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Events List */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-[#062E22]">
                  Active Cultural Events & Perahera Notices ({events.length})
                </h3>
                <button
                  onClick={handleOpenCreateEvent}
                  className="px-3 py-1.5 bg-[#062E22] text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ New Event</span>
                </button>
              </div>

              <div className="space-y-3">
                {events.map((ev) => (
                  <div
                    key={ev.id || ev.title}
                    className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-extrabold text-sm text-[#062E22]">{ev.title}</h4>
                        {ev.sinhalaTitle && (
                          <p className="text-xs text-emerald-800 font-sinhala">{ev.sinhalaTitle}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditEvent(ev)}
                          className="p-1.5 text-zinc-500 hover:text-emerald-700 rounded-lg hover:bg-zinc-100 cursor-pointer"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {ev.id && (
                          <button
                            onClick={() => onDeleteEvent(ev.id!)}
                            className="p-1.5 text-zinc-400 hover:text-red-600 rounded-lg hover:bg-zinc-100 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-zinc-600 leading-relaxed">{ev.description}</p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500 pt-1 border-t border-zinc-100">
                      <span>📍 {ev.location}</span>
                      <span>🗓️ {ev.date}</span>
                      {ev.participatingElephants && ev.participatingElephants.length > 0 && (
                        <span>🐘 {ev.participatingElephants.join(', ')}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Add/Edit Event Form */}
            <div className="bg-white p-5 rounded-3xl border border-zinc-200 shadow-sm space-y-4">
              <h3 className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider">
                {editingEventId ? 'Edit Event' : 'Add Cultural Event / Notice'}
              </h3>

              <form onSubmit={handleSubmitEvent} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Event Title *</label>
                  <input
                    type="text"
                    value={eventFormData.title}
                    onChange={(e) => setEventFormData({ ...eventFormData, title: e.target.value })}
                    placeholder="e.g. Kandy Esala Perahera"
                    required
                    className="w-full px-3 py-2 bg-[#FAF9F5] border border-zinc-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Sinhala Title</label>
                  <input
                    type="text"
                    value={eventFormData.sinhalaTitle || ''}
                    onChange={(e) => setEventFormData({ ...eventFormData, sinhalaTitle: e.target.value })}
                    placeholder="e.g. මහනුවර ඇසළ මහා පෙරහැර"
                    className="w-full px-3 py-2 bg-[#FAF9F5] border border-zinc-200 rounded-xl font-sinhala"
                  />
                </div>

                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Date / Month</label>
                  <input
                    type="text"
                    value={eventFormData.date}
                    onChange={(e) => setEventFormData({ ...eventFormData, date: e.target.value })}
                    placeholder="e.g. August 2025"
                    className="w-full px-3 py-2 bg-[#FAF9F5] border border-zinc-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Location</label>
                  <input
                    type="text"
                    value={eventFormData.location}
                    onChange={(e) => setEventFormData({ ...eventFormData, location: e.target.value })}
                    placeholder="e.g. Kandy"
                    className="w-full px-3 py-2 bg-[#FAF9F5] border border-zinc-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Participating Tuskers (Comma separated)</label>
                  <input
                    type="text"
                    value={eventElephantsText}
                    onChange={(e) => setEventElephantsText(e.target.value)}
                    placeholder="e.g. Indiraja, Myan Kumara, Vasana"
                    className="w-full px-3 py-2 bg-[#FAF9F5] border border-zinc-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={eventFormData.description}
                    onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })}
                    placeholder="Event details..."
                    className="w-full px-3 py-2 bg-[#FAF9F5] border border-zinc-200 rounded-xl"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#062E22] hover:bg-emerald-800 text-white rounded-xl font-bold cursor-pointer transition-colors shadow-sm"
                >
                  {editingEventId ? 'Update Notice' : 'Publish Event Notice'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB: Bulk Import Elephants via Excel / CSV                    */}
        {/* ------------------------------------------------------------- */}
        {adminTab === 'bulk_import' && (
          <BulkImportElephants
            existingElephants={elephants}
            onSaveElephant={onSaveElephant}
            language={language}
            onFinished={() => {
              setAdminTab('elephants');
              showToast('තොග දත්ත ඇතුළත් කිරීම සාර්ථකව අවසන් විය!');
            }}
          />
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 4: Database & System Tools */}
        {/* ------------------------------------------------------------- */}
        {adminTab === 'database' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Re-seed verified data */}
            <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-900 flex items-center justify-center font-bold">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#062E22]">
                    Re-Seed Official Sri Lankan Elephant Registry
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Indiraja, Myan Kumara, Vasana, Kandula, Nadungamuwa Raja, etc.
                  </p>
                </div>
              </div>

              <p className="text-xs text-zinc-600 leading-relaxed">
                මෙම බොත්තම ක්ලික් කිරීමෙන් නිල රාජ්‍ය සහ විහාර ලේඛනාගාර සත්‍යාපිත හීලෑ අලි සහ ඇතුන්ගේ මුල් වාර්තා නැවත Database එකට ඇතුළත් කෙරේ.
              </p>

              <button
                onClick={async () => {
                  if (confirm('සත්‍යාපිත මුල් වාර්තා නැවත පූරණය කිරීමට අවශ්‍යද?')) {
                    setIsSeeding(true);
                    await onSeedDatabase();
                    setIsSeeding(false);
                    showToast('මූලික දත්ත සාර්ථකව පූරණය විය!');
                  }
                }}
                disabled={isSeeding}
                className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isSeeding ? 'animate-spin' : ''}`} />
                <span>{isSeeding ? 'Seeding Verified Records...' : 'Seed Official Verified Elephants'}</span>
              </button>
            </div>

            {/* Export Backups (Excel, CSV, JSON) */}
            <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-900 flex items-center justify-center font-bold">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#062E22]">
                    Export Registry Data & Backups
                  </h3>
                  <p className="text-xs text-zinc-500">Download snapshot of all elephant profiles ({elephants.length} Records)</p>
                </div>
              </div>

              <p className="text-xs text-zinc-600 leading-relaxed">
                වෙබ් අඩවියේ ඇති සියලුම හීලෑ අලි වාර්තා Excel, CSV හෝ JSON ගොනුවක් ලෙස ඔබගේ පරිගණකයට බාගත කර සුරක්ෂිතව තබා ගන්න.
              </p>

              <div className="space-y-2 pt-1">
                <button
                  onClick={handleExportExcel}
                  className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
                  <span>Export to Excel Spreadsheet (.xlsx)</span>
                </button>

                <button
                  onClick={handleExportCSV}
                  className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4 text-amber-300" />
                  <span>Export to CSV File (.csv)</span>
                </button>

                <button
                  onClick={handleExportJSON}
                  className="w-full py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4 text-zinc-500" />
                  <span>Export JSON Backup (.json)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
