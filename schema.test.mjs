import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { answerMatches, validateExam } from './schema.mjs';
import { AUDIO_EXTENSIONS, IMAGE_EXTENSIONS, matchingAssetNames } from './media.mjs';

const readJson = async path => JSON.parse(await readFile(path, 'utf8'));

test('示例和 40/40/2 题模板均可直接导入', async () => {
  const sample = await readJson('./examples/exam.json');
  const template = await readJson('./template/exam.json');
  assert.deepEqual(validateExam(sample), []);
  assert.deepEqual(validateExam(template), []);
  assert.equal(template.modules[0].parts.flatMap(p => p.groups.flatMap(g => g.questions)).length, 40);
  assert.equal(template.modules[1].parts.flatMap(p => p.groups.flatMap(g => g.questions)).length, 40);
  assert.equal(template.modules[2].parts.flatMap(p => p.groups.flatMap(g => g.questions)).length, 2);
});

test('题号重复和 inline 占位符错误会给出可定位提示', async () => {
  const sample = await readJson('./examples/exam.json');
  sample.modules[0].parts[0].groups[0].questions[1].id = 'L01';
  const errors = validateExam(sample);
  assert.ok(errors.some(message => message.includes('题号 L01 重复')));
  assert.ok(errors.some(message => message.includes('不存在的题号 L02')));
});

test('答案核对支持大小写、空格、同义答案及多选', () => {
  assert.equal(answerMatches({ type: 'text', answer: ['centre', 'center'] }, ' Center '), true);
  assert.equal(answerMatches({ type: 'multiple_choice', answer: ['A', 'C'] }, ['C', 'A']), true);
  assert.equal(answerMatches({ type: 'multiple_choice', answer: ['A', 'C'] }, ['A']), false);
  assert.equal(answerMatches({ type: 'essay' }, 'anything'), null);
});

test('素材按题号和 Part 匹配，不需要 JSON 路径', () => {
  const files = ['R02-3.png', 'R01.png', 'R02.svg', 'R02-2.jpg', 'W01.png', 'L-P1.mp3', 'L-P2.wav'];
  assert.deepEqual(matchingAssetNames(files, 'R02', IMAGE_EXTENSIONS), ['R02.svg', 'R02-2.jpg', 'R02-3.png']);
  assert.deepEqual(matchingAssetNames(files, 'W01', IMAGE_EXTENSIONS), ['W01.png']);
  assert.deepEqual(matchingAssetNames(files, 'L-P1', AUDIO_EXTENSIONS), ['L-P1.mp3']);
  assert.deepEqual(matchingAssetNames(files, 'R03', IMAGE_EXTENSIONS), []);
});
