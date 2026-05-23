import { RuntimeCase } from 'xterm-benchmark';
import Detector from './Detector.js';
import keymaps from './keymaps.js';


const dect = new Detector(keymaps);
//dect.feed('KeyQ', 'q');

const RUNS = 10;

new RuntimeCase('guess x1000', () => {
  for (let i = 0; i < 1000; ++i)
    dect.guessKey('KeyQ');
}, { repeat: RUNS }).showAverageRuntime();

new RuntimeCase('matches x1000', () => {
  for (let i = 0; i < 1000; ++i)
    dect.matches();
}, { repeat: RUNS }).showAverageRuntime();

new RuntimeCase('resolve x1000', () => {
  for (let i = 0; i < 1000; ++i)
    dect.resolve();
}, { repeat: RUNS }).showAverageRuntime();
