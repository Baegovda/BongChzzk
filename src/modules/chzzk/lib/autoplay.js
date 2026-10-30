// BongChzzk 자동 재생 순수 로직 (전역 BongAutoplay)
(function (root) {
  'use strict';
  const PLAY = /재생|play|start|시작/i;
  const NOT = /일시\s*정지|정지|pause|stop|다음|이전|next|prev|설정|setting|전체\s*화면|fullscreen|음소거|mute|volume|볼륨|ad|광고/i;
  // 재생 버튼 후보 점수. info {cls, label, text}. 0이면 후보 아님.
  function scorePlayButton(info) {
    const cls = String(info && info.cls || ''), label = String(info && info.label || ''), text = String(info && info.text || '');
    if (NOT.test(label)) return 0;
    let s = 0;
    if (PLAY.test(label)) s += 3;
    if (/playback-switch|play-button|btn-play|big-play|start-button/i.test(cls)) s += 2;
    else if (/(^|[\s_-])play/i.test(cls) && !/pause|player|playlist|display/i.test(cls.replace(/pzp-pc|pzp/g, ''))) s += 1;
    if (s && PLAY.test(text) && !NOT.test(text)) s += 1;
    return s;
  }
  // 이번 페이지에서 자동 재생을 시도해야 하는지
  function shouldPlay(s) {
    if (!s || !s.enabled || !s.onVideoPage || !s.hasVideo) return false;
    if (s.userPaused || s.adActive || s.done) return false;
    if (s.ended) return false;
    return !!s.paused;
  }
  const isVideoPage = p => /^\/(live|video)\/[^/]+/.test(String(p || ''));
  root.BongAutoplay = { scorePlayButton, shouldPlay, isVideoPage };
})(typeof globalThis !== 'undefined' ? globalThis : this);
