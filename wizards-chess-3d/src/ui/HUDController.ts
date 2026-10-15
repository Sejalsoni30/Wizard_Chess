import eventBus, { MoveEventPayload, TurnChangedPayload } from '../core/EventBus';
import gameState from '../core/GameStateManager';
import cathedralAudio from '../audio/CathedralAudio';
import p2pNetwork from '../core/P2PNetwork';
import puzzleManager, { LORE_PUZZLES } from '../core/PuzzleManager';
import arcaneSpellEngine from '../core/ArcaneSpellEngine';
import voiceCommander from '../core/VoiceCommander';
import aiController, { AIDifficulty } from '../core/AIController';

const PIECE_UNICODE: Record<'w' | 'b', Record<string, string>> = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' }
};

export class HUDController {
  // Page Views
  private pageMainMenu: HTMLElement | null = null;
  private pageGameArena: HTMLElement | null = null;
  private currentView: 'MENU' | 'PLAY' = 'MENU';

  // Main Menu Elements
  private btnMenuQuickPlay: HTMLButtonElement | null = null;
  private btnModeAIPlay: HTMLButtonElement | null = null;
  private menuSelectAiDiff: HTMLSelectElement | null = null;
  private btnModeArcanePlay: HTMLButtonElement | null = null;
  private btnModeSpeedPlay: HTMLButtonElement | null = null;
  private menuSelectSpeedTime: HTMLSelectElement | null = null;
  private btnModePuzzlesBrowse: HTMLButtonElement | null = null;
  private btnMenuFriendLink: HTMLButtonElement | null = null;
  private btnMenuCodex: HTMLButtonElement | null = null;
  private btnMenuSettings: HTMLButtonElement | null = null;
  private btnMenuDemoShatter: HTMLButtonElement | null = null;

  // In-Game Arena Top Bar elements
  private btnReturnMenu: HTMLButtonElement | null = null;
  private activeModeIcon: HTMLElement | null = null;
  private activeModeText: HTMLElement | null = null;
  private turnChip: HTMLElement | null = null;
  private turnLabel: HTMLElement | null = null;
  private statusBadge: HTMLElement | null = null;
  private statusText: HTMLElement | null = null;
  private aiThinkingPill: HTMLElement | null = null;
  private voicePill: HTMLElement | null = null;
  private voicePillText: HTMLElement | null = null;

  // Tactical Arena Tools
  private btnHint: HTMLButtonElement | null = null;
  private btnUndo: HTMLButtonElement | null = null;
  private btnRestart: HTMLButtonElement | null = null;
  private btnResign: HTMLButtonElement | null = null;
  private camBtns: NodeListOf<HTMLButtonElement> | null = null;
  private voiceBtn: HTMLButtonElement | null = null;
  private muteBtn: HTMLButtonElement | null = null;
  private muteIcon: HTMLElement | null = null;
  private inGameSettingsBtn: HTMLButtonElement | null = null;

  // Puzzle Banner elements
  private puzzleBanner: HTMLElement | null = null;
  private puzzleBannerTitle: HTMLElement | null = null;
  private puzzleBannerDesc: HTMLElement | null = null;
  private puzzleBannerStep: HTMLElement | null = null;
  private btnPuzzleHint: HTMLButtonElement | null = null;
  private btnPuzzleRetry: HTMLButtonElement | null = null;
  private btnPuzzleExit: HTMLButtonElement | null = null;

  // Player Cards elements
  private blackPlayerCard: HTMLElement | null = null;
  private blackPlayerName: HTMLElement | null = null;
  private blackPlayerTitle: HTMLElement | null = null;
  private blackMaterialBadge: HTMLElement | null = null;
  private whiteGraveyard: HTMLElement | null = null;

  private whitePlayerCard: HTMLElement | null = null;
  private whitePlayerName: HTMLElement | null = null;
  private whitePlayerTitle: HTMLElement | null = null;
  private whiteMaterialBadge: HTMLElement | null = null;
  private blackGraveyard: HTMLElement | null = null;

  // History Card elements
  private moveLog: HTMLElement | null = null;
  private moveCountChip: HTMLElement | null = null;

  // Arcane Dock elements
  private arcaneDock: HTMLElement | null = null;
  private manaCount: HTMLElement | null = null;
  private manaFill: HTMLElement | null = null;
  private spellFreezeBtn: HTMLButtonElement | null = null;
  private spellWarpBtn: HTMLButtonElement | null = null;
  private spellReviveBtn: HTMLButtonElement | null = null;

  // Modals elements
  private codexModalBackdrop: HTMLElement | null = null;
  private closeCodexBtn: HTMLButtonElement | null = null;
  private codexTabs: NodeListOf<HTMLButtonElement> | null = null;

  private puzzlesModalBackdrop: HTMLElement | null = null;
  private closePuzzlesBtn: HTMLButtonElement | null = null;

  private p2pModalBackdrop: HTMLElement | null = null;
  private closeP2PBtn: HTMLButtonElement | null = null;
  private hostP2PBtn: HTMLButtonElement | null = null;
  private shareLinkInput: HTMLInputElement | null = null;
  private copyLinkBtn: HTMLButtonElement | null = null;
  private joinInput: HTMLInputElement | null = null;
  private joinP2PBtn: HTMLButtonElement | null = null;
  private p2pStatusBox: HTMLElement | null = null;

  private settingsModalBackdrop: HTMLElement | null = null;
  private closeSettingsBtn: HTMLButtonElement | null = null;
  private saveSettingsBtn: HTMLButtonElement | null = null;
  private settingsVolumeSlider: HTMLInputElement | null = null;

  private promotionModalBackdrop: HTMLElement | null = null;
  private pendingPromotion: { from: string; to: string } | null = null;

  private gameOverModalBackdrop: HTMLElement | null = null;
  private gameOverTitle: HTMLElement | null = null;
  private gameOverSubtitle: HTMLElement | null = null;
  private gameOverStats: HTMLElement | null = null;
  private gameOverIcon: HTMLElement | null = null;
  private rematchBtn: HTMLButtonElement | null = null;
  private inspectBtn: HTMLButtonElement | null = null;
  private gameOverMenuBtn: HTMLButtonElement | null = null;

  // Toast Notification element
  private toastElement: HTMLElement | null = null;
  private toastMessage: HTMLElement | null = null;
  private toastTimeout: any = null;

  // Move tracking state
  private movesList: MoveEventPayload[] = [];
  private activeGameMode: 'AI' | 'ARCANE' | 'SPEED' | 'PUZZLE' | 'P2P' = 'AI';

  constructor() {
    this.bindDomElements();
    this.initEventListeners();
    this.initBusListeners();

    // Default start at Main Menu
    this.setPage('MENU');
  }

  public setPage(view: 'MENU' | 'PLAY'): void {
    this.currentView = view;
    if (view === 'MENU') {
      this.pageMainMenu?.classList.remove('hidden');
      this.pageGameArena?.classList.add('hidden');
      eventBus.emit('VIEW_CHANGED', 'MENU');
    } else {
      this.pageMainMenu?.classList.add('hidden');
      this.pageGameArena?.classList.remove('hidden');
      eventBus.emit('VIEW_CHANGED', 'PLAY');
    }
  }

  private bindDomElements(): void {
    // Pages
    this.pageMainMenu = document.getElementById('page-main-menu');
    this.pageGameArena = document.getElementById('page-game-arena');

    // Main Menu Buttons
    this.btnMenuQuickPlay = document.getElementById('btn-menu-quick-play') as HTMLButtonElement;
    this.btnModeAIPlay = document.getElementById('btn-mode-ai-play') as HTMLButtonElement;
    this.menuSelectAiDiff = document.getElementById('menu-select-ai-diff') as HTMLSelectElement;
    this.btnModeArcanePlay = document.getElementById('btn-mode-arcane-play') as HTMLButtonElement;
    this.btnModeSpeedPlay = document.getElementById('btn-mode-speed-play') as HTMLButtonElement;
    this.menuSelectSpeedTime = document.getElementById('menu-select-speed-time') as HTMLSelectElement;
    this.btnModePuzzlesBrowse = document.getElementById('btn-mode-puzzles-browse') as HTMLButtonElement;
    this.btnMenuFriendLink = document.getElementById('btn-menu-friend-link') as HTMLButtonElement;
    this.btnMenuCodex = document.getElementById('btn-menu-codex') as HTMLButtonElement;
    this.btnMenuSettings = document.getElementById('btn-menu-settings') as HTMLButtonElement;
    this.btnMenuDemoShatter = document.getElementById('btn-menu-demo-shatter') as HTMLButtonElement;

    // Arena Top Bar
    this.btnReturnMenu = document.getElementById('btn-return-menu') as HTMLButtonElement;
    this.activeModeIcon = document.getElementById('active-mode-icon');
    this.activeModeText = document.getElementById('active-mode-text');
    this.turnChip = document.getElementById('turn-chip');
    this.turnLabel = document.getElementById('turn-label');
    this.statusBadge = document.getElementById('status-badge');
    this.statusText = document.getElementById('status-text');
    this.aiThinkingPill = document.getElementById('ai-thinking-pill');
    this.voicePill = document.getElementById('voice-pill');
    this.voicePillText = document.getElementById('voice-pill-text');

    // Arena Tactical Tools
    this.btnHint = document.getElementById('btn-hint') as HTMLButtonElement;
    this.btnUndo = document.getElementById('btn-undo') as HTMLButtonElement;
    this.btnRestart = document.getElementById('btn-restart') as HTMLButtonElement;
    this.btnResign = document.getElementById('btn-resign') as HTMLButtonElement;
    this.camBtns = document.querySelectorAll('.camera-controls-group .md3-icon-btn');
    this.voiceBtn = document.getElementById('btn-voice') as HTMLButtonElement;
    this.muteBtn = document.getElementById('btn-mute') as HTMLButtonElement;
    this.muteIcon = document.getElementById('mute-icon');
    this.inGameSettingsBtn = document.getElementById('btn-settings') as HTMLButtonElement;

    // Puzzle Banner
    this.puzzleBanner = document.getElementById('puzzle-banner');
    this.puzzleBannerTitle = document.getElementById('puzzle-banner-title');
    this.puzzleBannerDesc = document.getElementById('puzzle-banner-desc');
    this.puzzleBannerStep = document.getElementById('puzzle-banner-step');
    this.btnPuzzleHint = document.getElementById('btn-puzzle-hint') as HTMLButtonElement;
    this.btnPuzzleRetry = document.getElementById('btn-puzzle-retry') as HTMLButtonElement;
    this.btnPuzzleExit = document.getElementById('btn-puzzle-exit') as HTMLButtonElement;

    // Player Cards
    this.blackPlayerCard = document.getElementById('black-player-card');
    this.blackPlayerName = document.getElementById('black-player-name');
    this.blackPlayerTitle = document.getElementById('black-player-title');
    this.blackMaterialBadge = document.getElementById('black-material-badge');
    this.whiteGraveyard = document.getElementById('white-graveyard');

    this.whitePlayerCard = document.getElementById('white-player-card');
    this.whitePlayerName = document.getElementById('white-player-name');
    this.whitePlayerTitle = document.getElementById('white-player-title');
    this.whiteMaterialBadge = document.getElementById('white-material-badge');
    this.blackGraveyard = document.getElementById('black-graveyard');

    // Move Chronicle
    this.moveLog = document.getElementById('move-log');
    this.moveCountChip = document.getElementById('move-count-chip');

    // Arcane Dock
    this.arcaneDock = document.getElementById('arcane-dock');
    this.manaCount = document.getElementById('mana-count');
    this.manaFill = document.getElementById('mana-fill');
    this.spellFreezeBtn = document.getElementById('spell-freeze') as HTMLButtonElement;
    this.spellWarpBtn = document.getElementById('spell-warp') as HTMLButtonElement;
    this.spellReviveBtn = document.getElementById('spell-revive') as HTMLButtonElement;

    // Modals
    this.codexModalBackdrop = document.getElementById('codex-modal-backdrop');
    this.closeCodexBtn = document.getElementById('btn-close-codex') as HTMLButtonElement;
    this.codexTabs = document.querySelectorAll('.codex-tab');

    this.puzzlesModalBackdrop = document.getElementById('puzzles-modal-backdrop');
    this.closePuzzlesBtn = document.getElementById('btn-close-puzzles') as HTMLButtonElement;

    this.p2pModalBackdrop = document.getElementById('p2p-modal-backdrop');
    this.closeP2PBtn = document.getElementById('btn-close-p2p') as HTMLButtonElement;
    this.hostP2PBtn = document.getElementById('btn-host-p2p') as HTMLButtonElement;
    this.shareLinkInput = document.getElementById('p2p-share-link') as HTMLInputElement;
    this.copyLinkBtn = document.getElementById('btn-copy-p2p-link') as HTMLButtonElement;
    this.joinInput = document.getElementById('p2p-join-input') as HTMLInputElement;
    this.joinP2PBtn = document.getElementById('btn-join-p2p') as HTMLButtonElement;
    this.p2pStatusBox = document.getElementById('p2p-status-box');

    this.settingsModalBackdrop = document.getElementById('settings-modal-backdrop');
    this.closeSettingsBtn = document.getElementById('btn-close-settings') as HTMLButtonElement;
    this.saveSettingsBtn = document.getElementById('btn-save-settings') as HTMLButtonElement;
    this.settingsVolumeSlider = document.getElementById('settings-volume-slider') as HTMLInputElement;

    this.promotionModalBackdrop = document.getElementById('promotion-modal-backdrop');

    this.gameOverModalBackdrop = document.getElementById('game-over-modal-backdrop');
    this.gameOverTitle = document.getElementById('game-over-title');
    this.gameOverSubtitle = document.getElementById('game-over-subtitle');
    this.gameOverStats = document.getElementById('game-over-stats');
    this.gameOverIcon = document.getElementById('game-over-icon');
    this.rematchBtn = document.getElementById('btn-game-over-rematch') as HTMLButtonElement;
    this.inspectBtn = document.getElementById('btn-game-over-inspect') as HTMLButtonElement;
    this.gameOverMenuBtn = document.getElementById('btn-game-over-menu') as HTMLButtonElement;

    this.toastElement = document.getElementById('arcane-toast');
    this.toastMessage = document.getElementById('toast-message');
  }

  private initEventListeners(): void {
    // ----------------------------------------------------
    // 1. Main Menu Navigation Actions
    // ----------------------------------------------------
    this.btnMenuQuickPlay?.addEventListener('click', () => {
      this.startAIMatch('ADEPT');
    });

    this.btnModeAIPlay?.addEventListener('click', () => {
      const diff = (this.menuSelectAiDiff?.value as AIDifficulty) || 'ADEPT';
      this.startAIMatch(diff);
    });

    this.btnModeArcanePlay?.addEventListener('click', () => {
      this.startArcaneMatch();
    });

    this.btnModeSpeedPlay?.addEventListener('click', () => {
      const time = (this.menuSelectSpeedTime?.value as any) || 'BLITZ';
      this.startSpeedMatch(time);
    });

    this.btnModePuzzlesBrowse?.addEventListener('click', () => {
      this.puzzlesModalBackdrop?.classList.remove('hidden');
      cathedralAudio.playSelect();
    });

    this.btnMenuFriendLink?.addEventListener('click', () => {
      this.p2pModalBackdrop?.classList.remove('hidden');
      cathedralAudio.playSelect();
    });

    this.btnMenuCodex?.addEventListener('click', () => {
      this.codexModalBackdrop?.classList.remove('hidden');
      cathedralAudio.playSelect();
    });

    this.btnMenuSettings?.addEventListener('click', () => {
      this.settingsModalBackdrop?.classList.remove('hidden');
      cathedralAudio.playSelect();
    });

    this.btnMenuDemoShatter?.addEventListener('click', () => {
      this.setPage('PLAY');
      eventBus.emit('DEMO_SHATTER_REQUESTED', undefined);
      this.showToast('Showcasing 3D Shatter Physics!');
    });

    // ----------------------------------------------------
    // 2. Arena In-Game Tactical Controls
    // ----------------------------------------------------
    this.btnReturnMenu?.addEventListener('click', () => {
      this.setPage('MENU');
      cathedralAudio.playSelect();
    });

    this.btnHint?.addEventListener('click', () => {
      const best = aiController.getHintMove();
      if (best) {
        this.showToast(`Arcane Vision: Move ${best.from.toUpperCase()} to ${best.to.toUpperCase()}!`);
        cathedralAudio.playSelect();
      } else {
        this.showToast('No obvious hint in current position.');
      }
    });

    this.btnUndo?.addEventListener('click', () => {
      if (this.activeGameMode === 'PUZZLE') {
        puzzleManager.resetCurrentPuzzle();
        this.showToast('Puzzle Position Reset');
      } else {
        const undone = gameState.undoMove(this.activeGameMode === 'AI');
        if (undone) {
          this.showToast('Move Undone — Time Reversed!');
          cathedralAudio.playSelect();
        } else {
          this.showToast('No prior moves to undo.');
        }
      }
    });

    this.btnRestart?.addEventListener('click', () => {
      if (this.activeGameMode === 'PUZZLE') {
        puzzleManager.resetCurrentPuzzle();
      } else {
        gameState.reset();
      }
      cathedralAudio.playSelect();
      this.showToast('Board Reset');
    });

    this.btnResign?.addEventListener('click', () => {
      const winner = gameState.getTurn() === 'w' ? 'Black' : 'White';
      this.triggerGameOverModal(
        `${winner.toUpperCase()} VICTORIOUS!`,
        'Match forfeited by surrender upon the cathedral altar.',
        winner === 'White'
      );
      cathedralAudio.playSelect();
    });

    this.inGameSettingsBtn?.addEventListener('click', () => {
      this.settingsModalBackdrop?.classList.remove('hidden');
      cathedralAudio.playSelect();
    });

    // Camera Presets
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

    // Voice Toggle
    this.voiceBtn?.addEventListener('click', () => {
      eventBus.emit('VOICE_TOGGLE_REQUESTED', undefined);
    });

    // Mute Audio Toggle
    this.muteBtn?.addEventListener('click', () => {
      eventBus.emit('AUDIO_TOGGLE_REQUESTED', undefined);
    });

    // ----------------------------------------------------
    // 3. Puzzle Banner Actions
    // ----------------------------------------------------
    this.btnPuzzleHint?.addEventListener('click', () => {
      const active = puzzleManager.getActivePuzzle();
      if (active) {
        this.showToast(`Lore Clue: ${active.hint}`, 4500);
      }
    });

    this.btnPuzzleRetry?.addEventListener('click', () => {
      puzzleManager.resetCurrentPuzzle();
      this.showToast('Puzzle Reset to Opening');
    });

    this.btnPuzzleExit?.addEventListener('click', () => {
      puzzleManager.exitPuzzleMode();
      this.puzzleBanner?.classList.add('hidden');
      this.startAIMatch('ADEPT');
      this.showToast('Exited Lore Challenges');
    });

    // Puzzle Card Summon Challenge
    document.querySelectorAll('.btn-play-puzzle').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const puzzleId = target.getAttribute('data-puzzle');
        if (puzzleId) {
          this.puzzlesModalBackdrop?.classList.add('hidden');
          this.startPuzzleMatch(puzzleId);
        }
      });
    });

    // ----------------------------------------------------
    // 4. Arcane Spells Actions
    // ----------------------------------------------------
    this.spellFreezeBtn?.addEventListener('click', () => {
      eventBus.emit('SPELL_CAST_REQUESTED', { spell: 'freeze' });
    });
    this.spellWarpBtn?.addEventListener('click', () => {
      eventBus.emit('SPELL_CAST_REQUESTED', { spell: 'warp' });
    });
    this.spellReviveBtn?.addEventListener('click', () => {
      eventBus.emit('SPELL_CAST_REQUESTED', { spell: 'revive' });
    });

    // ----------------------------------------------------
    // 5. Pawn Promotion Selection
    // ----------------------------------------------------
    document.querySelectorAll('.promo-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const promo = target.getAttribute('data-promo') as 'q' | 'r' | 'b' | 'n';
        if (this.pendingPromotion && promo) {
          eventBus.emit('PROMOTION_RESOLVED', {
            from: this.pendingPromotion.from,
            to: this.pendingPromotion.to,
            promotion: promo
          });
          this.promotionModalBackdrop?.classList.add('hidden');
          this.pendingPromotion = null;
          cathedralAudio.playSelect();
        }
      });
    });

    // ----------------------------------------------------
    // 6. Game Over Modal Actions
    // ----------------------------------------------------
    this.rematchBtn?.addEventListener('click', () => {
      this.gameOverModalBackdrop?.classList.add('hidden');
      gameState.reset();
      this.showToast('New Match Begun');
      cathedralAudio.playSelect();
    });

    this.inspectBtn?.addEventListener('click', () => {
      this.gameOverModalBackdrop?.classList.add('hidden');
      this.showToast('Free Camera: Orbit the altar and inspect the battlefield!');
      cathedralAudio.playSelect();
    });

    this.gameOverMenuBtn?.addEventListener('click', () => {
      this.gameOverModalBackdrop?.classList.add('hidden');
      this.setPage('MENU');
      cathedralAudio.playSelect();
    });

    // ----------------------------------------------------
    // 7. Modals Open / Close Events
    // ----------------------------------------------------
    this.closeCodexBtn?.addEventListener('click', () => {
      this.codexModalBackdrop?.classList.add('hidden');
    });
    this.closePuzzlesBtn?.addEventListener('click', () => {
      this.puzzlesModalBackdrop?.classList.add('hidden');
    });
    this.closeP2PBtn?.addEventListener('click', () => {
      this.p2pModalBackdrop?.classList.add('hidden');
    });
    this.closeSettingsBtn?.addEventListener('click', () => {
      this.settingsModalBackdrop?.classList.add('hidden');
    });
    this.saveSettingsBtn?.addEventListener('click', () => {
      this.settingsModalBackdrop?.classList.add('hidden');
      this.showToast('Settings Saved');
      cathedralAudio.playSelect();
    });

    // Volume Slider
    this.settingsVolumeSlider?.addEventListener('input', () => {
      const val = parseInt(this.settingsVolumeSlider?.value || '80', 10);
      cathedralAudio.setVolume(val / 100);
    });

    // Codex Tab Navigation
    if (this.codexTabs) {
      this.codexTabs.forEach((tab) => {
        tab.addEventListener('click', () => {
          this.codexTabs?.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const targetPaneId = tab.getAttribute('data-tab');
          document.querySelectorAll('.codex-tab-pane').forEach((pane) => {
            pane.classList.remove('active');
            if (pane.id === targetPaneId) {
              pane.classList.add('active');
            }
          });
          cathedralAudio.playSelect();
        });
      });
    }

    // P2P Multiplayer Host & Join
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

    this.copyLinkBtn?.addEventListener('click', () => {
      if (this.shareLinkInput && this.shareLinkInput.value) {
        navigator.clipboard.writeText(this.shareLinkInput.value);
        this.showToast('1-Click Friend Link copied to clipboard!');
        cathedralAudio.playSelect();
      }
    });

    this.joinP2PBtn?.addEventListener('click', async () => {
      const code = this.joinInput?.value.trim();
      if (!code) return;
      this.p2pStatusBox!.textContent = `Entering chamber ${code}...`;
      try {
        await p2pNetwork.joinRoom(code);
        this.showToast(`Joined Chamber ${code}!`);
        this.p2pModalBackdrop?.classList.add('hidden');
        this.startP2PMatch(code);
      } catch (err: any) {
        this.p2pStatusBox!.textContent = 'Failed to connect: ' + err.message;
      }
    });
  }

  // ----------------------------------------------------
  // Match Startup Helpers
  // ----------------------------------------------------
  public startAIMatch(difficulty: AIDifficulty = 'ADEPT'): void {
    this.activeGameMode = 'AI';
    this.puzzleBanner?.classList.add('hidden');
    this.arcaneDock?.classList.add('hidden');
    eventBus.emit('ARCANE_MODE_TOGGLED', false);
    eventBus.emit('TIME_CONTROL_CHANGED', 'UNLIMITED');
    eventBus.emit('MODE_CHANGED', 'AI');
    eventBus.emit('AI_DIFFICULTY_CHANGED', difficulty);

    const diffTitles: Record<AIDifficulty, { name: string; title: string }> = {
      ARCHMAGE: { name: 'Archmage Voldis', title: 'Grand Inquisitor • 2000 Elo' },
      ADEPT: { name: 'Battle Adept Kaelen', title: 'Spell Knight • 1400 Elo' },
      APPRENTICE: { name: 'Apprentice Lucan', title: 'Novice Wizard • 800 Elo' }
    };

    if (this.blackPlayerName) this.blackPlayerName.textContent = diffTitles[difficulty].name;
    if (this.blackPlayerTitle) this.blackPlayerTitle.textContent = diffTitles[difficulty].title;
    if (this.activeModeText) this.activeModeText.textContent = `vs ${diffTitles[difficulty].name}`;
    if (this.activeModeIcon) this.activeModeIcon.textContent = 'psychology';

    gameState.reset();
    this.setPage('PLAY');
    this.showToast(`Duel Commenced: vs ${diffTitles[difficulty].name}`);
  }

  public startArcaneMatch(): void {
    this.activeGameMode = 'ARCANE';
    this.puzzleBanner?.classList.add('hidden');
    this.arcaneDock?.classList.remove('hidden');
    eventBus.emit('ARCANE_MODE_TOGGLED', true);
    eventBus.emit('TIME_CONTROL_CHANGED', 'UNLIMITED');
    eventBus.emit('MODE_CHANGED', 'AI');
    eventBus.emit('AI_DIFFICULTY_CHANGED', 'ADEPT');

    if (this.blackPlayerName) this.blackPlayerName.textContent = 'Sorcerer Malakor';
    if (this.blackPlayerTitle) this.blackPlayerTitle.textContent = 'Master of Arcane • 1650 Elo';
    if (this.activeModeText) this.activeModeText.textContent = 'Arcane Spells Battle';
    if (this.activeModeIcon) this.activeModeIcon.textContent = 'magic_button';

    gameState.reset();
    this.setPage('PLAY');
    this.showToast('Arcane Mana & Spells Battle Begun!');
  }

  public startSpeedMatch(timeControl: 'BLITZ' | 'RAPID'): void {
    this.activeGameMode = 'SPEED';
    this.puzzleBanner?.classList.add('hidden');
    this.arcaneDock?.classList.add('hidden');
    eventBus.emit('ARCANE_MODE_TOGGLED', false);
    eventBus.emit('TIME_CONTROL_CHANGED', timeControl);
    eventBus.emit('MODE_CHANGED', 'AI');

    const label = timeControl === 'BLITZ' ? 'Blitz Arena (3 min)' : 'Rapid Arena (10 min)';
    if (this.activeModeText) this.activeModeText.textContent = label;
    if (this.activeModeIcon) this.activeModeIcon.textContent = 'hourglass_top';

    gameState.reset();
    this.setPage('PLAY');
    this.showToast(`Speed Arena Activated: ${label}`);
  }

  public startPuzzleMatch(puzzleId: string): void {
    this.activeGameMode = 'PUZZLE';
    this.arcaneDock?.classList.add('hidden');
    this.puzzleBanner?.classList.remove('hidden');
    eventBus.emit('ARCANE_MODE_TOGGLED', false);
    eventBus.emit('TIME_CONTROL_CHANGED', 'UNLIMITED');

    puzzleManager.loadPuzzle(puzzleId);
    const puzzle = puzzleManager.getActivePuzzle();

    if (puzzle) {
      if (this.puzzleBannerTitle) this.puzzleBannerTitle.textContent = puzzle.title;
      if (this.puzzleBannerDesc) this.puzzleBannerDesc.textContent = puzzle.description;
      if (this.puzzleBannerStep) this.puzzleBannerStep.textContent = `Step 1 of ${Math.ceil(puzzle.solutionMoves.length / 2)}`;
      if (this.activeModeText) this.activeModeText.textContent = `Lore Challenge: ${puzzle.title}`;
      if (this.activeModeIcon) this.activeModeIcon.textContent = 'psychology_alt';
    }

    this.setPage('PLAY');
  }

  public startP2PMatch(roomCode: string): void {
    this.activeGameMode = 'P2P';
    this.puzzleBanner?.classList.add('hidden');
    this.arcaneDock?.classList.add('hidden');
    eventBus.emit('ARCANE_MODE_TOGGLED', false);
    eventBus.emit('TIME_CONTROL_CHANGED', 'UNLIMITED');
    eventBus.emit('MODE_CHANGED', 'PVP');

    if (this.blackPlayerName) this.blackPlayerName.textContent = 'Challenger Friend';
    if (this.blackPlayerTitle) this.blackPlayerTitle.textContent = `Chamber Code: ${roomCode}`;
    if (this.activeModeText) this.activeModeText.textContent = `P2P Duel (Room ${roomCode})`;
    if (this.activeModeIcon) this.activeModeIcon.textContent = 'handshake';

    gameState.reset();
    this.setPage('PLAY');
  }

  // ----------------------------------------------------
  // Bus Listeners & UI Reactivity
  // ----------------------------------------------------
  private initBusListeners(): void {
    // AI Thinking Status Pill
    eventBus.on('AI_THINKING_STATUS', (isThinking) => {
      if (isThinking) {
        this.aiThinkingPill?.classList.remove('hidden');
        this.blackPlayerCard?.classList.add('pulse-glow');
      } else {
        this.aiThinkingPill?.classList.add('hidden');
        this.blackPlayerCard?.classList.remove('pulse-glow');
      }
    });

    // Material Balance Updates
    eventBus.on('MATERIAL_UPDATED', ({ diff }) => {
      if (!this.whiteMaterialBadge || !this.blackMaterialBadge) return;
      if (diff > 0) {
        this.whiteMaterialBadge.textContent = `+${diff}`;
        this.whiteMaterialBadge.classList.remove('hidden');
        this.blackMaterialBadge.classList.add('hidden');
      } else if (diff < 0) {
        this.blackMaterialBadge.textContent = `+${Math.abs(diff)}`;
        this.blackMaterialBadge.classList.remove('hidden');
        this.whiteMaterialBadge.classList.add('hidden');
      } else {
        this.whiteMaterialBadge.classList.add('hidden');
        this.blackMaterialBadge.classList.add('hidden');
      }
    });

    // Puzzle State
    eventBus.on('PUZZLE_STATE_CHANGED', (state) => {
      if (!state) {
        this.puzzleBanner?.classList.add('hidden');
        return;
      }
      this.puzzleBanner?.classList.remove('hidden');
      if (this.puzzleBannerTitle) this.puzzleBannerTitle.textContent = state.puzzle.title;
      if (this.puzzleBannerDesc) this.puzzleBannerDesc.textContent = state.message;
      if (this.puzzleBannerStep) {
        this.puzzleBannerStep.textContent = `Step ${state.step} of ${state.totalSteps}`;
      }

      if (state.status === 'SOLVED') {
        this.showToast(`★★★ SOLVED! ${state.message}`, 5000);
      } else if (state.status === 'FAILED') {
        this.showToast(`⚠️ ${state.message}`, 4000);
      }
    });

    // Turn Changed
    eventBus.on('TURN_CHANGED', (payload: TurnChangedPayload) => {
      this.updateTurnUI(payload);
      if (payload.isCheckmate) {
        const winner = payload.turn === 'w' ? 'Black' : 'White';
        this.triggerGameOverModal(
          `${winner.toUpperCase()} VICTORIOUS!`,
          'Checkmate delivered upon the cathedral altar!',
          winner === 'White'
        );
      } else if (payload.isDraw || payload.isStalemate) {
        this.triggerGameOverModal(
          'STALWART TRUCE',
          'Neither army can force checkmate — Match drawn!',
          false
        );
      }
    });

    // Move Executed
    eventBus.on('MOVE_EXECUTED', (move: MoveEventPayload) => {
      this.recordMove(move);
      this.updateGraveyard();
    });

    // Pawn Promotion Request
    eventBus.on('PROMOTION_REQUESTED', ({ from, to }) => {
      this.pendingPromotion = { from, to };
      this.promotionModalBackdrop?.classList.remove('hidden');
      cathedralAudio.playSelect();
    });

    // Voice Status
    eventBus.on('VOICE_STATUS_CHANGED', ({ isListening, feedback }) => {
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

    // Time Forfeit Victory
    eventBus.on('TIME_FORFEIT', ({ winner }) => {
      this.showToast(`Time Expired! ${winner} claims victory!`);
      this.triggerGameOverModal(
        `${winner.toUpperCase()} VICTORIOUS!`,
        'Time expired upon the altar hourglass!',
        winner === 'White'
      );
    });

    // Living Piece Blunder Alert
    eventBus.on('BLUNDER_DETECTED', ({ isBlunder, square }) => {
      if (isBlunder) {
        this.showToast(`⚠️ Danger! Piece at ${square.toUpperCase()} trembles in peril!`);
      }
    });

    // Audio Mute State
    eventBus.on('AUDIO_STATE_CHANGED', (isMuted: boolean) => {
      if (this.muteIcon) {
        this.muteIcon.textContent = isMuted ? 'volume_off' : 'volume_up';
      }
    });

    // Board Loaded / Reset
    eventBus.on('BOARD_LOADED', () => {
      this.movesList = [];
      if (this.moveLog) {
        this.moveLog.innerHTML = '<div class="empty-log-hint">Awaiting opening incantation...</div>';
      }
      if (this.moveCountChip) {
        this.moveCountChip.textContent = '0 moves';
      }
      this.updateGraveyard();
      this.gameOverModalBackdrop?.classList.add('hidden');
    });
  }

  private triggerGameOverModal(title: string, subtitle: string, isWhiteWin: boolean): void {
    if (!this.gameOverModalBackdrop) return;

    if (this.gameOverTitle) this.gameOverTitle.textContent = title;
    if (this.gameOverSubtitle) this.gameOverSubtitle.textContent = subtitle;
    if (this.gameOverIcon) {
      this.gameOverIcon.textContent = isWhiteWin ? 'military_tech' : 'swords';
    }

    const totalMoves = this.movesList.length;
    const captured = gameState.getCapturedPieces();
    const totalLost = captured.w.length + captured.b.length;

    if (this.gameOverStats) {
      this.gameOverStats.textContent = `Completed in ${totalMoves} moves • ${totalLost} pieces shattered upon the battlefield`;
    }

    this.gameOverModalBackdrop.classList.remove('hidden');
    cathedralAudio.playCheckmate();
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
        row.className = 'move-row';
        row.id = `move-row-${moveNumber}`;

        const numSpan = document.createElement('span');
        numSpan.className = 'move-num';
        numSpan.textContent = `${moveNumber}.`;

        const whiteMoveSpan = document.createElement('span');
        whiteMoveSpan.className = `move-cell ${move.captured ? 'capture' : ''}`;
        whiteMoveSpan.textContent = `${PIECE_UNICODE.w[move.piece] || ''} ${move.san}`;

        row.appendChild(numSpan);
        row.appendChild(whiteMoveSpan);
        this.moveLog.appendChild(row);
      } else {
        const row = document.getElementById(`move-row-${moveNumber}`);
        if (row) {
          const blackMoveSpan = document.createElement('span');
          blackMoveSpan.className = `move-cell ${move.captured ? 'capture' : ''}`;
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
        token.className = 'grave-piece';
        token.textContent = PIECE_UNICODE.w[pieceType] || pieceType;
        this.whiteGraveyard?.appendChild(token);
      });
    }

    if (this.blackGraveyard) {
      this.blackGraveyard.innerHTML = '';
      captured.b.forEach((pieceType) => {
        const token = document.createElement('span');
        token.className = 'grave-piece';
        token.textContent = PIECE_UNICODE.b[pieceType] || pieceType;
        this.blackGraveyard?.appendChild(token);
      });
    }
  }
}

export const hudController = new HUDController();
export default hudController;
