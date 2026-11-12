// 소리 점검: 녹음한 한 음을 프레임으로 잘라 검출 결과를 통계로 만든다.
import { detectPitch, rmsLevel } from './pitch.js';
import { midiToFreq, centsBetween, describeFreq } from './notes.js';
import { median } from './tuner.js';

export function analyzeTake(samples, sampleRate, expectedMidi, options = {}) {
  const frame = options.frame ?? 4096;
  const hop = options.hop ?? 2048;
  const minRms = options.minRms ?? 0.004;
  const minClarity = options.minClarity ?? 0.85;
  const a4 = options.a4 ?? 440;
  const target = midiToFreq(expectedMidi, a4);

  let frames = 0, heard = 0, correct = 0, peakRms = 0;
  const cents = [], clarities = [], others = {};
  for (let start = 0; start + frame <= samples.length; start += hop) {
    const buf = samples.subarray(start, start + frame);
    frames++;
    const level = rmsLevel(buf);
    if (level > peakRms) peakRms = level;
    if (level < minRms) continue;
    const { freq, clarity } = detectPitch(buf, sampleRate);
    if (!(freq > 0) || clarity < minClarity) continue;
    heard++;
    clarities.push(clarity);
    const c = centsBetween(freq, target);
    if (Math.abs(c) < 50) {
      correct++;
      cents.push(c);
    } else {
      const name = describeFreq(freq, a4).name;
      others[name] = (others[name] || 0) + 1;
    }
  }
  return {
    frames,
    heard,
    correct,
    hitRate: heard ? correct / heard : 0,
    medianCents: cents.length ? median(cents) : null,
    medianClarity: clarities.length ? median(clarities) : null,
    peakRms,
    others,
  };
}
