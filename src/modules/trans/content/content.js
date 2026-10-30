(function pageTranslatorContent() {
  'use strict';

  const HOST_ID = 'page-translator-root';
  const STYLE_ID = 'page-translator-motion';
  const PENDING_CLASS = 'pt-page-translator-pending';
  const PENDING_LIVE_CLASS = 'pt-page-translator-pending-live';
  const FADE_CLASS = 'pt-page-translator-fade';
  const REVEAL_CLASS = 'pt-page-translator-reveal';
  const HOLD_CLASS = 'pt-page-translator-hold';
  const SWEEP_CLASS = 'pt-page-translator-sweep';
  const WIPER_CLASS = 'pt-page-translator-wiper';
  const MAX_LIVE_PENDING = 8;
  const WIPER_MS = 680;
  const SOFT_MS = 220;
  const MOTION_CSS = [
    '@property --pt-p { syntax: "<number>"; inherits: true; initial-value: 0; }',
    `.${PENDING_CLASS} { text-shadow: 0 0 0.28em rgba(56, 189, 248, 0.16); }`,
    `.${PENDING_LIVE_CLASS} { animation: pt-prism-glow 1.6s ease-in-out infinite; }`,
    '@keyframes pt-prism-glow {',
    '0%, 100% { text-shadow: 0 0 0.32em rgba(56, 189, 248, 0.16); }',
    '50% { text-shadow: 0 0 0.4em rgba(244, 114, 182, 0.2), 0 0 0.22em rgba(250, 204, 21, 0.12); }',
    '}',
    `.${FADE_CLASS}, .${REVEAL_CLASS} { animation: none; }`,
    `.${HOLD_CLASS} { -webkit-text-fill-color: transparent; }`,
    `.${WIPER_CLASS} { position: fixed; left: 0; top: 0; width: 100vw; height: 0; pointer-events: none; z-index: 2147483645; }`,
    `.${WIPER_CLASS} .pt-wiper-line {`,
    'position: absolute; left: 0; width: 100vw; height: 2px; margin: 0; pointer-events: none;',
    'transform: translate3d(0, 0, 0);',
    'background: linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.55), rgba(167, 139, 250, 0.7), rgba(244, 114, 182, 0.55), rgba(250, 204, 21, 0.45), transparent);',
    '}',
    `.${SWEEP_CLASS} {`,
    'position: fixed; margin: 0; padding: 0; overflow: hidden; pointer-events: none; z-index: 2147483644; background: transparent;',
    '}',
    `.${SWEEP_CLASS} .pt-prev, .${SWEEP_CLASS} .pt-next {`,
    'position: absolute; inset: 0; margin: 0; padding: 0; white-space: pre; overflow: hidden;',
    '}',
    `.${SWEEP_CLASS} .pt-next { clip-path: inset(0 calc((1 - var(--pt-p)) * 100%) 0 0); }`,
    `.${SWEEP_CLASS} .pt-prev { clip-path: inset(0 0 0 calc(var(--pt-p) * 100%)); }`,
    `.${SWEEP_CLASS}.pt-sweep-rtl .pt-next { clip-path: inset(0 0 0 calc((1 - var(--pt-p)) * 100%)); }`,
    `.${SWEEP_CLASS}.pt-sweep-rtl .pt-prev { clip-path: inset(0 calc(var(--pt-p) * 100%) 0 0); }`,
    '@media (prefers-reduced-motion: reduce) {',
    `.${PENDING_CLASS}, .${PENDING_LIVE_CLASS} { animation: none; text-shadow: 0 0 0.22em rgba(56, 189, 248, 0.18); }`,
    '}',
  ].join('');
  const MAX_ITEMS = 24;
  const MAX_CHARS = 4000;
  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA', 'INPUT', 'SELECT',
    'OPTION', 'OPTGROUP', 'KBD', 'SAMP', 'TEMPLATE', 'SVG', 'MATH', 'CANVAS',
    'IFRAME', 'OBJECT', 'EMBED', 'HEAD', 'TITLE', 'META', 'LINK', 'VAR',
    'NOFRAMES', 'XMP', 'PLAINTEXT',
  ]);

  function splitWhitespace(value) {
    const match = String(value ?? '').match(/^(\s*)([\s\S]*?)(\s*)$/);
    return { lead: match[1], core: match[2], trail: match[3] };
  }

  function isTranslatable(core) {
    if (!core || core.length > 20000) return false;
    return /\p{L}/u.test(core);
  }

  function isSkipElement(element) {
    if (!element || element.nodeType !== 1) return false;
    if (element.id === HOST_ID || element.id === STYLE_ID) return true;
    if (classHas(element, SWEEP_CLASS) || classHas(element, WIPER_CLASS) || classHas(element, 'pt-page-translator-probe')) return true;
    const tag = String(element.tagName || '').toUpperCase();
    if (SKIP_TAGS.has(tag)) return true;
    const editable = element.contentEditable;
    if (editable === 'true' || editable === 'plaintext-only') return true;
    if ((editable == null || editable === '') && element.isContentEditable) return true;
    if (typeof element.getAttribute === 'function' && element.getAttribute('translate') === 'no') return true;
    return false;
  }

  function shouldSkipText(node) {
    let element = node.parentElement;
    while (element) {
      if (isSkipElement(element)) return true;
      element = element.parentElement;
    }
    return false;
  }

  function defaultIsNearViewport(element) {
    if (!element || typeof element.getBoundingClientRect !== 'function') return false;
    const rect = element.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return false;
    const height = globalThis.innerHeight || 800;
    const width = globalThis.innerWidth || 1200;
    const margin = Math.max(height * 1.5, 600);
    return rect.bottom >= -margin
      && rect.top <= height + margin
      && rect.right >= -margin
      && rect.left <= width + margin;
  }

  function connected(node) {
    if (typeof node.isConnected === 'boolean') return node.isConnected;
    return true;
  }

  function classHas(element, name) {
    if (!element) return false;
    if (element.classList && element.classList.contains(name)) return true;
    const className = element.className;
    return typeof className === 'string' && className.split(/\s+/).includes(name);
  }

  function clamp01(value) {
    const n = Number(value);
    if (!(n > 0)) return 0;
    if (n > 1) return 1;
    return n;
  }

  function easeInOut(value) {
    const t = clamp01(value);
    return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
  }

  // One vertical pass. `at` is the moment the line reaches the box center.
  // lineStart sits before the first box so progress is 0 at t = 0, and
  // lineEnd sits after the last box so progress is 1 at t = 1.
  function planWiperOrder(nodes, direction) {
    const dir = direction === 'up' ? 'up' : 'down';
    const boxes = [];
    for (const node of nodes || []) {
      const top = Number(node.top) || 0;
      const height = Math.max(Number(node.height) || 0, 1);
      boxes.push({ id: node.id, top, height, mid: top + height / 2 });
    }
    if (!boxes.length) {
      return {
        direction: dir,
        from: 0,
        to: 0,
        span: 1,
        anchorMin: 0,
        anchorMax: 1,
        lineStart: 0,
        lineEnd: 1,
        order: [],
      };
    }
    let anchorMin = boxes[0].top;
    let anchorMax = boxes[0].top + boxes[0].height;
    for (const box of boxes) {
      if (box.top < anchorMin) anchorMin = box.top;
      const bottom = box.top + box.height;
      if (bottom > anchorMax) anchorMax = bottom;
    }
    const span = Math.max(anchorMax - anchorMin, 1);
    const order = boxes.map((box) => {
      const band = Math.min(1, Math.max(box.height / span, 0.04));
      const at = dir === 'up' ? (anchorMax - box.mid) / span : (box.mid - anchorMin) / span;
      return { id: box.id, at: clamp01(at), band, top: box.top, height: box.height };
    });
    order.sort((a, b) => a.at - b.at || String(a.id).localeCompare(String(b.id)));
    let lead = 0.04;
    let tail = 0;
    for (const item of order) {
      lead = Math.max(lead, item.band / 2);
      tail = Math.max(tail, item.at + item.band / 2);
    }
    return {
      direction: dir,
      from: dir === 'up' ? anchorMax : anchorMin,
      to: dir === 'up' ? anchorMin : anchorMax,
      span,
      anchorMin,
      anchorMax,
      lineStart: -lead,
      lineEnd: Math.max(tail, lead),
      order,
    };
  }

  function crossProgress(line, at, band) {
    const width = Math.max(Number(band) || 0, 0.04);
    const start = Number(at) - width / 2;
    return clamp01((Number(line) - start) / width);
  }

  function wiperSpot(plan, top, height) {
    const safeHeight = Math.max(Number(height) || 0, 1);
    const mid = (Number(top) || 0) + safeHeight / 2;
    const span = plan && plan.span ? plan.span : 1;
    const at = plan && plan.direction === 'up'
      ? ((plan.anchorMax || 0) - mid) / span
      : (mid - ((plan && plan.anchorMin) || 0)) / span;
    return {
      at: clamp01(at),
      band: Math.min(1, Math.max(safeHeight / span, 0.04)),
    };
  }

  function lineSample(plan, elapsed, duration) {
    const t = clamp01(elapsed / (duration || 1));
    const eased = easeInOut(t);
    return {
      t,
      eased,
      line: plan.lineStart + (plan.lineEnd - plan.lineStart) * eased,
      y: plan.from + (plan.to - plan.from) * eased,
    };
  }

  function createSession(options) {
    const root = options.root;
    const walkRoot = options.walkRoot || root;
    const sendBatch = options.sendBatch;
    const onStatus = options.onStatus || function () {};
    const isNearViewport = options.isNearViewport || defaultIsNearViewport;
    const setTimer = options.setTimer || function (fn, ms) { return setTimeout(fn, ms); };
    const clearTimer = options.clearTimer || clearTimeout;
    const enableBanner = options.enableBanner !== false && typeof document !== 'undefined';
    let prioritizeCursor = Boolean(options.prioritizeCursor);
    let revealAnimation = options.revealAnimation !== false;

    const queue = [];
    const records = new Map();
    const meta = new WeakMap();
    const pendingByElement = new Map();
    const queued = new Set();
    const done = new Set();
    const expectedWrite = new WeakMap();
    const visibility = new WeakMap();

    let started = false;
    let enabled = false;
    let showOriginal = false;
    let pointer = null;
    let rectEpoch = 0;
    let error = null;
    let model = null;
    let pausedForError = false;
    let pumping = false;
    let scheduled = false;
    let rerun = false;
    let idle = Promise.resolve();
    let bannerHost = null;
    let bannerMessage = null;
    let dismissedError = '';
    let scrollTimer = null;
    const rectCache = new WeakMap();
    const pendingCounts = new WeakMap();
    const decorated = new Set();
    const effectToken = new WeakMap();
    const livePending = new Set();
    const activeJobs = new Set();
    const revealWait = [];
    let wiper = null;
    let soft = null;
    let sweepEpoch = 0;
    let revealFrame = 0;
    let scrollBound = false;
    let mutationLock = 0;

    const IntersectionObserverCtor = options.IntersectionObserver || globalThis.IntersectionObserver;
    const MutationObserverCtor = options.MutationObserver || globalThis.MutationObserver;
    let intersectionObserver = null;
    if (typeof IntersectionObserverCtor === 'function') {
      intersectionObserver = new IntersectionObserverCtor(onIntersect, {
        root: null,
        rootMargin: '150% 0px 150% 0px',
        threshold: 0,
      });
    }
    let mutationObserver = null;
    if (typeof MutationObserverCtor === 'function') {
      mutationObserver = new MutationObserverCtor(onMutations);
    }

    function getStatus() {
      return {
        started,
        enabled,
        showOriginal,
        done: records.size,
        pending: queue.length,
        pumping,
        error,
        model,
      };
    }

    function notify() {
      const status = getStatus();
      renderBanner(status);
      try {
        onStatus(status);
      } catch {
        // The badge update is optional.
      }
    }

    function ensureBanner() {
      if (!enableBanner || (bannerHost && bannerHost.isConnected !== false)) return;
      const host = document.createElement('div');
      host.id = HOST_ID;
      host.setAttribute('translate', 'no');
      host.style.position = 'fixed';
      host.style.zIndex = '2147483646';
      host.style.right = '16px';
      host.style.bottom = '16px';
      host.style.width = 'max-content';
      host.style.maxWidth = 'min(280px, calc(100vw - 24px))';
      const shadow = host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = [
        ':host { all: initial; }',
        '.toast { display: flex; gap: 8px; align-items: flex-start; box-sizing: border-box;',
        'font: 12px/1.4 system-ui, sans-serif; color: #7f1d1d; background: #fff;',
        'border: 1px solid #fecaca; border-radius: 10px; padding: 8px 10px;',
        'box-shadow: 0 4px 14px rgba(0,0,0,.12); max-width: 280px; }',
        '.msg { white-space: pre-wrap; }',
        'button { all: initial; font: 12px/1 system-ui, sans-serif; cursor: pointer;',
        'color: #7f1d1d; padding: 2px; }',
      ].join('');
      const box = document.createElement('div');
      box.className = 'toast';
      box.setAttribute('role', 'status');
      const message = document.createElement('div');
      message.className = 'msg';
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = '닫기';
      button.addEventListener('click', () => {
        dismissedError = message.textContent || dismissedError;
        host.hidden = true;
        host.style.display = 'none';
      });
      box.append(message, button);
      shadow.append(style, box);
      (document.documentElement || document.body).appendChild(host);
      bannerHost = host;
      bannerMessage = message;
    }

    function renderBanner(status) {
      if (!enableBanner) return;
      const text = status.error || '';
      if (!text || text === dismissedError) {
        if (bannerHost) { bannerHost.hidden = true; bannerHost.style.display = 'none'; }
        return;
      }
      ensureBanner();
      if (!bannerHost) return;
      bannerMessage.textContent = text;
      bannerHost.hidden = false;
      bannerHost.style.display = '';
    }

    function ensureMotionStyle() {
      if (typeof document === 'undefined' || !document.getElementById || !document.createElement) return;
      if (document.getElementById(STYLE_ID)) return;
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = MOTION_CSS;
      (document.documentElement || document.head || document.body).appendChild(style);
    }

    function canDecorate(element) {
      if (!element || !element.classList) return false;
      if (element.id === HOST_ID || element.id === STYLE_ID) return false;
      const tag = String(element.tagName || '').toUpperCase();
      return tag !== 'BODY' && tag !== 'HTML' && tag !== 'HEAD';
    }

    function motionReduced() {
      if (options.prefersReducedMotion === true) return true;
      if (options.prefersReducedMotion === false) return false;
      try {
        return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch {
        return false;
      }
    }

    function markPending(element) {
      if (!revealAnimation || !canDecorate(element)) return;
      ensureMotionStyle();
      const count = pendingCounts.get(element) || 0;
      pendingCounts.set(element, count + 1);
      decorated.add(element);
      effectToken.set(element, {});
      element.classList.remove(FADE_CLASS);
      element.classList.remove(REVEAL_CLASS);
      element.classList.add(PENDING_CLASS);
      if (livePending.size < MAX_LIVE_PENDING) {
        element.classList.add(PENDING_LIVE_CLASS);
        livePending.add(element);
      }
    }

    function promoteLivePending() {
      if (livePending.size >= MAX_LIVE_PENDING) return;
      for (const element of decorated) {
        if (livePending.size >= MAX_LIVE_PENDING) break;
        if (!pendingCounts.has(element) || livePending.has(element) || !element.classList) continue;
        element.classList.add(PENDING_LIVE_CLASS);
        livePending.add(element);
      }
    }

    function scheduleEffectClear(element) {
      const token = {};
      effectToken.set(element, token);
      setTimer(() => {
        if (effectToken.get(element) !== token || pendingCounts.has(element)) return;
        if (element.classList) {
          element.classList.remove(FADE_CLASS);
          element.classList.remove(REVEAL_CLASS);
        }
        decorated.delete(element);
      }, 700);
    }

    function clearPending(element, effect) {
      if (!element || !pendingCounts.has(element)) return;
      const next = pendingCounts.get(element) - 1;
      if (next > 0) {
        pendingCounts.set(element, next);
        return;
      }
      pendingCounts.delete(element);
      decorated.delete(element);
      if (!element.classList) return;
      element.classList.remove(PENDING_CLASS);
      element.classList.remove(PENDING_LIVE_CLASS);
      livePending.delete(element);
      promoteLivePending();
      if (effect !== 'fade' && effect !== 'reveal') return;
      element.classList.add(effect === 'fade' ? FADE_CLASS : REVEAL_CLASS);
      decorated.add(element);
      scheduleEffectClear(element);
    }

    function readDirection(element) {
      try {
        if (typeof getComputedStyle === 'function') {
          const computed = getComputedStyle(element);
          if (computed && computed.direction === 'rtl') return 'rtl';
        }
      } catch {
        // The sweep still runs left to right when direction cannot be read.
      }
      if (element && element.dir === 'rtl') return 'rtl';
      if (element && typeof element.getAttribute === 'function' && element.getAttribute('dir') === 'rtl') return 'rtl';
      return 'ltr';
    }

    function computedStyle(element) {
      try {
        return typeof getComputedStyle === 'function' ? getComputedStyle(element) : null;
      } catch {
        return null;
      }
    }

    function nowMs() {
      if (typeof options.now === 'function') return options.now();
      if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
      return Date.now();
    }

    function requestFrame(fn) {
      const raf = options.requestAnimationFrame || globalThis.requestAnimationFrame;
      if (typeof raf === 'function') return raf(fn);
      return setTimer(() => fn(nowMs()), 16);
    }

    function lockMutations(fn) {
      mutationLock += 1;
      try {
        return fn();
      } finally {
        mutationLock -= 1;
      }
    }

    function isOwnNode(node) {
      if (!node || node.nodeType !== 1) return false;
      if (node.id === HOST_ID || node.id === STYLE_ID) return true;
      return classHas(node, SWEEP_CLASS) || classHas(node, WIPER_CLASS);
    }

    function canAnimate() {
      return Boolean(revealAnimation)
        && !motionReduced()
        && typeof document !== 'undefined'
        && typeof document.createElement === 'function';
    }

    function canHold(element) {
      if (!element || !element.classList || !element.childNodes) return false;
      for (const child of element.childNodes) {
        if (child.nodeType === 1) return false;
      }
      return true;
    }

    function normalizeRect(rect) {
      if (!rect) return null;
      const width = Number(rect.width) || 0;
      const height = Number(rect.height) || 0;
      if (width <= 0 && height <= 0) return null;
      return {
        left: Number(rect.left) || 0,
        top: Number(rect.top) || 0,
        width: Math.max(width, 1),
        height: Math.max(height, 1),
      };
    }

    // One layout read per text node. Glyph binary-search reflowed the page
    // between every write, which is what made cells flicker on a dense list.
    function readRect(node) {
      if (typeof options.measureRect === 'function') {
        const measured = normalizeRect(options.measureRect(node));
        if (measured) return measured;
      }
      try {
        if (typeof document !== 'undefined' && typeof document.createRange === 'function') {
          const range = document.createRange();
          const length = String(node && node.nodeValue || '').length;
          if (typeof range.selectNodeContents === 'function') range.selectNodeContents(node);
          else if (length && typeof range.setStart === 'function') {
            range.setStart(node, 0);
            range.setEnd(node, length);
          }
          const rect = typeof range.getBoundingClientRect === 'function'
            ? range.getBoundingClientRect()
            : null;
          const normalized = normalizeRect(rect);
          if (normalized) return normalized;
        }
      } catch {
        // Fall through to the parent box.
      }
      const element = node && node.parentElement;
      if (element && typeof element.getBoundingClientRect === 'function') {
        return normalizeRect(element.getBoundingClientRect());
      }
      return null;
    }

    function setCssVar(node, name, value) {
      if (!node || !node.style) return;
      if (typeof node.style.setProperty === 'function') node.style.setProperty(name, value);
      else node.style[name] = value;
    }

    function placeBox(node, rect) {
      if (!node || !node.style || !rect) return;
      node.style.position = 'fixed';
      node.style.left = `${rect.left}px`;
      node.style.top = `${rect.top}px`;
      node.style.width = `${Math.max(1, rect.width)}px`;
      node.style.height = `${Math.max(1, rect.height)}px`;
    }

    function copyTextStyle(node, computed, rtl) {
      if (!node || !node.style || !computed) return;
      node.style.font = computed.font || '';
      node.style.letterSpacing = computed.letterSpacing || '';
      node.style.color = computed.color || '';
      node.style.lineHeight = computed.lineHeight || '';
      if (rtl) node.style.direction = 'rtl';
    }

    function appendText(node, value) {
      const text = String(value ?? '');
      if (typeof document !== 'undefined' && typeof document.createTextNode === 'function') {
        node.appendChild(document.createTextNode(text));
      } else {
        node.textContent = text;
      }
    }

    function mountNode(node) {
      const parent = document.documentElement || document.body;
      if (parent && parent.appendChild) parent.appendChild(node);
    }

    function removeNode(node) {
      if (!node) return;
      if (node.parentNode && node.parentNode.removeChild) node.parentNode.removeChild(node);
      else if (typeof node.remove === 'function') node.remove();
    }

    function bindSweepScroll() {
      if (scrollBound || typeof document === 'undefined' || !document.addEventListener) return;
      scrollBound = true;
      document.addEventListener('scroll', repositionSweeps, true);
      if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('resize', repositionSweeps);
    }

    function repositionSweeps() {
      if (!activeJobs.size) return;
      requestFrame(() => {
        const rows = [];
        for (const job of activeJobs) {
          if (!job.box || !connected(job.node)) continue;
          rows.push({ job, rect: readRect(job.node) });
        }
        for (const row of rows) {
          if (row.rect) placeBox(row.job.box, row.rect);
        }
      });
    }

    function setProgress(job, value) {
      const next = Math.round(clamp01(value) * 1000) / 1000;
      if (job.shown === next) return;
      job.shown = next;
      setCssVar(job.box, '--pt-p', String(next));
      if (!job.box || !job.box.style) return;
      job.box.style.willChange = next > 0 && next < 1 ? 'clip-path' : '';
    }

    function paintBox(row, spot) {
      const job = row.job;
      try {
        ensureMotionStyle();
        const box = document.createElement('div');
        box.className = row.rtl ? `${SWEEP_CLASS} pt-sweep-rtl` : SWEEP_CLASS;
        box.setAttribute('translate', 'no');
        placeBox(box, row.rect);
        copyTextStyle(box, row.style, row.rtl);
        const prev = document.createElement('div');
        prev.className = 'pt-prev';
        const next = document.createElement('div');
        next.className = 'pt-next';
        copyTextStyle(prev, row.style, row.rtl);
        copyTextStyle(next, row.style, row.rtl);
        appendText(prev, job.original);
        appendText(next, job.translated);
        box.appendChild(prev);
        box.appendChild(next);
        mountNode(box);
        if (row.hold) job.element.classList.add(HOLD_CLASS);
        clearPending(job.element, 'reveal');
        const painted = {
          node: job.node,
          element: job.element,
          target: job.target,
          original: job.original,
          translated: job.translated,
          box,
          at: spot.at,
          band: spot.band,
          epoch: job.epoch,
          shown: null,
          settled: false,
        };
        activeJobs.add(painted);
        return painted;
      } catch {
        writeNode(job.node, job.target);
        clearPending(job.element, false);
        if (job.element && job.element.classList) job.element.classList.remove(HOLD_CLASS);
        return null;
      }
    }

    function releaseJob(job, commit) {
      if (!job || job.settled) return;
      job.settled = true;
      activeJobs.delete(job);
      if (commit && job.epoch === sweepEpoch && connected(job.node)) {
        const current = job.node.nodeValue;
        const known = current === job.original
          || current === job.translated
          || expectedWrite.get(job.node) === current;
        if (known) writeNode(job.node, job.target);
      }
      if (job.element && job.element.classList) {
        job.element.classList.remove(HOLD_CLASS);
        job.element.classList.remove(REVEAL_CLASS);
        if (!pendingCounts.has(job.element)) decorated.delete(job.element);
      }
      removeNode(job.box);
    }

    // nodeValue changes only after the clip finishes, in one write batch.
    // Doing it as the overlay is removed keeps the longer translation from
    // reflowing icon labels while the line is still moving.
    function finishPass(pass, commit) {
      if (!pass || pass.settled) return;
      pass.settled = true;
      if (pass.doneTimer != null) clearTimer(pass.doneTimer);
      lockMutations(() => {
        for (const job of pass.jobs || []) releaseJob(job, commit);
        if (pass.line && pass.line.style) pass.line.style.willChange = '';
        removeNode(pass.host);
      });
    }

    function makeWiperHost() {
      ensureMotionStyle();
      const host = document.createElement('div');
      host.className = WIPER_CLASS;
      host.setAttribute('translate', 'no');
      const line = document.createElement('div');
      line.className = 'pt-wiper-line';
      if (line.style) line.style.willChange = 'transform';
      host.appendChild(line);
      mountNode(host);
      bindSweepScroll();
      return { host, line };
    }

    function placeLine(pass, eased) {
      if (!pass.line || !pass.line.style || !pass.plan) return;
      const y = pass.plan.from + (pass.plan.to - pass.plan.from) * eased;
      pass.line.style.transform = `translate3d(0, ${y}px, 0)`;
    }

    function shownProgress(pass, job, line) {
      const crossed = crossProgress(line, job.at, job.band);
      return pass.reverse ? 1 - crossed : crossed;
    }

    function startClock(pass, duration, step) {
      pass.startedAt = nowMs();
      pass.raf = requestFrame(step);
      pass.doneTimer = setTimer(() => step(pass.startedAt + duration), duration);
    }

    function beginWiper(rows) {
      const direction = showOriginal ? 'up' : 'down';
      const plan = planWiperOrder(rows.map((row, index) => ({
        id: index,
        top: row.rect.top,
        height: row.rect.height,
      })), direction);
      const byId = new Map(plan.order.map((item) => [item.id, item]));
      const chrome = makeWiperHost();
      const jobs = [];
      for (let index = 0; index < rows.length; index += 1) {
        const painted = paintBox(rows[index], byId.get(index));
        if (painted) jobs.push(painted);
      }
      if (!jobs.length) {
        removeNode(chrome.host);
        return;
      }
      const pass = {
        epoch: sweepEpoch,
        host: chrome.host,
        line: chrome.line,
        jobs,
        plan,
        reverse: direction === 'up',
        settled: false,
      };
      wiper = pass;
      for (const job of jobs) setProgress(job, pass.reverse ? 1 : 0);
      placeLine(pass, 0);
      const step = (time) => {
        if (pass.settled || pass.epoch !== sweepEpoch || wiper !== pass) return;
        const sample = lineSample(pass.plan, time - pass.startedAt, WIPER_MS);
        placeLine(pass, sample.eased);
        for (const job of pass.jobs) {
          if (!job.settled) setProgress(job, shownProgress(pass, job, sample.line));
        }
        if (sample.t < 1) pass.raf = requestFrame(step);
        else {
          if (wiper === pass) wiper = null;
          finishPass(pass, true);
        }
      };
      startClock(pass, WIPER_MS, step);
    }

    function beginSoft(rows) {
      const jobs = [];
      for (const row of rows) {
        const painted = paintBox(row, { at: 0, band: 1 });
        if (painted) jobs.push(painted);
      }
      if (!jobs.length) return;
      if (soft && !soft.settled && soft.epoch === sweepEpoch) {
        const shown = soft.reverse ? 1 - (soft.shown || 0) : (soft.shown || 0);
        for (const job of jobs) {
          setProgress(job, shown);
          soft.jobs.push(job);
        }
        return;
      }
      const pass = {
        epoch: sweepEpoch,
        jobs,
        reverse: showOriginal,
        shown: 0,
        settled: false,
      };
      soft = pass;
      for (const job of jobs) setProgress(job, pass.reverse ? 1 : 0);
      const step = (time) => {
        if (pass.settled || pass.epoch !== sweepEpoch || soft !== pass) return;
        const sample = lineSample({ lineStart: 0, lineEnd: 1, from: 0, to: 1 }, time - pass.startedAt, SOFT_MS);
        pass.shown = sample.eased;
        for (const job of pass.jobs) {
          if (!job.settled) setProgress(job, pass.reverse ? 1 - sample.eased : sample.eased);
        }
        if (sample.t < 1) pass.raf = requestFrame(step);
        else {
          if (soft === pass) soft = null;
          finishPass(pass, true);
        }
      };
      startClock(pass, SOFT_MS, step);
    }

    function adoptIntoWiper(rows) {
      const sample = lineSample(wiper.plan, nowMs() - wiper.startedAt, WIPER_MS);
      const late = [];
      for (const row of rows) {
        const spot = wiperSpot(wiper.plan, row.rect.top, row.rect.height);
        if (crossProgress(sample.line, spot.at, spot.band) >= 1) {
          late.push(row);
          continue;
        }
        const painted = paintBox(row, spot);
        if (!painted) continue;
        setProgress(painted, shownProgress(wiper, painted, sample.line));
        wiper.jobs.push(painted);
      }
      if (late.length) beginSoft(late);
    }

    function paintMeasured(measured) {
      const ready = [];
      for (const row of measured) {
        if (!row.rect || row.job.epoch !== sweepEpoch || !connected(row.job.node)) {
          if (row.job.epoch === sweepEpoch && connected(row.job.node)) {
            writeNode(row.job.node, row.job.target);
          }
          clearPending(row.job.element, false);
          continue;
        }
        ready.push(row);
      }
      if (!ready.length) return;
      if (wiper && !wiper.settled && wiper.epoch === sweepEpoch) adoptIntoWiper(ready);
      else beginWiper(ready);
    }

    function drainReveal() {
      const batch = revealWait.splice(0);
      if (!batch.length) return;
      const measured = [];
      for (const job of batch) {
        measured.push({
          job,
          rect: readRect(job.node),
          rtl: readDirection(job.element) === 'rtl',
          style: computedStyle(job.element),
          hold: canHold(job.element),
        });
      }
      lockMutations(() => paintMeasured(measured));
    }

    function scheduleReveal() {
      if (revealFrame) return;
      const run = () => {
        revealFrame = 0;
        drainReveal();
      };
      const raf = options.requestAnimationFrame || globalThis.requestAnimationFrame;
      if (typeof raf === 'function') {
        revealFrame = raf(run) || 1;
        return;
      }
      revealFrame = 1;
      run();
    }

    function queueReveal(job) {
      if (!canAnimate() || !canDecorate(job.element)) return false;
      if (job.target == null) job.target = showOriginal ? job.original : job.translated;
      job.epoch = sweepEpoch;
      revealWait.push(job);
      scheduleReveal();
      return true;
    }

    function cancelMotion() {
      sweepEpoch += 1;
      revealWait.length = 0;
      const frame = revealFrame;
      revealFrame = 0;
      const currentWiper = wiper;
      const currentSoft = soft;
      wiper = null;
      soft = null;
      finishPass(currentWiper, false);
      finishPass(currentSoft, false);
      if (frame && typeof options.cancelAnimationFrame === 'function') {
        try { options.cancelAnimationFrame(frame); } catch { /* already run */ }
      }
    }

    function clearBatchMarks(batch) {
      for (const item of batch) clearPending(item.node && item.node.parentElement, false);
    }

    function clearAllDecorations() {
      cancelMotion();
      livePending.clear();
      for (const element of decorated) {
        pendingCounts.delete(element);
        effectToken.delete(element);
        if (element.classList) {
          element.classList.remove(PENDING_CLASS);
          element.classList.remove(PENDING_LIVE_CLASS);
          element.classList.remove(FADE_CLASS);
          element.classList.remove(REVEAL_CLASS);
          element.classList.remove(HOLD_CLASS);
        }
      }
      decorated.clear();
    }

    function invalidateRects() {
      rectEpoch += 1;
    }

    function anchorPoint(node) {
      const element = node && node.parentElement;
      if (!element || typeof element.getBoundingClientRect !== 'function') return null;
      const cached = rectCache.get(element);
      if (cached && cached.epoch === rectEpoch) return cached;
      const rect = element.getBoundingClientRect();
      const point = {
        epoch: rectEpoch,
        cx: rect.left + (rect.width || 0) / 2,
        cy: rect.top + (rect.height || 0) / 2,
      };
      rectCache.set(element, point);
      return point;
    }

    function sortQueue() {
      if (!prioritizeCursor || !pointer || queue.length < 2) return;
      const ranked = queue.map((item, index) => {
        const point = anchorPoint(item.node);
        let distance = Number.POSITIVE_INFINITY;
        if (point) {
          const dx = point.cx - pointer.x;
          const dy = point.cy - pointer.y;
          distance = dx * dx + dy * dy;
        }
        return { item, index, distance };
      });
      ranked.sort((a, b) => a.distance - b.distance || a.index - b.index);
      queue.splice(0, queue.length, ...ranked.map((row) => row.item));
    }

    function writeNode(node, value) {
      expectedWrite.set(node, value);
      if (node.nodeValue !== value) node.nodeValue = value;
    }

    function nodeBusy(node) {
      for (const job of activeJobs) {
        if (job.node === node && !job.settled) return true;
      }
      return false;
    }

    function applyRecords() {
      const jobs = [];
      for (const [node, record] of records) {
        if (!connected(node) || nodeBusy(node)) continue;
        const target = showOriginal ? record.original : record.translated;
        if (node.nodeValue === target) continue;
        jobs.push({
          node,
          element: node.parentElement,
          original: record.original,
          translated: record.translated,
          target,
        });
      }
      if (!jobs.length) return;
      if (!canAnimate()) {
        lockMutations(() => {
          for (const job of jobs) writeNode(job.node, job.target);
        });
        return;
      }
      for (const job of jobs) {
        if (!queueReveal(job)) writeNode(job.node, job.target);
      }
    }

    function enqueue(node) {
      if (done.has(node) || queued.has(node) || !connected(node)) return;
      const info = meta.get(node);
      if (!info) return;
      queued.add(node);
      queue.push({ node, core: info.core, original: info.original });
      scheduleFlush();
    }

    function considerText(node) {
      if (!node || node.nodeType !== 3 || done.has(node) || queued.has(node)) return;
      if (shouldSkipText(node)) return;
      const original = String(node.nodeValue ?? '');
      const parts = splitWhitespace(original);
      if (!isTranslatable(parts.core)) return;
      const parent = node.parentElement;
      if (!parent || parent.nodeType !== 1 || isSkipElement(parent)) return;
      meta.set(node, { core: parts.core, original });
      let bucket = pendingByElement.get(parent);
      if (!bucket) {
        bucket = new Set();
        pendingByElement.set(parent, bucket);
        if (intersectionObserver) intersectionObserver.observe(parent);
      }
      bucket.add(node);
      if (visibility.get(parent) === true || (visibility.get(parent) !== false && isNearViewport(parent))) {
        enqueue(node);
      }
    }

    function walk(node) {
      if (!node || !node.childNodes) return;
      const children = [...node.childNodes];
      for (const child of children) {
        if (child.nodeType === 3) considerText(child);
        else if (child.nodeType === 1) {
          if (isSkipElement(child)) continue;
          if (child.shadowRoot) walk(child.shadowRoot);
          walk(child);
        } else if (child.nodeType === 11) {
          walk(child);
        }
      }
    }

    function forgetNode(node) {
      done.delete(node);
      queued.delete(node);
      meta.delete(node);
      records.delete(node);
      expectedWrite.delete(node);
      for (let index = queue.length - 1; index >= 0; index -= 1) {
        if (queue[index].node === node) queue.splice(index, 1);
      }
      const parent = node.parentElement;
      const bucket = parent && pendingByElement.get(parent);
      if (bucket) bucket.delete(node);
    }

    function onIntersect(entries) {
      for (const entry of entries) {
        visibility.set(entry.target, Boolean(entry.isIntersecting));
        if (!entry.isIntersecting) continue;
        const bucket = pendingByElement.get(entry.target);
        if (!bucket) continue;
        for (const node of bucket) enqueue(node);
      }
    }

    function onCharacterData(node) {
      if (!node || node.nodeType !== 3) return;
      if (expectedWrite.get(node) === node.nodeValue) return;
      if (shouldSkipText(node)) return;
      forgetNode(node);
      considerText(node);
    }

    function onMutations(mutations) {
      // Deliveries are async, so a lock around our write is not enough on its
      // own. Overlay nodes are skipped by class; our nodeValue writes match expectedWrite.
      if (!started || mutationLock > 0) return;
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          if (isOwnNode(mutation.target && mutation.target.parentElement)) continue;
          onCharacterData(mutation.target);
          continue;
        }
        if (mutation.type !== 'childList' || isOwnNode(mutation.target)) continue;
        for (const node of mutation.addedNodes || []) {
          if (isOwnNode(node)) continue;
          if (node.nodeType === 3) considerText(node);
          else if (node.nodeType === 1 && !isSkipElement(node)) walk(node);
          else if (node.nodeType === 11) walk(node);
        }
      }
    }

    function recheck() {
      for (const [element, bucket] of pendingByElement) {
        if (visibility.get(element) === false) continue;
        if (visibility.get(element) === true || isNearViewport(element)) {
          for (const node of bucket) enqueue(node);
        }
      }
    }

    function onScroll() {
      invalidateRects();
      if (scrollTimer != null) return;
      scrollTimer = setTimer(() => {
        scrollTimer = null;
        if (prioritizeCursor) sortQueue();
        recheck();
      }, 150);
    }

    function takeBatch() {
      if (prioritizeCursor) sortQueue();
      const batch = [];
      let chars = 0;
      while (queue.length) {
        const size = queue[0].core.length;
        if (batch.length >= MAX_ITEMS) break;
        if (batch.length > 0 && chars + size > MAX_CHARS) break;
        const item = queue.shift();
        batch.push(item);
        chars += size;
        if (size > MAX_CHARS) break;
      }
      return batch;
    }

    function fail(message) {
      pausedForError = true;
      error = message || '번역에 실패했어요.';
      notify();
    }

    function scheduleFlush() {
      if (!started || !enabled || pausedForError) return;
      if (pumping) {
        rerun = true;
        return;
      }
      if (scheduled) return;
      scheduled = true;
      idle = idle.then(() => flush()).catch(() => {});
    }

    async function flush() {
      scheduled = false;
      if (pumping || pausedForError || !started || !enabled) return;
      pumping = true;
      notify();
      try {
        while (queue.length && started && enabled && !pausedForError) {
          const batch = takeBatch();
          if (!batch.length) break;
          for (const item of batch) markPending(item.node && item.node.parentElement);
          let response;
          try {
            response = await sendBatch(batch.map((item) => item.core));
          } catch (sendError) {
            clearBatchMarks(batch);
            queue.unshift(...batch);
            fail(sendError?.message || '확장 프로그램과 연결이 끊겼어요. 페이지를 새로고침한 뒤 다시 시도해 주세요.');
            break;
          }
          if (!response?.ok || !Array.isArray(response.translations) || response.translations.length !== batch.length) {
            clearBatchMarks(batch);
            queue.unshift(...batch);
            fail(response?.message || '번역 결과를 해석하지 못했어요.');
            break;
          }
          if (response.model) model = response.model;
          batch.forEach((item, index) => {
            queued.delete(item.node);
            const parent = item.node && item.node.parentElement;
            if (!connected(item.node)) {
              clearPending(parent, false);
              return;
            }
            const current = item.node.nodeValue;
            const pageChanged = current !== item.original && expectedWrite.get(item.node) !== current;
            if (pageChanged) {
              clearPending(parent, false);
              forgetNode(item.node);
              considerText(item.node);
              return;
            }
            const parts = splitWhitespace(item.original);
            const translated = `${parts.lead}${response.translations[index]}${parts.trail}`;
            records.set(item.node, {
              original: item.original,
              translated,
              core: item.core,
            });
            done.add(item.node);
            const showTranslation = enabled && !showOriginal;
            if (!showTranslation) {
              clearPending(parent, false);
            } else if (motionReduced()) {
              writeNode(item.node, translated);
              clearPending(parent, 'fade');
            } else if (!queueReveal({
              node: item.node,
              element: parent,
              original: item.original,
              translated,
            })) {
              writeNode(item.node, translated);
              clearPending(parent, false);
            }
          });
          error = null;
          notify();
        }
      } finally {
        pumping = false;
        if ((rerun || queue.length) && started && enabled && !pausedForError) {
          rerun = false;
          scheduleFlush();
        } else {
          notify();
        }
      }
    }

    function start() {
      const first = !started;
      started = true;
      enabled = true;
      pausedForError = false;
      error = null;
      model = null;
      showOriginal = false;
      dismissedError = '';
      if (first && mutationObserver && root) {
        mutationObserver.observe(root, { childList: true, subtree: true, characterData: true });
        if (typeof options.onBindScroll === 'function') options.onBindScroll(onScroll);
      }
      if (walkRoot) walk(walkRoot);
      applyRecords();
      scheduleFlush();
      notify();
    }

    function setEnabled(value) {
      if (value) {
        if (!started) {
          start();
          return getStatus();
        }
        const wasOff = !enabled || showOriginal;
        enabled = true;
        showOriginal = false;
        pausedForError = false;
        error = null;
        dismissedError = '';
        if (wasOff) clearAllDecorations();
        applyRecords();
        if (walkRoot) walk(walkRoot);
        if (prioritizeCursor) sortQueue();
        scheduleFlush();
        notify();
        return getStatus();
      }
      enabled = false;
      showOriginal = true;
      clearAllDecorations();
      applyRecords();
      notify();
      return getStatus();
    }

    function setPrefs(prefs) {
      const next = prefs || {};
      prioritizeCursor = Boolean(next.prioritizeCursor);
      if (Object.prototype.hasOwnProperty.call(next, 'revealAnimation')) {
        const enabledMotion = next.revealAnimation !== false;
        if (revealAnimation && !enabledMotion) {
          clearAllDecorations();
          revealAnimation = false;
          applyRecords();
        } else {
          revealAnimation = enabledMotion;
        }
      }
      if (prioritizeCursor) sortQueue();
    }

    function notePointer(x, y) {
      pointer = { x: Number(x) || 0, y: Number(y) || 0 };
      if (prioritizeCursor && enabled) sortQueue();
    }

    function setShowOriginal(value) {
      if (!started) return getStatus();
      const next = Boolean(value);
      if (next === showOriginal) {
        notify();
        return getStatus();
      }
      showOriginal = next;
      clearAllDecorations();
      applyRecords();
      notify();
      return getStatus();
    }

    function toggleOriginal() {
      return setShowOriginal(!showOriginal);
    }

    async function whenIdle() {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await idle;
        await Promise.resolve();
        if (!scheduled && !pumping && !rerun && (pausedForError || queue.length === 0)) {
          return getStatus();
        }
      }
      return getStatus();
    }

    return {
      start,
      setEnabled,
      setPrefs,
      notePointer,
      setShowOriginal,
      toggleOriginal,
      getStatus,
      recheck,
      whenIdle,
      emitMutations: onMutations,
    };
  }

  const ns = globalThis.__pageTranslator || (globalThis.__pageTranslator = {});
  ns.createSession = createSession;
  ns.splitWhitespace = splitWhitespace;
  ns.isTranslatable = isTranslatable;
  ns.shouldSkipText = shouldSkipText;
  ns.planWiperOrder = planWiperOrder;
  ns.crossProgress = crossProgress;
  ns.wiperSpot = wiperSpot;
  ns.easeInOut = easeInOut;
  ns.lineSample = lineSample;
  ns.WIPER_MS = WIPER_MS;
  ns.SOFT_MS = SOFT_MS;

  function install() {
    const session = createSession({
      root: document.documentElement,
      walkRoot: document.body || document.documentElement,
      sendBatch(texts) {
        return chrome.runtime.sendMessage({ type: 'TRANSLATE_BATCH', texts });
      },
      onStatus(status) {
        let top = true;
        try {
          top = window.top === window;
        } catch {
          top = false;
        }
        if (!top) return;
        chrome.runtime.sendMessage({ type: 'PROGRESS', status }).catch(() => {});
      },
      onBindScroll(handler) {
        document.addEventListener('scroll', handler, true);
        window.addEventListener('resize', handler);
      },
    });
    let pointerTimer = null;
    let latestPointer = null;
    document.addEventListener('mousemove', (event) => {
      latestPointer = { x: event.clientX, y: event.clientY };
      if (pointerTimer != null) return;
      pointerTimer = setTimeout(() => {
        pointerTimer = null;
        const point = latestPointer;
        latestPointer = null;
        if (point) session.notePointer(point.x, point.y);
      }, 150);
    }, { passive: true });
    let topFrame = true;
    try {
      topFrame = window.top === window;
    } catch {
      topFrame = false;
    }
    if (topFrame) {
      window.addEventListener('pagehide', () => {
        chrome.runtime.sendMessage({ type: 'CLEAR_BADGE' }).catch(() => {});
      });
    }
    ns.session = session;
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || typeof message !== 'object') return;
      if (message.type === 'START_TRANSLATE') {
        session.start();
        sendResponse(session.getStatus());
        return;
      }
      if (message.type === 'SET_ORIGINAL') {
        sendResponse(session.setShowOriginal(Boolean(message.showOriginal)));
        return;
      }
      if (message.type === 'TOGGLE_ORIGINAL') {
        sendResponse(session.toggleOriginal());
        return;
      }
      if (message.type === 'GET_STATUS') {
        sendResponse(session.getStatus());
        return;
      }
      if (message.type === 'SET_PREFS') {
        session.setPrefs(message.prefs || {});
      }
    });
    chrome.runtime.sendMessage({ type: 'GET_PREFS' }).then((prefs) => {
      if (prefs) session.setPrefs(prefs);
    }).catch(() => {});
  }

  if (ns.installed) return;
  if (globalThis.chrome?.runtime?.onMessage) {
    ns.installed = true;
    install();
  }
}());
