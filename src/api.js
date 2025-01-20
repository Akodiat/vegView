import * as THREE from "three";
import {notify, exportGLTF, saveString} from "./utils.js";
import {HTMLMesh} from "../libs/interactive/HTMLMesh.js";
import {Lut, ColorMapKeywords} from "../libs/math/Lut.js";

class Api {
    /**
     * An api object is included in the global scope so that it can be called
     * from the developer console.
     * @param {THREE.Camera} camera
     * @param {THREE.Scene} scene
     * @param {THREE.Renderer} renderer
     * @param {MapControls} controls
     * @param {PatchManager} patchManager
     */
    constructor(camera, scene, orthoCamera, uiScene, renderer, controls, patchManager) {
        this.camera = camera;
        this.scene = scene;
        this.orthoCamera = orthoCamera;
        this.uiScene = uiScene;
        this.renderer = renderer;
        this.controls = controls;
        this.patchManager = patchManager;
        this.timelineYearLabel = document.getElementById("timelineYearLabel");

        const data = {};
        for (const v in ColorMapKeywords) {
            data[v] = v;
        }

        // Populate color map selects
        for (const s of ["#stemColorMapSelect", "#crownColorMapSelect"]) {
            // eslint-disable-next-line no-undef
            const select = $(s).data("select");
            select.data(data);
        }

        [
            "ColorSelect",
            "ColorMapSelect",
            "ColorLegendLabel",
            "ColorLegendXPos",
            "ColorLegendYPos",
            "ColorLegendVertical"
        ].forEach(idSuffix=> {
            document.getElementById("stem"+idSuffix).addEventListener("change", ()=>this.setStemColorMapFromUI());
            document.getElementById("crown"+idSuffix).addEventListener("change", ()=>this.setCrownColorMapFromUI());
        });
    }

    render() {
        this.renderer.autoClear = true;

        this.renderer.render(this.scene, this.camera);

        // Prevent canvas from being erased with next render call
        this.renderer.autoClear = false;

        this.renderer.render(this.uiScene, this.orthoCamera);
    }

    setStemColorMapFromUI() {
        const attributeSelect = document.getElementById("stemColorSelect");
        const colorMapSelect = document.getElementById("stemColorMapSelect");

        const colorLegendLabel = document.getElementById("stemColorLegendLabel");
        const colorLegendXPos = document.getElementById("stemColorLegendXPos");
        const colorLegendYPos = document.getElementById("stemColorLegendYPos");
        const colorLegendVertical = document.getElementById("stemColorLegendVertical");
        this.setStemColorMap(
            attributeSelect.value,
            colorMapSelect.value,
            new THREE.Vector2(
                Number.parseFloat(colorLegendXPos.value),
                Number.parseFloat(colorLegendYPos.value)
            ),
            colorLegendLabel.value,
            colorLegendVertical.checked
        );
        colorMapSelect.disabled = attributeSelect.value === "PFT";
    }

    setCrownColorMapFromUI() {
        const attributeSelect = document.getElementById("crownColorSelect");
        const colorMapSelect = document.getElementById("crownColorMapSelect");

        const colorLegendLabel = document.getElementById("crownColorLegendLabel");
        const colorLegendXPos = document.getElementById("crownColorLegendXPos");
        const colorLegendYPos = document.getElementById("crownColorLegendYPos");
        const colorLegendVertical = document.getElementById("crownColorLegendVertical");
        this.setCrownColorMap(
            attributeSelect.value,
            colorMapSelect.value,
            new THREE.Vector2(
                Number.parseFloat(colorLegendXPos.value),
                Number.parseFloat(colorLegendYPos.value)
            ),
            colorLegendLabel.value,
            colorLegendVertical.checked
        );
        colorMapSelect.disabled = attributeSelect.value === "PFT";
    }

    /**
     * Color stems or crowns by a data attribute.
     * @param {string} target Either "stem" or "crown"
     * @param {string} attribute Data column from the input file, e.g. "Diam"
     * @param {string} colorMap A matplotlib color map name
     * @param {THREE.Vector2} legendPosition Position of the legend, where (0,0) is the center of the canvas and one unit is the horisontal distance from the center to the canvas edge.
     * @param {string} legendLabel Legend label
     * @param {boolean} verticalLegend If set to true, the legend will be vertical, otherwise horisontal.
     */
    setColorMap(
        target, attribute, colorMap = "rainbow",
        legendPosition = new THREE.Vector2(),
        legendLabel = undefined,
        verticalLegend = false,
    ) {
        if (target === undefined) {
            console.error(`Target ${target} unknown, must be "stem" or "crown"!`);
        }
        if (attribute === undefined || attribute === "PFT") {
            this.patchManager[target+"ColorMap"] = undefined;
            this.uiScene.remove(this[target+"LegendGroup"]);
        } else {
            const lut = this.calcLut(attribute, colorMap);
            this.patchManager[target+"ColorMap"] = {
                lut: lut,
                attribute: attribute
            };

            this.uiScene.remove(this[target+"LegendGroup"]);
            this[target+"LegendGroup"] = new THREE.Group();
            this.uiScene.add(this[target+"LegendGroup"]);

            // Set normalised position of the legend
            this[target+"LegendGroup"].position.x = legendPosition.x * this.orthoCamera.right;
            this[target+"LegendGroup"].position.y = legendPosition.y * this.orthoCamera.right;

            if (legendLabel === undefined || legendLabel === "") {
                legendLabel = `${attribute} (${target} color)`;
            }

            let labelParams = {
                "title": legendLabel,
                //"um": "Stem",
                "ticks": 5
            };

            let legend;
            if (verticalLegend) {
                legend = lut.setLegendOn();
            } else {
                legend = lut.setLegendOn({layout: "horizontal"});
            }
            this[target+"LegendGroup"].add(legend);
            let labels = lut.setLegendLabels(labelParams, undefined, ()=>this.render());
            this[target+"LegendGroup"].add(labels["title"]);
            for (let i = 0; i < Object.keys(labels["ticks"]).length; i++) {
                this[target+"LegendGroup"].add(labels["ticks"][i]);
                this[target+"LegendGroup"].add(labels["lines"][i]);
            }

            this.uiScene.addEventListener("updateColor", function() {
                lut.updateCanvas(legend.material.map.image);
                legend.material.map.needsUpdate = true;
            });
        }
        this.redraw();
    }

    /**
     * Color stems by a data attribute. Call without arguments to clear.
     * @param {string} attribute Data column from the input file, e.g. "Diam"
     * @param {string} colorMap A matplotlib color map name
     * @param {THREE.Vector2} legendPosition Position of the legend, where (0,0) is the center of the canvas and one unit is the horisontal distance from the center to the canvas edge.
     * @param {string} legendLabel Legend label
     * @param {boolean} verticalLegend If set to true, the legend will be vertical, otherwise horisontal.
     */
    setStemColorMap(
        attribute, colorMap="rainbow",
        legendPosition=new THREE.Vector2(),
        legendLabel = undefined,
        verticalLegend = false
    ) {
        this.setColorMap("stem", attribute, colorMap, legendPosition, legendLabel, verticalLegend);
    }

    /**
     * Color crowns by a data attribute. Call without arguments to clear.
     * @param {string} attribute Data column from the input file, e.g. "Height"
     * @param {string} colorMap A matplotlib color map name
     * @param {THREE.Vector2} legendPosition Position of the legend, where (0,0) is the center of the canvas and one unit is the horisontal distance from the center to the canvas edge.
     * @param {string} legendLabel Legend label
     * @param {boolean} verticalLegend If set to true, the legend will be vertical, otherwise horisontal.
     */
    setCrownColorMap(attribute, colorMap="rainbow",
        legendPosition=new THREE.Vector2(),
        legendLabel = undefined,
        verticalLegend = false
    ) {
        this.setColorMap("crown", attribute, colorMap, legendPosition, legendLabel, verticalLegend);
    }

    calcLut(attribute, colorMap="rainbow") {
        let max = -Infinity;
        let min = Infinity;
        for (const patch of this.patchManager.patches.values()) {
            for (const cohort of patch.cohorts.values()) {
                for (const t of cohort.timeSteps.values())  {
                    max = Math.max(t[attribute], max);
                    min = Math.min(t[attribute], min);
                }
            }
        }

        // Lut cannot define color if they are the same
        if (max === min) {
            max++;
            min--;
        }

        const lut = new Lut(colorMap);
        lut.setMin(min);
        lut.setMax(max);

        return lut;
    }

    /**
     * Set the number of times branches should split.
     * Be aware that high values will make the visualisation
     * really slow and might cause the WebGL context to crash.
     * @param {number} levels Number of divisions per tree branch
     */
    setDetailedTreeFactor(levels) {
        this.patchManager.detailedTreeFactor = levels;
        this.redraw();
    }

    /**
     * Toggle between detailed and simple tree visualisation
     * @param {boolean} detailed True for detailed trees
     */
    setTreeDetail(detailed) {
        this.patchManager.detailedTrees = detailed;
        this.redraw();
    }

    /**
     * Toggle between constant patch heights for each patch, or a smooth
     * interpolated surface connecting the patches.
     * @param {boolean} smooth True for interpolated terrain
     */
    setTerrainSmoothness(smooth) {
        this.patchManager.smoothTerrain = smooth;
        this.redraw();
    }

    /** Redraw the patches */
    redraw() {
        this.patchManager.setYear(this.patchManager.currentYear);
        this.render();
    }

    /**
     * Updates the distance between patches
     * @param {number} patchMargins A factor to distance patches from each
     * other. A value of 1 means no margin. A value of 1.2 means 20% margin.
     */
    updateMargins(patchMargins) {
        this.patchManager.updateMargins(patchMargins);
        this.render();
    }

    /**
     * Go to the previous year (if any)
     */
    prevYear() {
        this.patchManager.prevYear();
        this.timelineYearLabel.innerHTML = this.patchManager.currentYear;
        this.render();
    }

    /**
     * Go to the next year (if any)
     */
    nextYear() {
        this.patchManager.nextYear();
        this.timelineYearLabel.innerHTML = this.patchManager.currentYear;
        this.render();
    }


    /**
     * Starts going through the trajectory
     * @return {function(): void} Function to stop the playback.
     */
    playTrajectory() {
        let stop = false;
        const button = document.getElementById("trajectoryStartButton");
        button.innerHTML = "<span class='mif-stop icon'></span>";
        const stopFunction = ()=>{
            stop = true;
        };

        button.onclick = stopFunction;

        const lastYear = Math.max(...this.patchManager.years);
        const step = () => {
            if (this.patchManager.currentYear >= lastYear || stop) {
                button.onclick = ()=>{this.playTrajectory();};
                // eslint-disable-next-line quotes
                button.innerHTML = "<span class='mif-play icon'></span>";
            } else {
                this.nextYear();
                requestAnimationFrame(step);
            }
        };
        step();
        return stopFunction;
    }

    /**
     * Scales the HTML canvas (used for higher resolution
     * in image and video export).
     * You are meant to scale it back again when the export
     * is done, otherwise things will look odd.
     * @param {number} scalingFactor Multiplier to scale the canvas with
     */
    scaleCanvas(scalingFactor=2) {
        const canvas = this.renderer.domElement;
        const width = canvas.width;
        const height = canvas.height;
        canvas.width = width*scalingFactor;
        canvas.height = height*scalingFactor;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(canvas.width, canvas.height);
        this.render();
    }

    /**
     * Export a CSV file containing all the data
     * (including individual tree coordinates)
     * @param {string} delimiter Set it to "," for CSV, "\t" for TSV, etc.
     */
    exportCSV(delimiter = ",") {
        const data = [];
        for (const patch of this.patchManager.patches.values()) {
            for (const cohort of patch.cohorts.values()) {
                for (const [year, timestep] of cohort.timeSteps.entries()) {
                    for (const p of timestep.positions.values()) {
                        const d = {
                            x: p.x.toFixed(3),
                            y: p.y.toFixed(3),
                            z: this.patchManager.detailedTerrainMap(p, patch),
                            TID: p.occupyingInstance,
                            ...timestep,
                            ...this.patchManager.yearData.get(year)
                        };
                        delete d.positions;
                        data.push(d);
                    }
                }
            }
        }

        // Sort chronologically
        data.sort((a, b) => a.Year - b.Year);

        const keys = Object.keys(data[0]);
        const header = keys.join(delimiter);
        const lines = [header, ...data.map(
            d=>keys.map(k=>d[k]).join(delimiter)
        )];

        saveString(
            lines.join("\n"),
            this.patchManager.datasetName+".csv"
        );
    }

    /**
     * Export the scene as a glTF/glb 3D shape file.
     * @param {THREE.Scene} scene Scene to export
     * @param {boolean} binary Set to true for binary glb or false for plaintext glTF
     * @param {string} name Name for the file @default this.patchManager.datasetName
     */
    exportGLTF(scene=this.scene, binary=false, name=this.patchManager.datasetName) {
        exportGLTF(scene, binary, name);
    }

    /**
     * Export image of the current view
     * @param {number} scaleFactor Multiplier to for higher resolution
     */
    exportImage(scaleFactor) {
        if (scaleFactor === undefined) {
            scaleFactor = parseFloat((document.getElementById("exportImageScalingFactor")).value);
        }

        let saveImage = () => {
            this.renderer.domElement.toBlob(blob => {
                var a = document.createElement("a");
                var url = URL.createObjectURL(blob);
                a.href = url;
                a.download = this.patchManager.datasetName+".png";
                setTimeout(() => a.click(), 10);
            }, "image/png", 1.0);
        };

        // First scale the canvas with the provided factor, then scale it back.
        new Promise(resolve => {
            this.scaleCanvas(scaleFactor);
            resolve("success");
        }).then(() => {
            try {
                saveImage();
            } catch (error) {
                notify("Canvas is too large to save, please try a smaller scaling factor", "alert");
            }
            this.scaleCanvas(1/scaleFactor);
        });
    }

    /**
     * Toggle the PFT legend on or off
     * @param {boolean} visible
     */
    setPFTLegendVisibility(visible) {
        if (visible) {
            this.showPFTLegend();
        } else {
            this.hidePFTLegend();
        }
    }

    /**
     * Hide the PFT legend
     */
    hidePFTLegend() {
        this.camera.remove(this.legend);
        this.legend = undefined;
        this.render();
    }

    /**
     * Show a PFT legend in the scene. An HTML mesh is used instead of a normal
     * HTML element so that the legend can be visible in exported images
     * @param {number} scale Scale down (and use a large font size) to gain resolution
     * @param {number} fontSize Increase (and use a smaller scale) to gain resolution
     * @param {number} distance Distance from camera
     * @param {number} margin Margin from edge
     */
    showPFTLegend(scale = 0.25, fontSize="4em", distance = 1, margin = 1.05) {
        const rows = this.patchManager.pftConstants.map(
            c=>`<tr>
                <td>${c.name}</td>
                <td style="width: 150px; background:#${c.color.getHexString()}"></td>
            </tr>`
        ).filter((c,i)=>this.patchManager.usedPFTs.has(i));
        const legendDiv = document.createElement("table");
        legendDiv.style.fontSize = fontSize;
        legendDiv.style.borderRadius = "15px";
        legendDiv.classList.add("table", "cell-border");
        legendDiv.innerHTML = `
            <tbody>
                ${rows}
            </tbody>`;

        // I have no idea why this is needed
        // but some commas are appended at the end
        while (legendDiv.innerHTML.endsWith(",")) {
            legendDiv.innerHTML = legendDiv.innerHTML.slice(0, -1);
        }

        legendDiv.style.backgroundColor = "white";//"transparent";
        legendDiv.style.position = "fixed";
        legendDiv.style.bottom = 0;
        legendDiv.style.width = "auto";
        document.body.appendChild(legendDiv);

        // Remove any old legend mesh and create a new
        this.camera.remove(this.legend);
        this.legend = new HTMLMesh(legendDiv);

        // Remove the div from the body
        // It was only needed for creating the mesh
        legendDiv.remove();

        // Scale down mesh to gain resolution
        this.legend.scale.multiplyScalar(scale);
        this.camera.add(this.legend);
        this.legend.position.z = -distance;

        // Position to the left of the view
        const positionToLeft = ()=>{
            const verticalFOV = THREE.MathUtils.degToRad(this.camera.fov);
            const visibleHeight = 2 * Math.tan(verticalFOV / 2) * distance;
            const visibleWidth = visibleHeight * this.camera.aspect;
            this.legend.position.x = -visibleWidth/2 + (margin*scale*this.legend.geometry.parameters.width/2);
            this.render();
        };
        positionToLeft();

        // Update position on window resize
        window.addEventListener("resize", positionToLeft);
    }

    /**
     * Show window with PFT editor
     */
    showPFTEditor() {
        const rows = this.patchManager.pftConstants.map(
            (c,i)=>`<tr>
                <td>${i}</td>
                <td>
                    <input onchange="api.patchManager.pftConstants[${i}].name = this.value; api.redraw()" type="text" value="${c.name}">
                </td>
                <td>
                    <select onchange="api.patchManager.pftConstants[${i}].geometry = this.value; api.redraw()">
                        <option value="cone" ${c.geometry === "cone" ? "selected" : ""}>cone</option>
                        <option value="sphere" ${c.geometry === "sphere" ? "selected" : ""}>sphere</option>
                    </select>
                </td>
                <td>
                    <input onchange="api.patchManager.pftConstants[${i}].detailMesh = this.value; api.redraw()" type="text" value="${c.detailMesh}"/>
                </td>
                <td>
                    <input onchange="api.patchManager.pftConstants[${i}].color.set(this.value); api.redraw()" type="color" value="#${c.color.getHexString()}"/>
                </td>
            </tr>
            `
        ).filter(
            // Only list PFTs used
            (c,i)=>this.patchManager.usedPFTs.has(i)
        );
        // eslint-disable-next-line no-undef
        Metro.window.create({
            title: "PFT settings",
            place: "center",
            icon: "<span class='mif-cog'></span>",
            content: `
<table class="table striped">
    <thead>
        <tr>
            <th>PFT</th>
            <th>Name</th>
            <th>Simple shape</th>
            <th>Detailed shape</th>
            <th>Color</th>
        </tr>
    </thead>
    <tbody>
    ${rows}
    </tbody>
</table>
`
        });
    }

    showVideoExportWindow() {
        // eslint-disable-next-line no-undef
        Metro.window.create({
            title: "Export video",
            place: "center",
            icon: "<span class='mif-video-camera'></span>",
            content: `
<form>
<div class="form-group">
    <label>File format:</label>
    <select id="videoExportFormat" data-role="select">
        <option value="webm" selected="selected">webm</option>
        <option value="gif">gif</option>
        <option value="png">png</option>
        <option value="jpg">jpg</option>
    </select>
    <small class="text-muted">Webm is a modern video format that is low in file size, while gif takes significantly more space.<br>If you select png or jpg, the output will be a compressed tar of images.</small>

</div>
<div class="form-group">
    <input type="number" value="10" id="videoFramerate" data-role="input" data-prepend="Frame rate" data-append="fps">
    <small class="text-muted">Number of frames per second (used for webm and gif)</small>
</div>
<div class="form-group">
    <input type="number" value="1" id="videoScaleFactor" data-role="input" data-prepend="Scale factor" data-append="times">
    <small class="text-muted">Increase this to get a higher-resolution video</small>
</div>
</form>
<hr>
<div class="form-group">
    <button class="secondary button" onclick="api.exportOrbitingVideo()">Create orbiting video</button>
    <small class="text-muted">Orbit around the patches while recording the video</small>
</div>
<hr>
<button id="videoExportStartButton" class="primary button" onclick="api.exportVideo()">Start</button>
<div id="videoExportProgress" data-role="progress" data-type="load" data-value="35" style="display: none"></div>
`
        });
    }

    /**
     * Export video where the camera orbits a given target (by default the center of mass)¨
     * while the trajectory advances.
     * Change the window size to get a different aspect ratio.
     * @param {string} format Video format ("webm", "gif", "png", or "jpg"), the latter two being a set of images in a tar file.
     * @param {number} framerate Number of frames per second
     * @param {number} scaleFactor Multiplier to increase the video resolution
     * @param {number} distance Distance to orbit at
     * @param {number} height Height to orbit at
     * @param {number} nOrbits Number of orbits during the whole trajectory
     * @param {THREE.Vector3} target Target to orbit around
     */
    exportOrbitingVideo(format, framerate, scaleFactor, distance=100, height=50, nOrbits=1, target = this.patchManager.calcPatchesCentre()) {
        const cameraPathFunction = progress => {
            // Make a circle
            const position = new THREE.Vector3(
                target.x + distance * Math.cos(progress * nOrbits*2*Math.PI),
                height,
                target.z + distance * Math.sin(progress * nOrbits*2*Math.PI)
            );
            return {position, target};
        };
        this.exportVideo(format, framerate, scaleFactor, cameraPathFunction);
    }

    /**
     * Create a video of the trees growing
     * Change the window size to get a different aspect ratio.
     * @param {string} format Video format ("webm", "gif", "png", or "jpg"),
     * the latter two being a set of images in a tar file.
     * @param {number} framerate Number of frames per second
     * @param {number} scaleFactor Multiplier to increase the video resolution
     * @param {function(number): {Vector3, Vector3}} cameraPathFunction
     * Optional function to move the camera as the trajectory progresses. See
     * exportOrbitingVideo() for example usage.
     */
    exportVideo(format, framerate, scaleFactor, cameraPathFunction) {
        if (format === undefined) {
            format = document.getElementById("videoExportFormat").value;
        }
        if (framerate === undefined) {
            framerate = document.getElementById("videoFramerate").valueAsNumber;
        }
        if (scaleFactor === undefined) {
            scaleFactor = document.getElementById("videoScaleFactor").valueAsNumber;
        }

        let stop = false;
        const button = document.getElementById("videoExportStartButton");
        button.innerText = "Stop";
        button.onclick = ()=>{
            stop = true;
        };

        // eslint-disable-next-line no-undef
        const capturer = new CCapture({
            format: format,
            framerate: framerate,
            name: this.patchManager.datasetName,
            workersPath: "libs/"
        });
        capturer.start();

        this.scaleCanvas(scaleFactor);

        this.scene.background = new THREE.Color(0xFFFFFF);

        const lastYear = Math.max(...this.patchManager.years);
        const firstYear = this.patchManager.currentYear;
        const progressBar = document.getElementById("videoExportProgress");
        progressBar.style.display = "block";

        const step = () => {
            if (this.patchManager.currentYear >= lastYear || stop) {
                capturer.stop();
                capturer.save();
                this.scene.background = null;
                this.scaleCanvas(1/scaleFactor);
                button.onclick = ()=>{this.exportVideo();};
                button.innerText = "Start";
                progressBar.style.display = "none";
            } else {
                this.nextYear();
                const progress = (this.patchManager.currentYear - firstYear) / (lastYear - firstYear);
                if (cameraPathFunction !== undefined) {
                    const s = cameraPathFunction(progress);
                    this.camera.position.copy(s.position);
                    this.controls.target.copy(s.target);
                    this.controls.update();
                }
                this.render();
                capturer.capture(this.renderer.domElement);
                progressBar.dataset.value = (100 * progress);
                requestAnimationFrame(step);
            }
        };

        // Get first frame
        if (cameraPathFunction !== undefined) {
            const s = cameraPathFunction(0);
            this.camera.position.copy(s.position);
            this.controls.target.copy(s.target);
            this.controls.update();
        }
        this.render();
        capturer.capture(this.renderer.domElement);

        // Step through the rest of the trajectory
        step();
    }
}

export {Api};