/**
 * Copyright (c) 2026 Joerg Breitbart
 * @license MIT
 */

export interface IKeymap {
  [index: string]: string;
}

export interface IKeymaps {
  readonly layouts: readonly string[];
  readonly layoutIdx: Readonly<Record<string, number>>;
  readonly codes: readonly string[];
  readonly codeIdx: Readonly<Record<string, number>>;
  key(code: string, layout: string): string | undefined;
  keyIndexed(codeIdx: number, layoutIdx: number): string | undefined;
  getLayoutMap(layout: string): IKeymap;
}

export interface IMutableKeymaps extends IKeymaps {
  layouts: string[];
  layoutIdx: Record<string, number>;
  codes: string[];
  codeIdx: Record<string, number>;
  addCode(code: string): void;
  removeCode(code: string): void;
  register(layout: string, map: IKeymap): void;
  unregister(layout: string): void;
}

export interface ILayoutMatch {
  layout: string;
  match: number;
}

export interface IKeyResult {
  layouts: string[];
  certain: number;
  key: string | undefined | (string | undefined)[];
}

export interface IResolveKey {
  code: string;
  keys: string[];
}

export interface IResolveResult {
  layouts: string[];
  keys: IResolveKey[];
}

export type DiscardHandler = (code: string, key: string) => boolean | void;
