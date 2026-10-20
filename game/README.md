# game/ — Snow Bros WebGL 试玩页

本目录放 Unity WebGL 构建产物，对应线上 `https://snowbros.huoyue.club/game/index.html`。
结构对齐 deepseasonar 的 `/game/`（Unity 2022 默认 WebGL 模板，平铺于此）。

## 构建后把以下内容原样拷进本目录

```
game/
├── index.html            ← Unity 生成的试玩页（默认模板即可，无需改动）
├── Build/                ← WebGL.loader.js / .wasm / .data / .framework.js（均为 .unityweb brotli 包）
├── TemplateData/         ← style.css / favicon.ico 等
└── StreamingAssets/      ← 运行时必读：Addressables(aa/)、ConfigBlob、AudioBlob、BTBlob、Localization
```

> ⚠️ `StreamingAssets/` **必须**一起拷进来——游戏运行时会从这里读配置 Blob（ConfigBlob）、
> 音频 Blob（AudioBlob）、行为树 Blob（BTBlob）、本地化（Localization）和 Addressables 资源包（aa/）。
> 缺了它玩家/敌人不会生成、音频/文本缺失。

落地页 `../index.html` 顶部的「▶ 在线试玩 WebGL」按钮即指向本目录的 `index.html`。

## 压缩与部署（已验证）

- 构建目标：WebGL，**Compression = brotli**，产物以 `.unityweb` 后缀平铺（wasm/data/framework）。
- **已开启 Decompression Fallback**：GitHub Pages 不会主动发 `Content-Encoding: br`，由 Unity loader
  在 JS 侧解压 `.unityweb`，无需服务器特殊配置，可直接在 `snowbros.huoyue.club/game/` 运行。
- 本地静态服务器验证要点：`.unityweb` 当 `application/octet-stream` 或 `application/javascript` 发出均可
  （loader 走 fetch→ArrayBuffer→解压），**切勿**注入 `Content-Encoding: br`（会二次解压崩）。
- 入口场景需在 Build Settings → Scenes In Build 勾选（参考 `ProjectSettings/EditorBuildSettings.asset`
  已启用 `SampleScene.unity` / 启动场景）。
- 不要加「返回主页」链接——保持与 deepseasonar 一致（Unity 默认模板本就没有）。
- 构建产物较大，提交前确认只 add 了 `Build/` `TemplateData/` `StreamingAssets/` `index.html`，
  不要误提交本地临时文件。总体积约 19MB，最大单文件 wasm ≈ 9MB，未触及 GitHub 100MB 限制，无需 Git LFS。
