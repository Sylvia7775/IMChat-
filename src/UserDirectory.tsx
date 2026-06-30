import { useState, useEffect } from 'react';
import { 
  Search as SearchIcon, 
  UserPlus, 
  UserCheck, 
  BadgeCheck,
  Filter,
  Calendar,
  Activity,
  Mail,
  User as UserIcon,
  Phone,
  SlidersHorizontal,
  Sparkles,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import UserAvatar from './components/UserAvatar';
import { GroupStore, Group } from './lib/GroupStore';
import { ChannelStore, Channel } from './lib/ChannelStore';

interface User {
  id: string;
  name: string;
  username?: string;
  email?: string;
  password?: string;
  phone?: string;
  role?: 'admin' | 'moderator' | 'team' | 'user' | 'vip' | 'restricted';
  isVerified?: boolean;
  avatar?: string;
  hideAvatarPublicly?: boolean;
  createdAt?: any;
  bio?: string;
}

export default function UserDirectory({ 
  onUserSelected, 
  followingState, 
  onToggleFollow,
  searchQuery = '',
  onOpenNav
}: { 
  onUserSelected: (user: User) => void;
  followingState: Record<string, boolean>;
  onToggleFollow: (id: string) => void;
  searchQuery?: string;
  onOpenNav?: (navId: string) => void;
}) {
  const [search, setSearch] = useState(searchQuery);
  const [activeTab, setActiveTab] = useState<'people' | 'groups' | 'channels'>('people');
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const OWNER_EMAILS = ['mobilephonesky987@gmail.com', 'contact@imchat.im'];

  // Advanced Filtering State
  const [filterAge, setFilterAge] = useState<'all' | 'newest' | 'oldest' | 'today' | 'week' | 'month'>('all');
  const [filterVerified, setFilterVerified] = useState<'all' | 'verified' | 'unverified'>('all');
  const [filterActivity, setFilterActivity] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Search Toggle State
  const [searchByName, setSearchByName] = useState(true);
  const [searchByUsername, setSearchByUsername] = useState(true);
  const [searchByEmail, setSearchByEmail] = useState(true);
  const [searchByPhone, setSearchByPhone] = useState(true);

  useEffect(() => {
    setSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (authUser) => {
      if (!authUser) {
        setLoading(false);
        return;
      }

      const unsubscribeSnap = onSnapshot(collection(db, "users"), (snapshot) => {
        const usersData: User[] = [];
        const BLACKLIST_EMAILS = [
          '18932572358@imchat.im',
          'cameron89@aol.webstexact-1782132253-1m8faz68@imchat.im',
          'stexact-1782124890-rxh34y95@imchat.im'
        ];

        snapshot.forEach((doc) => {
          const data = doc.data() as User;
          const userEmail = (data.email || '').toLowerCase().trim();
          
          if (BLACKLIST_EMAILS.some(b => userEmail === b.toLowerCase())) {
            // Silently delete blacklisted user from Firestore in background
            import('firebase/firestore').then(({ doc: fireDoc, deleteDoc }) => {
              deleteDoc(fireDoc(db, "users", doc.id)).catch(err => {
                console.warn("Deleted blacklisted user in background", doc.id);
              });
            });
          } else {
            usersData.push({ id: doc.id, ...data } as User);
          }
        });
        setUsers(usersData);
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, "users");
        setLoading(false);
      });

      return unsubscribeSnap;
    });

    return () => unsub();
  }, []);

  // Subscribe to Groups & Channels
  useEffect(() => {
    const updateGroups = () => setGroups(GroupStore.getGroups());
    updateGroups();
    return GroupStore.subscribe(updateGroups);
  }, []);

  useEffect(() => {
    const updateChannels = () => setChannels(ChannelStore.getChannels());
    updateChannels();
    return ChannelStore.subscribe(updateChannels);
  }, []);

  // Calculate activity score helper
  const getUserActivityLevel = (u: User) => {
    let score = 0;
    if (u.isVerified) score += 3;
    if (u.role === 'admin' || u.role === 'moderator' || u.role === 'team' || u.role === 'vip') score += 3;
    if (u.avatar && u.avatar !== '') score += 2;
    if (u.bio && u.bio.length > 15) score += 2;
    if (u.username) score += 1;
    
    if (score >= 5) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  };

  // Safe Date/Age parser
  const getAccountAgeMs = (u: User) => {
    if (!u.createdAt) return Infinity; // missing/empty values go to bottom/oldest
    if (typeof u.createdAt.toDate === 'function') {
      return u.createdAt.toDate().getTime();
    }
    if (u.createdAt.seconds) {
      return u.createdAt.seconds * 1000;
    }
    const parsed = Date.parse(u.createdAt);
    if (!isNaN(parsed)) return parsed;
    return Infinity;
  };

  // Search filter & multi-filtering implementation for people
  const queryLower = (search || '').toLowerCase().trim();
  
  const filteredUsers = users.filter((u) => {
    // 1. Search criteria (matches selected target fields)
    if (queryLower) {
      let match = false;
      const username = (u.username || u.name || '').toLowerCase().replace(/\s+/g, '_');
      if (searchByName && (u.name || '').toLowerCase().includes(queryLower)) match = true;
      if (searchByUsername && username.includes(queryLower)) match = true;
      if (searchByEmail && (u.email || '').toLowerCase().includes(queryLower)) match = true;
      if (searchByPhone && (u.phone || '').toLowerCase().includes(queryLower)) match = true;
      if (!match) return false;
    }
    
    // 2. Verified filter
    if (filterVerified === 'verified' && !u.isVerified) return false;
    if (filterVerified === 'unverified' && u.isVerified) return false;
    
    // 3. Activity Level filter
    if (filterActivity !== 'all') {
      const activity = getUserActivityLevel(u);
      if (filterActivity !== activity) return false;
    }
    
    // 4. Age filter (within timeframe constraints)
    if (['today', 'week', 'month'].includes(filterAge)) {
      const timeMs = getAccountAgeMs(u);
      if (timeMs === Infinity) return false;
      
      const now = Date.now();
      const diffMs = now - timeMs;
      
      if (filterAge === 'today' && diffMs > 24 * 60 * 60 * 1000) return false;
      if (filterAge === 'week' && diffMs > 7 * 24 * 60 * 60 * 1000) return false;
      if (filterAge === 'month' && diffMs > 30 * 24 * 60 * 60 * 1000) return false;
    }
    
    return true;
  });

  // Sort by Account Age if chosen
  if (filterAge === 'newest') {
    filteredUsers.sort((a, b) => getAccountAgeMs(b) - getAccountAgeMs(a));
  } else if (filterAge === 'oldest') {
    filteredUsers.sort((a, b) => getAccountAgeMs(a) - getAccountAgeMs(b));
  }
  
  const filteredGroups = groups.filter(g => 
    (g?.title || '').toLowerCase().includes((search || '').toLowerCase()) || 
    (g?.description || '').toLowerCase().includes((search || '').toLowerCase())
  );

  const filteredChannels = channels.filter(c => 
    (c?.name || '').toLowerCase().includes((search || '').toLowerCase()) || 
    (c?.description || '').toLowerCase().includes((search || '').toLowerCase())
  );

  const handleJoinGroup = async (group: Group) => {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) return;
    
    const isAlreadyMember = group.members.some(m => m.userId === currentUserId);
    if (isAlreadyMember) return;

    try {
      await GroupStore.joinGroup(group.id, {
        userId: currentUserId,
        name: auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Member',
        role: 'member',
        avatar: auth.currentUser?.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
      });
    } catch (err) {
      console.error("Failed to join group:", err);
    }
  };

  const handleToggleSubscribeChannel = async (channel: Channel) => {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) return;

    try {
      await ChannelStore.toggleSubscribe(channel.id, currentUserId);
    } catch (err) {
      console.error("Failed to toggle subscribe:", err);
    }
  };

  const getCount = () => {
    if (activeTab === 'people') return filteredUsers.length;
    if (activeTab === 'groups') return filteredGroups.length;
    return filteredChannels.length;
  };

  const RoleBadge = ({ role }: { role?: string }) => {
    if (!role || role === 'user') return null;
    
    const colors: Record<string, string> = {
      admin: 'bg-red-50 text-red-600 border-red-100',
      moderator: 'bg-green-50 text-green-600 border-green-100',
      vip: 'bg-amber-50 text-amber-600 border-amber-200 shadow-sm',
      team: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      restricted: 'bg-gray-100 text-gray-500 border-gray-250 line-through'
    };
    
    const labels: Record<string, string> = {
      admin: 'Admin',
      moderator: 'Mod',
      vip: '👑 VIP Gold',
      team: 'IMChat Team',
      restricted: 'Restricted'
    };

    const colorClass = colors[role] || 'bg-gray-50 text-gray-500 border-gray-100';
    const labelText = labels[role] || role;

    return (
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border ${colorClass}`}>
        {labelText}
      </span>
    );
  };

  const formatAccountAge = (u: User) => {
    if (!u.createdAt) return 'Unknown age';
    let date: Date;
    if (typeof u.createdAt.toDate === 'function') {
      date = u.createdAt.toDate();
    } else if (u.createdAt.seconds) {
      date = new Date(u.createdAt.seconds * 1000);
    } else {
      date = new Date(u.createdAt);
    }
    if (isNaN(date.getTime())) return 'Unknown age';
    return `Joined ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const ActivityBadge = ({ level }: { level: 'high' | 'medium' | 'low' }) => {
    const configs = {
      high: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-100', label: '🔥 High Activity' },
      medium: { bg: 'bg-amber-50 text-amber-700 border-amber-100', label: '⚡ Active' },
      low: { bg: 'bg-gray-100 text-gray-500 border-gray-200', label: '💤 Quiet' }
    };
    const config = configs[level];
    return (
      <span className={`text-[8.5px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider border ${config.bg}`}>
        {config.label}
      </span>
    );
  };

  return (
    <main className="flex-1 bg-white overflow-y-auto pb-20">
      <div className="px-4 py-2 sticky top-0 bg-white z-10 border-b border-gray-100 flex items-center justify-between">
        <h1 className="font-bold text-xl text-gray-900 tracking-tight">Explore</h1>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-1 rounded-md border border-gray-100">{getCount()} Results</span>
        </div>
      </div>

      <div className="p-4 bg-white border-b border-gray-100">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={activeTab === 'people' ? "Search by name, username, email or phone..." : "Search..."}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-100 rounded-lg py-2 pl-10 pr-4 outline-none text-sm focus:ring-2 focus:ring-brand-blue/10 transition-all border-none font-medium"
            />
          </div>
          {activeTab === 'people' && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg border transition-all flex items-center justify-center ${
                showFilters || filterAge !== 'all' || filterVerified !== 'all' || filterActivity !== 'all'
                  ? 'bg-brand-blue/10 text-brand-blue border-brand-blue/30'
                  : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'
              }`}
              title="Toggle Advanced Filters"
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Collapsible Advanced Filters Section */}
        {activeTab === 'people' && showFilters && (
          <div className="mt-3 bg-gray-50 rounded-xl p-3 border border-gray-150 space-y-3.5 transition-all animate-in fade-in duration-200">
            {/* Search Targets Checkboxes */}
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Search in Fields:</span>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                <label className="flex items-center gap-1.5 text-xs text-gray-700 font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={searchByName}
                    onChange={(e) => setSearchByName(e.target.checked)}
                    className="rounded border-gray-300 text-brand-blue focus:ring-brand-blue/20 w-3.5 h-3.5"
                  />
                  <span>Full Name</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-700 font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={searchByUsername}
                    onChange={(e) => setSearchByUsername(e.target.checked)}
                    className="rounded border-gray-300 text-brand-blue focus:ring-brand-blue/20 w-3.5 h-3.5"
                  />
                  <span>Username</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-700 font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={searchByEmail}
                    onChange={(e) => setSearchByEmail(e.target.checked)}
                    className="rounded border-gray-300 text-brand-blue focus:ring-brand-blue/20 w-3.5 h-3.5"
                  />
                  <span>Email</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-700 font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={searchByPhone}
                    onChange={(e) => setSearchByPhone(e.target.checked)}
                    className="rounded border-gray-300 text-brand-blue focus:ring-brand-blue/20 w-3.5 h-3.5"
                  />
                  <span>Phone Number</span>
                </label>
              </div>
            </div>

            {/* Filter Dropdowns Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Account Age */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Account Age
                </label>
                <select
                  value={filterAge}
                  onChange={(e) => setFilterAge(e.target.value as any)}
                  className="bg-white border border-gray-250 text-gray-700 rounded-lg p-1.5 text-xs outline-none focus:ring-2 focus:ring-brand-blue/20 cursor-pointer"
                >
                  <option value="all">All (No Sorting)</option>
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="today">Registered today</option>
                  <option value="week">Registered this week</option>
                  <option value="month">Registered this month</option>
                </select>
              </div>

              {/* Verified Status */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <BadgeCheck className="w-3 h-3 text-brand-blue fill-brand-blue/10" /> Verified Status
                </label>
                <select
                  value={filterVerified}
                  onChange={(e) => setFilterVerified(e.target.value as any)}
                  className="bg-white border border-gray-250 text-gray-700 rounded-lg p-1.5 text-xs outline-none focus:ring-2 focus:ring-brand-blue/20 cursor-pointer"
                >
                  <option value="all">All Users</option>
                  <option value="verified">Verified Only</option>
                  <option value="unverified">Unverified Only</option>
                </select>
              </div>

              {/* Activity Level */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <Activity className="w-3 h-3" /> Activity Level
                </label>
                <select
                  value={filterActivity}
                  onChange={(e) => setFilterActivity(e.target.value as any)}
                  className="bg-white border border-gray-250 text-gray-700 rounded-lg p-1.5 text-xs outline-none focus:ring-2 focus:ring-brand-blue/20 cursor-pointer"
                >
                  <option value="all">All Activity</option>
                  <option value="high">🔥 High Activity</option>
                  <option value="medium">⚡ Active</option>
                  <option value="low">💤 Quiet</option>
                </select>
              </div>
            </div>

            {/* Clear Filters Indicator if filters are active */}
            {(filterAge !== 'all' || filterVerified !== 'all' || filterActivity !== 'all' || !searchByName || !searchByUsername || !searchByEmail || !searchByPhone) && (
              <div className="flex justify-between items-center pt-2 border-t border-gray-200/60">
                <span className="text-[11px] text-gray-500 font-medium">Filters/Limits are active</span>
                <button
                  onClick={() => {
                    setFilterAge('all');
                    setFilterVerified('all');
                    setFilterActivity('all');
                    setSearchByName(true);
                    setSearchByUsername(true);
                    setSearchByEmail(true);
                    setSearchByPhone(true);
                  }}
                  className="text-[11px] font-bold text-brand-blue hover:underline"
                >
                  Reset Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modern High-Contrast Tabs */}
      <div className="flex border-b border-gray-100 bg-white sticky top-22 z-10">
        {(['people', 'groups', 'channels'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 text-center py-3 text-sm font-semibold border-b-2 transition-all capitalize ${
              activeTab === tab 
                ? 'border-brand-blue text-brand-blue font-bold px-1' 
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab === 'people' ? 'People' : tab === 'groups' ? 'Groups' : 'Channels'}
          </button>
        ))}
      </div>
      
      <div className="flex flex-col mt-2">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-4">
             <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
             <span className="text-sm text-gray-500 font-medium tracking-tight">Searching...</span>
          </div>
        ) : activeTab === 'people' ? (
          filteredUsers.length > 0 ? (
            <div className="mt-1">
              {filteredUsers.map((user) => {
                const isFollowing = followingState[user.id];
                const username = (user?.name || '').toLowerCase().replace(/\s+/g, '_');
                let displayAvatar = user.avatar;
                
                if (user.hideAvatarPublicly && user.id !== auth.currentUser?.uid) {
                  displayAvatar = undefined; // UserAvatar will handle alphabet fallback
                }

                return (
                  <div 
                    key={user.id} 
                    onClick={() => onUserSelected(user)}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 cursor-pointer active:bg-gray-100 transition-colors group border-b border-gray-50"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="relative shrink-0">
                        <div className="w-[85px] h-[85px] rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 p-[2px] group-active:scale-95 transition-transform">
                          <UserAvatar 
                            src={displayAvatar} 
                            name={user.name}
                            size="lg"
                            className="!w-full !h-full border-[2px] border-white"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="font-bold text-[16px] text-gray-900 leading-tight truncate">@{username}</span>
                            {(user.isVerified || (user.email && OWNER_EMAILS.includes(user.email.toLowerCase())) || (user.id === auth.currentUser?.uid && auth.currentUser?.email?.toLowerCase() && OWNER_EMAILS.includes(auth.currentUser.email.toLowerCase()))) && (
                              <BadgeCheck className="w-4 h-4 text-white fill-brand-blue shrink-0" />
                            )}
                          </div>
                          <RoleBadge role={user.role} />
                        </div>
                        <span className="text-sm text-slate-400 font-medium leading-tight mt-0.5 truncate">{user.name}</span>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFollow(user.id);
                      }}
                      className={`px-5 py-2.5 text-[13px] font-bold rounded-xl transition-all active:scale-95 shadow-sm shrink-0 ml-2 min-w-[95px] text-center ${
                        isFollowing 
                          ? 'bg-[#8b5cf6] hover:bg-[#7c3aed] text-white shadow-purple-200/10' 
                          : 'bg-brand-blue text-white hover:bg-blue-600'
                      }`}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-16 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-50 rounded-full mb-4">
                <SearchIcon className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-900 font-bold">No results found</p>
              <p className="text-sm text-gray-500 mt-1">Try searching for other profiles.</p>
            </div>
          )
        ) : activeTab === 'groups' ? (
          filteredGroups.length > 0 ? (
            <div className="flex flex-col divide-y divide-gray-100">
              {filteredGroups.map((group) => {
                const isMember = group.members?.some(m => m.userId === auth.currentUser?.uid);
                return (
                  <div 
                    key={group.id}
                    onClick={() => {
                      localStorage.setItem('explore_open_group_id', group.id);
                      if (onOpenNav) onOpenNav('group');
                    }}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <img src={group.coverUrl} className="w-[50px] h-[50px] rounded-xl object-cover border border-gray-100" />
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm text-gray-900 leading-tight">{group.title}</span>
                        <span className="text-[11px] text-brand-blue font-medium mt-0.5">{group.members?.length || 0} members</span>
                        <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5 max-w-[200px]">{group.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isMember ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleJoinGroup(group);
                          }}
                          className="px-4 py-1.5 bg-brand-blue text-white font-bold text-xs rounded-lg hover:bg-blue-600 active:scale-95 transition shadow-sm"
                        >
                          Join
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">Joined</span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          localStorage.setItem('explore_open_group_id', group.id);
                          if (onOpenNav) onOpenNav('group');
                        }}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-lg active:scale-95 transition"
                      >
                        View
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-16 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-50 rounded-full mb-4">
                <SearchIcon className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-900 font-bold">No groups found</p>
              <p className="text-sm text-gray-500 mt-1">Try typing a different name or keyword.</p>
            </div>
          )
        ) : (
          filteredChannels.length > 0 ? (
            <div className="flex flex-col divide-y divide-gray-100">
              {filteredChannels.map((channel) => {
                const isSubbed = channel.subscribers?.includes(auth.currentUser?.uid || '');
                return (
                  <div 
                    key={channel.id}
                    onClick={() => {
                      localStorage.setItem('explore_open_channel_id', channel.id);
                      if (onOpenNav) onOpenNav('channels');
                    }}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <img src={channel.coverUrl} className="w-[50px] h-[50px] rounded-xl object-cover border border-gray-100" />
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm text-gray-900 leading-tight flex items-center gap-1">
                          {channel.name}
                          {(channel.id === 'ch1' || channel.isVerified || channel.ownerEmail === 'admin@imchat.app') && (
                            <BadgeCheck className="w-[14px] h-[14px] text-white fill-[#0095f6]" />
                          )}
                        </span>
                        <span className="text-[11px] text-purple-600 font-medium mt-0.5">{channel.subscribers?.length || 0} subscribers</span>
                        <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5 max-w-[200px]">{channel.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSubscribeChannel(channel);
                        }}
                        className={`px-4 py-1.5 font-bold text-xs rounded-lg active:scale-95 transition shadow-sm ${
                          isSubbed 
                            ? 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                            : 'bg-brand-blue text-white hover:bg-blue-600'
                        }`}
                      >
                        {isSubbed ? 'Subscribed' : 'Subscribe'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          localStorage.setItem('explore_open_channel_id', channel.id);
                          if (onOpenNav) onOpenNav('channels');
                        }}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-lg active:scale-95 transition"
                      >
                        View
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-16 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-50 rounded-full mb-4">
                <SearchIcon className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-900 font-bold">No channels found</p>
              <p className="text-sm text-gray-500 mt-1">Try search queries for lifestyle or updates.</p>
            </div>
          )
        )}
      </div>
    </main>
  );
}

