import React, { useState, useMemo } from 'react';
import { Elephant } from '../types/elephant';
import {
  Search,
  ShieldCheck,
  Crown,
  Building2,
  ChevronRight,
  Flame,
  Users,
  Award,
  Sparkles,
  UserCheck,
  UserPlus
} from 'lucide-react';
import { Language, translations } from '../utils/translations';
import { useAuth } from '../firebase/authContext';

interface ElephantDirectoryProps {
  elephants: Elephant[];
  posts?: any[];
  language: Language;
  onSelectElephant: (elephant: Elephant) => void;
  onSelectPhoto?: (photoUrl: string) => void;
  onShowNotification?: (msg: string) => void;
}

export const ElephantDirectory: React.FC<ElephantDirectoryProps> = ({
  elephants,
  language,
  onSelectElephant,
}) => {
  const t = translations[language];
  const { isFollowing, toggleFollowElephant } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'tusker' | 'elephant' | 'living' | 'memorial'>('all');

  // -------------------------------------------------------------
  // TOP 3 MOST FOLLOWED ELEPHANTS (වැඩිම followersලා ඉන්න අලි 3 දෙනා)
  // -------------------------------------------------------------
  const topFollowedElephants = useMemo(() => {
    const scored = elephants.map((el, idx) => {
      const baseFollowers = el.followerCount || (
        el.name.toLowerCase().includes('ind') ? 14250 :
        el.name.toLowerCase().includes('myan') ? 11800 :
        el.name.toLowerCase().includes('kand') ? 9400 :
        el.name.toLowerCase().includes('nad') ? 16500 :
        7200 - idx * 600
      );
      const isCurrentlyFollowed = el.id ? isFollowing(el.id) : false;
      const totalFollowers = baseFollowers + (isCurrentlyFollowed ? 1 : 0);
      return {
        elephant: el,
        followers: totalFollowers,
        isFollowed: isCurrentlyFollowed,
      };
    });

    scored.sort((a, b) => b.followers - a.followers);
    return scored.slice(0, 3);
  }, [elephants, isFollowing]);

  // Filtered elephants for directory list
  const filteredElephants = useMemo(() => {
    return elephants.filter((el) => {
      if (activeCategory === 'tusker' && el.type !== 'tusker') return false;
      if (activeCategory === 'elephant' && el.type !== 'elephant') return false;
      if (activeCategory === 'living' && el.status !== 'living') return false;
      if (activeCategory === 'memorial' && el.status !== 'memorial') return false;

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        el.name.toLowerCase().includes(term) ||
        (el.sinhalaName && el.sinhalaName.includes(term)) ||
        (el.location && el.location.toLowerCase().includes(term)) ||
        (el.organization && el.organization.toLowerCase().includes(term)) ||
        (el.mahout && el.mahout.toLowerCase().includes(term))
      );
    });
  }, [elephants, activeCategory, searchTerm]);

  return (
    <div className="max-w-lg mx-auto w-full space-y-4 pb-24 animate-fadeIn">
      {/* Title Header */}
      <div className="pt-2 px-1 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#062E22] tracking-tight">
            {language === 'si' ? 'හීලෑ අලි නාමාවලිය' : 'Elephant Directory'}
          </h1>
          <p className="text-xs text-zinc-500 font-medium mt-0.5">
            {language === 'si'
              ? 'ශ්‍රී ලංකාවේ ලියාපදිංචි හීලෑ අලි සහ ඇත්තු'
              : 'Verified domesticated Sri Lankan elephants & tuskers'}
          </p>
        </div>

        <span className="px-3 py-1 bg-emerald-100 text-emerald-900 rounded-full text-xs font-bold">
          {filteredElephants.length}
        </span>
      </div>

      {/* ================================================================= */}
      {/* TRENDING SECTION: Top 3 Most Followed Elephants in Story-box size */}
      {/* ================================================================= */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center shadow-xs">
              <Flame className="w-3 h-3 fill-zinc-950" />
            </div>
            <h2 className="text-xs font-black text-[#062E22] uppercase tracking-wider">
              {language === 'si' ? 'වැඩිම Followersලා සිටින ඇතුන් 3 (Trending)' : 'Top 3 Most Followed (Trending)'}
            </h2>
          </div>
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
            Top #1 - #3
          </span>
        </div>

        {/* 3 Compact Story-Sized Boxes */}
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
          {topFollowedElephants.map((item, index) => {
            const el = item.elephant;
            const rank = index + 1;
            const photo = el.photos?.[0] || 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=400&q=80';
            const formattedFollowers = item.followers >= 1000 ? `${(item.followers / 1000).toFixed(1)}K` : `${item.followers}`;

            return (
              <div
                key={el.id || index}
                onClick={() => onSelectElephant(el)}
                className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-xs cursor-pointer group border-2 transition-all transform hover:scale-[1.02] bg-zinc-900 border-emerald-600/70 hover:border-amber-400"
              >
                <img
                  src={photo}
                  alt={el.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/30" />

                {/* Top Badge: Rank & Follow status */}
                <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between">
                  <span className={`inline-flex items-center gap-0.5 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md shadow-xs ${
                    rank === 1
                      ? 'bg-amber-400 text-zinc-950'
                      : rank === 2
                      ? 'bg-zinc-200 text-zinc-900'
                      : 'bg-amber-700/90 text-white'
                  }`}>
                    {rank === 1 ? <Crown className="w-2.5 h-2.5 fill-current" /> : <Award className="w-2.5 h-2.5" />}
                    <span>#{rank}</span>
                  </span>

                  {/* Follow / Unfollow Mini Toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (el.id) toggleFollowElephant(el.id);
                    }}
                    title={item.isFollowed ? 'Following' : 'Follow'}
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform active:scale-90 shadow-md ${
                      item.isFollowed
                        ? 'bg-amber-400 text-zinc-950'
                        : 'bg-black/50 text-white hover:bg-emerald-700 backdrop-blur-xs'
                    }`}
                  >
                    {item.isFollowed ? (
                      <UserCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                    ) : (
                      <UserPlus className="w-3 h-3 stroke-[2.5]" />
                    )}
                  </button>
                </div>

                {/* Bottom Details: Follower count & Elephant Name */}
                <div className="absolute bottom-2 left-2 right-2 text-white space-y-0.5">
                  <div className="flex items-center gap-1 text-[9px] font-black text-amber-300 drop-shadow">
                    <Users className="w-2.5 h-2.5 text-amber-300" />
                    <span>{formattedFollowers} Followers</span>
                  </div>

                  <h3 className="text-xs font-extrabold truncate drop-shadow leading-tight">
                    {el.name}
                  </h3>

                  {el.sinhalaName && (
                    <p className="text-[10px] font-medium text-white/80 truncate font-sinhala leading-tight">
                      {el.sinhalaName}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative pt-1">
        <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-2xl text-xs sm:text-sm text-[#062E22] placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-700 shadow-xs"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400 hover:text-zinc-600"
          >
            Clear
          </button>
        )}
      </div>

      {/* Filter Category Chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'all', label: language === 'si' ? 'සියල්ල' : 'All' },
          { id: 'tusker', label: language === 'si' ? 'ඇත්තු (Tuskers)' : 'Tuskers' },
          { id: 'elephant', label: language === 'si' ? 'අලින් (Elephants)' : 'Elephants' },
          { id: 'living', label: language === 'si' ? 'ජීවතුන් අතර' : 'Living' },
          { id: 'memorial', label: language === 'si' ? 'ජාතික වස්තු (Memorial)' : 'Memorial' },
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id as any)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeCategory === cat.id
                ? 'bg-[#062E22] text-white shadow-xs'
                : 'bg-white text-zinc-600 border border-zinc-200 hover:border-zinc-300'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Elephant Profile Cards List */}
      <div className="space-y-3.5">
        {filteredElephants.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-zinc-200">
            <p className="text-sm font-semibold text-zinc-600">
              {language === 'si' ? 'කිසිදු හීලෑ අලියෙකු හමු නොවීය.' : 'No elephant profiles found.'}
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setActiveCategory('all');
              }}
              className="mt-3 text-xs text-emerald-700 font-bold hover:underline cursor-pointer"
            >
              {language === 'si' ? 'සියලු පෙරහන් ඉවත් කරන්න' : 'Reset filters'}
            </button>
          </div>
        ) : (
          filteredElephants.map((elephant) => {
            const isTusker = elephant.type === 'tusker';
            const photo = elephant.photos && elephant.photos.length > 0
              ? elephant.photos[0]
              : 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=600&q=80';

            return (
              <div
                key={elephant.id}
                className="bg-white rounded-2xl p-3.5 sm:p-4 shadow-xs hover:shadow-md border border-zinc-200/80 transition-all flex items-center justify-between gap-3 group"
              >
                {/* Left side: Avatar + Details */}
                <div
                  onClick={() => onSelectElephant(elephant)}
                  className="flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer"
                >
                  {/* Circular Image with Status Indicator */}
                  <div className="relative flex-shrink-0">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full p-0.5 bg-gradient-to-tr from-emerald-700 to-emerald-950">
                      <div className="w-full h-full rounded-full overflow-hidden bg-zinc-100">
                        <img
                          src={photo}
                          alt={elephant.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                    </div>
                    {isTusker ? (
                      <div className="absolute -bottom-1 -right-0.5 bg-amber-400 text-amber-950 p-1 rounded-full shadow border border-white">
                        <Crown className="w-3 h-3" />
                      </div>
                    ) : (
                      <div className="absolute -bottom-1 -right-0.5 bg-emerald-600 text-white p-1 rounded-full shadow border border-white">
                        <Sparkles className="w-3 h-3" />
                      </div>
                    )}
                  </div>

                  {/* Information */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-sm sm:text-base text-[#062E22] truncate group-hover:text-emerald-700 transition-colors">
                        {elephant.name}
                      </h3>
                      {elephant.sinhalaName && (
                        <span className="text-xs font-semibold text-emerald-800 font-sinhala truncate">
                          ({elephant.sinhalaName})
                        </span>
                      )}
                      {elephant.verified && (
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600/20 shrink-0" />
                      )}
                    </div>

                    <p className="text-xs text-zinc-500 truncate mt-0.5 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-emerald-700 flex-shrink-0" />
                      <span className="truncate">{elephant.organization || elephant.location || 'Sri Lanka'}</span>
                    </p>

                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isTusker
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        {isTusker ? 'Tusker' : 'Elephant'}
                      </span>
                      {elephant.age && (
                        <span className="text-[10px] font-medium text-zinc-400">
                          {elephant.age} {t.years}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side: Prominent VIEW BUTTON */}
                <button
                  onClick={() => onSelectElephant(elephant)}
                  className="flex-shrink-0 px-3.5 py-2 bg-[#062E22] hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-transform active:scale-95 flex items-center gap-1 cursor-pointer"
                >
                  <span>{language === 'si' ? 'බලන්න' : 'View'}</span>
                  <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
