const ExtensionAPI = typeof browser !== "undefined" ? browser : chrome;

//keep these values synchronized with contentscript.js.
const USAGE_TIME = 0.5 * 60;
const COOLDOWN_TIME = 0.3 * 60;

const STORAGE_PREFIX = "taskgoblin_level3_";
const ALARM_PREFIX = "taskgoblin_timer_";

//find the distraction-site key for a hostname.
function GetSiteKey(hostname, sites) {
    const host = hostname.toLowerCase();

    const matchingsite = sites.find((site) => {
        const normalizedsite = site.toLowerCase().replace(/^www\./, "");

        return (
            host === normalizedsite ||
            host === "www." + normalizedsite ||
            host.endsWith("." + normalizedsite)
        );
    });
    return matchingsite ? matchingsite.toLowerCase().replace(/^www\./, "") : null;
}

//find the site currently displayed in the active browser tab.
async function GetActiveSiteKey() {
    try {
        const lastwindow = await ExtensionAPI.windows.getLastFocused();

        //no active browser window means usage should be paused.
        if (!lastwindow || lastwindow.focused === false) {
            return null;
        }

        const tabs = await ExtensionAPI.tabs.query({
            active: true,
            lastFocusedWindow: true
        });

        const activetab = tabs[0];

        if(!activetab?.url) {
            return null;
        }

        const result = await ExtensionAPI.storage.local.get("settings");
        const settings = result.settings || {};
        const sites = Array.isArray(settings.distractionsites) ? settings.distractionsites : [];

        return GetSiteKey(new URL(activetab.url).hostname, sites);
    } 
    catch (error) {
        console.error("Task Goblin could not identify the active site:", error);
        return null;
    }
}

function GetStorageKey(sitekey) {
    return STORAGE_PREFIX + sitekey;
}

function GetAlarmName(sitekey) {
    return ALARM_PREFIX + sitekey;
}

async function GetSiteState(sitekey) {
    const key = GetStorageKey(sitekey);
    const result = await ExtensionAPI.storage.local.get(key);

    return result[key] ?? null;
}

//send the same state to all tabs. Each content script filters by sitekey.
async function BroadcastState(sitekey, state) {
    try {
        const tabs = await ExtensionAPI.tabs.query({});
        await Promise.all(
            tabs.map(async (tab) => {
                if (tab.id === undefined) {
                    return;
                }
                try {
                    await ExtensionAPI.tabs.sendMessage(tab.id, {
                        type: "LEVEL3_STATE",
                        sitekey,
                        state
                    });
                } 
                catch {
                    //Ignore tabs without a Task Goblin content script
                }
            })
        );
    } 
    catch (error) {
        console.error("Task Goblin could not broadcast timer state:", error);
    }
}

//save the shared state and schedule its expiration alarm if needed.
async function SaveSiteState(sitekey, state) {
    await ExtensionAPI.storage.local.set({
        [GetStorageKey(sitekey)]: state
    });

    const alarmName = GetAlarmName(sitekey);

    if ((state.phase === "usage" || state.phase === "cooldown") && typeof state.endsat === "number") {
        ExtensionAPI.alarms.create(alarmName, {
            when: Math.max(Date.now() + 100, state.endsat)
        });
    } 
    else {
        await ExtensionAPI.alarms.clear(alarmName);
    }

    await BroadcastState(sitekey, state);
}

async function StartSharedCooldown(sitekey) {
    const now = Date.now();
    const state = {
        phase: "cooldown",
        remaining: COOLDOWN_TIME,
        pausedat: null,
        endsat: now + COOLDOWN_TIME * 1000
    };

    await SaveSiteState(sitekey, state);
}

async function RestoreSharedAccess(sitekey) {
    const state = {
        phase: "available",
        remaining: USAGE_TIME,
        pausedat: null,
        endsat: null
    };

    await SaveSiteState(sitekey, state);
}

//reconcile saved sessions with the currently active site.
//usage runs only when its matching site is active.
//cooldown, once started, continues even if the site is left.
async function SyncActiveSite() {
    const activesitekey = await GetActiveSiteKey();
    const alldata = await ExtensionAPI.storage.local.get(null);
    const now = Date.now();

    for (const [key, savedState] of Object.entries(alldata)) {
        if (!key.startsWith(STORAGE_PREFIX) || !savedState) {
            continue;
        }

        const sitekey = key.slice(STORAGE_PREFIX.length);
        const state = savedState;

        if (state.phase === "cooldown") {
            if (typeof state.endsat !== "number" || state.endsat <= now) {
                await RestoreSharedAccess(sitekey);
            }
            continue;
        }

        if (state.phase !== "usage") {
            continue;
        }

        //A running usage timer reached zero.
        if (typeof state.endsat === "number" && state.endsat <= now) {
            await StartSharedCooldown(sitekey);
            continue;
        }

        //the site is no longer active: pause its usage timer.
        if (typeof state.endsat === "number" && sitekey !== activesitekey) {
            const remaining = Math.max(
                0,
                Math.ceil((state.endsat - now) / 1000)
            );

            await SaveSiteState(sitekey, {
                phase: "usage",
                remaining,
                pausedat: now,
                endsat: null
            });
            continue;
        }

        //the site has become active again: resume its shared timer.
        if (state.endsat === null && sitekey === activesitekey) {
            const awaytime = state.pausedat === null ? 0 : (now - state.pausedat) / 1000;

            //preserve Task Goblin's existing away-time reset behavior.
            if (awaytime >= COOLDOWN_TIME) {
                await RestoreSharedAccess(sitekey);
                continue;
            }
            const remaining = Math.max(
                0,
                Number(state.remaining) || 0
            );
            if (remaining <= 0) {
                await StartSharedCooldown(sitekey);
                continue;
            }
            await SaveSiteState(sitekey, {
                phase: "usage",
                remaining,
                pausedat: null,
                endsat: now + remaining * 1000
            });
        }
    }
}

//handle requests from contentscript.js.
async function HandleMessage(message) {
    if (!message?.sitekey) {
        return null;
    }
    const sitekey = message.sitekey;

    if (message.type === "LEVEL3_GET_STATE") {
        await SyncActiveSite();
        return await GetSiteState(sitekey);
    }

    if (message.type === "LEVEL3_START_USAGE") {
        await SyncActiveSite();

        const existingstate = await GetSiteState(sitekey);

        //never allow a stale button to bypass an active cooldown.
        if (existingstate?.phase === "cooldown") {
            return existingstate;
        }

        // Another tab may already have started the usage period.
        if (existingstate?.phase === "usage" && ( existingstate.endsat !== null || existingstate.pausedat !== null)) {
            return existingstate;
        }
        const activesitekey = await GetActiveSiteKey();
        const now = Date.now();

        const state = {
            phase: "usage",
            remaining: USAGE_TIME,
            pausedat: activesitekey === sitekey ? null : now,
            endsat: activesitekey === sitekey ? now + USAGE_TIME * 1000 : null
        };
        await SaveSiteState(sitekey, state);
        return state;
    }
    return null;
}

ExtensionAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message?.type !== "LEVEL3_GET_STATE" && message?.type !== "LEVEL3_START_USAGE") {
            return;
        }

        HandleMessage(message)
            .then(sendResponse)
            .catch((error) => {
                console.error("Task Goblin timer error:", error);
                sendResponse(null);
            });

        //required for asynchronous sendResponse in Chrome.
        return true;
    }
);

//reconcile timers whenever the active tab or browser window changes.
ExtensionAPI.tabs.onActivated.addListener(() => {
    void SyncActiveSite();
});

ExtensionAPI.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.status === "complete" || changeInfo.url) {
        void SyncActiveSite();
    }
});

ExtensionAPI.windows.onFocusChanged.addListener(() => {
    void SyncActiveSite();
});

//alarms allow expiration to be handled even if the service worker is suspended between events.
ExtensionAPI.alarms.onAlarm.addListener(async (alarm) => {
    if (!alarm.name.startsWith(ALARM_PREFIX)) {
        return;
    }
    const sitekey = alarm.name.slice(ALARM_PREFIX.length);
    await SyncActiveSite();

    const state = await GetSiteState(sitekey);
    if (!state) {
        return;
    }
    const now = Date.now();

    if (state.phase === "usage" && typeof state.endsat === "number" && state.endsat <= now) {
        await StartSharedCooldown(sitekey);
    } 
    else if (state.phase === "cooldown" && typeof state.endsat === "number" && state.endsat <= now) {
        await RestoreSharedAccess(sitekey);
    }
});