const bcrypt =
    require("bcryptjs");

const db =
    require("./database-turso");


async function initTurso() {

    try {

        console.log(
            "Membuat schema Turso..."
        );


await db.run(`
    CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        login_code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        full_name TEXT,
        date_of_birth TEXT,
        class_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);


        await db.run(`
            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                name TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'teacher',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);


        await db.run(`
            CREATE TABLE IF NOT EXISTS point_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL,
                points INTEGER NOT NULL,
                reason TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY (student_id)
                    REFERENCES students(id)
            )
        `);


        await db.run(`
            CREATE TABLE IF NOT EXISTS announcements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER,
                admin_id INTEGER,
                class_name TEXT,
                message TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY (student_id)
                    REFERENCES students(id),

                FOREIGN KEY (admin_id)
                    REFERENCES admins(id)
            )
        `);


        await db.run(`
            CREATE TABLE IF NOT EXISTS announcement_replies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                announcement_id INTEGER NOT NULL,
                student_id INTEGER,
                admin_id INTEGER,
                message TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY (announcement_id)
                    REFERENCES announcements(id),

                FOREIGN KEY (student_id)
                    REFERENCES students(id),

                FOREIGN KEY (admin_id)
                    REFERENCES admins(id)
            )
        `);


        await db.run(`
            CREATE TABLE IF NOT EXISTS announcement_mentions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                announcement_id INTEGER,
                reply_id INTEGER,
                mentioned_student_id INTEGER,
                mentioned_admin_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);


        await db.run(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,

                recipient_student_id INTEGER,
                recipient_admin_id INTEGER,

                sender_student_id INTEGER,
                sender_admin_id INTEGER,

                type TEXT NOT NULL,

                announcement_id INTEGER,
                reply_id INTEGER,

                message TEXT NOT NULL,

                is_read INTEGER DEFAULT 0,

                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);


        await db.run(`
            CREATE TABLE IF NOT EXISTS exam_scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL,
                subject TEXT NOT NULL,
                material TEXT NOT NULL,
                score REAL NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY (student_id)
                    REFERENCES students(id)
            )
        `);


        await db.run(`
            CREATE TABLE IF NOT EXISTS public_announcements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY (admin_id)
                    REFERENCES admins(id)
            )
        `);


        await db.run(`
            CREATE TABLE IF NOT EXISTS teacher_registration_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,

                code TEXT NOT NULL UNIQUE,

                created_by_admin_id INTEGER NOT NULL,

                status TEXT NOT NULL DEFAULT 'active',

                used_by_admin_id INTEGER,

                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

                used_at DATETIME,

                revoked_at DATETIME,

                FOREIGN KEY (created_by_admin_id)
                    REFERENCES admins(id),

                FOREIGN KEY (used_by_admin_id)
                    REFERENCES admins(id)
            )
        `);

        await db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )
`);


await db.run(`
    CREATE INDEX IF NOT EXISTS
    idx_sessions_expires_at
    ON sessions(expires_at)
`);


        console.log(
            "Semua tabel Turso berhasil dibuat."
        );


        // =====================================
        // AKUN GURU DEFAULT
        // =====================================

        const existingSteven =
            await db.get(
                `
                    SELECT id
                    FROM admins
                    WHERE username = ?
                `,
                [
                    "steven"
                ]
            );


        if (!existingSteven) {

            const passwordHash =
                await bcrypt.hash(
                    "cruise@fl350",
                    12
                );


            await db.run(
                `
                    INSERT INTO admins (
                        username,
                        password,
                        name,
                        role
                    )

                    VALUES (?, ?, ?, ?)
                `,
                [
                    "steven",
                    passwordHash,
                    "Steven",
                    "teacher"
                ]
            );


            console.log(
                "Akun Steven berhasil dibuat di Turso."
            );

        } else {

            console.log(
                "Akun Steven sudah ada di Turso."
            );

        }


        console.log("");
        console.log(
            "Inisialisasi Turso selesai."
        );


    } catch (error) {

        console.error(
            "Gagal inisialisasi Turso:",
            error
        );

    }

}


initTurso();