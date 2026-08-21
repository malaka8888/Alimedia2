import React, { useState, useRef, useEffect } from 'react';
import { Elephant, ElephantPost } from '../types/elephant';
import { useAuth } from '../firebase/authContext';
import { addElephantPost } from '../firebase/postService';
import { Language, translations } from '../utils/translations';
import {
  X,
  UploadCloud,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Crown,
  Search,
  Check,
  LogIn,
  Link as LinkIcon,
  Radio,
  Share2
} from 'lucide-react';
import { ElephantIcon } from './ElephantIcon';

interface CreatePostModalProps {
  elephants: Elephant[];
  preselectedElephantId?: string;
  isStoryOnlyInitial?: boolean;
  language: Language;
  onClose: () => void;
  onPostSuccess: (newPost: ElephantPost, updatedElephantId?: string) => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  elephants,
  preselectedElephantId,
  isStoryOnlyInitial = false,
  language,
  onClose,
  onPostSuccess,
}) => {
  const { user, profile, signInWithGoogle } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedElephantId, setSelectedElephantId] = useState<string>(preselectedElephantId || '');
  const [elephantSearch, setElephantSearch] = useState<string>('');
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [photoUrlInput, setPhotoUrlInput] = useState<string>('');
  const [isUrlMode, setIsUrlMode] = useState<boolean>(false);
  const [caption, setCaption] = useState<string>('');
  const [guestName, setGuestName] = useState<string>('');
  const [guestHandle, setGuestHandle] = useState<string>('');

  // User Request: Auto share to story checkbox & Story-only option
  const [autoShareStory, setAutoShareStory] = useState<boolean>(true);
  const [isStoryOnly, setIsStoryOnly] = useState<boolean>(isStoryOnlyInitial);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If preselectedElephantId changes, set it
  useEffect(() => {
    if (preselectedElephantId) {
      setSelectedElephantId(preselectedElephantId);
    }
  }, [preselectedElephantId]);

  useEffect(() => {
    if (isStoryOnlyInitial) {
      setIsStoryOnly(true);
      setAutoShareStory(true);
    }
  }, [isStoryOnlyInitial]);

  // Handle local image file upload from device gallery
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (max ~8MB)
    if (file.size > 8 * 1024 * 1024) {
      setErrorMsg(language === 'si' ? 'ඡායාරූපය 8MB ට වඩා අඩු විය යුතුය.' : 'Photo must be under 8MB.');
      return;
    }

    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setPhotoPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const handleApplyUrl = () => {
    if (!photoUrlInput.trim()) return;
    setPhotoPreview(photoUrlInput.trim());
  };

  // Filter elephants for the selector
  const filteredElephants = elephants.filter((el) => {
    const query = elephantSearch.toLowerCase().trim();
    if (!query) return true;
    return (
      el.name.toLowerCase().includes(query) ||
      (el.sinhalaName && el.sinhalaName.toLowerCase().includes(query)) ||
      (el.location && el.location.toLowerCase().includes(query)) ||
      (el.organization && el.organization.toLowerCase().includes(query))
    );
  });

  const selectedElephantObj = elephants.find((e) => e.id === selectedElephantId);

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const imageToUse = photoPreview || photoUrlInput.trim();

    if (!imageToUse) {
      setErrorMsg(language === 'si' ? 'කරුණාකර ඡායාරූපයක් තෝරන්න (Select a photo).' : 'Please upload or provide a photo.');
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
        likesCount: 1,
        isStory: autoShareStory || isStoryOnly,
        isStoryOnly: isStoryOnly,
      };

      const newPostId = await addElephantPost(postPayload);

      const createdPost: ElephantPost = {
        ...postPayload,
        id: newPostId,
        createdAt: new Date(),
      };

      onPostSuccess(createdPost, selectedElephantId);
    } catch (err: any) {
      console.error('Failed to publish post:', err);
      setErrorMsg(err.message || 'Failed to publish post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#062E22] via-[#0B4A37] to-[#041D15] p-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              {isStoryOnly ? (
                <Radio className="w-4 h-4 text-amber-300 animate-pulse" />
              ) : (
                <ElephantIcon className="w-4 h-4 text-amber-300" />
              )}
            </div>
            <div>
              <h2 className="font-extrabold text-sm sm:text-base">
                {isStoryOnly
                  ? (language === 'si' ? 'නව Story එකක් එක් කරන්න' : 'Add Elephant Story')
                  : (language === 'si' ? 'නව ඡායාරූපයක් / Post එකක්' : 'Add Elephant Photo / Post')}
              </h2>
              <p className="text-[10px] text-emerald-200/90">
                {isStoryOnly
                  ? (language === 'si' ? 'ඔබ අනුගමනය කරන අලි ඇතුන්ගේ Stories වෙත එක් වේ' : 'Visible in top Stories for followers')
                  : (language === 'si' ? 'අලි ඇතුන්ගේ සුන්දර ඡායාරූප Profile එකට එක්කරන්න' : 'Share moments with the revered tuskers')}
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

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: Photo Selector / Gallery Uploader */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-[#062E22] flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-700" />
                <span>1. {language === 'si' ? 'ඡායාරූපය තෝරන්න (Select Photo)' : 'Select Photo'} *</span>
              </label>
              
              <button
                type="button"
                onClick={() => setIsUrlMode(!isUrlMode)}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer flex items-center gap-1"
              >
                <LinkIcon className="w-3 h-3" />
                <span>{isUrlMode ? (language === 'si' ? 'Gallery එකෙන් ගන්න' : 'Upload from Device') : (language === 'si' ? 'Link එකක් දාන්න' : 'Use Web URL')}</span>
              </button>
            </div>

            {/* Hidden native file input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* If photo is selected, show preview */}
            {photoPreview ? (
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-100 border-2 border-emerald-600 shadow-inner group">
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-full bg-white text-zinc-900 font-bold text-xs shadow-lg hover:bg-zinc-100 cursor-pointer"
                  >
                    {language === 'si' ? 'වෙනස් කරන්න' : 'Change'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoPreview('');
                      setPhotoUrlInput('');
                    }}
                    className="px-3 py-1.5 rounded-full bg-red-600 text-white font-bold text-xs shadow-lg hover:bg-red-700 cursor-pointer"
                  >
                    {language === 'si' ? 'ඉවත් කරන්න' : 'Remove'}
                  </button>
                </div>
                <div className="absolute bottom-2 right-2 bg-[#062E22]/90 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                  ✓ Photo Ready
                </div>
              </div>
            ) : isUrlMode ? (
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://example.com/elephant-photo.jpg"
                  value={photoUrlInput}
                  onChange={(e) => setPhotoUrlInput(e.target.value)}
                  className="flex-1 p-3 text-xs rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-zinc-50"
                />
                <button
                  type="button"
                  onClick={handleApplyUrl}
                  className="px-4 py-2 bg-[#062E22] text-white text-xs font-bold rounded-xl cursor-pointer hover:bg-emerald-900"
                >
                  Apply
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-300 hover:border-emerald-700 bg-[#FAF9F5] hover:bg-emerald-50/40 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2 group"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#062E22]">
                    {language === 'si' ? 'ඔබගේ දුරකතනයේ Gallery එකෙන් ඡායාරූපයක් තෝරන්න' : 'Click to choose from device gallery'}
                  </p>
                  <p className="text-[10px] text-zinc-400">
                    JPG, PNG, WebP (Max 8MB)
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: Mandatory Elephant Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-[#062E22] flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              <span>2. {language === 'si' ? 'අලියා / ඇතා තෝරන්න (Select Elephant)' : 'Select Elephant Profile'} *</span>
            </label>

            {/* Search box for elephants */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder={language === 'si' ? 'අලියාගේ නම සොයන්න (උදා: Indiraja, කණ්ඩුල)...' : 'Search elephant by name...'}
                value={elephantSearch}
                onChange={(e) => setElephantSearch(e.target.value)}
                className="w-full pl-8.5 pr-3 py-2 text-xs rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-zinc-50"
              />
            </div>

            {/* Elephants List */}
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 border border-zinc-200 rounded-2xl p-2 bg-[#FAF9F5]">
              {filteredElephants.length === 0 ? (
                <div className="p-3 text-center text-xs text-zinc-400">
                  {language === 'si' ? 'අලි වාර්තා හමු නොවීය.' : 'No elephants found.'}
                </div>
              ) : (
                filteredElephants.map((el) => {
                  const isSelected = selectedElephantId === el.id;
                  const thumb = el.photos && el.photos.length > 0 ? el.photos[0] : '';
                  const isTusker = el.type === 'tusker';

                  return (
                    <div
                      key={el.id}
                      onClick={() => el.id && setSelectedElephantId(el.id)}
                      className={`p-2 rounded-xl flex items-center justify-between gap-2.5 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#062E22] text-white shadow-xs'
                          : 'bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-200/80'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-zinc-200 shrink-0">
                          <img src={thumb} alt={el.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-xs truncate">{el.name}</span>
                            {el.sinhalaName && (
                              <span className={`text-[10px] truncate ${isSelected ? 'text-emerald-200' : 'text-zinc-500'}`}>
                                ({el.sinhalaName})
                              </span>
                            )}
                          </div>
                          <p className={`text-[9px] truncate ${isSelected ? 'text-emerald-100/80' : 'text-zinc-400'}`}>
                            {el.organization || el.location}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1">
                        {isTusker && (
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${isSelected ? 'bg-amber-400 text-zinc-950' : 'bg-amber-100 text-amber-900'}`}>
                            Tusker
                          </span>
                        )}
                        {isSelected && (
                          <Check className="w-4 h-4 text-emerald-300" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {selectedElephantObj && (
              <p className="text-[11px] font-bold text-emerald-800 flex items-center gap-1 pt-0.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>{language === 'si' ? 'තෝරාගත් ඇතා:' : 'Target:'} <b>{selectedElephantObj.name}</b> {selectedElephantObj.sinhalaName ? `(${selectedElephantObj.sinhalaName})` : ''}</span>
              </p>
            )}
          </div>

          {/* USER REQUEST STEP: Auto Share Story & Story Only Checkbox Options */}
          <div className="p-3 bg-gradient-to-r from-emerald-50 via-[#FAF9F5] to-amber-50 rounded-2xl border border-emerald-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-[#062E22] flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>{language === 'si' ? 'Story සැකසුම් (Story Options)' : 'Story Options'}</span>
              </span>
            </div>

            {/* Checkbox 1: Auto share to Story */}
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoShareStory}
                onChange={(e) => setAutoShareStory(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-emerald-700 focus:ring-emerald-600 accent-emerald-800 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-[#062E22]">
                  {language === 'si' ? 'ස්වයංක්‍රීයව Story එකට එක් කරන්න (Auto Share Story)' : 'Auto Share to Story'}
                </span>
                <p className="text-[10px] text-zinc-500">
                  {language === 'si'
                    ? 'මෙම ඇතා follow කර සිටින සියලුම පරිශීලකයින්ගේ ඉහළ Stories තීරුවෙහි දිස්වේ.'
                    : 'Displays in the top Stories row of followers.'}
                </p>
              </div>
            </label>

            {/* Checkbox 2: Story Only (Do not show on main feed) */}
            <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1 border-t border-zinc-200/60">
              <input
                type="checkbox"
                checked={isStoryOnly}
                onChange={(e) => {
                  setIsStoryOnly(e.target.checked);
                  if (e.target.checked) setAutoShareStory(true);
                }}
                className="mt-0.5 w-4 h-4 rounded text-emerald-700 focus:ring-emerald-600 accent-emerald-800 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-[#062E22]">
                  {language === 'si' ? 'Story එකක් පමණක් දමන්න (Story Only)' : 'Story Only Mode'}
                </span>
                <p className="text-[10px] text-zinc-500">
                  {language === 'si'
                    ? 'Feed එකේ post එකක් ලෙස නොපෙන්වා Story එකක් ලෙස පමණක් බෙදාගනී.'
                    : 'Published exclusively to the Stories tray without feed placement.'}
                </p>
              </div>
            </label>
          </div>

          {/* STEP 3: Caption / Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-[#062E22]">
              3. {language === 'si' ? 'විස්තරය / Caption' : 'Caption / Story'}
            </label>
            <textarea
              rows={2}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={language === 'si' ? 'මෙම ඡායාරූපය පිළිබඳ විස්තරයක් හෝ පෙරහැරේ මතකයක් ලියන්න...' : 'Write a caption or festival story for this photo...'}
              className="w-full p-3 text-xs rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-zinc-50"
            />
            {/* Quick Tag Pills */}
            <div className="flex flex-wrap gap-1">
              {['🐘 #Perahara', '👑 #Tusker', '✨ #SriLanka', '🙏 #Dalada'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setCaption((prev) => `${prev} ${tag}`.trim())}
                  className="px-2 py-0.5 rounded-md bg-zinc-100 hover:bg-zinc-200 text-[10px] font-bold text-zinc-600 cursor-pointer"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* STEP 4: Author Attribution / Google Sign-in */}
          <div className="p-3 bg-[#FAF9F5] rounded-2xl border border-zinc-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-[#062E22]">
                {language === 'si' ? 'පළකරන්නාගේ විස්තර (Author)' : 'Author Info'}
              </span>

              {user || profile ? (
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                  <span>Google Account</span>
                </span>
              ) : null}
            </div>

            {user || profile ? (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-emerald-700">
                  <img
                    src={profile?.photoURL || user?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#062E22]">
                    {profile?.displayName || user?.displayName}
                  </div>
                  <div className="text-[10px] font-mono text-zinc-500">
                    {profile?.username || `@${user?.email?.split('@')[0] || 'fan'}`}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-zinc-500">
                    {language === 'si' ? 'ඔබගේ Google නමෙන් පළකරන්න:' : 'Post with your Google profile:'}
                  </p>
                  <button
                    type="button"
                    onClick={() => signInWithGoogle()}
                    className="px-2.5 py-1 bg-white hover:bg-zinc-50 border border-zinc-300 rounded-lg text-[10px] font-bold text-zinc-800 flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <LogIn className="w-3 h-3 text-emerald-700" />
                    <span>Google Login</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <input
                    type="text"
                    placeholder={language === 'si' ? 'ඔබගේ නම (Name)' : 'Your Name'}
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="p-2 text-xs rounded-lg border border-zinc-300 bg-white"
                  />
                  <input
                    type="text"
                    placeholder="@username (e.g. @malaka)"
                    value={guestHandle}
                    onChange={(e) => setGuestHandle(e.target.value)}
                    className="p-2 text-xs rounded-lg border border-zinc-300 bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !photoPreview}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#062E22] via-[#0B4A37] to-[#041D15] text-white font-extrabold text-sm shadow-xl hover:shadow-2xl active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{language === 'si' ? 'පළ කරමින් පවතී...' : 'Publishing...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>
                    {isStoryOnly
                      ? (language === 'si' ? 'Story එක පළ කරන්න (Publish Story)' : 'Publish Story')
                      : autoShareStory
                      ? (language === 'si' ? 'Post සහ Story පළ කරන්න' : 'Publish Post & Story')
                      : (language === 'si' ? 'Post එක පළ කරන්න' : 'Publish Post')}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
