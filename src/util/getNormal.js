import { vec3 } from 'gl-matrix';
function getNormal(point_a, point_b, point_c) {
  const a = vec3.fromValues(point_a[0], point_a[1], point_a[2]);
  const b = vec3.fromValues(point_b[0], point_b[1], point_b[2]);
  const c = vec3.fromValues(point_c[0], point_c[1], point_c[2]);
  const vector_cb = vec3.subtract([], c, b);
  const vector_ab = vec3.subtract([], a, b);
  const normal = vec3.cross([], vector_cb, vector_ab);
  // const d_normal = vec3.normalize([], d);
  return normal;
}

export default getNormal;