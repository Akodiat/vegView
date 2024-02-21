import * as THREE from 'three';
import {updateInstance} from "./draw.js";
import {Patch} from './Patch.js';
import {Cohort, CohortTimestep, idFromData} from './Cohort.js';
import {emptyElem} from './utils.js';
import {TreeMesh} from './TreeMesh.js';
import {NURBSSurface} from '../libs/curves/NURBSSurface.js';
import {ParametricGeometry} from '../libs/geometries/ParametricGeometry.js';

const boleGeometry = new THREE.CylinderGeometry(.5, .5, 1, 8);
const crownGeometry = new THREE.CylinderGeometry(.2, .5, 1, 16);
const twigTexture = new THREE.TextureLoader().load('./assets/twig-1.png');

const emissiveColorSelected = new THREE.Color(0x42d5ff);
const emissiveColorUnselected = new THREE.Color(0x000000);

class PatchManager {
    currentYear;
    years;
    boleColor;
    patchMeshes;
    constructor() {
        this.patches = new Map();
        this.currentYear = undefined;
        this.years = new Set();
        this.boleColor = new THREE.Color(0x8c654a);
        this.crownColor = new THREE.Color(0x426628);
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
        ].map(c=> new THREE.Color(`rgb(${c.join(',')})`));
        this.minYear = Infinity;
        this.maxYear = -Infinity;
        this.yearData = new Map();
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
        this.minYear = Math.min(this.minYear, data.Year);
        this.maxYear = Math.max(this.maxYear, data.Year);
    }

    addYearData(data) {
        if (!this.yearData.has(data.Year)) {
            this.yearData.set(data.Year, {});
        }
        const yearData = this.yearData.get(data.Year);
        for(let property in data) {
            yearData[property] = data[property];
        }
    }


    initVis(year) {
        this.patchMeshes = new THREE.Group();
        // Setup instancing meshes for each cohort
        for (const p of this.patches.values()) {
            p.initTreePositions(year);
            p.meshes = new THREE.Group();
            p.meshes.name = `patch_${p.PID}`
            p.cohortMeshes = new THREE.Group();
            p.cohortMeshes.name = p.meshes.name + "_cohortMeshes"
            for (const cohort of p.cohorts.values()) {
                cohort.initVis()
                p.cohortMeshes.add(cohort.treeMeshes);
            }
            p.meshes.add(p.cohortMeshes);
            p.meshes.add(p.grassMesh);
            p.meshes.position.set(
                p.Px * p.sideLength * this.patchMargins - p.sideLength,
                p.Pheight,
                p.Py * p.sideLength * this.patchMargins - p.sideLength
            )
            this.patchMeshes.add(p.meshes);
        }

        this.patchMeshes.add(this.drawDetailedTerrain());
    }

    calcPatchesCentre() {
        const com = new THREE.Vector3();
        for (const patch of this.patches.values()) {
           com.add(patch.meshes.position)
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

                const crownRadius = Math.sqrt(cohortData.CrownA/Math.PI);
                if (this.fancyTrees) {
                    const treeMesh = new TreeMesh({
                        segments: 6, levels: 2, treeSteps: 2,
                        trunkLength: cohortData.Boleht,
                        initalBranchLength: crownRadius,
                        maxRadius: cohortData.Diam,
                        twigScale: cohortData.Boleht / 5
                    });
                    cohort.instancedBoles.geometry = treeMesh.trunkMesh.geometry;
                    cohort.instancedCrowns.geometry = treeMesh.twigsMesh.geometry;
                    cohort.instancedCrowns.material.map = twigTexture;
                } else {
                    cohort.instancedBoles.geometry = boleGeometry;
                    cohort.instancedCrowns.geometry = crownGeometry;
                    cohort.instancedCrowns.material.map = undefined;
                }
                cohort.instancedCrowns.material.needsUpdate = true

                const nTrees = cohortData.DensI * cohort.maxTreeCount;
                for (let iTree=0; iTree<cohort.maxTreeCount; iTree++) {
                    if (iTree >= nTrees) {
                        updateInstance(cohort.instancedBoles, emptyElem, iTree, mTemp);
                        updateInstance(cohort.instancedCrowns, emptyElem, iTree, mTemp);
                        continue;
                    }
                    const p = cohortData.positions.get(iTree);

                    const boleElem = {
                        position: new THREE.Vector3(
                            p.x,
                            this.fancyTrees? 0 : cohortData.Height/2,
                            p.y
                        ),
                        // Give trees different rotations (relevant if fancy)
                        quaternion: new THREE.Quaternion().setFromAxisAngle(cohort.instancedBoles.up, iTree),
                        scale: new THREE.Vector3(
                            this.fancyTrees? 1 : cohortData.Diam,
                            this.fancyTrees? 1 : cohortData.Height,
                            this.fancyTrees? 1 : cohortData.Diam
                        ),
                        color: this.boleColor
                    }
                    updateInstance(cohort.instancedBoles, boleElem, iTree, mTemp);

                    const crownElem = {
                        position: new THREE.Vector3(
                            p.x,
                            this.fancyTrees? 0 : cohortData.Height-(cohortData.Boleht/2),
                            p.y
                        ),
                        quaternion: new THREE.Quaternion(),
                        scale: new THREE.Vector3(
                            this.fancyTrees? 1 : crownRadius,
                            this.fancyTrees? 1 : cohortData.Boleht,
                            this.fancyTrees? 1 :crownRadius
                        ),
                        color: this.pftColors[cohortData.PFT].clone()
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
        if (this.selectedCohortId === undefined) {
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
        const cohort = this.getCohortById(this.selectedCohortId);
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

    selectCohort(cohortId) {
        console.log("Selected cohort "+cohortId)
        if (cohortId === this.selectedCohortId) {
            // Already selected
            return
        }


        // Clear current selection
        if (this.selectedCohortId !== undefined) {
            const cohort = this.getCohortById(this.selectedCohortId);
            cohort.instancedBoles.material.emissive = emissiveColorUnselected;
            cohort.instancedCrowns.material.emissive = emissiveColorUnselected;
        }

        // Mark new selection
        if (cohortId !== undefined) {
            const cohort = this.getCohortById(cohortId);
            cohort.instancedBoles.material.emissive = emissiveColorSelected;
            cohort.instancedCrowns.material.emissive = emissiveColorSelected;
        }

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

    drawDetailedTerrain() {
        //const positions = [...this.patches.values()].map(p=>p.meshes.position);
        const positions = [...this.patches.values()].flatMap(p=>[
            p.meshes.position,
            new THREE.Vector3(p.sideLength, 0, 0).add(p.meshes.position),
            new THREE.Vector3(0, 0, p.sideLength).add(p.meshes.position),
            new THREE.Vector3(p.sideLength, 0, p.sideLength).add(p.meshes.position),
        ]);
        const xs = new Set(positions.map(p=>p.x));

        const nsControlPoints = [...xs].map(x =>
            positions.filter(p => p.x === x).map(
                p => new THREE.Vector4(p.x, p.y, p.z, 1))
        )

        const degree1 = 3;
        const degree2 = 3;
        const knots1 = [0, 0, 0, 0, 1, 1, 1, 1];
        const knots2 = [0, 0, 0, 0, 1, 1, 1, 1];
        const nurbsSurface = new NURBSSurface(degree1, degree2, knots1, knots2, nsControlPoints);

        function getSurfacePoint(u, v, target) {
            return nurbsSurface.getPoint(u, v, target);
        }

        const geometry = new ParametricGeometry(getSurfacePoint, 20, 20);
        const material = new THREE.MeshLambertMaterial({
            side: THREE.DoubleSide
        });
        const object = new THREE.Mesh(geometry, material);
        return object
    }
}

export {PatchManager}