(() => {
    "use strict";

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
    const adminId = Number(localStorage.getItem("adminId"));
    const adminName = localStorage.getItem("adminName") || "Admin";
    const adminRole = localStorage.getItem("adminRole") || "Administrator";
    const adminUsername = localStorage.getItem("adminUsername");

    if (!Number.isInteger(adminId) || !adminUsername) {
        location.href = "/admin-login.html";
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
        notificationList: $("#adminNotificationList")
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
        pollTimer: null,
        pollRunning: false,
        foreground: 0,
        notificationTick: 0,
        notificationTargetLoading: false,
        classesLoaded: false
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
            location.href = "/admin-login.html";
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
    const label = $("[data-reply-label]", button);

    if (!panel || !button || !label) return;

    panel.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    label.textContent = open
        ? "Sembunyikan replies"
        : "Tampilkan replies";
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

    function createReplyItem(postId, reply) {
        const type = reply.sender_type || (reply.admin_id ? "admin" : "student");
        const name = reply.sender_name || reply.student_name || (type === "admin" ? "Admin / Guru" : "Siswa");
        const detail = type === "admin" ? "Admin / Guru" : (reply.class_name || "Siswa");
        const picture = reply.profile_picture_url || reply.student_profile_picture_url || "";
        const item = document.createElement("div");
        item.id = `reply-${reply.id}`;
        item.className = "reply-item";
        item.innerHTML = `
            <div class="reply-author-row"><div class="reply-avatar">${type === "admin" ? teacherInitial(name) : profileInitial(name)}</div>
            <div class="reply-author-info"><strong>${escapeHtml(name)} ${type === "admin" ? teacherBadge() : ""}</strong><span>${escapeHtml(detail)}</span></div></div>
            <div class="reply-message">${formatMessage(reply.message, reply.mentions)}</div>
            <div class="reply-footer"><span>${escapeHtml(dateTime(reply.created_at))}</span>
            <button type="button" class="feed-delete-button" data-action="delete-reply" data-post-id="${Number(postId)}" data-reply-id="${Number(reply.id)}">Hapus</button></div>`;
        renderAvatar($(".reply-avatar", item), type, name, picture);
        return item;
    }

    function createPostCard(post) {
        const isStudent = Number(post.student_id ?? post.studentId ?? 0) > 0;
        const name = isStudent
            ? (post.student_creator_name || post.studentName || "Siswa")
            : (post.admin_creator_name || "Admin / Guru");
        const detail = isStudent ? (post.student_creator_class || post.class_name || "Siswa") : "Admin / Guru";
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
        card.className = "feed-card admin-feed-card";
        card.dataset.feedClass = post.class_name || "";
        card.innerHTML = `
            <div class="feed-card-header"><div class="feed-author"><div class="feed-avatar">${isStudent ? profileInitial(name) : teacherInitial(name)}</div>
            <div><strong>${escapeHtml(name)} ${isStudent ? "" : teacherBadge()}</strong><span>${escapeHtml(detail)} · ${escapeHtml(dateTime(post.created_at))}</span></div></div>
            <span class="feed-scope-badge">${post.class_name ? escapeHtml(post.class_name) : "Global"}</span></div>
            <div class="feed-message">${formatMessage(post.message, post.mentions)}</div>
            <div class="feed-owner-actions"><button type="button" class="feed-delete-button" data-action="delete-post" data-post-id="${Number(post.id)}">Hapus</button></div>
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
        <div id="admin-replies-${post.id}" class="reply-list">
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
    data-placeholder="Tulis balasan... gunakan @ untuk mention"
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
                Kirim
            </button>
        </form>
    </div>
</div>`;
        renderAvatar($(".feed-avatar", card), isStudent ? "student" : "admin", name, picture);
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
            ui.list.textContent = "Memuat...";
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
        const text = editorToMarkup(ui.message);
        if (!text) return;
        const button = $("button[type='submit']", ui.form);
        const target = $("input[name='target']:checked")?.value || "global";
        const className = target === "class" ? ui.classSelect.value.trim() : "";
        if (target === "class" && !className) {
            ui.status.textContent = "Pilih kelas terlebih dahulu.";
            return;
        }
        button.disabled = true;
        button.textContent = "Memposting...";
        ui.status.textContent = "Membuat announcement...";
        beginForeground();
        try {
            const mentions = mergeTypedMentions(text, state.postMentions, state.postMentionUsers);
            const data = await request("/api/admin/announcements", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ adminId, message: text, className, mentions })
            });
            addPost(data.announcement);
            ui.form.reset();
            ui.message.replaceChildren();
            ui.classWrap.style.display = "none";
            ui.classSelect.required = false;
            state.postMentions = [];
            hideSuggestions(ui.mentionBox);
            ui.status.textContent = "Announcement berhasil dibuat.";
        } catch (error) {
            ui.status.textContent = error.message;
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

    function suggestionLabel(user) {
        return user.type === "student"
            ? `${user.name} (Student — ${user.className || "-"})`
            : `${user.name} (${user.role || "Admin / Guru"})`;
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
        const matches = [...users]
            .filter(user => String(user.name || "").toLowerCase().includes(query))
            .sort((a, b) => a.name.localeCompare(b.name, "id", { sensitivity: "base" }))
            .slice(0, 20);
        hideSuggestions(box);
        matches.forEach(user => {
            const button = document.createElement("button");
            button.type = "button";
            button.style.cssText = "display:block;width:100%;text-align:left";
            button.textContent = suggestionLabel(user);
            button.addEventListener("click", () => {
                insertMention(input, user, selected);
                hideSuggestions(box);
            });
            box.appendChild(button);
        });
        box.style.display = matches.length ? "block" : "none";
    }

    async function loadPostMentionUsers() {
        try {
            const [studentsData, adminsData] = await Promise.all([
                request("/api/admin/students"),
                request("/api/admin/users/mention-list")
            ]);
            state.postMentionUsers = [
                ...(studentsData.students || []).map(item => ({ id: item.id, name: item.name, type: "student", className: item.class_name })),
                ...(adminsData.admins || []).map(item => ({ id: item.id, name: item.name, type: "admin", role: item.role }))
            ];
        } catch (error) {
            console.error("Gagal memuat mention post:", error);
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
        if (form._mentionUsers || form._mentionLoading) return;
        form._mentionLoading = true;
        try {
            const data = await request(`/api/mentions/users?announcementId=${encodeURIComponent(form.dataset.id)}`);
            form._mentionUsers = data.users || [];
        } catch (error) {
            form._mentionUsers = [];
        } finally {
            form._mentionLoading = false;
        }
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
        ui.notificationList.textContent = "Memuat...";
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
        document.body.style.overflow = "hidden";
        loadNotificationPanel();
    }

    function closeAdminNotifications() {
        ui.notificationOverlay.style.display = "none";
        document.body.style.overflow = "";
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
            location.href = "/admin-login.html";
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
    ui.filter.addEventListener("change", () => { state.filter = ui.filter.value; applyFilter(); });
    ui.message.addEventListener("input", () => renderSuggestions(ui.message, ui.mentionBox, availablePostMentionUsers(), state.postMentions));
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
    ui.list.addEventListener("input", event => {
        const input = event.target.closest(".admin-reply-input");
        if (!input) return;
        const form = input.closest(".admin-reply-form");
        const box = $(".admin-mention-suggestions", form);
        prepareReplyMentions(form).then(() => renderSuggestions(input, box, form._mentionUsers || [], form._selectedMentions ||= []));
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
