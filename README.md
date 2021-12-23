# mapboxgl-customelayer 
## 一 前言
基于webgl2的知识开发mapboxgl 3d customelayer学习教程。笔者学习webgl过程中，每个教程都会新出一个场景和数据，学完一节再看下一节就有点蒙。后来改在地图场景中练习，将webgl知识与地图应用结合起来学习比较有场景代入感。因此，本学习教程本质还是webgl理论，只是故意固定到地图中进行带入。

为降低学习难度和第三方框架干扰，建议所有新手，使用原生webgl进行学习，不引入第三方webgl框架，例如three、regl、twgl、luma等。原因是新手不理解底层，使用框架出现各种问题也不知道定位和解决，资料也没原生webgl多，所以新手绝对不能直接就上框架，后患很大，笔者亲自体会入门直接luma，各种问题翻遍了源码还是webgl基础，一个问题卡几天，千万别直接框架，哪怕three也不行。
## 二 资料来源
- [webgl2理论基础](https://webgl2fundamentals.org/webgl/lessons/zh_cn/)
- [WebGL极简入门](https://github.com/fafa1899/WebGLTutorial)
- [mapboxgl官方示例](https://docs.mapbox.com/mapbox-gl-js/example/custom-style-layer/)

## 三 安装

```
# 安装依赖
npm install
# 编译
npm run build
# 启动
npm run serve
```

## 四 练习目录
当前已有资料如下：


1 地形

2 光照

3 uv纹理

4 地理坐标系纹理
