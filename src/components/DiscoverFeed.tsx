import React, { useState, useMemo, useRef, useCallback } from 'react';
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
  Check,
  Maximize2
} from 'lucide-react';
import { Language, translations, formatBilingualElephantName } from '../utils/translations';
import { useAuth } from '../firebase/authContext';
import { StoryViewerModal, StoryItem, ElephantStoryGroup } from './StoryViewerModal';
import { ElephantHeartPop } from './ElephantHeartPop';
import { toggleLikeElephantPost, isWithin24Hours } from '../firebase/postService';

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
  const { user, isFollowing, toggleFollowElephant } = useAuth();
  const [likes, setLikes] = useState<{ [id: string]: number }>({});
  const [userLiked, setUserLiked] = useState<{ [id: string]: boolean }>({});
  const [savedPosts, setSavedPosts] = useState<{ [id: string]: boolean }>({});
  const [expandedCaptions, setExpandedCaptions] = useState<{ [id: string]: boolean }>({});
  const [heartAnims, setHeartAnims] = useState<{ [id: string]: { show: boolean; pos?: { x: number; y: number } } }>({});
  const [activeStoryViewer, setActiveStoryViewer] = useState<{
    groups: ElephantStoryGroup[];
    initialIndex: number;
  } | null>(null);

  // Track timestamps when stories for each elephant were viewed by user (persisted in localStorage)
  const [viewedTimestamps, setViewedTimestamps] = useState<{ [elephantId: string]: number }>(() => {
    try {
      const raw = localStorage.getItem('alimedia_viewed_story_timestamps');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const handleMarkStoryViewed = useCallback((elephantId: string) => {
    if (!elephantId) return;
    const now = Date.now();
    try {
      const raw = localStorage.getItem('alimedia_viewed_story_timestamps');
      const map = raw ? JSON.parse(raw) : {};
      map[elephantId] = now;
      localStorage.setItem('alimedia_viewed_story_timestamps', JSON.stringify(map));
    } catch {}
  }, []);

  const refreshViewedState = useCallback(() => {
    try {
      const raw = localStorage.getItem('alimedia_viewed_story_timestamps');
      if (raw) {
        setViewedTimestamps(JSON.parse(raw));
      }
    } catch {}
  }, []);

  const lastTapRef = useRef<{ [id: string]: number }>({});

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

  const triggerHeartAnimation = (id: string, pos?: { x: number; y: number }) => {
    setHeartAnims((prev) => ({ ...prev, [id]: { show: true, pos } }));
    setTimeout(() => {
      setHeartAnims((prev) => ({ ...prev, [id]: { show: false } }));
    }, 950);
  };

  const notify = (msg: string) => {
    if (onShowNotification) {
      onShowNotification(msg);
    }
  };

  const handleLike = async (id: string, initialCount: number = 0, isPost = true) => {
    const effectiveUid = getEffectiveUid();
    const postItem = isPost ? posts.find((p) => p.id === id) : null;
    const isCurrentlyLiked = userLiked[id] !== undefined
      ? userLiked[id]
      : (postItem?.likedBy?.includes(effectiveUid) || false);

    const nextLiked = !isCurrentlyLiked;

    setUserLiked((prev) => ({ ...prev, [id]: nextLiked }));
    setLikes((likePrev) => {
      const current = likePrev[id] !== undefined ? likePrev[id] : (postItem?.likesCount ?? initialCount);
      return { ...likePrev, [id]: nextLiked ? current + 1 : Math.max(0, current - 1) };
    });

    if (nextLiked) {
      triggerHeartAnimation(id);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(25); } catch {}
      }
    }

    if (isPost) {
      try {
        await toggleLikeElephantPost(id, effectiveUid, false);
      } catch (err) {
        console.warn('Like toggle sync error:', err);
      }
    }
  };

  const handlePostDoubleClick = async (
    e: React.MouseEvent | React.TouchEvent,
    id: string,
    initialCount: number = 0,
    isPost = true
  ) => {
    e.stopPropagation();
    const effectiveUid = getEffectiveUid();
    const postItem = isPost ? posts.find((p) => p.id === id) : null;

    let pos: { x: number; y: number } | undefined = undefined;
    if ('clientX' in e && e.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect();
      pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    // Trigger visual pop animation
    triggerHeartAnimation(id, pos);

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([35, 20]); } catch {}
    }

    const isCurrentlyLiked = userLiked[id] !== undefined
      ? userLiked[id]
      : (postItem?.likedBy?.includes(effectiveUid) || false);

    // If not liked yet, like it and increment count! If already liked, stays liked and animates
    if (!isCurrentlyLiked) {
      setUserLiked((prev) => ({ ...prev, [id]: true }));
      setLikes((likePrev) => {
        const current = likePrev[id] !== undefined ? likePrev[id] : (postItem?.likesCount ?? initialCount);
        return { ...likePrev, [id]: current + 1 };
      });

      if (isPost) {
        try {
          await toggleLikeElephantPost(id, effectiveUid, true);
        } catch (err) {
          console.warn('Double click like sync error:', err);
        }
      }
    }
  };

  const handleTouchEndImage = (
    e: React.TouchEvent,
    id: string,
    initialCount: number = 0,
    isPost = true
  ) => {
    const now = Date.now();
    const last = lastTapRef.current[id] || 0;
    if (now - last < 380) {
      // Double tap detected! Like & animate heart
      handlePostDoubleClick(e, id, initialCount, isPost);
      lastTapRef.current[id] = 0;
    } else {
      lastTapRef.current[id] = now;
    }
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
  // HELPER: Extract timestamp in milliseconds
  // -------------------------------------------------------------
  const getStoryTimestampMs = (createdAt: any): number => {
    if (!createdAt) return Date.now();
    if (typeof createdAt?.toMillis === 'function') return createdAt.toMillis();
    if (typeof createdAt?.toDate === 'function') return createdAt.toDate().getTime();
    if (createdAt instanceof Date) return createdAt.getTime();
    if (typeof createdAt === 'number') return createdAt;
    if (typeof createdAt === 'string') {
      const parsed = Date.parse(createdAt);
      if (!isNaN(parsed)) return parsed;
    }
    if (createdAt?.seconds) return createdAt.seconds * 1000;
    return Date.now();
  };

  // -------------------------------------------------------------
  // STORIES TRAY BUILDER (Followed Elephants Only, 6s Duration,
  // Ordered by Upload Time, Viewed Stories Move to the Back)
  // -------------------------------------------------------------
  const compiledStoryGroups: ElephantStoryGroup[] = useMemo(() => {
    const groupMap = new Map<string, ElephantStoryGroup>();

    // 1. Identify all elephants that the user is currently following
    const followedElephants = elephants.filter((el) => el.id && isFollowing(el.id));

    // 2. Gather user-submitted community stories/posts for followed elephants (within 24 hours)
    posts.forEach((post) => {
      if (post.isStory !== false && post.photoUrl && isWithin24Hours(post.createdAt)) {
        const linked = elephants.find((e) => e.id === post.elephantId || e.name === post.elephantName);
        const postElephantId = post.elephantId || linked?.id;
        
        // ONLY include if the user is following this elephant!
        if (postElephantId && isFollowing(postElephantId)) {
          const groupKey = postElephantId;

          if (!groupMap.has(groupKey)) {
            groupMap.set(groupKey, {
              elephantId: groupKey,
              elephantName: post.elephantName || linked?.name || 'Elephant',
              elephantSinhalaName: post.elephantSinhalaName || linked?.sinhalaName,
              avatarPhoto: linked?.photos?.[0] || post.photoUrl,
              coverPhoto: post.photoUrl,
              linkedElephant: linked,
              isTusker: linked?.type === 'tusker',
              isFollowed: true,
              isLive: linked?.isLive,
              latestStoryTimestamp: getStoryTimestampMs(post.createdAt),
              stories: [],
            });
          }

          const group = groupMap.get(groupKey)!;
          const postTimestamp = getStoryTimestampMs(post.createdAt);
          if (postTimestamp > (group.latestStoryTimestamp || 0)) {
            group.latestStoryTimestamp = postTimestamp;
            group.coverPhoto = post.photoUrl;
          }

          group.stories.push({
            id: post.id || `post-story-${Math.random()}`,
            elephantId: groupKey,
            elephantName: post.elephantName || linked?.name || 'Elephant',
            elephantSinhalaName: post.elephantSinhalaName || linked?.sinhalaName,
            photoUrl: post.photoUrl,
            caption: post.caption,
            authorName: post.authorName,
            authorUsername: post.authorUsername,
            authorPhotoURL: post.authorPhotoURL,
            createdAt: post.createdAt,
            linkedElephant: linked,
            isFollowed: true,
            isTusker: linked?.type === 'tusker',
            likesCount: post.likesCount,
          });
        }
      }
    });

    // 3. For any followed elephant that doesn't have community posts yet, include its official gallery photos
    followedElephants.forEach((el) => {
      if (el.id && !groupMap.has(el.id) && el.photos && el.photos.length > 0) {
        const elStories: StoryItem[] = el.photos.map((photoUrl, pIdx) => ({
          id: `el-${el.id}-photo-${pIdx}`,
          elephantId: el.id || '',
          elephantName: el.name,
          elephantSinhalaName: el.sinhalaName,
          photoUrl: photoUrl,
          caption: el.description,
          authorName: 'Verified Registry',
          authorUsername: '@official_registry',
          authorPhotoURL: el.photos[0],
          createdAt: el.updatedAt || el.createdAt || new Date(),
          linkedElephant: el,
          isFollowed: true,
          isTusker: el.type === 'tusker',
        }));

        groupMap.set(el.id, {
          elephantId: el.id,
          elephantName: el.name,
          elephantSinhalaName: el.sinhalaName,
          avatarPhoto: el.photos[0],
          coverPhoto: el.photos[0],
          linkedElephant: el,
          isTusker: el.type === 'tusker',
          isFollowed: true,
          isLive: el.isLive,
          latestStoryTimestamp: getStoryTimestampMs(el.updatedAt || el.createdAt),
          stories: elStories,
        });
      }
    });

    // 4. Calculate viewed state for each group
    const groupsArray = Array.from(groupMap.values()).filter((g) => g.stories.length > 0);
    groupsArray.forEach((group) => {
      const lastViewed = viewedTimestamps[group.elephantId] || 0;
      const latestTs = group.latestStoryTimestamp || 0;
      group.isViewed = lastViewed >= latestTs && lastViewed > 0;
    });

    // 5. Partition into Unviewed and Viewed groups
    const unviewedGroups = groupsArray.filter((g) => !g.isViewed);
    const viewedGroups = groupsArray.filter((g) => g.isViewed);

    // Sort by upload/update time (newest timestamp first)
    unviewedGroups.sort((a, b) => (b.latestStoryTimestamp || 0) - (a.latestStoryTimestamp || 0));
    viewedGroups.sort((a, b) => (b.latestStoryTimestamp || 0) - (a.latestStoryTimestamp || 0));

    // UNVIEWED stories appear first, VIEWED stories move to the back!
    return [...unviewedGroups, ...viewedGroups];
  }, [elephants, posts, isFollowing, viewedTimestamps]);

  // Main Feed Posts (Excludes story-only posts)
  const feedPosts = useMemo(() => {
    return posts.filter((p) => !p.isStoryOnly);
  }, [posts]);

  return (
    <div className="max-w-lg mx-auto w-full space-y-5 pb-24 animate-fadeIn pt-1">
      {/* ----------------------------------------------------------------- */}
      {/* STORIES TRAY (Rectangular Story Cards / Kotu Layout)              */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black text-[#062E22] dark:text-emerald-300 uppercase tracking-wider">
              {t.storiesUpdates}
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              {t.followedOnlyStories}
            </span>
          </div>

          <button
            onClick={() => onOpenCreatePost(undefined, true)}
            className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-emerald-200 flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{t.addStory}</span>
          </button>
        </div>

        {/* Horizontal Scrollable Story Cards Row */}
        <div className="flex gap-2.5 overflow-x-auto pb-2 pt-0.5 no-scrollbar -mx-1 px-1 items-stretch">
          {/* Rectangular Add Story Box */}
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

          {/* Grouped Elephant Story Cards (Each card has multiple 6s story segments) */}
          {compiledStoryGroups.length === 0 ? (
            <div className="flex-1 min-w-[220px] p-3 rounded-2xl bg-white dark:bg-[#121F1B] border border-dashed border-emerald-300/80 dark:border-emerald-900/60 flex flex-col justify-center items-start text-left space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#062E22] dark:text-emerald-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{t.noFollowedStoriesTitle}</span>
              </div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-snug">
                {t.noFollowedStoriesDesc}
              </p>
              {onOpenDirectory && (
                <button
                  type="button"
                  onClick={onOpenDirectory}
                  className="mt-0.5 px-3 py-1 bg-[#062E22] hover:bg-emerald-800 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-amber-300 dark:text-amber-200 text-[10px] font-black rounded-xl flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                >
                  <span>{language === 'si' ? '🐘 ඇතුන් සොයන්න (Follow)' : '🐘 Explore & Follow'}</span>
                </button>
              )}
            </div>
          ) : (
            compiledStoryGroups.map((group, groupIdx) => {
              const isLive = group.isLive;
              const isViewed = group.isViewed;
              const bilingualName = formatBilingualElephantName(
                { name: group.elephantName, sinhalaName: group.elephantSinhalaName },
                language
              );
              const segmentCount = group.stories.length;
              const coverImg = group.coverPhoto || group.avatarPhoto;

              return (
                <div
                  key={group.elephantId || groupIdx}
                  onClick={() =>
                    setActiveStoryViewer({
                      groups: compiledStoryGroups,
                      initialIndex: groupIdx,
                    })
                  }
                  className="flex-shrink-0 w-24 sm:w-26 cursor-pointer group"
                >
                  <div
                    className={`relative aspect-[3/4] rounded-2xl overflow-hidden shadow-xs bg-zinc-950 border-2 transition-all transform group-hover:scale-[1.03] ${
                      isViewed
                        ? 'border-white/20 opacity-75 group-hover:opacity-100'
                        : 'border-amber-400 ring-2 ring-amber-400/40 shadow-md'
                    }`}
                  >
                    <img
                      src={coverImg}
                      alt={group.elephantName}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/30 pointer-events-none" />

                    {/* Top Badges */}
                    <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-none">
                      {isLive ? (
                        <span className="inline-flex items-center gap-0.5 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md bg-red-600 text-white shadow-xs">
                          <Radio className="w-2 h-2" />
                        </span>
                      ) : !isViewed ? (
                        <span className="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-amber-400/50 animate-pulse" />
                      ) : (
                        <span className="p-0.5 rounded-full bg-black/50 backdrop-blur-xs border border-white/10">
                          <Check className="w-2 h-2 text-emerald-400 stroke-[3]" />
                        </span>
                      )}

                      {/* Segments count */}
                      {segmentCount > 1 && (
                        <div className="px-1.5 py-0.2 rounded-full bg-black/60 backdrop-blur-xs flex items-center gap-0.5 text-[8px] font-bold text-white/90 border border-white/20 shadow-xs">
                          <Play className="w-1.5 h-1.5 fill-white stroke-none" />
                          <span>{segmentCount}</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Avatar & Elephant Name */}
                    <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-1.5 text-white pointer-events-none">
                      <div className={`w-5 h-5 rounded-full overflow-hidden border-2 flex-shrink-0 bg-emerald-950 shadow-xs ${
                        isViewed ? 'border-zinc-400' : 'border-amber-400'
                      }`}>
                        <img
                          src={group.avatarPhoto || coverImg}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold truncate block drop-shadow text-white group-hover:text-amber-300 transition-colors" title={bilingualName}>
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
            const effectiveUid = getEffectiveUid();
            const isLiked = userLiked[postId] !== undefined
              ? userLiked[postId]
              : (post.likedBy?.includes(effectiveUid) || false);
            const currentLikes = likes[postId] !== undefined ? likes[postId] : (post.likesCount || 0);
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

                {/* 2. Photo View with Double Tap/Click to Like + Glowing Elephant Heart */}
                <div
                  onDoubleClick={(e) => handlePostDoubleClick(e, postId, post.likesCount || 0, true)}
                  onTouchEnd={(e) => handleTouchEndImage(e, postId, post.likesCount || 0, true)}
                  className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 cursor-pointer shadow-inner group select-none"
                >
                  <img
                    src={post.photoUrl}
                    alt={post.caption || post.elephantName}
                    className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-300 pointer-events-none"
                  />

                  {/* Animated Glowing Elephant Heart on Double Click */}
                  <ElephantHeartPop
                    show={!!heartAnims[postId]?.show}
                    position={heartAnims[postId]?.pos}
                  />

                  {/* Explicit Fullscreen Expand Button in bottom corner */}
                  {onSelectPhoto && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPhoto(post.photoUrl);
                      }}
                      className="absolute bottom-2.5 right-2.5 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition-all shadow-md active:scale-95 border border-white/20 opacity-80 hover:opacity-100"
                      title={language === 'si' ? 'සම්පූර්ණ ප්‍රමාණයෙන් බලන්න' : 'View Fullscreen'}
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* 3. Action Buttons: ONLY LIKE, SHARE, SAVE */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-3 text-zinc-700 dark:text-zinc-300">
                    {/* LIKE BUTTON */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLike(postId, post.likesCount || 0, true);
                      }}
                      className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full transition-all cursor-pointer select-none active:scale-95 ${
                        isLiked
                          ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                          : 'bg-zinc-100/70 hover:bg-zinc-100 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200'
                      }`}
                    >
                      <Heart
                        className={`w-4 h-4 transition-transform ${
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
          const effectiveUid = getEffectiveUid();
          const isLiked = userLiked[elephantId] !== undefined
            ? userLiked[elephantId]
            : (elephant.likedBy?.includes(effectiveUid) || false);
          const currentLikes = likes[elephantId] !== undefined ? likes[elephantId] : (elephant.likesCount || 0);
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

              {/* 2. Photo View with Double Tap/Click to Like + Glowing Elephant Heart */}
              <div
                onDoubleClick={(e) => handlePostDoubleClick(e, elephantId, elephant.likesCount || 0, false)}
                onTouchEnd={(e) => handleTouchEndImage(e, elephantId, elephant.likesCount || 0, false)}
                className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 cursor-pointer shadow-inner group select-none"
              >
                <img
                  src={postImage}
                  alt={elephant.name}
                  className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-300 pointer-events-none"
                />

                {/* Animated Glowing Elephant Heart on Double Click */}
                <ElephantHeartPop
                  show={!!heartAnims[elephantId]?.show}
                  position={heartAnims[elephantId]?.pos}
                />

                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 pointer-events-none">
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

                {/* Explicit Fullscreen Expand Button */}
                {onSelectPhoto && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPhoto(postImage);
                    }}
                    className="absolute bottom-2.5 right-2.5 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition-all shadow-md active:scale-95 border border-white/20 opacity-80 hover:opacity-100"
                    title={language === 'si' ? 'සම්පූර්ණ ප්‍රමාණයෙන් බලන්න' : 'View Fullscreen'}
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* 3. Action Buttons: ONLY LIKE, SHARE, SAVE */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-3 text-zinc-700 dark:text-zinc-300">
                  {/* LIKE BUTTON */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLike(elephantId, elephant.likesCount || 0, false);
                    }}
                    className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full transition-all cursor-pointer select-none active:scale-95 ${
                      isLiked
                        ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                        : 'bg-zinc-100/70 hover:bg-zinc-100 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200'
                    }`}
                  >
                    <Heart
                      className={`w-4 h-4 transition-transform ${
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
      {activeStoryViewer !== null && (
        <StoryViewerModal
          storyGroups={activeStoryViewer.groups}
          initialGroupIndex={activeStoryViewer.initialIndex}
          language={language}
          onClose={() => {
            setActiveStoryViewer(null);
            refreshViewedState();
          }}
          onSelectElephant={(el) => {
            setActiveStoryViewer(null);
            refreshViewedState();
            onSelectElephant(el);
          }}
          onShowNotification={showNotificationFallback}
          onMarkStoryViewed={handleMarkStoryViewed}
        />
      )}
    </div>
  );

  function showNotificationFallback(msg: string) {
    if (onShowNotification) onShowNotification(msg);
  }
};
