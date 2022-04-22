import initMap from '../util/initMap';
import fromLngLat from '../util/fromLonLat';
import uuid from '../util/uuid';
import { createModel, createBuffer, bindAttribute, createIndicesBuffer } from '../util/webgl_util';

/////////////////////////
// 测试数据
/////////////////////////
const positions1 = [
    117, 32, 0,
    118, 32, 0,
    117, 32, 20000,
    118, 32, 20000,
    117, 33, 0,
    118, 33, 0,
    117, 33, 20000,
    118, 33, 20000
];
const positions2 = [
    117.2, 32.2, 5000,
    117.8, 32.2, 5000,
    117.2, 32.2, 15000,
    117.8, 32.2, 15000,
    117.2, 32.8, 5000,
    117.8, 32.8, 5000,
    117.2, 32.8, 15000,
    117.8, 32.8, 15000
]
const indices = [
    0, 1, 2,
    2, 1, 3,
    1, 5, 3,
    3, 5, 7,
    0, 2, 4,
    2, 6, 4,
    4, 6, 5,
    6, 7, 5,
    2, 6, 3,
    6, 7, 3,
    0, 4, 1,
    4, 5, 1
];

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
        // 构造vao
        this._map = map;
        this._gl = gl;
        // 根据数据构造program vao等
        const vs = `#version 300 es
        layout(location=0) in vec3 a_position;
        uniform mat4 u_worldViewProjection;
        void main() {
            gl_Position = u_worldViewProjection*vec4(a_position, 1.0);
        }`;
        const fs = `#version 300 es
        precision highp int;
        precision highp float;
        uniform vec4 u_color; 
        out vec4 outColor;
        void main() {
            outColor = vec4(u_color.xyz*u_color.w,u_color.w);
        }`;
        this._drawModel = createModel(gl, vs, fs);


        let pos1 = new Float32Array(24), pos2 = new Float32Array(24);
        for (let i = 0; i < 24; i = i + 3) {
            const coors1 = fromLngLat([ positions1[ i ], positions1[ i + 1 ] ], positions1[ i + 2 ]);
            const coors2 = fromLngLat([ positions2[ i ], positions2[ i + 1 ] ], positions2[ i + 2 ]);
            pos1[ i ] = coors1.x;
            pos1[ i + 1 ] = coors1.y;
            pos1[ i + 2 ] = coors1.z;

            pos2[ i ] = coors2.x;
            pos2[ i + 1 ] = coors2.y;
            pos2[ i + 2 ] = coors2.z;
        }


        // 创建vao
        this._vao1 = gl.createVertexArray();
        gl.bindVertexArray(this._vao1);
        // 绑定坐标顶点
        const positionBuffer1 = createBuffer(gl, gl.ARRAY_BUFFER, pos1);
        bindAttribute(gl, positionBuffer1, 0, 3);
        // 顶点索引，unit8array对应gl.UNSIGNED_BYTE
        this._elementType1 = createIndicesBuffer(gl, indices, 24 / 3);
        this._positionCount1 = indices.length;
        // 绑定结束        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);

        this._vao2 = gl.createVertexArray();
        gl.bindVertexArray(this._vao2);
        // 绑定坐标顶点
        const positionBuffer2 = createBuffer(gl, gl.ARRAY_BUFFER, pos2);
        bindAttribute(gl, positionBuffer2, 0, 3);
        // 顶点索引，unit8array对应gl.UNSIGNED_BYTE
        this._elementType2 = createIndicesBuffer(gl, indices, 24 / 3);
        this._positionCount2 = indices.length;
        // 绑定结束        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);

    }
    render(gl, matrix) {
        gl.useProgram(this._drawModel.program);
        //设置unifrom
        gl.uniformMatrix4fv(this._drawModel.u_worldViewProjection, false, matrix);

        // 1 开启深度测试
        gl.enable(gl.DEPTH_TEST);
        // 2 绘制所有不透明物体 alpha=1.0
        gl.bindVertexArray(this._vao2);
        gl.uniform4fv(this._drawModel.u_color, new Float32Array([ 1.0, 0, 0, 1.0 ]));
        gl.drawElements(gl.TRIANGLES, this._positionCount2, this._elementType2, 0);
        // 3 锁定深度缓冲区写入操作，使其只读
        gl.depthMask(false);
        // 4 绘制所有透明物体 alpha<1.0 这里实际需要根据相机位置排序物体的
        gl.bindVertexArray(this._vao1);
        gl.uniform4fv(this._drawModel.u_color, new Float32Array([ 0.0, 1.0, 0, 0.3 ]));
        gl.drawElements(gl.TRIANGLES, this._positionCount1, this._elementType1, 0);
        // 5 释放深度缓冲区，使其可读写
        gl.depthMask(true);

        //如果取消绑定，会报错GL_INVALID_OPERATION: Insufficient buffer size.
        gl.bindVertexArray(null);
    }
}



export async function run(mapdiv, gui = null) {
    // 初始化地图
    let baseMap = 'vector';
    const map = initMap(mapdiv, baseMap, [ 117.5, 32.5 ], 7);

    const layer = new CustomeLayer();
    map.on('load', function () {
        map.addLayer(layer);
    });
}
