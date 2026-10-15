import eventBus from './EventBus';
import gameState from './GameStateManager';
import cathedralAudio from '../audio/CathedralAudio';
import { Square } from 'chess.js';

export interface VoiceStatusPayload {
  isListening: boolean;
  transcript: string;
  feedback: string;
  isSuccess?: boolean;
}

export class VoiceCommander {
  private recognition: any = null;
  private isListening: boolean = false;
  private isSupported: boolean = false;

  constructor() {
    this.initRecognition();
    this.initListeners();
  }

  private initRecognition(): void {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Web Speech API is not supported in this browser.');
      this.isSupported = false;
      return;
    }

    this.isSupported = true;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isListening = true;
      eventBus.emit('VOICE_STATUS_CHANGED', {
        isListening: true,
        transcript: '',
        feedback: 'Arcane Ear listening... Speak your move (e.g. "Knight to F3")'
      });
    };

    this.recognition.onresult = (event: any) => {
      const lastIndex = event.results.length - 1;
      const transcript = event.results[lastIndex][0].transcript.trim();
      this.processVoiceCommand(transcript);
    };

    this.recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') return;
      console.warn('Speech recognition error:', event.error);
      eventBus.emit('VOICE_STATUS_CHANGED', {
        isListening: this.isListening,
        transcript: '',
        feedback: `Speech error: ${event.error}`,
        isSuccess: false
      });
    };

    this.recognition.onend = () => {
      // Auto-restart if user still wants voice active
      if (this.isListening) {
        try {
          this.recognition.start();
        } catch {
          this.isListening = false;
          eventBus.emit('VOICE_STATUS_CHANGED', {
            isListening: false,
            transcript: '',
            feedback: 'Voice inactive'
          });
        }
      }
    };
  }

  private initListeners(): void {
    eventBus.on('VOICE_TOGGLE_REQUESTED', () => {
      this.toggleListening();
    });
  }

  public getIsListening(): boolean {
    return this.isListening;
  }

  public getIsSupported(): boolean {
    return this.isSupported;
  }

  public toggleListening(): boolean {
    if (!this.isSupported) {
      eventBus.emit('VOICE_STATUS_CHANGED', {
        isListening: false,
        transcript: '',
        feedback: 'Web Speech API not supported in this browser',
        isSuccess: false
      });
      return false;
    }

    if (this.isListening) {
      this.isListening = false;
      try {
        this.recognition.stop();
      } catch {}
      eventBus.emit('VOICE_STATUS_CHANGED', {
        isListening: false,
        transcript: '',
        feedback: 'Microphone muted'
      });
      return false;
    } else {
      try {
        this.isListening = true;
        this.recognition.start();
        cathedralAudio.playSelect();
        return true;
      } catch (err) {
        console.warn('Failed to start speech recognition:', err);
        this.isListening = false;
        return false;
      }
    }
  }

  /**
   * Parses spoken commands into chess moves or arcane spells
   */
  public processVoiceCommand(rawText: string): boolean {
    const text = rawText.toLowerCase().replace(/[-_]/g, ' ').trim();

    // 1. Arcane Spell Commands
    if (text.includes('freeze')) {
      const square = this.extractSquare(text);
      if (square) {
        eventBus.emit('SPELL_CAST_REQUESTED', { spell: 'freeze', target: square });
        eventBus.emit('VOICE_STATUS_CHANGED', {
          isListening: true,
          transcript: rawText,
          feedback: `Frost incantation cast on ${square.toUpperCase()}!`,
          isSuccess: true
        });
        cathedralAudio.playVoiceRecognized();
        return true;
      }
    } else if (text.includes('revive') || text.includes('resurrect')) {
      eventBus.emit('SPELL_CAST_REQUESTED', { spell: 'revive' });
      eventBus.emit('VOICE_STATUS_CHANGED', {
        isListening: true,
        transcript: rawText,
        feedback: 'Resurrection spell invoked!',
        isSuccess: true
      });
      cathedralAudio.playVoiceRecognized();
      return true;
    }

    // 2. Castling Special Cases
    const currentChess = gameState.getChess();
    const legalMoves = currentChess.moves({ verbose: true });

    if (text.includes('castle') || text.includes('castling')) {
      const isQueenside = text.includes('queen') || text.includes('long');
      const targetSan = isQueenside ? 'O-O-O' : 'O-O';
      const move = legalMoves.find(m => m.san === targetSan);
      if (move) {
        return this.executeMatchedMove(move, rawText);
      }
    }

    // 3. Coordinate Move Match: e.g. "e2 to e4", "e2 e4", "d7 d5"
    const squaresInText = this.extractAllSquares(text);
    if (squaresInText.length >= 2) {
      const from = squaresInText[0];
      const to = squaresInText[1];
      const move = legalMoves.find(m => m.from === from && m.to === to);
      if (move) {
        return this.executeMatchedMove(move, rawText);
      }
    }

    // 4. Piece-to-Target Match: e.g. "Knight to f3", "Pawn to e4", "Bishop takes c4"
    const targetSquare = squaresInText.length === 1 ? squaresInText[0] : this.extractSquare(text);
    const pieceType = this.extractPieceType(text);

    if (targetSquare) {
      let candidateMoves = legalMoves.filter(m => m.to === targetSquare);

      if (pieceType) {
        candidateMoves = candidateMoves.filter(m => m.piece === pieceType);
      }

      if (candidateMoves.length === 1) {
        return this.executeMatchedMove(candidateMoves[0], rawText);
      } else if (candidateMoves.length > 1) {
        // If multiple pieces can move there and user didn't disambiguate, pick the first legal one
        return this.executeMatchedMove(candidateMoves[0], rawText);
      }
    }

    // Fallback: check if the text matches standard SAN (e.g. "nf3", "e4", "qh5")
    const sanNormalized = text.replace(/\s+/g, '');
    const sanMove = legalMoves.find(m => m.san.toLowerCase().replace(/[+#x]/g, '') === sanNormalized);
    if (sanMove) {
      return this.executeMatchedMove(sanMove, rawText);
    }

    // Move was not recognized or illegal
    eventBus.emit('VOICE_STATUS_CHANGED', {
      isListening: true,
      transcript: rawText,
      feedback: `Heard: "${rawText}" - No legal move found`,
      isSuccess: false
    });
    return false;
  }

  private executeMatchedMove(move: any, rawText: string): boolean {
    cathedralAudio.playVoiceRecognized();

    eventBus.emit('VOICE_STATUS_CHANGED', {
      isListening: true,
      transcript: rawText,
      feedback: `Incantation Accepted: ${move.san}!`,
      isSuccess: true
    });

    eventBus.emit('MOVE_INTENT', {
      from: move.from,
      to: move.to,
      promotion: move.promotion || 'q'
    });

    return true;
  }

  private extractSquare(text: string): string | null {
    const squares = this.extractAllSquares(text);
    return squares.length > 0 ? squares[squares.length - 1] : null;
  }

  private extractAllSquares(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/);
    const results: string[] = [];

    // Phonetic replacements
    const fileMap: Record<string, string> = {
      'a': 'a', 'ay': 'a', 'eh': 'a',
      'b': 'b', 'be': 'b', 'bee': 'b',
      'c': 'c', 'see': 'c', 'sea': 'c',
      'd': 'd', 'dee': 'd',
      'e': 'e',
      'f': 'f', 'ef': 'f',
      'g': 'g', 'gee': 'g',
      'h': 'h', 'aitch': 'h', 'eightch': 'h'
    };

    const rankMap: Record<string, string> = {
      '1': '1', 'one': '1', 'won': '1',
      '2': '2', 'two': '2', 'to': '2', 'too': '2',
      '3': '3', 'three': '3',
      '4': '4', 'four': '4', 'for': '4',
      '5': '5', 'five': '5',
      '6': '6', 'six': '6',
      '7': '7', 'seven': '7',
      '8': '8', 'eight': '8', 'ate': '8'
    };

    // Look for direct patterns like "e4", "f3", "c6"
    const regex = /\b([a-h])([1-8])\b/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      results.push(`${match[1]}${match[2]}`);
    }

    // Look for spaced patterns like "e 4", "f three", "c for"
    for (let i = 0; i < words.length - 1; i++) {
      const f = fileMap[words[i]];
      const r = rankMap[words[i + 1]];
      if (f && r) {
        const sq = `${f}${r}`;
        if (!results.includes(sq)) {
          results.push(sq);
        }
      }
    }

    return results;
  }

  private extractPieceType(text: string): 'p' | 'r' | 'n' | 'b' | 'q' | 'k' | null {
    if (text.includes('knight') || text.includes('night') || text.includes('horse')) return 'n';
    if (text.includes('bishop')) return 'b';
    if (text.includes('rook') || text.includes('rock') || text.includes('castle') || text.includes('tower')) return 'r';
    if (text.includes('queen')) return 'q';
    if (text.includes('king')) return 'k';
    if (text.includes('pawn')) return 'p';
    return null;
  }
}

export const voiceCommander = new VoiceCommander();
export default voiceCommander;
