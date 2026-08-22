import React, { useState, useEffect, useCallback } from 'react';
import { Elephant, CulturalEvent, ElephantPost } from './types/elephant';
import { INITIAL_VERIFIED_ELEPHANTS } from './data/initialVerifiedData';
import { INITIAL_POSTS } from './data/initialPosts';
import {
  getElephants,
  addElephant,
  updateElephant,
  deleteElephant,
  deleteElephantCascade,
  toggleElephantVerification,
  toggleElephantFeatured,
  toggleElephantLive,
  seedInitialVerifiedData,
  getCulturalEvents,
  addCulturalEvent,
  updateCulturalEvent,
  deleteCulturalEvent,
  INITIAL_EVENTS
} from './firebase/elephantService';
import { getAllElephantPosts } from './firebase/postService';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { DiscoverFeed } from './components/DiscoverFeed';
import { ElephantDirectory } from './components/ElephantDirectory';
import { ElephantProfileScreen } from './components/ElephantProfileScreen';
import { UserProfileScreen } from './components/UserProfileScreen';
import { AdminPanel } from './components/AdminPanel';
import { CreatePostModal } from './components/CreatePostModal';
import { PhotoLightbox } from './components/PhotoLightbox';
import { Language, translations } from './utils/translations';
import { CheckCircle2, Calendar, MapPin, Crown } from 'lucide-react';

export default function App() {
  const [elephants, setElephants] = useState<Elephant[]>(() => {
    try {
      const cached = localStorage.getItem('alimedia_cached_elephants');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_VERIFIED_ELEPHANTS;
  });

  const [events, setEvents] = useState<CulturalEvent[]>(() => {
    try {
      const cached = localStorage.getItem('alimedia_cached_events');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_EVENTS;
  });

  const [posts, setPosts] = useState<ElephantPost[]>(() => {
    try {
      const resetDone = localStorage.getItem('alimedia_likes_zero_reset');
      if (!resetDone) {
        localStorage.removeItem('alimedia_cached_posts');
        localStorage.setItem('alimedia_likes_zero_reset', 'true');
        return INITIAL_POSTS;
      }
      const cached = localStorage.getItem('alimedia_cached_posts');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_POSTS;
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Tabs: 'home' | 'elephant' | 'notifications' | 'profile'
  const [currentTab, setCurrentTab] = useState<'home' | 'elephant' | 'notifications' | 'profile'>('home');
  const [selectedElephant, setSelectedElephant] = useState<Elephant | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState<boolean>(false);
  const [createPostElephantId, setCreatePostElephantId] = useState<string | undefined>(undefined);
  const [isCreatePostStoryOnly, setIsCreatePostStoryOnly] = useState<boolean>(false);

  const [isSeeding, setIsSeeding] = useState<boolean>(false);

  // Auto-select English language by default, with localStorage persistence
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('alimedia_lang');
      if (saved === 'en' || saved === 'si') return saved;
    } catch {}
    return 'en'; // Default auto-selected language is English
  });

  const [notification, setNotification] = useState<string | null>(null);

  // Light / Dark Mode State: Defaults to Light mode (false), persists in localStorage
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('alimedia_theme');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      return false; // Default to Light mode
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('alimedia_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('alimedia_theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  const toggleLanguage = () => {
    setLanguage((prev) => {
      const next: Language = prev === 'si' ? 'en' : 'si';
      try {
        localStorage.setItem('alimedia_lang', next);
      } catch {}
      return next;
    });
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Load elephants, cultural events, and community posts from Cloud Firestore with zero blocking
  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [elephantData, eventData, postData] = await Promise.all([
        getElephants(),
        getCulturalEvents(),
        getAllElephantPosts()
      ]);

      if (elephantData && elephantData.length > 0) {
        setElephants(elephantData);
      }
      if (eventData && eventData.length > 0) {
        setEvents(eventData);
      }
      if (postData) {
        setPosts(postData);
      }
    } catch (err: any) {
      console.warn('Data sync notice:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle URL hash changes or routing
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (hash === 'elephant' || hash === 'elephants') {
        setCurrentTab('elephant');
        setSelectedElephant(null);
        setIsAdminOpen(false);
      } else if (hash === 'home') {
        setCurrentTab('home');
        setSelectedElephant(null);
        setIsAdminOpen(false);
      } else if (hash === 'profile') {
        setCurrentTab('profile');
        setSelectedElephant(null);
        setIsAdminOpen(false);
      } else if (hash === 'admin') {
        setIsAdminOpen(true);
      } else if (hash === 'notifications') {
        setCurrentTab('notifications');
        setSelectedElephant(null);
        setIsAdminOpen(false);
      } else if (hash && elephants.length > 0) {
        const found = elephants.find((e) => e.id === hash || e.name.toLowerCase() === hash.toLowerCase());
        if (found) {
          setSelectedElephant(found);
          setIsAdminOpen(false);
        }
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [elephants]);

  const handleSelectElephant = (elephant: Elephant) => {
    setSelectedElephant(elephant);
    setIsAdminOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (elephant.id) {
      window.location.hash = elephant.id;
    }
  };

  const handleBackToDirectory = () => {
    setSelectedElephant(null);
    if (window.location.hash) {
      history.pushState('', document.title, window.location.pathname + window.location.search);
    }
  };

  const handleTabChange = (tab: 'home' | 'elephant' | 'notifications' | 'profile') => {
    setSelectedElephant(null);
    setIsAdminOpen(false);
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (tab === 'elephant') {
      window.location.hash = 'elephant';
    } else if (tab === 'home') {
      window.location.hash = 'home';
    } else if (tab === 'profile') {
      window.location.hash = 'profile';
    } else if (tab === 'notifications') {
      window.location.hash = 'notifications';
    }
  };

  // Open Create Post Modal
  const handleOpenCreatePost = (elephantId?: string, isStoryOnly: boolean = false) => {
    setCreatePostElephantId(elephantId);
    setIsCreatePostStoryOnly(isStoryOnly);
    setIsCreatePostOpen(true);
  };

  const handlePostSuccess = async (newPost: ElephantPost, updatedElephantId?: string) => {
    setIsCreatePostOpen(false);
    showNotification(language === 'si' ? 'ඡායාරූපය සාර්ථකව පළ කෙරිණි!' : 'Post published successfully!');
    
    // Refresh posts & elephants
    const [freshPosts, freshElephants] = await Promise.all([
      getAllElephantPosts(),
      getElephants()
    ]);
    setPosts(freshPosts);
    setElephants(freshElephants);

    if (updatedElephantId) {
      const refreshedElephant = freshElephants.find((e) => e.id === updatedElephantId);
      if (refreshedElephant && selectedElephant?.id === updatedElephantId) {
        setSelectedElephant(refreshedElephant);
      }
    }
  };

  // -------------------------------------------------------------
  // Elephant CRUD Handlers (Admin)
  // -------------------------------------------------------------

  const handleSaveElephant = async (
    elephantData: Omit<Elephant, 'id' | 'createdAt' | 'updatedAt'>,
    id?: string
  ) => {
    if (id) {
      await updateElephant(id, elephantData);
      showNotification(`${elephantData.name} යාවත්කාලීන කෙරිණි!`);
    } else {
      await addElephant(elephantData);
      showNotification(`${elephantData.name} ලියාපදිංචි කෙරිණි!`);
    }
    const fresh = await getElephants();
    setElephants(fresh);
  };

  const handleDeleteElephant = async (id: string) => {
    const result = await deleteElephantCascade(id);
    showNotification(
      language === 'si'
        ? `${result.deletedElephantName} සහ සම්බන්ධිත සියලු දත්ත (${result.postsDeleted} posts) සම්පූර්ණයෙන්ම ඉවත් කෙරිණි.`
        : `${result.deletedElephantName} and all connected data (${result.postsDeleted} posts) permanently removed.`
    );
    if (selectedElephant?.id === id) {
      setSelectedElephant(null);
    }
    const [freshElephants, freshPosts, freshEvents] = await Promise.all([
      getElephants(),
      getAllElephantPosts(),
      getCulturalEvents()
    ]);
    setElephants(freshElephants);
    setPosts(freshPosts);
    setEvents(freshEvents);
    return result;
  };

  const handleToggleVerification = async (id: string, verified: boolean) => {
    await toggleElephantVerification(id, verified);
    const fresh = await getElephants();
    setElephants(fresh);
    if (selectedElephant && selectedElephant.id === id) {
      setSelectedElephant({ ...selectedElephant, verified });
    }
  };

  const handleToggleFeatured = async (id: string, isFeatured: boolean) => {
    await toggleElephantFeatured(id, isFeatured);
    const fresh = await getElephants();
    setElephants(fresh);
    if (selectedElephant && selectedElephant.id === id) {
      setSelectedElephant({ ...selectedElephant, isFeatured });
    }
  };

  const handleToggleLive = async (id: string, isLive: boolean) => {
    await toggleElephantLive(id, isLive);
    const fresh = await getElephants();
    setElephants(fresh);
    if (selectedElephant && selectedElephant.id === id) {
      setSelectedElephant({ ...selectedElephant, isLive });
    }
  };

  // -------------------------------------------------------------
  // Cultural Events CRUD Handlers
  // -------------------------------------------------------------

  const handleSaveEvent = async (
    eventData: Omit<CulturalEvent, 'id' | 'createdAt' | 'updatedAt'>,
    id?: string
  ) => {
    if (id) {
      await updateCulturalEvent(id, eventData);
      showNotification('පෙරහැර නිවේදනය යාවත්කාලීන විය!');
    } else {
      await addCulturalEvent(eventData);
      showNotification('නව පෙරහැර නිවේදනයක් පළ කෙරිණි!');
    }
    const freshEvents = await getCulturalEvents();
    setEvents(freshEvents);
  };

  const handleDeleteEvent = async (id: string) => {
    await deleteCulturalEvent(id);
    showNotification('නිවේදනය ඉවත් කරන ලදී.');
    const freshEvents = await getCulturalEvents();
    setEvents(freshEvents);
  };

  // Seed database manually
  const handleSeedDatabase = async () => {
    setIsSeeding(true);
    try {
      await seedInitialVerifiedData();
      await loadData();
      showNotification('සත්‍යාපිත හීලෑ අලි වාර්තා සාර්ථකව ඇතුළත් කෙරිණි!');
    } catch (err: any) {
      alert(`Error: ${err.message || err}`);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8F4] dark:bg-[#0A1411] text-[#062E22] dark:text-[#E2E8F0] flex flex-col font-sans antialiased selection:bg-emerald-200 transition-colors">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#062E22] dark:bg-emerald-950 text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 text-xs font-bold animate-fadeIn border border-emerald-500/30">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={handleTabChange}
        language={language}
        onToggleLanguage={toggleLanguage}
        onOpenAdmin={() => {
          setIsAdminOpen(true);
          window.location.hash = 'admin';
        }}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-lg mx-auto px-3.5 sm:px-4 pt-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <div className="w-10 h-10 border-3 border-emerald-800 dark:border-emerald-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-emerald-900/80 dark:text-emerald-300">
              {language === 'si' ? 'හීලෑ අලි වාර්තා පූරණය වෙමින් පවතී...' : 'Loading verified elephant registry...'}
            </p>
          </div>
        ) : selectedElephant ? (
          /* SCREEN 3: Profile view when clicking "View" / elephant */
          <ElephantProfileScreen
            elephant={selectedElephant}
            communityPosts={posts}
            language={language}
            onBack={handleBackToDirectory}
            onSelectPhoto={(photoUrl) => setLightboxPhoto(photoUrl)}
            onOpenCreatePost={(id) => handleOpenCreatePost(id)}
          />
        ) : currentTab === 'home' ? (
          /* SCREEN 1: /home Discover tab matching Instagram-style discover */
          <DiscoverFeed
            elephants={elephants}
            posts={posts}
            language={language}
            onSelectElephant={handleSelectElephant}
            onOpenCreatePost={(id, isStoryOnly) => handleOpenCreatePost(id, isStoryOnly)}
            onSelectPhoto={(photoUrl) => setLightboxPhoto(photoUrl)}
            onShowNotification={showNotification}
            onOpenDirectory={() => handleTabChange('elephant')}
          />
        ) : currentTab === 'elephant' ? (
          /* /Elephant tab: Trending spotlight (Top 2 followed + Top 2 liked) + directory */
          <ElephantDirectory
            elephants={elephants}
            posts={posts}
            language={language}
            onSelectElephant={handleSelectElephant}
            onSelectPhoto={(photoUrl) => setLightboxPhoto(photoUrl)}
            onShowNotification={showNotification}
          />
        ) : currentTab === 'profile' ? (
          /* User Profile Screen with Google Sign-in and Followed Elephants */
          <UserProfileScreen
            elephants={elephants}
            language={language}
            onSelectElephant={handleSelectElephant}
            onOpenDirectory={() => handleTabChange('elephant')}
            darkMode={darkMode}
            onToggleDarkMode={toggleDarkMode}
            onToggleLanguage={toggleLanguage}
          />
        ) : currentTab === 'notifications' ? (
          /* Notifications Tab: Real Cultural Calendar & Perahera Updates */
          <div className="space-y-4 py-3 pb-24 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-[#062E22] dark:text-emerald-200">
                  {language === 'si' ? 'පෙරහැර සහ සංස්කෘතික නිවේදන' : 'Perahera & Cultural Notices'}
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {language === 'si' ? 'හීලෑ අලි සහභාගී වන පෙරහැර කාලසටහන' : 'Festivals featuring Sri Lankan tuskers'}
                </p>
              </div>
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
            </div>

            <div className="space-y-3">
              {events.map((ev) => (
                <div
                  key={ev.id || ev.title}
                  className="bg-white dark:bg-[#121F1B] p-4 sm:p-5 rounded-3xl border border-zinc-200 dark:border-emerald-950/70 shadow-2xs space-y-2.5 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-extrabold text-[#062E22] dark:text-emerald-100">{ev.title}</h4>
                      {ev.sinhalaTitle && (
                        <p className="text-xs text-emerald-800 dark:text-emerald-300 font-sinhala">{ev.sinhalaTitle}</p>
                      )}
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300/40">
                      Perahera
                    </span>
                  </div>

                  <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">{ev.description}</p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800 font-medium">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                      <span>{ev.location}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                      <span>{ev.date}</span>
                    </span>
                  </div>

                  {ev.participatingElephants && ev.participatingElephants.length > 0 && (
                    <div className="bg-[#FAF9F5] dark:bg-[#1A2C26] p-2.5 rounded-xl border border-zinc-200/80 dark:border-emerald-950/50 flex items-center gap-1.5 text-xs text-[#062E22] dark:text-emerald-100">
                      <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                      <span className="font-bold">සහභාගී වන ඇත්තු:</span>
                      <span className="text-zinc-600 dark:text-zinc-300 truncate">{ev.participatingElephants.join(', ')}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </main>

      {/* Floating Bottom Navigation Bar */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={handleTabChange}
        onOpenAdd={() => handleOpenCreatePost()}
      />

      {/* Photo Lightbox */}
      {lightboxPhoto && (
        <PhotoLightbox
          photoUrl={lightboxPhoto}
          onClose={() => setLightboxPhoto(null)}
        />
      )}

      {/* Create Post / Photo Upload Modal for Elephants */}
      {isCreatePostOpen && (
        <CreatePostModal
          elephants={elephants}
          preselectedElephantId={createPostElephantId}
          isStoryOnlyInitial={isCreatePostStoryOnly}
          language={language}
          onClose={() => setIsCreatePostOpen(false)}
          onPostSuccess={handlePostSuccess}
        />
      )}

      {/* Admin Management Console Modal (Opened via Top Shield icon) */}
      {isAdminOpen && (
        <AdminPanel
          elephants={elephants}
          events={events}
          onSaveElephant={handleSaveElephant}
          onDeleteElephant={handleDeleteElephant}
          onToggleVerification={handleToggleVerification}
          onToggleFeatured={handleToggleFeatured}
          onToggleLive={handleToggleLive}
          onSaveEvent={handleSaveEvent}
          onDeleteEvent={handleDeleteEvent}
          onSeedDatabase={handleSeedDatabase}
          onViewElephant={(el) => {
            setIsAdminOpen(false);
            handleSelectElephant(el);
          }}
          onClose={() => {
            setIsAdminOpen(false);
            if (window.location.hash === '#admin') {
              window.location.hash = currentTab === 'elephant' ? 'elephant' : currentTab === 'profile' ? 'profile' : 'home';
            }
          }}
          language={language}
        />
      )}
    </div>
  );
}
