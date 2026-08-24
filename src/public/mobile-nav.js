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