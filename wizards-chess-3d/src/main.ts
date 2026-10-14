import * as THREE from 'three';
import { SceneManager } from './scene/SceneManager';
import { CathedralEnvironment } from './scene/CathedralEnvironment';
import { BoardGrid } from './scene/BoardGrid';
import { ShatterPhysicsEngine } from './animations/ShatterPhysicsEngine';
import { PieceEntity } from './entities/PieceEntity';
import { CombatChoreographer } from './animations/CombatChoreographer';
import { CathedralAudio } from './audio/CathedralAudio';
import { HUDController } from './ui/HUDController';
import eventBus, { MoveEventPayload } from './core/EventBus';
import gameState from './core/GameStateManager';
import aiController from './core/AIController';
import { FILES, RANKS, ChessSquare } from './config/constants';

class WizardsChessApp {
  private sceneManager: SceneManager;
  private cathedralEnv: CathedralEnvironment;
  private boardGrid: BoardGrid;
  private shatterEngine: ShatterPhysicsEngine;
  private choreographer: CombatChoreographer;
  private audio: CathedralAudio;
  private hud: HUDController;

  // Active pieces on the board mapped by square: e.g. "e4" -> PieceEntity
  private pieceMap: Map<string, PieceEntity> = new Map();
  private pieceGroup: THREE.Group;

  constructor() {
    // 1. Scene & Render Pipeline
    this.sceneManager = new SceneManager('canvas-container');

    // 2. Gothic Cathedral Environment
    this.cathedralEnv = new CathedralEnvironment(this.sceneManager.scene);

    // 3. Board Grid & Raycasting Interaction
    this.boardGrid = new BoardGrid(
      this.sceneManager.scene,
      this.sceneManager.camera,
      this.sceneManager.renderer.domElement
    );

    // 4. Shatter Physics Engine
    this.shatterEngine = new ShatterPhysicsEngine(this.sceneManager.scene);

    // 5. Piece Group
    this.pieceGroup = new THREE.Group();
    this.sceneManager.scene.add(this.pieceGroup);

    // 6. Animation Choreographer & Audio Synthesizer
    this.choreographer = new CombatChoreographer();
    this.audio = new CathedralAudio();

    // 7. MD3 HUD Controller
    this.hud = new HUDController();

    // 8. Setup Game Events & Initial Position
    this.initGameEvents();
    this.spawnInitialBoard();

    // 9. Register Render Loop Subsystems
    this.sceneManager.registerUpdate(this.onFrameUpdate.bind(this));
    this.sceneManager.start();
  }

  private initGameEvents(): void {
    // Move Execution Event
    eventBus.on('MOVE_EXECUTED', (move: MoveEventPayload) => {
      this.handleMoveExecuted(move);
    });

    // Game Reset Event
    eventBus.on('GAME_RESET', () => {
      this.clearAllPieces();
      this.shatterEngine.clearAll();
      this.spawnInitialBoard();
    });

    // Demo Shatter Showcase Event
    eventBus.on('DEMO_SHATTER_REQUESTED', () => {
      this.triggerDemoShatterShowcase();
    });
  }

  private spawnInitialBoard(): void {
    const chess = gameState.getChess();
    const board = chess.board();

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece) {
          const square = `${FILES[c]}${RANKS[7 - r]}`;
          const entity = new PieceEntity(piece.type, piece.color, square);
          this.pieceGroup.add(entity.mesh);
          this.pieceMap.set(square, entity);
        }
      }
    }
  }

  private handleMoveExecuted(move: MoveEventPayload): void {
    const attacker = this.pieceMap.get(move.from);
    if (!attacker) return;

    // Check if this move is a capture
    if (move.captured) {
      let victimSquare = move.to;
      // Handle en-passant capture (victim is on the passed pawn square)
      if (!this.pieceMap.has(victimSquare)) {
        const victimRank = move.color === 'w' ? '5' : '4';
        victimSquare = `${move.to.charAt(0)}${victimRank}`;
      }

      const victim = this.pieceMap.get(victimSquare);
      if (victim) {
        this.pieceMap.delete(victimSquare);
        this.pieceMap.delete(move.from);

        this.choreographer.animateAttack(attacker, victim, move.to, () => {
          this.pieceMap.set(move.to, attacker);
          this.checkPromotion(attacker, move);
        });
      } else {
        // Fallback move
        this.pieceMap.delete(move.from);
        this.choreographer.animateMove(attacker, move.to, () => {
          this.pieceMap.set(move.to, attacker);
          this.checkPromotion(attacker, move);
        });
      }
    } else {
      // Normal move
      this.pieceMap.delete(move.from);
      this.choreographer.animateMove(attacker, move.to, () => {
        this.pieceMap.set(move.to, attacker);
        this.checkPromotion(attacker, move);
      });
    }

    // Handle Castling Rook Movement
    this.handleCastlingRook(move);
  }

  private handleCastlingRook(move: MoveEventPayload): void {
    if (move.piece !== 'k') return;

    // White kingside: e1 -> g1 (rook: h1 -> f1)
    if (move.from === 'e1' && move.to === 'g1') {
      const rook = this.pieceMap.get('h1');
      if (rook) {
        this.pieceMap.delete('h1');
        this.choreographer.animateMove(rook, 'f1', () => {
          this.pieceMap.set('f1', rook);
        });
      }
    }
    // White queenside: e1 -> c1 (rook: a1 -> d1)
    else if (move.from === 'e1' && move.to === 'c1') {
      const rook = this.pieceMap.get('a1');
      if (rook) {
        this.pieceMap.delete('a1');
        this.choreographer.animateMove(rook, 'd1', () => {
          this.pieceMap.set('d1', rook);
        });
      }
    }
    // Black kingside: e8 -> g8 (rook: h8 -> f8)
    else if (move.from === 'e8' && move.to === 'g8') {
      const rook = this.pieceMap.get('h8');
      if (rook) {
        this.pieceMap.delete('h8');
        this.choreographer.animateMove(rook, 'f8', () => {
          this.pieceMap.set('f8', rook);
        });
      }
    }
    // Black queenside: e8 -> c8 (rook: a8 -> d8)
    else if (move.from === 'e8' && move.to === 'c8') {
      const rook = this.pieceMap.get('a8');
      if (rook) {
        this.pieceMap.delete('a8');
        this.choreographer.animateMove(rook, 'd8', () => {
          this.pieceMap.set('d8', rook);
        });
      }
    }
  }

  private checkPromotion(piece: PieceEntity, move: MoveEventPayload): void {
    if (piece.type === 'p') {
      const rank = move.to.charAt(1);
      if (rank === '8' || rank === '1') {
        // Pawn reached final rank -> Upgrade to Queen
        this.pieceGroup.remove(piece.mesh);
        piece.dispose();

        const queen = new PieceEntity('q', piece.color, move.to);
        this.pieceGroup.add(queen.mesh);
        this.pieceMap.set(move.to, queen);
      }
    }
  }

  /**
   * Showcase Demo Shatter:
   * Instant demonstration of an attack, kinetic impact, and 30-shard shatter explosion.
   */
  private triggerDemoShatterShowcase(): void {
    if (this.choreographer.getIsAnimating()) return;

    // Pick or spawn a demo victim on the board
    const demoVictimSquare = 'e5';
    const demoAttackerSquare = 'e2';

    // If a victim already exists at e5, shatter it directly
    let victim = this.pieceMap.get(demoVictimSquare);
    if (!victim) {
      victim = new PieceEntity('p', 'w', demoVictimSquare);
      this.pieceGroup.add(victim.mesh);
      this.pieceMap.set(demoVictimSquare, victim);
    }

    // Create showcase obsidian attacker
    const attacker = new PieceEntity('n', 'b', demoAttackerSquare);
    this.pieceGroup.add(attacker.mesh);

    this.choreographer.animateAttack(attacker, victim, demoVictimSquare, () => {
      this.pieceMap.delete(demoVictimSquare);
      // Clean up demo attacker after showcase
      setTimeout(() => {
        this.pieceGroup.remove(attacker.mesh);
        attacker.dispose();
      }, 1500);
    });
  }

  private clearAllPieces(): void {
    this.pieceMap.forEach((piece) => {
      this.pieceGroup.remove(piece.mesh);
      piece.dispose();
    });
    this.pieceMap.clear();
  }

  private onFrameUpdate(delta: number, elapsed: number): void {
    // 1. Cathedral Environment (braziers & embers)
    this.cathedralEnv.update(delta, elapsed);

    // 2. Board Grid (rune indicators)
    this.boardGrid.update(delta, elapsed);

    // 3. Piece Idle Levitation Breathing & Rune Rings
    this.pieceMap.forEach((piece) => {
      piece.update(delta, elapsed);
    });

    // 4. Shatter Physics Engine (tumbling shards & shockwaves)
    this.shatterEngine.update(delta);
  }
}

// Bootstrap application on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new WizardsChessApp();
});
