export type InsertPosition = "before" | "after" | "append" | "prepend";

export interface InsertOptions {
    position?: InsertPosition;
    relativeSelector?: string;
}

export function appendUserDataSpan(element: HTMLElement, span: HTMLElement, options: InsertOptions = {}): boolean {
    const {position = "append", relativeSelector} = options;

    let target: HTMLElement | null = element;

    if (relativeSelector) {
        target = element.querySelector<HTMLElement>(relativeSelector);
        if (!target) return false;
    }

    switch (position) {
        case "before": {
            const ref = target.querySelector<HTMLElement>(".refresherUserData");
            if (ref) target.insertBefore(span, ref);
            else target.prepend(span);
            break;
        }
        case "after": {
            const ref = target.querySelector<HTMLElement>(".refresherUserData");
            if (ref) ref.after(span);
            else target.appendChild(span);
            break;
        }
        case "prepend":
            target.prepend(span);
            break;
        case "append":
        default:
            target.appendChild(span);
            break;
    }

    return true;
}

/**
 * 유동 댓글 마크업은 `.ip`가 `.nickname` 안쪽에 있다.
 * `.nickname`은 flex + overflow:hidden 이고 안의 `em`은 줄어들 수 있어서,
 * 긴 문자열을 `.ip` 안에 넣으면 닉네임 너비가 0이 된다.
 * 그 경우에는 닉네임 바로 뒤에 붙인다.
 */
export function insertAfterNicknameWhenIpNested(element: HTMLElement, span: HTMLElement): boolean {
    const nestedIp = element.querySelector<HTMLElement>(".nickname .ip");
    const nickname = nestedIp?.closest(".nickname");
    if (!nickname) return false;

    nickname.after(span);
    return true;
}

export function insertIntoWriterArea(element: HTMLElement, span: HTMLElement): boolean {
    if (insertAfterNicknameWhenIpNested(element, span)) return true;

    if (element.dataset.ip) {
        const addBox = element.querySelector<HTMLElement>(".addbox");

        if (addBox) {
            const fl = element.querySelector<HTMLElement>(".fl > span");
            if (fl) {
                const ip = fl.querySelector<HTMLElement>(".ip");
                if (ip) fl.insertBefore(span, ip);
                else fl.appendChild(span);
            } else {
                const ip = element.querySelector<HTMLElement>(".ip");
                if (ip) {
                    const userData = ip.querySelector<HTMLElement>(".refresherUserData");
                    if (userData) ip.insertBefore(span, userData);
                    else ip.appendChild(span);
                } else {
                    addBox.appendChild(span);
                }
            }
            return true;
        }

        const fl = element.querySelector<HTMLElement>(".fl > span");
        if (fl) {
            const flIpQuery = fl.querySelector<HTMLElement>(".ip, .writer_nikcon");
            if (flIpQuery) fl.insertBefore(span, flIpQuery.nextSibling);
            else fl.appendChild(span);
            return true;
        }

        const userData = element.querySelector<HTMLElement>(".refresherUserData");
        if (userData) element.insertBefore(span, userData);
        else element.appendChild(span);
        return true;
    }

    const addBox = element.querySelector<HTMLElement>(".addbox");
    if (addBox) {
        const userData = element.querySelector<HTMLElement>(".refresherUserData");
        if (userData) addBox.insertBefore(span, userData);
        else addBox.appendChild(span);
        return true;
    }

    element.appendChild(span);
    return true;
}