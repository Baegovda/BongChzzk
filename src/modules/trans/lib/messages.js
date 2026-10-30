export const MESSAGES = {
  NO_API_KEY:
    'Gemini API 키가 없어요. 번역 설정에서 키를 넣어 주세요.',
  NO_MODEL:
    '모델 이름이 올바르지 않아요. 설정에서 모델을 확인해 주세요.',
  INVALID_KEY:
    'API 키가 거부됐어요. Google AI Studio에서 키를 다시 확인해 주세요.',
  QUOTA:
    'Gemini 할당량 또는 크레딧이 부족해요. Google AI Studio에서 사용량을 확인해 주세요.',
  RATE_LIMIT:
    'Gemini API 속도 제한(429)이에요. 잠시 후 다시 시도했지만 실패했어요. 조금 뒤 다시 번역하거나 AI Studio에서 할당량을 확인해 주세요.',
  MODEL_NOT_FOUND:
    '모델을 찾을 수 없어요. 모델 이름을 확인해 주세요.',
  OVERLOADED:
    '모델이 지금 혼잡하거나 서버 오류예요. API 키 문제가 아니에요. 잠시 후 다시 시도해 주세요.',
  UNAVAILABLE:
    'Gemini API 서버 오류예요. API 키 문제가 아니에요. 잠시 후 다시 시도해 주세요.',
  NETWORK:
    'Gemini API에 연결하지 못했어요. 네트워크를 확인한 뒤 다시 시도해 주세요.',
  BAD_RESPONSE:
    '번역 결과 형식이 올바르지 않아요. 다시 시도해 주세요.',
  PAGE_BLOCKED:
    '이 페이지에서는 확장 프로그램을 실행할 수 없어요. http 또는 https 페이지에서 사용해 주세요.',
  INJECT_FAILED:
    '이 페이지에 번역기를 넣을 수 없어요. 크롬 웹 스토어, PDF, 브라우저 내부 페이지는 번역되지 않아요.',
  NOT_STARTED: '먼저 이 페이지의 번역을 켜 주세요.',
};

export function withDetail(base, detail) {
  const clean = String(detail || '')
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, '[key]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
  if (!clean) return base;
  return `${base} ${clean}`;
}
