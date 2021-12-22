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
export { GET };