import { PostStore, Post, PostComment } from '../lib/PostStore';
import { ReelStore, Reel } from '../lib/ReelStore';
import { StoryStore, Story } from '../lib/StoryStore';
import { db, auth } from '../firebase';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';

export interface UserExportProfile {
  uid: string;
  name: string;
  surname: string;
  username: string;
  email: string;
  phone: string;
  bio: string;
  avatar: string;
  age: number;
  gender: string;
  city: string;
  role: string;
  walletBalance: number;
  isBusinessAccount: boolean;
  businessName?: string;
  businessCategory?: string;
  isProfileLocked?: boolean;
  isMfaEnabled?: boolean;
  hideAvatarPublicly?: boolean;
  preferences: {
    notifications: boolean;
    emailMarketing: boolean;
    emailSecurityAlerts: boolean;
    emailActivityNotifications: boolean;
    lowDataMode: boolean;
    offlineMode: boolean;
    batterySaverEnabled: boolean;
    batterySyncFrequency: number;
    notificationBellType: string;
    language?: string;
  };
  deviceAccountsCount?: number;
}

export interface UserExportPostSummary {
  id: string;
  caption: string;
  mediaUrl?: string;
  mediaType: string;
  timestamp: number;
  createdAtFormatted: string;
  likesCount: number;
  favouritesCount: number;
  commentsCount: number;
  comments: PostComment[];
  location?: string;
  pinned?: boolean;
  eventData?: any;
  reelData?: any;
}

export interface UserExportCommentSummary {
  postId: string;
  commentId: string;
  text: string;
  timestamp: number;
  createdAtFormatted: string;
  reactions: string[];
}

export interface UserExportMessage {
  id: string;
  senderId: string;
  senderName?: string;
  text: string;
  timestamp: number;
  timestampFormatted: string;
  isRead?: boolean;
  mediaAttachment?: any;
  voiceNoteUrl?: string;
  gameInvite?: any;
  reactions?: any[];
}

export interface UserExportChat {
  id: string;
  name: string;
  isGroup: boolean;
  participants: string[];
  totalMessages: number;
  messages: UserExportMessage[];
}

export interface UserExportArchive {
  exportMetadata: {
    exportVersion: string;
    appName: string;
    appVersion: string;
    exportTimestamp: number;
    exportDateFormatted: string;
    requestedByUserId: string;
    requestedByEmail: string;
  };
  profile: UserExportProfile;
  postsActivity: {
    authoredPostsCount: number;
    authoredPosts: UserExportPostSummary[];
    userCommentsCount: number;
    userCommentsOnOtherPosts: UserExportCommentSummary[];
    savedPostsCount: number;
    savedPostIds: string[];
    likedPostIds: string[];
    favouritedPostIds: string[];
  };
  chatsActivity: {
    totalConversations: number;
    totalMessagesExchanged: number;
    conversations: UserExportChat[];
    aiAssistantConversationsCount: number;
    aiAssistantConversations?: any[];
  };
  additionalActivity: {
    reelsCount: number;
    reels: any[];
    storiesCount: number;
    stories: any[];
    callLogsCount: number;
    callLogs: any[];
    productsCount: number;
    products: any[];
    adsCount: number;
    ads: any[];
  };
}

export interface ExportFilterOptions {
  includeProfile: boolean;
  includePosts: boolean;
  includeChats: boolean;
  includeMediaAndActivity: boolean;
}

export class DataExportService {
  /**
   * Aggregates all user personal data from local storage, memory stores, and Firestore.
   */
  static async buildUserArchive(
    currentUserId: string,
    currentUserName: string,
    currentUserEmail: string,
    profileData: Partial<UserExportProfile> = {},
    filterOptions: ExportFilterOptions = {
      includeProfile: true,
      includePosts: true,
      includeChats: true,
      includeMediaAndActivity: true,
    }
  ): Promise<UserExportArchive> {
    const timestamp = Date.now();
    const dateFormatted = new Date(timestamp).toISOString();

    // 1. Fetch Profile Info
    let userProfileDoc: any = {};
    try {
      if (currentUserId && db) {
        const snap = await getDoc(doc(db, 'users', currentUserId));
        if (snap.exists()) {
          userProfileDoc = snap.data();
        }
      }
    } catch (e) {
      console.warn('Could not fetch remote user profile for export:', e);
    }

    const mergedProfile: UserExportProfile = {
      uid: currentUserId || 'current_user',
      name: profileData.name || userProfileDoc.name || currentUserName || 'User',
      surname: profileData.surname || userProfileDoc.surname || '',
      username: profileData.username || userProfileDoc.username || 'user',
      email: currentUserEmail || profileData.email || userProfileDoc.email || '',
      phone: profileData.phone || userProfileDoc.phone || '',
      bio: profileData.bio || userProfileDoc.bio || '',
      avatar: profileData.avatar || userProfileDoc.avatar || '',
      age: profileData.age || userProfileDoc.age || 22,
      gender: profileData.gender || userProfileDoc.gender || 'Not specified',
      city: profileData.city || userProfileDoc.city || '',
      role: profileData.role || userProfileDoc.role || 'user',
      walletBalance: profileData.walletBalance ?? userProfileDoc.walletBalance ?? 0,
      isBusinessAccount: profileData.isBusinessAccount ?? userProfileDoc.isBusinessAccount ?? false,
      businessName: profileData.businessName || userProfileDoc.businessName || '',
      businessCategory: profileData.businessCategory || userProfileDoc.businessCategory || '',
      isProfileLocked: profileData.isProfileLocked ?? userProfileDoc.profileLocked ?? false,
      isMfaEnabled: profileData.isMfaEnabled ?? userProfileDoc.mfaEnabled ?? false,
      hideAvatarPublicly: profileData.hideAvatarPublicly ?? userProfileDoc.hideAvatarPublicly ?? false,
      preferences: {
        notifications: profileData.preferences?.notifications ?? true,
        emailMarketing: profileData.preferences?.emailMarketing ?? true,
        emailSecurityAlerts: profileData.preferences?.emailSecurityAlerts ?? true,
        emailActivityNotifications: profileData.preferences?.emailActivityNotifications ?? true,
        lowDataMode: profileData.preferences?.lowDataMode ?? false,
        offlineMode: localStorage.getItem('imchat_force_offline_mode') === 'true',
        batterySaverEnabled: localStorage.getItem('batterySaverEnabled') === 'true',
        batterySyncFrequency: parseInt(localStorage.getItem('batterySyncFrequency') || '45', 10),
        notificationBellType: localStorage.getItem('app_notification_bell_type') || 'default_ring_bell',
        language: localStorage.getItem('imchat_selected_language') || navigator.language || 'en',
      },
      deviceAccountsCount: (() => {
        try {
          const accounts = JSON.parse(localStorage.getItem('imchat_device_accounts') || '[]');
          return Array.isArray(accounts) ? accounts.length : 0;
        } catch {
          return 0;
        }
      })(),
    };

    // 2. Fetch Posts & Comments
    let authoredPosts: UserExportPostSummary[] = [];
    let userCommentsOnOtherPosts: UserExportCommentSummary[] = [];
    let savedPostIds: string[] = [];
    let likedPostIds: string[] = [];
    let favouritedPostIds: string[] = [];

    if (filterOptions.includePosts) {
      const allPosts: Post[] = PostStore.getPosts();
      const userIdentifiers = new Set([
        currentUserId,
        currentUserName?.toLowerCase(),
        currentUserEmail?.toLowerCase(),
        mergedProfile.name?.toLowerCase(),
        mergedProfile.username?.toLowerCase(),
      ].filter(Boolean));

      allPosts.forEach((post) => {
        const postAuthorId = post.userId;
        const postAuthorEmail = post.authorEmail?.toLowerCase();
        const postAuthorName = post.user?.name?.toLowerCase();

        const isUserPost =
          (postAuthorId && postAuthorId === currentUserId) ||
          (postAuthorEmail && postAuthorEmail === currentUserEmail.toLowerCase()) ||
          (postAuthorName && postAuthorName === currentUserName?.toLowerCase());

        if (isUserPost) {
          authoredPosts.push({
            id: post.id,
            caption: post.caption || '',
            mediaUrl: post.mediaUrl || post.image,
            mediaType: post.mediaType || 'image',
            timestamp: post.timestamp,
            createdAtFormatted: new Date(post.timestamp).toISOString(),
            likesCount: post.likes?.length || 0,
            favouritesCount: post.favourites?.length || 0,
            commentsCount: post.comments?.length || 0,
            comments: post.comments || [],
            location: post.location,
            pinned: post.pinned,
            eventData: post.eventData,
            reelData: post.reelData,
          });
        }

        // Check if user liked or favourited
        if (post.likes && (post.likes.includes(currentUserName) || post.likes.includes(mergedProfile.name))) {
          likedPostIds.push(post.id);
        }
        if (post.favourites && (post.favourites.includes(currentUserName) || post.favourites.includes(mergedProfile.name))) {
          favouritedPostIds.push(post.id);
        }

        // Check comments on other posts
        if (post.comments && Array.isArray(post.comments)) {
          post.comments.forEach((c) => {
            const isUserComment =
              c.authorId === currentUserId ||
              (c.authorName && userIdentifiers.has(c.authorName.toLowerCase()));

            if (isUserComment && !isUserPost) {
              userCommentsOnOtherPosts.push({
                postId: post.id,
                commentId: c.id,
                text: c.text,
                timestamp: c.timestamp,
                createdAtFormatted: new Date(c.timestamp).toISOString(),
                reactions: c.reactions || [],
              });
            }
          });
        }
      });

      // Saved posts
      try {
        const savedPostsList = PostStore.getSavedPosts();
        savedPostIds = savedPostsList.map((p) => p.id);
      } catch (e) {
        console.warn('Error reading saved posts:', e);
      }
    }

    // 3. Fetch Chats & Direct Messages
    let exportChats: UserExportChat[] = [];
    let totalMessagesExchanged = 0;
    let aiAssistantConversations: any[] = [];

    if (filterOptions.includeChats) {
      // Local / Cached conversations
      try {
        const cachedChatsRaw = localStorage.getItem('imchat_local_conversations');
        if (cachedChatsRaw) {
          const parsedChats = JSON.parse(cachedChatsRaw);
          if (Array.isArray(parsedChats)) {
            exportChats = parsedChats.map((c: any) => {
              const messages: UserExportMessage[] = (c.messages || []).map((m: any) => ({
                id: m.id || `msg_${m.timestamp}`,
                senderId: m.senderId,
                senderName: m.senderId === currentUserId ? 'You' : c.name,
                text: m.text || '',
                timestamp: m.timestamp || Date.now(),
                timestampFormatted: new Date(m.timestamp || Date.now()).toISOString(),
                isRead: m.isRead,
                mediaAttachment: m.mediaAttachment || (m.mediaUrl ? { url: m.mediaUrl, type: m.mediaType } : undefined),
                voiceNoteUrl: m.voiceNoteUrl || m.audioUrl,
                gameInvite: m.gameInvite,
                reactions: m.reactions,
              }));

              totalMessagesExchanged += messages.length;

              return {
                id: c.id,
                name: c.name || 'Chat Conversation',
                isGroup: Boolean(c.isGroup),
                participants: c.participants || [currentUserId],
                totalMessages: messages.length,
                messages,
              };
            });
          }
        }
      } catch (e) {
        console.warn('Error extracting local chats for export:', e);
      }

      // AI Conversations (if stored)
      try {
        const localAiChat = localStorage.getItem('imchat_gemini_chat_history');
        if (localAiChat) {
          aiAssistantConversations = JSON.parse(localAiChat);
        }
      } catch (e) {
        // silent
      }
    }

    // 4. Additional Activity (Reels, Stories, Calls, Ads, Products)
    let reelsList: any[] = [];
    let storiesList: any[] = [];
    let callLogsList: any[] = [];
    let productsList: any[] = [];
    let adsList: any[] = [];

    if (filterOptions.includeMediaAndActivity) {
      // User Reels
      try {
        const allReels: Reel[] = ReelStore.getReels();
        reelsList = allReels.filter(
          (r) =>
            r.userId === currentUserId ||
            r.user?.toLowerCase() === currentUserName?.toLowerCase() ||
            (r.authorEmail && r.authorEmail.toLowerCase() === currentUserEmail.toLowerCase())
        );
      } catch (e) {
        console.warn('Error reading reels for export:', e);
      }

      // User Stories
      try {
        const allStories: Story[] = StoryStore.getStories();
        storiesList = allStories.filter(
          (s) =>
            s.userId === currentUserId ||
            s.user?.id === currentUserId ||
            s.user?.name?.toLowerCase() === currentUserName?.toLowerCase()
        );
      } catch (e) {
        console.warn('Error reading stories for export:', e);
      }

      // Call logs
      try {
        const rawCallLogs = localStorage.getItem('imchat_call_logs');
        if (rawCallLogs) {
          callLogsList = JSON.parse(rawCallLogs);
        }
      } catch (e) {
        console.warn('Error reading call logs for export:', e);
      }

      // Products (marketplace / storefront)
      try {
        const rawProducts = localStorage.getItem(`imchat_company_products_${currentUserId}`);
        if (rawProducts) {
          productsList = JSON.parse(rawProducts);
        }
      } catch (e) {
        // silent
      }

      // Ads campaigns
      try {
        const rawAds = localStorage.getItem('imchat_my_ads');
        if (rawAds) {
          adsList = JSON.parse(rawAds);
        }
      } catch (e) {
        // silent
      }
    }

    // Final assembled structure
    const archive: UserExportArchive = {
      exportMetadata: {
        exportVersion: '1.0.0',
        appName: 'IMChat',
        appVersion: '3.2.0',
        exportTimestamp: timestamp,
        exportDateFormatted: dateFormatted,
        requestedByUserId: currentUserId || 'anonymous_user',
        requestedByEmail: currentUserEmail || 'unknown@imchat.im',
      },
      profile: filterOptions.includeProfile ? mergedProfile : ({} as any),
      postsActivity: {
        authoredPostsCount: authoredPosts.length,
        authoredPosts,
        userCommentsCount: userCommentsOnOtherPosts.length,
        userCommentsOnOtherPosts,
        savedPostsCount: savedPostIds.length,
        savedPostIds,
        likedPostIds,
        favouritedPostIds,
      },
      chatsActivity: {
        totalConversations: exportChats.length,
        totalMessagesExchanged,
        conversations: exportChats,
        aiAssistantConversationsCount: aiAssistantConversations.length,
        aiAssistantConversations,
      },
      additionalActivity: {
        reelsCount: reelsList.length,
        reels: reelsList,
        storiesCount: storiesList.length,
        stories: storiesList,
        callLogsCount: callLogsList.length,
        callLogs: callLogsList,
        productsCount: productsList.length,
        products: productsList,
        adsCount: adsList.length,
        ads: adsList,
      },
    };

    return archive;
  }

  /**
   * Triggers a browser file download of the JSON archive.
   */
  static downloadJsonFile(archive: UserExportArchive, customFilename?: string): { success: boolean; filename: string; sizeBytes: number } {
    try {
      const jsonString = JSON.stringify(archive, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
      const sizeBytes = blob.size;

      const dateTag = new Date().toISOString().split('T')[0];
      const safeUsername = (archive.profile?.username || 'user').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = customFilename || `imchat_export_${safeUsername}_${dateTag}.json`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 1000);

      return { success: true, filename, sizeBytes };
    } catch (err) {
      console.error('Failed to trigger JSON file download:', err);
      throw err;
    }
  }

  /**
   * Formats byte sizes into human readable strings (KB, MB).
   */
  static formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}
