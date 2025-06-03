class Torus {
    constructor() {
        this.geometry = new THREE.BufferGeometry();
        this.material = new THREE.MeshStandardMaterial({ color: 0x66007a, side: THREE.DoubleSide, metalness: 0.4, roughness: 0.4 });
        this.mesh = null;

        this.createSurfaceData();
    }

    createSurfaceData() {
        let vertices = [];
        let texCoords = [];
        let indices = [];

        let a = 0.4;
        let r = 0.6;
        let vSegments = 50;
        let uSegments = 50;
        let theta = 0.25 * Math.PI;

        for (let i = 0; i <= uSegments; i++) {
            let u = -Math.PI + (2 * Math.PI * i) / uSegments;
            if (i === uSegments) u = -Math.PI;

            let x_u = a * Math.pow(Math.cos(u), 3);
            let z_u = a * Math.pow(Math.sin(u), 3);

            for (let j = 0; j <= vSegments; j++) {
                let v = (2 * Math.PI * j) / vSegments;
                if (j === vSegments) v = 0;

                let X = (r + x_u * Math.cos(theta) - z_u * Math.sin(theta)) * Math.cos(v);
                let Y = (r + x_u * Math.cos(theta) - z_u * Math.sin(theta)) * Math.sin(v);
                let Z = x_u * Math.sin(theta) + z_u * Math.cos(theta);

                vertices.push(X, Y, Z);

                let uTex = i / uSegments;
                let vTex = j / vSegments;
                texCoords.push(uTex, vTex);
            }
        }

        for (let i = 0; i < uSegments; i++) {
            for (let j = 0; j < vSegments; j++) {
                let current = i * (vSegments + 1) + j;
                let next = (i + 1) * (vSegments + 1) + j;

                indices.push(current, next, current + 1);
                indices.push(current + 1, next, next + 1);
            }
        }

        // create BufferGeometry and set attributes
        this.geometry.setIndex(indices);
        this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        this.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(texCoords, 2));
        this.geometry.computeVertexNormals();

        // create Mesh
        this.mesh = new THREE.Mesh(this.geometry, this.material);
    }

    getMesh() {
        return this.mesh;
    }
}