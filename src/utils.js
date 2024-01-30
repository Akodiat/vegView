import * as THREE from 'three';

function randItem(array){
    return array[Math.floor(Math.random() * array.length)];
}

const emptyElem = {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    scale: new THREE.Vector3(),
    color: new THREE.Color()
}

export {randItem, emptyElem}