import * as THREE from 'three';
import eventBus, { TurnChangedPayload } from '../core/EventBus';
import cathedralAudio from '../audio/CathedralAudio';

export type TimeControlMode = 'UNLIMITED' | 'BLITZ' | 'RAPID';

interface HourglassInstance {
  group: THREE.Group;
  color: 'w' | 'b';
  timeRemaining: number;
  initialTime: number;
  topSand: THREE.Mesh;
  bottomSand: THREE.Mesh;
  sandStream: THREE.Mesh;
  timeSprite: THREE.Sprite;
  timeCanvas: HTMLCanvasElement;
  timeCtx: CanvasRenderingContext2D;
  timeTexture: THREE.CanvasTexture;
}

export class CrystalHourglassManager {
  public group: THREE.Group;
  private whiteTimer: HourglassInstance;
  private blackTimer: HourglassInstance;
  private mode: TimeControlMode = 'UNLIMITED';
  private activeTurn: 'w' | 'b' = 'w';
  private isRunning: boolean = false;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    // Build White Hourglass (placed on player side of the altar step)
    this.whiteTimer = this.createHourglass('w', new THREE.Vector3(-10.2, 0.95, 0));
    // Build Black Hourglass (placed on opponent side of the altar step)
    this.blackTimer = this.createHourglass('b', new THREE.Vector3(10.2, 0.95, 0));

    this.group.add(this.whiteTimer.group);
    this.group.add(this.blackTimer.group);

    this.initEvents();
    this.setVisible(false); // Hidden during Unlimited mode
  }

  private initEvents(): void {
    eventBus.on('TURN_CHANGED', ({ turn, isCheckmate, isDraw }) => {
      this.activeTurn = turn;
      if (isCheckmate || isDraw) {
        this.isRunning = false;
      }
    });

    eventBus.on('TIME_CONTROL_CHANGED', (mode: TimeControlMode) => {
      this.setMode(mode);
    });

    eventBus.on('GAME_RESET', () => {
      this.resetTimers();
    });
  }

  public setMode(mode: TimeControlMode): void {
    this.mode = mode;
    let seconds = 0;
    if (mode === 'BLITZ') seconds = 180; // 3 minutes
    if (mode === 'RAPID') seconds = 600; // 10 minutes

    this.whiteTimer.initialTime = seconds;
    this.whiteTimer.timeRemaining = seconds;
    this.blackTimer.initialTime = seconds;
    this.blackTimer.timeRemaining = seconds;

    this.setVisible(mode !== 'UNLIMITED');
    this.isRunning = mode !== 'UNLIMITED';
    this.activeTurn = 'w';
    this.updateCanvasDisplay(this.whiteTimer);
    this.updateCanvasDisplay(this.blackTimer);
  }

  public getMode(): TimeControlMode {
    return this.mode;
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  private createHourglass(color: 'w' | 'b', position: THREE.Vector3): HourglassInstance {
    const group = new THREE.Group();
    group.position.copy(position);

    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.35,
      metalness: 0.85
    });

    const obsidianMat = new THREE.MeshStandardMaterial({
      color: 0x14151b,
      roughness: 0.6,
      metalness: 0.2
    });

    // 1. Top and Bottom Hexagonal End Caps
    const capGeo = new THREE.CylinderGeometry(0.85, 0.95, 0.22, 6);
    const topCap = new THREE.Mesh(capGeo, obsidianMat);
    topCap.position.y = 2.4;
    topCap.castShadow = true;
    group.add(topCap);

    const bottomCap = new THREE.Mesh(capGeo, obsidianMat);
    bottomCap.position.y = 0.11;
    bottomCap.castShadow = true;
    bottomCap.receiveShadow = true;
    group.add(bottomCap);

    // Brass End Trim Rings
    const trimGeo = new THREE.TorusGeometry(0.9, 0.05, 8, 24);
    const topTrim = new THREE.Mesh(trimGeo, brassMat);
    topTrim.position.y = 2.3;
    topTrim.rotation.x = Math.PI / 2;
    group.add(topTrim);

    const bottomTrim = new THREE.Mesh(trimGeo, brassMat);
    bottomTrim.position.y = 0.22;
    bottomTrim.rotation.x = Math.PI / 2;
    group.add(bottomTrim);

    // 2. 3 Support Columns
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const colGeo = new THREE.CylinderGeometry(0.045, 0.045, 2.1, 8);
      const col = new THREE.Mesh(colGeo, brassMat);
      col.position.set(Math.cos(angle) * 0.78, 1.25, Math.sin(angle) * 0.78);
      col.castShadow = true;
      group.add(col);
    }

    // 3. Transparent Crystal Glass Double Bulbs
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    });

    // Top bulb cone
    const bulbTopGeo = new THREE.ConeGeometry(0.68, 0.95, 24, 1, true);
    bulbTopGeo.rotateX(Math.PI);
    const bulbTop = new THREE.Mesh(bulbTopGeo, glassMat);
    bulbTop.position.y = 1.75;
    group.add(bulbTop);

    // Bottom bulb cone
    const bulbBottomGeo = new THREE.ConeGeometry(0.68, 0.95, 24, 1, true);
    const bulbBottom = new THREE.Mesh(bulbBottomGeo, glassMat);
    bulbBottom.position.y = 0.75;
    group.add(bulbBottom);

    // 4. Flowing Arcane Sand
    const sandColor = color === 'w' ? 0xfef08a : 0x38bdf8;
    const sandMat = new THREE.MeshStandardMaterial({
      color: sandColor,
      emissive: sandColor,
      emissiveIntensity: 0.65,
      roughness: 0.8
    });

    // Top Sand (depleting)
    const topSandGeo = new THREE.ConeGeometry(0.65, 0.85, 20);
    topSandGeo.rotateX(Math.PI);
    const topSand = new THREE.Mesh(topSandGeo, sandMat);
    topSand.position.y = 1.8;
    group.add(topSand);

    // Bottom Sand (accumulating)
    const bottomSandGeo = new THREE.ConeGeometry(0.65, 0.85, 20);
    const bottomSand = new THREE.Mesh(bottomSandGeo, sandMat);
    bottomSand.position.y = 0.45;
    bottomSand.scale.set(0.1, 0.1, 0.1);
    group.add(bottomSand);

    // Narrow Trickle Sand Stream
    const streamGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.75, 8);
    const sandStream = new THREE.Mesh(streamGeo, sandMat);
    sandStream.position.y = 1.25;
    group.add(sandStream);

    // 5. Floating Glowing Runic Digital Timer
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const texture = new THREE.CanvasTexture(canvas);

    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    });
    const timeSprite = new THREE.Sprite(spriteMat);
    timeSprite.position.set(0, 3.1, 0);
    timeSprite.scale.set(2.2, 1.1, 1);
    group.add(timeSprite);

    const instance: HourglassInstance = {
      group,
      color,
      timeRemaining: 180,
      initialTime: 180,
      topSand,
      bottomSand,
      sandStream,
      timeSprite,
      timeCanvas: canvas,
      timeCtx: ctx,
      timeTexture: texture
    };

    this.updateCanvasDisplay(instance);
    return instance;
  }

  private updateCanvasDisplay(timer: HourglassInstance): void {
    const ctx = timer.timeCtx;
    ctx.clearRect(0, 0, 256, 128);

    const minutes = Math.floor(timer.timeRemaining / 60);
    const seconds = Math.floor(timer.timeRemaining % 60);
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    // Glowing badge background
    ctx.fillStyle = 'rgba(15, 17, 24, 0.85)';
    ctx.beginPath();
    ctx.roundRect(16, 20, 224, 88, 20);
    ctx.fill();

    ctx.strokeStyle = timer.color === 'w' ? '#fbbf24' : '#38bdf8';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Time text
    ctx.font = 'bold 52px "Cinzel", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (timer.timeRemaining <= 20) {
      ctx.fillStyle = '#ef4444'; // Red warning pulse
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 14;
    } else {
      ctx.fillStyle = timer.color === 'w' ? '#fef08a' : '#7dd3fc';
      ctx.shadowColor = timer.color === 'w' ? '#f59e0b' : '#0284c7';
      ctx.shadowBlur = 10;
    }

    ctx.fillText(timeStr, 128, 64);
    timer.timeTexture.needsUpdate = true;
  }

  public update(delta: number, elapsed: number): void {
    if (!this.group.visible || this.mode === 'UNLIMITED' || !this.isRunning) return;

    // Drain active player's clock
    const active = this.activeTurn === 'w' ? this.whiteTimer : this.blackTimer;
    const inactive = this.activeTurn === 'w' ? this.blackTimer : this.whiteTimer;

    active.timeRemaining = Math.max(0, active.timeRemaining - delta);
    this.updateCanvasDisplay(active);

    // Calculate sand fraction
    const frac = active.initialTime > 0 ? (active.timeRemaining / active.initialTime) : 1;
    active.topSand.scale.set(frac, frac, frac);
    const bottomFrac = 1.0 - frac;
    active.bottomSand.scale.set(bottomFrac, bottomFrac, bottomFrac);
    active.sandStream.visible = active.timeRemaining > 0;

    inactive.sandStream.visible = false;

    // Floating subtle bob
    this.whiteTimer.group.position.y = 0.95 + Math.sin(elapsed * 2.0) * 0.08;
    this.blackTimer.group.position.y = 0.95 + Math.sin(elapsed * 2.0 + Math.PI) * 0.08;

    // Time Forfeit check
    if (active.timeRemaining <= 0) {
      this.isRunning = false;
      const winner = this.activeTurn === 'w' ? 'Black' : 'White';
      cathedralAudio.playCheckmate();
      eventBus.emit('TIME_FORFEIT', {
        loser: this.activeTurn,
        winner
      });
    }
  }

  public resetTimers(): void {
    this.setMode(this.mode);
  }
}

export default CrystalHourglassManager;
