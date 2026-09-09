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
        recoveryOverlay: $("#studentFeedRecoveryOverlay")
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
        targetLoading: false
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
        <div class="feed-format-toolbar feed-reply-format-toolbar" aria-label="Format teks">
            <button type="button" class="feed-format-button" data-format="bold" title="Bold"><strong>B</strong></button>
            <button type="button" class="feed-format-button" data-format="italic" title="Italic"><em>I</em></button>
            <button type="button" class="feed-format-button" data-format="underline" title="Underline"><u>U</u></button>
            <button type="button" class="feed-format-button feed-format-clear-button" data-format="clear" title="Hapus formatting" aria-label="Hapus formatting"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19L11 5H13L19 19"></path><path d="M7.5 14H16.5"></path><path d="M4 4L20 20"></path></svg></button>
            <button type="button" class="feed-format-button feed-format-list-button" data-format="bullet" title="Daftar poin">• List</button>
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
    const scope = button?.closest(
        ".reply-editor, .composer-input-area"
    );

    return scope?.querySelector(
        ".feed-rich-editor"
    ) || null;
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

function setFormatButtonState(button, active) {
    if (!button || button.dataset.format === "clear") {
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

function clearToolbarButtonStates() {
    $$(".feed-format-button[data-format]").forEach(
        button => setFormatButtonState(button, false)
    );
}

function syncFormatToolbar(editor) {
    if (!editor) {
        clearToolbarButtonStates();
        return;
    }

    const scope = editor.closest(
        ".reply-editor, .composer-input-area"
    );

    const toolbar = scope?.querySelector(
        ".feed-format-toolbar"
    );

    if (!toolbar) return;

    const commandByFormat = {
        bold: "bold",
        italic: "italic",
        underline: "underline",
        bullet: "insertUnorderedList"
    };

    $$(
        ".feed-format-button[data-format]",
        toolbar
    ).forEach(button => {
        const command =
            commandByFormat[button.dataset.format];

        if (!command) {
            setFormatButtonState(button, false);
            return;
        }

        let active = false;

        try {
            active = document.queryCommandState(command);
        } catch {
            active = false;
        }

        setFormatButtonState(button, active);
    });
}

function activeRichEditor() {
    const selection = window.getSelection();
    const node = selection?.anchorNode;

    if (!node) return null;

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

    document.execCommand(
        "styleWithCSS",
        false,
        false
    );

    if (format === "clear") {
        const collapsed =
            !selection ||
            selection.isCollapsed;

        if (collapsed) {
            /*
             * Jika tidak ada teks yang diblok, matikan
             * mode Bold, Italic dan Underline yang aktif.
             */
            ["bold", "italic", "underline"].forEach(
                command => {
                    try {
                        if (
                            document.queryCommandState(command)
                        ) {
                            document.execCommand(
                                command,
                                false,
                                null
                            );
                        }
                    } catch {
                        // Abaikan browser yang tidak mendukung.
                    }
                }
            );
        } else {
            /*
             * Jika ada selection, bersihkan format
             * dari teks yang dipilih.
             */
            document.execCommand(
                "removeFormat",
                false,
                null
            );
        }
    } else {
        const commands = {
            bold: "bold",
            italic: "italic",
            underline: "underline",
            bullet: "insertUnorderedList"
        };

        const command = commands[format];

        if (!command) return;

        document.execCommand(
            command,
            false,
            null
        );
    }

    editor.dispatchEvent(
        new Event("input", { bubbles: true })
    );

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
    const label = $("[data-reply-label]", button);

    if (!panel || !button || !label) return;

    panel.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    label.textContent = open
        ? "Sembunyikan replies"
        : "Tampilkan replies";
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

    function createReplyItem(postId, reply) {
        const type = reply.sender_type || (reply.admin_id ? "admin" : "student");
        const senderId = reply.sender_id ?? reply.student_id ?? reply.studentId ?? null;
        const name = reply.sender_name || reply.student_name || (type === "admin" ? "Admin / Guru" : "Siswa");
        const detail = type === "admin" ? "Admin / Guru" : (reply.class_name || "Siswa");
        const picture = reply.profile_picture_url || reply.student_profile_picture_url || "";
        const owner = type === "student" && Number(senderId) === studentId;
        const item = document.createElement("div");
        item.id = `reply-${reply.id}`;
        item.className = "reply-item";
        item.innerHTML = `
            <div class="reply-author-row"><div class="reply-avatar">${type === "admin" ? teacherInitial(name) : profileInitial(name)}</div>
            <div class="reply-author-info"><strong>${escapeHtml(name)} ${type === "admin" ? teacherBadge() : ""}</strong><span>${escapeHtml(detail)}</span></div></div>
            <div class="reply-message">${formatMessage(reply.message, reply.mentions)}</div>
            <div class="reply-footer"><span>${escapeHtml(dateTime(reply.created_at))}</span>
            ${owner ? `<button type="button" class="reply-delete-button" data-action="delete-reply" data-post-id="${Number(postId)}" data-reply-id="${Number(reply.id)}">Hapus</button>` : ""}</div>`;
        renderAvatar($(".reply-avatar", item), type, name, picture);
        return item;
    }

    function createPostCard(post) {
        const isStudent = Number(post.student_id ?? post.studentId ?? 0) > 0;
        const className = post.class_name ?? post.className ?? null;
        const name = isStudent ? (post.student_creator_name || post.studentName || "Siswa") : (post.admin_creator_name || "Admin / Guru");
        const detail = isStudent ? (post.student_creator_class || className || "Siswa") : "Admin / Guru";
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
        const owner = Number(post.student_id ?? post.studentId) === studentId;
        const card = document.createElement("div");
        card.id = `announcement-${post.id}`;
        card.className = "feed-card";
        card.dataset.feedClass = className || "";
        card.innerHTML = `
            <div class="feed-card-header"><div class="feed-author"><div class="feed-avatar">${isStudent ? profileInitial(name) : teacherInitial(name)}</div>
            <div><strong>${escapeHtml(name)} ${isStudent ? "" : teacherBadge()}</strong><span>${escapeHtml(detail)} · ${escapeHtml(dateTime(post.created_at))}</span></div></div>
            <span class="feed-scope-badge ${className ? "class" : "global"}">${className ? escapeHtml(className) : "Global"}</span></div>
            <div class="feed-message">${formatMessage(post.message, post.mentions)}</div>
            ${owner ? `<div class="feed-owner-actions"><button type="button" class="feed-delete-button" data-action="delete-post" data-post-id="${Number(post.id)}">Hapus</button></div>` : ""}
<div class="feed-divider"></div>

<div class="reply-section">
    <button
        type="button"
        class="reply-toggle-button"
        data-action="toggle-replies"
        aria-expanded="false"
    >
        <span data-reply-label>Tampilkan replies</span>
        (<span data-reply-count>0</span>)
    </button>

    <div class="reply-collapsible" hidden>
        <div id="replies-${post.id}" class="reply-list">
            <small>Belum ada reply.</small>
        </div>

        <form
            class="reply-form reply-composer"
            data-id="${Number(post.id)}"
        >
            <div class="reply-editor">
<div
    class="reply-input feed-rich-editor"
    contenteditable="true"
    role="textbox"
    aria-multiline="true"
    data-placeholder="Tulis reply... gunakan @ untuk mention"
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
                Kirim
            </button>
        </form>
    </div>
</div>`;
        renderAvatar($(".feed-avatar", card), isStudent ? "student" : "admin", name, picture);
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
ui.list.textContent = "Memuat feed...";
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
        const text = editorToMarkup(ui.message);
        if (!text || moderation.status !== "active") return;
        const button = $("button[type='submit']", ui.form);
        const target = $("input[name='studentAnnouncementTarget']:checked")?.value || "class";
        button.disabled = true;
        button.textContent = "Memposting...";
        ui.status.textContent = "Membuat announcement...";
        beginForeground();
        try {
            const mentions = mergeTypedMentions(text, state.postMentions, state.postMentionUsers);
            const data = await request(`/api/student/${studentId}/announcements`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text, target, mentions })
            });
            addPost(data.announcement);
            ui.message.replaceChildren();
            state.postMentions = [];
            hideSuggestions(ui.mentionBox);
            ui.status.textContent = "Announcement berhasil dibuat.";
        } catch (error) {
            ui.status.textContent = `Post gagal dipublikasikan: ${error.message}`;
        } finally {
            endForeground();
            button.disabled = false;
            button.textContent = "Posting";
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

    function renderSuggestions(input, box, users, selected) {
        const query = activeMentionQuery(input);
        if (query === null) return hideSuggestions(box);
        const matches = [...users].filter(user => String(user.name || "").toLowerCase().includes(query))
            .sort((a, b) => a.name.localeCompare(b.name, "id", { sensitivity: "base" })).slice(0, 20);
        hideSuggestions(box);
        matches.forEach(user => {
            const button = document.createElement("button");
            button.type = "button";
            button.style.cssText = "display:block;width:100%;text-align:left";
            const detail = user.type === "student" ? `Student — ${user.className || "-"}` : (user.role || "Admin / Guru");
            button.textContent = `${user.name} (${detail})`;
            button.addEventListener("click", () => { insertMention(input, user, selected); hideSuggestions(box); });
            box.appendChild(button);
        });
        box.style.display = matches.length ? "block" : "none";
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

document.addEventListener("mousedown", event => {
    const button = event.target.closest(
        ".feed-format-button[data-format]"
    );

    /*
     * Selection pada rich editor tidak boleh hilang
     * ketika tombol toolbar ditekan.
     */
    if (button) {
        event.preventDefault();
    }
});

document.addEventListener("click", event => {
    const button = event.target.closest(
        ".feed-format-button[data-format]"
    );

    if (!button) return;

    const editor = editorFromToolbar(button);

    applyFeedFormatting(
        editor,
        button.dataset.format
    );
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
    const editor = event.target.closest?.(
        ".feed-rich-editor"
    );

    if (editor) {
        syncFormatToolbar(editor);
    }
});

document.addEventListener("mouseup", event => {
    const editor = event.target.closest?.(
        ".feed-rich-editor"
    );

    if (editor) {
        syncFormatToolbar(editor);
    }
});

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
