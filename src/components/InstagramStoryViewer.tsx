import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, Heart, Send, Share2, MoreVertical, Trash2, Volume2, VolumeX, 
  Pause, Play, ChevronLeft, ChevronRight, MapPin, Music, Sparkles, 
  Eye, Check, MessageCircle, AlertCircle, Link2, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Story, StorySlide, StoryStore } from '../lib/StoryStore';
import UserAvatar from './UserAvatar';

interface InstagramStoryViewerProps {
  initialStory: Story;
  allStories: Story[];
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string;
  onClose: () => void;
  onSendMessage?: (recipientId: string, recipientName: string, message: string) => void;
  onOpenProfile?: (userId: string) => void;
}

interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
  y: number;
}

const QUICK_REACTIONS = ['🔥', '❤️', '😂', '😮', '😢', '👏', '🎉', '💯'];

export default function InstagramStoryViewer({
  initialStory,
  allStories,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  onClose,
  onSendMessage,
  onOpenProfile
}: InstagramStoryViewerProps) {
  const [activeStoryIndex, setActiveStoryIndex] = useState(() => {
    const idx = allStories.findIndex(s => s.id === initialStory.id);
    return idx >= 0 ? idx : 0;
  });

  const [slideIndex, setSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [isMuted, setIsMuted] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySent, setReplySent] = useState(false);
  const [showViewersModal, setShowViewersModal] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showHeartPop, setShowHeartPop] = useState(false);
  const [reactionToast, setReactionToast] = useState<{ message: string; emoji: string } | null>(null);
  const lastTapRef = useRef<number>(0);

  const activeStory = allStories[activeStoryIndex] || initialStory;
  const currentSlide: StorySlide | undefined = activeStory.slides[slideIndex] || activeStory.slides[0];
  const isOwnStory = activeStory.userId === currentUserId;
  const hasLiked = activeStory.likes?.includes(currentUserId);

  const progressIntervalRef = useRef<any>(null);
  const slideDuration = (currentSlide?.duration || 5) * 1000; // ms

  // Mark current story as viewed
  useEffect(() => {
    if (activeStory && currentUserId) {
      StoryStore.markStoryViewed(activeStory.id, currentUserId);
    }
  }, [activeStory?.id, currentUserId]);

  // Go to next slide or next story
  const nextSlide = useCallback(() => {
    if (!activeStory) return;
    if (slideIndex < activeStory.slides.length - 1) {
      setSlideIndex(prev => prev + 1);
      setProgress(0);
    } else {
      // Advance to next user's story
      if (activeStoryIndex < allStories.length - 1) {
        setActiveStoryIndex(prev => prev + 1);
        setSlideIndex(0);
        setProgress(0);
      } else {
        // Last story reached, close viewer
        onClose();
      }
    }
  }, [activeStory, slideIndex, activeStoryIndex, allStories.length, onClose]);

  // Go to previous slide or previous story
  const prevSlide = useCallback(() => {
    if (slideIndex > 0) {
      setSlideIndex(prev => prev - 1);
      setProgress(0);
    } else {
      if (activeStoryIndex > 0) {
        const prevStoryIdx = activeStoryIndex - 1;
        setActiveStoryIndex(prevStoryIdx);
        const prevStorySlides = allStories[prevStoryIdx]?.slides || [];
        setSlideIndex(Math.max(0, prevStorySlides.length - 1));
        setProgress(0);
      } else {
        setProgress(0);
      }
    }
  }, [slideIndex, activeStoryIndex, allStories]);

  // Progress Bar timer
  useEffect(() => {
    if (isPaused || showViewersModal || showOptionsMenu) return;

    const stepMs = 50;
    const increment = (stepMs / slideDuration) * 100;

    progressIntervalRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressIntervalRef.current);
          nextSlide();
          return 0;
        }
        return prev + increment;
      });
    }, stepMs);

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isPaused, slideIndex, activeStoryIndex, slideDuration, nextSlide, showViewersModal, showOptionsMenu]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        prevSlide();
      } else if (e.key === ' ') {
        setIsPaused(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide, onClose]);

  // Reaction burst
  const handleTriggerReaction = async (emoji: string) => {
    // Generate particle burst
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        const newReaction: FloatingReaction = {
          id: Math.random().toString(),
          emoji,
          x: 25 + Math.random() * 50,
          y: 80
        };
        setFloatingReactions(prev => [...prev, newReaction]);
        setTimeout(() => {
          setFloatingReactions(prev => prev.filter(r => r.id !== newReaction.id));
        }, 2200);
      }, i * 90);
    }

    // Persist reaction to StoryStore & Author
    await StoryStore.sendReaction(
      activeStory.id,
      { id: currentUserId, name: currentUserName, avatar: currentUserAvatar },
      emoji,
      currentSlide?.caption || currentSlide?.textOverlay
    );

    // Send DM reaction if configured
    if (onSendMessage && !isOwnStory) {
      onSendMessage(
        activeStory.userId,
        activeStory.user.name,
        `Reacted ${emoji} to your story: "${currentSlide?.caption || currentSlide?.textOverlay || 'Photo/Video'}"`
      );
    }

    // Show feedback toast
    setReactionToast({
      message: `Sent ${emoji} to ${activeStory.user.name.split(' ')[0]}`,
      emoji
    });
    setTimeout(() => {
      setReactionToast(null);
    }, 2400);
  };

  // Quick 'like' heart reaction to the author of the story
  const handleSendHeartReaction = async () => {
    // Trigger animated center heart pop
    setShowHeartPop(true);
    setTimeout(() => setShowHeartPop(false), 1100);

    // Trigger floating ascending hearts
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        const newReaction: FloatingReaction = {
          id: Math.random().toString(),
          emoji: '❤️',
          x: 20 + Math.random() * 60,
          y: 82
        };
        setFloatingReactions(prev => [...prev, newReaction]);
        setTimeout(() => {
          setFloatingReactions(prev => prev.filter(r => r.id !== newReaction.id));
        }, 2200);
      }, i * 110);
    }

    // Play subtle pleasant chime sound
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(783.99, audioCtx.currentTime + 0.12); // G5
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      }
    } catch {}

    // Send reaction to StoryStore & Author
    await StoryStore.sendReaction(
      activeStory.id,
      { id: currentUserId, name: currentUserName, avatar: currentUserAvatar },
      '❤️',
      currentSlide?.caption || currentSlide?.textOverlay
    );

    // Send DM reaction if configured
    if (onSendMessage && !isOwnStory) {
      onSendMessage(
        activeStory.userId,
        activeStory.user.name,
        `Reacted ❤️ to your story: "${currentSlide?.caption || currentSlide?.textOverlay || 'Photo/Video'}"`
      );
    }

    // Show floating confirmation toast
    setReactionToast({
      message: `Sent like reaction to ${activeStory.user.name}!`,
      emoji: '❤️'
    });
    setTimeout(() => {
      setReactionToast(null);
    }, 2500);
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    if (onSendMessage) {
      onSendMessage(
        activeStory.userId,
        activeStory.user.name,
        `Replying to story: ${replyText}`
      );
    }
    setReplyText('');
    setReplySent(true);
    setTimeout(() => setReplySent(false), 3000);
  };

  const handleToggleLike = async () => {
    if (!hasLiked) {
      await handleSendHeartReaction();
    } else {
      // Toggle like state
      const isNowLiked = await StoryStore.toggleLikeStory(activeStory.id, currentUserId);
      if (isNowLiked) {
        await handleSendHeartReaction();
      } else {
        setReactionToast({
          message: `Removed like`,
          emoji: '🤍'
        });
        setTimeout(() => setReactionToast(null), 1800);
      }
    }
  };

  const handleDeleteCurrentSlide = async () => {
    if (confirm("Delete this story slide?")) {
      if (currentSlide) {
        await StoryStore.deleteSlide(activeStory.id, currentSlide.id);
        if (activeStory.slides.length <= 1) {
          onClose();
        } else {
          setSlideIndex(0);
          setProgress(0);
        }
      }
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const formatTimeAgo = (timestamp: number) => {
    const diffMins = Math.floor((Date.now() - timestamp) / (1000 * 60));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    return '1d';
  };

  if (!activeStory || !currentSlide) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-black/95 sm:bg-black/90 backdrop-blur-xl flex items-center justify-center select-none overflow-hidden">
      {/* Desktop Left / Right Story Switcher Controls */}
      {activeStoryIndex > 0 && (
        <button
          type="button"
          onClick={() => {
            setActiveStoryIndex(prev => prev - 1);
            setSlideIndex(0);
            setProgress(0);
          }}
          className="hidden md:flex absolute left-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center backdrop-blur-md transition-all active:scale-95 cursor-pointer z-30"
          title="Previous story"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>
      )}

      {activeStoryIndex < allStories.length - 1 && (
        <button
          type="button"
          onClick={() => {
            setActiveStoryIndex(prev => prev + 1);
            setSlideIndex(0);
            setProgress(0);
          }}
          className="hidden md:flex absolute right-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center backdrop-blur-md transition-all active:scale-95 cursor-pointer z-30"
          title="Next story"
        >
          <ChevronRight className="w-7 h-7" />
        </button>
      )}

      {/* Main Story Phone Aspect-Ratio Frame Container */}
      <div 
        className="relative w-full h-full sm:h-[94vh] sm:max-h-[860px] sm:max-w-[440px] sm:rounded-3xl overflow-hidden bg-gray-950 flex flex-col justify-between shadow-2xl border border-white/10"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Top Progress Segment Bars */}
        <div className="absolute top-0 left-0 right-0 z-30 p-3 pt-3 flex gap-1.5 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          {activeStory.slides.map((slide, idx) => {
            let fillPercent = 0;
            if (idx < slideIndex) fillPercent = 100;
            else if (idx === slideIndex) fillPercent = progress;

            return (
              <div
                key={slide.id || idx}
                className="h-1 sm:h-1.5 flex-1 bg-white/30 rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-white transition-all duration-75 ease-linear rounded-full"
                  style={{ width: `${fillPercent}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Story Header */}
        <div className="absolute top-4 left-0 right-0 z-30 px-3 pt-2 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (onOpenProfile) onOpenProfile(activeStory.userId);
              }}
              className="flex items-center gap-2 hover:opacity-90 transition-opacity text-left min-w-0"
            >
              <div className="p-0.5 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 shrink-0">
                <UserAvatar
                  src={activeStory.user.avatar}
                  name={activeStory.user.name}
                  size="sm"
                  className="w-8 h-8 rounded-full object-cover"
                />
              </div>

              <div className="min-w-0 flex flex-col">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-xs sm:text-sm text-white truncate drop-shadow-md">
                    {activeStory.user.name}
                  </span>
                  {activeStory.user.isVerified && (
                    <span className="w-3.5 h-3.5 bg-blue-500 rounded-full text-white text-[9px] font-black flex items-center justify-center shrink-0">
                      ✓
                    </span>
                  )}
                  <span className="text-[11px] text-white/70 font-medium">
                    • {formatTimeAgo(currentSlide.createdAt)}
                  </span>
                </div>

                {/* Soundtrack / Location tag in header */}
                {currentSlide.musicTrack ? (
                  <div className="flex items-center gap-1 text-[10px] text-white/90 font-medium truncate">
                    <Music className="w-2.5 h-2.5 shrink-0 animate-pulse text-pink-400" />
                    <span className="truncate">{currentSlide.musicTrack.title} • {currentSlide.musicTrack.artist}</span>
                  </div>
                ) : currentSlide.location ? (
                  <div className="flex items-center gap-1 text-[10px] text-white/90 font-medium truncate">
                    <MapPin className="w-2.5 h-2.5 shrink-0 text-red-400" />
                    <span className="truncate">{currentSlide.location}</span>
                  </div>
                ) : null}
              </div>
            </button>
          </div>

          {/* Action Icons in Header */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsPaused(prev => !prev);
              }}
              className="p-1.5 rounded-full bg-black/30 hover:bg-black/50 text-white/90 backdrop-blur-xs transition-colors"
              title={isPaused ? "Play" : "Pause"}
            >
              {isPaused ? <Play className="w-4 h-4 fill-white" /> : <Pause className="w-4 h-4" />}
            </button>

            {isOwnStory && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteCurrentSlide();
                }}
                className="p-1.5 rounded-full bg-black/30 hover:bg-red-600/80 text-white/90 backdrop-blur-xs transition-colors"
                title="Delete this slide"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full bg-black/30 hover:bg-black/50 text-white backdrop-blur-xs transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tap Navigators (Left 25% prev, Center 50% double-tap react, Right 25% next) */}
        <div className="absolute inset-0 z-20 flex">
          <div
            className="w-1/4 h-full cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              prevSlide();
            }}
          />
          <div
            className="w-1/2 h-full cursor-pointer"
            onDoubleClick={(e) => {
              e.stopPropagation();
              handleSendHeartReaction();
            }}
            onClick={(e) => {
              e.stopPropagation();
              const now = Date.now();
              if (now - lastTapRef.current < 320) {
                handleSendHeartReaction();
                lastTapRef.current = 0;
              } else {
                lastTapRef.current = now;
              }
            }}
          />
          <div
            className="w-1/4 h-full cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              nextSlide();
            }}
          />
        </div>

        {/* Story Slide Canvas Body */}
        <div className="relative w-full h-full flex items-center justify-center bg-gray-900">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeStory.id}_${currentSlide.id}`}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full flex items-center justify-center relative overflow-hidden"
            >
              {/* Media: Image */}
              {currentSlide.mediaType === 'image' && currentSlide.mediaUrl && (
                <div className="w-full h-full relative flex items-center justify-center bg-black">
                  <img
                    src={currentSlide.mediaUrl}
                    alt="Story media"
                    className="w-full h-full object-cover sm:object-contain select-none pointer-events-none"
                  />
                  {/* Subtle vignette gradient for readable text */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />
                </div>
              )}

              {/* Media: Video */}
              {currentSlide.mediaType === 'video' && currentSlide.mediaUrl && (
                <div className="w-full h-full relative flex items-center justify-center bg-black">
                  <video
                    src={currentSlide.mediaUrl}
                    autoPlay
                    playsInline
                    muted={isMuted}
                    loop
                    className="w-full h-full object-cover sm:object-contain"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />
                </div>
              )}

              {/* Media: Text-only Gradient Story */}
              {currentSlide.mediaType === 'text' && (
                <div className={`w-full h-full bg-gradient-to-br ${currentSlide.backgroundGradient || 'from-purple-900 via-indigo-900 to-black'} flex items-center justify-center p-8 text-center relative`}>
                  {/* Background decorative particles */}
                  <div className="absolute top-10 right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
                  <div className="absolute bottom-10 left-10 w-32 h-32 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />

                  <p 
                    className={`text-xl sm:text-2xl font-black leading-relaxed max-w-xs drop-shadow-xl ${
                      currentSlide.fontStyle === 'neon' 
                        ? 'font-mono text-cyan-300 drop-shadow-[0_0_12px_rgba(34,211,238,0.8)]' 
                        : currentSlide.fontStyle === 'handwriting' 
                        ? 'font-serif italic text-pink-100' 
                        : 'text-white'
                    }`}
                    style={{ color: currentSlide.textColor || '#ffffff' }}
                  >
                    {currentSlide.textOverlay}
                  </p>
                </div>
              )}

              {/* Overlay Caption on Photo/Video */}
              {currentSlide.caption && (
                <div className="absolute bottom-28 sm:bottom-24 left-4 right-4 z-20 pointer-events-none">
                  <div className="bg-black/60 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 text-white text-xs sm:text-sm font-semibold leading-relaxed shadow-lg">
                    {currentSlide.caption}
                  </div>
                </div>
              )}

              {/* Stickers (Sticker emoji, location, music pill) */}
              {currentSlide.sticker && (
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 z-20 text-5xl pointer-events-none animate-bounce">
                  {currentSlide.sticker}
                </div>
              )}

              {/* Location Tag Badge on Canvas if attached */}
              {currentSlide.location && currentSlide.mediaType !== 'text' && (
                <div className="absolute top-20 left-4 z-20 pointer-events-none">
                  <div className="bg-white/90 backdrop-blur-md text-gray-900 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md">
                    <MapPin className="w-3.5 h-3.5 text-rose-500" />
                    <span>{currentSlide.location}</span>
                  </div>
                </div>
              )}

              {/* Music Soundtrack Pill on Canvas */}
              {currentSlide.musicTrack && currentSlide.mediaType !== 'text' && (
                <div className="absolute top-20 right-4 z-20 pointer-events-none">
                  <div className="bg-black/70 backdrop-blur-md text-white px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 border border-white/20 shadow-md">
                    <Music className="w-3 h-3 text-pink-400 animate-spin" />
                    <span>{currentSlide.musicTrack.title}</span>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Floating Emoji Reactions Particle Stream */}
          <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
            {floatingReactions.map(reaction => (
              <motion.div
                key={reaction.id}
                initial={{ opacity: 1, scale: 0.5, x: `${reaction.x}%`, y: '80%' }}
                animate={{ 
                  opacity: [1, 1, 0], 
                  scale: [0.5, 1.8, 2.2], 
                  y: '15%',
                  x: `${reaction.x + (Math.random() * 20 - 10)}%` 
                }}
                transition={{ duration: 1.8, ease: "easeOut" }}
                className="absolute text-4xl"
              >
                {reaction.emoji}
              </motion.div>
            ))}
          </div>

          {/* Animated Center Heart Reaction Pop on Double-Tap or Reaction Button Click */}
          <AnimatePresence>
            {showHeartPop && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.35, 1.1], opacity: [0, 1, 1] }}
                exit={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
              >
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-36 h-36 bg-rose-500/30 rounded-full blur-2xl animate-pulse" />
                  <Heart className="w-28 h-28 text-rose-500 fill-rose-500 drop-shadow-[0_10px_25px_rgba(244,63,94,0.6)] animate-pulse" />
                  <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-amber-300 animate-bounce" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick Reaction Notification Toast */}
          <AnimatePresence>
            {reactionToast && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.9 }}
                className="absolute top-16 inset-x-4 flex justify-center pointer-events-none z-50"
              >
                <div className="bg-black/85 backdrop-blur-xl border border-white/20 text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 text-xs sm:text-sm font-bold">
                  <span className="text-base animate-bounce">{reactionToast.emoji}</span>
                  <span>{reactionToast.message}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Story Footer Bar (Quick reply, emojis, likes) */}
        <div className="relative z-30 p-3 sm:p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex flex-col gap-2">
          {/* Quick Reaction Emojis Row */}
          {!isOwnStory && (
            <div className="flex items-center justify-around px-1 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
              {QUICK_REACTIONS.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTriggerReaction(emoji);
                  }}
                  className="text-lg hover:scale-130 active:scale-95 transition-transform p-1 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Reply Form / Controls Row */}
          <div className="flex items-center gap-2">
            {!isOwnStory ? (
              <form 
                onSubmit={handleSendReply} 
                className="flex-1 flex items-center bg-white/15 backdrop-blur-md rounded-full border border-white/20 px-3 py-1.5 focus-within:border-white/50 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Send message to ${activeStory.user.name.split(' ')[0]}...`}
                  className="flex-1 bg-transparent text-white text-xs sm:text-sm placeholder-white/60 focus:outline-hidden"
                  onFocus={() => setIsPaused(true)}
                  onBlur={() => setIsPaused(false)}
                />
                {replyText.trim() ? (
                  <button
                    type="submit"
                    className="p-1 text-white hover:text-blue-400 transition-colors cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                ) : (
                  replySent && (
                    <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      Sent
                    </span>
                  )
                )}
              </form>
            ) : (
              /* If OWN Story: Show Viewers count button */
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowViewersModal(true);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full border border-white/20 text-white text-xs font-bold transition-all cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>Seen by {activeStory.views?.length || 0} {activeStory.views?.length === 1 ? 'person' : 'people'}</span>
              </button>
            )}

            {/* Reaction Button (Heart icon) to send quick 'like' reaction to the author */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSendHeartReaction();
              }}
              className={`relative flex items-center justify-center gap-1.5 px-3 py-2 rounded-full backdrop-blur-md border transition-all active:scale-75 cursor-pointer select-none group ${
                hasLiked
                  ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white border-rose-400/80 shadow-lg shadow-rose-600/30 scale-105'
                  : 'bg-white/15 hover:bg-white/25 text-white border-white/20 hover:scale-105'
              }`}
              title={hasLiked ? `Liked by you • Tap to send quick reaction ❤️` : `Send quick 'like' reaction to ${activeStory.user.name}`}
              aria-label="Send like reaction to author"
            >
              <Heart 
                className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${
                  hasLiked ? 'fill-white text-white drop-shadow-xs' : 'text-white'
                }`} 
              />
              {activeStory.likes && activeStory.likes.length > 0 && (
                <span className="text-xs font-black tracking-tight drop-shadow-xs">
                  {activeStory.likes.length}
                </span>
              )}
            </button>

            {/* Share Story Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCopyLink();
              }}
              className="p-2 rounded-full bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-md transition-all active:scale-90 cursor-pointer"
              title="Share story link"
            >
              {copiedLink ? <Check className="w-5 h-5 text-emerald-400" /> : <Share2 className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Viewers Modal Bottom Sheet for Own Story */}
        <AnimatePresence>
          {showViewersModal && (
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute inset-x-0 bottom-0 max-h-[70%] bg-gray-900/95 backdrop-blur-2xl rounded-t-3xl border-t border-white/10 z-50 p-4 flex flex-col shadow-2xl text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-brand-blue" />
                  <span className="font-bold text-sm">
                    Story Viewers ({activeStory.views?.length || 0})
                  </span>
                  {activeStory.likes && activeStory.likes.length > 0 && (
                    <span className="ml-2 flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                      <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />
                      {activeStory.likes.length}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowViewersModal(false)}
                  className="p-1 rounded-full bg-white/10 hover:bg-white/20"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 divide-y divide-white/5 py-2">
                {activeStory.views && activeStory.views.length > 0 ? (
                  activeStory.views.map((viewerId, idx) => {
                    const userReactions = activeStory.reactions?.filter(r => r.userId === viewerId) || [];
                    const hasLikedThis = activeStory.likes?.includes(viewerId);
                    return (
                      <div key={viewerId || idx} className="flex items-center justify-between py-2.5">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            src=""
                            name={viewerId}
                            size="sm"
                            className="w-8 h-8 rounded-full"
                          />
                          <div>
                            <p className="text-xs font-bold text-white capitalize">{viewerId.replace('user_', '')}</p>
                            <p className="text-[10px] text-white/50">Viewed your story</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {userReactions.slice(-3).map((r) => (
                            <span key={r.id} className="text-sm animate-bounce" title={`Reacted ${r.reaction}`}>
                              {r.reaction}
                            </span>
                          ))}
                          {hasLikedThis && (
                            <Heart className="w-4 h-4 text-rose-500 fill-rose-500 drop-shadow-sm" />
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-white/50 text-xs">
                    No views yet. Share with friends to get views! ✨
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
