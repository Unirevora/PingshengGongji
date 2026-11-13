# Glassmorphism 与地图更新

2026-11-13：通过配置中的 `https://www.stylekit.top/mcp` 实际调用 `stylekit_get_style`，slug=`glassmorphism`，加载 tokens、card recipe 与 implementation brief；原始响应保存在 `stylekit-glassmorphism.json`。本项目保留用户指定的老报宋，材质遵循 StyleKit 的深墨夜景、40px blur / 180% saturation、低透明度白色面板、顶边高光及底边阴影、香槟金强调规则。

字体从根目录移至 `styles/LaobaoSong.ttf`。原字体的垂直度量表 `vmtx` 不完整，浏览器 OTS 拒绝加载；保留原版为 `styles/LaobaoSong.source.ttf`，为横排页面移除损坏的垂直度量表后重存。字体通过 `styles/font.css` 注册，同时用于 HTML/SVG 与 ECharts canvas。

地图使用本地 Leaflet 1.9.4 与 Natural Earth 1:10m 海岸线、河流；精细模式按视口请求 OpenStreetMap 标准瓦片，不预抓取或批量下载。在线与纸本底图可切换，失败自动回退本地地理层。保持 CBDB 原始人物坐标，不以底图细节宣称历史定位更准确。

地图交互：拖拽、滚轮、双击、缩放按钮、比例尺、当前中心坐标、简繁体历史地点搜索、标签避让、逐级显示地名；切换籍贯/任职图层保留视角；点击排行可放大定位；选择地点仍可查看关联人物。

本轮只做桌面字体加载与地图缩放/地点定位的最小运行检查，不重跑既有完整测试套件或移动端验证。

最小运行结果：浏览器确认 LaobaoSong 状态 loaded；长安搜索定位后缩放至 Z8；切换籍贯/任职保留视角；武安关联人物 311 人可正常进入档案检索；无页面脚本错误。结果保存在 `verification/glass-minimum.json`，首页截图为 `verification/glass-desktop.png`。

`stylekit-material-lint.json` 只记录材质 token 片段的 MCP lint，不代表整站视觉或代码验证。
