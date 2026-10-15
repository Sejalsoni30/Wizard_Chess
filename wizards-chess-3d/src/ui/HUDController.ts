import eventBus, { MoveEventPayload, TurnChangedPayload } from '../core/EventBus';
import gameState from '../core/GameStateManager';
import cathedralAudio from '../audio/CathedralAudio';
import p2pNetwork from '../core/P2PNetwork';
import puzzleManager, { LORE_PUZZLES } from '../core/PuzzleManager';
import arcaneSpellEngine, { SpellType } from '../core/ArcaneSpellEngine';
import voiceCommander from '../core/VoiceCommander';

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

  // Voice Command elements
  private voiceBtn: HTMLButtonElement | null = null;
  private voicePill: HTMLElement | null = null;
  private voicePillText: HTMLElement | null = null;

  // New Modals buttons
  private p2pBtn: HTMLButtonElement | null = null;
  private puzzlesBtn: HTMLButtonElement | null = null;

  // History Card elements
  private moveLog: HTMLElement | null = null;
  private moveCountChip: HTMLElement | null = null;
  private whiteGraveyard: HTMLElement | null = null;
  private blackGraveyard: HTMLElement | null = null;

  // Bottom Dock elements
  private modeAIBtn: HTMLButtonElement | null = null;
  private modePVPBtn: HTMLButtonElement | null = null;
  private arcaneToggleBtn: HTMLButtonElement | null = null;
  private timeControlSelect: HTMLSelectElement | null = null;
  private demoShatterBtn: HTMLButtonElement | null = null;
  private muteBtn: HTMLButtonElement | null = null;
  private muteIcon: HTMLElement | null = null;
  private archSpecBtn: HTMLButtonElement | null = null;
  private newGameBtn: HTMLButtonElement | null = null;

  // Arcane Dock elements
  private arcaneDock: HTMLElement | null = null;
  private manaCount: HTMLElement | null = null;
  private manaFill: HTMLElement | null = null;
  private spellFreezeBtn: HTMLButtonElement | null = null;
  private spellWarpBtn: HTMLButtonElement | null = null;
  private spellReviveBtn: HTMLButtonElement | null = null;

  // P2P Modal elements
  private p2pModalBackdrop: HTMLElement | null = null;
  private closeP2PBtn: HTMLButtonElement | null = null;
  private hostP2PBtn: HTMLButtonElement | null = null;
  private shareLinkInput: HTMLInputElement | null = null;
  private copyLinkBtn: HTMLButtonElement | null = null;
  private joinInput: HTMLInputElement | null = null;
  private joinP2PBtn: HTMLButtonElement | null = null;
  private p2pStatusBox: HTMLElement | null = null;

  // Puzzles Modal elements
  private puzzlesModalBackdrop: HTMLElement | null = null;
  private closePuzzlesBtn: HTMLButtonElement | null = null;

  // Toast Notification element
  private toastElement: HTMLElement | null = null;
  private toastMessage: HTMLElement | null = null;
  private toastTimeout: any = null;

  // Architecture Spec Modal elements
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

    this.voiceBtn = document.getElementById('btn-voice') as HTMLButtonElement;
    this.voicePill = document.getElementById('voice-pill');
    this.voicePillText = document.getElementById('voice-pill-text');

    this.p2pBtn = document.getElementById('btn-p2p') as HTMLButtonElement;
    this.puzzlesBtn = document.getElementById('btn-puzzles') as HTMLButtonElement;

    this.moveLog = document.getElementById('move-log');
    this.moveCountChip = document.getElementById('move-count-chip');
    this.whiteGraveyard = document.getElementById('white-graveyard');
    this.blackGraveyard = document.getElementById('black-graveyard');

    this.modeAIBtn = document.getElementById('mode-ai') as HTMLButtonElement;
    this.modePVPBtn = document.getElementById('mode-pvp') as HTMLButtonElement;
    this.arcaneToggleBtn = document.getElementById('btn-arcane-toggle') as HTMLButtonElement;
    this.timeControlSelect = document.getElementById('select-time-control') as HTMLSelectElement;
    this.demoShatterBtn = document.getElementById('btn-demo-shatter') as HTMLButtonElement;
    this.muteBtn = document.getElementById('btn-mute') as HTMLButtonElement;
    this.muteIcon = document.getElementById('mute-icon');
    this.archSpecBtn = document.getElementById('btn-arch-spec') as HTMLButtonElement;
    this.newGameBtn = document.getElementById('btn-new-game') as HTMLButtonElement;

    this.arcaneDock = document.getElementById('arcane-dock');
    this.manaCount = document.getElementById('mana-count');
    this.manaFill = document.getElementById('mana-fill');
    this.spellFreezeBtn = document.getElementById('spell-freeze') as HTMLButtonElement;
    this.spellWarpBtn = document.getElementById('spell-warp') as HTMLButtonElement;
    this.spellReviveBtn = document.getElementById('spell-revive') as HTMLButtonElement;

    this.p2pModalBackdrop = document.getElementById('p2p-modal-backdrop');
    this.closeP2PBtn = document.getElementById('btn-close-p2p') as HTMLButtonElement;
    this.hostP2PBtn = document.getElementById('btn-host-p2p') as HTMLButtonElement;
    this.shareLinkInput = document.getElementById('p2p-share-link') as HTMLInputElement;
    this.copyLinkBtn = document.getElementById('btn-copy-p2p-link') as HTMLButtonElement;
    this.joinInput = document.getElementById('p2p-join-input') as HTMLInputElement;
    this.joinP2PBtn = document.getElementById('btn-join-p2p') as HTMLButtonElement;
    this.p2pStatusBox = document.getElementById('p2p-status-box');

    this.puzzlesModalBackdrop = document.getElementById('puzzles-modal-backdrop');
    this.closePuzzlesBtn = document.getElementById('btn-close-puzzles') as HTMLButtonElement;

    this.toastElement = document.getElementById('arcane-toast');
    this.toastMessage = document.getElementById('toast-message');

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

    // Voice Command Toggle
    this.voiceBtn?.addEventListener('click', () => {
      eventBus.emit('VOICE_TOGGLE_REQUESTED', undefined);
    });

    // P2P Multiplayer Modal Toggle
    this.p2pBtn?.addEventListener('click', () => {
      this.p2pModalBackdrop?.classList.remove('hidden');
      cathedralAudio.playSelect();
    });
    this.closeP2PBtn?.addEventListener('click', () => {
      this.p2pModalBackdrop?.classList.add('hidden');
    });
    this.p2pModalBackdrop?.addEventListener('click', (e) => {
      if (this.p2pModalBackdrop && e.target === this.p2pModalBackdrop) {
        this.p2pModalBackdrop.classList.add('hidden');
      }
    });

    // P2P Host & Share Link
    this.hostP2PBtn?.addEventListener('click', async () => {
      this.p2pStatusBox!.textContent = 'Summoning WebRTC chamber...';
      try {
        const roomCode = await p2pNetwork.createRoom();
        const link = p2pNetwork.getShareableLink();
        if (this.shareLinkInput) {
          this.shareLinkInput.value = link;
        }
        this.p2pStatusBox!.textContent = `Chamber open! Code: ${roomCode}. Share the link with your friend.`;
        this.showToast(`Chamber created: ${roomCode}`);
      } catch (err: any) {
        this.p2pStatusBox!.textContent = 'Failed to create room: ' + err.message;
      }
    });

    // P2P Copy Link Button
    this.copyLinkBtn?.addEventListener('click', () => {
      if (this.shareLinkInput && this.shareLinkInput.value) {
        navigator.clipboard.writeText(this.shareLinkInput.value);
        this.showToast('1-Click Friend Link copied to clipboard!');
        cathedralAudio.playSelect();
      }
    });

    // P2P Join Button
    this.joinP2PBtn?.addEventListener('click', async () => {
      const code = this.joinInput?.value.trim();
      if (!code) return;
      this.p2pStatusBox!.textContent = `Entering chamber ${code}...`;
      try {
        await p2pNetwork.joinRoom(code);
        this.showToast(`Joined Chamber ${code}!`);
        this.p2pModalBackdrop?.classList.add('hidden');
      } catch (err: any) {
        this.p2pStatusBox!.textContent = 'Failed to connect: ' + err.message;
      }
    });

    // Iconic Lore Puzzles Modal Toggle
    this.puzzlesBtn?.addEventListener('click', () => {
      this.puzzlesModalBackdrop?.classList.remove('hidden');
      cathedralAudio.playSelect();
    });
    this.closePuzzlesBtn?.addEventListener('click', () => {
      this.puzzlesModalBackdrop?.classList.add('hidden');
    });
    this.puzzlesModalBackdrop?.addEventListener('click', (e) => {
      if (this.puzzlesModalBackdrop && e.target === this.puzzlesModalBackdrop) {
        this.puzzlesModalBackdrop.classList.add('hidden');
      }
    });

    // Puzzle card summon challenge buttons
    document.querySelectorAll('.btn-play-puzzle').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const puzzleId = target.getAttribute('data-puzzle');
        if (puzzleId) {
          eventBus.emit('PUZZLE_SELECTED', puzzleId);
          this.puzzlesModalBackdrop?.classList.add('hidden');
          this.showToast(`Lore Challenge Summoned: ${puzzleId}!`);
        }
      });
    });

    // Arcane Mode Toggle
    this.arcaneToggleBtn?.addEventListener('click', () => {
      const isCurrentlyActive = this.arcaneToggleBtn?.classList.contains('active');
      const newState = !isCurrentlyActive;

      if (newState) {
        this.arcaneToggleBtn?.classList.add('active');
        this.arcaneDock?.classList.remove('hidden');
        this.showToast('Arcane Spells & Mana Mode Activated!');
      } else {
        this.arcaneToggleBtn?.classList.remove('active');
        this.arcaneDock?.classList.add('hidden');
        this.showToast('Arcane Mode Deactivated');
      }

      eventBus.emit('ARCANE_MODE_TOGGLED', newState);
      cathedralAudio.playSelect();
    });

    // Spell Cast Buttons
    this.spellFreezeBtn?.addEventListener('click', () => {
      eventBus.emit('SPELL_CAST_REQUESTED', { spell: 'freeze' });
    });
    this.spellWarpBtn?.addEventListener('click', () => {
      eventBus.emit('SPELL_CAST_REQUESTED', { spell: 'warp' });
    });
    this.spellReviveBtn?.addEventListener('click', () => {
      eventBus.emit('SPELL_CAST_REQUESTED', { spell: 'revive' });
    });

    // 3D Crystal Hourglass Time Control Select
    this.timeControlSelect?.addEventListener('change', () => {
      const val = this.timeControlSelect?.value as any;
      eventBus.emit('TIME_CONTROL_CHANGED', val);
      this.showToast(`Altar Sand Timer: ${val}`);
      cathedralAudio.playSelect();
    });

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
      this.showToast('New Match Begun');
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
      if (this.modalBackdrop && e.target === this.modalBackdrop) {
        this.modalBackdrop.classList.add('hidden');
      }
    });
  }

  private initBusListeners(): void {
    // Voice Status
    eventBus.on('VOICE_STATUS_CHANGED', ({ isListening, feedback, isSuccess }) => {
      if (isListening) {
        this.voiceBtn?.classList.add('active');
        this.voicePill?.classList.remove('hidden');
        if (this.voicePillText) this.voicePillText.textContent = feedback || 'Listening for incantation...';
      } else {
        this.voiceBtn?.classList.remove('active');
        this.voicePill?.classList.add('hidden');
      }

      if (feedback) {
        this.showToast(feedback);
      }
    });

    // P2P Status
    eventBus.on('P2P_STATUS_CHANGED', (status) => {
      if (this.p2pStatusBox) {
        this.p2pStatusBox.textContent = status.statusText;
      }
      if (status.isConnected) {
        this.showToast(status.statusText);
      }
    });

    // Arcane State
    eventBus.on('ARCANE_STATE_CHANGED', (state) => {
      const turn = gameState.getTurn();
      const currentMana = state.mana[turn] || 0;
      if (this.manaCount) this.manaCount.textContent = `${currentMana} / 100 MP`;
      if (this.manaFill) this.manaFill.style.width = `${currentMana}%`;
    });

    // Spell Feedback
    eventBus.on('SPELL_FEEDBACK', ({ message }) => {
      this.showToast(message);
    });

    // Time Forfeit
    eventBus.on('TIME_FORFEIT', ({ winner }) => {
      this.showToast(`Time Expired! ${winner} claims victory!`);
    });

    // Living Piece Blunder Alert
    eventBus.on('BLUNDER_DETECTED', ({ isBlunder, square }) => {
      if (isBlunder) {
        this.showToast(`⚠️ Danger! Piece at ${square.toUpperCase()} trembles in peril!`);
      }
    });

    // Turn Changed
    eventBus.on('TURN_CHANGED', (payload: TurnChangedPayload) => {
      this.updateTurnUI(payload);
    });

    // Move Executed
    eventBus.on('MOVE_EXECUTED', (move: MoveEventPayload) => {
      this.recordMove(move);
      this.updateGraveyard();
    });

    // Audio Mute State
    eventBus.on('AUDIO_STATE_CHANGED', (isMuted: boolean) => {
      if (this.muteIcon) {
        this.muteIcon.textContent = isMuted ? 'volume_off' : 'volume_up';
      }
    });

    // Game Reset
    eventBus.on('GAME_RESET', () => {
      this.movesList = [];
      if (this.moveLog) {
        this.moveLog.innerHTML = '<div class="empty-log-hint">Awaiting the opening incantation...</div>';
      }
      if (this.moveCountChip) {
        this.moveCountChip.textContent = '0 moves';
      }
      this.updateGraveyard();
    });
  }

  public showToast(message: string, duration: number = 3000): void {
    if (!this.toastElement || !this.toastMessage) return;

    this.toastMessage.textContent = message;
    this.toastElement.classList.remove('hidden');

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    this.toastTimeout = setTimeout(() => {
      this.toastElement?.classList.add('hidden');
    }, duration);
  }

  private updateTurnUI(payload: TurnChangedPayload): void {
    if (this.turnChip && this.turnLabel) {
      if (payload.turn === 'w') {
        this.turnChip.className = 'md3-chip turn-white';
        this.turnLabel.textContent = "White's Turn";
      } else {
        this.turnChip.className = 'md3-chip turn-black';
        this.turnLabel.textContent = "Black's Turn";
      }
    }

    if (this.statusBadge && this.statusText) {
      if (payload.isCheckmate) {
        this.statusBadge.className = 'md3-badge status-checkmate';
        this.statusText.textContent = `Checkmate! ${payload.turn === 'w' ? 'Black' : 'White'} Victorious`;
        cathedralAudio.playCheckmate();
      } else if (payload.isCheck) {
        this.statusBadge.className = 'md3-badge status-check';
        this.statusText.textContent = 'Check!';
      } else if (payload.isDraw || payload.isStalemate) {
        this.statusBadge.className = 'md3-badge status-draw';
        this.statusText.textContent = 'Draw / Stalemate';
      } else {
        this.statusBadge.className = 'md3-badge status-normal';
        this.statusText.textContent = 'In Play';
      }
    }
  }

  private recordMove(move: MoveEventPayload): void {
    this.movesList.push(move);

    if (this.moveCountChip) {
      const count = this.movesList.length;
      this.moveCountChip.textContent = `${count} move${count === 1 ? '' : 's'}`;
    }

    if (this.moveLog) {
      const emptyHint = this.moveLog.querySelector('.empty-log-hint');
      if (emptyHint) {
        this.moveLog.innerHTML = '';
      }

      const moveNumber = Math.ceil(this.movesList.length / 2);
      const isWhite = move.color === 'w';

      if (isWhite) {
        const row = document.createElement('div');
        row.className = 'move-log-row';
        row.id = `move-row-${moveNumber}`;

        const numSpan = document.createElement('span');
        numSpan.className = 'move-number';
        numSpan.textContent = `${moveNumber}.`;

        const whiteMoveSpan = document.createElement('span');
        whiteMoveSpan.className = 'move-san white-move';
        whiteMoveSpan.textContent = `${PIECE_UNICODE.w[move.piece] || ''} ${move.san}`;

        row.appendChild(numSpan);
        row.appendChild(whiteMoveSpan);
        this.moveLog.appendChild(row);
      } else {
        const row = document.getElementById(`move-row-${moveNumber}`);
        if (row) {
          const blackMoveSpan = document.createElement('span');
          blackMoveSpan.className = 'move-san black-move';
          blackMoveSpan.textContent = `${PIECE_UNICODE.b[move.piece] || ''} ${move.san}`;
          row.appendChild(blackMoveSpan);
        }
      }

      this.moveLog.scrollTop = this.moveLog.scrollHeight;
    }
  }

  private updateGraveyard(): void {
    const captured = gameState.getCapturedPieces();

    if (this.whiteGraveyard) {
      this.whiteGraveyard.innerHTML = '';
      captured.w.forEach((pieceType) => {
        const token = document.createElement('span');
        token.className = 'graveyard-token white-token';
        token.textContent = PIECE_UNICODE.w[pieceType] || pieceType;
        this.whiteGraveyard?.appendChild(token);
      });
    }

    if (this.blackGraveyard) {
      this.blackGraveyard.innerHTML = '';
      captured.b.forEach((pieceType) => {
        const token = document.createElement('span');
        token.className = 'graveyard-token black-token';
        token.textContent = PIECE_UNICODE.b[pieceType] || pieceType;
        this.blackGraveyard?.appendChild(token);
      });
    }
  }
}

export const hudController = new HUDController();
export default hudController;
