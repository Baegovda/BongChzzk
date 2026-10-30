export const MESSAGES = {
  NO_API_KEY:
    'Gemini API 키가 없습니다. 확장 프로그램 설정에서 키를 입력하세요. (Missing API key)',
  NO_MODEL:
    '모델 이름이 올바르지 않습니다. 설정에서 모델을 확인하세요. (Invalid model)',
  INVALID_KEY:
    'API 키가 거부되었습니다. Google AI Studio에서 키를 다시 확인하세요. (Invalid API key)',
  QUOTA:
    'Gemini 할당량 또는 크레딧이 부족합니다. Google AI Studio에서 사용량을 확인하세요. (Quota exceeded)',
  RATE_LIMIT:
    'Gemini API 속도 제한(429)입니다. 잠시 후 다시 시도했지만 실패했습니다. 조금 뒤 다시 번역하거나 AI Studio에서 할당량을 확인하세요. (Rate limited)',
  MODEL_NOT_FOUND:
    '모델을 찾을 수 없습니다. 모델 이름을 확인하세요. (Model not found)',
  OVERLOADED:
    '모델이 지금 혼잡하거나 서버 오류입니다. API 키 문제가 아닙니다. 잠시 후 다시 시도하세요. (Model overloaded)',
  UNAVAILABLE:
    'Gemini API 서버 오류입니다. API 키 문제가 아닙니다. 잠시 후 다시 시도하세요. (Server error)',
  NETWORK:
    'Gemini API에 연결하지 못했습니다. 네트워크를 확인한 뒤 다시 시도하세요. (Network error)',
  BAD_RESPONSE:
    '번역 결과 형식이 올바르지 않습니다. 다시 시도하세요. (Unexpected response)',
  PAGE_BLOCKED:
    '이 페이지에서는 확장 프로그램을 실행할 수 없습니다. http 또는 https 페이지에서 사용해 주세요.',
  INJECT_FAILED:
    '이 페이지에 번역기를 넣을 수 없습니다. 크롬 웹 스토어, PDF, 브라우저 내부 페이지는 번역되지 않습니다.',
  NOT_STARTED: '먼저 이 페이지의 번역을 켜세요.',
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
