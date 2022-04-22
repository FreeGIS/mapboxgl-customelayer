import uuid from '../util/uuid';
import { createModel, createBuffer, bindAttribute, bindTexture2D } from '../util/webgl_util';
import { vec3, mat4 } from 'gl-matrix';
import fromLngLat from '../util/fromLonLat';
import initMap from '../util/initMap';
import proj4 from 'proj4';
import { getPositionNormal } from '../util/position_normal';

function degToRad(d) {
    return d * Math.PI / 180;
}




/////////////////////////
// 测试数据
/////////////////////////
const positions = new Float32Array([
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
    118, 33, 0,

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



let positions_mkt = new Float32Array(positions.length);
// 统一转墨卡托坐标 米为单位的 坐标
let origin1 = proj4('EPSG:4326', 'EPSG:3857').forward([117, 32]);
let origin2 = proj4('EPSG:4326', 'EPSG:3857').forward([117.2, 32.2]);

for (let i = 0; i < positions.length; i = i + 3) {
    const coormkt = fromLngLat([positions[i], positions[i + 1]], positions[i + 2]);
    positions_mkt[i] = coormkt.x;
    positions_mkt[i + 1] = coormkt.y;
    positions_mkt[i + 2] = coormkt.z;

    const coor3857 = proj4('EPSG:4326', 'EPSG:3857').forward([positions[i], positions[i + 1]]);
    if (i < positions.length / 2) {
        positions[i] = coor3857[0] - origin1[0];
        positions[i + 1] = coor3857[1] - origin1[1];
    } else {
        positions[i] = coor3857[0] - origin2[0];
        positions[i + 1] = coor3857[1] - origin2[1];
    }
}

// 法向量用米去计算
const normals = getPositionNormal(positions);

const colors = new Float32Array([
    //  bottom
    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,

    //  top
    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,

    // front 地图的y轴与世界坐标系相反
    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,

    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,

    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,

    // back
    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,
    0.0, 1.0, 0, 0.3,

    //  bottom
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,

    //  top
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,

    // front 地图的y轴与世界坐标系相反
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,

    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,

    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,

    // back
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0,
    1.0, 0, 0, 1.0
]);

class SphereLayer {
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

    // 设置图形
    setGeometry() {
        const gl = this.gl;
        //GL_INVALID_OPERATION: Insufficient buffer size. 通常没new Float32Array
        this.sphereVAO = gl.createVertexArray();
        gl.bindVertexArray(this.sphereVAO);
        const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, positions_mkt);
        bindAttribute(gl, positionBuffer, 0, 3);
        const normalBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(normals));
        bindAttribute(gl, normalBuffer, 1, 3);

        const colorBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(colors));
        bindAttribute(gl, colorBuffer, 2, 4);



        // Quad for draw pass
        this.quadVAO = gl.createVertexArray();
        gl.bindVertexArray(this.quadVAO);

        const quadPositionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array([
            -1, 1,
            -1, -1,
            1, -1,
            -1, 1,
            1, -1,
            1, 1,
        ]));
        bindAttribute(gl, quadPositionBuffer, 0, 2);

        // 绑定结束        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);

        // 平行光  入射方向
        gl.useProgram(this._depthPeelModel.program);
        gl.uniform3fv(this._depthPeelModel.u_reverseLightDirection, [0.5, 0.7, 1]);
    }
    // 创建model
    createModel() {
        const gl = this.gl;
        // 根据数据构造program vao等
        const peeling_vs = `#version 300 es
            layout(location=0) in vec3 position;
            layout(location=1) in vec3 normal;
            layout(location=2) in vec4 a_color;
            uniform mat4 uViewProj;
            uniform mat4 u_worldInverseTranspose;
            out vec3 vPosition;
            out vec3 vNormal;
            out vec4 vColor;
          
            void main() {
                gl_Position = uViewProj * vec4(position,1.0);
                vNormal = mat3(u_worldInverseTranspose) * normal;
                vPosition = position;
                vColor = a_color;
            }`;
        const peeling_fs = `#version 300 es
            precision highp int;
            precision highp float;
            precision highp sampler2D;
    
            #define MAX_DEPTH 99999.0

            uniform sampler2D uTexture;
            uniform sampler2D uDepth;
            uniform sampler2D uFrontColor;

            // 视点位置 mkt 0-1 坐标
            uniform vec3 uEyePosition;
            // 光线位置
            //uniform vec3 uLightPosition;
            // 世界坐标系 入射方向
            uniform vec3 u_reverseLightDirection;

            
            // 视点位置 mkt 0-1 坐标
            in vec3 vPosition;
            in vec3 vNormal;
            in vec4 vColor;


            layout(location=0) out vec2 depth;  // RG32F, R - negative front depth, G - back depth
            layout(location=1) out vec4 frontColor;
            layout(location=2) out vec4 backColor;

            void main() {
                // -------------------------
                // dual depth peeling
                // -------------------------
    
                float fragDepth = gl_FragCoord.z;   // 0 - 1
    
                ivec2 fragCoord = ivec2(gl_FragCoord.xy);
                vec2 lastDepth = texelFetch(uDepth, fragCoord, 0).rg;
                vec4 lastFrontColor = texelFetch(uFrontColor, fragCoord, 0);
    
                // depth value always increases
                // so we can use MAX blend equation
                depth.rg = vec2(-MAX_DEPTH);
    
                // front color always increases
                // so we can use MAX blend equation
                frontColor = lastFrontColor;
    
                // back color is separately blend afterwards each pass
                backColor = vec4(0.0);
    
                float nearestDepth = - lastDepth.x;
                float furthestDepth = lastDepth.y;
                float alphaMultiplier = 1.0 - lastFrontColor.a;
    
    
                if (fragDepth < nearestDepth || fragDepth > furthestDepth) {
                    // Skip this depth since it's been peeled.
                    return;
                }
    
                if (fragDepth > nearestDepth && fragDepth < furthestDepth) {
                    // This needs to be peeled.
                    // The ones remaining after MAX blended for 
                    // all need-to-peel will be peeled next pass.
                    depth.rg = vec2(-fragDepth, fragDepth);
                    return;
                }
    
    
                // -------------------------------------------------------------------
                // If it reaches here, it is the layer we need to render for this pass
                // -------------------------------------------------------------------

                vec3 position = vPosition;
                vec3 normal = normalize(vNormal);
               

                vec4 baseColor = vColor;
                // 物体到视点位置，即视线方向 mkt0-1坐标算的
                vec3 eyeDirection = normalize(uEyePosition - position);
                // 物体到光线位置，即光线方向 uLightPosition不是mkt 0-1坐标系
                //vec3 lightVec = uLightPosition - position;
                //vec3 lightDirection = normalize(lightVec);
                // -lightDirection 是光线方向反方向，即 光线入射方向
                // 反射光线方向 入射方向与平面法向量的反射=反射光线
                vec3 reflectionDirection = reflect(u_reverseLightDirection, normal);
                //光照系数 入射角=dot(光线方向,法线方向)
                float nDotL = max(dot(-u_reverseLightDirection, normal), 0.0);
                // 漫反射
                float diffuse = nDotL;
                // 环境光
                float ambient = 0.2;
                //光照强度 视线方向与反射方向的夹角
                float specular = pow(max(dot(reflectionDirection, eyeDirection), 0.0), 20.0);

                vec4 color = vec4((ambient + diffuse + specular) * baseColor.rgb, baseColor.a);
               
                // dual depth peeling
                // write to back and front color buffer

                if (fragDepth == nearestDepth) {
                    frontColor.rgb += color.rgb * color.a * alphaMultiplier;
                    frontColor.a = 1.0 - alphaMultiplier * (1.0 - color.a);
                } else {
                    backColor += color;
                }
            }`;

        const quad_vs = `#version 300 es
            layout(location=0) in vec2 aPosition;
            void main() {
                gl_Position = vec4(aPosition,0.0,1.0);
            }`;
        const blend_back_fs = `#version 300 es
            precision highp float;
            uniform sampler2D uBackColor;
            out vec4 fragColor;
            void main() {
                fragColor = texelFetch(uBackColor, ivec2(gl_FragCoord.xy), 0);
                if (fragColor.a == 0.0) { 
                    discard;
                }
            }`;
        const final_fs = `#version 300 es
            precision highp float;
    
            uniform sampler2D uFrontColor;
            uniform sampler2D uBackColor;
            out vec4 fragColor;
            void main() {
                ivec2 fragCoord = ivec2(gl_FragCoord.xy);
                vec4 frontColor = texelFetch(uFrontColor, fragCoord, 0);
                vec4 backColor = texelFetch(uBackColor, fragCoord, 0);
                float alphaMultiplier = 1.0 - frontColor.a;
    
                fragColor = vec4(
                    frontColor.rgb + alphaMultiplier * backColor.rgb,
                    frontColor.a + backColor.a
                );
            }`;
        this._depthPeelModel = createModel(gl, peeling_vs, peeling_fs);
        this._blendBackModel = createModel(gl, quad_vs, blend_back_fs);
        this._finalModel = createModel(gl, quad_vs, final_fs);
    }
    // 创建uniform
    createUniform() {
        const gl = this.gl;
        ////////////////////////////////
        //  SET UP FRAMEBUFFERS
        ////////////////////////////////
        // 2 for ping-pong
        // COLOR_ATTACHMENT0 - depth
        // COLOR_ATTACHMENT1 - front color
        // COLOR_ATTACHMENT2 - back color
        this.depthPeelBuffers = [gl.createFramebuffer(), gl.createFramebuffer()];

        // 2 for ping-pong
        // COLOR_ATTACHMENT0 - front color
        // COLOR_ATTACHMENT1 - back color
        this.colorBuffers = [gl.createFramebuffer(), gl.createFramebuffer()];

        this.blendBackBuffer = gl.createFramebuffer();

        this.fbo_textures = [];
        for (let i = 0; i < 2; i++) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.depthPeelBuffers[i]);

            let depthTarget = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, depthTarget);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, gl.RG, gl.FLOAT, null);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, depthTarget, 0);

            let frontColorTarget = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, frontColorTarget);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, gl.RGBA, gl.HALF_FLOAT, null);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, frontColorTarget, 0);

            let backColorTarget = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, backColorTarget);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, gl.RGBA, gl.HALF_FLOAT, null);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, backColorTarget, 0);

            this.fbo_textures.push(depthTarget, frontColorTarget, backColorTarget);

            gl.bindFramebuffer(gl.FRAMEBUFFER, this.colorBuffers[i]);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, frontColorTarget, 0);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, backColorTarget, 0);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.blendBackBuffer);
        this.blendBackTarget = gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, this.blendBackTarget);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, gl.RGBA, gl.HALF_FLOAT, null);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.blendBackTarget, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        this.lightPosition = vec3.fromValues(1, 1, 2);
        this.DEPTH_CLEAR_VALUE = -99999.0;
        this.MAX_DEPTH = 1.0;
        this.MIN_DEPTH = 0.0;
        this.NUM_PASS = 4;   // maximum rendered layer number = NUM_PASS * 2
    }
    //图层初始化
    initialize() {
        // 设置model
        this.createModel();
        // 设置图形 vao
        this.setGeometry();
        // 设置uniform
        this.createUniform();

    }
    onAdd(m, gl) {
        this.map = m;
        this.gl = gl;
        //必须启用这个插件
        if (!gl.getExtension('EXT_color_buffer_float')) {
            console.error('FLOAT color buffer not available');
        }
        gl.enable(gl.BLEND);
        gl.depthMask(false);
        gl.disable(gl.CULL_FACE);

        this.initialize();
    }

    render(gl, matrix) {

        const transform = this.map.transform;
        const pitch = degToRad(this.map.getPitch());
        //地图旋转后，修改法向量参数
        let worldMatrix = mat4.fromXRotation([], -1 * pitch);
        mat4.rotateZ(worldMatrix, worldMatrix, -1 * transform.angle);

        // worldMatrix = mat4.multiply([],worldMatrix,this.modelMatrix);
        const worldInverseMatrix = mat4.invert([], worldMatrix);
        const worldInverseTransposeMatrix = mat4.transpose([], worldInverseMatrix);




        //////////////////////////////////
        // 1. Initialize min-max depth buffer
        //////////////////////////////////
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.blendBackBuffer);
        // fbo里每次都清空
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.depthPeelBuffers[0]);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
        gl.clearColor(this.DEPTH_CLEAR_VALUE, this.DEPTH_CLEAR_VALUE, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.depthPeelBuffers[1]);
        gl.clearColor(-this.MIN_DEPTH, this.MAX_DEPTH, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.colorBuffers[0]);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.colorBuffers[1]);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // draw depth for first pass to peel
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.depthPeelBuffers[0]);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
        gl.blendEquation(gl.MAX);


        gl.useProgram(this._depthPeelModel.program);
        gl.bindVertexArray(this.sphereVAO);

        bindTexture2D(gl, this.fbo_textures[3], 13);
        gl.uniform1i(this._depthPeelModel.uDepth, 13);
        bindTexture2D(gl, this.fbo_textures[4], 14);
        gl.uniform1i(this._depthPeelModel.uFrontColor, 14);

        //gl.uniform3fv(this._depthPeelModel.uLightPosition, new Float32Array(this.lightPosition));

        // 当前相机位置，mkt 0-1 坐标系。
        const cameraPosition = this.map.getFreeCameraOptions().position;
        //console.log('camera',cameraPosition);
        gl.uniform3fv(this._depthPeelModel.uEyePosition, new Float32Array([cameraPosition.x, cameraPosition.y, cameraPosition.z]));
        gl.uniform3fv(this._depthPeelModel.uLightPosition, [1, 0, 0]);


        gl.uniformMatrix4fv(this._depthPeelModel.uViewProj, false, matrix);

        gl.uniformMatrix4fv(this._depthPeelModel.u_worldInverseTranspose, false, worldInverseTransposeMatrix);
        // 根据索引绘制
        //gl.drawElements(gl.TRIANGLES, this._positionCount, gl.UNSIGNED_BYTE, 0);
        gl.drawArrays(gl.TRIANGLES, 0, positions_mkt.length / 3);
        ////////////////////////////////////
        // 2. Dual Depth Peeling Ping-Pong
        ////////////////////////////////////
        let readId, writeId;
        let offsetRead, offsetBack;

        for (let pass = 0; pass < this.NUM_PASS; pass++) {
            readId = pass % 2;
            writeId = 1 - readId;  // ping-pong: 0 or 1

            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.depthPeelBuffers[writeId]);
            gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
            gl.clearColor(this.DEPTH_CLEAR_VALUE, this.DEPTH_CLEAR_VALUE, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);

            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.colorBuffers[writeId]);
            gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);

            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.depthPeelBuffers[writeId]);
            gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]);
            gl.blendEquation(gl.MAX);

            // update texture uniform
            offsetRead = readId * 3;
            gl.useProgram(this._depthPeelModel.program);

            bindTexture2D(gl, this.fbo_textures[offsetRead], 13);
            gl.uniform1i(this._depthPeelModel.uDepth, 13);
            bindTexture2D(gl, this.fbo_textures[offsetRead + 1], 14);
            gl.uniform1i(this._depthPeelModel.uFrontColor, 14);


            // draw geometry
            gl.bindVertexArray(this.sphereVAO);
            //gl.drawElements(gl.TRIANGLES, this._positionCount, gl.UNSIGNED_BYTE, 0);
            gl.drawArrays(gl.TRIANGLES, 0, positions_mkt.length / 3);
            // blend back color separately
            offsetBack = writeId * 3;
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.blendBackBuffer);
            gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
            gl.blendEquation(gl.FUNC_ADD);
            gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gl.useProgram(this._blendBackModel.program);
            // 修改绑定的纹理loc
            bindTexture2D(gl, this.fbo_textures[offsetBack + 2], 15);
            gl.uniform1i(this._blendBackModel.uBackColor, 15);


            gl.bindVertexArray(this.quadVAO);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);



        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(this._finalModel.program);


        bindTexture2D(gl, this.blendBackTarget, 16);
        gl.uniform1i(this._finalModel.uBackColor, 16);

        bindTexture2D(gl, this.fbo_textures[offsetBack + 1], 17);
        gl.uniform1i(this._finalModel.uFrontColor, 17);

        gl.bindVertexArray(this.quadVAO);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        gl.bindVertexArray(null);
    }
    onRemove(map, gl) {

    }
}



export async function run(mapdiv, gui = null) {

    // 初始化地图
    let baseMap = 'vector';
    const map = initMap(mapdiv, baseMap, [118, 32], 9);
    // 构造图层
    const layer = new SphereLayer();
    map.on('load', function () {
        map.addLayer(layer);
    });
}
