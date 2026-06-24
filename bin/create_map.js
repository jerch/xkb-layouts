/**
 * Keymaps tree compression.
 *
 * The tree compression uses the fact, that most keymaps are derived ones,
 * thus we can save payload by storing diffs instead of full keymaps.
 *
 * Example:
 *   us_qwerty   `\[],0123456789=<AAabcdefghijklmnopqrstuvwxyz-.';/
 *   de_qwertz   ^#ü+,0123456789́´<AAabcdefghijklmnopqrstuvwxzyß.äö-
 *   differences 11
 *   diff data   ^#ü+´zyßäö-()*+7stuwxy
 *
 * The diff data needs two characters per difference, one for the index
 * and one for the replacement character. Through a partial transitive
 * reduction we find a tree grouping with minimal difference weights.
 *
 * Net effect:
 *    plain ~32kB, tree compressed ~17kB, tree compressed + gzip ~12kB
 *
 * On a sidenote: gzip achieves similar compression even for full maps,
 * but only if the data comes tree ordered (~12 kB, prolly to end up in
 * the search window). If the data has a different order (alphabetical)
 * gzip ends up much higher with ~17kB.
 */
import fs from 'node:fs';
import path from 'node:path';
import util from 'node:util';
import assert from 'node:assert';
import StaticKeymaps from '../lib/StaticKeymaps.js';


// reserve some chars for our compression
// these get tested to be not contained in keymaps
const RESERVED_CHARS = 'ABCDEFGZ'.split('');

// all uppercase latin chars are not in unshifted positions
// thus we use 'A' as empty placeholder
const EMPTY_PLACEHOLDER = 'A';

// key codes of interest
const CODES = [
  'Backquote',    'Backslash',     'BracketLeft',
  'BracketRight', 'Comma',         'Digit0',
  'Digit1',       'Digit2',        'Digit3',
  'Digit4',       'Digit5',        'Digit6',
  'Digit7',       'Digit8',        'Digit9',
  'Equal',        'IntlBackslash', 'IntlRo',
  'IntlYen',      'KeyA',          'KeyB',
  'KeyC',         'KeyD',          'KeyE',
  'KeyF',         'KeyG',          'KeyH',
  'KeyI',         'KeyJ',          'KeyK',
  'KeyL',         'KeyM',          'KeyN',
  'KeyO',         'KeyP',          'KeyQ',
  'KeyR',         'KeyS',          'KeyT',
  'KeyU',         'KeyV',          'KeyW',
  'KeyX',         'KeyY',          'KeyZ',
  'Minus',        'Period',        'Quote',
  'Semicolon',    'Slash',         'Space'
];

// container to aggregate keymap data
const DATA = {};


// skip for being too holey (see HOLEY calc)
const HOLEY_LIMIT = 12;
const SKIP = [
  'brai',
  'se_swl',
  'al_veqilharxhi',
  'ph_capewell-dvorak-bay',
  'ph_capewell-qwerf2k6-bay',
  'ph_colemak-bay',
  'ph_dvorak-bay',
  'ph_qwerty-bay',
  'cz_ucw',
  'cn_mon_manchu_galik',
  'ie_ogam',
  //'in_tamilnet_TSCII', 'lk_tam_TAB', 'et', 'ru_ruchey_en'
];


export class Node {
  static _nodes = new Map();
  constructor(label) {
    this.label = label;
  }
  static create(label) {
    let inst = Node._nodes.get(label);
    if (!inst) {
      inst = new Node(label);
      Node._nodes.set(label, inst);
    }
    return inst;
  }
  toString() {
    return this.label;
  }
  toJSON() {
    return this.label;
  }
  [util.inspect.custom]() {
    return this.label;
  }
}

export class Edge {
  static _edges = new Map();
  constructor(left, right, weight) {
    this.left = left;
    this.right = right;
    this.weight = weight ?? 0;
  }
  static create(left, right, weight) {
    const key = left.label + ':' + right.label;
    let inst = Edge._edges.get(key);
    if (!inst) {
      inst = new Edge(left, right, weight);
      Edge._edges.set(key, inst);
    }
    return inst;
  }
  [util.inspect.custom]() {
    return `Edge {'${this.left.label}:${this.right.label}', ${this.weight}}`;
  }
  toString() {
    return `Edge {'${this.left.label}:${this.right.label}', ${this.weight}}`;
  }
}


class Graph {
  _edges = new Set();
  _nodes = new Set();
  clone() {
    const inst = new Graph();
    inst._edges = new Set(this._edges);
    inst._nodes = new Set(this._nodes);
    return inst;
  }
  cloneOneWeighted(weight) {
    const inst = new Graph();
    inst._edges = new Set();
    for (const edge of this._edges) {
      if (edge.weight === weight) {
        inst._edges.add(edge);
      }
    }
    inst._nodes = new Set(this._nodes);
    return inst;
  }
  addEdge(edge) {
    this._edges.add(edge);
    this._nodes.add(edge.left);
    this._nodes.add(edge.right);
  }
  remEdge(edge) {
    this._edges.delete(edge);
  }
  remEdgesPredicate(func) {
    const toRem = [];
    for (const edge of this._edges) {
      if (func(edge)) {
        toRem.push(edge);
      }
    }
    for (const edge of toRem) {
      this._edges.delete(edge);
    }
  }
  children(node, weight) {
    const edges = [...this._edges.values()]
      .filter(e => e.left === node);
    return ((weight !== undefined)
      ? edges.filter(e => e.weight === weight)
      : edges
    ).map(e => e.right);
  }
  nodepath(edges) {
    const nodes = [];
    if (!edges.length) {
      return nodes;
    }
    let right = undefined;
    for (let i = 0; i < edges.length; ++i) {
      const edge = edges[i];
      if (!i) {
        nodes.push(edge.left);
        right = edge.right;
      } else {
        if (i && edge.left !== right) {
          throw new Error('edge path is not continous');
        }
        nodes.push(right);
        right = edge.right;
      }
    }
    nodes.push(right);
    return nodes;
  }
}

function calcDistance(keymapA, keymapB) {
  if (keymapA.length !== keymapB.length) {
    throw new Error('keymaps have different length');
  }
  let distance = 0;
  for (let i = 0; i < keymapA.length; ++i) {
    if (keymapA[i] !== keymapB[i]) distance++;
  }
  return distance;
}


function encodeDistance(orig, derived) {
  if (orig.length !== derived.length) throw new Error('keymaps have different lengths');
  const chr = [];
  const pos = [];
  for (let i = 0; i < orig.length; ++i) {
    if (orig[i] !== derived[i]) {
      chr.push(derived[i]);
      pos.push(String.fromCharCode(40 + i).toLowerCase());
    }
  }
  return chr.join('') + pos.join('');
}


function calcStep(graph, n, idx, seen, handled, weight) {
  if (!handled.has(n)) throw new Error('node must be have been seen');
  const sibs = graph.children(n, weight).filter(e => !handled.has(e));
  sibs.forEach(e => handled.add(e));
  const sub_seen = sibs.map(e => [e, n, idx + 1]);
  seen[idx + 1] = (seen[idx + 1] ?? []).concat(sub_seen);
  return sub_seen;
}


/**
 * Partial transitive reduction.
 * The reduction is done in BFS style to keep the trees flat.
 * This is not a complete transitive reduction, as the first minimal weight wins,
 * in fact the tree is constructed by increased weight search over tree levels
 * (sweeping other solutions).
 * To get a closer approximation of the shortest tree we test each member of
 * a tree group seperately in calcAllTreeData (centroid pruning).
 */
function calcTree(graph, label, maxWeight) {
  // FIXME: check if equality here
  graph = graph.clone();
  graph.remEdgesPredicate(e => e.weight > maxWeight);
  const graphs = new Array(maxWeight);
  for (let i = 1; i < graphs.length; ++i) {
    graphs[i] = graph.cloneOneWeighted(i);
  }
  const base = Node.create(label);
  const seen = [[[base, undefined, 0]]];
  const handled = new Set([base]);
  const diffs = new Array(maxWeight);
  diffs[0] = [];
  for (let i = 1; i < diffs.length; ++i) {
    diffs[i] = [[base, undefined, 0]];
  }
  while ([].concat(...diffs).length) {
    let weight = 0;
    let entry;
    for (let i = 0; i < diffs.length; ++i) {
      if (diffs[i].length) {
        weight = i;
        entry = diffs[i].shift();
        break;
      }
    }
    const [sn, p, idx] = entry;
    const diff = calcStep(graphs[weight], sn, idx, seen, handled, weight);
    for (let i = 1; i < diffs.length; ++i) {
      diffs[i] = diffs[i].concat(diff);
    }
  }
  const seen_merged = [].concat(...seen);
  const edges = seen_merged.map(e => Edge.create(e[1] ?? base, e[0]));
  const edgeIdx = {};
  for (let i = 0; i < edges.length; ++i) {
    edgeIdx[edges[i]] = i;
  }
  const paths = {};
  for (const edge of edges) {
    const path = [edge];
    let parent = edge.left;
    while (parent !== base) {
      for (const ee of edges) {
        if (ee.right === parent) {
          path.unshift(Edge.create(ee.left, ee.right));
          parent = ee.left;
        }
      }
    }
    paths[edge.right] = path;
  }
  const treestats = {
    base: base,
    weight: maxWeight,
    layouts: edges.length,
    weights: edges.reduce((p, c) => p + c.weight, 0),
    maxWeight: Math.max(...edges.map(e => e.weight))
  };
  return [paths, treestats];
}


/**
 * Diff encoding of tree paths.
 * IMPORTANT: the tree paths must be sorted in a way,
 * that the parent layout is in the previous stack position.
 */
function genEncodings(sortedPaths) {
  const encs = [];
  const layouts = [];
  for (const path of sortedPaths) {
    const last = path[path.length - 1];
    const parent = path[path.length - 2];
    if (parent !== last) {
      const depth = String.fromCharCode(path.length - 1 + 48);
      encs.push(depth + encodeDistance(DATA[parent], DATA[last]));
      layouts.push(last);
    } else {
      encs.push('0' + DATA[parent]);
      layouts.push(parent);
    }
  }
  return [layouts.join('|'), encs.join('Z')];
}

// encode layout group as tree
function encodeTree(graph, layout, maxWeight) {
  const [treepaths, _] = calcTree(graph, layout, maxWeight);
  const sortedPaths = Object.values(treepaths)
    .map(p => graph.nodepath(p))
    .map(e => e.map(c => c.label))
    .sort((a, b) => {
      // special case: the root element contains itself twice
      // and must be in leading position (pre-order, topological)
      if (a.length === 2 && a[0] === a[1]) return -1;
      if (b.length === 2 && b[0] === b[1]) return 1;
      const n = Math.min(a.length, b.length);
      for (let i = 0; i < n; i++) {
        if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
      }
      return a.length - b.length;
    });
  return genEncodings(sortedPaths);
}


/**
 * Calculate all tree data:
 *  1. calc all trees for all layouts and build tree groups
 *  2. find group centroid by lowest tree weight and alphabetical order
 *  3. calc all group tree with centroid
 *  4. encode tree data as diffs
 *  5. write to JSON file
 */
function calcAllTreeData(graph, maxWeight) {
  const all_stats = [];
  const groups = [];
  let c = 0;
  const len = Object.keys(DATA).length;
  for (const l in DATA) {
    process.stdout.write(`\r                  \r${++c} / ${len} layouts`);
    const [treepaths, stats] = calcTree(graph, l, maxWeight);
    const layouts = Object.keys(treepaths);
    let alreadyAdded = false;
    for (let i = 0; i < groups.length; ++i) {
      const g = groups[i];
      if (g.length === layouts.length && layouts.every(l => g.includes(l))) {
        alreadyAdded = true;
        all_stats[i].push(stats);
        break;
      }
    }
    if (!alreadyAdded) {
      groups.push(layouts);
      all_stats.push([stats]);
    }
  }
  console.log();

  // make sure we got all layouts
  assert.ok([].concat(...groups).length === Object.keys(DATA).length &&
    new Set([].concat(...groups)).size === Object.keys(DATA).length);

  // find group leader: 1. lowest weight 2. alphabetical
  const leaders = [];
  for (const sg of all_stats) {
    if (sg.length === 1) {
      leaders.push(sg[0].base);
    } else {
      const sorted_stats = sg
        .sort((a, b) => a.base.label > b.base.label ? 1 : -1)
        .sort((a, b) => a.weights - b.weights);
      leaders.push(sorted_stats[0].base);
    }
  }
  
  // encode groups
  const result_layouts = [];
  const result_data = [];
  for (const leader of leaders) {
    const [l, d] = encodeTree(graph, leader.label, maxWeight);
    result_layouts.push(l);
    result_data.push(d);
  }

  const result = [
    result_layouts.join('|'),
    result_data.join('Z')
  ];
  return result;
}


/**
 * Tiny dictionary compression.
 * This removes repeating pattern not covered by the tree reduction
 * like the digits in 0-9, whose similarities are too small to catch
 * in weight distances below < 20 across all keymaps.
 * Reduces data further by ~15%, adds ~10% runtime for decoding.
 */
function dictCompression(data) {
  console.log('before dict compression:', data.length);
  data = data.replaceAll('0123456789', 'B');
  data = data.replaceAll('-./0123456', 'C');
  data = data.replaceAll('<AA', 'D');
  data = data.replaceAll(' Z0', 'E');
  data = data.replaceAll('()*+', 'F');
  data = data.replaceAll(' Z1', 'G');
  console.log('after dict compression :', data.length);
  // uncomment to gather most char pattern in 2-14 chars
  //for (let l = 2; l < 15; ++l) {
  //  const pattern = {};
  //  for (let i = 0; i < data.length - (l-1); ++i) {
  //    pattern[data.slice(i, i + l)] = pattern[data.slice(i, i + l)] ?? 0;
  //    pattern[data.slice(i, i + l)]++;
  //  }
  //  const sorted = Object.entries(pattern).sort((a,b) => b[1] - a[1]).slice(0, 4);
  //  console.log(l, sorted, (sorted[0][1] - 1) * l);
  //}
  return data;
}


function testResultAgainstOrig(result) {
  const km = new StaticKeymaps(result);
  assert.deepStrictEqual(km.layouts, Object.keys(DATA).sort());
  for (let i = 2; i < process.argv.length; ++i) {
    const filename = process.argv[i];
    const key = path.basename(filename).split('.')[0];
    if (SKIP.includes(key)) continue;
    const map = JSON.parse(fs.readFileSync(filename));
    assert.deepStrictEqual(km.getLayoutMap(key), map);
  }
}


function writeModule(data, filename) {
  const output = `/**
 * Copyright (c) 2026 Joerg Breitbart
 * @license MIT
 *
 * For copyright of xkb data - see XKB-LICENSES file.
 */
import StaticKeymaps from "./StaticKeymaps.js";
import type { IKeymaps } from "./Types.js";

let MAPS: IKeymaps;
let RAW = [
  "${data[0]}",
  "${data[1].replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"
];

export default () => {
  if (!MAPS) {
    MAPS = new StaticKeymaps(RAW);
    RAW = null!;
  }
  return MAPS;
};
`;
  fs.writeFileSync(filename, output);
  console.log('module size:', output.length);
}


// read all keymaps
for (let i = 2; i < process.argv.length; ++i) {
  const filename = process.argv[i];
  const key = path.basename(filename).split('.')[0];
  if (SKIP.includes(key)) continue;
  const map = JSON.parse(fs.readFileSync(filename));
  const data = [];
  for (const code in map) {
    const v = map[code];
    if (RESERVED_CHARS.includes(v)) throw new Error(`${v} included in RESERVED_CHARS`);
    data.push(v || EMPTY_PLACEHOLDER);
  }
  DATA[key] = data.join('');
}
// find too holey layouts
const HOLEY = Object.entries(DATA).map(e => [e[0], e[1].split(EMPTY_PLACEHOLDER).length - 1]).sort((a, b) => b[1] - a[1]);
if (HOLEY.filter(e => e[1] > HOLEY_LIMIT).length) {
  console.log('holey layouts above limit:\n', HOLEY.filter(e => e[1] > HOLEY_LIMIT));
  throw new Error('holey layouts above limit found, adjust SKIP');
}
// generate graph of all layouts
const graph = new Graph();
for (const ll in DATA) {
  for (const lr in DATA) {
    if (ll === lr) continue;
    const left = Node.create(ll);
    const right = Node.create(lr);
    const distance = calcDistance(DATA[ll], DATA[lr]);
    graph.addEdge(Edge.create(left, right, distance));
  }
}
//console.log(calcTree(graph, 'us', 4));
//console.log(encodeTree(graph, 'us', 4));
const result = calcAllTreeData(graph, 24);
//fs.writeFileSync('test.json', JSON.stringify(result));
result[1] = dictCompression(result[1]);
testResultAgainstOrig(result);

// if we made it here, write ts module

//writeModule(result, 'src/keymaps.ts');
//writeModule(result, 'src/keymapsResolved.ts');
