const bcrypt =
    require("bcryptjs");

const db =
    require("./database");


async function createTeacher() {

    try {

        const passwordHash =
            await bcrypt.hash(
                "cruise@fl350",
                12
            );


        const existingSteven =
            db.prepare(`
                SELECT id
                FROM admins
                WHERE username = ?
            `).get("steven");


        if (existingSteven) {

            // Kalau Steven sudah pernah dibuat,
            // cukup update datanya.
            db.prepare(`
                UPDATE admins

                SET
                    password = ?,
                    name = ?,
                    role = ?

                WHERE id = ?
            `).run(
                passwordHash,
                "Steven",
                "teacher",
                existingSteven.id
            );


            console.log(
                "Akun Steven sudah ada dan berhasil diperbarui."
            );

        } else {

            const oldAdmin =
                db.prepare(`
                    SELECT id
                    FROM admins
                    WHERE username = ?
                `).get("admin");


            if (oldAdmin) {

                // Jangan DELETE.
                // Ubah akun admin lama menjadi Steven
                // supaya foreign key tetap aman.
                db.prepare(`
                    UPDATE admins

                    SET
                        username = ?,
                        password = ?,
                        name = ?,
                        role = ?

                    WHERE id = ?
                `).run(
                    "steven",
                    passwordHash,
                    "Steven",
                    "teacher",
                    oldAdmin.id
                );


                console.log(
                    "Akun admin lama berhasil diubah menjadi akun Steven."
                );

            } else {

                // Kalau database benar-benar baru,
                // buat Steven dari nol.
                db.prepare(`
                    INSERT INTO admins (
                        username,
                        password,
                        name,
                        role
                    )

                    VALUES (?, ?, ?, ?)
                `).run(
                    "steven",
                    passwordHash,
                    "Steven",
                    "teacher"
                );


                console.log(
                    "Akun Steven berhasil dibuat."
                );

            }

        }


        console.log("");
        console.log("Login guru:");
        console.log("Username: steven");
        console.log("Password: cruise@fl350");


    } catch (error) {

        console.error(
            "Gagal membuat akun guru:",
            error
        );

    }

}


createTeacher();