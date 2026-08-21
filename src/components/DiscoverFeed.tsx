import React, { useState } from 'react';
import { Elephant } from '../types/elephant';
import { Heart, MessageCircle, Send, Bookmark, MoreVertical, ShieldCheck, Crown, Sparkles, Building2, Eye, Star, Radio, UserPlus, Check } from 'lucide-react';
import { Language, translations } from '../utils/translations';
import { useAuth } from '../firebase/authContext';

interface DiscoverFeedProps {
  elephants: Elephant[];
  language: Language;
  onSelectElephant: (elephant: Elephant) => void;
  onOpenAdmin: () => void;
}

export const DiscoverFeed: React.FC<DiscoverFeedProps> = ({
  elephants,
  language,
  onSelectElephant,
  onOpenAdmin,
}) => {
  const t = translations[language];
  const { isFollowing, toggleFollowElephant } = useAuth();
  const [likes, setLikes] = useState<{ [id: string]: number }>({});
  const [userLiked, setUserLiked] = useState<{ [id: string]: boolean }>({});
  const [savedPosts, setSavedPosts] = useState<{ [id: string]: boolean }>({});

  const handleLike = (id: string, initialCount: number = 247) => {
    setUserLiked((prev) => {
      const isCurrentlyLiked = !!prev[id];
      const newStatus = !isCurrentlyLiked;
      setLikes((likePrev) => {
        const current = likePrev[id] !== undefined ? likePrev[id] : initialCount;
        return { ...likePrev, [id]: newStatus ? current + 1 : current - 1 };
      });
      return { ...prev, [id]: newStatus };
    });
  };

  const handleBookmark = (id: string) => {
    setSavedPosts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Sort featured & live elephants first in stories row
  const storiesList = [...elephants].sort((a, b) => {
    if (a.isLive && !b.isLive) return -1;
    if (!a.isLive && b.isLive) return 1;
    if (a.isFeatured && !b.isFeatured) return -1;
    if (!a.isFeatured && b.isFeatured) return 1;
    return 0;
  });

  return (
    <div className="max-w-lg mx-auto w-full space-y-4 pb-20 animate-fadeIn pt-1">
      {/* Horizontal Story / Featured Tuskers Carousel */}
      <div className="space-y-2">
        <div className="flex gap-3 overflow-x-auto pb-2 pt-0.5 no-scrollbar -mx-1 px-1">
          {storiesList.map((el, idx) => {
            const photo = el.photos && el.photos.length > 0 ? el.photos[0] : 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=600&q=80';
            const isTusker = el.type === 'tusker';

            return (
              <div
                key={el.id || idx}
                onClick={() => onSelectElephant(el)}
                className="flex-shrink-0 w-28 cursor-pointer group"
              >
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-xs bg-zinc-200 border border-zinc-200/80 group-hover:border-emerald-700 transition-all transform group-hover:scale-[1.02]">
                  <img
                    src={photo}
                    alt={el.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

                  {/* Badges */}
                  <div className="absolute top-1.5 left-1.5">
                    {el.isLive ? (
                      <span className="inline-flex items-center gap-0.5 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md shadow-xs bg-red-600 text-white animate-pulse">
                        <Radio className="w-2 h-2" />
                        <span>LIVE</span>
                      </span>
                    ) : el.isFeatured ? (
                      <span className="inline-flex items-center gap-0.5 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md shadow-xs bg-purple-600 text-white">
                        <Star className="w-2 h-2" />
                        <span>FEATURED</span>
                      </span>
                    ) : (
                      <span
                        className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-md shadow-xs ${
                          isTusker
                            ? 'bg-amber-400 text-zinc-950'
                            : 'bg-emerald-700 text-white'
                        }`}
                      >
                        {isTusker ? 'Tusker' : 'Elephant'}
                      </span>
                    )}
                  </div>

                  {/* Name on bottom */}
                  <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5 text-white">
                    <div className="w-5 h-5 rounded-full overflow-hidden border border-white flex-shrink-0 bg-emerald-950">
                      <img src={photo} alt="" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[11px] font-bold truncate">
                      {el.name}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Feed Posts List */}
      <div className="space-y-4">
        {elephants.map((elephant, index) => {
          const elephantId = elephant.id || `el-${index}`;
          const isTusker = elephant.type === 'tusker';
          const defaultLikes = 150 + (index * 47) % 320;
          const currentLikes = likes[elephantId] !== undefined ? likes[elephantId] : defaultLikes;
          const isLiked = !!userLiked[elephantId];
          const isSaved = !!savedPosts[elephantId];
          const following = elephant.id ? isFollowing(elephant.id) : false;
          const baseFollowers = (elephant.followerCount !== undefined ? elephant.followerCount : (580 + (index * 73) % 450));
          const currentFollowers = baseFollowers + (following ? 1 : 0);

          const postImage = elephant.photos && elephant.photos.length > 0
            ? elephant.photos[0]
            : 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=1200&q=80';

          return (
            <div
              key={elephantId}
              className="bg-white rounded-3xl p-4 shadow-xs hover:shadow-sm border border-zinc-200/80 transition-all space-y-3"
            >
              {/* Post Header: Avatar, Name, Location Subtitle, Follow button */}
              <div className="flex items-center justify-between gap-2">
                <div
                  onClick={() => onSelectElephant(elephant)}
                  className="flex items-center gap-2.5 cursor-pointer group min-w-0"
                >
                  <div className="relative w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 via-emerald-600 to-[#062E22] flex-shrink-0">
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
                    <p className="text-[11px] text-zinc-500 line-clamp-1 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-emerald-700 flex-shrink-0" />
                      <span className="truncate">{elephant.organization || elephant.location || 'Sri Lanka'}</span>
                    </p>
                  </div>
                </div>

                {/* Follow Button on Card */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => elephant.id && toggleFollowElephant(elephant.id)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
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

                  <button
                    onClick={() => onSelectElephant(elephant)}
                    className="p-1 text-zinc-400 hover:text-zinc-600 rounded-full hover:bg-zinc-100 transition-colors cursor-pointer"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Main Post Image */}
              <div
                onClick={() => onSelectElephant(elephant)}
                className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-100 cursor-pointer shadow-inner group"
              >
                <img
                  src={postImage}
                  alt={elephant.name}
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                />

                {/* Floating Badges */}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold shadow-md backdrop-blur-md ${
                      isTusker
                        ? 'bg-amber-400/95 text-amber-950 border border-amber-300'
                        : 'bg-[#062E22]/90 text-white border border-emerald-500/30'
                    }`}
                  >
                    {isTusker ? <Crown className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                    <span>{isTusker ? 'Tusker' : 'Elephant'}</span>
                  </span>

                  {elephant.isFeatured && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-600/90 text-white backdrop-blur-md shadow-md">
                      <Star className="w-2.5 h-2.5" />
                      <span>Featured</span>
                    </span>
                  )}
                </div>

                {elephant.status === 'memorial' && (
                  <div className="absolute top-2.5 right-2.5">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-zinc-900/90 text-amber-300 backdrop-blur-md border border-amber-400/30">
                      National Treasure
                    </span>
                  </div>
                )}
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-between pt-0.5">
                <div className="flex items-center gap-4 text-zinc-700">
                  {/* Like Button */}
                  <button
                    onClick={() => handleLike(elephantId, defaultLikes)}
                    className="flex items-center gap-1.5 text-xs font-bold hover:text-red-500 transition-colors cursor-pointer"
                  >
                    <Heart
                      className={`w-4 h-4 transition-all ${
                        isLiked ? 'fill-red-500 text-red-500 scale-110' : 'text-zinc-700 stroke-[2]'
                      }`}
                    />
                    <span>{currentLikes}</span>
                  </button>

                  {/* Comment / Procession Count */}
                  <button
                    onClick={() => onSelectElephant(elephant)}
                    className="flex items-center gap-1.5 text-xs font-bold text-zinc-700 hover:text-emerald-700 transition-colors cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4 stroke-[2]" />
                    <span>{elephant.peraheraParticipation?.length ? elephant.peraheraParticipation.length * 9 : 28}</span>
                  </button>

                  {/* Share */}
                  <button
                    onClick={() => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(`${elephant.name} Profile: ${window.location.origin}/#elephant`);
                        alert('Elephant link copied to clipboard!');
                      }
                    }}
                    className="flex items-center gap-1 text-xs font-bold text-zinc-700 hover:text-emerald-700 transition-colors cursor-pointer"
                  >
                    <Send className="w-4 h-4 stroke-[2]" />
                  </button>
                </div>

                {/* Bookmark Button */}
                <button
                  onClick={() => handleBookmark(elephantId)}
                  className="text-zinc-700 hover:text-[#062E22] transition-colors cursor-pointer p-1"
                >
                  <Bookmark
                    className={`w-4 h-4 ${isSaved ? 'fill-[#062E22] text-[#062E22]' : 'stroke-[2]'}`}
                  />
                </button>
              </div>

              {/* Caption & Story Description */}
              <div className="space-y-1 text-xs text-zinc-700">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-bold text-[#062E22] cursor-pointer" onClick={() => onSelectElephant(elephant)}>
                    {elephant.name}
                  </span>
                  <span className="text-zinc-600 line-clamp-2 leading-relaxed">
                    {elephant.description}
                  </span>
                </div>

                {/* Follower Count & View Full Profile link */}
                <div className="pt-2 flex items-center justify-between border-t border-zinc-100">
                  <button
                    onClick={() => onSelectElephant(elephant)}
                    className="text-xs font-bold text-emerald-800 hover:text-[#062E22] flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{t.viewProfile} →</span>
                  </button>

                  <span className="text-[11px] font-bold text-emerald-900/80 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {currentFollowers.toLocaleString()} Followers
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
