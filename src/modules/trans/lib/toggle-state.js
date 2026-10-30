export function startToggle(checked) {
  return { pending: true, on: Boolean(checked), error: '' };
}

export function blockedToggle(message) {
  return { pending: false, on: false, error: message || '' };
}

export function settleToggle(pendingOn, response, fallbackMessage) {
  const wanted = Boolean(pendingOn);
  const enabled = Boolean(response?.status?.enabled);
  if (!response || response.ok === false || enabled !== wanted) {
    return {
      pending: false,
      on: false,
      error: response?.message || fallbackMessage || (wanted
        ? '이 페이지에서 번역을 켜지 못했어요.'
        : '번역 상태를 바꾸지 못했어요.'),
    };
  }
  return { pending: false, on: wanted, error: '' };
}

export function refreshToggle(state, status) {
  if (state?.pending) return { pending: true, on: Boolean(state.on), error: state.error || '' };
  if (state?.error && !status?.started && !status?.enabled) {
    return { pending: false, on: false, error: state.error };
  }
  return { pending: false, on: Boolean(status?.enabled), error: '' };
}
