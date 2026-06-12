import fs from 'node:fs';
import path from 'node:path';

// all uppercase latin chars are not in unshifted positions
// thus we use 'A' as empty placeholder
const EMPTY_PLACEHOLDER = 'A';

const DATA = {};


// skip for being to holey (calculated below)
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


// read all keymaps
for (let i = 2; i < process.argv.length; ++i) {
  const filename = process.argv[i];
  const key = path.basename(filename).split('.')[0];
  if (SKIP.includes(key)) continue;
  const value = JSON.parse(fs.readFileSync(filename));
  DATA[key] = value;
}


let keys = [];
for (const map in DATA) {
  keys = keys.concat(Object.keys(DATA[map]));
}
const KEYS = Array.from(new Set(keys)).sort();
const ACC = Object.fromEntries(Object.keys(DATA).sort().map((el, i) => [el, i]));
const MAP = Object.fromEntries(KEYS.map(el => [el, []]));
for (const key of KEYS) {
  for (const map in ACC) {
    if (DATA[map][key] === EMPTY_PLACEHOLDER)
      throw new Error(`EMPTY_PLACEHOLDER found in DATA: ${map}, ${key}`);
    MAP[key].push(DATA[map][key]);
  }
}

// minify if all entries of length 1
const empty = {};
for (const key in MAP) {
  for (let i = 0; i < MAP[key].length; ++i) {
    let c = MAP[key][i];
    if (!c || c.length !== 1) {
      if (!c) {
        MAP[key][i] = EMPTY_PLACEHOLDER;
        empty[key] = empty[key] ?? [];
        empty[key].push(i);
      } else {
        throw new Error('char size not useable for string');
      }
    }
  }
  MAP[key] = MAP[key].join('');
}


// build the FINAL merged keymap
const accArray = Object.entries(ACC).sort((a,b) => a[1] - b[1]).map(e => e[0]);
const FINAL = {
  acc: accArray.join('|'),
  map: MAP
};


//console.log(FINAL);
//console.log(JSON.stringify(FINAL));
//console.log('FINAL length:', JSON.stringify(FINAL).length);


// calculate skiplist
const counter = {};
for (const name in empty) {
  const values = empty[name];
  for (const num of values) {
    counter[num] = counter[num] ?? 0;
    counter[num]++;
  }
}
// filter missing > 10
// add to candidates to SKIP above
const SKIP_FILTER = 10;
const toSkip = Object.entries(counter).sort((a,b) => b[1] - a[1]).filter(e => e[1] > SKIP_FILTER);
const accKeys = Object.keys(ACC);
console.log('SKIP candidates:');
console.log(toSkip.map(e => [accKeys[e[0]], e[1]]));


// test result --> should yield DATA
function test() {
  const tAcc = FINAL.acc.split('|');
  const tCodes = Object.keys(FINAL.map).sort();
  for (let i = 0; i < tAcc.length; ++i) {
    for (let k = 0; k < tCodes.length; ++k) {
      const v = FINAL.map[tCodes[k]][i];
      const orig = DATA[tAcc[i]][tCodes[k]];
      if (v !== orig) {
        // let empty orig set to EMPTY_PLACEHOLDER pass
        if (orig || v !== EMPTY_PLACEHOLDER) {
          console.log([v, orig], i, tCodes[k]);
          throw new Error();
        }
      }
    }
  }
}
test();


function getSparceDefault(values) {
  const counter = {};
  for (let i = 0; i < values.length; ++i) {
    counter[values[i]] = counter[values[i]] ?? 0;
    counter[values[i]]++;
  }
  const sorted = Object.entries(counter).sort((a, b) => b[1] - a[1]);
  return sorted[0][0];
}


// write ts file
function writetoFile(filename) {
  const codes = Object.keys(FINAL.map).sort();

  const accStr = FINAL.acc;

  const codesStr = codes.join('|');

  const valuesParts = [];
  for (const code of codes) {
    const values = FINAL.map[code].replaceAll('\\', '\\\\').replaceAll("'", "\\'");
    valuesParts.push(`      '${values}'`);
  }
  const valuesStr = valuesParts.join(',\n');

  const output = `/**
 * Copyright (c) 2026 Joerg Breitbart
 * @license MIT
 *
 * For copyright of xkb data - see XKB-LICENSES file.
 */

// rebuild map: node bin/create_map.js layouts/*
// empty placeholer: ${EMPTY_PLACEHOLDER}
const KEYMAPS = (function() {
  const DATA = {
    layouts: '${accStr}',
    codes: '${codesStr}',
    values: [\n${valuesStr}\n    ]
  };
  const layouts = DATA.layouts.split('|');
  const layoutIdx: {[index: string]: number} = {};
  for (let i = 0; i < layouts.length; ++i) {
    layoutIdx[layouts[i]] = i;
  }
  const codes = DATA.codes.split('|');
  const codeIdx: {[index: string]: number} = {};
  for (let i = 0; i < codes.length; ++i) {
    codeIdx[codes[i]] = i;
  }
  const getKey = (codeIdx: number, layoutIdx: number) => {
    const v = DATA.values[codeIdx][layoutIdx];
    return v !== '${EMPTY_PLACEHOLDER}' ? v : '';
  };
  return { layouts, layoutIdx, codes, codeIdx, getKey, data: DATA };
})();
export default KEYMAPS;
`;
  fs.writeFileSync(filename, output);
  console.log('module size:', output.length);
}
writetoFile('src/keymapsResolved.ts');
