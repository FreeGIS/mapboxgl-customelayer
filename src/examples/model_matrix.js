import initMap from '../util/initMap';
import uuid from '../util/uuid';
import { createModel, createBuffer, bindAttribute, createIndicesBuffer } from '../util/webgl_util';
import { vec3, mat4 } from 'gl-matrix';


/////////////////////////
// 测试数据
/////////////////////////
//单位为米的一个正方体。想要平移到地图点[118,32]位置处。
const positions = [
    -10000, -10000, -10000,
    10000, -10000, -10000,
    -10000, -10000, 10000,
    10000, -10000, 10000,
    -10000, 10000, -10000,
    10000, 10000, -10000,
    -10000, 10000, 10000,
    10000, 10000, 10000
];


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
        this._map = map;
        this._gl = gl;
        // 根据数据构造program vao等
        const vs = `#version 300 es
        layout(location=0) in vec3 a_position;
        uniform mat4 uPMatrix;
        void main() {
            gl_Position = uPMatrix * vec4(a_position, 1.0);
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

        const positionarray = new Float32Array(positions);

        // 绑定坐标顶点
        const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, positionarray);
        bindAttribute(gl, positionBuffer, 0, 3);

        this._elementType = createIndicesBuffer(gl, indices, positionarray.length / 3);
        this._positionCount = indices.length;

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
        // 为了模型能显示，要从模型坐标系转换到地图坐标系
        // 先平移10000米，将立方体置于水平，避免其负数在地下不显示
        const mat_1 = mat4.fromTranslation([], vec3.fromValues(0, 0, 10000));
        // 再根据地图比例尺缩放下
        const mat_2 = mat4.fromScaling([], vec3.fromValues(this.modelTransform.scale, -this.modelTransform.scale, this.modelTransform.scale));
        // 矩阵乘法先变换的矩阵  放右边，后变换的矩阵放左边。
        // 本例子要求先平移（mat_1)，再缩放(mat_2);
        const mat_3 = mat4.multiply([], mat_2, mat_1);

        // 为简化写法，也可以使用如下语句
        /*
            const mat_1 = mat4.fromScaling([], vec3.fromValues(this.modelTransform.scale, -this.modelTransform.scale, this.modelTransform.scale));
            // 也是表达先平移再缩放的意思。右边的矩阵或参数先执行，再执行矩阵中的变换。
            const mat_2 = mat4.translate([], mat_1, vec3.fromValues(0, 0, 10000));
        */
        // 3 再平移到指定中心点 mkt 0-1坐标系下
        const mat_4 = mat4.fromTranslation([], vec3.fromValues(this.modelTransform.translateX, this.modelTransform.translateY, this.modelTransform.translateZ));
        this.modelMatrix = mat4.multiply([], mat_4, mat_3);


        // 绑定结束        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);
    }
    render(gl, matrix) {
        gl.useProgram(this._drawModel.program);
        //设置unifrom
        const projMatrix = mat4.multiply([], matrix, this.modelMatrix);
        gl.uniformMatrix4fv(this._drawModel.uPMatrix, false, projMatrix);
        //绑定顶点vao
        gl.bindVertexArray(this._vao);
        gl.drawElements(gl.TRIANGLES, this._positionCount, this._elementType, 0);
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
    const map = initMap(mapdiv, baseMap, [118, 32], 8);

    // 构造图层
    const layer = new CustomeLayer();
    map.on('load', function () {
        map.addLayer(layer);
    });
}