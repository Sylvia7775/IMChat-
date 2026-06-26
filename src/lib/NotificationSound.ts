/**
 * Synthesizes a pleasant notification sound, supporting custom AI Music ringtones
 * set by the user or song makers.
 */
export function playNotificationSound(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioCtx = new AudioContextClass();
    const now = audioCtx.currentTime;

    const customBellStr = localStorage.getItem('custom_notification_bell');
    if (customBellStr) {
      const track = JSON.parse(customBellStr);
      const genre = track.genre || 'ambient';
      const voiceUrl = track.voiceUrl || track.importedVoiceUrl;

      // Play voice briefly if present (1.5-second snippet)
      if (voiceUrl) {
        try {
          const audio = new Audio(voiceUrl);
          audio.volume = 0.8;
          audio.play().catch(() => {});
          setTimeout(() => {
            try { audio.pause(); } catch (e) {}
          }, 1500);
        } catch (voiceErr) {
          console.warn("Could not play custom bell voice audio", voiceErr);
        }
      }

      // Play pleasant high-quality genre chime
      if (genre === 'ambient') {
        // Dreaming major pentatonic arpeggio: C5 -> E5 -> G5 -> C6
        const freqs = [523.25, 659.25, 783.99, 1046.50];
        freqs.forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          gain.gain.setValueAtTime(0, now + idx * 0.08);
          gain.gain.linearRampToValueAtTime(0.08, now + idx * 0.08 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.5);
        });
      } else if (genre === 'techno') {
        // High-energy techno pulse
        const freqs = [150, 300, 600];
        freqs.forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + idx * 0.04);
          gain.gain.setValueAtTime(0, now + idx * 0.04);
          gain.gain.linearRampToValueAtTime(0.06, now + idx * 0.04 + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.15);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + idx * 0.04);
          osc.stop(now + idx * 0.04 + 0.25);
        });
      } else if (genre === 'lofi') {
        // Relaxing soft 7th chord chime
        const freqs = [261.63, 329.63, 392.00, 493.88]; // Cmaj7
        freqs.forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);
          gain.gain.setValueAtTime(0, now + idx * 0.06);
          gain.gain.linearRampToValueAtTime(0.09, now + idx * 0.06 + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.5);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + idx * 0.06);
          osc.stop(now + idx * 0.06 + 0.6);
        });
      } else if (genre === 'acoustic') {
        // Pluck guitar arpeggio
        const freqs = [293.66, 440.00, 587.33, 880.00]; // Dsus2 pluck
        freqs.forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.05);
          gain.gain.setValueAtTime(0, now + idx * 0.05);
          gain.gain.linearRampToValueAtTime(0.1, now + idx * 0.05 + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.35);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + idx * 0.05);
          osc.stop(now + idx * 0.05 + 0.45);
        });
      } else if (genre === 'edm') {
        // Sci-fi sweep chime
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.25);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      }
      return;
    }

    // Default standard Facebook-style Dual Chime (C5 + E5)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now);

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.12, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(0.08, now + 0.03);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);

    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);

    osc1.start(now);
    osc1.stop(now + 0.6);

    osc2.start(now);
    osc2.stop(now + 0.6);
  } catch (err) {
    console.warn("Could not play notification chime:", err);
  }
}
