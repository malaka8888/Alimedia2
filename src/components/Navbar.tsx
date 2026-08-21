import React from 'react';
import { Shield, Globe, User } from 'lucide-react';
import { ElephantIcon } from './ElephantIcon';
import { Language, translations } from '../utils/translations';
import { useAuth } from '../firebase/authContext';

export const LOGO_URL = 'https://i.ibb.co/hRkdzTMy/file-0000000042e0820781e860d5f21352ee.png';

interface NavbarProps {
  currentTab: 'home' | 'elephant' | 'notifications' | 'profile' | 'admin';
  onSelectTab: (tab: 'home' | 'elephant' | 'notifications' | 'profile' | 'admin') => void;
  language: Language;
  onToggleLanguage: () => void;
  onOpenAdmin: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  language,
  onToggleLanguage,
  onOpenAdmin,
}) => {
  const t = translations[language];
  const { user, profile } = useAuth();
  const userPhoto = profile?.photoURL || user?.photoURL;

  return (
    <header className="sticky top-0 z-40 bg-[#FAF9F5]/95 backdrop-blur-md border-b border-zinc-200/80">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand Logo */}
        <div
          onClick={() => onSelectTab('home')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl overflow-hidden shadow-xs flex items-center justify-center bg-white border border-zinc-200/80 group-hover:scale-105 transition-transform">
            <img
              src={LOGO_URL}
              alt="අලිMedia Logo"
              className="w-full h-full object-contain p-0.5"
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="font-extrabold text-lg tracking-tight text-[#062E22] group-hover:text-emerald-800 transition-colors">
                අලි<span className="text-emerald-600 font-black">Media</span>
              </span>
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            </div>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <nav className="hidden sm:flex items-center gap-1 bg-white p-1 rounded-full border border-zinc-200 shadow-2xs">
          <button
            onClick={() => onSelectTab('home')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              currentTab === 'home'
                ? 'bg-[#062E22] text-white shadow-sm'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            {language === 'si' ? 'මුල් පිටුව (Feed)' : 'Feed'}
          </button>
          <button
            onClick={() => onSelectTab('elephant')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              currentTab === 'elephant'
                ? 'bg-[#062E22] text-white shadow-sm'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <ElephantIcon className="w-3.5 h-3.5" />
            <span>{language === 'si' ? 'අලි නාමාවලිය' : 'Elephants'}</span>
          </button>
          <button
            onClick={() => onSelectTab('profile')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              currentTab === 'profile'
                ? 'bg-[#062E22] text-white shadow-sm'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            {userPhoto ? (
              <img src={userPhoto} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />
            ) : (
              <User className="w-3.5 h-3.5" />
            )}
            <span>{profile ? (profile.displayName.split(' ')[0]) : (language === 'si' ? 'මගේ Profile' : 'Profile')}</span>
          </button>
        </nav>

        {/* Language, User & Admin Tools */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleLanguage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-zinc-100 border border-zinc-200 text-xs font-bold text-[#062E22] transition-colors cursor-pointer shadow-2xs"
            title="Toggle Sinhala / English"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-700" />
            <span>{language === 'si' ? 'සිංහල' : 'English'}</span>
          </button>

          {/* Admin console button */}
          <button
            onClick={onOpenAdmin}
            className="p-2 rounded-full bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-600 hover:text-[#062E22] transition-colors cursor-pointer shadow-2xs"
            title="Registry & Admin Console"
          >
            <Shield className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
