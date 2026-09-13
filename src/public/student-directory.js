(() => {
    "use strict";

function directoryText(
    key,
    variables = {}
) {

    if (
        window.LMSLanguage &&
        typeof window.LMSLanguage.t ===
            "function"
    ) {

        return window.LMSLanguage.t(
            `studentDirectory.${key}`,
            variables
        );

    }

    return key;

}


function getDirectoryLanguage() {

    if (
        window.LMSLanguage &&
        typeof window.LMSLanguage
            .getLanguage === "function"
    ) {

        return window.LMSLanguage
            .getLanguage();

    }

    return "id";

}

function directoryStudentCount(
    count
) {

    return directoryText(
        count === 1
            ? "oneStudent"
            : "manyStudents",
        {
            count
        }
    );

}


function directoryTeacherCount(
    count
) {

    return directoryText(
        count === 1
            ? "oneTeacher"
            : "manyTeachers",
        {
            count
        }
    );

}


function directoryHomeroomCount(
    count
) {

    return directoryText(
        count === 1
            ? "oneHomeroomTeacher"
            : "manyHomeroomTeachers",
        {
            count
        }
    );

}


    function normalizeAccountType(value) {
        return value === "teacher"
            ? "teacher"
            : "student";
    }

    function normalizeBannerColor(value) {
    const color =
        String(value || "")
            .trim()
            .toLowerCase();

return [
    "blue",
    "purple",
    "green",
    "orange",
    "yellow",
    "red"
].includes(color)
    ? color
    : "blue";
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
    directoryText(
        "avatarAlt",
        {
            name:
                name ||
                directoryText(
                    accountType
                )
        }
    );

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


    const parts =
        String(value).split("-");


    if (parts.length !== 3) {
        return String(value);
    }


    const year =
        Number(parts[0]);

    const month =
        Number(parts[1]);

    const day =
        Number(parts[2]);


    if (
        !year ||
        !month ||
        !day
    ) {
        return String(value);
    }


    return new Intl.DateTimeFormat(
        getDirectoryLanguage(),
        {
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "UTC"
        }
    ).format(
        new Date(
            Date.UTC(
                year,
                month - 1,
                day
            )
        )
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

        let currentProfileData =
    null;

let currentProfileAccountType =
    null;


        function createResultCard(account) {
            const accountType =
    normalizeAccountType(
        account.accountType
    );

const bannerColor =
    normalizeBannerColor(
        account.bannerColor
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

button.directoryAccount =
    account;

button.dataset.bannerColor =
    bannerColor;


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
    directoryText(
        accountType
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
    directoryText(
        "noSubjects"
    );


if (subjects.length === 1) {
    subjectSummary =
        subjects[0];

} else if (subjects.length > 1) {
    const firstSubject =
        subjects[0];

    const remainingCount =
        subjects.length - 1;


subjectSummary =
    `${firstSubject} ${directoryText(
        "moreSubjects",
        {
            count:
                remainingCount
        }
    )}`;
}


meta.textContent =
    `${directoryText(
        "teacher"
    )} · ${subjectSummary}`;

} else {
                meta.textContent =
                    `${account.className || "-"
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
    directoryText(
        "minimumSearch"
    );

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
        directoryText(
            "loadingAll"
        );

} else if (
    normalizedQuery ===
    "!teacher"
) {

    status.textContent =
        directoryText(
            "loadingTeachers"
        );

} else if (
    normalizedQuery ===
    "!student"
) {

    status.textContent =
        directoryText(
            "loadingStudents"
        );

} else if (
    /^!class\s*=/i.test(query)
) {

    status.textContent =
        directoryText(
            "loadingClass"
        );

} else {

    status.textContent =
        directoryText(
            "searching"
        );

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
directoryText(
    "searchFailed"
)
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
        directoryText(
            "noMatches"
        );

    return;

}


 if (accounts.length === 0) {

    if (
        data.searchMode ===
        "class"
    ) {

        status.textContent =
            data.className
                ? directoryText(
                    "noDirectoryMembers",
                    {
                        className:
                            data.className
                    }
                )
                : directoryText(
                    "classNotFound"
                );

    } else if (
        data.searchMode ===
        "teacher"
    ) {

        status.textContent =
            directoryText(
                "noTeachers"
            );

    } else if (
        data.searchMode ===
        "student"
    ) {

        status.textContent =
            directoryText(
                "noStudents"
            );

    } else if (
        data.searchMode ===
        "all"
    ) {

        status.textContent =
            directoryText(
                "directoryEmpty"
            );

    } else {

        status.textContent =
            directoryText(
                "noAccountsMatch"
            );

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
        directoryText(
            "found",
            {
                summary:
                    directoryTeacherCount(
                        teacherCount
                    )
            }
        );

} else if (
    data.searchMode ===
    "student"
) {

    status.textContent =
        directoryText(
            "found",
            {
                summary:
                    directoryStudentCount(
                        studentCount
                    )
            }
        );

} else if (
    data.searchMode ===
    "class"
) {

    const statusParts = [];


    if (studentCount > 0) {

        statusParts.push(
            directoryStudentCount(
                studentCount
            )
        );

    }


    if (teacherCount > 0) {

        statusParts.push(
            directoryHomeroomCount(
                teacherCount
            )
        );

    }


    status.textContent =
        directoryText(
            "classFound",
            {
                summary:
                    statusParts.join(
                        getDirectoryLanguage() ===
                            "en-US"
                            ? " and "
                            : " dan "
                    ),

                className:
                    data.className ||
                    directoryText(
                        "class"
                    )
            }
        );

} else if (
    data.searchMode ===
    "all"
) {

    status.textContent =
        directoryText(
            "allFound",
            {
                students:
                    directoryStudentCount(
                        studentCount
                    ),

                teachers:
                    directoryTeacherCount(
                        teacherCount
                    )
            }
        );

} else {

    const statusParts = [];


    if (studentCount > 0) {

        statusParts.push(
            directoryStudentCount(
                studentCount
            )
        );

    }


    if (teacherCount > 0) {

        statusParts.push(
            directoryTeacherCount(
                teacherCount
            )
        );

    }


    status.textContent =
        directoryText(
            "found",
            {
                summary:
                    statusParts.join(
                        getDirectoryLanguage() ===
                            "en-US"
                            ? " and "
                            : " dan "
                    )
            }
        );

}

    } catch (error) {
        if (
            error.name ===
            "AbortError"
        ) {
            return;
        }


        console.error(
            "Directory search failed:",
            error
        );


status.textContent =
    error.message ||
    directoryText(
        "directoryLoadFailed"
    );

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
const bannerColor =
    normalizeBannerColor(
        profileData.bannerColor
    );


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
            : directoryText(
                "noSubjects"
            );


    let classRole =
        directoryText(
            "specialistTeacher"
        );


    if (teacher.isHomeroomTeacher) {

        classRole =
            teacher.homeroomClass?.name
                ? `${directoryText(
                    "homeroomTeacher"
                )} ${
                    teacher
                        .homeroomClass
                        .name
                }`
                : directoryText(
                    "homeroomTeacher"
                );

    }


    profileName.textContent =
        teacher.fullName ||
        teacher.name ||
        directoryText(
            "teacher"
        );


    profileMeta.textContent =
        `${directoryText(
            "teacher"
        )} · ${directoryText(
            "teacherAccount"
        )}`;


    profileBio.textContent =
        teacher.bio ||
        directoryText(
            "noBio"
        );


    profileGrid.replaceChildren(

        createDetailItem(
            directoryText(
                "subjects"
            ),
            subjectText
        ),

        createDetailItem(
            directoryText(
                "dateOfBirth"
            ),
            formatDate(
                teacher.dateOfBirth
            )
        ),

        createDetailItem(
            directoryText(
                "classRole"
            ),
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
        directoryText(
            "student"
        );


    profileMeta.textContent =
        `${student.className || "-"} · ${
            directoryText(
                "studentAccount"
            )
        }`;


    profileBio.textContent =
        student.bio ||
        directoryText(
            "noBio"
        );


    if (mode === "admin") {

        profileGrid.replaceChildren(

            createDetailItem(
                directoryText(
                    "shortName"
                ),
                student.name || "-"
            ),

            createDetailItem(
                directoryText(
                    "studentCode"
                ),
                student.loginCode || "-"
            ),

            createDetailItem(
                directoryText(
                    "dateOfBirth"
                ),
                formatDate(
                    student.dateOfBirth
                )
            ),

            createDetailItem(
                directoryText(
                    "class"
                ),
                student.className || "-"
            ),

            createDetailItem(
                directoryText(
                    "totalPoints"
                ),
                student.totalPoints ?? 0
            ),

            createDetailItem(
                directoryText(
                    "averageScore"
                ),
                student.averageScore ??
                    directoryText(
                        "noScore"
                    )
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
            directoryText(
                "shortName"
            ),
            student.name || "-"
        ),

        createDetailItem(
            directoryText(
                "class"
            ),
            student.className || "-"
        ),

        createDetailItem(
            directoryText(
                "studentCode"
            ),
            "******",
            true
        ),

        createDetailItem(
            directoryText(
                "dateOfBirth"
            ),
            formatDate(
                student.dateOfBirth
            )
        ),

        createDetailItem(
            directoryText(
                "totalPoints"
            ),
            showStats
                ? String(
                    student.totalPoints ??
                    0
                )
                : "**",
            !showStats
        ),

        createDetailItem(
            directoryText(
                "averageScore"
            ),
            showStats
                ? (
                    student.averageScore ??
                    directoryText(
                        "noScore"
                    )
                )
                : "**",
            !showStats
        )

    );


    privacyNote.textContent =
        directoryText(
            "hiddenAcademicStats"
        );


    privacyNote.classList.toggle(
        "is-visible",
        !showStats
    );

}


function renderProfile(
    profileData,
    accountType,
    shouldScroll = true
) {

    currentProfileData =
        profileData;

    currentProfileAccountType =
        accountType;
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


if (shouldScroll) {

    profile.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });

}
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

        window.addEventListener(
    "lmslanguagechange",
    () => {

        Array.from(
            results.children
        ).forEach(
            oldCard => {

                const account =
                    oldCard
                        .directoryAccount;


                if (!account) {
                    return;
                }


                oldCard.replaceWith(
                    createResultCard(
                        account
                    )
                );

            }
        );


        if (
            currentProfileData &&
            currentProfileAccountType
        ) {

            renderProfile(
                currentProfileData,
                currentProfileAccountType,
                false
            );

        }

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