function GET(url, type) {
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

function loadImage(img_src) {
    return new Promise((res, rej) => {
        let img = new Image();
        img.src = img_src;
        img.onload = function () {
            res(img);
        }
        img.onerror = function () {
            rej('error');
        }
    });
}
export { GET, loadImage };