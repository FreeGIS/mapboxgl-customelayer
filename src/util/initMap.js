import { mapboxglExtension } from './mapbox_extension';
function initMap(mapdiv, baseMapType, center, zoom) {
    mapboxgl.accessToken = 'pk.eyJ1IjoiZnJlZWdpcyIsImEiOiJjam04dXRudWwwNXczM3Fqb3dkd201dGZzIn0.jvDsB3YWibUpk1oR9vva1A';
    // 扩展mapboxgl，使其支持webgl2
    mapboxglExtension();
    let style = 'mapbox://styles/mapbox/dark-v10';
    // 加载底图
    let map = new mapboxgl.Map({
        container: mapdiv,
        style: style,
        attributionControl: true,
        renderWorldCopies: false,
        center: center,
        zoom: zoom,
        antialias: true
    });
    map.addControl(new mapboxgl.NavigationControl(), 'top-left');
    return map;
}

export default initMap;