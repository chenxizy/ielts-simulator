export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'];
export const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.ogg'];

export function matchingAssetNames(names, key, extensions) {
  const normalizedKey = key.toUpperCase();
  const matches = [];
  for (const name of names) {
    const dot = name.lastIndexOf('.');
    if (dot < 0 || !extensions.includes(name.slice(dot).toLowerCase())) continue;
    const stem = name.slice(0, dot).toUpperCase();
    if (stem === normalizedKey) matches.push({ name, order: 1 });
    else if (stem.startsWith(`${normalizedKey}-`)) {
      const suffix = stem.slice(normalizedKey.length + 1);
      if (/^[2-9]\d*$/.test(suffix)) matches.push({ name, order: Number(suffix) });
    }
  }
  return matches.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)).map(item => item.name);
}
