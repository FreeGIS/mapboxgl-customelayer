import initMap from '../util/initMap';
import fromLngLat from '../util/fromLonLat';
import uuid from '../util/uuid';
import { createModel, createBuffer, bindAttribute, createIndicesBuffer } from '../util/webgl_util';
import proj4 from 'proj4';
import demData from '../../datas/dem.json';
// demData 数据每9个一组，每组元数据如下
// 与起点X距离 与起点Y距离 高程值 颜色R 颜色G 颜色B 法向量X坐标 法向量Y坐标 法向量Z坐标

// 头文件 起点X坐标 起点Y坐标 X间距 Y间距 宽 高
const demHeaders = [
    399650.000000, 3997530.000000, 10.000000, -10.000000, 78, 240
];
const dataEPSG = 32612;
proj4.defs(`EPSG:${dataEPSG}`, "+proj=utm +zone=12 +datum=WGS84 +units=m +no_defs");
// 需要将demData首先转WGS84经纬度再转墨卡托0-1坐标系
function dataParse() {
    const length = demData.length;
    let pos = new Float32Array(length / 3);
    let color = new Float32Array(length / 3);
    for (let i = 0; i < length; i = i + 9) {
        const coors = [demHeaders[0] + demData[i], demHeaders[1] + demData[i + 1]];
        const wgs84Coor = proj4(`EPSG:${dataEPSG}`, 'EPSG:4326').forward(coors);
        const mktCoor = fromLngLat(wgs84Coor, demData[i + 2]);
        // 转换顶点数组的相对序号
        let _index = i / 3;
        pos[_index] = mktCoor.x;
        pos[_index + 1] = mktCoor.y;
        pos[_index + 2] = mktCoor.z;

        color[_index] = demData[i + 3];
        color[_index + 1] = demData[i + 4];
        color[_index + 2] = demData[i + 5];
    }
    //DEM的一个网格是由两个三角形组成的
    //      0------1            1
    //      |                   |
    //      |                   |
    //      col       col------col+1  


    const col = demHeaders[4];
    const row = demHeaders[5];
    let indices = new Array((row - 1) * (col - 1) * 6);
    let ci = 0;
    for (let yi = 0; yi < row - 1; yi++) {
        for (let xi = 0; xi < col - 1; xi++) {
            indices[ci * 6] = yi * col + xi;
            indices[ci * 6 + 1] = (yi + 1) * col + xi;
            indices[ci * 6 + 2] = (yi + 1) * col + xi + 1;

            indices[ci * 6 + 3] = yi * col + xi;
            indices[ci * 6 + 4] = (yi + 1) * col + xi + 1;
            indices[ci * 6 + 5] = yi * col + xi + 1;
            ci++;
        }
    }
    return { pos, indices, color };
}
class DemLayer {
    constructor(demData) {
        this._id = uuid();
        this._demData = demData;
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
        layout(location=1) in vec3 a_color;
        uniform mat4 u_worldViewProjection;
        out vec3 v_color;
        void main() {
            gl_Position = u_worldViewProjection*vec4(a_position, 1.0);
            v_color = a_color;
        }`;
        const fs = `#version 300 es
        precision highp int;
        precision highp float;
        in vec3 v_color;
        out vec4 outColor;
        void main() {
            outColor = vec4(v_color*0.75,0.75);
        }`;
        this._drawModel = createModel(gl, vs, fs);
        // 创建vao
        this._vao = gl.createVertexArray();
        gl.bindVertexArray(this._vao);
        // 绑定坐标顶点
        const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(this._demData.pos));
        bindAttribute(gl, positionBuffer, 0, 3);
        // 绑定颜色顶点
        const colorBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(this._demData.color));
        bindAttribute(gl, colorBuffer, 1, 3);
        // 顶点索引，unit8array对应gl.UNSIGNED_BYTE
        this._elementType = createIndicesBuffer(gl, this._demData.indices, this._demData.pos.length);
        this._positionCount = this._demData.indices.length;
        // 绑定结束        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);

        // 开启深度测试
        gl.enable(gl.DEPTH_TEST);

        //清空颜色和深度缓冲区
        gl.clear(gl.DEPTH_BUFFER_BIT);
    }
    render(gl, matrix) {
        gl.useProgram(this._drawModel.program);
        //设置unifrom
        gl.uniformMatrix4fv(this._drawModel.u_worldViewProjection, false, matrix);
        //绑定顶点vao
        gl.bindVertexArray(this._vao);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.drawElements(gl.TRIANGLES, this._positionCount, this._elementType, 0);
        //如果取消绑定，会报错GL_INVALID_OPERATION: Insufficient buffer size.
        gl.bindVertexArray(null);
    }
}


export async function run(mapdiv, gui = null) {
    // 初始化地图
    let baseMap = 'vector';
    const map = initMap(mapdiv, baseMap, [-112.11505254567393, 36.117259614117756], 10);
    // 数据处理，转换坐标系
    const demdata = dataParse();
    // 构造图层
    const demLayer = new DemLayer(demdata);
    map.on('load', function () {
        map.addLayer(demLayer);
        console.log(map.getFreeCameraOptions());
        console.log(map.getCameraPosition(true));
    });
}


