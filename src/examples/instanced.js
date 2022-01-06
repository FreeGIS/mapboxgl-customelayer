import initMap from '../util/initMap';
import fromLngLat from '../util/fromLonLat';
import uuid from '../util/uuid';
import { createModel, createBuffer, bindAttribute } from '../util/webgl_util';
import { mat4, vec3 } from 'gl-matrix';
class CustomeLayer {
    constructor() {
        this._id = uuid();
    }
    // 只读属性
    get id() {
        return this._id;
    }
    get type() {
        return 'custom';
    }
    get renderingMode() {
        return '3d';
    }
    onAdd(map, gl) {
        this._map = map;
        this._gl = gl;
        // 根据数据构造program vao等
        const vs = `#version 300 es
        layout(location=0) in vec2 a_position;
        // layout(location=1) in vec3 a_color;
        uniform mat4 uPMatrix;
        // out vec3 vColor;
        void main() {
            gl_Position = uPMatrix * vec4(a_position, 0, 1.0);
        }`;
        const fs = `#version 300 es
        precision highp int;
        precision highp float;
        uniform vec4 uColor;
        out vec4 outColor;
        void main() {
            outColor = uColor;
        }`;
        this._drawModel = createModel(gl, vs, fs);
        // 创建vao
        this._vao = gl.createVertexArray();
        gl.bindVertexArray(this._vao);

        const coordinates = [
            -0.1, 0.4,
            -0.1, -0.4,
            0.1, -0.4,
            0.1, -0.4,
            -0.1, 0.4,
            0.1, 0.4,

            0.4, -0.1,
            -0.4, -0.1,
            -0.4, 0.1,
            -0.4, 0.1,
            0.4, -0.1,
            0.4, 0.1,
        ];
        this.colors = [
            [1, 0, 0, 1,],  // red
            [0, 1, 0, 1,],  // green
            [0, 0, 1, 1,],  // blue
            [1, 0, 1, 1,],  // magenta
            [0, 1, 1, 1,],  // cyan
        ];



        this.positions = new Float32Array(coordinates.length);

        for (let i = 0; i < coordinates.length; i = i + 2) {
            //const coords = fromLngLat([coordinates[i] + 118, coordinates[i + 1] + 32]);
            const coords = [coordinates[i] + 0.3, coordinates[i + 1] + 0.3];
            this.positions[i] = coords[0];
            this.positions[i + 1] = coords[1];
        }

        this.matrices = new Array(5);
        for (let i = 0; i < 5; i++) {
            let matrice = [];
            mat4.identity(matrice);
            this.matrices[i] = matrice;
        }

        // 绑定坐标顶点
        const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, this.positions);
        bindAttribute(gl, positionBuffer, 0, 2);
        // 绑定颜色顶点
        //const colorBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array([ 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0 ]));
        //bindAttribute(gl, colorBuffer, 1, 3);
        // 绑定结束        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);

        const modelOrigin = [118, 32];
        const modelAltitude = 0;

        this.modelAsMercatorCoordinate = fromLngLat(
            modelOrigin,
            modelAltitude
        );
        console.log(this.modelAsMercatorCoordinate);

        let matrice = [];
        mat4.identity(matrice);
        let mat_1 = mat4.translate([], matrice, vec3.fromValues(-0.5 + 1 * 0.25, 0, 0));
        console.log(mat_1);
        let mat_2 = mat4.rotateZ([], mat_1, 2 * (0.1 + 0.1 * 1));

        console.log(mat_2);

    }
    render(gl, matrix) {
        gl.useProgram(this._drawModel.program);

        const time = 2;
        //绑定顶点vao
        gl.bindVertexArray(this._vao);

        this.matrices.forEach((mat, ndx) => {
            // 1 平移到0 0原点，墨卡托0-1坐标系的 0 0点，即左上角
            //const mat_1 = mat4.translate([], mat, vec3.fromValues(-this.modelAsMercatorCoordinate.x, -this.modelAsMercatorCoordinate.y, -this.modelAsMercatorCoordinate.z));
            // 2 z轴旋转
            //const mat_2 = mat4.rotateZ([], mat_1, time * (0.1 + 0.1 * ndx));
            // 3 旋转完再平移回去
            //const mat_3 = mat4.translate([], mat_2, vec3.fromValues(this.modelAsMercatorCoordinate.x, this.modelAsMercatorCoordinate.y, this.modelAsMercatorCoordinate.z));
            // 4 合并地图的mvp矩阵
            //const mat_4 = mat4.multiply([], matrix, mat_3);
            //const mat_1 = mat4.translate([], mat, vec3.fromValues(-0.3, -0.3, 0));
            const mat_1 = mat4.fromTranslation([], vec3.fromValues(-0.3, -0.3, 0));
            // const mat_2 = mat4.translate([],mat_1,vec3.fromValues(-0.5 + ndx * 0.25, 0, 0));
            const mat_2 = mat4.fromZRotation([],time * (0.1 + 0.1 * ndx));

            const mat_3 = mat4.multiply([],mat_1,mat_2);
            const mat_4 = mat4.translate([], mat_3, vec3.fromValues(0.5, 0.5, 0));
            gl.uniformMatrix4fv(this._drawModel.uPMatrix, false, mat_3);

            const color = this.colors[ndx];
            gl.uniform4fv(this._drawModel.uColor, color);

            gl.drawArrays(
                gl.TRIANGLES,
                0,             // offset
                this.positions.length / 2,   // num vertices per instance
            );
        });
        //如果取消绑定，会报错GL_INVALID_OPERATION: Insufficient buffer size.
        gl.bindVertexArray(null);
    }
    onRemove(map, gl) {
        gl.deleteProgram(this._drawModel.program);
    }
}

export async function run(mapdiv, gui = null) {
    // 初始化地图
    let baseMap = 'vector';
    const map = initMap(mapdiv, baseMap, [118, 32], 7);

    // 构造图层
    const layer = new CustomeLayer();
    map.on('load', function () {
        map.addLayer(layer);
    });
}
