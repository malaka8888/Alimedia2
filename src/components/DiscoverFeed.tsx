import React, { useState, useMemo } from 'react';
import { Elephant, ElephantPost } from '../types/elephant';
import {
  Heart,
  Bookmark,
  Share2,
  ShieldCheck,
  Crown,
  Sparkles,
  Building2,
  Radio,
  Plus,
  Play,
  UserCheck,
  Check
} from 'lucide-react';
import { Language, translations, formatBilingualElephantName } from '../utils/translations';
import { useAuth } from '../firebase/authContext';
import { StoryViewerModal, StoryItem, ElephantStoryGroup } from './StoryViewerModal';

interface DiscoverFeedProps {
  elephants: Elephant[];
  posts?: ElephantPost[];
  language: Language;
  onSelectElephant: (elephant: Elephant) => void;
  onOpenCreatePost: (elephantId?: string, isStoryOnly?: boolean) => void;
  onSelectPhoto?: (photoUrl: string) => void;
  onShowNotification?: (msg: string) => void;
  onOpenDirectory?: () => void;
}

export const DiscoverFeed: React.FC<DiscoverFeedProps> = ({
  elephants,
  posts = [],
  language,
  onSelectElephant,
  onOpenCreatePost,
  onSelectPhoto,
  onShowNotification,
  onOpenDirectory,
}) => {
  const t = translations[language];
  const { isFollowing, toggleFollowElephant } = useAuth();
  const [likes, setLikes] = useState<{ [id: string]: number }>({});
  const [userLiked, setUserLiked] = useState<{ [id: string]: boolean }>({});
  const [savedPosts, setSavedPosts] = useState<{ [id: string]: boolean }>({});
  const [expandedCaptions, setExpandedCaptions] = useState<{ [id: string]: boolean }>({});

  // Story Viewer Modal State (Grouped by Elephant)
  const [activeStoryGroupIndex, setActiveStoryGroupIndex] = useState<number | null>(null);

  const notify = (msg: string) => {
    if (onShowNotification) {
      onShowNotification(msg);
    }
  };

  const handleLike = (id: string, initialCount: number = 142) => {
    setUserLiked((prev) => {
      const isCurrentlyLiked = !prev[id];
      setLikes((likePrev) => {
        const current = likePrev[id] !== undefined ? likePrev[id] : initialCount;
        return { ...likePrev, [id]: isCurrentlyLiked ? current + 1 : Math.max(0, current - 1) };
      });
      return { ...prev, [id]: isCurrentlyLiked };
    });
  };

  const handleBookmark = (id: string, name: string) => {
    setSavedPosts((prev) => {
      const isNowSaved = !prev[id];
      if (isNowSaved) {
        notify(language === 'si' ? `${name} සුරැකි ලැයිස්තුවට එක් විය!` : `Saved ${name} to bookmarks!`);
      } else {
        notify(language === 'si' ? 'සුරැකි ලැයිස්තුවෙන් ඉවත් විය.' : 'Removed from bookmarks.');
      }
      return { ...prev, [id]: isNowSaved };
    });
  };

  const handleShare = async (id: string, name: string, captionText?: string) => {
    const shareUrl = `${window.location.origin}/#${id}`;
    const shareData = {
      title: `${name} - Sri Lankan Elephant`,
      text: captionText ? `${captionText} | ${name}` : `Check out ${name} on Aliya Media Sri Lanka`,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Share error:', err);
        }
      }
    }

    // Fallback: Copy link to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      notify(language === 'si' ? 'සබැඳිය පිටපත් කරගන්නා ලදී!' : 'Link copied to clipboard!');
    } catch (err) {
      notify(language === 'si' ? 'සබැඳිය සූදානම්!' : 'Link ready to share!');
    }
  };

  const toggleCaption = (id: string) => {
    setExpandedCaptions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // -------------------------------------------------------------
  // STORIES TRAY BUILDER (Grouped by Elephant with 3s Segments)
  // -------------------------------------------------------------
  const compiledStoryGroups: ElephantStoryGroup[] = useMemo(() => {
    const groupMap = new Map<string, ElephantStoryGroup>();

    // 1. Group user-submitted community stories/posts
    posts.forEach((post) => {
      if (post.isStory !== false && post.photoUrl) {
        const linked = elephants.find((e) => e.id === post.elephantId || e.name === post.elephantName);
        const groupKey = post.elephantId || linked?.id || post.elephantName || 'general';
        const isFollowed = (linked?.id && isFollowing(linked.id)) || (post.elephantId && isFollowing(post.elephantId));

        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, {
            elephantId: post.elephantId || linked?.id || groupKey,
            elephantName: post.elephantName || linked?.name || 'Elephant',
            elephantSinhalaName: post.elephantSinhalaName || linked?.sinhalaName,
            avatarPhoto: linked?.photos?.[0] || post.photoUrl,
            coverPhoto: post.photoUrl,
            linkedElephant: linked,
            isTusker: linked?.type === 'tusker',
            isFollowed: !!isFollowed,
            isLive: linked?.isLive,
            stories: [],
          });
        }

        const group = groupMap.get(groupKey)!;
        if (isFollowed) {
          group.isFollowed = true;
        }

        group.stories.push({
          id: post.id || `post-story-${Math.random()}`,
          elephantId: post.elephantId || linked?.id || '',
          elephantName: post.elephantName || linked?.name || 'Elephant',
          elephantSinhalaName: post.elephantSinhalaName || linked?.sinhalaName,
          photoUrl: post.photoUrl,
          caption: post.caption,
          authorName: post.authorName,
          authorUsername: post.authorUsername,
          authorPhotoURL: post.authorPhotoURL,
          createdAt: post.createdAt,
          linkedElephant: linked,
          isFollowed: !!isFollowed,
          isTusker: linked?.type === 'tusker',
        });
      }
    });

    // 2. Add registered elephants with gallery photos
    elephants.forEach((el) => {
      if (el.photos && el.photos.length > 0) {
        const groupKey = el.id || el.name;
        const isFollowed = el.id ? isFollowing(el.id) : false;

        if (!groupMap.has(groupKey)) {
          const elStories: StoryItem[] = el.photos.map((photoUrl, pIdx) => ({
            id: `el-${el.id}-photo-${pIdx}`,
            elephantId: el.id || '',
            elephantName: el.name,
            elephantSinhalaName: el.sinhalaName,
            photoUrl: photoUrl,
            caption: el.description,
            authorName: 'National Registry',
            authorUsername: 'verified_registry',
            authorPhotoURL: el.photos[0],
            createdAt: 'Official',
            linkedElephant: el,
            isFollowed: isFollowed,
            isTusker: el.type === 'tusker',
          }));

          groupMap.set(groupKey, {
            elephantId: el.id || groupKey,
            elephantName: el.name,
            elephantSinhalaName: el.sinhalaName,
            avatarPhoto: el.photos[0],
            coverPhoto: el.photos[0],
            linkedElephant: el,
            isTusker: el.type === 'tusker',
            isFollowed: isFollowed,
            isLive: el.isLive,
            stories: elStories,
          });
        } else {
          if (isFollowed) {
            groupMap.get(groupKey)!.isFollowed = true;
          }
        }
      }
    });

    // Convert map to array and sort:
    // 1. Followed elephants FIRST
    // 2. Live elephants
    // 3. Elephants with most stories
    const groupsArray = Array.from(groupMap.values()).filter((g) => g.stories.length > 0);

    return groupsArray.sort((a, b) => {
      if (a.isFollowed && !b.isFollowed) return -1;
      if (!a.isFollowed && b.isFollowed) return 1;
      if (a.isLive && !b.isLive) return -1;
      if (!a.isLive && b.isLive) return 1;
      return b.stories.length - a.stories.length;
    });
  }, [elephants, posts, isFollowing]);

  // Main Feed Posts (Excludes story-only posts)
  const feedPosts = useMemo(() => {
    return posts.filter((p) => !p.isStoryOnly);
  }, [posts]);

  return (
    <div className="max-w-lg mx-auto w-full space-y-5 pb-24 animate-fadeIn pt-1">
      {/* ----------------------------------------------------------------- */}
      {/* STORIES TRAY                                                      */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-extrabold text-[#062E22] dark:text-emerald-300 uppercase tracking-wider">
              {t.storiesUpdates}
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          <button
            onClick={() => onOpenCreatePost(undefined, true)}
            className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-emerald-200 flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{t.addStory}</span>
          </button>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-2 pt-0.5 no-scrollbar -mx-1 px-1 items-stretch">
          {/* Large "+" Story Creator Box */}
          <div
            onClick={() => onOpenCreatePost(undefined, true)}
            className="flex-shrink-0 w-24 sm:w-26 cursor-pointer group"
          >
            <div className="relative h-full min-h-[125px] sm:min-h-[140px] aspect-[3/4] rounded-2xl overflow-hidden shadow-xs bg-[#062E22] border-2 border-dashed border-emerald-400/50 group-hover:border-amber-400 transition-all flex flex-col items-center justify-center p-2 text-center text-white">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-400 to-emerald-500 text-zinc-950 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform shadow-md">
                <Plus className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="text-[10px] font-extrabold leading-tight">
                {t.addStoryBoxTitle}
              </span>
              <span className="text-[8px] text-amber-300 font-semibold mt-0.5">
                {t.addStoryBoxSub}
              </span>
            </div>
          </div>

          {/* Grouped Elephant Story Cards (Each card has multiple 3s story segments!) */}
          {compiledStoryGroups.length === 0 ? (
            <div className="flex-1 min-w-[220px] p-3 rounded-2xl bg-white dark:bg-[#121F1B] border border-dashed border-emerald-300/80 dark:border-emerald-900/60 flex flex-col justify-center items-start text-left space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#062E22] dark:text-emerald-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{language === 'si' ? 'අලි ඇතුන්ගේ Stories' : 'Elephant Stories'}</span>
              </div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-snug">
                {language === 'si'
                  ? 'අලි ඇතුන්ගේ දෛනික Stories මෙහි දිස්වේ. කැමති ඇතුන් තෝරා Follow කරන්න!'
                  : 'Daily stories appear here. Follow your favorite elephants in the directory!'}
              </p>
              {onOpenDirectory && (
                <button
                  type="button"
                  onClick={onOpenDirectory}
                  className="mt-0.5 px-3 py-1 bg-[#062E22] hover:bg-emerald-800 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-amber-300 dark:text-amber-200 text-[10px] font-black rounded-xl flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                >
                  <span>{language === 'si' ? '🐘 ඇතුන් සොයන්න (Explore)' : '🐘 Explore Elephants'}</span>
                </button>
              )}
            </div>
          ) : (
            compiledStoryGroups.map((group, groupIdx) => {
              const isLive = group.isLive;
              const bilingualName = formatBilingualElephantName(
                { name: group.elephantName, sinhalaName: group.elephantSinhalaName },
                language
              );
              const segmentCount = group.stories.length;
              const coverImg = group.coverPhoto || group.avatarPhoto;

              return (
                <div
                  key={group.elephantId || groupIdx}
                  onClick={() => setActiveStoryGroupIndex(groupIdx)}
                  className="flex-shrink-0 w-26 sm:w-28 cursor-pointer group"
                >
                  <div
                    className={`relative aspect-[3/4] rounded-2xl overflow-hidden shadow-xs bg-zinc-900 border-2 transition-all transform group-hover:scale-[1.02] ${
                      group.isFollowed
                        ? 'border-amber-400 ring-2 ring-amber-400/40'
                        : 'border-emerald-500/60'
                    }`}
                  >
                    <img
                      src={coverImg}
                      alt={group.elephantName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/30" />

                    {/* Top Badges */}
                    <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between">
                      {isLive ? (
                        <span className="inline-flex items-center gap-0.5 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md bg-red-600 text-white shadow-xs">
                          <Radio className="w-2 h-2" />
                          <span>LIVE</span>
                        </span>
                      ) : group.isFollowed ? (
                        <span className="inline-flex items-center gap-0.5 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md bg-amber-400 text-zinc-950 shadow-xs">
                          <UserCheck className="w-2.5 h-2.5 stroke-[2.5]" />
                          <span>{t.following}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-white bg-black/40 backdrop-blur-xs px-1.5 py-0.5 rounded-md border border-white/20">
                          <span>Story</span>
                        </span>
                      )}

                      {/* Segments Count Badge (e.g. "3") */}
                      <div className="px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-xs flex items-center gap-0.5 text-[9px] font-black text-amber-300 border border-amber-400/40 shadow-xs">
                        <Play className="w-2 h-2 fill-amber-300 stroke-none" />
                        <span>{segmentCount}</span>
                      </div>
                    </div>

                    {/* Bottom Avatar & Elephant Bilingual Name */}
                    <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5 text-white">
                      <div className="w-5 h-5 rounded-full overflow-hidden border-2 border-amber-400 flex-shrink-0 bg-emerald-950 shadow-xs">
                        <img
                          src={group.avatarPhoto || coverImg}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-extrabold truncate block drop-shadow" title={bilingualName}>
                          {bilingualName}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* USER-SUBMITTED COMMUNITY POSTS                                    */}
      {/* ----------------------------------------------------------------- */}
      {feedPosts && feedPosts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-extrabold text-[#062E22] dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{t.communityPosts}</span>
            </h3>
            <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/70 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">
              {feedPosts.length} {language === 'si' ? 'සටහන්' : 'Posts'}
            </span>
          </div>

          {feedPosts.map((post) => {
            const postId = post.id || `post-${Math.random()}`;
            const linkedElephant = elephants.find((e) => e.id === post.elephantId || e.name === post.elephantName);
            const isLiked = !!userLiked[postId];
            const currentLikes = likes[postId] !== undefined ? likes[postId] : (post.likesCount || 18);
            const isSaved = !!savedPosts[postId];
            const isExpanded = !!expandedCaptions[postId];
            const captionText = post.caption || '';
            const isLongCaption = captionText.length > 110;
            const isElephantFollowed = linkedElephant?.id ? isFollowing(linkedElephant.id) : false;

            const bilingualName = formatBilingualElephantName(
              { name: post.elephantName, sinhalaName: post.elephantSinhalaName || linkedElephant?.sinhalaName },
              language
            );

            return (
              <div
                key={postId}
                className="bg-white dark:bg-[#121F1B] rounded-3xl p-3.5 sm:p-4 shadow-xs border border-zinc-200/80 dark:border-emerald-950/70 transition-all space-y-2.5"
              >
                {/* 1. Header: Elephant Profile Avatar + Name (Click to Profile) + Corner Follow Button */}
                <div className="flex items-center justify-between gap-2">
                  <div
                    onClick={() => linkedElephant && onSelectElephant(linkedElephant)}
                    className="flex items-center gap-2.5 cursor-pointer group min-w-0"
                    title={linkedElephant ? (language === 'si' ? `${bilingualName} ගේ Profile එක බලන්න` : `View ${bilingualName} Profile`) : undefined}
                  >
                    <div className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 via-emerald-600 to-[#062E22] shrink-0 group-hover:scale-105 transition-transform">
                      <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-zinc-900">
                        <img
                          src={post.photoUrl}
                          alt={post.elephantName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-extrabold text-sm text-[#062E22] dark:text-emerald-100 group-hover:text-emerald-700 dark:group-hover:text-amber-300 transition-colors truncate">
                          {bilingualName}
                        </h4>
                        {linkedElephant?.type === 'tusker' && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300/40">
                            {t.tusker}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-emerald-700 dark:text-emerald-400 shrink-0" />
                        <span>{linkedElephant?.organization || linkedElephant?.location || (language === 'si' ? 'ශ්‍රී ලංකාව' : 'Sri Lanka')}</span>
                      </p>
                    </div>
                  </div>

                  {/* Corner Follow Button */}
                  {linkedElephant?.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFollowElephant(linkedElephant.id!);
                        onShowNotification?.(
                          isElephantFollowed
                            ? `${bilingualName} Follow ලැයිස්තුවෙන් ඉවත් විය`
                            : `${bilingualName} සාර්ථකව Follow කරන ලදී! ⭐`
                        );
                      }}
                      className={`px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer shrink-0 shadow-2xs ${
                        isElephantFollowed
                          ? 'bg-amber-400 hover:bg-amber-500 text-amber-950 border border-amber-500/50'
                          : 'bg-[#062E22] hover:bg-emerald-800 text-white dark:bg-emerald-700 dark:hover:bg-emerald-600'
                      }`}
                    >
                      {isElephantFollowed ? (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>{t.following}</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>{t.follow}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* 2. Clear Image View */}
                <div
                  onClick={() => onSelectPhoto ? onSelectPhoto(post.photoUrl) : (linkedElephant && onSelectElephant(linkedElephant))}
                  className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 cursor-pointer shadow-inner group"
                >
                  <img
                    src={post.photoUrl}
                    alt={post.caption || post.elephantName}
                    className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-300"
                  />
                </div>

                {/* 3. Action Buttons: ONLY LIKE, SHARE, SAVE */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-3 text-zinc-700 dark:text-zinc-300">
                    {/* LIKE BUTTON */}
                    <button
                      onClick={() => handleLike(postId, post.likesCount || 18)}
                      className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                        isLiked
                          ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                          : 'bg-zinc-100/70 hover:bg-zinc-100 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200'
                      }`}
                    >
                      <Heart
                        className={`w-4 h-4 transition-transform active:scale-125 ${
                          isLiked ? 'fill-red-500 text-red-500 scale-110' : 'stroke-[2]'
                        }`}
                      />
                      <span>{currentLikes}</span>
                    </button>

                    {/* SHARE BUTTON */}
                    <button
                      onClick={() => handleShare(linkedElephant?.id || postId, bilingualName, post.caption)}
                      className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-zinc-100/70 hover:bg-zinc-100 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:text-emerald-800 dark:hover:text-amber-300 transition-colors cursor-pointer"
                      title={t.sharePost}
                    >
                      <Share2 className="w-4 h-4 stroke-[2]" />
                      <span>{t.sharePost}</span>
                    </button>
                  </div>

                  {/* SAVE / BOOKMARK BUTTON */}
                  <button
                    onClick={() => handleBookmark(postId, bilingualName)}
                    className={`p-1.5 rounded-full transition-all cursor-pointer ${
                      isSaved
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300'
                        : 'bg-zinc-100/70 hover:bg-zinc-100 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-[#062E22] dark:hover:text-amber-300'
                    }`}
                    title={t.save}
                  >
                    <Bookmark
                      className={`w-4 h-4 ${isSaved ? 'fill-emerald-800 dark:fill-emerald-400 text-emerald-800 dark:text-emerald-400' : 'stroke-[2]'}`}
                    />
                  </button>
                </div>

                {/* 4. Caption with "See more" & clickable elephant name */}
                {captionText && (
                  <div className="text-xs text-zinc-800 dark:text-zinc-200 pt-0.5 leading-relaxed">
                    <span
                      onClick={() => linkedElephant && onSelectElephant(linkedElephant)}
                      className="font-bold text-[#062E22] dark:text-emerald-300 mr-1.5 cursor-pointer hover:underline"
                    >
                      {bilingualName}
                    </span>
                    <span>
                      {isLongCaption && !isExpanded
                        ? `${captionText.slice(0, 110)}... `
                        : captionText}
                    </span>
                    {isLongCaption && (
                      <button
                        onClick={() => toggleCaption(postId)}
                        className="ml-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-400 hover:text-emerald-950 dark:hover:text-emerald-200 underline cursor-pointer"
                      >
                        {isExpanded ? t.seeLess : t.seeMore}
                      </button>
                    )}
                  </div>
                )}

                {/* 5. Author Attribution */}
                <div className="pt-1.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-4 h-4 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 shrink-0">
                      <img
                        src={post.authorPhotoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="truncate">
                      {t.by}:{' '}
                      <b className="text-[#062E22] dark:text-emerald-200 font-semibold">{post.authorUsername || post.authorName}</b>
                    </span>
                  </div>

                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 shrink-0">
                    {t.community}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* MAIN ELEPHANT REGISTRY FEED                                       */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1 pt-1">
          <h3 className="text-xs font-extrabold text-[#062E22] dark:text-emerald-300 uppercase tracking-wider">
            {t.verifiedRegistry}
          </h3>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            {elephants.length} {language === 'si' ? 'හීලෑ ඇත් වාර්තා' : 'Elephants'}
          </span>
        </div>

        {elephants.map((elephant, index) => {
          const elephantId = elephant.id || `el-${index}`;
          const isTusker = elephant.type === 'tusker';
          const defaultLikes = 150 + (index * 47) % 320;
          const currentLikes = likes[elephantId] !== undefined ? likes[elephantId] : defaultLikes;
          const isLiked = !!userLiked[elephantId];
          const isSaved = !!savedPosts[elephantId];
          const following = elephant.id ? isFollowing(elephant.id) : false;
          const isExpanded = !!expandedCaptions[elephantId];
          const descriptionText = elephant.description || '';
          const isLongDescription = descriptionText.length > 120;
          const bilingualName = formatBilingualElephantName(elephant, language);

          const postImage = elephant.photos && elephant.photos.length > 0
            ? elephant.photos[0]
            : 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=1200&q=80';

          return (
            <div
              key={elephantId}
              className="bg-white dark:bg-[#121F1B] rounded-3xl p-3.5 sm:p-4 shadow-xs border border-zinc-200/80 dark:border-emerald-950/70 transition-all space-y-2.5"
            >
              {/* 1. Header: Elephant Profile Avatar + Name (Click to Profile) + Corner Follow Button */}
              <div className="flex items-center justify-between gap-2">
                <div
                  onClick={() => onSelectElephant(elephant)}
                  className="flex items-center gap-2.5 cursor-pointer group min-w-0"
                  title={language === 'si' ? `${bilingualName} ගේ Profile එක බලන්න` : `View ${bilingualName} Profile`}
                >
                  <div className="relative w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 via-emerald-600 to-[#062E22] shrink-0 group-hover:scale-105 transition-transform">
                    <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-zinc-900">
                      <img
                        src={postImage}
                        alt={elephant.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold text-sm text-[#062E22] dark:text-emerald-100 group-hover:text-emerald-700 dark:group-hover:text-amber-300 transition-colors truncate">
                        {bilingualName}
                      </h3>
                      {elephant.verified && (
                        <span title={t.verifiedBadge} className="shrink-0">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 fill-emerald-600/20" />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-emerald-700 dark:text-emerald-400 shrink-0" />
                      <span className="truncate">{elephant.organization || elephant.location || (language === 'si' ? 'ශ්‍රී ලංකාව' : 'Sri Lanka')}</span>
                    </p>
                  </div>
                </div>

                {/* Corner Follow Button (Replaces "තොරතුරු බලන්න") */}
                {elephant.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFollowElephant(elephant.id!);
                      onShowNotification?.(
                        following
                          ? `${bilingualName} Follow ලැයිස්තුවෙන් ඉවත් විය`
                          : `${bilingualName} සාර්ථකව Follow කරන ලදී! ⭐`
                      );
                    }}
                    className={`px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-xs font-extrabold flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer shrink-0 shadow-2xs ${
                      following
                        ? 'bg-amber-400 hover:bg-amber-500 text-amber-950 border border-amber-500/50'
                        : 'bg-[#062E22] hover:bg-emerald-800 text-white dark:bg-emerald-700 dark:hover:bg-emerald-600'
                    }`}
                  >
                    {following ? (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>{t.following}</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>{t.follow}</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* 2. Photo View */}
              <div
                onClick={() => onSelectPhoto ? onSelectPhoto(postImage) : onSelectElephant(elephant)}
                className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 cursor-pointer shadow-inner group"
              >
                <img
                  src={postImage}
                  alt={elephant.name}
                  className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-300"
                />

                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                  <span
                    className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full backdrop-blur-md shadow-xs ${
                      isTusker
                        ? 'bg-amber-400/90 text-amber-950'
                        : 'bg-emerald-800/90 text-white'
                    }`}
                  >
                    {isTusker ? t.tusker : t.elephant}
                  </span>
                </div>
              </div>

              {/* 3. Action Buttons: ONLY LIKE, SHARE, SAVE */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-3 text-zinc-700 dark:text-zinc-300">
                  {/* LIKE BUTTON */}
                  <button
                    onClick={() => handleLike(elephantId, defaultLikes)}
                    className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                      isLiked
                        ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                        : 'bg-zinc-100/70 hover:bg-zinc-100 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200'
                    }`}
                  >
                    <Heart
                      className={`w-4 h-4 transition-transform active:scale-125 ${
                        isLiked ? 'fill-red-500 text-red-500 scale-110' : 'stroke-[2]'
                      }`}
                    />
                    <span>{currentLikes}</span>
                  </button>

                  {/* SHARE BUTTON */}
                  <button
                    onClick={() => handleShare(elephantId, bilingualName, elephant.description)}
                    className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-zinc-100/70 hover:bg-zinc-100 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:text-emerald-800 dark:hover:text-amber-300 transition-colors cursor-pointer"
                    title={t.sharePost}
                  >
                    <Share2 className="w-4 h-4 stroke-[2]" />
                    <span>{t.sharePost}</span>
                  </button>
                </div>

                {/* SAVE / BOOKMARK BUTTON */}
                <button
                  onClick={() => handleBookmark(elephantId, bilingualName)}
                  className={`p-1.5 rounded-full transition-all cursor-pointer ${
                    isSaved
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300'
                      : 'bg-zinc-100/70 hover:bg-zinc-100 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-[#062E22] dark:hover:text-amber-300'
                  }`}
                  title={t.save}
                >
                  <Bookmark
                    className={`w-4 h-4 ${isSaved ? 'fill-emerald-800 dark:fill-emerald-400 text-emerald-800 dark:text-emerald-400' : 'stroke-[2]'}`}
                  />
                </button>
              </div>

              {/* 4. Description with "See more" & clickable elephant name */}
              {descriptionText && (
                <div className="text-xs text-zinc-800 dark:text-zinc-200 pt-0.5 leading-relaxed">
                  <span
                    onClick={() => onSelectElephant(elephant)}
                    className="font-bold text-[#062E22] dark:text-emerald-300 mr-1.5 cursor-pointer hover:underline"
                  >
                    {bilingualName}
                  </span>
                  <span>
                    {isLongDescription && !isExpanded
                      ? `${descriptionText.slice(0, 120)}... `
                      : descriptionText}
                  </span>
                  {isLongDescription && (
                    <button
                      onClick={() => toggleCaption(elephantId)}
                      className="ml-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-400 hover:text-emerald-950 dark:hover:text-emerald-200 underline cursor-pointer"
                    >
                      {isExpanded ? t.seeLess : t.seeMore}
                    </button>
                  )}
                </div>
              )}

              {/* 5. Mahout & Registry Tag */}
              <div className="pt-1.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                <span className="truncate">
                  {t.mahout}:{' '}
                  <b className="text-[#062E22] dark:text-emerald-200 font-semibold">{elephant.mahout || (language === 'si' ? 'භාරකාර ඇත්ගොව්වන්' : 'National Custodians')}</b>
                </span>

                <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">
                  {elephant.category === 'temple' ? (language === 'si' ? 'විහාරස්ථ ඇතා' : 'Temple Tusker') : (language === 'si' ? 'හීලෑ ඇතා' : 'Domesticated')}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 5. FULLSCREEN STORY VIEWER MODAL                                  */}
      {/* ----------------------------------------------------------------- */}
      {activeStoryGroupIndex !== null && (
        <StoryViewerModal
          storyGroups={compiledStoryGroups}
          initialGroupIndex={activeStoryGroupIndex}
          language={language}
          onClose={() => setActiveStoryGroupIndex(null)}
          onSelectElephant={(el) => {
            setActiveStoryGroupIndex(null);
            onSelectElephant(el);
          }}
          onShowNotification={showNotificationFallback}
        />
      )}
    </div>
  );

  function showNotificationFallback(msg: string) {
    if (onShowNotification) onShowNotification(msg);
  }
};
