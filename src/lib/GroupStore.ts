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

export type GroupRole = 'owner' | 'moderator' | 'member';

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

export type GroupMember = {
  userId: string;
  name: string;
  role: GroupRole;
  avatar: string;
  isBanned?: boolean;
};

export type PollOption = {
  id: string;
  text: string;
  votes: string[]; // User IDs who voted
};

export type GroupPost = {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  topic?: string;
  mediaUrl?: string;
  timestamp: number;
  taggedUsers?: string[];
  isPoll?: boolean;
  pollOptions?: PollOption[];
};

export type Group = {
  id: string;
  uid: string;
  title: string;
  description: string;
  coverUrl: string;
  isPrivate: boolean;
  members: GroupMember[];
  posts: GroupPost[];
};

const DEFAULT_GROUPS: Group[] = [
  {
    id: "g_cyberpunk_neon",
    uid: "im_g_cyberpunk",
    title: "⚡ Cyberpunk & Sci-Fi Aesthetic",
    description: "Futuristic street virtualizations, synthwave mixes, neon designs, and cybernetic UI components. The grid is alive.",
    coverUrl: "https://images.unsplash.com/photo-1515621061946-eff1c2a352bd?w=800&auto=format&fit=crop&q=60",
    isPrivate: false,
    members: [
      { userId: "user_4", name: "Neo", role: "owner", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150" },
      { userId: "user_5", name: "Trinity", role: "moderator", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150" }
    ],
    posts: [
      {
        id: "post_grp_3",
        authorId: "user_4",
        authorName: "Neo",
        content: "Lost in the neon rain. Running some neural models in container systems. Port 3000 is open.",
        timestamp: Date.now() - 3600000 * 10,
        topic: "Photography"
      }
    ]
  },
  {
    id: "g_travel_gourmet",
    uid: "im_g_travel",
    title: "🍕 Travel & Gourmet Foodies",
    description: "Unearthing secret street food stalls, local coffee shops, and gourmet slice capitals around the world. No reviews, just raw flavor.",
    coverUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=60",
    isPrivate: false,
    members: [
      { userId: "user_6", name: "Mario", role: "owner", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150" }
    ],
    posts: [
      {
        id: "post_grp_4",
        authorId: "user_6",
        authorName: "Mario",
        content: "If you are ever in Kyoto, visit the tucked away street food stalls near the Gion district. Best authentic ramen of your life!",
        timestamp: Date.now() - 3600000 * 30,
        topic: "Recommendations"
      }
    ]
  },
  {
    id: "g_fwb_friends",
    uid: "im_g_fwb",
    title: "FWB",
    description: "friends with benefits",
    coverUrl: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiJAPI6DQlPBuWjGXyTBCClj4eMEyYJ63emQ9ky7SwiX18tHWA2_hssOdeNfwj80bCjc4eXs2FQ_zpTo_kC-yEi9vVk0UGmpWBO_yLKdOigzKzFv1zjJoU4YqDyOKL51iEwNRkoGj39b_eE-Yv7DiDnhr4_WHTojsUMT-Writt-nT2xxPyTFDsOmADH_4U/s1600/images%2847%29~2.jpg",
    isPrivate: false,
    members: [
      { userId: "user_7", name: "Alice", role: "owner", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150" }
    ],
    posts: []
  },
  {
    id: "g_the_crawfords",
    uid: "im_g_crawfords",
    title: "The Crawfords",
    description: "The Crawfords group",
    coverUrl: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhCBAKaU7ZsxHRg8PnyBI5n0vEnIGrODmJAh2v0CrEX_OG78WVoFljSAHvHm1MSuyJQT0AqKrE6DUU3dnC9KDbcH7A2W7Jm3sUrX9ySSmrBS5h-vmBIEY2HXlW6XSX0a4oy_ZkP4g5btVcybiYAjSOE-C8v2mQ-T8pskvFEOSgiYuf-NW-zkekJJhsvgaw/s1600/images%2846%29~3.jpg",
    isPrivate: false,
    members: [
      { userId: "user_8", name: "Crawford", role: "owner", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150" }
    ],
    posts: []
  },
  {
    id: "g_one_nation",
    uid: "im_g_onenation",
    title: "One Nation",
    description: "One Nation group",
    coverUrl: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEj7fccBEDAqKO5o-ryx71VvT2rUKVxaEHKVNfukUzOio4sNf7CQzC4UGuzbbODuXHNcCMGGl0k0-3w2hZno9sOmSTTtI7mCzfUclQp_5UCtwVjnsdmrVF5uIcoHgh-ZptkRIzE1Y6HKdnUzEqtbMyJ-31-xWRoi173eieT2IumYudE7j2YAD46LmYbC-0M/s1600/images%2842%29~2.jpg",
    isPrivate: false,
    members: [
      { userId: "user_9", name: "Citizen", role: "owner", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150" }
    ],
    posts: []
  },
  {
    id: "g_smith_family",
    uid: "im_g_smith",
    title: "The Smith Family",
    description: "The Smith Family group",
    coverUrl: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhcnAsbctUW4QQZyMasPgKY6T_bUubcbD-7Hxn0DLDb7yZj_IqWuxW6weTD9CIxDjPj4XHwS80848AOQXxzBHGtabfdT5OeIkuWrhqRbPi8DuiuaXMdJfghByaU2xUE4zNGQDZ9Vyr2LI6ueMU_lYy4vuXowJtDVyYnbWgjfTH-MQycobbKGDQ-RVqx8D4/s1600/images%2843%29~2.jpg",
    isPrivate: false,
    members: [
      { userId: "user_10", name: "Smith", role: "owner", avatar: "https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?w=150" }
    ],
    posts: []
  },
  {
    id: "g_albany_twister",
    uid: "im_g_albanytwister",
    title: "Albany twister",
    description: "Albany twister group",
    coverUrl: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiRN5unCpnVtEFbAmB0V4QsPRmWEX243ZW9HaVwzC_H0q1vWLLT4YxnKOM-yC0TIsNXmNwZalhy8rFIwKabzMek4MDo_-8n10uUU0yVpPuZ9W-lxXDWZuF8pd25WeqaLmh63uwkI7p3rbYwVnwLbiZHpyXk81X_EmL9sme-FbNbEFUpzzizl69RH6-5N8k/s1600/03-31-03.39.13.jpg",
    isPrivate: false,
    members: [
      { userId: "user_11", name: "Albany", role: "owner", avatar: "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=150" }
    ],
    posts: []
  },
  {
    id: "g_phoenix_hub",
    uid: "im_g_phoenix",
    title: " Phoenix hub ",
    description: "Phoenix hub group",
    coverUrl: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEg7TQqxOgeqf7z2cHqNP6RU8RQGy1uZ_7jhQsFXWpwBC6fitRXifbTr8SKcQp6XnhUWDqnlvZiEVER3JicupTLgXW4T-m8Uun7zUeVS917U0KS0vneEvqBAvC6DLVlqKKHH_PCizsu4ZVLIvnUEcIZOFEXJABbBF1QRpZ3ZBmVqcLxWJdjoJQzLarw0lhM/s1600/hfxjtx~2.jpg",
    isPrivate: false,
    members: [
      { userId: "user_12", name: "Phoenix", role: "owner", avatar: "https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?w=150" }
    ],
    posts: []
  },
  {
    id: "g_la_force",
    uid: "im_g_la_force",
    title: " L.A Force",
    description: "L.A Force group",
    coverUrl: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh2ucXaQJaXxCMxftSxrbxCgd6tUWgF8CHxKC_3XausL6smI2G7-1_d1s1m1w7Q1EtmiH3SJQfuRfKgqs_q7mfAqKIc9f36MaSGjkhm0Y0j42iYQuecWoojD2VMANJMNIuMY4WAdGhmLLeN3saCLSWW04AG36zuqetOUnKmKx0ycyzyZWUWlnym76JqpHE/s1600/163238.jpg",
    isPrivate: false,
    members: [
      { userId: "user_13", name: "L.A Force Admin", role: "owner", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150" }
    ],
    posts: []
  },
  {
    id: "g_brooklyn_vibe",
    uid: "im_g_brooklyn",
    title: "Brooklyn Vibe",
    description: "Welcome to Brooklyn Vibe. Connect, share and explore the lifestyle.",
    coverUrl: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiOJgfgAy4Bg3t4zNpfo9_HVF1TN73kfszrxhsTY79VIDQSxn_d622-Ja0BZAjYnJgHRuTODl2C0-HoWRIoNXMhS0yXjSOE3mg9exfGILZzrUfHNHL63PiadpPUuSpfiFFQsC2bP7FCtz0j2UlfUrm5HqChLx4HIoN_2uR91nsl9pJ-vro320Y6KA-TgwM/s1600/images%2848%29~2.jpg",
    isPrivate: false,
    members: [
      { userId: "admin", name: "Admin", role: "owner", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150" }
    ],
    posts: []
  }
];

class GroupStorageSystem {
  private groups: Group[] = [];
  private localGroups: Group[] = [];
  private listeners: Set<() => void> = new Set();
  private unsubscribe: (() => void) | null = null;

  constructor() {
    try {
      const stored = localStorage.getItem('imchat_local_groups');
      this.localGroups = stored ? JSON.parse(stored) : [];
      this.groups = [...DEFAULT_GROUPS, ...this.localGroups];
    } catch (e) {
      this.localGroups = [];
      this.groups = [...DEFAULT_GROUPS];
    }

    // Force default groups as public
    DEFAULT_GROUPS.forEach(g => {
      g.isPrivate = false;
    });

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
    this.groups = [...DEFAULT_GROUPS, ...this.localGroups];
    this.notify();
  }

  private async seedDefaultGroupsToFirestore() {
    try {
      for (const gp of DEFAULT_GROUPS) {
        await setDoc(doc(db, 'groups', gp.id), {
          uid: gp.uid,
          title: gp.title,
          description: gp.description,
          coverUrl: gp.coverUrl,
          isPrivate: false,
          members: gp.members,
          posts: gp.posts,
          createdAt: serverTimestamp()
        });
      }
      console.log("Default groups successfully seeded to Firestore.");
    } catch (err) {
      console.warn("Failed to seed default groups to Firestore. Falls back elegantly to memory arrays.", err);
    }
  }

  private init() {
    // Avoid query-level ordering or hard limit of 30 to make sure we load all groups robustly from Firestore without index limits or issues with missing fields
    const q = query(collection(db, 'groups'));
    this.unsubscribe = onSnapshot(q, (snapshot) => {
      const firestoreGroups = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          isPrivate: false // Always force isPrivate as false for public access
        };
      }) as Group[];

      // Sort in-memory elegantly
      firestoreGroups.sort((a, b) => (a.title || '').localeCompare(b.title || ''));

      let merged = [...firestoreGroups];
      
      if (firestoreGroups.length === 0) {
        merged = [...DEFAULT_GROUPS];
        this.seedDefaultGroupsToFirestore();
      } else {
        // Ensure default groups are also visible
        DEFAULT_GROUPS.forEach(defGp => {
          if (!merged.some(g => g.id === defGp.id || g.uid === defGp.uid)) {
            merged.push(defGp);
          }
        });
      }

      // Merge with localGroups, preferring local copy if newer/offline, and ensuring no duplicates
      this.localGroups.forEach(lg => {
        if (!merged.some(mg => mg.id === lg.id || mg.uid === lg.uid)) {
          merged.push(lg);
        }
      });
      // Force all groups in memory to be public as well
      merged.forEach(g => {
        g.isPrivate = false;
      });

      // Explicitly seed the new groups directly if missing in Firestore db
      DEFAULT_GROUPS.forEach(defGp => {
        if (!firestoreGroups.some(g => g.id === defGp.id)) {
          if (!localStorage.getItem(`seeded_gp_${defGp.id}`)) {
            setDoc(doc(db, 'groups', defGp.id), {
              uid: defGp.uid,
              title: defGp.title,
              description: defGp.description,
              coverUrl: defGp.coverUrl,
              isPrivate: false,
              members: defGp.members,
              posts: defGp.posts,
              createdAt: serverTimestamp()
            }).catch(e => console.warn(e));
            localStorage.setItem(`seeded_gp_${defGp.id}`, 'true');
          }
        }
      });

      this.groups = merged;
      this.notify();
    }, (error) => {
      console.warn("Firestore Groups onSnapshot error, falling back to local memory:", error);
      const merged = [...DEFAULT_GROUPS];
      this.localGroups.forEach(lg => {
        if (!merged.some(mg => mg.id === lg.id || mg.uid === lg.uid)) {
          merged.push(lg);
        }
      });
      merged.forEach(g => {
        g.isPrivate = false;
      });
      this.groups = merged;
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

  getGroups() {
    return this.groups;
  }

  async addGroup(group: Omit<Group, 'id' | 'posts'>) {
    const tempId = "lg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5);
    const newGroup: Group = {
      ...group,
      id: tempId,
      posts: []
    };

    // Store in localGroups instantly for off-line & quota robustness
    this.localGroups.unshift(newGroup);
    try {
      localStorage.setItem('imchat_local_groups', JSON.stringify(this.localGroups));
    } catch (e) {}

    if (!this.groups.some(g => g.id === tempId)) {
      this.groups.unshift(newGroup);
      this.notify();
    }

    try {
      const payload = cleanUndefined({
        ...group,
        posts: [],
        createdAt: serverTimestamp()
      });
      const docRef = await addDoc(collection(db, 'groups'), payload);
      
      if (docRef && docRef.id) {
        // Replace tempId with the official Firestore ID
        this.localGroups = this.localGroups.map(g => g.id === tempId ? { ...g, id: docRef.id } : g);
        try {
          localStorage.setItem('imchat_local_groups', JSON.stringify(this.localGroups));
        } catch (e) {}
        this.groups = this.groups.map(g => g.id === tempId ? { ...g, id: docRef.id } : g);
        this.notify();
        return docRef.id;
      }
      return tempId;
    } catch (err) {
      console.warn("Firestore addGroup failed, saved correctly in local storage to keep app running.", err);
      handleFirestoreError(err, OperationType.CREATE, 'groups');
      return tempId;
    }
  }

  async updateGroup(id: string, updates: Partial<Group>) {
    // 1. Update in local memory
    this.localGroups = this.localGroups.map(g => g.id === id ? { ...g, ...updates } : g);
    this.groups = this.groups.map(g => g.id === id ? { ...g, ...updates } : g);
    try {
      localStorage.setItem('imchat_local_groups', JSON.stringify(this.localGroups));
    } catch (e) {}
    this.notify();

    // 2. Try Firestore update
    try {
      const cleaned = cleanUndefined(updates);
      await updateDoc(doc(db, 'groups', id), cleaned);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `groups/${id}`);
    }
  }

  async deleteGroup(id: string) {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) {
      throw new Error("You must be logged in to delete a group.");
    }

    // Update local cache
    this.localGroups = this.localGroups.filter(g => g.id !== id);
    this.groups = this.groups.filter(g => g.id !== id);
    try {
      localStorage.setItem('imchat_local_groups', JSON.stringify(this.localGroups));
    } catch (e) {}
    this.notify();

    try {
      await deleteDoc(doc(db, 'groups', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `groups/${id}`);
    }
  }

  async votePoll(groupId: string, postId: string, optionId: string, userId: string) {
    // Update locally
    this.groups = this.groups.map(g => {
      if (g.id === groupId) {
        const newPosts = g.posts.map(p => {
          if (p.id === postId && p.isPoll && p.pollOptions) {
            const newOptions = p.pollOptions.map(opt => {
              // Remove vote from other options if user is changing vote
              const votes = opt.votes.filter(id => id !== userId);
              if (opt.id === optionId) {
                votes.push(userId);
              }
              return { ...opt, votes };
            });
            return { ...p, pollOptions: newOptions };
          }
          return p;
        });
        return { ...g, posts: newPosts };
      }
      return g;
    });

    this.localGroups = this.localGroups.map(lg => {
      if (lg.id === groupId) {
        const newPosts = lg.posts.map(p => {
           if (p.id === postId && p.isPoll && p.pollOptions) {
            const newOptions = p.pollOptions.map(opt => {
              const votes = opt.votes.filter(id => id !== userId);
              if (opt.id === optionId) {
                votes.push(userId);
              }
              return { ...opt, votes };
            });
            return { ...p, pollOptions: newOptions };
          }
          return p;
        });
        return { ...lg, posts: newPosts };
      }
      return lg;
    });

    try {
      localStorage.setItem('imchat_local_groups', JSON.stringify(this.localGroups));
    } catch (e) {}
    this.notify();

    // Now update in Firestore. We need the fully updated posts array.
    const updatedGroup = this.groups.find(g => g.id === groupId);
    if (updatedGroup) {
      try {
        await updateDoc(doc(db, 'groups', groupId), {
          posts: cleanUndefined(updatedGroup.posts)
        });
      } catch (err) {
        console.warn("Firestore votePoll failed:", err);
        handleFirestoreError(err, OperationType.UPDATE, `groups/${groupId}`);
      }
    }
  }

  async addPost(groupId: string, post: Omit<GroupPost, 'id' | 'timestamp'>) {
    const rawPost: GroupPost = {
      ...post,
      id: "p_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
      timestamp: Date.now()
    };
    const newPost: GroupPost = cleanUndefined(rawPost);

    // Update locally and notify
    this.groups = this.groups.map(g => {
      if (g.id === groupId) {
        return { ...g, posts: [...(g.posts || []), newPost] };
      }
      return g;
    });

    this.localGroups = this.localGroups.map(lg => {
      if (lg.id === groupId) {
        return { ...lg, posts: [...(lg.posts || []), newPost] };
      }
      return lg;
    });

    try {
      localStorage.setItem('imchat_local_groups', JSON.stringify(this.localGroups));
    } catch (e) {}
    this.notify();

    try {
      await updateDoc(doc(db, 'groups', groupId), {
        posts: arrayUnion(newPost)
      });
    } catch (err) {
      console.warn("Firestore addPost to group failed, saved locally:", err);
      handleFirestoreError(err, OperationType.UPDATE, `groups/${groupId}`);
    }
  }

  async joinGroup(groupId: string, member: GroupMember) {
    this.groups = this.groups.map(g => {
      if (g.id === groupId && !g.members.some(m => m.userId === member.userId)) {
        return { ...g, members: [...g.members, member] };
      }
      return g;
    });

    this.localGroups = this.localGroups.map(lg => {
      if (lg.id === groupId && !lg.members.some(m => m.userId === member.userId)) {
        return { ...lg, members: [...lg.members, member] };
      }
      return lg;
    });

    try {
      localStorage.setItem('imchat_local_groups', JSON.stringify(this.localGroups));
    } catch (e) {}
    this.notify();

    try {
      await updateDoc(doc(db, 'groups', groupId), {
        members: arrayUnion(member)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `groups/${groupId}`);
    }
  }

  async leaveGroup(groupId: string, userId: string) {
    const groupBefore = this.groups.find(g => g.id === groupId) || this.localGroups.find(g => g.id === groupId);
    const memberToRemove = groupBefore?.members.find(m => m.userId === userId);

    this.groups = this.groups.map(g => {
      if (g.id === groupId) {
        return { ...g, members: g.members.filter(m => m.userId !== userId) };
      }
      return g;
    });

    this.localGroups = this.localGroups.map(lg => {
      if (lg.id === groupId) {
        return { ...lg, members: lg.members.filter(m => m.userId !== userId) };
      }
      return lg;
    });

    try {
      localStorage.setItem('imchat_local_groups', JSON.stringify(this.localGroups));
    } catch (e) {}
    this.notify();

    if (memberToRemove) {
      try {
        await updateDoc(doc(db, 'groups', groupId), {
          members: arrayRemove(memberToRemove)
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `groups/${groupId}`);
      }
    }
  }
}

export const GroupStore = new GroupStorageSystem();
