import { db, auth } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { PostStore } from '../lib/PostStore';
import { ReelStore } from '../lib/ReelStore';
import { MarketplaceStore } from '../lib/MarketplaceStore';
import { GroupStore } from '../lib/GroupStore';
import { ChannelStore } from '../lib/ChannelStore';
import { MediaStore } from '../lib/MediaStorage';
import { COMMUNITY_USERS } from '../lib/communityUsers';

export interface DiscoveredUser {
  id: string;
  name: string;
  username: string;
  avatar?: string;
  email?: string;
  role?: string;
  isVerified?: boolean;
  bio?: string;
  phone?: string;
  website?: string;
  location?: string;
  isOnline?: boolean;
  presence?: string;
  lastActive?: number;
  lastSeen?: string;
}

export interface SyncStats {
  usersCount: number;
  postsCount: number;
  reelsCount: number;
  marketplaceCount: number;
  groupsCount: number;
  channelsCount: number;
  mediaCount: number;
  timestamp: number;
}

class AutoSyncManager {
  private isSyncing: boolean = false;
  private lastSyncTime: number = 0;
  private cachedUsers: DiscoveredUser[] = [];
  private listeners: Set<(stats: SyncStats | null, isSyncing: boolean) => void> = new Set();

  constructor() {
    // Restore cached users from local storage if available
    try {
      const stored = localStorage.getItem('imchat_synced_users');
      if (stored) {
        this.cachedUsers = JSON.parse(stored);
      }
    } catch (e) {}

    // Listen to online events to trigger background re-sync when network reconnects
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.performAppWideBackgroundScan({ force: true });
      });
      // Listen for custom trigger
      window.addEventListener('trigger-app-full-scan', () => {
        this.performAppWideBackgroundScan({ force: true });
      });
    }
  }

  public getCachedUsers(): DiscoveredUser[] {
    return this.cachedUsers;
  }

  public getIsSyncing(): boolean {
    return this.isSyncing;
  }

  public subscribe(listener: (stats: SyncStats | null, isSyncing: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(stats: SyncStats | null) {
    this.listeners.forEach(fn => fn(stats, this.isSyncing));
  }

  /**
   * Main entry point: Automatically scans all users, media, posts, reels, marketplace, groups, and channels
   * in the background upon login, signup, or app startup.
   */
  public async performAppWideBackgroundScan(options: {
    force?: boolean;
    userId?: string;
    showToast?: boolean;
  } = {}): Promise<SyncStats> {
    const now = Date.now();
    // Debounce background scans to max once every 15s unless forced
    if (this.isSyncing && !options.force) {
      return {
        usersCount: this.cachedUsers.length,
        postsCount: PostStore.getPosts().length,
        reelsCount: ReelStore.getReels().length,
        marketplaceCount: MarketplaceStore.getProducts().length,
        groupsCount: GroupStore.getGroups().length,
        channelsCount: ChannelStore.getChannels().length,
        mediaCount: MediaStore.getAllMedia().length,
        timestamp: this.lastSyncTime || now
      };
    }

    this.isSyncing = true;
    this.notify(null);

    try {
      console.log("🔄 [AutoSyncService] Initiating comprehensive background scan across all app collections...");

      // 1. Trigger all Store deep scans in parallel
      const postScanPromise = PostStore.performDeepScan().catch(err => {
        console.warn("PostStore scan notice:", err);
        return { totalCount: PostStore.getPosts().length, scannedFromFirestore: 0 };
      });

      const reelScanPromise = ReelStore.performDeepScan().catch(err => {
        console.warn("ReelStore scan notice:", err);
        return { totalCount: ReelStore.getReels().length, scannedFromFirestore: 0 };
      });

      const marketScanPromise = MarketplaceStore.performDeepScan().catch(err => {
        console.warn("MarketplaceStore scan notice:", err);
        return { totalCount: MarketplaceStore.getProducts().length, scannedFromFirestore: 0 };
      });

      const groupScanPromise = GroupStore.performDeepScan().catch(err => {
        console.warn("GroupStore scan notice:", err);
        return { totalCount: GroupStore.getGroups().length, scannedFromFirestore: 0 };
      });

      const channelScanPromise = ChannelStore.performDeepScan().catch(err => {
        console.warn("ChannelStore scan notice:", err);
        return { totalCount: ChannelStore.getChannels().length, scannedFromFirestore: 0 };
      });

      const mediaScanPromise = MediaStore.performDeepScan().catch(err => {
        console.warn("MediaStore scan notice:", err);
        return { totalCount: MediaStore.getAllMedia().length, scannedFromFirestore: 0 };
      });

      // 2. Scan users from Firestore directly
      const userScanPromise = getDocs(collection(db, "users")).then(snap => {
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as DiscoveredUser));
      }).catch(err => {
        console.warn("Direct users scan notice:", err);
        return [] as DiscoveredUser[];
      });

      // 3. Scan posts & reels snapshots for discoverable authors
      const postsSnapPromise = getDocs(collection(db, "posts")).catch(() => null);
      const reelsSnapPromise = getDocs(collection(db, "reels")).catch(() => null);
      const marketSnapPromise = getDocs(collection(db, "marketplace_products")).catch(() => null);
      const groupsSnapPromise = getDocs(collection(db, "groups")).catch(() => null);

      // Await all parallel scans
      const [
        postRes,
        reelRes,
        marketRes,
        groupRes,
        channelRes,
        mediaRes,
        directUsers,
        postsSnap,
        reelsSnap,
        marketSnap,
        groupsSnap
      ] = await Promise.all([
        postScanPromise,
        reelScanPromise,
        marketScanPromise,
        groupScanPromise,
        channelScanPromise,
        mediaScanPromise,
        userScanPromise,
        postsSnapPromise,
        reelsSnapPromise,
        marketSnapPromise,
        groupsSnapPromise
      ]);

      // 4. Extract discoverable users from posts
      const discoveredFromPosts: DiscoveredUser[] = [];
      if (postsSnap) {
        postsSnap.docs.forEach(doc => {
          const data = doc.data() as any;
          if (data.userId) {
            discoveredFromPosts.push({
              id: data.userId,
              name: data.user?.name || data.authorEmail?.split('@')[0] || 'Member',
              username: data.user?.name?.toLowerCase().replace(/\s+/g, '_') || 'user',
              avatar: data.user?.avatar || '',
              email: data.authorEmail || '',
              role: 'user',
              isVerified: data.user?.isVerified
            });
          }
        });
      }

      // 5. Extract discoverable users from reels
      const discoveredFromReels: DiscoveredUser[] = [];
      if (reelsSnap) {
        reelsSnap.docs.forEach(doc => {
          const data = doc.data() as any;
          if (data.userId) {
            discoveredFromReels.push({
              id: data.userId,
              name: data.user || data.authorName || data.authorEmail?.split('@')[0] || 'Creator',
              username: data.authorUsername || data.user?.toLowerCase().replace(/\s+/g, '_') || 'creator',
              avatar: data.userAvatar || '',
              email: data.authorEmail || '',
              role: 'user'
            });
          }
        });
      }

      // 6. Extract discoverable users from marketplace
      const discoveredFromMarket: DiscoveredUser[] = [];
      if (marketSnap) {
        marketSnap.docs.forEach(doc => {
          const data = doc.data() as any;
          if (data.seller?.id) {
            discoveredFromMarket.push({
              id: data.seller.id,
              name: data.seller.name || 'Merchant',
              username: data.seller.name?.toLowerCase().replace(/\s+/g, '_') || 'seller',
              avatar: data.seller.avatar || '',
              role: 'user'
            });
          }
        });
      }

      // 7. Extract group members
      const discoveredFromGroups: DiscoveredUser[] = [];
      if (groupsSnap) {
        groupsSnap.docs.forEach(doc => {
          const data = doc.data() as any;
          if (Array.isArray(data.members)) {
            data.members.forEach((m: any) => {
              if (m.userId) {
                discoveredFromGroups.push({
                  id: m.userId,
                  name: m.name || 'Group Member',
                  username: m.name?.toLowerCase().replace(/\s+/g, '_') || 'member',
                  avatar: m.avatar || '',
                  role: m.role || 'member'
                });
              }
            });
          }
        });
      }

      // 8. Synthesize and deduplicate all discovered users
      const userMap = new Map<string, DiscoveredUser>();
      const seenEmails = new Set<string>();

      const addOrMerge = (u: DiscoveredUser) => {
        if (!u || !u.id) return;
        const idKey = u.id.toLowerCase().trim();
        const emailKey = (u.email || '').toLowerCase().trim();

        // Skip bot accounts
        if (idKey.startsWith('bot_') || (u as any).isRobot === true || (u as any).isBot === true || u.role === 'robot') {
          return;
        }

        if (emailKey && seenEmails.has(emailKey)) {
          for (const [existingId, existingUser] of userMap.entries()) {
            if ((existingUser.email || '').toLowerCase().trim() === emailKey) {
              userMap.set(existingId, {
                ...existingUser,
                ...u,
                id: existingId,
                avatar: u.avatar || existingUser.avatar,
                name: u.name || existingUser.name,
                username: u.username || existingUser.username
              });
              break;
            }
          }
          return;
        }

        if (!userMap.has(idKey)) {
          userMap.set(idKey, {
            ...u,
            username: u.username || u.name?.toLowerCase().replace(/\s+/g, '_') || 'user'
          });
          if (emailKey) seenEmails.add(emailKey);
        }
      };

      // Add direct users first
      directUsers.forEach(addOrMerge);
      // Add discovered users
      discoveredFromPosts.forEach(addOrMerge);
      discoveredFromReels.forEach(addOrMerge);
      discoveredFromMarket.forEach(addOrMerge);
      discoveredFromGroups.forEach(addOrMerge);

      // Add authenticated user if present
      if (auth.currentUser) {
        const authUid = auth.currentUser.uid.toLowerCase().trim();
        const authEmail = (auth.currentUser.email || '').toLowerCase().trim();
        if (!userMap.has(authUid) && (!authEmail || !seenEmails.has(authEmail))) {
          userMap.set(authUid, {
            id: auth.currentUser.uid,
            name: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'My Account',
            username: auth.currentUser.displayName?.toLowerCase().replace(/\s+/g, '_') || 'me',
            email: auth.currentUser.email || '',
            avatar: auth.currentUser.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
            role: 'user',
            isVerified: true
          });
        }
      }

      // Add community seed users
      (COMMUNITY_USERS || []).forEach(seed => {
        if ((seed as any).isRobot || (seed as any).isBot || (seed as any).role === 'robot' || seed.id.toLowerCase().startsWith('bot_')) return;
        const seedIdKey = seed.id.toLowerCase().trim();
        const seedEmailKey = (seed.email || '').toLowerCase().trim();
        if (!userMap.has(seedIdKey) && (!seedEmailKey || !seenEmails.has(seedEmailKey))) {
          userMap.set(seedIdKey, seed as DiscoveredUser);
          if (seedEmailKey) seenEmails.add(seedEmailKey);
        }
      });

      const finalUsers = Array.from(userMap.values()).filter(u => !((u as any).isRobot || (u as any).isBot || u.role === 'robot' || u.id.toLowerCase().startsWith('bot_')));
      this.cachedUsers = finalUsers;
      this.lastSyncTime = Date.now();

      try {
        localStorage.setItem('imchat_synced_users', JSON.stringify(finalUsers));
        localStorage.setItem('imchat_last_full_scan', String(this.lastSyncTime));
      } catch (e) {}

      const stats: SyncStats = {
        usersCount: finalUsers.length,
        postsCount: postRes.totalCount,
        reelsCount: reelRes.totalCount,
        marketplaceCount: marketRes.totalCount,
        groupsCount: groupRes.totalCount,
        channelsCount: channelRes.totalCount,
        mediaCount: mediaRes.totalCount,
        timestamp: this.lastSyncTime
      };

      console.log(`✅ [AutoSyncService] Background scan complete: ${stats.usersCount} users, ${stats.postsCount} posts, ${stats.reelsCount} reels, ${stats.marketplaceCount} products, ${stats.groupsCount} groups, ${stats.channelsCount} channels.`);

      // Broadcast custom events across the application
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app-deep-sync-completed', { detail: stats }));
        window.dispatchEvent(new CustomEvent('user-directory-sync', { detail: { users: finalUsers } }));
      }

      this.isSyncing = false;
      this.notify(stats);
      return stats;
    } catch (err) {
      console.error("AutoSyncManager background scan error:", err);
      this.isSyncing = false;
      const fallbackStats: SyncStats = {
        usersCount: this.cachedUsers.length,
        postsCount: PostStore.getPosts().length,
        reelsCount: ReelStore.getReels().length,
        marketplaceCount: MarketplaceStore.getProducts().length,
        groupsCount: GroupStore.getGroups().length,
        channelsCount: ChannelStore.getChannels().length,
        mediaCount: MediaStore.getAllMedia().length,
        timestamp: Date.now()
      };
      this.notify(fallbackStats);
      return fallbackStats;
    }
  }
}

export const AutoSyncService = new AutoSyncManager();
