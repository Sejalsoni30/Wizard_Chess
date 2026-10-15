import * as THREE from 'three';
import gsap from 'gsap';
import { PieceEntity } from '../entities/PieceEntity';
import { squareToWorld, PIECE_HOVER_Y, ANIMATION_CONFIG, COLOR_PALETTE } from '../config/constants';
import cathedralAudio from '../audio/CathedralAudio';
import eventBus from '../core/EventBus';

export class CombatChoreographer {
  private isAnimating: boolean = false;
  private fxGroup: THREE.Group;

  constructor(scene?: THREE.Scene) {
    this.fxGroup = new THREE.Group();
    if (scene) {
      scene.add(this.fxGroup);
    }
  }

  public setScene(scene: THREE.Scene): void {
    if (!this.fxGroup.parent) {
      scene.add(this.fxGroup);
    }
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

    const dir = new THREE.Vector3().subVectors(endPos, startPos).normalize();
    const tiltAngle = 0.12;

    // Spatial sliding rumble
    cathedralAudio.playStoneSlide(startPos);

    const tl = gsap.timeline({
      onComplete: () => {
        piece.mesh.rotation.x = 0;
        piece.mesh.rotation.z = 0;
        piece.setSquare(targetSquare);
        piece.setState('IDLE');
        this.isAnimating = false;

        // Subtle landing thud with spatial pan
        cathedralAudio.playImpactThud(endPos);

        if (onComplete) onComplete();
      }
    });

    const duration = ANIMATION_CONFIG.moveGlideDuration;

    // Parabolic elevation arc
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

    // Forward tilt during acceleration
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
   * Dispatches to unique kill animations based on attacker piece type:
   * - Rook: Seismic-Slam
   * - Bishop: Shoot Light Beams
   * - Knight: Warhorse Stomp
   * - Queen: Telekinetic Arcane Crush
   * - Pawn/King: Precision Blade Strike
   */
  public animateAttack(
    attacker: PieceEntity,
    victim: PieceEntity,
    targetSquare: string,
    onComplete?: () => void
  ): gsap.core.Timeline {
    const isHighValue = victim.type === 'q' || victim.type === 'r' || attacker.type === 'q';
    const victimPos = squareToWorld(targetSquare);

    if (isHighValue) {
      eventBus.emit('CINEMATIC_ACTION_CAM_TRIGGERED', victimPos);
    }

    switch (attacker.type) {
      case 'r':
        return this.animateRookSeismicSlam(attacker, victim, targetSquare, onComplete);
      case 'b':
        return this.animateBishopLightBeam(attacker, victim, targetSquare, onComplete);
      case 'n':
        return this.animateKnightStomp(attacker, victim, targetSquare, onComplete);
      case 'q':
        return this.animateQueenTelekineticCrush(attacker, victim, targetSquare, onComplete);
      default:
        return this.animateStandardAttack(attacker, victim, targetSquare, onComplete);
    }
  }

  /**
   * 1. ROOK: Seismic Slam
   * Ascends skyward, charges gravitational mass, and slams down with earth-shattering seismic force!
   */
  private animateRookSeismicSlam(
    attacker: PieceEntity,
    victim: PieceEntity,
    targetSquare: string,
    onComplete?: () => void
  ): gsap.core.Timeline {
    this.isAnimating = true;
    attacker.setState('ATTACK');
    victim.setState('SHATTER');

    const victimPos = squareToWorld(targetSquare);
    victimPos.y = PIECE_HOVER_Y;

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

    // 1. Skyward Ascent: Rook rises high above board while hovering over target
    tl.to(attacker.mesh.position, {
      x: victimPos.x,
      z: victimPos.z,
      y: PIECE_HOVER_Y + 5.5,
      duration: 0.75,
      ease: 'power2.out'
    });

    // Tremor vibration at apex
    tl.to(attacker.mesh.rotation, {
      z: 0.15,
      x: 0.1,
      duration: 0.08,
      yoyo: true,
      repeat: 4
    });

    // 2. SEISMIC METEOR SLAM: Drops at terminal velocity straight down
    tl.to(attacker.mesh.position, {
      y: PIECE_HOVER_Y,
      duration: 0.28,
      ease: 'power4.in',
      onComplete: () => {
        // Massive seismic impact
        cathedralAudio.playSeismicSlam(victimPos);
        cathedralAudio.playShatter(victimPos);

        victim.setVisible(false);
        victim.setState('DEAD');

        eventBus.emit('PIECE_SHATTERED', {
          x: victimPos.x,
          y: victimPos.y,
          z: victimPos.z,
          color: victim.color,
          pieceType: victim.type
        });

        // Heavy camera shake
        eventBus.emit('CAMERA_SHAKE_TRIGGERED', {
          intensity: 0.65,
          duration: 0.55
        });
      }
    });

    // 3. Ground Impact Recoil
    tl.to(attacker.mesh.position, {
      y: PIECE_HOVER_Y + 0.35,
      duration: 0.18,
      ease: 'power2.out'
    });
    tl.to(attacker.mesh.position, {
      y: PIECE_HOVER_Y,
      duration: 0.25,
      ease: 'bounce.out'
    });

    return tl;
  }

  /**
   * 2. BISHOP: Celestial Light Beam
   * Hovers, charges celestial energy rings, and fires a devastating solar light laser beam through the enemy!
   */
  private animateBishopLightBeam(
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

    // 1. Bishop elevates into celestial casting stance
    tl.to(attacker.mesh.position, {
      y: PIECE_HOVER_Y + 1.8,
      duration: 0.45,
      ease: 'power2.out',
      onStart: () => {
        cathedralAudio.playLaserBeam(startPos);
      }
    });

    // 2. Fire Celestial Light Beam Mesh
    tl.call(() => {
      const distance = startPos.distanceTo(victimPos);
      const beamGeo = new THREE.CylinderGeometry(0.22, 0.22, distance, 16);
      beamGeo.rotateX(Math.PI / 2); // align along Z

      const beamMat = new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      const beam = new THREE.Mesh(beamGeo, beamMat);
      const midPoint = new THREE.Vector3().addVectors(startPos, victimPos).multiplyScalar(0.5);
      midPoint.y = PIECE_HOVER_Y + 1.0;
      beam.position.copy(midPoint);
      beam.lookAt(victimPos);

      this.fxGroup.add(beam);

      // Beam flash & dissolution
      gsap.to(beam.scale, {
        x: 2.2,
        y: 2.2,
        duration: 0.2,
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          this.fxGroup.remove(beam);
          beam.geometry.dispose();
          beam.material.dispose();
        }
      });

      // Shatter victim at instant of beam contact
      cathedralAudio.playShatter(victimPos);
      victim.setVisible(false);
      victim.setState('DEAD');

      eventBus.emit('PIECE_SHATTERED', {
        x: victimPos.x,
        y: victimPos.y,
        z: victimPos.z,
        color: victim.color,
        pieceType: victim.type
      });
    });

    // 3. Bishop glides into the conquered square
    tl.to(attacker.mesh.position, {
      x: victimPos.x,
      z: victimPos.z,
      y: PIECE_HOVER_Y,
      duration: 0.65,
      ease: 'power2.inOut',
      delay: 0.35
    });

    return tl;
  }

  /**
   * 3. KNIGHT: Warhorse Leap & Hoof Stomp
   * Rears up, leaps forward in a high violent arc, and stomps down with devastating hoof shockwaves!
   */
  private animateKnightStomp(
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

    const dir = new THREE.Vector3().subVectors(victimPos, startPos).normalize();

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

    // 1. Rearing up on haunches: tilt back steeply
    tl.to(attacker.mesh.rotation, {
      x: -dir.z * 0.45,
      z: dir.x * 0.45,
      duration: 0.28,
      ease: 'power2.out'
    });

    tl.to(attacker.mesh.position, {
      y: PIECE_HOVER_Y + 1.2,
      duration: 0.28,
      ease: 'power2.out'
    }, '<');

    // 2. High Aggressive Parabolic Leap toward victim
    tl.to(attacker.mesh.position, {
      x: victimPos.x,
      z: victimPos.z,
      duration: 0.45,
      ease: 'power1.inOut'
    });

    tl.to(attacker.mesh.position, {
      y: PIECE_HOVER_Y + 3.2,
      duration: 0.22,
      ease: 'power2.out'
    }, '<');

    tl.to(attacker.mesh.position, {
      y: PIECE_HOVER_Y,
      duration: 0.23,
      ease: 'power3.in'
    }, '>-0.02');

    // Forward downward stomp tilt
    tl.to(attacker.mesh.rotation, {
      x: dir.z * 0.5,
      z: -dir.x * 0.5,
      duration: 0.25,
      ease: 'power3.in'
    }, '<');

    // 3. HOOF STOMP IMPACT!
    tl.call(() => {
      cathedralAudio.playHorseStomp(victimPos);
      cathedralAudio.playShatter(victimPos);

      victim.setVisible(false);
      victim.setState('DEAD');

      eventBus.emit('PIECE_SHATTERED', {
        x: victimPos.x,
        y: victimPos.y,
        z: victimPos.z,
        color: victim.color,
        pieceType: victim.type
      });

      eventBus.emit('CAMERA_SHAKE_TRIGGERED', {
        intensity: 0.48,
        duration: 0.4
      });
    });

    // Recoil to neutral
    tl.to(attacker.mesh.rotation, {
      x: 0,
      z: 0,
      duration: 0.25,
      ease: 'elastic.out(1, 0.4)'
    });

    return tl;
  }

  /**
   * 4. QUEEN: Telekinetic Arcane Crush
   * Queen raises her scepter, lifts the victim high into the air, spins them in a crushing arcane vortex, and implodes them!
   */
  private animateQueenTelekineticCrush(
    attacker: PieceEntity,
    victim: PieceEntity,
    targetSquare: string,
    onComplete?: () => void
  ): gsap.core.Timeline {
    this.isAnimating = true;
    attacker.setState('ATTACK');
    victim.setState('SHATTER');

    const victimPos = squareToWorld(targetSquare);
    victimPos.y = PIECE_HOVER_Y;

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

    // 1. Queen levitates majestically
    tl.to(attacker.mesh.position, {
      y: PIECE_HOVER_Y + 1.6,
      duration: 0.45,
      ease: 'power2.out',
      onStart: () => {
        cathedralAudio.playTelekineticCrush(victimPos);
      }
    });

    // 2. Victim piece is levitated helplessly into the air
    tl.to(victim.mesh.position, {
      y: PIECE_HOVER_Y + 2.4,
      duration: 0.45,
      ease: 'power2.out'
    }, '<+0.1');

    // 3. Telekinetic Vortex Ring spins and constricts victim
    let vortexMesh: THREE.Mesh | null = null;
    tl.call(() => {
      const ringGeo = new THREE.TorusGeometry(0.85, 0.08, 16, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xc084fc,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
      });
      vortexMesh = new THREE.Mesh(ringGeo, ringMat);
      vortexMesh.position.set(victimPos.x, PIECE_HOVER_Y + 2.4, victimPos.z);
      vortexMesh.rotation.x = Math.PI / 2;
      this.fxGroup.add(vortexMesh);

      gsap.to(vortexMesh.scale, {
        x: 0.2,
        y: 0.2,
        z: 0.2,
        duration: 0.5,
        ease: 'power3.in'
      });
      gsap.to(vortexMesh.rotation, {
        z: Math.PI * 4,
        duration: 0.5,
        ease: 'power3.in'
      });
    });

    // Victim piece shakes and compresses under immense telekinetic pressure
    tl.to(victim.mesh.scale, {
      x: 0.65,
      z: 0.65,
      y: 1.35,
      duration: 0.4,
      ease: 'power2.in'
    }, '<');

    tl.to(victim.mesh.rotation, {
      y: Math.PI * 3,
      duration: 0.45,
      ease: 'power2.in'
    }, '<');

    // 4. SUDDEN IMPLOSIVE SNAP: Piece explodes in mid-air!
    tl.call(() => {
      if (vortexMesh) {
        this.fxGroup.remove(vortexMesh);
        vortexMesh.geometry.dispose();
        (vortexMesh.material as THREE.Material).dispose();
      }

      cathedralAudio.playShatter(victimPos);
      victim.setVisible(false);
      victim.setState('DEAD');

      eventBus.emit('PIECE_SHATTERED', {
        x: victimPos.x,
        y: victimPos.y + 1.2,
        z: victimPos.z,
        color: victim.color,
        pieceType: victim.type
      });

      eventBus.emit('CAMERA_SHAKE_TRIGGERED', {
        intensity: 0.52,
        duration: 0.45
      });
    });

    // 5. Queen glides gracefully to claim the square
    tl.to(attacker.mesh.position, {
      x: victimPos.x,
      z: victimPos.z,
      y: PIECE_HOVER_Y,
      duration: 0.75,
      ease: 'power2.out',
      delay: 0.15
    });

    return tl;
  }

  /**
   * 5. Standard Tactical Attack (Pawns & Kings)
   */
  private animateStandardAttack(
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

    const attackVec = new THREE.Vector3().subVectors(victimPos, startPos);
    const attackDir = attackVec.clone().normalize();
    const approachDistance = 1.35;

    const approachPos = new THREE.Vector3().subVectors(
      victimPos,
      attackDir.clone().multiplyScalar(approachDistance)
    );
    approachPos.y = PIECE_HOVER_Y;

    const windupPos = new THREE.Vector3().subVectors(
      approachPos,
      attackDir.clone().multiplyScalar(0.4)
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

    tl.call(() => cathedralAudio.playStoneSlide(startPos));

    tl.to(attacker.mesh.position, {
      x: approachPos.x,
      z: approachPos.z,
      y: PIECE_HOVER_Y + 0.3,
      duration: ANIMATION_CONFIG.attackGlideDuration,
      ease: 'power2.out'
    });

    tl.to(attacker.mesh.position, {
      x: windupPos.x,
      z: windupPos.z,
      y: windupPos.y,
      duration: ANIMATION_CONFIG.windupDuration,
      ease: 'power1.out'
    });

    tl.to(attacker.mesh.rotation, {
      x: -attackDir.z * 0.22,
      z: attackDir.x * 0.22,
      duration: ANIMATION_CONFIG.windupDuration,
      ease: 'power1.out'
    }, '<');

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

    tl.call(() => {
      cathedralAudio.playShatter(victimPos);
      victim.setVisible(false);
      victim.setState('DEAD');

      eventBus.emit('PIECE_SHATTERED', {
        x: victimPos.x,
        y: victimPos.y,
        z: victimPos.z,
        color: victim.color,
        pieceType: victim.type
      });
    });

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
