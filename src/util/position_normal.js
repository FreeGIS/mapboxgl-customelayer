import getNormal from "./getNormal";
import { vec3 } from 'gl-matrix';
export function getPositionNormal(positions) {
    const length = positions.length;
    let normal = new Float32Array(length);
    for (let i = 0; i < length; i = i + 9) {
        // 原始坐标计算法向量，不能使用投影转换后的坐标转换
        const point_a = [positions[i], positions[i + 1], positions[i + 2]];
        const point_b = [positions[i + 3], positions[i + 4], positions[i + 5]];
        const point_c = [positions[i + 6], positions[i + 7], positions[i + 8]];
        const d = getNormal(point_a, point_b, point_c);
        // 分别记录三个顶点的法向量，用于向量相加（所谓的平均就是顶点的各个法向量相加，所谓平均就是最后的结果归一化即可）
        // 没有采用面积加权，查询部分资料认为效果不好似无必要。
        normal[i] += d[0];
        normal[i + 1] += d[1];
        normal[i + 2] += d[2];
        normal[i + 3] += d[0];
        normal[i + 4] += d[1];
        normal[i + 5] += d[2];

        normal[i +6] += d[0];
        normal[i + 7] += d[1];
        normal[i + 8] += d[2];
    }
    // 应该根据面积加权平均，这里格点比较均匀，直接平均测试，求单位向量
    for (let i = 0; i < normal.length; i = i + 3) {
        const d_normal = vec3.normalize([], vec3.fromValues(normal[i], normal[i + 1], normal[i + 2]));
        normal[i] = d_normal[0];
        normal[i + 1] = d_normal[1];
        normal[i + 2] = d_normal[2];
    }
    return normal;
}