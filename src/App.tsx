/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  Menu, 
  Search, 
  Bell, 
  Settings, 
  BadgeCheck, 
  Sun, 
  CloudSun,
  Grid3X3, 
  PlaySquare, 
  UserSquare2, 
  Film, 
  MessageCircle, 
  PlusSquare, 
  Phone, 
  User,
  Camera,
  X,
  Folder,
  Users,
  Hash,
  TrendingUp,
  Flame,
  Home,
  MessageSquare,
  BotMessageSquare,
  MessageCirclePlus,
  Store,
  CalendarDays,
  HelpCircle,
  Globe,
  ShieldAlert,
  LogOut,
  Wand2,
  Radio,
  Crown,
  Loader2,
  UserCircle2,
  ShieldCheck,
  Smartphone,
  Plus,
  Terminal,
  SlidersHorizontal,
  Mic,
  AlertTriangle,
  ExternalLink,
  Music,
  Link2,
  UploadCloud,
  Gamepad2,
  Newspaper,
  Volume2,
  VolumeX,
  Settings2,
  BellOff,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  ReferenceLine
} from 'recharts';
import { useState, useRef, ChangeEvent, useEffect, useCallback, lazy, Suspense } from 'react';
import { auth, db, handleFirestoreError, OperationType, detectAndCheckGeoblock } from './firebase';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, addDoc, getDocs, getDoc, serverTimestamp, limit, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import AIAssistantIcon from './components/AIAssistantIcon';
import LanguagesIcon from './components/LanguagesIcon';
import SelfieIcon from './components/SelfieIcon';
import UserAvatar from './components/UserAvatar';
import CookieConsentBanner from './components/CookieConsentBanner';
import { uploadToCloudinary } from './lib/cloudinary';
import { COMMUNITY_USERS } from './lib/communityUsers';
import { 
  playNotificationSound, 
  CHIME_OPTIONS, 
  getActiveChime, 
  setActiveChime, 
  isNotificationSoundMuted,
  setGlobalDefaultBell,
  getGlobalDefaultBell
} from './lib/NotificationSound';
import { PostStore } from './lib/PostStore';
import { AutoSyncService } from './services/autoSyncService';

// Lazy loaded components
const UploadReel = lazy(() => import('./UploadReel'));
const SettingsPage = lazy(() => import('./SettingsPage'));
const HomeFeed = lazy(() => import('./HomeFeed')) as React.ComponentType<{
  onNavigate?: (nav: string) => void;
  onUserSelected?: (user: any) => void;
  searchQuery?: string;
  profileImg?: string;
  userSettings?: any;
  userRole?: string;
  onUpdateAvatar?: (url: string) => Promise<void> | void;
  followingState?: Record<string, boolean>;
  onToggleFollow?: (userId: string) => void;
}>;
const UserDirectory = lazy(() => import('./UserDirectory'));
import CallHistory from './CallHistory';
import TrendsPage from './TrendsPage';
import OnlineGamesPage from './OnlineGamesPage';
const ReelsFeed = lazy(() => import('./ReelsFeed'));
const UserProfile = lazy(() => import('./UserProfile'));
const ChatSystem = lazy(() => import('./ChatSystem'));
const ChannelsSystem = lazy(() => import('./ChannelsSystem'));
const AIAssistantSystem = lazy(() => import('./components/AIAssistantSystem'));
const ImageGeneratorPage = lazy(() => import('./ImageGeneratorPage'));
const VideoGenerator = lazy(() => import('./VideoGenerator'));
const MusicGeneratorPage = lazy(() => import('./MusicGeneratorPage'));
const GoLivePage = lazy(() => import('./GoLivePage'));
const GroupsSystem = lazy(() => import('./GroupsSystem'));
const Marketplace = lazy(() => import('./Marketplace'));
const EventCalendar = lazy(() => import('./EventCalendar'));
const SelfieCapture = lazy(() => import('./SelfieCapture'));
const AdminDashboard = lazy(() => import('./AdminDashboard'));
const LinkedInLogin = lazy(() => import('./LinkedInLogin'));
const MembershipPage = lazy(() => import('./MembershipPage'));
const LanguagesPage = lazy(() => import('./LanguagesPage'));
const FAQPage = lazy(() => import('./FAQPage'));
const PolicyPage = lazy(() => import('./PolicyPage'));
const AboutPage = lazy(() => import('./AboutPage'));
const SupportSystem = lazy(() => import('./SupportSystem'));
const SandboxPage = lazy(() => import('./SandboxPage'));
const NewsFeedPage = lazy(() => import('./NewsFeedPage'));
const GradleCompilerLogs = lazy(() => import('./GradleCompilerLogs'));
const ForgotPasswordPage = lazy(() => import('./ForgotPasswordPage'));

import { User as UserModel } from './UserProfile';
import { EventStore } from './lib/EventStore';
import VoiceRecorderCapture from './components/VoiceRecorderCapture';
import { QRScannerModal } from './components/QRScannerModal';
import QRCode from 'qrcode';
import { QrCode, Share2, Copy, Check, Battery, BatteryCharging, BatteryWarning, Zap, Scan, RefreshCw, Activity, Clock } from 'lucide-react';
import { useVoiceSearch } from './hooks/useVoiceSearch';
import { isAuthorizedAdmin, sanitizeUserRole, isDemotedUser } from './lib/adminAccess';

const TelegramChannelIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 26 26" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="15" width="4" height="7" rx="1.5" />
    <rect x="8" y="11" width="4" height="11" rx="1.5" />
    <rect x="14" y="7" width="4" height="15" rx="1.5" />
    <rect x="20" y="3" width="4" height="19" rx="1.5" />
  </svg>
);

const VeoIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11" />
    <rect x="2" y="15" width="14" height="12" rx="3" />
    <path d="M7 10v4" />
    <path d="M5 12h4" />
  </svg>
);

export default function App() {
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [batteryCharging, setBatteryCharging] = useState<boolean>(false);
  const [batteryHistory, setBatteryHistory] = useState<Array<{ minute: number; label: string; level: number }>>([]);
  const [isBatteryModalOpen, setIsBatteryModalOpen] = useState(false);
  const [batteryAlertThreshold, setBatteryAlertThreshold] = useState<number>(() => {
    const saved = localStorage.getItem('batteryAlertThreshold');
    return saved ? parseInt(saved, 10) : 20;
  });
  const [batteryAlertEnabled, setBatteryAlertEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('batteryAlertEnabled');
    return saved === 'true';
  });
  const [batteryNotified, setBatteryNotified] = useState<boolean>(false);
  const [chargeTargetEnabled, setChargeTargetEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('chargeTargetEnabled');
    return saved !== null ? saved === 'true' : true;
  });
  const [chargeTargetThreshold, setChargeTargetThreshold] = useState<number>(() => {
    const saved = localStorage.getItem('chargeTargetThreshold');
    return saved ? parseInt(saved, 10) : 80;
  });
  const [chargeTargetNotified, setChargeTargetNotified] = useState<boolean>(false);
  const [batterySaverEnabled, setBatterySaverEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('batterySaverEnabled');
    return saved === 'true';
  });
  const [batterySyncFrequency, setBatterySyncFrequency] = useState<number>(() => {
    const saved = localStorage.getItem('batterySyncFrequency');
    return saved ? parseInt(saved, 10) : 45;
  });

  const isBatterySaverActive = batterySaverEnabled && batteryLevel !== null && batteryLevel <= 30 && !batteryCharging;

  const [activeTab, setActiveTab] = useState('grid');
  const [activeNav, setActiveNav] = useState(() => {
    try {
      if (typeof window !== 'undefined' && (window.location.hash === '#forgot-password' || window.location.hash === '#reset-password')) {
        return 'forgot-password';
      }
      return localStorage.getItem('activeNav') || 'home';
    } catch (e) {
      return 'home';
    }
  });
  const [incomingInvite, setIncomingInvite] = useState<any | null>(null);
  const [selectedGameIdForJoin, setSelectedGameIdForJoin] = useState<string | undefined>(undefined);
  const OWNER_EMAILS = ['mobilephonesky987@gmail.com', 'contact@imchat.im'];
  const BANNED_EMAIL = 'hello@imchat.app';
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showUploadReel, setShowUploadReel] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [importedVoiceAudio, setImportedVoiceAudio] = useState<{ url: string; blob: Blob; duration: number } | null>(null);
  const [stitchSource, setStitchSource] = useState<any | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [profileImg, setProfileImg] = useState(() => localStorage.getItem('profileImg') || undefined);
  const [followingState, setFollowingState] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('followingState');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.warn('Failed to parse followingState from localStorage', e);
      return {};
    }
  });
  const [viewingUser, setViewingUser] = useState<UserModel | null>(null);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<string>('user');
  const [isSetupComplete, setIsSetupComplete] = useState<boolean>(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLockdown, setIsLockdown] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [userHasMfa, setUserHasMfa] = useState(true);
  const [userHasAvatar, setUserHasAvatar] = useState(true);
  const adminEmails = ['mobilephonesky987@gmail.com', 'contact@imchat.im'];
  const [isProcessingAvatar, setIsProcessingAvatar] = useState(false);
  const [autoOpenEventModal, setAutoOpenEventModal] = useState(false);
  const [showPublicFaq, setShowPublicFaq] = useState(false);
  const [showProfileQrModal, setShowProfileQrModal] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [profileQrCodeUrl, setProfileQrCodeUrl] = useState('');
  const [qrCopied, setQrCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fastProcessImage = (file: File): Promise<Blob | File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const max = 512;
          if (width > height) {
            if (width > max) {
              height *= max / width;
              width = max;
            }
          } else {
            if (height > max) {
              width *= max / height;
              height = max;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.8);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoCapture = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user) {
      setIsProcessingAvatar(true);
      try {
        const fileName = file.name.toLowerCase();
        const isSpecialType = fileName.endsWith('.svg') || 
                              fileName.endsWith('.sgv') || 
                              fileName.endsWith('.gif') || 
                              fileName.endsWith('.mp4') || 
                              file.type.includes('svg') || 
                              file.type.includes('gif') || 
                              file.type.includes('video/') ||
                              file.type.includes('mp4');

        let processedFile: Blob | File = file;
        if (!isSpecialType) {
          processedFile = await fastProcessImage(file);
        }

        const isVideo = fileName.endsWith('.mp4') || file.type.startsWith('video/');
        const res = await uploadToCloudinary(processedFile, isVideo ? 'video' : 'image');
        if (res) {
          await handleUpdateAvatar(res.secure_url);
        }
      } catch (err) {
        console.error("Avatar capture failed:", err);
      } finally {
        setIsProcessingAvatar(false);
      }
    }
  };

  useEffect(() => {
    // ONE TIME FIX
    const fixAnna = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));

        // Delete hacker profile accounts: @st_exact, @st_probe or named ST Exact, ST Probe
        const hackers = usersSnap.docs.filter(d => {
          const nameLower = (d.data().name || '').toLowerCase();
          const usernameLower = (d.data().username || '').toLowerCase();
          return nameLower.includes('st_exact') || nameLower.includes('st_probe') ||
                 usernameLower.includes('st_exact') || usernameLower.includes('st_probe') ||
                 nameLower.includes('st exact') || nameLower.includes('st probe');
        });

        for (const hDoc of hackers) {
          const hUid = hDoc.id;
          console.log(`Deleting hacker document: ${hUid}`);
          await deleteDoc(doc(db, "users", hUid));

          try {
            const postsSnap = await getDocs(query(collection(db, "posts"), where("userId", "==", hUid)));
            for (const pDoc of postsSnap.docs) {
              await deleteDoc(pDoc.ref);
            }
          } catch (pe) {
            console.error("Failed to delete hacker posts", pe);
          }

          if (auth.currentUser && auth.currentUser.uid === hUid) {
            await signOut(auth);
            window.location.reload();
          }
        }

        const qs = usersSnap.docs.filter(d => {
          const n = (d.data().name || "").toLowerCase() + " " + (d.data().username || "").toLowerCase();
          return n.includes("anna_flores") || n.includes("anna") || n.includes("flores");
        });
        const url = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEg0Y-xwlgt32YpHoIAeohhV-iUZN8QyzR7rhhEiS_h3P0LCBquDzS4NtFnMMOftwK-MD1ZoXwEu58Z-AFzYWuzfImu8_HQ5GGhh6g0kMjTkP9vugHxK2F_68WEU8g9ELnGakp7KyDouoHRY_9-y0hWh6Ch7kSBHS3EwX4keNHlIBL9hPn9TOFfrnxjlOqA/s1600/8408349991_f74c45bbe4_c.jpg';
        
        let foundIds = qs.map(d => d.id);
        if (foundIds.length === 0) {
          foundIds = ['Anna_Flores'];
        }

        for (const docSnap of qs) {
          await updateDoc(docSnap.ref, {
            avatar: url,
            avatarUrl: url,
            profileImg: url
          });
        }

        for (const targetId of foundIds) {
          // Upload to Media Storage
          await addDoc(collection(db, 'media'), {
            userId: targetId,
            url: url,
            type: 'image',
            sizeBytes: 1024,
            createdAt: serverTimestamp(),
            source: 'upload'
          });
        }

        const garrettQs = usersSnap.docs.filter(d => {
          const n = (d.data().name || "").toLowerCase() + " " + (d.data().username || "").toLowerCase();
          return n.includes("garrett smith") || n.includes("garrett_smith") || n.includes("garrett _smith");
        });
        const garrettUrl = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjdvvrYW9AeVSf4TV1MjU_wHLi7_hthb53SiKHd9HJcUMfzCsMRPYwSMAdbsMW6lFRMcUbw_99e3Lct_7z4dkFHegLVnVV131_kkK4CSnl8OhySnPwjgjdA71_t22V0RgvqBwkpVtAFh2Zx5vaKsrqR8yvTm7Zwpp9_PSb_SivkHxM9hA5WXp_lXZF1Fos/s1600/img_9_1723247001966.jpg';

        let gFoundIds = garrettQs.map(d => d.id);
        if (gFoundIds.length === 0) {
          gFoundIds = ['Garrett_Smith'];
        }

        for (const docSnap of garrettQs) {
          await updateDoc(docSnap.ref, {
            avatar: garrettUrl,
            avatarUrl: garrettUrl,
            profileImg: garrettUrl
          });
        }

        for (const targetId of gFoundIds) {
          await addDoc(collection(db, 'media'), {
            userId: targetId,
            url: garrettUrl,
            type: 'image',
            sizeBytes: 1024,
            createdAt: serverTimestamp(),
            source: 'upload'
          });
        }

        const kimberlyQs = usersSnap.docs.filter(d => {
          const n = (d.data().name || "").toLowerCase() + " " + (d.data().username || "").toLowerCase();
          return n.includes("kimberly_mgraw") || n.includes("kimberly mgraw") || n.includes("kimberly");
        });
        const kimberlyUrl = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhFNgNudbKpXFVSNQL6aaNYVfUfgDAWsKr5HziGgpha6eI6CCHlJhNUgxPMdRbvGV5oMz9_4vfexZDA-6Qh9S1MrQ1j3L7hFvwTBYxSOW9kT7hblyRd0hRD82S2psqUVwyKW37-4oXGbiFaGurk58S4X2P0usXZsqK1rceJTEvcCcjwEXICwvTMOZ4zCvo/s1600/2314627059_f4565a6d45_b.jpg';

        let kFoundIds = kimberlyQs.map(d => d.id);
        if (kFoundIds.length === 0) {
          kFoundIds = ['Kimberly_MGraw'];
        }

        for (const docSnap of kimberlyQs) {
          await updateDoc(docSnap.ref, {
            avatar: kimberlyUrl,
            avatarUrl: kimberlyUrl,
            profileImg: kimberlyUrl
          });
        }

        for (const targetId of kFoundIds) {
          await addDoc(collection(db, 'media'), {
            userId: targetId,
            url: kimberlyUrl,
            type: 'image',
            sizeBytes: 1024,
            createdAt: serverTimestamp(),
            source: 'upload'
          });
        }

        // Lena Vega seeding
        const lenaQs = usersSnap.docs.filter(d => {
          const n = (d.data().name || "").toLowerCase() + " " + (d.data().username || "").toLowerCase();
          return n.includes("lena") || n.includes("vega");
        });
        const lenaUrl = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEg5j-pPN754Y9YjFKCw9G2SR88RGX3neS785PLQBNvuRt-ekvverINAsFR1Oqk4Wn_OAP4xWuJVSucWCz7QjJLIaJPrilgfuSU6pXI1_5PrG3-riu06lJGMwLHO62i_5nNPGWTNFrDSkAtnnxQy56wN3eCXhQHQHGOlF8-7H0YxypL7alChyphenhypheni2SjOstx5Y/s1600/83431817_601803343948197_3390380263576961024_n.jpg';

        let lFoundIds = lenaQs.map(d => d.id);
        if (lFoundIds.length === 0) {
          lFoundIds = ['Lena_Vega'];
          await setDoc(doc(db, 'users', 'Lena_Vega'), {
            name: 'Lena',
            username: 'Lena_Vega',
            bio: 'Hola! Estoy usando IMChat ❤️✨',
            avatar: lenaUrl,
            avatarUrl: lenaUrl,
            profileImg: lenaUrl,
            isSetupComplete: true,
            createdAt: serverTimestamp()
          });
        }

        for (const docSnap of lenaQs) {
          await updateDoc(docSnap.ref, {
            avatar: lenaUrl,
            avatarUrl: lenaUrl,
            profileImg: lenaUrl
          });
        }

        for (const targetId of lFoundIds) {
          await addDoc(collection(db, 'media'), {
            userId: targetId,
            url: lenaUrl,
            type: 'image',
            sizeBytes: 1024,
            createdAt: serverTimestamp(),
            source: 'upload'
          });
        }

        // Seed community users into Firestore as app members (not robots)
        for (const u of COMMUNITY_USERS) {
          try {
            await setDoc(doc(db, 'users', u.id), {
              name: u.name,
              username: u.username,
              email: u.email,
              password: u.password || (u.id === 'user_amber' || u.email?.toLowerCase() === 'amber@aol.com' ? '77777' : undefined),
              role: u.role || 'user',
              isRobot: false,
              isBot: false,
              isVerified: !!u.isVerified,
              avatar: u.avatar,
              avatarUrl: u.avatar,
              profileImg: u.avatar,
              bio: u.bio || '',
              isSetupComplete: true,
              createdAt: serverTimestamp()
            }, { merge: true });
          } catch (err) {}
        }

        // Purge and delete all robot / bot users from Firestore
        const robotIdsToPurge = [
          'bot_sarah', 'bot_emmy', 'bot_cameron', 'bot_paris', 'bot_debbie',
          'bot_omar', 'bot_chad', 'bot_josh', 'bot_natalia', 'bot_shawn', 
          'bot_biden', 'bot_samantha', 'bot_bruce', 'bot_amber', 'bot_jason', 
          'bot_anthony', 'bot_erik', 'bot_vivian', 'bot_garrett', 'bot_jamie', 
          'bot_bryce', 'bot_gemini', 'bot_ai_assistant', 'bot_support'
        ];
        for (const botId of robotIdsToPurge) {
          try {
            await deleteDoc(doc(db, 'users', botId));
          } catch (err) {}
        }

        // Query and delete any hidden or lingering robot records in Firestore
        try {
          const qRobotRole = query(collection(db, 'users'), where('role', '==', 'robot'));
          const snapRobotRole = await getDocs(qRobotRole);
          for (const docItem of snapRobotRole.docs) {
            await deleteDoc(docItem.ref);
          }
          const qIsRobot = query(collection(db, 'users'), where('isRobot', '==', true));
          const snapIsRobot = await getDocs(qIsRobot);
          for (const docItem of snapIsRobot.docs) {
            await deleteDoc(docItem.ref);
          }
          const qIsBot = query(collection(db, 'users'), where('isBot', '==', true));
          const snapIsBot = await getDocs(qIsBot);
          for (const docItem of snapIsBot.docs) {
            await deleteDoc(docItem.ref);
          }
        } catch (err) {}

      } catch (e) {}
    };
    fixAnna();

    localStorage.setItem('activeNav', activeNav);
    // Reset auto-open when navigating away from calendar
    if (activeNav !== 'calendar') setAutoOpenEventModal(false);
  }, [activeNav]);

  // Support direct hash navigation for password reset
  useEffect(() => {
    const handleHashCheck = () => {
      if (typeof window !== 'undefined' && (window.location.hash === '#forgot-password' || window.location.hash === '#reset-password')) {
        setActiveNav('forgot-password');
      }
    };
    window.addEventListener('hashchange', handleHashCheck);
    return () => window.removeEventListener('hashchange', handleHashCheck);
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Robot activity notifications
    const q = query(collection(db, "notifications"), 
      where("userId", "==", auth.currentUser.uid),
      where("read", "==", false),
      limit(20));
      
    if (isBatterySaverActive) {
      // Reduced refresh rate: Poll every custom batterySyncFrequency seconds instead of real-time onSnapshot to save energy
      let lastDocIds = new Set<string>();
      let isFirstRun = true;

      const fetchPoll = async () => {
        try {
          const querySnapshot = await getDocs(q);
          const newIds = new Set<string>();
          querySnapshot.forEach((docSnap) => {
            newIds.add(docSnap.id);
            if (!isFirstRun && !lastDocIds.has(docSnap.id)) {
              const notif = docSnap.data();
              window.dispatchEvent(new CustomEvent('new-message', {
                detail: { title: 'New Activity', body: notif.text }
              }));
            }
          });
          lastDocIds = newIds;
          isFirstRun = false;
        } catch (error: any) {
          console.warn("Battery saver polling error:", error);
        }
      };

      fetchPoll();
      const intervalMs = Math.max(5, batterySyncFrequency) * 1000;
      const intervalId = setInterval(fetchPoll, intervalMs);
      return () => clearInterval(intervalId);
    } else {
      // Normal real-time listener
      const unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const notif = change.doc.data();
            window.dispatchEvent(new CustomEvent('new-message', {
              detail: { title: 'New Activity', body: notif.text }
            }));
          }
        });
      }, (error) => {
         handleFirestoreError(error, OperationType.GET, "notifications");
      });

      return () => unsubscribe();
    }
  }, [user, isBatterySaverActive, batterySyncFrequency]);

  useEffect(() => {
    try {
      localStorage.setItem('followingState', JSON.stringify(followingState));
    } catch (e) {
      console.warn('Failed to persist followingState to localStorage:', e);
    }
  }, [followingState]);

  const LoadingFallback = () => (
    <div className="flex-1 flex items-center justify-center bg-white/50 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-[#0A66C2] animate-spin" />
        <p className="text-xs font-medium text-gray-500 animate-pulse">Loading IMChat...</p>
      </div>
    </div>
  );

  useEffect(() => {
    if (!user) return;
    // Global System Config Listener (Lockdown & MFA Force)
    const configRef = doc(db, "system_config", "global");
    const unsubscribe = onSnapshot(configRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setIsLockdown(data.lockdown || false);
        setMfaRequired(data.forceMfa || false);
        
        if (data.defaultBellType) {
          setGlobalDefaultBell(data.defaultBellType, data.defaultBellName, data.defaultBellAudioUrl);
        }
        
        // Handle forced logout for lockdown
        if (data.lockdown && user && !adminEmails.includes(user.email?.toLowerCase() || '')) {
          signOut(auth).then(() => {
            alert("The application is currently undergoing security maintenance. Please try again later.");
          }).catch(err => console.error("Sign out during lockdown failed:", err));
        }
      } else if (user && adminEmails.includes(user.email?.toLowerCase() || '')) {
        // Auto-initialize system config if it doesn't exist
        setDoc(configRef, {
          lockdown: false,
          forceMfa: false,
          updatedAt: serverTimestamp()
        }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.UPDATE, "system_config/global"));
      }
    }, (error) => {
      console.warn("System config listener notice (likely auth sync):", error);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (user && mfaRequired && !adminEmails.includes(user.email?.toLowerCase() || '')) {
      // Check if user has MFA enabled in their profile
      const userRef = doc(db, "users", user.uid);
      const unsubUser = onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
          const userData = snap.data();
          setUserHasMfa(userData.mfaEnabled || false);
        }
      }, (error) => {
         console.error("MFA profile check error:", error);
      });
      return () => unsubUser();
    } else {
      setUserHasMfa(true);
    }
  }, [user, mfaRequired]);

  // Listen to game invitations in real-time
  useEffect(() => {
    if (!user || !user.uid || user.uid === 'anonymous') return;

    const q = query(
      collection(db, "game_invitations"),
      where("receiverId", "==", user.uid),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const invite = change.doc.data();
          if (invite && invite.id) {
            // Only show invites that were sent in the last 2 minutes to avoid stale alerts
            const isRecent = Date.now() - (invite.timestamp || 0) < 120000;
            if (isRecent) {
              setIncomingInvite(invite);
            }
          }
        }
      });
    }, (error) => {
      console.error("Firestore game invitations check error:", error);
    });

    return () => unsubscribe();
  }, [user]);

  const handleAcceptIncomingInvite = async (invite: any) => {
    try {
      await setDoc(doc(db, "game_invitations", invite.id), {
        status: 'accepted'
      }, { merge: true });
      
      setIncomingInvite(null);
      setSelectedGameIdForJoin(invite.gameId);
      setActiveNav('games');
    } catch (e) {
      console.error("Error accepting incoming invite:", e);
    }
  };

  const handleDeclineIncomingInvite = async (invite: any) => {
    try {
      await setDoc(doc(db, "game_invitations", invite.id), {
        status: 'declined'
      }, { merge: true });
      setIncomingInvite(null);
    } catch (e) {
      console.error("Error declining incoming invite:", e);
    }
  };

  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    // Listen to following
    const followingQuery = query(collection(db, "follows"), where("followerId", "==", user.uid));
    const unsubFollowing = onSnapshot(followingQuery, (snap) => {
      const state: Record<string, boolean> = {};
      snap.docs.forEach(doc => {
        state[doc.data().followingId] = true;
      });
      setFollowingState(state);
      setFollowingCount(snap.size);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "follows");
    });

    const followersQuery = query(collection(db, "follows"), where("followingId", "==", user.uid));
    const unsubFollowers = onSnapshot(followersQuery, (snap) => {
      setFollowersCount(snap.size);
    });

    return () => {
      unsubFollowing();
      unsubFollowers();
    };
  }, [user]);

  const toggleFollow = async (targetUserId: string) => {
    if (!targetUserId) return;
    const isCurrentlyFollowing = !!followingState[targetUserId];
    
    // Optimistic / Local state update (supports unlimited follows locally and in cloud)
    setFollowingState(prev => {
      const next = { ...prev, [targetUserId]: !isCurrentlyFollowing };
      try {
        localStorage.setItem('followingState', JSON.stringify(next));
      } catch (e) {
        console.warn("Failed to persist followingState to localStorage", e);
      }
      return next;
    });

    if (!user) return; // If guest/unauthenticated, local state toggle is complete!

    try {
      if (isCurrentlyFollowing) {
        // Unfollow
        const q = query(collection(db, "follows"), 
          where("followerId", "==", user.uid), 
          where("followingId", "==", targetUserId)
        );
        const snap = await getDocs(q);
        const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletePromises);
      } else {
        // Follow
        const followId = `${user.uid}_${targetUserId}`;
        
        let targetUserName = "User";
        let targetUserAvatar = "";
        try {
          const targetUserDoc = await getDoc(doc(db, "users", targetUserId));
          if (targetUserDoc.exists()) {
            const tData = targetUserDoc.data();
            targetUserName = tData.name || tData.displayName || "User";
            targetUserAvatar = tData.avatar || tData.photoURL || tData.profileImg || "";
          }
        } catch (e) {
          console.warn("Could not fetch target user profile for follows sync:", e);
        }

        await setDoc(doc(db, "follows", followId), {
          followerId: user.uid,
          followerName: userSettings.name || user.displayName || "Anonymous",
          followerAvatar: profileImg || user.photoURL || "",
          followingId: targetUserId,
          followingName: targetUserName,
          followingAvatar: targetUserAvatar,
          createdAt: serverTimestamp()
        });
        
        // Notify the target user
        await addDoc(collection(db, "notifications"), {
          userId: targetUserId,
          text: `${userSettings.name || user.displayName || 'Someone'} started following you!`,
          type: 'follow',
          read: false,
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error("Follow toggle failed in cloud sync:", err);
    }
  };

  const [profileInitialTab, setProfileInitialTab] = useState('grid');

  const [appName, setAppName] = useState(() => {
    const saved = localStorage.getItem('appName');
    if (saved === 'Yolanda') return 'IMChat';
    return saved || 'IMChat';
  });
  const [appIcon, setAppIcon] = useState(() => localStorage.getItem('appIcon') || '💬');
  const [appFavicon, setAppFavicon] = useState(() => localStorage.getItem('appFavicon') || 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiQBJVFxs5w38N3KpXM8ed1fHT_uBoz97uc8gU7VUGnpEDrhFiIq_f0zob3dweIVTEaF_8Opge3uX_Ed1QVh2ADZCcnyZ2xXwPIX9Nl089uWBxZAjqr0jgSfr6DBReyZKmeyI_6MFuS0RajgWyg0_K2ijPWrtk6VsSo5waSR9HOtf-4hs4BMwtwPh6g6vk/s1600/9519a766-e328-404a-b18e-7b7b6d029a15-removebg-preview~2.png?v=2');
  const [appDescription, setAppDescription] = useState(() => {
    const saved = localStorage.getItem('appDescription');
    if (saved?.includes('Yolanda')) return 'Connect, Share, and Chat with the World';
    return saved || 'Connect, Share, and Chat with the World';
  });
  const [logoPreview, setLogoPreview] = useState(() => {
    const saved = localStorage.getItem('logoPreview');
    const oldUrl = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjDrz3VUTFBaAdoqTsfcRmz6oHkyJQNGDZOqdWw-3BiGZBzCGuzedYset9iWPHWbLWQUnuX6eeyA4nwvvG4Q3AmAbtvPM5MI4hP796lm0fMIh52pDga9qlRP-4lJ7cfsziA2d-E2OV-z2DPF6sCwM_WRW4ZJYrlsUvan_vYNaOBT5YBZnGn5cBgURvChuw/s1600/gtdjjde-removebg-preview.png';
    const newUrl = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiQBJVFxs5w38N3KpXM8ed1fHT_uBoz97uc8gU7VUGnpEDrhFiIq_f0zob3dweIVTEaF_8Opge3uX_Ed1QVh2ADZCcnyZ2xXwPIX9Nl089uWBxZAjqr0jgSfr6DBReyZKmeyI_6MFuS0RajgWyg0_K2ijPWrtk6VsSo5waSR9HOtf-4hs4BMwtwPh6g6vk/s1600/9519a766-e328-404a-b18e-7b7b6d029a15-removebg-preview~2.png';
    if (!saved || saved === oldUrl || saved.includes('gtdjjde')) {
      localStorage.setItem('logoPreview', newUrl);
      return newUrl;
    }
    return saved;
  });

  useEffect(() => {
    if (batteryLevel !== null) {
      setBatteryHistory(prev => {
        if (prev.length > 0) {
          const lastPoint = prev[prev.length - 1];
          if (lastPoint && lastPoint.level === batteryLevel) {
            return prev;
          }
          const updated = prev.slice(1).map(p => ({
            ...p,
            minute: p.minute + 1,
            label: p.minute + 1 === 0 ? 'Now' : `${p.minute + 1}m ago`
          }));
          updated.push({
            minute: 0,
            label: 'Now',
            level: batteryLevel
          });
          return updated;
        }

        const history = [];
        for (let i = 60; i >= 0; i--) {
          let lvl;
          if (batteryCharging) {
            lvl = Math.max(0, Math.min(100, Math.round(batteryLevel - (i * 0.35))));
          } else {
            lvl = Math.max(0, Math.min(100, Math.round(batteryLevel + (i * 0.15))));
          }
          history.push({
            minute: i,
            label: i === 0 ? 'Now' : `${i}m ago`,
            level: lvl
          });
        }
        return history;
      });
    }
  }, [batteryLevel, batteryCharging]);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      let batteryObj: any = null;

      const updateBatteryInfo = (batt: any) => {
        setBatteryLevel(Math.round(batt.level * 100));
        setBatteryCharging(batt.charging);
      };

      (navigator as any).getBattery().then((batt: any) => {
        batteryObj = batt;
        updateBatteryInfo(batt);

        batt.addEventListener('levelchange', () => updateBatteryInfo(batt));
        batt.addEventListener('chargingchange', () => updateBatteryInfo(batt));
      }).catch((e: any) => {
        console.warn("Battery API rejected or inaccessible:", e);
      });

      return () => {
        if (batteryObj) {
          batteryObj.removeEventListener('levelchange', () => updateBatteryInfo(batteryObj));
          batteryObj.removeEventListener('chargingchange', () => updateBatteryInfo(batteryObj));
        }
      };
    } else {
      // Chrome/Android fallback, or if unsupported like Safari, use a friendly average percentage to render indicator
      setBatteryLevel(88);
      setBatteryCharging(false);
    }
  }, []);

  useEffect(() => {
    const handleQuotaExceeded = (e: any) => {
      console.warn("[FIRESTORE QUOTA NOTICE]:", e.detail?.message || "Firestore quota limit reached.");
    };
    window.addEventListener('firestore-quota-exceeded', handleQuotaExceeded);
    return () => {
      window.removeEventListener('firestore-quota-exceeded', handleQuotaExceeded);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('appName', appName);
  }, [appName]);

  useEffect(() => {
    localStorage.setItem('appIcon', appIcon);
  }, [appIcon]);

  useEffect(() => {
    localStorage.setItem('appFavicon', appFavicon);
    
    // Dynamically update favicon
    let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    link.href = appFavicon;
  }, [appFavicon]);

  useEffect(() => {
    localStorage.setItem('appDescription', appDescription);
  }, [appDescription]);

  useEffect(() => {
    localStorage.setItem('logoPreview', logoPreview);
  }, [logoPreview]);
  useEffect(() => {
    // Force branding update and clean old keys
    if (localStorage.getItem('appName') === 'Yolanda') {
      localStorage.setItem('appName', 'IMChat');
    }
  }, []);

  const [notifications, setNotifications] = useState<{ 
    id: string, 
    title: string, 
    body: string, 
    timestamp: Date, 
    read: boolean, 
    showToast?: boolean, 
    senderId?: string,
    avatar?: string,
    chatId?: string,
    isChat?: boolean
  }[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  // Voice-to-text Speech Recognition Search Hook
  const {
    isListening: isVoiceSearching,
    isSupported: isVoiceSupported,
    error: voiceError,
    startListening: startVoiceSearch,
    stopListening: stopVoiceSearch
  } = useVoiceSearch((transcript) => {
    setGlobalSearchQuery(transcript);
    if (activeNav !== 'home' && activeNav !== 'directory' && transcript.trim().length > 0) {
      setActiveNav('home');
    }
  });

  useEffect(() => {
    if (voiceError) {
      alert(voiceError);
    }
  }, [voiceError]);

  const [userSettings, setUserSettings] = useState(() => ({
    name: '',
    surname: '',
    username: '',
    email: '',
    bio: '',
    notifications: true,
    hideAvatarPublicly: false,
    age: 22,
    gender: 'Male',
    phone: '',
    walletBalance: 1500,
    isBusinessAccount: false,
    businessName: '',
    businessCategory: 'Digital Content',
    lowDataMode: false,
    emailMarketing: true,
    emailSecurityAlerts: true,
    emailActivityNotifications: true,
    isFrozen: false,
    city: ''
  }));

  /**
   * Synchronizes local followingState and user profile settings explicitly with Firestore
   * when the app regains network connectivity.
   */
  const syncLocalDataWithFirestore = useCallback(async () => {
    if (!navigator.onLine || !user) return;

    console.log("[Network Sync] Regained connectivity. Synchronizing local followingState and user profile settings with Firestore...");

    // 1. Synchronize user profile settings
    try {
      const userDocRef = doc(db, "users", user.uid);
      let currentSettings = userSettings;
      try {
        const cached = localStorage.getItem(`user_settings_${user.uid}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.settings) {
            currentSettings = { ...currentSettings, ...parsed.settings };
          }
        }
      } catch (e) {
        console.warn("[Network Sync] Could not parse local cached user settings:", e);
      }

      const profilePayload: Record<string, any> = {
        name: currentSettings.name || user.displayName || '',
        surname: currentSettings.surname || '',
        username: currentSettings.username || '',
        email: currentSettings.email || user.email || '',
        bio: currentSettings.bio || '',
        notifications: currentSettings.notifications ?? true,
        hideAvatarPublicly: currentSettings.hideAvatarPublicly ?? false,
        age: currentSettings.age ?? 22,
        gender: currentSettings.gender || 'Male',
        phone: currentSettings.phone || '',
        walletBalance: currentSettings.walletBalance ?? 1500,
        isBusinessAccount: currentSettings.isBusinessAccount ?? false,
        businessName: currentSettings.businessName || '',
        businessCategory: currentSettings.businessCategory || 'Digital Content',
        lowDataMode: currentSettings.lowDataMode ?? false,
        emailMarketing: currentSettings.emailMarketing ?? true,
        emailSecurityAlerts: currentSettings.emailSecurityAlerts ?? true,
        emailActivityNotifications: currentSettings.emailActivityNotifications ?? true,
        isFrozen: currentSettings.isFrozen ?? false,
        city: currentSettings.city || '',
        updatedAt: serverTimestamp()
      };

      if (profileImg) {
        profilePayload.avatar = profileImg;
      }

      await setDoc(userDocRef, profilePayload, { merge: true });
      console.log("[Network Sync] Successfully synchronized user profile settings with Firestore.");
    } catch (err) {
      console.error("[Network Sync] Error syncing user profile settings:", err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }

    // 2. Synchronize followingState
    try {
      let currentFollowingState = followingState;
      try {
        const saved = localStorage.getItem('followingState');
        if (saved) {
          currentFollowingState = JSON.parse(saved);
        }
      } catch (e) {
        console.warn("[Network Sync] Could not parse local cached followingState:", e);
      }

      const followEntries = Object.entries(currentFollowingState);
      for (const [targetUserId, isFollowing] of followEntries) {
        if (!targetUserId) continue;
        const followDocId = `${user.uid}_${targetUserId}`;
        const followRef = doc(db, "follows", followDocId);

        if (isFollowing) {
          let targetUserName = "User";
          let targetUserAvatar = "";
          try {
            const targetUserDoc = await getDoc(doc(db, "users", targetUserId));
            if (targetUserDoc.exists()) {
              const tData = targetUserDoc.data();
              targetUserName = tData.name || tData.displayName || "User";
              targetUserAvatar = tData.avatar || tData.photoURL || tData.profileImg || "";
            }
          } catch (e) {
            console.warn("[Network Sync] Target user fetch notice:", e);
          }

          await setDoc(followRef, {
            followerId: user.uid,
            followerName: userSettings.name || user.displayName || "Anonymous",
            followerAvatar: profileImg || user.photoURL || "",
            followingId: targetUserId,
            followingName: targetUserName,
            followingAvatar: targetUserAvatar,
            createdAt: serverTimestamp()
          }, { merge: true });
        } else {
          await deleteDoc(followRef).catch(() => {});
        }
      }
      console.log("[Network Sync] Successfully synchronized followingState with Firestore.");
    } catch (err) {
      console.error("[Network Sync] Error syncing followingState:", err);
      handleFirestoreError(err, OperationType.WRITE, "follows");
    }
  }, [user, userSettings, profileImg, followingState]);

  // Listen explicitly to network connectivity regaining
  useEffect(() => {
    const handleOnline = () => {
      syncLocalDataWithFirestore();
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [syncLocalDataWithFirestore]);

  const [isGeoBlocked, setIsGeoBlocked] = useState(false);
  const [geoBlockedCountry, setGeoBlockedCountry] = useState('');

  useEffect(() => {
    async function checkBlockedCountry() {
      try {
        const geo = await detectAndCheckGeoblock();
        if (geo.isBlocked) {
          setIsGeoBlocked(true);
          setGeoBlockedCountry(geo.countryName);
          if (auth.currentUser) {
            try {
              await updateDoc(doc(db, "users", auth.currentUser.uid), {
                role: 'banned',
                isBanned: true,
                bannedReason: `Accessing from restricted country: ${geo.countryName}`
              });
            } catch (err) {
              console.error("Auto banning user record failed:", err);
            }
          }
        }
      } catch (e) {
        console.error("Geoblock check error:", e);
      }
    }
    checkBlockedCountry();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    
    if (user.uid === 'guest_user_imchat' || user.email === 'guest@imchat.im') {
      try {
        localStorage.removeItem(`user_settings_${user.uid}`);
        localStorage.removeItem(`user_settings_guest_user_imchat`);
      } catch (e) {}
      signOut(auth);
      setUser(null);
      setAuthLoading(false);
      return;
    }

    // Load cached profile immediately for offline support
    try {
      const cached = localStorage.getItem(`user_settings_${user.uid}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        setUserRole(sanitizeUserRole(parsed.role, user.email));
        setIsSetupComplete(parsed.isSetupComplete ?? true);
        setUserHasAvatar(parsed.hasAvatar ?? false);
        if (parsed.avatarUrl) setProfileImg(parsed.avatarUrl);
        if (parsed.settings) {
          setUserSettings(parsed.settings);
        }
      }
    } catch (e) {
      console.warn("Error reading cached user settings:", e);
    }
    
    // Fetch user profile from Firestore
    const userDocRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.name === 'Guest Tester' || data.username === 'guest' || data.email === 'guest@imchat.im' || user.uid === 'guest_user_imchat') {
          try {
            localStorage.removeItem(`user_settings_${user.uid}`);
            localStorage.removeItem(`user_settings_guest_user_imchat`);
          } catch (e) {}
          signOut(auth);
          setUser(null);
          setAuthLoading(false);
          return;
        }

        const safeRole = sanitizeUserRole(data.role, data.email || user.email);
        setUserRole(safeRole);

        // If user document still has admin or non-user role in Firestore for demoted user, downgrade to 'user'
        if (isDemotedUser(data.email || user.email) && data.role !== 'user') {
          updateDoc(userDocRef, { role: 'user' }).catch(() => {});
        }

        setIsSetupComplete(data.isSetupComplete ?? true);
        setUserHasAvatar(!!data.avatar);
        const settings = {
          name: data.name || '',
          surname: data.surname || '',
          username: data.username || '',
          email: data.email || user.email || '',
          bio: data.bio || '',
          notifications: data.notifications ?? true,
          hideAvatarPublicly: data.hideAvatarPublicly ?? false,
          age: data.age ?? 22,
          gender: data.gender || 'Male',
          phone: data.phone || '',
          walletBalance: data.walletBalance ?? 1500,
          isBusinessAccount: data.isBusinessAccount ?? false,
          businessName: data.businessName || '',
          businessCategory: data.businessCategory || 'Digital Content',
          lowDataMode: data.lowDataMode ?? false,
          emailMarketing: data.emailMarketing ?? true,
          emailSecurityAlerts: data.emailSecurityAlerts ?? true,
          emailActivityNotifications: data.emailActivityNotifications ?? true,
          selectedStickers: data.selectedStickers || [],
          isFrozen: data.isFrozen ?? false,
          isAvatarLocked: data.isAvatarLocked ?? false,
          city: data.city || ''
        };
        setUserSettings(settings);
        if (data.avatar) {
          setProfileImg(data.avatar);
          localStorage.setItem('profileImg', data.avatar);
        }
        if (data.isAvatarLocked !== undefined) {
          localStorage.setItem('isAvatarLocked', (!!data.isAvatarLocked).toString());
        }

        // Cache the updated profile
        try {
          localStorage.setItem(`user_settings_${user.uid}`, JSON.stringify({
            role: safeRole,
            isSetupComplete: data.isSetupComplete ?? true,
            hasAvatar: !!data.avatar,
            avatarUrl: data.avatar || '',
            settings
          }));
        } catch (e) {
          console.error("Failed to cache user settings:", e);
        }

        // Record last IP
        fetch('/api/ip')
          .then(res => res.json())
          .then(ipData => {
            if (ipData.ip && ipData.ip !== data.lastIp) {
              updateDoc(userDocRef, { lastIp: ipData.ip }).catch(err => {
                console.warn("Failed to update lastIp in Firestore:", err);
                const isQuota = err?.toString()?.toLowerCase()?.includes('quota') || 
                                err?.message?.toLowerCase()?.includes('quota');
                if (isQuota && typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('firestore-quota-exceeded', {
                    detail: { message: "Firestore database daily limits reached." }
                  }));
                }
              });
            }
          })
          .catch(err => console.warn("Failed to fetch IP:", err));

        // Handle Banned Status
        if (data.status === 'banned' && !isAuthorizedAdmin(data.role, user.email)) {
          signOut(auth).then(() => {
            alert("Your account has been banned for violating community guidelines.");
          });
        }

        // ROLE-BASED REDIRECTION (React Guard Pattern)
        // If it's a new user, force them to onboarding (settings)
        if (data.isSetupComplete === false) {
          if (safeRole === 'admin') {
            setActiveNav('admin');
          } else {
            setShowSettings(true);
          }
        }
      } else {
        // Create initial profile if it doesn't exist
        const isOfficialOwner = !isDemotedUser(user.email) && OWNER_EMAILS.includes(user.email?.toLowerCase() || '');
        const backupUsername = user.email ? user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '') : `user_${user.uid.substring(0, 5)}`;
        const initialData = {
          name: user.displayName || 'User',
          email: user.email || '',
          username: backupUsername,
          createdAt: serverTimestamp(),
          role: isOfficialOwner ? 'admin' : 'user',
          isSetupComplete: true 
        };
        setDoc(userDocRef, initialData).catch(err => handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const handleNavEvent = (e: any) => {
      if (e.detail) {
        setActiveNav(e.detail);
        setShowSettings(false);
      }
    };
    window.addEventListener('navigate-nav', handleNavEvent);
    return () => window.removeEventListener('navigate-nav', handleNavEvent);
  }, []);

  // Event Reminders System
  useEffect(() => {
    const checkReminders = () => {
      const events = EventStore.getEvents();
      const now = new Date();
      const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);
      
      const upcomingEvents = events.filter(event => {
        // Only remind about events today that haven't happened yet and are within 15 mins
        if (event.date.toDateString() !== now.toDateString()) return false;
        
        // Parse time format (handles "10:00 AM" or "10:00")
        const timeParts = event.time.split(' ');
        const [hours, minutes] = timeParts[0].split(':').map(Number);
        let eventHours = hours;
        if (timeParts.length > 1) {
          const ampm = timeParts[1].toUpperCase();
          if (ampm === 'PM' && hours < 12) eventHours += 12;
          if (ampm === 'AM' && hours === 12) eventHours = 0;
        }
        
        const eventTime = new Date(now);
        eventTime.setHours(eventHours, minutes, 0, 0);
        
        // Check if event is between now and 15 mins from now
        return eventTime > now && eventTime <= fifteenMinutesFromNow;
      });

      upcomingEvents.forEach(event => {
        // Prevent multiple reminders for same event in same day
        const reminderId = `reminder_${event.id}_${now.toDateString()}`;
        if (!localStorage.getItem(reminderId)) {
          addNotification('Event Reminder', `"${event.title}" is starting at ${event.time}! Click to view.`, 'system');
          localStorage.setItem(reminderId, 'sent');
        }
      });
    };

    // Check immediately and then every minute
    const interval = setInterval(checkReminders, 60000);
    checkReminders();

    return () => clearInterval(interval);
  }, [userSettings.notifications]);

  const handleSettingsSave = async (data: any) => {
    if (!user) return;
    const mergedData = {
      ...userSettings,
      ...data
    };
    setUserSettings(mergedData);
    if (data.avatar) {
      setProfileImg(data.avatar);
      localStorage.setItem('profileImg', data.avatar);
    }
    
    try {
      await setDoc(doc(db, "users", user.uid), {
        ...data,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleUpdateAvatar = async (url: string) => {
    setProfileImg(url);
    localStorage.setItem('profileImg', url);
    setUserHasAvatar(true);
    setIsSetupComplete(true);
    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid), { 
          avatar: url,
          isSetupComplete: true 
        }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      }
    }
  };

  const ownerEmails = ['mobilephonesky987@gmail.com', 'contact@imchat.im'];
  const isAdmin = isAuthorizedAdmin(userRole, user?.email);

  const [showNotifications, setShowNotifications] = useState(false);
  const [showNotificationSoundSettings, setShowNotificationSoundSettings] = useState(false);
  const [activeNotificationChime, setActiveNotificationChime] = useState<string>(getActiveChime);

  useEffect(() => {
    const handleChimeChanged = (e: any) => {
      if (e.detail?.chimeId) {
        setActiveNotificationChime(e.detail.chimeId);
      }
    };
    window.addEventListener('chime-changed', handleChimeChanged);
    return () => window.removeEventListener('chime-changed', handleChimeChanged);
  }, []);

  const addNotification = (
    title: string, 
    body: string, 
    senderId?: string, 
    avatar?: string, 
    chatId?: string, 
    isChat?: boolean
  ) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    const shouldShowToast = userSettings.notifications;
    
    const newNotification = { 
      id, 
      title, 
      body, 
      timestamp: new Date(), 
      read: false, 
      showToast: shouldShowToast,
      senderId,
      avatar,
      chatId,
      isChat
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    
    // Play active notification chime or custom AI music ringtone!
    try {
      playNotificationSound();
    } catch (e) {
      console.warn("Could not play chime", e);
    }
    
    if (shouldShowToast) {
      setTimeout(() => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, showToast: false } : n));
      }, 5500);
    }
    
    setUnreadCount(prev => prev + 1);
  };

  const deleteNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications(prev => {
      const filtered = prev.filter(n => n.id !== id);
      const wasUnread = prev.find(n => n.id === id)?.read === false;
      if (wasUnread) setUnreadCount(c => Math.max(0, c - 1));
      return filtered;
    });
  };

  const toggleRead = (id: string, senderId?: string, chatId?: string, title?: string, avatar?: string) => {
    setNotifications(prev => prev.map(n => {
      if (n.id === id) {
        if (!n.read) setUnreadCount(c => Math.max(0, c - 1));
        return { ...n, read: true, showToast: false }; // Always mark as read and hide toast
      }
      return n;
    }));

    if (chatId || (senderId && senderId !== 'system' && senderId !== 'live')) {
      const targetUserId = senderId || chatId || '';
      window.dispatchEvent(new CustomEvent('start-chat', {
        detail: {
          id: targetUserId,
          name: title || 'Contact',
          avatar: avatar
        }
      }));
      setActiveNav('chats');
      setShowNotifications(false);
      return;
    }

    if (senderId) {
      if (senderId === 'system') {
        setActiveNav('calendar');
        setShowNotifications(false);
        return;
      }
      if (senderId === 'live') {
        setActiveNav('channels');
        setShowNotifications(false);
        return;
      }
      setViewingUser({ id: senderId, name: notifications.find(n => n.id === id)?.title || '' });
      setActiveNav('other_profile');
      setShowNotifications(false);
    }
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
    setShowNotifications(false);
  };

  useEffect(() => {
    localStorage.setItem('batteryAlertThreshold', batteryAlertThreshold.toString());
  }, [batteryAlertThreshold]);

  useEffect(() => {
    localStorage.setItem('batteryAlertEnabled', batteryAlertEnabled.toString());
  }, [batteryAlertEnabled]);

  useEffect(() => {
    localStorage.setItem('chargeTargetEnabled', chargeTargetEnabled.toString());
  }, [chargeTargetEnabled]);

  useEffect(() => {
    localStorage.setItem('chargeTargetThreshold', chargeTargetThreshold.toString());
  }, [chargeTargetThreshold]);

  useEffect(() => {
    localStorage.setItem('batterySaverEnabled', batterySaverEnabled.toString());
  }, [batterySaverEnabled]);

  useEffect(() => {
    localStorage.setItem('batterySyncFrequency', batterySyncFrequency.toString());
  }, [batterySyncFrequency]);

  useEffect(() => {
    const handleSaverSettings = (e: any) => {
      if (e.detail?.syncFrequency !== undefined) {
        setBatterySyncFrequency(Number(e.detail.syncFrequency));
      }
      if (e.detail?.batterySaverEnabled !== undefined) {
        setBatterySaverEnabled(Boolean(e.detail.batterySaverEnabled));
      }
    };
    window.addEventListener('battery-saver-settings-changed', handleSaverSettings);
    return () => window.removeEventListener('battery-saver-settings-changed', handleSaverSettings);
  }, []);

  // Low Battery Threshold Alert
  useEffect(() => {
    if (batteryLevel === null || !batteryAlertEnabled) {
      return;
    }

    if (batteryLevel > batteryAlertThreshold || batteryCharging) {
      setBatteryNotified(false);
      return;
    }

    if (batteryLevel <= batteryAlertThreshold && !batteryCharging && !batteryNotified) {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          try {
            new Notification('Low Battery Alert', {
              body: `Your device battery is low (${batteryLevel}%). Please connect your charger.`,
              icon: logoPreview
            });
          } catch (err) {
            console.error("HTML5 Notification error:", err);
          }
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission();
        }
      }

      addNotification(
        'Low Battery Alert',
        `Your device's battery has dropped below your set threshold to ${batteryLevel}%. Please plug in a charger.`,
        'system'
      );

      setBatteryNotified(true);
    }
  }, [batteryLevel, batteryCharging, batteryAlertEnabled, batteryAlertThreshold, batteryNotified, logoPreview]);

  // Charge Target Alert (Battery Health Preservation)
  useEffect(() => {
    if (batteryLevel === null || !chargeTargetEnabled) {
      return;
    }

    // Reset notified state if device is unplugged or level dropped below target
    if (!batteryCharging || batteryLevel < chargeTargetThreshold) {
      setChargeTargetNotified(false);
      return;
    }

    // When charging and battery level reaches or exceeds the target threshold
    if (batteryCharging && batteryLevel >= chargeTargetThreshold && !chargeTargetNotified) {
      playNotificationSound(getActiveChime());

      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          try {
            new Notification('⚡ Battery Charge Target Reached', {
              body: `Your device has reached ${batteryLevel}% (Target: ${chargeTargetThreshold}%). Disconnect your charger to preserve battery longevity.`,
              icon: logoPreview
            });
          } catch (err) {
            console.error("HTML5 Notification error:", err);
          }
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission();
        }
      }

      addNotification(
        '⚡ Battery Charge Target Reached',
        `Your device battery has reached ${batteryLevel}% (Target: ${chargeTargetThreshold}%). Unplug your charger to protect battery health and cycle lifespan.`,
        'system'
      );

      setChargeTargetNotified(true);
    }
  }, [batteryLevel, batteryCharging, chargeTargetEnabled, chargeTargetThreshold, chargeTargetNotified, logoPreview]);

  const handleToggleBatteryAlert = async (checked: boolean) => {
    if (checked) {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          await Notification.requestPermission();
        }
      }
    }
    setBatteryAlertEnabled(checked);
  };

  const handleToggleChargeTarget = async (checked: boolean) => {
    if (checked) {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          await Notification.requestPermission();
        }
      }
    }
    setChargeTargetEnabled(checked);
  };

  const triggerTestChargeTargetNotification = () => {
    playNotificationSound(getActiveChime());

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification('⚡ Battery Charge Target Reached (Test)', {
            body: `This is a test notification. When plugged in and battery reaches ${chargeTargetThreshold}%, you'll receive this alert to unplug.`,
            icon: logoPreview
          });
        } catch (err) {
          console.error("HTML5 Notification error:", err);
        }
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            try {
              new Notification('⚡ Battery Charge Target Reached (Test)', {
                body: `This is a test notification. When plugged in and battery reaches ${chargeTargetThreshold}%, you'll receive this alert to unplug.`,
                icon: logoPreview
              });
            } catch (err) {
              console.error("HTML5 Notification error:", err);
            }
          }
        });
      }
    }

    addNotification(
      '⚡ Battery Charge Target Reached (Test)',
      `This is a test charge target alert. When charging and battery reaches ${chargeTargetThreshold}%, you will be notified to disconnect the charger to preserve battery longevity.`,
      'system'
    );
  };

  const triggerTestNotification = () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification('IMChat Low Battery Alert (Test)', {
            body: `This is a test low battery notification. Your alert threshold is set to ${batteryAlertThreshold}%.`,
            icon: logoPreview
          });
        } catch (err) {
          console.error("HTML5 Notification error:", err);
        }
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            try {
              new Notification('IMChat Low Battery Alert (Test)', {
                body: `This is a test low battery notification. Your alert threshold is set to ${batteryAlertThreshold}%.`,
                icon: logoPreview
              });
            } catch (err) {
              console.error("HTML5 Notification error:", err);
            }
          }
        });
      }
    }

    addNotification(
      'Low Battery Alert (Test)',
      `This is a test battery alert. You will be notified in real-time when your device battery drops below ${batteryAlertThreshold}%.`,
      'system'
    );
  };

  const markAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true, showToast: false })));
    setUnreadCount(0);
  };

  useEffect(() => {
    const handleNewMessage = (e: any) => {
      if (e?.detail) {
        addNotification(
          e.detail.title || 'New Message', 
          e.detail.body || '', 
          e.detail.senderId,
          e.detail.avatar,
          e.detail.chatId,
          e.detail.isChat !== false
        );
      }
    };
    const handleNavigate = (e: any) => {
      setActiveNav(e.detail);
    };
    const handleNavigateToUser = (e: any) => {
      setViewingUser(e.detail);
      setActiveNav('other_profile');
    };
    const handleOpenQrScanner = () => {
      setShowQrScanner(true);
    };
    window.addEventListener('new-message', handleNewMessage);
    window.addEventListener('navigate-to', handleNavigate);
    window.addEventListener('navigate-to-user', handleNavigateToUser);
    window.addEventListener('open-qr-scanner', handleOpenQrScanner);
    return () => {
      window.removeEventListener('new-message', handleNewMessage);
      window.removeEventListener('navigate-to', handleNavigate);
      window.removeEventListener('navigate-to-user', handleNavigateToUser);
      window.removeEventListener('open-qr-scanner', handleOpenQrScanner);
    };
  }, []);

  useEffect(() => {
    const appLoadTime = Date.now();
    const seenPostIds = new Set<string>();

    // Populate initial seen IDs
    const initialPosts = PostStore.getPosts();
    initialPosts.forEach(p => seenPostIds.add(p.id));

    const unsubscribe = PostStore.subscribe(() => {
      const currentPosts = PostStore.getPosts();
      
      const subscribedJson = localStorage.getItem('imchat_subscribed_trends');
      const subscribed: string[] = subscribedJson ? JSON.parse(subscribedJson) : [];

      if (subscribed.length > 0) {
        currentPosts.forEach(post => {
          if (!seenPostIds.has(post.id)) {
            const isRecent = post.timestamp && (post.timestamp > appLoadTime - 10000); // 10s buffer
            if (isRecent) {
              const caption = (post.caption || '').toLowerCase();
              const matchedTag = subscribed.find(tag => caption.includes(tag.toLowerCase()));
              
              if (matchedTag) {
                addNotification(
                  '🔔 Trending Topic Alert',
                  `New post in "${matchedTag}": "${post.caption}" by ${post.user?.name || 'Anonymous'}`,
                  'system'
                );
              }
            }
          }
        });
      }

      // Keep track of all seen IDs so we don't alert again
      currentPosts.forEach(p => seenPostIds.add(p.id));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u && u.email === BANNED_EMAIL) {
        alert("This email is banned. Your account has been permanently deleted.");
        
        try {
          // Attempt to delete user doc from Firestore
          await deleteDoc(doc(db, "users", u.uid));
        } catch (err) {
          console.error("Cleanup failed:", err);
        }
        
        signOut(auth);
        setUser(null);
        setAuthLoading(false);
      } else if (u) {
        if (u.displayName === 'Guest Tester' || u.email === 'guest@imchat.im' || u.uid === 'guest_user_imchat') {
          signOut(auth);
          setUser(null);
          setAuthLoading(false);
          return;
        }

        // STALE-WHILE-REVALIDATE: Load cached profile immediately before resolving auth state
        try {
          const cached = localStorage.getItem(`user_settings_${u.uid}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.role) setUserRole(parsed.role);
            if (parsed.isSetupComplete !== undefined) setIsSetupComplete(parsed.isSetupComplete);
            if (parsed.hasAvatar !== undefined) setUserHasAvatar(parsed.hasAvatar);
            if (parsed.avatarUrl) setProfileImg(parsed.avatarUrl);
            if (parsed.settings) setUserSettings(parsed.settings);
          }
        } catch (e) {
          console.warn("Error reading cached user settings:", e);
        }

        setUser(u);
        setAuthLoading(false);

        // Update real-time online presence status in Firestore
        try {
          const userRef = doc(db, "users", u.uid);
          setDoc(userRef, {
            isOnline: true,
            presence: 'online',
            lastActive: Date.now(),
            lastSeen: new Date().toISOString()
          }, { merge: true }).catch(() => {});
        } catch (e) {
          console.warn("Presence sync notice:", e);
        }

        // Automatically execute full background scan across all users, media, posts, reels, marketplace, groups & channels upon login/signup
        AutoSyncService.performAppWideBackgroundScan({ force: true, userId: u.uid }).catch(err => {
          console.warn("Auto background scan notice:", err);
        });
      } else {
        if (user?.uid) {
          try {
            setDoc(doc(db, "users", user.uid), {
              isOnline: false,
              presence: 'offline',
              lastActive: Date.now(),
              lastSeen: new Date().toISOString()
            }, { merge: true }).catch(() => {});
          } catch {}
        }
        setUser(null);
        setAuthLoading(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Continuous active session presence heartbeat and visibility listener
  useEffect(() => {
    if (!user || !user.uid) return;

    const userRef = doc(db, "users", user.uid);
    const syncOnline = (isOnline: boolean) => {
      setDoc(userRef, {
        isOnline,
        presence: isOnline ? 'online' : 'offline',
        lastActive: Date.now(),
        lastSeen: new Date().toISOString()
      }, { merge: true }).catch(() => {});
    };

    // Heartbeat every 40 seconds
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncOnline(true);
      }
    }, 40000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncOnline(true);
      }
    };

    const handleBeforeUnload = () => {
      syncOnline(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#0A66C2] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium">Loading IMChat...</p>
        </div>
      </div>
    );
  }

  if (isGeoBlocked || userRole === 'banned') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-6 md:p-12 selection:bg-red-500/30 selection:text-red-200">
        <div className="max-w-md w-full bg-slate-950 border border-red-500/20 p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center space-y-6">
          <div className="inline-flex p-4 bg-red-500/10 text-red-500 rounded-2xl">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">ACCESS DENIED</h1>
          <p className="text-gray-400 text-sm leading-relaxed text-center">
            {userRole === 'banned' 
              ? "Your account has been permanently banned from IMChat due to platform or regional policy violations."
              : `This application suffers compliance restrictions and is not available in your region (${geoBlockedCountry || 'Restricted Area'}).`}
          </p>
          <div className="text-xs text-red-400 font-mono py-1.5 px-3 bg-red-500/5 rounded-xl border border-red-500/10 inline-block">
            ERROR_CODE: GEO_COMPLIANCE_BLOCK
          </div>
          <p className="text-gray-500 text-xs text-center">
            If you believe this is in error, please contact administration or reconnect from an alternate network.
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (showPublicFaq) {
      return (
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center bg-slate-905 bg-slate-900 border-none">
            <div className="w-12 h-12 border-4 border-[#00FFA3] border-t-transparent rounded-full animate-spin"></div>
          </div>
        }>
          <div className="relative min-h-screen bg-[#f0f2f5]">
            <FAQPage onBack={() => setShowPublicFaq(false)} />
          </div>
        </Suspense>
      );
    }

    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-900">
          <div className="w-12 h-12 border-4 border-[#00FFA3] border-t-transparent rounded-full animate-spin"></div>
        </div>
      }>
        <div className="relative min-h-screen">
          <LinkedInLogin 
            onSuccess={() => {}} 
            onShowFaq={() => setShowPublicFaq(true)}
          />
          <CookieConsentBanner />
        </div>
      </Suspense>
    );
  }

  return (
    <>
      {/* Battery Status Modal with Recharts Chart */}
      <AnimatePresence>
        {isBatteryModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setIsBatteryModalOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-[460px] overflow-hidden shadow-2xl border border-gray-100 p-6 flex flex-col gap-5"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2.5 bg-blue-50 text-brand-blue rounded-xl">
                    <Battery className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-extrabold text-gray-900 text-base leading-tight">Battery Telemetry</h3>
                    <p className="text-[11px] text-gray-400 font-medium">Real-time discharge rate monitoring</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsBatteryModalOpen(false)} 
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Summary Indicators */}
              <div className="grid grid-cols-2 gap-3 bg-gray-50/50 p-3.5 rounded-2xl border border-gray-100">
                <div className="flex flex-col gap-0.5 text-left">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Current Charge</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-2xl font-black text-gray-800 leading-none">{batteryLevel !== null ? `${batteryLevel}%` : 'Reading...'}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${batteryCharging ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {batteryCharging ? '⚡ Charging' : 'On Battery'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 text-left">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Charge Target</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-xl font-black text-emerald-600 leading-none">{chargeTargetThreshold}%</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                      chargeTargetEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {chargeTargetEnabled ? 'Active' : 'Off'}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500 font-medium">
                    {batteryCharging 
                      ? (batteryLevel !== null && batteryLevel >= chargeTargetThreshold 
                          ? '✓ Target Reached' 
                          : `${batteryLevel !== null ? Math.max(0, chargeTargetThreshold - batteryLevel) : 0}% to target`) 
                      : 'Unplugged'}
                  </span>
                </div>
              </div>

              {/* Recharts Area Chart */}
              <div className="h-56 w-full pr-1 font-sans text-[10px] text-gray-400">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={batteryHistory}
                    margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="batteryColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={batteryCharging ? '#10B981' : '#3B82F6'} stopOpacity={0.25}/>
                        <stop offset="95%" stopColor={batteryCharging ? '#10B981' : '#3B82F6'} stopOpacity={0.02}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis 
                      dataKey="label" 
                      tickLine={false}
                      axisLine={false}
                      stroke="#9CA3AF"
                      interval={20}
                    />
                    <YAxis 
                      domain={[0, 100]}
                      tickLine={false}
                      axisLine={false}
                      stroke="#9CA3AF"
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 border border-slate-800 text-white rounded-xl p-2.5 shadow-xl flex flex-col gap-0.5">
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest text-left">
                                {data.minute === 0 ? 'Current Time' : `${data.minute} mins ago`}
                              </span>
                              <span className="text-xs font-extrabold text-white text-left">
                                Capacity: {payload[0].value}%
                              </span>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    {chargeTargetEnabled && (
                      <ReferenceLine 
                        y={chargeTargetThreshold} 
                        stroke="#10B981" 
                        strokeDasharray="4 4" 
                        strokeWidth={1.5}
                      />
                    )}
                    {batteryAlertEnabled && (
                      <ReferenceLine 
                        y={batteryAlertThreshold} 
                        stroke="#EF4444" 
                        strokeDasharray="4 4" 
                        strokeWidth={1.5}
                      />
                    )}
                    <Area 
                      type="monotone" 
                      dataKey="level" 
                      stroke={batteryCharging ? '#10B981' : '#3B82F6'} 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#batteryColor)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Charge Target (Battery Health Protection) UI */}
              <div className="border-t border-gray-100 pt-4 flex flex-col gap-3 text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${chargeTargetEnabled ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                      <BatteryCharging className={`w-4 h-4 transition-all ${chargeTargetEnabled && batteryCharging ? 'animate-bounce text-emerald-600' : ''}`} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">Charge Target & Health Protect</span>
                      <span className="text-[10px] text-gray-400 font-medium">Alerts when battery reaches target to prevent overcharging</span>
                    </div>
                  </div>
                  {/* Custom styled switch slider */}
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={chargeTargetEnabled}
                      onChange={(e) => handleToggleChargeTarget(e.target.checked)}
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                <AnimatePresence>
                  {chargeTargetEnabled && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex flex-col gap-3 bg-emerald-50/40 p-3.5 rounded-2xl border border-emerald-100/80 overflow-hidden"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-emerald-950 font-bold">Charge Target Limit</span>
                        <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200 shadow-xs">
                          {chargeTargetThreshold}%
                        </span>
                      </div>

                      {/* Slider */}
                      <div className="flex items-center gap-3 py-0.5">
                        <span className="text-[10px] text-gray-400 font-bold">50%</span>
                        <input 
                          type="range" 
                          min="50" 
                          max="100" 
                          step="5"
                          value={chargeTargetThreshold}
                          onChange={(e) => setChargeTargetThreshold(parseInt(e.target.value, 10))}
                          className="w-full h-1.5 bg-emerald-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                        />
                        <span className="text-[10px] text-gray-400 font-bold">100%</span>
                      </div>

                      {/* Quick Preset Buttons */}
                      <div className="grid grid-cols-5 gap-1.5 pt-0.5">
                        {[
                          { val: 70, label: '70%', tag: 'Eco' },
                          { val: 80, label: '80%', tag: 'Optimal', best: true },
                          { val: 85, label: '85%', tag: 'Balanced' },
                          { val: 90, label: '90%', tag: 'Extended' },
                          { val: 100, label: '100%', tag: 'Full' },
                        ].map(preset => {
                          const isSelected = chargeTargetThreshold === preset.val;
                          return (
                            <button
                              key={preset.val}
                              type="button"
                              onClick={() => setChargeTargetThreshold(preset.val)}
                              className={`py-1.5 px-1 rounded-xl text-center font-bold text-xs transition-all flex flex-col items-center justify-center cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/30'
                                  : 'bg-white text-gray-700 border border-emerald-200/60 hover:bg-emerald-100/50'
                              }`}
                            >
                              <span>{preset.label}</span>
                              <span className={`text-[8px] leading-tight ${isSelected ? 'text-emerald-100 font-medium' : 'text-gray-400'}`}>
                                {preset.tag}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Live charging status indicator */}
                      <div className="p-2.5 bg-white/80 rounded-xl border border-emerald-100 flex items-center justify-between text-[11px]">
                        <span className="text-gray-600 font-medium flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${batteryCharging ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                          Status:
                        </span>
                        <span className="font-bold text-emerald-900">
                          {batteryCharging 
                            ? (batteryLevel !== null && batteryLevel >= chargeTargetThreshold
                                ? '⚡ Target Reached - Disconnect to Protect Battery'
                                : `⚡ Charging: ${batteryLevel}% / ${chargeTargetThreshold}% (${batteryLevel !== null ? Math.max(0, chargeTargetThreshold - batteryLevel) : 0}% remaining)`)
                            : '🔌 Device unplugged (Target armed)'}
                        </span>
                      </div>

                      {/* Battery Health Tip */}
                      <p className="text-[10px] text-emerald-800/80 leading-relaxed bg-emerald-100/40 p-2 rounded-lg border border-emerald-200/40">
                        💡 <strong>Battery Health Tip:</strong> Limiting charge cycles to 80% reduces heat and chemical stress on lithium-ion cells, extending total battery lifespan by up to 3x.
                      </p>

                      <div className="flex items-center justify-between pt-1 border-t border-emerald-200/40">
                        <span className="text-[10px] text-gray-500 font-medium">
                          {typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' 
                            ? '⚠️ Browser alerts need permission' 
                            : '✓ In-app sound & push alerts active'}
                        </span>
                        <button
                          onClick={triggerTestChargeTargetNotification}
                          className="text-[10px] bg-white text-emerald-700 hover:text-emerald-800 font-bold px-2.5 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-50 active:scale-95 transition-all shadow-xs"
                        >
                          Send Test Target Alert
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Threshold Notification System UI */}
              <div className="border-t border-gray-100 pt-4 flex flex-col gap-3 text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className={`w-4 h-4 transition-all ${batteryAlertEnabled ? 'text-blue-600 animate-pulse' : 'text-gray-400'}`} />
                    <span className="text-xs font-bold text-gray-700">Low Battery Alert Notification</span>
                  </div>
                  {/* Custom styled switch slider */}
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={batteryAlertEnabled}
                      onChange={(e) => handleToggleBatteryAlert(e.target.checked)}
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-neutral-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <AnimatePresence>
                  {batteryAlertEnabled && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex flex-col gap-2.5 bg-gray-50/50 p-3 rounded-2xl border border-gray-100 overflow-hidden"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-gray-500 font-semibold">Alert Threshold Percentage</span>
                        <span className="text-xs font-extrabold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100/50">
                          {batteryAlertThreshold}%
                        </span>
                      </div>

                      <div className="flex items-center gap-3 py-1">
                        <span className="text-[10px] text-gray-400 font-bold">5%</span>
                        <input 
                          type="range" 
                          min="5" 
                          max="50" 
                          value={batteryAlertThreshold}
                          onChange={(e) => setBatteryAlertThreshold(parseInt(e.target.value, 10))}
                          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <span className="text-[10px] text-gray-400 font-bold">50%</span>
                      </div>

                      <div className="flex items-center justify-between mt-1 pt-2 border-t border-gray-100/30">
                        <span className="text-[10px] text-gray-400 font-medium">
                          {typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' 
                            ? '⚠️ Click test to request browser alert permission' 
                            : '✓ Active in browser & in-app feed'}
                        </span>
                        <button
                          onClick={triggerTestNotification}
                          className="text-[10px] bg-white text-gray-700 hover:text-blue-600 font-bold px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-blue-100 hover:bg-blue-50/20 active:scale-95 transition-all shadow-sm"
                        >
                          Send Test Alert
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Battery Saver Mode */}
                <div className="border-t border-gray-100 pt-4 flex flex-col gap-3 text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className={`w-4 h-4 transition-all ${batterySaverEnabled ? 'text-amber-500 animate-pulse' : 'text-gray-400'}`} />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-700">Battery Saver Mode</span>
                        <span className="text-[10px] text-gray-400 font-medium">Reduces real-time listener refresh rate when battery is low (&le; 30%)</span>
                      </div>
                    </div>
                    {/* Switch slider */}
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={batterySaverEnabled}
                        onChange={(e) => setBatterySaverEnabled(e.target.checked)}
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-neutral-600 peer-checked:bg-amber-500"></div>
                    </label>
                  </div>
                  {batterySaverEnabled && (
                    <div className="text-[10px] bg-amber-50/70 p-3 rounded-xl border border-amber-200/80 flex flex-col gap-2.5">
                      <div className="flex justify-between items-center font-semibold text-amber-900">
                        <span className="flex items-center gap-1">
                          <Activity className="w-3.5 h-3.5 text-amber-600" />
                          Power Status:
                        </span>
                        <span className={isBatterySaverActive ? "text-amber-700 font-extrabold animate-pulse uppercase bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-300" : "text-gray-500 font-normal"}>
                          {isBatterySaverActive ? `ACTIVE (${batterySyncFrequency < 60 ? `${batterySyncFrequency}s` : `${batterySyncFrequency / 60}m`} POLLING)` : "STANDBY (BATTERY OK)"}
                        </span>
                      </div>

                      {/* Sync Frequency Setting */}
                      <div className="pt-2 border-t border-amber-200/60 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-amber-950 text-xs flex items-center gap-1">
                            <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                            Sync Frequency
                          </span>
                          <span className="font-bold px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-950 text-[10px]">
                            {batterySyncFrequency < 60 ? `${batterySyncFrequency} seconds` : `${batterySyncFrequency / 60} min`}
                          </span>
                        </div>
                        <p className="text-gray-600 leading-tight text-[10px]">
                          Choose how frequently notifications and background data sync when Battery Saver is active:
                        </p>

                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
                          {[
                            { value: 15, label: '15s', subtitle: 'Fast' },
                            { value: 30, label: '30s', subtitle: 'Balanced' },
                            { value: 45, label: '45s', subtitle: 'Default' },
                            { value: 60, label: '1m', subtitle: 'Eco' },
                            { value: 120, label: '2m', subtitle: 'Ultra' },
                            { value: 300, label: '5m', subtitle: 'Max Life' }
                          ].map((opt) => {
                            const isSelected = batterySyncFrequency === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  setBatterySyncFrequency(opt.value);
                                  localStorage.setItem('batterySyncFrequency', opt.value.toString());
                                  window.dispatchEvent(new CustomEvent('battery-saver-settings-changed', {
                                    detail: { syncFrequency: opt.value }
                                  }));
                                }}
                                className={`py-1.5 px-1 rounded-lg border font-bold text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                                  isSelected
                                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs ring-1 ring-amber-500 scale-[1.02]'
                                    : 'bg-white text-gray-700 border-amber-200 hover:bg-amber-100/60 hover:border-amber-300'
                                }`}
                              >
                                <span className="text-xs leading-none">{opt.label}</span>
                                <span className={`text-[8px] leading-none mt-0.5 ${isSelected ? 'text-amber-100 font-medium' : 'text-gray-400 font-normal'}`}>
                                  {opt.subtitle}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <p className="text-gray-600 leading-normal text-[9px] pt-1.5 border-t border-amber-200/50">
                        When battery is low (&le; 30%) and unplugged, notification snapshots will poll every {batterySyncFrequency < 60 ? `${batterySyncFrequency} seconds` : `${batterySyncFrequency / 60} minute(s)`} to conserve CPU and radio energy.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-center text-[10px] text-gray-400 border-t border-gray-100 pt-3 font-medium">
                Uses the Web Battery API. Updates are registered in real-time.
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MFA Enforcement Modal */}
      <AnimatePresence mode="wait">
        {user && mfaRequired && !userHasMfa && activeNav !== 'settings' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl"
            >
              <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                <Smartphone className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-gray-900">MFA Required</h2>
                <p className="text-gray-500 text-sm">To maintain the highest security level on IMChat, all users must enable Two-Factor Authentication. Please set it up in your settings to continue.</p>
              </div>
              <button 
                onClick={() => setActiveNav('settings')}
                className="w-full py-4 bg-[#0A66C2] text-white font-bold rounded-2xl shadow-lg shadow-blue-100 hover:bg-blue-600 active:scale-95 transition-all text-sm"
              >
                Go to Settings
              </button>
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">Security Update IMChat 2026</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col min-h-screen w-full max-w-[500px] mx-auto bg-white shadow-xl relative overflow-hidden">
      {/* Dynamic Gradient for Active State Nav Icons */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="nav-active-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00FFA3" />
            <stop offset="100%" stopColor="#00B8FF" />
          </linearGradient>
        </defs>
      </svg>

      {/* Header */}
      {!['reels', 'chats', 'channels', 'ai', 'ai_image', 'ai_video', 'ai_music', 'group', 'marketplace', 'calendar', 'selfie', 'policy', 'games', 'news'].includes(activeNav) && (
      <header className="bg-brand-blue p-3 flex items-center gap-3 sticky top-0 z-50 shadow-md">
        <Menu 
          className="text-white w-[25px] h-[25px] cursor-pointer hover:opacity-80 active:scale-95 transition-all shrink-0" 
          onClick={() => setIsDrawerOpen(true)} 
        />
        <div className="flex flex-col shrink-0">
          <div className="flex items-center gap-1.5">
            <h1 className="text-white font-bold tracking-tight text-lg leading-tight">{appName}</h1>
          </div>
        </div>
        
        <div 
          className="flex-1 bg-white/10 hover:bg-white/20 transition-all rounded-full flex items-center px-3 py-1.5 gap-2 ml-2 relative" 
        >
          <Search className="text-blue-100 w-4 h-4 shrink-0" />
          <input 
            type="text" 
            value={globalSearchQuery}
            onChange={(e) => {
              setGlobalSearchQuery(e.target.value);
              if (activeNav !== 'home' && activeNav !== 'directory' && e.target.value.length > 0) {
                setActiveNav('home');
              }
            }}
            placeholder="Search posts or users..." 
            className="bg-transparent text-white placeholder-blue-100 outline-none text-sm w-full"
          />
          {globalSearchQuery && (
            <button onClick={() => setGlobalSearchQuery('')} title="Clear search">
              <X className="text-blue-100 w-3 h-3 hover:text-white" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {batteryLevel !== null && (
            <button 
              onClick={() => setIsBatteryModalOpen(true)}
              className="flex items-center gap-1 bg-white/15 px-2.5 py-1 rounded-full text-white text-[11px] font-bold select-none cursor-pointer hover:bg-white/25 transition-all active:scale-95 border border-white/5 shadow-inner"
              title="View Battery Discharge rate chart"
            >
              <span>{batteryLevel}%</span>
            </button>
          )}
          <div className="relative">
            <div className="cursor-pointer" onClick={() => setShowNotifications(!showNotifications)}>
              <Bell className="text-white w-[25px] h-[25px]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold px-1 rounded-full min-w-[16px] h-[16px] flex items-center justify-center border border-brand-blue shadow-sm">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>

            <AnimatePresence>
              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
                  >
                    <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-gray-900">Notifications</h3>
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-blue-50 text-brand-blue border border-blue-100">
                          {notifications.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setShowNotificationSoundSettings(prev => !prev)}
                          title="Notification chime and sound settings"
                          className={`p-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            showNotificationSoundSettings 
                              ? 'bg-blue-600 text-white border-blue-700 shadow-xs' 
                              : activeNotificationChime === 'mute'
                                ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {activeNotificationChime === 'mute' ? (
                            <VolumeX className="w-3.5 h-3.5 text-red-500" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5 text-brand-blue" />
                          )}
                          <span className="text-[10px] font-extrabold hidden xs:inline">
                            {activeNotificationChime === 'mute' ? 'Muted' : 'Sound'}
                          </span>
                        </button>

                        <button 
                          onClick={markAllNotificationsAsRead}
                          className="px-2.5 py-1 bg-blue-50 text-brand-blue rounded-full text-[10px] font-bold hover:bg-blue-100 transition-colors uppercase tracking-wider border border-blue-100 cursor-pointer"
                        >
                          Read All
                        </button>
                        <button 
                          onClick={clearAllNotifications}
                          className={`px-2.5 py-1 ${notifications.length > 0 ? 'bg-red-50 text-red-500 border-red-100 hover:bg-red-100' : 'bg-gray-50 text-gray-400 border-gray-100'} rounded-full text-[10px] font-bold transition-colors uppercase tracking-wider border cursor-pointer`}
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* Notification Chime Sound Settings Panel */}
                    <AnimatePresence>
                      {showNotificationSoundSettings && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-gradient-to-b from-blue-50/70 to-indigo-50/40 border-b border-blue-100 p-3 overflow-hidden text-left"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black text-blue-900 uppercase tracking-wider flex items-center gap-1">
                                <Settings2 className="w-3.5 h-3.5 text-brand-blue" />
                                Notification Sound
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newMode = activeNotificationChime === 'mute' ? 'default_ring_bell' : 'mute';
                                setActiveChime(newMode);
                                setActiveNotificationChime(newMode);
                                if (newMode !== 'mute') {
                                  playNotificationSound(newMode);
                                }
                              }}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all cursor-pointer flex items-center gap-1 ${
                                activeNotificationChime === 'mute'
                                  ? 'bg-red-100 text-red-700 border-red-300'
                                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              {activeNotificationChime === 'mute' ? (
                                <>
                                  <VolumeX className="w-3 h-3 text-red-600" />
                                  Unmute Sound
                                </>
                              ) : (
                                <>
                                  <BellOff className="w-3 h-3 text-gray-500" />
                                  Mute Sound
                                </>
                              )}
                            </button>
                          </div>

                          <p className="text-[10px] text-gray-600 mb-2 leading-tight">
                            Select your favorite notification chime or mute sound completely:
                          </p>

                          <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto pr-1">
                            {CHIME_OPTIONS.map((chime) => {
                              const isSelected = activeNotificationChime === chime.id;
                              return (
                                <button
                                  key={chime.id}
                                  type="button"
                                  onClick={() => {
                                    setActiveChime(chime.id);
                                    setActiveNotificationChime(chime.id);
                                    if (chime.id !== 'mute') {
                                      playNotificationSound(chime.id);
                                    }
                                  }}
                                  className={`w-full p-2 rounded-xl text-left flex items-center justify-between transition-all cursor-pointer border ${
                                    isSelected
                                      ? chime.id === 'mute'
                                        ? 'bg-red-50/90 border-red-300 ring-1 ring-red-400'
                                        : 'bg-white border-blue-500 ring-1 ring-blue-500 shadow-xs'
                                      : 'bg-white/70 border-gray-200/80 hover:bg-white'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-sm shrink-0">{chime.icon}</span>
                                    <div className="min-w-0">
                                      <p className={`text-xs font-bold truncate ${isSelected ? (chime.id === 'mute' ? 'text-red-700' : 'text-blue-900') : 'text-gray-800'}`}>
                                        {chime.name}
                                      </p>
                                      <p className="text-[9px] text-gray-500 truncate">
                                        {chime.description}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {chime.id !== 'mute' && (
                                      <span 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          playNotificationSound(chime.id);
                                        }}
                                        title="Preview Sound"
                                        className="p-1 hover:bg-blue-100 rounded-md text-brand-blue transition-colors cursor-pointer"
                                      >
                                        <Volume2 className="w-3 h-3" />
                                      </span>
                                    )}
                                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                                      isSelected 
                                        ? chime.id === 'mute' 
                                          ? 'border-red-600 bg-red-600 text-white' 
                                          : 'border-blue-600 bg-blue-600 text-white' 
                                        : 'border-gray-300'
                                    }`}>
                                      {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div className="max-h-[400px] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">
                          <Bell className="w-10 h-10 mx-auto mb-2 opacity-20" />
                          <p className="text-sm">No notifications yet</p>
                        </div>
                      ) : (
                        notifications.map(n => (
                          <div 
                            key={n.id} 
                            onClick={() => toggleRead(n.id, n.senderId)}
                            className={`p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors relative cursor-pointer ${!n.read ? 'bg-blue-50/30' : ''}`}
                          >
                            {!n.read && <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-brand-blue rounded-full" />}
                            <div className="flex justify-between items-start gap-2 mb-1">
                              <h4 className={`text-sm font-bold leading-tight ${!n.read ? 'text-gray-900' : 'text-gray-500'}`}>{n.title}</h4>
                              <button 
                                onClick={(e) => deleteNotification(n.id, e)}
                                className="p-1 hover:bg-red-50 rounded-full text-gray-300 hover:text-red-500 transition-all"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <p className="text-xs text-gray-500 line-clamp-2">{n.body}</p>
                            <span className="text-[10px] text-gray-400 mt-2 block font-medium">
                              {n.timestamp instanceof Date ? n.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                    {notifications.length > 0 && (
                      <div className="p-3 bg-gray-50 border-t border-gray-50 text-center">
                        <button className="text-xs font-bold text-gray-500 hover:text-brand-blue transition-colors">
                          View All Activity
                        </button>
                      </div>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>
      )}

      {/* Main Feature Area */}
      <div className="hidden">
        <Suspense fallback={null}>
          <GradleCompilerLogs />
        </Suspense>
      </div>
      <Suspense fallback={<LoadingFallback />}>
            {(activeNav === 'forgot-password' || activeNav === 'reset-password') && (
              <div className="flex-1 overflow-hidden relative">
                <ForgotPasswordPage 
                  onBack={() => {
                    setActiveNav('home');
                    if (window.location.hash) window.location.hash = '';
                  }} 
                />
              </div>
            )}
            {activeNav === 'sandbox' && <div className="flex-1 overflow-hidden relative"><SandboxPage onBack={() => setActiveNav('home')} /></div>}
            {activeNav === 'selfie' && <SelfieCapture onBack={() => setActiveNav('home')} />}
            {activeNav === 'calendar' && <div className="flex-1 overflow-hidden relative"><EventCalendar onBack={() => setActiveNav('home')} defaultIsCreating={autoOpenEventModal} /></div>}
            {activeNav === 'faq' && (
              <div className="flex-1 overflow-hidden relative">
                <FAQPage 
                  onBack={() => setActiveNav('home')} 
                />
              </div>
            )}
            {activeNav === 'policy' && (
              <div className="flex-1 overflow-hidden relative">
                <PolicyPage 
                  onBack={() => setActiveNav('home')} 
                />
              </div>
            )}
            {activeNav === 'about' && (
              <div className="flex-1 overflow-hidden relative">
                <AboutPage 
                  onBack={() => setActiveNav('home')} 
                />
              </div>
            )}
            {activeNav === 'group' && (
              <div className="flex-1 overflow-hidden relative">
                <GroupsSystem 
                  currentUserId={user?.uid || ''}
                  currentUserName={userSettings?.name || 'User'}
                  profileImg={profileImg}
                  followingState={followingState}
                  onToggleFollow={toggleFollow}
                />
              </div>
            )}
            {activeNav === 'marketplace' && (
              <div className="flex-1 overflow-hidden relative">
                <Marketplace 
                  onBack={() => setActiveNav('home')} 
                  currentUserId={user?.uid || ''}
                  currentUserName={userSettings?.name || 'User'}
                  profileImg={profileImg}
                />
              </div>
            )}
            {activeNav === 'membership' && <div className="flex-1 overflow-hidden relative"><MembershipPage onBack={() => setActiveNav('home')} /></div>}
            {activeNav === 'news' && (
              <div className="flex-1 overflow-hidden relative">
                <NewsFeedPage 
                  onBack={() => setActiveNav('home')} 
                  currentUserId={user?.uid || 'anonymous'}
                  currentUserName={userSettings?.name || 'User'}
                  currentUserAvatar={profileImg || 'https://www.w3schools.com/howto/img_avatar.png'}
                />
              </div>
            )}
            {activeNav === 'games' && (
              <div className="flex-1 overflow-hidden relative">
                <OnlineGamesPage 
                  onBack={() => { setSelectedGameIdForJoin(undefined); setActiveNav('home'); }} 
                  currentUserId={user?.uid || 'anonymous'}
                  currentUserName={userSettings?.name || 'Arcade Gamer'}
                  currentUserAvatar={profileImg || 'https://www.w3schools.com/howto/img_avatar.png'}
                  initialGameId={selectedGameIdForJoin}
                />
              </div>
            )}
            {activeNav === 'trends' && (
              <div className="flex-1 overflow-hidden relative">
                <TrendsPage 
                  onBack={() => setActiveNav('home')} 
                  onNavigate={setActiveNav} 
                  followingState={followingState} 
                  onToggleFollow={toggleFollow}
                  onUserSelected={(user: any) => {
                    setViewingUser(user);
                    setActiveNav('other_profile');
                  }}
                />
              </div>
            )}
            {activeNav === 'golive' && <div className="flex-1 overflow-hidden relative"><GoLivePage onBack={() => setActiveNav('home')} onNavigate={setActiveNav} userSettings={userSettings} profileImg={profileImg} /></div>}
            {activeNav === 'ai_video' && <div className="flex-1 overflow-hidden relative"><VideoGenerator onBack={() => setActiveNav('home')} /></div>}
            {activeNav === 'ai_image' && (
              <div className="flex-1 overflow-hidden relative">
                <ImageGeneratorPage onBack={() => setActiveNav('home')} />
              </div>
            )}
            {activeNav === 'ai_music' && (
              <div className="flex-1 overflow-hidden relative">
                <MusicGeneratorPage 
                  onBack={() => setActiveNav('home')} 
                  userSettings={userSettings}
                  profileImg={profileImg}
                  importedVoiceAudio={importedVoiceAudio}
                  clearImportedVoiceAudio={() => setImportedVoiceAudio(null)}
                />
              </div>
            )}
            {activeNav === 'ai' && <div className="flex-1 overflow-hidden relative"><AIAssistantSystem onBack={() => setActiveNav('home')} /></div>}
            {activeNav === 'calls' && (
              <div className="flex-1 overflow-hidden relative">
                <CallHistory 
                  onBack={() => setActiveNav('home')} 
                  onInitCall={(userId, userName, userAvatar, type) => {
                    // Start a chat first, then initiate call
                    window.dispatchEvent(new CustomEvent('start-chat', { 
                      detail: { id: userId, name: userName, avatar: userAvatar, autoCall: type } 
                    }));
                    setActiveNav('chats');
                  }}
                  onVisitProfile={(user) => {
                    setViewingUser({
                      ...user,
                      bio: 'Friend from Calls'
                    });
                    setActiveNav('other_profile');
                  }}
                />
              </div>
            )}
            {activeNav === 'channels' && (
              <div className="flex-1 overflow-hidden relative">
                <ChannelsSystem 
                  currentUserId={user?.uid || ''}
                  currentUserName={userSettings?.name || 'User'}
                />
              </div>
            )}
            {activeNav === 'chats' && (
              <main className="flex-1 overflow-hidden relative bg-white">
                <ChatSystem 
                  currentUserId={user?.uid || ''}
                  currentUserName={userSettings?.name || 'User'}
                  onUpdateAvatar={handleUpdateAvatar}
                  onVisitProfile={(user) => {
                    setViewingUser({
                      ...user,
                      bio: 'Chat participant'
                    });
                    setActiveNav('other_profile');
                  }}
                  onPlayGame={(gameId) => {
                    setSelectedGameIdForJoin(gameId);
                    setActiveNav('games');
                  }}
                />
              </main>
            )}
            {activeNav === 'admin' && (
              <AdminDashboard 
                adminEmails={adminEmails}
                userRole={userRole}
                onBack={() => setActiveNav('home')} 
                onVisitProfile={(user) => {
                  setViewingUser(user);
                  setActiveNav('other_profile');
                }}
                isNewAdmin={!isSetupComplete && userRole === 'admin'}
                onCompleteSetup={() => {
                  if (user) {
                    setDoc(doc(db, "users", user.uid), { isSetupComplete: true }, { merge: true })
                      .catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`));
                  }
                  setActiveNav('home');
                }}
                brandingProps={{
                  appName, setAppName,
                  appIcon, setAppIcon,
                  appFavicon, setAppFavicon,
                  appDescription, setAppDescription,
                  logoPreview, setLogoPreview
                }}
              />
            )}
            {activeNav === 'support' && (
              <SupportSystem 
                onBack={() => setActiveNav('home')} 
                userId={user?.uid || ''}
                userEmail={user?.email || ''}
              />
            )}
            {activeNav === 'languages' && <div className="flex-1 overflow-hidden relative"><LanguagesPage onBack={() => setActiveNav('home')} /></div>}
            {activeNav === 'home' && (
              <HomeFeed 
                onNavigate={setActiveNav} 
                onUserSelected={(user: any) => {
                  setViewingUser(user);
                  setActiveNav('other_profile');
                }}
                searchQuery={globalSearchQuery} 
                profileImg={profileImg}
                userSettings={userSettings}
                userRole={userRole}
                onUpdateAvatar={handleUpdateAvatar}
                followingState={followingState}
                onToggleFollow={toggleFollow}
              />
            )}
            {activeNav === 'directory' && (
              <UserDirectory 
                searchQuery={globalSearchQuery}
                onUserSelected={(user: any) => {
                  setViewingUser(user);
                  setActiveNav('other_profile');
                }}
                followingState={followingState}
                onToggleFollow={toggleFollow}
                onOpenNav={(navId: string) => {
                  setActiveNav(navId);
                }}
              />
            )}
        {activeNav === 'reels' && (
          <ReelsFeed 
            onOpenUpload={() => {
              setStitchSource(null);
              setShowUploadReel(true);
            }} 
            onStitch={(source) => {
              setStitchSource(source);
              setShowUploadReel(true);
            }}
            followingState={followingState}
            onToggleFollow={toggleFollow}
            onUserSelected={(user) => {
              setViewingUser(user);
              setActiveNav('other_profile');
            }}
          />
        )}

        {/* Current User Profile Section */}
        {activeNav === 'profile' && (
          <UserProfile 
            user={null}
            currentUserSettings={userSettings}
            profileImg={profileImg}
            fileInputRef={fileInputRef}
            initialTab={profileInitialTab}
            stats={[
              { label: 'Posts', value: '...' },
              { label: 'Followers', value: followersCount.toString() },
              { label: 'Following', value: followingCount.toString() },
            ]}
            onPhotoCapture={handlePhotoCapture}
            onNavigate={(nav) => {
              if (nav === 'settings') setShowSettings(true);
              else setActiveNav(nav);
            }}
            isAdmin={isAdmin}
            onUpdateAvatar={handleUpdateAvatar}
            isUploading={isProcessingAvatar}
          />
        )}

        {/* Other User Profile Section */}
        {activeNav === 'other_profile' && viewingUser && (
          <UserProfile 
            user={viewingUser}
            profileImg={profileImg}
            stats={[
              { label: 'Posts', value: '...' },
              { label: 'Followers', value: '0' },
              { label: 'Following', value: '0' },
            ]}
            isFollowing={followingState[viewingUser.id] || false}
            onFollowToggle={(id) => toggleFollow(id)}
            onNavigate={(nav) => {
              if (nav === 'settings') setShowSettings(true);
              else setActiveNav(nav);
            }}
            isAdmin={isAdmin}
            onUpdateAvatar={handleUpdateAvatar}
          />
        )}
      </Suspense>

      {/* Hidden File Input for Avatar */}
      <input
        type="file"
        accept="image/jpeg,image/png,image/gif,image/svg+xml,video/mp4,.svg,.sgv,.jpg,.jpeg,.png,.gif,.mp4"
        ref={fileInputRef}
        onChange={handlePhotoCapture}
        className="hidden"
      />

      {/* Bottom Navigation */}
      {activeNav !== 'policy' && (
      <nav className="fixed bottom-0 left-0 right-0 w-full max-w-[500px] mx-auto bg-white border-t border-gray-100 flex items-center justify-around py-2 px-1 z-40">
        {[
          { id: 'reels', icon: Film, label: 'Reels' },
          { id: 'chats', icon: MessageCircle, label: 'Chat' },
          { id: 'add', icon: PlusSquare, label: 'Create' },
          { id: 'calls', icon: Phone, label: 'Calls' },
          { id: 'profile', icon: User, label: 'Profile' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => {
              if (item.id === 'add') {
                setShowCreateMenu(true);
              } else {
                setActiveNav(item.id);
                if (item.id === 'chats') setUnreadCount(0);
              }
            }}
            className={`flex flex-col items-center gap-0.5 min-w-[64px] transition-colors ${
              activeNav === item.id && item.id !== 'add' ? '' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="relative">
              <item.icon 
                className={`w-[25px] h-[25px] ${activeNav === item.id && item.id !== 'add' ? 'stroke-[2.5px]' : 'stroke-2'}`} 
                style={{ stroke: activeNav === item.id && item.id !== 'add' ? 'url(#nav-active-gradient)' : 'currentColor' }}
              />
              {item.id === 'chats' && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold px-1 rounded-full min-w-[16px] h-[16px] flex items-center justify-center border border-white shadow-sm">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <span 
              className="text-[10px] font-medium tracking-tight"
              style={{ 
                background: activeNav === item.id && item.id !== 'add' ? 'linear-gradient(to right, #00FFA3, #00B8FF)' : 'none',
                WebkitBackgroundClip: activeNav === item.id && item.id !== 'add' ? 'text' : 'none',
                WebkitTextFillColor: activeNav === item.id && item.id !== 'add' ? 'transparent' : 'currentColor',
                color: activeNav === item.id && item.id !== 'add' ? 'transparent' : 'inherit'
              }}
            >
              {item.label}
            </span>
          </button>
        ))}
      </nav>
      )}

      {/* Create Menu Modal */}
      <AnimatePresence>
        {showCreateMenu && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <div className="fixed inset-0" onClick={() => setShowCreateMenu(false)} />
            <motion.div 
              initial={{ y: '100%' }} 
              animate={{ y: 0 }} 
              exit={{ y: '100%' }} 
              className="relative w-full max-w-[400px] bg-white rounded-t-[32px] overflow-hidden"
            >
              <div className="p-2 flex flex-col">
                <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto my-3" />
                <h3 className="px-6 py-2 text-lg font-bold text-gray-900">Create new content</h3>
                
                <div className="grid grid-cols-2 gap-2 p-4">
                  <button 
                    onClick={() => {
                      setActiveNav('home');
                      setShowCreateMenu(false);
                      // Scroll to top to show composer
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex flex-col items-center justify-center gap-3 p-6 bg-gray-50 rounded-[24px] hover:bg-blue-50 transition-colors group border border-transparent hover:border-blue-100"
                  >
                    <div className="p-3 bg-white rounded-2xl shadow-sm text-blue-600 group-hover:scale-110 transition-transform">
                      <PlusSquare className="w-6 h-6" />
                    </div>
                    <span className="font-bold text-sm text-gray-700">Create Post</span>
                  </button>

                  <button 
                    onClick={() => {
                      setShowUploadReel(true);
                      setShowCreateMenu(false);
                    }}
                    className="flex flex-col items-center justify-center gap-3 p-6 bg-gray-50 rounded-[24px] hover:bg-purple-50 transition-colors group border border-transparent hover:border-purple-100"
                  >
                    <div className="p-3 bg-white rounded-2xl shadow-sm text-purple-600 group-hover:scale-110 transition-transform">
                      <PlaySquare className="w-6 h-6" />
                    </div>
                    <span className="font-bold text-sm text-gray-700">Reel</span>
                  </button>

                   <button 
                    onClick={() => {
                      setShowVoiceRecorder(true);
                      setShowCreateMenu(false);
                    }}
                    className="flex flex-col items-center justify-center gap-3 p-6 bg-gray-50 rounded-[24px] hover:bg-rose-50 transition-colors group border border-transparent hover:border-rose-100"
                  >
                    <div className="p-3 bg-white rounded-2xl shadow-sm text-rose-600 group-hover:scale-110 transition-transform">
                      <Mic className="w-6 h-6" />
                    </div>
                    <span className="font-bold text-sm text-gray-700">Voice Recorder</span>
                  </button>

                  <button 
                    onClick={() => {
                      setActiveNav('golive');
                      setShowCreateMenu(false);
                    }}
                    className="flex flex-col items-center justify-center gap-3 p-6 bg-gray-50 rounded-[24px] hover:bg-red-50 transition-colors group border border-transparent hover:border-red-100"
                  >
                    <div className="p-3 bg-white rounded-2xl shadow-sm text-red-600 group-hover:scale-110 transition-transform">
                      <Radio className="w-6 h-6" />
                    </div>
                    <span className="font-bold text-sm text-gray-700">Live</span>
                  </button>

                  <button 
                    onClick={() => {
                      setActiveNav('ai_music');
                      setShowCreateMenu(false);
                    }}
                    className="flex flex-col items-center justify-center gap-3 p-6 bg-gray-50 rounded-[24px] hover:bg-emerald-50 transition-colors group border border-transparent hover:border-emerald-100"
                  >
                    <div className="p-3 bg-white rounded-2xl shadow-sm text-emerald-600 group-hover:scale-110 transition-transform">
                      <Music className="w-6 h-6" />
                    </div>
                    <span className="font-bold text-sm text-gray-700">AI Music</span>
                  </button>

                  <button 
                    onClick={() => {
                      setActiveNav('ai_video');
                      setShowCreateMenu(false);
                    }}
                    className="flex flex-col items-center justify-center gap-3 p-6 bg-gray-50 rounded-[24px] hover:bg-violet-50 transition-colors group border border-transparent hover:border-violet-100"
                  >
                    <div className="p-3 bg-white rounded-2xl shadow-sm text-violet-600 group-hover:scale-110 transition-transform">
                      <Film className="w-6 h-6" />
                    </div>
                    <span className="font-bold text-sm text-gray-700">AI Video</span>
                  </button>

                  <button 
                    onClick={async () => {
                      const profileLink = `${window.location.origin}/?profile=${auth.currentUser?.uid || ''}`;
                      try {
                        const qrUrl = await QRCode.toDataURL(profileLink, {
                          width: 300,
                          margin: 2,
                          color: {
                            dark: '#0e172a',
                            light: '#ffffff'
                          }
                        });
                        setProfileQrCodeUrl(qrUrl);
                        setShowProfileQrModal(true);
                        setShowCreateMenu(false);
                      } catch (err) {
                        console.error('Failed to generate QR code:', err);
                      }
                    }}
                    className="flex items-center gap-3 p-4 bg-gray-50 rounded-[20px] hover:bg-emerald-50 transition-all duration-200 group border border-transparent hover:border-emerald-100"
                  >
                    <div className="p-2.5 bg-white rounded-xl shadow-sm text-emerald-600 group-hover:scale-110 transition-transform duration-200">
                      <QrCode className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col items-start text-left">
                      <span className="font-bold text-xs text-gray-800">My QR Code</span>
                      <span className="text-[10px] text-gray-500 font-medium">Share your profile link</span>
                    </div>
                  </button>

                  <button 
                    onClick={() => {
                      setShowCreateMenu(false);
                      setShowQrScanner(true);
                    }}
                    className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-[20px] hover:from-purple-100 hover:to-indigo-100 transition-all duration-200 group border border-purple-100/60"
                  >
                    <div className="p-2.5 bg-white rounded-xl shadow-sm text-purple-600 group-hover:scale-110 transition-transform duration-200">
                      <Scan className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col items-start text-left">
                      <span className="font-bold text-xs text-purple-900">Scan QR Code</span>
                      <span className="text-[10px] text-purple-600 font-medium">Scan to follow instantly</span>
                    </div>
                  </button>
                </div>
                
                <button 
                  onClick={() => setShowCreateMenu(false)}
                  className="mx-4 mb-4 py-4 font-bold text-gray-500 hover:text-gray-700 bg-gray-100 rounded-2xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Suspense fallback={null}>
        <AnimatePresence>
          {showUploadReel && (
            <UploadReel 
              onClose={(submitted) => {
                setShowUploadReel(false);
                setStitchSource(null);
                if (submitted) {
                  setActiveNav('reels');
                }
              }} 
              stitchSource={stitchSource}
              userSettings={userSettings}
              profileImg={profileImg}
            />
          )}
          {showVoiceRecorder && (
            <VoiceRecorderCapture 
              onClose={() => setShowVoiceRecorder(false)} 
              onImportToAiMusic={(data) => {
                setImportedVoiceAudio(data);
                setShowVoiceRecorder(false);
                setActiveNav('ai_music');
              }}
            />
          )}
        </AnimatePresence>
      </Suspense>

      {/* Profile QR Code Modal */}
      <AnimatePresence>
        {showProfileQrModal && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[1500] bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
          >
            {/* Click backdrop to close */}
            <div className="fixed inset-0" onClick={() => setShowProfileQrModal(false)} />
            
            <motion.div 
              initial={{ scale: 0.92, y: 15 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.92, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-150 flex flex-col items-center"
            >
              {/* Header with Close */}
              <div className="w-full p-4 flex items-center justify-between border-b border-gray-100 bg-gray-50/55">
                <div className="flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-emerald-600" />
                  <span className="font-bold text-sm text-gray-800">Profile QR Code</span>
                </div>
                <button 
                  onClick={() => setShowProfileQrModal(false)}
                  className="p-1.5 hover:bg-gray-200 rounded-full transition-colors active:scale-90"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              {/* Body Content */}
              <div className="p-6 flex flex-col items-center text-center w-full">
                {/* User Avatar Circle */}
                <div className="relative -mt-2 mb-4 p-1 bg-white rounded-full shadow-md border-2 border-emerald-100">
                  <UserAvatar 
                    src={profileImg} 
                    name={userSettings?.name || 'User'} 
                    size="xl" 
                    className="!w-24 !h-24 border-2 border-white ring-2 ring-emerald-500/10 text-2xl" 
                  />
                </div>

                <h4 className="font-bold text-base text-gray-900 leading-tight">
                  {userSettings?.name || ''} {userSettings?.surname || ''}
                </h4>
                <p className="text-xs text-gray-500 font-medium mb-5">
                  @{userSettings?.username || 'username'}
                </p>

                {/* QR Code Graphic Frame */}
                <div className="relative group bg-gray-50 p-5 rounded-2xl border border-gray-150 shadow-sm flex items-center justify-center aspect-square w-52 h-52 mb-5 overflow-hidden">
                  <motion.div 
                    animate={{ 
                      backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
                    }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 bg-gradient-to-tr from-emerald-100 via-teal-50 to-emerald-100 opacity-60"
                    style={{ backgroundSize: '200% 200%' }}
                  />
                  {profileQrCodeUrl ? (
                    <img 
                      src={profileQrCodeUrl} 
                      alt="Your Profile QR Code" 
                      className="w-full h-full object-contain rounded-lg shadow-sm relative z-10 bg-white/80 p-2 backdrop-blur-sm"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full text-slate-400 relative z-10">
                      Generating QR Code...
                    </div>
                  )}
                </div>

                <div className="w-full bg-gray-50 rounded-2xl border border-gray-150 p-2.5 mb-5 flex items-center justify-between gap-2 overflow-hidden">
                  <span className="text-[11px] font-semibold text-gray-400 truncate select-all px-1">
                    {`${window.location.origin}/?profile=${auth.currentUser?.uid || ''}`}
                  </span>
                </div>

                {/* Buttons Row */}
                <div className="grid grid-cols-2 gap-2 w-full">
                  <button
                    onClick={async () => {
                      const profileLink = `${window.location.origin}/?profile=${auth.currentUser?.uid || ''}`;
                      try {
                        if (navigator.clipboard) {
                          await navigator.clipboard.writeText(profileLink);
                        } else {
                          const textArea = document.createElement("textarea");
                          textArea.value = profileLink;
                          textArea.style.position = "fixed";
                          document.body.appendChild(textArea);
                          textArea.focus();
                          textArea.select();
                          document.execCommand("copy");
                          document.body.removeChild(textArea);
                        }
                        setQrCopied(true);
                        setTimeout(() => setQrCopied(false), 2000);
                      } catch (err) {
                        console.error('Failed to copy profile link:', err);
                      }
                    }}
                    className="flex items-center justify-center gap-1.5 py-3 rounded-2xl text-xs font-bold transition-all border shrink-0 bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100/70 active:scale-95"
                  >
                    {qrCopied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-500" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>

                  <a
                    href={profileQrCodeUrl}
                    download={`${userSettings?.username || 'profile'}_qrcode.png`}
                    className="flex items-center justify-center gap-1.5 py-3 rounded-2xl text-xs font-bold transition-all border shrink-0 bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100/70 active:scale-95 text-center"
                    onClick={(e) => {
                      if (!profileQrCodeUrl) e.preventDefault();
                    }}
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Save QR</span>
                  </a>
                </div>
                {/* Scan Button to toggle into camera scanner */}
                <button
                  onClick={() => {
                    setShowProfileQrModal(false);
                    setShowQrScanner(true);
                  }}
                  className="w-full mt-3 py-2.5 px-4 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 border border-purple-200/70 transition-all active:scale-95"
                >
                  <Scan className="w-4 h-4 text-purple-600" />
                  <span>Scan Friend's QR Code</span>
                </button>
              </div>

              {/* Footer */}
              <div className="w-full p-4 bg-gray-50 border-t border-gray-100">
                <button 
                  onClick={() => setShowProfileQrModal(false)}
                  className="w-full py-3 bg-gray-900 hover:bg-black text-white rounded-2xl font-bold text-xs active:scale-95 transition-all shadow-md hover:shadow-lg"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global QR Code Scanner Modal */}
      <QRScannerModal
        isOpen={showQrScanner}
        onClose={() => setShowQrScanner(false)}
        onSelectUser={(scannedUser) => {
          setViewingUser(scannedUser);
          setActiveNav('other_profile');
        }}
        onToggleFollow={toggleFollow}
        followingState={followingState}
      />

      {/* Notifications Overlay */}
      <div className="absolute top-16 left-4 right-4 z-[100] pointer-events-none flex flex-col gap-2.5 max-w-md mx-auto">
        <AnimatePresence>
          {notifications.filter(n => n.showToast).map(n => {
            const isLiveNotif = n.senderId === 'live';
            const isChatMessage = n.isChat || (n.senderId && n.senderId !== 'system' && n.senderId !== 'live') || n.chatId;
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, y: -15 }}
                transition={{ type: 'spring', damping: 22, stiffness: 320 }}
                onClick={() => toggleRead(n.id, n.senderId, n.chatId, n.title, n.avatar)}
                className={`backdrop-blur-xl border shadow-2xl rounded-2xl p-3.5 pointer-events-auto flex items-start gap-3 cursor-pointer transition-all duration-200 hover:scale-[1.01] ${
                  isLiveNotif 
                    ? 'bg-red-50/95 border-red-200 hover:bg-red-100/95 ring-2 ring-red-500/20' 
                    : isChatMessage
                    ? 'bg-white/95 border-brand-blue/30 shadow-brand-blue/10 hover:border-brand-blue ring-1 ring-black/5'
                    : 'bg-white/95 border-gray-150 hover:bg-white ring-1 ring-black/5'
                }`}
              >
                {isLiveNotif ? (
                  <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-red-600/20 relative">
                    <span className="absolute inset-x-0 inset-y-0 rounded-full bg-red-600 animate-ping opacity-20" />
                    <Radio className="w-5 h-5 animate-pulse" />
                  </div>
                ) : isChatMessage ? (
                  <div className="relative shrink-0">
                    {n.avatar ? (
                      <img src={n.avatar} alt={n.title} className="w-10 h-10 rounded-full object-cover border border-gray-200 shadow-xs" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-blue to-sky-400 flex items-center justify-center text-white font-bold text-sm shadow-md">
                        {n.title.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-white flex items-center justify-center shadow-xs">
                      <MessageSquare className="w-2.5 h-2.5 text-white" />
                    </div>
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-brand-blue flex items-center justify-center text-white shrink-0 shadow-md">
                    <Bell className="w-5 h-5" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isLiveNotif && (
                        <span className="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse shrink-0">
                          LIVE
                        </span>
                      )}
                      {isChatMessage && (
                        <span className="bg-brand-blue/10 text-brand-blue text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                          Message
                        </span>
                      )}
                      <p className="text-sm font-bold text-gray-900 truncate">{n.title}</p>
                    </div>
                    <span className="text-[10px] text-gray-400 shrink-0 font-medium">Just now</span>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{n.body}</p>
                  {isLiveNotif && (
                    <span className="inline-block mt-1.5 text-[10px] font-extrabold text-red-600 uppercase tracking-widest hover:underline">
                      ÚNETE A LA TRANSMISIÓN / WATCH NOW →
                    </span>
                  )}
                  {isChatMessage && (
                    <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-brand-blue hover:underline">
                      Reply in Chat →
                    </span>
                  )}
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setNotifications(prev => prev.map(nn => nn.id === n.id ? { ...nn, showToast: false } : nn));
                  }}
                  className="text-gray-400 hover:text-gray-600 p-1 shrink-0 rounded-full hover:bg-gray-100 transition-colors"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Side Drawer */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="absolute inset-0 bg-black/50 z-[100]"
            />
            
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
              className="absolute top-0 left-0 bottom-0 w-[75%] max-w-[300px] bg-white z-[110] shadow-2xl flex flex-col"
            >
              <div className="bg-[#2EA6FF] p-6 pb-5 flex flex-col gap-4 text-white relative h-[210px] justify-end">
                <button 
                  onClick={() => setIsDrawerOpen(false)} 
                  className="absolute top-4 right-4 p-1 active:scale-95 transition-transform hover:bg-white/10 rounded-full z-20"
                >
                  <X className="w-[30px] h-[30px] text-white" />
                </button>

                <div className="flex items-center justify-between w-full relative z-10">
                  <div className="flex flex-col gap-3">
                    <UserAvatar 
                      src={profileImg} 
                      name={userSettings.name}
                      size="xl"
                      className="!w-[80px] !h-[80px] border-2 border-white shadow-sm cursor-pointer hover:opacity-80 transition-opacity text-2xl" 
                      onClick={() => {
                        setActiveNav('profile');
                        setIsDrawerOpen(false);
                      }}
                    />
                    <div className="flex flex-col">
                      <span className="font-bold text-lg leading-tight tracking-tight">{userSettings.name} {userSettings.surname}</span>
                      <span className="text-blue-50/90 text-sm">@{userSettings.username || 'user'}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1 self-end select-none">
                    <img 
                      src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEimMOI9p_Y95MXwhBKpOWMPBp2psL5Vg8IdqlHF5w_yYXZr5PdhwldwKWTyiJnL1IP2fcQLll94mQk_Ei_nAd1A7mSWk3Dh-tScDQ85N1Kr_kkyXz1PbgfySfptCRcUO17gz0eomvyQNjSF3b1Lf9yQi70xCtnnDaDcIptI4U2PtLxAg-R3_46rLpOLLqo/s300/7420ae07a59f2687218ebf9caa4d8a5f.gif" 
                      className="w-[50px] h-[50px] object-contain drop-shadow-lg" 
                      alt="Mascot"
                      referrerPolicy="no-referrer"
                    />
                    <span className="text-white text-xs font-bold tracking-wide drop-shadow-sm">
                      {userSettings.city || 'Madrid'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col py-2 flex-1 overflow-y-auto w-full">
                {[
                  { id: 'membership', label: 'Membership', icon: Crown },
                  { id: 'trends', label: 'Trends', icon: Flame },
                  { id: 'home', label: 'Create Post', icon: MessageCirclePlus },
                  { id: 'marketplace', label: 'Marketplace', icon: Store },
                  { id: 'directory', label: 'Explore', icon: Search },
                  { id: 'group', label: 'Groups', icon: Users },
                  { id: 'channels', label: 'Channels', icon: Radio },
                  { id: 'news', label: 'Feeds', iconUrl: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjPC-PLDkmnd_igGVuJHqh86Kehjqq7M9Z-GYhgi8vcvpzufZncmfof5urzSre7EQbkcLu_lXWYiRfqdlg50raMruTbaToMlFtk1il3UH2Qh5O5IquPrDs_GnxVn2agyT27Joa3D5Ijazlo-9XUqqouM6ThMach4CDaQImdmr2sKnHo_Hy1lHMoldHID4U/s1600/storm.png' },
                  { id: 'games', label: 'Games ', icon: Gamepad2 },
                  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
                  { id: 'selfie', label: 'Take Selfie', icon: SelfieIcon },
                  { id: 'ai_music', label: 'AI Music (Lyria)', icon: Music },
                  { id: 'settings', label: 'Settings', icon: SlidersHorizontal },
                  { id: 'about', label: 'About', icon: Info },
                  { id: 'faq', label: 'FAQ', icon: HelpCircle },
                  { id: 'policy', label: 'Data Policy', icon: ShieldCheck },
                  { id: 'languages', label: 'Languages', icon: LanguagesIcon },
                  ...((isAdmin || userRole === 'moderator') ? [{ id: 'admin', label: isAdmin ? 'Admin Panel' : 'Moderator Panel', icon: ShieldAlert }] : []),
                  ...((isAdmin || userRole === 'admin' || userRole === 'content_creator' || userRole === 'creator') ? [{ id: 'aistudio', label: 'AI Studio', icon: Wand2 }] : []),
                  { id: 'logout', label: ' Exit ', icon: LogOut },
                ].map((item) => (
                  <button 
                    key={item.id} 
                    onClick={() => {
                      if (item.id === 'logout') {
                        signOut(auth).catch(err => console.error("Sign out failed:", err));
                      } else if (item.id === 'aistudio') {
                        window.open('https://ai.studio/build', '_blank');
                      } else if (item.id === 'settings') {
                        setShowSettings(true);
                      } else if (item.id === 'media') {
                        setProfileInitialTab('media');
                        setActiveNav('profile');
                      } else {
                        if (item.id === 'profile') setProfileInitialTab('grid');
                        setActiveNav(item.id);
                      }
                      setIsDrawerOpen(false);
                    }}
                    className="w-full flex items-center gap-6 px-5 py-3 hover:bg-gray-100 transition-colors text-left text-gray-700 active:bg-gray-200"
                  >
                    {item.iconUrl ? (
                      <img 
                        src={item.iconUrl} 
                        alt={item.label} 
                        className="w-[25px] h-[25px] object-contain shrink-0" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      item.icon && <item.icon className={`${item.id === 'selfie' ? 'w-[30px] h-[30px]' : 'w-[25px] h-[25px]'} text-gray-500`} />
                    )}
                    <span className="font-medium text-[15px] flex-1">{item.label}</span>
                  </button>
                ))}
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Suspense fallback={null}>
        <AnimatePresence>
          {showSettings && (
            <SettingsPage 
              onClose={() => setShowSettings(false)} 
              initialData={userSettings}
              onSave={handleSettingsSave}
              userRole={userRole}
            />
          )}
        </AnimatePresence>
      </Suspense>

      {/* Real-time Game Invitation Notification Toast */}
      <AnimatePresence>
        {incomingInvite && (
          <motion.div 
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-3xl border border-indigo-100 shadow-2xl z-[1000] p-4 flex flex-col gap-3 overflow-hidden"
          >
            {/* Top Bar with Pulsing Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                <span className="text-[10px] uppercase font-black tracking-wider text-indigo-600">Incoming Invitation</span>
              </div>
              <button 
                onClick={() => handleDeclineIncomingInvite(incomingInvite)}
                className="p-1 hover:bg-gray-100 rounded-full text-gray-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Invite Details */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-tr from-indigo-50 to-blue-50 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-sm">
                {incomingInvite.gameIcon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-500 leading-tight">
                  <span className="font-extrabold text-gray-900">{incomingInvite.senderName || 'A friend'}</span> invites you to play:
                </p>
                <h4 className="text-sm font-black text-indigo-600 leading-none mt-1 truncate">{incomingInvite.gameTitle}</h4>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 mt-1">
              <button
                onClick={() => handleAcceptIncomingInvite(incomingInvite)}
                className="flex-1 py-2 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Gamepad2 className="w-4 h-4" /> Accept & Play
              </button>
              <button
                onClick={() => handleDeclineIncomingInvite(incomingInvite)}
                className="py-2 px-4 bg-gray-50 hover:bg-gray-100 text-gray-600 font-extrabold text-xs rounded-xl border border-gray-100 cursor-pointer"
              >
                Decline
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CookieConsentBanner />
    </div>
    </>
  );
}
