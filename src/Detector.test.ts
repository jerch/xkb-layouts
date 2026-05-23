import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import Detector, { type IKeymap } from './Detector.js';
import keymaps from './keymaps.js';
import keymapsResolved from './keymapsResolved.js';

const PROJECT_PATH = process.env.PWD ?? process.cwd();
const KEYMAPS_SUBFOLDER = 'layouts';
const KEYMAPS_PATH = path.join(PROJECT_PATH, KEYMAPS_SUBFOLDER);
const KEYMAPS_RESOLVED_SUBFOLDER = 'layouts_dead_resolved';
const KEYMAPS_RESOLVED_PATH = path.join(PROJECT_PATH, KEYMAPS_RESOLVED_SUBFOLDER);

describe('keymaps match original', () => {
  const dect = new Detector(keymaps);
  const layouts = dect.layouts;
  for (let i = 0; i < layouts.length; ++i) {
    const layout = layouts[i];
    it(layout, () => {
      const orig = fs.readFileSync(path.join(KEYMAPS_PATH, layout + '.json'), { encoding: 'utf-8' });
      assert.deepStrictEqual(dect.getLayoutMap(layout), JSON.parse(orig));
    });
  }
});

describe('keymaps resolved match original', () => {
  const dect = new Detector(keymapsResolved);
  const layouts = dect.layouts;
  for (let i = 0; i < layouts.length; ++i) {
    const layout = layouts[i];
    it(layout, () => {
      const orig = fs.readFileSync(path.join(KEYMAPS_RESOLVED_PATH, layout + '.json'), { encoding: 'utf-8' });
      assert.deepStrictEqual(dect.getLayoutMap(layout), JSON.parse(orig));
    });
  }
});

describe('detector unit tests', () => {
  it('active layout', () => {
    const dect = new Detector(keymaps);
    const codes = dect.codes;
    assert.strictEqual(dect.activeLayout, '');
    dect.activeLayout = '';
    assert.throws(() => dect.getLayoutMap());
    for (const code of codes) {
      assert.strictEqual(dect.getLayoutKey(code), undefined);
    }
    for (const layout of dect.layouts) {
      dect.activeLayout = layout;
      assert.strictEqual(dect.activeLayout, layout);
      assert.deepStrictEqual(dect.getLayoutMap(), dect.getLayoutMap(layout));
      const keymap = dect.getLayoutMap();
      for (const code of codes) {
        assert.strictEqual(dect.getLayoutKey(code), keymap[code]);
        assert.strictEqual(dect.getLayoutKey(code, layout), keymap[code]);
      }
    }
  });
  it('register', () => {
    const dect = new Detector(keymaps);
    const customMap = { 'KeyA': 'H', 'KeyB': 'E', 'KeyC': 'L', 'KeyD': 'L', 'KeyE': 'O' };
    dect.registerLayout('custom', customMap);
    assert.strictEqual(dect.layouts.includes('custom'), true);
    assert.deepStrictEqual(dect.getLayoutMap('custom'), customMap);
    dect.activeLayout = 'custom';
    assert.strictEqual(
      Object.keys(customMap).map(code => dect.getLayoutKey(code)).join(''),
      'HELLO'
    );
  });
  it('unregister', () => {
    const dect = new Detector(keymaps);
    const customMap = { 'KeyA': 'H', 'KeyB': 'E', 'KeyC': 'L', 'KeyD': 'L', 'KeyE': 'O' };
    dect.registerLayout('custom', customMap);
    const oldLayouts = dect.layouts;
    const maps: {[index: string]: IKeymap} = {};
    for (let i = 0; i < oldLayouts.length; ++i) {
      const layout = oldLayouts[i];
      if (i % 2) {
        dect.unregisterLayout(layout);
      } else {
        maps[layout] = dect.getLayoutMap(layout);
      }
    }
    for (let i = 0; i < oldLayouts.length; ++i) {
      const layout = oldLayouts[i];
      if (i % 2) {
        assert.strictEqual(dect.layouts.includes(layout), false);
        assert.throws(() => dect.getLayoutMap(layout));
        assert.strictEqual(dect.getLayoutKey('KeyA', layout), undefined);
      } else {
        assert.strictEqual(dect.layouts.includes(layout), true);
        assert.deepStrictEqual(dect.getLayoutMap(layout), maps[layout]);
        assert.strictEqual(dect.getLayoutKey('KeyA', layout), maps[layout].KeyA);
      }
    }
  });
  it('getLayoutKey', () => {
    const dect = new Detector(keymaps);
    // known code and known layout yields a char
    assert.strictEqual(dect.getLayoutKey('KeyA', 'de'), 'a');
    // known code and unknown layout yields nothing
    assert.strictEqual(dect.getLayoutKey('KeyA', 'foo'), undefined);
    // unknown code and known layout yields nothing
    assert.strictEqual(dect.getLayoutKey('Enter', 'de'), undefined);
    // unknown code and unknown layout yields nothing
    assert.strictEqual(dect.getLayoutKey('Enter', 'foo'), undefined);
  });
  describe('key recording', () => {
    it('feed & getRecordedMap', () => {
      const dect = new Detector(keymaps);
      assert.deepStrictEqual(dect.getRecordedMap(), {});
      // should record known codes
      dect.feed('KeyA', 'a');
      dect.feed('KeyB', 'b');
      assert.deepStrictEqual(dect.getRecordedMap(), { KeyA: 'a', KeyB: 'b' });
      // should swallow unknown codes silently
      dect.feed('Enter', 'x');
      assert.deepStrictEqual(dect.getRecordedMap(), { KeyA: 'a', KeyB: 'b' });
      // overwriting recorded key resets map
      dect.feed('KeyA', 'x');
      assert.deepStrictEqual(dect.getRecordedMap(), { KeyA: 'x' });
    });
    it('discardHandler (false | void)', () => {
      const dect = new Detector(keymaps);
      const discards: [string, string][] = [];
      const handler = (code: string, key: string) => {
        discards.push([code, key]);
      }
      dect.setDiscard(handler);
      dect.feed('KeyA', 'a');
      dect.feed('KeyB', 'b');
      assert.deepStrictEqual(dect.getRecordedMap(), { KeyA: 'a', KeyB: 'b' });
      dect.feed('KeyA', 'x');
      assert.deepStrictEqual(dect.getRecordedMap(), { KeyA: 'x' });
      assert.deepStrictEqual(discards, [['KeyA', 'x']]);
      dect.feed('KeyA', 'z');
      assert.deepStrictEqual(dect.getRecordedMap(), { KeyA: 'z' });
      assert.deepStrictEqual(discards, [['KeyA', 'x'], ['KeyA', 'z']]);
      // clearDiscard
      dect.clearDiscard();
      dect.feed('KeyA', 'a');
      assert.deepStrictEqual(dect.getRecordedMap(), { KeyA: 'a' });
      assert.deepStrictEqual(discards, [['KeyA', 'x'], ['KeyA', 'z']]);
    });
    it('discardHandler (true)', () => {
      const dect = new Detector(keymaps);
      const discards: [string, string][] = [];
      const handler = (code: string, key: string) => {
        discards.push([code, key]);
        return true;
      }
      dect.setDiscard(handler);
      dect.feed('KeyA', 'a');
      dect.feed('KeyB', 'b');
      assert.deepStrictEqual(dect.getRecordedMap(), { KeyA: 'a', KeyB: 'b' });
      dect.feed('KeyA', 'x');
      assert.deepStrictEqual(dect.getRecordedMap(), { KeyA: 'a', KeyB: 'b' });
      assert.deepStrictEqual(discards, [['KeyA', 'x']]);
      dect.feed('KeyA', 'z');
      assert.deepStrictEqual(dect.getRecordedMap(), { KeyA: 'a', KeyB: 'b' });
      assert.deepStrictEqual(discards, [['KeyA', 'x'], ['KeyA', 'z']]);
      // clearDiscard
      dect.clearDiscard();
      dect.feed('KeyA', 't');
      assert.deepStrictEqual(dect.getRecordedMap(), { KeyA: 't' });
      assert.deepStrictEqual(discards, [['KeyA', 'x'], ['KeyA', 'z']]);
    });
  });
});
