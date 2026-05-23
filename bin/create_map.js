import fs from 'node:fs';
import path from 'node:path';

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

// skipped for being too empty (IntlRo & IntlYen) or too uniform
// handled extra by skip & Space entries
const SKIP_CODES = ['IntlRo', 'IntlYen', 'Space'];


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
const SPARCE = {};
for (const key of KEYS) {
  if (SKIP_CODES.includes(key)) {
    // save these as sparce lists
    SPARCE[key] = SPARCE[key] ?? {};
    for (const map in ACC) {
      SPARCE[key][ACC[map]] = DATA[map][key];
    }
    continue;
  };
  for (const map in ACC) {
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
        MAP[key][i] = '#';
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
const skipMinusSpace = Object.assign({}, SPARCE);
delete skipMinusSpace.Space;
const SPACE = {};
for (const map in SPARCE.Space) {
  if (SPARCE.Space[map] === ' ') continue;
  SPACE[map] = SPARCE.Space[map]
}
const FINAL = {
  acc: accArray.join('|'),
  map: MAP,
  empty,
  skip: skipMinusSpace,
  Space: SPACE
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
const toSkip = Object.entries(counter).sort((a,b) => b[1] - a[1]).filter(e => e[1] > 10);
const accKeys = Object.keys(ACC);
console.log(toSkip.map(e => [accKeys[e[0]], e[1]]));
console.log(toSkip.map(e => accKeys[e[0]]));


// test result --> should yield DATA
function test() {
  const tAcc = FINAL.acc.split('|');
  const tCodes = Object.keys(FINAL.map).sort();
  for (let i = 0; i < tAcc.length; ++i) {
    console.log('testing', tAcc[i]);
    for (let k = 0; k < tCodes.length; ++k) {
      if (SKIP_CODES.includes(tCodes[k])) continue;
      const v = FINAL.map[tCodes[k]][i];
      const orig = DATA[tAcc[i]][tCodes[k]];
      if (v !== orig) {
        if (!orig && v === '#') {

        } else {
          console.log([v, orig], i, tCodes[k]);
          throw new Error();
        }
      }
    }
  }
}
//test();


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

  const emptyParts = [];
  for (const code of codes) {
    const value = FINAL.empty[code] ?? [];
    emptyParts.push(`[${value.join(',')}]`);
  }
  const emptyStr = emptyParts.join(',');

  const skipParts = [];
  for (const [key, value] of Object.entries(SPARCE)) {
    const char = getSparceDefault(Object.entries(value).sort().map(e => e[1]));
    const transformed = Object.assign({c: char}, value);
    const tEntries = Object.entries(transformed)
      .filter(e => e[0] === 'c' || e[1] !== char)
      .sort((a,b) => a[0] - b[0]);
    const right = `{${tEntries.map(e => `${e[0]}:'${e[1].replaceAll('\\', '\\\\')}'`).join(',')}}`;
    skipParts.push(`      ${codes.indexOf(key)}: ${right}`);
  }
  const skipStr = skipParts.join(',\n');

  const output = `/**
 * Copyright (c) 2026 Joerg Breitbart
 * @license MIT
 *
 * For copyright of xkb data - see XKB-LICENSES file.
 */

interface SkipEntry {
  [index: number]: string;
  c: string;
}

// rebuild map: node bin/create_map.js layouts/*
// filtered out: ${SKIP}
const KEYMAPS = (function() {
  const DATA = {
    layouts: '${accStr}',
    codes: '${codesStr}',
    values: [\n${valuesStr}\n    ],
    empty: [${emptyStr}],
    skip: {\n${skipStr}\n    }
  };
  const f: <T>(o: T) => Readonly<T> = (o) => Object.freeze(o);
  const acc = DATA.layouts.split('|');
  const layouts: {[index: string]: number} = {};
  for (let i = 0; i < acc.length; ++i) {
    layouts[acc[i]] = i;
  }
  const codeAcc = DATA.codes.split('|');
  const codes: {[index: string]: number} = {};
  for (let i = 0; i < codeAcc.length; ++i) {
    codes[codeAcc[i]] = i;
  }
  const values = [];
  for (let i = 0; i < DATA.values.length; ++i) {
    let v : string[];
    const skip = (DATA.skip as {[index: number]: SkipEntry})[i];
    if (skip) {
      v = new Array(acc.length).fill(skip.c);
      for (const map in skip) {
        if (map === 'c') continue;
        v[map] = skip[map];
      }
    } else {
      v = DATA.values[i].split('');
      for (const empty of DATA.empty[i])
        v[empty] = '';
    }
    f(v);
    values.push(v);
  }
  f(acc);
  f(layouts);
  f(codeAcc);
  f(codes);
  f(values);
  return f({ acc, layouts, codeAcc, codes, values });
})();
export default KEYMAPS;
`;
  fs.writeFileSync(filename, output);
  console.log('module size:', output.length);
}
writetoFile('src/keymapsResolved.ts');
