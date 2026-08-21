import React, { useState, useEffect, useCallback } from 'react';
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
  stories: StoryItem[];
}

interface StoryViewerModalProps {
  storyGroups?: ElephantStoryGroup[];
  // For backwards compatibility or direct single-list passed
  stories?: StoryItem[];
  initialGroupIndex?: number;
  initialSegmentIndex?: number;
  initialIndex?: number;
  language: Language;
  onClose: () => void;
  onSelectElephant: (elephant: Elephant) => void;
  onShowNotification?: (msg: string) => void;
}

const FALLBACK_STORY_IMAGE =
  'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=1200&q=85';

const STORY_DURATION_MS = 3000; // Exactly 3 seconds per story segment as requested

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
}) => {
  const t = translations[language];
  const { toggleFollowElephant, isFollowing } = useAuth();

  // Normalize groups
  const normalizedGroups: ElephantStoryGroup[] = React.useMemo(() => {
    if (storyGroups && storyGroups.length > 0) {
      return storyGroups;
    }
    if (stories && stories.length > 0) {
      // Group flat stories list by elephant
      const map = new Map<string, ElephantStoryGroup>();
      stories.forEach((st) => {
        const key = st.elephantId || st.elephantName || 'default';
        if (!map.has(key)) {
          map.set(key, {
            elephantId: st.elephantId || '',
            elephantName: st.elephantName || 'Elephant',
            elephantSinhalaName: st.elephantSinhalaName,
            avatarPhoto: st.linkedElephant?.photos?.[0] || st.photoUrl,
            coverPhoto: st.photoUrl,
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
  const [imgError, setImgError] = useState<{ [id: string]: boolean }>({});

  const currentGroup = normalizedGroups[currentGroupIdx];
  const groupStories = currentGroup?.stories || [];
  const currentStory = groupStories[currentSegmentIdx] || groupStories[0];

  // Navigate to Next Segment or Next Elephant Group or Auto-Close to Home
  const handleNext = useCallback(() => {
    setProgress(0);
    if (currentSegmentIdx < groupStories.length - 1) {
      // Next story of SAME elephant
      setCurrentSegmentIdx((prev) => prev + 1);
    } else {
      // Finished all stories of current elephant -> Move to Next Elephant or Close
      if (currentGroupIdx < normalizedGroups.length - 1) {
        setCurrentGroupIdx((prev) => prev + 1);
        setCurrentSegmentIdx(0);
      } else {
        // All stories of all elephants finished -> Auto return to Home!
        onClose();
      }
    }
  }, [currentSegmentIdx, groupStories.length, currentGroupIdx, normalizedGroups.length, onClose]);

  // Navigate to Previous Segment or Previous Elephant Group
  const handlePrev = useCallback(() => {
    setProgress(0);
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

  // Reset progress when segment changes
  useEffect(() => {
    setProgress(0);
  }, [currentGroupIdx, currentSegmentIdx]);

  // 3-second automatic timer with smooth progress ticks
  useEffect(() => {
    if (isPaused || !currentStory) return;

    const intervalTime = 30; // 30ms smooth step
    const step = (intervalTime / STORY_DURATION_MS) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          handleNext();
          return 0;
        }
        return Math.min(100, prev + step);
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [currentGroupIdx, currentSegmentIdx, isPaused, currentStory, handleNext]);

  // Keyboard navigation
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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, onClose]);

  if (!currentGroup || !currentStory) {
    return null;
  }

  const elephantId = currentGroup.elephantId || currentStory.elephantId;
  const followingThisElephant = elephantId ? isFollowing(elephantId) : false;
  const isLiked = !!userLiked[currentStory.id];
  const likeCount = likes[currentStory.id] !== undefined ? likes[currentStory.id] : 34;
  const isSaved = !!savedStories[currentStory.id];
  const imageSrc =
    !imgError[currentStory.id] && currentStory.photoUrl
      ? currentStory.photoUrl
      : FALLBACK_STORY_IMAGE;

  const handleLike = () => {
    setUserLiked((prev) => {
      const liked = !prev[currentStory.id];
      setLikes((lp) => {
        const count = lp[currentStory.id] !== undefined ? lp[currentStory.id] : 34;
        return { ...lp, [currentStory.id]: liked ? count + 1 : Math.max(0, count - 1) };
      });
      return { ...prev, [currentStory.id]: liked };
    });
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
      } catch (err) {
        // User cancelled share
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      if (onShowNotification) {
        onShowNotification(language === 'si' ? 'සබැඳිය පිටපත් කරගන්නා ලදී!' : 'Story link copied!');
      }
    } catch (err) {
      // ignore
    }
  };

  const bilingualElephantName = formatBilingualElephantName(
    { name: currentGroup.elephantName, sinhalaName: currentGroup.elephantSinhalaName },
    language
  );

  // Format the username nicely for display
  const displayUsername = currentStory.authorUsername
    ? (currentStory.authorUsername.startsWith('@') ? currentStory.authorUsername : `@${currentStory.authorUsername}`)
    : currentStory.authorName
    ? `@${currentStory.authorName.toLowerCase().replace(/[^a-z0-9_]/g, '')}`
    : '@aliyamedia.lk';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center animate-fadeIn select-none backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Story Container Frame (Mobile Aspect 9:16) */}
      <div
        className="relative w-full h-full max-w-md max-h-[100dvh] sm:max-h-[92vh] sm:rounded-3xl overflow-hidden bg-zinc-950 flex flex-col justify-between shadow-2xl border border-white/10"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Background Fullscreen Image */}
        <div className="absolute inset-0 z-0">
          <img
            src={imageSrc}
            alt={currentGroup.elephantName}
            onError={() => setImgError((prev) => ({ ...prev, [currentStory.id]: true }))}
            className="w-full h-full object-cover transition-opacity duration-300"
          />
          {/* Subtle Top & Bottom dark gradients for text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/15 to-black/90 pointer-events-none" />
        </div>

        {/* Top Controls & Segment Progress Bars */}
        <div className="relative z-10 p-3 sm:p-4 space-y-2.5">
          {/* Progress Segments for THIS elephant (3s per segment) */}
          <div className="flex gap-1.5 w-full">
            {groupStories.map((s, idx) => (
              <div
                key={s.id || idx}
                className="h-1 sm:h-1.5 flex-1 bg-white/30 rounded-full overflow-hidden backdrop-blur-xs"
              >
                <div
                  className="h-full bg-white transition-all duration-75 ease-linear rounded-full"
                  style={{
                    width:
                      idx === currentSegmentIdx
                        ? `${progress}%`
                        : idx < currentSegmentIdx
                        ? '100%'
                        : '0%',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Top Header: Dedicated BACK BUTTON, Elephant Avatar, Bilingual Name, Follow Button, Close */}
          <div className="flex items-center justify-between gap-2">
            {/* Left side: Back Button + Elephant Avatar & Name */}
            <div className="flex items-center gap-2 min-w-0">
              {/* Prominent Back Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="px-2.5 py-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition-all flex items-center gap-1 text-xs font-extrabold border border-white/30 cursor-pointer shadow-md shrink-0 active:scale-95"
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
                      src={currentGroup.avatarPhoto || currentGroup.linkedElephant?.photos?.[0] || imageSrc}
                      alt={currentGroup.elephantName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-extrabold text-xs sm:text-sm text-white group-hover:text-amber-300 transition-colors truncate drop-shadow">
                      {bilingualElephantName}
                    </span>
                    {currentGroup.isTusker && (
                      <Crown className="w-3 h-3 text-amber-400 shrink-0 fill-amber-400" />
                    )}
                  </div>

                  <div className="text-[10px] text-zinc-300 font-medium truncate flex items-center gap-1.5">
                    {groupStories.length > 1 && (
                      <span className="px-1.5 py-0.2 bg-amber-400/30 text-amber-300 rounded font-bold text-[9px] border border-amber-400/40">
                        {currentSegmentIdx + 1}/{groupStories.length}
                      </span>
                    )}
                    <span>{t.storiesUpdates}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side: Follow Button + Close Button */}
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
                className="p-1.5 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-md transition-colors cursor-pointer border border-white/20 active:scale-95"
                title={language === 'si' ? 'වසා දමන්න' : 'Close'}
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Tap Navigation Overlays (Left for Prev, Right for Next) */}
        <div className="absolute inset-y-20 inset-x-0 z-0 flex">
          {/* Previous Tap Area (Left 33%) */}
          <div
            onClick={handlePrev}
            className="w-1/3 h-full cursor-pointer opacity-0 hover:opacity-100 flex items-center justify-start pl-3 transition-opacity text-white/70"
            title="Previous Segment"
          >
            {(currentSegmentIdx > 0 || currentGroupIdx > 0) && (
              <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20">
                <ChevronLeft className="w-5 h-5" />
              </div>
            )}
          </div>

          {/* Next Tap Area (Right 67%) */}
          <div
            onClick={handleNext}
            className="w-2/3 h-full cursor-pointer opacity-0 hover:opacity-100 flex items-center justify-end pr-3 transition-opacity text-white/70"
            title="Next Segment"
          >
            <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <ChevronRight className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Bottom Area: Story Info, Caption & Action Bar */}
        <div className="relative z-10 p-3 sm:p-4 space-y-2.5">
          {/* Small Uploader Username Badge at the bottom */}
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full w-fit border border-white/15 shadow-sm">
            <div className="w-4 h-4 rounded-full overflow-hidden bg-emerald-900 flex items-center justify-center shrink-0 border border-amber-400/80">
              {currentStory.authorPhotoURL ? (
                <img src={currentStory.authorPhotoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-2.5 h-2.5 text-amber-300" />
              )}
            </div>
            <div className="flex items-center gap-1 text-[11px] leading-none">
              <span className="text-zinc-400 font-medium">
                {language === 'si' ? 'Story එක් කළේ:' : 'Posted by:'}
              </span>
              <span className="text-amber-300 font-bold font-mono">
                {displayUsername}
              </span>
            </div>
            {currentStory.createdAt && (
              <div className="flex items-center gap-1 text-[10px] text-zinc-400 border-l border-white/20 pl-1.5 ml-0.5">
                <Clock className="w-2.5 h-2.5 text-zinc-400" />
                <span>
                  {typeof currentStory.createdAt === 'string'
                    ? currentStory.createdAt
                    : (language === 'si' ? 'මෑතකදී' : 'Recent')}
                </span>
              </div>
            )}
          </div>

          {/* Caption Box */}
          {currentStory.caption && (
            <div className="bg-black/60 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-white text-xs leading-relaxed space-y-1">
              <p className="line-clamp-3">
                {currentStory.caption}
              </p>
            </div>
          )}

          {/* View Elephant Profile Button */}
          {currentGroup.linkedElephant && (
            <button
              type="button"
              onClick={() => onSelectElephant(currentGroup.linkedElephant!)}
              className="w-full py-2 sm:py-2.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-800 to-[#062E22] text-white font-extrabold text-xs shadow-lg hover:shadow-xl active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer border border-emerald-500/30"
            >
              <span>{t.viewProfile} ({bilingualElephantName})</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Action Row: Like, Share, Save */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              {/* Like Button */}
              <button
                type="button"
                onClick={handleLike}
                className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-bold backdrop-blur-md transition-all cursor-pointer border active:scale-95 ${
                  isLiked
                    ? 'bg-red-500/80 text-white border-red-400'
                    : 'bg-black/50 text-white hover:bg-black/70 border-white/20'
                }`}
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-white stroke-none' : ''}`} />
                <span>{likeCount}</span>
              </button>

              {/* Share Button */}
              <button
                type="button"
                onClick={handleShare}
                className="px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-bold bg-black/50 hover:bg-black/70 text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer active:scale-95"
              >
                <Share2 className="w-4 h-4" />
                <span>{t.share}</span>
              </button>
            </div>

            {/* Save / Bookmark Button */}
            <button
              type="button"
              onClick={handleBookmark}
              className={`p-2 rounded-full backdrop-blur-md transition-all cursor-pointer border active:scale-95 ${
                isSaved
                  ? 'bg-emerald-600 text-white border-emerald-400'
                  : 'bg-black/50 text-white hover:bg-black/70 border-white/20'
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
};

