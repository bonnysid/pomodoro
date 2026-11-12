The Ogg files are original synthetic 2-second sine waves for decoder/playlist tests. They are not Minecraft recordings.

Generated with FFmpeg:

```
ffmpeg -f lavfi -i "sine=frequency=330:duration=2" -c:a libvorbis tone-a.ogg
ffmpeg -f lavfi -i "sine=frequency=440:duration=2" -c:a libvorbis tone-b.ogg
```
