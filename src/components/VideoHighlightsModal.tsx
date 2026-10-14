import { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Play, 
  Pause, 
  X, 
  Volume2, 
  VolumeX, 
  Flame, 
  BadgeCheck, 
  Music, 
  Heart, 
  Eye, 
  Zap, 
  ChevronLeft, 
  ChevronRight,
  Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Reel as ReelType, formatViews } from '../lib/ReelStore';
import UserAvatar from './UserAvatar';
import { VideoCache } from '../lib/VideoCache';

interface VideoHighlightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  reels: ReelType[];
  onSelectReel: (reelId: string) => void;
}

export default function VideoHighlightsModal({
  isOpen,
  onClose,
  reels,
  onSelectReel
}: VideoHighlightsModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const highlightReels = reels.slice(0, 10);
  const currentReel = highlightReels[currentIndex] || reels[0];

  useEffect(() => {
    let isMounted = true;
    setProgress(0);
    setIsPlaying(true);

    async function loadVideo() {
      if (!currentReel?.videoUrl) return;
      try {
        const blob = await VideoCache.getVideoBlob(currentReel.videoUrl);
        if (isMounted) {
          setVideoBlobUrl(URL.createObjectURL(blob));
        }
      } catch {
        if (isMounted) {
          setVideoBlobUrl(currentReel.videoUrl);
        }
      }
    }

    loadVideo();

    return () => {
      isMounted = false;
    };
  }, [currentIndex, currentReel?.id, currentReel?.videoUrl]);

  if (!isOpen || !currentReel) return null;

  const handleNext = () => {
    if (currentIndex < highlightReels.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCurrentIndex(0); // loop back
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    } else {
      setCurrentIndex(highlightReels.length - 1);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 pointer-events-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 240 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-sm sm:max-w-md h-[80vh] max-h-[700px] bg-zinc-950 rounded-3xl overflow-hidden shadow-2xl border border-white/20 flex flex-col justify-between select-none"
        >
          {/* Top Header Stories Multi-Bar Progress */}
          <div className="absolute top-0 inset-x-0 z-30 p-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
            {/* Story Bars */}
            <div className="flex items-center gap-1.5 mb-3">
              {highlightReels.map((r, idx) => (
                <div 
                  key={r.id}
                  onClick={() => setCurrentIndex(idx)}
                  className="flex-1 h-1 bg-white/25 rounded-full overflow-hidden cursor-pointer"
                >
                  <div
                    className={`h-full bg-gradient-to-r from-pink-500 to-amber-400 rounded-full transition-all duration-100 ${
                      idx < currentIndex ? 'w-full' : idx === currentIndex ? '' : 'w-0'
                    }`}
                    style={{ width: idx === currentIndex ? `${progress}%` : undefined }}
                  />
                </div>
              ))}
            </div>

            {/* Creator Info & Highlight Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <UserAvatar
                  src={currentReel.userAvatar}
                  name={currentReel.user}
                  size="sm"
                  className="border border-white/80"
                />
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1">
                    <span>{currentReel.user}</span>
                    <BadgeCheck className="w-3.5 h-3.5 text-blue-400 fill-blue-400" />
                  </h4>
                  <div className="flex items-center gap-1 text-[10px] text-amber-300 font-semibold">
                    <Sparkles className="w-3 h-3 text-amber-400 animate-spin" />
                    <span>Video Highlight #{currentIndex + 1}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 backdrop-blur-md transition-all"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 backdrop-blur-md transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Center Video Highlight Canvas */}
          <div 
            className="w-full h-full relative cursor-pointer overflow-hidden bg-black"
            onClick={() => {
              if (videoRef.current) {
                if (isPlaying) {
                  videoRef.current.pause();
                  setIsPlaying(false);
                } else {
                  videoRef.current.play();
                  setIsPlaying(true);
                }
              }
            }}
          >
            {videoBlobUrl ? (
              <video
                ref={videoRef}
                src={videoBlobUrl}
                autoPlay
                playsInline
                muted={isMuted}
                className="w-full h-full object-cover"
                onTimeUpdate={(e) => {
                  const v = e.currentTarget;
                  if (v.duration) {
                    setProgress((v.currentTime / v.duration) * 100);
                  }
                }}
                onEnded={handleNext}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            )}

            {/* Subtle Gradient Shadow */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30 pointer-events-none" />

            {/* Pause Overlay Indicator */}
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
                <div className="w-16 h-16 rounded-full bg-black/70 text-white flex items-center justify-center backdrop-blur-md shadow-2xl">
                  <Play className="w-8 h-8 fill-current ml-1" />
                </div>
              </div>
            )}

            {/* Left / Right Click Navigators */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-md transition-all active:scale-95"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-md transition-all active:scale-95"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Bottom Details & Full Play CTA */}
          <div className="absolute bottom-0 inset-x-0 z-30 p-4 bg-gradient-to-t from-black/95 via-black/70 to-transparent space-y-3">
            <p className="text-xs font-semibold text-gray-100 line-clamp-2 leading-relaxed drop-shadow">
              {currentReel.description || 'Video Highlight Moment'}
            </p>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
              <div className="flex items-center gap-1.5 text-[11px] text-gray-300 truncate max-w-[60%]">
                <Music className="w-3.5 h-3.5 text-pink-400 animate-spin" />
                <span className="truncate">{currentReel.music || 'Original Audio'}</span>
              </div>

              {/* Watch in Full Feed Button */}
              <button
                onClick={() => {
                  onSelectReel(currentReel.id);
                  onClose();
                }}
                className="px-4 py-2 bg-gradient-to-r from-[#1877F2] to-cyan-500 hover:from-[#1877F2]/90 hover:to-cyan-600 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Play in Full Feed</span>
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
