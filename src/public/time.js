// =========================================
// GLOBAL DEVICE TIME FORMATTER
// =========================================

function parseUtcTimestamp(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }


    let text =
        String(value)
            .trim();


    /*
        SQLite CURRENT_TIMESTAMP biasanya:
        2026-08-23 15:10:30

        String seperti itu tidak memiliki penanda timezone.

        Karena SQLite CURRENT_TIMESTAMP = UTC,
        kita ubah menjadi ISO UTC:
        2026-08-23T15:10:30Z
    */
    if (
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/
            .test(text)
    ) {

        text =
            text.replace(
                " ",
                "T"
            ) + "Z";

    }


    /*
        Kalau server nanti sudah mengirim:
        2026-08-23T15:10:30
        tetapi belum ada Z / offset,
        tetap anggap UTC.
    */
    else if (
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/
            .test(text)
    ) {

        text += "Z";

    }


    const date =
        new Date(text);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return null;

    }


    return date;

}


// =========================================
// TANGGAL + JAM DEVICE
// =========================================

function formatDeviceDateTime(value) {

    const date =
        parseUtcTimestamp(value);


    if (!date) {

        return value || "-";

    }


    return new Intl.DateTimeFormat(
        undefined,
        {
            year:
                "numeric",

            month:
                "short",

            day:
                "2-digit",

            hour:
                "2-digit",

            minute:
                "2-digit"
        }
    ).format(date);

}


// =========================================
// TANGGAL DEVICE
// =========================================

function formatDeviceDate(value) {

    const date =
        parseUtcTimestamp(value);


    if (!date) {

        return value || "-";

    }


    return new Intl.DateTimeFormat(
        undefined,
        {
            year:
                "numeric",

            month:
                "short",

            day:
                "2-digit"
        }
    ).format(date);

}


// =========================================
// JAM DEVICE
// =========================================

function formatDeviceTime(value) {

    const date =
        parseUtcTimestamp(value);


    if (!date) {

        return value || "-";

    }


    return new Intl.DateTimeFormat(
        undefined,
        {
            hour:
                "2-digit",

            minute:
                "2-digit"
        }
    ).format(date);

}