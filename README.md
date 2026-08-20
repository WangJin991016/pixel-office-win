# Pixel Office for Windows

> 把 Codex 子代理的实时工作状态变成一间会走动、交付、休息和下班的像素办公室。

**当前版本：** `0.3.2+codex.20260820`

**支持平台：** Windows 10 / Windows 11

**项目定位：** Codex Desktop 社区插件

![Pixel Office for Windows](pixel-office/docs/preview.png)

## 主要功能

- 实时读取当前 Codex 任务树中的 subagent 生命周期和完整消息。
- 8 个固定工位，每张桌子都有独立的电脑画面和桌面配置。
- 角色由 9 套头部、9 套上衣和 9 套下部自由组合，共 729 种稳定外观。
- 15 套统一姿势覆盖正面、侧面、背面、坐姿、走路、文件、咖啡和手提箱动作。
- 完成任务后立即释放工位，向 Boss 交付文件，再前往休息区或茶水间。
- 失败任务同样立即释放工位，并在等候期间显示红色气泡。
- 完成或失败满 30 分钟后，员工走向入口、淡出并从画面移除。
- 截止前被召回时保留外观并直接返岗；下班后再次工作会以新班次重新入场。
- 超过 8 名活跃代理时，额外员工使用不重叠的入口队列；空出工位后自动递补。
- 大量代理同时交付时，队列会向左右平行扩展，不会堆叠在同一坐标。
- 窗外景色按照浏览器本地时间切换清晨、上午、中午、下午、傍晚和夜晚。
- 点击员工可以查看任务、当前状态以及完整输出历史。

Pixel Office 只观察已经由 Codex 创建的子代理，不会自行启动或控制代理。

## 环境要求

- Windows 10 或 Windows 11。
- 支持插件的 Codex Desktop 与 Codex CLI。
- Node.js 18 或更高版本。
- Git，用于让 Codex 获取 GitHub marketplace。
- 本机端口 `8791` 可用。

正常安装和运行不需要 npm 依赖、Python 或 Pillow。只有重新生成像素素材时才需要 Python 与 Pillow。

本项目只面向 Windows 维护和测试，不提供 macOS 或 Linux 安装支持。

## 从 GitHub 安装

在 PowerShell 中运行：

```powershell
codex plugin marketplace add WangJin991016/pixel-office-win --ref main
codex plugin add pixel-office@pixel-office-win
```

随后完全关闭并重新打开 Codex Desktop，再新建一个任务，使插件的 skill 与 MCP server 重新加载。

检查 marketplace 和插件是否已经识别：

```powershell
codex plugin marketplace list
codex plugin list
```

如果你设置了自定义 `CODEX_HOME`，请确保 PowerShell 与 Codex Desktop 使用同一个环境配置。

## 使用方法

无需在提示词中专门提到 Pixel Office。只要当前 Codex 任务启动了 subagents，插件就会：

1. 通过 MCP 确保本地桥接服务已经运行。
2. 读取当前 `CODEX_HOME\sessions` 下最新任务树的 rollout 日志。
3. 在 `http://127.0.0.1:8791/` 提供办公室页面。
4. 请求 Codex Desktop 在右侧浏览器区域打开该页面。

如果右侧页面没有自动出现，直接在浏览器中打开：

<http://127.0.0.1:8791/>

检查桥接状态：

```powershell
Invoke-RestMethod http://127.0.0.1:8791/api/state
```

## 生命周期

```text
进入办公室
  ├─ 有空位 → 入座工作
  └─ 无空位 → 在入口唯一位置等候 → 自动递补

工作
  ├─ 完成 → 立即释放工位 → 排队交付 → 休息区或茶水间
  └─ 失败 → 立即释放工位 → 红色气泡 → 休息区或茶水间

终态等候
  ├─ 30 分钟内召回 → 保留外观并返岗
  └─ 满 30 分钟 → 走向入口 → 淡出 → 从画面移除
```

实时模式严格等待 30 分钟。演示模式使用 30 秒，回放模式会按照回放倍速缩放等待时间。

## 手动运行与演示

克隆仓库：

```powershell
git clone https://github.com/WangJin991016/pixel-office-win.git
Set-Location .\pixel-office-win\pixel-office
```

启动实时模式：

```powershell
node .\server\server.mjs --host 127.0.0.1 --port 8791
```

启动循环演示：

```powershell
node .\server\server.mjs --demo --host 127.0.0.1 --port 8792
```

回放一棵历史任务树：

```powershell
node .\server\server.mjs --replay "A:\path\to\rollout.jsonl" --speed 20
```

读取其他会话目录：

```powershell
node .\server\server.mjs --sessions-dir "A:\path\to\sessions" --port 8791
```

实时页面默认是 <http://127.0.0.1:8791/>，演示页面默认是 <http://127.0.0.1:8792/>。

## 更新

```powershell
codex plugin marketplace upgrade pixel-office-win
codex plugin add pixel-office@pixel-office-win
```

更新后重新启动 Codex Desktop，并新建一个任务。Codex 会把插件版本物化到本地缓存，因此只更新 Git 仓库不会改变已经加载的旧任务。

## 卸载

```powershell
codex plugin remove pixel-office@pixel-office-win
codex plugin marketplace remove pixel-office-win
```

如果你曾经手动启动桥接服务，可以在任务管理器中结束对应的 `node.exe`，或者在启动它的 PowerShell 窗口中按 `Ctrl+C`。

## 数据与安全

Pixel Office 需要读取 Codex rollout 日志才能展示代理名称、任务文本和输出：

```text
%CODEX_HOME%\sessions\**\rollout-*.jsonl
```

未设置 `CODEX_HOME` 时，服务会退回使用 `%USERPROFILE%\.codex\sessions`。

- 桥接服务只读会话日志，不会修改 rollout 文件。
- 默认只绑定 `127.0.0.1`。
- `/api/state` 和 `/events` 没有身份验证，可能包含任务提示词和代理输出。
- 不要把 `8791` 端口转发到局域网或互联网。
- 服务本身不会主动向外部网络发送会话内容。
- 新版 Codex 可能加密 `spawn_agent.message`；此时主任务文本会退回显示 `task_name`。

## 技术结构

```text
Codex rollout JSONL（只读）
          │
          ▼
pixel-office/server/server.mjs
  ├─ 解析任务树与代理生命周期
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

运行时只使用 Node.js 标准库，前端没有框架，也没有构建步骤。

## 项目目录

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

## 开发与测试

```powershell
Set-Location .\pixel-office

node --test `
  .\tests\server-appearance-03.test.mjs `
  .\tests\client-lifecycle-02.test.cjs

node .\tests\scene-render-02.test.cjs
py -3 .\tests\assets-02.test.py
```

浏览器回归测试需要单独提供 Playwright 模块和可用的 Chromium/Edge 路径。建议先在 `8792` 启动演示服务，再运行 `tests/browser-render-03.test.cjs`。

仅在修改素材生成器时安装 Pillow 并重建图片：

```powershell
py -3 -m pip install Pillow
Set-Location .\tools
py -3 .\draw_workers.py
py -3 .\draw_furniture.py
py -3 .\make_props.py
```

生成器会检查三段式图集、729 种组合、15 个姿势、8 套工位、6 张窗景和 Boss 素材稳定性。详细架构和回归清单见 [开发文档](pixel-office/docs/DEVELOPMENT.md)。

## 当前限制

- 只跟踪最新的一棵 Codex 根任务树，不会同时展示多个任务。
- 气泡按照 rollout 中写入的完整消息更新，不是逐 token 流式。
- 如果代理进程消失且没有留下完成、失败或中断事件，它可能继续显示为工作中。
- 自动打开右侧页面依赖 Codex Desktop 的宿主能力；直接 URL 始终可用。

## 贡献与许可

欢迎提交带有复现步骤和验证结果的 issue 或 pull request。行为修改至少应验证生命周期测试、场景测试、素材测试以及演示模式。

项目采用 [MIT License](pixel-office/LICENSE)。原始 Pixel Office 由 [frankshane](https://github.com/frankshane) 创建；本仓库维护 Windows/Codex 版本及后续视觉、生命周期与队列改进。
