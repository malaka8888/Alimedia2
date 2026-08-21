import React, { useState } from 'react';
import { useAuth } from '../firebase/authContext';
import { Elephant } from '../types/elephant';
import { Language, translations, formatBilingualElephantName } from '../utils/translations';
import {
  LogOut,
  ShieldCheck,
  Mail,
  Crown,
  Edit3,
  CheckCircle2,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { ElephantIcon } from './ElephantIcon';

interface UserProfileScreenProps {
  elephants: Elephant[];
  language: Language;
  onSelectElephant: (elephant: Elephant) => void;
  onOpenDirectory: () => void;
}

export const UserProfileScreen: React.FC<UserProfileScreenProps> = ({
  elephants,
  language,
  onSelectElephant,
  onOpenDirectory,
}) => {
  const { user, profile, signInWithGoogle, signOut, toggleFollowElephant, isFollowing, followedElephantIds, updateBio } = useAuth();
  const t = translations[language];

  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState(profile?.bio || (language === 'si' ? 'ශ්‍රී ලාංකීය හීලෑ අලි ඇතුන්ට ආදරය කරන කෙනෙක් 🐘✨' : 'Revered Sri Lankan Elephant enthusiast & heritage lover 🐘✨'));
  const [activeTab, setActiveTab] = useState<'following' | 'saved'>('following');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      setIsSigningIn(true);
      setAuthError(null);
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Sign in error:', err);
      setAuthError(err.message || 'Sign in failed. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSaveBio = async () => {
    await updateBio(bioInput);
    setIsEditingBio(false);
  };

  // Elephants the user is currently following
  const followedElephantsList = elephants.filter((e) => e.id && followedElephantIds.includes(e.id));
  const followedTuskersCount = followedElephantsList.filter((e) => e.type === 'tusker').length;

  // Elephants suggested to follow if following is low
  const suggestedElephants = elephants.filter((e) => e.id && !followedElephantIds.includes(e.id)).slice(0, 6);

  // -------------------------------------------------------------
  // NOT SIGNED IN VIEW
  // -------------------------------------------------------------
  if (!user && !profile) {
    return (
      <div className="max-w-lg mx-auto w-full pb-24 animate-fadeIn space-y-5 pt-2">
        {/* Welcome Banner Card */}
        <div className="bg-gradient-to-br from-[#062E22] via-[#0B4A37] to-[#041D15] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden text-center space-y-4">
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-amber-500/20 rounded-full blur-2xl" />

          {/* Elephant Media Avatar Illustration */}
          <div className="relative mx-auto w-20 h-20 rounded-full p-1 bg-gradient-to-tr from-amber-400 to-emerald-400 shadow-2xl flex items-center justify-center">
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center p-2">
              <img
                src="https://i.ibb.co/hRkdzTMy/file-0000000042e0820781e860d5f21352ee.png"
                alt="Aliya Media"
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          <div className="space-y-1.5 relative z-10">
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              {language === 'si' ? 'අලිMedia වෙත සාදරයෙන් පිළිගනිමු' : 'Welcome to Aliya Media'}
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100/90 max-w-sm mx-auto leading-relaxed">
              {language === 'si'
                ? 'ඔබගේ Gmail ගිණුමෙන් පිවිස ඔබ ප්‍රියකරන හීලෑ අලි සහ ඇතුන් Follow කර පුද්ගලික පැතිකඩක් (Profile) සාදාගන්න.'
                : 'Sign in with your Google account to follow revered Sri Lankan elephants and build your personal profile.'}
            </p>
          </div>

          {/* Google Sign-in Button */}
          <div className="pt-2 relative z-10">
            <button
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              className="w-full max-w-xs mx-auto py-3.5 px-6 rounded-2xl bg-white text-zinc-900 font-bold text-sm shadow-xl hover:bg-zinc-50 active:scale-98 transition-all flex items-center justify-center gap-3 cursor-pointer border border-zinc-200"
            >
              {isSigningIn ? (
                <div className="w-5 h-5 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>{language === 'si' ? 'Google (Gmail) හරහා පිවිසෙන්න' : 'Continue with Google'}</span>
                </>
              )}
            </button>
          </div>

          {authError && (
            <div className="bg-red-500/20 text-red-200 text-xs p-2.5 rounded-xl flex items-center justify-center gap-1.5 border border-red-500/30">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs space-y-1.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <ElephantIcon className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-[#062E22]">
              {language === 'si' ? 'ඇතුන් Follow කරන්න' : 'Follow Elephants'}
            </h4>
            <p className="text-[11px] text-zinc-500 leading-snug">
              {language === 'si' ? 'කැමති හීලෑ අලි සහ ඇතුන්ගේ නවතම තොරතුරු ඔබේ Profile එකෙන් බලන්න.' : 'Keep track of your favorite ceremonial tuskers.'}
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs space-y-1.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <Crown className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-[#062E22]">
              {language === 'si' ? 'Gmail Profile Avatar' : 'Gmail Profile Sync'}
            </h4>
            <p className="text-[11px] text-zinc-500 leading-snug">
              {language === 'si' ? 'ඔබගේ Gmail Profile ඡායාරූපය සහ නම ක්ෂණිකව එකතු වේ.' : 'Your Google avatar, name, and handle sync automatically.'}
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs space-y-1.5">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-[#062E22]">
              {language === 'si' ? 'සත්‍යාපිත වාර්තා' : 'Verified Community'}
            </h4>
            <p className="text-[11px] text-zinc-500 leading-snug">
              {language === 'si' ? 'ලංකාවේ අලි ඇතුන්ගේ නිල තොරතුරු ලබාගන්න.' : 'Access verified Sri Lankan cultural registries.'}
            </p>
          </div>
        </div>

        {/* Popular Elephants to Explore */}
        <div className="bg-white rounded-3xl p-5 border border-zinc-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#062E22]">
              {language === 'si' ? 'ප්‍රකට හීලෑ ඇත්තු' : 'Famous Tuskers'}
            </h3>
            <button
              onClick={onOpenDirectory}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
            >
              <span>{language === 'si' ? 'සියල්ල' : 'View All'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {elephants.slice(0, 3).map((el) => {
              const photo = el.photos && el.photos.length > 0 ? el.photos[0] : '';
              const bilingualName = formatBilingualElephantName(el, language);
              return (
                <div
                  key={el.id || el.name}
                  onClick={() => onSelectElephant(el)}
                  className="p-2.5 rounded-2xl bg-[#FAF9F5] border border-zinc-200/80 hover:border-emerald-700 transition-all cursor-pointer space-y-2 group"
                >
                  <div className="aspect-square rounded-xl overflow-hidden bg-zinc-200">
                    <img src={photo} alt={el.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#062E22] truncate" title={bilingualName}>{bilingualName}</h4>
                    <p className="text-[10px] text-zinc-500 truncate">{el.organization || el.location}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // SIGNED IN USER PROFILE VIEW
  // -------------------------------------------------------------
  const userPhoto = profile?.photoURL || user?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80';
  const displayName = profile?.displayName || user?.displayName || 'User';
  const email = profile?.email || user?.email || '';
  const username = profile?.username || `@${email.split('@')[0] || 'user'}`;

  return (
    <div className="max-w-lg mx-auto w-full pb-24 animate-fadeIn space-y-4 pt-1">
      {/* Profile Card */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-zinc-200 shadow-xs space-y-4 relative overflow-hidden">
        {/* Decorative Top subtle background */}
        <div className="h-20 -mx-6 -mt-6 bg-gradient-to-r from-[#062E22] via-[#0B4A37] to-[#041D15] relative">
          <div className="absolute top-2 right-3 flex items-center gap-1.5">
            <button
              onClick={signOut}
              className="px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-white/20"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{language === 'si' ? 'ඉවත් වන්න' : 'Sign Out'}</span>
            </button>
          </div>
        </div>

        {/* User Avatar + Identity */}
        <div className="relative -mt-12 flex flex-col items-center text-center space-y-2">
          {/* Gmail Avatar with border ring */}
          <div className="relative">
            <div className="w-22 h-22 sm:w-24 sm:h-24 rounded-full p-1 bg-white shadow-xl">
              <div className="w-full h-full rounded-full overflow-hidden bg-emerald-950 border-2 border-emerald-600">
                <img
                  src={userPhoto}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            {/* Google Verified Icon */}
            <div className="absolute bottom-1 right-1 bg-emerald-600 text-white p-1 rounded-full shadow-md border-2 border-white" title="Verified Google Account">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Name & Google Email & Username */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-center gap-1.5">
              <h2 className="text-lg sm:text-xl font-black text-[#062E22]">
                {displayName}
              </h2>
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300">
                Google
              </span>
            </div>

            <p className="text-xs font-bold text-emerald-800 font-mono">
              {username}
            </p>

            <p className="text-[11px] text-zinc-500 flex items-center justify-center gap-1">
              <Mail className="w-3 h-3 text-zinc-400" />
              <span>{email}</span>
            </p>
          </div>

          {/* Bio text */}
          {isEditingBio ? (
            <div className="w-full space-y-2 pt-1">
              <textarea
                value={bioInput}
                onChange={(e) => setBioInput(e.target.value)}
                maxLength={160}
                rows={2}
                className="w-full p-2.5 text-xs rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-zinc-50"
                placeholder="Write something about your love for Sri Lankan elephants..."
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsEditingBio(false)}
                  className="px-3 py-1 rounded-lg text-xs font-bold text-zinc-600 hover:bg-zinc-100 cursor-pointer"
                >
                  {language === 'si' ? 'අවලංගු කරන්න' : 'Cancel'}
                </button>
                <button
                  onClick={handleSaveBio}
                  className="px-4 py-1 rounded-lg text-xs font-bold bg-[#062E22] text-white hover:bg-emerald-900 cursor-pointer shadow-xs"
                >
                  {language === 'si' ? 'සුරකින්න' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5 pt-0.5">
              <p className="text-xs text-zinc-600 max-w-xs leading-relaxed">
                {profile?.bio || bioInput}
              </p>
              <button
                onClick={() => setIsEditingBio(true)}
                className="p-1 text-zinc-400 hover:text-emerald-800 rounded-full hover:bg-zinc-100 cursor-pointer"
                title="Edit Bio"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-zinc-100">
          <div className="text-center">
            <div className="font-extrabold text-base sm:text-lg text-[#062E22]">
              {followedElephantsList.length}
            </div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              {language === 'si' ? 'Follow කරන ඇත්තු' : 'Following'}
            </div>
          </div>

          <div className="text-center border-x border-zinc-100">
            <div className="font-extrabold text-base sm:text-lg text-[#062E22]">
              {followedTuskersCount}
            </div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              {language === 'si' ? 'ඇත්තු' : 'Tuskers'}
            </div>
          </div>

          <div className="text-center">
            <div className="font-extrabold text-base sm:text-lg text-emerald-700">
              Active
            </div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              {language === 'si' ? 'තත්ත්වය' : 'Status'}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Followed Elephants & Suggestions */}
      <div className="flex border-b border-zinc-200 bg-white rounded-2xl p-1 shadow-2xs">
        <button
          onClick={() => setActiveTab('following')}
          className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'following'
              ? 'bg-[#062E22] text-white shadow-xs'
              : 'text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <ElephantIcon className="w-3.5 h-3.5" />
          <span>{language === 'si' ? `Follow කරන ඇත්තු (${followedElephantsList.length})` : `Following (${followedElephantsList.length})`}</span>
        </button>

        <button
          onClick={() => setActiveTab('saved')}
          className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'saved'
              ? 'bg-[#062E22] text-white shadow-xs'
              : 'text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <Crown className="w-3.5 h-3.5" />
          <span>{language === 'si' ? 'යෝජිත ඇත්තු' : 'Discover Tuskers'}</span>
        </button>
      </div>

      {/* TAB 1: Followed Elephants Grid */}
      {activeTab === 'following' && (
        <div className="space-y-3">
          {followedElephantsList.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center space-y-3 border border-zinc-200 shadow-2xs">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <ElephantIcon className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-[#062E22]">
                  {language === 'si' ? 'ඔබ තවම කිසිදු ඇතෙකු Follow කර නැත' : 'No elephants followed yet'}
                </h4>
                <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                  {language === 'si'
                    ? 'කැමති හීලෑ අලි සහ ඇතුන් පහත ලැයිස්තුවෙන් හෝ Directory එකෙන් Follow කරන්න.'
                    : 'Explore the registry and click "Follow" on your favorite Sri Lankan elephants.'}
                </p>
              </div>
              <button
                onClick={() => setActiveTab('saved')}
                className="px-5 py-2 rounded-full bg-[#062E22] text-white text-xs font-bold hover:bg-emerald-900 transition-all cursor-pointer shadow-xs"
              >
                {language === 'si' ? 'ඇතුන් සොයා බලන්න' : 'Explore Elephants'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {followedElephantsList.map((el) => {
                const photo = el.photos && el.photos.length > 0 ? el.photos[0] : '';
                const isTusker = el.type === 'tusker';
                const bilingualName = formatBilingualElephantName(el, language);

                return (
                  <div
                    key={el.id || el.name}
                    className="bg-white rounded-2xl p-3 border border-zinc-200/80 shadow-2xs flex items-center justify-between gap-3 hover:shadow-sm transition-all"
                  >
                    <div
                      onClick={() => onSelectElephant(el)}
                      className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                    >
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-200 shrink-0">
                        <img src={photo} alt={el.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <h4 className="font-bold text-xs text-[#062E22] truncate" title={bilingualName}>{bilingualName}</h4>
                          {isTusker && <Crown className="w-3 h-3 text-amber-500 shrink-0" />}
                        </div>
                        <p className="text-[10px] text-zinc-500 truncate">{el.organization || el.location}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => el.id && toggleFollowElephant(el.id)}
                      className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-zinc-100 hover:bg-red-50 text-zinc-600 hover:text-red-600 border border-zinc-200 transition-colors cursor-pointer shrink-0"
                    >
                      {language === 'si' ? 'Following' : 'Following'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Discover & Suggested Elephants */}
      {activeTab === 'saved' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              {language === 'si' ? 'යෝජිත හීලෑ ඇත්තු' : 'Suggested to Follow'}
            </h3>
            <button
              onClick={onOpenDirectory}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
            >
              {language === 'si' ? 'සියල්ල බලන්න' : 'All Elephants'} →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {suggestedElephants.map((el) => {
              const photo = el.photos && el.photos.length > 0 ? el.photos[0] : '';
              const isTusker = el.type === 'tusker';
              const followingThis = el.id ? isFollowing(el.id) : false;
              const bilingualName = formatBilingualElephantName(el, language);

              return (
                <div
                  key={el.id || el.name}
                  className="bg-white rounded-2xl p-3.5 border border-zinc-200/80 shadow-2xs flex items-center justify-between gap-3 hover:shadow-sm transition-all"
                >
                  <div
                    onClick={() => onSelectElephant(el)}
                    className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-200 shrink-0">
                      <img src={photo} alt={el.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <h4 className="font-bold text-xs text-[#062E22] truncate" title={bilingualName}>{bilingualName}</h4>
                        {isTusker && <Crown className="w-3 h-3 text-amber-500 shrink-0" />}
                      </div>
                      <p className="text-[10px] text-zinc-500 truncate">{el.organization || el.location}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => el.id && toggleFollowElephant(el.id)}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer shrink-0 ${
                      followingThis
                        ? 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                        : 'bg-[#062E22] text-white hover:bg-emerald-800 shadow-2xs'
                    }`}
                  >
                    {followingThis ? 'Following' : (language === 'si' ? '+ Follow' : '+ Follow')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
