function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);

    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader));
    }

    return shader;
}

export function createProgram(gl, vertexSource, fragmentSource, transformFeedbackVaryings = null) {
    const program = gl.createProgram();

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);

    if (transformFeedbackVaryings) {
        gl.transformFeedbackVaryings(
            program,
            transformFeedbackVaryings,
            gl.SEPARATE_ATTRIBS,
        );
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program));
    }

    return program;
}
export function createModel(gl, vertexSource, fragmentSource, transformFeedbackVaryings = null) {
    const program = gl.createProgram();

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);

    if (transformFeedbackVaryings) {
        gl.transformFeedbackVaryings(
            program,
            transformFeedbackVaryings,
            gl.SEPARATE_ATTRIBS,
        );
    }

    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program));
    }

    const wrapper = { program: program };

    const numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < numAttributes; i++) {
        const attribute = gl.getActiveAttrib(program, i);
        wrapper[attribute.name] = gl.getAttribLocation(program, attribute.name);
    }
    const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < numUniforms; i++) {
        const uniform = gl.getActiveUniform(program, i);
        wrapper[uniform.name] = gl.getUniformLocation(program, uniform.name);
    }
    return wrapper;
}
export function makeTransformFeedback(gl, buffer) {
    const tf = gl.createTransformFeedback();
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, buffer);
    return tf;
}

export function createTexture2D(gl, textureDesc) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // 告诉 WebGL 一次处理 1 个字节，在unit8Array时候必须写。
    // [gl.UNPACK_ALIGNMENT]: 1
    for (let key in textureDesc.pixelStore) {
        gl.pixelStorei(key, textureDesc.pixelStore[key]);
    }
    for (let key in textureDesc.parameters) {
        gl.texParameteri(gl.TEXTURE_2D, key, textureDesc.parameters[key]);
    }
    if (textureDesc.data instanceof Uint8Array) {
        gl.texImage2D(gl.TEXTURE_2D, textureDesc.mipLevel, textureDesc.internalFormat, textureDesc.width, textureDesc.height, 0, textureDesc.srcFormat, textureDesc.type, textureDesc.data);
    } else {
        gl.texImage2D(gl.TEXTURE_2D, textureDesc.mipLevel, textureDesc.internalFormat, textureDesc.srcFormat, textureDesc.type, textureDesc.data);
    }
    if (textureDesc.mipLevel > 0) {
        gl.generateMipmap(gl.TEXTURE_2D);
    }
    return texture;
}

export function bindTexture2D(gl, texture, unit) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
}
export function bindTexture3D(gl, texture, unit) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_3D, texture);
}

export function createTextureStorage2D(gl, textureDesc) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    for (let key in textureDesc.pixelStore) {
        gl.pixelStorei(key, textureDesc.pixelStore[key]);
    }
    for (let key in textureDesc.parameters) {
        gl.texParameteri(gl.TEXTURE_2D, key, textureDesc.parameters[key]);
    }
    gl.texStorage2D(gl.TEXTURE_2D, textureDesc.mipLevel, textureDesc.internalFormat, textureDesc.width, textureDesc.height);
    // 可能错误，不一定是立刻赋值的
    //gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureDesc.width, textureDesc.height, textureDesc.srcFormat,  textureDesc.type, textureDesc.data);
    gl.generateMipmap(gl.TEXTURE_2D);
    return texture;
}

export function createTextureStorage3D(gl, unit, textureDesc) {
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_3D, texture);
    for (let key in textureDesc.pixelStore) {
        gl.pixelStorei(key, textureDesc.pixelStore[key]);
    }
    gl.texStorage3D(gl.TEXTURE_3D, textureDesc.levels, textureDesc.srcFormat, textureDesc.width, textureDesc.height, textureDesc.depth);
    for (let key in textureDesc.parameters) {
        gl.texParameteri(gl.TEXTURE_3D, key, textureDesc.parameters[key]);
    }
    gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, 0,
        textureDesc.width, textureDesc.height, textureDesc.depth,
        textureDesc.internalFormat, textureDesc.type, textureDesc.data);
    return texture;

}



export function createBuffer(gl, buffertype, data, drawType = gl.STATIC_DRAW) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(buffertype, buffer);
    gl.bufferData(buffertype, data, drawType);
    return buffer;
}

export function createIndicesBuffer(gl, indices, posCount) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
    // indices记录pos的序号，以pos总数判断indices的值范围，8 16 32
    if (posCount < Math.pow(2, 8)) {
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint8Array(indices), gl.STATIC_DRAW);
        return gl.UNSIGNED_BYTE;
    }
    else if (posCount < Math.pow(2, 16)) {
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
        return gl.UNSIGNED_SHORT;
    }
    else {
        //启用扩展，否则drawElements数组太大，会绘制混乱
        gl.getExtension('OES_element_index_uint');
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);
        return gl.UNSIGNED_INT;
    }
}

export function bindAttribute(gl, buffer, attributeLoc, numComponents, offset = 0) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(attributeLoc);
    gl.vertexAttribPointer(attributeLoc, numComponents, gl.FLOAT, false, offset, 0);
}


export function bindFramebuffer(gl, framebuffer, texture = null) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    if (texture) {
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    }
}