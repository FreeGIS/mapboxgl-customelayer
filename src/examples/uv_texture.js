import initMap from '../util/initMap';
import fromLngLat from '../util/fromLonLat';
import uuid from '../util/uuid';
import { createModel, createBuffer, bindAttribute, createIndicesBuffer, createTexture2D, bindTexture2D } from '../util/webgl_util';
import proj4 from 'proj4';
import { loadImage } from '../util/request';

const minx = 399650, miny = 3995140, maxy = 3997530, maxx = 400420;
// 先转84坐标系
const dataEPSG = 32612;
proj4.defs(`EPSG:${dataEPSG}`, "+proj=utm +zone=12 +datum=WGS84 +units=m +no_defs");
const wgs84Coor1 = proj4(`EPSG:${dataEPSG}`, 'EPSG:4326').forward([minx, miny]);
const wgs84Coor2 = proj4(`EPSG:${dataEPSG}`, 'EPSG:4326').forward([maxx, maxy]);
// 地理四至
const bbox = [...wgs84Coor1, ...wgs84Coor2];

class UVLayer {
    constructor(demImage, geoBounds) {
        this._id = uuid();
        this._geoBounds = geoBounds;
        this._demImage = demImage;
    }
    // 只读属性
    get id() {
        return this._id;
    }
    get type() {
        return 'custom';
    }
    get renderingMode() {
        return '2d';
    }
    onAdd(map, gl) {
        this._map = map;
        this._gl = gl;
        // 根据数据构造program vao等
        const vs = `#version 300 es
        layout(location=0) in vec2 a_position;
        layout(location=1) in vec2 a_uv;
        uniform mat4 u_worldViewProjection;
        out vec2 v_uv;
        void main() {
            gl_Position = u_worldViewProjection*vec4(a_position, 0.0, 1.0);
            v_uv = a_uv;
        }`;
        const fs = `#version 300 es
        precision highp int;
        precision highp float;
      
        in vec2 v_uv;
        uniform sampler2D u_texture;
        out vec4 outColor;
        void main() {
            outColor = texture(u_texture, v_uv);
        }`;
        this._drawModel = createModel(gl, vs, fs);
        // 创建vao
        this._vao = gl.createVertexArray();
        gl.bindVertexArray(this._vao);
        // 将坐标转换成0-1墨卡托坐标
        // 84转mkt 0-1
        const controlPoints = [
            [this._geoBounds[0], this._geoBounds[3]], // top-left
            [this._geoBounds[0], this._geoBounds[1]], // bottom-left
            [this._geoBounds[2], this._geoBounds[3]], // top-right
            [this._geoBounds[2], this._geoBounds[1]], // bottom-right
        ];
        const sourceUV = [
            [0, 0],	// top-left
            [0, 1],	// bottom-left
            [1, 0],	// top-right
            [1, 1],	// bottom-right
        ];


        let mktPositionBuffer = new Float32Array(8);
        let uvPositionBuffer = new Float32Array(8);

        for (let i = 0; i < controlPoints.length; i++) {
            const mkt = fromLngLat(controlPoints[i], 0);
            mktPositionBuffer[i * 2] = mkt.x;
            mktPositionBuffer[i * 2 + 1] = mkt.y;

            uvPositionBuffer[i * 2] = sourceUV[i][0];
            uvPositionBuffer[i * 2 + 1] = sourceUV[i][1];
        }
        const indices = [
            1, 0, 3,
            0, 3, 2
        ];

        const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, mktPositionBuffer);
        bindAttribute(gl, positionBuffer, 0, 2);

        const uvBuffer = createBuffer(gl, gl.ARRAY_BUFFER, uvPositionBuffer);
        bindAttribute(gl, uvBuffer, 1, 2);

        // 顶点索引，unit8array对应gl.UNSIGNED_BYTE
        this._elementType = createIndicesBuffer(gl, indices, mktPositionBuffer.length / 2);
        this._positionCount = indices.length;
        // 绑定结束        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);

        // 创建纹理
        this._texture = createTexture2D(gl, {
            data: this._demImage,
            mipLevel: 0,
            internalFormat: gl.RGBA,//webgl中格式
            srcFormat: gl.RGBA,//输入数据源格式
            type: gl.UNSIGNED_BYTE,
            pixelStore: {
                [gl.UNPACK_ALIGNMENT]: 1
            },
            parameters: {
                [gl.TEXTURE_MAG_FILTER]: gl.LINEAR,
                [gl.TEXTURE_MIN_FILTER]: gl.LINEAR,
                [gl.TEXTURE_WRAP_S]: gl.CLAMP_TO_EDGE,
                [gl.TEXTURE_WRAP_T]: gl.CLAMP_TO_EDGE
            }
        });
    }
    render(gl, matrix) {
        gl.useProgram(this._drawModel.program);
        //设置unifrom
        gl.uniformMatrix4fv(this._drawModel.u_worldViewProjection, false, matrix);
        //绑定顶点vao
        gl.bindVertexArray(this._vao);
        // 绑定纹理
        //只设置初始纹理并展示，纹理单元从10之后开始用，尽量避免冲突bug
        bindTexture2D(gl, this._texture, 10);
        gl.uniform1i(this._drawModel.u_texture, 10);

        gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.drawElements(gl.TRIANGLES, this._positionCount, this._elementType, 0);
        //如果取消绑定，会报错GL_INVALID_OPERATION: Insufficient buffer size.
        gl.bindVertexArray(null);
    }
    onRemove(map, gl) {
        gl.deleteTexture(this._texture);
        gl.deleteProgram(this._drawModel.program);
    }
}


export async function run(mapdiv, gui = null) {
    // 请求测试数据
    const demImage = await loadImage('./datas/tex.jpg');
    // 初始化地图
    let baseMap = 'vector';
    const map = initMap(mapdiv, baseMap, [-112.11405254567393, 36.107259614117756], 13);

    // 构造图层
    const uvLayer = new UVLayer(demImage, bbox);
    map.on('load', function () {
        map.addLayer(uvLayer);
    });
}