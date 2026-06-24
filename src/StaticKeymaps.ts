/**
 * Copyright (c) 2026 Joerg Breitbart
 * @license MIT
 */

import type { IKeymap, IKeymaps } from "./Types.js";


/**
 * The static keymaps are created with some hardcoded assumptions:
 * - key codes are fixed to the list below (51 keys)
 * - data gets further compressed with a fixed dictionary (chars B-G)
 * - empty positions are marked with A
 * - data is joined over Z
 *
 * FIXME: test on characters ABCDEFGZ during compression
 */
const DICT = ['G Z1', 'F()*+', 'E Z0', 'D<AA', 'C-./0123456', 'B0123456789'];
const CODES_STR = 'Backquote|Backslash|BracketLeft|BracketRight|Comma|Digit0|Digit1|Digit2|Digit3|Digit4|Digit5|Digit6|Digit7|Digit8|Digit9|Equal|IntlBackslash|IntlRo|IntlYen|KeyA|KeyB|KeyC|KeyD|KeyE|KeyF|KeyG|KeyH|KeyI|KeyJ|KeyK|KeyL|KeyM|KeyN|KeyO|KeyP|KeyQ|KeyR|KeyS|KeyT|KeyU|KeyV|KeyW|KeyX|KeyY|KeyZ|Minus|Period|Quote|Semicolon|Slash|Space';
const CODE_IDX: {[index: string]: number} = {};
let CODES: string[] = [];


function f<T>(o: T): Readonly<T> {
  return Object.freeze(o) as Readonly<T>;
}


if (!CODES.length) {
  CODES = CODES_STR.split('|');
  for (let i = 0; i < CODES.length; ++i) CODE_IDX[CODES[i]] = i;
  f(CODES);
  f(CODE_IDX);
}


/**
 * Restore keymap from parent and diff.
 */
function undiff(p: string, d: string): string {
  const off = (d.length >> 1) + 1;
  const pos = d.slice(off).toUpperCase();
  for (let i = 1; i < off; i++) {
    const x = pos.charCodeAt(i - 1) - 40;
    p = p.slice(0, x) + d[i] + p.slice(x + 1);
  }
  return p;
}

/**
 * Static version of keymaps.
 * Decodes the tree compressed keymaps data and
 * returns a static readonly version of keymaps.
 */
export default class StaticKeymaps implements IKeymaps {
  public readonly layouts: readonly string[];
  public readonly layoutIdx: Readonly<Record<string, number>>;
  public readonly codes: readonly string[];
  public readonly codeIdx: Readonly<Record<string, number>>;
  private readonly _values: ReadonlyArray<string>;

  constructor(enc: string[]) {
    const st = [];
    const ls = enc[0].split('|');
    const re: string[][] = new Array(ls.length);
    let dt = [enc[1]];
    for (const r of DICT) {
      dt[0] = dt[0].replaceAll(r[0], r.slice(1));
    }
    dt = dt[0].split('Z');
    for (let i = 0; i < ls.length; ++i) {
      const e = dt[i];
      const p = e.charCodeAt(0) - 48;
      const r: string = p > 0 ? undiff(st[p - 1], e) : e.slice(1);
      st[p] = r;
      re[i] = [ls[i], r];
    }
    re.sort((a, b) => a[0] > b[0] ? 1 : -1);
    this.layouts = f(re.map(e => e[0]));
    const layoutIdx: {[index: string]: number} = {};
    for (let i = 0; i < this.layouts.length; ++i) layoutIdx[this.layouts[i]] = i;
    this.layoutIdx = f(layoutIdx);
    this._values = f(re.map(e => e[1]));
    this.codes = CODES;
    this.codeIdx = CODE_IDX;
  }

  /**
   * Get character key for key code and layout.
   */
  public key(code: string, layout: string): string | undefined {
    if (this.codeIdx[code] !== undefined && this.layoutIdx[layout] !== undefined) {
      return this.keyIndexed(this.codeIdx[code], this.layoutIdx[layout]);
    }
  }

  /**
   * Get character key for key code index and layout index.
   * This is faster than `.key` for tight loops.
   */
  public keyIndexed(codeIdx: number, layoutIdx: number): string | undefined {
    const v = this._values[layoutIdx][codeIdx];
    return v !== 'A' ? v : '';
  }

  /**
   * Get the keymap for a layout.
   */
  public getLayoutMap(layout: string): IKeymap {
    const layoutIdx = this.layoutIdx[layout];
    if (layoutIdx === undefined) {
      throw new Error(`layout '${layout}' unknown`);
    }
    const result: IKeymap = {};
    for (let i = 0; i < this.codes.length; ++i) {
      const v = this.keyIndexed(i, layoutIdx);
      if (v !== undefined) {
        result[this.codes[i]] = v;
      }
    }
    return result;
  }
}
