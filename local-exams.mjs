import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { AUDIO_EXTENSIONS, IMAGE_EXTENSIONS, matchingAssetNames } from './media.mjs';
import { validateExam } from './schema.mjs';

const mediaExtensions = new Set([...IMAGE_EXTENSIONS, ...AUDIO_EXTENSIONS]);

async function directoryEntries(folder) {
  try { return await readdir(folder, { withFileTypes: true }); }
  catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function findExamFolders(root, relative = '', depth = 0) {
  const entries = await directoryEntries(join(root, relative));
  if (entries.some(entry => entry.isFile() && entry.name.toLowerCase() === 'exam.json')) return [relative];
  if (depth >= 3) return [];
  const children = entries.filter(entry => entry.isDirectory() && !entry.name.startsWith('.'));
  const nested = await Promise.all(children.map(entry =>
    findExamFolders(root, join(relative, entry.name), depth + 1)));
  return nested.flat();
}

async function findAssets(folder, relative = '', depth = 0) {
  if (depth >= 5) return [];
  const entries = await directoryEntries(join(folder, 'assets', relative));
  const files = entries.filter(entry => entry.isFile() && mediaExtensions.has(extname(entry.name).toLowerCase()))
    .map(entry => ({ name: entry.name, path: [...relative.split(/[\\/]/).filter(Boolean), entry.name].join('/') }));
  const nested = await Promise.all(entries.filter(entry => entry.isDirectory())
    .map(entry => findAssets(folder, join(relative, entry.name), depth + 1)));
  return files.concat(nested.flat());
}

export async function listLocalExams(root) {
  const folders = await findExamFolders(root);
  const exams = await Promise.all(folders.map(async relative => {
    const folder = relative.split(/[\\/]/).join('/');
    try {
      const exam = JSON.parse(await readFile(join(root, relative, 'exam.json'), 'utf8'));
      const errors = validateExam(exam);
      if (errors.length) throw new Error(errors.slice(0, 3).join('；'));
      const assets = await findAssets(join(root, relative));
      const names = assets.map(asset => asset.name.toLowerCase());
      const missingAudio = exam.modules.find(module => module.kind === 'listening')?.parts
        .filter(part => !matchingAssetNames(names, part.id, AUDIO_EXTENSIONS).length)
        .map(part => part.id) || [];
      return { folder, title: exam.title, collection: folder.split('/').slice(0, -1).join('/'),
        mediaCount: assets.length, missingAudio, exam, assets };
    } catch (error) {
      return { folder, title: folder.split('/').at(-1), error: error.message };
    }
  }));
  return exams.sort((a, b) => a.folder.localeCompare(b.folder, 'zh-CN', { numeric: true }));
}
