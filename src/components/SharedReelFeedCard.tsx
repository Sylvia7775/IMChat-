import React, { useState, useRef, useEffect } from 'react';
import { Play, Radio, Sparkles, Film, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';

interface SharedReelFeedCardProps {
  reelData: {
    reelId?: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    isLiveStream?: boolean;
  };
  postImage?: string;
  postCaption?: string;
  onNavigate?: (tab: string) => void;
  onDoubleTapLike?: () => void;
}

export default function SharedReelFeedCard({
  reelData,
  postImage,
  postCaption,
  onNavigate,
  onDoubleTapLike
}: SharedReelFeedCardProps) {
  const [imageError, setImageError] = useState(false);
  const [isVideoFrameReady, setIsVideoFrameReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const videoUrl = reelData?.videoUrl || (postImage && isVideoSource(postImage) ? postImage : '');
  
  // Extract YouTube ID if any
  const getYouTubeId = (url?: string) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([\w-]{11})/);
    return match ? match[1] : null;
  };

  const ytId = getYouTubeId(videoUrl) || getYouTubeId(postImage) || getYouTubeId(postCaption);

  function isVideoSource(url: string) {
    if (!url) return false;
    const lower = url.toLowerCase();
    return (
      lower.includes('.mp4') ||
      lower.includes('.webm') ||
      lower.includes('.mov') ||
      lower.includes('.m4v') ||
      lower.includes('video/upload') ||
      lower.includes('blob:') ||
      lower.includes('youtube.com') ||
      lower.includes('youtu.be')
    );
  }

  // Determine initial thumbnail candidate
  let initialThumb = '';
  if (ytId) {
    initialThumb = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
  } else if (reelData?.thumbnailUrl && !isVideoSource(reelData.thumbnailUrl)) {
    initialThumb = reelData.thumbnailUrl;
  } else if (postImage && !isVideoSource(postImage)) {
    initialThumb = postImage;
  }

  const [activeThumb, setActiveThumb] = useState(initialThumb);

  useEffect(() => {
    if (ytId) {
      setActiveThumb(`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`);
      setImageError(false);
    } else if (reelData?.thumbnailUrl && !isVideoSource(reelData.thumbnailUrl)) {
      setActiveThumb(reelData.thumbnailUrl);
      setImageError(false);
    } else if (postImage && !isVideoSource(postImage)) {
      setActiveThumb(postImage);
      setImageError(false);
    } else {
      setActiveThumb('');
    }
  }, [reelData?.thumbnailUrl, postImage, ytId]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (reelData?.reelId) {
      (window as any).activeReelIdPlaying = reelData.reelId;
    }
    if (onNavigate) {
      onNavigate('reels');
    }
  };

  return (
    <div 
      onClick={handleClick}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleTapLike?.();
      }}
      className="relative w-full aspect-[4/5] sm:aspect-[9/16] max-h-[560px] bg-zinc-950 rounded-2xl overflow-hidden cursor-pointer group select-none shadow-xl border border-white/10"
    >
      {/* 1. MEDIA DISPLAY LAYER */}
      {activeThumb && !imageError ? (
        <img
          src={activeThumb}
          alt="Reel visual thumbnail"
          referrerPolicy="no-referrer"
          onError={() => {
            if (ytId && activeThumb.includes('hqdefault')) {
              // Try standard youtube thumb fallback
              setActiveThumb(`https://img.youtube.com/vi/${ytId}/0.jpg`);
            } else {
              setImageError(true);
            }
          }}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
      ) : videoUrl ? (
        <div className="w-full h-full relative bg-black flex items-center justify-center">
          <video
            ref={videoRef}
            src={videoUrl}
            preload="auto"
            muted
            playsInline
            className="w-full h-full object-cover"
            onLoadedMetadata={(e) => {
              const video = e.currentTarget;
              if (video.duration && !isNaN(video.duration)) {
                video.currentTime = Math.min(1, Math.max(0.2, video.duration / 2));
              } else {
                video.currentTime = 0.5;
              }
              setIsVideoFrameReady(true);
            }}
            onSeeked={() => setIsVideoFrameReady(true)}
          />
          {!isVideoFrameReady && (
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-950 via-zinc-900 to-purple-950 flex items-center justify-center">
              <Film className="w-10 h-10 text-white/30 animate-pulse" />
            </div>
          )}
        </div>
      ) : (
        <div className="w-full h-full bg-gradient-to-tr from-indigo-950 via-slate-900 to-purple-950 flex items-center justify-center">
          <Film className="w-12 h-12 text-white/20" />
        </div>
      )}

      {/* 2. GRADIENT VIGNETTE & HOVER OVERLAY */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40 group-hover:bg-black/50 transition-colors duration-300 pointer-events-none" />

      {/* 3. TOP BADGE (REEL OR LIVE) */}
      <div className="absolute top-3.5 left-3.5 z-20 pointer-events-none">
        {reelData?.isLiveStream ? (
          <div className="px-3 py-1.5 bg-rose-600/90 border border-rose-400/50 backdrop-blur-md rounded-full text-white font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 shadow-lg">
            <Radio className="w-3.5 h-3.5 animate-pulse text-white" />
            <span>GRABACIÓN EN VIVO</span>
          </div>
        ) : (
          <div className="px-3 py-1.5 bg-black/60 hover:bg-black/80 border border-white/20 backdrop-blur-md rounded-full text-white font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping mr-0.5" />
            <Film className="w-3.5 h-3.5 text-pink-400" />
            <span>VER EN REELS</span>
          </div>
        )}
      </div>

      {/* 4. CENTER GLOWING PLAY BUTTON */}
      <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
        <motion.div 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-pink-500 via-purple-600 to-indigo-600 p-[2px] shadow-[0_0_30px_rgba(236,72,153,0.5)] flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
        >
          <div className="w-full h-full rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <Play className="w-8 h-8 sm:w-10 sm:h-10 text-white fill-white ml-1 drop-shadow-md" />
          </div>
        </motion.div>
      </div>

      {/* 5. BOTTOM BAR HINT & CAPTION */}
      <div className="absolute inset-x-0 bottom-0 p-4 z-20 flex flex-col gap-1 text-white pointer-events-none">
        <div className="flex items-center justify-between text-xs text-white/90 font-medium">
          <span className="flex items-center gap-1 text-[11px] text-pink-300 font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
            Haz clic para reproducir
          </span>
          <span className="flex items-center gap-1 text-[10px] text-white/70 bg-white/10 px-2 py-0.5 rounded-full backdrop-blur-sm">
            <span>Reels</span>
            <ExternalLink className="w-3 h-3" />
          </span>
        </div>
      </div>
    </div>
  );
}
