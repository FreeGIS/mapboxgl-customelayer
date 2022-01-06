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
            // vec2 position = (uPMatrix * vec3(a_position, 1)).xy;
            gl_Position = uPMatrix * vec4(a_position, 0.0,1.0);
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
            [ 1, 0, 0, 1, ],  // red
            [ 0, 1, 0, 1, ],  // green
            [ 0, 0, 1, 1, ],  // blue
            [ 1, 0, 1, 1, ],  // magenta
            [ 0, 1, 1, 1, ],  // cyan
        ];



        this.positions = new Float32Array(coordinates.length);

        for (let i = 0; i < coordinates.length; i = i + 2) {
            // 测试数据平移到一个真实的经纬度点位置为中心
            const coords = fromLngLat([ coordinates[ i ] + 118, coordinates[ i + 1 ] + 32 ]);
            this.positions[ i ] = coords.x;
            this.positions[ i + 1 ] = coords.y;
        }

        this.matrices = [1,2,3,4,5];

        // 绑定坐标顶点
        const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, this.positions);
        bindAttribute(gl, positionBuffer, 0, 2);
     
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
        if(!this.start)
            this.start = currenttime;
        
        const time = (currenttime -  this.start)*0.001;

        //绑定顶点vao
        gl.bindVertexArray(this._vao);

        this.matrices.forEach((item, ndx) => {
            // 1 先平移
            const mat_1 = mat4.fromTranslation([], vec3.fromValues(-this.modelAsMercatorCoordinate.x, -this.modelAsMercatorCoordinate.y, -this.modelAsMercatorCoordinate.z));
            // 2 z轴旋转
            const mat_2 = mat4.fromZRotation([], time * (0.1 + 0.1 * ndx));
            // 3 合并计算，先平移再旋转
            const mat_3 = mat4.multiply([], mat_2, mat_1);
            // 4 再平移回来，每次x轴微调一个偏移量
            const mat_4 = mat4.fromTranslation([], vec3.fromValues(this.modelAsMercatorCoordinate.x -0.002 + ndx * 0.001, this.modelAsMercatorCoordinate.y, this.modelAsMercatorCoordinate.z));
            const mat_5 = mat4.multiply([], mat_4, mat_3);
            // 5 合并地图mvp矩阵
            const mat_6 = mat4.multiply([], matrix, mat_5);
            gl.uniformMatrix4fv(this._drawModel.uPMatrix, false, mat_6);

            const color = this.colors[ ndx ];
            gl.uniform4fv(this._drawModel.uColor, color);

            gl.drawArrays(
                gl.TRIANGLES,
                0,             // offset
                this.positions.length / 2,   // num vertices per instance
            );
        });
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
