const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");

const tursoDb =
    require("./database-turso");

const TursoSessionStore =
    require("./turso-session-store");

const isProduction =
    process.env.VERCEL === "1" ||
    process.env.NODE_ENV ===
        "production";


if (
    isProduction &&
    !process.env.SESSION_SECRET
) {

    throw new Error(
        "SESSION_SECRET wajib diatur di production."
    );

}

const app = express();
const PORT = 3000;


// ========================================
// MIDDLEWARE
// ========================================

// Membaca JSON dari request
app.use(express.json());

app.set(
    "trust proxy",
    1
);


app.use(
    session({

        store:
            new TursoSessionStore({
                defaultMaxAge:
                    1000 *
                    60 *
                    60 *
                    8
            }),

        secret:
            process.env.SESSION_SECRET ||
            "lms-sekolah-local-secret-change-me",

        resave: false,

        saveUninitialized: false,

        cookie: {

            httpOnly: true,

            sameSite:
                "strict",

            secure:
                isProduction,

            maxAge:
                1000 *
                60 *
                60 *
                8
        }

    })
);

function requireAdminPage(
    req,
    res,
    next
) {

    if (!req.session.adminId) {

        return res.redirect(
            "/admin-login.html"
        );

    }

    next();
}


function requireStudentPage(
    req,
    res,
    next
) {

    if (!req.session.studentId) {

        return res.redirect(
            "/student-login.html"
        );

    }

    next();
}

app.use(
    [
        "/admin-dashboard.html",
        "/admin-students.html",
        "/admin-points.html",
        "/admin-exam-scores.html",
        "/admin-announcements.html",
        "/admin-announcement.html",
        "/admin-notifications.html",
        "/admin-users.html"
    ],
    requireAdminPage
);


app.use(
    [
        "/student-dashboard.html",
        "/student-points.html",
        "/student-exam-scores.html",
        "/student-announcements.html",
        "/student-notifications.html",
        "/student-profile.html"
    ],
    requireStudentPage
);

// Menyediakan file HTML/CSS/JS dari folder public
app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// ========================================
// ADMIN LOGIN
// ========================================

app.post(
    "/api/admin/login",
    async (req, res) => {

        try {

            const {
                username,
                password
            } = req.body;


const admin =
    await tursoDb.get(
        `
            SELECT *
            FROM admins
            WHERE username = ?
        `,
        [
            username
        ]
    );


            if (!admin) {

                return res
                    .status(401)
                    .json({
                        message:
                            "Username atau password salah"
                    });

            }


            const passwordValid =
                await bcrypt.compare(
                    password,
                    admin.password
                );


            if (!passwordValid) {

                return res
                    .status(401)
                    .json({
                        message:
                            "Username atau password salah"
                    });

            }


            req.session.adminId =
                admin.id;

            req.session.adminUsername =
                admin.username;

            req.session.adminRole =
                admin.role;


            res.json({
                success: true,

                admin: {
                    id: admin.id,
                    username: admin.username,
                    name: admin.name,
                    role: admin.role
                }
            });


        } catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    "Terjadi kesalahan server"
            });

        }

    }
);

// ========================================
// PROTEKSI SEMUA API ADMIN
// ========================================

app.use(
    "/api/admin",
    (req, res, next) => {

        /*
            Mention list dipakai oleh guru
            DAN siswa untuk autocomplete.
        */
        if (
            req.path ===
            "/users/mention-list"
        ) {

            if (
                !req.session.adminId &&
                !req.session.studentId
            ) {

                return res.status(401).json({
                    success: false,
                    message:
                        "Harus login terlebih dahulu."
                });

            }


            return next();

        }


        /*
            Semua /api/admin lainnya
            wajib session guru.
        */
        if (!req.session.adminId) {

            return res.status(401).json({
                success: false,
                message:
                    "Harus login sebagai guru."
            });

        }


        next();

    }
);


// ========================================
// GENERATE KODE SISWA
// ========================================

async function generateStudentCode() {

    const letters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    const numbers =
        "0123456789";

    let code;
    let existingStudent;


    do {

        let randomLetters = "";

        for (let i = 0; i < 3; i++) {

            const randomIndex =
                Math.floor(
                    Math.random() *
                    letters.length
                );

            randomLetters +=
                letters[randomIndex];

        }


        let randomNumbers = "";

        for (let i = 0; i < 2; i++) {

            const randomIndex =
                Math.floor(
                    Math.random() *
                    numbers.length
                );

            randomNumbers +=
                numbers[randomIndex];

        }


        code =
            randomLetters +
            randomNumbers;


        existingStudent =
            await tursoDb.get(
                `
                    SELECT id
                    FROM students
                    WHERE login_code = ?
                `,
                [
                    code
                ]
            );


    } while (existingStudent);


    return code;
}

function generateTeacherCode() {

    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let result =
        "TCH-";


    for (
        let i = 0;
        i < 8;
        i++
    ) {

        const randomIndex =
            Math.floor(
                Math.random() *
                chars.length
            );

        result +=
            chars[randomIndex];

    }


    return result;
}

// ========================================
// MASTER KELAS
// ========================================

async function ensureClassesTable() {

    await tursoDb.run(`
        CREATE TABLE IF NOT EXISTS classes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL COLLATE NOCASE UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    /*
        Ambil kelas lama dari data siswa
        supaya data yang sudah ada tidak hilang.
    */
    await tursoDb.run(`
        INSERT OR IGNORE INTO classes (
            name
        )
        SELECT DISTINCT
            TRIM(class_name)
        FROM students
        WHERE
            class_name IS NOT NULL
            AND TRIM(class_name) <> ''
    `);
}


// ========================================
// AMBIL SEMUA KELAS
// ========================================

app.get(
    "/api/admin/classes",
    async (req, res) => {

        try {

            await ensureClassesTable();

            const classes =
                await tursoDb.all(`
                    SELECT
                        id,
                        name,
                        created_at
                    FROM classes
                    ORDER BY name COLLATE NOCASE ASC
                `);

            return res.json({
                success: true,
                classes
            });

        } catch (error) {

            console.error(
                "Error mengambil kelas:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil daftar kelas."
            });
        }
    }
);


// ========================================
// TAMBAH KELAS
// ========================================

app.post(
    "/api/admin/classes",
    async (req, res) => {

        const {
            name
        } = req.body;

        if (
            !name ||
            name.trim().length === 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Nama kelas wajib diisi."
            });
        }

        const cleanName =
            name.trim();

        try {

            await ensureClassesTable();

            const existingClass =
                await tursoDb.get(
                    `
                        SELECT id
                        FROM classes
                        WHERE name = ?
                        COLLATE NOCASE
                    `,
                    [
                        cleanName
                    ]
                );

            if (existingClass) {

                return res.status(409).json({
                    success: false,
                    message:
                        "Kelas tersebut sudah terdaftar."
                });
            }

            const result =
                await tursoDb.run(
                    `
                        INSERT INTO classes (
                            name
                        )
                        VALUES (?)
                    `,
                    [
                        cleanName
                    ]
                );

            return res.json({
                success: true,
                message:
                    "Kelas berhasil ditambahkan.",
                classData: {
                    id:
                        Number(
                            result.lastInsertRowid
                        ),
                    name:
                        cleanName
                }
            });

        } catch (error) {

            console.error(
                "Error tambah kelas:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Gagal menambahkan kelas."
            });
        }
    }
);

// ========================================
// TAMBAH SISWA
// ========================================

app.post(
    "/api/admin/students",
    async (req, res) => {

const {
    name,
    fullName,
    dateOfBirth,
    className
} = req.body;


if (
    !name ||
    !fullName ||
    !dateOfBirth ||
    !className
) {

            return res.status(400).json({
                success: false,
                message:
                    "Nama pendek, lengkap, DOB, dan kelas wajib diisi."
            });

        }


        const cleanName =
            name.trim();

            const cleanFullName =
    fullName.trim();

const cleanDateOfBirth =
    dateOfBirth.trim();

        const cleanClass =
            className.trim();


if (
    cleanName.length === 0 ||
    cleanFullName.length === 0 ||
    cleanDateOfBirth.length === 0 ||
    cleanClass.length === 0
) {

    return res.status(400).json({
        success: false,
        message:
            "Data siswa tidak boleh kosong."
    });

}


try {

    await ensureClassesTable();

    const selectedClass =
        await tursoDb.get(
            `
                SELECT
                    id,
                    name
                FROM classes
                WHERE name = ?
                COLLATE NOCASE
            `,
            [
                cleanClass
            ]
        );

    if (!selectedClass) {

        return res.status(400).json({
            success: false,
            message:
                "Kelas yang dipilih tidak terdaftar."
        });
    }

    const loginCode =
        await generateStudentCode();


            const result =
                await tursoDb.run(
                    `
                        INSERT INTO students (
                            login_code,
                            name,
                            full_name,
                            date_of_birth,
                            class_name
                        )
                        VALUES (?, ?, ?, ?, ?)
                    `,
                        [
                            loginCode,
                            cleanName,
                            cleanFullName,
                            cleanDateOfBirth,
                            selectedClass.name
                        ]
                );


            return res.json({

                success: true,

                message:
                    "Siswa berhasil ditambahkan.",

                student: {

                    id:
                        Number(
                            result.lastInsertRowid
                        ),

                    loginCode,

                    name:
                        cleanName,

                        fullName:
                        cleanFullName,

                    dateOfBirth:
                        cleanDateOfBirth,

                    className:
                        selectedClass.name

                }

            });


        } catch (error) {

            console.error(
                "Error tambah siswa:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Gagal menyimpan siswa."
                });

        }

    }
);

// ========================================
// AMBIL SEMUA SISWA
// ========================================

app.get(
    "/api/admin/students",
    async (req, res) => {

        try {

            const students =
                await tursoDb.all(`
                    SELECT
                        id,
                        login_code,
                        name,
                        class_name,
                        created_at
                    FROM students
                    ORDER BY id DESC
                `);


            return res.json({

                success: true,

                students

            });


        } catch (error) {

            console.error(
                "Error mengambil siswa:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Gagal mengambil data siswa."
                });

        }

    }
);

// ========================================
// LOGIN SISWA
// ========================================

app.post(
    "/api/student/login",
    async (req, res) => {

        const {
            loginCode
        } = req.body;


        // Validasi input
        if (!loginCode) {

            return res.status(400).json({

                success: false,

                message:
                    "Kode siswa wajib diisi."

            });

        }


        // Bersihkan dan ubah menjadi huruf besar
        const cleanCode =
            loginCode
                .trim()
                .toUpperCase();


        // Cari siswa
const student =
    await tursoDb.get(
        `
            SELECT *
            FROM students
            WHERE login_code = ?
        `,
        [
            cleanCode
        ]
    );


        // Kalau kode tidak ditemukan
        if (!student) {

            return res.status(401).json({

                success: false,

                message:
                    "Kode siswa tidak ditemukan."

            });

        }

        req.session.studentId =
    student.id;

req.session.studentLoginCode =
    student.login_code;


        // Login berhasil
        res.json({

            success: true,

            message:
                "Login berhasil.",

            student: {

                id:
                    student.id,

                loginCode:
                    student.login_code,

                name:
                    student.name,

                className:
                    student.class_name

            }

        });

    }
);

// ========================================
// CEK SESSION SISWA MASIH VALID
// ========================================

app.get(
    "/api/student/session-status",
    async (req, res) => {

        if (!req.session.studentId) {

            return res
                .status(401)
                .json({
                    success: false,
                    loggedOut: true,
                    message:
                        "Kamu telah dilogout."
                });

        }


        const studentId =
            Number(
                req.session.studentId
            );


        const sessionLoginCode =
            String(
                req.session.studentLoginCode || ""
            );


        try {

            const student =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            login_code

                        FROM students

                        WHERE id = ?
                    `,
                    [
                        studentId
                    ]
                );


            /*
                Akun sudah dihapus,
                misalnya karena Reset Data Siswa
                atau Factory Reset.
            */
            if (
                !student ||
                String(
                    student.login_code || ""
                ) !== sessionLoginCode
            ) {

                delete req.session.studentId;
                delete req.session.studentLoginCode;


                return req.session.save(
                    (error) => {

                        if (error) {

                            console.error(
                                "Gagal menyimpan session logout siswa:",
                                error
                            );

                        }


                        return res
                            .status(401)
                            .json({
                                success: false,
                                loggedOut: true,
                                message:
                                    "Kamu telah dilogout."
                            });

                    }
                );

            }


            return res.json({
                success: true,
                loggedOut: false
            });


        } catch (error) {

            console.error(
                "Gagal mengecek session siswa:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    loggedOut: false,
                    message:
                        "Gagal mengecek session siswa."
                });

        }

    }
);

// ========================================
// PROFILE SISWA
// ========================================

app.get(
    "/api/student/profile",
    async (req, res) => {

        if (!req.session.studentId) {

            return res.status(401).json({
                success: false,
                message:
                    "Harus login sebagai siswa."
            });

        }


        const studentId =
            Number(req.session.studentId);


        try {

            const student =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            login_code,
                            name,
                            full_name,
                            date_of_birth,
                            class_name
                        FROM students
                        WHERE id = ?
                    `,
                    [
                        studentId
                    ]
                );


            if (!student) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Siswa tidak ditemukan."
                });

            }


            const pointResult =
                await tursoDb.get(
                    `
                        SELECT
                            COALESCE(
                                SUM(points),
                                0
                            ) AS total_points
                        FROM point_transactions
                        WHERE student_id = ?
                    `,
                    [
                        studentId
                    ]
                );


            const scoreResult =
                await tursoDb.get(
                    `
                        SELECT
                            AVG(score) AS average_score
                        FROM exam_scores
                        WHERE student_id = ?
                    `,
                    [
                        studentId
                    ]
                );


            const averageScore =
                scoreResult?.average_score === null ||
                scoreResult?.average_score === undefined
                    ? null
                    : Number(
                        Number(
                            scoreResult.average_score
                        ).toFixed(2)
                    );


            return res.json({

                success: true,

                student: {
                    id:
                        student.id,

                    loginCode:
                        student.login_code,

                    name:
                        student.name,

                    fullName:
                        student.full_name ||
                        student.name,

                    dateOfBirth:
                        student.date_of_birth,

                    className:
                        student.class_name,

                    totalPoints:
                        Number(
                            pointResult?.total_points || 0
                        ),

                    averageScore
                }

            });


        } catch (error) {

            console.error(
                "Error mengambil profile siswa:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil profile siswa."
            });

        }

    }
);

// ========================================
// MENJALANKAN SERVER
// ========================================

// ========================================
// POIN SISWA
// ========================================

app.get(
    "/api/student/:studentId/points",
    async (req, res) => {

        const studentId =
            Number(req.params.studentId);

            const sessionStudentId =
    Number(req.session.studentId);


if (!req.session.studentId) {

    return res.status(401).json({
        success: false,
        message:
            "Harus login sebagai siswa."
    });

}


if (
    !Number.isInteger(studentId) ||
    studentId !== sessionStudentId
) {

    return res.status(403).json({
        success: false,
        message:
            "Akses siswa tidak valid."
    });

}

        try {

            const student =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            name,
                            class_name
                        FROM students
                        WHERE id = ?
                    `,
                    [
                        studentId
                    ]
                );


            if (!student) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Siswa tidak ditemukan."
                });

            }


            const transactions =
                await tursoDb.all(
                    `
                        SELECT
                            id,
                            points,
                            reason,
                            created_at
                        FROM point_transactions
                        WHERE student_id = ?
                        ORDER BY id DESC
                    `,
                    [
                        studentId
                    ]
                );


            const result =
                await tursoDb.get(
                    `
                        SELECT
                            COALESCE(
                                SUM(points),
                                0
                            ) AS total_points
                        FROM point_transactions
                        WHERE student_id = ?
                    `,
                    [
                        studentId
                    ]
                );


            return res.json({

                success: true,

                student: {
                    id:
                        student.id,

                    name:
                        student.name,

                    className:
                        student.class_name
                },

                totalPoints:
                    result.total_points,

                transactions

            });


        } catch (error) {

            console.error(
                "Error mengambil poin:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Gagal mengambil data poin."
                });

        }

    }
);

// ========================================
// ADMIN TAMBAH NILAI UJIAN
// ========================================

app.post(
    "/api/admin/exam-scores",
    async (req, res) => {

        const {
            studentId,
            subject,
            material,
            score
        } = req.body;


        const numericStudentId =
            Number(studentId);

        const numericScore =
            Number(score);


        if (!Number.isInteger(numericStudentId)) {

            return res.status(400).json({
                success: false,
                message:
                    "ID siswa tidak valid."
            });

        }


        if (
            !subject ||
            subject.trim().length === 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Mapel wajib diisi."
            });

        }


        if (
            !material ||
            material.trim().length === 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Materi wajib diisi."
            });

        }


        if (
            !Number.isFinite(numericScore) ||
            numericScore < 0 ||
            numericScore > 100
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Nilai harus antara 0 sampai 100."
            });

        }


        try {

            const student =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            name,
                            class_name
                        FROM students
                        WHERE id = ?
                    `,
                    [
                        numericStudentId
                    ]
                );


            if (!student) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Siswa tidak ditemukan."
                });

            }


            const result =
                await tursoDb.run(
                    `
                        INSERT INTO exam_scores (
                            student_id,
                            subject,
                            material,
                            score
                        )
                        VALUES (?, ?, ?, ?)
                    `,
                    [
                        numericStudentId,
                        subject.trim(),
                        material.trim(),
                        numericScore
                    ]
                );


            return res.json({

                success: true,

                message:
                    "Nilai ujian berhasil ditambahkan.",

                examScore: {

                    id:
                        Number(
                            result.lastInsertRowid
                        ),

                    studentId:
                        numericStudentId,

                    studentName:
                        student.name,

                    className:
                        student.class_name,

                    subject:
                        subject.trim(),

                    material:
                        material.trim(),

                    score:
                        numericScore

                }

            });


        } catch (error) {

            console.error(
                "Error tambah nilai ujian:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Gagal menyimpan nilai ujian."
                });

        }

    }
);

// ========================================
// ADMIN TAMBAH / KURANGI POIN
// ========================================

app.get(
    "/api/admin/students/:studentId/points",
    async (req, res) => {

        const studentId =
            Number(req.params.studentId);


        if (!Number.isInteger(studentId)) {

            return res.status(400).json({
                success: false,
                message:
                    "ID siswa tidak valid."
            });

        }


        try {

            const student =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            name,
                            class_name
                        FROM students
                        WHERE id = ?
                    `,
                    [
                        studentId
                    ]
                );


            if (!student) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Siswa tidak ditemukan."
                });

            }


            const transactions =
                await tursoDb.all(
                    `
                        SELECT
                            id,
                            points,
                            reason,
                            created_at
                        FROM point_transactions
                        WHERE student_id = ?
                        ORDER BY id DESC
                    `,
                    [
                        studentId
                    ]
                );


            const result =
                await tursoDb.get(
                    `
                        SELECT
                            COALESCE(
                                SUM(points),
                                0
                            ) AS total_points
                        FROM point_transactions
                        WHERE student_id = ?
                    `,
                    [
                        studentId
                    ]
                );


            return res.json({
                success: true,

                student: {
                    id:
                        student.id,

                    name:
                        student.name,

                    className:
                        student.class_name
                },

                totalPoints:
                    Number(
                        result?.total_points || 0
                    ),

                transactions
            });


        } catch (error) {

            console.error(
                "Error admin mengambil poin:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil data poin."
            });

        }

    }
);

app.post(
    "/api/admin/students/:studentId/points",
    async (req, res) => {

        const studentId =
            Number(req.params.studentId);


        const {
            points,
            reason
        } = req.body;


        if (!Number.isInteger(studentId)) {

            return res.status(400).json({
                success: false,
                message:
                    "ID siswa tidak valid."
            });

        }


        if (
            typeof points !== "number" ||
            !Number.isInteger(points) ||
            points === 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Poin harus berupa angka bulat dan tidak boleh 0."
            });

        }


        if (
            !reason ||
            reason.trim().length === 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Alasan wajib diisi."
            });

        }


        try {

            const student =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            name
                        FROM students
                        WHERE id = ?
                    `,
                    [
                        studentId
                    ]
                );


            if (!student) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Siswa tidak ditemukan."
                });

            }


            const result =
                await tursoDb.run(
                    `
                        INSERT INTO point_transactions (
                            student_id,
                            points,
                            reason
                        )
                        VALUES (?, ?, ?)
                    `,
                    [
                        studentId,
                        points,
                        reason.trim()
                    ]
                );


            return res.json({

                success: true,

                message:
                    "Poin berhasil diperbarui.",

                transaction: {

                    id:
                        Number(
                            result.lastInsertRowid
                        ),

                    studentId,

                    points,

                    reason:
                        reason.trim()

                }

            });


        } catch (error) {

            console.error(
                "Error update poin:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Gagal memperbarui poin."
                });

        }

    }
);

// ========================================
// BUAT ANNOUNCEMENT
// ========================================

app.post(
    "/api/admin/announcements",
    async (req, res) => {

        if (!req.session.adminId) {

            return res.status(401).json({
                success: false,
                message:
                    "Harus login sebagai guru."
            });

        }


        const numericAdminId =
            Number(req.session.adminId);


        const {
            message,
            className,
            mentions = []
        } = req.body;


        if (
            !message ||
            message.trim().length === 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Isi announcement wajib diisi."
            });

        }


        if (!Array.isArray(mentions)) {

            return res.status(400).json({
                success: false,
                message:
                    "Data mention tidak valid."
            });

        }


        const cleanMessage =
            message.trim();


        const cleanClass =
            className &&
            className.trim().length > 0
                ? className.trim()
                : null;


        try {

            // =====================================
            // CEK GURU
            // =====================================

            const admin =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            name,
                            role
                        FROM admins
                        WHERE id = ?
                    `,
                    [
                        numericAdminId
                    ]
                );


            if (!admin) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Admin / Guru tidak ditemukan."
                });

            }


            // =====================================
            // SIMPAN POST
            // =====================================

            const result =
                await tursoDb.run(
                    `
                        INSERT INTO announcements (
                            admin_id,
                            class_name,
                            message
                        )
                        VALUES (?, ?, ?)
                    `,
                    [
                        numericAdminId,
                        cleanClass,
                        cleanMessage
                    ]
                );


            const announcementId =
                Number(
                    result.lastInsertRowid
                );


            // =====================================
            // PROSES MENTION
            // =====================================

            for (const mention of mentions) {

                const mentionId =
                    Number(mention.id);


                if (
                    !Number.isInteger(
                        mentionId
                    )
                ) {

                    continue;

                }


                // =================================
                // MENTION SISWA
                // =================================

                if (
                    mention.type ===
                    "student"
                ) {

                    const mentionedStudent =
                        await tursoDb.get(
                            `
                                SELECT
                                    id,
                                    class_name
                                FROM students
                                WHERE id = ?
                            `,
                            [
                                mentionId
                            ]
                        );


                    if (!mentionedStudent) {

                        continue;

                    }


                    // Kalau post khusus kelas,
                    // mention hanya siswa kelas sama.
                    if (
                        cleanClass !== null &&
                        mentionedStudent.class_name !==
                            cleanClass
                    ) {

                        continue;

                    }


                    await tursoDb.run(
                        `
                            INSERT INTO announcement_mentions (
                                announcement_id,
                                reply_id,
                                mentioned_student_id,
                                mentioned_admin_id
                            )
                            VALUES (?, NULL, ?, NULL)
                        `,
                        [
                            announcementId,
                            mentionId
                        ]
                    );


                    await tursoDb.run(
                        `
                            INSERT INTO notifications (
                                recipient_student_id,
                                sender_admin_id,
                                type,
                                announcement_id,
                                reply_id,
                                message
                            )
                            VALUES (
                                ?,
                                ?,
                                'mention',
                                ?,
                                NULL,
                                ?
                            )
                        `,
                        [
                            mentionId,
                            numericAdminId,
                            announcementId,
                            `${admin.name} mention kamu dalam announcement.`
                        ]
                    );


                    continue;

                }


                // =================================
                // MENTION GURU
                // =================================

                if (
                    mention.type ===
                    "admin"
                ) {

                    const mentionedAdmin =
                        await tursoDb.get(
                            `
                                SELECT id
                                FROM admins
                                WHERE id = ?
                            `,
                            [
                                mentionId
                            ]
                        );


                    if (!mentionedAdmin) {

                        continue;

                    }


                    await tursoDb.run(
                        `
                            INSERT INTO announcement_mentions (
                                announcement_id,
                                reply_id,
                                mentioned_student_id,
                                mentioned_admin_id
                            )
                            VALUES (?, NULL, NULL, ?)
                        `,
                        [
                            announcementId,
                            mentionId
                        ]
                    );


                    // Jangan notif diri sendiri
                    if (
                        mentionId !==
                        numericAdminId
                    ) {

                        await tursoDb.run(
                            `
                                INSERT INTO notifications (
                                    recipient_admin_id,
                                    sender_admin_id,
                                    type,
                                    announcement_id,
                                    reply_id,
                                    message
                                )
                                VALUES (
                                    ?,
                                    ?,
                                    'mention',
                                    ?,
                                    NULL,
                                    ?
                                )
                            `,
                            [
                                mentionId,
                                numericAdminId,
                                announcementId,
                                `${admin.name} mention kamu dalam announcement.`
                            ]
                        );

                    }

                }

            }


const createdAnnouncement =
    await tursoDb.get(
        `
            SELECT
                id,
                admin_id,
                class_name,
                message,
                created_at
            FROM announcements
            WHERE id = ?
        `,
        [
            announcementId
        ]
    );


return res.json({

    success: true,

    message:
        "Announcement berhasil dibuat.",

    announcement: {

        id:
            createdAnnouncement.id,

        student_id:
            null,

        admin_id:
            createdAnnouncement.admin_id,

        student_creator_name:
            null,

        student_creator_class:
            null,

        admin_creator_name:
            admin.name,

        admin_creator_role:
            admin.role,

        class_name:
            createdAnnouncement.class_name,

        message:
            createdAnnouncement.message,

        created_at:
            createdAnnouncement.created_at,

        mentions:
            mentions
    }

});


        } catch (error) {

            console.error(
                "Error membuat announcement:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal membuat announcement."
            });

        }

    }
);

app.post(
    "/api/student/:studentId/announcements",
    async (req, res) => {

        if (!req.session.studentId) {

            return res.status(401).json({
                success: false,
                message:
                    "Harus login sebagai siswa."
            });

        }


        const studentId =
            Number(req.params.studentId);

        const sessionStudentId =
            Number(req.session.studentId);


        if (
            !Number.isInteger(studentId) ||
            studentId !== sessionStudentId
        ) {

            return res.status(403).json({
                success: false,
                message:
                    "Akses siswa tidak valid."
            });

        }


        const {
            message,
            target = "class",
            mentions = []
        } = req.body;


        if (!Array.isArray(mentions)) {

            return res.status(400).json({
                success: false,
                message:
                    "Data mention tidak valid."
            });

        }


        if (
            !message ||
            message.trim().length === 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Isi announcement wajib diisi."
            });

        }


        if (
            target !== "class" &&
            target !== "global"
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Target announcement tidak valid."
            });

        }


        try {

            // =====================================
            // CEK SISWA
            // =====================================

            const student =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            name,
                            class_name
                        FROM students
                        WHERE id = ?
                    `,
                    [
                        studentId
                    ]
                );


            if (!student) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Siswa tidak ditemukan."
                });

            }


            const className =
                target === "class"
                    ? student.class_name
                    : null;


            // =====================================
            // SIMPAN POST
            // =====================================

            const result =
                await tursoDb.run(
                    `
                        INSERT INTO announcements (
                            student_id,
                            class_name,
                            message
                        )
                        VALUES (?, ?, ?)
                    `,
                    [
                        studentId,
                        className,
                        message.trim()
                    ]
                );


            const announcementId =
                Number(
                    result.lastInsertRowid
                );


            // =====================================
            // PROSES MENTION
            // =====================================

            for (const mention of mentions) {

                const mentionId =
                    Number(mention.id);


                if (
                    !Number.isInteger(
                        mentionId
                    )
                ) {

                    continue;

                }


                // =================================
                // MENTION SISWA
                // =================================

                if (
                    mention.type ===
                    "student"
                ) {

                    const mentionedStudent =
                        await tursoDb.get(
                            `
                                SELECT
                                    id,
                                    class_name
                                FROM students
                                WHERE id = ?
                            `,
                            [
                                mentionId
                            ]
                        );


                    if (!mentionedStudent) {

                        continue;

                    }


                    // Kalau post khusus kelas,
                    // siswa mention harus kelas sama.
                    if (
                        className !== null &&
                        mentionedStudent.class_name !==
                            className
                    ) {

                        continue;

                    }


                    await tursoDb.run(
                        `
                            INSERT INTO announcement_mentions (
                                announcement_id,
                                reply_id,
                                mentioned_student_id,
                                mentioned_admin_id
                            )
                            VALUES (?, NULL, ?, NULL)
                        `,
                        [
                            announcementId,
                            mentionId
                        ]
                    );


                    // Jangan notif diri sendiri
                    if (
                        mentionId !==
                        studentId
                    ) {

                        await tursoDb.run(
                            `
                                INSERT INTO notifications (
                                    recipient_student_id,
                                    sender_student_id,
                                    type,
                                    announcement_id,
                                    reply_id,
                                    message
                                )
                                VALUES (
                                    ?,
                                    ?,
                                    'mention',
                                    ?,
                                    NULL,
                                    ?
                                )
                            `,
                            [
                                mentionId,
                                studentId,
                                announcementId,
                                `${student.name} mention kamu dalam announcement.`
                            ]
                        );

                    }


                    continue;

                }


                // =================================
                // MENTION GURU
                // =================================

                if (
                    mention.type ===
                    "admin"
                ) {

                    const mentionedAdmin =
                        await tursoDb.get(
                            `
                                SELECT id
                                FROM admins
                                WHERE id = ?
                            `,
                            [
                                mentionId
                            ]
                        );


                    if (!mentionedAdmin) {

                        continue;

                    }


                    await tursoDb.run(
                        `
                            INSERT INTO announcement_mentions (
                                announcement_id,
                                reply_id,
                                mentioned_student_id,
                                mentioned_admin_id
                            )
                            VALUES (?, NULL, NULL, ?)
                        `,
                        [
                            announcementId,
                            mentionId
                        ]
                    );


                    await tursoDb.run(
                        `
                            INSERT INTO notifications (
                                recipient_admin_id,
                                sender_student_id,
                                type,
                                announcement_id,
                                reply_id,
                                message
                            )
                            VALUES (
                                ?,
                                ?,
                                'mention',
                                ?,
                                NULL,
                                ?
                            )
                        `,
                        [
                            mentionId,
                            studentId,
                            announcementId,
                            `${student.name} mention kamu dalam announcement.`
                        ]
                    );

                }

            }


            return res.json({

                success: true,

                message:
                    "Announcement berhasil dibuat.",

                announcement: {

                    id:
                        announcementId,

                    studentId:
                        studentId,

                    studentName:
                        student.name,

                    className:
                        className,

                    message:
                        message.trim()

                }

            });


        } catch (error) {

            console.error(
                "Error membuat announcement siswa:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal membuat announcement."
            });

        }

    }
);

app.delete(
    "/api/student/:studentId/announcements/:announcementId",
    async (req, res) => {

        if (!req.session.studentId) {

            return res.status(401).json({
                success: false,
                message:
                    "Harus login sebagai siswa."
            });

        }


        const studentId =
            Number(req.params.studentId);

        const announcementId =
            Number(req.params.announcementId);

        const sessionStudentId =
            Number(req.session.studentId);


        if (
            !Number.isInteger(studentId) ||
            !Number.isInteger(announcementId) ||
            studentId !== sessionStudentId
        ) {

            return res.status(403).json({
                success: false,
                message:
                    "Akses siswa tidak valid."
            });

        }


        try {

            const announcement =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            student_id
                        FROM announcements
                        WHERE id = ?
                    `,
                    [
                        announcementId
                    ]
                );


            if (!announcement) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Announcement tidak ditemukan."
                });

            }


            if (
                announcement.student_id !==
                studentId
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Kamu tidak boleh menghapus announcement ini."
                });

            }


            await tursoDb.run(
                `
                    DELETE FROM notifications
                    WHERE announcement_id = ?
                `,
                [
                    announcementId
                ]
            );


            await tursoDb.run(
                `
                    DELETE FROM announcement_mentions
                    WHERE announcement_id = ?
                `,
                [
                    announcementId
                ]
            );


            await tursoDb.run(
                `
                    DELETE FROM announcement_replies
                    WHERE announcement_id = ?
                `,
                [
                    announcementId
                ]
            );


            await tursoDb.run(
                `
                    DELETE FROM announcements
                    WHERE id = ?
                `,
                [
                    announcementId
                ]
            );


            return res.json({
                success: true,
                message:
                    "Announcement berhasil dihapus."
            });


        } catch (error) {

            console.error(
                "Error hapus announcement siswa:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal menghapus announcement."
            });

        }

    }
);

// ========================================
// AMBIL ANNOUNCEMENT SISWA
// ========================================

app.get(
    "/api/student/:studentId/announcements",
    async (req, res) => {

        const studentId =
            Number(req.params.studentId);

            const sessionStudentId =
    Number(req.session.studentId);


if (!req.session.studentId) {

    return res.status(401).json({
        success: false,
        message:
            "Harus login sebagai siswa."
    });

}


        if (!Number.isInteger(studentId)) {

            return res.status(400).json({
                success: false,
                message:
                    "ID siswa tidak valid."
            });

        }


        try {

            const student =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            name,
                            class_name
                        FROM students
                        WHERE id = ?
                    `,
                    [
                        studentId
                    ]
                );


            if (!student) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Siswa tidak ditemukan."
                });

            }


            const announcements =
                await tursoDb.all(
                    `
                        SELECT
                            announcements.id,
                            announcements.student_id,
                            announcements.admin_id,
                            announcements.class_name,
                            announcements.message,
                            announcements.created_at,

                            students.name AS student_creator_name,
                            students.class_name AS student_creator_class,

                            admins.name AS admin_creator_name,
                            admins.role AS admin_creator_role

                        FROM announcements

                        LEFT JOIN students
                        ON students.id =
                            announcements.student_id

                        LEFT JOIN admins
                        ON admins.id =
                            announcements.admin_id

                        WHERE
                            announcements.class_name IS NULL

                            OR

                            announcements.class_name = ?

                        ORDER BY announcements.id DESC
                    `,
                    [
                        student.class_name
                    ]
                );


            const formattedAnnouncements =
                await Promise.all(
                    announcements.map(
                        async (announcement) => {

                            return {
                                ...announcement,

                                mentions:
                                    await getAnnouncementMentions(
                                        announcement.id
                                    )
                            };

                        }
                    )
                );


            return res.json({
                success: true,

                announcements:
                    formattedAnnouncements
            });


        } catch (error) {

            console.error(
                "Error mengambil announcement:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil announcement."
            });

        }

    }
);

app.delete(
    "/api/announcements/:announcementId/replies/:replyId",
    async (req, res) => {

        if (!req.session.studentId) {

            return res.status(401).json({
                success: false,
                message:
                    "Harus login sebagai siswa."
            });

        }


        const announcementId =
            Number(req.params.announcementId);

        const replyId =
            Number(req.params.replyId);

        const studentId =
            Number(req.session.studentId);


        if (
            !Number.isInteger(announcementId) ||
            !Number.isInteger(replyId) ||
            !Number.isInteger(studentId)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Data tidak valid."
            });

        }


        try {

            const reply =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            student_id,
                            announcement_id
                        FROM announcement_replies
                        WHERE id = ?
                        AND announcement_id = ?
                    `,
                    [
                        replyId,
                        announcementId
                    ]
                );


            if (!reply) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Reply tidak ditemukan."
                });

            }


            if (
                reply.student_id !==
                studentId
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Kamu tidak boleh menghapus reply ini."
                });

            }


            await tursoDb.run(
                `
                    DELETE FROM notifications
                    WHERE reply_id = ?
                `,
                [
                    replyId
                ]
            );


            await tursoDb.run(
                `
                    DELETE FROM announcement_mentions
                    WHERE reply_id = ?
                `,
                [
                    replyId
                ]
            );


            await tursoDb.run(
                `
                    DELETE FROM announcement_replies
                    WHERE id = ?
                `,
                [
                    replyId
                ]
            );


            return res.json({
                success: true,
                message:
                    "Reply berhasil dihapus."
            });


        } catch (error) {

            console.error(
                "Error hapus reply siswa:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal menghapus reply."
            });

        }

    }
);

app.delete(
    "/api/admin/announcements/:announcementId/replies/:replyId",
    async (req, res) => {

        if (!req.session.adminId) {

            return res.status(401).json({
                success: false,
                message:
                    "Harus login sebagai guru."
            });

        }


        const announcementId =
            Number(req.params.announcementId);

        const replyId =
            Number(req.params.replyId);

        const adminId =
            Number(req.session.adminId);


        if (
            !Number.isInteger(announcementId) ||
            !Number.isInteger(replyId) ||
            !Number.isInteger(adminId)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Data tidak valid."
            });

        }


        try {

            const admin =
                await tursoDb.get(
                    `
                        SELECT id
                        FROM admins
                        WHERE id = ?
                    `,
                    [
                        adminId
                    ]
                );


            if (!admin) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Admin/Guru tidak valid."
                });

            }


            const reply =
                await tursoDb.get(
                    `
                        SELECT id
                        FROM announcement_replies
                        WHERE id = ?
                        AND announcement_id = ?
                    `,
                    [
                        replyId,
                        announcementId
                    ]
                );


            if (!reply) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Reply tidak ditemukan."
                });

            }


            await tursoDb.run(
                `
                    DELETE FROM notifications
                    WHERE reply_id = ?
                `,
                [
                    replyId
                ]
            );


            await tursoDb.run(
                `
                    DELETE FROM announcement_mentions
                    WHERE reply_id = ?
                `,
                [
                    replyId
                ]
            );


            await tursoDb.run(
                `
                    DELETE FROM announcement_replies
                    WHERE id = ?
                `,
                [
                    replyId
                ]
            );


            return res.json({
                success: true,
                message:
                    "Reply berhasil dihapus."
            });


        } catch (error) {

            console.error(
                "Error hapus reply admin:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal menghapus reply."
            });

        }

    }
);

// ========================================
// LIVE FEED ADMIN - POST BARU
// ========================================

app.get(
    "/api/admin/announcements/live",
    async (req, res) => {

        const afterId =
            Number(req.query.afterId || 0);


        if (
            !Number.isInteger(afterId) ||
            afterId < 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "ID live feed tidak valid."
            });

        }


        try {

            const announcements =
                await tursoDb.all(
                    `
                        SELECT
                            announcements.id,
                            announcements.student_id,
                            announcements.admin_id,
                            announcements.class_name,
                            announcements.message,
                            announcements.created_at,

                            students.name
                                AS student_creator_name,

                            students.class_name
                                AS student_creator_class,

                            admins.name
                                AS admin_creator_name,

                            admins.role
                                AS admin_creator_role

                        FROM announcements

                        LEFT JOIN students
                        ON students.id =
                            announcements.student_id

                        LEFT JOIN admins
                        ON admins.id =
                            announcements.admin_id

                        WHERE announcements.id > ?

                        ORDER BY
                            announcements.id ASC
                    `,
                    [
                        afterId
                    ]
                );


            const formattedAnnouncements =
                await Promise.all(
                    announcements.map(
                        async (announcement) => {

                            return {
                                ...announcement,

                                mentions:
                                    await getAnnouncementMentions(
                                        announcement.id
                                    )
                            };

                        }
                    )
                );


            return res.json({
                success: true,
                announcements:
                    formattedAnnouncements
            });


        } catch (error) {

            console.error(
                "Error live feed admin:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil live feed."
            });

        }

    }
);

// ========================================
// AMBIL SEMUA ANNOUNCEMENT ADMIN
// ========================================

app.get(
    "/api/admin/announcements",
    async (req, res) => {

        try {

            const announcements =
                await tursoDb.all(`
                    SELECT
                        announcements.id,
                        announcements.student_id,
                        announcements.admin_id,
                        announcements.class_name,
                        announcements.message,
                        announcements.created_at,

                        students.name AS student_creator_name,
                        students.class_name AS student_creator_class,

                        admins.name AS admin_creator_name,
                        admins.role AS admin_creator_role

                    FROM announcements

                    LEFT JOIN students
                    ON students.id =
                        announcements.student_id

                    LEFT JOIN admins
                    ON admins.id =
                        announcements.admin_id

                    ORDER BY announcements.id DESC
                `);


            const formattedAnnouncements =
                await Promise.all(
                    announcements.map(
                        async (announcement) => {

                            return {
                                ...announcement,

                                mentions:
                                    await getAnnouncementMentions(
                                        announcement.id
                                    )
                            };

                        }
                    )
                );


            return res.json({
                success: true,

                announcements:
                    formattedAnnouncements
            });


        } catch (error) {

            console.error(
                "Error mengambil announcement admin:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil announcement."
            });

        }

    }
);

// ========================================
// HAPUS ANNOUNCEMENT
// ========================================

app.delete(
    "/api/admin/announcements/:id",
    async (req, res) => {

        if (!req.session.adminId) {

            return res.status(401).json({
                success: false,
                message:
                    "Harus login sebagai guru."
            });

        }


        const announcementId =
            Number(req.params.id);


        if (!Number.isInteger(announcementId)) {

            return res.status(400).json({
                success: false,
                message:
                    "ID announcement tidak valid."
            });

        }


        try {

            const announcement =
                await tursoDb.get(
                    `
                        SELECT id
                        FROM announcements
                        WHERE id = ?
                    `,
                    [
                        announcementId
                    ]
                );


            if (!announcement) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Announcement tidak ditemukan."
                });

            }


            await tursoDb.run(
                `
                    DELETE FROM notifications
                    WHERE announcement_id = ?
                `,
                [
                    announcementId
                ]
            );


            await tursoDb.run(
                `
                    DELETE FROM announcement_mentions
                    WHERE announcement_id = ?
                `,
                [
                    announcementId
                ]
            );


            await tursoDb.run(
                `
                    DELETE FROM announcement_replies
                    WHERE announcement_id = ?
                `,
                [
                    announcementId
                ]
            );


            await tursoDb.run(
                `
                    DELETE FROM announcements
                    WHERE id = ?
                `,
                [
                    announcementId
                ]
            );


            return res.json({
                success: true,
                message:
                    "Announcement berhasil dihapus."
            });


        } catch (error) {

            console.error(
                "Error menghapus announcement:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal menghapus announcement."
            });

        }

    }
);

async function getAnnouncementMentions(
    announcementId
) {

    const mentions =
        await tursoDb.all(
            `
                SELECT
                    announcement_mentions.mentioned_student_id,
                    announcement_mentions.mentioned_admin_id,

                    students.name AS student_name,
                    admins.name AS admin_name

                FROM announcement_mentions

                LEFT JOIN students
                ON students.id =
                    announcement_mentions.mentioned_student_id

                LEFT JOIN admins
                ON admins.id =
                    announcement_mentions.mentioned_admin_id

                WHERE
                    announcement_mentions.announcement_id = ?

                    AND

                    announcement_mentions.reply_id IS NULL
            `,
            [
                announcementId
            ]
        );


    return mentions.map(
        (mention) => {

            if (
                mention.mentioned_student_id
            ) {

                return {
                    id:
                        mention.mentioned_student_id,

                    type:
                        "student",

                    name:
                        mention.student_name
                };

            }


            return {
                id:
                    mention.mentioned_admin_id,

                type:
                    "admin",

                name:
                    mention.admin_name
            };

        }
    );

}

async function getReplyMentions(
    replyId
) {

    const mentions =
        await tursoDb.all(
            `
                SELECT
                    announcement_mentions.mentioned_student_id,
                    announcement_mentions.mentioned_admin_id,

                    students.name AS student_name,
                    admins.name AS admin_name

                FROM announcement_mentions

                LEFT JOIN students
                ON students.id =
                    announcement_mentions.mentioned_student_id

                LEFT JOIN admins
                ON admins.id =
                    announcement_mentions.mentioned_admin_id

                WHERE
                    announcement_mentions.reply_id = ?
            `,
            [
                replyId
            ]
        );


    return mentions.map(
        (mention) => {

            if (
                mention.mentioned_student_id
            ) {

                return {
                    id:
                        mention.mentioned_student_id,

                    type:
                        "student",

                    name:
                        mention.student_name
                };

            }


            return {
                id:
                    mention.mentioned_admin_id,

                type:
                    "admin",

                name:
                    mention.admin_name
            };

        }
    );

}

// ========================================
// AMBIL REPLY ANNOUNCEMENT
// ========================================

app.get(
    "/api/announcements/:announcementId/replies",
    async (req, res) => {

        const announcementId =
            Number(req.params.announcementId);


        if (!Number.isInteger(announcementId)) {

            return res.status(400).json({
                success: false,
                message:
                    "ID announcement tidak valid."
            });

        }


        try {

            const replies =
                await tursoDb.all(
                    `
                        SELECT
                            announcement_replies.id,
                            announcement_replies.message,
                            announcement_replies.created_at,
                            announcement_replies.student_id,
                            announcement_replies.admin_id,

                            students.name AS student_name,
                            students.class_name,

                            admins.name AS admin_name,
                            admins.role AS admin_role

                        FROM announcement_replies

                        LEFT JOIN students
                        ON students.id =
                            announcement_replies.student_id

                        LEFT JOIN admins
                        ON admins.id =
                            announcement_replies.admin_id

                        WHERE
                            announcement_replies.announcement_id = ?

                        ORDER BY
                            announcement_replies.id ASC
                    `,
                    [
                        announcementId
                    ]
                );


            const formattedReplies =
                await Promise.all(
                    replies.map(
                        async (reply) => {

                            const mentions =
                                await getReplyMentions(
                                    reply.id
                                );


                            if (reply.student_id) {

                                return {
                                    id:
                                        reply.id,

                                    message:
                                        reply.message,

                                    created_at:
                                        reply.created_at,

                                    mentions,

                                    sender_id:
                                        reply.student_id,

                                    sender_name:
                                        reply.student_name ||
                                        "Siswa",

                                    sender_type:
                                        "student",

                                    sender_role:
                                        "student"
                                };

                            }


                            return {
                                id:
                                    reply.id,

                                message:
                                    reply.message,

                                created_at:
                                    reply.created_at,

                                mentions,

                                sender_id:
                                    reply.admin_id,

                                sender_name:
                                    reply.admin_name ||
                                    "Admin / Guru",

                                sender_type:
                                    "admin",

                                sender_role:
                                    reply.admin_role ||
                                    "admin"
                            };

                        }
                    )
                );


            return res.json({
                success: true,
                replies:
                    formattedReplies
            });


        } catch (error) {

            console.error(
                "Error mengambil reply:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil reply."
            });

        }

    }
);

// ========================================
// SISWA REPLY ANNOUNCEMENT + MENTION
// ========================================

app.post(
    "/api/announcements/:announcementId/replies",
    async (req, res) => {

        if (!req.session.studentId) {

            return res.status(401).json({
                success: false,
                message:
                    "Harus login sebagai siswa."
            });

        }


        const announcementId =
            Number(req.params.announcementId);

        const numericStudentId =
            Number(req.session.studentId);


        const {
            message,
            mentions = []
        } = req.body;


        if (!Number.isInteger(announcementId)) {

            return res.status(400).json({
                success: false,
                message:
                    "ID announcement tidak valid."
            });

        }


        if (!Number.isInteger(numericStudentId)) {

            return res.status(400).json({
                success: false,
                message:
                    "ID siswa tidak valid."
            });

        }


        if (
            !message ||
            message.trim().length === 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Reply tidak boleh kosong."
            });

        }


        if (!Array.isArray(mentions)) {

            return res.status(400).json({
                success: false,
                message:
                    "Data mention tidak valid."
            });

        }


        try {

            // =====================================
            // CEK ANNOUNCEMENT
            // =====================================

            const announcement =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            class_name
                        FROM announcements
                        WHERE id = ?
                    `,
                    [
                        announcementId
                    ]
                );


            if (!announcement) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Announcement tidak ditemukan."
                });

            }


            // =====================================
            // CEK SISWA
            // =====================================

            const student =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            name,
                            class_name
                        FROM students
                        WHERE id = ?
                    `,
                    [
                        numericStudentId
                    ]
                );


            if (!student) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Siswa tidak ditemukan."
                });

            }


            // =====================================
            // CEK AKSES KELAS
            // =====================================

            if (
                announcement.class_name !== null &&
                announcement.class_name !==
                    student.class_name
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Kamu tidak memiliki akses ke announcement ini."
                });

            }


            // =====================================
            // SIMPAN REPLY
            // =====================================

            const result =
                await tursoDb.run(
                    `
                        INSERT INTO announcement_replies (
                            announcement_id,
                            student_id,
                            message
                        )
                        VALUES (?, ?, ?)
                    `,
                    [
                        announcementId,
                        numericStudentId,
                        message.trim()
                    ]
                );


            const replyId =
                Number(
                    result.lastInsertRowid
                );


            // =====================================
            // PROSES MENTION
            // =====================================

            for (const mention of mentions) {

                const mentionId =
                    Number(mention.id);


                if (
                    !Number.isInteger(
                        mentionId
                    )
                ) {

                    continue;

                }


                // =================================
                // MENTION SISWA
                // =================================

                if (
                    mention.type ===
                    "student"
                ) {

                    const mentionedStudent =
                        await tursoDb.get(
                            `
                                SELECT
                                    id,
                                    class_name
                                FROM students
                                WHERE id = ?
                            `,
                            [
                                mentionId
                            ]
                        );


                    if (!mentionedStudent) {

                        continue;

                    }


                    // Kalau post khusus kelas,
                    // mention siswa harus kelas sama.
                    if (
                        announcement.class_name !== null &&
                        mentionedStudent.class_name !==
                            announcement.class_name
                    ) {

                        continue;

                    }


                    await tursoDb.run(
                        `
                            INSERT INTO announcement_mentions (
                                announcement_id,
                                reply_id,
                                mentioned_student_id,
                                mentioned_admin_id
                            )
                            VALUES (?, ?, ?, NULL)
                        `,
                        [
                            announcementId,
                            replyId,
                            mentionId
                        ]
                    );


                    if (
                        mentionId !==
                        numericStudentId
                    ) {

                        await tursoDb.run(
                            `
                                INSERT INTO notifications (
                                    recipient_student_id,
                                    sender_student_id,
                                    type,
                                    announcement_id,
                                    reply_id,
                                    message
                                )
                                VALUES (
                                    ?,
                                    ?,
                                    'mention',
                                    ?,
                                    ?,
                                    ?
                                )
                            `,
                            [
                                mentionId,
                                numericStudentId,
                                announcementId,
                                replyId,
                                `${student.name} mention kamu dalam announcement.`
                            ]
                        );

                    }


                    continue;

                }


                // =================================
                // MENTION GURU
                // =================================

                if (
                    mention.type ===
                    "admin"
                ) {

                    const mentionedAdmin =
                        await tursoDb.get(
                            `
                                SELECT id
                                FROM admins
                                WHERE id = ?
                            `,
                            [
                                mentionId
                            ]
                        );


                    if (!mentionedAdmin) {

                        continue;

                    }


                    await tursoDb.run(
                        `
                            INSERT INTO announcement_mentions (
                                announcement_id,
                                reply_id,
                                mentioned_student_id,
                                mentioned_admin_id
                            )
                            VALUES (?, ?, NULL, ?)
                        `,
                        [
                            announcementId,
                            replyId,
                            mentionId
                        ]
                    );


                    await tursoDb.run(
                        `
                            INSERT INTO notifications (
                                recipient_admin_id,
                                sender_student_id,
                                type,
                                announcement_id,
                                reply_id,
                                message
                            )
                            VALUES (
                                ?,
                                ?,
                                'mention',
                                ?,
                                ?,
                                ?
                            )
                        `,
                        [
                            mentionId,
                            numericStudentId,
                            announcementId,
                            replyId,
                            `${student.name} mention kamu dalam announcement.`
                        ]
                    );

                }

            }


            return res.json({

                success: true,

                message:
                    "Reply berhasil dikirim.",

                reply: {

                    id:
                        replyId,

                    announcementId,

                    studentId:
                        numericStudentId,

                    message:
                        message.trim()

                }

            });


        } catch (error) {

            console.error(
                "Error membuat reply:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal mengirim reply."
            });

        }

    }
);

// ========================================
// LIVE FEED ADMIN - STATE ID
// UNTUK DETEKSI DELETE
// ========================================

app.get(
    "/api/admin/classroom-feed/state",
    async (req, res) => {

        if (!req.session.adminId) {

            return res.status(401).json({
                success: false,
                message:
                    "Harus login sebagai admin."
            });

        }


        try {

            const announcements =
                await tursoDb.all(
                    `
                        SELECT id
                        FROM announcements
                    `
                );


            const replies =
                await tursoDb.all(
                    `
                        SELECT
                            id,
                            announcement_id
                        FROM announcement_replies
                    `
                );


            return res.json({
                success: true,

                announcementIds:
                    announcements.map(
                        (announcement) =>
                            Number(
                                announcement.id
                            )
                    ),

                replies:
                    replies.map(
                        (reply) => ({
                            id:
                                Number(reply.id),

                            announcement_id:
                                Number(
                                    reply.announcement_id
                                )
                        })
                    )
            });


        } catch (error) {

            console.error(
                "Error classroom feed state:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil state Classroom Feed."
            });

        }

    }
);

// ========================================
// LIVE REPLY UNTUK ADMIN
// ========================================

app.get(
    "/api/admin/replies/live",
    async (req, res) => {

        const afterIdRaw =
            req.query.afterId;


        try {

            /*
                Kalau afterId belum dikirim,
                hanya ambil ID reply paling terakhir.

                Ini dipakai saat halaman pertama dibuka
                supaya reply lama tidak dianggap reply baru.
            */
            if (
                afterIdRaw === undefined
            ) {

                const latest =
                    await tursoDb.get(
                        `
                            SELECT
                                COALESCE(
                                    MAX(id),
                                    0
                                ) AS latest_reply_id
                            FROM announcement_replies
                        `
                    );


                return res.json({
                    success: true,

                    latestReplyId:
                        Number(
                            latest?.latest_reply_id ||
                            0
                        ),

                    replies: []
                });

            }


            const afterId =
                Number(afterIdRaw);


            if (
                !Number.isInteger(afterId) ||
                afterId < 0
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "ID live reply tidak valid."
                });

            }


            const replies =
                await tursoDb.all(
                    `
                        SELECT
                            announcement_replies.id,
                            announcement_replies.announcement_id,
                            announcement_replies.message,
                            announcement_replies.created_at,
                            announcement_replies.student_id,
                            announcement_replies.admin_id,

                            students.name
                                AS student_name,

                            students.class_name
                                AS class_name,

                            admins.name
                                AS admin_name,

                            admins.role
                                AS admin_role

                        FROM announcement_replies

                        LEFT JOIN students
                        ON students.id =
                            announcement_replies.student_id

                        LEFT JOIN admins
                        ON admins.id =
                            announcement_replies.admin_id

                        WHERE
                            announcement_replies.id > ?

                        ORDER BY
                            announcement_replies.id ASC
                    `,
                    [
                        afterId
                    ]
                );


            const formattedReplies =
                await Promise.all(
                    replies.map(
                        async (reply) => {

                            const mentions =
                                await getReplyMentions(
                                    reply.id
                                );


                            if (reply.student_id) {

                                return {

                                    id:
                                        reply.id,

                                    announcement_id:
                                        reply.announcement_id,

                                    message:
                                        reply.message,

                                    created_at:
                                        reply.created_at,

                                    mentions,

                                    sender_id:
                                        reply.student_id,

                                    sender_name:
                                        reply.student_name ||
                                        "Siswa",

                                    sender_type:
                                        "student",

                                    sender_role:
                                        "student",

                                    class_name:
                                        reply.class_name
                                };

                            }


                            return {

                                id:
                                    reply.id,

                                announcement_id:
                                    reply.announcement_id,

                                message:
                                    reply.message,

                                created_at:
                                    reply.created_at,

                                mentions,

                                sender_id:
                                    reply.admin_id,

                                sender_name:
                                    reply.admin_name ||
                                    "Admin / Guru",

                                sender_type:
                                    "admin",

                                sender_role:
                                    reply.admin_role ||
                                    "admin",

                                class_name:
                                    null
                            };

                        }
                    )
                );


            return res.json({

                success: true,

                replies:
                    formattedReplies

            });


        } catch (error) {

            console.error(
                "Error live reply admin:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil live reply."
            });

        }

    }
);

// ========================================
// ADMIN - AMBIL SEMUA REPLY ANNOUNCEMENT
// ========================================

app.get(
    "/api/admin/announcements/:announcementId/replies",
    async (req, res) => {

        const announcementId =
            Number(req.params.announcementId);


        if (!Number.isInteger(announcementId)) {

            return res.status(400).json({
                success: false,
                message:
                    "ID announcement tidak valid."
            });

        }


        try {

            const replies =
                await tursoDb.all(
                    `
                        SELECT
                            announcement_replies.id,
                            announcement_replies.message,
                            announcement_replies.created_at,
                            announcement_replies.student_id,
                            announcement_replies.admin_id,

                            students.name AS student_name,
                            students.class_name,

                            admins.name AS admin_name,
                            admins.role AS admin_role

                        FROM announcement_replies

                        LEFT JOIN students
                        ON students.id =
                            announcement_replies.student_id

                        LEFT JOIN admins
                        ON admins.id =
                            announcement_replies.admin_id

                        WHERE
                            announcement_replies.announcement_id = ?

                        ORDER BY
                            announcement_replies.id ASC
                    `,
                    [
                        announcementId
                    ]
                );


            const formattedReplies =
                await Promise.all(
                    replies.map(
                        async (reply) => {

                            const mentions =
                                await getReplyMentions(
                                    reply.id
                                );


                            if (reply.student_id) {

                                return {
                                    id:
                                        reply.id,

                                    message:
                                        reply.message,

                                    created_at:
                                        reply.created_at,

                                    mentions,

                                    sender_name:
                                        reply.student_name ||
                                        "Siswa",

                                    sender_type:
                                        "student",

                                    sender_role:
                                        "student",

                                    class_name:
                                        reply.class_name
                                };

                            }


                            return {
                                id:
                                    reply.id,

                                message:
                                    reply.message,

                                created_at:
                                    reply.created_at,

                                mentions,

                                sender_name:
                                    reply.admin_name ||
                                    "Admin / Guru",

                                sender_type:
                                    "admin",

                                sender_role:
                                    reply.admin_role ||
                                    "admin",

                                class_name:
                                    null
                            };

                        }
                    )
                );


            return res.json({
                success: true,
                replies:
                    formattedReplies
            });


        } catch (error) {

            console.error(
                "Error mengambil reply admin:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil reply."
            });

        }

    }
);

// ========================================
// ADMIN REPLY ANNOUNCEMENT
// ========================================

// ========================================
// ADMIN / GURU REPLY + MENTION + NOTIFIKASI
// ========================================

app.post(
    "/api/admin/announcements/:announcementId/replies",
    async (req, res) => {

        if (!req.session.adminId) {

            return res.status(401).json({
                success: false,
                message:
                    "Harus login sebagai guru."
            });

        }


        const announcementId =
            Number(req.params.announcementId);

        const numericAdminId =
            Number(req.session.adminId);


        const {
            message,
            mentions = []
        } = req.body;


        if (!Number.isInteger(announcementId)) {

            return res.status(400).json({
                success: false,
                message:
                    "ID announcement tidak valid."
            });

        }


        if (!Number.isInteger(numericAdminId)) {

            return res.status(400).json({
                success: false,
                message:
                    "ID admin tidak valid."
            });

        }


        if (
            !message ||
            message.trim().length === 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Reply tidak boleh kosong."
            });

        }


        if (!Array.isArray(mentions)) {

            return res.status(400).json({
                success: false,
                message:
                    "Data mention tidak valid."
            });

        }


        try {

            // =====================================
            // CEK ANNOUNCEMENT
            // =====================================

            const announcement =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            class_name
                        FROM announcements
                        WHERE id = ?
                    `,
                    [
                        announcementId
                    ]
                );


            if (!announcement) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Announcement tidak ditemukan."
                });

            }


            // =====================================
            // CEK GURU
            // =====================================

            const currentAdmin =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            name,
                            role
                        FROM admins
                        WHERE id = ?
                    `,
                    [
                        numericAdminId
                    ]
                );


            if (!currentAdmin) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Admin/Guru tidak ditemukan."
                });

            }


            // =====================================
            // SIMPAN REPLY
            // =====================================

            const result =
                await tursoDb.run(
                    `
                        INSERT INTO announcement_replies (
                            announcement_id,
                            student_id,
                            admin_id,
                            message
                        )
                        VALUES (?, NULL, ?, ?)
                    `,
                    [
                        announcementId,
                        numericAdminId,
                        message.trim()
                    ]
                );


            const replyId =
                Number(
                    result.lastInsertRowid
                );


            // =====================================
            // PROSES MENTION
            // =====================================

            for (const mention of mentions) {

                const mentionId =
                    Number(mention.id);


                if (
                    !Number.isInteger(
                        mentionId
                    )
                ) {

                    continue;

                }


                // =================================
                // MENTION SISWA
                // =================================

                if (
                    mention.type ===
                    "student"
                ) {

                    const mentionedStudent =
                        await tursoDb.get(
                            `
                                SELECT
                                    id,
                                    class_name
                                FROM students
                                WHERE id = ?
                            `,
                            [
                                mentionId
                            ]
                        );


                    if (!mentionedStudent) {

                        continue;

                    }


                    if (
                        announcement.class_name !== null &&
                        mentionedStudent.class_name !==
                            announcement.class_name
                    ) {

                        continue;

                    }


                    await tursoDb.run(
                        `
                            INSERT INTO announcement_mentions (
                                announcement_id,
                                reply_id,
                                mentioned_student_id,
                                mentioned_admin_id
                            )
                            VALUES (?, ?, ?, NULL)
                        `,
                        [
                            announcementId,
                            replyId,
                            mentionId
                        ]
                    );


                    await tursoDb.run(
                        `
                            INSERT INTO notifications (
                                recipient_student_id,
                                sender_admin_id,
                                type,
                                announcement_id,
                                reply_id,
                                message
                            )
                            VALUES (
                                ?,
                                ?,
                                'mention',
                                ?,
                                ?,
                                ?
                            )
                        `,
                        [
                            mentionId,
                            numericAdminId,
                            announcementId,
                            replyId,
                            `${currentAdmin.name} mention kamu dalam announcement.`
                        ]
                    );


                    continue;

                }


                // =================================
                // MENTION GURU
                // =================================

                if (
                    mention.type ===
                    "admin"
                ) {

                    const mentionedAdmin =
                        await tursoDb.get(
                            `
                                SELECT id
                                FROM admins
                                WHERE id = ?
                            `,
                            [
                                mentionId
                            ]
                        );


                    if (!mentionedAdmin) {

                        continue;

                    }


                    await tursoDb.run(
                        `
                            INSERT INTO announcement_mentions (
                                announcement_id,
                                reply_id,
                                mentioned_student_id,
                                mentioned_admin_id
                            )
                            VALUES (?, ?, NULL, ?)
                        `,
                        [
                            announcementId,
                            replyId,
                            mentionId
                        ]
                    );


                    if (
                        mentionId !==
                        numericAdminId
                    ) {

                        await tursoDb.run(
                            `
                                INSERT INTO notifications (
                                    recipient_admin_id,
                                    sender_admin_id,
                                    type,
                                    announcement_id,
                                    reply_id,
                                    message
                                )
                                VALUES (
                                    ?,
                                    ?,
                                    'mention',
                                    ?,
                                    ?,
                                    ?
                                )
                            `,
                            [
                                mentionId,
                                numericAdminId,
                                announcementId,
                                replyId,
                                `${currentAdmin.name} mention kamu dalam announcement.`
                            ]
                        );

                    }

                }

            }


const createdReply =
    await tursoDb.get(
        `
            SELECT
                id,
                announcement_id,
                message,
                created_at
            FROM announcement_replies
            WHERE id = ?
        `,
        [
            replyId
        ]
    );


return res.json({

    success: true,

    message:
        "Reply berhasil dikirim.",

    reply: {

        id:
            createdReply.id,

        announcement_id:
            createdReply.announcement_id,

        sender_type:
            "admin",

        sender_id:
            numericAdminId,

        sender_name:
            currentAdmin.name,

        sender_role:
            currentAdmin.role,

        class_name:
            null,

        message:
            createdReply.message,

        created_at:
            createdReply.created_at,

        mentions:
            mentions

    }

});


        } catch (error) {

            console.error(
                "Error admin reply:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal mengirim reply."
            });

        }

    }
);

// ========================================
// DAFTAR MENTION UNTUK POST BARU SISWA
// ========================================

app.get(
    "/api/student/mention-list",
    async (req, res) => {

        if (!req.session.studentId) {

            return res.status(401).json({
                success: false,
                message:
                    "Harus login sebagai siswa."
            });

        }


        const studentId =
            Number(req.session.studentId);

        const target =
            req.query.target === "global"
                ? "global"
                : "class";


        try {

            const student =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            class_name
                        FROM students
                        WHERE id = ?
                    `,
                    [
                        studentId
                    ]
                );


            if (!student) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Siswa tidak ditemukan."
                });

            }


            let students;


            if (target === "global") {

                students =
                    await tursoDb.all(`
                        SELECT
                            id,
                            name,
                            class_name
                        FROM students
                        ORDER BY name ASC
                    `);

            } else {

                students =
                    await tursoDb.all(
                        `
                            SELECT
                                id,
                                name,
                                class_name
                            FROM students
                            WHERE class_name = ?
                            ORDER BY name ASC
                        `,
                        [
                            student.class_name
                        ]
                    );

            }


            const admins =
                await tursoDb.all(`
                    SELECT
                        id,
                        name,
                        role
                    FROM admins
                    ORDER BY name ASC
                `);


            const users = [
                ...students.map(
                    (item) => ({
                        id:
                            item.id,

                        name:
                            item.name,

                        type:
                            "student",

                        role:
                            "student",

                        className:
                            item.class_name
                    })
                ),

                ...admins.map(
                    (admin) => ({
                        id:
                            admin.id,

                        name:
                            admin.name,

                        type:
                            "admin",

                        role:
                            admin.role,

                        className:
                            null
                    })
                )
            ];


            return res.json({
                success: true,
                users
            });


        } catch (error) {

            console.error(
                "Error student mention list:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil daftar mention."
            });

        }

    }
);

// ========================================
// DAFTAR USER UNTUK MENTION
// ========================================

app.get(
    "/api/mentions/users",
    async (req, res) => {

        if (
    !req.session.adminId &&
    !req.session.studentId
) {

    return res.status(401).json({
        success: false,
        message:
            "Harus login terlebih dahulu."
    });

}

        const announcementId =
            Number(
                req.query.announcementId
            );


        if (!Number.isInteger(announcementId)) {

            return res.status(400).json({
                success: false,
                message:
                    "ID announcement tidak valid."
            });

        }


        try {

            const announcement =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            class_name
                        FROM announcements
                        WHERE id = ?
                    `,
                    [
                        announcementId
                    ]
                );


            if (!announcement) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Announcement tidak ditemukan."
                });

            }


            let students;


            // ==========================
            // GLOBAL
            // ==========================

            if (
                announcement.class_name === null
            ) {

                students =
                    await tursoDb.all(`
                        SELECT
                            id,
                            name,
                            class_name
                        FROM students
                        ORDER BY name ASC
                    `);

            }


            // ==========================
            // KHUSUS KELAS
            // ==========================

            else {

                students =
                    await tursoDb.all(
                        `
                            SELECT
                                id,
                                name,
                                class_name
                            FROM students
                            WHERE class_name = ?
                            ORDER BY name ASC
                        `,
                        [
                            announcement.class_name
                        ]
                    );

            }


            // Guru tetap bisa di-mention
            const admins =
                await tursoDb.all(`
                    SELECT
                        id,
                        name,
                        role
                    FROM admins
                    ORDER BY name ASC
                `);


            const users = [];


            students.forEach(
                (student) => {

                    users.push({

                        id:
                            student.id,

                        name:
                            student.name,

                        type:
                            "student",

                        role:
                            "student",

                        className:
                            student.class_name

                    });

                }
            );


            admins.forEach(
                (admin) => {

                    users.push({

                        id:
                            admin.id,

                        name:
                            admin.name,

                        type:
                            "admin",

                        role:
                            admin.role,

                        className:
                            null

                    });

                }
            );


            return res.json({
                success: true,
                users
            });


        } catch (error) {

            console.error(
                "Error mention users:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil daftar mention."
            });

        }

    }
);

// ========================================
// NOTIFIKASI SISWA
// ========================================

app.get(
    "/api/student/:studentId/notifications",
    async (req, res) => {

        if (!req.session.studentId) {

            return res.status(401).json({
                success: false,
                message:
                    "Harus login sebagai siswa."
            });

        }


        const studentId =
            Number(req.params.studentId);

        const sessionStudentId =
            Number(req.session.studentId);


        if (
            !Number.isInteger(studentId) ||
            studentId !== sessionStudentId
        ) {

            return res.status(403).json({
                success: false,
                message:
                    "Akses siswa tidak valid."
            });

        }


        try {

            const notifications =
                await tursoDb.all(
                    `
                        SELECT
                            id,
                            type,
                            announcement_id,
                            reply_id,
                            message,
                            is_read,
                            created_at
                        FROM notifications
                        WHERE recipient_student_id = ?
                        ORDER BY id DESC
                    `,
                    [
                        studentId
                    ]
                );


            const unread =
                await tursoDb.get(
                    `
                        SELECT
                            COUNT(*) AS total
                        FROM notifications
                        WHERE
                            recipient_student_id = ?
                            AND is_read = 0
                    `,
                    [
                        studentId
                    ]
                );


            return res.json({
                success: true,

                unreadCount:
                    Number(
                        unread?.total || 0
                    ),

                notifications
            });


        } catch (error) {

            console.error(
                "Error mengambil notifikasi siswa:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil notifikasi."
            });

        }

    }
);

// ========================================
// NOTIFIKASI ADMIN / GURU
// ========================================

app.get(
    "/api/admin/:adminId/notifications",
    async (req, res) => {

        if (!req.session.adminId) {

            return res.status(401).json({
                success: false,
                message:
                    "Harus login sebagai guru."
            });

        }


        const adminId =
            Number(req.params.adminId);

        const sessionAdminId =
            Number(req.session.adminId);


        if (
            !Number.isInteger(adminId) ||
            adminId !== sessionAdminId
        ) {

            return res.status(403).json({
                success: false,
                message:
                    "Akses admin tidak valid."
            });

        }


        try {

            const notifications =
                await tursoDb.all(
                    `
                        SELECT
                            id,
                            type,
                            announcement_id,
                            reply_id,
                            message,
                            is_read,
                            created_at
                        FROM notifications
                        WHERE recipient_admin_id = ?
                        ORDER BY id DESC
                    `,
                    [
                        adminId
                    ]
                );


            const unread =
                await tursoDb.get(
                    `
                        SELECT
                            COUNT(*) AS total
                        FROM notifications
                        WHERE
                            recipient_admin_id = ?
                            AND is_read = 0
                    `,
                    [
                        adminId
                    ]
                );


            return res.json({
                success: true,

                unreadCount:
                    Number(
                        unread?.total || 0
                    ),

                notifications
            });


        } catch (error) {

            console.error(
                "Error mengambil notifikasi admin:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil notifikasi."
            });

        }

    }
);

// ========================================
// TANDAI NOTIFIKASI DIBACA
// ========================================

app.patch(
    "/api/notifications/:notificationId/read",
    async (req, res) => {

        const notificationId =
            Number(
                req.params.notificationId
            );


        if (!Number.isInteger(notificationId)) {

            return res.status(400).json({
                success: false,
                message:
                    "ID notifikasi tidak valid."
            });

        }


        const studentId =
            req.session.studentId
                ? Number(req.session.studentId)
                : null;

        const adminId =
            req.session.adminId
                ? Number(req.session.adminId)
                : null;


        if (!studentId && !adminId) {

            return res.status(401).json({
                success: false,
                message:
                    "Harus login terlebih dahulu."
            });

        }


        try {

const result =
    await tursoDb.run(
        `
            UPDATE notifications
            SET is_read = 1

            WHERE id = ?

            AND (
                (
                    recipient_admin_id = ?
                    AND ? IS NOT NULL
                )

                OR

                (
                    recipient_student_id = ?
                    AND ? IS NOT NULL
                )
            )
        `,
        [
            notificationId,

            adminId,
            adminId,

            studentId,
            studentId
        ]
    );


            if (
                Number(result.changes || 0) === 0
            ) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Notifikasi tidak ditemukan."
                });

            }


            return res.json({
                success: true
            });


        } catch (error) {

            console.error(
                "Error update notifikasi:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal memperbarui notifikasi."
            });

        }

    }
);

// ========================================
// SISWA LIHAT NILAI UJIAN
// ========================================

app.get(
    "/api/student/:studentId/exam-scores",
    async (req, res) => {

const studentId =
    Number(req.params.studentId);

const sessionStudentId =
    Number(req.session.studentId);


if (!req.session.studentId) {

    return res.status(401).json({
        success: false,
        message:
            "Harus login sebagai siswa."
    });

}


if (
    !Number.isInteger(studentId) ||
    studentId !== sessionStudentId
) {

    return res.status(403).json({
        success: false,
        message:
            "Akses siswa tidak valid."
    });

}


        try {

            const student =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            name,
                            class_name
                        FROM students
                        WHERE id = ?
                    `,
                    [
                        studentId
                    ]
                );


            if (!student) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Siswa tidak ditemukan."
                });

            }


            const examScores =
                await tursoDb.all(
                    `
                        SELECT
                            id,
                            subject,
                            material,
                            score,
                            created_at
                        FROM exam_scores
                        WHERE student_id = ?
                        ORDER BY id DESC
                    `,
                    [
                        studentId
                    ]
                );


            return res.json({

                success: true,

                student: {
                    id:
                        student.id,

                    name:
                        student.name,

                    className:
                        student.class_name
                },

                examScores

            });


        } catch (error) {

            console.error(
                "Error mengambil nilai ujian:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil nilai ujian."
            });

        }

    }
);

// ========================================
// ADMIN LIHAT SEMUA NILAI UJIAN
// ========================================

app.get(
    "/api/admin/exam-scores",
    async (req, res) => {

        try {

            const examScores =
                await tursoDb.all(`
                    SELECT
                        exam_scores.id,
                        exam_scores.student_id,
                        exam_scores.subject,
                        exam_scores.material,
                        exam_scores.score,
                        exam_scores.created_at,

                        students.name AS student_name,
                        students.class_name

                    FROM exam_scores

                    LEFT JOIN students
                    ON students.id =
                        exam_scores.student_id

                    ORDER BY exam_scores.id DESC
                `);


            return res.json({
                success: true,
                examScores
            });


        } catch (error) {

            console.error(
                "Error mengambil nilai ujian admin:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil nilai ujian."
            });

        }

    }
);


// ========================================
// ADMIN HAPUS NILAI UJIAN
// ========================================

app.delete(
    "/api/admin/exam-scores/:scoreId",
    async (req, res) => {

        const scoreId =
            Number(req.params.scoreId);


        if (!Number.isInteger(scoreId)) {

            return res.status(400).json({
                success: false,
                message:
                    "ID nilai tidak valid."
            });

        }


        try {

            const result =
                await tursoDb.run(
                    `
                        DELETE FROM exam_scores
                        WHERE id = ?
                    `,
                    [
                        scoreId
                    ]
                );


            if (result.changes === 0) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Nilai tidak ditemukan."
                });

            }


            return res.json({
                success: true,
                message:
                    "Nilai berhasil dihapus."
            });


        } catch (error) {

            console.error(
                "Error hapus nilai ujian:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal menghapus nilai ujian."
            });

        }

    }
);

app.get(
    "/api/admin/users/mention-list",
    async (req, res) => {

        if (
            !req.session.adminId &&
            !req.session.studentId
        ) {

            return res.status(401).json({
                success: false,
                message:
                    "Harus login terlebih dahulu."
            });

        }


        try {

            const admins =
                await tursoDb.all(`
                    SELECT
                        id,
                        name,
                        role
                    FROM admins
                    ORDER BY name ASC
                `);


            return res.json({
                success: true,
                admins
            });


        } catch (error) {

            console.error(
                "Gagal mengambil mention list:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil daftar admin."
            });

        }

    }
);

// ========================================
// ADMIN BUAT ANNOUNCEMENT
// ========================================

app.post(
    "/api/admin/public-announcements",
    async (req, res) => {

        if (!req.session.adminId) {

            return res.status(401).json({
                success: false,
                message:
                    "Harus login sebagai guru."
            });

        }


        const adminId =
            Number(req.session.adminId);

        const {
            title,
            message
        } = req.body;


        if (
            !title ||
            title.trim().length === 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Judul wajib diisi."
            });

        }


        if (
            !message ||
            message.trim().length === 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Isi announcement wajib diisi."
            });

        }


        try {

            const admin =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            name
                        FROM admins
                        WHERE id = ?
                    `,
                    [
                        adminId
                    ]
                );


            if (!admin) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Admin / Guru tidak ditemukan."
                });

            }


            const result =
                await tursoDb.run(
                    `
                        INSERT INTO public_announcements
                        (
                            admin_id,
                            title,
                            message
                        )
                        VALUES (?, ?, ?)
                    `,
                    [
                        adminId,
                        title.trim(),
                        message.trim()
                    ]
                );


            return res.json({
                success: true,

                message:
                    "Announcement berhasil dibuat.",

                announcement: {
                    id:
                        Number(
                            result.lastInsertRowid
                        ),

                    adminId,

                    adminName:
                        admin.name,

                    title:
                        title.trim(),

                    message:
                        message.trim()
                }
            });


        } catch (error) {

            console.error(
                "Error membuat announcement:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal membuat announcement."
            });

        }

    }
);


// ========================================
// AMBIL SEMUA ANNOUNCEMENT
// ========================================

app.get(
    "/api/public-announcements",
    async (req, res) => {

        try {

            const announcements =
                await tursoDb.all(
                    `
                        SELECT
                            public_announcements.id,
                            public_announcements.title,
                            public_announcements.message,
                            public_announcements.created_at,

                            admins.id AS admin_id,
                            admins.name AS admin_name

                        FROM public_announcements

                        LEFT JOIN admins
                        ON admins.id =
                            public_announcements.admin_id

                        ORDER BY
                            public_announcements.id DESC
                    `
                );


            return res.json({
                success: true,
                announcements
            });


        } catch (error) {

            console.error(
                "Error mengambil announcement:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil announcement."
            });

        }

    }
);


// ========================================
// ADMIN HAPUS ANNOUNCEMENT
// ========================================

app.delete(
    "/api/admin/public-announcements/:id",
    async (req, res) => {

        if (!req.session.adminId) {

            return res.status(401).json({
                success: false,
                message:
                    "Harus login sebagai guru."
            });

        }


        const announcementId =
            Number(req.params.id);


        if (!Number.isInteger(announcementId)) {

            return res.status(400).json({
                success: false,
                message:
                    "ID announcement tidak valid."
            });

        }


        try {

            const result =
                await tursoDb.run(
                    `
                        DELETE FROM public_announcements
                        WHERE id = ?
                    `,
                    [
                        announcementId
                    ]
                );


            if (
                Number(
                    result.changes || 0
                ) === 0
            ) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Announcement tidak ditemukan."
                });

            }


            return res.json({
                success: true,
                message:
                    "Announcement berhasil dihapus."
            });


        } catch (error) {

            console.error(
                "Error hapus announcement:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal menghapus announcement."
            });

        }

    }
);

app.post(
    "/api/logout",
    (req, res) => {

        req.session.destroy(
            (error) => {

                if (error) {

                    return res
                        .status(500)
                        .json({
                            message:
                                "Gagal logout"
                        });

                }


                res.clearCookie(
                    "connect.sid"
                );


                res.json({
                    success: true
                });

            }
        );

    }
);

app.get(
    "/api/admin/registration-code",
    async (req, res) => {

        if (!req.session.adminId) {

            return res
                .status(401)
                .json({
                    success: false,
                    message:
                        "Harus login sebagai guru."
                });

        }


        try {

            const activeCode =
                await tursoDb.get(
                    `
                        SELECT
                            teacher_registration_codes.*,
                            admins.name AS creator_name

                        FROM teacher_registration_codes

                        JOIN admins
                            ON admins.id =
                            teacher_registration_codes.created_by_admin_id

                        WHERE
                            teacher_registration_codes.status =
                            'active'

                        ORDER BY
                            teacher_registration_codes.id DESC

                        LIMIT 1
                    `
                );


            return res.json({
                success: true,
                code:
                    activeCode || null
            });


        } catch (error) {

            console.error(
                "Gagal mengambil kode registrasi guru:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil kode registrasi guru."
            });

        }

    }
);

app.post(
    "/api/admin/registration-code/regenerate",
    async (req, res) => {

        if (!req.session.adminId) {

            return res
                .status(401)
                .json({
                    success: false,
                    message:
                        "Harus login sebagai guru."
                });

        }


        try {

            // Hanguskan semua kode aktif sebelumnya
            await tursoDb.run(
                `
                    UPDATE teacher_registration_codes

                    SET
                        status = 'revoked',
                        revoked_at =
                            CURRENT_TIMESTAMP

                    WHERE
                        status = 'active'
                `
            );


            let newCode;


            while (true) {

                newCode =
                    generateTeacherCode();


                const existing =
                    await tursoDb.get(
                        `
                            SELECT id

                            FROM
                                teacher_registration_codes

                            WHERE
                                code = ?
                        `,
                        [
                            newCode
                        ]
                    );


                if (!existing) {
                    break;
                }

            }


            await tursoDb.run(
                `
                    INSERT INTO
                        teacher_registration_codes
                    (
                        code,
                        created_by_admin_id,
                        status
                    )

                    VALUES (
                        ?,
                        ?,
                        'active'
                    )
                `,
                [
                    newCode,
                    Number(
                        req.session.adminId
                    )
                ]
            );


            return res.json({
                success: true,
                code:
                    newCode
            });


        } catch (error) {

            console.error(
                "Gagal regenerate kode guru:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal membuat kode registrasi guru."
            });

        }

    }
);

app.post(
    "/api/teacher/register",
    async (req, res) => {

        try {

            let {
                name,
                username,
                password,
                code
            } = req.body;


            name =
                String(name || "")
                    .trim();

            username =
                String(username || "")
                    .trim()
                    .toLowerCase();

            password =
                String(password || "");

            code =
                String(code || "")
                    .trim()
                    .toUpperCase();


            if (
                !name ||
                !username ||
                !password ||
                !code
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Semua data wajib diisi."
                    });

            }


            if (password.length < 8) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Password minimal 8 karakter."
                    });

            }


            const existingUser =
                await tursoDb.get(
                    `
                        SELECT id
                        FROM admins
                        WHERE username = ?
                    `,
                    [
                        username
                    ]
                );


            if (existingUser) {

                return res
                    .status(409)
                    .json({
                        success: false,
                        message:
                            "Username sudah digunakan."
                    });

            }


            const registrationCode =
                await tursoDb.get(
                    `
                        SELECT *

                        FROM
                            teacher_registration_codes

                        WHERE
                            code = ?

                        AND
                            status = 'active'
                    `,
                    [
                        code
                    ]
                );


            if (!registrationCode) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Kode registrasi tidak valid atau sudah tidak berlaku."
                    });

            }


            const passwordHash =
                await bcrypt.hash(
                    password,
                    12
                );


            const teacherResult =
                await tursoDb.run(
                    `
                        INSERT INTO admins (
                            username,
                            password,
                            name,
                            role
                        )

                        VALUES (
                            ?,
                            ?,
                            ?,
                            'teacher'
                        )
                    `,
                    [
                        username,
                        passwordHash,
                        name
                    ]
                );


            const teacherId =
                Number(
                    teacherResult.lastInsertRowid
                );


            const codeResult =
                await tursoDb.run(
                    `
                        UPDATE
                            teacher_registration_codes

                        SET
                            status = 'used',

                            used_by_admin_id = ?,

                            used_at =
                                CURRENT_TIMESTAMP

                        WHERE
                            id = ?

                        AND
                            status = 'active'
                    `,
                    [
                        teacherId,
                        registrationCode.id
                    ]
                );


            if (
                Number(
                    codeResult.changes || 0
                ) !== 1
            ) {

                /*
                    Kalau kode ternyata sudah dipakai
                    tepat saat registrasi berlangsung,
                    hapus akun yang tadi sempat dibuat.
                */

                await tursoDb.run(
                    `
                        DELETE FROM admins
                        WHERE id = ?
                    `,
                    [
                        teacherId
                    ]
                );


                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Kode registrasi sudah tidak aktif."
                    });

            }


            const teacher = {
                id:
                    teacherId,

                name,

                username,

                role:
                    "teacher"
            };


            return res
                .status(201)
                .json({
                    success: true,

                    message:
                        "Akun guru berhasil dibuat.",

                    teacher
                });


        } catch (error) {

            console.error(
                "Gagal registrasi guru:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Gagal membuat akun guru."
                });

        }

    }
);

app.get(
    "/api/admin/teachers",
    async (req, res) => {

        if (!req.session.adminId) {

            return res
                .status(401)
                .json({
                    success: false,
                    message:
                        "Harus login sebagai guru."
                });

        }


        try {

            const teachers =
                await tursoDb.all(
                    `
                        SELECT
                            id,
                            name,
                            username,
                            role,
                            created_at

                        FROM admins

                        ORDER BY
                            name COLLATE NOCASE ASC
                    `
                );


            return res.json({
                success: true,
                teachers
            });


        } catch (error) {

            console.error(
                "Gagal mengambil daftar guru:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil daftar guru."
            });

        }

    }
);

app.delete(
    "/api/admin/teachers/:teacherId",
    async (req, res) => {

        if (!req.session.adminId) {

            return res
                .status(401)
                .json({
                    success: false,
                    message:
                        "Harus login sebagai guru."
                });

        }


        const teacherId =
            Number(
                req.params.teacherId
            );


        const password =
            String(
                req.body?.password || ""
            );


        if (
            !Number.isInteger(
                teacherId
            )
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "ID guru tidak valid."
                });

        }


        if (
            teacherId ===
            Number(
                req.session.adminId
            )
        ) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Akun yang sedang digunakan tidak dapat dihapus."
                });

        }


        if (!password) {

            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Password guru wajib diisi."
                });

        }


        try {

            /*
                Ambil akun target sekaligus
                password hash-nya.
            */
            const teacher =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            name,
                            username,
                            password

                        FROM admins

                        WHERE id = ?
                    `,
                    [
                        teacherId
                    ]
                );


            if (!teacher) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Akun guru tidak ditemukan."
                    });

            }


            /*
                Jangan izinkan seluruh akun
                guru habis.
            */
            const teacherCount =
                await tursoDb.get(
                    `
                        SELECT
                            COUNT(*) AS total

                        FROM admins
                    `
                );


            if (
                Number(
                    teacherCount.total || 0
                ) <= 1
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Minimal harus ada satu akun guru."
                    });

            }


            /*
                PASSWORD HARUS MILIK
                GURU YANG AKAN DIHAPUS.
            */
            const passwordValid =
                await bcrypt.compare(
                    password,
                    teacher.password
                );


            if (!passwordValid) {

                return res
                    .status(403)
                    .json({
                        success: false,
                        message:
                            "Password guru salah. Akun tidak dihapus."
                    });

            }


            /*
                =================================
                1. NOTIFICATION

                Hapus:
                - notif yang dikirim guru
                - notif yang diterima guru
                - notif dari postingan guru
                - notif dari reply guru
                =================================
            */
            await tursoDb.run(
                `
                    DELETE FROM notifications

                    WHERE
                        sender_admin_id = ?

                    OR
                        recipient_admin_id = ?

                    OR
                        announcement_id IN (
                            SELECT id
                            FROM announcements
                            WHERE admin_id = ?
                        )

                    OR
                        reply_id IN (
                            SELECT id
                            FROM announcement_replies
                            WHERE admin_id = ?
                        )
                `,
                [
                    teacherId,
                    teacherId,
                    teacherId,
                    teacherId
                ]
            );


            /*
                =================================
                2. MENTION

                Termasuk:
                - mention yang menunjuk guru
                - mention pada post guru
                - mention pada reply guru
                =================================
            */
            await tursoDb.run(
                `
                    DELETE FROM announcement_mentions

                    WHERE
                        mentioned_admin_id = ?

                    OR
                        announcement_id IN (
                            SELECT id
                            FROM announcements
                            WHERE admin_id = ?
                        )

                    OR
                        reply_id IN (
                            SELECT id
                            FROM announcement_replies
                            WHERE admin_id = ?
                        )
                `,
                [
                    teacherId,
                    teacherId,
                    teacherId
                ]
            );


            /*
                =================================
                3. REPLY CLASSROOM FEED

                Hapus reply milik guru.

                Kalau sebuah post utama dibuat
                guru tersebut, seluruh reply
                di bawah thread itu juga harus
                ikut hilang karena post-nya
                akan dihapus.
                =================================
            */
            await tursoDb.run(
                `
                    DELETE FROM announcement_replies

                    WHERE
                        admin_id = ?

                    OR
                        announcement_id IN (
                            SELECT id
                            FROM announcements
                            WHERE admin_id = ?
                        )
                `,
                [
                    teacherId,
                    teacherId
                ]
            );


            /*
                =================================
                4. POST CLASSROOM FEED
                =================================
            */
            await tursoDb.run(
                `
                    DELETE FROM announcements

                    WHERE admin_id = ?
                `,
                [
                    teacherId
                ]
            );


            /*
                =================================
                5. OFFICIAL ANNOUNCEMENT
                =================================
            */
            await tursoDb.run(
                `
                    DELETE FROM public_announcements

                    WHERE admin_id = ?
                `,
                [
                    teacherId
                ]
            );


            /*
                =================================
                6. REGISTRATION CODE

                Kalau kode dibuat oleh guru
                target, hapus.

                Kalau guru target dulu pernah
                menggunakan kode milik guru
                lain, cukup putus referensi
                used_by_admin_id.
                =================================
            */
            await tursoDb.run(
                `
                    UPDATE teacher_registration_codes

                    SET
                        used_by_admin_id = NULL

                    WHERE
                        used_by_admin_id = ?
                `,
                [
                    teacherId
                ]
            );


            await tursoDb.run(
                `
                    DELETE FROM teacher_registration_codes

                    WHERE
                        created_by_admin_id = ?
                `,
                [
                    teacherId
                ]
            );


            /*
                =================================
                7. TERAKHIR:
                   HAPUS AKUN GURU
                =================================
            */
            const result =
                await tursoDb.run(
                    `
                        DELETE FROM admins

                        WHERE id = ?
                    `,
                    [
                        teacherId
                    ]
                );


            if (
                Number(
                    result.changes || 0
                ) === 0
            ) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Akun guru tidak ditemukan."
                    });

            }


            return res.json({
                success: true,

                message:
                    `Akun ${teacher.name} berhasil dihapus beserta seluruh data terkait.`
            });


        } catch (error) {

            console.error(
                "Gagal menghapus guru dan data terkait:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,

                    message:
                        "Gagal menghapus akun guru beserta data terkait."
                });

        }

    }
);

app.post(
    "/api/admin/system/factory-reset",
    async (req, res) => {

        if (!req.session.adminId) {

            return res
                .status(401)
                .json({
                    success: false,
                    message:
                        "Harus login sebagai guru."
                });

        }


        try {

            const passwordHash =
                await bcrypt.hash(
                    "cruise@fl350",
                    12
                );


            /*
                Urutan penghapusan penting
                karena ada FOREIGN KEY.
            */

            await tursoDb.run(
                `
                    DELETE FROM
                        announcement_mentions
                `
            );


            await tursoDb.run(
                `
                    DELETE FROM
                        notifications
                `
            );


            await tursoDb.run(
                `
                    DELETE FROM
                        announcement_replies
                `
            );


            await tursoDb.run(
                `
                    DELETE FROM
                        announcements
                `
            );


            await tursoDb.run(
                `
                    DELETE FROM
                        public_announcements
                `
            );


            await tursoDb.run(
                `
                    DELETE FROM
                        point_transactions
                `
            );


            await tursoDb.run(
                `
                    DELETE FROM
                        exam_scores
                `
            );


            await tursoDb.run(
                `
                    DELETE FROM
                        teacher_registration_codes
                `
            );


            await tursoDb.run(
                `
                    DELETE FROM
                        students
                `
            );


            await tursoDb.run(
                `
                    DELETE FROM
                        admins
                `
            );


            /*
                Reset AUTOINCREMENT supaya
                database benar-benar fresh.
            */

            const sequences = [
                "announcement_mentions",
                "notifications",
                "announcement_replies",
                "announcements",
                "public_announcements",
                "point_transactions",
                "exam_scores",
                "teacher_registration_codes",
                "students",
                "admins"
            ];


            for (const tableName of sequences) {

                await tursoDb.run(
                    `
                        DELETE FROM sqlite_sequence
                        WHERE name = ?
                    `,
                    [
                        tableName
                    ]
                );

            }


            /*
                Buat kembali akun guru default.
            */

            await tursoDb.run(
                `
                    INSERT INTO admins (
                        username,
                        password,
                        name,
                        role
                    )

                    VALUES (
                        ?,
                        ?,
                        ?,
                        ?
                    )
                `,
                [
                    "steven",
                    passwordHash,
                    "Steven",
                    "teacher"
                ]
            );


            /*
                Session lama tidak boleh
                dipakai setelah factory reset.
            */

            req.session.destroy(
                (error) => {

                    if (error) {

                        console.error(
                            "Reset berhasil tetapi session gagal dihapus:",
                            error
                        );

                    }

                }
            );


            return res.json({
                success: true,

                message:
                    "Factory reset berhasil. Semua data telah dihapus dan akun default Steven dibuat kembali."
            });


        } catch (error) {

            console.error(
                "Factory reset gagal:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,

                    message:
                        "Factory reset gagal."
                });

        }

    }
);

app.post(
    "/api/admin/system/reset/:section",
    async (req, res) => {

        if (!req.session.adminId) {

            return res
                .status(401)
                .json({
                    success: false,
                    message:
                        "Harus login sebagai guru."
                });

        }


        const section =
            String(
                req.params.section || ""
            ).trim();


try {

    if (section === "points") {

        await tursoDb.run(
            `
                DELETE FROM
                    point_transactions
            `
        );


        await tursoDb.run(
            `
                DELETE FROM sqlite_sequence
                WHERE name =
                    'point_transactions'
            `
        );


        return res.json({
            success: true,
            message:
                "Semua data poin berhasil direset."
        });

    }

    if (section === "scores") {

    await tursoDb.run(
        `
            DELETE FROM
                exam_scores
        `
    );


    await tursoDb.run(
        `
            DELETE FROM sqlite_sequence
            WHERE name =
                'exam_scores'
        `
    );


    return res.json({
        success: true,
        message:
            "Semua nilai berhasil direset."
    });

}

if (
    section ===
    "announcements"
) {

    await tursoDb.run(
        `
            DELETE FROM
                public_announcements
        `
    );


    await tursoDb.run(
        `
            DELETE FROM sqlite_sequence
            WHERE name =
                'public_announcements'
        `
    );


    return res.json({
        success: true,
        message:
            "Semua Announcement berhasil direset."
    });

}

if (
    section ===
    "classroom-feed"
) {

    await tursoDb.run(
        `
            DELETE FROM
                announcement_mentions
        `
    );


    await tursoDb.run(
        `
            DELETE FROM
                notifications
        `
    );


    await tursoDb.run(
        `
            DELETE FROM
                announcement_replies
        `
    );


    await tursoDb.run(
        `
            DELETE FROM
                announcements
        `
    );


    const tables = [
        "announcement_mentions",
        "notifications",
        "announcement_replies",
        "announcements"
    ];


    for (const tableName of tables) {

        await tursoDb.run(
            `
                DELETE FROM sqlite_sequence
                WHERE name = ?
            `,
            [
                tableName
            ]
        );

    }


    return res.json({
        success: true,
        message:
            "Classroom Feed berhasil direset."
    });

}

if (
    section ===
    "students"
) {

    await tursoDb.run(
        `
            DELETE FROM announcement_mentions

            WHERE
                mentioned_student_id IS NOT NULL

            OR announcement_id IN (
                SELECT id
                FROM announcements
                WHERE student_id IS NOT NULL
            )

            OR reply_id IN (
                SELECT id
                FROM announcement_replies
                WHERE student_id IS NOT NULL
            )
        `
    );


    await tursoDb.run(
        `
            DELETE FROM notifications

            WHERE
                recipient_student_id IS NOT NULL

            OR sender_student_id IS NOT NULL

            OR announcement_id IN (
                SELECT id
                FROM announcements
                WHERE student_id IS NOT NULL
            )

            OR reply_id IN (
                SELECT id
                FROM announcement_replies
                WHERE student_id IS NOT NULL
            )
        `
    );


    await tursoDb.run(
        `
            DELETE FROM announcement_replies

            WHERE announcement_id IN (
                SELECT id
                FROM announcements
                WHERE student_id IS NOT NULL
            )
        `
    );


    await tursoDb.run(
        `
            DELETE FROM announcement_replies
            WHERE student_id IS NOT NULL
        `
    );


    await tursoDb.run(
        `
            DELETE FROM announcements
            WHERE student_id IS NOT NULL
        `
    );


    await tursoDb.run(
        `
            DELETE FROM point_transactions
        `
    );


    await tursoDb.run(
        `
            DELETE FROM exam_scores
        `
    );


await tursoDb.run(
    `
        DELETE FROM students
    `
);


await ensureClassesTable();

await tursoDb.run(
    `
        DELETE FROM classes
    `
);


const tables = [
    "students",
    "point_transactions",
    "exam_scores",
    "classes"
];


    for (const tableName of tables) {

        await tursoDb.run(
            `
                DELETE FROM sqlite_sequence
                WHERE name = ?
            `,
            [
                tableName
            ]
        );

    }


    return res.json({
        success: true,
        message:
            "Semua data siswa berhasil direset."
    });

}


throw new Error(
    "RESET_SECTION_INVALID"
);


        } catch (error) {

            if (
                error.message ===
                "RESET_SECTION_INVALID"
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Jenis reset tidak valid."
                    });

            }


            console.error(
                "Reset bagian gagal:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Reset data gagal."
                });

        }

    }
);

// ========================================
// LIVE FEED SISWA - POST BARU
// ========================================

app.get(
    "/api/student/:studentId/announcements/live",
    async (req, res) => {

        if (!req.session.studentId) {

            return res.status(401).json({
                success: false,
                message:
                    "Harus login sebagai siswa."
            });

        }


        const studentId =
            Number(
                req.params.studentId
            );

        const sessionStudentId =
            Number(
                req.session.studentId
            );

        const afterId =
            Number(
                req.query.afterId || 0
            );


        if (
            !Number.isInteger(studentId) ||
            studentId !==
                sessionStudentId
        ) {

            return res.status(403).json({
                success: false,
                message:
                    "Akses siswa tidak valid."
            });

        }


        if (
            !Number.isInteger(afterId) ||
            afterId < 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "ID live feed tidak valid."
            });

        }


        try {

            const student =
                await tursoDb.get(
                    `
                        SELECT
                            class_name
                        FROM students
                        WHERE id = ?
                    `,
                    [
                        studentId
                    ]
                );


            if (!student) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Siswa tidak ditemukan."
                });

            }


            const announcements =
                await tursoDb.all(
                    `
                        SELECT
                            announcements.id,
                            announcements.student_id,
                            announcements.admin_id,
                            announcements.class_name,
                            announcements.message,
                            announcements.created_at,

                            students.name
                                AS student_creator_name,

                            students.class_name
                                AS student_creator_class,

                            admins.name
                                AS admin_creator_name,

                            admins.role
                                AS admin_creator_role

                        FROM announcements

                        LEFT JOIN students
                        ON students.id =
                            announcements.student_id

                        LEFT JOIN admins
                        ON admins.id =
                            announcements.admin_id

                        WHERE
                            announcements.id > ?

                        AND (
                            announcements.class_name
                                IS NULL

                            OR

                            announcements.class_name = ?
                        )

                        ORDER BY
                            announcements.id ASC
                    `,
                    [
                        afterId,
                        student.class_name
                    ]
                );


            const formattedAnnouncements =
                await Promise.all(
                    announcements.map(
                        async (
                            announcement
                        ) => ({
                            ...announcement,

                            mentions:
                                await getAnnouncementMentions(
                                    announcement.id
                                )
                        })
                    )
                );


            return res.json({
                success: true,
                announcements:
                    formattedAnnouncements
            });


        } catch (error) {

            console.error(
                "Error live feed siswa:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil live feed siswa."
            });

        }

    }
);

// ========================================
// LIVE FEED SISWA - REPLY BARU
// ========================================

app.get(
    "/api/student/:studentId/replies/live",
    async (req, res) => {

        if (!req.session.studentId) {

            return res.status(401).json({
                success: false,
                message:
                    "Harus login sebagai siswa."
            });

        }


        const studentId =
            Number(
                req.params.studentId
            );

        const sessionStudentId =
            Number(
                req.session.studentId
            );

        const afterId =
            Number(
                req.query.afterId || 0
            );


        if (
            !Number.isInteger(studentId) ||
            studentId !==
                sessionStudentId
        ) {

            return res.status(403).json({
                success: false,
                message:
                    "Akses siswa tidak valid."
            });

        }


        if (
            !Number.isInteger(afterId) ||
            afterId < 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "ID live reply tidak valid."
            });

        }


        try {

            const student =
                await tursoDb.get(
                    `
                        SELECT
                            class_name
                        FROM students
                        WHERE id = ?
                    `,
                    [
                        studentId
                    ]
                );


            if (!student) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Siswa tidak ditemukan."
                });

            }


            const replies =
                await tursoDb.all(
                    `
                        SELECT
                            announcement_replies.id,
                            announcement_replies.announcement_id,
                            announcement_replies.message,
                            announcement_replies.created_at,
                            announcement_replies.student_id,
                            announcement_replies.admin_id,

                            students.name
                                AS student_name,

                            students.class_name
                                AS class_name,

                            admins.name
                                AS admin_name,

                            admins.role
                                AS admin_role

                        FROM announcement_replies

                        INNER JOIN announcements
                        ON announcements.id =
                            announcement_replies.announcement_id

                        LEFT JOIN students
                        ON students.id =
                            announcement_replies.student_id

                        LEFT JOIN admins
                        ON admins.id =
                            announcement_replies.admin_id

                        WHERE
                            announcement_replies.id > ?

                        AND (
                            announcements.class_name
                                IS NULL

                            OR

                            announcements.class_name = ?
                        )

                        ORDER BY
                            announcement_replies.id ASC
                    `,
                    [
                        afterId,
                        student.class_name
                    ]
                );


            const formattedReplies =
                await Promise.all(
                    replies.map(
                        async (reply) => {

                            const mentions =
                                await getReplyMentions(
                                    reply.id
                                );


                            if (
                                reply.student_id
                            ) {

                                return {
                                    id:
                                        reply.id,

                                    announcement_id:
                                        reply.announcement_id,

                                    message:
                                        reply.message,

                                    created_at:
                                        reply.created_at,

                                    mentions,

                                    sender_id:
                                        reply.student_id,

                                    sender_name:
                                        reply.student_name ||
                                        "Siswa",

                                    sender_type:
                                        "student",

                                    sender_role:
                                        "student",

                                    class_name:
                                        reply.class_name
                                };

                            }


                            return {
                                id:
                                    reply.id,

                                announcement_id:
                                    reply.announcement_id,

                                message:
                                    reply.message,

                                created_at:
                                    reply.created_at,

                                mentions,

                                sender_id:
                                    reply.admin_id,

                                sender_name:
                                    reply.admin_name ||
                                    "Admin / Guru",

                                sender_type:
                                    "admin",

                                sender_role:
                                    reply.admin_role ||
                                    "Admin / Guru",

                                class_name:
                                    null
                            };

                        }
                    )
                );


            return res.json({
                success: true,
                replies:
                    formattedReplies
            });


        } catch (error) {

            console.error(
                "Error live reply siswa:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil live reply siswa."
            });

        }

    }
);

// ========================================
// LIVE FEED SISWA - STATE ID
// UNTUK DETEKSI DELETE
// ========================================

app.get(
    "/api/student/:studentId/classroom-feed/state",
    async (req, res) => {

        if (!req.session.studentId) {

            return res.status(401).json({
                success: false,
                message:
                    "Harus login sebagai siswa."
            });

        }


        const studentId =
            Number(
                req.params.studentId
            );

        const sessionStudentId =
            Number(
                req.session.studentId
            );


        if (
            !Number.isInteger(studentId) ||
            studentId !==
                sessionStudentId
        ) {

            return res.status(403).json({
                success: false,
                message:
                    "Akses siswa tidak valid."
            });

        }


        try {

            const student =
                await tursoDb.get(
                    `
                        SELECT
                            class_name
                        FROM students
                        WHERE id = ?
                    `,
                    [
                        studentId
                    ]
                );


            if (!student) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Siswa tidak ditemukan."
                });

            }


            const announcements =
                await tursoDb.all(
                    `
                        SELECT id
                        FROM announcements

                        WHERE
                            class_name IS NULL

                        OR

                            class_name = ?
                    `,
                    [
                        student.class_name
                    ]
                );


            const replies =
                await tursoDb.all(
                    `
                        SELECT
                            announcement_replies.id,
                            announcement_replies.announcement_id

                        FROM announcement_replies

                        INNER JOIN announcements
                        ON announcements.id =
                            announcement_replies.announcement_id

                        WHERE
                            announcements.class_name
                                IS NULL

                        OR

                            announcements.class_name = ?
                    `,
                    [
                        student.class_name
                    ]
                );


            return res.json({
                success: true,

                announcementIds:
                    announcements.map(
                        (announcement) =>
                            Number(
                                announcement.id
                            )
                    ),

                replies:
                    replies.map(
                        (reply) => ({
                            id:
                                Number(
                                    reply.id
                                ),

                            announcement_id:
                                Number(
                                    reply.announcement_id
                                )
                        })
                    )
            });


        } catch (error) {

            console.error(
                "Error classroom feed state siswa:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil state Classroom Feed siswa."
            });

        }

    }
);

app.listen(
    PORT,
    () => {

        console.log(
            `LMS berjalan di http://localhost:${PORT}`
        );

    }
);