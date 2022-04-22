import initMap from '../util/initMap';
import uuid from '../util/uuid';
import { createModel, createBuffer, bindAttribute } from '../util/webgl_util';
import { vec3, vec4, mat4 } from 'gl-matrix';
import { getPositionNormal } from '../util/position_normal';

function degToRad(d) {
    return d * Math.PI / 180;
}
/////////////////////////
// 测试数据
/////////////////////////
//单位为米的一F，要平移到地图点[118,32]位置处显示
// 坐标统一以逆时针顺序，否则法向量计算会乱
var positions = new Float32Array([
    // left column front
    0, 0, 0,
    0, 150, 0,
    30, 0, 0,
    0, 150, 0,
    30, 150, 0,
    30, 0, 0,

    // top rung front
    30, 0, 0,
    30, 30, 0,
    100, 0, 0,
    30, 30, 0,
    100, 30, 0,
    100, 0, 0,

    // middle rung front
    30, 60, 0,
    30, 90, 0,
    67, 60, 0,
    30, 90, 0,
    67, 90, 0,
    67, 60, 0,

    // left column back
    0, 0, 30,
    30, 0, 30,
    0, 150, 30,
    0, 150, 30,
    30, 0, 30,
    30, 150, 30,

    // top rung back
    30, 0, 30,
    100, 0, 30,
    30, 30, 30,
    30, 30, 30,
    100, 0, 30,
    100, 30, 30,

    // middle rung back
    30, 60, 30,
    67, 60, 30,
    30, 90, 30,
    30, 90, 30,
    67, 60, 30,
    67, 90, 30,

    // top
    0, 0, 0,
    100, 0, 0,
    100, 0, 30,
    0, 0, 0,
    100, 0, 30,
    0, 0, 30,

    // top rung right
    100, 0, 0,
    100, 30, 0,
    100, 30, 30,
    100, 0, 0,
    100, 30, 30,
    100, 0, 30,

    // under top rung
    30, 30, 0,
    30, 30, 30,
    100, 30, 30,
    30, 30, 0,
    100, 30, 30,
    100, 30, 0,

    // between top rung and middle
    30, 30, 0,
    30, 60, 30,
    30, 30, 30,
    30, 30, 0,
    30, 60, 0,
    30, 60, 30,

    // top of middle rung
    30, 60, 0,
    67, 60, 30,
    30, 60, 30,
    30, 60, 0,
    67, 60, 0,
    67, 60, 30,

    // right of middle rung
    67, 60, 0,
    67, 90, 30,
    67, 60, 30,
    67, 60, 0,
    67, 90, 0,
    67, 90, 30,

    // bottom of middle rung.
    30, 90, 0,
    30, 90, 30,
    67, 90, 30,
    30, 90, 0,
    67, 90, 30,
    67, 90, 0,

    // right of bottom
    30, 90, 0,
    30, 150, 30,
    30, 90, 30,
    30, 90, 0,
    30, 150, 0,
    30, 150, 30,

    // bottom
    0, 150, 0,
    0, 150, 30,
    30, 150, 30,
    0, 150, 0,
    30, 150, 30,
    30, 150, 0,

    // left side
    0, 0, 0,
    0, 0, 30,
    0, 150, 30,
    0, 0, 0,
    0, 150, 30,
    0, 150, 0,
]);

var matrix = mat4.fromXRotation([], Math.PI);
//const mat_2 = mat4.fromTranslation([], vec3.fromValues(-50, -75, -15));
//matrix = mat4.multiply([], mat_2, matrix);


for (var ii = 0; ii < positions.length; ii += 3) {
    var vector = vec4.transformMat4([], vec4.fromValues(positions[ii + 0], positions[ii + 1], positions[ii + 2], 1), matrix);
    positions[ii + 0] = vector[0];
    positions[ii + 1] = vector[1];
    positions[ii + 2] = vector[2];
}
const normals = getPositionNormal(positions);
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
        uniform mat4 uPMatrix;
        uniform mat4 u_worldInverseTranspose;
        out vec3 v_normal;
        
        void main() {
          gl_Position = uPMatrix * vec4(a_position,1.0);
          v_normal = mat3(u_worldInverseTranspose) * a_normal;
          //v_normal = a_normal;
        }`;
        const fs = `#version 300 es
        precision highp float;
        in vec3 v_normal;
        uniform vec3 u_reverseLightDirection;
        uniform vec4 u_color;
        out vec4 outColor;
        void main() {
          vec3 normal = normalize(v_normal);
          float light = dot(normal, u_reverseLightDirection);
        
          outColor = u_color;
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
        // 绑定结束        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);


        // 创建uniforms
        const modelAsMercatorCoordinate = mapboxgl.MercatorCoordinate.fromLngLat(
            [118, 32],
            0
        );
        this.modelTransform = {
            translateX: modelAsMercatorCoordinate.x,
            translateY: modelAsMercatorCoordinate.y,
            translateZ: modelAsMercatorCoordinate.z,
            /* Since the 3D model is in real world meters, a scale transform needs to be
            * applied since the CustomLayerInterface expects units in MercatorCoordinates.
            */
            scale: modelAsMercatorCoordinate.meterInMercatorCoordinateUnits()
        };


        // 先根据地图比例尺缩放下
        const mat_1 = mat4.fromScaling([], vec3.fromValues(this.modelTransform.scale, -1.0 * this.modelTransform.scale, this.modelTransform.scale));
        this._scaleMatrix = mat_1;
        // 为简化写法，也可以使用如下语句
        /*
            const mat_1 = mat4.fromScaling([], vec3.fromValues(this.modelTransform.scale, -this.modelTransform.scale, this.modelTransform.scale));
            // 也是表达先平移再缩放的意思。右边的矩阵或参数先执行，再执行矩阵中的变换。
            const mat_2 = mat4.translate([], mat_1, vec3.fromValues(0, 0, 10000));
        */
        // 3 再平移到指定中心点 mkt 0-1坐标系下
        const mat_2 = mat4.fromTranslation([], vec3.fromValues(this.modelTransform.translateX, this.modelTransform.translateY, this.modelTransform.translateZ));
        this.modelMatrix = mat4.multiply([], mat_2, mat_1);


        gl.useProgram(this._drawModel.program);
        gl.uniform4fv(this._drawModel.u_color, [0.2, 1, 0.2, 1]); // green
        // set the light direction.
        gl.uniform3fv(this._drawModel.u_reverseLightDirection, [0.5, 0.7, 1]);

    }
    render(gl, matrix) {
        gl.useProgram(this._drawModel.program);
        //设置unifrom
        const projMatrix = mat4.multiply([], matrix, this.modelMatrix);
        gl.uniformMatrix4fv(this._drawModel.uPMatrix, false, projMatrix);

        const transform = this._map.transform;
        const pitch = degToRad(this._map.getPitch());
        //地图旋转后，修改法向量参数
        let worldMatrix = mat4.fromXRotation([], -1 * pitch);
        mat4.rotateZ(worldMatrix, worldMatrix, -1 * transform.angle);

        const worldInverseMatrix = mat4.invert([], worldMatrix);
        //const worldInverseTransposeMatrix = mat4.transpose([], worldMatrix);
        const worldInverseTransposeMatrix = mat4.transpose([], worldInverseMatrix);
        gl.uniformMatrix4fv(this._drawModel.u_worldInverseTranspose, false, worldInverseTransposeMatrix);

        //const cameraPosition = this._map.getFreeCameraOptions().position;
        //gl.uniform3fv(this._drawModel.u_reverseLightDirection, [cameraPosition.x, -1*cameraPosition.y, cameraPosition.z]);



        //绑定顶点vao
        gl.bindVertexArray(this._vao);


        const count = 16 * 6;
        gl.drawArrays(gl.TRIANGLES, 0, count);
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
    const map = initMap(mapdiv, baseMap, [118, 32], 15);

    // 构造图层
    const layer = new CustomeLayer();
    map.on('load', function () {
        map.addLayer(layer);
    });
}