(() => {
    "use strict";

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
    const studentId = Number(localStorage.getItem("studentId"));
    const studentName = localStorage.getItem("studentName") || "Siswa";
    const studentClass = localStorage.getItem("studentClass") || "";

    if (!Number.isInteger(studentId)) {
        location.href = "/student-login.html";
        return;
    }

    $("#sidebarStudentName").textContent = studentName;
    $("#sidebarStudentClass").textContent = studentClass || "Siswa";
    $("#topStudentName").textContent = studentName;

    const ui = {
        form: $("#studentAnnouncementForm"),
        message: $("#studentAnnouncementMessage"),
        status: $("#studentAnnouncementStatus"),
        list: $("#announcementList"),
        filter: $("#studentFeedFilter"),
        refresh: $("#studentFeedRefreshButton"),
        mentionBox: $("#studentAnnouncementMentionSuggestions"),
        loadMoreWrap: $("#studentFeedLoadMoreWrap"),
        loadMoreStatus: $("#studentFeedLoadMoreStatus"),
        notificationBadge: $("#notificationBadge"),
        notificationButton: $(".notification-button"),
        notificationOverlay: $("#studentNotificationOverlay"),
        notificationList: $("#studentNotificationList"),
        blocker: $("#studentFeedModerationBlocker"),
        feedContent: $(".feed-page-content"),
        recoveryOverlay: $("#studentFeedRecoveryOverlay"),
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
        postMentionVersion: 0,
        foreground: 0,
        initialized: false,
        pollTimer: null,
        pollRunning: false,
        pollCycle: 0,
        feedController: null,
        notificationController: null,
        targetLoading: false,
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
        status: "checking",
        mutedUntil: null,
        reason: null,
        actions: [],
        pendingRecovery: null,
        serverOffset: 0,
        countdownTimer: null
    };

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = String(value ?? "");
        return div.innerHTML;
    }

    function dateTime(value) {
        if (typeof window.formatDeviceDateTime === "function") return window.formatDeviceDateTime(value);
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("id-ID");
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

function syncRichEditorEmptyState(editor) {
    if (!editor) {
        return;
    }

    const plainText =
        editorPlainText(editor)
            .replace(/\u200B/g, "")
            .trim();

    editor.classList.toggle(
        "is-visually-empty",
        plainText.length === 0
    );
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
    .replace(/\u200B/g, "")
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

function findEditorTextPoint(editor, wantedOffset) {
    const walker = document.createTreeWalker(
        editor,
        NodeFilter.SHOW_TEXT
    );

    let passed = 0;
    let node;

    while ((node = walker.nextNode())) {
        const length = node.nodeValue?.length || 0;

        if (wantedOffset <= passed + length) {
            return {
                node,
                offset: Math.max(
                    0,
                    wantedOffset - passed
                )
            };
        }

        passed += length;
    }

    const fallback = document.createTextNode("");
    editor.appendChild(fallback);

    return {
        node: fallback,
        offset: 0
    };
}

function selectEditorText(editor, start, end) {
    const startPoint = findEditorTextPoint(
        editor,
        Math.max(0, start)
    );

    const endPoint = findEditorTextPoint(
        editor,
        Math.max(start, end)
    );

    const range = document.createRange();

    range.setStart(
        startPoint.node,
        startPoint.offset
    );

    range.setEnd(
        endPoint.node,
        endPoint.offset
    );

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
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

/*
 * State ini hanya mengatur visual tombol ketika mengetik.
 * Formatting teks tetap sepenuhnya dijalankan browser.
 */
const editorFormatStates =
    new WeakMap();

function getEditorFormatStates(editor) {
    if (!editorFormatStates.has(editor)) {
        editorFormatStates.set(
            editor,
            new Map()
        );
    }

    return editorFormatStates.get(
        editor
    );
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
    if (!command) {
        return false;
    }

    try {
        return Boolean(
            document.queryCommandState(
                command
            )
        );
    } catch {
        return false;
    }
}

function setFormatButtonState(
    button,
    active
) {
    if (
        !button ||
        button.dataset.format === "clear"
    ) {
        return;
    }

    button.classList.toggle(
        "is-active",
        Boolean(active)
    );

    button.setAttribute(
        "aria-pressed",
        String(Boolean(active))
    );
}

function toolbarFromEditor(editor) {
    if (!editor) {
        return null;
    }

    const replyEditor =
        editor.closest(
            ".reply-editor"
        );

    if (replyEditor) {
        return replyEditor.querySelector(
            ".feed-format-toolbar"
        );
    }

    const composerForm =
        editor.closest(
            ".feed-composer form"
        );

    return composerForm?.querySelector(
        ".feed-composer-action-row .feed-format-toolbar"
    ) || null;
}

function clearEditorTypingFormats(editor) {
    if (!editor) {
        return;
    }

    getEditorFormatStates(
        editor
    ).clear();

    const toolbar =
        toolbarFromEditor(editor);

    if (!toolbar) {
        return;
    }

    $$(
        ".feed-format-button[data-format]",
        toolbar
    ).forEach(button => {
        setFormatButtonState(
            button,
            false
        );
    });
}

function clearToolbarButtonStates() {
    $$(".feed-format-button[data-format]")
        .forEach(button => {
            setFormatButtonState(
                button,
                false
            );
        });
}

function editorCaretElement(editor) {
    const selection =
        window.getSelection();

    if (
        !selection ||
        selection.rangeCount === 0 ||
        !selection.anchorNode ||
        !editor.contains(selection.anchorNode)
    ) {
        return null;
    }

    let node =
        selection.anchorNode;

    /*
     * Jika caret berada langsung pada root editor,
     * ambil elemen tepat sebelum caret.
     */
    if (
        node === editor &&
        selection.anchorOffset > 0
    ) {
        node =
            editor.childNodes[
                selection.anchorOffset - 1
            ] || editor;

        while (
            node &&
            node.lastChild
        ) {
            node =
                node.lastChild;
        }
    }

    return node?.nodeType ===
        Node.ELEMENT_NODE
            ? node
            : node?.parentElement;
}

function readRenderedFormatState(
    editor,
    format
) {
    const element =
        editorCaretElement(editor);

    const command =
        getFormatCommand(format);

    if (
        !element ||
        element === editor
    ) {
        return readFormatCommandState(
            command
        );
    }

    const style =
        window.getComputedStyle(element);

    if (format === "bold") {
        const numericWeight =
            Number.parseInt(
                style.fontWeight,
                10
            );

        return (
            style.fontWeight === "bold" ||
            (
                Number.isFinite(
                    numericWeight
                ) &&
                numericWeight >= 600
            )
        );
    }

    if (format === "italic") {
        return (
            style.fontStyle === "italic" ||
            style.fontStyle.startsWith(
                "oblique"
            ) ||
            Boolean(
                element.closest("em, i")
            )
        );
    }

    if (format === "underline") {
        return (
            String(
                style.textDecorationLine ||
                style.textDecoration
            ).includes("underline") ||
            Boolean(
                element.closest("u")
            )
        );
    }

    if (format === "bullet") {
        return Boolean(
            element.closest("ul, ol")
        );
    }

    return readFormatCommandState(
        command
    );
}

function syncFormatToolbar(editor) {
    const toolbar = toolbarFromEditor(editor);
    if (!toolbar) return;

    const selection = window.getSelection();

    // Jangan membaca format dari editor lain.
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
                command
                    ? readFormatCommandState(command)
                    : false
            );
        });
}

function activeRichEditor() {
    const selection =
        window.getSelection();

    const node =
        selection?.anchorNode;

    if (!node) {
        return null;
    }

    const element =
        node.nodeType === Node.ELEMENT_NODE
            ? node
            : node.parentElement;

    return element?.closest(
        ".feed-rich-editor"
    ) || null;
}

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

    // Tidak membuat event input palsu atau membalik state sendiri.
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
            location.href = "/student-login.html";
            throw new Error("Sesi siswa berakhir.");
        }
if (!response.ok || data.success === false) {
    const error = new Error(
        data.message ||
        `Request gagal (${response.status}).`
    );

    error.status = response.status;
    error.code = data.code || null;
    error.data = data;

    throw error;
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

    function removeEmptyFeed() {
        $(".student-feed-empty", ui.list)?.remove();
    }

    function ensureEmptyFeed() {
        if (!$("[id^='announcement-']", ui.list)) ui.list.innerHTML = '<p class="student-feed-empty">Belum ada announcement.</p>';
    }

    function ensureEmptyReplies(container) {
        if (container && !$(".reply-item", container)) container.innerHTML = "<small>Belum ada reply.</small>";
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

    function applyFilter() {
        let visible = 0;
        $(".student-feed-filter-empty", ui.list)?.remove();
        const cards = $$(":scope > [id^='announcement-']", ui.list);
        cards.forEach(card => {
            const className = card.dataset.feedClass || "";
            const show = state.filter === "all" || (state.filter === "global" && !className) || (state.filter === "class" && className === studentClass);
            card.style.display = show ? "" : "none";
            if (show) visible += 1;
        });
        if (cards.length && !visible) {
            const empty = document.createElement("p");
            empty.className = "student-feed-filter-empty";
            empty.textContent = "Belum ada announcement.";
            ui.list.appendChild(empty);
        }
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

    const senderId =
        reply.sender_id ??
        reply.student_id ??
        reply.studentId ??
        null;

    const name =
        reply.sender_name ||
        reply.student_name ||
        (
            type === "admin"
                ? "Admin / Guru"
                : "Siswa"
        );

    const studentClassName =
        String(
            reply.class_name || ""
        ).trim();

    const detail =
        type === "admin"
            ? "Teacher"
            : studentClassName
                ? `Student · ${studentClassName}`
                : "Student";

    const picture =
        reply.profile_picture_url ||
        reply.student_profile_picture_url ||
        "";

    const owner =
        type === "student" &&
        Number(senderId) === studentId;

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

            <div class="reply-avatar">
                ${
                    type === "admin"
                        ? teacherInitial(name)
                        : profileInitial(name)
                }
            </div>


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

                        <span>
                            ${escapeHtml(detail)}
                        </span>

                    </div>


                    <time
                        class="reply-created-time"
                        datetime="${escapeHtml(
                            reply.created_at || ""
                        )}"
                    >
                        ${escapeHtml(
                            dateTime(
                                reply.created_at
                            )
                        )}
                    </time>

                </div>


                <div class="reply-message">
                    ${formatMessage(
                        reply.message,
                        reply.mentions
                    )}
                </div>


                ${
                    owner
                        ? `
                            <div class="reply-footer">

                                <button
                                    type="button"
                                    class="reply-delete-button"
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
                        `
                        : ""
                }

            </div>

        </div>
    `;

    renderAvatar(
        $(".reply-avatar", item),
        type,
        name,
        picture
    );

    return item;
}

function createPostCard(post) {
    const isStudent =
        Number(
            post.student_id ??
            post.studentId ??
            0
        ) > 0;

    const className =
        post.class_name ??
        post.className ??
        null;

    const cleanClassName =
        String(
            className || ""
        ).trim();

    const hasPostText =
    Boolean(
        String(
            post.message || ""
        ).trim()
    );

const hasPostImage =
    Boolean(
        String(
            post.image_url ||
            post.imageUrl ||
            ""
        ).trim()
    );

    const name =
        isStudent
            ? (
                post.student_creator_name ||
                post.studentName ||
                "Siswa"
            )
            : (
                post.admin_creator_name ||
                "Admin / Guru"
            );

    const detail =
        isStudent
            ? cleanClassName
                ? `Student · ${cleanClassName}`
                : "Student"
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

    const owner =
        Number(
            post.student_id ??
            post.studentId
        ) === studentId;

    const card =
        document.createElement(
            "article"
        );

    card.id =
        `announcement-${post.id}`;

card.className = [
    "feed-card",
    "classroom-feed-post",

    hasPostText
        ? "has-feed-text"
        : "without-feed-text",

    hasPostImage
        ? "has-feed-image"
        : "without-feed-image"

].join(" ");

    card.dataset.feedClass =
        cleanClassName;

    card.innerHTML = `
        <header class="feed-card-header">

            <div class="feed-author">

                <div class="feed-avatar">
                    ${
                        isStudent
                            ? profileInitial(name)
                            : teacherInitial(name)
                    }
                </div>


                <div class="feed-author-copy">

                    <div class="feed-author-name">

                        <strong>
                            ${escapeHtml(name)}
                        </strong>

                        ${
                            isStudent
                                ? ""
                                : teacherBadge()
                        }

                    </div>


                    <div class="feed-author-meta">

                        <span>
                            ${escapeHtml(detail)}
                        </span>

                        <span
                            class="feed-meta-separator"
                            aria-hidden="true"
                        >
                            •
                        </span>

                        <time
                            datetime="${escapeHtml(
                                post.created_at || ""
                            )}"
                        >
                            ${escapeHtml(
                                dateTime(
                                    post.created_at
                                )
                            )}
                        </time>

                    </div>

                </div>

            </div>


            <span
                class="
                    feed-scope-badge
                    ${
                        cleanClassName
                            ? "class"
                            : "global"
                    }
                "
                title="${
                    cleanClassName
                        ? escapeHtml(
                            cleanClassName
                        )
                        : "Global"
                }"
            >
                ${
                    cleanClassName
                        ? escapeHtml(
                            cleanClassName
                        )
                        : "GLOBAL"
                }
            </span>

        </header>


        <div class="feed-card-body">

            <div class="feed-message">
                ${formatMessage(
                    post.message,
                    post.mentions
                )}
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
                >
                    <span
                        class="feed-like-icon"
                        aria-hidden="true"
                    >
                        ♡
                    </span>

                    <span data-like-count>
                        0
                    </span>
                </button>


                <button
                    type="button"
                    class="
                        feed-card-action-button
                        reply-toggle-button
                    "
                    data-action="toggle-replies"
                    aria-expanded="false"
                >
<svg
    viewBox="0 0 24 24"
    aria-hidden="true"
>
    <path
        d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-4.5 3v-3H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"
    ></path>
</svg>

<span
    data-reply-label
    class="feed-visually-hidden"
>
    Tampilkan replies
</span>

<span data-reply-count>
    0
</span>
                </button>

            </div>


            ${
                owner
                    ? `
                        <button
                            type="button"
                            class="
                                feed-card-action-button
                                feed-delete-button
                            "
                            data-action="delete-post"
                            data-post-id="${Number(
                                post.id
                            )}"
                        >
                            Hapus
                        </button>
                    `
                    : ""
            }

        </div>


        <div class="reply-section">

            <div
                class="reply-collapsible"
                hidden
            >

                <div class="reply-thread-heading">

                </div>


                <div
                    id="replies-${post.id}"
                    class="reply-list"
                >
                    <small>
                        Belum ada reply.
                    </small>
                </div>


                <form
                    class="
                        reply-form
                        reply-composer
                    "
                    data-id="${Number(
                        post.id
                    )}"
                >

                    <div class="reply-editor">

                        <div
                            class="
                                reply-input
                                feed-rich-editor
                            "
                            contenteditable="true"
                            role="textbox"
                            aria-multiline="true"
                            data-placeholder="Tulis balasan..."
                            spellcheck="true"
                        ></div>

                        ${formatToolbarMarkup()}

                        <div
                            class="mention-suggestions"
                            style="display:none;"
                        ></div>

                    </div>


                    <button
                        type="submit"
                        class="reply-send-button"
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
        const container = $(`#replies-${post.id}`, card);
        const replies = Array.isArray(post.replies) ? post.replies : [];
        if (replies.length) {
            container.innerHTML = "";
            replies.forEach(reply => {
                state.latestReplyId = Math.max(state.latestReplyId, Number(reply.id));
                container.appendChild(createReplyItem(post.id, reply));
            });
        }

        updateReplyCount(container);
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
if (
    ["muted", "banned"].includes(moderation.status) ||
    state.loading ||
    (append && !state.hasMore)
) return;
        state.loading = true;
        if (!append) {
            state.feedController?.abort();
            state.beforeId = null;
            state.latestPostId = 0;
            state.latestReplyId = 0;
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

            <strong>
                Memuat feed
            </strong>

        </div>
    </div>
`;
        } else {
            ui.loadMoreStatus.hidden = false;
        }
        const controller = new AbortController();
        state.feedController = controller;
        try {
            const url = append && state.beforeId
                ? `/api/student/${studentId}/announcements?beforeId=${encodeURIComponent(state.beforeId)}`
                : `/api/student/${studentId}/announcements`;
            const data = await request(url, { signal: controller.signal });
if (
    ["muted", "banned"].includes(moderation.status) ||
    controller.signal.aborted
) return;
            if (!append) ui.list.innerHTML = "";
            (data.announcements || []).forEach(post => addPost(post, "append"));
            state.hasMore = Boolean(data.pagination?.hasMore);
            state.beforeId = data.pagination?.nextBeforeId ? Number(data.pagination.nextBeforeId) : null;
            ui.loadMoreWrap.hidden = !state.hasMore;
            ensureEmptyFeed();
            state.initialized = true;
            if (!state.targetLoading) scrollToStoredTarget();
} catch (error) {
    /*
     * FEED_MODERATED bukan kegagalan load.
     * checkModeration() akan langsung membuka
     * panel mute atau ban.
     */
    if (
        error.name === "AbortError" ||
        error.code === "FEED_MODERATED"
    ) {
        return;
    }

    if (!append) {
        ui.list.textContent =
            error.message ||
            "Gagal mengambil announcement.";
    }
} finally {
            if (state.feedController === controller) state.feedController = null;
            state.loading = false;
            ui.loadMoreStatus.hidden = true;
        }
    }

    async function hardRefresh() {
        if (moderation.status !== "active") return;
        ui.refresh.disabled = true;
        ui.refresh.textContent = "↻ Memuat...";
        beginForeground();
        try { await loadAnnouncements(false); await loadNotificationCount(); }
        finally { endForeground(); ui.refresh.disabled = false; ui.refresh.textContent = "↻ Refresh"; }
    }

    async function submitPost(event) {

        event.preventDefault();


        const text =
            editorToMarkup(
                ui.message
            );


        if (
            moderation.status !==
            "active"
        ) {
            return;
        }


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
                "input[name='studentAnnouncementTarget']:checked"
            )?.value ||
            "class";


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
                    `/api/student/${studentId}/announcements`,
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                message:
                                    text,

                                target,

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

            ui.message.replaceChildren();

            clearEditorTypingFormats(
    ui.message
);

syncFormatToolbar(
    ui.message
);

            clearAttachedFeedPostImage();

            state.postMentions =
                [];

            hideSuggestions(
                ui.mentionBox
            );

            ui.status.textContent =
                "Announcement berhasil dibuat.";

        } catch (error) {

            /*
                Jika Cloudinary berhasil tetapi API post
                gagal, hapus upload yang belum digunakan.
            */
            if (uploadedImage?.imagePublicId) {

                await deleteUploadedFeedImage(
                    uploadedImage.imagePublicId
                );

            }


            ui.status.textContent =
                `Post gagal dipublikasikan: ${
                    error.message ||
                    "Terjadi kesalahan."
                }`;

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
        if (!text || moderation.status !== "active") return;
        button.disabled = true;
        button.textContent = "Menambahkan...";
        beginForeground();
        try {
            const mentions = mergeTypedMentions(text, form._selectedMentions || [], form._mentionUsers || []);
            const data = await request(`/api/announcements/${postId}/replies`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ studentId, message: text, mentions })
            });
            const container = $(`#replies-${postId}`);
            if (container && !document.getElementById(`reply-${data.reply.id}`)) {
$("small", container)?.remove();

container.appendChild(
    createReplyItem(postId, data.reply)
);

updateReplyCount(container);
                state.latestReplyId = Math.max(state.latestReplyId, Number(data.reply.id));
            }
            input.replaceChildren();

            clearEditorTypingFormats(
    input
);

syncFormatToolbar(
    input
);
            form._selectedMentions = [];
} catch (error) {
    const message = error.message || "Gagal mengirim reply.";

    if (/announcement.*(tidak ditemukan|not found)/i.test(message)) {
        document
            .getElementById(`announcement-${postId}`)
            ?.remove();

        ensureEmptyFeed();
        applyFilter();

        ui.status.textContent =
            "Post ini sudah dihapus di perangkat lain.";
    } else {
        showReplyWarning(
            form,
            `Reply gagal dipublikasikan: ${message}`
        );
    }
} finally {
            endForeground();
            button.disabled = false;
            button.textContent = "Kirim";
        }
    }

    function showReplyWarning(form, text) {
        let warning = form.nextElementSibling;
        if (!warning?.classList.contains("reply-submit-warning")) {
            warning = document.createElement("small");
            warning.className = "reply-submit-warning";
            warning.style.cssText = "display:block;margin-top:6px;color:#fb7185";
            form.insertAdjacentElement("afterend", warning);
        }
        warning.textContent = text;
    }

    async function deletePost(postId, button) {
        if (!confirm("Yakin ingin menghapus announcement ini? Semua reply dan mention di dalamnya juga akan dihapus.")) return;
        button.disabled = true;
        button.textContent = "Menghapus...";
        beginForeground();
        try {
            await request(`/api/student/${studentId}/announcements/${postId}`, { method: "DELETE" });
            document.getElementById(`announcement-${postId}`)?.remove();
            ensureEmptyFeed();
            applyFilter();
        } catch (error) {
            button.disabled = false;
            button.textContent = "Hapus";
            ui.status.textContent = error.message;
        } finally { endForeground(); }
    }

    async function deleteReply(postId, replyId, button) {
        if (!confirm("Yakin ingin menghapus reply ini?")) return;
        button.disabled = true;
        button.textContent = "Menghapus...";
        beginForeground();
        try {
            await request(`/api/announcements/${postId}/replies/${replyId}`, {
                method: "DELETE", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ studentId })
            });
            const item = document.getElementById(`reply-${replyId}`);
            const container = item?.closest(".reply-list") || $(`#replies-${postId}`);
item?.remove();
ensureEmptyReplies(container);
updateReplyCount(container);
        } catch (error) {
            button.disabled = false;
            button.textContent = "Hapus";
            alert(error.message);
        } finally { endForeground(); }
    }

    function mergeTypedMentions(text, selected, users) {
        const result = [...selected];
        users.forEach(user => {
            if (text.includes(`@${user.name}`) && !result.some(item => item.id === user.id && item.type === user.type)) {
                result.push({ id: user.id, type: user.type, name: user.name });
            }
        });
        return result;
    }

    function hideSuggestions(box) {
        if (!box) return;
        box.innerHTML = "";
        box.style.display = "none";
    }

function activeMentionQuery(input) {
    const text = editorPlainText(input);
    const cursor = getEditorCaretOffset(input);
    const before = text.slice(0, cursor);
    const match = before.match(/@([^@\n]*)$/);

    if (!match) {
        input._mentionStart = null;
        input._mentionEnd = null;
        return null;
    }

    input._mentionStart =
        before.lastIndexOf("@");

    input._mentionEnd = cursor;

    return match[1]
        .trim()
        .toLowerCase();
}

function insertMention(input, user, selected) {
    const start = Number(input._mentionStart);
    const end = Number(input._mentionEnd);

    if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 0 ||
        end < start
    ) {
        return;
    }

    const token = `@${user.name} `;

    input.focus();
    selectEditorText(input, start, end);

    document.execCommand(
        "insertText",
        false,
        token
    );

    if (
        !selected.some(item =>
            Number(item.id) === Number(user.id) &&
            item.type === user.type
        )
    ) {
        selected.push({
            id: user.id,
            type: user.type,
            name: user.name
        });
    }

    input._mentionStart = null;
    input._mentionEnd = null;

    input.dispatchEvent(
        new Event("input", { bubbles: true })
    );
}

function renderSuggestions(
    input,
    box,
    users,
    selected
) {
    const query =
        activeMentionQuery(input);

    if (query === null) {
        hideSuggestions(box);
        return;
    }

    const matches =
        [...users]
            .filter(user =>
                String(
                    user.name || ""
                )
                    .toLowerCase()
                    .includes(query)
            )
            .sort((a, b) =>
                String(a.name || "")
                    .localeCompare(
                        String(
                            b.name || ""
                        ),
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
        const button =
            document.createElement(
                "button"
            );

        const name =
            String(
                user.name ||
                "Pengguna"
            ).trim();

        const className =
            String(
                user.className ||
                user.class_name ||
                ""
            ).trim();

        const isStudent =
            user.type === "student";

        const detail =
            isStudent
                ? className
                    ? `Student · ${className}`
                    : "Student"
                : (
                    user.role ||
                    "Teacher"
                );

        const picture =
            user.profile_picture_url ||
            user.profilePictureUrl ||
            "";

        button.type = "button";

        button.className =
            "feed-mention-option";

        button.innerHTML = `
            <span class="feed-mention-avatar">
                ${
                    isStudent
                        ? profileInitial(name)
                        : teacherInitial(name)
                }
            </span>

            <span class="feed-mention-option-copy">

                <strong>
                    ${escapeHtml(name)}
                </strong>

                <small>
                    ${escapeHtml(detail)}
                </small>

            </span>

            <span
                class="feed-mention-insert-icon"
                aria-hidden="true"
            >
                ↵
            </span>
        `;

        renderAvatar(
            $(".feed-mention-avatar", button),
            isStudent
                ? "student"
                : "admin",
            name,
            picture
        );

        button.addEventListener(
            "click",
            () => {
                insertMention(
                    input,
                    user,
                    selected
                );

                hideSuggestions(box);
            }
        );

        box.appendChild(button);
    });

    box.style.display =
        matches.length
            ? "block"
            : "none";
}

    async function loadPostMentionUsers() {
        const target = $("input[name='studentAnnouncementTarget']:checked")?.value || "class";
        const version = ++state.postMentionVersion;
        try {
            const data = await request(`/api/student/mention-list?target=${encodeURIComponent(target)}`);
            if (version === state.postMentionVersion) state.postMentionUsers = data.users || [];
        } catch (error) {
            if (version === state.postMentionVersion) state.postMentionUsers = [];
        }
    }

    async function prepareReplyMentions(form) {
        if (form._mentionUsers || form._mentionLoading) return;
        form._mentionLoading = true;
        try {
            const data = await request(`/api/mentions/users?announcementId=${encodeURIComponent(form.dataset.id)}`);
            form._mentionUsers = data.users || [];
        } catch (error) { form._mentionUsers = []; }
        finally { form._mentionLoading = false; }
    }

    async function checkLivePosts() {
        const data = await request(`/api/student/${studentId}/announcements/live?afterId=${state.latestPostId}`);
        (data.announcements || []).forEach(post => addPost(post));
    }

async function checkLiveReplies() {
    const data = await request(
        `/api/student/${studentId}/replies/live?afterId=${state.latestReplyId}`
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
            `#replies-${reply.announcement_id}`
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
        const data = await request(`/api/student/${studentId}/classroom-feed/state`);
        const posts = new Set((data.announcementIds || []).map(String));
        const replies = new Set((data.replies || []).map(item => String(item.id)));
        $$(":scope > [id^='announcement-']", ui.list).forEach(card => { if (!posts.has(card.id.slice(13))) card.remove(); });
        $$(".reply-item", ui.list).forEach(item => {
            if (!replies.has(item.id.slice(6))) {
                const container = item.closest(".reply-list");
                item.remove();
ensureEmptyReplies(container);
updateReplyCount(container);
            }
        });
        ensureEmptyFeed();
    }

    function syncClock(serverNow, started, ended) {
        const server = new Date(serverNow).getTime();
        if (!Number.isNaN(server)) moderation.serverOffset = server - (started + (ended - started) / 2);
    }

    function moderationNow() { return Date.now() + moderation.serverOffset; }

    function formatCountdown(ms) {
        const seconds = Math.max(0, Math.floor(ms / 1000));
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const rest = seconds % 60;
        return `${days ? `${days} Hari, ` : ""}${hours || days ? `${hours} Jam, ` : ""}${minutes || hours || days ? `${minutes} Menit, ` : ""}${rest} Detik`;
    }

    function formatDuration(minutes) {
        const total = Number(minutes || 0);
        const days = Math.floor(total / 1440);
        const hours = Math.floor((total % 1440) / 60);
        const mins = total % 60;
        return [[days, "hari"], [hours, "jam"], [mins, "menit"]].filter(([n]) => n).map(([n, unit]) => `${n} ${unit}`).join(" ") || "0 menit";
    }

    function renderMuteCards() {
        const container = $("#studentFeedModerationCards");
        let queued = 0;
        container.innerHTML = moderation.actions.map(action => {
            const active = action.status === "active";
            if (!active) queued += 1;
            const end = new Date(action.ends_at || moderation.mutedUntil).getTime();
            const countdown = active && !Number.isNaN(end) ? formatCountdown(end - moderationNow()) : formatDuration(action.duration_minutes);
            return `<article class="student-feed-mute-card ${active ? "active" : "queued"}">
                <div class="student-feed-mute-card-header"><div><small>CLASSROOM FEED</small><strong>${active ? "Mute aktif" : `Mute antrean ${queued}`}</strong></div>
                <span class="student-feed-mute-card-status ${active ? "active" : "queued"}">${active ? "Aktif" : "Antrean"}</span></div>
                <div class="student-feed-mute-card-timing"><div><small>${active ? "Sisa waktu" : "Durasi"}</small>
                <strong ${active ? `class="student-feed-mute-card-countdown" data-action-id="${action.id}"` : ""}>${escapeHtml(countdown)}</strong></div>
                <div><small>${active ? "Berakhir" : "Mulai"}</small><strong>${active ? escapeHtml(dateTime(action.ends_at || moderation.mutedUntil)) : "Setelah mute sebelumnya"}</strong></div></div>
                <div class="student-feed-mute-card-reason"><small>Alasan</small><p>${escapeHtml(action.reason || "Tidak ada alasan.")}</p></div></article>`;
        }).join("");
    }

    function updateMuteCountdowns() {
        if (moderation.status !== "muted") return;
        moderation.actions.forEach(action => {
            if (action.status !== "active") return;
            const element = $(`.student-feed-mute-card-countdown[data-action-id='${action.id}']`);
            const end = new Date(action.ends_at || moderation.mutedUntil).getTime();
            if (element && !Number.isNaN(end)) element.textContent = formatCountdown(end - moderationNow());
        });
    }

    function lockFeed(kind, data, actions = []) {
        moderation.status = kind;
        moderation.mutedUntil = data.mutedUntil || null;
        moderation.reason = data.reason || null;
        moderation.actions = (actions || []).filter(action => ["active", "queued"].includes(action.status));
        state.feedController?.abort();
        state.loading = false;
        state.initialized = false;
        state.latestPostId = 0;
        state.latestReplyId = 0;
        ui.list.innerHTML = "";
        closeStudentNotifications();
        ui.notificationButton.disabled = true;
        ui.notificationButton.classList.add("student-feed-notification-locked");
        ui.notificationBadge.textContent = "";
        ui.feedContent.style.display = "";
        ui.feedContent.classList.toggle("student-feed-content-locked", matchMedia("(max-width:600px)").matches);
        ui.blocker.style.display = "";
        if (kind === "banned") {
            $("#studentFeedModerationTitle").textContent = "Akses Classroom Feed Dinonaktifkan";
            $("#studentFeedModerationMessage").textContent = "Kamu tidak dapat mengakses Classroom Feed sampai larangan dicabut oleh Admin atau Guru.";
            $("#studentFeedModerationDetails").style.display = "none";
            const row = $("#studentFeedModerationReasonRow");
            row.style.display = moderation.reason ? "block" : "none";
            $("#studentFeedModerationReason").textContent = moderation.reason || "";
            clearInterval(moderation.countdownTimer);
        } else {
            $("#studentFeedModerationTitle").textContent = "Akses Classroom Feed Dibatasi";
            $("#studentFeedModerationMessage").textContent = "Kamu sementara tidak dapat mengakses Classroom Feed.";
            $("#studentFeedModerationDetails").style.display = "block";
            $("#studentFeedModerationReasonRow").style.display = "none";
            renderMuteCards();
            clearInterval(moderation.countdownTimer);
            moderation.countdownTimer = setInterval(updateMuteCountdowns, 1000);
        }
    }

    function unlockFeed() {
        clearInterval(moderation.countdownTimer);
        moderation.countdownTimer = null;
        moderation.status = "active";
        moderation.actions = [];
        ui.blocker.style.display = "none";
        ui.feedContent.classList.remove("student-feed-content-locked");
        ui.notificationButton.disabled = false;
        ui.notificationButton.classList.remove("student-feed-notification-locked");
        $("#studentFeedModerationCards").innerHTML = "";
    }

    function showRecovery(event) {
        if (!event || Number(sessionStorage.getItem(`studentFeedRecoverySeen:${studentId}`) || 0) >= Number(event.id)) return;
        moderation.pendingRecovery = event;
        ui.recoveryOverlay.style.display = "flex";
    }

    function acknowledgeStudentFeedRecovery() {
        const event = moderation.pendingRecovery;
        ui.recoveryOverlay.style.display = "none";
        moderation.pendingRecovery = null;
        if (!event?.id) return;
        sessionStorage.setItem(`studentFeedRecoverySeen:${studentId}`, String(event.id));
        request(`/api/student/${studentId}/feed-moderation/events/${event.id}/seen`, { method: "POST", keepalive: true }).catch(console.error);
    }

    async function checkModeration() {
        const started = Date.now();
        const previous = moderation.status;
        const data = await request(`/api/student/${studentId}/feed-moderation`);
        syncClock(data.serverNow, started, Date.now());
        const fresh = data.moderation?.status || "active";
        if (fresh === "muted") { lockFeed("muted", data.moderation, data.muteActions); return false; }
        if (fresh === "banned") { lockFeed("banned", data.moderation); return false; }
        if (["muted", "banned"].includes(previous) && !data.pendingEvent) return false;
        unlockFeed();
        if (data.pendingEvent) showRecovery(data.pendingEvent);
        if (!state.initialized) await loadAnnouncements(false);
        return true;
    }

    async function pollTick() {
        if (state.pollRunning || state.foreground || document.visibilityState !== "visible") return;
        state.pollRunning = true;
        try {
            state.pollCycle += 1;
            const active = await checkModeration();
            if (!active || state.foreground || state.loading) return;
const tasks = [];

if (state.pollCycle % 3 === 0) {
    tasks.push(
        checkLivePosts(),
        checkLiveReplies(),
        checkLiveDeletes(),
        loadNotificationCount()
    );
}

await Promise.allSettled(tasks);
        } catch (error) {
            console.error("Student polling gagal:", error);
        } finally { state.pollRunning = false; }
    }

    function startPolling() {
        if (!state.pollTimer) state.pollTimer = setInterval(pollTick, 2000);
    }

    function stopPolling() {
        clearInterval(state.pollTimer);
        state.pollTimer = null;
    }

    function updateBadge(count) {
        ui.notificationBadge.textContent = count > 0 ? String(count) : "";
    }

    async function loadNotificationCount() {
        if (moderation.status !== "active") return;
        state.notificationController?.abort();
        const controller = new AbortController();
        state.notificationController = controller;
        try {
            const data = await request(`/api/student/${studentId}/notifications/count`, { signal: controller.signal });
            updateBadge(Number(data.unreadCount || 0));
        } catch (error) {
            if (error.name !== "AbortError") console.error("Gagal mengambil jumlah notifikasi:", error);
        } finally {
            if (state.notificationController === controller) state.notificationController = null;
        }
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
        ui.notificationList.textContent = "Memuat...";
        try {
            const data = await request(`/api/student/${studentId}/notifications`);
            ui.notificationList.innerHTML = "";
            if (!(data.notifications || []).length) ui.notificationList.innerHTML = '<div class="empty-state"><strong>Belum ada notifikasi</strong><span>Aktivitas baru akan muncul di sini.</span></div>';
            else data.notifications.forEach(item => ui.notificationList.appendChild(notificationItem(item)));
            updateBadge(Number(data.unreadCount || 0));
        } catch (error) { ui.notificationList.textContent = "Gagal mengambil notifikasi."; }
    }

    function goToNotifications() {
        if (moderation.status !== "active") return;
        ui.notificationOverlay.style.display = "flex";
        document.body.style.overflow = "hidden";
        loadNotificationPanel();
    }

    function closeStudentNotifications() {
        ui.notificationOverlay.style.display = "none";
        document.body.style.overflow = "";
    }

    async function openNotification(notification, item) {
        if (Number(notification.is_read) === 0) {
            notification.is_read = 1;
            item.classList.remove("unread");
            updateBadge(Math.max(0, Number(ui.notificationBadge.textContent || 0) - 1));
            request(`/api/notifications/${notification.id}/read`, { method: "PATCH" }).catch(loadNotificationCount);
        }
        closeStudentNotifications();
        if (!notification.announcement_id) return;
        sessionStorage.setItem("notificationAnnouncementId", String(notification.announcement_id));
        sessionStorage.setItem("notificationReplyId", String(notification.reply_id || ""));
        await revealNotificationTarget();
        scrollToStoredTarget();
    }

    async function revealNotificationTarget() {
        if (state.targetLoading || scrollToStoredTarget()) return;
        state.targetLoading = true;
        try {
            let pages = 0;
            while (!scrollToStoredTarget() && state.hasMore && pages < 30) {
                await loadAnnouncements(true);
                pages += 1;
            }
        } finally { state.targetLoading = false; }
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

    async function logout() {
        try { await fetch("/api/logout", { method: "POST" }); } finally {
            ["studentId", "studentName", "studentClass", "studentLoginCode"].forEach(key => localStorage.removeItem(key));
            location.href = "/student-login.html";
        }
    }

    function navigate(path) { location.href = path; }
    Object.assign(window, {
        goToDashboard: () => navigate("/student-dashboard.html"),
        goToProfile: () => navigate("/student-profile.html"),
        goToPoints: () => navigate("/student-points.html"),
        goToExamScores: () => navigate("/student-exam-scores.html"),
        logout, goToNotifications, closeStudentNotifications, acknowledgeStudentFeedRecovery
    });

/*
 * Pertahankan selection editor ketika toolbar diklik.
 */
document.addEventListener(
    "mousedown",
    event => {
        const button =
            event.target.closest(
                ".feed-format-button[data-format]"
            );

        if (button) {
            event.preventDefault();
        }
    }
);


/*
 * Formatting melalui tombol toolbar.
 */
document.addEventListener(
    "click",
    event => {
        const button =
            event.target.closest(
                ".feed-format-button[data-format]"
            );

        if (!button) {
            return;
        }

        const editor =
            editorFromToolbar(button);

        applyFeedFormatting(
            editor,
            button.dataset.format
        );
    }
);


/*
 * Shortcut menggunakan fungsi yang sama
 * dengan tombol toolbar.
 */
document.addEventListener(
    "keydown",
    event => {
        const editor =
            event.target.closest?.(
                ".feed-rich-editor"
            );

        if (!editor) {
            return;
        }

        const navigationKeys = [
            "ArrowLeft",
            "ArrowRight",
            "ArrowUp",
            "ArrowDown",
            "Home",
            "End",
            "PageUp",
            "PageDown"
        ];

        /*
         * Jika caret dipindahkan memakai keyboard,
         * status berikutnya mengikuti posisi caret baru.
         */
        if (
            navigationKeys.includes(
                event.key
            )
        ) {
            getEditorFormatStates(
                editor
            ).clear();

            return;
        }

        if (
            event.repeat ||
            event.altKey ||
            (!event.ctrlKey && !event.metaKey)
        ) {
            return;
        }

        const formatByKey = {
            b: "bold",
            i: "italic",
            u: "underline"
        };

        const format =
            formatByKey[
                String(event.key)
                    .toLowerCase()
            ];

        if (!format) {
            return;
        }

        event.preventDefault();

        applyFeedFormatting(
            editor,
            format
        );
    }
);


/*
 * Hanya satu listener input.
 * File sebelumnya memiliki dua listener identik.
 */
document.addEventListener(
    "input",
    event => {
        const editor =
            event.target.closest?.(
                ".feed-rich-editor"
            );

        if (!editor) {
            return;
        }

        syncRichEditorEmptyState(
            editor
        );

        requestAnimationFrame(() => {
            syncFormatToolbar(
                editor
            );
        });
    }
);

$$(".feed-rich-editor").forEach(
    syncRichEditorEmptyState
);


/*
 * Selection change memperbarui toolbar,
 * tetapi state kombinasi saat mengetik tetap dipertahankan.
 */
document.addEventListener(
    "selectionchange",
    () => {
        const editor =
            activeRichEditor();

        if (!editor) {
            clearToolbarButtonStates();
            return;
        }

        syncFormatToolbar(
            editor
        );
    }
);


/*
 * Keyup biasa tidak menghapus state kombinasi.
 */
document.addEventListener(
    "keyup",
    event => {
        const editor =
            event.target.closest?.(
                ".feed-rich-editor"
            );

        if (editor) {
            syncFormatToolbar(
                editor
            );
        }
    }
);


/*
 * Klik langsung pada editor berarti pengguna
 * memindahkan caret ke posisi lain.
 */
document.addEventListener(
    "mouseup",
    event => {
        const editor =
            event.target.closest?.(
                ".feed-rich-editor"
            );

        if (!editor) {
            return;
        }

        getEditorFormatStates(
            editor
        ).clear();

        syncFormatToolbar(
            editor
        );
    }
);

document.addEventListener("paste", event => {
    const editor = event.target.closest(
        ".feed-rich-editor"
    );

    if (!editor) return;

    /*
     * Paste sebagai teks biasa supaya HTML dari website
     * lain tidak masuk ke editor.
     */
    event.preventDefault();

    const text =
        event.clipboardData?.getData("text/plain") || "";

    document.execCommand(
        "insertText",
        false,
        text
    );
});

initializeFeedPostImageControls();

ui.form.addEventListener("submit", submitPost);
ui.refresh.addEventListener("click", hardRefresh);

ui.filter.addEventListener("change", () => {
    state.filter = ui.filter.value;
    applyFilter();
});

ui.message.addEventListener("input", () => {
    renderSuggestions(
        ui.message,
        ui.mentionBox,
        state.postMentionUsers,
        state.postMentions
    );
});

$$("input[name='studentAnnouncementTarget']").forEach(radio => {
    radio.addEventListener("change", () => {
        state.postMentions = [];
        hideSuggestions(ui.mentionBox);
        loadPostMentionUsers();
    });
});

ui.list.addEventListener("submit", event => {
    if (event.target.matches(".reply-form")) {
        submitReply(event);
    }
});

ui.list.addEventListener("input", event => {
    const input = event.target.closest(".reply-input");
    if (!input) return;

    const form = input.closest(".reply-form");
    const box = $(".mention-suggestions", form);

    prepareReplyMentions(form).then(() => {
        renderSuggestions(
            input,
            box,
            form._mentionUsers || [],
            form._selectedMentions ||= []
        );
    });
});

ui.list.addEventListener("click", event => {
    const button = event.target.closest(
        "button[data-action]"
    );

    if (!button) return;

    if (button.dataset.action === "toggle-replies") {
        const card = button.closest(".feed-card");

        const currentlyOpen =
            button.getAttribute("aria-expanded") === "true";

        setRepliesOpen(card, !currentlyOpen);
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
    ui.notificationOverlay.addEventListener("click", event => { if (event.target === ui.notificationOverlay) closeStudentNotifications(); });

    const observer = new IntersectionObserver(entries => {
        if (entries[0]?.isIntersecting && state.hasMore && moderation.status === "active") loadAnnouncements(true);
    }, { rootMargin: "300px" });
    observer.observe(ui.loadMoreWrap);

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") { pollTick(); startPolling(); }
        else stopPolling();
    });

(async () => {
    try {
        /*
         * Jalankan pemeriksaan moderation dan pengambilan
         * announcement secara bersamaan.
         */
        const moderationRequest =
            checkModeration();

        const feedRequest =
            loadAnnouncements(false);

        const active =
            await moderationRequest;

        await feedRequest;

        if (active) {
            /*
             * Data tambahan tidak menghambat kemunculan
             * announcement utama.
             */
            Promise.allSettled([
                loadPostMentionUsers(),
                loadNotificationCount()
            ]);

            if (
                sessionStorage.getItem(
                    "notificationAnnouncementId"
                )
            ) {
                await revealNotificationTarget();
                scrollToStoredTarget();
            }
        }
    } catch (error) {
        console.error(
            "Gagal membuka Student Feed:",
            error
        );
    } finally {
        startPolling();
    }
})();
})();
