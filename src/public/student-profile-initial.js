(function () {

    "use strict";


    const PROFILE_CACHE_PREFIX =
        "student-profile-global:";



    let currentStudentProfile =
        null;


    let profileRefreshPromise =
        null;


    let avatarUpdateScheduled =
        false;


    function getProfileInitial(
        displayName
    ) {

        const cleanName =
            String(
                displayName || ""
            )
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();


        if (!cleanName) {
            return "S";
        }


        return Array.from(
            cleanName
        )[0].toLocaleUpperCase(
            "id-ID"
        );

    }


    function getTeacherInitial(
        displayName
    ) {

        const cleanName =
            String(
                displayName || ""
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
            cleanName.split(" ");


        if (
            nameParts.length > 1 &&
            /^(mr|ms|mrs)\.?$/i.test(
                nameParts[0]
            )
        ) {

            nameParts.shift();

        }


        return getProfileInitial(
            nameParts.join(" ")
        );

    }


function normalizeTheme(
    themeName
) {

    const allowedThemes =
        new Set([
            "blue",
            "purple",
            "green",
            "orange",
            "red"
        ]);


    const cleanTheme =
        String(
            themeName || ""
        )
            .trim()
            .toLowerCase();


    return allowedThemes.has(
        cleanTheme
    )
        ? cleanTheme
        : "blue";

}


function installGlobalProfileStyles() {

    if (
        document.getElementById(
            "studentProfileGlobalStyles"
        )
    ) {

        return;

    }


    const style =
        document.createElement(
            "style"
        );


    style.id =
        "studentProfileGlobalStyles";


    /*
        File global hanya mengatur foto profil.
        Tidak mengubah warna halaman, sidebar,
        tombol, panel, ataupun komponen LMS.
    */
    style.textContent = `

        .profile-avatar,
        .top-avatar,
        .composer-avatar,
        #sidebarStudentAvatar,
        #topStudentAvatar {
            overflow: hidden;
        }


        .student-global-avatar-image {
            width: 100%;
            height: 100%;

            display: block;

            border-radius: inherit;

            object-fit: cover;
            object-position: center;
        }


        /*
            Jika belum ada foto profil,
            placeholder inisial tetap biru.
        */
        .profile-avatar:not(:has(img)),
        .top-avatar:not(:has(img)),
        .composer-avatar:not(:has(img)),
        #sidebarStudentAvatar:not(:has(img)),
        #topStudentAvatar:not(:has(img)) {
            color: #ffffff;

            background:
                linear-gradient(
                    135deg,
                    #3b82f6,
                    #1d4ed8
                );
        }

        #sidebarStudentName:not([data-student-identity-ready]),
#sidebarStudentClass:not([data-student-identity-ready]),
#topStudentName:not([data-student-identity-ready]),
.sidebar .profile-avatar:not([data-student-profile-render]),
.topbar .top-avatar:not([data-student-profile-render]),
.sidebar .nav-icon:not([data-sidebar-icon-ready]) {
    visibility: hidden;
}

    `;

    document.head.appendChild(
        style
    );
}

/*
 * Pasang sebelum elemen halaman dirender agar
 * placeholder tidak sempat terlihat.
 *
 * WAJIB berada di luar fungsi.
 */
installGlobalProfileStyles();

document.documentElement
    .removeAttribute(
        "data-student-theme"
    );


document.documentElement.style
    .removeProperty(
        "--student-theme-page"
    );


document.documentElement.style
    .removeProperty(
        "--student-theme-panel"
    );


document.documentElement.style
    .removeProperty(
        "--student-theme-border"
    );


document.documentElement.style
    .removeProperty(
        "--student-theme-glow"
    );


document.documentElement.style
    .removeProperty(
        "--primary"
    );


document.documentElement.style
    .removeProperty(
        "--primary-hover"
    );


document.documentElement.style
    .removeProperty(
        "--primary-soft"
    );

    function getStoredStudentName() {

        return (
            localStorage.getItem(
                "studentName"
            ) ||

            sessionStorage.getItem(
                "studentName"
            ) ||

            document.getElementById(
                "sidebarStudentName"
            )?.textContent ||

            document.getElementById(
                "topStudentName"
            )?.textContent ||

            "Siswa"
        );

    }

function updateCurrentStudentIdentity() {
    const studentName =
        String(
            currentStudentProfile?.name ||
            getStoredStudentName() ||
            "Siswa"
        ).trim();

    const studentClass =
        String(
            currentStudentProfile?.className ||
            localStorage.getItem("studentClass") ||
            sessionStorage.getItem("studentClass") ||
            "Siswa"
        ).trim();

    const identityElements = [
        [
            document.getElementById(
                "sidebarStudentName"
            ),
            studentName
        ],
        [
            document.getElementById(
                "sidebarStudentClass"
            ),
            studentClass
        ],
        [
            document.getElementById(
                "topStudentName"
            ),
            studentName
        ]
    ];

    identityElements.forEach(
        ([element, value]) => {
            if (!element) {
                return;
            }

            if (
                element.textContent.trim() !==
                value
            ) {
                element.textContent =
                    value;
            }

            element.dataset
                .studentIdentityReady =
                "true";
        }
    );
}


    function getStudentAvatarElements() {

        return Array.from(
            new Set(
                [
                    ...document.querySelectorAll(
                        `
                            .profile-avatar,
                            .top-avatar,
                            .composer-avatar
                        `
                    ),

                    document.getElementById(
                        "sidebarStudentAvatar"
                    ),

                    document.getElementById(
                        "topStudentAvatar"
                    ),

                    document.getElementById(
                        "profileMainAvatar"
                    )
                ].filter(Boolean)
            )
        );

    }


    function renderStudentAvatar(
        avatar,
        pictureUrl,
        initial
    ) {

        const cleanPictureUrl =
            String(
                pictureUrl || ""
            ).trim();


        const renderSignature =
            cleanPictureUrl
                ? `image:${cleanPictureUrl}`
                : `initial:${initial}`;


        if (
            avatar.dataset
                .studentProfileRender ===
            renderSignature
        ) {

            return;

        }


        avatar.dataset.studentProfileRender =
            renderSignature;


        avatar.replaceChildren();


        if (!cleanPictureUrl) {

            avatar.textContent =
                initial;

            return;

        }


        const image =
            document.createElement(
                "img"
            );


        image.className =
            "student-global-avatar-image";


        image.alt =
            "Foto profil siswa";


        image.decoding =
            "async";


        image.src =
            cleanPictureUrl;


        image.addEventListener(
            "error",
            () => {

                avatar.replaceChildren();

                avatar.textContent =
                    initial;

                avatar.dataset
                    .studentProfileRender =
                    `initial:${initial}`;

            },
            {
                once:
                    true
            }
        );


        avatar.appendChild(
            image
        );

    }


    function updateCurrentStudentInitials() {

        const displayName =
            currentStudentProfile?.name ||
            getStoredStudentName();


        const initial =
            getProfileInitial(
                displayName
            );


        const pictureUrl =
            currentStudentProfile
                ?.profilePictureUrl ||
            "";


        getStudentAvatarElements()
            .forEach(
                avatar => {

                    renderStudentAvatar(
                        avatar,
                        pictureUrl,
                        initial
                    );

                }
            );

    }


function applyStudentProfile(
    profile,
    saveCache = true
) {
    if (!profile) {
        return;
    }

    const normalizedProfile = {
        studentId:
            String(
                profile.studentId ||
                localStorage.getItem(
                    "studentId"
                ) ||
                ""
            ),

        name:
            String(
                profile.name ||
                getStoredStudentName()
            ).trim(),

        className:
            String(
                profile.className ||
                localStorage.getItem(
                    "studentClass"
                ) ||
                "Siswa"
            ).trim(),

        profilePictureUrl:
            String(
                profile.profilePictureUrl ||
                ""
            ).trim(),

        bannerColor:
            normalizeTheme(
                profile.bannerColor
            ),

        cachedAt:
            Date.now()
    };

    currentStudentProfile =
        normalizedProfile;

    /*
     * Simpan identitas terbaru agar halaman lain
     * dapat menampilkannya tanpa menunggu API.
     */
    if (normalizedProfile.name) {
        localStorage.setItem(
            "studentName",
            normalizedProfile.name
        );
    }

    if (
        normalizedProfile.className &&
        normalizedProfile.className !== "Siswa"
    ) {
        localStorage.setItem(
            "studentClass",
            normalizedProfile.className
        );
    }

    updateCurrentStudentIdentity();
    updateCurrentStudentInitials();

    if (saveCache) {
        writeProfileCache(
            normalizedProfile
        );
    }

    window.dispatchEvent(
        new CustomEvent(
            "student-profile-global-ready",
            {
                detail:
                    normalizedProfile
            }
        )
    );
}


    function getProfileCacheKey() {

        const studentId =
            localStorage.getItem(
                "studentId"
            );


        return studentId
            ? (
                PROFILE_CACHE_PREFIX +
                studentId
            )
            : "";

    }


function readProfileCache() {
    const cacheKey =
        getProfileCacheKey();

    if (!cacheKey) {
        return null;
    }

    try {
        const cachedProfile =
            JSON.parse(
                sessionStorage.getItem(
                    cacheKey
                ) ||
                "null"
            );

        if (
            !cachedProfile ||
            String(
                cachedProfile.studentId ||
                ""
            ) !==
                String(
                    localStorage.getItem(
                        "studentId"
                    ) ||
                    ""
                )
        ) {
            sessionStorage.removeItem(
                cacheKey
            );

            return null;
        }

        return cachedProfile;
    } catch (error) {
        sessionStorage.removeItem(
            cacheKey
        );

        return null;
    }
}


    function writeProfileCache(
        profile
    ) {

        const cacheKey =
            getProfileCacheKey();


        if (!cacheKey) {
            return;
        }


        try {

            sessionStorage.setItem(
                cacheKey,
                JSON.stringify(
                    profile
                )
            );

        } catch (error) {

            console.warn(
                "Cache profil siswa tidak dapat disimpan."
            );

        }

    }


    function clearProfileCache() {

        const cacheKey =
            getProfileCacheKey();


        if (cacheKey) {

            sessionStorage.removeItem(
                cacheKey
            );

        }

    }


    async function refreshStudentProfileIdentity(
        forceRefresh = false
    ) {

        const studentId =
            localStorage.getItem(
                "studentId"
            );


        if (!studentId) {

            updateCurrentStudentInitials();

            return null;

        }


        if (forceRefresh) {

            clearProfileCache();

        } else {

            const cachedProfile =
                readProfileCache();


            if (cachedProfile) {

                applyStudentProfile(
                    cachedProfile,
                    false
                );

            }

        }


        if (profileRefreshPromise) {

            return profileRefreshPromise;

        }


        profileRefreshPromise =
            (async () => {

                try {

                    const response =
                        await fetch(
                            "/api/student/profile",
                            {
                                cache:
                                    "no-store"
                            }
                        );


                    const data =
                        await response
                            .json()
                            .catch(
                                () => ({})
                            );


                    if (
                        !response.ok ||
                        !data.success ||
                        !data.student
                    ) {

                        return null;

                    }


const profile = {
    studentId:
        data.student.id,

    name:
        data.student.name ||
        data.student.fullName,

    className:
        data.student.className ||
        data.student.class_name ||
        localStorage.getItem(
            "studentClass"
        ) ||
        "Siswa",

    profilePictureUrl:
        data.student
            .profilePictureUrl ||
        "",

    bannerColor:
        data.student
            .bannerColor ||
        "blue"
};


                    applyStudentProfile(
                        profile
                    );


                    return profile;

                } catch (error) {

                    console.error(
                        "Profil siswa tidak dapat dimuat:",
                        error
                    );


                    return null;

                } finally {

                    profileRefreshPromise =
                        null;

                }

            })();


        return profileRefreshPromise;

    }


    function scheduleAvatarUpdate() {

        if (
            avatarUpdateScheduled ||
            !currentStudentProfile
        ) {

            return;

        }


        avatarUpdateScheduled =
            true;


        requestAnimationFrame(
            () => {

                avatarUpdateScheduled =
                    false;


                updateCurrentStudentInitials();

            }
        );

    }


    function startStudentAvatarObserver() {

        if (!document.body) {
            return;
        }


        const observer =
            new MutationObserver(
                scheduleAvatarUpdate
            );


        observer.observe(
            document.body,
            {
                childList:
                    true,

                subtree:
                    true
            }
        );

    }


    function initializeStudentProfileGlobal() {

        installGlobalProfileStyles();


        const cachedProfile =
            readProfileCache();


        if (cachedProfile) {

            applyStudentProfile(
                cachedProfile,
                false
            );

} else {
    /*
     * Nama dan kelas tersedia dari session login,
     * meskipun cache foto belum pernah dibuat.
     */
    updateCurrentStudentIdentity();
    updateCurrentStudentInitials();
}


        refreshStudentProfileIdentity();


        startStudentAvatarObserver();

    }

function startStudentPrepaintHydration() {
    const cachedProfile =
        readProfileCache();

    if (cachedProfile) {
        currentStudentProfile =
            cachedProfile;
    }

    const hydrateIdentity = () => {
        updateCurrentStudentIdentity();
        updateCurrentStudentInitials();
    };

    const prepaintObserver =
        new MutationObserver(
            hydrateIdentity
        );

    prepaintObserver.observe(
        document.documentElement,
        {
            childList: true,
            subtree: true
        }
    );

    hydrateIdentity();

    document.addEventListener(
        "DOMContentLoaded",
        () => {
            hydrateIdentity();
            prepaintObserver.disconnect();
        },
        {
            once: true
        }
    );
}

startStudentPrepaintHydration();

    /*
        Kompatibilitas dengan renderer Feed lama.
    */
    window.getProfileInitial =
        getProfileInitial;


    window.getTeacherInitial =
        getTeacherInitial;


    window.updateCurrentStudentInitials =
        updateCurrentStudentInitials;


    window.refreshStudentProfileIdentity =
        refreshStudentProfileIdentity;


    /*
        Halaman Profile mengirim event ini setelah
        siswa menyimpan theme atau foto baru.
    */
    window.addEventListener(
        "student-profile-updated",
        event => {

            const detail =
                event.detail ||
                {};


            applyStudentProfile({

                studentId:
                    detail.studentId,

                name:
                    detail.name,

                profilePictureUrl:
                    detail.profilePictureUrl,

                bannerColor:
                    detail.bannerColor

            });

        }
    );


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initializeStudentProfileGlobal,
            {
                once:
                    true
            }
        );

    } else {

        initializeStudentProfileGlobal();

    }

})();