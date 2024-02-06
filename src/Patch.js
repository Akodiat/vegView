import * as THREE from 'three';
import {randItem} from './utils.js';
import {idFromData} from './Cohort.js';

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
    constructor(PID, Px, Py, Pheight, margin = 1) {
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


        const minGrassThickness = 1;
        const grassGeometry = new THREE.BoxGeometry(
            this.sideLength,
            this.Pheight + minGrassThickness,
            this.sideLength
        );

        this.noGrassColor = new THREE.Color(0x664228)
        this.grassColor = new THREE.Color(0x75ff66);
        const grassMaterial = new THREE.MeshLambertMaterial({color: this.grassColor});
        this.grassMesh = new THREE.Mesh(grassGeometry, grassMaterial);
        this.grassMesh.position.set(
            this.Px * this.sideLength * margin - this.sideLength/2,
            this.Pheight / 2 - minGrassThickness/2,
            this.Py * this.sideLength * margin - this.sideLength/2
        );
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

export {Patch}