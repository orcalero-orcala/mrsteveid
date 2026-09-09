(function () {

function installAdminPrepaintStyles() {
    if (
        document.getElementById(
            "adminProfilePrepaintStyles"
        )
    ) {
        return;
    }

    const style =
        document.createElement(
            "style"
        );

    style.id =
        "adminProfilePrepaintStyles";

    style.textContent = `
        #sidebarAdminName:not([data-admin-identity-ready]),
        #sidebarAdminRole:not([data-admin-identity-ready]),
        #topAdminName:not([data-admin-identity-ready]),
        #topAdminRole:not([data-admin-identity-ready]),
        .admin-profile-avatar:not([data-admin-profile-render]),
        .admin-top-avatar:not([data-admin-profile-render]),
        .admin-sidebar .nav-icon:not([data-sidebar-icon-ready]) {
            visibility: hidden;
        }
    `;

    document.head.appendChild(
        style
    );
}

installAdminPrepaintStyles();

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

    /*
     * Nama dan role dari proses login.
     * Ini tersedia langsung tanpa request server.
     */
    const storedAdminName =
        localStorage.getItem(
            "adminName"
        ) ||
        sessionStorage.getItem(
            "adminName"
        ) ||
        "";


    const storedAdminRole =
        localStorage.getItem(
            "adminRole"
        ) ||
        sessionStorage.getItem(
            "adminRole"
        ) ||
        "admin";


    const currentAdminId =
        String(
            localStorage.getItem(
                "adminId"
            ) ||
            sessionStorage.getItem(
                "adminId"
            ) ||
            ""
        );


    /*
     * Foto profil dan tampilan terakhir disimpan
     * setelah endpoint profil berhasil dimuat.
     */
    let cachedAppearance =
        null;


    try {
        cachedAppearance =
            JSON.parse(
                sessionStorage.getItem(
                    "adminProfileAppearance"
                ) ||
                "null"
            );
    } catch (error) {
        sessionStorage.removeItem(
            "adminProfileAppearance"
        );
    }


    /*
     * Jangan memakai foto cache milik akun lain.
     */
    const cacheMatchesAccount =
        cachedAppearance &&
        (
            !currentAdminId ||
            String(
                cachedAppearance.adminId ||
                ""
            ) === currentAdminId
        );


    const adminName =
        storedAdminName ||
        (
            cacheMatchesAccount
                ? cachedAppearance.name
                : ""
        ) ||
        document.getElementById(
            "sidebarAdminName"
        )?.textContent ||
        document.getElementById(
            "topAdminName"
        )?.textContent ||
        "Admin";


    const normalizedRole =
        String(
            storedAdminRole ||
            (
                cacheMatchesAccount
                    ? cachedAppearance.role
                    : ""
            ) ||
            "admin"
        )
            .trim()
            .toLowerCase();


    const displayedRole =
        normalizedRole === "teacher"
            ? "Teacher"
            : normalizedRole === "admin"
                ? "Administrator"
                : normalizedRole;


    /*
     * Isi teks sidebar dan topbar langsung.
     * Tidak menunggu /api/admin/profile.
     */
    [
        "sidebarAdminName",
        "topAdminName"
    ].forEach(id => {
        const element =
            document.getElementById(id);


if (element) {
    if (
        element.textContent.trim() !==
        adminName
    ) {
        element.textContent =
            adminName;
    }

    element.dataset
        .adminIdentityReady =
        "true";
}
    });


    [
        "sidebarAdminRole",
        "topAdminRole"
    ].forEach(id => {
        const element =
            document.getElementById(id);


if (element) {
    if (
        element.textContent.trim() !==
        displayedRole
    ) {
        element.textContent =
            displayedRole;
    }

    element.dataset
        .adminIdentityReady =
        "true";
}
    });


    const initial =
        getTeacherInitial(
            adminName
        );


    const pictureUrl =
        cacheMatchesAccount
            ? String(
                cachedAppearance.pictureUrl ||
                ""
            ).trim()
            : "";


    /*
     * Berlaku untuk sidebar, topbar,
     * composer, dan avatar profil utama.
     */
    document.querySelectorAll(
        `
            .admin-profile-avatar,
            .admin-top-avatar,
            .admin-composer-avatar
        `
    ).forEach(avatar => {

        const renderSignature =
    pictureUrl
        ? `image:${pictureUrl}`
        : `initial:${initial}`;

if (
    avatar.dataset
        .adminProfileRender ===
    renderSignature
) {
    return;
}

avatar.dataset
    .adminProfileRender =
    renderSignature;

        avatar.innerHTML =
            "";


const renderInitial = () => {
    avatar.innerHTML = "";
    avatar.textContent =
        initial;

    avatar.dataset
        .adminProfileRender =
        `initial:${initial}`;
};


        if (!pictureUrl) {
            renderInitial();
            return;
        }


        const image =
            document.createElement(
                "img"
            );


        image.src =
            pictureUrl;

        image.alt =
            "";

        image.decoding =
            "async";

        image.className =
            "admin-profile-avatar-image";


        image.addEventListener(
            "error",
            renderInitial,
            {
                once: true
            }
        );


        avatar.appendChild(
            image
        );
    });
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


const adminPrepaintObserver =
    new MutationObserver(
        updateCurrentAdminInitials
    );

adminPrepaintObserver.observe(
    document.documentElement,
    {
        childList: true,
        subtree: true
    }
);

updateCurrentAdminInitials();

if (
    document.readyState ===
    "loading"
) {
    document.addEventListener(
        "DOMContentLoaded",
        () => {
            updateCurrentAdminInitials();
            adminPrepaintObserver.disconnect();
        },
        {
            once: true
        }
    );
} else {
    updateCurrentAdminInitials();
    adminPrepaintObserver.disconnect();
}

})();