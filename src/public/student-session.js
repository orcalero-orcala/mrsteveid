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