import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import Detector, { IKeymap, MutableKeymaps } from './Detector.js';
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

describe('keymaps match original in mutable keymaps', () => {
  const dect = new Detector(keymaps);
  const layouts = dect.layouts;
  dect.registerLayout('custom', { 'KeyA': 'H', 'KeyB': 'E', 'KeyC': 'L', 'KeyD': 'L', 'KeyE': 'O' });
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

describe('keymaps resolved match original in mutable keymaps', () => {
  const dect = new Detector(keymapsResolved);
  const layouts = dect.layouts;
  dect.registerLayout('custom', { 'KeyA': 'H', 'KeyB': 'E', 'KeyC': 'L', 'KeyD': 'L', 'KeyE': 'O' });
  for (let i = 0; i < layouts.length; ++i) {
    const layout = layouts[i];
    it(layout, () => {
      const orig = fs.readFileSync(path.join(KEYMAPS_RESOLVED_PATH, layout + '.json'), { encoding: 'utf-8' });
      assert.deepStrictEqual(dect.getLayoutMap(layout), JSON.parse(orig));
    });
  }
});

describe('MutableKeymaps unit tests', () => {
  it('empty ctor', () => {
    const km = new MutableKeymaps();
    assert.deepStrictEqual(km.layouts, []);
    assert.deepStrictEqual(km.layoutIdx, {});
    assert.deepStrictEqual(km.codes, []);
    assert.deepStrictEqual(km.codeIdx, {});
  });
  it('getKey yields same value - keymaps', () => {
    const km = new MutableKeymaps(keymaps);
    for (let l = 0; l < keymaps.layouts.length; ++l) {
      for (let c = 0; c < keymaps.codes.length; ++c) {
        assert.deepStrictEqual(
          km.getKey(km.codeIdx[km.codes[c]], km.layoutIdx[km.layouts[l]]),
          keymaps.getKey(keymaps.codeIdx[keymaps.codes[c]], keymaps.layoutIdx[keymaps.layouts[l]])
        );
      }
    }
  });
  it('getKey yields same value - keymapsRevoslved', () => {
    const km = new MutableKeymaps(keymapsResolved);
    for (let l = 0; l < keymapsResolved.layouts.length; ++l) {
      for (let c = 0; c < keymapsResolved.codes.length; ++c) {
        assert.deepStrictEqual(
          km.getKey(km.codeIdx[km.codes[c]], km.layoutIdx[km.layouts[l]]),
          keymapsResolved.getKey(
            keymapsResolved.codeIdx[keymapsResolved.codes[c]],
            keymapsResolved.layoutIdx[keymapsResolved.layouts[l]]
          )
        );
      }
    }
  });
  it('addCode', () => {
    const km = new MutableKeymaps();
    km.addCode('foo');
    km.addCode('bar');
    assert.deepStrictEqual(km.codes, ['foo', 'bar']);
    assert.deepStrictEqual(km.codeIdx, {'foo': 0, 'bar': 1});
    assert.throws(() => km.addCode('foo'));
  });
  it('removeCode', () => {
    const km = new MutableKeymaps();
    km.addCode('foo');
    km.addCode('bar');
    km.removeCode('foo');
    assert.deepStrictEqual(km.codes, ['bar']);
    assert.deepStrictEqual(km.codeIdx, {'bar': 0});
    assert.throws(() => km.removeCode('foo'));
    km.addCode('foo');
    assert.deepStrictEqual(km.codes, ['bar', 'foo']);
    assert.deepStrictEqual(km.codeIdx, {'bar': 0, 'foo': 1});
  });
  it('addCode/removeCode does not corrupt existing data', () => {
    const km = new MutableKeymaps(keymaps);
    km.addCode('foo');
    km.removeCode('KeyQ');
    for (let l = 0; l < keymaps.layouts.length; ++l) {
      const layout = keymaps.layouts[l];
      for (let c = 0; c < keymaps.codes.length; ++c) {
        const code = keymaps.codes[c];
        if (km.codes.includes(code)) {
          assert.notStrictEqual(km.codeIdx[code], undefined);
          assert.deepStrictEqual(
            km.getKey(km.codeIdx[code], km.layoutIdx[layout]),
            keymaps.getKey(keymaps.codeIdx[code], keymaps.layoutIdx[layout])
          );
        } else {
          assert.strictEqual(km.codeIdx[code], undefined);
        }
      }
    }
  });
  it('addCode creates undefined key values', () => {
    const km = new MutableKeymaps(keymaps);
    km.addCode('foo');
    for (let l = 0; l < keymaps.layouts.length; ++l) {
      const layout = keymaps.layouts[l];
      assert.deepStrictEqual(km.getKey(km.codeIdx['foo'], km.layoutIdx[layout]), undefined);
    }
  });
  it('register', () => {
    const km = new MutableKeymaps();
    km.addCode('foo');
    km.addCode('bar');
    km.register('one', { 'foo': '1', 'bar': '2', 'baz': '3' });
    km.register('two', { 'foo': '11', 'bar': '22', 'baz': '33' });
    assert.deepStrictEqual(km.layouts, ['one', 'two']);
    assert.deepStrictEqual(km.layoutIdx, {'one': 0, 'two': 1});
    assert.deepStrictEqual(km.getKey(km.codeIdx['foo'], km.layoutIdx['one']), '1');
    assert.deepStrictEqual(km.getKey(km.codeIdx['bar'], km.layoutIdx['one']), '2');
    assert.deepStrictEqual(km.getKey(km.codeIdx['foo'], km.layoutIdx['two']), '11');
    assert.deepStrictEqual(km.getKey(km.codeIdx['bar'], km.layoutIdx['two']), '22');
    assert.deepStrictEqual(km.codeIdx['baz'], undefined);
    assert.throws(() => km.register('one', { 'foo': '1', 'bar': '2', 'baz': '3' }));
  });
  it('unregister', () => {
    const km = new MutableKeymaps();
    km.addCode('foo');
    km.addCode('bar');
    km.register('one', { 'foo': '1', 'bar': '2', 'baz': '3' });
    km.register('two', { 'foo': '11', 'bar': '22', 'baz': '33' });
    km.register('thr', { 'foo': '111', 'bar': '222', 'baz': '333' });
    km.unregister('two');
    assert.deepStrictEqual(km.layouts, ['one', 'thr']);
    assert.deepStrictEqual(km.layoutIdx, {'one': 0, 'thr': 1});
    assert.deepStrictEqual(km.getKey(km.codeIdx['foo'], km.layoutIdx['one']), '1');
    assert.deepStrictEqual(km.getKey(km.codeIdx['bar'], km.layoutIdx['one']), '2');
    assert.deepStrictEqual(km.getKey(km.codeIdx['foo'], km.layoutIdx['thr']), '111');
    assert.deepStrictEqual(km.getKey(km.codeIdx['bar'], km.layoutIdx['thr']), '222');
    assert.throws(() => km.unregister('two'));
  });
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
  it('matches', () => {
    const km = new MutableKeymaps();
    km.addCode('foo');
    km.addCode('bar');
    km.addCode('baz');
    km.addCode('boo');
    km.register('1', { 'foo': '1', 'bar': '2', 'baz': '3' });
    km.register('2', { 'foo': '1', 'bar': '2', 'baz': '33' });
    km.register('3', { 'foo': '1', 'bar': '222', 'baz': '333' });
    const dect = new Detector(km);

    // narrow foo --> bar --> baz
    dect.feed('foo', '1');
    assert.deepStrictEqual(dect.matches(), [{ layout: '1', match: 1 }, { layout: '2', match: 1 }, { layout: '3', match: 1 }]);
    dect.feed('bar', '2');
    assert.deepStrictEqual(dect.matches(), [{ layout: '1', match: 1 }, { layout: '2', match: 1 }, { layout: '3', match: 0.5 }]);
    dect.feed('baz', '3');
    assert.deepStrictEqual(dect.matches(), [{ layout: '1', match: 1 }, { layout: '2', match: 2/3 }, { layout: '3', match: 1/3 }]);
    
    dect.reset();
    assert.deepStrictEqual(dect.matches(), [{ layout: '1', match: 0 }, { layout: '2', match: 0 }, { layout: '3', match: 0 }]);
    
    dect.feed('foo', '1');
    dect.feed('bar', '222');
    assert.deepStrictEqual(dect.matches(), [{ layout: '3', match: 1 }, { layout: '1', match: 0.5 }, { layout: '2', match: 0.5 }]);
    dect.feed('baz', '333');
    assert.deepStrictEqual(dect.matches(), [{ layout: '3', match: 1 }, { layout: '1', match: 1/3 }, { layout: '2', match: 1/3 }]);
    // conflicting input resets recorded state and matches
    dect.feed('baz', '3');
    assert.deepStrictEqual(dect.matches(), [{ layout: '1', match: 1 }, { layout: '2', match: 0 }, { layout: '3', match: 0 }]);
    
    // narrow baz --> bar --> foo
    dect.feed('baz', '33');
    assert.deepStrictEqual(dect.matches(), [{ layout: '2', match: 1 }, { layout: '1', match: 0 }, { layout: '3', match: 0 }]);
    dect.feed('bar', '2');
    assert.deepStrictEqual(dect.matches(), [{ layout: '2', match: 1 }, { layout: '1', match: 0.5 }, { layout: '3', match: 0 }]);
    dect.feed('foo', '1');
    assert.deepStrictEqual(dect.matches(), [{ layout: '2', match: 1 }, { layout: '1', match: 2/3 }, { layout: '3', match: 1/3 }]);
    
    dect.reset();
    
    // unknown key lowers match
    dect.feed('foo', '1');
    dect.feed('bar', '2');
    dect.feed('baz', '3');
    dect.feed('boo', '4');
    assert.deepStrictEqual(dect.matches(), [{ layout: '1', match: 3/4 }, { layout: '2', match: 2/4 }, { layout: '3', match: 1/4 }]);
  });
  describe('guessKey', () => {
    it('empty record state', () => {
      const km = new MutableKeymaps();
      km.addCode('foo');
      km.addCode('bar');
      km.addCode('baz');
      km.addCode('boo');
      km.register('1', { 'foo': '1', 'bar': '2', 'baz': '3' });
      km.register('2', { 'foo': '1', 'bar': '2', 'baz': '33' });
      km.register('3', { 'foo': '1', 'bar': '222', 'baz': '333' });
      const dect = new Detector(km);
      // known code: certainty 0 always emits all keys
      assert.deepStrictEqual(dect.guessKey('foo'), { layouts: ['1', '2', '3'], certain: 0, key: ['1', '1', '1'] });
      assert.deepStrictEqual(dect.guessKey('bar'), { layouts: ['1', '2', '3'], certain: 0, key: ['2', '2', '222'] });
      assert.deepStrictEqual(dect.guessKey('baz'), { layouts: ['1', '2', '3'], certain: 0, key: ['3', '33', '333'] });
      assert.deepStrictEqual(dect.guessKey('boo'), { layouts: ['1', '2', '3'], certain: 0, key: [undefined, undefined, undefined] });
      // unknown code: key is undefined
      assert.deepStrictEqual(dect.guessKey('nul'), { layouts: ['1', '2', '3'], certain: 0, key: undefined });
    });
    it('with recorded state', () => {
      const km = new MutableKeymaps();
      km.addCode('foo');
      km.addCode('bar');
      km.addCode('baz');
      km.addCode('boo');
      km.register('1', { 'foo': '1', 'bar': '2', 'baz': '3' });
      km.register('2', { 'foo': '1', 'bar': '2', 'baz': '33' });
      km.register('3', { 'foo': '1', 'bar': '222', 'baz': '333' });
      const dect = new Detector(km);
      dect.feed('foo', '1');
      dect.feed('bar', '2');
      dect.feed('boo', '4');
      // recorded state: certainty is 1, key is string
      assert.deepStrictEqual(dect.guessKey('foo'), { layouts: ['1', '2'], certain: 1, key: '1' });
      assert.deepStrictEqual(dect.guessKey('bar'), { layouts: ['1', '2'], certain: 1, key: '2' });
      // undefined in keymap still produces from recorded state
      assert.deepStrictEqual(dect.guessKey('boo'), { layouts: ['1', '2'], certain: 1, key: '4' });
      // ambiguous: selected layouts match for 2/3 + keys are 2 ==> 1/3 certainty
      assert.deepStrictEqual(dect.guessKey('baz'), { layouts: ['1', '2'], certain: 1/3, key: ['3', '33'] });
      // unknown code: still produces undefined with layout match certainty
      assert.deepStrictEqual(dect.guessKey('nul'), { layouts: ['1', '2'], certain: 2/3, key: undefined });

      dect.reset();
      dect.feed('bar', '222');
      // layout is one: return single key with certainty 1 (==match)
      assert.deepStrictEqual(dect.guessKey('foo'), { layouts: ['3'], certain: 1, key: '1' });
      assert.deepStrictEqual(dect.guessKey('bar'), { layouts: ['3'], certain: 1, key: '222' });
      assert.deepStrictEqual(dect.guessKey('baz'), { layouts: ['3'], certain: 1, key: '333' });
      dect.feed('boo', '4');
      // with unknown codes certainty is less except for recorded code
      assert.deepStrictEqual(dect.guessKey('foo'), { layouts: ['3'], certain: 1/2, key: '1' });
      assert.deepStrictEqual(dect.guessKey('bar'), { layouts: ['3'], certain: 1, key: '222' });
      assert.deepStrictEqual(dect.guessKey('baz'), { layouts: ['3'], certain: 1/2, key: '333' });
    });
  });
  describe.only('resolve', () => {
    it('empty record state should emit all layouts', () => {
      const km = new MutableKeymaps();
      km.addCode('foo');
      km.addCode('bar');
      km.addCode('baz');
      km.addCode('boo');
      km.register('1', { 'foo': '1', 'bar': '2', 'baz': '3' });
      km.register('2', { 'foo': '1', 'bar': '2', 'baz': '33' });
      km.register('3', { 'foo': '1', 'bar': '222', 'baz': '333' });
      const dect = new Detector(km);
      // baz before bar as it resolves faster
      assert.deepStrictEqual(
        dect.resolve(),
        { layouts: ['1', '2', '3'], keys: [{ code: 'baz', keys: ['3', '33', '333'] }, { code: 'bar', keys: ['2', '222'] }] }
      );
    });
    it('resolve loop', () => {
      const km = new MutableKeymaps();
      km.addCode('foo');
      km.addCode('bar');
      km.addCode('baz');
      km.addCode('boo');
      km.register('1', { 'foo': '1', 'bar': '2', 'baz': '3' });
      km.register('2', { 'foo': '1', 'bar': '2', 'baz': '33' });
      km.register('3', { 'foo': '1', 'bar': '222', 'baz': '333' });
      const dect = new Detector(km);
      let toResolve = dect.resolve();
      while (toResolve.layouts.length > 1) {
        dect.feed(toResolve.keys[0].code, toResolve.keys[0].keys[0]);
        toResolve = dect.resolve();
      }
      assert.strictEqual(toResolve.layouts[0], '1');
    });
    it('manual resolve', () => {
      const km = new MutableKeymaps();
      km.addCode('foo');
      km.addCode('bar');
      km.addCode('baz');
      km.addCode('boo');
      km.register('1', { 'foo': '1', 'bar': '2', 'baz': '3' });
      km.register('2', { 'foo': '1', 'bar': '2', 'baz': '33' });
      km.register('3', { 'foo': '1', 'bar': '222', 'baz': '333' });
      const dect = new Detector(km);
      dect.feed('bar', '2');
      assert.deepStrictEqual(dect.resolve(), { layouts: ['1', '2'], keys: [{ code: 'baz', keys: ['3', '33'] }] });
      dect.feed('baz', '33');
      assert.deepStrictEqual(dect.resolve(), { layouts: ['2'], keys: [] });
    });
  });
});
