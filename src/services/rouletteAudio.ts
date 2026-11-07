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

export const ROULETTE_SOUND_ENABLED_STORAGE_KEY = 'zt_roulette_sound_enabled_v1';
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

export type RouletteMusicTrack = 'NONE' | 'START_SHOP_GAMEOVER' | 'MAIN_GAME';

let inMemoryRouletteSoundEnabled = true;

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

function getAudioContext(): AudioContext | null {
  if (!isRouletteSoundEnabled()) return null;
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
 * 1. Card deck shuffling & rapid dealing sound played as the 48 lottery tickets cascade onto the screen from top to bottom
 */
export function playCardShuffleSound(): void {
  if (!isRouletteSoundEnabled()) return;
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
 * - Scratching sound volume is 15% higher (1.15x)
 * - Coin sound is 25% lower (0.75x)
 * - Game Over screen sounds (electric buzz + bulb explosion) and Upgrade Purchase sound (cash register) have volume 20% less (0.75 * 0.8 = 0.60x)
 */
export const SCRATCH_VOLUME_SCALE = 1.15;
export const COIN_VOLUME_SCALE = 0.75;
export const GAMEOVER_UPGRADE_VOLUME_SCALE = 0.6;
export const COIN_GAMEOVER_UPGRADE_VOLUME_SCALE = 0.75;
export const FLICKER_BUZZ_VOLUME_SCALE = 0.1;
export const GAME_BLACKOUT_VOLUME_SCALE = 0.1;

/**
 * 2. Scratching sound on swipe across lottery ticket foil and when a ticket is scratched off (volume +15%)
 */
export function playScratchSound(force: boolean = false): void {
  if (!isRouletteSoundEnabled()) return;
  const nowMs = Date.now();
  if (!force && nowMs - lastScratchSoundAt < 50) return;
  lastScratchSoundAt = nowMs;

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
 * 2b. Cash register ("Cha-ching!") sound when purchasing an upgrade in the Power Shop (volume reduced by another 20% -> 0.60x)
 */
export function playCashRegisterSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t0 = ctx.currentTime;

    // 1. Mechanical drawer latch clack ("Cha-")
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

    const clackFilter = ctx.createBiquadFilter();
    clackFilter.type = 'bandpass';
    clackFilter.frequency.setValueAtTime(850, t0);
    clackFilter.Q.setValueAtTime(1.5, t0);

    const clackGain = ctx.createGain();
    clackGain.gain.setValueAtTime(0.28 * GAMEOVER_UPGRADE_VOLUME_SCALE, t0);
    clackGain.gain.exponentialRampToValueAtTime(0.006, t0 + clackDur);

    clackSource.connect(clackFilter);
    clackFilter.connect(clackGain);
    clackGain.connect(ctx.destination);
    clackSource.start(t0);

    // 2. High-pitched metallic register bell ("-Ching!")
    const bellNotes = [
      { freq: 2093.0, harm: 4186.0, offset: 0.065, dur: 0.16 },
      { freq: 2637.02, harm: 5274.04, offset: 0.145, dur: 0.46 },
    ];

    bellNotes.forEach((n) => {
      const osc = ctx.createOscillator();
      const oscHarm = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      oscHarm.type = 'triangle';
      osc.frequency.setValueAtTime(n.freq, t0 + n.offset);
      oscHarm.frequency.setValueAtTime(n.harm, t0 + n.offset);

      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.setValueAtTime(
        0.3 * GAMEOVER_UPGRADE_VOLUME_SCALE,
        t0 + n.offset
      );
      gain.gain.exponentialRampToValueAtTime(0.0005, t0 + n.offset + n.dur);

      osc.connect(gain);
      oscHarm.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t0 + n.offset);
      oscHarm.start(t0 + n.offset);
      osc.stop(t0 + n.offset + n.dur);
      oscHarm.stop(t0 + n.offset + n.dur);
    });
  } catch {
    // Ignore audio context restriction errors
  }
}

/**
 * 3. Coin chime sound when a Beige (safe) lottery ticket is revealed (volume -25%)
 */
export function playCoinSound(): void {
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

    const osc2 = ctx.createOscillator();
    const osc2Harm = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2Harm.type = 'triangle';
    osc2.frequency.setValueAtTime(1318.51, t0 + 0.075);
    osc2Harm.frequency.setValueAtTime(2637.02, t0 + 0.075);

    gain2.gain.setValueAtTime(0.001, t0);
    gain2.gain.setValueAtTime(
      0.28 * COIN_VOLUME_SCALE,
      t0 + 0.075
    );
    gain2.gain.exponentialRampToValueAtTime(0.0006, t0 + 0.48);

    osc2.connect(gain2);
    osc2Harm.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(t0 + 0.075);
    osc2Harm.start(t0 + 0.075);
    osc2.stop(t0 + 0.48);
    osc2Harm.stop(t0 + 0.48);
  } catch {
    // Ignore audio context errors
  }
}

/**
 * 4. Electric buzzing sound played while screen fades to black on Red ticket reveal (volume reduced by another 20% -> 0.60x)
 * or at custom volume scale (e.g., 20% during screen flickering or 30% during Main Game 10s Blackout).
 */
export function playElectricBuzzSound(
  durationMs: number = 700,
  volumeScale: number = GAMEOVER_UPGRADE_VOLUME_SCALE
): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t0 = ctx.currentTime;
    const durSec = Math.max(0.2, durationMs / 1000);

    const oscSaw = ctx.createOscillator();
    const oscSquare = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const masterGain = ctx.createGain();

    oscSaw.type = 'sawtooth';
    oscSaw.frequency.setValueAtTime(100, t0);

    oscSquare.type = 'square';
    oscSquare.frequency.setValueAtTime(50, t0);

    lfo.type = 'sawtooth';
    lfo.frequency.setValueAtTime(28, t0);
    lfoGain.gain.setValueAtTime(35, t0);
    lfo.connect(lfoGain);
    lfoGain.connect(oscSaw.frequency);

    masterGain.gain.setValueAtTime(0.26 * volumeScale, t0);
    masterGain.gain.setValueAtTime(
      0.3 * volumeScale,
      t0 + durSec * 0.7
    );
    masterGain.gain.exponentialRampToValueAtTime(0.006, t0 + durSec);

    oscSaw.connect(masterGain);
    oscSquare.connect(masterGain);
    masterGain.connect(ctx.destination);

    oscSaw.start(t0);
    oscSquare.start(t0);
    lfo.start(t0);

    oscSaw.stop(t0 + durSec);
    oscSquare.stop(t0 + durSec);
    lfo.stop(t0 + durSec);
  } catch {
    // Ignore audio context errors
  }
}

/**
 * 4b. Plays the same sound as Game Over lamp breaking (bulb explosion) at 10% volume
 * during screen flickering or when returning from the 10-second Game Blackout.
 */
export function playFlickerBuzzSound(_durationMs: number = 550): void {
  playBulbExplosionSound(FLICKER_BUZZ_VOLUME_SCALE);
}

/**
 * 4c. Plays the same sound as Game Over lamp breaking (bulb explosion) at 10% volume
 * when the 10-second Main Game Screen blackout starts.
 */
export function playGameBlackoutSound(): void {
  playBulbExplosionSound(GAME_BLACKOUT_VOLUME_SCALE);
}

/**
 * 5. Sound of an exploding lightbulb played along with the 2s+ shattering lightbulb animation (volume reduced by another 20% -> 0.60x)
 */
export function playBulbExplosionSound(
  volumeScale: number = GAMEOVER_UPGRADE_VOLUME_SCALE
): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t0 = ctx.currentTime;

    // 1. Sharp vacuum pop / filament snap
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

    // 2. Extended glass shatter burst + secondary falling shard scatter over 1.8s
    const duration = 1.65;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const progress = i / bufferSize;
      const decay = Math.pow(1 - progress, 1.85);
      const shardSpike = Math.sin(i * 0.17) * Math.cos(i * 0.043) > 0.62 ? 1.9 : 0.45;
      data[i] =
        (Math.random() * 2 - 1) *
        decay *
        shardSpike *
        0.45 *
        volumeScale;
    }

    const shatterNoise = ctx.createBufferSource();
    shatterNoise.buffer = buffer;

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(2200, t0);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.36 * volumeScale, t0);
    noiseGain.gain.exponentialRampToValueAtTime(0.0012, t0 + duration);

    shatterNoise.connect(highpass);
    highpass.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    shatterNoise.start(t0);

    // 3. Crystalline glass shard chimes cascading over 1.8s
    const shardFreqs = [3150, 4280, 2760, 5120, 3690, 4620, 2980, 3910, 5400];
    shardFreqs.forEach((freq, idx) => {
      const shardOsc = ctx.createOscillator();
      const shardGain = ctx.createGain();
      const startOffset = 0.05 + idx * 0.16;
      shardOsc.type = 'sine';
      shardOsc.frequency.setValueAtTime(freq, t0 + startOffset);
      shardGain.gain.setValueAtTime(
        0.085 * volumeScale,
        t0 + startOffset
      );
      shardGain.gain.exponentialRampToValueAtTime(0.0003, t0 + startOffset + 0.18);
      shardOsc.connect(shardGain);
      shardGain.connect(ctx.destination);
      shardOsc.start(t0 + startOffset);
      shardOsc.stop(t0 + startOffset + 0.19);
    });
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
 * Synchronizes Roulette background music with the current screen, modal open state, and Sound switch:
 * - Uses smooth fade-in and fade-out (`MUSIC_FADE_DURATION_MS = 1200ms`) so music never starts or stops abruptly.
 * - Caps maximum music volume at `15%` (`ROULETTE_MUSIC_VOLUME = 0.15`).
 * - Uses dedicated `HTMLAudioElement` channels so sound effects (Web Audio API oscillators/buffers) never interrupt music.
 */
export function syncRouletteBackgroundMusic(
  screen: 'START' | 'SHOP' | 'PLAYING' | 'FADING_TO_BLACK' | 'GAME_OVER',
  isOpen: boolean,
  soundEnabled: boolean = isRouletteSoundEnabled(),
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

  const desiredTrack: RouletteMusicTrack = soundEnabled
    ? getTargetMusicTrackForScreen(screen, isOpen)
    : 'NONE';

  activeMusicTrack = desiredTrack;

  if (desiredTrack === 'START_SHOP_GAMEOVER') {
    fadeChannelToVolume(musicChannels.MAIN_GAME, 0, MUSIC_FADE_DURATION_MS);
    if (screen === 'GAME_OVER' && typeof window !== 'undefined') {
      fadeChannelToVolume(musicChannels.START_SHOP_GAMEOVER, 0, 120);
      gameOverMusicDelayTimer = window.setTimeout(() => {
        gameOverMusicDelayTimer = null;
        if (
          isRouletteModalCurrentlyOpen &&
          isRouletteSoundEnabled() &&
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
 * Ensures the currently active background music channel is playing if the browser blocked initial autoplay
 * prior to a user interaction inside the modal.
 */
export function resumeRouletteMusicIfNeeded(): void {
  if (!isRouletteModalCurrentlyOpen || !isRouletteSoundEnabled()) return;
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
 * Persists the Roulette Sound & Music On/Off switch state (`true` = enabled, `false` = muted)
 * and immediately fades background music in or out accordingly.
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

  syncRouletteBackgroundMusic(
    lastRequestedScreenState,
    isRouletteModalCurrentlyOpen,
    inMemoryRouletteSoundEnabled
  );

  return inMemoryRouletteSoundEnabled;
}

export function toggleRouletteSoundEnabled(): boolean {
  return setRouletteSoundEnabled(!isRouletteSoundEnabled());
}


