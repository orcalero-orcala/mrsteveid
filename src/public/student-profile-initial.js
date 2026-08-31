(function () {

    /*
        Sisi siswa tidak memiliki aturan prefix.

        Huruf pertama dari seluruh nama tampilan
        langsung menjadi avatar.
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

            return "S";

        }


        return Array.from(
            cleanName
        )[0].toLocaleUpperCase(
            "id-ID"
        );

    }

    /*
    Khusus author Admin/Guru.

    Prefix Mr, Ms, dan Mrs dilewati agar:
    Mr Richie -> R
    Ms Sarah -> S
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
        Perbarui avatar siswa yang sedang login:
        sidebar, topbar, dan composer Feed.
    */
    function updateCurrentStudentInitials() {

        const studentName =
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
            "Siswa";


        const initial =
            getProfileInitial(
                studentName
            );


        document.querySelectorAll(
            `
                .profile-avatar,
                .top-avatar,
                .composer-avatar
            `
        ).forEach(
            (avatar) => {

                avatar.textContent =
                    initial;

            }
        );

    }


    /*
        Dipakai juga oleh renderer post dan reply.
    */
    window.getProfileInitial =
        getProfileInitial;

    window.getTeacherInitial =
    getTeacherInitial;

    window.updateCurrentStudentInitials =
        updateCurrentStudentInitials;


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            updateCurrentStudentInitials
        );

    } else {

        updateCurrentStudentInitials();

    }

})();