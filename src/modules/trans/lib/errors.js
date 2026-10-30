export class GeminiError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'GeminiError';
    this.code = code;
    this.status = extra.status || 0;
    this.retryAfterMs = extra.retryAfterMs ?? null;
  }
}
