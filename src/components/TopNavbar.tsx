import React, { useState } from 'react';
import {
  Search,
  Bell,
  Sparkles,
  MapPin,
  ChevronDown,
  X,
  Zap,
  Sun,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Leaf,
  LogOut,
  LogIn,
  Settings,
} from 'lucide-react';
import { AppState, calculateUserAggregates } from '../utils/storage';
import type { AuthenticatedUserProfile } from '../utils/supabaseAuth';

interface TopNavbarProps {
  appState: AppState;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenOnboarding: () => void;
  onOpenDocs: () => void;
  authUser?: AuthenticatedUserProfile | null;
  onOpenSignIn?: () => void;
  onSignOut?: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  appState,
  activeTab,
  setActiveTab,
  onOpenOnboarding,
  onOpenDocs,
  authUser,
  onOpenSignIn,
  onSignOut,
}) => {
  const { profile } = appState;
  const aggregates = calculateUserAggregates(appState);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: '1',
      title: 'Optimal Solar Generation Window',
      desc: `${profile.district || 'Your area'} expects 5.4 kWh/m² peak sun irradiance today.`,
      time: '10m ago',
      type: 'solar',
      read: false,
    },
    {
      id: '2',
      title: 'Peak Tariff Reminder (6 PM – 10 PM)',
      desc: 'Shift washing machine & pump loads off-peak to optimize DISCOM energy slabs.',
      time: '1h ago',
      type: 'grid',
      read: false,
    },
    {
      id: '3',
      title: 'PM Surya Ghar Muft Bijli Yojana',
      desc: 'Central subsidy up to ₹78,000 active for Gujarat residential rooftops.',
      time: '4h ago',
      type: 'subsidy',
      read: true,
    },
  ]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  // Quick search items
  const searchableItems = [
    { title: 'Appliance Energy Calculator & Tariffs', type: 'My Energy', tab: 'my-energy' },
    { title: 'Air Conditioner 24°C Setpoint', type: 'Mission', tab: 'missions' },
    { title: 'Rooftop Solar Subsidy (₹78,000)', type: 'Solar', tab: 'solar' },
    { title: 'UrjaGuru AI Green Coach', type: 'AI Assistant', tab: 'coach' },
    { title: 'Gujarat 33-District Leaderboard', type: 'Community', tab: 'impact' },
    { title: 'Digital Green Impact Passport', type: 'Credential', tab: 'impact' },
    { title: 'GERC GIDRES 2026 Surplus (₹2.25/kWh)', type: 'Regulations', tab: 'solar' },
    { title: 'Vampire Standby Load Elimination', type: 'Mission', tab: 'missions' },
  ];

  const filteredSearch = searchableItems.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200/80 h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
      {/* Mobile Brand Title */}
      <div className="lg:hidden flex items-center gap-2">
        <button
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center gap-2 focus:outline-none"
        >
          <div className="w-8 h-8 rounded-lg bg-[#14532D] flex items-center justify-center text-white">
            <Leaf className="w-4 h-4 text-[#A3E635]" />
          </div>
          <span className="font-heading font-extrabold text-base tracking-tight text-slate-900">
            URJA<span className="text-[#059669]">SAATHI</span>
          </span>
        </button>
      </div>

      {/* Desktop Search Bar */}
      <div className="hidden lg:flex items-center flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search missions, solar schemes, tariffs, or advice..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-xs text-slate-800 placeholder-slate-400 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setIsSearchOpen(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Quick Search Dropdown Modal */}
          {isSearchOpen && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-200/80 p-2 z-50">
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Quick Navigation</span>
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs"
                >
                  Esc
                </button>
              </div>
              <div className="space-y-0.5">
                {filteredSearch.length > 0 ? (
                  filteredSearch.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setActiveTab(item.tab);
                        setIsSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between hover:bg-emerald-50 text-slate-700 hover:text-emerald-900 transition-colors"
                    >
                      <span className="font-medium">{item.title}</span>
                      <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        {item.type}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-4 text-center text-xs text-slate-500">
                    No results for &quot;{searchQuery}&quot;
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Action Icons & Profile Badge */}
      <div className="flex items-center gap-3 ml-auto">
        {/* District Indicator Pill */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/70">
          <MapPin className="w-3.5 h-3.5 text-[#059669]" />
          <span className="font-medium">{profile.district || 'Gujarat'}</span>
        </div>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none"
            aria-label="View notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-600 ring-2 ring-white" />
            )}
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 sm:w-88 bg-white rounded-2xl shadow-xl border border-slate-200/80 p-3 z-50">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800">Gujarat LiFE Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[11px] font-semibold text-[#059669] hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`py-2.5 px-2 text-xs flex gap-2.5 rounded-lg transition-colors ${
                      !n.read ? 'bg-emerald-50/40' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-[#059669] flex items-center justify-center shrink-0 mt-0.5">
                      {n.type === 'solar' ? (
                        <Sun className="w-3.5 h-3.5" />
                      ) : n.type === 'grid' ? (
                        <Zap className="w-3.5 h-3.5" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-slate-800">{n.title}</p>
                        <span className="text-[10px] text-slate-400">{n.time}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{n.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sign in with Google button when in Guest / Demo Mode */}
        {!authUser && onOpenSignIn && (
          <button
            type="button"
            data-testid="navbar-google-signin-btn"
            onClick={onOpenSignIn}
            className="px-3 py-1.5 rounded-xl bg-[#14532D] hover:bg-emerald-900 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer shrink-0"
          >
            <LogIn className="w-3.5 h-3.5 text-[#A3E635]" />
            <span>Sign in with Google</span>
          </button>
        )}

        {/* Profile Card / Authenticated Account Dropdown */}
        <div className="relative">
          <button
            type="button"
            data-testid="navbar-profile-btn"
            onClick={() => {
              if (authUser) {
                setIsAccountMenuOpen(!isAccountMenuOpen);
              } else {
                onOpenOnboarding();
              }
            }}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200 text-left focus:outline-none cursor-pointer"
          >
            {authUser?.avatarUrl ? (
              <img
                src={authUser.avatarUrl}
                alt={profile.name || authUser.name || 'User avatar'}
                data-testid="navbar-user-avatar-img"
                className="w-8 h-8 rounded-full object-cover border border-emerald-300 shadow-xs"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#14532D] to-[#059669] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {(profile.name || authUser?.name || authUser?.email || 'U')
                  .charAt(0)
                  .toUpperCase()}
              </div>
            )}
            <div className="hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span
                  data-testid="navbar-user-display-name"
                  className="text-xs font-bold text-slate-800 leading-tight max-w-[140px] truncate"
                >
                  {profile.name || authUser?.name || 'Citizen'}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-[#14532D] font-mono">
                  {aggregates.effectiveGreenScore}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight max-w-[150px] truncate">
                {authUser?.email ? authUser.email : aggregates.baselineMetrics.tier.name}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          </button>

          {authUser && isAccountMenuOpen && (
            <div
              data-testid="navbar-account-dropdown"
              className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200/90 p-3 z-50 space-y-2.5"
            >
              <div className="pb-2.5 border-b border-slate-100 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {profile.name || authUser.name || 'Authenticated Citizen'}
                  </span>
                  {authUser.emailVerified && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="w-2.5 h-2.5 text-[#059669]" />
                      Verified
                    </span>
                  )}
                </div>
                <p
                  data-testid="navbar-user-email"
                  className="text-[11px] text-slate-600 truncate font-medium"
                >
                  {authUser.email}
                </p>
                <p
                  data-testid="navbar-user-uuid"
                  className="text-[10px] font-mono text-slate-400 truncate"
                >
                  UUID: {authUser.id}
                </p>
              </div>

              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsAccountMenuOpen(false);
                    onOpenOnboarding();
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-[#14532D] flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 text-[#059669]" />
                  <span>Edit Household Profile</span>
                </button>

                {onSignOut && (
                  <button
                    type="button"
                    data-testid="navbar-signout-btn"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      onSignOut();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-red-700 hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 text-red-600" />
                    <span>Sign Out of Google Account</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
