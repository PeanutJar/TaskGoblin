const ExtensionAPI = typeof browser !== "undefined" ? browser : chrome;

//check if current website is on distraction list
function IsDistractionSite(hostname, sites) {
    return sites.some((site) => {
        //using host names so full web url is not always necessary.
        //ex: supports both "youtube.com" and "www.youtube.com", but does not accidentally match "notyoutube.com".
        return hostname === site || hostname.endsWith("." + site);
    });
}


//creating intervention panel
function CreateIntervention(title, message, iscenter, blockpage = false) {
//The new blockpage parameter determines whether or not to create the backdrop. The default is false, 
//so existing calls won't block the page until explicitly enabled
    //remove any previous panel and backdrop.
    RemoveIntervention();

    //create a backdrop when the page should be blocked.
    if (blockpage) {
        DisablePageScrolling();
        const backdrop = document.createElement("div");
        backdrop.id = "taskgoblinbackdrop";

        Object.assign(backdrop.style, {
            position: "fixed",
            inset: "0",
            width: "100vw",
            height: "100vh",
            background: "rgba(0, 0, 0, 0.45)",
            zIndex: "2147483646",
            pointerEvents: "auto"
        });

        document.documentElement.appendChild(backdrop);
    }

    //remove an existing panel if one is already displayed.
    //document.getElementById("taskgoblinintervention")?.remove();

    const panel = document.createElement("div");
    panel.id = "taskgoblinintervention";

    //inline styles keep the first version self-contained.
    if(iscenter) {
        Object.assign(panel.style, {
           position: "fixed",
            top: "50%",
            left: "50%",
            //shift the panel back by half of its own size.
            transform: "translate(-50%, -50%)",
            width: "300px",
            padding: "18px",
            background: "#354D14",
            color: "white",
            border: "3px solid #85BF32",
            borderRadius: "12px",
            boxShadow: "0 4px 15px rgba(0,0,0,0.35)",
            fontFamily: "Arial, sans-serif",
            fontSize: "14px",
            zIndex: "2147483647",
            boxSizing: "border-box"
        }); //I just need to use a large zIndex to ensure that the popup stays at the forefront
    }
    else {
        Object.assign(panel.style, {
            position: "fixed",
            top: "20px",
            right: "20px",
            width: "300px",
            padding: "18px",
            background: "#354D14",
            color: "white",
            border: "3px solid #85BF32",
            borderRadius: "12px",
            boxShadow: "0 4px 15px rgba(0,0,0,0.35)",
            fontFamily: "Arial, sans-serif",
            fontSize: "14px",
            zIndex: "2147483647",
            boxSizing: "border-box"
        }); //I just need to use a large zIndex to ensure that the popup stays at the forefront
    }

    const heading = document.createElement("h2");
    heading.textContent = title;
    heading.style.marginTop = "0";

    const description = document.createElement("p");
    description.textContent = message;

    panel.append(heading, description);
    document.documentElement.appendChild(panel);

    return panel;
}

//remove both the panel and its backdrop.
function RemoveIntervention() {
    document.getElementById("taskgoblinintervention")?.remove();
    const backdrop = document.getElementById("taskgoblinbackdrop");
    if (backdrop) {
        backdrop.remove();
        RestorePageScrolling();
    }
}

//to create a configurable button for any occasion (intended for the panel use)
function CreateButton(text, onClick) {
    const button = document.createElement("button");

    button.textContent = text;
    button.type = "button";

    Object.assign(button.style, {
        margin: "5px 5px 0 0",
        cursor: "pointer",
        borderRadius: "5px",
        border: "1px solid #85BF32",
        
    });

    button.addEventListener("click", onClick);

    return button;
}


//level 1 intensity panel display
function ShowLevel1() {
    const panel = CreateIntervention(
        "Task Goblin Reminder",
        "You marked this website as distracting. Is this visit helping you reach your goals?",
        false
    );

    panel.appendChild(
        CreateButton("Dismiss", () => panel.remove())
    );
}


//level 2 intensity panel display
function ShowLevel2() {
    const panel = CreateIntervention(
        "Pause and Reflect",
        "You marked this website as distracting. Did you intend to visit this website?",
        true,
        true
    );

    panel.append(
        CreateButton("Continue", () => {
            RemoveIntervention();
        }),

        CreateButton("Go Back", () => {
            RemoveIntervention();
            history.back();
        }) //history.back() method is a Web API function that instructs the browser to move back one page in 
        //the user's session history.
    );
}


//level 3 intensity panel display
function ShowLevel3(sitekey) {
    let timer = null;
    let currentphase = "confirm";
    let currentstate = null;
    let forcedinitialconfirmation = false;

    function StopDisplayTimer() {
        if (timer !== null) {
            clearInterval(timer);
            timer = null;
        }
    }

    function FormatTime(seconds) {
        const safeseconds = Math.max(0, seconds);
        const minutes = Math.floor(safeseconds / 60);
        const secs = safeseconds % 60;

        return `${minutes}:${String(secs).padStart(2, "0")}`;
    }

    async function SendTimerMessage(type) {
        try {
            return await ExtensionAPI.runtime.sendMessage({
                type,
                sitekey
            });
        } 
        catch (error) {
            console.error("Task Goblin could not communicate with its background script:", error);
            return null;
        }
    }

    function ShowConfirmation() {
        currentphase = "confirm";

        const panel = CreateIntervention(
            "Forced Break",
            "Do you want to visit this website? If you continue, your shared usage timer will begin.",
            true,
            true
        );

        panel.append(
            CreateButton("Continue", async () => {
                forcedinitialconfirmation = false;
                const response = await SendTimerMessage("LEVEL3_START_USAGE");
                if (response) {
                    RenderState(response);
                }
            }),
            CreateButton("Go Back", () => {
                RemoveIntervention();
                history.back();
            })
        );
    }

    function ShowUsage(state) {
        currentphase = "usage";

        const panel = CreateIntervention(
            "Usage Time",
            "Your usage timer is shared across tabs for this site.",
            false
        );

        const countdown = document.createElement("p");
        countdown.style.fontSize = "28px";
        countdown.style.fontWeight = "bold";
        panel.appendChild(countdown);

        function UpdateCountdown() {
            if (currentphase !== "usage") {
                return;
            }

            let remaining;

            if (typeof state.endsat === "number") {
                remaining = Math.max(0, Math.ceil((state.endsat - Date.now()) / 1000));
            } 
            else {
                //usage is paused because no matching site tab is active.
                remaining = Math.max(0, Number(state.remaining) || 0);
            }
            countdown.textContent = FormatTime(remaining);
        }
        UpdateCountdown();
        timer = setInterval(UpdateCountdown, 250);
    }

    function ShowCooldown(state) {
        currentphase = "cooldown";

        const panel = CreateIntervention(
            "Cooldown in Progress",
            "Your usage period has ended. Please take a short break before returning.",
            true,
            true
        );

        Object.assign(panel.style, {
            top: "0",
            left: "0",
            right: "0",
            bottom: "0",
            width: "100%",
            height: "100%",
            borderRadius: "0",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            padding: "30px"
        });

        const countdown = document.createElement("p");
        countdown.style.fontSize = "32px";
        countdown.style.fontWeight = "bold";
        panel.appendChild(countdown);

        function UpdateCountdown() {
            if (currentphase !== "cooldown") {
                return;
            }

            const remaining = typeof state.endsat === "number"
                ? Math.max(0, Math.ceil((state.endsat - Date.now()) / 1000))
                : 0;

            countdown.textContent = FormatTime(remaining);
            //the background script controls the actual transition - does not start another 
            //cooldown from existing tab (from site with shared host site)
        }

        UpdateCountdown();
        timer = setInterval(UpdateCountdown, 250);
    }

    function ShowAccessRestored() {
        currentphase = "available";

        const panel = CreateIntervention(
            "You're Good to Go!",
            "You can use this website again. Your usage timer has reset.",
            true,
            true
        );

        panel.appendChild(
            CreateButton("Dismiss", async () => {
                const state = await SendTimerMessage("LEVEL3_START_USAGE");
                if (state) {
                    RenderState(state);
                }
            })
        );
    }

    function RenderState(state) {
        StopDisplayTimer();
        RemoveIntervention();

        currentstate = state;

        if (!state) {
            ShowConfirmation();
            return;
        }

        switch (state.phase) {
            case "usage":
                ShowUsage(state);
                break;

            case "cooldown":
                ShowCooldown(state);
                break;

            case "available":
                ShowAccessRestored();
                break;

            default:
                ShowConfirmation();
                break;
        }
    }

    //queue broadcasts until we know whether another matching tab exists.
    let initialloadcomplete = false;
    let pendingstate = null;

    ExtensionAPI.runtime.onMessage.addListener((message) => {
        if (message?.type !== "LEVEL3_STATE" || message.sitekey !== sitekey) {
            return;
        }
        if (!initialloadcomplete) {
            pendingstate = message.state;
            return;
        }
        //keep the initial Forced Break panel visible until the user chooses Continue or Go Back.
        if (forcedinitialconfirmation) {
            return;
        }
        RenderState(message.state);
    });

    SendTimerMessage("LEVEL3_GET_STATE")
        .then((response) => {
            initialloadcomplete = true;
            const state = pendingstate ?? response?.state ?? null;
            const hasothertabs = response?.hasothertabs ?? false;

            if (currentstate !== null) {
                return;
            }
            //check if this is the only tab for this shared host. 
            if (!hasothertabs) {
                //show confirmation regardless of the saved timer state.
                forcedinitialconfirmation = true;
                StopDisplayTimer();
                RemoveIntervention();
                ShowConfirmation();
            } else {
                //another matching tab exists: use the shared state.
                RenderState(state);
            }
        })
        .catch((error) => {
            console.error("Task Goblin could not load the Level 3 timer state:", error);
            initialloadcomplete = true;
            ShowConfirmation();
        });
}

//find matching site(s) with shared hostsite(s) and group them based on host site
function GetDistractionSiteKey(hostname, sites) {
    const matchingsite = sites.find(site => {
        return hostname === site || hostname.endsWith("." + site);
    });

    return matchingsite ? matchingsite.replace(/^www\./, "") : hostname;
}
////////////


//level 4 intensity panel display
function ShowLevel4() {
    const panel = CreateIntervention(
        "Access Restricted",
        "Task Goblin has restricted this website under your current settings.",
        true,
        true
    );

    //cover the page so the user cannot interact with its content.
    Object.assign(panel.style, {
        top: "0",
        left: "0",
        right: "0",
        bottom: "0",
        width: "100%",
        height: "100%",
        borderRadius: "0",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        padding: "30px"
    });

    const message = panel.querySelector("p");
    message.style.maxWidth = "400px";

    panel.appendChild(
        CreateButton("Go Back", () => {
            RemoveIntervention();
            history.back();
        })
    );
}

//////////////////////////////////////
//detection and appropriate response logic
async function CheckCurrentSite() {
    try {
        const result = await ExtensionAPI.storage.local.get("settings");

        const settings = result.settings || {};

        //individual rules are a future feature.
        if ((settings.ruleset || "general") !== "general") {
            return;
        }

        const sites = Array.isArray(settings.distractionsites) ? settings.distractionsites : [];
        //set to array of labeled distraction sites, else, set to an ampty array

        //ignore websites that are not on the list.
        if (!IsDistractionSite(location.hostname, sites)) {
            return;
        }

        //read the saved intensity level.
        const intensity = settings.intensitylevel || "level1";

        switch (intensity) {
            case "level1":
                ShowLevel1();
                break;

            case "level2":
                ShowLevel2();
                break;

            case "level3":
                ShowLevel3(GetDistractionSiteKey(location.hostname, sites));
                break;

            case "level4":
                ShowLevel4();
                break;

            default:
                console.warn("Unknown Task Goblin intensity:", intensity);
        }
    } catch (error) {
        console.error("Task Goblin could not read its settings:", error);
    }
}

//////////////////////////////////////////////////////////
let originaloverflow = null;

function DisablePageScrolling() {
    //save the original setting only once.
    if (originaloverflow === null) {
        originaloverflow = {
            html: document.documentElement.style.overflow,
            body: document.body?.style.overflow ?? ""
        };
    }

    //disable scrolling on the page.
    document.documentElement.style.overflow = "hidden";

    if (document.body) {
        document.body.style.overflow = "hidden";
    }
}

function RestorePageScrolling() {
    //nothing to restore if scrolling was never disabled.
    if (originaloverflow === null) {
        return;
    }

    document.documentElement.style.overflow = originaloverflow.html;

    if (document.body) {
        document.body.style.overflow =
            originaloverflow.body;
    }

    originaloverflow = null;
}

/////////////////////////////////////////////////////////////
//run when the content script loads (if user has extension loaded if already on a distraction site)
CheckCurrentSite();
