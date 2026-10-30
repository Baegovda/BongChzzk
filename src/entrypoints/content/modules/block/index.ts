import block, {blockReady} from "@/core/block";
import filter from "@/core/filtering";

import {eventBus} from "@/core/eventbus";
import {onMessage} from "@/http/messaging";
import {queryString} from "@/http/http";
import {handleBlockRequest} from "./request";

const COMMENT_ITEM_SELECTOR = "li.ub-content, .search_comment";
const COMMENT_TEXT_SELECTOR =
    ".comment_box .usertxt, .view_comment .usertxt, ul.cmt_list .usertxt, ul.reply_list .usertxt";

const getCommentTextFromWriter = (writer: HTMLElement): string | null => {
    if (!location.pathname.includes("/view/")) return null;

    const commentItem = writer.closest<HTMLElement>(COMMENT_ITEM_SELECTOR);
    if (commentItem) {
        return commentItem.querySelector<HTMLElement>(".usertxt")?.textContent?.trim() ?? null;
    }

    const commentInfo = writer.closest<HTMLElement>(".reply_info, .cmt_info");
    return commentInfo?.querySelector<HTMLElement>(".usertxt")?.textContent?.trim() ?? null;
};

const resolveBlockedTarget = (writer: HTMLElement, parent: HTMLElement): HTMLElement | null => {
    if (parent.classList.contains("ub-content")) return parent;

    const commentItem = writer.closest<HTMLElement>(COMMENT_ITEM_SELECTOR);
    if (commentItem) return commentItem;

    return parent.closest<HTMLElement>(".ub-content");
};

export default {
    name: "컨텐츠 차단",
    description: "유저, 컨텐츠 등의 보고 싶지 않은 컨텐츠들을 삭제합니다.",
    url: /\/board\/(view|lists)/,
    status: {},
    memory: {
        uuid: null,
        uuid2: null,
        uuid3: null,
        refreshHandler: null,
        commentObserver: null,
        rerunTimer: null,
        selected: {
            nick: null,
            uid: null,
            ip: null,
            code: null,
            packageIdx: null
        },
        lastSelect: 0,
        addBlock: null,
        requestBlock: null,
        blockSelected: null,
        dcconSelected: null,
        dcconAllSelected: null,
        contextMenuHandler: null
    },
    enable: true,
    default_enable: true,
    settings: {
        replyRemove: {
            name: "대댓글 삭제",
            desc: "차단된 댓글의 대댓글을 함께 삭제합니다.",
            type: "check",
            default: false,
            advanced: true
        },
        blur: {
            name: "블러 처리",
            desc: "차단된 내용을 블러 처리합니다.",
            type: "check",
            default: false,
            advanced: true
        }
    },
    async func() {
        await blockReady;

        const gallery = queryString("id");

        const hideElement = (element: HTMLElement, blur = false) => {
            element.dataset.refresherBlocked = "true";

            if (blur) {
                element.classList.add("refresherBlur");
                element.style.removeProperty("display");
                return;
            }

            element.classList.remove("refresherBlur");
            element.style.display = "none";
        };

        const resetBlockedElements = () => {
            for (const element of document.querySelectorAll<HTMLElement>("[data-refresher-blocked]")) {
                element.style.removeProperty("display");
                element.classList.remove("refresherBlur");
                delete element.dataset.refresherBlocked;
            }
        };

        const hideReplySibling = (content: HTMLElement) => {
            if (!this.status.replyRemove) return;

            const next = content.nextElementSibling as HTMLElement | null;

            if (next && !next.classList.contains("ub-content") && next.querySelector(":scope > .reply")) {
                hideElement(next, this.status.blur);
            }
        };

        const applyWriterBlock = (element: HTMLElement) => {
            if (!gallery) return;

            const parent = element.parentElement;
            if (!parent) return;

            const title = parent.querySelector<HTMLElement>(".gall_tit > a:not([class])")?.textContent?.trim() ?? "";
            const tab = parent.querySelector<HTMLElement>(".gall_subject")?.textContent ?? "";

            const viewWrap = element.closest<HTMLElement>(".view_content_wrap");
            const text = location.pathname.includes("/view/") && viewWrap
                ? viewWrap.querySelector(".write_div")?.textContent?.trim() ?? null
                : null;

            const commentContent = getCommentTextFromWriter(element);

            const nick = element.dataset.nick ?? null;
            const uid = element.dataset.uid ?? null;
            const ip = element.dataset.ip ?? null;

            if (
                block.checkAll(
                    {
                        TITLE: title,
                        NICK: nick,
                        ID: uid,
                        IP: ip,
                        COMMENT: commentContent,
                        TAB: tab
                    },
                    gallery
                )
            ) {
                const hideTarget = resolveBlockedTarget(element, parent);
                if (!hideTarget) return;

                hideReplySibling(hideTarget);
                hideElement(hideTarget, this.status.blur);
            } else if (text && block.check("TEXT", text, gallery) && viewWrap) {
                const writeDiv = viewWrap.querySelector<HTMLElement>(".write_div");
                if (writeDiv) writeDiv.textContent = "게시글 내용이 차단됐습니다.";
            }
        };

        const applyCommentTextBlock = (element: HTMLElement) => {
            if (!gallery) return;

            const commentText = element.textContent?.trim();
            if (!commentText || !block.check("COMMENT", commentText, gallery)) return;

            const hideTarget =
                element.closest<HTMLElement>(COMMENT_ITEM_SELECTOR) ??
                element.closest<HTMLElement>(".ub-content");

            if (!hideTarget) return;

            hideReplySibling(hideTarget);
            hideElement(hideTarget, this.status.blur);
        };

        const applyDcconBlock = (element: HTMLElement) => {
            if (!gallery) return;

            const src = element.getAttribute("src") ?? element.getAttribute("data-src") ?? "";
            const dccon = src.replace(/^.*no=/g, "").replace(/^&.*$/g, "");

            if (!block.check("DCCON", dccon, gallery)) return;

            const comment = element.closest<HTMLElement>(".ub-content");
            const hideTarget = comment ?? element.closest<HTMLElement>(".comment_dccon");

            if (!hideTarget) return;

            hideReplySibling(hideTarget);
            hideElement(hideTarget, this.status.blur);
        };

        const rerunBlockFilters = () => {
            resetBlockedElements();
            document.querySelectorAll<HTMLElement>(".ub-writer").forEach(applyWriterBlock);
            document.querySelectorAll<HTMLElement>(COMMENT_TEXT_SELECTOR).forEach(applyCommentTextBlock);
            document.querySelectorAll<HTMLElement>(".written_dccon").forEach(applyDcconBlock);
        };

        const scheduleRerunBlockFilters = () => {
            if (this.memory.rerunTimer !== null) {
                window.clearTimeout(this.memory.rerunTimer);
            }

            this.memory.rerunTimer = window.setTimeout(() => {
                this.memory.rerunTimer = null;
                rerunBlockFilters();
            }, 50);
        };

        this.memory.uuid = filter.add(".ub-writer", applyWriterBlock, {
            neverExpire: true
        });

        this.memory.uuid3 = filter.add(COMMENT_TEXT_SELECTOR, applyCommentTextBlock, {
            neverExpire: true
        });

        this.memory.refreshHandler = eventBus.on("refresh", scheduleRerunBlockFilters);

        this.memory.uuid2 = filter.add(".written_dccon", applyDcconBlock, {
            neverExpire: true
        });

        if (location.pathname.includes("/view/")) {
            const commentRoot = document.querySelector(".view_comment, .comment_box");
            if (commentRoot) {
                this.memory.commentObserver = new MutationObserver(scheduleRerunBlockFilters);
                this.memory.commentObserver.observe(commentRoot, {childList: true, subtree: true});
            }
        }

        scheduleRerunBlockFilters();

        this.memory.contextMenuHandler = (event: MouseEvent) => {
            if (!(event.target instanceof Element)) return;

            const dccon = event.target.closest<HTMLImageElement>(".written_dccon");
            if (dccon) {
                const code = (dccon.src || dccon.dataset.src || "")
                    .replace(/^.*no=/g, "")
                    .replace(/^&.*$/g, "");

                this.memory.selected = {
                    nick: null,
                    uid: null,
                    ip: null,
                    code,
                    packageIdx: null
                };
                this.memory.lastSelect = Date.now();
                return;
            }

            const writer = event.target.closest<HTMLElement>(".ub-writer");
            if (!writer) return;

            this.memory.selected = {
                nick: writer.dataset.nick ?? null,
                uid: writer.dataset.uid ?? null,
                ip: writer.dataset.ip ?? null,
                code: null,
                packageIdx: null
            };
            this.memory.lastSelect = Date.now();
        };
        document.addEventListener("contextmenu", this.memory.contextMenuHandler, true);

        this.memory.addBlock = eventBus.on(
            "refresherUserContextMenu",
            (nick, uid, ip, code, packageIdx) => {
                this.memory.selected = {
                    nick,
                    uid,
                    ip,
                    code,
                    packageIdx
                };
                this.memory.lastSelect = Date.now();
            }
        );

        this.memory.blockSelected = onMessage("blockSelected", () => {
            eventBus.emit("refresherRequestBlock", {target: "user"});
        });

        this.memory.dcconSelected = onMessage("dcconSelected", () => {
            eventBus.emit("refresherRequestBlock", {target: "dccon"});
        });

        this.memory.dcconAllSelected = onMessage("dcconAllSelected", () => {
            eventBus.emit("refresherRequestBlock", {
                target: "dccon",
                blockAllDccon: true
            });
        });

        this.memory.requestBlock = eventBus.on("refresherRequestBlock", async (args) => {
            await handleBlockRequest(args, this.memory.selected, Date.now() - this.memory.lastSelect);
        });
    },
    revoke() {
        if (this.memory.uuid) filter.remove(this.memory.uuid);

        if (this.memory.uuid2) filter.remove(this.memory.uuid2);

        if (this.memory.uuid3) filter.remove(this.memory.uuid3);

        if (this.memory.refreshHandler) this.memory.refreshHandler();

        if (this.memory.commentObserver) {
            this.memory.commentObserver.disconnect();
            this.memory.commentObserver = null;
        }

        if (this.memory.rerunTimer !== null) {
            window.clearTimeout(this.memory.rerunTimer);
            this.memory.rerunTimer = null;
        }

        if (this.memory.addBlock) this.memory.addBlock();

        if (this.memory.requestBlock) this.memory.requestBlock();

        if (this.memory.blockSelected) this.memory.blockSelected();

        if (this.memory.dcconSelected) this.memory.dcconSelected();

        if (this.memory.dcconAllSelected) this.memory.dcconAllSelected();

        if (this.memory.contextMenuHandler) {
            document.removeEventListener("contextmenu", this.memory.contextMenuHandler, true);
            this.memory.contextMenuHandler = null;
        }
    }
} as RefresherModule<{
    memory: {
        uuid: string | null;
        uuid2: string | null;
        uuid3: string | null;
        refreshHandler: (() => void) | null;
        commentObserver: MutationObserver | null;
        rerunTimer: number | null;
        selected: {
            nick: string | null;
            uid: string | null;
            ip: string | null;
            code: string | null;
            packageIdx: string | null;
        };
        lastSelect: number;
        addBlock: (() => void) | null;
        requestBlock: (() => void) | null;
        blockSelected: (() => void) | null;
        dcconSelected: (() => void) | null;
        dcconAllSelected: (() => void) | null;
        contextMenuHandler: ((event: MouseEvent) => void) | null;
    };
    settings: {
        replyRemove: RefresherCheckSettings;
        blur: RefresherCheckSettings;
    };
}>;