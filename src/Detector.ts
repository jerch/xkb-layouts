/**
 * Copyright (c) 2026 Joerg Breitbart
 * @license MIT
 */


export interface IKeymap {
  [index: string]: string;
}

export interface IKeymaps {
  layouts: string[];
  layoutIdx: {[index: string]: number};
  codes: string[];
  codeIdx: {[index: string]: number};
  getKey(codeIdx: number, layoutIdx: number): string | undefined;
}

export interface IMutableKeymaps extends IKeymaps {
  addCode(code: string): void;
  removeCode(code: string): void;
  register(layout: string, map: IKeymap): void;
  unregister(layout: string): void;
}

interface ILayoutMatch {
  layout: string;
  match: number;
}

interface IKeyResult {
  layouts: string[];
  certain: number;
  key: string | undefined | (string | undefined)[];
}

interface IResolveKey {
  code: string;
  keys: string[];
}

interface IResolveResult {
  layouts: string[];
  keys: IResolveKey[];
}

type DiscardHandler = (code: string, key: string) => boolean | void;


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
  public layoutIdx: {[index: string]: number};
  public codes: string[];
  public codeIdx: {[index: string]: number};
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
          line.push(maps.getKey(codeIdx, layoutIdx) ?? '');
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

  public getKey(codeIdx: number, layoutIdx: number): string | undefined {
    return this._values[codeIdx][layoutIdx];
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


/**
 * Keymap detector.
 */
export default class Detector {
  private _rec: (string | undefined)[] = [];
  private _cached: ILayoutMatch[] | undefined;
  private _active: string = '';
  private _discardHandler: DiscardHandler = () => false;

  constructor(private _maps: IKeymaps) {
    this._rec = new Array(_maps.codes.length).fill(undefined);
  }

  /**
   * Free all internal resources.
   * The instance may not be used anymore after calling dispose.
   */
  public dispose() {
    this._maps = undefined!;
    this._discardHandler = () => false;
    this._active = '';
    this._cached = undefined;
  }

  /**
   * Set a discard handler to get notified, when the recorded characters
   * get swiped due to a mismatch with an earlier recorded character.
   * This is a strong indicator, that the user changed the keyboard layout
   * on OS side.
   * The handler gets called before the swipe happens and the should expect
   * `code` and `key` as arguments for further inspection.
   * Return `true` from the handler to suppress the swipe (useful to not lose
   * changes from detector methods called in the handler itself).
   */
  public setDiscard(handler: DiscardHandler): void {
    this._discardHandler = handler;
  }

  /**
   * Clear the discard handler.
   */
  public clearDiscard() {
    this._discardHandler = () => false;
  }

  /**
   * Reset detector.
   */
  public reset(): void {
    // FIXME: implement onReset event
    this._rec = this._rec.map(e => undefined);
    this._cached = undefined;
  }

  /**
   * Return list of registered layouts.
   */
  public get layouts(): string[] {
    return [...this._maps.layouts];
  }

  /**
   * Return list of supported key codes.
   */
  public get codes(): string[] {
    return [...this._maps.codes];
  }

  /**
   * Get active layout.
   */
  public get activeLayout(): string {
    return this._active;
  }

  /**
   * Set active layout. The layout must be registered.
   */
  public set activeLayout(layout: string) {
    if (layout && this._maps.layoutIdx[layout] === undefined) {
      throw new Error(`layout '${layout}' is not registered`);
    }
    this._active = layout;
  }

  /**
   * Register a custom layout.
   */
  public registerLayout(layout: string, map: IKeymap): void {
    if ((this._maps as IMutableKeymaps).register === undefined) {
      this._maps = new MutableKeymaps(this._maps);
    }
    (this._maps as IMutableKeymaps).register(layout, map);
    this._cached = undefined;
  }

  /**
   * Unregister a layout.
   * Will reset the active layout, if it was the unregistered one.
   */
  public unregisterLayout(layout: string): void {
    if ((this._maps as IMutableKeymaps).unregister === undefined) {
      this._maps = new MutableKeymaps(this._maps);
    }
    (this._maps as IMutableKeymaps).unregister(layout);
    this._cached = undefined;
    if (this._active === layout) {
      this._active = '';
    }
  }

  /**
   * Get the layout map for a given or the active layout.
   */
  public getLayoutMap(layout?: string): IKeymap {
    const layoutIdx = this._maps.layoutIdx[layout ?? this._active];
    if (layoutIdx === undefined) {
      throw new Error(`layout '${layout}' is not registered`);
    }
    const result: IKeymap = {};
    for (let i = 0; i < this._maps.codes.length; ++i) {
      const v = this._maps.getKey(i, layoutIdx);
      if (v !== undefined) {
        result[this._maps.codes[i]] = v;
      }
    }
    return result;
  }

  /**
   * Get a map of recorded key codes.
   */
  public getRecordedMap(): IKeymap {
    const result: IKeymap = {};
    for (let i = 0; i < this._maps.codes.length; ++i) {
      if (this._rec[i] !== undefined) {
        result[this._maps.codes[i]] = this._rec[i] as string;
      }
    }
    return result;
  }

  /**
   * Get character key for key code and layout.
   * Uses the currently active layout, if `layout` is omitted.
   * The known key codes can be requested with `.codes`,
   * the registered layouts with `.layouts`.
   */
  public getLayoutKey(code: string, layout?: string): string | undefined {
    if (
      this._maps.codeIdx[code] !== undefined &&
      this._maps.layoutIdx[layout ?? this._active] !== undefined
    ) {
      return this._maps.getKey(this._maps.codeIdx[code], this._maps.layoutIdx[layout ?? this._active]);
    }
  }

  /**
   * Feed a key code and a key character to the detector.
   */
  public feed(code: string, key: string): void {
    const pos = this._maps.codeIdx[code];
    if (pos !== undefined) {
      this._cached = undefined;
      if (this._rec[pos] && this._rec[pos] !== key) {
        // The key value should never change for the same layout,
        // so we treat a sudden change as a layout change.
        if (this._discardHandler(code, key)) {
          return;
        }
        this.reset();
      }
      this._rec[pos] = key;
    }
  }

  /**
   * Shows all known layouts and their degree of matching mappings
   * sorted descending (likely layouts first).
   * Ideally there is only one leading layout with a match of 1.
   * If the leading match is not 1, then the user uses an
   * unknown or custom layout.
   */
  public matches(): ILayoutMatch[] {
    if (!this._cached) {
      this._cached = this._maps.layouts.map(e => ({ layout: e, match: 0 }));
      let c = 0;
      for (let k = 0; k < this._rec.length; ++k) {
        const v = this._rec[k];
        if (v) {
          c++;
          for (let i = 0; i < this._maps.layouts.length; ++i) {
            if (v === this._maps.getKey(k, i)) {
              this._cached[i].match++;
            }
          }
        }
      }
      if (c) {
        this._cached.sort((a, b) => b.match - a.match);
        for (let i = 0; i < this._cached.length; ++i) {
          this._cached[i].match /= c;
        }
      }
    }
    return this._cached;
  }

  /**
   * Tries to resolve a key code to a key character.
   * If `certain` is 1 then the result matches the listed layouts.
   * Ideally only one layout is returned, then the detector has seen enough
   * key events in `feed`.
   * If multiple layouts are returned but only one key, then the layout is
   * not yet fully determined but the key code is already known from `feed`.
   * When multiple keys are returned, then the character is still undetermined
   * and the layout needs further resolving with resolve.
   * A certain value lesser than 1 can have different reasons:
   * - not enough key event fed yet (multiple layouts or keys returned)
   * - user has an unknown or custom layout (check match value of `matches`)
   * If `certain` is 0 the result should not be used as the detector
   * has not seen any key events at all.
   */
  public guessKey(code: string): IKeyResult {
    const lm = this.matches();
    let layouts = [];
    let last = 0;
    for (let i = 0; i < lm.length; ++i) {
      if (lm[i].match === 0) {
        break;
      }
      if (lm[i].match === 1) {
        last = 1;
        layouts.push(lm[i].layout);
      } else if (lm[i].match >= last) {
        last = lm[i].match;
        layouts.push(lm[i].layout);
      } else {
        break;
      }
    }
    if (!layouts.length) {
      layouts = [...this._maps.layouts];
    }
    const pos = this._maps.codeIdx[code];
    if (pos === undefined) {
      return {
        layouts,
        certain: last,
        key: undefined
      };
    }
    if (this._rec[pos] !== undefined) {
      return {
        layouts,
        certain: 1,
        key: this._rec[pos]
      };
    }
    if (layouts.length === 1) {
      return {
        layouts,
        certain: last,
        key: this._maps.getKey(pos, this._maps.layoutIdx[layouts[0]])
      };
    }
    const values = [];
    for (let i = 0; i < layouts.length; ++i) {
      values.push(this._maps.getKey(pos, this._maps.layoutIdx[layouts[i]]));
    }
    return {
      layouts,
      certain: last / new Set(values).size,
      key: values
    };
  }

  /**
   * Calculate distance to resolve keyboard layout.
   * Returns the candicate layouts and a list of keys resolving layout ambiguity.
   * The key list is sorted descending by candidate differences for a key code
   * (picking a high difference code needs less follow-up steps).
   * The user should be asked to press the corresponding key and the key event
   * should be fed to `feed`.
   * Repeat this process until this method returns only one layout.
   */
  public resolve(): IResolveResult {
    const lm = this.matches();
    let cands = [];
    let last = 0;
    for (let i = 0; i < lm.length; ++i) {
      if (lm[i].match === 0) {
        break;
      }
      if (lm[i].match === 1) {
        last = 1;
        cands.push(lm[i].layout);
      } else if (lm[i].match >= last) {
        last = lm[i].match;
        cands.push(lm[i].layout);
      } else {
        break;
      }
    }
    if (cands.length === 1) {
      return { layouts: cands, keys: [] };
    }
    if (!cands.length) {
      cands = [...this._maps.layouts];
    }
    const acc = cands.map(e => this._maps.layoutIdx[e]);
    const values = [];
    const value = new Set<string>();
    for (let i = 0; i < this._maps.codes.length; ++i) {
      if (this._rec[i]) {
        // don't handle key if it was already recorded
        continue;
      }
      value.clear();
      for (let k = 0; k < acc.length; ++k) {
        const key = this._maps.getKey(i, acc[k]);
        if (key !== undefined) {
          value.add(key);
        }
      }
      if (value.size > 1) {
        values.push({ code: this._maps.codes[i], keys: [...value] });
      }
    }
    values.sort((a, b) => b.keys.length - a.keys.length);
    return { layouts: cands, keys: values };
  }
}
