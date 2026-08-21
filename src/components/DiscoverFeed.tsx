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
  UserPlus,
  Check,
  Plus,
  Play,
  UserCheck
} from 'lucide-react';
import { Language, translations } from '../utils/translations';
import { useAuth } from '../firebase/authContext';
import { StoryViewerModal, StoryItem } from './StoryViewerModal';

interface DiscoverFeedProps {
  elephants: Elephant[];
  posts?: ElephantPost[];
  language: Language;
  onSelectElephant: (elephant: Elephant) => void;
  onOpenCreatePost: (elephantId?: string, isStoryOnly?: boolean) => void;
  onSelectPhoto?: (photoUrl: string) => void;
  onShowNotification?: (msg: string) => void;
}

export const DiscoverFeed: React.FC<DiscoverFeedProps> = ({
  elephants,
  posts = [],
  language,
  onSelectElephant,
  onOpenCreatePost,
  onSelectPhoto,
  onShowNotification,
}) => {
  const t = translations[language];
  const { isFollowing, toggleFollowElephant } = useAuth();
  const [likes, setLikes] = useState<{ [id: string]: number }>({});
  const [userLiked, setUserLiked] = useState<{ [id: string]: boolean }>({});
  const [savedPosts, setSavedPosts] = useState<{ [id: string]: boolean }>({});
  const [expandedCaptions, setExpandedCaptions] = useState<{ [id: string]: boolean }>({});

  // Story Viewer Modal State
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);

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
        notify(language === 'si' ? `${name} සුරැකි ලැයිස්තුවට එක් විය (Saved)!` : `Saved ${name} to bookmarks!`);
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
      notify(language === 'si' ? 'සබැඳිය පිටපත් කරගන්නා ලදී (Link copied)!' : 'Link copied to clipboard!');
    } catch (err) {
      notify(language === 'si' ? 'Link එක copy විය!' : 'Link ready to share!');
    }
  };

  const toggleCaption = (id: string) => {
    setExpandedCaptions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // -------------------------------------------------------------
  // STORIES TRAY BUILDER (Followed Elephants + Community Stories + Featured)
  // -------------------------------------------------------------
  const compiledStories: StoryItem[] = useMemo(() => {
    const storyList: StoryItem[] = [];
    const addedElephantIds = new Set<string>();

    // 1. Stories from user-submitted posts (both auto-share & story-only)
    posts.forEach((post) => {
      if (post.isStory !== false) {
        const linked = elephants.find((e) => e.id === post.elephantId || e.name === post.elephantName);
        const isFollowed = linked?.id ? isFollowing(linked.id) : false;

        storyList.push({
          id: post.id || `post-story-${Math.random()}`,
          elephantId: post.elephantId || linked?.id || '',
          elephantName: post.elephantName,
          elephantSinhalaName: post.elephantSinhalaName || linked?.sinhalaName,
          photoUrl: post.photoUrl,
          caption: post.caption,
          authorName: post.authorName,
          authorUsername: post.authorUsername,
          authorPhotoURL: post.authorPhotoURL,
          createdAt: post.createdAt,
          linkedElephant: linked,
          isFollowed: isFollowed,
          isTusker: linked?.type === 'tusker',
        });

        if (linked?.id) {
          addedElephantIds.add(linked.id);
        }
      }
    });

    // 2. Stories from elephants the user is following (if not already represented with a post)
    elephants.forEach((el) => {
      if (el.id && isFollowing(el.id) && !addedElephantIds.has(el.id)) {
        const photo = el.photos && el.photos.length > 0 ? el.photos[0] : '';
        if (photo) {
          storyList.push({
            id: `el-story-${el.id}`,
            elephantId: el.id,
            elephantName: el.name,
            elephantSinhalaName: el.sinhalaName,
            photoUrl: photo,
            caption: el.description,
            linkedElephant: el,
            isFollowed: true,
            isTusker: el.type === 'tusker',
          });
          addedElephantIds.add(el.id);
        }
      }
    });

    // 3. Featured & Live Elephants to fill out the reel
    elephants.forEach((el) => {
      if (el.id && !addedElephantIds.has(el.id) && (el.isLive || el.isFeatured || storyList.length < 8)) {
        const photo = el.photos && el.photos.length > 0 ? el.photos[0] : '';
        if (photo) {
          storyList.push({
            id: `el-feat-${el.id}`,
            elephantId: el.id,
            elephantName: el.name,
            elephantSinhalaName: el.sinhalaName,
            photoUrl: photo,
            caption: el.description,
            linkedElephant: el,
            isFollowed: isFollowing(el.id),
            isTusker: el.type === 'tusker',
          });
          addedElephantIds.add(el.id);
        }
      }
    });

    // Sort: Followed stories first, then Live, then latest
    return storyList.sort((a, b) => {
      if (a.isFollowed && !b.isFollowed) return -1;
      if (!a.isFollowed && b.isFollowed) return 1;
      if (a.linkedElephant?.isLive && !b.linkedElephant?.isLive) return -1;
      if (!a.linkedElephant?.isLive && b.linkedElephant?.isLive) return 1;
      return 0;
    });
  }, [elephants, posts, isFollowing]);

  // Main Feed Posts (Excludes story-only posts so the feed stays clean)
  const feedPosts = useMemo(() => {
    return posts.filter((p) => !p.isStoryOnly);
  }, [posts]);

  return (
    <div className="max-w-lg mx-auto w-full space-y-4 pb-24 animate-fadeIn pt-1">
      {/* ----------------------------------------------------------------- */}
      {/* STORIES TRAY (User Request: Followed Elephants & Auto Share Stories) */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-extrabold text-[#062E22] uppercase tracking-wider">
              {language === 'si' ? 'ඇත් කතා (Stories & Updates)' : 'Stories & Updates'}
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          <button
            onClick={() => onOpenCreatePost(undefined, true)}
            className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{language === 'si' ? 'Story එකක් දාන්න' : 'Add Story'}</span>
          </button>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-2 pt-0.5 no-scrollbar -mx-1 px-1">
          {/* 1. Large "+" Story Creator Box */}
          <div
            onClick={() => onOpenCreatePost(undefined, true)}
            className="flex-shrink-0 w-24 sm:w-26 cursor-pointer group"
          >
            <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-xs bg-[#062E22] border-2 border-dashed border-emerald-400/50 group-hover:border-amber-400 transition-all flex flex-col items-center justify-center p-2 text-center text-white">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-400 to-emerald-500 text-zinc-950 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform shadow-md">
                <Plus className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="text-[10px] font-extrabold leading-tight">
                {language === 'si' ? 'Story එකක් එක් කරන්න' : 'Add Story'}
              </span>
              <span className="text-[8px] text-amber-300 font-semibold mt-0.5">
                Story Only / Post
              </span>
            </div>
          </div>

          {/* 2. Story Cards (Followed Elephants & Community Stories) */}
          {compiledStories.map((story, idx) => {
            const hasFollowedBadge = story.isFollowed;
            const isLive = story.linkedElephant?.isLive;

            return (
              <div
                key={story.id || idx}
                onClick={() => setActiveStoryIndex(idx)}
                className="flex-shrink-0 w-26 sm:w-28 cursor-pointer group"
              >
                <div
                  className={`relative aspect-[3/4] rounded-2xl overflow-hidden shadow-xs bg-zinc-900 border-2 transition-all transform group-hover:scale-[1.02] ${
                    hasFollowedBadge
                      ? 'border-amber-400 ring-2 ring-emerald-500/30'
                      : isLive
                      ? 'border-red-500 animate-pulse'
                      : 'border-emerald-600/70 group-hover:border-emerald-400'
                  }`}
                >
                  <img
                    src={story.photoUrl}
                    alt={story.elephantName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/30" />

                  {/* Top Badges (Live / Following / Tusker) */}
                  <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between">
                    {isLive ? (
                      <span className="inline-flex items-center gap-0.5 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md bg-red-600 text-white shadow-xs">
                        <Radio className="w-2 h-2" />
                        <span>LIVE</span>
                      </span>
                    ) : hasFollowedBadge ? (
                      <span className="inline-flex items-center gap-0.5 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md bg-amber-400 text-zinc-950 shadow-xs">
                        <UserCheck className="w-2.5 h-2.5 stroke-[2.5]" />
                        <span>FOLLOWING</span>
                      </span>
                    ) : (
                      <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-emerald-700/90 text-white shadow-xs">
                        {story.isTusker ? 'Tusker' : 'Elephant'}
                      </span>
                    )}

                    <div className="w-4 h-4 rounded-full bg-black/40 backdrop-blur-xs flex items-center justify-center text-white/80">
                      <Play className="w-2 h-2 fill-white stroke-none" />
                    </div>
                  </div>

                  {/* Bottom Avatar & Elephant Name */}
                  <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5 text-white">
                    <div className="w-5 h-5 rounded-full overflow-hidden border-2 border-emerald-400 flex-shrink-0 bg-emerald-950 shadow-xs">
                      <img
                        src={story.linkedElephant?.photos?.[0] || story.photoUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-[10px] font-extrabold truncate drop-shadow">
                      {story.elephantName}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* COMMUNITY POSTS (Clean: Image, Caption, Profile, Like/Share/Save)  */}
      {/* ----------------------------------------------------------------- */}
      {feedPosts && feedPosts.length > 0 && (
        <div className="space-y-4 pt-1">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-extrabold text-[#062E22] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{language === 'si' ? 'නවතම ඡායාරූප (Community Posts)' : 'Community Posts'}</span>
            </h3>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
              {feedPosts.length} {feedPosts.length === 1 ? 'Post' : 'Posts'}
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

            return (
              <div
                key={postId}
                className="bg-white rounded-3xl p-3.5 sm:p-4 shadow-xs border border-zinc-200/80 transition-all space-y-2.5"
              >
                {/* 1. Header: Elephant Profile (Avatar, Name, Org, View Profile button) */}
                <div className="flex items-center justify-between gap-2">
                  <div
                    onClick={() => linkedElephant && onSelectElephant(linkedElephant)}
                    className="flex items-center gap-2.5 cursor-pointer group min-w-0"
                  >
                    <div className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 via-emerald-600 to-[#062E22] shrink-0">
                      <div className="w-full h-full rounded-full overflow-hidden bg-white">
                        <img
                          src={post.photoUrl}
                          alt={post.elephantName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-extrabold text-sm text-[#062E22] group-hover:text-emerald-700 transition-colors truncate">
                          {post.elephantName}
                        </h4>
                        {post.elephantSinhalaName && (
                          <span className="text-xs font-semibold text-emerald-800/80 font-sinhala truncate">
                            ({post.elephantSinhalaName})
                          </span>
                        )}
                        {linkedElephant?.type === 'tusker' && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-100 text-amber-900">
                            Tusker
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 truncate flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-emerald-700 shrink-0" />
                        <span>{linkedElephant?.organization || linkedElephant?.location || 'Sri Lanka'}</span>
                      </p>
                    </div>
                  </div>

                  {/* View Elephant Profile Button */}
                  {linkedElephant && (
                    <button
                      onClick={() => onSelectElephant(linkedElephant)}
                      className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-900 hover:bg-emerald-100 transition-colors cursor-pointer shrink-0 border border-emerald-200"
                    >
                      {t.viewProfile}
                    </button>
                  )}
                </div>

                {/* 2. Clear Image View */}
                <div
                  onClick={() => onSelectPhoto ? onSelectPhoto(post.photoUrl) : (linkedElephant && onSelectElephant(linkedElephant))}
                  className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-100 cursor-pointer shadow-inner group"
                >
                  <img
                    src={post.photoUrl}
                    alt={post.caption || post.elephantName}
                    className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-300"
                  />
                </div>

                {/* 3. Action Buttons: ONLY LIKE, SHARE, SAVE */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-3 text-zinc-700">
                    {/* LIKE BUTTON */}
                    <button
                      onClick={() => handleLike(postId, post.likesCount || 18)}
                      className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                        isLiked
                          ? 'bg-red-50 text-red-600'
                          : 'bg-zinc-100/70 hover:bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      <Heart
                        className={`w-4 h-4 transition-transform active:scale-125 ${
                          isLiked ? 'fill-red-500 text-red-500 scale-110' : 'text-zinc-700 stroke-[2]'
                        }`}
                      />
                      <span>{currentLikes}</span>
                    </button>

                    {/* SHARE BUTTON */}
                    <button
                      onClick={() => handleShare(linkedElephant?.id || postId, post.elephantName, post.caption)}
                      className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-zinc-100/70 hover:bg-zinc-100 text-zinc-700 hover:text-emerald-800 transition-colors cursor-pointer"
                      title="Share post"
                    >
                      <Share2 className="w-4 h-4 stroke-[2]" />
                      <span>{language === 'si' ? 'බෙදාහරින්න' : 'Share'}</span>
                    </button>
                  </div>

                  {/* SAVE / BOOKMARK BUTTON */}
                  <button
                    onClick={() => handleBookmark(postId, post.elephantName)}
                    className={`p-1.5 rounded-full transition-all cursor-pointer ${
                      isSaved
                        ? 'bg-emerald-100 text-emerald-900'
                        : 'bg-zinc-100/70 hover:bg-zinc-100 text-zinc-600 hover:text-[#062E22]'
                    }`}
                    title="Save post"
                  >
                    <Bookmark
                      className={`w-4 h-4 ${isSaved ? 'fill-emerald-800 text-emerald-800' : 'stroke-[2]'}`}
                    />
                  </button>
                </div>

                {/* 4. Caption with "See more" / Truncate feature */}
                {captionText && (
                  <div className="text-xs text-zinc-800 pt-0.5 leading-relaxed">
                    <span className="font-bold text-[#062E22] mr-1.5">
                      {post.elephantName}
                    </span>
                    <span>
                      {isLongCaption && !isExpanded
                        ? `${captionText.slice(0, 110)}... `
                        : captionText}
                    </span>
                    {isLongCaption && (
                      <button
                        onClick={() => toggleCaption(postId)}
                        className="ml-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                      >
                        {isExpanded
                          ? (language === 'si' ? 'අඩුවෙන් පෙන්වන්න (See less)' : 'See less')
                          : (language === 'si' ? 'තව කියවන්න (See more)' : 'See more')}
                      </button>
                    )}
                  </div>
                )}

                {/* 5. Clean Author Attribution at Bottom */}
                <div className="pt-1.5 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-4 h-4 rounded-full overflow-hidden bg-zinc-200 border border-zinc-300 shrink-0">
                      <img
                        src={post.authorPhotoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="truncate">
                      {language === 'si' ? 'ඡායාරූපය:' : 'By:'}{' '}
                      <b className="text-[#062E22] font-semibold">{post.authorUsername || post.authorName}</b>
                    </span>
                  </div>

                  <span className="text-[10px] text-zinc-400 shrink-0">
                    {language === 'si' ? 'සහභාගීත්ව සටහනක්' : 'Community'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* MAIN ELEPHANT REGISTRY FEED (Clean & Minimal)                     */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1 pt-1">
          <h3 className="text-xs font-extrabold text-[#062E22] uppercase tracking-wider">
            {language === 'si' ? 'හීලෑ ඇත් රජවරුන්ගේ ලේඛනාගාරය' : 'Verified Elephant Registry'}
          </h3>
          <span className="text-[10px] text-zinc-400">
            {elephants.length} Elephants
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

          const postImage = elephant.photos && elephant.photos.length > 0
            ? elephant.photos[0]
            : 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=1200&q=80';

          return (
            <div
              key={elephantId}
              className="bg-white rounded-3xl p-3.5 sm:p-4 shadow-xs border border-zinc-200/80 transition-all space-y-2.5"
            >
              {/* 1. Header: Avatar, Name, Location Subtitle, Follow button */}
              <div className="flex items-center justify-between gap-2">
                <div
                  onClick={() => onSelectElephant(elephant)}
                  className="flex items-center gap-2.5 cursor-pointer group min-w-0"
                >
                  <div className="relative w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 via-emerald-600 to-[#062E22] shrink-0">
                    <div className="w-full h-full rounded-full overflow-hidden bg-white">
                      <img
                        src={postImage}
                        alt={elephant.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold text-sm text-[#062E22] group-hover:text-emerald-700 transition-colors truncate">
                        {elephant.name}
                      </h3>
                      {elephant.sinhalaName && (
                        <span className="text-xs font-semibold text-emerald-800/80 font-sinhala truncate">
                          ({elephant.sinhalaName})
                        </span>
                      )}
                      {elephant.verified && (
                        <span title="Verified Domesticated Sri Lankan Elephant" className="shrink-0">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600/20" />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500 truncate flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-emerald-700 shrink-0" />
                      <span className="truncate">{elephant.organization || elephant.location || 'Sri Lanka'}</span>
                    </p>
                  </div>
                </div>

                {/* Follow Button */}
                <button
                  onClick={() => elephant.id && toggleFollowElephant(elephant.id)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                    following
                      ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border border-zinc-200'
                      : 'bg-[#062E22] text-white hover:bg-emerald-900 shadow-2xs'
                  }`}
                >
                  {following ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-700" />
                      <span>Following</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3 h-3" />
                      <span>Follow</span>
                    </>
                  )}
                </button>
              </div>

              {/* 2. Main Post Image */}
              <div
                onClick={() => onSelectElephant(elephant)}
                className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-100 cursor-pointer shadow-inner group"
              >
                <img
                  src={postImage}
                  alt={elephant.name}
                  className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-300"
                />

                {/* Clean Floating Badge */}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-md backdrop-blur-md ${
                      isTusker
                        ? 'bg-amber-400/95 text-amber-950 border border-amber-300'
                        : 'bg-[#062E22]/90 text-white border border-emerald-500/30'
                    }`}
                  >
                    {isTusker ? <Crown className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                    <span>{isTusker ? 'Tusker' : 'Elephant'}</span>
                  </span>
                </div>
              </div>

              {/* 3. Action Bar: ONLY LIKE, SHARE, SAVE */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-3 text-zinc-700">
                  {/* LIKE BUTTON */}
                  <button
                    onClick={() => handleLike(elephantId, defaultLikes)}
                    className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                      isLiked
                        ? 'bg-red-50 text-red-600'
                        : 'bg-zinc-100/70 hover:bg-zinc-100 text-zinc-700'
                    }`}
                  >
                    <Heart
                      className={`w-4 h-4 transition-transform active:scale-125 ${
                        isLiked ? 'fill-red-500 text-red-500 scale-110' : 'text-zinc-700 stroke-[2]'
                      }`}
                    />
                    <span>{currentLikes}</span>
                  </button>

                  {/* SHARE BUTTON */}
                  <button
                    onClick={() => handleShare(elephant.id || elephantId, elephant.name, elephant.description)}
                    className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-zinc-100/70 hover:bg-zinc-100 text-zinc-700 hover:text-emerald-800 transition-colors cursor-pointer"
                    title="Share elephant profile"
                  >
                    <Share2 className="w-4 h-4 stroke-[2]" />
                    <span>{language === 'si' ? 'බෙදාහරින්න' : 'Share'}</span>
                  </button>
                </div>

                {/* SAVE / BOOKMARK BUTTON */}
                <button
                  onClick={() => handleBookmark(elephantId, elephant.name)}
                  className={`p-1.5 rounded-full transition-all cursor-pointer ${
                    isSaved
                      ? 'bg-emerald-100 text-emerald-900'
                      : 'bg-zinc-100/70 hover:bg-zinc-100 text-zinc-600 hover:text-[#062E22]'
                  }`}
                  title="Save to bookmarks"
                >
                  <Bookmark
                    className={`w-4 h-4 ${isSaved ? 'fill-emerald-800 text-emerald-800' : 'stroke-[2]'}`}
                  />
                </button>
              </div>

              {/* 4. Caption & Description with "See more" */}
              <div className="space-y-1 text-xs text-zinc-800 pt-0.5">
                <div className="leading-relaxed">
                  <span
                    className="font-bold text-[#062E22] cursor-pointer hover:underline mr-1.5"
                    onClick={() => onSelectElephant(elephant)}
                  >
                    {elephant.name}
                  </span>
                  <span className="text-zinc-700">
                    {isLongDescription && !isExpanded
                      ? `${descriptionText.slice(0, 120)}... `
                      : descriptionText}
                  </span>
                  {isLongDescription && (
                    <button
                      onClick={() => toggleCaption(elephantId)}
                      className="ml-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                    >
                      {isExpanded
                        ? (language === 'si' ? 'අඩුවෙන් පෙන්වන්න (See less)' : 'See less')
                        : (language === 'si' ? 'තව කියවන්න (See more)' : 'See more')}
                    </button>
                  )}
                </div>

                {/* Bottom View Full Profile Link */}
                <div className="pt-1.5 flex items-center justify-between border-t border-zinc-100">
                  <button
                    onClick={() => onSelectElephant(elephant)}
                    className="text-xs font-bold text-emerald-800 hover:text-[#062E22] cursor-pointer"
                  >
                    {t.viewProfile} →
                  </button>

                  <span className="text-[10px] text-zinc-400">
                    {elephant.location || 'Sri Lanka'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* IMMERSIVE STORY VIEWER MODAL                                      */}
      {/* ----------------------------------------------------------------- */}
      {activeStoryIndex !== null && (
        <StoryViewerModal
          stories={compiledStories}
          initialIndex={activeStoryIndex}
          language={language}
          onClose={() => setActiveStoryIndex(null)}
          onSelectElephant={onSelectElephant}
          onShowNotification={notify}
        />
      )}
    </div>
  );
};
