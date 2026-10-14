import eventBus from '../core/EventBus';

export class CathedralAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted: boolean = false;
  private hasInteracted: boolean = false;

  constructor() {
    this.initListeners();
  }

  private initListeners(): void {
    eventBus.on('AUDIO_TOGGLE_REQUESTED', () => {
      this.toggleMute();
    });

    // Auto-unlock audio context on first user interaction
    const unlock = () => {
      if (!this.hasInteracted) {
        this.hasInteracted = true;
        this.ensureContext();
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  private ensureContext(): AudioContext | null {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.75, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    return this.ctx;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.75, this.ctx.currentTime);
    }
    eventBus.emit('AUDIO_STATE_CHANGED', this.muted);
    return this.muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  /**
   * Stone slide rumble: Low-frequency friction scraping sound
   */
  public playStoneSlide(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(65, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.35);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.65);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(160, t);
    filter.Q.setValueAtTime(3.0, t);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.7);

    // Procedural noise crackle layer
    this.playNoiseBurst(0.6, 250, 0.18);
  }

  /**
   * Heavy impact thud: Deep kinetic low-end stone strike
   */
  public playImpactThud(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(175, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.3);

    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.38);

    // Sudden acoustic strike crack
    this.playNoiseBurst(0.12, 1200, 0.4);
  }

  /**
   * Crystalline shatter burst: High-frequency explosive fragmentation
   */
  public playShatter(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    // 1. Kinetic Thud
    this.playImpactThud();

    // 2. High Shimmering Shard Explosion
    const t = ctx.currentTime;
    const freqs = [720, 1140, 1680, 2450, 3200];

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq + Math.random() * 50, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.4, t + 0.9);

      const delay = idx * 0.03;
      gain.gain.setValueAtTime(0, t);
      gain.gain.setValueAtTime(0.22, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.85);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(t + delay);
      osc.stop(t + delay + 0.9);
    });

    // 3. Wideband Debris Hiss
    this.playNoiseBurst(0.85, 3800, 0.45);
  }

  /**
   * Checkmate Harmonic Chord: Arcane cathedral organ chord
   */
  public playCheckmate(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const t = ctx.currentTime;
    // D Minor ethereal chord: D2, A2, D3, F3, A3, D4
    const chord = [73.42, 110.0, 146.83, 174.61, 220.0, 293.66];

    chord.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);

      // Filter to create warm organ tone
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freq * 4.2, t);

      gain.gain.setValueAtTime(0.01, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 3.8);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(t);
      osc.stop(t + 4.0);
    });
  }

  /**
   * Select / Highlight rune chime
   */
  public playSelect(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(680, t);
    osc.frequency.exponentialRampToValueAtTime(920, t + 0.08);

    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.16);
  }

  private playNoiseBurst(duration: number, centerFreq: number, volume: number): void {
    if (!this.ctx || !this.masterGain) return;

    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(centerFreq, this.ctx.currentTime);
    filter.Q.setValueAtTime(2.0, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    whiteNoise.start(this.ctx.currentTime);
  }
}

export const cathedralAudio = new CathedralAudio();
export default cathedralAudio;
