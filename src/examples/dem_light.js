import initMap from '../util/initMap';
import fromLngLat from '../util/fromLonLat';
import uuid from '../util/uuid';
import { createModel, createBuffer, bindAttribute, createIndicesBuffer } from '../util/webgl_util';
import { vec3 } from 'gl-matrix';
import getNormal from '../util/getNormal';
import proj4 from 'proj4';
import demData from '../../datas/dem.json';
// demData 数据每9个一组，每组元数据如下
// 与起点X距离 与起点Y距离 高程值 颜色R 颜色G 颜色B 法向量X坐标 法向量Y坐标 法向量Z坐标

// 头文件 起点X坐标 起点Y坐标 X间距 Y间距 宽 高
const demHeaders = [
    399650.000000, 3997530.000000, 10.000000, -10.000000, 78, 240
];
const dataEPSG = 32612;
proj4.defs("EPSG:32612", "+proj=utm +zone=12 +datum=WGS84 +units=m +no_defs");
// 需要将demData首先转WGS84经纬度再转墨卡托0-1坐标系
function dataParse() {
    const length = demData.length;
    let pos = new Float32Array(length / 3);
    let color = new Float32Array(length / 3);
    let normal = new Float32Array(length / 3);
    let originCoors = new Array(length / 3);
    for (let i = 0; i < length; i = i + 9) {
        const coors = [demHeaders[0] + demData[i], demHeaders[1] + demData[i + 1]];
        const wgs84Coor = proj4('EPSG:32612', 'EPSG:4326').forward(coors);
        const mktCoor = fromLngLat(wgs84Coor, demData[i + 2]);
        // 转换顶点数组的相对序号
        let _index = i / 3;
        originCoors[_index] = coors[0];
        originCoors[_index + 1] = coors[1];
        originCoors[_index + 2] = demData[i + 2];


        pos[_index] = mktCoor.x;
        pos[_index + 1] = mktCoor.y;
        pos[_index + 2] = mktCoor.z;

        color[_index] = demData[i + 3];
        color[_index + 1] = demData[i + 4];
        color[_index + 2] = demData[i + 5];

        //normal[_index] = demData[i + 6];
        //normal[_index + 1] = demData[i + 7];
        //normal[_index + 2] = demData[i + 8];
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
    // 根据三角形indices，计算各个顶点的法向量
    console.time('normal');
    const indicesLength = indices.length;
    let normalHash = new Map();
    for (let i = 0; i < indicesLength; i = i + 3) {
        const a_index = indices[i];
        const b_index = indices[i + 1];
        const c_index = indices[i + 2];
        const a_coorIndex = a_index * 3;
        const b_coorIndex = b_index * 3;
        const c_coorIndex = c_index * 3;
        const point_a = [originCoors[a_coorIndex], originCoors[a_coorIndex + 1], originCoors[a_coorIndex + 2]];
        const point_b = [originCoors[b_coorIndex], originCoors[b_coorIndex + 1], originCoors[b_coorIndex + 2]];
        const point_c = [originCoors[c_coorIndex], originCoors[c_coorIndex + 1], originCoors[c_coorIndex + 2]];
        const d = getNormal(point_a,point_b,point_c);
        // 分别记录三个顶点的法向量，用于向量相加（所谓的平均就是顶点的各个法向量相加，最后的结果归一化即可）
        if (!normalHash.get(indices[i]))
            normalHash.set(indices[i], d);
        else {
            let normaladd = vec3.add([], normalHash.get(indices[i]), d);
            normalHash.set(indices[i], normaladd);
        }
        if (!normalHash.get(indices[i + 1]))
            normalHash.set(indices[i + 1], d);
        else {
            let normaladd = vec3.add([], normalHash.get(indices[i + 1]), d);
            normalHash.set(indices[i + 1], normaladd);
        }
        if (!normalHash.get(indices[i + 2]))
            normalHash.set(indices[i + 2], d);
        else {
            let normaladd = vec3.add([], normalHash.get(indices[i + 2]), d);
            normalHash.set(indices[i + 2], normaladd);
        }
    }
    // 应该根据面积加权平均，这里格点比较均匀，直接平均测试
    for (let [key, value] of normalHash) {
        const d_normal = vec3.normalize([], value);
        normal[key*3] = d_normal[0];
        normal[key*3+1] = d_normal[1];
        normal[key*3+2] = d_normal[2];
    }
    console.timeEnd('normal');
    return { pos, indices, color, normal };
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
    //设置灯光
    _setLight(gl) {
        //设置漫反射光
        gl.uniform3f(this._drawModel.u_DiffuseLight, 1.0, 1.0, 1.0);
        // 设置光线方向(世界坐标系下的)
        var solarAltitude = 45.0;
        var solarAzimuth = 315.0;
        var fAltitude = solarAltitude * Math.PI / 180; //光源高度角
        var fAzimuth = solarAzimuth * Math.PI / 180; //光源方位角

        var arrayvectorX = Math.cos(fAltitude) * Math.cos(fAzimuth);
        var arrayvectorY = Math.cos(fAltitude) * Math.sin(fAzimuth);
        var arrayvectorZ = Math.sin(fAltitude);
        let lightDirection = vec3.fromValues(arrayvectorX, arrayvectorY, arrayvectorZ);
        let normallightDirection = [];
        vec3.normalize(normallightDirection, lightDirection);
        gl.uniform3fv(this._drawModel.u_LightDirection, new Float32Array(normallightDirection));
        //设置环境光
        gl.uniform3f(this._drawModel.u_AmbientLight, 0.2, 0.2, 0.2);
    }
    onAdd(map, gl) {
        this._map = map;
        this._gl = gl;
        // 根据数据构造program vao等
        const vs = `#version 300 es
        layout(location=0) in vec3 a_position;
        layout(location=1) in vec3 a_color;
        layout(location=2) in vec3 a_normal;
        uniform mat4 u_worldViewProjection;
        out vec3 v_color;
        out vec3 v_normal;
        void main() {
            gl_Position = u_worldViewProjection*vec4(a_position, 1.0);
            v_color = a_color;
            v_normal = a_normal;
        }`;
        const fs = `#version 300 es
        precision highp int;
        precision highp float;
        uniform vec3 u_DiffuseLight; // 漫反射光颜色
        uniform vec3 u_LightDirection; // 漫反射光的方向
        uniform vec3 u_AmbientLight; // 环境光颜色
        in vec3 v_color;
        in vec3 v_normal;
        out vec4 outColor;
        void main() {
            vec3 normal = normalize(v_normal);
            //计算光线向量与法向量的点积
            float nDotL = max(dot(u_LightDirection, normal), 0.0);
            //计算漫发射光的颜色 
            vec3 diffuse = u_DiffuseLight * v_color * nDotL;
            //计算环境光的颜色
            vec3 ambient = u_AmbientLight * v_color;
            outColor = vec4(diffuse+ambient, 1.0);
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
        // 绑定法向量
        const normalBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(this._demData.normal));
        bindAttribute(gl, normalBuffer, 2, 3);
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

        gl.useProgram(this._drawModel.program);
        // 设置光照
        this._setLight(gl);
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
    });
}


