import React, { useRef, useState, useEffect } from 'react';
import { Plus, ChevronLeft, ChevronRight, Sparkles, Video, Eye, Radio } from 'lucide-react';
import { motion } from 'motion/react';
import { Story, StoryStore } from '../lib/StoryStore';
import UserAvatar from './UserAvatar';

interface InstagramStoriesTrayProps {
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string;
  onOpenStory: (story: Story, initialSlideIndex?: number) => void;
  onCreateStory: () => void;
  onGoLive?: () => void;
}

export default function InstagramStoriesTray({
  currentUserId,
  currentUserName,
  currentUserAvatar,
  onOpenStory,
  onCreateStory,
  onGoLive
}: InstagramStoriesTrayProps) {
  const [stories, setStories] = useState<Story[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const unsub = StoryStore.subscribe((updatedStories) => {
      setStories(updatedStories);
    });
    return () => unsub();
  }, []);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [stories]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const amount = direction === 'left' ? -320 : 320;
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
      setTimeout(checkScroll, 300);
    }
  };

  const myStory = stories.find(s => s.userId === currentUserId);
  const otherStories = stories.filter(s => s.userId !== currentUserId);

  const isMyStoryViewed = myStory ? StoryStore.isStoryViewed(myStory.id, currentUserId) : false;

  return (
    <div className="bg-white border-b border-gray-200/80 sm:rounded-2xl sm:mx-2 sm:my-3 sm:shadow-xs p-3 sm:p-4 relative group/tray transition-all select-none">
      {/* Tray Header Bar with Subtle Branding & Actions */}
      <div className="flex items-center justify-between mb-2.5 px-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-black text-gray-800 tracking-wider uppercase flex items-center gap-1">
            <span>Stories</span>
            <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse"></span>
          </span>
          <span className="text-[11px] font-bold text-gray-400">
            • 24h Moments
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onGoLive && (
            <button
              type="button"
              onClick={onGoLive}
              className="flex items-center gap-1 text-[11px] font-extrabold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 px-2.5 py-1 rounded-full border border-rose-200/60 transition-all active:scale-95 cursor-pointer"
              title="Go Live"
            >
              <Radio className="w-3 h-3 text-rose-600 animate-pulse" />
              <span>Go Live</span>
            </button>
          )}

          <button
            type="button"
            onClick={onCreateStory}
            className="flex items-center gap-1 text-[11px] font-extrabold text-brand-blue hover:text-blue-700 bg-blue-50 hover:bg-blue-100/80 px-2.5 py-1 rounded-full border border-blue-200/60 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Story</span>
          </button>
        </div>
      </div>

      {/* Horizontal Scrolling Stories Container */}
      <div className="relative">
        {/* Left Arrow on Desktop */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll('left')}
            className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white/95 backdrop-blur-md rounded-full shadow-md border border-gray-200 items-center justify-center text-gray-700 hover:text-black hover:scale-110 active:scale-95 transition-all cursor-pointer -ml-2"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        {/* Right Arrow on Desktop */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll('right')}
            className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white/95 backdrop-blur-md rounded-full shadow-md border border-gray-200 items-center justify-center text-gray-700 hover:text-black hover:scale-110 active:scale-95 transition-all cursor-pointer -mr-2"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex items-center gap-3.5 sm:gap-4 overflow-x-auto pb-1 pt-1 scrollbar-none scroll-smooth"
        >
          {/* Item 1: Your Story */}
          <div className="flex flex-col items-center gap-1.5 shrink-0 select-none group/self cursor-pointer">
            <div className="relative">
              {myStory ? (
                /* User HAS active stories */
                <button
                  type="button"
                  onClick={() => onOpenStory(myStory)}
                  className={`p-[2.5px] rounded-full transition-transform active:scale-95 ${
                    isMyStoryViewed 
                      ? 'ring-2 ring-gray-300' 
                      : 'bg-gradient-to-tr from-yellow-400 via-rose-500 to-purple-600 animate-gradient-x p-[2.5px]'
                  }`}
                  title="View your story"
                >
                  <div className="p-0.5 bg-white rounded-full">
                    <UserAvatar
                      src={currentUserAvatar}
                      name={currentUserName}
                      size="lg"
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover"
                    />
                  </div>
                </button>
              ) : (
                /* User DOES NOT have active stories */
                <button
                  type="button"
                  onClick={onCreateStory}
                  className="p-[2.5px] rounded-full transition-transform active:scale-95 hover:opacity-90"
                  title="Add to your story"
                >
                  <div className="p-0.5 bg-white rounded-full ring-2 ring-dashed ring-gray-300">
                    <UserAvatar
                      src={currentUserAvatar}
                      name={currentUserName}
                      size="lg"
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover"
                    />
                  </div>
                </button>
              )}

              {/* Blue Plus Badge */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateStory();
                }}
                className="absolute bottom-0 right-0 w-5 h-5 sm:w-5.5 sm:h-5.5 bg-brand-blue text-white rounded-full flex items-center justify-center border-2 border-white shadow-xs hover:bg-blue-600 active:scale-90 transition-all cursor-pointer"
                title="Add new story slide"
              >
                <Plus className="w-3 h-3 stroke-[3]" />
              </button>
            </div>

            <span className="text-[11px] sm:text-xs font-semibold text-gray-700 max-w-[70px] truncate text-center">
              Your story
            </span>
          </div>

          {/* Other User Stories */}
          {otherStories.map((story) => {
            const isViewed = StoryStore.isStoryViewed(story.id, currentUserId);
            const isLive = story.isLive;

            return (
              <div
                key={story.id}
                className="flex flex-col items-center gap-1.5 shrink-0 select-none group/story cursor-pointer"
                onClick={() => onOpenStory(story)}
              >
                <div className="relative">
                  <div
                    className={`rounded-full transition-all duration-200 group-hover/story:scale-105 active:scale-95 ${
                      isLive
                        ? 'p-[2.5px] bg-gradient-to-tr from-red-600 via-rose-500 to-amber-500 ring-2 ring-red-400 ring-offset-1 animate-pulse'
                        : isViewed
                        ? 'p-[2px] bg-gray-300'
                        : 'p-[2.5px] bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600'
                    }`}
                  >
                    <div className="p-0.5 bg-white rounded-full">
                      <UserAvatar
                        src={story.user.avatar}
                        name={story.user.name}
                        size="lg"
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover"
                      />
                    </div>
                  </div>

                  {/* LIVE Badge */}
                  {isLive && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-gradient-to-r from-red-600 to-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border border-white tracking-widest shadow-xs uppercase">
                      LIVE
                    </div>
                  )}

                  {/* Unseen slide indicator count if multiple slides */}
                  {!isViewed && story.slides.length > 1 && !isLive && (
                    <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-purple-600 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                      {story.slides.length}
                    </div>
                  )}
                </div>

                <span className={`text-[11px] sm:text-xs max-w-[70px] truncate text-center font-medium ${
                  isViewed ? 'text-gray-500' : 'text-gray-900 font-semibold'
                }`}>
                  {story.user.username || story.user.name.toLowerCase().replace(/\s+/g, '_')}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
