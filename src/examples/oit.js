import uuid from '../util/uuid';
import { createModel, createBuffer, createIndicesBuffer, bindAttribute, bindTexture2D } from '../util/webgl_util';
import { vec3 } from 'gl-matrix';
import fromLngLat from '../util/fromLonLat';
import getNormal from '../util/getNormal';
import proj4 from 'proj4';
import initMap from '../util/initMap';

const vertexAccum = `#version 300 es
layout(location=0) in vec3 position;
layout(location=1) in vec4 color;
layout(location=2) in vec3 normal;
uniform mat4 uViewProj;
out vec3 vPosition;
out vec3 vNormal;
out vec4 vColor;
void main() {
    vPosition = position;
    vNormal = normal;
    vColor = color;
    gl_Position = uViewProj * vec4(position,1.0);
}`;
const fragmentAccum = `#version 300 es
precision highp float;

uniform vec3 uEyePosition;
uniform vec3 uLightDirectional;

in vec3 vPosition;
in vec3 vNormal;
in vec4 vColor;

layout(location=0) out vec4 accumColor;
layout(location=1) out float accumAlpha;

float weight(float z, float a) {
    return clamp(pow(min(1.0, a * 10.0) + 0.01, 3.0) * 1e8 * pow(1.0 - z * 0.9, 3.0), 1e-2, 3e3);
}

void main() {
    vec3 position = vPosition.xyz;
    vec3 normal = normalize(vNormal.xyz);
   
    //视线方向
    vec3 eyeDirection = normalize(uEyePosition - position);
    //“光线方向”，实际上指的是入射方向的反方向，即从入射点指向光源方向
    //vec3 lightVec = uLightPosition - position;
   
    //光线方向 单位向量
    vec3 lightDirection = normalize(uLightDirectional);
    //反射光线方向 入射方向与平面法向量的反射=反射光线
    vec3 reflectionDirection = reflect(lightDirection, normal);
    //光照系数 入射角=dot(光线方向,法线方向)
    float nDotL = max(dot(-lightDirection, normal), 0.0);
    //漫反射
    float diffuse = nDotL;
    //环境光
    float ambient = 0.2;
    //光照强度 视线方向与反射反向的夹角
    float specular = pow(max(dot(reflectionDirection, eyeDirection), 0.0), 20.0);

    //vec3 lightColor = ambient * uColor.rgb;
    //lightColor+=(diffuse * 0.55 * uColor.rgb + specular * vec3(0.1176,0.1176,0.1176));
    //vec4 color = vec4(lightColor.r,lightColor.g,lightColor.b, uColor.a);

    vec4 color = vec4((ambient + diffuse + specular)* vColor.rgb, vColor.a);

    //预乘alpha
    color.rgb *= color.a;
    //根据像素深度进行权重比较
    float w = weight(gl_FragCoord.z, color.a);
    //输出到两个纹理上
    accumColor = vec4(color.rgb * w, color.a);
    accumAlpha = color.a * w;
}`;

const vertexQuad = `#version 300 es
layout(location=0) in vec2 aPosition;
void main() {
    gl_Position = vec4(aPosition,0.0,1.0);
}`;
const fragmentDraw = `#version 300 es
precision highp float;
uniform sampler2D uAccumulate;
uniform sampler2D uAccumulateAlpha;
out vec4 fragColor;
void main() {
    ivec2 fragCoord = ivec2(gl_FragCoord.xy);
    //fbo渲染，取决于渲染背景，有的背景是黑色，则accum.a=1.0 a=0.0。
    // 反之，背景是透过名的，a=1.0
    vec4 accum = texelFetch(uAccumulate, fragCoord, 0);
    float a = 1.0 - accum.a;
    accum.a = texelFetch(uAccumulateAlpha, fragCoord, 0).r;
  
    //取决于地图背景，这里使用1-a
    //fragColor = vec4(a * accum.rgb / clamp(accum.a, 0.001, 50000.0), 1.0-a);
    //fragColor = vec4(a * accum.rgb / clamp(accum.a, 0.001, 50000.0), a);
    vec3 _color = a * accum.rgb / clamp(accum.a, 0.001, 50000.0);
    /* if(_color==vec3(0.0))
        fragColor = vec4(_color, 0.0);
    else
        fragColor = vec4(_color, a); */
    fragColor = vec4(a * accum.rgb / clamp(accum.a, 0.001, 50000.0), 1.0-a);
}`;

//三维等值面
class OitTestLayer {
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
    // 设置光源高度角
    set solarAltitude(value) {
        this._solarAltitude = value;
        this.setLight();
        // 强制重绘
        if (this._map)
            this._map.triggerRepaint();
    }
    // 设置光源方位角
    set solarAzimuth(value) {
        this._solarAzimuth = value;
        this.setLight();
        if (this._map)
            this._map.triggerRepaint();
    }
    //设置灯光（世界坐标系）
    setLight() {
        const gl = this.gl;
        gl.useProgram(this.accumModel.program);
        //设置漫反射光
        // gl.uniform3f(this._drawFboModel.u_DiffuseLight, 1.0, 1.0, 1.0);

        // 光源位置 参考 https://blog.csdn.net/charlee44/article/details/93759845
        const fAltitude = this._solarAltitude * Math.PI / 180; //光源高度角
        const fAzimuth = this._solarAzimuth * Math.PI / 180; //光源方位角

        const arrayvectorX = Math.cos(fAltitude) * Math.cos(fAzimuth);
        const arrayvectorY = Math.cos(fAltitude) * Math.sin(fAzimuth);
        const arrayvectorZ = Math.sin(fAltitude);
        let lightDirection = vec3.fromValues(arrayvectorX, arrayvectorY, arrayvectorZ);
        let normallightDirection = [];
        vec3.normalize(normallightDirection, lightDirection);
        gl.uniform3fv(this.accumModel.uLightDirectional, new Float32Array(normallightDirection));
        //设置环境光
        // gl.uniform3f(this._drawFboModel.u_AmbientLight, 0.2, 0.2, 0.2);
    }
    //图层初始化
    initialize(map, gl) {
        /////////////////////////
        // PROGRAM
        /////////////////////////
        this.accumModel = createModel(gl, vertexAccum, fragmentAccum);
        this.drawModel = createModel(gl, vertexQuad, fragmentDraw);
        ////////////////////////////////
        //  SET UP FRAMEBUFFERS
        ////////////////////////////////
        let accumBuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, accumBuffer);
        this.accumTarget = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.accumTarget);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.accumTarget, 0);

        this.accumAlphaTarget = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.accumAlphaTarget);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R16F, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.accumAlphaTarget, 0);
        gl.drawBuffers([
            gl.COLOR_ATTACHMENT0,
            gl.COLOR_ATTACHMENT1
        ]);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.accumBuffer = accumBuffer;
        //设置vao
        /////////////////////////
        // 测试数据
        /////////////////////////
        const positions = [
            117, 32, 0,
            118, 32, 0,
            117, 32, 10000,
            118, 32, 10000,
            117, 33, 0,
            118, 33, 0,
            117, 33, 10000,
            118, 33, 10000,
            117.2, 32.2, 1000,
            117.8, 32.2, 1000,
            117.2, 32.2, 9000,
            117.8, 32.2, 9000,
            117.2, 32.8, 1000,
            117.8, 32.8, 1000,
            117.2, 32.8, 9000,
            117.8, 32.8, 9000
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
            4, 5, 1,

            8, 9, 10,
            10, 9, 11,
            9, 13, 11,
            11, 13, 15,
            8, 10, 12,
            10, 14, 12,
            12, 14, 13,
            14, 15, 13,
            10, 14, 11,
            14, 15, 11,
            8, 12, 9,
            12, 13, 9
        ];
        //地图上，预乘alpha
        const colors = [
            0.2, 0, 0, 0.2,
            0.2, 0, 0, 0.2,
            0.2, 0, 0, 0.2,
            0.2, 0, 0, 0.2,
            0.2, 0, 0, 0.2,
            0.2, 0, 0, 0.2,
            0.2, 0, 0, 0.2,
            0.2, 0, 0, 0.2,
            0, 0.3, 0, 0.3,
            0, 0.3, 0, 0.3,
            0, 0.3, 0, 0.3,
            0, 0.3, 0, 0.3,
            0, 0.3, 0, 0.3,
            0, 0.3, 0, 0.3,
            0, 0.3, 0, 0.3,
            0, 0.3, 0, 0.3
        ];

        // 计算法向量，使用mkt投用算
        const position_length = positions.length;
        // 墨卡托坐标，计算法向量用
        let coors3857 = new Array(position_length);
        // 0-1 mkt坐标，顶点着色器使用
        let geoCoors = new Float32Array(position_length);
        for (let i = 0; i < position_length; i = i + 3) {
            const coor3857 = proj4('EPSG:4326', 'EPSG:3857').forward([ positions[ i ], positions[ i + 1 ] ]);
            coors3857[ i ] = coor3857[ 0 ];
            coors3857[ i + 1 ] = coor3857[ 1 ];
            coors3857[ i + 2 ] = positions[ i + 2 ];

            const geos = fromLngLat([ positions[ i ], positions[ i + 1 ] ], positions[ i + 2 ]);
            geoCoors[ i ] = geos.x;
            geoCoors[ i + 1 ] = geos.y;
            geoCoors[ i + 2 ] = geos.z;
        }

        const indicesLength = indices.length;
        let normal = new Float32Array(position_length);
        for (let i = 0; i < indicesLength; i = i + 3) {
            const a_index = indices[ i ];
            const b_index = indices[ i + 1 ];
            const c_index = indices[ i + 2 ];
            const a_coorIndex = a_index * 3;
            const b_coorIndex = b_index * 3;
            const c_coorIndex = c_index * 3;
            // 原始坐标计算法向量，不能使用投影转换后的坐标转换
            const point_a = [ coors3857[ a_coorIndex ], coors3857[ a_coorIndex + 1 ], coors3857[ a_coorIndex + 2 ] ];
            const point_b = [ coors3857[ b_coorIndex ], coors3857[ b_coorIndex + 1 ], coors3857[ b_coorIndex + 2 ] ];
            const point_c = [ coors3857[ c_coorIndex ], coors3857[ c_coorIndex + 1 ], coors3857[ c_coorIndex + 2 ] ];
            const d = getNormal(point_a, point_b, point_c);
            // 分别记录三个顶点的法向量，用于向量相加（所谓的平均就是顶点的各个法向量相加，所谓平均就是最后的结果归一化即可）
            // 没有采用面积加权，查询部分资料认为效果不好似无必要。
            normal[ a_index * 3 ] += d[ 0 ];
            normal[ a_index * 3 + 1 ] += d[ 1 ];
            normal[ a_index * 3 + 2 ] += d[ 2 ];
            normal[ b_index * 3 ] += d[ 0 ];
            normal[ b_index * 3 + 1 ] += d[ 1 ];
            normal[ b_index * 3 + 2 ] += d[ 2 ];

            normal[ c_index * 3 ] += d[ 0 ];
            normal[ c_index * 3 + 1 ] += d[ 1 ];
            normal[ c_index * 3 + 2 ] += d[ 2 ];
        }
        // 应该根据面积加权平均，这里格点比较均匀，直接平均测试，求单位向量
        for (let i = 0; i < normal.length; i = i + 3) {
            const d_normal = vec3.normalize([], vec3.fromValues(normal[ i ], normal[ i + 1 ], normal[ i + 2 ]));
            normal[ i ] = d_normal[ 0 ];
            normal[ i + 1 ] = d_normal[ 1 ];
            normal[ i + 2 ] = d_normal[ 2 ];
        }
        // 根据测试数据构造vao
        this.vao1 = gl.createVertexArray();
        gl.bindVertexArray(this.vao1);
        // 绑定坐标顶点
        const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, geoCoors);
        bindAttribute(gl, positionBuffer, 0, 3);
        // 绑定坐标顶点
        const colorBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(colors));
        bindAttribute(gl, colorBuffer, 1, 4);
        // 绑定法向量
        const normalBuffer = createBuffer(gl, gl.ARRAY_BUFFER, normal);
        bindAttribute(gl, normalBuffer, 2, 3);
        // 顶点索引，unit8array对应gl.UNSIGNED_BYTE
        this._elementType = createIndicesBuffer(gl, indices, geoCoors.length / 3);
        this._positionCount = indices.length;
        // 绑定结束        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);




        this.vao2 = gl.createVertexArray();
        gl.bindVertexArray(this.vao2);

        const quadPositionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array([
            -1, 1,
            -1, -1,
            1, -1,
            -1, 1,
            1, -1,
            1, 1,
        ]));
        bindAttribute(gl, quadPositionBuffer, 0, 2);

        //绑定结束记得一定要设置 null，释放资源
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);

        // this.setLight();
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
        // 眼睛视点
        const cameraPostion = this.map.getCameraPosition(true);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.accumBuffer);

        gl.useProgram(this.accumModel.program);
        gl.clear(gl.COLOR_BUFFER_BIT);

        //绑定顶点vao
        gl.bindVertexArray(this.vao1);
        //绑定uniform
        gl.uniformMatrix4fv(this.accumModel.uViewProj, false, matrix);
        gl.uniform3fv(this.accumModel.uEyePosition, cameraPostion);


        //光线方向 采用平行光
        gl.uniform3fv(this.accumModel.uLightDirectional, [0.5, 1, 0.5]);
        gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
        //启用gl.getExtension('OES_element_index_uint')会使用，默认是gl.UNSIGNED_BYTE和gl.UNSIGNED_SHORT
        //When using the OES_element_index_uint extension:gl.UNSIGNED_INT
        gl.drawElements(gl.TRIANGLES, this._positionCount, this._elementType, 0);
        //如果取消绑定，或者绑定的vao对象不正确，就会报错GL_INVALID_OPERATION: Insufficient buffer size.
        gl.bindVertexArray(null);

        //释放帧缓存后，等于上面的绑定也释放了，所以可以注释
        //gl.disable(gl.BLEND);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        gl.useProgram(this.drawModel.program);
        bindTexture2D(gl, this.accumTarget, 11);
        bindTexture2D(gl, this.accumAlphaTarget, 12);
        gl.uniform1i(this.drawModel.uAccumulate, 11);
        gl.uniform1i(this.drawModel.uAccumulateAlpha, 12);

        gl.bindVertexArray(this.vao2);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.bindVertexArray(null);
    }
    onRemove(map, gl) {
        map.off('resize', this.resizeEvent);
        gl.deleteTexture(this.accumTarget);
        gl.deleteTexture(this.accumAlphaTarget);
        gl.deleteFramebuffer(this.accumBuffer);
        gl.deleteProgram(this.accumModel.program);
        gl.deleteProgram(this.drawModel.program);
    }
}



export async function run(mapdiv, gui = null) {
    // 初始化地图
    let baseMap = 'vector';
    const map = initMap(mapdiv, baseMap, [ 118, 32 ], 9);
    // 构造图层
    const layer = new OitTestLayer();
    map.on('load', function () {
        map.addLayer(layer);
    });

    const meta = {
        '光源高度角': 45.0,
        '光源方位角': -45.0
    };
    gui.add(meta, '光源高度角', 0, 180).onChange(value => {
        layer.solarAltitude = value;
    });
    gui.add(meta, '光源方位角', -180, 180).onChange(value => {
        layer.solarAzimuth = value;
    });
}
