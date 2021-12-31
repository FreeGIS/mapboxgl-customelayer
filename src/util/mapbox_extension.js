import mapboxgl from 'mapbox-gl';
import Point from '@mapbox/point-geometry';

//对MapboxGL地图库进行源码扩展
function mapboxglExtension() {
    // 扩展，使其兼容webgl2
    if (mapboxgl.Map.prototype._setupPainter.toString().indexOf('webgl2') === -1) {
        let _setupPainterOld = mapboxgl.Map.prototype._setupPainter;
        mapboxgl.Map.prototype._setupPainter = function () {
            let getContextOld = this._canvas.getContext;
            this._canvas.getContext = function (name, attrib) {
                return getContextOld.apply(this, ['webgl2', attrib]) ||
                    getContextOld.apply(this, ['webgl', attrib]) ||
                    getContextOld.apply(this, ['experimental-webgl', attrib]);
            };
            _setupPainterOld.apply(this);
            this._canvas.getContext = getContextOld;
        };
    }
    //扩展Map的api，增加一个获取相机位置的方法，用于3d开发使用
    mapboxgl.Map.prototype.getCameraPosition = function (isMKT = true) {
        const transform = this.transform;
        const pitch = transform._pitch;
        const altitude = Math.cos(pitch) * transform.cameraToCenterDistance;
        const latOffset = Math.tan(pitch) * transform.cameraToCenterDistance;
        const latPosPointInPixels = transform.centerPoint.add(new Point(0, latOffset));
        const latLong = transform.pointLocation(latPosPointInPixels);
        const verticalScaleConstant = transform.worldSize / (2 * Math.PI * 6378137 * Math.abs(Math.cos(latLong.lat * (Math.PI / 180))));
        const altitudeInMeters = altitude / verticalScaleConstant;
        //返回墨卡托坐标
        if (isMKT) {
            const coors = mapboxgl.MercatorCoordinate.fromLngLat({ lng: latLong.lng, lat: latLong.lat }, altitudeInMeters);
            return [coors.x, coors.y, coors.z];
        }
        else {
            //返回经纬度
            return [latLong.lng, latLong.lat, altitudeInMeters];
        }
    };
}
// Mapbox 地形编码解码函数
function mapboxHeightEncode(height) {
    const value = Math.floor((height + 10000) * 10);
    const r = value >> 16;
    const g = (value >> 8 & 0x0000FF)
    const b = value & 0x0000FF
    return [r, g, b];
}
function mapboxHeightDecode(color) {
    return -10000 + ((color[0] * 256 * 256 + color[1] * 256 + color[2]) * 0.1);
}

export { mapboxglExtension, mapboxHeightEncode, mapboxHeightDecode };