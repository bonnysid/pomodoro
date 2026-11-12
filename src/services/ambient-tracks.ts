import type { Ambience } from '../core/model';

// Original procedural compositions; no samples or melodies from third-party recordings.
// Notes wrap their release tails into the start of the buffer for a continuous loop.
export function ambientSamples(kind: Exclude<Ambience, 'none'>, sampleRate: number): Float32Array {
  const musical = kind === 'lofi' || kind === 'worlds';
  const beat = 60 / (kind === 'lofi' ? 76 : 56);
  const duration = musical ? beat * 64 : 4;
  const samples = new Float32Array(Math.round(sampleRate * duration));
  let seed = 1729;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  if (!musical) {
    let brown = 0;
    for (let i = 0; i < samples.length; i++) {
      const white = random() * 2 - 1;
      brown = (brown + 0.02 * white) / 1.02;
      samples[i] = kind === 'brown' ? brown * 3.5 : white;
    }
    return samples;
  }
  const note = (midi: number, start: number, length: number, level: number, soft = false) => {
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const offset = Math.round(start * sampleRate);
    for (let i = 0; i < length * sampleRate; i++) {
      const t = i / sampleRate;
      const attack = Math.min(1, t / (soft ? 0.3 : 0.012));
      const release = Math.min(1, (length - t) / 0.6);
      const envelope = attack * release * Math.exp(-t / (soft ? 2.4 : 1.5));
      const phase = 2 * Math.PI * frequency * t;
      const tone = Math.sin(phase) + 0.18 * Math.sin(phase * 2) * Math.exp(-t * 2);
      samples[(offset + i) % samples.length] += tone * envelope * level;
    }
  };
  const chords = [
    [48, 55, 59, 64],
    [53, 57, 60, 67],
    [45, 52, 55, 60],
    [50, 57, 60, 65],
  ];
  const melody = [76, 71, 67, 74, 72, 79, 76, 69, 71, 67, 74, 72, 77, 76, 69, 72];
  for (let bar = 0; bar < 16; bar++) {
    const start = bar * 4 * beat;
    const chord = chords[Math.floor(bar / 2) % chords.length];
    chord.forEach((pitch, index) => {
      note(pitch, start + index * 0.025, beat * 5, 0.1, true);
    });
    note(melody[bar], start + beat * 0.5, beat * 2.7, 0.16);
    note(melody[(bar + 5) % melody.length], start + beat * 2.5, beat * 2.2, 0.11);
    if (kind !== 'lofi') continue;
    note(chord[0] - 12, start, beat * 1.4, 0.18);
    note(chord[0] - 12, start + beat * 2.5, beat, 0.14);
    for (let step = 0; step < 8; step++) {
      const offset = Math.round((start + (step / 2 + (step % 2 ? 0.07 : 0)) * beat) * sampleRate);
      for (let i = 0; i < sampleRate * 0.18; i++) {
        const t = i / sampleRate;
        const hat = (random() * 2 - 1) * Math.exp(-t * 65) * 0.035;
        const kick =
          step % 4 === 0
            ? Math.sin(2 * Math.PI * (48 * t + 3 * (1 - Math.exp(-t * 25)))) *
              Math.exp(-t * 24) *
              0.22
            : 0;
        const snare = step % 4 === 2 ? (random() * 2 - 1) * Math.exp(-t * 32) * 0.065 : 0;
        samples[(offset + i) % samples.length] += hat + kick + snare;
      }
    }
  }
  return samples;
}
