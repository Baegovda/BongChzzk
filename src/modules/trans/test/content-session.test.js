import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

function loadContent(extras = {}) {
  const sandbox = { console, setTimeout, clearTimeout, ...extras };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(new URL('../content/content.js', import.meta.url), 'utf8'), sandbox, {
    filename: 'content.js',
  });
  return sandbox.__pageTranslator;
}

function textNode(value) {
  return { nodeType: 3, nodeValue: value, parentElement: null, isConnected: true };
}

function element(tag, props = {}, children = []) {
  const node = {
    nodeType: 1,
    tagName: String(tag).toUpperCase(),
    id: props.id || '',
    isContentEditable: Boolean(props.editable),
    parentElement: null,
    childNodes: [],
    shadowRoot: null,
    isConnected: true,
    attrs: props.attrs || {},
    rect: props.rect || { top: 20, bottom: 40, left: 0, right: 120, width: 120, height: 20 },
    getAttribute(name) { return this.attrs[name] ?? null; },
    getBoundingClientRect() { return this.rect; },
    classList: {
      add(name) { node.classList._set.add(name); },
      remove(name) { node.classList._set.delete(name); },
      contains(name) { return node.classList._set.has(name); },
      _set: new Set(),
    },
    append(child) {
      const next = typeof child === 'string' ? textNode(child) : child;
      next.parentElement = node;
      node.childNodes.push(next);
      return next;
    },
  };
  for (const child of children) node.append(child);
  return node;
}

test('session translates visible text, skips hidden controls, and restores originals', async () => {
  const api = loadContent();
  const script = element('script', {}, ['var hidden = "包邮";']);
  const style = element('style', {}, ['body { content: "颜色"; }']);
  const code = element('code', {}, ['SKU-颜色']);
  const field = element('textarea', {}, ['尺码']);
  const input = element('input', {}, ['颜色']);
  const locked = element('div', { attrs: { translate: 'no' } }, ['不要翻译']);
  const editor = element('div', { editable: true }, ['编辑']);
  const visible = element('a', {}, ['  包邮\n']);
  const plainNumber = element('span', {}, [' 42 ']);
  const far = element('li', { rect: { top: 9000, bottom: 9040, left: 0, right: 100, width: 100, height: 40 } }, ['颜色分类']);
  const shadowText = element('span', {}, ['官方旗舰店']);
  const host = element('div');
  host.shadowRoot = { nodeType: 11, childNodes: [], parentElement: null };
  shadowText.parentElement = host.shadowRoot;
  host.shadowRoot.childNodes.push(shadowText);

  const root = element('div', {}, []);
  for (const child of [script, style, code, field, input, locked, editor, visible, plainNumber, far, host]) {
    root.append(child);
  }

  let observer;
  class FakeIO {
    constructor(callback) {
      this.callback = callback;
      this.observed = [];
      observer = this;
    }
    observe(target) { this.observed.push(target); }
    unobserve() {}
    disconnect() {}
  }

  const sent = [];
  const session = api.createSession({
    root,
    walkRoot: root,
    enableBanner: false,
    IntersectionObserver: FakeIO,
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    sendBatch: async (texts) => {
      sent.push(texts);
      if (texts.includes('颜色分类') && !sent.some((batch, index) => index < sent.length - 1 && batch.includes('颜色分类'))) {
        return { ok: false, message: 'Gemini API 속도 제한(429)입니다.' };
      }
      return {
        ok: true,
        translations: texts.map((text) => ({
          包邮: '무료배송',
          官方旗舰店: '공식 플래그십 스토어',
          颜色分类: '색상 분류',
        }[text] || text)),
      };
    },
  });

  session.start();
  await session.whenIdle();
  const batches = sent.map((batch) => [...batch]);
  assert.deepEqual(batches, [['包邮', '官方旗舰店']]);
  assert.equal(visible.childNodes[0].nodeValue, '  무료배송\n');
  assert.equal(shadowText.childNodes[0].nodeValue, '공식 플래그십 스토어');
  assert.equal(script.childNodes[0].nodeValue, 'var hidden = "包邮";');
  assert.equal(code.childNodes[0].nodeValue, 'SKU-颜色');
  assert.equal(far.childNodes[0].nodeValue, '颜色分类');

  session.setShowOriginal(true);
  assert.equal(visible.childNodes[0].nodeValue, '  包邮\n');
  session.setShowOriginal(false);
  assert.equal(visible.childNodes[0].nodeValue, '  무료배송\n');

  session.emitMutations([{
    type: 'characterData',
    target: visible.childNodes[0],
  }]);
  await session.whenIdle();
  assert.equal(sent.length, 1);

  const added = element('p', {}, ['新款']);
  root.append(added);
  session.emitMutations([{ type: 'childList', addedNodes: [added] }]);
  await session.whenIdle();
  assert.deepEqual([...sent[1]], ['新款']);
  assert.equal(added.childNodes[0].nodeValue, '新款');

  observer.callback([{ target: far, isIntersecting: true }]);
  await session.whenIdle();
  assert.equal(session.getStatus().error, 'Gemini API 속도 제한(429)입니다.');
  assert.equal(far.childNodes[0].nodeValue, '颜色分类');

  session.start();
  await session.whenIdle();
  assert.equal(far.childNodes[0].nodeValue, '색상 분류');
  assert.equal(session.getStatus().error, null);
});

function fakeDocument() {
  const hosts = [];
  return {
    hosts,
    documentElement: {
      appendChild(node) {
        hosts.push(node);
        node.isConnected = true;
      },
    },
    createElement() {
      const node = {
        id: '',
        hidden: false,
        style: {},
        textContent: '',
        isConnected: false,
        children: [],
        setAttribute() {},
        append(...kids) { this.children.push(...kids); },
        appendChild(child) { this.children.push(child); return child; },
        addEventListener(_type, fn) { this.onclick = fn; },
        attachShadow() {
          const shadow = { append(...kids) { shadow.children = kids; } };
          node.shadow = shadow;
          return shadow;
        },
      };
      return node;
    },
  };
}

test('the page shows an error toast only, not a success banner', async () => {
  const document = fakeDocument();
  const api = loadContent({ document });
  const root = element('div', {}, []);
  const visible = element('a', {}, ['包邮']);
  root.append(visible);
  const session = api.createSession({
    root,
    walkRoot: root,
    IntersectionObserver: class {
      constructor(callback) { this.callback = callback; }
      observe() {}
      disconnect() {}
    },
    MutationObserver: class { observe() {} disconnect() {} },
    sendBatch: async () => ({ ok: false, message: '모델이 혼잡합니다. API 키 문제가 아닙니다.' }),
  });
  session.start();
  await session.whenIdle();
  assert.equal(document.hosts.length, 1);
  const host = document.hosts[0];
  assert.equal(host.style.bottom, '16px');
  assert.equal(host.style.top, undefined);
  const message = host.shadow.children[1].children[0];
  assert.equal(message.textContent, '모델이 혼잡합니다. API 키 문제가 아닙니다.');
  assert.equal(JSON.stringify(host).includes('문장을 번역했습니다'), false);

  host.shadow.children[1].children[1].onclick();
  assert.equal(host.hidden, true);
  session.setShowOriginal(true);
  assert.equal(host.hidden, true);
  assert.equal(visible.classList.contains('pt-page-translator-pending'), false);
});

function quietSession(root, hooks = {}) {
  const api = loadContent();
  const sent = [];
  let release = () => {};
  let held = false;
  const session = api.createSession({
    root,
    walkRoot: root,
    enableBanner: false,
    prioritizeCursor: hooks.prioritizeCursor,
    revealAnimation: hooks.revealAnimation,
    prefersReducedMotion: hooks.prefersReducedMotion,
    setTimer: hooks.setTimer,
    clearTimer: hooks.clearTimer,
    IntersectionObserver: class {
      constructor(callback) { this.callback = callback; }
      observe() {}
      disconnect() {}
    },
    MutationObserver: class { observe() {} disconnect() {} },
    sendBatch(texts) {
      sent.push(texts);
      const result = {
        ok: true,
        translations: texts.map((text) => `T:${text}`),
        model: 'gemini-3.5-flash-lite',
      };
      if (hooks.hold && !held) {
        held = true;
        return new Promise((resolve) => {
          release = () => resolve(result);
        });
      }
      return result;
    },
  });
  return { session, sent, release: () => release() };
}

async function until(check) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (check()) return;
    await Promise.resolve();
  }
  assert.equal(check(), true);
}

test('in-flight text glows, then a prism sweep reveals the translation', async () => {
  const source = readFileSync(new URL('../content/content.js', import.meta.url), 'utf8');
  assert.match(source, /prefers-reduced-motion:\s*reduce/);
  assert.match(source, /pt-page-translator-pending/);
  assert.match(source, /pt-prism-glow/);
  assert.match(source, /@property --pt-p/);
  assert.match(source, /clip-path: inset\(0 calc\(\(1 - var\(--pt-p\)\) \* 100%\) 0 0\)/);
  assert.match(source, /translate3d/);
  assert.match(source, /pt-sweep-rtl/);
  assert.match(source, /MAX_LIVE_PENDING = 8/);
  assert.match(source, /pt-page-translator-pending-live/);
  assert.match(source, /pt-page-translator-hold/);
  assert.doesNotMatch(source, /display:\s*none/);
  assert.doesNotMatch(source, /visibility:\s*hidden/);
  assert.doesNotMatch(source, /pt-scan-ltr/);
  assert.doesNotMatch(source, /background-size: 45% 2px/);

  const root = element('div');
  const visible = element('a', {}, ['包邮']);
  root.append(visible);
  const { session, sent, release } = quietSession(root, { hold: true });
  session.start();
  await until(() => sent.length === 1);
  assert.equal(visible.classList.contains('pt-page-translator-pending'), true);
  release();
  await session.whenIdle();
  assert.equal(visible.classList.contains('pt-page-translator-pending'), false);
  assert.equal(visible.classList.contains('pt-page-translator-reveal'), false);
  assert.equal(visible.classList.contains('pt-page-translator-fade'), false);
  assert.equal(visible.childNodes[0].nodeValue, 'T:包邮');

  const reducedRoot = element('div');
  const reduced = element('a', {}, ['包邮']);
  reducedRoot.append(reduced);
  const reducedSession = quietSession(reducedRoot, { hold: true, prefersReducedMotion: true });
  reducedSession.session.start();
  await until(() => reducedSession.sent.length === 1);
  reducedSession.release();
  await reducedSession.session.whenIdle();
  assert.equal(reduced.classList.contains('pt-page-translator-fade'), true);
  assert.equal(reduced.classList.contains('pt-page-translator-reveal'), false);
  assert.equal(reduced.childNodes[0].nodeValue, 'T:包邮');

  const plainRoot = element('div');
  const plain = element('a', {}, ['包邮']);
  plainRoot.append(plain);
  const plainSession = quietSession(plainRoot, { hold: true, revealAnimation: false });
  plainSession.session.start();
  await until(() => plainSession.sent.length === 1);
  assert.equal(plain.classList.contains('pt-page-translator-pending'), false);
  plainSession.release();
  await plainSession.session.whenIdle();
  assert.equal(plain.classList.contains('pt-page-translator-reveal'), false);
  assert.equal(plain.classList.contains('pt-page-translator-fade'), false);
  assert.equal(plain.childNodes[0].nodeValue, 'T:包邮');

  const failedRoot = element('div');
  const failed = element('span', {}, ['颜色']);
  failedRoot.append(failed);
  const failedSession = loadContent().createSession({
    root: failedRoot,
    walkRoot: failedRoot,
    enableBanner: false,
    IntersectionObserver: class { observe() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    sendBatch: async () => ({ ok: false, message: '오류' }),
  });
  failedSession.start();
  await failedSession.whenIdle();
  assert.equal(failed.classList.contains('pt-page-translator-pending'), false);
  assert.equal(failed.classList.contains('pt-page-translator-fade'), false);
  assert.equal(failed.classList.contains('pt-page-translator-reveal'), false);
  assert.equal(failed.childNodes[0].nodeValue, '颜色');
});

function revealDocument(created) {
  return {
    getElementById() { return { id: 'page-translator-motion' }; },
    createElement() {
      const node = {
        id: '',
        className: '',
        textContent: '',
        style: {},
        children: [],
        setAttribute() {},
        appendChild(child) { this.children.push(child); return child; },
        append(...kids) { this.children.push(...kids); },
      };
      created.push(node);
      return node;
    },
    createTextNode(value) { return { nodeType: 3, nodeValue: value }; },
    documentElement: { appendChild() {} },
  };
}

test('wiper order follows the line and finishes every box on one clock', () => {
  const api = loadContent();
  const nodes = [
    { id: 'low', top: 200, height: 20 },
    { id: 'high', top: 10, height: 20 },
    { id: 'mid', top: 80, height: 20 },
  ];
  const down = api.planWiperOrder(nodes, 'down');
  assert.deepEqual([...down.order.map((item) => item.id)], ['high', 'mid', 'low']);
  assert.equal(down.from < down.to, true);
  const up = api.planWiperOrder(nodes, 'up');
  assert.deepEqual([...up.order.map((item) => item.id)], ['low', 'mid', 'high']);
  assert.equal(up.from > up.to, true);

  const passed = (plan, line) => [...plan.order
    .filter((item) => api.crossProgress(line, item.at, item.band) >= 1)
    .map((item) => item.id)];
  assert.deepEqual(passed(down, down.lineStart), []);
  assert.deepEqual(passed(down, down.order[1].at), ['high']);
  assert.deepEqual(passed(down, down.lineEnd), ['high', 'mid', 'low']);
  for (const item of down.order) {
    assert.equal(api.crossProgress(down.lineStart, item.at, item.band), 0);
    assert.equal(api.crossProgress(down.lineEnd, item.at, item.band), 1);
  }
  const start = api.lineSample(down, 0, api.WIPER_MS);
  const end = api.lineSample(down, api.WIPER_MS, api.WIPER_MS);
  assert.equal(start.t, 0);
  assert.equal(end.t, 1);
  assert.equal(end.y, down.to);
});

test('the page wiper keeps original text until the pass ends, then commits together', async () => {
  const created = [];
  const timers = [];
  const frames = [];
  let clock = 0;
  const reads = [];
  const api = loadContent({
    document: revealDocument(created),
    getComputedStyle() {
      return {
        direction: 'rtl',
        font: '16px sans-serif',
        lineHeight: '20px',
        letterSpacing: 'normal',
        color: 'black',
        backgroundColor: 'rgb(18, 18, 18)',
      };
    },
  });
  const root = element('div');
  const nodes = [];
  for (let index = 0; index < 10; index += 1) {
    const node = element('span', {
      rect: { top: index * 30, bottom: index * 30 + 18, left: 4, right: 40, width: 36, height: 18 },
    }, [`글${index}`]);
    root.append(node);
    nodes.push(node);
  }
  const session = api.createSession({
    root,
    walkRoot: root,
    enableBanner: false,
    prefersReducedMotion: false,
    now: () => clock,
    requestAnimationFrame(fn) {
      frames.push(fn);
      return frames.length;
    },
    measureRect(node) {
      reads.push(node.nodeValue);
      return node.parentElement.getBoundingClientRect();
    },
    setTimer(fn, ms) { timers.push({ fn, ms }); return timers.length; },
    clearTimer() {},
    IntersectionObserver: class { observe() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    sendBatch: async (texts) => ({ ok: true, translations: texts.map((text) => `더긴번역${text}`) }),
  });
  session.start();
  await until(() => frames.length === 1);
  for (const node of nodes) assert.match(node.childNodes[0].nodeValue, /^글/);
  assert.equal(nodes[0].classList.contains('pt-page-translator-pending'), true);
  const live = nodes.filter((node) => node.classList.contains('pt-page-translator-pending-live'));
  assert.equal(live.length, 8);

  frames.shift()(clock);
  assert.equal(reads.length, 10);
  assert.ok(created.some((node) => String(node.className).includes('pt-page-translator-sweep')));
  const sweeps = created.filter((node) => String(node.className).includes('pt-page-translator-sweep'));
  assert.equal(sweeps.length, 10);
  assert.match(sweeps[0].className, /pt-sweep-rtl/);
  assert.equal(sweeps[0].children.length, 2);
  assert.equal(sweeps[0].children[0].children[0].nodeValue, '글0');
  assert.match(sweeps[0].children[1].children[0].nodeValue, /더긴번역/);
  assert.equal(sweeps[0].style.top, '0px');
  assert.equal(sweeps[0].style.width, '36px');
  assert.equal(nodes[0].classList.contains('pt-page-translator-hold'), true);
  assert.equal(nodes[0].classList.contains('pt-page-translator-pending'), false);
  for (const node of nodes) assert.match(node.childNodes[0].nodeValue, /^글/);
  const line = created.find((node) => String(node.className).includes('pt-wiper-line'));
  assert.equal(line.style.willChange, 'transform');
  assert.match(line.style.transform, /translate3d/);

  clock = api.WIPER_MS / 2;
  frames.shift()(clock);
  const topP = Number(sweeps[0].style['--pt-p']);
  const bottomP = Number(sweeps[9].style['--pt-p']);
  assert.equal(topP > bottomP, true);
  assert.equal(bottomP, 0);
  for (const node of nodes) assert.match(node.childNodes[0].nodeValue, /^글/);

  const sweepNode = sweeps[0];
  session.emitMutations([{ type: 'childList', addedNodes: [sweepNode] }]);
  session.emitMutations([{ type: 'characterData', target: sweepNode.children[0].children[0] }]);
  assert.equal(nodes.filter((node) => node.childNodes[0].nodeValue.startsWith('글')).length, 10);

  clock = api.WIPER_MS;
  frames.shift()(clock);
  for (const node of nodes) assert.match(node.childNodes[0].nodeValue, /^더긴번역글/);
  assert.equal(nodes[0].classList.contains('pt-page-translator-hold'), false);
  assert.equal(line.style.willChange, '');

  session.toggleOriginal();
  assert.match(nodes[0].childNodes[0].nodeValue, /^더긴번역/);
  frames.shift()(clock);
  const reverse = created.filter((node) => String(node.className).includes('pt-page-translator-sweep')).at(-1);
  assert.equal(Number(reverse.style['--pt-p']), 1);
  clock += api.WIPER_MS;
  timers.filter((timer) => timer.ms === api.WIPER_MS).at(-1).fn();
  while (frames.length) frames.shift()(clock);
  assert.equal(nodes[0].childNodes[0].nodeValue, '글0');

  session.setEnabled(true);
  frames.shift()(clock);
  assert.match(nodes[0].childNodes[0].nodeValue, /^글/);
  clock += api.WIPER_MS;
  timers.filter((timer) => timer.ms === api.WIPER_MS).at(-1).fn();
  assert.match(nodes[0].childNodes[0].nodeValue, /^더긴번역글/);
});

test('a later chunk uses the same clip instead of popping into place', async () => {
  const created = [];
  const timers = [];
  let clock = 0;
  const api = loadContent({ document: revealDocument(created) });
  const root = element('div');
  const first = element('span', {
    rect: { top: 10, bottom: 28, left: 0, right: 40, width: 40, height: 18 },
  }, ['包邮']);
  root.append(first);
  let release = () => {};
  const session = api.createSession({
    root,
    walkRoot: root,
    enableBanner: false,
    prefersReducedMotion: false,
    now: () => clock,
    measureRect(node) { return node.parentElement.getBoundingClientRect(); },
    setTimer(fn, ms) { timers.push({ fn, ms }); return timers.length; },
    clearTimer() {},
    IntersectionObserver: class { observe() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    sendBatch(texts) {
      const result = { ok: true, translations: texts.map((text) => `번역${text}`) };
      if (texts.includes('包邮')) return result;
      return new Promise((resolve) => { release = () => resolve(result); });
    },
  });
  session.start();
  await session.whenIdle();
  assert.equal(first.childNodes[0].nodeValue, '包邮');
  assert.equal(timers.some((timer) => timer.ms === api.WIPER_MS), true);
  const added = element('span', {
    rect: { top: 400, bottom: 418, left: 0, right: 40, width: 40, height: 18 },
  }, ['新款']);
  root.append(added);
  session.emitMutations([{ type: 'childList', addedNodes: [added] }]);
  await Promise.resolve();
  release();
  await session.whenIdle();
  assert.equal(added.childNodes[0].nodeValue, '新款');
  assert.equal(first.childNodes[0].nodeValue, '包邮');
  const joined = created.filter((node) => String(node.className).includes('pt-page-translator-sweep'));
  assert.equal(joined.length >= 2, true);
  assert.match(joined.at(-1).children[1].children[0].nodeValue, /번역新款/);
  clock = api.WIPER_MS;
  timers.find((timer) => timer.ms === api.WIPER_MS).fn();
  assert.equal(added.childNodes[0].nodeValue, '번역新款');
  assert.equal(first.childNodes[0].nodeValue, '번역包邮');
});

test('one text rect is measured once and the overlay does not follow the parent box', async () => {
  const created = [];
  const timers = [];
  let rangeReads = 0;
  const api = loadContent({
    document: {
      ...revealDocument(created),
      createRange() {
        return {
          selectNodeContents() {},
          getBoundingClientRect() {
            rangeReads += 1;
            return { left: 8, top: 44, width: 20, height: 16 };
          },
        };
      },
    },
  });
  const root = element('div', { rect: { top: 0, bottom: 80, left: 0, right: 400, width: 400, height: 80 } });
  const block = element('p', { rect: { top: 0, bottom: 80, left: 0, right: 400, width: 400, height: 80 } }, ['包邮AB']);
  root.append(block);
  const session = api.createSession({
    root,
    walkRoot: root,
    enableBanner: false,
    prefersReducedMotion: false,
    setTimer(fn, ms) { timers.push({ fn, ms }); return timers.length; },
    clearTimer() {},
    IntersectionObserver: class { observe() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    sendBatch: async (texts) => ({ ok: true, translations: texts.map((text) => `번역${text}`) }),
  });
  session.start();
  await session.whenIdle();
  assert.equal(block.childNodes[0].nodeValue, '包邮AB');
  assert.equal(rangeReads, 1);
  const sweeps = created.filter((node) => String(node.className) === 'pt-page-translator-sweep');
  assert.equal(sweeps.length, 1);
  assert.equal(sweeps[0].style.top, '44px');
  assert.equal(sweeps[0].style.left, '8px');
  assert.equal(sweeps[0].style.width, '20px');
  assert.equal(sweeps[0].children[0].children[0].nodeValue, '包邮AB');
  assert.equal(sweeps[0].children[1].children[0].nodeValue, '번역包邮AB');
  assert.equal(block.classList.contains('pt-page-translator-pending'), false);
  timers.find((timer) => timer.ms === 680).fn();
  assert.equal(block.childNodes[0].nodeValue, '번역包邮AB');
  assert.equal(rangeReads, 1);
});

test('turning translation off restores originals and stops new batches', async () => {
  const root = element('div');
  const visible = element('a', {}, ['包邮']);
  root.append(visible);
  const { session, sent } = quietSession(root, {});
  session.start();
  await session.whenIdle();
  assert.equal(session.getStatus().enabled, true);
  assert.equal(visible.childNodes[0].nodeValue, 'T:包邮');
  session.setEnabled(false);
  assert.equal(session.getStatus().enabled, false);
  assert.equal(session.getStatus().showOriginal, true);
  assert.equal(visible.childNodes[0].nodeValue, '包邮');
  const added = element('p', {}, ['새문장']);
  root.append(added);
  session.emitMutations([{ type: 'childList', addedNodes: [added] }]);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(sent.length, 1);
  assert.equal(added.childNodes[0].nodeValue, '새문장');
  session.setEnabled(true);
  await session.whenIdle();
  assert.equal(visible.childNodes[0].nodeValue, 'T:包邮');
  assert.equal(added.childNodes[0].nodeValue, 'T:새문장');
  assert.equal(session.getStatus().enabled, true);
});

test('cursor priority orders near-viewport text and leaves the in-flight batch alone', async () => {
  const root = element('div');
  const far = element('span', { rect: { top: 10, bottom: 30, left: 0, right: 40, width: 40, height: 20 } }, ['먼글']);
  const middle = element('span', { rect: { top: 10, bottom: 30, left: 200, right: 240, width: 40, height: 20 } }, ['중간글']);
  const near = element('span', { rect: { top: 10, bottom: 30, left: 400, right: 440, width: 40, height: 20 } }, ['가까운글']);
  const outside = element('li', { rect: { top: 9000, bottom: 9040, left: 400, right: 440, width: 40, height: 40 } }, ['화면밖']);
  root.append(far);
  root.append(middle);
  root.append(near);
  root.append(outside);
  const { session, sent, release } = quietSession(root, { prioritizeCursor: true, hold: true });
  session.notePointer(420, 20);
  session.start();
  await until(() => sent.length === 1);
  assert.deepEqual([...sent[0]], ['가까운글', '중간글', '먼글']);
  assert.equal(sent[0].includes('화면밖'), false);

  const addedNear = element('b', { rect: { top: 12, bottom: 28, left: 8, right: 30, width: 22, height: 16 } }, ['추가가까움']);
  const addedFar = element('b', { rect: { top: 12, bottom: 28, left: 800, right: 840, width: 40, height: 16 } }, ['추가멈']);
  root.append(addedNear);
  root.append(addedFar);
  session.emitMutations([{ type: 'childList', addedNodes: [addedNear, addedFar] }]);
  session.notePointer(12, 20);
  const inflight = [...sent[0]];
  release();
  await session.whenIdle();
  assert.deepEqual(inflight, ['가까운글', '중간글', '먼글']);
  assert.deepEqual([...sent[1]], ['추가가까움', '추가멈']);
  assert.equal(sent.some((batch) => batch.includes('화면밖')), false);
});

test('without cursor priority, pointer updates keep document order', async () => {
  const root = element('div');
  const far = element('span', { rect: { top: 10, bottom: 30, left: 0, right: 40, width: 40, height: 20 } }, ['먼글']);
  const near = element('span', { rect: { top: 10, bottom: 30, left: 400, right: 440, width: 40, height: 20 } }, ['가까운글']);
  root.append(far);
  root.append(near);
  const { session, sent } = quietSession(root, {});
  session.notePointer(420, 20);
  session.start();
  await session.whenIdle();
  assert.equal(session.getStatus().enabled, true);
  assert.deepEqual([...sent[0]], ['먼글', '가까운글']);
});
