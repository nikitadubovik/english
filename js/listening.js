// ============================================================
// Cambridge C1 Advanced — Listening exam player
// Loads content and key JSON from /content/<book>/test<N>/lis(.key).json
// No audio: the candidate plays the recording themselves.
// ============================================================

(function () {
  'use strict';

  // --------------------------------------------------------
  // Part structure metadata (question ranges + rubrics)
  // --------------------------------------------------------
  const PARTS = {
    1: { type: 'mc-extracts', count: 6, range: [1, 6], title: 'Questions 1–6',
         instr: 'You will hear three different extracts. For each question, choose the correct answer. There are two questions for each extract.' },
    2: { type: 'sentence-completion', count: 8, range: [7, 14], title: 'Questions 7–14',
         instr: 'For each question, write the correct answer in the gap. Write a word or short phrase.' },
    3: { type: 'mc', count: 6, range: [15, 20], title: 'Questions 15–20',
         instr: 'For each question, choose the correct answer.' },
    4: { type: 'multi-match', count: 10, range: [21, 30], title: 'Questions 21–30',
         instr: 'You will hear five short extracts. For each question, choose the correct answer. Complete <b>both</b> tasks.' },
  };

  // Every question in the Listening paper is worth 1 mark.
  const MAX_SCORES = { 1: 6, 2: 8, 3: 6, 4: 10 };
  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  const FLAG_SVG =
    '<svg viewBox="0 0 18 22" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M2 1 L16 1 L16 21 L9 16 L2 21 Z"/></svg>';

  // --------------------------------------------------------
  // Runtime state
  // --------------------------------------------------------
  let CONTENT = null;
  let KEY = null;
  const answers = {};
  const flagged = new Set();
  const overrides = {};   // manual marks for text answers (Part 2)
  let currentPart = 1;
  let currentQ = null;

  const footer = document.getElementById('footer');

  // --------------------------------------------------------
  // Data loading
  // --------------------------------------------------------
  async function loadExamData(book, test) {
    const base = `content/${book}/test${test}`;
    const [contentRes, keyRes] = await Promise.all([
      fetch(`${base}/lis.json`),
      fetch(`${base}/lis_key.json`),
    ]);
    if (!contentRes.ok || !keyRes.ok) throw new Error('Not found');
    CONTENT = await contentRes.json();
    KEY = await keyRes.json();
  }

  function showComingSoon(book, test) {
    document.querySelector('.instructions').style.display = 'none';
    document.querySelector('.content-wrap').innerHTML =
      `<div class="coming-soon">
         <h2>Coming soon</h2>
         <p>The Listening paper for <b>${book || 'this book'}</b>, Test ${test || '?'} is not available yet.</p>
         <p><a href="index.html" style="color: var(--teal);">← Back to library</a></p>
       </div>`;
    document.querySelector('.nav-arrows').style.display = 'none';
    document.querySelector('.footer').style.display = 'none';
  }

  function stubMarkup(p) {
    return `<div class="lis-stub">
              <h3>Part ${p}</h3>
              <p>This part is not wired up yet. Add its content to
                 <code>lis.json</code> under <code>parts.${p}</code>.</p>
            </div>`;
  }

  // --------------------------------------------------------
  // Shared bits
  // --------------------------------------------------------
  function makeFlagButton(q) {
    const flag = document.createElement('button');
    flag.className = 'lis-flag';
    flag.title = 'Flag for review';
    flag.innerHTML = FLAG_SVG;
    flag.addEventListener('click', (e) => {
      e.stopPropagation();
      if (flagged.has(q)) { flagged.delete(q); flag.classList.remove('active'); }
      else { flagged.add(q); flag.classList.add('active'); }
      const holder = flag.closest('.lis-question');
      if (holder) holder.classList.toggle('is-flagged', flagged.has(q));
      refreshFooter();
    });
    return flag;
  }

  // The rubric can be overridden per test, since Parts 2–4 name the speaker.
  function instrFor(p) {
    const data = CONTENT && CONTENT.parts && CONTENT.parts[String(p)];
    return (data && data.instr) || PARTS[p].instr;
  }

  // Stems and options occasionally carry a title in italics, written as *Carp Magazine*.
  function escapeHtml(s) {
    return (s || '').replace(/[&<>"]/g, ch => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]
    ));
  }
  function formatInline(s) {
    return escapeHtml(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');
  }
  function plainText(s) {
    return (s || '').replace(/\*([^*]+)\*/g, '$1');
  }

  // --------------------------------------------------------
  // Generic multiple-choice question block
  // --------------------------------------------------------
  function buildMCQuestion(q, stem, options) {
    const qDiv = document.createElement('div');
    qDiv.className = 'lis-question';
    qDiv.dataset.q = q;

    const head = document.createElement('div');
    head.className = 'lis-qhead';
    const num = document.createElement('span');
    num.className = 'lis-qnum';
    num.textContent = q;
    head.appendChild(num);
    const stemSpan = document.createElement('span');
    stemSpan.innerHTML = formatInline(stem);
    head.appendChild(stemSpan);
    qDiv.appendChild(head);

    const optsDiv = document.createElement('div');
    optsDiv.className = 'lis-options';
    options.forEach((label, idx) => {
      const opt = document.createElement('div');
      opt.className = 'lis-option';
      opt.dataset.idx = idx;
      const radio = document.createElement('span');
      radio.className = 'lis-radio';
      opt.appendChild(radio);
      const txt = document.createElement('span');
      txt.innerHTML = formatInline(label);
      opt.appendChild(txt);
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        answers[q] = idx;
        optsDiv.querySelectorAll('.lis-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        setCurrent(q);
        refreshFooter();
      });
      optsDiv.appendChild(opt);
    });
    qDiv.appendChild(optsDiv);

    qDiv.appendChild(makeFlagButton(q));

    qDiv.addEventListener('click', () => setCurrent(q));
    return qDiv;
  }

  // --------------------------------------------------------
  // PART 1 — three extracts, two questions each, one extract per screen
  // --------------------------------------------------------
  function renderPart1() {
    const container = document.getElementById('p1Container');
    container.innerHTML = '';
    const data = CONTENT.parts && CONTENT.parts['1'];
    if (!data || !Array.isArray(data.extracts) || !data.extracts.length) {
      container.innerHTML = stubMarkup(1);
      return;
    }

    data.extracts.forEach((ex, i) => {
      const block = document.createElement('div');
      block.className = 'lis-block';
      block.dataset.block = i;

      const intro = document.createElement('p');
      intro.className = 'lis-intro';
      intro.textContent = ex.intro || '';
      block.appendChild(intro);

      Object.keys(ex.questions)
        .map(Number)
        .sort((a, b) => a - b)
        .forEach(q => {
          const item = ex.questions[q];
          block.appendChild(buildMCQuestion(q, item.stem, item.options));
        });

      container.appendChild(block);
    });
  }

  // Which extract holds a given question number
  function blockIndexOf(q) {
    const extracts = (CONTENT.parts['1'] || {}).extracts || [];
    for (let i = 0; i < extracts.length; i++) {
      if (Object.keys(extracts[i].questions).map(Number).includes(q)) return i;
    }
    return 0;
  }

  // --------------------------------------------------------
  // PART 2 — sentence completion, gaps marked as [[N]] in each line
  // --------------------------------------------------------
  function renderPart2() {
    const container = document.getElementById('p2Container');
    container.innerHTML = '';
    const data = CONTENT.parts && CONTENT.parts['2'];
    if (!data || !Array.isArray(data.lines) || !data.lines.length) {
      container.innerHTML = stubMarkup(2);
      return;
    }

    if (data.title) {
      const h = document.createElement('h2');
      h.className = 'lis-title';
      h.textContent = data.title;
      container.appendChild(h);
    }

    data.lines.forEach(line => {
      const p = document.createElement('p');
      p.className = 'lis-question lis-sentence';

      let firstQ = null;
      // Split on [[N]] tokens, keeping the numbers.
      line.split(/(\[\[\d+\]\])/).forEach(chunk => {
        const m = chunk.match(/^\[\[(\d+)\]\]$/);
        if (!m) {
          if (chunk) p.appendChild(document.createTextNode(chunk));
          return;
        }
        const q = parseInt(m[1], 10);
        if (firstQ === null) firstQ = q;

        const wrap = document.createElement('span');
        wrap.className = 'lis-gap-wrap';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'lis-input';
        input.dataset.q = q;
        input.autocomplete = 'off';
        input.spellcheck = false;

        const num = document.createElement('span');
        num.className = 'lis-gap-num';
        num.textContent = q;

        input.addEventListener('focus', () => setCurrent(q));
        input.addEventListener('click', (e) => e.stopPropagation());
        input.addEventListener('input', () => {
          answers[q] = input.value;
          wrap.classList.toggle('filled', input.value.trim() !== '');
          refreshFooter();
        });

        wrap.appendChild(input);
        wrap.appendChild(num);
        p.appendChild(wrap);
      });

      if (firstQ !== null) {
        p.dataset.q = firstQ;
        p.appendChild(makeFlagButton(firstQ));
        p.addEventListener('click', () => setCurrent(firstQ));
      }
      container.appendChild(p);
    });
  }

  // --------------------------------------------------------
  // PART 3 — six multiple-choice questions on one scrolling page
  // --------------------------------------------------------
  function renderPart3() {
    const container = document.getElementById('p3Container');
    container.innerHTML = '';
    const data = CONTENT.parts && CONTENT.parts['3'];
    if (!data || !data.questions || !Object.keys(data.questions).length) {
      container.innerHTML = stubMarkup(3);
      return;
    }
    Object.keys(data.questions)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach(q => {
        const item = data.questions[q];
        container.appendChild(buildMCQuestion(q, item.stem, item.options));
      });
  }

  // --------------------------------------------------------
  // PART 4 — two matching tasks, five speakers and eight options each
  // --------------------------------------------------------
  function taskOf(q) {
    const tasks = ((CONTENT.parts || {})['4'] || {}).tasks || [];
    for (const t of tasks) if (t.questions && t.questions[q] !== undefined) return t;
    return null;
  }

  function paintSlot(slot) {
    const q = parseInt(slot.dataset.q, 10);
    const letter = answers[q];
    slot.innerHTML = '';

    const txt = document.createElement('span');
    if (letter) {
      const task = taskOf(q);
      txt.innerHTML = formatInline((task && task.options[letter]) || letter);
      slot.classList.add('filled');
    } else {
      txt.textContent = q;
      slot.classList.remove('filled');
    }
    slot.appendChild(txt);

    const rm = document.createElement('button');
    rm.className = 'lis-slot-remove';
    rm.textContent = '✕';
    rm.title = 'Clear';
    rm.addEventListener('click', (e) => {
      e.stopPropagation();
      delete answers[q];
      paintSlot(slot);
      updateUsedOptions(slot.dataset.task);
      setCurrent(q);
      refreshFooter();
    });
    slot.appendChild(rm);
  }

  function assign(q, letter, taskIdx) {
    // Within a task each option can only be used once, so free it elsewhere first.
    const task = ((CONTENT.parts['4'] || {}).tasks || [])[taskIdx];
    if (task) {
      Object.keys(task.questions).map(Number).forEach(other => {
        if (other !== q && answers[other] === letter) delete answers[other];
      });
    }
    answers[q] = letter;
    document.querySelectorAll(`#p4Container .lis-slot[data-task="${taskIdx}"]`).forEach(paintSlot);
    updateUsedOptions(taskIdx);
    setCurrent(q);
    refreshFooter();
  }

  function updateUsedOptions(taskIdx) {
    const task = ((CONTENT.parts['4'] || {}).tasks || [])[taskIdx];
    if (!task) return;
    const used = new Set(Object.keys(task.questions).map(Number).map(q => answers[q]).filter(Boolean));
    document.querySelectorAll(`#p4Container .lis-opt-box[data-task="${taskIdx}"]`).forEach(box => {
      box.classList.toggle('used', used.has(box.dataset.letter));
    });
  }

  function renderPart4() {
    const container = document.getElementById('p4Container');
    container.innerHTML = '';
    const data = CONTENT.parts && CONTENT.parts['4'];
    if (!data || !Array.isArray(data.tasks) || !data.tasks.length) {
      container.innerHTML = stubMarkup(4);
      return;
    }

    data.tasks.forEach((task, ti) => {
      const wrap = document.createElement('div');
      wrap.className = 'lis-task';

      const head = document.createElement('p');
      head.className = 'lis-task-head';
      head.innerHTML = '<b>' + escapeHtml(task.label || ('Task ' + (ti + 1))) + '</b>: ' +
                       formatInline(task.instr || '');
      wrap.appendChild(head);

      const body = document.createElement('div');
      body.className = 'lis-task-body';

      const left = document.createElement('div');
      left.className = 'lis-speakers';

      Object.keys(task.questions).map(Number).sort((a, b) => a - b).forEach(q => {
        const row = document.createElement('div');
        row.className = 'lis-question lis-speaker-row';
        row.dataset.q = q;

        const label = document.createElement('span');
        label.className = 'lis-speaker-label';
        label.textContent = task.questions[q];
        row.appendChild(label);

        const slot = document.createElement('div');
        slot.className = 'lis-slot';
        slot.dataset.q = q;
        slot.dataset.task = ti;
        slot.addEventListener('click', (e) => { e.stopPropagation(); setCurrent(q); });
        slot.addEventListener('dragover', (e) => {
          e.preventDefault();
          slot.classList.add('drag-over');
        });
        slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
        slot.addEventListener('drop', (e) => {
          e.preventDefault();
          slot.classList.remove('drag-over');
          const payload = e.dataTransfer.getData('text/plain');
          const [letter, from] = payload.split(':');
          if (parseInt(from, 10) !== ti) return;   // options belong to one task only
          assign(q, letter, ti);
        });
        paintSlot(slot);
        row.appendChild(slot);

        row.appendChild(makeFlagButton(q));
        left.appendChild(row);
      });

      const right = document.createElement('div');
      right.className = 'lis-optlist';

      Object.keys(task.options).sort().forEach(letter => {
        const box = document.createElement('div');
        box.className = 'lis-opt-box';
        box.draggable = true;
        box.dataset.letter = letter;
        box.dataset.task = ti;
        box.innerHTML = formatInline(task.options[letter]);
        box.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', letter + ':' + ti);
          box.classList.add('dragging');
        });
        box.addEventListener('dragend', () => box.classList.remove('dragging'));
        box.addEventListener('click', (e) => {
          e.stopPropagation();
          // Click assigns to the current speaker if it belongs to this task,
          // otherwise to the first speaker still empty.
          const qs = Object.keys(task.questions).map(Number).sort((a, b) => a - b);
          let target = qs.includes(currentQ) ? currentQ : qs.find(q => !answers[q]);
          if (target === undefined) target = qs[qs.length - 1];
          assign(target, letter, ti);
        });
        right.appendChild(box);
      });

      body.appendChild(left);
      body.appendChild(right);
      wrap.appendChild(body);
      container.appendChild(wrap);

      updateUsedOptions(ti);
    });
  }

  // --------------------------------------------------------
  // Shared state refresh for question blocks
  // --------------------------------------------------------
  function updateQuestionState(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.lis-question').forEach(qDiv => {
      const q = parseInt(qDiv.dataset.q, 10);
      qDiv.classList.toggle('current', q === currentQ);
      qDiv.classList.toggle('is-flagged', flagged.has(q));
      const flag = qDiv.querySelector('.lis-flag');
      if (flag) flag.classList.toggle('active', flagged.has(q));
      const ans = answers[q];
      qDiv.querySelectorAll('.lis-option').forEach(opt => {
        opt.classList.toggle('selected', parseInt(opt.dataset.idx, 10) === ans);
      });
    });
  }

  function setCurrent(q) {
    currentQ = q;

    if (currentPart === 1) {
      const idx = blockIndexOf(q);
      document.querySelectorAll('#p1Container .lis-block').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.block, 10) === idx);
      });
      updateQuestionState('p1Container');
    } else {
      updateQuestionState('p' + currentPart + 'Container');
    }

    refreshFooter();

    const el = document.querySelector(`.part-view.active .lis-question[data-q="${q}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    const input = document.querySelector(`.part-view.active .lis-input[data-q="${q}"]`);
    if (input && document.activeElement !== input) input.focus();
  }

  // --------------------------------------------------------
  // Footer / part switching
  // --------------------------------------------------------
  function buildFooter() {
    footer.innerHTML = '';
    for (let p = 1; p <= 4; p++) {
      const cfg = PARTS[p];
      const el = document.createElement('div');
      el.className = 'part';
      el.dataset.part = p;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        switchPart(p);
      });

      const partFlag = document.createElement('div');
      partFlag.className = 'part-flag';
      el.appendChild(partFlag);

      const label = document.createElement('span');
      label.className = 'label';
      const check = document.createElement('span');
      check.className = 'check';
      check.textContent = '✓';
      label.appendChild(check);
      label.appendChild(document.createTextNode('Part ' + p));
      el.appendChild(label);

      if (p === currentPart) {
        const qnums = document.createElement('span');
        qnums.className = 'qnums';
        for (let i = cfg.range[0]; i <= cfg.range[1]; i++) {
          const s = document.createElement('span');
          s.textContent = i;
          s.dataset.q = i;
          s.addEventListener('click', (ev) => {
            ev.stopPropagation();
            setCurrent(i);
          });
          qnums.appendChild(s);
        }
        el.appendChild(qnums);
      } else {
        const prog = document.createElement('span');
        prog.className = 'progress';
        prog.textContent = countAnswered(p) + ' of ' + cfg.count;
        el.appendChild(prog);
      }

      footer.appendChild(el);
    }

    const finish = document.createElement('div');
    finish.className = 'finish';
    finish.textContent = '✓';
    finish.title = 'Finish';
    finish.onclick = function (e) {
      e.stopPropagation();
      handleFinish();
    };
    footer.appendChild(finish);
    refreshFooter();
  }

  function countAnswered(p) {
    const [lo, hi] = PARTS[p].range;
    let n = 0;
    for (let i = lo; i <= hi; i++) if (answers[i] !== undefined && answers[i] !== '') n++;
    return n;
  }
  function hasFlaggedIn(p) {
    const [lo, hi] = PARTS[p].range;
    for (let i = lo; i <= hi; i++) if (flagged.has(i)) return true;
    return false;
  }

  function refreshFooter() {
    document.querySelectorAll('.footer .part').forEach(partEl => {
      const p = parseInt(partEl.dataset.part, 10);
      partEl.classList.toggle('active', p === currentPart);
      partEl.classList.toggle('completed', countAnswered(p) === PARTS[p].count);
      partEl.classList.toggle('has-flag', hasFlaggedIn(p));
      const prog = partEl.querySelector('.progress');
      if (prog) prog.textContent = countAnswered(p) + ' of ' + PARTS[p].count;
      partEl.querySelectorAll('.qnums span').forEach(el => {
        const q = parseInt(el.dataset.q, 10);
        el.classList.toggle('current', q === currentQ);
        el.classList.toggle('answered', answers[q] !== undefined && answers[q] !== '');
        el.classList.toggle('flagged', flagged.has(q));
      });
    });
  }

  function switchPart(p) {
    currentPart = p;
    currentQ = null;
    document.querySelectorAll('.part-view').forEach(v => {
      v.classList.toggle('active', v.dataset.view == p);
    });
    document.getElementById('instr-title').textContent = PARTS[p].title;
    document.getElementById('instr-text').innerHTML = instrFor(p);
    buildFooter();
    setCurrent(PARTS[p].range[0]);
  }

  // --------------------------------------------------------
  // Navigation
  // --------------------------------------------------------
  function goNext() {
    const [lo, hi] = PARTS[currentPart].range;
    if (currentQ === null) { setCurrent(lo); return; }
    if (currentQ < hi) { setCurrent(currentQ + 1); return; }
    if (currentPart < 4) switchPart(currentPart + 1);
  }
  function goPrev() {
    const [lo] = PARTS[currentPart].range;
    if (currentQ === null) { setCurrent(lo); return; }
    if (currentQ > lo) { setCurrent(currentQ - 1); return; }
    if (currentPart > 1) {
      const pp = currentPart - 1;
      switchPart(pp);
      setCurrent(PARTS[pp].range[1]);
    }
  }
  document.getElementById('prevBtn').addEventListener('click', (e) => { e.stopPropagation(); goPrev(); });
  document.getElementById('nextBtn').addEventListener('click', (e) => { e.stopPropagation(); goNext(); });

  // --------------------------------------------------------
  // SCORING
  // --------------------------------------------------------
  function normalize(s) { return (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' '); }

  function isTextCorrect(part, q) {
    if (overrides[q] !== undefined) return overrides[q] === 1;
    const ans = normalize(answers[q]);
    if (!ans) return false;
    const accepted = (KEY[part] && KEY[part][q]) || [];
    return accepted.map(normalize).includes(ans);
  }

  function keyValue(part, q) {
    const k = KEY[String(part)];
    if (!k) return undefined;
    const v = k[q];
    if (v === null || v === undefined) return undefined;
    if (Array.isArray(v) && !v.length) return undefined;
    return v;
  }

  function missingKeyCount() {
    let n = 0;
    for (let p = 1; p <= 4; p++) {
      const [lo, hi] = PARTS[p].range;
      for (let q = lo; q <= hi; q++) if (keyValue(p, q) === undefined) n++;
    }
    return n;
  }

  function isCorrect(part, q) {
    if (keyValue(part, q) === undefined) return false;
    if (PARTS[part].type === 'sentence-completion') return isTextCorrect(part, q);
    return answers[q] === KEY[part][q];
  }

  function scorePart(p) {
    const [lo, hi] = PARTS[p].range;
    let score = 0;
    for (let q = lo; q <= hi; q++) if (isCorrect(String(p), q)) score += 1;
    return score;
  }

  // --------------------------------------------------------
  // Results
  // --------------------------------------------------------
  function handleFinish() {
    const total = 30;
    let answered = 0;
    for (let q = 1; q <= total; q++) if (answers[q] !== undefined && answers[q] !== '') answered++;
    const msg = answered < total
      ? `You have answered ${answered} of ${total} questions. Submit anyway?`
      : 'Submit your answers and see your results?';
    if (!confirm(msg)) return;
    showFinalResults();
  }

  function showFinalResults() {
    document.querySelector('.instructions').classList.add('hidden-during-results');
    document.querySelector('.content-wrap').classList.add('hidden-during-results');
    document.querySelector('.nav-arrows').classList.add('hidden-during-results');
    document.querySelector('.footer').classList.add('hidden-during-results');
    document.getElementById('finalResults').classList.add('active');
    renderScoreCards();
    renderAnswerReview();
  }

  function renderScoreCards() {
    const cards = document.getElementById('finalScoreCards');
    cards.innerHTML = '';

    const missing = missingKeyCount();
    if (missing) {
      const warn = document.createElement('div');
      warn.className = 'error-box';
      warn.textContent = missing === 30
        ? 'No answer key has been filled in for this test yet, so nothing can be marked. Fill in lis_key.json.'
        : `${missing} of the 30 answers are missing from lis_key.json and are counted as wrong.`;
      cards.appendChild(warn);
    }

    const parts = [1, 2, 3, 4];
    const total = parts.reduce((acc, p) => acc + scorePart(p), 0);
    const max = parts.reduce((acc, p) => acc + MAX_SCORES[p], 0);

    const c = document.createElement('div');
    c.className = 'score-card';
    c.innerHTML = `
      <div class="section-label">Listening</div>
      <div class="section-score">${total} <span class="max">/ ${max}</span></div>
      <div class="score-breakdown"></div>`;
    const bd = c.querySelector('.score-breakdown');
    parts.forEach(p => {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<span>Part ${p}</span><span>${scorePart(p)} / ${MAX_SCORES[p]}</span>`;
      bd.appendChild(row);
    });
    cards.appendChild(c);
  }

  function optionTextFor(part, q, idx) {
    if (idx === undefined || idx === null) return '';
    if (part === 1) {
      const extracts = CONTENT.parts['1'].extracts;
      for (const ex of extracts) {
        if (ex.questions[q]) return plainText(ex.questions[q].options[idx]);
      }
    }
    const data = CONTENT.parts[String(part)];
    if (data && data.questions && data.questions[q]) return plainText(data.questions[q].options[idx]);
    return '';
  }

  // Parts 1 and 3 store an option index; Part 4 stores a letter.
  function answerTextFor(p, q, value) {
    if (value === undefined || value === null || value === '') return '';
    if (p === 4) {
      const task = taskOf(q);
      return value + ' — ' + plainText((task && task.options[value]) || '');
    }
    return LETTERS[value] + ' — ' + optionTextFor(p, q, value);
  }

  function renderAnswerReview() {
    const container = document.getElementById('answerReview');
    container.innerHTML = '';

    for (let p = 1; p <= 4; p++) {
      if (!KEY[String(p)]) continue;

      const box = document.createElement('div');
      box.className = 'answer-review-part';
      const h = document.createElement('h3');
      h.innerHTML = `<span>Part ${p}</span><span class="part-score" data-part="${p}">${scorePart(p)} / ${MAX_SCORES[p]}</span>`;
      box.appendChild(h);

      const [lo, hi] = PARTS[p].range;
      const isText = PARTS[p].type === 'sentence-completion';

      for (let q = lo; q <= hi; q++) {
        const row = document.createElement('div');
        row.className = 'answer-review-row' + (isText ? ' with-override' : '');

        const num = document.createElement('span');
        num.className = 'q-num';
        num.textContent = q;
        row.appendChild(num);

        const your = document.createElement('span');
        your.className = 'your';
        const key = document.createElement('span');
        key.className = 'key';
        const mark = document.createElement('span');
        mark.className = 'mark';

        const ans = answers[q];
        const correct = isCorrect(String(p), q);

        if (isText) {
          your.textContent = ans || '—';
          key.textContent = keyValue(p, q) === undefined
            ? 'key not set'
            : (KEY[String(p)][q] || []).join(' / ');
        } else {
          your.textContent = answerTextFor(p, q, ans) || '—';
          key.textContent = keyValue(p, q) === undefined
            ? 'key not set'
            : answerTextFor(p, q, KEY[String(p)][q]);
        }

        if (ans === undefined || ans === null || ans === '') your.classList.add('empty');
        else your.classList.add(correct ? 'correct' : 'incorrect');

        row.appendChild(your);
        row.appendChild(key);

        if (isText) {
          const ov = document.createElement('button');
          ov.className = 'override' + (overrides[q] !== undefined ? ' on' : '');
          ov.textContent = correct ? 'mark wrong' : 'mark right';
          ov.addEventListener('click', () => {
            overrides[q] = isCorrect(String(p), q) ? 0 : 1;
            renderScoreCards();
            renderAnswerReview();
          });
          row.appendChild(ov);
        }

        mark.textContent = '+' + (correct ? 1 : 0);
        row.appendChild(mark);
        box.appendChild(row);
      }
      container.appendChild(box);
    }
  }

  document.getElementById('backToTestBtn').addEventListener('click', () => {
    document.getElementById('finalResults').classList.remove('active');
    document.querySelector('.instructions').classList.remove('hidden-during-results');
    document.querySelector('.content-wrap').classList.remove('hidden-during-results');
    document.querySelector('.nav-arrows').classList.remove('hidden-during-results');
    document.querySelector('.footer').classList.remove('hidden-during-results');
  });

  // --------------------------------------------------------
  // Boot
  // --------------------------------------------------------
  async function init() {
    const params = new URLSearchParams(window.location.search);
    const book = params.get('book') || 'cae1';
    const test = params.get('test') || '1';

    try {
      await loadExamData(book, test);
    } catch (e) {
      showComingSoon(book, test);
      return;
    }

    renderPart1();
    renderPart2();
    renderPart3();
    renderPart4();

    document.getElementById('instr-title').textContent = PARTS[1].title;
    document.getElementById('instr-text').innerHTML = instrFor(1);

    buildFooter();
    setCurrent(1);
  }

  init();
})();
