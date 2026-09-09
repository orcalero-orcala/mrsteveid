(() => {
    "use strict";


    function normalizeAccountType(value) {
        return value === "teacher"
            ? "teacher"
            : "student";
    }


    function getInitial(
        name,
        accountType = "student"
    ) {
        let cleanName =
            String(name || "")
                .replace(/\s+/g, " ")
                .trim();


        if (
            accountType === "teacher" &&
            cleanName
        ) {
            const parts =
                cleanName.split(" ");

            if (
                parts.length > 1 &&
                /^(mr|ms|mrs)\.?$/i.test(
                    parts[0]
                )
            ) {
                parts.shift();

                cleanName =
                    parts.join(" ");
            }
        }


        return (
            Array.from(cleanName)[0] ||
            (
                accountType === "teacher"
                    ? "T"
                    : "S"
            )
        ).toLocaleUpperCase("id-ID");
    }


    function renderAvatar(
        element,
        pictureUrl,
        name,
        accountType
    ) {
        if (!element) {
            return;
        }


        const initial =
            getInitial(
                name,
                accountType
            );


        element.replaceChildren();
        element.textContent =
            initial;


        const cleanUrl =
            String(
                pictureUrl || ""
            ).trim();


        if (!cleanUrl) {
            return;
        }


        const image =
            document.createElement(
                "img"
            );


        image.alt =
            `Foto profil ${name || "akun"}`;

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
                    initial;
            },
            {
                once: true
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


    function getSubjectNames(subjects) {
        if (!Array.isArray(subjects)) {
            return [];
        }


        return subjects
            .map(subject => {
                if (
                    typeof subject ===
                    "string"
                ) {
                    return subject.trim();
                }


                return String(
                    subject?.name || ""
                ).trim();
            })
            .filter(Boolean);
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


        if (
            !form ||
            !input ||
            !submit ||
            !status ||
            !results ||
            !profile
        ) {
            console.error(
                "Struktur School Directory tidak lengkap."
            );

            return;
        }


        let searchTimer =
            null;

        let requestController =
            null;


        function createResultCard(account) {
            const accountType =
                normalizeAccountType(
                    account.accountType
                );


            const button =
                document.createElement(
                    "button"
                );

            button.type =
                "button";

            button.className =
                "student-directory-result";

            button.dataset.accountType =
                accountType;


            const avatar =
                document.createElement(
                    "div"
                );

            avatar.className =
                "student-directory-result-avatar";


            renderAvatar(
                avatar,
                account.profilePictureUrl,
                account.fullName ||
                    account.name,
                accountType
            );


            const copy =
                document.createElement(
                    "div"
                );

            copy.className =
                "student-directory-result-copy";


            const heading =
                document.createElement(
                    "div"
                );

            heading.className =
                "student-directory-result-heading";


            const name =
                document.createElement(
                    "strong"
                );

            name.textContent =
                account.fullName ||
                account.name ||
                (
                    accountType === "teacher"
                        ? "Guru"
                        : "Siswa"
                );


heading.appendChild(
    name
);


            const meta =
                document.createElement(
                    "span"
                );


if (accountType === "teacher") {
    const subjects =
        getSubjectNames(
            account.subjects
        );


    let subjectSummary =
        "Belum ada mapel";


if (subjects.length === 1) {
    subjectSummary =
        subjects[0];

} else if (subjects.length > 1) {
    const firstSubject =
        subjects[0];

    const remainingCount =
        subjects.length - 1;


    subjectSummary =
        `${firstSubject} +${remainingCount} lainnya`;
}


    meta.textContent =
        `Guru · ${subjectSummary}`;

} else {
                meta.textContent =
                    `${account.className || "-"} · ${
                        account.name || "-"
                    }`;
            }


            copy.append(
                heading,
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
                        account
                    );
                }
            );


            return button;
        }


async function searchDirectory() {
    const query =
        input.value.trim();


    /*
     * Hasil sebelumnya langsung dibersihkan.
     * Jadi command tidak valid tidak akan
     * meninggalkan card pencarian lama.
     */
    results.replaceChildren();

    profile.hidden =
        true;


    if (query.length < 2) {
        status.textContent =
            "Ketik minimal 2 karakter untuk mulai mencari.";

        return;
    }


    if (requestController) {
        requestController.abort();
    }


    const currentController =
        new AbortController();

    requestController =
        currentController;


    submit.disabled =
        true;


    const normalizedQuery =
        query.toLocaleLowerCase(
            "id-ID"
        );


    if (normalizedQuery === "!all") {
        status.textContent =
            "Memuat seluruh Directory...";

    } else if (
        normalizedQuery ===
        "!teacher"
    ) {
        status.textContent =
            "Memuat semua guru...";

    } else if (
        normalizedQuery ===
        "!student"
    ) {
        status.textContent =
            "Memuat semua siswa...";

    } else if (
        /^!class\s*=/i.test(query)
    ) {
        status.textContent =
            "Memuat anggota kelas...";

    } else {
        status.textContent =
            "Mencari siswa dan guru...";
    }


    try {
        const response =
            await fetch(
                `/api/directory/search?q=${
                    encodeURIComponent(
                        query
                    )
                }`,
                {
                    signal:
                        currentController
                            .signal,

                    credentials:
                        "same-origin"
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


        const accounts =
            Array.isArray(
                data.results
            )
                ? data.results
                : [];


        /*
         * Command campuran atau tidak valid
         * tidak menghasilkan card apa pun.
         */
        if (
            data.searchMode ===
            "invalid"
        ) {
            status.textContent =
                "Tidak ada hasil yang cocok.";

            return;
        }


        if (accounts.length === 0) {
            if (
                data.searchMode ===
                "class"
            ) {
                status.textContent =
                    data.className
                        ? `Tidak ada anggota Directory di ${data.className}.`
                        : "Kelas tersebut tidak ditemukan.";

            } else if (
                data.searchMode ===
                "teacher"
            ) {
                status.textContent =
                    "Belum ada guru di Directory.";

            } else if (
                data.searchMode ===
                "student"
            ) {
                status.textContent =
                    "Belum ada siswa di Directory.";

            } else if (
                data.searchMode ===
                "all"
            ) {
                status.textContent =
                    "Directory masih kosong.";

            } else {
                status.textContent =
                    "Tidak ada siswa atau guru yang cocok.";
            }


            return;
        }


        const fragment =
            document
                .createDocumentFragment();


        accounts.forEach(account => {
            fragment.appendChild(
                createResultCard(
                    account
                )
            );
        });


        results.appendChild(
            fragment
        );


        const studentCount =
            accounts.filter(
                account =>
                    account.accountType ===
                    "student"
            ).length;

        const teacherCount =
            accounts.filter(
                account =>
                    account.accountType ===
                    "teacher"
            ).length;


        if (
            data.searchMode ===
            "teacher"
        ) {
            status.textContent =
                `${teacherCount} guru ditemukan.`;

        } else if (
            data.searchMode ===
            "student"
        ) {
            status.textContent =
                `${studentCount} siswa ditemukan.`;

        } else if (
            data.searchMode ===
            "class"
        ) {
            const statusParts = [];


            if (studentCount > 0) {
                statusParts.push(
                    `${studentCount} siswa`
                );
            }


            if (teacherCount > 0) {
                statusParts.push(
                    `${teacherCount} wali kelas`
                );
            }


            status.textContent =
                `${statusParts.join(" dan ")} di ${
                    data.className ||
                    "kelas tersebut"
                }.`;

        } else if (
            data.searchMode ===
            "all"
        ) {
            status.textContent =
                `${studentCount} siswa dan ${teacherCount} guru di Directory.`;

        } else {
            const statusParts = [];


            if (studentCount > 0) {
                statusParts.push(
                    `${studentCount} siswa`
                );
            }


            if (teacherCount > 0) {
                statusParts.push(
                    `${teacherCount} guru`
                );
            }


            status.textContent =
                `${statusParts.join(" dan ")} ditemukan.`;
        }

    } catch (error) {
        if (
            error.name ===
            "AbortError"
        ) {
            return;
        }


        console.error(
            "Directory search gagal:",
            error
        );


        status.textContent =
            error.message ||
            "Directory tidak dapat dimuat.";

    } finally {
        if (
            requestController ===
            currentController
        ) {
            submit.disabled =
                false;
        }
    }
}


        async function loadProfile(account) {
            const accountType =
                normalizeAccountType(
                    account.accountType
                );

            const accountId =
                Number(account.id);


            status.textContent =
                accountType === "teacher"
                    ? "Memuat profil guru..."
                    : "Memuat profil siswa...";


            let endpoint;


            if (accountType === "teacher") {
                endpoint =
                    `/api/directory/teachers/${
                        encodeURIComponent(
                            accountId
                        )
                    }`;
            } else {
                endpoint =
                    mode === "admin"
                        ? `/api/admin/students/${
                            encodeURIComponent(
                                accountId
                            )
                        }/profile`

                        : `/api/student/profiles/${
                            encodeURIComponent(
                                accountId
                            )
                        }`;
            }


            try {
                const response =
                    await fetch(
                        endpoint,
                        {
                            credentials:
                                "same-origin"
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


                const profileData =
                    accountType === "teacher"
                        ? data.teacher
                        : data.student;


                if (
                    !response.ok ||
                    !data.success ||
                    !profileData
                ) {
                    throw new Error(
                        data.message ||
                        "Profil tidak dapat dimuat."
                    );
                }


                renderProfile(
                    profileData,
                    accountType
                );


                status.textContent =
                    `Profil ${
                        profileData.name ||
                        (
                            accountType === "teacher"
                                ? "guru"
                                : "siswa"
                        )
                    } berhasil dimuat.`;

            } catch (error) {
                console.error(
                    "Gagal membuka profil Directory:",
                    error
                );


                status.textContent =
                    error.message ||
                    "Profil tidak dapat dimuat.";
            }
        }


        function applyProfileTheme(
            profileData,
            accountType
        ) {
            const allowedColors =
                new Set([
                    "blue",
                    "purple",
                    "green",
                    "orange",
                    "red"
                ]);


            const bannerColor =
                allowedColors.has(
                    profileData.bannerColor
                )
                    ? profileData.bannerColor
                    : "blue";


            profileCover.dataset.bannerColor =
                bannerColor;

            profile.dataset.bannerColor =
                bannerColor;

            profile.dataset.accountType =
                accountType;
        }


        function renderTeacherProfile(
            teacher
        ) {
            const subjects =
                getSubjectNames(
                    teacher.subjects
                );


            const subjectText =
                subjects.length > 0
                    ? subjects.join(", ")
                    : "Belum diatur";


            const classRole =
                teacher.isHomeroomTeacher
                    ? teacher.homeroomClass?.name
                        ? `Wali Kelas ${
                            teacher.homeroomClass.name
                        }`
                        : "Wali Kelas"
                    : "Guru Spesialis";


            profileName.textContent =
                teacher.fullName ||
                teacher.name ||
                "Guru";


            profileMeta.textContent =
                "Teacher · Akun guru";


            profileBio.textContent =
                teacher.bio ||
                "Belum ada bio.";


            profileGrid.replaceChildren(

                createDetailItem(
                    "Mata Pelajaran",
                    subjectText
                ),

                createDetailItem(
                    "Tanggal Lahir",
                    formatDate(
                        teacher.dateOfBirth
                    )
                ),

                createDetailItem(
                    "Peran Kelas",
                    classRole
                )

            );


            privacyNote.textContent =
                "";

            privacyNote.classList.remove(
                "is-visible"
            );
        }


        function renderStudentProfile(
            student
        ) {
            profileName.textContent =
                student.fullName ||
                student.name ||
                "Siswa";


            profileMeta.textContent =
                `${student.className || "-"} · Akun siswa`;


            profileBio.textContent =
                student.bio ||
                "Belum ada bio.";


            if (mode === "admin") {
                profileGrid.replaceChildren(

                    createDetailItem(
                        "Nama Pendek",
                        student.name ||
                        "-"
                    ),

                    createDetailItem(
                        "Kode Siswa",
                        student.loginCode ||
                        "-"
                    ),

                    createDetailItem(
                        "Tanggal Lahir",
                        formatDate(
                            student.dateOfBirth
                        )
                    ),

                    createDetailItem(
                        "Kelas",
                        student.className ||
                        "-"
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


                privacyNote.textContent =
                    "";

                privacyNote.classList.remove(
                    "is-visible"
                );

                return;
            }


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


            privacyNote.textContent =
                "Pemilik profil menyembunyikan statistik akademiknya.";

            privacyNote.classList.toggle(
                "is-visible",
                !showStats
            );
        }


        function renderProfile(
            profileData,
            accountType
        ) {
            applyProfileTheme(
                profileData,
                accountType
            );


            renderAvatar(
                profileAvatar,
                profileData.profilePictureUrl,
                profileData.fullName ||
                    profileData.name,
                accountType
            );


            if (accountType === "teacher") {
                renderTeacherProfile(
                    profileData
                );
            } else {
                renderStudentProfile(
                    profileData
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

                searchDirectory();
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
                        searchDirectory,
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