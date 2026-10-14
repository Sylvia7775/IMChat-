
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  deleteDoc, 
  doc, 
  updateDoc,
  serverTimestamp,
  limit,
  getDocs
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export type Reel = {
  id: string;
  videoUrl: string;
  thumbnailUrl?: string;
  user: string;
  userAvatar?: string;
  description: string;
  music: string;
  likes: string;
  comments: string;
  shares: string;
  views?: string | number;
  viewCount?: number;
  timestamp: number;
  isDuet?: boolean;
  parentReelId?: string;
  taggedUsers?: string[];
  location?: string;
  userId?: string;
  authorEmail?: string;
  hideAvatarPublicly?: boolean;
  isLiveStream?: boolean;
  activeFilterId?: string;
  trimStart?: number;
  trimEnd?: number;
  stickerUrl?: string;
  stickerX?: number;
  stickerY?: number;
  stickerScale?: number;
  stickerRotation?: number;
  textOverlay?: string;
  textOverlayX?: number;
  textOverlayY?: number;
  textOverlayScale?: number;
  textOverlayColor?: string;
  aiCaption?: string;
  videoSpeed?: number;
  favourites?: string[];
  musicTrackId?: string;
  musicSynthPreset?: string;
  isPaidTrack?: boolean;
};

export function formatViews(views: string | number | undefined | null): string {
  if (views === undefined || views === null || views === '') return '0';
  const num = typeof views === 'number' ? views : parseInt(String(views).replace(/[^0-9]/g, ''), 10) || 0;
  if (num < 1000) return num.toString();
  if (num < 1000000) {
    const val = (num / 1000).toFixed(1);
    return val.endsWith('.0') ? `${Math.floor(num / 1000)}K` : `${val}K`;
  }
  const val = (num / 1000000).toFixed(1);
  return val.endsWith('.0') ? `${Math.floor(num / 1000000)}M` : `${val}M`;
}

class ReelStorageSystem {
  private reels: Reel[] = [];
  private listeners: Set<() => void> = new Set();
  private unsubscribe: (() => void) | null = null;

  constructor() {
    // Load cached reels from localStorage first
    try {
      const cached = localStorage.getItem('imchat_reels_cache');
      if (cached) {
        this.reels = JSON.parse(cached);
      }
    } catch (e) {
      console.warn('Could not read cached reels', e);
    }

    // Immediately start listening so reels are available without delay
    this.init();

    onAuthStateChanged(auth, (user) => {
      if (user) {
        this.init();
      }
    });
  }

  private getLocalViewsMap(): Record<string, number> {
    try {
      const stored = localStorage.getItem('imchat_reel_views');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  private saveLocalViews(reelId: string, count: number) {
    try {
      const map = this.getLocalViewsMap();
      map[reelId] = count;
      localStorage.setItem('imchat_reel_views', JSON.stringify(map));
    } catch (e) {
      console.warn("Could not save local reel views", e);
    }
  }

  private init() {
    if (this.unsubscribe) this.unsubscribe();
    const reelsCol = collection(db, 'reels');
    this.unsubscribe = onSnapshot(reelsCol, (snapshot) => {
      const localViews = this.getLocalViewsMap();
      const firestoreReels = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        let time = data.timestamp;
        if (typeof time !== 'number') {
          if (data.createdAt?.toMillis) {
            time = data.createdAt.toMillis();
          } else if (data.createdAt) {
            time = new Date(data.createdAt).getTime();
          } else {
            time = Date.now();
          }
        }
        const serverViews = typeof data.views === 'number' ? data.views : parseInt(data.views || '0', 10) || 0;
        const cachedLocal = localViews[docSnap.id] || 0;
        const finalViews = Math.max(serverViews, cachedLocal);
        return {
          id: docSnap.id,
          ...data,
          timestamp: isNaN(time) ? Date.now() : time,
          views: finalViews
        };
      }) as Reel[];
      
      const seedReels: Reel[] = [
        {
          id: 'seed-reel-1',
          videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-tree-with-yellow-leaves-in-the-wind-1115-large.mp4',
          thumbnailUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&h=600&fit=crop',
          user: 'NatureWalks',
          userAvatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=nature',
          description: 'A beautiful morning in the forest! ✨ 🌲 #nature #calm #morning',
          music: 'Forest Symphony - Smooth Sounds',
          likes: '142',
          comments: '18',
          shares: '12',
          views: localViews['seed-reel-1'] || 890,
          timestamp: Date.now() - 3600000 * 2,
          userId: 'seed-nature'
        },
        {
          id: 'seed-reel-2',
          videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-sign-shop-40108-large.mp4',
          thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=600&fit=crop',
          user: 'Baron',
          userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150',
          description: 'Neon dreams and late night creative workflow in Shibuya ⚡️ #cyberpunk #tokyo #neon',
          music: 'Tokyo Drift - Retrowave Night',
          likes: '389',
          comments: '45',
          shares: '28',
          views: localViews['seed-reel-2'] || 2450,
          timestamp: Date.now() - 3600000 * 6,
          userId: 'user_baron',
          authorEmail: 'baron@yahoo.com'
        },
        {
          id: 'seed-reel-3',
          videoUrl: 'https://www.youtube.com/watch?v=qgU_D0rSAt0',
          thumbnailUrl: 'https://img.youtube.com/vi/qgU_D0rSAt0/0.jpg',
          user: 'Chris',
          userAvatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=150',
          description: 'Relaxing winter cabin fireplace crackling sounds. Loop this for late night code! 🔥 #fireplace #cozy #asmr',
          music: 'Cozy Winter Hearth Crackling - ASMR Audio',
          likes: '512',
          comments: '63',
          shares: '41',
          views: localViews['seed-reel-3'] || 4200,
          timestamp: Date.now() - 3600000 * 12,
          userId: 'user_chris',
          authorEmail: 'chris987@aol.com'
        }
      ];

      const map = new Map<string, Reel>();
      seedReels.forEach(r => map.set(r.id, r));
      firestoreReels.forEach(r => map.set(r.id, r));

      const merged = Array.from(map.values());
      merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      this.reels = merged;

      // Cache to localStorage
      try {
        localStorage.setItem('imchat_reels_cache', JSON.stringify(this.reels));
      } catch (e) {
        console.warn("Could not cache reels", e);
      }
      
      this.notify();
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reels');
    });
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  getReels(): Reel[] {
    const localViews = this.getLocalViewsMap();
    return this.reels.map(r => ({
      ...r,
      views: Math.max(typeof r.views === 'number' ? r.views : parseInt(String(r.views || '0'), 10) || 0, localViews[r.id] || 0)
    }));
  }

  async performDeepScan(): Promise<{ totalCount: number; scannedFromFirestore: number }> {
    try {
      const reelsCol = collection(db, 'reels');
      const snapshot = await getDocs(reelsCol);
      const localViews = this.getLocalViewsMap();

      const firestoreReels = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        let time = data.timestamp;
        if (typeof time !== 'number') {
          if (data.createdAt?.toMillis) {
            time = data.createdAt.toMillis();
          } else if (data.createdAt) {
            time = new Date(data.createdAt).getTime();
          } else {
            time = Date.now();
          }
        }
        const serverViews = typeof data.views === 'number' ? data.views : parseInt(data.views || '0', 10) || 0;
        const cachedLocal = localViews[docSnap.id] || 0;
        const finalViews = Math.max(serverViews, cachedLocal);
        return {
          id: docSnap.id,
          ...data,
          timestamp: isNaN(time) ? Date.now() : time,
          views: finalViews
        };
      }) as Reel[];

      const seedReels: Reel[] = [
        {
          id: 'seed-reel-1',
          videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-tree-with-yellow-leaves-in-the-wind-1115-large.mp4',
          thumbnailUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&h=600&fit=crop',
          user: 'NatureWalks',
          userAvatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=nature',
          description: 'A beautiful morning in the forest! ✨ 🌲 #nature #calm #morning',
          music: 'Forest Symphony - Smooth Sounds',
          likes: '142',
          comments: '18',
          shares: '12',
          views: localViews['seed-reel-1'] || 890,
          timestamp: Date.now() - 3600000 * 2,
          userId: 'seed-nature'
        },
        {
          id: 'seed-reel-2',
          videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-sign-shop-40108-large.mp4',
          thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=600&fit=crop',
          user: 'Baron',
          userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150',
          description: 'Neon dreams and late night creative workflow in Shibuya ⚡️ #cyberpunk #tokyo #neon',
          music: 'Tokyo Drift - Retrowave Night',
          likes: '389',
          comments: '45',
          shares: '28',
          views: localViews['seed-reel-2'] || 2450,
          timestamp: Date.now() - 3600000 * 6,
          userId: 'user_baron',
          authorEmail: 'baron@yahoo.com'
        },
        {
          id: 'seed-reel-3',
          videoUrl: 'https://www.youtube.com/watch?v=qgU_D0rSAt0',
          thumbnailUrl: 'https://img.youtube.com/vi/qgU_D0rSAt0/0.jpg',
          user: 'Chris',
          userAvatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=150',
          description: 'Relaxing winter cabin fireplace crackling sounds. Loop this for late night code! 🔥 #fireplace #cozy #asmr',
          music: 'Cozy Winter Hearth Crackling - ASMR Audio',
          likes: '512',
          comments: '63',
          shares: '41',
          views: localViews['seed-reel-3'] || 4200,
          timestamp: Date.now() - 3600000 * 12,
          userId: 'user_chris',
          authorEmail: 'chris987@aol.com'
        }
      ];

      const map = new Map<string, Reel>();
      seedReels.forEach(r => map.set(r.id, r));
      firestoreReels.forEach(r => map.set(r.id, r));

      const merged = Array.from(map.values());
      merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      this.reels = merged;

      try {
        localStorage.setItem('imchat_reels_cache', JSON.stringify(this.reels));
      } catch (e) {
        console.warn(e);
      }

      this.notify();
      return {
        totalCount: merged.length,
        scannedFromFirestore: firestoreReels.length
      };
    } catch (err) {
      console.error("Deep scan reels error:", err);
      return {
        totalCount: this.reels.length,
        scannedFromFirestore: 0
      };
    }
  }

  getUserReels(userId?: string, userName?: string, userEmail?: string): Reel[] {
    const all = this.getReels();
    const cleanId = (userId || '').trim();
    const cleanName = (userName || '').trim().toLowerCase();
    const cleanEmail = (userEmail || '').trim().toLowerCase();

    return all.filter(r => {
      if (cleanId && r.userId && r.userId === cleanId) return true;
      if (cleanEmail && r.authorEmail && r.authorEmail.toLowerCase() === cleanEmail) return true;
      if (cleanName && r.user && r.user.toLowerCase() === cleanName && cleanName !== 'user') return true;
      if (!cleanId && !cleanEmail && cleanName && r.user && r.user.toLowerCase() === cleanName) return true;
      return false;
    });
  }

  getUserReelCount(userId?: string, userName?: string, userEmail?: string): number {
    return this.getUserReels(userId, userName, userEmail).length;
  }

  async incrementViews(id: string) {
    if (!id) return;
    const localViews = this.getLocalViewsMap();
    const cur = localViews[id] || 0;
    const nextViews = cur + 1;
    this.saveLocalViews(id, nextViews);

    // Update in-memory
    const target = this.reels.find(r => r.id === id);
    if (target) {
      const curV = typeof target.views === 'number' ? target.views : parseInt(String(target.views || '0'), 10) || 0;
      target.views = Math.max(curV + 1, nextViews);
    }
    this.notify();

    // Also dispatch custom event so open views update immediately
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('reel-viewed', { detail: { id, views: nextViews } }));
    }

    // Update in Firestore if not a seed reel
    if (!id.startsWith('seed-') && !id.startsWith('yt-short-') && !id.startsWith('reel_')) {
      try {
        await updateDoc(doc(db, 'reels', id), {
          views: nextViews
        });
      } catch (err) {
        // Silently catch firestore errors (e.g. offline or rule)
      }
    }
  }

  async addReel(reelData: Omit<Reel, 'id' | 'timestamp' | 'likes' | 'comments' | 'shares'>) {
    const currentAuthUser = auth.currentUser;
    const currentUid = (reelData as any).userId || currentAuthUser?.uid || 'anonymous';
    const currentEmail = (reelData as any).authorEmail || currentAuthUser?.email || '';

    const payload = {
      ...reelData,
      userId: currentUid,
      authorEmail: currentEmail,
      likes: '0',
      comments: '0',
      shares: '0',
      views: 0,
      timestamp: Date.now()
    };

    try {
      const docRef = await addDoc(collection(db, 'reels'), payload);
      return docRef.id;
    } catch (err) {
      console.error("Error adding reel to Firestore:", err);
      try {
        handleFirestoreError(err, OperationType.CREATE, 'reels');
      } catch (e) { /* logic continues to fallback */ }
      
      // Fallback for local experience if Firestore fails
      const newReel: Reel = {
        ...payload,
        id: "reel_" + Date.now()
      };
      this.reels = [newReel, ...this.reels];
      this.notify();
      return newReel.id;
    }
  }

  async deleteReel(id: string) {
    try {
      await deleteDoc(doc(db, 'reels', id));
    } catch (err) {
      console.error("Error deleting reel:", err);
      handleFirestoreError(err, OperationType.DELETE, `reels/${id}`);
    }
  }
}

export const ReelStore = new ReelStorageSystem();
