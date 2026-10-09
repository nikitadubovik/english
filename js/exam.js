// ============================================================
// Cambridge C1 Advanced — Reading & Use of English exam player
// Loads content and key JSON from content/<book>/test<N>/rue.json and rue_key.json
// ============================================================

(function () {
  'use strict';

  // --------------------------------------------------------
  // Part structure metadata (question ranges + rubrics)
  // --------------------------------------------------------
  const PARTS = {
    1: { type: 'mc', count: 8, range: [1, 8], title: 'Questions 1–8',
         instr: 'For each question, choose the correct answer for each gap.' },
    2: { type: 'cloze', count: 8, range: [9, 16], title: 'Questions 9–16',
         instr: 'For each question, write the correct answer. Write <b>one</b> word for each gap.' },
    3: { type: 'wordform', count: 8, range: [17, 24], title: 'Questions 17–24',
         instr: 'For each question, use the word in CAPITALS on the right to form a word that fits in the gap.' },
    4: { type: 'transform', count: 6, range: [25, 30], title: 'Questions 25–30',
         instr: 'For each question, complete the second sentence so that it means the same as the first. <b>Do not change the word given.</b> You must use between <b>three</b> and <b>six</b> words, including the word given.' },
    5: { type: 'reading-mc', count: 6, range: [31, 36], title: 'Questions 31–36',
         instr: 'Read the text below. For each question, choose the correct answer.' },
    6: { type: 'multi-match-4', count: 4, range: [37, 40], title: 'Questions 37–40',
         instr: 'Read the four texts below. For each question, choose the correct answer. Each answer may be chosen more than once.' },
    7: { type: 'gapped-text', count: 6, range: [41, 46], title: 'Questions 41–46',
         instr: 'Six paragraphs have been removed from the text below. For each question, choose the correct answer. There is one extra paragraph which you do not need to use.' },
    8: { type: 'multi-match', count: 10, range: [47, 56], title: 'Questions 47–56',
         instr: 'Read the text below. For each question, choose the correct answer. Each answer may be chosen more than once.' },
  };

  const MAX_SCORES = { 1: 8, 2: 8, 3: 8, 4: 12, 5: 12, 6: 8, 7: 12, 8: 10 };
  const EXAM_SECONDS = 90 * 60;   // 1 hour 30 minutes
  const FLAG_COL = 96;            // width of the bookmark column to the right of the text
  const LEAVE_MESSAGE = 'Leave the test? Your answers will not be saved.';
  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  const FLAG_SVG =
    '<svg viewBox="0 0 18 22" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M2 1 L16 1 L16 21 L9 16 L2 21 Z"/></svg>';

  // --------------------------------------------------------
  // Runtime state
  // --------------------------------------------------------
  let CONTENT = null;  // loaded from reading.json
  let KEY = null;      // loaded from reading-key.json
  const answers = {};
  const flagged = new Set();
  const p4Scores = {};
  let currentPart = 1;
  let currentQ = null;

  const flagBtn = document.getElementById('flagBtn');
  const contentWrap = document.querySelector('.content-wrap');
  const stage = document.getElementById('stage');
  const footer = document.getElementById('footer');

  // --------------------------------------------------------
  // Data loading
  // --------------------------------------------------------
  async function loadExamData(book, test) {
    const base = `content/${book}/test${test}`;
    try {
      const [contentRes, keyRes] = await Promise.all([
        fetch(`${base}/rue.json`),
        fetch(`${base}/rue_key.json`),
      ]);
      if (!contentRes.ok || !keyRes.ok) throw new Error('Not found');
      CONTENT = await contentRes.json();
      KEY = await keyRes.json();
    } catch (e) {
      showComingSoon(book, test);
      throw e;
    }
  }

  function showComingSoon(book, test) {
    document.querySelector('.instructions').style.display = 'none';
    const box = document.createElement('div');
    box.className = 'coming-soon';
    const h = document.createElement('h2');
    h.textContent = 'Coming soon';
    const p = document.createElement('p');
    p.textContent = `The Reading paper for ${book || 'this book'}, Test ${test || '?'} is not available yet.`;
    const back = document.createElement('p');
    const a = document.createElement('a');
    a.href = 'index.html';
    a.textContent = '← Back to library';
    back.appendChild(a);
    box.append(h, p, back);
    const wrap = document.querySelector('.content-wrap');
    wrap.innerHTML = '';
    wrap.appendChild(box);
    document.querySelector('.nav-arrows').style.display = 'none';
    document.querySelector('.footer').style.display = 'none';
    const timer = document.getElementById('timer');
    if (timer) timer.style.display = 'none';
  }

  // The rubric can be set per test in rue.json (parts.N.instr), since
  // Parts 5–8 name the kind of text; otherwise the generic one is used.
  function instrFor(p) {
    const data = CONTENT && CONTENT.parts && CONTENT.parts[String(p)];
    return (data && data.instr) || PARTS[p].instr;
  }

  // --------------------------------------------------------
  // PART 1 render — tokenises text on [[N]] placeholders
  // --------------------------------------------------------
  function renderPart1() {
    const view = document.querySelector('.part-view[data-view="1"]');
    view.innerHTML = '';
    const data = CONTENT.parts['1'];
    const h = document.createElement('h1');
    h.textContent = data.title;
    view.appendChild(h);
    data.text.split('\n\n').forEach(paraText => {
      view.appendChild(buildParaWithGaps(paraText, 'span'));
    });
  }

  // Builds a <p> with inline gaps at [[N]] tokens.
  // gapType: 'span' for MC (Part 1), 'input' for Parts 2/3.
  function buildParaWithGaps(text, gapType) {
    const p = document.createElement('p');
    const re = /\[\[(\d+)\]\]/g;
    let lastIdx = 0;
    let match;
    while ((match = re.exec(text)) !== null) {
      if (match.index > lastIdx) {
        p.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
      }
      const q = parseInt(match[1], 10);
      if (gapType === 'span') {
        const g = document.createElement('span');
        g.className = 'gap';
        g.dataset.q = q;
        g.textContent = q;
        p.appendChild(g);
      } else {
        const g = document.createElement('input');
        g.className = 'gap';
        g.dataset.q = q;
        g.placeholder = q;
        p.appendChild(g);
      }
      lastIdx = re.lastIndex;
    }
    if (lastIdx < text.length) {
      p.appendChild(document.createTextNode(text.slice(lastIdx)));
    }
    return p;
  }

  function attachPart1Handlers() {
    document.querySelectorAll('.part-view[data-view="1"] .gap').forEach(gap => {
      const q = parseInt(gap.dataset.q, 10);
      gap.addEventListener('click', (e) => {
        e.stopPropagation();
        const alreadyOpen = gap.querySelector('.popup');
        closeAllPopups();
        setCurrent(q);
        if (alreadyOpen) return;

        const popup = document.createElement('div');
        popup.className = 'popup open';

        const close = document.createElement('div');
        close.className = 'close';
        close.textContent = '✕';
        close.addEventListener('click', (ev) => {
          ev.stopPropagation();
          closeAllPopups();
        });
        popup.appendChild(close);

        CONTENT.parts['1'].options[q].forEach((label, idx) => {
          const opt = document.createElement('div');
          opt.className = 'opt';
          if (answers[q] === idx) opt.classList.add('selected');
          opt.textContent = label;
          opt.addEventListener('click', (ev) => {
            ev.stopPropagation();
            answers[q] = idx;
            gap.textContent = label;
            gap.classList.add('answered');
            refreshFooter();
            closeAllPopups();
          });
          popup.appendChild(opt);
        });

        gap.appendChild(popup);
        gap.classList.add('open');

        // The strip starts at the left edge of the gap; if that would push it
        // off the page, slide it back just far enough to stay visible.
        const notesWidth = document.body.classList.contains('notes-open') ? 300 : 0;
        const overflow = popup.getBoundingClientRect().right - (document.documentElement.clientWidth - notesWidth - 12);
        if (overflow > 0) popup.style.left = (-1 - overflow) + 'px';
      });
    });
  }

  // --------------------------------------------------------
  // PART 2 render
  // --------------------------------------------------------
  function renderPart2() {
    const view = document.querySelector('.part-view[data-view="2"]');
    view.innerHTML = '';
    const data = CONTENT.parts['2'];
    const h = document.createElement('h1');
    h.textContent = data.title;
    view.appendChild(h);
    data.text.split('\n\n').forEach(paraText => {
      view.appendChild(buildParaWithGaps(paraText, 'input'));
    });
    attachInputHandlers(view);
  }

  // --------------------------------------------------------
  // PART 3 render — text with keyword list on the right
  // --------------------------------------------------------
  function renderPart3() {
    const view = document.querySelector('.part-view[data-view="3"]');
    view.innerHTML = '';
    const data = CONTENT.parts['3'];
    const layout = document.createElement('div');
    layout.className = 'part3-layout';

    const textCol = document.createElement('div');
    textCol.className = 'part3-text';
    const h = document.createElement('h1');
    h.textContent = data.title;
    textCol.appendChild(h);
    data.text.split('\n\n').forEach(paraText => {
      textCol.appendChild(buildParaWithGaps(paraText, 'input'));
    });
    layout.appendChild(textCol);

    const kwList = document.createElement('div');
    kwList.className = 'keyword-list';
    const kwTitle = document.createElement('div');
    kwTitle.className = 'kw-title';
    kwTitle.textContent = 'Keyword List';
    kwList.appendChild(kwTitle);
    Object.keys(data.keywords).forEach(q => {
      const kw = document.createElement('div');
      kw.className = 'keyword';
      kw.dataset.q = q;
      kw.textContent = `${q}. ${data.keywords[q]}`;
      kw.addEventListener('click', (e) => {
        e.stopPropagation();
        setCurrent(parseInt(q, 10));
      });
      kwList.appendChild(kw);
    });
    layout.appendChild(kwList);

    view.appendChild(layout);
    attachInputHandlers(view);
  }

  function attachInputHandlers(view) {
    view.querySelectorAll('input.gap').forEach(input => {
      const q = parseInt(input.dataset.q, 10);
      input.addEventListener('focus', () => setCurrent(q));
      input.addEventListener('click', (e) => {
        e.stopPropagation();
        setCurrent(q);
      });
      input.addEventListener('input', () => {
        const val = input.value.trim();
        if (val) {
          answers[q] = val;
          input.classList.add('answered');
        } else {
          delete answers[q];
          input.classList.remove('answered');
        }
        refreshFooter();
      });
    });
  }

  // --------------------------------------------------------
  // PART 4 — one question at a time
  // --------------------------------------------------------
  // Each question is built once and afterwards only shown or hidden, so the
  // notes and highlights made in it are still there when you come back.
  function renderPart4Question(q) {
    const view = document.querySelector('.part-view[data-view="4"]');
    let container = view.querySelector('.part4-container');
    if (!container) {
      view.innerHTML = '';
      container = document.createElement('div');
      container.className = 'part4-container';
      view.appendChild(container);
    }
    const data = CONTENT.parts['4'].questions[q];
    if (!data) return;

    let item = container.querySelector(`.part4-item[data-q="${q}"]`);
    if (!item) {
      item = buildPart4Item(q, data);
      container.appendChild(item);
    }
    container.querySelectorAll('.part4-item').forEach(other => { other.hidden = other !== item; });

    const input = item.querySelector('input.gap');
    input.classList.add('current');
    input.classList.toggle('flagged', flagged.has(q));
    fitPart4Input(input);
    positionFlagBtn(input);
    input.focus({ preventScroll: true });
  }

  function buildPart4Item(q, data) {
    const item = document.createElement('div');
    item.className = 'part4-item';
    item.dataset.q = q;

    const first = document.createElement('p');
    first.className = 'part4-first';
    first.textContent = data.first;
    item.appendChild(first);

    const kw = document.createElement('div');
    kw.className = 'part4-keyword';
    kw.textContent = data.keyword;
    item.appendChild(kw);

    const second = document.createElement('p');
    second.className = 'part4-second';
    second.appendChild(document.createTextNode(data.before + ' '));

    const input = document.createElement('input');
    input.className = 'gap current';
    input.dataset.q = q;
    input.placeholder = q;
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('input', () => {
      const val = input.value.trim();
      if (val) {
        answers[q] = val;
        input.classList.add('answered');
      } else {
        delete answers[q];
        input.classList.remove('answered');
      }
      fitPart4Input(input);
      positionFlagBtn(input);
      refreshFooter();
    });
    second.appendChild(input);
    second.appendChild(document.createTextNode(' ' + data.after));
    item.appendChild(second);
    return item;
  }

  // The box starts 211px wide (at the regular text size) and grows with the
  // answer, as in the exam player.
  function fitPart4Input(input) {
    const unit = parseFloat(getComputedStyle(document.documentElement).fontSize) / 16;
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:' + getComputedStyle(input).font;
    probe.textContent = input.value;
    document.body.appendChild(probe);
    input.style.width = Math.max(211 * unit, Math.ceil(probe.getBoundingClientRect().width) + 20) + 'px';
    probe.remove();
  }

  // --------------------------------------------------------
  // PARTS 5–8 — shared pieces
  // --------------------------------------------------------
  // Renders the small [[bold]]...[[/bold]] markup used in content JSON.
  // This keeps the source data safe while allowing selected phrases to be bold.
  function appendMarkedText(parent, text) {
    const re = /\[\[bold\]\](.*?)\[\[\/bold\]\]/g;
    let last = 0;
    let match;
    while ((match = re.exec(text)) !== null) {
      if (match.index > last) {
        parent.appendChild(document.createTextNode(text.slice(last, match.index)));
      }
      const strong = document.createElement('strong');
      strong.textContent = match[1];
      parent.appendChild(strong);
      last = re.lastIndex;
    }
    if (last < text.length) {
      parent.appendChild(document.createTextNode(text.slice(last)));
    }
  }

  // Bookmark shown next to the current question only (CSS hides the rest).
  function makeFlagButton(q, afterToggle) {
    const flag = document.createElement('button');
    flag.type = 'button';
    flag.className = 'p5-flag';
    flag.title = 'Flag for review';
    flag.innerHTML = FLAG_SVG;
    flag.addEventListener('click', (e) => {
      e.stopPropagation();
      if (flagged.has(q)) flagged.delete(q); else flagged.add(q);
      flag.classList.toggle('active', flagged.has(q));
      if (afterToggle) afterToggle();
      refreshFooter();
    });
    return flag;
  }

  // --------------------------------------------------------
  // PART 5 — split view with text and MC questions
  // --------------------------------------------------------
  function renderPart5() {
    const left = document.getElementById('p5Left');
    const right = document.getElementById('p5Right');
    if (!left) return;
    if (left.dataset.rendered) { updatePart5State(); return; }
    left.dataset.rendered = '1';

    const data = CONTENT.parts['5'];
    const h = document.createElement('h1');
    h.textContent = data.title;
    left.appendChild(h);
    data.paragraphs.forEach(text => {
      const p = document.createElement('p');
      appendMarkedText(p, text);
      left.appendChild(p);
    });

    Object.keys(data.questions).forEach(qStr => {
      const q = parseInt(qStr, 10);
      const qd = data.questions[qStr];
      right.appendChild(buildSplitQuestion(q, qd.stem, qd.options));
    });
  }

  function updatePart5State() { updateSplitState('p5Right'); }

  // Multiple-choice question with real radio buttons (Part 5)
  function buildSplitQuestion(q, stem, options) {
    const qDiv = document.createElement('div');
    qDiv.className = 'p5-question';
    qDiv.dataset.q = q;

    const head = document.createElement('div');
    head.className = 'p5-qhead';
    const num = document.createElement('span');
    num.className = 'p5-qnum';
    num.textContent = q;
    head.appendChild(num);
    const stemSpan = document.createElement('span');
    appendMarkedText(stemSpan, stem);
    head.appendChild(stemSpan);
    qDiv.appendChild(head);

    const optsDiv = document.createElement('div');
    optsDiv.className = 'p5-options';
    options.forEach((label, idx) => {
      const opt = document.createElement('label');
      opt.className = 'p5-option';
      opt.dataset.idx = idx;
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'q' + q;
      radio.value = idx;
      // Store the answer first and repaint afterwards, so our state and the
      // browser's own checked state can never disagree.
      radio.addEventListener('click', (e) => {
        e.stopPropagation();
        answers[q] = idx;
        setCurrent(q, false);
      });
      opt.appendChild(radio);
      const txt = document.createElement('span');
      txt.textContent = label;
      opt.appendChild(txt);
      opt.addEventListener('click', (e) => e.stopPropagation());
      optsDiv.appendChild(opt);
    });
    qDiv.appendChild(optsDiv);

    qDiv.appendChild(makeFlagButton(q));
    qDiv.addEventListener('click', () => setCurrent(q, false));
    return qDiv;
  }

  // --------------------------------------------------------
  // PARTS 6 and 8 — lettered sections, one dropdown per question
  // --------------------------------------------------------
  function renderMatch(part, leftId, rightId) {
    const left = document.getElementById(leftId);
    const right = document.getElementById(rightId);
    if (!left) return;
    if (left.dataset.rendered) { updateSplitState(rightId); return; }
    left.dataset.rendered = '1';

    const data = CONTENT.parts[String(part)];
    const h = document.createElement('h1');
    h.textContent = data.title;
    left.appendChild(h);
    data.sections.forEach(sec => {
      const letter = document.createElement('div');
      letter.className = 'p6-letter';
      letter.textContent = sec.letter;
      left.appendChild(letter);
      const p = document.createElement('p');
      p.textContent = sec.text;
      left.appendChild(p);
    });

    if (data.intro) {
      const intro = document.createElement('div');
      intro.className = 'p6-intro';
      intro.textContent = /[.?!…:]$/.test(data.intro) ? data.intro : data.intro + '...';
      right.appendChild(intro);
    }

    // The choices are the letters of the sections actually in this test,
    // so a text with five or six sections works as well as one with four.
    const letters = data.sections.map(sec => sec.letter);
    Object.keys(data.questions).forEach(qStr => {
      right.appendChild(buildMatchQuestion(parseInt(qStr, 10), data.questions[qStr], letters));
    });
  }

  function renderPart6() { renderMatch(6, 'p6Left', 'p6Right'); }
  function renderPart8() { renderMatch(8, 'p8Left', 'p8Right'); }
  function updatePart6State() { updateSplitState('p6Right'); }
  function updatePart8State() { updateSplitState('p8Right'); }

  function buildMatchQuestion(q, stem, letters) {
    const row = document.createElement('div');
    row.className = 'p5-question mm-row';
    row.dataset.q = q;

    const stemEl = document.createElement('div');
    stemEl.className = 'mm-stem';
    appendMarkedText(stemEl, stem);
    row.appendChild(stemEl);

    const sel = document.createElement('select');
    sel.className = 'mm-select';
    sel.setAttribute('aria-label', 'Question ' + q);
    // The closed box shows the question number until a letter is chosen;
    // that entry is hidden from the open list, where "Select alternative" clears the answer.
    const placeholder = new Option(String(q), '');
    placeholder.hidden = true;
    sel.appendChild(placeholder);
    sel.appendChild(new Option('Select alternative', ''));
    letters.forEach((l, idx) => sel.appendChild(new Option(l, String(idx))));
    sel.addEventListener('click', (e) => e.stopPropagation());
    sel.addEventListener('focus', () => { if (currentQ !== q) setCurrent(q, false); });
    sel.addEventListener('change', () => {
      if (sel.value === '') delete answers[q];
      else answers[q] = parseInt(sel.value, 10);
      setCurrent(q, false);
    });
    row.appendChild(sel);

    row.appendChild(makeFlagButton(q));
    row.addEventListener('click', () => setCurrent(q, false));
    return row;
  }

  // Repaints the questions of a split view (Parts 5, 6, 8) from the stored state
  function updateSplitState(rightId) {
    const right = document.getElementById(rightId);
    if (!right) return;
    right.querySelectorAll('.p5-question').forEach(qDiv => {
      const q = parseInt(qDiv.dataset.q, 10);
      qDiv.classList.toggle('current', q === currentQ);
      const flag = qDiv.querySelector('.p5-flag');
      if (flag) flag.classList.toggle('active', flagged.has(q));
      const ans = answers[q];
      qDiv.querySelectorAll('.p5-option').forEach(opt => {
        const on = parseInt(opt.dataset.idx, 10) === ans;
        opt.classList.toggle('selected', on);
        const radio = opt.querySelector('input');
        if (radio && radio.checked !== on) radio.checked = on;
      });
      const sel = qDiv.querySelector('.mm-select');
      if (sel) {
        if (ans === undefined) sel.selectedIndex = 0;
        else sel.value = String(ans);
      }
    });
  }

  // --------------------------------------------------------
  // PART 7 — gapped text with drag-and-drop paragraphs.
  // Two independent columns, each with its own scrollbar.
  // --------------------------------------------------------
  function renderPart7() {
    const left = document.getElementById('p7Left');
    const right = document.getElementById('p7Right');
    if (!left) return;
    if (left.dataset.rendered) { updatePart7State(); return; }
    left.dataset.rendered = '1';

    const data = CONTENT.parts['7'];
    const [lo, hi] = PARTS[7].range;
    const h = document.createElement('h1');
    h.textContent = data.title;
    left.appendChild(h);

    if (data.intro) {
      const intro = document.createElement('p');
      intro.className = 'p7-intro';
      intro.textContent = data.intro;
      left.appendChild(intro);
    }

    data.blocks.forEach(block => {
      if (block.type === 'p') {
        const p = document.createElement('p');
        p.textContent = block.text;
        left.appendChild(p);
        return;
      }

      const row = document.createElement('div');
      row.className = 'p7-gap-row';
      row.dataset.q = block.q;

      const gap = document.createElement('div');
      gap.className = 'p7-gap empty';
      gap.dataset.q = block.q;
      gap.textContent = block.q;

      gap.addEventListener('click', (e) => {
        e.stopPropagation();
        setCurrent(block.q, false);
      });
      gap.addEventListener('dragover', (e) => {
        e.preventDefault();
        gap.classList.add('drag-over');
      });
      gap.addEventListener('dragleave', () => {
        gap.classList.remove('drag-over');
      });
      gap.addEventListener('drop', (e) => {
        e.preventDefault();
        gap.classList.remove('drag-over');
        const letter = e.dataTransfer.getData('text/plain');
        if (!data.paragraphs[letter]) return;
        // A paragraph can sit in one gap only. Look at Part 7 answers alone:
        // a typed "A" in Part 2 must not be mistaken for paragraph A.
        for (let k = lo; k <= hi; k++) {
          if (k !== block.q && answers[k] === letter) delete answers[k];
        }
        answers[block.q] = letter;
        setCurrent(block.q, false);
      });

      row.appendChild(gap);
      left.appendChild(row);
    });

    // The bookmark follows the current gap while the text is scrolled.
    left.addEventListener('scroll', positionP7Flag);

    Object.keys(data.paragraphs).forEach(letter => {
      const para = document.createElement('div');
      para.className = 'p7-para';
      para.draggable = true;
      para.dataset.letter = letter;
      para.textContent = data.paragraphs[letter];
      para.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', letter);
        para.classList.add('dragging');
      });
      para.addEventListener('dragend', () => para.classList.remove('dragging'));
      right.appendChild(para);
    });
  }

  function updatePart7State() {
    const left = document.getElementById('p7Left');
    const right = document.getElementById('p7Right');
    if (!left) return;
    const [lo, hi] = PARTS[7].range;

    left.querySelectorAll('.p7-gap-row').forEach(row => {
      const q = parseInt(row.dataset.q, 10);
      const gap = row.querySelector('.p7-gap');
      const letter = answers[q];
      row.classList.toggle('current', q === currentQ);
      gap.classList.toggle('current', q === currentQ);
      gap.classList.toggle('flagged', flagged.has(q));

      if (letter) {
        gap.classList.remove('empty');
        gap.classList.add('filled');
        gap.innerHTML = '';
        gap.textContent = CONTENT.parts['7'].paragraphs[letter];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'p7-gap-remove';
        btn.textContent = '✕';
        btn.title = 'Remove';
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          delete answers[q];
          setCurrent(q, false);
        });
        gap.appendChild(btn);
      } else {
        gap.classList.remove('filled');
        gap.classList.add('empty');
        gap.innerHTML = '';
        gap.textContent = q;
      }
    });

    const used = new Set();
    for (let q = lo; q <= hi; q++) if (answers[q]) used.add(answers[q]);
    right.querySelectorAll('.p7-para').forEach(para => {
      para.classList.toggle('used', used.has(para.dataset.letter));
    });
  }

  // --------------------------------------------------------
  // Shared helpers
  // --------------------------------------------------------
  function closeAllPopups() {
    document.querySelectorAll('.popup').forEach(p => p.remove());
    document.querySelectorAll('.gap.open').forEach(g => g.classList.remove('open'));
  }

  function positionFlagBtn(gapEl) {
    flagBtn.classList.add('visible');                    // shown first: a hidden button has no size
    flagBtn.classList.toggle('active', flagged.has(currentQ));
    const wrapRect = contentWrap.getBoundingClientRect();
    const gapRect = gapEl.getBoundingClientRect();
    const w = flagBtn.offsetWidth, h = flagBtn.offsetHeight;
    // The button is a little taller than the gap and ends level with its bottom edge.
    flagBtn.style.top = (gapRect.bottom - h - wrapRect.top) + 'px';
    // It is centred in a 96px column that starts where the text column ends.
    const column = currentPart === 3 ? document.querySelector('.part3-text')
                 : document.querySelector('.part-view.active');
    if (column) {
      const rect = column.getBoundingClientRect();
      // In Parts 1, 2 and 4 the view's right padding is that column plus a margin.
      const textRight = rect.right - (currentPart === 3 ? 0 : parseFloat(getComputedStyle(column).paddingRight) || 0);
      flagBtn.style.left = (textRight - wrapRect.left + (FLAG_COL - w) / 2) + 'px';
      flagBtn.style.right = 'auto';
    }
  }

  // Part 7: the bookmark sits in the column to the right of the paragraphs,
  // level with the current gap; it hides while that gap is scrolled out of view.
  function positionP7Flag() {
    if (currentPart !== 7) return;
    const gap = document.querySelector('#p7Left .p7-gap.current');
    const pane = document.getElementById('p7Left');
    const layout = document.querySelector('.p7-layout');
    if (!gap || !pane || !layout) { flagBtn.classList.remove('visible'); return; }
    flagBtn.classList.add('visible');
    const w = flagBtn.offsetWidth, h = flagBtn.offsetHeight;
    const wrapRect = contentWrap.getBoundingClientRect();
    const g = gap.getBoundingClientRect(), p = pane.getBoundingClientRect(), l = layout.getBoundingClientRect();
    const mid = g.top + Math.min(g.height, h - 1) / 2;
    const inView = mid > p.top && mid < p.bottom;
    flagBtn.style.top = (mid - wrapRect.top - h / 2) + 'px';
    // layout padding-right = 72px bookmark column (32 + 40) + 32px margin + 17px scrollbar
    flagBtn.style.left = (l.right - wrapRect.left - 121 + 32 + (40 - w) / 2) + 'px';
    flagBtn.style.right = 'auto';
    flagBtn.classList.toggle('visible', inView);
    flagBtn.classList.toggle('active', flagged.has(currentQ));
  }

  function updateKeywords() {
    document.querySelectorAll('.keyword').forEach(k => {
      k.classList.toggle('active', parseInt(k.dataset.q, 10) === currentQ);
    });
  }

  // scroll = true when the move comes from the footer or the arrow buttons.
  // A click inside the question itself passes false, so the page never jumps
  // under the mouse.
  function setCurrent(q, scroll = true) {
    currentQ = q;
    const reveal = (el) => {
      if (el && scroll) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    if (currentPart === 4) { renderPart4Question(q); refreshFooter(); return; }
    if (currentPart === 5 || currentPart === 6 || currentPart === 8) {
      const rightId = 'p' + currentPart + 'Right';
      updateSplitState(rightId); refreshFooter();
      reveal(document.querySelector(`#${rightId} .p5-question[data-q="${q}"]`));
      return;
    }
    if (currentPart === 7) {
      updatePart7State(); refreshFooter();
      reveal(document.querySelector(`#p7Left .p7-gap-row[data-q="${q}"]`));
      positionP7Flag();
      return;
    }
    document.querySelectorAll('.gap').forEach(g => {
      g.classList.toggle('current', parseInt(g.dataset.q, 10) === q);
    });
    updateKeywords();
    refreshFooter();
    const gap = document.querySelector(`.gap[data-q="${q}"]`);
    if (gap) {
      reveal(gap);
      positionFlagBtn(gap);
      if (gap.tagName === 'INPUT') gap.focus({ preventScroll: true });
    }
  }


  // --------------------------------------------------------
  // Footer / part switching
  // --------------------------------------------------------
  function buildFooter() {
    footer.innerHTML = '';
    for (let p = 1; p <= 8; p++) {
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
    if (window.ExamUI) window.ExamUI.fitFooter(footer);
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
    flagBtn.classList.remove('visible', 'active');
    closeAllPopups();
    updateKeywords();
    buildFooter();
    // Parts 1–4 scroll the stage as a whole; Parts 5–8 keep the rubric still
    // and scroll their own panes (the layout itself is done in CSS).
    if (stage) { stage.classList.toggle('split', p >= 5); stage.scrollTop = 0; }
    if (p === 4) setCurrent(PARTS[4].range[0]);
    if (p === 5) { renderPart5(); setCurrent(PARTS[5].range[0]); }
    if (p === 6) { renderPart6(); setCurrent(PARTS[6].range[0]); }
    if (p === 7) { renderPart7(); setCurrent(PARTS[7].range[0]); }
    if (p === 8) { renderPart8(); setCurrent(PARTS[8].range[0]); }
  }

  // --------------------------------------------------------
  // Flag button + nav arrows
  // --------------------------------------------------------
  flagBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentQ === null) return;
    if (flagged.has(currentQ)) {
      flagged.delete(currentQ);
      flagBtn.classList.remove('active');
    } else {
      flagged.add(currentQ);
      flagBtn.classList.add('active');
    }
    document.querySelectorAll('.gap').forEach(g => {
      g.classList.toggle('flagged', flagged.has(parseInt(g.dataset.q, 10)));
    });
    if (currentPart === 7) updatePart7State();
    refreshFooter();
  });

  document.addEventListener('click', () => closeAllPopups());
  // Also sent by ui.js when the text size changes or the notes panel opens or closes.
  window.addEventListener('resize', () => {
    if (stage && stage.classList.contains('results')) return;
    if (window.ExamUI) window.ExamUI.fitFooter(footer);
    closeAllPopups();
    positionP7Flag();
    if (currentQ !== null && currentPart <= 4) {
      const gap = document.querySelector(`.gap[data-q="${currentQ}"]`);
      if (gap && currentPart === 4) fitPart4Input(gap);
      if (gap) positionFlagBtn(gap);
    }
  });

  function goNext() {
    const [lo, hi] = PARTS[currentPart].range;
    if (currentQ === null) { setCurrent(lo); return; }
    if (currentQ < hi) { setCurrent(currentQ + 1); return; }
    if (currentPart < 8) {
      const np = currentPart + 1;
      switchPart(np);
      setCurrent(PARTS[np].range[0]);
    }
  }
  function goPrev() {
    const [lo, hi] = PARTS[currentPart].range;
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

  // Split-view divider drag. The whole border reacts, not only the arrow handle;
  // pointer events make it work with a mouse, a pen and a finger alike.
  function setupDivider(dividerId, leftId) {
    const divider = document.getElementById(dividerId);
    if (!divider) return;
    const left = document.getElementById(leftId);
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
      const layout = divider.parentElement;
      const rect = layout.getBoundingClientRect();
      const cs = getComputedStyle(layout);
      const padL = parseFloat(cs.paddingLeft) || 0;
      const inner = rect.width - padL - (parseFloat(cs.paddingRight) || 0);
      const min = 200;
      const max = inner - min - divider.offsetWidth;
      const x = Math.max(min, Math.min(max, e.clientX - rect.left - padL - divider.offsetWidth / 2));
      // The right pane keeps flex: 1 and takes whatever is left.
      left.style.flex = `0 0 ${(x / inner) * 100}%`;
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
  // SCORING
  // --------------------------------------------------------
  function normalize(s) { return (s || '').toString().trim().toLowerCase(); }
  function isP2Correct(q) {
    const ans = normalize(answers[q]);
    if (!ans) return false;
    return (KEY['2'][q] || []).includes(ans);
  }
  function isP3Correct(q) {
    const ans = normalize(answers[q]);
    if (!ans) return false;
    return (KEY['3'][q] || []).includes(ans);
  }
  function scorePart(part) {
    let score = 0;
    const [lo, hi] = PARTS[part].range;
    if (part === 1) { for (let q = lo; q <= hi; q++) if (answers[q] === KEY['1'][q]) score += 1; }
    else if (part === 2) { for (let q = lo; q <= hi; q++) if (isP2Correct(q)) score += 1; }
    else if (part === 3) { for (let q = lo; q <= hi; q++) if (isP3Correct(q)) score += 1; }
    else if (part === 4) { for (let q = lo; q <= hi; q++) score += (p4Scores[q] || 0); }
    else if (part === 5) { for (let q = lo; q <= hi; q++) if (answers[q] === KEY['5'][q]) score += 2; }
    else if (part === 6) { for (let q = lo; q <= hi; q++) if (answers[q] === KEY['6'][q]) score += 2; }
    else if (part === 7) { for (let q = lo; q <= hi; q++) if (answers[q] === KEY['7'][q]) score += 2; }
    else if (part === 8) { for (let q = lo; q <= hi; q++) if (answers[q] === KEY['8'][q]) score += 1; }
    return score;
  }

  // --------------------------------------------------------
  // Part 4 review + final results
  // --------------------------------------------------------
  function showP4Review() {
    document.querySelector('.instructions').classList.add('hidden-during-results');
    document.querySelector('.content-wrap').classList.add('hidden-during-results');
    document.querySelector('.nav-arrows').classList.add('hidden-during-results');
    document.querySelector('.footer').classList.add('hidden-during-results');
    flagBtn.classList.remove('visible');
    if (stage) { stage.classList.add('results'); stage.scrollTop = 0; }
    document.getElementById('finalResults').classList.remove('active');
    document.getElementById('p4Review').classList.add('active');

    const list = document.getElementById('p4ReviewList');
    list.innerHTML = '';
    for (let q = 25; q <= 30; q++) {
      const data = CONTENT.parts['4'].questions[q];
      const item = document.createElement('div');
      item.className = 'p4-review-item';

      const addLabel = (t) => { const l = document.createElement('div'); l.className = 'label'; l.textContent = t; item.appendChild(l); };
      addLabel('Question ' + q);
      const first = document.createElement('div'); first.className = 'first-line'; first.textContent = data.first; item.appendChild(first);

      const kw = document.createElement('div'); kw.className = 'keyword'; kw.style.marginTop = '8px'; kw.textContent = data.keyword; item.appendChild(kw);
      const second = document.createElement('div'); second.className = 'first-line'; second.style.marginTop = '4px';
      second.textContent = data.before + ' ______ ' + data.after; item.appendChild(second);

      addLabel('Your answer');
      const cand = document.createElement('div'); cand.className = 'candidate-answer';
      cand.textContent = answers[q] ? answers[q] : '— (no answer)'; item.appendChild(cand);

      addLabel('Accepted answer(s)');
      const key = document.createElement('div'); key.className = 'key-answer';
      key.textContent = KEY['4'][q]; item.appendChild(key);

      addLabel('Award yourself');
      const btns = document.createElement('div'); btns.className = 'score-buttons';
      [0, 1, 2].forEach(v => {
        const b = document.createElement('button');
        b.className = 'score-btn';
        b.textContent = v;
        if (p4Scores[q] === v) b.classList.add('selected');
        b.addEventListener('click', () => {
          p4Scores[q] = v;
          btns.querySelectorAll('.score-btn').forEach(x => x.classList.remove('selected'));
          b.classList.add('selected');
          checkP4Ready();
        });
        btns.appendChild(b);
      });
      item.appendChild(btns);
      list.appendChild(item);
    }
    checkP4Ready();
  }

  function checkP4Ready() {
    const allGraded = [25, 26, 27, 28, 29, 30].every(q => p4Scores[q] !== undefined);
    document.getElementById('p4SubmitBtn').disabled = !allGraded;
  }

  document.getElementById('p4SubmitBtn').addEventListener('click', showFinalResults);

  function showFinalResults() {
    document.getElementById('p4Review').classList.remove('active');
    document.getElementById('finalResults').classList.add('active');

    const readingParts = [1, 5, 6, 7, 8];
    const useParts = [2, 3, 4];
    const readingScore = readingParts.reduce((acc, p) => acc + scorePart(p), 0);
    const readingMax = readingParts.reduce((acc, p) => acc + MAX_SCORES[p], 0);
    const useScore = useParts.reduce((acc, p) => acc + scorePart(p), 0);
    const useMax = useParts.reduce((acc, p) => acc + MAX_SCORES[p], 0);

    const cards = document.getElementById('finalScoreCards');
    cards.innerHTML = '';

    function makeCard(title, score, max, parts) {
      const c = document.createElement('div');
      c.className = 'score-card';
      c.innerHTML = `
        <div class="section-label">${title}</div>
        <div class="section-score">${score} <span class="max">/ ${max}</span></div>
        <div class="score-breakdown"></div>`;
      const bd = c.querySelector('.score-breakdown');
      parts.forEach(p => {
        const row = document.createElement('div');
        row.className = 'row';
        row.innerHTML = `<span>Part ${p}</span><span>${scorePart(p)} / ${MAX_SCORES[p]}</span>`;
        bd.appendChild(row);
      });
      return c;
    }
    cards.appendChild(makeCard('Reading', readingScore, readingMax, readingParts));
    cards.appendChild(makeCard('Use of English', useScore, useMax, useParts));

    renderAnswerReview();
  }

  function letterFromIdx(idx) {
    if (idx === undefined || idx === null) return '';
    return LETTERS[idx] || '';
  }

  function renderAnswerReview() {
    const container = document.getElementById('answerReview');
    container.innerHTML = '';

    for (let p = 1; p <= 8; p++) {
      const box = document.createElement('div');
      box.className = 'answer-review-part';
      const h = document.createElement('h3');
      h.innerHTML = `<span>Part ${p}</span><span class="part-score">${scorePart(p)} / ${MAX_SCORES[p]}</span>`;
      box.appendChild(h);

      const [lo, hi] = PARTS[p].range;
      for (let q = lo; q <= hi; q++) {
        const row = document.createElement('div');
        row.className = 'answer-review-row';
        const num = document.createElement('span'); num.className = 'q-num'; num.textContent = q; row.appendChild(num);
        const your = document.createElement('span'); your.className = 'your';
        const key = document.createElement('span'); key.className = 'key';
        const mark = document.createElement('span'); mark.className = 'mark';

        const ans = answers[q];
        let isCorrect = false;
        let marks = 0;

        if (p === 1) {
          const opts = CONTENT.parts['1'].options[q];
          your.textContent = ans !== undefined ? `${opts[ans]} (${letterFromIdx(ans)})` : '—';
          key.textContent = `${opts[KEY['1'][q]]} (${letterFromIdx(KEY['1'][q])})`;
          isCorrect = ans === KEY['1'][q];
          marks = isCorrect ? 1 : 0;
        } else if (p === 2) {
          your.textContent = ans || '—';
          key.textContent = (KEY['2'][q] || []).join(' / ');
          isCorrect = isP2Correct(q);
          marks = isCorrect ? 1 : 0;
        } else if (p === 3) {
          your.textContent = ans || '—';
          key.textContent = (KEY['3'][q] || []).join(' / ');
          isCorrect = isP3Correct(q);
          marks = isCorrect ? 1 : 0;
        } else if (p === 4) {
          your.textContent = ans || '—';
          key.textContent = KEY['4'][q];
          marks = p4Scores[q] || 0;
          isCorrect = marks > 0;
          if (marks === 1) your.classList.add('partial');
        } else if (p === 5) {
          your.textContent = ans !== undefined ? letterFromIdx(ans) : '—';
          key.textContent = letterFromIdx(KEY['5'][q]);
          isCorrect = ans === KEY['5'][q];
          marks = isCorrect ? 2 : 0;
        } else if (p === 6) {
          const prefix = CONTENT.parts['6'].label;
          your.textContent = ans !== undefined ? `${prefix} ${letterFromIdx(ans)}` : '—';
          key.textContent = `${prefix} ${letterFromIdx(KEY['6'][q])}`;
          isCorrect = ans === KEY['6'][q];
          marks = isCorrect ? 2 : 0;
        } else if (p === 7) {
          your.textContent = ans || '—';
          key.textContent = KEY['7'][q];
          isCorrect = ans === KEY['7'][q];
          marks = isCorrect ? 2 : 0;
        } else if (p === 8) {
          const prefix = CONTENT.parts['8'].label;
          your.textContent = ans !== undefined ? `${prefix} ${letterFromIdx(ans)}` : '—';
          key.textContent = `${prefix} ${letterFromIdx(KEY['8'][q])}`;
          isCorrect = ans === KEY['8'][q];
          marks = isCorrect ? 1 : 0;
        }

        if (ans === undefined || ans === null || ans === '') your.classList.add('empty');
        else if (p !== 4) your.classList.add(isCorrect ? 'correct' : 'incorrect');
        else if (marks === 2) your.classList.add('correct');

        mark.textContent = '+' + marks;
        row.appendChild(your); row.appendChild(key); row.appendChild(mark);
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
    if (stage) stage.classList.remove('results');
    if (window.ExamUI) window.ExamUI.fitFooter(footer);
    if (currentQ !== null) setCurrent(currentQ, false);
  });

  function handleFinish() {
    const total = 56;
    let answered = 0;
    for (let q = 1; q <= 56; q++) if (answers[q] !== undefined && answers[q] !== '') answered++;
    const msg = answered < total
      ? `You have answered ${answered} of ${total} questions. Submit anyway?`
      : 'Submit your answers and see your results?';
    if (!confirm(msg)) return;
    submitAnswers();
  }

  function submitAnswers() {
    if (window.ExamUI) window.ExamUI.stopTimer();
    closeAllPopups();
    showP4Review();
  }

  // The clock ran out: no question asked, the paper is handed in as it is.
  function onTimeUp() {
    const note = document.getElementById('timeUpNote');
    if (note) note.style.display = '';
    submitAnswers();
  }

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
      return; // coming-soon already displayed
    }

    renderPart1();
    renderPart2();
    renderPart3();
    attachPart1Handlers();
    setupDivider('p5Divider', 'p5Left');
    setupDivider('p6Divider', 'p6Left');
    setupDivider('p8Divider', 'p8Left');

    document.getElementById('instr-text').innerHTML = instrFor(1);
    buildFooter();

    if (window.ExamUI) {
      window.ExamUI.leaveMessage = LEAVE_MESSAGE;
      window.ExamUI.startTimer(EXAM_SECONDS, onTimeUp);
      // Notes and highlights: anywhere in the texts and questions, not in the rubric.
      window.ExamUI.initNotes({
        scope: contentWrap,
        where: () => ({ part: currentPart, label: PARTS[currentPart].range.join('–') }),
        // A note card was clicked: show the part (and the Part 4 question) it belongs to.
        goTo: (part, mark) => {
          if (stage && stage.classList.contains('results')) return;
          if (part !== currentPart) switchPart(part);
          const item = mark && mark.closest('.part4-item');
          if (item && item.hidden) setCurrent(parseInt(item.dataset.q, 10));
        },
      });
    }
  }

  init();
})();
