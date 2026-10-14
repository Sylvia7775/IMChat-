import React, { useState, useEffect } from 'react';
import { 
  Music, 
  Sparkles, 
  Play, 
  Square, 
  Check, 
  X, 
  Search, 
  Volume2, 
  Lock, 
  Crown, 
  Radio, 
  Loader2, 
  SlidersHorizontal,
  Wand2,
  RefreshCw,
  Coins,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CURATED_AI_TRACKS, AiSoundTrack, AiAudio } from '../lib/AiAudioEngine';

interface AiMusicPickerProps {
  isOpen?: boolean;
  selectedTrackId?: string;
  currentMusic?: string;
  onSelectTrack: (track: AiSoundTrack) => void;
  onClose: () => void;
  userCoins?: number;
}

export default function AiMusicPicker({
  isOpen = true,
  selectedTrackId,
  currentMusic,
  onSelectTrack,
  onClose,
  userCoins = 500
}: AiMusicPickerProps) {
  if (isOpen === false) return null;
  const [activeTab, setActiveTab] = useState<'library' | 'generator'>('library');
  const [filterCategory, setFilterCategory] = useState<'all' | 'free' | 'paid' | 'synthwave' | 'lofi' | 'phonk' | 'orchestral'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [unlockedTrackIds, setUnlockedTrackIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('unlocked_ai_soundtracks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Generator states
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTrack, setGeneratedTrack] = useState<AiSoundTrack | null>(null);
  const [previewVolume, setPreviewVolume] = useState(70);

  useEffect(() => {
    AiAudio.setVolume(previewVolume);
  }, [previewVolume]);

  useEffect(() => {
    return () => {
      AiAudio.stop();
    };
  }, []);

  const handleTogglePreview = (track: AiSoundTrack) => {
    if (playingTrackId === track.id) {
      AiAudio.stop();
      setPlayingTrackId(null);
    } else {
      AiAudio.playTrack(track);
      setPlayingTrackId(track.id);
    }
  };

  const handleSelect = (track: AiSoundTrack) => {
    if (track.isPaid && !unlockedTrackIds.includes(track.id)) {
      // Unlock paid track
      const updated = [...unlockedTrackIds, track.id];
      setUnlockedTrackIds(updated);
      try {
        localStorage.setItem('unlocked_ai_soundtracks', JSON.stringify(updated));
      } catch (e) {}
    }

    AiAudio.stop();
    onSelectTrack(track);
    onClose();
  };

  const handleGenerateAiMusic = async (customPrompt?: string) => {
    const promptToUse = customPrompt || prompt;
    if (!promptToUse.trim()) return;

    setIsGenerating(true);
    try {
      const response = await fetch('/api/reels/ai-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_music_track',
          prompt: promptToUse
        })
      });
      const data = await response.json();
      if (data && data.result) {
        const gen: AiSoundTrack = {
          id: `custom-ai-${Date.now()}`,
          title: data.result.title || `${promptToUse} (AI Master)`,
          artist: data.result.artist || 'Gemini SoundLab AI',
          genre: data.result.genre || 'AI Electronic',
          bpm: data.result.bpm || 124,
          mood: data.result.mood || 'High Energy Viral',
          synthPreset: data.result.synthPreset || 'synthwave',
          description: data.result.description || 'Procedural AI soundtrack generated with Google Gemini.',
          isPaid: false,
          badge: '⚡ Custom AI Generated',
          coverGradient: 'from-fuchsia-600 via-pink-600 to-amber-500',
          tags: ['AI Generated', 'Custom', 'Reels']
        };
        setGeneratedTrack(gen);
        AiAudio.playTrack(gen);
        setPlayingTrackId(gen.id);
      }
    } catch (err) {
      console.error("AI Music generation failed:", err);
      // Fallback custom generated track
      const fallbackGen: AiSoundTrack = {
        id: `custom-ai-${Date.now()}`,
        title: `${promptToUse} (AI Soundscape)`,
        artist: 'Gemini SoundLab AI',
        genre: 'AI Ambient Beats',
        bpm: 120,
        mood: 'Upbeat & Viral',
        synthPreset: 'synthwave',
        description: 'Procedurally generated ambient beats tailored for Reels.',
        isPaid: false,
        badge: '⚡ Custom AI Generated',
        coverGradient: 'from-cyan-600 via-blue-600 to-indigo-800',
        tags: ['AI Generated', 'Reels']
      };
      setGeneratedTrack(fallbackGen);
      AiAudio.playTrack(fallbackGen);
      setPlayingTrackId(fallbackGen.id);
    } finally {
      setIsGenerating(false);
    }
  };

  const filteredTracks = CURATED_AI_TRACKS.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.genre.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.mood.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filterCategory === 'free') return !t.isPaid;
    if (filterCategory === 'paid') return t.isPaid;
    if (filterCategory === 'synthwave') return t.synthPreset === 'synthwave' || t.synthPreset === 'cyberpunk';
    if (filterCategory === 'lofi') return t.synthPreset === 'lofi' || t.synthPreset === 'ambient';
    if (filterCategory === 'phonk') return t.synthPreset === 'phonk';
    if (filterCategory === 'orchestral') return t.synthPreset === 'orchestral';
    return true;
  });

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        className="bg-zinc-950 text-white rounded-t-3xl sm:rounded-3xl border border-white/10 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-brand-blue flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Music className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                  AI Music & Sound Tracks
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-black tracking-wider uppercase border border-cyan-500/30">
                  AI Audio Engine
                </span>
              </div>
              <p className="text-xs text-zinc-400">Add AI-composed sound tracks and exclusive paid VIP beats to your reel</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/10 text-xs font-bold text-amber-400">
              <Coins className="w-3.5 h-3.5" />
              <span>{userCoins} Credits</span>
            </div>
            <button 
              onClick={() => {
                AiAudio.stop();
                onClose();
              }}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-4 pt-3 border-b border-white/10 bg-zinc-900/30 gap-2">
          <button
            onClick={() => setActiveTab('library')}
            className={`pb-3 px-3 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'library'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>AI Tracks Library ({CURATED_AI_TRACKS.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('generator')}
            className={`pb-3 px-3 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'generator'
                ? 'border-purple-400 text-purple-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>AI Music Generator (Gemini)</span>
          </button>
        </div>

        {/* Content Area */}
        {activeTab === 'library' ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
            {/* Search & Category Filter Chips */}
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search AI soundtrack, genre, mood..."
                  className="w-full bg-zinc-900/90 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {[
                  { id: 'all', label: 'All AI Tracks' },
                  { id: 'free', label: '⚡ Free AI' },
                  { id: 'paid', label: '💎 Paid AI Sound Tracks' },
                  { id: 'synthwave', label: 'Synthwave / Cyber' },
                  { id: 'lofi', label: 'Lofi / Chill' },
                  { id: 'phonk', label: 'Phonk / Bass' },
                  { id: 'orchestral', label: 'Cinematic' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setFilterCategory(cat.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                      filterCategory === cat.id
                        ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                        : 'bg-zinc-900 border border-white/5 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tracks List */}
            <div className="space-y-2.5">
              {filteredTracks.map((track) => {
                const isPlaying = playingTrackId === track.id;
                const isCurrentSelected = currentMusic?.includes(track.title);
                const isUnlocked = !track.isPaid || unlockedTrackIds.includes(track.id);

                return (
                  <div
                    key={track.id}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      isPlaying
                        ? 'bg-cyan-950/40 border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                        : isCurrentSelected
                        ? 'bg-zinc-900 border-cyan-400/40'
                        : 'bg-zinc-900/60 border-white/5 hover:border-white/15'
                    }`}
                  >
                    {/* Left: Cover art & info */}
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                      {/* Album / Sound Art */}
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${track.coverGradient} flex items-center justify-center relative shrink-0 shadow-md overflow-hidden group`}>
                        <button
                          onClick={() => handleTogglePreview(track)}
                          className="w-full h-full flex items-center justify-center bg-black/30 hover:bg-black/10 transition-colors"
                        >
                          {isPlaying ? (
                            <Square className="w-5 h-5 text-white fill-white animate-pulse" />
                          ) : (
                            <Play className="w-5 h-5 text-white fill-white translate-x-0.5" />
                          )}
                        </button>

                        {isPlaying && (
                          <div className="absolute bottom-1 left-1.5 right-1.5 flex items-end justify-center gap-0.5 h-3">
                            <span className="w-1 bg-white rounded-full animate-bounce h-2" />
                            <span className="w-1 bg-white rounded-full animate-bounce [animation-delay:0.2s] h-3" />
                            <span className="w-1 bg-white rounded-full animate-bounce [animation-delay:0.4s] h-1.5" />
                          </div>
                        )}
                      </div>

                      {/* Track Details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-black text-white truncate tracking-tight">
                            {track.title}
                          </h4>
                          {track.isPaid ? (
                            <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-400 to-yellow-500 text-black text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                              <Crown className="w-2.5 h-2.5 fill-black" />
                              <span>Paid AI ({track.priceCoins || 50} 💎)</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 text-[9px] font-black uppercase tracking-wider border border-cyan-500/30">
                              Free AI
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-zinc-400 font-medium truncate mt-0.5">
                          {track.artist} • {track.genre} • <span className="font-mono text-zinc-300">{track.bpm} BPM</span> • {track.mood}
                        </p>
                        <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                          {track.description}
                        </p>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-white/5">
                      <button
                        onClick={() => handleTogglePreview(track)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                          isPlaying
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                            : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                        }`}
                      >
                        {isPlaying ? (
                          <>
                            <Square className="w-3.5 h-3.5 fill-current" />
                            <span>Stop</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Audition</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleSelect(track)}
                        className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md active:scale-95 ${
                          isCurrentSelected
                            ? 'bg-emerald-500 text-black'
                            : track.isPaid && !isUnlocked
                            ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black hover:brightness-110'
                            : 'bg-cyan-500 hover:bg-cyan-400 text-black'
                        }`}
                      >
                        {isCurrentSelected ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Selected</span>
                          </>
                        ) : track.isPaid && !isUnlocked ? (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            <span>Unlock ({track.priceCoins} 💎)</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Use Track</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Generator Tab */
          <div className="flex-1 overflow-y-auto p-5 space-y-5 no-scrollbar">
            <div className="p-4 bg-gradient-to-br from-purple-900/30 via-indigo-900/20 to-zinc-900 rounded-2xl border border-purple-500/20 space-y-3">
              <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase tracking-wider">
                <Wand2 className="w-4 h-4" />
                <span>AI Music Synthesis Prompt</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Describe your desired music soundscape, tempo, or viral atmosphere. Gemini AI will compose structured procedural melodies and synthesizer presets for your reel!
              </p>

              <div className="space-y-2">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. Upbeat cyberpunk festival anthem with intense driving bass drops and euphoric synth leads..."
                  rows={3}
                  className="w-full bg-zinc-950/80 border border-purple-500/30 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-400 transition-colors"
                />

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mr-1">Quick Styles:</span>
                  {[
                    'Cyberpunk Neon Drive',
                    'Lofi Rainy Study',
                    'Tokyo Phonk Drift',
                    'Hollywood Orchestral Hero',
                    'Deep House Beach Rave',
                    'Acoustic Sunset Ballad'
                  ].map((style) => (
                    <button
                      key={style}
                      onClick={() => {
                        setPrompt(style);
                        handleGenerateAiMusic(style);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-purple-500/20 text-zinc-300 hover:text-purple-300 text-[11px] font-semibold transition-colors border border-white/5"
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleGenerateAiMusic()}
                disabled={isGenerating || !prompt.trim()}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:brightness-110 active:scale-95 text-white font-black text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Composing AI Sound Track...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-yellow-300" />
                    <span>Generate AI Sound Track</span>
                  </>
                )}
              </button>
            </div>

            {/* Newly Generated Track Result */}
            {generatedTrack && (
              <div className="p-4 rounded-2xl bg-zinc-900 border border-purple-500/40 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    <span>Newly Composed AI Master Track</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[9px] font-black uppercase">
                    Ready to Use
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${generatedTrack.coverGradient} flex items-center justify-center shrink-0 shadow-lg`}>
                    <button
                      onClick={() => handleTogglePreview(generatedTrack)}
                      className="w-full h-full flex items-center justify-center text-white"
                    >
                      {playingTrackId === generatedTrack.id ? (
                        <Square className="w-6 h-6 fill-white animate-pulse" />
                      ) : (
                        <Play className="w-6 h-6 fill-white translate-x-0.5" />
                      )}
                    </button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-black text-white truncate">{generatedTrack.title}</h4>
                    <p className="text-xs text-zinc-400 font-medium">{generatedTrack.artist} • {generatedTrack.genre}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{generatedTrack.description}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <button
                    onClick={() => handleTogglePreview(generatedTrack)}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-zinc-300 flex items-center gap-1.5"
                  >
                    {playingTrackId === generatedTrack.id ? (
                      <>
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>Stop Audition</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Audition Preview</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleSelect(generatedTrack)}
                    className="px-5 py-2 bg-gradient-to-r from-cyan-400 to-blue-500 hover:brightness-110 active:scale-95 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-cyan-400/20"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Apply to Reel</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer with Volume & Quick Info */}
        <div className="p-4 border-t border-white/10 bg-zinc-900/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 max-w-xs">
            <Volume2 className="w-4 h-4 text-zinc-400 shrink-0" />
            <input
              type="range"
              min="0"
              max="100"
              value={previewVolume}
              onChange={(e) => setPreviewVolume(Number(e.target.value))}
              className="w-full accent-cyan-400 h-1 bg-zinc-700 rounded-lg cursor-pointer"
            />
            <span className="text-[10px] font-mono text-zinc-400 font-bold w-7 text-right">{previewVolume}%</span>
          </div>

          <p className="text-[10px] text-zinc-500 font-medium hidden sm:block">
            Powered by Web Audio Engine & Google Gemini
          </p>
        </div>
      </motion.div>
    </div>
  );
}
