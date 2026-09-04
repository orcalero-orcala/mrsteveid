// =========================================
// GLOBAL MOBILE SIDEBAR
// =========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const sidebar =
            document.querySelector(
                ".sidebar"
            );

        const mainContent =
            document.querySelector(
                ".main-content"
            );


        /*
            Halaman tanpa sidebar
            tidak perlu melakukan apa-apa.
        */
        if (
            !sidebar ||
            !mainContent
        ) {
            return;
        }


        // =====================================
        // HAMBURGER BUTTON
        // =====================================

        const menuButton =
            document.createElement(
                "button"
            );


        menuButton.type =
            "button";

        menuButton.className =
            "mobile-menu-button";

        menuButton.setAttribute(
            "aria-label",
            "Buka menu"
        );

        menuButton.innerHTML = `
            <span></span>
            <span></span>
            <span></span>
        `;


        document.body.appendChild(
            menuButton
        );


        // =====================================
        // BACKDROP
        // =====================================

        const backdrop =
            document.createElement(
                "div"
            );


        backdrop.className =
            "mobile-sidebar-backdrop";


        document.body.appendChild(
            backdrop
        );


        function openMobileSidebar() {

            sidebar.classList.add(
                "mobile-sidebar-open"
            );

            backdrop.classList.add(
                "is-visible"
            );

            menuButton.classList.add(
                "is-open"
            );


            document.body.classList.add(
                "mobile-sidebar-active"
            );

        }


        function closeMobileSidebar() {

            sidebar.classList.remove(
                "mobile-sidebar-open"
            );

            backdrop.classList.remove(
                "is-visible"
            );

            menuButton.classList.remove(
                "is-open"
            );


            document.body.classList.remove(
                "mobile-sidebar-active"
            );

        }


        function toggleMobileSidebar() {

            if (
                sidebar.classList.contains(
                    "mobile-sidebar-open"
                )
            ) {

                closeMobileSidebar();

            } else {

                openMobileSidebar();

            }

        }


        menuButton.addEventListener(
            "click",
            toggleMobileSidebar
        );


        backdrop.addEventListener(
            "click",
            closeMobileSidebar
        );


        /*
            Setelah memilih menu,
            drawer langsung tertutup.
        */
        sidebar
            .querySelectorAll(
                ".nav-item"
            )
            .forEach(
                (button) => {

                    button.addEventListener(
                        "click",
                        closeMobileSidebar
                    );

                }
            );


        window.addEventListener(
            "resize",
            () => {

                if (
                    window.innerWidth >
                    900
                ) {

                    closeMobileSidebar();

                }

            }
        );


        document.addEventListener(
            "keydown",
            (event) => {

                if (
                    event.key ===
                    "Escape"
                ) {

                    closeMobileSidebar();

                }

            }
        );

    }
);

// ========================================
// ADMIN SIDEBAR SVG ICONS
// ========================================

const ADMIN_SIDEBAR_ICONS = {

    dashboard: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
            <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
            <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
            <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
        </svg>
    `,

    students: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="9" cy="8" r="3.5"></circle>
            <path d="M3 20a6 6 0 0 1 12 0"></path>
            <path d="M16 5.5a3 3 0 0 1 0 5.8"></path>
            <path d="M17 15a5 5 0 0 1 4 5"></path>
        </svg>
    `,

    search: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5"></circle>
            <path d="m20 20-4.8-4.8"></path>
        </svg>
    `,

    points: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"></path>
        </svg>
    `,

    scores: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="4" y="3" width="16" height="18" rx="2"></rect>
            <path d="M8 8h8"></path>
            <path d="M8 12h8"></path>
            <path d="M8 16h5"></path>
        </svg>
    `,

    quiz: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9"></circle>
            <path d="M9.7 9a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1.1.8-1.1 1.7"></path>
            <path d="M12 17h.01"></path>
        </svg>
    `,

    feed: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4v8Z"></path>
            <path d="M8 9h8"></path>
            <path d="M8 13h5"></path>
        </svg>
    `,

    announcement: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 13V9a2 2 0 0 1 2-2h3l8-4v16l-8-4H6a2 2 0 0 1-2-2Z"></path>
            <path d="M9 15v4a2 2 0 0 1-2 2"></path>
            <path d="M20 8v6"></path>
        </svg>
    `,

    teachers: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="9" cy="8" r="3.5"></circle>
            <path d="M3 20a6 6 0 0 1 12 0"></path>
            <path d="m16 13 2 2 4-4"></path>
        </svg>
    `,

    settings: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"></path>
        </svg>
    `

};


function getAdminSidebarIcon(
    navigationText
) {

    const text =
        String(
            navigationText ||
            ""
        )
            .trim()
            .toLowerCase();


    /*
        Urutan penting:
        Student Search diperiksa sebelum
        Kelola Siswa.
    */

    if (
        text.includes(
            "student search"
        )
    ) {

        return ADMIN_SIDEBAR_ICONS
            .search;

    }


    if (
        text.includes(
            "dashboard"
        )
    ) {

        return ADMIN_SIDEBAR_ICONS
            .dashboard;

    }


    if (
        text.includes(
            "kelola siswa"
        )
    ) {

        return ADMIN_SIDEBAR_ICONS
            .students;

    }


    if (
        text.includes(
            "poin"
        )
    ) {

        return ADMIN_SIDEBAR_ICONS
            .points;

    }


    if (
        text.includes(
            "nilai"
        )
    ) {

        return ADMIN_SIDEBAR_ICONS
            .scores;

    }


    if (
        text.includes(
            "quiz"
        )
    ) {

        return ADMIN_SIDEBAR_ICONS
            .quiz;

    }


    if (
        text.includes(
            "classroom"
        ) ||
        text.includes(
            "feed"
        )
    ) {

        return ADMIN_SIDEBAR_ICONS
            .feed;

    }


    if (
        text.includes(
            "information"
        ) ||
        text.includes(
            "announcement"
        )
    ) {

        return ADMIN_SIDEBAR_ICONS
            .announcement;

    }


    if (
        text.includes(
            "guru"
        )
    ) {

        return ADMIN_SIDEBAR_ICONS
            .teachers;

    }


    if (
        text.includes(
            "system"
        ) ||
        text.includes(
            "reset"
        )
    ) {

        return ADMIN_SIDEBAR_ICONS
            .settings;

    }


    return "";

}


function applyAdminSidebarIcons() {

    const adminSidebar =
        document.querySelector(
            ".admin-sidebar"
        );


    if (!adminSidebar) {
        return;
    }


    adminSidebar
        .querySelectorAll(
            ".sidebar-nav .nav-item"
        )
        .forEach(
            navigationItem => {

                const iconElement =
                    navigationItem
                        .querySelector(
                            ".nav-icon"
                        );


                if (!iconElement) {
                    return;
                }


                const iconSvg =
                    getAdminSidebarIcon(
                        navigationItem
                            .textContent
                    );


                if (!iconSvg) {
                    return;
                }


                iconElement.innerHTML =
                    iconSvg;

            }
        );

}


if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        applyAdminSidebarIcons
    );

} else {

    applyAdminSidebarIcons();

}