import Peer, { DataConnection } from 'peerjs';
import eventBus from './EventBus';
import gameState from './GameStateManager';
import cathedralAudio from '../audio/CathedralAudio';

export interface P2PStatus {
  isConnected: boolean;
  isHost: boolean;
  roomCode: string | null;
  playerColor: 'w' | 'b';
  statusText: string;
}

export class P2PNetworkManager {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private roomCode: string | null = null;
  private isHost: boolean = false;
  private playerColor: 'w' | 'b' = 'w';
  private isConnected: boolean = false;

  constructor() {
    this.initListeners();
    this.checkUrlForRoom();
  }

  private initListeners(): void {
    // When a move is executed locally, sync it to opponent if P2P is active
    eventBus.on('MOVE_EXECUTED', (move) => {
      if (this.isConnected && this.connection && move.color === this.playerColor) {
        this.connection.send({
          type: 'MOVE',
          from: move.from,
          to: move.to,
          promotion: 'q',
          san: move.san
        });
      }
    });

    eventBus.on('SPELL_CAST_REQUESTED', (spellData) => {
      if (this.isConnected && this.connection) {
        this.connection.send({
          type: 'SPELL',
          spell: spellData.spell,
          target: spellData.target
        });
      }
    });

    eventBus.on('GAME_RESET', () => {
      if (this.isConnected && this.connection) {
        this.connection.send({ type: 'RESET' });
      }
    });
  }

  private checkUrlForRoom(): void {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      setTimeout(() => {
        this.joinRoom(room);
      }, 500);
    }
  }

  public getStatus(): P2PStatus {
    return {
      isConnected: this.isConnected,
      isHost: this.isHost,
      roomCode: this.roomCode,
      playerColor: this.playerColor,
      statusText: this.isConnected
        ? `Duel Active - You are ${this.playerColor === 'w' ? 'White' : 'Black'}`
        : 'Disconnected'
    };
  }

  public getPlayerColor(): 'w' | 'b' {
    return this.playerColor;
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Host an instant 1-Click room
   */
  public createRoom(): Promise<string> {
    return new Promise((resolve, reject) => {
      const generatedCode = 'wiz-' + Math.random().toString(36).substring(2, 8);
      this.roomCode = generatedCode;
      this.isHost = true;
      this.playerColor = 'w';

      try {
        this.peer = new Peer(generatedCode);

        this.peer.on('open', (id) => {
          this.emitStatus(`Awaiting friend... Room code: ${id}`);
          resolve(id);
        });

        this.peer.on('connection', (conn) => {
          this.setupConnection(conn);
        });

        this.peer.on('error', (err) => {
          console.error('Peer error:', err);
          this.emitStatus(`Network Error: ${err.type}`);
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Join an existing room via code or link
   */
  public joinRoom(roomCode: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.roomCode = roomCode;
      this.isHost = false;
      this.playerColor = 'b'; // Guest plays Black

      try {
        this.peer = new Peer();

        this.peer.on('open', () => {
          this.emitStatus(`Connecting to chamber ${roomCode}...`);
          const conn = this.peer!.connect(roomCode);
          this.setupConnection(conn);
          resolve(true);
        });

        this.peer.on('error', (err) => {
          console.error('Peer error:', err);
          this.emitStatus(`Failed to connect to ${roomCode}`);
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private setupConnection(conn: DataConnection): void {
    this.connection = conn;

    conn.on('open', () => {
      this.isConnected = true;
      cathedralAudio.playSelect();

      // Switch camera to Black POV if player is guest
      if (!this.isHost) {
        eventBus.emit('CAMERA_PRESET_REQUESTED', 'BLACK_POV');
      }

      this.emitStatus(`Chamber linked! Duel in progress.`);
      eventBus.emit('MODE_CHANGED', 'PVP');

      // If host, sync current board position
      if (this.isHost) {
        conn.send({
          type: 'SYNC',
          fen: gameState.getFen()
        });
      }
    });

    conn.on('data', (data: any) => {
      this.handleRemoteMessage(data);
    });

    conn.on('close', () => {
      this.isConnected = false;
      this.emitStatus('Chamber link severed. Opponent disconnected.');
    });

    conn.on('error', (err) => {
      console.warn('P2P connection error:', err);
    });
  }

  private handleRemoteMessage(data: any): void {
    if (!data || !data.type) return;

    if (data.type === 'MOVE') {
      eventBus.emit('MOVE_INTENT', {
        from: data.from,
        to: data.to,
        promotion: data.promotion || 'q'
      });
    } else if (data.type === 'SPELL') {
      eventBus.emit('SPELL_CAST_REQUESTED', {
        spell: data.spell,
        target: data.target
      });
    } else if (data.type === 'RESET') {
      gameState.reset();
    } else if (data.type === 'SYNC') {
      if (data.fen) {
        gameState.loadFen(data.fen);
      }
    }
  }

  public getShareableLink(): string {
    if (!this.roomCode) return window.location.href;
    const url = new URL(window.location.href);
    url.searchParams.set('room', this.roomCode);
    return url.toString();
  }

  public disconnect(): void {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.isConnected = false;
    this.roomCode = null;
    this.emitStatus('Disconnected');
  }

  private emitStatus(msg: string): void {
    eventBus.emit('P2P_STATUS_CHANGED', {
      isConnected: this.isConnected,
      isHost: this.isHost,
      roomCode: this.roomCode,
      playerColor: this.playerColor,
      statusText: msg
    });
  }
}

export const p2pNetwork = new P2PNetworkManager();
export default p2pNetwork;
