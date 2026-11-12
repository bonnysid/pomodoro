import type { Ambience, Settings } from '../core/model';
import { ambientSamples } from './ambient-tracks';

class AudioService {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private kind = 'none';
  private settings: Settings | null = null;
  private playing = false;
  private previewKind: Exclude<Ambience, 'none'> | null = null;
  private previewTimer: ReturnType<typeof setTimeout> | undefined;
  private previewGeneration = 0;
  private previewListeners = new Set<(kind: Ambience | null) => void>();
  private buffers = new Map<Ambience, AudioBuffer>();

  onPreview(listener: (kind: Ambience | null) => void) {
    this.previewListeners.add(listener);
    listener(this.previewKind);
    return () => {
      this.previewListeners.delete(listener);
    };
  }
  async preview(kind: Exclude<Ambience, 'none'>, settings: Settings) {
    this.stopPreview();
    const generation = this.previewGeneration;
    this.settings = settings;
    this.previewKind = kind;
    for (const listener of this.previewListeners) listener(kind);
    await this.unlock();
    if (generation !== this.previewGeneration) return;
    this.render();
    this.previewTimer = setTimeout(() => this.stopPreview(), 12000);
  }
  stopPreview() {
    this.previewGeneration++;
    clearTimeout(this.previewTimer);
    this.previewKind = null;
    for (const listener of this.previewListeners) listener(null);
    this.render();
  }

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
    this.settings = settings;
    this.playing = playing;
    this.render();
  }
  private render() {
    const settings = this.settings;
    if (!settings) return;
    const ctx = this.context,
      kind =
        this.previewKind ?? (this.playing || settings.ambientAlways ? settings.ambience : 'none');
    if (!ctx) return;
    if (kind === this.kind) {
      this.gain?.gain.setTargetAtTime(settings.ambientVolume * 0.22, ctx.currentTime, 0.12);
      return;
    }
    const previousSource = this.source;
    const previousGain = this.gain;
    if (previousSource && previousGain) {
      previousGain.gain.cancelAndHoldAtTime(ctx.currentTime);
      previousGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.08);
      previousSource.stop(ctx.currentTime + 0.09);
      previousSource.onended = () => {
        previousSource.disconnect();
        previousGain.disconnect();
      };
    }
    this.source = null;
    this.gain = null;
    this.kind = kind;
    if (kind === 'none') return;
    let buffer = this.buffers.get(kind);
    if (!buffer) {
      const sampleRate = 22050;
      const samples = ambientSamples(kind, sampleRate);
      buffer = ctx.createBuffer(1, samples.length, sampleRate);
      buffer.getChannelData(0).set(samples);
      this.buffers.set(kind, buffer);
    }
    this.source = ctx.createBufferSource();
    this.source.buffer = buffer;
    this.source.loop = true;
    this.gain = ctx.createGain();
    this.gain.gain.setValueAtTime(0, ctx.currentTime);
    this.gain.gain.linearRampToValueAtTime(settings.ambientVolume * 0.22, ctx.currentTime + 0.1);
    this.source.connect(this.gain).connect(ctx.destination);
    this.source.start();
  }
}
export const audio = new AudioService();
