require("dotenv").config();

const {
    connect
} = require(
    "@tursodatabase/serverless"
);


if (
    !process.env.TURSO_DATABASE_URL ||
    !process.env.TURSO_AUTH_TOKEN
) {

    throw new Error(
        "TURSO_DATABASE_URL atau TURSO_AUTH_TOKEN belum diatur."
    );

}


const db =
    connect({
        url:
            process.env.TURSO_DATABASE_URL,

        authToken:
            process.env.TURSO_AUTH_TOKEN
    });


module.exports = db;