import React, { useState, useEffect } from 'react';
import { Elephant, ElephantPost } from '../types/elephant';
import {
  X,
  Camera,
  Upload,
  Sparkles,
  Link as LinkIcon,
  Crown,
  Search,
  CheckCircle2,
  Lock,
  Radio,
  Image as ImageIcon,
  LogIn,
  Send,
  AlertCircle
} from 'lucide-react';
import { Language, translations, formatBilingualElephantName } from '../utils/translations';
import { useAuth } from '../firebase/authContext';
import { addElephantPost } from '../firebase/postService';

interface CreatePostModalProps {
  elephants: Elephant[];
  preselectedElephantId?: string;
  isStoryOnlyInitial?: boolean;
  language: Language;
  onClose: () => void;
  onPostSuccess: (newPost: ElephantPost, elephantId?: string) => void;
  onOpenAuthModal?: () => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  elephants,
  preselectedElephantId,
  isStoryOnlyInitial = false,
  language,
  onClose,
  onPostSuccess,
  onOpenAuthModal,
}) => {
  const t = translations[language];
  const { user, profile, loginWithGoogle, isFollowing, toggleFollowElephant } = useAuth();

  const [selectedElephantId, setSelectedElephantId] = useState<string>(preselectedElephantId || '');
  const [elephantSearch, setElephantSearch] = useState<string>('');
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [photoUrlInput, setPhotoUrlInput] = useState<string>('');
  const [useUrlMode, setUseUrlMode] = useState<boolean>(false);
  const [caption, setCaption] = useState<string>('');
  const [isStoryOnly, setIsStoryOnly] = useState<boolean>(isStoryOnlyInitial);
  const [autoShareStory, setAutoShareStory] = useState<boolean>(true);

  // Guest inputs if not signed in
  const [guestName, setGuestName] = useState<string>('');
  const [guestHandle, setGuestHandle] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Preselect if passed
  useEffect(() => {
    if (preselectedElephantId) {
      setSelectedElephantId(preselectedElephantId);
    }
  }, [preselectedElephantId]);

  useEffect(() => {
    if (isStoryOnlyInitial) {
      setIsStoryOnly(true);
    }
  }, [isStoryOnlyInitial]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setErrorMsg(language === 'si' ? 'ඡායාරූපය 20MB ට වඩා අඩු විය යුතුය.' : 'Photo must be under 20MB.');
      return;
    }

    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawData = event.target?.result as string;
      if (!rawData) return;

      // Set raw preview immediately so user sees it instantly
      setPhotoPreview(rawData);

      // Compress client-side in background for ultra-fast Firestore upload (< 100KB)
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX_DIM = 960;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_DIM) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.78);
            setPhotoPreview(compressed);
          }
        } catch {
          // Keep raw data if canvas fails
        }
      };
      img.src = rawData;
    };
    reader.readAsDataURL(file);
  };

  const handleApplyUrl = () => {
    if (!photoUrlInput.trim()) return;
    setPhotoPreview(photoUrlInput.trim());
  };

  const filteredElephants = elephants.filter((el) => {
    const query = elephantSearch.toLowerCase().trim();
    if (!query) return true;
    return (
      el.name.toLowerCase().includes(query) ||
      (el.sinhalaName && el.sinhalaName.toLowerCase().includes(query)) ||
      (el.location && el.location.toLowerCase().includes(query))
    );
  });

  const selectedElephantObj = elephants.find((e) => e.id === selectedElephantId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const imageToUse = photoPreview || photoUrlInput.trim();

    if (!imageToUse) {
      setErrorMsg(language === 'si' ? 'කරුණාකර ඡායාරූපයක් තෝරන්න.' : 'Please upload or provide a photo.');
      return;
    }

    if (!selectedElephantId || !selectedElephantObj) {
      setErrorMsg(language === 'si' ? 'කරුණාකර මෙම ඡායාරූපය අදාළ වන අලියා/ඇතා තෝරන්න.' : 'Please select an elephant profile.');
      return;
    }

    const finalAuthorName = profile?.displayName || user?.displayName || guestName.trim() || 'Elephant Enthusiast';
    const finalAuthorUsername = profile?.username || (guestHandle.trim() ? (guestHandle.startsWith('@') ? guestHandle.trim() : `@${guestHandle.trim()}`) : '@fan');
    const finalAuthorPhoto = profile?.photoURL || user?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80';

    try {
      setIsSubmitting(true);

      const postPayload: Omit<ElephantPost, 'id' | 'createdAt' | 'updatedAt'> = {
        elephantId: selectedElephantId,
        elephantName: selectedElephantObj.name,
        elephantSinhalaName: selectedElephantObj.sinhalaName || '',
        photoUrl: imageToUse,
        caption: caption.trim() || `${selectedElephantObj.name} (${selectedElephantObj.sinhalaName || ''})`,
        authorUid: user?.uid || '',
        authorName: finalAuthorName,
        authorUsername: finalAuthorUsername,
        authorPhotoURL: finalAuthorPhoto,
        likesCount: 0,
        likedBy: [],
        isStory: autoShareStory || isStoryOnly,
        isStoryOnly: isStoryOnly,
      };

      // Add to Firestore with safe timeout fallback
      const submitPromise = addElephantPost(postPayload);
      const timeoutPromise = new Promise<string>((resolve) => {
        setTimeout(() => {
          resolve('post_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
        }, 3500);
      });

      const newPostId = await Promise.race([submitPromise, timeoutPromise]);

      const createdPost: ElephantPost = {
        ...postPayload,
        id: newPostId,
        createdAt: new Date(),
      };

      // Ensure the elephant is followed so its story is immediately visible in the followed stories tray
      if (selectedElephantId && !isFollowing(selectedElephantId)) {
        try {
          await toggleFollowElephant(selectedElephantId);
        } catch {}
      }

      // Reset viewed timestamp for this elephant so it appears as fresh/unviewed at the front
      try {
        const raw = localStorage.getItem('alimedia_viewed_story_timestamps');
        const map = raw ? JSON.parse(raw) : {};
        delete map[selectedElephantId];
        localStorage.setItem('alimedia_viewed_story_timestamps', JSON.stringify(map));
      } catch {}

      onPostSuccess(createdPost, selectedElephantId);
    } catch (err: any) {
      console.error('Failed to publish post:', err);
      // Fallback local representation
      const fallbackId = 'local_' + Date.now();
      const fallbackPost: ElephantPost = {
        elephantId: selectedElephantId,
        elephantName: selectedElephantObj.name,
        elephantSinhalaName: selectedElephantObj.sinhalaName || '',
        photoUrl: imageToUse,
        caption: caption.trim() || `${selectedElephantObj.name}`,
        authorUid: user?.uid || '',
        authorName: finalAuthorName,
        authorUsername: finalAuthorUsername,
        authorPhotoURL: finalAuthorPhoto,
        likesCount: 0,
        likedBy: [],
        isStory: autoShareStory || isStoryOnly,
        isStoryOnly: isStoryOnly,
        id: fallbackId,
        createdAt: new Date(),
      };
      onPostSuccess(fallbackPost, selectedElephantId);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-[#121F1B] rounded-3xl shadow-2xl border border-zinc-200 dark:border-emerald-900/60 overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#062E22] to-emerald-900 text-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/30 flex items-center justify-center text-amber-300">
              {isStoryOnly ? <Radio className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="font-extrabold text-sm sm:text-base leading-tight">
                {isStoryOnly
                  ? (language === 'si' ? 'අලියාට Story එකක් එක්කරන්න' : 'Add Elephant Story')
                  : (language === 'si' ? 'නව ඡායාරූපයක් හෝ Story එකක් පළ කරන්න' : 'Share Photo / Story')}
              </h2>
              <p className="text-[11px] text-emerald-200">
                {isStoryOnly
                  ? (language === 'si' ? 'ඉහළ Stories තීරුවේ දිස්වේ (පැය 24 කින් අවසන් වේ)' : 'Visible in top Stories (expires in 24h)')
                  : (language === 'si' ? 'ශ්‍රී ලාංකීය අලි ඇතුන්ගේ සුන්දර මතකයන් බෙදාගන්න' : 'Share photos & stories with the community')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Photo Selection Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                <span>1. {language === 'si' ? 'ඡායාරූපය තෝරන්න' : 'Select Photo'} *</span>
              </label>
              <button
                type="button"
                onClick={() => setUseUrlMode(!useUrlMode)}
                className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <LinkIcon className="w-3 h-3" />
                <span>{useUrlMode ? (language === 'si' ? 'File Upload මඟින්' : 'File Upload') : (language === 'si' ? 'Web Link මඟින්' : 'Image URL')}</span>
              </button>
            </div>

            {photoPreview ? (
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-900 border-2 border-emerald-500 shadow-md group">
                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setPhotoPreview('');
                    setPhotoUrlInput('');
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-black text-white cursor-pointer shadow-md transition-all active:scale-95"
                  title="Remove photo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : useUrlMode ? (
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://example.com/elephant-photo.jpg"
                  value={photoUrlInput}
                  onChange={(e) => setPhotoUrlInput(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleApplyUrl}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  {language === 'si' ? 'යොදන්න' : 'Apply'}
                </button>
              </div>
            ) : (
              <label className="relative flex flex-col items-center justify-center aspect-[16/9] rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-emerald-500 dark:hover:border-emerald-400 bg-zinc-50 dark:bg-zinc-900/50 cursor-pointer group transition-all">
                <div className="flex flex-col items-center justify-center p-4 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                    <Upload className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <div>
                    <span className="text-xs font-extrabold text-zinc-800 dark:text-zinc-200 block">
                      {language === 'si' ? 'ඡායාරූපය තෝරාගන්න (Upload)' : 'Click to Upload Photo'}
                    </span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block mt-0.5">
                      JPEG, PNG, WEBP (Auto-optimized)
                    </span>
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* 2. Select Elephant Profile */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-wider flex items-center justify-between">
              <span>2. {language === 'si' ? 'අදාළ අලියා/ඇතා තෝරන්න' : 'Tag Elephant'} *</span>
              {selectedElephantObj && (
                <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-bold lowercase">
                  ✓ {selectedElephantObj.name}
                </span>
              )}
            </label>

            {/* Elephant Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder={language === 'si' ? 'ඇතුන්ගේ නම් සොයන්න (උදා: Raja, Millangoda)...' : 'Search elephant names...'}
                value={elephantSearch}
                onChange={(e) => setElephantSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Elephant List Picker */}
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 no-scrollbar border border-zinc-200 dark:border-zinc-800 rounded-2xl p-1.5 bg-zinc-50/50 dark:bg-zinc-900/30">
              {filteredElephants.map((el) => {
                const isSelected = el.id === selectedElephantId;
                const bilingual = formatBilingualElephantName(
                  { name: el.name, sinhalaName: el.sinhalaName },
                  language
                );
                return (
                  <div
                    key={el.id}
                    onClick={() => setSelectedElephantId(el.id)}
                    className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#062E22] text-white shadow-xs'
                        : 'bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-zinc-200/60 dark:border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                        <img
                          src={el.photos?.[0] || 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=200&q=80'}
                          alt={el.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-extrabold text-xs truncate leading-tight">
                            {bilingual}
                          </span>
                        </div>
                        <span className={`text-[10px] truncate block ${isSelected ? 'text-emerald-200' : 'text-zinc-500'}`}>
                          {el.location || (language === 'si' ? 'ශ්‍රී ලංකාව' : 'Sri Lanka')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {el.type === 'tusker' && (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isSelected ? 'bg-amber-400 text-zinc-950' : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'}`}>
                          {language === 'si' ? 'ඇතා' : 'Tusker'}
                        </span>
                      )}
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Story vs Feed Mode Options */}
          <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/50 space-y-2">
            <div className="text-xs font-black text-[#062E22] dark:text-emerald-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{language === 'si' ? 'Story විකල්ප' : 'Story Options'}</span>
            </div>

            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoShareStory}
                onChange={(e) => setAutoShareStory(e.target.checked)}
                className="mt-0.5 rounded text-emerald-700 focus:ring-emerald-500"
              />
              <div className="text-[11px]">
                <span className="font-bold text-zinc-800 dark:text-zinc-200 block">
                  {language === 'si' ? 'Stories තීරුවට ස්වයංක්‍රීයව එක්කරන්න' : 'Auto Share to Story'}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400 text-[10px]">
                  {language === 'si' ? 'ඉහළින් ඇති 3s Stories Tray එකේ දිස්වේ.' : 'Displays in the top Stories row.'}
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2 cursor-pointer select-none border-t border-emerald-200/50 dark:border-emerald-900/40 pt-1.5">
              <input
                type="checkbox"
                checked={isStoryOnly}
                onChange={(e) => setIsStoryOnly(e.target.checked)}
                className="mt-0.5 rounded text-emerald-700 focus:ring-emerald-500"
              />
              <div className="text-[11px]">
                <span className="font-bold text-zinc-800 dark:text-zinc-200 block">
                  {language === 'si' ? 'Story-Only ක්‍රමය (පැය 24 කින් ඉවත් වේ)' : 'Story Only Mode (Expires in 24h)'}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400 text-[10px]">
                  {language === 'si' ? 'ප්‍රධාන Feed එකට නොදා Stories තීරුවේ පමණක් පැය 24ක් තබයි.' : 'Published exclusively to the Stories tray without feed placement.'}
                </span>
              </div>
            </label>
          </div>

          {/* 4. Caption */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-wider block">
              3. {language === 'si' ? 'විස්තරය / Caption (විකල්ප)' : 'Caption / Story'}
            </label>
            <textarea
              rows={2}
              placeholder={language === 'si' ? 'මෙම අවස්ථාව ගැන යමක් ලියන්න... (උදා: පෙරහැරේ ගමන් කරන අසිරිමත් මොහොතක්)' : 'Write a caption or memory for this elephant...'}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* 5. Author Info */}
          {!user && (
            <div className="p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  {language === 'si' ? 'ඔබේ විස්තර (Guest Author)' : 'Author Info'}
                </span>
                <button
                  type="button"
                  onClick={loginWithGoogle}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 shadow-2xs hover:bg-zinc-50"
                >
                  <LogIn className="w-3 h-3" />
                  <span>Google Login</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder={language === 'si' ? 'ඔබේ නම (Name)' : 'Your Name'}
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-xs"
                />
                <input
                  type="text"
                  placeholder="@username"
                  value={guestHandle}
                  onChange={(e) => setGuestHandle(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-xs font-mono"
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !photoPreview || !selectedElephantId}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#062E22] via-emerald-800 to-[#062E22] hover:from-emerald-900 hover:to-emerald-800 text-white font-extrabold text-xs sm:text-sm shadow-lg hover:shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-500/30"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{language === 'si' ? 'පළ කෙරෙමින් පවතී...' : 'Publishing...'}</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4 text-amber-300" />
                <span>
                  {isStoryOnly
                    ? (language === 'si' ? 'Story එක පළ කරන්න' : 'Publish Story')
                    : (language === 'si' ? 'ඡායාරූපය පළ කරන්න' : 'Publish Photo')}
                </span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
