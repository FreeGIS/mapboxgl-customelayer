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
        this.modelInverseTransposeMatrixData = new Float32Array(NUM_SPHERES * 16);


        const scale = [0.8, 0.8, 0.8];
        for (let i = 0; i < NUM_SPHERES; ++i) {
            let angle = 2 * Math.PI * (i % NUM_PER_ROW) / NUM_PER_ROW;
            let x = Math.sin(angle) * RADIUS;
            //let y = Math.floor(i / NUM_PER_ROW) / (NUM_PER_ROW / 4) - 0.75;
            //let z = Math.cos(angle) * RADIUS;
            let y = Math.cos(angle) * RADIUS;
            let z = Math.floor(i / NUM_PER_ROW) * 0.75;

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

        const uvBuffer = createBuffer(gl, gl.ARRAY_BUFFER, sphere.uvs);
        bindAttribute(gl, uvBuffer, 1, 2);

        const normalBuffer = createBuffer(gl, gl.ARRAY_BUFFER, sphere.normals);
        bindAttribute(gl, normalBuffer, 2, 3);

        const colorBuffer = createBuffer(gl, gl.ARRAY_BUFFER, colorData);
        bindAttribute(gl, colorBuffer, 3, 4);
        // color的loc = 3，每个实例调用一次
        gl.vertexAttribDivisor(3, 1);


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

            // 为了让模型在缩放后能保持正确法向量，需要求逆转置
            const mat_5 = mat4.invert([], sphereinfo.modelMatrix);
            const worldInverseTranspose = mat4.transpose([], mat_5);

            // 更新每个实例的矩阵属性
            for (let j = 0; j < 16; j++) {
                this.modelInverseTransposeMatrixData[16 * i + j] = worldInverseTranspose[j];
                this.modelMatrixData[16 * i + j] = sphereinfo.modelMatrix[j];
            }
        }


        const matrixBuffer = createBuffer(gl, gl.ARRAY_BUFFER, this.modelMatrixData);

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



        const modelInverseTransposeMatrixDataBuffer = createBuffer(gl, gl.ARRAY_BUFFER, this.modelInverseTransposeMatrixData);
        const matrixLoc1 = 8;
        const bytesPerMatrix1 = 4 * 16;
        for (let i = 0; i < 4; ++i) {
            const loc = matrixLoc1 + i;
            gl.enableVertexAttribArray(loc);
            // note the stride and offset
            const offset = i * 16;  // 4 floats per row, 4 bytes per float
            gl.vertexAttribPointer(
                loc,              // location
                4,                // size (num values to pull from buffer per iteration)
                gl.FLOAT,         // type of data in buffer
                false,            // normalize
                bytesPerMatrix1,   // stride, num bytes to advance to get to next set of values
                offset,           // offset in buffer
            );
            // this line says this attribute only changes for each 1 instance
            gl.vertexAttribDivisor(loc, 1);
        }


        const indices = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphere.indices, gl.STATIC_DRAW);
        this._positionCount = sphere.indices.length;



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
        gl.enableVertexAttribArray(0);

        // 绑定结束        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);
    }
    // 创建model
    createModel() {
        const gl = this.gl;
        // 根据数据构造program vao等
        const peeling_vs = `#version 300 es
            layout(location=0) in vec3 position;
            layout(location=1) in vec2 uv;
            layout(location=2) in vec3 normal;
            layout(location=3) in vec4 color;
            // 模型平移缩放旋转后的矩阵
            layout(location=4) in mat4 modelMatrix;
            // 上一个矩阵实际占用location 4-5-6-7 几个loc，下一个必须从8开始
            layout(location=8) in mat4 modelInverseTransposeMatrix;

            uniform mat4 uViewProj;

            out vec3 vPosition;
            out vec2 vUV;
            out vec3 vNormal;
            flat out vec4 vColor;

            void main() {
                vec4 world_position = modelMatrix * vec4(position,1.0);
                gl_Position = uViewProj * world_position;
                vPosition = world_position.xyz;
                vUV = uv;
                // 因为法向量是方向所以不用关心位移， 矩阵的左上 3x3 部分才是控制姿态的
                vNormal = mat3(modelInverseTransposeMatrix) * normal;
                vColor = color;
            }`;
        const peeling_fs = `#version 300 es
            precision highp int;
            precision highp float;
            precision highp sampler2D;
    
            #define MAX_DEPTH 99999.0

            uniform sampler2D uTexture;
            uniform sampler2D uDepth;
            uniform sampler2D uFrontColor;

            // 视点位置
            uniform vec3 uEyePosition;
            // 光线位置
            uniform vec3 uLightPosition;
            
            in vec3 vPosition;
            in vec2 vUV;
            in vec3 vNormal;
            flat in vec4 vColor;

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
                vec2 uv = vUV;

                vec4 baseColor = vColor * texture(uTexture, uv);
                // 物体到视点位置，即视线方向
                vec3 eyeDirection = normalize(uEyePosition - position);
                // 物体到光线位置，即光线方向
                vec3 lightVec = uLightPosition - position;
                vec3 lightDirection = normalize(lightVec);
                // -lightDirection 是光线方向反方向，即 光线入射方向
                // 反射光线方向 入射方向与平面法向量的反射=反射光线
                vec3 reflectionDirection = reflect(-lightDirection, normal);
                //光照系数 入射角=dot(光线方向,法线方向)
                float nDotL = max(dot(lightDirection, normal), 0.0);
                // 漫反射
                float diffuse = nDotL;
                // 环境光
                float ambient = 0.2;
                //光照强度 视线方向与反射方向的夹角
                float specular = pow(max(dot(reflectionDirection, eyeDirection), 0.0), 20.0);

                vec4 color = vec4((ambient + diffuse + specular) * baseColor.rgb, vColor.a);
               
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


        this.eyePosition = vec3.fromValues(0, 0.8, 2);
        this.lightPosition = vec3.fromValues(1, 1, 2);


        this.DEPTH_CLEAR_VALUE = -99999.0;
        this.MAX_DEPTH = 1.0;
        this.MIN_DEPTH = 0.0;
        this.NUM_PASS = 4;   // maximum rendered layer number = NUM_PASS * 2


        // 创建贴图纹理
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
        bindTexture2D(gl, this._texture, 10);
        gl.uniform1i(this._depthPeelModel.uTexture, 10);
        gl.uniform3fv(this._depthPeelModel.uLightPosition, new Float32Array(this.lightPosition));
        gl.uniform3fv(this._depthPeelModel.uEyePosition, new Float32Array(this.eyePosition));
        gl.uniformMatrix4fv(this._depthPeelModel.uViewProj, false, matrix);
        // 根据索引绘制实例
        gl.drawElementsInstanced(gl.TRIANGLES, this._positionCount, gl.UNSIGNED_SHORT, 0, this.numInstances);

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
            gl.drawElementsInstanced(gl.TRIANGLES, this._positionCount, gl.UNSIGNED_SHORT, 0, this.numInstances);

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
