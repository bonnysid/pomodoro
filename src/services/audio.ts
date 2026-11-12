import type { Ambience, Settings } from '../core/model';
import type { MusicTrack } from '../shared/contracts';
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
  private musicTracks: MusicTrack[] = [];
  private musicIndex = 0;
  private media: HTMLAudioElement | null = null;
  private musicError = false;
  private musicErrorListeners = new Set<(error: boolean) => void>();

  onMusicError(listener: (error: boolean) => void) {
    this.musicErrorListeners.add(listener);
    listener(this.musicError);
    return () => {
      this.musicErrorListeners.delete(listener);
    };
  }
  private setMusicError(error: boolean) {
    this.musicError = error;
    for (const listener of this.musicErrorListeners) listener(error);
  }
  setMinecraftTracks(tracks: MusicTrack[]) {
    if (tracks.map((track) => track.id).join() === this.musicTracks.map((track) => track.id).join())
      return;
    this.musicTracks = tracks;
    this.musicIndex = 0;
    this.media?.pause();
    this.media?.removeAttribute('src');
    this.media?.load();
    this.setMusicError(false);
    this.kind = 'none';
    this.render();
  }
  private playMinecraft() {
    if (!this.musicTracks.length || this.musicError) return;
    if (!this.media) {
      this.media = new Audio();
      this.media.preload = 'auto';
      this.media.onended = () => {
        if (this.kind !== 'minecraft') return;
        this.musicIndex = (this.musicIndex + 1) % this.musicTracks.length;
        this.media?.removeAttribute('src');
        this.playMinecraft();
      };
      this.media.onerror = () => this.setMusicError(true);
    }
    if (!this.media.getAttribute('src'))
      this.media.src = `pomodoro://app/music/${this.musicTracks[this.musicIndex].id}.ogg`;
    this.media.volume = this.settings?.ambientVolume ?? 0.15;
    void this.media.play().catch(() => {
      if (this.kind === 'minecraft') this.setMusicError(true);
    });
  }

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
      if (this.media) this.media.volume = settings.ambientVolume;
      return;
    }
    this.media?.pause();
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
    if (kind === 'minecraft') {
      this.setMusicError(false);
      this.playMinecraft();
      return;
    }
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
