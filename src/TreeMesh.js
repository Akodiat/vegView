import * as THREE from 'three';

class TreeMesh extends THREE.Object3D {
    constructor({
        seed = 262,
        segments = 6,
        levels = 5,
        vMultiplier = 2.36,
        twigScale = 0.39,
        initalBranchLength = 0.49,
        lengthFalloffFactor = 0.85,
        lengthFalloffPower = 0.99,
        clumpMax = 0.454,
        clumpMin = 0.404,
        branchFactor = 2.45,
        dropAmount = -0.1,
        growAmount = 0.235,
        sweepAmount = 0.01,
        maxRadius = 0.139,
        climbRate = 0.371,
        trunkKink = 0.093,
        treeSteps = 5,
        taperRate = 0.947,
        radiusFalloffRate = 0.73,
        twistRate = 3.02,
        trunkLength = 2.4
    }={}) {
        super();
        const tree = new Tree({
            seed, segments, levels, vMultiplier, twigScale, initalBranchLength,
            lengthFalloffFactor, lengthFalloffPower, clumpMax, clumpMin,
            branchFactor, dropAmount, growAmount, sweepAmount, maxRadius,
            climbRate, trunkKink, treeSteps, taperRate, radiusFalloffRate,
            twistRate, trunkLength,
        });

        // https://github.com/donmccurdy/glTF-Procedural-Trees/
        const treeGeometry = new THREE.BufferGeometry();
        treeGeometry.setAttribute("position", createFloatAttribute(tree.verts, 3));
        treeGeometry.setAttribute("normal", normalizeAttribute(createFloatAttribute(tree.normals, 3)));
        treeGeometry.setAttribute("uv", createFloatAttribute(tree.UV, 2));
        treeGeometry.setIndex(createIntAttribute(tree.faces, 1));

        const twigGeometry = new THREE.BufferGeometry();
        twigGeometry.setAttribute("position", createFloatAttribute(tree.vertsTwig, 3));
        twigGeometry.setAttribute("normal", normalizeAttribute(createFloatAttribute(tree.normalsTwig, 3)));
        twigGeometry.setAttribute("uv", createFloatAttribute(tree.uvsTwig, 2));
        twigGeometry.setIndex(createIntAttribute(tree.facesTwig, 1));

        const treeMaterial = new THREE.MeshStandardMaterial({
            color: 0x9d7362, roughness: 1.0, metalness: 0.0
        });
        this.trunkMesh = new THREE.Mesh(treeGeometry, treeMaterial);
        this.add(this.trunkMesh); // Add as child

        const twigsMaterial = new THREE.MeshStandardMaterial({
            color: 0xF16950, wireframe: false,
            roughness: 1.0, metalness: 0.0,
            //map: this.textureLoader.load('assets/twig-1.png'),
            alphaTest: 0.9
        });
        this.twigsMesh = new THREE.Mesh(twigGeometry, twigsMaterial);
        this.add(this.twigsMesh); // Add as child
    }
}

function createFloatAttribute (array, itemSize) {
    const typedArray = new Float32Array(Tree.flattenArray(array));
    return new THREE.BufferAttribute(typedArray, itemSize);
  }

  function createIntAttribute (array, itemSize) {
    const typedArray = new Uint16Array(Tree.flattenArray(array));
    return new THREE.BufferAttribute(typedArray, itemSize);
  }

  function normalizeAttribute (attribute) {
    var v = new THREE.Vector3();
    for (var i = 0; i < attribute.count; i++) {
      v.set(attribute.getX(i), attribute.getY(i), attribute.getZ(i));
      v.normalize();
      attribute.setXYZ(i, v.x, v.y, v.z);
    }
    return attribute;
  }

export {TreeMesh}