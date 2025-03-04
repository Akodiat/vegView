import * as THREE from "three";
import {drawInstances} from "./draw.js";
import {emptyElem} from "./utils.js";

class Cohort {
    /**
     * Class for storing cohort data
     * @param {*} data
     */
    constructor(data) {
        this.SID = data.SID;
        this.PID = data.PID;
        this.IID = data.IID;
        this.PFT = data.PFT;

        this.isGrass = (
            data.Height === 0 &&
            data.Boleht === 0 &&
            data.Diam === 0 &&
            data.CrownA === 1 &&
            data.DensI === 1
        );

        if (this.isGrass) {
            console.log("grass");
        }

        // Store all timesteps in a map from year to CohortTimestep
        this.timeSteps = new Map();

        // Set to infinities so that max and min work correctly
        this.yearOfBirth = Infinity;
        this.yearOfDeath = -Infinity;

        this.maxTreeCount = 1000;
    }

    /**
     * Add data from a timestep
     * @param {{
     * Lon: number, Lat: number, Year: number, SID: number, PID: number,
     * IID: number, PFT: number, Age: number, Pos: number, Height: number,
     * Boleht: number, Diam: number, CrownA: number, DensI: number,
     * LAI: number, GPP: number, GPPns: number, GPPno: number, Cmass: number
     * }} data Cohort data
     */
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
        this.treeMeshes.name = idFromData(this)+"_treeMeshes";
        const elems = [];
        for (let iTree=0; iTree<this.maxTreeCount; iTree++) {
            elems.push(emptyElem);
        }

        this.instancedBoles = drawInstances(
            undefined, elems,
            new THREE.MeshPhongMaterial()
        );
        this.instancedBoles.cohortId = idFromData(this);

        this.instancedCrowns = drawInstances(
            undefined, elems,
            new THREE.MeshPhongMaterial()
        );
        this.instancedCrowns.cohortId = idFromData(this);
        this.treeMeshes.add(this.instancedBoles);
        this.treeMeshes.add(this.instancedCrowns);

        this.instancedBoles.castShadow = true;
        this.instancedBoles.receiveShadow = false;
        this.instancedCrowns.castShadow = true;
        this.instancedCrowns.receiveShadow = false;
    }
}

class CohortTimestep {
    // Lon: Longitude
    // Lat: Latitude
    // Year: Year
    // SID: Stand ID
    // PID: Patch ID
    // IID: Cohort ID
    // PFT: Plant Functional Type ID
    // Age: Age of cohort
    // Pos: Center position of cohort [0//1]
    // Height: Height of tree
    // Boleht: Bole (stem) height of tree
    // Diam: Diameter of stem (m)
    // CrownA: Crown area (m2)
    // DensI: Density of trees in cohort (trees m//2)
    // LAI: Leaf Area Index (m2 m//2)
    // GPP: Gross Primary Production (kg C m//2 yr//1)
    // GPPns: Gross Primary Production with N stress (kg C m//2 yr//1)
    // GPPno: Gross Primary Production with no stress (kg C m//2 yr//1)
    // Cmass: Total C mass of cohort (kg C m//2)

    /**
     *
     * @param {{
     * Lon: number, Lat: number, Year: number, SID: number, PID: number,
     * IID: number, PFT: number, Age: number, Pos: number, Height: number,
     * Boleht: number, Diam: number, CrownA: number, DensI: number,
     * LAI: number, GPP: number, GPPns: number, GPPno: number, Cmass: number
     * }} data Cohort data
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
    return `${data.SID}:${data.PID}:${data.IID}`;
}

export {Cohort, CohortTimestep, idFromData};