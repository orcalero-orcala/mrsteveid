const session =
    require("express-session");

const tursoDb =
    require("./database-turso");


class TursoSessionStore
    extends session.Store {

    constructor(options = {}) {

        super();

        this.defaultMaxAge =
            options.defaultMaxAge ||
            (
                1000 *
                60 *
                60 *
                8
            );

    }


    get(sid, callback) {

        this.getAsync(
            sid
        )
            .then(
                (sessionData) =>
                    callback(
                        null,
                        sessionData
                    )
            )
            .catch(
                (error) =>
                    callback(error)
            );

    }


    async getAsync(sid) {

        const row =
            await tursoDb.get(
                `
                    SELECT
                        data,
                        expires_at
                    FROM sessions
                    WHERE sid = ?
                `,
                [
                    sid
                ]
            );


        if (!row) {

            return null;

        }


        const expiresAt =
            Number(
                row.expires_at
            );


        if (
            !Number.isFinite(expiresAt) ||
            expiresAt <= Date.now()
        ) {

            await tursoDb.run(
                `
                    DELETE FROM sessions
                    WHERE sid = ?
                `,
                [
                    sid
                ]
            );


            return null;

        }


        return JSON.parse(
            row.data
        );

    }


    set(sid, sessionData, callback) {

        this.setAsync(
            sid,
            sessionData
        )
            .then(
                () =>
                    callback &&
                    callback(null)
            )
            .catch(
                (error) =>
                    callback &&
                    callback(error)
            );

    }


    async setAsync(
        sid,
        sessionData
    ) {

        let expiresAt =
            Date.now() +
            this.defaultMaxAge;


        if (
            sessionData.cookie &&
            sessionData.cookie.expires
        ) {

            const cookieExpires =
                new Date(
                    sessionData.cookie.expires
                ).getTime();


            if (
                Number.isFinite(
                    cookieExpires
                )
            ) {

                expiresAt =
                    cookieExpires;

            }

        }


        const now =
            Date.now();


        await tursoDb.run(
            `
                INSERT INTO sessions (
                    sid,
                    data,
                    expires_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?)

                ON CONFLICT(sid)
                DO UPDATE SET
                    data = excluded.data,
                    expires_at = excluded.expires_at,
                    updated_at = excluded.updated_at
            `,
            [
                sid,
                JSON.stringify(
                    sessionData
                ),
                expiresAt,
                now
            ]
        );

    }


    destroy(sid, callback) {

        tursoDb
            .run(
                `
                    DELETE FROM sessions
                    WHERE sid = ?
                `,
                [
                    sid
                ]
            )
            .then(
                () =>
                    callback &&
                    callback(null)
            )
            .catch(
                (error) =>
                    callback &&
                    callback(error)
            );

    }


    touch(
        sid,
        sessionData,
        callback
    ) {

        this.touchAsync(
            sid,
            sessionData
        )
            .then(
                () =>
                    callback &&
                    callback(null)
            )
            .catch(
                (error) =>
                    callback &&
                    callback(error)
            );

    }


async touchAsync(
    sid,
    sessionData
) {

    const now =
        Date.now();

    /*
        Jangan menulis session ke Turso
        pada setiap request.

        Session cukup diperpanjang bila
        terakhir di-update sudah lebih dari
        5 menit.
    */
    const row =
        await tursoDb.get(
            `
                SELECT updated_at
                FROM sessions
                WHERE sid = ?
            `,
            [
                sid
            ]
        );


    if (
        row &&
        Number.isFinite(
            Number(row.updated_at)
        ) &&
        now - Number(row.updated_at) <
            5 * 60 * 1000
    ) {

        return;

    }


    let expiresAt =
        now +
        this.defaultMaxAge;


        if (
            sessionData.cookie &&
            sessionData.cookie.expires
        ) {

            const cookieExpires =
                new Date(
                    sessionData.cookie.expires
                ).getTime();


            if (
                Number.isFinite(
                    cookieExpires
                )
            ) {

                expiresAt =
                    cookieExpires;

            }

        }


await tursoDb.run(
    `
        UPDATE sessions
        SET
            expires_at = ?,
            updated_at = ?
        WHERE sid = ?
    `,
    [
        expiresAt,
        now,
        sid
    ]
);

    }

}


module.exports =
    TursoSessionStore;