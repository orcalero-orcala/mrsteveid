// =========================================
// GLOBAL STUDENT SESSION WATCH
// =========================================

let studentSessionCheckRunning =
    false;

let studentForceLogoutRunning =
    false;


/*
    Logout paksa karena akun siswa
    sudah tidak ada di database.
*/
function forceStudentLogout(
    message = "Kamu telah dilogout."
) {

    if (
        studentForceLogoutRunning
    ) {
        return;
    }


    studentForceLogoutRunning =
        true;


    console.log(
        message
    );


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


    alert(
        message
    );


    window.location.replace(
        "/student-login.html"
    );

}


/*
    Cek apakah akun yang ada dalam
    session masih benar-benar ada.
*/
async function checkStudentSession() {

    /*
        Kalau sedang di halaman login
        dan memang tidak ada studentId,
        tidak perlu melakukan apa-apa.
    */
    const studentId =
        localStorage.getItem(
            "studentId"
        );


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


        if (
            response.status === 401 &&
            data.loggedOut
        ) {

            forceStudentLogout(
                data.message ||
                "Kamu telah dilogout."
            );


            return false;

        }


        return true;


    } catch (error) {

        /*
            Server mati / koneksi putus
            BUKAN berarti akun dihapus.

            Jadi jangan logout hanya
            karena internet bermasalah.
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
// CEK OTOMATIS
// ========================================

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


// Begitu tab aktif kembali,
// langsung cek.
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