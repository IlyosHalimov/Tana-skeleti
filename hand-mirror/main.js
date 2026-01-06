// Hands va FaceMesh setup qismlarini olib tashla

// Holistic setup
const holistic = new Holistic({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
});
holistic.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
});

// MediaPipe PoseConnections (33 landmark uchun asosiy bog‘lanishlar)
const PoseConnections = [
    // Tana markazi
    [0, 1], [0, 2], [1, 3], [2, 4], // burun → ko‘zlar → quloqlar

    // Yelka va qo‘llar
    [11, 12], // chap yelka ↔ o‘ng yelka
    [11, 13], [13, 15], // chap yelka → chap tirsak → chap bilak
    [12, 14], [14, 16], // o‘ng yelka → o‘ng tirsak → o‘ng bilak

    // Qo‘l panjalari
    [15, 17], [15, 19], [15, 21], // chap bilak → chap barmoqlar
    [16, 18], [16, 20], [16, 22], // o‘ng bilak → o‘ng barmoqlar

    // Tana pastki qismi
    [11, 23], [12, 24], // yelka → sonlar
    [23, 24], // chap son ↔ o‘ng son
    [23, 25], [25, 27], // chap son → chap tizza → chap tovon
    [24, 26], [26, 28], // o‘ng son → o‘ng tizza → o‘ng tovon

    // Oyoq panjalari
    [27, 29], [27, 31], // chap tovon → chap oyoq barmoqlari
    [28, 30], [28, 32]  // o‘ng tovon → o‘ng oyoq barmoqlari
];


holistic.onResults((results) => {
    // Yuz
    if (results.faceLandmarks) {
        updateFacePoints(results.faceLandmarks, facePoints);
        updatePart(results.faceLandmarks, eyeIndices, eyePoints);
        updatePart(results.faceLandmarks, mouthIndices, mouthPoints);
        updatePart(results.faceLandmarks, noseIndices, nosePoints);
        updatePart(results.faceLandmarks, browIndices, browPoints);
        updatePart(results.faceLandmarks, earIndices, earPoints);
        updatePart(results.faceLandmarks, neckIndices, neckPoints);
    }

    // Qo‘llar
    if (results.leftHandLandmarks) {
        updateHandPoints(results.leftHandLandmarks, leftHandPoints);
        updateHandSkeleton(results.leftHandLandmarks, leftHandSkeleton);
    }
    if (results.rightHandLandmarks) {
        updateHandPoints(results.rightHandLandmarks, rightHandPoints);
        updateHandSkeleton(results.rightHandLandmarks, rightHandSkeleton);
    }

    // Tana (pose)
    if (results.poseLandmarks) {
        updatePosePoints(results.poseLandmarks, posePoints);
        updatePoseSkeleton(results.poseLandmarks, poseSkeleton);
    }
});

function createPoseSkeleton(color) {
    const material = new THREE.LineBasicMaterial({ color });
    // PoseConnections — MediaPipe Pose’da mavjud bo‘lgan bog‘lanishlar ro‘yxati
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PoseConnections.length * 2 * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const lines = new THREE.LineSegments(geometry, material);
    lines.visible = false;
    return lines;
}

let poseSkeleton = createPoseSkeleton(0x00ffcc);
scene.add(poseSkeleton);

function updatePosePoints(landmarks, points) {
    const positions = points.geometry.attributes.position.array;
    for (let i = 0; i < landmarks.length; i++) {
        positions[i * 3] = mapX(landmarks[i].x);
        positions[i * 3 + 1] = mapY(landmarks[i].y);
        positions[i * 3 + 2] = mapZ(landmarks[i].z);
    }
    points.geometry.attributes.position.needsUpdate = true;
    points.visible = true;
}

function updatePoseSkeleton(landmarks, skeleton) {
    const positions = skeleton.geometry.attributes.position.array;
    for (let i = 0; i < PoseConnections.length; i++) {
        const [a, b] = PoseConnections[i];
        positions[i * 6] = mapX(landmarks[a].x);
        positions[i * 6 + 1] = mapY(landmarks[a].y);
        positions[i * 6 + 2] = mapZ(landmarks[a].z);

        positions[i * 6 + 3] = mapX(landmarks[b].x);
        positions[i * 6 + 4] = mapY(landmarks[b].y);
        positions[i * 6 + 5] = mapZ(landmarks[b].z);
    }
    skeleton.geometry.attributes.position.needsUpdate = true;
    skeleton.visible = true;
}


function createPoseModel(color) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(33 * 3); // 33 landmark
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color, size: 0.1 });
    const points = new THREE.Points(geometry, material);
    points.visible = false;
    return points;
}

let posePoints = createPoseModel(0x00ffcc); // tana nuqtalari
scene.add(posePoints);

const mpCamera = new Camera(videoElement, {
    onFrame: async () => {
        await holistic.send({ image: videoElement });
    },
    width: 640,
    height: 480
});
mpCamera.start();
