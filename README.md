# xkb-layouts

XKB keymaps with a keyboard layout detector for the browser.

Note that it only contains the unshifted values
(which is a particular requirement for the kitty keyboard protocol in xterm.js).

For electron based application you are better served with `@vscodium/native-keymap`.

## Usage

```javascript
import Detector from 'xkb-layouts';
import KEYMAPS from 'xkb-layouts/keymapsResolved';

const ld = new Detector(KEYMAPS);

// feed the detector `code` and `key` from unshifted keyboard events, e.g.
some_input_field.addEventListener('keydown', ev => {
  if (isUnshifted(ev)) { // must test for all key shifting modifiers!
    ld.feed(ev.code, ev.key);
  }
});

// inspect the layout matches of seen keys
ld.matches();
// guess the character for a key code
ld.guessKey('KeyA');

// to implement a layout discovery, use `resolve`
let toResolve = ld.resolve();
while (toResolve.layouts.length > 1) {
  const to_press = toResolve.keys[one_of];
  ask_user(to_press); // must record the key with `feed`
  toResolve = ld.resolve();
}
// activate the found layout
ld.activeLayout = toResolve.layouts[0];
// now use `getActiveKey` w'o the uncertainty of `guessKey`
const a_char = ld.getActiveKey('KeyA');
```

## Notes

- `navigator.keyboard.getLayoutMap()`\
  Chromium based browsers implement this experimental interface. It does not work reliable
  in tests, it shows slightly off characters or does not change the map at all from
  the layout switcher in the taskbar. Thus we don't rely on this at all.

- *Changing Keyboard Layout*\
  When the user switches the keyboard layout on OS side we cannot directly spot that.
  Instead the detector will reset its recorded key characters if a mismatch to a previous
  recording was found. Use the callback registered with `setDiscard` to act upon it
  (e.g. redraw the layout discovery dialog if your appilcation needs strict layout knowledge).
  Note that a manually activated layout gets not automatically reset,
  also do that from your discard handler.

- *Dead Key Handling*\
  The package provides two different layout maps, one with dead key characters (`keymaps.ts`)
  and one with dead keys resolved by a second press (`keymapsResolved.ts`). The first one
  is tricky to use for layout detection since browsers do not produce the diacritic characters
  to be consumed by Javascript directly. It is still possible to intercept the dead key fact
  during key presses and then map the found character back to its dead version by this mapping
  (contains known dead key mappings in XKB layouts):
  ```javascript
  const key2dead = {
    "`": 768, "´": 769, "^": 770, "~": 771,
    "¯": 772, "˙": 775, "¨": 776, "°": 778,
    "ˇ": 780, "¸": 807, "ͺ": 837
  };
  if (wasDead(key) && key2dead[key])
    key = String.fromCharCode(key2dead[key])
  ld.feed(code, key);
  ```


## Build Instructions

The repo contains the duplicate reduced keymaps of Ubuntu 24 under `layout` and `layout_dead_resolved`.

To extract the maps from your system, run the following commands:
```bash
# generate xkb JSON file
python bin/extract_xkb_layouts.py > xkb_layouts.json
# create a target folder
mkdir target_folder
# create all layout JSON files (uncomment generateLayoutFiles() in script)
node bin/create_layouts.js xkb_layouts.json target_folder
# do duplicate reductions as needed (see create_layouts.js comments)
# and/or resolve dead keys (cumbersome, see resolve_dead.js)
```
The creation of all layout files takes quite long and effectively blocks your GUI session,
as it iterates through ~600 layouts, activates them with `setxkbmap` and
extracts the keymaps with the help of the node package `@vscodium/native-keymap`.

If something goes wrong during this process, make sure to have a second terminal waiting
with this recovery command:
```bash
# typical defaults: us, gb, de
setxkbmap your_default_layout
```

To build a typescript module from the layout files, run `create_map.js` (uncomment the line `writeToFile`).
```bash
node bin/create_map.js target_folder/*
```
