import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  deleteDoc, 
  updateDoc,
  doc, 
  orderBy,
  serverTimestamp,
  limit,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export type MediaPrivacy = 'public' | 'followers' | 'private';

export type MediaItem = {
  id: string;
  url: string; 
  type: 'image' | 'video';
  fileObj?: File; 
  sizeBytes: number;
  createdAt: any;
  userId: string;
  userName?: string;
  userAvatar?: string;
  thumbnailUrl?: string; 
  password?: string; 
  privacy?: MediaPrivacy; // 'public' | 'followers' | 'private'
  caption?: string;
  name?: string;
  sharesCount?: number;
  sharedFrom?: {
    originalMediaId: string;
    originalUserId: string;
    originalUserName: string;
    originalUserAvatar?: string;
  };
  deviceId?: string;
  ipAddress?: string;
  source?: 'google-drive' | 'flickr' | 'instagram' | 'upload';
};

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // Increased to 50MB for videos
export const MAX_USER_MEDIA = 100; 

class MediaStorageSystem {
  private media: MediaItem[] = [];
  private loading: boolean = false;
  private listeners: Set<() => void> = new Set();
  private unsubscribe: (() => void) | null = null;
  private currentUserId: string | null = null;

  constructor() {
    onAuthStateChanged(auth, (user) => {
      this.currentUserId = user ? user.uid : null;
      if (user) {
        this.init();
      } else {
        this.stop();
      }
    });
  }

  private stop() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.media = [];
    this.notify();
  }

  private init() {
    if (!this.currentUserId) return;
    if (this.unsubscribe) this.unsubscribe();
    
    this.loading = true;
    this.notify();

    // Filter by current user to ensure we get THEIR media
    const q = query(
      collection(db, 'media'), 
      where("userId", "==", this.currentUserId),
      limit(100)
    );
    
    this.unsubscribe = onSnapshot(q, (snapshot) => {
      this.media = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          privacy: data.privacy || 'public',
          sharesCount: data.sharesCount || 0,
          ...data,
          createdAt: data.createdAt || { seconds: Date.now() / 1000 }
        };
      }) as MediaItem[];
      this.loading = false;
      this.notify();
    }, (error) => {
      console.warn("MediaStore Snapshot Warning:", error);
      try {
        handleFirestoreError(error, OperationType.LIST, 'media');
      } catch (err) {
        console.warn("MediaStore snapshot error intercepted:", err);
      }
      this.loading = false;
      this.notify();
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

  getAllMedia() {
    return [...this.media];
  }

  getMedia() {
    return [...this.media];
  }

  isLoading() {
    return this.loading;
  }

  getUserMedia(userId: string, viewerId?: string, isFollowing?: boolean): MediaItem[] {
    if (!userId) return [];
    const cleanId = userId.toLowerCase().trim();
    return this.media
      .filter(m => {
        if ((m.userId || '').toLowerCase().trim() !== cleanId) return false;
        // If viewerId is omitted, viewing as admin / owner
        if (viewerId === undefined) return true;
        // If viewing own media, show everything
        if (m.userId === viewerId) return true;
        // If private, only owner can view
        if (m.privacy === 'private') return false;
        // If followers-only, only show if viewer follows the user
        if (m.privacy === 'followers' && !isFollowing) return false;
        return true;
      })
      .sort((a,b) => {
        const aTime = a.createdAt?.seconds || (typeof a.createdAt === 'number' ? a.createdAt : Date.now() / 1000);
        const bTime = b.createdAt?.seconds || (typeof b.createdAt === 'number' ? b.createdAt : Date.now() / 1000);
        return bTime - aTime;
      });
  }

  async fetchUserMediaDirectly(userId: string, viewerId?: string, isFollowing?: boolean): Promise<MediaItem[]> {
    try {
      const q = query(
        collection(db, 'media'), 
        where("userId", "==", userId),
        limit(100)
      );
      const snap = await getDocs(q);
      const items = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          privacy: data.privacy || 'public',
          sharesCount: data.sharesCount || 0,
          ...data,
          createdAt: data.createdAt || { seconds: Date.now() / 1000 }
        } as MediaItem;
      });

      return items
        .filter(m => {
          if (!viewerId || m.userId === viewerId) return true;
          if (m.privacy === 'private') return false;
          if (m.privacy === 'followers' && !isFollowing) return false;
          return true;
        })
        .sort((a,b) => {
          const aTime = a.createdAt?.seconds || (typeof a.createdAt === 'number' ? a.createdAt : Date.now() / 1000);
          const bTime = b.createdAt?.seconds || (typeof b.createdAt === 'number' ? b.createdAt : Date.now() / 1000);
          return bTime - aTime;
        });
    } catch (err) {
      console.error("fetchUserMediaDirectly error:", err);
      return [];
    }
  }

  async fetchFollowedUsersMedia(followedUserIds: string[]): Promise<MediaItem[]> {
    if (!followedUserIds || followedUserIds.length === 0) return [];
    try {
      // Chunk in arrays of up to 10 for Firestore 'in' queries
      const chunks: string[][] = [];
      for (let i = 0; i < followedUserIds.length; i += 10) {
        chunks.push(followedUserIds.slice(i, i + 10));
      }

      let allMedia: MediaItem[] = [];
      for (const chunk of chunks) {
        const q = query(
          collection(db, 'media'),
          where("userId", "in", chunk),
          limit(50)
        );
        const snap = await getDocs(q);
        const items = snap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            privacy: data.privacy || 'public',
            sharesCount: data.sharesCount || 0,
            ...data,
            createdAt: data.createdAt || { seconds: Date.now() / 1000 }
          } as MediaItem;
        });
        allMedia.push(...items);
      }

      // Filter: followed users can see 'public' and 'followers' media (exclude 'private')
      return allMedia
        .filter(m => m.privacy !== 'private')
        .sort((a, b) => {
          const aTime = a.createdAt?.seconds || (typeof a.createdAt === 'number' ? a.createdAt : Date.now() / 1000);
          const bTime = b.createdAt?.seconds || (typeof b.createdAt === 'number' ? b.createdAt : Date.now() / 1000);
          return bTime - aTime;
        });
    } catch (err) {
      console.error("fetchFollowedUsersMedia error:", err);
      return [];
    }
  }

  async addMedia(item: Omit<MediaItem, 'id' | 'createdAt'>): Promise<{ success: boolean, message?: string }> {
    if (!this.currentUserId) return { success: false, message: "Not authenticated" };

    const currentMedia = this.getUserMedia(item.userId);
    
    if (currentMedia.length >= MAX_USER_MEDIA) {
      return { success: false, message: `Upload limit reached. You can only have ${MAX_USER_MEDIA} media items.` };
    }

    try {
      const { fileObj, ...dataToSave } = item;
      
      const simulatedDeviceId = typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 50) + "-" + item.userId.substring(0, 5) : 'server';
      const simulatedIp = "127.0.0.1";

      await addDoc(collection(db, 'media'), {
        ...dataToSave,
        privacy: item.privacy || 'public',
        sharesCount: 0,
        deviceId: simulatedDeviceId,
        ipAddress: simulatedIp,
        createdAt: serverTimestamp(),
        userId: item.userId
      });
      return { success: true };
    } catch (err) {
      console.error("MediaStore addMedia failure:", err);
      try {
        handleFirestoreError(err, OperationType.CREATE, 'media');
      } catch (handlerErr) {
        // Already handled/logged
      }
      return { success: false, message: "Upload to database failed. Check permissions or file size." };
    }
  }

  async updateMediaPrivacy(mediaId: string, privacy: MediaPrivacy): Promise<{ success: boolean, message?: string }> {
    const itemRef = doc(db, 'media', mediaId);
    try {
      await updateDoc(itemRef, { 
        privacy,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    } catch (err) {
      console.error("Update media privacy error:", err);
      handleFirestoreError(err, OperationType.UPDATE, `media/${mediaId}`);
      return { success: false, message: "Failed to update privacy settings." };
    }
  }

  async incrementSharesCount(mediaId: string): Promise<void> {
    try {
      const itemRef = doc(db, 'media', mediaId);
      const snap = await getDoc(itemRef);
      if (snap.exists()) {
        const currentShares = (snap.data().sharesCount as number) || 0;
        await updateDoc(itemRef, {
          sharesCount: currentShares + 1
        });
      }
    } catch (err) {
      console.warn("Could not increment shares count:", err);
    }
  }

  async deleteMedia(mediaId: string, userId?: string) {
    try {
      this.media = this.media.filter(m => m.id !== mediaId);
      this.notify();
      await deleteDoc(doc(db, 'media', mediaId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `media/${mediaId}`);
    }
  }

  async deleteMediaBulk(mediaIds: string[]): Promise<number> {
    if (!mediaIds || mediaIds.length === 0) return 0;
    const idSet = new Set(mediaIds);
    this.media = this.media.filter(m => !idSet.has(m.id));
    this.notify();

    let deleted = 0;
    for (const id of mediaIds) {
      try {
        await deleteDoc(doc(db, 'media', id));
        deleted++;
      } catch (err) {
        console.warn(`Could not delete media ${id}:`, err);
      }
    }
    return deleted;
  }

  async cleanMissingOrBrokenMedia(): Promise<{ scanned: number; removed: number }> {
    const brokenIds: string[] = [];
    for (const m of this.media) {
      if (!m.url || m.url.trim() === '' || m.url.includes('missing') || m.url.includes('undefined')) {
        brokenIds.push(m.id);
      }
    }
    if (brokenIds.length > 0) {
      await this.deleteMediaBulk(brokenIds);
    }
    return { scanned: this.media.length, removed: brokenIds.length };
  }

  async requestDeleteMedia(mediaId: string, password?: string) {
    if (!auth.currentUser) return { success: false, message: "Not authenticated" };

    try {
      const idToken = await auth.currentUser.getIdToken();
      const response = await fetch(`/api/media/${mediaId}/request-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ mediaPassword: password })
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, message: data.error || "Failed to request deletion" };
      }

      return { success: true, message: data.message };
    } catch (err) {
      console.error("requestDeleteMedia error:", err);
      return { success: false, message: "Network error occurred" };
    }
  }

  async replaceMedia(mediaId: string, userId: string, newItem: Omit<MediaItem, 'id' | 'createdAt' | 'userId'>) {
    const itemRef = doc(db, 'media', mediaId);
    
    try {
      const { fileObj, ...dataToUpdate } = newItem;
      await updateDoc(itemRef, {
        ...dataToUpdate,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `media/${mediaId}`);
      return { success: false, message: "Update failed." };
    }
  }

  async setMediaPassword(mediaId: string, password: string | null) {
    const itemRef = doc(db, 'media', mediaId);
    try {
      await updateDoc(itemRef, { password: password || null });
      return { success: true };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `media/${mediaId}`);
      return { success: false, message: "Update failed." };
    }
  }

  async performDeepScan(): Promise<{ totalCount: number; scannedFromFirestore: number }> {
    try {
      const q = query(collection(db, 'media'), limit(200));
      const snap = await getDocs(q);
      const items = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          privacy: data.privacy || 'public',
          sharesCount: data.sharesCount || 0,
          ...data,
          createdAt: data.createdAt || { seconds: Date.now() / 1000 }
        } as MediaItem;
      });

      if (items.length > 0) {
        // Merge with current media
        const map = new Map<string, MediaItem>();
        this.media.forEach(m => map.set(m.id, m));
        items.forEach(m => map.set(m.id, m));
        this.media = Array.from(map.values());
        this.notify();
      }

      return {
        totalCount: this.media.length,
        scannedFromFirestore: items.length
      };
    } catch (err) {
      console.warn("Deep scan media note:", err);
      return {
        totalCount: this.media.length,
        scannedFromFirestore: 0
      };
    }
  }
}

export const MediaStore = new MediaStorageSystem();

