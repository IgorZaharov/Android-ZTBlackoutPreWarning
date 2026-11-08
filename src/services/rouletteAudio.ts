/**
 * Procedural Web Audio API sound synthesizer for "Житомирська Рулетка":
 * 1. Card deck shuffling / dealing sound when tickets are placed on screen from top to bottom
 * 2. Scratch sound on finger swipe over unscratched lottery ticket
 * 3. Coin chime sound on Beige lottery ticket reveal
 * 4. Electric buzzing sound while screen fades to black on Red ticket reveal
 * 5. Exploding lightbulb sound (filament pop + shattering glass) synchronized with the 2s+ Game Over animation
 */

let sharedAudioCtx: AudioContext | null = null;
let lastScratchSoundAt = 0;
let scratchSoundEndAtMs = 0;
let pendingCoinSoundTimer: ReturnType<typeof setTimeout> | null = null;

export const ROULETTE_SOUND_ENABLED_STORAGE_KEY = 'zt_roulette_sound_enabled_v1';
export const ROULETTE_MUSIC_ENABLED_STORAGE_KEY = 'zt_roulette_music_enabled_v1';
export const ROULETTE_MUSIC_VOLUME = 0.15;
export const MUSIC_FADE_DURATION_MS = 1200;
export const GAME_OVER_MUSIC_FADE_IN_DELAY_MS = 2000;
export const START_SHOP_GAMEOVER_MUSIC_URL =
  '/assets/aistudio/Audio_-_Game_Start_screen_and_Shop_a8d903bf.mp3';
export const START_SHOP_2_MUSIC_URL =
  '/assets/aistudio/Audio_-_Game_Start_screen_and_Shop_2_4fe4d993.mp3';
export const START_SHOP_MUSIC_OPTIONS = [
  START_SHOP_GAMEOVER_MUSIC_URL,
  START_SHOP_2_MUSIC_URL,
] as const;
export const MAIN_GAME_MUSIC_URL =
  '/assets/aistudio/Audio_-_Main_Game_Screen_d8782980.mp3';

export const LIGHTBULB_SFX_URL = '/assets/aistudio/lightbulb_812f6410.mp3';
export const SCRATCH_SFX_URL = '/assets/aistudio/scratch_1cd603a1.mp3';
export const CASH_REGISTER_SFX_URL = '/assets/aistudio/cash_register_d07e4cb5.mp3';
export const FLICKER_SFX_URL = '/assets/aistudio/flicker_b50e736a.mp3';
export const COIN_SFX_URL = '/assets/aistudio/coin_593cd810.mp3';
export const TWO_X_COIN_SFX_URL = '/assets/aistudio/2Xcoin_78ae3de4.mp3';
export const SHUFFLE_SFX_URL = '/assets/aistudio/shuffle_3d7b5646.mp3';

export const ROULETTE_SFX_URLS = {
  lightbulb: LIGHTBULB_SFX_URL,
  scratch: SCRATCH_SFX_URL,
  cashRegister: CASH_REGISTER_SFX_URL,
  flicker: FLICKER_SFX_URL,
  coin: COIN_SFX_URL,
  twoXCoin: TWO_X_COIN_SFX_URL,
  shuffle: SHUFFLE_SFX_URL,
} as const;

export type RouletteMusicTrack = 'NONE' | 'START_SHOP_GAMEOVER' | 'MAIN_GAME';

let inMemoryRouletteSoundEnabled = true;
let inMemoryRouletteMusicEnabled = true;
let inMemoryAppInForeground = true;
let visibilityListenersBound = false;

const sfxAudioPools: Record<string, HTMLAudioElement[]> = {};
let activeScratchAudio: HTMLAudioElement | null = null;

function playSfxMp3(
  url: string,
  volume: number = 0.75,
  options?: { reuseSingleInstance?: boolean; restartIfPlaying?: boolean }
): boolean {
  if (!isRouletteSoundEnabled() || !isRouletteAppInForeground()) return false;
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return false;

  try {
    const clampedVol = Math.max(0, Math.min(1, volume));
    if (options?.reuseSingleInstance) {
      if (!activeScratchAudio) {
        activeScratchAudio = new Audio(url);
        activeScratchAudio.preload = 'auto';
      }
      activeScratchAudio.volume = clampedVol;
      if (
        activeScratchAudio.paused ||
        activeScratchAudio.ended ||
        activeScratchAudio.currentTime >= 0.24 ||
        options.restartIfPlaying
      ) {
        activeScratchAudio.currentTime = 0;
        const p = activeScratchAudio.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      }
      return true;
    }

    let pool = sfxAudioPools[url];
    if (!pool) {
      pool = [];
      sfxAudioPools[url] = pool;
    }
    let el = pool.find((item) => item.paused || item.ended);
    if (!el) {
      if (pool.length < 6) {
        el = new Audio(url);
        el.preload = 'auto';
        pool.push(el);
      } else {
        el = pool[0];
      }
    }
    el.volume = clampedVol;
    try {
      el.currentTime = 0;
    } catch {
      // Ignore seek error before metadata loaded
    }
    const playPromise = el.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

export function isRouletteAppInForeground(): boolean {
  if (typeof document !== 'undefined' && typeof document.visibilityState === 'string') {
    if (document.visibilityState === 'hidden') {
      return false;
    }
  }
  return inMemoryAppInForeground;
}

export function isRouletteSoundEnabled(): boolean {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(ROULETTE_SOUND_ENABLED_STORAGE_KEY);
      if (raw === 'false') {
        inMemoryRouletteSoundEnabled = false;
      } else if (raw === 'true') {
        inMemoryRouletteSoundEnabled = true;
      }
    }
  } catch {
    // Ignore storage errors
  }
  return inMemoryRouletteSoundEnabled;
}

export function isRouletteMusicEnabled(): boolean {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(ROULETTE_MUSIC_ENABLED_STORAGE_KEY);
      if (raw === 'false') {
        inMemoryRouletteMusicEnabled = false;
      } else if (raw === 'true') {
        inMemoryRouletteMusicEnabled = true;
      }
    }
  } catch {
    // Ignore storage errors
  }
  return inMemoryRouletteMusicEnabled;
}

function getAudioContext(): AudioContext | null {
  if (!isRouletteSoundEnabled() || !isRouletteAppInForeground()) return null;
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/**
 * 1. Card deck shuffling sound (shuffle.mp3) played on Main Game screen loading,
 * on Refresh card button pressed, and on forced re-shuffle when score reaches above 999.
 */
export function playCardShuffleSound(): void {
  if (!isRouletteSoundEnabled() || !isRouletteAppInForeground()) return;
  if (playSfxMp3(SHUFFLE_SFX_URL, COIN_VOLUME_SCALE)) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t0 = ctx.currentTime;
    const cardSnapCount = 14;

    for (let k = 0; k < cardSnapCount; k++) {
      const startTime = t0 + k * 0.036;
      const snapDuration = 0.028;
      const bufferSize = Math.floor(ctx.sampleRate * snapDuration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        const progress = i / bufferSize;
        const env = Math.sin(progress * Math.PI) * Math.pow(1 - progress, 1.3);
        data[i] = (Math.random() * 2 - 1) * env * 0.42;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400 + (k % 5) * 240, startTime);
      filter.Q.setValueAtTime(1.8, startTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.22, startTime);
      gain.gain.exponentialRampToValueAtTime(0.008, startTime + snapDuration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(startTime);
    }
  } catch {
    // Ignore audio context restriction errors
  }
}

/**
 * Volume multipliers:
 * - Scratching sound volume is 50% lower from existing 1.15x value (1.15 * 0.5 = 0.575x)
 * - Coin sound is 25% lower (0.75x)
 * - Game Over screen sounds (electric buzz + bulb explosion) and Upgrade Purchase sound (cash register) have volume 20% less (0.75 * 0.8 = 0.60x)
 */
export const SCRATCH_VOLUME_SCALE = 0.575;
export const SCRATCH_SFX_VOLUME_MULTIPLIER = 0.9;
export const SCRATCH_SFX_DURATION_MS = 336;
export const COIN_VOLUME_SCALE = 0.75;
export const GAMEOVER_UPGRADE_VOLUME_SCALE = 0.6;
export const COIN_GAMEOVER_UPGRADE_VOLUME_SCALE = 0.75;
export const FLICKER_BUZZ_VOLUME_SCALE = 0.1;
export const GAME_BLACKOUT_VOLUME_SCALE = 0.1;
export const FLICKER_SFX_VOLUME_MULTIPLIER = 1.3;

export function getRemainingScratchSoundDelayMs(nowMs: number = Date.now()): number {
  if (
    activeScratchAudio &&
    !activeScratchAudio.paused &&
    !activeScratchAudio.ended &&
    Number.isFinite(activeScratchAudio.duration) &&
    activeScratchAudio.duration > 0
  ) {
    return Math.max(
      0,
      Math.round((activeScratchAudio.duration - activeScratchAudio.currentTime) * 1000)
    );
  }
  return Math.max(0, scratchSoundEndAtMs - nowMs);
}

/**
 * 2. Scratching sound (scratch.mp3, trimmed to first 30% and 10% volume down) on swipe across lottery ticket foil and when a ticket is scratched off
 */
export function playScratchSound(force: boolean = false): void {
  if (!isRouletteSoundEnabled() || !isRouletteAppInForeground()) return;
  const nowMs = Date.now();
  if (!force && nowMs - lastScratchSoundAt < 120) return;
  lastScratchSoundAt = nowMs;
  scratchSoundEndAtMs = nowMs + SCRATCH_SFX_DURATION_MS;

  if (
    playSfxMp3(SCRATCH_SFX_URL, SCRATCH_VOLUME_SCALE * SCRATCH_SFX_VOLUME_MULTIPLIER, {
      reuseSingleInstance: true,
      restartIfPlaying: force,
    })
  ) {
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const duration = force ? 0.085 : 0.045;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.sin((i / bufferSize) * Math.PI);
      data[i] =
        (Math.random() * 2 - 1) *
        env *
        (force ? 0.42 : 0.35) *
        SCRATCH_VOLUME_SCALE;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1900 + Math.random() * 600, ctx.currentTime);
    filter.Q.setValueAtTime(2.2, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(
      (force ? 0.24 : 0.18) * SCRATCH_VOLUME_SCALE,
      ctx.currentTime
    );
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start();
  } catch {
    // Ignore audio context restriction errors
  }
}

/**
 * 2b. Cash register (cash_register.mp3) sound when purchasing an upgrade in the Power Shop (volume 0.60x)
 */
export function playCashRegisterSound(): void {
  if (!isRouletteSoundEnabled() || !isRouletteAppInForeground()) return;
  if (playSfxMp3(CASH_REGISTER_SFX_URL, GAMEOVER_UPGRADE_VOLUME_SCALE)) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t0 = ctx.currentTime;
    const clackDur = 0.065;
    const clackSamples = Math.floor(ctx.sampleRate * clackDur);
    const clackBuf = ctx.createBuffer(1, clackSamples, ctx.sampleRate);
    const clackData = clackBuf.getChannelData(0);
    for (let i = 0; i < clackSamples; i++) {
      const p = i / clackSamples;
      clackData[i] =
        (Math.random() * 2 - 1) *
        Math.pow(1 - p, 1.6) *
        0.45 *
        GAMEOVER_UPGRADE_VOLUME_SCALE;
    }
    const clackSource = ctx.createBufferSource();
    clackSource.buffer = clackBuf;
    const clackGain = ctx.createGain();
    clackGain.gain.setValueAtTime(0.28 * GAMEOVER_UPGRADE_VOLUME_SCALE, t0);
    clackGain.gain.exponentialRampToValueAtTime(0.006, t0 + clackDur);
    clackSource.connect(clackGain);
    clackGain.connect(ctx.destination);
    clackSource.start(t0);
  } catch {
    // Ignore audio context restriction errors
  }
}

function triggerCoinSoundNow(): void {
  if (!isRouletteSoundEnabled() || !isRouletteAppInForeground()) return;
  if (playSfxMp3(COIN_SFX_URL, COIN_VOLUME_SCALE)) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t0 = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(987.77, t0);
    gain1.gain.setValueAtTime(0.24 * COIN_VOLUME_SCALE, t0);
    gain1.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.14);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t0);
    osc1.stop(t0 + 0.14);
  } catch {
    // Ignore audio context errors
  }
}

/**
 * 3. Coin sound (coin.mp3) when a standard safe lottery ticket is revealed (volume 0.75x).
 * Waits for scratch.mp3 to finish playing before playing coin.mp3.
 */
export function playCoinSound(): void {
  if (!isRouletteSoundEnabled() || !isRouletteAppInForeground()) return;
  const waitMs = getRemainingScratchSoundDelayMs();
  if (activeScratchAudio && !activeScratchAudio.paused && !activeScratchAudio.ended) {
    let triggered = false;
    const fireOnce = () => {
      if (triggered) return;
      triggered = true;
      activeScratchAudio?.removeEventListener('ended', fireOnce);
      triggerCoinSoundNow();
    };
    activeScratchAudio.addEventListener('ended', fireOnce, { once: true });
    setTimeout(fireOnce, Math.max(20, waitMs || SCRATCH_SFX_DURATION_MS));
    return;
  }
  if (waitMs > 0) {
    if (pendingCoinSoundTimer) {
      clearTimeout(pendingCoinSoundTimer);
    }
    pendingCoinSoundTimer = setTimeout(() => {
      pendingCoinSoundTimer = null;
      triggerCoinSoundNow();
    }, waitMs);
    return;
  }
  triggerCoinSoundNow();
}

/**
 * 3b. 2X Coin sound (2Xcoin.mp3) when scratching an X2 or Gold lottery ticket (volume 0.75x)
 */
export function play2XCoinSound(): void {
  if (!isRouletteSoundEnabled() || !isRouletteAppInForeground()) return;
  if (playSfxMp3(TWO_X_COIN_SFX_URL, COIN_VOLUME_SCALE)) return;
  playCoinSound();
}

/**
 * 4. Electric buzzing / flicker sound (flicker.mp3) played while screen fades to black or flickers
 */
export function playElectricBuzzSound(
  durationMs: number = 700,
  volumeScale: number = GAMEOVER_UPGRADE_VOLUME_SCALE
): void {
  if (!isRouletteSoundEnabled() || !isRouletteAppInForeground()) return;
  if (playSfxMp3(FLICKER_SFX_URL, Math.min(1, volumeScale * FLICKER_SFX_VOLUME_MULTIPLIER))) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t0 = ctx.currentTime;
    const durSec = Math.max(0.2, durationMs / 1000);
    const oscSaw = ctx.createOscillator();
    const masterGain = ctx.createGain();
    oscSaw.type = 'sawtooth';
    oscSaw.frequency.setValueAtTime(100, t0);
    masterGain.gain.setValueAtTime(0.26 * volumeScale, t0);
    masterGain.gain.exponentialRampToValueAtTime(0.006, t0 + durSec);
    oscSaw.connect(masterGain);
    masterGain.connect(ctx.destination);
    oscSaw.start(t0);
    oscSaw.stop(t0 + durSec);
  } catch {
    // Ignore audio context errors
  }
}

/**
 * 4b. Plays flicker.mp3 (30% louder) during flickering lights (with fallback to playBulbExplosionSound(FLICKER_BUZZ_VOLUME_SCALE)).
 */
export function playFlickerBuzzSound(_durationMs: number = 550): void {
  if (!isRouletteSoundEnabled() || !isRouletteAppInForeground()) return;
  if (playSfxMp3(FLICKER_SFX_URL, FLICKER_BUZZ_VOLUME_SCALE * FLICKER_SFX_VOLUME_MULTIPLIER)) return;
  playBulbExplosionSound(FLICKER_BUZZ_VOLUME_SCALE);
}

/**
 * 4c. Plays flicker.mp3 (30% louder) on Game blackout (with fallback to playBulbExplosionSound(GAME_BLACKOUT_VOLUME_SCALE)).
 */
export function playGameBlackoutSound(): void {
  if (!isRouletteSoundEnabled() || !isRouletteAppInForeground()) return;
  if (playSfxMp3(FLICKER_SFX_URL, GAME_BLACKOUT_VOLUME_SCALE * FLICKER_SFX_VOLUME_MULTIPLIER)) return;
  playBulbExplosionSound(GAME_BLACKOUT_VOLUME_SCALE);
}

/**
 * 5. Sound of an exploding lightbulb (lightbulb.mp3) played on Game Over lightbulb explode (volume 0.60x)
 */
export function playBulbExplosionSound(
  volumeScale: number = GAMEOVER_UPGRADE_VOLUME_SCALE
): void {
  if (!isRouletteSoundEnabled() || !isRouletteAppInForeground()) return;
  if (playSfxMp3(LIGHTBULB_SFX_URL, volumeScale)) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t0 = ctx.currentTime;
    const popOsc = ctx.createOscillator();
    const popGain = ctx.createGain();
    popOsc.type = 'triangle';
    popOsc.frequency.setValueAtTime(320, t0);
    popOsc.frequency.exponentialRampToValueAtTime(38, t0 + 0.18);
    popGain.gain.setValueAtTime(0.42 * volumeScale, t0);
    popGain.gain.exponentialRampToValueAtTime(0.0006, t0 + 0.19);
    popOsc.connect(popGain);
    popGain.connect(ctx.destination);
    popOsc.start(t0);
    popOsc.stop(t0 + 0.19);
  } catch {
    // Ignore audio context errors
  }
}

interface ManagedMusicChannel {
  trackId: Exclude<RouletteMusicTrack, 'NONE'>;
  url: string;
  audio: HTMLAudioElement | null;
  audioByUrl: Record<string, HTMLAudioElement>;
  currentVolume: number;
  targetVolume: number;
  fadeTimer: number | null;
}

const musicChannels: Record<Exclude<RouletteMusicTrack, 'NONE'>, ManagedMusicChannel> = {
  START_SHOP_GAMEOVER: {
    trackId: 'START_SHOP_GAMEOVER',
    url: START_SHOP_GAMEOVER_MUSIC_URL,
    audio: null,
    audioByUrl: {},
    currentVolume: 0,
    targetVolume: 0,
    fadeTimer: null,
  },
  MAIN_GAME: {
    trackId: 'MAIN_GAME',
    url: MAIN_GAME_MUSIC_URL,
    audio: null,
    audioByUrl: {},
    currentVolume: 0,
    targetVolume: 0,
    fadeTimer: null,
  },
};

let activeMusicTrack: RouletteMusicTrack = 'NONE';
let lastRequestedScreenState: 'START' | 'SHOP' | 'PLAYING' | 'FADING_TO_BLACK' | 'GAME_OVER' =
  'START';
let isRouletteModalCurrentlyOpen = false;
let gameOverMusicDelayTimer: number | null = null;
let currentStartShopMusicUrl: string = START_SHOP_GAMEOVER_MUSIC_URL;

/**
 * Randomly selects one of the two Game Start Screen & Upgrade Shop music tracks:
 * 1) "Audio - Game Start screen and Shop.mp3"
 * 2) "Audio - Game Start screen and Shop 2.mp3"
 */
export function pickRandomStartShopMusicUrl(
  randomFn: () => number = Math.random
): string {
  return randomFn() < 0.5 ? START_SHOP_GAMEOVER_MUSIC_URL : START_SHOP_2_MUSIC_URL;
}

function setChannelUrl(channel: ManagedMusicChannel, nextUrl: string): void {
  if (channel.url === nextUrl) return;
  if (channel.audio && typeof window !== 'undefined') {
    try {
      channel.audio.pause();
      channel.audio.currentTime = 0;
    } catch {
      // Ignore pause errors
    }
  }
  channel.url = nextUrl;
  channel.audio = channel.audioByUrl[nextUrl] ?? null;
  channel.currentVolume = 0;
}

export function randomizeStartShopMusicTrack(
  randomFn: () => number = Math.random
): string {
  currentStartShopMusicUrl = pickRandomStartShopMusicUrl(randomFn);
  setChannelUrl(musicChannels.START_SHOP_GAMEOVER, currentStartShopMusicUrl);
  return currentStartShopMusicUrl;
}

export function getCurrentStartShopMusicUrl(): string {
  return currentStartShopMusicUrl;
}

/**
 * Maps a Roulette screen state to its background music track:
 * - Game Start screen ('START'), Upgrade Shop screen ('SHOP'), and Game Over screen ('GAME_OVER')
 *   -> 'START_SHOP_GAMEOVER' (randomized on Game Start screen between Option 1 and Option 2)
 * - Main Game screen ('PLAYING', 'FADING_TO_BLACK')
 *   -> 'MAIN_GAME' ("Audio - Main Game Screen.mp3")
 */
export function getTargetMusicTrackForScreen(
  screen: 'START' | 'SHOP' | 'PLAYING' | 'FADING_TO_BLACK' | 'GAME_OVER',
  isOpen: boolean = true
): RouletteMusicTrack {
  if (!isOpen) return 'NONE';
  if (screen === 'PLAYING' || screen === 'FADING_TO_BLACK') {
    return 'MAIN_GAME';
  }
  return 'START_SHOP_GAMEOVER';
}

function getOrCreateAudioElement(channel: ManagedMusicChannel): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') {
    return null;
  }
  const existingForUrl = channel.audioByUrl[channel.url];
  if (existingForUrl) {
    channel.audio = existingForUrl;
    return existingForUrl;
  }
  if (!channel.audio) {
    try {
      const el = new Audio(channel.url);
      el.loop = true;
      el.preload = 'auto';
      el.volume = 0;
      channel.audio = el;
      channel.audioByUrl[channel.url] = el;
    } catch {
      return null;
    }
  }
  return channel.audio;
}

function fadeChannelToVolume(
  channel: ManagedMusicChannel,
  targetVol: number,
  durationMs: number = MUSIC_FADE_DURATION_MS
): void {
  const clampedTarget = Math.max(0, Math.min(ROULETTE_MUSIC_VOLUME, targetVol));
  channel.targetVolume = clampedTarget;

  if (typeof window === 'undefined') {
    channel.currentVolume = clampedTarget;
    return;
  }

  if (channel.fadeTimer !== null) {
    window.clearInterval(channel.fadeTimer);
    channel.fadeTimer = null;
  }

  const audio = getOrCreateAudioElement(channel);
  if (!audio) {
    channel.currentVolume = clampedTarget;
    return;
  }

  // If fading in and currently paused, start playback at current volume (0 if starting fresh)
  if (clampedTarget > 0 && audio.paused) {
    try {
      audio.volume = Math.max(0, Math.min(1, channel.currentVolume));
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // Autoplay blocked until next user gesture; resumeRouletteMusicIfNeeded will retry
        });
      }
    } catch {
      // Ignore playback errors in headless environments
    }
  }

  const stepIntervalMs = 40;
  const totalSteps = Math.max(1, Math.round(durationMs / stepIntervalMs));
  const startVolume = channel.currentVolume;
  const volumeDelta = clampedTarget - startVolume;

  if (Math.abs(volumeDelta) < 0.002) {
    channel.currentVolume = clampedTarget;
    try {
      audio.volume = clampedTarget;
      if (clampedTarget <= 0.0005 && !audio.paused) {
        audio.pause();
      }
    } catch {
      // Ignore audio element errors
    }
    return;
  }

  let stepCount = 0;
  channel.fadeTimer = window.setInterval(() => {
    stepCount += 1;
    const progress = Math.min(1, stepCount / totalSteps);
    const nextVolume = Math.max(
      0,
      Math.min(ROULETTE_MUSIC_VOLUME, startVolume + volumeDelta * progress)
    );
    channel.currentVolume = nextVolume;

    try {
      audio.volume = nextVolume;
    } catch {
      // Ignore audio element volume assignment errors
    }

    if (progress >= 1) {
      if (channel.fadeTimer !== null) {
        window.clearInterval(channel.fadeTimer);
        channel.fadeTimer = null;
      }
      channel.currentVolume = clampedTarget;
      try {
        audio.volume = clampedTarget;
        if (clampedTarget <= 0.0005 && !audio.paused) {
          audio.pause();
        }
      } catch {
        // Ignore pause errors
      }
    }
  }, stepIntervalMs);
}

/**
 * Synchronizes Roulette background music with the current screen, modal open state, and Music switch:
 * - Uses smooth fade-in and fade-out (`MUSIC_FADE_DURATION_MS = 1200ms`) so music never starts or stops abruptly.
 * - Caps maximum music volume at `15%` (`ROULETTE_MUSIC_VOLUME = 0.15`).
 * - Uses dedicated `HTMLAudioElement` channels so sound effects (Web Audio API oscillators/buffers) never interrupt music.
 */
export function syncRouletteBackgroundMusic(
  screen: 'START' | 'SHOP' | 'PLAYING' | 'FADING_TO_BLACK' | 'GAME_OVER',
  isOpen: boolean,
  musicEnabled: boolean = isRouletteMusicEnabled(),
  randomFn: () => number = Math.random
): RouletteMusicTrack {
  const prevScreen = lastRequestedScreenState;
  const prevOpen = isRouletteModalCurrentlyOpen;
  lastRequestedScreenState = screen;
  isRouletteModalCurrentlyOpen = isOpen;

  if (typeof window !== 'undefined' && gameOverMusicDelayTimer !== null) {
    window.clearTimeout(gameOverMusicDelayTimer);
    gameOverMusicDelayTimer = null;
  }

  // Randomize between the two Game Start Screen & Upgrade Shop tracks whenever entering the Game Start Screen
  // (on initial open or returning from Main Game / Game Over), while preserving the chosen track between START and SHOP
  if (
    isOpen &&
    screen === 'START' &&
    (!prevOpen || (prevScreen !== 'START' && prevScreen !== 'SHOP'))
  ) {
    randomizeStartShopMusicTrack(randomFn);
  } else if (isOpen && (screen === 'START' || screen === 'SHOP')) {
    setChannelUrl(musicChannels.START_SHOP_GAMEOVER, currentStartShopMusicUrl);
  }

  const desiredTrack: RouletteMusicTrack =
    musicEnabled && isRouletteAppInForeground()
      ? getTargetMusicTrackForScreen(screen, isOpen)
      : 'NONE';

  activeMusicTrack = desiredTrack;

  if (!isRouletteAppInForeground()) {
    [musicChannels.START_SHOP_GAMEOVER, musicChannels.MAIN_GAME].forEach((channel) => {
      if (typeof window !== 'undefined' && channel.fadeTimer !== null) {
        window.clearInterval(channel.fadeTimer);
        channel.fadeTimer = null;
      }
      channel.targetVolume = 0;
      channel.currentVolume = 0;
      Object.values(channel.audioByUrl).forEach((el) => {
        try {
          el.volume = 0;
          if (!el.paused) {
            el.pause();
          }
        } catch {
          // Ignore pause errors
        }
      });
      if (channel.audio) {
        try {
          channel.audio.volume = 0;
          if (!channel.audio.paused) {
            channel.audio.pause();
          }
        } catch {
          // Ignore pause errors
        }
      }
    });
    return activeMusicTrack;
  }

  if (desiredTrack === 'START_SHOP_GAMEOVER') {
    fadeChannelToVolume(musicChannels.MAIN_GAME, 0, MUSIC_FADE_DURATION_MS);
    if (screen === 'GAME_OVER' && typeof window !== 'undefined') {
      fadeChannelToVolume(musicChannels.START_SHOP_GAMEOVER, 0, 120);
      gameOverMusicDelayTimer = window.setTimeout(() => {
        gameOverMusicDelayTimer = null;
        if (
          isRouletteModalCurrentlyOpen &&
          isRouletteMusicEnabled() &&
          isRouletteAppInForeground() &&
          lastRequestedScreenState === 'GAME_OVER'
        ) {
          fadeChannelToVolume(
            musicChannels.START_SHOP_GAMEOVER,
            ROULETTE_MUSIC_VOLUME,
            MUSIC_FADE_DURATION_MS
          );
        }
      }, GAME_OVER_MUSIC_FADE_IN_DELAY_MS);
    } else {
      fadeChannelToVolume(
        musicChannels.START_SHOP_GAMEOVER,
        ROULETTE_MUSIC_VOLUME,
        MUSIC_FADE_DURATION_MS
      );
    }
  } else if (desiredTrack === 'MAIN_GAME') {
    fadeChannelToVolume(musicChannels.START_SHOP_GAMEOVER, 0, MUSIC_FADE_DURATION_MS);
    fadeChannelToVolume(
      musicChannels.MAIN_GAME,
      ROULETTE_MUSIC_VOLUME,
      MUSIC_FADE_DURATION_MS
    );
  } else {
    fadeChannelToVolume(musicChannels.START_SHOP_GAMEOVER, 0, MUSIC_FADE_DURATION_MS);
    fadeChannelToVolume(musicChannels.MAIN_GAME, 0, MUSIC_FADE_DURATION_MS);
  }

  return activeMusicTrack;
}

/**
 * Mutes all music and sound effects immediately when the Application is minimized / sent to background,
 * and restores background music (if enabled and open) when the Application returns to foreground.
 */
export function setRouletteAppInForeground(inForeground: boolean): boolean {
  inMemoryAppInForeground = Boolean(inForeground);
  if (!inMemoryAppInForeground && sharedAudioCtx && sharedAudioCtx.state === 'running') {
    try {
      sharedAudioCtx.suspend();
    } catch {
      // Ignore suspend errors
    }
  }
  syncRouletteBackgroundMusic(
    lastRequestedScreenState,
    isRouletteModalCurrentlyOpen,
    isRouletteMusicEnabled()
  );
  return inMemoryAppInForeground;
}

if (typeof document !== 'undefined' && !visibilityListenersBound) {
  visibilityListenersBound = true;
  document.addEventListener('visibilitychange', () => {
    setRouletteAppInForeground(document.visibilityState !== 'hidden');
  });
}

/**
 * Ensures the currently active background music channel is playing if the browser blocked initial autoplay
 * prior to a user interaction inside the modal.
 */
export function resumeRouletteMusicIfNeeded(): void {
  if (!isRouletteModalCurrentlyOpen || !isRouletteMusicEnabled() || !isRouletteAppInForeground()) return;
  if (activeMusicTrack === 'NONE') return;
  const channel = musicChannels[activeMusicTrack];
  const audio = getOrCreateAudioElement(channel);
  if (audio && audio.paused && channel.targetVolume > 0) {
    try {
      audio.volume = Math.max(0, Math.min(ROULETTE_MUSIC_VOLUME, channel.currentVolume));
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // Ignore autoplay restriction errors
        });
      }
    } catch {
      // Ignore playback errors
    }
  }
}

export function getActiveRouletteMusicTrack(): RouletteMusicTrack {
  return activeMusicTrack;
}

/**
 * Persists the Roulette Sound On/Off switch state (`true` = enabled, `false` = muted).
 */
export function setRouletteSoundEnabled(enabled: boolean): boolean {
  inMemoryRouletteSoundEnabled = Boolean(enabled);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        ROULETTE_SOUND_ENABLED_STORAGE_KEY,
        inMemoryRouletteSoundEnabled ? 'true' : 'false'
      );
    }
  } catch {
    // Ignore storage write errors
  }

  if (!inMemoryRouletteSoundEnabled && sharedAudioCtx && sharedAudioCtx.state === 'running') {
    try {
      sharedAudioCtx.suspend();
    } catch {
      // Ignore suspend errors
    }
  }

  return inMemoryRouletteSoundEnabled;
}

export function toggleRouletteSoundEnabled(): boolean {
  return setRouletteSoundEnabled(!isRouletteSoundEnabled());
}

/**
 * Persists the Roulette Music On/Off switch state (`true` = enabled, `false` = muted)
 * and immediately fades background music in or out accordingly.
 */
export function setRouletteMusicEnabled(enabled: boolean): boolean {
  inMemoryRouletteMusicEnabled = Boolean(enabled);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        ROULETTE_MUSIC_ENABLED_STORAGE_KEY,
        inMemoryRouletteMusicEnabled ? 'true' : 'false'
      );
    }
  } catch {
    // Ignore storage write errors
  }

  syncRouletteBackgroundMusic(
    lastRequestedScreenState,
    isRouletteModalCurrentlyOpen,
    inMemoryRouletteMusicEnabled
  );

  return inMemoryRouletteMusicEnabled;
}

export function toggleRouletteMusicEnabled(): boolean {
  return setRouletteMusicEnabled(!isRouletteMusicEnabled());
}



