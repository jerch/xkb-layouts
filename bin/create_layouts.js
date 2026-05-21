import fs from 'node:fs';
import keymap from '@vscodium/native-keymap';
import { execSync } from 'node:child_process';

if (process.argv.length !== 4) {
  console.log('usage: node bin/create_layouts.js <xkb-json-file> <layout-folder>');
  process.exit(1);
}

const XKB_DEFINITIONS = JSON.parse(fs.readFileSync(process.argv[2]));
const FOLDER = process.argv[3];


const codes = [
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

function generateLayout(km) {
  const layout = {};
  for (const code of codes) {
    layout[code] = km[code].value;
  }
  return layout;
}


/**
 * Generates all layout files from the xkb JSON file.
 * This takes a while to run (~10 minutes).
 */
function generateLayoutFiles() {
  for (let i = 0; i < XKB_DEFINITIONS.length; ++i) {
    const name = XKB_DEFINITIONS[i].name;
    console.log(i, name);
    execSync(`setxkbmap ${name}`);
    execSync(`sleep 1`);
    try {
      const km = keymap.getKeyMap();
      const layout = generateLayout(km);
      fs.writeFileSync(`${FOLDER}/${name.replace(' ', '_')}.json`, JSON.stringify(layout, null, 2));
    } catch {
      console.log('something wrong');
      execSync(`setxkbmap de`);
      break;
    }
  }
  execSync(`setxkbmap de`);
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
  'ir.json',
  'de.json',
  'de_nodeadkeys.json',
  'us.json',
  'ba.json',
  'ba_unicode.json',
  'ba_unicodeus.json',
  'ba_us.json',
  'bd_probhat.json',
  'brai.json',
  'ch_fr.json',
  'us_dvorak.json',
  'cz_qwerty.json',
  'de_deadacute.json',
  'dk_nodeadkeys.json',
  'fr.json',
  'gb_intl.json',
  'us_intl.json',
  'eg.json',
  'se.json',
  'se_nodeadkeys.json',
  'se_smi.json',
  'fr_bepo.json',
  'fr_nodeadkeys.json',
  'gb.json',
  'gb_colemak_dh.json',
  'ge_os.json',
  'gh_fula.json',
  'hu_qwerty.json',
  'hu_101_qwertz_dot_dead.json',
  'hu_102_qwerty_dot_dead.json',
  'id_melayu-phonetic.json',
  'in_ben-kagapa.json',
  'in_hin-kagapa.json',
  'lk_tam_unicode.json',
  'lk_tam_TAB.json',
  'pk_urd-crulp.json',
  'pk_urd-nla.json',
  'tr_ku.json',
  'iq_ku_ara.json',
  'iq_ku_f.json',
  'jp_kana86.json',
  'jp_kana.json',
  'latam.json',
  'ma_tifinagh-alt.json',
  'ma_tifinagh-extended.json',
  'ma_tifinagh.json',
  'ro.json',
  'rs_yz.json',
  'us_mac.json',
  'mm_zgt.json',
  'us_colemak_dh_wide_iso.json',
  'no_smi.json',
  'us_dvp.json',
  'us_haw.json'
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


/**
 * Uncomment and execute as needed. See comments at the functions for instructions.
 */
//generateLayoutFiles();
//consolidateFiles();
//consolidateFiles(true);
//consolidateFiles2();
//consolidateFiles2(true);
//check();
