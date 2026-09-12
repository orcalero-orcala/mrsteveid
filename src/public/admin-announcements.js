(() => {
    "use strict";

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
    const adminId = Number(localStorage.getItem("adminId"));
    const adminName = localStorage.getItem("adminName") || "Admin";
    const adminRole = localStorage.getItem("adminRole") || "Administrator";
    const adminUsername = localStorage.getItem("adminUsername");

    if (!Number.isInteger(adminId) || !adminUsername) {
        location.href = "/index.html";
        return;
    }

    const displayRole = adminRole === "teacher" ? "Teacher" : adminRole;
    $("#sidebarAdminName").textContent = adminName;
    $("#sidebarAdminRole").textContent = displayRole;
    $("#topAdminName").textContent = adminName;
    $("#topAdminRole").textContent = displayRole;

    const ui = {
        form: $("#announcementForm"),
        message: $("#announcementMessage"),
        status: $("#message"),
        list: $("#announcementList"),
        classWrap: $("#classContainer"),
        classSelect: $("#className"),
        filter: $("#adminFeedFilter"),
        mentionBox: $("#adminAnnouncementMentionSuggestions"),
        loadMoreWrap: $("#adminFeedLoadMoreWrap"),
        loadMoreStatus: $("#adminFeedLoadMoreStatus"),
        notificationBadge: $("#notificationBadge"),
        notificationOverlay: $("#adminNotificationOverlay"),
        notificationList: $("#adminNotificationList"),
                imageButton:
            $("#feedPostImageButton"),

        imageAttachment:
            $("#feedPostImageAttachment"),

        imageAttachmentPreview:
            $("#feedPostImageAttachmentPreview"),

        imageAttachmentSource:
            $("#feedPostImageAttachmentSource"),

        imageRemoveButton:
            $("#feedPostImageRemoveButton"),

        imageDialogOverlay:
            $("#feedImageDialogOverlay"),

        imageDialogPreview:
            $("#feedImageDialogPreview"),

        imageDialogEmpty:
            $("#feedImageDialogEmpty"),

        imageDialogStatus:
            $("#feedImageDialogStatus"),

        imageDialogFile:
            $("#feedImageDialogFile"),

        imageDialogUrl:
            $("#feedImageDialogUrl"),

        imageDialogCheckUrl:
            $("#feedImageDialogCheckUrlButton"),

        imageDialogClear:
            $("#feedImageDialogClearButton"),

        imageDialogCancel:
            $("#feedImageDialogCancelButton"),

        imageDialogClose:
            $("#feedImageDialogCloseButton"),

        imageDialogConfirm:
            $("#feedImageDialogConfirmButton")
    };

    const state = {
        loading: false,
        hasMore: false,
        beforeId: null,
        latestPostId: 0,
        latestReplyId: 0,
        filter: "all",
postMentions: [],
postMentionUsers: [],
postMentionPromise: null,
postMentionLoaded: false,
pollTimer: null,
        pollRunning: false,
        foreground: 0,
        notificationTick: 0,
        notificationTargetLoading: false,
        classesLoaded: false,
                postImage:
            null,

        dialogPostImage:
            null,

        dialogImageObjectUrl:
            null,

        imageDialogBusy:
            false
    };

    const moderation = {
        students: [],
        actions: [],
        selected: null,
        filter: "all",
        muteTargetId: null,
        banTargetId: null,
        muteMinutes: 30,
        serverOffset: 0,
        liveTimer: null,
        countdownTimer: null,
        loading: false,
        deleting: false
    };

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = String(value ?? "");
        return div.innerHTML;
    }

    function dateTime(value) {
        if (typeof window.formatDeviceDateTime === "function") {
            return window.formatDeviceDateTime(value);
        }
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("id-ID");
    }

    function relativeTime(value) {

    if (
        typeof window.formatRelativeTime ===
        "function"
    ) {

        return window.formatRelativeTime(
            value
        );

    }


    return dateTime(value);

}

function setFeedTextExpanded(
    toggle,
    expanded
) {

    if (!toggle) {
        return;
    }


    const contentId =
        toggle.getAttribute(
            "aria-controls"
        );

    const content =
        document.getElementById(
            contentId
        );


    if (!content) {
        return;
    }


    expanded =
        Boolean(expanded);


    content.classList.toggle(
        "is-expanded",
        expanded
    );

    toggle.setAttribute(
        "aria-expanded",
        String(expanded)
    );

    toggle.textContent =
        expanded
            ? "Tampilkan lebih sedikit"
            : "Lihat selengkapnya";

    toggle.hidden =
        false;

}


function setupFeedTextCollapse(
    root = document
) {

    const toggles =
        root.querySelectorAll(
            ".feed-text-toggle"
        );


    toggles.forEach(toggle => {

        const content =
            document.getElementById(
                toggle.getAttribute(
                    "aria-controls"
                )
            );


        if (!content) {
            return;
        }


        /*
         * Jangan ukur elemen yang masih berada
         * di panel reply tersembunyi.
         */
        if (
            content.getClientRects()
                .length === 0
        ) {
            return;
        }


        if (
            content.classList.contains(
                "is-expanded"
            )
        ) {

            toggle.hidden =
                false;

            return;

        }


        const overflowing =
            content.scrollHeight >
            content.clientHeight + 1;


        content.classList.toggle(
            "is-overflowing",
            overflowing
        );

        toggle.hidden =
            !overflowing;

    });

}


function queueFeedTextCollapse(
    root = document
) {

    requestAnimationFrame(() => {

        setupFeedTextCollapse(
            root
        );

    });

}


function expandNotificationText(
    target
) {

    if (!target) {
        return;
    }


    const toggle =
        target.classList.contains(
            "feed-thread-reply"
        )
            ? target.querySelector(
                ".feed-text-toggle"
            )
            : target.querySelector(
                ".feed-card-body .feed-text-toggle"
            );


    if (toggle) {

        setFeedTextExpanded(
            toggle,
            true
        );

    }

}

    function profileInitial(name) {
        return typeof window.getProfileInitial === "function"
            ? window.getProfileInitial(name)
            : String(name || "S").trim().charAt(0).toUpperCase();
    }

    function teacherInitial(name) {
        return typeof window.getTeacherInitial === "function"
            ? window.getTeacherInitial(name)
            : String(name || "A").trim().charAt(0).toUpperCase();
    }

    function teacherBadge() {
        return `<span class="teacher-verified-badge" title="Admin / Guru terverifikasi" aria-label="Admin atau guru terverifikasi"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M7.4 12.1L10.4 15L16.7 8.7"></path></svg></span>`;
    }

function formatToolbarMarkup() {
    return `
        <div
            class="
                feed-format-toolbar
                feed-reply-format-toolbar
            "
            aria-label="Format teks reply"
        >

            <button
                type="button"
                class="feed-format-button"
                data-format="bold"
                title="Bold"
                aria-label="Bold"
            >
                <strong>B</strong>
            </button>

            <button
                type="button"
                class="feed-format-button"
                data-format="italic"
                title="Italic"
                aria-label="Italic"
            >
                <em>I</em>
            </button>

            <button
                type="button"
                class="feed-format-button"
                data-format="underline"
                title="Underline"
                aria-label="Underline"
            >
                <u>U</u>
            </button>

            <button
                type="button"
                class="
                    feed-format-button
                    feed-format-clear-button
                "
                data-format="clear"
                title="Hapus formatting"
                aria-label="Hapus formatting"
            >
                <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path d="M5 19L11 5H13L19 19"></path>
                    <path d="M7.5 14H16.5"></path>
                    <path d="M4 4L20 20"></path>
                </svg>
            </button>

            <button
                type="button"
                class="
                    feed-format-button
                    feed-format-list-button
                "
                data-format="bullet"
                title="Daftar poin"
                aria-label="Daftar poin"
            >
                <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path
                        d="M4 6.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5ZM8 4.75h12v1.5H8v-1.5ZM4 13.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5ZM8 11.5h12V13H8v-1.5ZM4 20a1.25 1.25 0 1 0 0-2.5A1.25 1.25 0 0 0 4 20ZM8 18.25h12v1.5H8v-1.5Z"
                    ></path>
                </svg>
            </button>

        </div>
    `;
}

function formatInlineText(value, mentions = []) {
    const protectedParts = [];
    let source = String(value ?? "");

    function protect(html) {
        const token = `\uE000${protectedParts.length}\uE001`;
        protectedParts.push(html);
        return token;
    }

    /*
     * Lindungi URL terlebih dahulu agar karakter _, * atau ~
     * di dalam URL tidak dianggap sebagai formatting.
     */
    source = source.replace(
        /\bhttps?:\/\/[^\s<>"']+/gi,
        matchedUrl => {
            let url = matchedUrl;
            let trailing = "";

            while (/[.,!?;:]$/.test(url)) {
                trailing = url.slice(-1) + trailing;
                url = url.slice(0, -1);
            }

            const safeUrl = escapeHtml(url);

            return protect(
                `<a class="feed-content-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeUrl}</a>`
            ) + trailing;
        }
    );

    /*
     * Mention juga dilindungi supaya nama pengguna tidak
     * diproses sebagai syntax formatting.
     */
    const mentionNames = [
        ...new Set(
            (Array.isArray(mentions) ? mentions : [])
                .map(item => String(item?.name || "").trim())
                .filter(Boolean)
        )
    ].sort((a, b) => b.length - a.length);

    mentionNames.forEach(name => {
        const mentionText = `@${name}`;
        const mentionHtml =
            `<span class="feed-content-mention">${escapeHtml(mentionText)}</span>`;

        source = source
            .split(mentionText)
            .join(protect(mentionHtml));
    });

    let safe = escapeHtml(source);

    safe = safe.replace(
        /\*\*([^*\n]+)\*\*/g,
        "<strong>$1</strong>"
    );

    safe = safe.replace(
        /__([^_\n]+)__/g,
        "<u>$1</u>"
    );

    safe = safe.replace(
        /~~([^~\n]+)~~/g,
        "<s>$1</s>"
    );

    safe = safe.replace(
        /(^|[^*])\*([^*\n]+)\*(?!\*)/g,
        "$1<em>$2</em>"
    );

    protectedParts.forEach((html, index) => {
        safe = safe
            .split(`\uE000${index}\uE001`)
            .join(html);
    });

    return safe;
}

function formatMessage(text, mentions = []) {
    const lines = String(text ?? "")
        .replace(/\r\n?/g, "\n")
        .split("\n");

    const output = [];
    let listOpen = false;

    lines.forEach((line, index) => {
        const bulletMatch = line.match(/^\s*-\s+(.+)$/);

        if (bulletMatch) {
            if (!listOpen) {
                output.push('<ul class="feed-content-list">');
                listOpen = true;
            }

            output.push(
                `<li>${formatInlineText(bulletMatch[1], mentions)}</li>`
            );

            return;
        }

        if (listOpen) {
            output.push("</ul>");
            listOpen = false;
        }

        output.push(formatInlineText(line, mentions));

        if (index < lines.length - 1) {
            output.push("<br>");
        }
    });

    if (listOpen) {
        output.push("</ul>");
    }

    return output.join("");
}

function formatNotificationMessage(message) {
    const text = String(message || "");

    /*
     * Pisahkan:
     * 1. Kalimat notifikasi
     * 2. Petik pembuka
     * 3. Isi post yang diformat
     * 4. Petik penutup
     */
    const replyMatch = text.match(
        /^(Kamu mendapat reply dalam Post:\s*)"([\s\S]*)"$/
    );

    if (!replyMatch) {
        return formatMessage(text);
    }

    const prefix = replyMatch[1];
    const postPreview = replyMatch[2];

    return `
        <span class="notification-reply-prefix">
            ${escapeHtml(prefix)}
        </span>

        <span class="notification-reply-quote">
            "
        </span>

        <span class="notification-post-preview">
            ${formatMessage(postPreview)}
        </span>

        <span class="notification-reply-quote">
            "
        </span>
    `;
}

function editorPlainText(editor) {
    return String(editor?.innerText || "")
        .replace(/\u00a0/g, " ");
}

function serializeEditorChildren(element) {
    let result = "";

    [...element.childNodes].forEach(node => {
        const isBlockElement =
            node.nodeType === Node.ELEMENT_NODE &&
            [
                "DIV",
                "P",
                "UL",
                "OL"
            ].includes(node.tagName);

        /*
         * Chrome membuat Enter sebagai DIV baru.
         * Tambahkan pemisah sebelum block berikutnya
         * agar baris sebelumnya tidak menyatu.
         */
        if (
            isBlockElement &&
            result &&
            !result.endsWith("\n")
        ) {
            result += "\n";
        }

        result += serializeEditorNode(node);
    });

    return result;
}

function serializeEditorNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
        return String(node.nodeValue || "")
            .replace(/\u00a0/g, " ");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
        return "";
    }

    const element = node;
    const tag = element.tagName.toUpperCase();

    if (tag === "BR") {
        return "\n";
    }

    if (tag === "UL" || tag === "OL") {
        const items = [...element.children]
            .filter(child => child.tagName === "LI");

        const result = items.map((item, index) => {
            const prefix =
                tag === "OL"
                    ? `${index + 1}. `
                    : "- ";

            return prefix +
                serializeEditorChildren(item).trim();
        }).join("\n");

        return result ? `${result}\n` : "";
    }

    let content = serializeEditorChildren(element);

    const weight = String(element.style.fontWeight || "");
    const numericWeight = Number.parseInt(weight, 10);

    const bold =
        tag === "B" ||
        tag === "STRONG" ||
        weight === "bold" ||
        numericWeight >= 600;

    const italic =
        tag === "I" ||
        tag === "EM" ||
        element.style.fontStyle === "italic";

    const underline =
        tag === "U" ||
        String(element.style.textDecoration || "")
            .includes("underline");

    const strike =
        tag === "S" ||
        tag === "STRIKE" ||
        String(element.style.textDecoration || "")
            .includes("line-through");

    if (bold && content) {
        content = `**${content}**`;
    }

    if (italic && content) {
        content = `*${content}*`;
    }

    if (underline && content) {
        content = `__${content}__`;
    }

    if (strike && content) {
        content = `~~${content}~~`;
    }

    if (
        (tag === "DIV" || tag === "P") &&
        content &&
        !content.endsWith("\n")
    ) {
        content += "\n";
    }

    return content;
}

function editorToMarkup(editor) {
    if (!editor) return "";

    return serializeEditorChildren(editor)
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function getEditorCaretOffset(editor) {
    const selection = window.getSelection();

    if (
        !selection ||
        selection.rangeCount === 0 ||
        !selection.focusNode ||
        !editor.contains(selection.focusNode)
    ) {
        return editorPlainText(editor).length;
    }

    const range = document.createRange();
    range.selectNodeContents(editor);

    try {
        range.setEnd(
            selection.focusNode,
            selection.focusOffset
        );

        return range.toString().length;
    } catch {
        return editorPlainText(editor).length;
    }
}

function findEditorTextPoint(
    editor,
    wantedOffset,
    preferNextAtBoundary = false
) {
    const walker =
        document.createTreeWalker(
            editor,
            NodeFilter.SHOW_TEXT
        );

    const textNodes = [];
    let currentNode;

    while (
        (
            currentNode =
                walker.nextNode()
        )
    ) {
        textNodes.push(
            currentNode
        );
    }

    if (!textNodes.length) {
        const fallback =
            document.createTextNode(
                ""
            );

        editor.appendChild(
            fallback
        );

        return {
            node: fallback,
            offset: 0
        };
    }

    const targetOffset =
        Math.max(
            0,
            Number(wantedOffset) || 0
        );

    let passed = 0;

    for (
        let index = 0;
        index < textNodes.length;
        index += 1
    ) {
        const node =
            textNodes[index];

        const length =
            node.nodeValue?.length ||
            0;

        const nodeEnd =
            passed + length;

        /*
         * Offset benar-benar berada di dalam node.
         */
        if (targetOffset < nodeEnd) {
            return {
                node,

                offset:
                    Math.max(
                        0,
                        targetOffset -
                            passed
                    )
            };
        }

        /*
         * Offset tepat di batas dua node.
         *
         * Untuk awal mention, pilih awal node berikutnya.
         * Untuk akhir mention, pilih akhir node sekarang.
         */
        if (targetOffset === nodeEnd) {
            if (
                preferNextAtBoundary &&
                textNodes[index + 1]
            ) {
                return {
                    node:
                        textNodes[
                            index + 1
                        ],

                    offset: 0
                };
            }

            return {
                node,
                offset: length
            };
        }

        passed =
            nodeEnd;
    }

    const lastNode =
        textNodes[
            textNodes.length - 1
        ];

    return {
        node: lastNode,

        offset:
            lastNode.nodeValue
                ?.length || 0
    };
}

function selectEditorText(
    editor,
    start,
    end
) {
    const safeStart =
        Math.max(
            0,
            Number(start) || 0
        );

    const safeEnd =
        Math.max(
            safeStart,
            Number(end) ||
                safeStart
        );

    /*
     * Awal mention harus memilih node berikutnya
     * jika posisinya tepat di batas dua text node.
     */
    const startPoint =
        findEditorTextPoint(
            editor,
            safeStart,
            true
        );

    /*
     * Akhir mention tetap memilih ujung node saat ini.
     */
    const endPoint =
        findEditorTextPoint(
            editor,
            safeEnd,
            false
        );

    const range =
        document.createRange();

    range.setStart(
        startPoint.node,
        startPoint.offset
    );

    range.setEnd(
        endPoint.node,
        endPoint.offset
    );

    const selection =
        window.getSelection();

    selection.removeAllRanges();
    selection.addRange(
        range
    );
}

function editorFromToolbar(button) {
    if (!button) {
        return null;
    }

    /*
     * Toolbar reply masih berada di reply-editor.
     */
    const replyEditor =
        button.closest(
            ".reply-editor"
        );

    if (replyEditor) {
        return replyEditor.querySelector(
            ".feed-rich-editor"
        );
    }

    /*
     * Toolbar post sekarang berada di action row.
     * Cari editor dari form composer yang sama.
     */
    const composerForm =
        button.closest(
            ".feed-composer form"
        );

    if (composerForm) {
        return composerForm.querySelector(
            ".composer-input-area .feed-rich-editor"
        );
    }

    return null;
}

function ensureEditorSelection(editor) {
    const selection = window.getSelection();

    if (
        selection &&
        selection.rangeCount > 0 &&
        selection.anchorNode &&
        editor.contains(selection.anchorNode)
    ) {
        return selection;
    }

    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);

    selection?.removeAllRanges();
    selection?.addRange(range);

    return selection;
}

function getFormatCommand(format) {
    return {
        bold: "bold",
        italic: "italic",
        underline: "underline",
        bullet: "insertUnorderedList"
    }[format] || null;
}

function readFormatCommandState(command) {
    if (!command) return false;

    try {
        return Boolean(document.queryCommandState(command));
    } catch {
        return false;
    }
}

function toolbarFromEditor(editor) {
    if (!editor) return null;

    const replyEditor = editor.closest(".reply-editor");

    if (replyEditor) {
        return replyEditor.querySelector(".feed-format-toolbar");
    }

    return editor.closest(".feed-composer form")
        ?.querySelector(
            ".feed-composer-action-row .feed-format-toolbar"
        ) || null;
}

function setFormatButtonState(button, active) {
    if (!button || button.dataset.format === "clear") return;

    button.classList.toggle("is-active", Boolean(active));
    button.setAttribute("aria-pressed", String(Boolean(active)));
}

function clearToolbarButtonStates() {
    $$(".feed-format-button[data-format]").forEach(button => {
        setFormatButtonState(button, false);
    });
}

function syncRichEditorEmptyState(editor) {
    if (!editor) return;

    const text = editorPlainText(editor)
        .replace(/\u200B/g, "")
        .trim();

    editor.classList.toggle(
        "is-visually-empty",
        text.length === 0
    );
}

function syncFormatToolbar(editor) {
    const toolbar = toolbarFromEditor(editor);
    if (!toolbar) return;

    const selection = window.getSelection();

    if (
        !selection ||
        !selection.rangeCount ||
        !editor.contains(selection.anchorNode) ||
        !editor.contains(selection.focusNode)
    ) {
        return;
    }

    $$(".feed-format-button[data-format]", toolbar)
        .forEach(button => {
            const command =
                getFormatCommand(button.dataset.format);

            setFormatButtonState(
                button,
                command ? readFormatCommandState(command) : false
            );
        });
}

function activeRichEditor() {
    const node = window.getSelection()?.anchorNode;
    if (!node) return null;

    const element = node.nodeType === Node.ELEMENT_NODE
        ? node
        : node.parentElement;

    return element?.closest(".feed-rich-editor") || null;
}

function mentionBeforeCaret(
    editor
) {
    const selection =
        window.getSelection();

    if (
        !selection ||
        selection.rangeCount === 0 ||
        !selection.isCollapsed ||
        !selection.anchorNode ||
        !editor.contains(
            selection.anchorNode
        )
    ) {
        return null;
    }

    const anchorNode =
        selection.anchorNode;

    const anchorOffset =
        selection.anchorOffset;

    /*
     * Kondisi paling umum:
     *
     * [mention][NBSP]
     *                ↑ caret
     */
    if (
        anchorNode.nodeType ===
        Node.TEXT_NODE
    ) {
        const text =
            String(
                anchorNode.nodeValue ||
                ""
            );

        const textBeforeCaret =
            text.slice(
                0,
                anchorOffset
            );

        /*
         * Jangan hapus mention jika sebelum caret sudah
         * terdapat teks biasa yang ditulis pengguna.
         */
        if (
            !/^[\u00A0\u200B ]*$/.test(
                textBeforeCaret
            )
        ) {
            return null;
        }

        let candidate =
            anchorNode.previousSibling;

        while (
            candidate &&
            candidate.nodeType ===
                Node.TEXT_NODE &&
            !candidate.nodeValue
        ) {
            candidate =
                candidate.previousSibling;
        }

        if (
            candidate?.nodeType ===
                Node.ELEMENT_NODE &&
            candidate.matches(
                ".feed-editor-mention"
            )
        ) {
            return {
                mention: candidate,
                spacerNode:
                    anchorNode,

                spacerLength:
                    anchorOffset
            };
        }

        return null;
    }

    /*
     * Kondisi caret berada langsung pada parent:
     *
     * [mention]|
     */
    if (
        anchorNode.nodeType ===
        Node.ELEMENT_NODE
    ) {
        let candidate =
            anchorNode.childNodes[
                anchorOffset - 1
            ];

        let spacerNode =
            null;

        let spacerLength =
            0;

        if (
            candidate?.nodeType ===
            Node.TEXT_NODE &&
            /^[\u00A0\u200B ]*$/.test(
                candidate.nodeValue ||
                ""
            )
        ) {
            spacerNode =
                candidate;

            spacerLength =
                candidate.nodeValue
                    ?.length || 0;

            candidate =
                candidate.previousSibling;
        }

        if (
            candidate?.nodeType ===
                Node.ELEMENT_NODE &&
            candidate.matches(
                ".feed-editor-mention"
            )
        ) {
            return {
                mention: candidate,
                spacerNode,
                spacerLength
            };
        }
    }

    return null;
}

function deleteMentionBeforeCaret(
    event
) {
    if (
        event.key !== "Backspace" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
    ) {
        return;
    }

    const editor =
        event.target.closest?.(
            ".feed-rich-editor"
        );

    if (!editor) {
        return;
    }

    const target =
        mentionBeforeCaret(
            editor
        );

    if (!target) {
        return;
    }

    event.preventDefault();

    const parent =
        target.mention.parentNode;

    if (!parent) {
        return;
    }

    /*
     * Marker kosong mempertahankan posisi caret setelah
     * mention dan spasi tak terlihat dihapus.
     */
 const caretNode =
    document.createTextNode(
        ""
    );

parent.insertBefore(
    caretNode,
    target.mention
);

/*
 * Simpan node sebelum mention. Pada multiple mention,
 * node ini biasanya merupakan spasi milik mention
 * sebelumnya.
 */
const previousNode =
    caretNode.previousSibling;

target.mention.remove();

if (
    target.spacerNode &&
    target.spacerNode.isConnected &&
    target.spacerLength > 0
) {
    target.spacerNode.deleteData(
        0,
        target.spacerLength
    );
}

let caretTarget =
    caretNode;

let caretOffset = 0;

/*
 * Jika sebelum mention terdapat text node yang hanya
 * berisi spasi, pindahkan caret ke ujung spasi tersebut.
 *
 * Dengan begitu Backspace berikutnya langsung dapat
 * menemukan mention sebelumnya.
 */
if (
    previousNode?.nodeType ===
        Node.TEXT_NODE &&
    /^[\u00A0\u200B ]*$/.test(
        previousNode.nodeValue ||
        ""
    )
) {
    caretTarget =
        previousNode;

    caretOffset =
        previousNode.nodeValue
            ?.length || 0;

    /*
     * Marker kosong tidak diperlukan karena caret
     * sudah memiliki text node yang valid.
     */
    caretNode.remove();
}

const range =
    document.createRange();

range.setStart(
    caretTarget,
    caretOffset
);

range.collapse(true);

const selection =
    window.getSelection();

selection.removeAllRanges();

selection.addRange(
    range
);

    resetTypingFormatAfterMention(
        editor
    );

    editor.dispatchEvent(
        new Event(
            "input",
            {
                bubbles: true
            }
        )
    );
}

/*
 * Capture digunakan agar browser tidak sempat
 * menyeleksi elemen contenteditable=false terlebih dahulu.
 */
document.addEventListener(
    "keydown",
    deleteMentionBeforeCaret,
    true
);

function applyFeedFormatting(editor, format) {
    if (!editor) return;

    editor.focus();
    const selection = ensureEditorSelection(editor);

    document.execCommand("styleWithCSS", false, false);

    if (format === "clear") {
        if (selection?.isCollapsed) {
            ["bold", "italic", "underline"].forEach(command => {
                if (readFormatCommandState(command)) {
                    document.execCommand(command, false, null);
                }
            });
        } else {
            document.execCommand("removeFormat", false, null);
        }
    } else {
        const command = getFormatCommand(format);
        if (!command) return;

        document.execCommand(command, false, null);
    }

    syncRichEditorEmptyState(editor);
    syncFormatToolbar(editor);

    requestAnimationFrame(() => {
        syncFormatToolbar(editor);
    });
}

    async function request(url, options = {}) {
        const response = await fetch(url, { cache: "no-store", ...options });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
            location.href = "/index.html";
            throw new Error("Sesi admin berakhir.");
        }
        if (!response.ok || data.success === false) {
            throw new Error(data.message || `Request gagal (${response.status}).`);
        }
        return data;
    }

    function beginForeground() {
        state.foreground += 1;
    }

    function endForeground() {
        state.foreground = Math.max(0, state.foreground - 1);
    }

    function renderAvatar(element, type, name, pictureUrl) {
        if (!element) return;
        element.replaceChildren();
        element.textContent = type === "student" ? profileInitial(name) : teacherInitial(name);
if (
    !String(pictureUrl || "").trim()
) return;
        const img = document.createElement("img");
        img.className = "feed-profile-picture";
img.alt =
    type === "student"
        ? "Foto profil siswa"
        : "Foto profil admin atau guru";
        img.decoding = "async";
        img.addEventListener("load", () => element.isConnected && element.replaceChildren(img), { once: true });
        img.src = String(pictureUrl).trim();
    }

    function emptyReplies(container) {
        if (container && !$(".reply-item", container)) {
            container.innerHTML = "<small>Belum ada reply.</small>";
        }
    }

    function updateReplyCount(container) {
    if (!container) return;

    const card = container.closest(".feed-card");
    const count = container.querySelectorAll(".reply-item").length;
    const counter = card?.querySelector("[data-reply-count]");

    if (counter) {
        counter.textContent = String(count);
    }
}

function setRepliesOpen(card, open) {
    if (!card) return;

    const panel = $(".reply-collapsible", card);
    const button = $(".reply-toggle-button", card);

    if (!panel || !button) return;

    open = Boolean(open);

    const wasOpen =
        button.getAttribute("aria-expanded") === "true";

if (wasOpen === open) return;

if (open) {
    const replyForm =
        card.querySelector(
            ".admin-reply-form"
        );

    if (replyForm) {
        void prepareReplyMentions(
            replyForm
        );
    }
}

button.setAttribute("aria-expanded", String(open));

    const label = $("[data-reply-label]", button);

    if (label) {
        label.textContent = open
            ? "Sembunyikan replies"
            : "Tampilkan replies";
    }

    // Simpan kondisi visual saat ini, termasuk jika diklik cepat.
    const currentStyle = getComputedStyle(panel);

    const start = {
        height: panel.hidden
            ? 0
            : panel.getBoundingClientRect().height,
        opacity: panel.hidden
            ? 0
            : Number.parseFloat(currentStyle.opacity),
        paddingTop: panel.hidden
            ? "0px"
            : currentStyle.paddingTop,
        paddingBottom: panel.hidden
            ? "0px"
            : currentStyle.paddingBottom
    };

    if (panel._replyAnimation) {
        panel._replyAnimation.cancel();
        panel._replyAnimation = null;
    }

    const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reduceMotion || typeof panel.animate !== "function") {
        panel.hidden = !open;
        return;
    }

    panel.hidden = false;

    // Ukur ukuran dan padding asli setelah animasi lama dibatalkan.
    const naturalStyle = getComputedStyle(panel);

    const natural = {
        height: panel.getBoundingClientRect().height,
        opacity: Number.parseFloat(naturalStyle.opacity),
        paddingTop: naturalStyle.paddingTop,
        paddingBottom: naturalStyle.paddingBottom
    };

    const animation = panel.animate(
        [
            {
                boxSizing: "border-box",
                height: `${start.height}px`,
                opacity: start.opacity,
                paddingTop: start.paddingTop,
                paddingBottom: start.paddingBottom,
                minHeight: "0",
                overflow: "hidden"
            },
            {
                boxSizing: "border-box",
                height: open ? `${natural.height}px` : "0px",
                opacity: open ? natural.opacity : 0,
                paddingTop: open ? natural.paddingTop : "0px",
                paddingBottom: open ? natural.paddingBottom : "0px",
                minHeight: "0",
                overflow: "hidden"
            }
        ],
        {
            duration: 220,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            fill: "both"
        }
    );

    panel._replyAnimation = animation;

    animation.onfinish = () => {
        if (panel._replyAnimation !== animation) return;

        panel.hidden = !open;
        panel._replyAnimation = null;
        animation.cancel();
    };
}

    function ensureEmptyFeed() {
        if (!$("[id^='announcement-']", ui.list)) {
            ui.list.innerHTML = "<p>Belum ada announcement.</p>";
        }
    }

    function removeEmptyFeed() {
        const empty = $("p", ui.list);
        if (empty && empty.textContent.includes("Belum ada announcement")) empty.remove();
    }

    function applyFilter() {
        $$(":scope > [id^='announcement-']", ui.list).forEach(card => {
            const className = card.dataset.feedClass || "";
            card.style.display = state.filter === "all" ||
                (state.filter === "global" && !className) ||
                (state.filter.startsWith("class:") && className === state.filter.slice(6))
                ? "" : "none";
        });
    }

        // =====================================
    // CLASSROOM FEED POST IMAGE
    // =====================================

    const FEED_IMAGE_MAX_BYTES =
        2 * 1024 * 1024;

    const FEED_IMAGE_ACCEPTED_TYPES =
        new Set([
            "image/jpeg",
            "image/png",
            "image/webp"
        ]);


    function setFeedImageDialogStatus(
        message = "",
        type = ""
    ) {

        ui.imageDialogStatus.textContent =
            message;

        ui.imageDialogStatus.classList.remove(
            "is-error",
            "is-success"
        );

        if (type) {
            ui.imageDialogStatus.classList.add(
                `is-${type}`
            );
        }

    }


    function releaseFeedDialogObjectUrl() {

        if (!state.dialogImageObjectUrl) {
            return;
        }


        URL.revokeObjectURL(
            state.dialogImageObjectUrl
        );

        state.dialogImageObjectUrl =
            null;

    }


    function releaseAttachedFeedImageObjectUrl() {

        if (
            state.postImage?.type !== "file" ||
            !state.postImage.previewUrl
        ) {
            return;
        }


        URL.revokeObjectURL(
            state.postImage.previewUrl
        );

    }


    function loadFeedImageSource(
        source
    ) {

        return new Promise(
            (
                resolve,
                reject
            ) => {

                const image =
                    new Image();

                let finished =
                    false;


                const timeout =
                    window.setTimeout(
                        () => {

                            if (finished) return;

                            finished =
                                true;

                            reject(
                                new Error(
                                    "Gambar terlalu lama dimuat."
                                )
                            );

                        },
                        15000
                    );


                image.referrerPolicy =
                    "no-referrer";


                image.onload =
                    () => {

                        if (finished) return;

                        finished =
                            true;

                        window.clearTimeout(
                            timeout
                        );

                        const width =
                            Number(
                                image.naturalWidth
                            );

                        const height =
                            Number(
                                image.naturalHeight
                            );


                        if (
                            width <= 0 ||
                            height <= 0
                        ) {
                            reject(
                                new Error(
                                    "Dimensi gambar tidak valid."
                                )
                            );

                            return;
                        }


                        resolve({
                            image,
                            width,
                            height
                        });

                    };


                image.onerror =
                    () => {

                        if (finished) return;

                        finished =
                            true;

                        window.clearTimeout(
                            timeout
                        );

                        reject(
                            new Error(
                                "Gambar tidak dapat dimuat."
                            )
                        );

                    };


                image.src =
                    source;

            }
        );

    }


    function validateFeedImageFile(
        file
    ) {

        if (
            !file ||
            !FEED_IMAGE_ACCEPTED_TYPES.has(
                file.type
            )
        ) {
            throw new Error(
                "Gunakan gambar JPEG, PNG, atau WebP."
            );
        }


        if (
            file.size >
            FEED_IMAGE_MAX_BYTES
        ) {
            throw new Error(
                "Ukuran gambar maksimal 2 MB."
            );
        }

    }


    function loadFeedImageFile(
        file
    ) {

        return new Promise(
            (
                resolve,
                reject
            ) => {

                const objectUrl =
                    URL.createObjectURL(
                        file
                    );

                const image =
                    new Image();


                image.onload =
                    () => {

                        URL.revokeObjectURL(
                            objectUrl
                        );

                        resolve(
                            image
                        );

                    };


                image.onerror =
                    () => {

                        URL.revokeObjectURL(
                            objectUrl
                        );

                        reject(
                            new Error(
                                "File gambar tidak dapat dibaca."
                            )
                        );

                    };


                image.src =
                    objectUrl;

            }
        );

    }


    function convertFeedCanvasToWebp(
        canvas,
        quality
    ) {

        return new Promise(
            (
                resolve,
                reject
            ) => {

                canvas.toBlob(
                    blob => {

                        if (!blob) {
                            reject(
                                new Error(
                                    "Gambar tidak dapat dikompres."
                                )
                            );

                            return;
                        }


                        resolve(
                            blob
                        );

                    },
                    "image/webp",
                    quality
                );

            }
        );

    }


    async function compressFeedImageFile(
        file
    ) {

        validateFeedImageFile(
            file
        );


        const sourceImage =
            await loadFeedImageFile(
                file
            );

        const originalWidth =
            Number(
                sourceImage.naturalWidth ||
                sourceImage.width
            );

        const originalHeight =
            Number(
                sourceImage.naturalHeight ||
                sourceImage.height
            );


        if (
            originalWidth <= 0 ||
            originalHeight <= 0
        ) {
            throw new Error(
                "Dimensi gambar tidak valid."
            );
        }


        const maximumDimension =
            1600;

        const scale =
            Math.min(
                1,
                maximumDimension /
                    Math.max(
                        originalWidth,
                        originalHeight
                    )
            );

        const outputWidth =
            Math.max(
                1,
                Math.round(
                    originalWidth *
                    scale
                )
            );

        const outputHeight =
            Math.max(
                1,
                Math.round(
                    originalHeight *
                    scale
                )
            );


        const canvas =
            document.createElement(
                "canvas"
            );

        canvas.width =
            outputWidth;

        canvas.height =
            outputHeight;


        const context =
            canvas.getContext(
                "2d",
                {
                    alpha:
                        true
                }
            );


        if (!context) {
            throw new Error(
                "Gambar tidak dapat diproses."
            );
        }


        context.imageSmoothingEnabled =
            true;

        context.imageSmoothingQuality =
            "high";

        context.drawImage(
            sourceImage,
            0,
            0,
            outputWidth,
            outputHeight
        );


        let compressedBlob =
            await convertFeedCanvasToWebp(
                canvas,
                0.82
            );


        if (
            compressedBlob.size >
            FEED_IMAGE_MAX_BYTES
        ) {
            compressedBlob =
                await convertFeedCanvasToWebp(
                    canvas,
                    0.7
                );
        }


        if (
            compressedBlob.size >
            FEED_IMAGE_MAX_BYTES
        ) {
            throw new Error(
                "Gambar tetap melebihi 2 MB setelah dikompres."
            );
        }


        return compressedBlob;

    }


    function buildFeedImageDisplayUrl(
        originalUrl
    ) {

        const safeUrl =
            String(
                originalUrl || ""
            );


        if (
            !safeUrl.includes(
                "/image/upload/"
            ) ||
            safeUrl.includes(
                "/image/upload/c_limit,w_1200/"
            )
        ) {
            return safeUrl;
        }


        return safeUrl.replace(
            "/image/upload/",
            "/image/upload/c_limit,w_1200/q_auto:good/f_auto/"
        );

    }


    function normalizeUploadedFeedImage(
        rawImage
    ) {

        const originalUrl =
            String(
                rawImage?.secure_url ||
                rawImage?.url ||
                ""
            ).trim();

        const publicId =
            String(
                rawImage?.public_id ||
                rawImage?.publicId ||
                ""
            ).trim();

        const width =
            Math.trunc(
                Number(
                    rawImage?.width
                )
            );

        const height =
            Math.trunc(
                Number(
                    rawImage?.height
                )
            );

        const bytes =
            Math.trunc(
                Number(
                    rawImage?.bytes
                )
            );


        if (
            !originalUrl ||
            !publicId ||
            !Number.isFinite(width) ||
            !Number.isFinite(height) ||
            !Number.isFinite(bytes) ||
            width <= 0 ||
            height <= 0 ||
            bytes <= 0
        ) {
            throw new Error(
                "Data gambar hasil upload tidak valid."
            );
        }


        if (
            bytes >
            FEED_IMAGE_MAX_BYTES
        ) {
            throw new Error(
                "Ukuran gambar maksimal 2 MB."
            );
        }


        return {
            imageUrl:
                buildFeedImageDisplayUrl(
                    originalUrl
                ),

            imagePublicId:
                publicId,

            imageWidth:
                width,

            imageHeight:
                height,

            imageBytes:
                bytes
        };

    }


    async function uploadFeedImageFile(
        file
    ) {

        const compressedBlob =
            await compressFeedImageFile(
                file
            );


        const signatureData =
            await request(
                "/api/classroom-feed/image-upload-signature",
                {
                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({})
                }
            );


        const formData =
            new FormData();

        formData.append(
            "file",
            compressedBlob,
            "class-feed-image.webp"
        );


        Object.entries(
            signatureData.parameters ||
            {}
        ).forEach(
            ([
                parameterName,
                parameterValue
            ]) => {

                formData.append(
                    parameterName,
                    String(
                        parameterValue
                    )
                );

            }
        );


        formData.append(
            "api_key",
            signatureData.apiKey
        );

        formData.append(
            "signature",
            signatureData.signature
        );


        const uploadResponse =
            await fetch(
                signatureData.uploadUrl,
                {
                    method:
                        "POST",

                    body:
                        formData
                }
            );


        if (!uploadResponse.ok) {
            throw new Error(
                "Gambar tidak dapat diunggah."
            );
        }


        const uploadResult =
            await uploadResponse.json();


        return normalizeUploadedFeedImage(
            uploadResult
        );

    }


    async function deleteUploadedFeedImage(
        publicId
    ) {

        if (!publicId) {
            return true;
        }


        try {

            const response =
                await fetch(
                    "/api/classroom-feed/image",
                    {
                        method:
                            "DELETE",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                publicId
                            })
                    }
                );


            return response.ok;

        } catch (error) {

            console.error(
                "Gagal membersihkan upload gambar:",
                error
            );

            return false;

        }

    }


    function renderAttachedFeedPostImage() {

        const selected =
            state.postImage;


        if (!selected) {

            ui.imageAttachment.hidden =
                true;

            ui.imageAttachmentPreview
                .removeAttribute("src");

            ui.imageAttachmentSource
                .textContent =
                "Siap ditambahkan";

            ui.imageButton.classList.remove(
                "is-active"
            );

            ui.imageButton.setAttribute(
                "aria-pressed",
                "false"
            );

            return;

        }


        ui.imageAttachmentPreview.src =
            selected.previewUrl ||
            selected.url;

        ui.imageAttachmentSource.textContent =
            selected.type === "file"
                ? selected.file.name
                : "URL eksternal";

        ui.imageAttachment.hidden =
            false;

        ui.imageButton.classList.add(
            "is-active"
        );

        ui.imageButton.setAttribute(
            "aria-pressed",
            "true"
        );

    }


    function clearAttachedFeedPostImage() {

        releaseAttachedFeedImageObjectUrl();

        state.postImage =
            null;

        renderAttachedFeedPostImage();

    }


    function renderFeedImageDialogCandidate() {

        const selected =
            state.dialogPostImage;


        if (!selected) {

            ui.imageDialogPreview.hidden =
                true;

            ui.imageDialogPreview
                .removeAttribute("src");

            ui.imageDialogEmpty.hidden =
                false;

            ui.imageDialogClear.hidden =
                true;

            ui.imageDialogConfirm.disabled =
                true;

            return;

        }


        ui.imageDialogPreview.src =
            selected.previewUrl ||
            selected.url;

        ui.imageDialogPreview.hidden =
            false;

        ui.imageDialogEmpty.hidden =
            true;

        ui.imageDialogClear.hidden =
            false;

        ui.imageDialogConfirm.disabled =
            false;

    }


    function setFeedImageDialogBusy(
        busy
    ) {

        state.imageDialogBusy =
            busy;

        ui.imageDialogFile.disabled =
            busy;

        ui.imageDialogUrl.disabled =
            busy;

        ui.imageDialogCheckUrl.disabled =
            busy;

        ui.imageDialogClear.disabled =
            busy;

        ui.imageDialogCancel.disabled =
            busy;

        ui.imageDialogClose.disabled =
            busy;

        ui.imageDialogConfirm.disabled =
            busy ||
            !state.dialogPostImage;

    }


    function openFeedImageDialog() {

        releaseFeedDialogObjectUrl();

        state.dialogPostImage =
            state.postImage
                ? {
                    ...state.postImage
                }
                : null;

        ui.imageDialogFile.value =
            "";

        ui.imageDialogUrl.value =
            state.postImage?.type === "url"
                ? state.postImage.url
                : "";

        setFeedImageDialogStatus();
        renderFeedImageDialogCandidate();
        setFeedImageDialogBusy(false);

        ui.imageDialogOverlay.hidden =
            false;

        document.body.classList.add(
            "feed-image-dialog-open"
        );

    }


    function closeFeedImageDialog() {

        if (state.imageDialogBusy) {
            return;
        }


        releaseFeedDialogObjectUrl();

        state.dialogPostImage =
            null;

        ui.imageDialogOverlay.hidden =
            true;

        document.body.classList.remove(
            "feed-image-dialog-open"
        );

        ui.imageDialogFile.value =
            "";

        setFeedImageDialogStatus();

    }


    async function selectFeedImageDialogFile() {

        const file =
            ui.imageDialogFile.files?.[0];


        if (!file) {
            return;
        }


        try {

            validateFeedImageFile(
                file
            );

            setFeedImageDialogBusy(
                true
            );

            setFeedImageDialogStatus(
                "Membaca gambar..."
            );

            releaseFeedDialogObjectUrl();


            const objectUrl =
                URL.createObjectURL(
                    file
                );

            state.dialogImageObjectUrl =
                objectUrl;


            const imageInformation =
                await loadFeedImageSource(
                    objectUrl
                );


            state.dialogPostImage = {
                type:
                    "file",

                file,

                url:
                    null,

                previewUrl:
                    objectUrl,

                width:
                    imageInformation.width,

                height:
                    imageInformation.height
            };


            ui.imageDialogUrl.value =
                "";

            renderFeedImageDialogCandidate();

            setFeedImageDialogStatus(
                "Gambar siap ditambahkan.",
                "success"
            );

        } catch (error) {

            releaseFeedDialogObjectUrl();

            state.dialogPostImage =
                null;

            ui.imageDialogFile.value =
                "";

            renderFeedImageDialogCandidate();

            setFeedImageDialogStatus(
                error.message,
                "error"
            );

        } finally {

            setFeedImageDialogBusy(
                false
            );

        }

    }


    async function checkFeedImageDialogUrl() {

        const rawUrl =
            ui.imageDialogUrl.value.trim();


        let parsedUrl;

        try {

            parsedUrl =
                new URL(rawUrl);

        } catch {

            setFeedImageDialogStatus(
                "URL gambar tidak valid.",
                "error"
            );

            return;
        }


        if (
            parsedUrl.protocol !==
            "https:"
        ) {
            setFeedImageDialogStatus(
                "URL gambar harus menggunakan HTTPS.",
                "error"
            );

            return;
        }


        try {

            setFeedImageDialogBusy(
                true
            );

            setFeedImageDialogStatus(
                "Memeriksa gambar..."
            );


            const imageInformation =
                await loadFeedImageSource(
                    parsedUrl.href
                );


            releaseFeedDialogObjectUrl();

            ui.imageDialogFile.value =
                "";

            state.dialogPostImage = {
                type:
                    "url",

                file:
                    null,

                url:
                    parsedUrl.href,

                previewUrl:
                    parsedUrl.href,

                width:
                    imageInformation.width,

                height:
                    imageInformation.height
            };


            renderFeedImageDialogCandidate();

            setFeedImageDialogStatus(
                "URL gambar berhasil diperiksa.",
                "success"
            );

        } catch (error) {

            state.dialogPostImage =
                null;

            renderFeedImageDialogCandidate();

            setFeedImageDialogStatus(
                error.message,
                "error"
            );

        } finally {

            setFeedImageDialogBusy(
                false
            );

        }

    }


    function clearFeedImageDialogCandidate() {

        if (state.imageDialogBusy) {
            return;
        }


        releaseFeedDialogObjectUrl();

        state.dialogPostImage =
            null;

        ui.imageDialogFile.value =
            "";

        ui.imageDialogUrl.value =
            "";

        setFeedImageDialogStatus();
        renderFeedImageDialogCandidate();

    }


    function confirmFeedImageDialog() {

        if (
            state.imageDialogBusy ||
            !state.dialogPostImage
        ) {
            return;
        }


        const previousImage =
            state.postImage;

        const nextImage =
            state.dialogPostImage;


        if (
            previousImage?.type === "file" &&
            previousImage.previewUrl &&
            previousImage.previewUrl !==
                nextImage.previewUrl
        ) {
            URL.revokeObjectURL(
                previousImage.previewUrl
            );
        }


        state.postImage = {
            ...nextImage
        };


        /*
            Object URL sekarang dimiliki attachment,
            sehingga jangan dihapus saat dialog ditutup.
        */
        if (
            state.dialogImageObjectUrl ===
            state.postImage.previewUrl
        ) {
            state.dialogImageObjectUrl =
                null;
        }


        state.dialogPostImage =
            null;

        renderAttachedFeedPostImage();
        closeFeedImageDialog();

    }


    async function prepareFeedPostImage() {

        const selected =
            state.postImage;


        if (!selected) {
            return {
                imageUrl:
                    null,

                imagePublicId:
                    null,

                imageWidth:
                    null,

                imageHeight:
                    null,

                imageBytes:
                    null
            };
        }


        if (selected.type === "url") {
            return {
                imageUrl:
                    selected.url,

                imagePublicId:
                    null,

                imageWidth:
                    selected.width,

                imageHeight:
                    selected.height,

                imageBytes:
                    null
            };
        }


        return uploadFeedImageFile(
            selected.file
        );

    }


    function feedPostImageMarkup(
        post
    ) {

        const imageUrl =
            String(
                post?.image_url ||
                post?.imageUrl ||
                ""
            ).trim();


        if (!imageUrl) {
            return "";
        }


        const width =
            Number(
                post?.image_width ||
                post?.imageWidth
            );

        const height =
            Number(
                post?.image_height ||
                post?.imageHeight
            );


        const widthAttribute =
            Number.isFinite(width) &&
            width > 0
                ? ` width="${Math.round(width)}"`
                : "";

        const heightAttribute =
            Number.isFinite(height) &&
            height > 0
                ? ` height="${Math.round(height)}"`
                : "";


        return `
            <div class="feed-post-image-frame is-loading">
                <img
                    class="feed-post-image"
                    src="${escapeHtml(imageUrl)}"
                    alt="Gambar post"
                    loading="lazy"
                    decoding="async"
                    referrerpolicy="no-referrer"
                    ${widthAttribute}
                    ${heightAttribute}
                >
            </div>
        `;

    }


    function initializeFeedPostImageControls() {

        ui.imageButton.addEventListener(
            "click",
            openFeedImageDialog
        );

        ui.imageRemoveButton.addEventListener(
            "click",
            clearAttachedFeedPostImage
        );

        ui.imageDialogFile.addEventListener(
            "change",
            selectFeedImageDialogFile
        );

        ui.imageDialogCheckUrl.addEventListener(
            "click",
            checkFeedImageDialogUrl
        );

        ui.imageDialogClear.addEventListener(
            "click",
            clearFeedImageDialogCandidate
        );

        ui.imageDialogCancel.addEventListener(
            "click",
            closeFeedImageDialog
        );

        ui.imageDialogClose.addEventListener(
            "click",
            closeFeedImageDialog
        );

        ui.imageDialogConfirm.addEventListener(
            "click",
            confirmFeedImageDialog
        );


        ui.imageDialogUrl.addEventListener(
            "input",
            () => {

                if (
                    state.dialogPostImage?.type ===
                    "url"
                ) {
                    state.dialogPostImage =
                        null;

                    renderFeedImageDialogCandidate();
                }


                setFeedImageDialogStatus();

            }
        );


        ui.imageDialogUrl.addEventListener(
            "keydown",
            event => {

                if (event.key !== "Enter") {
                    return;
                }

                event.preventDefault();
                checkFeedImageDialogUrl();

            }
        );


        ui.imageDialogOverlay.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    ui.imageDialogOverlay
                ) {
                    closeFeedImageDialog();
                }

            }
        );


        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Escape" &&
                    !ui.imageDialogOverlay.hidden
                ) {
                    closeFeedImageDialog();
                }

            }
        );


        renderAttachedFeedPostImage();

    }

function createReplyItem(
    postId,
    reply
) {

    const type =
        reply.sender_type ||
        (
            reply.admin_id
                ? "admin"
                : "student"
        );


    const name =
        reply.sender_name ||
        reply.student_name ||
        (
            type === "admin"
                ? "Admin / Guru"
                : "Siswa"
        );


    const detail =
        type === "admin"
            ? "Teacher"
            : (
                reply.class_name ||
                "-"
            );


    const picture =
        reply.profile_picture_url ||
        reply.student_profile_picture_url ||
        "";


    const item =
        document.createElement(
            "article"
        );


    item.id =
        `reply-${reply.id}`;


    item.className =
        "reply-item feed-thread-reply";


    item.innerHTML = `
        <div class="reply-thread-layout">

            <div class="reply-avatar"></div>


            <div class="reply-thread-content">

                <div class="reply-thread-header">

                    <div class="reply-author-info">

                        <strong>

                            ${escapeHtml(name)}

                            ${
                                type === "admin"
                                    ? teacherBadge()
                                    : ""
                            }

                        </strong>


                        <div class="reply-author-meta">

                            <span>
                                ${escapeHtml(detail)}
                            </span>


                            <span
                                class="reply-meta-separator"
                                aria-hidden="true"
                            >
                                •
                            </span>


                            <time
                                class="reply-inline-time"
                                data-relative-time
                                datetime="${escapeHtml(
                                    reply.created_at ||
                                    ""
                                )}"
                            >

                                ${escapeHtml(
                                    relativeTime(
                                        reply.created_at
                                    )
                                )}

                            </time>

                        </div>

                    </div>

                </div>


<div class="feed-text-collapse">

    <div
        id="reply-text-${Number(reply.id)}"
        class="
            reply-message
            feed-collapsible-text
            feed-collapsible-reply
        "
    >

        ${formatMessage(
            reply.message,
            reply.mentions
        )}

    </div>


    <button
        type="button"
        class="feed-text-toggle"
        data-action="toggle-feed-text"
        aria-controls="reply-text-${Number(
            reply.id
        )}"
        aria-expanded="false"
        hidden
    >
        Lihat selengkapnya
    </button>

</div>


                <button
                    type="button"
                    class="
                        reply-delete-button
                        feed-delete-button
                        reply-delete-corner
                    "
                    data-action="delete-reply"
                    data-post-id="${Number(
                        postId
                    )}"
                    data-reply-id="${Number(
                        reply.id
                    )}"
                >
                    Hapus
                </button>

            </div>

        </div>
    `;


renderAvatar(
    $(".reply-avatar", item),
    type,
    name,
    picture
);


queueFeedTextCollapse(
    item
);


return item;

}

    function createPostCard(post) {
        const isStudent = Number(post.student_id ?? post.studentId ?? 0) > 0;
        const name = isStudent
            ? (post.student_creator_name || post.studentName || "Siswa")
            : (post.admin_creator_name || "Admin / Guru");
const detail =
    isStudent
        ? (
            post.student_creator_class ||
            post.class_name ||
            "-"
        )
        : "Teacher";
const picture =
    isStudent
        ? (
            post.student_creator_profile_picture_url ||
            post.student_profile_picture_url ||
            post.studentProfilePictureUrl ||
            ""
        )
        : (
            post.admin_creator_profile_picture_url ||
            post.admin_profile_picture_url ||
            post.adminProfilePictureUrl ||
            ""
        );
        const card = document.createElement("div");
        card.id = `announcement-${post.id}`;
card.className = [
    "feed-card",
    "admin-feed-card",
    "classroom-feed-post",
    String(post.message || "").trim()
        ? "has-feed-text"
        : "without-feed-text",
    String(post.image_url || post.imageUrl || "").trim()
        ? "has-feed-image"
        : "without-feed-image"
].join(" ");
        card.dataset.feedClass = post.class_name || "";
 card.innerHTML = `
    <header class="feed-card-header">
        <div class="feed-author">
            <div class="feed-avatar"></div>

            <div class="feed-author-copy">
                <div class="feed-author-name">
                    <strong>${escapeHtml(name)}</strong>
                    ${isStudent ? "" : teacherBadge()}
                </div>

                <div class="feed-author-meta">
                    <span>${escapeHtml(
                        isStudent ? detail : "Teacher"
                    )}</span>

                    <span
                        class="feed-meta-separator"
                        aria-hidden="true"
                    >•</span>

<time
    data-relative-time
    datetime="${escapeHtml(post.created_at || "")}"
>
    ${escapeHtml(relativeTime(post.created_at))}
</time>
                </div>
            </div>
        </div>

        <span
            class="feed-scope-badge ${
                post.class_name ? "class" : "global"
            }"
        >
            ${post.class_name
                ? escapeHtml(post.class_name)
                : "GLOBAL"}
        </span>
    </header>

    <div class="feed-card-body">
<div class="feed-text-collapse">

    <div
        id="post-text-${Number(post.id)}"
        class="
            feed-message
            feed-collapsible-text
            feed-collapsible-post
        "
    >

        ${formatMessage(
            post.message,
            post.mentions
        )}

    </div>


    <button
        type="button"
        class="feed-text-toggle"
        data-action="toggle-feed-text"
        aria-controls="post-text-${Number(
            post.id
        )}"
        aria-expanded="false"
        hidden
    >
        Lihat selengkapnya
    </button>

</div>

${feedPostImageMarkup(post)}
    </div>

    <div class="feed-card-actions">
        <div class="feed-card-primary-actions">
            <button
                type="button"
                class="
                    feed-card-action-button
                    feed-like-button
                    feed-upcoming-action
                "
                disabled
                aria-disabled="true"
                title="Like segera hadir"
                aria-label="Like segera hadir"
            >
<svg
    class="feed-like-icon"
    viewBox="0 0 24 24"
    aria-hidden="true"
>
    <path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"
    ></path>
</svg>
                <span data-like-count>0</span>
            </button>

            <button
                type="button"
                class="feed-card-action-button reply-toggle-button"
                data-action="toggle-replies"
                aria-expanded="false"
                aria-controls="admin-reply-panel-${Number(post.id)}"
            >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                        d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-4.5 3v-3H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"
                    ></path>
                </svg>

                <span
                    data-reply-label
                    class="feed-visually-hidden"
                >Tampilkan replies</span>

                <span data-reply-count>0</span>
            </button>
        </div>

        <button
            type="button"
            class="feed-card-action-button feed-delete-button"
            data-action="delete-post"
            data-post-id="${Number(post.id)}"
        >
            Hapus
        </button>
    </div>

    <div class="reply-section">
        <div
            id="admin-reply-panel-${Number(post.id)}"
            class="reply-collapsible"
            hidden
        >

            <div
                id="admin-replies-${post.id}"
                class="reply-list"
            >
                <small>Belum ada reply.</small>
            </div>

            <form
                class="admin-reply-form reply-composer"
                data-id="${Number(post.id)}"
            >
                <div class="reply-editor">
                    <div
                        class="admin-reply-input reply-input feed-rich-editor"
                        contenteditable="true"
                        role="textbox"
                        aria-multiline="true"
                        data-placeholder="Tulis balasan..."
                        spellcheck="true"
                    ></div>

                    ${formatToolbarMarkup()}

                    <div
                        class="admin-mention-suggestions mention-suggestions"
                        style="display:none;"
                    ></div>
                </div>

                <button
                    type="submit"
                    class="reply-send-button student-modern-primary-button"
                >
                    Balas
                </button>
            </form>
        </div>
    </div>
`;
        renderAvatar($(".feed-avatar", card), isStudent ? "student" : "admin", name, picture);
                const postImage =
            $(".feed-post-image", card);

        if (postImage) {

            const imageFrame =
                postImage.closest(
                    ".feed-post-image-frame"
                );


            const markImageLoaded =
                () => {

                    imageFrame?.classList.remove(
                        "is-loading",
                        "is-error"
                    );

                };


            const markImageFailed =
                () => {

                    imageFrame?.classList.remove(
                        "is-loading"
                    );

                    imageFrame?.classList.add(
                        "is-error"
                    );

                };


            postImage.addEventListener(
                "load",
                markImageLoaded,
                {
                    once:
                        true
                }
            );

            postImage.addEventListener(
                "error",
                markImageFailed,
                {
                    once:
                        true
                }
            );


            /*
                Gambar cache mungkin sudah selesai dimuat
                sebelum event listener dipasang.
            */
            if (postImage.complete) {

                if (
                    postImage.naturalWidth > 0
                ) {
                    markImageLoaded();
                } else {
                    markImageFailed();
                }

            }

        }
        const container = $(`#admin-replies-${post.id}`, card);
        const replies = Array.isArray(post.replies) ? post.replies : [];
        if (replies.length) {
            container.innerHTML = "";
            replies.forEach(reply => {
                state.latestReplyId = Math.max(state.latestReplyId, Number(reply.id));
                container.appendChild(createReplyItem(post.id, reply));
            });
        }
updateReplyCount(container);

queueFeedTextCollapse(
    card
);

return card;
    }

    function addPost(post, position = "prepend") {
        if (!post || document.getElementById(`announcement-${post.id}`)) return;
        removeEmptyFeed();
        const card = createPostCard(post);
        position === "append" ? ui.list.appendChild(card) : ui.list.prepend(card);
        state.latestPostId = Math.max(state.latestPostId, Number(post.id));
        applyFilter();
    }

    async function loadAnnouncements(append = false) {
        if (state.loading || (append && !state.hasMore)) return;
        state.loading = true;
        if (!append) {
            ui.list.innerHTML = `
    <div
        class="classroom-feed-loading-panel"
        role="status"
        aria-live="polite"
    >
        <span
            class="classroom-feed-loading-spinner"
            aria-hidden="true"
        ></span>

        <div class="classroom-feed-loading-copy">
            <strong>Memuat feed</strong>
        </div>
    </div>
`;
            state.beforeId = null;
            state.latestPostId = 0;
            state.latestReplyId = 0;
        } else {
            ui.loadMoreStatus.hidden = false;
        }
        try {
            const url = append && state.beforeId
                ? `/api/admin/announcements/page?beforeId=${encodeURIComponent(state.beforeId)}`
                : "/api/admin/announcements/page";
            const data = await request(url);
            if (!append) ui.list.innerHTML = "";
            (data.announcements || []).forEach(post => addPost(post, "append"));
            state.hasMore = Boolean(data.pagination?.hasMore);
            state.beforeId = data.pagination?.nextBeforeId ? Number(data.pagination.nextBeforeId) : null;
            ui.loadMoreWrap.hidden = !state.hasMore;
            ensureEmptyFeed();
            scrollToStoredTarget();
        } catch (error) {
            if (!append) ui.list.textContent = error.message || "Gagal mengambil announcement.";
        } finally {
            state.loading = false;
            ui.loadMoreStatus.hidden = true;
        }
    }

    async function submitPost(event) {

        event.preventDefault();


        const text =
            editorToMarkup(
                ui.message
            );


        if (
            !text &&
            !state.postImage
        ) {
            ui.status.textContent =
                "Isi post atau tambahkan satu gambar.";

            return;
        }


        const button =
            $(
                "button[type='submit']",
                ui.form
            );

        const target =
            $(
                "input[name='target']:checked"
            )?.value ||
            "global";

        const className =
            target === "class"
                ? ui.classSelect.value.trim()
                : "";


        if (
            target === "class" &&
            !className
        ) {
            ui.status.textContent =
                "Pilih kelas terlebih dahulu.";

            return;
        }


        button.disabled =
            true;

        button.textContent =
            "Memposting...";

        ui.imageButton.disabled =
            true;

        ui.imageRemoveButton.disabled =
            true;

        ui.status.textContent =
            state.postImage?.type === "file"
                ? "Mengunggah gambar..."
                : "Membuat announcement...";


        beginForeground();


        let uploadedImage =
            null;


        try {

            const imageData =
                await prepareFeedPostImage();


            if (imageData.imagePublicId) {
                uploadedImage =
                    imageData;
            }


            if (uploadedImage) {
                ui.status.textContent =
                    "Menyimpan post...";
            }


            const mentions =
                mergeTypedMentions(
                    text,
                    state.postMentions,
                    state.postMentionUsers
                );


            const data =
                await request(
                    "/api/admin/announcements",
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                adminId,
                                message:
                                    text,

                                className,
                                mentions,

                                ...imageData
                            })
                    }
                );


            /*
                Post sudah tersimpan. Jangan jalankan
                cleanup orphan setelah titik ini.
            */
            uploadedImage =
                null;


            addPost(
                data.announcement
            );

            ui.form.reset();
ui.message.replaceChildren();
syncRichEditorEmptyState(ui.message);

            clearAttachedFeedPostImage();

            ui.classWrap.style.display =
                "none";

            ui.classSelect.required =
                false;

            state.postMentions =
                [];

            hideSuggestions(
                ui.mentionBox
            );

            ui.status.textContent =
                "Announcement berhasil dibuat.";

        } catch (error) {

            if (uploadedImage?.imagePublicId) {

                await deleteUploadedFeedImage(
                    uploadedImage.imagePublicId
                );

            }


            ui.status.textContent =
                error.message ||
                "Post gagal dipublikasikan.";

        } finally {

            endForeground();

            button.disabled =
                false;

            button.textContent =
                "Posting";

            ui.imageButton.disabled =
                false;

            ui.imageRemoveButton.disabled =
                false;

        }

    }

    async function submitReply(event) {
        event.preventDefault();
        const form = event.target;
        const postId = Number(form.dataset.id);
        const input = $(".reply-input", form);
        const button = $("button[type='submit']", form);
        const text = editorToMarkup(input);
        if (!text) return;
        button.disabled = true;
        button.textContent = "Menambahkan...";
        beginForeground();
        try {
            const users = form._mentionUsers || [];
            const mentions = mergeTypedMentions(text, form._selectedMentions || [], users);
            const data = await request(`/api/admin/announcements/${postId}/replies`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ adminId, message: text, mentions })
            });
            const container = $(`#admin-replies-${postId}`);
if (
    container &&
    !document.getElementById(
        `reply-${data.reply.id}`
    )
) {
    $("small", container)?.remove();

    container.appendChild(
        createReplyItem(
            postId,
            data.reply
        )
    );

    state.latestReplyId = Math.max(
        state.latestReplyId,
        Number(data.reply.id)
    );

    updateReplyCount(container);
}
input.replaceChildren();
syncRichEditorEmptyState(input);
            form._selectedMentions = [];
} catch (error) {
    const message = error.message || "Gagal mengirim reply.";

    if (/announcement.*(tidak ditemukan|not found)/i.test(message)) {
        document
            .getElementById(`announcement-${postId}`)
            ?.remove();

        ensureEmptyFeed();

        alert(
            "Post ini sudah dihapus di perangkat lain."
        );
    } else {
        alert(message);
    }
} finally {
            endForeground();
            button.disabled = false;
            button.textContent = "Kirim";
        }
    }

    async function deletePost(postId, button) {
        if (!confirm("Yakin ingin menghapus announcement ini? Semua reply dan mention di dalamnya juga akan dihapus.")) return;
        button.disabled = true;
        button.textContent = "Menghapus...";
        beginForeground();
        try {
            await request(`/api/admin/announcements/${postId}`, { method: "DELETE" });
            document.getElementById(`announcement-${postId}`)?.remove();
            ensureEmptyFeed();
        } catch (error) {
            button.disabled = false;
            button.textContent = "Hapus";
            alert(error.message);
        } finally {
            endForeground();
        }
    }

    async function deleteReply(postId, replyId, button) {
        if (!confirm("Yakin ingin menghapus reply ini?")) return;
        button.disabled = true;
        button.textContent = "Menghapus...";
        beginForeground();
        try {
            await request(`/api/admin/announcements/${postId}/replies/${replyId}`, { method: "DELETE" });
            const item = document.getElementById(`reply-${replyId}`);
            const container = item?.closest(".reply-list") || $(`#admin-replies-${postId}`);
item?.remove();
emptyReplies(container);
updateReplyCount(container);
        } catch (error) {
            button.disabled = false;
            button.textContent = "Hapus";
            alert(error.message);
        } finally {
            endForeground();
        }
    }

function mergeTypedMentions(
    text,
    selected,
    users
) {
    const normalizedText =
        String(text || "");

    /*
     * Buang selected mention yang sudah dihapus
     * dari editor.
     */
    const result =
        [...selected].filter(item =>
            normalizedText.includes(
                `@${item.name}`
            )
        );

    users.forEach(user => {
        const mentionText =
            `@${user.name}`;

        const alreadyAdded =
            result.some(item =>
                Number(item.id) ===
                    Number(user.id) &&
                item.type ===
                    user.type
            );

        if (
            normalizedText.includes(
                mentionText
            ) &&
            !alreadyAdded
        ) {
            result.push({
                id: user.id,
                type: user.type,
                name: user.name
            });
        }
    });

    return result;
}

function hideSuggestions(box) {
    if (!box) return;

    box.innerHTML = "";
    box.style.display = "none";
}

function showMentionLoading(box) {
    if (!box) return;

    box.innerHTML = `
        <div
            class="feed-mention-loading"
            role="status"
        >
            Memuat pengguna...
        </div>
    `;

    box.style.display = "block";
}

function promoteTypedMention(
    input,
    users,
    selected
) {
    if (
        !input ||
        input._promotingMention
    ) {
        return false;
    }

    const query =
        activeMentionQuery(input);

    if (query === null) {
        return false;
    }

    const typedName =
        query.trim();

    if (!typedName) {
        return false;
    }

    const matchedUser =
        users.find(user =>
            String(user.name || "")
                .trim()
                .toLowerCase() ===
            typedName.toLowerCase()
        );

    if (!matchedUser) {
        return false;
    }

    input._promotingMention =
        true;

    try {
        insertMention(
            input,
            matchedUser,
            selected
        );
    } finally {
        input._promotingMention =
            false;
    }

    return true;
}

    function suggestionLabel(user) {
        return user.type === "student"
            ? `${user.name} (Student — ${user.className || "-"})`
            : `${user.name} (${user.role || "Admin / Guru"})`;
    }

function escapeMentionPattern(
    value
) {
    return String(value || "")
        .replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );
}

function decoratePastedMentions(
    editor,
    users,
    selected
) {
    if (
        !editor ||
        !Array.isArray(users) ||
        !users.length
    ) {
        return;
    }

    /*
     * Nama terpanjang diproses lebih dahulu.
     * Contoh: "Budi Santoso" tidak boleh berhenti
     * pada pengguna lain bernama "Budi".
     */
    const validUsers =
        [...users]
            .filter(user =>
                String(
                    user.name || ""
                ).trim()
            )
            .sort(
                (a, b) =>
                    String(b.name || "")
                        .length -
                    String(a.name || "")
                        .length
            );

    if (!validUsers.length) {
        return;
    }

    const usersByName =
        new Map();

    validUsers.forEach(user => {
        const key =
            String(user.name)
                .trim()
                .toLowerCase();

        if (
            !usersByName.has(key)
        ) {
            usersByName.set(
                key,
                user
            );
        }
    });

    const namesPattern =
        validUsers
            .map(user =>
                escapeMentionPattern(
                    String(
                        user.name
                    ).trim()
                )
            )
            .join("|");

    /*
     * Karakter setelah nama tidak boleh huruf,
     * angka, atau underscore. Ini mencegah @Budi
     * terdeteksi di dalam teks seperti @Budiman.
     */
    const mentionPattern =
        new RegExp(
            `@(?:${namesPattern})(?![\\p{L}\\p{N}_])`,
            "giu"
        );

    /*
     * Simpan posisi caret sebelum text node diganti.
     * Panjang teks tidak berubah saat dibungkus span,
     * sehingga offset bisa dipulihkan setelah proses.
     */
    const selection =
        window.getSelection();

    const restoreCaret =
        selection &&
        selection.rangeCount > 0 &&
        selection.isCollapsed &&
        selection.focusNode &&
        editor.contains(
            selection.focusNode
        );

    const savedCaretOffset =
        restoreCaret
            ? getEditorCaretOffset(
                  editor
              )
            : null;

    const walker =
        document.createTreeWalker(
            editor,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode(node) {
                    const parent =
                        node.parentElement;

                    if (
                        !parent ||
                        parent.closest(
                            [
                                ".feed-editor-mention",
                                "[data-mention-caret-marker]"
                            ].join(",")
                        )
                    ) {
                        return NodeFilter
                            .FILTER_REJECT;
                    }

                    return String(
                        node.nodeValue ||
                        ""
                    ).includes("@")
                        ? NodeFilter
                              .FILTER_ACCEPT
                        : NodeFilter
                              .FILTER_REJECT;
                }
            }
        );

    const textNodes = [];
    let textNode;

    while (
        (
            textNode =
                walker.nextNode()
        )
    ) {
        textNodes.push(
            textNode
        );
    }

    let decoratedCount = 0;

    textNodes.forEach(node => {
        const value =
            String(
                node.nodeValue || ""
            );

        mentionPattern.lastIndex = 0;

        let match;
        let lastIndex = 0;
        let hasMatch = false;

        const fragment =
            document.createDocumentFragment();

        while (
            (
                match =
                    mentionPattern.exec(
                        value
                    )
            )
        ) {
            const matchedText =
                match[0];

            const matchedName =
                matchedText.slice(1);

            const user =
                usersByName.get(
                    matchedName
                        .toLowerCase()
                );

            if (!user) {
                continue;
            }

            hasMatch = true;

            fragment.append(
                document.createTextNode(
                    value.slice(
                        lastIndex,
                        match.index
                    )
                )
            );

            const mention =
                document.createElement(
                    "span"
                );

            mention.className =
                "feed-editor-mention";

            mention.dataset.mentionId =
                String(user.id);

            mention.dataset.mentionType =
                String(
                    user.type ||
                    "student"
                );

            mention.contentEditable =
                "false";

            /*
             * Pertahankan huruf persis seperti hasil paste.
             */
            mention.textContent =
                matchedText;

            fragment.append(
                mention
            );

            if (
                !selected.some(item =>
                    Number(item.id) ===
                        Number(user.id) &&
                    item.type ===
                        user.type
                )
            ) {
                selected.push({
                    id: user.id,
                    type: user.type,
                    name: user.name
                });
            }

            decoratedCount += 1;

            lastIndex =
                match.index +
                matchedText.length;
        }

        if (!hasMatch) {
            return;
        }

        /*
         * Tetap buat text node meskipun string sisanya
         * kosong. Ini menyediakan lokasi caret setelah
         * mention yang berada di akhir teks.
         */
        fragment.append(
            document.createTextNode(
                value.slice(lastIndex)
            )
        );

        node.replaceWith(
            fragment
        );
    });

    if (!decoratedCount) {
        return;
    }

    if (
        restoreCaret &&
        Number.isInteger(
            savedCaretOffset
        )
    ) {
        const caretPoint =
            findEditorTextPoint(
                editor,
                savedCaretOffset,
                true
            );

        const caretRange =
            document.createRange();

        caretRange.setStart(
            caretPoint.node,
            caretPoint.offset
        );

        caretRange.collapse(true);

        const currentSelection =
            window.getSelection();

        currentSelection.removeAllRanges();

        currentSelection.addRange(
            caretRange
        );
    }

    resetTypingFormatAfterMention(
        editor
    );

    syncRichEditorEmptyState(
        editor
    );

    /*
     * Perbarui toolbar tanpa menjalankan autocomplete
     * terhadap mention yang baru dibungkus.
     */
    const previousPromotingState =
        Boolean(
            editor._promotingMention
        );

    editor._promotingMention =
        true;

    editor.dispatchEvent(
        new Event(
            "input",
            {
                bubbles: true
            }
        )
    );

    editor._promotingMention =
        previousPromotingState;
}

function activeMentionQuery(input) {
    const selection =
        window.getSelection();

    if (
        !selection ||
        selection.rangeCount === 0 ||
        !selection.focusNode ||
        !input.contains(
            selection.focusNode
        )
    ) {
        input._mentionStart = null;
        input._mentionEnd = null;

        return null;
    }

    /*
     * Ambil teks langsung dari awal editor sampai caret.
     *
     * Jangan gabungkan innerText dengan offset Range karena
     * keduanya dapat menghitung baris contenteditable secara
     * berbeda pada teks panjang dan elemen berformat.
     */
    const range =
        document.createRange();

    range.selectNodeContents(
        input
    );

    try {
        range.setEnd(
            selection.focusNode,
            selection.focusOffset
        );
    } catch (error) {
        input._mentionStart = null;
        input._mentionEnd = null;

        return null;
    }

    const completeBeforeCaret =
        range
            .toString()
            .replace(/\u00a0/g, " ");

    /*
     * Cukup periksa 100 karakter terakhir.
     * Nama pengguna tidak mungkin membutuhkan seluruh post.
     */
    const searchStart =
        Math.max(
            0,
            completeBeforeCaret.length -
                100
        );

    const nearbyText =
        completeBeforeCaret.slice(
            searchStart
        );

    const localAtIndex =
        nearbyText.lastIndexOf("@");

    if (localAtIndex < 0) {
        input._mentionStart = null;
        input._mentionEnd = null;

        return null;
    }

    const query =
        nearbyText.slice(
            localAtIndex + 1
        );

    if (
        query.includes("\n") ||
        query.includes("\r") ||
        query.includes("@")
    ) {
        input._mentionStart = null;
        input._mentionEnd = null;

        return null;
    }

    /*
     * Offset ini sekarang berasal dari Range.toString().
     * Sistemnya sama dengan selectEditorText() yang berjalan
     * melalui seluruh text node di dalam editor.
     */
    input._mentionStart =
        searchStart +
        localAtIndex;

    input._mentionEnd =
        completeBeforeCaret.length;

    return query
        .trimStart()
        .toLowerCase();
}

function resetTypingFormatAfterMention(
    editor
) {
    if (!editor) return;

    /*
     * Browser terkadang mewariskan format mention
     * ke posisi pengetikan setelahnya.
     */
    [
        "bold",
        "italic",
        "underline",
        "strikeThrough"
    ].forEach(command => {
        try {
            if (
                document.queryCommandState(
                    command
                )
            ) {
                document.execCommand(
                    command,
                    false,
                    null
                );
            }
        } catch (error) {
            /*
             * Browser lama boleh mengabaikan command
             * yang tidak didukung.
             */
        }
    });

    getEditorFormatStates(
        editor
    ).clear();

    syncFormatToolbar(
        editor
    );
}

function insertMention(
    input,
    user,
    selected
) {
    const start =
        Number(
            input._mentionStart
        );

    const end =
        Number(
            input._mentionEnd
        );

    if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 0 ||
        end < start
    ) {
        return;
    }

    const name =
        String(
            user.name ||
            "Pengguna"
        ).trim();

    const type =
        String(
            user.type ||
            "student"
        );

    input.focus();

    /*
     * Pilih hanya teks mulai dari @ sampai caret.
     */
    selectEditorText(
        input,
        start,
        end
    );

    const selection =
        window.getSelection();

    if (
        !selection ||
        selection.rangeCount === 0 ||
        !selection.anchorNode ||
        !input.contains(
            selection.anchorNode
        )
    ) {
        return;
    }

    const range =
        selection
            .getRangeAt(0)
            .cloneRange();

    /*
     * Buat elemen mention secara langsung.
     * Tidak memakai insertHTML agar browser tidak
     * memindahkannya ke block atau baris berikutnya.
     */
    const mentionNode =
        document.createElement(
            "span"
        );

    mentionNode.className =
        "feed-editor-mention";

    mentionNode.dataset.mentionId =
        String(user.id);

    mentionNode.dataset.mentionType =
        type;

    mentionNode.contentEditable =
        "false";

    mentionNode.textContent =
        `@${name}`;

    /*
     * Spasi diletakkan sebagai text node normal agar
     * caret dapat berada tepat setelah mention.
     */
    const trailingSpace =
        document.createTextNode(
            "\u00A0"
        );

    const fragment =
        document.createDocumentFragment();

    fragment.append(
        mentionNode,
        trailingSpace
    );

    /*
     * Hapus @ atau query yang sedang diketik,
     * lalu masukkan mention pada lokasi Range yang sama.
     */
    range.deleteContents();

    range.insertNode(
        fragment
    );

    /*
     * Pindahkan caret setelah mention dan spasi.
     * Mention tidak terseleksi dan tidak pindah baris.
     */
    const caretRange =
        document.createRange();

    caretRange.setStart(
        trailingSpace,
        trailingSpace.nodeValue.length
    );

    caretRange.collapse(true);

    selection.removeAllRanges();

    selection.addRange(
        caretRange
    );

    if (
        !selected.some(item =>
            Number(item.id) ===
                Number(user.id) &&
            item.type === type
        )
    ) {
        selected.push({
            id: user.id,
            type,
            name
        });
    }

    input._mentionStart =
        null;

    input._mentionEnd =
        null;

    syncRichEditorEmptyState(
        input
    );

    /*
     * Jangan wariskan font-weight mention ke teks
     * yang akan diketik setelahnya.
     */
    resetTypingFormatAfterMention(
        input
    );

    /*
     * Perbarui editor tanpa menjalankan autocomplete
     * sekali lagi terhadap mention yang baru dibuat.
     */
    const previousPromotingState =
        Boolean(
            input._promotingMention
        );

    input._promotingMention =
        true;

    input.dispatchEvent(
        new Event(
            "input",
            {
                bubbles: true
            }
        )
    );

    input._promotingMention =
        previousPromotingState;
}

function renderSuggestions(
    input,
    box,
    users,
    selected
) {
    /*
     * Setelah autocomplete dipilih, callback request atau
     * input programmatic tidak boleh membuka panel kembali.
     */
    if (
        input._mentionSuggestionsDismissed
    ) {
        hideSuggestions(box);
        return;
    }

    const query =
        activeMentionQuery(input);

    if (query === null) {
        hideSuggestions(box);
        return;
    }

const normalizedQuery =
    String(query || "")
        .trim()
        .toLowerCase();

const matches =
    [...users]
        .filter(user => {
            if (!normalizedQuery) {
                return true;
            }

            return String(
                user.name || ""
            )
                .toLowerCase()
                .includes(
                    normalizedQuery
                );
        })
        .sort((a, b) =>
            String(a.name || "")
                .localeCompare(
                    String(b.name || ""),
                    "id",
                    {
                        sensitivity:
                            "base"
                    }
                )
        )
        .slice(0, 12);

    hideSuggestions(box);

    matches.forEach(user => {
        const name = String(user.name || "Pengguna").trim();

        const className = String(
            user.className || user.class_name || ""
        ).trim();

        const isStudent = user.type === "student";

        const detail = isStudent
            ? className
                ? `Student · ${className}`
                : "Student"
            : user.role || "Teacher";

        const picture =
            user.profile_picture_url ||
            user.profilePictureUrl ||
            "";

        const button = document.createElement("button");

        button.type = "button";
        button.className = "feed-mention-option";

        button.innerHTML = `
            <span class="feed-mention-avatar"></span>

            <span class="feed-mention-option-copy">
                <strong>${escapeHtml(name)}</strong>
                <small>${escapeHtml(detail)}</small>
            </span>

            <span
                class="feed-mention-insert-icon"
                aria-hidden="true"
            >↵</span>
        `;

        renderAvatar(
            $(".feed-mention-avatar", button),
            isStudent ? "student" : "admin",
            name,
            picture
        );

        // Pertahankan posisi caret saat memilih mention.
        button.addEventListener("mousedown", event => {
            event.preventDefault();
        });

button.addEventListener(
    "click",
    () => {
        input._mentionSuggestionsDismissed =
            true;

        hideSuggestions(
            box
        );

        insertMention(
            input,
            user,
            selected
        );

        hideSuggestions(
            box
        );
    }
);

        box.appendChild(button);
    });

    box.style.display = matches.length ? "block" : "none";
}

async function loadPostMentionUsers() {
    if (state.postMentionLoaded) {
        return state.postMentionUsers;
    }

    if (state.postMentionPromise) {
        return state.postMentionPromise;
    }

    const currentPromise =
        Promise.all([
            request(
                "/api/admin/students"
            ),

            request(
                "/api/admin/users/mention-list"
            )
        ]);

    state.postMentionPromise =
        currentPromise;

    try {
        const [
            studentsData,
            adminsData
        ] = await currentPromise;

        state.postMentionUsers = [
            ...(
                studentsData.students ||
                []
            ).map(item => ({
                id: item.id,
                name: item.name,
                type: "student",

                className:
                    item.class_name,

                profile_picture_url:
                    item.profile_picture_url ||
                    item.profilePictureUrl ||
                    ""
            })),

            ...(
                adminsData.admins ||
                []
            ).map(item => ({
                id: item.id,
                name: item.name,
                type: "admin",
                role: item.role,

                profile_picture_url:
                    item.profile_picture_url ||
                    item.profilePictureUrl ||
                    ""
            }))
        ];

        state.postMentionLoaded =
            true;

        return state.postMentionUsers;
    } catch (error) {
        state.postMentionUsers = [];

        state.postMentionLoaded =
            false;

        console.error(
            "Gagal memuat mention post:",
            error
        );

        return [];
    } finally {
        if (
            state.postMentionPromise ===
            currentPromise
        ) {
            state.postMentionPromise =
                null;
        }
    }
}

    function availablePostMentionUsers() {
        const target = $("input[name='target']:checked")?.value || "global";
        const className = ui.classSelect.value;
        return target === "class"
            ? state.postMentionUsers.filter(user => user.type !== "student" || user.className === className)
            : state.postMentionUsers;
    }

async function prepareReplyMentions(form) {
    if (
        Array.isArray(
            form._mentionUsers
        )
    ) {
        return form._mentionUsers;
    }

    if (form._mentionPromise) {
        return form._mentionPromise;
    }

    form._mentionLoading = true;

    form._mentionPromise = request(
        `/api/mentions/users?announcementId=${encodeURIComponent(
            form.dataset.id
        )}`
    )
        .then(data => {
            form._mentionUsers =
                Array.isArray(data.users)
                    ? data.users
                    : [];

            return form._mentionUsers;
        })
        .catch(error => {
            console.error(
                "Gagal memuat mention reply:",
                error
            );

            form._mentionUsers = [];

            return form._mentionUsers;
        })
        .finally(() => {
            form._mentionLoading =
                false;

            form._mentionPromise =
                null;
        });

    return form._mentionPromise;
}

    async function loadClasses() {
        if (state.classesLoaded) return;
        try {
            const data = await request("/api/admin/classes");
            ui.classSelect.innerHTML = '<option value="">Pilih kelas</option>';
            ui.filter.innerHTML = '<option value="all">Semua</option><option value="global">Global</option>';
            (data.classes || []).forEach(item => {
                ui.classSelect.add(new Option(item.name, item.name));
                ui.filter.add(new Option(item.name, `class:${item.name}`));
            });
            state.classesLoaded = true;
        } catch (error) {
            console.error("Gagal mengambil kelas:", error);
        }
    }

    async function checkLivePosts() {
        const data = await request(`/api/admin/announcements/live?afterId=${state.latestPostId}`);
        (data.announcements || []).forEach(post => addPost(post));
    }

async function checkLiveReplies() {
    const data = await request(
        `/api/admin/replies/live?afterId=${state.latestReplyId}`
    );

    (data.replies || []).forEach(reply => {
        state.latestReplyId = Math.max(
            state.latestReplyId,
            Number(reply.id)
        );

        if (
            document.getElementById(
                `reply-${reply.id}`
            )
        ) {
            return;
        }

        const container = $(
            `#admin-replies-${reply.announcement_id}`
        );

        if (!container) return;

        $("small", container)?.remove();

        container.appendChild(
            createReplyItem(
                reply.announcement_id,
                reply
            )
        );

        updateReplyCount(container);
    });
}

    async function checkLiveDeletes() {
        const data = await request("/api/admin/classroom-feed/state");
        const posts = new Set((data.announcementIds || []).map(String));
        const replies = new Set((data.replies || []).map(item => String(item.id)));
        $$(":scope > [id^='announcement-']", ui.list).forEach(card => {
            if (!posts.has(card.id.slice(13))) card.remove();
        });
        $$(".reply-item", ui.list).forEach(item => {
            if (!replies.has(item.id.slice(6))) {
                const container = item.closest(".reply-list");
                item.remove();
emptyReplies(container);
updateReplyCount(container);
            }
        });
        ensureEmptyFeed();
    }

async function liveTick() {
    if (
        state.pollRunning ||
        state.loading ||
        state.foreground ||
        document.visibilityState !== "visible"
    ) return;

    state.pollRunning = true;

    try {
        await Promise.allSettled([
            checkLivePosts(),
            checkLiveReplies(),
            checkLiveDeletes(),
            loadNotificationCount()
        ]);
    } finally {
        state.pollRunning = false;
    }
}

function startPolling() {
    if (!state.pollTimer) {
        state.pollTimer = setInterval(
            liveTick,
            6000
        );
    }
}

    function stopPolling() {
        clearInterval(state.pollTimer);
        state.pollTimer = null;
    }

    function notificationItem(notification) {
        const item = document.createElement("div");
        item.id = `notification-${notification.id}`;
        item.className = `notification${Number(notification.is_read) === 0 ? " unread" : ""}`;
        item.innerHTML = `${Number(notification.is_read) === 0 ? '<span class="notification-unread-dot" aria-label="Belum dibaca"></span>' : ""}
<div class="notification-content">
    <div class="notification-message">
        ${formatNotificationMessage(notification.message)}
    </div>

    <span class="notification-time">
        ${escapeHtml(dateTime(notification.created_at))}
    </span>
</div>

<span class="notification-arrow">→</span>`;
        item.addEventListener("click", () => openNotification(notification, item));
        return item;
    }

    async function loadNotificationPanel() {
ui.notificationList.innerHTML = `
    <div
        class="notification-panel-loading"
        role="status"
        aria-label="Memuat notifikasi"
    ></div>
`;
        try {
            const data = await request(`/api/admin/${adminId}/notifications`);
            ui.notificationList.innerHTML = "";
            if (!(data.notifications || []).length) {
                ui.notificationList.innerHTML = '<div class="empty-state"><strong>Belum ada notifikasi</strong><span>Aktivitas baru akan muncul di sini.</span></div>';
            } else {
                data.notifications.forEach(item => ui.notificationList.appendChild(notificationItem(item)));
            }
            updateBadge(Number(data.unreadCount || 0));
        } catch (error) {
            ui.notificationList.textContent = "Gagal mengambil notifikasi.";
        }
    }

    async function loadNotificationCount() {
        try {
            const data = await request(`/api/admin/${adminId}/notifications`);
            updateBadge(Number(data.unreadCount || 0));
        } catch (error) {
            console.error("Gagal mengambil notifikasi:", error);
        }
    }

    function updateBadge(count) {
        ui.notificationBadge.textContent = count > 0 ? String(count) : "";
    }

    function markNotificationRead(notification, item) {
        if (Number(notification.is_read) !== 0) return;
        notification.is_read = 1;
        item?.classList.remove("unread");
        updateBadge(Math.max(0, Number(ui.notificationBadge.textContent || 0) - 1));
        request(`/api/notifications/${notification.id}/read`, { method: "PATCH" }).catch(loadNotificationCount);
    }

    async function openNotification(notification, item) {
        markNotificationRead(notification, item);
        closeAdminNotifications();
        if (!notification.announcement_id) return;
        sessionStorage.setItem("notificationAnnouncementId", String(notification.announcement_id));
        sessionStorage.setItem("notificationReplyId", String(notification.reply_id || ""));
        if (!scrollToStoredTarget()) await loadNotificationTarget(notification.announcement_id);
        scrollToStoredTarget();
    }

    async function loadNotificationTarget(postId) {
            const validPostId = Number(postId);

    if (
        !Number.isSafeInteger(validPostId) ||
        validPostId <= 0
    ) {
        sessionStorage.removeItem("notificationAnnouncementId");
        sessionStorage.removeItem("notificationReplyId");
        return;
    }

    postId = validPostId;
        if (state.notificationTargetLoading) return;
        state.notificationTargetLoading = true;
        try {
            const data = await request(`/api/admin/announcements/page?targetId=${encodeURIComponent(postId)}`);
            (data.announcements || []).forEach(post => addPost(post));
        } catch (error) {
            console.error("Gagal membuka target notifikasi:", error);
        } finally {
            state.notificationTargetLoading = false;
        }
    }

function scrollToStoredTarget() {
    const postId = sessionStorage.getItem(
        "notificationAnnouncementId"
    );

    const replyId = sessionStorage.getItem(
        "notificationReplyId"
    );

    if (!postId) return false;

    const target = replyId
        ? document.getElementById(
            `reply-${replyId}`
        )
        : document.getElementById(
            `announcement-${postId}`
        );

    if (!target) return false;

if (replyId) {

    setRepliesOpen(
        target.closest(".feed-card"),
        true
    );

}


expandNotificationText(
    target
);


/*
 * Data target langsung dibersihkan agar pemanggilan
     * scroll berikutnya tidak menjadwalkan scroll kedua.
     */
    sessionStorage.removeItem(
        "notificationAnnouncementId"
    );

    sessionStorage.removeItem(
        "notificationReplyId"
    );

    /*
     * Tunggu dua frame:
     * frame pertama membuka reply-collapsible,
     * frame kedua menghitung posisi reply yang baru terlihat.
     */
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            target.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });

            target.style.outline =
                "3px solid #2563eb";

            target.style.outlineOffset =
                "4px";

            const clearHighlight = () => {
                target.style.outline = "";
                target.style.outlineOffset = "";

                document.removeEventListener(
                    "click",
                    clearHighlight,
                    true
                );
            };

            setTimeout(() => {
                document.addEventListener(
                    "click",
                    clearHighlight,
                    {
                        capture: true,
                        once: true
                    }
                );
            }, 0);

            setTimeout(
                clearHighlight,
                5000
            );
        });
    });

    return true;
}

    function goToNotifications() {
ui.notificationOverlay.style.display = "flex";

document.body.style.overflow =
    "hidden";

document.body.classList.add(
    "feed-notification-open"
);

loadNotificationPanel();
    }

    function closeAdminNotifications() {
ui.notificationOverlay.style.display = "none";

document.body.style.overflow =
    "";

document.body.classList.remove(
    "feed-notification-open"
);
    }

    function formatDuration(minutes) {
        const total = Number(minutes || 0);
        if (total <= 0) return "-";
        const days = Math.floor(total / 1440);
        const hours = Math.floor((total % 1440) / 60);
        const mins = total % 60;
        return [[days, "hari"], [hours, "jam"], [mins, "menit"]].filter(([n]) => n).map(([n, unit]) => `${n} ${unit}`).join(" ") || "0 menit";
    }

    function formatCountdown(ms) {
        const seconds = Math.max(0, Math.floor(ms / 1000));
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const rest = seconds % 60;
        return `${days ? `${days} Hari, ` : ""}${hours || days ? `${hours} Jam, ` : ""}${minutes || hours || days ? `${minutes} Menit, ` : ""}${rest} Detik`;
    }

    function syncModerationClock(serverNow, started, ended) {
        const server = new Date(serverNow).getTime();
        if (!Number.isNaN(server)) moderation.serverOffset = server - (started + (ended - started) / 2);
    }

    function moderationNow() {
        return Date.now() + moderation.serverOffset;
    }

    async function loadModeration() {
        if (moderation.loading) return;
        moderation.loading = true;
        const started = Date.now();
        try {
            const data = await request("/api/admin/feed-moderation/students");
            syncModerationClock(data.serverNow, started, Date.now());
            moderation.students = data.students || [];
            moderation.actions = data.moderationActions || [];
            renderModerationStudents();
            renderModerationFilters();
            renderModerationLog();
        } catch (error) {
            console.error("Gagal mengambil moderation:", error);
        } finally {
            moderation.loading = false;
        }
    }

    function renderModerationStudents() {
        const select = $("#feedModerationStudent");
        const previous = select.value;
        select.innerHTML = '<option value="">Pilih siswa</option>';
        moderation.students.forEach(student => select.add(new Option(`${student.name} — ${student.class_name || "Tanpa kelas"}`, student.id)));
        select.disabled = false;
        if (moderation.students.some(student => String(student.id) === previous)) select.value = previous;
        renderSelectedModerationStudent();
    }

    function renderSelectedModerationStudent() {
        const id = Number($("#feedModerationStudent").value);
        moderation.selected = moderation.students.find(item => Number(item.id) === id) || null;
        const panel = $("#feedModerationSelectedStudent");
        const muteButton = $("#feedModerationMuteButton");
        const banButton = $("#feedModerationBanButton");
        if (!moderation.selected) {
            panel.style.display = "none";
            muteButton.disabled = true;
            banButton.disabled = true;
            return;
        }
        const student = moderation.selected;
        const isBanned = student.moderation_status === "banned";
        const isMuted = student.moderation_status === "muted" || moderation.actions.some(action => Number(action.student_id) === id && action.action_type === "mute");
        $("#feedModerationStudentName").textContent = student.name;
        $("#feedModerationStudentClass").textContent = student.class_name || "Tanpa kelas";
        const status = $("#feedModerationSelectedStatus");
        status.textContent = isBanned ? "Di ban" : isMuted ? "Di mute" : "Aman";
        status.className = `feed-moderation-selected-status ${isBanned ? "banned" : isMuted ? "muted" : "safe"}`;
        muteButton.disabled = isBanned;
        banButton.disabled = isBanned;
        panel.style.display = "flex";
    }

    function renderModerationFilters() {
        const select = $("#feedModerationLogFilter");
        const previous = moderation.filter;
        const map = new Map();
        moderation.actions.forEach(action => map.set(String(action.student_id), `${action.student_name || "Siswa"} — ${action.student_class || "Tanpa kelas"}`));
        select.innerHTML = '<option value="all">Semua siswa</option>';
        [...map].sort((a, b) => a[1].localeCompare(b[1], "id")).forEach(([id, label]) => select.add(new Option(label, id)));
        moderation.filter = previous === "all" || map.has(previous) ? previous : "all";
        select.value = moderation.filter;
    }

    function remaining(action) {
        if (action.status !== "active" || !action.ends_at) return null;
        const end = new Date(action.ends_at).getTime();
        return Number.isNaN(end) ? null : Math.max(0, end - moderationNow());
    }

    function renderModerationLog() {
        const container = $("#feedModerationLog");
        const actions = moderation.filter === "all" ? moderation.actions : moderation.actions.filter(item => String(item.student_id) === moderation.filter);
        $("#feedModerationLogCount").textContent = String(actions.length);
        if (!actions.length) {
            container.innerHTML = '<div class="feed-moderation-log-empty">Belum ada moderation aktif.</div>';
            return;
        }
        container.innerHTML = "";
        actions.forEach(action => {
            const active = action.status === "active";
            const ban = action.action_type === "ban";
            const timer = ban ? "Sampai dihapus" : active ? formatCountdown(remaining(action) ?? 0) : formatDuration(action.duration_minutes);
            const card = document.createElement("article");
            card.className = "feed-moderation-log-card";
            card.dataset.actionId = action.id;
            card.innerHTML = `
                <div class="feed-moderation-log-card-header"><div><strong>${escapeHtml(action.student_name || "Siswa")}</strong><span>${escapeHtml(action.student_class || "Tanpa kelas")}</span></div>
                <span class="feed-moderation-action-status ${active ? "active" : "queued"}">${active ? "Aktif" : "Antrean"}</span></div>
                <div class="feed-moderation-action-type">${ban ? "BAN" : "MUTE"}</div>
                <div class="feed-moderation-action-timer"><small>${ban ? "Berlaku" : active ? "Sisa waktu" : "Durasi antrean"}</small>
                <strong class="${ban ? "" : "feed-moderation-action-countdown"}" data-action-id="${action.id}">${escapeHtml(timer)}</strong></div>
                ${!ban && active && action.ends_at ? `<div class="feed-moderation-action-meta"><small>Berakhir</small><span>${escapeHtml(dateTime(action.ends_at))}</span></div>` : ""}
                <div class="feed-moderation-action-meta"><small>Alasan</small><span>${escapeHtml(action.reason || "Tidak ada alasan.")}</span></div>
                <div class="feed-moderation-action-meta"><small>Diberikan oleh</small><span>${escapeHtml(action.moderator_name || "Admin / Guru")}${action.moderator_role ? ` — ${escapeHtml(action.moderator_role)}` : ""}</span></div>
                <div class="feed-moderation-action-meta"><small>Dibuat</small><span>${escapeHtml(dateTime(action.created_at))}</span></div>
                <div class="feed-moderation-card-actions"><button type="button" class="feed-moderation-delete-action" data-action="delete-moderation" data-action-id="${Number(action.id)}">Hapus</button></div>`;
            container.appendChild(card);
        });
    }

    function updateModerationCountdowns() {
        moderation.actions.forEach(action => {
            if (action.action_type === "ban" || action.status !== "active") return;
            const element = $(`.feed-moderation-action-countdown[data-action-id='${action.id}']`);
            if (element) element.textContent = formatCountdown(remaining(action) ?? 0);
        });
    }

    async function deleteModerationAction(actionId, button) {
        if (moderation.deleting || !confirm("Yakin ingin menghapus tindakan moderation ini?")) return;
        moderation.deleting = true;
        if (button) { button.disabled = true; button.textContent = "Menghapus..."; }
        try {
            await request(`/api/admin/feed-moderation/actions/${actionId}`, { method: "DELETE" });
            await loadModeration();
        } catch (error) {
            alert(error.message);
            if (button) { button.disabled = false; button.textContent = "Hapus"; }
        } finally {
            moderation.deleting = false;
        }
    }

    function openFeedModeration() {
        $("#feedModerationOverlay").style.display = "flex";
        document.body.style.overflow = "hidden";
        loadModeration();
        clearInterval(moderation.liveTimer);
        clearInterval(moderation.countdownTimer);
        moderation.liveTimer = setInterval(loadModeration, 5000);
        moderation.countdownTimer = setInterval(updateModerationCountdowns, 1000);
    }

    function closeFeedModeration() {
        $("#feedModerationOverlay").style.display = "none";
        document.body.style.overflow = "";
        clearInterval(moderation.liveTimer);
        clearInterval(moderation.countdownTimer);
        moderation.liveTimer = null;
        moderation.countdownTimer = null;
        closeFeedMutePanel();
        closeFeedBanPanel();
    }

    function setFeedMuteDuration(minutes) {
        moderation.muteMinutes = Number(minutes);
        $("#feedMuteMinutes").value = String(minutes % 60);
        $("#feedMuteHours").value = String(Math.floor((minutes % 1440) / 60));
        $("#feedMuteDays").value = String(Math.floor(minutes / 1440));
    }

    function customMuteMinutes() {
        return Number($("#feedMuteMinutes").value || 0) + Number($("#feedMuteHours").value || 0) * 60 + Number($("#feedMuteDays").value || 0) * 1440;
    }

    function openFeedMutePanel() {
        if (!moderation.selected) return;
        moderation.muteTargetId = Number(moderation.selected.id);
        $("#feedMuteOverlay").style.display = "flex";
        setFeedMuteDuration(30);
        $("#feedMuteReason").value = "";
    }

    function closeFeedMutePanel() {
        $("#feedMuteOverlay").style.display = "none";
        moderation.muteTargetId = null;
    }

    async function confirmFeedMute() {
        const id = moderation.muteTargetId;
        const minutes = customMuteMinutes();
        if (!Number.isInteger(minutes) || minutes < 1 || minutes > 10080) return alert("Durasi mute harus antara 1 menit dan 7 hari.");
        const button = $("#feedMuteConfirmButton");
        button.disabled = true;
        button.textContent = "Menyimpan...";
        try {
            await request(`/api/admin/feed-moderation/${id}/mute`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ durationMinutes: minutes, reason: $("#feedMuteReason").value.trim() })
            });
            closeFeedMutePanel();
            await loadModeration();
        } catch (error) {
            alert(error.message);
        } finally {
            button.disabled = false;
            button.textContent = "Mute";
        }
    }

    function openFeedBanPanel() {
        if (!moderation.selected) return;
        moderation.banTargetId = Number(moderation.selected.id);
        $("#feedBanOverlay").style.display = "flex";
        $("#feedBanReason").value = "";
    }

    function closeFeedBanPanel() {
        $("#feedBanOverlay").style.display = "none";
        moderation.banTargetId = null;
    }

    async function confirmFeedBan() {
        const button = $("#feedBanConfirmButton");
        button.disabled = true;
        button.textContent = "Menyimpan...";
        try {
            await request(`/api/admin/feed-moderation/${moderation.banTargetId}/ban`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: $("#feedBanReason").value.trim() })
            });
            closeFeedBanPanel();
            await loadModeration();
        } catch (error) {
            alert(error.message);
        } finally {
            button.disabled = false;
            button.textContent = "Ban";
        }
    }

    async function logout() {
        try { await fetch("/api/logout", { method: "POST" }); } finally {
            ["adminId", "adminName", "adminRole", "adminUsername"].forEach(key => localStorage.removeItem(key));
            location.href = "/index.html";
        }
    }

    function navigate(path) { location.href = path; }
    Object.assign(window, {
        goToDashboard: () => navigate("/admin-dashboard.html"),
        goToStudents: () => navigate("/admin-students.html"),
        goToPoints: () => navigate("/admin-points.html"),
        goToExamScores: () => navigate("/admin-exam-scores.html"),
        goToPublicAnnouncement: () => navigate("/admin-public-announcements.html"),
        goToTeachers: () => navigate("/admin-users.html"),
        logout, loadAnnouncements: () => loadAnnouncements(false),
        goToNotifications, closeAdminNotifications,
        openFeedModeration, closeFeedModeration,
        openFeedMutePanel, closeFeedMutePanel, setFeedMuteDuration, confirmFeedMute,
        openFeedBanPanel, closeFeedBanPanel, confirmFeedBan
    });

document.addEventListener("mousedown", event => {
    const button = event.target.closest?.(
        ".feed-format-button[data-format]"
    );

    if (button && !button.disabled) {
        event.preventDefault();
    }
});

document.addEventListener("click", event => {
    const button = event.target.closest?.(
        ".feed-format-button[data-format]"
    );

    if (!button || button.disabled) return;

    applyFeedFormatting(
        editorFromToolbar(button),
        button.dataset.format
    );
});

document.addEventListener("keydown", event => {
    const editor = event.target.closest?.(".feed-rich-editor");

    if (
        !editor ||
        event.isComposing ||
        event.altKey ||
        event.shiftKey ||
        (!event.ctrlKey && !event.metaKey)
    ) {
        return;
    }

    const format = {
        b: "bold",
        i: "italic",
        u: "underline"
    }[String(event.key).toLowerCase()];

    if (!format) return;

    // Cegah shortcut native berjalan kedua kali.
    event.preventDefault();

    if (event.repeat) return;

    applyFeedFormatting(editor, format);
});

/*
 * Hanya input asli pengguna yang membuka kembali
 * autocomplete setelah option dipilih.
 *
 * Event input buatan dari insertMention tidak memiliki
 * beforeinput sehingga tidak akan membuka lock.
 */
document.addEventListener(
    "beforeinput",
    event => {
        const editor =
            event.target.closest?.(
                ".feed-rich-editor"
            );

        if (!editor) {
            return;
        }

        editor._mentionSuggestionsDismissed =
            false;
    },
    true
);

document.addEventListener("input", event => {
    const editor = event.target.closest?.(".feed-rich-editor");
    if (!editor) return;

    syncRichEditorEmptyState(editor);

    requestAnimationFrame(() => {
        syncFormatToolbar(editor);
    });
});

document.addEventListener("selectionchange", () => {
    const editor = activeRichEditor();

    if (!editor) {
        clearToolbarButtonStates();
        return;
    }

    syncFormatToolbar(editor);
});

document.addEventListener("keyup", event => {
    const editor = event.target.closest?.(".feed-rich-editor");

    if (editor) {
        syncFormatToolbar(editor);
    }
});

document.addEventListener("mouseup", event => {
    const editor = event.target.closest?.(".feed-rich-editor");

    if (editor) {
        syncFormatToolbar(editor);
    }
});

$$(".feed-rich-editor").forEach(syncRichEditorEmptyState);

document.addEventListener(
    "paste",
    event => {
        const editor =
            event.target.closest(
                ".feed-rich-editor"
            );

        if (!editor) {
            return;
        }

        event.preventDefault();

        const text =
            event.clipboardData
                ?.getData(
                    "text/plain"
                ) || "";

        document.execCommand(
            "insertText",
            false,
            text
        );

        /*
         * Post utama admin/guru.
         */
        if (editor === ui.message) {
            const applyPostMentions =
                () => {
                    decoratePastedMentions(
                        editor,
                        availablePostMentionUsers(),
                        state.postMentions
                    );
                };

            if (
                state.postMentionLoaded
            ) {
                applyPostMentions();
            } else {
                loadPostMentionUsers()
                    .then(
                        applyPostMentions
                    );
            }

            return;
        }

        /*
         * Reply admin/guru.
         */
        const form =
            editor.closest(
                ".admin-reply-form"
            );

        if (!form) {
            return;
        }

        const applyReplyMentions =
            () => {
                decoratePastedMentions(
                    editor,
                    form._mentionUsers ||
                        [],

                    form._selectedMentions ||=
                        []
                );
            };

        if (
            Array.isArray(
                form._mentionUsers
            )
        ) {
            applyReplyMentions();
        } else {
            prepareReplyMentions(form)
                .then(
                    applyReplyMentions
                );
        }
    }
);

initializeFeedPostImageControls();

/*
 * Preload satu kali. Setelah selesai, mengetik @
 * tidak lagi melakukan request API baru.
 */
void loadPostMentionUsers();

ui.form.addEventListener(
    "submit",
    submitPost
);
    ui.filter.addEventListener("change", () => { state.filter = ui.filter.value; applyFilter(); });
ui.message.addEventListener(
    "input",
    () => {
        if (
            ui.message._promotingMention
        ) {
            return;
        }

        if (
            activeMentionQuery(
                ui.message
            ) === null
        ) {
            hideSuggestions(
                ui.mentionBox
            );

            return;
        }

        const renderCurrentMention =
            () => {
                if (
                    activeMentionQuery(
                        ui.message
                    ) === null
                ) {
                    hideSuggestions(
                        ui.mentionBox
                    );

                    return;
                }

                const users =
                    availablePostMentionUsers();

                if (
                    promoteTypedMention(
                        ui.message,
                        users,
                        state.postMentions
                    )
                ) {
                    hideSuggestions(
                        ui.mentionBox
                    );

                    return;
                }

                renderSuggestions(
                    ui.message,
                    ui.mentionBox,
                    users,
                    state.postMentions
                );
            };

        if (state.postMentionLoaded) {
            renderCurrentMention();
            return;
        }

        showMentionLoading(
            ui.mentionBox
        );

        loadPostMentionUsers()
            .then(
                renderCurrentMention
            );
    }
);
    ui.classSelect.addEventListener("change", () => { state.postMentions = []; hideSuggestions(ui.mentionBox); });
    $$("input[name='target']").forEach(radio => radio.addEventListener("change", () => {
        const isClass = $("input[name='target']:checked")?.value === "class";
        ui.classWrap.style.display = isClass ? "block" : "none";
        ui.classSelect.required = isClass;
        if (!isClass) ui.classSelect.value = "";
        state.postMentions = [];
        hideSuggestions(ui.mentionBox);
    }));

    ui.list.addEventListener("submit", event => {
        if (event.target.matches(".admin-reply-form")) submitReply(event);
    });
ui.list.addEventListener(
    "input",
    event => {
        const input =
            event.target.closest(
                ".admin-reply-input"
            );

        if (
            !input ||
            input._promotingMention
        ) {
            return;
        }

        const form =
            input.closest(
                ".admin-reply-form"
            );

        const box =
            $(
                ".admin-mention-suggestions",
                form
            );

        if (
            activeMentionQuery(input) ===
            null
        ) {
            hideSuggestions(box);
            return;
        }

        const renderReplyMention =
            () => {
                if (
                    activeMentionQuery(
                        input
                    ) === null
                ) {
                    hideSuggestions(box);
                    return;
                }

                const users =
                    form._mentionUsers ||
                    [];

                const selected =
                    form._selectedMentions ||=
                        [];

                if (
                    promoteTypedMention(
                        input,
                        users,
                        selected
                    )
                ) {
                    hideSuggestions(box);
                    return;
                }

                renderSuggestions(
                    input,
                    box,
                    users,
                    selected
                );
            };

        if (
            Array.isArray(
                form._mentionUsers
            )
        ) {
            renderReplyMention();
            return;
        }

        showMentionLoading(box);

        prepareReplyMentions(form)
            .then(
                renderReplyMention
            );
    }
);

    window.addEventListener(
    "resize",
    () => {

        queueFeedTextCollapse(
            document
        );

    }
);
ui.list.addEventListener("click", event => {
    const button = event.target.closest(
        "button[data-action]"
    );

if (!button) return;


if (
    button.dataset.action ===
    "toggle-feed-text"
) {

    const currentlyExpanded =
        button.getAttribute(
            "aria-expanded"
        ) === "true";


    setFeedTextExpanded(
        button,
        !currentlyExpanded
    );

    return;

}


if (button.dataset.action === "toggle-replies") {
        const card = button.closest(".feed-card");

        const currentlyOpen =
            button.getAttribute("aria-expanded") === "true";

setRepliesOpen(
    card,
    !currentlyOpen
);


if (!currentlyOpen) {

    queueFeedTextCollapse(
        card
    );

}


return;
    }

    if (button.dataset.action === "delete-post") {
        deletePost(
            Number(button.dataset.postId),
            button
        );

        return;
    }

    if (button.dataset.action === "delete-reply") {
        deleteReply(
            Number(button.dataset.postId),
            Number(button.dataset.replyId),
            button
        );
    }
});
    $("#feedModerationStudent").addEventListener("change", renderSelectedModerationStudent);
    $("#feedModerationLogFilter").addEventListener("change", event => { moderation.filter = event.target.value; renderModerationLog(); });
    $("#feedModerationLog").addEventListener("click", event => {
        const button = event.target.closest("button[data-action='delete-moderation']");
        if (button) deleteModerationAction(Number(button.dataset.actionId), button);
    });
    [ui.notificationOverlay, $("#feedModerationOverlay"), $("#feedMuteOverlay"), $("#feedBanOverlay")].forEach(overlay => {
        overlay?.addEventListener("click", event => {
            if (event.target !== overlay) return;
            if (overlay === ui.notificationOverlay) closeAdminNotifications();
            if (overlay.id === "feedModerationOverlay") closeFeedModeration();
            if (overlay.id === "feedMuteOverlay") closeFeedMutePanel();
            if (overlay.id === "feedBanOverlay") closeFeedBanPanel();
        });
    });

    const observer = new IntersectionObserver(entries => {
        if (entries[0]?.isIntersecting && state.hasMore) loadAnnouncements(true);
    }, { rootMargin: "300px" });
    observer.observe(ui.loadMoreWrap);

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") { liveTick(); startPolling(); }
        else stopPolling();
    });
    window.addEventListener("message", event => {
        if (event.origin !== location.origin || event.data?.type !== "OPEN_CLASSROOM_NOTIFICATION") return;
        sessionStorage.setItem("notificationAnnouncementId", String(event.data.announcementId || ""));
        sessionStorage.setItem("notificationReplyId", String(event.data.replyId || ""));
        loadNotificationTarget(event.data.announcementId).then(scrollToStoredTarget);
    });

    (async () => {
        await loadAnnouncements(false);
        Promise.allSettled([
            loadClasses(),
            loadPostMentionUsers(),
            loadNotificationCount()
        ]);
        startPolling();

        const targetId = Number(
            sessionStorage.getItem("notificationAnnouncementId")
        );
        if (
            Number.isInteger(targetId) &&
            !scrollToStoredTarget()
        ) {
            await loadNotificationTarget(targetId);
            scrollToStoredTarget();
        }
    })().catch(error => {
        console.error("Gagal membuka Admin Feed:", error);
        startPolling();
    });
})();
