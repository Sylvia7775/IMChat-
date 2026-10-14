// Persistent Favourite Contacts Manager for IMChat
type Listener = () => void;

class FavouriteContactsManager {
  private favouriteIds: Set<string> = new Set();
  private listeners: Set<Listener> = new Set();
  private STORAGE_KEY = 'imchat_favourite_contacts';

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.favouriteIds = new Set(parsed);
          return;
        }
      }
    } catch (e) {
      console.warn("Failed to read favourite contacts from localStorage:", e);
    }

    // Default seed favourites for first-time user experience
    this.favouriteIds = new Set(['Lena_Vega', 'yolanda_admin', 'marcus_c']);
    this.saveToStorage();
  }

  private saveToStorage() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(Array.from(this.favouriteIds)));
    } catch (e) {
      console.warn("Failed to write favourite contacts to localStorage:", e);
    }
  }

  public getFavourites(): string[] {
    return Array.from(this.favouriteIds);
  }

  public isFavourite(userId: string): boolean {
    if (!userId) return false;
    return this.favouriteIds.has(userId);
  }

  public toggleFavourite(userId: string): boolean {
    if (!userId) return false;
    if (this.favouriteIds.has(userId)) {
      this.favouriteIds.delete(userId);
    } else {
      this.favouriteIds.add(userId);
    }
    this.saveToStorage();
    this.notify();
    return this.favouriteIds.has(userId);
  }

  public addFavourite(userId: string): void {
    if (!userId) return;
    this.favouriteIds.add(userId);
    this.saveToStorage();
    this.notify();
  }

  public removeFavourite(userId: string): void {
    if (!userId) return;
    this.favouriteIds.delete(userId);
    this.saveToStorage();
    this.notify();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }
}

export const FavouriteContactsStore = new FavouriteContactsManager();
