import initMap from '../util/initMap';
import fromLngLat from '../util/fromLonLat';
import uuid from '../util/uuid';
import { createModel, createBuffer, bindAttribute, createIndicesBuffer, createTexture2D, bindTexture2D } from '../util/webgl_util';
import proj4 from 'proj4';
import { GET, loadImage } from '../util/request';
// 头文件 起点X坐标 起点Y坐标 X间距 Y间距 宽 高
const demHeaders = [
    399650.000000, 3997530.000000, 10.000000, -10.000000, 78, 240
];
const dataEPSG = 32612;
proj4.defs(`EPSG:${dataEPSG}`, "+proj=utm +zone=12 +datum=WGS84 +units=m +no_defs");

// 影像地理四至
const rasterBbox = [399650, 3995140, 400420, 3997530];

// 需要将demData首先转WGS84经纬度再转墨卡托0-1坐标系
function dataParse(demData) {
    // demData 数据每9个一组，每组元数据如下
    // 与起点X距离 与起点Y距离 高程值 颜色R 颜色G 颜色B 法向量X坐标 法向量Y坐标 法向量Z坐标
    const length = demData.length;
    let pos = new Float32Array(length / 3);
    for (let i = 0; i < length; i = i + 9) {
        const coors = [demHeaders[0] + demData[i], demHeaders[1] + demData[i + 1]];
        const wgs84Coor = proj4(`EPSG:${dataEPSG}`, 'EPSG:4326').forward(coors);
        const mktCoor = fromLngLat(wgs84Coor, demData[i + 2]);
        // 转换顶点数组的相对序号
        let _index = i / 3;
        pos[_index] = mktCoor.x;
        pos[_index + 1] = mktCoor.y;
        pos[_index + 2] = mktCoor.z;

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
    return { pos, indices };
}
class DemLayer {
    constructor(demData, imageInfo) {
        this._id = uuid();
        this._demData = demData;
        this._imageInfo = imageInfo;
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
    forward(coors) {
        // 先将坐标系转换经纬度，经纬度转换mkt
        const wgs84 = proj4(`EPSG:${this._imageInfo.epsg}`, 'EPSG:4326').forward(coors);
        const mkt_coors = fromLngLat(wgs84, 0);
        return [mkt_coors.x, mkt_coors.y];
    }
    onAdd(map, gl) {
        this._map = map;
        this._gl = gl;
        // 根据数据构造program vao等
        const vs = `#version 300 es
        layout(location=0) in vec3 a_position;
        uniform mat4 u_worldViewProjection;
        out vec3 v_position;
        void main() {
            gl_Position = u_worldViewProjection*vec4(a_position, 1.0);
            v_position = a_position;
        }`;
        const fs = `#version 300 es
        precision highp int;
        precision highp float;
        uniform sampler2D u_sampler;
        uniform vec2 u_rangex;
        uniform vec2 u_rangey;
        in vec3 v_position;
        out vec4 outColor;
        void main() {
            // 根据墨卡托经纬度，和纹理经纬度范围，计算相对于纹理的坐标百分比，即纹理坐标。
            float u = (v_position.x-u_rangex.x)/(u_rangex.y-u_rangex.x);
            // uv纹理方向的v和经纬度走向方向相反。v自上而下，纬度自下而上。
            float v = 1.0 - (v_position.y-u_rangey.x)/(u_rangey.y-u_rangey.x);
            outColor = texture(u_sampler, vec2(u,v));
        }`;

        this._drawModel = createModel(gl, vs, fs);
        this._drawInfo = {};
        // step1 创建vao
        this._drawInfo.vao = gl.createVertexArray();
        gl.bindVertexArray(this._drawInfo.vao);
        // 绑定坐标顶点
        const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(this._demData.pos));
        bindAttribute(gl, positionBuffer, 0, 3);
        // 顶点索引，unit8array对应gl.UNSIGNED_BYTE
        this._drawInfo.elementType = createIndicesBuffer(gl, this._demData.indices, this._demData.pos.length / 3);
        this._drawInfo.positionCount = this._demData.indices.length;
        // 绑定结束        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);


        // step2 创建纹理和其他uniform
        this._drawInfo.texture = createTexture2D(gl, {
            data: this._imageInfo.image,
            mipLevel: 0,
            internalFormat: gl.RGBA,//webgl中格式
            srcFormat: gl.RGBA,//输入数据源格式
            type: gl.UNSIGNED_BYTE,
            parameters: {
                [gl.TEXTURE_MAG_FILTER]: gl.LINEAR,
                [gl.TEXTURE_MIN_FILTER]: gl.LINEAR,
                [gl.TEXTURE_WRAP_S]: gl.CLAMP_TO_EDGE,
                [gl.TEXTURE_WRAP_T]: gl.CLAMP_TO_EDGE
            }
        });

        // 由于影像非3857，通过地理坐标计算uv在南北跨度大误差很大，不是科学做法，练习使用。
        // 当前测试场景非常小，误差几乎可忽略，测试没有问题。
        // 真实场景应保持地形和影像在同一坐标系下。
        const minxminy_mkt = this.forward([this._imageInfo.bbox[0],this._imageInfo.bbox[1]]);
        const maxxmaxy_mkt = this.forward([this._imageInfo.bbox[2],this._imageInfo.bbox[3]]);

        const rangex = [minxminy_mkt[0],maxxmaxy_mkt[0]];
        const rangey = [minxminy_mkt[1],maxxmaxy_mkt[1]];

        // 将不变的unfiform传给着色器
        gl.useProgram(this._drawModel.program);

        gl.uniform2fv(this._drawModel.u_rangex, new Float32Array(rangex));
        gl.uniform2fv(this._drawModel.u_rangey, new Float32Array(rangey));
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
        gl.bindVertexArray(this._drawInfo.vao);

        bindTexture2D(gl, this._drawInfo.texture, 13);
        gl.uniform1i(this._drawModel.u_sampler, 13);

        gl.drawElements(gl.TRIANGLES, this._drawInfo.positionCount, this._drawInfo.elementType, 0);
        //如果取消绑定，会报错GL_INVALID_OPERATION: Insufficient buffer size.
        gl.bindVertexArray(null);
    }
    onRemove(map, gl) {
        gl.deleteTexture(this._drawInfo.texture);
        gl.deleteProgram(this._drawModel.program);

    }
}


export async function run(mapdiv, gui = null) {
    // 请求dem json和影像图片
    const result = await Promise.all([GET('./datas/dem.json', 'json'), loadImage('./datas/tex.jpg')]);
    const demData = result[0], rasterImage = result[1];
    const imageInfo = {
        image: rasterImage,
        bbox: rasterBbox,
        epsg: dataEPSG
    };
    // 数据处理，转换坐标系
    const demWebglInfo = dataParse(demData);
    // 初始化地图
    let baseMap = 'vector';
    const map = initMap(mapdiv, baseMap, [-112.11405254567393, 36.107259614117756], 13);

    // 构造图层
    const demLayer = new DemLayer(demWebglInfo, imageInfo);
    map.on('load', function () {
        map.addLayer(demLayer);
    });
}


