import { CameraPreset } from '../config/constants';

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
  'AUDIO_STATE_CHANGED': boolean; // isMuted
  'CAMERA_SHAKE_TRIGGERED': CameraShakePayload;
  'PIECE_SHATTERED': ShatterPayload;
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
