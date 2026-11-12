import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import type { MusicTrack } from '../src/shared/contracts';

const titles: Record<string, string> = {
  minecraft: 'Minecraft',
  sweden: 'Sweden',
  clark: 'Clark',
  wet_hands: 'Wet Hands',
  dry_hands: 'Dry Hands',
  subwoofer_lullaby: 'Subwoofer Lullaby',
  living_mice: 'Living Mice',
  haggstrom: 'Haggstrom',
  danny: 'Danny',
  mice_on_venus: 'Mice on Venus',
};
const aliases: Record<string, string> = {
  calm1: 'minecraft',
  calm2: 'clark',
  calm3: 'sweden',
  hal1: 'subwoofer_lullaby',
  hal2: 'living_mice',
  hal3: 'haggstrom',
  hal4: 'danny',
  piano1: 'dry_hands',
  piano2: 'wet_hands',
  piano3: 'mice_on_venus',
};
type LocalTrack = MusicTrack & { file: string };

/** Reads only known calm music objects from a user-selected Java Edition assets directory. */
export function findMinecraftMusic(directory: string): LocalTrack[] {
  const root = existsSync(path.join(directory, 'indexes'))
    ? directory
    : path.join(directory, 'assets');
  const indexes = path.join(root, 'indexes');
  if (!existsSync(indexes)) return [];
  const found = new Map<string, LocalTrack>();
  for (const name of readdirSync(indexes)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, 100)) {
    try {
      const indexFile = path.join(indexes, name);
      if (statSync(indexFile).size > 8 * 1024 * 1024) continue;
      const data = JSON.parse(readFileSync(indexFile, 'utf8'));
      for (const [key, value] of Object.entries(data.objects || {})) {
        const match = /^minecraft\/sounds\/music\/game\/([a-z0-9_]+)\.ogg$/.exec(key);
        if (!match) continue;
        const slug = aliases[match[1]] || match[1];
        if (!Object.hasOwn(titles, slug) || found.has(slug)) continue;
        const hash = (value as { hash?: unknown })?.hash;
        if (typeof hash !== 'string' || !/^[a-f0-9]{40}$/.test(hash)) continue;
        const file = path.join(root, 'objects', hash.slice(0, 2), hash);
        if (!existsSync(file)) continue;
        const stats = statSync(file);
        if (!stats.isFile() || stats.size < 4 || stats.size > 20 * 1024 * 1024) continue;
        const bytes = readFileSync(file);
        if (
          bytes.subarray(0, 4).toString() !== 'OggS' ||
          createHash('sha1').update(bytes).digest('hex') !== hash
        )
          continue;
        found.set(slug, { id: hash, title: titles[slug], file });
      }
    } catch {
      /* Ignore incomplete or corrupt indexes; other installed versions may be usable. */
    }
  }
  return Object.keys(titles).flatMap((slug) => {
    const track = found.get(slug);
    return track ? [track] : [];
  });
}

export class MinecraftMusic {
  private tracks: LocalTrack[] = [];
  constructor(private readonly configFile: string) {
    try {
      const { directory } = JSON.parse(readFileSync(configFile, 'utf8'));
      if (typeof directory === 'string') this.tracks = findMinecraftMusic(directory);
    } catch {
      /* No library connected yet. */
    }
  }
  get summary(): MusicTrack[] {
    return this.tracks.map(({ id, title }) => ({ id, title }));
  }
  file(id: string) {
    return this.tracks.find((track) => track.id === id)?.file;
  }
  connect(directory: string) {
    const tracks = findMinecraftMusic(directory);
    if (!tracks.length) return false;
    this.save(directory);
    this.tracks = tracks;
    return true;
  }
  disconnect() {
    this.save(null);
    this.tracks = [];
  }
  private save(directory: string | null) {
    mkdirSync(path.dirname(this.configFile), { recursive: true });
    writeFileSync(`${this.configFile}.tmp`, JSON.stringify({ directory }));
    renameSync(`${this.configFile}.tmp`, this.configFile);
  }
}
