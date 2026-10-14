import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import gsap from 'gsap';
import { CAMERA_PRESETS, CameraPreset } from '../config/constants';
import eventBus from '../core/EventBus';

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public controls: OrbitControls;
  public container: HTMLElement;

  private clock: THREE.Clock;
  private animationCallbacks: Array<(delta: number, elapsed: number) => void> = [];
  private isDestroyed: boolean = false;

  // Camera Shake state
  private shakeIntensity: number = 0;
  private shakeDuration: number = 0;
  private shakeElapsed: number = 0;
  private originalCameraOffset: THREE.Vector3 = new THREE.Vector3();

  constructor(containerId: string = 'canvas-container') {
    const el = document.getElementById(containerId);
    if (!el) {
      throw new Error(`Container #${containerId} not found`);
    }
    this.container = el;

    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. Camera
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.copy(CAMERA_PRESETS.ORBIT.position);

    // 3. Renderer with PCFSoftShadowMap & Filmic Tone Mapping
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.container.appendChild(this.renderer.domElement);

    // 4. Orbit Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.copy(CAMERA_PRESETS.ORBIT.target);
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04; // Keep above altar floor
    this.controls.minDistance = 6.0;
    this.controls.maxDistance = 55.0;

    this.clock = new THREE.Clock();

    // Event listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));
    this.initEvents();
  }

  private initEvents(): void {
    eventBus.on('CAMERA_PRESET_REQUESTED', (presetKey) => {
      this.transitionToPreset(presetKey);
    });

    eventBus.on('CAMERA_SHAKE_TRIGGERED', ({ intensity, duration }) => {
      this.triggerCameraShake(intensity, duration);
    });
  }

  public transitionToPreset(presetKey: 'ORBIT' | 'WHITE_POV' | 'BLACK_POV' | 'TOP_DOWN'): void {
    const preset = CAMERA_PRESETS[presetKey];
    if (!preset) return;

    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.controls.target);

    gsap.to(this.camera.position, {
      x: preset.position.x,
      y: preset.position.y,
      z: preset.position.z,
      duration: 1.2,
      ease: 'power3.inOut'
    });

    gsap.to(this.controls.target, {
      x: preset.target.x,
      y: preset.target.y,
      z: preset.target.z,
      duration: 1.2,
      ease: 'power3.inOut'
    });
  }

  public triggerCameraShake(intensity: number = 0.35, duration: number = 0.45): void {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeElapsed = 0;
  }

  private updateCameraShake(delta: number): void {
    if (this.shakeElapsed < this.shakeDuration) {
      this.shakeElapsed += delta;
      const progress = this.shakeElapsed / this.shakeDuration;
      const decay = 1.0 - progress;
      const currentAmp = this.shakeIntensity * decay;

      const shakeX = (Math.random() - 0.5) * 2 * currentAmp;
      const shakeY = (Math.random() - 0.5) * 2 * currentAmp;
      const shakeZ = (Math.random() - 0.5) * 2 * currentAmp;

      this.camera.position.x += shakeX;
      this.camera.position.y += shakeY;
      this.camera.position.z += shakeZ;
    }
  }

  public registerUpdate(callback: (delta: number, elapsed: number) => void): void {
    this.animationCallbacks.push(callback);
  }

  public unregisterUpdate(callback: (delta: number, elapsed: number) => void): void {
    this.animationCallbacks = this.animationCallbacks.filter(cb => cb !== callback);
  }

  private onWindowResize(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  public start(): void {
    this.clock.start();
    const animate = () => {
      if (this.isDestroyed) return;
      requestAnimationFrame(animate);

      const delta = Math.min(this.clock.getDelta(), 0.1);
      const elapsed = this.clock.getElapsedTime();

      // Controls damping
      this.controls.update();

      // Camera Shake
      this.updateCameraShake(delta);

      // Animation callbacks
      for (let i = 0; i < this.animationCallbacks.length; i++) {
        this.animationCallbacks[i](delta, elapsed);
      }

      // Render
      this.renderer.render(this.scene, this.camera);
    };

    requestAnimationFrame(animate);
  }

  public destroy(): void {
    this.isDestroyed = true;
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    this.renderer.dispose();
  }
}
