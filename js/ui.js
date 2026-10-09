// ============================================================
// Shared page chrome: light/dark theme and the exam countdown.
// Loaded in <head> so the theme is applied before the page paints.
// ============================================================

(function () {
  'use strict';

  // ---------------- Theme ----------------
  var KEY = 'c1-theme';
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function apply(theme) { root.setAttribute('data-theme', theme); }

  apply(stored() || (mq && mq.matches ? 'dark' : 'light'));

  // Follow the system setting until the user picks a theme themselves.
  if (mq && mq.addEventListener) {
    mq.addEventListener('change', function (e) {
      if (!stored()) apply(e.matches ? 'dark' : 'light');
    });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-theme-toggle]') : null;
    if (!btn) return;
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    apply(next);
    try { localStorage.setItem(KEY, next); } catch (err) { /* private mode */ }
  });

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

  window.ExamUI = {
    formatTime: formatTime,

    // Counts down in #timer and calls onExpire once when it reaches 0:00:00.
    // Works from the end time, so a throttled background tab does not drift.
    startTimer: function (seconds, onExpire) {
      var el = document.getElementById('timer');
      var endsAt = Date.now() + seconds * 1000;
      clearInterval(tick);
      function draw() {
        var left = Math.ceil((endsAt - Date.now()) / 1000);
        if (el) {
          el.textContent = formatTime(left);
          el.classList.toggle('low', left <= 300);
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
  };
})();
