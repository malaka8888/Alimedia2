import React from 'react';
import { Home, Plus, Bell, User } from 'lucide-react';
import { ElephantIcon } from './ElephantIcon';
import { useAuth } from '../firebase/authContext';

interface BottomNavProps {
  currentTab: 'home' | 'elephant' | 'notifications' | 'profile';
  onSelectTab: (tab: 'home' | 'elephant' | 'notifications' | 'profile') => void;
  onOpenAdd: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenAdd,
}) => {
  const { user, profile } = useAuth();
  const userPhoto = profile?.photoURL || user?.photoURL;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-3 pt-1 px-4 pointer-events-none">
      <div className="relative bg-white/95 dark:bg-[#121F1B]/95 backdrop-blur-xl border border-zinc-200/80 dark:border-emerald-900/50 shadow-2xl shadow-emerald-950/20 rounded-full px-6 py-2.5 flex items-center justify-between gap-6 sm:gap-10 pointer-events-auto max-w-md w-full transition-colors">
        {/* Home / Feed */}
        <button
          onClick={() => onSelectTab('home')}
          aria-label="Home Feed"
          className={`flex flex-col items-center justify-center transition-all cursor-pointer ${
            currentTab === 'home'
              ? 'text-[#062E22] dark:text-amber-400 scale-110'
              : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <Home className={`w-6 h-6 ${currentTab === 'home' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          {currentTab === 'home' && (
            <span className="w-1.5 h-1.5 bg-[#062E22] dark:bg-amber-400 rounded-full mt-0.5" />
          )}
        </button>

        {/* Elephant Profiles & Directory (Custom Elephant Icon) */}
        <button
          onClick={() => onSelectTab('elephant')}
          aria-label="Elephant Profiles"
          className={`flex flex-col items-center justify-center transition-all cursor-pointer ${
            currentTab === 'elephant'
              ? 'text-[#062E22] dark:text-amber-400 scale-110'
              : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <ElephantIcon className={`w-6 h-6 ${currentTab === 'elephant' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          {currentTab === 'elephant' && (
            <span className="w-1.5 h-1.5 bg-[#062E22] dark:bg-amber-400 rounded-full mt-0.5" />
          )}
        </button>

        {/* Center elevated '+' Action Button */}
        <div className="relative -top-5 flex flex-col items-center">
          <button
            onClick={onOpenAdd}
            aria-label="Add or Seed Elephant Record"
            className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#062E22] via-emerald-800 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-emerald-950/40 hover:scale-105 active:scale-95 transition-all cursor-pointer border-4 border-[#F7F8F4] dark:border-[#0A1411]"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        {/* Notifications / Cultural Calendar */}
        <button
          onClick={() => onSelectTab('notifications')}
          aria-label="Cultural Events & Notifications"
          className={`flex flex-col items-center justify-center transition-all cursor-pointer ${
            currentTab === 'notifications'
              ? 'text-[#062E22] dark:text-amber-400 scale-110'
              : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <Bell className={`w-6 h-6 ${currentTab === 'notifications' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          {currentTab === 'notifications' && (
            <span className="w-1.5 h-1.5 bg-[#062E22] dark:bg-amber-400 rounded-full mt-0.5" />
          )}
        </button>

        {/* User Profile Tab (Gmail / Google Sign In Profile) */}
        <button
          onClick={() => onSelectTab('profile')}
          aria-label="User Profile"
          className={`flex flex-col items-center justify-center transition-all cursor-pointer ${
            currentTab === 'profile'
              ? 'text-[#062E22] dark:text-amber-400 scale-110'
              : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          {userPhoto ? (
            <div className={`w-6 h-6 rounded-full overflow-hidden border-2 ${currentTab === 'profile' ? 'border-[#062E22] dark:border-amber-400' : 'border-transparent'}`}>
              <img src={userPhoto} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <User className={`w-6 h-6 ${currentTab === 'profile' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          )}
          {currentTab === 'profile' && (
            <span className="w-1.5 h-1.5 bg-[#062E22] dark:bg-amber-400 rounded-full mt-0.5" />
          )}
        </button>
      </div>
    </div>
  );
};
