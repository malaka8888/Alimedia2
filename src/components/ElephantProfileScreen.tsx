import React, { useState } from 'react';
import { Elephant, ElephantPost } from '../types/elephant';
import {
  ArrowLeft,
  ShieldCheck,
  Crown,
  Sparkles,
  Building2,
  ExternalLink,
  Award,
  Grid,
  Share2,
  Bookmark,
  CheckCircle2,
  Info,
  UserPlus,
  Check,
  Plus,
  MessageSquare
} from 'lucide-react';
import { Language, translations } from '../utils/translations';
import { useAuth } from '../firebase/authContext';

interface ElephantProfileScreenProps {
  elephant: Elephant;
  communityPosts?: ElephantPost[];
  language: Language;
  onBack: () => void;
  onSelectPhoto: (photoUrl: string) => void;
  onOpenCreatePost?: (elephantId: string) => void;
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
  const isTusker = elephant.type === 'tusker';
  const notAvailable = t.notAvailable; // "තොරතුරු නොමැත"

  const photos = elephant.photos && elephant.photos.length > 0
    ? elephant.photos
    : ['https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=800&q=80'];

  // Filter community posts that are tagged for this elephant
  const elephantPosts = communityPosts.filter(
    (p) => p.elephantId === elephant.id || p.elephantName?.toLowerCase() === elephant.name?.toLowerCase()
  );

  const [activeTab, setActiveTab] = useState<'gallery' | 'details' | 'sources'>('gallery');
  const [isSaved, setIsSaved] = useState(false);

  const following = elephant.id ? isFollowing(elephant.id) : false;
  const baseFollowers = elephant.followerCount !== undefined ? elephant.followerCount : 1240;
  const totalFollowers = baseFollowers + (following ? 1 : 0);

  return (
    <div className="max-w-lg mx-auto w-full pb-24 animate-fadeIn bg-white min-h-screen border-x border-zinc-200/60">
      {/* Top Header Bar with Back Arrow and Elephant Name */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1 text-zinc-700 hover:text-[#062E22] rounded-full hover:bg-zinc-100 transition-colors cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="w-6 h-6 stroke-[2.5]" />
          </button>
          <div className="flex items-center gap-1.5">
            <h1 className="font-bold text-base text-[#062E22] truncate max-w-[200px]">
              {elephant.name}
            </h1>
            {elephant.verified && (
              <ShieldCheck className="w-4 h-4 text-emerald-600 fill-emerald-600/20" />
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href);
                alert('Profile link copied!');
              }
            }}
            className="p-1.5 text-zinc-600 hover:text-[#062E22] rounded-full hover:bg-zinc-100 cursor-pointer"
          >
            <Share2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsSaved(!isSaved)}
            className="p-1.5 text-zinc-600 hover:text-[#062E22] rounded-full hover:bg-zinc-100 cursor-pointer"
          >
            <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-[#062E22] text-[#062E22]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Profile Header */}
      <div className="p-5 flex flex-col items-center text-center space-y-3">
        {/* Large Circular Profile Photo */}
        <div className="relative">
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full p-1 bg-gradient-to-tr from-amber-400 via-emerald-600 to-[#062E22] shadow-xl">
            <div className="w-full h-full rounded-full overflow-hidden bg-white">
              <img
                src={photos[0]}
                alt={elephant.name}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          {isTusker ? (
            <div className="absolute bottom-1 right-1 bg-amber-400 text-amber-950 p-1.5 rounded-full shadow-md border-2 border-white" title="Tusker">
              <Crown className="w-4 h-4" />
            </div>
          ) : (
            <div className="absolute bottom-1 right-1 bg-emerald-600 text-white p-1.5 rounded-full shadow-md border-2 border-white">
              <Sparkles className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Name & Subtitle */}
        <div className="space-y-0.5">
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#062E22]">
              {elephant.name}
            </h2>
            {elephant.sinhalaName && (
              <span className="text-base font-bold text-emerald-800 font-sinhala">
                ({elephant.sinhalaName})
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 font-medium flex items-center justify-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-emerald-700" />
            <span>{elephant.organization || elephant.location || 'Sri Lanka'}</span>
          </p>
        </div>

        {/* Bio / Description */}
        <p className="text-xs text-zinc-600 max-w-sm leading-relaxed px-2">
          {elephant.description || notAvailable}
        </p>

        {/* Follow Button & Action Buttons */}
        <div className="pt-1 flex items-center justify-center gap-2 flex-wrap">
          {/* Follow / Following Button */}
          <button
            onClick={() => elephant.id && toggleFollowElephant(elephant.id)}
            className={`px-5 py-1.5 rounded-full text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm ${
              following
                ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border border-zinc-200'
                : 'bg-[#062E22] text-white hover:bg-emerald-900 shadow-md active:scale-95'
            }`}
          >
            {following ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Following</span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Follow {elephant.name}</span>
              </>
            )}
          </button>

          {/* Add Photo to Profile Button */}
          {onOpenCreatePost && elephant.id && (
            <button
              onClick={() => onOpenCreatePost(elephant.id!)}
              className="px-4 py-1.5 rounded-full text-xs font-extrabold bg-emerald-100 hover:bg-emerald-200 text-[#062E22] border border-emerald-300 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-800 stroke-[2.5]" />
              <span>{language === 'si' ? 'ඡායාරූපයක් එක් කරන්න' : 'Add Photo'}</span>
            </button>
          )}

          <span className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-100/80 text-[#062E22] border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
            <span>{language === 'si' ? 'සත්‍යාපිත හීලෑ ඇතෙක්' : 'Verified'}</span>
          </span>

          {elephant.status === 'memorial' && (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
              <Award className="w-3.5 h-3.5 text-amber-700" />
              <span>National Treasure</span>
            </span>
          )}
        </div>

        {/* Stats Row (Posts/Age | Followers | Peraheras) */}
        <div className="w-full grid grid-cols-3 gap-2 pt-4 border-t border-zinc-100 mt-2">
          <div className="text-center">
            <div className="font-extrabold text-base sm:text-lg text-[#062E22]">
              {totalFollowers.toLocaleString()}
            </div>
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              {language === 'si' ? 'Followers' : 'Followers'}
            </div>
          </div>

          <div className="text-center border-x border-zinc-100">
            <div className="font-extrabold text-base sm:text-lg text-[#062E22] capitalize">
              {isTusker ? (language === 'si' ? 'ඇතා' : 'Tusker') : (language === 'si' ? 'අලියා' : 'Elephant')}
            </div>
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              {t.type}
            </div>
          </div>

          <div className="text-center">
            <div className="font-extrabold text-base sm:text-lg text-[#062E22]">
              {elephant.peraheraParticipation?.length || 0}
            </div>
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              {language === 'si' ? 'පෙරහැර' : 'Peraheras'}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs navigation: Gallery (Grid) | Specifications | Verified Sources */}
      <div className="flex border-t border-b border-zinc-200 bg-[#FAF9F5]">
        <button
          onClick={() => setActiveTab('gallery')}
          className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === 'gallery'
              ? 'text-[#062E22] border-b-2 border-[#062E22] bg-white'
              : 'text-zinc-400 hover:text-zinc-700'
          }`}
        >
          <Grid className="w-4 h-4" />
          <span>{language === 'si' ? 'ඡායාරූප (Gallery)' : 'Gallery Grid'}</span>
        </button>

        <button
          onClick={() => setActiveTab('details')}
          className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === 'details'
              ? 'text-[#062E22] border-b-2 border-[#062E22] bg-white'
              : 'text-zinc-400 hover:text-zinc-700'
          }`}
        >
          <Info className="w-4 h-4" />
          <span>{language === 'si' ? 'විස්තර (Specs)' : 'Details & Specs'}</span>
        </button>

        <button
          onClick={() => setActiveTab('sources')}
          className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === 'sources'
              ? 'text-[#062E22] border-b-2 border-[#062E22] bg-white'
              : 'text-zinc-400 hover:text-zinc-700'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>{language === 'si' ? 'මූලාශ්‍ර (Sources)' : 'Sources'}</span>
        </button>
      </div>

      {/* TAB 1: 3-Column Photo Grid & Community Posts */}
      {activeTab === 'gallery' && (
        <div className="p-3 space-y-4">
          {/* Official / Verified Gallery Grid */}
          <div>
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-extrabold text-[#062E22]">
                {language === 'si' ? 'සත්‍යාපිත ඡායාරූප එකතුව' : 'Photo Gallery'} ({photos.length})
              </span>
              {onOpenCreatePost && elephant.id && (
                <button
                  onClick={() => onOpenCreatePost(elephant.id!)}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{language === 'si' ? 'ඡායාරූපයක් එක්කරන්න' : 'Add Photo'}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {photos.map((photo, i) => (
                <div
                  key={i}
                  onClick={() => onSelectPhoto(photo)}
                  className="relative aspect-square rounded-lg sm:rounded-xl overflow-hidden bg-zinc-100 cursor-pointer group shadow-xs"
                >
                  <img
                    src={photo}
                    alt={`${elephant.name} ${i + 1}`}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                </div>
              ))}
            </div>
          </div>

          {/* Community Tagged Posts (with author attribution) */}
          {elephantPosts && elephantPosts.length > 0 && (
            <div className="pt-3 border-t border-zinc-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#062E22] flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{language === 'si' ? 'පරිශීලකයින් පළකළ ඡායාරූප' : 'Community Shared Posts'} ({elephantPosts.length})</span>
                </span>
              </div>

              <div className="space-y-3">
                {elephantPosts.map((post) => (
                  <div
                    key={post.id}
                    className="bg-[#FAF9F5] p-3 rounded-2xl border border-zinc-200/80 space-y-2"
                  >
                    <div
                      onClick={() => onSelectPhoto(post.photoUrl)}
                      className="aspect-[4/3] rounded-xl overflow-hidden bg-zinc-200 cursor-pointer shadow-inner"
                    >
                      <img src={post.photoUrl} alt="" className="w-full h-full object-cover" />
                    </div>

                    {post.caption && (
                      <p className="text-xs text-zinc-700 font-medium">
                        {post.caption}
                      </p>
                    )}

                    {/* Author Attribution */}
                    <div className="pt-1.5 border-t border-zinc-200/60 flex items-center justify-between text-[11px] text-zinc-500">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-4 h-4 rounded-full overflow-hidden bg-zinc-300">
                          <img
                            src={post.authorPhotoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="truncate">
                          {language === 'si' ? 'ඡායාරූපය:' : 'By'}{' '}
                          <b className="text-[#062E22] font-semibold">{post.authorUsername || post.authorName}</b>
                        </span>
                      </div>

                      <span className="text-[10px] text-zinc-400">
                        {post.createdAt?.toDate ? post.createdAt.toDate().toLocaleDateString() : 'Recent'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Detailed Specs */}
      {activeTab === 'details' && (
        <div className="p-4 space-y-4">
          {/* Tusks & Physical Characteristics */}
          <div className="bg-[#FAF9F5] p-4 rounded-2xl border border-zinc-200/80 space-y-2">
            <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-emerald-700" />
              <span>{t.tusks}</span>
            </h3>
            <p className="text-xs text-zinc-700 leading-relaxed font-medium">
              {elephant.tusks || notAvailable}
            </p>
          </div>

          <div className="bg-[#FAF9F5] p-4 rounded-2xl border border-zinc-200/80 space-y-2">
            <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
              <Info className="w-4 h-4 text-emerald-700" />
              <span>{t.physicalCharacteristics}</span>
            </h3>
            <p className="text-xs text-zinc-700 leading-relaxed">
              {elephant.physicalCharacteristics || notAvailable}
            </p>
          </div>

          {/* Mahout & Custody Details */}
          <div className="bg-[#FAF9F5] p-4 rounded-2xl border border-zinc-200/80 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500 font-semibold">{t.mahout}</span>
              <span className={`font-bold ${elephant.mahout ? 'text-[#062E22]' : 'text-zinc-400 italic'}`}>
                {elephant.mahout || notAvailable}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs border-t border-zinc-200/50 pt-2">
              <span className="text-zinc-500 font-semibold">{t.dateOfBirth}</span>
              <span className={`font-bold ${elephant.dateOfBirth ? 'text-[#062E22]' : 'text-zinc-400 italic'}`}>
                {elephant.dateOfBirth || notAvailable}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs border-t border-zinc-200/50 pt-2">
              <span className="text-zinc-500 font-semibold">{t.organization}</span>
              <span className="font-bold text-[#062E22] text-right max-w-[200px] truncate">
                {elephant.organization || notAvailable}
              </span>
            </div>
          </div>

          {/* Perahera Participation */}
          {elephant.peraheraParticipation && elephant.peraheraParticipation.length > 0 && (
            <div className="bg-[#FAF9F5] p-4 rounded-2xl border border-zinc-200/80 space-y-2">
              <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                {t.peraheraParticipation}
              </h3>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {elephant.peraheraParticipation.map((perahera, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-white border border-zinc-200 rounded-lg text-xs font-semibold text-[#062E22] shadow-2xs"
                  >
                    {perahera}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Verified Sources */}
      {activeTab === 'sources' && (
        <div className="p-4 space-y-3">
          <p className="text-xs text-zinc-500">
            {language === 'si'
              ? 'මෙම තොරතුරු පහත සඳහන් නිල හා සත්‍යාපිත මූලාශ්‍ර මගින් තහවුරු කර ඇත.'
              : 'The factual integrity of this profile is substantiated by the following verified records.'}
          </p>

          {elephant.sources && elephant.sources.length > 0 ? (
            elephant.sources.map((src, index) => (
              <div
                key={index}
                className="bg-[#FAF9F5] p-3.5 rounded-xl border border-zinc-200/80 flex items-start justify-between gap-2"
              >
                <div className="space-y-1">
                  <div className="font-bold text-xs text-[#062E22]">
                    {src.title}
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {src.publisher} {src.verifiedDate && `• ${src.verifiedDate}`}
                  </div>
                </div>

                {src.url && (
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-emerald-700 hover:text-[#062E22] bg-white rounded-lg border border-zinc-200 shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))
          ) : (
            <div className="bg-[#FAF9F5] p-4 rounded-xl text-center text-xs text-zinc-400 italic">
              {notAvailable}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
