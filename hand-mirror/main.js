// --- Three.js setup ---
const canvas = document.getElementById('sceneCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(100, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// --- Hand points (left / right) ---
let leftHandPoints = createHandModel(0x00ffff);
let rightHandPoints = createHandModel(0xff00ff);
scene.add(leftHandPoints);
scene.add(rightHandPoints);

function createHandModel(color) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(21 * 3); // 21 landmark
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color, size: 0.15 });
    const points = new THREE.Points(geometry, material);
    points.visible = false; // boshida yashirin, qo'l topilganda ko'rsatamiz
    return points;
}

// --- Hand skeleton connections ---
const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4],        // bosh barmoq
    [0, 5], [5, 6], [6, 7], [7, 8],        // ko‘rsatkich
    [0, 9], [9, 10], [10, 11], [11, 12],   // o‘rta
    [0, 13], [13, 14], [14, 15], [15, 16], // bej
    [0, 17], [17, 18], [18, 19], [19, 20]  // kichik
];

// --- Hand skeletons (left / right) ---
let leftHandSkeleton = createHandSkeleton(0x00ffff);
let rightHandSkeleton = createHandSkeleton(0xff00ff);
scene.add(leftHandSkeleton);
scene.add(rightHandSkeleton);

function createHandSkeleton(color) {
    const material = new THREE.LineBasicMaterial({ color });
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(connections.length * 2 * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const lines = new THREE.LineSegments(geometry, material);
    lines.visible = false;
    return lines;
}

// --- Face points (all 468 cloud) ---
let facePoints = createFaceModel(0x00ff00);
scene.add(facePoints);

function createFaceModel(color) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(468 * 3); // 468 landmark
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color, size: 0.05 });
    const points = new THREE.Points(geometry, material);
    points.visible = false;
    return points;
}

// --- Optional: Face skeleton (requires FACEMESH_TESSELATION from drawing_utils.js) ---
let faceSkeleton = null;
const hasFaceTessellation = typeof FACEMESH_TESSELATION !== "undefined";
if (hasFaceTessellation) {
    faceSkeleton = createFaceSkeleton(0x00ff00);
    scene.add(faceSkeleton);
}

function createFaceSkeleton(color) {
    const material = new THREE.LineBasicMaterial({ color });
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(FACEMESH_TESSELATION.length * 2 * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const lines = new THREE.LineSegments(geometry, material);
    lines.visible = false;
    return lines;
}

// --- Animation loop ---
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate();

// --- MediaPipe setup ---
const videoElement = document.getElementById('webcam');

// Hands
const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});
hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
});

// FaceMesh
const faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});
faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
});

// --- Helpers: coordinate mapping (scale control) ---
function mapX(x) { return (x - 0.5) * 10; }
function mapY(y) { return -(y - 0.5) * 8; }
function mapZ(z) { return z * 5; }

// --- Hand: gesture detection (simple) ---
function detectGesture(landmarks) {
    // tips vs PIP joints: 8,12,16,20 vs 6,10,14,18
    const pairs = [
        [8, 6],  // index
        [12, 10],// middle
        [16, 14],// ring
        [20, 18] // pinky
    ];
    let extended = 0;
    for (let i = 0; i < pairs.length; i++) {
        const [tipIdx, pipIdx] = pairs[i];
        const tip = landmarks[tipIdx];
        const pip = landmarks[pipIdx];
        if (tip && pip && tip.y < pip.y) extended++;
    }
    if (extended >= 4) return "open";
    if (extended === 0) return "fist";
    return "other";
}

// --- Update functions (hands + face cloud + face skeleton) ---
function updateHandPoints(landmarks, points) {
    const positions = points.geometry.attributes.position.array;
    for (let i = 0; i < landmarks.length; i++) {
        positions[i * 3] = mapX(landmarks[i].x);
        positions[i * 3 + 1] = mapY(landmarks[i].y);
        positions[i * 3 + 2] = mapZ(landmarks[i].z);
    }
    points.geometry.attributes.position.needsUpdate = true;
}

function updateHandSkeleton(landmarks, skeleton) {
    const positions = skeleton.geometry.attributes.position.array;
    for (let i = 0; i < connections.length; i++) {
        const [a, b] = connections[i];
        positions[i * 6] = mapX(landmarks[a].x);
        positions[i * 6 + 1] = mapY(landmarks[a].y);
        positions[i * 6 + 2] = mapZ(landmarks[a].z);

        positions[i * 6 + 3] = mapX(landmarks[b].x);
        positions[i * 6 + 4] = mapY(landmarks[b].y);
        positions[i * 6 + 5] = mapZ(landmarks[b].z);
    }
    skeleton.geometry.attributes.position.needsUpdate = true;
}

function updateFacePoints(landmarks, points) {
    const positions = points.geometry.attributes.position.array;
    for (let i = 0; i < landmarks.length; i++) {
        positions[i * 3] = mapX(landmarks[i].x);
        positions[i * 3 + 1] = mapY(landmarks[i].y);
        positions[i * 3 + 2] = mapZ(landmarks[i].z);
    }
    points.geometry.attributes.position.needsUpdate = true;
}

function updateFaceSkeleton(landmarks, skeleton) {
    if (!hasFaceTessellation || !skeleton) return;
    const positions = skeleton.geometry.attributes.position.array;
    for (let i = 0; i < FACEMESH_TESSELATION.length; i++) {
        const [a, b] = FACEMESH_TESSELATION[i];
        positions[i * 6] = mapX(landmarks[a].x);
        positions[i * 6 + 1] = mapY(landmarks[a].y);
        positions[i * 6 + 2] = mapZ(landmarks[a].z);

        positions[i * 6 + 3] = mapX(landmarks[b].x);
        positions[i * 6 + 4] = mapY(landmarks[b].y);
        positions[i * 6 + 5] = mapZ(landmarks[b].z);
    }
    skeleton.geometry.attributes.position.needsUpdate = true;
}

// -------------------------------------------------------------------
// FACE PARTS: eyes, mouth, nose, brows (colored groups) — ADDED HERE
// -------------------------------------------------------------------

function createPartModel(color, count) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color, size: 0.06 }); // oldingi 0.08 emas
    const points = new THREE.Points(geometry, material);
    points.visible = false;
    return points;
}

// Indices for groups (simplified ranges)
const eyeIndices =
    [...Array(101).keys()].map(i => 33 + i).filter(i => i <= 133)
        .concat([...Array(102).keys()].map(i => 362 + i).filter(i => i <= 463));

const mouthIndices =
    [...Array(231).keys()].map(i => 61 + i).filter(i => i <= 291);

const noseIndices = [1, 2, 3, 4, 5, 6, 195, 196, 197, 7, 8, 9, 10]; // dublikatlar olib tashlandi

const browIndices =
    [...Array(36).keys()].map(i => 70 + i).filter(i => i <= 105)
        .concat([...Array(30).keys()].map(i => 336 + i).filter(i => i <= 365));
const earIndices = [127, 234, 454, 447];
// chap va o‘ng quloq chetlari


// Create parts with proper counts
let eyePoints = createPartModel(0x0000ff, eyeIndices.length);   // ko‘zlar ko‘k
let mouthPoints = createPartModel(0xff0000, mouthIndices.length); // og‘iz qizil
let browPoints = createPartModel(0x000000, browIndices.length);  // qoshlar qora
let nosePoints = createPartModel(0xffcc00, noseIndices.length);  // burun zarg‘aldoq (golden yellow)
let earPoints = createPartModel(0xff9900, earIndices.length); // quloqlar to‘q sariq

eyePoints.renderOrder = 1;
mouthPoints.renderOrder = 2;
nosePoints.renderOrder = 3;
browPoints.renderOrder = 4;
earPoints.renderOrder = 5; // qatlam tartibi

scene.add(eyePoints, mouthPoints, nosePoints, browPoints, earPoints);

function updatePart(landmarks, indices, points) {
    const positions = points.geometry.attributes.position.array;
    for (let i = 0; i < indices.length; i++) {
        const lm = landmarks[indices[i]];
        if (!lm) continue;
        positions[i * 3] = mapX(lm.x);
        positions[i * 3 + 1] = mapY(lm.y);
        positions[i * 3 + 2] = mapZ(lm.z);
    }
    points.geometry.attributes.position.needsUpdate = true;
    points.visible = true;
}

// --- Results handlers ---
// Hands
hands.onResults((results) => {
    const hasHands = results && Array.isArray(results.multiHandLandmarks) && results.multiHandLandmarks.length > 0;

    // Hide all by default; show when present
    leftHandPoints.visible = false;
    rightHandPoints.visible = false;
    leftHandSkeleton.visible = false;
    rightHandSkeleton.visible = false;

    if (!hasHands) return;

    results.multiHandLandmarks.forEach((landmarks, index) => {
        const handedness = (results.multiHandedness && results.multiHandedness[index] && results.multiHandedness[index].label) || "Unknown";
        const isLeft = handedness === "Left";

        const points = isLeft ? leftHandPoints : rightHandPoints;
        const skeleton = isLeft ? leftHandSkeleton : rightHandSkeleton;

        // Update points and show
        updateHandPoints(landmarks, points);
        points.visible = true;

        // Update skeleton and show
        updateHandSkeleton(landmarks, skeleton);
        skeleton.visible = true;

        // Gesture-based color
        const gesture = detectGesture(landmarks);
        if (gesture === "open") {
            points.material.color.set(0x00ff00); // green
        } else if (gesture === "fist") {
            points.material.color.set(0xff0000); // red
        } else {
            points.material.color.set(isLeft ? 0x00ffff : 0xff00ff); // default per hand
        }
    });
});

// Face
faceMesh.onResults((results) => {
    const hasFace = results && Array.isArray(results.multiFaceLandmarks) && results.multiFaceLandmarks.length > 0;

    // Hide by default
    facePoints.visible = false;
    eyePoints.visible = false;
    mouthPoints.visible = false;
    nosePoints.visible = false;
    browPoints.visible = false;
    if (faceSkeleton) faceSkeleton.visible = false;

    if (!hasFace) return;

    const landmarks = results.multiFaceLandmarks[0];

    // Update full face cloud
    updateFacePoints(landmarks, facePoints);
    facePoints.visible = true;

    // Update colored parts
    updatePart(landmarks, eyeIndices, eyePoints);
    updatePart(landmarks, mouthIndices, mouthPoints);
    updatePart(landmarks, noseIndices, nosePoints);
    updatePart(landmarks, browIndices, browPoints);
    updatePart(landmarks, earIndices, earPoints);

    // Update skeleton (if available)
    updateFaceSkeleton(landmarks, faceSkeleton);
    if (faceSkeleton) faceSkeleton.visible = true;
});

// --- Camera start (single stream for both models) ---
const mpCamera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({ image: videoElement });
        await faceMesh.send({ image: videoElement });
    },
    width: 640,
    height: 480
});
mpCamera.start();

// --- Resize handling ---
window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
});

// --- Optional: WebGL info logs (debug) ---
try {
    const gl = renderer.getContext();
    if (gl) {
        console.log('WebGL Renderer:', gl.getParameter(gl.RENDERER));
        console.log('WebGL Version:', gl.getParameter(gl.VERSION));
    }
} catch (e) {
    console.warn('WebGL info not available:', e);
}
