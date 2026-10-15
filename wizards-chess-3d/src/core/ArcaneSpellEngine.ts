import eventBus from './EventBus';
import gameState from './GameStateManager';
import cathedralAudio from '../audio/CathedralAudio';
import { PieceEntity } from '../entities/PieceEntity';

export type SpellType = 'freeze' | 'revive' | 'warp';

export interface ArcaneState {
  enabled: boolean;
  mana: { w: number; b: number };
  activeSpell: SpellType | null;
  frozenPieces: Map<string, number>; // square -> turn expiry
}

export class ArcaneSpellEngine {
  private enabled: boolean = false;
  private mana: { w: number; b: number } = { w: 35, b: 35 };
  private activeSpell: SpellType | null = null;
  // Frozen pieces: piece id / square -> expires on full move number
  private frozenSquares: Map<string, number> = new Map();

  constructor() {
    this.initListeners();
  }

  private initListeners(): void {
    // Mode toggled
    eventBus.on('ARCANE_MODE_TOGGLED', (enabled: boolean) => {
      this.enabled = enabled;
      if (enabled) {
        this.mana = { w: 40, b: 40 };
        this.emitState();
      }
    });

    // Captures grant mana
    eventBus.on('MOVE_EXECUTED', (move) => {
      if (!this.enabled) return;

      const playerColor = move.color;
      // Capturing a piece grants +35 Mana
      if (move.captured) {
        const bonus = move.captured === 'q' ? 50 : 35;
        this.mana[playerColor] = Math.min(100, this.mana[playerColor] + bonus);
      } else {
        // Small trickle of mana per turn
        this.mana[playerColor] = Math.min(100, this.mana[playerColor] + 5);
      }

      // Check frozen piece expirations
      const currentMoveNum = gameState.getChess().history().length;
      this.frozenSquares.forEach((expireMove, sq) => {
        if (currentMoveNum >= expireMove) {
          this.frozenSquares.delete(sq);
          eventBus.emit('PIECE_UNFROZEN', sq);
        }
      });

      this.emitState();
    });

    // Spell cast requests from HUD or Voice
    eventBus.on('SPELL_CAST_REQUESTED', ({ spell, target }) => {
      this.handleSpellRequest(spell, target);
    });

    eventBus.on('GAME_RESET', () => {
      this.mana = { w: 35, b: 35 };
      this.activeSpell = null;
      this.frozenSquares.clear();
      this.emitState();
    });
  }

  public getIsEnabled(): boolean {
    return this.enabled;
  }

  public getMana(color: 'w' | 'b'): number {
    return this.mana[color];
  }

  public isSquareFrozen(square: string): boolean {
    return this.frozenSquares.has(square);
  }

  public handleSpellRequest(spell: SpellType, targetSquare?: string): boolean {
    if (!this.enabled) return false;

    const currentTurn = gameState.getTurn();
    const costs: Record<SpellType, number> = {
      freeze: 35,
      warp: 40,
      revive: 65
    };

    const cost = costs[spell];
    if (this.mana[currentTurn] < cost) {
      cathedralAudio.playImpactThud(undefined, false);
      eventBus.emit('SPELL_FEEDBACK', {
        success: false,
        message: `Insufficient Mana! Need ${cost} Mana.`
      });
      return false;
    }

    if (spell === 'freeze') {
      if (!targetSquare) {
        // Enter targeting mode
        this.activeSpell = 'freeze';
        eventBus.emit('SPELL_FEEDBACK', {
          success: true,
          message: 'Target an enemy piece to encase in frost for 1 turn!'
        });
        return true;
      }

      // Target specified
      const piece = gameState.getPieceAt(targetSquare);
      if (!piece || piece.color === currentTurn) {
        eventBus.emit('SPELL_FEEDBACK', {
          success: false,
          message: 'Must target an opponent piece!'
        });
        return false;
      }

      // Deduct mana & freeze piece
      this.mana[currentTurn] -= cost;
      const expireTurn = gameState.getChess().history().length + 2;
      this.frozenSquares.set(targetSquare, expireTurn);

      cathedralAudio.playSpellCast('freeze');
      eventBus.emit('PIECE_FROZEN', { square: targetSquare });
      eventBus.emit('SPELL_FEEDBACK', {
        success: true,
        message: `${targetSquare.toUpperCase()} frozen in ice!`
      });
      this.activeSpell = null;
      this.emitState();
      return true;
    } else if (spell === 'revive') {
      const captured = gameState.getCapturedPieces();
      const lostPieces = captured[currentTurn];
      if (lostPieces.length === 0) {
        eventBus.emit('SPELL_FEEDBACK', {
          success: false,
          message: 'No fallen pieces in your graveyard to resurrect!'
        });
        return false;
      }

      // Pick highest value fallen piece to revive
      const priorityOrder = ['q', 'r', 'b', 'n', 'p'];
      let pieceToRevive: string | null = null;
      for (const p of priorityOrder) {
        if (lostPieces.includes(p)) {
          pieceToRevive = p;
          break;
        }
      }

      if (!pieceToRevive) pieceToRevive = lostPieces[0];

      // Find an open home rank square
      const homeRanks = currentTurn === 'w' ? ['1', '2'] : ['8', '7'];
      const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      let targetSq: string | null = null;

      for (const r of homeRanks) {
        for (const f of files) {
          const sq = `${f}${r}`;
          if (!gameState.getPieceAt(sq)) {
            targetSq = sq;
            break;
          }
        }
        if (targetSq) break;
      }

      if (!targetSq) {
        eventBus.emit('SPELL_FEEDBACK', {
          success: false,
          message: 'No open squares on your home rank for resurrection!'
        });
        return false;
      }

      // Deduct mana & revive
      this.mana[currentTurn] -= cost;
      cathedralAudio.playSpellCast('revive');
      eventBus.emit('PIECE_REVIVED', {
        pieceType: pieceToRevive,
        color: currentTurn,
        square: targetSq
      });
      eventBus.emit('SPELL_FEEDBACK', {
        success: true,
        message: `Fallen ${pieceToRevive.toUpperCase()} resurrected at ${targetSq.toUpperCase()}!`
      });
      this.emitState();
      return true;
    } else if (spell === 'warp') {
      // Warp active piece to safety
      this.activeSpell = 'warp';
      eventBus.emit('SPELL_FEEDBACK', {
        success: true,
        message: 'Click your piece, then click any safe square to Warp!'
      });
      return true;
    }

    return false;
  }

  private emitState(): void {
    eventBus.emit('ARCANE_STATE_CHANGED', {
      enabled: this.enabled,
      mana: { ...this.mana },
      activeSpell: this.activeSpell,
      frozenPieces: new Map(this.frozenSquares)
    });
  }
}

export const arcaneSpellEngine = new ArcaneSpellEngine();
export default arcaneSpellEngine;
