(() => {
    "use strict";


    function getEventImage(event) {
        if (
            !(event.target instanceof Element)
        ) {
            return null;
        }

        return event.target.closest("img");
    }


    function isDirectImageLink(image) {
        const link =
            image.closest("a[href]");

        if (!link) {
            return false;
        }

        try {
            const linkUrl =
                new URL(
                    link.href,
                    window.location.href
                );

            const imageUrl =
                new URL(
                    image.currentSrc ||
                    image.src,
                    window.location.href
                );

            return (
                linkUrl.href === imageUrl.href
            );
        } catch {
            return false;
        }
    }

/*
Klik kanan tetap membuka context menu
browser, tetapi gambar sementara tidak
menjadi targetnya.

Dengan begitu menu "Save image as" dan
"Open image in new tab" tidak muncul.
*/

let rightClickDisabledElements = [];

let rightClickRestoreTimer =
    null;


function restoreRightClickTargets() {

    if (rightClickRestoreTimer) {

        clearTimeout(
            rightClickRestoreTimer
        );

        rightClickRestoreTimer =
            null;

    }


    rightClickDisabledElements.forEach(
        item => {

            item.element.style
                .pointerEvents =
                    item.pointerEvents;

        }
    );


    rightClickDisabledElements = [];

}


document.addEventListener(
    "pointerdown",
    event => {

        if (event.button !== 2) {
            return;
        }


        const image =
            getEventImage(event);


        if (!image) {
            return;
        }


        restoreRightClickTargets();


        const imageLink =
            image.closest("a[href]");


        const elementsToDisable = [
            image
        ];


        if (imageLink) {

            elementsToDisable.push(
                imageLink
            );

        }


        rightClickDisabledElements =
            elementsToDisable.map(
                element => ({
                    element,

                    pointerEvents:
                        element.style
                            .pointerEvents
                })
            );


        rightClickDisabledElements.forEach(
            item => {

                item.element.style
                    .pointerEvents =
                        "none";

            }
        );


        rightClickRestoreTimer =
            setTimeout(
                restoreRightClickTargets,
                250
            );

    },
    true
);


document.addEventListener(
    "contextmenu",
    () => {

        setTimeout(
            restoreRightClickTargets,
            0
        );

    },
    true
);


window.addEventListener(
    "blur",
    restoreRightClickTargets
);


    /*
    BLOK DRAG GAMBAR KE TAB/FOLDER
    */

    document.addEventListener(
        "dragstart",
        (event) => {
            const image =
                getEventImage(event);

            if (!image) {
                return;
            }

            event.preventDefault();
        },
        true
    );


    /*
    BLOK MIDDLE-CLICK
    */

    document.addEventListener(
        "auxclick",
        (event) => {
            const image =
                getEventImage(event);

            if (
                !image ||
                event.button !== 1
            ) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
        },
        true
    );


    /*
    BLOK CTRL/CMD/SHIFT + KLIK
    AGAR GAMBAR TIDAK DIBUKA
    DI TAB ATAU WINDOW BARU
    */

    document.addEventListener(
        "click",
        (event) => {
            const image =
                getEventImage(event);

            if (!image) {
                return;
            }

            const modifiedClick =
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey ||
                event.altKey;

            if (modifiedClick) {
                event.preventDefault();
                event.stopPropagation();

                return;
            }


            /*
            Jika gambar dibungkus link yang
            langsung menunjuk ke file gambar,
            cegah navigasi langsung.

            Link logo menuju "/" tetap bekerja
            karena URL link tidak sama dengan
            URL gambarnya.
            */

            if (isDirectImageLink(image)) {
                event.preventDefault();
                event.stopPropagation();
            }
        },
        true
    );
})();