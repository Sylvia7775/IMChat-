import { useState, useEffect } from 'react';
import { 
  ArrowLeft, User, Mail, AlignLeft, Bell, Check, Trash2, HardDrive, RefreshCcw, 
  Camera, ShieldCheck, Loader2, Key, ChevronRight, Hash, Phone, Wallet, 
  Sparkles, ShieldAlert, Laptop, EyeOff, LayoutGrid, Award, ShoppingBag, PlusCircle, ArrowRightLeft, Radio, MapPin,
  Sun, Moon, Volume2, Music, GitBranch, GitPullRequest, ExternalLink,
  Zap, RefreshCw, Battery, Activity, Crown, Shield, CheckCircle2, Lock, Fingerprint,
  Download, FileJson
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BiometricAuthService, BiometricProfile } from './lib/BiometricAuth';
import { VideoCache } from './lib/VideoCache';
import { uploadToCloudinary } from './lib/cloudinary';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { doc, deleteDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { 
  playNotificationSound, 
  getGlobalDefaultBell, 
  getGlobalDefaultBellName, 
  getGlobalDefaultBellAudioUrl, 
  setGlobalDefaultBell 
} from './lib/NotificationSound';
import { triggerWelcomeEmail, testWelcomeEmail } from './lib/EmailService';
import DataExportSection from './components/DataExportSection';
import { PayPalCheckoutModal } from './components/PayPalCheckoutModal';
import { CaptureOrderResponse, getPayPalTransactions, PayPalTransaction } from './services/paypalService';
import { isAuthorizedAdmin, sanitizeUserRole, isDemotedUser } from './lib/adminAccess';
export interface AdCampaign {
  id: string;
  userId: string;
  campaignName: string;
  caption: string;
  image: string;
  placement: 'feed' | 'reels' | 'groups';
  ctaText: string;
  ctaLink: string;
  budget: number;
  clicks: number;
  impressions: number;
  status: 'active' | 'paused';
  createdAt: number;
}

export interface BusinessProduct {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  price: number;
  description: string;
  image: string;
  category: 'premium_content' | 'video_pack' | 'ebook' | 'exclusive_media';
  salesCount: number;
}

export interface SecondaryAccount {
  id: string;
  name: string;
  surname: string;
  username: string;
  avatar: string;
  bio: string;
  age: number;
  gender: string;
  phone: string;
  email: string;
  walletBalance: number;
  isBusinessAccount: boolean;
  businessName?: string;
  businessCategory?: string;
  city?: string;
}

export const BusinessStore = {
  getAds: (): AdCampaign[] => [],
  buyAd: (...args: any[]): any => ({ success: true, campaign: {} }),
  getProducts: (): BusinessProduct[] => [],
  addProduct: (...args: any[]): any => ({}),
  getAlternativeAccount: (...args: any[]): any => null,
  saveAlternativeAccount: (...args: any[]) => {},
};

export default function SettingsPage({ onClose, onSave, initialData, isNewUser, userRole }: { 
  onClose: () => void, 
  onSave?: (data: any) => Promise<void> | void,
  initialData?: any,
  isNewUser?: boolean,
  userRole?: string
}) {
  // Main settings fields
  const [name, setName] = useState(initialData?.name || '');
  const [surname, setSurname] = useState(initialData?.surname || '');
  const [username, setUsername] = useState(initialData?.username || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [bio, setBio] = useState(initialData?.bio || '');
  const [avatar, setAvatar] = useState(initialData?.avatar || '');
  const [notifications, setNotifications] = useState(initialData?.notifications ?? true);
  const [hideAvatarPublicly, setHideAvatarPublicly] = useState(initialData?.hideAvatarPublicly ?? false);
  const [profileLocked, setProfileLocked] = useState(initialData?.profileLocked ?? false);
  const [mfaEnabled, setMfaEnabled] = useState(initialData?.mfaEnabled ?? false);
  const [cacheSize, setCacheSize] = useState('0 B');

  // Expanded fields
  const [age, setAge] = useState<number>(initialData?.age || 22);
  const [gender, setGender] = useState<string>(initialData?.gender || 'Male');
  const [phone, setPhone] = useState<string>(initialData?.phone || '');
  const [city, setCity] = useState<string>(initialData?.city || '');
  const [role, setRole] = useState<string>(() => sanitizeUserRole(initialData?.role || userRole || 'user', auth.currentUser?.email));
  
  // Email & features settings
  const [emailMarketing, setEmailMarketing] = useState<boolean>(initialData?.emailMarketing ?? true);
  const [emailSecurityAlerts, setEmailSecurityAlerts] = useState<boolean>(initialData?.emailSecurityAlerts ?? true);
  const [emailActivityNotifications, setEmailActivityNotifications] = useState<boolean>(initialData?.emailActivityNotifications ?? true);
  const [autoWelcomeEmailEnabled, setAutoWelcomeEmailEnabled] = useState<boolean>(true);
  const [sendingWelcomeTest, setSendingWelcomeTest] = useState<boolean>(false);
  const [welcomeTestResult, setWelcomeTestResult] = useState<string | null>(null);
  const [lowDataMode, setLowDataMode] = useState<boolean>(initialData?.lowDataMode ?? false);
  const [offlineMode, setOfflineMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('imchat_force_offline_mode') === 'true';
    }
    return false;
  });

  const [batterySaverEnabled, setBatterySaverEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('batterySaverEnabled') === 'true';
    }
    return false;
  });

  const [batterySyncFrequency, setBatterySyncFrequency] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('batterySyncFrequency');
      return saved ? parseInt(saved, 10) : 45;
    }
    return 45;
  });

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

  const handleToggleBatterySaver = (checked: boolean) => {
    setBatterySaverEnabled(checked);
    localStorage.setItem('batterySaverEnabled', String(checked));
    window.dispatchEvent(new CustomEvent('battery-saver-settings-changed', {
      detail: { batterySaverEnabled: checked, syncFrequency: batterySyncFrequency }
    }));
  };

  const handleSelectSyncFrequency = (freq: number) => {
    setBatterySyncFrequency(freq);
    localStorage.setItem('batterySyncFrequency', String(freq));
    window.dispatchEvent(new CustomEvent('battery-saver-settings-changed', {
      detail: { batterySaverEnabled, syncFrequency: freq }
    }));
  };

  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system';
    }
    return 'system';
  });

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    
    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else if (newTheme === 'light') {
      root.classList.remove('dark');
    } else {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (systemPrefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
    window.dispatchEvent(new Event('theme-change'));
  };

  const handleToggleOfflineMode = () => {
    const newVal = !offlineMode;
    setOfflineMode(newVal);
    localStorage.setItem('imchat_force_offline_mode', String(newVal));
    window.dispatchEvent(new CustomEvent('connectivity-change', { detail: { isOffline: newVal } }));
  };

  // Wallet
  const [walletBalance, setWalletBalance] = useState<number>(initialData?.walletBalance ?? 1500);
  const [topupAmount, setTopupAmount] = useState<string>('500');
  const [paypalTopupAmount, setPaypalTopupAmount] = useState<string>('25');
  const [showPayPalModal, setShowPayPalModal] = useState(false);
  const [payPalParams, setPayPalParams] = useState<{
    amount: number;
    description: string;
    itemType: 'wallet_topup' | 'ad_campaign';
    metadata?: Record<string, any>;
  } | null>(null);
  const [paypalTransactions, setPaypalTransactions] = useState<PayPalTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Business Account state
  const [isBusinessAccount, setIsBusinessAccount] = useState<boolean>(initialData?.isBusinessAccount ?? false);
  const [businessName, setBusinessName] = useState<string>(initialData?.businessName || '');
  const [businessCategory, setBusinessCategory] = useState<string>(initialData?.businessCategory || 'Digital Content');

  // Business content sales lists
  const [myProducts, setMyProducts] = useState<BusinessProduct[]>([]);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProductTitle, setNewProductTitle] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('199');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [newProductCat, setNewProductCat] = useState<'premium_content' | 'video_pack' | 'ebook' | 'exclusive_media'>('premium_content');
  const [newProductImg, setNewProductImg] = useState('https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&q=80&w=300&h=300');

  // Ads Campaign Management
  const [myAds, setMyAds] = useState<AdCampaign[]>([]);
  const [showBuyAdModal, setShowBuyAdModal] = useState(false);
  const [newAdCampaignName, setNewAdCampaignName] = useState('');
  const [newAdCaption, setNewAdCaption] = useState('');
  const [newAdImage, setNewAdImage] = useState('');
  const [newAdPlacement, setNewAdPlacement] = useState<'feed' | 'reels' | 'groups'>('feed');
  const [newAdCtaText, setNewAdCtaText] = useState('Aprender Más');
  const [newAdLink, setNewAdLink] = useState('');
  const [adCampaignCost, setAdCampaignCost] = useState('300'); // in rupees ₹

  // Secondary accounts switcher states (Unlimited accounts)
  const [secondAccount, setSecondAccount] = useState<SecondaryAccount | null>(null);
  const [savedAccounts, setSavedAccounts] = useState<SecondaryAccount[]>([]);
  const [showSecondAccountForm, setShowSecondAccountForm] = useState(false);
  // Creating a secondary account state
  const [secName, setSecName] = useState('');
  const [secSurname, setSecSurname] = useState('');
  const [secUsername, setSecUsername] = useState('');
  const [secBio, setSecBio] = useState('');
  const [secAge, setSecAge] = useState<number>(25);
  const [secGender, setSecGender] = useState('Female');
  const [secPhone, setSecPhone] = useState('');
  const [secEmail, setSecEmail] = useState('');
  const [secAvatar, setSecAvatar] = useState('https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200&h=200');

  const [activeMenuTab, setActiveMenuTab] = useState<'profile' | 'security' | 'export' | 'notifications' | 'wallet' | 'switch' | 'business' | 'ads'>('profile');
  const [notificationBellType, setNotificationBellType] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('app_notification_bell_type') || getGlobalDefaultBell() || 'default_ring_bell';
    }
    return 'default_ring_bell';
  });
  const [customBellAudioUrl, setCustomBellAudioUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('custom_bell_audio_url') || '';
    }
    return '';
  });
  const [customBellName, setCustomBellName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('custom_bell_name') || 'My Custom Bell Audio';
    }
    return 'My Custom Bell Audio';
  });
  const [isUploadingBellAudio, setIsUploadingBellAudio] = useState(false);
  const [bellTestActive, setBellTestActive] = useState(false);

  // Global default bell state (Admin authoritative)
  const [globalDefaultBell, setGlobalDefaultBellState] = useState<string>(() => getGlobalDefaultBell());
  const [globalDefaultBellName, setGlobalDefaultBellNameState] = useState<string>(() => getGlobalDefaultBellName());
  const [globalDefaultBellUrl, setGlobalDefaultBellUrlState] = useState<string>(() => getGlobalDefaultBellAudioUrl());
  const [isSettingGlobalDefault, setIsSettingGlobalDefault] = useState(false);
  const [globalBellSuccessMsg, setGlobalBellSuccessMsg] = useState<string | null>(null);

  // Admin Verification check
  const currentUserUid = auth.currentUser?.uid || 'anonymous';
  const ownerEmails = ['mobilephonesky987@gmail.com', 'contact@imchat.im'];
  const isOwner = isAuthorizedAdmin(userRole || role, auth.currentUser?.email);

  useEffect(() => {
    const configRef = doc(db, 'system_config', 'global');
    const unsub = onSnapshot(configRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.defaultBellType) {
          setGlobalDefaultBellState(data.defaultBellType);
          setGlobalDefaultBellNameState(data.defaultBellName || data.defaultBellType);
          setGlobalDefaultBellUrlState(data.defaultBellAudioUrl || '');
          setGlobalDefaultBell(data.defaultBellType, data.defaultBellName, data.defaultBellAudioUrl);
        }
      }
    }, (err) => {
      console.warn("Global bell listener in settings:", err);
    });

    const handleGlobalBellEvent = (e: any) => {
      if (e.detail?.bellId) {
        setGlobalDefaultBellState(e.detail.bellId);
        if (e.detail.bellName) setGlobalDefaultBellNameState(e.detail.bellName);
        if (e.detail.bellAudioUrl !== undefined) setGlobalDefaultBellUrlState(e.detail.bellAudioUrl);
      }
    };
    window.addEventListener('global-bell-changed', handleGlobalBellEvent);

    return () => {
      unsub();
      window.removeEventListener('global-bell-changed', handleGlobalBellEvent);
    };
  }, []);

  const handleSetAsGlobalAppDefault = async (bellId: string, bellTitle?: string, customUrl?: string) => {
    if (!isOwner) {
      alert("Permission Denied: Only administrators are authorized to set the default bell for the whole application.");
      return;
    }

    const titleToSave = bellTitle || (bellId === 'custom_audio' ? (customBellName || 'Custom Bell Audio') : bellId);
    const urlToSave = customUrl || (bellId === 'custom_audio' ? customBellAudioUrl : '');

    setIsSettingGlobalDefault(true);
    setGlobalBellSuccessMsg(null);
    try {
      await setDoc(doc(db, "system_config", "global"), {
        defaultBellType: bellId,
        defaultBellName: titleToSave,
        defaultBellAudioUrl: urlToSave,
        updatedBy: auth.currentUser?.email || auth.currentUser?.displayName || 'Admin',
        updatedAt: serverTimestamp()
      }, { merge: true });

      setGlobalDefaultBell(bellId, titleToSave, urlToSave);
      setGlobalDefaultBellState(bellId);
      setGlobalDefaultBellNameState(titleToSave);
      setGlobalDefaultBellUrlState(urlToSave);
      setNotificationBellType(bellId);
      localStorage.setItem('app_notification_bell_type', bellId);

      setGlobalBellSuccessMsg(`App Default Bell updated! "${titleToSave}" is now the permanent default bell across IMChat for all users.`);
      playNotificationSound(bellId);
      setTimeout(() => setGlobalBellSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error("Failed setting global default bell from settings:", err);
      handleFirestoreError(err, OperationType.UPDATE, "system_config/global");
      alert("Error setting global default bell: " + (err?.message || "Failed to update configuration"));
    } finally {
      setIsSettingGlobalDefault(false);
    }
  };

  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteComment, setDeleteComment] = useState('');
  
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Biometric / Fingerprint State
  const [isBiometricEnrolled, setIsBiometricEnrolled] = useState<boolean>(false);
  const [biometricProfile, setBiometricProfile] = useState<BiometricProfile | null>(null);
  const [isEnrollingBiometric, setIsEnrollingBiometric] = useState(false);
  const [biometricStatusMsg, setBiometricStatusMsg] = useState<string>('');

  useEffect(() => {
    if (currentUserUid) {
      const profile = BiometricAuthService.getProfile(currentUserUid);
      setIsBiometricEnrolled(!!profile);
      setBiometricProfile(profile);
    }
  }, [currentUserUid]);

  const handleEnrollDeviceBiometric = async () => {
    const pwd = prompt("Enter your account password to register and link your fingerprint on this device:");
    if (!pwd) return;

    setIsEnrollingBiometric(true);
    setBiometricStatusMsg('Registering biometric credential on device...');
    try {
      const { profile } = await BiometricAuthService.enrollFingerprint({
        userId: currentUserUid,
        email: email || auth.currentUser?.email || '',
        displayName: name || auth.currentUser?.displayName || 'User',
        username: username,
        avatar: avatar || auth.currentUser?.photoURL || '',
        password: pwd
      });
      setIsBiometricEnrolled(true);
      setBiometricProfile(profile);
      setBiometricStatusMsg('✓ Fingerprint registered successfully on this device!');
      setTimeout(() => setBiometricStatusMsg(''), 4000);
    } catch (err: any) {
      console.error("Biometric enrollment error:", err);
      alert(err.message || 'Failed to register fingerprint.');
      setBiometricStatusMsg('');
    } finally {
      setIsEnrollingBiometric(false);
    }
  };

  const handleRemoveDeviceBiometric = () => {
    if (confirm("Remove registered fingerprint for this account from this device?")) {
      BiometricAuthService.removeEnrollment(currentUserUid);
      setIsBiometricEnrolled(false);
      setBiometricProfile(null);
      setBiometricStatusMsg('Fingerprint credential removed from this device.');
      setTimeout(() => setBiometricStatusMsg(''), 3000);
    }
  };

  useEffect(() => {
    // Media Storage cache check
    VideoCache.getCacheSize().then(setCacheSize).catch(err => console.error("Failed to get cache size:", err));
    
    // Load local business store properties
    setMyAds(BusinessStore.getAds().filter(ad => ad.userId === currentUserUid));
    setMyProducts(BusinessStore.getProducts().filter(p => p.companyId === currentUserUid));

    // Load second account configuration
    const cachedSec = BusinessStore.getAlternativeAccount(currentUserUid);
    if (cachedSec) {
      setSecondAccount(cachedSec);
    }

    // Load unlimited device accounts
    const deviceAccounts = localStorage.getItem('imchat_device_accounts');
    if (deviceAccounts) {
      try {
        setSavedAccounts(JSON.parse(deviceAccounts));
      } catch (err) {
        console.error("Failed to parse device accounts", err);
      }
    }
  }, [currentUserUid]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    setAvatar(localUrl);

    try {
      setIsUploadingAvatar(true);
      const isVideo = file.name.toLowerCase().endsWith('.mp4') || file.type.startsWith('video/');
      const res = await uploadToCloudinary(file, isVideo ? 'video' : 'image');
      if (res && res.secure_url) {
        setAvatar(res.secure_url);
      }
    } catch (err) {
      console.error("Upload failure:", err);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (username.toLowerCase().includes('imchat')) {
      alert("Validation Error: Usernames cannot contain the blacklisted word 'imchat'. Please choose a different username.");
      return;
    }

    // Check if user is not admin and tries to rename/set names with admin terms
    const notAdmin = !isAuthorizedAdmin(initialData?.role, auth.currentUser?.email) && !isAuthorizedAdmin(userRole, auth.currentUser?.email);
    const forbiddenWords = ['admin', 'administrator', 'moderator', 'support', 'system', 'staff', 'owner', 'vip', 'member', 'team member'];
    const combinedText = `${name} ${surname} ${username}`.toLowerCase();
    const containsForbidden = forbiddenWords.some(word => combinedText.includes(word));
    
    if (notAdmin && containsForbidden) {
      alert("Validation Error: Display names or usernames cannot contain titles like 'Admin', 'Moderator', 'VIP', 'Member', or official system team prefixes.");
      return;
    }

    if (onSave) {
      setIsSaving(true);
      try {
        const payload = { 
          name, 
          surname, 
          username, 
          email, 
          bio, 
          avatar,
          notifications, 
          hideAvatarPublicly,
          profileLocked,
          mfaEnabled,
          age,
          gender,
          phone: phone.trim(),
          role,
          emailMarketing,
          emailSecurityAlerts,
          emailActivityNotifications,
          lowDataMode,
          walletBalance,
          isBusinessAccount,
          businessName,
          businessCategory,
          city: city.trim(),
          isSetupComplete: true 
        };
        await onSave(payload);
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          onClose();
        }, 1200);
      } catch (err) {
        console.error("Save failed:", err);
        alert("Failed to save settings.");
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      alert("Por favor introduce una dirección de correo.");
      return;
    }
    setIsSendingResetEmail(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetEmailSent(true);
      setTimeout(() => setResetEmailSent(false), 5000);
    } catch (err: any) {
      console.error("Failed to send reset email:", err);
      alert("Error al enviar el correo: " + err.message);
    } finally {
      setIsSendingResetEmail(false);
    }
  };

  // Switch to a specific saved account
  const handleSwitchToSpecificAccount = (acc: SecondaryAccount) => {
    // Create a backup of primary account details
    const currentPrimaryBackup: SecondaryAccount = {
      id: currentUserUid,
      name,
      surname,
      username,
      avatar,
      bio,
      age,
      gender,
      phone,
      email,
      walletBalance,
      isBusinessAccount,
      businessName,
      businessCategory,
      city
    };

    // Swap states
    setName(acc.name);
    setSurname(acc.surname);
    setUsername(acc.username);
    setAvatar(acc.avatar);
    setBio(acc.bio);
    setAge(acc.age);
    setGender(acc.gender);
    setPhone(acc.phone);
    setCity(acc.city || '');
    setEmail(acc.email);
    setWalletBalance(acc.walletBalance);
    setIsBusinessAccount(acc.isBusinessAccount);
    setBusinessName(acc.businessName || '');
    setBusinessCategory(acc.businessCategory || 'Entertainment');

    // Remove targeted account from saved accounts and insert current primary backup
    const otherSaved = savedAccounts.filter(item => item.username !== acc.username);
    const updated = [currentPrimaryBackup, ...otherSaved];

    setSavedAccounts(updated);
    localStorage.setItem('imchat_device_accounts', JSON.stringify(updated));

    // Also update secondAccount for compatibility
    setSecondAccount(updated[0] || null);

    alert(`Account switched successfully! You are now logged in as @${acc.username}`);
  };

  const handleSwitchAccount = () => {
    if (savedAccounts.length > 0) {
      handleSwitchToSpecificAccount(savedAccounts[0]);
    } else if (secondAccount) {
      handleSwitchToSpecificAccount(secondAccount);
    }
  };

  // Creating a secondary account
  const handleCreateSecondAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!secName || !secUsername) {
      alert("Please enter a name and a username.");
      return;
    }

    if (secUsername.toLowerCase().includes('imchat')) {
      alert("Validation Error: Usernames cannot contain the blacklisted word 'imchat'. Please choose a different username.");
      return;
    }

    const newSec: SecondaryAccount = {
      id: 'sec_' + Date.now(),
      name: secName,
      surname: secSurname,
      username: secUsername.replace(/\s+/g, '_').toLowerCase(),
      avatar: secAvatar,
      bio: secBio,
      age: secAge,
      gender: secGender,
      phone: secPhone,
      email: secEmail || 'temp_' + secUsername + '@example.com',
      walletBalance: 1200, // Initial balance for secondary account
      isBusinessAccount: false
    };

    const updated = [newSec, ...savedAccounts];
    setSavedAccounts(updated);
    localStorage.setItem('imchat_device_accounts', JSON.stringify(updated));

    setSecondAccount(newSec);
    setShowSecondAccountForm(false);
    
    // Clear inputs
    setSecName('');
    setSecSurname('');
    setSecUsername('');
    setSecBio('');
    setSecPhone('');
    setSecEmail('');

    alert(`Secondary account @${newSec.username} created successfully. You can switch to it anytime!`);
  };

  // Buy advertisements using wallet balance
  const handlePurchaseAd = (e: React.FormEvent) => {
    e.preventDefault();
    const adCost = parseInt(adCampaignCost) || 300;
    
    if (walletBalance < adCost) {
      alert(`Insufficient balance. Your balance is ₹${walletBalance} and this campaign requires ₹${adCost}`);
      return;
    }

    if (!newAdCampaignName || !newAdCaption) {
      alert("Please enter the campaign name and caption.");
      return;
    }

    const { success, campaign } = BusinessStore.buyAd(
      currentUserUid,
      newAdCampaignName,
      newAdCaption,
      newAdImage,
      newAdPlacement,
      newAdCtaText,
      newAdLink,
      adCost
    );

    if (success && campaign) {
      setWalletBalance(prev => prev - adCost);
      setMyAds(prev => [campaign, ...prev]);
      setShowBuyAdModal(false);
      
      // Clean inputs
      setNewAdCampaignName('');
      setNewAdCaption('');
      setNewAdImage('');
      setNewAdLink('');

      alert(`Ad campaign "${campaign.campaignName}" bought and started successfully! ₹${adCost} deducted from your wallet.`);
    }
  };

  // Create Business product to sell
  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductTitle || !newProductPrice) {
      alert("Please fill in the product title and sell price.");
      return;
    }

    const pPrice = parseInt(newProductPrice) || 199;
    const newProd = BusinessStore.addProduct(
      currentUserUid,
      businessName || name,
      newProductTitle,
      pPrice,
      newProductDesc,
      newProductImg,
      newProductCat
    );

    setMyProducts(prev => [newProd, ...prev]);
    setShowAddProductModal(false);
    setNewProductTitle('');
    setNewProductDesc('');
    setNewProductPrice('199');
    alert("Digital content listed for sale successfully on your company page!");
  };

  const handleTopup = () => {
    const amt = parseFloat(topupAmount);
    if (isNaN(amt) || amt <= 0) {
      alert("Invalid amount");
      return;
    }
    setWalletBalance(prev => prev + amt);
    alert(`Top-Up successful! Added ₹${amt} to your wallet.`);
  };

  const fetchTransactions = async () => {
    try {
      setLoadingTransactions(true);
      const txs = await getPayPalTransactions(currentUserUid);
      setPaypalTransactions(txs);
    } catch (e) {
      console.warn("Failed fetching PayPal transactions:", e);
    } finally {
      setLoadingTransactions(false);
    }
  };

  useEffect(() => {
    if (activeMenuTab === 'wallet') {
      fetchTransactions();
    }
  }, [activeMenuTab, currentUserUid]);

  const handlePayPalTopup = (amtVal?: number) => {
    const amt = amtVal !== undefined ? amtVal : parseFloat(paypalTopupAmount);
    if (isNaN(amt) || amt <= 0) {
      alert("Please enter a valid top-up amount");
      return;
    }
    setPayPalParams({
      amount: amt,
      description: `IMChat Wallet Deposit ($${amt.toFixed(2)} USD)`,
      itemType: 'wallet_topup',
      metadata: {
        userName: `${name} ${surname}`,
        userEmail: auth.currentUser?.email
      }
    });
    setShowPayPalModal(true);
  };

  const handlePayPalSuccess = (captureRes: CaptureOrderResponse) => {
    setShowPayPalModal(false);
    if (payPalParams?.itemType === 'wallet_topup') {
      const addedAmt = captureRes.paidAmount;
      setWalletBalance(prev => prev + addedAmt);
      if (currentUserUid && currentUserUid !== 'anonymous') {
        setDoc(doc(db, 'users', currentUserUid), {
          walletBalance: (walletBalance || 0) + addedAmt,
          updatedAt: serverTimestamp()
        }, { merge: true }).catch(err => console.warn("Error updating wallet in firestore:", err));
      }
      fetchTransactions();
      alert(`🎉 PayPal Payment of $${addedAmt.toFixed(2)} USD successfully verified and credited to your wallet! Transaction ID: ${captureRes.captureId}`);
    } else if (payPalParams?.itemType === 'ad_campaign') {
      const meta = payPalParams.metadata || {};
      const { success, campaign } = BusinessStore.buyAd(
        currentUserUid,
        meta.name,
        meta.caption,
        meta.image,
        meta.placement,
        meta.ctaText,
        meta.ctaLink,
        0
      );
      if (success && campaign) {
        setMyAds(prev => [campaign, ...prev]);
        setShowBuyAdModal(false);
        alert(`🎉 Ad campaign "${campaign.campaignName}" successfully funded via PayPal and launched!`);
      }
    }
  };

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 bg-gray-50 z-[200] flex flex-col w-full max-w-[500px] mx-auto text-gray-900 overflow-hidden"
    >
      {/* Settings Header */}
      <header className="bg-white p-4 flex items-center justify-between border-b border-gray-100 sticky top-0 z-20">
        <div className="flex items-center gap-1">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors active:scale-95 cursor-pointer">
            <ArrowLeft className="w-[22px] h-[22px] text-gray-800" />
          </button>
          <h1 className="font-bold text-base tracking-tight text-gray-900">
            {isNewUser ? 'Complete your Profile' : 'IMChat Settings'}
          </h1>
        </div>

        <button 
          disabled={isSaving}
          onClick={handleSave}
          className={`font-bold transition-all p-2 px-5 active:scale-95 text-[14px] flex items-center gap-1.5 rounded-full shadow-md cursor-pointer ${
            saveSuccess 
              ? 'bg-green-600 text-white' 
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {saveSuccess ? <Check className="w-4 h-4" /> : 'Save & Close'}
        </button>
      </header>

      <div className="flex h-full overflow-hidden">
        {/* Left Side Options Panel */}
        <div className="w-[125px] border-r border-gray-150 bg-gray-100/50 flex flex-col pt-3 overflow-y-auto">
          {[
            { id: 'profile', label: 'My Profile', icon: User },
            { id: 'security', label: 'Security & Theme', icon: ShieldCheck },
            { id: 'export', label: 'Export Data', icon: Download },
            { id: 'notifications', label: 'Ring Bell & Alerts', icon: Bell },
            { id: 'wallet', label: 'Wallet', icon: Wallet },
            { id: 'switch', label: 'Accounts', icon: ArrowRightLeft },
            { id: 'business', label: 'Business', icon: ShoppingBag },
            { id: 'ads', label: 'Ad Campaigns', icon: Radio }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveMenuTab(item.id as any)}
              className={`flex flex-col items-center justify-center p-3 text-center gap-1 border-b border-gray-150 transition-all font-bold text-[10px] uppercase tracking-wide cursor-pointer ${
                activeMenuTab === item.id 
                  ? 'bg-white text-blue-600' 
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              <item.icon className={`w-5 h-5 ${activeMenuTab === item.id ? 'text-blue-600' : 'text-gray-400'}`} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Right Scrollable Form Space */}
        <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-6 bg-white">
          
          {/* PROFILE & SECURITY TAB */}
          {(activeMenuTab === 'profile' || activeMenuTab === 'security') && (
            <div className="space-y-5 animate-fade-in text-left">
              <h3 className="font-extrabold text-[15px] text-gray-800 border-b pb-1 flex items-center justify-between">
                <span>PERSONAL DATA</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveMenuTab('export')}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export JSON</span>
                  </button>
                  <span className="text-xs text-blue-600 font-mono">ID: {currentUserUid.substring(0,8)}</span>
                </div>
              </h3>

              {/* Avatar upload */}
              <div className="flex flex-col items-center gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div className="relative">
                  <div className="w-[84px] h-[84px] rounded-full overflow-hidden border-2 border-white shadow-md relative bg-gray-100 flex items-center justify-center">
                    {avatar ? (
                      avatar.toLowerCase().endsWith('.mp4') || avatar.includes('.mp4?') || avatar.toLowerCase().includes('video/mp4') || avatar.startsWith('data:video/mp4') ? (
                        <video src={avatar} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                      ) : (
                        <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                      )
                    ) : (
                      <User className="w-10 h-10 text-gray-400" />
                    )}
                  </div>
                  <button 
                    onClick={() => document.getElementById('avatar-input')?.click()}
                    className="absolute -bottom-1 -right-1 p-2 bg-blue-600 text-white rounded-full border border-white shadow hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                  <input 
                    id="avatar-input"
                    type="file" 
                    accept="image/jpeg,image/png,image/gif,image/svg+xml,video/mp4,.svg,.sgv,.jpg,.jpeg,.png,.gif,.mp4"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>
                <input 
                  type="text" 
                  placeholder="Direct avatar photo URL..."
                  className="w-full text-xs bg-white text-gray-800 rounded-lg p-2 outline-none border border-gray-250 font-medium"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                />
              </div>

              {/* standard names fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">First Name</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-gray-50 text-gray-900 rounded-lg p-2.5 text-sm outline-none border border-transparent focus:border-blue-500 font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase font-bold">Last Name</label>
                  <input 
                    type="text" 
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                    className="w-full bg-gray-50 text-gray-900 rounded-lg p-2.5 text-sm outline-none border border-transparent focus:border-blue-500 font-medium"
                  />
                </div>
              </div>

              {/* Username & phone */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Username</label>
                  <div className="relative">
                    <span className="text-gray-450 absolute left-3 top-1/2 -translate-y-1/2 font-black text-sm">@</span>
                    <input 
                      type="text" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-gray-50 text-gray-900 rounded-lg p-2.5 pl-7 text-sm outline-none border border-transparent focus:border-blue-500 font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Age (Years)</label>
                    <input 
                      type="number" 
                      min="13"
                      max="120"
                      value={age}
                      onChange={(e) => setAge(parseInt(e.target.value) || 18)}
                      className="w-full bg-gray-50 text-gray-900 rounded-lg p-2.5 text-sm outline-none border border-transparent focus:border-blue-500 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Gender</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full bg-gray-50 text-gray-900 rounded-lg p-2.5 text-sm outline-none border border-transparent focus:border-blue-500 font-bold"
                    >
                      <option value="Male">Male ♂</option>
                      <option value="Female">Female ♀</option>
                      <option value="Other">Other ⚧</option>
                      <option value="Secret">Private 🔒</option>
                    </select>
                  </div>
                </div>

                {/* Mobile Phone Number */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-blue-500" />
                    Mobile Number
                  </label>
                  <input 
                    type="text" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-gray-50 text-gray-900 rounded-lg p-2.5 text-sm font-mono outline-none border border-transparent focus:border-blue-500 font-bold"
                    placeholder="Enter your mobile number"
                  />
                </div>

                {/* User Location City */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-blue-500" />
                    User Location (City, Country)
                  </label>
                  <input 
                    type="text" 
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-gray-50 text-gray-900 rounded-lg p-2.5 text-sm font-mono outline-none border border-transparent focus:border-blue-500 font-bold"
                    placeholder="e.g. New York, NY or Madrid, Spain"
                  />
                </div>



                {/* Bio text */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Bio</label>
                  <textarea 
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full bg-gray-50 text-gray-900 rounded-lg p-2.5 text-sm outline-none border border-transparent focus:border-blue-500 font-medium resize-none h-16"
                    placeholder="Write something about yourself..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECURITY, CACHE & APP VERSION TAB */}
          {activeMenuTab === 'security' && (
            <div className="space-y-5 animate-fade-in text-left">
              <h3 className="font-extrabold text-[15px] text-gray-800 border-b pb-1 flex items-center justify-between">
                <span>SECURITY, APP VERSION & CACHE</span>
                <span className="text-[10px] bg-blue-100 text-blue-800 font-mono px-2 py-0.5 rounded-full font-bold">IMChat.im v3.2.0</span>
              </h3>

              {/* App Version & IMChat.im Info Card */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white p-5 rounded-2xl shadow-xl relative overflow-hidden border border-blue-900/50">
                <div className="absolute right-[-10px] bottom-[-10px] w-24 h-24 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-300 font-black text-xs">
                      IM
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-white tracking-wide">Current App Version: v3.2.0</h4>
                      <p className="text-[10px] text-blue-200 font-medium">Official PWA Release from <span className="text-amber-300 font-bold">IMChat.im</span></p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                    🟢 Live & Updated
                  </span>
                </div>
                <p className="text-xs text-blue-100/90 leading-relaxed mb-4">
                  The IMChat application builder is fully synchronized with IMChat.im servers. All real-time features, chat systems, and database sync pipelines are active.
                </p>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        // Clear Service Worker Caches
                        if ('serviceWorker' in navigator) {
                          const registrations = await navigator.serviceWorker.getRegistrations();
                          for (const reg of registrations) {
                            await reg.unregister();
                          }
                        }
                        if ('caches' in window) {
                          const cacheNames = await caches.keys();
                          for (const name of cacheNames) {
                            await caches.delete(name);
                          }
                        }
                        // Clear local cache storage flags
                        localStorage.removeItem('app_cache_timestamp');
                        alert("🧹 App Cache successfully deleted! Reloading IMChat to apply latest build updates...");
                        window.location.reload();
                      } catch (err) {
                        console.error("Failed to delete app cache:", err);
                        window.location.reload();
                      }
                    }}
                    className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete App Cache & Reload Builder
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      alert("IMChat App Builder v3.2.0 is up to date with IMChat.im production server.");
                    }}
                    className="py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer border border-white/20"
                  >
                    <RefreshCcw className="w-4 h-4" />
                    Check for Updates
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {/* Theme Settings Selector */}
                <div className="bg-gray-50 dark:bg-neutral-850 p-4 rounded-xl border border-gray-100 dark:border-neutral-800 space-y-3">
                  <h4 className="text-xs font-black text-gray-650 dark:text-gray-300 uppercase tracking-widest flex items-center gap-1.5">
                    <Sun className="w-4 h-4 text-amber-500" />
                    Appearance Theme
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                    Choose your preferred layout style for the IMChat interface, or synchronize with your device's system settings.
                  </p>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[
                      { id: 'light', label: 'Light', icon: Sun, color: 'text-amber-500' },
                      { id: 'dark', label: 'Dark', icon: Moon, color: 'text-indigo-500' },
                      { id: 'system', label: 'System', icon: Laptop, color: 'text-gray-500' }
                    ].map((opt) => {
                      const OptIcon = opt.icon;
                      const isSelected = theme === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleThemeChange(opt.id as any)}
                          className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-white dark:bg-neutral-800 border-blue-500 dark:border-blue-400 shadow-sm ring-1 ring-blue-500/20' 
                              : 'bg-white/40 dark:bg-neutral-900/40 border-gray-150 dark:border-neutral-800 hover:border-gray-300 dark:hover:border-neutral-700'
                          }`}
                        >
                          <OptIcon className={`w-5 h-5 mb-1.5 ${isSelected ? opt.color : 'text-gray-400'}`} />
                          <span className={`text-xs font-bold ${isSelected ? 'text-gray-950 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                            {opt.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Email input read/write */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-450 uppercase">Email Address</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-gray-50 text-gray-900 rounded-lg p-2.5 text-sm outline-none border border-transparent focus:border-blue-500 font-medium"
                  />
                </div>

                {/* Email alerts and newsletters */}
                <div className="bg-gray-50 dark:bg-neutral-850 p-4 rounded-xl border border-gray-100 dark:border-neutral-800 space-y-3">
                  <h4 className="text-xs font-black text-gray-600 dark:text-gray-300 uppercase tracking-widest flex items-center justify-between">
                    <span>Email & Notification Settings</span>
                    <span className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 px-2 py-0.5 rounded-full font-bold">Auto Active</span>
                  </h4>
                  
                  {/* Automated Welcome Email Card */}
                  <div className="p-3 bg-purple-50/70 dark:bg-purple-950/20 border border-purple-150 dark:border-purple-800/40 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <div>
                          <p className="text-xs font-bold text-gray-900 dark:text-white">Auto Welcome Email to New Members</p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">Sends a personalized introduction and feature tour on signup</p>
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={autoWelcomeEmailEnabled}
                        onChange={(e) => setAutoWelcomeEmailEnabled(e.target.checked)}
                        className="accent-purple-600 w-4 h-4 cursor-pointer"
                      />
                    </div>

                    <div className="pt-1 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={sendingWelcomeTest || !email}
                        onClick={async () => {
                          if (!email || !email.includes('@')) {
                            alert("Please enter a valid email address above first.");
                            return;
                          }
                          setSendingWelcomeTest(true);
                          setWelcomeTestResult(null);
                          try {
                            const res = await testWelcomeEmail(email, name || 'Member', username || 'user');
                            setWelcomeTestResult(res.message);
                          } catch (err: any) {
                            setWelcomeTestResult(err.message || 'Error triggering test');
                          } finally {
                            setSendingWelcomeTest(false);
                          }
                        }}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm"
                      >
                        {sendingWelcomeTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                        Send Test Welcome Email
                      </button>

                      <button
                        type="button"
                        disabled={sendingWelcomeTest || !email}
                        onClick={async () => {
                          if (!email || !email.includes('@')) {
                            alert("Please enter a valid email address above first.");
                            return;
                          }
                          setSendingWelcomeTest(true);
                          setWelcomeTestResult(null);
                          try {
                            const res = await triggerWelcomeEmail({
                              email: email.trim(),
                              name: name || 'Member',
                              username: username || 'user',
                              userId: currentUserUid || undefined
                            });
                            setWelcomeTestResult(res.message || 'Welcome email dispatched!');
                          } catch (err: any) {
                            setWelcomeTestResult(err.message || 'Failed to dispatch');
                          } finally {
                            setSendingWelcomeTest(false);
                          }
                        }}
                        className="px-3 py-1.5 bg-gray-200 dark:bg-neutral-700 hover:bg-gray-300 dark:hover:bg-neutral-600 text-gray-800 dark:text-gray-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                      >
                        Resend My Welcome Email
                      </button>
                    </div>

                    {welcomeTestResult && (
                      <p className="text-[11px] text-purple-700 dark:text-purple-300 bg-purple-100/60 dark:bg-purple-900/30 p-2 rounded-lg font-medium">
                        {welcomeTestResult}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-gray-700 dark:text-gray-300 font-bold">Activities & Comments</span>
                    <input 
                      type="checkbox" 
                      checked={emailActivityNotifications}
                      onChange={(e) => setEmailActivityNotifications(e.target.checked)}
                      className="accent-blue-600 w-4 h-4 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-700 dark:text-gray-300 font-bold">Login Security Alerts</span>
                    <input 
                      type="checkbox" 
                      checked={emailSecurityAlerts}
                      onChange={(e) => setEmailSecurityAlerts(e.target.checked)}
                      className="accent-blue-600 w-4 h-4 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-700 dark:text-gray-300 font-bold">Weekly Newsletters</span>
                    <input 
                      type="checkbox" 
                      checked={emailMarketing}
                      onChange={(e) => setEmailMarketing(e.target.checked)}
                      className="accent-blue-600 w-4 h-4 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Autoplay & Low Data Mode - Opera Mini Compat */}
                <div className="bg-[#f0f9ff] p-4 rounded-xl border border-blue-100 space-y-2">
                  <div className="flex items-center gap-2">
                    <Laptop className="w-5 h-5 text-blue-600" />
                    <span className="text-xs font-black text-blue-800 uppercase tracking-wide">Opera Mini Compression / Low Data Mode</span>
                  </div>
                  <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
                    Reduce overall data usage. Feed images will default to lighter resolutions and video autoplay will be paused automatically.
                  </p>
                  
                  <button
                    onClick={() => setLowDataMode(!lowDataMode)}
                    className={`w-full py-2 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                      lowDataMode 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'bg-white border border-blue-200 text-blue-600'
                    }`}
                  >
                    {lowDataMode ? '✓ LOW DATA MODE ACTIVE' : 'ACTIVATE LOW DATA MODE'}
                  </button>
                </div>

                {/* Offline Mode Switch */}
                <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 space-y-2">
                  <div className="flex items-center gap-2">
                    <Radio className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-black text-amber-805 dark:text-amber-400 uppercase tracking-wide">Forzado de Modo Offline / Force Offline Mode</span>
                  </div>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium leading-relaxed text-left">
                    Simulates connection loss. Sent chat messages and posted activities will be held locally and auto-synchronized when back online.
                  </p>
                  <button
                    type="button"
                    onClick={handleToggleOfflineMode}
                    className={`w-full py-2 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                      offlineMode 
                        ? 'bg-amber-600 text-white shadow-md hover:bg-amber-700' 
                        : 'bg-white dark:bg-slate-800 border border-amber-300 text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {offlineMode ? '✓ MODO OFFLINE ACTIVO / OFFLINE MODE ACTIVE' : 'ACTIVAR MODO OFFLINE / ACTIVATE OFFLINE MODE'}
                  </button>
                </div>

                {/* Lock Profile (Facebook Style) */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-150">
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold text-gray-800 flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4 text-brand-blue" />
                      Lock Profile
                    </span>
                    <span className="text-[10px] text-gray-500">Only friends and admins can see your posts and media</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={profileLocked}
                    onChange={(e) => setProfileLocked(e.target.checked)}
                    className="accent-brand-blue w-4.5 h-4.5 cursor-pointer"
                  />
                </div>

                {/* Hide profile avatar publicly */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-150">
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold text-gray-800 flex items-center gap-1">
                      <EyeOff className="w-4 h-4 text-orange-500" />
                      Hide Profile Avatar Publicly
                    </span>
                    <span className="text-[10px] text-gray-500">Displays generic avatar in searches</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={hideAvatarPublicly}
                    onChange={(e) => setHideAvatarPublicly(e.target.checked)}
                    className="accent-blue-600 w-4.5 h-4.5 cursor-pointer"
                  />
                </div>

                {/* Fingerprint / Biometric Login Card */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-sky-50/80 border border-blue-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">
                        <Fingerprint className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-1">
                          <span>Fingerprint & Biometric Login</span>
                          <Sparkles className="w-3 h-3 text-amber-500" />
                        </h4>
                        <p className="text-[10.5px] text-slate-500 font-medium">Touch ID, Windows Hello & Platform Authenticator</p>
                      </div>
                    </div>

                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                      isBiometricEnrolled 
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {isBiometricEnrolled ? '✓ Active on this Device' : 'Not Registered'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                    Sign in to IMChat instantly with 1-tap using your device's biometric sensor (fingerprint, Face ID, or Windows Hello) without typing your password every time.
                  </p>

                  {biometricStatusMsg && (
                    <div className="p-2.5 bg-blue-100/70 border border-blue-200 rounded-lg text-xs font-bold text-blue-800">
                      {biometricStatusMsg}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    {isBiometricEnrolled ? (
                      <>
                        <button
                          type="button"
                          onClick={handleEnrollDeviceBiometric}
                          disabled={isEnrollingBiometric}
                          className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isEnrollingBiometric ? 'animate-spin' : ''}`} />
                          <span>Re-register Fingerprint</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveDeviceBiometric}
                          className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={handleEnrollDeviceBiometric}
                        disabled={isEnrollingBiometric}
                        className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                      >
                        <Fingerprint className="w-4 h-4" />
                        <span>{isEnrollingBiometric ? 'Enrolling...' : 'Register Fingerprint on this Device'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Password reset button */}
                <button 
                  onClick={handleResetPassword}
                  disabled={isSendingResetEmail}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-100/60 hover:bg-blue-100 text-blue-600 font-bold text-xs cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Reset Password via Email
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
                <div className="flex justify-end pt-1">
                  <a 
                    href="#forgot-password" 
                    onClick={() => onClose?.()}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                  >
                    <span>Open Dedicated Password Reset Page</span>
                    <span>→</span>
                  </a>
                </div>
                {resetEmailSent && (
                  <p className="text-[11px] text-green-600 font-bold bg-green-50 p-2 rounded-lg text-center mt-1">📬 Email sent to {email}. Follow the link to change your password.</p>
                )}

                {/* App caching clear */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 border border-purple-100">
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold text-purple-800">Device Cache</span>
                    <span className="text-[10px] text-purple-600">{cacheSize} in buffer</span>
                  </div>
                  <button 
                    onClick={async () => {
                      await VideoCache.clearCache();
                      setCacheSize('0 B');
                      alert('Cache cleared to optimize memory.');
                    }}
                    className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-purple-700"
                  >
                    Clear
                  </button>
                </div>

                {/* Export Personal Activity Data Option */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50/70 p-4 rounded-xl border border-blue-200 space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                        <Download className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-black text-blue-950 uppercase tracking-wide block">Personal Activity Archive</span>
                        <span className="text-[10px] text-blue-700 font-medium">Export posts, chats, messages &amp; profile as JSON</span>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono font-black text-blue-700 bg-blue-100 px-2 py-0.5 rounded border border-blue-200 uppercase">
                      .JSON
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium leading-relaxed text-left">
                    Download a complete copy of your personal data archive, including authored posts, comments, conversation message logs, media references, and profile settings.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveMenuTab('export')}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/20 cursor-pointer active:scale-98"
                  >
                    <Download className="w-4 h-4" />
                    <span>Open Data Export Hub</span>
                  </button>
                </div>

                {/* Delete My Account Option */}
                <div className="bg-red-50 p-4 rounded-xl border border-red-200 space-y-3 mt-4">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-red-600" />
                    <span className="text-xs font-black text-red-800 uppercase tracking-wide">Danger Zone: Delete My Account</span>
                  </div>
                  <p className="text-[11px] text-red-700 font-medium leading-relaxed text-left">
                    Permanently delete your account, profile data, and associated records from IMChat. This action is irreversible.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      const confirmText = prompt(`Type "DELETE" to confirm permanent deletion of your account (${email || currentUserUid}):`);
                      if (confirmText !== "DELETE") {
                        if (confirmText !== null) alert("Deletion cancelled. You must type DELETE exactly.");
                        return;
                      }
                      try {
                        await deleteDoc(doc(db, "users", currentUserUid));
                        localStorage.removeItem('imchat_current_user_id');
                        localStorage.removeItem('imchat_saved_accounts');
                        try {
                          await auth.currentUser?.delete();
                        } catch (authErr) {
                          console.warn("Auth user delete notice:", authErr);
                        }
                        alert("⚠️ Your account has been permanently deleted.");
                        window.location.reload();
                      } catch (err: any) {
                        console.error("Failed to delete account:", err);
                        alert("Failed to delete account: " + (err.message || err));
                      }
                    }}
                    className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer active:scale-95"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete My Account Permanently
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* EXPORT DATA TAB */}
          {activeMenuTab === 'export' && (
            <DataExportSection
              currentUserId={currentUserUid}
              currentUserName={name || username || 'User'}
              currentUserEmail={email || ''}
              profileData={{
                uid: currentUserUid,
                name,
                surname,
                username,
                email,
                phone,
                bio,
                avatar,
                age,
                gender,
                city,
                role,
                walletBalance,
                isBusinessAccount,
                businessName,
                businessCategory,
                isProfileLocked: profileLocked,
                isMfaEnabled: mfaEnabled,
                hideAvatarPublicly,
                preferences: {
                  notifications,
                  emailMarketing,
                  emailSecurityAlerts,
                  emailActivityNotifications,
                  lowDataMode,
                  offlineMode,
                  batterySaverEnabled,
                  batterySyncFrequency,
                  notificationBellType,
                  language: localStorage.getItem('imchat_selected_language') || navigator.language || 'en',
                }
              }}
            />
          )}

          {/* NOTIFICATIONS & RING BELL TAB */}
          {activeMenuTab === 'notifications' && (
            <div className="space-y-5 animate-fade-in text-left">
              <h3 className="font-extrabold text-[15px] text-gray-800 border-b pb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-blue-600" />
                  NOTIFICATION SOUND & RING BELL
                </span>
              </h3>

              {/* Default App Ring Bell Banner */}
              <div className="bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 text-white p-5 rounded-2xl shadow-xl relative overflow-hidden border border-blue-800/40">
                <div className="absolute right-[-15px] top-[-15px] w-28 h-28 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
                
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-yellow-300">
                      <Bell className="w-5 h-5 animate-bounce" />
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-white tracking-wide">App Ring Bell Default</h4>
                      <p className="text-[10px] text-blue-200 font-medium">Double-strike crystal desk bell chime for new notifications</p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-blue-100/90 leading-relaxed mb-4">
                  Every user of IMChat receives an instant crystal dual-strike ring bell chime when new notifications, chat messages, or alerts are received.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    playNotificationSound(notificationBellType);
                    setBellTestActive(true);
                    setTimeout(() => setBellTestActive(false), 1200);
                  }}
                  className={`w-full py-2.5 px-4 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 cursor-pointer ${
                    bellTestActive
                      ? 'bg-emerald-500 text-white ring-2 ring-emerald-300'
                      : 'bg-white text-blue-900 hover:bg-blue-50'
                  }`}
                >
                  <Volume2 className={`w-4 h-4 ${bellTestActive ? 'animate-pulse text-white' : 'text-blue-600'}`} />
                  {bellTestActive ? '🔔 Ringing App Bell Sound...' : '🔔 Ring Bell Test Sound'}
                </button>
              </div>

              {/* Choose Notification Ring Bell Sound */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                {/* Global Bell Success Toast */}
                {globalBellSuccessMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2 shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{globalBellSuccessMsg}</span>
                  </motion.div>
                )}

                {/* Admin Master Authority Box */}
                {isOwner ? (
                  <div className="p-3.5 bg-gradient-to-br from-amber-500/10 via-amber-50 to-orange-50/50 rounded-xl border-2 border-amber-300 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-900 flex items-center gap-1.5 uppercase tracking-wide">
                        <Crown className="w-4 h-4 text-amber-600" />
                        Admin Default Bell Authority
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-200/80 text-amber-900 rounded-full border border-amber-300">
                        Admin Only
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                      As Administrator, you are the <strong>only person allowed to set the default app bell notification</strong> in user profile settings. What you set here remains active as the whole app default bell for all users.
                    </p>
                    <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-amber-200/60">
                      <div className="text-[11px] font-bold text-gray-700">
                        Whole App Default: <span className="text-amber-900 font-extrabold underline">{globalDefaultBellName}</span>
                      </div>
                      <button
                        type="button"
                        disabled={isSettingGlobalDefault}
                        onClick={() => {
                          const currentOpt = [
                            { id: 'default_ring_bell', title: 'Default App Signature Ring Bell 🔔' },
                            { id: 'hotel_bell', title: 'Classic Reception Desk Bell 🛎️' },
                            { id: 'crystal_chime', title: 'Crystal Harmonic Chime ✨' },
                            { id: 'gentle_pop', title: 'Gentle Water Bubble Pop 🎵' },
                            { id: 'cosmic_pulse', title: 'Cosmic Synth Pulse 🌌' },
                            { id: 'submarine_ping', title: 'Radar Sonar Ping 🔊' },
                            { id: 'tower_bell', title: 'Grand Cathedral & Tower Bell ⛪' },
                            { id: 'zen_bell', title: 'Tibetan Zen Meditation Singing Bell 🧘' },
                            { id: 'digital_beep', title: 'Digital Tech Pulse 🤖' },
                            { id: 'mute', title: 'Disable Sound Entirely (Mute) 🔕' },
                            { id: 'custom_audio', title: customBellName || 'Custom Bell Audio' },
                            { id: 'custom_ai', title: 'AI Generated Studio Track 🎼' },
                          ].find(o => o.id === notificationBellType);

                          handleSetAsGlobalAppDefault(
                            notificationBellType, 
                            currentOpt?.title || notificationBellType,
                            notificationBellType === 'custom_audio' ? customBellAudioUrl : ''
                          );
                        }}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        {isSettingGlobalDefault ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Updating Default...</span>
                          </>
                        ) : (
                          <>
                            <Crown className="w-3.5 h-3.5" />
                            <span>Set Active as Whole App Default</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-slate-500" />
                        App Default Bell (Admin Enforced)
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full">
                        Admin Controlled
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      The whole app default bell notification is set by the Administrator to: <strong className="text-slate-900">{globalDefaultBellName}</strong>. Only administrators can change the application default bell.
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider">
                    Select Notification Bell Tone
                  </h4>
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                    Active: {notificationBellType.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="space-y-2">
                  {[
                    { id: 'default_ring_bell', title: 'Default App Signature Ring Bell 🔔', desc: 'Crisp dual-strike metallic desk bell chime (Ding-Ring!)' },
                    { id: 'hotel_bell', title: 'Classic Reception Desk Bell 🛎️', desc: 'Bright resonant brass service bell with lingering acoustic ring' },
                    { id: 'crystal_chime', title: 'Crystal Harmonic Chime ✨', desc: 'High-pitched crystal bell progression (E6-B6-E7)' },
                    { id: 'gentle_pop', title: 'Gentle Water Bubble Pop 🎵', desc: 'Soft acoustic bubble drop with subtle harmonic decay' },
                    { id: 'cosmic_pulse', title: 'Cosmic Synth Pulse 🌌', desc: 'Ambient space synth harmonic ripple for discreet alerts' },
                    { id: 'submarine_ping', title: 'Radar Sonar Ping 🔊', desc: 'Clear submarine acoustic radar tone with long tail' },
                    { id: 'tower_bell', title: 'Grand Cathedral & Tower Bell ⛪', desc: 'Deep rich bell resonance with layered harmonic overtones' },
                    { id: 'zen_bell', title: 'Tibetan Zen Meditation Singing Bell 🧘', desc: 'Calming pure singing bowl strike with 432Hz envelope' },
                    { id: 'digital_beep', title: 'Digital Tech Pulse 🤖', desc: 'Modern twin electronic alert pulse' },
                    { id: 'mute', title: 'Disable Sound Entirely (Mute) 🔕', desc: 'Silences all notification rings and alerts completely' },
                    { id: 'custom_audio', title: 'Custom Audio / Uploaded Bell Ring 🎙️', desc: customBellAudioUrl ? `Custom: ${customBellName}` : 'Upload your own MP3 / WAV audio bell file' },
                    { id: 'custom_ai', title: 'AI Generated Studio Track 🎼', desc: 'Use track created in AI Music Studio' },
                  ].map((soundOpt) => {
                    const isSelected = notificationBellType === soundOpt.id;
                    const isGlobalDefault = globalDefaultBell === soundOpt.id;
                    return (
                      <div
                        key={soundOpt.id}
                        onClick={() => {
                          setNotificationBellType(soundOpt.id);
                          localStorage.setItem('app_notification_bell_type', soundOpt.id);
                          window.dispatchEvent(new CustomEvent('chime-changed', { detail: { chimeId: soundOpt.id } }));
                          if (soundOpt.id !== 'mute') {
                            playNotificationSound(soundOpt.id);
                          }
                        }}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-start justify-between gap-2 ${
                          isSelected
                            ? soundOpt.id === 'mute'
                              ? 'bg-red-50/90 border-red-400 ring-1 ring-red-400 shadow-xs'
                              : 'bg-blue-50/80 border-blue-500 ring-1 ring-blue-500 shadow-xs'
                            : 'bg-white border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`text-xs font-black ${isSelected ? (soundOpt.id === 'mute' ? 'text-red-700' : 'text-blue-900') : 'text-gray-800'}`}>
                              {soundOpt.title}
                            </p>
                            {isGlobalDefault && (
                              <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 border border-amber-300 rounded text-[9px] font-black flex items-center gap-0.5">
                                <Crown className="w-2.5 h-2.5 text-amber-600" />
                                App Default
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 font-medium mt-0.5 truncate">
                            {soundOpt.desc}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isOwner && !isGlobalDefault && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetAsGlobalAppDefault(soundOpt.id, soundOpt.title);
                              }}
                              title="Set as Whole App Default Bell for All Users"
                              className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold flex items-center gap-1 transition-colors"
                            >
                              <Crown className="w-3 h-3 text-amber-600" />
                              <span className="hidden sm:inline">Set Default</span>
                            </button>
                          )}
                          {soundOpt.id !== 'mute' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setNotificationBellType(soundOpt.id);
                                localStorage.setItem('app_notification_bell_type', soundOpt.id);
                                window.dispatchEvent(new CustomEvent('chime-changed', { detail: { chimeId: soundOpt.id } }));
                                playNotificationSound(soundOpt.id);
                              }}
                              className="p-1 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors"
                              title="Play preview"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected 
                              ? soundOpt.id === 'mute'
                                ? 'border-red-600 bg-red-600 text-white'
                                : 'border-blue-600 bg-blue-600 text-white' 
                              : 'border-gray-300'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Custom Audio Bell Uploader */}
                <div className="mt-3 p-3 bg-white rounded-xl border border-gray-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5">
                      <Music className="w-3.5 h-3.5 text-blue-600" />
                      Upload Custom Bell Audio / Ringtone
                    </span>
                    {customBellAudioUrl && (
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Custom Bell Active
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500">
                    Upload your own audio file (.mp3, .wav, .m4a, .ogg) to set as your personal IMChat ring bell.
                  </p>
                  
                  <div className="flex items-center gap-2 pt-1">
                    <label className="flex-1">
                      <input
                        type="file"
                        accept="audio/*"
                        disabled={isUploadingBellAudio}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setIsUploadingBellAudio(true);
                          try {
                            const res = await uploadToCloudinary(file, 'video', 'custom_bells');
                            if (res.secure_url) {
                              const cleanName = file.name.replace(/\.[^/.]+$/, "");
                              setCustomBellAudioUrl(res.secure_url);
                              setCustomBellName(cleanName);
                              setNotificationBellType('custom_audio');
                              localStorage.setItem('custom_bell_audio_url', res.secure_url);
                              localStorage.setItem('custom_bell_name', cleanName);
                              localStorage.setItem('app_notification_bell_type', 'custom_audio');
                              playNotificationSound('custom_audio');
                            }
                          } catch (err) {
                            console.error("Failed uploading custom bell audio:", err);
                            // Fallback to local Blob URL
                            const localUrl = URL.createObjectURL(file);
                            const cleanName = file.name.replace(/\.[^/.]+$/, "");
                            setCustomBellAudioUrl(localUrl);
                            setCustomBellName(cleanName);
                            setNotificationBellType('custom_audio');
                            localStorage.setItem('custom_bell_audio_url', localUrl);
                            localStorage.setItem('custom_bell_name', cleanName);
                            localStorage.setItem('app_notification_bell_type', 'custom_audio');
                            playNotificationSound('custom_audio');
                          } finally {
                            setIsUploadingBellAudio(false);
                          }
                        }}
                        className="hidden"
                      />
                      <div className="w-full py-2 px-3 bg-gray-50 hover:bg-blue-50 border border-dashed border-gray-300 hover:border-blue-400 rounded-lg text-center cursor-pointer transition-colors text-xs font-semibold text-gray-700 flex items-center justify-center gap-2">
                        {isUploadingBellAudio ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                            <span>Uploading Ring Bell Audio...</span>
                          </>
                        ) : (
                          <>
                            <PlusCircle className="w-3.5 h-3.5 text-blue-600" />
                            <span>{customBellAudioUrl ? `Replace Custom Bell (${customBellName})` : 'Choose Audio File (.mp3 / .wav)'}</span>
                          </>
                        )}
                      </div>
                    </label>
                    {customBellAudioUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomBellAudioUrl('');
                          setCustomBellName('');
                          localStorage.removeItem('custom_bell_audio_url');
                          localStorage.removeItem('custom_bell_name');
                          if (notificationBellType === 'custom_audio') {
                            setNotificationBellType('default_ring_bell');
                            localStorage.setItem('app_notification_bell_type', 'default_ring_bell');
                          }
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
                        title="Remove custom bell"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {isOwner && customBellAudioUrl && (
                    <button
                      type="button"
                      disabled={isSettingGlobalDefault}
                      onClick={() => handleSetAsGlobalAppDefault('custom_audio', customBellName || 'Custom Audio Bell', customBellAudioUrl)}
                      className="w-full mt-2 py-2 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                    >
                      <Crown className="w-3.5 h-3.5" />
                      <span>Set Uploaded Audio as Whole App Default Bell</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Master Notification Toggles */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider">Alert Preferences</h4>

                <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-gray-150">
                  <div>
                    <p className="text-xs font-bold text-gray-800">Master Ring Bell Sound</p>
                    <p className="text-[10px] text-gray-500">Play chime sound when notifications arrive</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications}
                    onChange={(e) => setNotifications(e.target.checked)}
                    className="accent-blue-600 w-4.5 h-4.5 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-gray-150">
                  <div>
                    <p className="text-xs font-bold text-gray-800">New Comments & Activity</p>
                    <p className="text-[10px] text-gray-500">Ring bell on likes, comments, and mentions</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailActivityNotifications}
                    onChange={(e) => setEmailActivityNotifications(e.target.checked)}
                    className="accent-blue-600 w-4.5 h-4.5 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-gray-150">
                  <div>
                    <p className="text-xs font-bold text-gray-800">Security Login Alerts</p>
                    <p className="text-[10px] text-gray-500">Ring bell when new device logs in</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailSecurityAlerts}
                    onChange={(e) => setEmailSecurityAlerts(e.target.checked)}
                    className="accent-blue-600 w-4.5 h-4.5 cursor-pointer"
                  />
                </div>
              </div>

              {/* Battery Saver & Sync Frequency */}
              <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider">Battery Saver Mode</h4>
                      <p className="text-[10px] text-gray-500">Reduces background listener polling rate when battery is low (&le; 30%)</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={batterySaverEnabled}
                    onChange={(e) => handleToggleBatterySaver(e.target.checked)}
                    className="accent-amber-600 w-4.5 h-4.5 cursor-pointer"
                  />
                </div>

                {batterySaverEnabled && (
                  <div className="p-3 bg-white rounded-lg border border-amber-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                        Sync Frequency
                      </span>
                      <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md">
                        {batterySyncFrequency < 60 ? `Every ${batterySyncFrequency}s` : `Every ${batterySyncFrequency / 60} min`}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-tight">
                      Manually select how frequently real-time snapshot listeners poll in battery saver mode:
                    </p>

                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
                      {[
                        { value: 15, label: '15s', tag: 'Fast' },
                        { value: 30, label: '30s', tag: 'Balanced' },
                        { value: 45, label: '45s', tag: 'Default' },
                        { value: 60, label: '1m', tag: 'Eco' },
                        { value: 120, label: '2m', tag: 'Ultra' },
                        { value: 300, label: '5m', tag: 'Max Saver' }
                      ].map((opt) => {
                        const isSelected = batterySyncFrequency === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleSelectSyncFrequency(opt.value)}
                            className={`py-1.5 px-1 rounded-lg border font-bold text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                              isSelected
                                ? 'bg-amber-600 text-white border-amber-700 shadow-xs ring-1 ring-amber-500 scale-[1.02]'
                                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-amber-50 hover:border-amber-300'
                            }`}
                          >
                            <span className="text-xs leading-none">{opt.label}</span>
                            <span className={`text-[8px] leading-none mt-0.5 ${isSelected ? 'text-amber-100' : 'text-gray-400'}`}>
                              {opt.tag}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <p className="text-[9px] text-gray-400 pt-1 border-t border-gray-100">
                      When unplugged &amp; battery &le; 30%, notification snapshots poll every {batterySyncFrequency < 60 ? `${batterySyncFrequency} seconds` : `${batterySyncFrequency / 60} minute(s)`} to conserve device energy.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIRTUAL WALLET TAB */}
          {activeMenuTab === 'wallet' && (
            <div className="space-y-5 animate-fade-in text-left">
              <h3 className="font-extrabold text-[15px] text-gray-800 border-b pb-1">MY DIGITAL WALLET</h3>
              
              {/* Wallet Screen card */}
              <div className="bg-gradient-to-br from-indigo-900 to-indigo-700 text-white rounded-2xl p-6 shadow-xl flex flex-col justify-between relative overflow-hidden">
                <div className="absolute right-[-20px] top-[-20px] w-36 h-36 bg-white/5 rounded-full" />
                
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-indigo-200 text-[10px] font-bold uppercase tracking-wider block">Available Balance</span>
                    <span className="text-3xl font-black font-mono">₹{walletBalance.toFixed(2)}</span>
                  </div>
                  <Award className="w-8 h-8 text-yellow-300 animate-pulse" />
                </div>

                <div className="flex justify-between items-end mt-8 border-t border-white/10 pt-4">
                  <div className="text-[10px] text-indigo-200">
                    <span className="block font-bold">Accountholder:</span>
                    <span className="font-mono text-sm font-semibold">{name} {surname}</span>
                  </div>
                  <span className="bg-white/15 px-2.5 py-1 rounded-md text-[10px] font-mono font-black uppercase">IMCHAT PAY</span>
                </div>
              </div>

              {/* Official PayPal Wallet Top-up */}
              <div className="bg-gradient-to-br from-blue-50/70 via-white to-indigo-50/50 p-5 rounded-2xl border border-blue-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#003087] flex items-center justify-center text-white font-black italic text-sm shadow-xs">
                      P
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                        <span>PayPal Live Deposit</span>
                        <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black px-1.5 py-0.2 rounded-md">
                          Verified API
                        </span>
                      </h4>
                      <p className="text-[10px] text-gray-500 font-medium">Instant balance funding with buyer protection</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-gray-500 font-mono">$</span>
                    <input 
                      type="number" 
                      min="1"
                      step="1"
                      value={paypalTopupAmount}
                      onChange={(e) => setPaypalTopupAmount(e.target.value)}
                      placeholder="Amount in USD"
                      className="w-full bg-white text-gray-950 font-bold font-mono rounded-xl p-2.5 pl-8 text-sm outline-none border border-gray-200 focus:border-[#0070BA] focus:ring-1 focus:ring-[#0070BA]"
                    />
                  </div>
                  <button 
                    onClick={() => handlePayPalTopup()}
                    className="px-5 py-2.5 bg-[#0070BA] hover:bg-[#003087] text-white rounded-xl text-xs font-black active:scale-98 transition-all flex items-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer"
                  >
                    <span>Pay with PayPal</span>
                  </button>
                </div>

                {/* Quick select amounts */}
                <div className="flex justify-between gap-2 font-mono text-xs">
                  {['10', '25', '50', '100'].map((val) => (
                    <button 
                      key={val}
                      onClick={() => {
                        setPaypalTopupAmount(val);
                        handlePayPalTopup(parseFloat(val));
                      }}
                      className={`flex-1 py-1.5 rounded-lg border font-bold transition-all cursor-pointer ${
                        paypalTopupAmount === val 
                          ? 'border-[#0070BA] bg-blue-50/80 text-[#003087] ring-1 ring-[#0070BA]/30' 
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      +${val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recent PayPal Transactions */}
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#003087]" />
                    <span>Recent PayPal Transactions</span>
                  </h4>
                  <button 
                    onClick={fetchTransactions}
                    disabled={loadingTransactions}
                    className="text-[11px] text-[#0070BA] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingTransactions ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                {loadingTransactions ? (
                  <div className="py-4 text-center text-xs text-gray-400 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    <span>Loading verified transactions...</span>
                  </div>
                ) : paypalTransactions.length === 0 ? (
                  <div className="py-6 text-center text-xs text-gray-400 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="font-semibold text-gray-600">No PayPal transactions recorded yet</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Top-up your wallet or buy marketplace items using PayPal above.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto">
                    {paypalTransactions.map((tx) => (
                      <div key={tx.id || tx.captureId} className="p-3 bg-white rounded-xl border border-gray-200/80 shadow-2xs flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-gray-900 capitalize">
                              {tx.itemType?.replace('_', ' ') || 'Payment'}
                            </span>
                            <span className="bg-emerald-50 text-emerald-700 text-[9px] font-bold px-1.5 rounded">
                              {tx.status}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-400 font-mono truncate max-w-[180px]">
                            ID: {tx.captureId || tx.orderId}
                          </p>
                          {tx.createdAt && (
                            <p className="text-[9px] text-gray-400">
                              {new Date(tx.createdAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="font-black text-sm text-emerald-600 font-mono">
                            +${tx.amount?.toFixed(2)}
                          </span>
                          <span className="text-[9px] text-gray-400 block uppercase font-mono">
                            {tx.currency || 'USD'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>


            </div>
          )}

          {/* ACCOUNTS SWITCHER TAB */}
          {activeMenuTab === 'switch' && (
            <div className="space-y-5 animate-fade-in text-left">
              <h3 className="font-extrabold text-[15px] text-gray-800 border-b pb-1">SWITCH / ADD ACCOUNT</h3>
              
              <p className="text-xs text-gray-500 font-medium leading-relaxed">
                IMChat allows registering and switching between an unlimited number of accounts on the same device. Instantly swap personal, alternative or business profiles!
              </p>

              {/* Active current account */}
              <div className="bg-blue-50 border border-blue-200/60 p-4 rounded-xl flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 border-2 border-white">
                    <img src={avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200&h=200"} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[11px] font-black text-blue-700 uppercase tracking-wider">Current Active</span>
                    <span className="font-bold text-sm text-gray-900">{name || 'User'} @{username || 'user'}</span>
                  </div>
                </div>
                <span className="bg-blue-600 text-white font-mono text-[9px] font-black uppercase px-2.5 py-1 rounded-full animate-pulse">ACTIVE</span>
              </div>

              {/* Saved accounts list */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Saved Device Accounts ({savedAccounts.length})</span>
                {savedAccounts.length > 0 ? (
                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {savedAccounts.map((acc, index) => (
                      <div key={acc.id || index} className="bg-white border border-gray-100 p-3.5 rounded-xl flex items-center justify-between shadow-sm hover:border-gray-200 hover:bg-gray-50 transition-all">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-150 border border-gray-100 shrink-0">
                            <img src={acc.avatar} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex flex-col text-left min-w-0">
                            <span className="font-bold text-sm text-gray-900 truncate">{acc.name}</span>
                            <span className="text-xs text-gray-500 font-mono font-medium truncate">@{acc.username}</span>
                          </div>
                        </div>
                        
                        <div className="flex gap-2 shrink-0 ml-2">
                          <button 
                            onClick={() => handleSwitchToSpecificAccount(acc)}
                            className="bg-gray-950 hover:bg-black text-white font-bold text-xs px-3.5 py-1.5 rounded-lg active:scale-95 transition-all cursor-pointer"
                          >
                            Switch
                          </button>
                          <button 
                            onClick={() => {
                              if (confirm(`Delete the saved account @${acc.username} from this device?`)) {
                                const updated = savedAccounts.filter(item => item.username !== acc.username);
                                setSavedAccounts(updated);
                                localStorage.setItem('imchat_device_accounts', JSON.stringify(updated));
                                if (secondAccount?.username === acc.username) {
                                  setSecondAccount(updated[0] || null);
                                }
                              }
                            }}
                            className="p-1.5 border border-red-100 text-red-500 hover:bg-red-50 hover:border-red-200 rounded-lg active:scale-95 transition-all"
                            title="Remove Account"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border border-dashed border-gray-200 p-4 rounded-xl text-center text-xs text-gray-400 font-medium">
                    No alternative accounts registered on this device yet.
                  </div>
                )}
              </div>

              {/* Add Account Trigger */}
              <div className="pt-2">
                <button
                  onClick={() => {
                    setSecUsername(username ? username + '_alt' : 'user_alt');
                    setSecName(name ? name + ' Alt' : 'Alt Account');
                    setShowSecondAccountForm(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-sm py-3 px-4 rounded-xl shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" /> Register New Account / Switcher
                </button>
              </div>

              {/* Second Account Multi-Form modal */}
              {showSecondAccountForm && (
                <div className="fixed inset-0 bg-black/60 z-[250] flex items-center justify-center p-4 backdrop-blur-sm">
                  <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col text-left max-h-[90vh]">
                    <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
                      <span className="font-extrabold text-[13px] text-gray-700 uppercase tracking-widest">NEW SECONDARY ACCOUNT</span>
                      <button onClick={() => setShowSecondAccountForm(false)} className="text-gray-500 hover:text-black font-black">X</button>
                    </div>
                    
                    <form onSubmit={handleCreateSecondAccount} className="p-4 space-y-3.5 overflow-y-auto">
                      <div className="flex justify-center gap-3 items-center">
                        <img src={secAvatar} className="w-14 h-14 rounded-full object-cover border-2 border-blue-500" />
                        <div className="flex-1">
                          <label className="text-[9px] font-bold text-gray-400 uppercase">Avatar Link</label>
                          <input 
                            type="text" 
                            value={secAvatar}
                            onChange={(e) => setSecAvatar(e.target.value)}
                            className="w-full text-xs bg-gray-50 border p-1 rounded font-medium"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-px">
                          <label className="text-[9px] font-bold text-gray-400 uppercase">First Name</label>
                          <input type="text" required value={secName} onChange={(e) => setSecName(e.target.value)} className="w-full bg-gray-50 border p-2 text-xs rounded font-medium" />
                        </div>
                        <div className="space-y-px">
                          <label className="text-[9px] font-bold text-gray-400 uppercase">Last Name</label>
                          <input type="text" value={secSurname} onChange={(e) => setSecSurname(e.target.value)} className="w-full bg-gray-50 border p-2 text-xs rounded font-medium" />
                        </div>
                      </div>

                      <div className="space-y-px">
                        <label className="text-[9px] font-bold text-gray-400 uppercase">Username (@)</label>
                        <input type="text" required value={secUsername} onChange={(e) => setSecUsername(e.target.value)} className="w-full bg-gray-50 border p-2 text-xs rounded font-mono font-bold" />
                      </div>

                      <div className="space-y-px">
                        <label className="text-[9px] font-bold text-gray-400 uppercase">Mobile Phone</label>
                        <input type="text" value={secPhone} onChange={(e) => setSecPhone(e.target.value)} className="w-full bg-gray-50 border p-2 text-xs rounded font-mono" />
                      </div>

                      <div className="space-y-px">
                        <label className="text-[9px] font-bold text-gray-400 uppercase">Alternative Bio</label>
                        <input type="text" value={secBio} onChange={(e) => setSecBio(e.target.value)} className="w-full bg-gray-50 border p-2 text-xs rounded font-medium" />
                      </div>

                      <div className="flex gap-3 pt-3">
                        <button type="button" onClick={() => setShowSecondAccountForm(false)} className="flex-1 p-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl text-xs">Cancel</button>
                        <button type="submit" className="flex-1 p-2.5 bg-blue-600 text-white font-black rounded-xl text-xs">Create & Save</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BUSINESS PAGE PROFILE TAB */}
          {activeMenuTab === 'business' && (
            <div className="space-y-5 animate-fade-in text-left">
              <h3 className="font-extrabold text-[15px] text-gray-800 border-b pb-1">BUSINESS PROFILE</h3>
              
              <p className="text-xs text-gray-500 leading-relaxed font-medium">
                Become an independent creator or business. Enable your digital storefront to sell exclusive premium content and media directly inside the feed.
              </p>

              {/* Upgrade switch */}
              <div className="flex items-center justify-between p-4 bg-purple-50 rounded-xl border border-purple-200">
                <div className="flex flex-col">
                  <span className="text-xs font-black text-purple-950 uppercase tracking-wide">Enable Business Mode</span>
                  <span className="text-[10px] text-purple-700">Add a storefront window to your profile</span>
                </div>
                <button
                  onClick={() => setIsBusinessAccount(!isBusinessAccount)}
                  className={`w-14 h-8 rounded-full transition-all relative ${
                    isBusinessAccount ? 'bg-purple-600' : 'bg-gray-300'
                  }`}
                >
                  <span className={`w-6 h-6 rounded-full bg-white absolute top-1 transition-all ${
                    isBusinessAccount ? 'right-1' : 'left-1'
                  }`} />
                </button>
              </div>

              {isBusinessAccount && (
                <div className="space-y-4 pt-1">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Trade Name / Brand Name</label>
                    <input 
                      type="text" 
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. Nike Premium Inc, Starbucks Media..."
                      className="w-full bg-gray-50 text-gray-900 rounded-lg p-2.5 text-sm outline-none border border-gray-200 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Business Category</label>
                    <select
                      value={businessCategory}
                      onChange={(e) => setBusinessCategory(e.target.value)}
                      className="w-full bg-gray-50 text-gray-900 rounded-lg p-2.5 text-sm outline-none border border-gray-250 font-medium"
                    >
                      <option value="Entertainment">Digital Content & Videos</option>
                      <option value="Retail">Fashion & Sneakers</option>
                      <option value="Cuisine">Gastronomy & Recipes</option>
                      <option value="Education">Education & Courses</option>
                    </select>
                  </div>

                  {/* Add Product Section for company */}
                  <div className="border-t pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-gray-700 uppercase">My Products for Sale:</span>
                      <button 
                        onClick={() => setShowAddProductModal(true)}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        New Product
                      </button>
                    </div>

                    {myProducts.length === 0 ? (
                      <div className="p-5 text-center text-xs text-gray-400 bg-gray-50 border rounded-xl">
                        You haven't listed any digital products yet. Create your first course or ebook to start earning!
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {myProducts.map((prod) => (
                          <div key={prod.id} className="flex gap-3 bg-white p-2.5 border rounded-xl items-center shadow-xs">
                            <img src={prod.image} className="w-12 h-12 rounded-lg object-cover bg-gray-100" />
                            <div className="flex-1 min-w-0 text-left">
                              <span className="font-bold text-xs text-gray-900 block truncate">{prod.title}</span>
                              <span className="text-[10px] text-purple-600 font-mono font-bold block">₹{prod.price} • Cat: {prod.category}</span>
                            </div>
                            <div className="text-right min-w-[50px]">
                              <span className="text-[9px] text-gray-400 uppercase block leading-none">Sales</span>
                              <span className="font-mono font-black text-sm text-gray-900">{prod.salesCount}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Add Product Modal */}
              {showAddProductModal && (
                <div className="fixed inset-0 bg-black/60 z-[250] flex items-center justify-center p-4 backdrop-blur-sm">
                  <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col text-left max-h-[90vh]">
                    <div className="bg-purple-100 p-4 border-b flex justify-between items-center text-purple-800">
                      <span className="font-extrabold text-[12px] uppercase tracking-widest">NEW DIGITAL PRODUCT</span>
                      <button onClick={() => setShowAddProductModal(false)} className="text-purple-900 hover:text-black font-black">X</button>
                    </div>

                    <form onSubmit={handleCreateProduct} className="p-4 space-y-3.5 overflow-y-auto">
                      <div className="space-y-px">
                        <label className="text-[9px] font-bold text-gray-450 uppercase">Product Title</label>
                        <input type="text" required placeholder="e.g. Photography Express Course" value={newProductTitle} onChange={(e) => setNewProductTitle(e.target.value)} className="w-full bg-gray-50 border p-2 text-xs rounded font-bold" />
                      </div>

                      <div className="space-y-px">
                        <label className="text-[9px] font-bold text-gray-455 uppercase">Sale Price (in ₹)</label>
                        <input type="number" required min="10" placeholder="199" value={newProductPrice} onChange={(e) => setNewProductPrice(e.target.value)} className="w-full bg-gray-50 border p-2 text-xs rounded font-mono font-bold text-purple-700" />
                      </div>

                      <div className="space-y-px">
                        <label className="text-[9px] font-bold text-gray-450 uppercase">Short Description</label>
                        <textarea value={newProductDesc} onChange={(e) => setNewProductDesc(e.target.value)} placeholder="What is this content about?" className="w-full bg-gray-50 border p-2 text-xs rounded font-medium h-14 resize-none" />
                      </div>

                      <div className="space-y-px">
                        <label className="text-[9px] font-bold text-gray-450 uppercase">Category</label>
                        <select
                          value={newProductCat}
                          onChange={(e: any) => setNewProductCat(e.target.value)}
                          className="w-full bg-gray-50 border p-2 text-xs rounded font-bold"
                        >
                          <option value="premium_content">Exclusive Content 💎</option>
                          <option value="video_pack">HD Video Pack 📹</option>
                          <option value="ebook">Ebook / PDF 📕</option>
                          <option value="exclusive_media">Photo Filters & Presets 🎨</option>
                        </select>
                      </div>

                      <div className="space-y-px">
                        <label className="text-[9px] font-bold text-gray-450 uppercase">Image URL Link</label>
                        <input type="text" value={newProductImg} onChange={(e) => setNewProductImg(e.target.value)} className="w-full bg-gray-50 border p-2 text-[10px] rounded font-mono" />
                      </div>

                      <div className="flex gap-3 pt-3">
                        <button type="button" onClick={() => setShowAddProductModal(false)} className="flex-1 p-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl text-xs">Cancel</button>
                        <button type="submit" className="flex-1 p-2.5 bg-purple-600 text-white font-black rounded-xl text-xs">Publish Product</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ADS CAMPAIGNS HUB */}
          {activeMenuTab === 'ads' && (
            <div className="space-y-5 animate-fade-in text-left">
              <h3 className="font-extrabold text-[15px] text-gray-800 border-b pb-1 flex items-center justify-between font-bold">
                <span>GESTIÓN DE CAMPAÑAS ADS</span>
                <span className="text-[11px] text-emerald-600 font-mono">WALLET: ₹{walletBalance.toFixed(0)}</span>
              </h3>

              <p className="text-xs text-gray-500 leading-relaxed font-semibold">
                Anúnciate con estilo Facebook en IMChat. Promociona tus productos en el feed general, en la sección de reels o en las publicaciones grupales.
              </p>

              <button 
                onClick={() => setShowBuyAdModal(true)}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow shadow-emerald-600/10 uppercase cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                Comprar / Lanzar Campaña de Anuncios
              </button>

              <div className="space-y-3 pt-1">
                <span className="font-extrabold text-[10px] text-gray-400 uppercase tracking-widest block">Mis Campañas Publicitarias</span>

                {myAds.length === 0 ? null : (
                  <div className="space-y-2">
                    {myAds.map((ad) => (
                      <div key={ad.id} className="bg-white p-3.5 border rounded-2xl shadow-sm text-left relative overflow-hidden">
                        <div className="absolute right-3 top-3 bg-emerald-50 px-2.5 py-0.5 rounded text-[9px] font-black font-mono uppercase text-emerald-700 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                          <span>Activa</span>
                        </div>
                        
                        <div className="flex gap-3">
                          <img src={ad.image} className="w-14 h-14 rounded-xl object-cover bg-stone-100 shrink-0 border" />
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-sm text-stone-900 truncate">{ad.campaignName}</h4>
                            <span className="text-[10px] text-indigo-650 font-mono font-semibold block">Presupuesto inicial: ₹{ad.budget}</span>
                            <span className="text-[10px] text-gray-450 block truncate italic mt-1 font-medium bg-gray-50 p-1 rounded">"{ad.caption}"</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 border-t border-gray-100/80 pt-3 mt-3 text-center align-middle font-mono">
                          <div className="bg-gray-50 border border-gray-100/50 p-1.5 rounded-lg">
                            <span className="text-[9px] text-gray-400 uppercase block">Vistas</span>
                            <span className="font-black text-xs text-stone-900">{ad.impressions}</span>
                          </div>
                          <div className="bg-gray-50 border border-gray-100/50 p-1.5 rounded-lg">
                            <span className="text-[9px] text-gray-400 uppercase block">Clicks</span>
                            <span className="font-black text-xs text-stone-900">{ad.clicks}</span>
                          </div>
                          <div className="bg-gray-50 border border-gray-100/50 p-1.5 rounded-lg">
                            <span className="text-[9px] text-gray-400 uppercase block">Posición</span>
                            <span className="font-bold text-[9px] text-indigo-700 uppercase block mt-1">{ad.placement}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Buy Ad Multi-Form modal */}
              {showBuyAdModal && (
                <div className="fixed inset-0 bg-black/60 z-[250] flex items-center justify-center p-4 backdrop-blur-sm">
                  <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col text-left max-h-[90vh]">
                    <div className="bg-emerald-100 p-4 border-b flex justify-between items-center text-emerald-800">
                      <span className="font-extrabold text-[12px] uppercase tracking-widest leading-none">PURCHASE NEW AD</span>
                      <button onClick={() => setShowBuyAdModal(false)} className="text-emerald-900 hover:text-black font-black">X</button>
                    </div>

                    <form onSubmit={handlePurchaseAd} className="p-4 space-y-3.5 overflow-y-auto">
                      <div className="bg-emerald-50 text-[11px] leading-relaxed p-3.5 border border-emerald-100 rounded-xl text-emerald-800 font-medium">
                        Launch a sponsored ad campaign inside the platform. The selection amount budget is directly debited from your digital wallet available balance.
                      </div>

                      <div className="space-y-px">
                        <label className="text-[9px] font-bold text-gray-400 uppercase">Campaign Name / Sponsoring Brand</label>
                        <input type="text" required placeholder="e.g. Coca-Cola Fresh" value={newAdCampaignName} onChange={(e) => setNewAdCampaignName(e.target.value)} className="w-full bg-gray-50 border p-2 text-xs rounded font-bold" />
                      </div>

                      <div className="space-y-px">
                        <label className="text-[9px] font-bold text-gray-400 uppercase">Description Copy (Facebook Style)</label>
                        <input type="text" required placeholder="Experience limitless hydration starting today!" value={newAdCaption} onChange={(e) => setNewAdCaption(e.target.value)} className="w-full bg-gray-50 border p-2 text-xs rounded font-semibold" />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-px">
                          <label className="text-[9px] font-bold text-gray-400 uppercase">Ad Placement</label>
                          <select
                            value={newAdPlacement}
                            onChange={(e: any) => setNewAdPlacement(e.target.value)}
                            className="w-full bg-gray-50 border p-2 text-xs rounded font-bold text-stone-700"
                          >
                            <option value="feed">Main Feed 🏠</option>
                            <option value="reels">Reels Feed 🎬</option>
                            <option value="groups">Group Posts 👥</option>
                          </select>
                        </div>

                        <div className="space-y-px">
                          <label className="text-[9px] font-bold text-gray-400 uppercase">Campaign Budget (₹)</label>
                          <select
                            value={adCampaignCost}
                            onChange={(e) => setAdCampaignCost(e.target.value)}
                            className="w-full bg-gray-50 border p-2 text-xs rounded font-mono font-bold text-emerald-650"
                          >
                            <option value="200">₹200 (Bronze Campaign)</option>
                            <option value="500">₹500 (Silver Campaign)</option>
                            <option value="1200">₹1200 (Gold Campaign)</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-px">
                          <label className="text-[9px] font-bold text-gray-400 uppercase">Button CTA Text</label>
                          <input type="text" placeholder="Buy Now" value={newAdCtaText} onChange={(e) => setNewAdCtaText(e.target.value)} className="w-full bg-gray-50 border p-2 text-xs rounded" />
                        </div>
                        <div className="space-y-px">
                          <label className="text-[9px] font-bold text-gray-400 uppercase">Target Link / URL</label>
                          <input type="text" placeholder="https://mywebsite.com" value={newAdLink} onChange={(e) => setNewAdLink(e.target.value)} className="w-full bg-gray-50 border p-2 text-[10px] rounded" />
                        </div>
                      </div>

                      <div className="space-y-px">
                        <label className="text-[9px] font-bold text-gray-400 uppercase">Banner / Image URL</label>
                        <input 
                          type="text" 
                          placeholder="https://images.unsplash.com/..." 
                          value={newAdImage} 
                          onChange={(e) => setNewAdImage(e.target.value)} 
                          className="w-full bg-gray-50 border p-2 text-[9px] rounded font-mono" 
                        />
                      </div>

                      <div className="flex gap-2 pt-3">
                        <button type="button" onClick={() => setShowBuyAdModal(false)} className="px-3 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl text-xs">Cancel</button>
                        <button type="submit" className="flex-1 p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs leading-none">Wallet Pay</button>
                        <button 
                          type="button" 
                          onClick={() => {
                            if (!newAdCampaignName || !newAdCaption) {
                              alert("Please enter the campaign name and caption.");
                              return;
                            }
                            const costVal = parseInt(adCampaignCost) || 200;
                            const costUsd = Math.max(5, Math.round(costVal / 10));
                            setPayPalParams({
                              amount: costUsd,
                              description: `IMChat Ad: ${newAdCampaignName}`,
                              itemType: 'ad_campaign',
                              metadata: {
                                name: newAdCampaignName,
                                caption: newAdCaption,
                                image: newAdImage,
                                placement: newAdPlacement,
                                ctaText: newAdCtaText,
                                ctaLink: newAdLink
                              }
                            });
                            setShowPayPalModal(true);
                          }} 
                          className="flex-1 p-2.5 bg-[#0070BA] hover:bg-[#003087] text-white font-black rounded-xl text-xs leading-none flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                        >
                          <span className="italic font-black text-xs">P</span> Pay with PayPal
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* PayPal Checkout Modal */}
      {showPayPalModal && payPalParams && (
        <PayPalCheckoutModal
          isOpen={showPayPalModal}
          onClose={() => setShowPayPalModal(false)}
          amount={payPalParams.amount}
          currency="USD"
          description={payPalParams.description}
          itemType={payPalParams.itemType}
          userId={currentUserUid}
          metadata={payPalParams.metadata}
          onSuccess={handlePayPalSuccess}
          onError={(err) => alert(`PayPal Checkout Error: ${err}`)}
        />
      )}
    </motion.div>
  );
}
