import { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Sparkles, 
  Flame, 
  TrendingUp, 
  Music, 
  User, 
  Search, 
  X, 
  Eye, 
  Heart, 
  MessageCircle, 
  Share2, 
  Plus, 
  BadgeCheck, 
  PlaySquare, 
  Volume2, 
  VolumeX, 
  Zap, 
  Maximize2,
  Tv,
  List,
  SlidersHorizontal,
  ChevronRight,
  Sparkle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Reel as ReelType, formatViews } from '../lib/ReelStore';
import UserAvatar from './UserAvatar';
import { VideoCache } from '../lib/VideoCache';

interface FacebookReelsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  reels: ReelType[];
  activeReelId: string | null;
  onSelectReel: (reelId: string) => void;
  onOpenUpload: () => void;
  autoPlayNext: boolean;
  onToggleAutoPlayNext: () => void;
}

// Single Reel Card with Animated Video Preview on Hover/Focus
function FacebookReelCard({
  reel,
  isActive,
  onSelect,
  isHighlight
}: {
  reel: ReelType;
  isActive: boolean;
  onSelect: () => void;
  isHighlight?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimeoutRef = useRef<any>(null);

  const getYouTubeId = (url: string) => {
    if (!url) return null;
    const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const ytId = getYouTubeId(reel.videoUrl);

  const handleMouseEnter = () => {
    hoverTimeoutRef.current = setTimeout(async () => {
      setIsHovered(true);
      if (!ytId && !videoBlobUrl && reel.videoUrl) {
        try {
          const blob = await VideoCache.getVideoBlob(reel.videoUrl);
          setVideoBlobUrl(URL.createObjectURL(blob));
        } catch {
          setVideoBlobUrl(reel.videoUrl);
        }
      }
    }, 120);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setIsHovered(false);
    setVideoProgress(0);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  useEffect(() => {
    if (isHovered && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [isHovered, videoBlobUrl]);

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onSelect}
      className={`group relative rounded-2xl overflow-hidden cursor-pointer bg-[#1e2025] border-2 transition-all duration-300 shadow-lg select-none flex flex-col justify-between aspect-[9/15] min-w-[160px] md:min-w-[190px] ${
        isActive 
          ? 'border-[#1877F2] ring-4 ring-[#1877F2]/30 shadow-[#1877F2]/20 shadow-2xl' 
          : 'border-white/10 hover:border-[#1877F2]/70 hover:shadow-xl'
      }`}
    >
      {/* Background Poster / Animated Video Preview */}
      <div className="absolute inset-0 w-full h-full overflow-hidden bg-zinc-950">
        {/* Animated Video when hovered */}
        {isHovered && !ytId && (videoBlobUrl || reel.videoUrl) ? (
          <video
            ref={videoRef}
            src={videoBlobUrl || reel.videoUrl}
            className="w-full h-full object-cover animate-fade-in"
            loop
            muted
            playsInline
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration) {
                setVideoProgress((v.currentTime / v.duration) * 100);
              }
            }}
          />
        ) : ytId ? (
          <img
            src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
            alt={reel.description || 'Reel'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
        ) : reel.thumbnailUrl ? (
          <img
            src={reel.thumbnailUrl}
            alt={reel.description || 'Reel'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-900 via-slate-900 to-black flex items-center justify-center">
            <PlaySquare className="w-10 h-10 text-white/30" />
          </div>
        )}

        {/* Gradient Vignette Shadows */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/60 pointer-events-none" />
      </div>

      {/* Top Header Layer: Creator Avatar & Highlight/Active Badges */}
      <div className="relative z-10 p-3 flex items-start justify-between gap-1.5 pointer-events-none">
        <div className="flex items-center gap-2 max-w-[70%]">
          <UserAvatar
            src={reel.userAvatar}
            name={reel.user}
            size="sm"
            className="border-2 border-white/80 shadow-md flex-shrink-0"
          />
          <div className="truncate">
            <p className="text-xs font-bold text-white truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] flex items-center gap-1">
              <span>{reel.user}</span>
              <BadgeCheck className="w-3.5 h-3.5 text-[#1877F2] fill-[#1877F2]" />
            </p>
            <span className="text-[10px] text-gray-300 font-medium flex items-center gap-1 drop-shadow">
              <Eye className="w-3 h-3 text-cyan-400" />
              {formatViews(reel.views || (reel.likes ? Number(reel.likes) * 12 : 1200))}
            </span>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex flex-col items-end gap-1">
          {isActive && (
            <span className="bg-[#1877F2] text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-md flex items-center gap-1 animate-pulse">
              <span className="w-1.5 h-1.5 bg-white rounded-full" />
              Playing
            </span>
          )}

          {isHighlight && (
            <span className="bg-gradient-to-r from-amber-500 to-pink-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow-md flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5" />
              Highlight
            </span>
          )}

          {isHovered && (
            <span className="bg-black/60 backdrop-blur-md text-[#00ffcc] text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md border border-[#00ffcc]/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#00ffcc] rounded-full animate-ping" />
              Previewing
            </span>
          )}
        </div>
      </div>

      {/* Center Hover Indicator */}
      <div className="relative z-10 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="w-11 h-11 rounded-full bg-[#1877F2]/90 backdrop-blur-md text-white flex items-center justify-center shadow-2xl transform scale-90 group-hover:scale-100 transition-transform">
          <Play className="w-5 h-5 fill-current ml-0.5" />
        </div>
      </div>

      {/* Bottom Metadata Layer: Caption, Sound & Stats */}
      <div className="relative z-10 p-3 pt-0 pointer-events-none">
        <p className="text-[11px] font-medium text-gray-100 line-clamp-2 leading-tight mb-2 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
          {reel.description || 'Watch short video highlight'}
        </p>

        <div className="flex items-center justify-between text-[10px] text-gray-300 font-semibold border-t border-white/10 pt-1.5">
          <div className="flex items-center gap-1 truncate max-w-[65%] text-gray-300">
            <Music className="w-3 h-3 text-[#1877F2] flex-shrink-0 animate-spin" />
            <span className="truncate">{reel.music || 'Original Audio'}</span>
          </div>

          <div className="flex items-center gap-1 text-pink-400">
            <Heart className="w-3 h-3 fill-pink-500 text-pink-500" />
            <span>{reel.likes || 0}</span>
          </div>
        </div>

        {/* Animated Progress Bar during preview */}
        {isHovered && (
          <div className="w-full h-1 bg-white/20 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#1877F2] to-cyan-400 rounded-full transition-all duration-100"
              style={{ width: `${videoProgress}%` }}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function FacebookReelsDrawer({
  isOpen,
  onClose,
  reels,
  activeReelId,
  onSelectReel,
  onOpenUpload,
  autoPlayNext,
  onToggleAutoPlayNext
}: FacebookReelsDrawerProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'highlights' | 'trending' | 'popular' | 'audio'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [spotlightReel, setSpotlightReel] = useState<ReelType | null>(null);

  // Filter reels based on tab & search
  const filteredReels = reels.filter((reel) => {
    const matchesSearch = 
      (reel.user || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (reel.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (reel.music || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'highlights') {
      const views = Number(reel.views || (reel.likes ? Number(reel.likes) * 10 : 0));
      return views > 500 || (reel.description && (reel.description.includes('#') || reel.description.length > 30));
    }
    if (activeTab === 'trending') {
      return (Number(reel.likes) || 0) > 10 || reel.id.startsWith('seed-') || reel.id.startsWith('yt-');
    }
    if (activeTab === 'popular') {
      return (Number(reel.likes) || 0) > 0 || (Number(reel.views) || 0) > 1000;
    }
    if (activeTab === 'audio') {
      return Boolean(reel.music && reel.music !== 'Original Audio');
    }
    return true;
  });

  // Top 5 Highlight Moments
  const highlightReels = reels.slice(0, 6);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex flex-col justify-end md:justify-center items-center p-0 md:p-6 pointer-events-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 100, scale: 0.96 }}
          animate={{ y: 0, scale: 1 }}
          exit={{ y: 100, scale: 0.96 }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full md:max-w-6xl h-[92vh] md:h-[88vh] bg-[#18191a] border border-white/10 md:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white"
        >
          {/* Facebook Header Bar */}
          <div className="px-5 py-4 bg-[#242526] border-b border-white/10 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              {/* Facebook Reels Icon */}
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#1877F2] to-[#42b72a] p-0.5 shadow-lg flex items-center justify-center">
                <div className="w-full h-full bg-[#18191a] rounded-[14px] flex items-center justify-center">
                  <PlaySquare className="w-5 h-5 text-[#1877F2] fill-[#1877F2]" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                    Facebook Reels & Highlights
                  </h2>
                  <span className="px-2 py-0.5 text-[10px] font-black bg-[#1877F2]/20 text-[#1877F2] border border-[#1877F2]/40 rounded-full uppercase tracking-wider">
                    Official Style
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Browse short videos, animated previews, and automated playback highlights
                </p>
              </div>
            </div>

            {/* Top Action Controls */}
            <div className="flex items-center gap-2.5">
              {/* Auto-play next reel toggle button */}
              <button
                onClick={onToggleAutoPlayNext}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all active:scale-95 ${
                  autoPlayNext
                    ? 'bg-[#1877F2] text-white border-[#1877F2] shadow-lg shadow-[#1877F2]/20'
                    : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                }`}
                title="Automatically transition and play next reel when current reel finishes"
              >
                <Zap className={`w-3.5 h-3.5 ${autoPlayNext ? 'text-white fill-white animate-bounce' : 'text-gray-400'}`} />
                <span>Auto-Play Next: {autoPlayNext ? 'ON' : 'OFF'}</span>
              </button>

              {/* Upload Reel Button */}
              <button
                onClick={() => {
                  onClose();
                  onOpenUpload();
                }}
                className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4 stroke-[3px]" />
                <span>Create Reel</span>
              </button>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white flex items-center justify-center transition-all border border-white/10 active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Subheader: Category Tabs & Search Bar */}
          <div className="px-5 py-3 bg-[#1e2025] border-b border-white/5 flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
              {[
                { id: 'all', label: 'All Reels', icon: Play },
                { id: 'highlights', label: 'Video Highlights', icon: Sparkles },
                { id: 'trending', label: 'Trending', icon: Flame },
                { id: 'popular', label: 'Popular', icon: TrendingUp },
                { id: 'audio', label: 'AI & Original Sounds', icon: Music },
              ].map((tab) => {
                const Icon = tab.icon;
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all active:scale-95 ${
                      isSelected
                        ? 'bg-[#1877F2] text-white shadow-md'
                        : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-64 flex-shrink-0">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search creator, topic, audio..."
                className="w-full bg-black/40 border border-white/10 focus:border-[#1877F2] rounded-full pl-9 pr-4 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Main Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Top Video Highlights Section (Facebook Stories / Spotlight Carousel) */}
            {highlightReels.length > 0 && !searchQuery && activeTab === 'all' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-white">
                      Featured Video Highlights
                    </h3>
                  </div>
                  <span className="text-xs text-gray-400 font-medium">
                    Hover to preview live video snippets
                  </span>
                </div>

                {/* Horizontal Highlights Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {highlightReels.map((reel) => (
                    <FacebookReelCard
                      key={`highlight-${reel.id}`}
                      reel={reel}
                      isActive={activeReelId === reel.id}
                      isHighlight
                      onSelect={() => {
                        onSelectReel(reel.id);
                        onClose();
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Main Video Reels Grid (Facebook Style) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="flex items-center gap-2">
                  <PlaySquare className="w-4 h-4 text-[#1877F2]" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    {activeTab === 'all'
                      ? 'Reels Feed Explorer'
                      : activeTab === 'highlights'
                      ? 'Key Moment Highlights'
                      : activeTab === 'trending'
                      ? 'Trending & Viral Short Videos'
                      : activeTab === 'popular'
                      ? 'Most Watched & Liked'
                      : 'AI & Original Audio Reels'}
                  </h3>
                  <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-gray-300 font-bold">
                    {filteredReels.length}
                  </span>
                </div>

                <div className="text-xs text-gray-400 flex items-center gap-1.5">
                  <span>💡 Click any card to play in full feed</span>
                </div>
              </div>

              {filteredReels.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                  {filteredReels.map((reel) => (
                    <FacebookReelCard
                      key={reel.id}
                      reel={reel}
                      isActive={activeReelId === reel.id}
                      onSelect={() => {
                        onSelectReel(reel.id);
                        onClose();
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center text-gray-500 space-y-3">
                  <PlaySquare className="w-12 h-12 mx-auto text-gray-600 animate-pulse" />
                  <p className="text-sm font-bold text-gray-300">No reels found matching your filter</p>
                  <p className="text-xs text-gray-500">Try changing the category or clearing the search query.</p>
                </div>
              )}
            </div>
          </div>

          {/* Facebook Bottom Footer Bar */}
          <div className="px-5 py-3 bg-[#242526] border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Facebook-Style Animated Video Previews & Auto-Next Sync Active</span>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-[11px] text-gray-400">
                Auto-advance next video: <strong className={autoPlayNext ? 'text-[#1877F2]' : 'text-gray-500'}>{autoPlayNext ? 'Enabled' : 'Disabled'}</strong>
              </span>
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-[#1877F2] hover:bg-[#1877F2]/90 text-white font-bold rounded-lg transition-all active:scale-95"
              >
                Back to Feed
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
