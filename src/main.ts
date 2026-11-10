/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  FacebookAuthProvider,
  linkWithPopup,
  linkWithRedirect,
  signOut,
  onAuthStateChanged,
  type User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  collection,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  type DocumentReference,
  type Unsubscribe
} from 'firebase/firestore';

// Firebase project configuration for Tickle-Tac.
// Players connect automatically as guests using Firebase Anonymous Authentication in the background.
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyA2pYtJd7dCnpkjpwSknvKWcG7uFrC2Mts',
  authDomain: 'project-r-64a0b.firebaseapp.com',
  projectId: 'project-r-64a0b',
  storageBucket: 'project-r-64a0b.firebasestorage.app',
  messagingSenderId: '33094240315',
  appId: '1:33094240315:web:4df3b77922eab6d21cb41e',
  measurementId: 'G-Q4091DSQPK'
};

const fbApp = initializeApp(FIREBASE_CONFIG);
const fbAuth = getAuth(fbApp);
const db = getFirestore(fbApp);

(function () {
  let N = 15, WIN = 5, CELL = 40;
  const VB = 600;
  const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
  const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
  let EMPTY = new Array(N * N + 1).join('.');
  let zoomed = false;
  const WORDS: Record<number, string> = { 3: 'three', 4: 'four', 5: 'five' };

  function winFor(n: number): number {
    return ({ 3: 3, 4: 4, 5: 4, 7: 5, 15: 5 } as Record<number, number>)[n] || 5;
  }
  function setSize(n: number) {
    N = n;
    WIN = winFor(n);
    CELL = VB / n;
    EMPTY = new Array(n * n + 1).join('.');
    if (n < 10) zoomed = false;
  }

  const $ = function (id: string): any { return document.getElementById(id); };

  function lsGet(k: string): string | null { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k: string, v: string | null) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} }
  function buzz(ms: number | number[]) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function esc(t: string | number) {
    return String(t).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c];
    });
  }

  /* ---------- User and online state ---------- */
  let user: User | null = null;
  let myId: string | null = null;
  let canWrite: boolean | null = null;
  let cloudStatus: 'synced' | 'syncing' | 'offline' | 'error' | 'guest' = 'guest';
  let cloudStatusText = 'Connecting…';
  let lastSyncTime = 0;
  let syncTimer: any = null;
  let initialAuthChecked = false;

  /* ---------- Progression, Modes & Meta State (Declared first to prevent TDZ) ---------- */
  let lobbyMode = lsGet('ttt-mode') || 'classic', curMode = 'classic';
  let lad = { stage: 0, run: 0, over: '' }, lastMsg = '';
  try {
    const savedLad = lsGet('ttt-lad');
    if (savedLad) {
      const parsed = JSON.parse(savedLad);
      if (typeof parsed.stage === 'number') lad.stage = parsed.stage;
      if (typeof parsed.run === 'number') lad.run = parsed.run;
      if (typeof parsed.over === 'string') lad.over = parsed.over;
    }
  } catch (e) {}

  function saveLad() {
    lsSet('ttt-lad', JSON.stringify(lad));
  }

  const MODES: [string, string][] = [
    ['classic', 'Classic'],
    ['blitz', 'Blitz'],
    ['bo3', 'Best of 3'],
    ['tour', 'Tournament'],
    ['surv', 'Survival'],
    ['random', 'Random']
  ];
  const MODE_INFO: Record<string, string> = {
    classic: 'Standard rules with your chosen timer.',
    blitz: 'Only 5 seconds per move. Think fast!',
    bo3: 'Three rounds: first to win 2 takes the series.',
    tour: 'Win a 3-match bracket against computer rivals. Lose once and you are out.',
    surv: 'Keep winning to stay alive. One loss ends the run, and the computer gets sharper.',
    random: 'Blocked squares appear at random every round (boards 4×4 and up).'
  };
  const STAGES = ['Quarter-final', 'Semi-final', 'Final'], OPP = ['Bolt 🤖', 'Nova 🤖', 'Rex 🤖'];
  const AVS: [string, number][] = [['🙂', 1], ['😎', 1], ['🐱', 1], ['🦊', 2], ['🐼', 3], ['🦁', 4], ['🐉', 6], ['👾', 8], ['🥷', 10], ['🧙', 12], ['👑', 15], ['🦄', 18]];
  const TITLES: [number, string][] = [[1, 'Rookie'], [3, 'Challenger'], [5, 'Strategist'], [8, 'Master'], [12, 'Grandmaster'], [16, 'Legend']];
  const POOL: [string, string, number][] = [
    ['Win 2 games', 'win', 2],
    ['Play 4 games', 'play', 4],
    ['Win a Blitz game', 'blitz', 1],
    ['Place 25 marks', 'move', 25],
    ['Win 3 games', 'win', 3],
    ['Win a Random Board game', 'random', 1]
  ];
  const ACH: [string, string, string][] = [
    ['first', '🥇', 'First win'], ['w10', '🎖️', '10 wins'], ['w50', '🏅', '50 wins'],
    ['s5', '🔥', '5-win streak'], ['blitz', '⚡', 'Blitz winner'], ['bo3', '🏁', 'Series winner'],
    ['surv5', '🛡️', 'Survivor (5)'], ['tour', '🏆', 'Tournament champ'], ['l5', '⭐', 'Level 5'],
    ['l10', '💫', 'Level 10'], ['log7', '📅', '7-day login']
  ];
  const WK: [number, number][] = [[5, 50], [15, 150], [30, 400]];
  const HINT_DIAMOND_COST = 5;
  const DIAMOND_PACKS = [{ coins: 50, diamonds: 5 }, { coins: 100, diamonds: 12 }, { coins: 200, diamonds: 26 }];

  interface MetaState {
    name: string;
    av: string;
    xp: number;
    wins: number;
    games: number;
    streak: number;
    best: number;
    bs: number;
    lastLogin: string;
    loginDay: number;
    mis: { d: string; p: Record<number, number>; done: Record<number, number> };
    ach: Record<string, number>;
    fr: Array<{ fc: string; name: string; av: string }>;
    sn: { id: string; xp: number; cl: Record<number, number> };
    wk: { k: string; w: number; cl: Record<number, number> };
    dc: string;
    history: any[];
    diamonds: number;
    diamondShopVersion?: number;
  }

  const M: MetaState = {
    name: 'Player' + (100 + Math.floor(Math.random() * 900)),
    av: '🙂',
    xp: 0,
    wins: 0,
    games: 0,
    streak: 0,
    best: 0,
    bs: 0,
    lastLogin: '',
    loginDay: 0,
    mis: { d: '', p: {}, done: {} },
    ach: {},
    fr: [],
    sn: { id: '', xp: 0, cl: {} },
    wk: { k: '', w: 0, cl: {} },
    dc: '',
    history: [],
    diamonds: 0
  };

  try { Object.assign(M, JSON.parse(lsGet('ttt-meta') || '{}')); } catch (e) {}
  if (!Array.isArray(M.history)) M.history = [];
  if (!M.diamondShopVersion) { M.diamonds = 0; M.diamondShopVersion = 1; saveM(); }
  if (typeof M.diamonds !== 'number' || !isFinite(M.diamonds) || M.diamonds < 0) M.diamonds = 0;
  M.diamonds = Math.floor(M.diamonds);

  function saveM() { lsSet('ttt-meta', JSON.stringify(M)); if (typeof syncToCloud === 'function') syncToCloud(); }
  function today(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function ydate(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function weekKey() {
    const d = new Date(); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  }
  function seasonKey() { return new Date().toISOString().slice(0, 7); }
  function seed(t: string): number {
    let h = 7;
    for (let i = 0; i < t.length; i++) h = (Math.imul(h, 31) + t.charCodeAt(i)) >>> 0;
    return h;
  }
  function level() { return Math.floor(Math.sqrt(M.xp / 40)) + 1; }
  function xpFor(l: number) { return (l - 1) * (l - 1) * 40; }
  function title() {
    let t = 'Rookie', l = level();
    TITLES.forEach(function (x) { if (l >= x[0]) t = x[1]; });
    return t;
  }
  function modeName(m: string): string {
    let r = 'Classic';
    MODES.forEach(function (x) { if (x[0] === m) r = x[1]; });
    return r;
  }
  function wkEnsure() { const k = weekKey(); if (M.wk.k !== k) M.wk = { k: k, w: 0, cl: {} }; }
  function snEnsure() { const k = seasonKey(); if (M.sn.id !== k) M.sn = { id: k, xp: 0, cl: {} }; }

  let toastT: any = null;
  function toast(t: string) {
    const el = $('toast');
    if (!el) return;
    el.textContent = t;
    el.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(function () { el.hidden = true; }, 3400);
  }

  function ach(id: string) {
    if (M.ach[id]) return;
    M.ach[id] = 1;
    ACH.forEach(function (a) { if (a[0] === id) toast('Badge unlocked: ' + a[1] + ' ' + a[2]); });
  }

  function addXp(n: number) {
    const l0 = level(); snEnsure(); M.xp += n; M.sn.xp += n;
    if (level() > l0) { toast('Level up! Level ' + level() + ' · ' + title()); sfx('win'); }
    if (level() >= 5) ach('l5'); if (level() >= 10) ach('l10');
    saveM(); renderProfile();
  }

  function isEligibleRewardMode(): boolean {
    if (!ctx) return false;
    if (ctx.kind === 'cpu') return true;
    if (ctx.kind === 'online' && Boolean(ctx.code && ctx.me)) return true;
    return false;
  }

  function effMode(kind: 'cpu' | 'local' | 'online') {
    return (kind !== 'cpu' && (lobbyMode === 'tour' || lobbyMode === 'surv')) ? 'classic' : lobbyMode;
  }
  function modeTl() { return curMode === 'blitz' ? 5 : timerSecs; }

  function startBoard(_m?: string): string {
    return EMPTY;
  }

  function opp() { return curMode === 'tour' ? OPP[Math.min(lad.stage, 2)] : 'Computer'; }
  function effAiDiff(): string {
    if (curMode === 'tour') return lad.stage === 0 ? 'easy' : lad.stage === 1 ? 'medium' : 'hard';
    if (curMode === 'surv') return lad.run < 2 ? 'easy' : lad.run < 5 ? 'medium' : 'hard';
    return aiDifficulty;
  }

  function metaStart() {
    lad = { stage: 0, run: 0, over: '' };
    lastMsg = '';
    saveLad();
  }

  function metaPatch(g: GameState): Partial<GameState> {
    if (lad.over) {
      lad = { stage: 0, run: 0, over: '' };
      saveLad();
    }
    const m = g.mode || 'classic';
    return (m === 'tour' || m === 'surv' || (m === 'bo3' && (g.wx >= 2 || g.wo >= 2))) ? { wx: 0, wo: 0, wd: 0 } : {};
  }

  function getRematchButtonText(): string {
    if (G && G.mode === 'tour' && ctx.kind === 'cpu') {
      if (lad.over === 'champ' || lad.stage >= 3) {
        return 'TOURNAMENT COMPLETED';
      }
      if (lad.over === 'out') {
        return 'START NEW TOURNAMENT';
      }
      if (lad.stage === 1) {
        return 'PLAY SEMI FINAL';
      }
      if (lad.stage === 2) {
        return 'PLAY FINAL';
      }
      if (G.winner === 'D') {
        return 'REPLAY ' + (STAGES[Math.min(lad.stage, 2)] || 'ROUND').toUpperCase();
      }
      return 'PLAY SEMI FINAL';
    }
    if (G && G.mode === 'bo3') {
      if (G.wx >= 2 || G.wo >= 2) return 'New Series';
      return 'Next Round';
    }
    return 'Play again';
  }

  function metaRender() {
    const b = $('mbadge');
    if (!b || !G || !ctx.kind) return;
    const m = G.mode || 'classic';
    let t = modeName(m);
    if (m === 'bo3') {
      t += ' · first to 2 · game ' + Math.min(3, G.wx + G.wo + G.wd + (G.winner ? 0 : 1));
      if (G.winner && lastMsg) t += ' · ' + lastMsg;
    } else if (m === 'tour' && ctx.kind === 'cpu') {
      if (G.winner) {
        if (lad.over === 'champ') {
          t += ' · Tournament Champion! 🏆';
        } else if (lad.over === 'out') {
          t += ' · Eliminated in ' + STAGES[Math.min(lad.stage, 2)];
        } else {
          const completedStage = Math.max(0, lad.stage - 1);
          t += ' · ' + STAGES[completedStage] + ' Won';
        }
      } else {
        t += ' · ' + STAGES[Math.min(lad.stage, 2)] + ' vs ' + OPP[Math.min(lad.stage, 2)];
      }
    } else if (m === 'surv' && ctx.kind === 'cpu') {
      t += ' · streak ' + lad.run;
      if (G.winner && lastMsg) t += ' · ' + lastMsg;
    } else {
      if (G.winner && lastMsg) t += ' · ' + lastMsg;
    }
    b.textContent = t;
  }

  /* ---------- Points Wallet, Shop Items & Symbols ---------- */
  const EMOJIS: [string, string][] = [['👍', 'Thumbs up'], ['😂', 'Laughing'], ['😮', 'Wow'], ['🔥', 'Fire'], ['😢', 'Sad']];
  const TIERS: Array<{ price: number; name: string; items: [string, string][] }> = [
    { price: 10, name: 'Starter', items: [['😀', 'Grin'], ['😎', 'Cool'], ['🤔', 'Thinking'], ['😅', 'Phew'], ['🙌', 'Hooray'], ['💪', 'Strong'], ['🎉', 'Party'], ['👏', 'Clap']] },
    { price: 15, name: 'Cool', items: [['😍', 'Love it'], ['🤩', 'Starstruck'], ['🥳', 'Celebrate'], ['😜', 'Cheeky'], ['🤝', 'Deal'], ['💯', 'Hundred'], ['✨', 'Sparkles'], ['🍿', 'Popcorn']] },
    { price: 20, name: 'Rare', items: [['🤯', 'Mind blown'], ['😈', 'Devious'], ['🥶', 'Freezing'], ['🥵', 'Hot'], ['🙈', 'Oops'], ['🤫', 'Shh'], ['🚀', 'Rocket'], ['🎯', 'Bullseye']] },
    { price: 30, name: 'Epic', items: [['👑', 'Crown'], ['💎', 'Diamond'], ['🦄', 'Unicorn'], ['🐉', 'Dragon'], ['🏆', 'Trophy'], ['🌈', 'Rainbow'], ['🧠', 'Big brain'], ['🎸', 'Rock on']] },
    { price: 40, name: 'Legendary', items: [['🦁', 'Lion'], ['🐺', 'Wolf'], ['🦅', 'Eagle'], ['🦸', 'Hero'], ['🥷', 'Ninja'], ['🧙', 'Wizard'], ['🔮', 'Crystal ball'], ['🛸', 'UFO']] },
    { price: 50, name: 'Mythic', items: [['🌟', 'Glowing star'], ['🌠', 'Shooting star'], ['🪐', 'Planet'], ['☄️', 'Comet'], ['🦚', 'Peacock'], ['🌋', 'Volcano'], ['🎆', 'Fireworks'], ['🤴', 'Prince']] }
  ];
  const QUICK = ['Good luck!', 'Nice move!', 'Well played!', 'Oops!', 'Your turn!', 'Good game!', 'Rematch?'];
  const WIN_POINTS = 5, MSG_COST = 1;
  const PRICE: Record<string, number> = {}, LABEL: Record<string, string> = {};
  EMOJIS.forEach(function (p) { PRICE[p[0]] = 0; LABEL[p[0]] = p[1]; });
  TIERS.forEach(function (t) { t.items.forEach(function (p) { PRICE[p[0]] = t.price; LABEL[p[0]] = p[1]; }); });
  const EMO: Record<string, number> = {}; Object.keys(PRICE).forEach(function (k) { EMO[k] = 1; });
  function isReaction(t: string): boolean { return Object.prototype.hasOwnProperty.call(EMO, t); }

  const SYM_TIERS: Array<{ price: number; name: string; items: [string, string][] }> = [
    { price: 20, name: 'Symbols: sweet and sky', items: [['⭐', 'Star'], ['❤️', 'Heart'], ['🌙', 'Moon'], ['☀️', 'Sun'], ['🍕', 'Pizza'], ['🍩', 'Donut']] },
    { price: 30, name: 'Symbols: pets and sport', items: [['🐱', 'Cat'], ['🐶', 'Dog'], ['🐼', 'Panda'], ['🦊', 'Fox'], ['🍉', 'Melon'], ['⚽', 'Football']] },
    { price: 40, name: 'Symbols: nature and play', items: [['🌸', 'Blossom'], ['🍀', 'Clover'], ['🌵', 'Cactus'], ['🐙', 'Octopus'], ['🎲', 'Dice'], ['🏀', 'Basketball']] },
    { price: 50, name: 'Symbols: wild', items: [['🦖', 'T-Rex'], ['🧊', 'Ice cube'], ['💣', 'Bomb'], ['🍄', 'Mushroom'], ['🐝', 'Bee'], ['🦋', 'Butterfly']] },
    { price: 75, name: 'Symbols: legendary', items: [['🦈', 'Shark'], ['🐅', 'Tiger'], ['🦂', 'Scorpion'], ['🚁', 'Helicopter'], ['🏰', 'Castle'], ['🌍', 'Earth']] }
  ];
  const SYM: Record<string, number> = {};
  SYM_TIERS.forEach(function (t) { t.items.forEach(function (p) { SYM[p[0]] = 1; PRICE[p[0]] = t.price; LABEL[p[0]] = p[1]; }); });
  const SEASON_SKINS: [string, string][] = [['🌌', 'Galaxy'], ['🔱', 'Trident'], ['🧿', 'Evil eye'], ['🛡️', 'Shield']];
  SEASON_SKINS.forEach(function (p) { SYM[p[0]] = 1; PRICE[p[0]] = 9999; LABEL[p[0]] = p[1]; });

  let points = 0;
  const owned: Record<string, number> = {};
  (function () {
    const n = parseInt(lsGet('ttt-pts') || '0', 10);
    points = n > 0 ? n : 0;
    try {
      (JSON.parse(lsGet('ttt-own') || '[]') || []).forEach(function (e: string) {
        if (PRICE[e] > 0) owned[e] = 1;
      });
    } catch (e) {}
  })();

  const symPick: { X: string; O: string } = { X: '', O: '' };
  (['X', 'O'] as const).forEach(function (m) {
    const v = lsGet('ttt-sym' + m.toLowerCase());
    if (v && SYM[v] && owned[v]) symPick[m] = v;
  });

  function symOf(m: 'X' | 'O'): string {
    const v = (ctx.kind === 'online' && G) ? G[m === 'X' ? 'sx' : 'so'] : symPick[m];
    return v && SYM[v] ? v : '';
  }

  function pickSym(m: 'X' | 'O', v: string) {
    if (v && !owned[v]) return;
    symPick[m] = v; lsSet('ttt-sym' + m.toLowerCase(), v);
    if (G && ctx.kind === 'online') {
      if (ctx.me !== m) return;
      const patch: Partial<GameState> = {};
      if (m === 'X') patch.sx = v; else patch.so = v;
      G = Object.assign({}, G, patch); render();
      const ref = gameRef!;
      enqueue(function () { return updateDoc(ref, patch); });
    } else if (G) render();
    renderSymPicker();
  }

  function renderSymPicker() {
    const box = $('sym-pick');
    if (!box) return;
    box.innerHTML = '';
    const marks: ('X' | 'O')[] = ctx.kind === 'online' ? (ctx.me ? [ctx.me] : []) : ['X', 'O'];
    box.hidden = !marks.length;
    const mine: [string, string][] = [];
    SYM_TIERS.concat([{ price: 0, name: '', items: SEASON_SKINS }]).forEach(function (t) {
      t.items.forEach(function (p) { if (owned[p[0]]) mine.push(p); });
    });
    marks.forEach(function (m) {
      const wrap = document.createElement('div'); wrap.className = 'sympick';
      const lab = document.createElement('span'); lab.className = 'lab';
      lab.textContent = ctx.kind === 'online' ? 'Your symbol (' + m + ')' : (ctx.kind === 'cpu' && m === 'O' ? 'Computer symbol (O)' : 'Symbol for ' + m);
      const row = document.createElement('div'); row.className = 'symrow';
      ([['', m]] as [string, string][]).concat(mine).forEach(function (p) {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = p[0] || m;
        if (!p[0]) b.style.cssText = 'font:800 1rem var(--font-display);color:var(--' + (m === 'X' ? 'x' : 'o') + ')';
        b.setAttribute('aria-pressed', String(symPick[m] === p[0]));
        b.setAttribute('aria-label', (p[0] ? p[1] : 'Classic ' + m) + ' for ' + m);
        b.addEventListener('click', function () { pickSym(m, p[0]); });
        row.appendChild(b);
      });
      wrap.appendChild(lab); wrap.appendChild(row); box.appendChild(wrap);
    });
  }

  function saveWallet() {
    lsSet('ttt-pts', String(points));
    lsSet('ttt-own', JSON.stringify(Object.keys(owned)));
    if (typeof syncToCloud === 'function') syncToCloud();
  }

  function changePoints(d: number) {
    points = Math.max(0, points + d);
    saveWallet(); updateWallet();
    if (d > 0) { const w = $('wallet'); if (w) { w.classList.remove('bump'); void w.offsetWidth; w.classList.add('bump'); } }
  }

  function canUse(e: string): boolean { return PRICE[e] === 0 || !!owned[e]; }

  function updateWallet() {
    const ptsEl = $('pts');
    if (ptsEl) ptsEl.textContent = String(points);
    const walletEl = $('wallet');
    if (walletEl) walletEl.setAttribute('aria-label', 'Open emoji shop. You have ' + points + ' points');
    const low = points < MSG_COST;
    const sendBtn = $('chat-send');
    if (sendBtn) sendBtn.disabled = false;
    const c = $('chat-cost');
    if (c) {
      c.className = 'cost' + (low ? ' low' : '');
      c.textContent = low
        ? 'Not enough points to type your own message. Use a quick message, or win a game to earn ' + WIN_POINTS + ' points.'
        : 'Typing your own message costs ' + MSG_COST + ' point. You have ' + points + '. Quick messages are free.';
    }
    renderTray();
    refreshShop();
    refreshHintButton();
    renderProfile();
  }

  function refreshHintButton() {
    const b = $('hint-btn');
    if (!b) return;
    b.textContent = '💡 Hint · ' + HINT_DIAMOND_COST + ' 💎';
    b.disabled = !M || M.diamonds < HINT_DIAMOND_COST;
    b.title = b.disabled ? 'You need ' + HINT_DIAMOND_COST + ' Diamonds to use a hint.' : 'Spend ' + HINT_DIAMOND_COST + ' Diamonds to reveal a suggested move.';
  }

  let noteTimer: any = null;
  function costNote(t: string) {
    const c = $('chat-cost');
    if (!c) return;
    c.className = 'cost low'; c.textContent = t;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(updateWallet, 4000);
  }

  function renderTray() {
    const box = $('react');
    if (!box) return;
    box.innerHTML = '';
    const list = EMOJIS.slice();
    TIERS.forEach(function (t) { t.items.forEach(function (p) { if (owned[p[0]]) list.push(p); }); });
    list.forEach(function (p) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = p[0];
      b.setAttribute('aria-label', 'Send reaction: ' + p[1]);
      b.addEventListener('click', function () { sendChat('react', p[0], 0); });
      box.appendChild(b);
    });
  }

  let shopBuilt = false, shopSel = '';
  const shopBtns: Record<string, HTMLButtonElement> = {};

  function buildShop() {
    if (shopBuilt) return;
    shopBuilt = true;
    const list = $('shop-list');
    const diamondList = $('diamond-packs');
    if (!list || !diamondList) return;
    DIAMOND_PACKS.forEach(function (pack) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'item';
      b.innerHTML = '<span class="em" aria-hidden="true">💎</span><span class="pr">' + pack.diamonds + ' 💎 · ' + pack.coins + ' 🪙</span>';
      b.addEventListener('click', function () { buyDiamondPack(pack); });
      diamondList.appendChild(b);
    });
    function section(title: string, sub: string, items: [string, string][], price: number) {
      const t = document.createElement('div'); t.className = 'tier';
      t.innerHTML = '<h3>' + title + ' <span>' + sub + '</span></h3>';
      const g = document.createElement('div'); g.className = 'eg';
      items.forEach(function (p) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'item'; b.setAttribute('aria-pressed', 'false');
        b.innerHTML = '<span class="em" aria-hidden="true">' + p[0] + '</span><span class="pr"></span>';
        b.addEventListener('click', function () { shopSel = p[0]; refreshShop(); });
        shopBtns[p[0]] = b; g.appendChild(b);
      });
      t.appendChild(g); list.appendChild(t);
    }
    section('Basic', 'free for everyone', EMOJIS, 0);
    TIERS.forEach(function (t) { section(t.name, t.price + ' points each', t.items, t.price); });
    SYM_TIERS.forEach(function (t) { section(t.name, t.price + ' points each', t.items, t.price); });
  }

  function refreshShop() {
    if (!shopBuilt) return;
    renderSymPicker();
    const bal = $('shop-bal');
    if (bal) bal.textContent = 'Wallet: ' + points + ' coins 🪙 · ' + M.diamonds + ' Diamonds 💎';
    const dp = $('diamond-packs');
    if (dp) {
      Array.prototype.forEach.call(dp.children, function (b: HTMLButtonElement, i: number) {
        const pack = DIAMOND_PACKS[i];
        b.disabled = points < pack.coins;
        b.title = points < pack.coins
          ? 'Earn ' + (pack.coins - points) + ' more coins to buy this pack.'
          : 'Exchange ' + pack.coins + ' coins for ' + pack.diamonds + ' Diamonds.';
      });
    }
    Object.keys(shopBtns).forEach(function (e) {
      const b = shopBtns[e], price = PRICE[e], has = canUse(e);
      b.classList.toggle('owned', has);
      b.classList.toggle('locked', !has && points < price);
      b.setAttribute('aria-pressed', String(shopSel === e));
      b.setAttribute('aria-label', LABEL[e] + ', ' + (price === 0 ? 'free' : has ? 'owned' : price + ' points'));
      const prEl = b.querySelector('.pr');
      if (prEl) prEl.textContent = price === 0 ? 'Free' : has ? 'Owned ✓' : price + ' pts';
    });
    const info = $('buy-info'), btn = $('buy-btn');
    if (!info || !btn) return;
    if (!shopSel) { info.textContent = 'Tap an emoji to preview it.'; btn.disabled = true; btn.textContent = 'Buy'; return; }
    const pr = PRICE[shopSel];
    if (canUse(shopSel)) {
      info.textContent = shopSel + ' ' + LABEL[shopSel] + ' is yours. ' + (SYM[shopSel] ? 'Pick it in the symbol row above.' : 'Use it in the chat.');
      btn.disabled = true; btn.textContent = 'Owned';
    } else if (points < pr) {
      info.textContent = shopSel + ' ' + LABEL[shopSel] + ': you need ' + (pr - points) + ' more points.';
      btn.disabled = true; btn.textContent = 'Buy · ' + pr;
    } else {
      info.textContent = 'Buy ' + shopSel + ' ' + LABEL[shopSel] + ' for ' + pr + ' points?';
      btn.disabled = false; btn.textContent = 'Buy · ' + pr;
    }
  }

  function buyDiamondPack(pack: { coins: number; diamonds: number }) {
    if (!pack || points < pack.coins) { toast('Not enough coins. Win matches or complete missions to earn more.'); return; }
    if (!window.confirm('Exchange ' + pack.coins + ' coins for ' + pack.diamonds + ' Diamonds?')) return;
    changePoints(-pack.coins); M.diamonds += pack.diamonds; saveM(); updateWallet(); renderProfile();
    toast('Purchase complete! +' + pack.diamonds + ' Diamonds 💎');
  }

  function openShop() {
    buildShop(); refreshShop();
    const d = $('shop'); if (d && !d.open) d.showModal();
  }

  function buySelected() {
    const e = shopSel, pr = PRICE[e];
    if (!e || canUse(e) || points < pr) return;
    owned[e] = 1;
    changePoints(-pr);
    sfx('win', 0);
  }

  function renderProfile() {
    const l = level(), a = xpFor(l), b = xpFor(l + 1);
    const av = $('p-av'); if (av) { av.textContent = M.av; av.classList.add('premium-avatar'); }
    const pName = $('p-name'); if (pName) pName.textContent = M.name;
    const pTitle = $('p-title'); if (pTitle) pTitle.textContent = title();
    const pLv = $('p-lv'); if (pLv) pLv.textContent = 'Level ' + l + ' · ' + (M.xp - a) + '/' + (b - a) + ' XP · 🪙 ' + points + ' · 💎 ' + M.diamonds;
    const pXp = $('p-xp'); if (pXp) pXp.style.width = Math.min(100, (M.xp - a) / (b - a) * 100) + '%';
    updateCloudStatus(cloudStatus, cloudStatusText);
  }

  function updateCloudStatus(status: 'synced' | 'syncing' | 'offline' | 'error' | 'guest', customText?: string) {
    cloudStatus = status;
    if (customText) cloudStatusText = customText;
    else if (status === 'synced') cloudStatusText = 'Synced';
    else if (status === 'syncing') cloudStatusText = 'Syncing…';
    else if (status === 'offline') cloudStatusText = 'Offline (Local)';
    else if (status === 'error') cloudStatusText = 'Sync Paused';
    else if (status === 'guest') cloudStatusText = 'Guest (Unlinked)';

    const iconEl = $('sync-icon');
    if (iconEl) {
      iconEl.textContent = status === 'synced' ? '☁️' : status === 'syncing' ? '🔄' : status === 'offline' ? '📡' : status === 'error' ? '⚠️' : '☁️';
    }
    const textEl = $('sync-text');
    if (textEl) textEl.textContent = cloudStatusText;
    const tagEl = $('cloud-sync-tag');
    if (tagEl) {
      tagEl.classList.toggle('syncing', status === 'syncing');
      tagEl.title = 'Cloud status: ' + cloudStatusText + ' (Click to view account)';
    }

    const accIcon = $('account-status-icon');
    if (accIcon) {
      accIcon.textContent = user && !user.isAnonymous ? '👤' : '☁️';
    }
    const accText = $('account-status-text');
    if (accText) {
      accText.textContent = user && !user.isAnonymous ? 'Account' : 'Cloud';
    }

    const bAcc = $('badge-acc');
    if (bAcc) {
      if (user && !user.isAnonymous) {
        const isFb = user?.providerData?.some(function (p) { return p.providerId.includes('facebook'); });
        bAcc.textContent = isFb ? 'Facebook' : 'Google';
        bAcc.className = 'badge-acc ' + (isFb ? 'facebook' : 'google');
        bAcc.hidden = false;
      } else {
        bAcc.textContent = '';
        bAcc.hidden = true;
      }
    }
    updateLobbyCloudSection();
  }

  function isPermanentUser(u: User | null): boolean {
    return !!(u && !u.isAnonymous);
  }

  function enterLobby() {
    const loginEl = $('login-screen');
    if (loginEl) loginEl.hidden = true;
    const appEl = document.querySelector('.app') as HTMLElement | null;
    if (appEl) appEl.hidden = false;
    updateLobbyCloudSection();
    updateDailyUI();
    tryRestoreLocalGame();
  }

  function showLoginScreen(visible: boolean) {
    const loginEl = $('login-screen');
    if (loginEl) loginEl.hidden = !visible;
    const appEl = document.querySelector('.app') as HTMLElement | null;
    if (appEl) appEl.hidden = visible;
  }

  function updateLobbyCloudSection() {
    const isPermanent = !!(user && !user.isAnonymous);

    const bAcc = $('badge-acc');
    if (bAcc) {
      if (isPermanent) {
        const isFb = user?.providerData?.some(function (p) { return p.providerId.includes('facebook'); });
        bAcc.textContent = isFb ? 'Facebook' : 'Google';
        bAcc.className = 'badge-acc ' + (isFb ? 'facebook' : 'google');
        bAcc.hidden = false;
      } else {
        bAcc.textContent = 'Guest';
        bAcc.className = 'badge-acc';
        bAcc.hidden = false;
      }
    }

    const syncText = $('sync-text');
    if (syncText) {
      syncText.textContent = cloudStatus === 'synced' ? 'Synced' : (cloudStatus === 'syncing' ? 'Syncing…' : 'Cloud');
    }
    const syncTag = $('cloud-sync-tag');
    if (syncTag) {
      syncTag.className = 'cloud-sync-tag ' + (cloudStatus === 'syncing' ? 'syncing' : '');
    }

    const card = $('lobby-cloud-card');
    if (card) {
      const badgeEl = $('lobby-cloud-badge');
      if (badgeEl) {
        if (isPermanent) {
          const isFb = user?.providerData?.some(function (p) { return p.providerId.includes('facebook'); });
          badgeEl.textContent = isFb ? 'Facebook Account' : 'Google Account';
          badgeEl.className = 'badge-acc ' + (isFb ? 'facebook' : 'google');
          badgeEl.hidden = false;
        } else {
          badgeEl.textContent = '';
          badgeEl.hidden = true;
        }
      }
      const accEl = $('lobby-cloud-account');
      if (accEl) {
        if (isPermanent) {
          const name = user?.displayName || M.name;
          const email = user?.email ? ' (' + user.email + ')' : '';
          accEl.textContent = name + email;
        } else {
          accEl.textContent = 'Signed in as Guest';
        }
      }
      const statusEl = $('lobby-cloud-status');
      if (statusEl) {
        statusEl.textContent = cloudStatus === 'synced' ? '🟢 Synced' : cloudStatus === 'syncing' ? '🔄 Syncing…' : cloudStatus === 'offline' ? '📡 Offline (Local)' : '☁️ Ready';
        statusEl.className = 'cloud-status-badge ' + (cloudStatus === 'synced' ? 'synced' : '');
      }
      const lastSaveEl = $('lobby-cloud-last-save');
      if (lastSaveEl) {
        lastSaveEl.textContent = lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Syncing on first change…';
      }
    }
  }

  function getCloudPayload() {
    return {
      uid: myId || user?.uid || '',
      name: M.name,
      av: M.av,
      points: points,
      diamonds: M.diamonds,
      xp: M.xp,
      level: level(),
      title: title(),
      wins: M.wins,
      games: M.games,
      streak: M.streak,
      best: M.best,
      bs: M.bs,
      owned: Object.keys(owned),
      symX: symPick.X || '',
      symO: symPick.O || '',
      ach: M.ach,
      mis: M.mis,
      history: M.history.slice(0, 50),
      sn: M.sn,
      wk: M.wk,
      fr: M.fr,
      settings: {
        sound: soundOn,
        theme: themeMode,
        size: sizeSel,
        timer: timerSecs,
        aiDifficulty: aiDifficulty,
        mode: lobbyMode
      },
      isAnonymous: !!user?.isAnonymous,
      email: user?.email || null,
      displayName: user?.displayName || null,
      lastLogin: M.lastLogin,
      loginDay: M.loginDay,
      dailyReward: {
        lastClaimDate: M.lastLogin,
        loginDay: M.loginDay,
        updatedAt: Date.now()
      },
      updatedAt: Date.now(),
      version: 1
    };
  }

  function syncToCloud(immediate: boolean = false) {
    if (!db || !user || !myId) return;
    if (!navigator.onLine) {
      updateCloudStatus('offline', 'Offline (Saved locally)');
      return;
    }
    clearTimeout(syncTimer);
    const doSync = async function () {
      try {
        updateCloudStatus('syncing', 'Saving to cloud…');
        const payload = getCloudPayload();

        // Primary save to profiles/{uid} which is permitted by user's published Firestore rules
        await setDoc(doc(db, 'profiles', myId!), {
          ...payload,
          name: M.name,
          av: M.av,
          lvl: level(),
          title: title(),
          updatedAt: Date.now()
        }, { merge: true });

        // Secondary save to users/{uid} (gracefully handles if remote rules only have profiles)
        try {
          await setDoc(doc(db, 'users', myId!), payload, { merge: true });
        } catch (uErr) {}

        lastSyncTime = Date.now();
        updateCloudStatus('synced', 'Synced ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        updateLobbyCloudSection();
      } catch (err: any) {
        console.warn('Cloud sync error:', err);
        updateCloudStatus('error', 'Sync paused');
      }
    };
    if (immediate) doSync();
    else syncTimer = setTimeout(doSync, 1200);
  }

  async function loadFromCloud(uid: string) {
    if (!db || !uid) return;
    try {
      updateCloudStatus('syncing', 'Loading cloud save…');
      let d: any = null;
      try {
        const pSnap = await getDoc(doc(db, 'profiles', uid));
        if (pSnap.exists()) {
          d = pSnap.data();
        }
      } catch (pErr) {
        console.warn('Could not read profiles doc:', pErr);
      }

      if (!d) {
        try {
          const uSnap = await getDoc(doc(db, 'users', uid));
          if (uSnap.exists()) {
            d = uSnap.data();
          }
        } catch (uErr) {}
      }

      if (d) {
        points = Math.max(points, typeof d.points === 'number' ? d.points : 0);
        M.diamonds = Math.max(M.diamonds, typeof d.diamonds === 'number' ? d.diamonds : 0);
        M.xp = Math.max(M.xp, typeof d.xp === 'number' ? d.xp : 0);
        M.wins = Math.max(M.wins, typeof d.wins === 'number' ? d.wins : 0);
        M.games = Math.max(M.games, typeof d.games === 'number' ? d.games : 0);
        M.streak = Math.max(M.streak, typeof d.streak === 'number' ? d.streak : 0);
        M.best = Math.max(M.best, typeof d.best === 'number' ? d.best : 0);
        M.bs = Math.max(M.bs, typeof d.bs === 'number' ? d.bs : 0);
        if (d.name && typeof d.name === 'string') M.name = d.name;
        if (d.av && typeof d.av === 'string') M.av = d.av;
        if (Array.isArray(d.owned)) {
          d.owned.forEach(function (e: string) { owned[e] = 1; });
        }
        if (d.ach && typeof d.ach === 'object') {
          Object.assign(M.ach, d.ach);
        }
        if (Array.isArray(d.history) && d.history.length > 0) {
          M.history = d.history;
        }
        if (d.settings) {
          if (typeof d.settings.sound === 'boolean') { soundOn = d.settings.sound; syncSnd(); }
          if (d.settings.size && /^(3|4|5|7|15)$/.test(String(d.settings.size))) { sizeSel = +d.settings.size; }
          if (d.settings.aiDifficulty) { aiDifficulty = d.settings.aiDifficulty; }
        }
        if (d.lastLogin && typeof d.lastLogin === 'string') {
          M.lastLogin = d.lastLogin;
        } else if (d.dailyReward?.lastClaimDate && typeof d.dailyReward.lastClaimDate === 'string') {
          M.lastLogin = d.dailyReward.lastClaimDate;
        }
        if (typeof d.loginDay === 'number') {
          M.loginDay = d.loginDay;
        } else if (typeof d.dailyReward?.loginDay === 'number') {
          M.loginDay = d.dailyReward.loginDay;
        }
        saveM();
        saveWallet();
        updateWallet();
        renderProfile();
        renderModes();
        updateSub();
        updateDailyUI();
      }

      lastSyncTime = Date.now();
      updateCloudStatus('synced', 'Synced ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      updateLobbyCloudSection();
      await syncToCloud(true);
    } catch (err: any) {
      console.warn('Load cloud save error handled safely:', err);
      lastSyncTime = Date.now();
      updateCloudStatus('synced', 'Synced ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      updateLobbyCloudSection();
    }
  }

  function clearLoginFeedback() {
    const box = $('login-feedback');
    if (box) {
      box.hidden = true;
      box.innerHTML = '';
      box.className = 'login-feedback';
    }
  }

  function setLoginFeedback(
    type: 'error' | 'warning' | 'info',
    title: string,
    messageHtml: string,
    domainToCopy?: string,
    showCopyBtn?: boolean,
    actions?: Array<{ label: string; action: () => void }>
  ) {
    const box = $('login-feedback');
    if (!box) return;
    box.hidden = false;
    box.className = 'login-feedback ' + type;

    const icon = type === 'error' ? '⚠️' : type === 'warning' ? 'ℹ️' : '💡';
    let h = '<div class="login-feedback-head"><span>' + icon + '</span> <b>' + esc(title) + '</b></div>';
    h += '<div class="login-feedback-body">' + messageHtml + '</div>';

    if (domainToCopy) {
      h += '<div class="login-domain-box">';
      h += '<code>' + esc(domainToCopy) + '</code>';
      if (showCopyBtn) {
        h += '<button type="button" class="btn btn-copy-sm" id="btn-copy-auth-domain">📋 Copy Domain</button>';
      }
      h += '</div>';
    }

    if (actions && actions.length > 0) {
      h += '<div class="login-feedback-actions">';
      actions.forEach(function (act, idx) {
        h += '<button type="button" class="btn primary" id="feedback-act-' + idx + '">' + esc(act.label) + '</button>';
      });
      h += '</div>';
    }

    box.innerHTML = h;

    if (domainToCopy && showCopyBtn) {
      const copyBtn = $('btn-copy-auth-domain');
      if (copyBtn) {
        copyBtn.addEventListener('click', async function () {
          try {
            await navigator.clipboard.writeText(domainToCopy);
            copyBtn.textContent = '✅ Copied!';
            toast('Domain copied to clipboard!');
            setTimeout(function () {
              if (copyBtn) copyBtn.textContent = '📋 Copy Domain';
            }, 2500);
          } catch (e) {
            toast('Copy failed. Please highlight and copy domain manually.');
          }
        });
      }
    }

    if (actions && actions.length > 0) {
      actions.forEach(function (act, idx) {
        const btn = $('feedback-act-' + idx);
        if (btn) btn.addEventListener('click', act.action);
      });
    }
  }

  function setLoginButtonLoading(provider: 'google' | 'fb', loading: boolean, customText?: string) {
    const gBtn = $('login-btn-google') as HTMLButtonElement | null;
    const fBtn = $('login-btn-fb') as HTMLButtonElement | null;
    const gOrig = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' +
      '<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>' +
      '<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>' +
      '<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>' +
      '<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>' +
      '</svg><span>Continue with Google</span>';
    const fOrig = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor">' +
      '<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>' +
      '</svg><span>Continue with Facebook</span>';

    if (loading) {
      if (gBtn) gBtn.disabled = true;
      if (fBtn) fBtn.disabled = true;
      if (provider === 'google' && gBtn) {
        gBtn.innerHTML = '<span class="spin-loader"></span><span>' + esc(customText || 'Connecting to Google…') + '</span>';
      } else if (provider === 'fb' && fBtn) {
        fBtn.innerHTML = '<span class="spin-loader"></span><span>' + esc(customText || 'Connecting to Facebook…') + '</span>';
      }
    } else {
      if (gBtn) {
        gBtn.disabled = false;
        gBtn.innerHTML = gOrig;
      }
      if (fBtn) {
        fBtn.disabled = false;
        fBtn.innerHTML = fOrig;
      }
    }
  }

  function handleAuthError(providerName: 'Google' | 'Facebook', err: any) {
    const currentHost = window.location.hostname;
    console.warn(providerName + ' auth error:', err);

    if (err.code === 'auth/unauthorized-domain') {
      setLoginFeedback(
        'error',
        'Firebase Domain Authorization Required',
        'The domain <b>' + esc(currentHost) + '</b> must be added to your Firebase project authorized domains before Google or Facebook login can complete.<br><br>' +
        '<b>Quick Fix in Firebase Console:</b><br>' +
        '1. Go to <a href="https://console.firebase.google.com/project/project-r-64a0b/authentication/settings" target="_blank" rel="noopener" style="color:var(--x);text-decoration:underline;font-weight:700;">Firebase Console &rarr; Authentication &rarr; Settings &rarr; Authorized domains</a><br>' +
        '2. Click <b>"Add domain"</b> and paste:',
        currentHost,
        true
      );
      toast('⚠️ Domain ' + currentHost + ' must be added to Firebase Authorized Domains.');
    } else if (err.code === 'auth/popup-blocked') {
      setLoginFeedback(
        'warning',
        'Sign-in Popup Was Blocked',
        'Your browser blocked the authentication popup window.<br>' +
        'Click the button below to use redirect authentication, or allow popups for this site in your browser address bar.',
        undefined,
        false,
        [
          {
            label: '⚡ Continue with ' + providerName + ' (Redirect)',
            action: function () {
              if (providerName === 'Google') authWithGoogle(true);
              else authWithFacebook(true);
            }
          },
          {
            label: 'Open in Direct Tab ↗',
            action: function () {
              window.open(window.location.href, '_blank');
            }
          }
        ]
      );
      toast('⚠️ Sign-in popup was blocked. Click redirect button below.');
    } else if (err.code === 'auth/operation-not-allowed' || err.code === 'auth/configuration-not-found') {
      if (providerName === 'Facebook') {
        setLoginFeedback(
          'warning',
          'Facebook Login Not Enabled',
          'Facebook Sign-in is not enabled or configured in Firebase project <b>project-r-64a0b</b>.<br><br>' +
          'Please continue with <b>Google Sign-In</b> (which is fully configured and ready), or enable Facebook in the Firebase Console under Authentication &rarr; Sign-in method.'
        );
        toast('Facebook Login is not configured in Firebase Console. Please use Continue with Google.');
      } else {
        setLoginFeedback(
          'error',
          'Google Sign-in Not Enabled',
          'Google Sign-in is not enabled in Firebase Console. Please enable Google under Authentication &rarr; Sign-in method.'
        );
        toast('Google Sign-In is not enabled in Firebase Authentication.');
      }
    } else if (err.code === 'auth/popup-closed-by-user') {
      setLoginFeedback('info', 'Sign-in Cancelled', 'The sign-in window was closed before completion. Click Continue with ' + providerName + ' to try again.');
    } else {
      setLoginFeedback('error', 'Sign-in Error', esc(err.message || String(err)));
      toast(providerName + ' error: ' + (err.message || err.code));
    }
  }

  async function authWithGoogle(forceRedirect = false) {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    setLoginButtonLoading('google', true, forceRedirect ? 'Redirecting to Google…' : 'Connecting to Google…');
    clearLoginFeedback();

    try {
      updateCloudStatus('syncing', 'Signing in with Google…');
      const currentAnon = fbAuth.currentUser && fbAuth.currentUser.isAnonymous ? fbAuth.currentUser : null;

      if (forceRedirect) {
        if (currentAnon) {
          await linkWithRedirect(currentAnon, provider);
        } else {
          await signInWithRedirect(fbAuth, provider);
        }
        return;
      }

      if (currentAnon) {
        try {
          const res = await linkWithPopup(currentAnon, provider);
          user = res.user;
          myId = res.user.uid;
          if (user.displayName && M.name.startsWith('Player')) {
            M.name = user.displayName.slice(0, 14);
          }
          toast('🎉 Google Account linked! Welcome to Tickle-Tac.');
          await syncToCloud(true);
          renderProfile();
          updateLobbyCloudSection();
          enterLobby();
          if (hubTab === 'account') renderHub();
          return;
        } catch (linkErr: any) {
          if (linkErr.code === 'auth/credential-already-in-use') {
            const proceed = window.confirm(
              'This Google account already has saved Tickle-Tac cloud data.\n\n' +
              'Sign in to merge your progress safely and restore your cloud account?'
            );
            if (!proceed) {
              updateCloudStatus('guest');
              setLoginButtonLoading('google', false);
              return;
            }
          } else if (linkErr.code === 'auth/popup-blocked') {
            setLoginButtonLoading('google', true, 'Popup blocked. Redirecting to Google…');
            await linkWithRedirect(currentAnon, provider);
            return;
          } else if (linkErr.code === 'auth/popup-closed-by-user') {
            updateCloudStatus('guest');
            setLoginButtonLoading('google', false);
            return;
          } else {
            throw linkErr;
          }
        }
      }

      try {
        const res = await signInWithPopup(fbAuth, provider);
        user = res.user;
        myId = res.user.uid;
        toast('Welcome ' + (user.displayName || user.email || 'Player') + '!');
        await loadFromCloud(user.uid);
        renderProfile();
        updateLobbyCloudSection();
        enterLobby();
        if (hubTab === 'account') renderHub();
      } catch (popupErr: any) {
        if (popupErr.code === 'auth/popup-blocked') {
          setLoginFeedback('info', 'Popup Blocked', 'Popup was blocked by your browser. Redirecting to Google Sign-In…');
          setLoginButtonLoading('google', true, 'Redirecting to Google…');
          await signInWithRedirect(fbAuth, provider);
          return;
        }
        throw popupErr;
      }
    } catch (err: any) {
      handleAuthError('Google', err);
      showLoginScreen(true);
    } finally {
      setLoginButtonLoading('google', false);
    }
  }

  async function authWithFacebook(forceRedirect = false) {
    const provider = new FacebookAuthProvider();
    setLoginButtonLoading('fb', true, forceRedirect ? 'Redirecting to Facebook…' : 'Connecting to Facebook…');
    clearLoginFeedback();

    try {
      updateCloudStatus('syncing', 'Signing in with Facebook…');
      const currentAnon = fbAuth.currentUser && fbAuth.currentUser.isAnonymous ? fbAuth.currentUser : null;

      if (forceRedirect) {
        if (currentAnon) {
          await linkWithRedirect(currentAnon, provider);
        } else {
          await signInWithRedirect(fbAuth, provider);
        }
        return;
      }

      if (currentAnon) {
        try {
          const res = await linkWithPopup(currentAnon, provider);
          user = res.user;
          myId = res.user.uid;
          if (user.displayName && M.name.startsWith('Player')) {
            M.name = user.displayName.slice(0, 14);
          }
          toast('🎉 Facebook Account linked! Welcome to Tickle-Tac.');
          await syncToCloud(true);
          renderProfile();
          updateLobbyCloudSection();
          enterLobby();
          if (hubTab === 'account') renderHub();
          return;
        } catch (linkErr: any) {
          if (linkErr.code === 'auth/credential-already-in-use') {
            const proceed = window.confirm(
              'This Facebook account already has saved Tickle-Tac cloud data.\n\n' +
              'Sign in to merge your progress safely and restore your cloud account?'
            );
            if (!proceed) {
              updateCloudStatus('guest');
              setLoginButtonLoading('fb', false);
              return;
            }
          } else if (linkErr.code === 'auth/popup-blocked') {
            setLoginButtonLoading('fb', true, 'Popup blocked. Redirecting to Facebook…');
            await linkWithRedirect(currentAnon, provider);
            return;
          } else if (linkErr.code === 'auth/popup-closed-by-user') {
            updateCloudStatus('guest');
            setLoginButtonLoading('fb', false);
            return;
          } else {
            throw linkErr;
          }
        }
      }

      try {
        const res = await signInWithPopup(fbAuth, provider);
        user = res.user;
        myId = res.user.uid;
        toast('Welcome ' + (user.displayName || 'Player') + '!');
        await loadFromCloud(user.uid);
        renderProfile();
        updateLobbyCloudSection();
        enterLobby();
        if (hubTab === 'account') renderHub();
      } catch (popupErr: any) {
        if (popupErr.code === 'auth/popup-blocked') {
          setLoginFeedback('info', 'Popup Blocked', 'Popup was blocked by your browser. Redirecting to Facebook Sign-In…');
          setLoginButtonLoading('fb', true, 'Redirecting to Facebook…');
          await signInWithRedirect(fbAuth, provider);
          return;
        }
        throw popupErr;
      }
    } catch (err: any) {
      handleAuthError('Facebook', err);
      showLoginScreen(true);
    } finally {
      setLoginButtonLoading('fb', false);
    }
  }

  async function authSignOut() {
    try {
      await signOut(fbAuth);
      user = null;
      myId = null;
      canWrite = false;
      enableOnline();
      updateCloudStatus('guest', 'Signed out');
      renderProfile();
      toast('Signed out successfully.');
      showLoginScreen(true);
      const hub = $('hub') as HTMLDialogElement | null;
      if (hub && hub.open) hub.close();
    } catch (err: any) {
      toast('Sign out failed: ' + err.message);
    }
  }

  let onlineN: number | null = null;
  function renderOnline() {
    const el = $('p-online');
    if (el) el.textContent = onlineN === null ? 'Online: –' : '🟢 ' + onlineN + ' online';
  }

  function renderModes() {
    const box = $('mode-seg'); if (!box) return;
    box.innerHTML = '';
    MODES.forEach(function (m) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = m[1];
      b.setAttribute('aria-pressed', String(lobbyMode === m[0]));
      b.addEventListener('click', function () {
        lobbyMode = m[0]; lsSet('ttt-mode', lobbyMode); renderModes();
      });
      box.appendChild(b);
    });
    const hint = $('mode-hint');
    if (hint) hint.textContent = MODE_INFO[lobbyMode];
  }

  /* ---------- Game State Interfaces & Variables ---------- */
  interface GameContext {
    kind: 'online' | 'cpu' | 'local' | null;
    code: string;
    me: 'X' | 'O' | null;
  }

  interface GameState {
    size: number;
    sx: string;
    so: string;
    x: string;
    o: string;
    board: string;
    mode: string;
    turn: 'X' | 'O';
    n: number;
    round: number;
    winner: string;
    line: number[];
    last: number;
    wx: number;
    wo: number;
    wd: number;
    tl: number;
    gaveUp: string;
    code?: string;
    created?: number;
    lastSeenX?: number;
    lastSeenO?: number;
    hbX?: number;
    hbO?: number;
    activeX?: boolean;
    activeO?: boolean;
    startedAt?: number;
    status?: string;
    forfeitReason?: 'opponent_left' | 'disconnect' | string;
    forfeitBy?: string;
    forfeitRole?: string;
    winnerUid?: string;
    finishedAt?: number;
  }

  let ctx: GameContext = { kind: null, code: '', me: null };
  let G: GameState | null = null;
  let gameRef: DocumentReference | null = null;
  let unsub: Unsubscribe | null = null;
  let sel = -1;
  let keyFocusCell = -1;
  let wq: Promise<any> = Promise.resolve();
  let cpuTimer: any = null;
  let loadTimer: any = null;
  let heartbeatTimer: any = null;
  let disconnectCheckTimer: any = null;
  let forfeitProcessed = false;
  let lastOpponentActivityLocalTime = 0;
  let lastKnownOpponentHeartbeatVal: any = null;
  let matchHandshakeConfirmed = false;
  let matchStartTime = 0;
  let claimTries = 0;
  let claiming = false;
  let names: { X: string; O: string } = { X: '', O: '' };
  let namesKey = '';
  let renderedN = -2;
  let winKey = '';

  /* ---------- Game Rules ---------- */
  function newGame(x?: string, o?: string, tl?: number, size?: number): GameState {
    return {
      size: size || 15,
      sx: '',
      so: '',
      x: x || '',
      o: o || '',
      board: startBoard(curMode),
      mode: curMode,
      turn: 'X',
      n: 0,
      round: 0,
      winner: '',
      line: [],
      last: -1,
      wx: 0,
      wo: 0,
      wd: 0,
      tl: tl || 0,
      gaveUp: '',
      status: 'waiting'
    };
  }

  function starter(round: number): 'X' | 'O' { return round % 2 === 0 ? 'X' : 'O'; }

  function findLine(b: string, idx: number, mark: string): [number, number] | null {
    const r = (idx / N) | 0, c = idx % N;
    for (let d = 0; d < DIRS.length; d++) {
      const dr = DIRS[d][0], dc = DIRS[d][1];
      let sr = r, sc = c, er = r, ec = c, cnt = 1;
      while (true) {
        const nr = sr - dr, nc = sc - dc;
        if (nr < 0 || nr >= N || nc < 0 || nc >= N || b[nr * N + nc] !== mark) break;
        sr = nr; sc = nc; cnt++;
      }
      while (true) {
        const pr = er + dr, pc = ec + dc;
        if (pr < 0 || pr >= N || pc < 0 || pc >= N || b[pr * N + pc] !== mark) break;
        er = pr; ec = pc; cnt++;
      }
      if (cnt >= WIN) return [sr * N + sc, er * N + ec];
    }
    return null;
  }

  function applyMove(g: GameState, idx: number): Partial<GameState> {
    const mark = g.turn;
    const b = g.board.slice(0, idx) + mark + g.board.slice(idx + 1);
    const line = findLine(b, idx, mark);
    const patch: Partial<GameState> = { board: b, n: g.n + 1, last: idx };
    if (line) {
      patch.winner = mark; patch.line = line; patch.turn = mark;
      if (mark === 'X') patch.wx = g.wx + 1; else patch.wo = g.wo + 1;
    } else if (b.indexOf('.') < 0) {
      patch.winner = 'D'; patch.line = []; patch.turn = mark; patch.wd = g.wd + 1;
    } else {
      patch.turn = mark === 'X' ? 'O' : 'X';
    }
    return patch;
  }

  function rematchPatch(g: GameState): Partial<GameState> {
    const now = Date.now();
    return Object.assign(
      {
        board: startBoard(g.mode),
        turn: starter(g.round + 1),
        n: 0,
        last: -1,
        winner: '',
        line: [],
        round: g.round + 1,
        gaveUp: '',
        forfeitReason: '',
        forfeitBy: '',
        forfeitRole: '',
        winnerUid: '',
        status: 'playing',
        lastSeenX: now,
        lastSeenO: now,
        hbX: 1,
        hbO: 1,
        activeX: true,
        activeO: true,
        startedAt: now
      },
      metaPatch(g)
    );
  }

  function winCells(line: number[]): number[] {
    if (!line || line.length < 2) return [];
    const ar = (line[0] / N) | 0, ac = line[0] % N;
    const br = (line[1] / N) | 0, bc = line[1] % N;
    const dr = Math.sign(br - ar), dc = Math.sign(bc - ac);
    const out: number[] = [];
    let r = ar, c = ac;
    while (true) {
      out.push(r * N + c);
      if (r === br && c === bc) break;
      r += dr; c += dc;
    }
    return out;
  }

  let aiDifficulty = lsGet('ttt-ai') || 'medium';
  let moveLog: Array<{ mark: string; index: number; board?: string; n?: number }> = [];

  /* ---------- 3x3 Tic-Tac-Toe Minimax Solver ---------- */
  function checkWinner3(b: string): string | null {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (let i = 0; i < 8; i++) {
      const x = lines[i][0], y = lines[i][1], z = lines[i][2];
      if (b[x] !== '.' && b[x] === b[y] && b[y] === b[z]) return b[x];
    }
    if (b.indexOf('.') === -1) return 'D';
    return null;
  }

  function minimax3(b: string, depth: number, isMax: boolean, myMark: string, oppMark: string): number {
    const winner = checkWinner3(b);
    if (winner === myMark) return 10 - depth;
    if (winner === oppMark) return depth - 10;
    if (winner === 'D') return 0;

    if (isMax) {
      let maxEval = -100;
      for (let i = 0; i < 9; i++) {
        if (b[i] === '.') {
          const nb = b.slice(0, i) + myMark + b.slice(i + 1);
          const ev = minimax3(nb, depth + 1, false, myMark, oppMark);
          if (ev > maxEval) maxEval = ev;
        }
      }
      return maxEval;
    } else {
      let minEval = 100;
      for (let i = 0; i < 9; i++) {
        if (b[i] === '.') {
          const nb = b.slice(0, i) + oppMark + b.slice(i + 1);
          const ev = minimax3(nb, depth + 1, true, myMark, oppMark);
          if (ev < minEval) minEval = ev;
        }
      }
      return minEval;
    }
  }

  function solve3x3(b: string, myMark: 'X' | 'O', diff: string): number {
    const oppMark: 'X' | 'O' = myMark === 'X' ? 'O' : 'X';

    // 1. Immediate winning move (always take win)
    for (let i = 0; i < 9; i++) {
      if (b[i] === '.') {
        const nb = b.slice(0, i) + myMark + b.slice(i + 1);
        if (checkWinner3(nb) === myMark) return i;
      }
    }

    // 2. Immediate opponent block (must block unless easy misses with low chance)
    for (let i = 0; i < 9; i++) {
      if (b[i] === '.') {
        const nb = b.slice(0, i) + oppMark + b.slice(i + 1);
        if (checkWinner3(nb) === oppMark) {
          if (diff !== 'easy' || Math.random() < 0.85) return i;
        }
      }
    }

    // 3. Minimax evaluation for all open squares
    let bestVal = -100;
    let candidates: number[] = [];
    for (let i = 0; i < 9; i++) {
      if (b[i] === '.') {
        const nb = b.slice(0, i) + myMark + b.slice(i + 1);
        const ev = minimax3(nb, 0, false, myMark, oppMark);
        if (ev > bestVal) {
          bestVal = ev;
          candidates = [i];
        } else if (ev === bestVal) {
          candidates.push(i);
        }
      }
    }

    if (diff === 'easy' && candidates.length > 1) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }

    // Positional tie-breakers: Center (4) -> Corners (0, 2, 6, 8) -> Edges (1, 3, 5, 7)
    const pref = [4, 0, 2, 6, 8, 1, 3, 5, 7];
    for (let p = 0; p < pref.length; p++) {
      if (candidates.indexOf(pref[p]) >= 0) return pref[p];
    }
    return candidates[0] !== undefined ? candidates[0] : 0;
  }

  /* ---------- General Gomoku / m,n,k Pattern Evaluation ---------- */
  function scoreMove(board: string, idx: number, mark: string): number {
    const oppMark = mark === 'X' ? 'O' : 'X';
    const r = (idx / N) | 0, c = idx % N;
    let totalScore = 0;
    let openThrees = 0;
    let fours = 0;
    let hasWin = false;

    for (let d = 0; d < 4; d++) {
      const dr = DIRS[d][0], dc = DIRS[d][1];
      const segment: string[] = [];
      const centerOffset = WIN;

      for (let step = -WIN; step <= WIN; step++) {
        const rr = r + dr * step;
        const cc = c + dc * step;
        if (rr < 0 || rr >= N || cc < 0 || cc >= N) {
          segment.push('#');
        } else if (step === 0) {
          segment.push(mark);
        } else {
          segment.push(board[rr * N + cc]);
        }
      }

      // Check consecutive unbroken marks through idx
      let consec = 1;
      let i = 1;
      while (segment[centerOffset + i] === mark) { consec++; i++; }
      const rightOpen = segment[centerOffset + i] === '.';
      i = 1;
      while (segment[centerOffset - i] === mark) { consec++; i++; }
      const leftOpen = segment[centerOffset - i] === '.';

      if (consec >= WIN) {
        hasWin = true;
        totalScore += 10000000;
        continue;
      }

      // Scan all windows of length WIN containing centerOffset
      let maxWinCount = 0;
      for (let wStart = centerOffset - (WIN - 1); wStart <= centerOffset; wStart++) {
        let markCount = 0;
        let blocked = false;
        for (let k = 0; k < WIN; k++) {
          const ch = segment[wStart + k];
          if (ch === oppMark || ch === '#') {
            blocked = true;
            break;
          }
          if (ch === mark) markCount++;
        }
        if (!blocked && markCount > maxWinCount) {
          maxWinCount = markCount;
        }
      }

      if (consec === WIN - 1) {
        if (leftOpen && rightOpen) {
          totalScore += 1000000;
          fours++;
        } else if (leftOpen || rightOpen) {
          totalScore += 100000;
          fours++;
        }
      } else if (maxWinCount === WIN - 1) {
        totalScore += 90000;
        fours++;
      } else if (consec === WIN - 2) {
        if (leftOpen && rightOpen && maxWinCount >= WIN - 2) {
          totalScore += 25000;
          openThrees++;
        } else if ((leftOpen || rightOpen) && maxWinCount >= WIN - 2) {
          totalScore += 3000;
        }
      } else if (maxWinCount === WIN - 2) {
        if (leftOpen && rightOpen) {
          totalScore += 15000;
          openThrees++;
        } else {
          totalScore += 2000;
        }
      } else if (consec === WIN - 3 && (leftOpen || rightOpen) && maxWinCount >= WIN - 3) {
        totalScore += (leftOpen && rightOpen) ? 500 : 100;
      }
    }

    if (hasWin) return 10000000;
    if (fours >= 2) totalScore += 2000000;
    else if (fours >= 1 && openThrees >= 1) totalScore += 1000000;
    else if (openThrees >= 2) totalScore += 500000;

    return totalScore;
  }

  function cellScore(b: string, idx: number, mark: string): number {
    return scoreMove(b, idx, mark);
  }

  function cpuChoose(b: string, myMark: 'X' | 'O' = 'O', overrideDiff?: string): number {
    const diff = overrideDiff || aiDifficulty;

    // For 3x3 Tic-Tac-Toe, use exact Minimax solver
    if (N === 3 && WIN === 3) {
      return solve3x3(b, myMark, diff);
    }

    const oppMark: 'X' | 'O' = myMark === 'X' ? 'O' : 'X';

    // If board is empty, play center
    let any = false;
    for (let i = 0; i < b.length; i++) {
      if (b[i] !== '.') { any = true; break; }
    }
    if (!any) return ((N / 2) | 0) * N + ((N / 2) | 0);

    // Filter candidate cells to those near existing pieces (Chebyshev distance <= 2)
    const candidates: number[] = [];
    for (let i = 0; i < b.length; i++) {
      if (b[i] !== '.') continue;
      const r = (i / N) | 0, c = i % N;
      let near = false;
      for (let dr = -2; dr <= 2 && !near; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr >= 0 && rr < N && cc >= 0 && cc < N && b[rr * N + cc] !== '.') {
            near = true;
            break;
          }
        }
      }
      if (near) candidates.push(i);
    }

    if (!candidates.length) {
      for (let i = 0; i < b.length; i++) if (b[i] === '.') candidates.push(i);
    }

    let bestScore = -Infinity;
    let bestPicks: number[] = [];
    const scoredList: Array<{ idx: number; score: number }> = [];

    for (let ci = 0; ci < candidates.length; ci++) {
      const idx = candidates[ci];
      const r = (idx / N) | 0, c = idx % N;
      const centerDist = Math.abs(r - (N - 1) / 2) + Math.abs(c - (N - 1) / 2);
      const centerBonus = (N - centerDist) * 3;

      const attack = scoreMove(b, idx, myMark);
      const defend = scoreMove(b, idx, oppMark);

      let priority = 0;
      if (attack >= 10000000) {
        priority = 20000000 + attack; // Win immediately
      } else if (defend >= 10000000) {
        priority = 15000000 + defend; // Must block opponent win immediately
      } else if (attack >= 1000000) {
        priority = 8000000 + attack;  // Create open four (guaranteed win next turn)
      } else if (defend >= 1000000) {
        priority = 6000000 + defend;  // Must block open four
      } else if (attack >= 500000) {
        priority = 4000000 + attack;  // Double threat / fork
      } else if (defend >= 500000) {
        priority = 3000000 + defend;  // Block opponent double threat
      } else if (attack >= 90000) {
        priority = 1000000 + attack;  // Closed four
      } else if (defend >= 90000) {
        priority = 800000 + defend;   // Block closed four
      } else {
        const attWeight = diff === 'hard' ? 1.4 : 1.25;
        const defWeight = diff === 'hard' ? 1.3 : 1.15;
        priority = attack * attWeight + defend * defWeight + centerBonus;
        if (diff === 'medium') priority += (Math.random() * 2);
      }

      scoredList.push({ idx: idx, score: priority });

      if (priority > bestScore) {
        bestScore = priority;
        bestPicks = [idx];
      } else if (Math.abs(priority - bestScore) < 0.001) {
        bestPicks.push(idx);
      }
    }

    if (diff === 'easy') {
      // In easy mode, pick from the top 3 tactical candidates (never wild random distant squares)
      scoredList.sort(function (a, b) { return b.score - a.score; });
      const topCount = Math.min(3, scoredList.length);
      return scoredList[Math.floor(Math.random() * topCount)].idx;
    }

    return bestPicks[Math.floor(Math.random() * bestPicks.length)];
  }

  function randCode(): string {
    let s = '';
    for (let i = 0; i < 6; i++) s += ALPHA.charAt(Math.floor(Math.random() * ALPHA.length));
    return s;
  }

  function enqueue(fn: () => Promise<any>): Promise<any> {
    wq = wq.then(fn).catch(function (e) { showTip(writeError(e)); });
    return wq;
  }

  function writeError(e: any): string {
    if (e && e.code === 'permission-denied') return 'Permission denied by Firestore security rules. Check that you are authenticated as guest.';
    if (e && e.code === 'quota-exceeded') return 'The game store is full. Ask the owner to clear old games.';
    if (e && e.code === 'unavailable') return 'Connection unavailable. Please check your internet connection.';
    return e?.message || 'Could not reach the game server. Check your connection and try again.';
  }

  let tipText = '', flashText = '', flashTimer: any = null;
  function updateTip() { const tipEl = $('tip'); if (tipEl) tipEl.textContent = tipText || flashText || tipDefault(); }
  function showTip(t: string) { tipText = t; updateTip(); }
  function flash(t: string) {
    flashText = t; updateTip();
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { flashText = ''; updateTip(); }, 3500);
  }
  function showMsg(t: string) {
    const el = $('online-msg');
    if (!el) return;
    el.textContent = t || '';
    el.hidden = !t;
  }

  /* ---------- Views & Status ---------- */
  function canMoveNow(): boolean {
    if (!G || G.winner) return false;
    if (ctx.kind === 'online') return !!(ctx.me && G.o && G.turn === ctx.me);
    if (ctx.kind === 'cpu') return G.turn === 'X';
    return ctx.kind === 'local';
  }

  function labelFor(m: 'X' | 'O'): string {
    if (ctx.kind === 'cpu') return m === 'X' ? 'You (X)' : opp() + ' (O)';
    if (ctx.kind === 'local') return 'Player ' + m;
    if (ctx.me === m) return 'You (' + m + ')';
    if (ctx.kind === 'online' && ctx.me && m === 'O' && !G?.o) return 'Waiting for O…';
    return (names[m] || (ctx.me ? 'Friend' : 'Player')) + ' (' + m + ')';
  }

  function statusText(): string {
    if (!G) return 'Loading game…';
    if (G.winner === 'D') return 'Draw! The board is completely full.';
    if (G.winner && G.gaveUp) {
      const oth = G.gaveUp === 'X' ? 'O' : 'X';
      if (ctx.kind === 'cpu') return 'You gave up. Computer wins.';
      if (ctx.kind === 'online' && ctx.me) {
        return G.gaveUp === ctx.me
          ? 'You gave up. ' + (names[oth] || 'Opponent') + ' wins.'
          : (names[G.gaveUp as 'X' | 'O'] || 'Opponent') + ' gave up. You win!';
      }
      return 'Player ' + G.gaveUp + ' gave up. Player ' + oth + ' wins!';
    }
    if (G.winner) {
      if (ctx.kind === 'cpu') return G.winner === 'X' ? 'You win!' : 'Computer wins!';
      if (ctx.kind === 'online' && ctx.me) {
        return G.winner === ctx.me ? '🎉 You win!' : 'Match over — ' + (names[G.winner as 'X' | 'O'] || 'Opponent') + ' wins!';
      }
      return 'Player ' + G.winner + ' wins!';
    }

    if (ctx.kind === 'online') {
      if (!G.o) {
        return ctx.me === 'X'
          ? 'Waiting for Player 2 to join (Room: ' + ctx.code + ')'
          : 'Connecting to room…';
      }
      if (!ctx.me) return 'Spectating match. ' + G.turn + ' to move';

      const now = Date.now();
      const oppMark: 'X' | 'O' = ctx.me === 'X' ? 'O' : 'X';
      const lastSeen = oppMark === 'O' ? (G.lastSeenO || 0) : (G.lastSeenX || 0);
      const isOppDisconnected = lastSeen > 0 && (now - lastSeen > 30000);

      if (isOppDisconnected) {
        return '⚠️ ' + (names[oppMark] || 'Opponent') + ' may be disconnected. Waiting for them to reconnect…';
      }

      if (G.turn === ctx.me) return '👉 Your turn (' + ctx.me + ') — Place your mark!';
      return '⏳ Waiting for ' + (names[oppMark] || 'Opponent (' + oppMark + ')') + ' to move…';
    }

    if (ctx.kind === 'cpu') return G.turn === 'X' ? 'Your move' : 'Computer is thinking…';
    return "Player " + G.turn + "'s turn";
  }

  function updateConnectionBadge() {
    const tag = $('conn-tag');
    const dot = $('conn-dot');
    const text = $('conn-status-text');
    if (!tag || !dot || !text) return;

    if (ctx.kind !== 'online' || !G) {
      tag.hidden = true;
      return;
    }
    tag.hidden = false;

    if (!G.o) {
      dot.className = 'conn-dot yellow';
      text.textContent = 'Room ' + ctx.code + ' · Waiting for Player 2';
      return;
    }

    const now = Date.now();
    const oppMark: 'X' | 'O' = ctx.me === 'X' ? 'O' : 'X';
    const lastSeen = oppMark === 'O' ? (G.lastSeenO || 0) : (G.lastSeenX || 0);
    const isOppDisconnected = lastSeen > 0 && (now - lastSeen > 30000);

    if (isOppDisconnected) {
      dot.className = 'conn-dot red';
      text.textContent = (names[oppMark] || 'Opponent') + ' disconnected';
    } else {
      dot.className = 'conn-dot green';
      text.textContent = 'Both players connected 🟢';
    }
  }

  function tipDefault(): string {
    if (!G) return '';
    if (ctx.kind === 'online' && !G.o && ctx.me === 'X') {
      return 'Share the 6-character code ' + ctx.code + ' with your friend to start playing!';
    }
    if (canMoveNow()) return 'Tap any empty grid square to place your mark.';
    return '';
  }

  function boardSvg(): string {
    let s = '<rect x="0" y="0" width="' + VB + '" height="' + VB + '" fill="var(--surface)"/>';
    const cells = G ? winCells(G.line) : [];
    const wcol = G && G.winner === 'X' ? 'var(--x)' : 'var(--o)';
    for (let w = 0; w < cells.length; w++) {
      s += '<rect x="' + ((cells[w] % N) * CELL) + '" y="' + (((cells[w] / N) | 0) * CELL) + '" width="' + CELL + '" height="' + CELL + '" fill="' + wcol + '" opacity="0.22"/>';
    }
    let g = '';
    for (let i = 1; i < N; i++) g += 'M' + (i * CELL) + ' 0V' + VB + 'M0 ' + (i * CELL) + 'H' + VB;
    s += '<path d="' + g + '" stroke="var(--cell-line)" stroke-width="1.5" fill="none"/>';
    if (G && G.last >= 0) {
      s += '<rect x="' + ((G.last % N) * CELL + 2) + '" y="' + (((G.last / N) | 0) * CELL + 2) + '" width="' + (CELL - 4) + '" height="' + (CELL - 4) + '" rx="4" fill="none" stroke="var(--fg)" stroke-width="2" opacity="0.55"/>';
    }
    if (G && sel >= 0 && canMoveNow()) {
      const sx = (sel % N) * CELL, sy = ((sel / N) | 0) * CELL;
      s += '<rect x="' + (sx + 2) + '" y="' + (sy + 2) + '" width="' + (CELL - 4) + '" height="' + (CELL - 4) + '" rx="4" fill="none" stroke="' + (G.turn === 'X' ? 'var(--x)' : 'var(--o)') + '" stroke-width="2" stroke-dasharray="4 2" opacity="0.8"/>';
      s += markSvg(G.turn, sx, sy, false).replace('<g>', '<g opacity="0.45">');
    }
    if (keyFocusCell >= 0 && keyFocusCell < N * N && canMoveNow() && keyFocusCell !== sel) {
      const kx = (keyFocusCell % N) * CELL, ky = ((keyFocusCell / N) | 0) * CELL;
      s += '<rect x="' + (kx + 2) + '" y="' + (ky + 2) + '" width="' + (CELL - 4) + '" height="' + (CELL - 4) + '" rx="4" fill="none" stroke="var(--fg)" stroke-width="2" stroke-dasharray="3 2" opacity="0.85"/>';
    }
    if (G) {
      for (let k = 0; k < G.board.length; k++) {
        const m = G.board[k];
        if (m === '.' || m === '#') continue;
        s += markSvg(m as 'X' | 'O', (k % N) * CELL, ((k / N) | 0) * CELL, k === G.last && G.n !== renderedN);
      }
    }
    s += '<rect x="0" y="0" width="' + VB + '" height="' + VB + '" fill="none" stroke="var(--line)" stroke-width="3"/>';
    if (G && cells.length) {
      const a = G.line[0], z = G.line[1];
      s += '<line x1="' + ((a % N) * CELL + CELL / 2) + '" y1="' + (((a / N) | 0) * CELL + CELL / 2) + '" x2="' + ((z % N) * CELL + CELL / 2) + '" y2="' + (((z / N) | 0) * CELL + CELL / 2) + '" stroke="' + wcol + '" stroke-width="6" stroke-linecap="round" opacity="0.9"/>';
    }
    return s;
  }

  function symSvg(m: 'X' | 'O', x: number, y: number, isNew: boolean, sym: string): string {
    const u = CELL / 40, cx = x + 20 * u, cy = y + 20 * u, col = 'var(--' + (m === 'X' ? 'x' : 'o') + ')';
    const ring = isNew ? '<circle class="ring" cx="' + cx + '" cy="' + cy + '" r="' + (9 * u) + '" style="stroke-width:' + (3 * u) + '" stroke="' + col + '"/>' : '';
    return ring + '<g' + (isNew ? ' class="drop"' : '') + '><circle cx="' + cx + '" cy="' + cy + '" r="' + (16.5 * u) + '" fill="' + col + '" fill-opacity="0.18" stroke="' + col + '" stroke-width="' + (2 * u) + '"/><text class="sy-t" x="' + cx + '" y="' + cy + '" text-anchor="middle" dominant-baseline="central" font-size="' + (22 * u) + '">' + sym + '</text></g>';
  }

  function markSvg(m: 'X' | 'O', x: number, y: number, isNew: boolean): string {
    const sy = symOf(m);
    if (sy) return symSvg(m, x, y, isNew, sy);
    const u = CELL / 40, k = m === 'X' ? 'mx' : 'mo', nw = isNew ? ' new' : '';
    function layer(c: string, tf: number[] | null, sw: number) {
      const t = tf ? ' transform="translate(' + (tf[0] * u) + ' ' + (tf[1] * u) + ')"' : '', st = ' style="stroke-width:' + (sw * u) + '"';
      if (m === 'X') return '<path class="mk ' + k + ' ' + c + nw + '" pathLength="1"' + t + st + ' d="M' + (x + 10 * u) + ' ' + (y + 10 * u) + 'L' + (x + 30 * u) + ' ' + (y + 30 * u) + 'M' + (x + 30 * u) + ' ' + (y + 10 * u) + 'L' + (x + 10 * u) + ' ' + (y + 30 * u) + '"/>';
      return '<circle class="mk ' + k + ' ' + c + nw + '" pathLength="1"' + t + st + ' cx="' + (x + 20 * u) + '" cy="' + (y + 20 * u) + '" r="' + (11.5 * u) + '"/>';
    }
    const ring = isNew ? '<circle class="ring" cx="' + (x + 20 * u) + '" cy="' + (y + 20 * u) + '" r="' + (9 * u) + '" style="stroke-width:' + (3 * u) + '" stroke="var(--' + (m === 'X' ? 'x' : 'o') + ')"/>' : '';
    return ring + '<g' + (isNew ? ' class="drop"' : '') + '>' + layer('depth', [2.5, 3.5], 6) + layer('face', null, 6) + layer('hl', [-1.2, -1.5], 1.8) + '</g>';
  }

  function render() {
    const inGame = ctx.kind !== null;
    updateSub();
    const lobby = $('lobby'); if (lobby) lobby.hidden = inGame;
    const game = $('game'); if (game) game.hidden = !inGame;
    if (!inGame) return;

    if (G) {
      const targetSize = G.size || (G.board ? Math.round(Math.sqrt(G.board.length)) : 15) || 15;
      if (targetSize !== N) {
        setSize(targetSize);
      }
      if (G.board) {
        if (G.board.length !== N * N) {
          G.board = G.board.padEnd(N * N, '.').slice(0, N * N);
        }
        if (G.board.indexOf('#') >= 0) {
          G.board = G.board.replace(/#/g, '.');
        }
      }
    }

    const chip = $('code-chip');
    if (chip) {
      chip.hidden = ctx.kind !== 'online';
      if (ctx.kind === 'online') {
        const ct = $('code-text'); if (ct) ct.textContent = ctx.code;
      }
    }

    const nx = $('num-x'); if (nx) nx.textContent = G ? G.wx : 0;
    const no = $('num-o'); if (no) no.textContent = G ? G.wo : 0;
    const nd = $('num-d'); if (nd) nd.textContent = G ? G.wd : 0;
    const lx = $('lab-x'); if (lx) lx.textContent = G ? (symOf('X') + ' ' + labelFor('X')).trim() : 'X';
    const lo = $('lab-o'); if (lo) lo.textContent = G ? (symOf('O') + ' ' + labelFor('O')).trim() : 'O';
    const scx = $('sc-x'); if (scx) scx.classList.toggle('turn', !!G && !G.winner && G.turn === 'X' && (ctx.kind !== 'online' || !!G.o));
    const sco = $('sc-o'); if (sco) sco.classList.toggle('turn', !!G && !G.winner && G.turn === 'O' && (ctx.kind !== 'online' || !!G.o));

    const st = $('status');
    if (st) {
      st.className = 'status' + (G && G.winner === 'X' ? ' xwin' : G && G.winner === 'O' ? ' owin' : '');
      st.textContent = statusText();
    }
    updateTip();
    updateConnectionBadge();

    const bd = $('board');
    const sc = $('scroll');
    if (bd) {
      bd.innerHTML = boardSvg();
      bd.setAttribute('aria-label', N + ' by ' + N + ' Tickle-Tac board');
      bd.style.width = zoomed ? (N * 46) + 'px' : '100%';
      bd.style.touchAction = zoomed ? 'pan-x pan-y' : 'pan-y';
    }
    if (sc) {
      sc.style.overflow = zoomed ? 'auto' : 'hidden';
      sc.style.touchAction = zoomed ? 'pan-x pan-y' : 'pan-y';
      if (!zoomed) { sc.scrollLeft = 0; sc.scrollTop = 0; }
    }
    if (G) renderedN = G.n;

    const place = $('place'), can = canMoveNow();
    if (place) {
      place.hidden = true;
      place.disabled = !(can && sel >= 0);
      place.textContent = can ? (sel >= 0 ? 'Place ' + G!.turn : 'Pick a square') : 'Waiting…';
    }
    const gu = $('giveup-btn'); if (gu) gu.hidden = !canGiveUp();
    const zm = $('zoom');
    if (zm) {
      zm.hidden = N < 10;
      zm.textContent = zoomed ? 'Fit board' : 'Zoom in';
    }
    const rm = $('rematch') as HTMLButtonElement | null;
    if (rm) {
      rm.hidden = !(G && G.winner && (ctx.kind !== 'online' || ctx.me));
      rm.textContent = getRematchButtonText();
    }
    const chatEl = $('chat'); if (chatEl) chatEl.hidden = false;
    tickTimer();
    checkWin();
    metaRender();
  }

  /* ---------- Give Up ---------- */
  function canGiveUp(): boolean {
    if (!G || G.winner) return false;
    if (ctx.kind === 'online') return !!(ctx.me && G.o);
    return ctx.kind === 'cpu' || ctx.kind === 'local';
  }
  function giverMark(): 'X' | 'O' { return ctx.kind === 'online' ? ctx.me! : (ctx.kind === 'cpu' ? 'X' : G!.turn); }
  function askGiveUp() {
    if (!canGiveUp()) return;
    const me = giverMark(), win = me === 'X' ? 'O' : 'X';
    const sub = $('gu-sub');
    if (sub) sub.textContent = ctx.kind === 'cpu' ? 'The computer will win this round.' : ctx.kind === 'local' ? 'Player ' + win + ' will win this round.' : 'Your friend will win this round.';
    const guDlg = $('giveup'); if (guDlg) guDlg.showModal();
  }
  function doGiveUp() {
    const guDlg = $('giveup'); if (guDlg) guDlg.close();
    if (!canGiveUp() || !G) return;
    const me = giverMark(), win = me === 'X' ? 'O' : 'X';
    const patch: Partial<GameState> = { winner: win, line: [], turn: win, n: G.n + 1, gaveUp: me };
    if (win === 'X') patch.wx = G.wx + 1; else patch.wo = G.wo + 1;
    sel = -1; clearTimeout(cpuTimer);
    sfx(ctx.kind === 'local' ? 'win' : 'lose');
    G = Object.assign({}, G, patch);
    render();
    if (ctx.kind === 'online') {
      const ref = gameRef!;
      enqueue(function () { return updateDoc(ref, patch); });
    } else cpuEndReact(win);
  }

  /* ---------- Moves & Turns ---------- */
  function cellTap(idx: number) {
    if (!G || !canMoveNow()) return;
    if (idx < 0 || idx >= G.board.length) return;
    const ch = G.board[idx];
    if (ch !== '.' && ch !== '#') return;
    showTip('');
    sel = idx;
    commit();
  }
  function commit() {
    if (!G || sel < 0 || !canMoveNow()) {
      sel = -1;
      return;
    }
    const idx = sel;
    sel = -1;
    showTip('');
    const movingMark = G.turn;
    const patch = applyMove(G, idx);
    moveLog.push({ mark: movingMark, index: idx, board: patch.board, n: patch.n });
    buzz(12); metaEv('move');
    sfx(G.turn);
    if (patch.winner) sfx(endKind(patch.winner), 0.25);

    if (ctx.kind === 'online') {
      G = Object.assign({}, G, patch);
      render();
      const ref = gameRef!;
      enqueue(async function () {
        try {
          await updateDoc(ref, {
            ...patch,
            lastMoveBy: ctx.me,
            lastMoveAt: Date.now()
          });
        } catch (e) {
          const s = await getDoc(ref);
          if (s.exists() && ref === gameRef) {
            G = Object.assign({}, s.data() as GameState);
            render();
          }
          throw e;
        }
      });
    } else {
      G = Object.assign({}, G, patch);
      if (patch.winner && patch.winner !== 'D') buzz([30, 40, 60]);
      render();
      if (patch.winner) cpuEndReact(patch.winner);
      scheduleCpu();
      if (ctx.kind === 'cpu') saveLocalGame();
    }
  }

  function scheduleCpu() {
    clearTimeout(cpuTimer);
    if (ctx.kind === 'cpu' && G && !G.winner && G.turn === 'O') {
      cpuTimer = setTimeout(function () {
        if (ctx.kind === 'cpu' && G && !G.winner && G.turn === 'O') {
          const cpuMark = G.turn;
          const cpuIdx = cpuChoose(G.board, cpuMark, effAiDiff());
          const patch = applyMove(G, cpuIdx);
          moveLog.push({ mark: cpuMark, index: cpuIdx, board: patch.board, n: patch.n });
          G = Object.assign({}, G, patch);
          sfx('O');
          if (patch.winner) { sfx(endKind(patch.winner), 0.25); cpuEndReact(patch.winner); }
          render();
          saveLocalGame();
        }
      }, 500);
    }
  }

  let rematching = false;

  function rematch() {
    if (!G || !G.winner) return;
    if (rematching) return;
    rematching = true;

    const rmBtn = $('rematch') as HTMLButtonElement | null;
    if (rmBtn) rmBtn.disabled = true;
    const winAgain = $('win-again') as HTMLButtonElement | null;
    if (winAgain) winAgain.disabled = true;

    sel = -1; showTip('');
    const patch = rematchPatch(G);
    if (ctx.kind === 'online') {
      G = Object.assign({}, G, patch);
      render();
      const ref = gameRef!;
      enqueue(function () { return updateDoc(ref, patch); });
    } else {
      G = Object.assign({}, G, patch);
      render();
      scheduleCpu();
      saveLocalGame();
    }

    setTimeout(function () {
      rematching = false;
      if (rmBtn) rmBtn.disabled = false;
      if (winAgain) winAgain.disabled = false;
    }, 400);
  }

  function saveLocalGame() {
    if (ctx && ctx.kind === 'cpu' && G && curMode === 'tour') {
      lsSet('ttt-cpu-game', JSON.stringify({
        G: G,
        curMode: curMode,
        N: N,
        lad: lad
      }));
    } else {
      lsSet('ttt-cpu-game', null);
    }
  }

  function tryRestoreLocalGame(): boolean {
    const saved = lsGet('ttt-cpu-game');
    if (!saved) return false;
    try {
      const data = JSON.parse(saved);
      if (!data || !data.G || data.curMode !== 'tour') return false;
      ctx = { kind: 'cpu', code: '', me: null };
      curMode = data.curMode;
      const targetN = data.N || (data.G && data.G.size) || 15;
      setSize(targetN);
      if (data.lad) Object.assign(lad, data.lad);
      G = data.G;
      if (G && G.board) {
        if (G.board.length !== N * N) G.board = G.board.padEnd(N * N, '.').slice(0, N * N);
        if (G.board.indexOf('#') >= 0) G.board = G.board.replace(/#/g, '.');
      }
      sel = -1;
      renderedN = -2;
      render();
      if (G && !G.winner && G.turn === 'O') {
        scheduleCpu();
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function startLocal(kind: 'cpu' | 'local') {
    resetSession();
    ctx = { kind: kind, code: '', me: null };
    setSize(sizeSel); curMode = effMode(kind);
    if (curMode !== 'tour' || lad.over) {
      metaStart();
    }
    moveLog = [];
    G = newGame('', '', modeTl(), sizeSel);
    sel = -1; renderedN = -2;
    render();
    renderChat();
    saveLocalGame();
  }

  function resetSession() {
    if (unsub) { try { unsub(); } catch (e) {} unsub = null; }
    clearInterval(heartbeatTimer);
    clearInterval(disconnectCheckTimer);
    clearTimeout(cpuTimer);
    clearTimeout(loadTimer);
    heartbeatTimer = null;
    disconnectCheckTimer = null;
    voiceReset();
    const vCard = $('voice-card');
    if (vCard) vCard.hidden = true;
    gameRef = null; G = null; sel = -1; claimTries = 0; claiming = false; winKey = '';
    forfeitProcessed = false;
    lastOpponentActivityLocalTime = 0;
    lastKnownOpponentHeartbeatVal = null;
    matchHandshakeConfirmed = false;
    matchStartTime = 0;
    sessionId++;
    chatReset();
    names = { X: '', O: '' }; namesKey = ''; showTip('');
  }

  function leave() {
    qmCancel();
    const wasOnline = ctx.kind === 'online';
    const curRef = gameRef;
    const curG = G;
    const curMe = ctx.me;

    // Detect intentional opponent departure: If in an active 2-player match and no winner yet, declare forfeit
    if (wasOnline && curRef && curG && !curG.winner && curG.status === 'playing' && curG.x && curG.o && curMe && myId) {
      const oppRole = curMe === 'X' ? 'O' : 'X';
      const oppUid = curMe === 'X' ? curG.o : curG.x;
      const patch: Partial<GameState> = {
        status: 'finished',
        winner: oppRole,
        gaveUp: curMe,
        forfeitReason: 'opponent_left',
        forfeitBy: myId,
        forfeitRole: curMe,
        winnerUid: oppUid,
        finishedAt: Date.now()
      };
      if (oppRole === 'X') patch.wx = (curG.wx || 0) + 1;
      else patch.wo = (curG.wo || 0) + 1;
      updateDoc(curRef, patch).catch(function () {});
    }

    resetSession();
    ctx = { kind: null, code: '', me: null };
    lsSet('ttt-cpu-game', null);
    if (wasOnline && location.hash) location.hash = '';
    render();
    refreshResume();
  }

  /* ---------- Online Multiplayer (Modular Firestore & Anonymous Auth) ---------- */
  function openOnline(code: string) {
    resetSession();
    code = code.toUpperCase().trim();
    ctx = { kind: 'online', code: code, me: null };
    lsSet('ttt-last', code);
    if (location.hash.slice(1).toUpperCase() !== code) location.hash = code;

    gameRef = doc(db, 'games', code);
    const ref = gameRef;
    chatStart(code);
    voiceInitPresence(code);
    const vCard = $('voice-card');
    if (vCard) vCard.hidden = false;
    render();

    loadTimer = setTimeout(function () {
      if (!G) showTip("Connecting to room… still waiting for server response.");
    }, 10000);

    // Heartbeat to report presence in room (every 4s while in an active match)
    let hbSeq = 0;
    heartbeatTimer = setInterval(function () {
      if (ref === gameRef && G && ctx.kind === 'online' && ctx.me && myId && G.status === 'playing' && !G.winner) {
        hbSeq++;
        const now = Date.now();
        const updateData = ctx.me === 'X'
          ? { lastSeenX: now, hbX: hbSeq, activeX: true }
          : { lastSeenO: now, hbO: hbSeq, activeO: true };
        updateDoc(ref, updateData).catch(function () {});
      }
    }, 4000);

    // Disconnection check: 35-second grace period with local tracking to prevent false flags
    disconnectCheckTimer = setInterval(function () {
      if (ref !== gameRef || !G || ctx.kind !== 'online' || !ctx.me || !myId) return;
      if (G.winner || G.status !== 'playing' || !G.x || !G.o) return;
      if (!matchHandshakeConfirmed || !lastOpponentActivityLocalTime) return;

      const now = Date.now();
      // Enforce an initial 30-second immunity window after match begins
      if (now - matchStartTime < 30000) return;

      const silenceMs = now - lastOpponentActivityLocalTime;
      const GRACE_PERIOD_MS = 35000;
      const WARNING_THRESHOLD_MS = 15000;

      if (silenceMs >= GRACE_PERIOD_MS) {
        if (forfeitProcessed) return;
        forfeitProcessed = true;
        const oppRole = ctx.me === 'X' ? 'O' : 'X';
        const oppUid = oppRole === 'X' ? G.x : G.o;

        runTransaction(db, async function (tx) {
          const snap = await tx.get(ref);
          if (!snap.exists()) return;
          const liveGame = snap.data() as GameState;
          if (liveGame.winner || liveGame.status === 'finished') return; // Already resolved

          // Verify if opponent had any recent activity in Firestore
          const liveOppHb = oppRole === 'X' ? (liveGame.hbX || liveGame.lastSeenX || 0) : (liveGame.hbO || liveGame.lastSeenO || 0);
          if (liveOppHb && liveOppHb !== lastKnownOpponentHeartbeatVal) {
            // Opponent actually reported in Firestore! Update local time and cancel forfeit
            lastKnownOpponentHeartbeatVal = liveOppHb;
            lastOpponentActivityLocalTime = Date.now();
            forfeitProcessed = false;
            return;
          }

          const patch: Partial<GameState> = {
            status: 'finished',
            winner: ctx.me!,
            gaveUp: oppRole,
            forfeitReason: 'disconnect',
            forfeitBy: oppUid,
            forfeitRole: oppRole,
            winnerUid: myId || '',
            finishedAt: Date.now()
          };
          if (ctx.me === 'X') patch.wx = (liveGame.wx || 0) + 1;
          else patch.wo = (liveGame.wo || 0) + 1;
          tx.update(ref, patch);
        }).catch(function (e) {
          console.warn('Forfeit transaction error:', e);
          forfeitProcessed = false;
        });
      } else if (silenceMs >= WARNING_THRESHOLD_MS) {
        const remSec = Math.max(1, Math.ceil((GRACE_PERIOD_MS - silenceMs) / 1000));
        showTip('⚠️ Opponent connection unstable. Reconnecting… (' + remSec + 's)');
      } else if (tipText && tipText.includes('Opponent connection unstable')) {
        showTip('');
      }
    }, 1000);

    unsub = onSnapshot(ref, function (snap) {
      if (ref !== gameRef) return;
      clearTimeout(loadTimer);
      if (!snap.exists()) {
        lsSet('ttt-last', '');
        leave();
        showMsg('That game no longer exists.');
        return;
      }
      const first = !G, prev = G;
      G = Object.assign({}, snap.data() as GameState);
      if ((G.size || 15) !== N) setSize(G.size || 15);
      if (tipText && !first && !tipText.includes('Opponent connection unstable')) showTip('');

      if (prev && G.round === prev.round && G.n === prev.n + 1 && G.board === prev.board && !G.winner && G.turn !== prev.turn) {
        flash("Time's up! " + prev.turn + "'s turn was skipped.");
        sfx('buzz');
      }
      if (prev && G.round === prev.round && G.n === prev.n + 1 && G.board !== prev.board && G.last >= 0) {
        sfx(G.board.charAt(G.last) as 'X' | 'O');
        if (G.winner) sfx(endKind(G.winner), 0.25);
      }
      if (prev && !prev.winner && G.winner && G.gaveUp && G.board === prev.board) sfx('win');

      ctx.me = G.x === myId ? 'X' : (G.o === myId ? 'O' : null);

      // Track live opponent activity locally without cross-device clock skew
      const bothPresent = !!(G.x && G.o && G.status === 'playing' && !G.winner);
      const oppRole = ctx.me === 'X' ? 'O' : (ctx.me === 'O' ? 'X' : null);

      if (bothPresent && oppRole) {
        const oppHb = oppRole === 'X' ? (G.hbX || G.lastSeenX || 0) : (G.hbO || G.lastSeenO || 0);

        if (!matchHandshakeConfirmed) {
          matchHandshakeConfirmed = true;
          matchStartTime = Date.now();
          lastOpponentActivityLocalTime = Date.now();
          lastKnownOpponentHeartbeatVal = oppHb;
          // Pulse an immediate handshake acknowledgement heartbeat
          if (ctx.me && myId && !G.winner) {
            const now = Date.now();
            const ackField = ctx.me === 'X'
              ? { lastSeenX: now, hbX: now, activeX: true }
              : { lastSeenO: now, hbO: now, activeO: true };
            updateDoc(ref, ackField).catch(function () {});
          }
        } else {
          // If opponent made a move, or opponent heartbeat counter updated:
          const oppMoved = prev && G.n > prev.n && G.board !== prev.board;
          if (oppMoved || (oppHb && oppHb !== lastKnownOpponentHeartbeatVal)) {
            lastKnownOpponentHeartbeatVal = oppHb;
            lastOpponentActivityLocalTime = Date.now();
            if (tipText && tipText.includes('Opponent connection unstable')) showTip('');
          }
        }
      }

      if (sel >= 0 && (G.board[sel] !== '.' || !canMoveNow())) sel = -1;
      if (first) {
        renderedN = G.n;
        if (G.winner) winKey = winKeyNow();
      }
      render();
      syncNames();

      if (!ctx.me && !G.o && myId && G.x !== myId) {
        claimSeat();
      }
    }, function (e) {
      showTip(e && e.code === 'permission-denied' ? 'Access to this room ended.' : 'Lost connection to the game.');
    });
  }

  function claimSeat() {
    if (claiming || claimTries >= 3 || canWrite === false || !myId || !gameRef) return;
    claiming = true; claimTries++;
    const ref = gameRef, code = ctx.code;
    const seat = doc(db, 'games', code, 'seats', 'o');

    runTransaction(db, async function (tx) {
      const snaps = await Promise.all([tx.get(ref), tx.get(seat)]);
      const gameSnap = snaps[0], seatSnap = snaps[1];
      if (!gameSnap.exists()) throw new Error('ROOM_NOT_FOUND');
      const game = (gameSnap.data() || {}) as GameState;
      const owner = seatSnap.exists() ? (seatSnap.data() || {}).owner : '';

      if (game.o && game.o !== myId) throw new Error('ROOM_FULL');
      if (owner && owner !== myId) throw new Error('ROOM_FULL');

      const now = Date.now();
      tx.set(seat, { owner: myId, joinedAt: now });
      tx.update(ref, {
        o: myId,
        so: symPick.O,
        status: 'playing',
        activeO: true,
        lastSeenO: now,
        hbO: now,
        startedAt: now
      });
      return true;
    }).then(function (ok) {
      claiming = false;
      if (!ok && ref === gameRef && G && !G.o && claimTries < 3) {
        setTimeout(function () { if (ref === gameRef && G && !G.o && !ctx.me) claimSeat(); }, 1500);
      }
    }).catch(function (e) {
      claiming = false;
      if (e?.message === 'ROOM_FULL') {
        leave();
        showMsg('This room is full (2 players are already playing). Cannot join as a third player.');
      } else {
        showTip(writeError(e));
      }
    });
  }

  function syncNames() {
    if (!user || !G) return;
    const key = G.x + '|' + G.o;
    if (key === namesKey) return;
    namesKey = key;
    const ids: string[] = [];
    if (G.x) ids.push(G.x);
    if (G.o) ids.push(G.o);
    if (!ids.length) return;
    fetchProfiles(ids).then(function (ps) {
      if (!G) return;
      names.X = (G.x && ps[G.x] && ps[G.x].name) || '';
      names.O = (G.o && ps[G.o] && ps[G.o].name) || '';
      render();
    });
  }

  function fetchProfiles(ids: string[]): Promise<Record<string, any>> {
    const out: Record<string, any> = {};
    return Promise.all(ids.map(function (id) {
      return getDoc(doc(db, 'profiles', id)).then(function (snap) {
        if (snap.exists()) out[id] = snap.data() || {};
      });
    })).then(function () { return out; });
  }

  async function createGame() {
    showMsg('');
    if (!myId || !db) {
      showMsg('Connecting to online services... please wait a moment.');
      return;
    }
    const createBtn = $('create');
    if (createBtn) createBtn.disabled = true;

    let code = '';
    let tries = 0;
    try {
      while (tries < 10) {
        tries++;
        const candidate = randCode();
        const gRef = doc(db, 'games', candidate);

        const created = await runTransaction(db, async (tx) => {
          const snap = await tx.get(gRef);
          if (snap.exists()) return false;

          const now = Date.now();
          setSize(sizeSel);
          curMode = effMode('online');
          const data = newGame(myId!, '', modeTl(), sizeSel);
          data.code = candidate;
          data.sx = symPick.X;
          data.created = now;
          data.lastSeenX = now;
          data.hbX = 1;
          data.activeX = true;
          data.lastSeenO = 0;
          data.hbO = 0;
          data.activeO = false;
          data.status = 'waiting';

          tx.set(gRef, data);
          return true;
        });

        if (created) {
          code = candidate;
          break;
        }
      }

      if (!code) {
        throw new Error('Could not reserve a unique 6-character room code. Please try again.');
      }

      openOnline(code);
    } catch (e: any) {
      showMsg(writeError(e));
    } finally {
      if (createBtn) createBtn.disabled = !(db && myId && canWrite !== false);
    }
  }

  async function joinCode(code: string) {
    showMsg('');
    code = (code || '').toUpperCase().trim();

    if (!CODE_RE.test(code)) {
      showMsg('Invalid room code "' + code + '". Room codes must be exactly 6 letters or numbers (e.g. K7QZ2M).');
      return;
    }
    if (!db || !myId) {
      showMsg('Connecting to online services... please wait a moment.');
      return;
    }

    const joinBtn = $('join-btn');
    if (joinBtn) joinBtn.disabled = true;

    try {
      const gRef = doc(db, 'games', code);
      const seatRef = doc(db, 'games', code, 'seats', 'o');

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(gRef);
        if (!snap.exists()) {
          throw new Error('ROOM_NOT_FOUND');
        }
        const g = snap.data() as GameState;

        if (g.created && Date.now() - g.created > 24 * 60 * 60 * 1000) {
          throw new Error('ROOM_EXPIRED');
        }

        const now = Date.now();
        if (g.x === myId) {
          tx.update(gRef, { lastSeenX: now, hbX: now, activeX: true });
          return;
        }

        if (g.o === myId) {
          tx.update(gRef, { lastSeenO: now, hbO: now, activeO: true });
          return;
        }

        if (g.o && g.o !== myId) {
          throw new Error('ROOM_FULL');
        }

        const seatSnap = await tx.get(seatRef);
        if (seatSnap.exists() && seatSnap.data().owner && seatSnap.data().owner !== myId) {
          throw new Error('ROOM_FULL');
        }

        tx.set(seatRef, { owner: myId, joinedAt: now });
        tx.update(gRef, {
          o: myId,
          so: symPick.O,
          status: 'playing',
          activeO: true,
          lastSeenO: now,
          hbO: now,
          startedAt: now
        });
      });

      openOnline(code);
    } catch (e: any) {
      if (e?.message === 'ROOM_NOT_FOUND') {
        showMsg('No game found with code "' + code + '". Check the 6-character code and try again.');
      } else if (e?.message === 'ROOM_EXPIRED') {
        showMsg('Room "' + code + '" has expired (created over 24 hours ago). Please ask the host to create a new game.');
      } else if (e?.message === 'ROOM_FULL') {
        showMsg('Room "' + code + '" already has 2 players. A third player cannot join.');
      } else {
        showMsg(writeError(e));
      }
    } finally {
      if (joinBtn) joinBtn.disabled = !(db && myId && canWrite !== false);
    }
  }

  function refreshResume() {
    const last = lsGet('ttt-last');
    const ok = !!(last && CODE_RE.test(last) && db && myId);
    const resBtn = $('resume');
    if (resBtn) {
      resBtn.hidden = !ok;
      if (ok) {
        const rc = $('resume-code');
        if (rc) rc.textContent = last;
      }
    }
  }

  /* ---------- Theme ---------- */
  let themeMode = 'auto';
  (function () {
    const t = lsGet('ttt-theme');
    if (t === 'light' || t === 'dark') themeMode = t;
    function apply() {
      const root = document.documentElement;
      if (themeMode === 'auto') root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', themeMode);
      const bs = document.querySelectorAll('#theme-seg button') as NodeListOf<HTMLButtonElement>;
      for (let i = 0; i < bs.length; i++) bs[i].setAttribute('aria-pressed', String(bs[i].dataset.mode === themeMode));
    }
    const bs = document.querySelectorAll('#theme-seg button') as NodeListOf<HTMLButtonElement>;
    for (let i = 0; i < bs.length; i++) {
      bs[i].addEventListener('click', function (this: HTMLButtonElement) {
        themeMode = this.dataset.mode || 'auto';
        lsSet('ttt-theme', themeMode);
        apply();
      });
    }
    apply();
  })();

  /* ---------- Web Audio Sound Effects ---------- */
  let sessionId = 0, lastTickSec = -1;
  let soundOn = lsGet('ttt-sound') !== 'off';
  let actx: AudioContext | null = null;
  function unlockAudio() {
    try {
      if (!actx) {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        if (AC) actx = new AC();
      }
      if (actx && actx.state === 'suspended') actx.resume();
    } catch (e) {}
  }
  function tone(freq: number, start: number, dur: number, type?: OscillatorType, vol?: number, slideTo?: number) {
    if (!soundOn || !actx || actx.state !== 'running') return;
    const t0 = actx.currentTime + start, o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.15, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }
  const SFX: Record<string, (d: number) => void> = {
    X: function (d) { tone(700, d, 0.09, 'square', 0.07, 420); tone(1050, d + 0.05, 0.07, 'square', 0.045); },
    O: function (d) { tone(330, d, 0.2, 'sine', 0.2, 250); tone(495, d + 0.04, 0.14, 'sine', 0.08); },
    tick: function (d) { tone(1000, d, 0.04, 'square', 0.05); },
    tickHigh: function (d) { tone(1500, d, 0.06, 'square', 0.07); },
    buzz: function (d) { tone(190, d, 0.35, 'sawtooth', 0.1, 120); tone(150, d + 0.14, 0.3, 'sawtooth', 0.09, 95); },
    pop: function (d) { tone(880, d, 0.08, 'triangle', 0.08, 1100); },
    win: function (d) { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, d + i * 0.11, 0.22, 'triangle', 0.12); }); },
    lose: function (d) { [392, 330, 262].forEach(function (f, i) { tone(f, d + i * 0.16, 0.26, 'sine', 0.12); }); },
    draw: function (d) { tone(440, d, 0.2, 'sine', 0.1); tone(440, d + 0.22, 0.2, 'sine', 0.1); }
  };
  function sfx(name: string, delay?: number) { try { if (SFX[name]) SFX[name](delay || 0); } catch (e) {} }
  function endKind(winner: string) {
    if (winner === 'D') return 'draw';
    if (ctx.kind === 'cpu') return winner === 'X' ? 'win' : 'lose';
    if (ctx.kind === 'online' && ctx.me) return winner === ctx.me ? 'win' : 'lose';
    return 'win';
  }
  function syncSnd() {
    const b = $('snd');
    if (!b) return;
    b.textContent = soundOn ? 'Sound on' : 'Sound off';
    b.setAttribute('aria-pressed', String(soundOn));
  }
  document.addEventListener('pointerdown', unlockAudio, { passive: true });
  document.addEventListener('keydown', unlockAudio);
  const sndBtn = $('snd');
  if (sndBtn) {
    sndBtn.addEventListener('click', function () {
      soundOn = !soundOn;
      lsSet('ttt-sound', soundOn ? 'on' : 'off');
      unlockAudio();
      syncSnd();
      if (soundOn) sfx('pop');
    });
  }
  syncSnd();

  /* ---------- Board size ---------- */
  let sizeSel = 15;
  (function () { const t = lsGet('ttt-size'); if (t && /^(3|4|5|7|15)$/.test(t)) sizeSel = +t; })();
  function updateSub() {
    const n = ctx.kind ? N : sizeSel, w = winFor(n);
    const sub = $('sub'); if (sub) sub.innerHTML = n + ' &times; ' + n + ' board &middot; ' + WORDS[w] + ' in a row wins';
    const sh = $('size-hint'); if (sh) sh.textContent = 'Get ' + w + ' in a row to win. Smaller boards finish faster.';
    const bs = document.querySelectorAll('#size-seg button') as NodeListOf<HTMLButtonElement>;
    for (let i = 0; i < bs.length; i++) bs[i].setAttribute('aria-pressed', String(+bs[i].dataset.n! === sizeSel));
  }
  (function () {
    const bs = document.querySelectorAll('#size-seg button') as NodeListOf<HTMLButtonElement>;
    for (let i = 0; i < bs.length; i++) bs[i].addEventListener('click', function (this: HTMLButtonElement) {
      sizeSel = +this.dataset.n!; lsSet('ttt-size', String(sizeSel)); updateSub();
    });
  })();

  /* ---------- Move timer ---------- */
  let timerSecs = 30;
  (function () { const t = lsGet('ttt-timer'); if (t !== null && /^(0|15|30|60)$/.test(t)) timerSecs = +t; })();
  let tKey = '', tStart = 0, skipDone = '';
  function timerKey() { return G ? [ctx.kind, ctx.code, G.round, G.n, G.winner, G.o ? 1 : 0].join(':') : ''; }
  function doSkip(k: string) {
    if (!G) return;
    skipDone = k;
    const skipped = G.turn, patch: Partial<GameState> = { turn: skipped === 'X' ? 'O' : 'X', n: G.n + 1 };
    sel = -1;
    G = Object.assign({}, G, patch);
    flash("Time's up! " + skipped + "'s turn was skipped.");
    sfx('buzz');
    render();
    if (ctx.kind === 'online') {
      const ref = gameRef!;
      enqueue(function () { return updateDoc(ref, patch); });
    } else {
      scheduleCpu();
    }
  }
  function tickTimer() {
    const box = $('timer');
    if (!box) return;
    if (!G || ctx.kind === null) { box.hidden = true; return; }
    const k = timerKey();
    if (k !== tKey) { tKey = k; tStart = Date.now(); skipDone = ''; lastTickSec = -1; }
    box.hidden = !(G.tl > 0);
    if (!(G.tl > 0)) return;
    box.classList.toggle('o', G.turn === 'O');
    const running = !G.winner && (ctx.kind !== 'online' || !!G.o) && !(ctx.kind === 'cpu' && G.turn === 'O');
    const tnum = $('tnum'), tbar = $('tbar');
    if (!running) {
      if (tnum) tnum.textContent = G.winner ? '' : '–';
      if (tbar) tbar.style.width = G.winner ? '0%' : '100%';
      box.classList.remove('low');
      return;
    }
    const rem = G.tl - (Date.now() - tStart) / 1000;
    if (tnum) tnum.textContent = Math.max(0, Math.ceil(rem)) + 's';
    if (tbar) tbar.style.width = Math.max(0, rem / G.tl * 100) + '%';
    box.classList.toggle('low', rem <= 8);
    const sec = Math.max(0, Math.ceil(rem));
    if (sec > 0 && sec <= 5 && sec !== lastTickSec && canMoveNow()) { lastTickSec = sec; sfx(sec <= 2 ? 'tickHigh' : 'tick'); }
    if (skipDone !== k) {
      if (canMoveNow() && rem <= 0) doSkip(k);
      else if (ctx.kind === 'online' && ctx.me && G.o && G.turn !== ctx.me && rem <= -6) doSkip(k);
    }
  }
  setInterval(tickTimer, 250);
  function syncTimerSeg() {
    const bs = document.querySelectorAll('#timer-seg button') as NodeListOf<HTMLButtonElement>;
    for (let i = 0; i < bs.length; i++) bs[i].setAttribute('aria-pressed', String(+bs[i].dataset.t! === timerSecs));
  }
  (function () {
    const bs = document.querySelectorAll('#timer-seg button') as NodeListOf<HTMLButtonElement>;
    for (let i = 0; i < bs.length; i++) {
      bs[i].addEventListener('click', function (this: HTMLButtonElement) {
        timerSecs = +this.dataset.t!;
        lsSet('ttt-timer', String(timerSecs));
        syncTimerSeg();
      });
    }
    syncTimerSeg();
  })();

  /* ---------- Win Dialog ---------- */
  function winKeyNow(): string { return ctx.kind + ':' + ctx.code + ':' + (G ? G.round : 0) + ':' + (G?.finishedAt || 0) + ':' + (G?.winner || ''); }
  function checkWin() {
    if (!G || !G.winner) return;
    const k = winKeyNow();
    if (winKey === k) return;
    winKey = k;

    const isForfeit = !!(G.forfeitReason || G.gaveUp);
    const wonByForfeit = ctx.kind === 'online' && isForfeit && G.winner === ctx.me;
    const lostByForfeit = ctx.kind === 'online' && isForfeit && G.winner !== ctx.me;

    const histResult = G.winner === 'D' ? 'Draw' : (
      wonByForfeit ? 'Victory by forfeit' : (
        lostByForfeit ? 'Defeat by forfeit' : (
          ctx.kind === 'cpu' ? (G.winner === 'X' ? 'Win' : 'Loss') : (
            ctx.kind === 'online' ? (G.winner === ctx.me ? 'Win' : 'Loss') : 'Player ' + G.winner + ' won'
          )
        )
      )
    );

    M.history.unshift({
      date: new Date().toLocaleString(),
      mode: G.mode || 'classic',
      size: N,
      result: histResult,
      moves: moveLog.length,
      log: moveLog.slice(0, 250).map(function (m) { return { mark: m.mark, index: m.index }; })
    });
    M.history = M.history.slice(0, 30);
    saveM();
    syncToCloud(true);

    if (G.winner === 'D') return;

    let award = false, sub = '';
    const extra = onRound();
    if (ctx.kind === 'cpu') {
      award = G.winner === 'X'; sub = 'You beat the computer.'; if (!award) return;
    } else if (ctx.kind === 'online') {
      if (wonByForfeit) {
        award = true;
        sub = G.forfeitReason === 'disconnect' ? 'Opponent disconnected. Victory by forfeit.' : 'Opponent exited the game. Victory by forfeit.';
      } else if (lostByForfeit) {
        award = false;
        return; // Leaver or disconnected player receives no win award
      } else {
        award = !!ctx.me && G.winner === ctx.me;
        sub = G.gaveUp ? 'Your friend gave up.' : 'You won this round.';
        if (!award) return;
      }
    } else {
      // Pass & Play (two players on same device) / Local multiplayer / Practice:
      // STRICTLY NO GAMEPLAY POINTS, COINS, XP OR MATCH REWARDS!
      award = false;
      sub = G.gaveUp ? 'Player ' + G.gaveUp + ' gave up. Player ' + G.winner + ' wins.' : 'Player ' + G.winner + ' wins this round.';
    }

    if (award && isEligibleRewardMode()) changePoints(WIN_POINTS);

    const winTitle = $('win-title');
    const winBadge = $('win-badge-forfeit');
    const winStatus = $('win-status');
    const winSub = $('win-sub');
    const winAgain = $('win-again');
    const winLobbyBtn = $('win-lobby');

    if (wonByForfeit) {
      if (winTitle) winTitle.textContent = 'YOU WIN!';
      if (winBadge) winBadge.hidden = false;
      if (winStatus) winStatus.textContent = G.forfeitReason === 'disconnect' ? 'Opponent disconnected' : 'Opponent exited the game';
      if (winSub) winSub.textContent = G.forfeitReason === 'disconnect' ? 'Victory by forfeit · Full reward awarded' : 'Opponent exited the game · Victory by forfeit';
      if (winAgain) winAgain.hidden = true;
      if (winLobbyBtn) {
        winLobbyBtn.classList.add('primary');
        winLobbyBtn.textContent = 'Return to Lobby';
      }
    } else {
      if (winTitle) winTitle.textContent = 'Congratulations!';
      if (winBadge) winBadge.hidden = true;
      if (winStatus) winStatus.textContent = '';
      if (winSub) winSub.textContent = (sub + ' ' + extra).trim();
      if (winAgain) {
        winAgain.hidden = false;
        winAgain.textContent = getRematchButtonText();
      }
      if (winLobbyBtn) {
        winLobbyBtn.classList.remove('primary');
        winLobbyBtn.textContent = 'Lobby';
      }
    }

    const winEarn = $('win-earn');
    if (winEarn) {
      if (isEligibleRewardMode() && award) {
        winEarn.textContent = '+' + WIN_POINTS + ' coins added to your wallet · Total ' + points;
        winEarn.hidden = false;
      } else if (ctx.kind === 'local') {
        winEarn.textContent = 'Pass and Play match · No gameplay points or rewards earned';
        winEarn.hidden = false;
      } else {
        winEarn.textContent = '';
        winEarn.hidden = true;
      }
    }

    const sid = sessionId;
    setTimeout(function () {
      if (sid !== sessionId || !G || !G.winner) return;
      const winDlg = $('win') as HTMLDialogElement | null;
      if (winDlg && winDlg.open) return;
      const cf = $('confetti');
      if (cf) {
        cf.innerHTML = '';
        const cols = ['var(--x)', 'var(--o)', 'var(--gold)'];
        for (let i = 0; i < 28; i++) {
          const c = document.createElement('i');
          c.style.left = (Math.random() * 100) + '%';
          c.style.background = cols[i % 3];
          c.style.animationDelay = (Math.random() * 0.6) + 's';
          cf.appendChild(c);
        }
      }
      if (winDlg) winDlg.showModal();
    }, 700);
  }

  /* ---------- In-Game Chat & Reactions ---------- */
  interface ChatDoc {
    id: string;
    from: string;
    kind: 'react' | 'msg';
    text: string;
    t: number;
  }

  let chatUnsub: Unsubscribe | null = null;
  let chatDocs: ChatDoc[] = [];
  const chatSeen: Record<string, number> = {};
  let chatFirst = true;
  const chatNames: Record<string, string> = {};
  let lastSend = 0;

  function chatReset() {
    if (chatUnsub) { try { chatUnsub(); } catch (e) {} chatUnsub = null; }
    chatDocs = [];
    chatFirst = true;
    const ul = $('msgs'); if (ul) ul.innerHTML = '';
  }

  function chatStart(code: string) {
    chatReset();
    renderChat();
    const chatColl = collection(db, 'games', code, 'chat');
    const q = query(chatColl, orderBy('t', 'desc'), limit(60));

    chatUnsub = onSnapshot(q, function (snap) {
      if (ctx.kind !== 'online' || ctx.code !== code) return;
      const docs = snap.docs.map(function (d) {
        const v = d.data() || {};
        const text = String(v.text || '').slice(0, 200);
        return {
          id: d.id,
          from: String(v.from || ''),
          kind: (v.kind === 'react' && isReaction(text) ? 'react' : 'msg') as 'react' | 'msg',
          text: text,
          t: +v.t || 0
        };
      });

      docs.forEach(function (d) {
        if (chatSeen[d.id]) return;
        chatSeen[d.id] = 1;
        if (chatFirst || Math.abs(Date.now() - d.t) >= 15000) return;
        if (d.kind === 'react') floatEmoji(d.text);
        if (d.from !== myId) sfx('pop');
      });

      chatFirst = false;
      chatDocs = docs.reverse();
      ensureChatNames(chatDocs);
      renderChat();
    }, function () {});
  }

  function ensureChatNames(docs: ChatDoc[]) {
    if (!user) return;
    const need: string[] = [];
    docs.forEach(function (d) {
      if (d.from && d.from !== myId && chatNames[d.from] === undefined && need.indexOf(d.from) < 0) need.push(d.from);
    });
    if (!need.length) return;
    need.forEach(function (id) { chatNames[id] = ''; });
    fetchProfiles(need).then(function (ps) {
      need.forEach(function (id) { chatNames[id] = (ps[id] && ps[id].name) || ''; });
      renderChat();
    });
  }

  function renderChat() {
    const ul = $('msgs');
    if (!ul) return;
    ul.innerHTML = '';
    if (!chatDocs.length) {
      const e = document.createElement('li');
      e.className = 'empty';
      e.textContent = 'No messages yet. Say hello or send a reaction.';
      ul.appendChild(e);
      return;
    }
    chatDocs.forEach(function (d) {
      const li = document.createElement('li');
      const mine = ctx.kind === 'online' ? d.from === myId : (ctx.kind === 'local' ? d.from === 'pX' : d.from === 'me');
      li.className = (mine ? 'mine' : '') + (d.kind === 'react' ? ' em' : '');
      const who = document.createElement('span');
      who.className = 'who';
      who.textContent = ctx.kind === 'online'
        ? (mine ? 'You' : (chatNames[d.from] || 'Friend'))
        : (d.from === 'cpu' ? 'Computer' : d.from === 'me' ? 'You' : 'Player ' + d.from.charAt(1));
      const tx = document.createElement('span');
      tx.textContent = d.text;
      li.appendChild(who);
      li.appendChild(tx);
      ul.appendChild(li);
    });
    ul.scrollTop = ul.scrollHeight;
  }

  const FX: Record<string, [string, string[], string]> = {
    '😂': ['laugh', ['ha!', 'haha', '😆'], 'rise'], '😢': ['cry', ['💧'], 'fall'], '😮': ['wow', ['❗'], 'burst'],
    '🔥': ['fire', ['🔥', '✨'], 'rise'], '👍': ['thumb', ['✨'], 'burst'], '👏': ['clap', ['✨'], 'burst'], '🙌': ['clap', ['✨'], 'burst'],
    '😍': ['love', ['❤️', '💖'], 'rise'], '🤩': ['spin', ['⭐'], 'burst'], '🥳': ['spin', ['🎊', '🎉', '✨'], 'burst'], '🎉': ['spin', ['🎊', '✨'], 'burst'],
    '😎': ['drop', ['✨'], 'burst'], '😈': ['shake', ['🔥'], 'rise'], '🥶': ['shiver', ['❄️'], 'fall'], '🥵': ['pulse', ['💦'], 'fall'],
    '🤯': ['wow', ['💥'], 'burst'], '🚀': ['launch', ['💨'], 'fall'], '💯': ['pulse', ['✨'], 'burst'], '💪': ['thumb', ['💥'], 'burst'],
    '🤫': ['shake', [], ''], '🙈': ['shake', [], ''], '😅': ['cry', ['💧'], 'fall'], '🤔': ['shake', ['❓'], 'rise'], '🎯': ['wow', ['✨'], 'burst'],
    '👑': ['drop', ['✨'], 'burst'], '💎': ['spin', ['✨'], 'burst'], '🏆': ['thumb', ['✨', '🎊'], 'burst'], '🐉': ['fire', ['🔥'], 'rise'],
    '🦁': ['wow', ['💢'], 'burst'], '🐺': ['wow', ['💢'], 'burst'], '☄️': ['launch', ['🔥'], 'fall'], '🎆': ['wow', ['🎇', '✨'], 'burst']
  };

  function floatEmoji(e: string) {
    const fx = FX[e] || (PRICE[e] >= 30 ? ['bounce', ['✨'], 'burst'] : ['bounce', [], '']);
    const f = document.createElement('span');
    f.className = 'float';
    f.style.left = (8 + Math.random() * 78) + '%';
    const inner = document.createElement('span');
    inner.className = 'fe fx-' + fx[0];
    inner.textContent = e;
    f.appendChild(inner);
    for (let i = 0; fx[2] && i < 6; i++) {
      const p = document.createElement('span'), txt = fx[1][i % fx[1].length];
      let dx = 0, dy = 0;
      p.className = 'fp' + (/^[a-z!]+$/i.test(txt) ? ' t' : '');
      p.textContent = txt;
      if (fx[2] === 'burst') {
        const ang = Math.random() * 6.283, rad = 50 + Math.random() * 40;
        dx = Math.cos(ang) * rad; dy = Math.sin(ang) * rad;
      } else {
        dx = (Math.random() - 0.5) * 70;
        dy = (fx[2] === 'rise' ? -1 : 1) * (60 + Math.random() * 60);
      }
      p.style.setProperty('--dx', dx + 'px');
      p.style.setProperty('--dy', dy + 'px');
      p.style.animationDelay = (fx[2] === 'burst' ? 0.1 : Math.random() * 0.9) + 's';
      f.appendChild(p);
    }
    const floats = $('floats');
    if (floats) floats.appendChild(f);
    setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 2600);
  }

  let localSeq = 0;
  function localChat(from: string, kind: 'react' | 'msg', text: string) {
    chatDocs.push({ id: 'l' + (++localSeq), from: from, kind: kind, text: text, t: Date.now() });
    if (chatDocs.length > 60) chatDocs = chatDocs.slice(-60);
    renderChat();
  }

  const CPU_LINES = ['Nice move.', 'Hmm, tricky one.', 'I see what you did there.', 'Think fast!', 'Good luck!'];
  function cpuSay(kind: 'react' | 'msg', text: string, delay: number) {
    const sid = sessionId;
    setTimeout(function () {
      if (sid !== sessionId || ctx.kind !== 'cpu') return;
      localChat('cpu', kind, text);
      if (kind === 'react') floatEmoji(text);
      sfx('pop');
    }, delay);
  }

  function cpuReply(kind: 'react' | 'msg') {
    if (Math.random() > 0.55) return;
    if (kind === 'react') cpuSay('react', EMOJIS[Math.floor(Math.random() * EMOJIS.length)][0], 900);
    else cpuSay('msg', CPU_LINES[Math.floor(Math.random() * CPU_LINES.length)], 1200);
  }

  function cpuEndReact(winner: string) {
    if (ctx.kind !== 'cpu') return;
    cpuSay('react', winner === 'O' ? '😂' : winner === 'X' ? '👏' : '😮', 700);
  }

  function sendChat(kind: 'react' | 'msg', text: string, cost?: number): boolean {
    cost = cost || 0;
    if (!ctx.kind) return false;
    if (kind === 'react' && !canUse(text)) return false;
    if (cost > points) return false;
    const now = Date.now();
    if (now - lastSend < 700) return false;

    if (ctx.kind === 'online') {
      if (!db || !myId) return false;
      lastSend = now;
      if (cost) changePoints(-cost);
      addDoc(collection(db, 'games', ctx.code, 'chat'), {
        from: myId,
        kind: kind,
        text: text,
        t: now
      }).catch(function (e) {
        if (cost) changePoints(cost);
        showTip(writeError(e));
      });
      sfx('pop');
      return true;
    }

    lastSend = now;
    if (cost) changePoints(-cost);
    localChat(ctx.kind === 'cpu' ? 'me' : 'p' + (G ? G.turn : 'X'), kind, text);
    if (kind === 'react') floatEmoji(text);
    sfx('pop');
    if (ctx.kind === 'cpu') cpuReply(kind);
    return true;
  }

  /* ---------- Real Player-to-Player WebRTC Voice Chat ---------- */
  const RTC_CONFIG: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.services.mozilla.com' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ],
    iceCandidatePoolSize: 10
  };

  let pc: RTCPeerConnection | null = null;
  let localVoiceStream: MediaStream | null = null;
  let remoteVoiceStream: MediaStream | null = null;
  let voiceAudioCtx: AudioContext | null = null;
  let localVoiceAnalyser: AnalyserNode | null = null;
  let voiceAnimId: number | null = null;
  let voiceUnsubs: Unsubscribe[] = [];
  let isVoiceActive = false;
  let isVoiceMuted = false;
  let isVoiceSpeakerOn = true;
  let currentCallId = '';
  let pendingRemoteCandidates: RTCIceCandidateInit[] = [];
  let seenCandidateIds = new Set<string>();
  let voiceRoomCode = '';
  let oppVoiceMember: any = null;
  let isNegotiating = false;

  function updateVoiceUI(status: 'idle' | 'connecting' | 'waiting' | 'connected' | 'denied' | 'failed', message?: string) {
    const iconEl = $('voice-status-icon');
    const textEl = $('voice-status-text');
    const btnJoin = $('voice-btn-join');
    const rowInCall = $('voice-in-call-row');
    const badgesBox = $('voice-badges');
    const muteIcon = $('voice-mute-icon');
    const muteLabel = $('voice-mute-label');
    const spkIcon = $('voice-speaker-icon');
    const spkLabel = $('voice-speaker-label');

    if (iconEl) {
      if (status === 'connected') iconEl.textContent = '🟢';
      else if (status === 'connecting') iconEl.textContent = '🔄';
      else if (status === 'waiting') iconEl.textContent = '⏳';
      else if (status === 'denied') iconEl.textContent = '🚫';
      else if (status === 'failed') iconEl.textContent = '⚠️';
      else iconEl.textContent = '🎙️';
    }

    if (textEl) {
      textEl.className = 'voice-status ' + status;
      if (message) {
        textEl.textContent = message;
      } else if (status === 'connected') {
        textEl.textContent = 'Connected (Live Audio)';
      } else if (status === 'connecting') {
        textEl.textContent = 'Connecting audio…';
      } else if (status === 'waiting') {
        textEl.textContent = 'Waiting for opponent to join voice…';
      } else if (status === 'denied') {
        textEl.textContent = 'Microphone permission denied';
      } else if (status === 'failed') {
        textEl.textContent = 'Connection failed';
      } else {
        textEl.textContent = oppVoiceMember ? 'Opponent in voice! Ready to join' : 'Ready to join';
      }
    }

    if (btnJoin) btnJoin.hidden = isVoiceActive;
    if (rowInCall) rowInCall.hidden = !isVoiceActive;
    if (badgesBox) badgesBox.hidden = !isVoiceActive && !oppVoiceMember;

    if (muteIcon) muteIcon.textContent = isVoiceMuted ? '🔇' : '🎙️';
    if (muteLabel) muteLabel.textContent = isVoiceMuted ? 'Unmute' : 'Mute';

    if (spkIcon) spkIcon.textContent = isVoiceSpeakerOn ? '🔊' : '🔈';
    if (spkLabel) spkLabel.textContent = isVoiceSpeakerOn ? 'Speaker On' : 'Speaker Off';

    const meBadge = $('voice-badge-me');
    const meState = $('voice-state-me');
    if (meBadge && meState) {
      if (isVoiceActive) {
        meState.textContent = isVoiceMuted ? 'Muted' : 'Speaking';
        if (isVoiceMuted) meBadge.classList.add('muted');
        else meBadge.classList.remove('muted');
      }
    }

    const oppBadge = $('voice-badge-opp');
    const oppName = $('voice-name-opp');
    const oppState = $('voice-state-opp');
    if (oppBadge && oppState) {
      if (oppVoiceMember) {
        if (oppName) oppName.textContent = esc(oppVoiceMember.name || 'Opponent');
        oppState.textContent = oppVoiceMember.muted ? 'Muted' : (status === 'connected' ? 'Live' : 'Joined');
        if (oppVoiceMember.muted) oppBadge.classList.add('muted');
        else oppBadge.classList.remove('muted');
      } else {
        if (oppName) oppName.textContent = 'Opponent';
        oppState.textContent = 'Offline';
        oppBadge.classList.remove('muted', 'speaking');
      }
    }
  }

  function playRemoteAudio(): Promise<void> {
    const audioEl = $('voice-remote-audio') as HTMLAudioElement | null;
    const banner = $('voice-audio-unblock-banner');
    if (!audioEl) return Promise.resolve();

    audioEl.muted = !isVoiceSpeakerOn;
    audioEl.volume = 1.0;
    audioEl.setAttribute('playsinline', 'true');
    audioEl.autoplay = true;

    if (!audioEl.srcObject && remoteVoiceStream) {
      audioEl.srcObject = remoteVoiceStream;
    }

    if (!remoteVoiceStream) {
      return Promise.resolve();
    }

    return audioEl.play().then(function () {
      console.log('[WebRTC Audio] Remote playback active. volume=' + audioEl.volume + ' muted=' + audioEl.muted);
      if (banner) banner.hidden = true;
    }).catch(function (err) {
      console.warn('[WebRTC Audio] Playback prevented by browser autoplay policy:', err);
      if (banner && isVoiceActive) banner.hidden = false;
    });
  }

  function startVoiceActivityMonitoring() {
    if (voiceAnimId) cancelAnimationFrame(voiceAnimId);

    const localBadge = $('voice-badge-me');
    const remoteBadge = $('voice-badge-opp');
    const localData = new Uint8Array(32);
    let lastStatsTime = 0;

    function check(now: number) {
      if (!isVoiceActive && !oppVoiceMember) return;

      // Local microphone visualizer via local AnalyserNode
      if (localVoiceAnalyser && isVoiceActive && !isVoiceMuted) {
        localVoiceAnalyser.getByteFrequencyData(localData);
        let sum = 0;
        for (let i = 0; i < localData.length; i++) sum += localData[i];
        const avg = sum / localData.length;
        if (localBadge) {
          if (avg > 14) localBadge.classList.add('speaking');
          else localBadge.classList.remove('speaking');
        }
      } else if (localBadge) {
        localBadge.classList.remove('speaking');
      }

      // Remote incoming audio volume via standard W3C WebRTC statistics
      // Does NOT consume or hijack the audio stream in Chromium!
      if (pc && isVoiceSpeakerOn && pc.connectionState === 'connected' && (now - lastStatsTime > 200)) {
        lastStatsTime = now;
        pc.getStats().then(function (stats) {
          let isSpeaking = false;
          stats.forEach(function (report) {
            if (report.type === 'inbound-rtp' && report.kind === 'audio') {
              const level = report.audioLevel;
              if (typeof level === 'number' && level > 0.02) {
                isSpeaking = true;
              }
            }
          });
          if (remoteBadge) {
            if (isSpeaking && (!oppVoiceMember || !oppVoiceMember.muted)) {
              remoteBadge.classList.add('speaking');
            } else {
              remoteBadge.classList.remove('speaking');
            }
          }
        }).catch(function () {});
      }

      voiceAnimId = requestAnimationFrame(check);
    }

    voiceAnimId = requestAnimationFrame(check);
  }

  function voiceInitPresence(code: string) {
    voiceRoomCode = code;
    const membersRef = collection(db, 'games', code, 'voice_members');
    const u = onSnapshot(membersRef, function (snap) {
      if (ctx.kind !== 'online' || ctx.code !== code) return;
      let foundOpp: any = null;
      snap.docs.forEach(function (d) {
        const v = d.data();
        if (v.uid !== myId) {
          foundOpp = v;
        }
      });
      oppVoiceMember = foundOpp;

      if (isVoiceActive) {
        if (oppVoiceMember) {
          if (!pc || pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            startWebRTCNegotiation(code);
          } else {
            updateVoiceUI(pc.connectionState === 'connected' ? 'connected' : 'connecting');
          }
        } else {
          if (pc) {
            try { pc.close(); } catch (e) {}
            pc = null;
          }
          updateVoiceUI('waiting', 'Waiting for opponent to join voice…');
        }
      } else {
        updateVoiceUI('idle');
      }
    }, function (err) {
      console.warn('[WebRTC] Voice members listener error:', err);
    });
    voiceUnsubs.push(u);
  }

  async function drainPendingCandidates() {
    if (!pc) return;
    while (pendingRemoteCandidates.length > 0) {
      const cand = pendingRemoteCandidates.shift();
      if (cand) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
          console.log('[WebRTC] Drained pending remote candidate successfully');
        } catch (e) {
          console.warn('[WebRTC] Drain pending candidate error:', e);
        }
      }
    }
  }

  async function startWebRTCNegotiation(code: string) {
    if (isNegotiating || !isVoiceActive) return;
    isNegotiating = true;
    updateVoiceUI('connecting', 'Connecting audio…');

    try {
      if (pc) {
        console.log('[WebRTC] Closing existing peer connection before starting negotiation');
        try { pc.close(); } catch (e) {}
        pc = null;
      }
      pendingRemoteCandidates = [];
      seenCandidateIds.clear();

      console.log('[WebRTC] Initializing new RTCPeerConnection with STUN servers');
      pc = new RTCPeerConnection(RTC_CONFIG);

      // Add local audio tracks to peer connection
      if (localVoiceStream) {
        const audioTracks = localVoiceStream.getAudioTracks();
        console.log('[WebRTC] Found ' + audioTracks.length + ' local audio track(s)');
        audioTracks.forEach(function (track) {
          track.enabled = !isVoiceMuted;
          console.log('[WebRTC Local Track] id=' + track.id + ' label=' + track.label + ' readyState=' + track.readyState + ' enabled=' + track.enabled);
          if (pc && localVoiceStream) {
            const sender = pc.addTrack(track, localVoiceStream);
            console.log('[WebRTC] Track added to sender:', sender);
          }
        });
      } else {
        console.warn('[WebRTC] localVoiceStream is missing when starting negotiation!');
      }

      // Handle remote incoming audio tracks
      pc.ontrack = function (event) {
        console.log('[WebRTC Remote Track] ontrack event fired! kind=' + event.track.kind + ' id=' + event.track.id + ' readyState=' + event.track.readyState);
        event.track.enabled = true;
        event.track.onmute = function () {
          console.log('[WebRTC Remote Track] Remote track muted');
        };
        event.track.onunmute = function () {
          console.log('[WebRTC Remote Track] Remote track unmuted');
          playRemoteAudio();
        };
        event.track.onended = function () {
          console.log('[WebRTC Remote Track] Remote track ended');
        };

        const stream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([event.track]);
        remoteVoiceStream = stream;

        const audioEl = $('voice-remote-audio') as HTMLAudioElement | null;
        if (audioEl) {
          audioEl.srcObject = remoteVoiceStream;
          audioEl.muted = !isVoiceSpeakerOn;
          audioEl.volume = 1.0;
          audioEl.autoplay = true;
          audioEl.setAttribute('playsinline', 'true');
          playRemoteAudio();
        }
      };

      // Handle local ICE candidates
      pc.onicecandidate = function (event) {
        if (event.candidate && myId && voiceRoomCode) {
          const c = event.candidate;
          console.log('[WebRTC ICE] Gathered local candidate: type=' + c.type + ' proto=' + c.protocol + ' ' + c.address + ':' + c.port);
          addDoc(collection(db, 'games', voiceRoomCode, 'voice_candidates'), {
            callId: currentCallId,
            from: myId,
            candidate: JSON.stringify(c.toJSON()),
            timestamp: Date.now()
          }).catch(function (e) {
            console.warn('[WebRTC ICE] Candidate save error:', e);
          });
        }
      };

      pc.onsignalingstatechange = function () {
        if (!pc) return;
        console.log('[WebRTC State] signalingState -> ' + pc.signalingState);
      };

      pc.onicegatheringstatechange = function () {
        if (!pc) return;
        console.log('[WebRTC State] iceGatheringState -> ' + pc.iceGatheringState);
      };

      pc.oniceconnectionstatechange = function () {
        if (!pc) return;
        const s = pc.iceConnectionState;
        console.log('[WebRTC State] iceConnectionState -> ' + s);
        if (s === 'connected' || s === 'completed') {
          updateVoiceUI('connected', 'Connected (Live Audio)');
          playRemoteAudio();
        } else if (s === 'failed' || s === 'disconnected') {
          console.warn('[WebRTC State] ICE connection state issue: ' + s);
        }
      };

      pc.onconnectionstatechange = function () {
        if (!pc) return;
        const s = pc.connectionState;
        console.log('[WebRTC State] connectionState -> ' + s);
        if (s === 'connected') {
          updateVoiceUI('connected', 'Connected (Live Audio)');
          toast('🎙️ Voice chat connected! You can now speak with your opponent.');
          playRemoteAudio();
        } else if (s === 'connecting') {
          updateVoiceUI('connecting', 'Connecting audio…');
        } else if (s === 'disconnected') {
          updateVoiceUI('connecting', 'Reconnecting audio…');
        } else if (s === 'failed') {
          updateVoiceUI('failed', 'Voice connection lost. Retrying…');
          setTimeout(function () {
            if (isVoiceActive && oppVoiceMember) startWebRTCNegotiation(code);
          }, 2000);
        }
      };

      // Listen to remote ICE candidates
      const candColl = collection(db, 'games', code, 'voice_candidates');
      const candUnsub = onSnapshot(candColl, function (snap) {
        snap.docChanges().forEach(function (change) {
          if (change.type === 'added') {
            const docId = change.doc.id;
            if (seenCandidateIds.has(docId)) return;
            seenCandidateIds.add(docId);

            const data = change.doc.data();
            if (data.from !== myId && data.candidate) {
              if (!data.callId || !currentCallId || data.callId === currentCallId) {
                try {
                  const candInit = JSON.parse(data.candidate);
                  if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                    pc.addIceCandidate(new RTCIceCandidate(candInit)).then(function () {
                      console.log('[WebRTC ICE] Remote candidate applied: ' + candInit.candidate);
                    }).catch(function (e) {
                      console.warn('[WebRTC ICE] addIceCandidate error:', e);
                    });
                  } else {
                    console.log('[WebRTC ICE] Queuing remote candidate until remoteDescription is set: ' + candInit.candidate);
                    pendingRemoteCandidates.push(candInit);
                  }
                } catch (candErr) {
                  console.warn('[WebRTC ICE] Candidate parse error:', candErr);
                }
              }
            }
          }
        });
      }, function (err) {
        console.warn('[WebRTC ICE] Candidate listener error:', err);
      });
      voiceUnsubs.push(candUnsub);

      const signalRef = doc(db, 'games', code, 'voice', 'signal');
      // Deterministic Caller/Callee: Player X is caller, Player O is callee.
      // If roles not yet assigned, tie-break by UID.
      const isCaller = (ctx.me === 'X') || (!ctx.me && Boolean(myId && oppVoiceMember?.uid && myId < oppVoiceMember.uid));

      if (isCaller) {
        currentCallId = 'call_' + code + '_' + Date.now();
        console.log('[WebRTC Caller] Initializing call with callId: ' + currentCallId);

        const offer = await pc.createOffer({
          offerToReceiveAudio: true
        });
        await pc.setLocalDescription(offer);
        console.log('[WebRTC Caller] setLocalDescription(offer) completed');

        await setDoc(signalRef, {
          callId: currentCallId,
          active: true,
          callerUid: myId,
          offer: {
            type: offer.type,
            sdp: offer.sdp,
            from: myId,
            timestamp: Date.now()
          },
          answer: null
        });

        const sigUnsub = onSnapshot(signalRef, async function (snap) {
          if (!snap.exists() || !pc) return;
          const d = snap.data();
          if (d && d.answer && d.answer.from !== myId && d.callId === currentCallId && pc.signalingState === 'have-local-offer') {
            console.log('[WebRTC Caller] Received answer from callee: ' + d.answer.from);
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(d.answer));
              console.log('[WebRTC Caller] setRemoteDescription(answer) completed. signalingState=' + pc.signalingState);
              await drainPendingCandidates();
              playRemoteAudio();
            } catch (ansErr) {
              console.warn('[WebRTC Caller] setRemoteDescription answer error:', ansErr);
            }
          }
        });
        voiceUnsubs.push(sigUnsub);
      } else {
        console.log('[WebRTC Callee] Waiting for caller offer on signalRef');
        let lastHandledCallId = '';

        const sigUnsub = onSnapshot(signalRef, async function (snap) {
          if (!snap.exists() || !pc) return;
          const d = snap.data();
          if (d && d.offer && d.offer.from !== myId && d.callId && d.callId !== lastHandledCallId && pc.signalingState === 'stable') {
            lastHandledCallId = d.callId;
            currentCallId = d.callId;
            console.log('[WebRTC Callee] Processing offer from caller: ' + d.offer.from + ' (callId: ' + currentCallId + ')');

            try {
              await pc.setRemoteDescription(new RTCSessionDescription(d.offer));
              console.log('[WebRTC Callee] setRemoteDescription(offer) completed. signalingState=' + pc.signalingState);
              await drainPendingCandidates();

              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              console.log('[WebRTC Callee] setLocalDescription(answer) completed');

              await updateDoc(signalRef, {
                callId: currentCallId,
                answer: {
                  type: answer.type,
                  sdp: answer.sdp,
                  from: myId,
                  timestamp: Date.now()
                }
              });
              playRemoteAudio();
            } catch (offErr) {
              console.warn('[WebRTC Callee] Handle offer error:', offErr);
            }
          }
        });
        voiceUnsubs.push(sigUnsub);
      }
    } catch (err: any) {
      console.warn('[WebRTC] WebRTC negotiation error:', err);
      updateVoiceUI('failed', 'Voice connection error');
    } finally {
      isNegotiating = false;
    }
  }

  async function joinVoice() {
    if (!db || !myId || ctx.kind !== 'online' || !ctx.code) {
      toast('Voice chat is available in online private rooms.');
      return;
    }

    updateVoiceUI('connecting', 'Requesting microphone permission…');

    // User Gesture: prime the remote audio element immediately to unlock Android Chrome autoplay!
    const audioEl = $('voice-remote-audio') as HTMLAudioElement | null;
    if (audioEl) {
      audioEl.muted = !isVoiceSpeakerOn;
      audioEl.volume = 1.0;
      audioEl.setAttribute('playsinline', 'true');
      audioEl.autoplay = true;
      audioEl.play().catch(function () {});
    }

    // User Gesture: resume or create Web Audio context for local microphone analyser
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (AC && !voiceAudioCtx) voiceAudioCtx = new AC();
      if (voiceAudioCtx && voiceAudioCtx.state === 'suspended') {
        voiceAudioCtx.resume().catch(function () {});
      }
    } catch (e) {}

    try {
      localVoiceStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      const tracks = localVoiceStream.getAudioTracks();
      if (!tracks.length) {
        throw new Error('No audio tracks captured from microphone.');
      }
      tracks.forEach(function (t) {
        t.enabled = true;
        console.log('[WebRTC Local Mic] Captured track id=' + t.id + ' label=' + t.label + ' readyState=' + t.readyState + ' enabled=' + t.enabled + ' muted=' + t.muted);
      });
    } catch (err: any) {
      console.warn('[WebRTC] Microphone permission denied:', err);
      updateVoiceUI('denied', 'Microphone permission denied. Allow mic access and try again.');
      toast('⚠️ Microphone access was denied by your browser.');
      return;
    }

    // Connect local microphone to analyser ONLY for local talking indicator
    try {
      if (voiceAudioCtx && localVoiceStream) {
        const source = voiceAudioCtx.createMediaStreamSource(localVoiceStream);
        localVoiceAnalyser = voiceAudioCtx.createAnalyser();
        localVoiceAnalyser.fftSize = 64;
        localVoiceAnalyser.smoothingTimeConstant = 0.4;
        source.connect(localVoiceAnalyser);
      }
    } catch (audioErr) {
      console.warn('[WebRTC] Local audio analyser error:', audioErr);
    }

    isVoiceActive = true;
    isVoiceMuted = false;
    isVoiceSpeakerOn = true;
    currentCallId = 'call_' + ctx.code + '_' + Date.now();

    const code = ctx.code;
    await setDoc(doc(db, 'games', code, 'voice_members', myId), {
      uid: myId,
      role: ctx.me || 'X',
      name: M.name,
      joinedAt: Date.now(),
      muted: false
    }, { merge: true });

    startVoiceActivityMonitoring();

    if (oppVoiceMember) {
      startWebRTCNegotiation(code);
    } else {
      updateVoiceUI('waiting', 'Waiting for opponent to join voice…');
      toast('🎙️ Joined voice chat! Waiting for your opponent.');
    }
  }

  function toggleVoiceMute() {
    if (!isVoiceActive || !localVoiceStream) return;
    isVoiceMuted = !isVoiceMuted;
    localVoiceStream.getAudioTracks().forEach(function (track) {
      track.enabled = !isVoiceMuted;
      console.log('[WebRTC Local Track] Mute toggled. track.enabled=' + track.enabled);
    });
    updateVoiceUI(pc && pc.connectionState === 'connected' ? 'connected' : 'waiting');
    if (db && myId && ctx.kind === 'online' && ctx.code) {
      updateDoc(doc(db, 'games', ctx.code, 'voice_members', myId), {
        muted: isVoiceMuted
      }).catch(function () {});
    }
    toast(isVoiceMuted ? '🔇 Microphone muted.' : '🎙️ Microphone active.');
  }

  function toggleVoiceSpeaker() {
    isVoiceSpeakerOn = !isVoiceSpeakerOn;
    const audioEl = $('voice-remote-audio') as HTMLAudioElement | null;
    if (audioEl) {
      audioEl.muted = !isVoiceSpeakerOn;
      if (isVoiceSpeakerOn) {
        playRemoteAudio();
      }
    }
    updateVoiceUI(pc && pc.connectionState === 'connected' ? 'connected' : 'waiting');
    toast(isVoiceSpeakerOn ? '🔊 Opponent voice unmuted.' : '🔈 Opponent voice silenced.');
  }

  function leaveVoice() {
    isVoiceActive = false;
    isNegotiating = false;

    if (voiceAnimId) {
      cancelAnimationFrame(voiceAnimId);
      voiceAnimId = null;
    }

    if (localVoiceStream) {
      localVoiceStream.getTracks().forEach(function (t) {
        try { t.stop(); } catch (e) {}
      });
      localVoiceStream = null;
    }

    if (pc) {
      try { pc.close(); } catch (e) {}
      pc = null;
    }

    const audioEl = $('voice-remote-audio') as HTMLAudioElement | null;
    if (audioEl) {
      audioEl.srcObject = null;
    }

    const banner = $('voice-audio-unblock-banner');
    if (banner) banner.hidden = true;

    if (localVoiceAnalyser) {
      try { localVoiceAnalyser.disconnect(); } catch (e) {}
      localVoiceAnalyser = null;
    }
    if (voiceAudioCtx && voiceAudioCtx.state !== 'closed') {
      try { voiceAudioCtx.close(); } catch (e) {}
      voiceAudioCtx = null;
    }

    if (db && myId && voiceRoomCode) {
      deleteDoc(doc(db, 'games', voiceRoomCode, 'voice_members', myId)).catch(function () {});
    }

    updateVoiceUI('idle', 'Ready to join');
  }

  function voiceReset() {
    leaveVoice();
    voiceUnsubs.forEach(function (unsub) {
      try { unsub(); } catch (e) {}
    });
    voiceUnsubs = [];
    oppVoiceMember = null;
    voiceRoomCode = '';
    pendingRemoteCandidates = [];
    seenCandidateIds.clear();
  }

  /* ---------- Missions, Daily & Social ---------- */
  function missions(): number[] {
    const d = today(); if (M.mis.d !== d) M.mis = { d: d, p: {}, done: {} };
    let sd = seed(d);
    const out: number[] = [], used: Record<number, number> = {};
    let g = 0;
    while (out.length < 3 && g++ < 60) {
      sd = (Math.imul(sd, 1103515245) + 12345) >>> 0;
      const i = (sd >>> 8) % POOL.length;
      if (!used[i]) { used[i] = 1; out.push(i); }
    }
    return out;
  }

  function metaEv(ev: string) {
    if (!isEligibleRewardMode()) return;
    missions().forEach(function (i) {
      const mm = POOL[i]; if (mm[1] !== ev || M.mis.done[i]) return;
      const pr = M.mis.p[i] = (M.mis.p[i] || 0) + 1;
      if (pr >= mm[2]) {
        M.mis.done[i] = 1; addXp(30); changePoints(10);
        toast('Mission done: ' + mm[0] + ' (+30 XP, +10 coins)');
      }
    });
    saveM();
  }

  function dc() {
    const sd = seed('dc' + today());
    return { n: [5, 7, 15][sd % 3], m: ['classic', 'blitz', 'random', 'bo3'][(sd >>> 4) % 4] };
  }
  function nextDay() { return M.lastLogin === ydate() ? M.loginDay + 1 : 1; }

  let claimingDaily = false;

  function updateDailyUI(isClaiming: boolean = false) {
    const td = today();
    const claimedToday = M.lastLogin === td;
    const nd = nextDay();
    const displayDay = claimedToday ? M.loginDay : nd;
    const rewardCoins = 10 + Math.min(nd, 7) * 5;

    // Lobby Daily Card Elements
    const lobbyDayEl = $('lobby-daily-day');
    if (lobbyDayEl) lobbyDayEl.textContent = 'Day ' + (displayDay || 1);

    const lobbySubEl = $('lobby-daily-sub');
    if (lobbySubEl) {
      if (claimedToday) {
        const earnedCoins = 10 + Math.min(M.loginDay, 7) * 5;
        lobbySubEl.textContent = 'Claimed today (+' + earnedCoins + ' 🪙). Next reward available tomorrow!';
      } else {
        lobbySubEl.textContent = 'Day ' + nd + ' reward: +' + rewardCoins + ' coins. Claim now to build your streak!';
      }
    }

    const lobbyBtn = $('lobby-daily-claim-btn') as HTMLButtonElement | null;
    if (lobbyBtn) {
      if (isClaiming) {
        lobbyBtn.textContent = 'Claiming…';
        lobbyBtn.disabled = true;
        lobbyBtn.classList.remove('primary');
        lobbyBtn.classList.remove('claimed');
      } else if (claimedToday) {
        lobbyBtn.textContent = 'Claimed Today';
        lobbyBtn.disabled = true;
        lobbyBtn.classList.remove('primary');
        lobbyBtn.classList.add('claimed');
      } else {
        lobbyBtn.textContent = 'Claim Reward (+' + rewardCoins + ' 🪙)';
        lobbyBtn.disabled = false;
        lobbyBtn.classList.add('primary');
        lobbyBtn.classList.remove('claimed');
      }
    }

    // Hub Daily Tab Claim Button
    const hubDailyBtn = $('hub-daily-claim-btn') as HTMLButtonElement | null;
    if (hubDailyBtn) {
      if (isClaiming) {
        hubDailyBtn.textContent = 'Claiming…';
        hubDailyBtn.disabled = true;
      } else if (claimedToday) {
        hubDailyBtn.textContent = 'Claimed Today';
        hubDailyBtn.disabled = true;
        hubDailyBtn.classList.add('claimed');
        hubDailyBtn.classList.remove('primary');
      } else {
        hubDailyBtn.textContent = 'Claim Reward (+' + rewardCoins + ' 🪙)';
        hubDailyBtn.disabled = false;
        hubDailyBtn.classList.add('primary');
        hubDailyBtn.classList.remove('claimed');
      }
    }
  }

  async function claimDailyReward(): Promise<void> {
    const td = today();
    const yd = ydate();

    if (claimingDaily) return;
    if (M.lastLogin === td) {
      toast('⚠️ Daily reward was already claimed today. Next reward available tomorrow!');
      updateDailyUI();
      return;
    }

    claimingDaily = true;
    updateDailyUI(true);

    try {
      const nd = nextDay();
      const fallbackCoins = 10 + Math.min(nd, 7) * 5;

      if (db && myId) {
        const profRef = doc(db, 'profiles', myId);

        const result = await runTransaction(db, async function (tx) {
          const snap = await tx.get(profRef);
          const data = snap.exists() ? snap.data() : null;

          const serverLastClaim = data?.lastLogin || data?.dailyReward?.lastClaimDate;
          if (serverLastClaim === td) {
            throw new Error('ALREADY_CLAIMED_TODAY');
          }

          let serverNextDay = 1;
          if (serverLastClaim === yd) {
            const prevDay = typeof data?.loginDay === 'number'
              ? data.loginDay
              : (typeof data?.dailyReward?.loginDay === 'number' ? data.dailyReward.loginDay : 0);
            serverNextDay = prevDay + 1;
          }

          const awardCoins = 10 + Math.min(serverNextDay, 7) * 5;
          const currentPoints = typeof data?.points === 'number' ? data.points : points;
          const nextPoints = currentPoints + awardCoins;

          const patch: Record<string, any> = {
            lastLogin: td,
            loginDay: serverNextDay,
            points: nextPoints,
            dailyReward: {
              lastClaimDate: td,
              loginDay: serverNextDay,
              claimedAt: Date.now(),
              amount: awardCoins,
              status: 'claimed'
            },
            updatedAt: Date.now()
          };

          if (snap.exists()) {
            tx.update(profRef, patch);
          } else {
            tx.set(profRef, {
              ...getCloudPayload(),
              ...patch
            }, { merge: true });
          }

          return {
            coins: awardCoins,
            loginDay: serverNextDay,
            points: nextPoints
          };
        });

        // Update local state atomically from server transaction result
        M.lastLogin = td;
        M.loginDay = result.loginDay;
        points = result.points;
        if (result.loginDay >= 7) ach('log7');
        saveM();
        saveWallet();
        updateWallet();

        // Secondary mirror to users/{myId}
        try {
          await setDoc(doc(db, 'users', myId), {
            lastLogin: td,
            loginDay: result.loginDay,
            points: result.points,
            dailyReward: {
              lastClaimDate: td,
              loginDay: result.loginDay,
              claimedAt: Date.now(),
              amount: result.coins,
              status: 'claimed'
            },
            updatedAt: Date.now()
          }, { merge: true });
        } catch (_) {}

        toast('🎉 Day ' + result.loginDay + ' Daily Reward Claimed! +' + result.coins + ' coins added to wallet.');
        sfx('win');
      } else {
        // Offline or unauthenticated fallback
        if (M.lastLogin === td) {
          toast('⚠️ Daily reward was already claimed today.');
          return;
        }
        M.loginDay = nd;
        M.lastLogin = td;
        changePoints(fallbackCoins);
        if (M.loginDay >= 7) ach('log7');
        saveM();
        toast('🎉 Day ' + M.loginDay + ' Daily Reward Claimed! +' + fallbackCoins + ' coins added to wallet.');
        sfx('win');
      }
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      if (msg.includes('ALREADY_CLAIMED_TODAY')) {
        M.lastLogin = td;
        saveM();
        toast('⚠️ Daily reward was already claimed today on this or another device.');
      } else {
        console.warn('Daily claim error:', err);
        toast('⚠️ Could not complete daily claim. Please check your connection.');
      }
    } finally {
      claimingDaily = false;
      updateDailyUI();
      if (hubTab === 'daily') renderHub();
      renderProfile();
    }
  }

  function onRound(): string {
    if (!isEligibleRewardMode()) return '';
    const me = ctx.kind === 'cpu' ? 'X' : (ctx.kind === 'online' ? ctx.me : null);
    if (!me || !G) return '';
    const mine = G.winner === me, mode = G.mode || 'classic';
    let msg = '';
    wkEnsure(); M.games++; metaEv('play');
    if (mine) {
      M.wins++; M.streak++; M.best = Math.max(M.best, M.streak); M.wk.w++;
      metaEv('win'); if (mode === 'blitz') metaEv('blitz'); if (mode === 'random') metaEv('random');
      ach('first'); if (M.wins >= 10) ach('w10'); if (M.wins >= 50) ach('w50'); if (M.streak >= 5) ach('s5'); if (mode === 'blitz') ach('blitz');
      addXp(20);
      if (M.streak >= 3) { const bn = Math.min(10, M.streak * 2); changePoints(bn); msg += 'Win streak ' + M.streak + ': +' + bn + ' coins. '; }
      const d = dc();
      if (ctx.kind === 'cpu' && M.dc !== today() && d.n === N && d.m === mode) {
        M.dc = today(); addXp(60); changePoints(25); toast('Daily challenge done! +60 XP, +25 coins');
      }
    } else M.streak = 0;

    if (mode === 'bo3') {
      if (G.wx >= 2 || G.wo >= 2) {
        const ms = G[me === 'X' ? 'wx' : 'wo'] >= 2;
        msg += ms ? 'Series won!' : 'Series lost.';
        if (ms) { ach('bo3'); addXp(30); changePoints(15); }
      } else msg += 'Series ' + G.wx + '–' + G.wo + '.';
    } else if (mode === 'tour' && ctx.kind === 'cpu') {
      if (mine) {
        lad.stage++;
        if (lad.stage >= 3) {
          lad.over = 'champ';
          msg += 'You are the champion! +100 coins';
          ach('tour');
          addXp(100);
          changePoints(100);
        } else {
          msg += 'Match won!';
        }
      } else {
        if (G.winner === 'D') {
          msg += 'Draw match.';
        } else {
          lad.over = 'out';
          msg += 'Eliminated in the ' + STAGES[lad.stage] + '.';
        }
      }
      saveLad();
      saveLocalGame();
    } else if (mode === 'surv' && ctx.kind === 'cpu') {
      if (mine) {
        lad.run++; M.bs = Math.max(M.bs, lad.run);
        if (lad.run >= 5) ach('surv5');
        msg += 'Streak ' + lad.run + '. Keep going!';
      } else { lad.over = 'out'; msg += 'Run over after ' + lad.run + ' win' + (lad.run === 1 ? '' : 's') + '.'; }
    }
    lastMsg = msg; saveM(); pushLb();
    return msg;
  }

  let netOn = false;
  let live: Record<string, any> = {};
  let lbT: any = null, qmT: any = null, lastInv = 0, invCode = '';
  let hubTab = 'profile', rkTab = 'all';

  function netOk(): boolean { return !!(db && myId && canWrite !== false); }
  function fcode(): string { return myId ? seed(myId).toString(36).toUpperCase().slice(-6) : ''; }

  function beat() {
    if (netOk() && myId) {
      setDoc(doc(db, 'presence', myId), {
        t: Date.now(),
        name: M.name,
        av: M.av,
        fc: fcode()
      }).catch(function () {});
    }
  }

  function pushLb() {
    clearTimeout(lbT);
    lbT = setTimeout(function () {
      if (!netOk() || !myId) return;
      wkEnsure();
      setDoc(doc(db, 'lb', myId), {
        name: M.name,
        av: M.av,
        xp: M.xp,
        lvl: level(),
        wk: M.wk.w,
        wkKey: M.wk.k,
        t: Date.now()
      }).catch(function () {});
    }, 1500);
  }

  function startNet() {
    if (netOn || !netOk() || !myId) return;
    netOn = true; beat(); pushLb(); setInterval(beat, 25000);

    const presQuery = query(collection(db, 'presence'), orderBy('t', 'desc'), limit(100));
    onSnapshot(presQuery, function (sn) {
      live = {}; let n = 0; const now = Date.now();
      sn.docs.forEach(function (d) {
        const v = d.data() || {};
        if (now - v.t < 60000) { n++; live[v.fc] = v; }
      });
      onlineN = n; renderOnline();
      if ($('hub') && $('hub').open && hubTab === 'friends') renderHub();
    }, function () {});

    onSnapshot(doc(db, 'invites', fcode()), function (sn) {
      if (!sn.exists()) return;
      const v = sn.data() || {};
      if (v.code && v.t !== lastInv && Date.now() - v.t < 90000) {
        lastInv = v.t; invCode = v.code;
        const invT = $('inv-t'); if (invT) invT.textContent = (v.from || 'A friend') + ' invited you to play';
        const invBar = $('invbar'); if (invBar) invBar.hidden = false;
        sfx('pop');
      }
    }, function () {});
  }

  function qmReset() { const b = $('qm'); if (b) { b.textContent = 'Quick Match'; b.disabled = !netOk(); } }
  function qmCancel() {
    clearTimeout(qmT);
    const qmBtn = $('qm');
    if (netOk() && qmBtn && qmBtn.textContent === 'Searching…' && myId) {
      setDoc(doc(db, 'queue', myId), { t: 0, code: '', size: 0 }).catch(function () {});
    }
    qmReset();
  }

  async function quickMatch() {
    if (!netOk() || !myId) {
      showMsg('Online play is not connected yet. Please wait for Firebase initialization.');
      return;
    }
    const qmBtn = $('qm');
    if (qmBtn) { qmBtn.disabled = true; qmBtn.textContent = 'Searching…'; }

    try {
      const qColl = collection(db, 'queue');
      const qQuery = query(qColl, orderBy('t', 'desc'), limit(10));
      const unsubQM = onSnapshot(qQuery, async function (sn) {
        unsubQM();
        const list = sn.docs.map(function (d) {
          const v = d.data() || {};
          v._id = d.id;
          return v;
        });

        const f = list.filter(function (v) { return v._id !== myId && v.code && Date.now() - v.t < 30000; })[0];
        if (f) {
          await setDoc(doc(db, 'queue', f._id), { t: 0, code: '', size: 0 });
          joinCode(f.code);
          qmReset();
          return;
        }

        const code = randCode();
        setSize(sizeSel);
        curMode = effMode('online');
        const data = newGame(myId!, '', modeTl(), sizeSel);
        data.code = code;
        data.sx = symPick.X;
        data.created = Date.now();
        data.lastSeenX = Date.now();

        await setDoc(doc(db, 'games', code), data);
        openOnline(code);
        await setDoc(doc(db, 'queue', myId!), { t: Date.now(), code: code, size: sizeSel });

        qmT = setTimeout(function () {
          if (G && !G.o && ctx.kind === 'online') {
            showTip('No player found yet. Share the code ' + code + ', or leave and play the computer.');
          }
          qmCancel();
        }, 30000);
      });
    } catch (e: any) {
      showMsg(writeError(e));
      qmReset();
    }
  }

  function sendInvite(fc2: string) {
    if (netOk() && ctx.kind === 'online') {
      setDoc(doc(db, 'invites', fc2), { code: ctx.code, from: M.name, t: Date.now() }).catch(function () {});
    }
  }

  function invite() {
    if (ctx.kind !== 'online') return;
    let n = 0;
    M.fr.forEach(function (f) { if (live[f.fc]) { sendInvite(f.fc); n++; } });
    const url = location.href.split('#')[0] + '#' + ctx.code;
    const text = M.name + ' invited you to Tickle-Tac. Room code: ' + ctx.code;
    if (navigator.share) {
      navigator.share({ title: 'Tickle-Tac', text: text, url: url }).catch(function () {});
    } else {
      try { navigator.clipboard.writeText(text + ' ' + url); } catch (e) {}
    }
    flash(n ? 'Invite sent to ' + n + ' online friend' + (n > 1 ? 's' : '') + '.' : 'Invite link ready. Send it to a friend.');
  }

  function renderHub() {
    const b = $('hub-body');
    if (!b) return;
    let h = '';
    const l = level(), td = today();
    (document.querySelectorAll('#hub-tabs button') as NodeListOf<HTMLButtonElement>).forEach(function (x) {
      x.setAttribute('aria-pressed', String(x.dataset.t === hubTab));
    });
    wkEnsure(); snEnsure();
    if (hubTab === 'profile') {
      h += '<label class="setting"><span class="lab">Display name</span><input id="h-name" class="txt" maxlength="14" value="' + esc(M.name) + '"></label><span class="sub">Avatars unlock as you level up</span><div class="eg">';
      AVS.forEach(function (a) {
        const ok = l >= a[1];
        h += '<button type="button" class="item' + (ok ? '' : ' locked') + '" data-act="av" data-v="' + a[0] + '" aria-pressed="' + (M.av === a[0]) + '"' + (ok ? '' : ' disabled') + '><span class="em">' + a[0] + '</span><span class="pr">' + (ok ? '' : 'Lv ' + a[1]) + '</span></button>';
      });
      h += '</div><p class="hint">💎 ' + M.diamonds + ' Diamonds · 🪙 ' + points + ' coins<br>Level ' + l + ' · ' + title() + ' · ' + M.xp + ' XP<br>' + M.wins + ' wins · ' + M.games + ' games · best streak ' + M.best + ' · best survival ' + M.bs + '</p>';
    } else if (hubTab === 'daily') {
      const claimedToday = M.lastLogin === td, nd = nextDay();
      const displayDay = claimedToday ? M.loginDay : nd;
      const rewardCoins = 10 + Math.min(nd, 7) * 5;
      h += '<div class="li"><span>📅 Daily login · Day ' + displayDay + '<small>' + (claimedToday ? 'Claimed today (+' + (10 + Math.min(M.loginDay, 7) * 5) + ' 🪙). Next reward available tomorrow.' : 'Rewards grow each day in a row, up to Day 7') + '</small></span><button class="btn' + (claimedToday ? ' claimed' : ' primary') + '" id="hub-daily-claim-btn" data-act="claim-daily"' + (claimedToday ? ' disabled' : '') + '>' + (claimedToday ? 'Claimed Today' : 'Claim Reward (+' + rewardCoins + ' 🪙)') + '</button></div>';
      h += '<div class="li"><span>🔥 Win streak: ' + M.streak + '<small>3+ wins in a row earns bonus coins on every win</small></span></div><h3>Daily missions</h3>';
      missions().forEach(function (i) {
        const m = POOL[i];
        h += '<div class="li"><span>' + (M.mis.done[i] ? '✅ ' : '') + m[0] + '<small>' + Math.min(M.mis.p[i] || 0, m[2]) + '/' + m[2] + ' · 30 XP + 10 coins</small></span></div>';
      });
      const d = dc();
      h += '<h3>Daily challenge</h3><div class="li"><span>' + (M.dc === td ? '✅ ' : '') + 'Beat the computer on ' + d.n + '×' + d.n + ' in ' + modeName(d.m) + '<small>60 XP + 25 coins</small></span><button class="btn" data-act="dc"' + (M.dc === td ? ' disabled' : '') + '>Play</button></div>';
      h += '<h3>Weekly prizes · ' + M.wk.w + ' wins this week</h3>';
      WK.forEach(function (w, i) {
        const ok = M.wk.w >= w[0], cl = M.wk.cl[i];
        h += '<div class="li"><span>' + w[0] + ' wins<small>+' + w[1] + ' coins</small></span><button class="btn" data-act="wk" data-v="' + i + '"' + (ok && !cl ? '' : ' disabled') + '>' + (cl ? 'Claimed' : ok ? 'Claim' : 'Locked') + '</button></div>';
      });
    } else if (hubTab === 'pass') {
      h += '<p class="hint">Season ' + M.sn.id + ' · ' + M.sn.xp + ' season XP. Earn XP by playing. A new season starts each month.</p>';
      for (let t = 1; t <= 10; t++) {
        const sk = ({ 3: 0, 5: 1, 8: 2, 10: 3 } as Record<number, number>)[t];
        const ok2 = M.sn.xp >= t * 100, c2 = M.sn.cl[t];
        h += '<div class="li"><span>Tier ' + t + ' · ' + (t * 100) + ' XP<small>+' + (15 + t * 5) + ' coins' + (sk !== undefined ? ' + exclusive skin ' + SEASON_SKINS[sk][0] + ' ' + SEASON_SKINS[sk][1] : '') + '</small></span><button class="btn" data-act="sn" data-v="' + t + '"' + (ok2 && !c2 ? '' : ' disabled') + '>' + (c2 ? 'Claimed' : ok2 ? 'Claim' : 'Locked') + '</button></div>';
      }
    } else if (hubTab === 'badges') {
      h += '<div class="eg">';
      ACH.forEach(function (a) {
        const on = M.ach[a[0]];
        h += '<div class="item' + (on ? '' : ' locked') + '"><span class="em">' + a[1] + '</span><span class="pr">' + a[2] + '</span></div>';
      });
      h += '</div>';
    } else if (hubTab === 'history') {
      h += '<p class="hint">Your last 30 completed matches are saved on this device.</p>';
      if (!M.history.length) h += '<p class="hint">No completed matches yet. Play a game to build your history.</p>';
      M.history.forEach(function (g, i) {
        h += '<div class="li"><span>' + esc(g.result) + ' · ' + esc(g.size + '×' + g.size) + ' · ' + esc(modeName(g.mode)) + '<small>' + esc(g.date) + ' · ' + g.moves + ' moves</small></span><button class="btn" data-act="replay" data-v="' + i + '" ' + (!g.log || !g.log.length ? 'disabled' : '') + '>Review</button></div>';
      });
    } else if (hubTab === 'friends') {
      h += '<p class="hint">Your friend code: <b>' + (fcode() || 'Connecting…') + '</b>. Share it so friends can add you. Friends must be online to be added.</p>';
      h += '<form class="join" id="f-form" autocomplete="off"><input id="f-code" maxlength="6" placeholder="CODE" aria-label="Friend code"><button class="btn" type="submit">Add</button></form>';
      if (!M.fr.length) h += '<p class="hint">No friends yet.</p>';
      M.fr.forEach(function (f, i) {
        const on = live[f.fc] && Date.now() - live[f.fc].t < 60000;
        h += '<div class="li"><span><i class="dot' + (on ? ' on' : '') + '"></i>' + esc(f.av) + ' ' + esc(f.name) + '<small>' + (on ? 'Online' : 'Offline') + '</small></span><span><button class="btn" data-act="finv" data-v="' + f.fc + '"' + (on && ctx.kind === 'online' ? '' : ' disabled') + '>Invite</button> <button class="btn" data-act="fdel" data-v="' + i + '">Remove</button></span></div>';
      });
      if (ctx.kind !== 'online') h += '<p class="hint">Create a private room or start Quick Match, then use Invite in the game to call online friends.</p>';
    } else if (hubTab === 'account') {
      const isLinked = !!(user && !user.isAnonymous);
      const isFb = user?.providerData?.some(function (p) { return p.providerId.includes('facebook'); });
      const accountEmail = user?.email || (isLinked ? (isFb ? 'Facebook Account Connected' : 'Google Account Connected') : 'Guest Account');
      const accountName = user?.displayName || M.name;
      const playerId = user?.uid || myId || 'Loading…';
      const syncTimeStr = lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Pending first save';

      h += '<div class="acc-box">';
      h += '<div class="acc-header">';
      h += '<div class="acc-av">' + esc(M.av) + '</div>';
      h += '<div class="acc-details">';
      h += '<b>' + esc(accountName) + '</b>';
      h += '<span style="font-size:0.84rem;color:var(--muted);word-break:break-all;">' + esc(accountEmail) + '</span>';
      h += '<div style="margin-top:4px;"><span class="badge-acc ' + (isFb ? 'facebook' : isLinked ? 'google' : '') + '">' + (isFb ? 'Facebook Account' : isLinked ? 'Google Account' : 'Guest Account') + '</span></div>';
      h += '</div></div>';

      h += '<div style="background:var(--bg);border:1.5px solid var(--line);border-radius:12px;padding:8px 12px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;gap:8px;">';
      h += '<div style="min-width:0;overflow:hidden;"><span style="font-size:0.68rem;text-transform:uppercase;color:var(--muted);font-weight:800;letter-spacing:0.04em;display:block;">Permanent Player ID</span><code style="font-family:var(--font-mono);font-size:0.8rem;font-weight:700;word-break:break-all;">' + esc(playerId) + '</code></div>';
      h += '<button class="btn-copy-sm" data-act="copy-player-id" type="button" style="flex-shrink:0;">Copy ID</button>';
      h += '</div>';

      h += '<div class="acc-stats-grid">';
      h += '<div class="acc-stat"><span>Cloud Status</span><b style="color:' + (cloudStatus === 'synced' ? '#137333' : 'inherit') + '">' + (cloudStatus === 'synced' ? '🟢 Synced' : cloudStatus === 'syncing' ? '🔄 Syncing…' : cloudStatus === 'offline' ? '📡 Offline' : '☁️ Ready') + '</b></div>';
      h += '<div class="acc-stat"><span>Last Saved</span><b>' + syncTimeStr + '</b></div>';
      h += '<div class="acc-stat"><span>Coins & Diamonds</span><b>🪙 ' + points + ' · 💎 ' + M.diamonds + '</b></div>';
      h += '<div class="acc-stat"><span>XP & Level</span><b>Lv ' + level() + ' (' + M.xp + ' XP)</b></div>';
      h += '<div class="acc-stat"><span>Purchased Unlocks</span><b>' + Object.keys(owned).length + ' Items</b></div>';
      h += '<div class="acc-stat"><span>Match Record</span><b>' + M.wins + 'W / ' + M.games + 'G</b></div>';
      h += '</div>';

      if (!isLinked) {
        h += '<div class="acc-banner" style="background:color-mix(in srgb, var(--gold) 15%, var(--bg));border:1.5px solid var(--gold);">';
        h += '<b>⚠️ Protect Your Progress</b><br>';
        h += 'You are currently playing as a guest. Link your Google account to permanently backup your coins, diamonds, rank, unlocked emojis and custom symbols across devices and browsers.';
        h += '</div>';
      }

      h += '<div class="acc-actions">';
      if (!isLinked) {
        h += '<button class="btn primary auth-btn google-btn" data-act="link-google" type="button" style="justify-content:center;">' +
             '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
             '<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>' +
             '<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>' +
             '<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>' +
             '<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>' +
             '</svg><span>Link Google Account</span></button>';
      } else {
        h += '<button class="btn" data-act="switch-google" type="button">🔄 Switch Google Account</button>';
      }

      h += '<div style="display:flex;gap:8px;">';
      h += '<button class="btn primary" data-act="sync-now" type="button" style="flex:1;">☁️ Save to Cloud</button>';
      h += '<button class="btn" data-act="load-cloud" type="button" style="flex:1;">🔄 Restore Cloud</button>';
      h += '</div>';

      h += '<button class="btn danger-btn" data-act="sign-out" type="button" style="margin-top:6px;">🚪 Sign Out</button>';
      h += '</div></div>';
    } else {
      h += '<div class="seg"><button type="button" data-act="rk" data-v="all" aria-pressed="' + (rkTab === 'all') + '">All time</button><button type="button" data-act="rk" data-v="week" aria-pressed="' + (rkTab === 'week') + '">This week</button></div><div id="lb-list" class="hint">Loading…</div>';
    }
    b.innerHTML = h;

    if (hubTab === 'ranks') {
      if (!netOk()) { const lbl = $('lb-list'); if (lbl) lbl.textContent = 'The leaderboard will be available once connected.'; return; }
      const lbQuery = query(collection(db, 'lb'), orderBy(rkTab === 'week' ? 'wk' : 'xp', 'desc'), limit(15));
      const unsubLB = onSnapshot(lbQuery, function (sn) {
        unsubLB();
        const el = $('lb-list'); if (!el) return;
        let list = sn.docs.map(function (d) { const v = d.data() || {}; v._id = d.id; return v; });
        if (rkTab === 'week') list = list.filter(function (v) { return v.wkKey === weekKey(); });
        if (!list.length) { el.textContent = 'No scores yet. Win a game to get on the board.'; return; }
        el.className = '';
        el.innerHTML = list.map(function (v, i) {
          return '<div class="li"><span>' + (['🥇', '🥈', '🥉'][i] || (i + 1) + '.') + ' ' + esc(v.av || '🙂') + ' ' + esc(v.name || 'Player') + (v._id === myId ? ' (you)' : '') + '<small>Level ' + (v.lvl || 1) + '</small></span><b>' + (rkTab === 'week' ? (v.wk || 0) + ' wins' : (v.xp || 0) + ' XP') + '</b></div>';
        }).join('');
      }, function () {
        const el = $('lb-list'); if (el) el.textContent = 'Could not load leaderboard.';
      });
    }
  }

  function openHub(t?: string) {
    hubTab = t || hubTab;
    renderHub();
    const d = $('hub');
    if (d && !d.open) d.showModal();
  }

  const hubBody = $('hub-body');
  if (hubBody) {
    hubBody.addEventListener('click', function (e: MouseEvent) {
      const el = (e.target as HTMLElement).closest('[data-act]') as HTMLButtonElement;
      if (!el || el.disabled) return;
      const a = el.dataset.act, v = el.dataset.v;
      if (a === 'av' && v) { M.av = v; saveM(); renderProfile(); beat(); pushLb(); }
      else if (a === 'claim-daily' || a === 'login') {
        claimDailyReward();
      }
      else if (a === 'dc') {
        const d = dc(); const hub = $('hub'); if (hub) hub.close(); sizeSel = d.n; lobbyMode = d.m; renderModes(); updateSub(); startLocal('cpu'); return;
      }
      else if (a === 'wk' && v !== undefined) {
        M.wk.cl[+v] = 1; changePoints(WK[+v][1]); toast('Weekly prize: +' + WK[+v][1] + ' coins'); saveM();
      }
      else if (a === 'sn' && v !== undefined) {
        M.sn.cl[+v] = 1; changePoints(15 + (+v) * 5);
        const sk = ({ 3: 0, 5: 1, 8: 2, 10: 3 } as Record<number, number>)[+v];
        if (sk !== undefined) {
          owned[SEASON_SKINS[sk][0]] = 1; saveWallet(); toast('Skin unlocked: ' + SEASON_SKINS[sk][0] + ' ' + SEASON_SKINS[sk][1]);
        } else toast('Tier ' + v + ': +' + (15 + (+v) * 5) + ' coins');
        saveM();
      }
      else if (a === 'replay' && v !== undefined) {
        const rec = M.history[+v];
        if (rec) {
          const seq = (rec.log || []).map(function (m: any, j: number) {
            return (j + 1) + '. ' + m.mark + ' → ' + (Math.floor(m.index / rec.size) + 1) + ',' + ((m.index % rec.size) + 1);
          }).join('\n');
          window.alert('Match review · ' + rec.result + '\n' + rec.size + '×' + rec.size + ' · ' + rec.moves + ' moves\n\n' + (seq || 'Move details unavailable'));
        }
      }
      else if (a === 'fdel' && v !== undefined) { M.fr.splice(+v, 1); saveM(); }
      else if (a === 'finv' && v) { sendInvite(v); toast('Invite sent'); }
      else if (a === 'copy-player-id') {
        const pid = user?.uid || myId || '';
        if (pid) {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(pid).then(function () {
              toast('📋 Player ID copied to clipboard!');
            }).catch(function () {
              toast('Player ID: ' + pid);
            });
          } else {
            toast('Player ID: ' + pid);
          }
        }
      }
      else if (a === 'link-google') { authWithGoogle(); }
      else if (a === 'switch-google') { authWithGoogle(); }
      else if (a === 'sync-now') { syncToCloud(true); toast('Saving progress to cloud…'); }
      else if (a === 'load-cloud') { if (myId) { toast('Restoring cloud data…'); loadFromCloud(myId); } }
      else if (a === 'sign-out') { authSignOut(); }
      renderHub(); renderProfile();
    });

    hubBody.addEventListener('input', function (e: Event) {
      const target = e.target as HTMLInputElement;
      if (target.id === 'h-name') {
        M.name = target.value.trim().slice(0, 14) || 'Player';
        saveM(); renderProfile(); beat(); pushLb();
        if (myId) {
          setDoc(doc(db, 'profiles', myId), { name: M.name, av: M.av, lvl: level() }, { merge: true }).catch(function () {});
        }
      }
    });

    hubBody.addEventListener('submit', function (e: SubmitEvent) {
      e.preventDefault();
      const codeInput = $('f-code') as HTMLInputElement;
      const c = (codeInput ? codeInput.value : '').toUpperCase().trim(), v = live[c];
      if (!c || c === fcode()) { toast('Enter a friend code'); return; }
      if (!v) { toast('Friend not found online. Ask them to open the game.'); return; }
      if (!M.fr.some(function (f) { return f.fc === c; })) M.fr.push({ fc: c, name: v.name || 'Friend', av: v.av || '🙂' });
      saveM(); renderHub();
    });
  }

  (document.querySelectorAll('#hub-tabs button') as NodeListOf<HTMLButtonElement>).forEach(function (b) {
    b.addEventListener('click', function (this: HTMLButtonElement) { hubTab = this.dataset.t!; renderHub(); });
  });

  const pHub = $('p-hub'); if (pHub) pHub.addEventListener('click', function () { openHub('daily'); });
  const pAv = $('p-av'); if (pAv) pAv.addEventListener('click', function () { openHub('profile'); });
  const hubClose = $('hub-close'); if (hubClose) hubClose.addEventListener('click', function () { const h = $('hub'); if (h) h.close(); });
  const hubDlg = $('hub');
  if (hubDlg) {
    hubDlg.addEventListener('click', function (this: HTMLDialogElement, e: MouseEvent) { if (e.target === this) this.close(); });
    hubDlg.addEventListener('close', renderProfile);
  }
  const qmBtn = $('qm'); if (qmBtn) qmBtn.addEventListener('click', quickMatch);
  const invBtn = $('invite'); if (invBtn) invBtn.addEventListener('click', invite);
  const invX = $('inv-x'); if (invX) invX.addEventListener('click', function () { const ib = $('invbar'); if (ib) ib.hidden = true; });
  const invGo = $('inv-go');
  if (invGo) {
    invGo.addEventListener('click', function () {
      const ib = $('invbar'); if (ib) ib.hidden = true;
      if (invCode && netOk()) joinCode(invCode);
    });
  }

  function showHint() {
    if (!G || G.winner || !canMoveNow()) { toast('Hints are available during your turn.'); return; }
    if (M.diamonds < HINT_DIAMOND_COST) { toast('You need ' + HINT_DIAMOND_COST + ' Diamonds to use a hint.'); refreshHintButton(); return; }
    const best = cpuChoose(G.board, G.turn, 'hard');
    if (best < 0) { toast('No suggested move is available.'); return; }
    if (!window.confirm('Use ' + HINT_DIAMOND_COST + ' Diamonds to reveal a hint?')) return;
    M.diamonds -= HINT_DIAMOND_COST; saveM(); renderProfile(); refreshHintButton();
    sel = best; render(); showTip('💡 Hint: Recommended square highlighted! Tap it to place your ' + G.turn + ' mark.');
    const board = $('board'); if (board) { board.classList.add('hint-highlight'); setTimeout(function () { board.classList.remove('hint-highlight'); }, 1800); }
  }

  /* ---------- Wiring & Event Listeners ---------- */
  const bdEl = $('board');
  if (bdEl) {
    let pointerStartX = 0;
    let pointerStartY = 0;
    let lastClientX = 0;
    let lastClientY = 0;
    let isPointerDown = false;
    let hasDragged = false;

    bdEl.setAttribute('tabindex', '0');

    bdEl.addEventListener('pointerdown', function (this: SVGSVGElement, e: PointerEvent) {
      isPointerDown = true;
      hasDragged = false;
      pointerStartX = e.clientX;
      pointerStartY = e.clientY;
      lastClientX = e.clientX;
      lastClientY = e.clientY;
    });

    bdEl.addEventListener('pointermove', function (this: SVGSVGElement, e: PointerEvent) {
      if (!isPointerDown) return;
      const dist = Math.hypot(e.clientX - pointerStartX, e.clientY - pointerStartY);
      if (dist > 8) {
        hasDragged = true;
      }
      if (zoomed && e.pointerType === 'mouse') {
        const sc = $('scroll');
        if (sc) {
          sc.scrollLeft -= (e.clientX - lastClientX);
          sc.scrollTop -= (e.clientY - lastClientY);
        }
      }
      lastClientX = e.clientX;
      lastClientY = e.clientY;
    });

    const resetPointer = function () {
      isPointerDown = false;
    };
    bdEl.addEventListener('pointerup', resetPointer);
    bdEl.addEventListener('pointercancel', function () {
      isPointerDown = false;
      hasDragged = false;
    });

    bdEl.addEventListener('click', function (this: SVGSVGElement, e: MouseEvent) {
      if (hasDragged) {
        hasDragged = false;
        return;
      }
      const r = this.getBoundingClientRect();
      const c = Math.floor((e.clientX - r.left) / r.width * N), row = Math.floor((e.clientY - r.top) / r.height * N);
      if (c < 0 || c >= N || row < 0 || row >= N) return;
      cellTap(row * N + c);
    });

    bdEl.addEventListener('keydown', function (e: KeyboardEvent) {
      if (!G || !canMoveNow()) return;
      if (keyFocusCell < 0) {
        keyFocusCell = G.last >= 0 ? G.last : Math.floor((N * N) / 2);
        render();
        return;
      }
      const r = Math.floor(keyFocusCell / N), c = keyFocusCell % N;
      if (e.key === 'ArrowUp' && r > 0) {
        keyFocusCell = (r - 1) * N + c;
        e.preventDefault();
        render();
      } else if (e.key === 'ArrowDown' && r < N - 1) {
        keyFocusCell = (r + 1) * N + c;
        e.preventDefault();
        render();
      } else if (e.key === 'ArrowLeft' && c > 0) {
        keyFocusCell = r * N + (c - 1);
        e.preventDefault();
        render();
      } else if (e.key === 'ArrowRight' && c < N - 1) {
        keyFocusCell = r * N + (c + 1);
        e.preventDefault();
        render();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        cellTap(keyFocusCell);
      }
    });

    bdEl.addEventListener('blur', function () {
      if (keyFocusCell >= 0) {
        keyFocusCell = -1;
        render();
      }
    });
  }
  const placeBtn = $('place'); if (placeBtn) placeBtn.addEventListener('click', commit);
  const hintBtn = $('hint-btn'); if (hintBtn) hintBtn.addEventListener('click', showHint);

  (document.querySelectorAll('#ai-difficulty button') as NodeListOf<HTMLButtonElement>).forEach(function (b) {
    b.setAttribute('aria-pressed', String(b.dataset.ai === aiDifficulty));
    b.addEventListener('click', function (this: HTMLButtonElement) {
      aiDifficulty = this.dataset.ai || 'medium';
      lsSet('ttt-ai', aiDifficulty);
      (document.querySelectorAll('#ai-difficulty button') as NodeListOf<HTMLButtonElement>).forEach(function (x) {
        x.setAttribute('aria-pressed', String(x.dataset.ai === aiDifficulty));
      });
      toast('Computer difficulty: ' + aiDifficulty);
    });
  });

  const rmBtn = $('rematch'); if (rmBtn) rmBtn.addEventListener('click', rematch);
  const leaveBtn = $('leave'); if (leaveBtn) leaveBtn.addEventListener('click', leave);
  const zoomBtn = $('zoom');
  if (zoomBtn) {
    zoomBtn.addEventListener('click', function () {
      zoomed = !zoomed;
      render();
      const sc = $('scroll');
      if (sc) {
        if (zoomed) {
          const target = sel >= 0 ? sel : (G && G.last >= 0 ? G.last : (N * N / 2) | 0);
          const px = (target % N + 0.5) / N, py = (((target / N) | 0) + 0.5) / N;
          sc.scrollLeft = px * sc.scrollWidth - sc.clientWidth / 2;
          sc.scrollTop = py * sc.scrollHeight - sc.clientHeight / 2;
        } else { sc.scrollLeft = 0; sc.scrollTop = 0; }
      }
    });
  }

  const vsCpu = $('vs-cpu'); if (vsCpu) vsCpu.addEventListener('click', function () { startLocal('cpu'); });
  const vsLocal = $('vs-local'); if (vsLocal) vsLocal.addEventListener('click', function () { startLocal('local'); });
  const createBtn = $('create'); if (createBtn) createBtn.addEventListener('click', createGame);
  const resBtn = $('resume');
  if (resBtn) {
    resBtn.addEventListener('click', function () {
      const c = lsGet('ttt-last');
      if (c && CODE_RE.test(c)) joinCode(c);
    });
  }

  const codeIn = $('code-in');
  if (codeIn) {
    codeIn.addEventListener('input', function (this: HTMLInputElement) {
      this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });
  }

  const joinForm = $('join-form');
  if (joinForm) {
    joinForm.addEventListener('submit', function (e: SubmitEvent) {
      e.preventDefault();
      const cIn = $('code-in') as HTMLInputElement;
      const code = (cIn ? cIn.value : '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      joinCode(code);
    });
  }

  const copyCodeBtn = $('copy-code');
  if (copyCodeBtn) {
    copyCodeBtn.addEventListener('click', function (this: HTMLButtonElement) {
      const btn = this, text = ctx.code;
      function fallback() {
        const el = $('code-text');
        if (el) {
          const range = document.createRange();
          range.selectNodeContents(el);
          const sel2 = window.getSelection();
          if (sel2) { sel2.removeAllRanges(); sel2.addRange(range); }
        }
        btn.textContent = 'Copied! ✓';
        setTimeout(function () { btn.textContent = 'Copy Code'; }, 2000);
      }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            btn.textContent = 'Copied! ✓';
            setTimeout(function () { btn.textContent = 'Copy Code'; }, 2000);
          }, fallback);
        } else {
          fallback();
        }
      } catch (e) { fallback(); }
    });
  }

  window.addEventListener('hashchange', function () {
    const h = location.hash.slice(1).toUpperCase();
    if (CODE_RE.test(h) && db && myId && !(ctx.kind === 'online' && ctx.code === h)) joinCode(h);
    else if (!h && ctx.kind === 'online') leave();
  });

  const q = $('quick');
  if (q) {
    QUICK.forEach(function (t) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = t;
      b.addEventListener('click', function () { sendChat('msg', t, 0); });
      q.appendChild(b);
    });
  }
  const wBtn = $('wallet'); if (wBtn) wBtn.addEventListener('click', openShop);
  const csBtn = $('chat-shop'); if (csBtn) csBtn.addEventListener('click', openShop);
  const sClose = $('shop-close'); if (sClose) sClose.addEventListener('click', function () { const s = $('shop'); if (s) s.close(); });
  const buyBtn = $('buy-btn'); if (buyBtn) buyBtn.addEventListener('click', buySelected);
  const winClose = $('win-close'); if (winClose) winClose.addEventListener('click', function () { const w = $('win'); if (w) w.close(); });
  const winShop = $('win-shop'); if (winShop) winShop.addEventListener('click', function () { const w = $('win'); if (w) w.close(); openShop(); });
  const winAgain = $('win-again'); if (winAgain) winAgain.addEventListener('click', function () { const w = $('win'); if (w) w.close(); rematch(); });
  const winLobby = $('win-lobby');
  if (winLobby) {
    winLobby.addEventListener('click', function () {
      const w = $('win') as HTMLDialogElement | null;
      if (w) w.close();
      leave();
    });
  }
  const unblockBanner = $('voice-audio-unblock-banner');
  if (unblockBanner) {
    unblockBanner.addEventListener('click', function () {
      playRemoteAudio().then(function () {
        toast('🔊 Opponent audio enabled!');
      });
      if (voiceAudioCtx && voiceAudioCtx.state === 'suspended') {
        voiceAudioCtx.resume().catch(function () {});
      }
    });
  }

  // Android Chrome: Any user touch/click on the page automatically unlocks remote audio if restricted
  document.addEventListener('pointerdown', function () {
    if (isVoiceActive && remoteVoiceStream && isVoiceSpeakerOn) {
      const audioEl = $('voice-remote-audio') as HTMLAudioElement | null;
      if (audioEl && audioEl.paused) {
        audioEl.play().then(function () {
          const banner = $('voice-audio-unblock-banner');
          if (banner) banner.hidden = true;
        }).catch(function () {});
      }
    }
  }, { passive: true });
  const guBtn = $('giveup-btn'); if (guBtn) guBtn.addEventListener('click', askGiveUp);
  const guKeep = $('gu-keep'); if (guKeep) guKeep.addEventListener('click', function () { const g = $('giveup'); if (g) g.close(); });
  const guYes = $('gu-yes'); if (guYes) guYes.addEventListener('click', doGiveUp);
  ['shop', 'win', 'giveup'].forEach(function (id) {
    const dlg = $(id);
    if (dlg) {
      dlg.addEventListener('click', function (this: HTMLDialogElement, e: MouseEvent) {
        if (e.target === this) this.close();
      });
    }
  });

  const chatForm = $('chat-form');
  if (chatForm) {
    chatForm.addEventListener('submit', function (e: SubmitEvent) {
      e.preventDefault();
      const input = $('chat-in'), text = input ? input.value.trim().slice(0, 200) : '';
      if (!text) return;
      if (points < MSG_COST) {
        costNote('You have 0 points. Typing a message costs ' + MSG_COST + ' point. Win a game to earn ' + WIN_POINTS + ', or tap a quick message above.');
        return;
      }
      if (ctx.kind === 'online' && !(db && myId)) {
        costNote('Not connected to the game yet. Try again in a moment.');
        return;
      }
      if (sendChat('msg', text, MSG_COST)) {
        if (input) input.value = '';
      } else {
        costNote('Sending too fast. Wait a second and tap Send again.');
      }
    });
  }

  function enableOnline() {
    const ok = !!(db && myId && canWrite !== false);
    const cr = $('create'); if (cr) cr.disabled = !ok;
    const ci = $('code-in'); if (ci) ci.disabled = !ok;
    const jb = $('join-btn'); if (jb) jb.disabled = !ok;
    const qm = $('qm'); if (qm) qm.disabled = !ok;
    if (ok) startNet();
    const hint = $('online-hint');
    if (hint) {
      if (ok) hint.textContent = 'Create a game to get a unique 6-character room code, or enter your friend’s code to join.';
      else if (db && myId && canWrite === false) hint.textContent = 'Online play is not permitted by database rules. Check your Firestore security rules.';
      else hint.textContent = 'Connecting to Firebase online services as guest…';
    }
    refreshResume();
  }

  // Pre-Lobby Login Screen Button Wirings
  const loginGoogleBtn = $('login-btn-google');
  if (loginGoogleBtn) loginGoogleBtn.addEventListener('click', function () { authWithGoogle(false); });

  const loginFbBtn = $('login-btn-fb');
  if (loginFbBtn) loginFbBtn.addEventListener('click', function () { authWithFacebook(false); });

  // Lobby Cloud Card Button Wirings
  const lobbySaveBtn = $('lobby-cloud-save-btn');
  if (lobbySaveBtn) {
    lobbySaveBtn.addEventListener('click', function () {
      syncToCloud(true);
      toast('☁️ Saving progress to cloud…');
    });
  }

  const lobbyLinkBtn = $('lobby-cloud-link-btn');
  if (lobbyLinkBtn) lobbyLinkBtn.addEventListener('click', function () { authWithGoogle(false); });

  const lobbyManageBtn = $('lobby-cloud-manage-btn');
  if (lobbyManageBtn) lobbyManageBtn.addEventListener('click', function () { openHub('account'); });

  const lobbySignoutBtn = $('lobby-cloud-signout-btn');
  if (lobbySignoutBtn) lobbySignoutBtn.addEventListener('click', authSignOut);

  // Header & Profile Account Shortcuts
  const openAccBtn = $('btn-open-account');
  if (openAccBtn) openAccBtn.addEventListener('click', function () { openHub('account'); });

  const syncTag = $('cloud-sync-tag');
  if (syncTag) syncTag.addEventListener('click', function () { openHub('account'); });

  const badgeAcc = $('badge-acc');
  if (badgeAcc) badgeAcc.addEventListener('click', function () { openHub('account'); });

  // Voice Chat Controls
  const voiceJoinBtn = $('voice-btn-join');
  if (voiceJoinBtn) voiceJoinBtn.addEventListener('click', joinVoice);

  const voiceMuteBtn = $('voice-btn-mute');
  if (voiceMuteBtn) voiceMuteBtn.addEventListener('click', toggleVoiceMute);

  const voiceSpeakerBtn = $('voice-btn-speaker');
  if (voiceSpeakerBtn) voiceSpeakerBtn.addEventListener('click', toggleVoiceSpeaker);

  const voiceLeaveBtn = $('voice-btn-leave');
  if (voiceLeaveBtn) voiceLeaveBtn.addEventListener('click', leaveVoice);

  window.addEventListener('beforeunload', leaveVoice);

  // Network connectivity synchronization
  window.addEventListener('online', function () {
    updateCloudStatus('syncing', 'Back online! Syncing…');
    syncToCloud(true);
  });

  window.addEventListener('offline', function () {
    updateCloudStatus('offline', 'Offline (Saved locally)');
  });

  // Lobby Daily Reward Claim Wiring
  const lobbyDailyClaimBtn = $('lobby-daily-claim-btn');
  if (lobbyDailyClaimBtn) {
    lobbyDailyClaimBtn.addEventListener('click', function () {
      claimDailyReward();
    });
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      updateDailyUI();
      if (hubTab === 'daily') renderHub();
      // Immediately pulse an active heartbeat if in an active online match
      if (ctx.kind === 'online' && gameRef && G && ctx.me && myId && G.status === 'playing' && !G.winner) {
        const now = Date.now();
        const updateData = ctx.me === 'X'
          ? { lastSeenX: now, hbX: now, activeX: true }
          : { lastSeenO: now, hbO: now, activeO: true };
        updateDoc(gameRef, updateData).catch(function () {});
      }
    }
  });

  // Initial render calls - all state variables are fully initialized now!
  updateWallet();
  renderModes();
  renderProfile();
  renderOnline();
  refreshHintButton();
  updateDailyUI();
  render();

  // Handle potential redirect result after signInWithRedirect / linkWithRedirect
  getRedirectResult(fbAuth)
    .then(async function (result) {
      if (result && result.user) {
        user = result.user;
        myId = result.user.uid;
        canWrite = true;
        enableOnline();
        toast('Welcome ' + (user.displayName || user.email || 'Player') + '!');
        await loadFromCloud(user.uid);
        renderProfile();
        updateLobbyCloudSection();
        enterLobby();
      }
    })
    .catch(function (err: any) {
      console.warn('Redirect sign-in error:', err);
      handleAuthError('Google', err);
    });

  // Authentication State Listener: Strictly require permanent authentication before entering lobby
  onAuthStateChanged(fbAuth, async function (u) {
    const sess = $('login-session-status');
    const isPermanent = isPermanentUser(u);

    if (isPermanent && u) {
      // Permanent Google or Facebook authenticated player: load profile, then enter lobby!
      user = u;
      myId = u.uid;
      canWrite = true;
      enableOnline();
      updateCloudStatus('syncing', 'Loading profile…');
      if (sess) sess.innerHTML = '<span>🟢 Authenticated! Entering lobby…</span>';
      await loadFromCloud(u.uid);
      renderProfile();
      updateLobbyCloudSection();
      enterLobby();
      const h = location.hash.slice(1).toUpperCase();
      if (CODE_RE.test(h) && db && myId) joinCode(h);
    } else {
      // Unauthenticated or anonymous guest: strictly do NOT render or allow access to game lobby!
      user = u; // Keep reference if anonymous so linkWithPopup can preserve guest progress
      myId = u ? u.uid : null;
      canWrite = false;
      showLoginScreen(true);
      if (sess) sess.innerHTML = '<span>⚡ Sign in with Google or Facebook to enter the lobby</span>';

      // Check if player has existing saved local progress to migrate
      let hasProgress = false;
      try {
        const prevMeta = lsGet('ttt-meta');
        if (prevMeta) {
          const pm = JSON.parse(prevMeta);
          if (pm.wins || pm.games || points > 0 || M.diamonds > 0) {
            hasProgress = true;
          }
        }
      } catch (e) {}

      const noteEl = $('login-guest-note');
      const hintEl = $('login-guest-hint');
      if (noteEl && hintEl) {
        if (hasProgress || points > 0 || M.diamonds > 0) {
          noteEl.hidden = false;
          hintEl.textContent = 'Existing progress detected (' + points + ' coins, ' + M.diamonds + ' Diamonds). Sign in with Google or Facebook to link and protect your progress permanently.';
        } else {
          noteEl.hidden = true;
        }
      }

      const h = location.hash.slice(1).toUpperCase();
      if (CODE_RE.test(h)) {
        if (sess) sess.innerHTML = '<span>🎮 Room invitation <b>' + h + '</b> detected. Sign in with Google or Facebook to join!</span>';
      }
    }
  });
})();
