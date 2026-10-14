import eventBus, { MoveEventPayload, TurnChangedPayload } from '../core/EventBus';
import gameState from '../core/GameStateManager';
import cathedralAudio from '../audio/CathedralAudio';

const PIECE_UNICODE: Record<'w' | 'b', Record<string, string>> = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' }
};

export class HUDController {
  // Top Bar elements
  private turnChip: HTMLElement | null = null;
  private turnLabel: HTMLElement | null = null;
  private statusBadge: HTMLElement | null = null;
  private statusText: HTMLElement | null = null;
  private camBtns: NodeListOf<HTMLButtonElement> | null = null;

  // History Card elements
  private moveLog: HTMLElement | null = null;
  private moveCountChip: HTMLElement | null = null;
  private whiteGraveyard: HTMLElement | null = null;
  private blackGraveyard: HTMLElement | null = null;

  // Bottom Dock elements
  private modeAIBtn: HTMLButtonElement | null = null;
  private modePVPBtn: HTMLButtonElement | null = null;
  private demoShatterBtn: HTMLButtonElement | null = null;
  private muteBtn: HTMLButtonElement | null = null;
  private muteIcon: HTMLElement | null = null;
  private archSpecBtn: HTMLButtonElement | null = null;
  private newGameBtn: HTMLButtonElement | null = null;

  // Modal elements
  private modalBackdrop: HTMLElement | null = null;
  private closeModalBtn: HTMLButtonElement | null = null;
  private modalDismissBtn: HTMLButtonElement | null = null;

  // Move tracking state
  private movesList: MoveEventPayload[] = [];

  constructor() {
    this.bindDomElements();
    this.initEventListeners();
    this.initBusListeners();
  }

  private bindDomElements(): void {
    this.turnChip = document.getElementById('turn-chip');
    this.turnLabel = document.getElementById('turn-label');
    this.statusBadge = document.getElementById('status-badge');
    this.statusText = document.getElementById('status-text');
    this.camBtns = document.querySelectorAll('.camera-controls-group .md3-icon-btn');

    this.moveLog = document.getElementById('move-log');
    this.moveCountChip = document.getElementById('move-count-chip');
    this.whiteGraveyard = document.getElementById('white-graveyard');
    this.blackGraveyard = document.getElementById('black-graveyard');

    this.modeAIBtn = document.getElementById('mode-ai') as HTMLButtonElement;
    this.modePVPBtn = document.getElementById('mode-pvp') as HTMLButtonElement;
    this.demoShatterBtn = document.getElementById('btn-demo-shatter') as HTMLButtonElement;
    this.muteBtn = document.getElementById('btn-mute') as HTMLButtonElement;
    this.muteIcon = document.getElementById('mute-icon');
    this.archSpecBtn = document.getElementById('btn-arch-spec') as HTMLButtonElement;
    this.newGameBtn = document.getElementById('btn-new-game') as HTMLButtonElement;

    this.modalBackdrop = document.getElementById('spec-modal-backdrop');
    this.closeModalBtn = document.getElementById('btn-close-modal') as HTMLButtonElement;
    this.modalDismissBtn = document.getElementById('btn-modal-dismiss') as HTMLButtonElement;
  }

  private initEventListeners(): void {
    // Camera Preset Buttons
    const camMap: Record<string, 'ORBIT' | 'WHITE_POV' | 'BLACK_POV' | 'TOP_DOWN'> = {
      'cam-orbit': 'ORBIT',
      'cam-white': 'WHITE_POV',
      'cam-black': 'BLACK_POV',
      'cam-top': 'TOP_DOWN'
    };

    if (this.camBtns) {
      this.camBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          this.camBtns?.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const preset = camMap[btn.id];
          if (preset) {
            eventBus.emit('CAMERA_PRESET_REQUESTED', preset);
            cathedralAudio.playSelect();
          }
        });
      });
    }

    // Game Mode Switch
    this.modeAIBtn?.addEventListener('click', () => {
      this.modeAIBtn?.classList.add('active');
      this.modeAIBtn?.setAttribute('aria-checked', 'true');
      this.modePVPBtn?.classList.remove('active');
      this.modePVPBtn?.setAttribute('aria-checked', 'false');
      eventBus.emit('MODE_CHANGED', 'AI');
      cathedralAudio.playSelect();
    });

    this.modePVPBtn?.addEventListener('click', () => {
      this.modePVPBtn?.classList.add('active');
      this.modePVPBtn?.setAttribute('aria-checked', 'true');
      this.modeAIBtn?.classList.remove('active');
      this.modeAIBtn?.setAttribute('aria-checked', 'false');
      eventBus.emit('MODE_CHANGED', 'PVP');
      cathedralAudio.playSelect();
    });

    // Demo Shatter Button
    this.demoShatterBtn?.addEventListener('click', () => {
      eventBus.emit('DEMO_SHATTER_REQUESTED', undefined);
    });

    // Audio Mute Button
    this.muteBtn?.addEventListener('click', () => {
      eventBus.emit('AUDIO_TOGGLE_REQUESTED', undefined);
    });

    // New Game FAB
    this.newGameBtn?.addEventListener('click', () => {
      gameState.reset();
      cathedralAudio.playSelect();
    });

    // Architecture Spec Modal
    this.archSpecBtn?.addEventListener('click', () => {
      this.modalBackdrop?.classList.remove('hidden');
      cathedralAudio.playSelect();
    });

    this.closeModalBtn?.addEventListener('click', () => {
      this.modalBackdrop?.classList.add('hidden');
    });

    this.modalDismissBtn?.addEventListener('click', () => {
      this.modalBackdrop?.classList.add('hidden');
    });

    this.modalBackdrop?.addEventListener('click', (e) => {
      if (e.target === this.modalBackdrop) {
        this.modalBackdrop?.classList.add('hidden');
      }
    });
  }

  private initBusListeners(): void {
    // 1. Move Executed
    eventBus.on('MOVE_EXECUTED', (payload) => {
      this.movesList.push(payload);
      this.renderMoveLog();
      this.updateGraveyard();
    });

    // 2. Turn Changed
    eventBus.on('TURN_CHANGED', (payload) => {
      this.updateTurnAndStatus(payload);
    });

    // 3. Audio State Changed
    eventBus.on('AUDIO_STATE_CHANGED', (isMuted) => {
      if (this.muteIcon) {
        this.muteIcon.innerText = isMuted ? 'volume_off' : 'volume_up';
      }
    });

    // 4. Game Reset
    eventBus.on('GAME_RESET', () => {
      this.movesList = [];
      this.renderMoveLog();
      this.updateGraveyard();
      if (this.moveCountChip) {
        this.moveCountChip.innerText = '0 moves';
      }
      if (this.statusBadge && this.statusText) {
        this.statusBadge.className = 'md3-badge status-normal';
        this.statusText.innerText = 'In Play';
      }
    });
  }

  private updateTurnAndStatus(payload: TurnChangedPayload): void {
    // Turn Chip
    if (this.turnChip && this.turnLabel) {
      if (payload.turn === 'w') {
        this.turnChip.className = 'md3-chip turn-white';
        this.turnLabel.innerText = "White's Turn";
      } else {
        this.turnChip.className = 'md3-chip turn-black';
        this.turnLabel.innerText = "Black's Turn";
      }
    }

    // Status Badge
    if (this.statusBadge && this.statusText) {
      if (payload.isCheckmate) {
        this.statusBadge.className = 'md3-badge status-checkmate';
        const winner = payload.turn === 'w' ? 'Black Obsidian' : 'White Marble';
        this.statusText.innerText = `Checkmate! ${winner} Victorious`;
        cathedralAudio.playCheckmate();
      } else if (payload.isStalemate) {
        this.statusBadge.className = 'md3-badge status-normal';
        this.statusText.innerText = 'Stalemate (Draw)';
      } else if (payload.isDraw) {
        this.statusBadge.className = 'md3-badge status-normal';
        this.statusText.innerText = 'Draw';
      } else if (payload.isCheck) {
        this.statusBadge.className = 'md3-badge status-check';
        this.statusText.innerText = 'King in Check!';
      } else {
        this.statusBadge.className = 'md3-badge status-normal';
        this.statusText.innerText = 'In Play';
      }
    }

    // Move Count
    if (this.moveCountChip) {
      this.moveCountChip.innerText = `${this.movesList.length} ply`;
    }
  }

  private renderMoveLog(): void {
    if (!this.moveLog) return;

    if (this.movesList.length === 0) {
      this.moveLog.innerHTML = `<div class="empty-log-hint">Awaiting the opening incantation...</div>`;
      return;
    }

    let html = '';
    const roundCount = Math.ceil(this.movesList.length / 2);

    for (let r = 0; r < roundCount; r++) {
      const whiteMove = this.movesList[r * 2];
      const blackMove = this.movesList[r * 2 + 1];

      const whiteCaptureIcon = whiteMove.captured ? '<span class="capture-icon">⚔️</span>' : '';
      const whiteCaptureClass = whiteMove.captured ? 'capture' : '';

      let blackHtml = '';
      if (blackMove) {
        const blackCaptureIcon = blackMove.captured ? '<span class="capture-icon">⚔️</span>' : '';
        const blackCaptureClass = blackMove.captured ? 'capture' : '';
        blackHtml = `<span class="move-cell ${blackCaptureClass}">${blackMove.san} ${blackCaptureIcon}</span>`;
      }

      html += `
        <div class="move-row">
          <span class="move-num">${r + 1}.</span>
          <span class="move-cell ${whiteCaptureClass}">${whiteMove.san} ${whiteCaptureIcon}</span>
          ${blackHtml}
        </div>
      `;
    }

    this.moveLog.innerHTML = html;
    // Auto-scroll to bottom of log
    this.moveLog.scrollTop = this.moveLog.scrollHeight;
  }

  private updateGraveyard(): void {
    const { w, b } = gameState.getCapturedPieces();

    // White graveyard (White pieces destroyed)
    if (this.whiteGraveyard) {
      this.whiteGraveyard.innerHTML = w
        .map(piece => `<span class="grave-piece" title="White ${piece.toUpperCase()}">${PIECE_UNICODE.w[piece] || piece}</span>`)
        .join('');
    }

    // Black graveyard (Black pieces destroyed)
    if (this.blackGraveyard) {
      this.blackGraveyard.innerHTML = b
        .map(piece => `<span class="grave-piece" title="Black ${piece.toUpperCase()}">${PIECE_UNICODE.b[piece] || piece}</span>`)
        .join('');
    }
  }
}

export const hudController = new HUDController();
export default hudController;
