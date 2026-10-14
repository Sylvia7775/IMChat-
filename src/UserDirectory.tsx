import { useState, useEffect, useRef } from 'react';
import { 
  Search as SearchIcon, 
  UserPlus, 
  UserCheck, 
  BadgeCheck,
  Filter,
  Calendar,
  Activity,
  User as UserIcon,
  Phone,
  SlidersHorizontal,
  Sparkles,
  CheckCircle2,
  XCircle,
  Star,
  MessageSquare,
  QrCode,
  Scan,
  Copy,
  Check,
  Share2,
  ClipboardPaste,
  X,
  Download,
  ExternalLink,
  RefreshCw,
  Table,
  List,
  FileSpreadsheet,
  Mic
} from 'lucide-react';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { db, auth } from './firebase';
import UserAvatar from './components/UserAvatar';
import { GroupStore, Group } from './lib/GroupStore';
import { ChannelStore, Channel } from './lib/ChannelStore';
import { FavouriteContactsStore } from './lib/FavouriteContactsStore';
import { COMMUNITY_USERS } from './lib/communityUsers';
import { PostStore } from './lib/PostStore';
import { ReelStore } from './lib/ReelStore';
import { MarketplaceStore } from './lib/MarketplaceStore';
import { AutoSyncService } from './services/autoSyncService';
import { QRScannerModal } from './components/QRScannerModal';
import QRCode from 'qrcode';
import { useVoiceSearch } from './hooks/useVoiceSearch';
import { sanitizeUserRole } from './lib/adminAccess';

interface User {
  id: string;
  name: string;
  username?: string;
  email?: string;
  password?: string;
  phone?: string;
  role?: 'admin' | 'moderator' | 'team' | 'user' | 'vip' | 'restricted' | 'robot';
  isVerified?: boolean;
  avatar?: string;
  hideAvatarPublicly?: boolean;
  createdAt?: any;
  bio?: string;
  isOnline?: boolean;
  presence?: string;
  lastActive?: number | any;
  lastSeen?: string | any;
  status?: string;
}

const isUserOnline = (user: User): boolean => {
  // Current user logged in is definitely online
  if (auth.currentUser?.uid && (user.id === auth.currentUser.uid || (user.email && auth.currentUser.email && user.email.toLowerCase() === auth.currentUser.email.toLowerCase()))) {
    return true;
  }

  if (user.isOnline === true || user.presence === 'online' || user.status === 'online') {
    return true;
  }

  if (user.lastActive) {
    const ts = typeof user.lastActive === 'number' ? user.lastActive : (typeof user.lastActive?.toDate === 'function' ? user.lastActive.toDate().getTime() : 0);
    if (ts && Date.now() - ts < 5 * 60 * 1000) {
      return true;
    }
  }

  // Active seed/community users for lively experience
  if (['user_chris', 'user_janet', 'user_sam', 'user_amber', 'user_bella'].includes(user.id)) {
    return true;
  }

  return false;
};

const DEFAULT_SEED_USERS: User[] = COMMUNITY_USERS as User[];

// Extract User ID, username, or clean identifier from pasted URL or search string
export const extractUserIdentifier = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed) return '';
  
  // Check if URL
  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const profileParam = url.searchParams.get('profile') || url.searchParams.get('user') || url.searchParams.get('u') || url.searchParams.get('id');
    if (profileParam) return decodeURIComponent(profileParam).toLowerCase();
    
    const pathname = url.pathname;
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && (parts[0] === 'user' || parts[0] === 'profile' || parts[0] === 'u')) {
      return decodeURIComponent(parts[1]).replace(/^@/, '').toLowerCase();
    }
  } catch {}
  
  // Regex check for query params in partial string
  const match = trimmed.match(/[?&](?:profile|user|u|id)=([^&#\s]+)/i);
  if (match && match[1]) {
    return decodeURIComponent(match[1]).toLowerCase();
  }
  
  // Check for @username
  if (trimmed.startsWith('@')) {
    return trimmed.substring(1).toLowerCase();
  }
  
  return trimmed.toLowerCase();
};

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
  const [activeTab, setActiveTab] = useState<'people' | 'favourites' | 'groups' | 'channels'>('people');

  // Voice Search Hook for Directory
  const {
    isListening: isVoiceSearching,
    startListening: startVoiceSearch,
    stopListening: stopVoiceSearch,
    error: voiceError
  } = useVoiceSearch((transcript) => {
    setSearch(transcript);
  });

  useEffect(() => {
    if (voiceError) {
      alert(voiceError);
    }
  }, [voiceError]);

  const [favouriteIds, setFavouriteIds] = useState<string[]>(FavouriteContactsStore.getFavourites());
  const [users, setUsers] = useState<User[]>(DEFAULT_SEED_USERS);
  const [groups, setGroups] = useState<Group[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  // QR Code & URL Sharing States
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [qrModalUser, setQrModalUser] = useState<User | null>(null);
  const [generatedQrDataUrl, setGeneratedQrDataUrl] = useState<string>('');
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const OWNER_EMAILS = ['mobilephonesky987@gmail.com', 'contact@imchat.im'];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => prev === msg ? null : prev);
    }, 2800);
  };

  useEffect(() => {
    return FavouriteContactsStore.subscribe(() => {
      setFavouriteIds(FavouriteContactsStore.getFavourites());
    });
  }, []);

  // Advanced Filtering State
  const [viewMode, setViewMode] = useState<'table' | 'list'>('table');
  const [filterAge, setFilterAge] = useState<'all' | 'newest' | 'oldest' | 'today' | 'week' | 'month'>('all');
  const [filterVerified, setFilterVerified] = useState<'all' | 'verified' | 'unverified'>('all');
  const [filterActivity, setFilterActivity] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [filterAlphabet, setFilterAlphabet] = useState<string>('ALL');
  const [showFilters, setShowFilters] = useState(false);

  // Search Toggle State
  const [searchByName, setSearchByName] = useState(true);
  const [searchByUsername, setSearchByUsername] = useState(true);
  const [searchByEmail, setSearchByEmail] = useState(true);
  const [searchByPhone, setSearchByPhone] = useState(true);

  useEffect(() => {
    setSearch(searchQuery);
  }, [searchQuery]);

  // Scan and fetch all registered users from Firestore without arbitrary restrictions
  const [isScanning, setIsScanning] = useState(false);

  const mergeAndDeduplicateUsers = (userList: User[]): User[] => {
    const map = new Map<string, User>();
    const seenEmails = new Set<string>();

    // 1. Process registered Firestore users first (highest priority)
    userList.forEach(u => {
      if (!u || !u.id) return;
      // Exclude any robots or legacy bot IDs
      if ((u as any).isRobot || (u as any).isBot || u.role === 'robot' || u.id.toLowerCase().startsWith('bot_')) return;
      const idKey = u.id.toLowerCase().trim();
      const emailKey = (u.email || '').toLowerCase().trim();

      const firstName = ((u as any).firstName || u.name || '').trim();
      const lastName = ((u as any).lastName || (u as any).surname || '').trim();
      const fullName = (firstName && lastName) ? `${firstName} ${lastName}` : (u.name || firstName || 'User');
      const cleanUsername = u.username || fullName.toLowerCase().replace(/\s+/g, '_');

      if (!map.has(idKey)) {
        map.set(idKey, {
          ...u,
          role: sanitizeUserRole(u.role, u.email),
          name: fullName,
          username: cleanUsername
        });
        if (emailKey) seenEmails.add(emailKey);
      }
    });

    // 2. Include authenticated user if missing
    if (auth.currentUser) {
      const authUid = auth.currentUser.uid.toLowerCase().trim();
      const authEmail = (auth.currentUser.email || '').toLowerCase().trim();
      if (!map.has(authUid)) {
        const myName = auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'My Account';
        map.set(authUid, {
          id: auth.currentUser.uid,
          name: myName,
          username: auth.currentUser.displayName?.toLowerCase().replace(/\s+/g, '_') || 'me',
          email: auth.currentUser.email || '',
          avatar: auth.currentUser.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          role: 'user',
          isVerified: true
        });
        if (authEmail) seenEmails.add(authEmail);
      }
    }

    // 3. Include community members (Garrett, Jamie, Bryce, Amber, Bella, Sam, Janet, Chris, etc.)
    DEFAULT_SEED_USERS.forEach(seed => {
      if ((seed as any).isRobot || (seed as any).isBot || seed.role === 'robot' || seed.id.toLowerCase().startsWith('bot_')) return;
      const seedIdKey = seed.id.toLowerCase().trim();
      const seedEmailKey = (seed.email || '').toLowerCase().trim();
      if (!map.has(seedIdKey) && (!seedEmailKey || !seenEmails.has(seedEmailKey))) {
        map.set(seedIdKey, seed);
        if (seedEmailKey) seenEmails.add(seedEmailKey);
      }
    });

    return Array.from(map.values()).filter(u => !((u as any).isRobot || (u as any).isBot || u.role === 'robot' || u.id.toLowerCase().startsWith('bot_')));
  };

  const fetchUsersFromFirestore = () => {
    setIsScanning(true);
    const unsubscribeSnap = onSnapshot(collection(db, "users"), (snapshot) => {
      const firestoreUsers: User[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as User));

      const merged = mergeAndDeduplicateUsers(firestoreUsers);
      setUsers(merged);
      setLoading(false);
      setIsScanning(false);
    }, (error) => {
      console.warn("Firestore users retrieval notice, displaying default registered users:", error);
      setUsers(mergeAndDeduplicateUsers(DEFAULT_SEED_USERS));
      setLoading(false);
      setIsScanning(false);
    });

    return unsubscribeSnap;
  };

  useEffect(() => {
    const unsub = fetchUsersFromFirestore();

    const handleSyncEvent = (e: any) => {
      if (e.detail?.users && Array.isArray(e.detail.users)) {
        const merged = mergeAndDeduplicateUsers(e.detail.users);
        setUsers(merged);
        setLoading(false);
      }
    };

    const unsubAutoSync = AutoSyncService.subscribe((stats, isSyncing) => {
      if (!isSyncing && stats) {
        const cached = AutoSyncService.getCachedUsers();
        if (cached && cached.length > 0) {
          setUsers(mergeAndDeduplicateUsers(cached as User[]));
        }
      }
    });

    window.addEventListener('user-directory-sync', handleSyncEvent);

    return () => {
      unsub();
      unsubAutoSync();
      window.removeEventListener('user-directory-sync', handleSyncEvent);
    };
  }, []);

  const handleFullScan = async () => {
    setIsScanning(true);
    showToast("Deep scanning all user accounts, media, posts & reels across database...");

    try {
      const stats = await AutoSyncService.performAppWideBackgroundScan({ force: true });
      const cached = AutoSyncService.getCachedUsers();
      if (cached && cached.length > 0) {
        setUsers(mergeAndDeduplicateUsers(cached as User[]));
      }
      setIsScanning(false);
      showToast(`Full scan complete! ${stats.usersCount} users, ${stats.postsCount} posts, ${stats.reelsCount} reels, ${stats.groupsCount} groups synced.`);
    } catch (err) {
      console.error("Full scan error:", err);
      setIsScanning(false);
      showToast(`Scan finished. ${users.length} user profiles active.`);
    }
  };

  // Generate QR Code image when a user is selected for QR view
  useEffect(() => {
    if (qrModalUser) {
      const profileUrl = `${window.location.origin}/?profile=${encodeURIComponent(qrModalUser.id)}`;
      QRCode.toDataURL(profileUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      }).then(url => {
        setGeneratedQrDataUrl(url);
      }).catch(err => {
        console.error("Failed to generate QR code:", err);
      });
    } else {
      setGeneratedQrDataUrl('');
    }
  }, [qrModalUser]);

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

  // Handle Copy Profile Link
  const handleCopyProfileUrl = (user: User, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const profileUrl = `${window.location.origin}/?profile=${encodeURIComponent(user.id)}`;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(profileUrl).then(() => {
        setCopiedUserId(user.id);
        showToast(`Copied profile link for @${user.username || user.name}!`);
        setTimeout(() => setCopiedUserId(prev => prev === user.id ? null : prev), 2500);
      }).catch(() => {
        prompt("Copy profile link:", profileUrl);
      });
    } else {
      prompt("Copy profile link:", profileUrl);
    }
  };

  // Handle Paste Profile URL to Search
  const handlePasteProfileUrl = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          const cleanToken = extractUserIdentifier(text);
          setSearch(cleanToken);
          showToast(`Pasted & searching for "${cleanToken}"`);
          
          // Check if exact match exists and auto-select
          const match = users.find(u => 
            u.id.toLowerCase() === cleanToken || 
            (u.username || '').toLowerCase() === cleanToken || 
            (u.name || '').toLowerCase() === cleanToken ||
            (u.email || '').toLowerCase() === cleanToken
          );
          if (match) {
            onUserSelected(match);
          }
        }
      } else {
        const manual = prompt("Paste user profile URL, username, or ID:");
        if (manual) {
          const cleanToken = extractUserIdentifier(manual);
          setSearch(cleanToken);
        }
      }
    } catch (err) {
      const manual = prompt("Paste user profile URL, username, or ID:");
      if (manual) {
        const cleanToken = extractUserIdentifier(manual);
        setSearch(cleanToken);
      }
    }
  };

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
    if (!u.createdAt) return Infinity;
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

  // Clean search query and URL parsing
  const cleanSearchQuery = extractUserIdentifier(search || '');
  const rawSearchLower = (search || '').toLowerCase().trim();
  
  const filteredUsers = users.filter((u) => {
    // Alphabetical A-Z filter
    if (filterAlphabet !== 'ALL') {
      const nameFirstChar = (u.name || (u as any).firstName || u.username || '').trim().toUpperCase().charAt(0);
      if (nameFirstChar !== filterAlphabet) return false;
    }

    // 1. Search criteria (matches selected target fields & parsed URL tokens)
    const rawSearch = (search || '').trim().toLowerCase();
    const cleanToken = extractUserIdentifier(search || '').toLowerCase();

    if (rawSearch) {
      const searchTerms = rawSearch.split(/\s+/).filter(Boolean);
      
      const firstName = ((u as any).firstName || u.name || '').trim();
      const lastName = ((u as any).lastName || (u as any).surname || '').trim();
      const fullName = `${firstName} ${lastName}`.trim().toLowerCase();
      const singleName = (u.name || (u as any).displayName || firstName || '').trim().toLowerCase();
      const rawUsername = (u.username || singleName || '').replace(/^@/, '').toLowerCase().replace(/\s+/g, '_');
      const email = (u.email || '').toLowerCase().trim();
      const phone = (u.phone || '').replace(/[^0-9]/g, '');
      const searchPhone = rawSearch.replace(/[^0-9]/g, '');
      const userId = (u.id || '').toLowerCase().trim();
      const bio = (u.bio || '').toLowerCase();

      // Name matches (full name, single name, or all search terms)
      const matchesName = searchByName && (
        fullName.includes(rawSearch) || 
        singleName.includes(rawSearch) || 
        searchTerms.every(term => fullName.includes(term) || singleName.includes(term)) ||
        (cleanToken && (fullName.includes(cleanToken) || singleName.includes(cleanToken)))
      );

      // Username matches (with or without @, prefix, or token)
      const matchesUsername = searchByUsername && (
        rawUsername.includes(rawSearch.replace(/^@/, '')) || 
        `@${rawUsername}`.includes(rawSearch) ||
        (cleanToken && (rawUsername.includes(cleanToken.replace(/^@/, '')) || cleanToken === rawUsername))
      );

      // Email matches
      const matchesEmail = searchByEmail && (
        email.includes(rawSearch) || 
        (cleanToken && email.includes(cleanToken))
      );

      // Phone matches
      const matchesPhone = searchByPhone && (
        (searchPhone.length >= 3 && phone.includes(searchPhone)) ||
        (u.phone && (u.phone.toLowerCase().includes(rawSearch) || rawSearch.includes(u.phone.toLowerCase())))
      );

      // User ID or profile token match
      const matchesId = (
        userId.includes(rawSearch) || 
        userId === cleanToken || 
        (cleanToken && userId.includes(cleanToken))
      );

      // Bio match
      const matchesBio = bio.includes(rawSearch);

      if (!matchesName && !matchesUsername && !matchesEmail && !matchesPhone && !matchesId && !matchesBio) {
        return false;
      }
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

  const favouriteUsers = users.filter(u => favouriteIds.includes(u.id) || favouriteIds.includes(u.name));

  const getCount = () => {
    if (activeTab === 'people') return filteredUsers.length;
    if (activeTab === 'favourites') return favouriteUsers.length;
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
      restricted: 'bg-gray-100 text-gray-500 border-gray-250'
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

  // Get current user object for "My QR"
  const currentLoggedInUser = users.find(u => u.id === auth.currentUser?.uid) || {
    id: auth.currentUser?.uid || 'my_account',
    name: auth.currentUser?.displayName || 'My Profile',
    username: auth.currentUser?.displayName?.toLowerCase().replace(/\s+/g, '') || 'me',
    avatar: auth.currentUser?.photoURL || '',
    email: auth.currentUser?.email || '',
    role: 'user' as const,
    isVerified: true
  };

  const exportUsersCsv = (usersToExport: User[]) => {
    try {
      const headers = ['ID', 'Name', 'Email', 'Username', 'Role', 'Status'];
      const rows = usersToExport.map(u => [
        `"${u.id.replace(/"/g, '""')}"`,
        `"${(u.name || '').replace(/"/g, '""')}"`,
        `"${(u.email || '').replace(/"/g, '""')}"`,
        `"@${(u.username || u.name || '').replace(/"/g, '""')}"`,
        `"${u.role || 'user'}"`,
        `"${isUserOnline(u) ? 'Online' : 'Offline'}"`
      ]);
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `user_directory_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('User directory exported to CSV');
    } catch (e) {
      console.error(e);
      showToast('Export failed');
    }
  };

  const renderUserTable = (userList: User[]) => {
    return (
      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
          <table className="w-full text-left border-collapse min-w-[680px]">
            <thead>
              <tr className="bg-[#4CAF50] text-white text-xs font-bold uppercase tracking-wider">
                <th className="py-3 px-3.5 border-b border-emerald-600 w-28">ID</th>
                <th className="py-3 px-3.5 border-b border-emerald-600">Name</th>
                <th className="py-3 px-3.5 border-b border-emerald-600">Email</th>
                <th className="py-3 px-3.5 border-b border-emerald-600">Username</th>
                <th className="py-3 px-3.5 border-b border-emerald-600">Status</th>
                <th className="py-3 px-3.5 border-b border-emerald-600 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-xs sm:text-sm text-gray-700">
              {userList.map((user) => {
                const isFollowing = followingState[user.id];
                const isFav = favouriteIds.includes(user.id) || favouriteIds.includes(user.name);
                const username = user.username || (user?.name || '').toLowerCase().replace(/\s+/g, '_');
                const online = isUserOnline(user);
                const displayId = user.id.length > 14 ? `${user.id.slice(0, 10)}...` : user.id;

                return (
                  <tr 
                    key={user.id}
                    onClick={() => onUserSelected(user)}
                    className="hover:bg-[#f5f5f5] transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-3.5 font-mono text-[11px] text-gray-500 font-semibold">
                      <div className="flex items-center gap-1">
                        <span title={user.id}>{displayId}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(user.id);
                            setCopiedUserId(user.id);
                            showToast(`Copied ID: ${user.id}`);
                            setTimeout(() => setCopiedUserId(prev => prev === user.id ? null : prev), 2500);
                          }}
                          className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                          title="Copy User ID"
                        >
                          {copiedUserId === user.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-3.5 font-medium text-gray-900">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-gray-200 shadow-2xs">
                          <UserAvatar src={user.avatar} name={user.name} size="sm" className="!w-full !h-full" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-gray-900 leading-snug truncate flex items-center gap-1">
                            {user.name}
                            {isFav && <Star className="w-3 h-3 fill-amber-400 text-amber-500 shrink-0" />}
                          </div>
                          {user.bio && <p className="text-[11px] text-gray-400 truncate max-w-[160px]">{user.bio}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3.5 text-gray-600">
                      {user.email ? (
                        <div className="flex items-center gap-1">
                          <span className="truncate max-w-[180px] font-medium">{user.email}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(user.email!);
                              showToast(`Copied Email: ${user.email}`);
                            }}
                            className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-700 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                            title="Copy Email"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-[11px]">N/A</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 font-medium text-gray-800">
                      <div className="flex items-center gap-1">
                        <span>@{username}</span>
                        {user.isVerified && <BadgeCheck className="w-3.5 h-3.5 text-brand-blue fill-brand-blue/20" />}
                      </div>
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {online ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                            Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                            Offline
                          </span>
                        )}
                        <RoleBadge role={user.role} />
                      </div>
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFollow(user.id);
                          }}
                          className={`px-3 py-1 text-xs font-bold rounded-lg transition-all active:scale-95 cursor-pointer shadow-xs ${
                            isFollowing 
                              ? 'bg-purple-600 text-white hover:bg-purple-700' 
                              : 'bg-[#4CAF50] text-white hover:bg-[#43a047]'
                          }`}
                        >
                          {isFollowing ? 'Following' : 'Follow'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onUserSelected(user);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-200/70 rounded-lg transition-colors cursor-pointer"
                          title="View Profile Details"
                        >
                          Profile
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <main className="flex-1 bg-white overflow-y-auto pb-20 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-top-4 duration-200 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar with QR Actions */}
      <div className="px-4 py-2.5 sticky top-0 bg-white z-10 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-xl text-gray-900 tracking-tight">Explore Users</h1>
          <p className="text-[11px] text-gray-400 font-medium">Find real registered users & scan profiles</p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Full Scan Directory Button */}
          <button
            onClick={handleFullScan}
            disabled={isScanning}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 transition-all active:scale-95 cursor-pointer shadow-xs disabled:opacity-60"
            title="Scan and synchronize all registered users from database"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isScanning ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isScanning ? 'Scanning...' : 'Full Scan'}</span>
          </button>

          {/* Scan QR Code Button */}
          <button
            onClick={() => setShowQrScanner(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs rounded-xl border border-purple-200 transition-all active:scale-95 cursor-pointer shadow-xs"
            title="Scan User QR Code"
          >
            <Scan className="w-3.5 h-3.5 text-purple-600" />
            <span className="hidden sm:inline">Scan QR</span>
          </button>

          {/* My QR Code Button */}
          <button
            onClick={() => setQrModalUser(currentLoggedInUser)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-brand-blue font-bold text-xs rounded-xl border border-blue-200 transition-all active:scale-95 cursor-pointer shadow-xs"
            title="Show My QR Code"
          >
            <QrCode className="w-3.5 h-3.5 text-brand-blue" />
            <span className="hidden sm:inline">My QR</span>
          </button>

          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-150 shrink-0">
            {getCount()} Users
          </span>
        </div>
      </div>

      {/* Search Bar & Quick Paste Tool */}
      <div className="p-4 bg-white border-b border-gray-100">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={activeTab === 'people' ? "Search by name, username, email, phone or paste profile URL..." : "Search..."}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-100 rounded-xl py-2.5 pl-10 pr-16 outline-none text-sm transition-all border font-medium border-transparent focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-9 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {/* Quick QR Icon inside Search Bar */}
            <button
              onClick={() => setShowQrScanner(true)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer"
              title="Scan QR Code to search"
            >
              <QrCode className="w-4 h-4" />
            </button>
          </div>

          {/* Paste URL Button */}
          {activeTab === 'people' && (
            <button
              onClick={handlePasteProfileUrl}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0 shadow-xs"
              title="Paste profile URL or username from clipboard to search"
            >
              <ClipboardPaste className="w-4 h-4" />
              <span className="hidden sm:inline">Paste URL</span>
            </button>
          )}

          {activeTab === 'people' && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2.5 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
                showFilters || filterAge !== 'all' || filterVerified !== 'all' || filterActivity !== 'all'
                  ? 'bg-brand-blue/10 text-brand-blue border-brand-blue/30'
                  : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'
              }`}
              title="Toggle Advanced Filters"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick URL Search Hint */}
        {cleanSearchQuery && cleanSearchQuery !== rawSearchLower && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-brand-blue bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
            <Sparkles className="w-3.5 h-3.5 shrink-0 text-brand-blue" />
            <span className="font-medium">URL query detected: Filtering by <strong>@{cleanSearchQuery}</strong></span>
          </div>
        )}

        {/* Quick Alphabetical A-Z Selector Bar */}
        {activeTab === 'people' && (
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-2.5 pb-0.5 px-0.5 border-t border-gray-100 mt-2">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0 mr-0.5">A-Z:</span>
            {['ALL', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')].map(char => (
              <button
                key={`quick_${char}`}
                onClick={() => setFilterAlphabet(char)}
                className={`min-w-[26px] h-6.5 px-1.5 rounded-md text-[11px] font-black transition-all flex items-center justify-center shrink-0 cursor-pointer active:scale-95 ${
                  filterAlphabet === char
                    ? 'bg-brand-blue text-white shadow-xs'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                }`}
              >
                {char}
              </button>
            ))}
          </div>
        )}

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
            {(filterAge !== 'all' || filterVerified !== 'all' || filterActivity !== 'all' || filterAlphabet !== 'ALL' || !searchByName || !searchByUsername || !searchByEmail || !searchByPhone) && (
              <div className="flex justify-between items-center pt-2 border-t border-gray-200/60">
                <span className="text-[11px] text-gray-500 font-medium">Filters are active</span>
                <button
                  onClick={() => {
                    setFilterAge('all');
                    setFilterVerified('all');
                    setFilterActivity('all');
                    setFilterAlphabet('ALL');
                    setSearchByName(true);
                    setSearchByUsername(true);
                    setSearchByEmail(true);
                    setSearchByPhone(true);
                  }}
                  className="text-[11px] font-bold text-brand-blue hover:underline cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modern High-Contrast Tabs */}
      <div className="flex border-b border-gray-100 bg-white sticky top-22 z-10 overflow-x-auto no-scrollbar">
        {(['people', 'favourites', 'groups', 'channels'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 text-center py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all capitalize flex items-center justify-center gap-1 shrink-0 px-2 cursor-pointer ${
              activeTab === tab 
                ? 'border-brand-blue text-brand-blue font-bold' 
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab === 'people' ? 'People' : tab === 'favourites' ? (
              <span className="flex items-center gap-1 text-amber-600 font-extrabold">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" /> Favourites
                {favouriteUsers.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-black">{favouriteUsers.length}</span>
                )}
              </span>
            ) : tab === 'groups' ? 'Groups' : 'Channels'}
          </button>
        ))}
      </div>

      {/* View Switcher Bar for User Directory */}
      {(activeTab === 'people' || activeTab === 'favourites') && (
        <div className="px-4 py-2 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-gray-200/80 p-0.5 rounded-xl">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === 'table' 
                  ? 'bg-white text-[#2e7d32] shadow-xs' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Classic User Directory Table View"
            >
              <Table className="w-3.5 h-3.5 text-[#4CAF50]" />
              <span>Table View</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === 'list' 
                  ? 'bg-white text-brand-blue shadow-xs' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Cards & Story View"
            >
              <List className="w-3.5 h-3.5" />
              <span>Cards View</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportUsersCsv(activeTab === 'people' ? filteredUsers : favouriteUsers)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-200 shadow-2xs transition-all cursor-pointer"
              title="Export User Directory as CSV file"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <span className="text-[11px] text-gray-500 font-semibold">
              {activeTab === 'people' ? filteredUsers.length : favouriteUsers.length} users
            </span>
          </div>
        </div>
      )}
      
      {/* List content */}
      <div className="flex flex-col mt-2">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-4">
             <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
             <span className="text-sm text-gray-500 font-medium tracking-tight">Scanning registered users...</span>
          </div>
        ) : activeTab === 'people' ? (
          filteredUsers.length > 0 ? (
            viewMode === 'table' ? (
              renderUserTable(filteredUsers)
            ) : (
            <div className="mt-1 divide-y divide-gray-50">
              {filteredUsers.map((user) => {
                const isFollowing = followingState[user.id];
                const isFav = favouriteIds.includes(user.id) || favouriteIds.includes(user.name);
                const username = user.username || (user?.name || '').toLowerCase().replace(/\s+/g, '_');
                let displayAvatar = user.avatar;
                const isCopied = copiedUserId === user.id;
                const online = isUserOnline(user);
                
                if (user.hideAvatarPublicly && user.id !== auth.currentUser?.uid) {
                  displayAvatar = undefined;
                }

                return (
                  <div 
                    key={user.id} 
                    onClick={() => onUserSelected(user)}
                    className="flex items-center justify-between px-4 py-3 hover:bg-blue-50/20 cursor-pointer active:bg-gray-100 transition-colors group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="relative shrink-0 w-[85px] h-[85px] min-w-[85px] min-h-[85px]">
                        <div className="w-[85px] h-[85px] rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 p-[2px] group-active:scale-95 transition-transform shadow-xs">
                          <UserAvatar 
                            src={displayAvatar} 
                            name={user.name}
                            size="lg"
                            className="!w-full !h-full border-[2px] border-white"
                          />
                        </div>
                        {/* Real-time Online Indicator (Small Green Dot) */}
                        {online ? (
                          <span 
                            className="absolute bottom-0.5 right-0.5 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-sm ring-2 ring-emerald-500/20 flex items-center justify-center z-1" 
                            title="Online now"
                          >
                            <span className="w-1.5 h-1.5 bg-white rounded-full opacity-80"></span>
                          </span>
                        ) : (
                          <span 
                            className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-slate-300 border-2 border-white rounded-full shadow-xs z-1" 
                            title="Offline"
                          />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="font-bold text-[15px] sm:text-[16px] text-gray-900 leading-tight truncate">@{username}</span>
                            {(user.isVerified || (user.email && OWNER_EMAILS.includes(user.email.toLowerCase())) || (user.id === auth.currentUser?.uid && auth.currentUser?.email?.toLowerCase() && OWNER_EMAILS.includes(auth.currentUser.email.toLowerCase()))) && (
                              <BadgeCheck className="w-4 h-4 text-white fill-brand-blue shrink-0" />
                            )}
                          </div>
                          <RoleBadge role={user.role} />
                          {online && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Online
                            </span>
                          )}
                        </div>
                        <span className="text-xs sm:text-sm text-slate-500 font-medium leading-tight mt-0.5 truncate">{user.name}</span>
                        {user.bio && (
                          <p className="text-xs text-gray-500 truncate mt-0.5 hidden sm:block">{user.bio}</p>
                        )}
                      </div>
                    </div>

                    {/* Action button: Follow / Following */}
                    <div className="flex items-center ml-2 shrink-0">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFollow(user.id);
                        }}
                        className={`px-3.5 sm:px-4 py-1.5 text-xs font-bold rounded-xl transition-all active:scale-95 shadow-xs shrink-0 cursor-pointer ${
                          isFollowing 
                            ? 'bg-purple-600 text-white' 
                            : 'bg-brand-blue text-white hover:bg-blue-600'
                        }`}
                      >
                        {isFollowing ? 'Following' : 'Follow'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            )
          ) : (
            <div className="p-16 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-50 rounded-full mb-4">
                <SearchIcon className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-900 font-bold">No registered users found</p>
              <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">Try searching for another name, username, email, or paste a user profile link.</p>
              <button
                onClick={() => {
                  setSearch('');
                  setFilterAlphabet('ALL');
                  setFilterAge('all');
                  setFilterVerified('all');
                }}
                className="mt-4 px-4 py-2 bg-brand-blue text-white font-bold text-xs rounded-xl shadow-md hover:bg-blue-600 transition-all cursor-pointer"
              >
                Clear Search
              </button>
            </div>
          )
        ) : activeTab === 'favourites' ? (
          favouriteUsers.length > 0 ? (
            viewMode === 'table' ? (
              renderUserTable(favouriteUsers)
            ) : (
            <div className="mt-1 divide-y divide-gray-50">
              <div className="px-4 py-2 bg-amber-50/80 border-b border-amber-100 flex items-center justify-between text-amber-900">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                  Your Favourite Contacts ({favouriteUsers.length})
                </span>
                <span className="text-[11px] text-amber-700/80 font-medium">Quick Directory</span>
              </div>

              {favouriteUsers.map((user) => {
                const username = user.username || (user?.name || '').toLowerCase().replace(/\s+/g, '_');
                let displayAvatar = user.avatar;
                const online = isUserOnline(user);

                return (
                  <div 
                    key={user.id} 
                    onClick={() => onUserSelected(user)}
                    className="flex items-center justify-between px-4 py-3.5 hover:bg-amber-50/30 cursor-pointer active:bg-amber-100/40 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="relative shrink-0 w-[85px] h-[85px] min-w-[85px] min-h-[85px]">
                        <div className="w-[85px] h-[85px] rounded-full bg-gradient-to-tr from-amber-400 via-amber-500 to-amber-600 p-[2px] shadow-sm">
                          <UserAvatar 
                            src={displayAvatar} 
                            name={user.name}
                            size="lg"
                            className="!w-full !h-full border-[2px] border-white"
                          />
                        </div>
                        {/* Real-time Online Indicator (Small Green Dot) */}
                        {online ? (
                          <span 
                            className="absolute bottom-0.5 right-0.5 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-sm ring-2 ring-emerald-500/20 flex items-center justify-center z-1" 
                            title="Online now"
                          >
                            <span className="w-1.5 h-1.5 bg-white rounded-full opacity-80"></span>
                          </span>
                        ) : (
                          <span 
                            className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-slate-300 border-2 border-white rounded-full shadow-xs z-1" 
                            title="Offline"
                          />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-[16px] text-gray-900 leading-tight truncate">@{username}</span>
                          <RoleBadge role={user.role} />
                          {online && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Online
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-slate-500 font-medium leading-tight mt-0.5 truncate">{user.name}</span>
                        {user.bio && (
                          <span className="text-xs text-amber-800/70 truncate mt-0.5 block">{user.bio}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 ml-2 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.dispatchEvent(new CustomEvent('start-chat', { detail: { id: user.id, name: user.name, avatar: displayAvatar } }));
                          if (onOpenNav) onOpenNav('chats');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1 cursor-pointer active:scale-95"
                        title="Start Chat"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Message</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          FavouriteContactsStore.removeFavourite(user.id);
                          showToast(`Removed @${username} from favourites`);
                        }}
                        className="p-2 rounded-xl bg-amber-100 text-amber-700 hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer shadow-xs"
                        title="Remove from Favourites"
                      >
                        <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            )
          ) : (
            <div className="p-16 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-50 rounded-full mb-4 text-amber-400 border border-amber-200/50">
                <Star className="w-8 h-8 fill-amber-300 opacity-80" />
              </div>
              <p className="text-gray-900 font-bold">No Favourite Contacts Yet</p>
              <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">Click the star icon next to any user in the People list to add them to your Favourite Contacts!</p>
              <button
                onClick={() => setActiveTab('people')}
                className="mt-4 px-4 py-2 bg-brand-blue text-white font-bold text-xs rounded-xl shadow-md hover:bg-blue-600 transition-all cursor-pointer"
              >
                Browse People
              </button>
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
                          className="px-4 py-1.5 bg-brand-blue text-white font-bold text-xs rounded-lg hover:bg-blue-600 active:scale-95 transition shadow-sm cursor-pointer"
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
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-lg active:scale-95 transition cursor-pointer"
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
                        className={`px-4 py-1.5 font-bold text-xs rounded-lg active:scale-95 transition shadow-sm cursor-pointer ${
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
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-lg active:scale-95 transition cursor-pointer"
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

      {/* Global QR Code Scanner Modal */}
      <QRScannerModal
        isOpen={showQrScanner}
        onClose={() => setShowQrScanner(false)}
        onSelectUser={(scanned) => {
          setShowQrScanner(false);
          onUserSelected(scanned as User);
        }}
        onToggleFollow={onToggleFollow}
        followingState={followingState}
      />

      {/* User Profile QR Code Display & Share Modal */}
      {qrModalUser && (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="fixed inset-0" onClick={() => setQrModalUser(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-200 flex flex-col z-10 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900">User Profile QR Code</h3>
                  <p className="text-[11px] text-gray-500">Scan or share to connect instantly</p>
                </div>
              </div>
              <button
                onClick={() => setQrModalUser(null)}
                className="p-2 hover:bg-gray-200 rounded-full text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col items-center text-center">
              <div className="relative mb-3">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 p-[2px] shadow-sm">
                  <UserAvatar
                    src={qrModalUser.avatar}
                    name={qrModalUser.name}
                    size="lg"
                    className="!w-full !h-full border-2 border-white"
                  />
                </div>
              </div>

              <h4 className="font-bold text-base text-gray-900">{qrModalUser.name}</h4>
              <p className="text-xs font-semibold text-purple-600">@{qrModalUser.username || qrModalUser.name.toLowerCase().replace(/\s+/g, '_')}</p>

              {/* QR Code Graphic Frame */}
              <div className="my-4 p-4 bg-white rounded-2xl border-2 border-dashed border-gray-200 shadow-inner flex items-center justify-center">
                {generatedQrDataUrl ? (
                  <img
                    src={generatedQrDataUrl}
                    alt={`QR Code for @${qrModalUser.username || qrModalUser.name}`}
                    className="w-48 h-48 rounded-lg object-contain"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-xs text-gray-400 font-medium">
                    Generating QR Code...
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-500 mb-4 px-4 leading-relaxed">
                Scan this QR code with any camera or the IMChat QR scanner to view this user's profile and start chatting.
              </p>

              {/* Action Buttons */}
              <div className="w-full flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleCopyProfileUrl(qrModalUser)}
                    className="py-2.5 px-3 bg-brand-blue hover:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copy Link</span>
                  </button>

                  <a
                    href={generatedQrDataUrl}
                    download={`${qrModalUser.username || 'user'}_qrcode.png`}
                    className="py-2.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer text-center"
                  >
                    <Download className="w-4 h-4" />
                    <span>Save Image</span>
                  </a>
                </div>

                <button
                  onClick={() => {
                    const profileUser = qrModalUser;
                    setQrModalUser(null);
                    onUserSelected(profileUser);
                  }}
                  className="w-full py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer border border-purple-200"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open Full Profile</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}


