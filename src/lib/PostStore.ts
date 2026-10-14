
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  deleteDoc, 
  updateDoc,
  doc, 
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  limit,
  where,
  setDoc,
  getDocs
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { containsProhibitedWords } from './wordFilter';

export type PostComment = {
  id: string;
  authorId: string;
  authorName: string;
  avatar: string;
  text: string;
  timestamp: number;
  reactions: string[];
  isEdited?: boolean;
  mediaUrl?: string; // for stickers/gifs
  replyToId?: string;
  audioUrl?: string; // voice comment url
  audioDuration?: number; // voice comment duration in seconds
};

export type Post = {
  id: string;
  userId?: string;
  authorEmail?: string;
  user: { name: string; avatar: string; location: string; isVerified?: boolean };
  image: string;
  mediaUrl?: string;
  mediaType: 'image' | 'video';
  createdAt?: string;
  likes: string[]; // array of user names
  likesOverride?: number; // admin override count
  favourites: string[]; // array of user IDs/names
  ratings?: Record<string, number>; // mapping of username/userId to star rating (1 to 5)
  caption: string;
  timestamp: number;
  isSaved: boolean;
  comments: PostComment[];
  visibility?: 'public' | 'private' | 'friends';
  allowedUserIds?: string[];
  pinned?: boolean;
  location?: string;
  eventData?: {
    id: string;
    title: string;
    date: string;
    time: string;
    location: string;
    category: string;
    coverImage?: string;
    creatorId: string;
    interestedCount?: number;
    isPromoted?: boolean;
    promotionBudget?: number;
  };
  reelData?: {
    reelId: string;
    videoUrl?: string;
    thumbnailUrl?: string;
  };
  audioUrl?: string;
  audioDuration?: number;
  taggedUsers?: string[];
};

export const INITIAL_COMMUNITY_POSTS: Post[] = [
  {
    id: 'seed-post-baron-1',
    userId: 'user_baron',
    authorEmail: 'baron@yahoo.com',
    user: {
      name: 'Baron',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150',
      location: 'New York, USA',
      isVerified: true
    },
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1080&auto=format&fit=crop&q=80',
    mediaType: 'image',
    caption: 'Sunset vibes from the new architectural villa project 🌅 Excited to share the full walkthrough with the community! Check it out in the marketplace.',
    timestamp: Date.now() - 3600000 * 5,
    likes: ['Chris', 'Janet', 'Bella', 'Amber'],
    favourites: ['Chris'],
    isSaved: false,
    comments: [
      {
        id: 'c1',
        authorId: 'user_chris',
        authorName: 'Chris',
        avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=150',
        text: 'Incredible lighting and composition! 🔥',
        timestamp: Date.now() - 3600000 * 4,
        reactions: ['❤️']
      },
      {
        id: 'c2',
        authorId: 'user_janet',
        authorName: 'Janet',
        avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=150',
        text: 'Stunning villa view! ✨',
        timestamp: Date.now() - 3600000 * 3,
        reactions: ['👏']
      }
    ]
  },
  {
    id: 'seed-post-janet-1',
    userId: 'user_janet',
    authorEmail: 'janet@yahoo.com',
    user: {
      name: 'Janet',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=150',
      location: 'Paris, France',
      isVerified: true
    },
    image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1080&auto=format&fit=crop&q=80',
    mediaType: 'image',
    caption: 'Morning in Paris with freshly brewed espresso and warm pastries ☕️🇫🇷 Wishing everyone an inspired day!',
    timestamp: Date.now() - 3600000 * 12,
    likes: ['Baron', 'Sam', 'Amber', 'Effie'],
    favourites: ['Baron'],
    isSaved: false,
    comments: [
      {
        id: 'c3',
        authorId: 'user_amber',
        authorName: 'Amber',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150',
        text: 'Save a croissant for me! 🥐',
        timestamp: Date.now() - 3600000 * 10,
        reactions: ['❤️']
      }
    ]
  },
  {
    id: 'seed-post-chris-1',
    userId: 'user_chris',
    authorEmail: 'chris987@aol.com',
    user: {
      name: 'Chris',
      avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=150',
      location: 'San Francisco, CA',
      isVerified: true
    },
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=1080&auto=format&fit=crop&q=80',
    mediaType: 'image',
    caption: 'New camera test in low light conditions 📸 Sharpness is next level. What lens setups do you guys shoot with?',
    timestamp: Date.now() - 3600000 * 24,
    likes: ['Baron', 'Dwayne', 'Sam'],
    favourites: [],
    isSaved: false,
    comments: []
  },
  {
    id: 'seed-post-sam-1',
    userId: 'user_sam',
    authorEmail: 'alex8@yahoo.com',
    user: {
      name: 'Sam',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=150',
      location: 'Denver, CO',
      isVerified: true
    },
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1080&auto=format&fit=crop&q=80',
    mediaType: 'image',
    caption: 'Weekend mountain ridge trail hike. Crisp mountain air and endless panoramic views 🏔️',
    timestamp: Date.now() - 3600000 * 36,
    likes: ['Chris', 'Baron', 'Janet'],
    favourites: [],
    isSaved: false,
    comments: []
  }
];

function cleanUndefined(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined);
  } else if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc: any, key) => {
      const val = obj[key];
      if (val !== undefined) {
        acc[key] = cleanUndefined(val);
      }
      return acc;
    }, {});
  }
  return obj;
}

const isDeletionBlocked = () => {
  return localStorage.getItem('blockDeletion') === 'true';
};

class PostStorageSystem {
  private posts: Post[] = [];
  private savedPosts: Post[] = [];
  private savedPostIds: Set<string> = new Set();
  private listeners: Set<() => void> = new Set();
  private allVerified: boolean = true;
  private unsubscribe: (() => void) | null = null;
  private savedUnsubscribe: (() => void) | null = null;

  constructor() {
    const savedVerified = localStorage.getItem('yolanda_all_verified') || localStorage.getItem('imchat_all_verified');
    if (savedVerified) this.allVerified = JSON.parse(savedVerified);

    const savedPosts = localStorage.getItem('imchat_cached_posts');
    if (savedPosts) {
      try {
        this.posts = JSON.parse(savedPosts);
      } catch (e) {
        console.warn("Failed to parse cached posts:", e);
        this.posts = INITIAL_COMMUNITY_POSTS;
      }
    } else {
      this.posts = INITIAL_COMMUNITY_POSTS;
    }

    // Immediately start listening so posts load without waiting
    this.init();

    onAuthStateChanged(auth, (user) => {
      if (user) {
        this.init();
        this.initSavedPosts(user.uid);
      } else {
        if (this.savedUnsubscribe) {
          this.savedUnsubscribe();
          this.savedUnsubscribe = null;
        }
        this.savedPosts = [];
        this.savedPostIds = new Set();
        this.notify();
      }
    });
  }

  private init() {
    if (this.unsubscribe) this.unsubscribe();
    // Query posts collection
    const postsCol = collection(db, 'posts');
    this.unsubscribe = onSnapshot(postsCol, (snapshot) => {
      const firestorePosts = snapshot.docs.map(docSnap => {
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
        return {
          id: docSnap.id,
          ...data,
          timestamp: isNaN(time) ? Date.now() : time
        };
      }) as Post[];
      
      // Merge with seed posts so community posts remain accessible to all users
      const postMap = new Map<string, Post>();
      INITIAL_COMMUNITY_POSTS.forEach(p => postMap.set(p.id, p));
      this.posts.forEach(p => postMap.set(p.id, p));
      firestorePosts.forEach(p => postMap.set(p.id, p));

      const merged = Array.from(postMap.values());
      merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      this.posts = merged;
      
      // Cache posts to localStorage
      try {
        localStorage.setItem('imchat_cached_posts', JSON.stringify(this.posts));
      } catch (e) {
        console.warn("Failed to cache posts:", e);
      }
      
      this.notify();
    }, (error) => {
      console.warn("Posts snapshot notice:", error);
      if (this.posts.length === 0) {
        try {
          const cached = localStorage.getItem('imchat_cached_posts');
          if (cached) {
            this.posts = JSON.parse(cached);
          } else {
            this.posts = INITIAL_COMMUNITY_POSTS;
          }
        } catch (e) {
          this.posts = INITIAL_COMMUNITY_POSTS;
        }
        this.notify();
      }
    });
  }

  private initSavedPosts(uid: string) {
    if (this.savedUnsubscribe) this.savedUnsubscribe();
    const q = query(
      collection(db, 'saved_posts'),
      where('userId', '==', uid),
      orderBy('savedAt', 'desc')
    );
    this.savedUnsubscribe = onSnapshot(q, (snapshot) => {
      const ids = new Set<string>();
      const savedList: Post[] = [];
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        ids.add(data.postId);
        
        const existingPost = this.posts.find(p => p.id === data.postId);
        if (existingPost) {
          savedList.push({
            ...existingPost,
            isSaved: true
          });
        } else if (data.postData) {
          savedList.push({
            id: data.postId,
            ...data.postData,
            isSaved: true
          });
        }
      });
      this.savedPostIds = ids;
      this.savedPosts = savedList;
      this.notify();
    }, (error) => {
      console.warn("Failed to list saved posts:", error);
      handleFirestoreError(error, OperationType.LIST, 'saved_posts');
    });
  }

  private saveVerified() {
    localStorage.setItem('yolanda_all_verified', JSON.stringify(this.allVerified));
    localStorage.removeItem('imchat_all_verified');
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

  getPosts(): Post[] {
    const list = this.posts.length > 0 ? this.posts : INITIAL_COMMUNITY_POSTS;
    return list.filter(Boolean).map(p => ({
      ...p,
      isSaved: this.savedPostIds.has(p?.id || ''),
      user: {
        name: p?.user?.name || p?.authorEmail?.split('@')[0] || 'User',
        avatar: p?.user?.avatar || '',
        location: p?.user?.location || '',
        isVerified: Boolean(p?.user?.isVerified || this.allVerified)
      }
    }));
  }

  getUserPosts(userId?: string, userName?: string, userEmail?: string): Post[] {
    const all = this.getPosts();
    const cleanId = (userId || '').trim().toLowerCase();
    const cleanName = (userName || '').trim().toLowerCase();
    const cleanEmail = (userEmail || '').trim().toLowerCase();

    return all.filter(p => {
      if (!p) return false;
      if (cleanId && p.userId && p.userId.toLowerCase() === cleanId) return true;
      if (cleanEmail && p.authorEmail && p.authorEmail.toLowerCase() === cleanEmail) return true;
      if (cleanName && p.user?.name && p.user.name.toLowerCase() === cleanName && cleanName !== 'user') return true;
      if (!cleanId && !cleanEmail && cleanName && p.user?.name && p.user.name.toLowerCase() === cleanName) return true;
      return false;
    });
  }

  getUserPostCount(userId?: string, userName?: string, userEmail?: string): number {
    return this.getUserPosts(userId, userName, userEmail).length;
  }

  getUserComments(userId?: string, userName?: string, userEmail?: string): { post: Post; comment: PostComment }[] {
    const all = this.getPosts();
    const cleanId = (userId || '').trim().toLowerCase();
    const cleanName = (userName || '').trim().toLowerCase();
    const cleanEmail = (userEmail || '').trim().toLowerCase();

    const results: { post: Post; comment: PostComment }[] = [];
    all.forEach(post => {
      if (Array.isArray(post.comments)) {
        post.comments.forEach(comment => {
          if (!comment) return;
          let match = false;
          if (cleanId && comment.authorId && comment.authorId.toLowerCase() === cleanId) match = true;
          if (!match && cleanName && comment.authorName && comment.authorName.toLowerCase() === cleanName) match = true;
          if (!match && cleanEmail && (comment as any).authorEmail && (comment as any).authorEmail.toLowerCase() === cleanEmail) match = true;

          if (match) {
            results.push({ post, comment });
          }
        });
      }
    });

    return results;
  }

  async performDeepScan(): Promise<{ totalCount: number; scannedFromFirestore: number }> {
    try {
      const postsCol = collection(db, 'posts');
      const snapshot = await getDocs(postsCol);
      const firestorePosts = snapshot.docs.map(docSnap => {
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
        return {
          id: docSnap.id,
          ...data,
          timestamp: isNaN(time) ? Date.now() : time
        };
      }) as Post[];

      const postMap = new Map<string, Post>();
      INITIAL_COMMUNITY_POSTS.forEach(p => postMap.set(p.id, p));
      firestorePosts.forEach(p => postMap.set(p.id, p));

      const merged = Array.from(postMap.values());
      merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      this.posts = merged;

      try {
        localStorage.setItem('imchat_cached_posts', JSON.stringify(this.posts));
      } catch (e) {
        console.warn("Could not cache posts:", e);
      }

      this.notify();
      return {
        totalCount: merged.length,
        scannedFromFirestore: firestorePosts.length
      };
    } catch (err) {
      console.error("Deep scan posts error:", err);
      return {
        totalCount: this.posts.length,
        scannedFromFirestore: 0
      };
    }
  }

  getSavedPosts() {
    return this.savedPosts.filter(Boolean).map(p => ({
      ...p,
      user: {
        name: p?.user?.name || 'User',
        avatar: p?.user?.avatar || '',
        location: p?.user?.location || '',
        isVerified: Boolean(p?.user?.isVerified || this.allVerified)
      }
    }));
  }

  async deletePost(id: string, forceAdmin: boolean = false) {
    if (!forceAdmin && isDeletionBlocked()) {
      console.warn("Post deletion blocked by system policy.");
      return;
    }
    this.posts = this.posts.filter(p => p.id !== id);
    try {
      localStorage.setItem('imchat_cached_posts', JSON.stringify(this.posts));
    } catch (e) {}
    this.notify();

    try {
      await deleteDoc(doc(db, 'posts', id));
    } catch (err) {
      console.warn("Delete post notice:", err);
    }
  }

  async deletePostsBulk(ids: string[]): Promise<number> {
    if (!ids || ids.length === 0) return 0;
    const idSet = new Set(ids);
    this.posts = this.posts.filter(p => !idSet.has(p.id));
    try {
      localStorage.setItem('imchat_cached_posts', JSON.stringify(this.posts));
    } catch (e) {}
    this.notify();

    let deleted = 0;
    for (const id of ids) {
      try {
        await deleteDoc(doc(db, 'posts', id));
        deleted++;
      } catch (err) {
        console.warn(`Could not delete post ${id} from Firestore:`, err);
      }
    }
    return deleted;
  }

  verifyAllUsers(verified: boolean) {
    this.allVerified = verified;
    this.saveVerified();
    this.notify();
  }

  isAllVerified() {
    return this.allVerified;
  }

  async addPost(post: Omit<Post, 'id' | 'timestamp' | 'likes' | 'favourites' | 'isSaved' | 'comments'>): Promise<string> {
    // Auto-block spam in post submission if they are not verified
    const isVerified = post.user?.isVerified;
    if (!isVerified && containsProhibitedWords(post.caption)) {
      const errorMsg = "Post Blocked: Your content contains prohibited words or spam indicators (scam/phishing/free_money/etc.). Only verified user profiles can publish this content.";
      alert(errorMsg);
      throw new Error(errorMsg);
    }

    const currentAuthUser = auth.currentUser;
    const currentUid = (post as any).userId || currentAuthUser?.uid || 'user_' + Date.now();
    const currentEmail = (post as any).authorEmail || currentAuthUser?.email || '';
    const tempPostId = "post_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);

    const newPost: Post = {
      ...post,
      id: tempPostId,
      userId: currentUid,
      authorEmail: currentEmail,
      timestamp: Date.now(),
      likes: [],
      favourites: [],
      isSaved: false,
      comments: []
    };

    // 1. Immediately insert into local store and cache so post is 100% instantly available
    this.posts = [newPost, ...this.posts.filter(p => p.id !== tempPostId)];
    try {
      localStorage.setItem('imchat_cached_posts', JSON.stringify(this.posts));
    } catch (e) {}
    this.notify();

    // 2. Persist to Firestore in background
    try {
      const payload = cleanUndefined({
        ...post,
        userId: currentUid,
        authorEmail: currentEmail,
        timestamp: Date.now(),
        likes: [],
        favourites: [],
        isSaved: false,
        comments: []
      });
      const docRef = await addDoc(collection(db, 'posts'), payload);
      if (docRef?.id) {
        newPost.id = docRef.id;
        this.posts = this.posts.map(p => p.id === tempPostId ? { ...p, id: docRef.id } : p);
        try {
          localStorage.setItem('imchat_cached_posts', JSON.stringify(this.posts));
        } catch (e) {}
        this.notify();
        return docRef.id;
      }
    } catch (err) {
      console.warn("Firestore post save warning (kept in local store):", err);
    }

    return tempPostId;
  }

  async updatePost(id: string, updates: Partial<Post>) {
    this.posts = this.posts.map(p => p.id === id ? { ...p, ...updates } : p);
    try {
      localStorage.setItem('imchat_cached_posts', JSON.stringify(this.posts));
    } catch (e) {}
    this.notify();

    try {
      const cleaned = cleanUndefined(updates);
      await updateDoc(doc(db, 'posts', id), cleaned);
    } catch (err) {
      console.warn("Update post notice:", err);
    }
  }

  async updatePostLikesCount(id: string, count: number) {
    try {
      await updateDoc(doc(db, 'posts', id), {
        likesOverride: count
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posts/${id}`);
    }
  }

  async toggleLike(id: string, userName: string) {
    const post = this.posts.find(p => p.id === id);
    if (!post) return;

    const isLiked = post.likes.includes(userName);
    if (isLiked && isDeletionBlocked()) {
      console.warn("Reaction deletion blocked by system policy.");
      return;
    }
    const postRef = doc(db, 'posts', id);
    
    try {
      await updateDoc(postRef, {
        likes: isLiked ? arrayRemove(userName) : arrayUnion(userName)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posts/${id}`);
    }
  }

  async toggleFavourite(id: string, userName: string) {
    const post = this.posts.find(p => p.id === id);
    if (!post) return;

    if (!post.favourites) post.favourites = [];
    const isFavourited = post.favourites.includes(userName);
    if (isFavourited) {
      post.favourites = post.favourites.filter(u => u !== userName);
    } else {
      post.favourites.push(userName);
    }

    const postRef = doc(db, 'posts', id);
    try {
      await updateDoc(postRef, {
        favourites: isFavourited ? arrayRemove(userName) : arrayUnion(userName)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posts/${id}`);
    }
  }

  async setRating(id: string, userName: string, score: number) {
    const post = this.posts.find(p => p.id === id);
    if (!post) return;

    if (!post.ratings) post.ratings = {};
    post.ratings = {
      ...post.ratings,
      [userName]: Number(score)
    };

    // Cache updated posts and immediately notify UI subscribers
    try {
      localStorage.setItem('imchat_cached_posts', JSON.stringify(this.posts));
    } catch (e) {
      console.warn("Failed to cache posts:", e);
    }
    this.notify();

    const postRef = doc(db, 'posts', id);
    try {
      await updateDoc(postRef, {
        [`ratings.${userName}`]: Number(score)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posts/${id}`);
    }
  }

  async toggleSave(id: string) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const savedId = `${uid}_${id}`;
    const isSaved = this.savedPostIds.has(id);

    try {
      if (isSaved) {
        await deleteDoc(doc(db, 'saved_posts', savedId));
      } else {
        const post = this.posts.find(p => p.id === id);
        if (!post) return;
        
        const { id: _, isSaved: __, ...postData } = post;

        await setDoc(doc(db, 'saved_posts', savedId), {
          userId: uid,
          postId: id,
          savedAt: Date.now(),
          postData: cleanUndefined(postData)
        });
      }
    } catch (err) {
      handleFirestoreError(err, isSaved ? OperationType.DELETE : OperationType.CREATE, `saved_posts/${savedId}`);
    }
  }

  async togglePinPost(id: string) {
    const post = this.posts.find(p => p.id === id);
    if (!post) return;
    const isPinned = !!post.pinned;
    await this.updatePost(id, { pinned: !isPinned });
  }

  async addComment(postId: string, comment: Omit<PostComment, 'id' | 'timestamp' | 'reactions'>) {
    const post = this.posts.find(p => p.id === postId);
    if (!post) return null;

    const newComment: PostComment = {
      ...comment,
      id: "comment_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      timestamp: Date.now(),
      reactions: []
    };

    await this.updatePost(postId, { comments: [...post.comments, newComment] });
    return newComment;
  }

  async deleteComment(postId: string, commentId: string, forceAdmin: boolean = false) {
    if (!forceAdmin && isDeletionBlocked()) {
      console.warn("Comment deletion blocked by system policy.");
      return;
    }
    const post = this.posts.find(p => p.id === postId);
    if (!post || !Array.isArray(post.comments)) return;

    await this.updatePost(postId, { 
      comments: post.comments.filter(c => c && c.id !== commentId) 
    });
  }

  async deleteCommentsBulk(items: { postId: string; commentId: string }[]): Promise<number> {
    if (!items || items.length === 0) return 0;
    let count = 0;
    // Group by postId for efficiency
    const map = new Map<string, Set<string>>();
    items.forEach(it => {
      if (!map.has(it.postId)) map.set(it.postId, new Set());
      map.get(it.postId)!.add(it.commentId);
    });

    for (const [postId, commentIds] of map.entries()) {
      const post = this.posts.find(p => p.id === postId);
      if (post && Array.isArray(post.comments)) {
        const remaining = post.comments.filter(c => !commentIds.has(c.id));
        count += (post.comments.length - remaining.length);
        await this.updatePost(postId, { comments: remaining });
      }
    }
    return count;
  }

  async deleteUserComments(userId?: string, userName?: string, userEmail?: string): Promise<number> {
    const comments = this.getUserComments(userId, userName, userEmail);
    if (comments.length === 0) return 0;
    return await this.deleteCommentsBulk(comments.map(c => ({ postId: c.post.id, commentId: c.comment.id })));
  }

  async cleanMissingOrBrokenMedia(): Promise<{ removedFromPosts: number; deletedOrphaned: number }> {
    let removed = 0;
    let orphaned = 0;

    const updated = this.posts.map(post => {
      let changed = false;
      let newImage = post.image;

      // Check if image is blank, corrupted or dummy 404
      if (!post.image || post.image.trim() === '' || post.image.includes('placeholder_missing') || post.image.includes('undefined') || post.image.includes('null')) {
        newImage = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800';
        changed = true;
        removed++;
      }

      if (changed) {
        return { ...post, image: newImage };
      }
      return post;
    });

    this.posts = updated;
    try {
      localStorage.setItem('imchat_cached_posts', JSON.stringify(this.posts));
    } catch (e) {}
    this.notify();

    return { removedFromPosts: removed, deletedOrphaned: orphaned };
  }

  async autoFixAppErrors(): Promise<{ repairedPosts: number; fixedComments: number; purgedDuplicates: number }> {
    let repaired = 0;
    let fixedC = 0;
    let purgedD = 0;

    const seenIds = new Set<string>();
    const cleanedPosts: Post[] = [];

    for (const p of this.posts) {
      if (!p || !p.id) {
        repaired++;
        continue;
      }
      if (seenIds.has(p.id)) {
        purgedD++;
        continue;
      }
      seenIds.add(p.id);

      let wasModified = false;
      const safePost: Post = {
        ...p,
        user: {
          name: p.user?.name || p.authorEmail?.split('@')[0] || 'Community Member',
          avatar: p.user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          location: p.user?.location || 'Global',
          isVerified: Boolean(p.user?.isVerified)
        },
        image: p.image || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
        caption: p.caption || '',
        timestamp: typeof p.timestamp === 'number' && !isNaN(p.timestamp) ? p.timestamp : Date.now(),
        likes: Array.isArray(p.likes) ? p.likes.filter(Boolean) : [],
        favourites: Array.isArray(p.favourites) ? p.favourites.filter(Boolean) : [],
        comments: Array.isArray(p.comments) ? p.comments.filter(Boolean).map(c => {
          if (!c.id || !c.authorName) {
            fixedC++;
            return {
              id: c.id || `c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              authorId: c.authorId || 'unknown',
              authorName: c.authorName || 'User',
              avatar: c.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
              text: c.text || '',
              timestamp: c.timestamp || Date.now(),
              reactions: Array.isArray(c.reactions) ? c.reactions : []
            };
          }
          return c;
        }) : []
      };

      cleanedPosts.push(safePost);
      if (wasModified) repaired++;
    }

    this.posts = cleanedPosts;
    try {
      localStorage.setItem('imchat_cached_posts', JSON.stringify(cleanedPosts));
    } catch (e) {}
    this.notify();

    return { repairedPosts: repaired, fixedComments: fixedC, purgedDuplicates: purgedD };
  }

  async reactToComment(postId: string, commentId: string, userName: string) {
    const post = this.posts.find(p => p.id === postId);
    if (!post) return;

    const newComments = post.comments.map(c => {
      if (c.id === commentId) {
        const hasReacted = c.reactions.includes(userName);
        return { ...c, reactions: hasReacted ? c.reactions.filter(n => n !== userName) : [...c.reactions, userName] };
      }
      return c;
    });

    await this.updatePost(postId, { comments: newComments });
  }

  async editComment(postId: string, commentId: string, text: string) {
    const post = this.posts.find(p => p.id === postId);
    if (!post) return;

    const newComments = post.comments.map(c => c.id === commentId ? { ...c, text, isEdited: true } : c);
    await this.updatePost(postId, { comments: newComments });
  }
}

export const PostStore = new PostStorageSystem();
