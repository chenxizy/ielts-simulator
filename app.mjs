import { MODULES, allQuestions, answerMatches, questionNumber, validateExam } from './schema.mjs';
import { AUDIO_EXTENSIONS, IMAGE_EXTENSIONS, matchingAssetNames } from './media.mjs';

const $ = id => document.getElementById(id);
const dom = {
  home: $('home'), exam: $('exam'), cards: $('module-cards'), feedback: $('import-feedback'),
  content: $('exam-content'), rubric: $('part-rubric'), footer: $('exam-footer'),
  options: $('options'), notes: $('notes-panel'), review: $('review'), result: $('result'),
  gate: $('audio-gate'), timer: $('timer'), audioStatus: $('audio-status'), toast: $('toast'),
};

const state = {
  exam: null, module: null, partIndex: 0, questionId: null, answers: {}, flags: {}, notes: [],
  highlights: [], media: new Map(), mediaUrls: [], sample: false, listeningStarted: false,
  audio: null, timerId: null, deadline: null, contrast: 'normal', size: 'normal',
};

function el(tag, className, textValue) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (textValue !== undefined) node.textContent = textValue;
  return node;
}

function toast(message) {
  dom.toast.textContent = message;
  dom.toast.hidden = false;
  clearTimeout(toast.timeout);
  toast.timeout = setTimeout(() => { dom.toast.hidden = true; }, 3500);
}

function progressKey() { return `ielts-sim-v1:${state.exam.id}:${state.module.kind}`; }

function saveProgress() {
  if (!state.exam || !state.module) return;
  const payload = { answers: state.answers, flags: state.flags, notes: state.notes,
    highlights: state.highlights, deadline: state.deadline };
  try { localStorage.setItem(progressKey(), JSON.stringify(payload)); }
  catch { toast('浏览器未允许本地保存；本次作答仍可继续'); }
}

function loadProgress() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(progressKey()) || '{}'); } catch { saved = {}; }
  state.answers = saved.answers && typeof saved.answers === 'object' ? saved.answers : {};
  state.flags = saved.flags && typeof saved.flags === 'object' ? saved.flags : {};
  state.notes = Array.isArray(saved.notes) ? saved.notes : [];
  state.highlights = Array.isArray(saved.highlights) ? saved.highlights : [];
  state.deadline = Number.isFinite(saved.deadline) ? saved.deadline : null;
}

function basename(file) { return file.name.toLowerCase(); }
function assetCandidates(key, extensions) {
  return matchingAssetNames(state.media.keys(), key, extensions).map(name => state.media.get(name));
}

function imageUrls(key) {
  const found = assetCandidates(key, IMAGE_EXTENSIONS);
  if (found.length || !state.sample) return found;
  return ['R02', 'W01'].includes(key) ? [`./examples/assets/${key}.svg`] : [];
}

function audioUrl(partId) {
  return assetCandidates(partId, AUDIO_EXTENSIONS)[0] || null;
}

function clearMedia() {
  state.audio?.pause();
  state.audio = null;
  for (const url of state.mediaUrls) URL.revokeObjectURL(url);
  state.mediaUrls = [];
  state.media.clear();
}

function attachMedia(files) {
  let added = 0;
  for (const file of files) {
    if (!/\.(png|jpe?g|webp|svg|gif|mp3|m4a|wav|ogg)$/i.test(file.name)) continue;
    const key = basename(file);
    const old = state.media.get(key);
    if (old) URL.revokeObjectURL(old);
    const url = URL.createObjectURL(file);
    state.media.set(key, url);
    state.mediaUrls.push(url);
    added++;
  }
  return added;
}

function inspectMediaNames(files, exam) {
  const knownQuestions = new Set(exam.modules.flatMap(module => allQuestions(module).map(question => question.id)));
  const knownParts = new Set(exam.modules.flatMap(module => module.parts.map(part => part.id)));
  const seen = new Set();
  const duplicates = [];
  const unmatched = [];
  for (const file of files) {
    if (!/\.(png|jpe?g|webp|svg|gif|mp3|m4a|wav|ogg)$/i.test(file.name)) continue;
    const name = basename(file);
    if (seen.has(name)) duplicates.push(file.name);
    seen.add(name);
    const [stem, extension] = [name.slice(0, name.lastIndexOf('.')).toUpperCase(), name.slice(name.lastIndexOf('.'))];
    const isAudio = ['.mp3', '.m4a', '.wav', '.ogg'].includes(extension);
    const target = isAudio ? stem : stem.replace(/-\d+$/, '');
    if (isAudio ? !knownParts.has(target) || !target.startsWith('L-')
      : !knownQuestions.has(target) && !knownParts.has(target)) unmatched.push(file.name);
  }
  return { duplicates, unmatched };
}

function checkMissingAudio() {
  const listening = state.exam.modules.find(module => module.kind === 'listening');
  if (!listening) return [];
  return listening.parts.filter(part => !audioUrl(part.id)).map(part => `${part.id}.mp3`);
}

async function importFiles(fileList) {
  const files = [...fileList];
  const jsonFiles = files.filter(file => file.name.toLowerCase() === 'exam.json');
  if (jsonFiles.length !== 1) {
    dom.feedback.textContent = `需要且只能有一个 exam.json；本次找到 ${jsonFiles.length} 个。`;
    return;
  }
  let exam;
  try { exam = JSON.parse(await jsonFiles[0].text()); }
  catch (error) { dom.feedback.textContent = `exam.json 不是有效 JSON：${error.message}`; return; }
  const errors = validateExam(exam);
  if (errors.length) {
    dom.feedback.textContent = `导入失败，共 ${errors.length} 处格式问题：\n${errors.map(x => `• ${x}`).join('\n')}`;
    return;
  }
  const mediaCheck = inspectMediaNames(files, exam);
  if (mediaCheck.duplicates.length) {
    dom.feedback.textContent = `导入失败：发现同名素材 ${mediaCheck.duplicates.join('、')}。请让每个素材文件名唯一。`;
    return;
  }
  clearMedia();
  state.sample = false;
  state.exam = exam;
  const mediaCount = attachMedia(files);
  showHome();
  const missing = checkMissingAudio();
  dom.feedback.style.color = missing.length || mediaCheck.unmatched.length ? '#a36300' : '#246d23';
  dom.feedback.textContent = `已导入「${exam.title}」及 ${mediaCount} 个素材。${missing.length ? `\n尚未找到音频：${missing.join('、')}。可在 Options 中补充，题目仍可预览。` : ''}${mediaCheck.unmatched.length ? `\n这些素材文件名没有对应的题号或 Part：${mediaCheck.unmatched.join('、')}。` : ''}`;
  renderCards();
}

async function loadExample() {
  dom.feedback.textContent = '正在载入内置示例…';
  try {
    const response = await fetch('./examples/exam.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const exam = await response.json();
    const errors = validateExam(exam);
    if (errors.length) throw new Error(errors.join('；'));
    clearMedia();
    state.sample = true;
    state.exam = exam;
    showHome();
    dom.feedback.style.color = '#246d23';
    dom.feedback.textContent = '已载入内置示例。示例听力不含音频，用于预览界面与导入格式。';
    renderCards();
  } catch (error) { dom.feedback.textContent = `示例载入失败：${error.message}`; }
}

function renderCards() {
  dom.cards.replaceChildren();
  dom.cards.hidden = !state.exam;
  if (!state.exam) return;
  for (const module of state.exam.modules) {
    const card = el('button', 'module-card');
    card.type = 'button';
    card.append(el('span', 'module-name', MODULES[module.kind].label));
    card.append(el('span', 'module-meta', `${module.parts.length} Parts · ${allQuestions(module).length} 题 · ${module.durationMinutes ? `${module.durationMinutes} 分钟` : '不计时'}`));
    card.addEventListener('click', () => openModule(module.kind));
    dom.cards.append(card);
  }
}

function showHome() {
  stopAudio();
  clearInterval(state.timerId);
  state.timerId = null;
  state.module = null;
  dom.exam.hidden = true;
  dom.home.hidden = false;
  dom.options.hidden = true;
  dom.review.hidden = true;
  dom.result.hidden = true;
  dom.notes.hidden = true;
  dom.gate.hidden = true;
  renderCards();
}

function openModule(kind) {
  const module = state.exam?.modules.find(item => item.kind === kind);
  if (!module) return;
  state.module = module;
  state.partIndex = 0;
  state.questionId = module.parts[0].groups[0].questions[0].id;
  state.listeningStarted = false;
  loadProgress();
  if (module.durationMinutes && !state.deadline) {
    state.deadline = Date.now() + module.durationMinutes * 60000;
    saveProgress();
  }
  dom.home.hidden = true;
  dom.exam.hidden = false;
  dom.gate.hidden = kind !== 'listening';
  applyPrefs();
  renderPart();
  startTimer();
}

function startTimer() {
  clearInterval(state.timerId);
  dom.timer.hidden = !state.module?.durationMinutes;
  if (!state.module?.durationMinutes) return;
  const tick = () => {
    const remain = Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000));
    const mins = Math.floor(remain / 60);
    const secs = remain % 60;
    dom.timer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    if (remain === 0) { clearInterval(state.timerId); toast('时间到，请检查答案'); showReview(); }
  };
  tick();
  state.timerId = setInterval(tick, 1000);
}

function stopAudio() {
  if (state.audio) { state.audio.pause(); state.audio.src = ''; state.audio = null; }
  dom.audioStatus.textContent = '';
}

function playPartAudio() {
  stopAudio();
  if (state.module?.kind !== 'listening' || !state.listeningStarted) return;
  const part = state.module.parts[state.partIndex];
  const url = audioUrl(part.id);
  if (!url) {
    dom.audioStatus.textContent = `${part.id} 音频未导入`;
    return;
  }
  const audio = new Audio(url);
  state.audio = audio;
  dom.audioStatus.textContent = '♫ Audio is Playing';
  audio.addEventListener('ended', () => { dom.audioStatus.textContent = '♫ Audio finished'; });
  audio.addEventListener('error', () => { dom.audioStatus.textContent = '音频无法播放'; });
  audio.play().catch(() => { dom.audioStatus.textContent = '点击页面以允许播放音频'; });
}

function partQuestions(part) { return part.groups.flatMap(group => group.questions); }
function currentPart() { return state.module.parts[state.partIndex]; }

function renderRubric(part) {
  dom.rubric.replaceChildren();
  dom.rubric.append(el('strong', '', part.title || `Part ${state.partIndex + 1}`));
  dom.rubric.append(el('span', '', part.instructions || 'Read the text and answer the questions.'));
}

function renderParagraphs(target, part) {
  if (part.passageTitle) target.append(el('h2', 'passage-title', part.passageTitle));
  const body = el('div', 'passage');
  const paragraphs = String(part.passage || '').split(/\n\s*\n/);
  paragraphs.forEach((paragraph, index) => {
    const p = el('p');
    p.dataset.paragraphIndex = String(index);
    const ranges = state.highlights.filter(h => h.partId === part.id && h.index === index)
      .sort((a, b) => a.start - b.start);
    let pos = 0;
    for (const range of ranges) {
      const start = Math.max(pos, Math.min(paragraph.length, range.start));
      const end = Math.max(start, Math.min(paragraph.length, range.end));
      p.append(document.createTextNode(paragraph.slice(pos, start)));
      p.append(el('mark', 'highlighted', paragraph.slice(start, end)));
      pos = end;
    }
    p.append(document.createTextNode(paragraph.slice(pos)));
    body.append(p);
  });
  target.append(body);
}

function appendImages(target, key, className = 'question-image') {
  for (const url of imageUrls(key)) {
    const image = el('img', className);
    image.src = url;
    image.alt = `${key} 配图`;
    image.loading = 'lazy';
    target.append(image);
  }
}

function renderPart() {
  const part = currentPart();
  const questions = partQuestions(part);
  if (!questions.some(q => q.id === state.questionId)) state.questionId = questions[0]?.id || null;
  renderRubric(part);
  dom.content.replaceChildren();
  const split = state.module.kind !== 'listening';
  if (split) {
    const layout = el('div', 'split-layout');
    const left = el('div', 'pane left');
    const right = el('div', `pane right${state.module.kind === 'writing' ? ' writing-pane' : ''}`);
    if (state.module.kind === 'reading') {
      const highlightButton = el('button', 'flag-button', '高亮选中的文章文字');
      highlightButton.type = 'button';
      highlightButton.addEventListener('mousedown', event => event.preventDefault());
      highlightButton.addEventListener('click', () => highlightSelection(left, part));
      left.append(highlightButton);
      renderParagraphs(left, part);
      appendImages(left, part.id, 'passage-image');
    } else {
      renderParagraphs(left, part);
      appendImages(left, part.id, 'passage-image');
      for (const question of questions) appendImages(left, question.id, 'passage-image');
    }
    renderGroups(right, part);
    const divider = el('div', 'splitter');
    divider.setAttribute('role', 'separator');
    divider.setAttribute('aria-label', '调整左右栏宽度');
    divider.append(el('div', 'splitter-handle', '↔'));
    divider.addEventListener('pointerdown', event => startResize(event, layout));
    layout.append(left, divider, right);
    dom.content.append(layout);
  } else {
    const single = el('div', 'single-layout');
    appendImages(single, part.id, 'passage-image');
    renderGroups(single, part);
    if (!audioUrl(part.id)) single.append(el('p', 'audio-hint', `预览模式：未找到 ${part.id}.mp3 音频。`));
    dom.content.append(single);
  }
  renderFooter();
  if (state.module.kind === 'listening' && state.listeningStarted) playPartAudio();
}

function startResize(event, layout) {
  event.preventDefault();
  const horizontal = window.matchMedia('(max-width:850px)').matches;
  const box = layout.getBoundingClientRect();
  const move = next => {
    const percent = horizontal ? ((next.clientY - box.top) / box.height * 100)
      : ((next.clientX - box.left) / box.width * 100);
    const clamped = Math.min(72, Math.max(28, percent));
    if (horizontal) layout.style.gridTemplateRows = `minmax(160px,${clamped}%) 8px minmax(0,1fr)`;
    else layout.style.setProperty('--split', `${clamped}%`);
  };
  const done = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', done); };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', done, { once: true });
}

function highlightSelection(pane, part) {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) { toast('先在左侧文章中选中一段文字'); return; }
  const range = selection.getRangeAt(0);
  const startParagraph = range.startContainer.parentElement?.closest('p[data-paragraph-index]');
  const endParagraph = range.endContainer.parentElement?.closest('p[data-paragraph-index]');
  if (!startParagraph || startParagraph !== endParagraph || !pane.contains(startParagraph)) {
    toast('一次只能高亮同一段落中的文字'); return;
  }
  const index = Number(startParagraph.dataset.paragraphIndex);
  const startRange = document.createRange();
  startRange.selectNodeContents(startParagraph);
  startRange.setEnd(range.startContainer, range.startOffset);
  const endRange = document.createRange();
  endRange.selectNodeContents(startParagraph);
  endRange.setEnd(range.endContainer, range.endOffset);
  state.highlights.push({ partId: part.id, index, start: startRange.toString().length, end: endRange.toString().length });
  saveProgress();
  const scrollTop = pane.scrollTop;
  renderPart();
  dom.content.querySelector('.pane.left').scrollTop = scrollTop;
  toast('已高亮选中文字');
}

function renderGroups(target, part) {
  for (const group of part.groups) {
    const section = el('section', 'question-group');
    if (group.title) section.append(el('h3', 'group-title', group.title));
    if (group.instructions) section.append(el('p', 'group-instructions', group.instructions));
    if (group.layout === 'inline') {
      for (const question of group.questions) appendImages(section, question.id);
      renderInline(section, group);
    } else {
      for (const question of group.questions) renderQuestion(section, question);
    }
    target.append(section);
  }
}

function renderInline(target, group) {
  const body = el('div', 'inline-body');
  const parts = group.content.split(/(\{\{[LRW]\d{2}\}\})/g);
  for (const part of parts) {
    const match = /^\{\{([LRW]\d{2})\}\}$/.exec(part);
    if (!match) { body.append(document.createTextNode(part)); continue; }
    const question = group.questions.find(q => q.id === match[1]);
    if (!question) continue;
    const wrap = el('span', 'inline-answer');
    wrap.id = `q-${question.id}`;
    wrap.append(el('span', 'inline-label', `${questionNumber(question.id)} `));
    wrap.append(createControl(question));
    body.append(wrap);
  }
  target.append(body);
  for (const question of group.questions) target.append(createFlagButton(question));
}

function renderQuestion(target, question) {
  const item = el('div', `question${state.questionId === question.id ? ' is-active' : ''}`);
  item.id = `q-${question.id}`;
  const prompt = el('div', 'prompt');
  prompt.append(el('span', 'q-number', String(questionNumber(question.id))));
  prompt.append(el('span', '', question.prompt || ''));
  item.append(prompt);
  if (state.module.kind !== 'writing') appendImages(item, question.id);
  item.append(createControl(question));
  if (question.type !== 'essay') item.append(createFlagButton(question));
  target.append(item);
}

function questionOptions(question) {
  if (question.type === 'true_false_not_given') return ['TRUE', 'FALSE', 'NOT GIVEN'];
  if (question.type === 'yes_no_not_given') return ['YES', 'NO', 'NOT GIVEN'];
  return question.options || [];
}

function createControl(question) {
  const stored = state.answers[question.id];
  if (question.type === 'text') {
    const input = el('input', 'text-answer');
    input.type = 'text';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', `${question.id} 答案`);
    input.placeholder = String(questionNumber(question.id));
    input.value = typeof stored === 'string' ? stored : '';
    input.addEventListener('input', () => setAnswer(question.id, input.value));
    return input;
  }
  if (question.type === 'essay') {
    const holder = el('div', 'essay-holder');
    const input = el('textarea', 'essay-input');
    input.setAttribute('aria-label', `${question.id} 写作答案`);
    input.value = typeof stored === 'string' ? stored : '';
    const counter = el('div', 'word-count', `Words: ${wordCount(input.value)}`);
    input.addEventListener('input', () => {
      setAnswer(question.id, input.value);
      counter.textContent = `Words: ${wordCount(input.value)}`;
    });
    holder.append(input, counter);
    return holder;
  }
  if (question.type === 'select') {
    const select = el('select', 'select-answer');
    select.setAttribute('aria-label', `${question.id} 答案`);
    const empty = el('option', '', '请选择');
    empty.value = '';
    select.append(empty);
    for (const option of questionOptions(question)) {
      const child = el('option', '', option);
      child.value = option;
      select.append(child);
    }
    select.value = typeof stored === 'string' ? stored : '';
    select.addEventListener('change', () => setAnswer(question.id, select.value));
    return select;
  }
  const holder = el('div', 'question-options');
  const multiple = question.type === 'multiple_choice';
  for (const option of questionOptions(question)) {
    const label = el('label', 'choice');
    const input = el('input');
    input.type = multiple ? 'checkbox' : 'radio';
    input.name = question.id;
    input.value = option;
    input.checked = multiple ? Array.isArray(stored) && stored.includes(option) : stored === option;
    input.addEventListener('change', () => {
      if (multiple) {
        const selected = [...holder.querySelectorAll('input:checked')].map(item => item.value);
        if (question.maxChoices && selected.length > question.maxChoices) {
          input.checked = false;
          toast(`本题最多选 ${question.maxChoices} 项`);
          return;
        }
        setAnswer(question.id, selected);
      } else setAnswer(question.id, option);
    });
    label.append(input, el('span', '', option));
    holder.append(label);
  }
  return holder;
}

function createFlagButton(question) {
  const button = el('button', `flag-button${state.flags[question.id] ? ' flagged' : ''}`,
    state.flags[question.id] ? '◆ 已标记复查' : '◇ 标记复查');
  button.type = 'button';
  button.addEventListener('click', () => {
    state.flags[question.id] = !state.flags[question.id];
    button.classList.toggle('flagged', state.flags[question.id]);
    button.textContent = state.flags[question.id] ? '◆ 已标记复查' : '◇ 标记复查';
    saveProgress();
    renderFooter();
  });
  return button;
}

function wordCount(value) { return (value.trim().match(/\S+/g) || []).length; }
function attempted(question) {
  const value = state.answers[question.id];
  return Array.isArray(value) ? value.length > 0 : typeof value === 'string' && value.trim().length > 0;
}

function setAnswer(id, value) {
  state.answers[id] = value;
  saveProgress();
  renderFooter();
}

function renderFooter() {
  dom.footer.replaceChildren();
  const parts = el('div', 'part-tabs');
  state.module.parts.forEach((part, index) => {
    const tab = el('div', `part-tab${index === state.partIndex ? ' active' : ''}`);
    const title = el('button', 'number-button', part.title || `Part ${index + 1}`);
    title.style.fontWeight = '700';
    title.addEventListener('click', () => switchPart(index));
    tab.append(title);
    const questions = partQuestions(part);
    if (index === state.partIndex) {
      const numbers = el('div', 'numbers');
      for (const question of questions) {
        const button = el('button', `number-button${question.id === state.questionId ? ' active' : ''}${attempted(question) ? ' answered' : ''}${state.flags[question.id] ? ' flagged' : ''}`, String(questionNumber(question.id)));
        button.title = `${question.id} · ${attempted(question) ? '已作答' : '未作答'}${state.flags[question.id] ? ' · 已标记' : ''}`;
        button.addEventListener('click', () => navigate(question.id));
        numbers.append(button);
      }
      tab.append(numbers);
    } else tab.append(el('span', 'module-meta', `${questions.filter(attempted).length} of ${questions.length}`));
    parts.append(tab);
  });
  const arrows = el('div', 'nav-arrows');
  const previous = el('button', 'arrow-button', '←');
  const next = el('button', 'arrow-button', '➜');
  const all = allQuestions(state.module);
  const index = all.findIndex(q => q.id === state.questionId);
  previous.disabled = index <= 0;
  next.disabled = index >= all.length - 1;
  previous.title = '上一题';
  next.title = '下一题';
  previous.addEventListener('click', () => navigate(all[index - 1]?.id));
  next.addEventListener('click', () => navigate(all[index + 1]?.id));
  arrows.append(previous, next);
  const review = el('button', 'review-button', '✓');
  review.title = '检查答案';
  review.addEventListener('click', showReview);
  dom.footer.append(parts, arrows, review);
}

function switchPart(index) {
  if (index === state.partIndex) return;
  state.partIndex = index;
  state.questionId = partQuestions(currentPart())[0]?.id || null;
  renderPart();
}

function navigate(id) {
  if (!id) return;
  const partIndex = state.module.parts.findIndex(part => partQuestions(part).some(q => q.id === id));
  if (partIndex < 0) return;
  if (partIndex !== state.partIndex) {
    state.partIndex = partIndex;
    state.questionId = id;
    renderPart();
  } else {
    state.questionId = id;
    dom.content.querySelectorAll('.question').forEach(node => node.classList.toggle('is-active', node.id === `q-${id}`));
    renderFooter();
  }
  document.getElementById(`q-${id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function showReview() {
  if (!state.module) return;
  dom.options.hidden = true;
  dom.review.hidden = false;
  const questions = allQuestions(state.module);
  const done = questions.filter(attempted).length;
  const flagged = questions.filter(q => state.flags[q.id]).length;
  $('review-summary').textContent = `${done} / ${questions.length} 题已作答 · ${flagged} 题标记复查`;
  const list = $('review-list');
  list.replaceChildren();
  for (const question of questions) {
    const button = el('button', `review-q${attempted(question) ? ' answered' : ''}${state.flags[question.id] ? ' flagged' : ''}`);
    button.append(el('strong', '', question.id), el('small', '', attempted(question) ? '已作答' : '未作答'));
    button.addEventListener('click', () => { dom.review.hidden = true; navigate(question.id); });
    list.append(button);
  }
}

function showResult() {
  dom.review.hidden = true;
  dom.result.hidden = false;
  stopAudio();
  const questions = allQuestions(state.module);
  const scored = questions.map(q => ({ q, correct: answerMatches(q, state.answers[q.id]) })).filter(x => x.correct !== null);
  const correct = scored.filter(x => x.correct).length;
  const body = $('result-body');
  body.replaceChildren();
  body.append(el('p', '', `${questions.filter(attempted).length} / ${questions.length} 题已作答。`));
  if (scored.length) body.append(el('p', '', `有答案的客观题：${correct} / ${scored.length} 正确。`));
  else body.append(el('p', '', '这份试卷未提供客观题答案，因此不显示分数。'));
  if (state.module.kind === 'writing') body.append(el('p', 'muted', '写作答案已自动保存；写作不自动评分。'));
  body.append(el('p', 'muted', '此处仅用于自测，不代表官方雅思成绩。'));
}

function applyPrefs() {
  document.body.dataset.contrast = state.contrast;
  dom.exam.dataset.size = state.size;
  document.querySelectorAll('[data-contrast]').forEach(button => button.classList.toggle('selected', button.dataset.contrast === state.contrast));
  document.querySelectorAll('[data-size]').forEach(button => button.classList.toggle('selected', button.dataset.size === state.size));
}

function renderNotes() {
  const list = $('note-list');
  list.replaceChildren();
  for (const note of [...state.notes].reverse()) {
    const item = el('div', 'note-item', note.text);
    item.append(el('small', '', note.partId));
    list.append(item);
  }
}

// File import
$('choose-folder').addEventListener('click', () => $('folder-input').click());
$('choose-files').addEventListener('click', () => $('files-input').click());
$('folder-input').addEventListener('change', event => importFiles(event.target.files));
$('files-input').addEventListener('change', event => importFiles(event.target.files));
$('load-example').addEventListener('click', loadExample);
$('add-media').addEventListener('click', () => $('media-input').click());
$('media-input').addEventListener('change', event => {
  const count = attachMedia([...event.target.files]);
  if (count) { renderPart(); toast(`已补充 ${count} 个素材`); }
  else toast('没有找到支持的图片或音频文件');
  dom.options.hidden = true;
});

// Listening gate and toolbar
$('audio-play').addEventListener('click', () => {
  dom.gate.hidden = true;
  state.listeningStarted = true;
  playPartAudio();
});
$('audio-back').addEventListener('click', showHome);
$('options-button').addEventListener('click', () => { dom.options.hidden = false; applyPrefs(); });
$('options-close').addEventListener('click', () => { dom.options.hidden = true; });
$('messages-button').addEventListener('click', () => toast('练习已连接，本地答案自动保存'));
$('notes-button').addEventListener('click', () => { dom.notes.hidden = !dom.notes.hidden; renderNotes(); });
$('notes-close').addEventListener('click', () => { dom.notes.hidden = true; });
$('save-note').addEventListener('click', () => {
  const input = $('note-draft');
  if (!input.value.trim()) return;
  state.notes.push({ partId: currentPart().id, text: input.value.trim() });
  input.value = '';
  saveProgress();
  renderNotes();
});
$('review-from-options').addEventListener('click', showReview);
$('exit-test').addEventListener('click', showHome);
document.querySelectorAll('[data-contrast]').forEach(button => button.addEventListener('click', () => {
  state.contrast = button.dataset.contrast; applyPrefs();
}));
document.querySelectorAll('[data-size]').forEach(button => button.addEventListener('click', () => {
  state.size = button.dataset.size; applyPrefs();
}));
$('review-close').addEventListener('click', () => { dom.review.hidden = true; });
$('review-return').addEventListener('click', () => { dom.review.hidden = true; });
$('review-score').addEventListener('click', showResult);
$('result-close').addEventListener('click', () => { dom.result.hidden = true; });
$('result-home').addEventListener('click', showHome);
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  for (const panel of [dom.result, dom.review, dom.options, dom.notes]) if (!panel.hidden) { panel.hidden = true; break; }
});

applyPrefs();
