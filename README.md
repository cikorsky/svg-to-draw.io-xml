<div align="center">
  <img src="./public/assets/logo.svg" width="80" alt="SVG to Draw.io Logo"/>
  <h1>SVG to Draw.io XML</h1>
  <p>批量、纯离线转换 SVG 为 Draw.io XML 格式的可变色图库</p>
</div>

![界面截图](./public/assets/screenshot.png)

---
一款现代化的 Web 工具，基于 Next.js 开发，旨在将 SVG 图标完美转换为 draw.io (diagrams.net) 原生支持的可变色形状库 (.xml)，或一键提取单体剪贴板代码。

无论你是想要将设计工具中的图标库（如 Iconfont、Figma 导出的 SVG）批量整合为团队内部使用的 draw.io 资产，还是日常临时转换个别图标，本工具都能提供极速、安全、无缝的体验。

## ✨ 核心特性

- **🚀 极简交互，双重导入** 
  - 支持单文件或批量 SVG **拖拽/点击上传**。
  - 支持 **直接手动粘贴 SVG 代码**，适应快速跨应用（如从 VS Code 或设计工具中直接 C/V 代码）操作的场景。
- **🧹 智能清洗与去色**
  - 自动移除冗余标签和属性（例如 iconfont 的特有 class 或多余的全局外框）。
  - 支持一键 **去除原生配色**，从而在 draw.io 内部可以使用原生 Fill (填充色) 和 Stroke (描边色) 功能随意更改图标颜色。
  - 支持智能锁定图库元素的长宽比。
- **🎨 高保真路径解析**
  - 完整支持所有物理路径指令（`M`, `L`, `H`, `V`, `C`, `S`, `Q`, `T`, `A`）。
  - 完美兼容弧线与多阶贝塞尔曲线，保障图标在 draw.io 中的像素级还原。
- **📦 灵活的一键输出**
  - **下载标准图库**：一键生成经过 DEFLATE 压缩标准编码的 `.xml` 文件，这正是 draw.io 支持的原生侧边栏图库格式。
  - **单体急救粘贴**：支持在预览界面悬浮点击“复制”，随后在 draw.io 画布中按下 `Ctrl+E`（编辑形状）并直接粘贴 XML 代码。
- **🔒 绝对的隐私安全**
  - **纯纯的静态离线工具**，100% 在本地浏览器计算与转换。
  - 你的 SVG 数据永远不会被上传到任何后台服务器，无惧保密项目图标泄漏。

## 🛠️ 技术栈与依赖

- **前端架构**: Next.js (App Router) + React + TypeScript
- **UI 设计与样式**: Tailwind CSS + Lucide Icons (图标)
- **核心算法依赖**: 
  - [`pako`](https://www.npmjs.com/package/pako) (处理向 xml 格式封装时的 DEFLATE 压缩与 base64 编码)
  - [`svg-path-parser`](https://www.npmjs.com/package/svg-path-parser) (进行 SVG 路径的 AST 取树与解析)
  - 浏览器的原生 `DOMParser` 用于安全的 HTML/XML 节点遍历和清理。

## 🧠 项目架构与技术原理解析

本项目采用现代的前端构建方案，无需借助任何 Node.js 后端服务或外部 API 获取支持，图形的所有处理及文件封包皆**在用户的浏览器环境局域范围内严格计算并输出**。

### 核心目录结构
```text
src/
├── app/                  # Next.js App Router 目录 (入口页面、视图组件)
│   ├── layout.tsx        # 整体布局定义与 Tailwind v4 全局预设引入
│   └── page.tsx          # 单体主视觉页面及拖拽/输入交互控制器
└── lib/                  # 包含核心图形转换、提取隔离与压缩打包逻辑引擎
    ├── svg-sanitizer.ts  # 无用节点剥离与可选项（去色控制）净化器
    ├── svg-to-stencil.ts # 原生 SVG AST 向量路径降级/扁平化转移器（适配生成 draw.io 自定义 xml）
    └── packager.ts       # mxlibrary 压缩格式生成与 Base64 封包器
```

### 转换原理流程详解

本工具之所以能够做到“高保真”且让生成的图标表现和原生组件一致，是因为贯穿了以下三步流水线：

1. **环境纯净度处理 (`svg-sanitizer.ts`)**
   利用浏览器原生的 `DOMParser` 生成解析树，安全的剔除带有业务或设计软件特性的垃圾标签（如 `<title>`, `class`, 以及 Iconfont 为了对齐用的占位框等）。如果用户勾选了“去除原有配色”，分析器将会逐层遍历并强制移除所有具有特定十六进制或 RGB 颜色的 `fill` 与 `stroke` 属性，将其转换为无色状态等待 draw.io 从层级上下文继承颜色。
2. **矢量几何重定向映射 (`svg-to-stencil.ts`)**
   Draw.io 官方的 XML 并不支持直接输入 HTML `<svg>` 原生标签流，而是有着自己特有的一套图形绘制语法声明。
   我们借助对几何路径极其敏感的 AST 解析器 (`svg-path-parser`) 将极其混乱或通过相对坐标 `m, c, a` 写出来的高阶曲线甚至残缺绘制命令，统一**扁平重算并降维转换**成纯绝对坐标值 `M, L, C, A` 等物理游标定位命令，并按其 `w` `h` 比例逐个包裹进原生的 `<shape><foreground><path>...</path></foreground></shape>` XML 指令流中。同时，自动为图形四个主要角落加上精准的 `<connections>` 连接控制锚点。
3. **压缩入库封装 (`packager.ts`)**
   最终通过官方支持的 `mxlibrary` 数据源挂载。这部分我们对图元做了一个 `pako` 的 Raw DEFLATE 流处理然后将其转化成了 `base64` 原生块以保证最大的传输容差和向后兼容。这解决了由于单体 svg 内容过大导致在 draw.io 一旦保存极易形成崩溃性读取的问题。

## 🚀 部署指南

### 本地开发运行

```bash
# 1. 安装依赖
npm install

# 2. 启动本地开发服务器
npm run dev

# 3. 浏览器访问 http://localhost:3000
```

### Docker 容器部署 (推荐)

我们提供了多阶段构建的 `Dockerfile`，构建出的镜像极小且已在生产环境级别优化。

**使用 Docker Compose 快速启动**:
```bash
docker-compose up -d
```
启动后即可通过 `http://localhost:3000` 访问服务。

### QNAP NAS 部署 (Container Station)

为了方便在 QNAP NAS 设备上纯离线部署，本项目支持一键封包导出为针对不同 CPU 架构（如 Intel/AMD 或 ARM）的离线 Docker 镜像。

#### 1. 打包离线镜像文件
在你的电脑控制台根目录下运行封包脚本：
```bash
# 修改权限（首次运行）
chmod +x build-for-qnap.sh

# 为主流 Intel Core / AMD64 架构 NAS 编译打包
./build-for-qnap.sh linux/amd64

# (可选) 为 ARM 架构 NAS 编译打包
# ./build-for-qnap.sh linux/arm64
```
等待编译完成后，你会在项目目录中得到一个 `svg-to-drawio-image-0.1.0.tar` 文件。

#### 2. 在 NAS 导入并运行
1. 打开 QNAP NAS 的 **Container Station (容器工作站)**。
2. 左侧菜单点击 **“映像 (Images)”** -> 右上角 **“导入 (Import)”**，上传刚才生成的 `.tar` 文件。
3. 导入完成后，左侧点击 **“应用程序 (Applications)”** -> 右上角 **“创建 (Create)”**。
4. 将本项目下的 `docker-compose.prod.yml` 文件内容完全粘贴进去（如有端口冲突请自行修改映射）。
5. 验证并创建后，打开游览器访问 `http://<NAS_IP>:3000` 即可使用。

## 📜 鸣谢与参考资料

本项目的核心转换逻辑与图形学算法在开发过程中参考了以下开源库与规范：

- 核心算法启发: [mmunozba/svgtodrawio](https://github.com/mmunozba/svgtodrawio)
- 压缩逻辑解析: [mxlibrary 协议解析](https://blog.csdn.net/tiger9991/article/details/143184081)
- 官方图库标准规范: [Draw.io Stencil Specs](https://github.com/jgraph/drawio-libs)

## ⚖️ 开源协议

本项目基于 **MIT** 协议开源。你可以自由地使用、修改和分发，但也请保留原作者的版权声明。
