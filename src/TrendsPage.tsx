import React from 'react';
import { Flame, TrendingUp, Users, MessageSquare, ArrowRight, Sparkles, Bell, BellOff } from 'lucide-react';
import { motion } from 'motion/react';

import UserAvatar from './components/UserAvatar';

interface TrendsPageProps {
  onBack: () => void;
  onNavigate: (nav: string) => void;
  followingState: Record<string, boolean>;
  onToggleFollow: (handle: string) => void;
  onUserSelected: (user: any) => void;
}

export default function TrendsPage({ onBack, onNavigate, followingState, onToggleFollow, onUserSelected }: TrendsPageProps) {
  const [sortBy, setSortBy] = React.useState<'volume' | 'growth'>('volume');
  const [timeframe, setTimeframe] = React.useState<'today' | 'week' | 'all'>('today');

  const [subscribedTrends, setSubscribedTrends] = React.useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('imchat_subscribed_trends');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleSubscribe = (tag: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSubscribedTrends((prev) => {
      const updated = prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : [...prev, tag];
      localStorage.setItem('imchat_subscribed_trends', JSON.stringify(updated));
      return updated;
    });
  };

  const topicsData: Record<'today' | 'week' | 'all', Array<{ tag: string; posts: string; volume: number; category: string; growth: string; growthNum: number }>> = {
    today: [
      { tag: "#AIRevolution", posts: "120k", volume: 120000, category: "Technology", growth: "+95%", growthNum: 95 },
      { tag: "#WordleToday", posts: "72k", volume: 72000, category: "Gaming", growth: "+60%", growthNum: 60 },
      { tag: "#DailyFitness", posts: "34k", volume: 34000, category: "Health", growth: "+25%", growthNum: 25 },
      { tag: "#WorldNews", posts: "80k", volume: 80000, category: "News", growth: "+50%", growthNum: 50 },
      { tag: "#SummerVibes", posts: "45k", volume: 45000, category: "Lifestyle", growth: "+15%", growthNum: 15 },
      { tag: "#BreakfastIdeas", posts: "15k", volume: 15000, category: "Food", growth: "+8%", growthNum: 8 },
    ],
    week: [
      { tag: "#TechTrends2024", posts: "185k", volume: 185000, category: "Technology", growth: "+45%", growthNum: 45 },
      { tag: "#FutureOfAI", posts: "340k", volume: 340000, category: "Science", growth: "+80%", growthNum: 80 },
      { tag: "#TravelGoals", posts: "210k", volume: 210000, category: "Travel", growth: "+22%", growthNum: 22 },
      { tag: "#SummerVibes", posts: "128k", volume: 128000, category: "Lifestyle", growth: "+12%", growthNum: 12 },
      { tag: "#HealthyLiving", posts: "92k", volume: 92000, category: "Health", growth: "+18%", growthNum: 18 },
      { tag: "#IMChatCommunity", posts: "42k", volume: 42000, category: "Social", growth: "+5%", growthNum: 5 },
    ],
    all: [
      { tag: "#FirstPost", posts: "2.4M", volume: 2400000, category: "History", growth: "+1%", growthNum: 1 },
      { tag: "#FutureOfAI", posts: "1.8M", volume: 1800000, category: "Science", growth: "+40%", growthNum: 40 },
      { tag: "#TechTrends2024", posts: "1.2M", volume: 1200000, category: "Technology", growth: "+15%", growthNum: 15 },
      { tag: "#TravelGoals", posts: "950k", volume: 950000, category: "Travel", growth: "+8%", growthNum: 8 },
      { tag: "#SummerVibes", posts: "850k", volume: 850000, category: "Lifestyle", growth: "+5%", growthNum: 5 },
      { tag: "#HealthyLiving", posts: "720k", volume: 720000, category: "Health", growth: "+12%", growthNum: 12 },
    ]
  };

  const sortedTopics = React.useMemo(() => {
    const currentTopics = topicsData[timeframe];
    return [...currentTopics].sort((a, b) => {
      if (sortBy === 'volume') {
        return b.volume - a.volume;
      }
      return b.growthNum - a.growthNum;
    });
  }, [timeframe, sortBy]);

  const featuredUsers = [
    { id: "sylvia_d", name: "Sylvia del Bosque", handle: "@sylvia_d", avatar: "" },
    { id: "lolasky", name: "LolaSky", handle: "@lolasky", avatar: "" },
    { id: "sean_surf", name: "Sean", handle: "@sean_surf", avatar: "" },
  ];

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
      <div className="bg-brand-blue p-4 flex items-center gap-3 sticky top-0 z-10 shadow-md">
        <button onClick={onBack} className="text-white hover:bg-white/10 p-1 rounded-full transition-colors">
          <TrendingUp className="w-6 h-6" />
        </button>
        <h1 className="text-white font-bold text-xl flex items-center gap-2">
          <Flame className="w-6 h-6 text-orange-400 fill-orange-400" />
          Trends
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-orange-400 to-rose-500 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-2xl font-black mb-1">What's Hot?</h2>
            <p className="text-white/80 text-sm font-medium">Discover the most talked about topics in your network right now.</p>
          </div>
          <Flame className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10 rotate-12" />
        </div>

        {/* Subscribed Trend Alerts Section */}
        {subscribedTrends.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100/60 p-4 rounded-2xl"
          >
            <div className="flex items-center gap-2 mb-2">
              <Bell className="w-4 h-4 text-brand-blue animate-pulse" />
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Active Trend Alerts</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {subscribedTrends.map((tag) => (
                <span 
                  key={tag}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-white text-brand-blue border border-blue-200/50 rounded-full text-xs font-bold shadow-sm"
                >
                  <span>{tag}</span>
                  <button 
                    onClick={(e) => toggleSubscribe(tag, e)}
                    className="p-0.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-red-500 transition-colors"
                    title="Unsubscribe"
                  >
                    <BellOff className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Trending List */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 px-2">
            <h3 className="font-bold text-gray-900 border-l-4 border-brand-blue pl-3">Top Hashtags</h3>
            
            {/* Sort Toggle Controls */}
            <div className="flex items-center bg-gray-100 rounded-xl p-0.5 border border-gray-200">
              <button 
                id="btn-sort-volume"
                onClick={() => setSortBy('volume')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  sortBy === 'volume' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                📊 Sort by Volume
              </button>
              <button 
                id="btn-sort-growth"
                onClick={() => setSortBy('growth')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  sortBy === 'growth' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                ⚡ Sort by Growth
              </button>
            </div>
          </div>

          {/* Timeframe Categories Filter */}
          <div className="flex gap-2 mb-4 px-2 overflow-x-auto pb-1 no-scrollbar">
            {(['today', 'week', 'all'] as const).map((t) => {
              const label = t === 'today' ? '📅 Today' : t === 'week' ? '🗓️ This Week' : '🌎 All Time';
              const isSelected = timeframe === t;
              return (
                <button
                  key={t}
                  id={`trend-filter-${t}`}
                  onClick={() => setTimeframe(t)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 whitespace-nowrap border ${
                    isSelected
                      ? 'bg-brand-blue text-white border-brand-blue shadow-sm'
                      : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200 hover:text-gray-900'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="space-y-1">
            {sortedTopics.map((topic, idx) => {
              const isTop3 = idx < 3;
              const isSubscribed = subscribedTrends.includes(topic.tag);
              return (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={topic.tag} 
                  className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition-colors cursor-pointer group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-gray-450 uppercase tracking-tighter">{topic.category}</span>
                      {isTop3 && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black bg-gradient-to-r from-orange-400 to-rose-500 text-white animate-pulse tracking-wide uppercase shadow-sm">
                          ⚡ Trending Now
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-gray-900 group-hover:text-brand-blue transition-colors flex items-center gap-1.5 truncate">
                      <span className="text-brand-blue text-sm font-black font-mono">#{idx + 1}</span>
                      <span className="truncate">{topic.tag}</span>
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5 font-medium">{topic.posts} posts</p>
                  </div>
                  <div className="flex items-center gap-4 pl-2">
                    <div className="text-right">
                      <span className="text-sm font-black text-green-500">{topic.growth}</span>
                      <p className="text-[10px] text-gray-400 font-medium">Growth</p>
                    </div>
                    
                    <button
                      id={`subscribe-btn-${topic.tag.replace('#', '')}`}
                      onClick={(e) => toggleSubscribe(topic.tag, e)}
                      className={`p-2 rounded-xl border transition-all duration-200 ${
                        isSubscribed
                          ? 'bg-blue-50 text-brand-blue border-blue-200/60 hover:bg-red-50 hover:text-red-500 hover:border-red-200'
                          : 'bg-gray-50 text-gray-450 border-gray-200 hover:bg-blue-50 hover:text-brand-blue hover:border-blue-200'
                      }`}
                      title={isSubscribed ? `Unsubscribe from ${topic.tag} alerts` : `Subscribe to ${topic.tag} alerts`}
                    >
                      {isSubscribed ? <Bell className="w-4 h-4 fill-brand-blue text-brand-blue" /> : <BellOff className="w-4 h-4" />}
                    </button>

                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-brand-blue transition-all group-hover:translate-x-1" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Rising Stars */}
        <section className="bg-gray-50 -mx-4 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            <h3 className="font-bold text-gray-900">Rising Stars</h3>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
            {featuredUsers.map((user) => (
              <div 
                key={user.handle} 
                className="flex-shrink-0 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 w-32 text-center"
              >
                <div className="cursor-pointer group" onClick={() => onUserSelected({ id: user.id, name: user.name, avatar: user.avatar })}>
                  <UserAvatar 
                    src={user.avatar} 
                    name={user.name} 
                    size="lg"
                    className="mx-auto mb-3 border-2 border-brand-blue p-0.5 group-hover:scale-105 transition-transform"
                  />
                  <h5 className="text-xs font-bold text-gray-900 truncate group-hover:text-brand-blue transition-colors">{user.name}</h5>
                </div>
                <p className="text-[10px] text-gray-500 truncate mb-3">{user.handle}</p>
                <button 
                  onClick={() => onToggleFollow(user.id)}
                  className={`${followingState[user.id] ? 'bg-gradient-to-r from-[#7e22ce] to-[#9333ea] text-white shadow-purple-200/20' : 'bg-brand-blue text-white'} text-[10px] font-bold px-3 py-1 rounded-full w-full transition-all active:scale-95`}
                >
                  {followingState[user.id] ? 'Following' : 'Follow'}
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
