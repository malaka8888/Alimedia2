import React, { useState, useEffect } from 'react';
import { Elephant } from '../types/elephant';
import {
  X,
  Heart,
  Share2,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserPlus,
  Crown,
  ExternalLink
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

interface StoryViewerModalProps {
  stories: StoryItem[];
  initialIndex: number;
  language: Language;
  onClose: () => void;
  onSelectElephant: (elephant: Elephant) => void;
  onShowNotification?: (msg: string) => void;
}

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  stories,
  initialIndex,
  language,
  onClose,
  onSelectElephant,
  onShowNotification,
}) => {
  const t = translations[language];
  const { toggleFollowElephant, isFollowing } = useAuth();
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);
  const [likes, setLikes] = useState<{ [id: string]: number }>({});
  const [userLiked, setUserLiked] = useState<{ [id: string]: boolean }>({});
  const [savedStories, setSavedStories] = useState<{ [id: string]: boolean }>({});
  const [progress, setProgress] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const currentStory = stories[currentIndex];

  const handleNext = () => {
    setProgress(0);
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    setProgress(0);
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // 5-second automatic story timer with progress bar
  useEffect(() => {
    if (isPaused) return;

    const intervalTime = 50; // 50ms ticks
    const step = 100 / (5000 / intervalTime);

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNext();
          return 0;
        }
        return prev + step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [currentIndex, isPaused, stories.length]);

  if (!currentStory) return null;

  const elephantId = currentStory.elephantId;
  const followingThisElephant = elephantId ? isFollowing(elephantId) : false;
  const isLiked = !!userLiked[currentStory.id];
  const likeCount = likes[currentStory.id] !== undefined ? likes[currentStory.id] : 42;
  const isSaved = !!savedStories[currentStory.id];

  const handleLike = () => {
    setUserLiked((prev) => {
      const liked = !prev[currentStory.id];
      setLikes((lp) => {
        const count = lp[currentStory.id] !== undefined ? lp[currentStory.id] : 42;
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
      { name: currentStory.elephantName, sinhalaName: currentStory.elephantSinhalaName },
      language
    );

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${bilingualName} - Elephant Story`,
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
    { name: currentStory.elephantName, sinhalaName: currentStory.elephantSinhalaName },
    language
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center animate-fadeIn select-none">
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
            src={currentStory.photoUrl}
            alt={currentStory.elephantName}
            className="w-full h-full object-cover"
          />
          {/* Subtle Top & Bottom dark gradients for readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90 pointer-events-none" />
        </div>

        {/* Top Controls & Segment Progress Bars */}
        <div className="relative z-10 p-3.5 space-y-2.5">
          {/* Progress Segments */}
          <div className="flex gap-1.5 w-full">
            {stories.map((s, idx) => (
              <div
                key={s.id || idx}
                className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-white transition-all duration-75 ease-linear rounded-full"
                  style={{
                    width:
                      idx === currentIndex
                        ? `${progress}%`
                        : idx < currentIndex
                        ? '100%'
                        : '0%',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Top Header: Elephant Avatar, Bilingual Name, Follow Button, Close */}
          <div className="flex items-center justify-between gap-2">
            <div
              onClick={() => currentStory.linkedElephant && onSelectElephant(currentStory.linkedElephant)}
              className="flex items-center gap-2 cursor-pointer group min-w-0"
            >
              <div className="w-9 h-9 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 to-emerald-400 shrink-0">
                <div className="w-full h-full rounded-full overflow-hidden bg-zinc-900">
                  <img
                    src={currentStory.linkedElephant?.photos?.[0] || currentStory.photoUrl}
                    alt={currentStory.elephantName}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-xs text-white group-hover:text-amber-300 transition-colors truncate drop-shadow">
                    {bilingualElephantName}
                  </span>
                  {currentStory.isTusker && (
                    <Crown className="w-3 h-3 text-amber-400 shrink-0 fill-amber-400" />
                  )}
                </div>

                <div className="text-[10px] text-zinc-300 font-medium truncate flex items-center gap-1">
                  <span>
                    {currentStory.authorUsername || currentStory.authorName
                      ? `${t.by} ${currentStory.authorUsername || currentStory.authorName}`
                      : t.verifiedRegistry}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Follow Button + Close Button */}
            <div className="flex items-center gap-2 shrink-0">
              {elephantId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFollowElephant(elephantId);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-md ${
                    followingThisElephant
                      ? 'bg-amber-400 text-zinc-950 hover:bg-amber-500'
                      : 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border border-white/20'
                  }`}
                >
                  {followingThisElephant ? (
                    <>
                      <UserCheck className="w-3 h-3 stroke-[2.5]" />
                      <span>{t.following}</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3 h-3 stroke-[2.5]" />
                      <span>{t.follow}</span>
                    </>
                  )}
                </button>
              )}

              <button
                onClick={onClose}
                className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition-colors cursor-pointer border border-white/20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Tap Navigation Overlays (Left for Prev, Right for Next) */}
        <div className="absolute inset-y-20 inset-x-0 z-0 flex">
          <div
            onClick={handlePrev}
            className="w-1/3 h-full cursor-pointer opacity-0 hover:opacity-100 flex items-center justify-start pl-3 transition-opacity text-white/70"
          >
            {currentIndex > 0 && (
              <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                <ChevronLeft className="w-5 h-5" />
              </div>
            )}
          </div>

          <div
            onClick={handleNext}
            className="w-2/3 h-full cursor-pointer opacity-0 hover:opacity-100 flex items-center justify-end pr-3 transition-opacity text-white/70"
          >
            <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <ChevronRight className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Bottom Area: Caption & Action Bar */}
        <div className="relative z-10 p-4 space-y-3">
          {/* Caption Box */}
          {currentStory.caption && (
            <div className="bg-black/60 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-white text-xs leading-relaxed space-y-1">
              <p className="line-clamp-3">
                {currentStory.caption}
              </p>
            </div>
          )}

          {/* View Elephant Profile Button */}
          {currentStory.linkedElephant && (
            <button
              onClick={() => onSelectElephant(currentStory.linkedElephant!)}
              className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-800 to-[#062E22] text-white font-extrabold text-xs shadow-lg hover:shadow-xl active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer border border-emerald-500/30"
            >
              <span>{t.viewProfile} ({bilingualElephantName})</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Action Row: ONLY Like, Share, Save */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2.5">
              {/* Like */}
              <button
                onClick={handleLike}
                className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-bold backdrop-blur-md transition-all cursor-pointer border ${
                  isLiked
                    ? 'bg-red-500/80 text-white border-red-400'
                    : 'bg-black/40 text-white hover:bg-black/60 border-white/20'
                }`}
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-white stroke-none' : ''}`} />
                <span>{likeCount}</span>
              </button>

              {/* Share */}
              <button
                onClick={handleShare}
                className="px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-bold bg-black/40 hover:bg-black/60 text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>{t.share}</span>
              </button>
            </div>

            {/* Save */}
            <button
              onClick={handleBookmark}
              className={`p-2 rounded-full backdrop-blur-md transition-all cursor-pointer border ${
                isSaved
                  ? 'bg-emerald-600 text-white border-emerald-400'
                  : 'bg-black/40 text-white hover:bg-black/60 border-white/20'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-white stroke-none' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
