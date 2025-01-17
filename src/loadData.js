import {PatchManager} from "./PatchManager.js";

/**
 * Parse csv-like files with a header line and float values
 * where the separator is whitespace of variable length.
 * @param {File} file Text file
 * @returns List of items with float properties
 */
async function itemsFromFile(file) {
    const text = await file.text();
    const items = [];

    // Helper function to parse whitespace-separated values from line
    const getVals = l => l.split(" ").filter(c=>c!=="");

    // Process header and lines to extract the items;
    const lines = text.split(/[\r\n]+/);
    const header = getVals(lines[0]);
    for (const line of lines.slice(1)) {
        if (line !== "") {
            const lineVals = getVals(line);
            let item = {};
            header.forEach((h, i) => item[h] = parseFloat(lineVals[i]));
            items.push(item);
        }
    }

    return items;
}

/**
 * Loads data from files. Expects one file to have a name containing "veg_struct".
 * Other files are loaded as yearly data (with no cohort information)
 * @param {FileList} files
 * @param {PatchManager} patchManager
 * @returns The populated patch manager
 */
async function loadData(files, patchManager = new PatchManager()) {
    let vegStructFile;
    let yearDataFiles = [];

    const isVegStructFile = f => f.name.includes("veg_struct");

    if (files.length == 1) {
        vegStructFile = files[0];
    } else {
        vegStructFile = [...files].find(isVegStructFile);
        yearDataFiles = [...files].filter(f => f != vegStructFile);
    }

    // Save name (without suffix)
    patchManager.datasetName = vegStructFile.name.split(".").slice(0,-1).join();

    const items = await itemsFromFile(vegStructFile);
    for (const item of items) {
        patchManager.addData(item);
    }

    for (const f of yearDataFiles) {
        const items = await itemsFromFile(f);
        for (const item of items) {
            patchManager.addYearData(item);
        }
    }

    //Populate color scheme selects in UI

    // Get list of attributes
    const attributes = new Set();
    for (const patch of patchManager.patches.values()) {
        for (const cohort of patch.cohorts.values()) {
            for (const t of cohort.timeSteps.values())  {
                for (const prop in t) {
                    attributes.add(prop);
                }
            }
        }
    }
    attributes.delete("positions");

    const data = {"PFT": undefined};

    attributes.forEach(v => data[v] = v);

    for (const s of ["#stemColorSelect", "#crownColorSelect"]) {
        // eslint-disable-next-line no-undef
        const select = $(s).data("select");
        select.data(data);
    }

    return patchManager;
}

export {loadData};