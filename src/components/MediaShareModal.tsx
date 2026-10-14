import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Send, MessageCircle, Share2, Copy, Check, Sparkles, 
  PlaySquare, FolderPlus, Users, Search, Loader2, Globe, Heart, ShieldCheck 
} from 'lucide-react';
import { MediaItem, MediaStore } from '../lib/MediaStorage';
import { PostStore } from '../lib/PostStore';
import { ReelStore } from '../lib/ReelStore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, limit, getDocs, doc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import UserAvatar from './UserAvatar';

interface MediaShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  media: MediaItem | null;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar?: string;
  isFollowedContent?: boolean;
  onNavigate?: (nav: string) => void;
  onShareSuccess?: (target: string) => void;
}

export default function MediaShareModal({
  isOpen,
  onClose,
  media,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  isFollowedContent = false,
  onNavigate,
  onShareSuccess
}: MediaShareModalProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'feed' | 'reel' | 'storage'>('chat');
  const [shareNote, setShareNote] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [searchContact, setSearchContact] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setShareNote('');
      setCopiedLink(false);
      setSentSuccess(null);
      setSelectedContacts([]);
      
      // Load contacts / followed users to share with
      const loadContacts = async () => {
        try {
          const q = query(collection(db, 'users'), limit(25));
          const snap = await getDocs(q);
          const usersList = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as any))
            .filter(u => u.id !== currentUserId);
          setContacts(usersList);
        } catch (err) {
          console.warn("Error loading share contacts:", err);
        }
      };
      loadContacts();
    }
  }, [isOpen, currentUserId]);

  if (!isOpen || !media) return null;

  const isOwner = media.userId === currentUserId;
  const creatorName = media.userName || (isOwner ? currentUserName : 'Creator');
  const creatorAvatar = media.userAvatar || (isOwner ? currentUserAvatar : '');

  const handleCopyLink = () => {
    navigator.clipboard.writeText(media.url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShareToChat = async () => {
    if (selectedContacts.length === 0) {
      alert("Please select at least one contact or group to send this media to.");
      return;
    }

    setIsSending(true);
    try {
      for (const recipientId of selectedContacts) {
        const contact = contacts.find(c => c.id === recipientId);
        const recipientName = contact?.name || contact?.username || 'User';
        const recipientAvatar = contact?.avatar || contact?.photoURL || '';

        const chatId = `c_${recipientId}`;
        const newMsgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        const messagePayload = {
          id: newMsgId,
          senderId: currentUserId,
          text: shareNote || (isOwner ? `Shared a media file from my storage` : `Shared @${creatorName}'s media from storage`),
          timestamp: Date.now(),
          isRead: false,
          media: {
            url: media.url,
            name: `${creatorName}'s media`,
            type: media.type === 'video' ? 'video' : 'image',
            thumbnailUrl: media.thumbnailUrl || media.url
          }
        };

        // Write directly into Firestore chat message collection
        try {
          const chatDocRef = doc(db, 'chats', chatId);
          await setDoc(chatDocRef, {
            id: chatId,
            isGroup: false,
            name: recipientName,
            avatar: recipientAvatar,
            presence: 'online',
            participants: [recipientId, currentUserId],
            lastMessage: messagePayload.text,
            updatedAt: serverTimestamp()
          }, { merge: true });

          await addDoc(collection(db, 'chats', chatId, 'messages'), messagePayload);
        } catch (chatErr) {
          console.warn("Direct firestore chat write:", chatErr);
        }
      }

      await MediaStore.incrementSharesCount(media.id);
      setSentSuccess("Sent to selected chats!");
      setTimeout(() => {
        setSentSuccess(null);
        onClose();
      }, 1500);
    } catch (err) {
      console.error("Error sharing to chats:", err);
      alert("Failed to share to chats.");
    } finally {
      setIsSending(false);
    }
  };

  const handleShareToFeed = async () => {
    setIsSending(true);
    try {
      const captionText = shareNote 
        ? `${shareNote}\n\n(Shared from @${creatorName}'s Media Storage)`
        : `Shared from @${creatorName}'s Media Storage`;

      await PostStore.addPost({
        userId: currentUserId,
        user: {
          name: currentUserName || 'User',
          avatar: currentUserAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          location: 'IMChat Media Hub'
        },
        image: media.url,
        mediaUrl: media.url,
        mediaType: media.type,
        caption: captionText
      });

      await MediaStore.incrementSharesCount(media.id);
      setSentSuccess("Published to your Feed!");
      setTimeout(() => {
        setSentSuccess(null);
        onClose();
        onNavigate?.('home');
      }, 1500);
    } catch (err: any) {
      console.error("Error sharing to feed:", err);
      alert(err.message || "Failed to share to feed.");
    } finally {
      setIsSending(false);
    }
  };

  const handleShareToReels = async () => {
    if (media.type !== 'video') return;
    setIsSending(true);
    try {
      await ReelStore.addReel({
        videoUrl: media.url,
        thumbnailUrl: media.thumbnailUrl || media.url,
        user: currentUserName || 'User',
        userAvatar: currentUserAvatar,
        description: shareNote ? `${shareNote} (Shared from @${creatorName})` : `Shared reel from @${creatorName}`,
        music: 'Original Audio',
        userId: currentUserId
      });

      await MediaStore.incrementSharesCount(media.id);
      setSentSuccess("Reel posted successfully!");
      onShareSuccess?.('Reels');
      setTimeout(() => {
        setSentSuccess(null);
        onClose();
        onNavigate?.('reels');
      }, 1500);
    } catch (err) {
      console.error("Error sharing to reels:", err);
      alert("Failed to post reel.");
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveToMyStorage = async () => {
    setIsSending(true);
    try {
      const res = await MediaStore.addMedia({
        url: media.url,
        thumbnailUrl: media.thumbnailUrl || media.url,
        type: media.type,
        sizeBytes: media.sizeBytes || 1024000,
        userId: currentUserId,
        privacy: 'public',
        caption: `Saved from @${creatorName}`,
        sharedFrom: {
          originalMediaId: media.id,
          originalUserId: media.userId,
          originalUserName: creatorName,
          originalUserAvatar: creatorAvatar
        }
      });

      if (res.success) {
        await MediaStore.incrementSharesCount(media.id);
        setSentSuccess("Saved to your Media Storage!");
        setTimeout(() => {
          setSentSuccess(null);
          onClose();
        }, 1500);
      } else {
        alert(res.message || "Could not save to storage.");
      }
    } catch (err) {
      console.error("Save to storage error:", err);
      alert("Failed to save media to storage.");
    } finally {
      setIsSending(false);
    }
  };

  const toggleContactSelection = (id: string) => {
    setSelectedContacts(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const filteredContacts = contacts.filter(c => 
    (c.name || c.username || '').toLowerCase().includes(searchContact.toLowerCase())
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]"
        >
          {/* Top Bar */}
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 shadow-sm">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-gray-900 text-base">Share Content</h3>
                <p className="text-[11px] text-gray-500 font-medium">Share media from storage across IMChat</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Media & Creator Card */}
          <div className="p-4 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-200 shrink-0 border border-gray-200 shadow-sm">
                {media.type === 'image' ? (
                  <img src={media.thumbnailUrl || media.url} alt="Media" className="w-full h-full object-cover" />
                ) : (
                  <video src={media.url} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <UserAvatar
                    src={creatorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                    size="sm"
                  />
                  <span className="text-xs font-bold text-gray-800 truncate">@{creatorName}</span>
                  {!isOwner && (
                    <span className="text-[10px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded-full">
                      Followed
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                  {media.caption || `${media.type === 'video' ? 'Video' : 'Photo'} from Media Storage`}
                </p>
              </div>
            </div>

            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-sm transition-all active:scale-95"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-gray-500" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>

          {/* Share Destination Tabs */}
          <div className="flex border-b border-gray-100 bg-white px-3 pt-2 gap-1 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-2.5 px-3 text-xs font-extrabold flex items-center justify-center gap-1.5 border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'chat'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              <span>Direct / Group Chat</span>
            </button>

            <button
              onClick={() => setActiveTab('feed')}
              className={`flex-1 py-2.5 px-3 text-xs font-extrabold flex items-center justify-center gap-1.5 border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'feed'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Share2 className="w-4 h-4" />
              <span>Share to Feed</span>
            </button>

            {media.type === 'video' && (
              <button
                onClick={() => setActiveTab('reel')}
                className={`flex-1 py-2.5 px-3 text-xs font-extrabold flex items-center justify-center gap-1.5 border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'reel'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <PlaySquare className="w-4 h-4" />
                <span>Share to Reels</span>
              </button>
            )}

            {!isOwner && (
              <button
                onClick={() => setActiveTab('storage')}
                className={`flex-1 py-2.5 px-3 text-xs font-extrabold flex items-center justify-center gap-1.5 border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'storage'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <FolderPlus className="w-4 h-4" />
                <span>Save to My Storage</span>
              </button>
            )}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Direct Chat Sharing Tab */}
            {activeTab === 'chat' && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search followed people and contacts..."
                    value={searchContact}
                    onChange={e => setSearchContact(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-purple-500 transition-colors"
                  />
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    Select Contacts ({selectedContacts.length} selected)
                  </p>
                  {filteredContacts.length === 0 ? (
                    <div className="p-6 text-center text-gray-400 text-xs font-medium">
                      No contacts found
                    </div>
                  ) : (
                    filteredContacts.map(contact => {
                      const isSelected = selectedContacts.includes(contact.id);
                      return (
                        <div
                          key={contact.id}
                          onClick={() => toggleContactSelection(contact.id)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-purple-500 bg-purple-50/50 shadow-sm'
                              : 'border-gray-100 hover:border-gray-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <UserAvatar
                              src={contact.avatar || contact.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-gray-900 truncate">
                                {contact.name || contact.username || 'User'}
                              </p>
                              <p className="text-[10px] text-gray-400 truncate">@{contact.username || 'user'}</p>
                            </div>
                          </div>

                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                              isSelected ? 'bg-purple-600 text-white' : 'border border-gray-300'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-600">Add a message note (optional)</label>
                  <textarea
                    value={shareNote}
                    onChange={e => setShareNote(e.target.value)}
                    placeholder="Type a friendly message to send along with this media..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs outline-none focus:border-purple-500 resize-none h-16 transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Share to Feed Tab */}
            {activeTab === 'feed' && (
              <div className="space-y-3">
                <div className="p-3 bg-purple-50/60 rounded-2xl border border-purple-100 text-xs text-purple-900 leading-relaxed">
                  <p className="font-bold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    Publish to Public Social Feed
                  </p>
                  <p className="text-[11px] text-purple-700 mt-1">
                    This media will be posted to the feed with attribution credit to @{creatorName}.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-600">Caption / Description</label>
                  <textarea
                    value={shareNote}
                    onChange={e => setShareNote(e.target.value)}
                    placeholder={`Write what you think about this content from @${creatorName}...`}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-3 text-xs outline-none focus:border-purple-500 resize-none h-24 transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Share to Reels Tab */}
            {activeTab === 'reel' && media.type === 'video' && (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 text-xs text-blue-900 leading-relaxed">
                  <p className="font-bold flex items-center gap-1.5">
                    <PlaySquare className="w-4 h-4 text-brand-blue" />
                    Share as a Video Reel
                  </p>
                  <p className="text-[11px] text-blue-700 mt-1">
                    Showcase this video in the Reels section with full sound and creator credit.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-600">Reel Description</label>
                  <textarea
                    value={shareNote}
                    onChange={e => setShareNote(e.target.value)}
                    placeholder="Describe this reel..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-3 text-xs outline-none focus:border-blue-500 resize-none h-24 transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Save to My Storage Tab */}
            {activeTab === 'storage' && !isOwner && (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-xs text-emerald-950 leading-relaxed">
                  <p className="font-bold flex items-center gap-1.5 text-emerald-800">
                    <FolderPlus className="w-4 h-4 text-emerald-600" />
                    Add Followed Content to Your Storage
                  </p>
                  <p className="text-[11px] text-emerald-700 mt-1.5">
                    Collect this item directly into your personal Media Storage library. The original creator credit (@{creatorName}) will remain permanently attached to this file.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="p-5 border-t border-gray-100 bg-gray-50 flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isSending}
              className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-200/60 bg-gray-200/40 transition-colors"
            >
              Cancel
            </button>

            {activeTab === 'chat' && (
              <button
                onClick={handleShareToChat}
                disabled={isSending || selectedContacts.length === 0}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-extrabold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 active:scale-95 shadow-md shadow-purple-200 transition-all flex items-center justify-center gap-2"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : sentSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{sentSuccess}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send to Chats ({selectedContacts.length})</span>
                  </>
                )}
              </button>
            )}

            {activeTab === 'feed' && (
              <button
                onClick={handleShareToFeed}
                disabled={isSending}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-extrabold text-white bg-purple-600 hover:bg-purple-700 active:scale-95 shadow-md shadow-purple-200 transition-all flex items-center justify-center gap-2"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Publishing...</span>
                  </>
                ) : sentSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{sentSuccess}</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span>Post to Feed</span>
                  </>
                )}
              </button>
            )}

            {activeTab === 'reel' && (
              <button
                onClick={handleShareToReels}
                disabled={isSending}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-extrabold text-white bg-brand-blue hover:bg-blue-600 active:scale-95 shadow-md shadow-blue-200 transition-all flex items-center justify-center gap-2"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Posting Reel...</span>
                  </>
                ) : sentSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{sentSuccess}</span>
                  </>
                ) : (
                  <>
                    <PlaySquare className="w-4 h-4" />
                    <span>Publish Reel</span>
                  </>
                )}
              </button>
            )}

            {activeTab === 'storage' && (
              <button
                onClick={handleSaveToMyStorage}
                disabled={isSending}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-md shadow-emerald-200 transition-all flex items-center justify-center gap-2"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : sentSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{sentSuccess}</span>
                  </>
                ) : (
                  <>
                    <FolderPlus className="w-4 h-4" />
                    <span>Save to Storage</span>
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
