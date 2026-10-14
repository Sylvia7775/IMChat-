// AI Music & Sound Tracks Engine with Web Audio procedural synthesis and curated tracks
export interface AiSoundTrack {
  id: string;
  title: string;
  artist: string;
  genre: string;
  bpm: number;
  mood: string;
  synthPreset: 'synthwave' | 'lofi' | 'phonk' | 'groove' | 'orchestral' | 'ambient' | 'techno' | 'cyberpunk';
  description: string;
  isPaid: boolean;
  priceCoins?: number;
  badge?: string;
  coverGradient: string;
  tags: string[];
}

export const CURATED_AI_TRACKS: AiSoundTrack[] = [
  // Free AI Tracks
  {
    id: 'neon-sunset',
    title: 'Neon Sunset (Synthwave AI)',
    artist: 'Gemini SoundLab AI',
    genre: 'Synthwave / Retro',
    bpm: 120,
    mood: 'Nostalgic & Energetic',
    synthPreset: 'synthwave',
    description: 'Analog sawtooth bassline with lush 80s chorus synth pads.',
    isPaid: false,
    badge: '⚡ Free AI',
    coverGradient: 'from-fuchsia-600 via-purple-600 to-indigo-700',
    tags: ['Synthwave', 'Retro', 'Viral', 'Neon']
  },
  {
    id: 'lofi-study',
    title: 'Midnight Coffee (Lofi Study AI)',
    artist: 'Chillbot AI Studio',
    genre: 'Lofi Hip Hop',
    bpm: 82,
    mood: 'Relaxed & Cozy',
    synthPreset: 'lofi',
    description: 'Warm vinyl filtered chords with mellow ambient low-pass beats.',
    isPaid: false,
    badge: '⚡ Free AI',
    coverGradient: 'from-amber-600 via-orange-600 to-rose-700',
    tags: ['Lofi', 'Chill', 'Aesthetic', 'Relax']
  },
  {
    id: 'tokyo-drift',
    title: 'Tokyo Shadow (Phonk AI)',
    artist: 'DriftMaster AI',
    genre: 'Phonk / Bass',
    bpm: 140,
    mood: 'Aggressive & High Octane',
    synthPreset: 'phonk',
    description: 'Distorted cowbell lead with heavy distorted sub-bass hits.',
    isPaid: false,
    badge: '⚡ Free AI',
    coverGradient: 'from-red-600 via-rose-700 to-zinc-900',
    tags: ['Phonk', 'Drift', 'Workout', 'Bass']
  },
  {
    id: 'cyber-groove',
    title: 'Cybernetic Beat (Electro AI)',
    artist: 'PulseWave AI',
    genre: 'Electro Funk',
    bpm: 124,
    mood: 'Punchy & Danceable',
    synthPreset: 'groove',
    description: 'Bouncy electronic groove with arpeggiated melodic top-lines.',
    isPaid: false,
    badge: '⚡ Free AI',
    coverGradient: 'from-cyan-500 via-blue-600 to-indigo-800',
    tags: ['Dance', 'Electro', 'Groove', 'Fun']
  },
  {
    id: 'cinematic-rise',
    title: 'Ascension Horizon (Cinematic AI)',
    artist: 'Symphony AI Core',
    genre: 'Orchestral AI',
    bpm: 96,
    mood: 'Epic & Inspirational',
    synthPreset: 'orchestral',
    description: 'Soaring brass swells and grand cinematic chord progressions.',
    isPaid: false,
    badge: '⚡ Free AI',
    coverGradient: 'from-emerald-600 via-teal-700 to-slate-900',
    tags: ['Cinematic', 'Epic', 'Travel', 'Inspiring']
  },
  {
    id: 'acoustic-sun',
    title: 'Golden Hour Breeze (Indie AI)',
    artist: 'Aura Acoustic AI',
    genre: 'Indie Folk',
    bpm: 104,
    mood: 'Bright & Uplifting',
    synthPreset: 'ambient',
    description: 'Gentle harmonic sine chimes and breezy warm acoustic vibes.',
    isPaid: false,
    badge: '⚡ Free AI',
    coverGradient: 'from-yellow-500 via-amber-600 to-lime-700',
    tags: ['Acoustic', 'Nature', 'Vlog', 'Happy']
  },

  // Paid VIP AI Sound Tracks
  {
    id: 'paid-cyberpunk-vip',
    title: 'Cyberpunk Anthem 2099 (Ultra VIP Mastered)',
    artist: 'Neural Sound Master VIP',
    genre: 'Cyberpunk VIP',
    bpm: 132,
    mood: 'Futuristic & Powerful',
    synthPreset: 'cyberpunk',
    description: 'Multi-layer detuned hypersaw leads and earth-shaking 808 sub drops.',
    isPaid: true,
    priceCoins: 50,
    badge: '💎 Paid AI Sound Track',
    coverGradient: 'from-purple-600 via-pink-600 to-yellow-500',
    tags: ['VIP', 'Cyberpunk', 'Ultra HD', 'Exclusive']
  },
  {
    id: 'paid-hollywood-gold',
    title: 'Hollywood Epic Symphony (Gold AI Studio)',
    artist: 'Hans Zimmer AI Model V4',
    genre: 'Cinematic Gold VIP',
    bpm: 110,
    mood: 'Majestic & Heroic',
    synthPreset: 'orchestral',
    description: 'Mastered 8K orchestral strings, dramatic French horn choir and sub booms.',
    isPaid: true,
    priceCoins: 80,
    badge: '💎 Paid AI Sound Track',
    coverGradient: 'from-amber-400 via-yellow-600 to-stone-900',
    tags: ['Gold VIP', 'Hollywood', 'Film Score', 'Mastered']
  },
  {
    id: 'paid-billboard-banger',
    title: 'Viral Billboard 8K Banger (Platinum AI)',
    artist: 'HitMaker AI Labs',
    genre: 'Trap / Pop VIP',
    bpm: 130,
    mood: 'Viral & Hyped',
    synthPreset: 'groove',
    description: 'Rolling hi-hats, hard-hitting kick punch, and crystal vocaloid hooks.',
    isPaid: true,
    priceCoins: 65,
    badge: '💎 Paid AI Sound Track',
    coverGradient: 'from-rose-500 via-pink-600 to-violet-900',
    tags: ['Platinum', 'Viral', 'Billboard', 'Trend']
  },
  {
    id: 'paid-deep-house-club',
    title: 'Deep House Ultra Bass VIP (Festival AI Mix)',
    artist: 'RaveAI Ibiza Resident',
    genre: 'Festival House VIP',
    bpm: 126,
    mood: 'Hypnotic Club Vibe',
    synthPreset: 'techno',
    description: 'Driving 4/4 four-on-the-floor kick with deep analog FM bass plucks.',
    isPaid: true,
    priceCoins: 50,
    badge: '💎 Paid AI Sound Track',
    coverGradient: 'from-blue-600 via-indigo-700 to-slate-950',
    tags: ['Club', 'Festival', 'Deep House', 'VIP']
  },
  {
    id: 'paid-phonk-drift-king',
    title: 'Drift King Tokyo VIP (Phonk Bass Master)',
    artist: 'GhostRider Phonk AI',
    genre: 'Phonk Bass VIP',
    bpm: 145,
    mood: 'Intense Drift Mode',
    synthPreset: 'phonk',
    description: 'Ultra-compressed dark Memphis phonk cowbells with saturated sub-bass.',
    isPaid: true,
    priceCoins: 70,
    badge: '💎 Paid AI Sound Track',
    coverGradient: 'from-red-600 via-orange-600 to-black',
    tags: ['Phonk VIP', 'Drift King', 'Sub Bass', 'Master']
  },
  {
    id: 'paid-velvet-lounge',
    title: 'Velvet Midnight Chill (Grammy AI Lounge)',
    artist: 'SilkNotes AI Master',
    genre: 'Neo-Soul / Jazz VIP',
    bpm: 88,
    mood: 'Luxurious & Sensual',
    synthPreset: 'lofi',
    description: 'Warm electric Rhodes chords with silky brushed snare rhythm.',
    isPaid: true,
    priceCoins: 45,
    badge: '💎 Paid AI Sound Track',
    coverGradient: 'from-emerald-500 via-teal-700 to-slate-900',
    tags: ['Neo Soul', 'Luxury', 'Velvet', 'Grammy VIP']
  }
];

// Audio Context Singleton & Scheduler
class AiAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private currentInterval: any = null;
  private currentNodes: (AudioNode | OscillatorNode)[] = [];
  private isPlaying: boolean = false;
  private currentTrackId: string | null = null;
  private masterGain: GainNode | null = null;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx && !this.masterGain) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
  }

  public setVolume(volPercent: number) {
    if (this.masterGain && this.ctx) {
      const normalized = Math.max(0, Math.min(1, volPercent / 100)) * 0.4;
      this.masterGain.gain.setValueAtTime(normalized, this.ctx.currentTime);
    }
  }

  public stop() {
    if (this.currentInterval) {
      clearInterval(this.currentInterval);
      this.currentInterval = null;
    }
    this.currentNodes.forEach((node) => {
      try {
        if ('stop' in node) {
          (node as OscillatorNode).stop();
        }
        node.disconnect();
      } catch (e) {}
    });
    this.currentNodes = [];
    this.isPlaying = false;
    this.currentTrackId = null;
  }

  public getCurrentPlayingId(): string | null {
    return this.currentTrackId;
  }

  public playTrack(track: AiSoundTrack | { id: string; synthPreset: string; bpm?: number; melodyNotes?: number[] }) {
    this.stop();
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    this.isPlaying = true;
    this.currentTrackId = track.id;

    const ctx = this.ctx;
    const master = this.masterGain;
    const preset = track.synthPreset || 'synthwave';
    const bpm = track.bpm || 120;
    const stepInterval = (60 / bpm) * 1000 * 0.5; // Eighth note step

    // Note scales for presets
    const notePitches: { [key: string]: number[] } = {
      synthwave: [220, 277.18, 329.63, 440, 554.37, 659.25, 880],
      lofi: [174.61, 220, 261.63, 329.63, 392, 440],
      phonk: [110, 130.81, 146.83, 164.81, 220, 587.33, 880],
      groove: [196, 246.94, 293.66, 392, 493.88, 587.33],
      orchestral: [130.81, 164.81, 196, 261.63, 329.63, 392, 523.25],
      ambient: [220, 329.63, 440, 523.25, 659.25],
      techno: [110, 123.47, 130.81, 146.83, 220, 440],
      cyberpunk: [98, 123.47, 146.83, 196, 246.94, 392, 783.99]
    };

    const notes = notePitches[preset] || notePitches.synthwave;
    let step = 0;

    // Background ambient chord pad
    try {
      const padOsc1 = ctx.createOscillator();
      const padOsc2 = ctx.createOscillator();
      const padGain = ctx.createGain();
      const padFilter = ctx.createBiquadFilter();

      padOsc1.type = preset === 'lofi' ? 'sine' : preset === 'phonk' ? 'sawtooth' : 'triangle';
      padOsc2.type = 'sine';

      padOsc1.frequency.setValueAtTime(notes[0], ctx.currentTime);
      padOsc2.frequency.setValueAtTime(notes[2] || notes[0] * 1.5, ctx.currentTime);

      padFilter.type = 'lowpass';
      padFilter.frequency.setValueAtTime(preset === 'lofi' ? 450 : preset === 'cyberpunk' ? 1200 : 800, ctx.currentTime);

      padGain.gain.setValueAtTime(0.12, ctx.currentTime);

      padOsc1.connect(padFilter);
      padOsc2.connect(padFilter);
      padFilter.connect(padGain);
      padGain.connect(master);

      padOsc1.start();
      padOsc2.start();

      this.currentNodes.push(padOsc1, padOsc2, padGain, padFilter);
    } catch (e) {
      console.warn("Pad synth error:", e);
    }

    // Step sequencer loop
    this.currentInterval = setInterval(() => {
      if (!this.isPlaying || !this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime;

      // 1. Kick/Bass beat on quarter notes
      if (step % 2 === 0) {
        try {
          const kickOsc = this.ctx.createOscillator();
          const kickGain = this.ctx.createGain();
          kickOsc.type = preset === 'phonk' || preset === 'cyberpunk' ? 'sawtooth' : 'sine';
          
          const startFreq = preset === 'phonk' ? 180 : 130;
          kickOsc.frequency.setValueAtTime(startFreq, now);
          kickOsc.frequency.exponentialRampToValueAtTime(35, now + 0.12);

          kickGain.gain.setValueAtTime(preset === 'lofi' ? 0.15 : 0.28, now);
          kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

          kickOsc.connect(kickGain);
          kickGain.connect(this.masterGain);

          kickOsc.start(now);
          kickOsc.stop(now + 0.2);
        } catch (e) {}
      }

      // 2. Snare / Clack on backbeats
      if (step % 4 === 2) {
        try {
          const snareOsc = this.ctx.createOscillator();
          const snareGain = this.ctx.createGain();
          snareOsc.type = 'triangle';
          snareOsc.frequency.setValueAtTime(preset === 'lofi' ? 220 : 350, now);

          snareGain.gain.setValueAtTime(0.1, now);
          snareGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

          snareOsc.connect(snareGain);
          snareGain.connect(this.masterGain);

          snareOsc.start(now);
          snareOsc.stop(now + 0.12);
        } catch (e) {}
      }

      // 3. Arpeggio / Melody note
      try {
        const noteIdx = (step % notes.length);
        const pitch = notes[noteIdx];
        const leadOsc = this.ctx.createOscillator();
        const leadGain = this.ctx.createGain();
        const leadFilter = this.ctx.createBiquadFilter();

        leadOsc.type = preset === 'phonk' ? 'square' : preset === 'cyberpunk' ? 'sawtooth' : preset === 'lofi' ? 'sine' : 'triangle';
        leadOsc.frequency.setValueAtTime(pitch, now);

        leadFilter.type = 'lowpass';
        leadFilter.frequency.setValueAtTime(preset === 'lofi' ? 600 : 2500, now);

        leadGain.gain.setValueAtTime(0.18, now);
        leadGain.gain.exponentialRampToValueAtTime(0.001, now + (stepInterval / 1000) * 0.9);

        leadOsc.connect(leadFilter);
        leadFilter.connect(leadGain);
        leadGain.connect(this.masterGain);

        leadOsc.start(now);
        leadOsc.stop(now + (stepInterval / 1000));
      } catch (e) {}

      step = (step + 1) % 16;
    }, stepInterval);
  }
}

export const AiAudio = new AiAudioSynthesizer();
