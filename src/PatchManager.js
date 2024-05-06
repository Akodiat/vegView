import * as THREE from "three";
import {updateInstance} from "./draw.js";
import {Patch} from "./Patch.js";
import {Cohort, CohortTimestep, idFromData} from "./Cohort.js";
import {emptyElem} from "./utils.js";
import {TreeMesh} from "./TreeMesh.js";
import {NURBSSurface} from "../libs/curves/NURBSSurface.js";
import {ParametricGeometry} from "../libs/geometries/ParametricGeometry.js";

const boleGeometry = new THREE.CylinderGeometry(.5, .5, 1, 8);
const crownGeometreCone = new THREE.CylinderGeometry(.1, 1, 1, 16);
const crownGeometrySphere = new THREE.SphereGeometry(1, 8, 16);
const twigTexture = new THREE.TextureLoader().load("./assets/twig-1.png");

const emissiveColorSelected = new THREE.Color(0x42d5ff);
const emissiveColorUnselected = new THREE.Color(0x000000);

class PatchManager {
    constructor() {
        this.patches = new Map();
        this.currentYear = undefined;
        this.years = new Set();
        this.boleColor = new THREE.Color(0x8c654a);
        this.crownColor = new THREE.Color(0x426628);
        this.patchMargins = 1.05;
        this.pftConstants = [
            {color: new THREE.Color(0x2222f4), geometry: crownGeometreCone}, // BNE
            {color: new THREE.Color(0x8b8c8c), geometry: crownGeometreCone}, // BINE
            {color: new THREE.Color(0xfed126), geometry: crownGeometreCone}, // BNS
            {color: new THREE.Color(0xc8bfe7), geometry: crownGeometrySphere}, // TeNE
            {color: new THREE.Color(0xf82625), geometry: crownGeometrySphere}, // TeBS
            {color: new THREE.Color(0x25f925), geometry: crownGeometrySphere}, // IBS
            {color: new THREE.Color(0xe821e8), geometry: crownGeometrySphere}, // TeBE
            {color: new THREE.Color(0x26e3e3), geometry: crownGeometrySphere}, // TrBE
            {color: new THREE.Color(0xf56c6c), geometry: crownGeometrySphere}, // TrIBE
            {color: new THREE.Color(0xf6ef2a), geometry: crownGeometrySphere}, // TrBR
        ];
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
            p.meshes.name = `patch_${p.PID}`;
            p.cohortMeshes = new THREE.Group();
            p.cohortMeshes.name = p.meshes.name + "_cohortMeshes";
            for (const cohort of p.cohorts.values()) {
                cohort.initVis();
                p.cohortMeshes.add(cohort.treeMeshes);
            }
            p.meshes.add(p.cohortMeshes);
            p.meshes.add(p.grassMesh);
            p.meshes.position.set(
                p.Px * p.sideLength * this.patchMargins - p.sideLength,
                p.Pheight,
                p.Py * p.sideLength * this.patchMargins - p.sideLength
            );
            this.patchMeshes.add(p.meshes);
        }

        const terrainObj = this.drawDetailedTerrain();
        this.detailedTerrainMesh = terrainObj.mesh;
        this.detailedTerrainMap = terrainObj.surfaceMap;
        this.patchMeshes.add(this.detailedTerrainMesh);
    }

    calcPatchesCentre() {
        const com = new THREE.Vector3();
        for (const patch of this.patches.values()) {
            com.add(patch.meshes.position);
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
                    cohort.instancedCrowns.geometry = this.pftConstants[cohortData.PFT].geometry;
                    cohort.instancedCrowns.material.map = undefined;
                }
                cohort.instancedCrowns.material.needsUpdate = true;

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
                            this.fancyTrees? this.detailedTerrainMap(p, patch) : cohortData.Height/2,
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
                    };
                    updateInstance(cohort.instancedBoles, boleElem, iTree, mTemp);

                    const crownElem = {
                        position: new THREE.Vector3(
                            p.x,
                            this.fancyTrees? this.detailedTerrainMap(p, patch) : cohortData.Height-(cohortData.Boleht/2),
                            p.y
                        ),
                        quaternion: new THREE.Quaternion(),
                        scale: new THREE.Vector3(
                            this.fancyTrees? 1 : crownRadius,
                            this.fancyTrees? 1 : cohortData.Boleht,
                            this.fancyTrees? 1 : crownRadius
                        ),
                        color: this.pftConstants[cohortData.PFT].color.clone()
                    };
                    console.assert(crownElem.color.isColor, "Not color");
                    updateInstance(cohort.instancedCrowns, crownElem, iTree, mTemp);
                }
            }

            // Paint grass or not
            patch.grassMesh.material.color = grassyPatch ? patch.grassColor : patch.noGrassColor;

            patch.grassMesh.visible = !this.fancyTrees;
        }
        this.detailedTerrainMesh.visible = this.fancyTrees;

        this.currentYear = year;
        this.drawCohortInfo();
    }

    drawCohortInfo() {
        if (this.selectedCohortId === undefined) {
            // Close cohort info table if it is open
            if (this.cohortInfoWindow !== undefined) {
                // eslint-disable-next-line no-undef
                Metro.window.close(this.cohortInfoWindow);
            }
            this.cohortInfoWindow = undefined;
        } else {
            // Create new cohort info table
            const cohortData = this.getSelectedCohortData();
            let content = "";
            for(let property in cohortData) {
                content +=`<tr><th scope="row">${property}</th><td>${cohortData[property]}</td></tr>`;
            }
            // Create new cohort info window, or replace the content
            // of an opened one.
            if (this.cohortInfoWindow === undefined) {
                // eslint-disable-next-line no-undef
                this.cohortInfoWindow = Metro.window.create({
                    title: "Cohort info",
                    place: "center",
                    icon: "<span class='mif-rocket'></span>",
                    height: 500,
                    content: `<table class="table striped row-hover"><tbody id="cohortInfoBody">${content}</tbody></table>`
                });
            } else {
                document.getElementById("cohortInfoBody").innerHTML = content;
            }
        }
    }

    getCohortByInstanceId(instanceId) {
        const cohortIDs = [...this.cohorts.keys()];
        return this.cohorts.get(cohortIDs[instanceId]);
    }

    getSelectedCohortData() {
        const cohort = this.getCohortById(this.selectedCohortId);
        return {
            ...cohort.timeSteps.get(this.currentYear),
            yearOfBirth: cohort.yearOfBirth,
            yearOfDeath: cohort.yearOfDeath,
        };
    }

    getCohortById(cohortId) {
        for (const patch of this.patches.values()) {
            if (patch.cohorts.has(cohortId)) {
                return patch.cohorts.get(cohortId);
            }
        }
    }

    selectCohort(cohortId) {
        console.log("Selected cohort "+cohortId);
        if (cohortId === this.selectedCohortId) {
            // Already selected
            return;
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

    isLastYear() {
        const max = Math.max(...this.years);
        return this.currentYear >= max;
    }

    nextYear() {
        // Skip years we don't have data for
        const max = Math.max(...this.years);
        while(!this.years.has(++this.currentYear)) {
            // Make sure we dont overshoot the last year
            if (this.currentYear > max) {
                this.currentYear = max;
                break;
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
                break;
            }
        }
        this.setYear(this.currentYear);
    }

    drawDetailedTerrain(slices=20, stacks=20) {
        // Extract corner positions from patches
        const positions = [...this.patches.values()].flatMap(p=>[
            p.meshes.position,
            new THREE.Vector3(p.sideLength, 0, 0).add(p.meshes.position),
            new THREE.Vector3(0, 0, p.sideLength).add(p.meshes.position),
            new THREE.Vector3(p.sideLength, 0, p.sideLength).add(p.meshes.position),
        ]);

        // Calculate min and max value (for later use in surface map)
        const max = new THREE.Vector2(-Infinity, -Infinity);
        const min = new THREE.Vector2(Infinity, Infinity);
        positions.forEach(p=>{
            max.x = Math.max(p.x, max.x);
            max.y = Math.max(p.z, max.y);

            min.x = Math.min(p.x, min.x);
            min.y = Math.min(p.z, min.y);
        });

        const xs = new Set(positions.map(p=>p.x));
        const zs = new Set(positions.map(p=>p.z));
        const nsControlPoints = [...xs].map(x => {
            const ps = positions.filter(p => p.x === x).map(
                p => new THREE.Vector4(p.x, p.y, p.z, 1)
            );
            const meanY = ps.map(p=>p.y).reduce((a, b) => a + b, 0) / ps.length;
            const pzs = new Set(ps.map(p=>p.z));
            [...zs].forEach(z=>{
                if (!pzs.has(z)) {
                    ps.push(new THREE.Vector4(x, meanY, z, 0.01));
                }
            });
            return ps;
        });

        const knotmaker = s => {
            let a = [];
            for (let i=0; i<s; i++) {
                a.push(0);
            }
            for (let i=0; i<s; i++) {
                a.push(1);
            }
            return a;
        };

        // Setup parameters for NURBS surface
        // The rules for knots are still a bit of a mystery to me,
        // but this seems to work
        const len1 = nsControlPoints.length;
        const len2 = Math.min(...nsControlPoints.map(p=>p.length));
        const knots1 = knotmaker(len1); //[0, 0, 0, 0, 1, 1, 1, 1] for 4 patches
        const knots2 = knotmaker(len2); //[0, 0, 0, 0, 1, 1, 1, 1] for 4 patches;
        const degree1 = knots1.length - 1 - len2; // 3
        const degree2 = knots2.length - 1 - len2; // 3
        const nurbsSurface = new NURBSSurface(degree1, degree2, knots1, knots2, nsControlPoints);


        const geometry = new ParametricGeometry(
            (u,v,target)=>nurbsSurface.getPoint(u,v,target),
            slices, stacks
        );
        const material = new THREE.MeshLambertMaterial({
            side: THREE.DoubleSide,
            color: new THREE.Color(0x664228)
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.receiveShadow = true;

        return {
            mesh,
            surfaceMap: (p, patch) => {
                const u = (p.x - min.x + patch.meshes.position.x) / (max.x - min.x);
                const v = (p.y - min.y + patch.meshes.position.z) / (max.y - min.y);
                const vec = new THREE.Vector3();
                nurbsSurface.getPoint(u, v, vec);
                return vec.y - patch.Pheight;
            }};
    }
}



export {PatchManager};