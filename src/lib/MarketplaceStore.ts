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
  setDoc,
  getDocs
} from 'firebase/firestore';

export interface MarketplaceSeller {
  id: string;
  name: string;
  avatar?: string;
  rating: number;
  reviewsCount: number;
}

export interface MarketplaceItem {
  id: string;
  title: string;
  description: string;
  type: string; // Category
  price: number;
  icon?: string;
  media: Array<{ type: 'image' | 'video'; url: string }>;
  isUserAdded?: boolean;
  isPending?: boolean;
  seller: MarketplaceSeller;
  timestamp?: number;
  createdAt?: string;
  userId?: string;
}

export const INITIAL_MARKETPLACE_PRODUCTS: MarketplaceItem[] = [
  {
    id: 'prod_macbook_m2',
    title: 'Apple MacBook Pro 16" M2 Max (32GB / 1TB)',
    description: 'Flawless condition MacBook Pro. Includes original MagSafe charger, box, and AppleCare+ active. Battery health 98%. Fast nationwide courier shipping.',
    type: 'Electronics',
    price: 1850,
    icon: '💻',
    media: [
      { type: 'image', url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80' },
      { type: 'image', url: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=800&auto=format&fit=crop&q=80' }
    ],
    seller: {
      id: 'user_baron',
      name: 'Baron',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150',
      rating: 4.9,
      reviewsCount: 38
    },
    timestamp: Date.now() - 3600000 * 24 * 2
  },
  {
    id: 'prod_sony_camera',
    title: 'Sony Alpha A7 IV Full-Frame Mirrorless Camera',
    description: '33MP Full-frame sensor, 4K 60p 10-bit recording, pristine optics. Comes with 28-70mm lens, 2 batteries, dual charger and protective leather case.',
    type: 'Electronics',
    price: 1450,
    icon: '📷',
    media: [
      { type: 'image', url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&auto=format&fit=crop&q=80' }
    ],
    seller: {
      id: 'user_chris',
      name: 'Chris',
      avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=150',
      rating: 5.0,
      reviewsCount: 19
    },
    timestamp: Date.now() - 3600000 * 24 * 3
  },
  {
    id: 'prod_leather_jacket',
    title: 'Vintage Handcrafted Distressed Leather Biker Jacket',
    description: '100% genuine full-grain Italian leather, heavy-duty brass YKK zippers, tailored modern fit (Size L). Barely worn, excellent condition.',
    type: 'Fashion',
    price: 240,
    icon: '🧥',
    media: [
      { type: 'image', url: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&auto=format&fit=crop&q=80' }
    ],
    seller: {
      id: 'user_janet',
      name: 'Janet',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=150',
      rating: 4.8,
      reviewsCount: 24
    },
    timestamp: Date.now() - 3600000 * 24 * 4
  },
  {
    id: 'prod_luxury_villa',
    title: 'Modern Sunset Villa with Infinity Pool & Ocean View',
    description: 'Exclusive 4-bedroom contemporary coastal residence. Smart home automation, solar power, panoramic floor-to-ceiling glass, private landscaped garden.',
    type: 'Realty',
    price: 450000,
    icon: '🏡',
    media: [
      { type: 'image', url: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&auto=format&fit=crop&q=80' },
      { type: 'image', url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80' }
    ],
    seller: {
      id: 'user_baron',
      name: 'Baron',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150',
      rating: 5.0,
      reviewsCount: 52
    },
    timestamp: Date.now() - 3600000 * 24 * 5
  },
  {
    id: 'prod_custom_keyboard',
    title: 'Custom CNC Aluminum Mechanical Keyboard (Gateron Oil Kings)',
    description: 'Custom gasket-mount mechanical keyboard, lubricated switches, polycarb plate, dye-sub PBT keycaps, per-key RGB, coiled USB-C cable included.',
    type: 'Software',
    price: 180,
    icon: '⌨️',
    media: [
      { type: 'image', url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80' }
    ],
    seller: {
      id: 'user_sam',
      name: 'Sam',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=150',
      rating: 4.9,
      reviewsCount: 14
    },
    timestamp: Date.now() - 3600000 * 24 * 6
  },
  {
    id: 'prod_web_design_kit',
    title: 'Full-Stack SaaS UI/UX Figma Design System & React Boilerplate',
    description: 'Over 400+ production-ready responsive components, Tailwind v4 styling, dark/light theme, auth screens, payment dashboards, and source code.',
    type: 'Digital Assets',
    price: 95,
    icon: '🎨',
    media: [
      { type: 'image', url: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80' }
    ],
    seller: {
      id: 'user_dwayne',
      name: 'Dwayne',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=150',
      rating: 5.0,
      reviewsCount: 67
    },
    timestamp: Date.now() - 3600000 * 24 * 7
  }
];

class MarketplaceStorageSystem {
  private products: MarketplaceItem[] = [];
  private listeners: Set<() => void> = new Set();
  private unsubscribe: (() => void) | null = null;
  private isScanning: boolean = false;

  constructor() {
    // 1. Load initial cache
    try {
      const cached = localStorage.getItem('imchat_marketplace_cache');
      if (cached) {
        this.products = JSON.parse(cached);
      } else {
        this.products = INITIAL_MARKETPLACE_PRODUCTS;
      }
    } catch (e) {
      this.products = INITIAL_MARKETPLACE_PRODUCTS;
    }

    // 2. Initialize Firestore listener
    this.init();
  }

  private init() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }

    const colRef = collection(db, 'marketplace_products');
    this.unsubscribe = onSnapshot(colRef, (snapshot) => {
      if (!snapshot.empty) {
        const firestoreItems: MarketplaceItem[] = snapshot.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            timestamp: data.timestamp || Date.now()
          } as MarketplaceItem;
        });

        // Merge with initial seed products so community items remain available
        const seedMap = new Map<string, MarketplaceItem>();
        INITIAL_MARKETPLACE_PRODUCTS.forEach(item => seedMap.set(item.id, item));
        firestoreItems.forEach(item => seedMap.set(item.id, item));

        const merged = Array.from(seedMap.values());
        merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        this.products = merged;

        try {
          localStorage.setItem('imchat_marketplace_cache', JSON.stringify(this.products));
        } catch (e) {
          console.warn("Could not cache marketplace products", e);
        }
      } else {
        // If Firestore collection is empty, ensure starter products are accessible
        if (this.products.length === 0) {
          this.products = INITIAL_MARKETPLACE_PRODUCTS;
        }
      }
      this.notify();
    }, (error) => {
      console.warn("Marketplace Firestore onSnapshot error:", error);
      if (this.products.length === 0) {
        this.products = INITIAL_MARKETPLACE_PRODUCTS;
        this.notify();
      }
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

  getProducts(): MarketplaceItem[] {
    if (this.products.length === 0) {
      return INITIAL_MARKETPLACE_PRODUCTS;
    }
    return this.products;
  }

  getUserProducts(userId?: string, userName?: string): MarketplaceItem[] {
    const all = this.getProducts();
    const cleanId = (userId || '').trim().toLowerCase();
    const cleanName = (userName || '').trim().toLowerCase();

    return all.filter(p => {
      if (cleanId && (p.seller?.id?.toLowerCase() === cleanId || p.userId?.toLowerCase() === cleanId)) return true;
      if (cleanName && p.seller?.name?.toLowerCase() === cleanName && cleanName !== 'user') return true;
      return false;
    });
  }

  async addProduct(product: Omit<MarketplaceItem, 'id' | 'timestamp'>): Promise<string> {
    try {
      const currentAuthUser = auth.currentUser;
      const currentUid = product.seller?.id || currentAuthUser?.uid || 'anonymous';
      
      const payload = {
        ...product,
        userId: currentUid,
        timestamp: Date.now(),
        createdAt: new Date().toISOString(),
        isUserAdded: true,
        seller: {
          ...product.seller,
          id: currentUid
        }
      };

      // Optimistic update
      const tempId = `prod_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const optimisticItem: MarketplaceItem = {
        id: tempId,
        ...payload
      };
      this.products = [optimisticItem, ...this.products];
      this.notify();

      // Write to Firestore
      const docRef = await addDoc(collection(db, 'marketplace_products'), payload);
      
      // Update with real Firestore ID
      this.products = this.products.map(p => p.id === tempId ? { ...p, id: docRef.id } : p);
      this.notify();

      return docRef.id;
    } catch (err) {
      console.error("Failed to add marketplace product to Firestore:", err);
      // Fallback local persistence
      const fallbackId = `local_prod_${Date.now()}`;
      const localItem: MarketplaceItem = {
        id: fallbackId,
        ...product,
        timestamp: Date.now()
      };
      this.products = [localItem, ...this.products];
      this.notify();
      return fallbackId;
    }
  }

  async updateProduct(id: string, updates: Partial<MarketplaceItem>) {
    try {
      // Update in memory
      this.products = this.products.map(p => p.id === id ? { ...p, ...updates } : p);
      this.notify();

      // Update Firestore if not a seed product
      if (!id.startsWith('prod_macbook') && !id.startsWith('prod_sony') && !id.startsWith('prod_leather') && !id.startsWith('prod_luxury') && !id.startsWith('prod_custom') && !id.startsWith('prod_web')) {
        await updateDoc(doc(db, 'marketplace_products', id), updates);
      }
    } catch (err) {
      console.error("Failed to update marketplace product:", err);
    }
  }

  async deleteProduct(id: string) {
    try {
      // Remove from memory
      this.products = this.products.filter(p => p.id !== id);
      this.notify();

      // Delete from Firestore
      await deleteDoc(doc(db, 'marketplace_products', id));
    } catch (err) {
      console.error("Failed to delete marketplace product:", err);
    }
  }

  async performDeepScan(): Promise<{ totalCount: number; scannedFromFirestore: number }> {
    this.isScanning = true;
    this.notify();

    try {
      const colRef = collection(db, 'marketplace_products');
      const snap = await getDocs(colRef);
      
      const firestoreItems: MarketplaceItem[] = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        timestamp: d.data().timestamp || Date.now()
      } as MarketplaceItem));

      const seedMap = new Map<string, MarketplaceItem>();
      INITIAL_MARKETPLACE_PRODUCTS.forEach(item => seedMap.set(item.id, item));
      firestoreItems.forEach(item => seedMap.set(item.id, item));

      const merged = Array.from(seedMap.values());
      merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      this.products = merged;

      try {
        localStorage.setItem('imchat_marketplace_cache', JSON.stringify(this.products));
      } catch (e) {
        console.warn(e);
      }

      this.isScanning = false;
      this.notify();

      return {
        totalCount: merged.length,
        scannedFromFirestore: firestoreItems.length
      };
    } catch (err) {
      console.error("Deep scan failed:", err);
      this.isScanning = false;
      this.notify();
      return {
        totalCount: this.products.length,
        scannedFromFirestore: 0
      };
    }
  }
}

export const MarketplaceStore = new MarketplaceStorageSystem();
