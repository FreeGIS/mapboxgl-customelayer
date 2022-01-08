import uuid from '../util/uuid';
import { createModel, createBuffer, bindAttribute, createTexture2D, bindTexture2D } from '../util/webgl_util';
import { vec3, vec4, mat4 } from 'gl-matrix';

import initMap from '../util/initMap';
import { createSphere } from '../util/sphere';
import { loadImage } from '../util/request';

class SphereLayer {
    constructor(image, sphere) {
        this._id = uuid();
        this._image = image;
        this._sphere = sphere;
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

    // 设置图形
    setGeometry() {
        const gl = this.gl;

        // 测试32个球
        let NUM_SPHERES = 32;
        this.numInstances = NUM_SPHERES;
        // 每行8个球
        let NUM_PER_ROW = 8;

        // 球半径设置0.06
        let RADIUS = 0.8;
        let meterScale = 20000;
        this.spheres = new Array(NUM_SPHERES);
        let colorData = new Float32Array(NUM_SPHERES * 4);
        this.modelMatrixData = new Float32Array(NUM_SPHERES * 16);

        const scale = [0.8, 0.8, 0.8];
        for (let i = 0; i < NUM_SPHERES; ++i) {
            let angle = 2 * Math.PI * (i % NUM_PER_ROW) / NUM_PER_ROW;
            let x = Math.sin(angle) * RADIUS;
            //let y = Math.floor(i / NUM_PER_ROW) / (NUM_PER_ROW / 4) - 0.75;
            //let z = Math.cos(angle) * RADIUS;
            let y = Math.cos(angle) * RADIUS;
            let z = Math.floor(i / NUM_PER_ROW) / (NUM_PER_ROW / 4) - 0.5;

            this.spheres[i] = {
                // scale: [0.8, 0.8, 0.8],
                //rotate: [0, 0, 0], // Will be used for global rotation
                translate: [x * meterScale, y * meterScale, z * meterScale],
                //modelMatrix: mat4.create()
            };

            colorData.set(vec4.fromValues(
                Math.sqrt(Math.random()),
                Math.sqrt(Math.random()),
                Math.sqrt(Math.random()),
                0.5
            ), i * 4);
        }


        // 每个球的顶点数量
        let sphere = this._sphere;
        this.numVertices = sphere.positions.length / 3;

        this.sphereVAO = gl.createVertexArray();
        gl.bindVertexArray(this.sphereVAO);

        const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, sphere.positions);
        bindAttribute(gl, positionBuffer, 0, 3);

        const colorBuffer = createBuffer(gl, gl.ARRAY_BUFFER, colorData);
        bindAttribute(gl, colorBuffer, 1, 4);
        // color的loc = 3，每个实例调用一次
        gl.vertexAttribDivisor(1, 1);

        const uvBuffer = createBuffer(gl, gl.ARRAY_BUFFER, sphere.uvs);
        bindAttribute(gl, uvBuffer, 2, 2);


        this.matrixBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.matrixBuffer);
        // gl.DYNAMIC_DRAW 告诉着色器这些数据经常变化，动态的，常规的用STATIC_DRAW
        gl.bufferData(gl.ARRAY_BUFFER, this.modelMatrixData, gl.DYNAMIC_DRAW);

        const matrixLoc = 3;
        const bytesPerMatrix = 4 * 16;
        for (let i = 0; i < 4; ++i) {
            const loc = matrixLoc + i;
            gl.enableVertexAttribArray(loc);
            // note the stride and offset
            const offset = i * 16;  // 4 floats per row, 4 bytes per float
            gl.vertexAttribPointer(
                loc,              // location
                4,                // size (num values to pull from buffer per iteration)
                gl.FLOAT,         // type of data in buffer
                false,            // normalize
                bytesPerMatrix,   // stride, num bytes to advance to get to next set of values
                offset,           // offset in buffer
            );
            // this line says this attribute only changes for each 1 instance
            gl.vertexAttribDivisor(loc, 1);
        }


        const indices = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphere.indices, gl.STATIC_DRAW);
        this._positionCount = sphere.indices.length;

        // 绑定结束        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);



        const modelAsMercatorCoordinate = mapboxgl.MercatorCoordinate.fromLngLat(
            [118, 32], 0
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
        // 先平移10000米，将球体置于水平，避免其负数在地下不显示
        for (let i = 0; i < this.spheres.length; i++) {
            const sphereinfo = this.spheres[i];
            const mat_1 = mat4.fromTranslation([], vec3.fromValues(sphereinfo.translate[0], sphereinfo.translate[1], sphereinfo.translate[2] + 10000));
            // 再根据地图比例尺缩放下
            const mat_2 = mat4.fromScaling([], vec3.fromValues(this.modelTransform.scale * scale[0], -this.modelTransform.scale * scale[1], this.modelTransform.scale * scale[2]));
            // 矩阵乘法先变换的矩阵  放右边，后变换的矩阵放左边。
            // 本例子要求先平移（mat_1)，再缩放(mat_2);
            const mat_3 = mat4.multiply([], mat_2, mat_1);
            const mat_4 = mat4.fromTranslation([], vec3.fromValues(this.modelTransform.translateX, this.modelTransform.translateY, this.modelTransform.translateZ));
            sphereinfo.modelMatrix = mat4.multiply([], mat_4, mat_3);
        }

        // 创建纹理
        this._texture = createTexture2D(gl, {
            data: this._image,
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
    }
    //图层初始化
    initialize(map, gl) {
        // 根据数据构造program vao等
        const vs = `#version 300 es
           layout(location=0) in vec3 a_position;
           layout(location=1) in vec4 a_color;
           layout(location=2) in vec2 a_uv;
           layout(location=3) in mat4 uPMatrix;
           out vec4 vColor;
           out vec2 vUv;
           void main() {
               gl_Position = uPMatrix * vec4(a_position,1.0);
               vColor = a_color;
               vUv = a_uv;
           }`;
        const fs = `#version 300 es
           precision highp int;
           precision highp float;
           uniform sampler2D u_texture;
           in vec2 vUv;
           in vec4 vColor;
           out vec4 outColor;
           void main() {
                vec4 baseColor = vColor * texture(u_texture, vUv);
                outColor = vec4(baseColor.rgb*baseColor.a,baseColor.a);
           }`;
        this._drawModel = createModel(gl, vs, fs);
        // 设置图形
        this.setGeometry();
        // 创建纹理
        this._texture = createTexture2D(gl, {
            data: this._image,
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

    }
    onAdd(m, gl) {
        this.map = m;
        this.gl = gl;
        //启用扩展，否则drawElements数组太大，会绘制混乱
        //gl.getExtension('OES_element_index_uint');
        //必须启用这个插件
        if (!gl.getExtension('EXT_color_buffer_float')) {
            console.error('FLOAT color buffer not available');
        }
        gl.enable(gl.BLEND);
        gl.depthMask(false);
        m.on('resize', this.resizeEvent.bind(this));
        this.initialize(m, gl);
    }
    resizeEvent() {
        this.initialize(this.map, this.gl);
    }
    render(gl, matrix) {
        gl.useProgram(this._drawModel.program);
        //绑定顶点vao
        gl.bindVertexArray(this.sphereVAO);
        // 正常情况先 平移再旋转，最后缩放
        for (let ndx = 0; ndx < this.spheres.length; ndx++) {
            // 5 合并地图mvp矩阵
            const projmatrix = mat4.multiply([], matrix, this.spheres[ndx].modelMatrix);
            // 更新每个实例的矩阵属性
            for (let i = 0; i < 16; i++) {
                this.modelMatrixData[16 * ndx + i] = projmatrix[i];
            }
        }
        // 不要忘记更新矩阵数据
        gl.bindBuffer(gl.ARRAY_BUFFER, this.matrixBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.modelMatrixData);

        //只设置初始纹理并展示，纹理单元从10之后开始用，尽量避免冲突bug
        bindTexture2D(gl, this._texture, 10);
        gl.uniform1i(this._drawModel.u_texture, 10);


        // 根据索引绘制实例
        gl.drawElementsInstanced(gl.TRIANGLES, this._positionCount, gl.UNSIGNED_SHORT, 0, this.numInstances);

        //如果取消绑定，会报错GL_INVALID_OPERATION: Insufficient buffer size.
        gl.bindVertexArray(null);
    }
    onRemove(map, gl) {
        gl.deleteTexture(this._texture);
        gl.deleteProgram(this._drawModel.program);
    }
}



export async function run(mapdiv, gui = null) {
    // 先加载贴图
    const png = await loadImage('./datas/khronos_webgl.png');
    // 模拟球的测试数据，单位是 米 
    const sphereData = createSphere({ radius: 10000 });
    // 初始化地图
    let baseMap = 'vector';
    const map = initMap(mapdiv, baseMap, [118, 32], 9);
    // 构造图层
    const layer = new SphereLayer(png, sphereData);
    map.on('load', function () {
        map.addLayer(layer);
    });
}
