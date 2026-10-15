import * as THREE from 'three';
import gsap from 'gsap';
import { COLOR_PALETTE } from '../config/constants';
import cathedralAudio from '../audio/CathedralAudio';
import eventBus from '../core/EventBus';

export class CathedralEnvironment {
  public group: THREE.Group;
  private braziers: Array<{
    light: THREE.PointLight;
    baseIntensity: number;
    flameMesh: THREE.Mesh;
    phase: number;
  }> = [];

  private emberPoints: THREE.Points | null = null;
  private emberPositions: Float32Array | null = null;
  private emberVelocities: Float32Array | null = null;
  private emberCount = 120;

  // Reactive Weather & Lightning
  private lightningLight: THREE.DirectionalLight | null = null;
  private roseMat: THREE.MeshStandardMaterial | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;
  private isLightningActive = false;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    // Atmospheric Fog
    scene.fog = new THREE.FogExp2(COLOR_PALETTE.fog, 0.024);
    scene.background = new THREE.Color(COLOR_PALETTE.fog);

    this.setupLighting(scene);
    this.buildCathedralFloor();
    this.buildSteppedAltar();
    this.buildGothicColumnsAndArches();
    this.buildRoseWindow();
    this.buildFireBraziers();
    this.buildEmberParticles();

    this.initWeatherEvents();
  }

  private initWeatherEvents(): void {
    eventBus.on('TURN_CHANGED', ({ isCheck, isCheckmate }) => {
      if (isCheck || isCheckmate) {
        // Tense moment: Flash thunder & lightning!
        this.triggerLightning(isCheckmate ? 1.5 : 1.0);
      }
    });

    eventBus.on('TRIGGER_LIGHTNING', (intensity) => {
      this.triggerLightning(intensity || 1.0);
    });
  }

  private setupLighting(scene: THREE.Scene): void {
    // 1. Arcane Ambient Tint
    const ambient = new THREE.AmbientLight(0x1e2638, 0.95);
    this.group.add(ambient);

    // 2. Hemispheric Sky/Ground Contrast
    this.hemiLight = new THREE.HemisphereLight(0x384b66, 0x10121a, 0.7);
    this.group.add(this.hemiLight);

    // 3. Moonlight Directional Shadow Caster
    const moonlight = new THREE.DirectionalLight(COLOR_PALETTE.moonlight, 2.4);
    moonlight.position.set(16, 32, 14);
    moonlight.castShadow = true;
    moonlight.shadow.mapSize.width = 2048;
    moonlight.shadow.mapSize.height = 2048;
    moonlight.shadow.camera.near = 1.0;
    moonlight.shadow.camera.far = 70;
    moonlight.shadow.camera.left = -16;
    moonlight.shadow.camera.right = 16;
    moonlight.shadow.camera.top = 16;
    moonlight.shadow.camera.bottom = -16;
    moonlight.shadow.bias = -0.0004;
    moonlight.shadow.radius = 2.0;
    this.group.add(moonlight);

    // Counter fill from opposite side
    const fillLight = new THREE.DirectionalLight(0x4338ca, 0.6);
    fillLight.position.set(-18, 20, -18);
    this.group.add(fillLight);

    // Dedicated Lightning Flash pointing through Rose Window
    this.lightningLight = new THREE.DirectionalLight(0xdbeafe, 0);
    this.lightningLight.position.set(0, 22, -32);
    this.lightningLight.target.position.set(0, 0, 0);
    this.group.add(this.lightningLight);
    this.group.add(this.lightningLight.target);
  }

  private buildCathedralFloor(): void {
    // Flagstone Cathedral Floor
    const floorGeo = new THREE.CylinderGeometry(42, 42, 0.5, 32);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0c0e14,
      roughness: 0.88,
      metalness: 0.12
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.6;
    floor.receiveShadow = true;
    this.group.add(floor);
  }

  private buildSteppedAltar(): void {
    const altarMat = new THREE.MeshStandardMaterial({
      color: COLOR_PALETTE.stoneAltar,
      roughness: 0.82,
      metalness: 0.2
    });

    const stepHeights = [0.25, 0.25, 0.3];
    const stepRadii = [13.2, 11.4, 9.6];

    let currentY = -0.35;
    for (let i = 0; i < 3; i++) {
      const stepGeo = new THREE.CylinderGeometry(stepRadii[i], stepRadii[i] + 0.3, stepHeights[i], 8);
      const step = new THREE.Mesh(stepGeo, altarMat);
      step.position.y = currentY + stepHeights[i] / 2;
      step.receiveShadow = true;
      step.castShadow = true;
      this.group.add(step);
      currentY += stepHeights[i];
    }
  }

  private buildGothicColumnsAndArches(): void {
    const columnCount = 12;
    const ringRadius = 17.5;
    const columnHeight = 18;

    const columnMat = new THREE.MeshStandardMaterial({
      color: COLOR_PALETTE.pillarStone,
      roughness: 0.85,
      metalness: 0.15
    });

    const columnPositions: THREE.Vector3[] = [];

    for (let i = 0; i < columnCount; i++) {
      const angle = (i / columnCount) * Math.PI * 2;
      const x = Math.cos(angle) * ringRadius;
      const z = Math.sin(angle) * ringRadius;
      const colPos = new THREE.Vector3(x, 0, z);
      columnPositions.push(colPos);

      const colGroup = new THREE.Group();
      colGroup.position.set(x, 0, z);

      // Main central fluted shaft
      const shaftGeo = new THREE.CylinderGeometry(0.55, 0.65, columnHeight, 16);
      const shaft = new THREE.Mesh(shaftGeo, columnMat);
      shaft.position.y = columnHeight / 2;
      shaft.castShadow = true;
      shaft.receiveShadow = true;
      colGroup.add(shaft);

      // 4 Surrounding Ribbed Colonnettes
      for (let j = 0; j < 4; j++) {
        const subAngle = (j / 4) * Math.PI * 2;
        const subX = Math.cos(subAngle) * 0.58;
        const subZ = Math.sin(subAngle) * 0.58;
        const subShaftGeo = new THREE.CylinderGeometry(0.16, 0.18, columnHeight - 0.5, 8);
        const subShaft = new THREE.Mesh(subShaftGeo, columnMat);
        subShaft.position.set(subX, columnHeight / 2, subZ);
        subShaft.castShadow = true;
        colGroup.add(subShaft);
      }

      // Base Plinth
      const baseGeo = new THREE.BoxGeometry(1.6, 0.8, 1.6);
      const base = new THREE.Mesh(baseGeo, columnMat);
      base.position.y = 0.4;
      base.castShadow = true;
      colGroup.add(base);

      // Ornate Capital at apex
      const capGeo = new THREE.ConeGeometry(1.2, 0.9, 8);
      const cap = new THREE.Mesh(capGeo, columnMat);
      cap.rotation.x = Math.PI;
      cap.position.y = columnHeight;
      colGroup.add(cap);

      this.group.add(colGroup);
    }

    // Connect Columns with Pointed Gothic Arches
    for (let i = 0; i < columnCount; i++) {
      const p1 = columnPositions[i];
      const p2 = columnPositions[(i + 1) % columnCount];

      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      const archApex = new THREE.Vector3(mid.x * 0.95, columnHeight + 2.8, mid.z * 0.95);

      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(p1.x, columnHeight, p1.z),
        new THREE.Vector3(p1.x * 0.98 + archApex.x * 0.02, columnHeight + 1.6, p1.z * 0.98 + archApex.z * 0.02),
        archApex,
        new THREE.Vector3(p2.x * 0.98 + archApex.x * 0.02, columnHeight + 1.6, p2.z * 0.98 + archApex.z * 0.02),
        new THREE.Vector3(p2.x, columnHeight, p2.z)
      ]);

      const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.22, 6, false);
      const archMesh = new THREE.Mesh(tubeGeo, columnMat);
      archMesh.castShadow = true;
      this.group.add(archMesh);
    }
  }

  private buildRoseWindow(): void {
    // Procedural Stained Glass Canvas Texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const cx = 256;
      const cy = 256;

      // Dark leaded background
      ctx.fillStyle = '#08080c';
      ctx.fillRect(0, 0, 512, 512);

      // Concentric colored petal rings
      const rings = [
        { r: 240, petals: 16, colors: ['#991b1b', '#1e40af', '#065f46', '#b45309'] },
        { r: 170, petals: 12, colors: ['#7c3aed', '#0284c7', '#c026d3', '#ea580c'] },
        { r: 100, petals: 8, colors: ['#f59e0b', '#38bdf8', '#a855f7', '#10b981'] },
        { r: 40, petals: 6, colors: ['#fef08a', '#fb7185', '#67e8f9'] }
      ];

      for (const ring of rings) {
        for (let p = 0; p < ring.petals; p++) {
          const a1 = (p / ring.petals) * Math.PI * 2;
          const a2 = ((p + 1) / ring.petals) * Math.PI * 2;
          const col = ring.colors[p % ring.colors.length];

          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, ring.r, a1, a2);
          ctx.closePath();
          ctx.fillStyle = col;
          ctx.fill();

          ctx.lineWidth = 4;
          ctx.strokeStyle = '#111116';
          ctx.stroke();
        }
      }

      // Golden center eye
      ctx.beginPath();
      ctx.arc(cx, cy, 24, 0, Math.PI * 2);
      ctx.fillStyle = '#fde047';
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#0a0a0f';
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const roseGeo = new THREE.CircleGeometry(7.5, 32);
    const roseMat = new THREE.MeshStandardMaterial({
      map: texture,
      emissive: 0x4f46e5,
      emissiveIntensity: 0.55,
      emissiveMap: texture,
      side: THREE.DoubleSide,
      roughness: 0.3,
      metalness: 0.1
    });
    this.roseMat = roseMat;

    const roseMesh = new THREE.Mesh(roseGeo, roseMat);
    roseMesh.position.set(0, 18, -26);
    this.group.add(roseMesh);

    // Stone tracery rim
    const rimGeo = new THREE.TorusGeometry(7.6, 0.45, 12, 32);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x1f232b,
      roughness: 0.85
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.position.copy(roseMesh.position);
    this.group.add(rimMesh);

    // Stained glass colored backlight casting into cathedral
    const roseLight = new THREE.SpotLight(0x7052ff, 4.0, 45, Math.PI / 4, 0.5, 1.2);
    roseLight.position.set(0, 18, -25.5);
    roseLight.target.position.set(0, 0, 0);
    this.group.add(roseLight);
    this.group.add(roseLight.target);
  }

  private buildFireBraziers(): void {
    const brazierPositions = [
      new THREE.Vector3(-10.2, 0.45, -10.2),
      new THREE.Vector3(10.2, 0.45, -10.2),
      new THREE.Vector3(-10.2, 0.45, 10.2),
      new THREE.Vector3(10.2, 0.45, 10.2)
    ];

    const ironMat = new THREE.MeshStandardMaterial({
      color: 0x121316,
      roughness: 0.8,
      metalness: 0.65
    });

    const fireMat = new THREE.MeshStandardMaterial({
      color: COLOR_PALETTE.brazierInner,
      emissive: COLOR_PALETTE.brazierFire,
      emissiveIntensity: 2.2,
      roughness: 0.1
    });

    for (let i = 0; i < brazierPositions.length; i++) {
      const pos = brazierPositions[i];
      const brazierGroup = new THREE.Group();
      brazierGroup.position.copy(pos);

      // Iron Tripod legs
      for (let leg = 0; leg < 3; leg++) {
        const legAngle = (leg / 3) * Math.PI * 2;
        const legGeo = new THREE.CylinderGeometry(0.06, 0.08, 1.2, 6);
        const legMesh = new THREE.Mesh(legGeo, ironMat);
        legMesh.position.set(Math.cos(legAngle) * 0.4, 0.5, Math.sin(legAngle) * 0.4);
        legMesh.rotation.z = Math.cos(legAngle) * 0.25;
        legMesh.rotation.x = Math.sin(legAngle) * 0.25;
        legMesh.castShadow = true;
        brazierGroup.add(legMesh);
      }

      // Iron Bowl
      const bowlGeo = new THREE.CylinderGeometry(0.75, 0.35, 0.45, 12);
      const bowl = new THREE.Mesh(bowlGeo, ironMat);
      bowl.position.y = 1.1;
      bowl.castShadow = true;
      brazierGroup.add(bowl);

      // Glowing Hot Fire Coals
      const coalGeo = new THREE.DodecahedronGeometry(0.48, 1);
      const flameMesh = new THREE.Mesh(coalGeo, fireMat);
      flameMesh.position.y = 1.28;
      flameMesh.scale.set(1, 0.7, 1);
      brazierGroup.add(flameMesh);

      // Point Light with Warm Arcane Glow
      const light = new THREE.PointLight(COLOR_PALETTE.brazierFire, 2.0, 14, 1.8);
      light.position.set(0, 1.5, 0);
      light.castShadow = true;
      light.shadow.bias = -0.001;
      brazierGroup.add(light);

      this.group.add(brazierGroup);

      this.braziers.push({
        light,
        baseIntensity: 2.0,
        flameMesh,
        phase: i * 1.57
      });
    }
  }

  private buildEmberParticles(): void {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.emberCount * 3);
    const velocities = new Float32Array(this.emberCount * 3);

    const brazierOrigins = [
      [-10.2, 1.3, -10.2],
      [10.2, 1.3, -10.2],
      [-10.2, 1.3, 10.2],
      [10.2, 1.3, 10.2]
    ];

    for (let i = 0; i < this.emberCount; i++) {
      const bIdx = i % 4;
      const origin = brazierOrigins[bIdx];

      positions[i * 3 + 0] = origin[0] + (Math.random() - 0.5) * 0.6;
      positions[i * 3 + 1] = origin[1] + Math.random() * 2.5;
      positions[i * 3 + 2] = origin[2] + (Math.random() - 0.5) * 0.6;

      velocities[i * 3 + 0] = (Math.random() - 0.5) * 0.35;
      velocities[i * 3 + 1] = 0.5 + Math.random() * 0.7; // Rising speed
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.35;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Custom Canvas Texture for Glowing Ember Dot
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 32;
    pCanvas.height = 32;
    const pCtx = pCanvas.getContext('2d');
    if (pCtx) {
      const grad = pCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, '#fff4cc');
      grad.addColorStop(0.3, '#ff8a1e');
      grad.addColorStop(0.8, '#ff3b00');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      pCtx.fillStyle = grad;
      pCtx.fillRect(0, 0, 32, 32);
    }
    const emberTex = new THREE.CanvasTexture(pCanvas);

    const mat = new THREE.PointsMaterial({
      size: 0.28,
      map: emberTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      color: 0xffaa44
    });

    this.emberPoints = new THREE.Points(geo, mat);
    this.emberPositions = positions;
    this.emberVelocities = velocities;
    this.group.add(this.emberPoints);
  }

  public update(delta: number, elapsed: number): void {
    // 1. Brazier Flame Flickering
    for (let i = 0; i < this.braziers.length; i++) {
      const b = this.braziers[i];
      const flicker = Math.sin(elapsed * 9.0 + b.phase) * 0.25 +
                      Math.sin(elapsed * 17.5 + b.phase * 2) * 0.15 +
                      (Math.random() - 0.5) * 0.1;
      b.light.intensity = Math.max(0.8, b.baseIntensity + flicker);

      const flameScale = 1.0 + flicker * 0.2;
      b.flameMesh.scale.set(flameScale, flameScale * 1.1, flameScale);
    }

    // 2. Rising Ember Particles
    if (this.emberPoints && this.emberPositions && this.emberVelocities) {
      const brazierOrigins = [
        [-10.2, 1.3, -10.2],
        [10.2, 1.3, -10.2],
        [-10.2, 1.3, 10.2],
        [10.2, 1.3, 10.2]
      ];

      for (let i = 0; i < this.emberCount; i++) {
        const i3 = i * 3;
        this.emberPositions[i3 + 0] += this.emberVelocities[i3 + 0] * delta;
        this.emberPositions[i3 + 1] += this.emberVelocities[i3 + 1] * delta;
        this.emberPositions[i3 + 2] += this.emberVelocities[i3 + 2] * delta;

        // Reset if risen too high
        if (this.emberPositions[i3 + 1] > 5.5) {
          const bIdx = i % 4;
          const origin = brazierOrigins[bIdx];
          this.emberPositions[i3 + 0] = origin[0] + (Math.random() - 0.5) * 0.5;
          this.emberPositions[i3 + 1] = origin[1] + Math.random() * 0.2;
          this.emberPositions[i3 + 2] = origin[2] + (Math.random() - 0.5) * 0.5;
        }
      }

      this.emberPoints.geometry.attributes.position.needsUpdate = true;
    }
  }

  public triggerLightning(intensity: number = 1.0): void {
    if (this.isLightningActive) return;
    this.isLightningActive = true;

    // Trigger thunder sound
    cathedralAudio.playThunder();

    // Trigger subtle kinetic camera shake for thunder rumble
    eventBus.emit('CAMERA_SHAKE_TRIGGERED', {
      intensity: 0.22 * intensity,
      duration: 1.2
    });

    const origHemi = 0.7;
    const origRose = 0.55;

    const tl = gsap.timeline({
      onComplete: () => {
        if (this.lightningLight) this.lightningLight.intensity = 0;
        if (this.hemiLight) this.hemiLight.intensity = origHemi;
        if (this.roseMat) this.roseMat.emissiveIntensity = origRose;
        this.isLightningActive = false;
      }
    });

    // Strobe flash 1 (initial lightning branch)
    tl.to({}, { duration: 0.04, onStart: () => {
      if (this.lightningLight) this.lightningLight.intensity = 9.0 * intensity;
      if (this.hemiLight) this.hemiLight.intensity = 2.4 * intensity;
      if (this.roseMat) this.roseMat.emissiveIntensity = 3.5 * intensity;
    }});
    tl.to({}, { duration: 0.05, onStart: () => {
      if (this.lightningLight) this.lightningLight.intensity = 0.8;
      if (this.hemiLight) this.hemiLight.intensity = origHemi;
      if (this.roseMat) this.roseMat.emissiveIntensity = 1.0;
    }});

    // Main bolt burst flash 2 (massive illumination through Rose Window)
    tl.to({}, { duration: 0.14, onStart: () => {
      if (this.lightningLight) this.lightningLight.intensity = 20.0 * intensity;
      if (this.hemiLight) this.hemiLight.intensity = 4.2 * intensity;
      if (this.roseMat) this.roseMat.emissiveIntensity = 6.5 * intensity;
    }});

    // Rolling afterglow fade
    tl.to({}, {
      duration: 0.55,
      onStart: () => {
        if (this.lightningLight) {
          gsap.to(this.lightningLight, { intensity: 0, duration: 0.55, ease: 'power2.out' });
        }
        if (this.hemiLight) {
          gsap.to(this.hemiLight, { intensity: origHemi, duration: 0.55, ease: 'power2.out' });
        }
        if (this.roseMat) {
          gsap.to(this.roseMat, { emissiveIntensity: origRose, duration: 0.55, ease: 'power2.out' });
        }
      }
    });
  }
}
