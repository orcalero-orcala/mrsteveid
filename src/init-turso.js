const bcrypt = require("bcryptjs");
const db = require("./database-turso");


function validateIdentifier(value) {
    if (!/^[a-z_][a-z0-9_]*$/i.test(String(value || ""))) {
        throw new Error(`Identifier SQL tidak valid: ${value}`);
    }
}


async function ensureColumns(tableName, columns) {
    validateIdentifier(tableName);

    const rows = await db.all(`PRAGMA table_info(${tableName})`);
    const existing = new Set(rows.map(row => String(row.name)));

    if (existing.size === 0) {
        throw new Error(`Tabel ${tableName} tidak ditemukan.`);
    }

    for (const [columnName, definition] of Object.entries(columns)) {
        validateIdentifier(columnName);

        if (existing.has(columnName)) {
            continue;
        }

        try {
            await db.run(`
                ALTER TABLE ${tableName}
                ADD COLUMN ${columnName} ${definition}
            `);

            existing.add(columnName);
            console.log(`+ Kolom ${tableName}.${columnName}`);
        } catch (error) {
            if (/duplicate column name/i.test(String(error?.message || error))) {
                existing.add(columnName);
                continue;
            }

            throw error;
        }
    }
}


async function runStatements(statements) {
    for (const statement of statements) {
        await db.run(statement);
    }
}


async function initTurso() {
    try {
        console.log("Memeriksa schema Turso...");

        const tables = [
            `CREATE TABLE IF NOT EXISTS classes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL COLLATE NOCASE UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            `CREATE TABLE IF NOT EXISTS subjects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL COLLATE NOCASE UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            `CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                login_code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                full_name TEXT,
                date_of_birth TEXT,
                class_name TEXT NOT NULL,
                profile_bio TEXT NOT NULL DEFAULT '',
                profile_banner_color TEXT NOT NULL DEFAULT 'blue',
                profile_picture_url TEXT,
                profile_picture_public_id TEXT,
                profile_picture_width INTEGER,
                profile_picture_height INTEGER,
                profile_picture_bytes INTEGER,
                profile_show_academic_stats INTEGER NOT NULL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            `CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                name TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'teacher',
                profile_bio TEXT NOT NULL DEFAULT '',
                profile_banner_color TEXT NOT NULL DEFAULT 'blue',
                profile_picture_url TEXT,
                profile_picture_public_id TEXT,
                profile_picture_width INTEGER,
                profile_picture_height INTEGER,
                profile_picture_bytes INTEGER,
                profile_date_of_birth TEXT,
                profile_is_homeroom_teacher INTEGER NOT NULL DEFAULT 0,
                profile_homeroom_class_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            `CREATE TABLE IF NOT EXISTS point_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL,
                points INTEGER NOT NULL,
                reason TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES students(id)
            )`,

            `CREATE TABLE IF NOT EXISTS exam_scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL,
                subject TEXT NOT NULL,
                material TEXT NOT NULL,
                score REAL NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES students(id)
            )`,

            `CREATE TABLE IF NOT EXISTS announcements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER,
                admin_id INTEGER,
                class_name TEXT,
                message TEXT NOT NULL,
                image_url TEXT,
                image_public_id TEXT,
                image_width INTEGER,
                image_height INTEGER,
                image_bytes INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES students(id),
                FOREIGN KEY (admin_id) REFERENCES admins(id)
            )`,

            `CREATE TABLE IF NOT EXISTS announcement_replies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                announcement_id INTEGER NOT NULL,
                student_id INTEGER,
                admin_id INTEGER,
                message TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (announcement_id) REFERENCES announcements(id),
                FOREIGN KEY (student_id) REFERENCES students(id),
                FOREIGN KEY (admin_id) REFERENCES admins(id)
            )`,

            `CREATE TABLE IF NOT EXISTS announcement_mentions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                announcement_id INTEGER,
                reply_id INTEGER,
                mentioned_student_id INTEGER,
                mentioned_admin_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            `CREATE TABLE IF NOT EXISTS notifications (
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
            )`,

            `CREATE TABLE IF NOT EXISTS public_announcements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                target_type TEXT NOT NULL DEFAULT 'global',
                image_url TEXT,
                image_public_id TEXT,
                image_width INTEGER,
                image_height INTEGER,
                image_bytes INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (admin_id) REFERENCES admins(id)
            )`,

            `CREATE TABLE IF NOT EXISTS public_announcement_classes (
                announcement_id INTEGER NOT NULL,
                class_id INTEGER NOT NULL,
                PRIMARY KEY (announcement_id, class_id),
                FOREIGN KEY (announcement_id) REFERENCES public_announcements(id) ON DELETE CASCADE,
                FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
            )`,

            `CREATE TABLE IF NOT EXISTS teacher_registration_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT NOT NULL UNIQUE,
                created_by_admin_id INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
                used_by_admin_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                used_at DATETIME,
                revoked_at DATETIME,
                FOREIGN KEY (created_by_admin_id) REFERENCES admins(id),
                FOREIGN KEY (used_by_admin_id) REFERENCES admins(id)
            )`,

            `CREATE TABLE IF NOT EXISTS administrator_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                password_hash TEXT NOT NULL,
                updated_by_admin_id INTEGER,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (updated_by_admin_id) REFERENCES admins(id) ON DELETE SET NULL
            )`,

            `CREATE TABLE IF NOT EXISTS admin_profile_subjects (
                admin_id INTEGER NOT NULL,
                subject_id INTEGER NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (admin_id, subject_id),
                FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
                FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
            )`,

            `CREATE TABLE IF NOT EXISTS quizzes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL DEFAULT 'Quiz Tanpa Judul',
                description TEXT,
                subject TEXT,
                material TEXT,
                status TEXT NOT NULL DEFAULT 'draft',
                due_at DATETIME,
                created_by INTEGER NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                published_at DATETIME,
                use_type_weights INTEGER NOT NULL DEFAULT 0,
                essay_weight INTEGER NOT NULL DEFAULT 60,
                allow_private INTEGER NOT NULL DEFAULT 1,
                allow_public INTEGER NOT NULL DEFAULT 0,
                private_audience TEXT NOT NULL DEFAULT 'all',
                public_token TEXT,
                FOREIGN KEY (created_by) REFERENCES admins(id)
            )`,

            `CREATE TABLE IF NOT EXISTS quiz_allowed_students (
                quiz_id INTEGER NOT NULL,
                student_id INTEGER NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (quiz_id, student_id),
                FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
            )`,

            `CREATE TABLE IF NOT EXISTS quiz_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                quiz_id INTEGER NOT NULL,
                client_key TEXT NOT NULL,
                question_type TEXT NOT NULL,
                question_text TEXT NOT NULL DEFAULT '',
                correct_text_answer TEXT,
                image_url TEXT,
                image_public_id TEXT,
                image_width INTEGER,
                image_height INTEGER,
                image_bytes INTEGER,
                position INTEGER NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (quiz_id, client_key),
                UNIQUE (quiz_id, position),
                FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
            )`,

            `CREATE TABLE IF NOT EXISTS quiz_options (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question_id INTEGER NOT NULL,
                option_text TEXT NOT NULL DEFAULT '',
                position INTEGER NOT NULL,
                is_correct INTEGER NOT NULL DEFAULT 0,
                UNIQUE (question_id, position),
                FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE
            )`,

            `CREATE TABLE IF NOT EXISTS quiz_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                quiz_id INTEGER NOT NULL,
                student_id INTEGER NOT NULL,
                correct_count INTEGER NOT NULL,
                total_questions INTEGER NOT NULL,
                score INTEGER NOT NULL,
                submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (quiz_id, student_id),
                FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
            )`,

            `CREATE TABLE IF NOT EXISTS quiz_answers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                attempt_id INTEGER NOT NULL,
                question_id INTEGER NOT NULL,
                selected_option_id INTEGER,
                text_answer TEXT,
                is_correct INTEGER NOT NULL DEFAULT 0,
                UNIQUE (attempt_id, question_id),
                FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
                FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE,
                FOREIGN KEY (selected_option_id) REFERENCES quiz_options(id) ON DELETE SET NULL
            )`,

            `CREATE TABLE IF NOT EXISTS quiz_guest_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                quiz_id INTEGER NOT NULL,
                submission_key TEXT NOT NULL UNIQUE,
                guest_name TEXT NOT NULL,
                correct_count INTEGER NOT NULL,
                total_questions INTEGER NOT NULL,
                score INTEGER NOT NULL,
                submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
            )`,

            `CREATE TABLE IF NOT EXISTS quiz_guest_answers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guest_attempt_id INTEGER NOT NULL,
                question_id INTEGER NOT NULL,
                selected_option_id INTEGER,
                text_answer TEXT,
                is_correct INTEGER NOT NULL DEFAULT 0,
                UNIQUE (guest_attempt_id, question_id),
                FOREIGN KEY (guest_attempt_id) REFERENCES quiz_guest_attempts(id) ON DELETE CASCADE,
                FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE,
                FOREIGN KEY (selected_option_id) REFERENCES quiz_options(id) ON DELETE SET NULL
            )`,

            `CREATE TABLE IF NOT EXISTS feed_moderation (
                student_id INTEGER PRIMARY KEY,
                status TEXT NOT NULL DEFAULT 'active',
                muted_until DATETIME,
                reason TEXT,
                moderated_by INTEGER,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
            )`,

            `CREATE TABLE IF NOT EXISTS feed_moderation_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL,
                event_type TEXT NOT NULL,
                reason TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                seen_at DATETIME,
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
            )`,

            `CREATE TABLE IF NOT EXISTS feed_moderation_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL,
                action_type TEXT NOT NULL,
                status TEXT NOT NULL,
                duration_minutes INTEGER,
                starts_at DATETIME,
                ends_at DATETIME,
                reason TEXT,
                moderated_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME,
                lifted_at DATETIME,
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
            )`,

            `CREATE TABLE IF NOT EXISTS sessions (
                sid TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )`,

            `CREATE TABLE IF NOT EXISTS system_reset_test_runs (
                token TEXT PRIMARY KEY,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        await runStatements(tables);

        const migrations = {
            students: {
                profile_bio: "TEXT NOT NULL DEFAULT ''",
                profile_banner_color: "TEXT NOT NULL DEFAULT 'blue'",
                profile_picture_url: "TEXT",
                profile_picture_public_id: "TEXT",
                profile_picture_width: "INTEGER",
                profile_picture_height: "INTEGER",
                profile_picture_bytes: "INTEGER",
                profile_show_academic_stats: "INTEGER NOT NULL DEFAULT 0"
            },
            admins: {
                profile_bio: "TEXT NOT NULL DEFAULT ''",
                profile_banner_color: "TEXT NOT NULL DEFAULT 'blue'",
                profile_picture_url: "TEXT",
                profile_picture_public_id: "TEXT",
                profile_picture_width: "INTEGER",
                profile_picture_height: "INTEGER",
                profile_picture_bytes: "INTEGER",
                profile_date_of_birth: "TEXT",
                profile_is_homeroom_teacher: "INTEGER NOT NULL DEFAULT 0",
                profile_homeroom_class_id: "INTEGER"
            },
            announcements: {
                image_url: "TEXT",
                image_public_id: "TEXT",
                image_width: "INTEGER",
                image_height: "INTEGER",
                image_bytes: "INTEGER"
            },
            quizzes: {
                use_type_weights: "INTEGER NOT NULL DEFAULT 0",
                essay_weight: "INTEGER NOT NULL DEFAULT 60",
                allow_private: "INTEGER NOT NULL DEFAULT 1",
                allow_public: "INTEGER NOT NULL DEFAULT 0",
                private_audience: "TEXT NOT NULL DEFAULT 'all'",
                public_token: "TEXT"
            },
            quiz_questions: {
                image_url: "TEXT",
                image_public_id: "TEXT",
                image_width: "INTEGER",
                image_height: "INTEGER",
                image_bytes: "INTEGER"
            },
            public_announcements: {
                target_type: "TEXT NOT NULL DEFAULT 'global'",
                image_url: "TEXT",
                image_public_id: "TEXT",
                image_width: "INTEGER",
                image_height: "INTEGER",
                image_bytes: "INTEGER"
            }
        };

        for (const [tableName, columns] of Object.entries(migrations)) {
            await ensureColumns(tableName, columns);
        }

        const indexes = [
            `CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`,
            `CREATE INDEX IF NOT EXISTS idx_admin_profile_subjects_subject ON admin_profile_subjects(subject_id)`,
            `CREATE INDEX IF NOT EXISTS idx_quiz_allowed_students_student ON quiz_allowed_students(student_id, quiz_id)`,
            `CREATE UNIQUE INDEX IF NOT EXISTS idx_quizzes_public_token ON quizzes(public_token) WHERE public_token IS NOT NULL`,
            `CREATE INDEX IF NOT EXISTS idx_quiz_guest_attempts_quiz ON quiz_guest_attempts(quiz_id, submitted_at DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_quiz_guest_answers_attempt ON quiz_guest_answers(guest_attempt_id, question_id)`,
            `CREATE INDEX IF NOT EXISTS idx_quizzes_status_due ON quizzes(status, due_at)`,
            `CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON quiz_attempts(quiz_id, submitted_at DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student ON quiz_attempts(student_id, submitted_at DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_position ON quiz_questions(quiz_id, position)`,
            `CREATE INDEX IF NOT EXISTS idx_feed_moderation_events_student ON feed_moderation_events(student_id, id DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_feed_moderation_events_pending_recovery ON feed_moderation_events(student_id, id DESC) WHERE seen_at IS NULL AND event_type IN ('unmuted', 'unbanned')`,
            `CREATE INDEX IF NOT EXISTS idx_feed_moderation_actions_student ON feed_moderation_actions(student_id, action_type, status, id)`,
            `CREATE INDEX IF NOT EXISTS idx_public_announcement_classes_announcement ON public_announcement_classes(announcement_id)`,
            `CREATE INDEX IF NOT EXISTS idx_public_announcement_classes_class ON public_announcement_classes(class_id)`
        ];

        await runStatements(indexes);

        await db.run(`
            INSERT OR IGNORE INTO classes (name)
            SELECT DISTINCT TRIM(class_name)
            FROM students
            WHERE class_name IS NOT NULL AND TRIM(class_name) <> ''
        `);

        await db.run(`
            INSERT OR IGNORE INTO subjects (name)
            SELECT DISTINCT TRIM(subject)
            FROM exam_scores
            WHERE subject IS NOT NULL AND TRIM(subject) <> ''
        `);

        await db.run(`
            UPDATE public_announcements
            SET target_type = 'global'
            WHERE target_type IS NULL OR TRIM(target_type) = ''
        `);

        const existingSteven = await db.get(`
            SELECT id
            FROM admins
            WHERE username = ?
            LIMIT 1
        `, ["steven"]);

        if (!existingSteven) {
            const passwordHash = await bcrypt.hash("cruise@fl350", 12);

            await db.run(`
                INSERT INTO admins (
                    username,
                    password,
                    name,
                    role
                )
                VALUES (?, ?, ?, ?)
            `, [
                "steven",
                passwordHash,
                "Steven",
                "teacher"
            ]);

            console.log("+ Akun Steven dibuat.");
        } else {
            console.log("= Akun Steven sudah tersedia.");
        }

        console.log(`Schema Turso siap: ${tables.length} tabel dan ${indexes.length} index diperiksa.`);
    } catch (error) {
        console.error("Gagal inisialisasi Turso:", error);
        process.exitCode = 1;
    }
}


initTurso();
