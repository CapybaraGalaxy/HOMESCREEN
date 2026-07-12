let isUpdating = false;
(() => {

    if (!("serviceWorker" in navigator))
        return;

    let newWorker = null;

async function showUpdateBanner() {

    if (document.getElementById("updateBanner"))
        return;


    let info = {
        version:"",
        changes:[]
    };


    try {

        const response = await fetch("./version.json");

        info = await response.json();

    } catch(e){}



    const banner = document.createElement("div");

    banner.id = "updateBanner";


    banner.innerHTML = `

        <div class="update-title">
            🚀 HOMESCREEN ${info.version || ""}
        </div>


        <div class="update-text">

            Nueva versión disponible

            ${
                info.changes?.length
                ?
                "<br><br>" +
                info.changes.map(
                    c=>"✓ "+c
                ).join("<br>")
                :
                ""
            }

        </div>


        <button id="updateNow">
            Actualizar
        </button>

    `;


    document.body.appendChild(banner);


    requestAnimationFrame(()=>{

        banner.classList.add("show");

    });


    document
    .getElementById("updateNow")
    .onclick=()=>{

        if(newWorker)
            newWorker.postMessage("SKIP_WAITING");

    };

}

    navigator.serviceWorker.register("./service-worker.js")
        .then(registration => {

            if (registration.waiting) {

                newWorker = registration.waiting;

                showUpdateBanner();

            }

            registration.addEventListener("updatefound", () => {

                const installing = registration.installing;

                installing.addEventListener("statechange", () => {

                    if (
                        installing.state === "installed" &&
                        navigator.serviceWorker.controller
                    ) {

                        newWorker = installing;

                        showUpdateBanner();

                    }

                });

            });

        });

navigator.serviceWorker.addEventListener(
    "controllerchange",
    () => {

        if (isUpdating) {

            window.location.reload();

        }

    }
);

})();