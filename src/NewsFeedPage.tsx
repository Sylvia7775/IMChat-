import React, { useState, useEffect } from 'react';
import { 
  Newspaper, ArrowLeft, Search, Share2, ExternalLink, 
  MessageCircle, Send, Globe, Sparkles, AlertCircle, 
  Clock, Check, Heart, Bookmark, Compass, Filter, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PostStore } from './lib/PostStore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { collection, addDoc } from 'firebase/firestore';

export interface NewsArticle {
  id: string;
  title: string;
  url: string;
  pubDate: string;
  description: string;
  source: string;
  image: string;
  category: string;
}

interface NewsFeedPageProps {
  onBack: () => void;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string;
}

export default function NewsFeedPage({ 
  onBack, 
  currentUserId, 
  currentUserName, 
  currentUserAvatar 
}: NewsFeedPageProps) {
  const [category, setCategory] = useState<string>('top');
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [activeArticle, setActiveArticle] = useState<NewsArticle | null>(null);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [shareArticle, setShareArticle] = useState<NewsArticle | null>(null);
  const [shareComment, setShareComment] = useState<string>('');
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [shareSuccess, setShareSuccess] = useState<boolean>(false);

  // Saved bookmark list
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('news_bookmarks');
    return saved ? JSON.parse(saved) : [];
  });

  const categories = [
    { id: 'top', name: 'Top Stories', icon: '🔥' },
    { id: 'world', name: 'World', icon: '🌍' },
    { id: 'technology', name: 'Technology', icon: '💻' },
    { id: 'business', name: 'Business', icon: '📈' },
    { id: 'science', name: 'Science', icon: '🔬' },
    { id: 'entertainment', name: 'Entertainment', icon: '🎬' },
    { id: 'sports', name: 'Sports', icon: '⚽' },
    { id: 'health', name: 'Health', icon: '🏥' }
  ];

  const fetchNews = async (cat: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/news?category=${cat}`);
      if (!response.ok) throw new Error('Failed to fetch news feed');
      const data = await response.json();
      if (data.success) {
        setArticles(data.articles || []);
      } else {
        throw new Error('News feed data not found');
      }
    } catch (err: any) {
      console.error("Error loading news feed:", err);
      setError("Unable to load latest news feed. Showing fallback news.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNews(category);
  }, [category]);

  const handleBookmarkToggle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    let updated;
    if (bookmarkedIds.includes(id)) {
      updated = bookmarkedIds.filter(item => item !== id);
    } else {
      updated = [...bookmarkedIds, id];
    }
    setBookmarkedIds(updated);
    localStorage.setItem('news_bookmarks', JSON.stringify(updated));
  };

  const handleOpenShare = (article: NewsArticle, e: React.MouseEvent) => {
    e.stopPropagation();
    setShareArticle(article);
    setShareComment(`Just read this interesting story: "${article.title}" 📰`);
    setShareSuccess(false);
    setShowShareModal(true);
  };

  const handleConfirmShareAsPost = async () => {
    if (!shareArticle) return;
    setIsSharing(true);
    try {
      // Add standard community post using PostStore
      await PostStore.addPost({
        userId: currentUserId,
        user: {
          name: currentUserName,
          avatar: currentUserAvatar,
          location: 'Madrid',
          isVerified: true
        },
        image: shareArticle.image,
        mediaType: 'image',
        caption: `${shareComment}\n\nRead more at: ${shareArticle.url}`,
        visibility: 'public'
      });

      // Also let's optionally submit a real-time event log to Firestore if desired
      setShareSuccess(true);
      setTimeout(() => {
        setShowShareModal(false);
        setShareArticle(null);
        setShareComment('');
      }, 1800);
    } catch (err) {
      console.error("Error sharing news to post:", err);
    } finally {
      setIsSharing(false);
    }
  };

  const filteredArticles = articles.filter(art => 
    art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    art.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    art.source.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 h-full bg-gray-50 flex flex-col overflow-hidden relative" id="news-feed-root">
      {/* Header bar */}
      <header className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-xl transition-all active:scale-95 cursor-pointer text-gray-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <img 
                src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgE-7xdixLcVwVKJjIMuH_HBPTUe6pRLBBOLtaO7GHpZykAG3fgYJNIVOGpu6T3KDzUyzzLFHaXW4ZuintSnbQpouddmA3mk42X8BncJ7Di0_jAHrJ5MTbGhiPZyTPsyCsxqjSjsYUdgCjnIIjJExs_j_DMN60REvdJ_T842EG6_fm0kRx6KTRAsGRuZOc/s1600/cloud.png" 
                alt="Feeds" 
                className="w-5 h-5 object-contain"
                referrerPolicy="no-referrer"
              />
              <h2 className="font-extrabold text-sm tracking-tight text-gray-950 uppercase">Feeds</h2>
            </div>
            <p className="text-[10px] text-gray-500 font-semibold leading-none mt-1">
              Read and share current global headlines instantly
            </p>
          </div>
        </div>

        {/* Filter / Search input */}
        <div className="relative w-48 md:w-64">
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search headlines..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
        </div>
      </header>

      {/* Horizontal categories list */}
      <div className="px-6 py-3 bg-white border-b border-gray-100 flex gap-2 overflow-x-auto shrink-0 scrollbar-none z-10">
        {categories.map((cat) => {
          const isActive = category === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                isActive 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100 scale-[1.02]' 
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* Main content pane */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && (
          <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex-1 h-64 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-gray-500 mt-4">Streaming Google News articles...</p>
            <p className="text-[10px] text-gray-400 mt-1">Formatting real-time feed elements</p>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20 text-gray-400">
            <span className="text-4xl">🗞️</span>
            <p className="text-sm font-black text-gray-500 mt-3">No matching articles found</p>
            <p className="text-xs text-gray-400 mt-1">Try another category or clear your search filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArticles.map((art) => {
              const isBookmarked = bookmarkedIds.includes(art.id);
              return (
                <motion.div
                  key={art.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group"
                >
                  {/* Article cover banner */}
                  <div className="h-44 relative overflow-hidden bg-gray-100 shrink-0">
                    <img 
                      src={art.image} 
                      alt={art.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-widest text-white">
                      {art.source}
                    </div>

                    <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
                      <button
                        onClick={(e) => handleBookmarkToggle(art.id, e)}
                        className={`p-1.5 rounded-lg border backdrop-blur-md transition-all active:scale-90 cursor-pointer ${
                          isBookmarked 
                            ? 'bg-amber-500 border-amber-600 text-white' 
                            : 'bg-black/30 border-white/20 text-white hover:bg-black/50'
                        }`}
                        title={isBookmarked ? "Remove bookmark" : "Save article"}
                      >
                        <Bookmark className="w-3.5 h-3.5 fill-current" />
                      </button>
                      <button
                        onClick={(e) => handleOpenShare(art, e)}
                        className="p-1.5 bg-black/30 hover:bg-black/50 border border-white/20 backdrop-blur-md text-white rounded-lg transition-all active:scale-90 cursor-pointer"
                        title="Share article with community"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Body details */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
                        <Clock className="w-3 h-3" />
                        <span>{art.pubDate ? new Date(art.pubDate).toLocaleDateString() : 'Today'}</span>
                      </div>
                      <h3 
                        onClick={() => setActiveArticle(art)}
                        className="font-extrabold text-sm text-gray-900 group-hover:text-indigo-600 transition-colors mt-2 leading-snug cursor-pointer line-clamp-3"
                      >
                        {art.title}
                      </h3>
                      <p className="text-xs text-gray-500 leading-relaxed mt-2.5 line-clamp-3">
                        {art.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-5 pt-3 border-t border-gray-50 shrink-0">
                      <button
                        onClick={() => setActiveArticle(art)}
                        className="text-xs font-black text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>Read Direct</span>
                        <Compass className="w-3.5 h-3.5" />
                      </button>
                      <a 
                        href={art.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <span>Google News</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reader popup modal */}
      <AnimatePresence>
        {activeArticle && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[999]">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl overflow-hidden w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="h-48 relative overflow-hidden bg-gray-50 shrink-0">
                <img 
                  src={activeArticle.image} 
                  alt={activeArticle.title} 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <button
                    onClick={() => setActiveArticle(null)}
                    className="p-1.5 bg-black/40 text-white rounded-full hover:bg-black/60 backdrop-blur-md cursor-pointer transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>

                <div className="absolute bottom-4 left-4 right-4">
                  <span className="bg-indigo-600 text-white font-extrabold text-[9px] uppercase px-2 py-0.5 rounded">
                    {activeArticle.source}
                  </span>
                  <h3 className="font-extrabold text-white text-base leading-tight mt-1.5 drop-shadow">
                    {activeArticle.title}
                  </h3>
                </div>
              </div>

              {/* Scrollable details */}
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Published on {activeArticle.pubDate ? new Date(activeArticle.pubDate).toLocaleString() : 'N/A'}</span>
                </div>

                <p className="text-gray-800 text-sm leading-relaxed font-medium">
                  {activeArticle.description}
                </p>

                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex gap-3 items-start mt-6">
                  <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-indigo-950">Arcade News Sync Integration</h4>
                    <p className="text-[11px] text-indigo-800 leading-relaxed mt-0.5">
                      You can instantly share this news update directly to the general group board posts to spark discussions!
                    </p>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3 shrink-0">
                <button
                  onClick={(e) => {
                    handleOpenShare(activeArticle, e);
                  }}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs py-2.5 rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Share2 className="w-4 h-4" /> Share with Community
                </button>
                <a
                  href={activeArticle.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Open Full Article</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share to post dialog */}
      <AnimatePresence>
        {showShareModal && shareArticle && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[1000]">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Share2 className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-extrabold text-sm text-gray-950 uppercase">Share as New Post</h3>
                </div>
                <button 
                  onClick={() => {
                    setShowShareModal(false);
                    setShareArticle(null);
                  }}
                  className="p-1 hover:bg-gray-100 rounded-full text-gray-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Info summary */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                <img 
                  src={shareArticle.image} 
                  alt={shareArticle.title} 
                  className="w-12 h-12 object-cover rounded-xl shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] uppercase font-black text-indigo-600 tracking-wider">
                    {shareArticle.source}
                  </span>
                  <h4 className="font-extrabold text-[11px] text-gray-950 truncate mt-0.5 leading-none">
                    {shareArticle.title}
                  </h4>
                </div>
              </div>

              {/* Add comment box */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400">Add custom thoughts:</label>
                <textarea
                  value={shareComment}
                  onChange={(e) => setShareComment(e.target.value)}
                  placeholder="Share your perspective on this headline..."
                  maxLength={250}
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Status messages */}
              {shareSuccess ? (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-xs font-bold flex items-center justify-center gap-1.5">
                  <Check className="w-4 h-4" /> Posted successfully to feed!
                </div>
              ) : (
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleConfirmShareAsPost}
                    disabled={isSharing}
                    className="flex-1 py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-black text-xs rounded-xl shadow-md disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isSharing ? 'Creating post...' : 'Publish to Feed'}
                  </button>
                  <button
                    onClick={() => {
                      setShowShareModal(false);
                      setShareArticle(null);
                    }}
                    className="py-2.5 px-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 font-extrabold text-xs rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
