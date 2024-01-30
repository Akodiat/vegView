import * as THREE from 'three';
import {drawInstances, updateAllInstances, updateInstance} from "./draw.js";
import {randItem} from './utils.js';

const boleGeometry = new THREE.CylinderGeometry(.5, .5, 1, 8);
const crownGeometry = new THREE.CylinderGeometry(.2, .5, 1, 16);

class Cohort {
    constructor(data) {
        this.SID = data.SID;
        this.PID = data.PID;
        this.IID = data.IID;

        this.isGrass = (
            data.Pos === 0 &&
            data.Height === 0 &&
            data.Boleht === 0 &&
            data.Diam === 0 &&
            data.CrownA === 1 &&
            data.DensI === 1
        )

        if (this.isGrass) {
            console.log("grass")
        }

        // Store all timesteps in a map from year to CohortTimestep
        this.timeSteps = new Map();

        // Set to infinities so that max and min work correctly
        this.yearOfBirth = Infinity;
        this.yearOfDeath = -Infinity;

        this.maxTreeCount = 1000;
    }

    addStep(data) {
        console.assert(!this.timeSteps.has(data.Year), `Cohort ${idFromData(data)} already has data for year ${data.Year}`);
        this.yearOfBirth = Math.min(this.yearOfBirth, data.Year);
        this.yearOfDeath = Math.max(this.yearOfDeath, data.Year);
        this.timeSteps.set(data.Year,
            new CohortTimestep(data)
        );
    }

    initVis() {
        this.treeMeshes = new THREE.Group();
        const elems = [];
        for (let iTree=0; iTree<this.maxTreeCount; iTree++) {
            elems.push(emptyElem);
        }
        this.instancedBoles = drawInstances(boleGeometry, elems, THREE.MeshLambertMaterial);
        this.instancedBoles.cohortId = idFromData(this);
        this.instancedCrowns = drawInstances(crownGeometry, elems, THREE.MeshLambertMaterial);
        this.instancedCrowns.cohortId = idFromData(this);
        this.treeMeshes.add(this.instancedBoles);
        this.treeMeshes.add(this.instancedCrowns);
    }
}

class CohortTimestep {
    Lon; // Longitude
    Lat; // Latitude
    Year; // Year
    SID; // Stand ID
    PID; // Patch ID
    IID; // Cohort ID
    PFT; // Plant Functional Type ID
    Age; // Age of cohort
    Pos; // Center position of cohort [0//1]
    Height; // Height of tree
    Boleht; // Bole height of tree
    Diam; // Diameter of stem (m)
    CrownA; // Crown area (m2)
    DensI; // Density of trees in cohort (trees m//2)
    LAI; // Leaf Area Index (m2 m//2)
    GPP; // Gross Primary Production (kg C m//2 yr//1)
    GPPns; // Gross Primary Production with N stress (kg C m//2 yr//1)
    GPPno; // Gross Primary Production with no stress (kg C m//2 yr//1)
    Cmass; // Total C mass of cohort (kg C m//2)

    /**
     *
     * @param {{
     * Lon: number, Lat: number, Year: number, SID: number, PID: number,
     * IID: number, PFT: number, Age: number, Pos: number, Height: number,
     * Boleht: number, Diam: number, CrownA: number, DensI: number,
     * LAI: number, GPP: number, GPPns: number, GPPno: number, Cmass: number
     * }} data
     */
    constructor(data) {
        for(let property in data) {
            this[property] = data[property];
        }
        this.positions = new Map();
    }
}

/**
 * Get a unique string for a cohort, patch, and stand
 * @param {{SID: number, PID: number, IID: number}} data
 * @returns {string} Unique string identifying the cohort, patch, and stand
 */
function idFromData(data) {
    return `${data.SID}:${data.PID}:${data.IID}`
}



const emptyElem = {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    scale: new THREE.Vector3(),
    color: new THREE.Color()
}

class PatchCell extends THREE.Vector2 {
    occupyingCohort;
    occupyingInstance;

    constructor(x, y) {
        super(x, y)
    }
    // Make sure things are copied correctly
    clone() {
        const other = super.clone();
        other.occupyingCohort = this.occupyingCohort;
        other.occupyingInstance = this.occupyingInstance;
        return other;
    }
}

class Patch {
    constructor(PID, Px, Py, Pheight) {
        this.PID = PID;
        this.Px = Px;
        this.Py = Py;
        this.Pheight = Pheight;

        this.cohorts = new Map();

        this.area = 1000;
        this.sideLength = Math.sqrt(this.area);
        this.allCells = new Map();
        this.availableCells = new Map();
        this.allowedOverlap = 0.5; // Allow 50% overlap

        this.positionedYears = new Set();
    }

    initTreePositions(year) {
        // Create a list of all trees and their crown radii
        const trees = [];
        let totalCrownArea = 0;

        // Update cohorts with the largest trees first
        const cohorts = [...this.cohorts.values()].filter(c=> !c.isGrass && c.timeSteps.has(year));
        cohorts.sort((a,b) => b.timeSteps.get(year).CrownA - a.timeSteps.get(year).CrownA);

        for (const cohort of cohorts) {
            if (cohort.isGrass || !cohort.timeSteps.has(year)) {
                continue;
            }
            const d = cohort.timeSteps.get(year)
            const crownRadius = Math.sqrt(d.CrownA/Math.PI);
            const nTreesInCohort = d.DensI * cohort.maxTreeCount;
            for (let i=0; i<nTreesInCohort; i++) {
                trees.push({
                    data: d,
                    crownRadius: crownRadius,
                    instanceId: i
                });
                totalCrownArea += d.CrownA;
            }
        }

        this.availableCells.set(year, []);
        this.allCells.set(year, []);

        const delta = 0.5 //(this.area / trees.length);
        // Divide the patch into list of available cells
        for (let x=0; x<this.sideLength; x+=delta) {
            for (let y=0; y<this.sideLength; y+=delta) {
                const cell = new PatchCell(x, y);
                this.allCells.get(year).push(cell);
                this.availableCells.get(year).push(cell);
            }
        }
        // Place trees one by one and remove all cells they occupy
        for (const tree of trees) {
            const cell = randItem(this.availableCells.get(year));
            this.availableCells.set(year, this.availableCells.get(year).filter(
                c=>cell.distanceTo(c) > tree.crownRadius * this.allowedOverlap
            ));
            for (const c of this.allCells) {
                if (cell.distanceTo(c) <= tree.crownRadius * this.allowedOverlap) {
                    cell.occupyingCohort = idFromData(tree.data);
                    cell.occupyingInstance = tree.instanceId;
                }
            }
            const cohortData = this.cohorts.get(idFromData(tree.data)).timeSteps.get(year)
            cohortData.positions.set(tree.instanceId, cell);
        }

        this.positionedYears.add(year);
    }

    updateTreePositions(year) {
        // Only need to do this once per year
        if (this.positionedYears.has(year)) {
            return
        }

        this.availableCells.set(year, []);
        this.allCells.set(year, []);

        // Use positions from a previous year if we have them
        const prevYears = [...this.positionedYears.values()].filter(y => y < year);
        if (prevYears.length > 0) {
            const lastYear = Math.max(prevYears);
            this.allCells.set(year, this.availableCells.get(lastYear).map(c=>c.clone()));
            this.availableCells.set(
                year, this.allCells.get(year).filter(c=>(
                    c.occupyingCohort === undefined &&
                    c.occupyingInstance === undefined
                )
            ));
            for (const c of this.cohorts.values()) {
                if (c.timeSteps.has(year) && c.timeSteps.has(lastYear)) {
                    c.timeSteps.get(lastYear).positions.forEach((cell, instanceId)=> {
                        c.timeSteps.get(year).positions.set(instanceId, cell)
                    })
                }
            }
        }

        // Update cohorts with the largest trees first
        const cohorts = [...this.cohorts.values()].filter(c=> !c.isGrass && c.timeSteps.has(year));
        cohorts.sort((a,b) => b.timeSteps.get(year).CrownA - a.timeSteps.get(year).CrownA);

        // Remove any extra trees in each cohort
        for (const cohort of cohorts) {
            const d = cohort.timeSteps.get(year)
            const nTreesInCohort = d.DensI * cohort.maxTreeCount;

            // If we have more tree positions defined than we should
            if (d.positions.size > nTreesInCohort) {
                console.log(`Removing ${d.positions.size - nTreesInCohort} trees from cohort ${d.IID}, patch ${d.PID}. Available cells: ${this.availableCells.get(year).length}`);
                for (let i=nTreesInCohort; i<d.positions.size; i++) {
                    d.positions.delete(i);
                }
                // Mark cells as available
                this.allCells.get(year).forEach(c=>{
                    if (
                        c.occupyingCohort === idFromData(d) &&
                        c.occupyingInstance >= nTreesInCohort
                    ) {
                        c.occupyingCohort = undefined;
                        c.occupyingInstance = undefined;
                    }
                });
                this.availableCells.set(
                    year, this.allCells.get(year).filter(c=>(
                        c.occupyingCohort === undefined &&
                        c.occupyingInstance === undefined
                    )
                ));
            }
        }

        // Add new trees in each cohort
        for (const cohort of cohorts) {
            const d = cohort.timeSteps.get(year)
            const nTreesInCohort = d.DensI * cohort.maxTreeCount;

            if (d.positions.size < nTreesInCohort) {
                console.log(`Adding ${nTreesInCohort - d.positions.size} trees to cohort ${d.IID}, patch ${d.PID}. Available cells: ${this.availableCells.length}`);
            }

            while (d.positions.size < nTreesInCohort) {
                const crownRadius = Math.sqrt(d.CrownA/Math.PI);
                const tree = {
                    data: d,
                    crownRadius: crownRadius,
                    instanceId: d.positions.size
                }
                const cell = randItem(this.availableCells.get(year));
                this.availableCells.set(
                    year, this.availableCells.get(year).filter(
                        c=>cell.distanceTo(c) > tree.crownRadius * this.allowedOverlap
                    )
                );
                for (const c of this.allCells.get(year)) {
                    if (cell.distanceTo(c) <= tree.crownRadius * this.allowedOverlap) {
                        cell.occupyingCohort = idFromData(tree.data);
                        cell.occupyingInstance = tree.instanceId;
                    }
                }
                d.positions.set(tree.instanceId, cell);
            }
        }
    }
}

class CohortManager {
    currentYear;
    years;
    boleColor;
    selectedColor;
    selectedCohort;
    cohortMeshes;
    constructor() {
        this.patches = new Map();
        this.currentYear = undefined;
        this.years = new Set();
        this.selectedCohort = undefined;
        this.boleColor = new THREE.Color(0x664228);
        this.crownColor = new THREE.Color(0x426628);
        this.selectedColor = new THREE.Color(0xff4228);
        this.patchMargins = 1.2;
    }

    addData(data) {
        // Add patch data
        if (!this.patches.has(data.PID)) {
            this.patches.set(data.PID, new Patch(data.PID, data.Px, data.Py, data.Pheight));
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
        this.cohortMeshes = new THREE.Group();
        // Setup instancing meshes for each cohort
        for (const patch of this.patches.values()) {
            patch.initTreePositions(year);
            patch.patchMeshes = new THREE.Group();
            for (const cohort of patch.cohorts.values()) {
                cohort.initVis()
                patch.patchMeshes.add(cohort.treeMeshes);
            }
            this.cohortMeshes.add(patch.patchMeshes)
        }
    }

    calcPatchesCentre() {
        const com = new THREE.Vector3();
        for (const patch of this.patches.values()) {
            com.add(new THREE.Vector3(
                patch.Px * patch.sideLength * this.patchMargins,
                0,
                patch.Py * patch.sideLength * this.patchMargins
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
            for (const cohort of patch.cohorts.values()) {
                if (cohort.isGrass || !cohort.timeSteps.has(year)) {
                    cohort.treeMeshes.visible = false;
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
                    const xpos = patch.Px * patch.sideLength * this.patchMargins + p.x;
                    const ypos = patch.Py * patch.sideLength * this.patchMargins + p.y;

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
                            color: this.crownColor // i === this.selectedCohort ? this.selectedColor : this.crownColor
                    }
                    updateInstance(cohort.instancedCrowns, crownElem, iTree, mTemp);
                }
            }
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

export {CohortManager}