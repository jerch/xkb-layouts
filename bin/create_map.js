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
      if (DATA[map][key]) {
        SPARCE[key][ACC[map]] = DATA[map][key];
      }
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


// write ts file
function writetoFile(filename) {
  const accStr = FINAL.acc;

  const mapParts = [];
  for (const code in FINAL.map) {
    const right = FINAL.map[code].replaceAll('\\', '\\\\').replaceAll("'", "\\'");
    mapParts.push(`    ${code}: '${right}'`);
  }
  const mapStr = mapParts.join(',\n');

  const emptyParts = [];
  for (const code in FINAL.empty) {
    const right = `[${FINAL.empty[code].join(',')}]`;
    emptyParts.push(`    ${code}: ${right}`);
  }
  const emptyStr = emptyParts.join(',\n');

  const skipParts = [];
  for (const [key, value] of Object.entries(SPARCE)) {
    if (key === 'Space') continue;
    const right = `{${Object.entries(value).map(e => `${e[0]}:'${e[1].replaceAll('\\', '\\\\')}'`).join(',')}}`;
    skipParts.push(`    ${key}: ${right}`);
  }
  const skipStr = skipParts.join(',\n');

  // extra handling of Space
  const spaceParts = [];
  for (const code in SPARCE.Space) {
    if (SPARCE.Space[code] === ' ') continue;
    const right = SPARCE.Space[code].replaceAll('\\', '\\\\').replaceAll("'", "\\'");
    spaceParts.push(`${code}:'${right}'`);
  }
  const spaceStr = spaceParts.join(',');

  const output = `/**
 * Copyright (c) 2026 Joerg Breitbart
 * @license MIT
 *
 * For copyright of xkb data - see XKB-LICENSES file.
 */

// rebuild map: node bin/create_map.js layouts/*
// filtered out: ${SKIP}
export default {
  acc: '${accStr}',
  map: {\n${mapStr}\n  },
  empty: {\n${emptyStr}\n  },
  skip: {\n${skipStr}\n  },
  Space: {${spaceStr}}
};
`;
  fs.writeFileSync(filename, output);
  console.log('module size:', output.length);
}
writetoFile('src/bla.ts');
