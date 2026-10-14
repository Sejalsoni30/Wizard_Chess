import * as THREE from 'three';
import {
  SQUARE_SIZE,
  BOARD_SIZE,
  BOARD_TOP_Y,
  FILES,
  RANKS,
  COLOR_PALETTE,
  squareToWorld,
  worldToSquare
} from '../config/constants';
import eventBus, { LegalTarget } from '../core/EventBus';
import gameState from '../core/GameStateManager';

export class BoardGrid {
  public group: THREE.Group;
  private tileMeshes: Map<string, THREE.Mesh> = new Map();
  private raycaster: THREE.Raycaster;
  private pointer: THREE.Vector2;
  private camera: THREE.Camera;
  private domElement: HTMLElement;

  private hoveredSquare: string | null = null;
  private selectedSquare: string | null = null;
  private legalMoves: LegalTarget[] = [];
  private checkSquare: string | null = null;

  // Visual Indicator Objects
  private hoverMesh: THREE.Mesh;
  private selectMesh: THREE.Mesh;
  private checkMesh: THREE.Mesh;
  private legalIndicatorGroup: THREE.Group;

  constructor(scene: THREE.Scene, camera: THREE.Camera, domElement: HTMLElement) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.camera = camera;
    this.domElement = domElement;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(-999, -999);

    this.buildBoardTiles();
    this.buildBorderFrameWithRunes();

    // Visual Indicators
    this.legalIndicatorGroup = new THREE.Group();
    this.group.add(this.legalIndicatorGroup);

    this.hoverMesh = this.createHoverMesh();
    this.selectMesh = this.createSelectMesh();
    this.checkMesh = this.createCheckMesh();
    this.group.add(this.hoverMesh);
    this.group.add(this.selectMesh);
    this.group.add(this.checkMesh);

    this.initEvents();
    this.setupInteraction();
  }

  private buildBoardTiles(): void {
    const tileGeo = new THREE.BoxGeometry(SQUARE_SIZE - 0.05, 0.2, SQUARE_SIZE - 0.05);

    // Procedural Tile Textures
    const whiteTileCanvas = this.createTileCanvas('#e4dfd7', '#b5aea2');
    const blackTileCanvas = this.createTileCanvas('#1e2029', '#0d0e13');

    const whiteTileTex = new THREE.CanvasTexture(whiteTileCanvas);
    const blackTileTex = new THREE.CanvasTexture(blackTileCanvas);

    const whiteMat = new THREE.MeshStandardMaterial({
      map: whiteTileTex,
      roughness: 0.38,
      metalness: 0.15
    });

    const blackMat = new THREE.MeshStandardMaterial({
      map: blackTileTex,
      roughness: 0.5,
      metalness: 0.25
    });

    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const square = `${FILES[f]}${RANKS[r]}`;
        const isWhiteSquare = (f + r) % 2 === 1; // standard board checker

        const tileMat = isWhiteSquare ? whiteMat : blackMat;
        const tile = new THREE.Mesh(tileGeo, tileMat);
        const worldPos = squareToWorld(square);

        tile.position.set(worldPos.x, BOARD_TOP_Y - 0.1, worldPos.z);
        tile.receiveShadow = true;
        tile.userData = { square };

        this.group.add(tile);
        this.tileMeshes.set(square, tile);
      }
    }
  }

  private createTileCanvas(col1: string, col2: string): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Base gradient
      const grad = ctx.createLinearGradient(0, 0, 256, 256);
      grad.addColorStop(0, col1);
      grad.addColorStop(1, col2);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);

      // Fine stone grain
      const imgData = ctx.getImageData(0, 0, 256, 256);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 16;
        data[i] = Math.min(255, Math.max(0, data[i] + noise));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
      }
      ctx.putImageData(imgData, 0, 0);

      // Inset bevel shadow
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.strokeRect(3, 3, 250, 250);
    }
    return canvas;
  }

  private buildBorderFrameWithRunes(): void {
    const frameMat = new THREE.MeshStandardMaterial({
      color: COLOR_PALETTE.boardBorder,
      roughness: 0.75,
      metalness: 0.3
    });

    const borderThickness = 1.0;
    const totalOuter = BOARD_SIZE + borderThickness * 2;
    const frameHeight = 0.35;

    // 4 Border Beams
    const northBeamGeo = new THREE.BoxGeometry(totalOuter, frameHeight, borderThickness);
    const southBeamGeo = new THREE.BoxGeometry(totalOuter, frameHeight, borderThickness);
    const eastBeamGeo = new THREE.BoxGeometry(borderThickness, frameHeight, BOARD_SIZE);
    const westBeamGeo = new THREE.BoxGeometry(borderThickness, frameHeight, BOARD_SIZE);

    const halfBoard = BOARD_SIZE / 2;
    const halfBorder = borderThickness / 2;

    const northBeam = new THREE.Mesh(northBeamGeo, frameMat);
    northBeam.position.set(0, BOARD_TOP_Y - 0.15, -halfBoard - halfBorder);
    northBeam.receiveShadow = true;
    northBeam.castShadow = true;
    this.group.add(northBeam);

    const southBeam = new THREE.Mesh(southBeamGeo, frameMat);
    southBeam.position.set(0, BOARD_TOP_Y - 0.15, halfBoard + halfBorder);
    southBeam.receiveShadow = true;
    southBeam.castShadow = true;
    this.group.add(southBeam);

    const eastBeam = new THREE.Mesh(eastBeamGeo, frameMat);
    eastBeam.position.set(halfBoard + halfBorder, BOARD_TOP_Y - 0.15, 0);
    eastBeam.receiveShadow = true;
    eastBeam.castShadow = true;
    this.group.add(eastBeam);

    const westBeam = new THREE.Mesh(westBeamGeo, frameMat);
    westBeam.position.set(-halfBoard - halfBorder, BOARD_TOP_Y - 0.15, 0);
    westBeam.receiveShadow = true;
    westBeam.castShadow = true;
    this.group.add(westBeam);

    // Carve Rune Labels along the borders
    this.addBorderRuneLabels();
  }

  private addBorderRuneLabels(): void {
    const halfBoard = BOARD_SIZE / 2;

    // Files A-H along South & North
    for (let f = 0; f < 8; f++) {
      const fileChar = FILES[f].toUpperCase();
      const x = (f - 3.5) * SQUARE_SIZE;

      // South label
      const southMesh = this.createRuneSprite(fileChar);
      southMesh.position.set(x, BOARD_TOP_Y + 0.03, halfBoard + 0.5);
      southMesh.rotation.x = -Math.PI / 2;
      this.group.add(southMesh);

      // North label (flipped)
      const northMesh = this.createRuneSprite(fileChar);
      northMesh.position.set(x, BOARD_TOP_Y + 0.03, -halfBoard - 0.5);
      northMesh.rotation.x = -Math.PI / 2;
      northMesh.rotation.z = Math.PI;
      this.group.add(northMesh);
    }

    // Ranks 1-8 along East & West
    for (let r = 0; r < 8; r++) {
      const rankChar = RANKS[r];
      const z = (3.5 - r) * SQUARE_SIZE;

      // West label
      const westMesh = this.createRuneSprite(rankChar);
      westMesh.position.set(-halfBoard - 0.5, BOARD_TOP_Y + 0.03, z);
      westMesh.rotation.x = -Math.PI / 2;
      westMesh.rotation.z = Math.PI / 2;
      this.group.add(westMesh);

      // East label
      const eastMesh = this.createRuneSprite(rankChar);
      eastMesh.position.set(halfBoard + 0.5, BOARD_TOP_Y + 0.03, z);
      eastMesh.rotation.x = -Math.PI / 2;
      eastMesh.rotation.z = -Math.PI / 2;
      this.group.add(eastMesh);
    }
  }

  private createRuneSprite(char: string): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 128, 128);
      ctx.font = 'bold 80px "Cinzel", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Golden Rune Glow
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#fef08a';
      ctx.fillText(char, 64, 68);

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#eab308';
      ctx.fillText(char, 64, 68);
    }

    const tex = new THREE.CanvasTexture(canvas);
    const planeGeo = new THREE.PlaneGeometry(0.8, 0.8);
    const planeMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false
    });

    return new THREE.Mesh(planeGeo, planeMat);
  }

  private createHoverMesh(): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(SQUARE_SIZE * 0.96, SQUARE_SIZE * 0.96);
    const mat = new THREE.MeshBasicMaterial({
      color: COLOR_PALETTE.hoverSquare,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = BOARD_TOP_Y + 0.005;
    return mesh;
  }

  private createSelectMesh(): THREE.Mesh {
    // Glowing Arcane Select Ring
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const cx = 128;
      const cy = 128;
      ctx.clearRect(0, 0, 256, 256);

      ctx.beginPath();
      ctx.arc(cx, cy, 100, 0, Math.PI * 2);
      ctx.lineWidth = 14;
      ctx.strokeStyle = '#f59e0b';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 16;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 70, 0, Math.PI * 2);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#fde68a';
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    const geo = new THREE.PlaneGeometry(SQUARE_SIZE * 0.96, SQUARE_SIZE * 0.96);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = BOARD_TOP_Y + 0.01;
    return mesh;
  }

  private createCheckMesh(): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(128, 128, 20, 128, 128, 120);
      grad.addColorStop(0, 'rgba(239, 68, 68, 0.9)');
      grad.addColorStop(0.7, 'rgba(220, 38, 38, 0.4)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
    }
    const tex = new THREE.CanvasTexture(canvas);
    const geo = new THREE.PlaneGeometry(SQUARE_SIZE * 0.98, SQUARE_SIZE * 0.98);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = BOARD_TOP_Y + 0.012;
    return mesh;
  }

  private initEvents(): void {
    eventBus.on('PIECE_SELECTED', ({ square }) => {
      this.selectedSquare = square;
      const wPos = squareToWorld(square);
      this.selectMesh.position.set(wPos.x, BOARD_TOP_Y + 0.01, wPos.z);
      (this.selectMesh.material as THREE.MeshBasicMaterial).opacity = 0.85;
    });

    eventBus.on('PIECE_DESELECTED', () => {
      this.selectedSquare = null;
      (this.selectMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      this.clearLegalMoveIndicators();
    });

    eventBus.on('LEGAL_MOVES_CALCULATED', ({ moves }) => {
      this.legalMoves = moves;
      this.renderLegalMoveIndicators(moves);
    });

    eventBus.on('TURN_CHANGED', ({ isCheck, turn }) => {
      if (isCheck) {
        // Find king square of current turn
        const fen = gameState.getFen();
        this.highlightCheckKing(turn);
      } else {
        (this.checkMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      }
    });

    eventBus.on('GAME_RESET', () => {
      this.selectedSquare = null;
      this.legalMoves = [];
      (this.selectMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      (this.checkMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      this.clearLegalMoveIndicators();
    });
  }

  private highlightCheckKing(turn: 'w' | 'b'): void {
    // Locate the king of the side in check
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = `${FILES[f]}${RANKS[r]}`;
        const p = gameState.getPieceAt(sq);
        if (p && p.type === 'k' && p.color === turn) {
          const wPos = squareToWorld(sq);
          this.checkMesh.position.set(wPos.x, BOARD_TOP_Y + 0.012, wPos.z);
          (this.checkMesh.material as THREE.MeshBasicMaterial).opacity = 0.85;
          return;
        }
      }
    }
  }

  private renderLegalMoveIndicators(moves: LegalTarget[]): void {
    this.clearLegalMoveIndicators();

    for (const move of moves) {
      const wPos = squareToWorld(move.to);
      const indicator = move.isCapture
        ? this.createCaptureRuneMesh()
        : this.createMoveDotMesh();

      indicator.position.set(wPos.x, BOARD_TOP_Y + 0.015, wPos.z);
      this.legalIndicatorGroup.add(indicator);
    }
  }

  private clearLegalMoveIndicators(): void {
    while (this.legalIndicatorGroup.children.length > 0) {
      const child = this.legalIndicatorGroup.children[0];
      this.legalIndicatorGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  }

  private createMoveDotMesh(): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.arc(64, 64, 34, 0, Math.PI * 2);
      ctx.fillStyle = '#10b981';
      ctx.shadowColor = '#34d399';
      ctx.shadowBlur = 12;
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    const geo = new THREE.PlaneGeometry(0.7, 0.7);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  private createCaptureRuneMesh(): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const cx = 128;
      const cy = 128;
      ctx.beginPath();
      ctx.arc(cx, cy, 96, 0, Math.PI * 2);
      ctx.lineWidth = 14;
      ctx.strokeStyle = '#ef4444';
      ctx.shadowColor = '#f87171';
      ctx.shadowBlur = 18;
      ctx.stroke();

      // Serrated corners
      ctx.lineWidth = 8;
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * 75, cy + Math.sin(ang) * 75);
        ctx.lineTo(cx + Math.cos(ang) * 115, cy + Math.sin(ang) * 115);
        ctx.stroke();
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    const geo = new THREE.PlaneGeometry(SQUARE_SIZE * 0.94, SQUARE_SIZE * 0.94);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  private setupInteraction(): void {
    const updatePointer = (e: MouseEvent) => {
      const rect = this.domElement.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    this.domElement.addEventListener('mousemove', (e) => {
      updatePointer(e);
      this.raycastHover();
    });

    this.domElement.addEventListener('pointerdown', (e) => {
      updatePointer(e);
      this.raycastClick();
    });
  }

  private raycastHover(): void {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObjects(Array.from(this.tileMeshes.values()), false);

    if (intersects.length > 0) {
      const hitTile = intersects[0].object as THREE.Mesh;
      const sq = hitTile.userData.square as string;

      if (sq !== this.hoveredSquare) {
        this.hoveredSquare = sq;
        const wPos = squareToWorld(sq);
        this.hoverMesh.position.set(wPos.x, BOARD_TOP_Y + 0.005, wPos.z);
        (this.hoverMesh.material as THREE.MeshBasicMaterial).opacity = 0.28;
      }
    } else {
      if (this.hoveredSquare) {
        this.hoveredSquare = null;
        (this.hoverMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      }
    }
  }

  private raycastClick(): void {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObjects(Array.from(this.tileMeshes.values()), false);

    if (intersects.length > 0) {
      const hitTile = intersects[0].object as THREE.Mesh;
      const sq = hitTile.userData.square as string;
      gameState.selectSquare(sq);
    } else {
      gameState.selectSquare(null);
    }
  }

  public update(delta: number, elapsed: number): void {
    // Pulse and rotate indicators
    if (this.selectedSquare) {
      this.selectMesh.rotation.z = elapsed * 0.8;
      const mat = this.selectMesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.75 + Math.sin(elapsed * 4.5) * 0.15;
    }

    if (this.legalIndicatorGroup.children.length > 0) {
      for (const child of this.legalIndicatorGroup.children) {
        child.rotation.z = -elapsed * 0.6;
      }
    }

    if ((this.checkMesh.material as THREE.MeshBasicMaterial).opacity > 0) {
      const checkMat = this.checkMesh.material as THREE.MeshBasicMaterial;
      checkMat.opacity = 0.65 + Math.sin(elapsed * 6.0) * 0.25;
    }
  }
}
