/**
 * Copyright (c) 2026 Joerg Breitbart
 * @license MIT
 */

import type { IKeymap, IKeymaps, IMutableKeymaps } from "./Types.js";


/**
 * Mutable version of keymaps.
 * By default the detector uses the static shared version of the keymaps
 * to save memory - static holds ~35kB in memory for unshifted layouts
 * for all detector instances, while this instance needs ~120kB per instance.
 * On a register or unregister request the static version
 * gets replaced by this mutable one allowing code and layout changes,
 * e.g. to add a custom layout on-the-fly.
 */
export class MutableKeymaps implements IMutableKeymaps {
  public layouts: string[];
  public layoutIdx: Record<string, number>;
  public codes: string[];
  public codeIdx: Record<string, number>;
  private _values: string[][] = [];

  constructor(maps?: IKeymaps) {
    if (maps) {
      this.layouts = [...maps.layouts];
      this.layoutIdx = Object.assign({}, maps.layoutIdx);
      this.codes = [...maps.codes];
      this.codeIdx = Object.assign({}, maps.codeIdx);
      for (let codeIdx = 0; codeIdx < this.codes.length; ++codeIdx) {
        const line: string[] = [];
        for (let layoutIdx = 0; layoutIdx < this.layouts.length; ++layoutIdx) {
          line.push(maps.keyIndexed(codeIdx, layoutIdx) ?? '');
        }
        this._values.push(line);
      }
    } else {
      this.layouts = [];
      this.layoutIdx = {};
      this.codes = [];
      this.codeIdx = {}
    }
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
    return this._values[codeIdx][layoutIdx];
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
      const v = this._values[i][layoutIdx];
      if (v !== undefined) {
        result[this.codes[i]] = v;
      }
    }
    return result;
  }

  /**
   * Add code to keymaps.
   * The key values of registered layouts will be set to undefined.
   */
  public addCode(code: string): void {
    if (!code || this.codeIdx[code] !== undefined) {
      throw new Error(`code '${code}' is already registered`);
    }
    const pos = this.codes.length;
    this.codeIdx[code] = pos;
    this.codes.push(code);
    this._values.push(new Array(this.layouts.length).fill(undefined));
  }

  /**
   * Remove a code from keymaps.
   */
  public removeCode(code: string): void {
    if (this.codeIdx[code] === undefined) {
      throw new Error(`code '${code}' is not registered`);
    }
    const pos = this.codeIdx[code];
    delete this.codeIdx[code];
    for (const _code in this.codeIdx) {
      if (this.codeIdx[_code] > pos) {
        this.codeIdx[_code]--;
      }
    }
    this.codes.splice(pos, 1);
    this._values.splice(pos, 1);
  }

  /**
   * Register a custom layout.
   * Note that only known codes are transferred.
   * Use `addCode` to introduce new codes to the keymaps.
   */
  public register(layout: string, map: IKeymap): void {
    if (!layout || this.layoutIdx[layout] !== undefined) {
      throw new Error(`layout '${layout}' is already registered`);
    }
    const pos = this.layouts.length;
    this.layoutIdx[layout] = pos;
    this.layouts.push(layout);
    for (let i = 0; i < this._values.length; ++i) {
      // NOTE: pushes undefined for non-existent codes
      this._values[i].push(map[this.codes[i]]);
    }
  }

  /**
   * Unregister a layout.
   */
  public unregister(layout: string): void {
    if (this.layoutIdx[layout] === undefined) {
      throw new Error(`layout '${layout}' is not registered`);
    }
    const pos = this.layoutIdx[layout];
    delete this.layoutIdx[layout];
    for (const _layout in this.layoutIdx) {
      if (this.layoutIdx[_layout] > pos) {
        this.layoutIdx[_layout]--;
      }
    }
    this.layouts.splice(pos, 1);
    for (let i = 0; i < this._values.length; ++i) {
      this._values[i].splice(pos, 1);
    }
  }
}
