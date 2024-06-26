import * as THREE from "three";
import {GLTFExporter} from "../libs/exporters/GLTFExporter.js";

function notify(message, type) {
    // eslint-disable-next-line no-undef
    Metro.notify.create(message, type, {
        keepOpen: true
    });
}

function randItem(array){
    return array[Math.floor(Math.random() * array.length)];
}

const emptyElem = {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    scale: new THREE.Vector3(),
    color: new THREE.Color()
};

// https://discourse.threejs.org/t/how-to-ignore-the-transparent-part-of-sprite-by-ray-pickup/7773/3
function getClosestOpaque(intersectObjects) {
    // For every intersected object returned by the raycaster
    for (const intersect of intersectObjects) {
        const {object} = intersect;
        // If the material has a texture
        if (object.material.map) {
            // Get the image from the intersect object mesh
            const {image} = object.material.map;
            // 2D ratio of where the mouse is on the image
            const {uv: {x: UX, y: UY}} = intersect;
            // The actual w, h of the image
            const {width: OW, height: OH} = image;
            // Get the image data
            const imageData = getImageData(image);
            // the X & Y of the image
            const x = Math.round(UX * OW);
            const y = OH - Math.round(UY * OH); // reverse because threejs
            // the index of image data y is every row of pixels, x is on a row of pixels
            const I = (x + y * OW) * 4;
            // the fourth (3) of every 4 numbers is the alpha value
            const A = imageData.data[I + 3];
            // if A is 0 then it's transparent
            if (A === 0) {
                continue;
            }
        }
        return intersect;
    }
}

function getImageData(image) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    let {naturalWidth: w, naturalHeight: h} = image;
    canvas.width = w;
    canvas.height = h;
    context.drawImage(image, 0, 0, w, h);
    const imageData = context.getImageData(0, 0, w, h);
    return imageData;
}


function exportGLTF(scene, binary=false, name="scene") {
    // Instantiate an exporter
    let exporter = new GLTFExporter();
    let options = {
        binary: binary
    };

    // Removes instances (the glTF exporter cannot yet support instances
    // and the Blender glTF importer doesn't either)
    const deinstancedScene = deinstantiate(scene);

    // Parse the input and generate the glTF output
    exporter.parse(deinstancedScene,
        result => {
            if (result instanceof ArrayBuffer) {
                saveArrayBuffer(result, `${name}.glb`);
            } else {
                let output = JSON.stringify(result, null, 2);
                saveString(output, `${name}.gltf`);
            }
        },
        error => {
            console.log("An error happened during parsing", error);
        },
        options
    );
}

/**
 * Recursive function to replace instanced objects (cohort trees) with ordinary meshes
 * @param {THREE.Object3D} object Root object to deinstantiate
 * @param {Map<number, THREE.Material>} materialMap (optional) Avoids duplicate materials
 * @returns A clone of the object, with all instanced objects replaced with ordinary meshes
 */
function deinstantiate(object, materialMap) {
    if (materialMap === undefined) {
        materialMap = new Map();
    }

    if (object.isInstancedMesh !== true) {
        const clone = object.clone(false);
        if (object.children.length > 0) {
            // Recursively call this function for all children
            clone.children = object.children.map(c=>deinstantiate(c, materialMap));
        }
        return clone;
    } else {
        const count = object.count;
        const matrix = new THREE.Matrix4();
        const color = new THREE.Color();

        const group = new THREE.Group();
        for (let i = 0; i < count; i++) {
            object.getColorAt(i, color);
            const hexColor = color.getHex();

            if (!materialMap.has(hexColor)) {
                const m = object.material.clone();
                m.color.copy(color);
                materialMap.set(hexColor, m);
            }
            const mesh = new THREE.Mesh(
                object.geometry,
                materialMap.get(hexColor)
            );

            object.getMatrixAt(i, matrix);
            matrix.decompose(
                mesh.position,
                mesh.quaternion,
                mesh.scale
            );

            // Don't include empty elements
            // Otherwise all cohorts get 1000 meshes
            if (!mesh.scale.equals(emptyElem.scale)) {
                group.add(mesh);
            }
        }
        return group;
    }
}

const link = document.createElement("a");
link.style.display = "none";
document.body.appendChild(link); // Firefox workaround, see #6594 threejs
function save( blob, filename ) {
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

function saveString( text, filename ) {
    save(new Blob([text], {type: "text/plain"}), filename);
}

function saveArrayBuffer(buffer, filename) {
    save(new Blob([buffer], {type: "application/octet-stream"}), filename);
}

export {notify, randItem, emptyElem, getClosestOpaque, exportGLTF, saveString};