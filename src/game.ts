import type {
  Game,
  InitApi,
  RenderApi,
  UpdateApi,
} from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import {
  ACTIONS,
  BINDINGS,
  BOARD_CX,
  BOARD_CY,
  CELL_PITCH,
  CUES,
  FACET_DEBUG_VERSION,
  FALL_SECONDS_PER_ROW,
  GAMEOVER_ITEMS,
  GAMEOVER_TITLE_TEXT,
  GEM_KINDS,
  GRID_COLS,
  GRID_ROWS,
  HUD_CHAIN_LABEL,
  LEVEL_TARGET_STEP,
  LEVELCLEAR_ITEMS,
  LEVELCLEAR_TITLE_TEXT,
  PAUSED_ITEMS,
  PAUSED_TITLE_TEXT,
  REFUSAL_SECONDS,
  STEP_SECONDS,
  SWAP_SECONDS,
  TAGLINE_TEXT,
  TITLE_ITEMS,
  TITLE_TEXT,
  WAVE_SECONDS,
} from "./constants";

export type GemKind =
  "ruby" | "amber" | "citrine" | "jade" | "beryl" | "sapphire" | "amethyst";
export type Cut = "plain" | "brilliant" | "star" | "prism";
export type Screen =
  "title" | "howto" | "playing" | "paused" | "levelclear" | "gameover";
export type Phase = "idle" | "swapping" | "resolving";
export type PointerDevice = "mouse" | "pen" | "touch";
export interface CellRef {
  readonly col: number;
  readonly row: number;
}
export interface GemState {
  readonly col: number;
  readonly row: number;
  readonly kind: GemKind | null;
  readonly cut: Cut;
  readonly strain: number;
  readonly fell: number;
}
export interface BoardState {
  readonly cols: number;
  readonly rows: number;
  readonly cells: readonly GemState[];
}
export interface RefusalState {
  readonly a: CellRef;
  readonly b: CellRef;
  readonly timer: number;
}
export interface PointerState {
  readonly x: number;
  readonly y: number;
  readonly down: boolean;
  readonly device: PointerDevice;
}
export interface FacetState {
  readonly screen: Screen;
  readonly menuIndex: number;
  readonly board: BoardState;
  readonly phase: Phase;
  readonly chainStep: number;
  readonly swapTimer: number;
  readonly stepTimer: number;
  readonly score: number;
  readonly level: number;
  readonly levelScore: number;
  readonly lastCleared: number;
  readonly lastPoints: number;
  readonly lastWaves: number;
  readonly moveScore: number;
  readonly bestMove: number;
  readonly bestChain: number;
  readonly selection: CellRef | null;
  readonly offer: CellRef | null;
  readonly refusal: RefusalState | null;
  readonly armedTarget: string | null;
  readonly pointer: PointerState;
  readonly simTime: number;
  readonly muted: boolean;
  readonly refillKinds: readonly string[];
}
export interface FacetDebugApi {
  readonly version: number;
  [key: string]: unknown;
}
export const BACKGROUND = "#07101d";
const imgs = new Map<string, ImageBitmap>();
const empty: BoardState = { cols: 0, rows: 0, cells: [] };
const letters: Record<string, GemKind> = {
  R: "ruby",
  A: "amber",
  C: "citrine",
  J: "jade",
  B: "beryl",
  S: "sapphire",
  M: "amethyst",
};
let swap: [CellRef, CellRef] | null = null;
const x = (c: number) =>
    BOARD_CX - ((GRID_COLS - 1) * CELL_PITCH) / 2 + c * CELL_PITCH,
  y = (r: number) =>
    BOARD_CY - ((GRID_ROWS - 1) * CELL_PITCH) / 2 + r * CELL_PITCH,
  ix = (c: number, r: number) => r * 8 + c,
  valid = (c: number, r: number) => c >= 0 && r >= 0 && c < 8 && r < 8,
  adj = (a: CellRef, b: CellRef) =>
    Math.abs(a.col - b.col) + Math.abs(a.row - b.row) === 1;
const copy = (s: DeepReadonly<FacetState>): FacetState => ({
  ...s,
  board: { ...s.board, cells: s.board.cells.map((g) => ({ ...g })) },
  refillKinds: [...s.refillKinds],
  pointer: { ...s.pointer },
  selection: s.selection && { ...s.selection },
  offer: s.offer && { ...s.offer },
  refusal: s.refusal && {
    a: { ...s.refusal.a },
    b: { ...s.refusal.b },
    timer: s.refusal.timer,
  },
});
function initial(muted = false): FacetState {
  return {
    screen: "title",
    menuIndex: 0,
    board: empty,
    phase: "idle",
    chainStep: 0,
    swapTimer: 0,
    stepTimer: 0,
    score: 0,
    level: 1,
    levelScore: 0,
    lastCleared: 0,
    lastPoints: 0,
    lastWaves: 0,
    moveScore: 0,
    bestMove: 0,
    bestChain: 0,
    selection: null,
    offer: null,
    refusal: null,
    armedTarget: null,
    pointer: { x: 0, y: 0, down: false, device: "mouse" },
    simTime: 0,
    muted,
    refillKinds: Array(8).fill(""),
  };
}
function token(t: string, c: number, r: number): GemState {
  const m = /^([RACJBSMX])([0-3])([bs])?$/.exec(t);
  if (!m) throw new RangeError("invalid gem token");
  return {
    col: c,
    row: r,
    kind: m[1] === "X" ? null : letters[m[1]],
    cut:
      m[1] === "X"
        ? "prism"
        : m[3] === "b"
          ? "brilliant"
          : m[3] === "s"
            ? "star"
            : "plain",
    strain: +m[2],
    fell: 0,
  };
}
function runs(b: DeepReadonly<BoardState>) {
  const out: number[][] = [];
  for (const vert of [false, true])
    for (let a = 0; a < 8; a++) {
      let p = 0;
      while (p < 8) {
        const k = b.cells[ix(vert ? a : p, vert ? p : a)]?.kind;
        let q = p + 1;
        while (k && q < 8 && b.cells[ix(vert ? a : q, vert ? q : a)].kind === k)
          q++;
        if (k && q - p >= 3)
          out.push(
            Array.from({ length: q - p }, (_, n) =>
              ix(vert ? a : p + n, vert ? p + n : a),
            ),
          );
        p = q;
      }
    }
  return out;
}
function exchange(
  b: DeepReadonly<BoardState>,
  a: CellRef,
  z: CellRef,
): BoardState {
  const c = b.cells.map((g) => ({ ...g })),
    i = ix(a.col, a.row),
    j = ix(z.col, z.row),
    ga = c[i],
    gb = c[j];
  c[i] = { ...gb, col: a.col, row: a.row, fell: 0 };
  c[j] = { ...ga, col: z.col, row: z.row, fell: 0 };
  return { cols: 8, rows: 8, cells: c };
}
function productive(b: DeepReadonly<BoardState>, a: CellRef, z: CellRef) {
  return (
    b.cells[ix(a.col, a.row)]?.cut === "prism" ||
    b.cells[ix(z.col, z.row)]?.cut === "prism" ||
    runs(exchange(b, a, z)).length > 0
  );
}
function legal(b: DeepReadonly<BoardState>) {
  if (b.cells.length !== 64) return false;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      for (const [dc, dr] of [
        [1, 0],
        [0, 1],
      ])
        if (
          valid(c + dc, r + dr) &&
          productive(b, { col: c, row: r }, { col: c + dc, row: r + dr })
        )
          return true;
  return false;
}
function deal(): BoardState {
  for (;;) {
    const c: GemState[] = [];
    for (let r = 0; r < 8; r++)
      for (let a = 0; a < 8; a++) {
        let choices = [...GEM_KINDS];
        if (a > 1 && c[ix(a - 1, r)].kind === c[ix(a - 2, r)].kind)
          choices = choices.filter((k) => k !== c[ix(a - 1, r)].kind);
        if (r > 1 && c[ix(a, r - 1)].kind === c[ix(a, r - 2)].kind)
          choices = choices.filter((k) => k !== c[ix(a, r - 1)].kind);
        c.push({
          col: a,
          row: r,
          kind: choices[Math.floor(Math.random() * choices.length)],
          cut: "plain",
          strain: 0,
          fell: r + 1,
        });
      }
    const b = { cols: 8, rows: 8, cells: c };
    if (legal(b)) return b;
  }
}
function ask(s: DeepReadonly<FacetState>, a: CellRef, b: CellRef): FacetState {
  if (!valid(a.col, a.row) || !valid(b.col, b.row))
    throw new RangeError("cell outside board");
  if (s.phase !== "idle" || !adj(a, b) || !productive(s.board, a, b))
    return { ...copy(s), refusal: { a, b, timer: 0 } };
  swap = [a, b];
  return {
    ...copy(s),
    board: exchange(s.board, a, b),
    phase: "swapping",
    swapTimer: 0,
    moveScore: 0,
    refusal: null,
  };
}
function resolve(s: DeepReadonly<FacetState>, step: number): FacetState | null {
  let seed = runs(s.board).flat();
  if (step === 1 && swap) {
    const [a, b] = swap,
      ga = s.board.cells[ix(a.col, a.row)],
      gb = s.board.cells[ix(b.col, b.row)];
    if (ga.cut === "prism" || gb.cut === "prism") {
      const k = ga.cut === "prism" ? gb.kind : ga.kind;
      seed = s.board.cells.flatMap((g, i) =>
        g.kind === k || g.cut === "prism" ? [i] : [],
      );
    }
  }
  const clear = new Set(seed);
  if (!clear.size) return null;
  const q = [...clear];
  while (q.length) {
    const i = q.shift()!,
      g = s.board.cells[i],
      c = i % 8,
      r = Math.floor(i / 8);
    const add = (a: number, z: number) => {
      const j = ix(a, z);
      if (valid(a, z) && !clear.has(j)) {
        clear.add(j);
        q.push(j);
      }
    };
    if (g.cut === "brilliant")
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) if (dx || dy) add(c + dx, r + dy);
    if (g.cut === "star")
      for (let n = 0; n < 8; n++) {
        add(n, r);
        add(c, n);
      }
    for (const [d, e] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      if (valid(c + d, r + e) && s.board.cells[ix(c + d, r + e)].strain === 3)
        add(c + d, r + e);
  }
  let points = 0;
  clear.forEach(
    (i) =>
      (points += (s.board.cells[i].strain === 3 ? 20 : 10) * Math.min(step, 8)),
  );
  const out: GemState[] = Array(64);
  for (let c = 0; c < 8; c++) {
    const keep: GemState[] = [];
    for (let r = 7; r >= 0; r--)
      if (!clear.has(ix(c, r))) keep.push({ ...s.board.cells[ix(c, r)] });
    let w = 7;
    for (const g of keep) {
      out[ix(c, w)] = { ...g, col: c, row: w, fell: w - g.row };
      w--;
    }
    for (let r = w; r >= 0; r--) {
      const k = s.refillKinds[c]?.[r]
        ? letters[s.refillKinds[c][r]]
        : GEM_KINDS[Math.floor(Math.random() * 7)];
      out[ix(c, r)] = {
        col: c,
        row: r,
        kind: k,
        cut: "plain",
        strain: 0,
        fell: r + 1 + w - r,
      };
    }
  }
  return {
    ...copy(s),
    board: { cols: 8, rows: 8, cells: out },
    phase: "resolving",
    chainStep: step,
    swapTimer: 0,
    stepTimer: 0,
    score: s.score + points,
    levelScore: s.levelScore + points,
    lastCleared: clear.size,
    lastPoints: points,
    lastWaves: 0,
    moveScore: s.moveScore + points,
    bestChain: Math.max(s.bestChain, step),
  };
}
const targets = (screen: Screen) =>
  screen === "playing"
    ? [{ id: "pause", x: 1040, y: 25, w: 160, h: 72 }]
    : screen === "howto"
      ? [{ id: "back", x: 45, y: 610, w: 150, h: 72 }]
      : screen === "title" ||
          screen === "paused" ||
          screen === "levelclear" ||
          screen === "gameover"
        ? [0, 1].map((i) => ({
            id: `menu-${i}`,
            x: 490,
            y: 450 + i * 88,
            w: 300,
            h: 72,
          }))
        : [];
function snap(s: DeepReadonly<FacetState>) {
  const fall = Math.max(0, ...s.board.cells.map((g) => g.fell));
  return {
    ...copy(s),
    version: 1,
    levelTarget: 2000 * s.level,
    multiplier: Math.min(s.chainStep, 8),
    lastFall: fall,
    stepHold:
      s.lastWaves * WAVE_SECONDS + fall * FALL_SECONDS_PER_ROW + STEP_SECONDS,
    legalSwap: legal(s.board),
    board: {
      ...s.board,
      cells: s.board.cells.map((g) => ({ ...g, x: x(g.col), y: y(g.row) })),
    },
    refusal: s.refusal ? { a: s.refusal.a, b: s.refusal.b } : null,
    targets: targets(s.screen),
  };
}
function debug(): FacetDebugApi {
  return {
    version: FACET_DEBUG_VERSION,
    reset: (s: DeepReadonly<FacetState>) => initial(s.muted),
    reconcile: copy,
    snapshot: snap,
    setScreen: (s: DeepReadonly<FacetState>, screen: Screen) => ({
      ...copy(s),
      screen,
    }),
    setMenuIndex: (s: DeepReadonly<FacetState>, menuIndex: number) => ({
      ...copy(s),
      menuIndex,
    }),
    loadBoard: (s: DeepReadonly<FacetState>, rows: string[]) => ({
      ...copy(s),
      board: {
        cols: 8,
        rows: 8,
        cells: rows.flatMap((l, r) =>
          l
            .trim()
            .split(/\s+/)
            .map((t, c) => token(t, c, r)),
        ),
      },
    }),
    dealBoard: (s: DeepReadonly<FacetState>) => ({ ...copy(s), board: deal() }),
    clearBoard: (s: DeepReadonly<FacetState>) => ({ ...copy(s), board: empty }),
    setGem: (s: DeepReadonly<FacetState>, c: number, r: number, t: string) => {
      const a = s.board.cells.map((g) => ({ ...g }));
      a[ix(c, r)] = token(t, c, r);
      return { ...copy(s), board: { cols: 8, rows: 8, cells: a } };
    },
    setScore: (s: DeepReadonly<FacetState>, score: number) => ({
      ...copy(s),
      score,
    }),
    setLevel: (s: DeepReadonly<FacetState>, level: number) => ({
      ...copy(s),
      level,
    }),
    setLevelScore: (s: DeepReadonly<FacetState>, levelScore: number) => ({
      ...copy(s),
      levelScore,
    }),
    setBestChain: (s: DeepReadonly<FacetState>, bestChain: number) => ({
      ...copy(s),
      bestChain,
    }),
    setBestMove: (s: DeepReadonly<FacetState>, bestMove: number) => ({
      ...copy(s),
      bestMove,
    }),
    setMoveScore: (s: DeepReadonly<FacetState>, moveScore: number) => ({
      ...copy(s),
      moveScore,
    }),
    setSelection: (s: DeepReadonly<FacetState>, col: number, row: number) => ({
      ...copy(s),
      selection: { col, row },
    }),
    clearSelection: (s: DeepReadonly<FacetState>) => ({
      ...copy(s),
      selection: null,
    }),
    setOffer: (s: DeepReadonly<FacetState>, col: number, row: number) => ({
      ...copy(s),
      offer: { col, row },
    }),
    clearOffer: (s: DeepReadonly<FacetState>) => ({ ...copy(s), offer: null }),
    clearRefusal: (s: DeepReadonly<FacetState>) => ({
      ...copy(s),
      refusal: null,
    }),
    clearChain: (s: DeepReadonly<FacetState>) => ({
      ...copy(s),
      phase: "idle",
      chainStep: 0,
      swapTimer: 0,
      stepTimer: 0,
    }),
    requestSwap: (
      s: DeepReadonly<FacetState>,
      ca: number,
      ra: number,
      cb: number,
      rb: number,
    ) => ask(s, { col: ca, row: ra }, { col: cb, row: rb }),
  } as FacetDebugApi;
}
function choose(s: DeepReadonly<FacetState>): FacetState {
  if (s.screen === "title")
    return s.menuIndex
      ? { ...copy(s), screen: "howto" }
      : { ...initial(s.muted), screen: "playing", board: deal() };
  if (s.screen === "paused")
    return s.menuIndex
      ? { ...copy(s), screen: "title", board: empty }
      : { ...copy(s), screen: "playing" };
  if (s.screen === "levelclear")
    return s.menuIndex
      ? { ...copy(s), screen: "title", board: empty }
      : {
          ...copy(s),
          screen: "playing",
          level: s.level + 1,
          levelScore: 0,
          bestChain: 0,
          bestMove: 0,
          board: deal(),
        };
  if (s.screen === "gameover")
    return s.menuIndex
      ? { ...copy(s), screen: "title", board: empty }
      : { ...initial(s.muted), screen: "playing", board: deal() };
  return copy(s);
}
function button(
  c: CanvasRenderingContext2D,
  t: { x: number; y: number; w: number; h: number },
  label: string,
  hot: boolean,
) {
  c.fillStyle = hot ? "#3ce0cb" : "#172c47";
  c.fillRect(t.x, t.y, t.w, t.h);
  c.strokeStyle = "#a7f5ff";
  c.lineWidth = 3;
  c.strokeRect(t.x, t.y, t.w, t.h);
  c.fillStyle = hot ? "#07101d" : "white";
  c.font = "bold 24px sans-serif";
  c.textAlign = "center";
  c.fillText(label, t.x + t.w / 2, t.y + 45);
}
function board(s: DeepReadonly<FacetState>, c: CanvasRenderingContext2D) {
  const f = imgs.get("board-frame");
  if (f) c.drawImage(f, 320, 76, 640, 640);
  for (const g of s.board.cells) {
    const key =
        g.cut === "prism" ? `prism-${g.strain}` : `${g.kind}-${g.strain}`,
      im = imgs.get(key);
    if (im) c.drawImage(im, x(g.col) - 32, y(g.row) - 32);
    if (g.cut === "brilliant" || g.cut === "star") {
      const o = imgs.get(g.cut);
      if (o) c.drawImage(o, x(g.col) - 32, y(g.row) - 32);
    }
    if (g.cut !== "plain") {
      c.strokeStyle = "#8ff5ff";
      c.beginPath();
      c.arc(x(g.col), y(g.row), 31, 0, 7);
      c.stroke();
    }
  }
  if (s.selection) {
    c.strokeStyle = "#fff49a";
    c.lineWidth = 4;
    c.strokeRect(x(s.selection.col) - 35, y(s.selection.row) - 35, 70, 70);
  }
}
export const game: Game<FacetState, FacetDebugApi> = {
  async initialize(api: InitApi<FacetState>) {
    for (const a of ACTIONS) api.input.register(a, { keys: [...BINDINGS[a]] });
    const ps: string[] = [];
    for (const k of GEM_KINDS) for (let i = 0; i < 4; i++) ps.push(`${k}-${i}`);
    for (let i = 0; i < 4; i++) ps.push(`prism-${i}`);
    ps.push("brilliant", "star", "board-frame");
    await Promise.all(
      ps.map(async (p) =>
        imgs.set(p, await api.assets.loadImage(`gems/${p}.png`)),
      ),
    );
    for (const n of [
      "clear-burst",
      "flawed-detonation",
      "cut-flash",
      "cut-aura",
    ])
      await api.assets.load(`fx/${n}/system.json`);
    for (const q of Object.values(CUES).filter((q) => q !== "clear"))
      await api.audio.load(q, `audio/${q}.wav`);
    for (let i = 1; i <= 8; i++)
      await api.audio.load(`chain-${i}`, `audio/chain-${i}.wav`);
    await api.audio.load("music-title", "audio/title.wav");
    await api.audio.load("music-play", "audio/play.wav");
    api.diagnostics.register("screen", (s) => s.screen);
    api.diagnostics.register("phase", (s) => s.phase);
    api.diagnostics.register("score", (s) => s.score);
    return [initial(), debug()];
  },
  update(s, api: UpdateApi, dt) {
    let n = { ...copy(s), simTime: s.simTime + dt, muted: api.audio.muted() };
    if (api.input.pressed("mute")) {
      api.audio.setMuted(!n.muted);
      n = { ...n, muted: !n.muted };
    }
    const title = n.screen === "title" || n.screen === "howto";
    if (!api.audio.looping(title ? "music-title" : "music-play"))
      api.audio.loop(title ? "music-title" : "music-play");
    api.audio.stop(title ? "music-play" : "music-title");
    const count = ["title", "paused", "levelclear", "gameover"].includes(
      n.screen,
    )
      ? 2
      : 0;
    if (count && api.input.pressed("up"))
      n = { ...n, menuIndex: (n.menuIndex + 1) % 2 };
    if (count && api.input.pressed("down"))
      n = { ...n, menuIndex: (n.menuIndex + 1) % 2 };
    if (count && api.input.pressed("confirm")) n = choose(n);
    if (
      api.input.pressed("pause") &&
      (n.screen === "playing" || n.screen === "paused")
    )
      n = {
        ...n,
        screen: n.screen === "playing" ? "paused" : "playing",
        menuIndex: 0,
      };
    if (
      api.input.pressed("back") &&
      (n.screen === "howto" || n.screen === "gameover")
    )
      n = { ...n, screen: "title", menuIndex: n.screen === "howto" ? 1 : 0 };
    if (n.screen !== "playing") return n;
    if (n.refusal)
      n = {
        ...n,
        refusal:
          n.refusal.timer + dt >= REFUSAL_SECONDS
            ? null
            : { ...n.refusal, timer: n.refusal.timer + dt },
      };
    if (n.phase === "swapping") {
      if (n.swapTimer + dt >= SWAP_SECONDS) {
        const z = resolve(n, 1);
        n = z ?? { ...n, phase: "idle", swapTimer: 0 };
        if (z) api.audio.play("chain-1");
      } else n = { ...n, swapTimer: n.swapTimer + dt };
    } else if (n.phase === "resolving") {
      const hold =
        Math.max(...n.board.cells.map((g) => g.fell)) * FALL_SECONDS_PER_ROW +
        STEP_SECONDS;
      if (n.stepTimer + dt >= hold) {
        const z = resolve(n, n.chainStep + 1);
        if (z) {
          n = z;
          api.audio.play(`chain-${Math.min(8, z.chainStep)}`);
        } else {
          n = {
            ...n,
            phase: "idle",
            chainStep: 0,
            stepTimer: 0,
            bestMove: Math.max(n.bestMove, n.moveScore),
          };
          swap = null;
          if (n.levelScore >= n.level * LEVEL_TARGET_STEP)
            n = { ...n, screen: "levelclear", menuIndex: 0 };
          else if (!legal(n.board))
            n = { ...n, screen: "gameover", menuIndex: 0 };
        }
      } else n = { ...n, stepTimer: n.stepTimer + dt };
    }
    return n;
  },
  render(s, api: RenderApi) {
    const c = api.ctx;
    c.fillStyle = BACKGROUND;
    c.fillRect(0, 0, 1280, 720);
    const g = c.createRadialGradient(640, 360, 20, 640, 360, 700);
    g.addColorStop(0, "#183652");
    g.addColorStop(1, BACKGROUND);
    c.fillStyle = g;
    c.fillRect(0, 0, 1280, 720);
    if (s.board.cells.length) board(s, c);
    if (s.screen === "title") {
      c.fillStyle = "white";
      c.font = "900 110px sans-serif";
      c.textAlign = "center";
      c.fillText(TITLE_TEXT, 640, 240);
      c.font = "22px sans-serif";
      c.fillStyle = "#8cebf0";
      c.fillText(TAGLINE_TEXT, 640, 300);
      TITLE_ITEMS.forEach((v, i) =>
        button(c, targets("title")[i], v, s.menuIndex === i),
      );
    } else if (s.screen === "playing") {
      c.fillStyle = "white";
      c.font = "bold 24px sans-serif";
      c.textAlign = "left";
      c.fillText(`SCORE ${s.score}     LEVEL ${s.level}`, 55, 55);
      c.fillStyle = "#16304d";
      c.fillRect(400, 35, 500, 18);
      c.fillStyle = "#48ddc7";
      c.fillRect(
        400,
        35,
        500 * Math.min(1, s.levelScore / (s.level * LEVEL_TARGET_STEP)),
        18,
      );
      if (s.phase === "resolving")
        c.fillText(`${HUD_CHAIN_LABEL} ×${Math.min(8, s.chainStep)}`, 960, 135);
      button(c, targets("playing")[0], "PAUSE", false);
    } else if (s.screen === "howto") {
      c.fillStyle = "white";
      c.font = "bold 42px sans-serif";
      c.textAlign = "center";
      c.fillText("HOW TO PLAY", 640, 90);
      c.font = "21px sans-serif";
      [
        "Drag one gem onto a neighbor and release.",
        "Match 3+; clears strain nearby gems.",
        "Flawed gems burst with touching clears and score double.",
        "Four makes a brilliant; five a prism; crossings a star.",
        "Chains multiply. Reach the target before moves run out.",
        "↑ ↓ menus • Enter/Space choose • Esc/P pause • M mute",
      ].forEach((v, i) => c.fillText(v, 640, 185 + i * 62));
      button(c, targets("howto")[0], "BACK", false);
    } else {
      const title =
          s.screen === "paused"
            ? PAUSED_TITLE_TEXT
            : s.screen === "levelclear"
              ? LEVELCLEAR_TITLE_TEXT
              : GAMEOVER_TITLE_TEXT,
        items =
          s.screen === "paused"
            ? PAUSED_ITEMS
            : s.screen === "levelclear"
              ? LEVELCLEAR_ITEMS
              : GAMEOVER_ITEMS;
      c.fillStyle = "rgba(2,8,18,.88)";
      c.fillRect(320, 110, 640, 530);
      c.fillStyle = "white";
      c.font = "bold 54px sans-serif";
      c.textAlign = "center";
      c.fillText(title, 640, 230);
      items.forEach((v, i) =>
        button(c, targets(s.screen)[i], v, s.menuIndex === i),
      );
    }
  },
};
