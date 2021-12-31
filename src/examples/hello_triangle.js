import initMap from '../util/initMap';
import fromLngLat from '../util/fromLonLat';
import uuid from '../util/uuid';
import { createModel, createBuffer, bindAttribute } from '../util/webgl_util';

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
        layout(location=1) in vec3 a_color;
        uniform mat4 uPMatrix;
        out vec3 vColor;
        void main() {
            vColor = a_color;
            gl_Position = uPMatrix * vec4(a_position, 0, 1.0);
        }`;
        const fs = `#version 300 es
        precision highp int;
        precision highp float;
        in vec3 vColor;
        out vec4 outColor;
        void main() {
            outColor = vec4(vColor,0.5);
        }`;
        this._drawModel = createModel(gl, vs, fs);
        // 创建vao
        this._vao = gl.createVertexArray();
        gl.bindVertexArray(this._vao);

        const coordinates = [
            [-73.9819, 40.7681], // Columbus Circle
            [-73.98513, 40.758896], // Times Square
            [-73.9786, 40.7589] // Rockafeller Center
        ];

        const positions = new Float32Array(6);

        coordinates.forEach((point, i) => {
            const coords = fromLngLat(point);
            positions[i * 2] = coords.x;
            positions[i * 2 + 1] = coords.y;
        });

        // 绑定坐标顶点
        const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, positions);
        bindAttribute(gl, positionBuffer, 0, 2);
        // 绑定颜色顶点
        const colorBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array([1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0]));
        bindAttribute(gl, colorBuffer, 1, 3);
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
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 3);
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
    const map = initMap(mapdiv, baseMap, [-73.98213, 40.762896], 14);

    // 构造图层
    const layer = new CustomeLayer();
    map.on('load', function () {
        map.addLayer(layer);
    });
}
