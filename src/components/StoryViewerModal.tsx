import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Elephant } from '../types/elephant';
import {
  X,
  Heart,
  Share2,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  UserCheck,
  UserPlus,
  Crown,
  ExternalLink,
  User,
  Clock,
  Sparkles
} from 'lucide-react';
import { Language, translations, formatBilingualElephantName } from '../utils/translations';
import { useAuth } from '../firebase/authContext';
import { ElephantHeartPop } from './ElephantHeartPop';
import { toggleLikeElephantPost, formatRelativeTime } from '../firebase/postService';

export interface StoryItem {
  id: string;
  elephantId: string;
  elephantName: string;
  elephantSinhalaName?: string;
  photoUrl: string;
  caption?: string;
  authorName?: string;
  authorUsername?: string;
  authorPhotoURL?: string;
  createdAt?: any;
  linkedElephant?: Elephant;
  isFollowed?: boolean;
  isTusker?: boolean;
  likesCount?: number;
}

export interface ElephantStoryGroup {
  elephantId: string;
  elephantName: string;
  elephantSinhalaName?: string;
  avatarPhoto: string;
  coverPhoto: string;
  linkedElephant?: Elephant;
  isTusker?: boolean;
  isFollowed?: boolean;
  isLive?: boolean;
  isViewed?: boolean;
  latestStoryTimestamp?: number;
  stories: StoryItem[];
}

interface StoryViewerModalProps {
  storyGroups?: ElephantStoryGroup[];
  stories?: StoryItem[];
  initialGroupIndex?: number;
  initialSegmentIndex?: number;
  initialIndex?: number;
  language: Language;
  onClose: () => void;
  onSelectElephant: (elephant: Elephant) => void;
  onShowNotification?: (msg: string) => void;
  onMarkStoryViewed?: (elephantId: string) => void;
}

const FALLBACK_STORY_IMAGE =
  'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=1200&q=85';

// Exactly 6 seconds (6000ms) per story segment as requested by user
const STORY_DURATION_MS = 6000;

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  storyGroups,
  stories,
  initialGroupIndex = 0,
  initialSegmentIndex = 0,
  initialIndex = 0,
  language,
  onClose,
  onSelectElephant,
  onShowNotification,
  onMarkStoryViewed,
}) => {
  const t = translations[language];
  const { toggleFollowElephant, isFollowing, user } = useAuth();

  // Normalize groups
  const normalizedGroups: ElephantStoryGroup[] = React.useMemo(() => {
    if (storyGroups && storyGroups.length > 0) {
      return storyGroups.filter((g) => g && g.stories && g.stories.length > 0);
    }
    if (stories && stories.length > 0) {
      const map = new Map<string, ElephantStoryGroup>();
      stories.forEach((st) => {
        const key = st.elephantId || st.elephantName || 'default';
        if (!map.has(key)) {
          map.set(key, {
            elephantId: st.elephantId || '',
            elephantName: st.elephantName || 'Elephant',
            elephantSinhalaName: st.elephantSinhalaName,
            avatarPhoto: st.linkedElephant?.photos?.[0] || st.photoUrl || FALLBACK_STORY_IMAGE,
            coverPhoto: st.photoUrl || FALLBACK_STORY_IMAGE,
            linkedElephant: st.linkedElephant,
            isTusker: st.isTusker,
            isFollowed: st.isFollowed,
            stories: [],
          });
        }
        map.get(key)!.stories.push(st);
      });
      return Array.from(map.values());
    }
    return [];
  }, [storyGroups, stories]);

  const [currentGroupIdx, setCurrentGroupIdx] = useState<number>(() => {
    const start = storyGroups ? initialGroupIndex : 0;
    return Math.min(Math.max(0, start), Math.max(0, normalizedGroups.length - 1));
  });

  const [currentSegmentIdx, setCurrentSegmentIdx] = useState<number>(() => {
    return initialSegmentIndex || initialIndex || 0;
  });

  const [likes, setLikes] = useState<{ [id: string]: number }>({});
  const [userLiked, setUserLiked] = useState<{ [id: string]: boolean }>({});
  const [savedStories, setSavedStories] = useState<{ [id: string]: boolean }>({});
  const [progress, setProgress] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [imgLoaded, setImgLoaded] = useState<boolean>(true);
  const [imgError, setImgError] = useState<{ [id: string]: boolean }>({});
  const [heartAnim, setHeartAnim] = useState<{ show: boolean; pos?: { x: number; y: number } }>({ show: false });

  const lastTapRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());
  const elapsedRef = useRef<number>(0);

  const getEffectiveUid = (): string => {
    if (user?.uid) return user.uid;
    try {
      let saved = localStorage.getItem('alimedia_client_uid');
      if (!saved) {
        saved = 'guest_' + Math.random().toString(36).substring(2, 12);
        localStorage.setItem('alimedia_client_uid', saved);
      }
      return saved;
    } catch {
      return 'guest_anon';
    }
  };

  const currentGroup = normalizedGroups[currentGroupIdx] || normalizedGroups[0];
  const groupStories = currentGroup?.stories || [];
  const currentStory = groupStories[currentSegmentIdx] || groupStories[0];

  // Mark currently viewed elephant story as viewed
  useEffect(() => {
    if (currentGroup?.elephantId) {
      if (onMarkStoryViewed) {
        onMarkStoryViewed(currentGroup.elephantId);
      }
      try {
        const raw = localStorage.getItem('alimedia_viewed_story_timestamps');
        const map = raw ? JSON.parse(raw) : {};
        map[currentGroup.elephantId] = Date.now();
        localStorage.setItem('alimedia_viewed_story_timestamps', JSON.stringify(map));
      } catch {}
    }
  }, [currentGroup?.elephantId, onMarkStoryViewed]);

  const triggerHeartAnimation = (pos?: { x: number; y: number }) => {
    setHeartAnim({ show: true, pos });
    setTimeout(() => {
      setHeartAnim({ show: false });
    }, 900);
  };

  // Move to next story segment, next elephant group, or auto-close
  const handleNext = useCallback(() => {
    setProgress(0);
    elapsedRef.current = 0;
    startTimeRef.current = Date.now();

    if (currentSegmentIdx < groupStories.length - 1) {
      setCurrentSegmentIdx((prev) => prev + 1);
    } else {
      if (currentGroupIdx < normalizedGroups.length - 1) {
        setCurrentGroupIdx((prev) => prev + 1);
        setCurrentSegmentIdx(0);
      } else {
        onClose();
      }
    }
  }, [currentSegmentIdx, groupStories.length, currentGroupIdx, normalizedGroups.length, onClose]);

  // Move to previous story segment or previous elephant group
  const handlePrev = useCallback(() => {
    setProgress(0);
    elapsedRef.current = 0;
    startTimeRef.current = Date.now();

    if (currentSegmentIdx > 0) {
      setCurrentSegmentIdx((prev) => prev - 1);
    } else {
      if (currentGroupIdx > 0) {
        const prevGroup = normalizedGroups[currentGroupIdx - 1];
        setCurrentGroupIdx((prev) => prev - 1);
        setCurrentSegmentIdx(Math.max(0, (prevGroup?.stories?.length || 1) - 1));
      }
    }
  }, [currentSegmentIdx, currentGroupIdx, normalizedGroups]);

  // Reset progress when segment or group changes
  useEffect(() => {
    setProgress(0);
    elapsedRef.current = 0;
    startTimeRef.current = Date.now();
  }, [currentGroupIdx, currentSegmentIdx]);

  // High-precision 6-second automatic timer with smooth progress fills
  useEffect(() => {
    if (isPaused || !currentStory) {
      return;
    }

    startTimeRef.current = Date.now() - elapsedRef.current;

    const interval = setInterval(() => {
      const now = Date.now();
      const currentElapsed = now - startTimeRef.current;
      elapsedRef.current = currentElapsed;

      const pct = (currentElapsed / STORY_DURATION_MS) * 100;

      if (pct >= 100) {
        setProgress(100);
        clearInterval(interval);
        handleNext();
      } else {
        setProgress(pct);
      }
    }, 25);

    return () => clearInterval(interval);
  }, [currentGroupIdx, currentSegmentIdx, isPaused, currentStory, handleNext]);

  // Keyboard navigation & lock scroll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleNext, handlePrev, onClose]);

  if (!currentGroup || !currentStory) {
    return null;
  }

  const elephantId = currentGroup.elephantId || currentStory.elephantId;
  const followingThisElephant = elephantId ? isFollowing(elephantId) : false;
  const effectiveUid = getEffectiveUid();
  const isLiked = userLiked[currentStory.id] !== undefined
    ? userLiked[currentStory.id]
    : false;
  const likeCount = likes[currentStory.id] !== undefined
    ? likes[currentStory.id]
    : (currentStory.likesCount || 0);
  const isSaved = !!savedStories[currentStory.id];

  const rawPhoto = currentStory.photoUrl || currentGroup.coverPhoto || currentGroup.avatarPhoto;
  const imageSrc = !imgError[currentStory.id] && rawPhoto ? rawPhoto : FALLBACK_STORY_IMAGE;

  const handleLike = async () => {
    const nextLiked = !isLiked;
    setUserLiked((prev) => ({ ...prev, [currentStory.id]: nextLiked }));
    setLikes((lp) => {
      const count = lp[currentStory.id] !== undefined ? lp[currentStory.id] : (currentStory.likesCount || 0);
      return { ...lp, [currentStory.id]: nextLiked ? count + 1 : Math.max(0, count - 1) };
    });

    if (nextLiked) {
      triggerHeartAnimation();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(25); } catch {}
      }
    }

    try {
      await toggleLikeElephantPost(currentStory.id, effectiveUid, false);
    } catch (err) {}
  };

  const handleDoubleClickStory = async (e: React.MouseEvent | React.TouchEvent) => {
    let pos: { x: number; y: number } | undefined = undefined;
    if ('clientX' in e && e.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect();
      pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    triggerHeartAnimation(pos);

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([35, 20]); } catch {}
    }

    if (!isLiked) {
      setUserLiked((prev) => ({ ...prev, [currentStory.id]: true }));
      setLikes((lp) => {
        const count = lp[currentStory.id] !== undefined ? lp[currentStory.id] : (currentStory.likesCount || 0);
        return { ...lp, [currentStory.id]: count + 1 };
      });

      try {
        await toggleLikeElephantPost(currentStory.id, effectiveUid, true);
      } catch (err) {}
    }
  };

  const handleTouchEndStory = (e: React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      handleDoubleClickStory(e);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  const handleBookmark = () => {
    setSavedStories((prev) => {
      const saved = !prev[currentStory.id];
      if (onShowNotification) {
        onShowNotification(
          saved
            ? (language === 'si' ? 'Story එක සුරැකි ලැයිස්තුවට එක්විය!' : 'Saved to bookmarks!')
            : (language === 'si' ? 'සුරැකි ලැයිස්තුවෙන් ඉවත් විය.' : 'Removed from bookmarks.')
        );
      }
      return { ...prev, [currentStory.id]: saved };
    });
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const bilingualName = formatBilingualElephantName(
      { name: currentGroup.elephantName, sinhalaName: currentGroup.elephantSinhalaName },
      language
    );

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${bilingualName} - Story (${currentSegmentIdx + 1}/${groupStories.length})`,
          text: currentStory.caption || `${bilingualName} Story on Aliya Media`,
          url: shareUrl,
        });
        return;
      } catch (err) {}
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      if (onShowNotification) {
        onShowNotification(language === 'si' ? 'සබැඳිය පිටපත් කරගන්නා ලදී!' : 'Story link copied!');
      }
    } catch (err) {}
  };

  const bilingualElephantName = formatBilingualElephantName(
    { name: currentGroup.elephantName, sinhalaName: currentGroup.elephantSinhalaName },
    language
  );

  const rawHandle = currentStory.authorUsername || currentStory.authorName || 'fan';
  const cleanUsername = rawHandle.startsWith('@') ? rawHandle : `@${rawHandle.toLowerCase().replace(/[^a-z0-9_]/g, '')}`;
  const relativeTimeStr = formatRelativeTime(currentStory.createdAt, language);

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] bg-black/95 flex items-center justify-center animate-fadeIn select-none backdrop-blur-lg"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Story Container Frame (9:16 mobile aspect) */}
      <div
        className="relative w-full h-full max-w-md max-h-[100dvh] sm:max-h-[92vh] sm:rounded-3xl overflow-hidden bg-zinc-950 flex flex-col justify-between shadow-2xl border border-white/10"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Background Story Image */}
        <div
          onDoubleClick={handleDoubleClickStory}
          onTouchEnd={handleTouchEndStory}
          className="absolute inset-0 z-0 select-none cursor-pointer bg-zinc-950 flex items-center justify-center"
        >
          <img
            src={imageSrc}
            alt={currentGroup.elephantName}
            onLoad={() => setImgLoaded(true)}
            onError={() => {
              setImgError((prev) => ({ ...prev, [currentStory.id]: true }));
              setImgLoaded(true);
            }}
            className="w-full h-full object-cover transition-opacity duration-300 pointer-events-none"
          />

          {/* Gradients for readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-transparent to-black/90 pointer-events-none" />

          {/* Paused Indicator Overlay when held */}
          {isPaused && (
            <div className="absolute top-20 right-4 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-amber-300 text-[10px] font-bold border border-white/15 animate-pulse flex items-center gap-1">
              <span>⏸</span>
              <span>{language === 'si' ? 'නැවතුණි' : 'Paused'}</span>
            </div>
          )}

          {/* Double-Tap AliMedia Elephant Heart Pop */}
          <ElephantHeartPop show={heartAnim.show} position={heartAnim.pos} />
        </div>

        {/* TOP HEADER: 6-SECOND PROGRESS BARS & ELEPHANT INFO */}
        <div className="relative z-20 p-3.5 sm:p-4 space-y-2.5 pointer-events-auto">
          {/* Progress Bars (Exact 6-second animated fill per slide) */}
          <div className="flex gap-1.5 w-full items-center">
            {groupStories.map((s, idx) => (
              <div
                key={s.id || idx}
                className="h-1 sm:h-1.5 flex-1 bg-white/25 rounded-full overflow-hidden backdrop-blur-xs relative"
              >
                <div
                  className="h-full bg-gradient-to-r from-amber-300 via-white to-amber-200 transition-all ease-linear rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                  style={{
                    width:
                      idx === currentSegmentIdx
                        ? `${Math.min(100, Math.max(0, progress))}%`
                        : idx < currentSegmentIdx
                        ? '100%'
                        : '0%',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Elephant Header Row */}
          <div className="flex items-center justify-between gap-2">
            {/* Left: Back Button + Elephant Avatar & Title */}
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="px-2.5 py-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition-all flex items-center gap-1 text-xs font-black border border-white/25 cursor-pointer shadow-md shrink-0 active:scale-95"
                title={language === 'si' ? 'මුල් පිටුවට ආපසු' : 'Back to Home'}
              >
                <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="hidden xs:inline">{language === 'si' ? 'ආපසු' : 'Back'}</span>
              </button>

              <div
                onClick={() => currentGroup.linkedElephant && onSelectElephant(currentGroup.linkedElephant)}
                className="flex items-center gap-2 cursor-pointer group min-w-0"
              >
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 to-emerald-400 shrink-0 shadow-md">
                  <div className="w-full h-full rounded-full overflow-hidden bg-zinc-900">
                    <img
                      src={currentGroup.avatarPhoto || imageSrc}
                      alt={currentGroup.elephantName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-black text-xs sm:text-sm text-white group-hover:text-amber-300 transition-colors truncate drop-shadow">
                      {bilingualElephantName}
                    </span>
                    {currentGroup.isTusker && (
                      <Crown className="w-3 h-3 text-amber-400 shrink-0 fill-amber-400" />
                    )}
                  </div>

                  <div className="text-[10px] text-zinc-300 font-medium truncate flex items-center gap-1.5">
                    {/* Visual cue: exact 6s per slide & segment counter */}
                    <span className="px-1.5 py-0.2 bg-amber-400/30 text-amber-300 rounded-md font-extrabold text-[9px] border border-amber-400/40">
                      {currentSegmentIdx + 1}/{groupStories.length} • 6s
                    </span>
                    <span className="hidden xs:inline">{t.storiesUpdates}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Follow & Close */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {elephantId && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFollowElephant(elephantId);
                  }}
                  className={`px-2.5 sm:px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-md active:scale-95 ${
                    followingThisElephant
                      ? 'bg-amber-400 text-zinc-950 hover:bg-amber-500'
                      : 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border border-white/20'
                  }`}
                >
                  {followingThisElephant ? (
                    <>
                      <UserCheck className="w-3 h-3 stroke-[2.5]" />
                      <span className="hidden xs:inline">{t.following}</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3 h-3 stroke-[2.5]" />
                      <span className="hidden xs:inline">{t.follow}</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-1.5 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md transition-colors cursor-pointer border border-white/20 active:scale-95"
                title={language === 'si' ? 'වසා දමන්න' : 'Close'}
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* TAP NAVIGATION ZONES (Left 30% for Prev, Right 70% for Next) */}
        <div className="absolute inset-y-20 inset-x-0 z-10 flex">
          <div
            onClick={handlePrev}
            className="w-1/3 h-full cursor-pointer opacity-0 hover:opacity-100 flex items-center justify-start pl-3 transition-opacity text-white/70"
            title="Previous Slide"
          >
            {(currentSegmentIdx > 0 || currentGroupIdx > 0) && (
              <div className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/20">
                <ChevronLeft className="w-5 h-5" />
              </div>
            )}
          </div>

          <div
            onClick={handleNext}
            className="w-2/3 h-full cursor-pointer opacity-0 hover:opacity-100 flex items-center justify-end pr-3 transition-opacity text-white/70"
            title="Next Slide"
          >
            <div className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <ChevronRight className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* BOTTOM AREA: USERNAME BADGE, CAPTION, PROFILE & LIKES */}
        <div className="relative z-20 p-3.5 sm:p-4 space-y-2 pointer-events-auto">
          {/* Author info pill */}
          <div className="flex items-center gap-2 bg-black/65 backdrop-blur-md px-3 py-1 rounded-full w-fit border border-white/15 shadow-sm">
            <div className="w-4 h-4 rounded-full overflow-hidden bg-emerald-900 flex items-center justify-center shrink-0 border border-amber-400/80">
              {currentStory.authorPhotoURL ? (
                <img src={currentStory.authorPhotoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-2.5 h-2.5 text-amber-300" />
              )}
            </div>
            <div className="flex items-center gap-1 text-[11px] leading-none">
              <span className="text-zinc-400 font-medium">Story by:</span>
              <span className="text-amber-300 font-bold font-mono">
                {cleanUsername}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-zinc-400 border-l border-white/20 pl-1.5 ml-0.5">
              <Clock className="w-2.5 h-2.5 text-zinc-400" />
              <span>{relativeTimeStr}</span>
            </div>
          </div>

          {/* Caption */}
          {currentStory.caption && (
            <div className="bg-black/65 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 text-white text-xs leading-relaxed">
              <p className="line-clamp-2">
                {currentStory.caption}
              </p>
            </div>
          )}

          {/* Profile link */}
          {currentGroup.linkedElephant && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onSelectElephant(currentGroup.linkedElephant!);
              }}
              className="w-full py-2 px-3.5 rounded-xl bg-gradient-to-r from-emerald-700 via-emerald-800 to-[#062E22] text-white font-black text-xs shadow-md hover:shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer border border-emerald-500/30"
            >
              <span>{t.viewProfile} ({bilingualElephantName})</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Action Row: Like, Share, Bookmark */}
          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-center gap-2">
              {/* Like Button */}
              <button
                type="button"
                onClick={handleLike}
                className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-bold backdrop-blur-md transition-all cursor-pointer border active:scale-95 ${
                  isLiked
                    ? 'bg-red-500/90 text-white border-red-400 shadow-md'
                    : 'bg-black/60 text-white hover:bg-black/80 border-white/20'
                }`}
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-white stroke-none' : ''}`} />
                <span>{likeCount}</span>
              </button>

              {/* Share Button */}
              <button
                type="button"
                onClick={handleShare}
                className="px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-bold bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer active:scale-95"
              >
                <Share2 className="w-4 h-4" />
                <span>{t.share}</span>
              </button>
            </div>

            {/* Bookmark */}
            <button
              type="button"
              onClick={handleBookmark}
              className={`p-2 rounded-full backdrop-blur-md transition-all cursor-pointer border active:scale-95 ${
                isSaved
                  ? 'bg-emerald-600 text-white border-emerald-400'
                  : 'bg-black/60 text-white hover:bg-black/80 border-white/20'
              }`}
              title="Bookmark Story"
            >
              <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-white stroke-none' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Mount to document.body via Portal to guarantee true full-screen overlay above all components
  if (typeof document !== 'undefined') {
    return ReactDOM.createPortal(modalContent, document.body);
  }
  return modalContent;
};
