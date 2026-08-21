import React, { useState, useMemo } from 'react';
import { Elephant, ElephantPost } from '../types/elephant';
import {
  ArrowLeft,
  ShieldCheck,
  MapPin,
  Building2,
  Calendar,
  User,
  Crown,
  Sparkles,
  Share2,
  Bookmark,
  ExternalLink,
  Plus,
  Heart,
  Grid,
  Info,
  Maximize2,
  Flame,
  Award,
  Scroll,
  UserCheck,
  UserPlus
} from 'lucide-react';
import { Language, translations, formatBilingualElephantName, getElephantPrimarySecondaryNames } from '../utils/translations';
import { useAuth } from '../firebase/authContext';

interface ElephantProfileScreenProps {
  elephant: Elephant;
  communityPosts?: ElephantPost[];
  language: Language;
  onBack: () => void;
  onSelectPhoto: (photoUrl: string) => void;
  onOpenCreatePost: (elephantId?: string) => void;
}

export const ElephantProfileScreen: React.FC<ElephantProfileScreenProps> = ({
  elephant,
  communityPosts = [],
  language,
  onBack,
  onSelectPhoto,
  onOpenCreatePost,
}) => {
  const t = translations[language];
  const { isFollowing, toggleFollowElephant } = useAuth();
  const [activeTab, setActiveTab] = useState<'details' | 'physical' | 'cultural' | 'gallery'>('details');

  const following = elephant.id ? isFollowing(elephant.id) : false;
  const isTusker = elephant.type === 'tusker';
  const isMemorial = elephant.status === 'memorial';

  // Specific community photos uploaded for this elephant
  const elephantCommunityPosts = useMemo(() => {
    return communityPosts.filter((p) => p.elephantId === elephant.id || p.elephantName === elephant.name);
  }, [communityPosts, elephant]);

  const allPhotos = useMemo(() => {
    const registryPhotos = elephant.photos || [];
    const communityPhotos = elephantCommunityPosts.map((p) => p.photoUrl);
    return Array.from(new Set([...registryPhotos, ...communityPhotos]));
  }, [elephant, elephantCommunityPosts]);

  const heroPhoto = allPhotos[0] || 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=1200&q=80';

  // Base followers
  const followerCount = useMemo(() => {
    const base = elephant.followerCount || (
      elephant.name.toLowerCase().includes('ind') ? 14250 :
      elephant.name.toLowerCase().includes('myan') ? 11800 :
      elephant.name.toLowerCase().includes('kand') ? 9400 :
      elephant.name.toLowerCase().includes('nad') ? 16500 :
      5800
    );
    return base + (following ? 1 : 0);
  }, [elephant, following]);

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/#${elephant.id || elephant.name}`;
    const bilingualName = formatBilingualElephantName(elephant, language);
    const shareData = {
      title: `${bilingualName} - Sri Lankan Domesticated Elephant Profile`,
      text: `${bilingualName} | ${elephant.organization || elephant.location || 'Sri Lanka'}`,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err: any) {
        if (err.name !== 'AbortError') console.warn(err);
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      alert(language === 'si' ? 'සබැඳිය පිටපත් කරගන්නා ලදී!' : 'Link copied to clipboard!');
    } catch (err) {
      console.warn(err);
    }
  };

  const { primary, secondary } = getElephantPrimarySecondaryNames(elephant, language);

  return (
    <div className="max-w-lg mx-auto w-full pb-28 animate-fadeIn">
      {/* Top Floating Control Bar */}
      <div className="sticky top-14 z-30 bg-[#F7F8F4]/90 backdrop-blur-md py-2 px-1 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-[#062E22] text-xs font-extrabold border border-zinc-200 shadow-2xs hover:bg-zinc-50 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.backToDirectory}</span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleShare}
            className="p-2 rounded-full bg-white text-zinc-700 hover:text-[#062E22] border border-zinc-200 shadow-2xs cursor-pointer"
            title={t.share}
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => elephant.id && toggleFollowElephant(elephant.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer ${
              following
                ? 'bg-amber-400 text-zinc-950 hover:bg-amber-500'
                : 'bg-[#062E22] text-white hover:bg-emerald-800'
            }`}
          >
            {following ? (
              <>
                <UserCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{t.following}</span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>+ {t.follow}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Profile Header Card */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-zinc-200 shadow-2xs space-y-4 relative mt-2">
        {/* Cover Photo */}
        <div
          onClick={() => onSelectPhoto(heroPhoto)}
          className="relative aspect-[16/10] sm:aspect-[16/9] rounded-2xl overflow-hidden bg-zinc-900 cursor-pointer group shadow-inner"
        >
          <img
            src={heroPhoto}
            alt={elephant.name}
            className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

          {/* Badges on Hero */}
          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-md backdrop-blur-md ${
                  isTusker
                    ? 'bg-amber-400 text-amber-950'
                    : 'bg-emerald-700 text-white'
                }`}
              >
                {isTusker ? t.tusker : t.elephant}
              </span>

              {isMemorial && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-900/90 text-amber-300 border border-amber-400/40">
                  {t.memorial}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {elephant.verified && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600/90 text-white shadow-md backdrop-blur-md">
                  <ShieldCheck className="w-3 h-3" />
                  <span>{t.verified}</span>
                </span>
              )}
              <span className="p-1 rounded-full bg-black/50 text-white/90 backdrop-blur-md">
                <Maximize2 className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

          {/* Title on Hero Bottom */}
          <div className="absolute bottom-3 left-3 right-3 text-white">
            <h1 className="text-2xl sm:text-3xl font-black drop-shadow-md tracking-tight leading-tight">
              {primary}
            </h1>
            {secondary && (
              <p className="text-base sm:text-lg font-bold text-amber-300 drop-shadow mt-0.5 font-sinhala">
                ({secondary})
              </p>
            )}
          </div>
        </div>

        {/* Stats Row: Followers, Posts, Photos */}
        <div className="grid grid-cols-3 gap-2 py-2 border-y border-zinc-100 text-center">
          <div>
            <div className="text-sm sm:text-base font-black text-[#062E22]">
              {followerCount >= 1000 ? `${(followerCount / 1000).toFixed(1)}K` : followerCount}
            </div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              {t.followers}
            </div>
          </div>

          <div className="border-x border-zinc-100">
            <div className="text-sm sm:text-base font-black text-[#062E22]">
              {allPhotos.length}
            </div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              {t.photos}
            </div>
          </div>

          <div>
            <div className="text-sm sm:text-base font-black text-emerald-700">
              {elephant.category === 'temple' ? (language === 'si' ? 'විහාරස්ථ' : 'Temple') : (language === 'si' ? 'හීලෑ' : 'Domestic')}
            </div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              {t.status}
            </div>
          </div>
        </div>

        {/* Location & Organization Quick Matrix */}
        <div className="space-y-2 text-xs text-zinc-600">
          <div className="flex items-start gap-2">
            <Building2 className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" />
            <span className="font-semibold text-zinc-800">
              {elephant.organization || (language === 'si' ? 'විහාරස්ථානය / සංවිධානය සටහන්ව නැත' : 'Temple / Owner not specified')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{elephant.location || (language === 'si' ? 'ශ්‍රී ලංකාව' : 'Sri Lanka')}</span>
          </div>

          {elephant.mahout && (
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-amber-700 shrink-0" />
              <span>{t.mahout}: <strong className="text-zinc-800">{elephant.mahout}</strong></span>
            </div>
          )}
        </div>

        {/* Add Photo Button Action */}
        <button
          onClick={() => onOpenCreatePost(elephant.id)}
          className="w-full py-2.5 px-4 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-extrabold text-xs flex items-center justify-center gap-2 border border-emerald-200/80 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>{t.addPhotoStory}</span>
        </button>
      </div>

      {/* Tabs Row */}
      <div className="flex border-b border-zinc-200 mt-4 bg-white rounded-2xl p-1 shadow-2xs">
        {[
          { id: 'details', label: t.verifiedData, icon: Info },
          { id: 'physical', label: t.physicalTraits, icon: Sparkles },
          { id: 'cultural', label: t.culturalHeritage, icon: Award },
          { id: 'gallery', label: `${t.photoGallery} (${allPhotos.length})`, icon: Grid },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1 rounded-xl transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#062E22] text-white shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Verified Details */}
      {activeTab === 'details' && (
        <div className="mt-3 bg-white rounded-3xl p-5 border border-zinc-200 shadow-2xs space-y-4">
          <h3 className="text-xs font-black uppercase text-[#062E22] tracking-wider flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-emerald-700" />
            <span>{t.basicInfo}</span>
          </h3>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-[#FAF9F5] border border-zinc-200/70">
              <span className="text-zinc-400 font-bold block text-[10px] uppercase">{t.age}</span>
              <span className="font-extrabold text-[#062E22] text-sm">
                {elephant.age ? `${elephant.age} ${t.years}` : t.noInfo}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-[#FAF9F5] border border-zinc-200/70">
              <span className="text-zinc-400 font-bold block text-[10px] uppercase">{t.gender}</span>
              <span className="font-extrabold text-[#062E22] text-sm">
                {elephant.gender === 'male' ? t.male : t.female}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-[#FAF9F5] border border-zinc-200/70 col-span-2">
              <span className="text-zinc-400 font-bold block text-[10px] uppercase">{t.organization}</span>
              <span className="font-extrabold text-[#062E22] text-sm">
                {elephant.organization || t.noInfo}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-[#FAF9F5] border border-zinc-200/70 col-span-2">
              <span className="text-zinc-400 font-bold block text-[10px] uppercase">{t.mahout}</span>
              <span className="font-extrabold text-[#062E22] text-sm">
                {elephant.mahout || t.noInfo}
              </span>
            </div>
          </div>

          {/* Description */}
          {elephant.description && (
            <div className="space-y-1.5 pt-2 border-t border-zinc-100">
              <h4 className="text-xs font-bold text-[#062E22]">{t.description}</h4>
              <p className="text-xs text-zinc-600 leading-relaxed whitespace-pre-line">
                {elephant.description}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Physical Traits & Tusks */}
      {activeTab === 'physical' && (
        <div className="mt-3 bg-white rounded-3xl p-5 border border-zinc-200 shadow-2xs space-y-4">
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase text-[#062E22] tracking-wider flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              <span>{t.tusks}</span>
            </h3>
            <p className="text-xs text-zinc-700 bg-amber-50/70 p-3 rounded-2xl border border-amber-200/60 leading-relaxed">
              {elephant.tusks || (language === 'si' ? 'දළ පිහිටීම පිළිබඳ සටහනක් නොමැත.' : 'No specific tusk description available.')}
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-zinc-100">
            <h3 className="text-xs font-black uppercase text-[#062E22] tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t.physicalTraits}</span>
            </h3>
            <p className="text-xs text-zinc-700 bg-emerald-50/70 p-3 rounded-2xl border border-emerald-200/60 leading-relaxed">
              {elephant.physicalCharacteristics || (language === 'si' ? 'ශාරීරික ලක්ෂණ සටහන්ව නැත.' : 'No physical characteristics specified.')}
            </p>
          </div>
        </div>
      )}

      {/* Tab 3: Cultural Heritage & Perahera */}
      {activeTab === 'cultural' && (
        <div className="mt-3 bg-white rounded-3xl p-5 border border-zinc-200 shadow-2xs space-y-4">
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase text-[#062E22] tracking-wider flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-500" />
              <span>{t.peraheraParticipation}</span>
            </h3>
            {elephant.peraheraParticipation && elephant.peraheraParticipation.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {elephant.peraheraParticipation.map((perahera, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200"
                  >
                    🎪 {perahera}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400 italic">
                {language === 'si' ? 'පෙරහැර සහභාගීත්ව වාර්තා සටහන්ව නැත.' : 'No recorded perahera festivals yet.'}
              </p>
            )}
          </div>

          {/* Sources & References */}
          <div className="space-y-2 pt-3 border-t border-zinc-100">
            <h3 className="text-xs font-black uppercase text-[#062E22] tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>{t.sources}</span>
            </h3>
            {elephant.sources && elephant.sources.length > 0 ? (
              <div className="space-y-2">
                {elephant.sources.map((src, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-[#FAF9F5] border border-zinc-200/80 flex items-center justify-between text-xs gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-[#062E22] truncate">{src.title}</p>
                      <p className="text-[10px] text-zinc-400">{src.publisher} {src.verifiedDate ? `(${src.verifiedDate})` : ''}</p>
                    </div>
                    {src.url && (
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-[10px] font-bold flex items-center gap-1 shrink-0"
                      >
                        <span>Visit</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400 italic">
                {language === 'si' ? 'සත්‍යාපිත මූලාශ්‍ර වාර්තාවල අඩංගුයි.' : 'Verified through national Sri Lankan cultural records.'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Photo Gallery Grid */}
      {activeTab === 'gallery' && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {allPhotos.map((photo, idx) => (
              <div
                key={idx}
                onClick={() => onSelectPhoto(photo)}
                className="relative aspect-square rounded-2xl overflow-hidden bg-zinc-100 cursor-pointer group shadow-2xs"
              >
                <img
                  src={photo}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Maximize2 className="w-5 h-5 text-white drop-shadow" />
                </div>
              </div>
            ))}
          </div>

          {/* Add more photos button */}
          <button
            onClick={() => onOpenCreatePost(elephant.id)}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-zinc-300 hover:border-emerald-700 bg-white text-xs font-bold text-[#062E22] flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addPhotoStory}</span>
          </button>
        </div>
      )}
    </div>
  );
};
