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

// =========================================
// WAKTU RELATIF FEED / INFORMATION BOARD
// =========================================

function formatRelativeTime(value) {

    const date =
        parseUtcTimestamp(value);


    if (!date) {
        return "-";
    }


    const seconds =
        Math.max(
            0,
            Math.floor(
                (
                    Date.now() -
                    date.getTime()
                ) / 1000
            )
        );


    if (seconds < 60) {
        return "Just now";
    }


    if (seconds < 60 * 60) {

        return `${
            Math.floor(
                seconds / 60
            )
        }m`;

    }


    if (seconds < 60 * 60 * 24) {

        return `${
            Math.floor(
                seconds /
                (60 * 60)
            )
        }h`;

    }


    if (seconds < 60 * 60 * 24 * 7) {

        return `${
            Math.floor(
                seconds /
                (60 * 60 * 24)
            )
        }d`;

    }


    if (seconds < 60 * 60 * 24 * 30) {

        return `${
            Math.floor(
                seconds /
                (60 * 60 * 24 * 7)
            )
        }w`;

    }


    if (seconds < 60 * 60 * 24 * 365) {

        return `${
            Math.floor(
                seconds /
                (60 * 60 * 24 * 30)
            )
        }mo`;

    }


    return `${
        Math.floor(
            seconds /
            (60 * 60 * 24 * 365)
        )
    }y`;

}


function refreshRelativeTimes(
    root = document
) {

    const elements = [];


    if (
        root instanceof Element &&
        root.matches(
            "time[data-relative-time]"
        )
    ) {
        elements.push(root);
    }


    if (
        typeof root.querySelectorAll ===
        "function"
    ) {

        elements.push(
            ...root.querySelectorAll(
                "time[data-relative-time]"
            )
        );

    }


elements.forEach(element => {

    const value =
        element.getAttribute(
            "datetime"
        );

    const relativeTime =
        formatRelativeTime(value);

    const exactTime =
        formatDeviceDateTime(value);


    element.textContent =
        relativeTime;

    element.title =
        exactTime;

    element.tabIndex =
        0;

    element.setAttribute(
        "role",
        "button"
    );

    element.setAttribute(
        "aria-label",
        `${relativeTime}. Ketuk untuk melihat ${exactTime}`
    );

});

}

let relativeTimeToastTimer =
    null;


function showExactRelativeTime(
    element
) {

    const value =
        element.getAttribute(
            "datetime"
        );

    const exactTime =
        formatDeviceDateTime(value);


    let toast =
        document.getElementById(
            "relativeTimeToast"
        );


    if (!toast) {

        toast =
            document.createElement(
                "div"
            );

        toast.id =
            "relativeTimeToast";

        toast.className =
            "relative-time-toast";

        toast.hidden =
            true;

        toast.setAttribute(
            "role",
            "status"
        );

        toast.setAttribute(
            "aria-live",
            "polite"
        );

        document.body.appendChild(
            toast
        );

    }


    window.clearTimeout(
        relativeTimeToastTimer
    );


    toast.textContent =
        exactTime;

    toast.hidden =
        false;


    requestAnimationFrame(() => {

        toast.classList.add(
            "is-visible"
        );

    });


    relativeTimeToastTimer =
        window.setTimeout(
            () => {

                toast.classList.remove(
                    "is-visible"
                );


                window.setTimeout(
                    () => {

                        if (
                            !toast.classList.contains(
                                "is-visible"
                            )
                        ) {

                            toast.hidden =
                                true;

                        }

                    },
                    180
                );

            },
            3000
        );

}


function startRelativeTimeUpdater() {

    refreshRelativeTimes();


    const observer =
        new MutationObserver(
            mutations => {

                mutations.forEach(
                    mutation => {

                        mutation.addedNodes
                            .forEach(node => {

                                if (
                                    node instanceof
                                    Element
                                ) {

                                    refreshRelativeTimes(
                                        node
                                    );

                                }

                            });

                    }
                );

            }
        );


observer.observe(
    document.body,
    {
        childList: true,
        subtree: true
    }
);


document.addEventListener(
    "click",
    event => {

        const target =
            event.target instanceof Element
                ? event.target.closest(
                    "time[data-relative-time]"
                )
                : null;


        if (!target) {
            return;
        }


        showExactRelativeTime(
            target
        );

    }
);


document.addEventListener(
    "keydown",
    event => {

        const target =
            event.target instanceof Element
                ? event.target.closest(
                    "time[data-relative-time]"
                )
                : null;


        if (
            !target ||
            (
                event.key !== "Enter" &&
                event.key !== " "
            )
        ) {
            return;
        }


        event.preventDefault();

        showExactRelativeTime(
            target
        );

    }
);


window.setInterval(
        () =>
            refreshRelativeTimes(),
        30 * 1000
    );

}


if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        startRelativeTimeUpdater,
        {
            once: true
        }
    );

} else {

    startRelativeTimeUpdater();

}


window.formatRelativeTime =
    formatRelativeTime;

window.refreshRelativeTimes =
    refreshRelativeTimes;