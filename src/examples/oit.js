import uuid from '../util/uuid';
import { createModel, createBuffer, createIndicesBuffer, bindAttribute, bindTexture2D } from '../util/webgl_util';
import { vec3, vec4, mat4 } from 'gl-matrix';
import fromLngLat from '../util/fromLonLat';
import getNormal from '../util/getNormal';
import proj4 from 'proj4';
import initMap from '../util/initMap';
import { createSphere } from '../util/sphere';
import { loadImage } from '../util/request';




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
class OitLayer {
    constructor(image, sphere) {
        this._id = uuid();
        this._image = image;
        this._sphere = sphere;
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
    // 设置图形
    setGeometry() {
        const gl = this.gl;
        // 测试32个球
        let NUM_SPHERES = 32;
        this.numInstances = NUM_SPHERES;
        // 每行8个球
        let NUM_PER_ROW = 8;
        // 为了能在地图0-1坐标系显示，统一缩放下图形比例
        const geomScale = 1;
        // 球半径设置0.6
        let RADIUS = 0.6 * geomScale;
        this.spheres = new Array(NUM_SPHERES);
        let colorData = new Float32Array(NUM_SPHERES * 4);
        this.modelMatrixData = new Float32Array(NUM_SPHERES * 16);

        for (let i = 0; i < NUM_SPHERES; ++i) {
            let angle = 2 * Math.PI * (i % NUM_PER_ROW) / NUM_PER_ROW;
            let x = Math.sin(angle) * RADIUS;
            let y = (Math.floor(i / NUM_PER_ROW) / (NUM_PER_ROW / 4) - 0.75) * geomScale;
            let z = Math.cos(angle) * RADIUS;
            this.spheres[ i ] = {
                scale: [ 0.8, 0.8, 0.8 ],
                rotate: [ 0, 0, 0 ], // Will be used for global rotation
                translate: [ x, y, z ],
                modelMatrix: mat4.create()
            };

            colorData.set(vec4.fromValues(
                Math.sqrt(Math.random()),
                Math.sqrt(Math.random()),
                Math.sqrt(Math.random()),
                0.5
            ), i * 4);
        }

        let sphere = createSphere({ radius: 0.5 * geomScale });
        // 每个球的顶点数量
        this.numVertices = sphere.positions.length / 3;

        // 平移球顶点到118、32为中心，并转换成0-1坐标系下
        for (let i = 0; i < this.numVertices; i++) {
            const index = i * 3;
            const geos = fromLngLat([ sphere.positions[ index ] + 118, sphere.positions[ index + 1 ] + 32 ]);
            sphere.positions[ index ] = geos.x;
            sphere.positions[ index + 1 ] = geos.y;
            // sphere.positions[ index + 2 ] = geos.z;
        }

        this.sphereVAO = gl.createVertexArray();
        gl.bindVertexArray(this.sphereVAO);

        const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, sphere.positions);
        bindAttribute(gl, positionBuffer, 0, 3);

        const uvBuffer = createBuffer(gl, gl.ARRAY_BUFFER, sphere.uvs);
        bindAttribute(gl, uvBuffer, 1, 2);

        const normalBuffer = createBuffer(gl, gl.ARRAY_BUFFER, sphere.normals);
        bindAttribute(gl, normalBuffer, 2, 3);

        const colorBuffer = createBuffer(gl, gl.ARRAY_BUFFER, colorData);
        bindAttribute(gl, colorBuffer, 3, 4);
        // color的loc = 3，每个实例调用一次
        gl.vertexAttribDivisor(3, 1);

        this.matrixBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.matrixBuffer);
        // gl.DYNAMIC_DRAW 告诉着色器这些数据经常变化，动态的，常规的用STATIC_DRAW
        gl.bufferData(gl.ARRAY_BUFFER, this.modelMatrixData, gl.DYNAMIC_DRAW);

        const matrixLoc = 4;
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

        // 绑定结束        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);
    }
    //图层初始化
    initialize(map, gl) {
        // 根据数据构造program vao等
        const vs = `#version 300 es
           layout(location=0) in vec3 a_position;
           layout(location=3) in vec4 a_color;
           layout(location=4) in mat4 uPMatrix;
           out vec4 vColor;
           void main() {
               gl_Position = uPMatrix * vec4(a_position,1.0);
               vColor = a_color;
           }`;
        const fs = `#version 300 es
           precision highp int;
           precision highp float;
           in vec4 vColor;
           out vec4 outColor;
           void main() {
               outColor = vColor;
           }`;
        this._drawModel = createModel(gl, vs, fs);

        this.setGeometry();
        const modelOrigin = [ 118, 32 ];
        const modelAltitude = 0;

        this.modelAsMercatorCoordinate = fromLngLat(
            modelOrigin,
            modelAltitude
        );
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
        // 2d 
        gl.useProgram(this._drawModel.program);
        //绑定顶点vao
        gl.bindVertexArray(this.sphereVAO);
        // 正常情况先 平移再旋转，最后缩放
        for (let ndx = 0; ndx < this.numInstances; ndx++) {
            const matParams = this.spheres[ ndx ];
            // 1 先平移到 0 0
            const mat_1 = mat4.fromTranslation([], vec3.fromValues(matParams.translate[ 0 ], matParams.translate[ 1 ], matParams.translate[ 2 ]));
            const mat_2 = mat4.fromScaling([], vec3.fromValues(matParams.scale[ 0 ], matParams.scale[ 1 ], matParams.scale[ 2 ]));
            // 3 合并计算，先平移再缩放
            const mat_3 = mat4.multiply([], mat_2, mat_1);

            // 5 合并地图mvp矩阵
            const mat_6 = mat4.multiply([], matrix, mat_3);
            // 更新每个实例的矩阵属性
            for (let i = 0; i < 16; i++) {
                this.modelMatrixData[ 16 * ndx + i ] = mat_6[ i ];
            }
        }
        // upload the new matrix data
        gl.bindBuffer(gl.ARRAY_BUFFER, this.matrixBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.modelMatrixData);


        gl.drawArraysInstanced(
            gl.TRIANGLES,
            0, // 偏移
            this.numVertices, // 每个实例的顶点数
            this.numInstances // 实例的数量
        )

        //如果取消绑定，会报错GL_INVALID_OPERATION: Insufficient buffer size.
        gl.bindVertexArray(null);

    }
    onRemove(map, gl) {

    }
}



export async function run(mapdiv, gui = null) {
    // 先加载贴图
    const png = await loadImage('./datas/khronos_webgl.png');
    // 模拟球的测试数据
    const sphereData = createSphere({ radius: 0.5 });
    // 初始化地图
    let baseMap = 'vector';
    const map = initMap(mapdiv, baseMap, [ 118, 32 ], 9);
    // 构造图层
    const layer = new OitLayer(png, sphereData);
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
