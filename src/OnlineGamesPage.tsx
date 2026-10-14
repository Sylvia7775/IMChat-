import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, Search, Gamepad2, Trophy, Heart, Play, 
  Volume2, VolumeX, Maximize2, Minimize2, RotateCcw, 
  Star, User, Sparkles, TrendingUp, Gamepad, Check, ChevronRight, Share2, Clock,
  Send, X, MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, addDoc, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';

// Web Audio API Retro Sound Effects Synthesizer
class SoundSynth {
  private ctx: AudioContext | null = null;
  public muted: boolean = false;

  private initCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playLaser() {
    if (this.muted) return;
    this.initCtx();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.15);
    
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  playJump() {
    if (this.muted) return;
    this.initCtx();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.2);
    
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playScore() {
    if (this.muted) return;
    this.initCtx();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, this.ctx.currentTime); // C5
    osc.frequency.setValueAtTime(659.25, this.ctx.currentTime + 0.08); // E5
    
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  playHit() {
    if (this.muted) return;
    this.initCtx();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.25);
    
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  playWin() {
    if (this.muted) return;
    this.initCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    notes.forEach((freq, index) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + index * 0.08);
      
      gain.gain.setValueAtTime(0.1, now + index * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, now + index * 0.08 + 0.2);
      
      osc.start(now + index * 0.08);
      osc.stop(now + index * 0.08 + 0.2);
    });
  }
}

const synth = new SoundSynth();

// Game Definition Interface
interface GameDef {
  id: string;
  title: string;
  description: string;
  category: 'Arcade' | 'Puzzle' | 'Sports' | 'Board';
  icon: string;
  banner: string;
  plays: string;
  rating: number;
}

const GAMES_LIST: GameDef[] = [
  {
    id: 'snake',
    title: 'Neon Snake 2099',
    description: 'Control a cyberpunk cyber-snake. Eat energetic byte-nodes, gain length, and beat the matrix!',
    category: 'Arcade',
    icon: '🐍',
    banner: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=600&auto=format&fit=crop',
    plays: '14.2K',
    rating: 4.8
  },
  {
    id: 'memory',
    title: 'Mind Match Pro',
    description: 'Boost your brain memory. Uncover and pair matching cute icons before time runs out.',
    category: 'Puzzle',
    icon: '🧠',
    banner: 'https://images.unsplash.com/photo-1606167668584-78701c57f13d?q=80&w=600&auto=format&fit=crop',
    plays: '9.8K',
    rating: 4.6
  },
  {
    id: 'invaders',
    title: 'Galactic Defense',
    description: 'Defend your starbase from incoming alien ships in this retro pixel space invader shooter.',
    category: 'Arcade',
    icon: '🚀',
    banner: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=600&auto=format&fit=crop',
    plays: '22.1K',
    rating: 4.9
  },
  {
    id: 'tictactoe',
    title: 'Tic-Tac-Toe AI',
    description: 'Challenge a highly strategic AI opponent in the classic game of naughts and crosses.',
    category: 'Board',
    icon: '❌',
    banner: 'https://images.unsplash.com/photo-1611195974226-a6a9be9dd763?q=80&w=600&auto=format&fit=crop',
    plays: '6.4K',
    rating: 4.4
  },
  {
    id: 'flappy',
    title: 'Flappy Rocket Astro',
    description: 'Keep the astro-rocket flying through cosmic portals. Master the precision of gravitational taps.',
    category: 'Sports',
    icon: '🌠',
    banner: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=600&auto=format&fit=crop',
    plays: '18.7K',
    rating: 4.7
  }
];

interface OnlineGamesPageProps {
  onBack: () => void;
  currentUserId?: string;
  currentUserName?: string;
  currentUserAvatar?: string;
  initialGameId?: string;
}

interface LeaderboardRecord {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  score: number;
  timestamp: any;
}

export default function OnlineGamesPage({ 
  onBack, 
  currentUserId = 'anonymous_user', 
  currentUserName = 'Arcade Gamer', 
  currentUserAvatar = 'https://www.w3schools.com/howto/img_avatar.png',
  initialGameId
}: OnlineGamesPageProps) {
  
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [activeGame, setActiveGame] = useState<GameDef | null>(null);

  // Auto-launch game if initialGameId is passed
  useEffect(() => {
    if (initialGameId) {
      const g = GAMES_LIST.find(game => game.id === initialGameId);
      if (g) {
        setActiveGame(g);
      }
    }
  }, [initialGameId]);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRecord[]>([]);
  const [showLeaderboardTab, setShowLeaderboardTab] = useState<boolean>(false);

  // Lobby Chat States
  const [messages, setMessages] = useState<any[]>([]);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(true);
  const [inputText, setInputText] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Real-time listener for Lobby Chat
  useEffect(() => {
    const q = query(
      collection(db, "game_lobby_chat"),
      orderBy("timestamp", "asc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: any[] = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() });
      });
      msgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      setMessages(msgs);
    }, (error) => {
      console.error("Firestore error in game_lobby_chat:", error);
    });

    return () => unsubscribe();
  }, []);

  // Auto-scroll on new messages or chat open
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen]);

  const sendMessage = async (text: string, sharedGame?: GameDef) => {
    if (!text.trim() && !sharedGame) return;
    try {
      const newMessage = {
        userId: currentUserId,
        userName: currentUserName,
        userAvatar: currentUserAvatar,
        text: text,
        timestamp: Date.now(),
        sharedGameId: sharedGame?.id || null,
        sharedGameTitle: sharedGame?.title || null,
        sharedGameIcon: sharedGame?.icon || null
      };

      await addDoc(collection(db, "game_lobby_chat"), newMessage);
      synth.playLaser();
    } catch (err) {
      console.error("Error sending lobby message:", err);
      handleFirestoreError(err, OperationType.CREATE, "game_lobby_chat");
    }
  };

  const handleShareGameToLobby = async (game: GameDef) => {
    try {
      const newMessage = {
        userId: currentUserId,
        userName: currentUserName,
        userAvatar: currentUserAvatar,
        text: `Hey, let's play ${game.title}! Who's ready? 🎮`,
        timestamp: Date.now(),
        sharedGameId: game.id,
        sharedGameTitle: game.title,
        sharedGameIcon: game.icon
      };

      await addDoc(collection(db, "game_lobby_chat"), newMessage);
      synth.playLaser();
      setIsChatOpen(true);
    } catch (err) {
      console.error("Error sharing game to lobby:", err);
      handleFirestoreError(err, OperationType.CREATE, "game_lobby_chat");
    }
  };

  // Load and toggle Favorites
  useEffect(() => {
    const savedFavs = localStorage.getItem('games_favorites');
    if (savedFavs) {
      try {
        setFavorites(JSON.parse(savedFavs));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const toggleFavorite = (gameId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = favorites.includes(gameId) 
      ? favorites.filter(id => id !== gameId)
      : [...favorites, gameId];
    setFavorites(updated);
    localStorage.setItem('games_favorites', JSON.stringify(updated));
  };

  // Sync Synth volume
  useEffect(() => {
    synth.muted = isMuted;
  }, [isMuted]);

  // Load High Scores from firestore when active game changes
  useEffect(() => {
    if (!activeGame) {
      setLeaderboard([]);
      return;
    }
    const scoresRef = collection(db, 'game_scores');
    const q = query(
      scoresRef,
      where('gameId', '==', activeGame.id),
      orderBy('score', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records: LeaderboardRecord[] = [];
      snapshot.forEach(doc => {
        records.push({ id: doc.id, ...doc.data() } as LeaderboardRecord);
      });
      setLeaderboard(records);
    }, (err) => {
      console.warn("Firestore leaderboard fetch failed, falling back to local simulation:", err);
      // Generate some simulated friends scores
      setLeaderboard([
        { id: '1', userId: 'user1', name: 'Yolanda Store', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150', score: 320, timestamp: new Date() },
        { id: '2', userId: 'user2', name: 'Garry Developer', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150', score: 250, timestamp: new Date() },
        { id: '3', userId: 'user3', name: 'Emma Watson', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=150', score: 180, timestamp: new Date() }
      ]);
    });

    return unsubscribe;
  }, [activeGame]);

  const saveHighScore = async (gameId: string, gameTitle: string, score: number) => {
    try {
      await addDoc(collection(db, 'game_scores'), {
        userId: currentUserId,
        name: currentUserName,
        avatar: currentUserAvatar,
        gameId,
        gameTitle,
        score,
        timestamp: new Date()
      });
    } catch (e) {
      console.error("Failed to save high score to Firestore:", e);
    }
  };

  // Filter games list
  const filteredGames = GAMES_LIST.filter(game => {
    const matchesCategory = selectedCategory === 'All' || game.category === selectedCategory;
    const matchesSearch = game.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          game.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex flex-col h-full bg-gray-50 text-gray-900 overflow-hidden font-sans">
      
      {/* Header */}
      <header className="shrink-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-all active:scale-95 text-gray-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🎮</span>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent tracking-tight">
                IMChat Games
              </h1>
            </div>
            <p className="text-[11px] text-gray-400 font-medium">No download instant play</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`px-3 py-1.5 rounded-xl border transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
              isChatOpen 
                ? 'bg-indigo-50 border-indigo-100 text-indigo-600 shadow-sm' 
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Lobby Chat</span>
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
          </button>

          <button 
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl transition-all cursor-pointer"
            title={isMuted ? 'Unmute game sounds' : 'Mute game sounds'}
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-red-500" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Games List Pane (Left Column) */}
        <div className="flex-1 overflow-y-auto pb-24">
          {/* Banner Hero */}
        <div className="mx-4 mt-4 mb-3 rounded-2xl bg-gradient-to-br from-indigo-900 to-purple-800 text-white overflow-hidden shadow-md relative">
          <div className="absolute inset-0 bg-black/30 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-30 bg-[radial-gradient(circle_at_right,_var(--tw-gradient-stops))] from-teal-400/50 via-indigo-900/0 to-transparent pointer-events-none" />
          
          <div className="p-6 relative z-10 flex flex-col gap-2 max-w-lg">
            <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-bold w-fit border border-white/25">
              <Sparkles className="w-3.5 h-3.5 text-teal-300 fill-teal-300" />
              <span>IMCHAT GAMES</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight leading-tight mt-1">
              No Downloads. <br/>Instant Play!
            </h2>
            <p className="text-xs text-indigo-100 leading-relaxed max-w-sm">
              Challenge top scores in our social leaderboard ecosystem. Gain prestige and share your achievements directly on the Home Feed.
            </p>
          </div>
        </div>

        {/* Categories Horizontal */}
        <div className="px-4 py-2 bg-white border-b border-gray-100 sticky top-0 z-20 flex gap-2 overflow-x-auto scrollbar-none">
          {['All', 'Arcade', 'Puzzle', 'Sports', 'Board'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wide transition-all shrink-0 whitespace-nowrap border ${
                selectedCategory === cat 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/10' 
                  : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search game titles or genres..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-2xl py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Game Cards List */}
        <div className="px-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredGames.map((game) => {
            const isFav = favorites.includes(game.id);
            return (
              <motion.div
                key={game.id}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                onClick={() => {
                  setActiveGame(game);
                  setShowLeaderboardTab(false);
                }}
                className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md cursor-pointer group flex flex-col"
              >
                {/* Banner wrapper */}
                <div className="h-32 w-full relative overflow-hidden bg-gray-900">
                  <img 
                    src={game.banner} 
                    alt={game.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-3 right-3 flex gap-2">
                    <button
                      onClick={(e) => toggleFavorite(game.id, e)}
                      className="p-2 rounded-full backdrop-blur-md bg-black/40 hover:bg-black/60 text-white transition-all active:scale-95"
                    >
                      <Heart className={`w-4 h-4 ${isFav ? 'fill-red-500 text-red-500' : 'text-white'}`} />
                    </button>
                  </div>
                  <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md text-white px-2.5 py-1 rounded-xl text-[10px] font-black tracking-wide">
                    {game.category.toUpperCase()}
                  </div>
                </div>

                {/* Info Area */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl shrink-0">{game.icon}</span>
                      <h3 className="font-extrabold text-gray-900 text-base leading-snug group-hover:text-blue-600 transition-colors">
                        {game.title}
                      </h3>
                    </div>
                    <p className="text-[12px] text-gray-500 leading-normal line-clamp-2 mb-3">
                      {game.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-gray-500">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        <span>{game.rating}</span>
                      </div>
                      <div className="text-[11px] text-gray-400 font-medium">
                        {game.plays} plays
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShareGameToLobby(game);
                        }}
                        className="p-1.5 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 text-gray-500 hover:border-indigo-100 rounded-full border border-transparent transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0"
                        title="Share game link to Lobby Chat"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-bold hover:bg-blue-600 hover:text-white transition-all duration-200"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Play Now</span>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {filteredGames.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <span className="text-4xl mb-3">🕹️</span>
            <p className="text-sm font-semibold">No games match your search</p>
            <p className="text-xs mt-1 text-gray-400">Try changing your filters or searching another keyword</p>
          </div>
        )}
      </div>

      {/* Lobby Chat Sidebar Pane (Right Column) */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div 
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-gray-200 bg-white flex flex-col shrink-0 h-[400px] lg:h-auto overflow-hidden relative"
          >
            {/* Chat Title bar */}
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-lg">💬</span>
                <div>
                  <h3 className="font-extrabold text-xs tracking-tight">Gamer Lobby Chat</h3>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[9px] text-slate-300 font-bold uppercase">
                      {messages.length > 0 ? `${new Set(messages.map(m => m.userId)).size} active players` : 'Real-time chat'}
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsChatOpen(false)}
                className="p-1 hover:bg-slate-800 rounded-full text-slate-400 cursor-pointer transition-all active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat Messages scroll area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 flex flex-col">
              {messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-400 my-auto">
                  <span className="text-3xl mb-2">🕹️</span>
                  <p className="text-xs font-bold text-gray-500">Welcome to the Arcade Lobby!</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Discuss strategies, challenge players, and play together!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.userId === currentUserId;
                  return (
                    <div 
                      key={msg.id} 
                      className={`flex gap-2 max-w-[85%] ${isMe ? 'self-end flex-row-reverse' : 'self-start'}`}
                    >
                      {/* Avatar */}
                      {!isMe && (
                        <img 
                          src={msg.userAvatar || 'https://www.w3schools.com/howto/img_avatar.png'} 
                          alt={msg.userName} 
                          className="w-7 h-7 rounded-full border border-gray-200 object-cover shrink-0 mt-0.5"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      
                      <div className="flex flex-col gap-0.5">
                        {/* Name */}
                        {!isMe && (
                          <span className="text-[10px] font-bold text-gray-500 ml-1">
                            {msg.userName}
                          </span>
                        )}
                        
                        {/* Bubble */}
                        <div className={`p-3 rounded-2xl text-xs leading-relaxed shadow-sm ${
                          isMe 
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none' 
                            : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                        }`}>
                          <p className="break-words">{msg.text}</p>
                          
                          {/* Shared Game card inside chat */}
                          {msg.sharedGameId && (
                            <div className={`mt-2 p-2.5 rounded-xl flex items-center justify-between gap-3 border ${
                              isMe 
                                ? 'bg-white/10 border-white/15 text-white' 
                                : 'bg-indigo-50/50 border-indigo-100 text-indigo-955'
                            }`}>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xl shrink-0">{msg.sharedGameIcon || '🎮'}</span>
                                <div className="min-w-0">
                                  <h4 className="font-extrabold text-[11px] truncate leading-tight">{msg.sharedGameTitle}</h4>
                                  <p className={`text-[9px] ${isMe ? 'text-blue-100' : 'text-gray-500'}`}>Instant play</p>
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  const g = GAMES_LIST.find(game => game.id === msg.sharedGameId);
                                  if (g) {
                                    setActiveGame(g);
                                    setShowLeaderboardTab(false);
                                  }
                                }}
                                className={`px-2.5 py-1 text-[10px] font-black rounded-lg uppercase tracking-wider shrink-0 shadow-sm active:scale-95 transition-all cursor-pointer ${
                                  isMe 
                                    ? 'bg-white text-indigo-600 hover:bg-gray-100' 
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                }`}
                              >
                                Play
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestions scrollable bar */}
            <div className="px-3 py-1.5 bg-white border-t border-gray-100 flex gap-1.5 overflow-x-auto scrollbar-none shrink-0">
              {['🎮 Ready to play!', '👾 Anyone up for Snake?', '🔥 Challenge me!', '👋 Hey gamers!'].map((sug, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    sendMessage(sug);
                  }}
                  className="px-2.5 py-1 bg-gray-50 hover:bg-indigo-50 text-gray-600 hover:text-indigo-600 rounded-lg text-[10px] font-bold border border-gray-100 whitespace-nowrap cursor-pointer transition-colors shrink-0"
                >
                  {sug}
                </button>
              ))}
            </div>

            {/* Chat Input form */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (!inputText.trim()) return;
                sendMessage(inputText);
                setInputText('');
              }}
              className="p-3 bg-white border-t border-gray-200 flex gap-2 shrink-0"
            >
              <input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type a message to the lobby..."
                maxLength={150}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl transition-all active:scale-95 flex items-center justify-center shrink-0 cursor-pointer shadow-md"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

    {/* Embedded Game Cabinet Overlay Modal */}
      <AnimatePresence>
        {activeGame && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 bg-slate-900 z-50 flex flex-col md:flex-row ${isFullscreen ? 'p-0' : 'p-2 sm:p-4'}`}
          >
            {/* Game Screen Area */}
            <div className="flex-1 bg-slate-950 flex flex-col relative rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
              {/* Game Header bar */}
              <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between shrink-0 z-30">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{activeGame.icon}</span>
                  <div>
                    <h3 className="font-extrabold text-white text-sm">{activeGame.title}</h3>
                    <p className="text-[10px] text-slate-400">{activeGame.category}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowLeaderboardTab(!showLeaderboardTab)}
                    className={`p-2 rounded-lg transition-all flex items-center gap-1 text-xs font-bold ${showLeaderboardTab ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    title="Toggle Leaderboard"
                  >
                    <Trophy className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="hidden sm:inline">Leaderboard</span>
                  </button>

                  <button 
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4" />}
                  </button>

                  <button 
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all"
                    title="Fullscreen"
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>

                  <button 
                    onClick={() => {
                      setActiveGame(null);
                      setIsFullscreen(false);
                    }}
                    className="p-2 bg-red-950 hover:bg-red-900 text-red-400 rounded-lg transition-all font-bold ml-2"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Game Engine Stage */}
              <div className="flex-1 relative flex items-center justify-center select-none overflow-hidden bg-gradient-to-b from-slate-950 to-slate-900">
                <GameEngine 
                  gameId={activeGame.id} 
                  gameTitle={activeGame.title} 
                  onSaveScore={(score) => saveHighScore(activeGame.id, activeGame.title, score)}
                  isMuted={isMuted}
                />
              </div>
            </div>

            {/* Sidebar / Leaderboard Column */}
            {(!isFullscreen || showLeaderboardTab) && (
              <div className="w-full md:w-80 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 overflow-hidden text-white md:rounded-r-2xl">
                {/* Header */}
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-400 fill-amber-400" />
                    <h4 className="font-extrabold text-sm tracking-tight">Global Top Scores</h4>
                  </div>
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono uppercase">
                    Live syncing
                  </span>
                </div>

                {/* Score List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {leaderboard.length > 0 ? (
                    leaderboard.map((item, idx) => {
                      const isMe = item.userId === currentUserId;
                      return (
                        <div 
                          key={item.id} 
                          className={`flex items-center justify-between p-2.5 rounded-xl transition-all ${
                            isMe 
                              ? 'bg-blue-600/20 border border-blue-500/30 shadow-md' 
                              : 'bg-slate-800/50 hover:bg-slate-800 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {/* Rank circle */}
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                              idx === 0 ? 'bg-amber-500 text-slate-950' : 
                              idx === 1 ? 'bg-slate-300 text-slate-950' : 
                              idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {idx + 1}
                            </span>
                            <img 
                              src={item.avatar || 'https://www.w3schools.com/howto/img_avatar.png'} 
                              alt={item.name}
                              className="w-8 h-8 rounded-full border border-slate-700 shrink-0 object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0">
                              <p className={`text-xs font-black truncate ${isMe ? 'text-blue-300' : 'text-slate-200'}`}>
                                {item.name}
                              </p>
                              <p className="text-[9px] text-slate-400 font-medium">
                                {item.timestamp?.seconds ? new Date(item.timestamp.seconds * 1000).toLocaleDateString() : 'Just now'}
                              </p>
                            </div>
                          </div>

                          <span className="font-mono text-xs font-black tracking-wide text-teal-400">
                            {item.score} pts
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center h-32 text-slate-500 text-center text-xs">
                      <Gamepad2 className="w-8 h-8 opacity-20 mb-2" />
                      <p>Be the first to secure a high score!</p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-slate-800 bg-slate-950/40 text-center">
                  <p className="text-[10px] text-slate-400">Play, complete & submit score to trigger feed updates</p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

// ==========================================
// INDIVIDUAL CASUAL GAME ENGINES
// ==========================================
interface EngineProps {
  gameId: string;
  gameTitle: string;
  onSaveScore: (score: number) => void;
  isMuted: boolean;
}

function GameEngine({ gameId, gameTitle, onSaveScore, isMuted }: EngineProps) {
  switch (gameId) {
    case 'snake':
      return <SnakeEngine onSaveScore={onSaveScore} isMuted={isMuted} gameTitle={gameTitle} />;
    case 'memory':
      return <MemoryEngine onSaveScore={onSaveScore} isMuted={isMuted} gameTitle={gameTitle} />;
    case 'invaders':
      return <InvadersEngine onSaveScore={onSaveScore} isMuted={isMuted} gameTitle={gameTitle} />;
    case 'tictactoe':
      return <TicTacToeEngine onSaveScore={onSaveScore} isMuted={isMuted} gameTitle={gameTitle} />;
    case 'flappy':
      return <FlappyEngine onSaveScore={onSaveScore} isMuted={isMuted} gameTitle={gameTitle} />;
    default:
      return <div className="text-white text-sm font-bold">Game Engine Offline</div>;
  }
}

// ------------------------------------------
// 1. NEON SNAKE GAME ENGINE
// ------------------------------------------
function SnakeEngine({ onSaveScore, isMuted, gameTitle }: { onSaveScore: (score: number) => void; isMuted: boolean; gameTitle: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  
  // Ref states to bypass closure issues in loop
  const dirRef = useRef<{ x: number, y: number }>({ x: 1, y: 0 });
  const snakeRef = useRef<{x: number, y: number}[]>([{ x: 10, y: 10 }]);
  const foodRef = useRef<{x: number, y: number}>({ x: 5, y: 5 });
  const scoreRef = useRef(0);
  const loopRef = useRef<any>(null);

  const resetGame = () => {
    setScore(0);
    scoreRef.current = 0;
    setGameOver(false);
    dirRef.current = { x: 1, y: 0 };
    snakeRef.current = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    generateFood();
    setHasStarted(true);
  };

  const generateFood = () => {
    const maxX = 20;
    const maxY = 20;
    foodRef.current = {
      x: Math.floor(Math.random() * maxX),
      y: Math.floor(Math.random() * maxY)
    };
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!hasStarted || gameOver) return;
      const cur = dirRef.current;
      switch (e.key) {
        case 'ArrowUp':
          if (cur.y === 0) dirRef.current = { x: 0, y: -1 };
          break;
        case 'ArrowDown':
          if (cur.y === 0) dirRef.current = { x: 0, y: 1 };
          break;
        case 'ArrowLeft':
          if (cur.x === 0) dirRef.current = { x: -1, y: 0 };
          break;
        case 'ArrowRight':
          if (cur.x === 0) dirRef.current = { x: 1, y: 0 };
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasStarted, gameOver]);

  // Main Loop
  useEffect(() => {
    if (!hasStarted || gameOver) return;

    const interval = 130; // Game Speed
    const run = () => {
      const snake = [...snakeRef.current];
      const dir = dirRef.current;
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

      // Matrix wall wraps or collisions
      if (head.x < 0 || head.x >= 20 || head.y < 0 || head.y >= 20) {
        synth.playHit();
        setGameOver(true);
        onSaveScore(scoreRef.current);
        return;
      }

      // Self collision
      for (let segment of snake) {
        if (segment.x === head.x && segment.y === head.y) {
          synth.playHit();
          setGameOver(true);
          onSaveScore(scoreRef.current);
          return;
        }
      }

      // Insert new head
      snake.unshift(head);

      // Check eat food
      if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
        synth.playScore();
        scoreRef.current += 10;
        setScore(scoreRef.current);
        generateFood();
      } else {
        snake.pop();
      }

      snakeRef.current = snake;

      // Draw everything
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, 400, 400);
          
          // Draw Board Grid Background
          ctx.strokeStyle = 'rgba(255,255,255,0.03)';
          for (let i = 0; i < 20; i++) {
            ctx.beginPath();
            ctx.moveTo(i * 20, 0);
            ctx.lineTo(i * 20, 400);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i * 20);
            ctx.lineTo(400, i * 20);
            ctx.stroke();
          }

          // Draw Food
          ctx.fillStyle = '#00FFA3';
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#00FFA3';
          ctx.beginPath();
          ctx.arc(foodRef.current.x * 20 + 10, foodRef.current.y * 20 + 10, 8, 0, Math.PI * 2);
          ctx.fill();

          // Draw Snake
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#3b82f6';
          snakeRef.current.forEach((segment, idx) => {
            ctx.fillStyle = idx === 0 ? '#60a5fa' : '#3b82f6';
            ctx.fillRect(segment.x * 20 + 1, segment.y * 20 + 1, 18, 18);
          });
          ctx.shadowBlur = 0;
        }
      }

      loopRef.current = setTimeout(run, interval);
    };

    loopRef.current = setTimeout(run, interval);
    return () => clearTimeout(loopRef.current);
  }, [hasStarted, gameOver]);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm p-4 text-white">
      <div className="flex justify-between w-full font-mono text-sm tracking-widest bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl">
        <span>SCORE: {score}</span>
        <span className="text-teal-400">HIGH: 180</span>
      </div>

      <div className="relative w-full aspect-square max-w-[340px] bg-slate-950 border-4 border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <canvas ref={canvasRef} width={400} height={400} className="w-full h-full" />

        {!hasStarted && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center">
            <span className="text-5xl mb-4">🐍</span>
            <h4 className="text-xl font-black mb-2 tracking-wide text-blue-400">NEON SNAKE 2099</h4>
            <p className="text-xs text-slate-400 mb-6 max-w-xs">Use keyboard Arrow keys or the controls below to guide your cyber snake.</p>
            <button 
              onClick={resetGame}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 font-bold text-sm tracking-wide rounded-xl active:scale-95 transition-all shadow-lg"
            >
              START ARCADE
            </button>
          </div>
        )}

        {gameOver && (
          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6 text-center z-10">
            <span className="text-4xl mb-2">💥</span>
            <h4 className="text-lg font-black text-red-500 uppercase tracking-widest">MATRIX OVERLOAD</h4>
            <p className="text-xs text-slate-400 mt-1 mb-4">Your score has been submitted to the global feed leaderboard!</p>
            <div className="bg-slate-900 px-6 py-2 rounded-xl border border-slate-800 mb-6">
              <p className="text-slate-400 text-[10px] uppercase font-mono tracking-widest">Final Score</p>
              <p className="text-2xl font-black text-white font-mono">{score}</p>
            </div>
            <button 
              onClick={resetGame}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 font-bold text-xs uppercase tracking-wider rounded-xl active:scale-95 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retry Mission</span>
            </button>
          </div>
        )}
      </div>

      {/* On Screen D-Pad for Mobile users */}
      <div className="flex flex-col items-center gap-1 mt-2">
        <button 
          onClick={() => { if (dirRef.current.y === 0) dirRef.current = { x: 0, y: -1 }; }}
          className="w-12 h-12 bg-slate-800 hover:bg-slate-700 active:scale-90 rounded-xl flex items-center justify-center font-bold text-lg border border-slate-700 transition-all shadow-md"
        >
          ▲
        </button>
        <div className="flex gap-12">
          <button 
            onClick={() => { if (dirRef.current.x === 0) dirRef.current = { x: -1, y: 0 }; }}
            className="w-12 h-12 bg-slate-800 hover:bg-slate-700 active:scale-90 rounded-xl flex items-center justify-center font-bold text-lg border border-slate-700 transition-all shadow-md"
          >
            ◀
          </button>
          <button 
            onClick={() => { if (dirRef.current.x === 0) dirRef.current = { x: 1, y: 0 }; }}
            className="w-12 h-12 bg-slate-800 hover:bg-slate-700 active:scale-90 rounded-xl flex items-center justify-center font-bold text-lg border border-slate-700 transition-all shadow-md"
          >
            ▶
          </button>
        </div>
        <button 
          onClick={() => { if (dirRef.current.y === 0) dirRef.current = { x: 0, y: 1 }; }}
          className="w-12 h-12 bg-slate-800 hover:bg-slate-700 active:scale-90 rounded-xl flex items-center justify-center font-bold text-lg border border-slate-700 transition-all shadow-md"
        >
          ▼
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------
// 2. MEMORY MATCH GAME ENGINE
// ------------------------------------------
const MEMORY_EMOJIS = ['🎮', '🦄', '🚀', '🍩', '🥑', '🦁', '🔮', '🌋'];

function MemoryEngine({ onSaveScore, isMuted, gameTitle }: { onSaveScore: (score: number) => void; isMuted: boolean; gameTitle: string }) {
  interface Card {
    id: number;
    emoji: string;
    isFlipped: boolean;
    isMatched: boolean;
  }

  const [cards, setCards] = useState<Card[]>([]);
  const [moves, setMoves] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [win, setWin] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const initGame = () => {
    // Duplicate and shuffle emojis
    const list = [...MEMORY_EMOJIS, ...MEMORY_EMOJIS]
      .map((emoji, index) => ({ id: index, emoji, isFlipped: false, isMatched: false }))
      .sort(() => Math.random() - 0.5);
    
    setCards(list);
    setMoves(0);
    setSelected([]);
    setWin(false);
    setHasStarted(true);
    synth.playJump();
  };

  const handleCardClick = (id: number) => {
    if (selected.length === 2 || win) return;
    
    const clickedCard = cards.find(c => c.id === id);
    if (!clickedCard || clickedCard.isFlipped || clickedCard.isMatched) return;

    synth.playLaser();

    // Flip card
    const updatedCards = cards.map(c => c.id === id ? { ...c, isFlipped: true } : c);
    setCards(updatedCards);

    const newSelected = [...selected, id];
    setSelected(newSelected);

    if (newSelected.length === 2) {
      setMoves(prev => prev + 1);
      const [firstId, secondId] = newSelected;
      const firstCard = cards.find(c => c.id === firstId);
      const secondCard = cards.find(c => c.id === secondId);

      if (firstCard && secondCard && firstCard.emoji === secondCard.emoji) {
        // MATCH found
        setTimeout(() => {
          synth.playScore();
          const matchedList = updatedCards.map(c => 
            c.id === firstId || c.id === secondId ? { ...c, isMatched: true } : c
          );
          setCards(matchedList);
          setSelected([]);
          
          // Check win
          if (matchedList.every(c => c.isMatched)) {
            synth.playWin();
            setWin(true);
            // Calculate score (fewer moves = better score)
            const finalScore = Math.max(10, 200 - moves * 8);
            onSaveScore(finalScore);
          }
        }, 500);
      } else {
        // NO MATCH, flip back
        setTimeout(() => {
          const resetList = updatedCards.map(c => 
            c.id === firstId || c.id === secondId ? { ...c, isFlipped: false } : c
          );
          setCards(resetList);
          setSelected([]);
        }, 1000);
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm p-4 text-white">
      <div className="flex justify-between w-full font-mono text-sm bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl">
        <span>MOVES: {moves}</span>
        <span className="text-teal-400">MATCHES: {cards.filter(c => c.isMatched).length / 2}/8</span>
      </div>

      <div className="w-full aspect-square max-w-[340px] bg-slate-950 border-4 border-slate-800 rounded-3xl p-4 flex items-center justify-center relative">
        {!hasStarted ? (
          <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center rounded-2xl">
            <span className="text-5xl mb-4">🧠</span>
            <h4 className="text-lg font-black text-white mb-2 uppercase tracking-widest">Mind Match Pro</h4>
            <p className="text-xs text-slate-400 mb-6 max-w-xs">Flip cards, match identical emojis in as few moves as possible.</p>
            <button 
              onClick={initGame}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 font-bold text-sm tracking-wide rounded-xl active:scale-95 transition-all shadow-lg"
            >
              START GAME
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2 w-full h-full">
            {cards.map((card) => {
              const show = card.isFlipped || card.isMatched;
              return (
                <div 
                  key={card.id}
                  onClick={() => handleCardClick(card.id)}
                  className={`relative cursor-pointer aspect-square rounded-xl transition-all duration-300 border flex items-center justify-center active:scale-95 ${
                    show 
                      ? 'bg-blue-600/20 border-blue-500 scale-95 shadow-md shadow-blue-500/10' 
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 shadow-sm'
                  }`}
                >
                  {show ? (
                    <span className="text-2xl animate-fade-in">{card.emoji}</span>
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-slate-600" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {win && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 text-center z-10 rounded-2xl">
            <span className="text-4xl mb-2">⭐</span>
            <h4 className="text-lg font-black text-teal-400 uppercase tracking-widest">BRAIN MASTERED!</h4>
            <p className="text-xs text-slate-400 mt-1 mb-4">You completed the training match!</p>
            <div className="bg-slate-900 px-6 py-2 rounded-xl border border-slate-800 mb-6">
              <p className="text-slate-400 text-[10px] uppercase font-mono tracking-widest">Total Moves</p>
              <p className="text-2xl font-black text-white font-mono">{moves}</p>
            </div>
            <button 
              onClick={initGame}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 font-bold text-xs uppercase tracking-wider rounded-xl active:scale-95 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Play Again</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------
// 3. RETRO SPACE INVADERS ENGINE
// ------------------------------------------
function InvadersEngine({ onSaveScore, isMuted, gameTitle }: { onSaveScore: (score: number) => void; isMuted: boolean; gameTitle: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const loopRef = useRef<any>(null);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  
  // Game states
  const playerXRef = useRef(150);
  const lasersRef = useRef<{ x: number; y: number }[]>([]);
  const invadersRef = useRef<{ x: number; y: number; id: number }[]>([]);
  const scoreRef = useRef(0);
  const invaderDirRef = useRef(1);

  const resetGame = () => {
    setScore(0);
    scoreRef.current = 0;
    setGameOver(false);
    playerXRef.current = 150;
    lasersRef.current = [];
    
    // Create matrix invaders grid
    const invadersList = [];
    let idCounter = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 6; c++) {
        invadersList.push({
          x: 40 + c * 40,
          y: 30 + r * 30,
          id: idCounter++
        });
      }
    }
    invadersRef.current = invadersList;
    setHasStarted(true);
    synth.playJump();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key] = true;
      if (e.key === ' ' || e.key === 'ArrowUp') {
        // Shoot laser
        if (hasStarted && !gameOver && lasersRef.current.length < 3) {
          lasersRef.current.push({ x: playerXRef.current + 12, y: 260 });
          synth.playLaser();
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [hasStarted, gameOver]);

  useEffect(() => {
    if (!hasStarted || gameOver) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gameLoop = () => {
      // 1. Handle keyboard inputs
      if (keysRef.current['ArrowLeft'] || keysRef.current['a']) {
        playerXRef.current = Math.max(0, playerXRef.current - 4);
      }
      if (keysRef.current['ArrowRight'] || keysRef.current['d']) {
        playerXRef.current = Math.min(270, playerXRef.current + 4);
      }

      // 2. Move Lasers
      lasersRef.current = lasersRef.current
        .map(l => ({ ...l, y: l.y - 6 }))
        .filter(l => l.y > 0);

      // 3. Move Invaders
      let changeDir = false;
      invadersRef.current.forEach(inv => {
        inv.x += invaderDirRef.current * 1.5;
        if (inv.x > 275 || inv.x < 5) changeDir = true;
      });

      if (changeDir) {
        invaderDirRef.current *= -1;
        invadersRef.current.forEach(inv => {
          inv.y += 10;
          if (inv.y >= 250) {
            // Invaders reached player base
            setGameOver(true);
            onSaveScore(scoreRef.current);
          }
        });
      }

      // 4. Hit detections
      const remainingInvaders: typeof invadersRef.current = [];
      invadersRef.current.forEach(inv => {
        let hit = false;
        lasersRef.current.forEach((l, lIdx) => {
          if (l.x >= inv.x && l.x <= inv.x + 20 && l.y >= inv.y && l.y <= inv.y + 15) {
            hit = true;
            lasersRef.current.splice(lIdx, 1);
          }
        });

        if (hit) {
          synth.playScore();
          scoreRef.current += 20;
          setScore(scoreRef.current);
        } else {
          remainingInvaders.push(inv);
        }
      });
      invadersRef.current = remainingInvaders;

      // Check win wave
      if (remainingInvaders.length === 0) {
        // Spawn harder wave
        synth.playWin();
        scoreRef.current += 100;
        setScore(scoreRef.current);
        resetGame();
        return;
      }

      // 5. Drawing
      ctx.clearRect(0, 0, 300, 300);

      // Draw Player Ship
      ctx.fillStyle = '#60a5fa';
      ctx.fillRect(playerXRef.current, 270, 25, 12);
      ctx.fillRect(playerXRef.current + 9, 263, 7, 7);

      // Draw Lasers
      ctx.fillStyle = '#f43f5e';
      lasersRef.current.forEach(l => {
        ctx.fillRect(l.x, l.y, 2, 8);
      });

      // Draw Invaders
      ctx.fillStyle = '#34d399';
      invadersRef.current.forEach(inv => {
        ctx.fillRect(inv.x, inv.y, 18, 12);
        // Little eyes
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(inv.x + 3, inv.y + 3, 2, 2);
        ctx.fillRect(inv.x + 13, inv.y + 3, 2, 2);
        ctx.fillStyle = '#34d399';
      });

      loopRef.current = requestAnimationFrame(gameLoop);
    };

    loopRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(loopRef.current);
  }, [hasStarted, gameOver]);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm p-4 text-white">
      <div className="flex justify-between w-full font-mono text-sm bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl">
        <span>SCORE: {score}</span>
        <span className="text-teal-400">HIGH: 450</span>
      </div>

      <div className="w-full aspect-square max-w-[340px] bg-slate-950 border-4 border-slate-800 rounded-3xl overflow-hidden relative flex items-center justify-center">
        <canvas ref={canvasRef} width={300} height={300} className="w-full h-full" />

        {!hasStarted && (
          <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center rounded-2xl z-20">
            <span className="text-5xl mb-4">🚀</span>
            <h4 className="text-lg font-black text-white mb-2 uppercase tracking-widest">Galactic Defense</h4>
            <p className="text-xs text-slate-400 mb-6 max-w-xs">Use keyboard [Arrow keys / A, D] or tap screen sides to steer. Spacebar shoots lasers.</p>
            <button 
              onClick={resetGame}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 font-bold text-sm tracking-wide rounded-xl active:scale-95 transition-all shadow-lg"
            >
              LAUNCH DEFENSE
            </button>
          </div>
        )}

        {gameOver && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 text-center z-20 rounded-2xl">
            <span className="text-4xl mb-2">☄️</span>
            <h4 className="text-lg font-black text-red-500 uppercase tracking-widest">DEFENSE CRITICAL</h4>
            <p className="text-xs text-slate-400 mt-1 mb-4">They overrun the defense shields!</p>
            <div className="bg-slate-900 px-6 py-2 rounded-xl border border-slate-800 mb-6">
              <p className="text-slate-400 text-[10px] uppercase font-mono tracking-widest">Final Score</p>
              <p className="text-2xl font-black text-white font-mono">{score}</p>
            </div>
            <button 
              onClick={resetGame}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 font-bold text-xs uppercase tracking-wider rounded-xl active:scale-95 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restart Flight</span>
            </button>
          </div>
        )}

        {/* Mobile touch steering overlays */}
        {hasStarted && !gameOver && (
          <>
            <div 
              onClick={() => { playerXRef.current = Math.max(0, playerXRef.current - 35); }}
              className="absolute left-0 top-0 bottom-0 w-1/3 active:bg-white/5 cursor-pointer"
            />
            <div 
              onClick={() => {
                if (lasersRef.current.length < 3) {
                  lasersRef.current.push({ x: playerXRef.current + 12, y: 260 });
                  synth.playLaser();
                }
              }}
              className="absolute left-1/3 right-1/3 top-0 bottom-0 active:bg-white/10 cursor-pointer"
            />
            <div 
              onClick={() => { playerXRef.current = Math.min(270, playerXRef.current + 35); }}
              className="absolute right-0 top-0 bottom-0 w-1/3 active:bg-white/5 cursor-pointer"
            />
          </>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------
// 4. TIC-TAC-TOE VS MINI-MAX AI
// ------------------------------------------
function TicTacToeEngine({ onSaveScore, isMuted, gameTitle }: { onSaveScore: (score: number) => void; isMuted: boolean; gameTitle: string }) {
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [winner, setWinner] = useState<string | null>(null); // 'X', 'O', 'Tie'
  const [score, setScore] = useState(0);

  const initGame = () => {
    setBoard(Array(9).fill(null));
    setIsPlayerTurn(true);
    setWinner(null);
    synth.playJump();
  };

  const checkWinner = (b: (string | null)[]) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
      [0, 4, 8], [2, 4, 6]            // diagonals
    ];
    for (let i = 0; i < lines.length; i++) {
      const [a, bIndex, c] = lines[i];
      if (b[a] && b[a] === b[bIndex] && b[a] === b[c]) {
        return b[a];
      }
    }
    if (b.every(val => val !== null)) return 'Tie';
    return null;
  };

  // Minimax Algorithm for unbeatable AI
  const minimax = (tempBoard: (string | null)[], depth: number, isMax: boolean): number => {
    const result = checkWinner(tempBoard);
    if (result === 'O') return 10 - depth;
    if (result === 'X') return depth - 10;
    if (result === 'Tie') return 0;

    if (isMax) {
      let best = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (tempBoard[i] === null) {
          tempBoard[i] = 'O';
          best = Math.max(best, minimax(tempBoard, depth + 1, false));
          tempBoard[i] = null;
        }
      }
      return best;
    } else {
      let best = Infinity;
      for (let i = 0; i < 9; i++) {
        if (tempBoard[i] === null) {
          tempBoard[i] = 'X';
          best = Math.min(best, minimax(tempBoard, depth + 1, true));
          tempBoard[i] = null;
        }
      }
      return best;
    }
  };

  const makeAiMove = (currentBoard: (string | null)[]) => {
    let bestVal = -Infinity;
    let bestMove = -1;

    for (let i = 0; i < 9; i++) {
      if (currentBoard[i] === null) {
        currentBoard[i] = 'O';
        let moveVal = minimax(currentBoard, 0, false);
        currentBoard[i] = null;
        if (moveVal > bestVal) {
          bestVal = moveVal;
          bestMove = i;
        }
      }
    }

    if (bestMove !== -1) {
      const nextBoard = [...currentBoard];
      nextBoard[bestMove] = 'O';
      synth.playLaser();
      setBoard(nextBoard);
      
      const gameRes = checkWinner(nextBoard);
      if (gameRes) {
        setWinner(gameRes);
        if (gameRes === 'O') {
          synth.playHit();
        } else if (gameRes === 'Tie') {
          synth.playScore();
          onSaveScore(50);
        }
      } else {
        setIsPlayerTurn(true);
      }
    }
  };

  const handleCellClick = (idx: number) => {
    if (board[idx] || winner || !isPlayerTurn) return;

    synth.playLaser();
    const nextBoard = [...board];
    nextBoard[idx] = 'X';
    setBoard(nextBoard);

    const gameRes = checkWinner(nextBoard);
    if (gameRes) {
      setWinner(gameRes);
      if (gameRes === 'X') {
        synth.playWin();
        setScore(prev => prev + 100);
        onSaveScore(150);
      } else {
        synth.playScore();
        onSaveScore(50);
      }
    } else {
      setIsPlayerTurn(false);
      setTimeout(() => {
        makeAiMove(nextBoard);
      }, 600);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm p-4 text-white">
      <div className="flex justify-between w-full font-mono text-sm bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl">
        <span>PLAYER (X)</span>
        <span className="text-teal-400">AI (O)</span>
      </div>

      <div className="w-full aspect-square max-w-[340px] bg-slate-950 border-4 border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center relative shadow-2xl">
        <div className="grid grid-cols-3 gap-3 w-full max-w-[260px] aspect-square">
          {board.map((cell, idx) => (
            <button
              key={idx}
              onClick={() => handleCellClick(idx)}
              className={`bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl flex items-center justify-center text-3xl font-black font-mono transition-all active:scale-90 ${
                cell === 'X' ? 'text-blue-500' : 'text-rose-500'
              }`}
            >
              {cell}
            </button>
          ))}
        </div>

        {winner && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 text-center z-10 rounded-2xl">
            <span className="text-4xl mb-2">
              {winner === 'X' ? '🏆' : winner === 'O' ? '🤖' : '🤝'}
            </span>
            <h4 className="text-lg font-black uppercase tracking-widest text-white">
              {winner === 'X' ? 'Victory is Yours!' : winner === 'O' ? 'AI Outsmarted You!' : 'Perfect Draw!'}
            </h4>
            <p className="text-xs text-slate-400 mt-1 mb-4">Your score rating is uploaded instantly.</p>
            <button 
              onClick={initGame}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 font-bold text-xs uppercase tracking-wider rounded-xl active:scale-95 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Rematch Play</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------
// 5. FLAPPY ASTRONAUT ROCKET ENGINE
// ------------------------------------------
function FlappyEngine({ onSaveScore, isMuted, gameTitle }: { onSaveScore: (score: number) => void; isMuted: boolean; gameTitle: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const loopRef = useRef<any>(null);
  const rocketYRef = useRef(150);
  const rocketVelocityRef = useRef(0);
  const obstaclesRef = useRef<{ x: number; top: number; bottom: number; passed: boolean }[]>([]);
  const scoreRef = useRef(0);

  const resetGame = () => {
    setScore(0);
    scoreRef.current = 0;
    setGameOver(false);
    rocketYRef.current = 150;
    rocketVelocityRef.current = 0;
    
    // Initial obstacles
    obstaclesRef.current = [
      { x: 300, top: 80, bottom: 120, passed: false },
      { x: 450, top: 120, bottom: 80, passed: false }
    ];
    setHasStarted(true);
    synth.playJump();
  };

  const handleJump = () => {
    if (!hasStarted || gameOver) return;
    rocketVelocityRef.current = -5.5;
    synth.playLaser();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();
        handleJump();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasStarted, gameOver]);

  useEffect(() => {
    if (!hasStarted || gameOver) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gameLoop = () => {
      // Apply gravity
      rocketVelocityRef.current += 0.25;
      rocketYRef.current += rocketVelocityRef.current;

      // Ground or ceiling crash
      if (rocketYRef.current > 280 || rocketYRef.current < 0) {
        synth.playHit();
        setGameOver(true);
        onSaveScore(scoreRef.current);
        return;
      }

      // Move and check Obstacles
      obstaclesRef.current.forEach(obs => {
        obs.x -= 2.2;

        // Check crash
        const rocketX = 50;
        const rocketSize = 16;
        if (obs.x < rocketX + rocketSize && obs.x + 30 > rocketX) {
          if (rocketYRef.current < obs.top || rocketYRef.current + rocketSize > 300 - obs.bottom) {
            synth.playHit();
            setGameOver(true);
            onSaveScore(scoreRef.current);
          }
        }

        // Score tick
        if (!obs.passed && obs.x < 50) {
          synth.playScore();
          obs.passed = true;
          scoreRef.current += 10;
          setScore(scoreRef.current);
        }
      });

      // Filter off-screen obstacles and spawn new ones
      let obstacles = obstaclesRef.current.filter(obs => obs.x > -50);
      if (obstacles.length < 2) {
        const lastX = obstacles[obstacles.length - 1]?.x || 300;
        const top = Math.floor(Math.random() * 110) + 40;
        const bottom = Math.floor(Math.random() * 110) + 40;
        obstacles.push({
          x: lastX + 160,
          top,
          bottom,
          passed: false
        });
      }
      obstaclesRef.current = obstacles;

      // Draw Everything
      ctx.clearRect(0, 0, 300, 300);

      // Draw obstacles (Cosmic portals)
      ctx.fillStyle = '#a855f7';
      obstaclesRef.current.forEach(obs => {
        // Top obstacle
        ctx.fillRect(obs.x, 0, 30, obs.top);
        // Bottom obstacle
        ctx.fillRect(obs.x, 300 - obs.bottom, 30, obs.bottom);
      });

      // Draw Rocket ship
      ctx.fillStyle = '#60a5fa';
      ctx.beginPath();
      ctx.arc(60, rocketYRef.current + 8, 8, 0, Math.PI * 2);
      ctx.fill();
      // Little jet flare
      ctx.fillStyle = '#f97316';
      ctx.fillRect(44, rocketYRef.current + 6, 8, 4);

      loopRef.current = requestAnimationFrame(gameLoop);
    };

    loopRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(loopRef.current);
  }, [hasStarted, gameOver]);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm p-4 text-white">
      <div className="flex justify-between w-full font-mono text-sm bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl">
        <span>ALTITUDE: {score}m</span>
        <span className="text-teal-400">HIGH: 240m</span>
      </div>

      <div 
        onClick={handleJump}
        className="w-full aspect-square max-w-[340px] bg-slate-950 border-4 border-slate-800 rounded-3xl overflow-hidden relative cursor-pointer flex items-center justify-center select-none shadow-2xl"
      >
        <canvas ref={canvasRef} width={300} height={300} className="w-full h-full" />

        {!hasStarted && (
          <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center rounded-2xl z-20">
            <span className="text-5xl mb-4">🌠</span>
            <h4 className="text-lg font-black text-white mb-2 uppercase tracking-widest">Flappy Astro Rocket</h4>
            <p className="text-xs text-slate-400 mb-6 max-w-xs">Spacebar, ArrowUp, or Tap to fire cosmic jet engines & stay afloat.</p>
            <button 
              onClick={(e) => { e.stopPropagation(); resetGame(); }}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 font-bold text-sm tracking-wide rounded-xl active:scale-95 transition-all shadow-lg"
            >
              LAUNCH ROCKET
            </button>
          </div>
        )}

        {gameOver && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 text-center z-20 rounded-2xl">
            <span className="text-4xl mb-2">💥</span>
            <h4 className="text-lg font-black text-red-500 uppercase tracking-widest">CRASH LANDING</h4>
            <p className="text-xs text-slate-400 mt-1 mb-4">You hit a cosmic space pillar!</p>
            <div className="bg-slate-900 px-6 py-2 rounded-xl border border-slate-800 mb-6">
              <p className="text-slate-400 text-[10px] uppercase font-mono tracking-widest">Score Record</p>
              <p className="text-2xl font-black text-white font-mono">{score} pts</p>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); resetGame(); }}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 font-bold text-xs uppercase tracking-wider rounded-xl active:scale-95 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Relaunch Engine</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
