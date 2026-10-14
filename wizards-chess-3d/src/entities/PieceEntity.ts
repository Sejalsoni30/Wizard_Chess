import * as THREE from 'three';
import { squareToWorld, ANIMATION_CONFIG, PIECE_HOVER_Y } from '../config/constants';
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

  constructor(type: 'p' | 'r' | 'n' | 'b' | 'q' | 'k', color: 'w' | 'b', square: string) {
    this.id = `${color}-${type}-${square}-${Math.random().toString(36).substring(2, 7)}`;
    this.type = type;
    this.color = color;
    this.square = square;

    this.mesh = PieceFactory.createPieceMesh(type, color);
    this.runeRing = (this.mesh.userData.runeRing as THREE.Mesh) || null;

    const wPos = squareToWorld(square);
    this.basePosition = new THREE.Vector3(wPos.x, PIECE_HOVER_Y, wPos.z);
    this.mesh.position.copy(this.basePosition);

    // Randomize breath phase so pieces breathe asynchronously
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

  public update(delta: number, elapsed: number): void {
    if (!this.mesh.visible || this.state === 'DEAD') return;

    if (this.state === 'IDLE') {
      // 1. Continuous sine-wave vertical breathing levitation
      const breath = Math.sin(elapsed * ANIMATION_CONFIG.idleBreathSpeed + this.breathPhase) * ANIMATION_CONFIG.idleBreathAmp;
      this.mesh.position.y = this.basePosition.y + breath;

      // 2. Rotating base rune ring
      if (this.runeRing) {
        this.runeRing.rotation.z += delta * ANIMATION_CONFIG.runeRotationSpeed;
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
