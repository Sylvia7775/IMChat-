import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Globe, Users, Lock, ShieldCheck, Check, Loader2 } from 'lucide-react';
import { MediaItem, MediaPrivacy } from '../lib/MediaStorage';

interface MediaPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  media: MediaItem | null;
  onUpdatePrivacy: (mediaId: string, privacy: MediaPrivacy) => Promise<boolean>;
}

export default function MediaPrivacyModal({
  isOpen,
  onClose,
  media,
  onUpdatePrivacy
}: MediaPrivacyModalProps) {
  const [selectedPrivacy, setSelectedPrivacy] = useState<MediaPrivacy>('public');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (media) {
      setSelectedPrivacy(media.privacy || 'public');
      setSavedSuccess(false);
    }
  }, [media, isOpen]);

  if (!isOpen || !media) return null;

  const handleSave = async () => {
    setIsSaving(true);
    const success = await onUpdatePrivacy(media.id, selectedPrivacy);
    setIsSaving(false);
    if (success) {
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1000);
    }
  };

  const privacyOptions: {
    id: MediaPrivacy;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeColor: string;
  }[] = [
    {
      id: 'public',
      title: 'Public',
      description: 'Anyone on the platform can view, discover, and re-share this media to their feed or chats.',
      icon: Globe,
      badgeColor: 'text-emerald-600 bg-emerald-50 border-emerald-200'
    },
    {
      id: 'followers',
      title: 'Followers Only',
      description: 'Only users who follow your profile can see and share this media item in their storage or chats.',
      icon: Users,
      badgeColor: 'text-brand-blue bg-blue-50 border-blue-200'
    },
    {
      id: 'private',
      title: 'Private (Only You)',
      description: 'Concealed from all other users. Stored securely in your private media vault.',
      icon: Lock,
      badgeColor: 'text-amber-600 bg-amber-50 border-amber-200'
    }
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 flex flex-col"
        >
          {/* Header */}
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-gray-900 text-base">Media Privacy Settings</h3>
                <p className="text-[11px] text-gray-500 font-medium">Control who can access and share this item</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Media Preview thumbnail */}
          <div className="p-4 bg-gray-50 flex items-center gap-3 border-b border-gray-100">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-200 shrink-0 border border-gray-200/80">
              {media.type === 'image' ? (
                <img src={media.thumbnailUrl || media.url} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <video src={media.url} className="w-full h-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-gray-800 truncate capitalize">{media.type} Item</p>
              <p className="text-[11px] text-gray-400 font-medium">
                {(media.sizeBytes / (1024 * 1024)).toFixed(2)} MB • {media.source || 'Upload'}
              </p>
            </div>
          </div>

          {/* Options */}
          <div className="p-5 space-y-3">
            {privacyOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = selectedPrivacy === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => setSelectedPrivacy(opt.id)}
                  className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/40 shadow-sm'
                      : 'border-gray-100 hover:border-gray-200 bg-white'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${opt.badgeColor}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-bold ${isSelected ? 'text-indigo-950' : 'text-gray-800'}`}>
                        {opt.title}
                      </span>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{opt.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="p-5 border-t border-gray-100 bg-gray-50 flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-200/60 bg-gray-200/40 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 py-3 px-4 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : savedSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Privacy Updated!</span>
                </>
              ) : (
                <span>Save Privacy</span>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
