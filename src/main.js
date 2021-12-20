import * as examples from '../gen/exampleLoader';
import * as dat from 'dat.gui';

// 全局gui参数交互
let gui;
function removeClassName(el, className) {
    el.className = (el.className || '').replace(className, '');
}

async function loadExample(hashName) {
    const name = hashName.substring(1);
    const exampleLoader = examples[ name ];
    if (!exampleLoader) {
        return;
    }

    const map_div = document.getElementById('map');
    if (map_div)
        document.body.removeChild(map_div);

    const mapdiv = document.createElement('div');
    mapdiv.id = 'map';
    document.body.appendChild(mapdiv);

    if (gui) {
        const div = document.getElementsByClassName('dg ac')[0];
        if(div)
            document.body.removeChild(div);
    }
    gui = new dat.GUI();
    const example = await exampleLoader();

    await example.run('map', gui);
}



// 遍历右侧示例菜单
const exampleLinks = document.querySelectorAll('a.nav-link');
let lastSelected = undefined;
exampleLinks.forEach(link => {
    link.addEventListener('click', () => {
        if (lastSelected !== undefined) {
            removeClassName(lastSelected, 'selected');
        }
        link.className += ' selected';
        lastSelected = link;
    });
});

// 左侧菜单点击
window.addEventListener('popstate', () => {
    loadExample(window.location.hash);
});
loadExample(window.location.hash);