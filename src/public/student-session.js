// =========================================
// LOAD GLOBAL STUDENT PROFILE
// =========================================

(function loadStudentProfileGlobal() {

    const profileScriptPath =
        "/student-profile-initial.js";


    const alreadyLoaded =
        Array.from(
            document.scripts
        ).some(
            script => {

                try {

                    return new URL(
                        script.src,
                        window.location.href
                    ).pathname ===
                    profileScriptPath;

                } catch (error) {

                    return false;

                }

            }
        );


    if (alreadyLoaded) {
        return;
    }


    const profileScript =
        document.createElement(
            "script"
        );


profileScript.src =
    profileScriptPath +
    "?v=20260903-pfp2";


    profileScript.async =
        false;

profileScript.addEventListener(
    "load",
    () => {

        if (
            typeof window
                .refreshStudentProfileIdentity ===
            "function"
        ) {

            window
                .refreshStudentProfileIdentity(
                    true
                );

        }

    },
    {
        once:
            true
    }
);


    document.head.appendChild(
        profileScript
    );

})();

// =========================================
// GLOBAL STUDENT SESSION WATCH
// =========================================

let studentSessionCheckRunning =
    false;

let studentForceLogoutRunning =
    false;


/*
    Hapus data login siswa yang tersimpan
    pada browser.
*/
function clearStudentLocalSession() {

    localStorage.removeItem(
        "studentId"
    );

    localStorage.removeItem(
        "studentName"
    );

    localStorage.removeItem(
        "studentClass"
    );

    localStorage.removeItem(
        "studentLoginCode"
    );

}


/*
    Logout dengan pesan hanya digunakan jika
    backend memastikan data siswa benar-benar
    sudah dihapus atau direset.
*/
function forceStudentLogout(
    message =
        "Kamu telah dilogout karena data siswa telah direset."
) {

    if (
        studentForceLogoutRunning
    ) {

        return;

    }


    studentForceLogoutRunning =
        true;


    clearStudentLocalSession();


    alert(
        message
    );


    window.location.replace(
        "/student-login.html"
    );

}


/*
    Session hilang biasa:

    - deploy baru;
    - cookie kedaluwarsa;
    - browser/session baru;
    - session server dibersihkan.

    Data lokal dibersihkan tanpa alert.
*/
function clearMissingStudentSession() {

    clearStudentLocalSession();


    /*
        Kalau sudah berada di halaman login,
        tidak perlu melakukan redirect ulang.
    */
    if (
        window.location.pathname !==
        "/student-login.html"
    ) {

        window.location.replace(
            "/student-login.html"
        );

    }

}


/*
    Periksa apakah session siswa masih valid.
*/
async function checkStudentSession() {

    const studentId =
        localStorage.getItem(
            "studentId"
        );


    /*
        Browser ini memang belum login.
        Tidak perlu memanggil backend.
    */
    if (!studentId) {

        return true;

    }


    if (
        studentSessionCheckRunning ||
        studentForceLogoutRunning
    ) {

        return true;

    }


    studentSessionCheckRunning =
        true;


    try {

        const response =
            await fetch(
                "/api/student/session-status",
                {
                    cache:
                        "no-store"
                }
            );


        const data =
            await response.json();


        /*
            Session server hilang biasa.

            Jangan tampilkan pesan logout.
        */
        if (
            response.status === 401 &&
            data.reason ===
                "session-missing"
        ) {

            clearMissingStudentSession();

            return false;

               }


        /*
            Backend memastikan akun siswa
            benar-benar sudah dihapus/reset.
        */
        if (
            response.status === 401 &&
            data.loggedOut === true &&
            data.reason ===
                "student-data-reset"
        ) {

            forceStudentLogout(
                data.message ||
                "Kamu telah dilogout karena data siswa telah direset."
            );


            return false;

        }


        return true;


    } catch (error) {

        /*
            Gangguan jaringan atau server tidak
            boleh dianggap sebagai logout.
        */
        console.error(
            "Gagal mengecek session siswa:",
            error
        );


        return true;


    } finally {

        studentSessionCheckRunning =
            false;

    }

}


// =========================================
// CEK SESSION OTOMATIS
// =========================================

setInterval(
    () => {

        if (
            document.visibilityState ===
            "visible"
        ) {

            checkStudentSession();

        }

    },
    5000
);


// Saat tab dibuka kembali.
document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.visibilityState ===
            "visible"
        ) {

            checkStudentSession();

        }

    }
);


// Cek langsung saat halaman dibuka.
checkStudentSession();

// ========================================
// STUDENT SIDEBAR SVG ICONS
// ========================================

const STUDENT_SIDEBAR_ICONS = {

    dashboard: `
        <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <rect
                x="3"
                y="3"
                width="7"
                height="7"
                rx="1.5"
            ></rect>

            <rect
                x="14"
                y="3"
                width="7"
                height="7"
                rx="1.5"
            ></rect>

            <rect
                x="3"
                y="14"
                width="7"
                height="7"
                rx="1.5"
            ></rect>

            <rect
                x="14"
                y="14"
                width="7"
                height="7"
                rx="1.5"
            ></rect>
        </svg>
    `,

    profile: `
        <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <circle
                cx="12"
                cy="8"
                r="4"
            ></circle>

            <path
                d="M4.5 21a7.5 7.5 0 0 1 15 0"
            ></path>
        </svg>
    `,

    points: `
        <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <path
                d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"
            ></path>
        </svg>
    `,

    scores: `
        <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <rect
                x="4"
                y="3"
                width="16"
                height="18"
                rx="2"
            ></rect>

            <path
                d="M8 8h8"
            ></path>

            <path
                d="M8 12h8"
            ></path>

            <path
                d="M8 16h5"
            ></path>
        </svg>
    `,

    quiz: `
        <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <circle
                cx="12"
                cy="12"
                r="9"
            ></circle>

            <path
                d="M9.7 9a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1.1.8-1.1 1.7"
            ></path>

            <path
                d="M12 17h.01"
            ></path>
        </svg>
    `,

    feed: `
        <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <path
                d="M20 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4v8Z"
            ></path>

            <path
                d="M8 9h8"
            ></path>

            <path
                d="M8 13h5"
            ></path>
        </svg>
    `

};


function getStudentSidebarIcon(
    navigationText
) {

    const text =
        String(
            navigationText ||
            ""
        )
            .trim()
            .toLowerCase();


    if (
        text.includes(
            "dashboard"
        )
    ) {

        return STUDENT_SIDEBAR_ICONS
            .dashboard;

    }


    if (
        text.includes(
            "profile"
        )
    ) {

        return STUDENT_SIDEBAR_ICONS
            .profile;

    }


    if (
        text.includes(
            "poin"
        )
    ) {

        return STUDENT_SIDEBAR_ICONS
            .points;

    }


    if (
        text.includes(
            "nilai"
        )
    ) {

        return STUDENT_SIDEBAR_ICONS
            .scores;

    }


    if (
        text.includes(
            "quiz"
        )
    ) {

        return STUDENT_SIDEBAR_ICONS
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

        return STUDENT_SIDEBAR_ICONS
            .feed;

    }


    return "";

}


function applyStudentSidebarIcons() {

    document
        .querySelectorAll(
            ".sidebar .sidebar-nav .nav-item"
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
                    getStudentSidebarIcon(
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
        applyStudentSidebarIcons
    );

} else {

    applyStudentSidebarIcons();

}