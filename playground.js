import Detector from 'xkb-layouts';
import KEYMAPS from 'xkb-layouts/keymapsResolved';


const ld = new Detector(KEYMAPS);
ld.matches();
//ld.feed('KeyQ', 'q');
//ld.feed('Digit1', '1');
//ld.feed('Digit2', '2');
//ld.feed('Digit3', '3');
//ld.feed('Digit4', '4');
//ld.feed('Digit5', '5');
//ld.feed('Digit6', '6');
//ld.feed('Digit7', '7');
//ld.feed('Digit8', '8');
//ld.feed('Digit9', '9');
//ld.feed('KeyA', 'a');
//ld.feed('Minus', 'ß');
const start = performance.now();
for (let i = 0; i < 1000; ++i) {
  //new LayoutDetector(MAP);
  ld.resolve();
  //ld.guessKey('KeyQ');
  //ld.getLayoutKey('KeyQ', 'EN_US');
}
const end = performance.now();
console.log(end-start, ld.resolve());
//console.log(end-start, ld.guessKey('KeyQ'));
//console.log(ld.getRecordedLayoutMap());
