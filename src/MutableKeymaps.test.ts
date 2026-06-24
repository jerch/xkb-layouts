import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import getKeymaps from './keymaps.js';
import getKeymapsResolved from './keymapsResolved.js';
import { MutableKeymaps } from './MutableKeymaps.js';

const PROJECT_PATH = process.env.PWD ?? process.cwd();
const KEYMAPS_SUBFOLDER = 'layouts';
const KEYMAPS_PATH = path.join(PROJECT_PATH, KEYMAPS_SUBFOLDER);
const KEYMAPS_RESOLVED_SUBFOLDER = 'layouts_dead_resolved';
const KEYMAPS_RESOLVED_PATH = path.join(PROJECT_PATH, KEYMAPS_RESOLVED_SUBFOLDER);

const keymapsStatic = getKeymaps();
const keymapsResolvedStatic = getKeymapsResolved();
const keymapsMutable = new MutableKeymaps(keymapsStatic);
const keymapsReolvedMutable = new MutableKeymaps(keymapsResolvedStatic);



describe('MutableKeymaps', () => {
  it('keymaps match original', () => {
    const layouts = keymapsStatic.layouts;
    for (let i = 0; i < layouts.length; ++i) {
      const layout = layouts[i];
      const orig = fs.readFileSync(path.join(KEYMAPS_PATH, layout + '.json'), { encoding: 'utf-8' });
      assert.deepStrictEqual(keymapsStatic.getLayoutMap(layout), JSON.parse(orig));
      assert.deepStrictEqual(keymapsMutable.getLayoutMap(layout), keymapsStatic.getLayoutMap(layout));
    }
  });
  
  it('keymaps resolved match original', () => {
    const layouts = keymapsResolvedStatic.layouts;
    for (let i = 0; i < layouts.length; ++i) {
      const layout = layouts[i];
      const orig = fs.readFileSync(path.join(KEYMAPS_RESOLVED_PATH, layout + '.json'), { encoding: 'utf-8' });
      assert.deepStrictEqual(keymapsResolvedStatic.getLayoutMap(layout), JSON.parse(orig));
      assert.deepStrictEqual(keymapsReolvedMutable.getLayoutMap(layout), keymapsResolvedStatic.getLayoutMap(layout));
    }
  });
  it('empty ctor', () => {
    const km = new MutableKeymaps();
    assert.deepStrictEqual(km.layouts, []);
    assert.deepStrictEqual(km.layoutIdx, {});
    assert.deepStrictEqual(km.codes, []);
    assert.deepStrictEqual(km.codeIdx, {});
  });
  it('key yields same value - keymaps', () => {
    const km = new MutableKeymaps(keymapsStatic);
    for (const l of keymapsStatic.layouts) {
      for (const c of keymapsStatic.codes) {
        assert.deepStrictEqual(km.key(c, l), keymapsStatic.key(c, l));
      }
    }
  });
  it('key yields same value - keymapsResolved', () => {
    const km = new MutableKeymaps(keymapsResolvedStatic);
    for (const l of keymapsResolvedStatic.layouts) {
      for (const c of keymapsResolvedStatic.codes) {
        assert.deepStrictEqual(km.key(c, l), keymapsResolvedStatic.key(c, l));
      }
    }
  });
  it('keyIndexed yields same value - keymaps', () => {
    const km = new MutableKeymaps(keymapsStatic);
    for (let l = 0; l < keymapsStatic.layouts.length; ++l) {
      for (let c = 0; c < keymapsStatic.codes.length; ++c) {
        assert.deepStrictEqual(
          km.keyIndexed(km.codeIdx[km.codes[c]], km.layoutIdx[km.layouts[l]]),
          keymapsStatic.keyIndexed(
            keymapsStatic.codeIdx[keymapsStatic.codes[c]],
            keymapsStatic.layoutIdx[keymapsStatic.layouts[l]]
          )
        );
      }
    }
  });
  it('keyIndexed yields same value - keymapsResolved', () => {
    const km = new MutableKeymaps(keymapsResolvedStatic);
    for (let l = 0; l < keymapsResolvedStatic.layouts.length; ++l) {
      for (let c = 0; c < keymapsResolvedStatic.codes.length; ++c) {
        assert.deepStrictEqual(
          km.keyIndexed(km.codeIdx[km.codes[c]], km.layoutIdx[km.layouts[l]]),
          keymapsResolvedStatic.keyIndexed(
            keymapsResolvedStatic.codeIdx[keymapsResolvedStatic.codes[c]],
            keymapsResolvedStatic.layoutIdx[keymapsResolvedStatic.layouts[l]]
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
    const km = new MutableKeymaps(keymapsStatic);
    km.addCode('foo');
    km.removeCode('KeyQ');
    for (let l = 0; l < keymapsStatic.layouts.length; ++l) {
      const layout = keymapsStatic.layouts[l];
      for (let c = 0; c < keymapsStatic.codes.length; ++c) {
        const code = keymapsStatic.codes[c];
        if (km.codes.includes(code)) {
          assert.notStrictEqual(km.codeIdx[code], undefined);
          assert.deepStrictEqual(
            km.keyIndexed(km.codeIdx[code], km.layoutIdx[layout]),
            keymapsStatic.keyIndexed(
              keymapsStatic.codeIdx[code],
              keymapsStatic.layoutIdx[layout]
            )
          );
        } else {
          assert.strictEqual(km.codeIdx[code], undefined);
        }
      }
    }
  });
  it('addCode creates undefined key values', () => {
    const km = new MutableKeymaps(keymapsStatic);
    km.addCode('foo');
    for (let l = 0; l < keymapsStatic.layouts.length; ++l) {
      const layout = keymapsStatic.layouts[l];
      assert.deepStrictEqual(km.keyIndexed(km.codeIdx['foo'], km.layoutIdx[layout]), undefined);
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
    assert.deepStrictEqual(km.keyIndexed(km.codeIdx['foo'], km.layoutIdx['one']), '1');
    assert.deepStrictEqual(km.keyIndexed(km.codeIdx['bar'], km.layoutIdx['one']), '2');
    assert.deepStrictEqual(km.keyIndexed(km.codeIdx['foo'], km.layoutIdx['two']), '11');
    assert.deepStrictEqual(km.keyIndexed(km.codeIdx['bar'], km.layoutIdx['two']), '22');
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
    assert.deepStrictEqual(km.keyIndexed(km.codeIdx['foo'], km.layoutIdx['one']), '1');
    assert.deepStrictEqual(km.keyIndexed(km.codeIdx['bar'], km.layoutIdx['one']), '2');
    assert.deepStrictEqual(km.keyIndexed(km.codeIdx['foo'], km.layoutIdx['thr']), '111');
    assert.deepStrictEqual(km.keyIndexed(km.codeIdx['bar'], km.layoutIdx['thr']), '222');
    assert.throws(() => km.unregister('two'));
  });
});
