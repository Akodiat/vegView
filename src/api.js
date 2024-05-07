import * as THREE from "three";
import {notify, exportGLTF, saveString} from "./utils.js";

class Api {
    constructor(camera, scene, renderer, controls, patchManager) {
        this.camera = camera;
        this.scene = scene;
        this.renderer = renderer;
        this.controls = controls;
        this.patchManager = patchManager;
        this.timelineYearLabel = document.getElementById("timelineYearLabel");
    }

    redraw() {
        this.patchManager.setYear(this.patchManager.currentYear);
        this.renderer.render(this.scene, this.camera);
    }


    updateMargins(patchMargins) {
        this.patchManager.updateMargins(patchMargins);
        this.renderer.render(this.scene, this.camera);
    }

    prevYear() {
        this.patchManager.prevYear();
        this.timelineYearLabel.innerHTML = this.patchManager.currentYear;
        this.renderer.render(this.scene, this.camera);
    }

    nextYear() {
        this.patchManager.nextYear();
        this.timelineYearLabel.innerHTML = this.patchManager.currentYear;
        this.renderer.render(this.scene, this.camera);
    }

    playTrajectory() {
        let stop = false;
        const button = document.getElementById("trajectoryStartButton");
        button.innerHTML = "<span class='mif-stop icon'></span>";
        button.onclick = ()=>{
            stop = true;
        };

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
    }

    scaleCanvas(scalingFactor=2) {
        const canvas = this.renderer.domElement;
        const width = canvas.width;
        const height = canvas.height;
        canvas.width = width*scalingFactor;
        canvas.height = height*scalingFactor;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(canvas.width, canvas.height);
        this.renderer.render(this.scene, this.camera);
    }

    exportCSV(delimiter = ",") {
        const data = [];
        for (const patch of this.patchManager.patches.values()) {
            for (const cohort of patch.cohorts.values()) {
                for (const [year, timestep] of cohort.timeSteps.entries()) {
                    for (const p of timestep.positions.values()) {
                        const d = {
                            x: p.x.toFixed(3),
                            y: p.y.toFixed(3),
                            ...timestep,
                            ...this.patchManager.yearData.get(year)
                        };
                        delete d.positions;
                        data.push(d);
                    }
                }
            }
        }

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

    exportGLTF(scene=this.scene, binary=false, name=this.patchManager.datasetName) {
        exportGLTF(scene, binary, name);
    }

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
                    <input onchange="api.patchManager.pftConstants[${i}].color.set(this.value); api.redraw()" type="color" value="#${c.color.getHexString()}"/>
                </td>
            </tr>
            `

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
            <th></th>
            <th>Name</th>
            <th>Geometry</th>
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

    exportOrbitingVideo(format, framerate, scaleFactor, distance=100, height=50) {
        const target = this.patchManager.calcPatchesCentre();
        const cameraPathFunction = progress => {
            // Make a circle
            const position = new THREE.Vector3(
                distance * Math.cos(progress * 2*Math.PI),
                height,
                distance * Math.sin(progress * 2*Math.PI)
            );
            return {position, target};
        };
        this.exportVideo(format, framerate, scaleFactor, cameraPathFunction);
    }

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
        capturer.capture(this.renderer.domElement);

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
                this.renderer.render(this.scene, this.camera);
                capturer.capture(this.renderer.domElement);
                progressBar.dataset.value = (100 * progress);
                requestAnimationFrame(step);
            }
        };
        step();
    }
}


export {Api};