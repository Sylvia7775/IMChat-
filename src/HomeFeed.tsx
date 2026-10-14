import React, { useState, useRef, useEffect } from 'react';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { 
  Heart, MessageCircle, Send, Bookmark, MoreHorizontal, 
  Image as ImageIcon, Video, Smile, Download, Flag, 
  Share2, X, MoreVertical, Edit2, Trash2, Reply, Wand2, Users, MapPin, Tag, Globe, ChevronDown, ChevronUp, ArrowUp, UserPlus, Hash, Search, Star, BadgeCheck, RefreshCw, PlaySquare, Loader2, Link2, Pin,
  Play, Pause, Volume2, Clock, Sparkles, Calendar, Plus, FileImage, HardDrive, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PostStore, Post, PostComment } from './lib/PostStore';
import { EventStore } from './lib/EventStore';
import { ReelStore } from './lib/ReelStore';
import { auth, db } from './firebase';
import { collection, getDocs, doc, setDoc, onSnapshot } from 'firebase/firestore';
import UserAvatar from './components/UserAvatar';
import AudioPlayerPost from './components/AudioPlayerPost';
import GiphyIcon from './components/GiphyIcon';
import SharedReelFeedCard from './components/SharedReelFeedCard';
import InstagramStoriesTray from './components/InstagramStoriesTray';
import InstagramStoryViewer from './components/InstagramStoryViewer';
import InstagramStoryCreator from './components/InstagramStoryCreator';
import { StoryStore, Story } from './lib/StoryStore';
import { geminiService } from './geminiService';
import { uploadToCloudinary } from './lib/cloudinary';
import { COMMUNITY_USERS } from './lib/communityUsers';

const OWNER_EMAILS = ['mobilephonesky987@gmail.com', 'contact@imchat.im'];

const MOCK_STICKERS = [
  'https://fonts.gstatic.com/s/e/notoemoji/latest/1f600/512.webp',
  'https://fonts.gstatic.com/s/e/notoemoji/latest/1f602/512.webp',
  'https://fonts.gstatic.com/s/e/notoemoji/latest/1f60d/512.webp',
  'https://fonts.gstatic.com/s/e/notoemoji/latest/1f609/512.webp',
  'https://fonts.gstatic.com/s/e/notoemoji/latest/1f60e/512.webp',
  'https://fonts.gstatic.com/s/e/notoemoji/latest/1f60f/512.webp',
  'https://fonts.gstatic.com/s/e/notoemoji/latest/1f618/512.webp',
  'https://fonts.gstatic.com/s/e/notoemoji/latest/1f914/512.webp',
  'https://fonts.gstatic.com/s/e/notoemoji/latest/1f62d/512.webp',
  'https://fonts.gstatic.com/s/e/notoemoji/latest/1f622/512.webp',
  'https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.webp',
  'https://fonts.gstatic.com/s/e/notoemoji/latest/2764_fe0f/512.webp'
];

const renderTextWithMentions = (text: string) => {
  return text.split(' ').map((word, i) => {
    if (word.startsWith('@') || word.startsWith('#')) {
      return <span key={i} className="text-brand-blue hover:underline cursor-pointer font-medium">{word} </span>;
    }
    return word + ' ';
  });
};

const extractYouTubeId = (text: string) => {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = text.match(regex);
  return match ? match[1] : null;
};

interface VoiceMessagePlayerProps {
  url: string;
  duration?: number;
}

function VoiceMessagePlayer({ url, duration }: VoiceMessagePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [durationState, setDurationState] = useState(duration || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [speed, setSpeed] = useState<number>(1);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    const onLoadedMetadata = () => {
      if (!duration) {
        setDurationState(audio.duration);
      }
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);

    return () => {
      audio.pause();
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [url, duration]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.playbackRate = speed;
      audioRef.current.play().catch(err => console.error("Audio playback error:", err));
    }
  };

  const handleSpeedToggle = () => {
    if (!audioRef.current) return;
    let nextSpeed = 1;
    if (speed === 1) nextSpeed = 1.5;
    else if (speed === 1.5) nextSpeed = 2;
    else nextSpeed = 1;

    setSpeed(nextSpeed);
    audioRef.current.playbackRate = nextSpeed;
  };

  const formatAudioTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = durationState > 0 ? (currentTime / durationState) * 100 : 0;

  return (
    <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-emerald-100/80 rounded-2xl p-3 flex items-center gap-3 mt-1.5 shadow-sm max-w-[280px]">
      <button 
        type="button"
        onClick={togglePlay} 
        className="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shrink-0 transition-all active:scale-90"
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 text-white fill-white" />
        ) : (
          <Play className="w-4 h-4 text-white fill-white translate-x-[1px]" />
        )}
      </button>

      {/* Play/Timeline slider representation */}
      <div className="flex-1 min-w-0">
        <div className="h-1.5 w-full bg-emerald-200/60 rounded-full overflow-hidden relative">
          <div 
            className="absolute top-0 left-0 h-full bg-emerald-600 transition-all duration-100"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[10px] text-emerald-800/80 font-bold mt-1 uppercase tracking-wide">
          <span>{formatAudioTime(currentTime)}</span>
          <span>{formatAudioTime(durationState)}</span>
        </div>
      </div>

      {/* Playback speed toggle */}
      <button 
        type="button"
        onClick={handleSpeedToggle}
        className="px-2 py-0.5 rounded-full bg-emerald-100 hover:bg-emerald-200/80 border border-emerald-200/40 text-[10px] font-black text-emerald-800 transition-colors"
      >
        {speed}x
      </button>
    </div>
  );
}

const POPULAR_LOCATIONS = [
  'Paris, France',
  'Tokyo, Japan',
  'New York City, USA',
  'London, United Kingdom',
  'Rome, Italy',
  'Sydney, Australia',
  'Bali, Indonesia',
  'Dubai, United Arab Emirates',
  'Los Angeles, California',
  'Toronto, Canada',
  'Central Park, NYC',
  'Eiffel Tower, Paris',
  'Shibuya Crossing, Tokyo',
  'Colosseum, Rome',
  'Times Square, NYC'
];

export default function HomeFeed({ 
  onNavigate, 
  onUserSelected,
  searchQuery = '', 
  profileImg = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=300&h=300',
  userSettings,
  userRole = 'user',
  onUpdateAvatar,
  followingState = {},
  onToggleFollow
}: { 
  onNavigate?: (nav: string) => void, 
  onUserSelected?: (user: any) => void,
  searchQuery?: string,
  profileImg?: string,
  userSettings?: any,
  userRole?: string,
  onUpdateAvatar?: (url: string) => Promise<void> | void,
  followingState?: Record<string, boolean>,
  onToggleFollow?: (userId: string) => void
}) {
  const [appUsers, setAppUsers] = useState<any[]>([]);
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const list: any[] = [];
        const BLACKLIST_EMAILS = [
          '18932572358@imchat.im',
          'cameron89@aol.webstexact-1782132253-1m8faz68@imchat.im',
          'stexact-1782124890-rxh34y95@imchat.im'
        ];
        querySnapshot.forEach((doc) => {
          const data = doc.data() as any;
          const userEmail = (data?.email || '').toLowerCase().trim();
          if (doc.id !== auth.currentUser?.uid && !BLACKLIST_EMAILS.some(b => userEmail === b.toLowerCase())) {
            list.push({ id: doc.id, ...data });
          }
        });
        setAppUsers(list);
      } catch (err) {
        console.warn("Failed to load suggested users from Firestore:", err);
      }
    };
    fetchUsers();
  }, []);

  const DEFAULT_SUGGESTED = COMMUNITY_USERS;

  const finalSuggested = [...appUsers, ...DEFAULT_SUGGESTED]
    .filter((item, index, self) => self.findIndex(t => t.id === item.id) === index);

  const currentUserId = auth.currentUser?.uid || 'anonymous';
  const currentUserName = userSettings?.name || 'User';
  const MY_AVATAR = profileImg;
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [attachedReel, setAttachedReel] = useState<any>(null);
  const [showReelSelector, setShowReelSelector] = useState(false);

  // Instagram Stories State
  const [allStories, setAllStories] = useState<Story[]>([]);
  const [viewingStory, setViewingStory] = useState<Story | null>(null);
  const [isCreatingStory, setIsCreatingStory] = useState(false);

  useEffect(() => {
    const unsub = StoryStore.subscribe((stories) => {
      setAllStories(stories);
    });
    return () => unsub();
  }, []);

  // Smooth Scroll & Auto-Scroll to Top Floating Button
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const el = mainScrollRef.current;
    const handleScroll = () => {
      const scrollPos = el ? el.scrollTop : window.scrollY;
      setShowScrollTop(scrollPos > 320);
    };

    if (el) {
      el.addEventListener('scroll', handleScroll, { passive: true });
    }
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      if (el) {
        el.removeEventListener('scroll', handleScroll);
      }
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleScrollToTop = () => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // Custom Reel Thumbnail & Replacement URL + User Tagging
  const [composeReelThumbnailUrl, setComposeReelThumbnailUrl] = useState<string>('');
  const [taggedUserNames, setTaggedUserNames] = useState<string[]>([]);
  const [showTagSelectorModal, setShowTagSelectorModal] = useState<boolean>(false);
  const [tagUserSearch, setTagUserSearch] = useState<string>('');

  // Mention Autocomplete State
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  // FFmpeg Video Transcoder & Frame Extractor State
  const [showTranscoderModal, setShowTranscoderModal] = useState<boolean>(false);
  const [transcodePreset, setTranscodePreset] = useState<'1080p' | '720p' | '480p' | '360p'>('1080p');
  const [transcodeFormat, setTranscodeFormat] = useState<'mp4' | 'webm' | 'gif'>('mp4');
  const [transcodeFps, setTranscodeFps] = useState<number>(30);
  const [transcodeAudioBitrate, setTranscodeAudioBitrate] = useState<'128k' | '192k' | '320k'>('192k');
  const [transcodeIsProcessing, setTranscodeIsProcessing] = useState<boolean>(false);
  const [transcodeProgress, setTranscodeProgress] = useState<number>(0);
  const [transcodeOutputUrl, setTranscodeOutputUrl] = useState<string | null>(null);
  const [extractedFrameUrl, setExtractedFrameUrl] = useState<string | null>(null);
  const transcoderVideoRef = useRef<HTMLVideoElement | null>(null);
  const isOwner = OWNER_EMAILS.includes(auth.currentUser?.email?.toLowerCase() || '');
  const isModeratorOrAdmin = userRole === 'admin' || userRole === 'moderator' || isOwner;

  const handleStartComposing = () => {
    setIsComposing(true);
  };
  
  // Active Comment Section
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [inlineCommentInputs, setInlineCommentInputs] = useState<Record<string, string>>({});

  const handleQuickSubmitComment = (postId: string) => {
    const text = (inlineCommentInputs[postId] || '').trim();
    if (!text) return;
    PostStore.addComment(postId, {
      authorId: currentUserId,
      authorName: currentUserName,
      avatar: MY_AVATAR,
      text: text
    }).catch(err => console.error("Inline comment submit error:", err));
    setInlineCommentInputs(prev => ({ ...prev, [postId]: '' }));
  };
  
  // Compose modal
  const [isComposing, setIsComposing] = useState(false);
  const [showComposeEmojiPicker, setShowComposeEmojiPicker] = useState(false);
  
  // Edit post state
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editMediaUrl, setEditMediaUrl] = useState<string | null>(null);
  const [editMediaType, setEditMediaType] = useState<'image' | 'video'>('image');
  const [editVisibility, setEditVisibility] = useState<'public' | 'private' | 'friends'>('public');
  const [editLocation, setEditLocation] = useState<string>('');
  const [editLocationSearchQuery, setEditLocationSearchQuery] = useState('');
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const [isDeletionBlocked, setIsDeletionBlocked] = useState(() => {
    const saved = localStorage.getItem('blockDeletion');
    return saved === 'true';
  });

  useEffect(() => {
    const handleToggle = () => {
      const saved = localStorage.getItem('blockDeletion');
      setIsDeletionBlocked(saved === 'true');
    };
    window.addEventListener('block-deletion-change', handleToggle);
    return () => window.removeEventListener('block-deletion-change', handleToggle);
  }, []);

  // Pagination & Lazy Loading State
  const [visiblePostsCount, setVisiblePostsCount] = useState<number>(10);
  const handleLoadMorePosts = () => {
    setVisiblePostsCount(prev => prev + 10);
  };

  // Expanded Inline Comments State (Per post)
  const [expandedCommentsPostIds, setExpandedCommentsPostIds] = useState<Record<string, boolean>>({});

  const toggleExpandComments = (postId: string) => {
    setExpandedCommentsPostIds(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
  };

  const expandAllPostComments = () => {
    setExpandedCommentsPostIds(() => {
      const next: Record<string, boolean> = {};
      posts.forEach(p => {
        if (p.comments && p.comments.length > 0) {
          next[p.id] = true;
        }
      });
      return next;
    });
  };

  // Media Viewer state
  const [viewingMediaUrl, setViewingMediaUrl] = useState<string | null>(null);
  const [viewingMediaType, setViewingMediaType] = useState<'image' | 'video'>('image');
  const [viewingPost, setViewingPost] = useState<Post | null>(null);
  const [showStarPicker, setShowStarPicker] = useState(false);
  const [favouritePop, setFavouritePop] = useState(false);
  const [floatingParticles, setFloatingParticles] = useState<{ id: number; x: number; y: number; type: 'heart' | 'star' }[]>([]);

  const triggerParticles = (type: 'heart' | 'star') => {
    const newParticles = Array.from({ length: 6 }).map((_, i) => ({
      id: Math.random() + i + Date.now(),
      x: (Math.random() - 0.5) * 160,
      y: -50 - Math.random() * 120,
      type
    }));
    setFloatingParticles(prev => [...prev, ...newParticles]);
    setTimeout(() => {
      setFloatingParticles(prev => prev.filter(p => !newParticles.some(np => np.id === p.id)));
    }, 1200);
  };

  // Comment Input
  const [commentInput, setCommentInput] = useState('');
  const [socialSharePost, setSocialSharePost] = useState<Post | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: string, name: string } | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [inlineEditText, setInlineEditText] = useState<string>('');
  const [showStickers, setShowStickers] = useState(false);
  const [customStickers, setCustomStickers] = useState<{url: string, name: string}[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'custom_stickers'),
      (snap) => {
        const list: { url: string; name: string; createdAt?: number }[] = [];
        snap.forEach(doc => {
          const d = doc.data();
          if (d && d.url) {
            list.push({ url: d.url, name: d.name || 'Sticker', createdAt: d.createdAt || 0 });
          }
        });
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setCustomStickers(list);
      },
      async (err) => {
        console.warn("Error listening to custom stickers in HomeFeed, trying getDocs fallback:", err);
        try {
          const snap = await getDocs(collection(db, 'custom_stickers'));
          const list: { url: string; name: string; createdAt?: number }[] = [];
          snap.forEach(doc => {
            const d = doc.data();
            if (d && d.url) {
              list.push({ url: d.url, name: d.name || 'Sticker', createdAt: d.createdAt || 0 });
            }
          });
          list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setCustomStickers(list);
        } catch (fetchErr) {
          console.warn("Error loading custom stickers for HomeFeed comments:", fetchErr);
        }
      }
    );
    return () => unsub();
  }, []);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [commentMediaUrl, setCommentMediaUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Post Options Menu
  const [activePostOptions, setActivePostOptions] = useState<string | null>(null);

  // Translation State
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());

  // Media thumbnail prefetcher logic
  const observerRef = useRef<IntersectionObserver | null>(null);
  const itemsToRenderRef = useRef<any[]>([]);
  const prefetchedUrls = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Setting up the observer for prefetching
    if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      observerRef.current = new IntersectionObserver((entries) => {
        let maxVisibleIndex = -1;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const indexAttr = entry.target.getAttribute('data-index');
            if (indexAttr !== null) {
              const idx = parseInt(indexAttr, 10);
              if (idx > maxVisibleIndex) {
                maxVisibleIndex = idx;
              }
            }
          }
        });

        if (maxVisibleIndex !== -1) {
          const currentItems = itemsToRenderRef.current;
          // Prefetch images and video posters for the next 5 items
          const nextItems = currentItems.slice(maxVisibleIndex + 1, maxVisibleIndex + 6);
          nextItems.forEach((item) => {
            let mediaUrl = '';
            let isVideo = false;

            if (item.type === 'post' && item.data) {
              mediaUrl = item.data.image;
              isVideo = item.data.mediaType === 'video' || 
                (typeof mediaUrl === 'string' && (
                  mediaUrl.includes('.mp4') || 
                  mediaUrl.includes('.webm') || 
                  mediaUrl.includes('.mov') ||
                  mediaUrl.includes('video/')
                ));
            } else if (item.type === 'ad' && item.data) {
              mediaUrl = item.data.image;
            }

            if (mediaUrl && !prefetchedUrls.current.has(mediaUrl)) {
              prefetchedUrls.current.add(mediaUrl);
              if (isVideo) {
                // Link preprefetch strategy for video source
                const link = document.createElement('link');
                link.rel = 'prefetch';
                link.as = 'video';
                link.href = mediaUrl;
                document.head.appendChild(link);
                setTimeout(() => {
                  if (link.parentNode) link.parentNode.removeChild(link);
                }, 10000);
              } else {
                // Create Image buffer to trigger network cache filling
                const img = new Image();
                img.src = mediaUrl;
              }
            }
          });
        }
      }, {
        root: null, // observation target's parent container or viewport
        rootMargin: '100px 0px 450px 0px', // start fetching custom early
        threshold: 0.05
      });
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    const fetchPosts = () => setPosts(PostStore.getPosts());
    fetchPosts();
    const unsubscribe = PostStore.subscribe(fetchPosts);
    return () => unsubscribe();
  }, []);

  const composeFileInputRef = useRef<HTMLInputElement>(null);
  const [composeMediaUrl, setComposeMediaUrl] = useState<string | null>(null);
  const [composeFile, setComposeFile] = useState<File | null>(null);
  const [composeMediaType, setComposeMediaType] = useState<'image' | 'video'>('image');
  const [composeVisibility, setComposeVisibility] = useState<'public' | 'private' | 'friends'>('public');
  const [composeLocation, setComposeLocation] = useState<string>('');
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [showComposeUrlInput, setShowComposeUrlInput] = useState(false);
  const [composeUrlText, setComposeUrlText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [instantUploadStatus, setInstantUploadStatus] = useState<string | null>(null);
  const [remoteMediaUrl, setRemoteMediaUrl] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(() => {
    if (typeof window !== 'undefined') {
      const forced = localStorage.getItem('imchat_force_offline_mode') === 'true';
      return forced || !navigator.onLine;
    }
    return false;
  });

  const [optimisticPosts, setOptimisticPosts] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem('imchat_offline_queued_posts');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map((p: any) => ({
          ...p,
          user: { name: currentUserName || 'You', avatar: MY_AVATAR, location: 'Offline pending sync' },
          userId: currentUserId,
          likes: [],
          favourites: [],
          comments: [],
          isPending: true,
          isOfflinePending: true
        }));
      }
    } catch (e) {}
    return [];
  });

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

  // Sync offline posts on reconnect with per-item resilience
  const handleSyncSingleOfflinePost = async (pendingPost: any) => {
    try {
      await PostStore.addPost({
        user: { name: currentUserName || 'You', avatar: MY_AVATAR, location: 'Just now' },
        userId: currentUserId,
        image: pendingPost.image || '',
        mediaType: pendingPost.mediaType || 'image',
        caption: pendingPost.caption || '',
        visibility: pendingPost.visibility || 'public'
      });
      // Remove from optimistic state
      setOptimisticPosts(prev => prev.filter(p => p.id !== pendingPost.id));
      // Remove from localStorage
      try {
        const stored = localStorage.getItem('imchat_offline_queued_posts');
        if (stored) {
          const parsed = JSON.parse(stored);
          const updated = parsed.filter((p: any) => p.id !== pendingPost.id);
          if (updated.length > 0) {
            localStorage.setItem('imchat_offline_queued_posts', JSON.stringify(updated));
          } else {
            localStorage.removeItem('imchat_offline_queued_posts');
          }
        }
      } catch (e) {}
      alert("Post synced to community feed successfully! ✨");
    } catch (err) {
      console.error("Failed to sync offline post:", err);
      alert("Could not sync post right now. Check internet or tap Discard.");
    }
  };

  const handleSyncAllOfflinePosts = async () => {
    const stored = localStorage.getItem('imchat_offline_queued_posts');
    if (!stored) return;
    try {
      const queued = JSON.parse(stored);
      if (queued.length === 0) return;
      const failed: any[] = [];
      for (const item of queued) {
        try {
          await PostStore.addPost({
            user: { name: currentUserName || 'You', avatar: MY_AVATAR, location: 'Just now' },
            userId: currentUserId,
            image: item.image || '',
            mediaType: item.mediaType || 'image',
            caption: item.caption || '',
            visibility: item.visibility || 'public'
          });
        } catch (itemErr) {
          console.warn("Item sync error:", itemErr);
          failed.push(item);
        }
      }
      if (failed.length > 0) {
        localStorage.setItem('imchat_offline_queued_posts', JSON.stringify(failed));
        alert(`${queued.length - failed.length} posts synced. ${failed.length} failed. You can discard them.`);
      } else {
        localStorage.removeItem('imchat_offline_queued_posts');
        setOptimisticPosts(prev => prev.filter(p => !p.isOfflinePending));
        alert("All queued posts synchronized successfully! 🎉");
      }
    } catch (e) {
      console.warn("Failed sync batch:", e);
    }
  };

  const handleClearAllOfflinePosts = () => {
    try {
      localStorage.removeItem('imchat_offline_queued_posts');
      setOptimisticPosts(prev => prev.filter(p => !p.isOfflinePending));
      alert("Queued offline posts discarded.");
    } catch (e) {
      console.warn("Clear offline posts failed:", e);
    }
  };

  useEffect(() => {
    if (!isOffline) {
      const syncOfflinePosts = async () => {
        const stored = localStorage.getItem('imchat_offline_queued_posts');
        if (!stored) return;
        try {
          const queued = JSON.parse(stored);
          if (queued.length === 0) return;

          console.log("Synchronizing offline posts on reconnect:", queued.length);
          const failedItems: any[] = [];
          for (const item of queued) {
            try {
              await PostStore.addPost({
                user: { name: currentUserName || 'You', avatar: MY_AVATAR, location: 'Just now' },
                userId: currentUserId,
                image: item.image || '',
                mediaType: item.mediaType || 'image',
                caption: item.caption || '',
                visibility: item.visibility || 'public'
              });
            } catch (err) {
              console.warn("Single offline post sync failed:", err);
              failedItems.push(item);
            }
          }
          if (failedItems.length > 0) {
            localStorage.setItem('imchat_offline_queued_posts', JSON.stringify(failedItems));
          } else {
            localStorage.removeItem('imchat_offline_queued_posts');
            setOptimisticPosts(prev => prev.filter(p => !p.isOfflinePending));
          }
        } catch (e) {
          console.warn("Failed to sync offline posts on reconnect:", e);
        }
      };

      syncOfflinePosts();
    }
  }, [isOffline]);
  const [youtubePreviewId, setYoutubePreviewId] = useState<string | null>(null);
  const [playingYoutubeId, setPlayingYoutubeId] = useState<string | null>(null);

  useEffect(() => {
    const ytId = extractYouTubeId(newPostContent);
    setYoutubePreviewId(ytId);
  }, [newPostContent]);

  const extractVideoThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.src = URL.createObjectURL(file);
      video.onloadedmetadata = () => {
        video.currentTime = Math.min(1, video.duration / 2);
        video.onseeked = () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumb = canvas.toDataURL('image/jpeg');
          URL.revokeObjectURL(video.src);
          resolve(thumb);
        };
      };
      video.onerror = () => resolve('');
    });
  };

  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const handleAIImageSuggest = async () => {
    if (!newPostContent.trim()) {
      alert("Please enter some text first so I can generate a relevant image suggestion!");
      return;
    }
    
    setIsGeneratingAI(true);
    try {
      const seed = newPostContent.trim().replace(/\s+/g, '-').substring(0, 20);
      const finalGeneratedUrl = `https://picsum.photos/seed/${seed}/600/600`;
      
      setComposeMediaUrl(finalGeneratedUrl);
      setComposeMediaType('image');
      setComposeFile(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handlePostPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          const localUrl = URL.createObjectURL(file);
          setComposeMediaType('image');
          setComposeMediaUrl(localUrl);
          setComposeFile(file);
          setRemoteMediaUrl(null);

          if (isOffline) {
            setInstantUploadStatus('Saved locally (Offline mode)');
          } else {
            setInstantUploadStatus('Uploading pasted image...');
            try {
              const result = await uploadToCloudinary(file, 'image');
              if (result && result.secure_url) {
                setRemoteMediaUrl(result.secure_url);
                setInstantUploadStatus('Upload complete!');
              } else {
                setInstantUploadStatus('Upload failed');
              }
            } catch (err) {
              console.error("Background paste upload failed:", err);
              setInstantUploadStatus('Upload failed');
            }
          }
          break;
        }
      }
    }
  };

  const handleEditPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          const localUrl = URL.createObjectURL(file);
          setEditMediaType('image');
          setEditMediaUrl(localUrl);
          setEditFile(file);
          if (!isOffline) {
            try {
              const result = await uploadToCloudinary(file, 'image');
              if (result && result.secure_url) {
                setEditMediaUrl(result.secure_url);
              }
            } catch (err) {
              console.error("Edit paste upload failed:", err);
            }
          }
          break;
        }
      }
    }
  };

  const handlePost = async () => {
    if (!newPostContent.trim() && !composeMediaUrl && !youtubePreviewId && !attachedReel) return;
    
    // Create optimistic post
    const tempId = "temp_" + Date.now();
    const optimisticPost = {
      id: tempId,
      user: { name: currentUserName, avatar: MY_AVATAR, location: 'Just now' },
      userId: currentUserId,
      image: composeMediaUrl || (attachedReel ? (attachedReel.thumbnailUrl || '') : (youtubePreviewId ? `https://img.youtube.com/vi/${youtubePreviewId}/maxresdefault.jpg` : '')),
      mediaType: attachedReel ? 'video' as const : composeMediaType,
      caption: newPostContent || ' ',
      visibility: composeVisibility,
      location: composeLocation || undefined,
      timestamp: Date.now(),
      likes: [],
      favourites: [],
      comments: [],
      reelData: attachedReel ? {
        reelId: attachedReel.id,
        videoUrl: attachedReel.videoUrl,
        thumbnailUrl: attachedReel.thumbnailUrl || ''
      } : undefined,
      isPending: true
    };

    setOptimisticPosts(prev => [optimisticPost, ...prev]);
    setIsComposing(false);
    
    const contentToSave = newPostContent;
    const mediaUrlToSave = remoteMediaUrl || composeMediaUrl; // Use remote URL if instant upload finished
    const youtubeIdToSave = youtubePreviewId;
    const fileToSave = composeFile;
    const typeToSave = composeMediaType;
    const visibilityToSave = composeVisibility;
    const locationToSave = composeLocation;
    const reelDataToSave = attachedReel ? {
      reelId: attachedReel.id,
      videoUrl: attachedReel.videoUrl,
      thumbnailUrl: attachedReel.thumbnailUrl || ''
    } : undefined;

    // Reset composer immediately
    setNewPostContent('');
    setComposeMediaUrl(null);
    setComposeFile(null);
    setRemoteMediaUrl(null);
    setInstantUploadStatus(null);
    setComposeVisibility('public');
    setComposeLocation('');
    setShowLocationInput(false);
    setLocationSearchQuery('');
    setComposeUrlText('');
    setShowComposeUrlInput(false);
    setAttachedReel(null);

    try {
      if (isOffline) {
        const offlinePostsKey = 'imchat_offline_queued_posts';
        let existingQueued: any[] = [];
        try {
          const stored = localStorage.getItem(offlinePostsKey);
          if (stored) existingQueued = JSON.parse(stored);
        } catch (e) {}

        const localQueuedPost = {
          image: mediaUrlToSave || (reelDataToSave ? (reelDataToSave.thumbnailUrl || '') : (youtubeIdToSave ? `https://img.youtube.com/vi/${youtubeIdToSave}/maxresdefault.jpg` : `https://picsum.photos/seed/${Date.now()}/600/600`)),
          mediaType: reelDataToSave ? 'video' : typeToSave,
          caption: contentToSave || ' ',
          visibility: visibilityToSave,
          location: locationToSave || undefined,
          reelData: reelDataToSave,
          id: tempId,
          timestamp: Date.now()
        };

        existingQueued.push(localQueuedPost);
        localStorage.setItem(offlinePostsKey, JSON.stringify(existingQueued));

        setOptimisticPosts(prev => prev.map(p => p.id === tempId ? { ...p, isOfflinePending: true } : p));
        console.log("Post successfully queued offline!");
        return;
      }

      let finalMediaUrl = mediaUrlToSave || (youtubeIdToSave ? `https://img.youtube.com/vi/${youtubeIdToSave}/maxresdefault.jpg` : '');

      // If we don't have a remote URL yet and there is a file, upload or fallback
      if (fileToSave && !remoteMediaUrl) {
        try {
          const uploadResult = await uploadToCloudinary(fileToSave, typeToSave);
          if (uploadResult && uploadResult.secure_url) {
            finalMediaUrl = uploadResult.secure_url;
          }
        } catch (upErr) {
          console.warn("Upload notice, using local media preview:", upErr);
          if (composeMediaUrl) finalMediaUrl = composeMediaUrl;
        }
      }
      
      // Save media to personal user storage if there were an uploaded file
      if (fileToSave) {
          try {
             const { MediaStore } = await import('./lib/MediaStorage');
             await MediaStore.addMedia({
               url: finalMediaUrl || composeMediaUrl || '',
               thumbnailUrl: finalMediaUrl || composeMediaUrl || '',
               type: typeToSave,
               sizeBytes: fileToSave.size,
               userId: currentUserId,
               fileObj: fileToSave,
               source: 'upload'
             });
          } catch (e) {
             console.warn("Could not add feed media to personal storage", e);
          }
      }

      await PostStore.addPost({
        user: { name: currentUserName, avatar: MY_AVATAR, location: 'Just now' },
        userId: currentUserId,
        image: reelDataToSave ? (reelDataToSave.thumbnailUrl || '') : finalMediaUrl,
        mediaType: reelDataToSave ? 'video' : typeToSave,
        caption: contentToSave || ' ',
        visibility: visibilityToSave,
        location: locationToSave || undefined,
        reelData: reelDataToSave
      });

      // Clear optimistic post since PostStore has immediately incorporated and broadcasted it
      setOptimisticPosts(prev => prev.filter(p => p.id !== tempId));
    } catch (err) {
      console.error("Post creation error:", err);
      // Ensure optimistic post is cleaned up
      setOptimisticPosts(prev => prev.filter(p => p.id !== tempId));
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const [editFile, setEditFile] = useState<File | null>(null);
  const handleUpdatePost = async () => {
    if (!editingPostId) return;
    
    try {
      let finalMediaUrl = editMediaUrl;
      if (editFile) {
        const uploadResult = await uploadToCloudinary(editFile, editMediaType);
        if (uploadResult && uploadResult.secure_url) {
          finalMediaUrl = uploadResult.secure_url;
        }
      }

      await PostStore.updatePost(editingPostId, {
        caption: editContent || ' ', // Ensure not empty
        image: finalMediaUrl || '',
        mediaType: editMediaType,
        visibility: editVisibility,
        location: editLocation || ''
      });
      
      setEditingPostId(null);
      setEditContent('');
      setEditMediaUrl(null);
      setEditFile(null);
      setEditLocation('');
      setEditLocationSearchQuery('');
    } catch (err) {
      console.error("Post update error:", err);
      alert("Error updating post. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const toggleLike = (id: string) => {
    const post = posts.find(p => p.id === id);
    const isLikedByMe = post?.likes.includes(currentUserName);
    if (isLikedByMe && isDeletionBlocked) {
      alert("Removing likes is blocked by system policy.");
      return;
    }
    PostStore.toggleLike(id, currentUserName).catch(err => {
      console.error("Like failure:", err);
    });
  };
  const toggleFavourite = (id: string) => {
    PostStore.toggleFavourite(id, currentUserName).catch(err => {
      console.error("Favourite failure:", err);
    });
  };
  const handleRatePost = (id: string, score: number) => {
    const userKey = currentUserName || currentUserId || 'User';
    PostStore.setRating(id, userKey, score).catch(err => {
      console.error("Rating failure:", err);
    });
  };
  const toggleSave = (id: string) => {
    PostStore.toggleSave(id).catch(err => {
      console.error("Save failure:", err);
    });
  };
  const handleDeletePost = (id: string) => {
    if (isOwner || confirm('Delete this post?')) {
      // Clean up optimistic state
      setOptimisticPosts(prev => prev.filter(p => p.id !== id));
      
      // Clean up local storage queued posts
      try {
        const stored = localStorage.getItem('imchat_offline_queued_posts');
        if (stored) {
          const parsed = JSON.parse(stored);
          const updated = parsed.filter((p: any) => p.id !== id);
          if (updated.length > 0) {
            localStorage.setItem('imchat_offline_queued_posts', JSON.stringify(updated));
          } else {
            localStorage.removeItem('imchat_offline_queued_posts');
          }
        }
      } catch (e) {
        console.warn("Storage cleanup failed on delete post:", e);
      }

      PostStore.deletePost(id).catch(err => {
        console.error("Delete failure:", err);
      });
    }
    setActivePostOptions(null);
  };
  const handleReportPost = () => { alert('Post reported successfully to admins.'); setActivePostOptions(null); };

  const handleDownload = (url: string) => {
    alert('Media downloading initialized...');
  };

  const handleShare = (post?: Post) => {
    if (post) {
      setSocialSharePost(post);
    } else if (viewingPost) {
      setSocialSharePost(viewingPost);
    } else {
      setSocialSharePost({
        id: 'feed_share_' + Date.now(),
        userId: currentUserId,
        user: { name: currentUserName, avatar: '', location: '' },
        image: '',
        mediaUrl: window.location.href,
        mediaType: 'image',
        caption: 'Check out IMChat News Feed!',
        timestamp: Date.now(),
        isSaved: false,
        likes: [],
        favourites: [],
        comments: []
      });
    }
  };

  const shareToXTwitter = (post?: Post) => {
    const target = post || viewingPost || null;
    const text = target?.caption || 'Check out this post on IMChat!';
    const mediaUrl = target?.mediaUrl || target?.image || window.location.href;
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(mediaUrl)}`;
    window.open(tweetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleTranslate = async (postId: string, text: string) => {
    if (translatingIds.has(postId)) return;
    
    setTranslatingIds(prev => new Set(prev).add(postId));
    try {
      const translated = await geminiService.translateText(text);
      setTranslations(prev => ({ ...prev, [postId]: translated }));
    } catch (err) {
      console.error(err);
    } finally {
      setTranslatingIds(prev => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  };

  // Comments Logic
  const handleStartEditComment = (comment: PostComment) => {
    setEditingCommentId(comment.id);
    setInlineEditText(comment.text);
    setCommentInput(comment.text);
    setReplyingTo(null);
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setInlineEditText('');
    setCommentInput('');
  };

  const handleSaveInlineEditComment = async (postId: string, commentId: string) => {
    if (!inlineEditText.trim()) return;
    try {
      await PostStore.editComment(postId, commentId, inlineEditText.trim());
      setEditingCommentId(null);
      setInlineEditText('');
      setCommentInput('');
    } catch (err) {
      console.error("Edit comment failure:", err);
      alert("No se pudo editar el comentario.");
    }
  };

  const handleSendComment = (mediaUrl?: string) => {
    const finalMediaUrl = typeof mediaUrl === 'string' ? mediaUrl : commentMediaUrl;
    if (!commentInput.trim() && !finalMediaUrl) return;
    const postId = activeCommentPostId;
    if (!postId) return;

    if (editingCommentId) {
      PostStore.editComment(postId, editingCommentId, commentInput.trim()).catch(err => console.error("Edit comment fail:", err));
      setEditingCommentId(null);
      setInlineEditText('');
      setCommentInput('');
      setCommentMediaUrl(null);
      return;
    }

    PostStore.addComment(postId, {
      authorId: currentUserId,
      authorName: currentUserName,
      avatar: MY_AVATAR,
      text: commentInput.trim(),
      replyToId: replyingTo?.id,
      mediaUrl: finalMediaUrl || undefined
    }).catch(err => console.error("Add comment fail:", err));
    
    setCommentInput('');
    setReplyingTo(null);
    setShowStickers(false);
    setCommentMediaUrl(null);
  };

  const handleDeleteComment = (postId: string, commentId: string) => {
    if (isDeletionBlocked) {
      alert("Comment deletion is blocked by system policy.");
      return;
    }
    PostStore.deleteComment(postId, commentId).catch(err => console.error("Delete comment fail:", err));
  };

  const handleReactionComment = (postId: string, commentId: string) => {
    PostStore.reactToComment(postId, commentId, currentUserName).catch(err => console.error("React comment fail:", err));
  };

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 1000) return 'Just now';
    const min = Math.floor(diff / 60000);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    return `${Math.floor(hr / 24)}d`;
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setCommentInput(prev => prev + emojiData.emoji);
  };

  const onComposeEmojiClick = (emojiData: EmojiClickData) => {
    setNewPostContent(prev => prev + emojiData.emoji);
  };

  const renderCommentsSheet = () => {
    if (!activeCommentPostId) return null;
    const post = posts.find(p => p.id === activeCommentPostId);
    if (!post) return null;

    const closeSheet = () => {
      setActiveCommentPostId(null);
      setReplyingTo(null);
      setEditingCommentId(null);
    };

    return (
      <>
        {/* Animated backdrop with subtle blur */}
        <motion.div
          key="comments-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          onClick={closeSheet}
          className="fixed inset-0 z-[145] bg-black/50 backdrop-blur-sm cursor-pointer"
        />

        {/* Animated comment sheet drawer */}
        <motion.div 
          key="comments-sheet-drawer"
          initial={{ y: '100%', opacity: 0.6 }} 
          animate={{ y: 0, opacity: 1 }} 
          exit={{ y: '100%', opacity: 0 }} 
          transition={{ type: 'spring', damping: 28, stiffness: 300, mass: 0.85 }} 
          className="fixed inset-x-0 bottom-0 top-14 sm:top-20 z-[150] bg-white flex flex-col sm:max-w-[480px] sm:mx-auto sm:rounded-t-3xl shadow-2xl border-t border-gray-200 overflow-hidden"
        >
          {/* Subtle swipe/drag bar indicator */}
          <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mt-2.5 mb-1 shrink-0 select-none" />

          <header className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between bg-white text-gray-900 sticky top-0">
             <div className="flex items-center gap-2">
               <h3 className="font-bold text-base sm:text-lg">Comments</h3>
               {post.comments && post.comments.length > 0 && (
                 <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                   {post.comments.length}
                 </span>
               )}
             </div>
             <button 
               onClick={closeSheet} 
               className="p-1.5 hover:bg-gray-100 text-gray-500 hover:text-gray-900 rounded-full transition-colors cursor-pointer"
             >
               <X className="w-5 h-5"/>
             </button>
          </header>
        
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
           {/* Original Post context chunk */}
           <div className="flex gap-3 border-b border-gray-50 pb-4">
               <UserAvatar 
                 src={post.userId === currentUserId ? MY_AVATAR : post.user.avatar} 
                 name={post.user.name}
                 size="md"
                 className="shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                 onClick={() => {
                   if (post.user.name === currentUserName) {
                     onNavigate?.('profile');
                   } else if (onUserSelected) {
                     onUserSelected({
                       id: post.userId || post.user.name.toLowerCase().replace(/\s+/g, '-'),
                       name: post.user.name,
                       avatar: post.user.avatar,
                       isVerified: post.user.isVerified
                     });
                   }
                   setActiveCommentPostId(null);
                 }}
               />
              <div>
                <span 
                  className="font-bold text-sm mr-2 cursor-pointer hover:underline"
                  onClick={() => {
                    if (post.user.name === currentUserName) {
                      onNavigate?.('profile');
                    } else if (onUserSelected) {
                      onUserSelected({
                        id: post.userId || post.user.name.toLowerCase().replace(/\s+/g, '-'),
                        name: post.user.name,
                        avatar: post.user.avatar,
                        isVerified: post.user.isVerified
                      });
                    }
                    setActiveCommentPostId(null);
                  }}
                >
                  {post.user.name}
                </span>
                <span className="text-sm">{renderTextWithMentions(post.caption)}</span>
                <div className="text-xs text-gray-400 mt-1">{formatTime(post.timestamp)}</div>
              </div>
           </div>

           {post.comments.length === 0 && <div className="text-center text-gray-400 py-10 font-bold text-slate-400">No comments yet! Be the first to reply or like.</div>}

           {(() => {
             // Group comments into root comments and their replies
             const commentsMap: Record<string, PostComment[]> = {};
             const rootComments: PostComment[] = [];
             const orphanComments: PostComment[] = [];

             // First pass: identify root comments and initialize map
             post.comments.forEach(c => {
               if (!c.replyToId) {
                 rootComments.push(c);
                 commentsMap[c.id] = [];
               }
             });

             // Second pass: attach child comments to their roots, or save as orphans if parent is missing
             post.comments.forEach(c => {
               if (c.replyToId) {
                 if (commentsMap[c.replyToId]) {
                   commentsMap[c.replyToId].push(c);
                 } else {
                   // Try to find if parent is also a reply, attach to its root
                   const parent = post.comments.find(p => p.id === c.replyToId);
                   if (parent && parent.replyToId && commentsMap[parent.replyToId]) {
                     commentsMap[parent.replyToId].push(c);
                   } else {
                     orphanComments.push(c);
                   }
                 }
               }
             });

             const allRoots = [...rootComments, ...orphanComments];

             // Let's define a helper to render a single comment card
             const renderCommentCard = (c: PostComment, isReply: boolean = false) => {
               const hasLiked = c.reactions && c.reactions.includes(currentUserName);
               const reactionsCount = c.reactions ? c.reactions.length : 0;
               const isMyComment = (c.authorId && c.authorId === currentUserId) || (c.authorName && c.authorName === currentUserName) || isOwner;
               const isCurrentlyEditingThis = editingCommentId === c.id;

               return (
                 <div key={c.id} className={`flex gap-3 text-gray-900 group/item ${isReply ? "mt-3 pl-8 border-l-2 border-slate-100/80 ml-4 relative" : "mt-4"}`}>
                   {isReply && (
                     <span className="absolute left-0 top-3.5 w-3.5 h-0.5 bg-slate-100" />
                   )}
                   <UserAvatar 
                     src={c.authorId === currentUserId ? MY_AVATAR : c.avatar} 
                     name={c.authorName}
                     size={isReply ? "xs" : "sm"}
                     className="shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                     onClick={() => {
                       if (c.authorId === currentUserId) {
                         onNavigate?.("profile");
                       } else if (onUserSelected) {
                         onUserSelected({
                           id: c.authorId,
                           name: c.authorName,
                           avatar: c.avatar
                         });
                       }
                       setActiveCommentPostId(null);
                     }}
                   />
                   <div className="flex flex-col flex-1 min-w-0">
                     <div className="flex items-start justify-between gap-1.5 font-bold"> {/* Context header */} </div>
                     <div className="flex items-start justify-between gap-1.5">
                       {isCurrentlyEditingThis ? (
                         <div className="bg-blue-50/95 border border-blue-200 p-3 rounded-2xl rounded-tl-sm flex flex-col gap-2 w-full max-w-[95%] shadow-sm">
                           <div className="flex items-center justify-between">
                             <span className="text-[11px] font-bold text-blue-700 flex items-center gap-1.5">
                               <Edit2 className="w-3.5 h-3.5" /> Re-editing Comment
                             </span>
                             <button 
                               onClick={handleCancelEditComment}
                               className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-blue-100 transition-colors cursor-pointer"
                               title="Cancel edit"
                             >
                               <X className="w-3.5 h-3.5" />
                             </button>
                           </div>
                           <textarea
                             value={inlineEditText}
                             onChange={(e) => setInlineEditText(e.target.value)}
                             onKeyDown={(e) => {
                               if (e.key === "Enter" && !e.shiftKey) {
                                 e.preventDefault();
                                 handleSaveInlineEditComment(post.id, c.id);
                               } else if (e.key === "Escape") {
                                 handleCancelEditComment();
                               }
                             }}
                             autoFocus
                             className="w-full text-sm p-2.5 bg-white border border-blue-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-400 resize-none min-h-[64px]"
                             placeholder="Edit your comment (Enter to save, Esc to cancel)..."
                           />
                           <div className="flex items-center justify-end gap-2">
                             <button
                               onClick={handleCancelEditComment}
                               className="px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-200/60 rounded-md transition-colors cursor-pointer"
                             >
                               Cancel
                             </button>
                             <button
                               onClick={() => handleSaveInlineEditComment(post.id, c.id)}
                               disabled={!inlineEditText.trim()}
                               className="px-3.5 py-1 bg-brand-blue hover:bg-blue-600 text-white text-xs font-bold rounded-md active:scale-95 transition-all flex items-center gap-1 disabled:opacity-50 shadow-sm cursor-pointer"
                             >
                               <Check className="w-3.5 h-3.5" /> Save
                             </button>
                           </div>
                         </div>
                       ) : (
                         <div 
                           onDoubleClick={() => handleReactionComment(post.id, c.id)}
                           className="bg-gray-100 px-3 py-2 rounded-2xl rounded-tl-sm flex flex-col max-w-[85%] relative group/bubble select-none cursor-pointer hover:bg-gray-200/60 transition-colors"
                           title="Doble clic para encantar con ❤️"
                         >
                            <span 
                              className="font-bold text-xs cursor-pointer hover:underline flex items-center gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (c.authorId === currentUserId) {
                                  onNavigate?.("profile");
                                } else if (onUserSelected) {
                                  onUserSelected({
                                    id: c.authorId,
                                    name: c.authorName,
                                    avatar: c.avatar,
                                    isVerified: PostStore.isAllVerified() || c.authorId === currentUserId
                                  });
                                }
                                setActiveCommentPostId(null);
                              }}
                            >
                              {c.authorName}
                              {(PostStore.isAllVerified() || c.authorId === currentUserId) && (
                                <BadgeCheck className="w-3 h-3 text-white fill-[#0095f6] shrink-0" />
                              )}
                            </span>
                            {c.replyToId && (
                              <span className="text-[10px] text-brand-blue font-bold tracking-tight mb-1">Replying...</span>
                            )}
                            {c.text && (
                              <div>
                                <p className="text-sm break-words">
                                  {translations[`comm_${c.id}`] ? translations[`comm_${c.id}`] : renderTextWithMentions(c.text)}
                                </p>
                                {c.text.length > 5 && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (translations[`comm_${c.id}`]) {
                                        setTranslations(prev => {
                                          const next = { ...prev };
                                          delete next[`comm_${c.id}`];
                                          return next;
                                        });
                                      } else {
                                        handleTranslate(`comm_${c.id}`, c.text);
                                      }
                                    }}
                                    className="text-[10px] font-bold text-gray-500 hover:text-brand-blue transition-colors mt-1 active:scale-95 flex items-center gap-1"
                                  >
                                    {translatingIds.has(`comm_${c.id}`) ? (
                                      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                    ) : (
                                      <Globe className="w-2.5 h-2.5" />
                                    )}
                                    {translatingIds.has(`comm_${c.id}`) ? "Translating..." : (translations[`comm_${c.id}`] ? "See Original" : "Translate")}
                                  </button>
                                )}
                              </div>
                            )}
                            {c.mediaUrl && (
                              <div className="mt-2 relative rounded-2xl overflow-hidden max-w-[220px] bg-transparent">
                                <img 
                                  src={c.mediaUrl} 
                                  referrerPolicy="no-referrer"
                                  className="max-h-48 w-auto object-contain rounded-xl cursor-pointer hover:opacity-95 transition-opacity" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(c.mediaUrl, "_blank");
                                  }}
                                  alt="Comment attachment" 
                                />
                              </div>
                            )}
                            {c.audioUrl && (
                              <VoiceMessagePlayer url={c.audioUrl} duration={c.audioDuration} />
                            )}
                            
                            {/* Reaction Bubble floating */}
                            {reactionsCount > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReactionComment(post.id, c.id);
                                }}
                                className="absolute -bottom-2.5 right-1 text-red-500 bg-white shadow-md border border-slate-150 rounded-full px-1.5 py-0.5 flex gap-1 items-center z-10 text-[10px] select-none hover:scale-110 active:scale-95 transition-all font-black animate-bounce-short"
                                title={`Reaccionado por: ${c.reactions.join(", ")}`}
                              >
                                <span>❤️</span>
                                <span className="text-gray-700 text-[10px] font-extrabold">{reactionsCount}</span>
                              </button>
                            )}
                         </div>
                       )}
                       
                       {/* Context Menu for comment (Right side) */}
                       <div className="flex flex-col gap-1 items-center">
                         <button 
                           onClick={() => handleReactionComment(post.id, c.id)} 
                           className="text-gray-450 hover:text-red-500 p-1.5 rounded-full hover:bg-gray-50 transition-all duration-300 active:scale-125 hover:rotate-12 cursor-pointer"
                           title={reactionsCount > 0 ? `Reaccionado por: ${c.reactions.join(", ")}` : "Reaccionar con ❤️"}
                         >
                           <Heart className={`w-4 h-4 transition-all duration-300 ${hasLiked ? "fill-red-500 text-red-500 scale-125" : ""}`} />
                         </button>
                         {isMyComment && !isCurrentlyEditingThis && (
                           <div className="flex items-center gap-0.5 opacity-80 group-hover/item:opacity-100 transition-opacity">
                             <button 
                               onClick={() => handleStartEditComment(c)} 
                               className="text-gray-400 hover:text-blue-600 p-1 hover:bg-blue-50 rounded-full transition-all active:scale-90 cursor-pointer" 
                               title="Re-edit comment"
                             >
                               <Edit2 className="w-3.5 h-3.5"/>
                             </button>
                             <button 
                               onClick={() => {
                                 if (confirm("Are you sure you want to delete this comment?")) {
                                   handleDeleteComment(post.id, c.id);
                                 }
                               }} 
                               className={`text-gray-400 hover:text-red-600 p-1 hover:bg-red-50 rounded-full transition-all active:scale-90 cursor-pointer delete-btn ${isDeletionBlocked ? "disabled opacity-50 cursor-not-allowed" : ""}`}
                               disabled={isDeletionBlocked}
                               title={isDeletionBlocked ? "Deletion blocked" : "Delete comment"}
                             >
                               <Trash2 className="w-3.5 h-3.5"/>
                             </button>
                           </div>
                         )}
                       </div>
                     </div>

                     {/* Actions under bubble */}
                     {!isCurrentlyEditingThis && (
                       <div className="flex items-center gap-3.5 text-xs font-bold text-gray-500 mt-1 ml-2 select-none flex-wrap">
                         <span>{formatTime(c.timestamp)}</span>
                         <button 
                           onClick={() => handleReactionComment(post.id, c.id)}
                           className={`hover:text-red-500 text-[11px] font-black flex items-center gap-1 transition-colors active:scale-90 ${hasLiked ? "text-red-500" : "text-gray-400"}`}
                           title={reactionsCount > 0 ? `Reaccionado por: ${c.reactions.join(", ")}` : "Encantar comentario"}
                         >
                           <span>❤️</span>
                           <span>{hasLiked ? "Me gusta" : "React"}</span>
                         </button>
                         <button onClick={() => setReplyingTo({ id: c.id, name: c.authorName })} className="hover:text-blue-500 text-[11px] font-black uppercase text-gray-400 cursor-pointer">Reply</button>
                         
                         {isMyComment && (
                           <>
                             <button 
                               onClick={() => handleStartEditComment(c)} 
                               className="hover:text-blue-600 text-[11px] font-bold text-blue-500 flex items-center gap-1 transition-colors active:scale-95 cursor-pointer"
                               title="Re-edit this comment"
                             >
                               <Edit2 className="w-3 h-3"/>
                               <span>Re-edit</span>
                             </button>
                             <button 
                               onClick={() => {
                                 if (confirm("Are you sure you want to delete this comment?")) {
                                   handleDeleteComment(post.id, c.id);
                                 }
                               }} 
                               className={`hover:text-red-600 text-[11px] font-bold text-red-500 flex items-center gap-1 transition-colors active:scale-95 cursor-pointer delete-btn ${isDeletionBlocked ? "disabled opacity-50 cursor-not-allowed" : ""}`}
                               disabled={isDeletionBlocked}
                               title={isDeletionBlocked ? "Deletion blocked" : "Delete comment"}
                             >
                               <Trash2 className="w-3 h-3"/>
                               <span>Delete</span>
                             </button>
                           </>
                         )}

                         {c.isEdited && <span className="text-[10px] text-gray-400 font-medium italic">(Edited)</span>}
                       </div>
                     )}
                   </div>
                 </div>
               );
             };

             return (
               <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                 {allRoots.map(root => (
                   <div key={root.id} className="border-b border-gray-100/40 pb-3">
                     {/* Render root level comment */}
                     {renderCommentCard(root, false)}

                     {/* Render nested direct replies */}
                     {(commentsMap[root.id] || []).map(reply => (
                       renderCommentCard(reply, true)
                     ))}
                   </div>
                 ))}
               </div>
             );
           })()}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 bg-white">
          <AnimatePresence>
            {editingCommentId && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center justify-between text-xs font-bold text-blue-700 overflow-hidden">
                <span className="flex items-center gap-1.5">
                  <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                  Editing your comment... (Press Enter to save)
                </span>
                <button onClick={handleCancelEditComment} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-blue-100 rounded-full transition-colors cursor-pointer" title="Cancel edit">
                  <X className="w-3.5 h-3.5"/>
                </button>
              </motion.div>
            )}
            {replyingTo && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="bg-gray-100 px-4 py-2 flex items-center justify-between text-sm overflow-hidden">
                <span className="text-gray-600">Replying to <span className="font-bold">{replyingTo.name}</span></span>
                <button onClick={() => setReplyingTo(null)} className="text-gray-500"><X className="w-4 h-4"/></button>
              </motion.div>
            )}
            {showStickers && (
              <motion.div initial={{ height: 0 }} animate={{ height: 220 }} exit={{ height: 0 }} className="bg-slate-50 border-b border-gray-200 p-3 overflow-y-auto w-full space-y-3">
                {customStickers.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-black text-brand-blue uppercase tracking-wider flex items-center gap-1">
                        ✨ Admin Stickers ({customStickers.length})
                      </span>
                      <span className="text-[10px] text-gray-400 font-bold">Tap to send</span>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {customStickers.map((s, i) => (
                        <div 
                          key={`custom-${i}`} 
                          onClick={() => handleSendComment(s.url)}
                          className="aspect-square bg-white border border-gray-200 hover:border-brand-blue rounded-xl p-1.5 flex flex-col items-center justify-center cursor-pointer hover:shadow-sm transition-all hover:scale-105 active:scale-95 group relative"
                          title={s.name}
                        >
                          <img 
                            src={s.url} 
                            alt={s.name} 
                            referrerPolicy="no-referrer"
                            className="max-w-full max-h-full object-contain" 
                          />
                          <span className="text-[9px] font-bold text-gray-500 truncate w-full text-center mt-0.5 group-hover:text-brand-blue">
                            {s.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black text-gray-600 uppercase tracking-wider">
                      Sticker & Emoji Pack
                    </span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {MOCK_STICKERS.map((s, i) => (
                      <div
                        key={`mock-${i}`}
                        onClick={() => handleSendComment(s)}
                        className="aspect-square bg-white border border-gray-100 hover:border-gray-300 rounded-xl p-2 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-all hover:scale-105 active:scale-95"
                      >
                        <img 
                          src={s} 
                          alt="Sticker" 
                          referrerPolicy="no-referrer"
                          className="max-w-full max-h-full object-contain" 
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {commentMediaUrl && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 100, opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-start gap-2 relative">
                <img src={commentMediaUrl} className="h-20 object-contain rounded-lg border border-gray-200 bg-white" />
                <button onClick={() => setCommentMediaUrl(null)} className="absolute top-1 right-2 p-1 bg-gray-800/50 hover:bg-gray-800 text-white rounded-full shadow-md transition-colors"><X className="w-3 h-3"/></button>
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="p-3 flex items-center gap-2 relative">
            <button onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowStickers(false); }} className="text-brand-blue p-2 hover:bg-blue-50 rounded-full transition-colors shrink-0">
              <Smile className="w-6 h-6 text-yellow-500" />
            </button>
            <button onClick={() => { setShowStickers(!showStickers); setShowEmojiPicker(false); }} className="text-brand-blue p-2 hover:bg-blue-50 rounded-full transition-colors shrink-0">
              <GiphyIcon className="w-6 h-6" />
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-full left-0 z-[200] mb-2 shadow-xl rounded-xl overflow-hidden">
                <EmojiPicker 
                  onEmojiClick={onEmojiClick} 
                  autoFocusSearch={false} 
                  theme={Theme.LIGHT}
                  width={300}
                  height={400}
                />
              </div>
            )}
            <button onClick={() => fileInputRef.current?.click()} className="text-brand-blue p-2 hover:bg-blue-50 rounded-full transition-colors shrink-0" title="Upload photo from device">
              <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setCommentMediaUrl(URL.createObjectURL(file));
                }
              }} 
            />

            <div className="flex-1 bg-gray-100 rounded-full px-4 py-2 flex items-center">
              <input 
                type="text" 
                value={commentInput}
                onChange={e => setCommentInput(e.target.value)}
                placeholder={editingCommentId ? "Edit comment..." : "Write a comment..."}
                className="bg-transparent outline-none w-full text-sm"
                onKeyDown={e => {
                   if (e.key === 'Enter') handleSendComment();
                }}
              />
            </div>
            <button 
              onClick={() => handleSendComment()} 
              disabled={!commentInput.trim() && !commentMediaUrl}
              className="text-brand-blue p-2 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50 cursor-pointer"
              title={editingCommentId ? "Save edited comment" : "Send comment"}
            >
              {editingCommentId ? (
                <Check className="w-5 h-5 sm:w-6 sm:h-6 text-brand-blue" />
              ) : (
                <Send className="w-5 h-5 sm:w-6 sm:h-6" />
              )}
            </button>
          </div>
        </div>
      </motion.div>
      </>
    );
  };

  const filteredPosts = posts.filter(p => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    
    if (q.startsWith('#')) {
      const words = p.caption.toLowerCase().split(/\s+/);
      return words.some(w => w === q || (w.startsWith('#') && w.includes(q.substring(1))));
    }
    
    return (
      p.caption.toLowerCase().includes(q) || 
      p.user.name.toLowerCase().includes(q) ||
      p.comments.some(c => c.text.toLowerCase().includes(q))
    );
  });

  return (
    <main ref={mainScrollRef} className="flex-1 overflow-y-auto pb-20 bg-gray-50 flex flex-col scroll-smooth relative">
      <div className="flex flex-col">
        {/* Instagram Stories Tray at top of Home Feed */}
        <InstagramStoriesTray
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          currentUserAvatar={MY_AVATAR}
          onOpenStory={(story) => setViewingStory(story)}
          onCreateStory={() => setIsCreatingStory(true)}
          onGoLive={() => onNavigate?.('live')}
        />

        {/* Compose Post - Facebook Style */}
        <div className="bg-white p-3 sm:p-4 border-b border-gray-200 sm:rounded-xl sm:mx-2 sm:my-3 sm:shadow-sm">
          <div className="flex gap-2 sm:gap-3 items-center">
            <UserAvatar 
              src={MY_AVATAR} 
              name={currentUserName}
              size="md"
              className="border border-gray-100 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => onNavigate?.('profile')}
            />
            <div 
              onClick={() => setIsComposing(true)}
              className="flex-1 bg-gray-100 hover:bg-gray-200 transition-colors rounded-full px-4 py-2.5 cursor-pointer text-gray-500 text-[15px]"
            >
              What's on your mind, {currentUserName}?
            </div>
          </div>
          <div className="border-t border-gray-200 mt-3 pt-3 flex items-center justify-between sm:justify-around px-1">
            <button 
              onClick={() => setIsComposing(true)}
              className="flex-1 flex items-center justify-center gap-2 text-gray-600 hover:bg-gray-100 py-2 rounded-lg transition-colors font-medium text-sm"
            >
              <Video className="w-5 h-5 text-red-500" />
              <span className="hidden xs:inline">Live video</span>
            </button>
            <button 
              onClick={() => setIsComposing(true)}
              className="flex-1 flex items-center justify-center gap-2 text-gray-600 hover:bg-gray-100 py-2 rounded-lg transition-colors font-medium text-sm"
            >
              <ImageIcon className="w-5 h-5 text-green-500" />
              <span className="hidden xs:inline">Photo/video</span>
            </button>
            <button 
              onClick={() => setIsComposing(true)}
              className="flex-1 flex items-center justify-center gap-2 text-gray-600 hover:bg-gray-100 py-2 rounded-lg transition-colors font-medium text-sm"
            >
              <GiphyIcon className="w-5 h-5" />
              <span className="hidden xs:inline">Feeling/activity</span>
            </button>
          </div>
        </div>

        {/* Search Results Summary if query exists */}
        {searchQuery && (
          <div className="px-4 py-3 bg-white border-b border-gray-100 mb-2">
            <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <Search className="w-3 h-3 text-brand-blue" />
              Search results for "{searchQuery}" • {filteredPosts.length} posts
            </p>
          </div>
        )}

        {/* Facebook Style Compose Modal */}
        <AnimatePresence>
          {isComposing && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white w-full max-w-lg rounded-xl shadow-2xl flex flex-col max-h-[90vh]"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 relative">
                  <div className="flex-1"></div>
                  <h2 className="font-bold text-xl text-gray-900 text-center flex-1">Create post</h2>
                  <div className="flex-1 flex justify-end">
                    <button 
                      onClick={() => setIsComposing(false)}
                      className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </div>

                {/* Modal Body */}
                <div className="p-4 flex-1 overflow-y-auto">
                  {/* User info & privacy */}
                  <div className="flex items-center gap-3 mb-4">
                    <img src={MY_AVATAR} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                    <div>
                      <div className="font-semibold text-gray-900 text-[15px]">{currentUserName}</div>
                      <div className="flex gap-2 items-center flex-wrap">
                        <select 
                          value={composeVisibility}
                          onChange={(e) => setComposeVisibility(e.target.value as any)}
                          className="flex items-center gap-1 mt-0.5 bg-gray-200 hover:bg-gray-300 transition-colors rounded-md px-2 py-0.5 text-xs font-semibold text-gray-800 outline-none cursor-pointer"
                        >
                          <option value="public">🌐 Public</option>
                          <option value="friends">👥 Friends</option>
                          <option value="private">🔒 Only Me</option>
                        </select>
                        {composeLocation && (
                          <span className="flex items-center gap-0.5 mt-0.5 bg-blue-50 border border-blue-100 rounded-md px-2 py-0.5 text-[11px] font-semibold text-brand-blue">
                            <MapPin className="w-3 h-3 text-red-500 fill-red-500 shrink-0" />
                            <span>at {composeLocation}</span>
                            <button
                              type="button"
                              onClick={() => setComposeLocation('')}
                              className="ml-1 text-gray-400 hover:text-gray-600 focus:outline-none"
                              title="Remove location"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Input area with @mention autocomplete */}
                  <div className="relative">
                    <textarea
                      autoFocus
                      value={newPostContent}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewPostContent(val);
                        const cursorPos = e.target.selectionStart;
                        const textBeforeCursor = val.slice(0, cursorPos);
                        const words = textBeforeCursor.split(/\s+/);
                        const lastWord = words[words.length - 1];
                        if (lastWord && lastWord.startsWith('@')) {
                          setMentionQuery(lastWord.slice(1).toLowerCase());
                        } else {
                          setMentionQuery(null);
                        }
                      }}
                      onPaste={handlePostPaste}
                      placeholder={`What's on your mind, ${currentUserName}? (Type @ to mention friends)`}
                      className="w-full text-2xl text-gray-900 placeholder-gray-500 bg-transparent border-none outline-none resize-none min-h-[120px]"
                    />

                    {/* @Mention Autocomplete Dropdown Menu */}
                    {mentionQuery !== null && (
                      <div className="absolute left-0 top-full z-50 bg-white border border-gray-200 rounded-2xl shadow-xl max-h-48 overflow-y-auto w-64 p-1.5 my-1">
                        <div className="px-2 py-1 text-[10px] font-black uppercase text-gray-400 border-b border-gray-100">
                          Mention Users (@)
                        </div>
                        {finalSuggested
                          .filter(u => u.name.toLowerCase().includes(mentionQuery) || (u.id || '').toLowerCase().includes(mentionQuery))
                          .slice(0, 5)
                          .map(u => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                const words = newPostContent.split(/\s+/);
                                for (let i = words.length - 1; i >= 0; i--) {
                                  if (words[i].startsWith('@')) {
                                    words[i] = `@${u.name.replace(/\s+/g, '_')}`;
                                    break;
                                  }
                                }
                                setNewPostContent(words.join(' ') + ' ');
                                setMentionQuery(null);
                              }}
                              className="w-full text-left px-2.5 py-1.5 hover:bg-indigo-50 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
                            >
                              <UserAvatar src={u.avatar} name={u.name} size="xs" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-900 truncate">{u.name}</p>
                                <p className="text-[10px] text-gray-400 truncate">@{u.id}</p>
                              </div>
                            </button>
                          ))}
                        {finalSuggested.filter(u => u.name.toLowerCase().includes(mentionQuery) || (u.id || '').toLowerCase().includes(mentionQuery)).length === 0 && (
                          <div className="p-3 text-xs text-gray-400 text-center font-medium">No matching users found</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Inline URL Paste Input */}
                  {showComposeUrlInput && (
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-4 mb-4 flex flex-col gap-2.5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-indigo-900 flex items-center gap-1.5">
                          <Link2 className="w-4 h-4 text-indigo-600" />
                          Instant Media URL Upload
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setComposeUrlText('');
                            setComposeMediaUrl(null);
                          }}
                          className="text-xs text-indigo-500 hover:text-indigo-700 font-extrabold transition-colors cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="url"
                          value={composeUrlText}
                          onChange={(e) => {
                            const val = e.target.value.trim();
                            setComposeUrlText(val);
                            if (val) {
                              const lower = val.toLowerCase();
                              const isVideo = lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm') || lower.endsWith('.m3u8') || lower.includes('video');
                              setComposeMediaType(isVideo ? 'video' : 'image');
                              setComposeMediaUrl(val);
                              // Reset file upload state
                              setComposeFile(null);
                              setRemoteMediaUrl(null);
                            } else {
                              setComposeMediaUrl(null);
                            }
                          }}
                          placeholder="Paste a direct photo or video link... (e.g. Unsplash or direct web URL)"
                          className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400 font-semibold"
                        />
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setComposeMediaType('image')}
                            className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-extrabold rounded-xl border transition-all cursor-pointer ${composeMediaType === 'image' ? 'bg-indigo-600 border-indigo-700 text-white shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                          >
                            Photo
                          </button>
                          <button
                            type="button"
                            onClick={() => setComposeMediaType('video')}
                            className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-extrabold rounded-xl border transition-all cursor-pointer ${composeMediaType === 'video' ? 'bg-indigo-600 border-indigo-700 text-white shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                          >
                            Video
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-indigo-500 font-bold leading-normal">
                        ★ Pasted URLs render instantly! Great way to post high-res media without loading delay.
                      </p>
                    </div>
                  )}
                  
                  {/* Media Preview */}
                  {(composeMediaUrl || youtubePreviewId) && (
                    <div className="relative mt-2 mb-4 bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
                      {composeMediaUrl ? (
                         composeMediaType === 'image' ? (
                           <img src={composeMediaUrl} className="w-full h-auto max-h-[300px] object-contain mx-auto" alt="Preview" />
                         ) : (
                           <video src={composeMediaUrl} className="w-full h-auto max-h-[300px] object-contain mx-auto" controls />
                         )
                      ) : (
                        <div className="relative group cursor-pointer" onClick={() => setPlayingYoutubeId(youtubePreviewId)}>
                          <img 
                            src={`https://img.youtube.com/vi/${youtubePreviewId}/maxresdefault.jpg`} 
                            onError={(e) => {
                              // Fallback to hqdefault if maxresdefault is not available
                              (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${youtubePreviewId}/hqdefault.jpg`;
                            }}
                            className="w-full h-auto max-h-[300px] object-cover" 
                            alt="YouTube Preview"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors pointer-events-none">
                            <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center shadow-2xl">
                              <PlaySquare className="w-10 h-10 text-white" />
                            </div>
                          </div>
                          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] text-white font-bold tracking-wider uppercase">
                            Click to play preview
                          </div>
                        </div>
                      )}
                      <button 
                        onClick={() => {
                          if (composeMediaUrl) {
                            setComposeMediaUrl(null);
                            setComposeFile(null);
                          } else {
                            // If it's a YT preview, we can't really "remove" it without clearing the text or a specific flag
                            // But usually users want to dismiss the preview. 
                            // Let's just allow clearing composeMediaUrl for now as YT is derived from text.
                          }
                        }}
                        className={`absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-colors ${!composeMediaUrl && 'hidden'}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Attached Reel / Video Preview & Thumbnail Replacement */}
                  {(attachedReel || composeMediaType === 'video' || composeMediaUrl) && (
                    <div className="mt-3 bg-purple-50/50 border border-purple-200/80 rounded-2xl p-3.5 space-y-3">
                      {attachedReel && (
                        <div className="flex items-center gap-3 bg-white rounded-xl p-2.5 border border-purple-100 shadow-xs">
                          {composeReelThumbnailUrl || attachedReel.thumbnailUrl ? (
                            <img src={composeReelThumbnailUrl || attachedReel.thumbnailUrl} className="w-12 h-16 object-cover rounded-lg shadow-xs border border-white shrink-0" alt="Reel thumbnail" />
                          ) : (
                            <div className="w-12 h-16 bg-purple-100 rounded-lg flex items-center justify-center border border-white shrink-0">
                              <PlaySquare className="w-6 h-6 text-purple-600" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-[10px] font-black uppercase tracking-wider text-purple-600">Attached Reel Video</p>
                            <p className="text-xs font-bold text-gray-800 truncate">@{attachedReel.user}</p>
                            <p className="text-[11px] text-gray-500 truncate">{attachedReel.description || "Reel content"}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => { setAttachedReel(null); setComposeReelThumbnailUrl(''); }}
                            className="p-1.5 bg-gray-100 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* Replace Thumbnail URL Field */}
                      <div className="flex flex-col gap-1 text-left">
                        <label className="text-[10px] font-black uppercase tracking-wider text-purple-700 flex items-center justify-between">
                          <span>🖼️ Replace Video / Reel Thumbnail URL</span>
                          {composeReelThumbnailUrl && (
                            <button
                              type="button"
                              onClick={() => setComposeReelThumbnailUrl('')}
                              className="text-gray-400 hover:text-red-500 font-bold"
                            >
                              Reset
                            </button>
                          )}
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={composeReelThumbnailUrl}
                            onChange={(e) => {
                              setComposeReelThumbnailUrl(e.target.value);
                              if (attachedReel) {
                                setAttachedReel({ ...attachedReel, thumbnailUrl: e.target.value });
                              }
                            }}
                            placeholder="Paste custom thumbnail image URL (jpg/png/webp)..."
                            className="flex-1 bg-white border border-purple-200 rounded-xl px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => setShowTranscoderModal(true)}
                            className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
                            title="Open FFmpeg Transcoder & Frame Extractor"
                          >
                            <Video className="w-3.5 h-3.5" />
                            <span>FFmpeg Tools</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tagged Users Chips & Selector Toggle */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTagSelectorModal(true)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                    >
                      <Tag className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Tag Users ({taggedUserNames.length})</span>
                    </button>

                    {taggedUserNames.map((name) => (
                      <span key={name} className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 text-white rounded-full text-[11px] font-bold shadow-2xs">
                        @{name}
                        <button
                          type="button"
                          onClick={() => setTaggedUserNames(prev => prev.filter(n => n !== name))}
                          className="hover:text-red-200"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex justify-between items-center text-gray-400 mt-2 relative">
                    <div className="flex items-center gap-2">
                      <img src="https://picsum.photos/seed/fb_background/30/30" className="w-8 h-8 rounded-lg outline outline-2 outline-offset-2 outline-gray-200 cursor-pointer" alt="Choose backgroud" />
                      {instantUploadStatus && (
                        <motion.span 
                          initial={{ opacity: 0, x: -10 }} 
                          animate={{ opacity: 1, x: 0 }} 
                          className={`text-[11px] font-bold px-2 py-1 rounded-full border ${
                            instantUploadStatus.includes('failed') || instantUploadStatus.includes('Error')
                              ? 'text-red-600 bg-red-50 border-red-100'
                              : instantUploadStatus.includes('Uploading')
                              ? 'text-blue-600 bg-blue-50 border-blue-100 animate-pulse'
                              : 'text-green-600 bg-green-50 border-green-100'
                          }`}
                        >
                          {instantUploadStatus}
                        </motion.span>
                      )}
                    </div>
                    <button 
                      onClick={() => setShowComposeEmojiPicker(!showComposeEmojiPicker)}
                      className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <Smile className={`w-6 h-6 ${showComposeEmojiPicker ? 'text-yellow-500' : 'text-gray-400 hover:text-gray-600'}`} />
                    </button>
                    {showComposeEmojiPicker && (
                      <div className="absolute bottom-full right-0 z-[110] mb-2 shadow-2xl rounded-xl overflow-hidden">
                        <EmojiPicker 
                          onEmojiClick={onComposeEmojiClick} 
                          autoFocusSearch={false} 
                          theme={Theme.LIGHT}
                          width={320}
                          height={400}
                        />
                      </div>
                    )}

                    {/* Location Tagging Section */}
                    <AnimatePresence>
                      {showLocationInput && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 border-t border-gray-100 pt-3"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-red-500" />
                              <span>Select or search location</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setShowLocationInput(false);
                                setLocationSearchQuery('');
                              }}
                              className="text-xs text-gray-400 hover:text-gray-600 font-semibold"
                            >
                              Hide
                            </button>
                          </div>
                          <div className="relative mb-2.5">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                            <input
                              type="text"
                              placeholder="Where was this photo/video taken?"
                              value={locationSearchQuery}
                              onChange={(e) => setLocationSearchQuery(e.target.value)}
                              className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-1 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all box-border text-gray-800"
                            />
                            {locationSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setLocationSearchQuery('')}
                                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 focus:outline-none"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <div className="max-h-40 overflow-y-auto flex flex-col gap-1 border border-gray-100 rounded-lg p-1 bg-gray-50/50">
                            {locationSearchQuery.trim() && (
                              <button
                                type="button"
                                onClick={() => {
                                  setComposeLocation(locationSearchQuery.trim());
                                  setShowLocationInput(false);
                                  setLocationSearchQuery('');
                                }}
                                className="flex items-center gap-2 px-3 py-2 text-left rounded-md hover:bg-white border border-transparent hover:border-gray-200 transition-all focus:outline-none"
                              >
                                <Plus className="w-4 h-4 text-emerald-500 shrink-0" />
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-gray-800">Add "{locationSearchQuery.trim()}"</span>
                                  <span className="text-[11px] text-gray-400 font-medium">Use this custom location tag</span>
                                </div>
                              </button>
                            )}
                            {POPULAR_LOCATIONS
                              .filter(loc => loc.toLowerCase().includes(locationSearchQuery.toLowerCase()))
                              .map((loc, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    setComposeLocation(loc);
                                    setShowLocationInput(false);
                                    setLocationSearchQuery('');
                                  }}
                                  className={`flex items-center gap-2 px-3 py-1.5 text-left rounded-md border transition-all focus:outline-none ${
                                    composeLocation === loc
                                      ? 'bg-blue-50 border-blue-100 text-brand-blue'
                                      : 'border-transparent hover:bg-white hover:border-gray-200 text-gray-700'
                                  }`}
                                >
                                  <MapPin className={`w-3.5 h-3.5 shrink-0 ${composeLocation === loc ? 'text-blue-500 fill-blue-500' : 'text-gray-400'}`} />
                                  <span className="text-xs font-semibold">{loc}</span>
                                </button>
                              ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Add to your post */}
                <div className="p-4 border-t border-gray-200">
                  <input 
                    type="file" 
                    ref={composeFileInputRef} 
                    className="hidden" 
                    accept="image/*,video/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const isVideo = file.type.startsWith('video');
                        setComposeMediaType(isVideo ? 'video' : 'image');
                        const localUrl = URL.createObjectURL(file);
                        
                        if (isVideo) {
                          const thumb = await extractVideoThumbnail(file);
                          setComposeMediaUrl(thumb || localUrl);
                        } else {
                          setComposeMediaUrl(localUrl);
                        }
                        setComposeFile(file);
                        setRemoteMediaUrl(null);
                        
                        if (isOffline) {
                          setInstantUploadStatus('Saved locally (Offline mode)');
                        } else {
                          setInstantUploadStatus('Uploading...');
                          try {
                            const result = await uploadToCloudinary(file, isVideo ? 'video' : 'image');
                            if (result && result.secure_url) {
                              setRemoteMediaUrl(result.secure_url);
                              setInstantUploadStatus('Upload complete!');
                            } else {
                              setInstantUploadStatus('Upload failed');
                            }
                          } catch (err) {
                            console.error("Background upload failed:", err);
                            setInstantUploadStatus('Upload failed');
                          }
                        }
                      }
                    }}
                  />
                  <div className="border border-gray-300 rounded-lg p-3 flex items-center justify-between shadow-sm cursor-pointer hover:bg-gray-50 transition-colors mb-4 text-[15px] font-semibold text-gray-900 box-border">
                    <span className="hidden sm:inline">Add to your post</span>
                    <span className="sm:hidden">Add to post</span>
                    <div className="flex items-center gap-4">
                      <button onClick={handleAIImageSuggest} disabled={isGeneratingAI}>
                        <Wand2 className={`w-6 h-6 text-purple-500 hover:scale-110 transition-transform ${isGeneratingAI ? 'animate-spin opacity-50' : ''}`} />
                      </button>
                      <button onClick={() => { setComposeMediaType('video'); composeFileInputRef.current?.click(); }}><Video className="w-6 h-6 text-red-500 hover:scale-110 transition-transform" /></button>
                      <button onClick={() => { setComposeMediaType('image'); composeFileInputRef.current?.click(); }}><ImageIcon className="w-6 h-6 text-green-500 hover:scale-110 transition-transform" /></button>
                      <button
                        type="button"
                        onClick={() => setShowReelSelector(true)}
                        title="Attach Reel"
                        className="active:scale-95 transition-all focus:outline-none"
                      >
                        <PlaySquare className={`w-6 h-6 hover:scale-110 transition-transform ${attachedReel ? 'text-pink-600' : 'text-purple-500'}`} />
                      </button>
                      <button 
                        onClick={() => setShowComposeUrlInput(!showComposeUrlInput)} 
                        title="Upload media via URL fast"
                        className="active:scale-95 transition-all"
                      >
                        <Link2 className={`w-6 h-6 hover:scale-110 transition-transform ${showComposeUrlInput ? 'text-indigo-600' : 'text-indigo-400'}`} />
                      </button>
                      <UserPlus className="w-6 h-6 text-blue-500 hover:scale-110 transition-transform" />
                      <button onClick={() => setShowComposeEmojiPicker(!showComposeEmojiPicker)}>
                        <GiphyIcon className={`w-6 h-6 hover:scale-110 transition-transform ${showComposeEmojiPicker ? 'opacity-100' : 'opacity-80'}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowLocationInput(!showLocationInput)}
                        title="Add location tag"
                        className="active:scale-95 transition-all focus:outline-none"
                      >
                        <MapPin className={`w-6 h-6 hover:scale-110 transition-transform ${showLocationInput ? 'text-red-600 fill-red-100' : 'text-red-500'}`} />
                      </button>
                      <MoreHorizontal className="w-6 h-6 text-gray-500 hover:scale-110 transition-transform hidden sm:block" />
                    </div>
                  </div>
                  
                  {/* Post button */}
                  <button 
                    onClick={handlePost}
                    disabled={(!newPostContent.trim() && !composeMediaUrl && !attachedReel)}
                    className={`w-full py-2.5 rounded-lg font-bold text-[15px] transition-colors ${(newPostContent.trim() || composeMediaUrl || attachedReel) ? 'bg-brand-blue text-white hover:bg-blue-600' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                  >
                    Post
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Reel Selector Modal */}
        <AnimatePresence>
          {showReelSelector && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                  <h3 className="font-bold text-lg text-gray-900">Select Reel to Attach</h3>
                  <button
                    onClick={() => setShowReelSelector(false)}
                    className="p-1.5 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>

                {/* Reel List */}
                <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-3 min-h-[300px]">
                  {ReelStore.getReels().length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                      <PlaySquare className="w-12 h-12 text-gray-300 mb-2" />
                      <p className="text-sm font-semibold">No reels available to share</p>
                    </div>
                  ) : (
                    ReelStore.getReels().map((r: any) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setAttachedReel(r);
                          // Clear standard photo/video attachment to avoid conflicts
                          setComposeMediaUrl(null);
                          setComposeFile(null);
                          setShowReelSelector(false);
                        }}
                        className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 hover:border-purple-200 hover:bg-purple-50/20 transition-all text-left w-full focus:outline-none cursor-pointer"
                      >
                        {r.thumbnailUrl ? (
                          <img src={r.thumbnailUrl} className="w-12 h-16 object-cover rounded-lg border border-gray-100 shadow-sm shrink-0" alt="Reel" />
                        ) : (
                          <div className="w-12 h-16 bg-purple-100 text-purple-500 rounded-lg flex items-center justify-center shrink-0 border border-gray-100">
                            <PlaySquare className="w-5 h-5" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-purple-600 flex items-center gap-1">
                            @{r.user}
                          </p>
                          <p className="text-xs text-gray-600 line-clamp-2 mt-0.5 font-medium">{r.description || "No description"}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        {/* Feed Posts */}
        {/* Upload Progress Bar removed for instant-feel */}

        {/* Offline Queued Posts Management Banner */}
        {optimisticPosts.some(p => p.isOfflinePending) && (
          <div className="mx-4 mb-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <div className="truncate">
                <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  {optimisticPosts.filter(p => p.isOfflinePending).length} post(s) queued offline
                </p>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 truncate">
                  Saved locally on this device pending connection
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSyncAllOfflinePosts}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-sm"
              >
                Sync All
              </button>
              <button
                type="button"
                onClick={handleClearAllOfflinePosts}
                className="px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 text-xs font-bold rounded-xl cursor-pointer transition-all"
              >
                Discard All
              </button>
            </div>
          </div>
        )}

        {(() => {
          const itemsToRender: any[] = [];
          
          const allFeedPosts = [...optimisticPosts, ...filteredPosts];
          const feedPosts = allFeedPosts.slice(0, visiblePostsCount);
          const activeAds: any[] = [];
          
          feedPosts.forEach((post, index) => {
            itemsToRender.push({ type: 'post', data: post });
            
            // Insert inline follow suggestions in the middle of feed (after 2nd post)
            if (index === 1) {
              itemsToRender.push({ type: 'follow_suggestions' });
            }

            // Show ad campaign every 3 items
            if ((index + 1) % 3 === 0 && activeAds.length > 0) {
              const adIndex = Math.floor((index / 3) % activeAds.length);
              itemsToRender.push({ type: 'ad', data: activeAds[adIndex] });
            }
          });

          // Fallback if empty timeline or only 1 item to ensure suggestions are shown
          if (feedPosts.length <= 1) {
            itemsToRender.push({ type: 'follow_suggestions' });
          }

          itemsToRenderRef.current = itemsToRender;

          return (
            <>
              {itemsToRender.map((item, idx) => {
                if (item.type === 'follow_suggestions') {
              const followList = finalSuggested.filter(u => !followingState[u.id] && u.id !== currentUserId);
              if (followList.length === 0) return null;
              
              return (
                <div key={`inline-follow-suggestions-${idx}`} className="bg-white sm:rounded-2xl sm:mx-2 sm:my-3 p-4 shadow-sm text-left">
                  <div className="flex items-center justify-between mb-4 pb-1 border-b border-gray-100">
                    <span className="font-extrabold text-sm text-gray-900 flex items-center gap-1.5 tracking-tight">
                      ✨ Suggested for you
                    </span>
                    <button 
                      onClick={() => onNavigate?.('directory')}
                      className="text-xs font-bold text-brand-blue hover:text-blue-700 transition-colors"
                    >
                      See All
                    </button>
                  </div>
                  
                  {/* Instagram Style Horizontal Scroll of Round Stories/Users (No Border Box) */}
                  <div className="flex gap-4 overflow-x-auto pb-3 pt-1 scrollbar-none select-none">
                    {followList.map((u) => {
                      const username = (u.name || '').toLowerCase().replace(/\s+/g, '_');
                      return (
                        <div key={u.id} className="flex flex-col items-center text-center min-w-[95px] max-w-[95px] select-none transition-all">
                          <div className="relative mb-2">
                            {/* Instagram style colorful ring around circular profile */}
                            <div className="w-[50px] h-[50px] rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 p-[2px] transition-transform active:scale-95 duration-150">
                              <UserAvatar 
                                src={u.avatar} 
                                name={u.name} 
                                size="sm" 
                                className="!w-full !h-full border-2 border-white" 
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-0.5 mt-0.5 w-full justify-center min-w-0">
                            <span 
                              onClick={() => {
                                if (onUserSelected) {
                                  onUserSelected({ id: u.id, name: u.name, avatar: u.avatar, isVerified: u.isVerified });
                                }
                              }}
                              className="font-bold text-[11px] text-gray-900 truncate hover:underline cursor-pointer leading-tight"
                            >
                              @{username}
                            </span>
                            {u.isVerified && <BadgeCheck className="w-3 h-3 text-white fill-[#0095f6] shrink-0" />}
                          </div>
                          
                          <span className="text-[10px] text-gray-400 font-normal truncate w-full mt-0.5">{u.name}</span>
                          
                          <button
                            onClick={() => onToggleFollow?.(u.id)}
                            className="w-full mt-2.5 py-1 bg-[#0095f6] hover:bg-[#1877f2] active:scale-95 text-white font-bold text-[11px] rounded-md shadow-sm transition-all"
                          >
                            Follow
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }

            if (item.type === 'ad') {
              const ad = item.data;
              console.log('ad impression', ad.id);
              return (
                <div 
                  key={`ad-${ad.id}-${idx}`}
                  ref={(el) => { if (el && observerRef.current) observerRef.current.observe(el); }}
                  data-index={idx}
                  className="border-b border-gray-100 pb-4 sm:border sm:rounded-xl sm:mx-2 sm:my-3 sm:shadow-md bg-white relative overflow-hidden text-left"
                >
                  {/* Sponsor indicator header */}
                  <div className="flex items-center justify-between p-3.5 bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-[38px] h-[38px] rounded-full overflow-hidden bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center border font-black text-white text-xs">
                        AD
                      </div>
                      <div className="flex flex-col">
                        <span className="font-extrabold text-[14px] text-gray-900 tracking-tight flex items-center gap-1.5 leading-snug">
                          {ad.campaignName}
                          <span className="text-[9px] bg-blue-100 border border-blue-200 text-blue-600 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider scale-90">Sponsorizado</span>
                        </span>
                        <span className="text-[10px] text-gray-400 font-bold tracking-wide">Anuncio de Facebook Style • Patrocinado</span>
                      </div>
                    </div>
                  </div>

                  {/* Ad caption */}
                  <div className="p-3">
                    <p className="text-[14px] text-gray-800 leading-snug whitespace-pre-line">{ad.caption}</p>
                  </div>

                  {/* Ad Banner Body */}
                  {ad.image && (
                    <div className="relative aspect-video overflow-hidden bg-gray-50 border-t border-b border-gray-150 flex items-center justify-center">
                      <img src={ad.image} alt="Sponsor Banner" className="w-full h-full object-cover" />
                    </div>
                  )}

                  {/* Ad CTA footer details */}
                  <div className="p-3 px-4 flex items-center justify-between border-t border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => {
                    console.log('ad click', ad.id);
                    window.open(ad.ctaLink, '_blank');
                  }}>
                    <div className="flex-1 min-w-0 pr-4 text-left">
                      <span className="text-[10px] text-gray-400 font-bold uppercase block tracking-wide">Sponsor • {ad.campaignName}</span>
                      <span className="font-bold text-xs text-blue-600 tracking-tight block truncate mt-0.5">Visitar {ad.ctaLink.replace('https://', '')}</span>
                    </div>
                    <button className="bg-blue-600 active:scale-95 text-white font-black text-xs px-4 py-2.5 rounded-lg shadow-sm hover:bg-blue-700 transition-colors whitespace-nowrap">
                      {ad.ctaText || 'Más Información'}
                    </button>
                  </div>
                </div>
              );
            }

            const post = item.data;
            const isLikedByMe = post.likes.includes(currentUserName);
            const rootLikes = post.likes.filter(n => n !== currentUserName);
            // Instagram Style Like string: "Liked by john_doe and 24 others"
            let likeString = '';
            if (post.likes.length > 0) {
              const sampleUser = isLikedByMe ? 'You' : post.likes[0];
              const othersCount = post.likes.length - 1;
              likeString = othersCount > 0 
                ? `Liked by ${sampleUser} and ${othersCount} others` 
                : `Liked by ${sampleUser}`;
            }

            return (
            <article 
              key={post.id}
              ref={(el) => { if (el && observerRef.current) observerRef.current.observe(el); }}
              data-index={idx}
              className={`border-b border-gray-100 pb-3 sm:border sm:rounded-xl sm:mx-2 sm:my-3 sm:shadow-sm bg-white relative transition-opacity ${post.isPending ? 'opacity-90' : ''}`}
            >
              {post.isPending && (
                <div className="absolute top-0 left-0 w-full h-[1px] bg-brand-blue/10 overflow-hidden z-20">
                  <motion.div 
                    className="h-full bg-brand-blue w-1/4"
                    animate={{ x: ['-100%', '400%'] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  />
                </div>
              )}
              {/* Header */}
              <div className="flex items-center justify-between p-3 relative">
                <div 
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => {
                    if (post.userId === currentUserId || post.user.name === currentUserName) {
                      onNavigate?.('profile');
                    } else if (onUserSelected) {
                      onUserSelected({
                        id: post.userId || post.user.name.toLowerCase().replace(/\s+/g, '-'),
                        name: post.user.name,
                        avatar: post.user.avatar,
                        isVerified: post.user.isVerified
                      });
                    }
                  }}
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 p-[2px]">
                    <UserAvatar 
                      src={post.userId === currentUserId ? MY_AVATAR : post.user.avatar} 
                      name={post.user.name}
                      size="md"
                      className="border-2 border-white"
                    />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-semibold text-sm leading-tight text-gray-900 hover:underline">{post.user.name}</span>
                      {post.user.isVerified && (
                        <BadgeCheck className="w-4 h-4 text-white fill-brand-blue" />
                      )}
                      {post.location && (
                        <span className="text-xs text-blue-600 font-semibold flex items-center gap-0.5 ml-1 bg-blue-50/50 px-1.5 py-0.5 rounded border border-blue-100/30">
                          <MapPin className="w-3 h-3 text-red-500 fill-red-500 shrink-0" />
                          <span>{post.location}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-gray-500">{post.user.location}</span>
                      {post.isOfflinePending && (
                        <div className="flex items-center gap-1">
                          <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 text-[8px] font-black uppercase rounded tracking-wider animate-pulse">
                            Offline / Queued
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSyncSingleOfflinePost(post);
                            }}
                            className="px-2 py-0.5 bg-blue-500 hover:bg-blue-600 text-white text-[9px] font-bold rounded cursor-pointer transition-colors shadow-xs"
                            title="Sync this post to live feed"
                          >
                            Sync Now
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePost(post.id);
                            }}
                            className="px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-700 text-[9px] font-bold rounded cursor-pointer transition-colors"
                            title="Discard stuck offline post"
                          >
                            Discard
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5 uppercase tracking-wide">
                      {post.visibility === 'private' ? <X className="w-2.5 h-2.5" /> : (post.visibility === 'friends' ? <Users className="w-2.5 h-2.5" /> : <Globe className="w-2.5 h-2.5" />)}
                      {post.visibility || 'public'}
                    </span>
                  </div>
                </div>
                <div className="relative">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePostOptions(activePostOptions === post.id ? null : post.id);
                    }} 
                    className="p-1 text-gray-500 hover:bg-gray-100 rounded-full active:scale-95 cursor-pointer"
                    title="Post Options"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                  {activePostOptions === post.id && (
                    <div className="absolute right-0 top-8 bg-white shadow-xl border border-gray-100 rounded-xl w-48 py-2 z-30">
                       <button onClick={() => handleDownload(post.image)} className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-700 cursor-pointer"><Download className="w-4 h-4"/> Download Media</button>
                       <button onClick={() => handleShare(post)} className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-700 cursor-pointer"><Share2 className="w-4 h-4"/> Share Post</button>
                       <div className="w-full h-px bg-gray-100 my-1"></div>
                       {(post.userId === currentUserId || post.user.name === currentUserName || isOwner) && (
                         <>
                           {(post.userId === currentUserId || post.user.name === currentUserName) && (
                             <button 
                              onClick={() => {
                                setEditingPostId(post.id);
                                setEditContent(post.caption);
                                setEditMediaUrl(post.image);
                                setEditMediaType(post.mediaType);
                                setEditVisibility(post.visibility || 'public');
                                setEditLocation(post.location || '');
                                setActivePostOptions(null);
                              }} 
                              className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm text-blue-500 cursor-pointer"
                             >
                              <Edit2 className="w-4 h-4"/> Edit Post
                             </button>
                           )}
                           <button 
                             onClick={() => handleDeletePost(post.id)} 
                             className="w-full text-left px-4 py-2 hover:bg-red-50 flex items-center gap-2 text-sm text-red-600 font-medium cursor-pointer"
                           >
                             <Trash2 className="w-4 h-4"/> Delete Post {isOwner && post.userId !== currentUserId && '(Admin)'}
                           </button>
                         </>
                       )}
                       {(post.userId !== currentUserId && post.user.name !== currentUserName) && <button onClick={handleReportPost} className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm text-red-500 cursor-pointer"><Flag className="w-4 h-4"/> Report Content</button>}
                    </div>
                  )}
                </div>
              </div>

              {/* Voice Message Media Player Support */}
              {post.audioUrl && (
                <AudioPlayerPost audioUrl={post.audioUrl} audioDuration={post.audioDuration} />
              )}

              {/* Media (Double Tap to Like) */}
              {((post.image || extractYouTubeId(post.caption) || post.reelData) && !post.audioUrl) && (
                post.reelData ? (
                  <div className="w-full">
                    <SharedReelFeedCard
                      reelData={post.reelData}
                      postImage={post.image}
                      postCaption={post.caption}
                      onNavigate={onNavigate}
                      onDoubleTapLike={() => {
                        if (!isLikedByMe) toggleLike(post.id);
                      }}
                    />
                  </div>
                ) : (
                  <div 
                    className="w-full bg-gray-100 relative cursor-pointer group rounded-xl overflow-hidden" 
                    onDoubleClick={(e) => { e.preventDefault(); if (!isLikedByMe) toggleLike(post.id); }}
                    onClick={() => {
                      const ytId = extractYouTubeId(post.caption);
                      if (ytId) {
                        setPlayingYoutubeId(ytId);
                      } else if (post.image) {
                        setViewingMediaUrl(post.image);
                        setViewingMediaType(post.mediaType);
                        setViewingPost(post);
                      }
                    }}
                  >
                    {post.image ? (
                      (post.mediaType === 'video' || (typeof post.image === 'string' && (post.image.includes('.mp4') || post.image.includes('.webm') || post.image.includes('.mov') || post.image.includes('video/') || post.image.includes('blob:')))) ? (
                        <div className="relative bg-black flex items-center justify-center">
                          <video 
                            src={post.image} 
                            className="w-full max-h-[600px] object-cover bg-black" 
                            controls 
                            playsInline 
                            preload="auto"
                            onLoadedMetadata={(e) => {
                              const v = e.currentTarget;
                              if (!v.currentTime) {
                                v.currentTime = Math.min(0.2, (v.duration || 1) / 2);
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <img 
                          src={post.image} 
                          className="w-full object-cover max-h-[600px]" 
                          alt="Post content" 
                          referrerPolicy="no-referrer"
                        />
                      )
                    ) : (
                      extractYouTubeId(post.caption) ? (
                        <div className="relative w-full aspect-video bg-black flex items-center justify-center">
                          <img
                            src={`https://img.youtube.com/vi/${extractYouTubeId(post.caption)}/hqdefault.jpg`}
                            alt="YouTube Thumbnail"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = `https://img.youtube.com/vi/${extractYouTubeId(post.caption)}/0.jpg`;
                            }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                            <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center shadow-2xl scale-100 group-hover:scale-105 transition-transform">
                              <PlaySquare className="w-10 h-10 text-white" />
                            </div>
                          </div>
                        </div>
                      ) : null
                    )}

                    {extractYouTubeId(post.caption) && post.image && (
                       <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/30 transition-colors pointer-events-none">
                         <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center shadow-2xl">
                           <PlaySquare className="w-10 h-10 text-white" />
                         </div>
                       </div>
                    )}

                  {/* Direct Count Overlay Badges on Post Picture */}
                  {post.image && (
                    <div className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1.5 pointer-events-auto" onClick={e => e.stopPropagation()}>
                      {/* Favourite count badge */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavourite(post.id);
                        }}
                        className={`px-2.5 py-1 rounded-full font-bold text-xs flex items-center gap-1 backdrop-blur-md shadow-lg border transition-all active:scale-95 cursor-pointer ${
                          (post.favourites || []).includes(currentUserName)
                            ? 'bg-rose-600/90 border-rose-400 text-white shadow-rose-600/30'
                            : 'bg-black/60 hover:bg-black/80 border-white/20 text-white'
                        }`}
                        title="Favourite photo"
                      >
                        <Heart className={`w-3.5 h-3.5 ${(post.favourites || []).includes(currentUserName) ? 'fill-white text-white' : 'text-white'}`} />
                        <span>{(post.favourites || []).length}</span>
                      </button>

                      {/* Star Rating count badge */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingMediaUrl(post.image);
                          setViewingMediaType(post.mediaType);
                          setViewingPost(post);
                          setShowStarPicker(true);
                        }}
                        className="px-2.5 py-1 bg-black/60 hover:bg-black/85 border border-amber-400/50 rounded-full text-amber-300 font-bold text-xs flex items-center gap-1 backdrop-blur-md shadow-lg transition-all active:scale-95 cursor-pointer"
                        title="Rate picture"
                      >
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        {(() => {
                          const ratingsObj = post.ratings || {};
                          const ratingScores = Object.values(ratingsObj).map(Number).filter(v => !isNaN(v) && v > 0);
                          const count = ratingScores.length;
                          const avg = count > 0 ? (ratingScores.reduce((a, b) => a + b, 0) / count).toFixed(1) : '5.0';
                          return (
                            <>
                              <span>{avg}</span>
                              <span className="text-[10px] text-gray-300 font-normal">({count})</span>
                            </>
                          );
                        })()}
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Actions Bar */}
              <div className="flex items-center justify-between px-3 py-2 bg-white text-gray-900">
                <div className="flex items-center gap-4">
                  {/* Like Button */}
                  <button 
                    onClick={() => toggleLike(post.id)} 
                    className={`relative flex items-center justify-center p-1 active:scale-90 hover:scale-105 transition-all duration-200 group ${isLikedByMe ? 'delete-reaction-btn' : ''} ${isLikedByMe && isDeletionBlocked ? 'disabled opacity-50 cursor-not-allowed' : ''}`}
                    disabled={isLikedByMe && isDeletionBlocked}
                    title={isLikedByMe && isDeletionBlocked ? 'Deletion blocked' : 'Me gusta'}
                  >
                    <motion.div
                      animate={isLikedByMe ? { scale: [1, 1.45, 0.85, 1.15, 1.1] } : { scale: 1 }}
                      transition={{ duration: 0.4, ease: "easeInOut" }}
                    >
                      <Heart 
                        className={`w-7 h-7 stroke-[1.75] transition-colors duration-300 ${
                          isLikedByMe 
                            ? 'fill-[#FF3040] text-[#FF3040]' 
                            : 'text-gray-900 group-hover:text-red-500'
                        }`} 
                      />
                    </motion.div>
                  </button>

                  {/* Comment Button restored - Instagram Style */}
                  <button 
                    onClick={() => setActiveCommentPostId(post.id)}
                    className="relative flex items-center justify-center p-1 active:scale-90 hover:scale-105 transition-all duration-200 group"
                    title="Comentarios / Comments"
                  >
                    <MessageCircle 
                      className="w-7 h-7 stroke-[1.75] text-gray-900 group-hover:text-red-500 transition-colors" 
                    />
                    {post.comments && post.comments.length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white font-extrabold text-[9px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center border-2 border-white shadow-sm">
                        {post.comments.length}
                      </span>
                    )}
                  </button>

                  {/* Share Button / Custom Export Icon */}
                  <button 
                    onClick={() => handleShare(post)} 
                    className="relative flex items-center justify-center p-1 active:scale-90 hover:scale-105 transition-all duration-200 group"
                    title="Compartir en redes sociales"
                  >
                    <img 
                      src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEg2toPHnzSXS7NWToDDUS7TNBQSX37khDUu_nZHkQZ7HXwqHItrVWzMCD_8oEsZT8AWHy1chEcjw-sKS2iE3cLLw3FfdXr9_ms4gwiNH1XYuiKXlKA04luezM1fiYdf3QBGDld5cLEaFbOwKzU7RDKMm-3seq4t358Uyr3kkek2kDzcAdc1fkW7d0BaGtI/s1600/export.png"
                      alt="Share"
                      className="w-7 h-7 object-contain transition-all group-hover:opacity-80"
                      referrerPolicy="no-referrer"
                    />
                  </button>
                </div>

                {/* Bookmark / Guardar Button */}
                <button 
                  onClick={() => toggleSave(post.id)} 
                  className="relative flex items-center justify-center p-1 active:scale-90 hover:scale-105 transition-all duration-200 group"
                  title="Guardar"
                >
                  <Bookmark 
                    className={`w-7 h-7 stroke-[1.75] transition-all duration-300 ${
                      post.isSaved 
                        ? 'fill-gray-900 text-gray-900' 
                        : 'text-gray-900 group-hover:text-gray-500'
                    }`} 
                  />
                </button>
              </div>

              {/* Likes Summary Bar */}
              {post.likes.length > 0 && (
                <div className="px-3 flex flex-wrap gap-x-3 gap-y-1 mb-1">
                  {post.likes.length > 0 && (
                    <div className="flex -space-x-1 items-center">
                      {post.likes.slice(0, 3).map((name, i) => (
                          <div key={i} className="flex items-center justify-center -ml-1 first:ml-0">
                            <UserAvatar 
                              src={undefined} 
                              name={name}
                              size="xs"
                              className="border-2 border-white ring-1 ring-gray-100"
                            />
                          </div>
                      ))}
                      <span className="text-[12px] font-medium text-gray-600 ml-2">
                          {likeString}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Caption */}
              <div className="px-3 flex flex-col">
                <div className="mt-1 leading-snug">
                  <span 
                    className="font-semibold text-[14px] text-gray-900 mr-2 cursor-pointer hover:underline"
                    onClick={() => {
                      if (post.user.name === currentUserName) {
                        onNavigate?.('profile');
                      } else if (onUserSelected) {
                        onUserSelected({
                          id: post.userId || post.user.name.toLowerCase().replace(/\s+/g, '-'),
                          name: post.user.name,
                          avatar: post.user.avatar,
                          isVerified: post.user.isVerified
                        });
                      }
                    }}
                  >
                    {post.user.name}
                  </span>
                  <span className="text-[14px] text-gray-900">{renderTextWithMentions(post.caption)}</span>
                </div>

                {/* Tagged Users Display */}
                {post.taggedUsers && post.taggedUsers.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-extrabold text-indigo-700 flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                      <Tag className="w-3 h-3 text-indigo-600" /> Tagged:
                    </span>
                    {post.taggedUsers.map((name, idx) => (
                      <span key={idx} className="text-[12px] font-bold text-indigo-700 hover:underline cursor-pointer">
                        @{name}{idx < (post.taggedUsers?.length || 0) - 1 ? ',' : ''}
                      </span>
                    ))}
                  </div>
                )}

                {post.eventData && (
                  <div className="mt-3.5 p-4 bg-gradient-to-tr from-amber-500/5 via-orange-500/5 to-rose-500/5 border border-orange-100/50 rounded-2xl flex flex-col gap-3 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-orange-600 bg-orange-100/70 px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Evento Compartido 📅</span>
                      </span>
                      {post.eventData.isPromoted && (
                        <span className="text-[10px] font-black bg-gradient-to-r from-yellow-500 to-amber-600 border border-yellow-400 text-white px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm select-none">
                          <Sparkles className="w-3.5 h-3.5 animate-pulse text-yellow-300" />
                          PATROCINADO
                        </span>
                      )}
                    </div>
                    
                    {post.eventData.coverImage && (
                      <div className="w-full h-36 rounded-xl overflow-hidden relative shadow-sm">
                        <img src={post.eventData.coverImage} className="w-full h-full object-cover" alt="" />
                      </div>
                    )}
                    
                    <div className="flex flex-col gap-1">
                      <h4 className="font-extrabold text-[#1c1e21] text-base leading-tight">{post.eventData.title}</h4>
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span>{post.eventData.time}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="line-clamp-1">{post.eventData.location}</span>
                        </div>
                      </div>
                    </div>

                    {/* Interactive interested attendance button & count */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-gray-100/60 mt-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500">
                        <Users className="w-4 h-4 text-orange-500" />
                        <span>{EventStore.getEvents().find(e => e.id === post.eventData!.id)?.interestedUserIds?.length || post.eventData.interestedCount || 0} inscritos</span>
                      </div>
                      
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          // Toggle interest directly in EventStore!
                          EventStore.toggleInterested(post.eventData!.id, currentUserId);
                          // Trigger global re-render of components by notifying subscribers
                          EventStore.notify();
                          alert("¡Asistencia actualizada de forma segura! 🎉");
                        }}
                        className={`px-4 py-2 font-black text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95 flex items-center gap-1 shadow-md ${
                          EventStore.getEvents().find(e => e.id === post.eventData!.id)?.interestedUserIds?.includes(currentUserId)
                            ? 'bg-rose-500 text-white shadow-rose-500/10'
                            : 'bg-gradient-to-r from-orange-500 to-red-600 hover:opacity-95 text-white shadow-orange-500/10'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${EventStore.getEvents().find(e => e.id === post.eventData!.id)?.interestedUserIds?.includes(currentUserId) ? 'fill-white text-white' : 'text-white'}`} />
                        <span>Me Interesa</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Translation UI */}
                {post.caption && post.caption.length > 5 && (
                  <div className="mt-1">
                    {translations[post.id] ? (
                      <div className="bg-gray-50 border-l-2 border-brand-blue pl-2 py-1 mt-1">
                        <p className="text-[13px] text-gray-600 italic">
                          <Globe className="w-3 h-3 inline mr-1 mb-0.5 text-brand-blue" />
                          {translations[post.id]}
                        </p>
                        <button 
                          onClick={() => setTranslations(prev => {
                            const next = { ...prev };
                            delete next[post.id];
                            return next;
                          })}
                          className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter hover:text-gray-600 mt-1"
                        >
                          See Original
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleTranslate(post.id, post.caption)}
                        disabled={translatingIds.has(post.id)}
                        className="text-[12px] font-bold text-gray-500 hover:text-brand-blue transition-colors flex items-center gap-1 active:scale-95 disabled:opacity-50"
                      >
                        {translatingIds.has(post.id) ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Globe className="w-3 h-3" />
                        )}
                        {translatingIds.has(post.id) ? 'Translating...' : 'See Translation'}
                      </button>
                    )}
                  </div>
                )}
                
                {/* Comments Section Restored - Instagram Style with Expandable Inline Comments */}
                <div className="flex flex-col gap-1.5 mt-2.5">
                  {post.comments && post.comments.length > 0 ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setActiveCommentPostId(post.id)}
                        className="text-[13px] font-semibold text-gray-500 hover:text-gray-700 text-left transition-colors flex items-center gap-1 group cursor-pointer"
                      >
                        <span className="group-hover:underline">View all {post.comments.length} {post.comments.length === 1 ? 'comment' : 'comments'} in dialog</span>
                      </button>
                      
                      {post.comments.length > 2 && (
                        <button
                          onClick={() => toggleExpandComments(post.id)}
                          className="show-more-comments text-[12px] font-bold text-brand-blue hover:text-blue-700 transition-colors cursor-pointer bg-blue-50/70 hover:bg-blue-100/70 px-2 py-0.5 rounded-full"
                          title={expandedCommentsPostIds[post.id] ? "Collapse inline comments" : `Show all ${post.comments.length} comments inline`}
                        >
                          {expandedCommentsPostIds[post.id] 
                            ? "Hide extra comments" 
                            : `Show all comments (${post.comments.length})`}
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setActiveCommentPostId(post.id)}
                      className="text-[13px] font-semibold text-gray-400 hover:text-gray-600 text-left transition-colors cursor-pointer"
                    >
                      Add a comment...
                    </button>
                  )}

                  {/* Comments Preview Inline: Top 2 by default, or all when expanded */}
                  {post.comments && post.comments.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      transition={{ duration: 0.28, ease: "easeOut" }}
                      className="space-y-1 text-left overflow-hidden mt-1"
                    >
                      {(expandedCommentsPostIds[post.id] ? post.comments : post.comments.slice(0, 2)).map((comment, cIdx) => (
                        <motion.div 
                          key={comment.id || cIdx} 
                          initial={{ opacity: 0, y: 3 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: cIdx * 0.03 }}
                          className={`comment text-[13px] text-gray-800 leading-snug flex flex-col gap-1 items-start ${cIdx >= 2 && !expandedCommentsPostIds[post.id] ? 'hidden' : ''}`}
                        >
                          <div className="flex items-start gap-1.5 flex-wrap">
                            <span className="font-extrabold text-gray-900 shrink-0">{comment.authorName}</span>
                            <span className="break-words">{comment.text}</span>
                          </div>
                          {comment.audioUrl && (
                            <div className="w-full max-w-[280px]">
                              <VoiceMessagePlayer url={comment.audioUrl} duration={comment.audioDuration} />
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </motion.div>
                  )}

                  {/* Quick Inline Comment & Voice Clip Input on Post Card */}
                  <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center gap-2">
                    <UserAvatar 
                      src={MY_AVATAR} 
                      name={currentUserName} 
                      size="xs" 
                      className="shrink-0"
                    />
                    <div className="flex-1 bg-gray-50 hover:bg-gray-100/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-rose-500/20 border border-gray-200/80 rounded-full px-3 py-1.5 flex items-center gap-2 transition-all">
                      <input 
                        type="text" 
                        value={inlineCommentInputs[post.id] || ''}
                        onChange={(e) => setInlineCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleQuickSubmitComment(post.id);
                        }}
                        placeholder="Add a comment..."
                        className="bg-transparent outline-none w-full text-xs text-gray-800 placeholder-gray-400"
                      />
                    </div>
                    <button 
                      type="button"
                      onClick={() => handleQuickSubmitComment(post.id)}
                      disabled={!(inlineCommentInputs[post.id] || '').trim()}
                      className="p-1.5 text-brand-blue hover:bg-blue-50 rounded-full disabled:opacity-30 transition-all cursor-pointer shrink-0"
                      title="Post comment"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <span className="text-[10px] font-medium text-gray-400 mt-1.5 uppercase tracking-wide">{formatTime(post.timestamp)}</span>
              </div>
            </article>
          );
        })}

        {allFeedPosts.length > visiblePostsCount && (
          <div className="py-6 flex justify-center w-full">
            <button
              onClick={handleLoadMorePosts}
              className="load-more px-6 py-2.5 bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 rounded-full font-bold text-sm shadow-xs transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <span>Load More Content</span>
            </button>
          </div>
        )}
      </>
    );
  })()}
      </div>
      <AnimatePresence>
        {activeCommentPostId && renderCommentsSheet()}
      </AnimatePresence>

      {/* Edit Post Modal */}
      <AnimatePresence>
        {editingPostId && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="font-bold text-lg">Edit Post</h2>
                <button onClick={() => setEditingPostId(null)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex items-center gap-3 mb-4">
                  <UserAvatar 
                    src={MY_AVATAR} 
                    name={currentUserName}
                    size="sm"
                  />
                  <div className="flex flex-col">
                    <span className="font-bold text-sm">{currentUserName}</span>
                    <div className="flex gap-1.5 items-center flex-wrap mt-1">
                      <select 
                        value={editVisibility}
                        onChange={(e) => setEditVisibility(e.target.value as any)}
                        className="bg-gray-100 rounded-md px-2 py-0.5 text-xs font-semibold text-gray-700 outline-none cursor-pointer w-fit"
                      >
                        <option value="public">🌐 Public</option>
                        <option value="friends">👥 Friends</option>
                        <option value="private">🔒 Only Me</option>
                      </select>
                      {editLocation && (
                        <span className="flex items-center gap-0.5 bg-blue-50 border border-blue-100 rounded-md px-2 py-0.5 text-[10px] font-semibold text-brand-blue">
                          <MapPin className="w-3 h-3 text-red-500 fill-red-500 shrink-0" />
                          <span>at {editLocation}</span>
                          <button
                            type="button"
                            onClick={() => setEditLocation('')}
                            className="ml-1 text-gray-400 hover:text-gray-600 focus:outline-none"
                            title="Remove location"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onPaste={handleEditPaste}
                  className="w-full text-lg outline-none border-none resize-none min-h-[100px]"
                  placeholder="What's on your mind?"
                  autoFocus
                />

                {editMediaUrl && (
                  <div className="relative mt-4 rounded-xl overflow-hidden group">
                    {editMediaType === 'image' ? (
                      <img src={editMediaUrl} className="w-full h-auto max-h-[300px] object-contain bg-gray-50" />
                    ) : (
                      <video src={editMediaUrl} className="w-full h-auto max-h-[300px] object-contain bg-black" controls />
                    )}
                    <button 
                      onClick={() => setEditMediaUrl(null)}
                      className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="mt-6 flex flex-col gap-3">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Replace Media</label>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => { setEditMediaType('image'); editFileInputRef.current?.click(); }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border-2 border-dashed border-gray-200"
                    >
                      <ImageIcon className="w-5 h-5 text-green-500" />
                      <span className="text-sm font-bold text-gray-700">Photo</span>
                    </button>
                    <button 
                      onClick={() => { setEditMediaType('video'); editFileInputRef.current?.click(); }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border-2 border-dashed border-gray-200"
                    >
                      <Video className="w-5 h-5 text-red-500" />
                      <span className="text-sm font-bold text-gray-700">Video</span>
                    </button>
                  </div>
                </div>

                <input 
                  type="file" 
                  ref={editFileInputRef}
                  className="hidden"
                  accept="image/*,video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setEditMediaType(file.type.startsWith('video') ? 'video' : 'image');
                      setEditMediaUrl(URL.createObjectURL(file));
                      setEditFile(file);
                    }
                  }}
                />

                {/* Location Tagging Section for Edit */}
                <div className="mt-4 border-t border-gray-100 pt-3">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1 mb-2">
                    <MapPin className="w-3.5 h-3.5 text-red-500" />
                    <span>Post Location</span>
                  </label>
                  <div className="relative mb-2">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search or enter location..."
                      value={editLocationSearchQuery}
                      onChange={(e) => setEditLocationSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-1 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all box-border text-gray-800"
                    />
                    {editLocationSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setEditLocationSearchQuery('')}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 focus:outline-none"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="max-h-32 overflow-y-auto flex flex-col gap-1 border border-gray-100 rounded-lg p-1 bg-gray-50/50">
                    {editLocationSearchQuery.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditLocation(editLocationSearchQuery.trim());
                          setEditLocationSearchQuery('');
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 text-left rounded-md hover:bg-white border border-transparent hover:border-gray-200 transition-all focus:outline-none"
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="text-xs font-semibold text-gray-800">Add "{editLocationSearchQuery.trim()}"</span>
                      </button>
                    )}
                    {POPULAR_LOCATIONS
                      .filter(loc => loc.toLowerCase().includes(editLocationSearchQuery.toLowerCase()))
                      .map((loc, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setEditLocation(loc);
                            setEditLocationSearchQuery('');
                          }}
                          className={`flex items-center gap-2 px-3 py-1 text-left rounded-md border transition-all focus:outline-none ${
                            editLocation === loc
                              ? 'bg-blue-50 border-blue-100 text-brand-blue'
                              : 'border-transparent hover:bg-white hover:border-gray-200 text-gray-700'
                          }`}
                        >
                          <MapPin className={`w-3.5 h-3.5 shrink-0 ${editLocation === loc ? 'text-blue-500 fill-blue-500' : 'text-gray-400'}`} />
                          <span className="text-xs font-semibold">{loc}</span>
                        </button>
                      ))}
                  </div>
                </div>
              </div>

                <div className="p-4 border-t bg-gray-50 flex gap-3 text-sm">
                  <button 
                    onClick={() => setEditingPostId(null)}
                    className="flex-1 py-3 font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleUpdatePost}
                    disabled={!editContent.trim()}
                    className="flex-[2] py-3 bg-brand-blue text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                  >
                    Save Changes
                  </button>
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Instagram Style Options Modal */}
      <AnimatePresence>
        {activePostOptions && (
          <div className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 border border-transparent" onClick={() => setActivePostOptions(null)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white w-full max-w-sm rounded-[20px] overflow-hidden shadow-2xl divide-y divide-gray-100"
              onClick={e => e.stopPropagation()}
            >
              {(() => {
                const post = posts.find(p => p.id === activePostOptions);
                if (!post) {
                  const pendingPost = optimisticPosts.find(p => p.id === activePostOptions);
                  if (!pendingPost) return null;
                  return (
                    <div className="p-4 text-center divide-y divide-gray-100 dark:divide-gray-800">
                      <div className="pb-3">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">Offline Queued Post</p>
                        <p className="text-xs text-gray-500 mt-1">This post is saved in your local device queue.</p>
                      </div>
                      <div className="pt-3 flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            handleSyncSingleOfflinePost(pendingPost);
                            setActivePostOptions(null);
                          }}
                          className="w-full py-2.5 bg-brand-blue hover:bg-blue-600 text-white text-sm font-bold rounded-xl cursor-pointer shadow-sm transition-all"
                        >
                          Sync to Live Feed Now
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleDeletePost(pendingPost.id);
                            setActivePostOptions(null);
                          }}
                          className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-bold rounded-xl cursor-pointer transition-all"
                        >
                          Discard / Delete from Device
                        </button>
                        <button 
                          type="button"
                          onClick={() => setActivePostOptions(null)} 
                          className="w-full mt-1 font-semibold text-gray-500 py-2 text-sm cursor-pointer"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  );
                }
                const isMyPost = post.userId === currentUserId || post.user.name === currentUserName;
                
                return (
                  <div className="flex flex-col text-center divide-y divide-gray-100">
                    {post.image && (
                      <button 
                        type="button"
                        onClick={async () => {
                          if (onUpdateAvatar) {
                            try {
                              await onUpdateAvatar(post.image);
                              alert("Profile picture updated successfully! ✨");
                            } catch (e) {
                              console.error("Failed to update avatar via prop:", e);
                              alert("Failed to set profile picture.");
                            }
                          } else {
                            try {
                              localStorage.setItem('profileImg', post.image);
                              if (auth.currentUser) {
                                await setDoc(doc(db, "users", auth.currentUser.uid), { 
                                  avatar: post.image,
                                  isSetupComplete: true 
                                }, { merge: true });
                              }
                              alert("Profile picture updated successfully! ✨ Please refresh to apply across cached views.");
                            } catch (e) {
                              console.error(e);
                              alert("Failed to update profile picture.");
                            }
                          }
                          setActivePostOptions(null);
                        }}
                        className="w-full py-4 text-sm font-bold text-indigo-600 hover:bg-indigo-50/50 transition-all focus:outline-none flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <UserPlus className="w-4.5 h-4.5 text-indigo-500 shrink-0" />
                        <span>Set as Profile Picture</span>
                      </button>
                    )}
                    {(isMyPost || isOwner) && (
                      <button 
                        type="button"
                        onClick={() => {
                          handleDeletePost(post.id);
                          setActivePostOptions(null);
                        }}
                        className={`w-full py-4 text-sm font-bold text-red-500 hover:bg-red-50/50 transition-colors focus:outline-none delete-btn ${isDeletionBlocked ? 'disabled opacity-50 cursor-not-allowed' : ''}`}
                        disabled={isDeletionBlocked}
                        title={isDeletionBlocked ? 'Deletion blocked' : 'Delete Post'}
                      >
                        Delete Post {isOwner && !isMyPost && '(Admin)'}
                      </button>
                    )}

                    {isMyPost && (
                      <button 
                        type="button"
                        onClick={async () => {
                          try {
                            await PostStore.togglePinPost(post.id);
                          } catch (err) {
                            console.error("Error toggling pin status:", err);
                          }
                          setActivePostOptions(null);
                        }}
                        className="w-full py-4 text-sm font-bold text-indigo-600 hover:bg-indigo-50/50 transition-colors focus:outline-none flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Pin className={`w-4 h-4 ${post.pinned ? 'fill-indigo-600' : ''}`} />
                        <span>{post.pinned ? 'Unpin from Profile' : 'Pin to Profile'}</span>
                      </button>
                    )}

                    {isMyPost && (
                      <button 
                        type="button"
                        onClick={() => {
                          setEditingPostId(post.id);
                          setEditContent(post.caption);
                          setEditMediaUrl(post.image);
                          setEditMediaType(post.mediaType);
                          setEditVisibility(post.visibility || 'public');
                          setEditLocation(post.location || '');
                          setActivePostOptions(null);
                        }}
                        className="w-full py-4 text-sm font-bold text-blue-500 hover:bg-blue-50/50 transition-colors focus:outline-none"
                      >
                        Edit Post
                      </button>
                    )}

                    <button 
                      type="button"
                      onClick={() => {
                        handleDownload(post.image);
                        setActivePostOptions(null);
                      }}
                      className="w-full py-4 text-sm text-gray-800 hover:bg-gray-50 transition-colors focus:outline-none font-medium"
                    >
                      Download Media
                    </button>

                    <button 
                      type="button"
                      onClick={() => {
                        handleShare(post);
                        setActivePostOptions(null);
                      }}
                      className="w-full py-4 text-sm text-gray-800 hover:bg-gray-50 transition-colors focus:outline-none font-medium"
                    >
                      Share Post
                    </button>

                    {!isMyPost && (
                      <button 
                        type="button"
                        onClick={() => {
                          handleReportPost();
                          setActivePostOptions(null);
                        }}
                        className="w-full py-4 text-sm text-red-500 font-bold hover:bg-red-50/50 transition-colors focus:outline-none"
                      >
                        Report Content
                      </button>
                    )}

                    <button 
                      type="button"
                      onClick={() => setActivePostOptions(null)}
                      className="w-full py-4 text-sm text-gray-500 hover:bg-gray-50 transition-colors focus:outline-none font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Media Viewer Pop-up */}
      <AnimatePresence>
        {playingYoutubeId && (
          <div className="fixed inset-0 z-[400] bg-black/95 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl"
            >
              <button 
                onClick={() => setPlayingYoutubeId(null)}
                className="absolute -top-12 right-0 p-2 text-white hover:text-gray-300 transition-colors z-50 flex items-center gap-2"
              >
                <span className="text-sm font-bold uppercase tracking-widest">Close</span>
                <X className="w-6 h-6" />
              </button>
              <iframe 
                src={`https://www.youtube.com/embed/${playingYoutubeId}?autoplay=1`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </motion.div>
          </div>
        )}

        {viewingMediaUrl && (() => {
          const activePostInViewer = viewingPost 
            ? (posts.find(p => p.id === viewingPost.id) || PostStore.getPosts().find(p => p.id === viewingPost.id) || viewingPost) 
            : null;
          const isFavouritedInViewer = activePostInViewer?.favourites?.includes(currentUserName) || false;
          const favouritesCount = activePostInViewer?.favourites?.length || 0;
          const ratingsObj = activePostInViewer?.ratings || {};
          const ratingEntries = Object.entries(ratingsObj).filter(([_, v]) => typeof v === 'number' && !isNaN(v) && v > 0);
          const ratingsCount = ratingEntries.length;
          const averageRating = ratingsCount > 0 
            ? (ratingEntries.reduce((sum, [_, val]) => sum + (val as number), 0) / ratingsCount).toFixed(1) 
            : '5.0';
          const userCurrentRating = activePostInViewer?.ratings?.[currentUserName] || (currentUserId ? activePostInViewer?.ratings?.[currentUserId] : 0) || 0;

          return (
            <div 
              className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-3 md:p-6 select-none" 
              onClick={() => { setViewingMediaUrl(null); setViewingPost(null); setShowStarPicker(false); }}
            >
              {/* Close Button top-right (matching screenshot translucent circle design) */}
              <button 
                onClick={(e) => { e.stopPropagation(); setViewingMediaUrl(null); setViewingPost(null); setShowStarPicker(false); }}
                className="absolute top-4 right-4 md:top-6 md:right-6 z-[350] w-11 h-11 rounded-full bg-white/30 hover:bg-white/40 text-white border border-white/20 backdrop-blur-md flex items-center justify-center shadow-2xl transition-all cursor-pointer active:scale-90"
                title="Close viewer"
              >
                <X className="w-6 h-6 stroke-[2.5]" />
              </button>

              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 15 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="relative max-w-[92vw] md:max-w-2xl max-h-[82vh] flex flex-col items-center justify-center"
                onClick={e => e.stopPropagation()}
              >
                {/* Photo Frame Container (matching rounded screenshot layout) */}
                <div className="relative w-auto max-w-full max-h-[72vh] rounded-3xl overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] bg-slate-950 border border-white/10 group flex items-center justify-center">
                  
                  {viewingMediaType === 'image' ? (
                    <img 
                      src={viewingMediaUrl} 
                      className="max-w-full max-h-[72vh] object-contain rounded-3xl cursor-pointer" 
                      alt="User photo"
                      onDoubleClick={() => {
                        if (activePostInViewer) {
                          toggleFavourite(activePostInViewer.id);
                          triggerParticles('heart');
                          setFavouritePop(true);
                          setTimeout(() => setFavouritePop(false), 800);
                        }
                      }}
                    />
                  ) : (
                    <video 
                      src={viewingMediaUrl} 
                      className="max-w-full max-h-[72vh] rounded-3xl object-contain bg-black" 
                      controls 
                      autoPlay
                    />
                  )}

                  {/* Top-Left Animated Instructional Touch Hint (Matching Screenshot!) */}
                  {viewingMediaType === 'image' && (
                    <div 
                      onClick={() => {
                        if (activePostInViewer) {
                          toggleFavourite(activePostInViewer.id);
                          triggerParticles('heart');
                          setFavouritePop(true);
                          setTimeout(() => setFavouritePop(false), 800);
                        }
                      }}
                      className="absolute top-4 left-4 z-20 flex items-center gap-2 group cursor-pointer select-none"
                      title="Click or double-tap to Favourite"
                    >
                      <div className="relative flex items-center justify-center p-2.5 bg-black/70 border border-white/20 rounded-2xl backdrop-blur-md shadow-2xl transition-all duration-300 group-hover:scale-110 active:scale-95 group-hover:bg-black/90">
                        <div className="relative flex items-center justify-center w-8 h-8">
                          <Heart className={`w-6 h-6 stroke-[2] transition-colors ${isFavouritedInViewer ? 'fill-red-500 text-red-500' : 'text-white fill-white/10 group-hover:fill-red-500/30'}`} />
                          
                          {/* Hand tapping indicator icon */}
                          <div className="absolute -bottom-1 -right-1 bg-white text-black rounded-full p-0.5 shadow-md border border-black/20 animate-bounce">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                              <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                              <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                              <path d="M18 8a2 2 0 0 1 2 2v4a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                            </svg>
                          </div>

                          {/* Burst lines around hand heart */}
                          <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full animate-ping opacity-80" />
                          <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-1 bg-white rounded-full animate-ping opacity-80" />
                        </div>
                      </div>
                      
                      <div className="hidden sm:flex flex-col text-left drop-shadow-md">
                        <span className="text-[10px] font-black uppercase tracking-wider text-white bg-black/60 px-2 py-0.5 rounded-full border border-white/20 backdrop-blur-sm">
                          Tap to Favourite
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Pop heart animation on double tap or click */}
                  <AnimatePresence>
                    {favouritePop && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: [0.5, 1.4, 1], opacity: [0.9, 1, 0] }}
                        exit={{ scale: 1.5, opacity: 0 }}
                        transition={{ duration: 0.7 }}
                        className="absolute inset-0 flex items-center justify-center pointer-events-none z-40"
                      >
                        <Heart className="w-28 h-28 text-red-500 fill-red-500 drop-shadow-[0_0_35px_rgba(239,68,68,0.9)]" />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Floating Particles (Hearts & Stars) */}
                  {floatingParticles.map((p) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 1, y: 0, x: p.x, scale: 0.8 }}
                      animate={{ opacity: 0, y: p.y, scale: 1.4 }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="absolute bottom-16 right-16 pointer-events-none z-50"
                    >
                      {p.type === 'heart' ? (
                        <Heart className="w-8 h-8 text-red-500 fill-red-500 drop-shadow-lg" />
                      ) : (
                        <Star className="w-8 h-8 text-amber-400 fill-amber-400 drop-shadow-lg" />
                      )}
                    </motion.div>
                  ))}

                  {/* Bottom-Right Overlay Elements on Photo (Matching Screenshot!) */}
                  {viewingMediaType === 'image' && (
                    <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
                      {/* Star Rating Button with Burst Rays (Bottom Right) */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowStarPicker(!showStarPicker);
                        }}
                        className="relative group p-2.5 sm:p-3 bg-black/60 hover:bg-black/85 border border-amber-400/50 rounded-2xl backdrop-blur-md shadow-2xl flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                        title="Click to rate photo"
                      >
                        <div className="relative">
                          <Star className="w-8 h-8 text-amber-400 fill-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.9)] group-hover:scale-125 transition-transform" />
                          <div className="absolute inset-0 animate-spin-slow opacity-60 pointer-events-none">
                            <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-0.5 h-1.5 bg-amber-300 rounded-full" />
                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0.5 h-1.5 bg-amber-300 rounded-full" />
                            <span className="absolute top-1/2 -left-1 -translate-y-1/2 h-0.5 w-1.5 bg-amber-300 rounded-full" />
                            <span className="absolute top-1/2 -right-1 -translate-y-1/2 h-0.5 w-1.5 bg-amber-300 rounded-full" />
                          </div>
                        </div>
                        <div className="flex flex-col text-left leading-none">
                          <span className="text-xs font-black text-amber-300">{averageRating} ⭐</span>
                          <span className="text-[9px] font-bold text-gray-300 mt-0.5">{ratingsCount} {ratingsCount === 1 ? 'rating' : 'ratings'}</span>
                        </div>
                      </button>

                      {/* Favourite Outline Badge matching user screenshot */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (activePostInViewer) {
                            toggleFavourite(activePostInViewer.id);
                            triggerParticles('heart');
                            setFavouritePop(true);
                            setTimeout(() => setFavouritePop(false), 800);
                          }
                        }}
                        className={`px-4 py-2.5 rounded-full border-2 flex items-center gap-2 backdrop-blur-md shadow-2xl font-black text-xs transition-all active:scale-95 cursor-pointer ${
                          isFavouritedInViewer
                            ? 'bg-rose-600/90 border-rose-400 text-white shadow-rose-500/40'
                            : 'bg-black/60 hover:bg-black/80 border-white text-white shadow-black/60'
                        }`}
                      >
                        <Heart className={`w-5 h-5 ${isFavouritedInViewer ? 'fill-white text-white' : 'text-white'}`} />
                        <span>Favourite</span>
                      </button>
                    </div>
                  )}

                  {/* Rating Selector Popover */}
                  <AnimatePresence>
                    {showStarPicker && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 10 }}
                        className="absolute bottom-20 right-4 z-30 bg-slate-900/95 border border-amber-400/60 p-3.5 rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col items-center gap-2"
                        onClick={e => e.stopPropagation()}
                      >
                        <span className="text-xs font-black text-amber-300 uppercase tracking-wider">Rate this Picture</span>
                        <div className="flex items-center gap-1.5">
                          {[1, 2, 3, 4, 5].map((score) => (
                            <button
                              key={score}
                              onClick={() => {
                                if (activePostInViewer) {
                                  handleRatePost(activePostInViewer.id, score);
                                  triggerParticles('star');
                                }
                                setShowStarPicker(false);
                              }}
                              className="p-1 hover:scale-130 active:scale-90 transition-all text-amber-400 hover:text-amber-300 cursor-pointer"
                              title={`Rate ${score} Star${score > 1 ? 's' : ''}`}
                            >
                              <Star className={`w-7 h-7 ${score <= (userCurrentRating || 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-500 hover:text-amber-300'}`} />
                            </button>
                          ))}
                        </div>
                        <span className="text-[10px] text-gray-400 font-medium">Click a star to submit</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>

                {/* Interactive Action Control Bar underneath the Picture */}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3 max-w-full">
                  {viewingMediaType === 'image' && activePostInViewer && (
                    <>
                      {/* Favourite Action Button */}
                      <button 
                        onClick={() => {
                          toggleFavourite(activePostInViewer.id);
                          triggerParticles('heart');
                          setFavouritePop(true);
                          setTimeout(() => setFavouritePop(false), 800);
                        }}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-full backdrop-blur-md font-bold text-xs sm:text-sm transition-all border shadow-lg active:scale-95 cursor-pointer ${
                          isFavouritedInViewer 
                            ? 'bg-rose-600 border-rose-500 text-white shadow-rose-600/30' 
                            : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${isFavouritedInViewer ? 'fill-white text-white' : 'text-white'}`} />
                        <span>{isFavouritedInViewer ? 'Favourited' : 'Favourite'}</span>
                        <span className="px-1.5 py-0.5 rounded-full bg-black/30 text-[11px] font-extrabold">{favouritesCount}</span>
                      </button>

                      {/* Rate Picture Action Button */}
                      <button 
                        onClick={() => setShowStarPicker(!showStarPicker)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 rounded-full backdrop-blur-md font-bold text-xs sm:text-sm transition-all shadow-lg active:scale-95 cursor-pointer"
                      >
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                        <span>Rate Picture ({averageRating})</span>
                        <span className="px-1.5 py-0.5 rounded-full bg-black/40 text-[11px] font-extrabold">{ratingsCount}</span>
                      </button>
                    </>
                  )}

                  {/* Download Button */}
                  <button 
                    onClick={() => handleDownload(viewingMediaUrl || '')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md font-bold text-xs sm:text-sm transition-all border border-white/20 shadow-lg active:scale-95 cursor-pointer"
                  >
                    <Download className="w-4 h-4" /> 
                    <span>Download</span>
                  </button>

                  {/* Share Button */}
                  <button 
                    onClick={() => handleShare(activePostInViewer || undefined)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md font-bold text-xs sm:text-sm transition-all border border-white/20 shadow-lg active:scale-95 cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" /> 
                    <span>Share</span>
                  </button>
                </div>

              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
      {/* Social Networks Share Modal */}
      <AnimatePresence>
        {socialSharePost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-gray-100 text-left overflow-hidden relative"
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-sm">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-gray-900">Share to Social Networks</h3>
                    <p className="text-[10px] text-gray-500 font-medium">Select platform to share media picture / video</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSocialSharePost(null)}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Preview Box */}
              {socialSharePost.mediaUrl && (
                <div className="my-3 rounded-xl overflow-hidden bg-gray-900 aspect-video relative flex items-center justify-center border border-gray-100">
                  {socialSharePost.mediaType === 'video' ? (
                    <video src={socialSharePost.mediaUrl} className="w-full h-full object-cover" />
                  ) : (
                    <img src={socialSharePost.mediaUrl} alt="Media preview" className="w-full h-full object-cover" />
                  )}
                </div>
              )}
              {socialSharePost.caption && (
                <p className="text-xs text-gray-600 line-clamp-2 italic bg-gray-50 p-2.5 rounded-xl border border-gray-100/80 mb-4 font-medium">
                  "{socialSharePost.caption}"
                </p>
              )}

              {/* Social Networks Grid (10 Platforms) */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 my-2">
                {/* WhatsApp */}
                <button
                  onClick={() => {
                    const text = socialSharePost.caption || 'Check out this post!';
                    const url = socialSharePost.mediaUrl || window.location.href;
                    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
                  }}
                  className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-all border border-emerald-200/60 group active:scale-95 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-1 shadow-xs font-bold text-base">
                    💬
                  </div>
                  <span className="text-[10px] font-bold truncate">WhatsApp</span>
                </button>

                {/* Facebook */}
                <button
                  onClick={() => {
                    const url = socialSharePost.mediaUrl || window.location.href;
                    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
                  }}
                  className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-700 transition-all border border-blue-200/60 group active:scale-95 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center mb-1 shadow-xs font-black text-sm">
                    f
                  </div>
                  <span className="text-[10px] font-bold truncate">Facebook</span>
                </button>

                {/* X / Twitter */}
                <button
                  onClick={() => {
                    shareToXTwitter(socialSharePost);
                  }}
                  className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-900 transition-all border border-slate-300/60 group active:scale-95 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center mb-1 shadow-xs font-extrabold text-xs">
                    𝕏
                  </div>
                  <span className="text-[10px] font-bold truncate">X (Twitter)</span>
                </button>

                {/* Threads */}
                <button
                  onClick={() => {
                    const text = socialSharePost.caption || 'Check out this post!';
                    const url = socialSharePost.mediaUrl || window.location.href;
                    window.open(`https://www.threads.net/intent/post?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
                  }}
                  className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 transition-all border border-zinc-300/60 group active:scale-95 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center mb-1 shadow-xs font-black text-xs">
                    🌀
                  </div>
                  <span className="text-[10px] font-bold truncate">Threads</span>
                </button>

                {/* LinkedIn */}
                <button
                  onClick={() => {
                    const url = socialSharePost.mediaUrl || window.location.href;
                    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
                  }}
                  className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-sky-50 hover:bg-sky-100 text-sky-700 transition-all border border-sky-200/60 group active:scale-95 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center mb-1 shadow-xs font-bold text-xs">
                    💼
                  </div>
                  <span className="text-[10px] font-bold truncate">LinkedIn</span>
                </button>

                {/* Pinterest */}
                <button
                  onClick={() => {
                    const text = socialSharePost.caption || 'Check out this media!';
                    const url = socialSharePost.mediaUrl || window.location.href;
                    window.open(`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&description=${encodeURIComponent(text)}`, '_blank');
                  }}
                  className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 transition-all border border-rose-200/60 group active:scale-95 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center mb-1 shadow-xs font-bold text-xs">
                    📌
                  </div>
                  <span className="text-[10px] font-bold truncate">Pinterest</span>
                </button>

                {/* Flickr */}
                <button
                  onClick={() => {
                    window.open(`https://www.flickr.com/tools/`, '_blank');
                  }}
                  className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-pink-50 hover:bg-pink-100 text-pink-700 transition-all border border-pink-200/60 group active:scale-95 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-pink-500 text-white flex items-center justify-center mb-1 shadow-xs font-bold text-xs">
                    🌸
                  </div>
                  <span className="text-[10px] font-bold truncate">Flickr</span>
                </button>

                {/* Email */}
                <button
                  onClick={() => {
                    const text = socialSharePost.caption || 'Check out this post on IMChat!';
                    const url = socialSharePost.mediaUrl || window.location.href;
                    window.open(`mailto:?subject=${encodeURIComponent('Shared Post from IMChat')}&body=${encodeURIComponent(text + '\n\n' + url)}`, '_blank');
                  }}
                  className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-800 transition-all border border-amber-200/60 group active:scale-95 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center mb-1 shadow-xs font-bold text-xs">
                    ✉️
                  </div>
                  <span className="text-[10px] font-bold truncate">Email</span>
                </button>

                {/* Bluetooth / Nearby Share */}
                <button
                  onClick={async () => {
                    const text = socialSharePost.caption || 'Check out this media on IMChat';
                    const url = socialSharePost.mediaUrl || window.location.href;
                    if (navigator.share) {
                      try {
                        await navigator.share({ title: 'IMChat Share', text, url });
                      } catch (err) {
                        console.log('Share canceled:', err);
                      }
                    } else {
                      await navigator.clipboard.writeText(url);
                      alert('📶 Bluetooth Share Beam: Post link copied to clipboard for Bluetooth device transfer!');
                    }
                  }}
                  className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 transition-all border border-indigo-200/60 group active:scale-95 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center mb-1 shadow-xs font-bold text-xs">
                    📶
                  </div>
                  <span className="text-[10px] font-bold truncate">Bluetooth</span>
                </button>

                {/* Favicon / Site Direct Link */}
                <button
                  onClick={async () => {
                    const url = socialSharePost.mediaUrl || window.location.href;
                    try {
                      await navigator.clipboard.writeText(url);
                      alert('🌐 Site Favicon Link: Post link copied to clipboard!');
                    } catch (e) {
                      alert('Failed to copy: ' + e);
                    }
                  }}
                  className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-teal-50 hover:bg-teal-100 text-teal-800 transition-all border border-teal-200/60 group active:scale-95 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center mb-1 shadow-xs font-bold text-xs">
                    🌐
                  </div>
                  <span className="text-[10px] font-bold truncate">Favicon</span>
                </button>
              </div>

              {/* Copy Link Direct Button */}
              <button
                onClick={async () => {
                  const url = socialSharePost.mediaUrl || window.location.href;
                  try {
                    await navigator.clipboard.writeText(url);
                    alert('📋 Post link copied to clipboard!');
                    setSocialSharePost(null);
                  } catch (e) {
                    alert('Failed to copy: ' + e);
                  }
                }}
                className="w-full mt-2 py-2.5 px-4 bg-gray-900 hover:bg-black text-white font-bold rounded-2xl text-xs transition-all active:scale-98 flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                <Link2 className="w-4 h-4" /> Copy Direct Link
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Tag Users Selector Modal */}
      <AnimatePresence>
        {showTagSelectorModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-5 w-full max-w-md shadow-2xl border border-gray-100 flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2 text-indigo-700">
                  <Tag className="w-5 h-5" />
                  <h3 className="font-extrabold text-base">Tag Users in Post</h3>
                </div>
                <button
                  onClick={() => setShowTagSelectorModal(false)}
                  className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              {/* Tag Search Input */}
              <div className="relative my-3">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search users to tag..."
                  value={tagUserSearch}
                  onChange={(e) => setTagUserSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-2xl text-xs bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                />
              </div>

              {/* User List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 my-1">
                {finalSuggested
                  .filter(u => u.name.toLowerCase().includes(tagUserSearch.toLowerCase()))
                  .map((u) => {
                    const isTagged = taggedUserNames.includes(u.name);
                    return (
                      <div
                        key={u.id}
                        className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-gray-50 border border-gray-100 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <UserAvatar src={u.avatar} name={u.name} size="sm" />
                          <div className="min-w-0 text-left">
                            <p className="text-xs font-bold text-gray-900 truncate">{u.name}</p>
                            <p className="text-[10px] text-gray-400 truncate">@{u.id}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (isTagged) {
                              setTaggedUserNames(prev => prev.filter(n => n !== u.name));
                            } else {
                              setTaggedUserNames(prev => [...prev, u.name]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isTagged
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                          }`}
                        >
                          {isTagged ? '✓ Tagged' : '+ Tag'}
                        </button>
                      </div>
                    );
                  })}
              </div>

              <button
                type="button"
                onClick={() => setShowTagSelectorModal(false)}
                className="w-full mt-3 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-xs transition-all active:scale-98 shadow-md cursor-pointer"
              >
                Done Tagging ({taggedUserNames.length})
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FFmpeg Video Transcoder & Frame Extractor Modal */}
      <AnimatePresence>
        {showTranscoderModal && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 text-white rounded-3xl p-5 w-full max-w-lg shadow-2xl border border-slate-700 flex flex-col max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                <div className="flex items-center gap-2 text-purple-400">
                  <Video className="w-5 h-5" />
                  <h3 className="font-extrabold text-base">FFmpeg Transcoder & Frame Extractor</h3>
                </div>
                <button
                  onClick={() => setShowTranscoderModal(false)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Video Player Box */}
              <div className="relative bg-black rounded-2xl overflow-hidden border border-slate-800 flex flex-col items-center justify-center">
                <video
                  ref={transcoderVideoRef}
                  src={composeMediaUrl || (attachedReel ? attachedReel.videoUrl : 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4')}
                  controls
                  crossOrigin="anonymous"
                  className="w-full max-h-[200px] object-contain rounded-2xl"
                />
              </div>

              {/* Tool 1: Frame Extractor */}
              <div className="mt-4 bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/70 text-left space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4" /> 1. Video Frame Extractor
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const videoEl = transcoderVideoRef.current;
                      if (!videoEl) return;
                      try {
                        const canvas = document.createElement('canvas');
                        canvas.width = videoEl.videoWidth || 640;
                        canvas.height = videoEl.videoHeight || 360;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
                          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                          setExtractedFrameUrl(dataUrl);
                          setComposeReelThumbnailUrl(dataUrl);
                          if (attachedReel) {
                            setAttachedReel({ ...attachedReel, thumbnailUrl: dataUrl });
                          }
                          alert('📷 Frame captured and applied as Reel Video Thumbnail!');
                        }
                      } catch (err) {
                        console.error('Frame extraction:', err);
                        alert('Could not capture frame directly due to browser CORS security policies. You can manually enter any image URL above.');
                      }
                    }}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1 shadow-sm"
                  >
                    <span>📷 Capture Frame as Thumbnail</span>
                  </button>
                </div>

                {extractedFrameUrl && (
                  <div className="flex items-center gap-3 bg-slate-900/90 p-2 rounded-xl border border-purple-500/40">
                    <img src={extractedFrameUrl} className="w-16 h-12 object-cover rounded-lg border border-purple-400/50" alt="Extracted Frame" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-purple-300">Thumbnail Extracted!</p>
                      <p className="text-[10px] text-slate-400">Applied to Reel Post Thumbnail.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Tool 2: FFmpeg Video Transcoder */}
              <div className="mt-4 bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/70 text-left space-y-3">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> 2. FFmpeg Video Transcoder Settings
                </span>

                <div className="grid grid-cols-2 gap-2.5">
                  {/* Resolution */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Resolution</label>
                    <select
                      value={transcodePreset}
                      onChange={(e) => setTranscodePreset(e.target.value as any)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 font-bold focus:outline-none focus:border-indigo-500"
                    >
                      <option value="1080p">1080p (Full HD)</option>
                      <option value="720p">720p (HD)</option>
                      <option value="480p">480p (SD)</option>
                      <option value="360p">360p (Low)</option>
                    </select>
                  </div>

                  {/* Format */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Output Format</label>
                    <select
                      value={transcodeFormat}
                      onChange={(e) => setTranscodeFormat(e.target.value as any)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 font-bold focus:outline-none focus:border-indigo-500"
                    >
                      <option value="mp4">MP4 (H.264 / AAC)</option>
                      <option value="webm">WebM (VP9 / Opus)</option>
                      <option value="gif">GIF (Animated Frame)</option>
                    </select>
                  </div>

                  {/* Framerate */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Framerate</label>
                    <select
                      value={transcodeFps}
                      onChange={(e) => setTranscodeFps(Number(e.target.value))}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 font-bold focus:outline-none focus:border-indigo-500"
                    >
                      <option value={30}>30 FPS (Standard)</option>
                      <option value={60}>60 FPS (Smooth)</option>
                    </select>
                  </div>

                  {/* Audio Bitrate */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Audio Quality</label>
                    <select
                      value={transcodeAudioBitrate}
                      onChange={(e) => setTranscodeAudioBitrate(e.target.value as any)}
                      className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 font-bold focus:outline-none focus:border-indigo-500"
                    >
                      <option value="128k">128 kbps</option>
                      <option value="192k">192 kbps (Standard)</option>
                      <option value="320k">320 kbps (High Quality)</option>
                    </select>
                  </div>
                </div>

                {/* Transcode Progress Bar */}
                {transcodeIsProcessing && (
                  <div className="space-y-1.5 bg-slate-900/90 p-3 rounded-xl border border-indigo-500/50">
                    <div className="flex justify-between text-xs font-bold text-indigo-300">
                      <span>FFmpeg Processing Video...</span>
                      <span>{transcodeProgress}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
                        animate={{ width: `${transcodeProgress}%` }}
                        transition={{ ease: 'linear' }}
                      />
                    </div>
                  </div>
                )}

                {transcodeOutputUrl && !transcodeIsProcessing && (
                  <div className="bg-emerald-950/60 border border-emerald-500/50 p-2.5 rounded-xl flex items-center justify-between text-xs text-emerald-300 font-bold">
                    <span>✅ Transcoding complete ({transcodePreset} - {transcodeFormat.toUpperCase()})</span>
                    <button
                      type="button"
                      onClick={() => {
                        setComposeMediaUrl(transcodeOutputUrl);
                        setShowTranscoderModal(false);
                        alert("Transcoded video applied to post!");
                      }}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer"
                    >
                      Apply to Post
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  disabled={transcodeIsProcessing}
                  onClick={() => {
                    setTranscodeIsProcessing(true);
                    setTranscodeProgress(0);
                    const interval = setInterval(() => {
                      setTranscodeProgress(prev => {
                        if (prev >= 100) {
                          clearInterval(interval);
                          setTranscodeIsProcessing(false);
                          setTranscodeOutputUrl(composeMediaUrl || (attachedReel ? attachedReel.videoUrl : 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'));
                          return 100;
                        }
                        return prev + 25;
                      });
                    }, 250);
                  }}
                  className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-xs transition-all active:scale-98 shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{transcodeIsProcessing ? 'Transcoding in Progress...' : '🚀 Run FFmpeg Transcode Simulation'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowTranscoderModal(false)}
                className="w-full mt-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl text-xs transition-all cursor-pointer"
              >
                Close FFmpeg Tools
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Auto-Scroll to Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            id="home-feed-scroll-to-top"
            initial={{ opacity: 0, scale: 0.6, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: 16 }}
            whileHover={{ scale: 1.1, y: -2 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            onClick={handleScrollToTop}
            aria-label="Auto-scroll to top"
            title="Auto-scroll to top"
            className="fixed bottom-20 sm:bottom-8 right-4 sm:right-7 z-40 p-3 bg-gradient-to-tr from-[#1da1f2] to-purple-600 hover:from-sky-500 hover:to-purple-500 text-white rounded-full shadow-lg shadow-sky-500/30 border border-white/20 backdrop-blur-md flex items-center justify-center group cursor-pointer transition-shadow select-none"
          >
            <ChevronUp className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform stroke-[2.5]" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Instagram Story Viewer Modal */}
      {viewingStory && (
        <InstagramStoryViewer
          initialStory={viewingStory}
          allStories={allStories}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          currentUserAvatar={MY_AVATAR}
          onClose={() => setViewingStory(null)}
          onSendMessage={(recipientId, recipientName, message) => {
            try {
              const raw = localStorage.getItem('imchat_local_conversations');
              const chats = raw ? JSON.parse(raw) : [];
              let chat = chats.find((c: any) => !c.isGroup && c.participants?.some((p: any) => p.id === recipientId || p === recipientId));
              const newMsg = {
                id: 'story_msg_' + Date.now(),
                senderId: currentUserId,
                text: message,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                createdAt: Date.now(),
                isRead: false
              };
              if (chat) {
                chat.messages = [...(chat.messages || []), newMsg];
              } else {
                chat = {
                  id: 'chat_' + recipientId + '_' + Date.now(),
                  name: recipientName,
                  participants: [{ id: recipientId, name: recipientName }, { id: currentUserId, name: currentUserName }],
                  messages: [newMsg],
                  isGroup: false,
                  unreadCount: 0
                };
                chats.push(chat);
              }
              localStorage.setItem('imchat_local_conversations', JSON.stringify(chats));
            } catch (e) {
              console.warn("Could not save story interaction to local conversations:", e);
            }
          }}
          onOpenProfile={(userId) => {
            setViewingStory(null);
            if (onUserSelected) {
              onUserSelected({ id: userId });
            }
            if (onNavigate) {
              onNavigate('profile');
            }
          }}
        />
      )}

      {/* Instagram Story Creator Modal */}
      {isCreatingStory && (
        <InstagramStoryCreator
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          currentUserAvatar={MY_AVATAR}
          currentUserRole={userRole}
          onClose={() => setIsCreatingStory(false)}
          onStoryCreated={() => {
            setIsCreatingStory(false);
          }}
        />
      )}
    </main>
  );
}
