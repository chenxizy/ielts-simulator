import { mkdir, writeFile } from 'node:fs/promises';
import { validateExam } from './schema.mjs';

const two = value => String(value).padStart(2, '0');
let listeningNumber = 1;
let readingNumber = 1;

const listeningParts = Array.from({ length: 4 }, (_, index) => {
  const questions = Array.from({ length: 10 }, () => ({
    id: `L${two(listeningNumber++)}`,
    type: 'text'
  }));
  return {
    id: `L-P${index + 1}`,
    title: `Part ${index + 1}`,
    instructions: `[填写听力 Part ${index + 1} 指令]`,
    groups: [{
      title: `Questions ${questionNumber(questions[0])}–${questionNumber(questions.at(-1))}`,
      instructions: '[填写本题组答题说明]',
      layout: 'inline',
      content: questions.map(question => `${question.id}：{{${question.id}}}`).join('\n'),
      questions,
    }],
  };
});

const readingParts = [13, 13, 14].map((count, index) => {
  const questions = Array.from({ length: count }, () => ({
    id: `R${two(readingNumber++)}`,
    type: 'text',
    prompt: '[填写题干]'
  }));
  return {
    id: `R-P${index + 1}`,
    title: `Part ${index + 1}`,
    instructions: `[填写阅读 Part ${index + 1} 指令]`,
    passageTitle: '[填写文章标题]',
    passage: '[填写文章第一段。]\n\n[填写文章第二段。]',
    groups: [{
      title: `Questions ${questionNumber(questions[0])}–${questionNumber(questions.at(-1))}`,
      instructions: '[填写本题组答题说明]',
      layout: 'list',
      questions,
    }],
  };
});

const writingParts = [1, 2].map((number, index) => ({
  id: `W-P${number}`,
  title: `Part ${number}`,
  instructions: index === 0
    ? 'You should spend about 20 minutes on this task. Write at least 150 words.'
    : 'You should spend about 40 minutes on this task. Write at least 250 words.',
  passage: '[填写写作题目文字。若有图表，把图片命名为 W01.png 或 W02.png。]',
  groups: [{
    title: `Task ${number}`,
    instructions: 'Write your answer in the box on the right.',
    layout: 'list',
    questions: [{ id: `W${two(number)}`, type: 'essay', prompt: '[填写简短题目名称]' }],
  }],
}));

const exam = {
  schemaVersion: 1,
  id: 'my-ielts-mock-001',
  title: '我的雅思模拟试卷 001',
  testType: 'academic',
  modules: [
    { kind: 'listening', durationMinutes: null, parts: listeningParts },
    { kind: 'reading', durationMinutes: null, parts: readingParts },
    { kind: 'writing', durationMinutes: null, parts: writingParts },
  ],
};

function questionNumber(question) { return Number(question.id.slice(1)); }

const errors = validateExam(exam);
if (errors.length) throw new Error(errors.join('\n'));
await mkdir('template', { recursive: true });
await writeFile('template/exam.json', `${JSON.stringify(exam, null, 2)}\n`, 'utf8');
process.stdout.write('Generated template/exam.json\n');
