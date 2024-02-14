import {PatchManager} from './PatchManager.js';

async function loadVegetationStructure(file) {
    const text = await file.text();
    const patchManager = new PatchManager();

    // Helper function to parse whitespace-separated values from line
    const getVals = l => l.split(" ").filter(c=>c!=="");

    // Process header and lines and populate the patchManager;
    const lines = text.split(/[\r\n]+/);
    const header = getVals(lines[0]);
    for (const line of lines.slice(1)) {
        if (line !== "") {
            const lineVals = getVals(line);
            let item = {};
            header.forEach((h, i) => item[h] = parseFloat(lineVals[i]))
            patchManager.addData(item);
        }
    }

    return patchManager;
}

export {loadVegetationStructure}