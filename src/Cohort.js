import * as THREE from 'three';
import {drawInstances, updateAllInstances} from "./draw.js";

class Cohort {
    constructor() {
        // Store all timesteps in a map from year to CohortTimestep
        this.timeSteps = new Map();

        // Set to infinities so that max and min work correctly
        this.yearOfBirth = Infinity;
        this.yearOfDeath = -Infinity;
    }

    addStep(data) {
        console.assert(!this.timeSteps.has(data.Year), `Cohort ${idFromData(data)} already has data for year ${data.Year}`);
        this.yearOfBirth = Math.min(this.yearOfBirth, data.Year);
        this.yearOfDeath = Math.max(this.yearOfDeath, data.Year);
        this.timeSteps.set(data.Year,
            new CohortTimestep(data)
        );
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

class CohortManager {
    constructor() {
        this.cohorts = new Map();
        this.currentYear = undefined;
        this.years = new Set();
        this.boleColor = new THREE.Color(0x664228);
    }

    addData(data) {
        if (!this.cohorts.has(idFromData(data))) {
            this.cohorts.set(idFromData(data), new Cohort());
        }
        this.cohorts.get(idFromData(data)).addStep(new CohortTimestep(data));
        this.years.add(data.Year);
    }

    getCohortByInstanceId(instanceId) {
        const cohortIDs = [...this.cohorts.keys()];
        return this.cohorts.get(cohortIDs[instanceId])
    }

    initVis() {
        this.cohortMeshes = new THREE.Group();
        // Setup instancing mesh
        const cohortIDs = [...this.cohorts.keys()];
        const cylinderElements = cohortIDs.map((id, i) => {
            return {
                position: new THREE.Vector3(),
                quaternion: new THREE.Quaternion(),
                scale: new THREE.Vector3(),
                color: new THREE.Color()
            }
        });
        const geometry = new THREE.CylinderGeometry(.5, .5, 1, 8);
        this.cylinders = drawInstances(geometry, cylinderElements, THREE.MeshLambertMaterial)
        this.cohortMeshes.add(this.cylinders);
    }

    setYear(year) {
        console.log(`Showing year ${year}`)
        const cohortIDs = [...this.cohorts.keys()];
        const cylinderElements = cohortIDs.map((id, i)=>{
            // Don't show anything if cohort doesn't exist that year
            if (!this.cohorts.get(id).timeSteps.has(year)) {
                return {
                    position: new THREE.Vector3(),
                    quaternion: new THREE.Quaternion(),
                    scale: new THREE.Vector3(),
                    color: new THREE.Color()
                }
            }
            // Update from data
            const data = this.cohorts.get(id).timeSteps.get(year);
            return {
                position: new THREE.Vector3(
                    // TODO: update positioning
                    i, data.Height/2, data.PID
                ),
                quaternion: new THREE.Quaternion(),
                scale: new THREE.Vector3(
                    data.Diam,
                    data.Height,
                    data.Diam
                ),
                color: this.boleColor
            }
        });
        updateAllInstances(this.cylinders, cylinderElements);
        this.currentYear = year
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