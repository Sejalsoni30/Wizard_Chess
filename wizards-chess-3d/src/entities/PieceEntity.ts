import * as THREE from 'three';
import { squareToWorld, ANIMATION_CONFIG, PIECE_HOVER_Y, COLOR_PALETTE } from '../config/constants';
import PieceFactory from './PieceFactory';

export type PieceState = 'IDLE' | 'MOVE' | 'ATTACK' | 'SHATTER' | 'DEAD';

export class PieceEntity {
  public id: string;
  public type: 'p' | 'r' | 'n' | 'b' | 'q' | 'k';
  public color: 'w' | 'b';
  public square: string;
  public mesh: THREE.Group;
  public state: PieceState = 'IDLE';

  public basePosition: THREE.Vector3;
  private breathPhase: number;
  private runeRing: THREE.Mesh | null = null;

  // Living Piece Reactions
  private isTrembling: boolean = false;
  private isCheckGlow: boolean = false;
  private checkAuraLight: THREE.PointLight | null = null;
  private originalRuneColor: THREE.Color | null = null;

  // Arcane Mode: Freeze Spell
  private isFrozen: boolean = false;
  private iceBlockMesh: THREE.Mesh | null = null;

  constructor(type: 'p' | 'r' | 'n' | 'b' | 'q' | 'k', color: 'w' | 'b', square: string) {
    this.id = `${color}-${type}-${square}-${Math.random().toString(36).substring(2, 7)}`;
    this.type = type;
    this.color = color;
    this.square = square;

    this.mesh = PieceFactory.createPieceMesh(type, color);
    this.runeRing = (this.mesh.userData.runeRing as THREE.Mesh) || null;

    if (this.runeRing && (this.runeRing.material as THREE.MeshBasicMaterial).color) {
      this.originalRuneColor = (this.runeRing.material as THREE.MeshBasicMaterial).color.clone();
    }

    const wPos = squareToWorld(square);
    this.basePosition = new THREE.Vector3(wPos.x, PIECE_HOVER_Y, wPos.z);
    this.mesh.position.copy(this.basePosition);

    this.breathPhase = Math.random() * Math.PI * 2;
  }

  public setState(state: PieceState): void {
    this.state = state;
    if (state === 'IDLE') {
      const wPos = squareToWorld(this.square);
      this.basePosition.set(wPos.x, PIECE_HOVER_Y, wPos.z);
    }
  }

  public setSquare(square: string): void {
    this.square = square;
    const wPos = squareToWorld(square);
    this.basePosition.set(wPos.x, PIECE_HOVER_Y, wPos.z);
  }

  public setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }

  /**
   * Blunder Tremble: Piece vibrates anxiously when a blunder or sacrifice is imminent
   */
  public setTremble(tremble: boolean): void {
    this.isTrembling = tremble;
    if (!tremble) {
      this.mesh.rotation.z = 0;
      this.mesh.rotation.x = 0;
    }
  }

  public getIsTrembling(): boolean {
    return this.isTrembling;
  }

  /**
   * Check Red Glow: The King glows red with pulsing crimson aura when in Check!
   */
  public setCheck(inCheck: boolean): void {
    if (this.type !== 'k') return;
    this.isCheckGlow = inCheck;

    if (inCheck) {
      if (!this.checkAuraLight) {
        this.checkAuraLight = new THREE.PointLight(0xef4444, 3.5, 4.5, 2.0);
        this.checkAuraLight.position.set(0, 1.2, 0);
        this.mesh.add(this.checkAuraLight);
      }
      this.checkAuraLight.visible = true;

      if (this.runeRing) {
        (this.runeRing.material as THREE.MeshBasicMaterial).color.setHex(0xff1e1e);
      }
    } else {
      if (this.checkAuraLight) {
        this.checkAuraLight.visible = false;
      }
      if (this.runeRing && this.originalRuneColor) {
        (this.runeRing.material as THREE.MeshBasicMaterial).color.copy(this.originalRuneColor);
      }
    }
  }

  /**
   * Arcane Mode: Freeze Spell Crystal
   */
  public setFrozen(frozen: boolean): void {
    this.isFrozen = frozen;
    if (frozen) {
      if (!this.iceBlockMesh) {
        const iceGeo = new THREE.OctahedronGeometry(1.2, 1);
        iceGeo.scale(0.85, 1.6, 0.85);
        const iceMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 0.8,
          roughness: 0.1,
          metalness: 0.1,
          transparent: true,
          opacity: 0.55
        });
        this.iceBlockMesh = new THREE.Mesh(iceGeo, iceMat);
        this.iceBlockMesh.position.set(0, 1.0, 0);
        this.mesh.add(this.iceBlockMesh);
      }
      this.iceBlockMesh.visible = true;
    } else {
      if (this.iceBlockMesh) {
        this.iceBlockMesh.visible = false;
      }
    }
  }

  public getIsFrozen(): boolean {
    return this.isFrozen;
  }

  public update(delta: number, elapsed: number): void {
    if (!this.mesh.visible || this.state === 'DEAD') return;

    if (this.state === 'IDLE') {
      // 1. Idle vertical levitation (unless frozen in ice)
      if (!this.isFrozen) {
        const breath = Math.sin(elapsed * ANIMATION_CONFIG.idleBreathSpeed + this.breathPhase) * ANIMATION_CONFIG.idleBreathAmp;
        this.mesh.position.y = this.basePosition.y + breath;
      }

      // 2. Base rune ring rotation
      if (this.runeRing) {
        this.runeRing.rotation.z += delta * ANIMATION_CONFIG.runeRotationSpeed;
      }

      // 3. Living Piece Reaction: Blunder Tremble
      if (this.isTrembling) {
        const jitterX = (Math.sin(elapsed * 48) + Math.cos(elapsed * 32)) * 0.035;
        const jitterZ = (Math.cos(elapsed * 44) + Math.sin(elapsed * 28)) * 0.035;
        const jitterTilt = Math.sin(elapsed * 40) * 0.045;

        this.mesh.position.x = this.basePosition.x + jitterX;
        this.mesh.position.z = this.basePosition.z + jitterZ;
        this.mesh.rotation.z = jitterTilt;
      } else {
        this.mesh.position.x = this.basePosition.x;
        this.mesh.position.z = this.basePosition.z;
        this.mesh.rotation.z = 0;
      }

      // 4. Living Piece Reaction: Crimson Check Aura Pulse
      if (this.isCheckGlow && this.checkAuraLight) {
        const heartbeat = (Math.sin(elapsed * 7.5) + 1.0) * 0.5;
        this.checkAuraLight.intensity = 2.0 + heartbeat * 3.5;
      }

      // 5. Frozen crystal slow rotation
      if (this.isFrozen && this.iceBlockMesh) {
        this.iceBlockMesh.rotation.y += delta * 0.6;
      }
    }
  }

  public dispose(): void {
    this.state = 'DEAD';
    this.mesh.visible = false;
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    });
  }
}

export default PieceEntity;
