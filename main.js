'use strict';
import Model from "./model.js";
import StereoCamera from "./StereoCamera.js";
let gl, surface, shProgram, texture, stereoCamera, spaceball;
let videoTexture, videoElement, bgBuffer;
let remoteQuat = [0, 0, 0, 1]; // кватерніон з iPhone

let socket;

function connectWebSocket() {
    const phoneIP = "192.168.0.102"; 
    socket = new WebSocket(`ws://${phoneIP}:8080/sensor/connect?type=android.sensor.game_rotation_vector`);

    socket.onopen = () => {
        console.log("WebSocket connected");
    };

    socket.onmessage = event => {
        const data = JSON.parse(event.data);
        if (data.values && data.values.length >= 4) {
            remoteQuat = [
				data.values[3],
				data.values[0],
				data.values[1],
				data.values[2],
			]; // Це масив [x, y, z, w]
        }
    };

    socket.onerror = err => {
        console.error("WebSocket error:", err);
    };

    socket.onclose = () => {
        console.warn("WebSocket closed. Reconnecting in 1s...");
        setTimeout(connectWebSocket, 1000);
    };
}

// === КЛАС ШЕЙДЕРА ===
function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;
    this.Use = function() { gl.useProgram(this.prog); };
}

// === ФОН: ВІДЕО + QUAD ===
function initVideoBackground() {
    videoElement = document.createElement("video");
    videoElement.autoplay = true;
    videoElement.muted = true;
    videoElement.playsInline = true;

    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            videoElement.srcObject = stream;
            videoElement.play();

            videoTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, videoTexture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

            requestAnimationFrame(updateVideoTexture);
        })
        .catch(err => console.error("Camera error:", err));
}

function updateVideoTexture() {
    if (videoElement.readyState >= videoElement.HAVE_CURRENT_DATA) {
        gl.bindTexture(gl.TEXTURE_2D, videoTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoElement);
    }
    requestAnimationFrame(updateVideoTexture);
}

function createBackgroundQuad() {
    const vertices = new Float32Array([
        -1, -1,  0, 0,
         1, -1,  1, 0,
        -1,  1,  0, 1,
        -1,  1,  0, 1,
         1, -1,  1, 0,
         1,  1,  1, 1
    ]);

    bgBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bgBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
}

function drawVideoBackground() {
    gl.disable(gl.DEPTH_TEST);

    const orthoMatrix = m4.orthographic(-1, 1, -1, 1, -1, 1);
    shProgram.Use();

    gl.bindBuffer(gl.ARRAY_BUFFER, bgBuffer);

    gl.enableVertexAttribArray(shProgram.iAttribVertex);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 2, gl.FLOAT, false, 16, 0);

    gl.enableVertexAttribArray(shProgram.iAttribTexCoord);
    gl.vertexAttribPointer(shProgram.iAttribTexCoord, 2, gl.FLOAT, false, 16, 8);

    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    gl.uniform1i(shProgram.iTextureSampler, 0);
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, orthoMatrix);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.enable(gl.DEPTH_TEST);
}

// === МАЛЮВАННЯ СЦЕНИ ===
function draw() {
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    drawVideoBackground(); // ФОН

    const rotationMatrix = quatToMatrix(remoteQuat);
    const translate = m4.translation(0, 0, -10);
    const modelViewMatrix = m4.multiply(translate, rotationMatrix);

    stereoCamera.mConvergence = parseFloat(document.getElementById('conv').value);
    stereoCamera.mEyeSeparation = parseFloat(document.getElementById('eyes').value);
    stereoCamera.mFOV = parseFloat(document.getElementById('fov').value);
    stereoCamera.mNear = parseFloat(document.getElementById('near').value);

    const matrLeftFrustum = stereoCamera.applyLeftFrustum();
    const matrRightFrustum = stereoCamera.applyRightFrustum();

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(shProgram.iTextureSampler, 0);

    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.colorMask(true, false, false, false);
    const leftModelViewProjection = m4.multiply(matrLeftFrustum.projection, m4.multiply(matrLeftFrustum.modelView, modelViewMatrix));
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, leftModelViewProjection);
    surface.Draw();

    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.colorMask(false, true, true, false);
    const rightModelViewProjection = m4.multiply(matrRightFrustum.projection, m4.multiply(matrRightFrustum.modelView, modelViewMatrix));
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, rightModelViewProjection);
    surface.Draw();

    gl.colorMask(true, true, true, true);
    console.log("remoteQuat", remoteQuat);
}

// === GL ІНІЦІАЛІЗАЦІЯ ===
function initGL() {
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

    shProgram = new ShaderProgram('Textured', prog);
    shProgram.Use();

    shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribTexCoord = gl.getAttribLocation(prog, "texCoord");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iTextureSampler = gl.getUniformLocation(prog, "textureSampler");

    surface = new Model(gl, shProgram);
    surface.CreateSurfaceData();

    gl.enable(gl.DEPTH_TEST);
    initTexture();
    initVideoBackground();
    createBackgroundQuad();
}

function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsh, vShader);
    gl.compileShader(vsh);
    if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
    }

    let fsh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }

    let prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}


// === ТЕКСТУРА ДЛЯ ТОРУ ===
function initTexture() {
    texture = gl.createTexture();
    const image = new Image();
    image.src = "diffuse.jpg";
    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);
    };
}

// === ЦИКЛ ===
function update() {
    draw();
    window.requestAnimationFrame(update);
}

// === ІНІЦІАЛІЗАЦІЯ ===
function init() {
    
    stereoCamera = new StereoCamera(10, 0.1, 1, 32, 1, 64);
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if (!gl) throw "Browser does not support WebGL";
    } catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();
    } catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize WebGL: " + e + "</p>";
        return;
    }

    connectWebSocket()
    update();
}

function quatToMatrix(q) {
    const [x, y, z, w] = q;
    const xx = x * x, yy = y * y, zz = z * z;
    const xy = x * y, xz = x * z, yz = y * z;
    const wx = w * x, wy = w * y, wz = w * z;

    return [
        1 - 2 * (yy + zz), 2 * (xy - wz),     2 * (xz + wy),     0,
        2 * (xy + wz),     1 - 2 * (xx + zz), 2 * (yz - wx),     0,
        2 * (xz - wy),     2 * (yz + wx),     1 - 2 * (xx + yy), 0,
        0,                 0,                 0,                 1
    ];
}

document.addEventListener("DOMContentLoaded", init);