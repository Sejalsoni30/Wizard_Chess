import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import gsap from 'gsap';
import { CAMERA_PRESETS, CameraPreset } from '../config/constants';
import eventBus from '../core/EventBus';

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public controls: OrbitControls;
  public container: HTMLElement;
  public composer: EffectComposer;
  public bloomPass: UnrealBloomPass;

  private clock: THREE.Clock;
  private animationCallbacks: Array<(delta: number, elapsed: number) => void> = [];
  private isDestroyed: boolean = false;
  private postProcessingEnabled: boolean = true;

  // Camera Shake state
  private shakeIntensity: number = 0;
  private shakeDuration: number = 0;
  private shakeElapsed: number = 0;

  // Action Cam state
  private isActionCamActive: boolean = false;
  private previousCamPos: THREE.Vector3 = new THREE.Vector3();
  private previousTarget: THREE.Vector3 = new THREE.Vector3();

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
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    // 4. Orbit Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.copy(CAMERA_PRESETS.ORBIT.target);
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
    this.controls.minDistance = 4.0;
    this.controls.maxDistance = 60.0;

    // 5. Post-Processing Pipeline (HDR Bloom)
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // UnrealBloomPass tuned for arcane runes & braziers
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.72,  // bloom strength
      0.45,  // bloom radius
      0.28   // threshold
    );
    this.composer.addPass(this.bloomPass);

    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);

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

    eventBus.on('VIEW_CHANGED', (view) => {
      if (view === 'MENU') {
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = 0.55;
        this.transitionToPreset('ORBIT');
      } else {
        this.controls.autoRotate = false;
        this.transitionToPreset('WHITE_POV');
      }
    });
  }

  public togglePostProcessing(): boolean {
    this.postProcessingEnabled = !this.postProcessingEnabled;
    return this.postProcessingEnabled;
  }

  public setPostProcessing(enabled: boolean): void {
    this.postProcessingEnabled = enabled;
  }

  public transitionToPreset(presetKey: 'ORBIT' | 'WHITE_POV' | 'BLACK_POV' | 'TOP_DOWN'): void {
    const preset = CAMERA_PRESETS[presetKey];
    if (!preset) return;

    if (this.isActionCamActive) {
      this.isActionCamActive = false;
    }

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

  /**
   * Cinematic Action Cam:
   * Swoops in close and low around high-value captures (Queen, Rook, Checkmate),
   * slows down time scale, and returns smoothly after the strike.
   */
  public triggerActionCam(targetPos: THREE.Vector3, duration: number = 2.4, onStrike?: () => void): void {
    if (this.isActionCamActive) return;
    this.isActionCamActive = true;

    // Save current camera view to return to
    this.previousCamPos.copy(this.camera.position);
    this.previousTarget.copy(this.controls.target);

    // Calculate dynamic dramatic low-angle position
    const angle = Math.atan2(this.camera.position.z - targetPos.z, this.camera.position.x - targetPos.x);
    const swoopDistance = 4.8;
    const swoopX = targetPos.x + Math.cos(angle + 0.3) * swoopDistance;
    const swoopZ = targetPos.z + Math.sin(angle + 0.3) * swoopDistance;
    const swoopY = Math.max(1.8, targetPos.y + 2.0);

    // Boost bloom slightly during action cam
    const origBloomStrength = this.bloomPass.strength;
    this.bloomPass.strength = 1.15;

    // Fast dynamic swoop in
    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.controls.target);

    const tl = gsap.timeline({
      onComplete: () => {
        // Return smoothly back to original player view
        gsap.to(this.camera.position, {
          x: this.previousCamPos.x,
          y: this.previousCamPos.y,
          z: this.previousCamPos.z,
          duration: 1.1,
          ease: 'power2.inOut',
          onComplete: () => {
            this.isActionCamActive = false;
            this.bloomPass.strength = origBloomStrength;
          }
        });

        gsap.to(this.controls.target, {
          x: this.previousTarget.x,
          y: this.previousTarget.y,
          z: this.previousTarget.z,
          duration: 1.1,
          ease: 'power2.inOut'
        });
      }
    });

    // Swoop in (0.45s)
    tl.to(this.camera.position, {
      x: swoopX,
      y: swoopY,
      z: swoopZ,
      duration: 0.45,
      ease: 'power2.out'
    }, 0);

    tl.to(this.controls.target, {
      x: targetPos.x,
      y: targetPos.y + 0.4,
      z: targetPos.z,
      duration: 0.45,
      ease: 'power2.out'
    }, 0);

    // Slow-motion close orbit drift during impact (duration)
    tl.to(this.camera.position, {
      x: targetPos.x + Math.cos(angle - 0.2) * (swoopDistance - 0.6),
      y: swoopY + 0.4,
      z: targetPos.z + Math.sin(angle - 0.2) * (swoopDistance - 0.6),
      duration: duration,
      ease: 'sine.inOut',
      onStart: () => {
        if (onStrike) onStrike();
      }
    }, 0.45);
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

    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
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

      // Render with HDR Post-Processing (or standard fallback)
      if (this.postProcessingEnabled) {
        this.composer.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }
    };

    requestAnimationFrame(animate);
  }

  public destroy(): void {
    this.isDestroyed = true;
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    this.composer.dispose();
    this.renderer.dispose();
  }
}

export default SceneManager;
