import type { Settings } from '../core/model';

class AudioService {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private kind = 'none';

  async unlock() {
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') await this.context.resume();
    } catch (error) {
      console.warn('Audio is unavailable:', error);
    }
  }
  chime(volume: number) {
    const ctx = this.context;
    if (ctx?.state !== 'running') return;
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator(),
        gain = ctx.createGain(),
        start = ctx.currentTime + index * 0.17;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume * 0.18, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.7);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.75);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
  }
  ambience(settings: Settings, playing: boolean) {
    const ctx = this.context,
      kind = playing ? settings.ambience : 'none';
    if (!ctx) return;
    if (kind === this.kind) {
      this.gain?.gain.setTargetAtTime(settings.ambientVolume * 0.22, ctx.currentTime, 0.12);
      return;
    }
    this.source?.stop();
    this.source?.disconnect();
    this.gain?.disconnect();
    this.source = null;
    this.gain = null;
    this.kind = kind;
    if (kind === 'none') return;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate),
      samples = buffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < samples.length; i++) {
      const white = Math.random() * 2 - 1;
      brown = (brown + 0.02 * white) / 1.02;
      samples[i] = kind === 'brown' ? brown * 3.5 : white;
    }
    this.source = ctx.createBufferSource();
    this.source.buffer = buffer;
    this.source.loop = true;
    this.gain = ctx.createGain();
    this.gain.gain.value = settings.ambientVolume * 0.22;
    this.source.connect(this.gain).connect(ctx.destination);
    this.source.start();
  }
}
export const audio = new AudioService();
