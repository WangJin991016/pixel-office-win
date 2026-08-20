# Pixel Office · 子智能体办公室

[English](README.md) | 简体中文

在实时像素办公室中查看 Codex 子智能体工作。每个 subagent 都会成为一名
拥有稳定三段式随机外观的员工，并拥有跟随移动的气泡、任务详情抽屉，以及
交付、休息和失败动画。八套固定工位、独立茶水间、分散在左上和右下的休息区，
以及随本地时间变化的窗景让办公室持续运转。

员工外观由 9 套完整头部、9 套上衣和 9 套下部组合而成，共有 729 种有效搭配。
三个部分共用同一套 15 姿势骨架，因此正面、侧面、背面、坐姿和道具动作的
颈部、腰部与脚底锚点保持一致。

![多名 Codex 子智能体正在 Pixel Office 中工作](docs/preview.png)

Pixel Office 是面向 Codex 桌面 app 的社区项目，并非 OpenAI 官方产品。

## 功能对应

| Codex 中发生的事件 | 办公室中的表现 |
| --- | --- |
| `spawn_agent` 启动子智能体 | 新员工从入口进入，走到空闲工位 |
| 子智能体产生输出 | 云朵气泡跟随员工，并显示最新一条消息 |
| 点击员工 | 右侧抽屉显示员工姓名、当前状态、主要任务和完整输出历史 |
| 子智能体完成任务 | 立即释放工位；员工拿文件向 Boss 交付后去休息区或茶水间等候 |
| 已有子智能体接到新任务 | 下班截止前保留原外观，并从等候区直接返岗 |
| 任务失败、暂停或被中断 | 立即释放工位；员工离开工位等候，气泡保持红色 |
| 终态已满 30 分钟 | 员工走向入口、淡出，并从办公室画面中移除 |
| 同时活跃的子智能体超过 8 个 | 多出的员工在入口附近等候；工位释放后自动递补 |

只要还有员工在工作，Boss 就会每隔 20-40 秒显示一句喊话。

## 环境要求

- macOS 或 Windows。仓库自带的一键安装器和常驻服务配置使用 macOS
  `launchd`；Windows 可通过 Codex 本地 marketplace 物化插件，并由插件 MCP
  拉起桥接服务。
- 支持插件的 Codex 桌面 app 和 Codex CLI。
- Node.js 18 或更高版本。
- Python 3，`install.sh` 会用它更新本地 Codex 配置。
- 实时桥接默认使用 `8791` 端口；演示模式可以换用其他端口。

只有重新生成像素美术素材时才需要 Pillow，安装和运行插件不需要它。

## 安装

克隆或下载本仓库，然后运行：

```bash
cd pixel-office
./install.sh
```

安装脚本会在本机执行以下操作：

1. 在同级的 `local-marketplace` 目录中创建名为 `local-dev` 的本地插件市场，
   并让它指向当前源码目录。
2. 在 `~/.codex/config.toml` 中注册该市场，并启用
   `pixel-office@local-dev`。
3. 执行 `codex plugin add pixel-office@local-dev`，把插件物化到 Codex 缓存。
4. 安装 `ai.pixeloffice.bridge` LaunchAgent，使桥接服务登录时启动，并在
   异常退出后自动重启。

如果不希望脚本做上述配置修改，请先阅读 [`install.sh`](install.sh)。如果
不需要常驻 LaunchAgent，可以使用：

```bash
./install.sh --no-daemon
```

安装完成后请新建一个 **Codex 对话线程**，让 app 重新加载插件的 skill 和
MCP server。

## 使用

无需在提示词中提到 Pixel Office。只要 Codex 对话启动了 subagents，插件
就会要求 Codex 确保桥接服务正在运行，并在 app 右侧侧栏打开
`http://localhost:8791/`。桥接服务还会把 Pixel Office 注册到侧栏的
本地服务器列表，作为自动打开失败时的备用入口。

Pixel Office 只观察子智能体，不会自行创建它们。开始一个会使用 Codex
collaboration/subagents 的任务，子智能体启动后，对应员工就会出现。

如果侧栏没有自动打开，可以点击本地服务器列表中的
**Pixel Office · 子智能体办公室**，或者直接访问：

<http://localhost:8791/>

请点击员工，而不是气泡，打开详情抽屉。抽屉会实时更新，并显示该员工的
主要任务和桥接服务观察到的全部输出消息。

## 手动模式与演示模式

桥接服务没有 npm 依赖，也不需要构建步骤。

```bash
# 实时模式：读取 Codex 会话日志并提供办公室页面
node server/server.mjs --port 8791

# 演示模式：无需 Codex 任务，循环运行预设员工脚本
node server/server.mjs --demo --port 8792

# 回放一个根 rollout，并自动发现和合并它的子智能体 rollout
node server/server.mjs --replay /path/to/rollout.jsonl --speed 20
```

演示页面地址是 <http://localhost:8792/>。检查实时桥接是否已经运行：

```bash
curl http://localhost:8791/api/state
```

## 架构

```text
~/.codex/sessions/**/rollout-*.jsonl
        |
        | 增量、只读轮询
        v
server/server.mjs
        | 解析 collaboration 事件和子智能体生命周期
        | 提供状态快照 JSON 和 Server-Sent Events
        v
public/
        | Canvas 2D 场景、动画状态机、气泡和详情抽屉
        v
Codex 右侧侧栏或普通浏览器
```

- 桥接服务只使用 Node.js 标准库。
- 前端使用原生 HTML、CSS、JavaScript 和 Canvas 2D。
- 更新粒度是 rollout 中写入的一整条消息，并非逐 token 流式更新。
- 桥接服务会读取 Codex rollout，但不会写入 `~/.codex`。

事件格式、状态机、渲染架构、安装原理、美术管线和回归检查清单详见
[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)。

## 数据与安全

Pixel Office 会读取 `~/.codex/sessions` 中近期的 `rollout-*.jsonl` 文件。
这些文件可能包含任务提示词和子智能体输出。桥接服务通过 `/api/state` 和
`/events` 提供这些内容，且没有身份验证，因此应把 `8791` 端口视为敏感
端口。

`0.3.0+codex.20260820` 默认把桥接服务绑定到 `127.0.0.1`。本地接口仍未
设置身份验证，并可能包含任务文本与子智能体输出，因此请勿端口转发或暴露
到互联网。

桥接服务不会主动发起外部网络请求。安装脚本会写入“安装”一节中列出的本地
marketplace 和 Codex 配置；运行中的桥接服务还会尽力更新 Codex 侧栏的
本地服务器注册文件。

新版 Codex 可能会加密 rollout 中传给 `spawn_agent` 的 `message` 参数。
遇到这种情况时，Pixel Office 无法显示完整原始提示词，会退回使用
`task_name` 作为主要任务。

## 项目结构

```text
pixel-office/
├── .codex-plugin/plugin.json       Codex 插件清单
├── .mcp.json                       MCP server 注册
├── skills/pixel-office/            隐式触发和自动打开侧栏的行为说明
├── server/server.mjs               Rollout 解析、状态桥接、SSE 和静态服务
├── server/mcp.mjs                  MCP 状态工具与桥接服务拉起逻辑
├── public/                         Canvas 办公室、抽屉 UI 和生成的 PNG 素材
├── tools/                          基于 Pillow 的像素美术生成脚本
├── docs/DEVELOPMENT.md             架构与开发记录
└── install.sh                      本地 marketplace 与 macOS 安装器
```

## 开发

修改前端时，可在单独端口运行固定剧本演示：

```bash
node server/server.mjs --demo --port 8792
```

修改插件源码后，更新 Codex 缓存并重启桥接：

```bash
./install.sh
launchctl kickstart -k "gui/$(id -u)/ai.pixeloffice.bridge"
```

只有修改美术管线时，才需要重新生成仓库中已经提交的 PNG：

```bash
python3 -m pip install Pillow
cd tools
python3 draw_workers.py
python3 draw_furniture.py
python3 make_props.py
```

提交 PR 前，请结合演示模式和真实/回放的子智能体会话检查：员工点击区域、
输出历史更新、气泡锚点、工位递补、交付顺序、休息区/茶水间分流、召回、
失败红气泡和下班移除。实时模式严格等待 30 分钟；演示模式使用 30 秒，回放
模式则按回放倍速缩放等待时间。

## 当前限制

- 自动安装和登录常驻目前仅针对 macOS；Windows 使用现有 Codex 本地
  marketplace。
- 实时模式只跟踪最新的一棵 Codex 根会话树，暂不支持同时展示多个会话。
- 气泡按完整日志消息更新，并非逐 token 更新。
- 如果子智能体进程直接消失，且 rollout 中没有失败、中断或完成事件，由于
  当前没有无活动超时机制，它可能一直显示为工作中。
- 自动打开侧栏依赖 Codex 宿主能力；本地服务器入口和直接 URL 可作为备用。

## 常见问题

**办公室打开了，但没有员工**

实时模式只显示最新的 Codex 会话树，而且该线程必须真的启动 subagents。
可以先用演示模式独立确认 UI 是否正常。

**8791 端口已被占用**

```bash
curl http://localhost:8791/api/state
lsof -nP -iTCP:8791 -sTCP:LISTEN
```

如果第一条命令返回 Pixel Office 状态，已有进程就是预期的桥接服务，无需
再启动第二个。

**安装后的插件没有反映源码修改**

重新运行 `./install.sh`，然后新建一个 Codex 对话线程。Codex 会把插件物化
到缓存中，修改本仓库不会自动更新已经加载的对话。

**任务抽屉里只有一个简短任务名**

本地 rollout 中完整的 `spawn_agent.message` 可能已经加密。Pixel Office
会使用 `task_name` 作为可靠的回退信息。

**LaunchAgent 启动失败**

查看 `/tmp/pixel-office.log`，然后确认 shell 中可以执行 `node`，且 `8791`
端口没有被其他程序占用。

## 卸载

移除已物化的插件，并停止常驻桥接服务：

```bash
codex plugin remove pixel-office@local-dev
launchctl bootout "gui/$(id -u)/ai.pixeloffice.bridge"
rm "$HOME/Library/LaunchAgents/ai.pixeloffice.bridge.plist"
```

如果不再使用该 marketplace，再从 `~/.codex/config.toml` 中删除
`[marketplaces.local-dev]` 和 `[plugins."pixel-office@local-dev"]` 两个配置
段。安装器还会创建同级的 `local-marketplace` 目录；确认其中没有其他仍需
使用的插件后再删除。

## 参与贡献

欢迎提交 issue 和范围清晰的 pull request。修改运行行为时，请附上简短的
复现方式，并同时验证演示模式以及真实或回放的子智能体会话。修改生成素材时，
请同步提交对应的生成脚本。

## 许可证

本项目采用 [MIT License](LICENSE)。
