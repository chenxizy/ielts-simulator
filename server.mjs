import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listLocalExams } from './local-exams.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const questionsRoot = resolve(process.env.IELTS_QUESTIONS_DIR || join(root, '试题'));
const port = Number(process.env.PORT || 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
};

function sendJson(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(JSON.stringify(value));
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === '/api/local-exams') {
      const exams = await listLocalExams(questionsRoot);
      sendJson(res, 200, { apiVersion: 2, exams: exams.map(({ exam, assets, ...item }) => item) });
      return;
    }
    if (pathname === '/api/local-exam' || pathname === '/api/local-asset') {
      const exams = await listLocalExams(questionsRoot);
      const selected = exams.find(item => item.folder === url.searchParams.get('folder') && !item.error);
      if (!selected) { sendJson(res, 404, { error: '没有找到这套本地试卷' }); return; }
      if (pathname === '/api/local-exam') {
        sendJson(res, 200, { exam: selected.exam, assets: selected.assets.map(asset => ({
          name: asset.name,
          url: `/api/local-asset?folder=${encodeURIComponent(selected.folder)}&path=${encodeURIComponent(asset.path)}`,
        })) });
        return;
      }
      const asset = selected.assets.find(item => item.path === url.searchParams.get('path'));
      if (!asset) { sendJson(res, 404, { error: '没有找到素材' }); return; }
      const body = await readFile(join(questionsRoot, selected.folder, 'assets', ...asset.path.split('/')));
      res.writeHead(200, { 'Content-Type': types[extname(asset.name).toLowerCase()], 'Cache-Control': 'no-cache' });
      res.end(body);
      return;
    }
    const relative = normalize(pathname.replace(/^\/+/, '') || 'index.html');
    const absolute = join(root, relative);
    if (relative.startsWith('..') || !absolute.startsWith(root + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const info = await stat(absolute);
    if (!info.isFile()) throw new Error('Not a file');
    const body = await readFile(absolute);
    res.writeHead(200, {
      'Content-Type': types[extname(absolute).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`IELTS simulator: http://localhost:${port}\n`);
});
