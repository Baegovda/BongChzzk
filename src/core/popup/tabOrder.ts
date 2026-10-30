// 팝업 탭 순서 순수 함수 (테스트 가능).
export const normalizeTabOrder = <T extends string>(saved: unknown, defaults: readonly T[]): T[] => {
    if (!Array.isArray(saved)) return [...defaults];
    const out: T[] = [];
    for (const id of saved) if (defaults.includes(id as T) && !out.includes(id as T)) out.push(id as T);
    for (const id of defaults) if (!out.includes(id)) out.push(id);
    return out;
};

export const moveItem = <T>(order: readonly T[], from: number, to: number): T[] => {
    const out = [...order];
    if (from < 0 || from >= out.length) return out;
    const clamped = Math.max(0, Math.min(out.length - 1, to));
    const [item] = out.splice(from, 1);
    out.splice(clamped, 0, item);
    return out;
};
