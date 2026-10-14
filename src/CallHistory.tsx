import React, { useState, useEffect } from 'react';
import { 
  Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, 
  Trash2, Search, Info, ArrowLeft,
  Clock, Users, Loader2, Star, MessageSquare, UserPlus, Activity
} from 'lucide-react';
import { motion } from 'motion/react';
import { CallStore, CallLog, CallStatus } from './lib/CallStore';
import UserAvatar from './components/UserAvatar';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { FavouriteContactsStore } from './lib/FavouriteContactsStore';

interface ContactUser {
  id: string;
  name: string;
  username?: string;
  email?: string;
  avatar?: string;
  phone?: string;
}

interface CallHistoryProps {
  onBack?: () => void;
  onInitCall?: (userId: string, userName: string, userAvatar: string, type: 'audio' | 'video') => void;
  onVisitProfile?: (user: { id: string, name: string, avatar: string }) => void;
}

export default function CallHistory({ onBack, onInitCall, onVisitProfile }: CallHistoryProps) {
  const [logs, setLogs] = useState<CallLog[]>(CallStore.getLogs());
  const [filter, setFilter] = useState<'all' | 'missed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSegment, setActiveSegment] = useState<'recent' | 'favourites' | 'contacts'>('recent');
  
  // Contacts system state
  const [contacts, setContacts] = useState<ContactUser[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);

  // Favourite Contacts state
  const [favouriteIds, setFavouriteIds] = useState<string[]>(FavouriteContactsStore.getFavourites());

  useEffect(() => {
    return CallStore.subscribe(() => {
      setLogs(CallStore.getLogs());
    });
  }, []);

  useEffect(() => {
    return FavouriteContactsStore.subscribe(() => {
      setFavouriteIds(FavouriteContactsStore.getFavourites());
    });
  }, []);

  // Fetch all users as contacts from firestore
  useEffect(() => {
    const unsubscribeSnap = onSnapshot(collection(db, "users"), (snapshot) => {
      const usersData: ContactUser[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        usersData.push({ id: doc.id, ...data } as ContactUser);
      });
      setContacts(usersData);
      setContactsLoading(false);
    }, (error) => {
      console.error("Failed to load contacts:", error);
      setContactsLoading(false);
    });
    return unsubscribeSnap;
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesFilter = filter === 'all' || log.status === 'missed';
    const matchesSearch = log.userName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const filteredContacts = contacts.filter(c => {
    const nameMatch = (c.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const userMatch = (c.username || '').toLowerCase().includes(searchQuery.toLowerCase());
    const phoneMatch = (c.phone || '').includes(searchQuery);
    return nameMatch || userMatch || phoneMatch;
  });

  const favouriteContactsList = contacts.filter(c => favouriteIds.includes(c.id) || favouriteIds.includes(c.name)).filter(c => {
    const nameMatch = (c.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const userMatch = (c.username || '').toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch || userMatch;
  });

  const getStatusIcon = (status: CallStatus) => {
    switch (status) {
      case 'incoming': return <PhoneIncoming className="w-3.5 h-3.5 text-blue-500" />;
      case 'outgoing': return <PhoneOutgoing className="w-3.5 h-3.5 text-green-500" />;
      case 'missed': return <PhoneMissed className="w-3.5 h-3.5 text-red-500" />;
      case 'rejected': return <PhoneMissed className="w-3.5 h-3.5 text-orange-500" />;
      default: return null;
    }
  };

  const getStatusText = (log: CallLog) => {
    const time = log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = log.timestamp.toLocaleDateString();
    const isToday = new Date().toLocaleDateString() === date;

    return `${isToday ? 'Today' : date}, ${time}`;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const toggleFavouriteContact = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    FavouriteContactsStore.toggleFavourite(id);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <header className="px-4 py-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-1 -ml-1 rounded-full hover:bg-gray-100 active:scale-95 transition-all text-gray-700">
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}
          <h1 className="text-xl font-bold bg-gradient-to-r from-brand-blue via-purple-600 to-amber-500 bg-clip-text text-transparent italic">
            Calls & Favourites
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (onInitCall) {
                onInitCall(
                  'echo_test_bot',
                  'Echo & Call Quality Test',
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
                  'video'
                );
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 hover:bg-blue-100 text-brand-blue text-xs font-bold transition-all border border-blue-200/60 shadow-xs cursor-pointer active:scale-95"
            title="Test Audio and Video calls with Echo Bot"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Test Call</span>
          </button>
          {activeSegment === 'recent' && (
            <button 
              onClick={() => {
                if (confirm('Clear all call history?')) CallStore.clearLogs();
              }}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors cursor-pointer"
              title="Clear Call History"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* 3-Way Segment Selector Toggle */}
      <div className="px-3 py-2 border-b border-gray-50 flex items-center justify-center bg-white">
        <div className="flex bg-gray-100/90 rounded-xl p-1 w-full max-w-md shadow-inner">
          <button 
            onClick={() => { setActiveSegment('recent'); setSearchQuery(''); }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeSegment === 'recent' ? 'bg-white shadow-sm text-brand-blue font-extrabold' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Recents
          </button>

          <button 
            onClick={() => { setActiveSegment('favourites'); setSearchQuery(''); }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 relative ${
              activeSegment === 'favourites' ? 'bg-amber-50 shadow-sm text-amber-700 border border-amber-200/60 font-extrabold' : 'text-gray-500 hover:text-amber-600'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${activeSegment === 'favourites' ? 'fill-amber-500 text-amber-500' : 'text-amber-500'}`} />
            <span>Favourites</span>
            {favouriteIds.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-black">
                {favouriteIds.length}
              </span>
            )}
          </button>

          <button 
            onClick={() => { setActiveSegment('contacts'); setSearchQuery(''); }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeSegment === 'contacts' ? 'bg-white shadow-sm text-brand-blue font-extrabold' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            All Contacts
          </button>
        </div>
      </div>

      {/* Quick Dial Favourite Bar on 'Recents' tab */}
      {activeSegment === 'recent' && favouriteContactsList.length > 0 && (
        <div className="px-4 py-2.5 bg-gradient-to-r from-amber-50/50 via-purple-50/30 to-blue-50/50 border-b border-amber-100/60">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1">
              <Star className="w-3 h-3 fill-amber-400 text-amber-500" /> Quick Dial Favourites
            </span>
            <button 
              onClick={() => setActiveSegment('favourites')}
              className="text-[10px] font-bold text-amber-700 hover:underline"
            >
              View All ({favouriteContactsList.length}) →
            </button>
          </div>

          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
            {favouriteContactsList.map((fav) => (
              <div 
                key={fav.id}
                onClick={() => onInitCall?.(fav.id, fav.name, fav.avatar || '', 'audio')}
                className="flex flex-col items-center shrink-0 cursor-pointer group active:scale-95 transition-transform"
                title={`Call ${fav.name}`}
              >
                <div className="relative">
                  <UserAvatar src={fav.avatar} name={fav.name} size="md" className="ring-2 ring-amber-400/80 shadow-md" />
                  <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white p-0.5 rounded-full shadow-sm">
                    <Phone className="w-2.5 h-2.5 fill-current" />
                  </div>
                </div>
                <span className="text-[10px] font-bold text-gray-800 truncate max-w-[60px] mt-1 group-hover:text-amber-600">
                  {(fav.name || 'Contact').split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs / Filter (Recent mode only) */}
      {activeSegment === 'recent' && (
        <div className="px-4 py-2 border-b border-gray-50 flex items-center gap-2">
          <div className="flex-1 flex bg-gray-100 rounded-lg p-1">
            <button 
              onClick={() => setFilter('all')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${filter === 'all' ? 'bg-white shadow-sm text-brand-blue' : 'text-gray-500'}`}
            >
              All Calls
            </button>
            <button 
              onClick={() => setFilter('missed')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${filter === 'missed' ? 'bg-white shadow-sm text-red-500' : 'text-gray-500'}`}
            >
              Missed
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="px-4 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder={
              activeSegment === 'recent' 
                ? "Search recent calls..." 
                : activeSegment === 'favourites' 
                  ? "Search favourite contacts..." 
                  : "Search contacts (name, username or phone)..."
            } 
            className="w-full bg-gray-50 rounded-xl py-2 pl-10 pr-4 text-sm border-none focus:ring-2 focus:ring-brand-blue/20 transition-all font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Main Content List */}
      <div className="flex-1 overflow-y-auto pb-20">
        <div className="flex flex-col">

          {/* RECENT CALLS VIEW */}
          {activeSegment === 'recent' && (
            filteredLogs.length > 0 ? (
              filteredLogs.map((log) => {
                const isFav = favouriteIds.includes(log.userId) || favouriteIds.includes(log.userName);

                return (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={log.id} 
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer group border-b border-gray-50/50"
                  >
                    <div className="relative shrink-0">
                      <div className="cursor-pointer" onClick={() => onVisitProfile?.({ id: log.userId, name: log.userName, avatar: log.userAvatar || '' })}>
                        <UserAvatar 
                          src={log.userAvatar} 
                          name={log.userName}
                          size="lg"
                          className="border border-gray-100 shadow-sm" 
                        />
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onInitCall?.(log.userId, log.userName, log.userAvatar || '', log.type);
                        }}
                        className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full shadow-md border border-gray-100 active:scale-90 transition-all z-20 hover:bg-blue-50"
                      >
                        {log.type === 'video' ? (
                          <Video className="w-3.5 h-3.5 text-brand-blue fill-brand-blue/10" />
                        ) : (
                          <Phone className="w-3.5 h-3.5 text-brand-blue fill-brand-blue/10" />
                        )}
                      </button>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div 
                        className="flex items-center gap-1.5 mb-0.5 cursor-pointer group/name"
                        onClick={() => onVisitProfile?.({ id: log.userId, name: log.userName, avatar: log.userAvatar || '' })}
                      >
                        <h3 className={`font-bold truncate group-hover/name:text-brand-blue transition-colors ${log.status === 'missed' ? 'text-red-500' : 'text-gray-900'}`}>
                          {log.userName}
                        </h3>
                        {isFav && (
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {getStatusIcon(log.status)}
                        <span className="text-[12px] text-gray-500 font-medium tracking-tight">
                          {getStatusText(log)}
                        </span>
                        {log.duration && log.duration > 0 && (
                          <span className="text-[11px] text-gray-400">
                            • {formatDuration(log.duration)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Favourite toggle star button */}
                      <button
                        onClick={(e) => toggleFavouriteContact(e, log.userId)}
                        className={`p-2 rounded-full transition-all cursor-pointer ${
                          isFav ? 'bg-amber-50 text-amber-500' : 'text-gray-300 hover:text-amber-400 hover:bg-gray-100'
                        }`}
                        title={isFav ? "Remove from Favourite Contacts" : "Add to Favourite Contacts"}
                      >
                        <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>

                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onInitCall?.(log.userId, log.userName, log.userAvatar || '', log.type);
                        }}
                        className="p-2.5 rounded-full bg-gray-50 text-brand-blue hover:bg-brand-blue/10 active:scale-90 transition-all shadow-sm border border-gray-100 cursor-pointer"
                        title="Call Back"
                      >
                        {log.type === 'video' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                      </button>
                      
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onVisitProfile?.({ id: log.userId, name: log.userName, avatar: log.userAvatar || '' });
                        }}
                        className="p-2 rounded-full text-gray-400 hover:bg-gray-100 cursor-pointer"
                        title="View Profile"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center text-gray-400">
                <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                  <Phone className="w-8 h-8 opacity-20" />
                </div>
                <p className="text-sm font-medium">No call logs found</p>
                {searchQuery && <p className="text-xs mt-1">Try a different search term</p>}
              </div>
            )
          )}

          {/* FAVOURITE CONTACTS LIST VIEW */}
          {activeSegment === 'favourites' && (
            contactsLoading ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
                <p className="text-sm">Loading favourite contacts...</p>
              </div>
            ) : favouriteContactsList.length > 0 ? (
              <div className="divide-y divide-gray-50">
                <div className="px-4 py-2 bg-amber-50/60 border-b border-amber-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                    Favourite Contacts ({favouriteContactsList.length})
                  </span>
                  <span className="text-[11px] text-amber-700/80 font-medium">Quick access list</span>
                </div>

                {favouriteContactsList.map((contact) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={contact.id} 
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-amber-50/20 transition-colors cursor-pointer group"
                  >
                    <div 
                      className="cursor-pointer shrink-0 relative"
                      onClick={() => onVisitProfile?.({ id: contact.id, name: contact.name, avatar: contact.avatar || '' })}
                    >
                      <UserAvatar 
                        src={contact.avatar} 
                        name={contact.name}
                        size="lg"
                        className="ring-2 ring-amber-400/70 shadow-sm" 
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div 
                        className="flex flex-col cursor-pointer"
                        onClick={() => onVisitProfile?.({ id: contact.id, name: contact.name, avatar: contact.avatar || '' })}
                      >
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-gray-900 truncate hover:text-amber-600 transition-colors">
                            {contact.name}
                          </h3>
                        </div>
                        <span className="text-xs text-gray-500 font-medium truncate">
                          @{contact.username || contact.id.substring(0, 8)} {contact.phone && `• ${contact.phone}`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onInitCall?.(contact.id, contact.name, contact.avatar || '', 'audio');
                        }}
                        className="p-2.5 rounded-full bg-blue-50 text-brand-blue hover:bg-brand-blue hover:text-white active:scale-90 transition-all shadow-sm cursor-pointer"
                        title="Voice Call"
                      >
                        <Phone className="w-4 h-4" />
                      </button>

                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onInitCall?.(contact.id, contact.name, contact.avatar || '', 'video');
                        }}
                        className="p-2.5 rounded-full bg-teal-50 text-teal-600 hover:bg-teal-600 hover:text-white active:scale-90 transition-all shadow-sm cursor-pointer"
                        title="Video Call"
                      >
                        <Video className="w-4 h-4" />
                      </button>

                      <button 
                        onClick={(e) => toggleFavouriteContact(e, contact.id)}
                        className="p-2 rounded-full text-amber-500 hover:bg-amber-100/60 active:scale-90 transition-all cursor-pointer"
                        title="Remove from Favourites"
                      >
                        <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center text-gray-400">
                <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center mb-4 text-amber-400">
                  <Star className="w-8 h-8 fill-amber-300 opacity-60" />
                </div>
                <h3 className="text-base font-bold text-gray-800 mb-1">No Favourite Contacts Yet</h3>
                <p className="text-xs text-gray-500 max-w-xs mb-4">
                  Star your favorite friends or team members from the Contacts list to access them instantly here.
                </p>
                <button
                  onClick={() => setActiveSegment('contacts')}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-brand-blue text-white rounded-xl font-bold text-xs shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  Explore Contacts
                </button>
              </div>
            )
          )}

          {/* ALL CONTACTS VIEW */}
          {activeSegment === 'contacts' && (
            contactsLoading ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin text-brand-blue mb-2" />
                <p className="text-sm">Loading contacts...</p>
              </div>
            ) : filteredContacts.length > 0 ? (
              filteredContacts.map((contact) => {
                const isFav = favouriteIds.includes(contact.id) || favouriteIds.includes(contact.name);

                return (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={contact.id} 
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer group border-b border-gray-50/50"
                  >
                    <div 
                      className="cursor-pointer shrink-0"
                      onClick={() => onVisitProfile?.({ id: contact.id, name: contact.name, avatar: contact.avatar || '' })}
                    >
                      <UserAvatar 
                        src={contact.avatar} 
                        name={contact.name}
                        size="lg"
                        className="border border-gray-100 shadow-sm" 
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div 
                        className="flex flex-col cursor-pointer"
                        onClick={() => onVisitProfile?.({ id: contact.id, name: contact.name, avatar: contact.avatar || '' })}
                      >
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-gray-900 truncate hover:text-brand-blue transition-colors">
                            {contact.name}
                          </h3>
                          {isFav && (
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                          )}
                        </div>
                        <span className="text-xs text-gray-500 font-medium truncate">
                          @{contact.username || contact.id.substring(0, 8)} {contact.phone && `• ${contact.phone}`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Favourite toggle star button */}
                      <button
                        onClick={(e) => toggleFavouriteContact(e, contact.id)}
                        className={`p-2 rounded-full transition-all cursor-pointer ${
                          isFav ? 'bg-amber-50 text-amber-500' : 'text-gray-300 hover:text-amber-400 hover:bg-gray-100'
                        }`}
                        title={isFav ? "Remove from Favourite Contacts" : "Add to Favourite Contacts"}
                      >
                        <Star className={`w-5 h-5 ${isFav ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>

                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onInitCall?.(contact.id, contact.name, contact.avatar || '', 'audio');
                        }}
                        className="p-2.5 rounded-full bg-blue-50 text-brand-blue hover:bg-brand-blue hover:text-white active:scale-90 transition-all shadow-sm cursor-pointer"
                        title="Start Voice Call"
                      >
                        <Phone className="w-4 h-4" />
                      </button>

                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onInitCall?.(contact.id, contact.name, contact.avatar || '', 'video');
                        }}
                        className="p-2.5 rounded-full bg-teal-50 text-teal-600 hover:bg-teal-600 hover:text-white active:scale-90 transition-all shadow-sm cursor-pointer"
                        title="Start Video Call"
                      >
                        <Video className="w-4 h-4" />
                      </button>

                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onVisitProfile?.({ id: contact.id, name: contact.name, avatar: contact.avatar || '' });
                        }}
                        className="p-2 rounded-full text-gray-400 hover:bg-gray-100 cursor-pointer"
                        title="View Profile"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center text-gray-400">
                <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 opacity-20" />
                </div>
                <p className="text-sm font-medium">No contacts found</p>
                {searchQuery && <p className="text-xs mt-1">Try a different search term</p>}
              </div>
            )
          )}

        </div>
      </div>
    </div>
  );
}
