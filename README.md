# Pixel Office for Windows

Pixel Office 把 Codex 当前任务里的子代理画进一间办公室。你能看到它们入座、工作、交付，完成后去休息区或茶水间。任务结束 30 分钟后，代理会从画面下方的入口离开。

当前版本是 `0.3.3+codex.20260820`，只支持 Windows 10 和 Windows 11。项目定位是 Codex Desktop 社区插件。

![Pixel Office for Windows](pixel-office/docs/preview.png)

## 画面里有什么

办公室里固定有 8 张桌子。每张桌子的电脑画面和桌面物件都不一样。员工外观由头部、上衣和下部三部分组合而成，9 × 9 × 9 一共 729 种，15 套姿势覆盖正面、侧面、背面、坐姿和几种工作动作。

任务状态也会反映在画面里。完成或失败都会马上释放工位，让后面的代理补上。完成的代理会先向总经理交付文件，再去休息区或茶水间；失败的代理会显示红色气泡。等待期间如果被召回，代理会保留这一轮的外观并直接回到工作区。超过 30 分钟后，它会走向入口、淡出，然后从动画中移除。之后重新接到任务，会以新的一轮外观从门口进入。

超过 8 名活跃代理时，额外代理会进入不重叠的入口队列。交付队列会向左右展开，不会把人堆在同一个位置。窗外景色按浏览器本地时间在清晨、上午、中午、下午、傍晚和夜里之间切换。

中间的总经理默认使用 `deepseek-drool` 宠物贴图，原版贴图仍作为回退方案保留。右上角的“更换总经理”按钮可以在两种贴图之间切换，并记住浏览器中的选择。画面下方只绘制俯视角度能看到的公司门框。

点击员工可以查看任务、当前状态和已经写入 rollout 的完整输出。Pixel Office 只观察 Codex 已经创建的子代理，不会自行启动或控制它们。

## 安装

运行前请准备：

- Windows 10 或 Windows 11
- 支持插件的 Codex Desktop 和 Codex CLI
- Node.js 18 或更高版本
- Git
- 可用的本机 `8791` 端口

正常安装和运行不需要 npm 依赖、Python 或 Pillow。只有重新生成像素素材时才需要 Python 和 Pillow。本项目不提供 macOS 或 Linux 安装支持。

在 PowerShell 中添加 marketplace 并安装插件：

```powershell
codex plugin marketplace add WangJin991016/pixel-office-win --ref main
codex plugin add pixel-office@pixel-office-win
```

完成后完全退出并重新打开 Codex Desktop，再新建一个任务，让 skill 和 MCP server 重新加载。可以这样确认 Codex 已经识别 marketplace 和插件：

```powershell
codex plugin marketplace list
codex plugin list
```

如果你使用了自定义 `CODEX_HOME`，PowerShell 和 Codex Desktop 需要使用同一套环境配置。

## 使用

通常不需要在提示词里提到 Pixel Office。当前 Codex 任务启动 subagent 后，插件会通过 MCP 确保本地桥接服务运行，读取 `CODEX_HOME\sessions` 下最新任务树的 rollout 日志，并在下面的地址提供办公室页面：

<http://127.0.0.1:8791/>

Codex Desktop 会尝试在右侧浏览器区域打开页面。如果没有自动打开，可以手动访问这个地址。桥接服务的当前状态可以这样查看：

```powershell
Invoke-RestMethod http://127.0.0.1:8791/api/state
```

## 子代理工作流程

```text
进入办公室
  ├─ 有空工位：坐下工作
  └─ 没有空工位：进入不重叠的入口队列，等待递补

任务结束
  ├─ 完成：释放工位，交付文件，再去休息区或茶水间
  └─ 失败：释放工位，显示红色气泡，再去休息区或茶水间

终态等待
  ├─ 30 分钟内被召回：保留外观并返岗
  └─ 满 30 分钟：走向入口，淡出并移出画面
```

实时模式严格等待 30 分钟。演示模式等待 30 秒，回放模式会根据回放倍速缩放这段时间。

## 手动运行

克隆仓库后进入插件源码目录：

```powershell
git clone https://github.com/WangJin991016/pixel-office-win.git
Set-Location .\pixel-office-win\pixel-office
```

实时模式：

```powershell
node .\server\server.mjs --host 127.0.0.1 --port 8791
```

循环演示模式：

```powershell
node .\server\server.mjs --demo --host 127.0.0.1 --port 8792
```

回放历史任务树：

```powershell
node .\server\server.mjs --replay "A:\path\to\rollout.jsonl" --speed 20
```

读取另一个会话目录：

```powershell
node .\server\server.mjs --sessions-dir "A:\path\to\sessions" --port 8791
```

实时页面默认使用 `8791` 端口，演示页面默认使用 `8792` 端口。

## 更新和卸载

更新插件：

```powershell
codex plugin marketplace upgrade pixel-office-win
codex plugin add pixel-office@pixel-office-win
```

更新后重新启动 Codex Desktop，并新建一个任务。Codex 会把插件复制到本地缓存，所以只更新 GitHub 仓库不会影响已经加载的旧任务。

卸载插件和 marketplace：

```powershell
codex plugin remove pixel-office@pixel-office-win
codex plugin marketplace remove pixel-office-win
```

如果你手动启动过桥接服务，可以在任务管理器中结束对应的 `node.exe`，也可以回到启动服务的 PowerShell 窗口按 `Ctrl+C`。

## 数据和安全

为了显示代理名称、任务文本和输出，Pixel Office 会读取 Codex rollout 日志：

```text
%CODEX_HOME%\sessions\**\rollout-*.jsonl
```

没有设置 `CODEX_HOME` 时，服务会使用 `%USERPROFILE%\.codex\sessions`。

桥接服务只读会话日志，不修改 rollout 文件。它默认只绑定 `127.0.0.1`，但 `/api/state` 和 `/events` 没有身份验证，返回内容可能包含任务提示词和代理输出。因此不要把 `8791` 端口转发到局域网或互联网。服务本身不会主动向外部网络发送会话内容。

新版 Codex 可能会加密 `spawn_agent.message`。遇到这种情况，页面会退回显示 `task_name` 作为主任务文本。

## 项目运行模式

```text
Codex rollout JSONL（只读）
          │
          ▼
pixel-office/server/server.mjs
  ├─ 解析任务树和代理生命周期
  ├─ GET /api/state
  ├─ GET /events（SSE）
  └─ 提供 public/ 静态资源
          │
          ▼
原生 HTML + CSS + JavaScript + Canvas 2D
          │
          ▼
Codex Desktop 右侧浏览器或普通浏览器
```

运行时只使用 Node.js 标准库。前端没有框架，也没有构建步骤。

主要目录如下：

```text
.
├─ .agents/plugins/marketplace.json   GitHub marketplace 清单
├─ README.md                          Windows 主文档
└─ pixel-office/
   ├─ .codex-plugin/plugin.json       插件清单
   ├─ .mcp.json                       MCP server 注册
   ├─ skills/pixel-office/            自动触发与打开办公室
   ├─ server/                         日志桥接、状态机、SSE
   ├─ public/                         页面、动画和生成后的 PNG
   ├─ tools/                          像素素材生成器
   ├─ tests/                          生命周期、场景、素材和浏览器测试
   └─ docs/DEVELOPMENT.md             Windows 开发说明
```

## 开发和测试

```powershell
Set-Location .\pixel-office

node --test `
  .\tests\server-appearance-03.test.mjs `
  .\tests\client-lifecycle-02.test.cjs

node .\tests\scene-render-02.test.cjs
py -3 .\tests\assets-02.test.py
```

浏览器回归测试需要 Playwright 模块以及可用的 Chromium 或 Edge 路径。通常先在 `8792` 启动演示服务，再运行 `tests/browser-render-03.test.cjs`。

只有修改素材生成器时才需要安装 Pillow 并重建图片：

```powershell
py -3 -m pip install Pillow
Set-Location .\tools
py -3 .\draw_workers.py
py -3 .\draw_furniture.py
py -3 .\make_props.py
```

生成器会检查三段式图集、729 种组合、15 个姿势、8 套工位、6 张窗景和 Boss 素材。更完整的架构说明和回归清单在 [开发文档](pixel-office/docs/DEVELOPMENT.md) 中。

## 当前限制

- 只跟踪最新的一棵 Codex 根任务树，不会同时展示多个任务。
- 气泡按照 rollout 中已经写入的完整消息更新，不是逐 token 流式显示。
- 如果代理进程消失，而且没有留下完成、失败或中断事件，页面可能会继续把它显示为工作中。
- 自动打开右侧页面依赖 Codex Desktop 的宿主能力。直接访问 URL 不受这个限制。

## 贡献和许可

欢迎提交带有复现步骤和验证结果的 issue 或 pull request。修改行为时，至少运行生命周期、场景、素材和演示模式相关测试。

项目采用 [MIT License](pixel-office/LICENSE)。原始 Pixel Office 由 [frankshane](https://github.com/frankshane) 创建，本仓库维护 Windows/Codex 版本以及后续的视觉、生命周期和队列改动。
