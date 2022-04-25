// 点光源 显示仍然有问题
import initMap from '../util/initMap';
import uuid from '../util/uuid';
import { createModel, createBuffer, bindAttribute } from '../util/webgl_util';
import { mat4 } from 'gl-matrix';
import { getPositionNormal } from '../util/position_normal';
import fromLngLat from '../util/fromLonLat';
import proj4 from 'proj4';
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

    // front
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
let positions_mkt = new Float32Array(positions.length);
let position_mapbox_mkt = new Float32Array(positions.length);
for (let i = 0; i < positions.length; i = i + 3) {
    const coor_mkt = fromLngLat([positions[i], positions[i + 1]], positions[i + 2]);
    position_mapbox_mkt[i] = coor_mkt.x;
    position_mapbox_mkt[i + 1] = coor_mkt.y;
    position_mapbox_mkt[i + 2] = coor_mkt.z;
    // 转经纬度
    const coor3857 = proj4('EPSG:4326', 'EPSG:3857').forward([positions[i], positions[i + 1]]);
    positions_mkt[i] = coor3857[0];
    positions_mkt[i + 1] = coor3857[1];
    positions_mkt[i + 2] = positions[i + 2];
}
// 法向量用 墨卡托米为单位去计算，该坐标系下xyz轴与世界坐标系轴相同。
// 如果用mapbox的mkt坐标算，因为其y轴进行了-1转换，导致position原来是顺时针的三角形逆时针了，方向反了，法向量也就错了。
const normals = getPositionNormal(positions_mkt);

const light_pt = fromLngLat([117.5,32.5],30000);

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
        // 点光源位置
        uniform vec3 u_lightWorldPosition;

        out vec3 v_normal;
        out vec4 v_color;
        out vec3 v_surfaceToLight;
        void main() {
          gl_Position = uPMatrix * vec4(a_position,1.0);
          v_normal = mat3(u_worldInverseTranspose)* a_normal;
          //v_normal = a_normal;
          v_color = a_color;
          v_surfaceToLight = u_lightWorldPosition - a_position;
        }`;
        const fs = `#version 300 es
        precision highp float;
        in vec3 v_normal;
        in vec4 v_color;
        in vec3 v_surfaceToLight;
        out vec4 outColor;
        void main() {
          vec3 normal = normalize(v_normal);
          vec3 surfaceToLightDirection = normalize(v_surfaceToLight);
          float light = dot(normal, surfaceToLightDirection);
        
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
        const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, position_mapbox_mkt);
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
        // 注意：点光源位置，mkt0-1坐标系，世界坐标系
        let light = [light_pt.x,light_pt.y,light_pt.z];
        gl.uniform3fv(this._drawModel.u_lightWorldPosition, light);
        //gl.uniformMatrix4fv(this._drawModel.u_modelMatrix, false, mat);
    }
    render(gl, matrix) {
        gl.useProgram(this._drawModel.program);
        //设置unifrom
        gl.uniformMatrix4fv(this._drawModel.uPMatrix, false, matrix);

        const angle = this._map.transform.angle;
        const pitch = degToRad(this._map.getPitch());
        //地图旋转后，视图矩阵发生变化。为了还原回法向量所在的世界矩阵，所有的旋转和缩放都乘以-1
        let worldMatrix = mat4.fromXRotation([], -1 * pitch);
        mat4.rotateZ(worldMatrix, worldMatrix, -1 * angle);
     
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