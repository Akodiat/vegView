import * as THREE from "three";
import {notify, exportGLTF} from "./utils.js";

class Api {
    constructor(camera, scene, renderer, controls, patchManager) {
        this.camera = camera;
        this.scene = scene;
        this.renderer = renderer;
        this.controls = controls;
        this.patchManager = patchManager;
        this.timelineYearLabel = document.getElementById("timelineYearLabel");
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

    exportGLTF(scene=this.scene, binary=false, name="scene") {
        exportGLTF(scene, binary, name);
    }

    exportImage(scaleFactor) {
        if (scaleFactor === undefined) {
            scaleFactor = parseFloat((document.getElementById("exportImageScalingFactor")).value);
        }

        let saveImage = () => {
            this.renderer.domElement.toBlob(function(blob) {
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

    showVideoExportWindow() {
        // eslint-disable-next-line no-undef
        Metro.window.create({
            title: "Export video",
            place: "center",
            icon: "<span class='mif-video-camera'></span>",
            content: `
<form>
<legend>File format:</legend>
<select id="videoExportFormat" data-role="select">
    <option value="webm" selected="selected">webm</option>
    <option value="gif">gif</option>
    <option value="png">png</option>
    <option value="jpg">jpg</option>
</select>
<input type="number" value="10" id="videoFramerate" data-role="input" data-prepend="Frame rate" data-append="fps">
<input type="number" value="1" id="videoScaleFactor" data-role="input" data-prepend="Scale factor" data-append="times">
</form>
<button id="videoExportStartButton" class="primary button" onclick="api.exportVideo()">Start</button>
<div id="videoExportProgress" data-role="progress" data-type="load" data-value="35" style="display: none"></div>
`
        });
    }

    exportVideo(format, framerate, scaleFactor) {
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
        const progress = document.getElementById("videoExportProgress");
        progress.style.display = "block";

        const step = () => {
            if (this.patchManager.currentYear >= lastYear || stop) {
                capturer.stop();
                capturer.save();
                this.scene.background = null;
                this.scaleCanvas(1/scaleFactor);
                button.onclick = ()=>{this.exportVideo();};
                button.innerText = "Start";
            } else {
                this.patchManager.nextYear();
                this.renderer.render(this.scene, this.camera);
                capturer.capture(this.renderer.domElement);
                progress.dataset.value = (100 *
                    (this.patchManager.currentYear - firstYear) /
                    (lastYear - firstYear)
                );
                requestAnimationFrame(step);
            }
        };
        step();
    }
}


export {Api};