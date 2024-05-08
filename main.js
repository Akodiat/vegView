import * as THREE from "three";
import {MapControls} from "./libs/OrbitControls.js";
import {VegaPlotter} from "./src/plot.js";
import {getClosestOpaque, exportGLTF} from "./src/utils.js";
import {loadData} from "./src/loadData.js";
import {Api} from "./src/api.js";

let camera, scene, renderer, controls;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

init();

// Initialise scene
function init() {
    // Setup renderer
    renderer = new THREE.WebGLRenderer({
        alpha: true, antialias: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    const container = document.getElementById("container");
    container.appendChild(renderer.domElement);


    // Setup scene and camera
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(2, 2, 10);

    // Needed to make objects attached to
    // the camera (legend) visible.
    scene.add(camera);

    // Setup hemisphere and ambient lights
    // Directional light is setup later, when we know where to point it
    const hemiLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.75);
    scene.add(hemiLight);

    const ambientLight = new THREE.AmbientLight( 0x404040, 1); // soft white light
    scene.add(ambientLight);

    // Add x-y-z axis indicator
    //const axesHelper = new THREE.AxesHelper(5);
    //scene.add(axesHelper);

    // And camera controls
    controls = new MapControls(camera, renderer.domElement);
    controls.addEventListener("change", render);

    // Update camera aspect ratio on window resize
    window.addEventListener("resize", onWindowResize);

    // Open the dialog to load data if the user clicks the empty scene
    // eslint-disable-next-line no-undef
    const openDataLoadDialog = ()=>Metro.dialog.open("#dataLoadDialog");
    container.addEventListener("click", openDataLoadDialog);

    render();

    // Load data when file is uploaded
    const fileInput = document.getElementById("fileInput");
    const dataLoadButton = document.getElementById("dataLoadButton");
    dataLoadButton.onclick = () => {
        loadData(fileInput.files).then(
            patchManager=>{
                // We can now remove this listener, since data is loaded
                container.removeEventListener("click", openDataLoadDialog);

                window.api = new Api(camera, scene, renderer, controls, patchManager);
                window.THREE = THREE;
                onDataLoaded(patchManager);
            }
        );
    };

    // The browser remembers the last input, so this is a shortcut to just
    // load whatever is in the fileInput without going through the Open
    // file dialog. (Just press Enter)
    document.onkeydown = (keyEvent)=>{
        switch (keyEvent.code) {
        case "Enter":
            if (fileInput.files.length > 0) {
                loadData(fileInput.files).then(
                    patchManager=>{
                        window.api = new Api(camera, scene, renderer, controls, patchManager);
                        onDataLoaded(patchManager);
                    }
                );
                keyEvent.preventDefault();
            }
            break;
        default:
            break;
        }
    };
}

function onDataLoaded(patchManager) {
    // Firefox can keep a previous checkbox state through reload
    // so let's set the values accordingly
    patchManager.detailedTrees = document.getElementById("detailedTrees").checked;
    patchManager.smoothTerrain = document.getElementById("smoothTerrain").checked;

    // Setup timeline range slider
    const timelineYearLabel = document.getElementById("timelineYearLabel");

    // Start at the first year in the range
    timelineYearLabel.innerHTML = patchManager.minYear;

    // Setup visualisation
    patchManager.initVis(patchManager.minYear);
    patchManager.setYear(patchManager.minYear);
    scene.add(patchManager.patchMeshes);


    const patchesCentre = patchManager.calcPatchesCentre();
    controls.target.copy(patchesCentre);
    controls.update();

    // Setup directional light and point it at centre.
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(0, 100, 0);
    dirLight.target.position.copy(patchesCentre);
    dirLight.castShadow = true;

    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 200;
    dirLight.shadow.camera.left = -100;
    dirLight.shadow.camera.right = 100;
    dirLight.shadow.camera.top = 100;
    dirLight.shadow.camera.bottom = -100;

    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.radius = 2;
    scene.add(dirLight);
    scene.add(dirLight.target);

    //const cameraHelper = new THREE.CameraHelper(dirLight.shadow.camera);
    //scene.add(cameraHelper);

    // New keybindings, for when the data is loaded
    document.onkeydown = (keyEvent)=>{
        switch (keyEvent.code) {
        case "ArrowLeft":
            patchManager.prevYear();
            render();
            timelineYearLabel.innerHTML = patchManager.currentYear;
            break;
        case "ArrowRight":
            patchManager.nextYear(); render();
            timelineYearLabel.innerHTML = patchManager.currentYear;
            break;
        case "KeyE":
            if (keyEvent.ctrlKey) {
                exportGLTF(scene);
                keyEvent.preventDefault();
            }
            break;
        default:
            break;
        }
    };

    // Setup plotting
    const plotter = new VegaPlotter(patchManager, year=>{
        timelineYearLabel.innerHTML = year;
        patchManager.setYear(year);
        render();
    });
    plotter.timePlot();
    const yFieldSelect = document.getElementById("yFieldSelect");
    const aggregateSelect = document.getElementById("aggregateSelect");
    const colorFieldSelect = document.getElementById("colorFieldSelect");
    const updatePlot = () => {
        plotter.timePlot(
            yFieldSelect.value,
            aggregateSelect.value,
            colorFieldSelect.value
        );
    };
    yFieldSelect.onchange = aggregateSelect.onchange = colorFieldSelect.onchange = updatePlot;

    // Select cohorts when clicked
    window.addEventListener("dblclick", event => {
        // calculate pointer position in normalized device coordinates
        // (-1 to +1) for both components
        pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;
        // update the picking ray with the camera and pointer position
        raycaster.setFromCamera(pointer, camera);
        // calculate objects intersecting the picking ray
        const intersection = raycaster.intersectObject(patchManager.patchMeshes);
        if (intersection.length > 0) {
            // Select clicked cohort
            const closest = getClosestOpaque(intersection); //intersection[0]
            patchManager.selectCohort(
                closest.object.cohortId
            );
        } else {
            // Clear selection
            patchManager.selectCohort(undefined);
        }
        patchManager.drawCohortInfo();
        render();
    });
    render();
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