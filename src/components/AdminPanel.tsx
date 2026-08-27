import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { User } from 'firebase/auth';
import {
  Elephant,
  CulturalEvent,
  ElephantPost,
  ElephantType,
  Gender,
  ElephantSource,
} from '../types/elephant';
import { UserProfile } from '../types/user';
import {
  LayoutDashboard,
  PawPrint,
  CalendarDays,
  Images,
  Users as UsersIcon,
  LogOut,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  Star,
  ShieldCheck,
  Radio,
  Loader2,
  ImagePlus,
  ArrowLeft,
  Heart,
  AlertTriangle,
  Check,
  Menu,
} from 'lucide-react';
import { Language } from '../utils/translations';
import { LOGO_URL } from './Navbar';
import { compressImageFile } from '../utils/imageCompressor';
import { uploadPhotoToCloudinary } from '../firebase/cloudinaryService';
import { getAllElephantPosts, deleteElephantPost } from '../firebase/postService';
import { getAllUsers, deleteUserAccount } from '../firebase/userService';
import { signInAdmin, signOutAdmin, subscribeAdminAuthState, getAdminAuthErrorMessage } from '../firebase/adminAuthService';

// -------------------------------------------------------------
// Props
// -------------------------------------------------------------

interface AdminPanelProps {
  elephants: Elephant[];
  events: CulturalEvent[];
  posts: ElephantPost[];
  onSaveElephant: (elephant: Omit<Elephant, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => Promise<void>;
  onDeleteElephant: (id: string, name?: string, sinhalaName?: string) => Promise<{
    deletedElephantName: string;
    postsDeleted: number;
    usersUpdated: number;
    eventsUpdated: number;
  } | void>;
  onToggleVerification: (id: string, verified: boolean) => Promise<void>;
  onToggleFeatured: (id: string, isFeatured: boolean) => Promise<void>;
  onToggleLive: (id: string, isLive: boolean) => Promise<void>;
  onSaveEvent: (event: Omit<CulturalEvent, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
  onViewElephant: (elephant: Elephant) => void;
  onClose: () => void;
  language: Language;
}

type AdminTab = 'dashboard' | 'elephants' | 'events' | 'posts' | 'users';

const EMPTY_ELEPHANT_FORM = {
  name: '',
  sinhalaName: '',
  otherNames: '',
  gender: 'male' as Gender,
  type: 'elephant' as ElephantType,
  dateOfBirth: '',
  age: '',
  location: '',
  organization: '',
  mahout: '',
  tusks: '',
  physicalCharacteristics: '',
  description: '',
  peraheraParticipation: '',
  sourcesText: '',
  verified: true,
  status: 'living' as 'living' | 'memorial',
  isFeatured: false,
  isLive: false,
  customBadge: '',
};

const EMPTY_EVENT_FORM = {
  title: '',
  sinhalaTitle: '',
  description: '',
  location: '',
  date: '',
  type: 'perahera' as CulturalEvent['type'],
  participatingElephants: '',
  isActive: true,
  coverImage: '',
};

// -------------------------------------------------------------
// Small shared UI bits
// -------------------------------------------------------------

const NAV_ITEMS: { id: AdminTab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'elephants', label: 'Elephants', icon: PawPrint },
  { id: 'events', label: 'Events', icon: CalendarDays },
  { id: 'posts', label: 'Posts', icon: Images },
  { id: 'users', label: 'Users', icon: UsersIcon },
];

function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  destructive = true,
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] bg-ink-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-parchment-50 rounded-2xl max-w-sm w-full p-5 border border-parchment-300 shadow-2xl animate-fadeIn">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${destructive ? 'bg-red-100 text-red-600' : 'bg-pine-100 text-pine-700'}`}>
            <AlertTriangle className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="font-bold text-ink-950 text-sm">{title}</h3>
            <p className="text-xs text-ink-600 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-2 rounded-xl text-xs font-bold bg-parchment-200 text-ink-800 hover:bg-parchment-300 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 py-2 rounded-xl text-xs font-bold text-white transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5 ${
              destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-pine-700 hover:bg-pine-800'
            }`}
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wider text-ink-600">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  'w-full px-3 py-2 rounded-xl border border-parchment-300 bg-white text-sm text-ink-950 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-pine-500/40 focus:border-pine-500 transition-all';

// -------------------------------------------------------------
// Login screen
// -------------------------------------------------------------

function AdminLogin({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signInAdmin(email, password);
      // onAuthStateChanged listener in the parent will pick this up automatically.
    } catch (err: any) {
      setError(getAdminAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-ink-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-parchment-50 rounded-3xl max-w-sm w-full border border-parchment-300 shadow-2xl overflow-hidden animate-fadeIn">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-parchment-200 hover:bg-parchment-300 flex items-center justify-center text-ink-600 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="pt-8 pb-5 flex flex-col items-center border-b border-parchment-200 px-6">
          <div className="registry-seal w-14 h-14 rounded-full flex items-center justify-center mb-3">
            <ShieldCheck className="w-6 h-6 text-ink-950/80" />
          </div>
          <h2 className="font-display text-lg font-bold text-ink-950">Admin Console</h2>
          <p className="text-[11px] text-ink-500 mt-1">Sign in with your registered admin account</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2.5 rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Field label="Email">
            <div className="relative">
              <Mail className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className={`${inputCls} pl-9`}
                disabled={submitting}
              />
            </div>
          </Field>

          <Field label="Password">
            <div className="relative">
              <Lock className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`${inputCls} pl-9 pr-9`}
                disabled={submitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-pine-800 hover:bg-pine-900 text-parchment-50 text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>

          <p className="text-[10.5px] text-ink-500 text-center leading-relaxed pt-1">
            Admin access is limited to accounts added by the platform owner in the Firebase Console.
          </p>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Main Admin Panel
// -------------------------------------------------------------

export const AdminPanel: React.FC<AdminPanelProps> = ({
  elephants,
  events,
  posts,
  onSaveElephant,
  onDeleteElephant,
  onToggleVerification,
  onToggleFeatured,
  onToggleLive,
  onSaveEvent,
  onDeleteEvent,
  onViewElephant,
  onClose,
}) => {
  // ---- Auth ----
  const [authChecked, setAuthChecked] = useState(false);
  const [adminUser, setAdminUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = subscribeAdminAuthState((user) => {
      setAdminUser(user);
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Lock page scroll while the console is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  if (!authChecked) {
    return (
      <div className="fixed inset-0 z-[60] bg-ink-950/70 backdrop-blur-sm flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-parchment-50 animate-spin" />
      </div>
    );
  }

  if (!adminUser) {
    return <AdminLogin onClose={onClose} />;
  }

  return (
    <div className="fixed inset-0 z-[60] bg-ink-950 flex text-ink-950 font-sans">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:w-60 lg:w-64 flex-col bg-ink-950 text-parchment-100 border-r border-white/10 shrink-0">
        <div className="p-5 flex items-center gap-2.5 border-b border-white/10">
          <img src={LOGO_URL} alt="" className="w-8 h-8 rounded-full object-cover" />
          <div>
            <p className="font-display font-bold text-sm leading-tight">Alimedia</p>
            <p className="text-[10px] text-parchment-400 uppercase tracking-wider">Admin Console</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  active ? 'bg-gold-500/15 text-gold-300' : 'text-parchment-300 hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/10 space-y-1">
          <div className="px-3 py-2 text-[11px] text-parchment-400 truncate">{adminUser.email}</div>
          <button
            onClick={() => signOutAdmin()}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-parchment-300 hover:bg-white/5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
          <button
            onClick={onClose}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-parchment-300 hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Site
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 bg-parchment-50">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-ink-950 text-parchment-100 shrink-0">
          <button onClick={() => setMobileNavOpen((s) => !s)} className="p-1.5 -ml-1.5">
            <Menu className="w-5 h-5" />
          </button>
          <p className="font-display font-bold text-sm">{NAV_ITEMS.find((n) => n.id === activeTab)?.label}</p>
          <button onClick={onClose} className="p-1.5 -mr-1.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {mobileNavOpen && (
          <div className="md:hidden bg-ink-950 text-parchment-100 px-3 pb-3 shrink-0 grid grid-cols-3 gap-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileNavOpen(false);
                  }}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-[10px] font-bold ${
                    active ? 'bg-gold-500/15 text-gold-300' : 'text-parchment-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
            <button
              onClick={() => signOutAdmin()}
              className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-[10px] font-bold text-parchment-300"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto admin-scroll">
          <div className="max-w-5xl mx-auto p-4 sm:p-6">
            {activeTab === 'dashboard' && (
              <DashboardTab elephants={elephants} events={events} posts={posts} />
            )}
            {activeTab === 'elephants' && (
              <ElephantsTab
                elephants={elephants}
                onSaveElephant={onSaveElephant}
                onDeleteElephant={onDeleteElephant}
                onToggleVerification={onToggleVerification}
                onToggleFeatured={onToggleFeatured}
                onToggleLive={onToggleLive}
                onViewElephant={onViewElephant}
              />
            )}
            {activeTab === 'events' && (
              <EventsTab elephants={elephants} events={events} onSaveEvent={onSaveEvent} onDeleteEvent={onDeleteEvent} />
            )}
            {activeTab === 'posts' && <PostsTab posts={posts} />}
            {activeTab === 'users' && <UsersTab />}
          </div>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Dashboard
// -------------------------------------------------------------

function StatCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: React.ElementType }) {
  return (
    <div className="bg-white rounded-2xl border border-parchment-200 p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-pine-50 text-pine-700 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xl font-extrabold text-ink-950 leading-tight">{value}</p>
        <p className="text-[11px] text-ink-500 font-semibold uppercase tracking-wide">{label}</p>
      </div>
    </div>
  );
}

function DashboardTab({ elephants, events, posts }: { elephants: Elephant[]; events: CulturalEvent[]; posts: ElephantPost[] }) {
  const verified = elephants.filter((e) => e.verified).length;
  const featured = elephants.filter((e) => e.isFeatured).length;
  const live = elephants.filter((e) => e.isLive).length;

  return (
    <div className="space-y-5 animate-fadeIn">
      <div>
        <h1 className="font-display text-xl font-bold text-ink-950">Overview</h1>
        <p className="text-xs text-ink-500 mt-0.5">A quick snapshot of the registry's live data.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Elephants" value={elephants.length} icon={PawPrint} />
        <StatCard label="Verified" value={verified} icon={ShieldCheck} />
        <StatCard label="Featured" value={featured} icon={Star} />
        <StatCard label="Live now" value={live} icon={Radio} />
        <StatCard label="Events" value={events.length} icon={CalendarDays} />
        <StatCard label="Community posts" value={posts.length} icon={Images} />
      </div>

      <div className="bg-white rounded-2xl border border-parchment-200 p-4">
        <h3 className="text-sm font-bold text-ink-950 mb-3">Recently added elephants</h3>
        {elephants.length === 0 ? (
          <p className="text-xs text-ink-500">No elephants in the registry yet.</p>
        ) : (
          <div className="space-y-2">
            {elephants.slice(0, 5).map((el) => (
              <div key={el.id} className="flex items-center gap-3 py-1.5">
                <div className="w-9 h-9 rounded-lg bg-parchment-200 overflow-hidden shrink-0">
                  {el.photos?.[0] && <img src={el.photos[0]} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-ink-950 truncate">{el.name}</p>
                  <p className="text-[10.5px] text-ink-500 truncate">{el.location || 'No location set'}</p>
                </div>
                {el.verified && <ShieldCheck className="w-3.5 h-3.5 text-pine-600 shrink-0" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Elephants Tab — full CRUD
// -------------------------------------------------------------

interface PhotoSlot {
  url: string;
  publicId: string;
  status: 'ready' | 'uploading' | 'error';
}

function ElephantsTab({
  elephants,
  onSaveElephant,
  onDeleteElephant,
  onToggleVerification,
  onToggleFeatured,
  onToggleLive,
  onViewElephant,
}: {
  elephants: Elephant[];
  onSaveElephant: AdminPanelProps['onSaveElephant'];
  onDeleteElephant: AdminPanelProps['onDeleteElephant'];
  onToggleVerification: AdminPanelProps['onToggleVerification'];
  onToggleFeatured: AdminPanelProps['onToggleFeatured'];
  onToggleLive: AdminPanelProps['onToggleLive'];
  onViewElephant: AdminPanelProps['onViewElephant'];
}) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Elephant | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toggleBusyId, setToggleBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return elephants;
    return elephants.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.sinhalaName || '').toLowerCase().includes(q) ||
        (e.location || '').toLowerCase().includes(q) ||
        (e.organization || '').toLowerCase().includes(q)
    );
  }, [elephants, search]);

  const editingElephant = editingId && editingId !== 'new' ? elephants.find((e) => e.id === editingId) || null : null;

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await onDeleteElephant(deleteTarget.id, deleteTarget.name, deleteTarget.sinhalaName);
      setDeleteTarget(null);
    } catch (err: any) {
      alert(`Failed to delete: ${err?.message || err}`);
    } finally {
      setDeleting(false);
    }
  };

  if (editingId) {
    return (
      <ElephantForm
        elephant={editingElephant}
        onCancel={() => setEditingId(null)}
        onSaved={() => setEditingId(null)}
        onSaveElephant={onSaveElephant}
      />
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-950">Elephants</h1>
          <p className="text-xs text-ink-500 mt-0.5">{elephants.length} record(s) in the registry.</p>
        </div>
        <button
          onClick={() => setEditingId('new')}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-pine-800 hover:bg-pine-900 text-parchment-50 text-sm font-bold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Elephant
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, location or organization…"
          className={`${inputCls} pl-9`}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-parchment-200 p-10 text-center">
          <p className="text-sm text-ink-500">No elephants found.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((el) => (
            <div key={el.id} className="bg-white rounded-2xl border border-parchment-200 p-3.5 flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-parchment-200 overflow-hidden shrink-0">
                {el.photos?.[0] ? (
                  <img src={el.photos[0]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-ink-300">
                    <PawPrint className="w-6 h-6" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-bold text-ink-950 truncate">{el.name}</p>
                  {el.verified && <ShieldCheck className="w-3.5 h-3.5 text-pine-600 shrink-0" />}
                  {el.isFeatured && <Star className="w-3.5 h-3.5 text-gold-500 shrink-0" />}
                  {el.isLive && <Radio className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                </div>
                <p className="text-[11px] text-ink-500 truncate">
                  {el.location || 'No location'} · {el.organization || 'No organization'}
                </p>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <ToggleChip
                    label="Verified"
                    active={!!el.verified}
                    busy={toggleBusyId === el.id + 'v'}
                    onClick={async () => {
                      setToggleBusyId(el.id! + 'v');
                      try {
                        await onToggleVerification(el.id!, !el.verified);
                      } finally {
                        setToggleBusyId(null);
                      }
                    }}
                  />
                  <ToggleChip
                    label="Featured"
                    active={!!el.isFeatured}
                    busy={toggleBusyId === el.id + 'f'}
                    onClick={async () => {
                      setToggleBusyId(el.id! + 'f');
                      try {
                        await onToggleFeatured(el.id!, !el.isFeatured);
                      } finally {
                        setToggleBusyId(null);
                      }
                    }}
                  />
                  <ToggleChip
                    label="Live"
                    active={!!el.isLive}
                    busy={toggleBusyId === el.id + 'l'}
                    onClick={async () => {
                      setToggleBusyId(el.id! + 'l');
                      try {
                        await onToggleLive(el.id!, !el.isLive);
                      } finally {
                        setToggleBusyId(null);
                      }
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onViewElephant(el)}
                  title="View profile"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-500 hover:bg-parchment-100 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditingId(el.id!)}
                  title="Edit"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-pine-700 hover:bg-pine-50 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeleteTarget(el)}
                  title="Delete"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete ${deleteTarget.name}?`}
          message="This permanently removes the elephant record along with all of its community posts, and updates any events or followers referencing it. This cannot be undone."
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function ToggleChip({ label, active, busy, onClick }: { label: string; active: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors flex items-center gap-1 disabled:opacity-50 ${
        active ? 'bg-pine-700 text-white border-pine-700' : 'bg-transparent text-ink-500 border-parchment-300'
      }`}
    >
      {busy && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
      {label}
    </button>
  );
}

// -------------------------------------------------------------
// Elephant Add/Edit Form
// -------------------------------------------------------------

function ElephantForm({
  elephant,
  onCancel,
  onSaved,
  onSaveElephant,
}: {
  elephant: Elephant | null;
  onCancel: () => void;
  onSaved: () => void;
  onSaveElephant: AdminPanelProps['onSaveElephant'];
}) {
  const isEdit = !!elephant;
  const [form, setForm] = useState(() => {
    if (!elephant) return { ...EMPTY_ELEPHANT_FORM };
    return {
      name: elephant.name || '',
      sinhalaName: elephant.sinhalaName || '',
      otherNames: (elephant.otherNames || []).join(', '),
      gender: elephant.gender || 'male',
      type: elephant.type || 'elephant',
      dateOfBirth: elephant.dateOfBirth || '',
      age: elephant.age !== undefined ? String(elephant.age) : '',
      location: elephant.location || '',
      organization: elephant.organization || '',
      mahout: elephant.mahout || '',
      tusks: elephant.tusks || '',
      physicalCharacteristics: elephant.physicalCharacteristics || '',
      description: elephant.description || '',
      peraheraParticipation: (elephant.peraheraParticipation || []).join(', '),
      sourcesText: (elephant.sources || []).map((s) => s.title + (s.url ? ` | ${s.url}` : '')).join('\n'),
      verified: elephant.verified ?? true,
      status: elephant.status || 'living',
      isFeatured: !!elephant.isFeatured,
      isLive: !!elephant.isLive,
      customBadge: elephant.customBadge || '',
    };
  });

  const [photos, setPhotos] = useState<PhotoSlot[]>(() =>
    elephant?.photos?.length
      ? elephant.photos.map((url, idx) => ({
          url,
          publicId: elephant.cloudinaryPhotos?.[idx]?.publicId || '',
          status: 'ready' as const,
        }))
      : []
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newSlots: PhotoSlot[] = Array.from(files).map(() => ({ url: '', publicId: '', status: 'uploading' }));
    setPhotos((prev) => [...prev, ...newSlots]);
    const startIndex = photos.length;

    await Promise.all(
      Array.from(files).map(async (file, i) => {
        const slotIndex = startIndex + i;
        try {
          const compressed = await compressImageFile(file, { maxDimension: 1280, quality: 0.82 });
          const result = await uploadPhotoToCloudinary(compressed);
          setPhotos((prev) => {
            const next = [...prev];
            next[slotIndex] = { url: result.url, publicId: result.publicId, status: 'ready' };
            return next;
          });
        } catch (err) {
          console.error('Photo upload failed:', err);
          setPhotos((prev) => {
            const next = [...prev];
            next[slotIndex] = { ...next[slotIndex], status: 'error' };
            return next;
          });
        }
      })
    );
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!form.location.trim()) {
      setError('Location is required.');
      return;
    }
    if (!form.description.trim()) {
      setError('Description is required.');
      return;
    }
    if (photos.some((p) => p.status === 'uploading')) {
      setError('Please wait for all photos to finish uploading.');
      return;
    }

    const readyPhotos = photos.filter((p) => p.status === 'ready' && p.url);

    const sources: ElephantSource[] = form.sourcesText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [title, url] = line.split('|').map((s) => s.trim());
        return { title: title || line, url: url || undefined };
      });

    const payload: Omit<Elephant, 'id' | 'createdAt' | 'updatedAt'> = {
      name: form.name.trim(),
      sinhalaName: form.sinhalaName.trim(),
      otherNames: form.otherNames.split(',').map((s) => s.trim()).filter(Boolean),
      gender: form.gender,
      type: form.type,
      dateOfBirth: form.dateOfBirth.trim(),
      age: form.age.trim(),
      location: form.location.trim(),
      organization: form.organization.trim(),
      mahout: form.mahout.trim(),
      tusks: form.tusks.trim(),
      physicalCharacteristics: form.physicalCharacteristics.trim(),
      description: form.description.trim(),
      peraheraParticipation: form.peraheraParticipation.split(',').map((s) => s.trim()).filter(Boolean),
      photos: readyPhotos.map((p) => p.url),
      cloudinaryPhotos: readyPhotos.map((p) => ({ url: p.url, publicId: p.publicId })),
      sources,
      verified: form.verified,
      status: form.status,
      isFeatured: form.isFeatured,
      isLive: form.isLive,
      customBadge: form.customBadge.trim(),
      followerCount: elephant?.followerCount || 0,
    };

    setSaving(true);
    try {
      await onSaveElephant(payload, elephant?.id);
      onSaved();
    } catch (err: any) {
      setError(err?.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 animate-fadeIn pb-8">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onCancel} className="w-9 h-9 rounded-xl bg-white border border-parchment-200 flex items-center justify-center text-ink-600 hover:bg-parchment-100 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="font-display text-lg font-bold text-ink-950">{isEdit ? `Edit ${elephant!.name}` : 'Add New Elephant'}</h1>
          <p className="text-xs text-ink-500">{isEdit ? 'Update this record in the registry.' : 'Create a new record in the registry.'}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2.5 rounded-xl flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Photos */}
      <div className="bg-white rounded-2xl border border-parchment-200 p-4 space-y-3">
        <h3 className="text-sm font-bold text-ink-950">Photos</h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
          {photos.map((p, idx) => (
            <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-parchment-100 border border-parchment-200">
              {p.status === 'uploading' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>
              )}
              {p.status === 'error' && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-50">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
              )}
              {p.url && <img src={p.url} alt="" className="w-full h-full object-cover" />}
              <button
                type="button"
                onClick={() => removePhoto(idx)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="aspect-square rounded-xl border-2 border-dashed border-parchment-300 flex flex-col items-center justify-center gap-1 text-ink-400 hover:text-pine-600 hover:border-pine-400 transition-colors"
          >
            <ImagePlus className="w-5 h-5" />
            <span className="text-[10px] font-bold">Add</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
        </div>
        <p className="text-[10.5px] text-ink-500">Photos are compressed and uploaded securely to Cloudinary automatically.</p>
      </div>

      {/* Core identity */}
      <div className="bg-white rounded-2xl border border-parchment-200 p-4 space-y-4">
        <h3 className="text-sm font-bold text-ink-950">Identity</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Name" required>
            <input className={inputCls} value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="e.g. Indiraja" />
          </Field>
          <Field label="Sinhala Name">
            <input className={`${inputCls} font-sinhala`} value={form.sinhalaName} onChange={(e) => setField('sinhalaName', e.target.value)} placeholder="e.g. ඉන්දිරාජා" />
          </Field>
          <Field label="Other Names (comma separated)">
            <input className={inputCls} value={form.otherNames} onChange={(e) => setField('otherNames', e.target.value)} />
          </Field>
          <Field label="Custom Badge">
            <input className={inputCls} value={form.customBadge} onChange={(e) => setField('customBadge', e.target.value)} placeholder="e.g. National Treasure" />
          </Field>
          <Field label="Gender">
            <select className={inputCls} value={form.gender} onChange={(e) => setField('gender', e.target.value as Gender)}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>
          <Field label="Type">
            <select className={inputCls} value={form.type} onChange={(e) => setField('type', e.target.value as ElephantType)}>
              <option value="elephant">Elephant</option>
              <option value="tusker">Tusker</option>
            </select>
          </Field>
          <Field label="Date of Birth">
            <input className={inputCls} value={form.dateOfBirth} onChange={(e) => setField('dateOfBirth', e.target.value)} placeholder="YYYY-MM-DD or approx." />
          </Field>
          <Field label="Age">
            <input className={inputCls} value={form.age} onChange={(e) => setField('age', e.target.value)} />
          </Field>
          <Field label="Status">
            <select className={inputCls} value={form.status} onChange={(e) => setField('status', e.target.value as 'living' | 'memorial')}>
              <option value="living">Living</option>
              <option value="memorial">Memorial</option>
            </select>
          </Field>
        </div>
      </div>

      {/* Location & care */}
      <div className="bg-white rounded-2xl border border-parchment-200 p-4 space-y-4">
        <h3 className="text-sm font-bold text-ink-950">Location & Care</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Location" required>
            <input className={inputCls} value={form.location} onChange={(e) => setField('location', e.target.value)} placeholder="e.g. Kandy" />
          </Field>
          <Field label="Organization">
            <input className={inputCls} value={form.organization} onChange={(e) => setField('organization', e.target.value)} placeholder="e.g. Sri Dalada Maligawa" />
          </Field>
          <Field label="Mahout">
            <input className={inputCls} value={form.mahout} onChange={(e) => setField('mahout', e.target.value)} />
          </Field>
          <Field label="Tusks">
            <input className={inputCls} value={form.tusks} onChange={(e) => setField('tusks', e.target.value)} />
          </Field>
          <Field label="Physical Characteristics">
            <input className={inputCls} value={form.physicalCharacteristics} onChange={(e) => setField('physicalCharacteristics', e.target.value)} />
          </Field>
          <Field label="Perahera Participation (comma separated)">
            <input className={inputCls} value={form.peraheraParticipation} onChange={(e) => setField('peraheraParticipation', e.target.value)} />
          </Field>
        </div>
      </div>

      {/* Description & sources */}
      <div className="bg-white rounded-2xl border border-parchment-200 p-4 space-y-4">
        <h3 className="text-sm font-bold text-ink-950">Description & Sources</h3>
        <Field label="Description" required>
          <textarea
            className={`${inputCls} min-h-[110px] resize-y`}
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="Comprehensive background, sacred history, guardianship…"
          />
        </Field>
        <Field label="Sources (one per line: Title | URL)">
          <textarea
            className={`${inputCls} min-h-[70px] resize-y`}
            value={form.sourcesText}
            onChange={(e) => setField('sourcesText', e.target.value)}
            placeholder={'Department of Wildlife Conservation | https://...'}
          />
        </Field>
      </div>

      {/* Flags */}
      <div className="bg-white rounded-2xl border border-parchment-200 p-4 space-y-3">
        <h3 className="text-sm font-bold text-ink-950">Flags</h3>
        <div className="flex flex-wrap gap-2">
          <CheckboxChip label="Verified" checked={form.verified} onChange={(v) => setField('verified', v)} />
          <CheckboxChip label="Featured" checked={form.isFeatured} onChange={(v) => setField('isFeatured', v)} />
          <CheckboxChip label="Live now" checked={form.isLive} onChange={(v) => setField('isLive', v)} />
        </div>
      </div>

      <div className="flex gap-2 sticky bottom-0 bg-parchment-50 py-3 -mx-1 px-1">
        <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-parchment-200 text-ink-800 text-sm font-bold hover:bg-parchment-300 transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-[2] py-2.5 rounded-xl bg-pine-800 hover:bg-pine-900 text-parchment-50 text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Elephant'}
        </button>
      </div>
    </form>
  );
}

function CheckboxChip({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
        checked ? 'bg-pine-700 text-white border-pine-700' : 'bg-transparent text-ink-500 border-parchment-300'
      }`}
    >
      {checked && <Check className="w-3.5 h-3.5" />}
      {label}
    </button>
  );
}

// -------------------------------------------------------------
// Events Tab — full CRUD
// -------------------------------------------------------------

function EventsTab({
  elephants,
  events,
  onSaveEvent,
  onDeleteEvent,
}: {
  elephants: Elephant[];
  events: CulturalEvent[];
  onSaveEvent: AdminPanelProps['onSaveEvent'];
  onDeleteEvent: AdminPanelProps['onDeleteEvent'];
}) {
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CulturalEvent | null>(null);
  const [deleting, setDeleting] = useState(false);

  const editingEvent = editingId && editingId !== 'new' ? events.find((e) => e.id === editingId) || null : null;

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await onDeleteEvent(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err: any) {
      alert(`Failed to delete: ${err?.message || err}`);
    } finally {
      setDeleting(false);
    }
  };

  if (editingId) {
    return (
      <EventForm
        event={editingEvent}
        onCancel={() => setEditingId(null)}
        onSaved={() => setEditingId(null)}
        onSaveEvent={onSaveEvent}
      />
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-950">Events & Notices</h1>
          <p className="text-xs text-ink-500 mt-0.5">{events.length} entr{events.length === 1 ? 'y' : 'ies'} published.</p>
        </div>
        <button
          onClick={() => setEditingId('new')}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-pine-800 hover:bg-pine-900 text-parchment-50 text-sm font-bold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Event
        </button>
      </div>

      {events.length === 0 ? (
        <div className="bg-white rounded-2xl border border-parchment-200 p-10 text-center">
          <p className="text-sm text-ink-500">No events published yet.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {events.map((ev) => (
            <div key={ev.id} className="bg-white rounded-2xl border border-parchment-200 p-3.5 flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-parchment-200 overflow-hidden shrink-0 flex items-center justify-center text-ink-300">
                {ev.coverImage ? <img src={ev.coverImage} alt="" className="w-full h-full object-cover" /> : <CalendarDays className="w-6 h-6" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink-950 truncate">{ev.title}</p>
                <p className="text-[11px] text-ink-500 truncate">
                  {ev.type} · {ev.location || 'No location'} {ev.date ? `· ${ev.date}` : ''}
                </p>
                {!ev.isActive && <span className="text-[10px] font-bold text-ink-400">Inactive</span>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setEditingId(ev.id!)} className="w-8 h-8 rounded-lg flex items-center justify-center text-pine-700 hover:bg-pine-50 transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => setDeleteTarget(ev)} className="w-8 h-8 rounded-lg flex items-center justify-center text-red-600 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete "${deleteTarget.title}"?`}
          message="This permanently removes the event notice. This cannot be undone."
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function EventForm({
  event,
  onCancel,
  onSaved,
  onSaveEvent,
}: {
  event: CulturalEvent | null;
  onCancel: () => void;
  onSaved: () => void;
  onSaveEvent: AdminPanelProps['onSaveEvent'];
}) {
  const isEdit = !!event;
  const [form, setForm] = useState(() =>
    event
      ? {
          title: event.title || '',
          sinhalaTitle: event.sinhalaTitle || '',
          description: event.description || '',
          location: event.location || '',
          date: event.date || '',
          type: event.type || 'perahera',
          participatingElephants: (event.participatingElephants || []).join(', '),
          isActive: event.isActive ?? true,
          coverImage: event.coverImage || '',
        }
      : { ...EMPTY_EVENT_FORM }
  );
  const [coverStatus, setCoverStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleCoverSelected = async (file: File | null) => {
    if (!file) return;
    setCoverStatus('uploading');
    try {
      const compressed = await compressImageFile(file, { maxDimension: 1280, quality: 0.82 });
      const result = await uploadPhotoToCloudinary(compressed);
      setField('coverImage', result.url);
      setCoverStatus('idle');
    } catch (err) {
      console.error('Cover upload failed:', err);
      setCoverStatus('error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!form.description.trim()) {
      setError('Description is required.');
      return;
    }

    const payload: Omit<CulturalEvent, 'id' | 'createdAt' | 'updatedAt'> = {
      title: form.title.trim(),
      sinhalaTitle: form.sinhalaTitle.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
      date: form.date.trim(),
      type: form.type,
      participatingElephants: form.participatingElephants.split(',').map((s) => s.trim()).filter(Boolean),
      isActive: form.isActive,
      coverImage: form.coverImage,
    };

    setSaving(true);
    try {
      await onSaveEvent(payload, event?.id);
      onSaved();
    } catch (err: any) {
      setError(err?.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 animate-fadeIn pb-8">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onCancel} className="w-9 h-9 rounded-xl bg-white border border-parchment-200 flex items-center justify-center text-ink-600 hover:bg-parchment-100 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="font-display text-lg font-bold text-ink-950">{isEdit ? 'Edit Event' : 'Add New Event'}</h1>
          <p className="text-xs text-ink-500">Cultural events, ceremonies and notices shown to visitors.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2.5 rounded-xl flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-parchment-200 p-4 space-y-4">
        <Field label="Cover Image">
          <div className="flex items-center gap-3">
            <div className="w-20 h-14 rounded-xl bg-parchment-100 overflow-hidden border border-parchment-200 flex items-center justify-center text-ink-300 shrink-0">
              {coverStatus === 'uploading' ? (
                <Loader2 className="w-5 h-5 animate-spin text-ink-400" />
              ) : form.coverImage ? (
                <img src={form.coverImage} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImagePlus className="w-5 h-5" />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 rounded-xl bg-parchment-200 text-ink-800 text-xs font-bold hover:bg-parchment-300 transition-colors"
            >
              {form.coverImage ? 'Replace image' : 'Upload image'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleCoverSelected(e.target.files?.[0] || null)} />
          </div>
        </Field>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Title" required>
            <input className={inputCls} value={form.title} onChange={(e) => setField('title', e.target.value)} />
          </Field>
          <Field label="Sinhala Title">
            <input className={`${inputCls} font-sinhala`} value={form.sinhalaTitle} onChange={(e) => setField('sinhalaTitle', e.target.value)} />
          </Field>
          <Field label="Type">
            <select className={inputCls} value={form.type} onChange={(e) => setField('type', e.target.value as CulturalEvent['type'])}>
              <option value="perahera">Perahera</option>
              <option value="ceremony">Ceremony</option>
              <option value="conservation">Conservation</option>
              <option value="general">General</option>
              <option value="update">Platform Update</option>
              <option value="alert">Urgent Alert</option>
              <option value="news">News</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Date">
            <input className={inputCls} value={form.date} onChange={(e) => setField('date', e.target.value)} placeholder="e.g. 2026-08-30" />
          </Field>
          <Field label="Location">
            <input className={inputCls} value={form.location} onChange={(e) => setField('location', e.target.value)} />
          </Field>
          <Field label="Participating Elephants (comma separated)">
            <input className={inputCls} value={form.participatingElephants} onChange={(e) => setField('participatingElephants', e.target.value)} />
          </Field>
        </div>

        <Field label="Description" required>
          <textarea className={`${inputCls} min-h-[100px] resize-y`} value={form.description} onChange={(e) => setField('description', e.target.value)} />
        </Field>

        <CheckboxChip label="Active / Visible to users" checked={form.isActive} onChange={(v) => setField('isActive', v)} />
      </div>

      <div className="flex gap-2 sticky bottom-0 bg-parchment-50 py-3 -mx-1 px-1">
        <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-parchment-200 text-ink-800 text-sm font-bold hover:bg-parchment-300 transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || coverStatus === 'uploading'}
          className="flex-[2] py-2.5 rounded-xl bg-pine-800 hover:bg-pine-900 text-parchment-50 text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Publish Event'}
        </button>
      </div>
    </form>
  );
}

// -------------------------------------------------------------
// Posts moderation tab
// -------------------------------------------------------------

function PostsTab({ posts }: { posts: ElephantPost[] }) {
  const [deleteTarget, setDeleteTarget] = useState<ElephantPost | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await deleteElephantPost(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err: any) {
      alert(`Failed to delete post: ${err?.message || err}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      <div>
        <h1 className="font-display text-xl font-bold text-ink-950">Community Posts</h1>
        <p className="text-xs text-ink-500 mt-0.5">{posts.length} post(s) submitted by the community.</p>
      </div>

      {posts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-parchment-200 p-10 text-center">
          <p className="text-sm text-ink-500">No community posts yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {posts.map((post) => (
            <div key={post.id} className="bg-white rounded-2xl border border-parchment-200 overflow-hidden group relative">
              <div className="aspect-square bg-parchment-100">
                <img src={post.photoUrl} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="p-2.5">
                <p className="text-[11px] font-bold text-ink-950 truncate">{post.elephantName}</p>
                <p className="text-[10.5px] text-ink-500 truncate">by {post.authorName}</p>
                <div className="flex items-center gap-1 mt-1 text-[10.5px] text-ink-500">
                  <Heart className="w-3 h-3" /> {post.likesCount || 0}
                </div>
              </div>
              <button
                onClick={() => setDeleteTarget(post)}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this post?"
          message="This permanently removes the post and its photo from the feed. This cannot be undone."
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Users tab
// -------------------------------------------------------------

function UsersTab() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await getAllUsers();
      setUsers(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteUserAccount(deleteTarget.uid);
      setUsers((prev) => prev.filter((u) => u.uid !== deleteTarget.uid));
      setDeleteTarget(null);
    } catch (err: any) {
      alert(`Failed to delete user: ${err?.message || err}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-950">Users</h1>
          <p className="text-xs text-ink-500 mt-0.5">{users.length} registered profile(s).</p>
        </div>
        <button onClick={load} className="text-xs font-bold text-pine-700 hover:underline">
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 text-ink-400 animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-2xl border border-parchment-200 p-10 text-center">
          <p className="text-sm text-ink-500">No registered users yet.</p>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {users.map((u) => (
            <div key={u.uid} className="bg-white rounded-2xl border border-parchment-200 p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-parchment-200 overflow-hidden shrink-0">
                {u.photoURL ? <img src={u.photoURL} alt="" className="w-full h-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink-950 truncate">{u.displayName}</p>
                <p className="text-[11px] text-ink-500 truncate">{u.email || u.username}</p>
              </div>
              <p className="text-[11px] text-ink-500 shrink-0">{u.followedElephants?.length || 0} following</p>
              <button
                onClick={() => setDeleteTarget(u)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-red-600 hover:bg-red-50 transition-colors shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Remove ${deleteTarget.displayName}?`}
          message="This deletes their profile and community posts from the platform. This cannot be undone."
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
