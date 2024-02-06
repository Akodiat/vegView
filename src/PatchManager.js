import * as THREE from 'three';
import {updateInstance} from "./draw.js";
import {Patch} from './Patch.js';
import {Cohort, CohortTimestep, idFromData} from './Cohort.js';
import {emptyElem} from './utils.js';

class PatchManager {
    currentYear;
    years;
    boleColor;
    selectedColor;
    selectedCohort;
    patchMeshes;
    constructor() {
        this.patches = new Map();
        this.currentYear = undefined;
        this.years = new Set();
        this.selectedCohort = undefined;
        this.boleColor = new THREE.Color(0x664228);
        this.crownColor = new THREE.Color(0x426628);
        this.selectedColor = new THREE.Color(0xff4228);
        this.patchMargins = 1.2;
        this.pftColors = [
            [102, 102, 240], // BNE
            [254, 254, 101], // BINE
            [254, 178, 101], // BNS
            [179, 179, 179], // TeNE
            [117, 254, 101], // TeBS
            [254, 237, 167], // IBS
            [ 99,  99,  99], // TeBE
            [101, 193, 254], // TrBE
            [254, 208, 162], // TrIBE
            [240, 102, 255], // TrBR
        ].map(c=> new THREE.Color(`rgb(${c.join(',')})`))
    }

    addData(data) {
        // Add patch data
        if (!this.patches.has(data.PID)) {
            this.patches.set(data.PID, new Patch(data.PID, data.Px, data.Py, data.Pheight, this.patchMargins));
        }
        const patch = this.patches.get(data.PID);

        // Add cohort data
        if (!patch.cohorts.has(idFromData(data))) {
            patch.cohorts.set(idFromData(data), new Cohort(data));
        }
        patch.cohorts.get(idFromData(data)).addStep(new CohortTimestep(data));

        // Keep track of the set of all years.
        this.years.add(data.Year);
    }


    initVis(year) {
        this.patchMeshes = new THREE.Group();
        // Setup instancing meshes for each cohort
        for (const patch of this.patches.values()) {
            patch.initTreePositions(year);
            patch.meshes = new THREE.Group();
            patch.cohortMeshes = new THREE.Group();
            for (const cohort of patch.cohorts.values()) {
                cohort.initVis()
                patch.cohortMeshes.add(cohort.treeMeshes);
            }
            patch.meshes.add(patch.cohortMeshes);
            patch.meshes.add(patch.grassMesh);
            this.patchMeshes.add(patch.meshes);
        }
    }

    calcPatchesCentre() {
        const com = new THREE.Vector3();
        for (const patch of this.patches.values()) {
            com.add(new THREE.Vector3(
                patch.Px * patch.sideLength * this.patchMargins - patch.sideLength/2,
                0,
                patch.Py * patch.sideLength * this.patchMargins - patch.sideLength/2
                ));
            }
            return com.divideScalar(this.patches.size);
    }

    setYear(year) {
        console.log(`Showing year ${year}`);

        // Temporary matrix to reuse for efficiency
        const mTemp = new THREE.Matrix4();

        for (const patch of this.patches.values()) {
            patch.updateTreePositions(year);
            let grassyPatch = false;
            for (const cohort of patch.cohorts.values()) {
                if (cohort.isGrass || !cohort.timeSteps.has(year)) {
                    cohort.treeMeshes.visible = false;
                    if (cohort.isGrass) {
                        grassyPatch = true;
                    }
                    continue;
                }
                cohort.treeMeshes.visible = true;
                const cohortData = cohort.timeSteps.get(year);
                const nTrees = cohortData.DensI * cohort.maxTreeCount;
                for (let iTree=0; iTree<cohort.maxTreeCount; iTree++) {
                    if (iTree >= nTrees) {
                        updateInstance(cohort.instancedBoles, emptyElem, iTree, mTemp);
                        updateInstance(cohort.instancedCrowns, emptyElem, iTree, mTemp);
                        continue;
                    }
                    const p = cohortData.positions.get(iTree);
                    const xpos = patch.Px * patch.sideLength * this.patchMargins - patch.sideLength + p.x;
                    const ypos = patch.Py * patch.sideLength * this.patchMargins - patch.sideLength + p.y;

                    const boleElem = {
                        position: new THREE.Vector3(
                            xpos,
                            patch.Pheight + cohortData.Height/2,
                            ypos
                            ),
                            quaternion: new THREE.Quaternion(),
                            scale: new THREE.Vector3(
                            cohortData.Diam,
                            cohortData.Height,
                            cohortData.Diam
                            ),
                            color: this.boleColor //i === this.selectedCohort ? this.selectedColor : this.boleColor
                        }
                    const crownRadius = Math.sqrt(cohortData.CrownA/Math.PI);
                    updateInstance(cohort.instancedBoles, boleElem, iTree, mTemp);

                    const crownElem = {
                        position: new THREE.Vector3(
                            xpos,
                            patch.Pheight + cohortData.Height-(cohortData.Boleht/2),
                            ypos
                        ),
                        quaternion: new THREE.Quaternion(),
                        scale: new THREE.Vector3(
                            crownRadius,
                            cohortData.Boleht,
                            crownRadius
                        ),
                        color: this.pftColors[cohortData.PFT].clone() // i === this.selectedCohort ? this.selectedColor : this.crownColor
                    }
                    console.assert(crownElem.color.isColor, "Not color")
                    updateInstance(cohort.instancedCrowns, crownElem, iTree, mTemp);
                }
            }

            // Paint grass or not
            patch.grassMesh.material.color = grassyPatch ? patch.grassColor : patch.noGrassColor
        }

        this.currentYear = year;
        this.drawCohortInfo();
    }

    drawCohortInfo() {
        if (this.selectedCohort === undefined) {
            // Hide cohort info table
            document.getElementById("cohortInfoContainer").style.display = "none";
        } else {
            // Create new cohort info table
            const cohortData = this.getSelectedCohortData()
            const cohortInfoTable = document.getElementById("cohortInfoTable");
            cohortInfoTable.innerHTML = "";
            for(let property in cohortData) {
                cohortInfoTable.innerHTML+=`<tr><th scope="row">${property}</th><td>${cohortData[property]}</td></tr>`;
            }
            document.getElementById("cohortInfoContainer").style.display = "block";
        }
    }

    getCohortByInstanceId(instanceId) {
        const cohortIDs = [...this.cohorts.keys()];
        return this.cohorts.get(cohortIDs[instanceId])
    }

    getSelectedCohortData() {
        const cohort = this.getCohortByInstanceId(this.selectedCohort);
        return {
            ...cohort.timeSteps.get(this.currentYear),
            yearOfBirth: cohort.yearOfBirth,
            yearOfDeath: cohort.yearOfDeath,
        }
    }

    getCohortById(cohortId) {
        for (const patch of this.patches.values()) {
            if (patch.cohorts.has(cohortId)) {
                return patch.cohorts.get(cohortId)
            }
        }
    }

    selectCohort(cohortId, instanceId) {
        if (cohortId === this.selectedCohortId) {
            // Already selected
            return
        }

        const cohort = this.getCohortById(cohortId);

        // Clear current selection
        cohort.instancedBoles.setColorAt(this.selectedInstance, this.boleColor);
        cohort.instancedCrowns.setColorAt(this.selectedInstance, this.crownColor);
        // Mark new selection
        if (instanceId !== undefined) {
            cohort.instancedBoles.setColorAt(instanceId, this.selectedColor);
            cohort.instancedCrowns.setColorAt(instanceId, this.selectedColor);
        }
        cohort.instancedBoles.instanceColor.needsUpdate = true;
        cohort.instancedCrowns.instanceColor.needsUpdate = true;
        this.selectedInstance = instanceId;
        this.selectedCohortId = cohortId;
    }

    nextYear() {
        // Skip years we don't have data for
        const max = Math.max(...this.years);
        while(!this.years.has(++this.currentYear)) {
            // Make sure we dont overshoot the last year
            if (this.currentYear > max) {
                this.currentYear = max;
                break
            }
        }
        this.setYear(this.currentYear);
    }

    prevYear() {
        // Skip years we don't have data for
        const min = Math.min(...this.years);
        while(!this.years.has(--this.currentYear)) {
            // Make sure we dont overshoot the first year
            if (this.currentYear < min) {
                this.currentYear = min;
                break
            }
        }
        this.setYear(this.currentYear);
    }
}

export {PatchManager}