/**
 * Copyright (c) 2026 Joerg Breitbart
 * @license MIT
 */

import { MutableKeymaps } from "./MutableKeymaps.js";
import type { DiscardHandler, IKeymap, IKeymaps, IKeyResult, ILayoutMatch, IMutableKeymaps, IResolveResult } from "./Types.js";


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
    return this._maps.getLayoutMap(layout ?? this._active);
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
      return this._maps.keyIndexed(this._maps.codeIdx[code], this._maps.layoutIdx[layout ?? this._active]);
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
            if (v === this._maps.keyIndexed(k, i)) {
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
        key: this._maps.keyIndexed(pos, this._maps.layoutIdx[layouts[0]])
      };
    }
    const values = [];
    for (let i = 0; i < layouts.length; ++i) {
      values.push(this._maps.keyIndexed(pos, this._maps.layoutIdx[layouts[i]]));
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
        const key = this._maps.keyIndexed(i, acc[k]);
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
