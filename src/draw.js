import * as THREE from "three";

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


export {drawInstances, updateInstance};
