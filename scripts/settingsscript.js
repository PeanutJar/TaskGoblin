const ExtensionAPI = typeof browser !== "undefined" ? browser : chrome;
//ExtensionAPI is set to type of current browser API (if available), else, use chrome API

const GeneralRules = document.getElementById("generalrules");
//**NOTE** TEMPORARILY DISBALED INDIVIDUAL RULESET
//const IndividualRules = document.getElementById("individualrules");

const GeneralIntensitySection = document.getElementById("generalintensitysection");

const SiteInput = document.getElementById("sitetextinput");
const AddSiteButton = document.getElementById("addsite");
const SiteDisplay = document.getElementById("sitedisplay");

const SaveSettingsButton = document.getElementById("savesettingsbuttons");

const SettingsStatus = document.getElementById("settingsstatus");

//store the websites in memory while editing
let DistractionSites = [];

///////////////////////////////////////////////////////////
//LOAD SETTINGS
///////////////////////////////////////////////////////////
LoadSettings();

async function LoadSettings() {

    //retrieve saved settings
    const result = await ExtensionAPI.storage.local.get("settings");

    //use defaults if no settings have been saved
    const settings = result.settings || {};

    const ruleset = settings.ruleset || "general";
    const intensitylevel = settings.intensitylevel || "level1";

    DistractionSites = Array.isArray(settings.distractionsites) ? settings.distractionsites : [];

    //select the saved ruleset
    GeneralRules.checked = ruleset === "general";
    //**NOTE** TEMPORARILY DISBALED INDIVIDUAL RULESET
    //IndividualRules.checked = ruleset === "individual";

    //select the saved general intensity
    const intensityinput = document.querySelector(`input[name="intensitylevel"][value="${intensitylevel}"]`);

    if(intensityinput) {
        intensityinput.checked = true;
    }

    //show or hide the general intensity controls
    UpdateRulesetDisplay();

    //display saved websites
    DisplaySites();
}

///////////////////////////////////////////////////////////
//RULESET DISPLAY
///////////////////////////////////////////////////////////
GeneralRules.addEventListener("change", UpdateRulesetDisplay);
//**NOTE** TEMPORARILY DISBALED INDIVIDUAL RULESET
//IndividualRules.addEventListener("change", UpdateRulesetDisplay);

function UpdateRulesetDisplay() {

    //the general intensity controls only apply when General Ruleset is selected.
    GeneralIntensitySection.hidden = !GeneralRules.checked;

    //**NOTE** TEMPORARILY DISBALED INDIVIDUAL RULESET
    /*
    //temp
    if(IndividualRules.checked) {
        SettingsStatus.textContent = "Individual Ruleset is not implemented yet. Your sites can still be managed.";
    }
    else {
        SettingsStatus.textContent = "";
    }
    */
}

///////////////////////////////////////////////////////////
//ADD DISTRACTION SITE
///////////////////////////////////////////////////////////
AddSiteButton.addEventListener("click", AddSite);

//also allow 'Enter' key to add a site cuz why not
SiteInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        AddSite();
    }
});

function AddSite() {
    let site = SiteInput.value.trim().toLowerCase();

    if (site === "") {
        return;
    }

    //accept domains such as reddit.com or full URLs such as https://reddit.com/r/example
    try {
        const parsedURL = new URL(
            site.includes("://") ? site : `https://${site}`
        );

        if(!["http:", "https:"].includes(parsedURL.protocol)) {
            SettingsStatus.textContent = "Please enter a valid HTTP or HTTPS website.";
            return;
        }
        //store only the hostname, not the path
        site = parsedURL.hostname;
    }
    catch {
        SettingsStatus.textContent = "Please enter a valid website address.";
        return;
    }

    //avoid duplicate domains
    if(DistractionSites.includes(site)) {
        SettingsStatus.textContent = "That website is already on your list.";
        return;
    }

    DistractionSites.push(site);

    SiteInput.value = "";
    SettingsStatus.textContent = "Website added. Save your settings to keep the change.";

    DisplaySites();
}

///////////////////////////////////////////////////////////
//DISPLAY DISTRACTION SITES
///////////////////////////////////////////////////////////
let collapsesites = document.getElementsByClassName("collapsible");
let i;

for (i = 0; i < collapsesites.length; i++) {
  collapsesites[i].addEventListener("click", function() {
    this.classList.toggle("active");
    var content = this.nextElementSibling;
    if(content.style.display === "block") {
      content.style.display = "none";
    } 
    else {
      content.style.display = "block";
    }
  });
}

function DisplaySites() {
    SiteDisplay.innerHTML = "";

    DistractionSites.forEach((site, index) => {

        const siteitem = document.createElement("li");

        const sitename = document.createElement("span");
        sitename.textContent = site;

        const removebutton = document.createElement("button"); //need to later replace with an "X" or trash symbol
        removebutton.textContent = "Remove";
        removebutton.type = "button";

        removebutton.addEventListener("click", () => {
            DistractionSites.splice(index, 1);
            DisplaySites();
            SettingsStatus.textContent = "Website removed. Save your settings to keep the change.";
        });

        siteitem.appendChild(sitename);
        siteitem.appendChild(removebutton);
        SiteDisplay.appendChild(siteitem);

    });
}

///////////////////////////////////////////////////////////
//SAVE SETTINGS
///////////////////////////////////////////////////////////
SaveSettingsButton.addEventListener("click", SaveSettings);

async function SaveSettings() {
    //determine which ruleset was selected
    const ruleset = GeneralRules.checked ? "general" : "individual";

    //get the selected intensity
    const selectedintensity = document.querySelector('input[name="intensitylevel"]:checked');

    const intensitylevel = selectedintensity ? selectedintensity.value : "level1";

    //create the settings object
    const settings = {
        ruleset: ruleset,
        intensitylevel: intensitylevel,
        distractionsites: DistractionSites
    };
    /* should look something like this when actually saved
    {
        settings: {
            ruleset: "general",
            intensityLevel: "level3",
            distractionSites: [
                "youtube.com",
                "instagram.com"
            ]
        }
    }
    */

    //save settings separately from the task list
    await ExtensionAPI.storage.local.set({
        settings: settings
    });

    SettingsStatus.textContent = "Settings saved successfully!";
}