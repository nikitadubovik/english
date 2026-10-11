// ============================================================
// Cambridge C1 Advanced — Writing exam player
// Loads the tasks from content/<book>/test<N>/wri.json
//
// Part 1: one question that must be answered.
// Part 2: three questions, one of which is answered. The candidate
// says which with the "Answering this question?" dropdown.
// Nothing is marked automatically: after the test the two answers are shown
// as written and the candidate marks them against the four Writing criteria.
// ============================================================

(function () {
  'use strict';

  const EXAM_SECONDS = 90 * 60;   // 1 hour 30 minutes
  const LEAVE_MESSAGE = 'Leave the test? Your answers will not be saved.';

  // Rubrics; a test can replace them in wri.json (parts.N.title / parts.N.instr)
  const PARTS = {
    1: { title: n => (n.length > 1 ? 'Questions ' + n[0] + '–' + n[n.length - 1] : 'Question ' + n[0]),
         instr: 'You <b>must</b> answer this question. Write <b>{words} words</b> in an appropriate style.' },
    2: { title: n => (n.length > 1 ? 'Questions ' + n[0] + '–' + n[n.length - 1] : 'Question ' + n[0]),
         instr: 'Answer <b>one</b> of these questions. Write <b>{words} words</b> in an appropriate style.' },
  };

  const FLAG_SVG =
    '<svg viewBox="0 0 18 22" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M2 1 L16 1 L16 21 L9 16 L2 21 Z"/></svg>';
  const HANDLE_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"/></svg>';
  const ICON = {
    undecided: '?',
    yes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12.5 10 18 19.5 7"/></svg>',
    no: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  };
  const CHOICE_LABEL = { yes: 'Yes', no: 'No', undecided: 'Undecided' };

  // --------------------------------------------------------
  // Runtime state
  // --------------------------------------------------------
  let CONTENT = null;
  let LIMITS = { min: 220, max: 260 };
  const QUESTIONS = [];           // { n, part, task }
  const answers = {};             // question number -> text
  const choice = {};              // Part 2 question number -> 'undecided' | 'yes' | 'no'
  const flagged = new Set();
  const marks = {};               // question number -> { content: 0–5, ... } given on the results page
  const views = {};               // question number -> { view, left, textarea, count, flag, select, icon, picked }
  let current = null;             // question number on screen
  let book = '', test = '';

  const stage = document.getElementById('stage');
  const viewsWrap = document.getElementById('views');
  const footer = document.getElementById('footer');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
  const byNumber = n => QUESTIONS.find(q => q.n === n);
  const inPart = p => QUESTIONS.filter(q => q.part === p);
  const partOf = n => byNumber(n).part;
  const wordsIn = text => ((text || '').trim().match(/\S+/g) || []).length;   // anything between spaces is a word
  const hasText = n => (answers[n] || '').trim() !== '';

  // --------------------------------------------------------
  // The choice of question in Part 2
  //   - nothing chosen yet: every box can be typed in;
  //   - "Yes" on one question: the others become "No" and are locked;
  //   - "No": the box of that question is locked, its text is kept.
  // --------------------------------------------------------
  const chosen = () => inPart(2).find(q => choice[q.n] === 'yes') || null;
  const lockedOut = n => { const c = chosen(); return !!c && c.n !== n; };
  const canType = n => partOf(n) !== 2 || (choice[n] !== 'no' && !lockedOut(n));
  // A question counts as answered when there is text in it and, in Part 2, it is the chosen one
  const isAnswered = n => hasText(n) && (partOf(n) !== 2 || choice[n] === 'yes');
  const countAnswered = p => inPart(p).filter(q => isAnswered(q.n)).length;
  const partDone = p => (p === 2 ? !!chosen() : inPart(p).every(q => isAnswered(q.n)));

  function setChoice(n, value) {
    choice[n] = value;
    if (value === 'yes') inPart(2).forEach(q => { if (q.n !== n) choice[q.n] = 'no'; });
    inPart(2).forEach(q => paintQuestion(q.n));
    refreshFooter();
  }

  // --------------------------------------------------------
  // Data loading
  // --------------------------------------------------------
  async function loadExamData() {
    const res = await fetch(`content/${book}/test${test}/wri.json`);
    if (!res.ok) throw new Error('Not found');
    CONTENT = await res.json();
    if (CONTENT.words && CONTENT.words.min && CONTENT.words.max) LIMITS = { min: CONTENT.words.min, max: CONTENT.words.max };
    [1, 2].forEach(p => {
      const part = CONTENT.parts && CONTENT.parts[String(p)];
      ((part && part.questions) || []).forEach(q => {
        const n = parseInt(q.n, 10);
        if (!n || byNumber(n)) return;
        QUESTIONS.push({ n, part: p, task: q.task || [] });
        answers[n] = '';
        if (p === 2) choice[n] = 'undecided';
      });
    });
    QUESTIONS.sort((a, b) => a.n - b.n);
    if (!QUESTIONS.length) throw new Error('No questions');
  }

  function showComingSoon() {
    document.querySelector('.instructions').style.display = 'none';
    const box = el('div', 'coming-soon');
    const h = el('h2'); h.textContent = 'Coming soon';
    const p = el('p'); p.textContent = `The Writing paper for ${book || 'this book'}, Test ${test || '?'} is not available yet.`;
    const back = el('p'); const a = el('a'); a.href = 'index.html'; a.textContent = '← Back to library'; back.appendChild(a);
    box.append(h, p, back);
    viewsWrap.innerHTML = '';
    viewsWrap.appendChild(box);
    stage.classList.remove('split');
    document.querySelector('.nav-arrows').style.display = 'none';
    footer.style.display = 'none';
    const timer = document.getElementById('timer');
    if (timer) timer.style.display = 'none';
  }

  function rubricFor(p) {
    const part = (CONTENT.parts && CONTENT.parts[String(p)]) || {};
    const numbers = inPart(p).map(q => q.n);
    return {
      title: part.title || PARTS[p].title(numbers),
      instr: (part.instr || PARTS[p].instr).replace('{words}', LIMITS.min + '–' + LIMITS.max),
    };
  }

  // --------------------------------------------------------
  // Task text
  // A task is a list of blocks:
  //   "text"               a paragraph ("" is an empty line)
  //   { "center": "text" } a centred paragraph
  //   { "box": [ ... ] }   a framed group of blocks
  // Inside a text: [[bold]]…[[/bold]], [[underline]]…[[/underline]],
  // [[italic]]…[[/italic]]; a line break is written as \n.
  // Everything is inserted as text, never as HTML.
  // --------------------------------------------------------
  const INLINE = { bold: 'strong', underline: 'u', italic: 'em' };
  function appendInline(parent, text) {
    const re = /\[\[(\/?)(bold|underline|italic)\]\]/g;
    const stack = [];
    let cur = parent, last = 0, m;
    const put = s => s.split('\n').forEach((line, i) => {
      if (i) cur.appendChild(document.createElement('br'));
      if (line) cur.appendChild(document.createTextNode(line));
    });
    while ((m = re.exec(text)) !== null) {
      put(text.slice(last, m.index));
      last = re.lastIndex;
      if (!m[1]) { const e = document.createElement(INLINE[m[2]]); cur.appendChild(e); stack.push(cur); cur = e; }
      else if (stack.length) cur = stack.pop();
    }
    put(text.slice(last));
  }
  function renderBlocks(parent, blocks) {
    (Array.isArray(blocks) ? blocks : []).forEach(b => {
      if (typeof b === 'string') {
        const p = el('p', b ? '' : 'blank');
        if (b) appendInline(p, b);
        parent.appendChild(p);
      } else if (b && typeof b.center === 'string') {
        const p = el('p', 'center');
        appendInline(p, b.center);
        parent.appendChild(p);
      } else if (b && Array.isArray(b.box)) {
        const box = el('div', 'wri-box');
        renderBlocks(box, b.box);
        parent.appendChild(box);
      }
    });
  }

  // --------------------------------------------------------
  // One screen per question: the task on the left, the answer on the right.
  // The screens are built once and then only shown or hidden, so notes and
  // highlights made in a task are still there when you come back to it.
  // --------------------------------------------------------
  function buildView(q) {
    const view = el('div', 'content part-view wri-view');
    view.dataset.q = q.n;
    const layout = el('div', 'p5-layout wri-layout');

    const left = el('div', 'p5-left');
    const task = el('div', 'wri-task');
    renderBlocks(task, q.task);
    left.appendChild(task);

    const divider = el('div', 'p5-divider');
    divider.innerHTML = '<div class="handle">' + HANDLE_SVG + '</div>';
    setupDivider(divider);

    const right = el('div', 'p5-right');
    const main = el('div', 'wri-main');
    const v = views[q.n] = { view, left, right };

    if (q.part === 2) {
      const pick = el('div', 'wri-pick');
      const inner = el('div', 'wri-pick-in');
      const status = el('div', 'wri-pick-status');
      const ask = el('p'); ask.textContent = 'Answering this question?';
      v.picked = el('span');
      status.append(ask, v.picked, document.createTextNode(' of 1 questions selected.'));
      const selWrap = el('div', 'wri-pick-sel');
      v.select = el('select', 'wri-select');
      v.select.setAttribute('aria-label', 'Answering this question?');
      v.select.addEventListener('change', () => setChoice(q.n, v.select.value));
      v.icon = el('span', 'wri-pick-icon');
      v.icon.setAttribute('aria-hidden', 'true');
      selWrap.append(v.select, v.icon);
      inner.append(status, selWrap);
      pick.appendChild(inner);
      main.appendChild(pick);
    }

    const answer = el('div', 'wri-answer');
    v.textarea = el('textarea', 'wri-text');
    v.textarea.rows = 17;
    v.textarea.spellcheck = false;
    v.textarea.autocomplete = 'off';
    v.textarea.setAttribute('autocapitalize', 'sentences');
    v.textarea.setAttribute('aria-label', 'Your answer to question ' + q.n);
    v.textarea.addEventListener('input', () => {
      answers[q.n] = v.textarea.value;
      v.count.textContent = 'Words: ' + wordsIn(answers[q.n]);
      fitText(q.n);
      // Writing at the end of a long answer: keep the last line and the word
      // count on screen, clear of the arrow buttons
      if (v.textarea.selectionEnd === v.textarea.value.length) {
        const over = v.textarea.getBoundingClientRect().bottom + 104 - right.getBoundingClientRect().bottom;
        if (over > 0) right.scrollTop += over;
      }
      refreshFooter();
    });

    const flagCol = el('div', 'wri-flagcol');
    v.flag = el('button', 'wri-flag');
    v.flag.type = 'button';
    v.flag.title = 'Flag for review';
    v.flag.setAttribute('aria-label', 'Flag question ' + q.n + ' for review');
    v.flag.innerHTML = FLAG_SVG;
    v.flag.addEventListener('click', () => {
      if (flagged.has(q.n)) flagged.delete(q.n); else flagged.add(q.n);
      v.flag.classList.toggle('active', flagged.has(q.n));
      refreshFooter();
    });
    flagCol.appendChild(v.flag);

    v.count = el('div', 'wri-count');
    v.count.textContent = 'Words: 0';
    answer.append(v.textarea, flagCol);
    main.append(answer, v.count);
    right.appendChild(main);

    layout.append(left, divider, right);
    view.appendChild(layout);
    viewsWrap.appendChild(view);
    paintQuestion(q.n);
  }

  // Dropdown, its counter and icon, and whether the box can be typed in
  function paintQuestion(n) {
    const v = views[n];
    if (!v) return;
    v.textarea.disabled = !canType(n);
    if (!v.select) return;
    const state = choice[n];
    // "Undecided" is offered only until a choice has been made
    const options = state === 'undecided' ? ['yes', 'no', 'undecided'] : ['yes', 'no'];
    v.select.textContent = '';
    options.forEach(o => v.select.appendChild(new Option(CHOICE_LABEL[o], o)));
    v.select.value = state;
    v.select.disabled = lockedOut(n);
    v.picked.textContent = chosen() ? '1' : '0';
    v.icon.innerHTML = ICON[state];
  }

  // The box is 17 lines high and grows with the text; it never gets a scrollbar of its own
  function fitText(n) {
    const v = views[n];
    if (!v || !v.textarea.offsetParent) return;
    const ta = v.textarea, pane = v.right, top = pane.scrollTop;
    ta.style.height = 'auto';
    const need = ta.scrollHeight + (ta.offsetHeight - ta.clientHeight);
    if (need > ta.offsetHeight + 1) ta.style.height = need + 'px';
    pane.scrollTop = top;
  }

  // The border between the panes is dragged for all questions at once
  function setupDivider(divider) {
    let dragging = false;
    divider.addEventListener('pointerdown', (e) => {
      dragging = true;
      divider.setPointerCapture(e.pointerId);
      divider.classList.add('dragging');
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
    divider.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const rect = divider.parentElement.getBoundingClientRect();
      const min = 200, max = rect.width - min - divider.offsetWidth;
      const x = Math.max(min, Math.min(max, e.clientX - rect.left - divider.offsetWidth / 2));
      viewsWrap.style.setProperty('--wri-left', (x / rect.width) * 100 + '%');
      if (current !== null) fitText(current);
    });
    const stop = () => {
      if (!dragging) return;
      dragging = false;
      divider.classList.remove('dragging');
      document.body.style.userSelect = '';
    };
    divider.addEventListener('pointerup', stop);
    divider.addEventListener('pointercancel', stop);
  }

  // --------------------------------------------------------
  // Footer
  // --------------------------------------------------------
  function buildFooter() {
    footer.innerHTML = '';
    const currentPart = partOf(current);
    [1, 2].forEach(p => {
      const qs = inPart(p);
      if (!qs.length) return;
      const tab = el('div', 'part' + (qs.length === 1 ? ' single' : ''));
      tab.dataset.part = p;
      tab.addEventListener('click', () => { if (partOf(current) !== p) show(qs[0].n); });

      tab.appendChild(el('div', 'part-flag'));
      const label = el('span', 'label');
      const check = el('span', 'check');
      check.textContent = '✓';
      label.append(check, document.createTextNode('Part ' + p));
      tab.appendChild(label);

      if (p !== currentPart) {
        tab.appendChild(el('span', 'progress'));
      } else if (qs.length > 1) {
        const qnums = el('span', 'qnums');
        qs.forEach(q => {
          const s = el('span');
          s.textContent = q.n;
          s.dataset.q = q.n;
          s.addEventListener('click', (e) => { e.stopPropagation(); show(q.n); });
          qnums.appendChild(s);
        });
        tab.appendChild(qnums);
      }
      footer.appendChild(tab);
    });
    const finish = el('div', 'finish');
    finish.textContent = '✓';
    finish.title = 'Finish';
    finish.addEventListener('click', handleFinish);
    footer.appendChild(finish);
    refreshFooter();
    if (window.ExamUI) window.ExamUI.fitFooter(footer);
  }

  function refreshFooter() {
    const currentPart = current === null ? null : partOf(current);
    footer.querySelectorAll('.part').forEach(tab => {
      const p = parseInt(tab.dataset.part, 10);
      tab.classList.toggle('active', p === currentPart);
      tab.classList.toggle('completed', partDone(p));
      tab.classList.toggle('has-flag', inPart(p).some(q => flagged.has(q.n)));
      const prog = tab.querySelector('.progress');
      if (prog) prog.textContent = countAnswered(p) + ' of ' + inPart(p).length;
      tab.querySelectorAll('.qnums span').forEach(s => {
        const n = parseInt(s.dataset.q, 10);
        s.classList.toggle('current', n === current);
        s.classList.toggle('answered', isAnswered(n));
        s.classList.toggle('flagged', flagged.has(n));
      });
    });
  }

  // --------------------------------------------------------
  // Moving between questions
  // --------------------------------------------------------
  function show(n) {
    const partChanged = current === null || partOf(current) !== partOf(n);
    current = n;
    QUESTIONS.forEach(q => views[q.n].view.classList.toggle('active', q.n === n));
    if (partChanged) {
      const r = rubricFor(partOf(n));
      document.getElementById('instr-title').textContent = r.title;
      document.getElementById('instr-text').innerHTML = r.instr;
      buildFooter();
    } else {
      refreshFooter();
    }
    prevBtn.disabled = n === QUESTIONS[0].n;
    fitText(n);
  }
  function step(by) {
    const i = QUESTIONS.findIndex(q => q.n === current) + by;
    if (i >= 0 && i < QUESTIONS.length) show(QUESTIONS[i].n);
  }
  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));

  // Also sent by ui.js when the text size changes or the notes panel opens or closes
  window.addEventListener('resize', () => {
    if (current === null || stage.classList.contains('results')) return;
    if (window.ExamUI) window.ExamUI.fitFooter(footer);
    fitText(current);
  });

  // --------------------------------------------------------
  // Finishing: the answers are shown as they were written
  // --------------------------------------------------------
  const HIDE_DURING_RESULTS = ['.instructions', '.content-wrap', '.nav-arrows', '.footer'];

  // What is marked: the Part 1 answer and one Part 2 answer — the question
  // chosen with "Yes" or, if none was chosen, the one with the most text.
  function handedIn() {
    const out = [];
    inPart(1).forEach(q => out.push({ part: 1, q, chosen: true }));
    if (inPart(2).length) {
      const c = chosen();
      const written = inPart(2).filter(q => hasText(q.n)).sort((x, y) => wordsIn(answers[y.n]) - wordsIn(answers[x.n]));
      out.push({ part: 2, q: c || written[0] || null, chosen: !!c });
    }
    return out;
  }

  function handleFinish() {
    const lines = [];
    inPart(1).forEach(q => lines.push(`Question ${q.n}: ` + (hasText(q.n) ? wordsIn(answers[q.n]) + ' words' : 'no answer')));
    if (inPart(2).length) {
      const c = chosen();
      if (c) lines.push(`Question ${c.n}: ` + (hasText(c.n) ? wordsIn(answers[c.n]) + ' words' : 'chosen, but no answer'));
      else lines.push('Part 2: no question chosen');
    }
    if (!confirm(lines.join('\n') + '\n\nFinish the test?')) return;
    submitAnswers();
  }

  function submitAnswers() {
    if (window.ExamUI) window.ExamUI.stopTimer();
    HIDE_DURING_RESULTS.forEach(s => document.querySelector(s).classList.add('hidden-during-results'));
    stage.classList.add('results');
    stage.scrollTop = 0;
    document.getElementById('limitsText').textContent = LIMITS.min + '–' + LIMITS.max + ' words';
    renderReview();
    document.getElementById('finalResults').classList.add('active');
  }

  function onTimeUp() {
    document.getElementById('timeUpNote').style.display = '';
    submitAnswers();
  }

  // --------------------------------------------------------
  // Self-assessment
  // Each answer gets 0–5 for each of the four criteria, 20 marks an answer
  // and 40 in all. The total is turned into an approximate Cambridge English
  // Scale score.
  // --------------------------------------------------------
  const CRITERIA = [
    ['content', 'Content'],
    ['communicative', 'Communicative Achievement'],
    ['organisation', 'Organisation'],
    ['language', 'Language'],
  ];
  // Writing marks 16–40 -> scale scores 160–210
  const SCALE_FROM = 16;
  const SCALE = [160, 162, 165, 168, 170, 172, 175, 178, 180, 182, 184, 186, 189, 191, 193, 195, 196, 198, 200, 202, 203, 205, 207, 208, 210];
  // Below 160 the line runs down to 142 at 10 marks, the lowest score reported for this exam
  function scaleScore(total) {
    if (total >= SCALE_FROM) return SCALE[Math.min(total, 40) - SCALE_FROM];
    if (total >= 10) return 142 + (total - 10) * 3;
    return null;
  }

  function renderReview() {
    const box = document.getElementById('writingReview');
    box.innerHTML = '';
    handedIn().forEach(item => {
      const q = item.q;
      const card = el('div', 'wri-result');
      const h = el('h3');
      h.textContent = q ? `Part ${item.part} — Question ${q.n}` : `Part ${item.part}`;
      card.appendChild(h);

      if (!q || !hasText(q.n)) {
        const none = el('p', 'wri-empty');
        none.textContent = 'No answer: 0 marks.';
        card.appendChild(none);
        box.appendChild(card);
        return;
      }

      const meta = el('div', 'meta');
      const n = wordsIn(answers[q.n]);
      meta.appendChild(document.createTextNode(n + (n === 1 ? ' word' : ' words')));
      if (n < LIMITS.min || n > LIMITS.max) {
        const off = el('span', 'off');
        off.textContent = n < LIMITS.min ? ` · ${LIMITS.min - n} below the minimum` : ` · ${n - LIMITS.max} above the maximum`;
        meta.appendChild(off);
      }
      if (!item.chosen) meta.appendChild(document.createTextNode(' · you did not say which Part 2 question you were answering'));
      const text = el('div', 'wri-result-text');
      text.textContent = answers[q.n];
      const copy = el('button', 'btn-secondary');
      copy.type = 'button';
      copy.textContent = 'Copy text';
      copy.addEventListener('click', () => copyText(answers[q.n], copy));
      card.append(meta, text, copy);

      // Marks: one row of real radio buttons, 0–5, for each criterion
      marks[q.n] = marks[q.n] || {};
      const table = el('div', 'wri-marks');
      const subtotal = el('span', 'wri-subtotal');
      CRITERIA.forEach(([key, name]) => {
        const row = el('div', 'wri-crit');
        row.setAttribute('role', 'radiogroup');
        row.setAttribute('aria-label', name);
        const label = el('span', 'name');
        label.textContent = name;
        const opts = el('span', 'wri-opts');
        for (let v = 0; v <= 5; v++) {
          const l = el('label');
          const r = el('input');
          r.type = 'radio';
          r.name = `mark-${q.n}-${key}`;
          r.value = v;
          r.checked = marks[q.n][key] === v;
          r.addEventListener('change', () => { marks[q.n][key] = v; paintTotals(); });
          const t = el('span');
          t.textContent = v;
          l.append(r, t);
          opts.appendChild(l);
        }
        row.append(label, opts);
        table.appendChild(row);
      });
      const foot = el('div', 'wri-crit total');
      const fl = el('span', 'name');
      fl.textContent = 'This answer';
      subtotal.dataset.q = q.n;
      foot.append(fl, subtotal);
      table.appendChild(foot);
      card.appendChild(table);
      box.appendChild(card);
    });
    paintTotals();
    document.getElementById('downloadBtn').disabled = !handedIn().some(item => item.q && hasText(item.q.n));
  }

  // Sub-totals, the total out of 40 and the scale score. An answer that was
  // not written counts as marked, with 0.
  function assessment() {
    let total = 0, left = 0;
    const per = {};
    handedIn().forEach(item => {
      if (!item.q || !hasText(item.q.n)) return;
      const m = marks[item.q.n] || {};
      per[item.q.n] = 0;
      CRITERIA.forEach(([key]) => {
        if (m[key] === undefined) left++;
        else { per[item.q.n] += m[key]; total += m[key]; }
      });
    });
    return { total, left, per, max: handedIn().length * CRITERIA.length * 5 };
  }
  function paintTotals() {
    const a = assessment();
    document.querySelectorAll('.wri-subtotal').forEach(s => { s.textContent = a.per[s.dataset.q] + ' / 20'; });
    document.getElementById('totalMarks').textContent = a.total + ' / ' + a.max;
    const scale = document.getElementById('scaleScore');
    const note = document.getElementById('scaleNote');
    if (a.left) {
      scale.textContent = '—';
      note.textContent = a.left === 1 ? 'One criterion is still to be marked.' : a.left + ' criteria are still to be marked.';
    } else {
      const s = scaleScore(a.total);
      scale.textContent = s === null ? 'below 142' : '≈ ' + s;
      note.textContent = s === null ? 'Fewer than 10 marks: no score is reported for this exam below 142.'
        : s >= 200 ? 'Level C2 (Grade A at C1 Advanced).'
        : s >= 180 ? 'Level C1 (a pass at C1 Advanced).'
        : s >= 160 ? 'Level B2.' : 'Below Level B2.';
    }
  }

  function copyText(text, button) {
    const done = ok => { button.textContent = ok ? 'Copied' : 'Could not copy'; setTimeout(() => { button.textContent = 'Copy text'; }, 1600); };
    const fallback = () => {
      const ta = el('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { /* not allowed */ }
      ta.remove();
      done(ok);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done(true), fallback);
    else fallback();
  }

  document.getElementById('downloadBtn').addEventListener('click', () => {
    const NL = '\r\n';
    const parts = handedIn().filter(item => item.q && hasText(item.q.n)).map(item => {
      const q = item.q, m = marks[q.n] || {};
      const given = CRITERIA.filter(([key]) => m[key] !== undefined).map(([key, name]) => name + ' ' + m[key]);
      return `Part ${item.part}, Question ${q.n} (${wordsIn(answers[q.n])} words)` + NL + NL + answers[q.n].replace(/\r?\n/g, NL) +
        (given.length ? NL + NL + 'Marks: ' + given.join(', ') : '');
    });
    if (!parts.length) return;
    const a0 = assessment();
    const sum = a0.left ? '' : NL + NL + NL + 'Total: ' + a0.total + ' / ' + a0.max + ' — Cambridge English Scale ' + document.getElementById('scaleScore').textContent;
    const blob = new Blob(['C1 Advanced Writing — ' + book + ', Test ' + test + NL + NL + parts.join(NL + NL + NL) + sum + NL], { type: 'text/plain;charset=utf-8' });
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = `c1-writing-${book}-test${test}.txt`.replace(/[^\w.-]+/g, '_');
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  document.getElementById('backToTestBtn').addEventListener('click', () => {
    document.getElementById('finalResults').classList.remove('active');
    HIDE_DURING_RESULTS.forEach(s => document.querySelector(s).classList.remove('hidden-during-results'));
    stage.classList.remove('results');
    if (window.ExamUI) window.ExamUI.fitFooter(footer);
    if (current !== null) fitText(current);
  });

  // --------------------------------------------------------
  // Boot
  // --------------------------------------------------------
  async function init() {
    const params = new URLSearchParams(window.location.search);
    book = params.get('book') || 'cae1';
    test = params.get('test') || '1';

    try {
      await loadExamData();
    } catch (e) {
      showComingSoon();
      return;
    }

    QUESTIONS.forEach(buildView);
    show(QUESTIONS[0].n);

    if (window.ExamUI) {
      window.ExamUI.leaveMessage = LEAVE_MESSAGE;
      window.ExamUI.startTimer(EXAM_SECONDS, onTimeUp);
      // Notes and highlights: anywhere in the tasks, not in the rubric or the answer pane
      window.ExamUI.initNotes({
        scope: viewsWrap,
        skip: '.p5-right',
        where: () => {
          const numbers = inPart(partOf(current)).map(q => q.n);
          return { part: current, label: numbers.length > 1 ? numbers[0] + '–' + numbers[numbers.length - 1] : String(numbers[0]) };
        },
        // A note card was clicked: show the question whose task it belongs to
        goTo: (n) => {
          if (stage.classList.contains('results')) return;
          if (n !== current && views[n]) show(n);
        },
      });
    }
  }

  init();
})();
