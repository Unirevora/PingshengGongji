# 地图与三维图阅读修订

2026-11-13，本轮仅处理地图说明、在线底图、三维标注及 CMD 入口。

- 操作提示与底图状态放在地图下方同一行；计数规则、坐标来源和地理边界放入默认折叠的“统计口径与地理来源”。排行图单独显示计数单位与前 12 名范围，不再重复长段地理说明。
- 在线底图默认改为 Esri World Topographic Map；明确提供纸本、Esri 地形、OSM 街道三项。瓦片加载失败或 8 秒仍无成功瓦片时回退纸本层；来源切换同步清理归属，不保留已经移除的来源名称。
- 三维柱顶常显地点名和人数，地点轴与人数轴显式使用浅色。拖拽旋转、缩放与二维切换保留。
- `push-github.ps1` 归档，改为独立的 `push-github.cmd`，无需调用 PowerShell。可双击运行，或传入提交说明。`--check` 只检查入口，不提交、获取或推送。

最小桌面检查：Esri 24 张瓦片实际加载；模拟 OSM 失败后回退本地底图；移除在线图层后仅显示 Natural Earth 署名；三维标签显示“長安 / 3,546 人”，轴单位为“人数（人）”；无页面脚本错误。CMD 检查模式退出码 0，未实际推送。未运行完整套件或移动端验证。

来源：[Esri World Topographic Map](https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer)、[OpenStreetMap](https://www.openstreetmap.org/copyright)、[Natural Earth](https://www.naturalearthdata.com/)。
