import React, { useState, useEffect, useRef } from 'react';
import { Elephant } from '../types/elephant';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Building2,
  Crown,
  Heart,
  Eye,
  Share2,
  UserCheck
} from 'lucide-react';
import { Language } from '../utils/translations';

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
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);
  const [progress, setProgress] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [liked, setLiked] = useState<{ [id: string]: boolean }>({});

  const duration = 6000; // 6 seconds per story
  const intervalRef = useRef<any>(null);

  const currentStory = stories[currentIndex] || stories[0];

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setProgress(0);
  }, [initialIndex]);

  // Story Progress Timer
  useEffect(() => {
    if (!currentStory || isPaused) return;

    const stepMs = 50;
    const progressIncrement = (stepMs / duration) * 100;

    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          // Go to next story
          if (currentIndex < stories.length - 1) {
            setCurrentIndex((idx) => idx + 1);
            return 0;
          } else {
            // Last story finished -> close
            onClose();
            return 100;
          }
        }
        return prev + progressIncrement;
      });
    }, stepMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentIndex, isPaused, stories.length, onClose, currentStory]);

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

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentStory) return;
    setLiked((prev) => {
      const isNow = !prev[currentStory.id];
      if (isNow && onShowNotification) {
        onShowNotification(language === 'si' ? '❤️ Story එකට Like කළා!' : 'Liked story!');
      }
      return { ...prev, [currentStory.id]: isNow };
    });
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentStory) return;
    const shareUrl = `${window.location.origin}/#${currentStory.elephantId}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${currentStory.elephantName} Story`,
          text: currentStory.caption || `Watch ${currentStory.elephantName}'s story!`,
          url: shareUrl,
        });
        return;
      } catch (err) {
        // ignore abort
      }
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
      if (onShowNotification) {
        onShowNotification(language === 'si' ? 'Story Link එක copy විය!' : 'Story link copied!');
      }
    }
  };

  if (!currentStory) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center animate-fadeIn select-none">
      {/* Story Container - Mobile Screen Shape */}
      <div
        className="relative w-full h-full max-w-md max-h-screen sm:max-h-[92vh] sm:rounded-3xl overflow-hidden bg-zinc-950 flex flex-col justify-between shadow-2xl"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Background Image */}
        <div className="absolute inset-0 bg-black flex items-center justify-center">
          <img
            src={currentStory.photoUrl}
            alt={currentStory.elephantName}
            className="w-full h-full object-cover sm:object-contain"
          />
          {/* Subtle gradient vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/70 pointer-events-none" />
        </div>

        {/* TOP SECTION: Segmented Progress Bars & Header */}
        <div className="relative z-20 p-3 sm:p-4 space-y-3">
          {/* Progress Bars */}
          <div className="flex items-center gap-1.5 w-full">
            {stories.map((s, idx) => {
              let barProgress = 0;
              if (idx < currentIndex) barProgress = 100;
              else if (idx === currentIndex) barProgress = progress;

              return (
                <div
                  key={s.id || idx}
                  className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden"
                >
                  <div
                    className="h-full bg-white transition-all duration-75"
                    style={{ width: `${barProgress}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* Header Info */}
          <div className="flex items-center justify-between text-white">
            {/* Elephant Avatar & Name */}
            <div
              onClick={() => {
                if (currentStory.linkedElephant) {
                  onClose();
                  onSelectElephant(currentStory.linkedElephant);
                }
              }}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="relative w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 via-emerald-500 to-emerald-200 shrink-0 shadow-lg">
                <div className="w-full h-full rounded-full overflow-hidden bg-black">
                  <img
                    src={currentStory.linkedElephant?.photos?.[0] || currentStory.photoUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-extrabold text-sm truncate drop-shadow-md">
                    {currentStory.elephantName}
                  </h3>
                  {currentStory.elephantSinhalaName && (
                    <span className="text-xs font-semibold text-emerald-300 font-sinhala truncate">
                      ({currentStory.elephantSinhalaName})
                    </span>
                  )}
                  {currentStory.linkedElephant?.verified && (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/30 shrink-0" />
                  )}
                </div>

                <div className="flex items-center gap-2 text-[11px] text-zinc-300 drop-shadow">
                  {currentStory.isFollowed && (
                    <span className="inline-flex items-center gap-0.5 text-amber-300 font-bold">
                      <UserCheck className="w-3 h-3" />
                      <span>{language === 'si' ? 'Following' : 'Following'}</span>
                    </span>
                  )}
                  {currentStory.linkedElephant?.organization ? (
                    <span className="truncate max-w-[150px] text-zinc-300">
                      {currentStory.linkedElephant.organization}
                    </span>
                  ) : (
                    <span>Sri Lanka</span>
                  )}
                </div>
              </div>
            </div>

            {/* Right Header: Close (X) */}
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md text-white transition-all cursor-pointer"
              aria-label="Close story"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* TAP NAVIGATION ZONES (Left to Previous, Right to Next) */}
        <div className="absolute inset-y-16 inset-x-0 flex z-10">
          <div
            className="w-1/3 h-full cursor-pointer"
            onClick={handlePrev}
            aria-label="Previous story"
          />
          <div
            className="w-2/3 h-full cursor-pointer"
            onClick={handleNext}
            aria-label="Next story"
          />
        </div>

        {/* BOTTOM SECTION: Caption, Author info, Action Buttons */}
        <div className="relative z-20 p-4 space-y-3 bg-gradient-to-t from-black/95 via-black/80 to-transparent pt-8">
          {/* Caption */}
          {currentStory.caption && (
            <p className="text-xs sm:text-sm text-white/95 leading-relaxed font-medium line-clamp-3 drop-shadow">
              {currentStory.caption}
            </p>
          )}

          {/* Author info (if available) */}
          <div className="flex items-center justify-between text-xs text-zinc-300 pt-1">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full overflow-hidden bg-zinc-700 border border-zinc-500 shrink-0">
                <img
                  src={currentStory.authorPhotoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-[11px] truncate">
                {language === 'si' ? 'Story පළකළේ:' : 'Story by:'}{' '}
                <b className="text-white">{currentStory.authorUsername || currentStory.authorName || 'Devotee'}</b>
              </span>
            </div>

            {currentStory.isTusker && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-zinc-950">
                <Crown className="w-3 h-3" />
                <span>Tusker</span>
              </span>
            )}
          </div>

          {/* Interactive Bottom Bar */}
          <div className="pt-2 flex items-center justify-between gap-2 border-t border-white/15">
            {/* View Elephant Full Profile button */}
            {currentStory.linkedElephant ? (
              <button
                onClick={() => {
                  onClose();
                  onSelectElephant(currentStory.linkedElephant!);
                }}
                className="flex-1 py-2 px-3.5 rounded-full bg-emerald-700/90 hover:bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg backdrop-blur-sm cursor-pointer transition-all active:scale-95 border border-emerald-400/40"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{language === 'si' ? `${currentStory.elephantName} Profile එක බලන්න` : `View ${currentStory.elephantName}'s Profile`}</span>
              </button>
            ) : (
              <div className="flex-1" />
            )}

            {/* Quick Heart & Share */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleLike}
                className={`p-2 rounded-full backdrop-blur-md transition-all cursor-pointer ${
                  liked[currentStory.id]
                    ? 'bg-red-600/90 text-white scale-110'
                    : 'bg-white/20 hover:bg-white/30 text-white'
                }`}
                aria-label="Like story"
              >
                <Heart
                  className={`w-4 h-4 ${liked[currentStory.id] ? 'fill-white stroke-none' : 'stroke-[2]'}`}
                />
              </button>

              <button
                onClick={handleShare}
                className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md transition-all cursor-pointer"
                aria-label="Share story"
              >
                <Share2 className="w-4 h-4 stroke-[2]" />
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Previous / Next Buttons */}
        <button
          onClick={handlePrev}
          className="hidden sm:flex absolute -left-14 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md cursor-pointer transition-all"
          aria-label="Previous"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <button
          onClick={handleNext}
          className="hidden sm:flex absolute -right-14 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md cursor-pointer transition-all"
          aria-label="Next"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
