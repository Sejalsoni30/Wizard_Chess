import * as THREE from 'three';
import { SceneManager } from './scene/SceneManager';
import { CathedralEnvironment } from './scene/CathedralEnvironment';
import { BoardGrid } from './scene/BoardGrid';
import { BattlefieldScars } from './scene/BattlefieldScars';
import { CrystalHourglassManager } from './scene/CrystalHourglass';
import { ShatterPhysicsEngine } from './animations/ShatterPhysicsEngine';
import { PieceEntity } from './entities/PieceEntity';
import { CombatChoreographer } from './animations/CombatChoreographer';
import { CathedralAudio } from './audio/CathedralAudio';
import { HUDController } from './ui/HUDController';
import eventBus, { MoveEventPayload, TurnChangedPayload } from './core/EventBus';
import gameState from './core/GameStateManager';
import aiController from './core/AIController';
import voiceCommander from './core/VoiceCommander';
import puzzleManager from './core/PuzzleManager';
import arcaneSpellEngine from './core/ArcaneSpellEngine';
import p2pNetwork from './core/P2PNetwork';
import { FILES, RANKS, ChessSquare } from './config/constants';

class WizardsChessApp {
  private sceneManager: SceneManager;
  private cathedralEnv: CathedralEnvironment;
  private boardGrid: BoardGrid;
  private scars: BattlefieldScars;
  private hourglasses: CrystalHourglassManager;
  private shatterEngine: ShatterPhysicsEngine;
  private choreographer: CombatChoreographer;
  private audio: CathedralAudio;
  private hud: HUDController;

  // Active pieces on the board mapped by square: e.g. "e4" -> PieceEntity
  private pieceMap: Map<string, PieceEntity> = new Map();
  private pieceGroup: THREE.Group;

  constructor() {
    // 1. Scene & Render Pipeline with HDR Post-Processing
    this.sceneManager = new SceneManager('canvas-container');

    // 2. Gothic Cathedral Environment & Weather
    this.cathedralEnv = new CathedralEnvironment(this.sceneManager.scene);

    // 3. Board Grid & Raycasting Interaction
    this.boardGrid = new BoardGrid(
      this.sceneManager.scene,
      this.sceneManager.camera,
      this.sceneManager.renderer.domElement
    );

    // 4. Battlefield Scars & Permanent Rubble
    this.scars = new BattlefieldScars(this.sceneManager.scene);

    // 5. 3D Crystal Hourglasses for Blitz & Rapid Timers
    this.hourglasses = new CrystalHourglassManager(this.sceneManager.scene);

    // 6. Shatter Physics Engine
    this.shatterEngine = new ShatterPhysicsEngine(this.sceneManager.scene);

    // 7. Piece Group
    this.pieceGroup = new THREE.Group();
    this.sceneManager.scene.add(this.pieceGroup);
    this.boardGrid.setPieceGroup(this.pieceGroup);

    // 8. Animation Choreographer & Audio Synthesizer
    this.choreographer = new CombatChoreographer(this.sceneManager.scene);
    this.audio = new CathedralAudio();

    // 9. MD3 HUD Controller
    this.hud = new HUDController();

    // 10. Setup Game Events & Initial Position
    this.initGameEvents();
    this.spawnInitialBoard();

    // 11. Register Render Loop Subsystems
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

    // Board Loaded (FEN load / Puzzle / Reset)
    eventBus.on('BOARD_LOADED', () => {
      this.clearAllPieces();
      this.shatterEngine.clearAll();
      this.spawnInitialBoard();
    });

    // Demo Shatter Showcase Event
    eventBus.on('DEMO_SHATTER_REQUESTED', () => {
      this.triggerDemoShatterShowcase();
    });

    // Cinematic Action Cam Event
    eventBus.on('CINEMATIC_ACTION_CAM_TRIGGERED', (targetPos: THREE.Vector3) => {
      this.sceneManager.triggerActionCam(targetPos);
    });

    // Living Piece Reactions: Blunder Tremble
    eventBus.on('BLUNDER_DETECTED', ({ square, isBlunder }) => {
      const piece = this.pieceMap.get(square);
      if (piece) {
        piece.setTremble(isBlunder);
      }
    });

    // Living Piece Reactions: King Crimson Check Glow
    eventBus.on('TURN_CHANGED', ({ turn, isCheck }: TurnChangedPayload) => {
      this.updateKingCheckGlow(turn, isCheck);
    });

    // Arcane Mode: Freeze Spell
    eventBus.on('PIECE_FROZEN', ({ square }) => {
      const piece = this.pieceMap.get(square);
      if (piece) {
        piece.setFrozen(true);
      }
    });

    eventBus.on('PIECE_UNFROZEN', (square) => {
      const piece = this.pieceMap.get(square);
      if (piece) {
        piece.setFrozen(false);
      }
    });

    // Tactile Piece Levitation on Selection
    eventBus.on('PIECE_SELECTED', ({ square }) => {
      this.pieceMap.forEach((piece, sq) => {
        piece.setSelected(sq === square);
      });
    });

    eventBus.on('PIECE_DESELECTED', () => {
      this.pieceMap.forEach((piece) => {
        piece.setSelected(false);
      });
    });

    // Arcane Mode: Revive Spell
    eventBus.on('PIECE_REVIVED', ({ pieceType, color, square }) => {
      const entity = new PieceEntity(pieceType as any, color, square);
      this.pieceGroup.add(entity.mesh);
      this.pieceMap.set(square, entity);
    });
  }

  private updateKingCheckGlow(turn: 'w' | 'b', isCheck: boolean): void {
    this.pieceMap.forEach((piece) => {
      if (piece.type === 'k') {
        const isInCheck = isCheck && piece.color === turn;
        piece.setCheck(isInCheck);
      }
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
      // Handle en-passant capture
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

    if (move.from === 'e1' && move.to === 'g1') {
      const rook = this.pieceMap.get('h1');
      if (rook) {
        this.pieceMap.delete('h1');
        this.choreographer.animateMove(rook, 'f1', () => {
          this.pieceMap.set('f1', rook);
        });
      }
    } else if (move.from === 'e1' && move.to === 'c1') {
      const rook = this.pieceMap.get('a1');
      if (rook) {
        this.pieceMap.delete('a1');
        this.choreographer.animateMove(rook, 'd1', () => {
          this.pieceMap.set('d1', rook);
        });
      }
    } else if (move.from === 'e8' && move.to === 'g8') {
      const rook = this.pieceMap.get('h8');
      if (rook) {
        this.pieceMap.delete('h8');
        this.choreographer.animateMove(rook, 'f8', () => {
          this.pieceMap.set('f8', rook);
        });
      }
    } else if (move.from === 'e8' && move.to === 'c8') {
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
        this.pieceGroup.remove(piece.mesh);
        piece.dispose();

        const queen = new PieceEntity('q', piece.color, move.to);
        this.pieceGroup.add(queen.mesh);
        this.pieceMap.set(move.to, queen);
      }
    }
  }

  private triggerDemoShatterShowcase(): void {
    if (this.choreographer.getIsAnimating()) return;

    const demoVictimSquare = 'e5';
    const demoAttackerSquare = 'e2';

    let victim = this.pieceMap.get(demoVictimSquare);
    if (!victim) {
      victim = new PieceEntity('p', 'w', demoVictimSquare);
      this.pieceGroup.add(victim.mesh);
      this.pieceMap.set(demoVictimSquare, victim);
    }

    const attacker = new PieceEntity('r', 'b', demoAttackerSquare);
    this.pieceGroup.add(attacker.mesh);

    this.choreographer.animateAttack(attacker, victim, demoVictimSquare, () => {
      this.pieceMap.delete(demoVictimSquare);
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
    // 1. Cathedral Environment (braziers, embers, lighting)
    this.cathedralEnv.update(delta, elapsed);

    // 2. Board Grid
    this.boardGrid.update(delta, elapsed);

    // 3. 3D Crystal Hourglasses Sand Timers
    this.hourglasses.update(delta, elapsed);

    // 4. Piece Levitation & Living Reactions
    this.pieceMap.forEach((piece) => {
      piece.update(delta, elapsed);
    });

    // 5. Shatter Physics Engine
    this.shatterEngine.update(delta);
  }
}

// Bootstrap application on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new WizardsChessApp();
});
