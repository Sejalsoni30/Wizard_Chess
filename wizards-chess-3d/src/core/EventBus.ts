import * as THREE from 'three';

export interface PieceInfo {
  type: 'p' | 'r' | 'n' | 'b' | 'q' | 'k';
  color: 'w' | 'b';
  square: string;
}

export interface LegalTarget {
  to: string;
  isCapture: boolean;
}

export interface MoveEventPayload {
  from: string;
  to: string;
  piece: 'p' | 'r' | 'n' | 'b' | 'q' | 'k';
  color: 'w' | 'b';
  captured?: 'p' | 'r' | 'n' | 'b' | 'q' | 'k';
  san: string;
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
}

export interface TurnChangedPayload {
  turn: 'w' | 'b';
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  fullMoveNumber: number;
}

export interface ShatterPayload {
  x: number;
  y: number;
  z: number;
  color: 'w' | 'b';
  pieceType: string;
}

export interface CameraShakePayload {
  intensity: number;
  duration: number;
}

export type EventMap = {
  'PIECE_SELECTED': { square: string; piece: PieceInfo };
  'PIECE_DESELECTED': void;
  'LEGAL_MOVES_CALCULATED': { from: string; moves: LegalTarget[] };
  'MOVE_INTENT': { from: string; to: string; promotion?: string };
  'MOVE_EXECUTED': MoveEventPayload;
  'TURN_CHANGED': TurnChangedPayload;
  'GAME_RESET': void;
  'CAMERA_PRESET_REQUESTED': 'ORBIT' | 'WHITE_POV' | 'BLACK_POV' | 'TOP_DOWN';
  'DEMO_SHATTER_REQUESTED': void;
  'MODE_CHANGED': 'AI' | 'PVP';
  'AUDIO_TOGGLE_REQUESTED': void;
  'AUDIO_STATE_CHANGED': boolean;
  'CAMERA_SHAKE_TRIGGERED': CameraShakePayload;
  'PIECE_SHATTERED': ShatterPayload;

  // Voice Commands
  'VOICE_TOGGLE_REQUESTED': void;
  'VOICE_STATUS_CHANGED': any;

  // Reactive Weather & Lightning
  'TRIGGER_LIGHTNING': number;

  // Cinematic Action Cam
  'CINEMATIC_ACTION_CAM_TRIGGERED': THREE.Vector3;

  // 3D Crystal Hourglasses
  'TIME_CONTROL_CHANGED': 'UNLIMITED' | 'BLITZ' | 'RAPID';
  'TIME_FORFEIT': { loser: 'w' | 'b'; winner: string };

  // Iconic Lore Puzzles
  'PUZZLE_SELECTED': string;
  'PUZZLE_STATE_CHANGED': any;

  // Arcane Mode
  'ARCANE_MODE_TOGGLED': boolean;
  'ARCANE_STATE_CHANGED': any;
  'SPELL_CAST_REQUESTED': { spell: any; target?: string };
  'SPELL_FEEDBACK': { success: boolean; message: string };
  'PIECE_FROZEN': { square: string };
  'PIECE_UNFROZEN': string;
  'PIECE_REVIVED': { pieceType: string; color: 'w' | 'b'; square: string };

  // 1-Click P2P Multiplayer
  'P2P_STATUS_CHANGED': any;

  // Living Piece Blunder Detection
  'BLUNDER_DETECTED': { square: string; isBlunder: boolean };

  // AI Thinking & Difficulty
  'AI_THINKING_STATUS': boolean;
  'AI_DIFFICULTY_CHANGED': 'APPRENTICE' | 'ADEPT' | 'ARCHMAGE';

  // Pawn Promotion & Game Over Announcement
  'PROMOTION_REQUESTED': { from: string; to: string; color: 'w' | 'b' };
  'PROMOTION_RESOLVED': { from: string; to: string; promotion: 'q' | 'r' | 'b' | 'n' };
  'GAME_OVER_MODAL_REQUESTED': { title: string; subtitle: string; isVictory: boolean; stats: string };

  // Board Sync & Real Game Features
  'BOARD_LOADED': { fen: string };
  'BEST_MOVE_HINT': { from: string; to: string };
  'MATERIAL_UPDATED': { whiteScore: number; blackScore: number; diff: number };
  'VIEW_CHANGED': 'MENU' | 'PLAY' | 'PUZZLES' | 'MULTIPLAYER' | 'CODEX' | 'SETTINGS';
};

type EventKey = keyof EventMap;
type Callback<K extends EventKey> = (data: EventMap[K]) => void;

class TypedEventBus {
  private listeners: { [K in EventKey]?: Array<Callback<K>> } = {};

  public on<K extends EventKey>(event: K, cb: Callback<K>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(cb);

    return () => this.off(event, cb);
  }

  public off<K extends EventKey>(event: K, cb: Callback<K>): void {
    const arr = this.listeners[event];
    if (!arr) return;
    this.listeners[event] = (arr as Array<Callback<K>>).filter(handler => handler !== cb) as any;
  }

  public emit<K extends EventKey>(event: K, data: EventMap[K]): void {
    const arr = this.listeners[event];
    if (!arr || arr.length === 0) return;
    for (const handler of [...arr]) {
      try {
        handler(data);
      } catch (err) {
        console.error(`Error in event listener for ${event}:`, err);
      }
    }
  }

  public clear(): void {
    this.listeners = {};
  }
}

export const eventBus = new TypedEventBus();
export default eventBus;
