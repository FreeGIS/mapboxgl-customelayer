const earthRadius = 6371008.8;
const earthCircumfrence = 2 * Math.PI * earthRadius; // meters

function circumferenceAtLatitude(latitude) {
    return earthCircumfrence * Math.cos(latitude * Math.PI / 180);
}
function mercatorXfromLng(lng) {
    return (180 + lng) / 360;
}
function mercatorYfromLat(lat) {
    return (180 - (180 / Math.PI * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)))) / 360;
}

function mercatorZfromAltitude(altitude, lat) {
    return altitude / circumferenceAtLatitude(lat);
}

function fromLngLat(lngLat, altitude = 0) {
    return {
        x: mercatorXfromLng(lngLat[0]),
        y: mercatorYfromLat(lngLat[1]),
        z: mercatorZfromAltitude(altitude, lngLat[1])
    };
}

export default fromLngLat;