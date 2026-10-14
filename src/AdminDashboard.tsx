import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutGrid, 
  Upload, 
  Save, 
  Palette, 
  Type, 
  ImageIcon, 
  Smile, 
  ArrowLeft, 
  Loader2,
  Users,
  FileText,
  AlertTriangle,
  ShoppingBag,
  Hash,
  Trash2,
  Edit,
  Eye,
  Check,
  Search,
  MoreVertical,
  Plus,
  ShieldCheck,
  MessageSquare,
  BadgeCheck,
  Lock,
  Smartphone,
  ShieldBan,
  Settings as SettingsIcon,
  Globe,
  Ban,
  X,
  ChevronRight,
  Key,
  Copy,
  ExternalLink,
  Sparkles,
  Layers,
  PackageCheck,
  SlidersHorizontal,
  Download,
  CheckCheck,
  Maximize2,
  Bot,
  UserCheck,
  UserX,
  Activity,
  Cpu,
  Flame,
  Radio,
  Sparkle,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Wrench,
  CheckSquare,
  Square,
  Terminal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, addDoc, getDocs, serverTimestamp, query, orderBy, limit, deleteDoc, updateDoc } from 'firebase/firestore';
import { PostStore } from './lib/PostStore';
import { GroupStore } from './lib/GroupStore';
import { MediaStore, MediaItem } from './lib/MediaStorage';
import { COMMUNITY_USERS } from './lib/communityUsers';
import SettingsPage from './SettingsPage';
import { sanitizeUserRole } from './lib/adminAccess';

interface AdminDashboardProps {
  onBack: () => void;
  onVisitProfile?: (user: any) => void;
  isNewAdmin?: boolean;
  onCompleteSetup?: () => void;
  adminEmails: string[];
  userRole?: string;
  brandingProps: {
    appName: string;
    setAppName: (name: string) => void;
    appIcon: string;
    setAppIcon: (icon: string) => void;
    appFavicon: string;
    setAppFavicon: (favicon: string) => void;
    appDescription: string;
    setAppDescription: (desc: string) => void;
    logoPreview: string;
    setLogoPreview: (logo: string) => void;
  };
}

type AdminTab = 'dashboard' | 'branding' | 'users' | 'posts' | 'apk_generator' | 'system_repair' | 'reports' | 'marketplace' | 'groups' | 'channels' | 'security' | 'ip_bans' | 'stickers';

import { uploadToCloudinary } from './lib/cloudinary';
import UserAvatar from './components/UserAvatar';

export default function AdminDashboard({ onBack, onVisitProfile, brandingProps, isNewAdmin, onCompleteSetup, adminEmails, userRole = 'user' }: AdminDashboardProps) {
  const { 
    appName, setAppName, 
    appIcon, setAppIcon, 
    appFavicon, setAppFavicon,
    appDescription, setAppDescription, 
    logoPreview, setLogoPreview 
  } = brandingProps;

  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [isDeletionBlocked, setIsDeletionBlocked] = useState(() => {
    const saved = localStorage.getItem('blockDeletion');
    return saved === null || saved === 'true';
  });

  useEffect(() => {
    const handleToggle = () => {
      const saved = localStorage.getItem('blockDeletion');
      setIsDeletionBlocked(saved === null || saved === 'true');
    };
    window.addEventListener('block-deletion-change', handleToggle);
    return () => window.removeEventListener('block-deletion-change', handleToggle);
  }, []);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editingChannel, setEditingChannel] = useState<any | null>(null);
  const [showNewChannelModal, setShowNewChannelModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any | null>(null);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  
  // Branding UI local state
  const [primaryColor, setPrimaryColor] = useState('#9333ea');
  const [secondaryColor, setSecondaryColor] = useState('#ec4899');
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [memberRoleName, setMemberRoleName] = useState('Member');
  const [allUsersVerified, setAllUsersVerified] = useState(PostStore.isAllVerified());
  const [storePosts, setStorePosts] = useState(PostStore.getPosts());
  const [systemConfig, setSystemConfig] = useState({ lockdown: false, forceMfa: false });
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetEmailSentTo, setResetEmailSentTo] = useState<string | null>(null);
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Users Real State
  const [users, setUsers] = useState<any[]>([]);
  const [bannedIps, setBannedIps] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [adminIp, setAdminIp] = useState<string>('');
  const [userFilterTab, setUserFilterTab] = useState<'all' | 'humans' | 'admins' | 'vips' | 'frozen'>('all');

  // User Content Inspector state (posts, comments, media with bulk moderation)
  const [selectedUserForContent, setSelectedUserForContent] = useState<any | null>(null);
  const [userContentTab, setUserContentTab] = useState<'posts' | 'comments' | 'media'>('posts');
  const [selectedPostIdsForUser, setSelectedPostIdsForUser] = useState<Set<string>>(new Set());
  const [selectedCommentIdsForUser, setSelectedCommentIdsForUser] = useState<Set<string>>(new Set());
  const [selectedMediaIdsForUser, setSelectedMediaIdsForUser] = useState<Set<string>>(new Set());
  const [isDeletingUserContent, setIsDeletingUserContent] = useState(false);

  // Bulk posts selection in general Posts tab
  const [selectedGeneralPostIds, setSelectedGeneralPostIds] = useState<Set<string>>(new Set());
  const [isBulkDeletingGeneralPosts, setIsBulkDeletingGeneralPosts] = useState(false);

  // MediaStore live state
  const [mediaList, setMediaList] = useState<MediaItem[]>(() => MediaStore.getMedia());
  useEffect(() => {
    const updateMedia = () => setMediaList(MediaStore.getMedia());
    const unsubscribe = MediaStore.subscribe(updateMedia);
    return () => unsubscribe();
  }, []);

  // APK Generator State
  const [apkAppName, setApkAppName] = useState(appName || 'IMChat - Social Messenger');
  const [apkPackageName, setApkPackageName] = useState('im.imchat.social');
  const [apkVersionName, setApkVersionName] = useState('1.0.4');
  const [apkVersionCode, setApkVersionCode] = useState(104);
  const [apkTargetSdk, setApkTargetSdk] = useState(34);
  const [apkMinSdk, setApkMinSdk] = useState(24);
  const [apkDisplayMode, setApkDisplayMode] = useState<'standalone' | 'fullscreen' | 'twa'>('twa');
  const [isGeneratingApk, setIsGeneratingApk] = useState(false);
  const [apkSuccessMessage, setApkSuccessMessage] = useState<string | null>(null);

  // System Repair State
  const [repairLogs, setRepairLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] System Health Monitor online.`,
    `[${new Date().toLocaleTimeString()}] Auto-Fixer & Media Cleaner ready.`
  ]);
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairSummary, setRepairSummary] = useState<{ scannedPosts: number; fixedPosts: number; brokenMediaFixed: number; commentsChecked: number } | null>(null);

  // Merge all users: Firestore Registered Users + Community Users
  const allMergedUsers = React.useMemo(() => {
    const userMap = new Map<string, any>();

    // 1. Preload Community Seed Users from COMMUNITY_USERS
    COMMUNITY_USERS.forEach((comm) => {
      if ((comm as any).isRobot || (comm as any).isBot || (comm as any).role === 'robot' || comm.id?.startsWith('bot_')) return;
      userMap.set(comm.id, {
        id: comm.id,
        name: comm.name,
        username: comm.username || comm.name.toLowerCase().replace(/\s+/g, '_'),
        email: comm.email,
        password: comm.password,
        avatar: comm.avatar,
        bio: comm.bio || 'IMChat Community Member',
        role: comm.role || 'user',
        isVerified: !!comm.isVerified,
        isCommunitySeed: true,
        status: 'active',
        isFrozen: false,
      });
    });

    // 2. Overlay Firestore registered users & administrative edits
    users.forEach((u) => {
      if (u.isRobot || u.role === 'robot' || u.id?.startsWith('bot_')) return;
      const sanitizedRole = sanitizeUserRole(u.role, u.email);
      const existing = userMap.get(u.id);
      if (existing) {
        userMap.set(u.id, {
          ...existing,
          ...u,
          role: sanitizedRole,
        });
      } else {
        userMap.set(u.id, {
          ...u,
          role: sanitizedRole,
        });
      }
    });

    return Array.from(userMap.values()).filter(u => !(u.isRobot || u.role === 'robot' || u.id?.startsWith('bot_')));
  }, [users]);

  const userCounts = React.useMemo(() => {
    const total = allMergedUsers.length;
    const humans = allMergedUsers.filter(u => !(u.role === 'admin' || u.role === 'moderator')).length;
    const admins = allMergedUsers.filter(u => u.role === 'admin' || u.role === 'moderator').length;
    const vips = allMergedUsers.filter(u => u.role === 'vip' || u.role === 'content_creator').length;
    const frozen = allMergedUsers.filter(u => u.isFrozen || u.status === 'banned').length;
    return { total, humans, admins, vips, frozen };
  }, [allMergedUsers]);

  const filteredUsers = React.useMemo(() => {
    return allMergedUsers.filter((u) => {
      if (userFilterTab === 'humans' && (u.role === 'admin' || u.role === 'moderator')) return false;
      if (userFilterTab === 'admins' && !(u.role === 'admin' || u.role === 'moderator')) return false;
      if (userFilterTab === 'vips' && !(u.role === 'vip' || u.role === 'content_creator')) return false;
      if (userFilterTab === 'frozen' && !(u.isFrozen || u.status === 'banned')) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        (u.name || '').toLowerCase().includes(term) ||
        (u.email || '').toLowerCase().includes(term) ||
        (u.username || '').toLowerCase().includes(term) ||
        (u.bio || '').toLowerCase().includes(term) ||
        (u.role || '').toLowerCase().includes(term)
      );
    });
  }, [allMergedUsers, userFilterTab, searchTerm]);

  const handleUpdateUserData = async (userId: string, data: any) => {
    try {
      await setDoc(doc(db, "users", userId), data, { merge: true });
      setUsers((prev) => {
        const idx = prev.findIndex((u) => u.id === userId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...data };
          return next;
        }
        return [...prev, { id: userId, ...data }];
      });
      if (editingUser && editingUser.id === userId) {
        setEditingUser((prev: any) => (prev ? { ...prev, ...data } : null));
      }
    } catch (err) {
      console.error("Failed to update user in Firestore:", err);
    }
  };

  useEffect(() => {
    fetch('/api/ip').then(r => r.json()).then(data => setAdminIp(data.ip)).catch(e => console.error(e));
  }, []);

  useEffect(() => {
    const configRef = doc(db, "system_config", "global");
    const unsubscribe = onSnapshot(configRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSystemConfig(data as any);
        if (data.memberRoleName) {
          setMemberRoleName(data.memberRoleName);
        }
      }
    }, (error) => {
      console.error("Admin: System config listener error:", error);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Users
  useEffect(() => {
    const q = query(collection(db, "users"), limit(100));
    const unsubscribe = onSnapshot(q, (snap) => {
      const usersData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(usersData);
      setIsLoadingUsers(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "users");
    });
    return () => unsubscribe();
  }, []);

  // Fetch Channels in Realtime
  useEffect(() => {
    const q = query(collection(db, "channels"), limit(100));
    const unsubscribe = onSnapshot(q, (snap) => {
      const channelData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setChannels(channelData as any);
    }, (err) => {
      console.error("Failed to load channels in administrator:", err);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Banned IPs
  useEffect(() => {
    const q = query(collection(db, "bannedIps"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snap) => {
      const ipData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setBannedIps(ipData);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "bannedIps");
    });
    return () => unsubscribe();
  }, []);

  const toggleLockdown = async () => {
    try {
      await setDoc(doc(db, "system_config", "global"), {
        ...systemConfig,
        lockdown: !systemConfig.lockdown,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error("Failed to toggle lockdown:", err);
      alert("Permission denied. You must be the admin to change security settings.");
    }
  };

  const toggleForceMfa = async () => {
    try {
      await setDoc(doc(db, "system_config", "global"), {
        ...systemConfig,
        forceMfa: !systemConfig.forceMfa,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error("Failed to toggle MFA force:", err);
      alert("Permission denied. You must be the admin to change security settings.");
    }
  };
  
  // Update storePosts when PostStore changes
  useEffect(() => {
    const updatePosts = () => setStorePosts(PostStore.getPosts());
    const unsubscribe = PostStore.subscribe(updatePosts);
    return () => unsubscribe();
  }, []);

  const handleBanIp = async (ip: string, userId?: string) => {
    if (isModerator) {
      alert("Acción no permitida: Los moderadores no pueden prohibir direcciones IP.");
      return;
    }
    if (!ip) {
      alert("No IP address associated with this user.");
      return;
    }
    if (!confirm(`Are you sure you want to ban IP: ${ip}? This will block all access from this address.`)) return;

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin/ban-ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, ip })
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error);

      if (userId) {
        await updateDoc(doc(db, "users", userId), { status: 'banned' });
      }
      alert(`IP address ${ip} has been banned.`);
    } catch (err: any) {
      console.error("Failed to ban IP:", err);
      alert("Error banning IP: " + err.message);
    }
  };

  const handleAdminDeleteUser = async (targetUid: string) => {
    if (isModerator) {
      alert("Acción no permitida: Los moderadores no pueden eliminar cuentas permanentemente.");
      return;
    }
    if (!confirm("Are you sure you want to PERMANENTLY delete this user's authentication and account? This cannot be undone.")) return;

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, targetUid })
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error);

      // Clean up Firestore doc
      await deleteDoc(doc(db, "users", targetUid));
      
      setEditingUser(null);
      alert("User account and authentication deleted successfully.");
    } catch (err: any) {
      console.error("Failed to delete user:", err);
      alert("Error deleting user: " + err.message);
    }
  };

  const handleUnbanIp = async (id: string) => {
    if (!confirm("Unban this IP address?")) return;
    try {
      await deleteDoc(doc(db, "bannedIps", id));
    } catch (err) {
      console.error("Failed to unban IP:", err);
    }
  };

  const handleAdminResetPassword = async (email: string) => {
    if (!email) {
      alert("No email available for this user.");
      return;
    }
    if (!confirm(`Send a password reset email to ${email}?`)) return;

    setIsResettingPassword(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetEmailSentTo(email);
      setTimeout(() => setResetEmailSentTo(null), 5000);
      alert(`Password reset email sent to ${email}`);
    } catch (err: any) {
      console.error("Failed to reset password:", err);
      alert("Failed to send reset email: " + err.message);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleAdminSetRealPassword = async (targetUid: string) => {
    if (!adminNewPassword || adminNewPassword.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    if (!confirm(`Are you sure you want to change the password for this user?`)) return;

    setIsUpdatingPassword(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          targetUid,
          newPassword: adminNewPassword
        })
      });

      const result = await response.json();
      if (result.success) {
        alert("Password updated successfully.");
        setAdminNewPassword('');
      } else {
        throw new Error(result.error || "Failed to update password");
      }
    } catch (err: any) {
      console.error("Admin update password failed:", err);
      alert("Error: " + err.message);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // User Content Moderation Memoized Selectors
  const selectedUserPosts = React.useMemo(() => {
    if (!selectedUserForContent) return [];
    const uid = (selectedUserForContent.id || (selectedUserForContent as any).uid || '').toLowerCase().trim();
    const uname = (selectedUserForContent.name || '').toLowerCase().trim();
    return storePosts.filter(p => {
      const postUid = ((p.user as any)?.id || (p as any).userId || '').toLowerCase().trim();
      const postUname = (p.user?.name || '').toLowerCase().trim();
      return (uid && postUid === uid) || (uname && postUname === uname);
    });
  }, [selectedUserForContent, storePosts]);

  const selectedUserComments = React.useMemo(() => {
    if (!selectedUserForContent) return [];
    return PostStore.getUserComments(selectedUserForContent.id || (selectedUserForContent as any).uid, selectedUserForContent.name);
  }, [selectedUserForContent, storePosts]);

  const selectedUserMedia = React.useMemo(() => {
    if (!selectedUserForContent) return [];
    return MediaStore.getUserMedia(selectedUserForContent.id);
  }, [selectedUserForContent, mediaList]);

  // General filtered posts
  const filteredGeneralPosts = React.useMemo(() => {
    return storePosts.filter(p => 
      (p.caption || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (p?.user?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [storePosts, searchTerm]);

  // Bulk Actions
  const handleBulkDeleteGeneralPosts = async () => {
    if (selectedGeneralPostIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedGeneralPostIds.size} selected posts?`)) return;
    setIsBulkDeletingGeneralPosts(true);
    try {
      const count = await PostStore.deletePostsBulk(Array.from(selectedGeneralPostIds));
      setSelectedGeneralPostIds(new Set());
      alert(`Successfully deleted ${count} posts.`);
    } catch (e: any) {
      alert("Error deleting posts: " + e.message);
    } finally {
      setIsBulkDeletingGeneralPosts(false);
    }
  };

  const handleDeleteUserPostsBulk = async () => {
    if (selectedPostIdsForUser.size === 0) return;
    if (!confirm(`Delete ${selectedPostIdsForUser.size} posts by ${selectedUserForContent?.name}?`)) return;
    setIsDeletingUserContent(true);
    try {
      const count = await PostStore.deletePostsBulk(Array.from(selectedPostIdsForUser));
      setSelectedPostIdsForUser(new Set());
      alert(`Deleted ${count} posts.`);
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setIsDeletingUserContent(false);
    }
  };

  const handleDeleteUserCommentsBulk = async () => {
    if (selectedCommentIdsForUser.size === 0) return;
    if (!confirm(`Delete ${selectedCommentIdsForUser.size} comments by ${selectedUserForContent?.name}?`)) return;
    setIsDeletingUserContent(true);
    try {
      const items = Array.from(selectedCommentIdsForUser).map(key => {
        const [postId, commentId] = key.split(':::');
        return { postId, commentId };
      });
      const count = await PostStore.deleteCommentsBulk(items);
      setSelectedCommentIdsForUser(new Set());
      alert(`Deleted ${count} comments.`);
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setIsDeletingUserContent(false);
    }
  };

  const handleDeleteUserMediaBulk = async () => {
    if (selectedMediaIdsForUser.size === 0) return;
    if (!confirm(`Delete ${selectedMediaIdsForUser.size} media files by ${selectedUserForContent?.name}?`)) return;
    setIsDeletingUserContent(true);
    try {
      const count = await MediaStore.deleteMediaBulk(Array.from(selectedMediaIdsForUser));
      setSelectedMediaIdsForUser(new Set());
      alert(`Deleted ${count} media items.`);
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setIsDeletingUserContent(false);
    }
  };

  const handleNuclearDeleteAllUserContent = async (targetUser: any) => {
    if (!targetUser) return;
    const confirmText = prompt(`NUCLEAR DELETE: This will delete ALL posts, ALL comments, and ALL uploaded media by ${targetUser.name}.\n\nType "DELETE" to confirm:`);
    if (confirmText !== 'DELETE') {
      alert("Operation cancelled.");
      return;
    }
    setIsDeletingUserContent(true);
    try {
      const pCount = await PostStore.deletePostsBulk(selectedUserPosts.map(p => p.id));
      const cCount = await PostStore.deleteUserComments(targetUser.id, targetUser.name);
      const mCount = await MediaStore.deleteMediaBulk(selectedUserMedia.map(m => m.id));
      setSelectedPostIdsForUser(new Set());
      setSelectedCommentIdsForUser(new Set());
      setSelectedMediaIdsForUser(new Set());
      alert(`Nuclear clean finished! Removed: ${pCount} posts, ${cCount} comments, ${mCount} media items.`);
    } catch (e: any) {
      alert("Nuclear clean error: " + e.message);
    } finally {
      setIsDeletingUserContent(false);
    }
  };

  // APK Project generator
  const handleGenerateAndDownloadApkProject = async () => {
    setIsGeneratingApk(true);
    try {
      const zip = new JSZip();
      const pkgPath = apkPackageName.replace(/\./g, '/');
      const safeTitle = (apkAppName || appName || 'IMChat').replace(/[^\w\s]/gi, '').trim() || 'IMChat';
      const appUrl = window.location.origin;

      const manifest = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${apkPackageName}">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.IMChat"
        android:usesCleartextTraffic="true"
        android:hardwareAccelerated="true">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden|smallestScreenSize|screenLayout"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <!-- Digital Asset Links for Google Play Store Trusted Web Activity -->
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="${new URL(appUrl).hostname}" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;

      const mainActivity = `package ${apkPackageName}

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.webkit.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val APP_URL = "${appUrl}"
    private val PERMISSIONS_REQUEST_CODE = 1001

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        checkAndRequestPermissions()

        webView = findViewById(R.id.webView)
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.cacheMode = WebSettings.LOAD_DEFAULT

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return false
                if (uri.host == Uri.parse(APP_URL).host) {
                    return false
                }
                return false
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                request?.grant(request.resources)
            }
        }

        webView.loadUrl(APP_URL)
    }

    private fun checkAndRequestPermissions() {
        val permissions = arrayOf(
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO
        )
        val needed = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (needed.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toTypedArray(), PERMISSIONS_REQUEST_CODE)
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}`;

      const appBuildGradle = `plugins {
    id 'com.android.application'
    id 'org.jetbrains.kotlin.android'
}

android {
    namespace '${apkPackageName}'
    compileSdk ${apkTargetSdk}

    defaultConfig {
        applicationId "${apkPackageName}"
        minSdk ${apkMinSdk}
        targetSdk ${apkTargetSdk}
        versionCode ${apkVersionCode}
        versionName "${apkVersionName}"
        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = '17'
    }
}

dependencies {
    implementation 'androidx.core:core-ktx:1.12.0'
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
    implementation 'androidx.browser:browser:1.8.0'
}`;

      const stringsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${safeTitle}</string>
    <string name="package_name">${apkPackageName}</string>
    <string name="app_url">${appUrl}</string>
</resources>`;

      const activityMainXml = `<?xml version="1.0" encoding="utf-8"?>
<androidx.constraintlayout.widget.ConstraintLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    <WebView
        android:id="@+id/webView"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />
</androidx.constraintlayout.widget.ConstraintLayout>`;

      const playStoreMeta = `# Google Play Store Submission Package
App Title: ${safeTitle.slice(0, 30)}
Package Name: ${apkPackageName}
Version Name: ${apkVersionName}
Version Code: ${apkVersionCode}
Target API: Android 14 (API ${apkTargetSdk})

## Short Description (max 80 chars):
Fast, secure social messenger with posts, reels, live group chat, and stickers.

## Full Description:
Welcome to ${safeTitle} - The next-generation social network and real-time messenger built for creators and communities!

Features:
• Instant Messaging & Voice Notes with sound alerts
• Interactive Home Feed with likes, comments, and media sharing
• Live Public & Private Groups & Channels
• Media Library with privacy controls
• Real-time Notifications & Offline Support
• Custom Animated Stickers & Emojis

Designed for privacy, high performance, and endless connection.

## Release Keystore Command:
keytool -genkey -v -keystore release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias ${apkPackageName.split('.').pop() || 'imchat'}

## Build Command:
./gradlew assembleRelease
./gradlew bundleRelease (for Google Play Store .aab upload)
`;

      const assetlinks = JSON.stringify([{
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: apkPackageName,
          sha256_cert_fingerprints: [
            "14:6D:E9:7D:0C:5E:EA:71:1A:E4:33:76:F7:2E:7C:E6:C6:B4:73:96:2F:E9:13:58:33:DE:8E:B4:F5:F4:71:03"
          ]
        }
      }], null, 2);

      zip.file("AndroidManifest.xml", manifest);
      zip.file("app/src/main/AndroidManifest.xml", manifest);
      zip.file(`app/src/main/java/${pkgPath}/MainActivity.kt`, mainActivity);
      zip.file("app/build.gradle", appBuildGradle);
      zip.file("app/src/main/res/values/strings.xml", stringsXml);
      zip.file("app/src/main/res/layout/activity_main.xml", activityMainXml);
      zip.file("assetlinks.json", assetlinks);
      zip.file("README_GOOGLE_PLAY_INSTRUCTIONS.md", playStoreMeta);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeTitle.replace(/\s+/g, '_')}_Android_APK_Project_v${apkVersionName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setApkSuccessMessage(`Ready! ${safeTitle} Android APK project archive has been downloaded.`);
    } catch (err: any) {
      console.error("APK generation error:", err);
      alert("Error generating APK package: " + err.message);
    } finally {
      setIsGeneratingApk(false);
    }
  };

  const handleDownloadWebApkManifest = () => {
    const safeTitle = (apkAppName || appName || 'IMChat').trim();
    const manifestData = {
      package_name: apkPackageName,
      app_name: safeTitle,
      short_name: safeTitle.slice(0, 12),
      version_name: apkVersionName,
      version_code: apkVersionCode,
      start_url: window.location.origin,
      display: apkDisplayMode,
      theme_color: '#2563eb',
      background_color: '#ffffff',
      icons: [
        { src: appIcon || '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: appIcon || '/icon-512.png', sizes: '512x512', type: 'image/png' }
      ]
    };
    const blob = new Blob([JSON.stringify(manifestData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${apkPackageName}-webapk-manifest.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // System Repair Handlers
  const handleRunAutoFixAppErrors = async () => {
    setIsRepairing(true);
    const appendLog = (msg: string) => {
      setRepairLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };
    appendLog("Starting comprehensive App Errors Auto-Fixer...");
    
    try {
      const postFixResult = await PostStore.autoFixAppErrors();
      appendLog(`PostStore Repair: Repaired ${postFixResult.repairedPosts} posts. Fixed ${postFixResult.fixedComments} comments. Purged ${postFixResult.purgedDuplicates} duplicates.`);

      const mediaFixResult = await PostStore.cleanMissingOrBrokenMedia();
      appendLog(`Media Cleaning: Scanned and repaired ${mediaFixResult.removedFromPosts} media assets in posts.`);

      const mediaStorageFix = await MediaStore.cleanMissingOrBrokenMedia();
      appendLog(`MediaStorage Repair: Checked ${mediaStorageFix.scanned} items, repaired ${mediaStorageFix.removed} broken links.`);

      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            await reg.update();
          }
          appendLog("Service Worker caches and background sync updated successfully.");
        } catch {
          appendLog("Service Worker state refreshed.");
        }
      }

      setRepairSummary({
        scannedPosts: storePosts.length,
        fixedPosts: postFixResult.repairedPosts,
        brokenMediaFixed: mediaFixResult.removedFromPosts + mediaStorageFix.removed,
        commentsChecked: postFixResult.fixedComments
      });

      appendLog("ALL REPAIRS COMPLETED! Database and state synchronized successfully.");
    } catch (err: any) {
      appendLog(`Repair Error: ${err?.message || err}`);
    } finally {
      setIsRepairing(false);
    }
  };

  const handleCleanMissingMedia = async () => {
    setIsRepairing(true);
    const appendLog = (msg: string) => {
      setRepairLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };
    appendLog("Scanning and cleaning missing/broken media...");
    try {
      const res = await PostStore.cleanMissingOrBrokenMedia();
      const storeRes = await MediaStore.cleanMissingOrBrokenMedia();
      const total = res.removedFromPosts + storeRes.removed;
      appendLog(`Cleaned ${total} missing/broken media items across posts and media library.`);
      alert(`Cleaned ${total} missing or broken media items!`);
    } catch (e: any) {
      appendLog(`Error: ${e?.message || e}`);
    } finally {
      setIsRepairing(false);
    }
  };

  const handleRefreshOfflineCache = async () => {
    setIsRepairing(true);
    const appendLog = (msg: string) => {
      setRepairLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };
    appendLog("Clearing offline Service Worker caches...");
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const key of keys) {
          await caches.delete(key);
        }
        appendLog(`Deleted ${keys.length} stale cache partitions.`);
      }
      localStorage.removeItem('imchat_force_offline_mode');
      appendLog("Offline forced flag reset. Real-time network sync active.");
      alert("Offline cache cleared! App is running on fresh network resources.");
    } catch (err: any) {
      appendLog(`Error: ${err?.message || err}`);
    } finally {
      setIsRepairing(false);
    }
  };

  // Remaining Mock Data States
  const [posts, setPosts] = useState([
    { id: 'p1', author: 'Zoya Petrov', content: 'Beautiful sunset today!', likes: 24, date: '2024-05-20' },
    { id: 'p2', author: 'Sarah Connor', content: 'Preparation is key.', likes: 156, date: '2024-05-21' },
  ]);

  const [reports, setReports] = useState([
    { id: 'r1', type: 'Post', targetId: 'p2', reason: 'Spam', reporter: 'Alex Chen', status: 'Pending' },
  ]);

  const [marketItems, setMarketItems] = useState([
    { id: 'm1', name: 'Retro Camera', price: '$120', seller: 'Zoya Petrov', category: 'Electronics' },
  ]);

  const [groups, setGroups] = useState<any[]>([]);

  useEffect(() => {
    setGroups(GroupStore.getGroups());
    const unsub = GroupStore.subscribe(() => {
      setGroups(GroupStore.getGroups());
    });
    return () => unsub();
  }, []);

  const [channels, setChannels] = useState<any[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  
  const handleBulkDeleteChannels = async () => {
    if (selectedChannels.length === 0) return;
    // Removed window.confirm so it doesn't block in the iFrame preview

    for (const id of selectedChannels) {
      try {
        await deleteDoc(doc(db, 'channels', id));
      } catch (err) {
        console.error("Failed to delete channel:", id, err);
      }
    }
    setChannels(prev => prev.filter(c => !selectedChannels.includes(c.id)));
    setSelectedChannels([]);
  };

  const toggleChannelSelection = (id: string) => {
    setSelectedChannels(prev => 
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  };
  
  const toggleAllChannels = () => {
    if (selectedChannels.length === channels.length && channels.length > 0) {
      setSelectedChannels([]);
    } else {
      setSelectedChannels(channels.map(c => c.id));
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Set local preview immediately without waiting or spinners
      setLogoPreview(URL.createObjectURL(file));
      (async () => {
        try {
          const res = await uploadToCloudinary(file, 'image');
          if (res) {
            setLogoPreview(res.secure_url);
          }
        } catch (err) {
          console.error("Logo upload failed:", err);
        }
      })();
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Set local preview immediately without waiting or spinners
      setAppFavicon(URL.createObjectURL(file));
      (async () => {
        try {
          const res = await uploadToCloudinary(file, 'image');
          if (res) {
            setAppFavicon(res.secure_url);
          }
        } catch (err) {
          console.error("Favicon upload failed:", err);
        }
      })();
    }
  };

  const [customStickers, setCustomStickers] = useState<any[]>([]);
  const [uploadingSticker, setUploadingSticker] = useState(false);
  const [newStickerName, setNewStickerName] = useState('');
  const [newStickerUrl, setNewStickerUrl] = useState('');
  const [newStickerFile, setNewStickerFile] = useState<File | null>(null);
  const [selectedStickerFiles, setSelectedStickerFiles] = useState<File[]>([]);
  const [newStickerType, setNewStickerType] = useState<'animated' | 'static'>('animated');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedStickers, setSelectedStickers] = useState<string[]>([]);
  const [packPreviewFilter, setPackPreviewFilter] = useState<'all' | 'animated' | 'static'>('all');
  const [packPreviewSearch, setPackPreviewSearch] = useState('');
  const [packPreviewLayout, setPackPreviewLayout] = useState<'cards' | 'simulator' | 'compact'>('cards');
  const [lightboxSticker, setLightboxSticker] = useState<any | null>(null);
  const [copiedStickerId, setCopiedStickerId] = useState<string | null>(null);

  useEffect(() => {
    const unsubStickers = onSnapshot(
      collection(db, 'custom_stickers'),
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          list.push({ id: doc.id, ...data });
        });
        // Sort safely in memory by createdAt descending
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setCustomStickers(list);
      },
      async (err) => {
        console.error("Error subscribing to custom stickers, falling back to one-time fetch:", err);
        try {
          const snap = await getDocs(collection(db, 'custom_stickers'));
          const list: any[] = [];
          snap.forEach((doc) => {
            list.push({ id: doc.id, ...doc.data() });
          });
          list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setCustomStickers(list);
        } catch (fetchErr) {
          console.error("Failed fallback fetch for custom stickers:", fetchErr);
        }
      }
    );
    return () => unsubStickers();
  }, []);

  const deleteItem = async (type: AdminTab, id: string) => {
    if (isDeletionBlocked && type !== 'posts') {
      alert("Deletion is blocked.");
      return;
    }
    if (type !== 'posts' && type !== 'channels' && !confirm('Are you sure you want to delete this item?')) return;
    
    // Auth check for deleting custom stickers (only app owner and admins)
    if (type === 'stickers') {
      const currentUserEmail = auth.currentUser?.email?.toLowerCase() || '';
      const isOwnerOrAdmin = userRole === 'admin' || currentUserEmail === 'mobilephonesky987@gmail.com' || currentUserEmail === 'contact@imchat.im';
      if (!isOwnerOrAdmin) {
        alert("Error! Only the owner or administrators can delete stickers from this application.");
        return;
      }
    }

    switch (type) {
      case 'users': 
        try { await deleteDoc(doc(db, "users", id)); } catch (err) { console.error(err); }
        break;
      case 'posts': PostStore.deletePost(id); break;
      case 'reports': setReports(reports.filter(r => r.id !== id)); break;
      case 'marketplace': setMarketItems(marketItems.filter(i => i.id !== id)); break;
      case 'groups': 
        if (window.confirm("Are you sure you want to delete this group?")) {
          GroupStore.deleteGroup(id);
        }
        break;
      case 'channels': 
        try { 
          await deleteDoc(doc(db, 'channels', id)); 
          setChannels(channels.filter(c => c.id !== id));
        } catch (err) { 
          console.error("Failed to delete channel:", err); 
        }
        break;
      case 'stickers':
        try { await deleteDoc(doc(db, "custom_stickers", id)); } catch (err) { console.error(err); }
        break;
    }
  };

  const deleteSelectedStickers = async () => {
    if (selectedStickers.length === 0) return;
    const currentUserEmail = auth.currentUser?.email?.toLowerCase() || '';
    const isOwnerOrAdmin = userRole === 'admin' || currentUserEmail === 'mobilephonesky987@gmail.com' || currentUserEmail === 'contact@imchat.im';
    if (!isOwnerOrAdmin) {
      alert("Error! Only the owner or administrators can delete stickers from this application.");
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedStickers.length} selected stickers?`)) return;

    try {
      for (const id of selectedStickers) {
        await deleteDoc(doc(db, "custom_stickers", id));
      }
      setSelectedStickers([]);
      setSelectMode(false);
      alert("Successfully deleted selected stickers!");
    } catch (err) {
      console.error("Error deleting multiple stickers:", err);
      alert("An error occurred while deleting selection.");
    }
  };

  const isModerator = userRole === 'moderator';

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    ...(!isModerator ? [{ id: 'branding', label: 'Branding', icon: Palette }] : []),
    { id: 'users', label: 'Users', icon: Users },
    { id: 'posts', label: 'Posts & Content', icon: FileText },
    ...(!isModerator ? [{ id: 'apk_generator', label: 'APK Generator', icon: Smartphone }] : []),
    ...(!isModerator ? [{ id: 'system_repair', label: 'Error Fixer', icon: Cpu }] : []),
    ...(!isModerator ? [{ id: 'ip_bans', label: 'IP Bans', icon: ShieldBan }] : []),
    { id: 'stickers', label: 'Emojis & Stickers', icon: Smile },
    { id: 'groups', label: 'Groups', icon: MessageSquare },
    { id: 'channels', label: 'Channels', icon: Hash },
    ...(!isModerator ? [{ id: 'security', label: 'Security', icon: Lock }] : []),
    { id: 'marketplace', label: 'Market', icon: ShoppingBag },
    { id: 'reports', label: 'Reports', icon: AlertTriangle },
  ];

  return (
    <div className="absolute inset-0 z-50 bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-6 border-b border-gray-100 flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full md:hidden">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="bg-brand-blue p-2 rounded-lg text-white">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 leading-tight">Admin</h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Control Panel</p>
          </div>
        </div>

        <nav className="flex-1 p-4 flex md:flex-col gap-1 overflow-x-auto md:overflow-y-auto no-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all whitespace-nowrap md:w-full ${
                activeTab === tab.id 
                  ? 'bg-blue-50 text-brand-blue font-bold shadow-sm' 
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-brand-blue' : 'text-gray-400'}`} />
              <span className="text-sm">{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100 hidden md:block">
          <button onClick={onBack} className="flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-red-500 transition-colors w-full">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Exit Admin</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-bold text-gray-900 capitalize">{activeTab} Management</h2>
          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-100 border-none rounded-full text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <button className="bg-brand-blue text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-blue-600 active:scale-95 transition-all">
              <Plus className="w-4 h-4" /> New
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Users</span>
                        <span className="px-2 py-0.5 bg-blue-50 text-brand-blue rounded-full text-[9px] font-bold">
                          Active Community
                        </span>
                      </div>
                      <span className="text-3xl font-bold text-gray-900">{allMergedUsers.length}</span>
                      <span className="text-[10px] text-gray-400 font-medium">
                        {userCounts.humans} Members • {userCounts.admins} Staff & Mods
                      </span>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Active Posts</span>
                      <span className="text-3xl font-bold text-gray-900">{storePosts.length}</span>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-1 text-red-600">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Open Reports</span>
                      <span className="text-3xl font-bold">{reports.length}</span>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-1 text-brand-blue">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Groups</span>
                      <span className="text-3xl font-bold">{groups.length}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-gray-400" /> Recent Posts
                      </h3>
                      <button onClick={() => setActiveTab('posts')} className="text-xs font-bold text-brand-blue hover:underline">View All</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {storePosts.slice(0, 3).map(post => (
                        <div key={post.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3">
                           <div className="flex items-center gap-2">
                              <UserAvatar src={post.user.avatar} name={post.user.name} size="xs" />
                              <span className="font-bold text-xs text-gray-900">{post.user.name}</span>
                              <span className="text-[10px] text-gray-400 ml-auto">{new Date(post.timestamp).toLocaleDateString()}</span>
                           </div>
                           <p className="text-xs text-gray-600 line-clamp-2">{post.caption}</p>
                           {post.image && (
                             <img src={post.image} className="w-full h-20 object-cover rounded-xl mt-1" />
                           )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <BadgeCheck className="w-5 h-5 text-brand-blue" /> Quick Actions
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                       <button onClick={() => setActiveTab('security')} className="p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 font-bold text-sm flex items-center gap-3 hover:bg-red-100 transition-colors">
                          <Lock className="w-5 h-5" /> Lockdown Mode
                       </button>
                       <button onClick={() => setActiveTab('users')} className="p-4 bg-blue-50 text-brand-blue rounded-2xl border border-blue-100 font-bold text-sm flex items-center gap-3 hover:bg-blue-100 transition-colors">
                          <Users className="w-5 h-5" /> Manage Users
                       </button>
                       <button onClick={() => setActiveTab('branding')} className="p-4 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100 font-bold text-sm flex items-center gap-3 hover:bg-purple-100 transition-colors">
                          <Palette className="w-5 h-5" /> App Branding
                       </button>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'security' && (
                <div className="max-w-2xl space-y-6">
                  <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="p-8 border-b border-gray-100 bg-red-50/30">
                      <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
                          <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">Critical Lockdown</h3>
                          <p className="text-sm text-gray-500">Instantly suspend all user access except your account.</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-8 space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h4 className="font-bold text-gray-900">Emergency Access Block</h4>
                          <p className="text-xs text-gray-500 pr-4">When enabled, all users will be logged out and blocked. Only authorized admins can bypass.</p>
                        </div>
                        <button 
                          onClick={toggleLockdown}
                          className={`w-14 h-7 rounded-full transition-colors relative border-2 ${
                            systemConfig.lockdown ? 'bg-red-600 border-red-600' : 'bg-gray-200 border-gray-200'
                          }`}
                        >
                          <motion.div 
                            animate={{ x: systemConfig.lockdown ? 28 : 0 }}
                            className="w-5 h-5 bg-white rounded-full absolute top-0.5 left-0.5 shadow-sm"
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="p-8 border-b border-gray-100 bg-amber-50/30">
                      <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
                          <Lock className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">MFA Enforcement</h3>
                          <p className="text-sm text-gray-500">Require Two-Factor authentication for all users.</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-8 space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h4 className="font-bold text-gray-900">Force MFA Setup</h4>
                          <p className="text-xs text-gray-500 pr-4">Users will be forced to enable MFA in their settings to continue using most platform features.</p>
                        </div>
                        <button 
                          onClick={toggleForceMfa}
                          className={`w-14 h-7 rounded-full transition-colors relative border-2 ${
                            systemConfig.forceMfa ? 'bg-amber-600 border-amber-600' : 'bg-gray-200 border-gray-200'
                          }`}
                        >
                          <motion.div 
                            animate={{ x: systemConfig.forceMfa ? 28 : 0 }}
                            className="w-5 h-5 bg-white rounded-full absolute top-0.5 left-0.5 shadow-sm"
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'branding' && (
                <div className="max-w-2xl space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <section className="space-y-4">
                      <label className="text-sm font-bold text-gray-700 block">System Roles</label>
                      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 text-left">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-tighter">Rename "Members" Role</label>
                          <input
                            type="text"
                            value={memberRoleName}
                            onChange={(e) => setMemberRoleName(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                            placeholder="e.g. Creator, User"
                          />
                        </div>
                      </div>
                    </section>

                    <section className="space-y-4">
                      <label className="text-sm font-bold text-gray-700 block">App Details</label>
                      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 text-left">
                         <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-tighter">App Name</label>
                            <input
                              type="text"
                              value={appName}
                              onChange={(e) => setAppName(e.target.value)}
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                            />
                         </div>
                         <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-tighter">Icon Emoji</label>
                            <input
                              type="text"
                              value={appIcon}
                              onChange={(e) => setAppIcon(e.target.value)}
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-xl"
                            />
                         </div>
                      </div>
                    </section>
                  </div>

                  <section className="space-y-4">
                    <label className="text-sm font-bold text-gray-700 block">User Verification</label>
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between text-left">
                       <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm">
                            <BadgeCheck className="w-6 h-6 fill-brand-blue" />
                          </div>
                          <div className="space-y-1">
                             <h3 className="font-bold text-gray-900">Global Verification</h3>
                             <p className="text-xs text-gray-500">Automatically show verified badge for all IMChat users in their posts.</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-3">
                         <span className="text-sm font-bold text-gray-400">{allUsersVerified ? 'On' : 'Off'}</span>
                         <button 
                           onClick={() => {
                             const newState = !allUsersVerified;
                             setAllUsersVerified(newState);
                             PostStore.verifyAllUsers(newState);
                           }}
                           className={`w-14 h-7 rounded-full transition-colors relative border-2 ${
                             allUsersVerified ? 'bg-brand-blue border-brand-blue' : 'bg-gray-200 border-gray-200'
                           }`}
                         >
                           <motion.div 
                             animate={{ x: allUsersVerified ? 28 : 0 }}
                             className="w-5 h-5 bg-white rounded-full absolute top-0.5 left-0.5 shadow-sm"
                           />
                         </button>
                       </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <label className="text-sm font-bold text-gray-700 block">Logo & Visuals</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center gap-6 text-center">
                         <div className="w-32 h-32 bg-gray-50 rounded-3xl border border-gray-100 flex items-center justify-center p-4 overflow-hidden relative group">
                            {isUploading ? (
                               <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                            ) : (
                               <img src={logoPreview} className="w-full h-full object-contain" alt="Logo" />
                            )}
                            <div 
                              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <Upload className="w-8 h-8 text-white" />
                            </div>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                         </div>
                         <div className="space-y-2 w-full">
                            <h3 className="font-bold text-gray-900">Application Logo</h3>
                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tight">Main brand asset (PNG/SVG)</p>
                            <div className="flex flex-col gap-2 pt-2">
                              <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="text-brand-blue text-xs font-bold hover:underline self-center font-bold"
                              >
                                Upload Logo File
                              </button>
                              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">or paste Image URL</div>
                              <input 
                                id="admin-logo-url-input"
                                type="text" 
                                placeholder="https://example.com/logo.png" 
                                value={logoPreview} 
                                onChange={(e) => setLogoPreview(e.target.value)}
                                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-brand-blue"
                              />
                            </div>
                         </div>
                      </div>

                      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center gap-6 text-center">
                         <div className="w-32 h-32 bg-gray-50 rounded-3xl border border-gray-100 flex items-center justify-center p-8 overflow-hidden relative group">
                            {isUploading ? (
                               <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                            ) : (
                               <img src={appFavicon || logoPreview} className="w-16 h-16 object-contain" alt="Favicon" />
                            )}
                            <div 
                              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                              onClick={() => faviconInputRef.current?.click()}
                            >
                              <Upload className="w-8 h-8 text-white" />
                            </div>
                            <input type="file" ref={faviconInputRef} className="hidden" accept="image/*" onChange={handleFaviconUpload} />
                         </div>
                         <div className="space-y-2 w-full">
                            <h3 className="font-bold text-gray-900">App Favicon</h3>
                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tight">Browser Tab Icon (32x32)</p>
                            <div className="flex flex-col gap-2 pt-2">
                              <button 
                                onClick={() => faviconInputRef.current?.click()}
                                className="text-brand-blue text-xs font-bold hover:underline self-center font-bold"
                              >
                                Upload Favicon File
                              </button>
                              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">or paste Image URL</div>
                              <input 
                                id="admin-favicon-url-input"
                                type="text" 
                                placeholder="https://example.com/favicon.ico" 
                                value={appFavicon} 
                                onChange={(e) => setAppFavicon(e.target.value)}
                                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-brand-blue"
                              />
                            </div>
                         </div>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4 text-left">
                    <label className="text-sm font-bold text-gray-700 block">Description</label>
                    <textarea
                      value={appDescription}
                      onChange={(e) => setAppDescription(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-2xl px-6 py-4 text-sm text-gray-900 min-h-[120px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm resize-none"
                    />
                  </section>

                  <div className="flex justify-end gap-4">
                    <button onClick={onBack} className="px-8 py-3 bg-white border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-all">Cancel</button>
                    <button 
                      onClick={async () => {
                        if (isNewAdmin && onCompleteSetup) {
                          onCompleteSetup();
                        } else {
                          setIsSavingBranding(true);
                          setSaveSuccess(false);
                          try {
                            await setDoc(doc(db, "system_config", "global"), {
                              ...systemConfig,
                              appName,
                              appIcon,
                              appFavicon,
                              appDescription,
                              logoPreview,
                              memberRoleName,
                              updatedAt: serverTimestamp()
                            }, { merge: true });
                            setSaveSuccess(true);
                            setTimeout(() => setSaveSuccess(false), 3000);
                          } catch (err) {
                            console.error("Failed to save branding changes:", err);
                            alert("Failed to save branding changes. Make sure you are authorized.");
                          } finally {
                            setIsSavingBranding(false);
                          }
                        }
                      }}
                      disabled={isSavingBranding}
                      className={`px-8 py-3 font-bold rounded-xl shadow-lg transition-all text-sm flex items-center gap-2 ${
                        saveSuccess 
                          ? 'bg-emerald-600 text-white shadow-emerald-500/10 hover:bg-emerald-700 active:scale-95' 
                          : 'bg-brand-blue text-white shadow-blue-100 hover:bg-blue-600 active:scale-95'
                      } disabled:opacity-50`}
                    >
                      {isSavingBranding ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving Changes...</span>
                        </>
                      ) : saveSuccess ? (
                        <>
                          <Check className="w-4 h-4 animate-bounce" />
                          <span>Saved Successfully!</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>{isNewAdmin ? 'Complete Setup' : 'Save All Changes'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'ip_bans' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                      <h3 className="font-bold text-gray-900">Active IP Bans</h3>
                      <p className="text-xs text-gray-500">Users connecting from these addresses will be blocked at the server level.</p>
                    </div>
                    <table className="w-full text-left">
                      <thead className="bg-gray-50/30 border-b border-gray-100">
                        <tr>
                          <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-widest">IP Address</th>
                          <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-widest">Banned On</th>
                          <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-widest">Linked User</th>
                          <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 text-sm">
                        {bannedIps.map(ban => (
                          <tr key={ban.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4 text-gray-400" />
                                <span className="font-mono font-bold text-gray-900">{ban.ip}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-gray-500">
                              {ban.createdAt?.toDate ? ban.createdAt.toDate().toLocaleDateString() : 'Recent'}
                            </td>
                            <td className="px-6 py-4 text-gray-500 italic">
                               {ban.userId ? (
                                 <button 
                                   onClick={() => setEditingUser(allMergedUsers.find(u => u.id === ban.userId))}
                                   className="text-brand-blue hover:underline text-xs font-bold flex items-center gap-1"
                                 >
                                   <span>View User Profile</span>
                                   <ChevronRight className="w-3.5 h-3.5" />
                                 </button>
                               ) : 'Manual Entry'}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => handleUnbanIp(ban.id)}
                                className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-bold hover:bg-green-100 transition-all"
                              >
                                Unban IP
                              </button>
                            </td>
                          </tr>
                        ))}
                        {bannedIps.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                               <ShieldCheck className="w-10 h-10 mx-auto mb-2 opacity-20" />
                               <p>No active IP bans.</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
                    <h4 className="font-bold text-red-900 mb-2 flex items-center gap-2 text-sm">
                      <AlertTriangle className="w-4 h-4" /> Manual IP Ban
                    </h4>
                    <p className="text-xs text-red-700 mb-2 font-medium italic">Warning: Banning an IP will affect all users on that network (e.g. offices, schools).</p>
                    {adminIp && (
                      <p className="text-[10px] text-red-500 mb-4 font-bold">Your Current IP: {adminIp} (Avoid banning this!)</p>
                    )}
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        id="manual-ip-input" 
                        placeholder="e.g. 192.168.1.1"
                        className="flex-1 px-4 py-2 bg-white border border-red-200 rounded-xl outline-none text-sm font-mono"
                      />
                      <button 
                        onClick={() => {
                          const val = (document.getElementById('manual-ip-input') as HTMLInputElement).value;
                          if (val) handleBanIp(val);
                        }}
                        className="px-6 py-2 bg-red-600 text-white font-bold rounded-xl text-xs hover:bg-red-700 transition-all shadow-sm"
                      >
                        Ban Address
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'users' && (
                <div className="space-y-6">
                  {/* Users Header & Filter Tabs */}
                  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <Users className="w-5 h-5 text-brand-blue" />
                          <span>User Directory & Personas</span>
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Manage registered users, community members, and staff accounts.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {isLoadingUsers && (
                          <div className="flex items-center gap-1.5 text-xs text-brand-blue bg-blue-50 px-3 py-1.5 rounded-full font-bold">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Syncing...</span>
                          </div>
                        )}
                        <span className="text-xs font-extrabold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
                          {filteredUsers.length} shown of {allMergedUsers.length} total
                        </span>
                      </div>
                    </div>

                    {/* Filter Category Chips */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                      {[
                        { id: 'all', label: 'All Members', count: userCounts.total, icon: Users, color: 'text-gray-700' },
                        { id: 'humans', label: 'Community Members', count: userCounts.humans, icon: UserCheck, color: 'text-blue-700' },
                        { id: 'admins', label: 'Admins & Staff', count: userCounts.admins, icon: ShieldCheck, color: 'text-purple-700' },
                        { id: 'vips', label: 'VIP & Creators', count: userCounts.vips, icon: Sparkles, color: 'text-amber-700' },
                        { id: 'frozen', label: 'Frozen & Banned', count: userCounts.frozen, icon: UserX, color: 'text-red-700' },
                      ].map(tab => {
                        const Icon = tab.icon;
                        const isActive = userFilterTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setUserFilterTab(tab.id as any)}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                              isActive 
                                ? 'bg-brand-blue text-white shadow-sm shadow-blue-200' 
                                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200/60'
                            }`}
                          >
                            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : tab.color}`} />
                            <span>{tab.label}</span>
                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                              isActive ? 'bg-white/20 text-white' : 'bg-gray-200/70 text-gray-700'
                            }`}>
                              {tab.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Users Table */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50/70 border-b border-gray-100">
                        <tr>
                          <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-widest">User Details</th>
                          <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-widest text-center">Type & Role</th>
                          <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-sm">
                        {filteredUsers.map(user => {
                          return (
                            <tr key={user.id} className="hover:bg-blue-50/30 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3.5">
                                  <div className="relative shrink-0">
                                    <UserAvatar 
                                      src={user.avatar} 
                                      name={user.name || 'Anonymous'}
                                      size="md"
                                      className="rounded-full ring-2 ring-gray-100"
                                    />
                                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white" />
                                  </div>
                                  <div className="text-left min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-gray-900 truncate">{user.name || 'Anonymous'}</span>
                                      {user.isVerified ? (
                                        <BadgeCheck className="w-4 h-4 text-brand-blue fill-blue-50 shrink-0" />
                                      ) : null}
                                    </div>
                                    <div className="text-xs text-gray-400 font-medium truncate mt-0.5 flex items-center gap-1.5">
                                      <span>@{user.username || user.name?.toLowerCase().replace(/\s+/g, '_') || 'user'}</span>
                                      {user.email && (
                                        <>
                                          <span className="text-gray-300">•</span>
                                          <span className="truncate">{user.email}</span>
                                        </>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-gray-500 font-medium truncate max-w-md mt-1">
                                      <span>"{user.bio || 'Community Member'}"</span>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="px-6 py-4">
                                <div className="flex flex-col items-center gap-1.5">
                                  <span className={`px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                                    user.role === 'admin' ? 'bg-purple-100 text-purple-700 border border-purple-200' : 
                                    user.role === 'moderator' ? 'bg-blue-100 text-brand-blue border border-blue-200' : 
                                    user.role === 'content_creator' ? 'bg-orange-100 text-orange-700 border border-orange-200' : 
                                    user.role === 'vip' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                    'bg-gray-100 text-gray-600 border border-gray-200'
                                  }`}>
                                    {user.role === 'user' ? memberRoleName : (user.role === 'content_creator' ? 'Content Creator' : (user.role || 'Member'))}
                                  </span>

                                  {user.isFrozen && (
                                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[8px] font-extrabold uppercase shrink-0">
                                      ❄️ Frozen
                                    </span>
                                  )}
                                  {user.status === 'banned' && (
                                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 text-[8px] font-extrabold uppercase shrink-0">
                                      🚫 Banned
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="px-6 py-4">
                                <div className="flex items-center justify-end gap-2">
                                  {onVisitProfile && (
                                    <button 
                                      onClick={() => onVisitProfile({
                                        id: user.id || user.uid,
                                        name: user.name || 'Anonymous',
                                        avatar: user.avatar,
                                        bio: user.bio || 'User managed by Admin Control Panel',
                                        isRobot: false
                                      })}
                                      className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold transition-all border border-gray-200/70 flex items-center gap-1.5"
                                      title="Open user profile"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-gray-500" />
                                      <span className="hidden sm:inline">Profile</span>
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => {
                                      setSelectedUserForContent(user);
                                      setUserContentTab('posts');
                                      setSelectedPostIdsForUser(new Set());
                                      setSelectedCommentIdsForUser(new Set());
                                      setSelectedMediaIdsForUser(new Set());
                                    }}
                                    className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition-all border border-purple-200/70 flex items-center gap-1.5 shadow-2xs"
                                    title="Moderate this user's posts, comments, and media"
                                  >
                                    <FileText className="w-3.5 h-3.5 text-purple-600" />
                                    <span className="hidden sm:inline">Content</span>
                                  </button>
                                  <button 
                                    onClick={() => setEditingUser(user)}
                                    className="px-3.5 py-1.5 bg-brand-blue/10 hover:bg-brand-blue text-brand-blue hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 group"
                                  >
                                    <span>Manage</span>
                                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}

                        {filteredUsers.length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-6 py-16 text-center text-gray-400">
                              <Bot className="w-12 h-12 mx-auto mb-3 opacity-25 text-brand-blue" />
                              <h4 className="text-base font-bold text-gray-700">No users found</h4>
                              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                                No users matched your search query or selected filter criteria.
                              </p>
                              <button
                                onClick={() => {
                                  setUserFilterTab('all');
                                  setSearchTerm('');
                                }}
                                className="mt-4 px-4 py-2 bg-brand-blue text-white text-xs font-bold rounded-xl hover:bg-blue-600 transition-all"
                              >
                                Reset Filters
                              </button>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'posts' && (
                <div className="space-y-6">
                  {/* Bulk Actions Header Toolbar */}
                  <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 text-brand-blue rounded-xl font-bold text-xs flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span>{filteredGeneralPosts.length} Posts Total</span>
                      </div>
                      {selectedGeneralPostIds.size > 0 && (
                        <div className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold">
                          {selectedGeneralPostIds.size} Selected
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedGeneralPostIds.size === filteredGeneralPosts.length) {
                            setSelectedGeneralPostIds(new Set());
                          } else {
                            setSelectedGeneralPostIds(new Set(filteredGeneralPosts.map(p => p.id)));
                          }
                        }}
                        className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-xl border border-gray-200 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        {selectedGeneralPostIds.size === filteredGeneralPosts.length && filteredGeneralPosts.length > 0 ? (
                          <>
                            <Square className="w-3.5 h-3.5" />
                            <span>Deselect All</span>
                          </>
                        ) : (
                          <>
                            <CheckSquare className="w-3.5 h-3.5" />
                            <span>Select All</span>
                          </>
                        )}
                      </button>

                      {selectedGeneralPostIds.size > 0 && (
                        <button
                          type="button"
                          onClick={handleBulkDeleteGeneralPosts}
                          disabled={isBulkDeletingGeneralPosts}
                          className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{isBulkDeletingGeneralPosts ? 'Deleting...' : `Delete Selected (${selectedGeneralPostIds.size})`}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Posts Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredGeneralPosts.map(post => {
                      const isSelected = selectedGeneralPostIds.has(post.id);
                      return (
                        <div 
                          key={post.id} 
                          className={`bg-white p-5 rounded-2xl border transition-all text-left relative flex flex-col justify-between ${
                            isSelected ? 'border-brand-blue ring-2 ring-brand-blue/20 bg-blue-50/10 shadow-md' : 'border-gray-100 shadow-xs hover:shadow-md'
                          }`}
                        >
                          <div>
                            {/* Card Header with Checkbox and Author */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const next = new Set(selectedGeneralPostIds);
                                    if (e.target.checked) next.add(post.id);
                                    else next.delete(post.id);
                                    setSelectedGeneralPostIds(next);
                                  }}
                                  className="w-4 h-4 rounded text-brand-blue focus:ring-brand-blue cursor-pointer"
                                />
                                <div className="flex items-center gap-2">
                                  <UserAvatar 
                                    src={post.user?.avatar} 
                                    name={post.user?.name || 'User'}
                                    size="xs"
                                  />
                                  <div>
                                    <h4 className="font-bold text-xs text-gray-900 leading-tight">{post.user?.name || 'User'}</h4>
                                    <span className="text-[10px] text-gray-400 font-medium">
                                      {post.timestamp ? new Date(post.timestamp).toLocaleDateString() : 'Recent'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedUserForContent(post.user);
                                  setUserContentTab('posts');
                                  setSelectedPostIdsForUser(new Set());
                                  setSelectedCommentIdsForUser(new Set());
                                  setSelectedMediaIdsForUser(new Set());
                                }}
                                className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-[10px] font-bold border border-purple-200/60 cursor-pointer"
                                title="Inspect all content by this author"
                              >
                                User Content
                              </button>
                            </div>

                            {/* Media Preview */}
                            {post.image ? (
                              !(post.mediaType === 'video' || (typeof post.image === 'string' && (post.image.includes('.mp4') || post.image.includes('.webm') || post.image.includes('.mov') || post.image.includes('video/') || post.image.includes('blob:')))) ? (
                                <img src={post.image} className="w-full h-36 object-cover rounded-xl mb-3 border border-gray-100" />
                              ) : (
                                <video src={post.image} className="w-full h-36 object-cover rounded-xl mb-3 bg-black border border-gray-100" />
                              )
                            ) : (
                              <div className="w-full h-20 bg-gray-50 rounded-xl mb-3 flex items-center justify-center text-gray-400 text-xs italic border border-gray-100">
                                Text-only post
                              </div>
                            )}

                            <p className="text-gray-700 text-xs mb-3 line-clamp-2">{post.caption || 'No caption'}</p>
                          </div>

                          <div className="border-t border-gray-50 pt-3 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-[11px] font-bold text-gray-500">
                              <span>❤️ {typeof post.likesOverride === 'number' ? post.likesOverride : (post.likes?.length || 0)}</span>
                              <span>•</span>
                              <span>💬 {post.comments?.length || 0}</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this post?")) {
                                  PostStore.deletePost(post.id);
                                }
                              }}
                              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold border border-red-200 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {filteredGeneralPosts.length === 0 && (
                      <div className="col-span-full py-16 text-center text-gray-400">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-25 text-brand-blue" />
                        <h4 className="text-base font-bold text-gray-700">No posts match your search</h4>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* APK GENERATOR & GOOGLE PLAY STORE SUBMISSION TAB */}
              {activeTab === 'apk_generator' && (
                <div className="space-y-8 text-left">
                  {/* Header Banner */}
                  <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
                    <div className="relative z-10 max-w-2xl">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold mb-3 border border-white/20">
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Android Production Studio</span>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">Android APK Generator & Google Play Submission</h2>
                      <p className="text-blue-100 text-sm leading-relaxed">
                        Generate official installable Android APK and AAB bundles, download fully configured Android Studio project code with camera/audio WebChromeClient support, and access your ready-to-paste Google Play Console store listing.
                      </p>
                    </div>
                  </div>

                  {apkSuccessMessage && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm font-bold shadow-xs">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span className="flex-1">{apkSuccessMessage}</span>
                      <button onClick={() => setApkSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800 font-bold text-xs">Dismiss</button>
                    </div>
                  )}

                  {/* Android Project Configurations */}
                  <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-xs space-y-6">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">1. Android Package Configuration</h3>
                        <p className="text-xs text-gray-500">Configure your target build properties for the Android APK and Play Store bundle.</p>
                      </div>
                      <span className="px-3 py-1 bg-blue-50 text-brand-blue rounded-full text-xs font-extrabold">SDK 34 (Android 14)</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">App Name</label>
                        <input
                          type="text"
                          value={apkAppName}
                          onChange={(e) => setApkAppName(e.target.value)}
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                          placeholder="e.g. IMChat - Social Messenger"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Android Package Name</label>
                        <input
                          type="text"
                          value={apkPackageName}
                          onChange={(e) => setApkPackageName(e.target.value)}
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                          placeholder="im.imchat.social"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Version Name</label>
                        <input
                          type="text"
                          value={apkVersionName}
                          onChange={(e) => setApkVersionName(e.target.value)}
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                          placeholder="1.0.4"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Version Code</label>
                        <input
                          type="number"
                          value={apkVersionCode}
                          onChange={(e) => setApkVersionCode(parseInt(e.target.value) || 1)}
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                          placeholder="104"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Target SDK</label>
                        <input
                          type="number"
                          value={apkTargetSdk}
                          onChange={(e) => setApkTargetSdk(parseInt(e.target.value) || 34)}
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                          placeholder="34"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Display Architecture</label>
                        <select
                          value={apkDisplayMode}
                          onChange={(e) => setApkDisplayMode(e.target.value as any)}
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                        >
                          <option value="twa">Trusted Web Activity (Google Play Official)</option>
                          <option value="standalone">Standalone Native WebView</option>
                          <option value="fullscreen">Fullscreen Immersive App</option>
                        </select>
                      </div>
                    </div>

                    {/* Action Generation Buttons */}
                    <div className="pt-4 flex flex-wrap gap-4 items-center border-t border-gray-100">
                      <button
                        type="button"
                        onClick={handleGenerateAndDownloadApkProject}
                        disabled={isGeneratingApk}
                        className="px-6 py-3 bg-brand-blue hover:bg-blue-600 text-white font-bold rounded-2xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isGeneratingApk ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Building Android Package ZIP...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-5 h-5" />
                            <span>Download Full Android APK Project (.zip)</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadWebApkManifest}
                        className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-2xl transition-all flex items-center gap-2 cursor-pointer"
                      >
                        <FileText className="w-4 h-4 text-gray-600" />
                        <span>Download Android WebAPK Manifest (.json)</span>
                      </button>
                    </div>
                  </div>

                  {/* Google Play Store Submission Package */}
                  <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-xs space-y-6">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">2. Google Play Store Submission Suite</h3>
                        <p className="text-xs text-gray-500">Copy pre-formatted store listing metadata and digital asset links directly into Google Play Console.</p>
                      </div>
                      <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-extrabold">Play Console Ready</span>
                    </div>

                    <div className="space-y-4">
                      {/* Store Title */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Play Store App Title (30 Chars Max)</label>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText((apkAppName || 'IMChat - Social Messenger').slice(0, 30));
                              alert("Copied Play Store Title to clipboard!");
                            }}
                            className="text-xs text-brand-blue hover:underline font-bold flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy Title</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          readOnly
                          value={(apkAppName || 'IMChat - Social Messenger').slice(0, 30)}
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900"
                        />
                      </div>

                      {/* Short Description */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Short Description (80 Chars Max)</label>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText("Fast, secure social messenger with posts, reels, live group chat, and stickers.");
                              alert("Copied Short Description to clipboard!");
                            }}
                            className="text-xs text-brand-blue hover:underline font-bold flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy Short Desc</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          readOnly
                          value="Fast, secure social messenger with posts, reels, live group chat, and stickers."
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900"
                        />
                      </div>

                      {/* Full Description */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Full Store Description</label>
                          <button
                            type="button"
                            onClick={() => {
                              const desc = `Welcome to ${apkAppName || 'IMChat'} - The next-generation social network and real-time messenger built for creators and communities!

Features:
• Instant Messaging & Voice Notes with sound alerts
• Interactive Home Feed with likes, comments, and media sharing
• Live Public & Private Groups & Channels
• Media Library with privacy controls
• Real-time Notifications & Offline Support
• Custom Animated Stickers & Emojis

Designed for privacy, high performance, and endless connection.`;
                              navigator.clipboard.writeText(desc);
                              alert("Copied Full Description to clipboard!");
                            }}
                            className="text-xs text-brand-blue hover:underline font-bold flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy Full Desc</span>
                          </button>
                        </div>
                        <textarea
                          readOnly
                          rows={6}
                          value={`Welcome to ${apkAppName || 'IMChat'} - The next-generation social network and real-time messenger built for creators and communities!

Features:
• Instant Messaging & Voice Notes with sound alerts
• Interactive Home Feed with likes, comments, and media sharing
• Live Public & Private Groups & Channels
• Media Library with privacy controls
• Real-time Notifications & Offline Support
• Custom Animated Stickers & Emojis

Designed for privacy, high performance, and endless connection.`}
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-800"
                        />
                      </div>
                    </div>

                    {/* Step-by-Step Instructions */}
                    <div className="p-5 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-3">
                      <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-brand-blue" />
                        <span>Google Play Console Build & Publish Commands:</span>
                      </h4>
                      <ol className="text-xs text-blue-950/80 space-y-2 list-decimal list-inside font-medium">
                        <li>Extract the downloaded zip file into Android Studio.</li>
                        <li>
                          Generate your signing keystore:
                          <code className="block mt-1 p-2 bg-white rounded-lg border border-blue-200 font-mono text-[11px] select-all">
                            keytool -genkey -v -keystore release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias {apkPackageName.split('.').pop() || 'imchat'}
                          </code>
                        </li>
                        <li>
                          Build the Google Play Release App Bundle:
                          <code className="block mt-1 p-2 bg-white rounded-lg border border-blue-200 font-mono text-[11px] select-all">
                            ./gradlew bundleRelease
                          </code>
                        </li>
                        <li>Log in to <a href="https://play.google.com/console" target="_blank" rel="noreferrer" className="text-brand-blue font-bold underline">Google Play Console</a>, create a new app with package <span className="font-mono font-bold">{apkPackageName}</span>, and upload your <span className="font-mono font-bold">app-release.aab</span>.</li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}

              {/* SYSTEM REPAIR & AUTO-FIXER TAB */}
              {activeTab === 'system_repair' && (
                <div className="space-y-8 text-left">
                  {/* Header Banner */}
                  <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
                    <div className="relative z-10 max-w-2xl">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold mb-3 border border-white/20">
                        <Cpu className="w-3.5 h-3.5" />
                        <span>Automated App Diagnostics & Maintenance</span>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">App Errors Auto-Fixer & Media Cleaner</h2>
                      <p className="text-emerald-100 text-sm leading-relaxed">
                        One-click diagnostics to repair corrupted posts, purge missing/broken image references, reconstruct comments trees, and eliminate offline crashes.
                      </p>
                    </div>
                  </div>

                  {/* Diagnostic Metrics Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Posts In Store</span>
                      <span className="text-2xl font-black text-gray-900">{storePosts.length}</span>
                      <span className="text-[10px] text-emerald-600 font-bold block mt-1">Verified Healthy</span>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Media Files</span>
                      <span className="text-2xl font-black text-gray-900">{mediaList.length}</span>
                      <span className="text-[10px] text-brand-blue font-bold block mt-1">Images & Videos</span>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Comments Trees</span>
                      <span className="text-2xl font-black text-gray-900">
                        {storePosts.reduce((acc, p) => acc + (p.comments?.length || 0), 0)}
                      </span>
                      <span className="text-[10px] text-purple-600 font-bold block mt-1">Integrity Synced</span>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Offline SW Cache</span>
                      <span className="text-2xl font-black text-emerald-600">Active</span>
                      <span className="text-[10px] text-gray-400 font-bold block mt-1">Network-First Strategy</span>
                    </div>
                  </div>

                  {/* Actions Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Auto Fix All */}
                    <div className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
                      <div>
                        <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
                          <Wrench className="w-5 h-5" />
                        </div>
                        <h4 className="text-base font-bold text-gray-900 mb-1">Auto-Fix All App Errors</h4>
                        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                          Scans posts, recovers missing author profiles, repairs comment structures, cleans broken references, and deduplicates storage.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRunAutoFixAppErrors}
                        disabled={isRepairing}
                        className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isRepairing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        <span>{isRepairing ? 'Repairing System...' : 'Run Auto-Fixer'}</span>
                      </button>
                    </div>

                    {/* Delete Missing Media */}
                    <div className="bg-white p-6 rounded-3xl border border-blue-100 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
                      <div>
                        <div className="w-10 h-10 rounded-2xl bg-blue-100 text-brand-blue flex items-center justify-center mb-4">
                          <Trash2 className="w-5 h-5" />
                        </div>
                        <h4 className="text-base font-bold text-gray-900 mb-1">Scan & Delete Missing Media</h4>
                        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                          Probes image and video links. Automatically strips broken or missing media URLs so placeholders never fail.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCleanMissingMedia}
                        disabled={isRepairing}
                        className="w-full py-2.5 px-4 bg-brand-blue hover:bg-blue-600 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isRepairing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        <span>Clean Missing Media</span>
                      </button>
                    </div>

                    {/* Reset Offline Cache */}
                    <div className="bg-white p-6 rounded-3xl border border-purple-100 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
                      <div>
                        <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mb-4">
                          <RefreshCw className="w-5 h-5" />
                        </div>
                        <h4 className="text-base font-bold text-gray-900 mb-1">Purge Offline SW Cache</h4>
                        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                          Flushes stale Service Worker cache storages, forcing the browser to fetch real-time assets directly from the network.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRefreshOfflineCache}
                        disabled={isRepairing}
                        className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isRepairing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        <span>Purge Offline Cache</span>
                      </button>
                    </div>
                  </div>

                  {/* Terminal Diagnostic Console */}
                  <div className="bg-gray-950 text-emerald-400 p-5 rounded-3xl font-mono text-xs shadow-xl border border-gray-800">
                    <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-3">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-emerald-400" />
                        <span className="font-bold text-white">System Diagnostics & Repair Terminal</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRepairLogs([`[${new Date().toLocaleTimeString()}] Log cleared by admin.`])}
                        className="text-[11px] text-gray-400 hover:text-white transition-colors"
                      >
                        Clear Console
                      </button>
                    </div>
                    <div className="space-y-1 max-h-56 overflow-y-auto no-scrollbar">
                      {repairLogs.map((log, i) => (
                        <div key={i} className="leading-relaxed">
                          <span className="text-emerald-500">{log}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'groups' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groups.map(group => (
                       <div key={group.id} className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col gap-4 shadow-sm hover:shadow-md transition-all text-left">
                          <div className="flex items-center justify-between">
                             <div className="w-12 h-12 bg-blue-100 rounded-xl overflow-hidden flex items-center justify-center text-brand-blue">
                                {group.coverUrl ? (
                                  <img src={group.coverUrl} className="w-full h-full object-cover" alt="Group cover" />
                                ) : (
                                  <Users className="w-6 h-6" />
                                )}
                             </div>
                             <span className="px-3 py-1 bg-gray-50 rounded-full text-[10px] font-bold text-gray-400 uppercase">{group.isPrivate ? "Private" : "Public"}</span>
                          </div>
                          <div>
                             <h3 className="font-bold text-gray-900 text-lg line-clamp-1">{group.title}</h3>
                             <p className="text-sm text-gray-500 font-medium">{group.members?.length || 0} Members</p>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                             <button className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm">
                                <Users className="w-3.5 h-3.5" /> Members
                             </button>
                             <button 
                               onClick={() => setEditingGroup(group)}
                               className="p-2.5 bg-gray-50 hover:bg-blue-50 text-gray-400 hover:text-brand-blue rounded-xl transition-all shadow-sm"
                             >
                                <Edit className="w-4 h-4" />
                             </button>
                             <button 
                              onClick={() => deleteItem('groups', group.id)}
                              className="p-2.5 bg-red-50 text-red-400 hover:text-red-600 rounded-xl transition-all shadow-sm"
                             >
                                <Trash2 className="w-4 h-4" />
                             </button>
                          </div>
                       </div>
                    ))}
                  </div>
                  <button 
                    onClick={() => setShowNewGroupModal(true)}
                    className="mt-6 w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:border-blue-300 hover:text-brand-blue transition-all font-bold text-sm flex items-center justify-center gap-2"
                  >
                      <Plus className="w-5 h-5" /> Launch New Group
                  </button>
                </div>
              )}

              {activeTab === 'channels' && (
                <div className="bg-white rounded-3xl border border-gray-200 p-8 flex flex-col items-center justify-center min-h-[400px] text-center">
                  <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-brand-blue mb-6">
                    <Hash className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Channel Hub</h3>
                  <p className="text-gray-500 max-w-xs text-sm mb-8">Manage official announcement channels and public broadcasts.</p>
                  
                  <div className="w-full max-w-md flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="select_all_channels"
                        className="w-4 h-4 rounded border-gray-300 text-brand-blue focus:ring-brand-blue"
                        checked={channels.length > 0 && selectedChannels.length === channels.length}
                        onChange={toggleAllChannels}
                      />
                      <label htmlFor="select_all_channels" className="text-sm font-bold text-gray-700">Select All</label>
                    </div>
                    {selectedChannels.length > 0 && (
                      <button 
                        onClick={handleBulkDeleteChannels}
                        className="text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
                      >
                        <Trash2 className="w-3 h-3" /> Delete Selected ({selectedChannels.length})
                      </button>
                    )}
                  </div>
                  
                  <div className="w-full max-w-md space-y-3">
                    {channels.map(ch => (
                      <div key={ch.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group">
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-gray-300 text-brand-blue focus:ring-brand-blue"
                            checked={selectedChannels.includes(ch.id)}
                            onChange={() => toggleChannelSelection(ch.id)}
                            id={`checkbox_${ch.id}`}
                          />
                          <label htmlFor={`checkbox_${ch.id}`} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-brand-blue shadow-sm font-bold cursor-pointer">#</label>
                          <div className="text-left">
                            <div className="font-bold text-gray-900 text-sm">{ch.name}</div>
                            <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider transition-colors group-hover:text-brand-blue">{(Array.isArray(ch.subscribers) ? ch.subscribers.length : (typeof ch.subscribers === 'number' ? ch.subscribers : 0)).toLocaleString()} Subscribers</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                           <button 
                             onClick={() => setEditingChannel(ch)}
                             className="p-2 bg-white rounded-lg shadow-sm border border-gray-100 hover:text-brand-blue transition-colors"
                           >
                             <Edit className="w-4 h-4" />
                           </button>
                           <button 
                             onClick={() => deleteItem('channels', ch.id)} 
                             className="p-2 bg-white rounded-lg shadow-sm border border-gray-100 hover:text-red-500 transition-colors"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                        </div>
                      </div>
                    ))}
                    <button 
                      onClick={() => setShowNewChannelModal(true)}
                      className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:border-blue-300 hover:text-brand-blue transition-all font-bold text-sm flex items-center justify-center gap-2"
                    >
                       <Plus className="w-5 h-5" /> Launch New Channel
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'marketplace' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                   {marketItems.map(item => (
                      <div key={item.id} className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all text-left">
                        <div className="h-40 bg-gray-100 flex items-center justify-center text-gray-300">
                          <ShoppingBag className="w-12 h-12" />
                        </div>
                        <div className="p-5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-brand-blue uppercase tracking-widest">{item.category}</span>
                            <span className="font-bold text-gray-900">{item.price}</span>
                          </div>
                          <h3 className="font-bold text-gray-900 mb-4 h-10 line-clamp-2">{item.name}</h3>
                          <div className="flex items-center justify-between border-t border-gray-50 pt-4 mt-4">
                            <div className="text-[11px] text-gray-400 font-bold uppercase tracking-tight">Seller: <span className="text-gray-900">{item.seller}</span></div>
                            <div className="flex gap-1">
                              <button onClick={() => deleteItem('marketplace', item.id)} className="p-1.5 hover:bg-red-50 text-red-300 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                              <button className="p-1.5 hover:bg-gray-100 text-gray-300 hover:text-brand-blue transition-colors"><Eye className="w-4 h-4" /></button>
                            </div>
                          </div>
                        </div>
                      </div>
                   ))}
                </div>
              )}

              {activeTab === 'reports' && (
                <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden text-left">
                  <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                     <div>
                        <h3 className="text-lg font-bold text-gray-900">Safety Center</h3>
                        <p className="text-sm text-gray-500 font-medium">Moderate reported items and maintain community standards.</p>
                     </div>
                     <div className="bg-red-50 text-red-600 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 border border-red-100">
                        <AlertTriangle className="w-3.5 h-3.5" /> {reports.length} Reports
                     </div>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {reports.map(report => (
                      <div key={report.id} className="p-8 hover:bg-gray-50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 shrink-0 shadow-sm">
                            <AlertTriangle className="w-6 h-6" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900">Issue #{report.id}</span>
                              <span className="px-2 py-0.5 bg-gray-100 rounded-lg text-[9px] font-bold text-gray-400 uppercase tracking-widest">{report.type} {report.targetId}</span>
                            </div>
                            <p className="text-sm text-gray-600">Reason: <span className="font-bold text-red-500">{report.reason}</span> • Reported by <span className="text-gray-900 font-bold">{report.reporter}</span></p>
                            <div className="flex gap-4 pt-2">
                              <button className="text-[11px] font-bold text-brand-blue hover:underline">View Evidence</button>
                               <button className="text-[11px] font-bold text-gray-400 hover:underline">User Logs</button>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-3">
                           <button onClick={() => deleteItem('reports', report.id)} className="flex-1 md:flex-none px-6 py-2.5 bg-white border border-gray-200 text-gray-500 font-bold rounded-xl hover:bg-gray-50 transition-all text-xs">Dismiss</button>
                           <button className="flex-1 md:flex-none px-6 py-2.5 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-100 hover:bg-red-700 active:scale-95 transition-all text-xs flex items-center justify-center gap-2">
                              <Trash2 className="w-4 h-4" /> Resolve & Delete
                           </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {reports.length === 0 && (
                    <div className="p-24 text-center flex flex-col items-center">
                       <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center text-green-500 mb-6 border border-green-100">
                          <Check className="w-8 h-8" />
                       </div>
                       <h3 className="font-bold text-gray-900 text-xl">All Clear!</h3>
                       <p className="text-sm text-gray-400 font-medium max-w-xs mx-auto">The moderation queue is empty. Your platform is safe and sound.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'stickers' && (
                <div className="flex flex-col gap-8 text-left">
                  <div className="flex flex-col lg:flex-row gap-8">
                    {/* Left Column: Upload Form */}
                  <div className="flex-1 max-w-md bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm flex flex-col gap-6">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Upload className="w-5 h-5 text-brand-blue" />
                        <span>Upload Emoji or Sticker</span>
                      </h3>
                      <p className="text-xs text-gray-500 font-medium">Upload animated emojis (GIF, WebP) or static stickers for users.</p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-none">Name</label>
                      <input 
                        type="text" 
                        value={newStickerName}
                        onChange={(e) => setNewStickerName(e.target.value)}
                        placeholder="e.g., Happy Face, Cool Gif"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-semibold outline-none focus:border-brand-blue focus:bg-white transition-all shadow-sm"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-none">Category Type</label>
                      <div className="flex bg-gray-100 p-1 rounded-xl">
                        <button 
                          type="button"
                          onClick={() => setNewStickerType('animated')}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${newStickerType === 'animated' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          Animated Emoji
                        </button>
                        <button 
                          type="button"
                          onClick={() => setNewStickerType('static')}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${newStickerType === 'static' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          Static Sticker
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-none">Option A: Local Files (Supports Multiple Upload)</label>
                      <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center hover:border-brand-blue transition-all cursor-pointer bg-gray-50/50 flex flex-col items-center justify-center gap-2 relative group overflow-hidden h-32">
                        {selectedStickerFiles.length > 0 ? (
                          <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-2 z-10">
                            {selectedStickerFiles.length === 1 ? (
                              <>
                                <img src={URL.createObjectURL(selectedStickerFiles[0])} alt="Preview" className="h-14 object-contain" />
                                <span className="text-[10px] text-gray-500 font-semibold mt-1 truncate max-w-full px-4">{selectedStickerFiles[0].name}</span>
                              </>
                            ) : (
                              <div className="flex flex-col items-center justify-center gap-1">
                                <span className="text-xl font-bold text-brand-blue">{selectedStickerFiles.length}</span>
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Batch files ready</span>
                                <span className="text-[9px] text-gray-400 font-semibold leading-none">Names will be assigned automatically</span>
                              </div>
                            )}
                            <button 
                              type="button"
                              onClick={() => { 
                                setSelectedStickerFiles([]); 
                                setNewStickerFile(null); 
                              }}
                              className="text-[9px] font-bold text-red-500 hover:underline uppercase tracking-wider mt-1.5"
                            >
                              Remove All
                            </button>
                          </div>
                        ) : null}
                        <input 
                          type="file" 
                          multiple
                          accept="image/*" 
                          onChange={(e) => {
                            if (e.target.files) {
                              const files = Array.from(e.target.files);
                              setSelectedStickerFiles(files);
                              if (files.length === 1) {
                                setNewStickerFile(files[0]);
                                const cleanName = files[0].name.substring(0, files[0].name.lastIndexOf('.')) || files[0].name;
                                setNewStickerName(cleanName);
                              } else {
                                setNewStickerFile(null);
                              }
                              setNewStickerUrl('');
                            }
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer z-20"
                        />
                        <ImageIcon className="w-8 h-8 text-gray-400 group-hover:scale-110 transition-transform" />
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Upload File(s) / Click to select Multiple</span>
                      </div>
                    </div>

                    <div className="flex items-center my-1 select-none">
                      <div className="flex-1 h-px bg-gray-200"></div>
                      <span className="px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">OR</span>
                      <div className="flex-1 h-px bg-gray-200"></div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-none">Option B: Direct Image URL</label>
                      <input 
                        type="url" 
                        value={newStickerUrl}
                        onChange={(e) => {
                          setNewStickerUrl(e.target.value);
                          setNewStickerFile(null);
                          setSelectedStickerFiles([]);
                        }}
                        placeholder="https://example.com/item.gif"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-xs font-medium outline-none focus:border-brand-blue focus:bg-white transition-all shadow-sm"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        if (selectedStickerFiles.length > 1) {
                          setUploadingSticker(true);
                          try {
                            let uploadedCount = 0;
                            const createdItems: any[] = [];
                            for (const file of selectedStickerFiles) {
                              let finalUrl = '';
                              try {
                                const uploadRes = await uploadToCloudinary(file, 'image', 'stickers');
                                finalUrl = uploadRes.secure_url || uploadRes.thumbnail_url || '';
                              } catch (upErr) {
                                console.warn("Cloud/server upload failed for sticker, trying base64 fallback:", upErr);
                              }

                              if (!finalUrl) {
                                finalUrl = await new Promise<string>((resolve, reject) => {
                                  const reader = new FileReader();
                                  reader.onload = () => resolve(reader.result as string);
                                  reader.onerror = (err) => reject(err);
                                  reader.readAsDataURL(file);
                                });
                              }
                              
                              if (finalUrl) {
                                const cleanName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                                const stickerData = {
                                  name: cleanName,
                                  url: finalUrl,
                                  type: newStickerType,
                                  createdAt: Date.now()
                                };
                                const docRef = await addDoc(collection(db, 'custom_stickers'), stickerData);
                                createdItems.push({ id: docRef.id, ...stickerData });
                                uploadedCount++;
                              }
                            }
                            if (createdItems.length > 0) {
                              setCustomStickers(prev => [...createdItems, ...prev]);
                            }
                            alert(`Successfully uploaded ${uploadedCount} stickers! 🎨🥳`);
                            setSelectedStickerFiles([]);
                            setNewStickerFile(null);
                            setNewStickerName('');
                            setNewStickerUrl('');
                          } catch (err) {
                            console.error("Batch sticker upload error:", err);
                            alert("Failed to upload batch stickers. Please check file format and try again.");
                          } finally {
                            setUploadingSticker(false);
                          }
                          return;
                        }

                        // Standard single file or URL upload
                        if (!newStickerName.trim() && !newStickerFile) {
                          alert("Please enter a name or choose an image for the sticker.");
                          return;
                        }
                        const nameToUse = newStickerName.trim() || (newStickerFile ? newStickerFile.name.substring(0, newStickerFile.name.lastIndexOf('.')) || newStickerFile.name : 'Custom Sticker');
                        let finalUrl = newStickerUrl.trim();
                        setUploadingSticker(true);
                        try {
                          if (newStickerFile) {
                            try {
                              const uploadRes = await uploadToCloudinary(newStickerFile, 'image', 'stickers');
                              finalUrl = uploadRes.secure_url || uploadRes.thumbnail_url || '';
                            } catch (upErr) {
                              console.warn("Upload failed, trying fallback:", upErr);
                            }

                            if (!finalUrl) {
                              const reader = new FileReader();
                              finalUrl = await new Promise<string>((resolve, reject) => {
                                reader.onload = () => resolve(reader.result as string);
                                reader.onerror = (err) => reject(err);
                                reader.readAsDataURL(newStickerFile);
                              });
                            }
                          }
                          
                          if (!finalUrl) {
                            alert("Please upload a file or enter a valid URL.");
                            return;
                          }

                          const stickerData = {
                            name: nameToUse,
                            url: finalUrl,
                            type: newStickerType,
                            createdAt: Date.now()
                          };

                          const docRef = await addDoc(collection(db, 'custom_stickers'), stickerData);
                          setCustomStickers(prev => [{ id: docRef.id, ...stickerData }, ...prev]);

                          setNewStickerName('');
                          setNewStickerUrl('');
                          setNewStickerFile(null);
                          setSelectedStickerFiles([]);
                          alert("Sticker uploaded and saved successfully! 🎨");
                        } catch (err) {
                          console.error("Failed to create custom sticker:", err);
                          alert("Failed to save sticker. Please try again.");
                        } finally {
                          setUploadingSticker(false);
                        }
                      }}
                      disabled={uploadingSticker || (!newStickerName.trim() && !newStickerFile && selectedStickerFiles.length === 0 && !newStickerUrl)}
                      className="w-full bg-brand-blue hover:bg-blue-600 text-white font-bold py-3.5 rounded-2xl shadow-lg hover:shadow-xl active:scale-95 transition-all text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {uploadingSticker ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Uploading & Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Save Emojis / Stickers</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Right Column: Collection Library Grid */}
                  <div className="flex-1 bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm flex flex-col gap-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <Smile className="w-5 h-5 text-yellow-500 animate-bounce" />
                          <span>Emojis & Stickers Library</span>
                        </h3>
                        <p className="text-xs text-gray-500 font-medium">View and manage custom stickers and emojis for users.</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl text-xs font-bold text-gray-700 cursor-pointer select-none hover:bg-gray-100 transition-colors">
                          <input 
                            type="checkbox"
                            checked={selectMode}
                            onChange={(e) => {
                              setSelectMode(e.target.checked);
                              if (!e.target.checked) setSelectedStickers([]);
                            }}
                            className="w-4 h-4 text-brand-blue border-gray-300 rounded focus:ring-brand-blue cursor-pointer"
                          />
                          <span>Select Mode (Bulk Delete)</span>
                        </label>
                      </div>
                    </div>

                    {selectMode && customStickers.length > 0 && (
                      <div className="flex items-center justify-between bg-blue-50/50 border border-blue-100/50 p-3.5 rounded-2xl gap-3">
                        <span className="text-xs font-black uppercase tracking-wider text-brand-blue">
                          Selected {selectedStickers.length} of {customStickers.length}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedStickers.length === customStickers.length) {
                                setSelectedStickers([]);
                              } else {
                                setSelectedStickers(customStickers.map(s => s.id));
                              }
                            }}
                            className="text-[11px] font-black uppercase tracking-wider bg-white border border-gray-200 text-gray-600 px-3 py-2 rounded-xl hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
                          >
                            {selectedStickers.length === customStickers.length ? 'Deselect All' : 'Select All'}
                          </button>
                          
                          <button
                            type="button"
                            onClick={deleteSelectedStickers}
                            disabled={selectedStickers.length === 0}
                            className="text-[11px] font-black uppercase tracking-wider bg-red-600 text-white px-3 py-2 rounded-xl hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50 inline-flex items-center gap-1.5 shadow-md shadow-red-500/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete Selected
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex-1 overflow-y-auto no-scrollbar max-h-[500px] min-h-[300px]">
                      {customStickers.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-1">
                          {customStickers.map((stk) => {
                            const isSelected = selectedStickers.includes(stk.id);
                            return (
                              <div 
                                key={stk.id} 
                                onClick={() => {
                                  if (selectMode) {
                                    if (isSelected) {
                                      setSelectedStickers(selectedStickers.filter(id => id !== stk.id));
                                    } else {
                                      setSelectedStickers([...selectedStickers, stk.id]);
                                    }
                                  }
                                }}
                                className={`border rounded-2xl p-3 flex flex-col items-center justify-between text-center relative group min-h-[140px] shadow-sm transition-all select-none ${
                                  selectMode ? 'cursor-pointer' : ''
                                } ${
                                  isSelected 
                                    ? 'border-brand-blue bg-blue-50/40 ring-2 ring-brand-blue/25' 
                                    : 'border-gray-100 bg-gray-50/50 hover:border-gray-200'
                                }`}
                              >
                               {/* Overlay Delete single item */}
                               {!selectMode && (
                                 <button 
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     deleteItem('stickers', stk.id);
                                   }}
                                   className="absolute top-2 right-2 p-1.5 bg-white hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity active:scale-90"
                                 >
                                   <Trash2 className="w-3.5 h-3.5" />
                                 </button>
                               )}

                               {/* Card Checkbox indicator inside mode */}
                               {selectMode && (
                                 <div className="absolute top-2 right-2 z-10 pointer-events-none">
                                   <input 
                                     type="checkbox"
                                     checked={isSelected}
                                     readOnly
                                     className="w-4 h-4 text-brand-blue border-gray-300 rounded focus:ring-brand-blue cursor-pointer"
                                   />
                                 </div>
                               )}
                               
                               <div className="w-16 h-16 flex items-center justify-center p-1 bg-white rounded-xl shadow-sm border border-gray-100">
                                 <img src={stk.url} alt={stk.name} className="max-w-full max-h-full object-contain img-referrer-no-referrer" referrerPolicy="no-referrer" />
                                </div>

                                <div className="mt-2 space-y-1 w-full font-bold">
                                  <p className="text-xs font-bold text-gray-900 truncate px-1">{stk.name}</p>
                                  <span className="inline-block px-2 py-0.5 bg-blue-50 text-brand-blue text-[9px] font-black uppercase tracking-widest rounded-md">
                                    {stk.type === 'animated' ? 'Emoji' : 'Sticker'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center py-20 text-gray-400 italic text-sm font-bold">
                          No custom stickers uploaded yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ======================================================== */}
                {/* NEW SECTION: CURRENT STICKER PACK LIVE PREVIEW & INSPECTOR */}
                {/* ======================================================== */}
                <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm flex flex-col gap-6">
                  {/* Pack Preview Header */}
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-gray-100 pb-6">
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-brand-blue to-cyan-500 flex items-center justify-center text-white shadow-md shadow-brand-blue/20">
                          <PackageCheck className="w-5 h-5" />
                        </div>
                        <h3 className="text-xl font-black text-gray-900 tracking-tight">
                          Current Sticker Pack Live Preview
                        </h3>
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black uppercase tracking-wider border border-emerald-200/60 flex items-center gap-1.5 shadow-sm">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                          <span>Firestore Live ({customStickers.length} Items)</span>
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 font-medium mt-1">
                        Live preview of all stickers and emojis fetched directly from the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 font-mono text-[11px]">custom_stickers</code> Firestore database collection.
                      </p>
                    </div>

                    {/* View Controls & Filters */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center bg-gray-100 p-1 rounded-2xl border border-gray-200">
                        <button
                          type="button"
                          onClick={() => setPackPreviewLayout('cards')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            packPreviewLayout === 'cards'
                              ? 'bg-white text-gray-900 shadow-sm font-black'
                              : 'text-gray-500 hover:text-gray-900'
                          }`}
                        >
                          <LayoutGrid className="w-3.5 h-3.5" />
                          <span>Cards</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPackPreviewLayout('compact')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            packPreviewLayout === 'compact'
                              ? 'bg-white text-gray-900 shadow-sm font-black'
                              : 'text-gray-500 hover:text-gray-900'
                          }`}
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>Grid</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPackPreviewLayout('simulator')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            packPreviewLayout === 'simulator'
                              ? 'bg-brand-blue text-white shadow-sm font-black'
                              : 'text-gray-500 hover:text-gray-900'
                          }`}
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          <span>User Simulator</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Filter and Search Bar */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/70 p-3 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar">
                      <button
                        type="button"
                        onClick={() => setPackPreviewFilter('all')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                          packPreviewFilter === 'all'
                            ? 'bg-brand-blue text-white shadow-sm'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        All ({customStickers.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPackPreviewFilter('static')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                          packPreviewFilter === 'static'
                            ? 'bg-brand-blue text-white shadow-sm'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        Stickers ({customStickers.filter(s => s.type !== 'animated').length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPackPreviewFilter('animated')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                          packPreviewFilter === 'animated'
                            ? 'bg-brand-blue text-white shadow-sm'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        Animated Emojis ({customStickers.filter(s => s.type === 'animated').length})
                      </button>
                    </div>

                    <div className="relative w-full sm:w-64">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={packPreviewSearch}
                        onChange={(e) => setPackPreviewSearch(e.target.value)}
                        placeholder="Search sticker name..."
                        className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue"
                      />
                    </div>
                  </div>

                  {/* Main Preview Content */}
                  {(() => {
                    const filtered = customStickers.filter((stk) => {
                      const matchesSearch = stk.name?.toLowerCase().includes(packPreviewSearch.toLowerCase());
                      if (!matchesSearch) return false;
                      if (packPreviewFilter === 'animated') return stk.type === 'animated';
                      if (packPreviewFilter === 'static') return stk.type !== 'animated';
                      return true;
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="py-16 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                          <Smile className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-sm font-bold text-gray-700">No stickers match your preview filter</p>
                          <p className="text-xs text-gray-400 mt-1">Upload new stickers above to see them in this live pack preview.</p>
                        </div>
                      );
                    }

                    if (packPreviewLayout === 'simulator') {
                      return (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl">
                          {/* Left: Interactive Simulated Sticker Picker Drawer */}
                          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                              <div className="flex items-center gap-2">
                                <Smile className="w-4 h-4 text-yellow-400" />
                                <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                                  Live User Sticker Drawer Simulator
                                </span>
                              </div>
                              <span className="text-[10px] font-bold bg-slate-800 px-2 py-0.5 rounded text-cyan-400">
                                {filtered.length} Items Available
                              </span>
                            </div>

                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 max-h-[320px] overflow-y-auto no-scrollbar p-1">
                              {filtered.map((stk) => (
                                <button
                                  key={stk.id}
                                  type="button"
                                  onClick={() => setLightboxSticker(stk)}
                                  className="aspect-square bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 rounded-xl p-2 flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95 group relative"
                                  title={`Click to inspect: ${stk.name}`}
                                >
                                  <img
                                    src={stk.url}
                                    alt={stk.name}
                                    className="max-w-full max-h-full object-contain img-referrer-no-referrer"
                                    referrerPolicy="no-referrer"
                                  />
                                  <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-1 bg-slate-800 text-[9px] font-bold text-white px-1.5 py-0.5 rounded shadow whitespace-nowrap z-20 pointer-events-none truncate max-w-[80px]">
                                    {stk.name}
                                  </span>
                                </button>
                              ))}
                            </div>
                            <p className="text-[11px] text-slate-400 text-center italic">
                              💡 Click any sticker to inspect high-resolution asset details and metadata.
                            </p>
                          </div>

                          {/* Right: Live Chat Bubble Simulator */}
                          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                              <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                                Chat & Comment Preview
                              </span>
                              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                                <CheckCheck className="w-3.5 h-3.5" />
                                <span>Real-time Rendering</span>
                              </span>
                            </div>

                            <div className="space-y-3">
                              {filtered.slice(0, 3).map((stk, idx) => (
                                <div
                                  key={stk.id}
                                  className={`flex items-start gap-2.5 ${
                                    idx % 2 === 1 ? 'flex-row-reverse' : ''
                                  }`}
                                >
                                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-black shrink-0 text-cyan-400">
                                    {idx % 2 === 1 ? 'Admin' : 'User'}
                                  </div>
                                  <div
                                    className={`p-3 rounded-2xl border max-w-[220px] ${
                                      idx % 2 === 1
                                        ? 'bg-brand-blue/20 border-brand-blue/40 text-right'
                                        : 'bg-slate-900 border-slate-800'
                                    }`}
                                  >
                                    <div className="w-20 h-20 mx-auto flex items-center justify-center p-1 bg-slate-950/60 rounded-xl border border-slate-800/80 mb-1.5">
                                      <img
                                        src={stk.url}
                                        alt={stk.name}
                                        className="max-w-full max-h-full object-contain img-referrer-no-referrer"
                                        referrerPolicy="no-referrer"
                                      />
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-300 truncate text-center">
                                      {stk.name}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400">
                              App stickers automatically support transparency, animated WebP/GIF frames, and custom reaction scaling.
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (packPreviewLayout === 'compact') {
                      return (
                        <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 gap-3">
                          {filtered.map((stk) => (
                            <div
                              key={stk.id}
                              onClick={() => setLightboxSticker(stk)}
                              className="aspect-square bg-gray-50 hover:bg-blue-50/50 border border-gray-200 hover:border-brand-blue/50 rounded-2xl p-2.5 flex flex-col items-center justify-between cursor-pointer transition-all hover:scale-105 active:scale-95 group relative shadow-sm"
                            >
                              <div className="w-full flex-1 flex items-center justify-center p-1">
                                <img
                                  src={stk.url}
                                  alt={stk.name}
                                  className="max-w-full max-h-full object-contain img-referrer-no-referrer"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <p className="text-[10px] font-bold text-gray-800 truncate w-full text-center mt-1">
                                {stk.name}
                              </p>
                            </div>
                          ))}
                        </div>
                      );
                    }

                    // Default 'cards' layout
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filtered.map((stk) => {
                          const isCopied = copiedStickerId === stk.id;
                          return (
                            <div
                              key={stk.id}
                              className="bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all p-4 flex flex-col justify-between gap-4 group"
                            >
                              {/* Image Presentation Box with Checkered Transparency Background */}
                              <div className="relative aspect-video w-full rounded-xl bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center p-3">
                                <div
                                  className="absolute inset-0 opacity-15 pointer-events-none"
                                  style={{
                                    backgroundImage:
                                      'radial-gradient(#94a3b8 1px, transparent 1px)',
                                    backgroundSize: '12px 12px'
                                  }}
                                />

                                <img
                                  src={stk.url}
                                  alt={stk.name}
                                  className="max-w-full max-h-full object-contain relative z-10 transition-transform group-hover:scale-110 duration-300 img-referrer-no-referrer"
                                  referrerPolicy="no-referrer"
                                />

                                <button
                                  type="button"
                                  onClick={() => setLightboxSticker(stk)}
                                  className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white rounded-lg shadow-sm text-gray-600 hover:text-brand-blue opacity-0 group-hover:opacity-100 transition-all z-20"
                                  title="Enlarge preview"
                                >
                                  <Maximize2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* Details */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <h4 className="text-sm font-bold text-gray-900 truncate" title={stk.name}>
                                    {stk.name}
                                  </h4>
                                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider shrink-0 ${
                                    stk.type === 'animated'
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                                      : 'bg-blue-50 text-brand-blue border border-blue-200/60'
                                  }`}>
                                    {stk.type === 'animated' ? 'Animated Emoji' : 'App Sticker'}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                                  <span className="truncate max-w-[120px]" title={stk.id}>ID: {stk.id.slice(0, 10)}...</span>
                                  <span>{stk.createdAt ? new Date(stk.createdAt).toLocaleDateString() : 'Live'}</span>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100">
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(stk.url);
                                    setCopiedStickerId(stk.id);
                                    setTimeout(() => setCopiedStickerId(null), 2000);
                                  }}
                                  className="flex-1 py-1.5 px-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-[11px] font-bold text-gray-700 transition-colors flex items-center justify-center gap-1"
                                >
                                  {isCopied ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      <span className="text-emerald-600">Copied URL</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3 text-gray-400" />
                                      <span>Copy URL</span>
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setLightboxSticker(stk)}
                                  className="p-1.5 bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-brand-blue border border-gray-200 rounded-xl transition-colors"
                                  title="Inspect full resolution"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => deleteItem('stickers', stk.id)}
                                  className="p-1.5 bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-600 border border-gray-200 rounded-xl transition-colors"
                                  title="Delete sticker from database"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Lightbox / High-Res Inspector Modal */}
                <AnimatePresence>
                  {lightboxSticker && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col"
                      >
                        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <PackageCheck className="w-5 h-5 text-brand-blue" />
                            <h3 className="font-black text-gray-900 text-base">{lightboxSticker.name}</h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => setLightboxSticker(null)}
                            className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-700 transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>

                        <div className="p-6 flex flex-col items-center gap-5">
                          <div className="w-48 h-48 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center p-4 shadow-inner relative overflow-hidden">
                            <div
                              className="absolute inset-0 opacity-20 pointer-events-none"
                              style={{
                                backgroundImage:
                                  'radial-gradient(#64748b 1px, transparent 1px)',
                                backgroundSize: '12px 12px'
                              }}
                            />
                            <img
                              src={lightboxSticker.url}
                              alt={lightboxSticker.name}
                              className="max-w-full max-h-full object-contain relative z-10 img-referrer-no-referrer"
                              referrerPolicy="no-referrer"
                            />
                          </div>

                          <div className="w-full space-y-2 bg-gray-50 p-4 rounded-2xl border border-gray-100 text-xs">
                            <div className="flex justify-between py-1 border-b border-gray-200/60">
                              <span className="text-gray-500 font-bold">Sticker Name</span>
                              <span className="text-gray-900 font-black">{lightboxSticker.name}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-gray-200/60">
                              <span className="text-gray-500 font-bold">Type</span>
                              <span className="text-brand-blue font-black uppercase">{lightboxSticker.type === 'animated' ? 'Animated Emoji' : 'App Sticker'}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-gray-200/60">
                              <span className="text-gray-500 font-bold">Firestore Doc ID</span>
                              <span className="text-gray-700 font-mono">{lightboxSticker.id}</span>
                            </div>
                            <div className="flex justify-between py-1">
                              <span className="text-gray-500 font-bold">Direct URL</span>
                              <a
                                href={lightboxSticker.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-brand-blue hover:underline truncate max-w-[200px]"
                              >
                                {lightboxSticker.url}
                              </a>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 w-full">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(lightboxSticker.url);
                                alert("Sticker image URL copied to clipboard!");
                              }}
                              className="flex-1 py-2.5 bg-brand-blue text-white rounded-xl font-bold text-xs shadow-md shadow-brand-blue/20 hover:bg-blue-600 transition-all flex items-center justify-center gap-1.5"
                            >
                              <Copy className="w-4 h-4" />
                              <span>Copy Image URL</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setLightboxSticker(null)}
                              className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-colors"
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        </main>
        
        <AnimatePresence>
          {editingUser && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
              >
                <div className="p-6 sm:p-8 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <UserAvatar src={editingUser.avatar} name={editingUser.name} size="lg" />
                      {(editingUser.isRobot || editingUser.role === 'robot' || editingUser.id?.startsWith('bot_')) && (
                        <span className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 text-white rounded-full ring-2 ring-white shadow-xs">
                          <Bot className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 text-xl">{editingUser.name || 'User Settings'}</h3>
                        {(editingUser.isRobot || editingUser.role === 'robot' || editingUser.id?.startsWith('bot_')) && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[9px] font-extrabold uppercase">
                            Robot
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{editingUser.email || `@${editingUser.username || 'user'}`}</p>
                    </div>
                  </div>
                  <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 no-scrollbar">
                  {/* Role Selection */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                       <ShieldCheck className="w-5 h-5 text-brand-blue" />
                       <h4 className="font-bold text-gray-900 text-sm">User Role & Permissions</h4>
                    </div>
                    <div className="relative">
                      <select 
                        disabled={isModerator && (editingUser.role === 'admin' || editingUser.role === 'moderator')}
                        value={editingUser.role || 'user'}
                        onChange={async (e) => {
                          const newRole = e.target.value as any;
                          await handleUpdateUserData(editingUser.id, { role: newRole });
                        }}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 text-sm font-bold appearance-none cursor-pointer disabled:opacity-60"
                      >
                        {isModerator ? (
                          <>
                            <option value="user">Standard User (Member)</option>
                            <option value="restricted">Restricted (Read-Only / Muted)</option>
                          </>
                        ) : (
                          <>
                            <option value="user">Standard User (Member)</option>
                            <option value="content_creator">Content Creator</option>
                            <option value="vip">VIP / Premium (Gold)</option>
                            <option value="team">Team Member (Official)</option>
                            <option value="moderator">Moderator</option>
                            <option value="restricted">Restricted (Read-Only / Muted)</option>
                            <option value="admin">Administrator (Full Access)</option>
                          </>
                        )}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                        <ChevronRight className="w-4 h-4 rotate-90" />
                      </div>
                    </div>
                  </div>

                  {/* Profile Settings */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                       <SettingsIcon className="w-5 h-5 text-gray-400" />
                       <h4 className="font-bold text-gray-900 text-sm">General Profile Information</h4>
                    </div>
                    <div className="space-y-3">
                       <div className="space-y-1">
                         <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Username</label>
                         <input 
                           type="text"
                           defaultValue={editingUser.username}
                           onChange={(e) => {
                             const val = e.target.value;
                             if (val.toLowerCase().includes('imchat')) {
                               alert("Validation Error: Usernames cannot contain the blacklisted word 'imchat'. Please choose a different username.");
                               e.target.value = editingUser.username || '';
                               return;
                             }
                             handleUpdateUserData(editingUser.id, { username: val });
                           }}
                           className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 text-sm font-medium"
                         />
                       </div>
                       <div className="space-y-1">
                         <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                         <input 
                           type="text"
                           defaultValue={editingUser.name}
                           onChange={(e) => handleUpdateUserData(editingUser.id, { name: e.target.value })}
                           className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 text-sm font-medium"
                         />
                       </div>
                       <div className="space-y-1">
                         <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Bio / Persona Prompt</label>
                         <textarea 
                           rows={2}
                           defaultValue={editingUser.bio}
                           onChange={(e) => handleUpdateUserData(editingUser.id, { bio: e.target.value })}
                           className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 text-sm font-medium resize-none"
                         />
                       </div>
                       <div className="space-y-1">
                         <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Avatar Image URL</label>
                         <input 
                           type="text"
                           defaultValue={editingUser.avatar}
                           onChange={(e) => handleUpdateUserData(editingUser.id, { avatar: e.target.value })}
                           className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 text-xs font-mono"
                         />
                       </div>
                    </div>
                  </div>

                  {/* Profile Stats Override */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                       <Users className="w-5 h-5 text-purple-500" />
                       <h4 className="font-bold text-gray-900 text-sm">Profile Statistics Override</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1">
                         <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Followers Override</label>
                         <input 
                           type="number"
                           min="0"
                           placeholder="Dynamic"
                           defaultValue={editingUser.adminFollowersCount !== undefined ? editingUser.adminFollowersCount : ''}
                           onChange={(e) => {
                             const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                             handleUpdateUserData(editingUser.id, { adminFollowersCount: val });
                           }}
                           className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500/10 text-sm font-medium"
                         />
                       </div>
                       <div className="space-y-1">
                         <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Following Override</label>
                         <input 
                           type="number"
                           min="0"
                           placeholder="Dynamic"
                           defaultValue={editingUser.adminFollowingCount !== undefined ? editingUser.adminFollowingCount : ''}
                           onChange={(e) => {
                             const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                             handleUpdateUserData(editingUser.id, { adminFollowingCount: val });
                           }}
                           className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500/10 text-sm font-medium"
                         />
                       </div>
                    </div>
                  </div>

                  {/* Security & Enforcement */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                       <AlertTriangle className="w-5 h-5 text-red-500" />
                       <h4 className="font-bold text-red-900 text-sm">Security & Enforcement</h4>
                    </div>
                    <div className="p-5 bg-red-50/70 rounded-2xl border border-red-100 space-y-4">
                       <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                             <div className="text-sm font-bold text-gray-900">Reset Password</div>
                             <div className="text-[10px] text-gray-500 font-medium leading-tight">Send a recovery link to user's registered email.</div>
                          </div>
                          <button 
                             onClick={() => handleAdminResetPassword(editingUser.email)}
                             disabled={isResettingPassword || !editingUser.email}
                             className="px-4 py-2 bg-white border border-gray-200 text-brand-blue rounded-xl text-[10px] font-bold uppercase hover:bg-blue-50 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                          >
                             {isResettingPassword ? <Loader2 className="w-3 h-3 animate-spin" /> : <Key className="w-3 h-3" />}
                             {resetEmailSentTo === editingUser.email ? 'Sent!' : 'Reset Link'}
                          </button>
                       </div>

                       <div className="flex items-center justify-between border-t border-red-100 pt-4">
                          <div className="space-y-0.5 flex-1 pr-4">
                             <div className="text-sm font-bold text-gray-900">Set New Password</div>
                             <div className="text-[10px] text-gray-400 font-medium leading-tight mb-2">Directly override the user's current password.</div>
                             <input 
                               type="password"
                               placeholder="Min 6 chars"
                               value={adminNewPassword}
                               onChange={(e) => setAdminNewPassword(e.target.value)}
                               className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-brand-blue"
                             />
                          </div>
                          <button 
                             onClick={() => handleAdminSetRealPassword(editingUser.id)}
                             disabled={isUpdatingPassword}
                             className="px-4 py-2 bg-brand-blue text-white rounded-xl text-[10px] font-bold uppercase hover:bg-blue-600 transition-all shadow-sm flex items-center gap-2 self-end mb-1"
                          >
                             {isUpdatingPassword ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                             Update
                          </button>
                       </div>

                                               <div className="flex items-center justify-between border-t border-blue-100 pt-4">
                           <div className="space-y-0.5">
                              <div className="text-sm font-bold text-blue-900">Freeze Account</div>
                              <div className="text-[10px] text-blue-600 font-medium leading-tight">Restrict user from posting and messaging, leaving browsing working.</div>
                           </div>
                           <button 
                              type="button"
                              onClick={async () => {
                                const newFrozenState = !editingUser.isFrozen;
                                try {
                                  await updateDoc(doc(db, "users", editingUser.id), { isFrozen: newFrozenState });
                                  setEditingUser({ ...editingUser, isFrozen: newFrozenState });
                                  alert(newFrozenState ? "User profile is FROZEN! They can browse but not post or message." : "User profile is unfrozen.");
                                } catch (err) {
                                  console.error("Failed to freeze user:", err);
                                }
                              }}
                              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all shadow-sm ${
                                editingUser.isFrozen ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-blue-600 text-white hover:bg-blue-700'
                              }`}
                           >
                              {editingUser.isFrozen ? 'Unfreeze' : 'Freeze'}
                           </button>
                        </div>

<div className="flex items-center justify-between border-t border-red-100 pt-4">
                          <div className="space-y-0.5">
                             <div className="text-sm font-bold text-red-900">Ban Account</div>
                             <div className="text-[10px] text-red-600 font-medium leading-tight">Restrict user access to all features instantly.</div>
                          </div>
                          <button 
                             onClick={() => {
                               const newStatus = editingUser.status === 'banned' ? 'active' : 'banned';
                               updateDoc(doc(db, "users", editingUser.id), { status: newStatus });
                               setEditingUser({ ...editingUser, status: newStatus });
                             }}
                             className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all shadow-sm ${
                               editingUser.status === 'banned' ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-red-600 text-white hover:bg-red-700'
                             }`}
                          >
                             {editingUser.status === 'banned' ? 'Unban User' : 'Ban User'}
                          </button>
                       </div>

                       <div className="flex items-center justify-between border-t border-red-100 pt-4">
                          <div className="space-y-0.5">
                             <div className="text-sm font-bold text-red-900">Ban Source IP</div>
                             <div className="text-[10px] text-red-600 font-medium leading-tight">Block IP: {editingUser.lastIp || 'N/A'}</div>
                          </div>
                          <button 
                             disabled={isModerator || !editingUser.lastIp}
                             onClick={() => handleBanIp(editingUser.lastIp, editingUser.id)}
                             className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-xl text-[10px] font-bold uppercase hover:bg-red-50 disabled:opacity-50 transition-all shadow-sm"
                          >
                             Ban IP Address
                          </button>
                       </div>

                       <div className="flex items-center justify-between border-t border-red-100 pt-4">
                          <div className="space-y-0.5">
                             <div className="text-sm font-bold text-red-900">Permanent Removal</div>
                             <div className="text-[10px] text-red-600 font-medium leading-tight">Delete user from both Firebase Auth and Firestore.</div>
                          </div>
                          <button 
                             onClick={() => { if (isModerator) return; handleAdminDeleteUser(editingUser.id); }}
                            className="px-4 py-2 bg-red-600 text-white rounded-xl text-[10px] font-bold uppercase hover:bg-red-700 transition-all shadow-sm"
                          >
                             Delete Account
                          </button>
                        </div>
                     </div>

                        {!isModerator && (
                          <div className="flex items-center justify-between border-t border-indigo-150 pt-4 bg-indigo-50/20 p-4 rounded-xl mt-4">
                             <div className="space-y-0.5 text-left">
                                <div className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5 uppercase tracking-wide">
                                  <BadgeCheck className="w-4 h-4 text-indigo-600 fill-indigo-100" />
                                  <span>Verification Badge (Admin Only)</span>
                                </div>
                                <div className="text-[10px] text-indigo-700 font-semibold leading-tight mt-1">
                                  {editingUser.isVerified ? 'Currently VERIFIED' : 'Currently UNVERIFIED (No Badge)'}
                                </div>
                             </div>
                             <button 
                                type="button"
                                onClick={async () => {
                                  const newVerifiedState = !editingUser.isVerified;
                                  try {
                                    await updateDoc(doc(db, "users", editingUser.id), { isVerified: newVerifiedState });
                                    setEditingUser({ ...editingUser, isVerified: newVerifiedState });
                                    alert(newVerifiedState ? "User flagged as verified!" : "User unverified! Badge stripped.");
                                  } catch (err) {
                                    console.error(err);
                                  }
                                }}
                                className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all shadow-sm ${
                                  editingUser.isVerified ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                }`}
                             >
                                {editingUser.isVerified ? 'Unverify Account' : 'Verify Account'}
                             </button>
                          </div>
                        )}
                       </div>
                     </div>

                <div className="p-8 border-t border-gray-100 bg-gray-50/50 flex gap-4 shrink-0">
                   <button 
                     onClick={() => setEditingUser(null)}
                     className="flex-1 py-4 bg-white border border-gray-200 text-gray-600 font-bold rounded-2xl hover:bg-gray-50 transition-all shadow-sm"
                   >
                     Close
                   </button>
                   <button 
                     onClick={() => {
                        setEditingUser(null);
                        alert("Settings synced with database successfully.");
                     }}
                     className="flex-1 py-4 bg-brand-blue text-white font-bold rounded-2xl shadow-lg shadow-blue-100 hover:bg-blue-600 active:scale-95 transition-all"
                   >
                     Done
                   </button>
                </div>
              </motion.div>
            </div>
          )}

          {(editingChannel || showNewChannelModal) && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
              >
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 text-lg">
                    {showNewChannelModal ? 'Launch New Channel' : 'Edit Channel'}
                  </h3>
                  <button 
                    onClick={() => {
                      setEditingChannel(null);
                      setShowNewChannelModal(false);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <Plus className="w-5 h-5 rotate-45 text-gray-400" />
                  </button>
                </div>
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const name = formData.get('name') as string;
                    const descVal = formData.get('description') as string;
                    
                    if (showNewChannelModal) {
                      try {
                        await addDoc(collection(db, 'channels'), {
                          name,
                          description: descVal || 'Official channel launched by Administrator.',
                          coverUrl: `https://picsum.photos/seed/${name.replace(/\s+/g, '')}/600/300`,
                          ownerId: auth.currentUser?.uid || 'admin',
                          ownerEmail: auth.currentUser?.email || 'admin@imchat.app',
                          subscribers: [],
                          posts: [],
                          isVerified: true,
                          createdAt: serverTimestamp()
                        });
                        alert("Channel created successfully!");
                      } catch (err) {
                        console.error("Failed to create channel document in DB:", err);
                        alert("Failed to create channel: " + (err instanceof Error ? err.message : String(err)));
                      }
                    } else if (editingChannel) {
                      try {
                        const subsVal = Number(formData.get('subscribers') || 0);
                        let finalSubscribers = editingChannel.subscribers || [];
                        if (Array.isArray(finalSubscribers)) {
                          if (finalSubscribers.length < subsVal) {
                            const diff = subsVal - finalSubscribers.length;
                            finalSubscribers = [
                              ...finalSubscribers,
                              ...Array.from({ length: diff }, (_, i) => `mock_sub_${Date.now()}_${i}`)
                            ];
                          } else if (finalSubscribers.length > subsVal) {
                            finalSubscribers = finalSubscribers.slice(0, subsVal);
                          }
                        } else {
                          finalSubscribers = Array.from({ length: subsVal }, (_, i) => `mock_sub_${Date.now()}_${i}`);
                        }

                        await updateDoc(doc(db, 'channels', editingChannel.id), {
                          name,
                          description: descVal || editingChannel.description || '',
                          subscribers: finalSubscribers
                        });
                        alert("Channel changes saved successfully!");
                      } catch (err) {
                        console.error("Failed to update channel document in DB:", err);
                        alert("Failed to save changes: " + (err instanceof Error ? err.message : String(err)));
                      }
                    }
                    
                    setEditingChannel(null);
                    setShowNewChannelModal(false);
                  }}
                  className="p-6 space-y-4"
                >
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Channel Name</label>
                    <input 
                      name="name"
                      defaultValue={editingChannel?.name || ''}
                      placeholder="e.g. Daily News"
                      required
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-medium text-sm text-gray-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Description</label>
                    <textarea 
                      name="description"
                      defaultValue={editingChannel?.description || ''}
                      placeholder="Describe this channel..."
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-medium resize-none text-sm text-gray-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Mock Subscriber Count</label>
                    <input 
                      name="subscribers"
                      type="number"
                      defaultValue={Array.isArray(editingChannel?.subscribers) ? editingChannel.subscribers.length : (typeof editingChannel?.subscribers === 'number' ? editingChannel.subscribers : 0)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-medium text-sm text-gray-900"
                    />
                  </div>

                  {!isModerator && editingChannel && (
                    <div className="flex items-center justify-between border border-indigo-100 bg-indigo-50/20 p-4 rounded-xl">
                      <div className="space-y-0.5 text-left">
                        <div className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5 uppercase tracking-wide">
                          <BadgeCheck className="w-4 h-4 text-indigo-600 fill-indigo-100" />
                          <span>Channel Verification (Admin Only)</span>
                        </div>
                        <div className="text-[10px] text-indigo-700 font-semibold leading-tight mt-1">
                          {editingChannel.isVerified ? 'Badge is currently ACTIVE' : 'Currently UNVERIFIED (No Badge)'}
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={async () => {
                          const newVerifiedState = !editingChannel.isVerified;
                          try {
                            await updateDoc(doc(db, "channels", editingChannel.id), { isVerified: newVerifiedState });
                            setEditingChannel({ ...editingChannel, isVerified: newVerifiedState });
                            alert(newVerifiedState ? "Channel verified! Badge added." : "Channel unverified! Badge stripped.");
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all shadow-sm cursor-pointer ${
                          editingChannel.isVerified ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                      >
                        {editingChannel.isVerified ? 'Unverify' : 'Verify'}
                      </button>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button"
                      onClick={() => {
                        setEditingChannel(null);
                        setShowNewChannelModal(false);
                      }}
                      className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-3 bg-brand-blue text-white font-bold rounded-xl shadow-lg shadow-blue-100 hover:bg-blue-600 active:scale-95 transition-all outline-none"
                    >
                      {showNewChannelModal ? 'Create Channel' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}

          {(editingGroup || showNewGroupModal) && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
              >
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 text-lg">
                    {showNewGroupModal ? 'Launch New Group' : 'Edit Group'}
                  </h3>
                  <button 
                    onClick={() => {
                      setEditingGroup(null);
                      setShowNewGroupModal(false);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <Plus className="w-5 h-5 rotate-45 text-gray-400" />
                  </button>
                </div>
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const title = formData.get('title') as string;
                    const membersCountStr = formData.get('membersCount') as string;
                    const isPrivate = formData.get('privacy') === 'PRIVATE';
                    
                    const addedMembersCount = parseInt(membersCountStr) || 0;
                    
                    if (showNewGroupModal) {
                      // Generate mock members if needed to respect the 'add number of group members' request
                      const mockMembers = [];
                      for (let i = 0; i < addedMembersCount; i++) {
                        mockMembers.push({
                          userId: `mock_${Date.now()}_${i}`,
                          name: `Mock Member ${i+1}`,
                          role: 'member',
                          avatar: 'https://via.placeholder.com/150'
                        });
                      }
                      
                      await GroupStore.addGroup({
                        uid: `im_g_${Date.now()}`,
                        title,
                        description: 'Created by Admin',
                        coverUrl: '',
                        isPrivate,
                        members: mockMembers,
                      } as any);
                    } else if (editingGroup) {
                      // Add mock members to existing array if requested to increase it
                      const updatedMembers = [...(editingGroup.members || [])];
                      const currentLength = updatedMembers.length;
                      
                      if (addedMembersCount > currentLength) {
                        const needed = addedMembersCount - currentLength;
                        for (let i = 0; i < needed; i++) {
                          updatedMembers.push({
                            userId: `mock_${Date.now()}_${i}`,
                            name: `Added Member ${i+1}`,
                            role: 'member',
                            avatar: 'https://via.placeholder.com/150'
                          });
                        }
                      } else if (addedMembersCount < currentLength) {
                         // remove members if count is lower
                         updatedMembers.splice(addedMembersCount);
                      }
                      
                      await GroupStore.updateGroup(editingGroup.id, { 
                        title, 
                        isPrivate,
                        members: updatedMembers 
                      });
                    }
                    
                    setEditingGroup(null);
                    setShowNewGroupModal(false);
                  }}
                  className="p-6 space-y-4"
                >
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Group Name</label>
                    <input 
                      name="title"
                      defaultValue={editingGroup?.title || ''}
                      placeholder="e.g. AI Explorers"
                      required
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Member Count (Overwrites Array)</label>
                    <input 
                      name="membersCount"
                      type="number"
                      defaultValue={editingGroup?.members?.length || 0}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Privacy</label>
                    <select 
                      name="privacy"
                      defaultValue={editingGroup?.isPrivate ? 'PRIVATE' : 'PUBLIC'}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-medium appearance-none"
                    >
                      <option value="PUBLIC">PUBLIC</option>
                      <option value="PRIVATE">PRIVATE</option>
                    </select>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button"
                      onClick={() => {
                        setEditingGroup(null);
                        setShowNewGroupModal(false);
                      }}
                      className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-3 bg-brand-blue text-white font-bold rounded-xl shadow-lg shadow-blue-100 hover:bg-blue-600 active:scale-95 transition-all outline-none"
                    >
                      {showNewGroupModal ? 'Create Group' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}

          {/* USER CONTENT MODERATION INSPECTOR MODAL */}
          {selectedUserForContent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in text-left">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-100"
              >
                {/* Modal Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <div className="flex items-center gap-4">
                    <UserAvatar 
                      src={selectedUserForContent.avatar} 
                      name={selectedUserForContent.name || 'User'} 
                      size="lg" 
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-xl text-gray-900">{selectedUserForContent.name || 'User'}</h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-blue-100 text-brand-blue">
                          {selectedUserForContent.role || 'Member'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">
                        {selectedUserForContent.handle ? `@${selectedUserForContent.handle}` : selectedUserForContent.email || selectedUserForContent.id}
                      </p>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      setSelectedUserForContent(null);
                      setSelectedPostIdsForUser(new Set());
                      setSelectedCommentIdsForUser(new Set());
                      setSelectedMediaIdsForUser(new Set());
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200/50 rounded-full transition-colors cursor-pointer"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Subheader / Tabs */}
                <div className="px-6 pt-4 border-b border-gray-100 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setUserContentTab('posts')}
                      className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                        userContentTab === 'posts' 
                          ? 'border-brand-blue text-brand-blue bg-blue-50/40' 
                          : 'border-transparent text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      <span>Posts ({selectedUserPosts.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUserContentTab('comments')}
                      className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                        userContentTab === 'comments' 
                          ? 'border-brand-blue text-brand-blue bg-blue-50/40' 
                          : 'border-transparent text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Comments ({selectedUserComments.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUserContentTab('media')}
                      className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                        userContentTab === 'media' 
                          ? 'border-brand-blue text-brand-blue bg-blue-50/40' 
                          : 'border-transparent text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      <ImageIcon className="w-4 h-4" />
                      <span>Media Files ({selectedUserMedia.length})</span>
                    </button>
                  </div>

                  {/* Nuclear Delete Option */}
                  <button
                    type="button"
                    onClick={() => handleNuclearDeleteAllUserContent(selectedUserForContent)}
                    disabled={isDeletingUserContent}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl border border-red-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                    <span>Delete All User Data</span>
                  </button>
                </div>

                {/* Tab Body */}
                <div className="p-6 overflow-y-auto flex-1 max-h-[60vh] bg-gray-50/30">
                  {/* Posts Tab */}
                  {userContentTab === 'posts' && (
                    <div className="space-y-4">
                      {/* Bulk bar */}
                      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedPostIdsForUser.size === selectedUserPosts.length) {
                                setSelectedPostIdsForUser(new Set());
                              } else {
                                setSelectedPostIdsForUser(new Set(selectedUserPosts.map(p => p.id)));
                              }
                            }}
                            className="text-xs text-gray-600 hover:text-gray-900 font-bold flex items-center gap-1.5 cursor-pointer"
                          >
                            {selectedPostIdsForUser.size === selectedUserPosts.length && selectedUserPosts.length > 0 ? (
                              <>
                                <Square className="w-4 h-4 text-brand-blue" />
                                <span>Deselect All</span>
                              </>
                            ) : (
                              <>
                                <CheckSquare className="w-4 h-4 text-gray-400" />
                                <span>Select All Posts</span>
                              </>
                            )}
                          </button>
                          {selectedPostIdsForUser.size > 0 && (
                            <span className="text-xs text-brand-blue font-bold">
                              {selectedPostIdsForUser.size} of {selectedUserPosts.length} selected
                            </span>
                          )}
                        </div>

                        {selectedPostIdsForUser.size > 0 && (
                          <button
                            type="button"
                            onClick={handleDeleteUserPostsBulk}
                            disabled={isDeletingUserContent}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Selected ({selectedPostIdsForUser.size})</span>
                          </button>
                        )}
                      </div>

                      {/* Post items */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {selectedUserPosts.map(post => {
                          const isChecked = selectedPostIdsForUser.has(post.id);
                          return (
                            <div 
                              key={post.id} 
                              className={`p-4 bg-white rounded-2xl border transition-all relative flex flex-col justify-between ${
                                isChecked ? 'border-brand-blue ring-2 ring-brand-blue/20 bg-blue-50/10' : 'border-gray-100 hover:border-gray-200 shadow-xs'
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        const next = new Set(selectedPostIdsForUser);
                                        if (e.target.checked) next.add(post.id);
                                        else next.delete(post.id);
                                        setSelectedPostIdsForUser(next);
                                      }}
                                      className="w-4 h-4 rounded text-brand-blue focus:ring-brand-blue cursor-pointer"
                                    />
                                    <span className="text-[11px] text-gray-400 font-mono">
                                      {post.timestamp ? new Date(post.timestamp).toLocaleDateString() : 'Recent'}
                                    </span>
                                  </label>

                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (confirm("Delete this post permanently?")) {
                                        await PostStore.deletePost(post.id);
                                      }
                                    }}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                    title="Delete post"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>

                                {post.image && (
                                  <div className="mb-2 rounded-xl overflow-hidden bg-black max-h-36">
                                    {!(post.mediaType === 'video' || (typeof post.image === 'string' && (post.image.includes('.mp4') || post.image.includes('.webm') || post.image.includes('.mov') || post.image.includes('video/') || post.image.includes('blob:')))) ? (
                                      <img src={post.image} className="w-full h-32 object-cover" />
                                    ) : (
                                      <video src={post.image} className="w-full h-32 object-cover" />
                                    )}
                                  </div>
                                )}

                                <p className="text-xs text-gray-800 line-clamp-3 mb-2">{post.caption || 'No caption'}</p>
                              </div>

                              <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 pt-2 border-t border-gray-50">
                                <span>Likes: {typeof post.likesOverride === 'number' ? post.likesOverride : (post.likes?.length || 0)}</span>
                                <span>Comments: {post.comments?.length || 0}</span>
                              </div>
                            </div>
                          );
                        })}

                        {selectedUserPosts.length === 0 && (
                          <div className="col-span-full py-12 text-center text-gray-400 text-xs">
                            No posts authored by this user.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Comments Tab */}
                  {userContentTab === 'comments' && (
                    <div className="space-y-4">
                      {/* Bulk bar */}
                      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedCommentIdsForUser.size === selectedUserComments.length) {
                                setSelectedCommentIdsForUser(new Set());
                              } else {
                                setSelectedCommentIdsForUser(new Set(selectedUserComments.map(c => `${c.post.id}:::${c.comment.id}`)));
                              }
                            }}
                            className="text-xs text-gray-600 hover:text-gray-900 font-bold flex items-center gap-1.5 cursor-pointer"
                          >
                            {selectedCommentIdsForUser.size === selectedUserComments.length && selectedUserComments.length > 0 ? (
                              <>
                                <Square className="w-4 h-4 text-brand-blue" />
                                <span>Deselect All</span>
                              </>
                            ) : (
                              <>
                                <CheckSquare className="w-4 h-4 text-gray-400" />
                                <span>Select All Comments</span>
                              </>
                            )}
                          </button>
                          {selectedCommentIdsForUser.size > 0 && (
                            <span className="text-xs text-brand-blue font-bold">
                              {selectedCommentIdsForUser.size} of {selectedUserComments.length} selected
                            </span>
                          )}
                        </div>

                        {selectedCommentIdsForUser.size > 0 && (
                          <button
                            type="button"
                            onClick={handleDeleteUserCommentsBulk}
                            disabled={isDeletingUserContent}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Selected ({selectedCommentIdsForUser.size})</span>
                          </button>
                        )}
                      </div>

                      {/* Comment Items */}
                      <div className="space-y-2">
                        {selectedUserComments.map(item => {
                          const key = `${item.post.id}:::${item.comment.id}`;
                          const isChecked = selectedCommentIdsForUser.has(key);
                          return (
                            <div 
                              key={key}
                              className={`p-3.5 bg-white rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                                isChecked ? 'border-brand-blue ring-2 ring-brand-blue/20 bg-blue-50/10' : 'border-gray-100 hover:border-gray-200'
                              }`}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const next = new Set(selectedCommentIdsForUser);
                                    if (e.target.checked) next.add(key);
                                    else next.delete(key);
                                    setSelectedCommentIdsForUser(next);
                                  }}
                                  className="w-4 h-4 rounded text-brand-blue focus:ring-brand-blue cursor-pointer shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                      On Post: "{item.post.caption ? item.post.caption.slice(0, 30) + '...' : item.post.id}"
                                    </span>
                                    <span className="text-[10px] text-gray-300">•</span>
                                    <span className="text-[10px] text-gray-400 font-mono">
                                      {item.comment.timestamp ? new Date(item.comment.timestamp).toLocaleDateString() : 'Recent'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-800 font-medium break-words">{item.comment.text}</p>
                                  {item.comment.audioUrl && (
                                    <div className="mt-1.5 flex items-center gap-2">
                                      <audio src={item.comment.audioUrl} controls className="h-7 max-w-[220px]" />
                                      <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                        🎙️ Voice Clip ({item.comment.audioDuration || 0}s)
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={async () => {
                                  if (confirm("Delete this comment?")) {
                                    await PostStore.deleteComment(item.post.id, item.comment.id);
                                  }
                                }}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                                title="Delete comment"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}

                        {selectedUserComments.length === 0 && (
                          <div className="py-12 text-center text-gray-400 text-xs">
                            No comments authored by this user.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Media Tab */}
                  {userContentTab === 'media' && (
                    <div className="space-y-4">
                      {/* Bulk bar */}
                      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedMediaIdsForUser.size === selectedUserMedia.length) {
                                setSelectedMediaIdsForUser(new Set());
                              } else {
                                setSelectedMediaIdsForUser(new Set(selectedUserMedia.map(m => m.id)));
                              }
                            }}
                            className="text-xs text-gray-600 hover:text-gray-900 font-bold flex items-center gap-1.5 cursor-pointer"
                          >
                            {selectedMediaIdsForUser.size === selectedUserMedia.length && selectedUserMedia.length > 0 ? (
                              <>
                                <Square className="w-4 h-4 text-brand-blue" />
                                <span>Deselect All</span>
                              </>
                            ) : (
                              <>
                                <CheckSquare className="w-4 h-4 text-gray-400" />
                                <span>Select All Media</span>
                              </>
                            )}
                          </button>
                          {selectedMediaIdsForUser.size > 0 && (
                            <span className="text-xs text-brand-blue font-bold">
                              {selectedMediaIdsForUser.size} of {selectedUserMedia.length} selected
                            </span>
                          )}
                        </div>

                        {selectedMediaIdsForUser.size > 0 && (
                          <button
                            type="button"
                            onClick={handleDeleteUserMediaBulk}
                            disabled={isDeletingUserContent}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Selected ({selectedMediaIdsForUser.size})</span>
                          </button>
                        )}
                      </div>

                      {/* Media Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {selectedUserMedia.map(media => {
                          const isChecked = selectedMediaIdsForUser.has(media.id);
                          return (
                            <div 
                              key={media.id} 
                              className={`p-2 bg-white rounded-2xl border transition-all relative flex flex-col justify-between ${
                                isChecked ? 'border-brand-blue ring-2 ring-brand-blue/20 bg-blue-50/10' : 'border-gray-100 hover:border-gray-200 shadow-xs'
                              }`}
                            >
                              <div className="relative rounded-xl overflow-hidden bg-black aspect-video mb-2">
                                {media.type === 'video' ? (
                                  <video src={media.url} className="w-full h-full object-cover" />
                                ) : (
                                  <img src={media.url} className="w-full h-full object-cover" />
                                )}
                                <div className="absolute top-1.5 left-1.5">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      const next = new Set(selectedMediaIdsForUser);
                                      if (e.target.checked) next.add(media.id);
                                      else next.delete(media.id);
                                      setSelectedMediaIdsForUser(next);
                                    }}
                                    className="w-4 h-4 rounded text-brand-blue focus:ring-brand-blue cursor-pointer shadow-md"
                                  />
                                </div>
                              </div>

                              <div className="flex items-center justify-between px-1">
                                <span className="text-[10px] text-gray-500 font-mono truncate max-w-[100px]">{media.name || media.caption || media.id}</span>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (confirm("Delete this media item?")) {
                                      await MediaStore.deleteMedia(media.id);
                                    }
                                  }}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                  title="Delete media"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {selectedUserMedia.length === 0 && (
                          <div className="col-span-full py-12 text-center text-gray-400 text-xs">
                            No media files uploaded by this user.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUserForContent(null);
                      setSelectedPostIdsForUser(new Set());
                      setSelectedCommentIdsForUser(new Set());
                      setSelectedMediaIdsForUser(new Set());
                    }}
                    className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Close Inspector
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
