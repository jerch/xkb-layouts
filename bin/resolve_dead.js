import fs from 'node:fs';

if (process.argv.length !== 4) {
  console.log('usage: node bin/resolve_dead.js <xkb-json-file> <layout-folder>');
  process.exit(1);
}

const XKB_DEFINITIONS = JSON.parse(fs.readFileSync(process.argv[2]));
const FOLDER = process.argv[3];

/**
 * Resolving dead diacritic marks is quite cumbersome:
 * - find all interesting bytes: scan for chars in 0x300 - 0x36f
 * - test all layout-key combinations below in keyboard_layout.html
 * - results are --> dead with resolve or # post combining
 * - identify replacement pattern
 * - reduce results to `deadDiacriticResolve` map
 * - apply to all maps minus `skipDeadResolve`
 * - redo duplicate reduction from create_layouts.js --> removes most nodeadkey maps
 */
//const counter: any = {};
//const counter2: any = {};
//for (const code in MAP.map) {
//  for (let i = 0; i < MAP.map[code].length; ++i) {
//    if (MAP.map[code].charCodeAt(i) >= 0x300 && MAP.map[code].charCodeAt(i) <= 0x36f) {
//      console.log(MAP.map[code].charCodeAt(i), code, MAP.acc.split('|')[i]);
//      counter[MAP.map[code].charCodeAt(i)] = counter[MAP.map[code].charCodeAt(i)] ?? 0;
//      counter[MAP.map[code].charCodeAt(i)]++;
//      counter2[MAP.acc.split('|')[i]] = counter2[MAP.acc.split('|')[i]] ?? [];
//      counter2[MAP.acc.split('|')[i]].push([code, MAP.map[code].charCodeAt(i)]);
//    }
//  }
//}
//console.log(counter);
//console.log(counter2);


const diacritics = {
  cm_dvorak: [
    [ 'Backquote', 781 ],     // #
    [ 'Equal', 807 ],         // #
    [ 'KeyQ', 768 ],          // #
    [ 'Minus', 769 ]          // #
  ],
  cm_mmuock: [
    [ 'Backquote', 768 ],     // --> `
    [ 'KeyH', 803 ],          // #
    [ 'Minus', 772 ],         // --> ¯
    [ 'Quote', 769 ]          // --> ´
  ],
  cm_qwerty: [
    [ 'Backquote', 781 ],     // #
    [ 'BracketLeft', 769 ],   // #
    [ 'BracketRight', 807 ],  // #
    [ 'Quote', 768 ]          // #
  ],
  de: [
    [ 'Backquote', 770 ],     // --> ^
    [ 'Equal', 769 ]          // --> ´
  ],
  de_e2: [
    [ 'Backquote', 770 ],     // --> ^
    [ 'Equal', 769 ]          // --> ´
  ],
  de_neo: [ // IMPORTANT: Numlock must be off!
    [ 'Backquote', 770 ],     // --> ^
    [ 'BracketRight', 769 ],  // --> ´
    [ 'Equal', 768 ]          // --> `
  ],
  de_qwerty: [
    [ 'Backquote', 770 ],     // --> ^
    [ 'Equal', 769 ]          // --> ´
  ],
  ee: [
    [ 'Backquote', 780 ],     // --> ˇ
    [ 'Equal', 769 ]          // --> ´
  ],
  gb_extd: [
    [ 'Backquote', 768 ]      // --> `
  ],
  gb_intl: [
    [ 'Backquote', 768 ],     // --> `
    [ 'Quote', 769 ]          // --> ´
  ],
  is: [
    [ 'Backquote', 778 ],     // --> °
    [ 'Quote', 769 ]          // --> ´
  ],
  lt_sgs: [
    [ 'Backquote', 772 ]      // #
  ],
  mk: [
    [ 'Backquote', 768 ]      // --> `
  ],
  ru_ab: [
    [ 'Backquote', 769 ]      // #
  ],
  'us_dvorak-intl': [
    [ 'Backquote', 768 ],     // --> `
    [ 'KeyQ', 769 ]           // --> ´
  ],
  us_intl: [
    [ 'Backquote', 768 ],     // --> `
    [ 'Quote', 769 ]          // --> ´
  ],
  'us_workman-intl': [
    [ 'Backquote', 768 ],     // --> `
    [ 'Quote', 769 ]          // --> ´
  ],
  vn_us: [
    [ 'Backquote', 768 ],     // --> `
    [ 'Period', 803 ],        // --> ̣
    [ 'Quote', 769 ],         // --> ´
    [ 'Slash', 777 ]          // --> ̉
  ],
  cz: [
    [ 'Backslash', 776 ],     // --> ¨
    [ 'Equal', 769 ]          // --> ´
  ],
  cz_qwerty: [
    [ 'Backslash', 776 ],     // --> ¨
    [ 'Equal', 769 ]          // --> ´
  ],
  'cz_qwerty-mac': [
    [ 'Backslash', 776 ],     // --> ¨
    [ 'Equal', 769 ]          // --> ´
  ],
  fr_mac: [
    [ 'Backslash', 768 ],     // --> `
    [ 'BracketLeft', 770 ]    // --> ^
  ],
  pt: [
    [ 'Backslash', 771 ],     // --> ~
    [ 'BracketRight', 769 ]   // --> ´
  ],
  be: [
    [ 'BracketLeft', 770 ]    // --> ^
  ],
  br: [
    [ 'BracketLeft', 769 ],   // --> ´
    [ 'Quote', 771 ]          // --> ~
  ],
  br_dvorak: [
    [ 'BracketLeft', 769 ],   // --> ´
    [ 'Quote', 771 ]          // --> ~
  ],
  br_nativo: [
    [ 'BracketLeft', 771 ],   // --> ~
    [ 'Quote', 769 ]          // --> ´
  ],
  'br_nativo-epo': [
    [ 'BracketLeft', 771 ],   // --> ~
    [ 'Quote', 769 ]          // --> ´
  ],
  'br_nativo-us': [
    [ 'BracketLeft', 771 ],   // --> ~
    [ 'Quote', 769 ]          // --> ´
  ],
  br_rus: [
    [ 'BracketLeft', 769 ],   // --> ´
    [ 'Quote', 771 ]          // --> ~
  ],
  ca: [
    [ 'BracketLeft', 770 ],   // --> ^
    [ 'BracketRight', 807 ],  // --> ¸
    [ 'Quote', 768 ]          // --> `
  ],
  'ca_fr-legacy': [
    [ 'BracketLeft', 770 ]    // --> ^
  ],
  ca_multix: [
    [ 'BracketLeft', 770 ]    // --> ^
  ],
  cm_azerty: [
    [ 'BracketLeft', 769 ],   // #
    [ 'BracketRight', 816 ],  // #
    [ 'Quote', 768 ]          // #
  ],
  es: [
    [ 'BracketLeft', 768 ],   // --> `
    [ 'Quote', 769 ]          // --> ´
  ],
  es_dvorak: [
    [ 'BracketLeft', 768 ],   // --> `
    [ 'Quote', 769 ]          // --> ´
  ],
  fr: [
    [ 'BracketLeft', 770 ]    // --> ^
  ],
  fr_bre: [
    [ 'BracketLeft', 770 ]    // --> ^
  ],
  fr_latin9: [
    [ 'BracketLeft', 770 ]    // --> ^
  ],
  gr_polytonic: [
    [ 'BracketLeft', 771 ],   // --> ~
    [ 'BracketRight', 837 ],  // --> ͺ
    [ 'Quote', 768 ],         // --> `
    [ 'Semicolon', 769 ]      // --> ´
  ],
  in_tamilnet_TSCII: [
    [ 'BracketLeft', 769 ],   // --> ´
    [ 'KeyH', 768 ]           // --> `
  ],
  latam: [
    [ 'BracketLeft', 769 ]    // --> ´
  ],
  latam_colemak: [
    [ 'BracketLeft', 769 ]    // --> ´
  ],
  latam_dvorak: [
    [ 'BracketLeft', 769 ]    // --> ´
  ],
  lk_tam_TAB: [
    [ 'BracketLeft', 770 ]    // --> ^
  ],
  'ma_tifinagh-alt': [
    [ 'BracketLeft', 770 ]    // --> ^
  ],
  nl: [
    [ 'BracketLeft', 776 ],   // --> ¨
    [ 'Quote', 769 ]          // --> ´
  ],
  pt_nativo: [
    [ 'BracketLeft', 771 ],   // --> ~
    [ 'Quote', 769 ]          // --> ´
  ],
  'pt_nativo-epo': [
    [ 'BracketLeft', 771 ],   // --> ~
    [ 'Quote', 769 ]          // --> ´
  ],
  'pt_nativo-us': [
    [ 'BracketLeft', 771 ],   // --> ~
    [ 'Quote', 769 ]          // --> ´
  ],
  vn_fr: [
    [ 'BracketLeft', 770 ],   // --> ^
    [ 'Comma', 803 ],         // --> ̣
    [ 'Digit2', 771 ],        // --> ~
    [ 'Digit4', 769 ],        // --> ´
    [ 'Digit7', 768 ],        // --> `
    [ 'KeyM', 777 ]           // --> ̉
  ],
  ca_ike: [
    [ 'BracketRight', 775 ]   // --> ˙
  ],
  ch: [
    [ 'BracketRight', 776 ],  // --> ¨
    [ 'Equal', 770 ]          // --> ^
  ],
  ch_fr: [
    [ 'BracketRight', 776 ],  // --> ¨
    [ 'Equal', 770 ]          // --> ^
  ],
  dk: [
    [ 'BracketRight', 776 ],  // --> ¨
    [ 'Equal', 769 ]          // --> ´
  ],
  fr_dvorak: [
    [ 'BracketRight', 776 ],  // --> ¨
    [ 'Digit6', 770 ]         // --> ^
  ],
  no: [
    [ 'BracketRight', 776 ]   // --> ¨
  ],
  no_colemak: [
    [ 'BracketRight', 776 ]   // --> ¨
  ],
  no_dvorak: [
    [ 'BracketRight', 776 ]   // --> ¨
  ],
  pt_mac: [
    [ 'BracketRight', 769 ],  // --> ´
    [ 'Quote', 771 ]          // --> ~
  ],
  se: [
    [ 'BracketRight', 776 ],  // --> ¨
    [ 'Equal', 769 ]          // --> ´
  ],
  se_dvorak: [
    [ 'BracketRight', 776 ],  // --> ¨
    [ 'Equal', 769 ]          // --> ´
  ],
  se_rus: [
    [ 'BracketRight', 776 ]   // --> ¨
  ],
  se_svdvorak: [
    [ 'BracketRight', 776 ],  // --> ¨
    [ 'Equal', 769 ]          // --> ´
  ],
  cd: [
    [ 'Digit0', 776 ],        // #
    [ 'Digit2', 769 ],        // #
    [ 'Digit3', 768 ],        // #
    [ 'Digit8', 770 ],        // #
    [ 'Digit9', 780 ]         // #
  ],
  vn: [
    [ 'Digit5', 768 ],        // #
    [ 'Digit6', 777 ],        // #
    [ 'Digit7', 771 ],        // #
    [ 'Digit8', 769 ],        // #
    [ 'Digit9', 803 ]         // #
  ],
  'ca_fr-dvorak': [
    [ 'Equal', 807 ],         // --> ¸
    [ 'KeyQ', 768 ],          // --> `
    [ 'Minus', 770 ]          // --> ^
  ],
  cz_bksl: [
    [ 'Equal', 769 ]          // --> ´
  ],
  cz_qwerty_bksl: [
    [ 'Equal', 769 ]          // --> ´
  ],
  de_deadacute: [
    [ 'Equal', 769 ]          // --> ´
  ],
  fo: [
    [ 'Equal', 769 ]          // --> ´
  ],
  fr_afnor: [
    [ 'Equal', 770 ]          // --> ^
  ],
  no_mac: [
    [ 'Equal', 768 ]          // --> `
  ],
  sk: [
    [ 'Equal', 769 ]          // --> ´
  ],
  sk_bksl: [
    [ 'Equal', 769 ]          // --> ´
  ],
  sk_qwerty: [
    [ 'Equal', 769 ]          // --> ´
  ],
  sk_qwerty_bksl: [
    [ 'Equal', 769 ]          // --> ´
  ],
  gb_mac_intl: [
    [ 'IntlBackslash', 768 ], // --> `
    [ 'Quote', 769 ]          // --> ´
  ],
  il_biblical: [
    [ 'KeyQ', 775 ]           // #
  ],
  in_iipa: [
    [ 'KeyX', 774 ],          // #
    [ 'KeyZ', 810 ]           // #
  ],
  fr_bepo: [
    [ 'KeyY', 770 ]           // --> ^
  ],
  fr_bepo_afnor: [
    [ 'KeyY', 770 ]           // --> ^
  ],
  is_mac: [
    [ 'Quote', 769 ]          // --> ´
  ],
  is_mac_legacy: [
    [ 'Quote', 769 ]          // --> ´
  ],
  us_hbs: [
    [ 'Quote', 769 ]          // --> ´
  ],
  gr: [
    [ 'Semicolon', 769 ]      // --> ´
  ]
}

// reduction of dead key chars on second press across all layouts
const deadDiacriticResolve = {
  768: "`",
  769: "´",
  770: "^",
  771: "~",
  772: "¯",
  775: "˙",
  776: "¨",
  778: "°",
  780: "ˇ",
  807: "¸",
  837: "ͺ"
}

// skipped due to non dead key composition (char gets accounted as is)
const skipDeadResolve = [
  'cm_dvorak',
  'cm_qwerty',
  'lt_sgs',
  'ru_ab',
  'cm_azerty',
  'cd',
  'vn',
  'il_biblical'
];

/**
 * Gathers information about diacritics across all layouts and replaces
 * with the resolved character.
 * Set `doWrite` to true to do the actual writing.
 */
function resolveDiacritics(doWrite = false) {
  let c = 0;
  const filenames = fs.readdirSync('layouts_dead_resolved');
  for (let i = 0; i < filenames.length; ++i) {
    if (skipDeadResolve.includes(filenames[i].split('.')[0])) {
      console.log('skipped', filenames[i]);
      continue;
    }
    const content = fs.readFileSync(`layouts_dead_resolved/${filenames[i]}`, {encoding: 'utf-8'});
    const data = JSON.parse(content);
    for (const code in data) {
      const v = data[code];
      if (deadDiacriticResolve[v.charCodeAt(0)]) {
        data[code] = deadDiacriticResolve[v.charCodeAt(0)];
        console.log(filenames[i].split('.')[0], code, v.charCodeAt(0));
        c++;
      }
    }
    if (doWrite) {
      fs.writeFileSync(`layouts_dead_resolved/${filenames[i]}`, JSON.stringify(data, null, 2));
    }
  }
  console.log('replacements:', c);
}


/**
 * First layout reduction - delete every duplicate with longer filenames than 2.
 * Since we only safe the unshifted keymaps there are a lot of duplicates.
 * We default here to the two-character layouts, as they usually denote the country code.
 * Set `doDelete` to true to excute the deletion.
 */
function consolidateFiles(doDelete = false) {
  const filenames = fs.readdirSync(FOLDER);
  const data = {};
  for (let i = 0; i < filenames.length; ++i) {
    data[filenames[i]] = fs.readFileSync(`${FOLDER}/${filenames[i]}`, {encoding: 'utf-8'});
  }
  const toDelete = new Set();
  for (const filenameLeft in data) {
    if (filenameLeft.split('.')[0].length > 2) continue;
    const a = data[filenameLeft];
    for (const filenameRight in data) {
      if (filenameRight === filenameLeft) {
        continue;
      }
      const b = data[filenameRight];
      if (a === b && filenameRight.split('.')[0].length > 2) {
        toDelete.add(filenameRight);
      }
    }
  }
  console.log([...toDelete]);
  console.log(toDelete.size);
  if (doDelete) {
    for (const filename of toDelete) {
      fs.unlinkSync(`${FOLDER}/${filename}`);
    }
  }
}


const keepManual = [
  'ch_fr.json',
  'fr_latin9.json',
  'no_mac.json',
  'pt_mac.json'
];

/**
 * Second layout reduction - the step above leaves us with duplicate groups with longer names.
 * This finds the groups and prints them to the console. You then have to inspect the groups
 * and pick one name to stay. I usually took the shortest name or carries enough
 * valueable information. Feed your picks to the array `keepManual` above.
 * When done with your picks set `doDelete` to true to excute the deletion.
 */
function consolidateFiles2(doDelete = false) {
  const descriptions = {};
  for (let i = 0; i < XKB_DEFINITIONS.length; ++i) {
    descriptions[XKB_DEFINITIONS[i].name.replace(' ', '_')+'.json'] = XKB_DEFINITIONS[i].desc;
  }
  const filenames = fs.readdirSync(FOLDER);
  const data = {};
  for (let i = 0; i < filenames.length; ++i) {
    data[filenames[i]] = fs.readFileSync(`${FOLDER}/${filenames[i]}`, {encoding: 'utf-8'});
  }
  const toDelete = {};
  for (const filenameLeft in data) {
    const a = data[filenameLeft];
    const group = new Set();
    let cont = false;
    for (const fn in toDelete) {
      if (toDelete[fn].has(filenameLeft)) {
        cont = true;
        break;
      }
    }
    if (cont) {
      continue;
    }
    toDelete[filenameLeft] = new Set();
    toDelete[filenameLeft].add(filenameLeft);
    for (const filenameRight in data) {
      if (filenameRight === filenameLeft) {
        continue;
      }
      const b = data[filenameRight];
      if (a === b) {
        toDelete[filenameLeft].add(filenameRight);
      }
    }
  }
  const toKeep = [];
  for (const name in toDelete) {
    const entries = toDelete[name];
    if (entries.size === 1) {
      toKeep.push([...entries][0]);
      continue;
    }
    console.log('\n###GROUP');
    for (const filename of entries) {
      console.log(filename, descriptions[filename]);
    }
  }
  for (const fn of keepManual) {
    if (!filenames.includes(fn)) throw new Error(`${fn} is missing`);
  }
  console.log(toKeep.length, keepManual.length);
  const final = toKeep.concat(keepManual);
  console.log(final.length);

  if (doDelete) {
    for (const filename of filenames) {
      if (final.includes(filename)) {
        continue;
      }
      fs.unlinkSync(`${FOLDER}/${filename}`);
    }
  }
}


/**
 * This is a pure test function to check, if we truly have no duplicates left.
 */
function check() {
  const filenames = fs.readdirSync(FOLDER);
  const data = {};
  for (let i = 0; i < filenames.length; ++i) {
    data[filenames[i]] = fs.readFileSync(`${FOLDER}/${filenames[i]}`, {encoding: 'utf-8'});
  }
  const toDelete = new Set();
  for (const filenameLeft in data) {
    const a = data[filenameLeft];
    for (const filenameRight in data) {
      if (filenameRight === filenameLeft) {
        continue;
      }
      const b = data[filenameRight];
      if (a === b) {
        toDelete.add(filenameRight);
      }
    }
  }
  console.log([...toDelete]);
  console.log(toDelete.size);
}


//resolveDiacritics();
//resolveDiacritics(true);
//consolidateFiles();
//consolidateFiles(true);
//consolidateFiles2();
//consolidateFiles2(true);
check();
