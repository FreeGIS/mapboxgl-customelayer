# mapboxgl-customelayer 
## 一 前言
基于webgl2的知识开发mapboxgl 3d customelayer学习教程。笔者学习webgl过程中，每个教程都会新出一个场景和数据，学完一节再看下一节就有点蒙。后来改在地图场景中练习，将webgl知识与地图应用结合起来学习比较有场景代入感。因此，本学习教程本质还是webgl理论，只是故意固定到地图中进行带入。

为降低学习难度和第三方框架干扰，建议所有新手，使用原生webgl进行学习，不引入第三方webgl框架，例如three、regl、twgl、luma等。原因是新手不理解底层，使用框架出现各种问题也不知道定位和解决，资料也没原生webgl多，所以新手绝对不能直接就上框架，后患很大，笔者亲自体会入门直接luma，各种问题翻遍了源码还是webgl基础，一个问题卡几天，千万别直接框架，哪怕three也不行。
## 二 资料来源
- [webgl2理论基础](https://webgl2fundamentals.org/webgl/lessons/zh_cn/)
- [WebGL极简入门](https://github.com/fafa1899/WebGLTutorial)
- [mapboxgl官方示例](https://docs.mapbox.com/mapbox-gl-js/example/custom-style-layer/)

## 三 学习内容概述

- 三角形-->顶点索引--> 纹理绘制
- mvp矩阵略（自行掌握，使用地图已有，练习不再说明，部分模型需要引入矩阵计算之后）
- 光照与法向量
- 正射投影略，有需要自行掌握，地图自带透视投影
- fbo（离屏渲染）
- 地图上的阴影
- 地图上的文字
- 地图上的模板测试
- 地图上的混合
- 深度检测
- 三维物体透明渲染

## 四 安装

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

1 绘制三角形

参考[《使用WebGL2进行Mapbox自定义图层开发》](https://mp.weixin.qq.com/s?__biz=Mzg2OTUxMzM2MA==&mid=2247483684&idx=1&sn=cbec2c833fa0a2a30e3ee0d6063fbf0c&chksm=ce9aa0dbf9ed29cd1b65bebf5e773eb8b4005c3d347b033426d0c4b65807ab74934268d9df88&token=192320095&lang=zh_CN#rd)

![三角形](https://github.com/FreeGIS/mapboxgl-customelayer/blob/master/docs/triangle.png)

2 顶点索引

![顶点索引](https://github.com/FreeGIS/mapboxgl-customelayer/blob/master/docs/indices.png)


3 uv纹理

![uv纹理](https://github.com/FreeGIS/mapboxgl-customelayer/blob/master/docs/uv_texture.png)


4 地理坐标系纹理

![地理坐标系纹理](https://github.com/FreeGIS/mapboxgl-customelayer/blob/master/docs/geo_texture.png)

5 地形

![地形](https://github.com/FreeGIS/mapboxgl-customelayer/blob/master/docs/dem.png)

6 地形光照

![地形光照](https://github.com/FreeGIS/mapboxgl-customelayer/blob/master/docs/dem_light.png)

7 地形纹理

![地形纹理](https://github.com/FreeGIS/mapboxgl-customelayer/blob/master/docs/dem_texture.png)

8 偏移旋转

![偏移旋转](https://github.com/FreeGIS/mapboxgl-customelayer/blob/master/docs/rotation.png)

9 模型矩阵变换

![模型矩阵变换](https://github.com/FreeGIS/mapboxgl-customelayer/blob/master/docs/model_matrix.png)


10 球体

![球体](https://github.com/FreeGIS/mapboxgl-customelayer/blob/master/docs/sphere.png)

11 球体实例化渲染

![球体实例化渲染](https://github.com/FreeGIS/mapboxgl-customelayer/blob/master/docs/sphereInstanced.png)

12 球体透明OIT渲染

![球体透明OIT渲染](https://github.com/FreeGIS/mapboxgl-customelayer/blob/master/docs/oit.png)