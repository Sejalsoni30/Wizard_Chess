import * as THREE from 'three';
import eventBus from '../core/EventBus';
import { squareToWorld } from '../config/constants';

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

  public setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : clamped, this.ctx.currentTime);
    }
  }

  /**
   * Helper to calculate normalized stereo pan (-1.0 to +1.0) from a 3D board position or square
   */
  private getPanValue(pos?: THREE.Vector3 | string | null): number {
    if (!pos) return 0;
    let x = 0;
    if (typeof pos === 'string') {
      const wPos = squareToWorld(pos);
      x = wPos.x;
    } else {
      x = pos.x;
    }
    // Board spans roughly -7.35 to +7.35 on X
    return Math.max(-0.95, Math.min(0.95, x / 7.5));
  }

  /**
   * Connects an audio node through a spatial stereo panner before master gain
   */
  private routeSpatial(source: AudioNode, pos?: THREE.Vector3 | string | null): void {
    if (!this.ctx || !this.masterGain) return;
    const pan = this.getPanValue(pos);

    if (this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(pan, this.ctx.currentTime);
      source.connect(panner);
      panner.connect(this.masterGain);
    } else {
      source.connect(this.masterGain);
    }
  }

  /**
   * Stone slide rumble: Low-frequency friction scraping sound with spatial panning
   */
  public playStoneSlide(pos?: THREE.Vector3 | string): void {
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
    this.routeSpatial(gain, pos);

    osc.start(t);
    osc.stop(t + 0.7);

    // Procedural noise crackle layer
    this.playNoiseBurst(0.6, 250, 0.18, pos);
  }

  /**
   * Heavy impact thud: Deep kinetic low-end stone strike with spatial panning
   */
  public playImpactThud(pos?: THREE.Vector3 | string, heavy: boolean = false): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = heavy ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(heavy ? 120 : 175, t);
    osc.frequency.exponentialRampToValueAtTime(heavy ? 24 : 32, t + (heavy ? 0.45 : 0.3));

    gain.gain.setValueAtTime(heavy ? 0.85 : 0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (heavy ? 0.5 : 0.35));

    osc.connect(gain);
    this.routeSpatial(gain, pos);

    osc.start(t);
    osc.stop(t + (heavy ? 0.55 : 0.38));

    // Sudden acoustic strike crack
    this.playNoiseBurst(heavy ? 0.22 : 0.12, heavy ? 850 : 1200, heavy ? 0.55 : 0.4, pos);
  }

  /**
   * Crystalline shatter burst: High-frequency explosive fragmentation with 3D spatial panning
   */
  public playShatter(pos?: THREE.Vector3 | string): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    // 1. Kinetic Thud
    this.playImpactThud(pos, true);

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
      this.routeSpatial(gain, pos);

      osc.start(t + delay);
      osc.stop(t + delay + 0.9);
    });

    // 3. Wideband Debris Hiss
    this.playNoiseBurst(0.85, 3800, 0.45, pos);
  }

  /**
   * ROOK: Seismic Slam - Deep earth-shattering bass drop with ground tremor reverberation
   */
  public playSeismicSlam(pos?: THREE.Vector3 | string): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.55);

    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(320, t);
    lowpass.frequency.exponentialRampToValueAtTime(70, t + 0.7);

    osc.connect(lowpass);
    lowpass.connect(gain);
    this.routeSpatial(gain, pos);

    osc.start(t);
    osc.stop(t + 0.95);

    // Crack of breaking tectonic stone
    this.playNoiseBurst(0.4, 480, 0.65, pos);
  }

  /**
   * BISHOP: Celestial Light Beam - Radiant high-energy laser charge and solar discharge
   */
  public playLaserBeam(pos?: THREE.Vector3 | string): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const t = ctx.currentTime;

    // High charging shimmer sweep
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(3400, t + 0.45);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.85);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);

    osc.connect(gain);
    this.routeSpatial(gain, pos);

    osc.start(t);
    osc.stop(t + 0.9);

    // Radiant harmonic blast
    this.playNoiseBurst(0.35, 2800, 0.45, pos);
  }

  /**
   * KNIGHT: Warhorse Hoof Stomp - Rapid double galloping strike and kinetic shockwave
   */
  public playHorseStomp(pos?: THREE.Vector3 | string): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const t = ctx.currentTime;
    [0, 0.09].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, t + delay);
      osc.frequency.exponentialRampToValueAtTime(38, t + delay + 0.22);

      gain.gain.setValueAtTime(0.65, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.25);

      osc.connect(gain);
      this.routeSpatial(gain, pos);

      osc.start(t + delay);
      osc.stop(t + delay + 0.28);
    });

    this.playNoiseBurst(0.2, 800, 0.4, pos);
  }

  /**
   * QUEEN: Telekinetic Arcane Crush - Swirling gravitational compression and glass implosion
   */
  public playTelekineticCrush(pos?: THREE.Vector3 | string): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const t = ctx.currentTime;

    // Resonant vortex tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.linearRampToValueAtTime(880, t + 0.5);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.8);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(500, t);
    filter.Q.setValueAtTime(6.0, t);

    gain.gain.setValueAtTime(0.05, t);
    gain.gain.linearRampToValueAtTime(0.4, t + 0.45);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);

    osc.connect(filter);
    filter.connect(gain);
    this.routeSpatial(gain, pos);

    osc.start(t);
    osc.stop(t + 0.9);
  }

  /**
   * WEATHER: Thunder rumble rolling through cathedral stained-glass
   */
  public playThunder(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(60, t);
    osc.frequency.linearRampToValueAtTime(35, t + 1.8);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.5, t + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 2.4);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 2.5);

    // Low rolling rumble noise
    this.playNoiseBurst(2.2, 90, 0.6);
  }

  /**
   * ARCANE MODE: Spell Cast Sound
   */
  public playSpellCast(type: 'freeze' | 'revive' | 'warp'): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const t = ctx.currentTime;
    if (type === 'freeze') {
      // High frost crystallization
      [1400, 1800, 2200].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + idx * 0.05);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + idx * 0.05 + 0.35);

        gain.gain.setValueAtTime(0.2, t + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.05 + 0.4);

        osc.connect(gain);
        gain.connect(this.masterGain!);

        osc.start(t + idx * 0.05);
        osc.stop(t + idx * 0.05 + 0.45);
      });
      this.playNoiseBurst(0.4, 4500, 0.3);
    } else if (type === 'revive') {
      // Celestial choir chord
      [220, 277.18, 329.63, 440].forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.01, t);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.8);

        osc.connect(gain);
        gain.connect(this.masterGain!);

        osc.start(t);
        osc.stop(t + 1.9);
      });
    } else if (type === 'warp') {
      // Teleport lightning pulse
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(1400, t + 0.3);
      osc.frequency.exponentialRampToValueAtTime(200, t + 0.6);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.7);
    }
  }

  /**
   * Checkmate Harmonic Chord: Arcane cathedral organ chord
   */
  public playCheckmate(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const t = ctx.currentTime;
    const chord = [73.42, 110.0, 146.83, 174.61, 220.0, 293.66];

    chord.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);

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
   * Puzzle Victory Fanfare
   */
  public playPuzzleSuccess(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const t = ctx.currentTime;
    // Major triumphant arpeggio: C5, E5, G5, C6
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.12);

      gain.gain.setValueAtTime(0.2, t + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.8);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(t + i * 0.12);
      osc.stop(t + i * 0.12 + 0.85);
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

  /**
   * Voice Command Recognized Confirmation Chime
   */
  public playVoiceRecognized(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.14);

    gain.gain.setValueAtTime(0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.22);
  }

  private playNoiseBurst(duration: number, centerFreq: number, volume: number, pos?: THREE.Vector3 | string): void {
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
    this.routeSpatial(gain, pos);

    whiteNoise.start(this.ctx.currentTime);
  }
}

export const cathedralAudio = new CathedralAudio();
export default cathedralAudio;
