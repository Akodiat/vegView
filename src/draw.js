import * as THREE from "three";

/**
 * Draw a particle point cloud
 * @param {THREE.Vector3[]} positions List of positions for all particles
 * @param {THREE.Color[]} colors List of colours for all particles
 * @param {number} size Particle size
 * @param {boolean} sizeAttenuation If true, draw size relative to distance from camera
 * @param {string} texturePath Path to image used as texture
 * @returns {THREE.Points} Three.js Object containing the points
 */
function drawParticles(positions, colors, size=10, sizeAttenuation = true, texturePath = "resources/circle.png") {
    const loader = new THREE.TextureLoader();
    const texture = loader.load(texturePath);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();

    const material = new THREE.PointsMaterial({
        size: size,
        vertexColors: true,
        map: texture,
        sizeAttenuation: sizeAttenuation,
        alphaTest: 0.5
    });

    return new THREE.Points(geometry, material);
}

/**
 *
 * @param {THREE.BufferGeometry} geometry Base geometry to use
 * @param {any[]} elements
 * @param {function(new:THREE.Material)} material Constructor for a THREE.Material (default THREE.MeshLambertMaterial)
 * @returns {THREE.InstancedMesh} Three.js Object containing the instanced objects
 */
function drawInstances(geometry, elements, material) {
    const count = elements.length;
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    const matrix = new THREE.Matrix4();
    for (let i=0; i < count; i++) {
        matrix.compose(
            elements[i].position,
            elements[i].quaternion,
            elements[i].scale
        );
        mesh.setMatrixAt(i, matrix);
        mesh.setColorAt(i, elements[i].color);
    }
    return mesh;
}

function updateAllInstances(mesh, elements) {
    const matrix = new THREE.Matrix4();
    const count = elements.length;
    for (let i=0; i < count; i++) {
        matrix.compose(
            elements[i].position,
            elements[i].quaternion,
            elements[i].scale
        );
        mesh.setMatrixAt(i, matrix);
        mesh.setColorAt(i, elements[i].color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
}

function updateInstance(mesh, element, instanceId, matrix = new THREE.Matrix4()) {
    matrix.compose(
        element.position,
        element.quaternion,
        element.scale
    );
    mesh.setMatrixAt(instanceId, matrix);
    mesh.setColorAt(instanceId, element.color);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
}


export {drawParticles, drawInstances, updateAllInstances, updateInstance};
