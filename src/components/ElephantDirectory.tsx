import React, { useState, useMemo } from 'react';
import { Elephant } from '../types/elephant';
import { Search, Filter, ShieldCheck, Crown, Sparkles, MapPin, Building2, ChevronRight, Eye } from 'lucide-react';
import { Language, translations } from '../utils/translations';

interface ElephantDirectoryProps {
  elephants: Elephant[];
  language: Language;
  onSelectElephant: (elephant: Elephant) => void;
}

export const ElephantDirectory: React.FC<ElephantDirectoryProps> = ({
  elephants,
  language,
  onSelectElephant,
}) => {
  const t = translations[language];
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'tusker' | 'elephant' | 'living' | 'memorial'>('all');

  const filteredElephants = useMemo(() => {
    return elephants.filter((el) => {
      // Category filter
      if (activeCategory === 'tusker' && el.type !== 'tusker') return false;
      if (activeCategory === 'elephant' && el.type !== 'elephant') return false;
      if (activeCategory === 'living' && el.status !== 'living') return false;
      if (activeCategory === 'memorial' && el.status !== 'memorial') return false;

      // Search term
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
    <div className="max-w-lg mx-auto w-full space-y-6 pb-24 animate-fadeIn">
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

      {/* HORIZONTAL CIRCLE PROFILES ROW (As requested: "rawmak athule elephant profile image , elephant name , viwe button") */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-zinc-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-emerald-900/80 uppercase tracking-wider">
            {language === 'si' ? 'ඉක්මන් පැතිකඩ (Quick Profiles)' : 'Quick Profiles Carousel'}
          </h2>
          <span className="text-[11px] text-zinc-400 font-medium">
            {language === 'si' ? 'තිරස් අතට අදින්න →' : 'Swipe horizontally →'}
          </span>
        </div>

        {/* Horizontal scroll container with circular profile image, name & view button */}
        <div className="flex gap-4 overflow-x-auto pb-2 pt-1 no-scrollbar -mx-2 px-2">
          {elephants.map((elephant, idx) => {
            const photo = elephant.photos && elephant.photos.length > 0
              ? elephant.photos[0]
              : 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=400&q=80';
            const isTusker = elephant.type === 'tusker';

            return (
              <div
                key={elephant.id || idx}
                className="flex-shrink-0 w-28 flex flex-col items-center bg-[#F9FAF7] hover:bg-emerald-50/50 p-3 rounded-2xl border border-zinc-200/70 transition-all hover:shadow-md text-center group"
              >
                {/* Circular Profile Image (Rawmak athule elephant profile image) */}
                <div className="relative mb-2">
                  <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 via-emerald-600 to-[#062E22] shadow-sm">
                    <div className="w-full h-full rounded-full overflow-hidden bg-white">
                      <img
                        src={photo}
                        alt={elephant.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                  </div>
                  {isTusker && (
                    <div className="absolute -bottom-1 -right-1 bg-amber-400 text-amber-950 p-0.5 rounded-full shadow-sm" title="Tusker">
                      <Crown className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>

                {/* Elephant Name */}
                <h3 className="text-xs font-extrabold text-[#062E22] truncate w-full group-hover:text-emerald-700 transition-colors">
                  {elephant.name}
                </h3>
                {elephant.sinhalaName && (
                  <p className="text-[10px] text-zinc-500 truncate w-full font-sinhala">
                    {elephant.sinhalaName}
                  </p>
                )}

                {/* View Button */}
                <button
                  onClick={() => onSelectElephant(elephant)}
                  className="mt-2.5 w-full py-1 px-2 bg-[#062E22] hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold shadow-sm transition-transform active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3 h-3" />
                  <span>{language === 'si' ? 'බලන්න' : 'View'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-2xl text-xs sm:text-sm text-[#062E22] placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-700 shadow-sm"
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
                ? 'bg-[#062E22] text-white shadow-sm'
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
                className="bg-white rounded-2xl p-3.5 sm:p-4 shadow-sm hover:shadow-md border border-zinc-200/80 transition-all flex items-center justify-between gap-3 group"
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
                  className="flex-shrink-0 px-3.5 py-2 bg-[#062E22] hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm transition-transform active:scale-95 flex items-center gap-1 cursor-pointer"
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
