import * as THREE from 'three';
import gsap from 'gsap';
import { PieceEntity } from '../entities/PieceEntity';
import { squareToWorld, PIECE_HOVER_Y, ANIMATION_CONFIG } from '../config/constants';
import cathedralAudio from '../audio/CathedralAudio';
import eventBus from '../core/EventBus';

export class CombatChoreographer {
  private isAnimating: boolean = false;

  constructor() {
    // Event listeners
  }

  public getIsAnimating(): boolean {
    return this.isAnimating;
  }

  /**
   * Smooth parabolic move glide with forward tilt and stone slide audio.
   */
  public animateMove(
    piece: PieceEntity,
    targetSquare: string,
    onComplete?: () => void
  ): gsap.core.Timeline {
    this.isAnimating = true;
    piece.setState('MOVE');

    const startPos = piece.mesh.position.clone();
    const endPos = squareToWorld(targetSquare);
    endPos.y = PIECE_HOVER_Y;

    // Movement direction for tilt
    const dir = new THREE.Vector3().subVectors(endPos, startPos).normalize();
    const tiltAngle = 0.12;

    // Play sliding rumble
    cathedralAudio.playStoneSlide();

    const tl = gsap.timeline({
      onComplete: () => {
        piece.mesh.rotation.x = 0;
        piece.mesh.rotation.z = 0;
        piece.setSquare(targetSquare);
        piece.setState('IDLE');
        this.isAnimating = false;

        // Subtle landing thud
        cathedralAudio.playImpactThud();

        if (onComplete) onComplete();
      }
    });

    const duration = ANIMATION_CONFIG.moveGlideDuration; // 0.75s

    // Parabolic elevation arc: rise and land
    tl.to(piece.mesh.position, {
      y: PIECE_HOVER_Y + 0.85,
      duration: duration * 0.45,
      ease: 'power2.out'
    }, 0);

    tl.to(piece.mesh.position, {
      y: PIECE_HOVER_Y,
      duration: duration * 0.55,
      ease: 'bounce.out'
    }, duration * 0.45);

    // X & Z linear translation
    tl.to(piece.mesh.position, {
      x: endPos.x,
      z: endPos.z,
      duration: duration,
      ease: 'power2.inOut'
    }, 0);

    // Forward tilt during acceleration, returning to level
    const rotX = dir.z * tiltAngle;
    const rotZ = -dir.x * tiltAngle;

    tl.to(piece.mesh.rotation, {
      x: rotX,
      z: rotZ,
      duration: duration * 0.35,
      ease: 'power1.out'
    }, 0);

    tl.to(piece.mesh.rotation, {
      x: 0,
      z: 0,
      duration: duration * 0.65,
      ease: 'power2.out'
    }, duration * 0.35);

    return tl;
  }

  /**
   * Attack sequence: Approach, Wind-up with charging glow, Lunge, Shatter victim, Claim square.
   */
  public animateAttack(
    attacker: PieceEntity,
    victim: PieceEntity,
    targetSquare: string,
    onComplete?: () => void
  ): gsap.core.Timeline {
    this.isAnimating = true;
    attacker.setState('ATTACK');
    victim.setState('SHATTER');

    const startPos = attacker.mesh.position.clone();
    const victimPos = squareToWorld(targetSquare);
    victimPos.y = PIECE_HOVER_Y;

    // Vector towards victim
    const attackVec = new THREE.Vector3().subVectors(victimPos, startPos);
    const attackDir = attackVec.clone().normalize();
    const approachDistance = 1.35; // Halt just in front of victim for wind-up

    const approachPos = new THREE.Vector3().subVectors(
      victimPos,
      attackDir.clone().multiplyScalar(approachDistance)
    );
    approachPos.y = PIECE_HOVER_Y;

    const windupPos = new THREE.Vector3().subVectors(
      approachPos,
      attackDir.clone().multiplyScalar(0.4) // Pull back
    );
    windupPos.y = PIECE_HOVER_Y + 0.45;

    const tl = gsap.timeline({
      onComplete: () => {
        attacker.mesh.rotation.x = 0;
        attacker.mesh.rotation.z = 0;
        attacker.setSquare(targetSquare);
        attacker.setState('IDLE');
        this.isAnimating = false;

        if (onComplete) onComplete();
      }
    });

    // 1. Attack Glide to Approach Position
    tl.call(() => cathedralAudio.playStoneSlide());

    tl.to(attacker.mesh.position, {
      x: approachPos.x,
      z: approachPos.z,
      y: PIECE_HOVER_Y + 0.3,
      duration: ANIMATION_CONFIG.attackGlideDuration,
      ease: 'power2.out'
    });

    // 2. Threatening Wind-up: Pull back and rise
    tl.to(attacker.mesh.position, {
      x: windupPos.x,
      z: windupPos.z,
      y: windupPos.y,
      duration: ANIMATION_CONFIG.windupDuration,
      ease: 'power1.out'
    });

    // Backward tilt during wind-up
    tl.to(attacker.mesh.rotation, {
      x: -attackDir.z * 0.22,
      z: attackDir.x * 0.22,
      duration: ANIMATION_CONFIG.windupDuration,
      ease: 'power1.out'
    }, '<');

    // 3. Arcane Lunge Strike forward into victim
    tl.to(attacker.mesh.position, {
      x: victimPos.x - attackDir.x * 0.2,
      z: victimPos.z - attackDir.z * 0.2,
      y: PIECE_HOVER_Y,
      duration: ANIMATION_CONFIG.lungeDuration,
      ease: 'power3.in'
    });

    tl.to(attacker.mesh.rotation, {
      x: attackDir.z * 0.3,
      z: -attackDir.x * 0.3,
      duration: ANIMATION_CONFIG.lungeDuration,
      ease: 'power3.in'
    }, '<');

    // 4. INSTANT OF IMPACT: Victim explodes into 30 shards!
    tl.call(() => {
      // Audio shatter burst
      cathedralAudio.playShatter();

      // Hide victim mesh & mark dead
      victim.setVisible(false);
      victim.setState('DEAD');

      // Trigger 30-shard physics explosion & shockwave
      eventBus.emit('PIECE_SHATTERED', {
        x: victimPos.x,
        y: victimPos.y,
        z: victimPos.z,
        color: victim.color,
        pieceType: victim.type
      });
    });

    // 5. Claim Square & Recoil
    tl.to(attacker.mesh.position, {
      x: victimPos.x,
      z: victimPos.z,
      y: PIECE_HOVER_Y,
      duration: ANIMATION_CONFIG.recoilDuration,
      ease: 'elastic.out(1, 0.5)'
    });

    tl.to(attacker.mesh.rotation, {
      x: 0,
      z: 0,
      duration: ANIMATION_CONFIG.recoilDuration,
      ease: 'power2.out'
    }, '<');

    return tl;
  }
}

export const combatChoreographer = new CombatChoreographer();
export default combatChoreographer;
