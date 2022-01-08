import uuid from '../util/uuid';
import { createModel, createBuffer, bindAttribute, createTexture2D, bindTexture2D } from '../util/webgl_util';
import { vec3, mat4 } from 'gl-matrix';

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
        // 每个球的顶点数量
        let sphere = this._sphere;
        this.numVertices = sphere.positions.length / 3;

        this.sphereVAO = gl.createVertexArray();
        gl.bindVertexArray(this.sphereVAO);

        const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, sphere.positions);
        bindAttribute(gl, positionBuffer, 0, 3);

        const uvBuffer = createBuffer(gl, gl.ARRAY_BUFFER, sphere.uvs);
        bindAttribute(gl, uvBuffer, 1, 2);

        const indices = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphere.indices, gl.STATIC_DRAW);
        this._positionCount = sphere.indices.length;

        // 绑定结束        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);
    }
    //图层初始化
    initialize(map, gl) {
        // 根据数据构造program vao等
        const vs = `#version 300 es
           layout(location=0) in vec3 a_position;
           layout(location=1) in vec2 a_uv;
           uniform mat4 uPMatrix;
           out vec2 v_uv;
           void main() {
               gl_Position = uPMatrix * vec4(a_position,1.0);
               v_uv = a_uv;
           }`;
        const fs = `#version 300 es
           precision highp int;
           precision highp float;
           uniform sampler2D u_texture;
           in vec2 v_uv;
           out vec4 outColor;
           void main() {
                outColor = texture(u_texture, v_uv);
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
    }
    resizeEvent() {
        this.initialize(this.map, this.gl);
    }
    render(gl, matrix) {
        gl.useProgram(this._drawModel.program);
        //绑定顶点vao
        gl.bindVertexArray(this.sphereVAO);
        //设置unifrom
        const projMatrix = mat4.multiply([], matrix, this.modelMatrix);
        gl.uniformMatrix4fv(this._drawModel.uPMatrix, false, projMatrix);

        // 绑定纹理
        //只设置初始纹理并展示，纹理单元从10之后开始用，尽量避免冲突bug
        bindTexture2D(gl, this._texture, 10);
        gl.uniform1i(this._drawModel.u_texture, 10);

        gl.drawElements(gl.TRIANGLES, this._positionCount, gl.UNSIGNED_SHORT, 0);
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
