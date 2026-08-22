// Web Audio API based sound synthesizer for calling ringtones and signals

class CallSoundSynthesizer {
  private audioCtx: AudioContext | null = null;
  private currentInterval: any = null;
  private activeOscillators: OscillatorNode[] = [];

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  // Play outgoing ringing tone (gentle European/US standard phone ring: 440Hz + 480Hz pulses)
  public playOutgoingRing() {
    this.stop();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const playTone = () => {
      try {
        if (!this.audioCtx || this.audioCtx.state === 'closed') return;
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(480, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
        gain.gain.setValueAtTime(0.08, now + 1.6);
        gain.gain.linearRampToValueAtTime(0, now + 1.8);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.8);
        osc2.stop(now + 1.8);

        this.activeOscillators.push(osc1, osc2);
      } catch (err) {
        console.warn('Audio play error:', err);
      }
    };

    playTone();
    this.currentInterval = setInterval(playTone, 3800);
  }

  // Play incoming ringtone (melodic futuristic chime ringtone)
  public playIncomingRing() {
    this.stop();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const playChime = () => {
      try {
        if (!this.audioCtx || this.audioCtx.state === 'closed') return;
        const notes = [587.33, 739.99, 880.0, 1174.66]; // D5, F#5, A5, D6
        notes.forEach((freq, idx) => {
          const now = ctx.currentTime + idx * 0.14;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now);

          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now);
          osc.stop(now + 0.36);
          this.activeOscillators.push(osc);
        });
      } catch (err) {
        console.warn('Audio chime error:', err);
      }
    };

    playChime();
    this.currentInterval = setInterval(playChime, 2200);
  }

  // Short end-call tone
  public playEndCallTone() {
    this.stop();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.linearRampToValueAtTime(200, now + 0.25);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.26);
    } catch (err) {
      console.warn('End call sound error:', err);
    }
  }

  // Stop all active audio
  public stop() {
    if (this.currentInterval) {
      clearInterval(this.currentInterval);
      this.currentInterval = null;
    }
    this.activeOscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (_) {}
    });
    this.activeOscillators = [];
  }
}

export const callSounds = new CallSoundSynthesizer();
