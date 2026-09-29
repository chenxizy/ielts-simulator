import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { listLocalExams } from './local-exams.mjs';

test('本地题库发现分册中的试卷，并分别关联图片与可选音频', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ielts-local-test-'));
  try {
    const folder = join(root, 'Cambridge IELTS 20 Academic', 'Test 1');
    await mkdir(join(folder, 'assets', 'pictures'), { recursive: true });
    await writeFile(join(folder, 'exam.json'), await readFile('./examples/exam.json'));
    await writeFile(join(folder, 'assets', 'pictures', 'W01.png'), 'image');
    await writeFile(join(folder, 'assets', 'L-P1.mp3'), 'audio');
    await writeFile(join(folder, 'assets', 'ignore.pdf'), 'not a media asset');

    const exams = await listLocalExams(root);
    assert.equal(exams.length, 1);
    assert.equal(exams[0].folder, 'Cambridge IELTS 20 Academic/Test 1');
    assert.deepEqual(exams[0].assets.map(asset => asset.path).sort(), ['L-P1.mp3', 'pictures/W01.png']);
    assert.deepEqual(exams[0].missingAudio, ['L-P2', 'L-P3', 'L-P4']);
  } finally {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
    assert.ok(basename(root).startsWith('ielts-local-test-'));
    await rm(root, { recursive: true, force: true });
  }
});
