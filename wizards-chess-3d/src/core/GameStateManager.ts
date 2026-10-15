import { Chess, Square } from 'chess.js';
import eventBus, { MoveEventPayload, PieceInfo, TurnChangedPayload } from './EventBus';

export class GameStateManager {
  private chess: Chess;
  private selectedSquare: string | null = null;
  private capturedPieces: { w: string[]; b: string[] } = { w: [], b: [] };

  constructor() {
    this.chess = new Chess();
    this.initListeners();
  }

  private initListeners(): void {
    eventBus.on('MOVE_INTENT', ({ from, to, promotion }) => {
      this.executeMove(from, to, promotion);
    });

    eventBus.on('GAME_RESET', () => {
      this.reset();
    });
  }

  public getChess(): Chess {
    return this.chess;
  }

  public getFen(): string {
    return this.chess.fen();
  }

  public getTurn(): 'w' | 'b' {
    return this.chess.turn();
  }

  public isCheck(): boolean {
    return this.chess.inCheck();
  }

  public isCheckmate(): boolean {
    return this.chess.isCheckmate();
  }

  public isStalemate(): boolean {
    return this.chess.isStalemate();
  }

  public isDraw(): boolean {
    return this.chess.isDraw();
  }

  public isGameOver(): boolean {
    return this.chess.isGameOver();
  }

  public getPieceAt(square: string): PieceInfo | null {
    const piece = this.chess.get(square as Square);
    if (!piece) return null;
    return {
      type: piece.type,
      color: piece.color,
      square
    };
  }

  public getSelectedSquare(): string | null {
    return this.selectedSquare;
  }

  public selectSquare(square: string | null): void {
    if (!square) {
      if (this.selectedSquare) {
        eventBus.emit('BLUNDER_DETECTED', { square: this.selectedSquare, isBlunder: false });
      }
      this.selectedSquare = null;
      eventBus.emit('PIECE_DESELECTED', undefined);
      return;
    }

    const piece = this.getPieceAt(square);
    if (!piece) {
      if (this.selectedSquare) {
        this.attemptMove(this.selectedSquare, square);
      } else {
        this.selectedSquare = null;
        eventBus.emit('PIECE_DESELECTED', undefined);
      }
      return;
    }

    // If clicking a piece of current turn's color, select it
    if (piece.color === this.chess.turn()) {
      // Clear previous tremble if any
      if (this.selectedSquare) {
        eventBus.emit('BLUNDER_DETECTED', { square: this.selectedSquare, isBlunder: false });
      }

      this.selectedSquare = square;
      eventBus.emit('PIECE_SELECTED', { square, piece });

      // Check if selected piece is currently hanging or under attack -> tremble!
      const opponentColor = piece.color === 'w' ? 'b' : 'w';
      const isUnderAttack = this.chess.isAttacked(square as Square, opponentColor);
      if (isUnderAttack && piece.type !== 'p') {
        eventBus.emit('BLUNDER_DETECTED', { square, isBlunder: true });
      } else {
        eventBus.emit('BLUNDER_DETECTED', { square, isBlunder: false });
      }

      const moves = this.chess.moves({ square: square as Square, verbose: true });
      const legalTargets = moves.map(m => ({
        to: m.to,
        isCapture: !!m.captured
      }));

      eventBus.emit('LEGAL_MOVES_CALCULATED', {
        from: square,
        moves: legalTargets
      });
    } else {
      // Clicked opponent piece - if we have a piece selected, try capture
      if (this.selectedSquare) {
        this.attemptMove(this.selectedSquare, square);
      } else {
        this.selectedSquare = null;
        eventBus.emit('PIECE_DESELECTED', undefined);
      }
    }
  }

  public attemptMove(from: string, to: string, promotion: string = 'q'): boolean {
    try {
      const validMove = this.chess.moves({ square: from as Square, verbose: true }).find(m => m.to === to);
      if (!validMove) {
        this.selectSquare(null);
        return false;
      }

      // Check blunder: if piece moves to an attacked square without defender or equal trade
      const piece = this.getPieceAt(from);
      if (piece) {
        const opponentColor = piece.color === 'w' ? 'b' : 'w';
        const willBeAttacked = this.chess.isAttacked(to as Square, opponentColor);
        if (willBeAttacked && piece.type !== 'p' && !validMove.captured) {
          eventBus.emit('BLUNDER_DETECTED', { square: from, isBlunder: true });
        }
      }

      this.executeMove(from, to, validMove.promotion || promotion);
      return true;
    } catch {
      this.selectSquare(null);
      return false;
    }
  }

  public executeMove(from: string, to: string, promotion: string = 'q'): boolean {
    try {
      const moveResult = this.chess.move({
        from: from as Square,
        to: to as Square,
        promotion: promotion as any
      });

      if (!moveResult) {
        return false;
      }

      // Track captured piece
      if (moveResult.captured) {
        if (moveResult.color === 'w') {
          this.capturedPieces.b.push(moveResult.captured);
        } else {
          this.capturedPieces.w.push(moveResult.captured);
        }
      }

      const movePayload: MoveEventPayload = {
        from: moveResult.from,
        to: moveResult.to,
        piece: moveResult.piece,
        color: moveResult.color,
        captured: moveResult.captured,
        san: moveResult.san,
        isCheck: this.chess.inCheck(),
        isCheckmate: this.chess.isCheckmate(),
        isDraw: this.chess.isDraw()
      };

      eventBus.emit('MOVE_EXECUTED', movePayload);

      // Deselect square & clear tremble
      if (this.selectedSquare) {
        eventBus.emit('BLUNDER_DETECTED', { square: this.selectedSquare, isBlunder: false });
      }
      this.selectedSquare = null;
      eventBus.emit('PIECE_DESELECTED', undefined);

      const fenTokens = this.chess.fen().split(' ');
      const fullMoveNumber = parseInt(fenTokens[5], 10) || 1;

      const turnPayload: TurnChangedPayload = {
        turn: this.chess.turn(),
        isCheck: this.chess.inCheck(),
        isCheckmate: this.chess.isCheckmate(),
        isStalemate: this.chess.isStalemate(),
        isDraw: this.chess.isDraw(),
        fullMoveNumber
      };

      eventBus.emit('TURN_CHANGED', turnPayload);
      return true;
    } catch (e) {
      console.error('Invalid move in GameStateManager:', e);
      return false;
    }
  }

  public getCapturedPieces(): { w: string[]; b: string[] } {
    return {
      w: [...this.capturedPieces.w],
      b: [...this.capturedPieces.b]
    };
  }

  public loadFen(fen: string): void {
    this.chess.load(fen);
    this.selectedSquare = null;
    this.capturedPieces = { w: [], b: [] };
    eventBus.emit('PIECE_DESELECTED', undefined);

    const fenTokens = fen.split(' ');
    const fullMoveNumber = parseInt(fenTokens[5], 10) || 1;

    const turnPayload: TurnChangedPayload = {
      turn: this.chess.turn(),
      isCheck: this.chess.inCheck(),
      isCheckmate: this.chess.isCheckmate(),
      isStalemate: this.chess.isStalemate(),
      isDraw: this.chess.isDraw(),
      fullMoveNumber
    };
    eventBus.emit('TURN_CHANGED', turnPayload);
    eventBus.emit('GAME_RESET', undefined);
  }

  public reset(): void {
    this.chess.reset();
    this.selectedSquare = null;
    this.capturedPieces = { w: [], b: [] };
    eventBus.emit('PIECE_DESELECTED', undefined);

    const turnPayload: TurnChangedPayload = {
      turn: 'w',
      isCheck: false,
      isCheckmate: false,
      isStalemate: false,
      isDraw: false,
      fullMoveNumber: 1
    };
    eventBus.emit('TURN_CHANGED', turnPayload);
  }
}

export const gameState = new GameStateManager();
export default gameState;
