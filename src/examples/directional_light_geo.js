import initMap from '../util/initMap';
import uuid from '../util/uuid';
import { createModel, createBuffer, bindAttribute } from '../util/webgl_util';
import { vec3, mat4 } from 'gl-matrix';
import { getPositionNormal } from '../util/position_normal';
import proj4 from 'proj4';
import fromLngLat from '../util/fromLonLat';
function degToRad(d) {
    return d * Math.PI / 180;
}
/////////////////////////
// 测试数据
/////////////////////////
//单位为米的一F，要平移到地图点[118,32]位置处显示
// 坐标统一以逆时针顺序，否则法向量计算会乱
var positions = new Float32Array([
    //  bottom
    117, 32, 0,
    117, 33, 0,
    118, 32, 0,
    117, 33, 0,
    118, 33, 0,
    118, 32, 0,

    //  top
    117, 32, 20000,
    118, 32, 20000,
    117, 33, 20000,
    117, 33, 20000,
    118, 32, 20000,
    118, 33, 20000,

    // front 地图的y轴与世界坐标系相反
    117, 32, 0,
    118, 32, 0,
    118, 32, 20000,
    117, 32, 0,
    118, 32, 20000,
    117, 32, 20000,

    117, 32, 0,
    117, 32, 20000,
    117, 33, 20000,
    117, 32, 0,
    117, 33, 20000,
    117, 33, 0,

    118, 32, 20000,
    118, 32, 0,
    118, 33, 20000,
    118, 33, 20000,
    118, 32, 0,
    118, 33, 0,

    // back
    117, 33, 20000,
    118, 33, 20000,
    117, 33, 0,
    117, 33, 0,
    118, 33, 20000,
    118, 33, 0
]);


const colors = new Float32Array([
    // bottom
    0.0, 0, 1, 1,
    0.0, 0, 1, 1,
    0.0, 0, 1, 1,
    0.0, 0, 1, 1,
    0.0, 0, 1, 1,
    0.0, 0, 1, 1,

    //  top
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,

    // back
    0, 1, 0, 1,
    0, 1, 0, 1,
    0, 1, 0, 1,
    0, 1, 0, 1,
    0, 1, 0, 1,
    0, 1, 0, 1,

    1, 1, 0, 1,
    1, 1, 0, 1,
    1, 1, 0, 1,
    1, 1, 0, 1,
    1, 1, 0, 1,
    1, 1, 0, 1,

    1, 1, 0, 1,
    1, 1, 0, 1,
    1, 1, 0, 1,
    1, 1, 0, 1,
    1, 1, 0, 1,
    1, 1, 0, 1,

    1, 0, 0, 1,
    1, 0, 0, 1,
    1, 0, 0, 1,
    1, 0, 0, 1,
    1, 0, 0, 1,
    1, 0, 0, 1
]);

// 统一转墨卡托坐标 米为单位的 坐标

for (let i = 0; i < positions.length; i = i + 3) {
    const coor3857 = fromLngLat([positions[i], positions[i + 1]], positions[i + 2]);
    positions[i] = coor3857.x;
    positions[i + 1] = coor3857.y;
    positions[i + 2] = coor3857.z;
}

// mkt 0-1 坐标系计算法向量
const normals = getPositionNormal(positions);
// 经纬度转mkt01,经过了(1,-1,1)的scale，在计算法向量时，三角形法向量由
// 顺时针，逆时针顺序决定的，需要经过(-1,1,-1)反算回去才是真的法向量。
const mat = mat4.fromScaling([], vec3.fromValues(-1, 1, -1));
for (let i = 0; i < normals.length; i = i + 3) {
    const coor = vec3.transformMat4([], [normals[i], normals[i + 1], normals[i + 2]], mat);
    normals[i] = coor[0];
    normals[i + 1] = coor[1];
    normals[i + 2] = coor[2];
}

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
        layout(location=0) in vec3 a_position;
        layout(location=1) in vec3 a_normal;
        layout(location=2) in vec4 a_color;
        uniform mat4 uPMatrix;
        uniform mat4 u_worldInverseTranspose;
        out vec3 v_normal;
        out vec4 v_color;

        void main() {
          gl_Position = uPMatrix * vec4(a_position,1.0);
          v_normal = mat3(u_worldInverseTranspose) * a_normal;
          v_color = a_color;
        }`;
        const fs = `#version 300 es
        precision highp float;
        in vec3 v_normal;
        uniform vec3 u_reverseLightDirection;
        in vec4 v_color;
        out vec4 outColor;
        void main() {
          vec3 normal = normalize(v_normal);
          float light = dot(normal, u_reverseLightDirection);
        
          outColor = v_color;
          outColor.rgb *= light;
        }`;

        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);

        this._drawModel = createModel(gl, vs, fs);
        // 创建vao
        this._vao = gl.createVertexArray();
        gl.bindVertexArray(this._vao);
        // 绑定坐标顶点
        const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, positions);
        bindAttribute(gl, positionBuffer, 0, 3);
        // 法向量
        const normalBuffer = createBuffer(gl, gl.ARRAY_BUFFER, normals);
        bindAttribute(gl, normalBuffer, 1, 3);

        const colorBuffer = createBuffer(gl, gl.ARRAY_BUFFER, colors);
        bindAttribute(gl, colorBuffer, 2, 4);


        // 绑定结束        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);


        gl.useProgram(this._drawModel.program);

      
        // set the light direction.
        // 注意：片元着色器里直接用，都是webgl的裁剪坐标系的
        let light = [0.5, 0.7, 1];
        gl.uniform3fv(this._drawModel.u_reverseLightDirection, light);
    }
    render(gl, matrix) {
        gl.useProgram(this._drawModel.program);
        //设置unifrom
        gl.uniformMatrix4fv(this._drawModel.uPMatrix, false, matrix);

        const transform = this._map.transform;
        const pitch = degToRad(this._map.getPitch());
        //地图旋转后，修改法向量参数
        let worldMatrix = mat4.fromXRotation([], -1 * pitch);
        mat4.rotateZ(worldMatrix, worldMatrix, -1 * transform.angle);

        const worldInverseMatrix = mat4.invert([], worldMatrix);
        const worldInverseTransposeMatrix = mat4.transpose([], worldInverseMatrix);
        gl.uniformMatrix4fv(this._drawModel.u_worldInverseTranspose, false, worldInverseTransposeMatrix);

        //绑定顶点vao
        gl.bindVertexArray(this._vao);

        gl.drawArrays(gl.TRIANGLES, 0, positions.length / 3);
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
    const map = initMap(mapdiv, baseMap, [117.5, 32.5], 6);

    // 构造图层
    const layer = new CustomeLayer();
    map.on('load', function () {
        map.addLayer(layer);
    });
}