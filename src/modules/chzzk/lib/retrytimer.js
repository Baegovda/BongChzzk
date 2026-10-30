// 버퍼링 복구 타이머 계산 (순수 함수). content.js 복구 루프와 같은 공식을 씁니다.
(function (root) {
  'use strict';
  const backoffMs = (level, cooldownSec) => cooldownSec * 1000 * Math.pow(1.5, Math.max(0, level - 1));
  // 다음 복구까지 남은 ms (0 이하면 지금 복구)
  function nextRecoverIn(now, stallSince, lastRecover, level, thresholdSec, cooldownSec) {
    const a = thresholdSec * 1000 - (now - stallSince);
    const b = backoffMs(level, cooldownSec) - (now - (lastRecover || 0));
    return Math.max(0, a, b);
  }
  // 링 진행률 기준이 되는 전체 대기 시간(ms)
  function waitTotal(stallSince, lastRecover, level, thresholdSec, cooldownSec) {
    const endA = stallSince + thresholdSec * 1000;
    const endB = lastRecover ? lastRecover + backoffMs(level, cooldownSec) : 0;
    const end = Math.max(endA, endB);
    const start = Math.max(stallSince, lastRecover || 0);
    return Math.max(1, end - start);
  }
  const STEPS = ['1단계: 다시 재생', '2단계: 플레이어 다시 시작', '3단계: 방송 다시 불러오기', '4단계: 플레이어 새로 띄우기'];
  const stepLabel = level => STEPS[Math.max(0, Math.min(3, level | 0))];
  // ── 시작 안 됨(무한 로딩) 감시: 다음에 할 일 결정 ──
  // st: { now, enabled, onVideoPage, visible, adActive, userPaused, ended, offline, ok, loopBusy,
  //       since(문제 시작 ms, 0=없음), attempt(이번 문제에서 한 시도 수), lastAttempt, thresholdSec, recentReloads }
  const wdDelayMs = thresholdSec => Math.max(10, (Number(thresholdSec) || 5) + 5) * 1000;
  const WD_STEPS = ['1단계: 다시 재생', '2단계: 플레이어 새로 띄우기', '3단계: 페이지 새로고침'];
  const MAX_RELOADS = 2, RELOAD_WINDOW_MS = 5 * 60 * 1000;
  function wdPlannedAction(attempt, recentReloads) {
    if (attempt <= 0) return 'play';
    if (attempt === 1) return 'remount';
    return recentReloads < MAX_RELOADS ? 'reload' : 'remount';
  }
  function watchdogDecide(st) {
    if (!st || !st.enabled || !st.onVideoPage || !st.visible || st.adActive || st.userPaused || st.ended || st.offline || st.ok || st.loopBusy)
      return { action: 'reset' };
    if (!st.since) return { action: 'start' };
    const delay = wdDelayMs(st.thresholdSec);
    const from = st.attempt > 0 ? Math.max(st.since, st.lastAttempt || 0) : st.since;
    const waitMs = Math.max(0, from + delay - st.now);
    const next = wdPlannedAction(st.attempt, st.recentReloads || 0);
    return waitMs > 0 ? { action: 'wait', waitMs, totalMs: delay, next } : { action: next, waitMs: 0, totalMs: delay, next };
  }
  const wdStepLabel = next => next === 'play' ? WD_STEPS[0] : next === 'reload' ? WD_STEPS[2] : WD_STEPS[1];
  // sessionStorage에 저장한 새로고침 시각 목록에서 최근 5분 것만 남김
  const recentReloadTimes = (list, now) => (Array.isArray(list) ? list : []).filter(t => typeof t === 'number' && now - t < RELOAD_WINDOW_MS && t <= now);
  root.BongRetryTimer = { nextRecoverIn, waitTotal, stepLabel, backoffMs, SHOW_AFTER_MS: 1200,
    watchdogDecide, wdDelayMs, wdStepLabel, recentReloadTimes, MAX_RELOADS };
})(globalThis);
