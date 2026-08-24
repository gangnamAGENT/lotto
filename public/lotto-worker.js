import { rankFromMatches } from './lotto-engine.js';

let running = false;
let paused = false;
let speed = 'normal';
let runId = '';
let generation = 0;
let timer = 0;
let weeks = 0;
let ranks = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
let selectedFlags = new Uint8Array(46);
let usedAt = new Uint32Array(46);
let drawMark = 0;
let random = Math.random;
let lastPostedAt = 0;

function makeRandom(seed) {
  let state = seed >>> 0;
  if (state === 0) state = 0x6d2b79f5;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function nextUniqueNumber() {
  let number = 0;
  do {
    number = Math.floor(random() * 45) + 1;
  } while (usedAt[number] === drawMark);
  usedAt[number] = drawMark;
  return number;
}

function postProgress(numbers, bonus, recentRank, force = false) {
  const now = performance.now();
  if (!force && speed === 'turbo' && now - lastPostedAt < 80) return;
  lastPostedAt = now;
  self.postMessage({
    type: 'progress',
    runId,
    weeks,
    ranks: { ...ranks },
    latestDraw: { numbers: [...numbers].sort((a, b) => a - b), bonus },
    recentRank,
  });
}

function processBatch(token) {
  if (token !== generation || !running || paused) return;

  const batchSize = speed === 'turbo' ? 220_000 : 18_000;
  const numbers = [0, 0, 0, 0, 0, 0];
  let bonus = 0;
  let recentRank = null;

  for (let iteration = 0; iteration < batchSize; iteration += 1) {
    drawMark += 1;
    if (drawMark === 0xffffffff) {
      usedAt = new Uint32Array(46);
      drawMark = 1;
    }

    let matches = 0;
    for (let ball = 0; ball < 6; ball += 1) {
      const number = nextUniqueNumber();
      numbers[ball] = number;
      matches += selectedFlags[number];
    }
    bonus = nextUniqueNumber();
    recentRank = rankFromMatches(matches, selectedFlags[bonus] === 1);
    weeks += 1;

    if (recentRank !== null) ranks[recentRank] += 1;

    if (recentRank === 1) {
      running = false;
      postProgress(numbers, bonus, recentRank, true);
      self.postMessage({
        type: 'won',
        runId,
        weeks,
        ranks: { ...ranks },
        latestDraw: { numbers: [...numbers].sort((a, b) => a - b), bonus },
      });
      return;
    }
  }

  postProgress(numbers, bonus, recentRank);
  timer = self.setTimeout(() => processBatch(token), speed === 'turbo' ? 0 : 35);
}

function resetWorker() {
  generation += 1;
  running = false;
  paused = false;
  self.clearTimeout(timer);
}

self.onmessage = (event) => {
  const message = event.data;

  try {
    if (message.type === 'start') {
      const unique = new Set(message.selected);
      if (message.selected.length !== 6 || unique.size !== 6) {
        throw new Error('중복 없는 번호 6개가 필요합니다.');
      }

      resetWorker();
      runId = message.runId;
      speed = message.speed === 'turbo' ? 'turbo' : 'normal';
      weeks = 0;
      ranks = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      selectedFlags = new Uint8Array(46);
      message.selected.forEach((number) => {
        if (!Number.isInteger(number) || number < 1 || number > 45) {
          throw new Error('번호는 1부터 45 사이여야 합니다.');
        }
        selectedFlags[number] = 1;
      });

      const seedArray = new Uint32Array(1);
      crypto.getRandomValues(seedArray);
      random = makeRandom(seedArray[0]);
      running = true;
      paused = false;
      const token = generation;
      processBatch(token);
      return;
    }

    if (message.runId !== runId) return;

    if (message.type === 'pause') {
      paused = true;
      self.clearTimeout(timer);
    } else if (message.type === 'resume' && running) {
      paused = false;
      processBatch(generation);
    } else if (message.type === 'setSpeed') {
      speed = message.speed === 'turbo' ? 'turbo' : 'normal';
    } else if (message.type === 'reset') {
      resetWorker();
    }
  } catch (error) {
    running = false;
    self.postMessage({
      type: 'error',
      runId: message.runId ?? runId,
      message: error instanceof Error ? error.message : '시뮬레이션 오류가 발생했습니다.',
    });
  }
};
