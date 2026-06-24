import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import getKeymaps from './keymaps.js';
import getKeymapsResolved from './keymapsResolved.js';
import StaticKeymaps from './StaticKeymaps.js';

const PROJECT_PATH = process.env.PWD ?? process.cwd();
const KEYMAPS_SUBFOLDER = 'layouts';
const KEYMAPS_PATH = path.join(PROJECT_PATH, KEYMAPS_SUBFOLDER);
const KEYMAPS_RESOLVED_SUBFOLDER = 'layouts_dead_resolved';
const KEYMAPS_RESOLVED_PATH = path.join(PROJECT_PATH, KEYMAPS_RESOLVED_SUBFOLDER);

const keymapsStatic = getKeymaps();
const keymapsResolvedStatic = getKeymapsResolved();


const RESERVED_CHARS = 'ABCDEFGZ'.split('');
const CODES = [
  'Backquote',
  'Backslash',
  'BracketLeft',
  'BracketRight',
  'Comma',
  'Digit0',
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Digit6',
  'Digit7',
  'Digit8',
  'Digit9',
  'Equal',
  'IntlBackslash',
  'IntlRo',
  'IntlYen',
  'KeyA',
  'KeyB',
  'KeyC',
  'KeyD',
  'KeyE',
  'KeyF',
  'KeyG',
  'KeyH',
  'KeyI',
  'KeyJ',
  'KeyK',
  'KeyL',
  'KeyM',
  'KeyN',
  'KeyO',
  'KeyP',
  'KeyQ',
  'KeyR',
  'KeyS',
  'KeyT',
  'KeyU',
  'KeyV',
  'KeyW',
  'KeyX',
  'KeyY',
  'KeyZ',
  'Minus',
  'Period',
  'Quote',
  'Semicolon',
  'Slash',
  'Space',
];


it('layouts are free of reserved chars ABCDEFGZ', () => {
  for (const layout of keymapsStatic.layouts) {
    const km = JSON.parse(fs.readFileSync(path.join(KEYMAPS_PATH, layout + '.json'), { encoding: 'utf-8' }));
    for (const code of CODES) {
      assert.strictEqual(RESERVED_CHARS.indexOf(km[code]), -1);
    }
  }
});
it('resolved layouts are free of reserved chars ABCDEFGZ', () => {
  for (const layout of keymapsResolvedStatic.layouts) {
    const km = JSON.parse(fs.readFileSync(path.join(KEYMAPS_RESOLVED_PATH, layout + '.json'), { encoding: 'utf-8' }));
    for (const code of CODES) {
      assert.strictEqual(RESERVED_CHARS.indexOf(km[code]), -1);
    }
  }
});

describe('StaticKeymaps', () => {
  it('keymaps contain all 51 CODES', () => {
    assert.deepStrictEqual(keymapsStatic.codes, CODES);
    assert.deepStrictEqual(keymapsResolvedStatic.codes, CODES);
  });
  it('keymaps match original', () => {
    const layouts = keymapsStatic.layouts;
    for (let i = 0; i < layouts.length; ++i) {
      const layout = layouts[i];
      const orig = fs.readFileSync(path.join(KEYMAPS_PATH, layout + '.json'), { encoding: 'utf-8' });
      assert.deepStrictEqual(keymapsStatic.getLayoutMap(layout), JSON.parse(orig));
    }
  });
  it('keymaps resolved match original', () => {
    const layouts = keymapsResolvedStatic.layouts;
    for (let i = 0; i < layouts.length; ++i) {
      const layout = layouts[i];
      const orig = fs.readFileSync(path.join(KEYMAPS_RESOLVED_PATH, layout + '.json'), { encoding: 'utf-8' });
      assert.deepStrictEqual(keymapsResolvedStatic.getLayoutMap(layout), JSON.parse(orig));
    }
  });
  describe('decodes correctly', () => {
    it('tree decompress', () => {
      // foo:     abcdefg
      //   bar:   z
      //     baz:  y
      const enc = ['foo|bar|baz', '0abcdefgZ1z(Z2y)'];
      const km = new StaticKeymaps(enc);
      // result is sorted
      assert.deepStrictEqual(km.layouts, ['bar', 'baz', 'foo']);
      assert.deepStrictEqual((km as any)._values, ['zbcdefg', 'zycdefg', 'abcdefg']);
    });
    it('dictionary replacements', () => {
      const DICT = ['G Z1', 'F()*+', 'E Z0', 'D<AA', 'C-./0123456', 'B0123456789'];

    });
  });
});
