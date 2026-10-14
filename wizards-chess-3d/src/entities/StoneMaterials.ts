import * as THREE from 'three';
import { COLOR_PALETTE } from '../config/constants';

export class StoneMaterials {
  private static marbleMaterial: THREE.MeshStandardMaterial | null = null;
  private static obsidianMaterial: THREE.MeshStandardMaterial | null = null;
  private static goldMaterial: THREE.MeshStandardMaterial | null = null;
  private static whiteRuneMaterial: THREE.MeshBasicMaterial | null = null;
  private static blackRuneMaterial: THREE.MeshBasicMaterial | null = null;

  /**
   * Generates procedural canvas texture for White Carrara Marble.
   */
  public static createMarbleTextures(): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
    const size = 512;

    // 1. Diffuse / Color Map
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = size;
    colorCanvas.height = size;
    const ctx = colorCanvas.getContext('2d')!;

    // Base off-white tone
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#f8f6f0');
    grad.addColorStop(0.5, '#ede9e1');
    grad.addColorStop(1, '#f3f0e8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Procedural marble veins
    ctx.lineWidth = 1.5;
    for (let v = 0; v < 14; v++) {
      ctx.beginPath();
      let x = Math.random() * size;
      let y = Math.random() * size;
      ctx.moveTo(x, y);

      const alpha = 0.08 + Math.random() * 0.16;
      ctx.strokeStyle = `rgba(130, 134, 142, ${alpha})`;

      const steps = 18;
      for (let s = 0; s < steps; s++) {
        x += (Math.random() - 0.45) * 45;
        y += (Math.random() - 0.45) * 45;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Secondary fine hairline veins
    ctx.lineWidth = 0.8;
    for (let v = 0; v < 22; v++) {
      ctx.beginPath();
      let x = Math.random() * size;
      let y = Math.random() * size;
      ctx.moveTo(x, y);
      ctx.strokeStyle = `rgba(160, 164, 172, 0.12)`;
      for (let s = 0; s < 10; s++) {
        x += (Math.random() - 0.5) * 30;
        y += (Math.random() - 0.5) * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    const map = new THREE.CanvasTexture(colorCanvas);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;

    // 2. Bump Map
    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = size;
    bumpCanvas.height = size;
    const bCtx = bumpCanvas.getContext('2d')!;
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, size, size);

    const bImg = bCtx.getImageData(0, 0, size, size);
    const bData = bImg.data;
    for (let i = 0; i < bData.length; i += 4) {
      const n = (Math.random() - 0.5) * 22;
      const val = Math.min(255, Math.max(0, 128 + n));
      bData[i] = val;
      bData[i + 1] = val;
      bData[i + 2] = val;
    }
    bCtx.putImageData(bImg, 0, 0);

    const bumpMap = new THREE.CanvasTexture(bumpCanvas);
    bumpMap.wrapS = THREE.RepeatWrapping;
    bumpMap.wrapT = THREE.RepeatWrapping;

    return { map, bumpMap };
  }

  /**
   * Generates procedural canvas texture for Black Volcanic Obsidian.
   */
  public static createObsidianTextures(): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
    const size = 512;

    // 1. Color Map
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = size;
    colorCanvas.height = size;
    const ctx = colorCanvas.getContext('2d')!;

    // Vitreous dark pitch
    const grad = ctx.createRadialGradient(size / 2, size / 2, 20, size / 2, size / 2, size);
    grad.addColorStop(0, '#1a1920');
    grad.addColorStop(0.6, '#100f14');
    grad.addColorStop(1, '#09080c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Deep purple/magenta fracture veins
    ctx.lineWidth = 1.8;
    for (let v = 0; v < 16; v++) {
      ctx.beginPath();
      let x = Math.random() * size;
      let y = Math.random() * size;
      ctx.moveTo(x, y);

      const alpha = 0.12 + Math.random() * 0.18;
      ctx.strokeStyle = `rgba(168, 85, 247, ${alpha})`;

      const steps = 14;
      for (let s = 0; s < steps; s++) {
        x += (Math.random() - 0.48) * 50;
        y += (Math.random() - 0.48) * 50;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    const map = new THREE.CanvasTexture(colorCanvas);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;

    // 2. Bump Map with crystalline jagged fractures
    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = size;
    bumpCanvas.height = size;
    const bCtx = bumpCanvas.getContext('2d')!;
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, size, size);

    const bImg = bCtx.getImageData(0, 0, size, size);
    const bData = bImg.data;
    for (let i = 0; i < bData.length; i += 4) {
      const n = (Math.random() - 0.5) * 35;
      const val = Math.min(255, Math.max(0, 128 + n));
      bData[i] = val;
      bData[i + 1] = val;
      bData[i + 2] = val;
    }
    bCtx.putImageData(bImg, 0, 0);

    const bumpMap = new THREE.CanvasTexture(bumpCanvas);
    bumpMap.wrapS = THREE.RepeatWrapping;
    bumpMap.wrapT = THREE.RepeatWrapping;

    return { map, bumpMap };
  }

  public static getMarbleMaterial(): THREE.MeshStandardMaterial {
    if (!this.marbleMaterial) {
      const { map, bumpMap } = this.createMarbleTextures();
      this.marbleMaterial = new THREE.MeshStandardMaterial({
        map,
        bumpMap,
        bumpScale: 0.04,
        roughness: 0.32,
        metalness: 0.15,
        color: COLOR_PALETTE.marbleWhite,
        emissive: COLOR_PALETTE.marbleGlow,
        emissiveIntensity: 0.12 // Mystical Cyan rim sheen
      });
    }
    return this.marbleMaterial;
  }

  public static getObsidianMaterial(): THREE.MeshStandardMaterial {
    if (!this.obsidianMaterial) {
      const { map, bumpMap } = this.createObsidianTextures();
      this.obsidianMaterial = new THREE.MeshStandardMaterial({
        map,
        bumpMap,
        bumpScale: 0.06,
        roughness: 0.28,
        metalness: 0.45,
        color: COLOR_PALETTE.obsidianBlack,
        emissive: COLOR_PALETTE.obsidianGlow,
        emissiveIntensity: 0.2 // Arcane Purple rim sheen
      });
    }
    return this.obsidianMaterial;
  }

  public static getGoldMaterial(): THREE.MeshStandardMaterial {
    if (!this.goldMaterial) {
      this.goldMaterial = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.22,
        metalness: 0.85,
        emissive: 0x78350f,
        emissiveIntensity: 0.25
      });
    }
    return this.goldMaterial;
  }

  public static getRuneRingMaterial(color: 'w' | 'b'): THREE.MeshBasicMaterial {
    if (color === 'w') {
      if (!this.whiteRuneMaterial) {
        this.whiteRuneMaterial = new THREE.MeshBasicMaterial({
          map: this.createRuneRingTexture('#38bdf8'),
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide
        });
      }
      return this.whiteRuneMaterial;
    } else {
      if (!this.blackRuneMaterial) {
        this.blackRuneMaterial = new THREE.MeshBasicMaterial({
          map: this.createRuneRingTexture('#c084fc'),
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide
        });
      }
      return this.blackRuneMaterial;
    }
  }

  private static createRuneRingTexture(glowColor: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const cx = 128;
    const cy = 128;

    // Glowing Runic Ring
    ctx.clearRect(0, 0, 256, 256);
    ctx.beginPath();
    ctx.arc(cx, cy, 105, 0, Math.PI * 2);
    ctx.lineWidth = 10;
    ctx.strokeStyle = glowColor;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 18;
    ctx.stroke();

    // Arcane tick marks around circumference
    ctx.lineWidth = 4;
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const r1 = 92;
      const r2 = 118;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
      ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }
}

export default StoneMaterials;
