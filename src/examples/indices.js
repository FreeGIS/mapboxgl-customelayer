import initMap from '../util/initMap';
import fromLngLat from '../util/fromLonLat';
import uuid from '../util/uuid';
import { createModel, createBuffer, bindAttribute, createIndicesBuffer } from '../util/webgl_util';

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
        uniform mat4 uPMatrix;
        void main() {
            gl_Position = uPMatrix * vec4(a_position, 0, 1.0);
        }`;
        const fs = `#version 300 es
        precision highp int;
        precision highp float;
        out vec4 outColor;
        void main() {
            outColor = vec4(0.5,0.0,0.0,0.5);
        }`;
        this._drawModel = createModel(gl, vs, fs);
        // 创建vao
        this._vao = gl.createVertexArray();
        gl.bindVertexArray(this._vao);

        const coordinates = [
            [118, 32],
            [119, 32],
            [119, 33],
            [118, 33]
        ];

        const positions = new Float32Array(coordinates.length * 2);
        coordinates.forEach((point, i) => {
            const coords = fromLngLat(point);
            positions[i * 2] = coords.x;
            positions[i * 2 + 1] = coords.y;
        });

        const indices = [
            0, 1, 3,
            1, 3, 2
        ];
        // 绑定坐标顶点
        const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, positions);
        bindAttribute(gl, positionBuffer, 0, 2);

        this._elementType = createIndicesBuffer(gl, indices, positions.length / 2);
        this._positionCount = indices.length;

        // 绑定结束        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);
    }
    render(gl, matrix) {
        gl.useProgram(this._drawModel.program);
        //设置unifrom
        gl.uniformMatrix4fv(this._drawModel.uPMatrix, false, matrix);
        //绑定顶点vao
        gl.bindVertexArray(this._vao);
        gl.drawElements(gl.TRIANGLES, this._positionCount, this._elementType, 0);
        //如果取消绑定，会报错GL_INVALID_OPERATION: Insufficient buffer size.
        gl.bindVertexArray(null);
    }
}

export async function run(mapdiv, gui = null) {
    // 初始化地图
    let baseMap = 'vector';
    const map = initMap(mapdiv, baseMap, [118.5, 32.5], 6);

    // 构造图层
    const layer = new CustomeLayer();
    map.on('load', function () {
        map.addLayer(layer);
    });
}
