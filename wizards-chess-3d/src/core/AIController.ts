import { Chess, Square } from 'chess.js';
import eventBus from './EventBus';
import gameState from './GameStateManager';

// Material base values (in centipawns)
const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000
};

// Piece-Square Tables (from White's perspective; 8x8 arrays from row 0 [rank 8] to row 7 [rank 1])
const PAWN_TABLE: number[][] = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5,  5, 10, 25, 25, 10,  5,  5],
  [0,  0,  0, 20, 20,  0,  0,  0],
  [5, -5,-10,  0,  0,-10, -5,  5],
  [5, 10, 10,-20,-20, 10, 10,  5],
  [0,  0,  0,  0,  0,  0,  0,  0]
];

const KNIGHT_TABLE: number[][] = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50]
];

const BISHOP_TABLE: number[][] = [
  [-20,-10,-10,-10,-10,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5, 10, 10,  5,  0,-10],
  [-10,  5,  5, 10, 10,  5,  5,-10],
  [-10,  0, 10, 10, 10, 10,  0,-10],
  [-10, 10, 10, 10, 10, 10, 10,-10],
  [-10,  5,  0,  0,  0,  0,  5,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20]
];

const ROOK_TABLE: number[][] = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [5, 10, 10, 10, 10, 10, 10,  5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [0,  0,  0,  5,  5,  0,  0,  0]
];

const QUEEN_TABLE: number[][] = [
  [-20,-10,-10, -5, -5,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5,  5,  5,  5,  0,-10],
  [-5,  0,  5,  5,  5,  5,  0, -5],
  [0,  0,  5,  5,  5,  5,  0, -5],
  [-10,  5,  5,  5,  5,  5,  0,-10],
  [-10,  0,  5,  0,  0,  0,  0,-10],
  [-20,-10,-10, -5, -5,-10,-10,-20]
];

const KING_TABLE: number[][] = [
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-20,-20,-20,-20,-10],
  [20, 20,  0,  0,  0,  0, 20, 20],
  [20, 30, 10,  0,  0, 10, 30, 20]
];

const TABLES: Record<string, number[][]> = {
  p: PAWN_TABLE,
  n: KNIGHT_TABLE,
  b: BISHOP_TABLE,
  r: ROOK_TABLE,
  q: QUEEN_TABLE,
  k: KING_TABLE
};

export class AIController {
  private mode: 'AI' | 'PVP' = 'AI';
  private aiColor: 'b' = 'b';
  private isThinking: boolean = false;
  private pendingTimeout: any = null;
  private searchDepth: number = 3;

  constructor() {
    this.initListeners();
  }

  private initListeners(): void {
    eventBus.on('MODE_CHANGED', (newMode) => {
      this.mode = newMode;
      if (this.pendingTimeout) {
        clearTimeout(this.pendingTimeout);
        this.pendingTimeout = null;
      }
      this.checkAndTriggerAIMove();
    });

    eventBus.on('TURN_CHANGED', ({ turn, isCheckmate, isStalemate, isDraw }) => {
      if (isCheckmate || isStalemate || isDraw) return;
      if (this.mode === 'AI' && turn === this.aiColor) {
        this.checkAndTriggerAIMove();
      }
    });

    eventBus.on('GAME_RESET', () => {
      if (this.pendingTimeout) {
        clearTimeout(this.pendingTimeout);
        this.pendingTimeout = null;
      }
      this.isThinking = false;
    });
  }

  public setMode(mode: 'AI' | 'PVP'): void {
    this.mode = mode;
  }

  public getMode(): 'AI' | 'PVP' {
    return this.mode;
  }

  private checkAndTriggerAIMove(): void {
    if (this.mode !== 'AI') return;
    if (gameState.getTurn() !== this.aiColor) return;
    if (gameState.isGameOver()) return;
    if (this.isThinking) return;

    // Small delay to simulate arcane deliberation and allow piece animations to settle
    this.pendingTimeout = setTimeout(() => {
      this.computeAndMakeMove();
    }, 450);
  }

  private computeAndMakeMove(): void {
    this.isThinking = true;
    const currentChess = gameState.getChess();
    const bestMove = this.getBestMove(currentChess, this.searchDepth);
    this.isThinking = false;

    if (bestMove) {
      eventBus.emit('MOVE_INTENT', {
        from: bestMove.from,
        to: bestMove.to,
        promotion: bestMove.promotion || 'q'
      });
    }
  }

  /**
   * Minimax search with Alpha-Beta pruning
   */
  public getBestMove(chess: Chess, depth: number): { from: string; to: string; promotion?: string } | null {
    const isMaximizing = chess.turn() === 'w';
    let bestMove: any = null;
    let bestValue = isMaximizing ? -Infinity : Infinity;

    const moves = chess.moves({ verbose: true });
    if (moves.length === 0) return null;

    // Move ordering: captures first
    moves.sort((a, b) => {
      const scoreA = a.captured ? PIECE_VALUES[a.captured] * 10 - PIECE_VALUES[a.piece] : 0;
      const scoreB = b.captured ? PIECE_VALUES[b.captured] * 10 - PIECE_VALUES[b.piece] : 0;
      return scoreB - scoreA;
    });

    let alpha = -Infinity;
    let beta = Infinity;

    for (const move of moves) {
      chess.move(move);
      const evalScore = this.minimax(chess, depth - 1, alpha, beta, !isMaximizing);
      chess.undo();

      if (isMaximizing) {
        if (evalScore > bestValue) {
          bestValue = evalScore;
          bestMove = move;
        }
        alpha = Math.max(alpha, bestValue);
      } else {
        if (evalScore < bestValue) {
          bestValue = evalScore;
          bestMove = move;
        }
        beta = Math.min(beta, bestValue);
      }

      if (beta <= alpha) {
        break;
      }
    }

    return bestMove;
  }

  private minimax(
    chess: Chess,
    depth: number,
    alpha: number,
    beta: number,
    isMaximizing: boolean
  ): number {
    if (depth === 0 || chess.isGameOver()) {
      return this.evaluateBoard(chess);
    }

    const moves = chess.moves({ verbose: true });
    if (moves.length === 0) {
      if (chess.inCheck()) {
        return isMaximizing ? -99999 : 99999;
      }
      return 0; // Stalemate
    }

    // Heuristic capture ordering
    moves.sort((a, b) => {
      const scoreA = a.captured ? PIECE_VALUES[a.captured] * 10 - PIECE_VALUES[a.piece] : 0;
      const scoreB = b.captured ? PIECE_VALUES[b.captured] * 10 - PIECE_VALUES[b.piece] : 0;
      return scoreB - scoreA;
    });

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const move of moves) {
        chess.move(move);
        const evaluation = this.minimax(chess, depth - 1, alpha, beta, false);
        chess.undo();
        maxEval = Math.max(maxEval, evaluation);
        alpha = Math.max(alpha, evaluation);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        chess.move(move);
        const evaluation = this.minimax(chess, depth - 1, alpha, beta, true);
        chess.undo();
        minEval = Math.min(minEval, evaluation);
        beta = Math.min(beta, evaluation);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  /**
   * Heuristic Evaluation:
   * Positive score favours White; Negative score favours Black.
   */
  public evaluateBoard(chess: Chess): number {
    if (chess.isCheckmate()) {
      return chess.turn() === 'w' ? -100000 : 100000;
    }
    if (chess.isDraw() || chess.isStalemate()) {
      return 0;
    }

    let totalScore = 0;
    const board = chess.board();

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (!piece) continue;

        const val = PIECE_VALUES[piece.type] || 0;
        const table = TABLES[piece.type];
        let posVal = 0;

        if (table) {
          if (piece.color === 'w') {
            // White: row r (0 is rank 8, 7 is rank 1)
            posVal = table[r][c];
          } else {
            // Black: mirror table vertically
            posVal = table[7 - r][c];
          }
        }

        if (piece.color === 'w') {
          totalScore += val + posVal;
        } else {
          totalScore -= (val + posVal);
        }
      }
    }

    return totalScore;
  }
}

export const aiController = new AIController();
export default aiController;
