(function () {

    /*
        Mengambil huruf pertama dari nama biasa.

        Contoh:
        Budi Santoso -> B
        Richie -> R
    */
    function getProfileInitial(
        displayName
    ) {

        const cleanName =
            String(
                displayName ||
                ""
            )
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();


        if (!cleanName) {

            return "A";

        }


        return Array.from(
            cleanName
        )[0].toLocaleUpperCase(
            "id-ID"
        );

    }


    /*
        Mengambil inisial guru tanpa memakai
        prefix Mr, Ms, atau Mrs.

        Contoh:
        Mr Richie -> R
        Ms. Sarah -> S
    */
    function getTeacherInitial(
        displayName
    ) {

        const cleanName =
            String(
                displayName ||
                ""
            )
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();


        if (!cleanName) {

            return "A";

        }


        const nameParts =
            cleanName.split(
                " "
            );


        /*
            Prefix hanya dilewati jika masih ada
            bagian nama setelah prefix tersebut.
        */
        if (
            nameParts.length > 1 &&
            /^(mr|ms|mrs)\.?$/i.test(
                nameParts[0]
            )
        ) {

            nameParts.shift();

        }


        const actualName =
            nameParts.join(
                " "
            );


        return getProfileInitial(
            actualName
        );

    }


    /*
        Perbarui avatar akun Admin/Guru yang sedang
        login pada sidebar, topbar, dan composer.
    */
    function updateCurrentAdminInitials() {

        const adminName =
            localStorage.getItem(
                "adminName"
            ) ||
            sessionStorage.getItem(
                "adminName"
            ) ||
            document.getElementById(
                "sidebarAdminName"
            )?.textContent ||
            document.getElementById(
                "topAdminName"
            )?.textContent ||
            "Admin";


        const initial =
            getTeacherInitial(
                adminName
            );


        document.querySelectorAll(
            `
                .admin-profile-avatar,
                .admin-top-avatar,
                .admin-composer-avatar
            `
        ).forEach(
            (avatar) => {

                avatar.textContent =
                    initial;

            }
        );

    }


    /*
        Jadikan fungsi tersedia untuk script
        Feed, post, dan reply.
    */
    window.getProfileInitial =
        getProfileInitial;

    window.getTeacherInitial =
        getTeacherInitial;

    window.updateCurrentAdminInitials =
        updateCurrentAdminInitials;


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            updateCurrentAdminInitials
        );

    } else {

        updateCurrentAdminInitials();

    }

})();