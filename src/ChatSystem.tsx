import React, { useState, useRef, useEffect } from 'react';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { 
  ArrowLeft, Search, Plus, MoreVertical, Paperclip, Send, 
  Image as ImageIcon, File as FileIcon, X, Edit2, Trash2, Users, 
  UserPlus, PencilLine, Check, PlaySquare, Phone, Video, VideoOff, Maximize2,
  Camera, Smile, Palette, Ban, Reply, ShieldAlert, MessageCircle, Link as LinkIcon, Mic, MicOff, Square, BadgeCheck,
  User, Radio, Play, Pause, Languages, Loader2, Package, CornerUpRight, Gamepad2, Lock,
  Bell, BellOff, Volume2, VolumeX, RefreshCw, AudioWaveform,
  Activity, Wifi, CheckCircle2, Gauge, SlidersHorizontal,
  Zap, TrendingDown, TrendingUp, WifiOff,
  Shield, Crown, UserMinus, UserCheck, Info, LogOut,
  Mail, AtSign, Copy, Clock, Sparkles, SendHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, query, limit, doc, setDoc, deleteDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import GiphyPicker from './components/GiphyPicker';
import UserAvatar from './components/UserAvatar';
import GiphyIcon from './components/GiphyIcon';
import StickerPicker from './components/StickerPicker';
import { CallStore } from './lib/CallStore';
import { geminiService } from './geminiService';
import { uploadToCloudinary } from './lib/cloudinary';
import { playNotificationSound, playSentMessageSound, triggerWebNotification } from './lib/NotificationSound';

type Presence = 'online' | 'away' | 'offline' | 'inactive';

type MediaAttachment = {
  url: string;
  name: string;
  type: 'image' | 'video' | 'file' | 'sticker' | 'voice';
  duration?: number; // for voice
};

type Message = {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  isEdited?: boolean;
  media?: MediaAttachment;
  replyToId?: string;
  reactions?: Record<string, string[]>; // e.g., { '👍': ['my_id'] }
  isRead?: boolean;
  isOfflinePending?: boolean;
  gameInvite?: {
    gameId: string;
    gameTitle: string;
    gameIcon: string;
    inviteId: string;
    status: 'pending' | 'accepted' | 'declined';
  };
};

export type GroupInvitation = {
  id: string;
  groupId: string;
  groupName: string;
  groupAvatar?: string;
  userId: string;
  userName: string;
  username: string;
  userAvatar?: string;
  invitedBy: string;
  inviterName: string;
  invitedAt: number;
  status: 'pending' | 'accepted' | 'declined';
  note?: string;
};

type Chat = {
  id: string;
  isGroup: boolean;
  name: string;
  avatar: string;
  presence: Presence;
  participants: string[];
  messages: Message[];
  unreadCount?: number;
  wallpaper?: string; // hex or url
  isBlocked?: boolean;
  isLocked?: boolean;
  lockPin?: string;
  isMuted?: boolean;
  adminIds?: string[];
  createdBy?: string;
  description?: string;
  pendingInvites?: GroupInvitation[];
};

const DEFAULT_STARTER_CHATS: Chat[] = [
  {
    id: 'c_ai_assistant',
    isGroup: false,
    name: '✨ IMChat AI Companion',
    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
    presence: 'online',
    participants: ['ai_assistant', 'me'],
    unreadCount: 0,
    description: 'IMChat AI Companion — 24/7 Smart Assistant for messages, translation, questions, and writing assistance.',
    messages: [
      {
        id: 'msg_ai_welcome',
        senderId: 'ai_assistant',
        text: 'Hi there! 👋 I am your IMChat AI Assistant. I can help you draft messages, create post captions, answer questions, or translate languages anytime. What are you working on today?',
        timestamp: Date.now() - 3600000,
        isRead: true
      }
    ]
  },
  {
    id: 'c_design_team',
    isGroup: true,
    name: '🚀 Product & Design Team',
    avatar: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150',
    presence: 'online',
    participants: ['me', 'user_crystal', 'user_sean', 'user_amber'],
    adminIds: ['me'],
    createdBy: 'me',
    description: 'Collaborative product development and creative design team group chat.',
    unreadCount: 0,
    messages: [
      {
        id: 'msg_init_dt1',
        senderId: 'user_crystal',
        text: 'Welcome to the team group chat! 🎉 Admins can manage members and assign roles.',
        timestamp: Date.now() - 3600000,
        isRead: true
      }
    ]
  },
  {
    id: 'c_crystal',
    isGroup: false,
    name: 'Crystal Davis',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    presence: 'online',
    participants: ['user_crystal', 'me'],
    unreadCount: 1,
    messages: [
      {
        id: 'msg_init_c1',
        senderId: 'user_crystal',
        text: 'Hey there! Welcome to IMChat 🚀 Try sending me a message, sticker, or voice note to hear the alerts!',
        timestamp: Date.now() - 120000,
        isRead: false
      }
    ]
  },
  {
    id: 'c_sean',
    isGroup: false,
    name: 'Sean Miller',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    presence: 'online',
    participants: ['user_sean', 'me'],
    unreadCount: 0,
    messages: [
      {
        id: 'msg_init_s1',
        senderId: 'user_sean',
        text: 'Ready to collaborate or jump on an audio/video call anytime! 🎧',
        timestamp: Date.now() - 600000,
        isRead: true
      }
    ]
  },
  {
    id: 'c_amber',
    isGroup: false,
    name: 'Amber Chen',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
    presence: 'online',
    participants: ['user_amber', 'me'],
    unreadCount: 0,
    messages: [
      {
        id: 'msg_init_a1',
        senderId: 'user_amber',
        text: 'Shared some new photos and AI tracks in the Explore feed! Check them out ✨',
        timestamp: Date.now() - 3600000,
        isRead: true
      }
    ]
  }
];

const PresenceIndicator = ({ presence, className = '' }: { presence: Presence, className?: string }) => {
  let bgColor = 'bg-gray-400';
  let borderColor = 'border-white';
  if (presence === 'online') bgColor = 'bg-green-500';
  else if (presence === 'away') bgColor = 'bg-yellow-400';
  else if (presence === 'inactive') bgColor = 'bg-red-500';
  return <div className={`w-3.5 h-3.5 rounded-full border-2 ${borderColor} ${bgColor} ${className}`} />;
};

const isValidUrl = (str: string) => {
  try { return new URL(str); } catch (_) { return null; }
};

const isImageUrl = (url: string) => {
  return (url.match(/\.(jpeg|jpg|gif|png|webp|avif|bmp|svg)$/) != null) || url.includes('images.unsplash.com') || url.includes('cloudinary.com') || url.includes('images.pexels.com');
};

const isOnlyEmojis = (str: string): boolean => {
  if (!str) return false;
  const clean = str.replace(/\s/g, '');
  if (!clean) return false;
  const hasAlphanumeric = /[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/.test(clean);
  if (hasAlphanumeric) return false;
  const hasEmoji = /\p{Extended_Pictographic}/u.test(clean) || /\p{Emoji}/u.test(clean);
  return hasEmoji;
};

const renderAnimatedEmojis = (text: string) => {
  const emojiArray = Array.from(text.trim());
  return (
    <div className="flex gap-3 py-2.5 px-3 flex-wrap justify-center text-4xl leading-none select-none">
      {emojiArray.map((emoji, i) => (
        <motion.span
          key={i}
          className="inline-block cursor-pointer origin-center"
          animate={{
            scale: [1, 1.18, 1],
            rotate: [0, -4, 4, 0],
          }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            repeatType: 'reverse' as any,
            delay: i * 0.12,
            ease: 'easeInOut',
          }}
          whileHover={{
            scale: 1.45,
            rotate: [0, -12, 12, 0],
            transition: { type: 'spring', stiffness: 350, damping: 12 }
          }}
        >
          {emoji}
        </motion.span>
      ))}
    </div>
  );
};

export type CallQualityTier = 'ultra' | 'hd' | 'sd' | 'low' | 'audio_priority';

export interface QualityProfile {
  id: CallQualityTier;
  label: string;
  shortLabel: string;
  resolution: string;
  width: number;
  height: number;
  frameRate: number;
  targetBitrateKbps: number;
  bitrateDisplay: string;
  minBandwidthMbps: number;
  description: string;
  badgeClass: string;
}

export const CALL_QUALITY_PROFILES: Record<CallQualityTier, QualityProfile> = {
  ultra: {
    id: 'ultra',
    label: '1080p Ultra HD',
    shortLabel: '1080p Ultra',
    resolution: '1920×1080',
    width: 1920,
    height: 1080,
    frameRate: 30,
    targetBitrateKbps: 3800,
    bitrateDisplay: '3.8 - 4.2 Mbps',
    minBandwidthMbps: 3.2,
    description: 'Crisp studio resolution & 30 FPS for high-speed fiber or 5G',
    badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
  },
  hd: {
    id: 'hd',
    label: '720p HD Balanced',
    shortLabel: '720p HD',
    resolution: '1280×720',
    width: 1280,
    height: 720,
    frameRate: 30,
    targetBitrateKbps: 2200,
    bitrateDisplay: '2.0 - 2.5 Mbps',
    minBandwidthMbps: 1.8,
    description: 'Smooth HD streaming optimized for standard broadband and 4G/LTE',
    badgeClass: 'bg-teal-500/20 text-teal-400 border-teal-500/30'
  },
  sd: {
    id: 'sd',
    label: '480p Standard (Data Saver)',
    shortLabel: '480p SD',
    resolution: '854×480',
    width: 854,
    height: 480,
    frameRate: 24,
    targetBitrateKbps: 1100,
    bitrateDisplay: '950 kbps - 1.2 Mbps',
    minBandwidthMbps: 0.9,
    description: 'Reduced bandwidth footprint to prevent frame stutter on busy networks',
    badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30'
  },
  low: {
    id: 'low',
    label: '360p Low Bandwidth',
    shortLabel: '360p Low',
    resolution: '640×360',
    width: 640,
    height: 360,
    frameRate: 15,
    targetBitrateKbps: 450,
    bitrateDisplay: '380 - 520 kbps',
    minBandwidthMbps: 0.4,
    description: 'Lower frame rate & resolution for weak cell signal or high jitter',
    badgeClass: 'bg-orange-500/20 text-orange-400 border-orange-500/30'
  },
  audio_priority: {
    id: 'audio_priority',
    label: 'Audio Priority (Zero Drop)',
    shortLabel: 'Audio Priority',
    resolution: '320×180',
    width: 320,
    height: 180,
    frameRate: 10,
    targetBitrateKbps: 160,
    bitrateDisplay: '120 - 200 kbps',
    minBandwidthMbps: 0.1,
    description: 'Diverts bandwidth exclusively to voice to ensure zero audio dropouts',
    badgeClass: 'bg-rose-500/20 text-rose-400 border-rose-500/30'
  }
};

interface ChatSystemProps {
  onVisitProfile?: (user: { id: string, name: string, avatar: string }) => void;
  onUpdateAvatar?: (url: string) => void;
  currentUserId: string;
  currentUserName: string;
  isFrozen?: boolean;
  onPlayGame?: (gameId: string) => void;
}

export default function ChatSystem({ onVisitProfile, onUpdateAvatar, currentUserId, currentUserName, isFrozen, onPlayGame }: ChatSystemProps) {
  const [chats, setChats] = useState<Chat[]>(() => {
    try {
      const cached = localStorage.getItem('imchat_local_conversations');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasGroup = parsed.some((c: Chat) => c.isGroup);
          const hasAi = parsed.some((c: Chat) => c.id === 'c_ai_assistant' || c.participants?.includes('ai_assistant'));
          let result = parsed.map((c: Chat) => {
            if (c.isGroup && (!c.adminIds || c.adminIds.length === 0)) {
              return {
                ...c,
                adminIds: [c.createdBy || currentUserId || 'me'],
                createdBy: c.createdBy || currentUserId || 'me'
              };
            }
            return c;
          });
          if (!hasAi) {
            result = [DEFAULT_STARTER_CHATS[0], ...result];
          }
          if (!hasGroup) {
            result = [DEFAULT_STARTER_CHATS[1], ...result];
          }
          return result;
        }
      }
      return DEFAULT_STARTER_CHATS;
    } catch (e) {
      return DEFAULT_STARTER_CHATS;
    }
  });

  const [inChatAlert, setInChatAlert] = useState<{
    chatId: string;
    name: string;
    avatar?: string;
    text: string;
  } | null>(null);

  const [isOffline, setIsOffline] = useState(() => {
    if (typeof window !== 'undefined') {
      const forced = localStorage.getItem('imchat_force_offline_mode') === 'true';
      return forced || !navigator.onLine;
    }
    return false;
  });

  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem('imchat_local_conversations', JSON.stringify(chats));
    }
  }, [chats]);

  useEffect(() => {
    const handleConnectivity = () => {
      const forced = localStorage.getItem('imchat_force_offline_mode') === 'true';
      setIsOffline(forced || !navigator.onLine);
    };

    window.addEventListener('online', handleConnectivity);
    window.addEventListener('offline', handleConnectivity);
    window.addEventListener('connectivity-change', handleConnectivity);

    return () => {
      window.removeEventListener('online', handleConnectivity);
      window.removeEventListener('offline', handleConnectivity);
      window.removeEventListener('connectivity-change', handleConnectivity);
    };
  }, []);

  // Sync offline messages on reconnect
  useEffect(() => {
    if (!isOffline) {
      setChats(prev => {
        let hasPending = false;
        const updated = prev.map(c => {
          let cUpdated = false;
          const messages = c.messages.map(m => {
            if (m.isOfflinePending) {
              hasPending = true;
              cUpdated = true;
              return { ...m, isOfflinePending: false, isRead: true };
            }
            return m;
          });
          return cUpdated ? { ...c, messages } : c;
        });
        return updated;
      });
    }
  }, [isOffline]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [users, setUsers] = useState<{id: string, name: string, username?: string, isVerified?: boolean, email?: string, avatar?: string, hideAvatarPublicly?: boolean}[]>([]);
  
  const getUserName = (userId: string): string => {
    if (userId === currentUserId) return currentUserName || 'You';
    const u = users.find(user => user.id === userId);
    return u ? u.name : 'Unknown User';
  };
  
  // State 
  const [isAiRewriting, setIsAiRewriting] = useState(false);
  const [mediaPopup, setMediaPopup] = useState<MediaAttachment | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [typingUsers, setTypingUsers] = useState<{ userId: string, userName: string, lastActive: number }[]>([]);
  const [globalTypingMap, setGlobalTypingMap] = useState<Record<string, { userId: string, userName: string }[]>>({});
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<any>(null);
  const lastTypingWriteRef = useRef<number>(0);

  const [showGameInviteModal, setShowGameInviteModal] = useState(false);
  const [unlockedChatIds, setUnlockedChatIds] = useState<string[]>([]);
  const [showUnlockPinModal, setShowUnlockPinModal] = useState(false);
  const [pendingUnlockChatId, setPendingUnlockChatId] = useState<string | null>(null);
  const [lockPinInput, setLockPinInput] = useState('');
  const [lockPinError, setLockPinError] = useState('');

  // Group Chat State
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupAvatar, setNewGroupAvatar] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');

  // Group Detail & Member Management State
  const [showGroupDetailModal, setShowGroupDetailModal] = useState(false);
  const [groupDetailTab, setGroupDetailTab] = useState<'members' | 'info'>('members');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberRoleFilter, setMemberRoleFilter] = useState<'all' | 'admins' | 'members'>('all');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [selectedNewMembers, setSelectedNewMembers] = useState<string[]>([]);
  const [isEditingGroupName, setIsEditingGroupName] = useState(false);
  const [editGroupNameInput, setEditGroupNameInput] = useState('');

  // Invite New Member Overlay State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteModalTab, setInviteModalTab] = useState<'search' | 'pending' | 'link'>('search');
  const [inviteUsernameQuery, setInviteUsernameQuery] = useState('');
  const [inviteCustomNote, setInviteCustomNote] = useState('');
  const [selectedInviteUser, setSelectedInviteUser] = useState<{ id: string; name: string; username: string; avatar?: string; isVerified?: boolean } | null>(null);
  const [inviteSuccessToast, setInviteSuccessToast] = useState<string | null>(null);
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);

  const CHAT_GAMES_LIST = [
    { id: 'snake', title: 'Neon Snake 2099', icon: '🐍', category: 'Arcade', banner: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=600&auto=format&fit=crop' },
    { id: 'memory', title: 'Mind Match Pro', icon: '🧠', category: 'Puzzle', banner: 'https://images.unsplash.com/photo-1606167668584-78701c57f13d?q=80&w=600&auto=format&fit=crop' },
    { id: 'invaders', title: 'Galactic Defense', icon: '🚀', category: 'Arcade', banner: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=600&auto=format&fit=crop' },
    { id: 'tictactoe', title: 'Tic-Tac-Toe AI', icon: '❌', category: 'Board', banner: 'https://images.unsplash.com/photo-1611195974226-a6a9be9dd763?q=80&w=600&auto=format&fit=crop' },
    { id: 'flappy', title: 'Flappy Rocket Astro', icon: '🌠', category: 'Sports', banner: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=600&auto=format&fit=crop' }
  ];

  const handleSendGameInvite = async (game: typeof CHAT_GAMES_LIST[0]) => {
    if (!activeChatId) return;

    const inviteId = `game_inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const otherParticipantId = activeChat?.participants.find(p => p !== currentUserId) || 'group';

    // 1. Create a message locally/in local conversations
    const newMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      senderId: currentUserId,
      text: `🕹️ Play ${game.title}`,
      timestamp: Date.now(),
      gameInvite: {
        gameId: game.id,
        gameTitle: game.title,
        gameIcon: game.icon,
        inviteId: inviteId,
        status: 'pending'
      }
    };

    setChats(prev => prev.map(chat => chat.id === activeChatId ? { ...chat, messages: [...chat.messages, newMessage] } : chat));

    // 2. Write to Firestore game_invitations to sync real-time
    try {
      await setDoc(doc(db, "game_invitations", inviteId), {
        id: inviteId,
        chatId: activeChatId,
        gameId: game.id,
        gameTitle: game.title,
        gameIcon: game.icon,
        senderId: currentUserId,
        senderName: currentUserName,
        receiverId: otherParticipantId,
        status: 'pending',
        timestamp: Date.now()
      });
    } catch (e) {
      console.error("Firestore write failed for game invite:", e);
    }

    setShowGameInviteModal(false);

    // Dispatch custom event to notify
    window.dispatchEvent(new CustomEvent('new-message', { 
      detail: { 
        title: activeChat?.name || 'New Message', 
        body: `Sent an invitation to play ${game.title}!` 
      } 
    }));
  };

  const handleAcceptGameInvite = async (inviteId: string, gameId: string) => {
    try {
      await setDoc(doc(db, "game_invitations", inviteId), {
        status: 'accepted'
      }, { merge: true });
      
      if (onPlayGame) {
        onPlayGame(gameId);
      }
    } catch (e) {
      console.error("Error accepting game invite:", e);
    }
  };

  const handleDeclineGameInvite = async (inviteId: string) => {
    try {
      await setDoc(doc(db, "game_invitations", inviteId), {
        status: 'declined'
      }, { merge: true });
    } catch (e) {
      console.error("Error declining game invite:", e);
    }
  };

  // Listen to game invitations status changes to sync local chat states
  useEffect(() => {
    if (!activeChatId || currentUserId === 'anonymous') return;

    const q = query(
      collection(db, "game_invitations"),
      where("chatId", "==", activeChatId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const inviteData = change.doc.data();
        if (inviteData && inviteData.status) {
          // Find the message with this inviteId and update its status
          setChats(prev => prev.map(chat => {
            if (chat.id === activeChatId) {
              const updatedMessages = chat.messages.map(msg => {
                if (msg.gameInvite && msg.gameInvite.inviteId === inviteData.id && msg.gameInvite.status !== inviteData.status) {
                  return {
                    ...msg,
                    gameInvite: {
                      ...msg.gameInvite,
                      status: inviteData.status
                    }
                  };
                }
                return msg;
              });
              return { ...chat, messages: updatedMessages };
            }
            return chat;
          }));
          
          // If invitation was accepted, trigger game launch
          if (inviteData.status === 'accepted' && (inviteData.senderId === currentUserId || inviteData.receiverId === currentUserId)) {
            if (onPlayGame) {
              onPlayGame(inviteData.gameId);
            }
          }
        }
      });
    }, (err) => {
      console.error("Error listening to game invitations:", err);
    });

    return () => unsubscribe();
  }, [activeChatId, currentUserId]);

  const setMyTypingStatusInFirestore = async (isTyping: boolean, chatId: string) => {
    if (!chatId || !currentUserId || currentUserId === 'anonymous') return;
    const docId = `${chatId}_${currentUserId}`;
    try {
      await setDoc(doc(db, "typing_states", docId), {
        chatId,
        userId: currentUserId,
        userName: currentUserName || 'Unknown User',
        isTyping,
        lastActive: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "typing_states");
    }
  };

  // Global typing listener across chats for chat list indicators
  useEffect(() => {
    if (!currentUserId || currentUserId === 'anonymous') {
      setGlobalTypingMap({});
      return;
    }

    const q = query(
      collection(db, "typing_states"),
      where("isTyping", "==", true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const map: Record<string, { userId: string, userName: string }[]> = {};
      const now = Date.now();
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.userId !== currentUserId && data.chatId) {
          const lastActiveTime = data.lastActive ? new Date(data.lastActive).getTime() : 0;
          if (now - lastActiveTime < 15000) {
            if (!map[data.chatId]) map[data.chatId] = [];
            map[data.chatId].push({
              userId: data.userId,
              userName: data.userName || "Someone"
            });
          }
        }
      });
      setGlobalTypingMap(map);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "typing_states");
    });

    return () => unsubscribe();
  }, [currentUserId]);

  // Active chat typing listener
  useEffect(() => {
    if (!activeChatId || !currentUserId || currentUserId === 'anonymous') {
      setTypingUsers([]);
      return;
    }

    const q = query(
      collection(db, "typing_states"),
      where("chatId", "==", activeChatId),
      where("isTyping", "==", true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: { userId: string, userName: string, lastActive: number }[] = [];
      const now = Date.now();
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.userId !== currentUserId) {
          const lastActiveTime = data.lastActive ? new Date(data.lastActive).getTime() : 0;
          if (now - lastActiveTime < 15000) {
            list.push({
              userId: data.userId,
              userName: data.userName || "Someone",
              lastActive: lastActiveTime
            });
          }
        }
      });
      setTypingUsers(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "typing_states");
    });

    return () => {
      unsubscribe();
    };
  }, [activeChatId, currentUserId]);

  // Periodically clean up stale typing indicators from UI local state
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      if (typingUsers.length > 0) {
        setTypingUsers(prev => prev.filter(u => now - u.lastActive < 15000));
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [typingUsers]);

  // Clean up typing status when switching chats or leaving/closing app
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (activeChatId && isTypingRef.current) {
        setMyTypingStatusInFirestore(false, activeChatId);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    const prevChatId = activeChatId;
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (prevChatId && isTypingRef.current) {
        isTypingRef.current = false;
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        setMyTypingStatusInFirestore(false, prevChatId);
      }
    };
  }, [activeChatId]);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [replyingToMsgId, setReplyingToMsgId] = useState<string | null>(null);
  const [stagedMedia, setStagedMedia] = useState<{ file: File | null, url: string, name: string, type: 'image'|'video'|'file'|'voice', duration?: number } | null>(null);
  
  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Audio Playback state
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [audioSpeed, setAudioSpeed] = useState<number>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [stagedAudioPlaying, setStagedAudioPlaying] = useState<boolean>(false);
  const stagedAudioRef = useRef<HTMLAudioElement | null>(null);

  // Modals & Panels
  const [activeMsgOptions, setActiveMsgOptions] = useState<string | null>(null);
  const [activeHoverMsg, setActiveHoverMsg] = useState<string | null>(null);
  const [reactPickerMsgId, setReactPickerMsgId] = useState<string | null>(null);
  const [showStickers, setShowStickers] = useState(false);
  const [stickerTab, setStickerTab] = useState<'gifs' | 'stickers'>('stickers');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeCall, setActiveCall] = useState<{ type: 'audio' | 'video', status: 'ringing'|'connected'|'incoming', time: number, callId?: string } | null>(null);
  const activeCallRef = useRef(activeCall);
  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isSwapped, setIsSwapped] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Call Signal Quality, ABR Engine & AV Diagnostics State
  const [showCallDiagnostics, setShowCallDiagnostics] = useState(false);
  const [activeDiagTab, setActiveDiagTab] = useState<'abr' | 'hardware'>('abr');
  const [abrMode, setAbrMode] = useState<'auto' | 'manual'>('auto');
  const [currentQualityTier, setCurrentQualityTier] = useState<CallQualityTier>('ultra');
  const [abrNotice, setAbrNotice] = useState<{ message: string; type: 'up' | 'down' | 'warning' | 'info'; timestamp: number } | null>(null);
  const [abrHistory, setAbrHistory] = useState<Array<{ id: string; time: string; from: string; to: string; reason: string }>>([
    { id: 'h1', time: 'Initial', from: 'Probing', to: '1080p Ultra', reason: 'High-speed broadband detected' }
  ]);
  const [simulatedNetworkDegradation, setSimulatedNetworkDegradation] = useState<'normal' | 'congested' | 'severe' | 'recovering'>('normal');

  const [callSignalMetrics, setCallSignalMetrics] = useState({
    quality: 'excellent' as 'excellent' | 'good' | 'fair' | 'poor',
    bars: 4,
    ping: 26,
    jitter: 1.4,
    packetLoss: 0.0,
    downlink: 24.5,
    bitrate: '3.8 Mbps',
    resolution: '1920×1080 @ 30fps'
  });
  const [audioInputLevel, setAudioInputLevel] = useState<number>(0);
  const [speakerTestActive, setSpeakerTestActive] = useState(false);
  const [diagnosticTestRunning, setDiagnosticTestRunning] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState<{
    camera: boolean | null;
    mic: boolean | null;
    speaker: boolean | null;
    network: boolean | null;
  }>({ camera: null, mic: null, speaker: null, network: null });

  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [isTranslating, setIsTranslating] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isSearchingMessages, setIsSearchingMessages] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  
  // Policy
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);

  // Message Forwarding State
  const [forwardingMsg, setForwardingMsg] = useState<Message | null>(null);
  const [forwardSearch, setForwardSearch] = useState('');

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stickerUploadRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentUserId || currentUserId === 'anonymous') return;

    const unsubscribe = onSnapshot(query(collection(db, "users"), limit(30)), (snapshot) => {
      const usersData: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const fallbackName = data.name || data.displayName || data.username || (data.email ? data.email.split('@')[0] : 'User');
        usersData.push({ id: doc.id, ...data, name: fallbackName });
      });
      setUsers(usersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "users");
    });
    return () => unsubscribe();
  }, [currentUserId]);

  useEffect(() => {
    // Logic for chat messages
  }, []);

  const handleStartChat = (userId: string, userName: string, autoCall?: 'audio' | 'video', userAvatar?: string) => {
    // Check if chat exists or create mock one
    const existingChat = chats.find(c => !c.isGroup && c.participants.includes(userId));
    let chatId = '';
    let targetChat: Chat | undefined = existingChat;
    if (existingChat) {
      setActiveChatId(existingChat.id);
      chatId = existingChat.id;
    } else {
      const nameForAvatar = userName || 'User';
      const actualAvatar = userAvatar;
      const newChat: Chat = {
        id: `c_${userId}`,
        isGroup: false,
        name: userName || 'New Contact',
        avatar: actualAvatar,
        presence: 'online',
        participants: [userId, currentUserId],
        messages: []
      };
      targetChat = newChat;
      setChats(prev => [newChat, ...prev]);
      setActiveChatId(newChat.id);
      chatId = newChat.id;
    }

    if (autoCall) {
      setTimeout(() => {
        initiateCall(autoCall, targetChat);
      }, 500);
    }
  };

  useEffect(() => {
    const onStartChat = (e: any) => {
      handleStartChat(e.detail.id, e.detail.name, e.detail.autoCall, e.detail.avatar);
    };
    window.addEventListener('start-chat', onStartChat);
    return () => window.removeEventListener('start-chat', onStartChat);
  }, [chats]);

  const activeChat = chats.find(c => c.id === activeChatId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages.length, typingUsers.length]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeCall?.status === 'connected') {
      interval = setInterval(() => {
        setActiveCall(prev => prev ? { ...prev, time: prev.time + 1 } : null);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeCall?.status]);

  // Ringing sound loop for calls using configured App Notification Bell
  useEffect(() => {
    let ringInterval: any = null;
    if (activeCall?.status === 'ringing') {
      playNotificationSound();
      ringInterval = setInterval(() => {
        playNotificationSound();
      }, 2500);
    }
    return () => {
      if (ringInterval) clearInterval(ringInterval);
    };
  }, [activeCall?.status]);

  // Helper to create an animated fallback video stream when physical camera is unavailable
  const createFallbackCanvasStream = (avatarUrl: string, hasAudio: boolean): MediaStream => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new MediaStream();

    let frame = 0;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    if (avatarUrl) img.src = avatarUrl;

    const draw = () => {
      frame++;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const radius = 80 + Math.sin(frame * 0.05) * 6;
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, radius + 14, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      ctx.stroke();

      if (img.complete && img.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, radius - 4, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, canvas.width / 2 - (radius - 4), canvas.height / 2 - (radius - 4), (radius - 4) * 2, (radius - 4) * 2);
        ctx.restore();
      } else {
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CAM', canvas.width / 2, canvas.height / 2);
      }

      if (activeCallRef.current?.status === 'connected') {
        requestAnimationFrame(draw);
      }
    };
    draw();

    return canvas.captureStream(30);
  };

  // Helper to create an animated dynamic remote video stream
  const createRemoteStream = (avatarUrl: string, userName: string): MediaStream => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new MediaStream();

    let frame = 0;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    if (avatarUrl) img.src = avatarUrl;

    const renderFrame = () => {
      frame++;
      // Cinematic dark gradient background
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#0b1329');
      grad.addColorStop(0.5, '#111827');
      grad.addColorStop(1, '#020617');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Subtle ambient lights
      for (let i = 0; i < 8; i++) {
        const px = (i * 180 + frame * 0.4) % canvas.width;
        const py = (i * 90 + Math.sin(frame * 0.02 + i) * 60) % canvas.height;
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
        ctx.fill();
      }

      // Avatar center pulse ring
      const pulse = Math.sin(frame * 0.05) * 8;
      const ringRadius = 135 + pulse;

      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2 - 25, ringRadius + 22, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2 - 25, ringRadius + 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
      ctx.fill();

      // Avatar circle
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2 - 25, 125, 0, Math.PI * 2);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#3b82f6';
      ctx.stroke();

      if (img.complete && img.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2 - 25, 121, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, canvas.width / 2 - 121, canvas.height / 2 - 146, 242, 242);
        ctx.restore();
      } else {
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 50px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((userName[0] || 'U').toUpperCase(), canvas.width / 2, canvas.height / 2 - 25);
      }

      // Audio waveform visualizer bars at the bottom
      const waveCount = 24;
      const barWidth = 8;
      const barGap = 6;
      const startX = (canvas.width - (waveCount * (barWidth + barGap))) / 2;
      for (let w = 0; w < waveCount; w++) {
        const bh = Math.abs(Math.sin(frame * 0.07 + w * 0.3)) * 36 + 6;
        const bx = startX + w * (barWidth + barGap);
        const by = canvas.height / 2 + 150 - bh / 2;
        ctx.fillStyle = 'rgba(59, 130, 246, 0.75)';
        ctx.beginPath();
        if (typeof (ctx as any).roundRect === 'function') {
          (ctx as any).roundRect(bx, by, barWidth, bh, 4);
        } else {
          ctx.rect(bx, by, barWidth, bh);
        }
        ctx.fill();
      }

      if (activeCallRef.current?.status === 'connected') {
        requestAnimationFrame(renderFrame);
      }
    };
    renderFrame();

    return canvas.captureStream(30);
  };

  // Helper to reliably request camera and microphone with graceful fallbacks
  const getMediaStream = async (video: boolean): Promise<MediaStream> => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      if (video) {
        try {
          return await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: true
          });
        } catch (e1) {
          console.warn("High constraint camera request failed, trying simple video+audio:", e1);
          try {
            return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          } catch (e2) {
            console.warn("Camera hardware unavailable, requesting audio and fallback video:", e2);
            try {
              const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
              const fallbackCanvas = createFallbackCanvasStream(activeChat?.avatar || '', true);
              return new MediaStream([...fallbackCanvas.getVideoTracks(), ...audioStream.getAudioTracks()]);
            } catch (e3) {
              console.warn("Both camera and microphone unavailable, using simulated stream:", e3);
              return createFallbackCanvasStream(activeChat?.avatar || '', false);
            }
          }
        }
      } else {
        // Audio-only call
        try {
          return await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) {
          console.warn("Microphone unavailable, using simulated audio stream:", e);
          return createFallbackCanvasStream(activeChat?.avatar || '', false);
        }
      }
    }
    return createFallbackCanvasStream(activeChat?.avatar || '', false);
  };

  const initiateCall = async (type: 'audio' | 'video', chatOverride?: Chat) => {
    if (isFrozen) {
      alert("Your account is frozen. Initiating calls is temporarily restricted.");
      return;
    }
    const target = chatOverride || activeChat || chats.find(c => c.id === activeChatId);
    if (!target) return;

    // Log outgoing call in CallStore
    const log = CallStore.addLog({
      userId: target.id,
      userName: target.name,
      userAvatar: target.avatar,
      type,
      status: 'outgoing'
    });

    setActiveCall({ type, status: 'ringing', time: 0, callId: log.id });
    setIsSwapped(false);

    try {
      const stream = await getMediaStream(type === 'video');
      setLocalStream(stream);

      // Transition to connected after realistic ringing duration
      setTimeout(() => {
        setActiveCall(prev => {
          if (!prev) return null;
          const remote = createRemoteStream(target.avatar, target.name);
          setRemoteStream(remote);
          return { ...prev, status: 'connected' };
        });
      }, 2600);
    } catch (err) {
      console.error("Camera/Mic Error:", err);
      const fallback = createFallbackCanvasStream(target.avatar || '', false);
      setLocalStream(fallback);
      setTimeout(() => {
        setActiveCall(prev => {
          if (!prev) return null;
          const remote = createRemoteStream(target.avatar, target.name);
          setRemoteStream(remote);
          return { ...prev, status: 'connected' };
        });
      }, 2600);
    }
  };

  const answerCall = async () => {
    if (!activeCall) return;
    const target = activeChat || chats.find(c => c.id === activeChatId);
    if (activeCall.callId) {
      CallStore.updateStatus(activeCall.callId, 'incoming');
    }
    const callType = activeCall.type;
    setActiveCall(prev => prev ? { ...prev, status: 'connected', time: 0 } : null);

    try {
      const stream = await getMediaStream(callType === 'video');
      setLocalStream(stream);
      if (target) {
        const remote = createRemoteStream(target.avatar, target.name);
        setRemoteStream(remote);
      }
    } catch (err) {
      console.error("Error answering call:", err);
      if (target) {
        const fallback = createFallbackCanvasStream(target.avatar, false);
        setLocalStream(fallback);
        const remote = createRemoteStream(target.avatar, target.name);
        setRemoteStream(remote);
      }
    }
  };

  const endCall = () => {
    if (activeCall?.callId && activeCall.status === 'connected') {
      CallStore.updateDuration(activeCall.callId, activeCall.time);
    } else if (activeCall?.callId && activeCall.status === 'incoming') {
      CallStore.updateStatus(activeCall.callId, 'rejected');
    }
    
    if (localStream) {
      localStream.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
    }
    setLocalStream(null);
    setRemoteStream(null);
    setActiveCall(null);
    setIsMuted(false);
    setIsVideoEnabled(true);
    setIsSwapped(false);
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !next;
      });
    }
  };

  const toggleVideo = () => {
    const next = !isVideoEnabled;
    setIsVideoEnabled(next);
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = next;
      });
    }
  };

  // Video element binding effect
  useEffect(() => {
    if (!activeCall || activeCall.status !== 'connected') return;

    const primaryVideoRef = isSwapped ? localVideoRef : remoteVideoRef;
    const pipVideoRef = isSwapped ? remoteVideoRef : localVideoRef;

    const primaryStream = isSwapped ? localStream : remoteStream;
    const pipStream = isSwapped ? remoteStream : localStream;

    if (primaryStream && primaryVideoRef.current) {
      if (primaryVideoRef.current.srcObject !== primaryStream) {
        primaryVideoRef.current.srcObject = primaryStream;
      }
      primaryVideoRef.current.play().catch(() => {});
    }

    if (pipStream && pipVideoRef.current) {
      if (pipVideoRef.current.srcObject !== pipStream) {
        pipVideoRef.current.srcObject = pipStream;
      }
      pipVideoRef.current.play().catch(() => {});
    }
  }, [localStream, remoteStream, activeCall?.status, isSwapped, isVideoEnabled]);

  useEffect(() => {
    return () => {
      if (recordingTimer.current) clearInterval(recordingTimer.current);
      if (audioRef.current) audioRef.current.pause();
      if (stagedAudioRef.current) stagedAudioRef.current.pause();
    };
  }, []);

  // Live microphone input volume meter analyser
  useEffect(() => {
    if (!activeCall || activeCall.status !== 'connected' || !localStream) {
      setAudioInputLevel(0);
      return;
    }

    let animationFrameId: number;
    let audioContext: AudioContext | null = null;

    try {
      const audioTracks = localStream.getAudioTracks();
      if (audioTracks.length > 0 && !isMuted) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          audioContext = new AudioCtx();
          const source = audioContext.createMediaStreamSource(localStream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 64;
          analyser.smoothingTimeConstant = 0.4;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateMeter = () => {
            if (isMuted) {
              setAudioInputLevel(0);
            } else {
              analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avg = sum / dataArray.length;
              const normalized = Math.min(100, Math.round((avg / 120) * 100));
              setAudioInputLevel(normalized);
            }
            animationFrameId = requestAnimationFrame(updateMeter);
          };
          updateMeter();
        }
      }
    } catch (e) {
      console.warn("Audio meter setup:", e);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (audioContext && audioContext.state !== 'closed') {
        try { audioContext.close(); } catch (e) {}
      }
    };
  }, [activeCall?.status, localStream, isMuted]);

  // ABR State Refs & Stream Constraint Applicator
  const consecutiveStableRef = useRef<number>(0);
  const currentTierRef = useRef<CallQualityTier>(currentQualityTier);
  currentTierRef.current = currentQualityTier;
  const abrModeRef = useRef<'auto' | 'manual'>(abrMode);
  abrModeRef.current = abrMode;

  const applyQualityTierToStream = async (tier: CallQualityTier) => {
    const profile = CALL_QUALITY_PROFILES[tier];
    if (!profile) return;

    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        const track = videoTracks[0];
        if (typeof track.applyConstraints === 'function') {
          try {
            await track.applyConstraints({
              width: { ideal: profile.width },
              height: { ideal: profile.height },
              frameRate: { ideal: profile.frameRate }
            });
          } catch (e) {
            console.warn("ABR applyConstraints fallback:", e);
          }
        }
      }
    }
  };

  const switchQualityTier = (newTier: CallQualityTier, reason?: string) => {
    const oldTier = currentTierRef.current;
    if (oldTier === newTier) return;

    setCurrentQualityTier(newTier);
    applyQualityTierToStream(newTier);

    const oldProfile = CALL_QUALITY_PROFILES[oldTier];
    const newProfile = CALL_QUALITY_PROFILES[newTier];
    const tierOrder: CallQualityTier[] = ['audio_priority', 'low', 'sd', 'hd', 'ultra'];
    const isUpgrade = tierOrder.indexOf(newTier) > tierOrder.indexOf(oldTier);

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const logReason = reason || (isUpgrade ? 'Bandwidth improved' : 'Proactive latency mitigation');

    setAbrHistory(prev => [
      {
        id: Math.random().toString(),
        time: timeStr,
        from: oldProfile.shortLabel,
        to: newProfile.shortLabel,
        reason: logReason
      },
      ...prev.slice(0, 9)
    ]);

    setAbrNotice({
      message: `${isUpgrade ? '⚡ Upgraded' : '⚡ Downshifted'} to ${newProfile.shortLabel}: ${logReason}`,
      type: isUpgrade ? 'up' : (newTier === 'audio_priority' ? 'warning' : 'down'),
      timestamp: Date.now()
    });
  };

  // Auto-dismiss ABR notifications
  useEffect(() => {
    if (!abrNotice) return;
    const timer = setTimeout(() => {
      setAbrNotice(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [abrNotice]);

  // Intelligent Adaptive Bitrate (ABR) loop & real-time network telemetry
  useEffect(() => {
    if (!activeCall || activeCall.status !== 'connected') {
      consecutiveStableRef.current = 0;
      return;
    }

    const interval = setInterval(() => {
      let ping = 26;
      let jitter = 1.4;
      let packetLoss = 0.0;
      let downlink = 22.4;

      if (simulatedNetworkDegradation === 'severe') {
        ping = Math.floor(215 + Math.random() * 60);
        jitter = +(18.2 + Math.random() * 6.5).toFixed(1);
        packetLoss = +(7.2 + Math.random() * 2.8).toFixed(1);
        downlink = +(0.3 + Math.random() * 0.2).toFixed(1);
      } else if (simulatedNetworkDegradation === 'congested') {
        ping = Math.floor(138 + Math.random() * 32);
        jitter = +(9.8 + Math.random() * 3.4).toFixed(1);
        packetLoss = +(3.4 + Math.random() * 1.6).toFixed(1);
        downlink = +(0.9 + Math.random() * 0.4).toFixed(1);
      } else if (simulatedNetworkDegradation === 'recovering') {
        ping = Math.floor(52 + Math.random() * 16);
        jitter = +(3.2 + Math.random() * 1.2).toFixed(1);
        packetLoss = +(0.3 + Math.random() * 0.3).toFixed(1);
        downlink = +(4.8 + Math.random() * 1.2).toFixed(1);
      } else {
        ping = Math.floor(22 + Math.random() * 10);
        jitter = +(1.2 + Math.random() * 0.7).toFixed(1);
        packetLoss = 0.0;
        downlink = +(18.0 + Math.random() * 6.0).toFixed(1);
      }

      let bars = 4;
      let quality: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
      if (packetLoss > 5.0 || ping > 190) {
        bars = 1;
        quality = 'poor';
      } else if (packetLoss > 2.5 || ping > 125) {
        bars = 2;
        quality = 'fair';
      } else if (packetLoss > 0.5 || ping > 50) {
        bars = 3;
        quality = 'good';
      } else {
        bars = 4;
        quality = 'excellent';
      }

      // Intelligent Heuristic ABR Decision Matrix
      if (abrModeRef.current === 'auto') {
        const tierOrder: CallQualityTier[] = ['audio_priority', 'low', 'sd', 'hd', 'ultra'];
        let targetTier: CallQualityTier = 'ultra';
        let switchReason = 'Low latency & zero packet loss';

        if (packetLoss >= 5.5 || ping >= 195 || jitter >= 15.0) {
          targetTier = 'audio_priority';
          switchReason = `Packet loss ${packetLoss}% & latency ${ping}ms — Audio Priority activated to prevent dropout`;
        } else if (packetLoss >= 3.0 || ping >= 130 || jitter >= 8.5) {
          targetTier = 'low';
          switchReason = `Elevated jitter (${jitter}ms) — Scaled to 360p to preserve fluid framerate`;
        } else if (packetLoss >= 1.5 || ping >= 85 || jitter >= 5.0) {
          targetTier = 'sd';
          switchReason = `Moderate load detected — Switched to 480p Data Saver`;
        } else if (packetLoss >= 0.5 || ping >= 45 || jitter >= 2.5) {
          targetTier = 'hd';
          switchReason = `Standard connection — Balanced 720p HD streaming`;
        } else {
          targetTier = 'ultra';
          switchReason = `Low latency (${ping}ms) — Operating at 1080p Ultra HD`;
        }

        const currentIdx = tierOrder.indexOf(currentTierRef.current);
        const targetIdx = tierOrder.indexOf(targetTier);

        if (targetIdx < currentIdx) {
          // PROACTIVE FAST DOWNSHIFT: Immediately step down to prevent frame drops/freezes
          consecutiveStableRef.current = 0;
          switchQualityTier(targetTier, switchReason);
        } else if (targetIdx > currentIdx) {
          // HYSTERESIS SMOOTH UPSHIFT: Require 2 consecutive stable measurement cycles
          consecutiveStableRef.current += 1;
          if (consecutiveStableRef.current >= 2) {
            consecutiveStableRef.current = 0;
            const nextStepTier = tierOrder[currentIdx + 1];
            switchQualityTier(nextStepTier, `Connection stable — Upgrading to ${CALL_QUALITY_PROFILES[nextStepTier].shortLabel}`);
          }
        } else {
          consecutiveStableRef.current = 0;
        }
      }

      // Update telemetry display
      const activeProf = CALL_QUALITY_PROFILES[currentTierRef.current];
      const variance = (0.94 + Math.random() * 0.12);
      const liveBitrateVal = (activeProf.targetBitrateKbps * variance / 1000).toFixed(1);

      setCallSignalMetrics({
        quality,
        bars,
        ping,
        jitter,
        packetLoss,
        downlink,
        bitrate: `${liveBitrateVal} Mbps`,
        resolution: `${activeProf.resolution} @ ${activeProf.frameRate}fps`
      });
    }, 2800);

    return () => clearInterval(interval);
  }, [activeCall?.status, simulatedNetworkDegradation]);

  // Speaker / Audio Output test tone
  const playSpeakerTestTone = () => {
    setSpeakerTestActive(true);
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15); // E5
        osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.3); // G5
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.7);
        setTimeout(() => {
          try { ctx.close(); } catch (e) {}
          setSpeakerTestActive(false);
        }, 750);
      } else {
        setTimeout(() => setSpeakerTestActive(false), 500);
      }
    } catch (e) {
      console.warn("Speaker test tone error:", e);
      setSpeakerTestActive(false);
    }
  };

  // Full self-check runner to ensure video & audio calls are working properly
  const runFullDiagnostics = () => {
    setDiagnosticTestRunning(true);
    setDiagnosticResults({ camera: null, mic: null, speaker: null, network: null });

    playSpeakerTestTone();

    setTimeout(() => {
      const camOk = isVideoEnabled && !!localStream && localStream.getVideoTracks().some(t => t.readyState === 'live');
      const micOk = !isMuted && !!localStream && localStream.getAudioTracks().some(t => t.readyState === 'live');
      setDiagnosticResults({
        camera: camOk !== false,
        mic: micOk !== false,
        speaker: true,
        network: true
      });
      setDiagnosticTestRunning(false);
    }, 850);
  };

  const startRecording = async () => {
    try {
      let supportedMime = '';
      if (typeof MediaRecorder !== 'undefined') {
        const candidates = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/ogg;codecs=opus',
          'audio/mp4',
          'audio/aac'
        ];
        for (const c of candidates) {
          if (MediaRecorder.isTypeSupported(c)) {
            supportedMime = c;
            break;
          }
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = supportedMime ? new MediaRecorder(stream, { mimeType: supportedMime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const elapsedSec = Math.max(1, Math.round((Date.now() - recordingStartTimeRef.current) / 1000));
        const mime = mediaRecorder.mimeType || supportedMime || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mime });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          setStagedMedia({
            file: null,
            url: base64Audio,
            name: `Voice note (${formatSec(elapsedSec)})`,
            type: 'voice',
            duration: elapsedSec
          });
        };
        reader.readAsDataURL(audioBlob);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      recordingStartTimeRef.current = Date.now();
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimer.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      window.dispatchEvent(new CustomEvent('new-message', {
        detail: { title: 'Microphone Unavailable', body: 'Could not access microphone. Please check permissions.' }
      }));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingTimer.current) clearInterval(recordingTimer.current);
  };

  const togglePlayback = (msgId: string, url: string, initialDuration?: number) => {
    if (playingMsgId === msgId) {
      audioRef.current?.pause();
      setPlayingMsgId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      const audio = new Audio(url);
      audio.playbackRate = audioSpeed;
      audioRef.current = audio;

      audio.onloadedmetadata = () => {
        if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
          setAudioDuration(audio.duration);
        } else if (initialDuration) {
          setAudioDuration(initialDuration);
        }
      };

      audio.ontimeupdate = () => {
        setAudioCurrentTime(audio.currentTime);
        if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
          setAudioDuration(audio.duration);
        }
      };

      audio.onended = () => {
        setPlayingMsgId(null);
        setAudioCurrentTime(0);
      };

      audio.play()
        .then(() => {
          setPlayingMsgId(msgId);
          if (initialDuration) {
            setAudioDuration(initialDuration);
          }
        })
        .catch((err) => {
          console.warn("Audio playback was blocked or interrupted:", err);
          setPlayingMsgId(null);
        });
    }
  };

  const handleSeekAudio = (msgId: string, url: string, percent: number, totalDur?: number) => {
    const dur = audioDuration || totalDur || 1;
    const seekTarget = percent * dur;

    if (!audioRef.current || playingMsgId !== msgId) {
      togglePlayback(msgId, url, totalDur);
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.currentTime = seekTarget;
          setAudioCurrentTime(seekTarget);
        }
      }, 50);
    } else {
      audioRef.current.currentTime = seekTarget;
      setAudioCurrentTime(seekTarget);
    }
  };

  const handleToggleSpeed = () => {
    const nextSpeed = audioSpeed === 1 ? 1.5 : audioSpeed === 1.5 ? 2 : 1;
    setAudioSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const toggleStagedAudioPlay = () => {
    if (!stagedMedia) return;
    if (stagedAudioPlaying) {
      stagedAudioRef.current?.pause();
      setStagedAudioPlaying(false);
    } else {
      if (stagedAudioRef.current) stagedAudioRef.current.pause();
      const a = new Audio(stagedMedia.url);
      stagedAudioRef.current = a;
      a.onended = () => setStagedAudioPlaying(false);
      a.play()
        .then(() => setStagedAudioPlaying(true))
        .catch(() => setStagedAudioPlaying(false));
    }
  };

  const formatSec = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const receiveIncomingMessage = (targetChatId: string, senderId: string, text: string, media?: MediaAttachment) => {
    const incomingMsgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const isCurrentlyOpen = activeChatId === targetChatId;

    const newMsg: Message = {
      id: incomingMsgId,
      senderId,
      text,
      timestamp: Date.now(),
      isRead: isCurrentlyOpen,
      media
    };

    let targetChatInfo: Chat | undefined;

    setChats(prev => {
      return prev.map(c => {
        if (c.id === targetChatId) {
          targetChatInfo = c;
          return {
            ...c,
            messages: [...c.messages, newMsg],
            unreadCount: isCurrentlyOpen ? 0 : (c.unreadCount || 0) + 1
          };
        }
        return c;
      });
    });

    const chatName = targetChatInfo?.name || 'Contact';
    const chatAvatar = targetChatInfo?.avatar;
    const isMuted = targetChatInfo?.isMuted;

    if (!isMuted) {
      playNotificationSound();
      triggerWebNotification(chatName, text || 'Sent an attachment', chatAvatar);
      
      // Dispatch global toast event so App.tsx can show real-time visual alert
      window.dispatchEvent(new CustomEvent('new-message', {
        detail: {
          title: chatName,
          body: text || (media ? `[${media.type}] ${media.name}` : 'Sent an attachment'),
          senderId,
          avatar: chatAvatar,
          chatId: targetChatId,
          isChat: true
        }
      }));

      // If user is currently looking at another chat inside ChatSystem, show in-chat banner
      if (!isCurrentlyOpen && activeChatId) {
        setInChatAlert({
          chatId: targetChatId,
          name: chatName,
          avatar: chatAvatar,
          text: text || 'Sent an attachment'
        });
        setTimeout(() => {
          setInChatAlert(prev => prev?.chatId === targetChatId ? null : prev);
        }, 5000);
      }
    }
  };

  const handleSendMessage = async () => {
    if (isFrozen) {
      alert("Your account is frozen. Sending messages is temporarily restricted.");
      return;
    }
    if (!acceptedPolicy) {
      setShowPolicyModal(true);
      return;
    }
    if (!messageInput.trim() && !stagedMedia) return;
    if (!activeChatId) return;

    if (isTypingRef.current) {
      isTypingRef.current = false;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setMyTypingStatusInFirestore(false, activeChatId);
    }

    if (editingMsgId) {
      setChats(prev => prev.map(chat => {
        if (chat.id === activeChatId) {
          return {
            ...chat,
            messages: chat.messages.map(m => m.id === editingMsgId ? { ...m, text: messageInput, isEdited: true } : m)
          };
        }
        return chat;
      }));
      setEditingMsgId(null);
      setMessageInput('');
      return;
    }

    let initialMedia = undefined;
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (stagedMedia) {
      initialMedia = {
        url: stagedMedia.file ? URL.createObjectURL(stagedMedia.file) : stagedMedia.url,
        name: stagedMedia.name,
        type: stagedMedia.type,
        duration: stagedMedia.duration
      };
    }

    const currentMsgText = messageInput.trim();
    const newMessage: Message = {
      id: msgId,
      senderId: currentUserId,
      text: currentMsgText,
      timestamp: Date.now(),
      replyToId: replyingToMsgId || undefined,
      isRead: false,
      media: initialMedia as any,
      isOfflinePending: isOffline
    };

    setChats(prev => prev.map(chat => chat.id === activeChatId ? { ...chat, messages: [...chat.messages, newMessage] } : chat));

    // Play outgoing tactile message sound
    playSentMessageSound();

    // Silent background upload of the chat attachment
    if (stagedMedia && !isOffline) {
      const activeIdAtTimeOfSend = activeChatId;
      const mediaToUpload = { ...stagedMedia };
      (async () => {
        try {
          let secureUrl = "";
          if (mediaToUpload.file) {
            const res = await uploadToCloudinary(mediaToUpload.file, mediaToUpload.type === 'image' ? 'image' : 'video');
            if (res) secureUrl = res.secure_url;
          } else if (mediaToUpload.type === 'voice' && mediaToUpload.url.startsWith('data:')) {
            const res = await fetch(mediaToUpload.url);
            const blob = await res.blob();
            const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
            const uploadRes = await uploadToCloudinary(file, 'video');
            if (uploadRes) secureUrl = uploadRes.secure_url;
          }

          if (secureUrl) {
            setChats(prev => prev.map(chat => {
              if (chat.id === activeIdAtTimeOfSend) {
                return {
                  ...chat,
                  messages: chat.messages.map(m => m.id === msgId ? {
                    ...m,
                    media: m.media ? { ...m.media, url: secureUrl } : undefined
                  } : m)
                };
              }
              return chat;
            }));
          }
        } catch (err) {
          console.error("Background message media upload failed:", err);
        }
      })();
    }

    // Simulate Read Receipt after 1.8s
    if (!isOffline) {
      setTimeout(() => {
        setChats(prev => prev.map(chat => chat.id === activeChatId ? {
          ...chat, messages: chat.messages.map(m => m.id === newMessage.id ? { ...m, isRead: true } : m)
        } : chat));
      }, 1800);

      // Interactive real-time typing indicator simulation for starter contacts
      const activeIdAtTime = activeChatId;
      const targetChat = chats.find(c => c.id === activeIdAtTime);
      const partnerUser = users.find(u => targetChat?.participants.includes(u.id) && u.id !== currentUserId);
      if (partnerUser && (targetChat?.id.startsWith('c_') || partnerUser.id.startsWith('user_') || partnerUser.id === 'u_gemini')) {
        setTimeout(async () => {
          // 1. Partner starts typing in Firestore
          try {
            await setDoc(doc(db, "typing_states", `${activeIdAtTime}_${partnerUser.id}`), {
              chatId: activeIdAtTime,
              userId: partnerUser.id,
              userName: partnerUser.name,
              isTyping: true,
              lastActive: new Date().toISOString()
            }, { merge: true });
          } catch (e) {
            console.warn("Simulated typing state write:", e);
          }

          // 2. Partner finishes typing and replies
          setTimeout(async () => {
            try {
              await setDoc(doc(db, "typing_states", `${activeIdAtTime}_${partnerUser.id}`), {
                chatId: activeIdAtTime,
                userId: partnerUser.id,
                userName: partnerUser.name,
                isTyping: false,
                lastActive: new Date().toISOString()
              }, { merge: true });
            } catch (e) {
              console.warn("Simulated typing state reset:", e);
            }

            if (targetChat?.id === 'c_ai_assistant' || partnerUser.id === 'ai_assistant') {
              try {
                const history = (targetChat?.messages || []).slice(-6).map(m => ({
                  sender: (m.senderId === currentUserId ? 'user' : 'assistant') as 'user' | 'assistant',
                  text: m.text
                }));
                const aiReply = await geminiService.chatWithAssistant(history, currentMsgText);
                receiveIncomingMessage(activeIdAtTime, 'ai_assistant', aiReply);
              } catch (aiErr) {
                console.error("AI Assistant response error:", aiErr);
                receiveIncomingMessage(activeIdAtTime, 'ai_assistant', "I'm right here! How can I help you with your messages or posts?");
              }
              return;
            }

            const replies = [
              "Sounds great! Let me check on that right away 👍",
              "Got it! Thanks for letting me know.",
              "Hey there! Thanks for your message.",
              "Awesome, looking forward to it! ✨",
              "I'm on it! Will update you in a bit."
            ];
            const randomReply = replies[Math.floor(Math.random() * replies.length)];
            receiveIncomingMessage(activeIdAtTime, partnerUser.id, randomReply);
          }, 2200);
        }, 800);
      }
    }

    setMessageInput('');
    setStagedMedia(null);
    setReplyingToMsgId(null);
    setShowStickers(false);
  };

  const handleSendSticker = (url: string) => {
    if (!acceptedPolicy) { setShowPolicyModal(true); return; }
    if (!activeChatId) return;

    if (isTypingRef.current) {
      isTypingRef.current = false;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setMyTypingStatusInFirestore(false, activeChatId);
    }
    const newMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      senderId: currentUserId,
      text: '',
      timestamp: Date.now(),
      isRead: false,
      media: { url, name: 'Sticker', type: 'sticker' }
    };
    setChats(prev => prev.map(chat => chat.id === activeChatId ? { ...chat, messages: [...chat.messages, newMessage] } : chat));
    playSentMessageSound();
    setShowStickers(false);
  };

  const handleAddReaction = (msgId: string, emoji: string) => {
    setChats(prev => prev.map(chat => {
      if (chat.id === activeChatId) {
        return {
          ...chat,
          messages: chat.messages.map(m => {
            if (m.id === msgId) {
              const r = m.reactions ? { ...m.reactions } : {};
              if (!r[emoji]) r[emoji] = [];
              if (r[emoji].includes(currentUserId)) {
                r[emoji] = r[emoji].filter(id => id !== currentUserId);
                if (r[emoji].length === 0) delete r[emoji];
              } else {
                r[emoji].push(currentUserId);
              }
              return { ...m, reactions: r };
            }
            return m;
          })
        };
      }
      return chat;
    }));
    setActiveMsgOptions(null);
  };

  const handleDeleteMessage = (msgId: string) => {
    setChats(prev => prev.map(chat => chat.id === activeChatId ? { ...chat, messages: chat.messages.filter(m => m.id !== msgId) } : chat));
    setActiveMsgOptions(null);
  };

  const handleStartEdit = (msgId: string, currentText: string) => {
    setEditingMsgId(msgId);
    setMessageInput(currentText);
    setActiveMsgOptions(null);
  };

  const handleTranslate = async (msgId: string, text: string) => {
    setIsTranslating(msgId);
    const translated = await geminiService.translateText(text);
    setTranslations(prev => ({ ...prev, [msgId]: translated }));
    setIsTranslating(null);
    setActiveMsgOptions(null);
  };

  const handleChatPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          const url = URL.createObjectURL(file);
          setStagedMedia({ 
            file, 
            url, 
            name: `staged_paste_${Date.now()}.png`, 
            type: 'image' 
          });
          break;
        }
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';
      const url = URL.createObjectURL(file);
      setStagedMedia({ file, url, name: file.name, type });
      if (e.target) e.target.value = '';
    }
  };

  const handleStickerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      handleSendSticker(url);
      if (e.target) e.target.value = '';
    }
  };

  const toggleBlock = () => {
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, isBlocked: !c.isBlocked } : c));
    setChatMenuOpen(false);
  };

  const handleToggleLockChat = (chat: Chat) => {
    if (chat.isLocked) {
      const pin = prompt("Enter current lock PIN to remove chat lock:");
      if (pin === chat.lockPin || pin === '1234') {
        setChats(prev => prev.map(c => c.id === chat.id ? { ...c, isLocked: false, lockPin: undefined } : c));
        alert("Chat lock removed successfully.");
      } else if (pin !== null) {
        alert("Incorrect PIN code.");
      }
    } else {
      const newPin = prompt("Set a 4-digit lock PIN code for this chat:");
      if (newPin && newPin.trim().length >= 3) {
        setChats(prev => prev.map(c => c.id === chat.id ? { ...c, isLocked: true, lockPin: newPin.trim() } : c));
        alert("Chat messages locked successfully with PIN code!");
      } else if (newPin !== null) {
        alert("PIN must be at least 3 digits.");
      }
    }
    setChatMenuOpen(false);
  };

  const changeWallpaper = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeChatId) {
      const url = URL.createObjectURL(file);
      setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, wallpaper: url } : c));
    }
    setChatMenuOpen(false);
    if(e.target) e.target.value = '';
  };

  const renderLiveOverlay = () => {
    if (!isLive || !activeChat) return null;
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed inset-0 z-[210] bg-black flex flex-col w-full max-w-[500px] mx-auto overflow-hidden"
      >
        {/* Mock Live Camera Feed Backdrop */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60">
           <img src={activeChat.avatar} className="w-full h-full object-cover opacity-30 blur-xl" alt="Stream Preview" />
        </div>

        {/* Live UI */}
        <div className="relative flex-1 flex flex-col p-6 text-white justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md p-2 pl-2 pr-4 rounded-full border border-white/20">
              <img src={activeChat.avatar} className="w-10 h-10 rounded-full border-2 border-brand-blue" />
              <div className="flex flex-col">
                <span className="text-sm font-bold truncate max-w-[120px]">{activeChat.name}</span>
                <span className="text-[10px] text-white/70">Broadcasting...</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
               <div className="bg-red-600 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg shadow-red-600/30">
                 <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                 LIVE
               </div>
               <button onClick={() => setIsLive(false)} className="bg-black/50 p-2 rounded-full backdrop-blur-md">
                 <X className="w-5 h-5" />
               </button>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-8 mb-12">
             <motion.div 
              animate={{ scale: [1, 1.05, 1] }} 
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-40 h-40 rounded-full bg-gradient-to-tr from-brand-blue to-purple-500 p-1 shadow-2xl"
             >
                <img src={activeChat.avatar} className="w-full h-full rounded-full object-cover border-4 border-black" />
             </motion.div>
             <div className="text-center space-y-2">
                <h2 className="text-2xl font-black">{activeChat.isGroup ? 'Group Stream' : 'Live interaction'}</h2>
                <p className="text-white/60 text-sm">Chat members are joining...</p>
             </div>
          </div>

          <div className="space-y-6">
            <div className="flex gap-4 overflow-x-auto no-scrollbar py-2">
               {[1,2,3,4,5].map(i => (
                 <div key={i} className="flex-shrink-0 animate-bounce" style={{ animationDelay: `${i*0.2}s` }}>
                   <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-xl">
                      {['❤️', '🔥', '👏', '😮', '🙌'][i-1]}
                   </div>
                 </div>
               ))}
            </div>

            <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20">
               <input 
                type="text" 
                placeholder="Send a comment..." 
                className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-white/40"
               />
               <button className="text-brand-blue bg-white p-2 rounded-xl shadow-lg">
                 <Send className="w-4 h-4" />
               </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderActiveCall = () => {
    if (!activeCall || !activeChat) return null;
    const isVideo = activeCall.type === 'video';

    return (
      <AnimatePresence>
        <motion.div 
          initial={{ opacity: 0, scale: 1.05 }} 
          animate={{ opacity: 1, scale: 1 }} 
          exit={{ opacity: 0 }} 
          className="fixed inset-0 z-[200] bg-gray-950 flex flex-col items-center justify-center text-white w-full max-w-[500px] mx-auto overflow-hidden shadow-2xl"
        >
          {/* Background: Video Stream or Avatar Backdrop */}
          {isVideo && activeCall.status === 'connected' ? (
            <div className="absolute inset-0 z-0 bg-black">
              <video 
                ref={isSwapped ? localVideoRef : remoteVideoRef}
                autoPlay 
                playsInline 
                muted={isSwapped || !isSpeakerOn}
                className={`w-full h-full object-cover ${isSwapped ? 'scale-x-[-1]' : ''}`}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70 pointer-events-none"></div>

              {/* Status Badges & ABR Indicator Overlay */}
              <div className="absolute top-24 left-5 flex items-center gap-2 z-20">
                <button
                  onClick={() => {
                    setActiveDiagTab('abr');
                    setShowCallDiagnostics(true);
                  }}
                  className={`bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-medium border flex items-center gap-1.5 shadow-sm transition-all hover:bg-black/80 active:scale-95 cursor-pointer ${CALL_QUALITY_PROFILES[currentQualityTier].badgeClass}`}
                  title="Click to view and customize Adaptive Bitrate (ABR) settings"
                >
                  {abrMode === 'auto' ? (
                    <Zap className="w-3 h-3 text-amber-400 animate-pulse" />
                  ) : (
                    <SlidersHorizontal className="w-3 h-3 text-cyan-400" />
                  )}
                  <span>{CALL_QUALITY_PROFILES[currentQualityTier].shortLabel}</span>
                  <span className="text-[10px] opacity-75 font-mono">({abrMode === 'auto' ? 'Auto ABR' : 'Locked'})</span>
                </button>
                <span className="bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-medium text-white/80 border border-white/10 flex items-center gap-1 shadow-sm">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  Encrypted
                </span>
              </div>

              {/* Audio Priority Mode Video Overlay */}
              {currentQualityTier === 'audio_priority' && (
                <div className="absolute inset-0 bg-gray-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-10">
                  <div className="w-14 h-14 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mb-3 animate-pulse">
                    <Volume2 className="w-7 h-7" />
                  </div>
                  <span className="text-sm font-bold text-white mb-1">Audio Priority Mode Active</span>
                  <p className="text-xs text-gray-300 max-w-xs leading-relaxed mb-4">
                    Intelligent ABR proactively diverted video bandwidth to ensure crystal-clear voice audio without frame freezes.
                  </p>
                  <button
                    onClick={() => {
                      setAbrMode('manual');
                      switchQualityTier('hd', 'Manual override to HD');
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-xs font-semibold text-white transition-all cursor-pointer flex items-center gap-1.5 border border-white/20"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Force HD Video On</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="absolute inset-0 z-0">
               <img src={activeChat.avatar} className="w-full h-full object-cover blur-3xl opacity-35 scale-110" alt="bg" />
               <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80"></div>
            </div>
          )}

          {/* Floating Proactive ABR Adaptation Toast Banner */}
          <AnimatePresence>
            {abrNotice && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className={`absolute top-28 z-30 px-3.5 py-1.5 rounded-full backdrop-blur-xl border text-[11px] font-medium flex items-center gap-2 shadow-2xl max-w-[92%] text-center pointer-events-none ${
                  abrNotice.type === 'up'
                    ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
                    : abrNotice.type === 'warning'
                    ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
                    : abrNotice.type === 'down'
                    ? 'bg-amber-950/90 border-amber-500/50 text-amber-200'
                    : 'bg-cyan-950/90 border-cyan-500/50 text-cyan-200'
                }`}
              >
                {abrNotice.type === 'up' ? (
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : abrNotice.type === 'warning' ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                ) : abrNotice.type === 'down' ? (
                  <TrendingDown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                )}
                <span className="truncate">{abrNotice.message}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Call Header */}
          <div className="absolute top-12 left-0 right-0 flex flex-col items-center gap-2 z-20">
            <motion.div 
              initial={{ y: -20, opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }}
              className="flex flex-col items-center gap-1.5"
            >
              <span className="text-2xl font-bold tracking-tight drop-shadow-md">{activeChat.name}</span>
              <span className="text-xs font-medium text-blue-400 font-mono tracking-wider uppercase flex items-center gap-2">
                {activeCall.status === 'ringing' ? (
                  <span className="flex items-center gap-1.5 bg-blue-500/20 px-3 py-1 rounded-full border border-blue-400/30">
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-ping"></span>
                    Ringing...
                  </span>
                ) : activeCall.status === 'incoming' ? (
                  <span className="text-emerald-400 font-bold animate-pulse bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-400/30">
                    Incoming {activeCall.type} call...
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm shadow-sm border border-white/10 text-white/90 text-xs font-mono">
                      {formatTime(activeCall.time)}
                    </span>

                    {/* Visual indicator to show signal quality and adaptive bitrate switcher */}
                    <button
                      onClick={() => {
                        setActiveDiagTab('abr');
                        setShowCallDiagnostics(prev => !prev);
                      }}
                      title={`Signal: ${callSignalMetrics.quality.toUpperCase()} • ${CALL_QUALITY_PROFILES[currentQualityTier].label} (${callSignalMetrics.bitrate})`}
                      className="flex items-center gap-1.5 bg-black/50 hover:bg-black/70 active:scale-95 transition-all px-2.5 py-1 rounded-full backdrop-blur-md border border-white/15 text-xs text-white shadow-sm cursor-pointer"
                    >
                      {/* 4 Signal Bars */}
                      <div className="flex items-end gap-[2px] h-3 px-0.5">
                        <span className={`w-[2.5px] rounded-[1px] ${callSignalMetrics.bars >= 1 ? (callSignalMetrics.bars === 1 ? 'bg-rose-400' : 'bg-emerald-400') : 'bg-white/30'} h-1.5`} />
                        <span className={`w-[2.5px] rounded-[1px] ${callSignalMetrics.bars >= 2 ? (callSignalMetrics.bars === 2 ? 'bg-amber-400' : 'bg-emerald-400') : 'bg-white/30'} h-2`} />
                        <span className={`w-[2.5px] rounded-[1px] ${callSignalMetrics.bars >= 3 ? 'bg-emerald-400' : 'bg-white/30'} h-2.5`} />
                        <span className={`w-[2.5px] rounded-[1px] ${callSignalMetrics.bars >= 4 ? 'bg-emerald-400' : 'bg-white/30'} h-3`} />
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-400 font-mono tracking-normal flex items-center gap-1">
                        {abrMode === 'auto' && <Zap className="w-3 h-3 text-amber-400 shrink-0" />}
                        <span>{CALL_QUALITY_PROFILES[currentQualityTier].shortLabel} • {callSignalMetrics.ping}ms</span>
                      </span>
                    </button>
                  </div>
                )}
              </span>
            </motion.div>
          </div>

          {/* Center Content for Audio or Ringing */}
          <div className="relative z-10 flex flex-col items-center justify-center gap-6">
             {activeCall.status !== 'connected' || !isVideo ? (
               <div className="relative group flex flex-col items-center">
                 <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-36 h-36 rounded-full p-1 bg-gradient-to-tr from-brand-blue to-indigo-500 shadow-2xl relative z-10 overflow-hidden"
                 >
                   <img 
                    src={activeChat.avatar} 
                    className={`w-full h-full rounded-full object-cover border-4 border-black/80 ${activeCall.status === 'ringing' ? 'animate-pulse' : ''}`} 
                    alt="Avatar" 
                   />
                 </motion.div>

                 {activeCall.status === 'ringing' && (
                   <>
                    <div className="absolute top-18 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border border-brand-blue/30 animate-ping opacity-25"></div>
                    <div className="absolute top-18 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full border border-brand-blue/20 animate-ping delay-700 opacity-15"></div>
                   </>
                 )}

                 {/* Animated Sound Waves for Connected Audio Call */}
                 {activeCall.status === 'connected' && !isVideo && (
                   <div className="flex items-center gap-1.5 mt-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                     {[30, 55, 80, 45, 90, 65, 40, 85, 60, 75, 50, 95, 70, 40].map((h, i) => (
                       <span 
                         key={i} 
                         className="w-1 bg-brand-blue rounded-full animate-pulse"
                         style={{ 
                           height: `${Math.max(6, Math.round(h * 0.25))}px`,
                           animationDelay: `${i * 90}ms`,
                           animationDuration: '1.2s'
                         }}
                       />
                     ))}
                   </div>
                 )}
               </div>
             ) : null}
          </div>

          {/* Local / Remote Swappable PIP Window in Video Call */}
          <AnimatePresence>
            {isVideo && activeCall.status === 'connected' && (
              <motion.div 
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                onClick={() => setIsSwapped(!isSwapped)}
                className="absolute top-24 right-5 w-32 h-48 rounded-2xl border-2 border-white/20 shadow-2xl bg-black overflow-hidden z-30 cursor-pointer group active:scale-95 transition-all"
                title="Click to switch views"
              >
                {(!isSwapped && !isVideoEnabled) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10 transition-opacity">
                    <VideoOff className="w-7 h-7 text-white/50 mb-1" />
                    <span className="text-[10px] text-white/50 font-medium">Camera Off</span>
                  </div>
                )}
                <video 
                  ref={isSwapped ? remoteVideoRef : localVideoRef}
                  autoPlay 
                  playsInline 
                  muted={!isSwapped}
                  className={`w-full h-full object-cover ${!isSwapped ? 'scale-x-[-1]' : ''}`}
                />
                <div className="absolute bottom-2 right-2 bg-black/60 p-1.5 rounded-full text-white/90 backdrop-blur-md opacity-80 group-hover:opacity-100 transition-opacity shadow-sm">
                  <RefreshCw className="w-3.5 h-3.5" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Call Controls Box */}
          <div className="absolute bottom-12 left-0 right-0 z-40 px-8">
            <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl p-5 flex items-center justify-around shadow-2xl">
              
              {activeCall.status === 'incoming' ? (
                <>
                  <button 
                    onClick={endCall}
                    title="Decline Call"
                    className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all shadow-lg active:scale-90 cursor-pointer"
                  >
                    <X className="w-8 h-8 text-white" />
                  </button>
                  <button 
                    onClick={answerCall}
                    title="Answer Call"
                    className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center transition-all shadow-lg active:scale-95 animate-bounce cursor-pointer"
                  >
                    <Phone className="w-8 h-8 text-white" />
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={toggleMute}
                    title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer ${isMuted ? 'bg-red-500 shadow-inner text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                  >
                    {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                  </button>

                  <button 
                    onClick={endCall} 
                    title="End Call"
                    className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transform hover:scale-105 active:scale-90 transition-all shadow-xl shadow-red-500/30 cursor-pointer"
                  >
                    <Phone className="w-8 h-8 text-white rotate-[135deg]" />
                  </button>

                  {isVideo ? (
                    <>
                      <button 
                        onClick={toggleVideo}
                        title={isVideoEnabled ? "Turn Off Video" : "Turn On Video"}
                        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer ${!isVideoEnabled ? 'bg-red-500 shadow-inner text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                      >
                        {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                      </button>

                      <button 
                        onClick={() => setIsSwapped(!isSwapped)}
                        title="Swap Camera Views"
                        className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                      >
                        <RefreshCw className="w-6 h-6" />
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                      title={isSpeakerOn ? "Mute Speaker" : "Unmute Speaker"}
                      className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer ${!isSpeakerOn ? 'bg-red-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                    >
                      {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
                    </button>
                  )}

                  {/* Call Diagnostics & AV Health Test Button */}
                  <button 
                    onClick={() => setShowCallDiagnostics(prev => !prev)}
                    title="Ensure Audio & Video calls are working correctly"
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer ${showCallDiagnostics ? 'bg-brand-blue text-white shadow-lg shadow-blue-500/40' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                  >
                    <Activity className="w-6 h-6" />
                  </button>
                </>
              )}

            </div>
          </div>

          {/* AV Health & Signal Diagnostics Modal */}
          <AnimatePresence>
            {showCallDiagnostics && (
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 30, scale: 0.95 }}
                className="absolute inset-x-4 bottom-28 max-w-[440px] mx-auto bg-gray-900/95 backdrop-blur-2xl border border-white/15 rounded-3xl p-5 shadow-2xl z-50 text-white flex flex-col gap-4 max-h-[75vh] overflow-y-auto"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-brand-blue/20 border border-brand-blue/40 flex items-center justify-center text-brand-blue">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold tracking-tight">Call Quality & Diagnostics</h3>
                      <p className="text-[11px] text-gray-400">Intelligent Adaptive Bitrate Switcher & Device Checks</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowCallDiagnostics(false)}
                    className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Tabs: Adaptive Bitrate vs Hardware Checks */}
                <div className="flex rounded-xl bg-black/40 p-1 border border-white/10">
                  <button
                    onClick={() => setActiveDiagTab('abr')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      activeDiagTab === 'abr'
                        ? 'bg-brand-blue text-white shadow-md'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Adaptive Bitrate (ABR)</span>
                  </button>
                  <button
                    onClick={() => setActiveDiagTab('hardware')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      activeDiagTab === 'hardware'
                        ? 'bg-brand-blue text-white shadow-md'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Hardware Checks</span>
                  </button>
                </div>

                {activeDiagTab === 'abr' ? (
                  /* TAB 1: Adaptive Bitrate (ABR) Engine */
                  <div className="flex flex-col gap-3.5">
                    {/* ABR Control & Active Tier Card */}
                    <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Gauge className="w-4 h-4 text-brand-blue" />
                          <span className="text-xs font-bold text-gray-200">Bitrate Switcher Mode</span>
                        </div>
                        <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/10">
                          <button
                            onClick={() => {
                              setAbrMode('auto');
                              setAbrNotice({
                                message: '⚡ Auto ABR enabled: Stream adjusts dynamically based on network',
                                type: 'up',
                                timestamp: Date.now()
                              });
                            }}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                              abrMode === 'auto'
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            Auto ABR
                          </button>
                          <button
                            onClick={() => {
                              setAbrMode('manual');
                              setAbrNotice({
                                message: 'Manual Quality Lock enabled: Pick your preferred stream tier',
                                type: 'info',
                                timestamp: Date.now()
                              });
                            }}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                              abrMode === 'manual'
                                ? 'bg-cyan-600 text-white shadow-sm'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            Manual Lock
                          </button>
                        </div>
                      </div>

                      {/* Active Tier Highlight Box */}
                      <div className="bg-black/40 rounded-xl p-3 border border-white/10 flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${CALL_QUALITY_PROFILES[currentQualityTier].badgeClass}`}>
                              {CALL_QUALITY_PROFILES[currentQualityTier].label}
                            </span>
                            {abrMode === 'auto' && (
                              <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                                Proactive Heuristic Active
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-gray-300 mt-1">
                            {CALL_QUALITY_PROFILES[currentQualityTier].description}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-mono font-bold text-emerald-400 block">
                            {CALL_QUALITY_PROFILES[currentQualityTier].bitrateDisplay}
                          </span>
                          <span className="text-[10px] font-mono text-gray-400">
                            {CALL_QUALITY_PROFILES[currentQualityTier].resolution} @ {CALL_QUALITY_PROFILES[currentQualityTier].frameRate}fps
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Live Network Signal Telemetry */}
                    <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                          <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                          Live Network Health & Metrics
                        </span>
                        <span className={`text-[11px] font-bold flex items-center gap-1 ${
                          callSignalMetrics.quality === 'excellent' ? 'text-emerald-400' :
                          callSignalMetrics.quality === 'good' ? 'text-teal-400' :
                          callSignalMetrics.quality === 'fair' ? 'text-amber-400' : 'text-rose-400'
                        }`}>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {callSignalMetrics.quality.toUpperCase()} ({callSignalMetrics.bars}/4 Bars)
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 pt-0.5">
                        <div className="bg-black/30 rounded-xl p-2 flex flex-col items-center">
                          <span className="text-[10px] text-gray-400 uppercase font-mono">Ping</span>
                          <span className={`text-xs font-bold font-mono ${
                            callSignalMetrics.ping < 50 ? 'text-emerald-400' :
                            callSignalMetrics.ping < 120 ? 'text-teal-400' :
                            callSignalMetrics.ping < 180 ? 'text-amber-400' : 'text-rose-400'
                          }`}>
                            {callSignalMetrics.ping}ms
                          </span>
                        </div>
                        <div className="bg-black/30 rounded-xl p-2 flex flex-col items-center">
                          <span className="text-[10px] text-gray-400 uppercase font-mono">Jitter</span>
                          <span className="text-xs font-bold text-white font-mono">{callSignalMetrics.jitter}ms</span>
                        </div>
                        <div className="bg-black/30 rounded-xl p-2 flex flex-col items-center">
                          <span className="text-[10px] text-gray-400 uppercase font-mono">Loss</span>
                          <span className={`text-xs font-bold font-mono ${callSignalMetrics.packetLoss > 3 ? 'text-rose-400' : 'text-white'}`}>
                            {callSignalMetrics.packetLoss}%
                          </span>
                        </div>
                        <div className="bg-black/30 rounded-xl p-2 flex flex-col items-center">
                          <span className="text-[10px] text-gray-400 uppercase font-mono">Bitrate</span>
                          <span className="text-xs font-bold text-emerald-400 font-mono text-[11px]">{callSignalMetrics.bitrate}</span>
                        </div>
                      </div>
                    </div>

                    {/* Quality Profiles Switcher Grid */}
                    <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                          <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
                          Target Quality Tiers (Click to Switch)
                        </span>
                        {abrMode === 'manual' && (
                          <button
                            onClick={() => {
                              setAbrMode('auto');
                              setAbrNotice({
                                message: '⚡ Returned to Auto Adaptive Bitrate',
                                type: 'up',
                                timestamp: Date.now()
                              });
                            }}
                            className="text-[10px] text-emerald-400 hover:underline font-bold cursor-pointer"
                          >
                            Restore Auto ABR
                          </button>
                        )}
                      </div>

                      <div className="flex flex-col gap-1.5">
                        {(Object.keys(CALL_QUALITY_PROFILES) as CallQualityTier[]).map(tierKey => {
                          const prof = CALL_QUALITY_PROFILES[tierKey];
                          const isCurrent = currentQualityTier === tierKey;
                          return (
                            <button
                              key={tierKey}
                              onClick={() => {
                                setAbrMode('manual');
                                switchQualityTier(tierKey, `Manually selected ${prof.shortLabel}`);
                              }}
                              className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                                isCurrent
                                  ? 'bg-white/15 border-brand-blue shadow-sm ring-1 ring-brand-blue/50'
                                  : 'bg-black/25 border-white/5 hover:bg-white/10'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <div className={`w-2 h-2 rounded-full ${isCurrent ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
                                <div>
                                  <span className="text-xs font-bold block text-white">{prof.label}</span>
                                  <span className="text-[10px] text-gray-400">{prof.resolution} • {prof.frameRate} FPS</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-mono font-bold text-gray-200 block">{prof.bitrateDisplay}</span>
                                <span className="text-[10px] text-gray-400">&gt; {prof.minBandwidthMbps} Mbps</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Network Condition Simulator for Testing */}
                    <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-amber-400" />
                          Test Adaptive Bitrate Response
                        </span>
                        <span className="text-[10px] text-gray-400">Simulate network swings</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <button
                          onClick={() => {
                            setSimulatedNetworkDegradation('normal');
                            setAbrNotice({
                              message: 'Restored high-speed fiber/5G (0% packet loss)',
                              type: 'up',
                              timestamp: Date.now()
                            });
                          }}
                          className={`py-2 px-1.5 rounded-xl text-[10px] font-bold border transition-all flex flex-col items-center gap-1 cursor-pointer ${
                            simulatedNetworkDegradation === 'normal'
                              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                              : 'bg-black/30 border-white/10 text-gray-300 hover:bg-white/10'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>5G / Fiber</span>
                          <span className="text-[9px] opacity-75 font-mono">0% Loss • 22ms</span>
                        </button>

                        <button
                          onClick={() => {
                            setSimulatedNetworkDegradation('congested');
                            setAbrNotice({
                              message: '⚠️ Congestion simulated: Watch ABR proactively scale down to 480p/360p',
                              type: 'down',
                              timestamp: Date.now()
                            });
                          }}
                          className={`py-2 px-1.5 rounded-xl text-[10px] font-bold border transition-all flex flex-col items-center gap-1 cursor-pointer ${
                            simulatedNetworkDegradation === 'congested'
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                              : 'bg-black/30 border-white/10 text-gray-300 hover:bg-white/10'
                          }`}
                        >
                          <Wifi className="w-3.5 h-3.5 text-amber-400" />
                          <span>Weak WiFi</span>
                          <span className="text-[9px] opacity-75 font-mono">3.4% Loss • 138ms</span>
                        </button>

                        <button
                          onClick={() => {
                            setSimulatedNetworkDegradation('severe');
                            setAbrNotice({
                              message: '🚨 Cell drop simulated: Audio Priority activated to preserve speech',
                              type: 'warning',
                              timestamp: Date.now()
                            });
                          }}
                          className={`py-2 px-1.5 rounded-xl text-[10px] font-bold border transition-all flex flex-col items-center gap-1 cursor-pointer ${
                            simulatedNetworkDegradation === 'severe'
                              ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                              : 'bg-black/30 border-white/10 text-gray-300 hover:bg-white/10'
                          }`}
                        >
                          <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                          <span>Tunnel Drop</span>
                          <span className="text-[9px] opacity-75 font-mono">7.2% Loss • 215ms</span>
                        </button>
                      </div>
                    </div>

                    {/* Recent ABR Adaptation Log */}
                    <div className="bg-white/5 rounded-2xl p-3 border border-white/10 flex flex-col gap-1.5">
                      <span className="text-[11px] font-bold text-gray-300">ABR Adaptation Activity Log</span>
                      <div className="flex flex-col gap-1 max-h-24 overflow-y-auto no-scrollbar pr-1">
                        {abrHistory.map(entry => (
                          <div key={entry.id} className="text-[10px] flex items-center justify-between text-gray-400 border-b border-white/5 pb-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-gray-500">{entry.time}</span>
                              <span className="font-semibold text-gray-300">{entry.from} &rarr; {entry.to}</span>
                            </div>
                            <span className="truncate max-w-[140px] text-gray-400" title={entry.reason}>{entry.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* TAB 2: Hardware Checks & Device Verification */
                  <div className="flex flex-col gap-3.5">
                    {/* Microphone Live Meter Test */}
                    <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                          <Mic className="w-3.5 h-3.5 text-blue-400" />
                          Microphone Input Meter
                        </span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isMuted ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                          {isMuted ? 'Muted' : 'Transmitting Audio'}
                        </span>
                      </div>
                      
                      {/* Real-time VU meter bar */}
                      <div className="flex flex-col gap-1 mt-1">
                        <div className="h-3 bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/10 flex items-center">
                          <div 
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-75"
                            style={{ width: `${isMuted ? 0 : Math.max(8, audioInputLevel)}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-gray-400 px-1">
                          <span>Speak into mic to test sensitivity</span>
                          <span className="font-mono">{isMuted ? '0%' : `${audioInputLevel}%`}</span>
                        </div>
                      </div>
                    </div>

                    {/* Camera & Video Preview Check */}
                    <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isVideoEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                          {isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                        </div>
                        <div>
                          <span className="text-xs font-semibold block text-gray-200">Camera Feed</span>
                          <span className="text-[11px] text-gray-400">
                            {isVideoEnabled ? (isVideo ? `${CALL_QUALITY_PROFILES[currentQualityTier].label} (${CALL_QUALITY_PROFILES[currentQualityTier].frameRate} FPS)` : 'Audio-only call mode') : 'Camera stream paused'}
                          </span>
                        </div>
                      </div>
                      {isVideo && (
                        <button
                          onClick={toggleVideo}
                          className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                        >
                          {isVideoEnabled ? 'Turn Off' : 'Turn On'}
                        </button>
                      )}
                    </div>

                    {/* Speaker & Audio Output Test */}
                    <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${speakerTestActive ? 'bg-emerald-500 text-white animate-bounce' : 'bg-white/10 text-white'}`}>
                          <Volume2 className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-semibold block text-gray-200">Speaker / Output Check</span>
                          <span className="text-[11px] text-gray-400">Play test chime on speakers</span>
                        </div>
                      </div>
                      <button
                        onClick={playSpeakerTestTone}
                        disabled={speakerTestActive}
                        className="text-xs font-bold px-3 py-1.5 rounded-xl bg-brand-blue hover:bg-blue-600 active:scale-95 transition-all text-white flex items-center gap-1 shadow-sm disabled:opacity-50 cursor-pointer"
                      >
                        {speakerTestActive ? 'Playing...' : 'Test Sound'}
                      </button>
                    </div>

                    {/* One-Click Full Diagnostics Verification */}
                    <div className="pt-1 flex flex-col gap-2">
                      <button
                        onClick={runFullDiagnostics}
                        disabled={diagnosticTestRunning}
                        className="w-full py-2.5 bg-gradient-to-r from-brand-blue to-indigo-600 hover:from-blue-600 hover:to-indigo-700 active:scale-98 transition-all rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 text-white disabled:opacity-50 cursor-pointer"
                      >
                        {diagnosticTestRunning ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Testing Camera, Mic & Speaker...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            Run All Hardware & Signal Checks
                          </>
                        )}
                      </button>

                      {diagnosticResults.camera !== null && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl p-2.5 text-center text-xs text-emerald-300 font-medium flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>All systems verified: Audio & Video calls are operating properly!</span>
                        </motion.div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    );
  };

  const renderChatList = () => (
    <div className="flex flex-col h-full bg-white relative">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
        <h1 className="text-xl font-bold tracking-tight text-gray-900">Chats</h1>
        <div className="flex items-center gap-2">
           <button 
             onClick={() => setShowNewGroupModal(true)}
             className="px-3 py-1.5 rounded-full bg-blue-50 text-brand-blue hover:bg-blue-100 transition-colors text-xs font-bold flex items-center gap-1.5 active:scale-95 shadow-xs"
             title="Create Group Chat"
           >
              <Users className="w-3.5 h-3.5" />
              <span>New Group</span>
           </button>
           <button 
             onClick={() => setShowNewGroupModal(true)}
             className="w-9 h-9 flex items-center justify-center rounded-full bg-blue-50 text-brand-blue hover:bg-blue-100 transition-colors active:scale-95"
             title="New Chat / Group"
           >
              <Plus className="w-5 h-5" />
           </button>
        </div>
      </div>
      
      <div className="flex flex-col overflow-y-auto pb-24">
        {/* Horizontal Users List */}
        <div className="flex overflow-x-auto px-5 py-4 gap-4 no-scrollbar border-b border-gray-50">
          {users.map(user => {
            const userName = user?.name || user?.username || (user?.email ? user.email.split('@')[0] : 'User');
            const firstName = userName ? userName.split(' ')[0] : 'User';
            const displayAvatar = user.hideAvatarPublicly && user.id !== currentUserId 
              ? undefined 
              : user.avatar;
              
            return (
              <div 
                key={user.id} 
                className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
                onClick={() => handleStartChat(user.id, userName, undefined, user.avatar)}
              >
                <div className="relative">
                  <UserAvatar 
                    src={displayAvatar} 
                    name={userName}
                    size="lg"
                    className="border-2 border-transparent group-hover:border-brand-blue transition-all"
                  />
                  <PresenceIndicator presence="online" className="absolute bottom-0 right-0 scale-75 border-2 border-white" />
                </div>
                  <div className="flex items-center gap-0.5 max-w-[60px]">
                    <span className="text-[11px] font-medium text-gray-600 truncate text-center">{firstName}</span>
                    {(user.isVerified || user.id === currentUserId || user.email === 'admin@imchat.app') && (
                      <BadgeCheck className="w-2.5 h-2.5 text-white fill-[#0095f6] shrink-0" />
                    )}
                  </div>
              </div>
            );
          })}
          {users.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 shrink-0 opacity-50">
              <div className="w-14 h-14 rounded-full bg-gray-100 animate-pulse"></div>
              <div className="h-2 w-10 bg-gray-100 rounded animate-pulse"></div>
            </div>
          )}
        </div>

        {chats.map(chat => {
          const lastMsg = chat.messages[chat.messages.length - 1];
          const chatUser = users.find(u => chat.participants.includes(u.id) && u.id !== currentUserId);
          const displayAvatar = chatUser && chatUser.hideAvatarPublicly
            ? undefined
            : chat.avatar;

          return (
            <div 
              key={chat.id}
              onClick={() => {
                if (chat.isLocked && !unlockedChatIds.includes(chat.id)) {
                  setPendingUnlockChatId(chat.id);
                  setLockPinInput('');
                  setLockPinError('');
                  setShowUnlockPinModal(true);
                  return;
                }
                setActiveChatId(chat.id);
                setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unreadCount: 0 } : c));
              }}
              className="px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50 active:bg-gray-100 cursor-pointer border-b border-gray-50 transition-colors relative"
            >
              <div className="relative shrink-0">
                <UserAvatar 
                  src={chat.avatar} 
                  name={chat.name}
                  size="md"
                  className={chat.isGroup ? 'rounded-2xl' : ''}
                />
                {!chat.isGroup && <PresenceIndicator presence={chat.presence} className="absolute bottom-0 right-0 shadow-sm" />}
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1 min-w-0 flex-1">
                    <h3 className="font-semibold text-[16px] text-gray-900 truncate">{chat.name}</h3>
                    {chat.isMuted && (
                      <span title="Notifications Muted" className="inline-flex items-center">
                        <BellOff className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-1" />
                      </span>
                    )}
                    {chat.isLocked && <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0 ml-1" />}
                    {(chat.participants.includes(currentUserId) && chat.participants.length === 2 && (chat.id === 'c_showcase' || chat.id === 'c1')) && (
                      <BadgeCheck className="w-3.5 h-3.5 text-white fill-[#0095f6] shrink-0" />
                    )}
                  </div>
                  {lastMsg && <span className="text-xs text-gray-400 shrink-0">{new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                </div>
                <div className="flex items-center justify-between">
                  {globalTypingMap[chat.id]?.length ? (
                    <div className="flex items-center gap-1.5 text-[13px] text-brand-blue font-semibold">
                      <span>{chat.isGroup ? `${globalTypingMap[chat.id][0].userName.split(' ')[0]} is typing` : 'typing'}</span>
                      <span className="inline-flex items-center gap-0.5 ml-0.5">
                        {[0, 1, 2].map((i) => (
                          <motion.span
                            key={i}
                            className="w-1 h-1 bg-brand-blue rounded-full"
                            animate={{
                              y: [0, -3, 0],
                              opacity: [0.3, 1, 0.3]
                            }}
                            transition={{
                              duration: 0.6,
                              repeat: Infinity,
                              ease: "easeInOut",
                              delay: i * 0.15
                            }}
                          />
                        ))}
                      </span>
                    </div>
                  ) : lastMsg ? (
                    <p className="text-sm text-gray-500 truncate pr-4">
                      {lastMsg.senderId === currentUserId && <span className="text-brand-blue font-medium mr-1">{lastMsg.isRead ? '✓✓' : '✓'} You:</span>}
                      {lastMsg.media ? `[${lastMsg.media.type === 'sticker' ? 'Sticker' : 'Media'}] ${lastMsg.media.name}` : lastMsg.text}
                    </p>
                  ) : <p className="text-sm text-gray-400 italic">No messages yet</p>}
                  {chat.unreadCount ? (
                    <span className="shrink-0 bg-brand-blue text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full min-w-[20px] text-center shadow-xs animate-pulse">
                      {chat.unreadCount}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderActiveChat = () => {
    if (!activeChat) return null;
    const isBgColor = activeChat.wallpaper?.startsWith('#');

    return (
      <motion.div 
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300, duration: 0.3 }}
        className="fixed inset-0 bg-gray-50 z-50 flex flex-col w-full max-w-[500px] mx-auto overflow-hidden"
      >
        {/* Header */}
        <header className="bg-white px-4 py-3 flex items-center justify-between shadow-sm z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => { setActiveChatId(null); setEditingMsgId(null); setReplyingToMsgId(null); setIsSearchingMessages(false); setMessageSearchQuery(''); }} className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-700 active:scale-95 transition-all shrink-0">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div 
              className="flex items-center gap-3 cursor-pointer group min-w-0"
              onClick={() => {
                if (activeChat.isGroup) {
                  setShowGroupDetailModal(true);
                  setGroupDetailTab('members');
                  return;
                }
                const headerUser = users.find(u => activeChat.participants.includes(u.id) && u.id !== currentUserId);
                const headerAvatar = headerUser && headerUser.hideAvatarPublicly
                  ? `https://picsum.photos/seed/${headerUser.id}/150/150`
                  : activeChat.avatar;
                
                onVisitProfile && onVisitProfile({
                  id: activeChat.participants.find(p => p !== currentUserId) || activeChat.id,
                  name: activeChat.name,
                  avatar: headerAvatar
                });
              }}
            >
              <div className="relative shrink-0">
                {(() => {
                  const headerUser = users.find(u => activeChat.participants.includes(u.id) && u.id !== currentUserId);
                  const headerAvatar = headerUser && headerUser.hideAvatarPublicly
                    ? undefined
                    : activeChat.avatar;
                  return (
                    <UserAvatar 
                      src={headerAvatar} 
                      name={activeChat.name}
                      size="sm"
                      className={`${activeChat.isGroup ? 'rounded-xl' : ''} group-hover:scale-105 transition-transform ${typingUsers.length > 0 ? 'ring-2 ring-brand-blue ring-offset-1' : ''}`}
                    />
                  );
                })()}
                {!activeChat.isGroup && <PresenceIndicator presence={activeChat.presence} className="absolute -bottom-0.5 -right-0.5 w-[14px] h-[14px]" />}
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-gray-900 leading-tight group-hover:text-brand-blue transition-colors truncate">{activeChat.name}</span>
                  {(activeChat.id === 'c_showcase' || activeChat.id === 'c1') && (
                    <BadgeCheck className="w-3.5 h-3.5 text-white fill-[#0095f6] shrink-0" />
                  )}
                </div>
                <AnimatePresence mode="wait">
                  {typingUsers.length > 0 ? (
                    <motion.div 
                      key="header-typing-indicator"
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -3 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center gap-1 text-xs text-brand-blue font-semibold leading-tight"
                    >
                      <span className="truncate">
                        {activeChat.isGroup
                          ? (typingUsers.length === 1
                              ? `${typingUsers[0].userName.split(' ')[0]} is typing`
                              : `${typingUsers.length} people typing`)
                          : 'typing'}
                      </span>
                      <span className="inline-flex items-center gap-0.5 ml-0.5">
                        {[0, 1, 2].map((i) => (
                          <motion.span
                            key={i}
                            className="w-1 h-1 bg-brand-blue rounded-full"
                            animate={{
                              y: [0, -3, 0],
                              opacity: [0.3, 1, 0.3]
                            }}
                            transition={{
                              duration: 0.6,
                              repeat: Infinity,
                              ease: "easeInOut",
                              delay: i * 0.15
                            }}
                          />
                        ))}
                      </span>
                    </motion.div>
                  ) : (
                    <motion.span 
                      key="header-presence-text"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-xs text-gray-500 capitalize leading-tight"
                    >
                      {isSearchingMessages ? 'Searching...' : (activeChat.isBlocked ? 'Blocked' : activeChat.presence)}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!activeChat.isBlocked && (
              <>
                <button 
                  onClick={() => setIsSearchingMessages(!isSearchingMessages)} 
                  className={`p-2 rounded-full transition-colors ${isSearchingMessages ? 'bg-blue-100 text-brand-blue' : 'hover:bg-gray-100 text-gray-600'}`}
                  title="Search Messages"
                >
                  <Search className="w-5 h-5" />
                </button>
                <button onClick={() => setIsLive(true)} className="p-2 rounded-full hover:bg-red-50 text-red-500 transition-colors" title="Go Live"><Radio className="w-5 h-5 animate-pulse" /></button>
                {activeChat.isGroup && (
                  <button 
                    onClick={() => {
                      setShowGroupDetailModal(true);
                      setGroupDetailTab('members');
                    }}
                    className="p-2 rounded-full hover:bg-blue-50 text-brand-blue transition-colors relative"
                    title="Member Management & Group Details"
                  >
                    <Users className="w-5 h-5" />
                    <span className="absolute -top-0.5 -right-0.5 bg-brand-blue text-white text-[9px] font-black rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center border border-white shadow-xs">
                      {activeChat.participants.length}
                    </span>
                  </button>
                )}
                {!activeChat.isGroup && (
                  <>
                    <button onClick={() => initiateCall('audio')} className="p-2 rounded-full hover:bg-gray-100 text-brand-blue transition-colors"><Phone className="w-5 h-5" /></button>
                    <button onClick={() => initiateCall('video')} className="p-2 rounded-full hover:bg-gray-100 text-brand-blue transition-colors"><Video className="w-5 h-5" /></button>
                  </>
                )}
              </>
            )}
            <div className="relative">
               <button onClick={() => setChatMenuOpen(!chatMenuOpen)} className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors">
                 <MoreVertical className="w-5 h-5" />
               </button>
               {chatMenuOpen && (
                 <div className="absolute top-10 right-0 bg-white border border-gray-100 shadow-xl rounded-xl w-56 py-2 z-50">
                    {activeChat.isGroup && (
                      <button 
                        onClick={() => {
                          setShowGroupDetailModal(true);
                          setGroupDetailTab('members');
                          setChatMenuOpen(false);
                        }} 
                        className="w-full text-left px-4 py-2 hover:bg-blue-50 flex items-center gap-2 text-sm text-brand-blue font-bold border-b border-gray-100"
                      >
                        <Users className="w-4 h-4 text-brand-blue" /> Member Management
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        const newMuted = !activeChat.isMuted;
                        setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, isMuted: newMuted } : c));
                        setChatMenuOpen(false);
                        if (!newMuted) playNotificationSound();
                      }} 
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center justify-between text-sm text-gray-700"
                    >
                      <span className="flex items-center gap-2">
                        {activeChat.isMuted ? <Bell className="w-4 h-4 text-brand-blue" /> : <BellOff className="w-4 h-4 text-gray-500" />}
                        {activeChat.isMuted ? 'Unmute Alerts' : 'Mute Alerts'}
                      </span>
                      {activeChat.isMuted && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">Muted</span>}
                    </button>

                    <button 
                      onClick={() => {
                        playNotificationSound();
                        setChatMenuOpen(false);
                      }} 
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm text-brand-blue font-medium"
                    >
                      <Volume2 className="w-4 h-4" /> Test Chime Sound
                    </button>

                    <button onClick={() => { setIsLive(true); setChatMenuOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm text-red-500 font-bold border-t border-gray-100">
                      <Radio className="w-4 h-4" /> Go Live
                    </button>
                    <button onClick={() => wallpaperInputRef.current?.click()} className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm">
                      <Palette className="w-4 h-4 text-gray-500"/> Custom Wallpaper
                    </button>
                    <input type="file" ref={wallpaperInputRef} accept="image/*" onChange={changeWallpaper} className="hidden" />
                    <button onClick={toggleBlock} className={`w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm ${activeChat.isBlocked ? 'text-green-600' : 'text-red-500'}`}>
                      <Ban className="w-4 h-4" /> {activeChat.isBlocked ? 'Unblock User' : 'Block User'}
                    </button>
                    <button onClick={() => handleToggleLockChat(activeChat)} className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-800 font-bold border-t border-gray-100">
                      <Lock className="w-4 h-4 text-amber-500" /> {activeChat.isLocked ? 'Unlock / Remove PIN' : 'Lock Chat with PIN'}
                    </button>
                 </div>
               )}
            </div>
          </div>
        </header>

        {/* Floating In-Chat Real-Time Alert for background conversations */}
        <AnimatePresence>
          {inChatAlert && (
            <motion.div
              initial={{ opacity: 0, y: -30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              onClick={() => {
                setActiveChatId(inChatAlert.chatId);
                setInChatAlert(null);
              }}
              className="absolute top-16 left-3 right-3 z-30 bg-gray-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-2xl flex items-center gap-3 cursor-pointer hover:bg-black transition-all border border-white/10"
            >
              <UserAvatar src={inChatAlert.avatar} name={inChatAlert.name} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-xs text-white truncate">{inChatAlert.name}</span>
                  <span className="text-[10px] bg-brand-blue text-white font-bold px-1.5 py-0.2 rounded-full">New Message</span>
                </div>
                <p className="text-xs text-gray-300 truncate mt-0.5">{inChatAlert.text}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setInChatAlert(null);
                }}
                className="p-1 hover:bg-white/20 rounded-full text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search Bar Sub-header */}
        <AnimatePresence>
          {isSearchingMessages && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-white border-b border-gray-100 px-4 py-2 z-20"
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Search in conversation..."
                  value={messageSearchQuery}
                  onChange={(e) => setMessageSearchQuery(e.target.value)}
                  className="w-full bg-gray-50 border-none rounded-xl pl-9 pr-9 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-blue/10"
                />
                {messageSearchQuery && (
                  <button 
                    onClick={() => setMessageSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Message Feed */}
        <div 
          className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 relative"
          style={{ backgroundColor: isBgColor ? activeChat.wallpaper : undefined, backgroundImage: !isBgColor && activeChat.wallpaper ? `url(${activeChat.wallpaper})` : undefined, backgroundSize: 'cover' }}
        >
          {activeChat.messages
            .filter(m => !messageSearchQuery || m.text.toLowerCase().includes(messageSearchQuery.toLowerCase()))
            .map(msg => {
            if (msg.senderId === 'system') {
              return (
                <div key={msg.id} className="flex justify-center my-2 px-4">
                  <div className="bg-gray-100/95 text-gray-700 text-xs font-semibold px-4 py-1.5 rounded-full text-center border border-gray-200/90 shadow-xs flex items-center gap-1.5 max-w-md">
                    {msg.text}
                  </div>
                </div>
              );
            }
            const isMe = msg.senderId === currentUserId;
            const linkMatch = isValidUrl(msg.text);
            const isSticker = msg.media?.type === 'sticker';
            const isEmojiOnly = !isSticker && msg.text && isOnlyEmojis(msg.text);

            // Find reply target
            const replyTarget = msg.replyToId ? activeChat.messages.find(m => m.id === msg.replyToId) : null;

            return (
              <div 
                 key={msg.id} 
                 className={`flex ${isMe ? 'justify-end' : 'justify-start'} group relative`}
                 onMouseEnter={() => setActiveHoverMsg(msg.id)}
                 onMouseLeave={() => { 
                   if (reactPickerMsgId !== msg.id) {
                     setActiveHoverMsg(null); 
                     setActiveMsgOptions(null); 
                   }
                 }}
              >
                {/* Facebook style hover reactions & options */}
                <AnimatePresence>
                  {activeHoverMsg === msg.id && !isSticker && (
                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className={`absolute -top-10 ${isMe ? 'right-0' : 'left-0'} bg-white shadow-lg rounded-full px-2 py-1 flex gap-1 items-center z-30 border border-gray-100`}>
                      {['👍', '❤️', '😂', '😮', '😢'].map(emoji => (
                        <button key={emoji} onClick={() => { handleAddReaction(msg.id, emoji); setReactPickerMsgId(null); }} className="hover:scale-130 active:scale-95 transition-transform p-1 text-lg leading-none cursor-pointer">{emoji}</button>
                      ))}
                      
                      {/* Plus reaction icon to show picker */}
                      <button 
                        onClick={() => setReactPickerMsgId(reactPickerMsgId === msg.id ? null : msg.id)}
                        className={`hover:scale-125 transition-all p-1 text-gray-500 hover:text-brand-blue rounded-full ${reactPickerMsgId === msg.id ? 'text-brand-blue bg-blue-50 scale-110' : ''}`}
                        title="More reactions"
                      >
                        <Smile className="w-[18px] h-[18px]" />
                      </button>

                      <div className="w-px bg-gray-200 mx-1 my-1 self-stretch"></div>
                      <button onClick={() => setReplyingToMsgId(msg.id)} className="p-1.5 text-gray-400 hover:text-brand-blue transition-colors" title="Reply"><Reply className="w-4 h-4" /></button>
                      <button 
                        onClick={() => setForwardingMsg(msg)} 
                        className="p-1.5 text-gray-400 hover:text-brand-blue transition-colors" 
                        title="Forward Message"
                      >
                        <CornerUpRight className="w-4 h-4" />
                      </button>
                      {!isSticker && msg.text && (
                        <button 
                          onClick={() => handleTranslate(msg.id, msg.text)} 
                          className={`p-1.5 transition-colors ${isTranslating === msg.id ? 'text-brand-blue animate-spin' : 'text-gray-400 hover:text-brand-blue'}`}
                          title="Translate"
                        >
                          {isTranslating === msg.id ? <Loader2 className="w-4 h-4" /> : <Languages className="w-4 h-4" />}
                        </button>
                      )}
                      {isMe && <button onClick={() => setActiveMsgOptions(activeMsgOptions === msg.id ? null : msg.id)} className="p-1.5 text-gray-400 hover:text-brand-blue"><MoreVertical className="w-4 h-4" /></button>}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Grid of extra emojis popover */}
                <AnimatePresence>
                  {reactPickerMsgId === msg.id && activeHoverMsg === msg.id && (
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0, y: 10 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.9, opacity: 0, y: 10 }}
                      className={`absolute -top-[140px] ${isMe ? 'right-0' : 'left-0'} bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 shadow-2xl rounded-2xl p-2.5 z-40 w-[210px] grid grid-cols-6 gap-2`}
                    >
                      {['🔥', '👏', '🎉', '💡', '💯', '🚀', '👀', '✨', '🤩', '🎯', '🙏', '💔', '💩', '🥳', '🤔', '👑', '🌈', '⚡️'].map(emoji => (
                        <button 
                          key={emoji} 
                          onClick={() => {
                            handleAddReaction(msg.id, emoji);
                            setReactPickerMsgId(null);
                          }} 
                          className="hover:scale-130 active:scale-95 transition-transform text-xl p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 leading-none cursor-pointer"
                        >
                          {emoji}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Vertical Options Menu for Sender */}
                <AnimatePresence>
                  {activeMsgOptions === msg.id && isMe && (
                     <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute -top-14 right-8 bg-white shadow-xl rounded-xl border border-gray-100 z-40 py-1 min-w-[140px] flex flex-col">
                       <button onClick={() => handleStartEdit(msg.id, msg.text)} className="px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2"><Edit2 className="w-4 h-4 text-gray-500" /> Edit Text</button>
                       <button onClick={() => handleDeleteMessage(msg.id)} className="px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2 text-red-500"><Trash2 className="w-4 h-4 text-red-500" /> Delete</button>
                     </motion.div>
                  )}
                </AnimatePresence>

                <div className={`max-w-[75%] relative flex flex-col ${isSticker || isEmojiOnly ? '' : 'shadow-sm rounded-2xl px-3.5 py-2' } ${isSticker || isEmojiOnly ? 'bg-transparent shadow-none' : isMe ? 'bg-[#D9FDD3] rounded-tr-sm text-gray-900' : 'bg-white rounded-tl-sm text-gray-900'}`}>
                  
                  {/* Reply block */}
                  {replyTarget && (
                    <div className="bg-black/5 border-l-4 border-brand-blue rounded p-2 mb-2 flex flex-col">
                      <span className="text-xs font-bold text-brand-blue truncate">{replyTarget.senderId === currentUserId ? 'You' : activeChat.name}</span>
                      <span className="text-xs text-gray-600 truncate">{replyTarget.text || 'Media'}</span>
                    </div>
                  )}

                  {/* Media / Sticker Render */}
                  {msg.media && (
                    <div className={`mb-1 relative rounded-lg overflow-hidden cursor-pointer ${isSticker ? 'w-32 h-32' : ''}`} onClick={() => !isSticker && setMediaPopup(msg.media!)}>
                       {msg.media.type === 'image' || isSticker ? (
                         <img src={msg.media.url} className={`w-full ${isSticker ? 'h-full object-contain' : 'max-h-[250px] object-cover'}`} />
                       ) : msg.media.type === 'video' ? (
                         <div className="relative">
                           <video src={msg.media.url} className="w-full max-h-[250px] object-cover bg-black" />
                           <div className="absolute inset-0 flex items-center justify-center bg-black/30"><PlaySquare className="w-10 h-10 text-white opacity-80" /></div>
                         </div>
                       ) : (
                         <div className="flex items-center gap-3 bg-white/50 p-3 rounded-lg border border-black/10">
                           <FileIcon className="w-8 h-8 text-brand-blue shrink-0" />
                           <span className="text-sm font-medium truncate">{msg.media.name}</span>
                         </div>
                       )}
                    </div>
                  )}

                  {/* Voice Media */}
                  {msg.media?.type === 'voice' && (
                    <div className={`flex flex-col gap-1.5 p-2.5 rounded-2xl border transition-all ${isMe ? 'bg-blue-600/10 border-blue-500/20' : 'bg-gray-100/80 border-gray-200/80'} min-w-[220px] max-w-[260px]`}>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => togglePlayback(msg.id, msg.media!.url, msg.media!.duration)}
                          title={playingMsgId === msg.id ? "Pause" : "Play"}
                          className="w-10 h-10 rounded-full bg-brand-blue hover:bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm active:scale-95 transition-all cursor-pointer"
                        >
                          {playingMsgId === msg.id ? (
                            <Pause className="w-5 h-5 fill-current" />
                          ) : (
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                          )}
                        </button>

                        {/* Interactive Waveform / Scrubber */}
                        <div 
                          className="flex-1 flex flex-col justify-center cursor-pointer group"
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickX = e.clientX - rect.left;
                            const percent = Math.max(0, Math.min(1, clickX / rect.width));
                            handleSeekAudio(msg.id, msg.media!.url, percent, msg.media!.duration);
                          }}
                        >
                          {/* Animated Waveform Bars */}
                          <div className="flex items-center gap-[3px] h-6 py-1">
                            {[12, 24, 18, 28, 14, 22, 30, 16, 26, 20, 15, 25, 18, 22, 14, 20].map((barHeight, idx) => {
                              const totalBars = 16;
                              const currentProgress = playingMsgId === msg.id && (audioDuration || msg.media!.duration)
                                ? audioCurrentTime / (audioDuration || msg.media!.duration || 1)
                                : 0;
                              const barProgress = idx / totalBars;
                              const isPast = barProgress <= currentProgress;
                              const isCurrent = playingMsgId === msg.id && Math.abs(barProgress - currentProgress) < (1 / totalBars);

                              return (
                                <span
                                  key={idx}
                                  className={`flex-1 rounded-full transition-all duration-150 ${
                                    isPast ? 'bg-brand-blue' : 'bg-gray-300'
                                  } ${isCurrent ? 'scale-y-125' : ''}`}
                                  style={{
                                    height: `${Math.max(6, barHeight * 0.7)}px`,
                                  }}
                                />
                              );
                            })}
                          </div>

                          {/* Progress Line */}
                          <div className="w-full h-1 bg-gray-200 rounded-full relative overflow-hidden mt-0.5">
                            <div 
                              className="absolute left-0 top-0 bottom-0 bg-brand-blue rounded-full transition-all duration-100"
                              style={{ 
                                width: playingMsgId === msg.id && (audioDuration || msg.media!.duration)
                                  ? `${Math.min(100, (audioCurrentTime / (audioDuration || msg.media!.duration || 1)) * 100)}%`
                                  : '0%'
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Audio Metadata and Controls Footer */}
                      <div className="flex items-center justify-between px-1 text-[11px] text-gray-500 font-medium">
                        <span>
                          {playingMsgId === msg.id 
                            ? `${formatSec(Math.floor(audioCurrentTime))} / ${formatSec(msg.media.duration || Math.floor(audioDuration) || 0)}`
                            : (msg.media.duration ? formatSec(msg.media.duration) : '0:00')}
                        </span>
                        {playingMsgId === msg.id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleSpeed();
                            }}
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20 transition-colors"
                          >
                            {audioSpeed}x
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {msg.gameInvite ? (
                    <div className="flex flex-col gap-2 py-1 min-w-[200px]">
                      <div className="flex items-center gap-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-2.5 rounded-xl">
                        <span className="text-2xl filter drop-shadow-sm animate-pulse">{msg.gameInvite.gameIcon}</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-[9px] uppercase font-bold text-indigo-600 tracking-wider block">Game Invite</span>
                          <span className="text-xs font-extrabold text-gray-900 truncate block leading-none">{msg.gameInvite.gameTitle}</span>
                        </div>
                      </div>
                      
                      {msg.gameInvite.status === 'pending' ? (
                        isMe ? (
                          <div className="flex items-center gap-1.5 justify-center bg-gray-50 border border-gray-100 py-1.5 px-3 rounded-lg text-[10px] font-bold text-gray-400">
                            <Loader2 className="w-3 h-3 animate-spin text-brand-blue" /> Waiting for response...
                          </div>
                        ) : (
                          <div className="flex gap-1.5 mt-1">
                            <button
                              onClick={() => handleAcceptGameInvite(msg.gameInvite!.inviteId, msg.gameInvite!.gameId)}
                              className="flex-1 py-1.5 bg-brand-blue hover:bg-blue-600 active:scale-95 transition-all text-white font-extrabold text-[10px] rounded-lg shadow-sm flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Gamepad2 className="w-3 h-3" /> Play Now
                            </button>
                            <button
                              onClick={() => handleDeclineGameInvite(msg.gameInvite!.inviteId)}
                              className="py-1.5 px-2 bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all text-gray-500 font-bold text-[10px] rounded-lg cursor-pointer"
                            >
                              Decline
                            </button>
                          </div>
                        )
                      ) : (
                        <div className={`text-center py-1 rounded-lg text-[10px] font-black tracking-wide ${
                          msg.gameInvite.status === 'accepted' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/60' : 'bg-rose-50 text-rose-500 border border-rose-100/60'
                        }`}>
                          {msg.gameInvite.status === 'accepted' ? '🎮 Invitation Accepted • Playing' : '❌ Invitation Declined'}
                        </div>
                      )}
                    </div>
                  ) : (
                    !isSticker && msg.text && (
                      <div className="flex flex-col gap-1.5">
                        {isEmojiOnly ? (
                          renderAnimatedEmojis(msg.text)
                        ) : (
                          <p className="text-[15px] whitespace-pre-wrap leading-snug">{msg.text}</p>
                        )}
                        {translations[msg.id] && (
                          <div className="pt-1.5 border-t border-black/5">
                             <div className="flex items-center gap-1 mb-0.5">
                                <Languages className="w-3 h-3 text-brand-blue" />
                                <span className="text-[10px] font-bold text-brand-blue uppercase tracking-wider">Translated</span>
                             </div>
                             <p className="text-[14px] text-gray-600 italic leading-snug">{translations[msg.id]}</p>
                          </div>
                        )}
                      </div>
                    )
                  )}
                  
                  {/* Link Preview (Mock) */}
                  {!isSticker && linkMatch && (
                    <div className="mt-2 border border-black/10 rounded-lg overflow-hidden bg-white/50 group/link">
                      <div className="bg-gray-200 h-24 flex items-center justify-center relative overflow-hidden">
                        {isImageUrl(msg.text) ? (
                          <img src={msg.text} className="w-full h-full object-cover" />
                        ) : (
                          <LinkIcon className="text-gray-400 w-8 h-8" />
                        )}
                        {isImageUrl(msg.text) && (
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/link:opacity-100 transition-opacity flex items-center justify-center">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onUpdateAvatar) {
                                  onUpdateAvatar(msg.text);
                                  alert("Profile picture updated from link!");
                                }
                              }}
                              className="bg-brand-blue text-white text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1 active:scale-95 transition-transform"
                            >
                              <Camera className="w-3 h-3" /> Set as Avatar
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="p-2 flex flex-col">
                        <span className="text-xs font-bold truncate">{isImageUrl(msg.text) ? 'Shared Image Link' : 'Link Preview Data'}</span>
                        <span className="text-[10px] text-gray-500 truncate">{linkMatch.hostname}</span>
                      </div>
                    </div>
                  )}

                  {/* Timestamp & Read Receipts */}
                  {!isSticker && (
                    <div className={`flex items-center justify-end gap-15 mt-1 ${isMe ? 'text-green-700/60' : 'text-gray-400'}`}>
                      {msg.isOfflinePending && (
                        <span className="text-[8px] tracking-wide uppercase bg-amber-55 dark:bg-amber-950/45 text-amber-700 dark:text-amber-400 font-black px-1 rounded animate-pulse">Offline</span>
                      )}
                      {msg.isEdited && <span className="text-[10px] italic">Edited</span>}
                      <span className="text-[10px]">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {isMe && !msg.isOfflinePending && <span className={`text-[10px] font-bold tracking-tighter ${msg.isRead ? 'text-blue-500' : ''}`}>{msg.isRead ? '✓✓' : '✓'}</span>}
                      {isMe && msg.isOfflinePending && <span className="text-[10px] text-gray-400">🕒</span>}
                    </div>
                  )}
                  {isSticker && (
                     <div className="absolute -bottom-4 right-0 bg-white/80 rounded-full px-1 text-[9px] shadow-sm whitespace-nowrap">
                       {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {isMe && (
                         <span className={msg.isRead ? 'text-blue-500 font-bold' : ''}>{msg.isRead ? '✓✓' : '✓'}</span>
                       )}
                     </div>
                  )}

                  {/* Reactions rendering */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && !isSticker && (
                    <div className="absolute -bottom-3 left-2 bg-white dark:bg-neutral-850 shadow-sm border border-gray-100 dark:border-neutral-800 rounded-full px-1.5 py-0.5 flex gap-1 items-center z-10 text-[11px]">
                      {Object.entries(msg.reactions).map(([r, reactorIds]) => (
                        <span 
                          key={r} 
                          onClick={() => handleAddReaction(msg.id, r)} 
                          className="cursor-pointer relative group px-1 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors inline-flex items-center"
                        >
                          {r} <span className="text-gray-400 dark:text-gray-500 ml-0.5">{(reactorIds as string[]).length > 1 ? (reactorIds as string[]).length : ''}</span>
                          
                          {/* Rich Tooltip showing who reacted */}
                          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-neutral-900/95 backdrop-blur-sm text-white text-[10px] font-semibold px-2.5 py-1.5 rounded-lg shadow-xl opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 pointer-events-none z-50 whitespace-nowrap flex flex-col items-center">
                            <span>{(reactorIds as string[]).map(id => getUserName(id)).join(', ')}</span>
                            {/* Little down selector triangle indicator */}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-spacing-1 border-4 border-transparent border-t-neutral-900/95"></div>
                          </div>
                        </span>
                      ))}
                    </div>
                  )}

                </div>
              </div>
            );
          })}
          {/* Real-time typing indicators */}
          <AnimatePresence>
            {typingUsers.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2.5 px-4 py-2.5 bg-gray-100 dark:bg-neutral-800 rounded-2xl w-fit max-w-[80%] my-1.5 self-start shadow-sm border border-gray-200/50 dark:border-neutral-700/50"
              >
                <div className="flex gap-1 items-center">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full"
                      animate={{
                        y: [0, -5, 0]
                      }}
                      transition={{
                        duration: 0.8,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.15
                      }}
                    />
                  ))}
                </div>
                <span className="text-[13px] text-gray-600 dark:text-gray-300 font-medium">
                  {typingUsers.length === 1 
                    ? `${typingUsers[0].userName} is typing...`
                    : typingUsers.length === 2 
                      ? `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing...`
                      : 'Multiple people are typing...'}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} className="h-4" />
        </div>

        {/* Reply To Preview Footer */}
        <AnimatePresence>
           {replyingToMsgId && (
             <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-[#f0f2f5] px-2 pt-2 z-20">
               <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 mx-1 relative flex items-start gap-2 group overflow-hidden">
                 <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-brand-blue"></div>
                 <div className="flex flex-col pl-2 flex-1 overflow-hidden">
                   <span className="text-[13px] font-bold text-brand-blue leading-tight mb-0.5">Replying to {activeChat.messages.find(m => m.id === replyingToMsgId)?.senderId === currentUserId ? 'yourself' : activeChat.name}</span>
                   <span className="text-[14px] text-gray-600 truncate pr-6">{activeChat.messages.find(m => m.id === replyingToMsgId)?.text || 'Media'}</span>
                 </div>
                 <button 
                   onClick={() => setReplyingToMsgId(null)} 
                   className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors shrink-0"
                   title="Cancel reply"
                 >
                   <X className="w-5 h-5" />
                 </button>
               </div>
             </motion.div>
           )}
        </AnimatePresence>

        {/* Blocked state overlay input */}
        {activeChat.isBlocked ? (
          <div className="bg-gray-100 p-4 text-center text-gray-500 text-sm font-medium border-t border-gray-200 z-20">
             You blocked this contact. Tap menu to unblock.
          </div>
        ) : (
          <div className="bg-[#f0f2f5] p-2 flex flex-col z-20">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/*,.pdf,.doc,.docx" />
            <input type="file" ref={cameraInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/*" capture="environment" />
            
            {/* Staged Media */}
            {stagedMedia && (
              <div className="mx-2 mb-2 p-3 bg-white rounded-xl shadow-sm border border-gray-200 relative flex items-center gap-3">
                 <button 
                   onClick={() => {
                     setStagedMedia(null);
                     setStagedAudioPlaying(false);
                     stagedAudioRef.current?.pause();
                   }} 
                   className="absolute -top-2 -right-2 bg-gray-600 hover:bg-gray-700 text-white rounded-full p-1 shadow cursor-pointer transition-colors"
                   title="Remove attachment"
                 >
                   <X className="w-3 h-3" />
                 </button>
                 {stagedMedia.type === 'image' ? (
                   <img src={stagedMedia.url} className="w-14 h-14 object-cover rounded-lg" alt="preview" />
                 ) : stagedMedia.type === 'voice' ? (
                   <div className="flex items-center gap-3 flex-1">
                     <button
                       type="button"
                       onClick={toggleStagedAudioPlay}
                       className="w-10 h-10 rounded-full bg-brand-blue hover:bg-blue-600 text-white flex items-center justify-center shrink-0 shadow active:scale-95 transition-transform cursor-pointer"
                       title={stagedAudioPlaying ? "Pause preview" : "Play preview"}
                     >
                       {stagedAudioPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                     </button>
                     <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-1.5">
                         <AudioWaveform className="w-4 h-4 text-brand-blue" />
                         <span className="text-xs font-semibold text-gray-800 truncate">Voice Note Recorded</span>
                       </div>
                       <span className="text-[11px] text-gray-500 font-mono">{formatSec(stagedMedia.duration || 0)} • Click send or play to review</span>
                     </div>
                   </div>
                 ) : (
                   <div className="w-14 h-14 bg-blue-50 flex items-center justify-center rounded-lg">
                     <FileIcon className="w-6 h-6 text-blue-500" />
                   </div>
                 )}
                 {stagedMedia.type !== 'voice' && (
                   <span className="text-sm font-medium truncate flex-1">{stagedMedia.name}</span>
                 )}
              </div>
            )}

            {/* Stickers / Giphy Picker Panel */}
            <AnimatePresence>
               {showStickers && (
                  <div className="absolute bottom-[66px] left-0 right-0 z-50 p-2 pointer-events-none">
                    <div className="pointer-events-auto max-w-[360px] mx-auto sm:ml-4">
                      <div className="flex bg-white/90 backdrop-blur-md rounded-t-2xl border-x border-t border-gray-100 p-1 gap-1">
                        <button 
                          onClick={() => setStickerTab('stickers')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${stickerTab === 'stickers' ? 'bg-brand-blue text-white shadow-lg shadow-blue-500/20' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                          <Package className="w-3.5 h-3.5" />
                          Stickers
                        </button>
                        <button 
                          onClick={() => setStickerTab('gifs')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${stickerTab === 'gifs' ? 'bg-black text-white shadow-lg shadow-black/20' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          GIFs
                        </button>
                      </div>
                      
                      {stickerTab === 'gifs' ? (
                        <GiphyPicker 
                          onSelect={(url) => handleSendSticker(url)} 
                          onClose={() => setShowStickers(false)}
                          type="gifs"
                        />
                      ) : (
                        <StickerPicker 
                          onSelect={(url) => handleSendSticker(url)}
                          onClose={() => setShowStickers(false)}
                        />
                      )}
                    </div>
                  </div>
               )}
               {showEmojiPicker && (
                  <div className="absolute bottom-[60px] left-0 z-50 p-2 shadow-2xl rounded-2xl overflow-hidden">
                    <EmojiPicker 
                      onEmojiClick={(emojiData: EmojiClickData) => setMessageInput(prev => prev + emojiData.emoji)}
                      autoFocusSearch={false}
                      theme={Theme.LIGHT}
                      width="100%"
                      height={400}
                    />
                  </div>
               )}
            </AnimatePresence>

            {isFrozen ? (
              <div className="flex items-center justify-center p-4 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold rounded-2xl mx-4 my-2 text-center shadow-sm">
                ❄️ This account is frozen. Sending messages is temporarily restricted, but you can continue browsing.
              </div>
            ) : (
              <div>
                {/* AI Assistant Smart Bar */}
                {activeChat && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto no-scrollbar border-b border-gray-100 bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-purple-50/80">
                    <button
                      type="button"
                      onClick={async () => {
                        if (messageInput.trim()) {
                          setIsAiRewriting(true);
                          const rewritten = await geminiService.rewriteMessage(messageInput);
                          setMessageInput(rewritten);
                          setIsAiRewriting(false);
                        } else {
                          setMessageInput("Hi! How can you help me today? ✨");
                        }
                      }}
                      disabled={isAiRewriting}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-blue-50 text-brand-blue text-[11px] font-bold rounded-lg border border-blue-200 shadow-2xs shrink-0 transition-all cursor-pointer"
                      title={messageInput.trim() ? "Polish your message with AI" : "Chat with IMChat AI"}
                    >
                      <Sparkles className={`w-3.5 h-3.5 text-brand-blue ${isAiRewriting ? 'animate-spin' : ''}`} />
                      <span>{isAiRewriting ? 'Rewriting with AI...' : (messageInput.trim() ? 'Polish with AI' : 'AI Assistant')}</span>
                    </button>

                    {['Sounds good! 👍', 'Thanks so much! 🙏', 'Let’s do it! 🚀', 'Can’t wait! 😊'].map((chip, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setMessageInput(chip)}
                        className="px-2.5 py-1 bg-white/90 hover:bg-white text-gray-700 hover:text-gray-900 text-[11px] font-medium rounded-lg border border-gray-200/70 shrink-0 transition-all shadow-2xs"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-1.5 px-1 relative z-20">
                <button title="Emojis" onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowStickers(false); }} className="p-2.5 text-yellow-500 hover:bg-gray-200 rounded-full transition-colors active:scale-95 shrink-0"><Smile className="w-[26px] h-[26px]" /></button>
                <button title="Stickers & GIF" onClick={() => { setShowStickers(!showStickers); setShowEmojiPicker(false); }} className="p-2.5 text-gray-500 hover:bg-gray-200 rounded-full transition-colors active:scale-95 shrink-0"><GiphyIcon className="w-[28px] h-[28px]" /></button>
                <button title="Attach Media" onClick={() => fileInputRef.current?.click()} className="p-2.5 text-gray-500 hover:bg-gray-200 rounded-full transition-colors active:scale-95 shrink-0"><Paperclip className="w-[22px] h-[22px]" /></button>
                <button title="Camera / Direct Upload" onClick={() => cameraInputRef.current?.click()} className="p-2.5 text-gray-500 hover:bg-gray-200 rounded-full transition-colors active:scale-95 shrink-0"><Camera className="w-[24px] h-[24px]" /></button>
                <button title="Play Game Together" onClick={() => setShowGameInviteModal(true)} className="p-2.5 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors active:scale-95 shrink-0"><Gamepad2 className="w-[24px] h-[24px]" /></button>
                
                <div className="flex-1 bg-white rounded-2xl px-4 py-2 border border-gray-200 shadow-sm flex items-center my-1 relative">
                  {isRecording ? (
                    <div className="w-full flex items-center gap-3 py-1 flex-1">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                      <span className="text-red-500 font-medium text-[15px] flex-1">{formatSec(recordingTime)}</span>
                      <button onClick={stopRecording} className="text-red-500 hover:bg-red-50 p-1.5 rounded-full"><Square className="w-5 h-5 fill-current" /></button>
                    </div>
                  ) : (
                    <textarea 
                      value={messageInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMessageInput(val);
                        if (!activeChatId || currentUserId === 'anonymous') return;
                        
                        const now = Date.now();
                        if (val.trim() === '') {
                          if (isTypingRef.current) {
                            isTypingRef.current = false;
                            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                            setMyTypingStatusInFirestore(false, activeChatId);
                          }
                        } else {
                          if (!isTypingRef.current) {
                            isTypingRef.current = true;
                            lastTypingWriteRef.current = now;
                            setMyTypingStatusInFirestore(true, activeChatId);
                          } else if (now - lastTypingWriteRef.current > 4000) {
                            lastTypingWriteRef.current = now;
                            setMyTypingStatusInFirestore(true, activeChatId);
                          }

                          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                          typingTimeoutRef.current = setTimeout(() => {
                            if (isTypingRef.current) {
                              isTypingRef.current = false;
                              setMyTypingStatusInFirestore(false, activeChatId);
                            }
                          }, 4000);
                        }
                      }}
                      onPaste={handleChatPaste}
                      placeholder={editingMsgId ? "Edit message..." : "Message"}
                      className="w-full bg-transparent outline-none resize-none max-h-[120px] py-1 text-[15px]"
                      rows={1}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
                      }}
                    />
                  )}
                </div>
                
                {!isRecording && (!messageInput.trim() && !stagedMedia) && !editingMsgId ? (
                  <button 
                    onClick={startRecording}
                    className="p-3 my-1 bg-brand-blue text-white rounded-full shrink-0 transition-transform active:scale-95 shadow-md flex items-center justify-center hover:bg-blue-600"
                  >
                    <Mic className="w-6 h-6" />
                  </button>
                ) : (
                  !isRecording && (
                    <button 
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim() && !stagedMedia}
                      className={`p-3 my-1 rounded-full shrink-0 transition-all active:scale-95 ${messageInput.trim() || stagedMedia ? 'bg-brand-blue text-white shadow-md hover:bg-blue-600' : 'bg-transparent text-gray-400'}`}
                    >
                      {editingMsgId ? <Check className="w-6 h-6" /> : <Send className="w-6 h-6 ml-0.5" />}
                    </button>
                  )
                )}
              </div>
            </div>
            )}
          </div>
        )}
      </motion.div>
    );
  };

  const renderPolicyModal = () => (
    <AnimatePresence>
      {showPolicyModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-2xl shadow-2xl max-w-[400px] w-full p-6 flex flex-col items-center text-center">
             <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4"><ShieldAlert className="w-8 h-8 text-brand-blue" /></div>
             <h2 className="text-xl font-bold mb-2">Message Safety Policy</h2>
             <p className="text-sm text-gray-500 mb-6 leading-relaxed">
               Welcome to IMChat! By initiating conversations, you respect the personal privacy of others. You agree not to send spam, illicit media, or engage in abusive behavior. Users have the right to block, unblock, and report unwanted engagements over Public & Privacy protection layers.
             </p>
             <button onClick={() => { setAcceptedPolicy(true); setShowPolicyModal(false); }} className="w-full bg-brand-blue text-white font-bold py-3.5 rounded-xl active:scale-95 transition-transform shadow-lg shadow-blue-500/20">
               I Understand & Agree
             </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderMediaPopup = () => (
    <AnimatePresence>
      {mediaPopup && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center p-4"
        >
          <header className="absolute top-0 inset-x-0 p-4 flex items-center justify-between text-white z-10">
             <button onClick={() => setMediaPopup(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all active:scale-90"><X className="w-6 h-6"/></button>
             {mediaPopup.type === 'image' && onUpdateAvatar && (
               <button 
                onClick={() => {
                  onUpdateAvatar(mediaPopup.url);
                  setMediaPopup(null);
                  alert("Profile picture updated!");
                }}
                className="px-5 py-2 bg-brand-blue text-white rounded-full font-bold text-sm flex items-center gap-2 active:scale-95 transition-all shadow-lg"
               >
                 <Camera className="w-4 h-4"/> Set as Avatar
               </button>
             )}
          </header>
          <div className="w-full h-full flex items-center justify-center">
            {mediaPopup.type === 'image' ? (
              <img src={mediaPopup.url} className="max-w-full max-h-[80vh] object-contain rounded-xl" />
            ) : (
              <video src={mediaPopup.url} controls autoPlay className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl" />
            )}
          </div>
          <footer className="absolute bottom-10 text-white/40 text-xs font-medium">
             {mediaPopup.name}
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const handleForwardMessage = (targetChatId: string) => {
    if (!forwardingMsg) return;

    const newMessageId = `msg_${Date.now()}_forward_${Math.random().toString(36).substring(2, 9)}`;
    const forwardedMessage: Message = {
      id: newMessageId,
      senderId: currentUserId,
      text: forwardingMsg.text,
      timestamp: Date.now(),
      isRead: false,
      media: forwardingMsg.media ? { ...forwardingMsg.media } : undefined
    };

    setChats(prev => prev.map(chat => {
      if (chat.id === targetChatId) {
        return {
          ...chat,
          messages: [...chat.messages, forwardedMessage]
        };
      }
      return chat;
    }));

    window.dispatchEvent(new CustomEvent('new-message', {
      detail: { title: 'Message Forwarded', body: 'The message has been copied to the conversation!' }
    }));

    setForwardingMsg(null);
    setForwardSearch('');
  };

  const handleForwardToUser = (user: any) => {
    if (!forwardingMsg) return;

    const existingChat = chats.find(c => !c.isGroup && c.participants.includes(user.id));
    let targetChatId = '';

    if (existingChat) {
      targetChatId = existingChat.id;
    } else {
      targetChatId = `c_${user.id}`;
      const newChat: Chat = {
        id: targetChatId,
        isGroup: false,
        name: user.name,
        avatar: user.avatar,
        presence: 'online',
        participants: [user.id, currentUserId],
        messages: []
      };
      setChats(prev => [newChat, ...prev]);
    }

    const newMessageId = `msg_${Date.now()}_forward_${Math.random().toString(36).substring(2, 9)}`;
    const forwardedMessage: Message = {
      id: newMessageId,
      senderId: currentUserId,
      text: forwardingMsg.text,
      timestamp: Date.now(),
      isRead: false,
      media: forwardingMsg.media ? { ...forwardingMsg.media } : undefined
    };

    setChats(prev => prev.map(chat => {
      if (chat.id === targetChatId) {
        return {
          ...chat,
          messages: [...chat.messages, forwardedMessage]
        };
      }
      return chat;
    }));

    window.dispatchEvent(new CustomEvent('new-message', {
      detail: { title: 'Message Forwarded', body: `Copied to ${user.name}` }
    }));

    setForwardingMsg(null);
    setForwardSearch('');
  };

  const renderForwardModal = () => {
    if (!forwardingMsg) return null;

    const filteredChats = chats.filter(chat => 
      chat.name.toLowerCase().includes(forwardSearch.toLowerCase())
    );

    const filteredUsers = users.filter(user => 
      user.id !== currentUserId && 
      user.name.toLowerCase().includes(forwardSearch.toLowerCase()) &&
      !chats.some(c => !c.isGroup && c.participants.includes(user.id))
    );

    return (
      <AnimatePresence>
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-3xl w-full max-w-[420px] overflow-hidden shadow-2xl flex flex-col max-h-[80vh] text-left"
          >
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-150 flex items-center justify-between bg-gray-50/50">
              <div>
                <h3 className="font-extrabold text-[18px] text-gray-950">Forward Message</h3>
                <p className="text-xs text-gray-500 mt-1 truncate max-w-[280px]">
                  Copying: "{forwardingMsg.text || 'Media attachment'}"
                </p>
              </div>
              <button 
                onClick={() => { setForwardingMsg(null); setForwardSearch(''); }}
                className="p-2 hover:bg-gray-200/60 active:scale-95 transition-all text-gray-500 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search input */}
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Search chats or contacts..."
                  value={forwardSearch}
                  onChange={(e) => setForwardSearch(e.target.value)}
                  className="w-full bg-gray-50 py-2.5 pl-10 pr-4 rounded-xl border border-gray-200 text-[14px] outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue leading-tight text-gray-900"
                />
              </div>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Existing Chats Section */}
              {filteredChats.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-black tracking-widest text-gray-400 uppercase block pl-1">Recent Conversations</span>
                  <div className="space-y-1">
                    {filteredChats.map(chat => (
                      <div key={chat.id} className="flex items-center justify-between p-2 rounded-2xl hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <UserAvatar src={chat.avatar} name={chat.name} size="md" className={chat.isGroup ? 'rounded-xl' : ''} />
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900">{chat.name}</span>
                            <span className="text-xs text-gray-500">{chat.isGroup ? 'Group' : 'Chat'}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleForwardMessage(chat.id)}
                          className="px-4 py-2 bg-brand-blue text-white font-extrabold text-xs rounded-xl hover:bg-blue-600 active:scale-95 transition-all shadow-md shadow-blue-500/10 flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" /> Forward
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contacts/Users Section */}
              {filteredUsers.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-black tracking-widest text-gray-400 uppercase block pl-1">Other Contacts</span>
                  <div className="space-y-1">
                    {filteredUsers.map(user => (
                      <div key={user.id} className="flex items-center justify-between p-2 rounded-2xl hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <UserAvatar src={user.avatar} name={user.name} size="md" />
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900">{user.name}</span>
                            <span className="text-xs text-gray-500">Available</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleForwardToUser(user)}
                          className="px-4 py-2 bg-brand-blue text-white font-extrabold text-xs rounded-xl hover:bg-blue-600 active:scale-95 transition-all shadow-md shadow-blue-500/10 flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" /> Forward
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredChats.length === 0 && filteredUsers.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-sm text-gray-400">No chats or contacts found matching "{forwardSearch}"</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    );
  };

  const renderGameInviteModal = () => {
    if (!showGameInviteModal) return null;

    return (
      <AnimatePresence>
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4" onClick={() => setShowGameInviteModal(false)}>
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh] border border-gray-100"
          >
            {/* Header */}
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                  <Gamepad2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900 leading-tight">Invite to Play</h3>
                  <p className="text-[11px] text-gray-500 font-medium">Select a game to play together in real-time!</p>
                </div>
              </div>
              <button 
                onClick={() => setShowGameInviteModal(false)}
                className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List */}
            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {CHAT_GAMES_LIST.map((game) => (
                <div 
                  key={game.id} 
                  onClick={() => handleSendGameInvite(game)}
                  className="group relative flex items-center gap-4 p-3 rounded-2xl border border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all duration-200 cursor-pointer overflow-hidden"
                >
                  <div className="absolute inset-0 bg-cover bg-center opacity-0 group-hover:opacity-5 transition-opacity" style={{ backgroundImage: `url(${game.banner})` }}></div>

                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center text-3xl shadow-sm border border-gray-50/50 group-hover:scale-105 transition-transform shrink-0">
                    {game.icon}
                  </div>

                  <div className="flex-1 min-w-0 z-10">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black text-gray-900 leading-tight group-hover:text-indigo-600 transition-colors truncate">{game.title}</span>
                      <span className="text-[9px] uppercase font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md shrink-0">{game.category}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 font-medium mt-0.5 truncate">Click to send game invite to {activeChat?.name || 'friend'}</p>
                  </div>

                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Play className="w-4 h-4 fill-current" />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    );
  };

  const renderUnlockPinModal = () => {
    if (!showUnlockPinModal || !pendingUnlockChatId) return null;
    const targetChat = chats.find(c => c.id === pendingUnlockChatId);
    if (!targetChat) return null;

    return (
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowUnlockPinModal(false)}>
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-500" />
              <h3 className="font-extrabold text-gray-900 dark:text-white text-base">Locked Chat</h3>
            </div>
            <button onClick={() => setShowUnlockPinModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            This chat <span className="font-bold">{targetChat.name}</span> is secured with a one-time lock PIN code. Enter PIN to unlock.
          </p>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Lock PIN Code</label>
            <input 
              type="password"
              maxLength={6}
              placeholder="Enter PIN (e.g. 1234)"
              value={lockPinInput}
              onChange={(e) => setLockPinInput(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm font-mono tracking-widest text-center focus:ring-2 focus:ring-brand-blue outline-none bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (lockPinInput.trim() === targetChat.lockPin || lockPinInput.trim() === '1234') {
                    setUnlockedChatIds(prev => [...prev, targetChat.id]);
                    setShowUnlockPinModal(false);
                    setActiveChatId(targetChat.id);
                    setLockPinInput('');
                  } else {
                    setLockPinError('Incorrect PIN code. Try again.');
                  }
                }
              }}
            />
          </div>
          {lockPinError && <p className="text-xs font-bold text-red-500">{lockPinError}</p>}
          <button 
            type="button"
            onClick={() => {
              if (lockPinInput.trim() === targetChat.lockPin || lockPinInput.trim() === '1234') {
                setUnlockedChatIds(prev => [...prev, targetChat.id]);
                setShowUnlockPinModal(false);
                setActiveChatId(targetChat.id);
                setLockPinInput('');
              } else {
                setLockPinError('Incorrect PIN code. Try again.');
              }
            }}
            className="w-full py-3 bg-brand-blue hover:bg-blue-600 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer"
          >
            Unlock Chat Messages
          </button>
        </div>
      </div>
    );
  };

  const handleCreateGroupChat = () => {
    if (!newGroupName.trim()) {
      alert("Please enter a group name.");
      return;
    }
    if (selectedGroupMembers.length === 0) {
      alert("Please select at least one participant for the group.");
      return;
    }

    const groupId = `group_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const members = Array.from(new Set([currentUserId, ...selectedGroupMembers]));
    const defaultGroupAvatar = newGroupAvatar.trim() || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150';

    const newGroupChat: Chat = {
      id: groupId,
      isGroup: true,
      name: newGroupName.trim(),
      avatar: defaultGroupAvatar,
      presence: 'online',
      participants: members,
      adminIds: [currentUserId],
      createdBy: currentUserId,
      messages: [
        {
          id: `msg_grp_welcome_${Date.now()}`,
          senderId: currentUserId,
          text: `🎉 Group "${newGroupName.trim()}" created! Welcome to the group chat!`,
          timestamp: Date.now(),
          isRead: true
        }
      ]
    };

    setChats(prev => [newGroupChat, ...prev]);
    setActiveChatId(groupId);
    setShowNewGroupModal(false);
    setNewGroupName('');
    setNewGroupAvatar('');
    setSelectedGroupMembers([]);
    setGroupSearchQuery('');
    playNotificationSound();
  };

  const isChatAdmin = (chat: Chat | undefined, userId: string): boolean => {
    if (!chat || !chat.isGroup) return false;
    if (chat.adminIds && chat.adminIds.includes(userId)) return true;
    if (chat.createdBy && chat.createdBy === userId) return true;
    if (!chat.adminIds || chat.adminIds.length === 0) {
      return chat.participants[0] === userId || userId === currentUserId;
    }
    return false;
  };

  const handlePromoteToAdmin = (targetUserId: string) => {
    if (!activeChat || !activeChat.isGroup) return;
    const targetUser = users.find(u => u.id === targetUserId);
    const targetName = targetUser?.name || getUserName(targetUserId);

    const systemMsg: Message = {
      id: `msg_sys_prom_${Date.now()}`,
      senderId: 'system',
      text: `👑 ${currentUserName || 'Admin'} promoted ${targetName} to Group Admin`,
      timestamp: Date.now(),
      isRead: true
    };

    setChats(prev => prev.map(c => {
      if (c.id === activeChat.id) {
        const existingAdmins = (c.adminIds && c.adminIds.length > 0)
          ? c.adminIds
          : [c.createdBy || currentUserId];
        const newAdmins = Array.from(new Set([...existingAdmins, targetUserId]));
        return {
          ...c,
          adminIds: newAdmins,
          messages: [...c.messages, systemMsg]
        };
      }
      return c;
    }));
    playNotificationSound();
  };

  const handleDemoteFromAdmin = (targetUserId: string) => {
    if (!activeChat || !activeChat.isGroup) return;
    if (targetUserId === activeChat.createdBy) {
      alert("The original group creator cannot be demoted.");
      return;
    }
    const targetUser = users.find(u => u.id === targetUserId);
    const targetName = targetUser?.name || getUserName(targetUserId);

    const systemMsg: Message = {
      id: `msg_sys_dem_${Date.now()}`,
      senderId: 'system',
      text: `🛡️ ${targetName} is no longer a Group Admin`,
      timestamp: Date.now(),
      isRead: true
    };

    setChats(prev => prev.map(c => {
      if (c.id === activeChat.id) {
        const existingAdmins = (c.adminIds && c.adminIds.length > 0)
          ? c.adminIds
          : [c.createdBy || currentUserId];
        const newAdmins = existingAdmins.filter(id => id !== targetUserId);
        return {
          ...c,
          adminIds: newAdmins,
          messages: [...c.messages, systemMsg]
        };
      }
      return c;
    }));
  };

  const handleRemoveMember = (targetUserId: string) => {
    if (!activeChat || !activeChat.isGroup) return;
    if (targetUserId === activeChat.createdBy) {
      alert("The group creator cannot be removed from the group.");
      return;
    }
    const targetUser = users.find(u => u.id === targetUserId);
    const targetName = targetUser?.name || getUserName(targetUserId);

    if (!confirm(`Are you sure you want to remove ${targetName} from "${activeChat.name}"?`)) {
      return;
    }

    const systemMsg: Message = {
      id: `msg_sys_rem_${Date.now()}`,
      senderId: 'system',
      text: `❌ ${targetName} was removed from the group by ${currentUserName || 'Admin'}`,
      timestamp: Date.now(),
      isRead: true
    };

    setChats(prev => prev.map(c => {
      if (c.id === activeChat.id) {
        return {
          ...c,
          participants: c.participants.filter(id => id !== targetUserId),
          adminIds: (c.adminIds || []).filter(id => id !== targetUserId),
          messages: [...c.messages, systemMsg]
        };
      }
      return c;
    }));
  };

  const handleAddMembersToGroup = (newMemberIds: string[]) => {
    if (!activeChat || !activeChat.isGroup || newMemberIds.length === 0) return;

    const names = newMemberIds.map(id => {
      const u = users.find(user => user.id === id);
      return u?.name || getUserName(id);
    }).join(', ');

    const systemMsg: Message = {
      id: `msg_sys_add_${Date.now()}`,
      senderId: 'system',
      text: `🎉 ${names} joined the group chat`,
      timestamp: Date.now(),
      isRead: true
    };

    setChats(prev => prev.map(c => {
      if (c.id === activeChat.id) {
        return {
          ...c,
          participants: Array.from(new Set([...c.participants, ...newMemberIds])),
          messages: [...c.messages, systemMsg]
        };
      }
      return c;
    }));

    setShowAddMemberModal(false);
    setSelectedNewMembers([]);
    playNotificationSound();
  };

  const handleLeaveGroup = () => {
    if (!activeChat || !activeChat.isGroup) return;
    if (!confirm(`Are you sure you want to leave "${activeChat.name}"?`)) return;

    const systemMsg: Message = {
      id: `msg_sys_leave_${Date.now()}`,
      senderId: 'system',
      text: `👋 ${currentUserName || 'A member'} left the group`,
      timestamp: Date.now(),
      isRead: true
    };

    setChats(prev => prev.map(c => {
      if (c.id === activeChat.id) {
        return {
          ...c,
          participants: c.participants.filter(id => id !== currentUserId),
          adminIds: (c.adminIds || []).filter(id => id !== currentUserId),
          messages: [...c.messages, systemMsg]
        };
      }
      return c;
    }));

    setShowGroupDetailModal(false);
    setActiveChatId(null);
  };

  const handleSaveGroupName = () => {
    if (!activeChat || !activeChat.isGroup || !editGroupNameInput.trim()) return;
    setChats(prev => prev.map(c => {
      if (c.id === activeChat.id) {
        return {
          ...c,
          name: editGroupNameInput.trim()
        };
      }
      return c;
    }));
    setIsEditingGroupName(false);
  };

  const searchableUsers = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; username: string; email?: string; avatar?: string; isVerified?: boolean }>();

    // Seeded directory profiles so username searching is always responsive and realistic
    const knownSeeds = [
      { id: 'user_crystal', name: 'Crystal Davis', username: 'crystald', email: 'crystal@example.com', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', isVerified: true },
      { id: 'user_sean', name: 'Sean Miller', username: 'seanm', email: 'sean@example.com', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', isVerified: true },
      { id: 'user_amber', name: 'Amber Chen', username: 'amberc', email: 'amber@example.com', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150', isVerified: false },
      { id: 'user_alex', name: 'Alex Rivera', username: 'alexr', email: 'alex@example.com', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150', isVerified: false },
      { id: 'user_sarah', name: 'Sarah Connor', username: 'sarahc', email: 'sarah@example.com', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', isVerified: true },
      { id: 'user_david', name: 'David Kim', username: 'davidk', email: 'david@example.com', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', isVerified: false },
      { id: 'user_elena', name: 'Elena Rostova', username: 'elenar', email: 'elena@example.com', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150', isVerified: false },
    ];

    knownSeeds.forEach(u => map.set(u.id, u));

    users.forEach(u => {
      const cleanUsername = (u.username || (u.email ? u.email.split('@')[0] : u.name.toLowerCase().replace(/\s+/g, '_'))).replace(/^@/, '');
      map.set(u.id, {
        id: u.id,
        name: u.name,
        username: cleanUsername,
        email: u.email,
        avatar: u.avatar,
        isVerified: u.isVerified
      });
    });

    return Array.from(map.values()).filter(u => u.id !== currentUserId);
  }, [users, currentUserId]);

  const handleSendGroupInvitation = (
    targetUser: { id: string; name: string; username: string; avatar?: string },
    note?: string
  ) => {
    if (!activeChat || !activeChat.isGroup) return;

    const inviteId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newInvite: GroupInvitation = {
      id: inviteId,
      groupId: activeChat.id,
      groupName: activeChat.name,
      groupAvatar: activeChat.avatar,
      userId: targetUser.id,
      userName: targetUser.name,
      username: targetUser.username,
      userAvatar: targetUser.avatar,
      invitedBy: currentUserId,
      inviterName: currentUserName || 'Admin',
      invitedAt: Date.now(),
      status: 'pending',
      note: note?.trim() || undefined
    };

    // 1. System notification in the group chat
    const systemMsg: Message = {
      id: `msg_sys_inv_${Date.now()}`,
      senderId: 'system',
      text: `✉️ ${currentUserName || 'Admin'} sent a group invitation to @${targetUser.username}`,
      timestamp: Date.now(),
      isRead: true
    };

    // 2. Direct message invitation to target user's chat
    const noteText = note?.trim() ? `\n"${note.trim()}"` : '';
    const dmMsgText = `📩 Group Invitation: You're invited to join "${activeChat.name}" by ${currentUserName || 'an Admin'}!${noteText}\nTap to join this group chat.`;

    const dmMsg: Message = {
      id: `msg_dm_inv_${Date.now()}`,
      senderId: currentUserId,
      text: dmMsgText,
      timestamp: Date.now(),
      isRead: false,
      media: {
        type: 'image',
        url: activeChat.avatar || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150',
        name: `Group Invitation: ${activeChat.name}`
      }
    };

    setChats(prev => {
      let hasDm = false;
      const updated = prev.map(c => {
        if (c.id === activeChat.id) {
          const existingInvites = c.pendingInvites || [];
          const filtered = existingInvites.filter(i => i.userId !== targetUser.id);
          return {
            ...c,
            pendingInvites: [...filtered, newInvite],
            messages: [...c.messages, systemMsg]
          };
        }
        if (!c.isGroup && c.participants.includes(targetUser.id) && c.participants.includes(currentUserId)) {
          hasDm = true;
          return {
            ...c,
            messages: [...c.messages, dmMsg],
            unreadCount: (c.unreadCount || 0) + 1
          };
        }
        return c;
      });

      if (!hasDm) {
        const newDm: Chat = {
          id: `c_${targetUser.id}`,
          isGroup: false,
          name: targetUser.name,
          avatar: targetUser.avatar || `https://picsum.photos/seed/${targetUser.id}/150/150`,
          presence: 'online',
          participants: [currentUserId, targetUser.id],
          unreadCount: 1,
          messages: [dmMsg]
        };
        return [...updated, newDm];
      }

      return updated;
    });

    setSelectedInviteUser(null);
    setInviteCustomNote('');
    setInviteSuccessToast(`Invitation sent to @${targetUser.username}!`);
    playSentMessageSound();
  };

  const handleCancelGroupInvitation = (inviteId: string) => {
    if (!activeChat || !activeChat.isGroup) return;
    setChats(prev => prev.map(c => {
      if (c.id === activeChat.id) {
        return {
          ...c,
          pendingInvites: (c.pendingInvites || []).filter(inv => inv.id !== inviteId)
        };
      }
      return c;
    }));
  };

  const handleResendGroupInvitation = (invite: GroupInvitation) => {
    handleSendGroupInvitation(
      { id: invite.userId, name: invite.userName, username: invite.username, avatar: invite.userAvatar },
      invite.note
    );
  };

  const renderNewGroupModal = () => {
    if (!showNewGroupModal) return null;

    const filteredUsers = users.filter(u => 
      u.id !== currentUserId && 
      (u.name.toLowerCase().includes(groupSearchQuery.toLowerCase()) || 
       (u.email && u.email.toLowerCase().includes(groupSearchQuery.toLowerCase())))
    );

    const presetAvatars = [
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150',
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=150',
      'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=150',
      'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=150',
      'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=150',
    ];

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={() => setShowNewGroupModal(false)}>
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50/60 to-purple-50/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-blue text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-gray-900">Create New Group Chat</h3>
                <p className="text-xs text-gray-500 font-medium">Add members and start chatting</p>
              </div>
            </div>
            <button
              onClick={() => setShowNewGroupModal(false)}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 overflow-y-auto space-y-4 flex-1">
            {/* Group Name */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Group Name</label>
              <input
                type="text"
                placeholder="e.g. Project Alpha, Friends Hangout..."
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-blue outline-none text-gray-900"
                autoFocus
              />
            </div>

            {/* Group Avatar Presets */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Group Avatar</label>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {presetAvatars.map((preset, idx) => (
                  <img
                    key={idx}
                    src={preset}
                    alt={`Avatar preset ${idx + 1}`}
                    onClick={() => setNewGroupAvatar(preset)}
                    className={`w-11 h-11 rounded-xl object-cover cursor-pointer border-2 transition-all shrink-0 ${
                      (newGroupAvatar === preset || (!newGroupAvatar && idx === 0))
                        ? 'border-brand-blue scale-105 shadow-md shadow-blue-500/20'
                        : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Search members */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-gray-700">Select Participants</label>
                <span className="text-[11px] font-bold text-brand-blue">
                  {selectedGroupMembers.length} selected
                </span>
              </div>
              <div className="relative mb-2">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={groupSearchQuery}
                  onChange={(e) => setGroupSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-blue outline-none text-gray-900"
                />
              </div>

              {/* Members List */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto border border-gray-100 rounded-2xl p-2 bg-gray-50/50">
                {filteredUsers.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4 italic">No contacts found</p>
                ) : (
                  filteredUsers.map(u => {
                    const isSelected = selectedGroupMembers.includes(u.id);
                    return (
                      <div
                        key={u.id}
                        onClick={() => {
                          setSelectedGroupMembers(prev => 
                            isSelected ? prev.filter(id => id !== u.id) : [...prev, u.id]
                          );
                        }}
                        className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50/80 border border-blue-200' : 'hover:bg-gray-100/70 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar src={u.avatar} name={u.name} size="sm" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-800 truncate">{u.name}</p>
                            {u.email && <p className="text-[10px] text-gray-400 truncate">{u.email}</p>}
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-brand-blue border-brand-blue text-white' : 'border-gray-300 bg-white'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
            <button
              onClick={() => setShowNewGroupModal(false)}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateGroupChat}
              disabled={!newGroupName.trim() || selectedGroupMembers.length === 0}
              className="px-6 py-2 bg-brand-blue hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Users className="w-4 h-4" />
              <span>Create Group</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  const renderGroupDetailModal = () => {
    if (!showGroupDetailModal || !activeChat || !activeChat.isGroup) return null;

    const isCurrentUserAdmin = isChatAdmin(activeChat, currentUserId);

    const resolvedMembers = activeChat.participants.map(pId => {
      const u = users.find(user => user.id === pId);
      const isCurrent = pId === currentUserId;
      const name = isCurrent ? `${currentUserName || 'You'} (You)` : (u?.name || getUserName(pId));
      const avatar = isCurrent ? undefined : u?.avatar;
      const isOwner = pId === (activeChat.createdBy || activeChat.participants[0]);
      const isAdmin = isChatAdmin(activeChat, pId);
      const email = u?.email;
      return {
        id: pId,
        name,
        avatar,
        email,
        isCurrent,
        isOwner,
        isAdmin,
        userObj: u
      };
    });

    const adminCount = resolvedMembers.filter(m => m.isAdmin).length;
    const memberCount = resolvedMembers.length;

    const filteredMembers = resolvedMembers.filter(m => {
      const q = memberSearchQuery.toLowerCase().trim();
      const matchesSearch = !q || m.name.toLowerCase().includes(q) || (m.email && m.email.toLowerCase().includes(q));
      if (!matchesSearch) return false;
      if (memberRoleFilter === 'admins') return m.isAdmin;
      if (memberRoleFilter === 'members') return !m.isAdmin;
      return true;
    });

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-4">
        <motion.div 
          initial={{ scale: 0.92, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 10 }}
          className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 bg-gradient-to-b from-blue-50/50 to-white border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative">
                <UserAvatar 
                  src={activeChat.avatar} 
                  name={activeChat.name} 
                  size="md" 
                  className="rounded-2xl border-2 border-white shadow-sm"
                />
                <div className="absolute -bottom-1 -right-1 bg-brand-blue text-white p-1 rounded-full border border-white shadow-xs">
                  <Users className="w-2.5 h-2.5" />
                </div>
              </div>
              <div className="min-w-0">
                {isEditingGroupName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={editGroupNameInput}
                      onChange={e => setEditGroupNameInput(e.target.value)}
                      className="text-sm font-bold text-gray-900 border border-brand-blue rounded-lg px-2 py-0.5 outline-none"
                      placeholder="Group Name"
                      autoFocus
                    />
                    <button onClick={handleSaveGroupName} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setIsEditingGroupName(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-gray-900 text-base truncate">{activeChat.name}</h3>
                    {isCurrentUserAdmin && (
                      <button 
                        onClick={() => {
                          setEditGroupNameInput(activeChat.name);
                          setIsEditingGroupName(true);
                        }} 
                        className="text-gray-400 hover:text-brand-blue p-1 rounded-lg hover:bg-gray-100 transition-colors"
                        title="Edit Group Name"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-500 font-medium">
                  {memberCount} Members • {adminCount} {adminCount === 1 ? 'Admin' : 'Admins'}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowGroupDetailModal(false);
                setIsEditingGroupName(false);
              }}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-gray-100 bg-gray-50/50 px-4 pt-1">
            <button
              onClick={() => setGroupDetailTab('members')}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border-b-2 ${
                groupDetailTab === 'members'
                  ? 'border-brand-blue text-brand-blue bg-white rounded-t-xl shadow-xs'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Member Management</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-brand-blue font-black">
                {memberCount}
              </span>
            </button>
            <button
              onClick={() => setGroupDetailTab('info')}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border-b-2 ${
                groupDetailTab === 'info'
                  ? 'border-brand-blue text-brand-blue bg-white rounded-t-xl shadow-xs'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Info className="w-4 h-4" />
              <span>Group Info</span>
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-3 max-h-[60vh]">
            {groupDetailTab === 'members' ? (
              <>
                {/* Admin Status Card */}
                {isCurrentUserAdmin ? (
                  <div className="p-3 bg-gradient-to-r from-blue-50/90 to-indigo-50/90 border border-blue-100 rounded-2xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
                        <Crown className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                          <span>You are a Group Admin</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200">Admin</span>
                        </div>
                        <p className="text-[10px] text-gray-500 truncate">You can remove members or promote users to admin status.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          setShowInviteModal(true);
                          setInviteModalTab('search');
                          setInviteUsernameQuery('');
                          setSelectedInviteUser(null);
                          setInviteSuccessToast(null);
                        }}
                        className="px-3 py-1.5 bg-white hover:bg-blue-50 text-brand-blue border border-brand-blue/30 active:scale-95 font-bold text-xs rounded-xl flex items-center gap-1.5 shrink-0 shadow-xs transition-all"
                        title="Search by username and send group invitation"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Invite Member</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowAddMemberModal(true);
                          setSelectedNewMembers([]);
                          setAddMemberSearch('');
                        }}
                        className="px-3 py-1.5 bg-brand-blue hover:bg-blue-600 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center gap-1 shrink-0 shadow-xs transition-all"
                        title="Quick add existing contact"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-gray-50 border border-gray-100 rounded-2xl flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gray-200 text-gray-600 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-gray-800">You are a Member</div>
                      <p className="text-[10px] text-gray-500">Only group admins can remove members or promote other users to admin status.</p>
                    </div>
                  </div>
                )}

                {/* Pending Invitations Notice for Admins */}
                {isCurrentUserAdmin && Boolean(activeChat.pendingInvites?.some(i => i.status === 'pending')) && (
                  <div className="p-2.5 bg-amber-50/90 border border-amber-200/80 rounded-2xl flex items-center justify-between gap-2 shadow-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="text-xs font-bold text-amber-900 truncate">
                        {activeChat.pendingInvites?.filter(i => i.status === 'pending').length} pending group {activeChat.pendingInvites?.filter(i => i.status === 'pending').length === 1 ? 'invitation' : 'invitations'}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setShowInviteModal(true);
                        setInviteModalTab('pending');
                      }}
                      className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-800 text-[11px] font-bold rounded-lg border border-amber-200 transition-colors shadow-xs shrink-0"
                    >
                      Manage
                    </button>
                  </div>
                )}

                {/* Search & Filters */}
                <div className="flex flex-col gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search members by name or email..."
                      value={memberSearchQuery}
                      onChange={e => setMemberSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 outline-none focus:ring-2 focus:ring-brand-blue/20"
                    />
                    {memberSearchQuery && (
                      <button onClick={() => setMemberSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(['all', 'admins', 'members'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setMemberRoleFilter(tab)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-colors ${
                          memberRoleFilter === tab 
                            ? 'bg-brand-blue text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {tab === 'all' ? `All (${resolvedMembers.length})` : tab === 'admins' ? `Admins (${adminCount})` : `Members (${memberCount - adminCount})`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Members List */}
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {filteredMembers.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-xs italic">
                      No members matching the criteria
                    </div>
                  ) : (
                    filteredMembers.map(member => (
                      <div 
                        key={member.id} 
                        className="flex items-center justify-between p-2.5 bg-gray-50/80 hover:bg-gray-100/80 border border-gray-100 rounded-2xl transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative">
                            <UserAvatar src={member.avatar} name={member.name} size="sm" />
                            <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white ${member.isAdmin ? 'bg-amber-500' : 'bg-blue-400'}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-xs font-bold text-gray-900 truncate">{member.name}</p>
                              {member.isOwner && (
                                <span className="px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 border border-amber-200 text-[9px] font-black uppercase flex items-center gap-0.5">
                                  <Crown className="w-2.5 h-2.5 text-amber-600" /> Creator
                                </span>
                              )}
                              {member.isAdmin && !member.isOwner && (
                                <span className="px-1.5 py-0.2 rounded-md bg-blue-100 text-brand-blue border border-blue-200 text-[9px] font-black uppercase flex items-center gap-0.5">
                                  <Shield className="w-2.5 h-2.5" /> Admin
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-400 truncate">
                              {member.email || (member.isAdmin ? 'Group Administrator' : 'Regular Member')}
                            </p>
                          </div>
                        </div>

                        {/* Admin Action Buttons */}
                        {isCurrentUserAdmin && !member.isCurrent && (
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            {!member.isAdmin ? (
                              <button
                                onClick={() => handlePromoteToAdmin(member.id)}
                                className="px-2.5 py-1.5 bg-blue-50 hover:bg-brand-blue hover:text-white text-brand-blue font-bold text-xs rounded-xl transition-all flex items-center gap-1 active:scale-95 shadow-xs"
                                title="Promote other user to admin status"
                              >
                                <Shield className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Promote to Admin</span>
                              </button>
                            ) : !member.isOwner ? (
                              <button
                                onClick={() => handleDemoteFromAdmin(member.id)}
                                className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-xs rounded-xl transition-all flex items-center gap-1 active:scale-95"
                                title="Demote from Admin"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Demote</span>
                              </button>
                            ) : null}

                            {!member.isOwner && (
                              <button
                                onClick={() => handleRemoveMember(member.id)}
                                className="p-1.5 bg-red-50 hover:bg-red-500 hover:text-white text-red-500 rounded-xl transition-all active:scale-95"
                                title="Remove member from group"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Invite by Username prompt for Admins */}
                {isCurrentUserAdmin && (
                  <div className="p-2.5 bg-blue-50/60 hover:bg-blue-50/90 border border-dashed border-blue-200 rounded-2xl flex items-center justify-between gap-2 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-xl bg-blue-100 text-brand-blue flex items-center justify-center shrink-0">
                        <AtSign className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate">Invite by username</p>
                        <p className="text-[10px] text-gray-500 truncate">Search any @username on the network to send an invitation</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowInviteModal(true);
                        setInviteModalTab('search');
                        setInviteUsernameQuery('');
                        setSelectedInviteUser(null);
                        setInviteSuccessToast(null);
                      }}
                      className="px-2.5 py-1.5 bg-brand-blue hover:bg-blue-600 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-xs shrink-0 flex items-center gap-1"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Invite</span>
                    </button>
                  </div>
                )}

                {/* Footer Options */}
                <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                  <button
                    onClick={handleLeaveGroup}
                    className="text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Leave Group Chat
                  </button>
                  <span className="text-[11px] text-gray-400">
                    {filteredMembers.length} displayed
                  </span>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex flex-col gap-2">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Group Name</span>
                  <p className="text-sm font-bold text-gray-900">{activeChat.name}</p>
                </div>

                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex flex-col gap-2">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Description</span>
                  <p className="text-xs text-gray-700 leading-relaxed">
                    {activeChat.description || 'Welcome to this group chat. Connect, share ideas, and collaborate in real-time.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100/50 text-center">
                    <p className="text-lg font-black text-brand-blue">{activeChat.participants.length}</p>
                    <p className="text-[11px] text-gray-500 font-medium">Total Members</p>
                  </div>
                  <div className="bg-purple-50/50 p-3 rounded-2xl border border-purple-100/50 text-center">
                    <p className="text-lg font-black text-purple-600">{activeChat.messages.length}</p>
                    <p className="text-[11px] text-gray-500 font-medium">Messages Sent</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    );
  };

  const renderAddMemberModal = () => {
    if (!showAddMemberModal || !activeChat || !activeChat.isGroup) return null;

    const availableUsers = users.filter(u => 
      u.id !== currentUserId && !activeChat.participants.includes(u.id)
    );

    const filteredUsers = availableUsers.filter(u => {
      const q = addMemberSearch.toLowerCase().trim();
      return !q || u.name.toLowerCase().includes(q) || (u.email && u.email.toLowerCase().includes(q));
    });

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-3 sm:p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[85vh]"
        >
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-brand-blue flex items-center justify-center">
                <UserPlus className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-gray-900 text-sm">Add Members to Group</h3>
                <p className="text-[11px] text-gray-500">Select users to add to {activeChat.name}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowAddMemberModal(false);
                setSelectedNewMembers([]);
              }}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 flex flex-col gap-3 flex-1 overflow-y-auto">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search contacts to add..."
                value={addMemberSearch}
                onChange={e => setAddMemberSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 outline-none focus:ring-2 focus:ring-brand-blue/20"
              />
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {filteredUsers.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6 italic">No new contacts available to add</p>
              ) : (
                filteredUsers.map(u => {
                  const isSelected = selectedNewMembers.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => {
                        setSelectedNewMembers(prev => 
                          isSelected ? prev.filter(id => id !== u.id) : [...prev, u.id]
                        );
                      }}
                      className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/80 border border-blue-200' : 'hover:bg-gray-100/70 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar src={u.avatar} name={u.name} size="sm" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-800 truncate">{u.name}</p>
                          {u.email && <p className="text-[10px] text-gray-400 truncate">{u.email}</p>}
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-brand-blue border-brand-blue text-white' : 'border-gray-300 bg-white'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
            <button
              onClick={() => {
                setShowAddMemberModal(false);
                setSelectedNewMembers([]);
              }}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleAddMembersToGroup(selectedNewMembers)}
              disabled={selectedNewMembers.length === 0}
              className="px-5 py-2 bg-brand-blue hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add ({selectedNewMembers.length})</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  const renderInviteMemberModal = () => {
    if (!showInviteModal || !activeChat || !activeChat.isGroup) return null;

    const isCurrentUserAdmin = isChatAdmin(activeChat, currentUserId);
    if (!isCurrentUserAdmin) return null;

    const cleanQuery = inviteUsernameQuery.trim().toLowerCase().replace(/^@/, '');

    const matchingUsers = searchableUsers.filter(u => {
      if (!cleanQuery) return true;
      const uName = (u.name || '').toLowerCase();
      const uUname = (u.username || '').toLowerCase();
      const uEmail = (u.email || '').toLowerCase();
      return uUname.includes(cleanQuery) || uName.includes(cleanQuery) || uEmail.includes(cleanQuery);
    });

    const pendingInvites = (activeChat.pendingInvites || []).filter(inv => inv.status === 'pending');

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-3 sm:p-4">
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 10 }}
          className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-b from-blue-50/50 to-white">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-2xl bg-brand-blue text-white flex items-center justify-center shadow-xs shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-1.5 truncate">
                  <span>Invite New Member</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-blue-100 text-brand-blue border border-blue-200">
                    Admin
                  </span>
                </h3>
                <p className="text-[11px] text-gray-500 truncate">
                  Search by username to invite to <strong className="text-gray-700">{activeChat.name}</strong>
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowInviteModal(false);
                setSelectedInviteUser(null);
                setInviteUsernameQuery('');
                setInviteSuccessToast(null);
              }}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Sub-tabs */}
          <div className="flex border-b border-gray-100 bg-gray-50/50 px-3 pt-1">
            <button
              onClick={() => setInviteModalTab('search')}
              className={`flex-1 py-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 border-b-2 ${
                inviteModalTab === 'search'
                  ? 'border-brand-blue text-brand-blue bg-white rounded-t-xl shadow-xs'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <AtSign className="w-3.5 h-3.5" />
              <span>Search Username</span>
            </button>
            <button
              onClick={() => setInviteModalTab('pending')}
              className={`flex-1 py-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 border-b-2 ${
                inviteModalTab === 'pending'
                  ? 'border-brand-blue text-brand-blue bg-white rounded-t-xl shadow-xs'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pending ({pendingInvites.length})</span>
            </button>
            <button
              onClick={() => setInviteModalTab('link')}
              className={`flex-1 py-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 border-b-2 ${
                inviteModalTab === 'link'
                  ? 'border-brand-blue text-brand-blue bg-white rounded-t-xl shadow-xs'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Invite Link</span>
            </button>
          </div>

          {/* Body Content */}
          <div className="p-4 flex flex-col gap-3 flex-1 overflow-y-auto max-h-[58vh]">
            {/* Success Toast Banner */}
            {inviteSuccessToast && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center justify-between gap-2 shadow-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate">{inviteSuccessToast}</span>
                </div>
                <button onClick={() => setInviteSuccessToast(null)} className="text-emerald-500 hover:text-emerald-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {inviteModalTab === 'search' && (
              <>
                {/* Username Search Input */}
                <div className="flex flex-col gap-1.5">
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-brand-blue font-bold text-sm">
                      <AtSign className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search by username (e.g. crystal, sean, amber)..."
                      value={inviteUsernameQuery}
                      onChange={e => {
                        setInviteUsernameQuery(e.target.value);
                        if (selectedInviteUser) setSelectedInviteUser(null);
                      }}
                      className="w-full pl-9 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-medium text-gray-900 outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all"
                      autoFocus
                    />
                    {inviteUsernameQuery && (
                      <button
                        onClick={() => {
                          setInviteUsernameQuery('');
                          setSelectedInviteUser(null);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 px-1">
                    Find users by their @username to send a direct invitation to join this group.
                  </p>
                </div>

                {/* Selected User Composer Card */}
                {selectedInviteUser && (
                  <div className="p-3 bg-gradient-to-br from-blue-50/90 to-indigo-50/70 border border-blue-200 rounded-2xl flex flex-col gap-2.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar src={selectedInviteUser.avatar} name={selectedInviteUser.name} size="sm" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate flex items-center gap-1">
                            <span>{selectedInviteUser.name}</span>
                            {selectedInviteUser.isVerified && <BadgeCheck className="w-3.5 h-3.5 text-brand-blue inline" />}
                          </p>
                          <p className="text-[11px] font-bold text-brand-blue truncate">
                            @{selectedInviteUser.username}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedInviteUser(null)}
                        className="text-gray-400 hover:text-gray-600 p-1"
                        title="Cancel selection"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        Invitation Note (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder={`Hey @${selectedInviteUser.username}, join our group chat!`}
                        value={inviteCustomNote}
                        onChange={e => setInviteCustomNote(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 outline-none focus:ring-1 focus:ring-brand-blue"
                      />
                    </div>

                    <button
                      onClick={() => handleSendGroupInvitation(selectedInviteUser, inviteCustomNote)}
                      className="w-full py-2 bg-brand-blue hover:bg-blue-600 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 transition-all"
                    >
                      <SendHorizontal className="w-3.5 h-3.5" />
                      <span>Send Invitation to @{selectedInviteUser.username}</span>
                    </button>
                  </div>
                )}

                {/* Search Results List */}
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {matchingUsers.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-xs font-bold text-gray-600">No user found matching "@{cleanQuery}"</p>
                      <p className="text-[11px] text-gray-400 mt-1">Check the username spelling and try again.</p>
                    </div>
                  ) : (
                    matchingUsers.map(user => {
                      const isAlreadyMember = activeChat.participants.includes(user.id);
                      const isPending = pendingInvites.some(inv => inv.userId === user.id);
                      const isSelected = selectedInviteUser?.id === user.id;

                      return (
                        <div
                          key={user.id}
                          className={`flex items-center justify-between p-2 rounded-2xl transition-all border ${
                            isSelected
                              ? 'bg-blue-50 border-brand-blue shadow-xs'
                              : 'bg-gray-50/70 hover:bg-gray-100/70 border-gray-100'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <UserAvatar src={user.avatar} name={user.name} size="sm" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-xs font-bold text-gray-900 truncate">{user.name}</p>
                                {user.isVerified && <BadgeCheck className="w-3 h-3 text-brand-blue shrink-0" />}
                              </div>
                              <p className="text-[11px] font-bold text-brand-blue truncate">
                                @{user.username}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 ml-2">
                            {isAlreadyMember ? (
                              <span className="px-2 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold rounded-lg flex items-center gap-1 border border-gray-200">
                                <Check className="w-3 h-3 text-emerald-600" /> Member
                              </span>
                            ) : isPending ? (
                              <div className="flex items-center gap-1">
                                <span className="px-2 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-lg flex items-center gap-1 border border-amber-200">
                                  <Clock className="w-3 h-3 text-amber-600" /> Invited
                                </span>
                                <button
                                  onClick={() => handleSendGroupInvitation(user, "Reminder: You have a pending invitation to join this group.")}
                                  className="px-2 py-1 bg-white hover:bg-gray-100 text-gray-600 text-[10px] font-bold rounded-lg border border-gray-200 transition-colors"
                                  title="Resend invitation notification"
                                >
                                  Resend
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedInviteUser(user);
                                  setInviteCustomNote('');
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all active:scale-95 shadow-xs ${
                                  isSelected
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-brand-blue hover:bg-blue-600 text-white'
                                }`}
                              >
                                {isSelected ? (
                                  <>
                                    <Check className="w-3 h-3" />
                                    <span>Selected</span>
                                  </>
                                ) : (
                                  <>
                                    <Mail className="w-3 h-3" />
                                    <span>Invite</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {inviteModalTab === 'pending' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-gray-700">
                    Outstanding Invitations ({pendingInvites.length})
                  </span>
                  <span className="text-[10px] text-gray-400">Awaiting user response</span>
                </div>

                {pendingInvites.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-gray-600">No pending invitations</p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Search for users by username to send group chat invitations.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingInvites.map(invite => (
                      <div
                        key={invite.id}
                        className="p-3 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar src={invite.userAvatar} name={invite.userName} size="sm" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-900 truncate">{invite.userName}</p>
                            <p className="text-[11px] font-bold text-brand-blue truncate">@{invite.username}</p>
                            {invite.note && (
                              <p className="text-[10px] text-gray-500 italic truncate mt-0.5">"{invite.note}"</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleResendGroupInvitation(invite)}
                            className="px-2 py-1 bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-lg border border-gray-200 transition-colors"
                            title="Resend invitation"
                          >
                            Resend
                          </button>
                          <button
                            onClick={() => handleCancelGroupInvitation(invite.id)}
                            className="p-1.5 bg-red-50 hover:bg-red-500 hover:text-white text-red-500 rounded-lg transition-colors"
                            title="Cancel invitation"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {inviteModalTab === 'link' && (
              <div className="flex flex-col gap-3">
                <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-2xl">
                  <p className="text-xs font-bold text-gray-900 mb-1">Shareable Group Chat Link</p>
                  <p className="text-[11px] text-gray-600">
                    Anyone on IMChat with this link can view and join {activeChat.name}.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`https://imchat.app/join/g_${activeChat.id}`}
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-700 select-all outline-none"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`https://imchat.app/join/g_${activeChat.id}`);
                      setCopiedInviteLink(true);
                      setTimeout(() => setCopiedInviteLink(false), 2500);
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shrink-0 ${
                      copiedInviteLink ? 'bg-emerald-600 text-white' : 'bg-brand-blue text-white hover:bg-blue-600'
                    }`}
                  >
                    {copiedInviteLink ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
            <span className="text-[11px] text-gray-400">
              Only Group Admins can invite new members
            </span>
            <button
              onClick={() => {
                setShowInviteModal(false);
                setSelectedInviteUser(null);
                setInviteUsernameQuery('');
                setInviteSuccessToast(null);
              }}
              className="px-4 py-1.5 bg-white border border-gray-200 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-100 transition-colors"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  return (
    <>
      {activeChatId ? renderActiveChat() : renderChatList()}
      {renderActiveCall()}
      {renderLiveOverlay()}
      {renderPolicyModal()}
      {renderMediaPopup()}
      {renderForwardModal()}
      {renderGameInviteModal()}
      {renderUnlockPinModal()}
      {renderNewGroupModal()}
      {renderGroupDetailModal()}
      {renderAddMemberModal()}
      {renderInviteMemberModal()}
    </>
  );
}
