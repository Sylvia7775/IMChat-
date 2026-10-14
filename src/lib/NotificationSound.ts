export interface ChimeOption {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export const CHIME_OPTIONS: ChimeOption[] = [
  { id: 'default_ring_bell', name: 'Ring-Ding Bell', icon: '🔔', description: 'Signature double desk bell' },
  { id: 'hotel_bell', name: 'Concierge Chime', icon: '🛎️', description: 'Classic reception service bell' },
  { id: 'crystal_chime', name: 'Crystal Sparkle', icon: '✨', description: 'Harmonic shimmering triad' },
  { id: 'gentle_pop', name: 'Gentle Pop', icon: '🎵', description: 'Soft acoustic bubble drop' },
  { id: 'cosmic_pulse', name: 'Cosmic Pulse', icon: '🌌', description: 'Ambient space synth ripple' },
  { id: 'submarine_ping', name: 'Sonar Ping', icon: '🔊', description: 'Clear aquatic radar tone' },
  { id: 'tower_bell', name: 'Cathedral Bell', icon: '⛪', description: 'Deep resonant tower chime' },
  { id: 'zen_bell', name: 'Zen Singing Bell', icon: '🧘', description: 'Calm 432Hz meditation tone' },
  { id: 'digital_beep', name: 'Cyber Beep', icon: '🤖', description: 'Futuristic digital pulse' },
  { id: 'mute', name: 'Mute (No Sound)', icon: '🔕', description: 'Disable notification sound completely' }
];

export function getGlobalDefaultBell(): string {
  try {
    return localStorage.getItem('app_global_default_bell') || 'default_ring_bell';
  } catch {
    return 'default_ring_bell';
  }
}

export function getGlobalDefaultBellName(): string {
  try {
    return localStorage.getItem('app_global_default_bell_name') || 'Signature App Ring Bell 🔔';
  } catch {
    return 'Signature App Ring Bell 🔔';
  }
}

export function getGlobalDefaultBellAudioUrl(): string {
  try {
    return localStorage.getItem('app_global_default_bell_url') || '';
  } catch {
    return '';
  }
}

export function setGlobalDefaultBell(bellId: string, bellName?: string, bellAudioUrl?: string): void {
  try {
    localStorage.setItem('app_global_default_bell', bellId);
    if (bellName) {
      localStorage.setItem('app_global_default_bell_name', bellName);
    }
    if (bellAudioUrl !== undefined) {
      localStorage.setItem('app_global_default_bell_url', bellAudioUrl || '');
    }
    window.dispatchEvent(new CustomEvent('global-bell-changed', {
      detail: { bellId, bellName, bellAudioUrl }
    }));
    window.dispatchEvent(new CustomEvent('chime-changed', {
      detail: { chimeId: bellId }
    }));
  } catch (err) {
    console.warn("Could not save global default bell:", err);
  }
}

export function getActiveChime(): string {
  try {
    const userPref = localStorage.getItem('app_notification_bell_type');
    if (!userPref || userPref === 'default_ring_bell' || userPref === 'app_default') {
      return getGlobalDefaultBell();
    }
    return userPref;
  } catch {
    return getGlobalDefaultBell();
  }
}

export function setActiveChime(chimeId: string): void {
  try {
    localStorage.setItem('app_notification_bell_type', chimeId);
    window.dispatchEvent(new CustomEvent('chime-changed', { detail: { chimeId } }));
  } catch (err) {
    console.warn("Could not save active chime:", err);
  }
}

export function isNotificationSoundMuted(): boolean {
  const chime = getActiveChime();
  return chime === 'mute' || chime === 'disabled' || chime === 'none';
}

/**
 * Synthesizes pleasant notification sounds, supporting custom Bell ringtones,
 * uploaded audio ringtones, signature App Ring Bell chimes, or mute mode.
 */
export function playNotificationSound(soundTypeOverride?: string): void {
  try {
    let selectedSound = soundTypeOverride || getActiveChime();

    // 0. Disable sound if user selected Mute
    if (selectedSound === 'mute' || selectedSound === 'disabled' || selectedSound === 'none') {
      return;
    }

    // Resolve global default if sound is marked as default
    if (selectedSound === 'default_ring_bell' || selectedSound === 'app_default') {
      const globalBell = getGlobalDefaultBell();
      if (globalBell && globalBell !== 'default_ring_bell' && globalBell !== 'app_default') {
        selectedSound = globalBell;
      }
    }

    // 1. Check if user selected custom uploaded audio or custom AI track, or if admin global default is custom audio
    let customAudioUrl = localStorage.getItem('custom_bell_audio_url');
    if (!customAudioUrl && (selectedSound === 'custom_audio' || selectedSound === 'default_ring_bell')) {
      customAudioUrl = getGlobalDefaultBellAudioUrl();
    }
    const customBellStr = localStorage.getItem('custom_notification_bell');

    if ((selectedSound === 'custom_audio' || selectedSound === 'custom_ai') && (customAudioUrl || customBellStr)) {
      let audioSrc = customAudioUrl;
      if (!audioSrc && customBellStr) {
        try {
          const track = JSON.parse(customBellStr);
          audioSrc = track.voiceUrl || track.importedVoiceUrl || track.audioUrl;
        } catch (e) {}
      }

      if (audioSrc) {
        try {
          const audio = new Audio(audioSrc);
          audio.volume = 0.9;
          audio.play().catch((err) => {
            console.warn("Could not play custom bell audio:", err);
          });
          return;
        } catch (audioErr) {
          console.warn("Error initializing custom bell audio:", audioErr);
        }
      }
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    const now = audioCtx.currentTime;

    // 2. Classic Reception / Concierge Service Bell ("Ding! 🛎️")
    if (selectedSound === 'hotel_bell') {
      const bellOsc1 = audioCtx.createOscillator();
      const bellOsc2 = audioCtx.createOscillator();
      const bellOsc3 = audioCtx.createOscillator();
      const bellGain = audioCtx.createGain();

      bellOsc1.type = 'sine';
      bellOsc1.frequency.setValueAtTime(2093.00, now); // C7 pure chime
      bellOsc2.type = 'sine';
      bellOsc2.frequency.setValueAtTime(4186.01, now); // C8 shimmer overtone
      bellOsc3.type = 'triangle';
      bellOsc3.frequency.setValueAtTime(1046.50, now); // C6 resonance

      bellGain.gain.setValueAtTime(0, now);
      bellGain.gain.linearRampToValueAtTime(0.25, now + 0.003);
      bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

      bellOsc1.connect(bellGain);
      bellOsc2.connect(bellGain);
      bellOsc3.connect(bellGain);
      bellGain.connect(audioCtx.destination);

      bellOsc1.start(now);
      bellOsc2.start(now);
      bellOsc3.start(now);
      bellOsc1.stop(now + 1.25);
      bellOsc2.stop(now + 1.25);
      bellOsc3.stop(now + 1.25);
      return;
    }

    // 3. Deep Cathedral / Tower Bell Chime ("Bongg! ⛪")
    if (selectedSound === 'tower_bell') {
      const baseFreq = 587.33; // D5
      const freqs = [baseFreq, baseFreq * 1.5, baseFreq * 2.0, baseFreq * 2.76];
      freqs.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.18 / (idx + 1), now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 1.7);
      });
      return;
    }

    // 4. Tibetan Zen Meditation Singing Bell ("Om Bell 🧘")
    if (selectedSound === 'zen_bell') {
      const freqs = [432.00, 864.00, 1296.00];
      freqs.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.15 / (idx + 1), now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 2.1);
      });
      return;
    }

    // 5. Crystal Harmonic Chime (E6 -> B6 -> E7)
    if (selectedSound === 'crystal_chime') {
      const freqs = [1318.51, 1975.53, 2637.02];
      freqs.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        gain.gain.setValueAtTime(0, now + idx * 0.07);
        gain.gain.linearRampToValueAtTime(0.14, now + idx * 0.07 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0005, now + idx * 0.07 + 0.6);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.65);
      });
      return;
    }

    // 6. Gentle Pop / Water Bubble Chime ("Pop 🎵")
    if (selectedSound === 'gentle_pop') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.05);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0002, now + 0.28);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
      return;
    }

    // 7. Cosmic Synth Pulse ("Cosmic 🌌")
    if (selectedSound === 'cosmic_pulse') {
      const chord = [523.25, 659.25, 783.99, 1046.50]; // C Major Spread
      chord.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);
        gain.gain.setValueAtTime(0, now + idx * 0.04);
        gain.gain.linearRampToValueAtTime(0.10, now + idx * 0.04 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.04 + 0.85);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + idx * 0.04);
        osc.stop(now + idx * 0.04 + 0.9);
      });
      return;
    }

    // 8. Sonar Submarine Ping ("Sonar 🔊")
    if (selectedSound === 'submarine_ping') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1500, now);
      osc.frequency.exponentialRampToValueAtTime(1470, now + 0.5);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.20, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.95);
      return;
    }

    // 9. Digital Tech Pulse
    if (selectedSound === 'digital_beep') {
      [880, 1760].forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.06, now + idx * 0.08 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.12);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.15);
      });
      return;
    }

    // 10. Default Signature App Ring Bell (Double Desk/Service Bell Strike "Ring-Ding! 🔔")
    // Strike 1: E6 (1318.51 Hz) + E7 (2637.02 Hz overtone)
    const bell1Core = audioCtx.createOscillator();
    const bell1Overtone = audioCtx.createOscillator();
    const bell1Gain = audioCtx.createGain();

    bell1Core.type = 'sine';
    bell1Core.frequency.setValueAtTime(1318.51, now); // E6

    bell1Overtone.type = 'sine';
    bell1Overtone.frequency.setValueAtTime(2637.02, now); // E7 metallic fundamental

    bell1Gain.gain.setValueAtTime(0, now);
    bell1Gain.gain.linearRampToValueAtTime(0.20, now + 0.005);
    bell1Gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.55);

    bell1Core.connect(bell1Gain);
    bell1Overtone.connect(bell1Gain);
    bell1Gain.connect(audioCtx.destination);

    bell1Core.start(now);
    bell1Overtone.start(now);
    bell1Core.stop(now + 0.6);
    bell1Overtone.stop(now + 0.6);

    // Strike 2 (Ring Echo): A6 (1760.00 Hz) + A7 (3520.00 Hz overtone) delayed by 110ms
    const strikeTime2 = now + 0.11;
    const bell2Core = audioCtx.createOscillator();
    const bell2Overtone = audioCtx.createOscillator();
    const bell2Gain = audioCtx.createGain();

    bell2Core.type = 'sine';
    bell2Core.frequency.setValueAtTime(1760.00, strikeTime2); // A6
    
    bell2Overtone.type = 'sine';
    bell2Overtone.frequency.setValueAtTime(3520.00, strikeTime2); // A7 crystal ring

    bell2Gain.gain.setValueAtTime(0, strikeTime2);
    bell2Gain.gain.linearRampToValueAtTime(0.22, strikeTime2 + 0.005);
    bell2Gain.gain.exponentialRampToValueAtTime(0.0002, strikeTime2 + 0.85);

    bell2Core.connect(bell2Gain);
    bell2Overtone.connect(bell2Gain);
    bell2Gain.connect(audioCtx.destination);

    bell2Core.start(strikeTime2);
    bell2Overtone.start(strikeTime2);
    bell2Core.stop(strikeTime2 + 0.9);
    bell2Overtone.stop(strikeTime2 + 0.9);

  } catch (err) {
    console.warn("Could not play notification ring bell:", err);
  }
}

/**
 * Subtle sent-message sound (soft pop/tick) for immediate tactile feedback
 */
export function playSentMessageSound(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    const now = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(840, now + 0.06);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  } catch (e) {
    // ignore
  }
}

/**
 * Request permission and trigger browser notification if page is blurred/backgrounded
 */
export function triggerWebNotification(title: string, body: string, icon?: string): void {
  try {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: icon || '/icon.png',
          silent: true // sound is synthesized via Web Audio API
        });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(perm => {
          if (perm === 'granted') {
            new Notification(title, {
              body,
              icon: icon || '/icon.png',
              silent: true
            });
          }
        }).catch(() => {});
      }
    }
  } catch (e) {
    // ignore
  }
}

