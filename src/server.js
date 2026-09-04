const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");
const crypto = require("crypto");

const {
    v2: cloudinary
} = require("cloudinary");

const tursoDb =
    require("./database-turso");

const TursoSessionStore =
    require("./turso-session-store");

const isProduction =
    process.env.VERCEL === "1" ||
    process.env.NODE_ENV ===
        "production";

const CLOUDINARY_UPLOAD_PRESET =
    String(
        process.env
            .CLOUDINARY_UPLOAD_PRESET ||
        "lms_signed_images"
    ).trim();


const QUIZ_IMAGE_MAX_BYTES =
    2 * 1024 * 1024;

const QUIZ_IMAGE_UPLOAD_TRANSFORMATION =
    "c_limit,w_1600,h_1600/q_auto:good/f_webp";


const QUIZ_IMAGE_ALLOWED_FORMATS =
    "jpg,jpeg,png,webp";

const STUDENT_PROFILE_BIO_MAX_LENGTH =
    120;

const STUDENT_PROFILE_BIO_MAX_LINES =
    3;


const STUDENT_PROFILE_BANNER_COLORS =
    new Set([
        "blue",
        "purple",
        "green",
        "orange",
        "red"
    ]);

const STUDENT_PROFILE_PICTURE_SIZE =
    256;

const STUDENT_PROFILE_PICTURE_MAX_BYTES =
    400 * 1024;

const CLOUDINARY_CLOUD_NAME =
    String(
        process.env
            .CLOUDINARY_CLOUD_NAME ||
        ""
    ).trim();


cloudinary.config({
    cloud_name:
        CLOUDINARY_CLOUD_NAME,

    api_key:
        process.env
            .CLOUDINARY_API_KEY,

    api_secret:
        process.env
            .CLOUDINARY_API_SECRET,

    secure:
        true
});


function isCloudinaryConfigured() {

    return Boolean(
        process.env
            .CLOUDINARY_CLOUD_NAME &&

        process.env
            .CLOUDINARY_API_KEY &&

        process.env
            .CLOUDINARY_API_SECRET
    );

}


function getQuizImageAssetFolder(
    quizId
) {

    return `lms/quiz/${quizId}/questions`;

}

function getStudentProfilePictureAssetFolder(
    studentId
) {

    return (
        `lms/students/` +
        `${studentId}/profile`
    );

}


function isValidWebpBuffer(buffer) {

    return (
        Buffer.isBuffer(buffer) &&
        buffer.length >= 12 &&
        buffer
            .subarray(0, 4)
            .toString("ascii") ===
            "RIFF" &&
        buffer
            .subarray(8, 12)
            .toString("ascii") ===
            "WEBP"
    );

}


function parseStudentProfilePictureBody(
    req,
    res,
    next
) {

    express.raw({
        type:
            "image/webp",

        limit:
            STUDENT_PROFILE_PICTURE_MAX_BYTES
    })(
        req,
        res,
        error => {

            if (!error) {

                next();
                return;

            }


            if (
                error.type ===
                "entity.too.large"
            ) {

                res.status(413).json({
                    success:
                        false,

                    message:
                        "Ukuran foto profil terlalu besar."
                });

                return;

            }


            next(error);

        }
    );

}


function uploadStudentProfilePicture(
    imageBuffer,
    studentId
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const uniquePublicId =
                `student-${
                    studentId
                }-${
                    Date.now()
                }-${
                    crypto
                        .randomBytes(6)
                        .toString("hex")
                }`;


            const uploadStream =
                cloudinary.uploader
                    .upload_stream(
                        {
                            resource_type:
                                "image",

                            asset_folder:
                                getStudentProfilePictureAssetFolder(
                                    studentId
                                ),

                            public_id:
                                uniquePublicId,

                            overwrite:
                                false,

                            format:
                                "webp",

                            transformation: [
                                {
                                    width:
                                        STUDENT_PROFILE_PICTURE_SIZE,

                                    height:
                                        STUDENT_PROFILE_PICTURE_SIZE,

                                    crop:
                                        "fill",

                                    gravity:
                                        "center"
                                },

                                {
                                    quality:
                                        "auto:good"
                                }
                            ]
                        },

                        (
                            error,
                            result
                        ) => {

                            if (error) {

                                reject(error);
                                return;

                            }


                            resolve(result);

                        }
                    );


            uploadStream.end(
                imageBuffer
            );

        }
    );

}


async function deleteStudentProfilePicture(
    publicId
) {

    const cleanPublicId =
        String(
            publicId || ""
        ).trim();


    if (
        !cleanPublicId ||
        !isCloudinaryConfigured()
    ) {

        return;

    }


    try {

        await cloudinary.uploader
            .destroy(
                cleanPublicId,
                {
                    resource_type:
                        "image",

                    invalidate:
                        true
                }
            );

    } catch (error) {

        console.error(
            "Gagal membersihkan foto profil lama:",
            error
        );

    }

}

// ========================================
// STUDENT PROFILE - DATABASE MIGRATION
// ========================================

let studentProfileColumnsPromise =
    null;


async function initializeStudentProfileColumns() {

    const columnRows =
        await tursoDb.all(`
            PRAGMA table_info(students)
        `);


    if (
        !Array.isArray(columnRows) ||
        columnRows.length === 0
    ) {

        throw new Error(
            "Tabel students tidak ditemukan."
        );

    }


    const columnNames =
        new Set(
            columnRows.map(
                row =>
                    String(
                        row.name
                    )
            )
        );


    const migrations = [

        {
            name:
                "profile_bio",

            sql: `
                ALTER TABLE students
                ADD COLUMN profile_bio
                    TEXT NOT NULL DEFAULT ''
            `
        },

        {
            name:
                "profile_banner_color",

            sql: `
                ALTER TABLE students
                ADD COLUMN profile_banner_color
                    TEXT NOT NULL DEFAULT 'blue'
            `
        },

        {
            name:
                "profile_picture_url",

            sql: `
                ALTER TABLE students
                ADD COLUMN profile_picture_url TEXT
            `
        },

        {
            name:
                "profile_picture_public_id",

            sql: `
                ALTER TABLE students
                ADD COLUMN profile_picture_public_id TEXT
            `
        },

        {
            name:
                "profile_picture_width",

            sql: `
                ALTER TABLE students
                ADD COLUMN profile_picture_width INTEGER
            `
        },

        {
            name:
                "profile_picture_height",

            sql: `
                ALTER TABLE students
                ADD COLUMN profile_picture_height INTEGER
            `
        },

{
    name:
        "profile_picture_bytes",

    sql: `
        ALTER TABLE students
        ADD COLUMN profile_picture_bytes INTEGER
    `
},

{
    name:
        "profile_show_academic_stats",

    sql: `
        ALTER TABLE students
        ADD COLUMN profile_show_academic_stats
            INTEGER NOT NULL DEFAULT 0
    `
}

    ];


    for (
        const migration
        of migrations
    ) {

        if (
            columnNames.has(
                migration.name
            )
        ) {

            continue;

        }


        try {

            await tursoDb.run(
                migration.sql
            );


            columnNames.add(
                migration.name
            );

        } catch (error) {

            /*
                Dua instance server bisa menjalankan
                migrasi bersamaan ketika deploy.
                Duplicate column aman diabaikan.
            */
            if (
                /duplicate column name/i.test(
                    String(
                        error &&
                        error.message ||
                        error
                    )
                )
            ) {

                columnNames.add(
                    migration.name
                );

                continue;

            }


            throw error;

        }

    }

}


async function ensureStudentProfileColumns() {

    if (
        !studentProfileColumnsPromise
    ) {

        studentProfileColumnsPromise =
            initializeStudentProfileColumns()
                .catch(
                    error => {

                        studentProfileColumnsPromise =
                            null;


                        throw error;

                    }
                );

    }


    return studentProfileColumnsPromise;

}


if (
    isProduction &&
    !process.env.SESSION_SECRET
) {

    throw new Error(
        "SESSION_SECRET wajib diatur di production."
    );

}

async function deleteStoredQuizImages(
    publicIds
) {
    const uniquePublicIds =
        [
            ...new Set(
                (
                    Array.isArray(publicIds)
                        ? publicIds
                        : []
                )
                    .map(
                        publicId =>
                            String(
                                publicId || ""
                            ).trim()
                    )
                    .filter(Boolean)
            )
        ];

    if (
        uniquePublicIds.length === 0
    ) {
        return [];
    }

    if (
        !isCloudinaryConfigured()
    ) {
        console.error(
            "Cleanup gambar dilewati karena layanan gambar belum dikonfigurasi."
        );

        return uniquePublicIds;
    }

    const results =
        await Promise.allSettled(
            uniquePublicIds.map(
                publicId =>
                    cloudinary.uploader.destroy(
                        publicId,
                        {
                            resource_type:
                                "image",

                            invalidate:
                                true
                        }
                    )
            )
        );

    const failedPublicIds =
        results
            .map(
                (
                    result,
                    resultIndex
                ) =>
                    result.status ===
                    "rejected"
                        ? uniquePublicIds[
                            resultIndex
                        ]
                        : null
            )
            .filter(Boolean);

    if (
        failedPublicIds.length > 0
    ) {
        console.error(
            "Sebagian gambar lama gagal dibersihkan:",
            failedPublicIds
        );
    }

    return failedPublicIds;
}

const app = express();
const PORT = 3000;

const publicDirectory =
    path.join(
        __dirname,
        "public"
    );


const publicAssetStatic =
    express.static(
        publicDirectory,
        {
            index: false
        }
    );

// ========================================
// STATIC ASSET TANPA SESSION
// ========================================

app.use(
    (req, res, next) => {

        const extension =
            path.extname(
                req.path
            ).toLowerCase();


        const publicAssetExtensions =
            new Set([
                ".css",
                ".js",
                ".png",
                ".jpg",
                ".jpeg",
                ".webp",
                ".svg",
                ".ico",
                ".woff",
                ".woff2"
            ]);


        /*
            HTML sengaja TIDAK termasuk.

            Halaman Admin / Student tetap
            harus melewati session protection.
        */
        if (
            publicAssetExtensions.has(
                extension
            )
        ) {

            return publicAssetStatic(
                req,
                res,
                next
            );

        }


        next();

    }
);


// ========================================
// MIDDLEWARE
// ========================================


// ========================================
// STATIC ASSET TANPA SESSION
// ========================================

app.use(
    (req, res, next) => {

        const extension =
            path.extname(
                req.path
            ).toLowerCase();


        const publicAssetExtensions =
            new Set([
                ".css",
                ".js",
                ".png",
                ".jpg",
                ".jpeg",
                ".webp",
                ".svg",
                ".ico",
                ".woff",
                ".woff2"
            ]);


        /*
            HTML sengaja tidak dimasukkan.
            Halaman Admin / Student tetap
            harus melewati session.
        */
        if (
            publicAssetExtensions.has(
                extension
            )
        ) {

            return publicAssetStatic(
                req,
                res,
                next
            );

        }


        next();

    }
);


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
        "/admin-student-search.html",
        "/admin-points.html",
        "/admin-exam-scores.html",
        "/admin-announcements.html",
        "/admin-announcement.html",
        "/admin-notifications.html",
        "/admin-users.html",

        /*
            ONLINE QUIZ ADMIN
        */
        "/admin-quizzes.html",
        "/admin-quiz-editor.html",
        "/admin-quiz-response.html"
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
        "/student-profile.html",

        /*
            ONLINE QUIZ STUDENT
        */
        "/student-quizzes.html",
        "/student-quiz-attempt.html",
        "/student-quiz-result.html"
    ],
    requireStudentPage
);

// ========================================
// SERVE FILE HTML DARI PUBLIC
// ========================================

/*
    Ditempatkan setelah perlindungan halaman
    Admin dan Student.

    Dengan urutan ini:
    - halaman protected diperiksa session dahulu;
    - index dan login tetap dapat dibuka;
    - file HTML di src/public dapat ditemukan.
*/
app.use(
    express.static(
        publicDirectory
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
// IDENTITAS ADMIN / GURU AKTIF
// ========================================

app.get(
    "/api/admin/me",
    async (req, res) => {

        try {

            const adminId =
                Number(
                    req.session.adminId
                );


            const admin =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            username,
                            name,
                            role

                        FROM admins

                        WHERE id = ?

                        LIMIT 1
                    `,
                    [
                        adminId
                    ]
                );


            if (!admin) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Akun Admin / Guru tidak ditemukan."
                });

            }


            return res.json({

                success: true,

                admin: {

                    id:
                        Number(admin.id),

                    username:
                        admin.username,

                    name:
                        admin.name ||
                        admin.username ||
                        "Admin",

                    role:
                        admin.role ||
                        "admin"

                }

            });

        } catch (error) {

            console.error(
                "Gagal memuat identitas Admin:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Identitas Admin tidak dapat dimuat."
            });

        }

    }
);

// ========================================
// MEDIA GAMBAR - QUIZ
// ========================================

app.post(
    "/api/admin/media/image-upload-signature",
    async (
        req,
        res
    ) => {

        try {

            if (
                !isCloudinaryConfigured()
            ) {

                return res
                    .status(503)
                    .json({
                        success:
                            false,

                        message:
                            "Layanan gambar belum dikonfigurasi."
                    });

            }


            await ensureQuizTables();


            let quizId;


            try {

                quizId =
                    parsePositiveQuizId(
                        req.body &&
                        req.body.quizId,
                        "ID Quiz"
                    );

            } catch (
                validationError
            ) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            validationError.message
                    });

            }


            const existingQuiz =
                await tursoDb.get(
                    `
                        SELECT id

                        FROM quizzes

                        WHERE id = ?

                        LIMIT 1
                    `,
                    [
                        quizId
                    ]
                );


            if (!existingQuiz) {

                return res
                    .status(404)
                    .json({
                        success:
                            false,

                        message:
                            "Quiz tidak ditemukan."
                    });

            }


            const timestamp =
                Math.floor(
                    Date.now() /
                    1000
                );


            const parametersToUpload = {
                timestamp,

                asset_folder:
                    getQuizImageAssetFolder(
                        quizId
                    ),

                upload_preset:
                    CLOUDINARY_UPLOAD_PRESET,

                allowed_formats:
                    QUIZ_IMAGE_ALLOWED_FORMATS,

                transformation:
                    QUIZ_IMAGE_UPLOAD_TRANSFORMATION
            };


            const signature =
                cloudinary.utils
                    .api_sign_request(
                        parametersToUpload,

                        process.env
                            .CLOUDINARY_API_SECRET
                    );


            return res.json({
                success:
                    true,

                uploadUrl:
                    `https://api.cloudinary.com/v1_1/${
                        encodeURIComponent(
                            process.env
                                .CLOUDINARY_CLOUD_NAME
                        )
                    }/image/upload`,

                apiKey:
                    process.env
                        .CLOUDINARY_API_KEY,

                signature,

                parameters:
                    parametersToUpload,

                maxBytes:
                    QUIZ_IMAGE_MAX_BYTES,

                acceptedTypes: [
                    "image/jpeg",
                    "image/png",
                    "image/webp"
                ]
            });

        } catch (error) {

            console.error(
                "Gagal menyiapkan upload gambar:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Gagal menyiapkan upload gambar."
                });

        }

    }
);

// ========================================
// MEDIA GAMBAR - HAPUS
// ========================================

app.delete(
    "/api/admin/media/image",
    async (
        req,
        res
    ) => {

        try {

            if (
                !isCloudinaryConfigured()
            ) {

                return res
                    .status(503)
                    .json({
                        success:
                            false,

                        message:
                            "Layanan gambar belum dikonfigurasi."
                    });

            }


            const publicId =
                String(
                    req.body &&
                    req.body.publicId ||
                    ""
                ).trim();


            if (
                !publicId ||
                publicId.length > 255
            ) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "Identitas gambar tidak valid."
                    });

            }


            await cloudinary.uploader
                .destroy(
                    publicId,
                    {
                        resource_type:
                            "image",

                        invalidate:
                            true
                    }
                );


            return res.json({
                success:
                    true
            });

        } catch (error) {

            console.error(
                "Gagal menghapus gambar:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Gambar tidak dapat dihapus."
                });

        }

    }
);

// ========================================
// ONLINE QUIZ - ADMIN DASHBOARD
// ========================================

app.get(
    "/api/admin/quizzes",
    async (
        req,
        res
    ) => {

        try {

            await ensureQuizTables();


            const quizRows =
                await tursoDb.all(
                    `
                        SELECT
                            quizzes.id,
                            quizzes.title,
                            quizzes.description,
                            quizzes.subject,
                            quizzes.material,
                            quizzes.status,
                            quizzes.due_at,
                            quizzes.created_at,
                            quizzes.updated_at,
                            quizzes.published_at,

                            admins.name
                                AS creator_name,

                            (
                                SELECT COUNT(*)

                                FROM quiz_questions

                                WHERE
                                    quiz_questions.quiz_id =
                                        quizzes.id
                            )
                                AS question_count,

(
    (
        SELECT COUNT(*)

        FROM quiz_attempts

        WHERE
            quiz_attempts.quiz_id =
                quizzes.id
    )

    +

    (
        SELECT COUNT(*)

        FROM quiz_guest_attempts

        WHERE
            quiz_guest_attempts.quiz_id =
                quizzes.id
    )
)
    AS response_count

                        FROM quizzes

                        LEFT JOIN admins
                            ON admins.id =
                                quizzes.created_by

                        ORDER BY

                            /*
                                Draft selalu berada paling atas.
                            */
                            CASE
                                WHEN quizzes.status =
                                    'draft'
                                    THEN 0

                                WHEN quizzes.status =
                                    'published'
                                    THEN 1

                                ELSE 2
                            END ASC,

                            /*
                                Published yang mempunyai deadline
                                terdekat berada lebih atas.
                            */
                            CASE
                                WHEN quizzes.status =
                                    'published'
                                    AND quizzes.due_at
                                        IS NOT NULL
                                    THEN 0

                                ELSE 1
                            END ASC,

                            quizzes.due_at ASC,

                            quizzes.updated_at DESC,

                            quizzes.id DESC
                    `
                );


            const quizzes =
                quizRows.map(
                    (
                        quizRow
                    ) => ({

                        id:
                            Number(
                                quizRow.id
                            ),

                        title:
                            quizRow.title,

                        description:
                            quizRow.description,

                        subject:
                            quizRow.subject,

                        material:
                            quizRow.material,

                        status:
                            quizRow.status,

                        dueAt:
                            quizRow.due_at,

                        createdAt:
                            quizRow.created_at,

                        updatedAt:
                            quizRow.updated_at,

                        publishedAt:
                            quizRow.published_at,

                        creatorName:
                            quizRow.creator_name,

                        questionCount:
                            Number(
                                quizRow.question_count ||
                                0
                            ),

                        responseCount:
                            Number(
                                quizRow.response_count ||
                                0
                            )

                    })
                );


            return res.json({
                success:
                    true,

                quizzes
            });

        } catch (error) {

            console.error(
                "Gagal mengambil dashboard Quiz Admin:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Gagal mengambil daftar Quiz."
                });

        }

    }
);

app.post(
    "/api/admin/quizzes",
    async (
        req,
        res
    ) => {

        try {

            await ensureQuizTables();


            const adminId =
                Number(
                    req.session.adminId
                );


            if (
                !Number.isInteger(
                    adminId
                ) ||
                adminId <= 0
            ) {

                return res
                    .status(401)
                    .json({
                        success:
                            false,

                        message:
                            "Session Admin tidak valid."
                    });

            }


            /*
                Draft langsung dibuat agar editor
                memperoleh ID authoritative.
            */
            const result =
                await tursoDb.run(
                    `
                        INSERT INTO quizzes (
                            title,
                            status,
                            created_by,
                            updated_at
                        )

                        VALUES (
                            'Quiz Tanpa Judul',
                            'draft',
                            ?,
                            CURRENT_TIMESTAMP
                        )
                    `,
                    [
                        adminId
                    ]
                );


            const quizId =
                Number(
                    result.lastInsertRowid
                );


            if (
                !Number.isInteger(
                    quizId
                ) ||
                quizId <= 0
            ) {

                throw new Error(
                    "ID Quiz baru tidak ditemukan."
                );

            }


            return res
                .status(201)
                .json({
                    success:
                        true,

                    quizId,

                    message:
                        "Draft Quiz berhasil dibuat."
                });

        } catch (error) {

            console.error(
                "Gagal membuat draft Quiz:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Gagal membuat Quiz baru."
                });

        }

    }
);

app.get(
    "/api/admin/quizzes/:quizId",
    async (
        req,
        res
    ) => {

        try {

            await ensureQuizTables();


            let quizId;


            try {

                quizId =
                    parsePositiveQuizId(
                        req.params.quizId,
                        "ID Quiz"
                    );

            } catch (validationError) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            validationError.message
                    });

            }


            /*
                true berarti kunci jawaban boleh
                disertakan karena endpoint ini
                sudah dilindungi session Admin.
            */
            const quiz =
                await getQuizWithQuestions(
                    quizId,
                    true
                );


            if (!quiz) {

                return res
                    .status(404)
                    .json({
                        success:
                            false,

                        message:
                            "Quiz tidak ditemukan."
                    });

            }


            return res.json({
                success:
                    true,

                quiz
            });

        } catch (error) {

            console.error(
                "Gagal membuka Quiz Admin:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Gagal membuka Quiz."
                });

        }

    }
);

// ========================================
// ONLINE QUIZ - AUTOSAVE EDITOR
// ========================================

app.put(
    "/api/admin/quizzes/:quizId",
    async (
        req,
        res
    ) => {

        try {

            await ensureQuizTables();


            let quizId;


            try {

                quizId =
                    parsePositiveQuizId(
                        req.params.quizId,
                        "ID Quiz"
                    );

            } catch (validationError) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            validationError.message
                    });

            }


            const existingQuiz =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            status,

(
    (
        SELECT COUNT(*)

        FROM quiz_attempts

        WHERE
            quiz_attempts.quiz_id =
                quizzes.id
    )

    +

    (
        SELECT COUNT(*)

        FROM quiz_guest_attempts

        WHERE
            quiz_guest_attempts.quiz_id =
                quizzes.id
    )
)
    AS response_count

                        FROM quizzes

                        WHERE
                            id = ?
                    `,
                    [
                        quizId
                    ]
                );


            if (!existingQuiz) {

                return res
                    .status(404)
                    .json({
                        success:
                            false,

                        message:
                            "Quiz tidak ditemukan."
                    });

            }


            let metadata;


            try {

                metadata =
                    cleanQuizMetadata(
                        req.body
                    );

            } catch (validationError) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            validationError.message
                    });

            }


            /*
                Jika body tidak mempunyai array
                questions, request hanya mengubah
                metadata.

                Ini digunakan setelah Quiz sudah
                mempunyai responden.
            */
            const hasQuestionPayload =
                Array.isArray(
                    req.body &&
                    req.body.questions
                );


            const responseCount =
                Number(
                    existingQuiz.response_count ||
                    0
                );


            /*
                Setelah ada respons, struktur soal
                tidak boleh diganti.

                Metadata seperti judul, mapel,
                materi, dan deadline masih boleh.
            */
            if (
                responseCount > 0 &&
                hasQuestionPayload
            ) {

                return res
                    .status(409)
                    .json({
                        success:
                            false,

                        code:
                            "QUIZ_STRUCTURE_LOCKED",

                        message:
                            "Struktur Quiz dikunci karena sudah memiliki respons."
                    });

            }


            /*
                AUTOSAVE METADATA SAJA
            */
            if (!hasQuestionPayload) {

                await tursoDb.run(
                    `
                        UPDATE quizzes

                        SET
                            title = ?,
                            description = ?,
                            subject = ?,
                            material = ?,
                            due_at = ?,
                            updated_at =
                                CURRENT_TIMESTAMP

                        WHERE
                            id = ?
                    `,
                    [
                        metadata.title,
                        metadata.description,
                        metadata.subject,
                        metadata.material,
                        metadata.dueAt,
                        quizId
                    ]
                );


                return res.json({
                    success:
                        true,

                    structureLocked:
                        responseCount > 0,

                    updatedAt:
                        new Date()
                            .toISOString()
                });

            }


            /*
                Autosave draft memakai strict=false.

                Pertanyaan atau pilihan yang belum
                selesai tetap boleh disimpan.

                Validasi lengkap baru dijalankan
                ketika Admin menekan Publish.
            */
            let questions;


            try {

                questions =
                    validateQuizQuestions(
                        req.body.questions,
                        false
                    );

            } catch (validationError) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            validationError.message
                    });

            }


 /*
    Ambil susunan soal yang sekarang untuk
    mendeteksi tambah, hapus, dan perpindahan.
*/
const existingQuestionRows =
    await tursoDb.all(
        `
SELECT
    id,
    client_key,
    position,
    image_public_id

FROM quiz_questions

            WHERE quiz_id = ?

            ORDER BY position ASC
        `,
        [
            quizId
        ]
    );


const incomingClientKeys =
    questions.map(
        question =>
            question.clientKey
    );

const incomingImagePublicIds =
    new Set(
        questions
            .map(
                question =>
                    String(
                        question.imagePublicId ||
                        ""
                    ).trim()
            )
            .filter(Boolean)
    );


const obsoleteImagePublicIds =
    [
        ...new Set(
            existingQuestionRows
                .map(
                    row =>
                        String(
                            row.image_public_id ||
                            ""
                        ).trim()
                )
                .filter(
                    publicId =>
                        publicId &&
                        !incomingImagePublicIds
                            .has(
                                publicId
                            )
                )
        )
    ];


const existingPositionMap =
    new Map(
        existingQuestionRows.map(
            row => [
                String(
                    row.client_key
                ),
                Number(
                    row.position
                )
            ]
        )
    );


const structureChanged =
    existingQuestionRows.length !==
        questions.length ||

    questions.some(
        (
            question,
            questionIndex
        ) =>
            existingPositionMap.get(
                question.clientKey
            ) !==
                questionIndex + 1
    );


const statements = [

    /*
        Metadata hanya satu row.
    */
    {
        sql: `
            UPDATE quizzes

            SET
                title = ?,
                description = ?,
                subject = ?,
                material = ?,
                due_at = ?,
                updated_at =
                    CURRENT_TIMESTAMP

            WHERE id = ?
        `,

        args: [
            metadata.title,
            metadata.description,
            metadata.subject,
            metadata.material,
            metadata.dueAt,
            quizId
        ]
    }

];


/*
    Hapus hanya soal yang sudah tidak ada
    pada payload editor.
*/
if (incomingClientKeys.length === 0) {

    statements.push(
        {
            sql: `
                DELETE FROM quiz_options

                WHERE question_id IN (
                    SELECT id
                    FROM quiz_questions
                    WHERE quiz_id = ?
                )
            `,

            args: [
                quizId
            ]
        },

        {
            sql: `
                DELETE FROM quiz_questions
                WHERE quiz_id = ?
            `,

            args: [
                quizId
            ]
        }
    );

} else {

    const clientKeyPlaceholders =
        incomingClientKeys
            .map(() => "?")
            .join(", ");


    statements.push(
        {
            sql: `
                DELETE FROM quiz_options

                WHERE question_id IN (

                    SELECT id
                    FROM quiz_questions

                    WHERE
                        quiz_id = ?

                    AND client_key
                        NOT IN (
                            ${clientKeyPlaceholders}
                        )
                )
            `,

            args: [
                quizId,
                ...incomingClientKeys
            ]
        },

        {
            sql: `
                DELETE FROM quiz_questions

                WHERE
                    quiz_id = ?

                AND client_key
                    NOT IN (
                        ${clientKeyPlaceholders}
                    )
            `,

            args: [
                quizId,
                ...incomingClientKeys
            ]
        }
    );

}


/*
    Posisi dipindahkan sementara ke angka
    negatif hanya saat urutannya berubah.

    Ini mencegah konflik UNIQUE(quiz_id, position)
    ketika dua soal bertukar posisi.
*/
if (
    structureChanged &&
    existingQuestionRows.length > 0
) {

    statements.push({
        sql: `
            UPDATE quiz_questions

            SET position = -id

            WHERE quiz_id = ?
        `,

        args: [
            quizId
        ]
    });

}


questions.forEach(
    (
        question,
        questionIndex
    ) => {

        const position =
            questionIndex + 1;


        /*
            INSERT jika soal baru.

            Jika client_key sudah ada, UPDATE hanya
            dilakukan saat isi atau posisinya memang
            berbeda. Soal yang sama menghasilkan
            nol row write.
        */
statements.push({
    sql: `
        INSERT INTO quiz_questions (
            quiz_id,
            client_key,
            question_type,
            question_text,
            correct_text_answer,
            image_url,
            image_public_id,
            image_width,
            image_height,
            image_bytes,
            position
        )

        VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?
        )

        ON CONFLICT (
            quiz_id,
            client_key
        )

        DO UPDATE SET
            question_type =
                excluded.question_type,

            question_text =
                excluded.question_text,

            correct_text_answer =
                excluded.correct_text_answer,

            image_url =
                excluded.image_url,

            image_public_id =
                excluded.image_public_id,

            image_width =
                excluded.image_width,

            image_height =
                excluded.image_height,

            image_bytes =
                excluded.image_bytes,

            position =
                excluded.position,

            updated_at =
                CURRENT_TIMESTAMP

        WHERE
            quiz_questions.question_type
                IS NOT excluded.question_type

            OR quiz_questions.question_text
                IS NOT excluded.question_text

            OR quiz_questions.correct_text_answer
                IS NOT excluded.correct_text_answer

            OR quiz_questions.image_url
                IS NOT excluded.image_url

            OR quiz_questions.image_public_id
                IS NOT excluded.image_public_id

            OR quiz_questions.image_width
                IS NOT excluded.image_width

            OR quiz_questions.image_height
                IS NOT excluded.image_height

            OR quiz_questions.image_bytes
                IS NOT excluded.image_bytes

            OR quiz_questions.position
                IS NOT excluded.position
    `,

    args: [
        quizId,
        question.clientKey,
        question.type,
        question.text,
        question.correctText,
        question.imageUrl,
        question.imagePublicId,
        question.imageWidth,
        question.imageHeight,
        question.imageBytes,
        position
    ]
});


        if (
            question.type ===
                "short_answer"
        ) {

            /*
                Bila MCQ diubah menjadi Esai,
                hapus pilihan lamanya saja.
            */
            statements.push({
                sql: `
                    DELETE FROM quiz_options

                    WHERE question_id = (

                        SELECT id
                        FROM quiz_questions

                        WHERE
                            quiz_id = ?
                            AND client_key = ?
                    )
                `,

                args: [
                    quizId,
                    question.clientKey
                ]
            });


            return;

        }


        question.options.forEach(
            (
                option,
                optionIndex
            ) => {

                /*
                    Pilihan juga memakai UPSERT
                    bersyarat. Pilihan yang tidak
                    berubah menghasilkan nol write.
                */
                statements.push({
                    sql: `
                        INSERT INTO quiz_options (
                            question_id,
                            option_text,
                            position,
                            is_correct
                        )

                        SELECT
                            id,
                            ?,
                            ?,
                            ?

                        FROM quiz_questions

                        WHERE
                            quiz_id = ?
                            AND client_key = ?

                        ON CONFLICT (
                            question_id,
                            position
                        )

                        DO UPDATE SET
                            option_text =
                                excluded.option_text,

                            is_correct =
                                excluded.is_correct

                        WHERE
                            quiz_options.option_text
                                IS NOT excluded.option_text

                            OR quiz_options.is_correct
                                IS NOT excluded.is_correct
                    `,

                    args: [
                        option.text,
                        optionIndex + 1,

                        option.isCorrect
                            ? 1
                            : 0,

                        quizId,
                        question.clientKey
                    ]
                });

            }
        );

    }
);


await tursoDb.batch(
    statements,
    "immediate"
);

/*
    Database sudah berhasil disimpan.
    Cleanup tidak boleh menggagalkan autosave.
*/
try {
    await deleteStoredQuizImages(
        obsoleteImagePublicIds
    );
} catch (cleanupError) {
    console.error(
        "Gagal membersihkan gambar lama:",
        cleanupError
    );
}


            return res.json({
                success:
                    true,

                structureLocked:
                    false,

                questionCount:
                    questions.length,

                updatedAt:
                    new Date()
                        .toISOString()
            });

        } catch (error) {

            console.error(
                "Gagal autosave Quiz:",
                error
            );


            /*
                Constraint database biasanya berarti
                clientKey atau posisi mengalami
                duplikasi yang tidak valid.
            */
            const errorMessage =
                String(
                    error &&
                    error.message ||
                    ""
                );


            if (
                errorMessage.includes(
                    "UNIQUE"
                ) ||
                errorMessage.includes(
                    "constraint"
                )
            ) {

                return res
                    .status(409)
                    .json({
                        success:
                            false,

                        message:
                            "Susunan soal mengalami konflik. Muat ulang editor lalu coba lagi."
                    });

            }


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Gagal menyimpan perubahan Quiz."
                });

        }

    }
);

// ========================================
// ONLINE QUIZ - SAVE SETTINGS
// ========================================

app.patch(
    "/api/admin/quizzes/:quizId/settings",
    async (
        req,
        res
    ) => {

        if (!req.session.adminId) {

            return res.status(401).json({
                success: false,
                message:
                    "Harus login sebagai Admin / Guru."
            });

        }


        try {

            await ensureQuizTables();


            let quizId;


            try {

                quizId =
                    parsePositiveQuizId(
                        req.params.quizId,
                        "ID Quiz"
                    );

            } catch (validationError) {

                return res.status(400).json({
                    success: false,
                    message:
                        validationError.message
                });

            }


            const existingQuiz =
                await tursoDb.get(
                    `
                        SELECT
                            quizzes.id,
                            quizzes.public_token,

(
    (
        SELECT COUNT(*)

        FROM quiz_attempts

        WHERE
            quiz_attempts.quiz_id =
                quizzes.id
    )

    +

    (
        SELECT COUNT(*)

        FROM quiz_guest_attempts

        WHERE
            quiz_guest_attempts.quiz_id =
                quizzes.id
    )
)
    AS response_count

                        FROM quizzes

                        WHERE quizzes.id = ?
                    `,
                    [
                        quizId
                    ]
                );


            if (!existingQuiz) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Quiz tidak ditemukan."
                });

            }


            /*
                Bobot dan target tidak boleh berubah
                setelah nilai responden tersimpan.
            */
            if (
                Number(
                    existingQuiz.response_count ||
                    0
                ) > 0
            ) {

                return res.status(409).json({
                    success: false,
                    code:
                        "QUIZ_SETTINGS_LOCKED",

                    message:
                        "Settings dikunci karena Quiz sudah memiliki responden."
                });

            }


            let settings;


            try {

                settings =
                    cleanQuizSettings(
                        req.body
                    );

            } catch (validationError) {

                return res.status(400).json({
                    success: false,
                    message:
                        validationError.message
                });

            }


            /*
                Pastikan seluruh ID siswa benar-benar
                tersedia di database.
            */
            if (
                settings.selectedStudentIds
                    .length > 0
            ) {

                const placeholders =
                    settings.selectedStudentIds
                        .map(() => "?")
                        .join(", ");


                const validStudentRows =
                    await tursoDb.all(
                        `
                            SELECT id

                            FROM students

                            WHERE id IN (
                                ${placeholders}
                            )
                        `,
                        settings.selectedStudentIds
                    );


                if (
                    validStudentRows.length !==
                    settings.selectedStudentIds
                        .length
                ) {

                    return res.status(400).json({
                        success: false,
                        message:
                            "Salah satu siswa yang dipilih tidak valid."
                    });

                }

            }


            let publicToken =
                existingQuiz.public_token;


            /*
                Token dibuat sekali lalu dipertahankan
                jika Public dimatikan dan diaktifkan lagi.
            */
            if (
                settings.allowPublic &&
                !publicToken
            ) {

                publicToken =
                    generatePublicQuizToken();

            }


            const currentTargetRows =
                await tursoDb.all(
                    `
                        SELECT student_id

                        FROM quiz_allowed_students

                        WHERE quiz_id = ?
                    `,
                    [
                        quizId
                    ]
                );


            const currentTargetIds =
                new Set(
                    currentTargetRows.map(
                        row =>
                            Number(
                                row.student_id
                            )
                    )
                );


            const desiredTargetIds =
                new Set(
                    settings.privateAudience ===
                        "selected"
                        ? settings.selectedStudentIds
                        : []
                );


            const statements = [

                {
                    sql: `
                        UPDATE quizzes

                        SET
                            use_type_weights = ?,
                            essay_weight = ?,
                            allow_private = ?,
                            allow_public = ?,
                            private_audience = ?,
                            public_token = ?,
                            updated_at =
                                CURRENT_TIMESTAMP

                        WHERE id = ?
                    `,

                    args: [
                        settings.useTypeWeights
                            ? 1
                            : 0,

                        settings.essayWeight,

                        settings.allowPrivate
                            ? 1
                            : 0,

                        settings.allowPublic
                            ? 1
                            : 0,

                        settings.privateAudience,
                        publicToken,
                        quizId
                    ]
                }

            ];


            /*
                Hapus hanya target yang dilepas.
            */
            currentTargetIds.forEach(
                studentId => {

                    if (
                        desiredTargetIds.has(
                            studentId
                        )
                    ) {

                        return;

                    }


                    statements.push({
                        sql: `
                            DELETE FROM
                                quiz_allowed_students

                            WHERE
                                quiz_id = ?
                                AND student_id = ?
                        `,

                        args: [
                            quizId,
                            studentId
                        ]
                    });

                }
            );


            /*
                Tambahkan hanya target yang baru.
            */
            desiredTargetIds.forEach(
                studentId => {

                    if (
                        currentTargetIds.has(
                            studentId
                        )
                    ) {

                        return;

                    }


                    statements.push({
                        sql: `
                            INSERT INTO
                                quiz_allowed_students
                            (
                                quiz_id,
                                student_id
                            )

                            VALUES (?, ?)
                        `,

                        args: [
                            quizId,
                            studentId
                        ]
                    });

                }
            );


            await tursoDb.batch(
                statements,
                "immediate"
            );


            return res.json({

                success: true,

                message:
                    "Settings Quiz berhasil disimpan.",

                settings: {

                    ...settings,

                    publicToken,

                    publicUrl:
                        settings.allowPublic
                            ? `/public-quiz.html?token=${publicToken}`
                            : null

                }

            });


        } catch (error) {

            console.error(
                "Gagal menyimpan Settings Quiz:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal menyimpan Settings Quiz."
            });

        }

    }
);

// ========================================
// ONLINE QUIZ - PUBLISH
// ========================================

app.post(
    "/api/admin/quizzes/:quizId/publish",
    async (
        req,
        res
    ) => {

        try {

            await ensureQuizTables();


            let quizId;


            try {

                quizId =
                    parsePositiveQuizId(
                        req.params.quizId,
                        "ID Quiz"
                    );

            } catch (validationError) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            validationError.message
                    });

            }


            /*
                Admin memerlukan kunci jawaban
                untuk validasi publish.
            */
            const quiz =
                await getQuizWithQuestions(
                    quizId,
                    true
                );


            if (!quiz) {

                return res
                    .status(404)
                    .json({
                        success:
                            false,

                        message:
                            "Quiz tidak ditemukan."
                    });

            }


            /*
                Judul bawaan dianggap belum selesai.
            */
            if (
                !quiz.title ||
                !quiz.title.trim() ||
                quiz.title.trim() ===
                    "Quiz Tanpa Judul"
            ) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "Ganti nama Quiz sebelum dipublikasikan."
                    });

            }


            if (
                quiz.questions.length ===
                0
            ) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "Tambahkan minimal satu soal sebelum Publish."
                    });

            }


            /*
                Ubah bentuk data dari database ke
                bentuk yang digunakan validator.
            */
            const questionsForValidation =
                quiz.questions.map(
                    (
                        question
                    ) => ({

                        clientKey:
                            question.clientKey,

                        type:
                            question.type,

                        text:
                            question.text,

                        correctText:
                            question.correctText ||
                            "",

                        options:
                            question.options.map(
                                (
                                    option
                                ) => ({

                                    text:
                                        option.text,

                                    isCorrect:
                                        Boolean(
                                            option.isCorrect
                                        )

                                })
                            )

                    })
                );


            try {

                /*
                    strict=true:
                    seluruh pertanyaan, pilihan,
                    dan kunci wajib lengkap.
                */
                validateQuizQuestions(
                    questionsForValidation,
                    true
                );

            } catch (validationError) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            validationError.message
                    });

            }


            /*
                Deadline harus berada di masa depan
                ketika Quiz dipublikasikan.
            */
            if (quiz.dueAt) {

                const dueTimestamp =
                    new Date(
                        quiz.dueAt
                    ).getTime();


                if (
                    Number.isNaN(
                        dueTimestamp
                    ) ||
                    dueTimestamp <=
                        Date.now()
                ) {

                    return res
                        .status(400)
                        .json({
                            success:
                                false,

                            message:
                                "Deadline harus berada di masa depan."
                        });

                }

            }


            await tursoDb.run(
                `
                    UPDATE quizzes

                    SET
                        status =
                            'published',

                        /*
                            Publish pertama menyimpan
                            waktu. Publish ulang tidak
                            mengubah waktu awal.
                        */
                        published_at =
                            COALESCE(
                                published_at,
                                CURRENT_TIMESTAMP
                            ),

                        updated_at =
                            CURRENT_TIMESTAMP

                    WHERE
                        id = ?
                `,
                [
                    quizId
                ]
            );


            return res.json({
                success:
                    true,

                status:
                    "published",

                message:
                    "Quiz berhasil dipublikasikan."
            });

        } catch (error) {

            console.error(
                "Gagal Publish Quiz:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Gagal memublikasikan Quiz."
                });

        }

    }
);

// ========================================
// ONLINE QUIZ - CLOSE
// ========================================

app.post(
    "/api/admin/quizzes/:quizId/close",
    async (
        req,
        res
    ) => {

        try {

            await ensureQuizTables();


            let quizId;


            try {

                quizId =
                    parsePositiveQuizId(
                        req.params.quizId,
                        "ID Quiz"
                    );

            } catch (validationError) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            validationError.message
                    });

            }


            const quiz =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            status

                        FROM quizzes

                        WHERE
                            id = ?
                    `,
                    [
                        quizId
                    ]
                );


            if (!quiz) {

                return res
                    .status(404)
                    .json({
                        success:
                            false,

                        message:
                            "Quiz tidak ditemukan."
                    });

            }


            if (
                quiz.status ===
                "closed"
            ) {

                return res.json({
                    success:
                        true,

                    status:
                        "closed",

                    message:
                        "Quiz sudah ditutup."
                });

            }


            await tursoDb.run(
                `
                    UPDATE quizzes

                    SET
                        status =
                            'closed',

                        updated_at =
                            CURRENT_TIMESTAMP

                    WHERE
                        id = ?
                `,
                [
                    quizId
                ]
            );


            return res.json({
                success:
                    true,

                status:
                    "closed",

                message:
                    "Quiz berhasil ditutup."
            });

        } catch (error) {

            console.error(
                "Gagal menutup Quiz:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Gagal menutup Quiz."
                });

        }

    }
);

// ========================================
// ONLINE QUIZ - DELETE
// ========================================

app.delete(
    "/api/admin/quizzes/:quizId",
    async (
        req,
        res
    ) => {

        try {

            await ensureQuizTables();


            let quizId;


            try {

                quizId =
                    parsePositiveQuizId(
                        req.params.quizId,
                        "ID Quiz"
                    );

            } catch (validationError) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            validationError.message
                    });

            }


            const quiz =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            title

                        FROM quizzes

                        WHERE
                            id = ?
                    `,
                    [
                        quizId
                    ]
                );


            if (!quiz) {

                return res
                    .status(404)
                    .json({
                        success:
                            false,

                        message:
                            "Quiz tidak ditemukan."
                    });

            }

/*
    Simpan seluruh identitas gambar sebelum
    pertanyaan Quiz dihapus dari database.
*/
const quizImageRows =
    await tursoDb.all(
        `
            SELECT DISTINCT
                image_public_id

            FROM quiz_questions

            WHERE
                quiz_id = ?

                AND image_public_id
                    IS NOT NULL

                AND TRIM(
                    image_public_id
                ) <> ''
        `,
        [
            quizId
        ]
    );


const quizImagePublicIds =
    quizImageRows.map(
        row =>
            String(
                row.image_public_id ||
                ""
            ).trim()
    ).filter(Boolean);


            /*
                Semua data dihapus dalam satu
                transaction.

                Penghapusan eksplisit tetap dipakai
                agar aman meskipun foreign_keys
                pada salah satu koneksi tidak aktif.
            */
            await tursoDb.batch(
                [

                    /*
                        Jawaban milik semua attempt
                        pada Quiz tersebut.
                    */
                    {
                        sql: `
                            DELETE FROM quiz_answers

                            WHERE
                                attempt_id IN (
                                    SELECT
                                        id

                                    FROM quiz_attempts

                                    WHERE
                                        quiz_id = ?
                                )
                        `,

                        args: [
                            quizId
                        ]
                    },


                    /*
                        Jawaban yang merujuk langsung
                        pada pertanyaan Quiz.
                    */
                    {
                        sql: `
                            DELETE FROM quiz_answers

                            WHERE
                                question_id IN (
                                    SELECT
                                        id

                                    FROM quiz_questions

                                    WHERE
                                        quiz_id = ?
                                )
                        `,

                        args: [
                            quizId
                        ]
                    },


                    {
                        sql: `
                            DELETE FROM quiz_attempts

                            WHERE
                                quiz_id = ?
                        `,

                        args: [
                            quizId
                        ]
                    },


                    {
                        sql: `
                            DELETE FROM quiz_options

                            WHERE
                                question_id IN (
                                    SELECT
                                        id

                                    FROM quiz_questions

                                    WHERE
                                        quiz_id = ?
                                )
                        `,

                        args: [
                            quizId
                        ]
                    },


                    {
                        sql: `
                            DELETE FROM quiz_questions

                            WHERE
                                quiz_id = ?
                        `,

                        args: [
                            quizId
                        ]
                    },


                    {
                        sql: `
                            DELETE FROM quizzes

                            WHERE
                                id = ?
                        `,

                        args: [
                            quizId
                        ]
                    }

                ],
                "immediate"
            );

            /*
    Quiz sudah terhapus dari database.
    Kegagalan cleanup gambar tidak boleh
    mengubah hasil penghapusan Quiz.
*/
try {
    await deleteStoredQuizImages(
        quizImagePublicIds
    );
} catch (cleanupError) {
    console.error(
        "Gagal membersihkan gambar Quiz:",
        cleanupError
    );
}


            return res.json({
                success:
                    true,

                deletedQuizId:
                    quizId,

                deletedTitle:
                    quiz.title,

                message:
                    "Quiz berhasil dihapus."
            });

        } catch (error) {

            console.error(
                "Gagal menghapus Quiz:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Gagal menghapus Quiz."
                });

        }

    }
);

// ========================================
// ONLINE QUIZ - PUBLIC GUEST OPEN
// ========================================

app.get(
    "/api/public/quizzes/:token",
    async (
        req,
        res
    ) => {

        try {

            await ensureQuizTables();


            let publicToken;


            try {

                publicToken =
                    parsePublicQuizToken(
                        req.params.token
                    );

            } catch (validationError) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        code:
                            "INVALID_PUBLIC_QUIZ_TOKEN",

                        message:
                            validationError.message
                    });

            }


            /*
                Cari ID melalui token dahulu.

                allow_public wajib aktif sehingga
                token lama tidak dapat digunakan jika
                Guru mematikan akses Public.
            */
            const publicQuizRow =
                await tursoDb.get(
                    `
                        SELECT
                            id

                        FROM quizzes

                        WHERE
                            public_token = ?

                            AND
                            COALESCE(
                                allow_public,
                                0
                            ) = 1

                        LIMIT 1
                    `,
                    [
                        publicToken
                    ]
                );


            if (!publicQuizRow) {

                return res
                    .status(404)
                    .json({
                        success:
                            false,

                        code:
                            "PUBLIC_QUIZ_NOT_FOUND",

                        message:
                            "Public Quiz tidak ditemukan."
                    });

            }


            /*
                false memastikan Guest tidak pernah
                menerima kunci jawaban.
            */
            const quiz =
                await getQuizWithQuestions(
                    Number(
                        publicQuizRow.id
                    ),
                    false
                );


            const availabilityError =
                getPublicQuizAvailabilityError(
                    quiz
                );


            if (availabilityError) {

                /*
                    Metadata dan pertanyaan tanpa kunci
                    tetap dikirim agar frontend dapat
                    menampilkan halaman di belakang
                    panel warning yang diblur.
                */
                return res
                    .status(
                        availabilityError.status
                    )
                    .json({
                        success:
                            false,

                        code:
                            availabilityError.code,

                        message:
                            availabilityError.message,

                        serverNow:
                            new Date()
                                .toISOString(),

                        quiz
                    });

            }


            return res.json({
                success:
                    true,

                guest:
                    true,

                warning:
                    "Kamu mengerjakan Quiz sebagai Guest. Jawaban tidak mempunyai fitur autosave.",

                serverNow:
                    new Date()
                        .toISOString(),

                quiz
            });

        } catch (error) {

            console.error(
                "Gagal membuka Public Quiz:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    code:
                        "PUBLIC_QUIZ_OPEN_FAILED",

                    message:
                        "Gagal membuka Public Quiz."
                });

        }

    }
);

// ========================================
// ONLINE QUIZ - PUBLIC GUEST SUBMIT
// ========================================

app.post(
    "/api/public/quizzes/:token/submit",
    async (
        req,
        res
    ) => {

        try {

            await ensureQuizTables();


            let publicToken;
            let guestName;


            try {

                publicToken =
                    parsePublicQuizToken(
                        req.params.token
                    );


                guestName =
                    cleanGuestQuizName(
                        req.body &&
                        req.body.name
                    );

            } catch (validationError) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        code:
                            "INVALID_PUBLIC_SUBMISSION",

                        message:
                            validationError.message
                    });

            }


            const publicQuizRow =
                await tursoDb.get(
                    `
                        SELECT
                            id

                        FROM quizzes

                        WHERE
                            public_token = ?

                            AND
                            COALESCE(
                                allow_public,
                                0
                            ) = 1

                        LIMIT 1
                    `,
                    [
                        publicToken
                    ]
                );


            if (!publicQuizRow) {

                return res
                    .status(404)
                    .json({
                        success:
                            false,

                        code:
                            "PUBLIC_QUIZ_NOT_FOUND",

                        message:
                            "Public Quiz tidak ditemukan."
                    });

            }


            /*
                true diperlukan karena backend
                membutuhkan kunci untuk penilaian.

                Data quiz dengan kunci tidak pernah
                dikirim kembali ke Guest.
            */
            const quiz =
                await getQuizWithQuestions(
                    Number(
                        publicQuizRow.id
                    ),
                    true
                );


            const availabilityError =
                getPublicQuizAvailabilityError(
                    quiz
                );


            if (availabilityError) {

                return res
                    .status(
                        availabilityError.status
                    )
                    .json({
                        success:
                            false,

                        code:
                            availabilityError.code,

                        message:
                            availabilityError.message
                    });

            }


            const grading =
                gradePublicQuizAnswers(
                    quiz,

                    req.body &&
                    Array.isArray(
                        req.body.answers
                    )
                        ? req.body.answers
                        : []
                );


            /*
                Key dibuat server dan digunakan untuk
                menemukan attempt yang baru dibuat
                di dalam transaction batch.
            */
            const submissionKey =
                crypto
                    .randomBytes(24)
                    .toString(
                        "base64url"
                    );


            const statements = [

                {
                    sql: `
                        INSERT INTO
                            quiz_guest_attempts (
                                quiz_id,
                                submission_key,
                                guest_name,
                                correct_count,
                                total_questions,
                                score,
                                submitted_at
                            )

                        VALUES (
                            ?,
                            ?,
                            ?,
                            ?,
                            ?,
                            ?,
                            CURRENT_TIMESTAMP
                        )
                    `,

                    args: [
                        Number(
                            quiz.id
                        ),

                        submissionKey,

                        guestName,

                        grading.correctCount,

                        grading.totalQuestions,

                        grading.score
                    ]
                }

            ];


            grading.gradedAnswers.forEach(
                answer => {

                    statements.push({
                        sql: `
                            INSERT INTO
                                quiz_guest_answers (
                                    guest_attempt_id,
                                    question_id,
                                    selected_option_id,
                                    text_answer,
                                    is_correct
                                )

                            SELECT
                                quiz_guest_attempts.id,
                                ?,
                                ?,
                                ?,
                                ?

                            FROM quiz_guest_attempts

                            WHERE
                                quiz_guest_attempts.submission_key =
                                    ?
                        `,

                        args: [
                            answer.questionId,

                            answer.selectedOptionId,

                            answer.textAnswer,

                            answer.isCorrect
                                ? 1
                                : 0,

                            submissionKey
                        ]
                    });

                }
            );


            await tursoDb.batch(
                statements,
                "immediate"
            );


            const savedAttempt =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            guest_name,
                            correct_count,
                            total_questions,
                            score,
                            submitted_at

                        FROM quiz_guest_attempts

                        WHERE
                            submission_key = ?

                        LIMIT 1
                    `,
                    [
                        submissionKey
                    ]
                );


            if (!savedAttempt) {

                throw new Error(
                    "Submission Guest tersimpan tetapi tidak dapat dibaca kembali."
                );

            }


            return res
                .status(201)
                .json({
                    success:
                        true,

                    guest:
                        true,

                    message:
                        "Jawaban Guest berhasil dikirim.",

                    result: {
                        attemptId:
                            Number(
                                savedAttempt.id
                            ),

                        name:
                            savedAttempt.guest_name,

                        role:
                            "GUEST",

                        quizId:
                            Number(
                                quiz.id
                            ),

                        quizTitle:
                            quiz.title,

                        correctCount:
                            Number(
                                savedAttempt.correct_count
                            ),

                        totalQuestions:
                            Number(
                                savedAttempt.total_questions
                            ),

                        score:
                            Number(
                                savedAttempt.score
                            ),

                        submittedAt:
                            savedAttempt.submitted_at,

weighted:
    grading.breakdown.weighted,

review:
    buildPublicQuizReview(
        quiz,
        grading.gradedAnswers
    )
                    }
                });

        } catch (error) {

            console.error(
                "Gagal Submit Public Quiz:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    code:
                        "PUBLIC_QUIZ_SUBMIT_FAILED",

                    message:
                        "Gagal mengirim jawaban Public Quiz."
                });

        }

    }
);

// ========================================
// ONLINE QUIZ - STUDENT DASHBOARD
// ========================================

app.get(
    "/api/student/quizzes",
    async (
        req,
        res
    ) => {

        /*
            Hanya session Student yang boleh
            mengambil dashboard Quiz Student.
        */
        if (!req.session.studentId) {

            return res
                .status(401)
                .json({
                    success:
                        false,

                    message:
                        "Harus login sebagai siswa."
                });

        }


        try {

            await ensureQuizTables();


            const studentId =
                Number(
                    req.session.studentId
                );


            if (
                !Number.isInteger(
                    studentId
                ) ||
                studentId <= 0
            ) {

                return res
                    .status(401)
                    .json({
                        success:
                            false,

                        message:
                            "Session siswa tidak valid."
                    });

            }


/*
    DAFTAR QUIZ STUDENT

    Mengambil Quiz yang belum pernah disubmit:
    - published dan masih tersedia = active
    - published tetapi deadline lewat = missing
    - ditutup Guru = missing

    Quiz draft tidak pernah diperlihatkan
    kepada siswa.
*/
const studentQuizRows =
    await tursoDb.all(
        `
            SELECT
                quizzes.id,
                quizzes.title,
                quizzes.description,
                quizzes.subject,
                quizzes.material,
                quizzes.status,
                quizzes.due_at,
                quizzes.published_at,

                (
                    SELECT COUNT(*)

                    FROM quiz_questions

                    WHERE
                        quiz_questions.quiz_id =
                            quizzes.id
                )
                    AS question_count,

                CASE

                    WHEN
                        quizzes.status =
                            'published'

                        AND (
                            quizzes.due_at
                                IS NULL

                            OR

                            datetime(
                                quizzes.due_at
                            ) >
                            datetime(
                                'now'
                            )
                        )

                    THEN
                        'active'

                    ELSE
                        'missing'

                END
                    AS student_quiz_status,

                CASE

                    WHEN
                        quizzes.status =
                            'closed'

                    THEN
                        'Quiz ditutup oleh Guru'

                    WHEN
                        quizzes.due_at
                            IS NOT NULL

                        AND
                        datetime(
                            quizzes.due_at
                        ) <=
                        datetime(
                            'now'
                        )

                    THEN
                        'Deadline telah berakhir'

                    ELSE
                        NULL

                END
                    AS missing_reason

            FROM quizzes

WHERE
    quizzes.status IN (
        'published',
        'closed'
    )

    /*
        Quiz harus mengizinkan akses siswa
        yang mempunyai akun LMS.
    */
    AND
        COALESCE(
            quizzes.allow_private,
            1
        ) = 1

    /*
        Tampilkan jika targetnya semua siswa,
        atau siswa ini termasuk target pilihan.
    */
    AND (
        COALESCE(
            quizzes.private_audience,
            'all'
        ) = 'all'

        OR (

            quizzes.private_audience =
                'selected'

            AND EXISTS (
                SELECT
                    1

                FROM quiz_allowed_students

                WHERE
                    quiz_allowed_students.quiz_id =
                        quizzes.id

                    AND
                    quiz_allowed_students.student_id =
                        ?
            )
        )
    )

    AND NOT EXISTS (
                    SELECT
                        1

                    FROM quiz_attempts

                    WHERE
                        quiz_attempts.quiz_id =
                            quizzes.id

                        AND
                        quiz_attempts.student_id =
                            ?
                )

            ORDER BY

                /*
                    Active selalu berada sebelum
                    Missing.
                */
                CASE

                    WHEN
                        quizzes.status =
                            'published'

                        AND (
                            quizzes.due_at
                                IS NULL

                            OR

                            datetime(
                                quizzes.due_at
                            ) >
                            datetime(
                                'now'
                            )
                        )

                    THEN
                        0

                    ELSE
                        1

                END ASC,

                /*
                    Dalam Active, Quiz dengan deadline
                    tampil lebih dahulu.
                */
                CASE

                    WHEN
                        quizzes.status =
                            'published'

                        AND
                        quizzes.due_at
                            IS NULL

                    THEN
                        1

                    ELSE
                        0

                END ASC,

                quizzes.due_at ASC,
                quizzes.published_at DESC,
                quizzes.id DESC
        `,
[
    studentId,
    studentId
]
    );


const quizzes =
    studentQuizRows.map(
        (
            quizRow
        ) => ({

            id:
                Number(
                    quizRow.id
                ),

            title:
                quizRow.title,

            description:
                quizRow.description,

            subject:
                quizRow.subject,

            material:
                quizRow.material,

            status:
                quizRow.status,

            /*
                active atau missing.
            */
            studentStatus:
                quizRow.student_quiz_status,

            missingReason:
                quizRow.missing_reason ||
                null,

            dueAt:
                quizRow.due_at,

            publishedAt:
                quizRow.published_at,

            questionCount:
                Number(
                    quizRow.question_count ||
                    0
                )

        })
    );


            /*
                RIWAYAT SUBMISSION SISWA
            */
            const historyRows =
                await tursoDb.all(
                    `
                        SELECT
                            quiz_attempts.id
                                AS attempt_id,

                            quiz_attempts.quiz_id,
                            quiz_attempts.correct_count,
                            quiz_attempts.total_questions,
                            quiz_attempts.score,
                            quiz_attempts.submitted_at,

                            quizzes.title,
                            quizzes.subject,
                            quizzes.material,
                            quizzes.status

                        FROM quiz_attempts

                        INNER JOIN quizzes
                            ON quizzes.id =
                                quiz_attempts.quiz_id

                        WHERE
                            quiz_attempts.student_id = ?

                        ORDER BY
                            quiz_attempts.submitted_at
                                DESC,

                            quiz_attempts.id
                                DESC
                    `,
                    [
                        studentId
                    ]
                );


            const history =
                historyRows.map(
                    (
                        historyRow
                    ) => ({

                        attemptId:
                            Number(
                                historyRow.attempt_id
                            ),

                        quizId:
                            Number(
                                historyRow.quiz_id
                            ),

                        title:
                            historyRow.title,

                        subject:
                            historyRow.subject,

                        material:
                            historyRow.material,

                        quizStatus:
                            historyRow.status,

                        correctCount:
                            Number(
                                historyRow.correct_count
                            ),

                        totalQuestions:
                            Number(
                                historyRow.total_questions
                            ),

                        score:
                            Number(
                                historyRow.score
                            ),

                        submittedAt:
                            historyRow.submitted_at

                    })
                );


            return res.json({
                success:
                    true,

                /*
                    Digunakan frontend untuk
                    menghitung teks sisa waktu
                    tanpa terlalu bergantung pada
                    jam perangkat siswa.
                */
                serverNow:
                    new Date()
                        .toISOString(),

                quizzes,

                history
            });

        } catch (error) {

            console.error(
                "Gagal mengambil dashboard Quiz Student:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Gagal mengambil daftar Quiz."
                });

        }

    }
);

// ========================================
// ONLINE QUIZ - STUDENT OPEN QUIZ
// ========================================

app.get(
    "/api/student/quizzes/:quizId",
    async (
        req,
        res
    ) => {

        if (!req.session.studentId) {

            return res
                .status(401)
                .json({
                    success:
                        false,

                    message:
                        "Harus login sebagai siswa."
                });

        }


        try {

            await ensureQuizTables();


            const studentId =
                Number(
                    req.session.studentId
                );


            let quizId;


            try {

                quizId =
                    parsePositiveQuizId(
                        req.params.quizId,
                        "ID Quiz"
                    );

            } catch (validationError) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            validationError.message
                    });

            }


            /*
                Periksa apakah siswa sudah pernah
                submit Quiz ini.
            */
            const existingAttempt =
                await tursoDb.get(
                    `
                        SELECT
                            id

                        FROM quiz_attempts

                        WHERE
                            quiz_id = ?
                            AND student_id = ?

                        LIMIT 1
                    `,
                    [
                        quizId,
                        studentId
                    ]
                );


            if (existingAttempt) {

                return res
                    .status(409)
                    .json({
                        success:
                            false,

                        code:
                            "QUIZ_ALREADY_SUBMITTED",

                        message:
                            "Quiz ini sudah pernah kamu kerjakan.",

                        attemptId:
                            Number(
                                existingAttempt.id
                            )
                    });

            }


            /*
                false sangat penting.

                Student tidak boleh menerima:
                - isCorrect
                - correctText
                - kunci jawaban lainnya
            */
            const quiz =
                await getQuizWithQuestions(
                    quizId,
                    false
                );


const availabilityError =
    await getStudentQuizAvailabilityError(
        quiz,
        studentId
    );


            if (availabilityError) {

                return res
                    .status(
                        availabilityError.status
                    )
                    .json({
                        success:
                            false,

                        code:
                            availabilityError.status ===
                                410

                                ? "QUIZ_DEADLINE_PASSED"
                                : "QUIZ_NOT_AVAILABLE",

                        message:
                            availabilityError.message
                    });

            }


            /*
                Perlindungan tambahan:
                Quiz published seharusnya selalu
                mempunyai minimal satu soal.
            */
            if (
                quiz.questions.length ===
                0
            ) {

                return res
                    .status(409)
                    .json({
                        success:
                            false,

                        code:
                            "QUIZ_HAS_NO_QUESTIONS",

                        message:
                            "Quiz belum mempunyai soal."
                    });

            }


            return res.json({
                success:
                    true,

                serverNow:
                    new Date()
                        .toISOString(),

                quiz
            });

        } catch (error) {

            console.error(
                "Gagal membuka Quiz Student:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Gagal membuka Quiz."
                });

        }

    }
);

// ========================================
// ONLINE QUIZ - STUDENT SUBMIT
// ========================================

app.post(
    "/api/student/quizzes/:quizId/submit",
    async (
        req,
        res
    ) => {

        if (!req.session.studentId) {

            return res
                .status(401)
                .json({
                    success:
                        false,

                    message:
                        "Harus login sebagai siswa."
                });

        }


        try {

            await ensureQuizTables();


            const studentId =
                Number(
                    req.session.studentId
                );


            if (
                !Number.isInteger(
                    studentId
                ) ||
                studentId <= 0
            ) {

                return res
                    .status(401)
                    .json({
                        success:
                            false,

                        message:
                            "Session siswa tidak valid."
                    });

            }


            let quizId;


            try {

                quizId =
                    parsePositiveQuizId(
                        req.params.quizId,
                        "ID Quiz"
                    );

            } catch (validationError) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            validationError.message
                    });

            }


            /*
                Backend memerlukan kunci jawaban
                untuk melakukan autograding.

                Kunci ini hanya digunakan di server
                dan tidak langsung dikirim ke siswa.
            */
            const quiz =
                await getQuizWithQuestions(
                    quizId,
                    true
                );


const availabilityError =
    await getStudentQuizAvailabilityError(
        quiz,
        studentId
    );


            if (availabilityError) {

                return res
                    .status(
                        availabilityError.status
                    )
                    .json({
                        success:
                            false,

                        code:
                            availabilityError.status ===
                                410

                                ? "QUIZ_DEADLINE_PASSED"
                                : "QUIZ_NOT_AVAILABLE",

                        message:
                            availabilityError.message
                    });

            }


            if (
                quiz.questions.length ===
                0
            ) {

                return res
                    .status(409)
                    .json({
                        success:
                            false,

                        message:
                            "Quiz belum mempunyai soal."
                    });

            }


            /*
                Pemeriksaan awal agar frontend
                mendapat pesan yang jelas.

                Constraint UNIQUE database tetap
                menjadi perlindungan utama jika ada
                dua request bersamaan.
            */
            const existingAttempt =
                await tursoDb.get(
                    `
                        SELECT
                            id

                        FROM quiz_attempts

                        WHERE
                            quiz_id = ?
                            AND student_id = ?

                        LIMIT 1
                    `,
                    [
                        quizId,
                        studentId
                    ]
                );


            if (existingAttempt) {

                return res
                    .status(409)
                    .json({
                        success:
                            false,

                        code:
                            "QUIZ_ALREADY_SUBMITTED",

                        message:
                            "Quiz hanya dapat dikirim satu kali.",

                        attemptId:
                            Number(
                                existingAttempt.id
                            )
                    });

            }


            const submittedAnswers =
                req.body &&
                Array.isArray(
                    req.body.answers
                )

                    ? req.body.answers
                    : [];


            /*
                Maksimal satu payload jawaban untuk
                setiap soal.

                Jika browser mengirim ID yang sama
                dua kali, nilai terakhir digunakan.
            */
            const submittedByQuestionId =
                new Map();


            submittedAnswers.forEach(
                (
                    submittedAnswer
                ) => {

                    const questionId =
                        Number(
                            submittedAnswer &&
                            submittedAnswer.questionId
                        );


                    if (
                        Number.isInteger(
                            questionId
                        ) &&
                        questionId > 0
                    ) {

                        submittedByQuestionId.set(
                            questionId,
                            submittedAnswer
                        );

                    }

                }
            );


            /*
                Penilaian dilakukan berdasarkan
                daftar soal authoritative dari Turso.

                ID soal tambahan yang dikirim browser
                otomatis diabaikan.
            */
            const gradedAnswers =
                quiz.questions.map(
                    (
                        question
                    ) => {

                        const submittedAnswer =
                            submittedByQuestionId.get(
                                question.id
                            ) ||
                            {};


                        /*
                            PILIHAN GANDA
                        */
                        if (
                            question.type ===
                            "mcq"
                        ) {

                            const selectedOptionId =
                                Number(
                                    submittedAnswer.optionId
                                );


                            /*
                                Pastikan option benar-benar
                                milik pertanyaan ini.
                            */
                            const selectedOption =
                                question.options.find(
                                    (
                                        option
                                    ) =>
                                        Number(
                                            option.id
                                        ) ===
                                        selectedOptionId
                                );


                            const isCorrect =
                                Boolean(
                                    selectedOption &&
                                    selectedOption.isCorrect
                                );


                            return {
                                questionId:
                                    question.id,

                                selectedOptionId:
                                    selectedOption
                                        ? Number(
                                            selectedOption.id
                                        )
                                        : null,

                                textAnswer:
                                    null,

                                isCorrect
                            };

                        }


                        /*
                            ISIAN SINGKAT
                        */
                        const textAnswer =
                            String(
                                submittedAnswer.textAnswer ||
                                ""
                            )
                                .slice(
                                    0,
                                    3000
                                );


                        const normalizedStudentAnswer =
                            normalizeQuizAnswer(
                                textAnswer
                            );


                        const normalizedCorrectAnswer =
                            normalizeQuizAnswer(
                                question.correctText
                            );


                        /*
                            Jawaban kosong tidak boleh
                            dianggap benar walaupun kunci
                            mengalami masalah dan kosong.
                        */
                        const isCorrect =
                            Boolean(
                                normalizedStudentAnswer &&
                                normalizedCorrectAnswer &&
                                normalizedStudentAnswer ===
                                    normalizedCorrectAnswer
                            );


                        return {
                            questionId:
                                question.id,

                            selectedOptionId:
                                null,

                            /*
                                Jawaban asli tetap disimpan
                                persis seperti input siswa.
                            */
                            textAnswer,

                            isCorrect
                        };

                    }
                );


 /*
    Jumlah jawaban benar keseluruhan tetap
    disimpan untuk ringkasan hasil.
*/
const correctCount =
    gradedAnswers.filter(
        answer =>
            answer.isCorrect
    ).length;


const totalQuestions =
    quiz.questions.length;


/*
    Pisahkan ID soal berdasarkan jenisnya.

    short_answer digunakan backend sebagai
    jenis soal Esai/Isian Singkat.
*/
const mcqQuestionIds =
    new Set(
        quiz.questions
            .filter(
                question =>
                    question.type ===
                    "mcq"
            )
            .map(
                question =>
                    Number(
                        question.id
                    )
            )
    );


const essayQuestionIds =
    new Set(
        quiz.questions
            .filter(
                question =>
                    question.type ===
                    "short_answer"
            )
            .map(
                question =>
                    Number(
                        question.id
                    )
            )
    );


const mcqQuestionCount =
    mcqQuestionIds.size;


const essayQuestionCount =
    essayQuestionIds.size;


const mcqCorrectCount =
    gradedAnswers.filter(
        answer =>
            answer.isCorrect &&
            mcqQuestionIds.has(
                Number(
                    answer.questionId
                )
            )
    ).length;


const essayCorrectCount =
    gradedAnswers.filter(
        answer =>
            answer.isCorrect &&
            essayQuestionIds.has(
                Number(
                    answer.questionId
                )
            )
    ).length;


/*
    Bobot hanya digunakan jika:

    1. Toggle bobot diaktifkan.
    2. Quiz mempunyai soal MCQ.
    3. Quiz juga mempunyai soal Esai.

    Jika Quiz hanya mempunyai satu jenis soal,
    jenis tersebut otomatis bernilai 100%.

    Jika toggle bobot dimatikan, semua soal
    dihitung rata seperti sistem sebelumnya.
*/
const useWeightedScore =
    Boolean(
        quiz.settings &&
        quiz.settings.useTypeWeights
    ) &&
    mcqQuestionCount > 0 &&
    essayQuestionCount > 0;


let score;


if (useWeightedScore) {

    /*
        essayWeight sudah divalidasi saat
        Settings disimpan.

        Validasi ulang dilakukan agar grading
        tetap aman jika data database lama
        mengalami masalah.
    */
    const essayWeight =
        Math.max(
            0,
            Math.min(
                100,
                Math.round(
                    Number(
                        quiz.settings.essayWeight
                    ) || 0
                )
            )
        );


    const mcqWeight =
        100 -
        essayWeight;


    /*
        Contoh:

        MCQ:
        4 benar dari 5, bobot 40
        = 4 / 5 × 40
        = 32 poin

        Esai:
        3 benar dari 5, bobot 60
        = 3 / 5 × 60
        = 36 poin

        Nilai akhir:
        32 + 36 = 68
    */
    const mcqScoreContribution =
        (
            mcqCorrectCount /
            mcqQuestionCount
        ) *
        mcqWeight;


    const essayScoreContribution =
        (
            essayCorrectCount /
            essayQuestionCount
        ) *
        essayWeight;


    score =
        Math.floor(
            mcqScoreContribution +
            essayScoreContribution
        );

} else {

    /*
        Mode tanpa bobot atau Quiz hanya
        memiliki satu jenis soal.
    */
    score =
        Math.floor(
            (
                correctCount /
                totalQuestions
            ) *
            100
        );

}


/*
    Perlindungan tambahan agar nilai yang
    tersimpan selalu berada pada 0–100.
*/
score =
    Math.max(
        0,
        Math.min(
            100,
            score
        )
    );


            /*
                Attempt dan seluruh jawaban disimpan
                dalam satu transaction Turso.

                Jika satu INSERT gagal, tidak ada
                attempt setengah jadi.
            */
            const statements = [

                {
                    sql: `
                        INSERT INTO
                            quiz_attempts (
                                quiz_id,
                                student_id,
                                correct_count,
                                total_questions,
                                score,
                                submitted_at
                            )

                        VALUES (
                            ?,
                            ?,
                            ?,
                            ?,
                            ?,
                            CURRENT_TIMESTAMP
                        )
                    `,

                    args: [
                        quizId,
                        studentId,
                        correctCount,
                        totalQuestions,
                        score
                    ]
                }

            ];


            gradedAnswers.forEach(
                (
                    answer
                ) => {

                    statements.push({
                        sql: `
                            INSERT INTO
                                quiz_answers (
                                    attempt_id,
                                    question_id,
                                    selected_option_id,
                                    text_answer,
                                    is_correct
                                )

                            SELECT
                                quiz_attempts.id,
                                ?,
                                ?,
                                ?,
                                ?

                            FROM quiz_attempts

                            WHERE
                                quiz_attempts.quiz_id = ?
                                AND
                                quiz_attempts.student_id = ?
                        `,

                        args: [
                            answer.questionId,
                            answer.selectedOptionId,
                            answer.textAnswer,

                            answer.isCorrect
                                ? 1
                                : 0,

                            quizId,
                            studentId
                        ]
                    });

                }
            );


            try {

                await tursoDb.batch(
                    statements,
                    "immediate"
                );

            } catch (databaseError) {

                const databaseMessage =
                    String(
                        databaseError &&
                        databaseError.message ||
                        ""
                    );


                /*
                    Dua request Submit yang datang
                    hampir bersamaan akan bertabrakan
                    dengan UNIQUE(quiz_id, student_id).
                */
                if (
                    databaseMessage.includes(
                        "UNIQUE"
                    ) ||
                    databaseMessage.includes(
                        "quiz_attempts.quiz_id"
                    )
                ) {

                    const savedAttempt =
                        await tursoDb.get(
                            `
                                SELECT
                                    id

                                FROM quiz_attempts

                                WHERE
                                    quiz_id = ?
                                    AND student_id = ?

                                LIMIT 1
                            `,
                            [
                                quizId,
                                studentId
                            ]
                        );


                    return res
                        .status(409)
                        .json({
                            success:
                                false,

                            code:
                                "QUIZ_ALREADY_SUBMITTED",

                            message:
                                "Quiz hanya dapat dikirim satu kali.",

                            attemptId:
                                savedAttempt
                                    ? Number(
                                        savedAttempt.id
                                    )
                                    : null
                        });

                }


                throw databaseError;

            }


            /*
                Ambil ID authoritative attempt yang
                baru berhasil disimpan.
            */
            const savedAttempt =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            score,
                            correct_count,
                            total_questions,
                            submitted_at

                        FROM quiz_attempts

                        WHERE
                            quiz_id = ?
                            AND student_id = ?

                        LIMIT 1
                    `,
                    [
                        quizId,
                        studentId
                    ]
                );


            if (!savedAttempt) {

                throw new Error(
                    "Attempt yang baru disimpan tidak ditemukan."
                );

            }


            return res
                .status(201)
                .json({
                    success:
                        true,

                    attemptId:
                        Number(
                            savedAttempt.id
                        ),

                    score:
                        Number(
                            savedAttempt.score
                        ),

                    correctCount:
                        Number(
                            savedAttempt.correct_count
                        ),

                    totalQuestions:
                        Number(
                            savedAttempt.total_questions
                        ),

                    submittedAt:
                        savedAttempt.submitted_at
                });

        } catch (error) {

            console.error(
                "Gagal Submit Quiz:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Gagal mengirim jawaban Quiz."
                });

        }

    }
);

// ========================================
// ONLINE QUIZ - ATTEMPT DETAIL HELPER
// ========================================

async function getQuizAttemptDetail(
    attemptId,
    studentId = null
) {

    await ensureQuizTables();


    /*
        Jika studentId diberikan, query hanya
        boleh menemukan attempt milik siswa itu.

        Jika null, helper dapat digunakan oleh
        endpoint Admin.
    */
    const attempt =
        await tursoDb.get(
            `
                SELECT
                    quiz_attempts.id,
                    quiz_attempts.quiz_id,
                    quiz_attempts.student_id,
                    quiz_attempts.correct_count,
                    quiz_attempts.total_questions,
                    quiz_attempts.score,
                    quiz_attempts.submitted_at,

                    quizzes.title,
                    quizzes.description,
                    quizzes.subject,
                    quizzes.material,

                    students.name
                        AS student_name,

                    students.class_name

                FROM quiz_attempts

                INNER JOIN quizzes
                    ON quizzes.id =
                        quiz_attempts.quiz_id

                INNER JOIN students
                    ON students.id =
                        quiz_attempts.student_id

                WHERE
                    quiz_attempts.id = ?

                    AND (
                        ? IS NULL

                        OR

                        quiz_attempts.student_id = ?
                    )
            `,
            [
                attemptId,
                studentId,
                studentId
            ]
        );


    if (!attempt) {

        return null;

    }


    /*
        Ambil semua jawaban dalam urutan soal.

        selected_option adalah pilihan siswa.
        correct_option adalah pilihan benar.
    */
    const answerRows =
        await tursoDb.all(
            `
                SELECT
                    quiz_questions.id
                        AS question_id,

                    quiz_questions.position,
quiz_questions.question_type,
quiz_questions.question_text,
quiz_questions.image_url,
quiz_questions.correct_text_answer,

                    quiz_answers.text_answer,
                    quiz_answers.is_correct,

                    selected_option.id
                        AS selected_option_id,

                    selected_option.option_text
                        AS selected_option_text,

                    selected_option.position
                        AS selected_option_position,

                    correct_option.id
                        AS correct_option_id,

                    correct_option.option_text
                        AS correct_option_text,

                    correct_option.position
                        AS correct_option_position

                FROM quiz_questions

                LEFT JOIN quiz_answers
                    ON quiz_answers.question_id =
                        quiz_questions.id

                    AND
                    quiz_answers.attempt_id = ?

                LEFT JOIN quiz_options
                    AS selected_option

                    ON selected_option.id =
                        quiz_answers.selected_option_id

                LEFT JOIN quiz_options
                    AS correct_option

                    ON correct_option.question_id =
                        quiz_questions.id

                    AND
                    correct_option.is_correct = 1

                WHERE
                    quiz_questions.quiz_id = ?

                ORDER BY
                    quiz_questions.position ASC,
                    quiz_questions.id ASC
            `,
            [
                attemptId,
                Number(
                    attempt.quiz_id
                )
            ]
        );


    const answers =
        answerRows.map(
            (
                answerRow
            ) => {

                const type =
                    answerRow.question_type;


                let studentAnswer;
                let correctAnswer;


                if (
                    type ===
                    "mcq"
                ) {

                    studentAnswer =
                        answerRow
                            .selected_option_text ||
                        "Tidak menjawab";


                    correctAnswer =
                        answerRow
                            .correct_option_text ||
                        "Kunci jawaban tidak ditemukan";

                } else {

                    /*
                        Jawaban asli siswa, bukan
                        hasil normalisasi.
                    */
                    studentAnswer =
                        answerRow.text_answer &&
                        answerRow.text_answer.trim()

                            ? answerRow.text_answer
                            : "Tidak menjawab";


                    correctAnswer =
                        answerRow
                            .correct_text_answer ||
                        "Kunci jawaban tidak ditemukan";

                }


                return {
                    questionId:
                        Number(
                            answerRow.question_id
                        ),

                    position:
                        Number(
                            answerRow.position
                        ),

                    type,

text:
    answerRow.question_text,

imageUrl:
    answerRow.image_url || null,

studentAnswer,

                    correctAnswer,

                    selectedOptionId:
                        answerRow.selected_option_id
                            ? Number(
                                answerRow
                                    .selected_option_id
                            )
                            : null,

                    selectedOptionPosition:
                        answerRow
                            .selected_option_position
                            ? Number(
                                answerRow
                                    .selected_option_position
                            )
                            : null,

                    correctOptionId:
                        answerRow.correct_option_id
                            ? Number(
                                answerRow
                                    .correct_option_id
                            )
                            : null,

                    correctOptionPosition:
                        answerRow
                            .correct_option_position
                            ? Number(
                                answerRow
                                    .correct_option_position
                            )
                            : null,

                    isCorrect:
                        Number(
                            answerRow.is_correct ||
                            0
                        ) === 1
                };

            }
        );


    return {
        id:
            Number(
                attempt.id
            ),

        quizId:
            Number(
                attempt.quiz_id
            ),

        studentId:
            Number(
                attempt.student_id
            ),

        studentName:
            attempt.student_name,

        className:
            attempt.class_name,

        title:
            attempt.title,

        description:
            attempt.description,

        subject:
            attempt.subject,

        material:
            attempt.material,

        correctCount:
            Number(
                attempt.correct_count
            ),

        totalQuestions:
            Number(
                attempt.total_questions
            ),

        score:
            Number(
                attempt.score
            ),

        submittedAt:
            attempt.submitted_at,

        answers
    };

}

// ========================================
// ONLINE QUIZ - GUEST ATTEMPT DETAIL
// ========================================

async function getGuestQuizAttemptDetail(
    attemptId
) {

    await ensureQuizTables();


    const attempt =
        await tursoDb.get(
            `
                SELECT
                    quiz_guest_attempts.id,
                    quiz_guest_attempts.quiz_id,
                    quiz_guest_attempts.guest_name,
                    quiz_guest_attempts.correct_count,
                    quiz_guest_attempts.total_questions,
                    quiz_guest_attempts.score,
                    quiz_guest_attempts.submitted_at,

                    quizzes.title,
                    quizzes.description,
                    quizzes.subject,
                    quizzes.material

                FROM quiz_guest_attempts

                INNER JOIN quizzes
                    ON quizzes.id =
                        quiz_guest_attempts.quiz_id

                WHERE
                    quiz_guest_attempts.id = ?

                LIMIT 1
            `,
            [
                attemptId
            ]
        );


    if (!attempt) {

        return null;

    }


    /*
        Ambil semua jawaban Guest dalam urutan
        soal yang sama dengan detail siswa.
    */
    const answerRows =
        await tursoDb.all(
            `
                SELECT
                    quiz_questions.id
                        AS question_id,

                    quiz_questions.position,
quiz_questions.question_type,
quiz_questions.question_text,
quiz_questions.image_url,
quiz_questions.correct_text_answer,

                    quiz_guest_answers.text_answer,
                    quiz_guest_answers.is_correct,

                    selected_option.id
                        AS selected_option_id,

                    selected_option.option_text
                        AS selected_option_text,

                    selected_option.position
                        AS selected_option_position,

                    correct_option.id
                        AS correct_option_id,

                    correct_option.option_text
                        AS correct_option_text,

                    correct_option.position
                        AS correct_option_position

                FROM quiz_questions

                LEFT JOIN quiz_guest_answers
                    ON quiz_guest_answers.question_id =
                        quiz_questions.id

                    AND
                    quiz_guest_answers.guest_attempt_id =
                        ?

                LEFT JOIN quiz_options
                    AS selected_option

                    ON selected_option.id =
                        quiz_guest_answers.selected_option_id

                LEFT JOIN quiz_options
                    AS correct_option

                    ON correct_option.question_id =
                        quiz_questions.id

                    AND
                    correct_option.is_correct = 1

                WHERE
                    quiz_questions.quiz_id = ?

                ORDER BY
                    quiz_questions.position ASC,
                    quiz_questions.id ASC
            `,
            [
                attemptId,

                Number(
                    attempt.quiz_id
                )
            ]
        );


    const answers =
        answerRows.map(
            answerRow => {

                const type =
                    answerRow.question_type;


                let guestAnswer;
                let correctAnswer;


                if (
                    type ===
                        "mcq"
                ) {

                    guestAnswer =
                        answerRow
                            .selected_option_text ||
                        "Tidak menjawab";


                    correctAnswer =
                        answerRow
                            .correct_option_text ||
                        "Kunci jawaban tidak ditemukan";

                } else {

                    guestAnswer =
                        answerRow.text_answer &&
                        answerRow.text_answer.trim()

                            ? answerRow.text_answer
                            : "Tidak menjawab";


                    correctAnswer =
                        answerRow
                            .correct_text_answer ||
                        "Kunci jawaban tidak ditemukan";

                }


                return {
                    questionId:
                        Number(
                            answerRow.question_id
                        ),

                    position:
                        Number(
                            answerRow.position
                        ),

type,

text:
    answerRow.question_text,

imageUrl:
    answerRow.image_url || null,

/*
    Nama property tetap studentAnswer
                        agar renderer Individual lama dapat
                        digunakan tanpa dibuat ulang.
                    */
                    studentAnswer:
                        guestAnswer,

                    correctAnswer,

                    selectedOptionId:
                        answerRow.selected_option_id
                            ? Number(
                                answerRow
                                    .selected_option_id
                            )
                            : null,

                    selectedOptionPosition:
                        answerRow
                            .selected_option_position
                            ? Number(
                                answerRow
                                    .selected_option_position
                            )
                            : null,

                    correctOptionId:
                        answerRow.correct_option_id
                            ? Number(
                                answerRow
                                    .correct_option_id
                            )
                            : null,

                    correctOptionPosition:
                        answerRow
                            .correct_option_position
                            ? Number(
                                answerRow
                                    .correct_option_position
                            )
                            : null,

                    isCorrect:
                        Number(
                            answerRow.is_correct ||
                            0
                        ) === 1
                };

            }
        );


    return {
        id:
            Number(
                attempt.id
            ),

        responseKey:
            `guest:${
                Number(
                    attempt.id
                )
            }`,

        attemptType:
            "guest",

        isGuest:
            true,

        role:
            "GUEST",

        quizId:
            Number(
                attempt.quiz_id
            ),

        studentId:
            null,

        studentName:
            attempt.guest_name,

        className:
            "GUEST",

        title:
            attempt.title,

        description:
            attempt.description,

        subject:
            attempt.subject,

        material:
            attempt.material,

        correctCount:
            Number(
                attempt.correct_count
            ),

        totalQuestions:
            Number(
                attempt.total_questions
            ),

        score:
            Number(
                attempt.score
            ),

        submittedAt:
            attempt.submitted_at,

        answers
    };

}

// ========================================
// ONLINE QUIZ - STUDENT RESULT
// ========================================

app.get(
    "/api/student/quiz-attempts/:attemptId",
    async (
        req,
        res
    ) => {

        if (!req.session.studentId) {

            return res
                .status(401)
                .json({
                    success:
                        false,

                    message:
                        "Harus login sebagai siswa."
                });

        }


        try {

            await ensureQuizTables();


            const studentId =
                Number(
                    req.session.studentId
                );


            let attemptId;


            try {

                attemptId =
                    parsePositiveQuizId(
                        req.params.attemptId,
                        "ID hasil Quiz"
                    );

            } catch (validationError) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            validationError.message
                    });

            }


            /*
                studentId diteruskan ke helper.

                Jadi attempt milik siswa lain akan
                terlihat seperti tidak ditemukan.
            */
            const attempt =
                await getQuizAttemptDetail(
                    attemptId,
                    studentId
                );


            if (!attempt) {

                return res
                    .status(404)
                    .json({
                        success:
                            false,

                        message:
                            "Hasil Quiz tidak ditemukan."
                    });

            }


            return res.json({
                success:
                    true,

                attempt
            });

        } catch (error) {

            console.error(
                "Gagal mengambil hasil Quiz Student:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Gagal mengambil hasil Quiz."
                });

        }

    }
);

// ========================================
// ONLINE QUIZ - ADMIN RESPONDENTS
// ========================================

app.get(
    "/api/admin/quizzes/:quizId/respondents",
    async (
        req,
        res
    ) => {

        try {

            await ensureQuizTables();


            let quizId;


            try {

                quizId =
                    parsePositiveQuizId(
                        req.params.quizId,
                        "ID Quiz"
                    );

            } catch (validationError) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            validationError.message
                    });

            }


            const quiz =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            title,
                            subject,
                            material,
                            status

                        FROM quizzes

                        WHERE
                            id = ?
                    `,
                    [
                        quizId
                    ]
                );


            if (!quiz) {

                return res
                    .status(404)
                    .json({
                        success:
                            false,

                        message:
                            "Quiz tidak ditemukan."
                    });

            }


            /*
                DAFTAR RESPONDEN
            */
 const respondentRows =
    await tursoDb.all(
        `
            SELECT
                combined.respondent_type,
                combined.attempt_id,
                combined.student_id,
                combined.respondent_name,
                combined.class_name,
                combined.correct_count,
                combined.total_questions,
                combined.score,
                combined.submitted_at

            FROM (

                /*
                    RESPONDEN SISWA TERDAFTAR
                */
                SELECT
                    'student'
                        AS respondent_type,

                    quiz_attempts.id
                        AS attempt_id,

                    quiz_attempts.student_id,

                    students.name
                        AS respondent_name,

                    students.class_name,

                    quiz_attempts.correct_count,
                    quiz_attempts.total_questions,
                    quiz_attempts.score,
                    quiz_attempts.submitted_at

                FROM quiz_attempts

                INNER JOIN students
                    ON students.id =
                        quiz_attempts.student_id

                WHERE
                    quiz_attempts.quiz_id = ?


                UNION ALL


                /*
                    RESPONDEN GUEST
                */
                SELECT
                    'guest'
                        AS respondent_type,

                    quiz_guest_attempts.id
                        AS attempt_id,

                    NULL
                        AS student_id,

                    quiz_guest_attempts.guest_name
                        AS respondent_name,

                    'GUEST'
                        AS class_name,

                    quiz_guest_attempts.correct_count,
                    quiz_guest_attempts.total_questions,
                    quiz_guest_attempts.score,
                    quiz_guest_attempts.submitted_at

                FROM quiz_guest_attempts

                WHERE
                    quiz_guest_attempts.quiz_id = ?

            )
                AS combined

            ORDER BY
                combined.submitted_at DESC,
                combined.attempt_id DESC
        `,
        [
            quizId,
            quizId
        ]
    );


const respondents =
    respondentRows.map(
        respondentRow => {

            const attemptType =
                respondentRow.respondent_type ===
                    "guest"
                    ? "guest"
                    : "student";


            const attemptId =
                Number(
                    respondentRow.attempt_id
                );


            const isGuest =
                attemptType ===
                    "guest";


            return {
                /*
                    attemptId bisa sama antara tabel
                    siswa dan Guest. Gunakan responseKey
                    sebagai identitas unik frontend.
                */
                responseKey:
                    `${attemptType}:${attemptId}`,

                attemptType,

                attemptId,

                studentId:
                    isGuest
                        ? null
                        : Number(
                            respondentRow.student_id
                        ),

                studentName:
                    respondentRow.respondent_name,

                className:
                    isGuest
                        ? "GUEST"
                        : respondentRow.class_name,

                role:
                    isGuest
                        ? "GUEST"
                        : "STUDENT",

                isGuest,

                correctCount:
                    Number(
                        respondentRow.correct_count
                    ),

                totalQuestions:
                    Number(
                        respondentRow.total_questions
                    ),

                score:
                    Number(
                        respondentRow.score
                    ),

                submittedAt:
                    respondentRow.submitted_at
            };

        }
    );


            /*
                Array nilai untuk menghitung average,
                median, minimum, dan maximum.
            */
            const sortedScores =
                respondents
                    .map(
                        (
                            respondent
                        ) =>
                            respondent.score
                    )
                    .sort(
                        (
                            firstScore,
                            secondScore
                        ) =>
                            firstScore -
                            secondScore
                    );


            const totalRespondents =
                sortedScores.length;


            const average =
                totalRespondents > 0

                    ? Math.round(
                        sortedScores.reduce(
                            (
                                total,
                                score
                            ) =>
                                total +
                                score,

                            0
                        ) /
                        totalRespondents
                    )

                    : 0;


            let median =
                0;


            if (
                totalRespondents > 0
            ) {

                const middleIndex =
                    Math.floor(
                        totalRespondents /
                        2
                    );


                if (
                    totalRespondents %
                        2 ===
                    1
                ) {

                    median =
                        sortedScores[
                            middleIndex
                        ];

                } else {

                    median =
                        Math.round(
                            (
                                sortedScores[
                                    middleIndex -
                                    1
                                ] +

                                sortedScores[
                                    middleIndex
                                ]
                            ) /
                            2
                        );

                }

            }


            const highest =
                totalRespondents > 0

                    ? sortedScores[
                        totalRespondents -
                        1
                    ]

                    : 0;


            const lowest =
                totalRespondents > 0

                    ? sortedScores[0]
                    : 0;


            /*
                DISTRIBUSI NILAI

                10 kelompok:
                0-9 sampai 90-100.
            */
            const scoreDistribution =
                Array.from(
                    {
                        length:
                            10
                    },

                    (
                        unused,
                        index
                    ) => {

                        const minimum =
                            index *
                            10;


                        const maximum =
                            index ===
                            9

                                ? 100
                                : minimum +
                                    9;


                        const count =
                            sortedScores.filter(
                                (
                                    score
                                ) =>
                                    score >=
                                        minimum &&

                                    score <=
                                        maximum
                            ).length;


                        return {
                            label:
                                `${minimum}–${maximum}`,

                            minimum,

                            maximum,

                            count,

                            percentage:
                                totalRespondents > 0

                                    ? Math.round(
                                        (
                                            count /
                                            totalRespondents
                                        ) *
                                        100
                                    )

                                    : 0
                        };

                    }
                );


            /*
                TINGKAT BENAR PER SOAL

                quiz_answers selalu mempunyai satu
                row untuk setiap soal, termasuk jika
                siswa tidak menjawab.
            */
 const accuracyRows =
    await tursoDb.all(
        `
            SELECT
                quiz_questions.id
                    AS question_id,

                quiz_questions.position,
                quiz_questions.question_text,

                SUM(
                    CASE
                        WHEN
                            combined_answers.is_correct =
                                1
                            THEN 1

                        ELSE 0
                    END
                )
                    AS correct_count,

                COUNT(
                    combined_answers.question_id
                )
                    AS answer_count

            FROM quiz_questions

            LEFT JOIN (

                /*
                    Jawaban siswa terdaftar.
                */
                SELECT
                    quiz_answers.question_id,
                    quiz_answers.is_correct

                FROM quiz_answers

                INNER JOIN quiz_attempts
                    ON quiz_attempts.id =
                        quiz_answers.attempt_id

                WHERE
                    quiz_attempts.quiz_id = ?


                UNION ALL


                /*
                    Jawaban Guest.
                */
                SELECT
                    quiz_guest_answers.question_id,
                    quiz_guest_answers.is_correct

                FROM quiz_guest_answers

                INNER JOIN quiz_guest_attempts
                    ON quiz_guest_attempts.id =
                        quiz_guest_answers.guest_attempt_id

                WHERE
                    quiz_guest_attempts.quiz_id = ?

            )
                AS combined_answers

                ON combined_answers.question_id =
                    quiz_questions.id

            WHERE
                quiz_questions.quiz_id = ?

            GROUP BY
                quiz_questions.id,
                quiz_questions.position,
                quiz_questions.question_text

            ORDER BY
                quiz_questions.position ASC,
                quiz_questions.id ASC
        `,
        [
            quizId,
            quizId,
            quizId
        ]
    );


            const questionAccuracy =
                accuracyRows.map(
                    (
                        accuracyRow
                    ) => {

                        const correctCount =
                            Number(
                                accuracyRow.correct_count ||
                                0
                            );


                        const answerCount =
                            Number(
                                accuracyRow.answer_count ||
                                0
                            );


                        return {
                            questionId:
                                Number(
                                    accuracyRow.question_id
                                ),

                            position:
                                Number(
                                    accuracyRow.position
                                ),

                            text:
                                accuracyRow.question_text,

                            correctCount,

                            incorrectCount:
                                Math.max(
                                    0,
                                    answerCount -
                                    correctCount
                                ),

                            answerCount,

                            percentage:
                                answerCount > 0

                                    ? Math.round(
                                        (
                                            correctCount /
                                            answerCount
                                        ) *
                                        100
                                    )

                                    : 0
                        };

                    }
                );


            return res.json({
                success:
                    true,

                quiz: {
                    id:
                        Number(
                            quiz.id
                        ),

                    title:
                        quiz.title,

                    subject:
                        quiz.subject,

                    material:
                        quiz.material,

                    status:
                        quiz.status
                },

                summary: {
                    totalRespondents,
                    average,
                    median,
                    highest,
                    lowest,
                    scoreDistribution,
                    questionAccuracy
                },

                respondents
            });

        } catch (error) {

            console.error(
                "Gagal mengambil responden Quiz:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Gagal mengambil responden Quiz."
                });

        }

    }
);

function createAdminQuizResponseIdentity(
    responseRow
) {

    const attemptType =
        responseRow.respondent_type ===
            "guest"
            ? "guest"
            : "student";


    const attemptId =
        Number(
            responseRow.attempt_id
        );


    const isGuest =
        attemptType ===
            "guest";


    return {
        responseKey:
            `${attemptType}:${attemptId}`,

        attemptType,

        attemptId,

        studentId:
            isGuest
                ? null
                : Number(
                    responseRow.student_id
                ),

        studentName:
            responseRow.student_name,

        className:
            isGuest
                ? "GUEST"
                : responseRow.class_name,

        role:
            isGuest
                ? "GUEST"
                : "STUDENT",

        isGuest
    };

}

// ========================================
// ONLINE QUIZ - QUESTION RESPONSE SUMMARY
// ========================================

app.get(
    "/api/admin/quizzes/:quizId/questions/:questionId/response-summary",
    async (
        req,
        res
    ) => {

        try {

            await ensureQuizTables();


            let quizId;
            let questionId;


            try {

                quizId =
                    parsePositiveQuizId(
                        req.params.quizId,
                        "ID Quiz"
                    );


                questionId =
                    parsePositiveQuizId(
                        req.params.questionId,
                        "ID soal"
                    );

            } catch (validationError) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            validationError.message
                    });

            }


            /*
                Pastikan soal benar-benar merupakan
                bagian dari Quiz pada URL.
            */
            const question =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            quiz_id,
                            position,
                            question_type,
                            question_text,
                            correct_text_answer

                        FROM quiz_questions

                        WHERE
                            id = ?
                            AND quiz_id = ?
                    `,
                    [
                        questionId,
                        quizId
                    ]
                );


            if (!question) {

                return res
                    .status(404)
                    .json({
                        success:
                            false,

                        message:
                            "Soal tidak ditemukan."
                    });

            }


            /*
                Satu row untuk setiap siswa yang
                telah submit Quiz.

                LEFT JOIN memastikan siswa yang
                tidak menjawab tetap muncul.
            */
 const responseRows =
    await tursoDb.all(
        `
            SELECT
                combined.respondent_type,
                combined.attempt_id,
                combined.student_id,
                combined.student_name,
                combined.class_name,
                combined.text_answer,
                combined.is_correct,
                combined.option_id,
                combined.option_text,
                combined.option_position

            FROM (

                /*
                    JAWABAN SISWA TERDAFTAR
                */
                SELECT
                    'student'
                        AS respondent_type,

                    quiz_attempts.id
                        AS attempt_id,

                    students.id
                        AS student_id,

                    students.name
                        AS student_name,

                    students.class_name,

                    quiz_answers.text_answer,
                    quiz_answers.is_correct,

                    selected_option.id
                        AS option_id,

                    selected_option.option_text,

                    selected_option.position
                        AS option_position

                FROM quiz_attempts

                INNER JOIN students
                    ON students.id =
                        quiz_attempts.student_id

                LEFT JOIN quiz_answers
                    ON quiz_answers.attempt_id =
                        quiz_attempts.id

                    AND
                    quiz_answers.question_id = ?

                LEFT JOIN quiz_options
                    AS selected_option

                    ON selected_option.id =
                        quiz_answers.selected_option_id

                WHERE
                    quiz_attempts.quiz_id = ?


                UNION ALL


                /*
                    JAWABAN GUEST
                */
                SELECT
                    'guest'
                        AS respondent_type,

                    quiz_guest_attempts.id
                        AS attempt_id,

                    NULL
                        AS student_id,

                    quiz_guest_attempts.guest_name
                        AS student_name,

                    'GUEST'
                        AS class_name,

                    quiz_guest_answers.text_answer,
                    quiz_guest_answers.is_correct,

                    guest_selected_option.id
                        AS option_id,

                    guest_selected_option.option_text,

                    guest_selected_option.position
                        AS option_position

                FROM quiz_guest_attempts

                LEFT JOIN quiz_guest_answers
                    ON quiz_guest_answers.guest_attempt_id =
                        quiz_guest_attempts.id

                    AND
                    quiz_guest_answers.question_id = ?

                LEFT JOIN quiz_options
                    AS guest_selected_option

                    ON guest_selected_option.id =
                        quiz_guest_answers.selected_option_id

                WHERE
                    quiz_guest_attempts.quiz_id = ?

            )
                AS combined

            ORDER BY
                combined.student_name
                    COLLATE NOCASE ASC,

                combined.respondent_type ASC,
                combined.attempt_id ASC
        `,
        [
            questionId,
            quizId,

            questionId,
            quizId
        ]
    );


            const totalRespondents =
                responseRows.length;


            let groups =
                [];


            /*
                ==================================
                PILIHAN GANDA
                ==================================
            */
            if (
                question.question_type ===
                "mcq"
            ) {

                const optionRows =
                    await tursoDb.all(
                        `
                            SELECT
                                id,
                                option_text,
                                position,
                                is_correct

                            FROM quiz_options

                            WHERE
                                question_id = ?

                            ORDER BY
                                position ASC,
                                id ASC
                        `,
                        [
                            questionId
                        ]
                    );


                groups =
                    optionRows.map(
                        (
                            optionRow
                        ) => {

                            const optionId =
                                Number(
                                    optionRow.id
                                );


                            const matchingRows =
                                responseRows.filter(
                                    (
                                        responseRow
                                    ) =>
                                        Number(
                                            responseRow.option_id
                                        ) ===
                                        optionId
                                );


                            return {
                                key:
                                    String(
                                        optionId
                                    ),

                                optionId,

                                position:
                                    Number(
                                        optionRow.position
                                    ),

                                label:
                                    optionRow.option_text,

                                isCorrect:
                                    Number(
                                        optionRow.is_correct
                                    ) === 1,

                                count:
                                    matchingRows.length,

                                percentage:
                                    totalRespondents > 0

                                        ? Math.round(
                                            (
                                                matchingRows.length /
                                                totalRespondents
                                            ) *
                                            100
                                        )

                                        : 0,

students:
    matchingRows.map(
        responseRow =>
            createAdminQuizResponseIdentity(
                responseRow
            )
    )
                            };

                        }
                    );


                /*
                    Responden yang tidak memilih
                    satu pun option mendapat kelompok
                    Tidak menjawab.
                */
                const unansweredRows =
                    responseRows.filter(
                        (
                            responseRow
                        ) =>
                            !responseRow.option_id
                    );


                if (
                    unansweredRows.length >
                    0
                ) {

                    groups.push({
                        key:
                            "__empty__",

                        optionId:
                            null,

                        position:
                            null,

                        label:
                            "Tidak menjawab",

                        isCorrect:
                            false,

                        count:
                            unansweredRows.length,

                        percentage:
                            totalRespondents > 0

                                ? Math.round(
                                    (
                                        unansweredRows.length /
                                        totalRespondents
                                    ) *
                                    100
                                )

                                : 0,

students:
    unansweredRows.map(
        responseRow =>
            createAdminQuizResponseIdentity(
                responseRow
            )
    )
                    });

                }

            } else {

                /*
                    ==================================
                    ISIAN SINGKAT
                    ==================================

                    Pengelompokan memakai jawaban
                    yang sudah dinormalisasi.

                    Jawaban asli tetap disimpan pada
                    setiap student dalam group.
                */
                const groupMap =
                    new Map();


                responseRows.forEach(
                    (
                        responseRow
                    ) => {

                        const rawAnswer =
                            String(
                                responseRow.text_answer ||
                                ""
                            );


                        const normalizedAnswer =
                            normalizeQuizAnswer(
                                rawAnswer
                            );


                        const groupKey =
                            normalizedAnswer ||
                            "__empty__";


                        if (
                            !groupMap.has(
                                groupKey
                            )
                        ) {

                            groupMap.set(
                                groupKey,
                                {
                                    key:
                                        groupKey,

                                    /*
                                        Label memakai jawaban asli
                                        pertama dalam kelompok.
                                    */
                                    label:
                                        normalizedAnswer

                                            ? rawAnswer.trim()
                                            : "Tidak menjawab",

                                    isCorrect:
                                        Number(
                                            responseRow.is_correct ||
                                            0
                                        ) === 1,

                                    count:
                                        0,

                                    percentage:
                                        0,

                                    students:
                                        []
                                }
                            );

                        }


                        const group =
                            groupMap.get(
                                groupKey
                            );


                        group.count +=
                            1;


group.students.push({

    ...createAdminQuizResponseIdentity(
        responseRow
    ),

    /*
        Pertahankan input asli,
        termasuk kapitalisasi.
    */
    rawAnswer:
        rawAnswer ||
        "Tidak menjawab",

    isCorrect:
        Number(
            responseRow.is_correct ||
            0
        ) === 1

});

                    }
                );


                groups =
                    Array.from(
                        groupMap.values()
                    )
                        .map(
                            (
                                group
                            ) => ({

                                ...group,

                                percentage:
                                    totalRespondents > 0

                                        ? Math.round(
                                            (
                                                group.count /
                                                totalRespondents
                                            ) *
                                            100
                                        )

                                        : 0

                            })
                        )
                        .sort(
                            (
                                firstGroup,
                                secondGroup
                            ) => {

                                /*
                                    Jumlah terbanyak di atas.
                                    Jika sama, urut alfabetis.
                                */
                                if (
                                    secondGroup.count !==
                                    firstGroup.count
                                ) {

                                    return (
                                        secondGroup.count -
                                        firstGroup.count
                                    );

                                }


                                return (
                                    firstGroup.label
                                        .localeCompare(
                                            secondGroup.label,
                                            "id"
                                        )
                                );

                            }
                        );

            }


            /*
                Daftar seluruh jawaban untuk tabel
                di bawah chart.
            */
            const answers =
                responseRows.map(
                    (
                        responseRow
                    ) => {

                        let answer;


                        if (
                            question.question_type ===
                            "mcq"
                        ) {

                            answer =
                                responseRow.option_text ||
                                "Tidak menjawab";

                        } else {

                            answer =
                                responseRow.text_answer &&
                                responseRow.text_answer.trim()

                                    ? responseRow.text_answer
                                    : "Tidak menjawab";

                        }


return {

    ...createAdminQuizResponseIdentity(
        responseRow
    ),

    optionId:
        responseRow.option_id

            ? Number(
                responseRow.option_id
            )
            : null,

    optionPosition:
        responseRow.option_position

            ? Number(
                responseRow.option_position
            )
            : null,

    answer,

    isCorrect:
        Number(
            responseRow.is_correct ||
            0
        ) === 1

};

                    }
                );


            const correctCount =
                answers.filter(
                    (
                        answer
                    ) =>
                        answer.isCorrect
                ).length;


            return res.json({
                success:
                    true,

                question: {
                    id:
                        Number(
                            question.id
                        ),

                    quizId:
                        Number(
                            question.quiz_id
                        ),

                    position:
                        Number(
                            question.position
                        ),

                    type:
                        question.question_type,

                    text:
                        question.question_text,

                    correctText:
                        question.correct_text_answer,

                    totalRespondents,

                    correctCount,

                    incorrectCount:
                        Math.max(
                            0,
                            totalRespondents -
                            correctCount
                        ),

                    percentageCorrect:
                        totalRespondents > 0

                            ? Math.round(
                                (
                                    correctCount /
                                    totalRespondents
                                ) *
                                100
                            )

                            : 0,

                    groups,

                    answers
                }
            });

        } catch (error) {

            console.error(
                "Gagal mengambil summary jawaban soal:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Gagal mengambil ringkasan jawaban."
                });

        }

    }
);

// ========================================
// ONLINE QUIZ - ADMIN ATTEMPT DETAIL
// ========================================

app.get(
    "/api/admin/quiz-attempts/:attemptId",
    async (
        req,
        res
    ) => {

        try {

            await ensureQuizTables();


            let attemptId;


            try {

                attemptId =
                    parsePositiveQuizId(
                        req.params.attemptId,
                        "ID respons Quiz"
                    );

            } catch (validationError) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            validationError.message
                    });

            }


            /*
                studentId null berarti Admin boleh
                membuka attempt siswa mana pun.
            */
            const attempt =
                await getQuizAttemptDetail(
                    attemptId,
                    null
                );


            if (!attempt) {

                return res
                    .status(404)
                    .json({
                        success:
                            false,

                        message:
                            "Respons Quiz tidak ditemukan."
                    });

            }


            return res.json({
                success:
                    true,

                attempt
            });

        } catch (error) {

            console.error(
                "Gagal mengambil detail respons Admin:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Gagal mengambil detail respons."
                });

        }

    }
);

// ========================================
// ONLINE QUIZ - ADMIN GUEST ATTEMPT DETAIL
// ========================================

app.get(
    "/api/admin/quiz-guest-attempts/:attemptId",
    async (
        req,
        res
    ) => {

        try {

            await ensureQuizTables();


            let attemptId;


            try {

                attemptId =
                    parsePositiveQuizId(
                        req.params.attemptId,
                        "ID respons Guest"
                    );

            } catch (validationError) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            validationError.message
                    });

            }


            const attempt =
                await getGuestQuizAttemptDetail(
                    attemptId
                );


            if (!attempt) {

                return res
                    .status(404)
                    .json({
                        success:
                            false,

                        message:
                            "Respons Guest tidak ditemukan."
                    });

            }


            return res.json({
                success:
                    true,

                attempt
            });

        } catch (error) {

            console.error(
                "Gagal mengambil detail respons Guest:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Gagal mengambil detail respons Guest."
                });

        }

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
// ONLINE QUIZ - DATABASE
// ========================================

async function initializeQuizTables() {

    /*
        Metadata utama Quiz.

        status:
        - draft
        - published
        - closed
    */
    await tursoDb.run(`
        CREATE TABLE IF NOT EXISTS quizzes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            title TEXT NOT NULL
                DEFAULT 'Quiz Tanpa Judul',

            description TEXT,

            subject TEXT,

            material TEXT,

            status TEXT NOT NULL
                DEFAULT 'draft',

            due_at DATETIME,

            created_by INTEGER NOT NULL,

            created_at DATETIME NOT NULL
                DEFAULT CURRENT_TIMESTAMP,

            updated_at DATETIME NOT NULL
                DEFAULT CURRENT_TIMESTAMP,

            published_at DATETIME,

            FOREIGN KEY (created_by)
                REFERENCES admins(id)
        )
    `);

/*
    Migrasi Settings Quiz untuk database lama.
*/
const quizColumnRows =
    await tursoDb.all(`
        PRAGMA table_info(quizzes)
    `);


const quizColumnNames =
    new Set(
        quizColumnRows.map(
            row =>
                String(
                    row.name
                )
        )
    );


const quizColumnMigrations = [

    {
        name:
            "use_type_weights",

        sql: `
            ALTER TABLE quizzes
            ADD COLUMN use_type_weights
                INTEGER NOT NULL DEFAULT 0
        `
    },

    {
        name:
            "essay_weight",

        sql: `
            ALTER TABLE quizzes
            ADD COLUMN essay_weight
                INTEGER NOT NULL DEFAULT 60
        `
    },

    {
        name:
            "allow_private",

        sql: `
            ALTER TABLE quizzes
            ADD COLUMN allow_private
                INTEGER NOT NULL DEFAULT 1
        `
    },

    {
        name:
            "allow_public",

        sql: `
            ALTER TABLE quizzes
            ADD COLUMN allow_public
                INTEGER NOT NULL DEFAULT 0
        `
    },

    {
        name:
            "private_audience",

        sql: `
            ALTER TABLE quizzes
            ADD COLUMN private_audience
                TEXT NOT NULL DEFAULT 'all'
        `
    },

    {
        name:
            "public_token",

        sql: `
            ALTER TABLE quizzes
            ADD COLUMN public_token TEXT
        `
    }

];


for (
    const migration
    of quizColumnMigrations
) {

    if (
        quizColumnNames.has(
            migration.name
        )
    ) {

        continue;

    }


    await tursoDb.run(
        migration.sql
    );

}

/*
    Target siswa khusus untuk Private Quiz.

    Jika private_audience = 'all',
    tabel ini sengaja dibiarkan kosong.
*/
await tursoDb.run(`
    CREATE TABLE IF NOT EXISTS
        quiz_allowed_students
    (
        quiz_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,

        created_at DATETIME NOT NULL
            DEFAULT CURRENT_TIMESTAMP,

        PRIMARY KEY (
            quiz_id,
            student_id
        ),

        FOREIGN KEY (quiz_id)
            REFERENCES quizzes(id)
            ON DELETE CASCADE,

        FOREIGN KEY (student_id)
            REFERENCES students(id)
            ON DELETE CASCADE
    )
`);


await tursoDb.run(`
    CREATE INDEX IF NOT EXISTS
        idx_quiz_allowed_students_student

    ON quiz_allowed_students (
        student_id,
        quiz_id
    )
`);


/*
    Token harus unik agar satu link hanya
    mengarah ke satu Public Quiz.
*/
await tursoDb.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS
        idx_quizzes_public_token

    ON quizzes (
        public_token
    )

    WHERE public_token IS NOT NULL
`);


    /*
        Semua soal milik Quiz.

        question_type:
        - mcq
        - short_answer

        client_key adalah ID sementara/stabil
        dari editor browser. Ini membantu backend
        mencocokkan soal dan pilihan ketika autosave.
    */
    await tursoDb.run(`
        CREATE TABLE IF NOT EXISTS
        quiz_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            quiz_id INTEGER NOT NULL,

            client_key TEXT NOT NULL,

            question_type TEXT NOT NULL,

            question_text TEXT NOT NULL
                DEFAULT '',

correct_text_answer TEXT,

image_url TEXT,

image_public_id TEXT,

image_width INTEGER,

image_height INTEGER,

image_bytes INTEGER,

position INTEGER NOT NULL,

            created_at DATETIME NOT NULL
                DEFAULT CURRENT_TIMESTAMP,

            updated_at DATETIME NOT NULL
                DEFAULT CURRENT_TIMESTAMP,

            UNIQUE (
                quiz_id,
                client_key
            ),

            UNIQUE (
                quiz_id,
                position
            ),

            FOREIGN KEY (quiz_id)
                REFERENCES quizzes(id)
                ON DELETE CASCADE
        )
    `);

/*
    Migrasi kolom gambar soal untuk
    database yang sudah digunakan.
*/
const quizQuestionColumnRows =
    await tursoDb.all(`
        PRAGMA table_info(
            quiz_questions
        )
    `);


const quizQuestionColumnNames =
    new Set(
        quizQuestionColumnRows.map(
            row =>
                String(
                    row.name
                )
        )
    );


const quizQuestionColumnMigrations = [

    {
        name:
            "image_url",

        sql: `
            ALTER TABLE quiz_questions
            ADD COLUMN image_url TEXT
        `
    },

    {
        name:
            "image_public_id",

        sql: `
            ALTER TABLE quiz_questions
            ADD COLUMN image_public_id TEXT
        `
    },

    {
        name:
            "image_width",

        sql: `
            ALTER TABLE quiz_questions
            ADD COLUMN image_width INTEGER
        `
    },

    {
        name:
            "image_height",

        sql: `
            ALTER TABLE quiz_questions
            ADD COLUMN image_height INTEGER
        `
    },

    {
        name:
            "image_bytes",

        sql: `
            ALTER TABLE quiz_questions
            ADD COLUMN image_bytes INTEGER
        `
    }

];


for (
    const migration
    of quizQuestionColumnMigrations
) {

    if (
        quizQuestionColumnNames.has(
            migration.name
        )
    ) {

        continue;

    }


    await tursoDb.run(
        migration.sql
    );

}

    /*
        Pilihan untuk soal MCQ.

        Soal short_answer tidak mempunyai row
        pada tabel quiz_options.
    */
    await tursoDb.run(`
        CREATE TABLE IF NOT EXISTS
        quiz_options (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            question_id INTEGER NOT NULL,

            option_text TEXT NOT NULL
                DEFAULT '',

            position INTEGER NOT NULL,

            is_correct INTEGER NOT NULL
                DEFAULT 0,

            UNIQUE (
                question_id,
                position
            ),

            FOREIGN KEY (question_id)
                REFERENCES quiz_questions(id)
                ON DELETE CASCADE
        )
    `);


    /*
        Satu row adalah satu submission siswa.

        Constraint UNIQUE memastikan satu siswa
        hanya dapat submit satu kali pada Quiz
        yang sama.
    */
    await tursoDb.run(`
        CREATE TABLE IF NOT EXISTS
        quiz_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            quiz_id INTEGER NOT NULL,

            student_id INTEGER NOT NULL,

            correct_count INTEGER NOT NULL,

            total_questions INTEGER NOT NULL,

            score INTEGER NOT NULL,

            submitted_at DATETIME NOT NULL
                DEFAULT CURRENT_TIMESTAMP,

            UNIQUE (
                quiz_id,
                student_id
            ),

            FOREIGN KEY (quiz_id)
                REFERENCES quizzes(id)
                ON DELETE CASCADE,

            FOREIGN KEY (student_id)
                REFERENCES students(id)
                ON DELETE CASCADE
        )
    `);


    /*
        Jawaban siswa untuk setiap soal.

        MCQ menggunakan selected_option_id.
        Isian menggunakan text_answer.
    */
    await tursoDb.run(`
        CREATE TABLE IF NOT EXISTS
        quiz_answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            attempt_id INTEGER NOT NULL,

            question_id INTEGER NOT NULL,

            selected_option_id INTEGER,

            text_answer TEXT,

            is_correct INTEGER NOT NULL
                DEFAULT 0,

            UNIQUE (
                attempt_id,
                question_id
            ),

            FOREIGN KEY (attempt_id)
                REFERENCES quiz_attempts(id)
                ON DELETE CASCADE,

            FOREIGN KEY (question_id)
                REFERENCES quiz_questions(id)
                ON DELETE CASCADE,

            FOREIGN KEY (selected_option_id)
                REFERENCES quiz_options(id)
                ON DELETE SET NULL
        )
    `);

    /*
    Submission Guest untuk Public Quiz.

    submission_key digunakan sebagai pengenal
    internal selama batch insert. Guest tidak
    memerlukan akun siswa dan tidak mempunyai
    fitur autosave.
*/
await tursoDb.run(`
    CREATE TABLE IF NOT EXISTS
        quiz_guest_attempts
    (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        quiz_id INTEGER NOT NULL,

        submission_key TEXT NOT NULL UNIQUE,

        guest_name TEXT NOT NULL,

        correct_count INTEGER NOT NULL,

        total_questions INTEGER NOT NULL,

        score INTEGER NOT NULL,

        submitted_at DATETIME NOT NULL
            DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (quiz_id)
            REFERENCES quizzes(id)
            ON DELETE CASCADE
    )
`);


/*
    Jawaban setiap soal milik submission Guest.
*/
await tursoDb.run(`
    CREATE TABLE IF NOT EXISTS
        quiz_guest_answers
    (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        guest_attempt_id INTEGER NOT NULL,

        question_id INTEGER NOT NULL,

        selected_option_id INTEGER,

        text_answer TEXT,

        is_correct INTEGER NOT NULL
            DEFAULT 0,

        UNIQUE (
            guest_attempt_id,
            question_id
        ),

        FOREIGN KEY (guest_attempt_id)
            REFERENCES quiz_guest_attempts(id)
            ON DELETE CASCADE,

        FOREIGN KEY (question_id)
            REFERENCES quiz_questions(id)
            ON DELETE CASCADE,

        FOREIGN KEY (selected_option_id)
            REFERENCES quiz_options(id)
            ON DELETE SET NULL
    )
`);


/*
    Mempercepat halaman Responden Admin ketika
    menggabungkan siswa terdaftar dan Guest.
*/
await tursoDb.run(`
    CREATE INDEX IF NOT EXISTS
        idx_quiz_guest_attempts_quiz

    ON quiz_guest_attempts (
        quiz_id,
        submitted_at DESC
    )
`);


/*
    Mempercepat pengambilan seluruh jawaban
    dari satu submission Guest.
*/
await tursoDb.run(`
    CREATE INDEX IF NOT EXISTS
        idx_quiz_guest_answers_attempt

    ON quiz_guest_answers (
        guest_attempt_id,
        question_id
    )
`);


    /*
        Mempercepat dashboard siswa ketika
        mencari Quiz published berdasarkan deadline.
    */
    await tursoDb.run(`
        CREATE INDEX IF NOT EXISTS
        idx_quizzes_status_due

        ON quizzes (
            status,
            due_at
        )
    `);


    /*
        Mempercepat halaman Responden Admin.
    */
    await tursoDb.run(`
        CREATE INDEX IF NOT EXISTS
        idx_quiz_attempts_quiz

        ON quiz_attempts (
            quiz_id,
            submitted_at DESC
        )
    `);


    /*
        Mempercepat pencarian riwayat Quiz
        milik satu siswa.
    */
    await tursoDb.run(`
        CREATE INDEX IF NOT EXISTS
        idx_quiz_attempts_student

        ON quiz_attempts (
            student_id,
            submitted_at DESC
        )
    `);


    /*
        Mempercepat pengambilan soal berurutan.
    */
    await tursoDb.run(`
        CREATE INDEX IF NOT EXISTS
        idx_quiz_questions_quiz_position

        ON quiz_questions (
            quiz_id,
            position
        )
    `);

}


/*
    Promise disimpan supaya CREATE TABLE tidak
    dijalankan berulang oleh banyak request
    secara bersamaan.
*/
let quizTablesReadyPromise =
    null;


async function ensureQuizTables() {

    if (quizTablesReadyPromise) {

        return quizTablesReadyPromise;

    }


    quizTablesReadyPromise =
        initializeQuizTables();


    try {

        await quizTablesReadyPromise;

    } catch (error) {

        /*
            Jika Turso sedang gagal, request
            berikutnya masih boleh mencoba ulang.
        */
        quizTablesReadyPromise =
            null;


        throw error;

    }


    return quizTablesReadyPromise;

}

// ========================================
// ONLINE QUIZ - NORMALISASI
// ========================================

function normalizeQuizAnswer(
    value
) {

    return String(
        value || ""
    )

        /*
            Menyamakan representasi karakter
            Unicode yang secara visual sama.
        */
        .normalize(
            "NFKC"
        )

        /*
            Hapus spasi awal dan akhir.
        */
        .trim()

        /*
            Beberapa spasi, tab, atau line break
            berurutan diubah menjadi satu spasi.
        */
        .replace(
            /\s+/g,
            " "
        )

        /*
            Kapitalisasi tidak memengaruhi nilai.
        */
        .toLocaleLowerCase(
            "id-ID"
        );

}

function cleanQuizMetadata(
    body = {}
) {

    const title =
        String(
            body.title || ""
        )
            .trim()
            .slice(
                0,
                160
            );


    const description =
        String(
            body.description || ""
        )
            .trim()
            .slice(
                0,
                3000
            );


    const subject =
        String(
            body.subject || ""
        )
            .trim()
            .slice(
                0,
                100
            );


    const material =
        String(
            body.material || ""
        )
            .trim()
            .slice(
                0,
                160
            );


    let dueAt =
        null;


    if (body.dueAt) {

        const dueDate =
            new Date(
                body.dueAt
            );


        if (
            Number.isNaN(
                dueDate.getTime()
            )
        ) {

            throw new Error(
                "Deadline Quiz tidak valid."
            );

        }


        /*
            Database selalu menyimpan UTC.
        */
        dueAt =
            dueDate.toISOString();

    }


    return {

        /*
            Draft kosong tetap mempunyai nama
            yang dapat ditampilkan pada dashboard.
        */
        title:
            title ||
            "Quiz Tanpa Judul",

        description:
            description ||
            null,

        subject:
            subject ||
            null,

        material:
            material ||
            null,

        dueAt

    };

}

function cleanQuizQuestionImage(
    rawQuestion,
    questionNumber
) {
    const imageUrl = String(
        rawQuestion &&
        rawQuestion.imageUrl ||
        ""
    ).trim();

    const imagePublicId = String(
        rawQuestion &&
        rawQuestion.imagePublicId ||
        ""
    ).trim();

    if (!imageUrl) {
        return {
            imageUrl: null,
            imagePublicId: null,
            imageWidth: null,
            imageHeight: null,
            imageBytes: null
        };
    }

    if (imageUrl.length > 3000) {
        throw new Error(
            `URL gambar soal nomor ${questionNumber} terlalu panjang.`
        );
    }

    let parsedImageUrl;

    try {
        parsedImageUrl =
            new URL(imageUrl);
    } catch {
        throw new Error(
            `URL gambar soal nomor ${questionNumber} tidak valid.`
        );
    }

    if (
        parsedImageUrl.protocol !==
        "https:"
    ) {
        throw new Error(
            `URL gambar soal nomor ${questionNumber} harus menggunakan HTTPS.`
        );
    }

    /*
        Jika mempunyai public ID, gambarnya berasal
        dari fitur upload dan harus memakai alamat
        penyimpanan gambar yang telah dikonfigurasi.

        Jika public ID kosong, gambar merupakan URL
        eksternal dan URL disimpan langsung.
    */
    if (imagePublicId) {
        const expectedPathPrefix =
            `/${CLOUDINARY_CLOUD_NAME}/image/upload/`;

        if (
            parsedImageUrl.hostname !==
                "res.cloudinary.com" ||
            !parsedImageUrl.pathname.startsWith(
                expectedPathPrefix
            )
        ) {
            throw new Error(
                `Alamat gambar soal nomor ${questionNumber} tidak valid.`
            );
        }
    }

    const rawWidth =
        Number(rawQuestion?.imageWidth);

    const rawHeight =
        Number(rawQuestion?.imageHeight);

    const rawBytes =
        Number(rawQuestion?.imageBytes);

    const imageWidth =
        Number.isFinite(rawWidth) &&
        rawWidth > 0
            ? Math.round(rawWidth)
            : null;

    const imageHeight =
        Number.isFinite(rawHeight) &&
        rawHeight > 0
            ? Math.round(rawHeight)
            : null;

    const imageBytes =
        imagePublicId &&
        Number.isFinite(rawBytes) &&
        rawBytes > 0
            ? Math.round(rawBytes)
            : null;

    if (
        imagePublicId &&
        imageBytes !== null &&
        imageBytes >
            QUIZ_IMAGE_MAX_BYTES
    ) {
        throw new Error(
            `Gambar soal nomor ${questionNumber} melebihi batas 2 MB.`
        );
    }

    return {
        imageUrl,
        imagePublicId:
            imagePublicId || null,
        imageWidth,
        imageHeight,
        imageBytes
    };
}

function validateQuizQuestions(
    rawQuestions,
    strict = true
) {

    if (
        !Array.isArray(
            rawQuestions
        )
    ) {

        throw new Error(
            "Daftar soal Quiz tidak valid."
        );

    }


    /*
        Batasi jumlah soal agar request tidak
        dapat membuat payload tanpa batas.
    */
    if (
        rawQuestions.length >
        100
    ) {

        throw new Error(
            "Maksimal 100 soal dalam satu Quiz."
        );

    }


    const usedClientKeys =
        new Set();


    return rawQuestions.map(
        (
            rawQuestion,
            questionIndex
        ) => {

            const questionNumber =
                questionIndex + 1;


            const type =
                rawQuestion &&
                rawQuestion.type ===
                    "short_answer"

                    ? "short_answer"
                    : "mcq";


            const questionText =
                String(
                    rawQuestion &&
                    rawQuestion.text ||
                    ""
                )
                    .trim()
                    .slice(
                        0,
                        3000
                    );

                    const questionImage =
    cleanQuizQuestionImage(
        rawQuestion,
        questionNumber
    );


            /*
                clientKey harus stabil dan unik
                dalam satu Quiz.
            */
            const clientKey =
                String(
                    rawQuestion &&
                    rawQuestion.clientKey ||
                    `question-${questionNumber}`
                )
                    .trim()
                    .slice(
                        0,
                        120
                    );


            if (!clientKey) {

                throw new Error(
                    `ID internal soal nomor ${questionNumber} tidak valid.`
                );

            }


            if (
                usedClientKeys.has(
                    clientKey
                )
            ) {

                throw new Error(
                    `ID internal soal nomor ${questionNumber} duplikat.`
                );

            }


            usedClientKeys.add(
                clientKey
            );


            /*
                Saat autosave draft, pertanyaan
                belum selesai boleh disimpan.

                Saat Publish, strict bernilai true
                sehingga semua bagian wajib lengkap.
            */
if (
    strict &&
    !questionText &&
    !questionImage.imageUrl
) {
    throw new Error(
        `Soal nomor ${questionNumber} harus mempunyai teks atau gambar.`
    );
}


            /*
                ISIAN SINGKAT
            */
            if (
                type ===
                "short_answer"
            ) {

                const correctText =
                    String(
                        rawQuestion &&
                        rawQuestion.correctText ||
                        ""
                    )
                        .trim()
                        .slice(
                            0,
                            1000
                        );


                if (
                    strict &&
                    !correctText
                ) {

                    throw new Error(
                        `Kunci jawaban nomor ${questionNumber} masih kosong.`
                    );

                }


return {
    clientKey,

    type,

    text:
        questionText,

    correctText:
        correctText ||
        null,

    imageUrl:
        questionImage.imageUrl,

    imagePublicId:
        questionImage.imagePublicId,

    imageWidth:
        questionImage.imageWidth,

    imageHeight:
        questionImage.imageHeight,

    imageBytes:
        questionImage.imageBytes,

    options:
        []
};

            }


            /*
                PILIHAN GANDA
            */
            const rawOptions =
                rawQuestion &&
                Array.isArray(
                    rawQuestion.options
                )

                    ? rawQuestion.options
                    : [];


            /*
                MCQ selalu harus mempunyai empat
                slot pilihan, termasuk pada draft.
            */
            if (
                rawOptions.length !==
                4
            ) {

                throw new Error(
                    `Soal nomor ${questionNumber} harus mempunyai tepat 4 pilihan.`
                );

            }


            const options =
                rawOptions.map(
                    (
                        rawOption
                    ) => ({

                        text:
                            String(
                                rawOption &&
                                rawOption.text ||
                                ""
                            )
                                .trim()
                                .slice(
                                    0,
                                    1000
                                ),

                        isCorrect:
                            Boolean(
                                rawOption &&
                                rawOption.isCorrect
                            )

                    })
                );


            if (
                strict &&
                options.some(
                    (option) =>
                        !option.text
                )
            ) {

                throw new Error(
                    `Semua pilihan soal nomor ${questionNumber} wajib diisi.`
                );

            }


            /*
                Draft dengan pilihan kosong masih
                boleh disimpan. Pengecekan duplikat
                hanya wajib saat Publish.
            */
            if (strict) {

                const normalizedOptions =
                    options.map(
                        (option) =>
                            normalizeQuizAnswer(
                                option.text
                            )
                    );


                const uniqueOptions =
                    new Set(
                        normalizedOptions
                    );


                if (
                    uniqueOptions.size !==
                    4
                ) {

                    throw new Error(
                        `Pilihan soal nomor ${questionNumber} tidak boleh sama.`
                    );

                }

            }


            const correctOptionCount =
                options.filter(
                    (option) =>
                        option.isCorrect
                ).length;


            if (
                strict &&
                correctOptionCount !==
                    1
            ) {

                throw new Error(
                    `Pilih tepat satu jawaban benar untuk soal nomor ${questionNumber}.`
                );

            }


            /*
                Draft boleh belum mempunyai kunci,
                tetapi tidak boleh mempunyai lebih
                dari satu kunci.
            */
            if (
                !strict &&
                correctOptionCount >
                    1
            ) {

                throw new Error(
                    `Soal nomor ${questionNumber} mempunyai lebih dari satu jawaban benar.`
                );

            }


return {
    clientKey,

    type,

    text:
        questionText,

    correctText:
        null,

    imageUrl:
        questionImage.imageUrl,

    imagePublicId:
        questionImage.imagePublicId,

    imageWidth:
        questionImage.imageWidth,

    imageHeight:
        questionImage.imageHeight,

    imageBytes:
        questionImage.imageBytes,

    options
};

        }
    );

}

function parsePositiveQuizId(
    value,
    label = "ID"
) {

    const numericId =
        Number(
            value
        );


    if (
        !Number.isInteger(
            numericId
        ) ||
        numericId <= 0
    ) {

        throw new Error(
            `${label} tidak valid.`
        );

    }


    return numericId;

}

function generatePublicQuizToken() {

    return crypto
        .randomBytes(24)
        .toString("base64url");

}


function cleanQuizSettings(
    rawSettings = {}
) {

    const useTypeWeights =
        Boolean(
            rawSettings.useTypeWeights
        );


    const essayWeight =
        Math.round(
            Number(
                rawSettings.essayWeight
            )
        );


    if (
        !Number.isFinite(
            essayWeight
        ) ||
        essayWeight < 0 ||
        essayWeight > 100
    ) {

        throw new Error(
            "Bobot Esai harus berada antara 0 sampai 100."
        );

    }


    const allowPrivate =
        Boolean(
            rawSettings.allowPrivate
        );


    const allowPublic =
        Boolean(
            rawSettings.allowPublic
        );


    if (
        !allowPrivate &&
        !allowPublic
    ) {

        throw new Error(
            "Aktifkan minimal Private atau Public."
        );

    }


    const privateAudience =
        rawSettings.privateAudience ===
            "selected"
            ? "selected"
            : "all";


    const selectedStudentIds =
        [
            ...new Set(
                (
                    Array.isArray(
                        rawSettings.selectedStudentIds
                    )
                        ? rawSettings.selectedStudentIds
                        : []
                )
                    .map(
                        studentId =>
                            Number(
                                studentId
                            )
                    )
                    .filter(
                        studentId =>
                            Number.isInteger(
                                studentId
                            ) &&
                            studentId > 0
                    )
            )
        ];


    if (
        allowPrivate &&
        privateAudience ===
            "selected" &&
        selectedStudentIds.length === 0
    ) {

        throw new Error(
            "Pilih minimal satu siswa untuk Private Quiz."
        );

    }


    return {
        useTypeWeights,

        essayWeight,

        mcqWeight:
            100 - essayWeight,

        allowPrivate,

        allowPublic,

        privateAudience,

        selectedStudentIds
    };

}

// ========================================
// ONLINE QUIZ - DATA HELPERS
// ========================================

async function getQuizWithQuestions(
    quizId,
    includeAnswerKeys = false
) {

    await ensureQuizTables();


    /*
        Ambil metadata Quiz, nama pembuat,
        dan jumlah responden.
    */
    const quiz =
        await tursoDb.get(
            `
                SELECT
                    quizzes.id,
                    quizzes.title,
                    quizzes.description,
                    quizzes.subject,
                    quizzes.material,
                    quizzes.status,
                    quizzes.due_at,
                    quizzes.created_by,
                    quizzes.created_at,
                    quizzes.updated_at,
quizzes.published_at,
quizzes.use_type_weights,
quizzes.essay_weight,
quizzes.allow_private,
quizzes.allow_public,
quizzes.private_audience,
quizzes.public_token,

admins.name
                        AS creator_name,

(
    (
        SELECT COUNT(*)

        FROM quiz_attempts

        WHERE
            quiz_attempts.quiz_id =
                quizzes.id
    )

    +

    (
        SELECT COUNT(*)

        FROM quiz_guest_attempts

        WHERE
            quiz_guest_attempts.quiz_id =
                quizzes.id
    )
)
    AS response_count

                FROM quizzes

                LEFT JOIN admins
                    ON admins.id =
                        quizzes.created_by

                WHERE
                    quizzes.id = ?
            `,
            [
                quizId
            ]
        );


    if (!quiz) {

        return null;

    }

let selectedStudentIds = [];


if (
    includeAnswerKeys &&
    quiz.private_audience ===
        "selected"
) {

    const selectedStudentRows =
        await tursoDb.all(
            `
                SELECT student_id

                FROM quiz_allowed_students

                WHERE quiz_id = ?

                ORDER BY student_id ASC
            `,
            [
                quizId
            ]
        );


    selectedStudentIds =
        selectedStudentRows.map(
            row =>
                Number(
                    row.student_id
                )
        );

}


    /*
        Ambil semua soal dalam urutan editor.
    */
    const questionRows =
        await tursoDb.all(
            `
SELECT
    id,
    client_key,
    question_type,
    question_text,
    correct_text_answer,
    image_url,
    image_public_id,
    image_width,
    image_height,
    image_bytes,
    position,
                    created_at,
                    updated_at

                FROM quiz_questions

                WHERE
                    quiz_id = ?

                ORDER BY
                    position ASC,
                    id ASC
            `,
            [
                quizId
            ]
        );


    /*
        Semua pilihan diambil dalam satu query,
        bukan satu request per soal.
    */
    const optionRows =
        await tursoDb.all(
            `
                SELECT
                    quiz_options.id,
                    quiz_options.question_id,
                    quiz_options.option_text,
                    quiz_options.position,
                    quiz_options.is_correct

                FROM quiz_options

                INNER JOIN quiz_questions
                    ON quiz_questions.id =
                        quiz_options.question_id

                WHERE
                    quiz_questions.quiz_id = ?

                ORDER BY
                    quiz_questions.position ASC,
                    quiz_options.position ASC,
                    quiz_options.id ASC
            `,
            [
                quizId
            ]
        );


    /*
        Kelompokkan pilihan berdasarkan ID soal.
    */
    const optionsByQuestion =
        new Map();


    optionRows.forEach(
        (
            optionRow
        ) => {

            const questionId =
                Number(
                    optionRow.question_id
                );


            if (
                !optionsByQuestion.has(
                    questionId
                )
            ) {

                optionsByQuestion.set(
                    questionId,
                    []
                );

            }


            const option = {
                id:
                    Number(
                        optionRow.id
                    ),

                text:
                    optionRow.option_text,

                position:
                    Number(
                        optionRow.position
                    )
            };


            /*
                Kunci MCQ hanya boleh dimasukkan
                untuk request Admin/Guru.
            */
            if (includeAnswerKeys) {

                option.isCorrect =
                    Number(
                        optionRow.is_correct
                    ) === 1;

            }


            optionsByQuestion
                .get(
                    questionId
                )
                .push(
                    option
                );

        }
    );


    const questions =
        questionRows.map(
            (
                questionRow
            ) => {

                const questionId =
                    Number(
                        questionRow.id
                    );


                const question = {
                    id:
                        questionId,

                    clientKey:
                        questionRow.client_key,

                    type:
                        questionRow.question_type,

                    text:
                        questionRow.question_text,

                    imageUrl:
    questionRow.image_url ||
    null,

imagePublicId:
    questionRow.image_public_id ||
    null,

imageWidth:
    questionRow.image_width ===
        null

        ? null

        : Number(
            questionRow.image_width
        ),

imageHeight:
    questionRow.image_height ===
        null

        ? null

        : Number(
            questionRow.image_height
        ),

imageBytes:
    questionRow.image_bytes ===
        null

        ? null

        : Number(
            questionRow.image_bytes
        ),


                    position:
                        Number(
                            questionRow.position
                        ),

                    options:
                        optionsByQuestion.get(
                            questionId
                        ) ||
                        []
                };


                /*
                    Kunci Isian Singkat hanya boleh
                    dikirim ke Admin/Guru.
                */
                if (
                    includeAnswerKeys &&
                    questionRow.question_type ===
                        "short_answer"
                ) {

                    question.correctText =
                        questionRow
                            .correct_text_answer;

                }


                return question;

            }
        );


    return {
        id:
            Number(
                quiz.id
            ),

        title:
            quiz.title,

        description:
            quiz.description,

        subject:
            quiz.subject,

        material:
            quiz.material,

        status:
            quiz.status,

        dueAt:
            quiz.due_at,

        createdBy:
            Number(
                quiz.created_by
            ),

        creatorName:
            quiz.creator_name,

        createdAt:
            quiz.created_at,

        updatedAt:
            quiz.updated_at,

        publishedAt:
quiz.published_at,
publishedAt:
    quiz.published_at,


settings: {

    useTypeWeights:
        Number(
            quiz.use_type_weights ||
            0
        ) === 1,

    essayWeight:
        Number(
            quiz.essay_weight ??
            60
        ),

    mcqWeight:
        100 -
        Number(
            quiz.essay_weight ??
            60
        ),

    allowPrivate:
        Number(
            quiz.allow_private ??
            1
        ) === 1,

    allowPublic:
        Number(
            quiz.allow_public ||
            0
        ) === 1,

    privateAudience:
        quiz.private_audience ===
            "selected"
            ? "selected"
            : "all",

    selectedStudentIds:
        includeAnswerKeys
            ? selectedStudentIds
            : [],

    publicToken:
        includeAnswerKeys
            ? quiz.public_token
            : null

},


responseCount:
            Number(
                quiz.response_count ||
                0
            ),

        questionCount:
            questions.length,

        questions
    };

}

async function quizHasResponses(
    quizId
) {

    await ensureQuizTables();


    const result =
        await tursoDb.get(
            `
                SELECT
                    (
                        EXISTS (
                            SELECT
                                1

                            FROM quiz_attempts

                            WHERE
                                quiz_id = ?

                            LIMIT 1
                        )

                        OR

                        EXISTS (
                            SELECT
                                1

                            FROM quiz_guest_attempts

                            WHERE
                                quiz_id = ?

                            LIMIT 1
                        )
                    )
                        AS has_responses
            `,
            [
                quizId,
                quizId
            ]
        );


    return (
        Number(
            result &&
            result.has_responses ||
            0
        ) === 1
    );

}

function cleanGuestQuizName(
    value
) {

    const guestName =
        String(
            value || ""
        )
            .replace(
                /\s+/g,
                " "
            )
            .trim()
            .slice(
                0,
                100
            );


    if (!guestName) {

        throw new Error(
            "Nama Guest wajib diisi."
        );

    }


    return guestName;

}


function gradePublicQuizAnswers(
    quiz,
    submittedAnswers
) {

    const submittedByQuestionId =
        new Map();


    (
        Array.isArray(
            submittedAnswers
        )
            ? submittedAnswers
            : []
    ).forEach(
        submittedAnswer => {

            const questionId =
                Number(
                    submittedAnswer &&
                    submittedAnswer.questionId
                );


            if (
                Number.isInteger(
                    questionId
                ) &&
                questionId > 0
            ) {

                submittedByQuestionId.set(
                    questionId,
                    submittedAnswer
                );

            }

        }
    );


    /*
        Penilaian selalu berdasarkan daftar soal
        dari database, bukan daftar dari browser.
    */
    const gradedAnswers =
        quiz.questions.map(
            question => {

                const submittedAnswer =
                    submittedByQuestionId.get(
                        Number(
                            question.id
                        )
                    ) ||
                    {};


                /*
                    PILIHAN GANDA
                */
                if (
                    question.type ===
                        "mcq"
                ) {

                    const selectedOptionId =
                        Number(
                            submittedAnswer.optionId
                        );


                    const selectedOption =
                        question.options.find(
                            option =>
                                Number(
                                    option.id
                                ) ===
                                selectedOptionId
                        );


                    const isCorrect =
                        Boolean(
                            selectedOption &&
                            selectedOption.isCorrect
                        );


                    return {
                        questionId:
                            Number(
                                question.id
                            ),

                        questionType:
                            "mcq",

                        selectedOptionId:
                            selectedOption
                                ? Number(
                                    selectedOption.id
                                )
                                : null,

                        textAnswer:
                            null,

                        isCorrect
                    };

                }


                /*
                    ESAI / ISIAN SINGKAT
                */
                const textAnswer =
                    String(
                        submittedAnswer.textAnswer ||
                        ""
                    ).slice(
                        0,
                        3000
                    );


                const normalizedStudentAnswer =
                    normalizeQuizAnswer(
                        textAnswer
                    );


                const normalizedCorrectAnswer =
                    normalizeQuizAnswer(
                        question.correctText
                    );


                const isCorrect =
                    Boolean(
                        normalizedStudentAnswer &&
                        normalizedCorrectAnswer &&
                        normalizedStudentAnswer ===
                            normalizedCorrectAnswer
                    );


                return {
                    questionId:
                        Number(
                            question.id
                        ),

                    questionType:
                        "short_answer",

                    selectedOptionId:
                        null,

                    textAnswer,

                    isCorrect
                };

            }
        );


    const correctCount =
        gradedAnswers.filter(
            answer =>
                answer.isCorrect
        ).length;


    const totalQuestions =
        quiz.questions.length;


    const mcqAnswers =
        gradedAnswers.filter(
            answer =>
                answer.questionType ===
                    "mcq"
        );


    const essayAnswers =
        gradedAnswers.filter(
            answer =>
                answer.questionType ===
                    "short_answer"
        );


    const mcqQuestionCount =
        mcqAnswers.length;


    const essayQuestionCount =
        essayAnswers.length;


    const mcqCorrectCount =
        mcqAnswers.filter(
            answer =>
                answer.isCorrect
        ).length;


    const essayCorrectCount =
        essayAnswers.filter(
            answer =>
                answer.isCorrect
        ).length;


    const useWeightedScore =
        Boolean(
            quiz.settings &&
            quiz.settings.useTypeWeights
        ) &&
        mcqQuestionCount > 0 &&
        essayQuestionCount > 0;


    let score;


    if (useWeightedScore) {

        const rawEssayWeight =
            Number(
                quiz.settings.essayWeight
            );


        const essayWeight =
            Number.isFinite(
                rawEssayWeight
            )
                ? Math.max(
                    0,
                    Math.min(
                        100,
                        Math.round(
                            rawEssayWeight
                        )
                    )
                )
                : 60;


        const mcqWeight =
            100 -
            essayWeight;


        const mcqContribution =
            (
                mcqCorrectCount /
                mcqQuestionCount
            ) *
            mcqWeight;


        const essayContribution =
            (
                essayCorrectCount /
                essayQuestionCount
            ) *
            essayWeight;


        score =
            Math.floor(
                mcqContribution +
                essayContribution
            );

    } else {

        /*
            Full MCQ, full Esai, atau bobot mati:
            seluruh soal dihitung rata.
        */
        score =
            Math.floor(
                (
                    correctCount /
                    totalQuestions
                ) *
                100
            );

    }


    score =
        Math.max(
            0,
            Math.min(
                100,
                score
            )
        );


    return {
        gradedAnswers,

        correctCount,

        totalQuestions,

        score,

        breakdown: {
            weighted:
                useWeightedScore,

            mcqQuestionCount,

            mcqCorrectCount,

            essayQuestionCount,

            essayCorrectCount
        }
    };

}

function buildPublicQuizReview(
    quiz,
    gradedAnswers
) {

    const gradedByQuestionId =
        new Map(
            gradedAnswers.map(
                answer => [
                    Number(answer.questionId),
                    answer
                ]
            )
        );


    return quiz.questions.map(
        (
            question,
            questionIndex
        ) => {

            const gradedAnswer =
                gradedByQuestionId.get(
                    Number(question.id)
                ) || {};


            if (
                question.type ===
                "mcq"
            ) {

                const options =
                    Array.isArray(question.options)
                        ? question.options
                        : [];


                const correctOption =
                    options.find(
                        option =>
                            Boolean(option.isCorrect)
                    );


                return {
                    questionNumber:
                        questionIndex + 1,

                    questionId:
                        Number(question.id),

                    questionType:
                        "mcq",

                    questionText:
                        question.text,

                    imageUrl:
    question.imageUrl || null,

                    isCorrect:
                        Boolean(
                            gradedAnswer.isCorrect
                        ),

                    selectedOptionId:
                        gradedAnswer.selectedOptionId
                            ? Number(
                                gradedAnswer.selectedOptionId
                            )
                            : null,

                    correctOptionId:
                        correctOption
                            ? Number(correctOption.id)
                            : null,

                    options:
                        options.map(
                            option => ({
                                id:
                                    Number(option.id),

                                text:
                                    option.text
                            })
                        )
                };

            }


            return {
                questionNumber:
                    questionIndex + 1,

                questionId:
                    Number(question.id),

                questionType:
                    "short_answer",

                questionText:
                    question.text,

                imageUrl:
    question.imageUrl || null,

                isCorrect:
                    Boolean(
                        gradedAnswer.isCorrect
                    ),

                textAnswer:
                    gradedAnswer.textAnswer || "",

                correctText:
                    question.correctText || ""
            };

        }
    );

}

function parsePublicQuizToken(
    value
) {

    const token =
        String(
            value || ""
        ).trim();


    /*
        Token dibuat menggunakan base64url:
        huruf, angka, underscore, dan tanda minus.
    */
    if (
        token.length < 20 ||
        token.length > 100 ||
        !/^[A-Za-z0-9_-]+$/.test(
            token
        )
    ) {

        throw new Error(
            "Link Public Quiz tidak valid."
        );

    }


    return token;

}


function getPublicQuizAvailabilityError(
    quiz
) {

    if (!quiz) {

        return {
            status:
                404,

            code:
                "PUBLIC_QUIZ_NOT_FOUND",

            message:
                "Public Quiz tidak ditemukan."
        };

    }


    if (
        !quiz.settings ||
        quiz.settings.allowPublic !==
            true
    ) {

        return {
            status:
                404,

            code:
                "PUBLIC_QUIZ_DISABLED",

            message:
                "Akses Public untuk Quiz ini tidak aktif."
        };

    }


    if (
        quiz.status ===
            "closed"
    ) {

        return {
            status:
                410,

            code:
                "PUBLIC_QUIZ_CLOSED",

            message:
                "Quiz ini telah ditutup oleh Guru."
        };

    }


    if (
        quiz.status !==
            "published"
    ) {

        return {
            status:
                409,

            code:
                "PUBLIC_QUIZ_NOT_PUBLISHED",

            message:
                "Quiz ini belum dipublikasikan."
        };

    }


    if (
        quiz.dueAt &&
        new Date(
            quiz.dueAt
        ).getTime() <=
            Date.now()
    ) {

        return {
            status:
                410,

            code:
                "PUBLIC_QUIZ_DEADLINE_PASSED",

            message:
                "Deadline Quiz ini telah berakhir."
        };

    }


    if (
        !Array.isArray(
            quiz.questions
        ) ||
        quiz.questions.length ===
            0
    ) {

        return {
            status:
                409,

            code:
                "PUBLIC_QUIZ_HAS_NO_QUESTIONS",

            message:
                "Quiz ini belum mempunyai soal."
        };

    }


    return null;

}

async function getStudentQuizAvailabilityError(
    quiz,
    studentId
) {

    if (!quiz) {

        return {
            status:
                404,

            message:
                "Quiz tidak ditemukan."
        };

    }


    if (
        quiz.status !==
        "published"
    ) {

        return {
            status:
                404,

            message:
                "Quiz tidak tersedia."
        };

    }


    /*
        Quiz Public-only tidak boleh dibuka
        melalui halaman siswa terdaftar.
    */
    if (
        !quiz.settings ||
        quiz.settings.allowPrivate !==
            true
    ) {

        return {
            status:
                403,

            message:
                "Quiz ini tidak tersedia untuk akun siswa."
        };

    }


    /*
        Jika Guru memilih siswa tertentu,
        pastikan siswa yang sedang login
        memang berada di daftar tersebut.
    */
    if (
        quiz.settings.privateAudience ===
            "selected"
    ) {

        const allowedStudent =
            await tursoDb.get(
                `
                    SELECT
                        1 AS allowed

                    FROM quiz_allowed_students

                    WHERE
                        quiz_id = ?
                        AND student_id = ?

                    LIMIT 1
                `,
                [
                    Number(
                        quiz.id
                    ),

                    Number(
                        studentId
                    )
                ]
            );


        if (!allowedStudent) {

            return {
                status:
                    403,

                message:
                    "Quiz ini tidak ditujukan untuk akunmu."
            };

        }

    }


    if (
        quiz.dueAt &&
        new Date(
            quiz.dueAt
        ).getTime() <=
            Date.now()
    ) {

        return {
            status:
                410,

            message:
                "Deadline Quiz sudah berakhir."
        };

    }


    return null;

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
// MASTER MAPEL
// ========================================

async function ensureSubjectsTable() {

    await tursoDb.run(`
        CREATE TABLE IF NOT EXISTS subjects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL COLLATE NOCASE UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);


    /*
        Masukkan otomatis semua mapel lama
        yang sudah pernah digunakan dalam nilai.
    */
    await tursoDb.run(`
        INSERT OR IGNORE INTO subjects (
            name
        )
        SELECT DISTINCT
            TRIM(subject)
        FROM exam_scores
        WHERE
            subject IS NOT NULL
            AND TRIM(subject) <> ''
    `);

}



// ========================================
// CLASSROOM FEED MODERATION
// ========================================

async function initializeFeedModerationTables() {

    await tursoDb.run(`
        CREATE TABLE IF NOT EXISTS feed_moderation (
            student_id INTEGER PRIMARY KEY,
            status TEXT NOT NULL DEFAULT 'active',
            muted_until DATETIME,
            reason TEXT,
            moderated_by INTEGER,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (student_id)
                REFERENCES students(id)
                ON DELETE CASCADE
        )
    `);


    await tursoDb.run(`
        CREATE TABLE IF NOT EXISTS feed_moderation_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            seen_at DATETIME,

            FOREIGN KEY (student_id)
                REFERENCES students(id)
                ON DELETE CASCADE
        )
    `);


await tursoDb.run(`
    CREATE INDEX IF NOT EXISTS
    idx_feed_moderation_events_student
    ON feed_moderation_events (
        student_id,
        id DESC
    )
`);


/*
    Satu row = satu tindakan moderation.

    Untuk Mute:
    - active = sedang berjalan
    - queued = menunggu mute sebelumnya
    - completed = selesai normal
    - lifted = dihentikan Admin/Guru

    Nanti sistem Ban juga bisa memakai
    tabel ini tanpa bongkar arsitektur lagi.
*/
await tursoDb.run(`
    CREATE TABLE IF NOT EXISTS
    feed_moderation_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        student_id INTEGER NOT NULL,

        action_type TEXT NOT NULL,

        status TEXT NOT NULL,

        duration_minutes INTEGER,

        starts_at DATETIME,

        ends_at DATETIME,

        reason TEXT,

        moderated_by INTEGER,

        created_at DATETIME
            DEFAULT CURRENT_TIMESTAMP,

        completed_at DATETIME,

        lifted_at DATETIME,

        FOREIGN KEY (student_id)
            REFERENCES students(id)
            ON DELETE CASCADE
    )
`);


await tursoDb.run(`
    CREATE INDEX IF NOT EXISTS
    idx_feed_moderation_actions_student
    ON feed_moderation_actions (
        student_id,
        action_type,
        status,
        id
    )
`);

}

/*
    Simpan proses inisialisasi tabel agar
    CREATE TABLE dan CREATE INDEX tidak
    dijalankan berulang pada setiap request.
*/
let feedModerationTablesReadyPromise =
    null;


async function ensureFeedModerationTables() {

    if (
        feedModerationTablesReadyPromise
    ) {

        return (
            feedModerationTablesReadyPromise
        );

    }


    feedModerationTablesReadyPromise =
        initializeFeedModerationTables();


    try {

        await feedModerationTablesReadyPromise;

    } catch (error) {

        /*
            Jika koneksi database gagal,
            izinkan request berikutnya mencoba
            melakukan inisialisasi kembali.
        */
        feedModerationTablesReadyPromise =
            null;


        throw error;

    }

}

// ========================================
// SYNC MUTE QUEUE SISWA
// ========================================

async function syncStudentMuteQueue(
    studentId
) {

    await ensureFeedModerationTables();


    let moderation =
        await tursoDb.get(
            `
                SELECT
                    student_id,
                    status,
                    muted_until,
                    reason,
                    moderated_by,
                    updated_at
                FROM feed_moderation
                WHERE student_id = ?
            `,
            [
                studentId
            ]
        );


    /*
        BAN tetap prioritas tertinggi.

        Untuk sekarang Ban belum kita ubah
        ke card system.
    */
    if (
        moderation &&
        moderation.status ===
            "banned"
    ) {

        return moderation;

    }


    const nowMs =
        Date.now();


    /*
        =====================================
        MIGRASI MUTE LAMA
        =====================================

        Kalau ada mute dari sistem lama
        tetapi belum punya action card,
        pindahkan sekali ke tabel baru.
    */
    let activeAction =
        await tursoDb.get(
            `
                SELECT *
                FROM feed_moderation_actions
                WHERE
                    student_id = ?
                    AND action_type = 'mute'
                    AND status = 'active'
                ORDER BY id ASC
                LIMIT 1
            `,
            [
                studentId
            ]
        );


    let queuedAction =
        await tursoDb.get(
            `
                SELECT *
                FROM feed_moderation_actions
                WHERE
                    student_id = ?
                    AND action_type = 'mute'
                    AND status = 'queued'
                ORDER BY id ASC
                LIMIT 1
            `,
            [
                studentId
            ]
        );


    if (
        !activeAction &&
        !queuedAction &&
        moderation &&
        moderation.status ===
            "muted" &&
        moderation.muted_until
    ) {

        const legacyEndMs =
            new Date(
                moderation.muted_until
            ).getTime();


        if (
            !Number.isNaN(
                legacyEndMs
            ) &&
            legacyEndMs >
                nowMs
        ) {

            const remainingMinutes =
                Math.max(
                    1,
                    Math.ceil(
                        (
                            legacyEndMs -
                            nowMs
                        ) /
                        60000
                    )
                );


            await tursoDb.run(
                `
                    INSERT INTO
                    feed_moderation_actions (
                        student_id,
                        action_type,
                        status,
                        duration_minutes,
                        starts_at,
                        ends_at,
                        reason,
                        moderated_by
                    )
                    VALUES (
                        ?,
                        'mute',
                        'active',
                        ?,
                        ?,
                        ?,
                        ?,
                        ?
                    )
                `,
                [
                    studentId,
                    remainingMinutes,
                    new Date(
                        nowMs
                    ).toISOString(),
                    moderation.muted_until,
                    moderation.reason ||
                        null,
                    moderation.moderated_by ||
                        null
                ]
            );

        }

    }


    /*
        =====================================
        SELESAIKAN ACTIVE MUTE YANG EXPIRED
        =====================================
    */

    activeAction =
        await tursoDb.get(
            `
                SELECT *
                FROM feed_moderation_actions
                WHERE
                    student_id = ?
                    AND action_type = 'mute'
                    AND status = 'active'
                ORDER BY id ASC
                LIMIT 1
            `,
            [
                studentId
            ]
        );


    if (
        activeAction &&
        activeAction.ends_at
    ) {

        const activeEndMs =
            new Date(
                activeAction.ends_at
            ).getTime();


        if (
            !Number.isNaN(
                activeEndMs
            ) &&
            activeEndMs <=
                Date.now()
        ) {

            await tursoDb.run(
                `
                    UPDATE
                        feed_moderation_actions
                    SET
                        status = 'completed',
                        completed_at =
                            CURRENT_TIMESTAMP
                    WHERE
                        id = ?
                        AND status = 'active'
                `,
                [
                    activeAction.id
                ]
            );


            activeAction =
                null;

        }

    }


    /*
        =====================================
        AKTIFKAN QUEUE BERIKUTNYA
        =====================================

        starts_at dan ends_at baru dihitung
        ketika card BENAR-BENAR mulai.

        Jadi mute queued 1 hari tetap mendapat
        1 hari penuh.
    */

    if (!activeAction) {

        queuedAction =
            await tursoDb.get(
                `
                    SELECT *
                    FROM feed_moderation_actions
                    WHERE
                        student_id = ?
                        AND action_type = 'mute'
                        AND status = 'queued'
                    ORDER BY id ASC
                    LIMIT 1
                `,
                [
                    studentId
                ]
            );


        if (queuedAction) {

            const startMs =
                Date.now();


            const endMs =
                startMs +
                (
                    Number(
                        queuedAction
                            .duration_minutes
                    ) *
                    60 *
                    1000
                );


            const startsAt =
                new Date(
                    startMs
                ).toISOString();


            const endsAt =
                new Date(
                    endMs
                ).toISOString();


            const activationResult =
                await tursoDb.run(
                    `
                        UPDATE
                            feed_moderation_actions
                        SET
                            status = 'active',
                            starts_at = ?,
                            ends_at = ?
                        WHERE
                            id = ?
                            AND status = 'queued'
                    `,
                    [
                        startsAt,
                        endsAt,
                        queuedAction.id
                    ]
                );


            if (
                Number(
                    activationResult.changes ||
                    0
                ) > 0
            ) {

                activeAction = {
                    ...queuedAction,

                    status:
                        "active",

                    starts_at:
                        startsAt,

                    ends_at:
                        endsAt
                };

            } else {

                /*
                    Kalau ada request lain yang
                    mengaktifkan queue bersamaan,
                    ambil kondisi terbaru.
                */
                activeAction =
                    await tursoDb.get(
                        `
                            SELECT *
                            FROM
                                feed_moderation_actions
                            WHERE
                                student_id = ?
                                AND action_type =
                                    'mute'
                                AND status =
                                    'active'
                            ORDER BY id ASC
                            LIMIT 1
                        `,
                        [
                            studentId
                        ]
                    );

            }

        }

    }


    /*
        =====================================
        ADA ACTIVE MUTE
        =====================================
    */

    if (activeAction) {

        await tursoDb.run(
            `
                INSERT INTO feed_moderation (
                    student_id,
                    status,
                    muted_until,
                    reason,
                    moderated_by,
                    updated_at
                )
                VALUES (
                    ?,
                    'muted',
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP
                )

                ON CONFLICT(student_id)
                DO UPDATE SET
                    status =
                        'muted',

                    muted_until =
                        excluded.muted_until,

                    reason =
                        excluded.reason,

                    moderated_by =
                        excluded.moderated_by,

                    updated_at =
                        CURRENT_TIMESTAMP
            `,
            [
                studentId,
                activeAction.ends_at,
                activeAction.reason ||
                    null,
                activeAction.moderated_by ||
                    null
            ]
        );


        return {
            student_id:
                studentId,

            status:
                "muted",

            muted_until:
                activeAction.ends_at,

            reason:
                activeAction.reason ||
                null,

            moderated_by:
                activeAction.moderated_by ||
                null,

            action_id:
                Number(
                    activeAction.id
                )
        };

    }


    /*
        =====================================
        TIDAK ADA ACTIVE / QUEUED MUTE
        =====================================

        Baru SEKARANG siswa benar-benar
        dianggap pulih.
    */

    const remainingQueue =
        await tursoDb.get(
            `
                SELECT id
                FROM feed_moderation_actions
                WHERE
                    student_id = ?
                    AND action_type = 'mute'
                    AND status = 'queued'
                ORDER BY id ASC
                LIMIT 1
            `,
            [
                studentId
            ]
        );


    if (remainingQueue) {

        /*
            Guard saja. Normalnya queue sudah
            diaktifkan di atas.
        */
        return syncStudentMuteQueue(
            studentId
        );

    }


    const recoveryResult =
        await tursoDb.run(
            `
                UPDATE feed_moderation
                SET
                    status = 'active',
                    muted_until = NULL,
                    reason = NULL,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE
                    student_id = ?
                    AND status = 'muted'
            `,
            [
                studentId
            ]
        );


    /*
        Event "unmuted" HANYA dibuat setelah
        seluruh queue benar-benar habis.
    */
    if (
        Number(
            recoveryResult.changes ||
            0
        ) > 0
    ) {

        await tursoDb.run(
            `
                INSERT INTO
                feed_moderation_events (
                    student_id,
                    event_type,
                    reason
                )
                VALUES (
                    ?,
                    'unmuted',
                    ?
                )
            `,
            [
                studentId,
                "Seluruh durasi mute telah selesai."
            ]
        );

    }


    return {
        student_id:
            studentId,

        status:
            "active",

        muted_until:
            null,

        reason:
            null,

        moderated_by:
            null,

        action_id:
            null
    };

}


// ========================================
// AMBIL DAFTAR CARD MUTE SISWA
// ========================================

async function getStudentMuteActions(
    studentId,
    skipQueueSync = false
) {

    /*
        Pada beberapa route, queue sudah
        disinkronkan tepat sebelum fungsi ini
        dipanggil.

        skipQueueSync mencegah proses database
        yang sama dijalankan dua kali.
    */
    if (!skipQueueSync) {

        await syncStudentMuteQueue(
            studentId
        );

    }


    return tursoDb.all(
        `
            SELECT
                id,
                student_id,
                action_type,
                status,
                duration_minutes,
                starts_at,
                ends_at,
                reason,
                moderated_by,
                created_at,
                completed_at,
                lifted_at
            FROM feed_moderation_actions
            WHERE
                student_id = ?
                AND action_type = 'mute'
                AND status IN (
                    'active',
                    'queued'
                )
            ORDER BY
                CASE
                    WHEN status = 'active'
                        THEN 0
                    ELSE 1
                END,
                id ASC
        `,
        [
            studentId
        ]
    );

}


// ========================================
// STATUS MODERATION SISWA
// ========================================

async function getStudentFeedModeration(
    studentId
) {

    return syncStudentMuteQueue(
        studentId
    );

}

async function requireStudentFeedAccess(
    studentId
) {

    const moderation =
        await getStudentFeedModeration(
            studentId
        );


    if (
        moderation.status ===
        "banned"
    ) {

        return {
            allowed:
                false,

            moderation
        };

    }


    if (
        moderation.status ===
        "muted"
    ) {

        return {
            allowed:
                false,

            moderation
        };

    }


    return {
        allowed:
            true,

        moderation
    };

}

// ========================================
// PROTEKSI CLASSROOM FEED SISWA
// MUTE / BAN
// ========================================

function isStudentClassroomFeedRequest(
    req
) {

    const requestPath =
        req.path;


    /*
        Endpoint moderation sendiri
        HARUS tetap bisa diakses.

        Ini dipakai frontend untuk:
        - mendeteksi mute / ban LIVE
        - mendeteksi unmute / unban
        - menandai recovery event seen
    */
    if (
        /^\/api\/student\/\d+\/feed-moderation(?:\/|$)/
            .test(
                requestPath
            )
    ) {

        return false;

    }


    /*
        Semua API Classroom Feed
        yang memakai prefix student.
    */
    if (
        /^\/api\/student\/\d+\/announcements(?:\/|$)/
            .test(
                requestPath
            )
    ) {

        return true;

    }


    if (
        /^\/api\/student\/\d+\/replies\/live$/
            .test(
                requestPath
            )
    ) {

        return true;

    }


    if (
        /^\/api\/student\/\d+\/classroom-feed\/state$/
            .test(
                requestPath
            )
    ) {

        return true;

    }


    /*
        Notification Classroom Feed siswa
        juga tidak boleh bisa dibuka
        saat sedang mute / ban.
    */
if (
    /^\/api\/student\/\d+\/notifications(?:\/|$)/
        .test(
            requestPath
        )
) {

    return true;

}


/*
    Mark-read notification memakai
    endpoint generic.

    Tetap bagian Classroom Feed
    ketika session aktif adalah Student.
*/
if (
    /^\/api\/notifications\/\d+\/read$/
        .test(
            requestPath
        )
) {

    return true;

}


/*
    Route reply lama tidak memakai
        /api/student prefix.

        Admin juga memakai route feed,
        jadi yang diblokir nanti hanya
        ketika session aktif adalah Student.
    */
    if (
        /^\/api\/announcements\/\d+\/replies(?:\/\d+)?$/
            .test(
                requestPath
            )
    ) {

        return true;

    }


    /*
        Autocomplete mention juga merupakan
        bagian Classroom Feed.
    */
    if (
        requestPath ===
        "/api/admin/users/mention-list"
    ) {

        return true;

    }


    return false;

}

// ========================================
// ENFORCEMENT MUTE / BAN SISWA
// ========================================

app.use(
    async (
        req,
        res,
        next
    ) => {

        /*
            Tidak ada session Student:
            bukan urusan middleware ini.

            Request Admin tetap jalan normal.
        */
        if (
            !req.session.studentId
        ) {

            return next();

        }


        /*
            Hanya periksa request yang benar-benar
            berkaitan dengan Classroom Feed.
        */
        if (
            !isStudentClassroomFeedRequest(
                req
            )
        ) {

            return next();

        }


        const studentId =
            Number(
                req.session.studentId
            );


        if (
            !Number.isInteger(
                studentId
            )
        ) {

            return res
                .status(401)
                .json({
                    success:
                        false,

                    message:
                        "Session siswa tidak valid."
                });

        }


        try {

            const access =
                await requireStudentFeedAccess(
                    studentId
                );


            if (
                access.allowed
            ) {

                return next();

            }


            const moderation =
                access.moderation;


            return res
                .status(403)
                .json({
                    success:
                        false,

                    code:
                        "FEED_MODERATED",

                    message:
                        moderation.status ===
                            "banned"
                            ? "Akses Classroom Feed kamu sedang dinonaktifkan."
                            : "Akses Classroom Feed kamu sedang dibatasi sementara.",

                    moderation:
                        {
                            status:
                                moderation.status,

                            mutedUntil:
                                moderation.muted_until ||
                                null,

                            reason:
                                moderation.reason ||
                                null
                        }
                });


        } catch (error) {

            console.error(
                "Error proteksi Classroom Feed siswa:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Gagal memeriksa akses Classroom Feed."
                });

        }

    }
);


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
// STUDENT SEARCH
// ========================================

function mapStudentSearchResult(student) {

    return {
        id:
            Number(student.id),

        name:
            student.name,

        fullName:
            student.full_name ||
            student.name,

        className:
            student.class_name,

        bio:
            String(
                student.profile_bio ||
                ""
            ),

        bannerColor:
            String(
                student.profile_banner_color ||
                "blue"
            ),

        profilePictureUrl:
            student.profile_picture_url ||
            null
    };

}


async function getStudentAcademicStats(
    studentId
) {

    const [
        pointResult,
        scoreResult
    ] = await Promise.all([

        tursoDb.get(
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
        ),

        tursoDb.get(
            `
                SELECT
                    AVG(score)
                        AS average_score

                FROM exam_scores

                WHERE student_id = ?
            `,
            [
                studentId
            ]
        )

    ]);


    const averageScore =
        scoreResult?.average_score === null ||
        scoreResult?.average_score === undefined
            ? null
            : Number(
                Number(
                    scoreResult.average_score
                ).toFixed(2)
            );


    return {
        totalPoints:
            Number(
                pointResult?.total_points ||
                0
            ),

        averageScore
    };

}


// ========================================
// ADMIN - CARI SISWA
// ========================================

app.get(
    "/api/admin/student-search",
    async (req, res) => {

        if (!req.session.adminId) {

            return res.status(401).json({
                success: false,
                message:
                    "Harus login sebagai Admin / Guru."
            });

        }


        const query =
            String(
                req.query.q ||
                ""
            ).trim();


        if (
            query.length < 2 ||
            query.length > 80
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Pencarian harus berisi 2 sampai 80 karakter."
            });

        }


        try {

            await ensureStudentProfileColumns();


            const students =
                await tursoDb.all(
                    `
                        SELECT
                            id,
                            name,
                            full_name,
                            class_name,
                            profile_bio,
                            profile_banner_color,
                            profile_picture_url

                        FROM students

                        WHERE
                            instr(
                                lower(
                                    COALESCE(
                                        full_name,
                                        ''
                                    )
                                ),
                                lower(?)
                            ) > 0

                            OR instr(
                                lower(
                                    COALESCE(
                                        name,
                                        ''
                                    )
                                ),
                                lower(?)
                            ) > 0

                            OR instr(
                                lower(
                                    COALESCE(
                                        class_name,
                                        ''
                                    )
                                ),
                                lower(?)
                            ) > 0

                            OR instr(
                                lower(
                                    COALESCE(
                                        login_code,
                                        ''
                                    )
                                ),
                                lower(?)
                            ) > 0

                        ORDER BY
                            CASE
                                WHEN lower(
                                    COALESCE(
                                        full_name,
                                        name
                                    )
                                ) = lower(?)
                                    THEN 0

                                WHEN lower(
                                    COALESCE(
                                        name,
                                        ''
                                    )
                                ) = lower(?)
                                    THEN 1

                                ELSE 2
                            END,

                            full_name
                                COLLATE NOCASE ASC,

                            id ASC

                        LIMIT 12
                    `,
                    [
                        query,
                        query,
                        query,
                        query,
                        query,
                        query
                    ]
                );


            res.set(
                "Cache-Control",
                "private, no-store"
            );


            return res.json({
                success: true,

                students:
                    students.map(
                        mapStudentSearchResult
                    )
            });

        } catch (error) {

            console.error(
                "Gagal mencari siswa untuk admin:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Pencarian siswa tidak dapat dimuat."
            });

        }

    }
);


// ========================================
// ADMIN - DETAIL PROFILE SISWA
// ========================================

app.get(
    "/api/admin/students/:studentId/profile",
    async (req, res) => {

        if (!req.session.adminId) {

            return res.status(401).json({
                success: false,
                message:
                    "Harus login sebagai Admin / Guru."
            });

        }


        const studentId =
            Number(
                req.params.studentId
            );


        if (
            !Number.isInteger(studentId) ||
            studentId <= 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "ID siswa tidak valid."
            });

        }


        try {

            await ensureStudentProfileColumns();


            const student =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            login_code,
                            name,
                            full_name,
                            date_of_birth,
                            class_name,
                            profile_bio,
                            profile_banner_color,
                            profile_picture_url,
                            profile_show_academic_stats

                        FROM students

                        WHERE id = ?

                        LIMIT 1
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


            const academicStats =
                await getStudentAcademicStats(
                    studentId
                );


            res.set(
                "Cache-Control",
                "private, no-store"
            );


            return res.json({

                success: true,

                student: {

                    id:
                        Number(student.id),

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

                    bio:
                        String(
                            student.profile_bio ||
                            ""
                        ),

                    bannerColor:
                        String(
                            student.profile_banner_color ||
                            "blue"
                        ),

                    profilePictureUrl:
                        student.profile_picture_url ||
                        null,

                    showAcademicStats:
                        Number(
                            student.profile_show_academic_stats ||
                            0
                        ) === 1,

                    totalPoints:
                        academicStats.totalPoints,

                    averageScore:
                        academicStats.averageScore

                }

            });

        } catch (error) {

            console.error(
                "Gagal memuat profil siswa untuk admin:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Profil siswa tidak dapat dimuat."
            });

        }

    }
);


// ========================================
// SISWA - CARI SISWA
// ========================================

app.get(
    "/api/student/search",
    async (req, res) => {

        if (!req.session.studentId) {

            return res.status(401).json({
                success: false,
                message:
                    "Harus login sebagai siswa."
            });

        }


        const query =
            String(
                req.query.q ||
                ""
            ).trim();


        if (
            query.length < 2 ||
            query.length > 80
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Pencarian harus berisi 2 sampai 80 karakter."
            });

        }


        try {

            await ensureStudentProfileColumns();


            const students =
                await tursoDb.all(
                    `
                        SELECT
                            id,
                            name,
                            full_name,
                            class_name,
                            profile_bio,
                            profile_banner_color,
                            profile_picture_url

                        FROM students

                        WHERE
                            instr(
                                lower(
                                    COALESCE(
                                        full_name,
                                        ''
                                    )
                                ),
                                lower(?)
                            ) > 0

                            OR instr(
                                lower(
                                    COALESCE(
                                        name,
                                        ''
                                    )
                                ),
                                lower(?)
                            ) > 0

                            OR instr(
                                lower(
                                    COALESCE(
                                        class_name,
                                        ''
                                    )
                                ),
                                lower(?)
                            ) > 0

                        ORDER BY
                            CASE
                                WHEN lower(
                                    COALESCE(
                                        full_name,
                                        name
                                    )
                                ) = lower(?)
                                    THEN 0

                                WHEN lower(
                                    COALESCE(
                                        name,
                                        ''
                                    )
                                ) = lower(?)
                                    THEN 1

                                ELSE 2
                            END,

                            full_name
                                COLLATE NOCASE ASC,

                            id ASC

                        LIMIT 12
                    `,
                    [
                        query,
                        query,
                        query,
                        query,
                        query
                    ]
                );


            res.set(
                "Cache-Control",
                "private, no-store"
            );


            return res.json({
                success: true,

                students:
                    students.map(
                        mapStudentSearchResult
                    )
            });

        } catch (error) {

            console.error(
                "Gagal mencari siswa:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Pencarian siswa tidak dapat dimuat."
            });

        }

    }
);


// ========================================
// SISWA - PROFILE PUBLIK SISWA
// ========================================

app.get(
    "/api/student/profiles/:studentId",
    async (req, res) => {

        if (!req.session.studentId) {

            return res.status(401).json({
                success: false,
                message:
                    "Harus login sebagai siswa."
            });

        }


        const viewerId =
            Number(
                req.session.studentId
            );


        const studentId =
            Number(
                req.params.studentId
            );


        if (
            !Number.isInteger(studentId) ||
            studentId <= 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "ID siswa tidak valid."
            });

        }


        try {

            await ensureStudentProfileColumns();


            /*
                Data privat seperti login_code dan
                date_of_birth sengaja tidak dipilih.
                Jadi tidak mungkin bocor ke browser.
            */
            const student =
                await tursoDb.get(
                    `
                        SELECT
id,
name,
full_name,
date_of_birth,
class_name,
profile_bio,
                            profile_banner_color,
                            profile_picture_url,
                            profile_show_academic_stats

                        FROM students

                        WHERE id = ?

                        LIMIT 1
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


            const showAcademicStats =
                viewerId === studentId ||

                Number(
                    student.profile_show_academic_stats ||
                    0
                ) === 1;


            let totalPoints =
                null;

            let averageScore =
                null;


            /*
                Query poin dan nilai hanya dijalankan
                jika memang boleh dilihat.
            */
            if (showAcademicStats) {

                const academicStats =
                    await getStudentAcademicStats(
                        studentId
                    );


                totalPoints =
                    academicStats.totalPoints;

                averageScore =
                    academicStats.averageScore;

            }


            res.set(
                "Cache-Control",
                "private, no-store"
            );


            return res.json({

                success: true,

                student: {

                    id:
                        Number(student.id),

                    name:
                        student.name,

fullName:
    student.full_name ||
    student.name,

dateOfBirth:
    student.date_of_birth,

className:
    student.class_name,

                    bio:
                        String(
                            student.profile_bio ||
                            ""
                        ),

                    bannerColor:
                        String(
                            student.profile_banner_color ||
                            "blue"
                        ),

                    profilePictureUrl:
                        student.profile_picture_url ||
                        null,

                    showAcademicStats,

                    totalPoints,

                    averageScore

                }

            });

        } catch (error) {

            console.error(
                "Gagal memuat profil publik siswa:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Profil siswa tidak dapat dimuat."
            });

        }

    }
);

// ========================================
// DAFTAR SISWA - FEED MODERATION
// ========================================

app.get(
    "/api/admin/feed-moderation/students",
    async (req, res) => {

        if (
            !req.session.adminId
        ) {

            return res
                .status(401)
                .json({
                    success:
                        false,

                    message:
                        "Harus login sebagai Admin / Guru."
                });

        }


        try {
await ensureFeedModerationTables();


/*
    Pastikan mute yang sudah habis
    langsung dipulihkan sebelum
    daftar moderation dikirim ke Admin.
*/
/*
    Sinkronkan hanya siswa yang punya
    mute aktif / antrean.

    Kalau card aktif habis:
    - completed
    - queue berikutnya langsung active
    - tidak muncul unmuted di tengah.
*/
/*
    Dashboard hanya perlu menjalankan queue sync
    apabila ada kondisi yang benar-benar harus
    berubah.

    Kondisi tersebut:
    1. Mute aktif sudah mencapai waktu berakhir.
    2. Ada antrean tetapi tidak ada Mute aktif.
    3. Ada snapshot Mute lama yang belum memiliki
       action card.
*/
const muteQueueStudents =
    await tursoDb.all(`
        SELECT DISTINCT
            active.student_id

        FROM
            feed_moderation_actions active

        WHERE
            active.action_type =
                'mute'

            AND active.status =
                'active'

            AND active.ends_at
                IS NOT NULL

            AND julianday(
                active.ends_at
            ) <= julianday(
                'now'
            )


        UNION


        SELECT DISTINCT
            queued.student_id

        FROM
            feed_moderation_actions queued

        WHERE
            queued.action_type =
                'mute'

            AND queued.status =
                'queued'

            AND NOT EXISTS (
                SELECT
                    1

                FROM
                    feed_moderation_actions running

                WHERE
                    running.student_id =
                        queued.student_id

                    AND running.action_type =
                        'mute'

                    AND running.status =
                        'active'
            )


        UNION


        SELECT
            moderation.student_id

        FROM
            feed_moderation moderation

        WHERE
            moderation.status =
                'muted'

            AND NOT EXISTS (
                SELECT
                    1

                FROM
                    feed_moderation_actions action

                WHERE
                    action.student_id =
                        moderation.student_id

                    AND action.action_type =
                        'mute'

                    AND action.status IN (
                        'active',
                        'queued'
                    )
            )
    `);


/*
    Setiap row mempunyai student_id berbeda.

    Karena itu, sinkronisasi beberapa siswa
    boleh berjalan bersamaan tanpa membuat
    dua proses mengubah queue siswa yang sama.
*/
await Promise.all(
    muteQueueStudents.map(
        (row) =>
            syncStudentMuteQueue(
                Number(
                    row.student_id
                )
            )
    )
);


const students =
    await tursoDb.all(`
                    SELECT
                        s.id,
                        s.name,
                        s.class_name,

                        COALESCE(
                            fm.status,
                            'active'
                        ) AS moderation_status,

                        fm.muted_until,
                        fm.reason,
                        fm.updated_at

                    FROM students s

                    LEFT JOIN
                        feed_moderation fm
                    ON
                        fm.student_id =
                            s.id

                    ORDER BY
                        s.name
                        COLLATE NOCASE
                        ASC
                `);

const moderationActions =
    await tursoDb.all(
        `
            SELECT
                fma.id,
                fma.student_id,
                fma.action_type,
                fma.status,
                fma.duration_minutes,
                fma.starts_at,
                fma.ends_at,
                fma.reason,
                fma.moderated_by,
                fma.created_at,

                s.name AS student_name,
                s.class_name AS student_class,

                a.name AS moderator_name,
                a.role AS moderator_role

            FROM feed_moderation_actions fma

            INNER JOIN students s
                ON s.id =
                    fma.student_id

            LEFT JOIN admins a
                ON a.id =
                    fma.moderated_by

            WHERE
                fma.status IN (
                    'active',
                    'queued'
                )

            ORDER BY
                CASE
                    WHEN fma.status =
                        'active'
                        THEN 0
                    ELSE 1
                END,

                fma.student_id ASC,
                fma.id ASC
        `
    );

return res.json({
    success:
        true,

    serverNow:
        new Date().toISOString(),

    students,

    moderationActions:
        Array.isArray(
            moderationActions
        )
            ? moderationActions
            : []
});


        } catch (error) {

            console.error(
                "Error mengambil siswa moderation:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Gagal mengambil data moderation."
                });

        }

    }
);

// ========================================
// MUTE SISWA DARI CLASSROOM FEED
// ========================================

app.post(
    "/api/admin/feed-moderation/:studentId/mute",
    async (req, res) => {

        if (
            !req.session.adminId
        ) {

            return res
                .status(401)
                .json({
                    success:
                        false,

                    message:
                        "Harus login sebagai Admin / Guru."
                });

        }


        const studentId =
            Number(
                req.params.studentId
            );

        const durationMinutes =
            Number(
                req.body.durationMinutes
            );

        const reason =
            String(
                req.body.reason ||
                ""
            ).trim();


        if (
            !Number.isInteger(
                studentId
            )
        ) {

            return res
                .status(400)
                .json({
                    success:
                        false,

                    message:
                        "ID siswa tidak valid."
                });

        }


        /*
            Maksimum:
            7 hari × 24 jam × 60 menit
            = 10080 menit.
        */
        if (
            !Number.isInteger(
                durationMinutes
            ) ||
            durationMinutes < 1 ||
            durationMinutes > 10080
        ) {

            return res
                .status(400)
                .json({
                    success:
                        false,

                    message:
                        "Durasi mute harus antara 1 menit dan 7 hari."
                });

        }


        try {

            await ensureFeedModerationTables();

/*
    Dalam satu query, pastikan siswa ada dan
    periksa apakah siswa sedang memiliki Ban.
*/
const studentState =
    await tursoDb.get(
        `
            SELECT
                students.id,

                COALESCE(
                    moderation.status,
                    'active'
                ) AS moderation_status,

                EXISTS (
                    SELECT
                        1
                    FROM
                        feed_moderation_actions ban
                    WHERE
                        ban.student_id =
                            students.id
                        AND ban.action_type =
                            'ban'
                        AND ban.status =
                            'active'
                ) AS has_active_ban

            FROM students

            LEFT JOIN
                feed_moderation moderation
            ON
                moderation.student_id =
                    students.id

            WHERE
                students.id = ?
        `,
        [
            studentId
        ]
    );


if (!studentState) {

    return res
        .status(404)
        .json({
            success:
                false,

            message:
                "Siswa tidak ditemukan."
        });

}


/*
    Cek snapshot dan card Ban sekaligus.

    has_active_ban berasal dari SQLite dan
    biasanya bernilai 0 atau 1.
*/
if (
    studentState.moderation_status ===
        "banned" ||
    Number(
        studentState.has_active_ban
    ) ===
        1
) {

    return res
        .status(409)
        .json({
            success:
                false,

            message:
                "Siswa sedang diban dari Classroom Feed."
        });

}


const startsAt =
    new Date().toISOString();


const endsAt =
    new Date(
        Date.now() +
        (
            durationMinutes *
            60 *
            1000
        )
    ).toISOString();


/*
    Seluruh proses penambahan Mute dikirim
    sebagai satu batch transaksi.

    SQL menentukan sendiri:
    - belum ada Mute → langsung active
    - sudah ada active/queued → queued
*/
const muteBatchResults =
    await tursoDb.batch(
        [
            /*
                Buat card Mute.

                CTE pending hanya dihitung satu kali
                untuk menentukan active atau queued.
            */
            {
                sql: `
                    WITH pending AS (
                        SELECT
                            EXISTS (
                                SELECT
                                    1
                                FROM
                                    feed_moderation_actions
                                WHERE
                                    student_id = ?
                                    AND action_type =
                                        'mute'
                                    AND status IN (
                                        'active',
                                        'queued'
                                    )
                            ) AS has_pending
                    )

                    INSERT INTO
                        feed_moderation_actions (
                            student_id,
                            action_type,
                            status,
                            duration_minutes,
                            starts_at,
                            ends_at,
                            reason,
                            moderated_by
                        )

                    SELECT
                        ?,
                        'mute',

                        CASE
                            WHEN has_pending = 1
                                THEN 'queued'
                            ELSE 'active'
                        END,

                        ?,

                        CASE
                            WHEN has_pending = 1
                                THEN NULL
                            ELSE ?
                        END,

                        CASE
                            WHEN has_pending = 1
                                THEN NULL
                            ELSE ?
                        END,

                        ?,
                        ?

                    FROM pending
                `,

                args: [
                    studentId,
                    studentId,
                    durationMinutes,
                    startsAt,
                    endsAt,
                    reason ||
                        null,
                    Number(
                        req.session.adminId
                    )
                ]
            },


            /*
                Jika card baru menjadi active,
                perbarui snapshot utama.

                Kalau card queued, SELECT tidak
                menghasilkan row dan snapshot Mute
                aktif yang lama tidak disentuh.
            */
            {
                sql: `
                    INSERT INTO feed_moderation (
                        student_id,
                        status,
                        muted_until,
                        reason,
                        moderated_by,
                        updated_at
                    )

                    SELECT
                        student_id,
                        'muted',
                        ends_at,
                        reason,
                        moderated_by,
                        CURRENT_TIMESTAMP

                    FROM feed_moderation_actions

                    WHERE
                        id =
                            last_insert_rowid()
                        AND status =
                            'active'

                    ON CONFLICT(student_id)
                    DO UPDATE SET
                        status =
                            'muted',

                        muted_until =
                            excluded.muted_until,

                        reason =
                            excluded.reason,

                        moderated_by =
                            excluded.moderated_by,

                        updated_at =
                            CURRENT_TIMESTAMP
                `,

                args: []
            },


            /*
                Buat histori event Mute.
            */
            {
                sql: `
                    INSERT INTO
                        feed_moderation_events (
                            student_id,
                            event_type,
                            reason
                        )
                    VALUES (
                        ?,
                        'muted',
                        ?
                    )
                `,

                args: [
                    studentId,
                    reason ||
                        null
                ]
            },


            /*
                Ambil card yang baru dibuat dan
                kondisi moderation utama dalam
                batch yang sama.
            */
            {
                sql: `
                    SELECT
                        action.id,
                        action.student_id,
                        action.action_type,
                        action.status,
                        action.duration_minutes,
                        action.starts_at,
                        action.ends_at,
                        action.reason,
                        action.moderated_by,
                        action.created_at,

                        COALESCE(
                            moderation.status,
                            'active'
                        ) AS moderation_status,

                        moderation.muted_until
                            AS moderation_muted_until,

                        moderation.reason
                            AS moderation_reason

                    FROM
                        feed_moderation_actions action

                    LEFT JOIN
                        feed_moderation moderation
                    ON
                        moderation.student_id =
                            action.student_id

                    WHERE
                        action.id = (
                            SELECT
                                MAX(latest.id)
                            FROM
                                feed_moderation_actions latest
                            WHERE
                                latest.student_id = ?
                                AND latest.action_type =
                                    'mute'
                        )

                    LIMIT 1
                `,

                args: [
                    studentId
                ]
            }
        ],
        "immediate"
    );


const actionQueryResult =
    muteBatchResults[
        muteBatchResults.length -
        1
    ];


const action =
    actionQueryResult &&
    Array.isArray(
        actionQueryResult.rows
    )
        ? (
            actionQueryResult.rows[0] ||
            null
        )
        : null;


if (!action) {

    throw new Error(
        "Card Mute yang baru dibuat tidak ditemukan."
    );

}


/*
    Status utama tetap berasal dari snapshot
    server, bukan ditebak oleh frontend.
*/
const moderation = {
    status:
        action.moderation_status ||
        "muted",

    muted_until:
        action.moderation_muted_until ||
        null,

    reason:
        action.moderation_reason ||
        null
};

return res.json({
    success:
        true,

    moderation:
        {
            status:
                moderation.status,

            mutedUntil:
                moderation.muted_until ||
                null,

            reason:
                moderation.reason ||
                null
        },

action:
    {
        id:
            Number(
                action.id
            ),

        student_id:
            Number(
                action.student_id
            ),

        action_type:
            action.action_type,

        status:
            action.status,

        duration_minutes:
            Number(
                action.duration_minutes
            ),

        starts_at:
            action.starts_at ||
            null,

        ends_at:
            action.ends_at ||
            null,

        reason:
            action.reason ||
            null,

        moderated_by:
            action.moderated_by
                ? Number(
                    action.moderated_by
                )
                : null,

        created_at:
            action.created_at
    }
});


        } catch (error) {

            console.error(
                "Error mute Classroom Feed:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Gagal mute siswa."
                });

        }

    }
);

// ========================================
// HAPUS CARD MODERATION
// ========================================

app.delete(
    "/api/admin/feed-moderation/actions/:actionId",
    async (req, res) => {

        if (
            !req.session.adminId
        ) {

            return res
                .status(401)
                .json({
                    success:
                        false,

                    message:
                        "Harus login sebagai Admin / Guru."
                });

        }


        const actionId =
            Number(
                req.params.actionId
            );


        if (
            !Number.isInteger(
                actionId
            )
        ) {

            return res
                .status(400)
                .json({
                    success:
                        false,

                    message:
                        "ID moderation tidak valid."
                });

        }


        try {

            await ensureFeedModerationTables();


            const action =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            student_id,
                            action_type,
                            status
                        FROM
                            feed_moderation_actions
                        WHERE id = ?
                    `,
                    [
                        actionId
                    ]
                );


            if (!action) {

                return res
                    .status(404)
                    .json({
                        success:
                            false,

                        message:
                            "Card moderation tidak ditemukan."
                    });

            }


            if (
                action.status !==
                    "active" &&
                action.status !==
                    "queued"
            ) {

                return res.json({
                    success:
                        true
                });

            }


            const wasActive =
                action.status ===
                "active";


            /*
                Jangan hard-delete.

                Status lifted membuat card
                hilang dari monitoring tetapi
                histori tetap tersimpan.
            */
            const result =
                await tursoDb.run(
                    `
                        UPDATE
                            feed_moderation_actions
                        SET
                            status = 'lifted',
                            lifted_at =
                                CURRENT_TIMESTAMP
                        WHERE
                            id = ?
                            AND status IN (
                                'active',
                                'queued'
                            )
                    `,
                    [
                        actionId
                    ]
                );


            if (
                Number(
                    result.changes ||
                    0
                ) === 0
            ) {

                return res.json({
                    success:
                        true
                });

            }

                        /*
                Menghapus card BAN berarti
                mencabut larangan sepenuhnya.

                Seluruh Mute sudah di-lift ketika
                Ban dibuat, jadi siswa langsung
                kembali ACTIVE.
            */
            if (
                action.action_type ===
                    "ban"
            ) {

                await tursoDb.run(
                    `
                        UPDATE feed_moderation
                        SET
                            status = 'active',
                            muted_until = NULL,
                            reason = NULL,
                            moderated_by = NULL,
                            updated_at =
                                CURRENT_TIMESTAMP
                        WHERE
                            student_id = ?
                            AND status = 'banned'
                    `,
                    [
                        action.student_id
                    ]
                );


                await tursoDb.run(
                    `
                        INSERT INTO
                            feed_moderation_events (
                                student_id,
                                event_type,
                                reason
                            )
                        VALUES (
                            ?,
                            'unbanned',
                            ?
                        )
                    `,
                    [
                        action.student_id,
                        "Larangan Classroom Feed telah dicabut."
                    ]
                );


                return res.json({
                    success:
                        true,

                    moderation:
                        {
                            status:
                                "active",

                            mutedUntil:
                                null,

                            reason:
                                null
                        }
                });

            }


            /*
                Kalau yang dihapus hanya QUEUED,
                mute ACTIVE tidak perlu disentuh.
            */
            if (!wasActive) {

                return res.json({
                    success:
                        true
                });

            }


            /*
                Kalau ACTIVE dihapus, bersihkan
                snapshot lama di feed_moderation
                terlebih dahulu.

                Ini juga mencegah sistem migrasi
                legacy membuat card yang baru saja
                dihapus muncul kembali.
            */
            await tursoDb.run(
                `
                    UPDATE feed_moderation
                    SET
                        status = 'active',
                        muted_until = NULL,
                        reason = NULL,
                        updated_at =
                            CURRENT_TIMESTAMP
                    WHERE
                        student_id = ?
                        AND status = 'muted'
                `,
                [
                    action.student_id
                ]
            );

            /*
                Server menentukan kondisi berikutnya:

                - ada QUEUED → langsung ACTIVE
                - queue kosong → siswa dipulihkan
                  dan event unmuted dibuat.
            */
            const moderation =
                await syncStudentMuteQueue(
                    Number(
                        action.student_id
                    )
                );

              /*
    Saat Mute aktif dicabut, snapshot
    feed_moderation sudah dibuat active sebelum
    sync untuk mencegah migrasi legacy membuat
    card lama kembali.

    Karena itu syncStudentMuteQueue() tidak
    membuat event unmuted secara otomatis.
    Buat event secara eksplisit jika queue
    benar-benar sudah kosong.
*/
if (
    moderation.status ===
    "active"
) {

    await tursoDb.run(
        `
            INSERT INTO
                feed_moderation_events (
                    student_id,
                    event_type,
                    reason
                )
            VALUES (
                ?,
                'unmuted',
                ?
            )
        `,
        [
            Number(
                action.student_id
            ),

            "Mute Classroom Feed telah dicabut."
        ]
    );

}


            return res.json({
                success:
                    true,

                moderation:
                    {
                        status:
                            moderation.status,

                        mutedUntil:
                            moderation.muted_until ||
                            null,

                        reason:
                            moderation.reason ||
                            null
                    }
            });


        } catch (error) {

            console.error(
                "Error hapus moderation card:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Gagal menghapus card moderation."
                });

        }

    }
);

// ========================================
// BAN SISWA DARI CLASSROOM FEED
// ========================================

app.post(
    "/api/admin/feed-moderation/:studentId/ban",
    async (req, res) => {

        if (
            !req.session.adminId
        ) {

            return res
                .status(401)
                .json({
                    success:
                        false,

                    message:
                        "Harus login sebagai Admin / Guru."
                });

        }


        const studentId =
            Number(
                req.params.studentId
            );

        const reason =
            String(
                req.body.reason ||
                ""
            ).trim();


        if (
            !Number.isInteger(
                studentId
            )
        ) {

            return res
                .status(400)
                .json({
                    success:
                        false,

                    message:
                        "ID siswa tidak valid."
                });

        }


        if (
            reason.length >
                500
        ) {

            return res
                .status(400)
                .json({
                    success:
                        false,

                    message:
                        "Alasan ban maksimal 500 karakter."
                });

        }


        try {

            await ensureFeedModerationTables();


  /*
    Pemeriksaan siswa dan Ban aktif tidak saling
    bergantung, jadi jalankan dalam waktu yang
    sama untuk mengurangi satu round-trip Turso.
*/
const [
    student,
    existingBan
] =
    await Promise.all([
        tursoDb.get(
            `
                SELECT
                    id
                FROM students
                WHERE id = ?
            `,
            [
                studentId
            ]
        ),

        tursoDb.get(
            `
                SELECT
                    id
                FROM feed_moderation_actions
                WHERE
                    student_id = ?
                    AND action_type = 'ban'
                    AND status = 'active'
                ORDER BY id DESC
                LIMIT 1
            `,
            [
                studentId
            ]
        )
    ]);


if (!student) {

    return res
        .status(404)
        .json({
            success:
                false,

            message:
                "Siswa tidak ditemukan."
        });

}


if (existingBan) {

    return res
        .status(409)
        .json({
            success:
                false,

            message:
                "Siswa sudah di ban."
        });

}

/*
    Semua perubahan Ban harus berhasil bersama.

    Satu batch:
    - hanya satu round-trip penulisan ke Turso
    - memakai transaksi immediate
    - tidak meninggalkan status setengah jadi
*/
const banCreatedAt =
    new Date().toISOString();


const banBatchResults =
    await tursoDb.batch(
    [
        {
            sql: `
                INSERT INTO feed_moderation (
                    student_id,
                    status,
                    muted_until,
                    reason,
                    moderated_by,
                    updated_at
                )
                VALUES (
                    ?,
                    'banned',
                    NULL,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP
                )

                ON CONFLICT(student_id)
                DO UPDATE SET
                    status =
                        'banned',

                    muted_until =
                        NULL,

                    reason =
                        excluded.reason,

                    moderated_by =
                        excluded.moderated_by,

                    updated_at =
                        CURRENT_TIMESTAMP
            `,

            args: [
                studentId,
                reason ||
                    null,
                Number(
                    req.session.adminId
                )
            ]
        },


        /*
            Ban mengalahkan seluruh Mute aktif
            dan antrean milik siswa.
        */
        {
            sql: `
                UPDATE feed_moderation_actions
                SET
                    status = 'lifted',
                    lifted_at =
                        CURRENT_TIMESTAMP
                WHERE
                    student_id = ?
                    AND action_type = 'mute'
                    AND status IN (
                        'active',
                        'queued'
                    )
            `,

            args: [
                studentId
            ]
        },


        /*
            Buat satu card Ban aktif.
        */
        {
            sql: `
                INSERT INTO
                    feed_moderation_actions (
                        student_id,
                        action_type,
                        status,
                        duration_minutes,
                        starts_at,
                        ends_at,
                        reason,
                        moderated_by
                    )
                VALUES (
                    ?,
                    'ban',
                    'active',
                    NULL,
                    CURRENT_TIMESTAMP,
                    NULL,
                    ?,
                    ?
                )
            `,

            args: [
                studentId,
                reason ||
                    null,
                Number(
                    req.session.adminId
                )
            ]
        },


        /*
            Catat event Ban untuk sistem
            moderasi Student.
        */
        {
            sql: `
                INSERT INTO
                    feed_moderation_events (
                        student_id,
                        event_type,
                        reason
                    )
                VALUES (
                    ?,
                    'banned',
                    ?
                )
            `,

            args: [
                studentId,
                reason ||
                    null
            ]
        }
    ],
    "immediate"
);

const banInsertResult =
    banBatchResults[2];


const banActionId =
    Number(
        banInsertResult &&
        banInsertResult.lastInsertRowid
    );


if (
    !Number.isInteger(
        banActionId
    ) ||
    banActionId <= 0
) {

    throw new Error(
        "ID card Ban yang baru dibuat tidak ditemukan."
    );

}

return res.json({
    success:
        true,

    moderation:
        {
            status:
                "banned",

            mutedUntil:
                null,

            reason:
                reason ||
                null
        },

    action:
        {
            id:
                banActionId,

            student_id:
                studentId,

            action_type:
                "ban",

            status:
                "active",

            duration_minutes:
                null,

            starts_at:
                banCreatedAt,

            ends_at:
                null,

            reason:
                reason ||
                null,

            moderated_by:
                Number(
                    req.session.adminId
                ),

            created_at:
                banCreatedAt
        }
});


        } catch (error) {

            console.error(
                "Error ban Classroom Feed:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Gagal ban siswa."
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

/*
    Tidak ada session server bukan berarti
    akun siswa dihapus.

    Kondisi ini dapat terjadi setelah deploy,
    cookie kedaluwarsa, atau membuka website
    melalui browser/session baru.
*/
if (!req.session.studentId) {

    return res
        .status(401)
        .json({
            success: false,

            loggedOut: false,

            reason:
                "session-missing"
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

        reason:
            "student-data-reset",

        message:
            "Kamu telah dilogout karena data siswa telah direset."
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

            await ensureStudentProfileColumns();

            const student =
                await tursoDb.get(
                    `
SELECT
    id,
    login_code,
    name,
    full_name,
    date_of_birth,
    class_name,
    profile_bio,
    profile_banner_color,
    profile_picture_url,
    profile_picture_width,
profile_picture_height,
profile_picture_bytes,
profile_show_academic_stats
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

bio:
    String(
        student.profile_bio ||
        ""
    ),

bannerColor:
    String(
        student.profile_banner_color ||
        "blue"
    ),

profilePictureUrl:
    student.profile_picture_url ||
    null,

profilePictureWidth:
    student.profile_picture_width === null ||
    student.profile_picture_width === undefined
        ? null
        : Number(
            student.profile_picture_width
        ),

profilePictureHeight:
    student.profile_picture_height === null ||
    student.profile_picture_height === undefined
        ? null
        : Number(
            student.profile_picture_height
        ),

profilePictureBytes:
    student.profile_picture_bytes === null ||
    student.profile_picture_bytes === undefined
        ? null
        : Number(
            student.profile_picture_bytes
        ),

showAcademicStats:
    Number(
        student.profile_show_academic_stats || 0
    ) === 1,

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
// UPDATE KUSTOMISASI PROFILE SISWA
// ========================================

app.patch(
    "/api/student/profile/customization",
    async (
        req,
        res
    ) => {

        if (
            !req.session.studentId
        ) {

            return res
                .status(401)
                .json({
                    success:
                        false,

                    message:
                        "Harus login sebagai siswa."
                });

        }


        const studentId =
            Number(
                req.session.studentId
            );


        const rawBio =
            req.body &&
            req.body.bio;


        const rawBannerColor =
            req.body &&
            req.body.bannerColor;

        const rawShowAcademicStats =
    req.body &&
    req.body.showAcademicStats;


if (
    typeof rawBio !==
        "string" ||

    typeof rawBannerColor !==
        "string" ||

    typeof rawShowAcademicStats !==
        "boolean"
) {

            return res
                .status(400)
                .json({
                    success:
                        false,

                    message:
                        "Data kustomisasi profil tidak valid."
                });

        }


const cleanBio =
    rawBio
        .replace(
            /\r\n?/g,
            "\n"
        )
        .trim();

const bioLineCount =
    cleanBio
        ? cleanBio.split("\n").length
        : 0;


if (
    bioLineCount >
    STUDENT_PROFILE_BIO_MAX_LINES
) {

    return res
        .status(400)
        .json({
            success:
                false,

            message:
                `Bio maksimal ${
                    STUDENT_PROFILE_BIO_MAX_LINES
                } baris.`
        });

}


        const cleanBannerColor =
            rawBannerColor
                .trim()
                .toLowerCase();


        /*
            Array.from menghitung karakter Unicode
            lebih tepat daripada .length biasa.
        */
        const bioLength =
            Array.from(
                cleanBio
            ).length;


        if (
            bioLength >
            STUDENT_PROFILE_BIO_MAX_LENGTH
        ) {

            return res
                .status(400)
                .json({
                    success:
                        false,

                    message:
                        `Bio maksimal ${
                            STUDENT_PROFILE_BIO_MAX_LENGTH
                        } karakter.`
                });

        }


        /*
            Tolak control character tersembunyi.
            Baris baru dan tab tetap diperbolehkan.
        */
        if (
            /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u
                .test(
                    cleanBio
                )
        ) {

            return res
                .status(400)
                .json({
                    success:
                        false,

                    message:
                        "Bio mengandung karakter yang tidak didukung."
                });

        }


        if (
            !STUDENT_PROFILE_BANNER_COLORS
                .has(
                    cleanBannerColor
                )
        ) {

            return res
                .status(400)
                .json({
                    success:
                        false,

                    message:
                        "Warna banner tidak valid."
                });

        }


        try {

            await ensureStudentProfileColumns();


            const existingStudent =
                await tursoDb.get(
                    `
                        SELECT id

                        FROM students

                        WHERE id = ?

                        LIMIT 1
                    `,
                    [
                        studentId
                    ]
                );


            if (!existingStudent) {

                return res
                    .status(404)
                    .json({
                        success:
                            false,

                        message:
                            "Siswa tidak ditemukan."
                    });

            }


            await tursoDb.run(
                `
UPDATE students

SET
    profile_bio = ?,
    profile_banner_color = ?,
    profile_show_academic_stats = ?

WHERE id = ?
                `,
[
    cleanBio,
    cleanBannerColor,
    rawShowAcademicStats ? 1 : 0,
    studentId
]
            );


            return res.json({

                success:
                    true,

                message:
                    "Profil berhasil diperbarui.",

customization: {

    bio:
        cleanBio,

    bannerColor:
        cleanBannerColor,

    showAcademicStats:
        rawShowAcademicStats

}

            });

        } catch (error) {

            console.error(
                "Gagal memperbarui kustomisasi profil siswa:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Profil tidak dapat diperbarui."
                });

        }

    }
);

// ========================================
// UPDATE FOTO PROFIL SISWA
// ========================================

app.put(
    "/api/student/profile/picture",

    parseStudentProfilePictureBody,

    async (
        req,
        res
    ) => {

        if (
            !req.session.studentId
        ) {

            return res
                .status(401)
                .json({
                    success:
                        false,

                    message:
                        "Harus login sebagai siswa."
                });

        }


        if (
            !isCloudinaryConfigured()
        ) {

            return res
                .status(503)
                .json({
                    success:
                        false,

                    message:
                        "Layanan foto belum tersedia."
                });

        }


        const studentId =
            Number(
                req.session.studentId
            );


        const imageBuffer =
            req.body;


        if (
            !isValidWebpBuffer(
                imageBuffer
            )
        ) {

            return res
                .status(400)
                .json({
                    success:
                        false,

                    message:
                        "Format foto profil tidak valid."
                });

        }


        if (
            imageBuffer.length >
            STUDENT_PROFILE_PICTURE_MAX_BYTES
        ) {

            return res
                .status(413)
                .json({
                    success:
                        false,

                    message:
                        "Ukuran foto profil terlalu besar."
                });

        }


        let uploadedPicture =
            null;


        try {

            await ensureStudentProfileColumns();


            const student =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            profile_picture_public_id

                        FROM students

                        WHERE id = ?

                        LIMIT 1
                    `,
                    [
                        studentId
                    ]
                );


            if (!student) {

                return res
                    .status(404)
                    .json({
                        success:
                            false,

                        message:
                            "Siswa tidak ditemukan."
                    });

            }


            uploadedPicture =
                await uploadStudentProfilePicture(
                    imageBuffer,
                    studentId
                );


            const pictureUrl =
                String(
                    uploadedPicture &&
                    uploadedPicture.secure_url ||
                    ""
                ).trim();


            const publicId =
                String(
                    uploadedPicture &&
                    uploadedPicture.public_id ||
                    ""
                ).trim();


            const width =
                Number(
                    uploadedPicture &&
                    uploadedPicture.width
                );


            const height =
                Number(
                    uploadedPicture &&
                    uploadedPicture.height
                );


            const bytes =
                Number(
                    uploadedPicture &&
                    uploadedPicture.bytes ||
                    imageBuffer.length
                );


            if (
                !pictureUrl ||
                !publicId ||
                width !==
                    STUDENT_PROFILE_PICTURE_SIZE ||
                height !==
                    STUDENT_PROFILE_PICTURE_SIZE ||
                !Number.isFinite(bytes) ||
                bytes <= 0 ||
                bytes >
                    STUDENT_PROFILE_PICTURE_MAX_BYTES
            ) {

                await deleteStudentProfilePicture(
                    publicId
                );


                uploadedPicture =
                    null;


                return res
                    .status(422)
                    .json({
                        success:
                            false,

                        message:
                            "Foto profil tidak dapat diproses."
                    });

            }


            await tursoDb.run(
                `
                    UPDATE students

                    SET
                        profile_picture_url = ?,
                        profile_picture_public_id = ?,
                        profile_picture_width = ?,
                        profile_picture_height = ?,
                        profile_picture_bytes = ?

                    WHERE id = ?
                `,
                [
                    pictureUrl,
                    publicId,
                    width,
                    height,
                    bytes,
                    studentId
                ]
            );


            const oldPublicId =
                student
                    .profile_picture_public_id;


            if (
                oldPublicId &&
                oldPublicId !== publicId
            ) {

                await deleteStudentProfilePicture(
                    oldPublicId
                );

            }


            return res.json({

                success:
                    true,

                message:
                    "Foto profil berhasil diperbarui.",

                picture: {

                    url:
                        pictureUrl,

                    width,

                    height,

                    bytes

                }

            });

        } catch (error) {

            if (
                uploadedPicture &&
                uploadedPicture.public_id
            ) {

                await deleteStudentProfilePicture(
                    uploadedPicture.public_id
                );

            }


            console.error(
                "Gagal memperbarui foto profil:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Foto profil tidak dapat diunggah."
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
// ADMIN AMBIL SEMUA MAPEL
// ========================================

app.get(
    "/api/admin/subjects",
    async (req, res) => {

        try {

            await ensureSubjectsTable();


            const subjects =
                await tursoDb.all(`
                    SELECT
                        id,
                        name,
                        created_at
                    FROM subjects
                    ORDER BY name COLLATE NOCASE ASC
                `);


            return res.json({
                success: true,
                subjects
            });


        } catch (error) {

            console.error(
                "Error mengambil mapel:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil daftar mapel."
            });

        }

    }
);


// ========================================
// ADMIN TAMBAH MAPEL
// ========================================

app.post(
    "/api/admin/subjects",
    async (req, res) => {

        const {
            name
        } = req.body;


        if (
            typeof name !== "string" ||
            name.trim().length === 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Nama mapel wajib diisi."
            });

        }


        const cleanName =
            name.trim();


        if (cleanName.length > 80) {

            return res.status(400).json({
                success: false,
                message:
                    "Nama mapel maksimal 80 karakter."
            });

        }


        try {

            await ensureSubjectsTable();


            const existingSubject =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            name
                        FROM subjects
                        WHERE name = ?
                        COLLATE NOCASE
                    `,
                    [
                        cleanName
                    ]
                );


            if (existingSubject) {

                return res.status(409).json({
                    success: false,
                    message:
                        "Mapel tersebut sudah terdaftar."
                });

            }


            const result =
                await tursoDb.run(
                    `
                        INSERT INTO subjects (
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
                    "Mapel berhasil ditambahkan.",

                subject: {

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
                "Error menambahkan mapel:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal menambahkan mapel."
            });

        }

    }
);


// ========================================
// ADMIN HAPUS MAPEL
// ========================================

app.delete(
    "/api/admin/subjects/:subjectId",
    async (req, res) => {

        const subjectId =
            Number(
                req.params.subjectId
            );


        if (
            !Number.isInteger(subjectId) ||
            subjectId <= 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "ID mapel tidak valid."
            });

        }


        try {

            await ensureSubjectsTable();


            const subject =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            name
                        FROM subjects
                        WHERE id = ?
                    `,
                    [
                        subjectId
                    ]
                );


            if (!subject) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Mapel tidak ditemukan."
                });

            }


            await tursoDb.run(
                `
                    DELETE FROM subjects
                    WHERE id = ?
                `,
                [
                    subjectId
                ]
            );


            return res.json({

                success: true,

                message:
                    "Mapel berhasil dihapus.",

                deletedSubject: {
                    id:
                        subject.id,

                    name:
                        subject.name
                }

            });


        } catch (error) {

            console.error(
                "Error menghapus mapel:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal menghapus mapel."
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

const processedPostMentions =
    new Set();


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


/*
    Student dan Admin dapat mempunyai angka ID
    yang sama, sehingga type harus ikut disimpan.
*/
const mentionKey =
    `${mention.type}:${mentionId}`;


/*
    Mention ini sudah pernah diproses dalam
    Post yang sama. Jangan simpan atau membuat
    notifikasi kedua.
*/
if (
    processedPostMentions.has(
        mentionKey
    )
) {

    continue;

}


/*
    Tandai sebelum masuk ke proses siswa/guru.
*/
processedPostMentions.add(
    mentionKey
);


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

const savedMentions =
    await getAnnouncementMentions(
        announcementId
    );

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
            savedMentions
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
    class_name,
    profile_picture_url
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

const processedMentions =
    new Set();


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


    const mentionKey =
        `${mention.type}:${mentionId}`;


    if (
        processedMentions.has(
            mentionKey
        )
    ) {

        continue;

    }


    processedMentions.add(
        mentionKey
    );


    // =================================
    // MENTION SISWA
    // =================================


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


const createdAnnouncement =
    await tursoDb.get(
        `
            SELECT
                id,
                student_id,
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


const savedMentions =
    await getAnnouncementMentions(
        announcementId
    );


return res.json({

    success: true,

    message:
        "Announcement berhasil dibuat.",

    announcement: {

        id:
            createdAnnouncement.id,

        student_id:
            createdAnnouncement.student_id,

        admin_id:
            null,

        student_creator_name:
            student.name,

        student_creator_class:
            student.class_name,

        student_creator_profile_picture_url:
    student.profile_picture_url ||
    null,

        admin_creator_name:
            null,

        admin_creator_role:
            null,

        class_name:
            createdAnnouncement.class_name,

        message:
            createdAnnouncement.message,

        created_at:
            createdAnnouncement.created_at,

        mentions:
            savedMentions

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

async function deleteAnnouncementFeedData(
    announcementId
) {

    await tursoDb.batch(
        [
            {
                sql: `
                    DELETE FROM notifications
                    WHERE announcement_id = ?
                `,
                args: [
                    announcementId
                ]
            },

            {
                sql: `
                    DELETE FROM announcement_mentions
                    WHERE announcement_id = ?
                `,
                args: [
                    announcementId
                ]
            },

            {
                sql: `
                    DELETE FROM announcement_replies
                    WHERE announcement_id = ?
                `,
                args: [
                    announcementId
                ]
            },

            {
                sql: `
                    DELETE FROM announcements
                    WHERE id = ?
                `,
                args: [
                    announcementId
                ]
            }
        ],
        "immediate"
    );

}


async function deleteReplyFeedData(
    replyId
) {

    await tursoDb.batch(
        [
            {
                sql: `
                    DELETE FROM notifications
                    WHERE reply_id = ?
                `,
                args: [
                    replyId
                ]
            },

            {
                sql: `
                    DELETE FROM announcement_mentions
                    WHERE reply_id = ?
                `,
                args: [
                    replyId
                ]
            },

            {
                sql: `
                    DELETE FROM announcement_replies
                    WHERE id = ?
                `,
                args: [
                    replyId
                ]
            }
        ],
        "immediate"
    );

}

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


await deleteAnnouncementFeedData(
    announcementId
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

// ========================================
// AMBIL ANNOUNCEMENT SISWA
// POSTS + REPLIES + MENTIONS SEKALIGUS
// ========================================

app.get(
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


            /*
                Ambil post, reply, dan mention
                secara paralel.

                Jadi tidak perlu:
                - 1 request reply per post
                - 1 query mention per post
                - 1 query mention per reply
            */
            const [
                announcements,
                replies,
                mentionRows
            ] =
                await Promise.all([


                    // =============================
                    // POSTS YANG BOLEH DILIHAT SISWA
                    // =============================

                    tursoDb.all(
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

                                students.profile_picture_url
    AS student_creator_profile_picture_url,

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

                            WHERE (
                                announcements.class_name
                                    IS NULL

                                OR

                                announcements.class_name = ?
                            )

                            ORDER BY
                                announcements.id DESC
                        `,
                        [
                            student.class_name
                        ]
                    ),


                    // =============================
                    // SEMUA REPLY UNTUK POST VISIBLE
                    // =============================

                    tursoDb.all(
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
    AS student_class_name,

students.profile_picture_url
    AS student_profile_picture_url,

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

                            WHERE (
                                announcements.class_name
                                    IS NULL

                                OR

                                announcements.class_name = ?
                            )

                            ORDER BY
                                announcement_replies.id ASC
                        `,
                        [
                            student.class_name
                        ]
                    ),


                    // =============================
                    // SEMUA MENTION UNTUK POST VISIBLE
                    // =============================

                    tursoDb.all(
                        `
                            SELECT
                                announcement_mentions.announcement_id,
                                announcement_mentions.reply_id,
                                announcement_mentions.mentioned_student_id,
                                announcement_mentions.mentioned_admin_id,

                                students.name
                                    AS student_name,

                                admins.name
                                    AS admin_name

                            FROM announcement_mentions

                            INNER JOIN announcements
                            ON announcements.id =
                                announcement_mentions.announcement_id

                            LEFT JOIN students
                            ON students.id =
                                announcement_mentions.mentioned_student_id

                            LEFT JOIN admins
                            ON admins.id =
                                announcement_mentions.mentioned_admin_id

                            WHERE (
                                announcements.class_name
                                    IS NULL

                                OR

                                announcements.class_name = ?
                            )
                        `,
                        [
                            student.class_name
                        ]
                    )

                ]);


            // =============================
            // KELOMPOKKAN MENTION
            // =============================

            const announcementMentionMap =
                new Map();

            const replyMentionMap =
                new Map();


            mentionRows.forEach(
                (row) => {

                    const mention =
                        row.mentioned_student_id
                            ? {
                                id:
                                    row.mentioned_student_id,

                                type:
                                    "student",

                                name:
                                    row.student_name
                            }
                            : {
                                id:
                                    row.mentioned_admin_id,

                                type:
                                    "admin",

                                name:
                                    row.admin_name
                            };


                    if (row.reply_id) {

                        const replyId =
                            Number(row.reply_id);


                        if (
                            !replyMentionMap.has(
                                replyId
                            )
                        ) {

                            replyMentionMap.set(
                                replyId,
                                []
                            );

                        }


                        replyMentionMap
                            .get(replyId)
                            .push(mention);


                        return;

                    }


                    const announcementId =
                        Number(
                            row.announcement_id
                        );


                    if (
                        !announcementMentionMap.has(
                            announcementId
                        )
                    ) {

                        announcementMentionMap.set(
                            announcementId,
                            []
                        );

                    }


                    announcementMentionMap
                        .get(announcementId)
                        .push(mention);

                }
            );


            // =============================
            // FORMAT + KELOMPOKKAN REPLY
            // =============================

            const repliesByAnnouncement =
                new Map();


            replies.forEach(
                (reply) => {

                    const formattedReply =
                        reply.student_id
                            ? {
                                id:
                                    reply.id,

                                announcement_id:
                                    reply.announcement_id,

                                message:
                                    reply.message,

                                created_at:
                                    reply.created_at,

                                mentions:
                                    replyMentionMap.get(
                                        Number(reply.id)
                                    ) || [],

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
    reply.student_class_name ||
    null,

profile_picture_url:
    reply.student_profile_picture_url ||
    null
                            }
                            : {
                                id:
                                    reply.id,

                                announcement_id:
                                    reply.announcement_id,

                                message:
                                    reply.message,

                                created_at:
                                    reply.created_at,

                                mentions:
                                    replyMentionMap.get(
                                        Number(reply.id)
                                    ) || [],

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
    null,

profile_picture_url:
    null
                            };


                    const announcementId =
                        Number(
                            reply.announcement_id
                        );


                    if (
                        !repliesByAnnouncement.has(
                            announcementId
                        )
                    ) {

                        repliesByAnnouncement.set(
                            announcementId,
                            []
                        );

                    }


                    repliesByAnnouncement
                        .get(announcementId)
                        .push(
                            formattedReply
                        );

                }
            );


            // =============================
            // NEST REPLY DI DALAM POST
            // =============================

            const formattedAnnouncements =
                announcements.map(
                    (announcement) => {

                        const announcementId =
                            Number(
                                announcement.id
                            );


                        return {

                            ...announcement,

                            mentions:
                                announcementMentionMap.get(
                                    announcementId
                                ) || [],

                            replies:
                                repliesByAnnouncement.get(
                                    announcementId
                                ) || []

                        };

                    }
                );


            return res.json({

                success: true,

                announcements:
                    formattedAnnouncements

            });


        } catch (error) {

            console.error(
                "Error mengambil announcement siswa:",
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


await deleteReplyFeedData(
    replyId
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


await deleteReplyFeedData(
    replyId
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

students.profile_picture_url
    AS student_creator_profile_picture_url,

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

AND
    announcements.created_at <=
        datetime('now', '-1 second')

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

students.profile_picture_url
    AS student_creator_profile_picture_url,

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
    AS student_class_name,

students.profile_picture_url
    AS student_profile_picture_url,

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

            ORDER BY
                announcement_replies.id ASC
        `
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
    reply.student_class_name ||
    null,

profile_picture_url:
    reply.student_profile_picture_url ||
    null

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


const formattedAnnouncements =
    await Promise.all(
        announcements.map(
            async (announcement) => {

                return {

                    ...announcement,

                    mentions:
                        await getAnnouncementMentions(
                            announcement.id
                        ),

                    replies:
                        formattedReplies.filter(
                            (reply) =>
                                Number(
                                    reply.announcement_id
                                ) ===
                                Number(
                                    announcement.id
                                )
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


await deleteAnnouncementFeedData(
    announcementId
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
students.profile_picture_url
    AS student_profile_picture_url,

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
    "student",

class_name:
    reply.class_name ||
    null,

profile_picture_url:
    reply.student_profile_picture_url ||
    null
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
    "admin",

profile_picture_url:
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
// CEK ANNOUNCEMENT + SISWA
// PARALEL
// =====================================

const [
    announcement,
    student
] =
    await Promise.all([

        tursoDb.get(
            `
SELECT
    id,
    student_id,
    admin_id,
    class_name,
    message
FROM announcements
WHERE id = ?
            `,
            [
                announcementId
            ]
        ),

        tursoDb.get(
            `
SELECT
    id,
    name,
    class_name,
    profile_picture_url
FROM students
                WHERE id = ?
            `,
            [
                numericStudentId
            ]
        )

    ]);


if (!announcement) {

    return res.status(404).json({
        success: false,
        message:
            "Announcement tidak ditemukan."
    });

}


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

const processedMentions =
    new Set();

/*
    Digunakan untuk memberikan prioritas
    notifikasi Mention dibanding Reply.
*/
const validMentionRecipients =
    new Set();


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


    const mentionKey =
        `${mention.type}:${mentionId}`;


    if (
        processedMentions.has(
            mentionKey
        )
    ) {

        continue;

    }


    processedMentions.add(
        mentionKey
    );


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

validMentionRecipients.add(
    `student:${mentionId}`
);


if (
    mentionId !== numericStudentId
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


    /*
        Catat bahwa guru ini benar-benar
        menerima Mention.
    */
    validMentionRecipients.add(
        `admin:${mentionId}`
    );


    /*
        Mention memiliki prioritas dibanding
        notifikasi Reply.
    */
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

// =====================================
// NOTIFIKASI KEPADA PEMILIK POST
// =====================================

const normalizedPostMessage =
    String(
        announcement.message ||
        ""
    )
        .replace(
            /\s+/g,
            " "
        )
        .trim();


const postMessagePreview =
    normalizedPostMessage.length > 90
        ? `${
            normalizedPostMessage.slice(
                0,
                87
            )
        }...`
        : normalizedPostMessage;


const replyNotificationMessage =
    `Kamu mendapat reply dalam Post: "${postMessagePreview}"`;


// Post dibuat oleh siswa lain.
if (
    announcement.student_id &&
    Number(
        announcement.student_id
    ) !== numericStudentId &&
    !validMentionRecipients.has(
        `student:${
            Number(
                announcement.student_id
            )
        }`
    )
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
            VALUES (?, ?, 'reply', ?, ?, ?)
        `,
        [
            Number(
                announcement.student_id
            ),
            numericStudentId,
            announcementId,
            replyId,
            replyNotificationMessage
        ]
    );

}


// Post dibuat oleh Admin/Guru.
if (
    announcement.admin_id &&
    !validMentionRecipients.has(
        `admin:${
            Number(
                announcement.admin_id
            )
        }`
    )
) {

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
            VALUES (?, ?, 'reply', ?, ?, ?)
        `,
        [
            Number(
                announcement.admin_id
            ),
            numericStudentId,
            announcementId,
            replyId,
            replyNotificationMessage
        ]
    );

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


const savedMentions =
    await getReplyMentions(
        replyId
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
        "student",

    sender_id:
        numericStudentId,

    sender_name:
        student.name,

    sender_role:
        "student",

class_name:
    student.class_name,

profile_picture_url:
    student.profile_picture_url ||
    null,

message:
    createdReply.message,

    created_at:
        createdReply.created_at,

    mentions:
        savedMentions

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

                            students.profile_picture_url
    AS student_profile_picture_url,

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

AND
    announcement_replies.created_at <=
        datetime('now', '-1 second')

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
    reply.class_name,

profile_picture_url:
    reply.student_profile_picture_url ||
    null
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

students.profile_picture_url
    AS student_profile_picture_url,

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
    reply.class_name,

profile_picture_url:
    reply.student_profile_picture_url ||
    null
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
// CEK ANNOUNCEMENT + GURU
// PARALEL
// =====================================

const [
    announcement,
    currentAdmin
] =
    await Promise.all([

        tursoDb.get(
            `
SELECT
    id,
    student_id,
    admin_id,
    class_name,
    message
FROM announcements
WHERE id = ?
            `,
            [
                announcementId
            ]
        ),

        tursoDb.get(
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
        )

    ]);


if (!announcement) {

    return res.status(404).json({
        success: false,
        message:
            "Announcement tidak ditemukan."
    });

}


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

const processedMentions =
    new Set();

/*
    Digunakan untuk memberikan prioritas
    notifikasi Mention dibanding Reply.
*/
const validMentionRecipients =
    new Set();


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


    const mentionKey =
        `${mention.type}:${mentionId}`;


    if (
        processedMentions.has(
            mentionKey
        )
    ) {

        continue;

    }


    processedMentions.add(
        mentionKey
    );


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


    /*
        Siswa ini menerima Mention yang valid.
    */
    validMentionRecipients.add(
        `student:${mentionId}`
    );


    /*
        Kirim notifikasi Mention meskipun siswa
        tersebut adalah pemilik post.

        Mention mempunyai prioritas atas Reply.
    */
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
    mentionId !== numericAdminId &&
    mentionId !== Number(
        announcement.admin_id
    )
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

// =====================================
// NOTIFIKASI KEPADA PEMILIK POST
// =====================================

const normalizedPostMessage =
    String(
        announcement.message ||
        ""
    )
        .replace(
            /\s+/g,
            " "
        )
        .trim();


const postMessagePreview =
    normalizedPostMessage.length > 90
        ? `${
            normalizedPostMessage.slice(
                0,
                87
            )
        }...`
        : normalizedPostMessage;


const replyNotificationMessage =
    `Kamu mendapat reply dalam Post: "${postMessagePreview}"`;


// Post dibuat oleh siswa.
if (
    announcement.student_id &&
    !validMentionRecipients.has(
        `student:${
            Number(
                announcement.student_id
            )
        }`
    )
) {

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
            VALUES (?, ?, 'reply', ?, ?, ?)
        `,
        [
            Number(
                announcement.student_id
            ),
            numericAdminId,
            announcementId,
            replyId,
            replyNotificationMessage
        ]
    );

}


// Post dibuat oleh Admin/Guru lain.
if (
    announcement.admin_id &&
    Number(
        announcement.admin_id
    ) !== numericAdminId &&
    !validMentionRecipients.has(
        `admin:${
            Number(
                announcement.admin_id
            )
        }`
    )
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
            VALUES (?, ?, 'reply', ?, ?, ?)
        `,
        [
            Number(
                announcement.admin_id
            ),
            numericAdminId,
            announcementId,
            replyId,
            replyNotificationMessage
        ]
    );

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
// STATUS MODERATION CLASSROOM FEED SISWA
// ========================================

app.get(
    "/api/student/:studentId/feed-moderation",
    async (req, res) => {

        if (
            !req.session.studentId
        ) {

            return res
                .status(401)
                .json({
                    success:
                        false,

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
            !Number.isInteger(
                studentId
            ) ||
            studentId !==
                sessionStudentId
        ) {

            return res
                .status(403)
                .json({
                    success:
                        false,

                    message:
                        "Akses siswa tidak valid."
                });

        }


        try {

const moderation =
    await getStudentFeedModeration(
        studentId
    );


/*
    getStudentFeedModeration() di atas sudah
    menjalankan syncStudentMuteQueue().

    true berarti getStudentMuteActions()
    hanya mengambil daftar card tanpa
    mengulang seluruh proses sinkronisasi.
*/
const muteActions =
    await getStudentMuteActions(
        studentId,
        true
    );


const pendingEvent =
                await tursoDb.get(
                    `
                        SELECT
                            id,
                            event_type,
                            reason,
                            created_at
                        FROM
                            feed_moderation_events
                        WHERE
                            student_id = ?
                            AND seen_at IS NULL
                            AND event_type IN (
                                'unmuted',
                                'unbanned'
                            )
                        ORDER BY id DESC
                        LIMIT 1
                    `,
                    [
                        studentId
                    ]
                );


return res.json({
    success:
        true,

    serverNow:
        new Date().toISOString(),

moderation:
    {
        status:
            moderation.status ||
            "active",

        mutedUntil:
            moderation.muted_until ||
            null,

        reason:
            moderation.reason ||
            null,

        activeActionId:
            moderation.action_id ||
            null
    },


muteActions:
    Array.isArray(
        muteActions
    )
        ? muteActions
        : [],


pendingEvent:
                    pendingEvent ||
                    null
            });


        } catch (error) {

            console.error(
                "Error mengambil status moderation feed:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Gagal mengambil status moderation."
                });

        }

    }
);

// ========================================
// TANDAI EVENT MODERATION SUDAH DILIHAT
// ========================================

app.post(
    "/api/student/:studentId/feed-moderation/events/:eventId/seen",
    async (req, res) => {

        if (
            !req.session.studentId
        ) {

            return res
                .status(401)
                .json({
                    success:
                        false,

                    message:
                        "Harus login sebagai siswa."
                });

        }


        const studentId =
            Number(
                req.params.studentId
            );

        const eventId =
            Number(
                req.params.eventId
            );

        const sessionStudentId =
            Number(
                req.session.studentId
            );


        if (
            !Number.isInteger(
                studentId
            ) ||
            studentId !==
                sessionStudentId ||
            !Number.isInteger(
                eventId
            )
        ) {

            return res
                .status(403)
                .json({
                    success:
                        false,

                    message:
                        "Akses moderation tidak valid."
                });

        }


        try {

            await ensureFeedModerationTables();


await tursoDb.run(
    `
        UPDATE
            feed_moderation_events
        SET
            seen_at =
                CURRENT_TIMESTAMP
        WHERE
            student_id = ?
            AND seen_at IS NULL
            AND event_type IN (
                'unmuted',
                'unbanned'
            )
            AND id <= ?
    `,
    [
        studentId,
        eventId
    ]
);


            return res.json({
                success:
                    true
            });


        } catch (error) {

            console.error(
                "Error menandai event moderation:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Gagal memperbarui event moderation."
                });

        }

    }
);

// ========================================
// JUMLAH NOTIFIKASI BELUM DIBACA SISWA
// ========================================

app.get(
    "/api/student/:studentId/notifications/count",
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
            studentId !== sessionStudentId
        ) {

            return res.status(403).json({
                success: false,
                message:
                    "Akses siswa tidak valid."
            });

        }


        try {

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
                    )
            });


        } catch (error) {

            console.error(
                "Error mengambil jumlah notifikasi siswa:",
                error
            );


            return res.status(500).json({
                success: false,
                message:
                    "Gagal mengambil jumlah notifikasi."
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

const [
    notifications,
    unread
] =
    await Promise.all([

        tursoDb.all(
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
LIMIT 100
            `,
            [
                studentId
            ]
        ),

        tursoDb.get(
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
        )

    ]);


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

const [
    notifications,
    unread
] =
    await Promise.all([

        tursoDb.all(
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
LIMIT 100
            `,
            [
                adminId
            ]
        ),

        tursoDb.get(
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
        )

    ]);


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
// PUBLIC ANNOUNCEMENT TARGET
// ========================================

async function initializePublicAnnouncementTargets() {

    /*
        Pastikan Master Kelas tersedia.
    */
    await ensureClassesTable();


    /*
        Periksa apakah public_announcements
        sudah memiliki kolom target_type.
    */
    const announcementColumns =
        await tursoDb.all(`
            PRAGMA table_info(
                public_announcements
            )
        `);


    const hasTargetType =
        announcementColumns.some(
            column =>
                column.name ===
                "target_type"
        );


    /*
        Announcement lama otomatis menjadi Global.
    */
    if (!hasTargetType) {

        await tursoDb.run(`
            ALTER TABLE
                public_announcements
            ADD COLUMN
                target_type TEXT
                NOT NULL
                DEFAULT 'global'
        `);

    }


    /*
        Tabel penghubung Announcement
        dengan kelas yang dipilih.
    */
    await tursoDb.run(`
        CREATE TABLE IF NOT EXISTS
            public_announcement_classes
        (
            announcement_id INTEGER NOT NULL,
            class_id INTEGER NOT NULL,

            PRIMARY KEY (
                announcement_id,
                class_id
            ),

            FOREIGN KEY (
                announcement_id
            )
            REFERENCES public_announcements(id)
            ON DELETE CASCADE,

            FOREIGN KEY (
                class_id
            )
            REFERENCES classes(id)
            ON DELETE CASCADE
        )
    `);


    await tursoDb.run(`
        CREATE INDEX IF NOT EXISTS
            idx_public_announcement_classes_announcement
        ON public_announcement_classes (
            announcement_id
        )
    `);


    await tursoDb.run(`
        CREATE INDEX IF NOT EXISTS
            idx_public_announcement_classes_class
        ON public_announcement_classes (
            class_id
        )
    `);


    /*
        Jaga kompatibilitas apabila ada baris lama
        yang target_type-nya kosong.
    */
    await tursoDb.run(`
        UPDATE public_announcements
        SET target_type = 'global'
        WHERE
            target_type IS NULL
            OR TRIM(target_type) = ''
    `);

}


let publicAnnouncementTargetsReadyPromise =
    null;


async function ensurePublicAnnouncementTargets() {

    if (
        publicAnnouncementTargetsReadyPromise
    ) {

        return (
            publicAnnouncementTargetsReadyPromise
        );

    }


    publicAnnouncementTargetsReadyPromise =
        initializePublicAnnouncementTargets();


    try {

        await publicAnnouncementTargetsReadyPromise;


    } catch (error) {

        publicAnnouncementTargetsReadyPromise =
            null;


        throw error;

    }

}


// ========================================
// PASANG DATA TARGET KE ANNOUNCEMENT
// ========================================

async function attachPublicAnnouncementTargets(
    announcements
) {

    if (
        !Array.isArray(announcements) ||
        announcements.length === 0
    ) {

        return [];

    }


    await ensurePublicAnnouncementTargets();


    const announcementIds =
        announcements
            .map(
                announcement =>
                    Number(
                        announcement.id
                    )
            )
            .filter(
                announcementId =>
                    Number.isInteger(
                        announcementId
                    )
            );


    if (
        announcementIds.length === 0
    ) {

        return announcements.map(
            announcement => ({
                ...announcement,

                target_type:
                    "global",

                target_classes:
                    []
            })
        );

    }


    const placeholders =
        announcementIds
            .map(() => "?")
            .join(", ");


    const targetRows =
        await tursoDb.all(
            `
                SELECT
                    public_announcement_classes
                        .announcement_id,

                    classes.id
                        AS class_id,

                    classes.name
                        AS class_name

                FROM public_announcement_classes

                INNER JOIN classes
                ON classes.id =
                    public_announcement_classes
                        .class_id

                WHERE
                    public_announcement_classes
                        .announcement_id
                    IN (${placeholders})

                ORDER BY
                    classes.name
                    COLLATE NOCASE ASC
            `,
            announcementIds
        );


    const targetMap =
        new Map();


    targetRows.forEach(row => {

        const announcementId =
            Number(
                row.announcement_id
            );


        if (
            !targetMap.has(
                announcementId
            )
        ) {

            targetMap.set(
                announcementId,
                []
            );

        }


        targetMap
            .get(announcementId)
            .push({
                id:
                    Number(
                        row.class_id
                    ),

                name:
                    row.class_name
            });

    });


    return announcements.map(
        announcement => {

            const targetType =
                announcement.target_type ===
                    "classes"
                    ? "classes"
                    : "global";


            return {
                ...announcement,

                target_type:
                    targetType,

                target_classes:
                    targetType === "classes"
                        ? (
                            targetMap.get(
                                Number(
                                    announcement.id
                                )
                            ) || []
                        )
                        : []
            };

        }
    );

}

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
            Number(
                req.session.adminId
            );


        const {
            title,
            message,
            classIds = []
        } = req.body;


        if (
            typeof title !== "string" ||
            title.trim().length === 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Judul wajib diisi."
            });

        }


        if (
            typeof message !== "string" ||
            message.trim().length === 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Isi announcement wajib diisi."
            });

        }


        if (!Array.isArray(classIds)) {

            return res.status(400).json({
                success: false,
                message:
                    "Daftar kelas tidak valid."
            });

        }


        let createdAnnouncementId =
            null;


        try {

            await ensurePublicAnnouncementTargets();


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


            const allClasses =
                await tursoDb.all(`
                    SELECT
                        id,
                        name
                    FROM classes
                    ORDER BY
                        name COLLATE NOCASE ASC
                `);


            const normalizedClassIds =
                [
                    ...new Set(
                        classIds
                            .map(
                                classId =>
                                    Number(
                                        classId
                                    )
                            )
                            .filter(
                                classId =>
                                    Number.isInteger(
                                        classId
                                    ) &&
                                    classId > 0
                            )
                    )
                ];


            /*
                Jika Master Kelas tersedia,
                minimal satu kelas harus dipilih.
            */
            if (
                allClasses.length > 0 &&
                normalizedClassIds.length === 0
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Pilih minimal satu kelas."
                });

            }


            const selectedClasses =
                allClasses.filter(
                    classData =>
                        normalizedClassIds.includes(
                            Number(
                                classData.id
                            )
                        )
                );


            /*
                Cegah ID kelas palsu atau
                kelas yang sudah tidak tersedia.
            */
            if (
                selectedClasses.length !==
                normalizedClassIds.length
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Salah satu kelas yang dipilih tidak valid."
                });

            }


            /*
                Semua kelas dipilih otomatis dianggap Global.
                Jika hanya sebagian, targetnya Classes.
            */
            const resolvedTargetType =
                allClasses.length === 0 ||
                selectedClasses.length ===
                    allClasses.length
                    ? "global"
                    : "classes";


            const result =
                await tursoDb.run(
                    `
                        INSERT INTO
                            public_announcements
                        (
                            admin_id,
                            title,
                            message,
                            target_type
                        )
                        VALUES (?, ?, ?, ?)
                    `,
                    [
                        adminId,
                        title.trim(),
                        message.trim(),
                        resolvedTargetType
                    ]
                );


            createdAnnouncementId =
                Number(
                    result.lastInsertRowid
                );


            /*
                Target kelas hanya disimpan jika
                tidak semua kelas dipilih.
            */
            if (
                resolvedTargetType ===
                    "classes"
            ) {

                const targetQueries =
                    selectedClasses.map(
                        classData => ({
                            sql: `
                                INSERT INTO
                                    public_announcement_classes
                                (
                                    announcement_id,
                                    class_id
                                )
                                VALUES (?, ?)
                            `,

                            args: [
                                createdAnnouncementId,
                                Number(
                                    classData.id
                                )
                            ]
                        })
                    );


                await tursoDb.batch(
                    targetQueries,
                    "immediate"
                );

            }


            return res.json({

                success: true,

                message:
                    resolvedTargetType ===
                        "global"
                        ? "Announcement Global berhasil dibuat."
                        : "Announcement kelas berhasil dibuat.",

                announcement: {

                    id:
                        createdAnnouncementId,

                    admin_id:
                        adminId,

                    admin_name:
                        admin.name,

                    title:
                        title.trim(),

                    message:
                        message.trim(),

                    target_type:
                        resolvedTargetType,

                    target_classes:
                        resolvedTargetType ===
                            "classes"
                            ? selectedClasses.map(
                                classData => ({
                                    id:
                                        Number(
                                            classData.id
                                        ),

                                    name:
                                        classData.name
                                })
                            )
                            : []

                }

            });


        } catch (error) {

            console.error(
                "Error membuat announcement:",
                error
            );


            if (
                Number.isInteger(
                    createdAnnouncementId
                )
            ) {

                try {

                    await tursoDb.batch(
                        [
                            {
                                sql: `
                                    DELETE FROM
                                        public_announcement_classes
                                    WHERE
                                        announcement_id = ?
                                `,

                                args: [
                                    createdAnnouncementId
                                ]
                            },

                            {
                                sql: `
                                    DELETE FROM
                                        public_announcements
                                    WHERE id = ?
                                `,

                                args: [
                                    createdAnnouncementId
                                ]
                            }
                        ],
                        "immediate"
                    );


                } catch (
                    rollbackError
                ) {

                    console.error(
                        "Rollback announcement gagal:",
                        rollbackError
                    );

                }

            }


            return res.status(500).json({
                success: false,
                message:
                    "Gagal membuat announcement."
            });

        }

    }
);


// ========================================
// AMBIL ANNOUNCEMENT SESUAI AKSES
// ========================================

app.get(
    "/api/public-announcements",
    async (req, res) => {

        res.set({
            "Cache-Control":
                "no-store, no-cache, must-revalidate, private",

            "Pragma":
                "no-cache",

            "Expires":
                "0"
        });


        try {

            await ensurePublicAnnouncementTargets();


            const isAdmin =
                Boolean(
                    req.session.adminId
                );


            const sessionStudentId =
                Number(
                    req.session.studentId
                );


            let announcements;


            // =================================
            // ADMIN MELIHAT SEMUA
            // =================================

            if (isAdmin) {

                announcements =
                    await tursoDb.all(`
                        SELECT
                            public_announcements.id,
                            public_announcements.title,
                            public_announcements.message,
                            public_announcements.created_at,
                            public_announcements.target_type,

                            admins.id
                                AS admin_id,

                            admins.name
                                AS admin_name

                        FROM public_announcements

                        LEFT JOIN admins
                        ON admins.id =
                            public_announcements.admin_id

                        ORDER BY
                            public_announcements.id DESC
                    `);

            }


            // =================================
            // SISWA SESUAI KELASNYA
            // =================================

            else if (
                Number.isInteger(
                    sessionStudentId
                )
            ) {

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
                            sessionStudentId
                        ]
                    );


                if (!student) {

                    return res.status(404).json({
                        success: false,
                        message:
                            "Siswa tidak ditemukan."
                    });

                }


                announcements =
                    await tursoDb.all(
                        `
                            SELECT
                                public_announcements.id,
                                public_announcements.title,
                                public_announcements.message,
                                public_announcements.created_at,
                                public_announcements.target_type,

                                admins.id
                                    AS admin_id,

                                admins.name
                                    AS admin_name

                            FROM public_announcements

                            LEFT JOIN admins
                            ON admins.id =
                                public_announcements.admin_id

                            WHERE

                                public_announcements
                                    .target_type =
                                    'global'

                                OR

                                EXISTS (

                                    SELECT
                                        1

                                    FROM
                                        public_announcement_classes

                                    INNER JOIN classes
                                    ON classes.id =
                                        public_announcement_classes
                                            .class_id

                                    WHERE
                                        public_announcement_classes
                                            .announcement_id =
                                            public_announcements.id

AND
    TRIM(classes.name) =
        TRIM(?)
    COLLATE NOCASE

                                )

                            ORDER BY
                                public_announcements.id DESC
                        `,
                        [
                            student.class_name
                        ]
                    );

            }


            // =================================
            // TANPA SESSION: GLOBAL SAJA
            // =================================

            else {

                announcements =
                    await tursoDb.all(`
                        SELECT
                            public_announcements.id,
                            public_announcements.title,
                            public_announcements.message,
                            public_announcements.created_at,
                            public_announcements.target_type,

                            admins.id
                                AS admin_id,

                            admins.name
                                AS admin_name

                        FROM public_announcements

                        LEFT JOIN admins
                        ON admins.id =
                            public_announcements.admin_id

                        WHERE
                            public_announcements
                                .target_type =
                                'global'

                        ORDER BY
                            public_announcements.id DESC
                    `);

            }


            const announcementsWithTargets =
                await attachPublicAnnouncementTargets(
                    announcements
                );


            return res.json({

                success: true,

                announcements:
                    announcementsWithTargets

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
            Number(
                req.params.id
            );


        if (
            !Number.isInteger(
                announcementId
            ) ||
            announcementId <= 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "ID announcement tidak valid."
            });

        }


        try {

            await ensurePublicAnnouncementTargets();


            const announcement =
                await tursoDb.get(
                    `
                        SELECT id
                        FROM public_announcements
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


            await tursoDb.batch(
                [
                    {
                        sql: `
                            DELETE FROM
                                public_announcement_classes
                            WHERE
                                announcement_id = ?
                        `,

                        args: [
                            announcementId
                        ]
                    },

                    {
                        sql: `
                            DELETE FROM
                                public_announcements
                            WHERE id = ?
                        `,

                        args: [
                            announcementId
                        ]
                    }
                ],
                "immediate"
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
                    "admin123",
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

            /*
    Factory Reset juga menghapus
    seluruh katalog Mapel.
*/
await ensureSubjectsTable();

await tursoDb.run(
    `
        DELETE FROM subjects
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
        DELETE FROM students
    `
);


/*
    Factory Reset juga harus
    menghapus seluruh Master Kelas.
*/
await ensureClassesTable();

await tursoDb.run(
    `
        DELETE FROM classes
    `
);


await tursoDb.run(
    `
        DELETE FROM admins
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
    "subjects",
    "teacher_registration_codes",
    "students",
    "classes",
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
        "admin",
        passwordHash,
        "Admin",
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
    "Factory reset berhasil. Semua data telah dihapus dan akun default sementara dibuat kembali."
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

AND
    announcements.created_at <=
        datetime('now', '-1 second')

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

AND
    announcement_replies.created_at <=
        datetime('now', '-1 second')

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
    null,

profile_picture_url:
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

async function startServer() {

    /*
        Warm-up koneksi Turso sebelum
        menerima request pertama.
    */
    try {

        const startTime =
            Date.now();


        await tursoDb.get(
            `
                SELECT 1 AS ready
            `
        );


        console.log(
            `Turso siap (${Date.now() - startTime} ms)`
        );


    } catch (error) {

        console.error(
            "Warm-up Turso gagal:",
            error.message
        );

    }


    app.listen(
        PORT,
        "0.0.0.0",
        () => {

            console.log(
                `Server jalan di port ${PORT}`
            );

        }
    );

}


startServer();