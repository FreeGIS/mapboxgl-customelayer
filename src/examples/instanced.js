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
        layout(location=1) in vec4 a_color;
        layout(location=2) in mat4 uPMatrix;
        out vec4 vColor;
        void main() {
            gl_Position = uPMatrix * vec4(a_position, 0.0,1.0);
            vColor = a_color;
        }`;
        const fs = `#version 300 es
        precision highp int;
        precision highp float;
        in vec4 vColor;
        out vec4 outColor;
        void main() {
            outColor = vColor;
        }`;
        this._drawModel = createModel(gl, vs, fs);
        // 定义属性的layerout位置
        const positionLoc = 0;
        const colorLoc = 1;
        const matrixLoc = 2;
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
        this.colors = new Float32Array([
            1, 0, 0, 1,  // red
            0, 1, 0, 1,  // green
            0, 0, 1, 1,  // blue
            1, 0, 1, 1,  // magenta
            0, 1, 1, 1  // cyan
        ]);

        this.numVertices = coordinates.length / 2;

        this.positions = new Float32Array(coordinates.length);

        for (let i = 0; i < coordinates.length; i = i + 2) {
            // 测试数据平移到一个真实的经纬度点位置为中心
            const coords = fromLngLat([ coordinates[ i ] + 118, coordinates[ i + 1 ] + 32 ]);
            this.positions[ i ] = coords.x;
            this.positions[ i + 1 ] = coords.y;
        }



        // setup matrixes, one per instance
        const numInstances = 5;
        this.numInstances = numInstances;
        // make a typed array with one view per matrix
        this.matrixData = new Float32Array(numInstances * 16);
        this.matrixBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.matrixBuffer);
        // gl.DYNAMIC_DRAW 告诉着色器这些数据经常变化，动态的，常规的用STATIC_DRAW
        gl.bufferData(gl.ARRAY_BUFFER, this.matrixData.byteLength, gl.DYNAMIC_DRAW);

        // set all 4 attributes for matrix
        const bytesPerMatrix = 4 * 16;
        for (let i = 0; i < 4; ++i) {
            const loc = matrixLoc + i;
            gl.enableVertexAttribArray(loc);
            // note the stride and offset
            const offset = i * 16;  // 4 floats per row, 4 bytes per float
            gl.vertexAttribPointer(
                loc,              // location
                4,                // size (num values to pull from buffer per iteration)
                gl.FLOAT,         // type of data in buffer
                false,            // normalize
                bytesPerMatrix,   // stride, num bytes to advance to get to next set of values
                offset,           // offset in buffer
            );
            // this line says this attribute only changes for each 1 instance
            gl.vertexAttribDivisor(loc, 1);
        }

        // 绑定坐标顶点
        const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, this.positions);
        bindAttribute(gl, positionBuffer, positionLoc, 2);
        // 绑定颜色
        const colorBuffer = createBuffer(gl, gl.ARRAY_BUFFER, this.colors);
        bindAttribute(gl, colorBuffer, colorLoc, 4);
        // this line says this attribute only changes for each 1 instance
        gl.vertexAttribDivisor(colorLoc, 1);




        // 绑定结束        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);

        const modelOrigin = [ 118, 32 ];
        const modelAltitude = 0;

        this.modelAsMercatorCoordinate = fromLngLat(
            modelOrigin,
            modelAltitude
        );
    }
    render(gl, matrix) {
        gl.useProgram(this._drawModel.program);
        const currenttime = Date.now();
        if (!this.start)
            this.start = currenttime;

        const time = (currenttime - this.start) * 0.001;

        //绑定顶点vao
        gl.bindVertexArray(this._vao);

        for (let ndx = 0; ndx < this.numInstances; ndx++) {
            // 1 先平移
            const mat_1 = mat4.fromTranslation([], vec3.fromValues(-this.modelAsMercatorCoordinate.x, -this.modelAsMercatorCoordinate.y, -this.modelAsMercatorCoordinate.z));
            // 2 z轴旋转
            const mat_2 = mat4.fromZRotation([], time * (0.1 + 0.1 * ndx));
            // 3 合并计算，先平移再旋转
            const mat_3 = mat4.multiply([], mat_2, mat_1);
            // 4 再平移回来，每次x轴微调一个偏移量
            const mat_4 = mat4.fromTranslation([], vec3.fromValues(this.modelAsMercatorCoordinate.x - 0.002 + ndx * 0.001, this.modelAsMercatorCoordinate.y, this.modelAsMercatorCoordinate.z));
            const mat_5 = mat4.multiply([], mat_4, mat_3);
            // 5 合并地图mvp矩阵
            const mat_6 = mat4.multiply([], matrix, mat_5);
            // 更新每个实例的矩阵属性
            for (let i = 0; i < 16; i++) {
                this.matrixData[ 16 * ndx + i ] = mat_6[ i ];
            }
        }
        // upload the new matrix data
        gl.bindBuffer(gl.ARRAY_BUFFER, this.matrixBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.matrixData);
     

        gl.drawArraysInstanced(
            gl.TRIANGLES,
            0, // 偏移
            this.numVertices, // 每个实例的顶点数
            this.numInstances // 实例的数量
        )

        //如果取消绑定，会报错GL_INVALID_OPERATION: Insufficient buffer size.
        gl.bindVertexArray(null);
        this._map.triggerRepaint();
    }
    onRemove(map, gl) {
        gl.deleteProgram(this._drawModel.program);
    }
}

export async function run(mapdiv, gui = null) {
    // 初始化地图
    let baseMap = 'vector';
    const map = initMap(mapdiv, baseMap, [ 118, 32 ], 7);

    // 构造图层
    const layer = new CustomeLayer();
    map.on('load', function () {
        map.addLayer(layer);
    });
}
