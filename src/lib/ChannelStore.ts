import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  deleteDoc, 
  updateDoc,
  doc, 
  setDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  limit
} from 'firebase/firestore';

export type Comment = {
  id: string;
  authorName: string;
  text: string;
  timestamp: number;
};

export type Post = {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  timestamp: number;
  comments: Comment[];
  likes: number;
  isLive?: boolean;
};

export type Channel = {
  id: string;
  ownerId: string;
  ownerEmail?: string;
  name: string;
  description: string;
  coverUrl: string;
  subscribers: string[];
  posts: Post[];
  isVerified?: boolean;
};

const DEFAULT_CHANNELS: Channel[] = [
  {
    id: "ch_ai_video_veo",
    ownerId: "ai_enthusiast",
    name: "🎬 AI Movie Director (Veo 3)",
    description: "Discussing text-to-video generative prompts, visual arts storyboarding, camera pans, and cinematic rendering filters with Google Veo.",
    coverUrl: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop&q=60",
    subscribers: ["user_2", "user_3", "user_8"],
    isVerified: true,
    posts: [
      {
        id: "post_veo_1",
        authorId: "ai_enthusiast",
        authorName: "Veo Director",
        content: "🎬 Pro Video Tip: When generating video scenes, reinforce your visual cues with prompt descriptors like '35mm anamorphic lens, beautiful cinematic lighting, subtle camera pan left' to achieve stunning realism.",
        timestamp: Date.now() - 3600000 * 48,
        likes: 56,
        comments: []
      }
    ]
  },
  {
    id: "ch_spotify",
    ownerId: "spotify_official",
    ownerEmail: "official@spotify.com",
    name: "🎵 Spotify",
    description: "The official channel for Spotify. Explore curated playlists, new album releases, live music streams, and share your favorite tracks.",
    coverUrl: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjQBDx-Z1RZY7WtOGaiv4jlPXQPKo_fUWQX-qGD0evvv9XuX1RQo8JjpFUTVbYpkZkV4198UO11hy6X_rdAqPre1k9MdFhBVa3ikzapuJtakimH7cCrturNEdOTNUMV1ClO3lcKcYzygapSuTInDKtbQAkoDWytmMja1PUHm16UAOHboE7UG2Vr72CfcXc/s1600/images-17.jpeg",
    subscribers: ["user_1", "user_3", "user_5", "user_7"],
    isVerified: true,
    posts: [
      {
        id: "post_spotify_1",
        authorId: "spotify_official",
        authorName: "Spotify Official",
        content: "🎵 NOW STREAMING: Discover the latest Global Top 50 hits! What track has been on repeat for you this week? Drop your screenshot or track title below! 🎧🥂",
        timestamp: Date.now() - 3600000 * 8,
        likes: 124,
        comments: [
          { id: "comm_sp_1", authorName: "Emily", text: "That new synth-pop single is pure gold, on repeat 24/7!", timestamp: Date.now() - 3600000 * 5 }
        ]
      },
      {
        id: "post_spotify_2",
        authorId: "spotify_official",
        authorName: "Spotify Official",
        content: "✨ ARTIST SPOTLIGHT: Deep dive into electronic ambient lo-fi sessions for work focus. Unwind and find your rhythm.",
        timestamp: Date.now() - 3600000 * 36,
        likes: 85,
        comments: []
      }
    ]
  },
  {
    id: "ch_tnt_sports",
    ownerId: "tnt_sports_official",
    ownerEmail: "official@tntsports.com",
    name: "⚽ TNT Sports",
    description: "The home of live sports action, breaking news, exclusive interviews, and in-depth analysis from TNT Sports.",
    coverUrl: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhD0r6qw1OUyaIwmb1t_gqZV5Fwl7zeZ7fjhR0z4-TCOmSmSSORv2qSAWvG7PD8yPjgBTxCOOs99-bcdxIYBlQGywP4StdicvUDJbCNb1KqaTqRXMB4iUfj2lWEw7dB94QsFTz12ScLCOsmOlkOl95hngruNQY95YP132aOsU0aS7IhFN44GM8v1VYfSUc/s1600/images-26.jpeg",
    subscribers: ["user_1", "user_2", "user_4", "user_8"],
    isVerified: true,
    posts: [
      {
        id: "post_tnt_1",
        authorId: "tnt_sports_official",
        authorName: "TNT Sports",
        content: "🔥 CHAMPIONS LEAGUE HIGHLIGHTS! Catch up on all the goals, red cards, and drama from last night's massive fixtures.",
        timestamp: Date.now() - 3600000 * 3,
        likes: 312,
        comments: [
          { id: "comm_tnt_1", authorName: "Alex", text: "What a strike from outside the box! Absolutely world class.", timestamp: Date.now() - 3600000 * 2 }
        ]
      }
    ]
  },
  {
    id: "ch_gucci",
    ownerId: "gucci_official",
    ownerEmail: "official@gucci.com",
    name: "👜 Gucci",
    description: "Welcome to the official Gucci Channel. Discover the latest collections, campaigns, and exclusive content.",
    coverUrl: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgV4-39LIwmmaqv6bBLryI4bi5yNSLOxmly3tr48mEIAcK_4wqq0faNVGpqe02CchubhH7WhaxDLQqdnJWuuKd04SszF-g97mWhncSjwYOjDos_pspNLTwg0pcYQpiJ5pGcljOlYxSbSSi37uwByqnVsRtvgdI_A5h52VsZLE2qNYqGYhL5fLWe36uqY2Y/s501/images-29.jpeg",
    subscribers: ["user_1", "user_2", "user_3", "user_5"],
    isVerified: true,
    posts: [
      {
        id: "post_gucci_1",
        authorId: "gucci_official",
        authorName: "Gucci",
        content: "Discover the new Gucci Aria collection. A celebration of our heritage and a vision for the future.",
        timestamp: Date.now() - 3600000 * 24,
        likes: 512,
        comments: []
      }
    ]
  },
  {
    id: "ch_youtube",
    ownerId: "youtube_official",
    ownerEmail: "official@youtube.com",
    name: "▶️ YouTube",
    description: "Broadcast Yourself. The official YouTube Channel featuring the latest content, updates, and creator news.",
    coverUrl: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhHVT5DQuohHmELqroJvnSXu-I0xMU3GVeXAsiho0mg1fny6HmSvx8_tJGXlakK3ZVjpdNuM7zAFmf3zT4oVgdGd-NQz1MqbvGy4RJWT4XmVyeWr5fztvdm-MY12R_Wd74wXk_HoC9c0odTqnlrVHwg9jtmaA4woNMEYIR-6bzNj0nMna1KGLm5x6Ff0hw/s588/images-18.jpeg",
    subscribers: ["user_1", "user_2", "user_3", "user_4", "user_5", "user_6", "user_7"],
    isVerified: true,
    posts: [
      {
        id: "post_youtube_1",
        authorId: "youtube_official",
        authorName: "YouTube",
        content: "Check out the latest trending videos and creator updates. Make sure to subscribe to your favorite channels!",
        timestamp: Date.now() - 3600000 * 48,
        likes: 1024,
        comments: []
      }
    ]
  },
  {
    id: "ch_disney",
    ownerId: "disney_official",
    ownerEmail: "official@disney.com",
    name: "🏰 Disney",
    description: "The magic of Disney. Find exclusive content, news, and behind-the-scenes from your favorite movies and shows.",
    coverUrl: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhUpcQgWuHLDizuBaVZJ5zXYS95dyWNAvdjCv_MxKWrJcdwVcKpsfot2m7v8gdAzkaLv9RdOklnclMQwq-EYs-GmmZ2SqTuNc-NzPxxd83IXoVC3qi309rya1CMRvtmGQ0ccJcmDFnYW9YedOHqO8oiM_ZY9OlhyQJiH5WyaAXfDPWEmBJkQD8DTIH5Hlw/s1600/OIP.png.webp",
    subscribers: ["user_1", "user_2"],
    isVerified: true,
    posts: []
  },
  {
    id: "ch_sky_news",
    ownerId: "skynews_official",
    ownerEmail: "official@skynews.com",
    name: "📺 Sky News",
    description: "First for breaking news, video, headlines, analysis and top stories from business, politics, entertainment and more in the UK and worldwide.",
    coverUrl: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh86Be-VeIXTjuhGRMizQqr8naVnozHH8sflpUBQDegJyvjRVMDg0seXvJ1XeCqu5X2qvIF48wter1eDFiWd-WFonKVj46EzybStkmsaALqvWn-Ug9cWeJFy27ri8OB2aIMUwTZqThtw0SWKWGv_ajh1K3_cmDSZowF6aUkTdrN_KXShF4eTKKmdz6zMdA/s588/images-4.png",
    subscribers: ["user_1"],
    isVerified: true,
    posts: []
  }
];

class ChannelStorageSystem {
  private channels: Channel[] = [];
  private listeners: Set<() => void> = new Set();
  private unsubscribe: (() => void) | null = null;

  constructor() {
    this.channels = [...DEFAULT_CHANNELS];
    onAuthStateChanged(auth, (user) => {
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
    this.channels = [...DEFAULT_CHANNELS];
    this.notify();
  }

  private async seedDefaultChannelsToFirestore() {
    try {
      for (const ch of DEFAULT_CHANNELS) {
        await setDoc(doc(db, 'channels', ch.id), {
          ownerId: ch.ownerId,
          ownerEmail: ch.ownerEmail || "",
          name: ch.name,
          description: ch.description,
          coverUrl: ch.coverUrl,
          subscribers: ch.subscribers,
          isVerified: ch.isVerified || false,
          posts: ch.posts,
          createdAt: serverTimestamp()
        });
      }
      console.log("Default channels successfully seeded to Firestore.");
    } catch (err) {
      console.warn("Failed to seed default channels to Firestore. This is usually fine if rules or quotas are restricted, falls back beautifully to static defaults.", err);
    }
  }

  private init() {
    const q = query(collection(db, 'channels'), orderBy('name', 'asc'), limit(30));
    this.unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => {
        const docData = doc.data() as any;
        let item = { id: doc.id, ...docData } as Channel;
        // Strict runtime sync for requested Spotify channel properties
        if (item.id === 'ch_spotify') {
          item.name = "Spotify";
          item.coverUrl = "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjQBDx-Z1RZY7WtOGaiv4jlPXQPKo_fUWQX-qGD0evvv9XuX1RQo8JjpFUTVbYpkZkV4198UO11hy6X_rdAqPre1k9MdFhBVa3ikzapuJtakimH7cCrturNEdOTNUMV1ClO3lcKcYzygapSuTInDKtbQAkoDWytmMja1PUHm16UAOHboE7UG2Vr72CfcXc/s1600/images-17.jpeg";
        }
        return item;
      });

      if (fetched.length === 0) {
        if (!localStorage.getItem('imchat_channels_seeded')) {
          this.channels = DEFAULT_CHANNELS;
          this.seedDefaultChannelsToFirestore();
          localStorage.setItem('imchat_channels_seeded', 'true');
        } else {
          this.channels = [];
        }
      } else {
        localStorage.setItem('imchat_channels_seeded', 'true');
        let merged = [...fetched];
        // Note: We no longer auto-recreate missing channels to allow admins to delete them permanently.
        // We only enforce the Spotify channel info if the Spotify channel still exists.
        const spotifyIndex = merged.findIndex(c => c.id === 'ch_spotify');
        if (spotifyIndex !== -1) {
          const defSpotify = DEFAULT_CHANNELS.find(c => c.id === 'ch_spotify');
          if (defSpotify && (merged[spotifyIndex].name !== 'Spotify' || merged[spotifyIndex].coverUrl !== defSpotify.coverUrl)) {
            merged[spotifyIndex].name = 'Spotify';
            merged[spotifyIndex].coverUrl = defSpotify.coverUrl;
            setDoc(doc(db, 'channels', 'ch_spotify'), {
              ownerId: defSpotify.ownerId,
              ownerEmail: defSpotify.ownerEmail || "",
              name: 'Spotify',
              description: defSpotify.description,
              coverUrl: defSpotify.coverUrl,
              subscribers: defSpotify.subscribers,
              isVerified: defSpotify.isVerified || false,
              posts: defSpotify.posts,
              createdAt: serverTimestamp()
            }).catch(e => console.warn("Failed to overwrite Spotify channel info", e));
          }
        }
        
        // Similarly for other channels if needed, but we don't recreate them if they are missing.
        DEFAULT_CHANNELS.forEach(defCh => {
          if (!merged.some(c => c.id === defCh.id)) {
            if (!localStorage.getItem(`seeded_ch_${defCh.id}`)) {
              merged.push(defCh);
              setDoc(doc(db, 'channels', defCh.id), {
                ownerId: defCh.ownerId,
                ownerEmail: defCh.ownerEmail || "",
                name: defCh.name,
                description: defCh.description,
                coverUrl: defCh.coverUrl,
                subscribers: defCh.subscribers,
                isVerified: defCh.isVerified || false,
                posts: defCh.posts,
                createdAt: serverTimestamp()
              }).catch(e => console.warn(e));
              localStorage.setItem(`seeded_ch_${defCh.id}`, 'true');
            }
          }
        });
        
        const badChannels = ['ch_imchat_announcements', 'ch_design_cafe'];
        fetched.forEach(c => {
          if (badChannels.includes(c.id) || c.name === 'YouTube Create your play list with your favourite songs' || c.name.includes('YouTube Create your play')) {
            deleteDoc(doc(db, 'channels', c.id)).catch(e => console.warn(e));
          }
        });
        merged = merged.filter(c => !badChannels.includes(c.id) && c.name !== 'YouTube Create your play list with your favourite songs' && !c.name.includes('YouTube Create your play'));

        this.channels = merged;
      }
      this.notify();
    }, (error) => {
      console.error("Firestore Channels Error:", error);
      this.channels = DEFAULT_CHANNELS;
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

  getChannels() {
    return this.channels;
  }

  async addChannel(channel: Omit<Channel, 'id' | 'subscribers' | 'posts'>) {
    try {
      const docRef = await addDoc(collection(db, 'channels'), {
        ...channel,
        subscribers: [],
        posts: [],
        createdAt: serverTimestamp()
      });
      return docRef.id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'channels');
      return null;
    }
  }

  async updateChannel(id: string, updates: Partial<Channel>) {
    try {
      await updateDoc(doc(db, 'channels', id), updates);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `channels/${id}`);
    }
  }

  async deleteChannel(id: string) {
    try {
      await deleteDoc(doc(db, 'channels', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `channels/${id}`);
    }
  }

  async toggleSubscribe(channelId: string, userId: string) {
    const channel = this.channels.find(c => c.id === channelId);
    if (!channel) return;

    const isSubscribed = channel.subscribers.includes(userId);
    const channelRef = doc(db, 'channels', channelId);

    try {
      await updateDoc(channelRef, {
        subscribers: isSubscribed ? arrayRemove(userId) : arrayUnion(userId)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `channels/${channelId}`);
    }
  }

  async removeFollower(channelId: string, userId: string) {
    try {
      await updateDoc(doc(db, 'channels', channelId), {
        subscribers: arrayRemove(userId)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `channels/${channelId}/removeFollower`);
    }
  }

  async addPost(channelId: string, post: Omit<Post, 'id' | 'timestamp' | 'comments' | 'likes'>) {
    const channel = this.channels.find(c => c.id === channelId);
    if (!channel) return;

    const newPost: Post = {
      ...post,
      id: "post_" + Date.now(),
      timestamp: Date.now(),
      comments: [],
      likes: 0
    };

    try {
      await updateDoc(doc(db, 'channels', channelId), {
        posts: arrayUnion(newPost)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `channels/${channelId}`);
    }
  }

  async deletePost(channelId: string, postId: string) {
    const channel = this.channels.find(c => c.id === channelId);
    if (!channel) return;

    const postToDelete = channel.posts.find(p => p.id === postId);
    if (!postToDelete) return;

    try {
      await updateDoc(doc(db, 'channels', channelId), {
        posts: arrayRemove(postToDelete)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `channels/${channelId}`);
    }
  }

  async likeChannelPost(channelId: string, postId: string) {
    const channel = this.channels.find(c => c.id === channelId);
    if (!channel) return;

    const postIndex = channel.posts.findIndex(p => p.id === postId);
    if (postIndex === -1) return;

    const updatedPosts = [...channel.posts];
    updatedPosts[postIndex] = {
      ...updatedPosts[postIndex],
      likes: (updatedPosts[postIndex].likes || 0) + 1
    };

    try {
      await updateDoc(doc(db, 'channels', channelId), {
        posts: updatedPosts
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `channels/${channelId}/like`);
    }
  }

  async addComment(channelId: string, postId: string, comment: Omit<Comment, 'id' | 'timestamp'>) {
    const channel = this.channels.find(c => c.id === channelId);
    if (!channel) return;

    const postIndex = channel.posts.findIndex(p => p.id === postId);
    if (postIndex === -1) return;

    const newComment: Comment = {
      ...comment,
      id: "comment_" + Date.now(),
      timestamp: Date.now()
    };

    const updatedPosts = [...channel.posts];
    updatedPosts[postIndex] = {
      ...updatedPosts[postIndex],
      comments: [...updatedPosts[postIndex].comments, newComment]
    };

    try {
      await updateDoc(doc(db, 'channels', channelId), {
        posts: updatedPosts
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `channels/${channelId}`);
    }
  }

  async deleteComment(channelId: string, postId: string, commentId: string) {
    const channel = this.channels.find(c => c.id === channelId);
    if (!channel) return;

    const postIndex = channel.posts.findIndex(p => p.id === postId);
    if (postIndex === -1) return;

    const updatedPosts = [...channel.posts];
    updatedPosts[postIndex] = {
      ...updatedPosts[postIndex],
      comments: updatedPosts[postIndex].comments.filter(c => c.id !== commentId)
    };

    try {
      await updateDoc(doc(db, 'channels', channelId), {
        posts: updatedPosts
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `channels/${channelId}`);
    }
  }
}

export const ChannelStore = new ChannelStorageSystem();
