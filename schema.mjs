export const MODULES = {
  listening: { prefix: 'L', label: 'Listening', count: 4 },
  reading: { prefix: 'R', label: 'Reading', count: 3 },
  writing: { prefix: 'W', label: 'Writing', count: 2 },
};

export const QUESTION_TYPES = new Set([
  'text', 'single_choice', 'multiple_choice', 'select',
  'true_false_not_given', 'yes_no_not_given', 'essay',
]);

export function questionNumber(id) {
  return Number(String(id).slice(1));
}

export function allQuestions(module) {
  return module.parts.flatMap(part => part.groups.flatMap(group => group.questions));
}

export function validateExam(exam) {
  const errors = [];
  const fail = (where, message) => errors.push(`${where}：${message}`);
  if (!exam || typeof exam !== 'object' || Array.isArray(exam)) return ['exam.json：顶层必须是 JSON 对象'];
  if (exam.schemaVersion !== 1) fail('schemaVersion', '必须为数字 1');
  if (typeof exam.id !== 'string' || !/^[a-z0-9][a-z0-9_-]{1,63}$/i.test(exam.id)) fail('id', '使用 2–64 位英文字母、数字、短横线或下划线');
  if (typeof exam.title !== 'string' || !exam.title.trim()) fail('title', '必须填写试卷标题');
  if (!['academic', 'general'].includes(exam.testType)) fail('testType', '只能是 academic 或 general');
  if (!Array.isArray(exam.modules) || !exam.modules.length) {
    fail('modules', '至少填写一个模块');
    return errors;
  }

  const kinds = new Set();
  for (const [mi, module] of exam.modules.entries()) {
    const at = `modules[${mi}]`;
    const definition = MODULES[module?.kind];
    if (!definition) { fail(at, 'kind 只能是 listening、reading 或 writing'); continue; }
    if (kinds.has(module.kind)) fail(at, `${module.kind} 重复`);
    kinds.add(module.kind);
    if (module.durationMinutes !== undefined && module.durationMinutes !== null &&
        (!Number.isInteger(module.durationMinutes) || module.durationMinutes < 1 || module.durationMinutes > 180)) {
      fail(at, 'durationMinutes 须为 1–180 的整数，或 null 表示不计时');
    }
    if (!Array.isArray(module.parts) || !module.parts.length) { fail(at, 'parts 至少有一个 Part'); continue; }
    const ids = new Set();
    for (const [pi, part] of module.parts.entries()) {
      const pat = `${at}.parts[${pi}]`;
      const expectedPartId = `${definition.prefix}-P${pi + 1}`;
      if (part?.id !== expectedPartId) fail(pat, `id 必须为 ${expectedPartId}`);
      if (part?.title !== undefined && typeof part.title !== 'string') fail(pat, 'title 必须是文字');
      if (part?.instructions !== undefined && typeof part.instructions !== 'string') fail(pat, 'instructions 必须是文字');
      if (part?.passageTitle !== undefined && typeof part.passageTitle !== 'string') fail(pat, 'passageTitle 必须是文字');
      if (part?.passage !== undefined && typeof part.passage !== 'string') fail(pat, 'passage 必须是纯文字');
      if (!Array.isArray(part?.groups) || !part.groups.length) { fail(pat, 'groups 至少有一个题组'); continue; }
      for (const [gi, group] of part.groups.entries()) {
        const gat = `${pat}.groups[${gi}]`;
        if (!['list', 'inline'].includes(group?.layout)) fail(gat, 'layout 只能是 list 或 inline');
        if (group?.title !== undefined && typeof group.title !== 'string') fail(gat, 'title 必须是文字');
        if (group?.instructions !== undefined && typeof group.instructions !== 'string') fail(gat, 'instructions 必须是文字');
        if (group?.content !== undefined && typeof group.content !== 'string') fail(gat, 'content 必须是纯文字');
        if (group?.layout === 'inline' && !group.content?.trim()) fail(gat, 'inline 题组须填写 content');
        if (!Array.isArray(group?.questions) || !group.questions.length) { fail(gat, 'questions 至少有一题'); continue; }
        const placeholders = new Set([...String(group.content || '').matchAll(/\{\{([LRW]\d{2})\}\}/g)].map(x => x[1]));
        for (const [qi, question] of group.questions.entries()) {
          const qat = `${gat}.questions[${qi}]`;
          if (!new RegExp(`^${definition.prefix}\\d{2}$`).test(question?.id)) {
            fail(qat, `id 必须为 ${definition.prefix} 加两位数字，例如 ${definition.prefix}01`);
          } else if (ids.has(question.id)) fail(qat, `题号 ${question.id} 重复`);
          else ids.add(question.id);
          if (!QUESTION_TYPES.has(question?.type)) fail(qat, `不支持题型 ${question?.type ?? '(空)'}`);
          if (group.layout === 'list' && typeof question?.prompt !== 'string') fail(qat, 'list 题目必须填写 prompt 文字');
          if (group.layout === 'inline' && !placeholders.has(question?.id)) fail(qat, `content 缺少 {{${question?.id}}} 占位符`);
          if (group.layout === 'inline' && !['text', 'select'].includes(question?.type)) fail(qat, 'inline 题组只支持 text 或 select');
          if (['single_choice', 'multiple_choice', 'select'].includes(question?.type) &&
              (!Array.isArray(question.options) || question.options.length < 2 || question.options.some(x => typeof x !== 'string' || !x.trim()))) {
            fail(qat, '选项题必须填写至少两个非空文字选项');
          }
          if (question?.type === 'multiple_choice' && question.maxChoices !== undefined &&
              (!Number.isInteger(question.maxChoices) || question.maxChoices < 1 || question.maxChoices > (question.options?.length || 0))) {
            fail(qat, 'maxChoices 必须为 1 至选项数量的整数');
          }
          if (question?.type === 'essay' && module.kind !== 'writing') fail(qat, 'essay 仅用于 writing');
          if (module.kind === 'writing' && question?.type !== 'essay') fail(qat, 'writing 只支持 essay');
          if (question?.answer !== undefined && typeof question.answer !== 'string' && !Array.isArray(question.answer)) fail(qat, 'answer 须为文字或文字数组');
          if (question?.answer !== undefined && Array.isArray(question.answer) && question.answer.some(x => typeof x !== 'string')) fail(qat, 'answer 数组只能包含文字');
          if (['single_choice', 'multiple_choice', 'select', 'true_false_not_given', 'yes_no_not_given'].includes(question?.type) && question.answer !== undefined) {
            const choices = question.type === 'true_false_not_given' ? ['TRUE', 'FALSE', 'NOT GIVEN']
              : question.type === 'yes_no_not_given' ? ['YES', 'NO', 'NOT GIVEN'] : question.options || [];
            const answers = Array.isArray(question.answer) ? question.answer : [question.answer];
            if (answers.some(answer => !choices.includes(answer))) fail(qat, 'answer 必须与某个 options 选项完全一致');
            if (question.type === 'multiple_choice' && !Array.isArray(question.answer)) fail(qat, 'multiple_choice 的 answer 必须是数组');
            if (question.type !== 'multiple_choice' && Array.isArray(question.answer) && answers.length > 1) fail(qat, '单选题只填写一个 answer');
          }
        }
        if (group.layout === 'inline') {
          for (const id of placeholders) if (!group.questions.some(q => q.id === id)) fail(gat, `content 引用了不存在的题号 ${id}`);
        }
      }
    }
    if (!ids.size) fail(at, '没有有效题号');
  }
  return errors;
}

export function answerMatches(question, value) {
  if (question.answer === undefined || question.answer === null) return null;
  const normalize = x => String(x ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  if (question.type === 'multiple_choice') {
    if (!Array.isArray(question.answer)) return false;
    const actual = (Array.isArray(value) ? value : []).map(normalize).sort();
    const expected = question.answer.map(normalize).sort();
    return actual.length === expected.length && actual.every((item, i) => item === expected[i]);
  }
  const alternatives = Array.isArray(question.answer) ? question.answer : [question.answer];
  return alternatives.some(answer => normalize(answer) === normalize(value));
}
