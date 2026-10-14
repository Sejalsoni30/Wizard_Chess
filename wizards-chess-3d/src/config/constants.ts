import * as THREE from 'three';

export const SQUARE_SIZE = 2.0;
export const BOARD_SQUARES = 8;
export const BOARD_SIZE = SQUARE_SIZE * BOARD_SQUARES; // 16.0
export const BOARD_TOP_Y = 0.5;
export const PIECE_HOVER_Y = 0.52;

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

export type FileSymbol = typeof FILES[number];
export type RankSymbol = typeof RANKS[number];
export type ChessSquare = `${FileSymbol}${RankSymbol}`;

export interface CameraPreset {
  name: string;
  position: THREE.Vector3;
  target: THREE.Vector3;
}

export const CAMERA_PRESETS: Record<'ORBIT' | 'WHITE_POV' | 'BLACK_POV' | 'TOP_DOWN', CameraPreset> = {
  ORBIT: {
    name: 'Orbit',
    position: new THREE.Vector3(0, 16, 18),
    target: new THREE.Vector3(0, BOARD_TOP_Y, 0)
  },
  WHITE_POV: {
    name: 'White POV',
    position: new THREE.Vector3(0, 12, 15),
    target: new THREE.Vector3(0, BOARD_TOP_Y, -1.5)
  },
  BLACK_POV: {
    name: 'Black POV',
    position: new THREE.Vector3(0, 12, -15),
    target: new THREE.Vector3(0, BOARD_TOP_Y, 1.5)
  },
  TOP_DOWN: {
    name: 'Top Down',
    position: new THREE.Vector3(0, 24, 0.01),
    target: new THREE.Vector3(0, BOARD_TOP_Y, 0)
  }
};

export const COLOR_PALETTE = {
  // Cathedral Environment
  fog: 0x07080e,
  moonlight: 0xa8c0ff,
  brazierFire: 0xff6a13,
  brazierInner: 0xffe27a,
  stoneAltar: 0x1b1c22,
  pillarStone: 0x22242c,
  
  // Board Tiles
  whiteTile: 0xd9d5cd,
  blackTile: 0x191a20,
  boardBorder: 0x0f1015,
  runeGold: 0xdfb15b,

  // Pieces
  marbleWhite: 0xf5f3ee,
  marbleVeins: 0x9c9993,
  marbleGlow: 0x38bdf8, // Arcane Cyan
  
  obsidianBlack: 0x121115,
  obsidianVeins: 0x35283f,
  obsidianGlow: 0xa855f7, // Arcane Purple

  // UI / Indicator Runes
  selected: 0xf59e0b,
  legalMove: 0x10b981,
  legalCapture: 0xef4444,
  hoverSquare: 0x60a5fa,
  checkAlert: 0xdc2626
};

export const PHYSICS_CONFIG = {
  gravity: -18.0, // m/s^2 as specified
  shardCount: 30, // 30 polyhedral shards per shatter
  floorDamping: 0.42,
  friction: 0.92,
  dissolveDuration: 4.0, // 4 seconds shard dissolve
  shockwaveMaxRadius: 3.5,
  shockwaveDuration: 0.8
};

export const ANIMATION_CONFIG = {
  idleBreathAmp: 0.08,
  idleBreathSpeed: 2.4,
  runeRotationSpeed: 1.0,
  moveGlideDuration: 0.75,
  attackGlideDuration: 0.55,
  windupDuration: 0.35,
  lungeDuration: 0.22,
  recoilDuration: 0.3
};

/**
 * Converts algebraic chess square string (e.g. 'e4') to 3D world coordinates.
 */
export function squareToWorld(square: string): THREE.Vector3 {
  const file = square.charAt(0).toLowerCase();
  const rank = square.charAt(1);

  const fileIdx = FILES.indexOf(file as FileSymbol);
  const rankIdx = RANKS.indexOf(rank as RankSymbol);

  if (fileIdx === -1 || rankIdx === -1) {
    return new THREE.Vector3(0, BOARD_TOP_Y, 0);
  }

  const x = (fileIdx - 3.5) * SQUARE_SIZE;
  // rank '1' is at +z, rank '8' is at -z
  const z = (3.5 - rankIdx) * SQUARE_SIZE;

  return new THREE.Vector3(x, BOARD_TOP_Y, z);
}

/**
 * Converts 3D world coordinates (x, z) to algebraic chess square string (e.g. 'e4').
 */
export function worldToSquare(x: number, z: number): string | null {
  const halfBoard = BOARD_SIZE / 2;
  if (x < -halfBoard || x > halfBoard || z < -halfBoard || z > halfBoard) {
    return null;
  }

  const fileIdx = Math.floor((x + halfBoard) / SQUARE_SIZE);
  const rankIdx = 7 - Math.floor((z + halfBoard) / SQUARE_SIZE);

  if (fileIdx < 0 || fileIdx > 7 || rankIdx < 0 || rankIdx > 7) {
    return null;
  }

  return `${FILES[fileIdx]}${RANKS[rankIdx]}`;
}
