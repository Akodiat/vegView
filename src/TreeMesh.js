import * as THREE from "three";
/*global Tree*/

const genericTreeSpec = {
    foilageTexture: "assets/twig-1.png",
    segments: 6,
    levels: 2,
    vMultiplier: 2.36,
    twigScale: 0.7,
    initalBranchLength: 0.49,
    lengthFalloffFactor: 0.85,
    lengthFalloffPower: 0.99,
    clumpMax: 0.454,
    clumpMin: 0.404,
    branchFactor: 2.45,
    dropAmount: -0.1,
    growAmount: 0.235,
    sweepAmount: 0.01,
    maxRadius: 0.139,
    climbRate: 0.5,
    trunkKink: 0.093,
    treeSteps: 5,
    taperRate: 0.947,
    radiusFalloffRate: 0.73,
    twistRate: 3.02,
    trunkLength: 2.4
};

const spruceSpec = {
    foilageTexture: "assets/spruce.png",
    segments: 6,
    levels: 2,
    vMultiplier: 2.36,
    twigScale: 0.8,
    initalBranchLength: 0.55,
    lengthFalloffFactor: 0.84,
    lengthFalloffPower: 0.97,
    clumpMax: 0.5,
    clumpMin: 0.11,
    branchFactor: 2,
    dropAmount: -0.04,
    growAmount: 0.05,
    sweepAmount: 0.001,
    maxRadius: 0.1,
    climbRate: 0.34,
    trunkKink: 0.0,
    treeSteps: 14,
    taperRate: 0.85,
    radiusFalloffRate: 0.73,
    twistRate: 3.9,
    trunkLength: 2.7
};

const textureLoader = new THREE.TextureLoader();
const textures = new Map();

class TreeMesh extends THREE.Object3D {
    constructor(pft, height, boleHeight, crownRadius, boleDiam, levels, seed) {
        super();

        let pftSpec;
        if (["BNE", "BINE", "BNS"].includes(pft)) {
            pftSpec = spruceSpec;
        } else {
            pftSpec = genericTreeSpec;
        }

        const w = pftSpec.climbRate;
        const n = pftSpec.treeSteps;
        const defaultCrownHeight = w * n; //(w**(n-1) - 1)/(w - 1) - 1;
        const boleProportion = boleHeight / height;
        const defaultHeight = defaultCrownHeight * 1/(1-boleProportion);
        const defaultBoleHeight = boleProportion * defaultHeight;

        const scale = height/defaultHeight;

        const spec = {
            ...pftSpec,
            trunkLength: defaultBoleHeight,
            initalBranchLength: 0.5 * crownRadius / scale,
            maxRadius: 0.5 * boleDiam / scale,
            seed: THREE.MathUtils.randInt(0, 1000),
            levels: levels,
            seed: seed
        }

        const tree = new Tree(spec);

        // https://github.com/donmccurdy/glTF-Procedural-Trees/
        const treeGeometry = new THREE.BufferGeometry();
        treeGeometry.setAttribute("position", createFloatAttribute(tree.verts, 3));
        treeGeometry.setAttribute("normal", normalizeAttribute(createFloatAttribute(tree.normals, 3)));
        treeGeometry.setAttribute("uv", createFloatAttribute(tree.UV, 2));
        treeGeometry.setIndex(createIntAttribute(tree.faces, 1));
        treeGeometry.scale(scale, scale, scale);

        const twigGeometry = new THREE.BufferGeometry();
        twigGeometry.setAttribute("position", createFloatAttribute(tree.vertsTwig, 3));
        twigGeometry.setAttribute("normal", normalizeAttribute(createFloatAttribute(tree.normalsTwig, 3)));
        twigGeometry.setAttribute("uv", createFloatAttribute(tree.uvsTwig, 2));
        twigGeometry.setIndex(createIntAttribute(tree.facesTwig, 1));
        twigGeometry.scale(scale, scale, scale);

        const treeMaterial = new THREE.MeshStandardMaterial({
            color: 0x9d7362, roughness: 1.0, metalness: 0.0
        });
        this.trunkMesh = new THREE.Mesh(treeGeometry, treeMaterial);
        this.add(this.trunkMesh); // Add as child

        // Load textures one time only
        if (!textures.has(pftSpec.foilageTexture)) {
            textures.set(
                pftSpec.foilageTexture,
                textureLoader.load(pftSpec.foilageTexture)
            );
        }

        const twigsMaterial = new THREE.MeshStandardMaterial({
            color: 0xF16950, wireframe: false,
            roughness: 1.0, metalness: 0.0,
            map: textures.get(pftSpec.foilageTexture),
            alphaTest: 0.1
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

export {TreeMesh};