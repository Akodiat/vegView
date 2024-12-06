import * as THREE from "three";
import {updateInstance} from "./draw.js";
import {Patch} from "./Patch.js";
import {Cohort, CohortTimestep, idFromData} from "./Cohort.js";
import {emptyElem} from "./utils.js";
import {Tree} from "../libs/ez-tree.es.js";
import {NURBSSurface} from "../libs/curves/NURBSSurface.js";
import {ParametricGeometry} from "../libs/geometries/ParametricGeometry.js";

const boleGeometry = new THREE.CylinderGeometry(.5, .5, 1, 8);
const crownGeometries = {
    cone: new THREE.CylinderGeometry(.1, 0.5, 1, 16),
    sphere: new THREE.SphereGeometry(0.5, 8, 16)
};

const emissiveColorSelected = new THREE.Color(0x42d5ff);
const emissiveColorUnselected = new THREE.Color(0x000000);

class PatchManager {
    /**
     * Class to manage patches and all their cohorts
     */
    constructor() {
        this.patches = new Map();
        this.currentYear = undefined;
        this.years = new Set();
        this.usedPFTs = new Set();
        this.boleColor = new THREE.Color(0x8c654a);
        this.crownColor = new THREE.Color(0x426628);
        this.patchMargins = 1.05;
        this.detailedTreeFactor = 3;
        this.pftConstants = [
            {color: new THREE.Color(0x2222f4), geometry: "cone", name: "BNE", detailMesh: "Pine Medium"},
            {color: new THREE.Color(0x8b8c8c), geometry: "cone", name: "BINE", detailMesh: "Pine Medium"},
            {color: new THREE.Color(0xfed126), geometry: "cone", name: "BNS", detailMesh: "Pine Medium"},
            {color: new THREE.Color(0xc8bfe7), geometry: "cone", name: "TeNE", detailMesh: "Pine Medium"},
            {color: new THREE.Color(0xf82625), geometry: "sphere", name: "TeBS", detailMesh: "Oak Medium"},
            {color: new THREE.Color(0x25f925), geometry: "sphere", name: "IBS", detailMesh: "Aspen Medium"},
            {color: new THREE.Color(0xe821e8), geometry: "sphere", name: "TeBE", detailMesh: "Ash Medium"},
            {color: new THREE.Color(0x26e3e3), geometry: "sphere", name: "TrBE", detailMesh: "Oak Medium"},
            {color: new THREE.Color(0xf56c6c), geometry: "sphere", name: "TrIBE", detailMesh: "Aspen Medium"},
            {color: new THREE.Color(0xf6ef2a), geometry: "sphere", name: "TrBR", detailMesh: "Ash Medium"},
        ];
        this.minYear = Infinity;
        this.maxYear = -Infinity;
        this.yearData = new Map();
    }

    /**
     * Add patch data
     * @param {{
    * Lon: number, Lat: number, Year: number, SID: number, PID: number,
    * IID: number, PFT: number, Age: number, Pos: number, Height: number,
    * Boleht: number, Diam: number, CrownA: number, DensI: number,
    * LAI: number, GPP: number, GPPns: number, GPPno: number, Cmass: number
    * }} data Cohort data
     */
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
        this.minYear = Math.min(this.minYear, data.Year);
        this.maxYear = Math.max(this.maxYear, data.Year);

        // Keep track of PFTs used
        this.usedPFTs.add(data.PFT);
    }

    /**
     * Add data common for all patches and cohorts during given year
     * @param {*} data
     */
    addYearData(data) {
        if (!this.yearData.has(data.Year)) {
            this.yearData.set(data.Year, {});
        }
        const yearData = this.yearData.get(data.Year);
        for(let property in data) {
            yearData[property] = data[property];
        }
    }

    /**
     * Updates the distance between patches
     * @param {number} patchMargins A factor to distance patches from each
     * other. A value of 1 means no margin. A value of 1.2 means 20% margin.
     */
    updateMargins(patchMargins) {
        this.patchMargins = patchMargins;
        for (const p of this.patches.values()) {
            p.meshes.position.set(
                p.Px * p.sideLength * this.patchMargins - p.sideLength,
                p.Pheight,
                p.Py * p.sideLength * this.patchMargins - p.sideLength
            );
        }

        // Redraw the detailed terrain
        const terrainObj = this.drawSmoothTerrain();
        this.detailedTerrainMesh.geometry = terrainObj.mesh.geometry;
        this.detailedTerrainMap = terrainObj.surfaceMap;
    }


    /**
     * Initialise the visualisation.
     * Only needs to be run once, but needs to know
     * the year to initialise the tree positions
     * @param {*} year Year to initialise on
     * (usually the first year in the simulation)
     */
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

        const terrainObj = this.drawSmoothTerrain();
        this.detailedTerrainMesh = terrainObj.mesh;
        this.detailedTerrainMap = terrainObj.surfaceMap;
        this.patchMeshes.add(this.detailedTerrainMesh);
    }

    /**
     * Calculate the centre of mass for the patches
     * @returns {THREE.Vector3} Centre of mass position
     */
    calcPatchesCentre() {
        const com = new THREE.Vector3();
        for (const p of this.patches.values()) {
            const pos = new THREE.Vector3(
                p.Px * p.sideLength * this.patchMargins - p.sideLength/2,
                p.Pheight,
                p.Py * p.sideLength * this.patchMargins - p.sideLength/2
            );
            com.add(pos);
        }
        return com.divideScalar(this.patches.size);
    }

    /**
     * Sets the current year and redraws all cohorts
     * @param {number} year Year to set
     */
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

                if (this.detailedTrees) {

                    const treeMesh = new Tree();

                    // Use the correct preset
                    treeMesh.loadPreset(this.pftConstants[cohortData.PFT].detailMesh);

                    // Adapt preset options to cohort data
                    // Also try to simplify to get a lower amount of vertices

                    treeMesh.options.branch.levels = Math.min(treeMesh.options.branch.levels, 2);
                    const approxScale = cohortData.Height/treeMesh.options.branch.length[0];
                    if (treeMesh.options.type == "evergreen") {
                        treeMesh.options.branch.length[0] = cohortData.Height;
                        treeMesh.options.branch.length[1] = crownRadius * 2;
                    } else {
                        treeMesh.options.branch.length[0] = cohortData.Height - crownRadius;
                        treeMesh.options.branch.length[1] = crownRadius;
                    }

                    treeMesh.options.branch.length[2] = 1;
                    treeMesh.options.branch.length[3] = 1;

                    treeMesh.options.branch.sections[0] = 4;
                    treeMesh.options.branch.sections[1] = 4;
                    treeMesh.options.branch.segments[0] = 3;
                    treeMesh.options.branch.segments[1] = 3;

                    treeMesh.options.branch.radius[0] = cohortData.Diam/2;
                    treeMesh.options.leaves.size *= approxScale;

                    treeMesh.options.branch.start[1] = 0.5;

                    treeMesh.options.branch.children[0] = Math.round(
                        treeMesh.options.branch.children[0] /
                        this.detailedTreeFactor
                    );
                    treeMesh.options.branch.children[1] = Math.round(
                        treeMesh.options.branch.children[1] /
                        this.detailedTreeFactor
                    );

                    // Generate the tree mesh
                    treeMesh.generate();

                    // Update geometries and materials
                    cohort.instancedBoles.geometry = treeMesh.branchesMesh.geometry;
                    cohort.instancedBoles.material = treeMesh.branchesMesh.material.clone();
                    cohort.instancedCrowns.geometry = treeMesh.leavesMesh.geometry;
                    cohort.instancedCrowns.material = treeMesh.leavesMesh.material.clone();
                } else {
                    cohort.instancedBoles.geometry = boleGeometry;
                    cohort.instancedCrowns.geometry = crownGeometries[this.pftConstants[cohortData.PFT].geometry];
                    cohort.instancedCrowns.material.map = undefined;
                }
                cohort.instancedCrowns.material.needsUpdate = true;
                cohort.instancedBoles.material.needsUpdate = true;

                const nTrees = cohortData.DensI * cohort.maxTreeCount;
                for (let iTree=0; iTree<cohort.maxTreeCount; iTree++) {
                    if (iTree >= nTrees) {
                        updateInstance(cohort.instancedBoles, emptyElem, iTree, mTemp);
                        updateInstance(cohort.instancedCrowns, emptyElem, iTree, mTemp);
                        continue;
                    }
                    const p = cohortData.positions.get(iTree);

                    let boleHeight = 0;
                    if (this.smoothTerrain) {
                        boleHeight += this.detailedTerrainMap(p, patch);
                    }
                    if (!this.detailedTrees) {
                        boleHeight += cohortData.Boleht/2;
                    }
                    const boleElem = {
                        position: new THREE.Vector3(
                            p.x,
                            boleHeight,
                            p.y
                        ),
                        // Give trees different rotations (relevant if trees are detailed)
                        quaternion: new THREE.Quaternion().setFromAxisAngle(cohort.instancedBoles.up, iTree),
                        scale: new THREE.Vector3(
                            this.detailedTrees? 1 : cohortData.Diam,
                            this.detailedTrees? 1 : cohortData.Boleht,
                            this.detailedTrees? 1 : cohortData.Diam
                        ),
                        color: this.boleColor
                    };
                    updateInstance(cohort.instancedBoles, boleElem, iTree, mTemp);

                    let crownHeight = 0;
                    if (this.smoothTerrain) {
                        crownHeight += this.detailedTerrainMap(p, patch);
                    }
                    if (!this.detailedTrees) {
                        crownHeight += (cohortData.Height+cohortData.Boleht)/2;
                    }
                    const crownElem = {
                        position: new THREE.Vector3(
                            p.x,
                            crownHeight,
                            p.y
                        ),
                        // Give trees different rotations (relevant if trees are detailed)
                        quaternion: new THREE.Quaternion().setFromAxisAngle(cohort.instancedBoles.up, iTree),
                        scale: new THREE.Vector3(
                            this.detailedTrees? 1 : crownRadius*2,
                            this.detailedTrees? 1 : cohortData.Height - cohortData.Boleht,
                            this.detailedTrees? 1 : crownRadius*2
                        ),
                        color: this.detailedTrees? this.crownColor : this.pftConstants[cohortData.PFT].color.clone()
                    };
                    updateInstance(cohort.instancedCrowns, crownElem, iTree, mTemp);
                }
            }

            // Paint grass or not
            patch.grassMesh.material.color = grassyPatch ? patch.grassColor : patch.noGrassColor;

            patch.grassMesh.visible = !this.smoothTerrain;
        }
        this.detailedTerrainMesh.visible = this.smoothTerrain;

        this.currentYear = year;
        this.drawCohortInfo();
    }

    /**
     * Updates the cohort info window depending on what cohort (if any)
     * is currently selected
     */
    drawCohortInfo() {
        const cohortInfoBody = document.getElementById("cohortInfoBody");
        if (this.selectedCohortId === undefined) {
            // Close cohort info table if it is open
            if (cohortInfoBody !== null) {
                // eslint-disable-next-line no-undef
                Metro.window.close(this.cohortInfoWindow);
            }
            //this.cohortInfoWindow = undefined;
        } else {
            // Create new cohort info table
            const cohortData = this.getSelectedCohortData();
            let content = "";
            for(let property in cohortData) {
                content +=`<tr><th scope="row">${property}</th><td>${cohortData[property]}</td></tr>`;
            }

            // Create new cohort info window, or replace the content
            // of an opened one.
            // eslint-disable-next-line no-undef
            if (cohortInfoBody === null) {
                // eslint-disable-next-line no-undef
                this.cohortInfoWindow = Metro.window.create({
                    title: "Cohort info",
                    place: "center",
                    icon: "<span class='mif-info'></span>",
                    height: 500,
                    btnMin: false,
                    btnMax: false,
                    onClose: () => {
                        this.selectCohort(undefined);
                    },
                    content: `<table class="table striped row-hover"><tbody id="cohortInfoBody">${content}</tbody></table>`
                });
            } else {
                cohortInfoBody.innerHTML = content;
            }
        }
    }

    /**
     * Convenience function to get the data for the currently selected cohort
     * @returns data
     */
    getSelectedCohortData() {
        const cohort = this.getCohortById(this.selectedCohortId);
        return {
            ...cohort.timeSteps.get(this.currentYear),
            yearOfBirth: cohort.yearOfBirth,
            yearOfDeath: cohort.yearOfDeath,
        };
    }

    /**
     * Find the cohort that matches the given cohort ID
     * @param {number} cohortId
     * @returns {Cohort} cohort
     */
    getCohortById(cohortId) {
        for (const patch of this.patches.values()) {
            if (patch.cohorts.has(cohortId)) {
                return patch.cohorts.get(cohortId);
            }
        }
    }

    /**
     * Select cohort by cohortID
     * @param {number} cohortId
     */
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

    /**
     * Go to the next year of the trajectory, skipping years that we do not
     * have data for.
     */
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

    /**
     * Go to the previous year of the trajectory, skipping years that we do not
     * have data for.
     */
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

    /**
     * Function for creating the interpolated, smooth terrain mesh
     * @param {number} slices Number of length-wise divisions for the parametric geometry
     * @param {number} stacks Number of width-wise divisions for the parametric geometry
     * @returns {{mesh: THREE.Mesh, surfaceMap: function(THREE.Vector3, Patch): number}}
     */
    drawSmoothTerrain(slices=20, stacks=20) {
        // Extract corner positions from patches
        const positions = [...this.patches.values()].flatMap(p=>[
            p.meshes.position,
            new THREE.Vector3(p.sideLength, 0, 0).add(p.meshes.position),
            new THREE.Vector3(0, 0, p.sideLength).add(p.meshes.position),
            new THREE.Vector3(p.sideLength, 0, p.sideLength).add(p.meshes.position),
        ]);


        // Sort by x primarily, then by z if x values are equal
        // This avoids misformed terrain in some cases
        positions.sort((a,b)=>{
            if (a.x<b.x) return -1;
            if (a.x>b.x) return 1;
            if (a.z<b.z) return -1;
            if (a.z>b.z) return 1;
        });

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
            color: new THREE.Color(0x95c639)
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