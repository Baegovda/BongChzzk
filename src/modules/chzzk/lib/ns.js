// BongExtend: 치지직 모듈 설정 키를 'chzzk.' 접두사로 저장한다.
// 기존 BongChzzk 코드는 chrome.storage 대신 BCStore를 부르고, 키 이름은 그대로 쓴다.
(function (root) {
  if (root.BCStore) return;
  const P = 'chzzk.';
  const add = k => P + k;
  const strip = o => { const r = {}; for (const k in o) if (k.startsWith(P)) r[k.slice(P.length)] = o[k]; return r; };
  const mapReq = d => {
    if (d == null) return null;
    if (typeof d === 'string') return add(d);
    if (Array.isArray(d)) return d.map(add);
    const r = {}; for (const k in d) r[add(k)] = d[k]; return r;
  };
  const area = name => ({
    get(d, cb) {
      const p = new Promise((res, rej) => chrome.storage[name].get(mapReq(d), v => chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res(strip(v || {}))));
      if (cb) { p.then(cb, () => {}); return; }
      return p;
    },
    set(o, cb) {
      const r = {}; for (const k in o) r[add(k)] = o[k];
      const p = new Promise(res => chrome.storage[name].set(r, () => res()));
      if (cb) { p.then(cb); return; }
      return p;
    }
  });
  root.BCStore = {
    prefix: P,
    sync: area('sync'),
    local: area('local'),
    onChanged: {
      addListener(fn) {
        chrome.storage.onChanged.addListener((c, a) => {
          const r = strip(c);
          if (Object.keys(r).length) fn(r, a);
        });
      }
    }
  };
})(globalThis);
