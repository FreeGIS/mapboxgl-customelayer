// 影像重投影
import Arrugator from 'arrugator';

//根据地理范围，转换函数，阈值设定，返回影像渲染的顶点，uv纹理坐标，三角形顶点索引
function textureReprojection(bbox,forward,epsilon){
    const controlPoints = [
        [bbox[0], bbox[3]], // top-left
        [bbox[0], bbox[1]], // bottom-left
        [bbox[2], bbox[3]], // top-right
        [bbox[2], bbox[1]], // bottom-right
    ];
    //纹理uv坐标
    const sourceUV = [
        [0, 0],	// top-left
        [0, 1],	// bottom-left
        [1, 0],	// top-right
        [1, 1],	// bottom-right
    ];
    // const epsilon = 0.0000000001;
    const arruga = new Arrugator(
        forward,
        controlPoints,
        sourceUV,
        [[0, 1, 3], [0, 3, 2]]	// topleft-bottomleft-bottomright ; topleft-bottomright-topright
    );

    arruga.lowerEpsilon(epsilon);

    const arrugado = arruga.output();
    // 将arrugado提取出pos uv indices
    const pos = arrugado.projected.flat();
    // uv纹理
    const uv = arrugado.uv.flat();
    // 三角形index
    const trigs = arrugado.trigs.flat();

    return {
        pos,uv,trigs
    };
}
export default textureReprojection;