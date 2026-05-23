/**
 * Copyright (c) 2026 Joerg Breitbart
 * @license MIT
 */


export interface IKeymap {
  [index: string]: string;
}

interface IKeymapMerged {
  acc: string;
  map: IKeymap;
  empty: {[index: string]: number[]};
  skip: {[index: string]: {[index: number]: string}};
  Space: {[index: number]: string};
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


export default class Detector {
  // copy of MAP.acc
  private _layouts: {[index: string]: number};
  // MAP.acc.keys
  private _acc: string[];
  // MAP.map.keys
  private _codeAcc: string[];
  // MAP.map.values
  private _values: string[][] = [];
  // {code: index}
  private _codes: {[index: string]: number} = {};
  // recorded codes
  private _rec: (string | undefined)[] = [];
  private _cached: ILayoutMatch[] | undefined;
  private _active: string = '';
  private _discardHandler: DiscardHandler = () => false;

  constructor(data: IKeymapMerged) {
    this._acc = data.acc.split('|');
    this._codeAcc = Object.keys(data.map).sort();
    // FIXME: ~12.3kB per instance
    // better: make it singleton and deal only with indices in instance
    this._layouts = {};
    for (let i = 0; i < this._acc.length; ++i) {
      this._layouts[this._acc[i]] = i;
    }
    let p = 0;
    for (const code of this._codeAcc) {
      this._codes[code] = p++;
      // FIXME: this gets really big in memory! (~100kB per instance)
      // better: stick with original string immutable? (~35kB singleton)
      this._values.push(data.map[code].split(''));
      this._rec.push(undefined);
    }
    // patch empty values
    for (const code in data.empty) {
      const line = this._values[this._codes[code]];
      const empty = data.empty[code];
      for (let i = 0; i < empty.length; ++i) {
        line[empty[i]] = '';
      }
    }
    // patch IntlRo & IntlYen (skip entries)
    for (const code in data.skip) {
      this._values[this._codes[code]] = new Array(this._acc.length).fill('');
      const line = this._values[this._codes[code]];
      const skip = data.skip[code];
      for (const map in skip) {
        line[map] = skip[map];
      }
    }
    // patch Space
    this._values[this._codes.Space] = new Array(this._acc.length).fill(' ');
    for (const map in data.Space) {
      this._values[this._codes.Space][map] = data.Space[map];
    }
  }

  /**
   * Free all internal resources.
   * The instance may not be used anymore after calling dispose.
   */
  public dispose() {
    this._discardHandler = () => false;
    this._layouts = {};
    this._acc = [];
    this._codeAcc = [];
    this._values = [];
    this._codes = {};
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
    return [...this._acc];
  }

  /**
   * Return list of supported key codes.
   */
  public get codes(): string[] {
    return [...this._codeAcc];
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
    if (layout && this._layouts[layout] === undefined) {
      throw new Error(`layout '${layout}' is not registered`);
    }
    this._active = layout;
  }

  /**
   * Register a custom layout.
   * Currently it is not possible to introduce new codes.
   */
  public registerLayout(layout: string, map: IKeymap): void {
    if (!layout || this._layouts[layout] !== undefined) {
      throw new Error(`layout '${layout}' is already registered`);
    }
    const pos = this._acc.length;
    this._layouts[layout] = pos;
    this._acc.push(layout);
    for (let i = 0; i < this._values.length; ++i) {
      this._values[i].push(map[this._codeAcc[i]]);
    }
    this._cached = undefined;
  }

  /**
   * Unregister a layout.
   * Will reset the active layout, if it was the unregistered one.
   */
  public unregisterLayout(layout: string): void {
    if (this._layouts[layout] === undefined) {
      throw new Error(`layout '${layout}' is not registered`);
    }
    const pos = this._layouts[layout];
    delete this._layouts[layout];
    for (const layout in this._layouts) {
      if (this._layouts[layout] > pos) {
        this._layouts[layout]--;
      }
    }
    this._acc.splice(pos, 1);
    for (let i = 0; i < this._values.length; ++i) {
      this._values[i].splice(pos, 1);
    }
    this._cached = undefined;
    if (this._active === layout) {
      this._active = '';
    }
  }

  /**
   * Get the layout map for a given or the active layout.
   */
  public getLayoutMap(layout?: string): IKeymap {
    const acc = this._layouts[layout ?? this._active];
    if (acc === undefined) {
      throw new Error(`layout '${layout}' is not registered`);
    }
    const result: IKeymap = {};
    for (let i = 0; i < this._codeAcc.length; ++i) {
      if (this._values[i][acc] !== undefined) {
        result[this._codeAcc[i]] = this._values[i][acc] as string;
      }
    }
    return result;
  }

  /**
   * Get a map of recorded key codes.
   */
  public getRecordedMap(): IKeymap {
    const result: IKeymap = {};
    for (let i = 0; i < this._codeAcc.length; ++i) {
      if (this._rec[i] !== undefined) {
        result[this._codeAcc[i]] = this._rec[i] as string;
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
      this._codes[code] !== undefined &&
      this._layouts[layout ?? this._active] !== undefined
    ) {
      return this._values[this._codes[code]][this._layouts[layout ?? this._active]];
    }
  }

  /**
   * Feed a key code and a key character to the detector.
   */
  public feed(code: string, key: string): void {
    const pos = this._codes[code];
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
      const cand = this._acc.map(e => ({ layout: e, match: 0 }));
      let c = 0;
      for (let k = 0; k < this._rec.length; ++k) {
        const v = this._rec[k];
        if (v) {
          c++;
          const values = this._values[k];
          for (let i = 0; i < this._acc.length; ++i) {
            if (v === values[i]) {
              cand[i].match++;
            }
          }
        }
      }
      this._cached = cand;
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
      layouts = [...this._acc];
    }
    const pos = this._codes[code];
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
    const codeAcc = this._values[pos];
    if (layouts.length === 1) {
      return {
        layouts,
        certain: last,
        key: codeAcc[this._layouts[layouts[0]]]
      };
    }
    const values = [];
    for (let i = 0; i < layouts.length; ++i) {
      values.push(codeAcc[this._layouts[layouts[i]]]);
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
      cands = [...this._acc];
    }
    const acc = cands.map(e => this._layouts[e]);
    const values = [];
    const value = new Set<string>();
    for (let i = 0; i < this._values.length; ++i) {
      if (this._rec[i]) {
        // don't handle key if it was already recorded
        continue;
      }
      value.clear();
      for (let k = 0; k < acc.length; ++k) {
        value.add(this._values[i][acc[k]]);
      }
      if (value.size > 1) {
        values.push({ code: this._codeAcc[i], keys: [...value] });
      }
    }
    values.sort((a, b) => b.keys.length - a.keys.length);
    return { layouts: cands, keys: values };
  }
}
