// ============================================================
// Cambridge C1 Advanced — Reading & Use of English exam player
// Loads content and key JSON from /content/<book>/<test>/reading(.key).json
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
         instr: 'Read the introduction below to a book. For each question, choose the correct answer.' },
    6: { type: 'multi-match-4', count: 4, range: [37, 40], title: 'Questions 37–40',
         instr: 'You are going to read four contributions to an online debate. For each question, choose the correct answer. Each answer may be chosen more than once.' },
    7: { type: 'gapped-text', count: 6, range: [41, 46], title: 'Questions 41–46',
         instr: 'Read an extract from a magazine article. Six paragraphs have been removed from the text below. For each question, choose the correct answer. There is one extra paragraph which you do not need to use.' },
    8: { type: 'multi-match', count: 10, range: [47, 56], title: 'Questions 47–56',
         instr: 'You are going to read an article. For each question, choose the correct answer. Each answer may be chosen more than once.' },
  };

  const MAX_SCORES = { 1: 8, 2: 8, 3: 8, 4: 12, 5: 12, 6: 8, 7: 12, 8: 10 };

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
    document.querySelector('.header').style.display = '';
    document.querySelector('.instructions').style.display = 'none';
    document.querySelector('.content-wrap').innerHTML =
      `<div class="coming-soon">
         <h2>Coming soon</h2>
         <p>The Reading paper for <b>${book || 'this book'}</b>, Test ${test || '?'} is not available yet.</p>
         <p><a href="index.html" style="color: var(--teal);">← Back to library</a></p>
       </div>`;
    document.querySelector('.nav-arrows').style.display = 'none';
    document.querySelector('.footer').style.display = 'none';
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
  function renderPart4Question(q) {
    const view = document.querySelector('.part-view[data-view="4"]');
    let container = view.querySelector('.part4-container');
    if (!container) {
      view.innerHTML = '';
      container = document.createElement('div');
      container.className = 'part4-container';
      view.appendChild(container);
    }
    container.innerHTML = '';
    const data = CONTENT.parts['4'].questions[q];
    if (!data) return;

    const first = document.createElement('p');
    first.className = 'part4-first';
    first.textContent = data.first;
    container.appendChild(first);

    const kw = document.createElement('div');
    kw.className = 'part4-keyword';
    kw.textContent = data.keyword;
    container.appendChild(kw);

    const second = document.createElement('p');
    second.className = 'part4-second';
    second.appendChild(document.createTextNode(data.before + ' '));

    const input = document.createElement('input');
    input.className = 'gap current';
    input.dataset.q = q;
    input.placeholder = q;
    if (answers[q] !== undefined) {
      input.value = answers[q];
      input.classList.add('answered');
    }
    if (flagged.has(q)) input.classList.add('flagged');

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
      refreshFooter();
    });
    second.appendChild(input);
    second.appendChild(document.createTextNode(' ' + data.after));
    container.appendChild(second);

    setTimeout(() => positionFlagBtn(input), 0);
    input.focus();
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
      p.textContent = text;
      left.appendChild(p);
    });

    Object.keys(data.questions).forEach(qStr => {
      const q = parseInt(qStr, 10);
      const qd = data.questions[qStr];
      right.appendChild(buildSplitQuestion(q, qd.stem, qd.options));
    });
  }

  function updatePart5State() { updateSplitState('p5Right'); }

  // --------------------------------------------------------
  // PART 6 — split view with lettered contributions
  // --------------------------------------------------------
  function renderPart6() {
    const left = document.getElementById('p6Left');
    const right = document.getElementById('p6Right');
    if (!left) return;
    if (left.dataset.rendered) { updatePart6State(); return; }
    left.dataset.rendered = '1';

    const data = CONTENT.parts['6'];
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

    const intro = document.createElement('div');
    intro.className = 'p6-intro';
    intro.textContent = data.intro;
    right.appendChild(intro);

    const labelPrefix = data.label;
    Object.keys(data.questions).forEach(qStr => {
      const q = parseInt(qStr, 10);
      const stem = data.questions[qStr];
      const opts = ['A','B','C','D'].map(l => `${labelPrefix} ${l}`);
      right.appendChild(buildSplitQuestion(q, stem, opts));
    });
  }

  function updatePart6State() { updateSplitState('p6Right'); }

  // --------------------------------------------------------
  // PART 8 — split view, multi-match 10 questions
  // --------------------------------------------------------
  function renderPart8() {
    const left = document.getElementById('p8Left');
    const right = document.getElementById('p8Right');
    if (!left) return;
    if (left.dataset.rendered) { updatePart8State(); return; }
    left.dataset.rendered = '1';

    const data = CONTENT.parts['8'];
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

    const intro = document.createElement('div');
    intro.className = 'p6-intro';
    intro.textContent = data.intro;
    right.appendChild(intro);

    const labelPrefix = data.label;
    Object.keys(data.questions).forEach(qStr => {
      const q = parseInt(qStr, 10);
      const stem = data.questions[qStr];
      const opts = ['A','B','C','D'].map(l => `${labelPrefix} ${l}`);
      right.appendChild(buildSplitQuestion(q, stem, opts));
    });
  }

  function updatePart8State() { updateSplitState('p8Right'); }

  // Generic builder for a split-view question (Parts 5, 6, 8)
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
    stemSpan.textContent = stem;
    stemSpan.style.fontWeight = 'normal';
    head.appendChild(stemSpan);
    qDiv.appendChild(head);

    const optsDiv = document.createElement('div');
    optsDiv.className = 'p5-options';
    options.forEach((label, idx) => {
      const opt = document.createElement('div');
      opt.className = 'p5-option';
      opt.dataset.idx = idx;
      const radio = document.createElement('span');
      radio.className = 'p5-radio';
      opt.appendChild(radio);
      const txt = document.createElement('span');
      txt.textContent = label;
      opt.appendChild(txt);
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        answers[q] = idx;
        optsDiv.querySelectorAll('.p5-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        setCurrent(q);
        refreshFooter();
      });
      optsDiv.appendChild(opt);
    });
    qDiv.appendChild(optsDiv);

    const flag = document.createElement('button');
    flag.className = 'p5-flag';
    flag.innerHTML = '<svg viewBox="0 0 18 22" xmlns="http://www.w3.org/2000/svg"><path d="M2 1 L16 1 L16 21 L9 16 L2 21 Z"/></svg>';
    flag.addEventListener('click', (e) => {
      e.stopPropagation();
      if (flagged.has(q)) {
        flagged.delete(q);
        flag.classList.remove('active');
      } else {
        flagged.add(q);
        flag.classList.add('active');
      }
      refreshFooter();
    });
    qDiv.appendChild(flag);

    qDiv.addEventListener('click', () => setCurrent(q));
    return qDiv;
  }

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
        opt.classList.toggle('selected', parseInt(opt.dataset.idx, 10) === ans);
      });
    });
  }

  // --------------------------------------------------------
  // PART 7 — gapped text with drag-and-drop paragraphs
  // --------------------------------------------------------
  function renderPart7() {
    const left = document.getElementById('p7Left');
    const right = document.getElementById('p7Right');
    if (!left) return;
    if (left.dataset.rendered) { updatePart7State(); return; }
    left.dataset.rendered = '1';

    const data = CONTENT.parts['7'];
    const h = document.createElement('h1');
    h.textContent = data.title;
    left.appendChild(h);

    const intro = document.createElement('p');
    intro.style.fontStyle = 'italic';
    intro.style.textAlign = 'center';
    intro.textContent = data.intro;
    left.appendChild(intro);

    data.blocks.forEach(block => {
      if (block.type === 'p') {
        const p = document.createElement('p');
        p.textContent = block.text;
        left.appendChild(p);
      } else {
        const gap = document.createElement('div');
        gap.className = 'p7-gap empty';
        gap.dataset.q = block.q;
        gap.textContent = block.q;

        gap.addEventListener('click', (e) => {
          e.stopPropagation();
          setCurrent(block.q);
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
          if (!letter) return;
          for (const k in answers) {
            if (answers[k] === letter && parseInt(k, 10) !== block.q) {
              delete answers[k];
            }
          }
          answers[block.q] = letter;
          setCurrent(block.q);
          updatePart7State();
          refreshFooter();
        });

        left.appendChild(gap);
      }
    });

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

    left.querySelectorAll('.p7-gap').forEach(gap => {
      const q = parseInt(gap.dataset.q, 10);
      const letter = answers[q];
      gap.classList.toggle('current', q === currentQ);
      gap.classList.toggle('flagged', flagged.has(q));

      if (letter) {
        gap.classList.remove('empty');
        gap.classList.add('filled');
        gap.innerHTML = '';
        gap.textContent = CONTENT.parts['7'].paragraphs[letter];
        const btn = document.createElement('button');
        btn.className = 'p7-gap-remove';
        btn.textContent = '✕';
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          delete answers[q];
          updatePart7State();
          refreshFooter();
        });
        gap.appendChild(btn);
      } else {
        gap.classList.remove('filled');
        gap.classList.add('empty');
        gap.innerHTML = '';
        gap.textContent = q;
      }
    });

    const used = new Set(Object.values(answers).filter(v => typeof v === 'string' && /^[A-G]$/.test(v)));
    right.querySelectorAll('.p7-para').forEach(para => {
      para.classList.toggle('used', used.has(para.dataset.letter));
    });
  }

  // --------------------------------------------------------
  // Shared helpers
  // --------------------------------------------------------
  function closeAllPopups() {
    document.querySelectorAll('.popup').forEach(p => p.remove());
  }

  function positionFlagBtn(gapEl) {
    const wrapRect = contentWrap.getBoundingClientRect();
    const gapRect = gapEl.getBoundingClientRect();
    const top = gapRect.top - wrapRect.top + (gapRect.height / 2) - 12;
    flagBtn.style.top = top + 'px';
    if (currentPart === 3) {
      const textArea = document.querySelector('.part3-text');
      if (textArea) {
        const textRect = textArea.getBoundingClientRect();
        flagBtn.style.left = (textRect.right - wrapRect.left + 16) + 'px';
        flagBtn.style.right = 'auto';
      }
    } else {
      flagBtn.style.right = '16px';
      flagBtn.style.left = 'auto';
    }
    flagBtn.classList.add('visible');
    flagBtn.classList.toggle('active', flagged.has(currentQ));
  }

  function updateKeywords() {
    document.querySelectorAll('.keyword').forEach(k => {
      k.classList.toggle('active', parseInt(k.dataset.q, 10) === currentQ);
    });
  }

  function setCurrent(q) {
    currentQ = q;
    if (currentPart === 4) { renderPart4Question(q); refreshFooter(); return; }
    if (currentPart === 5) {
      updatePart5State(); refreshFooter();
      const el = document.querySelector(`#p5Right .p5-question[data-q="${q}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (currentPart === 6) {
      updatePart6State(); refreshFooter();
      const el = document.querySelector(`#p6Right .p5-question[data-q="${q}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (currentPart === 7) {
      updatePart7State(); refreshFooter();
      const gap = document.querySelector(`#p7Left .p7-gap[data-q="${q}"]`);
      if (gap) {
        gap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const wrapRect = contentWrap.getBoundingClientRect();
        const gapRect = gap.getBoundingClientRect();
        flagBtn.style.top = (gapRect.top - wrapRect.top + gapRect.height / 2 - 12) + 'px';
        const lcRect = document.getElementById('p7Left').getBoundingClientRect();
        flagBtn.style.left = (lcRect.right - wrapRect.left + 6) + 'px';
        flagBtn.style.right = 'auto';
        flagBtn.classList.add('visible');
        flagBtn.classList.toggle('active', flagged.has(q));
      }
      return;
    }
    if (currentPart === 8) {
      updatePart8State(); refreshFooter();
      const el = document.querySelector(`#p8Right .p5-question[data-q="${q}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    document.querySelectorAll('.gap').forEach(g => {
      g.classList.toggle('current', parseInt(g.dataset.q, 10) === q);
    });
    updateKeywords();
    refreshFooter();
    const gap = document.querySelector(`.gap[data-q="${q}"]`);
    if (gap) {
      gap.scrollIntoView({ behavior: 'smooth', block: 'center' });
      positionFlagBtn(gap);
      if (gap.tagName === 'INPUT') gap.focus();
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
    document.getElementById('instr-text').innerHTML = PARTS[p].instr;
    flagBtn.classList.remove('visible', 'active');
    updateKeywords();
    buildFooter();
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
  window.addEventListener('resize', () => {
    if (currentQ !== null) {
      const gap = document.querySelector(`.gap[data-q="${currentQ}"]`);
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

  // Split-view divider drag
  function setupDivider(dividerId, leftId, rightId) {
    const divider = document.getElementById(dividerId);
    if (!divider) return;
    let dragging = false;
    divider.addEventListener('mousedown', (e) => {
      dragging = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const layout = divider.parentElement;
      const rect = layout.getBoundingClientRect();
      const left = document.getElementById(leftId);
      const right = document.getElementById(rightId);
      let x = e.clientX - rect.left;
      const min = 200;
      const max = rect.width - 200 - 12;
      if (x < min) x = min;
      if (x > max) x = max;
      const leftPct = (x / rect.width) * 100;
      const rightPct = 100 - leftPct - 2;
      left.style.flex = `0 0 ${leftPct}%`;
      right.style.flex = `0 0 ${rightPct}%`;
    });
    document.addEventListener('mouseup', () => {
      if (dragging) {
        dragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
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
    return ['A', 'B', 'C', 'D', 'E'][idx] || '';
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
          if (marks === 1) { your.style.color = '#b37400'; your.style.fontWeight = 'bold'; }
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
  });

  function handleFinish() {
    const total = 56;
    let answered = 0;
    for (let q = 1; q <= 56; q++) if (answers[q] !== undefined && answers[q] !== '') answered++;
    const msg = answered < total
      ? `You have answered ${answered} of ${total} questions. Submit anyway?`
      : 'Submit your answers and see your results?';
    if (!confirm(msg)) return;
    showP4Review();
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
    setupDivider('p5Divider', 'p5Left', 'p5Right');
    setupDivider('p6Divider', 'p6Left', 'p6Right');
    setupDivider('p7Divider', 'p7Left', 'p7Right');
    setupDivider('p8Divider', 'p8Left', 'p8Right');

    buildFooter();
  }

  init();
})();
