// ============================================================
// Shared page chrome, loaded in <head> on every page:
//   - contrast theme and text size (kept between pages)
//   - the Options menu behind the three-bar button
//   - the exam countdown
//   - notes and highlights (started by the test pages via ExamUI.initNotes)
// ============================================================

(function () {
  'use strict';

  var root = document.documentElement;

  function read(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function write(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* private mode */ } }

  // ---------------- Contrast and text size ----------------
  var THEMES = [
    { id: 'light', name: 'Black on white' },
    { id: 'wob', name: 'White on black' },
    { id: 'yob', name: 'Yellow on black' },
  ];
  var SIZES = [
    { id: '', name: 'Regular' },
    { id: 'l', name: 'Large' },
    { id: 'xl', name: 'Extra large' },
  ];

  var theme = read('c1-theme');
  if (theme === 'dark') theme = 'wob';                       // value used by an earlier version
  if (!THEMES.some(function (t) { return t.id === theme; })) theme = 'light';
  var size = read('c1-size') || '';
  if (!SIZES.some(function (s) { return s.id === size; })) size = '';

  function applyTheme(id) { theme = id; root.setAttribute('data-theme', id); write('c1-theme', id); }
  function applySize(id) {
    size = id;
    if (id) root.setAttribute('data-size', id); else root.removeAttribute('data-size');
    write('c1-size', id);
    window.dispatchEvent(new Event('resize'));               // pages re-place what they position by hand
  }
  root.setAttribute('data-theme', theme);
  if (size) root.setAttribute('data-size', size);

  // ---------------- Icons ----------------
  function svg(body, stroke) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" ' +
      (stroke ? 'fill="none" stroke="currentColor" stroke-width="' + stroke + '" stroke-linecap="round" stroke-linejoin="round"' : 'fill="currentColor"') +
      '>' + body + '</svg>';
  }
  var ICON = {
    home: svg('<path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10M10 19.5v-5h4v5"/>', 2),
    contrast: svg('<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3.5a8.5 8.5 0 0 0 0 17Z"/>'),
    zoom: svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21M10.5 7.5v6M7.5 10.5h6"/>', 2),
    eye: svg('<path d="M2.5 12c1-2 4.5-6 9.5-6s8.5 4 9.5 6c-1 2-4.5 6-9.5 6s-8.5-4-9.5-6Z"/><circle cx="12" cy="12" r="3"/>', 2),
    eyeOff: svg('<path d="M3 3l18 18M10.6 6.2A9.7 9.7 0 0 1 12 6c5 0 8.5 4 9.5 6a13 13 0 0 1-2.6 3.3M6.3 7.8A13 13 0 0 0 2.5 12c1 2 4.5 6 9.5 6 1.3 0 2.5-.3 3.6-.7"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>', 2),
    right: svg('<path d="M9 5l7 7-7 7"/>', 3.4),
    left: svg('<path d="M15 5l-7 7 7 7"/>', 3.4),
    close: svg('<path d="M6 6l12 12M18 6 6 18"/>', 3.6),
    tick: svg('<path d="M4.5 12.5 10 18 19.5 7"/>', 3.6),
    note: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M15 0a1 1 0 0 1 1 1v15l-4-3H1a1 1 0 0 1-1-1V1a1 1 0 0 1 1-1h14ZM7 3C5.6 3.1 4 4 4 7v.4A1.5 1.5 0 1 0 5.5 6l-.4.1C5.3 5 5.7 4.4 7 4V3Zm5 0c-1.4.1-3 1-3 4v.4A1.5 1.5 0 1 0 10.5 6l-.4.1C10.3 5 10.7 4.4 12 4V3Z"/></svg>',
    highlight: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M2 15h10M10.5 2v6h2V2M10.5 9v2l1 1 1-1V9"/></svg>',
    trash: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M2.5 4h11M6 4V2h4v2M3.8 4l.9 10h6.6l.9-10"/></svg>',
  };

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  // ---------------- Countdown ----------------
  var tick = null;

  // 5400 -> "1:30:00"
  function formatTime(seconds) {
    var s = Math.max(0, seconds);
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var x = s % 60;
    return h + ':' + (m < 10 ? '0' : '') + m + ':' + (x < 10 ? '0' : '') + x;
  }

  var timerShown = true;
  function setTimerVisible(show) {
    timerShown = show;
    var t = document.getElementById('timer');
    if (t) t.classList.toggle('hidden-by-user', !show);
  }

  var UI = window.ExamUI = {
    formatTime: formatTime,
    leaveMessage: '',          // set by a test page: asked before Options > Main menu leaves it

    // Counts down in #timer and calls onExpire once when it reaches 0:00:00.
    // Works from the end time, so a throttled background tab does not drift.
    startTimer: function (seconds, onExpire) {
      var node = document.getElementById('timer');
      var endsAt = Date.now() + seconds * 1000;
      clearInterval(tick);
      function draw() {
        var left = Math.ceil((endsAt - Date.now()) / 1000);
        if (node) {
          node.textContent = formatTime(left);
          node.classList.toggle('low', left <= 300);
        }
        if (left <= 0) {
          clearInterval(tick);
          tick = null;
          if (onExpire) onExpire();
        }
      }
      draw();
      tick = setInterval(draw, 250);
    },

    stopTimer: function () {
      clearInterval(tick);
      tick = null;
    },

    // Shrinks the footer's own font size, half a pixel at a time, until all its
    // tabs fit. Does nothing when they fit already, which is the normal case.
    fitFooter: function (footer) {
      if (!footer) return;
      footer.style.fontSize = '';
      if (!footer.offsetWidth) return;
      var size = parseFloat(getComputedStyle(footer).fontSize), min = size / 2;
      function tooWide() {
        if (footer.scrollWidth > footer.clientWidth + 1) return true;
        // every tab must hold its texts inside its own side padding
        for (var i = 0; i < footer.children.length; i++) {
          var tab = footer.children[i], cs = getComputedStyle(tab);
          var room = tab.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
          for (var k = 0; k < tab.children.length; k++) {
            if (tab.children[k].offsetWidth > room + 1) return true;
          }
        }
        return false;
      }
      while (size > min && tooWide()) {
        size -= 0.5;
        footer.style.fontSize = size + 'px';
      }
    },

    initNotes: initNotes,
  };

  // ============================================================
  // Options menu
  // ============================================================
  var opts = null, optsBody = null, optsTitle = null, optsBack = null, optsReturn = null;

  function row(labelText, o) {
    var li = el('li');
    var b = el('button', 'opts-row');
    b.type = 'button';
    if (o.checked !== undefined) {
      b.setAttribute('role', 'menuitemradio');
      b.setAttribute('aria-checked', o.checked ? 'true' : 'false');
      b.appendChild(el('span', 'tick', ICON.tick));
    } else if (o.icon) {
      b.appendChild(el('span', 'ico', o.icon));
    }
    var l = el('span', 'lbl');
    l.textContent = labelText;
    b.appendChild(l);
    if (o.after) b.appendChild(o.after);
    if (o.chevron) b.appendChild(el('span', 'chev', ICON.right));
    b.addEventListener('click', o.onClick);
    li.appendChild(b);
    return li;
  }
  function group(rows, cls) {
    var ul = el('ul', 'opts-group' + (cls ? ' ' + cls : ''));
    rows.forEach(function (r) { ul.appendChild(r); });
    return ul;
  }

  var SCREENS = {
    main: function () {
      var out = [];
      var onIndex = /(^|\/)(index\.html)?$/.test(location.pathname);
      if (!onIndex) {
        out.push(group([row('Main menu', {
          icon: ICON.home, chevron: true,
          onClick: function () {
            if (UI.leaveMessage && !window.confirm(UI.leaveMessage)) return;
            location.href = 'index.html';
          },
        })], 'main'));
      }
      out.push(group([
        row('Contrast', { icon: ICON.contrast, chevron: true, onClick: function () { show('contrast'); } }),
        row('Text size', { icon: ICON.zoom, chevron: true, onClick: function () { show('size'); } }),
      ]));
      if (document.getElementById('timer')) {
        out.push(group([row('Hide or show remaining time', { icon: ICON.eyeOff, chevron: true, onClick: function () { show('time'); } })]));
      }
      return { title: 'Options', nodes: out };
    },
    contrast: function () {
      return { title: 'Contrast', nodes: [group(THEMES.map(function (t) {
        var sw = el('span', 'swatch ' + t.id, '<i></i><i></i><i></i>');
        return row(t.name, { checked: t.id === theme, after: sw, onClick: function () { applyTheme(t.id); show('contrast'); } });
      }))] };
    },
    size: function () {
      return { title: 'Text size', nodes: [group(SIZES.map(function (s) {
        return row(s.name, { checked: s.id === size, onClick: function () { applySize(s.id); show('size'); } });
      }))] };
    },
    time: function () {
      return { title: 'Remaining time', nodes: [group([
        row('Show remaining time', { checked: timerShown, onClick: function () { setTimerVisible(true); show('time'); } }),
        row('Hide remaining time', { checked: !timerShown, onClick: function () { setTimerVisible(false); show('time'); } }),
      ])] };
    },
  };

  function buildOptions() {
    opts = el('div', 'opts');
    opts.hidden = true;
    opts.setAttribute('role', 'dialog');
    opts.setAttribute('aria-modal', 'true');
    opts.setAttribute('aria-label', 'Options');
    var head = el('div', 'opts-head');
    optsBack = el('button', 'opts-back', ICON.left + '<span>Options</span>');
    optsBack.type = 'button';
    optsBack.addEventListener('click', function () { show('main'); });
    optsTitle = el('h1', 'opts-title');
    var close = el('button', 'opts-close', ICON.close);
    close.type = 'button';
    close.setAttribute('aria-label', 'Close options');
    close.addEventListener('click', closeOptions);
    head.appendChild(optsBack); head.appendChild(optsTitle); head.appendChild(close);
    optsBody = el('div', 'opts-body');
    opts.appendChild(head); opts.appendChild(optsBody);
    document.body.appendChild(opts);
  }

  function show(name) {
    var s = SCREENS[name]();
    optsTitle.textContent = s.title;
    optsBack.hidden = name === 'main';
    optsBody.textContent = '';
    s.nodes.forEach(function (n) { optsBody.appendChild(n); });
    var first = optsBody.querySelector('[aria-checked="true"]') || optsBody.querySelector('.opts-row');
    if (first) first.focus();
  }
  function openOptions(from) {
    if (!opts) buildOptions();
    optsReturn = from || null;
    opts.hidden = false;
    show('main');
  }
  function closeOptions() {
    if (!opts || opts.hidden) return;
    opts.hidden = true;
    if (optsReturn) optsReturn.focus();
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-options]') : null;
    if (b) openOptions(b);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !opts || opts.hidden) return;
    if (optsBack.hidden) closeOptions(); else show('main');
  });

  // ============================================================
  // Notes and highlights
  //
  // ExamUI.initNotes({
  //   scope:  element whose text may be marked (texts and questions),
  //   skip:   extra CSS selector for things inside it that may not,
  //   where:  () => ({ part, label })  the part on screen and its question range, e.g. "1–8",
  //   goTo:   (part, mark) => void     shows that part (and the marked text) again when a note card is clicked,
  // })
  //
  // A highlight is one or more <span class="anno" data-anno="id"> around the
  // selected text. Marking text that is already marked nests a span inside the
  // old one, and the style sheet paints a nested span pink: that is the overlap.
  // Nothing is stored: a reload starts clean.
  // ============================================================
  function initNotes(cfg) {
    var scope = cfg.scope;
    if (!scope) return;
    var SKIP = 'input, textarea, select, option, button, [draggable="true"], .gap, .popup, .keyword-list, .p7-gap, ' +
               '.lis-slot, .lis-gap-wrap, .results-screen' + (cfg.skip ? ', ' + cfg.skip : '');
    var INLINE_PARENTS = /^(P|SPAN|LABEL|EM|STRONG|B|I|LI|TD|H1|H2|H3|H4|DIV)$/;
    var annos = {};            // id -> { id, type, part, label, quote, text }
    var seq = 0;

    // ---- panel ----
    var panel = el('aside', 'notes');
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Notes');
    var head = el('div', 'notes-head');
    var title = el('div', 'notes-title'); title.textContent = 'Notes';
    var eye = el('button', '', ICON.eye); eye.type = 'button';
    eye.setAttribute('aria-pressed', 'false');
    eye.title = 'Hide notes and highlights in the text';
    eye.setAttribute('aria-label', eye.title);
    var close = el('button', '', ICON.close); close.type = 'button';
    close.setAttribute('aria-label', 'Hide notes');
    head.appendChild(title); head.appendChild(eye); head.appendChild(close);
    var list = el('ul', 'notes-list');
    var empty = el('div', 'notes-empty', '<b>Your private notes will show here</b>Select text to create notes and highlights');
    list.appendChild(empty);
    panel.appendChild(head); panel.appendChild(list);
    document.body.appendChild(panel);

    var toggles = document.querySelectorAll('[data-notes]');
    function setPanel(open) {
      panel.hidden = !open;
      document.body.classList.toggle('notes-open', open);
      Array.prototype.forEach.call(toggles, function (b) {
        b.setAttribute('aria-expanded', open ? 'true' : 'false');
        b.setAttribute('aria-label', open ? 'Hide notes' : 'Show notes');
      });
      window.dispatchEvent(new Event('resize'));
    }
    Array.prototype.forEach.call(toggles, function (b) {
      b.addEventListener('click', function () { setPanel(panel.hidden); });
    });
    close.addEventListener('click', function () { setPanel(false); });
    eye.addEventListener('click', function () {
      var hide = !document.body.classList.contains('anno-hidden');
      document.body.classList.toggle('anno-hidden', hide);
      eye.setAttribute('aria-pressed', hide ? 'true' : 'false');
      eye.innerHTML = hide ? ICON.eyeOff : ICON.eye;        // crossed-out eye while hidden
      eye.title = (hide ? 'Show' : 'Hide') + ' notes and highlights in the text';
      eye.setAttribute('aria-label', eye.title);
      hideAdder();
    });

    // ---- bubble ----
    var adder = el('div', 'adder');
    adder.hidden = true;
    document.body.appendChild(adder);
    var adderFor = null;       // id of the highlight the Delete bubble belongs to

    function adderButton(icon, text, onClick) {
      var b = el('button', '', icon + '<span></span>');
      b.type = 'button';
      b.lastChild.textContent = text;
      b.addEventListener('mousedown', function (e) { e.preventDefault(); });   // keep the selection
      b.addEventListener('click', onClick);
      return b;
    }
    function placeAdder(rect) {
      adder.hidden = false;
      adder.style.animation = 'none'; void adder.offsetWidth; adder.style.animation = '';
      var w = adder.offsetWidth;
      var x = rect.left + rect.width / 2 - w / 2 + window.scrollX;
      x = Math.max(4 + window.scrollX, Math.min(window.scrollX + document.documentElement.clientWidth - w - 4, x));
      adder.style.left = x + 'px';
      adder.style.top = (rect.bottom + window.scrollY + 8) + 'px';
    }
    function hideAdder() { adder.hidden = true; adderFor = null; }

    // ---- text nodes of a range that may be marked ----
    function allowed(node) {
      var p = node.parentElement;
      // only text that is on screen: other parts and other questions are in the page too, hidden
      return !!p && scope.contains(p) && !p.closest(SKIP) && p.getClientRects().length > 0;
    }
    function pieces(range) {
      var out = [];
      var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      var sc = range.startContainer, so = range.startOffset, ec = range.endContainer, eo = range.endOffset;
      while (walker.nextNode()) {
        var n = walker.currentNode;
        if (!range.intersectsNode(n) || !allowed(n)) continue;
        var s = n === sc ? so : 0, e = n === ec ? eo : n.nodeValue.length;
        if (s >= e) continue;
        var part = n.nodeValue.slice(s, e);
        if (!part.trim()) {
          // white space is marked only between words, never between blocks
          var par = n.parentElement;
          if (!INLINE_PARENTS.test(par.tagName) || /flex|grid/.test(getComputedStyle(par).display)) continue;
          if (!n.previousSibling || !n.nextSibling) continue;
        }
        out.push({ node: n, start: s, end: e });
      }
      return out;
    }
    function currentRange() {
      var sel = window.getSelection();
      if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
      var r = sel.getRangeAt(0);
      if (!sel.toString().trim()) return null;
      return pieces(r).length ? r : null;
    }

    function mark(range, type) {
      var parts = pieces(range);
      if (!parts.length) return null;
      var id = 'a' + (++seq);
      var quote = '';
      parts.forEach(function (p) {
        var r = document.createRange();
        r.setStart(p.node, p.start); r.setEnd(p.node, p.end);
        var span = el('span', 'anno' + (type === 'note' ? ' note' : ''));
        span.setAttribute('data-anno', id);
        r.surroundContents(span);
        quote += span.textContent;
      });
      quote = quote.replace(/\s+/g, ' ').replace(/ ([,.;:!?])/g, '$1').trim();
      if (quote.length > 60) quote = quote.slice(0, 57).trim() + '…';
      var w = cfg.where ? cfg.where() : {};
      annos[id] = { id: id, type: type, part: w.part, label: w.label || '', quote: quote, text: '' };
      window.getSelection().removeAllRanges();
      return annos[id];
    }
    function marksOf(id) { return scope.querySelectorAll('.anno[data-anno="' + id + '"]'); }
    function remove(id) {
      Array.prototype.forEach.call(marksOf(id), function (m) {
        var p = m.parentNode;
        while (m.firstChild) p.insertBefore(m.firstChild, m);
        p.removeChild(m);
        p.normalize();
      });
      var card = list.querySelector('.note-card[data-anno="' + id + '"]');
      if (card) card.remove();
      delete annos[id];
      empty.hidden = !!list.querySelector('.note-card');
      hideAdder();
    }

    // ---- note cards ----
    function focusNote(id, viaCard) {
      var a = annos[id];
      if (!a) return;
      Array.prototype.forEach.call(list.querySelectorAll('.note-card.focused'), function (c) { c.classList.remove('focused'); });
      Array.prototype.forEach.call(scope.querySelectorAll('.anno.focused'), function (m) { m.classList.remove('focused'); });
      var card = list.querySelector('.note-card[data-anno="' + id + '"]');
      if (card) { card.classList.add('focused'); card.scrollIntoView({ block: 'nearest' }); }
      var marks = marksOf(id);
      if (viaCard && cfg.goTo && a.part !== undefined) cfg.goTo(a.part, marks[0] || null);
      Array.prototype.forEach.call(marks, function (m) { m.classList.add('focused'); });
      if (viaCard && marks[0]) marks[0].scrollIntoView({ block: 'center' });
    }
    function addCard(a) {
      var card = el('li', 'note-card');
      card.setAttribute('data-anno', a.id);
      var top = el('div');
      var where = el('span', 'where'); where.textContent = a.label;
      var quote = el('span', 'quote'); quote.textContent = a.quote;
      top.appendChild(where); top.appendChild(quote);
      var ta = el('textarea');
      ta.rows = 2;
      ta.placeholder = 'Start typing your note';
      ta.setAttribute('aria-label', 'Note');
      ta.addEventListener('input', function () {
        a.text = ta.value;
        ta.style.height = 'auto';
        ta.style.height = (ta.scrollHeight + 2) + 'px';
      });
      ta.addEventListener('focus', function () { focusNote(a.id, false); });
      var del = el('button', 'del'); del.type = 'button'; del.textContent = 'Delete';
      del.addEventListener('click', function (e) { e.stopPropagation(); remove(a.id); });
      card.appendChild(top); card.appendChild(ta); card.appendChild(del);
      card.addEventListener('click', function (e) {
        if (e.target === ta || e.target === del) return;
        focusNote(a.id, true);
      });
      list.appendChild(card);
      empty.hidden = true;
      return ta;
    }

    // ---- events ----
    function offerNew() {
      if (document.body.classList.contains('anno-hidden')) return hideAdder();
      var r = currentRange();
      if (!r) { if (!adderFor) hideAdder(); return; }
      adderFor = null;
      adder.textContent = '';
      adder.appendChild(adderButton(ICON.note, 'Note', function () {
        var range = currentRange();
        var a = range && mark(range, 'note');
        hideAdder();
        if (!a) return;
        setPanel(true);
        var ta = addCard(a);
        focusNote(a.id, false);
        ta.focus();
      }));
      adder.appendChild(adderButton(ICON.highlight, 'Highlight', function () {
        var range = currentRange();
        if (range) mark(range, 'hl');
        hideAdder();
      }));
      var rects = r.getClientRects();
      placeAdder(rects.length ? rects[rects.length - 1] : r.getBoundingClientRect());
    }
    document.addEventListener('mouseup', function (e) {
      if (adder.contains(e.target)) return;
      setTimeout(offerNew, 0);
    });
    document.addEventListener('keyup', function (e) {
      if (e.key === 'Shift' || e.shiftKey) setTimeout(offerNew, 0);
    });
    document.addEventListener('touchend', function (e) {       // touch screens: the selection settles a moment later
      if (adder.contains(e.target)) return;
      setTimeout(offerNew, 250);
    });
    document.addEventListener('mousedown', function (e) {
      if (!adder.hidden && !adder.contains(e.target)) hideAdder();
    });
    document.addEventListener('scroll', function () { if (!adder.hidden) hideAdder(); }, true);

    // Dragging across an answer option (or double-clicking a word in it) selects
    // text; that click must not also choose the answer.
    document.addEventListener('click', function (e) {
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
      if (!scope.contains(e.target) || !scope.contains(sel.anchorNode)) return;
      if (e.target.closest('input, textarea, select, button')) return;
      e.preventDefault();
      e.stopPropagation();
    }, true);

    // Capture phase: the questions stop their clicks from bubbling.
    scope.addEventListener('click', function (e) {
      var m = e.target.closest ? e.target.closest('.anno') : null;
      if (!m || document.body.classList.contains('anno-hidden')) return;
      var sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      var a = annos[m.getAttribute('data-anno')];
      if (!a) return;
      if (a.type === 'note') { setPanel(true); focusNote(a.id, false); return; }
      adder.textContent = '';
      adder.appendChild(adderButton(ICON.trash, 'Delete\nHighlight', function () { remove(a.id); }));
      adderFor = a.id;
      placeAdder(m.getBoundingClientRect());
    }, true);
  }
})();
