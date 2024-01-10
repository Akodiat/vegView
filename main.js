import * as THREE from 'three';
import {MapControls} from './libs/OrbitControls.js';
import {CohortManager} from './src/Cohort.js';

let camera, scene, renderer, controls;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const cohortManager = new CohortManager();

init();
render();

// Initialise scene

function init() {
    // Setup renderer
    renderer = new THREE.WebGLRenderer({
        alpha: true, antialias: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const container = document.getElementById('container');
    container.appendChild(renderer.domElement);


    // Setup scene and camera
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(2, 2, 10);

    // Setup lights
    const hemiLight = new THREE.HemisphereLight();
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 3);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    // Add x-y-z axis indicator
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    // And camera controls
    controls = new MapControls(camera, renderer.domElement);
    controls.addEventListener('change', render);

    // Update camera aspect ratio on window resize
    window.addEventListener('resize', onWindowResize);

    render();

    const fileInput = document.getElementById("fileInput");
    fileInput.onchange = () => loadFile(fileInput.files[0]);

    // The browser remembers the last input, so this is a shortcut to just
    // load whatever is in the fileInput without going through the Open
    // file dialog. (Just press Enter)
    document.onkeydown = (keyEvent)=>{
        switch (keyEvent.code) {
            case "Enter":
                if (fileInput.files.length > 0) {
                    loadFile(fileInput.files[0]);
                    keyEvent.preventDefault();
                }
                break;
            default:
                break;
        }
    }
}

function loadFile(file) {
    file.text().then(text=>{
        // Helper function to parse whitespace-separated values from line
        const getVals = l => l.split(" ").filter(c=>c!=="");

        // Proces header and lines;
        const lines = text.split(/[\r\n]+/);
        const header = getVals(lines[0]);
        let minYear = Infinity;
        let maxYear = -Infinity
        for (const line of lines.slice(1)) {
            if (line !== "") {
                const lineVals = getVals(line);
                let item = {};
                header.forEach((h, i) => item[h] = parseFloat(lineVals[i]))
                cohortManager.addData(item);

                minYear = Math.min(minYear, item.Year)
                maxYear = Math.max(maxYear, item.Year)
            }
        }

        // Setup timeline range slider
        const timeline = document.getElementById("timeline");
        const timelineYearLabel = document.getElementById("timelineYearLabel");
        timeline.min = minYear;
        timeline.max = maxYear;

        // Start at the first year in the range
        timeline.value = minYear;
        timelineYearLabel.innerHTML = timeline.value;

        // Update year when the timeline is manipulated
        timeline.oninput = () => {
            timelineYearLabel.innerHTML = timeline.value;
            cohortManager.setYear(timeline.valueAsNumber);
            render()
        }

        // Setup visualisation
        cohortManager.initVis();
        cohortManager.setYear(minYear);
        scene.add(cohortManager.cohortMeshes);

        // New keybindings, for when the data is loaded
        document.onkeydown = (keyEvent)=>{
            switch (keyEvent.code) {
                case "ArrowLeft":
                    cohortManager.prevYear();
                    render();
                    timeline.value = cohortManager.currentYear;
                    timelineYearLabel.innerHTML = cohortManager.currentYear;
                    break;
                case "ArrowRight":
                    cohortManager.nextYear(); render();
                    timeline.value = cohortManager.currentYear;
                    timelineYearLabel.innerHTML = cohortManager.currentYear;
                    break;
                default:
                    break;
            }
        }

        window.addEventListener('dblclick', event => {
            // calculate pointer position in normalized device coordinates
            // (-1 to +1) for both components
            pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
            pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;
            // update the picking ray with the camera and pointer position
            raycaster.setFromCamera(pointer, camera);
            // calculate objects intersecting the picking ray
            const intersection = raycaster.intersectObject(cohortManager.cohortMeshes);
            if (intersection.length > 0) {
                // Select clicked cohort
                const instanceId = intersection[0].instanceId;
                cohortManager.selectCohort(instanceId)
            } else {
                // Clear selection
                cohortManager.selectCohort(undefined)
            }
            cohortManager.drawCohortInfo();
            render();
        });
        render();
    })

    document.getElementById("fileUploadContainer").style.display = "none";
    document.getElementById("timelineContainer").style.display = "block";
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    render();
}

function render() {
    renderer.render(scene, camera);
}