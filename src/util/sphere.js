export function createSphere(options) {
    options = options || {};

    let long_bands = options.long_bands || 32;
    let lat_bands = options.lat_bands || 32;
    let radius = options.radius || 1;
    let lat_step = Math.PI / lat_bands;
    let long_step = 2 * Math.PI / long_bands;
    let num_positions = long_bands * lat_bands * 4;
    let num_indices = long_bands * lat_bands * 6;
    let lat_angle, long_angle;
    let positions = new Float32Array(num_positions * 3);
    let normals = new Float32Array(num_positions * 3);
    let uvs = new Float32Array(num_positions * 2);
    let indices = new Uint16Array(num_indices);
    let x1, x2, x3, x4,
        y1, y2,
        z1, z2, z3, z4,
        u1, u2,
        v1, v2;
    let i, j;
    let k = 0, l = 0;
    let vi, ti;

    for (i = 0; i < lat_bands; i++) {
        lat_angle = i * lat_step;
        y1 = Math.cos(lat_angle);
        y2 = Math.cos(lat_angle + lat_step);
        for (j = 0; j < long_bands; j++) {
            long_angle = j * long_step;
            x1 = Math.sin(lat_angle) * Math.cos(long_angle);
            x2 = Math.sin(lat_angle) * Math.cos(long_angle + long_step);
            x3 = Math.sin(lat_angle + lat_step) * Math.cos(long_angle);
            x4 = Math.sin(lat_angle + lat_step) * Math.cos(long_angle + long_step);
            z1 = Math.sin(lat_angle) * Math.sin(long_angle);
            z2 = Math.sin(lat_angle) * Math.sin(long_angle + long_step);
            z3 = Math.sin(lat_angle + lat_step) * Math.sin(long_angle);
            z4 = Math.sin(lat_angle + lat_step) * Math.sin(long_angle + long_step);
            u1 = 1 - j / long_bands;
            u2 = 1 - (j + 1) / long_bands;
            v1 = 1 - i / lat_bands;
            v2 = 1 - (i + 1) / lat_bands;
            vi = k * 3;
            ti = k * 2;

            positions[ vi ] = x1 * radius;
            positions[ vi + 1 ] = y1 * radius;
            positions[ vi + 2 ] = z1 * radius; //v0

            positions[ vi + 3 ] = x2 * radius;
            positions[ vi + 4 ] = y1 * radius;
            positions[ vi + 5 ] = z2 * radius; //v1

            positions[ vi + 6 ] = x3 * radius;
            positions[ vi + 7 ] = y2 * radius;
            positions[ vi + 8 ] = z3 * radius; // v2


            positions[ vi + 9 ] = x4 * radius;
            positions[ vi + 10 ] = y2 * radius;
            positions[ vi + 11 ] = z4 * radius; // v3

            normals[ vi ] = x1;
            normals[ vi + 1 ] = y1;
            normals[ vi + 2 ] = z1;

            normals[ vi + 3 ] = x2;
            normals[ vi + 4 ] = y1;
            normals[ vi + 5 ] = z2;

            normals[ vi + 6 ] = x3;
            normals[ vi + 7 ] = y2;
            normals[ vi + 8 ] = z3;

            normals[ vi + 9 ] = x4;
            normals[ vi + 10 ] = y2;
            normals[ vi + 11 ] = z4;

            uvs[ ti ] = u1;
            uvs[ ti + 1 ] = v1;

            uvs[ ti + 2 ] = u2;
            uvs[ ti + 3 ] = v1;

            uvs[ ti + 4 ] = u1;
            uvs[ ti + 5 ] = v2;

            uvs[ ti + 6 ] = u2;
            uvs[ ti + 7 ] = v2;

            indices[ l ] = k;
            indices[ l + 1 ] = k + 1;
            indices[ l + 2 ] = k + 2;
            indices[ l + 3 ] = k + 2;
            indices[ l + 4 ] = k + 1;
            indices[ l + 5 ] = k + 3;

            k += 4;
            l += 6;
        }
    }

    return {
        positions: positions,
        normals: normals,
        uvs: uvs,
        indices: indices
    };
}