(() => {
    "use strict";


    /*
    Preview dinonaktifkan khusus
    halaman pengerjaan Quiz.
    */

    const isQuizPreviewExcluded =
        /\/(?:admin-quiz-editor|student-quiz-attempt|student-quiz-result)(?:\.html)?\/?$/i
            .test(
                window.location.pathname
            );


if (isQuizPreviewExcluded) {
    return;
}


/*
Menandai bahwa halaman ini mendukung
preview gambar.
*/

document.documentElement.classList.add(
    "media-viewer-enabled"
);


const clamp = (
        value,
        minimum,
        maximum
    ) => {
        return Math.min(
            Math.max(
                value,
                minimum
            ),
            maximum
        );
    };


    const overlay =
        document.createElement("div");


    overlay.className =
        "media-viewer-overlay";

    overlay.hidden = true;

    overlay.setAttribute(
        "role",
        "dialog"
    );

    overlay.setAttribute(
        "aria-modal",
        "true"
    );

    overlay.setAttribute(
        "aria-label",
        "Preview gambar"
    );


    overlay.innerHTML = `
        <div class="media-viewer-toolbar">

            <div class="media-viewer-zoom-controls">

                <button
                    type="button"
                    class="media-viewer-tool"
                    data-viewer-action="zoom-out"
                    title="Perkecil"
                    aria-label="Perkecil gambar"
                >
                    <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            d="M5 11h14v2H5z"
                        ></path>
                    </svg>
                </button>


                <button
                    type="button"
                    class="media-viewer-scale"
                    data-viewer-action="reset"
                    title="Reset zoom"
                    aria-label="Reset zoom"
                >
                    100%
                </button>


                <button
                    type="button"
                    class="media-viewer-tool"
                    data-viewer-action="zoom-in"
                    title="Perbesar"
                    aria-label="Perbesar gambar"
                >
                    <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"
                        ></path>
                    </svg>
                </button>

            </div>


            <div class="media-viewer-main-actions">

                <button
                    type="button"
                    class="
                        media-viewer-tool
                        media-viewer-download
                    "
                    data-viewer-action="download"
                    title="Download gambar"
                    aria-label="Download gambar"
                >
                    <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            d="M12 3a1 1 0 0 1 1 1v9.59l3.3-3.3a1 1 0 1 1 1.4 1.42l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 1 1 1.4-1.42l3.3 3.3V4a1 1 0 0 1 1-1ZM5 19a1 1 0 0 1 1 1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1Z"
                        ></path>
                    </svg>
                </button>


                <button
                    type="button"
                    class="
                        media-viewer-tool
                        media-viewer-close
                    "
                    data-viewer-action="close"
                    title="Tutup"
                    aria-label="Tutup preview"
                >
                    <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            d="M6.7 5.3a1 1 0 0 0-1.4 1.4l5.3 5.3-5.3 5.3a1 1 0 1 0 1.4 1.4l5.3-5.3 5.3 5.3a1 1 0 0 0 1.4-1.4L13.4 12l5.3-5.3a1 1 0 1 0-1.4-1.4L12 10.6 6.7 5.3Z"
                        ></path>
                    </svg>
                </button>

            </div>

        </div>


        <div class="media-viewer-stage">

            <div
                class="media-viewer-loading"
                role="status"
                aria-label="Memuat gambar"
            ></div>


            <img
                class="media-viewer-image"
                alt=""
            >


            <p
                class="media-viewer-error"
                hidden
            >
                Gambar tidak dapat dimuat.
            </p>

        </div>
    `;


    document.body.appendChild(
        overlay
    );


    const stage =
        overlay.querySelector(
            ".media-viewer-stage"
        );

    const viewerImage =
        overlay.querySelector(
            ".media-viewer-image"
        );

    const loading =
        overlay.querySelector(
            ".media-viewer-loading"
        );

    const errorMessage =
        overlay.querySelector(
            ".media-viewer-error"
        );

    const scaleButton =
        overlay.querySelector(
            ".media-viewer-scale"
        );

const closeButton =
    overlay.querySelector(
        '[data-viewer-action="close"]'
    );


const downloadButton =
    overlay.querySelector(
        '[data-viewer-action="download"]'
    );


const state = {
    source: "",
    scale: 1,
    x: 0,
    y: 0,

    isDownloading:
        false,

    previousOverflow: "",
    opener: null,

    pointers:
        new Map(),

    dragStart:
        null,

    pinchStart:
        null
};


/*
Mengambil ukuran area viewer setelah
padding desktop/mobile dikurangi.
*/

function getViewerAvailableSize() {

    const stageStyle =
        window.getComputedStyle(
            stage
        );


    const horizontalPadding =
        (
            Number.parseFloat(
                stageStyle.paddingLeft
            ) || 0
        ) +
        (
            Number.parseFloat(
                stageStyle.paddingRight
            ) || 0
        );


    const verticalPadding =
        (
            Number.parseFloat(
                stageStyle.paddingTop
            ) || 0
        ) +
        (
            Number.parseFloat(
                stageStyle.paddingBottom
            ) || 0
        );


    return {
        width:
            Math.max(
                stage.clientWidth -
                horizontalPadding,
                0
            ),

        height:
            Math.max(
                stage.clientHeight -
                verticalPadding,
                0
            )
    };

}


/*
Menghitung batas maksimal pan.

Jika ukuran gambar setelah diperbesar
masih lebih kecil dari viewer, gambar
tetap berada di tengah dan tidak dapat
digeser.

Jika lebih besar, pergeseran berhenti
tepat ketika tepi gambar bertemu tepi
area viewer.
*/

function getPanBounds() {

    const availableSize =
        getViewerAvailableSize();


    const scaledWidth =
        viewerImage.offsetWidth *
        state.scale;


    const scaledHeight =
        viewerImage.offsetHeight *
        state.scale;


    /*
    Minimal bagian gambar yang harus
    tetap terlihat di dalam viewer.

    Gambar kecil mempertahankan seluruh
    dimensinya jika ukurannya di bawah
    batas ini.
    */

    const minimumVisibleWidth =
        Math.min(
            96,
            scaledWidth
        );


    const minimumVisibleHeight =
        Math.min(
            72,
            scaledHeight
        );


    /*
    Gambar boleh digeser mendekati luar
    halaman, tetapi tidak boleh keluar
    sepenuhnya.

    Minimal 96px horizontal dan 72px
    vertikal tetap terlihat.
    */

    return {
        maximumX:
            Math.max(
                (
                    availableSize.width +
                    scaledWidth
                ) / 2 -
                minimumVisibleWidth,
                0
            ),

        maximumY:
            Math.max(
                (
                    availableSize.height +
                    scaledHeight
                ) / 2 -
                minimumVisibleHeight,
                0
            )
    };

}


function clampPanPosition() {

    if (
        state.scale <= 1 ||
        viewerImage.offsetWidth === 0 ||
        viewerImage.offsetHeight === 0
    ) {

        state.x = 0;
        state.y = 0;

        return;
    }


    const {
        maximumX,
        maximumY
    } = getPanBounds();


    state.x =
        clamp(
            state.x,
            -maximumX,
            maximumX
        );


    state.y =
        clamp(
            state.y,
            -maximumY,
            maximumY
        );

}


function applyTransform() {

    /*
    Posisi dibatasi setiap zoom, drag,
    pinch, dan resize.
    */

    clampPanPosition();


    viewerImage.style.transform = `
        translate3d(
            ${state.x}px,
            ${state.y}px,
            0
        )
        scale(${state.scale})
    `;


    scaleButton.textContent =
        `${Math.round(
            state.scale * 100
        )}%`;


    stage.classList.toggle(
        "is-zoomed",
        state.scale > 1.001
    );

}


    function setScale(nextScale) {

        state.scale =
            clamp(
                nextScale,
                1,
                6
            );


        if (state.scale === 1) {

            state.x = 0;
            state.y = 0;

        }


        applyTransform();

    }


    function resetTransform() {

        state.scale = 1;
        state.x = 0;
        state.y = 0;

        applyTransform();

    }


    function isPreviewableImage(target) {

        if (
            !(
                target instanceof
                HTMLImageElement
            )
        ) {
            return false;
        }


        /*
        Logo LMS tetap berfungsi sebagai
        navigasi dan tidak membuka preview.
        */

        if (
            target.classList.contains(
                "lms-brand-icon"
            )
        ) {
            return false;
        }


        /*
        Bisa dipakai untuk gambar yang
        tidak boleh membuka viewer.
        */

        if (
            target.closest(
                '[data-image-preview="off"]'
            )
        ) {
            return false;
        }


        if (
            target.closest(
                ".media-viewer-overlay"
            )
        ) {
            return false;
        }


        return Boolean(
            target.currentSrc ||
            target.src
        );

    }


    function openViewer(target) {

        state.source =
            target.currentSrc ||
            target.src;

        state.opener =
            target;

        state.previousOverflow =
            document.body.style.overflow;


        resetTransform();


        errorMessage.hidden =
            true;

        loading.hidden =
            false;

        viewerImage.hidden =
            true;

        viewerImage.alt =
            target.alt ||
            "Preview gambar";


        overlay.hidden =
            false;


        document.body.classList.add(
            "media-viewer-open"
        );

        document.body.style.overflow =
            "hidden";


        viewerImage.src =
            state.source;


        closeButton.focus({
            preventScroll:
                true
        });

    }


    function closeViewer() {

        if (overlay.hidden) {
            return;
        }


        overlay.hidden =
            true;


        document.body.classList.remove(
            "media-viewer-open"
        );


        document.body.style.overflow =
            state.previousOverflow;


        viewerImage.removeAttribute(
            "src"
        );


        state.pointers.clear();

        state.dragStart =
            null;

        state.pinchStart =
            null;


        if (
            state.opener &&
            typeof state.opener.focus ===
                "function"
        ) {

            state.opener.focus({
                preventScroll:
                    true
            });

        }

    }


function getResponseFileName(
    response
) {

    const disposition =
        response.headers.get(
            "content-disposition"
        ) || "";


    const match =
        disposition.match(
            /filename="([^"]+)"/i
        );


    return match?.[1] ||
        "gambar.jpg";

}


function getLocalJpegFileName(
    sourceUrl
) {

    let name =
        "gambar";


    try {

        const originalName =
            decodeURIComponent(
                sourceUrl.pathname
                    .split("/")
                    .pop() ||
                "gambar"
            );


        name =
            originalName
                .replace(
                    /\.[^.]+$/,
                    ""
                )
                .replace(
                    /[^a-zA-Z0-9_-]/g,
                    "-"
                )
                .replace(
                    /-+/g,
                    "-"
                )
                .slice(
                    0,
                    90
                ) ||
            "gambar";

    } catch {

        name =
            "gambar";

    }


    return `${name}.jpg`;

}


/*
Konversi gambar lokal/blob/data URL
menjadi JPEG langsung di browser.

Gambar URL luar tetap dikonversi server
karena biasanya dibatasi CORS.
*/

async function convertLocalBlobToJpeg(
    sourceBlob
) {

    const bitmap =
        await createImageBitmap(
            sourceBlob
        );


    const canvas =
        document.createElement(
            "canvas"
        );


    canvas.width =
        bitmap.width;

    canvas.height =
        bitmap.height;


    const context =
        canvas.getContext(
            "2d",
            {
                alpha:
                    false
            }
        );


    if (!context) {

        bitmap.close();


        throw new Error(
            "Konversi gambar tidak didukung."
        );

    }


    context.fillStyle =
        "#ffffff";

    context.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    context.drawImage(
        bitmap,
        0,
        0
    );


    bitmap.close();


    const jpegBlob =
        await new Promise(
            (
                resolve,
                reject
            ) => {

                canvas.toBlob(
                    blob => {

                        if (!blob) {

                            reject(
                                new Error(
                                    "Konversi JPG gagal."
                                )
                            );

                            return;

                        }


                        resolve(blob);

                    },
                    "image/jpeg",
                    0.9
                );

            }
        );


    canvas.width = 1;
    canvas.height = 1;


    return jpegBlob;

}


async function triggerDownload() {

    if (
        !state.source ||
        state.isDownloading
    ) {
        return;
    }


    let sourceUrl;


    try {

        sourceUrl =
            new URL(
                state.source,
                window.location.href
            );

    } catch {

        return;

    }


    state.isDownloading =
        true;


    downloadButton.disabled =
        true;


    downloadButton.classList.add(
        "is-loading"
    );


    downloadButton.setAttribute(
        "aria-busy",
        "true"
    );


    downloadButton.setAttribute(
        "aria-label",
        "Menyiapkan gambar"
    );


    try {

        let downloadBlob;
        let fileName;


        const isExternalHttpImage =
            (
                sourceUrl.protocol ===
                    "http:" ||

                sourceUrl.protocol ===
                    "https:"
            ) &&

            sourceUrl.origin !==
                window.location.origin;


        if (isExternalHttpImage) {

            /*
            Server mengambil dan
            mengonversi gambar luar.
            */

            const response =
                await fetch(
                    "/api/media/download" +
                    `?url=${encodeURIComponent(
                        sourceUrl.href
                    )}`,
                    {
                        method:
                            "GET",

                        credentials:
                            "same-origin"
                    }
                );


            if (!response.ok) {

                let errorMessage =
                    "Gambar gagal disiapkan.";


                try {

                    const errorData =
                        await response.json();


                    errorMessage =
                        errorData.message ||
                        errorMessage;

                } catch {
                    // Respons bukan JSON.
                }


                throw new Error(
                    errorMessage
                );

            }


            downloadBlob =
                await response.blob();


            fileName =
                getResponseFileName(
                    response
                );

        } else {

            /*
            File lokal/blob/data diambil
            kemudian dikonversi ke JPEG
            langsung di browser.
            */

            const response =
                await fetch(
                    sourceUrl.href
                );


            if (!response.ok) {

                throw new Error(
                    "Gambar gagal disiapkan."
                );

            }


            const sourceBlob =
                await response.blob();


            downloadBlob =
                await convertLocalBlobToJpeg(
                    sourceBlob
                );


            fileName =
                getLocalJpegFileName(
                    sourceUrl
                );

        }


        const objectUrl =
            URL.createObjectURL(
                downloadBlob
            );


        const downloadLink =
            document.createElement("a");


        downloadLink.hidden =
            true;

        downloadLink.href =
            objectUrl;

        downloadLink.download =
            fileName;


        document.body.appendChild(
            downloadLink
        );


        downloadLink.click();
        downloadLink.remove();


        setTimeout(
            () => {

                URL.revokeObjectURL(
                    objectUrl
                );

            },
            1000
        );

    } catch (error) {

        console.error(
            "Download gambar gagal:",
            error
        );


        downloadButton.classList.add(
            "is-error"
        );


        downloadButton.title =
            error.message ||
            "Download gambar gagal";


        setTimeout(
            () => {

                downloadButton.classList.remove(
                    "is-error"
                );


                downloadButton.title =
                    "Download gambar";

            },
            2500
        );

    } finally {

        state.isDownloading =
            false;


        downloadButton.disabled =
            false;


        downloadButton.classList.remove(
            "is-loading"
        );


        downloadButton.removeAttribute(
            "aria-busy"
        );


        downloadButton.setAttribute(
            "aria-label",
            "Download gambar"
        );

    }

}


    viewerImage.addEventListener(
        "load",
        () => {

            loading.hidden =
                true;

            viewerImage.hidden =
                false;

            errorMessage.hidden =
                true;

        }
    );


viewerImage.addEventListener(
    "error",
    () => {

        loading.hidden =
            true;

        viewerImage.hidden =
            true;

        errorMessage.hidden =
            false;

    }
);


/*
Feedback saat gambar pada halaman
ditekan menggunakan mouse atau sentuhan.
*/

let pressedPreviewImage =
    null;


function clearPressedPreviewImage() {

    if (!pressedPreviewImage) {
        return;
    }


    pressedPreviewImage.classList.remove(
        "image-preview-pressed"
    );


    pressedPreviewImage =
        null;

}


document.addEventListener(
    "pointerdown",
    event => {

        if (
            !overlay.hidden ||
            event.button !== 0 ||
            !isPreviewableImage(
                event.target
            )
        ) {
            return;
        }


        clearPressedPreviewImage();


        pressedPreviewImage =
            event.target;


        pressedPreviewImage.classList.add(
            "image-preview-pressed"
        );

    },
    true
);


document.addEventListener(
    "pointerup",
    clearPressedPreviewImage,
    true
);


document.addEventListener(
    "pointercancel",
    clearPressedPreviewImage,
    true
);


window.addEventListener(
    "blur",
    clearPressedPreviewImage
);


document.addEventListener(
    "click",
        event => {

            if (overlay.hidden) {

                const target =
                    event.target;


                if (
                    !isPreviewableImage(
                        target
                    ) ||

                    event.button !== 0
                ) {
                    return;
                }


                event.preventDefault();

                openViewer(
                    target
                );

                return;

            }


            const actionButton =
                event.target.closest(
                    "[data-viewer-action]"
                );


            if (actionButton) {

                const action =
                    actionButton.dataset
                        .viewerAction;


                if (
                    action ===
                    "close"
                ) {
                    closeViewer();
                }


                if (
                    action ===
                    "zoom-in"
                ) {
                    setScale(
                        state.scale +
                        0.25
                    );
                }


                if (
                    action ===
                    "zoom-out"
                ) {
                    setScale(
                        state.scale -
                        0.25
                    );
                }


                if (
                    action ===
                    "reset"
                ) {
                    resetTransform();
                }


                if (
                    action ===
                    "download"
                ) {
                    triggerDownload();
                }


                return;

            }


            if (
                event.target ===
                    overlay ||

                event.target ===
                    stage
            ) {
                closeViewer();
            }

        }
    );


    document.addEventListener(
        "keydown",
        event => {

            if (overlay.hidden) {
                return;
            }


            if (
                event.key ===
                "Escape"
            ) {
                closeViewer();
            }


            if (
                event.key === "+" ||
                event.key === "="
            ) {
                setScale(
                    state.scale +
                    0.25
                );
            }


            if (
                event.key === "-"
            ) {
                setScale(
                    state.scale -
                    0.25
                );
            }


            if (
                event.key === "0"
            ) {
                resetTransform();
            }

        }
    );


    stage.addEventListener(
        "wheel",
        event => {

            event.preventDefault();


            setScale(
                state.scale *
                Math.exp(
                    -event.deltaY *
                    0.0015
                )
            );

        },
        {
            passive:
                false
        }
    );


    viewerImage.addEventListener(
        "pointerdown",
        event => {

viewerImage.setPointerCapture(
    event.pointerId
);


stage.classList.add(
    "is-panning"
);


state.pointers.set(
                event.pointerId,
                {
                    x:
                        event.clientX,

                    y:
                        event.clientY
                }
            );


            if (
                state.pointers.size === 1
            ) {

                state.dragStart = {
                    pointerX:
                        event.clientX,

                    pointerY:
                        event.clientY,

                    x:
                        state.x,

                    y:
                        state.y
                };

            } else if (
                state.pointers.size === 2
            ) {

                const points = [
                    ...state.pointers
                        .values()
                ];


                state.pinchStart = {
                    distance:
                        Math.hypot(
                            points[1].x -
                            points[0].x,

                            points[1].y -
                            points[0].y
                        ),

                    midpointX:
                        (
                            points[0].x +
                            points[1].x
                        ) / 2,

                    midpointY:
                        (
                            points[0].y +
                            points[1].y
                        ) / 2,

                    scale:
                        state.scale,

                    x:
                        state.x,

                    y:
                        state.y
                };

            }

        }
    );


    viewerImage.addEventListener(
        "pointermove",
        event => {

            if (
                !state.pointers.has(
                    event.pointerId
                )
            ) {
                return;
            }


            state.pointers.set(
                event.pointerId,
                {
                    x:
                        event.clientX,

                    y:
                        event.clientY
                }
            );


            if (
                state.pointers.size === 2 &&
                state.pinchStart
            ) {

                const points = [
                    ...state.pointers
                        .values()
                ];


                const distance =
                    Math.hypot(
                        points[1].x -
                        points[0].x,

                        points[1].y -
                        points[0].y
                    );


                const midpointX =
                    (
                        points[0].x +
                        points[1].x
                    ) / 2;


                const midpointY =
                    (
                        points[0].y +
                        points[1].y
                    ) / 2;


                state.scale =
                    clamp(
                        state.pinchStart
                            .scale *
                        (
                            distance /
                            Math.max(
                                state.pinchStart
                                    .distance,
                                1
                            )
                        ),
                        1,
                        6
                    );


                state.x =
                    state.scale === 1
                        ? 0
                        : (
                            state.pinchStart
                                .x +
                            midpointX -
                            state.pinchStart
                                .midpointX
                        );


                state.y =
                    state.scale === 1
                        ? 0
                        : (
                            state.pinchStart
                                .y +
                            midpointY -
                            state.pinchStart
                                .midpointY
                        );


                applyTransform();

            } else if (
                state.pointers.size === 1 &&
                state.dragStart &&
                state.scale > 1
            ) {

                state.x =
                    state.dragStart.x +
                    event.clientX -
                    state.dragStart
                        .pointerX;


                state.y =
                    state.dragStart.y +
                    event.clientY -
                    state.dragStart
                        .pointerY;


                applyTransform();

            }

        }
    );


    function releasePointer(event) {

        state.pointers.delete(
            event.pointerId
        );


        state.dragStart =
            null;

state.pinchStart =
    null;


if (
    state.pointers.size === 0
) {

    stage.classList.remove(
        "is-panning"
    );

}


if (
    state.pointers.size === 1
) {

            const [point] = [
                ...state.pointers
                    .values()
            ];


            state.dragStart = {
                pointerX:
                    point.x,

                pointerY:
                    point.y,

                x:
                    state.x,

                y:
                    state.y
            };

        }

    }


    viewerImage.addEventListener(
        "pointerup",
        releasePointer
    );


viewerImage.addEventListener(
    "pointercancel",
    releasePointer
);


/*
Tablet rotation, resize desktop,
dan perubahan ukuran browser.
*/

window.addEventListener(
    "resize",
    () => {

        if (overlay.hidden) {
            return;
        }


        applyTransform();

    }
);

})();