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
        this.cellSide = 0.3;

        this.positionedYears = new Set();

        const minGrassThickness = 1;
        const grassGeometry = new THREE.BoxGeometry(
            this.sideLength,
            this.Pheight + minGrassThickness,
            this.sideLength
        );

        this.noGrassColor = new THREE.Color(0x664228)
        this.grassColor = new THREE.Color(0x95c639);
        const grassMaterial = new THREE.MeshStandardMaterial({color: this.grassColor});
        this.grassMesh = new THREE.Mesh(grassGeometry, grassMaterial);
        this.grassMesh.position.set(
            this.sideLength / 2,
            -this.Pheight/2 - minGrassThickness/2,
            this.sideLength / 2
        );
        this.grassMesh.receiveShadow = true;
        this.grassMesh.name = `patch_${PID}_grassMesh`;
    }

    initTreePositions(year) {
        this.availableCells.set(year, []);
        this.allCells.set(year, []);

        // Divide the patch into list of available cells
        for (let x=0; x<this.sideLength; x+=this.cellSide) {
            for (let y=0; y<this.sideLength; y+=this.cellSide) {
                const cell = new PatchCell(x, y);
                this.allCells.get(year).push(cell);
                this.availableCells.get(year).push(cell);
            }
        }
    }

    updateTreePositions(year) {
        // Only need to do this once per year
        if (this.positionedYears.has(year)) {
            return;
        }

        // The year might be initialised with cells, but with no
        // positions. So don't overvrite anything
        if (!this.availableCells.has(year)) {
            this.availableCells.set(year, []);
        }
        if (!this.allCells.has(year)) {
            this.allCells.set(year, []);
        }

        // Use positions from a previous year if we have them
        const prevYears = [...this.positionedYears.values()].filter(y => y < year);
        if (prevYears.length > 0) {
            // Get most recent year and copy cells
            const lastYear = Math.max(...prevYears);
            for (const c of this.allCells.get(lastYear)) {
                // Don't use positions for cohorts that will be removed
                if (c.occupyingCohort === undefined || c.occupyingCohort.timeSteps.has(year)) {
                    this.allCells.get(year).push(c.clone());
                }
            }
            //this.allCells.set(year, this.allCells.get(lastYear).map(c=>c.clone()));
            this.availableCells.set(
                year, this.allCells.get(year).filter(c=>(
                    c.occupyingCohort === undefined &&
                    c.occupyingInstance === undefined
                )
            ));
            for (const c of this.cohorts.values()) {
                // Also copy positions (instead of starting from scratch)
                if (c.timeSteps.has(year) && c.timeSteps.has(lastYear)) {
                    c.timeSteps.get(lastYear).positions.forEach((cell, instanceId)=> {
                        c.timeSteps.get(year).positions.set(instanceId, cell)
                    })
                }
            }
        }

        // Get cohort array that we can filter and sort
        let cohorts = [...this.cohorts.values()];
        // Ignore grass and cohorts not present this year
        cohorts = cohorts.filter(c=> !c.isGrass && c.timeSteps.has(year));
        // Update cohorts with the largest trees first
        cohorts.sort((a,b) => b.timeSteps.get(year).CrownA - a.timeSteps.get(year).CrownA);

        // Remove any extra trees in each cohort
        for (const cohort of cohorts) {
            const d = cohort.timeSteps.get(year);
            const nTreesInCohort = d.DensI * cohort.maxTreeCount;

            // If we have more tree positions defined than we should
            if (d.positions.size > nTreesInCohort) {
                console.log(`Removing ${d.positions.size - nTreesInCohort} trees from cohort ${d.IID}, patch ${d.PID}`);
                for (let i=nTreesInCohort; i<d.positions.size; i++) {
                    d.positions.delete(i);
                }
                // Mark cells as available
                this.allCells.get(year).forEach(c=>{
                    if (c.occupyingCohort !== undefined &&
                        idFromData(c.occupyingCohort) === idFromData(d) &&
                        c.occupyingInstance >= nTreesInCohort
                    ) {
                        c.occupyingCohort = undefined;
                        c.occupyingInstance = undefined;
                    }
                });
                this.availableCells.set(year,
                    this.allCells.get(year).filter(c => (
                        c.occupyingCohort === undefined &&
                        c.occupyingInstance === undefined
                    )
                ));
                console.log(`Available cells: ${this.availableCells.get(year).length}`)
            }
        }

        // Add new trees in each cohort
        for (const cohort of cohorts) {
            const d = cohort.timeSteps.get(year);
            const nTreesInCohort = d.DensI * cohort.maxTreeCount;

            if (d.positions.size < nTreesInCohort) {
                console.log(`Adding ${nTreesInCohort - d.positions.size} trees to cohort ${d.IID}, patch ${d.PID}`);
            }

            while (d.positions.size < nTreesInCohort) {
                const crownRadius = Math.sqrt(d.CrownA/Math.PI);
                const tree = {
                    data: d,
                    crownRadius: crownRadius,
                    instanceId: d.positions.size
                }
                // Choose an available cell at random
                let cell = randItem(this.availableCells.get(year));

                if (cell === undefined) {
                    console.warn("No more space to place trees");
                    cell = randItem(this.allCells.get(year));
                }

                // Mark cells as occupied
                this.availableCells.set(year,
                    this.availableCells.get(year).filter(
                        c => cell.distanceTo(c) > tree.crownRadius * this.allowedOverlap
                    )
                );
                for (const c of this.allCells.get(year)) {
                    if (c.distanceTo(cell) <= tree.crownRadius * this.allowedOverlap) {
                        c.occupyingCohort = cohort;
                        c.occupyingInstance = tree.instanceId;
                    }
                }
                d.positions.set(tree.instanceId, cell);
            }
            console.log(`Available cells: ${this.availableCells.get(year).length}`)
        }
        this.positionedYears.add(year);
    }
}

export {Patch}