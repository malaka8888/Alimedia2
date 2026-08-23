import React from 'react';
import { Shield, Globe, User, Moon, Sun } from 'lucide-react';
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
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  language,
  onToggleLanguage,
  onOpenAdmin,
  darkMode,
  onToggleDarkMode,
}) => {
  const t = translations[language];
  const { user, profile } = useAuth();
  const userPhoto = profile?.photoURL || user?.photoURL;

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-black/95 backdrop-blur-md border-b border-zinc-200 dark:border-white/10 transition-colors">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand Logo */}
        <div
          onClick={() => onSelectTab('home')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg overflow-hidden shadow-xs flex items-center justify-center bg-white dark:bg-black border border-zinc-200 dark:border-white/15 group-hover:scale-105 transition-transform">
            <img
              src={LOGO_URL}
              alt="අලිMedia Logo"
              className="w-full h-full object-contain p-0.5"
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="font-bold text-lg tracking-tight text-[#062E22] dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                අලි<span className="text-black dark:text-white font-extrabold">Media</span>
              </span>
              <span className="w-1.5 h-1.5 bg-[#062E22] dark:bg-white rounded-full" />
            </div>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <nav className="hidden sm:flex items-center gap-1 bg-zinc-100 dark:bg-black p-1 rounded-full border border-zinc-200 dark:border-white/10 shadow-2xs">
          <button
            onClick={() => onSelectTab('home')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              currentTab === 'home'
                ? 'bg-[#062E22] text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-300 hover:text-black dark:hover:text-white'
            }`}
          >
            {language === 'si' ? 'Feed' : 'Feed'}
          </button>
          <button
            onClick={() => onSelectTab('elephant')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              currentTab === 'elephant'
                ? 'bg-[#062E22] text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-300 hover:text-black dark:hover:text-white'
            }`}
          >
            <ElephantIcon className="w-3.5 h-3.5" />
            <span>{language === 'si' ? 'අලි නාමාවලිය' : 'Elephants'}</span>
          </button>
          <button
            onClick={() => onSelectTab('profile')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              currentTab === 'profile'
                ? 'bg-[#062E22] text-white dark:bg-emerald-600 dark:text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
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

        {/* Language, Dark Mode, User & Admin Tools */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Dark Mode Toggle */}
          <button
            onClick={onToggleDarkMode}
            className="p-2 rounded-full bg-white dark:bg-[#121F1B] hover:bg-zinc-100 dark:hover:bg-[#1A2C27] border border-zinc-200 dark:border-emerald-900/40 text-[#062E22] dark:text-amber-400 transition-colors cursor-pointer shadow-2xs"
            title={darkMode ? (language === 'si' ? 'Light Mode වෙත මාරුවන්න' : 'Switch to Light Mode') : (language === 'si' ? 'Dark Mode වෙත මාරුවන්න' : 'Switch to Dark Mode')}
            aria-label="Toggle Dark / Light Theme"
          >
            {darkMode ? (
              <Sun className="w-4 h-4 text-amber-400 animate-fadeIn" />
            ) : (
              <Moon className="w-4 h-4 text-emerald-800 animate-fadeIn" />
            )}
          </button>

          {/* Language Toggle */}
          <button
            onClick={onToggleLanguage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-[#121F1B] hover:bg-zinc-100 dark:hover:bg-[#1A2C27] border border-zinc-200 dark:border-emerald-900/40 text-xs font-bold text-[#062E22] dark:text-zinc-100 transition-colors cursor-pointer shadow-2xs"
            title="Toggle Sinhala / English"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
            <span>{language === 'si' ? 'සිංහල' : 'English'}</span>
          </button>

          {/* Admin console button */}
          <button
            onClick={onOpenAdmin}
            className="p-2 rounded-full bg-white dark:bg-[#121F1B] hover:bg-zinc-100 dark:hover:bg-[#1A2C27] border border-zinc-200 dark:border-emerald-900/40 text-zinc-600 dark:text-zinc-300 hover:text-[#062E22] dark:hover:text-amber-400 transition-colors cursor-pointer shadow-2xs"
            title="Registry & Admin Console"
          >
            <Shield className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
