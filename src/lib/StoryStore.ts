import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc,
  deleteDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';

export interface StoryReaction {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  reaction: string;
  createdAt: number;
}

export interface StorySlide {
  id: string;
  mediaUrl?: string;
  mediaType: 'image' | 'video' | 'text';
  caption?: string;
  textOverlay?: string;
  backgroundGradient?: string;
  textColor?: string;
  fontStyle?: 'modern' | 'classic' | 'neon' | 'bold' | 'handwriting';
  sticker?: string;
  location?: string;
  musicTrack?: {
    title: string;
    artist: string;
    audioUrl?: string;
  };
  linkUrl?: string;
  createdAt: number;
  duration?: number; // seconds, default 5
}

export interface Story {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    username: string;
    avatar: string;
    isVerified?: boolean;
    role?: string;
  };
  slides: StorySlide[];
  createdAt: number;
  expiresAt: number;
  views: string[]; // user IDs who have seen the story
  likes: string[]; // user IDs who liked the story
  reactions?: StoryReaction[];
  isLive?: boolean;
}

const STORAGE_KEY = 'imchat_stories_cache_v2';
const VIEWED_STORIES_KEY = 'imchat_viewed_stories_v2';

export const SEED_STORIES: Story[] = [
  {
    id: 'story_elon',
    userId: 'user_elon',
    user: {
      id: 'user_elon',
      name: 'Elon Musk',
      username: 'elonmusk',
      avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
      isVerified: true,
      role: 'vip'
    },
    createdAt: Date.now() - 1000 * 60 * 45, // 45 mins ago
    expiresAt: Date.now() + 1000 * 60 * 60 * 23,
    views: ['user_janet', 'user_amber'],
    likes: ['user_sam', 'user_chris'],
    slides: [
      {
        id: 'slide_elon_1',
        mediaType: 'image',
        mediaUrl: 'https://images.unsplash.com/photo-1517976487507-5b6533d8a98c?w=1080&auto=format&fit=crop&q=80',
        caption: 'Starship flight test preparation on the launch pad! 🚀 Mars, here we come.',
        location: 'Starbase, Boca Chica 📍',
        musicTrack: {
          title: 'Interstellar Main Theme',
          artist: 'Hans Zimmer'
        },
        createdAt: Date.now() - 1000 * 60 * 45,
        duration: 5
      },
      {
        id: 'slide_elon_2',
        mediaType: 'text',
        backgroundGradient: 'from-purple-900 via-indigo-950 to-black',
        textOverlay: 'The future will be vastly more exciting and interesting than the past. ✨',
        fontStyle: 'bold',
        textColor: '#60a5fa',
        sticker: '⚡',
        createdAt: Date.now() - 1000 * 60 * 30,
        duration: 5
      }
    ]
  },
  {
    id: 'story_taylor',
    userId: 'user_taylor',
    user: {
      id: 'user_taylor',
      name: 'Taylor Swift',
      username: 'taylorswift',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      isVerified: true,
      role: 'vip'
    },
    createdAt: Date.now() - 1000 * 60 * 120, // 2 hours ago
    expiresAt: Date.now() + 1000 * 60 * 60 * 22,
    views: ['user_chris', 'user_bella'],
    likes: ['user_janet', 'user_sam', 'user_amber'],
    slides: [
      {
        id: 'slide_taylor_1',
        mediaType: 'image',
        mediaUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1080&auto=format&fit=crop&q=80',
        caption: 'Wembley Stadium! 92,000 of you singing every single lyric. Thank you London! 🇬🇧✨',
        location: 'Wembley Stadium, London 🏟️',
        musicTrack: {
          title: 'Cruel Summer',
          artist: 'Taylor Swift'
        },
        createdAt: Date.now() - 1000 * 60 * 120,
        duration: 5
      },
      {
        id: 'slide_taylor_2',
        mediaType: 'image',
        mediaUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1080&auto=format&fit=crop&q=80',
        caption: 'Backstage vibes right before showtime 💖',
        sticker: '✨',
        createdAt: Date.now() - 1000 * 60 * 90,
        duration: 5
      }
    ]
  },
  {
    id: 'story_cristiano',
    userId: 'user_cristiano',
    user: {
      id: 'user_cristiano',
      name: 'Cristiano Ronaldo',
      username: 'cristiano',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      isVerified: true,
      role: 'vip'
    },
    createdAt: Date.now() - 1000 * 60 * 180, // 3 hours ago
    expiresAt: Date.now() + 1000 * 60 * 60 * 21,
    views: ['user_sam'],
    likes: ['user_sam', 'user_elon'],
    slides: [
      {
        id: 'slide_cr7_1',
        mediaType: 'image',
        mediaUrl: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=1080&auto=format&fit=crop&q=80',
        caption: 'Morning training done! Focus, dedication and hard work always pays off. SIUUU! ⚽🔥',
        location: 'Riyadh, Saudi Arabia 📍',
        musicTrack: {
          title: 'Champion',
          artist: 'Workout Beats'
        },
        createdAt: Date.now() - 1000 * 60 * 180,
        duration: 5
      }
    ]
  },
  {
    id: 'story_jessica',
    userId: 'user_jessica',
    user: {
      id: 'user_jessica',
      name: 'Jessica Chen',
      username: 'jessicachen',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
      isVerified: true
    },
    createdAt: Date.now() - 1000 * 60 * 240, // 4 hours ago
    expiresAt: Date.now() + 1000 * 60 * 60 * 20,
    views: [],
    likes: ['user_bella'],
    slides: [
      {
        id: 'slide_jessica_1',
        mediaType: 'image',
        mediaUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=1080&auto=format&fit=crop&q=80',
        caption: 'Morning matcha in Kyoto 🍵 Spring bloom is magical!',
        location: 'Kyoto, Japan 🌸',
        musicTrack: {
          title: 'Japanese Garden',
          artist: 'Lofi Chill'
        },
        createdAt: Date.now() - 1000 * 60 * 240,
        duration: 5
      }
    ]
  },
  {
    id: 'story_amber',
    userId: 'user_amber',
    user: {
      id: 'user_amber',
      name: 'Amber',
      username: 'amber_creatives',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150',
      isVerified: true
    },
    createdAt: Date.now() - 1000 * 60 * 300,
    expiresAt: Date.now() + 1000 * 60 * 60 * 19,
    views: [],
    likes: [],
    slides: [
      {
        id: 'slide_amber_1',
        mediaType: 'text',
        backgroundGradient: 'from-rose-500 via-pink-600 to-amber-500',
        textOverlay: 'Good morning everyone! Have a blessed and productive Sunday ✨🌸',
        fontStyle: 'handwriting',
        textColor: '#ffffff',
        sticker: '☕',
        createdAt: Date.now() - 1000 * 60 * 300,
        duration: 5
      }
    ]
  },
  {
    id: 'story_sam',
    userId: 'user_sam',
    user: {
      id: 'user_sam',
      name: 'Sam',
      username: 'sam_tech',
      avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=150',
      isVerified: true
    },
    createdAt: Date.now() - 1000 * 60 * 360,
    expiresAt: Date.now() + 1000 * 60 * 60 * 18,
    views: [],
    likes: [],
    slides: [
      {
        id: 'slide_sam_1',
        mediaType: 'image',
        mediaUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1080&auto=format&fit=crop&q=80',
        caption: 'Benchmarking the latest neural accelerator chips today 💻⚡',
        location: 'Silicon Valley, CA 📍',
        createdAt: Date.now() - 1000 * 60 * 360,
        duration: 5
      }
    ]
  }
];

export class StoryStore {
  private static subscribers: Array<(stories: Story[]) => void> = [];
  private static cachedStories: Story[] = [];
  private static isInitialized = false;

  /**
   * Initialize and start listening to Firestore stories in real time
   */
  static init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 1. Load cached stories or seed data
    try {
      const local = localStorage.getItem(STORAGE_KEY);
      if (local) {
        const parsed = JSON.parse(local) as Story[];
        const now = Date.now();
        // filter out expired stories (>24h)
        const valid = parsed.filter(s => s.expiresAt > now);
        this.cachedStories = valid.length > 0 ? valid : [...SEED_STORIES];
      } else {
        this.cachedStories = [...SEED_STORIES];
        this.saveToCache();
      }
    } catch {
      this.cachedStories = [...SEED_STORIES];
    }

    // 2. Listen to Firestore stories collection
    try {
      const storiesRef = collection(db, 'stories');
      onSnapshot(storiesRef, (snapshot) => {
        if (!snapshot.empty) {
          const firestoreStories: Story[] = [];
          const now = Date.now();
          snapshot.forEach(docSnap => {
            const data = docSnap.data() as Story;
            if (data && data.expiresAt > now) {
              firestoreStories.push({
                ...data,
                id: docSnap.id
              });
            }
          });

          // Merge with seed stories (excluding any deleted seed items)
          const mergedMap = new Map<string, Story>();
          SEED_STORIES.forEach(s => mergedMap.set(s.id, s));
          firestoreStories.forEach(s => mergedMap.set(s.id, s));
          
          this.cachedStories = Array.from(mergedMap.values()).sort((a, b) => b.createdAt - a.createdAt);
          this.saveToCache();
          this.notifySubscribers();
        }
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'stories');
      });
    } catch (e) {
      console.warn("Firestore stories listener unavailable:", e);
    }
  }

  private static saveToCache() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cachedStories));
    } catch (e) {
      console.error("Failed to save stories to cache", e);
    }
  }

  private static notifySubscribers() {
    this.subscribers.forEach(cb => cb([...this.cachedStories]));
  }

  static subscribe(callback: (stories: Story[]) => void): () => void {
    if (!this.isInitialized) {
      this.init();
    }
    this.subscribers.push(callback);
    callback([...this.cachedStories]);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  static getStories(): Story[] {
    if (!this.isInitialized) {
      this.init();
    }
    const now = Date.now();
    return this.cachedStories.filter(s => s.expiresAt > now);
  }

  static getUserStory(userId: string): Story | undefined {
    return this.getStories().find(s => s.userId === userId);
  }

  /**
   * Add a new slide to an existing user's story or create a new story
   */
  static async addStorySlide(
    user: { id: string; name: string; username: string; avatar: string; isVerified?: boolean; role?: string },
    slideData: Omit<StorySlide, 'id' | 'createdAt'>
  ): Promise<Story> {
    if (!this.isInitialized) this.init();

    const now = Date.now();
    const expiresAt = now + 1000 * 60 * 60 * 24; // 24 hours
    const existingIndex = this.cachedStories.findIndex(s => s.userId === user.id);

    const newSlide: StorySlide = {
      ...slideData,
      id: 'slide_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      createdAt: now,
      duration: slideData.duration || 5
    };

    let targetStory: Story;

    if (existingIndex >= 0) {
      // Append to existing story
      const existing = this.cachedStories[existingIndex];
      targetStory = {
        ...existing,
        user: { ...existing.user, ...user },
        slides: [...existing.slides, newSlide],
        createdAt: now,
        expiresAt: expiresAt
      };
      this.cachedStories[existingIndex] = targetStory;
    } else {
      // Create new story
      targetStory = {
        id: 'story_' + user.id + '_' + Date.now(),
        userId: user.id,
        user: user,
        slides: [newSlide],
        createdAt: now,
        expiresAt: expiresAt,
        views: [],
        likes: []
      };
      this.cachedStories.unshift(targetStory);
    }

    this.saveToCache();
    this.notifySubscribers();

    // Persist to Firestore
    try {
      await setDoc(doc(db, 'stories', targetStory.id), targetStory, { merge: true });
    } catch (err) {
      console.warn("Could not sync story to Firestore:", err);
    }

    return targetStory;
  }

  /**
   * Delete an entire story
   */
  static async deleteStory(storyId: string): Promise<void> {
    this.cachedStories = this.cachedStories.filter(s => s.id !== storyId);
    this.saveToCache();
    this.notifySubscribers();

    try {
      await deleteDoc(doc(db, 'stories', storyId));
    } catch (err) {
      console.warn("Could not delete story from Firestore:", err);
    }
  }

  /**
   * Delete a specific slide from a story
   */
  static async deleteSlide(storyId: string, slideId: string): Promise<void> {
    const storyIdx = this.cachedStories.findIndex(s => s.id === storyId);
    if (storyIdx === -1) return;

    const story = this.cachedStories[storyIdx];
    const updatedSlides = story.slides.filter(sl => sl.id !== slideId);

    if (updatedSlides.length === 0) {
      await this.deleteStory(storyId);
      return;
    }

    const updatedStory: Story = {
      ...story,
      slides: updatedSlides
    };

    this.cachedStories[storyIdx] = updatedStory;
    this.saveToCache();
    this.notifySubscribers();

    try {
      await setDoc(doc(db, 'stories', storyId), updatedStory, { merge: true });
    } catch (err) {
      console.warn("Could not update story in Firestore:", err);
    }
  }

  /**
   * Mark a story as viewed by user
   */
  static async markStoryViewed(storyId: string, viewerUserId: string): Promise<void> {
    if (!storyId || !viewerUserId) return;

    // 1. Mark in local storage viewed cache
    try {
      const raw = localStorage.getItem(VIEWED_STORIES_KEY);
      const set = new Set<string>(raw ? JSON.parse(raw) : []);
      set.add(storyId);
      localStorage.setItem(VIEWED_STORIES_KEY, JSON.stringify(Array.from(set)));
    } catch (e) {
      console.warn("Failed saving viewed story in localStorage:", e);
    }

    // 2. Update cached story views array
    const story = this.cachedStories.find(s => s.id === storyId);
    if (story && !story.views.includes(viewerUserId)) {
      story.views.push(viewerUserId);
      this.saveToCache();
      this.notifySubscribers();

      // Async Firestore update
      try {
        await setDoc(doc(db, 'stories', storyId), {
          views: story.views
        }, { merge: true });
      } catch (err) {
        console.warn("Could not sync story view to Firestore:", err);
      }
    }
  }

  /**
   * Check if a story has been viewed by the viewer
   */
  static isStoryViewed(storyId: string, viewerUserId?: string): boolean {
    if (!storyId) return false;
    try {
      const raw = localStorage.getItem(VIEWED_STORIES_KEY);
      if (raw) {
        const viewedSet = new Set<string>(JSON.parse(raw));
        if (viewedSet.has(storyId)) return true;
      }
    } catch {}

    if (viewerUserId) {
      const story = this.cachedStories.find(s => s.id === storyId);
      if (story && story.views.includes(viewerUserId)) return true;
    }

    return false;
  }

  /**
   * Like / unlike a story
   */
  static async toggleLikeStory(storyId: string, userId: string): Promise<boolean> {
    const story = this.cachedStories.find(s => s.id === storyId);
    if (!story) return false;

    const hasLiked = story.likes.includes(userId);
    let updatedLikes: string[];

    if (hasLiked) {
      updatedLikes = story.likes.filter(id => id !== userId);
    } else {
      updatedLikes = [...story.likes, userId];
    }

    story.likes = updatedLikes;
    this.saveToCache();
    this.notifySubscribers();

    try {
      await setDoc(doc(db, 'stories', storyId), {
        likes: updatedLikes
      }, { merge: true });
    } catch (err) {
      console.warn("Could not sync like to Firestore:", err);
    }

    return !hasLiked;
  }

  /**
   * Send a quick reaction (heart or emoji) to the author of the story
   */
  static async sendReaction(
    storyId: string,
    sender: { id: string; name: string; avatar?: string },
    reaction: string = '❤️',
    slideCaption?: string
  ): Promise<{ liked: boolean; likesCount: number }> {
    const story = this.cachedStories.find(s => s.id === storyId);
    if (!story) return { liked: false, likesCount: 0 };

    if (!story.likes) story.likes = [];
    if (!story.reactions) story.reactions = [];

    // Automatically like if reaction is a heart
    if (reaction === '❤️' && !story.likes.includes(sender.id)) {
      story.likes.push(sender.id);
    }

    const newReaction: StoryReaction = {
      id: Math.random().toString(36).substring(2, 9),
      userId: sender.id,
      userName: sender.name || 'Anonymous',
      userAvatar: sender.avatar,
      reaction,
      createdAt: Date.now()
    };
    story.reactions.push(newReaction);

    this.saveToCache();
    this.notifySubscribers();

    // Persist to Firestore story doc
    try {
      await setDoc(doc(db, 'stories', storyId), {
        likes: story.likes,
        reactions: story.reactions.slice(-60)
      }, { merge: true });
    } catch (err) {
      console.warn("Could not sync story reaction to Firestore:", err);
    }

    // Send real-time notification to the story author in Firestore
    if (story.userId && story.userId !== sender.id) {
      try {
        await addDoc(collection(db, 'notifications'), {
          userId: story.userId,
          type: 'story_reaction',
          storyId: story.id,
          senderId: sender.id,
          senderName: sender.name || 'Someone',
          senderAvatar: sender.avatar || '',
          reaction,
          text: `${sender.name || 'Someone'} reacted ${reaction} to your story${slideCaption ? `: "${slideCaption.slice(0, 30)}..."` : '!'}`,
          read: false,
          createdAt: serverTimestamp()
        });
      } catch (notifErr) {
        console.warn("Could not create reaction notification in Firestore:", notifErr);
      }
    }

    return { liked: story.likes.includes(sender.id), likesCount: story.likes.length };
  }
}
