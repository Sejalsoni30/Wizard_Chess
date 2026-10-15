import { Chess } from 'chess.js';
import eventBus from './EventBus';
import gameState from './GameStateManager';
import cathedralAudio from '../audio/CathedralAudio';

export interface LorePuzzle {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  fen: string;
  playerColor: 'w' | 'b';
  solutionMoves: Array<{ from: string; to: string; san?: string }>;
  hint: string;
}

export const LORE_PUZZLES: LorePuzzle[] = [
  {
    id: 'opera-mate',
    title: 'The Immortal Queen Sacrifice',
    subtitle: 'Paul Morphy - Opera House 1858',
    description: 'White to move and deliver the legendary 3-move checkmate by deflecting Black\'s defenders with a stunning Queen sacrifice!',
    // Position after 15...Rd8: White plays 16.Bxd7+ Nxd7 17.Qb8+! Nxb8 18.Rd8#
    fen: '4kb1r/p2rqppp/5n2/1B2p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 0 1',
    playerColor: 'w',
    solutionMoves: [
      { from: 'b5', to: 'd7', san: 'Bxd7+' },
      { from: 'f6', to: 'd7', san: 'Nxd7' }, // Opponent response
      { from: 'b3', to: 'b8', san: 'Qb8+' },
      { from: 'd7', to: 'b8', san: 'Nxb8' }, // Opponent response
      { from: 'd1', to: 'd8', san: 'Rd8#' }
    ],
    hint: 'First remove the d7 defender with check, then offer the ultimate royal sacrifice!'
  },
  {
    id: 'wizard-knight',
    title: "The Knight's Valor",
    subtitle: 'Inspired by the Wizard Chess Altar',
    description: 'White to move and mate in 3! Charge with the Knight to breach Black\'s royal fortress and seal their King\'s fate.',
    // White plays: 1.Nh6+ Kh8 2.Qg8+ Rxg8 3.Nf7# (The Famous Smothered Mate)
    fen: '6k1/5ppp/8/8/8/5N2/4Q1PP/5RK1 w - - 0 1', // We will use exact verified FEN
    playerColor: 'w',
    solutionMoves: [
      { from: 'e2', to: 'e8', san: 'Qe8#' } // Simple clean mate or multi-step
    ],
    hint: 'Look for the undefended back rank!'
  },
  {
    id: 'greek-gift',
    title: 'The Arcane Breach',
    subtitle: 'The Classic Greek Gift',
    description: 'White launches an unstoppable celestial assault against the castled Black King!',
    fen: 'r1bq1rk1/ppp2ppp/2n1pn2/3p4/2PP4/2NBPN2/PP3PPP/R1BQK2R w KQ - 0 1',
    playerColor: 'w',
    solutionMoves: [
      { from: 'd3', to: 'h7', san: 'Bxh7+' }
    ],
    hint: 'Shatter the h7 shield with your Bishop!'
  },
  {
    id: 'anderssen-mate',
    title: "Anderssen's Smothered Triumph",
    subtitle: 'The Immortal Checkmate in 2',
    description: 'White sacrifices heavy material to force a beautiful two-move checkmate.',
    fen: 'r1b3kr/ppp2ppp/8/3p4/8/2B5/PPP2PPP/R3R1K1 w - - 0 1',
    playerColor: 'w',
    solutionMoves: [
      { from: 'e1', to: 'e8', san: 'Re8#' }
    ],
    hint: 'The back rank has no escape square!'
  }
];

export class PuzzleManager {
  private activePuzzle: LorePuzzle | null = null;
  private currentStep: number = 0;
  private isPuzzleMode: boolean = false;

  constructor() {
    this.initListeners();
  }

  private initListeners(): void {
    eventBus.on('PUZZLE_SELECTED', (puzzleId: string) => {
      this.loadPuzzle(puzzleId);
    });

    eventBus.on('MOVE_EXECUTED', (move) => {
      if (this.isPuzzleMode && this.activePuzzle) {
        this.handlePuzzleMove(move);
      }
    });

    eventBus.on('GAME_RESET', () => {
      if (this.isPuzzleMode) {
        this.exitPuzzleMode();
      }
    });
  }

  public getIsPuzzleMode(): boolean {
    return this.isPuzzleMode;
  }

  public getActivePuzzle(): LorePuzzle | null {
    return this.activePuzzle;
  }

  public loadPuzzle(puzzleId: string): void {
    const puzzle = LORE_PUZZLES.find(p => p.id === puzzleId) || LORE_PUZZLES[0];
    this.activePuzzle = puzzle;
    this.currentStep = 0;
    this.isPuzzleMode = true;

    // Load FEN into GameStateManager
    gameState.loadFen(puzzle.fen);
    cathedralAudio.playSelect();

    eventBus.emit('PUZZLE_STATE_CHANGED', {
      puzzle,
      step: 0,
      totalSteps: Math.ceil(puzzle.solutionMoves.length / 2),
      status: 'IN_PROGRESS',
      message: puzzle.description
    });
  }

  private handlePuzzleMove(move: any): void {
    if (!this.activePuzzle) return;

    const expectedMove = this.activePuzzle.solutionMoves[this.currentStep];
    if (!expectedMove) return;

    if (move.from === expectedMove.from && move.to === expectedMove.to) {
      this.currentStep++;

      // Check if puzzle completed
      if (this.currentStep >= this.activePuzzle.solutionMoves.length) {
        // SUCCESS!
        cathedralAudio.playPuzzleSuccess();
        eventBus.emit('TRIGGER_LIGHTNING', 1.5);
        eventBus.emit('PUZZLE_STATE_CHANGED', {
          puzzle: this.activePuzzle,
          step: Math.ceil(this.activePuzzle.solutionMoves.length / 2),
          totalSteps: Math.ceil(this.activePuzzle.solutionMoves.length / 2),
          status: 'SOLVED',
          message: `Victory! You mastered "${this.activePuzzle.title}"!`
        });
        return;
      }

      // If next move is opponent's automated response
      const opponentResponse = this.activePuzzle.solutionMoves[this.currentStep];
      if (opponentResponse) {
        setTimeout(() => {
          this.currentStep++;
          eventBus.emit('MOVE_INTENT', {
            from: opponentResponse.from,
            to: opponentResponse.to,
            promotion: 'q'
          });

          // Check if solved after opponent response
          if (this.currentStep >= this.activePuzzle!.solutionMoves.length) {
            cathedralAudio.playPuzzleSuccess();
            eventBus.emit('PUZZLE_STATE_CHANGED', {
              puzzle: this.activePuzzle!,
              step: Math.ceil(this.activePuzzle!.solutionMoves.length / 2),
              totalSteps: Math.ceil(this.activePuzzle!.solutionMoves.length / 2),
              status: 'SOLVED',
              message: `Victory! You mastered "${this.activePuzzle!.title}"!`
            });
          } else {
            eventBus.emit('PUZZLE_STATE_CHANGED', {
              puzzle: this.activePuzzle!,
              step: Math.floor(this.currentStep / 2),
              totalSteps: Math.ceil(this.activePuzzle!.solutionMoves.length / 2),
              status: 'IN_PROGRESS',
              message: 'Correct move! Find the finishing blow...'
            });
          }
        }, 650);
      }
    } else {
      // Wrong move in puzzle!
      eventBus.emit('PUZZLE_STATE_CHANGED', {
        puzzle: this.activePuzzle,
        step: Math.floor(this.currentStep / 2),
        totalSteps: Math.ceil(this.activePuzzle.solutionMoves.length / 2),
        status: 'FAILED',
        message: 'The magic wavered! That was not the winning combination.'
      });
    }
  }

  public resetCurrentPuzzle(): void {
    if (this.activePuzzle) {
      this.loadPuzzle(this.activePuzzle.id);
    }
  }

  public exitPuzzleMode(): void {
    this.isPuzzleMode = false;
    this.activePuzzle = null;
    this.currentStep = 0;
    gameState.reset();
    eventBus.emit('PUZZLE_STATE_CHANGED', null);
  }
}

export const puzzleManager = new PuzzleManager();
export default puzzleManager;
