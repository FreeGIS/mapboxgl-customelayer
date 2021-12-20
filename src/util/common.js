import { mapboxglExtension } from '../engine/core/mapbox';
import Grid from '../engine/type/grid';

function getInfo(url, type) {
    return new Promise((res, rej) => {
        const xhr = new XMLHttpRequest();
        xhr.responseType = type;
        xhr.open('get', url, true);
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                const metadata = xhr.getResponseHeader("gridMetadata");
                const arraybuffer = xhr.response;
                res({
                    metadata, arraybuffer
                });
            } else {
                rej(new Error(xhr.statusText));
            }
        };
        xhr.send();
    });
}

function getInfo1(url, type) {
    return new Promise((res, rej) => {
        const xhr = new XMLHttpRequest();
        xhr.responseType = type;
        xhr.open('get', url, true);
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                const result = xhr.response;
                res(result);
            } else {
                rej(new Error(xhr.statusText));
            }
        };
        xhr.send();
    });
}


function parseImg(metadata, arraybuffer) {
    return new Promise((res, rej) => {
        const urlCreator = window.URL || window.webkitURL;
        const dataURL = urlCreator.createObjectURL(arraybuffer);
        let img = new Image();
        img.src = dataURL;
        img.onload = function () {
            const grid = new Grid(metadata.start_x, metadata.start_y, 0,
                metadata.end_x, metadata.end_y, 0,
                metadata.increment_x, metadata.increment_y, 0,
                metadata.count_x, metadata.count_y, 0, 
                metadata.min_value, metadata.max_value, img
            );
            res(grid);
        }
    });
}
function parseImg1(metadata, imgURL) {
    return new Promise((res, rej) => {
        let img = new Image();
        img.src = imgURL;
        img.onload = function () {
            const grid = new Grid(metadata.start_x, metadata.start_y, 0,
                metadata.end_x, metadata.end_y, 0,
                metadata.increment_x, metadata.increment_y, 0,
                metadata.count_x, metadata.count_y, 0, 
                metadata.min_value, metadata.max_value, img,metadata.legend
            );
            res(grid);
        }
    });
}
function parseMask(mask) {
    return new Promise((res, rej) => {
        let img = new Image();
        img.src = mask;
        img.onload = function () {
            res(img);
        }
    });
}
//tms的行值=2^zoom（y轴总行数，见公式二）-谷歌行值-1

function initMap(mapdiv, baseMapType, center, zoom) {
    mapboxgl.accessToken = 'pk.eyJ1IjoiZnJlZWdpcyIsImEiOiJjam04dXRudWwwNXczM3Fqb3dkd201dGZzIn0.jvDsB3YWibUpk1oR9vva1A';
    //初始化底图
    mapboxglExtension();
    let style;
    if (baseMapType === 'vector') {
        style = 'http://121.5.55.47:8060/basemap/styles/dark';
        //style = 'mapbox://styles/mapbox/dark-v10';
    } else {
        style = {
            "version": 8,
            "name": "Mapbox Streets",
            "glyphs": "http://121.5.55.47:8060/public/mapFonts/{fontstack}/{range}.pbf",
            "sources": {
                "osm-tiles": {
                    "type": "raster",
                    "tiles": [
                        "http://c.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    ],
                    "tileSize": 256
                },
                /*
                "satellite":{
                    "type": "raster",
                    "tiles": [
                        "http://localhost:8080/datas/tiles256/{z}/{x}/{y}.png"
                        //"http://121.5.55.47:8060/grid/getGrayTile/{z}/{x}/{y}.png"
                    ],
                    "tileSize": 256,
                    "scheme":"xyz"
                }*/
            },
            "layers": [{
                "id": "123",
                "type": "raster",
                "source": "osm-tiles"
            },
            /*
            {
                "id": "456",
                "type": "raster",
                "source": "satellite"
            },*/
        ]
        }
    }
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
const endPoint = 'http://121.5.55.47:8060';
export { initMap, getInfo, parseImg,parseImg1,getInfo1,parseMask,endPoint };
