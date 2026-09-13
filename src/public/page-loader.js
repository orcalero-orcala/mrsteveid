(function () {

    "use strict";


    function getPageLoader() {

        return document.getElementById(
            "lmsPageLoader"
        );

    }


    function showPageLoader() {

        const loader =
            getPageLoader();


        if (!loader) {
            return;
        }


        loader.hidden =
            false;


        /*
         * Paksa browser membaca state awal
         * sebelum class animasi dipasang.
         */
        void loader.offsetWidth;


        loader.classList.add(
            "is-visible"
        );


        loader.setAttribute(
            "aria-hidden",
            "false"
        );


        document.documentElement
            .classList.add(
                "lms-page-is-loading"
            );

    }


    function hidePageLoader() {

        const loader =
            getPageLoader();


        if (!loader) {
            return;
        }


        loader.classList.remove(
            "is-visible"
        );


        loader.setAttribute(
            "aria-hidden",
            "true"
        );


        document.documentElement
            .classList.remove(
                "lms-page-is-loading"
            );


        window.setTimeout(
            () => {

                if (
                    !loader.classList.contains(
                        "is-visible"
                    )
                ) {

                    loader.hidden =
                        true;

                }

            },
            180
        );

    }


    /*
     * Pada halaman tujuan, loader tetap tampil
     * sampai resource halaman selesai dimuat.
     */
    if (
        document.readyState ===
        "complete"
    ) {

        requestAnimationFrame(
            hidePageLoader
        );

    } else {

        window.addEventListener(
            "load",
            () => {

                requestAnimationFrame(
                    () => {

                        requestAnimationFrame(
                            hidePageLoader
                        );

                    }
                );

            },
            {
                once: true
            }
        );

    }


    /*
     * Wajib untuk tombol Back/Forward yang memakai
     * browser back-forward cache.
     */
    window.addEventListener(
        "pageshow",
        event => {

            if (
                event.persisted
            ) {

                hidePageLoader();

            }

        }
    );


    /*
     * Dapat dipakai oleh navigasi JavaScript:
     *
     * window.LmsPageLoader.show();
     * window.location.href = "...";
     */
    window.LmsPageLoader = {

        show:
            showPageLoader,

        hide:
            hidePageLoader

    };

})();