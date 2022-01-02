import initMap from '../util/initMap';
import fromLngLat from '../util/fromLonLat';
import uuid from '../util/uuid';
import { createModel, createBuffer, bindAttribute, createIndicesBuffer } from '../util/webgl_util';
import getNormal from '../util/getNormal';
import proj4 from 'proj4';
import { vec3 } from 'gl-matrix';
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
        // 默认的光源方位角和高度角  设置光线方向(世界坐标系下的)
        this._solarAltitude = 45.0;
        // 方位角以正南方向为0，由南向东向北为负，有南向西向北为正
        this._solarAzimuth = -45.0;
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
    _setLight() {
        const gl = this._gl;
        gl.useProgram(this._drawModel.program);
        //设置漫反射光
        gl.uniform3f(this._drawModel.u_DiffuseLight, 1.0, 1.0, 1.0);

        // 光源位置 参考 https://blog.csdn.net/charlee44/article/details/93759845
        const fAltitude = this._solarAltitude * Math.PI / 180; //光源高度角
        const fAzimuth = this._solarAzimuth * Math.PI / 180; //光源方位角

        const arrayvectorX = Math.cos(fAltitude) * Math.cos(fAzimuth);
        const arrayvectorY = Math.cos(fAltitude) * Math.sin(fAzimuth);
        const arrayvectorZ = Math.sin(fAltitude);
        let lightDirection = vec3.fromValues(arrayvectorX, arrayvectorY, arrayvectorZ);
        let normallightDirection = [];
        vec3.normalize(normallightDirection, lightDirection);
        gl.uniform3fv(this._drawModel.u_LightDirection, new Float32Array(normallightDirection));
        //设置环境光
        gl.uniform3f(this._drawModel.u_AmbientLight, 0.2, 0.2, 0.2);
    }
    onAdd(map, gl) {
        // 构造vao
        this._map = map;
        this._gl = gl;
        // 根据数据构造program vao等
        const vs = `#version 300 es
        layout(location=0) in vec3 a_position;
        layout(location=1) in vec3 a_normal;
        uniform mat4 u_worldViewProjection;
        out vec3 v_normal;
        void main() {
            gl_Position = u_worldViewProjection*vec4(a_position, 1.0);
            v_normal = a_normal;
        }`;
        const fs = `#version 300 es
        precision highp int;
        precision highp float;
        uniform vec4 u_color; 
        uniform vec3 u_DiffuseLight; // 漫反射光颜色
        uniform vec3 u_LightDirection; // 漫反射光的方向
        uniform vec3 u_AmbientLight; // 环境光颜色
        in vec3 v_normal;
        out vec4 outColor;
        void main() {
            vec3 normal = normalize(v_normal);
            //计算光线向量与法向量的点积
            float nDotL = max(dot(u_LightDirection, normal), 0.0);
            //计算漫发射光的颜色 
            vec3 diffuse = u_DiffuseLight * u_color.xyz * nDotL;
            //计算环境光的颜色
            vec3 ambient = u_AmbientLight * u_color.xyz;
            //outColor = vec4((diffuse+ambient)*u_color.w, u_color.w);
            vec3 _color = diffuse+ambient;

            outColor = vec4(_color*u_color.w,u_color.w);
        }`;
        this._drawModel = createModel(gl, vs, fs);


        let pos1 = new Float32Array(24), pos2 = new Float32Array(24);
        for (let i = 0; i < 24; i = i + 3) {
            const coors1 = fromLngLat([positions1[i], positions1[i + 1]], positions1[i + 2]);
            const coors2 = fromLngLat([positions2[i], positions2[i + 1]], positions2[i + 2]);
            pos1[i] = coors1.x;
            pos1[i + 1] = coors1.y;
            pos1[i + 2] = coors1.z;

            pos2[i] = coors2.x;
            pos2[i + 1] = coors2.y;
            pos2[i + 2] = coors2.z;
        }
        // 根据indices计算法向量
        const indicesLength = indices.length;
        let normal1 = new Float32Array(pos1.length), normal2 = new Float32Array(pos1.length);
        for (let i = 0; i < indicesLength; i = i + 3) {
            const a_index = indices[i];
            const b_index = indices[i + 1];
            const c_index = indices[i + 2];
            const a_coorIndex = a_index * 3;
            const b_coorIndex = b_index * 3;
            const c_coorIndex = c_index * 3;
            // 墨卡托投影坐标计算法向量，不能用0-1坐标和经纬度坐标计算。
            const point_a_3857 = proj4('EPSG:4326', 'EPSG:3857').forward([positions1[a_coorIndex], positions1[a_coorIndex + 1]]);
            const point_b_3857 = proj4('EPSG:4326', 'EPSG:3857').forward([positions1[b_coorIndex], positions1[b_coorIndex + 1]]);
            const point_c_3857 = proj4('EPSG:4326', 'EPSG:3857').forward([positions1[c_coorIndex], positions1[c_coorIndex + 1]]);
            const point_a = [point_a_3857[0], point_a_3857[1], positions1[a_coorIndex + 2]];
            const point_b = [point_b_3857[0], point_b_3857[1], positions1[b_coorIndex + 2]];
            const point_c = [point_c_3857[0], point_c_3857[1], positions1[c_coorIndex + 2]];
            const d1 = getNormal(point_a, point_b, point_c);
            const d1_normal = vec3.normalize([], d1);
            // 分别记录三个顶点的法向量，用于向量相加（所谓的平均就是顶点的各个法向量相加，所谓平均就是最后的结果归一化即可）
            // 没有采用面积加权，查询部分资料认为效果不好似无必要。
            normal1[a_coorIndex] = d1_normal[0];
            normal1[a_coorIndex + 1] = d1_normal[1];
            normal1[a_coorIndex + 2] = d1_normal[2];
            normal1[b_coorIndex] = d1_normal[0];
            normal1[b_coorIndex + 1] = d1_normal[1];
            normal1[b_coorIndex + 2] = d1_normal[2];
            normal1[c_coorIndex] = d1_normal[0];
            normal1[c_coorIndex + 1] = d1_normal[1];
            normal1[c_coorIndex + 2] = d1_normal[2];




            const point_a2_3857 = proj4('EPSG:4326', 'EPSG:3857').forward([positions2[a_coorIndex], positions2[a_coorIndex + 1]]);
            const point_b2_3857 = proj4('EPSG:4326', 'EPSG:3857').forward([positions2[b_coorIndex], positions2[b_coorIndex + 1]]);
            const point_c2_3857 = proj4('EPSG:4326', 'EPSG:3857').forward([positions2[c_coorIndex], positions2[c_coorIndex + 1]]);
            const point_a2 = [point_a2_3857[0], point_a2_3857[1], positions2[a_coorIndex + 2]];
            const point_b2 = [point_b2_3857[0], point_b2_3857[1], positions2[b_coorIndex + 2]];
            const point_c2 = [point_c2_3857[0], point_c2_3857[1], positions2[c_coorIndex + 2]];
            const d2 = getNormal(point_a2, point_b2, point_c2);
            const d2_normal = vec3.normalize([], d2);
            // 分别记录三个顶点的法向量，用于向量相加（所谓的平均就是顶点的各个法向量相加，所谓平均就是最后的结果归一化即可）
            // 没有采用面积加权，查询部分资料认为效果不好似无必要。
            normal2[a_coorIndex] = d2_normal[0];
            normal2[a_coorIndex + 1] = d2_normal[1];
            normal2[a_coorIndex + 2] = d2_normal[2];
            normal2[b_coorIndex] = d2_normal[0];
            normal2[b_coorIndex + 1] = d2_normal[1];
            normal2[b_coorIndex + 2] = d2_normal[2];
            normal2[c_coorIndex] = d2_normal[0];
            normal2[c_coorIndex + 1] = d2_normal[1];
            normal2[c_coorIndex + 2] = d2_normal[2];
        }
    
        // 创建vao
        this._vao1 = gl.createVertexArray();
        gl.bindVertexArray(this._vao1);
        // 绑定坐标顶点
        const positionBuffer1 = createBuffer(gl, gl.ARRAY_BUFFER, pos1);
        bindAttribute(gl, positionBuffer1, 0, 3);

        // 绑定法向量
        const normalBuffer1 = createBuffer(gl, gl.ARRAY_BUFFER, normal1);
        bindAttribute(gl, normalBuffer1, 1, 3);

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
        // 绑定法向量
        const normalBuffer2 = createBuffer(gl, gl.ARRAY_BUFFER, normal2);
        bindAttribute(gl, normalBuffer2, 1, 3);
        // 顶点索引，unit8array对应gl.UNSIGNED_BYTE
        this._elementType2 = createIndicesBuffer(gl, indices, 24 / 3);
        this._positionCount2 = indices.length;
        // 绑定结束        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);

        // 设置下灯光
        this._setLight();

    }
    render(gl, matrix) {
        gl.useProgram(this._drawModel.program);
        //设置unifrom
        gl.uniformMatrix4fv(this._drawModel.u_worldViewProjection, false, matrix);

        // 1 开启深度测试
        gl.enable(gl.DEPTH_TEST);
        // 2 绘制所有不透明物体 alpha=1.0
        gl.bindVertexArray(this._vao2);
        gl.uniform4fv(this._drawModel.u_color, new Float32Array([1.0, 0, 0, 1.0]));
        gl.drawElements(gl.TRIANGLES, this._positionCount2, this._elementType2, 0);
        // 3 锁定深度缓冲区写入操作，使其只读
        gl.depthMask(false);
        // 4 绘制所有不透明物体 alpha<1.0
        gl.bindVertexArray(this._vao1);
        gl.uniform4fv(this._drawModel.u_color, new Float32Array([0.0, 1.0, 0, 0.3]));
        gl.drawElements(gl.TRIANGLES, this._positionCount1, this._elementType1, 0);
        // 5 释放深度缓冲区，使其可独写
        gl.depthMask(true);

        //如果取消绑定，会报错GL_INVALID_OPERATION: Insufficient buffer size.
        gl.bindVertexArray(null);
    }
}



export async function run(mapdiv, gui = null) {
    // 初始化地图
    let baseMap = 'vector';
    const map = initMap(mapdiv, baseMap, [117.5, 32.5], 7);

    const layer = new CustomeLayer();
    map.on('load', function () {
        map.addLayer(layer);
    });
}
