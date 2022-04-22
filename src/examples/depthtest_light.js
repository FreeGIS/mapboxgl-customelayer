import initMap from '../util/initMap';
import fromLngLat from '../util/fromLonLat';
import uuid from '../util/uuid';
import { createModel, createBuffer, bindAttribute } from '../util/webgl_util';
import proj4 from 'proj4';
import { mat4 } from 'gl-matrix';
import { getPositionNormal } from '../util/position_normal';

function degToRad(d) {
    return d * Math.PI / 180;
}
/////////////////////////
// 测试数据
/////////////////////////
const positions1 = new Float32Array([
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
const positions2 = new Float32Array([
    //  bottom
    117.2, 32.2, 5000,
    117.2, 32.8, 5000,
    117.8, 32.2, 5000,
    117.2, 32.8, 5000,
    117.8, 32.8, 5000,
    117.8, 32.2, 5000,

    //  top
    117.2, 32.2, 15000,
    117.8, 32.2, 15000,
    117.2, 32.8, 15000,
    117.2, 32.8, 15000,
    117.8, 32.2, 15000,
    117.8, 32.8, 15000,

    // front 地图的y轴与世界坐标系相反
    117.2, 32.2, 5000,
    117.8, 32.2, 5000,
    117.8, 32.2, 15000,
    117.2, 32.2, 5000,
    117.8, 32.2, 15000,
    117.2, 32.2, 15000,

    117.2, 32.2, 5000,
    117.2, 32.2, 15000,
    117.2, 32.8, 15000,
    117.2, 32.2, 5000,
    117.2, 32.8, 15000,
    117.2, 32.8, 5000,

    117.8, 32.2, 15000,
    117.8, 32.2, 5000,
    117.8, 32.8, 15000,
    117.8, 32.8, 15000,
    117.8, 32.2, 5000,
    117.8, 32.8, 5000,

    // back
    117.2, 32.8, 15000,
    117.8, 32.8, 15000,
    117.2, 32.8, 5000,
    117.2, 32.8, 5000,
    117.8, 32.8, 15000,
    117.8, 32.8, 5000
]);



let positions_mkt_1 = new Float32Array(positions1.length);
// 统一转墨卡托坐标 米为单位的 坐标
let origin1 = proj4('EPSG:4326', 'EPSG:3857').forward([117, 32]);
for (let i = 0; i < positions1.length; i = i + 3) {
    const coormkt = fromLngLat([positions1[i], positions1[i + 1]], positions1[i + 2]);
    positions_mkt_1[i] = coormkt.x;
    positions_mkt_1[i + 1] = coormkt.y;
    positions_mkt_1[i + 2] = coormkt.z;


    const coor3857 = proj4('EPSG:4326', 'EPSG:3857').forward([positions1[i], positions1[i + 1]]);
    positions1[i] = coor3857[0] - origin1[0];
    positions1[i + 1] = coor3857[1] - origin1[1];
}

let positions_mkt_2 = new Float32Array(positions2.length);
let origin2 = proj4('EPSG:4326', 'EPSG:3857').forward([117.2, 32.2]);
for (let i = 0; i < positions2.length; i = i + 3) {
    const coormkt = fromLngLat([positions2[i], positions2[i + 1]], positions2[i + 2]);
    positions_mkt_2[i] = coormkt.x;
    positions_mkt_2[i + 1] = coormkt.y;
    positions_mkt_2[i + 2] = coormkt.z;


    const coor3857 = proj4('EPSG:4326', 'EPSG:3857').forward([positions2[i], positions2[i + 1]]);
    positions2[i] = coor3857[0] - origin2[0];
    positions2[i + 1] = coor3857[1] - origin2[1];
}

// 法向量用米去计算
const normals1 = getPositionNormal(positions1);
const normals2 = getPositionNormal(positions2);




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
        layout(location=1) in vec3 a_normal;
        uniform mat4 u_worldViewProjection;
        uniform mat4 u_worldInverseTranspose;
        out vec3 v_normal;
        void main() {
            gl_Position = u_worldViewProjection*vec4(a_position, 1.0);
            v_normal = mat3(u_worldInverseTranspose) * a_normal;
        }`;
        /*const fs = `#version 300 es
        precision highp int;
        precision highp float;
        uniform vec4 u_color; 
        uniform vec3 eye_pos; 
        in vec3 vpos;
        out vec4 outColor;
        void main() {
            //outColor = vec4(u_color.xyz*u_color.w,u_color.w);
            vec3 v = -normalize(vpos - eye_pos);
	        //vec3 light_dir = normalize(v + vec3(0.5, 0.5, 0.5));
	        vec3 light_dir = v;
	        vec3 n = normalize(cross(dFdx(vpos), dFdy(vpos)));
	        //vec3 base_color = (n + 1.f) * 0.5f;
	
	        vec3 h = normalize(v + light_dir);
	        // Just some Blinn-Phong shading
	        outColor.xyz = u_color.xyz * 0.2f;
	        outColor.xyz += 0.6 * clamp(dot(light_dir, n), 0.f, 1.f) * u_color.xyz;
	        outColor.xyz += 0.4 * pow(clamp(dot(n, h), 0.f, 1.f), 25.f);
            outColor = vec4(outColor.xyz*u_color.a,u_color.a);
	        //outColor.a = 0.5;
        }`;*/
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
          outColor = vec4(outColor.rgb*outColor.a,outColor.a);
        }`;

        this._drawModel = createModel(gl, vs, fs);


        // 创建vao
        this._vao1 = gl.createVertexArray();
        gl.bindVertexArray(this._vao1);
        // 绑定坐标顶点
        const positionBuffer1 = createBuffer(gl, gl.ARRAY_BUFFER, positions_mkt_1);
        bindAttribute(gl, positionBuffer1, 0, 3);
        // 法向量
        const normalBuffer1 = createBuffer(gl, gl.ARRAY_BUFFER, normals1);
        bindAttribute(gl, normalBuffer1, 1, 3);

        // 绑定结束        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);



        this._vao2 = gl.createVertexArray();
        gl.bindVertexArray(this._vao2);
        // 绑定坐标顶点
        const positionBuffer2 = createBuffer(gl, gl.ARRAY_BUFFER, positions_mkt_2);
        bindAttribute(gl, positionBuffer2, 0, 3);
        // 法向量
        const normalBuffer2 = createBuffer(gl, gl.ARRAY_BUFFER, normals2);
        bindAttribute(gl, normalBuffer2, 1, 3);

        // 绑定结束        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);

        gl.useProgram(this._drawModel.program);
        gl.uniform3fv(this._drawModel.u_reverseLightDirection, [0.5, 0.7, 1]);

    }
    render(gl, matrix) {
        gl.useProgram(this._drawModel.program);
        //设置unifrom
        gl.uniformMatrix4fv(this._drawModel.u_worldViewProjection, false, matrix);
     
        const transform = this._map.transform;
        const pitch = degToRad(this._map.getPitch());
        //地图旋转后，修改法向量参数
        let worldMatrix = mat4.fromXRotation([], -1 * pitch);
        mat4.rotateZ(worldMatrix, worldMatrix, -1 * transform.angle);

        const worldInverseMatrix = mat4.invert([], worldMatrix);
        const worldInverseTransposeMatrix = mat4.transpose([], worldInverseMatrix);
        gl.uniformMatrix4fv(this._drawModel.u_worldInverseTranspose, false, worldInverseTransposeMatrix);



        // 1 开启深度测试
        gl.enable(gl.DEPTH_TEST);
        // 2 绘制所有不透明物体 alpha=1.0
        gl.bindVertexArray(this._vao2);
        gl.uniform4fv(this._drawModel.u_color, new Float32Array([1.0, 0, 0, 1.0]));
        gl.drawArrays(gl.TRIANGLES, 0, positions_mkt_2.length / 3);

        // 3 锁定深度缓冲区写入操作，使其只读
        gl.depthMask(false);
        // 4 绘制所有透明物体 alpha<1.0 这里实际需要根据相机位置排序物体的
        gl.bindVertexArray(this._vao1);
        gl.uniform4fv(this._drawModel.u_color, new Float32Array([0.0, 1.0, 0, 0.3]));
        gl.drawArrays(gl.TRIANGLES, 0, positions_mkt_1.length / 3);
        // 5 释放深度缓冲区，使其可读写
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
