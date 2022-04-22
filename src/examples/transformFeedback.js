import initMap from '../util/initMap';
// import fromLngLat from '../util/fromLonLat';
import uuid from '../util/uuid';
import { createModel, createBuffer, bindAttribute } from '../util/webgl_util';


// create random positions and velocities.
const rand = (min, max) => {
    if (max === undefined) {
        max = min;
        min = 0;
    }
    return Math.random() * (max - min) + min;
};
//const numParticles = 200;
const numParticles = 60000;
function createPoints(num, ranges) {
    let a = new Array(num).fill(0);
    return a.map(_ => ranges.map(range => {
        return rand(...range);
    })).flat()
};


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
        this._map = map;
        this._gl = gl;
        // 根据数据构造program vao等
        const updatePositionVS = `#version 300 es
        layout(location=0) in vec2 oldPosition;
        layout(location=1) in vec2 velocity;
    
        uniform float deltaTime;
        uniform vec2 geoDimensions;
    
        out vec2 newPosition;
    
        vec2 euclideanModulo(vec2 n, vec2 m) {
          return mod(mod(n, m) + m, m);
        }
    
        void main() {
            newPosition = euclideanModulo(
                oldPosition + velocity * deltaTime,
                geoDimensions);
        }
      `;

        const updatePositionFS = `#version 300 es
            precision highp float;
            void main() {
            }
        `;

        const drawParticlesVS = `#version 300 es
        #define M_PI 3.1415926535897932384626433832795
        #define earthCircumfrence 2.0 * M_PI * 6371008.8
        layout(location=0) in vec2 position;
        uniform mat4 matrix;
        vec3 lonlat2mkt(vec3 xyz){
            float mkt_x = (180.0 + xyz.x) / 360.0;
            float mkt_y = (180.0 - (180.0 / M_PI * log(tan(M_PI / 4.0 + xyz.y * M_PI / 360.0)))) / 360.0;
            float mkt_z = xyz.z / (earthCircumfrence * cos(xyz.y * M_PI / 180.0));
            return vec3(mkt_x,mkt_y,mkt_z);
        }
        void main() {
            // do the common matrix math
            gl_Position = matrix * vec4(lonlat2mkt(vec3(position,0.0)),1.0);
            gl_PointSize = 1.0;
        }
        `;

        const drawParticlesFS = `#version 300 es
        precision highp float;
        out vec4 outColor;
        void main() {
        outColor = vec4(1, 0, 0, 1);
        }
        `;
        this.updatePositionModel = createModel(gl, updatePositionVS, updatePositionFS, ['newPosition']);
        this.drawParticlesModel = createModel(gl, drawParticlesVS, drawParticlesFS);

        // 随机初始位置
        const positions = new Float32Array(createPoints(numParticles, [[118, 119], [32, 33]]));
        // 粒子速度 -100到100米
        const velocities = new Float32Array(createPoints(numParticles, [[-0.001, 0.001], [-0.001, 0.001]]));

        const position1Buffer = createBuffer(gl, gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
        const position2Buffer = createBuffer(gl, gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
        const velocityBuffer = createBuffer(gl, gl.ARRAY_BUFFER, velocities);

        const updatePositionVA1 = gl.createVertexArray();
        gl.bindVertexArray(updatePositionVA1);
        bindAttribute(gl, position1Buffer, 0, 2);
        bindAttribute(gl, velocityBuffer, 1, 2);


        const updatePositionVA2 = gl.createVertexArray();
        gl.bindVertexArray(updatePositionVA2);
        bindAttribute(gl, position2Buffer, 0, 2);
        bindAttribute(gl, velocityBuffer, 1, 2);

        const drawVA1 = gl.createVertexArray();
        gl.bindVertexArray(drawVA1);
        bindAttribute(gl, position1Buffer, 0, 2);


        const drawVA2 = gl.createVertexArray();
        gl.bindVertexArray(drawVA2);
        bindAttribute(gl, position2Buffer, 0, 2);



        function makeTransformFeedback(gl, buffer) {
            const tf = gl.createTransformFeedback();
            gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);
            gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, buffer);
            return tf;
        }

        const tf1 = makeTransformFeedback(gl, position1Buffer);
        const tf2 = makeTransformFeedback(gl, position2Buffer);

        // unbind left over stuff
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);
        gl.bindVertexArray(null);


        this.current = {
            updateVA: updatePositionVA1,  // read from position1
            tf: tf2,                      // write to position2
            drawVA: drawVA2,              // draw with position2
        };
        this.next = {
            updateVA: updatePositionVA2,  // read from position2
            tf: tf1,                      // write to position1
            drawVA: drawVA1,              // draw with position1
        };

        gl.useProgram(this.updatePositionModel.program);
        gl.bindVertexArray(this.current.updateVA);
        gl.uniform2f(this.updatePositionModel.geoDimensions, 1.0, 1.0);

        this.then = (new Date()).getTime();;
    }
    render(gl, matrix) {
        let time1 = (new Date()).getTime() * 0.0001;
        // Subtract the previous time from the current time
        const deltaTime = time1 - this.then;
        // Remember the current time for the next frame.
        this.then = time1;



        gl.useProgram(this.updatePositionModel.program);
        gl.bindVertexArray(this.current.updateVA);
        gl.uniform1f(this.updatePositionModel.deltaTime, deltaTime);

        gl.enable(gl.RASTERIZER_DISCARD);

        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.current.tf);
        gl.beginTransformFeedback(gl.POINTS);
        gl.drawArrays(gl.POINTS, 0, numParticles);
        gl.endTransformFeedback();
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

        // turn on using fragment shaders again
        gl.disable(gl.RASTERIZER_DISCARD);

        // now draw the particles.
        gl.useProgram(this.drawParticlesModel.program);
        gl.bindVertexArray(this.current.drawVA);
        gl.uniformMatrix4fv(
            this.drawParticlesModel.matrix,
            false,
            matrix);
        gl.drawArrays(gl.POINTS, 0, numParticles);

        // swap which buffer we will read from
        // and which one we will write to
        {
            const temp = this.current;
            this.current = this.next;
            this.next = temp;
        }

        //如果取消绑定，会报错GL_INVALID_OPERATION: Insufficient buffer size.
        gl.bindVertexArray(null);
        this._map.triggerRepaint();
    }
    onRemove(map, gl) {
        
    }
}

export async function run(mapdiv, gui = null) {
    // 初始化地图
    let baseMap = 'vector';
    const map = initMap(mapdiv, baseMap, [118.5,32.5], 10);

    // 构造图层
    const layer = new CustomeLayer();
    map.on('load', function () {
        map.addLayer(layer);
    });
}
