import * as THREE from 'three';
import { BOARD_TOP_Y, SQUARE_SIZE } from '../config/constants';
import StoneMaterials from '../entities/StoneMaterials';
import eventBus from '../core/EventBus';

export class BattlefieldScars {
  public group: THREE.Group;
  private scarMeshes: THREE.Mesh[] = [];
  private rubbleMeshes: THREE.Mesh[] = [];
  private sharedDecalGeometry: THREE.PlaneGeometry;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.sharedDecalGeometry = new THREE.PlaneGeometry(SQUARE_SIZE * 0.92, SQUARE_SIZE * 0.92);
    this.initEvents();
  }

  private initEvents(): void {
    eventBus.on('PIECE_SHATTERED', ({ x, z, color }) => {
      this.addScar(new THREE.Vector3(x, BOARD_TOP_Y, z), color);
    });

    eventBus.on('GAME_RESET', () => {
      this.clearAll();
    });

    eventBus.on('BOARD_LOADED', () => {
      this.clearAll();
    });
  }

  /**
   * Leaves permanent floor cracks, scorch marks, and tiny stone rubble on the square
   */
  public addScar(pos: THREE.Vector3, victimColor: 'w' | 'b'): void {
    // 1. Procedural Scorch & Fracture Decal
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      const cx = 128;
      const cy = 128;

      // Scorch mark radial gradient
      const scorch = ctx.createRadialGradient(cx, cy, 10, cx, cy, 110);
      scorch.addColorStop(0, 'rgba(15, 12, 16, 0.92)');
      scorch.addColorStop(0.4, 'rgba(28, 22, 24, 0.75)');
      scorch.addColorStop(0.8, 'rgba(40, 30, 30, 0.35)');
      scorch.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = scorch;
      ctx.beginPath();
      ctx.arc(cx, cy, 110, 0, Math.PI * 2);
      ctx.fill();

      // Jagged fracture cracks spreading outward from impact epicenter
      ctx.strokeStyle = '#050508';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';

      const crackCount = 7 + Math.floor(Math.random() * 5);
      for (let i = 0; i < crackCount; i++) {
        let currX = cx;
        let currY = cy;
        let angle = (i / crackCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const length = 50 + Math.random() * 60;
        const segments = 5;

        ctx.beginPath();
        ctx.moveTo(currX, currY);

        for (let s = 0; s < segments; s++) {
          const segLen = length / segments;
          angle += (Math.random() - 0.5) * 0.7;
          currX += Math.cos(angle) * segLen;
          currY += Math.sin(angle) * segLen;
          ctx.lineTo(currX, currY);

          // Occasional sub-branch
          if (Math.random() > 0.6) {
            const branchAngle = angle + (Math.random() > 0.5 ? 0.6 : -0.6);
            ctx.moveTo(currX, currY);
            ctx.lineTo(currX + Math.cos(branchAngle) * 18, currY + Math.sin(branchAngle) * 18);
            ctx.moveTo(currX, currY);
          }
        }
        ctx.stroke();
      }

      // Smoldering ember specks (red/gold glowing points)
      for (let e = 0; e < 12; e++) {
        const er = Math.random() * 55;
        const ea = Math.random() * Math.PI * 2;
        const ex = cx + Math.cos(ea) * er;
        const ey = cy + Math.sin(ea) * er;
        ctx.fillStyle = victimColor === 'w' ? '#fde047' : '#ef4444';
        ctx.beginPath();
        ctx.arc(ex, ey, 1.2 + Math.random() * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const decalMat = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      roughness: 0.9,
      metalness: 0.1,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });

    const decal = new THREE.Mesh(this.sharedDecalGeometry, decalMat);
    decal.rotation.x = -Math.PI / 2;
    // Slight random rotation for natural variation
    decal.rotation.z = Math.random() * Math.PI * 2;
    decal.position.set(pos.x, BOARD_TOP_Y + 0.008 + this.scarMeshes.length * 0.0005, pos.z);
    decal.receiveShadow = true;

    this.group.add(decal);
    this.scarMeshes.push(decal);

    // 2. Permanent Tiny Stone Rubble Chunks
    const rubbleCount = 5 + Math.floor(Math.random() * 4);
    const baseMat = victimColor === 'w' ? StoneMaterials.getMarbleMaterial() : StoneMaterials.getObsidianMaterial();

    for (let i = 0; i < rubbleCount; i++) {
      const radius = 0.04 + Math.random() * 0.065;
      let geo: THREE.BufferGeometry;
      const type = i % 3;
      if (type === 0) geo = new THREE.TetrahedronGeometry(radius, 0);
      else if (type === 1) geo = new THREE.OctahedronGeometry(radius, 0);
      else geo = new THREE.DodecahedronGeometry(radius, 0);

      const rubble = new THREE.Mesh(geo, baseMat);
      rubble.castShadow = true;
      rubble.receiveShadow = true;

      const scatterR = 0.2 + Math.random() * 0.55;
      const scatterA = Math.random() * Math.PI * 2;
      rubble.position.set(
        pos.x + Math.cos(scatterA) * scatterR,
        BOARD_TOP_Y + radius * 0.8,
        pos.z + Math.sin(scatterA) * scatterR
      );

      rubble.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      this.group.add(rubble);
      this.rubbleMeshes.push(rubble);
    }
  }

  public clearAll(): void {
    for (const decal of this.scarMeshes) {
      this.group.remove(decal);
      if (decal.material instanceof THREE.Material) {
        decal.material.dispose();
      }
    }
    this.scarMeshes = [];

    for (const rubble of this.rubbleMeshes) {
      this.group.remove(rubble);
      rubble.geometry.dispose();
    }
    this.rubbleMeshes = [];
  }
}

export default BattlefieldScars;
