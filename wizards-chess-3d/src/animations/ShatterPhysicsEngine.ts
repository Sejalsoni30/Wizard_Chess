import * as THREE from 'three';
import { BOARD_TOP_Y, PHYSICS_CONFIG, COLOR_PALETTE } from '../config/constants';
import StoneMaterials from '../entities/StoneMaterials';
import eventBus from '../core/EventBus';

interface Shard {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  radius: number;
  age: number;
  maxAge: number;
}

interface Shockwave {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  age: number;
  maxAge: number;
}

export class ShatterPhysicsEngine {
  public group: THREE.Group;
  private shards: Shard[] = [];
  private shockwaves: Shockwave[] = [];

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.initEvents();
  }

  private initEvents(): void {
    eventBus.on('PIECE_SHATTERED', ({ x, y, z, color }) => {
      this.spawnShatter(new THREE.Vector3(x, y, z), color);
    });
  }

  /**
   * Spawns 30 polyhedral stone shards with radial outward impulse, -18 m/s² gravity,
   * floor bounce damping, shockwave ring, and 4-second dissolve cycle.
   */
  public spawnShatter(origin: THREE.Vector3, color: 'w' | 'b'): void {
    const shardCount = PHYSICS_CONFIG.shardCount; // 30
    const baseMat = color === 'w' ? StoneMaterials.getMarbleMaterial() : StoneMaterials.getObsidianMaterial();

    for (let i = 0; i < shardCount; i++) {
      // 1. Polyhedral Geometry Variety (Dodecahedron, Octahedron, Tetrahedron)
      const radius = 0.12 + Math.random() * 0.18;
      let geo: THREE.BufferGeometry;
      const typeChoice = i % 3;
      if (typeChoice === 0) {
        geo = new THREE.DodecahedronGeometry(radius, 0);
      } else if (typeChoice === 1) {
        geo = new THREE.OctahedronGeometry(radius, 0);
      } else {
        geo = new THREE.TetrahedronGeometry(radius, 0);
      }

      // Cloned material with transparency enabled for smooth 4s dissolve
      const shardMat = baseMat.clone();
      shardMat.transparent = true;
      shardMat.opacity = 1.0;

      const mesh = new THREE.Mesh(geo, shardMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Initial piece volume distribution
      const spawnY = origin.y + 0.2 + Math.random() * 1.6;
      mesh.position.set(
        origin.x + (Math.random() - 0.5) * 0.5,
        spawnY,
        origin.z + (Math.random() - 0.5) * 0.5
      );

      // Radial strike velocity
      const radialAngle = (i / shardCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const horizontalSpeed = 3.2 + Math.random() * 5.8;
      const vx = Math.cos(radialAngle) * horizontalSpeed;
      const vz = Math.sin(radialAngle) * horizontalSpeed;
      const vy = 3.5 + Math.random() * 7.5; // Upward explosive lift

      const velocity = new THREE.Vector3(vx, vy, vz);

      // Random tumbling angular velocity
      const angularVelocity = new THREE.Vector3(
        (Math.random() - 0.5) * 22,
        (Math.random() - 0.5) * 22,
        (Math.random() - 0.5) * 22
      );

      this.group.add(mesh);

      this.shards.push({
        mesh,
        material: shardMat,
        velocity,
        angularVelocity,
        radius,
        age: 0,
        maxAge: PHYSICS_CONFIG.dissolveDuration // 4.0s
      });
    }

    // 2. Expanding Arcane Shockwave Ring
    this.spawnShockwave(origin, color);

    // 3. Trigger Kinetic Camera Shake
    eventBus.emit('CAMERA_SHAKE_TRIGGERED', {
      intensity: 0.38,
      duration: 0.42
    });
  }

  private spawnShockwave(origin: THREE.Vector3, color: 'w' | 'b'): void {
    const ringGeo = new THREE.RingGeometry(0.1, 0.45, 32);
    const waveColor = color === 'w' ? COLOR_PALETTE.marbleGlow : COLOR_PALETTE.obsidianGlow;
    const ringMat = new THREE.MeshBasicMaterial({
      color: waveColor,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    const mesh = new THREE.Mesh(ringGeo, ringMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(origin.x, BOARD_TOP_Y + 0.02, origin.z);

    this.group.add(mesh);
    this.shockwaves.push({
      mesh,
      material: ringMat,
      age: 0,
      maxAge: PHYSICS_CONFIG.shockwaveDuration // 0.8s
    });
  }

  public update(delta: number): void {
    const gravity = PHYSICS_CONFIG.gravity; // -18 m/s²
    const floorY = BOARD_TOP_Y;

    // 1. Update Shards
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const shard = this.shards[i];
      shard.age += delta;

      // Physics integration
      shard.velocity.y += gravity * delta;
      shard.mesh.position.x += shard.velocity.x * delta;
      shard.mesh.position.y += shard.velocity.y * delta;
      shard.mesh.position.z += shard.velocity.z * delta;

      // Floor collision & damping
      const contactY = floorY + shard.radius;
      if (shard.mesh.position.y <= contactY) {
        shard.mesh.position.y = contactY;

        if (shard.velocity.y < 0) {
          // Invert and damp vertical bounce
          shard.velocity.y = -shard.velocity.y * PHYSICS_CONFIG.floorDamping;

          // Surface friction dampens horizontal slide
          shard.velocity.x *= PHYSICS_CONFIG.friction;
          shard.velocity.z *= PHYSICS_CONFIG.friction;
          shard.angularVelocity.multiplyScalar(0.7);

          // Stop micro-bounces
          if (Math.abs(shard.velocity.y) < 0.4) {
            shard.velocity.y = 0;
          }
        }
      }

      // Tumbling rotation
      shard.mesh.rotation.x += shard.angularVelocity.x * delta;
      shard.mesh.rotation.y += shard.angularVelocity.y * delta;
      shard.mesh.rotation.z += shard.angularVelocity.z * delta;

      // 4-second dissolve phase
      if (shard.age > 2.2) {
        const dissolveRemaining = shard.maxAge - shard.age;
        const progress = Math.max(0, dissolveRemaining / (shard.maxAge - 2.2));
        shard.material.opacity = progress;
        shard.mesh.scale.setScalar(Math.max(0.01, progress));
      }

      // Dissolve complete -> Dispose & Clean up
      if (shard.age >= shard.maxAge) {
        this.group.remove(shard.mesh);
        shard.mesh.geometry.dispose();
        shard.material.dispose();
        this.shards.splice(i, 1);
      }
    }

    // 2. Update Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const wave = this.shockwaves[i];
      wave.age += delta;
      const progress = wave.age / wave.maxAge;

      if (progress < 1.0) {
        // Expand ring outward
        const scale = 1.0 + progress * 8.0;
        wave.mesh.scale.set(scale, scale, scale);
        // Fade opacity to 0
        wave.material.opacity = (1.0 - progress) * 0.85;
      } else {
        this.group.remove(wave.mesh);
        wave.mesh.geometry.dispose();
        wave.material.dispose();
        this.shockwaves.splice(i, 1);
      }
    }
  }

  public clearAll(): void {
    for (const shard of this.shards) {
      this.group.remove(shard.mesh);
      shard.mesh.geometry.dispose();
      shard.material.dispose();
    }
    this.shards = [];

    for (const wave of this.shockwaves) {
      this.group.remove(wave.mesh);
      wave.mesh.geometry.dispose();
      wave.material.dispose();
    }
    this.shockwaves = [];
  }
}

export default ShatterPhysicsEngine;
