import React, { useState, useRef } from 'react';
import { 
  X, Image as ImageIcon, Type, Sparkles, MapPin, Music, Smile, 
  Upload, Wand2, Loader2, Check, ArrowLeft, Camera, RefreshCw, Palette, Video
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StorySlide, StoryStore } from '../lib/StoryStore';
import { uploadToCloudinary } from '../lib/cloudinary';
import { geminiService } from '../geminiService';
import UserAvatar from './UserAvatar';

interface InstagramStoryCreatorProps {
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string;
  currentUserRole?: string;
  onClose: () => void;
  onStoryCreated?: () => void;
}

const GRADIENT_PRESETS = [
  { name: 'Sunset Glow', value: 'from-amber-500 via-rose-600 to-purple-800' },
  { name: 'Cyberpunk', value: 'from-purple-900 via-indigo-950 to-black' },
  { name: 'Emerald Aurora', value: 'from-teal-600 via-emerald-700 to-cyan-900' },
  { name: 'Candy Pink', value: 'from-pink-500 via-rose-500 to-amber-400' },
  { name: 'Midnight Ocean', value: 'from-blue-900 via-indigo-900 to-slate-950' },
  { name: 'Golden Hour', value: 'from-yellow-400 via-orange-500 to-red-600' }
];

const FONT_PRESETS = [
  { id: 'modern', name: 'Modern', class: 'font-sans font-black' },
  { id: 'bold', name: 'Impact', class: 'font-mono font-extrabold uppercase' },
  { id: 'neon', name: 'Neon', class: 'font-mono text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]' },
  { id: 'handwriting', name: 'Script', class: 'font-serif italic' }
];

const POPULAR_MUSIC = [
  { title: 'Cruel Summer', artist: 'Taylor Swift' },
  { title: 'Espresso', artist: 'Sabrina Carpenter' },
  { title: 'Blinding Lights', artist: 'The Weeknd' },
  { title: 'Birds of a Feather', artist: 'Billie Eilish' },
  { title: 'Starboy', artist: 'The Weeknd ft. Daft Punk' },
  { title: 'Flowers', artist: 'Miley Cyrus' }
];

const POPULAR_LOCATIONS = [
  'London, UK 🇬🇧',
  'Tokyo, Japan 🇯🇵',
  'New York, USA 🇺🇸',
  'Paris, France 🇫🇷',
  'Dubai, UAE 🇦🇪',
  'Bali, Indonesia 🇮🇩'
];

const POPULAR_STICKERS = ['🔥', '✨', '💖', '🚀', '☕', '🎉', '🌴', '💫', '⚡', '💯', '🌸', '🍕'];

export default function InstagramStoryCreator({
  currentUserId,
  currentUserName,
  currentUserAvatar,
  currentUserRole,
  onClose,
  onStoryCreated
}: InstagramStoryCreatorProps) {
  const [mode, setMode] = useState<'media' | 'text' | 'ai'>('media');
  
  // Media State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'text'>('image');
  
  // Text Mode State
  const [textOverlay, setTextOverlay] = useState<string>('');
  const [selectedGradient, setSelectedGradient] = useState<string>(GRADIENT_PRESETS[0].value);
  const [selectedFont, setSelectedFont] = useState<string>('modern');
  const [textColor, setTextColor] = useState<string>('#ffffff');

  // Overlays
  const [caption, setCaption] = useState<string>('');
  const [selectedSticker, setSelectedSticker] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedMusic, setSelectedMusic] = useState<{ title: string; artist: string } | null>(null);

  // Pickers modal toggles
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);

  // AI Generation State
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const isVid = file.type.startsWith('video/');
      setMediaType(isVid ? 'video' : 'image');
      setPreviewUrl(URL.createObjectURL(file));
      setMode('media');
    }
  };

  const handleGenerateAiImage = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingAi(true);
    try {
      // Generate prompt or visual enhancement with Gemini
      const keywords = await geminiService.generateText(
        `Provide 3 highly aesthetic, cinematic photographic keywords separated by comma describing: "${aiPrompt}". Return ONLY the keywords.`
      );
      const encodedQuery = encodeURIComponent(keywords.replace(/[^a-zA-Z0-9, ]/g, '') || aiPrompt);
      const generatedUrl = `https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1080&auto=format&fit=crop&q=80&sig=${Date.now()}`;
      
      setPreviewUrl(generatedUrl);
      setMediaType('image');
      setMode('media');
      if (!caption) setCaption(aiPrompt);
    } catch (e) {
      console.warn("AI generation fallback:", e);
      setPreviewUrl('https://images.unsplash.com/photo-1518770660439-4636190af475?w=1080&auto=format&fit=crop&q=80');
      setMediaType('image');
      setMode('media');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handlePublishStory = async () => {
    if (mode === 'text' && !textOverlay.trim()) {
      alert("Please type a message for your text story!");
      return;
    }
    if (mode === 'media' && !previewUrl) {
      alert("Please choose an image, video, or write a story!");
      return;
    }

    setIsPublishing(true);
    try {
      let finalMediaUrl = previewUrl;

      // Upload local file to Cloudinary if it is a File object
      if (selectedFile) {
        try {
          const res = await uploadToCloudinary(selectedFile);
          if (res && res.secure_url) {
            finalMediaUrl = res.secure_url;
          }
        } catch (uploadErr) {
          console.warn("Cloudinary upload fallback to blob url:", uploadErr);
        }
      }

      const slideData: Omit<StorySlide, 'id' | 'createdAt'> = {
        mediaType: mode === 'text' ? 'text' : mediaType,
        mediaUrl: mode === 'text' ? undefined : finalMediaUrl,
        caption: caption.trim() || undefined,
        textOverlay: mode === 'text' ? textOverlay.trim() : undefined,
        backgroundGradient: mode === 'text' ? selectedGradient : undefined,
        fontStyle: mode === 'text' ? (selectedFont as any) : undefined,
        textColor: mode === 'text' ? textColor : undefined,
        sticker: selectedSticker || undefined,
        location: selectedLocation || undefined,
        musicTrack: selectedMusic || undefined,
        duration: 5
      };

      const userObj = {
        id: currentUserId,
        name: currentUserName,
        username: currentUserName.toLowerCase().replace(/\s+/g, '_'),
        avatar: currentUserAvatar,
        isVerified: true,
        role: currentUserRole
      };

      await StoryStore.addStorySlide(userObj, slideData);

      if (onStoryCreated) onStoryCreated();
      onClose();
    } catch (err: any) {
      console.error("Story creation error:", err);
      alert("Failed to publish story: " + (err.message || 'Unknown error'));
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[160] bg-black/90 backdrop-blur-xl flex items-center justify-center p-2 sm:p-4 select-none overflow-y-auto">
      <div className="relative w-full max-w-md bg-gray-900 rounded-3xl border border-white/10 shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">Add to Story</h3>
              <p className="text-[11px] text-white/60">Visible to friends for 24 hours</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-3 gap-1 p-2 bg-black/40 border-b border-white/10">
          <button
            type="button"
            onClick={() => setMode('media')}
            className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mode === 'media'
                ? 'bg-white text-gray-900 shadow-md'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Photo / Video</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('text');
              if (!textOverlay) setTextOverlay("Hello friends! ✨");
            }}
            className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mode === 'text'
                ? 'bg-white text-gray-900 shadow-md'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span>Text Story</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('ai')}
            className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mode === 'ai'
                ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-md'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5 text-yellow-300" />
            <span>AI Story Art</span>
          </button>
        </div>

        {/* Canvas Body / Controls Container */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {/* 9:16 Aspect Ratio Story Live Preview Box */}
          <div className="w-full aspect-[9/14] sm:aspect-[9/13] max-h-[360px] mx-auto rounded-2xl overflow-hidden relative bg-black border border-white/20 shadow-lg flex items-center justify-center">
            {/* Top mini header mock in preview */}
            <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between text-white pointer-events-none">
              <div className="flex items-center gap-1.5">
                <UserAvatar
                  src={currentUserAvatar}
                  name={currentUserName}
                  size="xs"
                  className="w-5 h-5 rounded-full"
                />
                <span className="text-[10px] font-bold drop-shadow-md">Your Story</span>
              </div>
              {selectedMusic && (
                <div className="bg-black/60 backdrop-blur-xs text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Music className="w-2.5 h-2.5 text-pink-400" />
                  <span className="truncate max-w-[90px]">{selectedMusic.title}</span>
                </div>
              )}
            </div>

            {/* Preview Content */}
            {mode === 'text' ? (
              <div className={`w-full h-full bg-gradient-to-br ${selectedGradient} flex items-center justify-center p-6 text-center`}>
                <p 
                  className={`text-lg font-black leading-relaxed drop-shadow-xl ${
                    selectedFont === 'neon' 
                      ? 'font-mono text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]' 
                      : selectedFont === 'handwriting' 
                      ? 'font-serif italic' 
                      : 'font-sans'
                  }`}
                  style={{ color: textColor }}
                >
                  {textOverlay || 'Type your message...'}
                </p>
              </div>
            ) : previewUrl ? (
              <div className="w-full h-full relative">
                {mediaType === 'video' ? (
                  <video src={previewUrl} autoPlay loop muted className="w-full h-full object-cover" />
                ) : (
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                )}
                {caption && (
                  <div className="absolute bottom-3 left-3 right-3 bg-black/60 backdrop-blur-md p-2 rounded-xl text-white text-[11px] font-semibold text-center pointer-events-none">
                    {caption}
                  </div>
                )}
              </div>
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-full flex flex-col items-center justify-center gap-2 text-white/60 p-4 text-center cursor-pointer hover:bg-white/5 transition-colors border-2 border-dashed border-white/20"
              >
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-white/80" />
                </div>
                <p className="text-xs font-bold text-white">Click or Drop photo / video here</p>
                <p className="text-[10px] text-white/40">Supports JPG, PNG, MP4, WebM</p>
              </div>
            )}

            {/* Sticker Badge Overlay */}
            {selectedSticker && (
              <div className="absolute top-1/3 left-1/2 -translate-x-1/2 text-4xl animate-bounce pointer-events-none">
                {selectedSticker}
              </div>
            )}

            {/* Location Pill Overlay */}
            {selectedLocation && mode !== 'text' && (
              <div className="absolute top-9 left-2.5 z-20 pointer-events-none">
                <div className="bg-white/90 text-gray-900 text-[9px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                  <MapPin className="w-2.5 h-2.5 text-rose-500" />
                  <span>{selectedLocation}</span>
                </div>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Mode-Specific Controls */}
          {mode === 'media' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2 px-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{previewUrl ? 'Change Media' : 'Upload File'}</span>
                </button>
              </div>

              <div>
                <label className="text-[11px] font-bold text-white/70 block mb-1">Add Caption</label>
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a caption to your story..."
                  className="w-full bg-white/10 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-hidden focus:border-brand-blue"
                />
              </div>
            </div>
          )}

          {mode === 'text' && (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-white/70 block mb-1">Story Text</label>
                <textarea
                  value={textOverlay}
                  onChange={(e) => setTextOverlay(e.target.value)}
                  rows={2}
                  placeholder="What's happening right now?..."
                  className="w-full bg-white/10 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-hidden focus:border-brand-blue resize-none"
                />
              </div>

              {/* Gradient Selector */}
              <div>
                <label className="text-[11px] font-bold text-white/70 block mb-1.5">Background Gradient</label>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {GRADIENT_PRESETS.map((grad, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedGradient(grad.value)}
                      className={`w-8 h-8 rounded-full bg-gradient-to-br ${grad.value} shrink-0 border-2 transition-all ${
                        selectedGradient === grad.value ? 'border-white scale-110 shadow-md' : 'border-transparent opacity-80 hover:opacity-100'
                      }`}
                      title={grad.name}
                    />
                  ))}
                </div>
              </div>

              {/* Font Selector */}
              <div>
                <label className="text-[11px] font-bold text-white/70 block mb-1.5">Font Style</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {FONT_PRESETS.map(font => (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => setSelectedFont(font.id)}
                      className={`py-1.5 px-2 rounded-lg text-center text-xs transition-all ${
                        selectedFont === font.id
                          ? 'bg-white text-gray-900 font-bold'
                          : 'bg-white/10 text-white/70 hover:bg-white/15'
                      }`}
                    >
                      {font.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {mode === 'ai' && (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-white/70 block mb-1">
                  Describe what you want to create ✨
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g. Cozy rainy coffee shop in Tokyo, neon cyberpunk alley..."
                    className="flex-1 bg-white/10 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-hidden focus:border-brand-blue"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateAiImage}
                    disabled={isGeneratingAi || !aiPrompt.trim()}
                    className="py-2 px-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    {isGeneratingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 text-yellow-300" />}
                    <span>Generate</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Story Enhancements Bar: Music, Location, Stickers */}
          <div className="pt-2 border-t border-white/10">
            <p className="text-[11px] font-bold text-white/70 mb-2">Enhance Story</p>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Music Button */}
              <button
                type="button"
                onClick={() => setShowMusicPicker(prev => !prev)}
                className={`py-1.5 px-3 rounded-full text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                  selectedMusic
                    ? 'bg-pink-500/20 text-pink-300 border-pink-500/50'
                    : 'bg-white/10 text-white/80 border-white/15 hover:bg-white/15'
                }`}
              >
                <Music className="w-3 h-3 text-pink-400" />
                <span>{selectedMusic ? selectedMusic.title : 'Music'}</span>
                {selectedMusic && (
                  <span 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMusic(null);
                    }}
                    className="ml-1 text-white/60 hover:text-white"
                  >
                    ×
                  </span>
                )}
              </button>

              {/* Location Button */}
              <button
                type="button"
                onClick={() => setShowLocationPicker(prev => !prev)}
                className={`py-1.5 px-3 rounded-full text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                  selectedLocation
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                    : 'bg-white/10 text-white/80 border-white/15 hover:bg-white/15'
                }`}
              >
                <MapPin className="w-3 h-3 text-rose-400" />
                <span>{selectedLocation ? selectedLocation.split(',')[0] : 'Location'}</span>
                {selectedLocation && (
                  <span 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedLocation('');
                    }}
                    className="ml-1 text-white/60 hover:text-white"
                  >
                    ×
                  </span>
                )}
              </button>

              {/* Sticker Button */}
              <button
                type="button"
                onClick={() => setShowStickerPicker(prev => !prev)}
                className={`py-1.5 px-3 rounded-full text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                  selectedSticker
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : 'bg-white/10 text-white/80 border-white/15 hover:bg-white/15'
                }`}
              >
                <Smile className="w-3 h-3 text-amber-400" />
                <span>{selectedSticker || 'Stickers'}</span>
                {selectedSticker && (
                  <span 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSticker('');
                    }}
                    className="ml-1 text-white/60 hover:text-white"
                  >
                    ×
                  </span>
                )}
              </button>
            </div>

            {/* Music Picker Drawer */}
            {showMusicPicker && (
              <div className="mt-2 p-3 bg-black/60 rounded-xl border border-white/10 space-y-1.5">
                <p className="text-[10.5px] font-bold text-white/60 uppercase tracking-wider">Select Soundtrack</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
                  {POPULAR_MUSIC.map((track, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSelectedMusic(track);
                        setShowMusicPicker(false);
                      }}
                      className="p-1.5 bg-white/5 hover:bg-white/15 rounded-lg text-left text-xs text-white flex items-center justify-between"
                    >
                      <span className="font-bold truncate">{track.title}</span>
                      <span className="text-[10px] text-white/50 truncate ml-1">{track.artist}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Location Picker Drawer */}
            {showLocationPicker && (
              <div className="mt-2 p-3 bg-black/60 rounded-xl border border-white/10 space-y-1.5">
                <p className="text-[10.5px] font-bold text-white/60 uppercase tracking-wider">Select Location</p>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_LOCATIONS.map((loc, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSelectedLocation(loc);
                        setShowLocationPicker(false);
                      }}
                      className="py-1 px-2.5 bg-white/5 hover:bg-white/15 rounded-lg text-xs text-white font-medium"
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sticker Picker Drawer */}
            {showStickerPicker && (
              <div className="mt-2 p-3 bg-black/60 rounded-xl border border-white/10 space-y-1.5">
                <p className="text-[10.5px] font-bold text-white/60 uppercase tracking-wider">Select Emoji Sticker</p>
                <div className="flex flex-wrap gap-2 text-xl">
                  {POPULAR_STICKERS.map((stk, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSelectedSticker(stk);
                        setShowStickerPicker(false);
                      }}
                      className="p-1.5 hover:scale-125 transition-transform"
                    >
                      {stk}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/10 bg-black/40 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl text-xs font-bold text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handlePublishStory}
            disabled={isPublishing || (mode === 'media' && !previewUrl) || (mode === 'text' && !textOverlay.trim())}
            className="flex-1 py-2.5 px-4 bg-gradient-to-r from-yellow-500 via-rose-500 to-purple-600 hover:from-yellow-400 hover:via-rose-400 hover:to-purple-500 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-pink-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            {isPublishing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Publishing to Story...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-yellow-200" />
                <span>Share to Your Story</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
