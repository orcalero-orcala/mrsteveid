(() => {

    function getInitial(name) {

        return (
            String(name || "S")
                .trim()
                .charAt(0) ||
            "S"
        ).toUpperCase();

    }


    function renderAvatar(
        element,
        pictureUrl,
        name
    ) {

        if (!element) {
            return;
        }


        element.replaceChildren();

        element.textContent =
            getInitial(name);


        const cleanUrl =
            String(
                pictureUrl ||
                ""
            ).trim();


        if (!cleanUrl) {
            return;
        }


        const image =
            document.createElement(
                "img"
            );


        image.alt =
            `Foto profil ${name || "siswa"}`;

        image.loading =
            "lazy";

        image.decoding =
            "async";

        image.src =
            cleanUrl;


        image.addEventListener(
            "error",
            () => {

                image.remove();

                element.textContent =
                    getInitial(name);

            }
        );


        element.replaceChildren(
            image
        );

    }


    function createDetailItem(
        label,
        value,
        isPrivate = false
    ) {

        const item =
            document.createElement(
                "div"
            );

        item.className =
            "student-directory-profile-item";


        if (isPrivate) {

            item.classList.add(
                "is-private"
            );

        }


        const labelElement =
            document.createElement(
                "small"
            );

        labelElement.textContent =
            label;


        const valueElement =
            document.createElement(
                "strong"
            );

        valueElement.textContent =
            value ?? "-";


        item.append(
            labelElement,
            valueElement
        );


        return item;

    }


    function formatDate(value) {

        if (!value) {
            return "-";
        }


        const date =
            new Date(
                `${value}T00:00:00`
            );


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return String(value);

        }


        return date.toLocaleDateString(
            "id-ID",
            {
                day: "numeric",
                month: "long",
                year: "numeric"
            }
        );

    }


    function initializeDirectory(root) {

        const mode =
            root.dataset.directoryMode ===
            "admin"
                ? "admin"
                : "student";


        const form =
            root.querySelector(
                "[data-directory-form]"
            );

        const input =
            root.querySelector(
                "[data-directory-input]"
            );

        const submit =
            root.querySelector(
                "[data-directory-submit]"
            );

        const status =
            root.querySelector(
                "[data-directory-status]"
            );

        const results =
            root.querySelector(
                "[data-directory-results]"
            );

        const profile =
            root.querySelector(
                "[data-directory-profile]"
            );

        const profileCover =
            root.querySelector(
                "[data-directory-profile-cover]"
            );

        const profileAvatar =
            root.querySelector(
                "[data-directory-profile-avatar]"
            );

        const profileName =
            root.querySelector(
                "[data-directory-profile-name]"
            );

        const profileMeta =
            root.querySelector(
                "[data-directory-profile-meta]"
            );

        const profileBio =
            root.querySelector(
                "[data-directory-profile-bio]"
            );

        const profileGrid =
            root.querySelector(
                "[data-directory-profile-grid]"
            );

        const privacyNote =
            root.querySelector(
                "[data-directory-privacy-note]"
            );


        let searchTimer =
            null;

        let requestController =
            null;


        function createResultCard(student) {

            const button =
                document.createElement(
                    "button"
                );

            button.type =
                "button";

            button.className =
                "student-directory-result";


            const avatar =
                document.createElement(
                    "div"
                );

            avatar.className =
                "student-directory-result-avatar";


            renderAvatar(
                avatar,
                student.profilePictureUrl,
                student.name
            );


            const copy =
                document.createElement(
                    "div"
                );

            copy.className =
                "student-directory-result-copy";


            const name =
                document.createElement(
                    "strong"
                );

            name.textContent =
                student.fullName ||
                student.name ||
                "Student";


            const meta =
                document.createElement(
                    "span"
                );

            meta.textContent =
                `${student.className || "-"} · ${
                    student.name || "-"
                }`;


            copy.append(
                name,
                meta
            );


            button.append(
                avatar,
                copy
            );


            button.addEventListener(
                "click",
                () => {

                    loadProfile(
                        student.id
                    );

                }
            );


            return button;

        }


        async function searchStudents() {

            const query =
                input.value.trim();


            profile.hidden =
                true;


            if (query.length < 2) {

                results.replaceChildren();

                status.textContent =
                    "Ketik minimal 2 karakter untuk mulai mencari.";

                return;

            }


            if (requestController) {

                requestController.abort();

            }


            requestController =
                new AbortController();


            submit.disabled =
                true;

            status.textContent =
                "Mencari siswa...";


            const endpoint =
                mode === "admin"
                    ? "/api/admin/student-search"
                    : "/api/student/search";


            try {

                const response =
                    await fetch(
                        `${endpoint}?q=${
                            encodeURIComponent(
                                query
                            )
                        }`,
                        {
                            signal:
                                requestController
                                    .signal
                        }
                    );


                const data =
                    await response
                        .json()
                        .catch(() => ({}));


                if (response.status === 401) {

                    window.location.href =
                        mode === "admin"
                            ? "/admin-login.html"
                            : "/student-login.html";

                    return;

                }


                if (
                    !response.ok ||
                    !data.success
                ) {

                    throw new Error(
                        data.message ||
                        "Pencarian gagal."
                    );

                }


                results.replaceChildren();


                const students =
                    Array.isArray(
                        data.students
                    )
                        ? data.students
                        : [];


                if (!students.length) {

                    status.textContent =
                        "Tidak ada siswa yang cocok.";

                    return;

                }


                const fragment =
                    document
                        .createDocumentFragment();


                students.forEach(
                    student => {

                        fragment.appendChild(
                            createResultCard(
                                student
                            )
                        );

                    }
                );


                results.appendChild(
                    fragment
                );


                status.textContent =
                    `${students.length} siswa ditemukan.`;

            } catch (error) {

                if (
                    error.name ===
                    "AbortError"
                ) {
                    return;
                }


                console.error(error);


                status.textContent =
                    error.message ||
                    "Pencarian tidak dapat dimuat.";

            } finally {

                submit.disabled =
                    false;

            }

        }


        async function loadProfile(
            studentId
        ) {

            status.textContent =
                "Memuat profil siswa...";


            const endpoint =
                mode === "admin"
                    ? `/api/admin/students/${
                        encodeURIComponent(
                            studentId
                        )
                    }/profile`

                    : `/api/student/profiles/${
                        encodeURIComponent(
                            studentId
                        )
                    }`;


            try {

                const response =
                    await fetch(
                        endpoint
                    );


                const data =
                    await response
                        .json()
                        .catch(() => ({}));


                if (response.status === 401) {

                    window.location.href =
                        mode === "admin"
                            ? "/admin-login.html"
                            : "/student-login.html";

                    return;

                }


                if (
                    !response.ok ||
                    !data.success ||
                    !data.student
                ) {

                    throw new Error(
                        data.message ||
                        "Profil tidak dapat dimuat."
                    );

                }


                renderProfile(
                    data.student
                );


                status.textContent =
                    `Profil ${
                        data.student.name ||
                        "siswa"
                    } berhasil dimuat.`;

            } catch (error) {

                console.error(error);


                status.textContent =
                    error.message ||
                    "Profil tidak dapat dimuat.";

            }

        }


        function renderProfile(student) {

            const bannerColor =
                [
                    "blue",
                    "purple",
                    "green",
                    "orange",
                    "red"
                ].includes(
                    student.bannerColor
                )
                    ? student.bannerColor
                    : "blue";


            profileCover.dataset
                .bannerColor =
                    bannerColor;

                profile.dataset
    .bannerColor =
        bannerColor;


            renderAvatar(
                profileAvatar,
                student.profilePictureUrl,
                student.name
            );


            profileName.textContent =
                student.fullName ||
                student.name ||
                "Student";


            profileMeta.textContent =
                `${student.className || "-"} · Akun siswa`;


            profileBio.textContent =
                student.bio ||
                "Belum ada bio.";


            if (mode === "admin") {

                profileGrid.replaceChildren(

                    createDetailItem(
                        "Nama Pendek",
                        student.name
                    ),

                    createDetailItem(
                        "Kode Siswa",
                        student.loginCode
                    ),

                    createDetailItem(
                        "Tanggal Lahir",
                        formatDate(
                            student.dateOfBirth
                        )
                    ),

                    createDetailItem(
                        "Kelas",
                        student.className
                    ),

                    createDetailItem(
                        "Total Poin",
                        student.totalPoints ?? 0
                    ),

                    createDetailItem(
                        "Nilai Rata-rata",
                        student.averageScore ??
                        "Belum ada nilai"
                    )

                );


                privacyNote.classList.remove(
                    "is-visible"
                );

            } else {

                const showStats =
                    Boolean(
                        student.showAcademicStats
                    );


                profileGrid.replaceChildren(

                    createDetailItem(
                        "Nama Pendek",
                        student.name ||
                        "-"
                    ),

                    createDetailItem(
                        "Kelas",
                        student.className ||
                        "-"
                    ),

                    createDetailItem(
                        "Kode Siswa",
                        "******",
                        true
                    ),

createDetailItem(
    "Tanggal Lahir",
    formatDate(
        student.dateOfBirth
    )
),

                    createDetailItem(
                        "Total Poin",
                        showStats
                            ? String(
                                student.totalPoints ??
                                0
                            )
                            : "**",
                        !showStats
                    ),

                    createDetailItem(
                        "Nilai Rata-rata",
                        showStats
                            ? (
                                student.averageScore ??
                                "Belum ada nilai"
                            )
                            : "**",
                        !showStats
                    )

                );


                privacyNote.classList.toggle(
                    "is-visible",
                    !showStats
                );

            }


            profile.hidden =
                false;


            profile.scrollIntoView({
                behavior: "smooth",
                block: "nearest"
            });

        }


        form.addEventListener(
            "submit",
            event => {

                event.preventDefault();

                clearTimeout(
                    searchTimer
                );

                searchStudents();

            }
        );


        input.addEventListener(
            "input",
            () => {

                clearTimeout(
                    searchTimer
                );


                searchTimer =
                    setTimeout(
                        searchStudents,
                        300
                    );

            }
        );


        root.studentDirectoryFocus =
            () => {

                requestAnimationFrame(
                    () => input.focus()
                );

            };

    }


    function initializeAllDirectories() {

        document
            .querySelectorAll(
                "[data-student-directory]"
            )
            .forEach(
                initializeDirectory
            );

    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initializeAllDirectories
        );

    } else {

        initializeAllDirectories();

    }

})();