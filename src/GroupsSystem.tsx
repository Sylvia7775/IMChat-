import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Plus, Search, Shield, Image as ImageIcon, ChevronRight, Hash, 
  MessageCircle, MoreVertical, X, Phone, Video, Edit2, Trash2, UserPlus, Ban, ArrowLeft,
  Smile, Star, BadgeCheck, Loader2, Clock, ListOrdered, ZoomIn, Download, Radio, Music, Play, Filter, Send, Camera
} from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import GiphyPicker from './components/GiphyPicker';
import UserAvatar from './components/UserAvatar';

import { GroupStore, Group, GroupMember, GroupPost, GroupRole } from './lib/GroupStore';
import { uploadToCloudinary } from './lib/cloudinary';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';

const BusinessStore = {
  logAdClick: (id: string) => console.log('ad click', id)
};

const fileToCompressedBase64 = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } else {
          resolve(e.target?.result as string || '');
        }
      };
      img.onerror = () => {
        resolve(e.target?.result as string || '');
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
};

const getGroupGradient = (title: string, id: string) => {
  const gradients = [
    'from-indigo-600 via-blue-600 to-indigo-800',
    'from-emerald-500 via-teal-600 to-emerald-700',
    'from-purple-600 via-fuchsia-600 to-pink-800',
    'from-rose-500 via-red-500 to-orange-600',
    'from-violet-600 via-indigo-600 to-blue-700',
    'from-cyan-500 via-sky-600 to-blue-800',
  ];
  let code = 0;
  const str = (title || '') + (id || '');
  for (let i = 0; i < str.length; i++) {
    code += str.charCodeAt(i);
  }
  return gradients[code % gradients.length];
};

const getGroupInitials = (title: string): string => {
  if (!title) return "GP";
  const words = title.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return title.trim().substring(0, 2).toUpperCase();
};

const isCustomCover = (url?: string): boolean => {
  if (!url) return false;
  if (url.includes('images.unsplash.com/photo-1522071820081-009f0129c71c')) return false;
  return true;
};

interface GroupsSystemProps {
  currentUserId: string;
  currentUserName: string;
  profileImg: string;
  followingState?: Record<string, boolean>;
  onToggleFollow?: (userId: string) => void;
}

export default function GroupsSystem({ 
  currentUserId, 
  currentUserName, 
  profileImg,
  followingState = {},
  onToggleFollow
}: GroupsSystemProps) {
  const [generalUsers, setGeneralUsers] = useState<any[]>([]);
  useEffect(() => {
    const fetchGeneralUsers = async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        const list: any[] = [];
        snap.forEach((doc: any) => {
          if (doc.id !== currentUserId) {
            list.push({ id: doc.id, ...doc.data() });
          }
        });
        setGeneralUsers(list);
      } catch (e) {
        console.warn("Failed to load users for group suggestions", e);
      }
    };
    fetchGeneralUsers();
  }, [currentUserId]);

  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const handleTakeScreenshot = () => {
    if (!activeGroup) return;
    setIsCapturing(true);

    // Play visual shutter flash
    const flashEl = document.createElement('div');
    flashEl.className = 'fixed inset-0 bg-white z-[9999] pointer-events-none transition-opacity duration-300 opacity-100';
    document.body.appendChild(flashEl);
    setTimeout(() => {
      flashEl.style.opacity = '0';
      setTimeout(() => flashEl.remove(), 300);
    }, 50);

    // Try to draw the conversation onto Canvas
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 750;
      canvas.height = 1100;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw elegant dark-slate gradient background
        const grad = ctx.createLinearGradient(0, 0, 0, 1100);
        grad.addColorStop(0, '#0F172A'); // Slate 900
        grad.addColorStop(1, '#1E293B'); // Slate 800
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 750, 1100);

        // Draw upper glassmorphic phone header bar
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(0, 0, 750, 130);
        
        // Draw top phone status icons (time, wifi, battery)
        ctx.fillStyle = '#94A3B8';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('09:41 AM', 45, 35);
        ctx.fillText('📶 🔋 100%', 650, 35);

        // Draw Group Title and Details
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText(activeGroup.title || 'IMChat Group', 110, 85);
        
        ctx.fillStyle = '#38BDF8'; // cyan-400
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(`${activeGroup.members.length} Active Members • Secure Conversation`, 110, 110);

        // Draw visual group avatar circle
        ctx.fillStyle = '#0284C7'; // sky-600
        ctx.beginPath();
        ctx.arc(60, 90, 30, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(getGroupInitials(activeGroup.title), 60, 98);
        ctx.textAlign = 'left'; // reset

        // Get recent group posts
        const activePosts = (activeGroup.posts || []).slice(0, 4);
        let startY = 190;

        if (activePosts.length === 0) {
          ctx.fillStyle = '#94A3B8';
          ctx.font = 'italic 18px sans-serif';
          ctx.fillText('No posts in this conversation yet.', 60, startY + 100);
        } else {
          activePosts.forEach((post, pIdx) => {
            // Draw message bubble card background
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.beginPath();
            ctx.roundRect(40, startY, 670, 175, 16);
            ctx.fill();

            // Author name and badge
            ctx.fillStyle = '#38BDF8';
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText(post.authorName || 'Member', 60, startY + 40);

            // Post content text wrapped safely
            ctx.fillStyle = '#E2E8F0';
            ctx.font = '16px sans-serif';
            const postText = post.content || 'Shared a media link';
            // Wrap text helper
            const words = postText.split(' ');
            let line = '';
            let lineY = startY + 75;
            for (let n = 0; n < words.length; n++) {
              let testLine = line + words[n] + ' ';
              let metrics = ctx.measureText(testLine);
              if (metrics.width > 550 && n > 0) {
                ctx.fillText(line, 60, lineY);
                line = words[n] + ' ';
                lineY += 25;
              } else {
                line = testLine;
              }
            }
            ctx.fillText(line, 60, lineY);

            // Draw timestamp
            ctx.fillStyle = '#64748B';
            ctx.font = '12px sans-serif';
            ctx.fillText(new Date(post.timestamp).toLocaleString(), 60, startY + 145);

            // Visual attachment indicator if exists
            if (post.mediaUrl) {
              ctx.fillStyle = '#10B981';
              ctx.font = 'bold 12px sans-serif';
              ctx.fillText('📎 Media Attachment Attached', 530, startY + 145);
            }

            startY += 205;
          });
        }

        // Draw styled watermark at the bottom of the screenshot
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(0, 1010, 750, 90);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText('IMChat Secure Conversation App', 50, 1050);

        ctx.fillStyle = '#94A3B8';
        ctx.font = '13px sans-serif';
        ctx.fillText('Encrypted • Verified Screenshot', 50, 1075);

        ctx.fillStyle = '#64748B';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('DOWNLOADED VIA IMCHAT PREVIEWS', 480, 1060);

        const dataUrl = canvas.toDataURL('image/png');
        setScreenshotPreview(dataUrl);
        setShowScreenshotModal(true);
      }
    } catch (err) {
      console.error("Screenshot capture failed:", err);
    } finally {
      setIsCapturing(false);
    }
  };

  const getGroupFollowSuggestions = () => {
    const memberSuggestions = (activeGroup?.members || [])
      .filter(m => m.userId !== currentUserId)
      .map(m => ({
        id: m.userId,
        name: m.name,
        avatar: m.avatar,
        isVerified: false,
        bio: 'Group Member'
      }));

    const fallbackSuggestions = [
      { id: 'user_dan_abramov', name: 'Dan Abramov', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Dan', isVerified: true, bio: 'React Core Developer' },
      { id: 'user_alex_river', name: 'AlexRiver', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Alex', isVerified: false, bio: 'Digital Creator' },
      { id: 'user_nature_walks', name: 'NatureWalks', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Nature', isVerified: false, bio: 'Outdoor enthusiast' },
      { id: 'user_sophie_dev', name: 'Sophie_Dev', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Sophie', isVerified: true, bio: 'Tech Lead • open source contributor' },
      { id: 'user_cyber_nomad', name: 'CyberNomad', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Cyber', isVerified: false, bio: 'Vibe designer & indie hacker' }
    ];

    const combined = [...memberSuggestions, ...generalUsers, ...fallbackSuggestions];
    const unique = combined.filter((item, index, self) => self.findIndex(t => t.id === item.id) === index);
    return unique.filter(u => u.id !== currentUserId && !followingState[u.id]).slice(0, 5);
  };

  const [groups, setGroups] = useState<Group[]>([]);
  const [listSubTab, setListSubTab] = useState<'explore' | 'activity'>('explore');
  const [activeGroupId, setActiveGroupId] = useState<string | null>(() => {
    return localStorage.getItem('explore_open_group_id') || null;
  });
  
  useEffect(() => {
    const fetchGroups = () => setGroups(GroupStore.getGroups());
    fetchGroups();
    return GroupStore.subscribe(fetchGroups);
  }, []);

  const [view, setView] = useState<'list' | 'create' | 'detail' | 'invite'>(() => {
    const override = localStorage.getItem('explore_open_group_id');
    if (override) {
      localStorage.removeItem('explore_open_group_id');
      return 'detail';
    }
    return 'list';
  });

  // Create Group Form Statete
  const [cgTitle, setCgTitle] = useState('');
  const [cgDesc, setCgDesc] = useState('');
  const [cgCover, setCgCover] = useState('');
  const [cgCoverFile, setCgCoverFile] = useState<File | null>(null);
  const [cgPrivate, setCgPrivate] = useState(false);

  // Edit Group Name State
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [editGroupTitle, setEditGroupTitle] = useState('');
  const [editGroupDesc, setEditGroupDesc] = useState('');
  const [editGroupCover, setEditGroupCover] = useState('');
  const [editGroupCoverFile, setEditGroupCoverFile] = useState<File | null>(null);
  const [isSavingGroup, setIsSavingGroup] = useState(false);

  // Post / Interaction State
  const [postInput, setPostInput] = useState('');
  const [topicInput, setTopicInput] = useState('');
  const [searchUsers, setSearchUsers] = useState('');
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [showGiphy, setShowGiphy] = useState(false);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false);
  
  const [groupTab, setGroupTab] = useState<'feed' | 'gallery'>('feed');
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'photo' | 'video' | 'audio'>('all');
  const [lightboxImage, setLightboxImage] = useState<{url: string; uploaderName: string; timestamp: number} | null>(null);

  // New Styled Composer states & refs
  const [composerPhotoFile, setComposerPhotoFile] = useState<File | null>(null);
  const [composerVideoFile, setComposerVideoFile] = useState<File | null>(null);
  const [composerAudioFile, setComposerAudioFile] = useState<File | null>(null);
  const [composerMediaPreview, setComposerMediaPreview] = useState<string | null>(null);
  const [composerMediaType, setComposerMediaType] = useState<'image' | 'video' | 'audio' | 'live' | null>(null);
  const [isLiveSimulating, setIsLiveSimulating] = useState(false);
  const [isPostingRichMedia, setIsPostingRichMedia] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const activeGroup = groups.find(g => g.id === activeGroupId);
  const myRole = activeGroup?.members.find(m => m.userId === currentUserId)?.role;
  const isMember = !!myRole;
  const isAdmin = myRole === 'owner' || myRole === 'moderator';

  const [isUploading, setIsUploading] = useState(false);

  const handleCreateGroup = async () => {
    if (!cgTitle.trim()) return;

    setIsUploading(true);
    try {
      let finalCover = '';
      const groupUid = `im_g_${Date.now()}`;
      if (cgCoverFile) {
        try {
          const res = await uploadToCloudinary(cgCoverFile, 'image', groupUid);
          if (res && res.secure_url) {
            finalCover = res.secure_url;
          } else {
            finalCover = await fileToCompressedBase64(cgCoverFile);
          }
        } catch (e) {
          finalCover = await fileToCompressedBase64(cgCoverFile);
        }
      }

      await GroupStore.addGroup({
        uid: groupUid,
        title: cgTitle,
        description: cgDesc,
        coverUrl: finalCover,
        isPrivate: false,
        members: [{ userId: currentUserId, name: currentUserName, role: 'owner', avatar: profileImg }],
      });

      setView('list');
      setCgTitle('');
      setCgDesc('');
      setCgCover('');
      setCgCoverFile(null);
    } catch (err) {
      console.error("Group creation failed:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    const userRole = group?.members.find(m => m.userId === currentUserId)?.role;
    if (userRole !== 'owner') {
      alert("Permission denied. Only users with the 'owner' role are permitted to delete this group.");
      return;
    }
    if (confirm("Are you sure you want to completely delete this group?")) {
      try {
        await GroupStore.deleteGroup(groupId);
        setView('list');
      } catch (err: any) {
        alert(err.message || "Failed to delete group.");
      }
    }
  };

  const handleJoin = async (groupId: string) => {
    GroupStore.joinGroup(groupId, { userId: currentUserId, name: currentUserName, role: 'member', avatar: profileImg }).catch(err => console.error("Join group fail:", err));
    GroupStore.addPost(groupId, {
      authorId: 'system',
      authorName: 'System',
      content: `${currentUserName} joined the group.`,
      topic: 'System',
    }).catch(err => console.error("Join notice fail:", err));
  };

  const handleLeave = async (groupId: string) => {
    GroupStore.leaveGroup(groupId, currentUserId).catch(err => console.error("Leave group fail:", err));
    GroupStore.addPost(groupId, {
      authorId: 'system',
      authorName: 'System',
      content: `${currentUserName} left the group.`,
      topic: 'System',
    }).catch(err => console.error("Leave notice fail:", err));
    setView('list');
    setShowLeaveConfirmation(false);
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setComposerPhotoFile(file);
      setComposerVideoFile(null);
      setComposerAudioFile(null);
      setIsLiveSimulating(false);
      setComposerMediaType('image');
      
      const reader = new FileReader();
      reader.onload = (event) => {
        setComposerMediaPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGroupPostPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          setComposerPhotoFile(file);
          setComposerVideoFile(null);
          setComposerAudioFile(null);
          setIsLiveSimulating(false);
          setComposerMediaType('image');
          
          const reader = new FileReader();
          reader.onload = (event) => {
            setComposerMediaPreview(event.target?.result as string);
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    }
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setComposerVideoFile(file);
      setComposerPhotoFile(null);
      setComposerAudioFile(null);
      setIsLiveSimulating(false);
      setComposerMediaType('video');
      setComposerMediaPreview(URL.createObjectURL(file));
    }
  };

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setComposerAudioFile(file);
      setComposerPhotoFile(null);
      setComposerVideoFile(null);
      setIsLiveSimulating(false);
      setComposerMediaType('audio');
      setComposerMediaPreview(file.name);
    }
  };

  const handleTriggerLiveSim = () => {
    setIsLiveSimulating(true);
    setComposerPhotoFile(null);
    setComposerVideoFile(null);
    setComposerAudioFile(null);
    setComposerMediaType('live');
    setComposerMediaPreview('simulated-live-stream');
  };

  const handleRemoveAttachedMedia = () => {
    setComposerPhotoFile(null);
    setComposerVideoFile(null);
    setComposerAudioFile(null);
    setComposerMediaPreview(null);
    setComposerMediaType(null);
    setIsLiveSimulating(false);
  };

  const handleCreatePost = async () => {
    if (!activeGroupId) return;
    if (!postInput.trim() && !composerPhotoFile && !composerVideoFile && !composerAudioFile && !isLiveSimulating) {
      alert("Please enter a message or attach a file to post.");
      return;
    }

    setIsPostingRichMedia(true);
    
    try {
      let finalMediaUrl = undefined;
      
      if (composerPhotoFile) {
        const res = await uploadToCloudinary(composerPhotoFile, 'image');
        if (res && res.secure_url) {
          finalMediaUrl = res.secure_url;
        }
      } else if (composerVideoFile) {
        const res = await uploadToCloudinary(composerVideoFile, 'video');
        if (res && res.secure_url) {
          finalMediaUrl = res.secure_url;
        }
      } else if (composerAudioFile) {
        const res = await uploadToCloudinary(composerAudioFile, 'video');
        if (res && res.secure_url) {
          finalMediaUrl = res.secure_url;
        }
      } else if (isLiveSimulating) {
        finalMediaUrl = 'https://www.w3schools.com/html/mov_bbb.mp4';
      }

      // Extract tagged users
      const tags = postInput.match(/@(\w+)/g)?.map(tag => tag.substring(1)) || [];
      
      await GroupStore.addPost(activeGroupId, {
        authorId: currentUserId,
        authorName: currentUserName,
        content: isLiveSimulating ? (postInput.trim() ? `${postInput.trim()} (🔴 Live Stream)` : '¡Transmisión en vivo iniciada! 🔴 / Started Live Stream!') : postInput,
        topic: topicInput || undefined,
        taggedUsers: tags,
        mediaUrl: finalMediaUrl
      });

      // Reset composer state
      setPostInput('');
      setTopicInput('');
      setShowTagMenu(false);
      setComposerPhotoFile(null);
      setComposerVideoFile(null);
      setComposerAudioFile(null);
      setComposerMediaPreview(null);
      setComposerMediaType(null);
      setIsLiveSimulating(false);
    } catch (err) {
      console.error("Failed to create rich group post:", err);
      alert("There was an error creating your post.");
    } finally {
      setIsPostingRichMedia(false);
    }
  };

  const handleInputChange = (val: string) => {
    setPostInput(val);
    const lastAtPos = val.lastIndexOf('@');
    if (lastAtPos !== -1 && lastAtPos >= val.length - 10) {
      const query = val.substring(lastAtPos + 1);
      if (!query.includes(' ')) {
        setTagSearch(query);
        setShowTagMenu(true);
        return;
      }
    }
    setShowTagMenu(false);
  };

  const insertTag = (name: string) => {
    const lastAtPos = postInput.lastIndexOf('@');
    const newVal = postInput.substring(0, lastAtPos) + `@${name} ` + postInput.substring(postInput.length);
    setPostInput(newVal);
    setShowTagMenu(false);
  };

  const handleSendGif = async (url: string) => {
    if (!activeGroupId) return;
    GroupStore.addPost(activeGroupId, {
      authorId: currentUserId,
      authorName: currentUserName,
      content: '',
      mediaUrl: url,
    }).catch(err => console.error("GIF post fail:", err));
    setShowGiphy(false);
  };

  const handleToggleRole = async (groupId: string, userId: string) => {
    const g = groups.find(g => g.id === groupId);
    if (!g) return;
    const member = g.members.find(m => m.userId === userId);
    if (!member) return;

    const newRole: GroupRole = member.role === 'member' ? 'moderator' : 'member';
    const updatedMembers = g.members.map(m => m.userId === userId ? { ...m, role: newRole } : m);
    
    GroupStore.updateGroup(groupId, { members: updatedMembers }).catch(err => console.error("Role toggle fail:", err));
  };

  const handleDeletePost = async (groupId: string, postId: string) => {
    const g = groups.find(g => g.id === groupId);
    if (!g) return;
    const updatedPosts = g.posts.filter(p => p.id !== postId);
    GroupStore.updateGroup(groupId, { posts: updatedPosts }).catch(err => console.error("Post delete fail:", err));
  };

  const handleBanUser = async (groupId: string, userId: string) => {
    if (confirm("Ban this user from the group?")) {
      const g = groups.find(g => g.id === groupId);
      if (!g) return;
      const updatedMembers = g.members.filter(m => m.userId !== userId);
      GroupStore.updateGroup(groupId, { members: updatedMembers }).catch(err => console.error("Ban fail:", err));
    }
  };

  const handleInviteFakeUser = () => {
    if (!searchUsers) return;
    alert(`Invitation sent to ${searchUsers}! They have been notified.`);
    setSearchUsers('');
    setView('detail');
  };

  if (view === 'create') {
    return (
      <div className="flex flex-col h-full bg-gray-50 absolute inset-0 z-50">
        <header className="bg-white p-4 flex items-center justify-between border-b border-gray-100 sticky top-0 shadow-sm z-10">
          <button onClick={() => setView('list')} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full active:scale-95"><X className="w-6 h-6"/></button>
          <h1 className="font-bold text-lg text-gray-900 tracking-tight">Agregar Grupo / Add Group</h1>
          <div className="w-10"></div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
             <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1">Cargar Portada / Upload Group Cover</label>
             <div className="relative w-full h-44 bg-gray-150 rounded-2xl overflow-hidden group border border-gray-200 shadow-sm flex flex-col items-center justify-center">
               {cgCover ? (
                 <>
                   <img src={cgCover} className="w-full h-full object-cover absolute inset-0 animate-fade-in" alt="Group Cover" />
                   <div className="absolute inset-0 bg-black/45 pointer-events-none" />
                 </>
               ) : (
                 <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 flex flex-col items-center justify-center text-gray-400 p-4">
                   <Users className="w-10 h-10 mb-2 text-gray-400 opacity-70" />
                   <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 opacity-80 text-center">Un cover dinámico será asignado / Dynamic placeholder will be assigned</span>
                 </div>
               )}
               <label className="relative z-10 bg-black/70 backdrop-blur-md hover:bg-black/90 active:scale-95 px-5 py-2.5 rounded-full flex items-center justify-center transition-all cursor-pointer text-white font-bold text-xs uppercase tracking-wider gap-2 shadow-lg border border-white/20">
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setCgCover(URL.createObjectURL(file));
                        setCgCoverFile(file);
                      }
                    }} 
                  />
                  <ImageIcon className="w-4 h-4 text-white animate-pulse" /> Cargar Portada / Upload Cover
               </label>
             </div>

             {/* URL Fast Upload Input */}
             <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-2.5 mt-1">
               <div className="flex items-center justify-between">
                 <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Fast Upload via URL / Pegar URL de Imagen</span>
                 {cgCover && (
                   <button 
                     type="button" 
                     onClick={() => { setCgCover(''); setCgCoverFile(null); }}
                     className="text-[10px] text-red-500 font-bold hover:underline"
                   >
                     Clear Cover
                   </button>
                 )}
               </div>
               
               <input 
                 type="text" 
                 placeholder="https://images.unsplash.com/photo-..." 
                 value={cgCover.startsWith('blob:') ? '' : cgCover}
                 onChange={e => {
                   const val = e.target.value.trim();
                   setCgCover(val);
                   setCgCoverFile(null); // Clear file when URL is used
                 }}
                 className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
               />

               {/* Preset URL Fast Options */}
               <div className="flex flex-col gap-1.5">
                 <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Fast URL Presets (Click to instantly upload):</span>
                 <div className="grid grid-cols-4 gap-1.5">
                   {[
                     { name: 'Tech', url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop' },
                     { name: 'Creative', url: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&auto=format&fit=crop' },
                     { name: 'Music', url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop' },
                     { name: 'Team', url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop' }
                   ].map((preset) => (
                     <button
                       key={preset.name}
                       type="button"
                       onClick={() => {
                         setCgCover(preset.url);
                         setCgCoverFile(null);
                       }}
                       className={`py-1 px-2 border rounded-md text-[10px] font-bold transition-all truncate text-center ${
                         cgCover === preset.url 
                           ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                           : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                       }`}
                     >
                       {preset.name}
                     </button>
                   ))}
                 </div>
               </div>
             </div>
            </div>

           <div className="flex flex-col gap-2">
             <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1">Nombre del Grupo / Group Title</label>
             <input type="text" value={cgTitle} onChange={e => setCgTitle(e.target.value)} placeholder="e.g. IMChat Developers, Friends Group" className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-900 font-semibold outline-none focus:border-brand-blue transition-colors shadow-sm" />
           </div>

           <div className="flex flex-col gap-2">
             <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1">Descripción / Description</label>
             <textarea value={cgDesc} onChange={e => setCgDesc(e.target.value)} placeholder="What is this group about?" rows={3} className="w-full bg-white border border-gray-200 rounded-xl p-4 text-gray-900 text-sm outline-none resize-none focus:border-brand-blue transition-colors shadow-sm" />
           </div>

           <div className="flex flex-col gap-2">
             <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1">Privacidad: Público / Privacy: Public (Todos los grupos son públicos por defecto)</label>
             <div className="hidden">
               <button onClick={() => setCgPrivate(false)} className={`flex-1 py-2 font-bold text-xs uppercase tracking-wider rounded-lg transition-colors ${!cgPrivate ? 'bg-brand-blue text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>Público / Public</button>
               <button onClick={() => setCgPrivate(true)} className={`flex-1 py-2 font-bold text-xs uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1.5 ${cgPrivate ? 'bg-brand-blue text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>
                 <Shield className="w-4 h-4" /> Privado / Private
               </button>
             </div>
           </div>
        </div>

        <div className="p-4 bg-white border-t border-gray-100">
           <button 
             onClick={handleCreateGroup} 
             disabled={!cgTitle.trim() || isUploading} 
             className="w-full bg-brand-blue hover:bg-blue-600 text-white font-bold py-4 rounded-2xl active:scale-95 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3 disabled:opacity-[0.65] disabled:cursor-not-allowed text-sm uppercase tracking-wider"
           >
             {isUploading ? (
               <>
                 
                 <span>Enviar / Crear Grupo (Send details & process)</span>
               </>
             ) : (
               <span>Enviar / Crear Grupo (Send details & process)</span>
             )}
           </button>
         </div>
       </div>
    );
  }

  if (view === 'invite' && activeGroup) {
     return (
       <div className="flex flex-col h-full bg-white absolute inset-0 z-50">
         <header className="p-4 flex items-center gap-3 border-b border-gray-100">
           <button onClick={() => setView('detail')} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full active:scale-95"><ArrowLeft className="w-6 h-6"/></button>
           <h1 className="font-bold text-lg text-gray-900">Invite Members</h1>
         </header>
         <div className="p-4 flex flex-col gap-4">
           <p className="text-sm text-gray-500">Search existing users to invite to <strong className="text-gray-900">{activeGroup.title}</strong></p>
           <div className="flex bg-gray-100 rounded-xl p-3 items-center gap-2">
             <Search className="w-5 h-5 text-gray-400" />
             <input type="text" value={searchUsers} onChange={e=>setSearchUsers(e.target.value)} placeholder="Search handles or names..." className="bg-transparent outline-none flex-1 text-sm text-gray-900" />
           </div>
           {searchUsers && (
             <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex flex-col gap-2">
               <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-xl">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-brand-blue/10 rounded-full flex items-center justify-center text-brand-blue font-bold">U</div>
                   <span>{searchUsers}</span>
                 </div>
                 <button onClick={handleInviteFakeUser} className="bg-brand-blue text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-sm hover:focus:scale-95">Send Invite</button>
               </div>
             </motion.div>
           )}
         </div>
       </div>
     );
  }

  if (view === 'detail' && activeGroup) {
    return (
      <div className="flex flex-col h-full bg-gray-50 absolute inset-0 z-40 overflow-hidden">
        <header className="absolute top-0 left-0 right-0 z-20 flex justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
          <button onClick={() => { setActiveGroupId(null); setView('list'); }} className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 active:scale-95"><X className="w-5 h-5"/></button>
           {isMember && (
            <div className="flex gap-2">
              <button 
                onClick={handleTakeScreenshot}
                className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 active:scale-95 flex items-center justify-center relative transition-all"
                title="Take Conversation Screenshot"
              >
                <Camera className="w-5 h-5"/>
              </button>
              <button 
                onClick={() => {
                  const input = document.getElementById('group-post-input');
                  input?.focus();
                  input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 active:scale-95"
              >
                <MessageCircle className="w-5 h-5"/>
              </button>
              {myRole === 'owner' && (
                <button 
                  onClick={() => {
                    setEditGroupTitle(activeGroup.title);
                    setEditGroupDesc(activeGroup.description || '');
                    setEditGroupCover(activeGroup.coverUrl || '');
                    setEditGroupCoverFile(null);
                    setIsEditingGroup(true);
                  }} 
                  className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 active:scale-95 transition-all"
                  title="Editar Nombre del Grupo / Edit Group Name"
                >
                  <Edit2 className="w-5 h-5"/>
                </button>
              )}
              {myRole === 'owner' && <button onClick={() => handleDeleteGroup(activeGroup.id)} className="p-2 bg-red-500/80 backdrop-blur-md rounded-full text-white hover:bg-red-500 active:scale-95"><Trash2 className="w-5 h-5"/></button>}
              <div className="relative">
                <button onClick={() => setShowGroupMenu(!showGroupMenu)} className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 active:scale-95 transition-all">
                  <MoreVertical className="w-5 h-5" />
                </button>
                {showGroupMenu && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl overflow-hidden py-1 z-50 animate-in fade-in zoom-in duration-200">
                    <button onClick={() => { setShowGroupMenu(false); alert("Notifications muted for this group."); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 text-gray-700 text-sm font-semibold border-b border-gray-50 flex items-center gap-2">
                       Mute notifications
                    </button>
                    {myRole !== 'owner' && (
                       <button onClick={() => { setShowGroupMenu(false); setShowLeaveConfirmation(true); }} className="w-full text-left px-4 py-3 hover:bg-red-50 text-red-600 text-sm font-semibold flex items-center gap-2">
                         Leave group
                       </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="relative w-full h-[250px] shrink-0">
            {isCustomCover(activeGroup.coverUrl) ? (
              <img src={activeGroup.coverUrl} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${getGroupGradient(activeGroup.title, activeGroup.id)} flex items-center justify-center relative overflow-hidden`}>
                <div className="absolute inset-0 bg-black/15" />
                <div className="font-black text-4xl text-white tracking-widest bg-white/20 px-5 py-2.5 rounded-2xl backdrop-blur-md z-10">{getGroupInitials(activeGroup.title)}</div>
                <Users className="w-56 h-56 absolute -right-6 -bottom-6 text-white/10 rotate-12" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent"></div>
            <div className="absolute xl:bottom-4 bottom-4 left-4 right-4 flex flex-col gap-1.5">
               <div className="flex items-center gap-2">
                 {activeGroup.isPrivate && <Shield className="w-4 h-4 text-brand-blue" />}
                 <span className="bg-white/20 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">{activeGroup.uid}</span>
               </div>
               <div className="flex items-center gap-2.5">
                 <h1 className="font-extrabold text-3xl tracking-tight text-white leading-tight">{activeGroup.title}</h1>
                 {myRole === 'owner' && (
                   <button 
                     onClick={() => {
                       setEditGroupTitle(activeGroup.title);
                       setEditGroupDesc(activeGroup.description || '');
                       setEditGroupCover(activeGroup.coverUrl || '');
                       setEditGroupCoverFile(null);
                       setIsEditingGroup(true);
                     }}
                     className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white p-1.5 rounded-lg transition-all active:scale-95 hover:scale-105"
                     title="Editar Nombre / Edit Name"
                   >
                     <Edit2 className="w-3.5 h-3.5" />
                   </button>
                 )}
               </div>
               <p className="text-gray-300 text-sm">{activeGroup.description}</p>
            </div>
          </div>

          <div className="p-4 bg-white border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {activeGroup.members.slice(0,3).map(m => (
                  <UserAvatar 
                    key={m.userId} 
                    src={m.avatar} 
                    name={m.name}
                    size="xs"
                    className="border-2 border-white"
                  />
                ))}
              </div>
              <span className="text-sm font-semibold text-gray-700 ml-1">{activeGroup.members.length} Members</span>
            </div>
            {!isMember ? (
              <button onClick={() => handleJoin(activeGroup.id)} className="bg-brand-blue text-white font-bold px-5 py-2 rounded-full shadow-sm hover:shadow-md active:scale-95">Join Group</button>
            ) : (
              <div className="flex items-center gap-2">
                {myRole === 'owner' && (
                  <button 
                    onClick={() => {
                      setEditGroupTitle(activeGroup.title);
                      setEditGroupDesc(activeGroup.description || '');
                      setEditGroupCover(activeGroup.coverUrl || '');
                      setEditGroupCoverFile(null);
                      setIsEditingGroup(true);
                    }}
                    className="bg-blue-50 hover:bg-blue-100 text-brand-blue font-bold px-4 py-2 rounded-full shadow-sm active:scale-95 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5"/> Edit Group
                  </button>
                )}
                <button onClick={() => setView('invite')} className="bg-gray-100 text-gray-800 font-bold px-4 py-2 rounded-full shadow-sm hover:bg-gray-200 active:scale-95 flex items-center gap-1"><UserPlus className="w-4 h-4"/> Invite</button>
              </div>
            )}
          </div>

          {/* Members List (Admin view) */}
          {isAdmin && (
            <div className="p-4 bg-white mt-2 flex flex-col gap-3">
              <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
                <Shield className="w-4 h-4 text-brand-blue" /> Manage Members
              </h3>
              <div className="flex flex-col gap-2">
                {activeGroup.members.map(m => (
                  <div key={m.userId} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-2xl transition-all hover:border-blue-100">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <UserAvatar 
                          src={m.avatar} 
                          name={m.name}
                          size="md"
                          className="border border-gray-200"
                        />
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${m.role === 'owner' ? 'bg-yellow-500' : m.role === 'moderator' ? 'bg-brand-blue' : 'bg-gray-400'}`}></div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <div className="text-sm font-bold text-gray-900">{m.name}</div>
                          {(m.userId === currentUserId || m.name === 'Dan Abramov') && (
                            <BadgeCheck className="w-[14px] h-[14px] text-white fill-[#0095f6]" />
                          )}
                        </div>
                        <div className="text-[10px] uppercase font-bold text-brand-blue flex items-center gap-1">
                          {m.role === 'owner' ? <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" /> : <Shield className="w-3 h-3" />}
                          {m.role}
                        </div>
                      </div>
                    </div>
                    
                    {m.userId !== currentUserId && (
                      <div className="flex items-center gap-1">
                        {myRole === 'owner' && (
                          <button 
                            onClick={() => handleToggleRole(activeGroup.id, m.userId)}
                            className={`p-2 rounded-xl transition-colors ${m.role === 'moderator' ? 'bg-blue-100 text-brand-blue' : 'bg-gray-100 text-gray-400 hover:bg-blue-50 hover:text-brand-blue'}`}
                            title={m.role === 'moderator' ? "Demote to Member" : "Promote to Moderator"}
                          >
                            <Shield className="w-4 h-4"/>
                          </button>
                        )}
                        <button 
                          onClick={() => handleBanUser(activeGroup.id, m.userId)} 
                          className="p-2 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all active:scale-95"
                          title="Ban User"
                        >
                          <Ban className="w-4 h-4"/>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Group Tabs & Posts - only visible to members */}
          {isMember ? (
            <>
              <div className="flex border-b border-gray-100 bg-white sticky top-0 z-10 p-1 mt-2">
                <button 
                  onClick={() => setGroupTab('feed')} 
                  className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${groupTab === 'feed' ? 'text-brand-blue border-b-2 border-brand-blue' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  Feed
                </button>
                <button 
                  onClick={() => setGroupTab('gallery')} 
                  className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${groupTab === 'gallery' ? 'text-brand-blue border-b-2 border-brand-blue' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  Gallery
                </button>
              </div>

              <div className="p-4 flex flex-col gap-4">
                  {groupTab === 'gallery' ? (() => {
                    const postsWithMedia = activeGroup.posts.filter(p => p.mediaUrl);
                    
                    const filteredMediaPosts = postsWithMedia.filter(post => {
                      const url = post.mediaUrl!;
                      const isVideo = url.match(/\.(mp4|webm|mov|ogg|m4v)(\?|$)/i) || url.includes('mov_bbb') || url.includes('/video/upload/') || url.includes('simulated-live-stream');
                      const isAudio = url.match(/\.(mp3|wav|m4a|aac|flac)(\?|$)/i);
                      
                      if (galleryFilter === 'photo') {
                        return !isVideo && !isAudio;
                      } else if (galleryFilter === 'video') {
                        return isVideo;
                      } else if (galleryFilter === 'audio') {
                        return isAudio;
                      }
                      return true;
                    });

                    const photoPostsCount = postsWithMedia.filter(post => {
                      const url = post.mediaUrl!;
                      const isVideo = url.match(/\.(mp4|webm|mov|ogg|m4v)(\?|$)/i) || url.includes('mov_bbb') || url.includes('/video/upload/') || url.includes('simulated-live-stream');
                      const isAudio = url.match(/\.(mp3|wav|m4a|aac|flac)(\?|$)/i);
                      return !isVideo && !isAudio;
                    }).length;

                    const videoPostsCount = postsWithMedia.filter(post => {
                      const url = post.mediaUrl!;
                      return url.match(/\.(mp4|webm|mov|ogg|m4v)(\?|$)/i) || url.includes('mov_bbb') || url.includes('/video/upload/') || url.includes('simulated-live-stream');
                    }).length;

                    const audioPostsCount = postsWithMedia.filter(post => {
                      const url = post.mediaUrl!;
                      return url.match(/\.(mp3|wav|m4a|aac|flac)(\?|$)/i);
                    }).length;

                    return (
                      <div className="flex flex-col gap-4 w-full text-left">
                        {/* Filter Chips Bar */}
                        <div className="flex gap-2 pb-1 border-b border-gray-150 overflow-x-auto scrollbar-none select-none">
                          <button
                            type="button"
                            onClick={() => setGalleryFilter('all')}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                              galleryFilter === 'all' 
                                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/20' 
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                            }`}
                          >
                            All ({postsWithMedia.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setGalleryFilter('photo')}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                              galleryFilter === 'photo' 
                                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/20' 
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                            }`}
                          >
                            📸 Photos ({photoPostsCount})
                          </button>
                          <button
                            type="button"
                            onClick={() => setGalleryFilter('video')}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                              galleryFilter === 'video' 
                                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/20' 
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                            }`}
                          >
                            🎥 Videos ({videoPostsCount})
                          </button>
                          <button
                            type="button"
                            onClick={() => setGalleryFilter('audio')}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                              galleryFilter === 'audio' 
                                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/20' 
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                            }`}
                          >
                            🎵 Audios ({audioPostsCount})
                          </button>
                        </div>

                        {/* Gallery Content */}
                        {filteredMediaPosts.length === 0 ? (
                          <div className="py-16 flex flex-col items-center justify-center text-gray-400 text-center w-full">
                            <ImageIcon className="w-12 h-12 mb-3 text-purple-200 animate-pulse" />
                            <h4 className="font-bold text-gray-800 text-sm">No media found</h4>
                            <p className="text-xs text-gray-400 mt-1 max-w-[240px]">There are no items matching this category in the group gallery.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-1.5">
                            {filteredMediaPosts.map(post => {
                              const url = post.mediaUrl!;
                              const isVid = url.match(/\.(mp4|webm|mov|ogg|m4v)(\?|$)/i) || url.includes('mov_bbb') || url.includes('/video/upload/') || url.includes('simulated-live-stream');
                              const isAud = url.match(/\.(mp3|wav|m4a|aac|flac)(\?|$)/i);

                              if (isAud) {
                                return (
                                  <div 
                                    key={`gallery-${post.id}`}
                                    onClick={() => setLightboxImage({ url, uploaderName: post.authorName, timestamp: post.timestamp })}
                                    className="col-span-3 p-3 bg-gradient-to-r from-purple-50/60 to-pink-50/40 border border-purple-100/60 rounded-2xl flex items-center justify-between gap-3 hover:border-purple-300 transition-all cursor-pointer group"
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="p-3 bg-purple-500 text-white rounded-xl shadow-md shadow-purple-500/10 group-hover:scale-105 transition-transform">
                                        <Music className="w-4 h-4" />
                                      </div>
                                      <div className="truncate text-left min-w-0">
                                        <p className="text-xs font-extrabold text-purple-950 truncate">Vocal Clip Shared</p>
                                        <p className="text-[10px] text-gray-400 truncate mt-0.5">By {post.authorName} • {new Date(post.timestamp).toLocaleDateString()}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider font-extrabold">Audio</span>
                                      <ZoomIn className="w-4 h-4 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div 
                                  key={`gallery-${post.id}`} 
                                  className="aspect-square bg-gray-100 relative group overflow-hidden cursor-pointer rounded-xl border border-gray-150"
                                  onClick={() => setLightboxImage({ url, uploaderName: post.authorName, timestamp: post.timestamp })}
                                >
                                  {isVid ? (
                                    <>
                                      <video 
                                        src={url} 
                                        className="w-full h-full object-cover" 
                                        muted 
                                        loop 
                                        playsInline
                                      />
                                      <div className="absolute top-2 left-2 z-10 p-1.5 bg-black/60 rounded-lg text-white">
                                        <Play className="w-3.5 h-3.5" />
                                      </div>
                                    </>
                                  ) : (
                                    <img src={url} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" alt="Gallery item" />
                                  )}
                                  
                                  {/* Hover overlay details */}
                                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-end p-2 pb-3 text-center text-white backdrop-blur-[1px]">
                                    <ZoomIn className="w-5 h-5 mb-auto mt-2 text-purple-400 scale-90 group-hover:scale-100 transition-transform"/>
                                    <span className="font-extrabold text-[10px] leading-tight line-clamp-1">{post.authorName}</span>
                                    <span className="text-[8px] text-gray-300 uppercase font-black tracking-widest mt-0.5">{isVid ? 'Play Video' : 'Zoom Entry'}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })() : (() => {
                   const itemsToRender: any[] = [];
               const activeGroupAds: any[] = [];
               
               activeGroup.posts.forEach((post, index) => {
                 itemsToRender.push({ type: 'post', data: post });
                 if ((index + 1) % 3 === 0 && activeGroupAds.length > 0) {
                   const adIndex = Math.floor((index / 3) % activeGroupAds.length);
                   itemsToRender.push({ type: 'ad', data: activeGroupAds[adIndex] });
                 }
               });
               
               if (activeGroup.posts.length === 0 && activeGroupAds.length > 0) {
                 activeGroupAds.forEach(ad => itemsToRender.push({ type: 'ad', data: ad }));
               }
               
               return itemsToRender.map((item, idx) => {
                 if (item.type === 'ad') {
                   const ad = item.data;
                   console.log('ad impression', ad.id);
                   return (
                     <div key={`group-ad-${ad.id}-${idx}`} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3 text-left">
                       <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2">
                           <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-black text-white text-[10px] border">
                             AD
                           </div>
                           <div className="flex flex-col">
                             <div className="flex items-center gap-1.5">
                               <span className="font-extrabold text-[13px] text-gray-900 tracking-tight leading-tight">{ad.campaignName}</span>
                               <span className="text-[8px] bg-blue-100 border border-blue-150 text-blue-600 font-extrabold px-1.5 py-0.5 rounded-sm uppercase tracking-wider">Patrocinador</span>
                             </div>
                             <span className="text-[9px] text-gray-400 font-bold tracking-wide">Publicidad del Grupo • Anuncio</span>
                           </div>
                         </div>
                       </div>
                       
                       <p className="text-gray-800 text-[14px] leading-relaxed whitespace-pre-line">{ad.caption}</p>
                       
                       {ad.image && (
                         <div className="rounded-xl overflow-hidden border border-gray-100 max-h-60 flex items-center justify-center bg-gray-50 cursor-pointer" onClick={() => {
                           BusinessStore.logAdClick(ad.id);
                           window.open(ad.ctaLink, '_blank');
                         }}>
                           <img src={ad.image} className="w-full h-auto object-cover" alt="Sponsor Banner" />
                         </div>
                       )}

                       <div className="flex items-center justify-between pt-2 border-t border-gray-50 mt-1">
                         <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide flex items-center gap-1.5">Plataforma IMChat Ads</span>
                         <button 
                           onClick={() => {
                             BusinessStore.logAdClick(ad.id);
                             window.open(ad.ctaLink, '_blank');
                           }}
                           className="bg-blue-600 active:scale-95 text-white font-extrabold text-xs px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                         >
                           {ad.ctaText || 'Más Información'}
                         </button>
                       </div>
                     </div>
                   );
                 }
                 
                 const post = item.data;
                 return (
               <div key={post.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-2">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                     <div className="w-8 h-8 bg-gradient-to-br from-brand-blue to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                       {post.authorName.charAt(0)}
                     </div>
                     <div className="flex flex-col">
                       <div className="flex items-center gap-1">
                         <span className="font-bold text-sm text-gray-900 leading-tight">{post.authorName}</span>
                         {(post.authorId === 'my_id' || post.authorName === 'Dan Abramov') && (
                           <BadgeCheck className="w-[14px] h-[14px] text-white fill-[#0095f6]" />
                         )}
                       </div>
                       <span className="text-[10px] text-gray-400">{new Date(post.timestamp).toLocaleTimeString()}</span>
                     </div>
                   </div>
                   {isAdmin && post.authorId !== 'system' && (
                     <button onClick={() => handleDeletePost(activeGroup.id, post.id)} className="text-gray-400 hover:text-red-500 px-2 py-1"><Trash2 className="w-4 h-4"/></button>
                   )}
                 </div>
                 
                 {post.topic && (
                   <div className="inline-flex items-center gap-1 bg-blue-50 text-brand-blue px-2 py-0.5 rounded font-bold text-xs mt-1 w-fit">
                     <Hash className="w-3 h-3" /> {post.topic}
                   </div>
                 )}
                 <p className="text-gray-800 text-[15px]">
                    {post.content.split(' ').map((word, idx) => {
                      if (word.startsWith('@')) {
                        return <span key={idx} className="text-brand-blue font-bold cursor-pointer hover:underline">{word} </span>;
                      }
                      return word + ' ';
                    })}
                  </p>
                  {post.mediaUrl && (() => {
                    const isVideo = post.mediaUrl.match(/\.(mp4|webm|mov|ogg|m4v)(\?|$)/i) || post.mediaUrl.includes('mov_bbb') || post.mediaUrl.includes('/video/upload/');
                    const isAudio = post.mediaUrl.match(/\.(mp3|wav|m4a|aac|flac)(\?|$)/i);
                    
                    if (isVideo) {
                      return (
                        <div className="mt-2 rounded-xl overflow-hidden border border-gray-100 bg-black max-h-80 flex items-center justify-center">
                          <video src={post.mediaUrl} controls className="max-w-full max-h-80" />
                        </div>
                      );
                    } else if (isAudio) {
                      return (
                        <div className="mt-2 p-3 rounded-xl border border-gray-150 bg-gray-50 flex flex-col gap-1 text-left w-full">
                          <p className="text-[10px] text-purple-600 font-bold uppercase tracking-widest">🎵 Audio Track Shared</p>
                          <audio src={post.mediaUrl} controls className="w-full mt-1" />
                        </div>
                      );
                    } else {
                      return (
                        <div className="mt-2 rounded-xl overflow-hidden border border-gray-150 max-h-60 flex items-center justify-center bg-gray-50">
                          <img src={post.mediaUrl} className="max-w-full h-auto object-contain" alt="Post media" />
                        </div>
                      );
                    }
                  })()}
                </div>
              );
            });
           })()}
          </div>
            </>
          ) : (
             <div className="p-10 flex flex-col items-center text-gray-400 text-center w-full">
               <Shield className="w-12 h-12 mb-3 opacity-20" />
               <p className="font-bold text-sm text-slate-800">Members Only</p>
               <p className="text-xs max-w-[200px] mt-1 text-slate-500">You need to join this group to view its feed and gallery.</p>

               {/* Instagram Style Follow Suggestions before joining */}
               {(() => {
                 const suggestions = getGroupFollowSuggestions();
                 if (suggestions.length === 0) return null;

                 return (
                   <div className="mt-8 w-full max-w-sm bg-white border border-gray-150 rounded-2xl p-4 shadow-sm text-left">
                     <p className="font-extrabold text-[13px] text-gray-800 mb-3 border-b border-gray-100 pb-2 flex items-center gap-1.5">
                       ✨ Suggested Creators to Follow
                     </p>
                     <div className="space-y-3.5">
                       {suggestions.map((u) => {
                         const isFollowing = followingState[u.id];
                         return (
                           <div key={u.id} className="flex items-center justify-between gap-3">
                             <div className="flex items-center gap-2.5 min-w-0">
                               <UserAvatar src={u.avatar} name={u.name} size="sm" className="border ring-1 ring-gray-100" />
                               <div className="flex flex-col min-w-0">
                                 <span className="font-extrabold text-xs text-gray-900 truncate flex items-center gap-1">
                                   {u.name}
                                   {u.isVerified && <BadgeCheck className="w-3.5 h-3.5 text-white fill-[#0095f6] shrink-0" />}
                                 </span>
                                 <span className="text-[10px] text-gray-400 font-semibold truncate leading-tight">{u.bio || 'Suggested for you'}</span>
                               </div>
                             </div>

                             <button
                               onClick={() => onToggleFollow?.(u.id)}
                               className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all active:scale-95 ${
                                 isFollowing 
                                   ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' 
                                   : 'bg-brand-blue text-white hover:bg-blue-600 shadow-sm'
                               }`}
                             >
                               {isFollowing ? 'Following' : 'Follow'}
                             </button>
                           </div>
                         );
                       })}
                     </div>
                   </div>
                 );
               })()}
             </div>
          )}
        </div>

        {/* Input Area */}
        {isMember && (
          <div className="p-4 bg-white border-t border-gray-150 z-10 flex flex-col gap-3 relative shadow-md">
            {/* Real hidden inputs for the 3 visual source modes in the screenshot */}
            <input 
              type="file" 
              accept="image/*" 
              ref={photoInputRef} 
              className="hidden" 
              onChange={handlePhotoFileChange} 
            />
            <input 
              type="file" 
              accept="video/*" 
              ref={videoInputRef} 
              className="hidden" 
              onChange={handleVideoFileChange} 
            />
            <input 
              type="file" 
              accept="audio/*" 
              ref={audioInputRef} 
              className="hidden" 
              onChange={handleAudioFileChange} 
            />

            <AnimatePresence>
               {showGiphy && (
                 <div className="absolute bottom-[calc(100%+10px)] left-4 right-4 z-50">
                    <GiphyPicker onSelect={handleSendGif} onClose={() => setShowGiphy(false)} type="gifs" />
                 </div>
               )}
            </AnimatePresence>
            {showTagMenu && (
              <div className="absolute bottom-[calc(100%+10px)] left-4 right-4 bg-white border border-gray-100 rounded-2xl shadow-xl z-30 max-h-40 overflow-y-auto flex flex-col p-1 animate-fade-in">
                {activeGroup.members.filter(m => m.name.toLowerCase().includes(tagSearch.toLowerCase())).map(m => (
                  <button 
                    key={m.userId}
                    onClick={() => insertTag(m.name)}
                    className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-xl text-left"
                  >
                    <UserAvatar 
                      src={m.avatar} 
                      name={m.name}
                      size="xs"
                      className="border border-gray-100"
                    />
                    <span className="text-sm font-bold text-gray-900">{m.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Topic Input Row */}
            <div className="flex gap-2 w-full">
               <input 
                 type="text" 
                 value={topicInput} 
                 onChange={e=>setTopicInput(e.target.value)} 
                 placeholder="Topic/Hashtag (Optional)" 
                 className="bg-gray-50 border border-gray-150 px-3.5 py-1.5 rounded-xl text-xs outline-none w-1/2 text-purple-600 font-extrabold placeholder-gray-400 focus:bg-white focus:border-purple-300 transition-colors" 
               />
            </div>

            {/* Main Composition text-area styled exactly like the screenshot */}
            <div className="w-full relative">
              <textarea 
                id="group-post-input" 
                value={postInput} 
                onChange={e=>handleInputChange(e.target.value)} 
                onPaste={handleGroupPostPaste}
                placeholder="What's on your mind?" 
                rows={3}
                className="w-full bg-white border border-gray-150 rounded-2xl p-4 text-gray-800 text-sm outline-none resize-none focus:border-purple-300 transition-all placeholder-gray-400 font-medium" 
              />
            </div>

            {/* Media/Rich attachment previews with Remove capabilities */}
            {composerMediaPreview && (
              <div className="bg-gray-50 rounded-2xl p-3 border border-gray-150 relative">
                <button 
                  onClick={handleRemoveAttachedMedia}
                  className="absolute top-2 right-2 z-10 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors"
                  title="Remove Attachment"
                >
                  <X className="w-3 h-3" />
                </button>
                <p className="text-[9px] uppercase font-black tracking-widest text-purple-600 mb-2 text-left px-1">
                  {composerMediaType === 'image' && '📸 Image Attachment'}
                  {composerMediaType === 'video' && '🎥 Video Attachment'}
                  {composerMediaType === 'audio' && '🎵 Audio Attachment'}
                  {composerMediaType === 'live' && '🔴 Live Stream Simulated'}
                </p>
                <div className="rounded-xl overflow-hidden max-h-[140px] flex items-center justify-center bg-gray-100">
                  {composerMediaType === 'image' && (
                    <img src={composerMediaPreview} className="w-full max-h-[140px] object-cover" alt="Attachment Preview" />
                  )}
                  {composerMediaType === 'video' && (
                    <video src={composerMediaPreview} className="w-full max-h-[140px] object-cover" controls />
                  )}
                  {composerMediaType === 'audio' && (
                    <div className="w-full p-4 flex items-center gap-3 bg-white border border-gray-100 rounded-xl">
                      <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                        <Music className="w-5 h-5" />
                      </div>
                      <div className="truncate text-left">
                        <p className="text-xs font-bold text-gray-850 truncate">{composerMediaPreview}</p>
                        <p className="text-[10px] text-gray-400">Audio Track Ready to Post</p>
                      </div>
                    </div>
                  )}
                  {composerMediaType === 'live' && (
                    <div className="w-full p-6 flex flex-col items-center justify-center bg-red-500/10 text-red-600 rounded-xl relative overflow-hidden">
                      <span className="absolute top-2 right-2 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </span>
                      <Radio className="w-8 h-8 text-red-600 animate-pulse mb-2" />
                      <p className="text-xs font-extrabold uppercase tracking-widest">TRANSMISIÓN EN VIVO SIMULADA</p>
                      <p className="text-[10px] text-red-400 mt-1">A sample broadcasting feed will be posted to the group stream</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Option Buttons exact row styled from the screenshot with integrated Send button */}
            <div className="flex items-center justify-between gap-2 py-2 pr-1 border-t border-gray-100 select-none">
              <div className="flex items-center gap-3.5 flex-wrap flex-1 min-w-0">
                {/* Photo option */}
                <button 
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-full text-xs font-extrabold transition-all active:scale-95 cursor-pointer hover:bg-purple-50`}
                >
                  <span className="p-1 bg-purple-50 rounded-lg"><ImageIcon className="w-4 h-4 text-[#7928CA]" /></span>
                  <span className="text-[#7928CA]">Photo</span>
                </button>

                {/* Video option */}
                <button 
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-full text-xs font-extrabold transition-all active:scale-95 cursor-pointer hover:bg-blue-50"
                >
                  <span className="p-1 bg-blue-50 rounded-lg"><Video className="w-4 h-4 text-blue-600" /></span>
                  <span className="text-blue-600">Video</span>
                </button>

                {/* Audio option */}
                <button 
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-full text-xs font-extrabold transition-all active:scale-95 cursor-pointer hover:bg-emerald-50"
                >
                  <span className="p-1 bg-emerald-50 rounded-lg"><Music className="w-4 h-4 text-emerald-600" /></span>
                  <span className="text-emerald-600">Audio</span>
                </button>

                {/* Go Live option */}
                <button 
                  type="button"
                  onClick={handleTriggerLiveSim}
                  className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-full text-xs font-extrabold transition-all active:scale-95 cursor-pointer hover:bg-red-50"
                >
                  <span className="p-1 bg-red-50 rounded-lg"><Radio className="w-4 h-4 text-red-500 animate-pulse" /></span>
                  <span className="text-red-500">Go Live</span>
                </button>

                {/* Smiley option */}
                <button 
                  type="button"
                  onClick={() => setShowGiphy(!showGiphy)}
                  className="p-2 text-amber-500 hover:bg-amber-50 transition-colors rounded-full active:scale-95 cursor-pointer"
                >
                  <Smile className="w-5 h-5 text-amber-500" />
                </button>
              </div>

              {/* Sticky accessible Send/Post Button */}
              <button 
                id="group-composer-send-btn"
                disabled={isPostingRichMedia || (!postInput.trim() && !composerPhotoFile && !composerVideoFile && !composerAudioFile && !isLiveSimulating)}
                onClick={handleCreatePost}
                className="px-6 py-2.5 bg-gradient-to-r from-[#d08bfd] to-[#fa92cd] hover:brightness-[1.03] active:scale-[0.97] text-white text-xs font-extrabold rounded-full shadow-md shadow-pink-200/25 transition-all text-center flex items-center justify-center gap-2 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed border-0 shrink-0 select-none"
              >
                {isPostingRichMedia ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>Posting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-white fill-none" />
                    <span>Send</span>
                  </>
                )}
              </button>
            </div>

            {/* Bottom Section with the elegant GRADIENT POST button aligned right */}
            <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-1">
              <div className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest pl-1">
                {isPostingRichMedia ? (
                   <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" /> Posting...</span>
                ) : (
                   <span>Press Post to share</span>
                )}
              </div>
              
              <button 
                disabled={isPostingRichMedia || (!postInput.trim() && !composerPhotoFile && !composerVideoFile && !composerAudioFile && !isLiveSimulating)}
                onClick={handleCreatePost}
                className="px-8 py-2 bg-gradient-to-r from-[#d08bfd] to-[#fa92cd] hover:brightness-[1.03] active:scale-[0.97] text-white text-sm font-bold rounded-full shadow-md shadow-pink-200/20 transition-all text-center flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border-0"
              >
                {isPostingRichMedia ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>Posting...</span>
                  </>
                ) : (
                  <span>Post</span>
                )}
              </button>
            </div>

          </div>
        )}

        <AnimatePresence>
          {showLeaveConfirmation && activeGroup && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[310] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-3xl w-full max-w-[320px] overflow-hidden shadow-2xl flex flex-col p-6 text-center"
              >
                <div className="mx-auto w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
                  <Ban className="w-8 h-8" />
                </div>
                <h2 className="font-extrabold text-xl text-gray-900 mb-2">Leave Group</h2>
                <p className="text-sm font-medium text-gray-500 mb-6">Are you sure you want to leave <strong>{activeGroup.title}</strong>? You will no longer receive updates or notifications from this group.</p>
                <div className="flex gap-3 w-full">
                  <button onClick={() => setShowLeaveConfirmation(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 rounded-xl transition-all active:scale-95">Cancel</button>
                  <button onClick={() => handleLeave(activeGroup.id)} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-red-500/20 active:scale-95">Leave</button>
                </div>
              </motion.div>
            </div>
          )}

          {isEditingGroup && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[310] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-3xl w-full max-w-[420px] overflow-hidden shadow-2xl flex flex-col p-6 text-left"
              >
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                  <h2 className="font-black text-lg text-gray-900">Editar Grupo / Edit Group</h2>
                  <button onClick={() => setIsEditingGroup(false)} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 active:scale-95"><X className="w-5 h-5"/></button>
                </div>
                
                <div className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Nombre del Grupo / Group Name</label>
                    <input 
                      type="text" 
                      value={editGroupTitle} 
                      onChange={e => setEditGroupTitle(e.target.value)} 
                      placeholder="Ej. Mi increible grupo"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-gray-900 font-bold outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all text-sm"
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Descripción / Description</label>
                    <textarea 
                      value={editGroupDesc} 
                      onChange={e => setEditGroupDesc(e.target.value)} 
                      placeholder="What is this group about?"
                      rows={2}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-gray-900 text-sm outline-none resize-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black tracking-widest text-gray-400 uppercase font-bold">Portada del Grupo / Group Cover</label>
                    <div className="relative w-full h-32 bg-gray-100 rounded-xl overflow-hidden group border border-gray-200 flex items-center justify-center">
                      {isCustomCover(editGroupCover) ? (
                        <>
                          <img src={editGroupCover} className="w-full h-full object-cover absolute inset-0" alt="New Cover Option" />
                          <div className="absolute inset-0 bg-black/40 pointer-events-none" />
                        </>
                      ) : (
                        <div className={`absolute inset-0 bg-gradient-to-br ${getGroupGradient(editGroupTitle, activeGroupId || '')} flex items-center justify-center`}>
                          <span className="font-extrabold text-xs text-white bg-white/20 px-3 py-1.5 rounded-lg backdrop-blur">{getGroupInitials(editGroupTitle)}</span>
                        </div>
                      )}
                      <label className="relative z-10 bg-black/70 hover:bg-black/90 active:scale-95 px-3.5 py-1.5 rounded-full flex items-center justify-center transition-all cursor-pointer text-white font-bold text-[10px] uppercase tracking-wider gap-1.5 shadow-md border border-white/10">
                         <input 
                           type="file" 
                           accept="image/*" 
                           className="hidden" 
                           onChange={e => {
                             const file = e.target.files?.[0];
                             if (file) {
                               setEditGroupCover(URL.createObjectURL(file));
                               setEditGroupCoverFile(file);
                             }
                           }} 
                         />
                         <ImageIcon className="w-3.5 h-3.5 text-white" /> Sustituir Portada / Change Cover
                      </label>
                    </div>

                    {/* URL Fast Upload Input for Editing */}
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black tracking-widest text-gray-500 uppercase">Sustituir vía URL / Paste Cover URL</span>
                        {editGroupCover && (
                          <button 
                            type="button" 
                            onClick={() => { setEditGroupCover(''); setEditGroupCoverFile(null); }}
                            className="text-[9px] text-red-500 font-bold hover:underline"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      
                      <input 
                        type="text" 
                        placeholder="https://images.unsplash.com/photo-..." 
                        value={editGroupCover.startsWith('blob:') ? '' : editGroupCover}
                        onChange={e => {
                          const val = e.target.value.trim();
                          setEditGroupCover(val);
                          setEditGroupCoverFile(null); // Clear file when URL is used
                        }}
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
                      />

                      {/* Fast URL Presets */}
                      <div className="flex gap-1.5 items-center justify-between font-sans">
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Fast Presets:</span>
                        <div className="flex gap-1">
                          {[
                            { name: 'Tech', url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop' },
                            { name: 'Creative', url: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&auto=format&fit=crop' },
                            { name: 'Music', url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop' },
                            { name: 'Team', url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop' }
                          ].map((preset) => (
                            <button
                              key={preset.name}
                              type="button"
                              onClick={() => {
                                setEditGroupCover(preset.url);
                                setEditGroupCoverFile(null);
                              }}
                              className={`py-0.5 px-1.5 border rounded text-[9px] font-bold transition-all ${
                                editGroupCover === preset.url 
                                  ? 'bg-indigo-600 text-white border-indigo-600' 
                                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              {preset.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-6">
                  <button 
                    onClick={() => setIsEditingGroup(false)} 
                    className="flex-1 py-3 bg-gray-150 hover:bg-gray-205 text-gray-700 font-extrabold text-xs rounded-xl active:scale-95 transition-all uppercase tracking-wider"
                  >
                    Cancelar / Cancel
                  </button>
                  <button 
                    onClick={async () => {
                      if (!editGroupTitle.trim() || !activeGroupId) return;
                      setIsSavingGroup(true);
                      try {
                        let finalCover = editGroupCover;
                        if (editGroupCoverFile) {
                          try {
                            const res = await uploadToCloudinary(editGroupCoverFile, 'image', activeGroup.uid || activeGroupId);
                            if (res && res.secure_url) {
                              finalCover = res.secure_url;
                            } else {
                              finalCover = await fileToCompressedBase64(editGroupCoverFile);
                            }
                          } catch (err) {
                            finalCover = await fileToCompressedBase64(editGroupCoverFile);
                          }
                        }

                        await GroupStore.updateGroup(activeGroupId, {
                          title: editGroupTitle.trim(),
                          description: editGroupDesc.trim(),
                          coverUrl: finalCover
                        });
                        setIsEditingGroup(false);
                      } catch (err) {
                        console.error("Failed to update group fields:", err);
                        alert("Error updating group. Please try again.");
                      } finally {
                        setIsSavingGroup(false);
                      }
                    }}
                    disabled={isSavingGroup || !editGroupTitle.trim()}
                    className="flex-1 py-3 bg-brand-blue hover:bg-blue-600 text-white font-extrabold text-xs rounded-xl active:scale-[0.98] transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/10 disabled:opacity-50"
                  >
                    {isSavingGroup ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Guardar / Save'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // LIST VIEW
  const publicGroups = groups.filter(g => !g.isPrivate);
  const recentActivities = publicGroups.flatMap(g => 
    (g.posts || []).map(p => ({
      ...p,
      group: {
        id: g.id,
        title: g.title,
        coverUrl: g.coverUrl
      }
    }))
  ).sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="flex flex-col h-full bg-gray-50 relative">
      <header className="bg-white p-4 flex items-center justify-between border-b border-gray-100 z-10 shadow-sm sticky top-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-blue to-purple-500 flex items-center justify-center">
            <Users className="w-4 h-4 text-white" />
          </div>
          <h1 className="font-bold text-lg tracking-tight text-gray-900">Groups</h1>
        </div>
        <button 
          onClick={() => setView('create')}
          className="bg-brand-blue text-white px-4 py-2 rounded-full font-bold text-sm flex items-center gap-1.5 hover:bg-blue-600 active:scale-95 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Create
        </button>
      </header>

      {/* Modern Tab Switcher */}
      <div className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center gap-2 z-10">
        <button
          onClick={() => setListSubTab('explore')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-xs tracking-wider uppercase transition-all duration-200 active:scale-95 ${
            listSubTab === 'explore'
              ? 'bg-brand-blue text-white shadow-md shadow-brand-blue/10'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-205'
          }`}
        >
          <Users className="w-3.5 h-3.5" /> Explore Groups
        </button>
        <button
          onClick={() => setListSubTab('activity')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-xs tracking-wider uppercase transition-all duration-200 active:scale-95 ${
            listSubTab === 'activity'
              ? 'bg-brand-blue text-white shadow-md shadow-brand-blue/10'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-205'
          }`}
        >
          <Clock className="w-3.5 h-3.5 animate-pulse" /> Recent Activity
        </button>
      </div>

      <div id="groups-container" className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {listSubTab === 'explore' ? (
          <>
            {groups.map(g => (
              <div key={g.id} onClick={() => { setActiveGroupId(g.id); setView('detail'); }} className="bg-white border text-left border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col active:scale-[0.98]">
                <div className="h-[120px] relative w-full border-b border-gray-100">
                  {isCustomCover(g.coverUrl) ? (
                    <img src={g.coverUrl} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${getGroupGradient(g.title, g.id)} flex items-center justify-center relative overflow-hidden`}>
                      <div className="absolute inset-0 bg-black/10" />
                      <div className="font-black text-xl text-white tracking-widest bg-white/20 px-3 py-1.5 rounded-xl backdrop-blur-sm z-10">{getGroupInitials(g.title)}</div>
                      <Users className="w-32 h-32 absolute -right-4 -bottom-4 text-white/10 rotate-12" />
                    </div>
                  )}
                  {g.isPrivate && (
                    <div className="absolute top-2 right-2 bg-black/50 backdrop-blur px-2 py-1 flex items-center gap-1 rounded text-white text-[10px] font-bold">
                      <Shield className="w-3 h-3" /> PRIVATE
                    </div>
                  )}
                </div>
                <div className="p-4 flex flex-col gap-1">
                   <div className="flex items-center justify-between gap-2 overflow-hidden">
                     <div className="flex items-center gap-1.5 min-w-0">
                       <h2 className="font-bold text-gray-900 leading-tight truncate">{g.title}</h2>
                       {g.id === 'g1' && <BadgeCheck className="w-[16px] h-[16px] text-white fill-[#0095f6] shrink-0" />}
                     </div>
                     {g.posts && g.posts.length > 0 ? (() => {
                       const latestTime = Math.max(...g.posts.map(p => p.timestamp));
                       const diffMins = Math.floor((Date.now() - latestTime) / 60000);
                       const isOnline = diffMins < 60;
                       
                       return isOnline ? (
                         <div className="flex items-center gap-1.5 shrink-0 bg-green-50 px-2 py-1 rounded-full border border-green-100">
                           <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                           <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Active</span>
                         </div>
                       ) : (
                         <div className="flex items-center justify-center shrink-0">
                           <span className="text-[10px] font-bold text-gray-400 capitalize tracking-wide">{diffMins < 1440 ? `${Math.floor(diffMins / 60)}h ago` : `${Math.floor(diffMins / 1440)}d ago`}</span>
                         </div>
                       );
                     })() : (
                       <div className="flex items-center gap-1.5 shrink-0">
                         <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                         <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Offline</span>
                       </div>
                     )}
                   </div>
                   <div className="flex items-center gap-3 mt-1">
                     <span className="text-xs text-gray-500 font-medium flex items-center gap-1"><Users className="w-3.5 h-3.5"/> {g.members.length} members</span>
                     <span className="text-[10px] bg-brand-blue/10 text-brand-blue px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">{g.uid}</span>
                   </div>
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className="flex flex-col gap-4">
            {/* System Chronology Welcome Ribbon */}
            <div className="bg-gradient-to-r from-blue-50/85 to-indigo-50/85 border border-indigo-100/50 rounded-2xl p-4 flex items-center justify-between text-left shadow-sm">
              <div className="flex flex-col gap-0.5">
                <span className="font-extrabold text-sm text-indigo-950">System Chronology Feed</span>
                <span className="text-xs text-indigo-800/80">Real-time compilation of conversations from all public groups.</span>
              </div>
              <span className="bg-brand-blue text-white font-extrabold text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm shadow-brand-blue/10">{recentActivities.length} Posts</span>
            </div>

            {recentActivities.length === 0 ? (
              <div className="bg-white border border-gray-150 rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-3 shadow-xs my-4">
                <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
                  <Clock className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-gray-900">No activity registered yet</span>
                  <span className="text-xs text-gray-500 max-w-xs mt-1">Be the first to publish a post inside any group and make history!</span>
                </div>
                <button 
                  onClick={() => setListSubTab('explore')}
                  className="bg-brand-blue text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-600 transition-colors active:scale-95 shadow-sm shadow-blue-500/15"
                >
                  Explore Groups
                </button>
              </div>
            ) : (
              recentActivities.map((post) => (
                <div 
                  key={`feed-${post.id}`} 
                  onClick={() => {
                    setActiveGroupId(post.group.id);
                    setView('detail');
                  }}
                  className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 hover:border-brand-blue/60 hover:shadow-md transition-all cursor-pointer flex flex-col gap-3.5 text-left active:scale-[0.99]"
                >
                  {/* Card top row */}
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-brand-blue to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-xs shadow-sm">
                        {post.authorName.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-xs text-gray-900 leading-tight">{post.authorName}</span>
                          {(post.authorId === 'my_id' || post.authorName === 'Dan Abramov' || post.authorId === 'user_1') && (
                            <BadgeCheck className="w-[14px] h-[14px] text-white fill-[#0095f6]" />
                          )}
                        </div>
                        <span className="text-[9px] text-gray-400 font-semibold">{new Date(post.timestamp).toLocaleDateString()} {new Date(post.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    {/* Group link pill */}
                    <div className="flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 max-w-[150px] md:max-w-xs px-2.5 py-1 rounded-full border border-gray-200/60 transition-colors">
                      <span className="text-[10px] text-gray-600 font-bold truncate">{post.group.title}</span>
                      <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    </div>
                  </div>

                  {post.topic && (
                    <div className="inline-flex items-center gap-1 bg-blue-50 text-brand-blue px-2 py-0.5 rounded font-bold text-[10px] w-fit">
                      <Hash className="w-2.5 h-2.5" /> {post.topic}
                    </div>
                  )}

                  {/* Body Text */}
                  {post.content && (
                    <p className="text-gray-800 text-[14px] leading-relaxed break-words font-medium">
                      {post.content.split(' ').map((word, idx) => {
                        if (word.startsWith('@')) {
                          return <span key={idx} className="text-brand-blue font-bold cursor-pointer hover:underline">{word} </span>;
                        }
                        return word + ' ';
                      })}
                    </p>
                  )}

                  {/* Post Attachment image */}
                  {post.mediaUrl && (
                    <div className="rounded-xl overflow-hidden border border-gray-150 max-h-48 flex items-center justify-center bg-gray-50 mt-1">
                      <img src={post.mediaUrl} className="max-w-full h-auto object-contain" alt="Attachment media" />
                    </div>
                  )}

                  {/* Foot Action row */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-gray-50 text-[11px] font-bold text-brand-blue hover:text-blue-600">
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3.5 h-3.5" /> Join conversation
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">Click to open group</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {lightboxImage && (
        <div className="fixed inset-0 bg-black/90 z-[999] flex flex-col backdrop-blur-sm" onClick={() => setLightboxImage(null)}>
          <div className="flex justify-between items-center p-4">
            <div className="flex flex-col">
               <span className="text-white font-bold text-sm tracking-wide">{lightboxImage.uploaderName}</span>
               <span className="text-gray-400 text-[10px] uppercase font-bold">{new Date(lightboxImage.timestamp).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-3">
              <a href={lightboxImage.url} download target="_blank" rel="noopener noreferrer" className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white" onClick={(e) => e.stopPropagation()}>
                 <Download className="w-5 h-5"/>
              </a>
              <button 
                onClick={() => setLightboxImage(null)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center overflow-hidden relative w-full h-full" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const url = lightboxImage.url;
              const isVideo = url.match(/\.(mp4|webm|mov|ogg|m4v)(\?|$)/i) || url.includes('mov_bbb') || url.includes('/video/upload/') || url.includes('simulated-live-stream');
              const isAudio = url.match(/\.(mp3|wav|m4a|aac|flac)(\?|$)/i);
              if (isVideo) {
                return (
                  <video 
                    src={url} 
                    className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl border border-white/10" 
                    controls 
                    autoPlay 
                    playsInline
                  />
                );
              }
              if (isAudio) {
                return (
                  <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 max-w-sm w-full flex flex-col items-center gap-6 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
                    <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white text-3xl shadow-lg shadow-purple-500/20">
                      <Music className="w-8 h-8 text-white animate-pulse" />
                    </div>
                    <div className="text-center">
                      <h4 className="font-extrabold text-white text-sm tracking-tight font-sans">Vocal Clip Shared</h4>
                      <p className="text-[11px] text-neutral-400 mt-1">By {lightboxImage.uploaderName}</p>
                    </div>
                    <audio 
                      src={url} 
                      className="w-full mt-2" 
                      controls 
                      autoPlay
                    />
                  </div>
                );
              }
              return (
                <TransformWrapper
                  initialScale={1}
              initialPositionX={0}
              initialPositionY={0}
              centerOnInit={true}
              minScale={0.5}
              maxScale={8}
            >
              {({ zoomIn, zoomOut, resetTransform }) => (
                <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img 
                    src={lightboxImage.url} 
                    className="max-w-full max-h-full object-contain drop-shadow-2xl brightness-110"
                    alt="Gallery Full Size" 
                  />
                </TransformComponent>
              )}
            </TransformWrapper>
              );
            })()}
          </div>
        </div>
      )}

      {/* Captured Screenshot Preview Drawer / Modal */}
      <AnimatePresence>
        {showScreenshotModal && screenshotPreview && (
          <div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
            >
              <header className="px-5 py-4 border-b border-slate-800 flex items-center justify-between text-white">
                <div>
                  <h3 className="font-extrabold text-sm flex items-center gap-2">
                    <Camera className="w-5 h-5 text-sky-400" />
                    <span>Conversation Screenshot</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">High-fidelity secure chat capture ready</p>
                </div>
                <button 
                  onClick={() => { setShowScreenshotModal(false); setScreenshotPreview(null); }}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto p-5 flex flex-col items-center justify-center">
                <div className="border border-slate-700/50 rounded-xl overflow-hidden shadow-2xl max-w-full bg-slate-950">
                  <img src={screenshotPreview} className="max-h-[50vh] object-contain" alt="Screenshot Preview" />
                </div>
                <p className="text-[11px] text-slate-400 font-medium text-center mt-3 max-w-[280px]">
                  This secure screenshot captures the active group conversation, including names and times.
                </p>
              </div>

              <footer className="p-4 border-t border-slate-800 bg-slate-950 flex gap-3">
                <button
                  onClick={() => { setShowScreenshotModal(false); setScreenshotPreview(null); }}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-extrabold text-[13px] rounded-xl transition-all"
                >
                  Cancel
                </button>
                <a
                  href={screenshotPreview}
                  download={`imchat_group_screenshot_${activeGroup?.title?.toLowerCase().replace(/\s+/g, '_') || 'chat'}.png`}
                  className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white font-extrabold text-[13px] rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-sky-500/10 text-center"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Image</span>
                </a>
              </footer>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
