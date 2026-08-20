# Pixel Office · 开发过程与架构交接文档

> 版本：0.3.0+codex.20260820 · 最后更新：2026-08-20
> 读者：接手本插件开发/维护的工程师
> 配套阅读：[README.md](../README.md)（用户视角的安装与使用）

---

## 0. 一句话概述

pixel-office 是一个 Codex 桌面 app 插件：实时监听本机 Codex 会话日志中的
subagent（子智能体）活动，驱动一个星露谷风格的像素办公室网页——每个子智能体
是一名具有稳定随机外观的员工，工作时占用八张固定工位之一，完成后立即让出
工位、向“老板”（orchestrator）交付，并在休息区或茶水间等待；终态满
30 分钟后走到入口淡出并从画面移除。

**全部依赖：Node.js（标准库）+ Pillow（仅美术生成时用）。零 npm 依赖、零构建步骤。**

![预览](preview.png)

---

## 1. 需求定稿记录（产品决策溯源）

首期需求通过三轮结构化拷问（grill-me）定稿，关键拍板如下，后续改动请不要
无意推翻：

| 决策点 | 定稿 | 备注 |
|---|---|---|
| 数据源 | 监听 `~/.codex/sessions` 日志文件 | 官方无正式事件推送 API；日志已验证包含全部所需事件 |
| 预览形态 | 插件内嵌 localhost 服务器，Codex app 浏览器侧边栏预览 | 内联 visualize 受 CSP 限制（禁 WebSocket/fetch），做不了实时 |
| 技术栈 | Node.js 零依赖（`node:http` + SSE） | 不用 ws 库，避免 npm install |
| 交付形态 | 正规插件（marketplace 注册安装） | `codex plugin list` 可见 |
| 美术 | ~~抠图~~ → **代码手绘**（第二迭代用户要求重绘） | 抠图存在遮挡/残缺问题，已废弃 |
| 工位 | 8 桌 2×4，各自固定一套电脑画面和桌面配置；超员在门口排队 | 空桌仍绘制固定配置 |
| 气泡 | 跟随员工、滚动最新 3 行、中文自动换行、绝不越界 | 硬约束 |
| 完成后 | 立即释放工位 → 交付 → 休息区/茶水间；30 分钟后下班离场 | 实时模式使用绝对时间 |
| 失败表现 | 立即释放工位 → 离岗等候 + 红气泡；30 分钟后同样下班 | 不再趴桌或扔文件 |
| 召回 | 截止前保留外观并现场返岗；截止后按新一轮从入口进入并重抽外观 | 旧轮终态不得覆盖新轮 |
| 外观 | 完整头部、上衣、下部各 9 套，共 729 种组合；按会话、线程、外观代次和部分稳定抽取 | Boss 不参与随机化 |
| 窗景 | 浏览器本地时间 6 阶段，最后 10 分钟交叉淡化 | 减少动态效果时直接切换 |
| 老板喊话 | 20–40s 随机，四句话轮换不重复，方形气泡，仅有人工作时 | 与员工云朵气泡物理隔离 |
| 音效 | 不要 | |
| 插件名 | pixel-office | |

老板喊话四句话（顺序轮换池，随机抽取且一轮不重复）：
「你不干有的是智能体干」「快点，要是不会让AI干啊」「我们要提质增效」
「干完这个任务，提升你为部门经理！」

---

## 2. 总体架构

```
┌─────────────────────────────┐
│ Codex app / CLI 会话          │
│  spawn_agent / subagent 活动  │
└───────────┬─────────────────┘
            │ 写日志（JSONL append）
            ▼
~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl     （只读数据源）
            │  700ms 轮询增量 tail（字节偏移）
            ▼
┌──────────────────────────────────────────────┐
│ server/server.mjs  （零依赖 Node 桥接服务器）    │
│  · 会话索引（session_meta 首行解析）             │
│  · 根会话/子线程识别与状态机                     │
│  · 静态文件服务（public/）                      │
│  · SSE 推送 /events，快照 /api/state            │
│  · 启动时自注册 app 侧边栏条目                   │
└───────────┬──────────────────────────────────┘
            │ text/event-stream
            ▼
┌──────────────────────────────────────────────┐
│ public/  像素办公室网页（Canvas 2D，无框架）      │
│  scene(静态层) → entities(y排序) → bubbles(顶层) │
└──────────────────────────────────────────────┘

常驻/拉起机制（自动触发，见 §7）：
  launchd LaunchAgent（常驻） + 插件 MCP（会话拉起） + skill（对话内露出）
```

设计原则：**桥接只读**（从不写 `~/.codex`）、**前端无状态**（刷新页面通过
snapshot 重建全部状态，可承受任意时序乱序到达）。

---

## 3. 数据源：Codex 会话日志格式（关键逆向成果）

这是整个项目最重要的接口知识，全部经过真机验证。

### 3.1 文件布局

```
~/.codex/sessions/YYYY/MM/DD/rollout-<ISO时间>-<线程UUID>.jsonl
```

每行一个 JSON 记录，顶层结构：`{timestamp, type, payload}`。
**注意 `type` 的位置有两层**：`session_meta`/`response_item`/`event_msg` 在
记录顶层；事件的具体类型（如 `sub_agent_activity`）在 `payload.type`。

### 3.2 根会话文件里的关键记录

| 记录 | 位置 | 内容 |
|---|---|---|
| 会话元信息 | `rec.type === "session_meta"` | `payload.session_id`（= 根线程 id）、`payload.cwd`、`cli_version`、`originator` |
| 创建子智能体 | `rec.type === "response_item"` 且 `payload.type === "function_call"`，`payload.name === "spawn_agent"`，`namespace === "collaboration"` | `arguments` JSON 里有 `task_name`（另有加密 payload，可忽略） |
| 子智能体活动 | `payload.type === "sub_agent_activity"` | `agent_thread_id`、`agent_path`（如 `/root/visual_qa`，末段即任务名）、`kind`（实测见过 `started` / `interacted` / `browserUse`；代码对 `complete/closed/error` 等做正则兜底） |
| 根回合结束 | `payload.type === "task_complete"`（event_msg） | 表示主线程一轮结束（不等于整个会话结束） |

### 3.3 子智能体线程文件（每个 subagent 一个文件）

首行 `session_meta` 的字段**与直觉相反**：

```jsonc
{
  "type": "session_meta",
  "payload": {
    "session_id": "01a00af7-...",        // ← 父会话（根线程）id！
    "id": "01a00b26-...",                // ← 才是该子线程自己的 id
    "thread_source": "subagent",
    "source": { "subagent": { "thread_spawn": {
        "parent_thread_id": "01a00af7-...",
        "agent_path": "/root/visual_qa",
        "agent_nickname": "Pasteur",     // Codex 分配的昵称
        "depth": 1 } } }
  }
}
```

**三个必须记住的坑：**

1. **身份字段**：索引子线程文件必须用 `payload.id`（自身），不能用
   `session_id`（父会话）。用错会导致把子线程行路由给根会话。
2. **fork 上下文污染**：`fork_turns:"all"` 时，子线程文件开头包含父会话
   的完整上下文拷贝（保留原始旧时间戳）。若不过滤，员工气泡会播放父会话
   的历史消息。**过滤规则：丢弃 `timestamp < 子线程 meta 时间戳 - 2s` 的记录**
   （代码中称为 `bornAt` 过滤）。
3. **UUID 前缀冲突**：线程 UUID 是时间序（v7 风格），同批 spawn 的线程
   **前 8 位完全相同**。内部短 id 必须取尾部：
   `"ag-" + uuid.replace(/-/g,"").slice(-8)`。（真实事故：theory/methods/
   standards 三员工互相覆盖只剩一人。）

### 3.4 子线程文件内的输出记录

| 记录 | 说明 |
|---|---|
| `response_item/message`（role=assistant） | 子智能体的消息（`content[].text`，`phase` 区分 commentary/final_answer） |
| `event_msg/agent_message` | 同上内容的另一通道，两者都接 |
| `event_msg/task_complete` | 子任务完成；`last_agent_message` = 交付总结（映射为"走到老板前交付"动画） |

文本以**整条消息**为粒度落盘（非逐 token），所以气泡是"消息级流式"，
轮询延迟 ≤1s 内体感接近实时。

---

## 4. 桥接服务器 `server/server.mjs`（631 行，零依赖）

### 4.1 运行模式

```bash
node server.mjs [--port 8791]                      # 实时（默认）
node server.mjs --demo --port 8792                 # 演示：5 名剧本员工循环
node server.mjs --replay <rollout.jsonl> --speed N # 回放历史会话（测试主用）
node server.mjs --sessions-dir <dir>               # 自定义日志目录
```

### 4.2 实时模式内部机制

1. **会话索引**（每 5s 重建，`rebuildIndex`）：扫描最近 4 天的 rollout 文件，
   只读**首行**（注意：首行可能 >8KB，读取缓冲给足 256KB）解析 session_meta，
   建立 `ownId → {file, isSub, parent, agentPath, nick, bornAt, mtime}`。
   按 mtime 跳过未变文件。
2. **根会话选择**：最新 mtime 的非 subagent 文件。切换根会话时向前端广播
   `reset` 并清空员工表。
3. **增量 tail**：`fileOffsets` 记录每文件已读字节数，700ms 轮询读增量，
   按行解析。处理文件截断（size < offset 时归零重读）。
4. **子agent发现**：索引中 `isSub && parent 属于当前会话树`（支持 depth≥2
   的嵌套：parent 是已知子线程也算）→ `discoverSubagent` 建档 + tail 其文件
   （带 bornAt 过滤）。
5. **状态机**（服务端记录事实时间，动画状态机在客户端）：
   `working / completed / failed`；`interacted` → 视为召回（recalled）。每轮
   记录 `workStartedAt`，终态记录 `terminalAt` 与绝对的 `leaveAt`，迟于新一轮
   开始时间的旧轮终态才可生效。
6. **外观代次**：`appearanceVersion: 3`、`appearanceGeneration` 和
   `appearance: {head, upper, lower}` 随 snapshot/SSE 下发。三个外观索引均为
   `0..8`，由 `appearance-v3|session|thread|generation|part` 做 SHA-256 后
   `%9`，同一轮刷新不变。客户端在读取边界把 V2 确定性转换为 V3；同代 V3
   可以覆盖 V2，但收到 V3 后拒绝旧 V2 回退。

### 4.3 对外接口

| 端点 | 说明 |
|---|---|
| `GET /` | 办公室页面（public/index.html） |
| `GET /assets/*` `/css/*` `/js/*` | 静态资源（路径穿越已防护） |
| `GET /api/state` | JSON 快照：`{agents:[{id,name,state,text,task,history,workStartedAt,terminalAt,leaveAt,appearanceVersion,appearanceGeneration,appearance}], sessionActive, sessionLabel, demo}` |
| `GET /events` | **SSE 流**。连接即发 `snapshot`，随后增量事件 |

SSE 事件类型（`data: {"type":..., "seq":N}`）：

| type | 载荷 | 客户端行为 |
|---|---|---|
| `snapshot` | 同 /api/state | 全量重建（幂等） |
| `spawn` | agent 快照字段 | 新员工从门口走入并记录主要任务与外观 |
| `task` | `{id, task}` | 补充/更新员工的主要任务 |
| `progress` | `{id, text}` | 追加一条完整工作进展（双通道近时重复会去重） |
| `output` | `{id, text}` | 更新气泡文本（服务端 450ms 节流，文本截断 2400 字） |
| `state` | `{id, state, summary?, terminalAt?, leaveAt?, appearance*?}` | `completed`→交付后等候；`recalled`→召回；`failed`→红气泡离岗等候 |
| `session` | `{active}` | 顶部状态 pill |
| `reset` | — | 清场（根会话切换） |

### 4.4 演示与回放

- `--demo`：剧本化时间线（5 个角色、错峰 spawn、流式文本、完成/失败/召回
  全覆盖），终态等候 30 秒后离场，每轮结束 reset 循环。用于无真实会话时
  验收视觉效果。
- `--replay`：把根文件+全部子线程文件按时间戳归并单趟播放；>120s 的空档
  压缩为 1.2s，终态的 30 分钟等候按 `--speed` 同比例缩放。新版日志把
  `spawn_agent` 包在统一工具运行器中时，回放会按子线程 `session_meta` 的出生
  时间合成入场事实，再由真实子线程事件更新状态。它是回归测试“数据解析→动画
  状态机”链路的最佳手段。

实时模式不使用 30 分钟 `setTimeout`：客户端始终比较 `Date.now()` 与服务端
给出的绝对 `leaveAt`，从而保证后台休眠、刷新和 SSE 重连不会重置倒计时。
旧格式 snapshot 中没有 `leaveAt` 的终态员工按已下班处理，不再恢复到画面。

### 4.5 侧边栏自注册

启动时（best-effort，try/catch 包裹绝不影响主流程）向
`~/Library/Application Support/Codex*/browser-sidebar-local-servers.json`
写入/刷新本服务条目（url/title/预览 SVG data-url），使办公室出现在 Codex
app 浏览器侧边栏的本地服务器列表。

---

## 5. 插件 MCP 服务器 `server/mcp.mjs`（165 行，零依赖）

存在的意义：**自动拉起 + 会话内状态查询**。Codex 在插件声明 `mcpServers`
后会自动启动它。

- 手写最小 MCP stdio 协议（NDJSON JSON-RPC）：`initialize` /
  `notifications/initialized` / `ping` / `tools/list` / `tools/call`。
- 工具：
  - `pixel_office_status`：确保桥接在运行（不在则 detached spawn，轮询直至
    绑定端口），返回 URL + 当前员工状态。Codex 侧用它来主动贴链接。
  - `pixel_office_demo`：返回演示模式启动方法。
- 启动时即 `ensureBridge()` 预热。
- `.mcp.json` 的写法参照官方 `codex-app-tools`：`command` 指向
  `scripts/launch_pixel_office_mcp`（一个 shell 脚本，负责在最小 PATH 环境
  下找到 node——MCP 宿主环境的 PATH 可能没有 node！），`cwd: "."`，
  args 用相对路径。

冒烟测试：

```bash
( echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}'
  echo '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
  sleep 2 ) | node server/mcp.mjs
```

---

## 6. 前端 `public/`（Canvas 2D，无框架，共 1164 行）

### 6.1 分层与渲染

- 逻辑分辨率 1280×720，`image-rendering: pixelated` + 
  `imageSmoothingEnabled=false` 保证像素锐利。
- 每帧顺序：静态层（scene.js 离屏 canvas，仅构建一次）→ Boss →
  实体数组按脚底 y 排序绘制（正确遮挡）→ 气泡层（永远最上）。
- 资源清单与全部布局坐标集中在 `sprites.js`（`MANIFEST` + `LAYOUT`），
  改布局只动这一个文件。

### 6.2 员工状态机（actors.js `Worker`）

```
spawning(入口走入) → working(坐椅打字 bob)
  → completed事件 → 立即释放工位 → delivering(排队→交付→老板点头)
  → waiting(休息区/茶水间)
  ─ failed事件 → 立即释放工位 → waiting(红气泡)
  ─ 截止前 recalled事件 → recalled(从当前位置返岗) → working
  ─ leaveAt到期 → clockout_walk → clockout_fade → offstage(从集合移除)
  ─ 离场后新工作 → 新外观代次，从入口重新 spawning
```

要点：

- **寻路**：到工位使用中央过道；离开工位则按等候位编号分配独立通道。
  左上路线从桌间安全过道上行，茶水间路线沿右边缘到入口后水平入门；固定与
  溢出路线都不得穿桌。正面、背面和侧面走路均为两帧交替。
- **交付队列**：`deliveryQueue` + `queueSlots[8]`，多人完成时在过道排队，
  只有队首交付。
- **等候位分配**：休息区 6 位（左上 3 位、右下 3 位）+ 茶水间 6 位，按
  `agent id + terminalAt` 稳定分流并优先取空位；12 位满后继续在左上/右下
  交错使用溢出位，绝不回占工位或堵住茶水间入口。
  召回或离场时必须释放位置。
- **工位递补**：完成/失败一收到即释放 desk，并立即把入口队列中的下一人
  促进到空位；物理工位永久绑定 `deskVariant 0..7`，不因员工或刷新重排。
- **离场清理**：`offstage` 后从可见员工集合、交付队列、等候位、点击区域和
  当前详情抽屉中同步清除；顶栏人数只统计仍在动画中的员工。
- **气泡跟随员工当前 sprite**：锚点由当前姿态的底部坐标和精灵高度计算，
  员工走动、失败或休息时不会把气泡遗留在电脑/工位。交付/走向休息区途中
  仍沿用原规则隐藏云朵（拿文件的姿态本身在讲故事）。

### 6.3 气泡引擎（bubbles.js）——"文字绝不越界"的实现

- 云形 = 圆角矩形 + 顶部三圆 + 尾部渐小圆点，**两遍填充法**（外扩 3px 的
  描边色剪影 + 正常填充）——杜绝 Path2D 描边时内部接缝线。
- 换行：`wrapText()` 按 token 切分（CJK 逐字 / 拉丁按词带尾随空格），
  逐 token `measureText` 探测，超宽 token 硬断行。
- 裁剪：`ctx.clip(cloudPath)`，文字绘制被严格限制在云形内部；
  文案框再内缩 padX/padY。
- 滚动：最多 3 行可视，超出后每 1.5s 向上滚一行（带缓动），可见末行
  有下续时加"…"。失败态气泡换红底红边（mood="error"）。
- 老板喊话气泡：方形 + 锯齿尾巴，尾部贴近老板头部且与员工气泡分区；
  20–40s 随机、四句话池抽完重置；仅在有员工工作时触发。
- 点击员工 → 右侧抽屉显示名字、状态、主要任务和按时间排序的全部输出历史
  （DOM 面板，不在 canvas 里排字；新输出到达时实时追加）。

### 6.4 调试钩子

`window.__officeDebug()`（main.js 注册）：返回每个可见员工的
name/state/x/y/waypoints/queue/zzz/visible，以及 `appearance`、`leaveAt`、
`waitArea`、`deskVariant`；顶层还返回当前 `windowPhase`。配合
Playwright/Safari/Edge 远程调试截图断言使用。

---

## 7. 自动触发（"启用 subagents 即自动出现"）的四层机制

| 层 | 组件 | 说明 |
|---|---|---|
| 1 常驻 | `~/Library/LaunchAgents/ai.pixeloffice.bridge.plist` | RunAtLoad + KeepAlive；install.sh 安装，`--no-daemon` 跳过。日志 `/tmp/pixel-office.log`。**这是用户明确批准过的系统级常驻**，卸载：`launchctl bootout gui/$(id -u)/ai.pixeloffice.bridge` |
| 2 会话拉起 | `.mcp.json` + `server/mcp.mjs` | Codex 会话启动插件 MCP → 预热桥接 |
| 3 对话露出 | `skills/pixel-office/SKILL.md` | description 覆盖 subagents 触发词（implicit invocation），正文要求 Codex 检测到 subagent 任务时**无需用户开口**主动调 `pixel_office_status` 并贴链接 |
| 4 入口可见 | server.mjs 的 `registerSidebar()` | app 侧边栏自动出现 Pixel Office 条目 |

---

## 8. 插件打包与安装机制

### 8.1 目录结构（Codex 插件规范，参照官方 visualize/codex-app-tools）

```
pixel-office/
├── .codex-plugin/plugin.json    # 清单：name/version/skills/mcpServers/interface...
├── .mcp.json                    # MCP 注册（launcher 脚本 + cwd + 相对 args）
├── skills/pixel-office/
│   ├── SKILL.md                 # 触发描述 + 主动行为指令
│   └── agents/openai.yaml       # interface 显示名 + allow_implicit_invocation
├── server/  public/  tools/  scripts/  docs/  install.sh  README.md
```

### 8.2 安装链路（install.sh 已封装，幂等）

1. 生成**本地 marketplace**：`../local-marketplace/.agents/plugins/marketplace.json`
   （格式：`{name, interface, plugins:[{name, source:{source:"local",path}, policy, category}]}`），
   `plugins/pixel-office` 软链回项目。
2. `~/.codex/config.toml` 追加：
   `[marketplaces.local-dev] source_type="local" source="..."` +
   `[plugins."pixel-office@local-dev"] enabled=true`。
3. `codex plugin add pixel-office@local-dev` → 按清单版本物化到
   `~/.codex/plugins/cache/local-dev/pixel-office/0.3.0+codex.20260820/`。
4. 安装 launchd 守护。

**关键坑：插件缓存必须是实体目录**。若把缓存换成软链，`codex plugin list`
会显示 "not installed"。因此开发迭代后必须重跑 `install.sh`（即重新 add）
把改动同步进缓存。`codex plugin remove` 只删缓存不删源码（已验证）。

### 8.3 曾修复的环境存量问题

用户 config.toml 的 marketplace source 带 Windows UNC 前缀
（`'\\?\/Users/...'`）导致 `codex plugin list` 整体报错。已改为正常路径，
备份：`~/.codex/config.toml.bak-pixeloffice`。若日后再现，先怀疑这个。

---

## 9. 美术管线（tools/）

第二迭代起**全部代码手绘**（抠图方案已废弃，原因：边缘残缺、遮挡错乱、
boss 无站姿可用）。

- `pixel_art.py`：`Grid` 栅格类（set/rect/hline/vline/disc/ring/line/paste/
  flip/shift）+ 全局调色板 `C` + `autoline()`（自动给剪影包 1px 深色描边）。
  小网格作画，保存时 NEAREST 放大 ×4。
- `worker_parts.py`：共享的 15 姿势骨架和 V3 直接绘制器。生成
  `worker_part_head.png`、`worker_part_upper.png`、`worker_part_lower.png`
  三张 `936×2880` 图集（9 列设计 × 15 行姿势，每格 `104×192`），以及包含
  全部姿势的完整 `worker_fallback.png`。固定渲染顺序是 lower → upper → head；
  头部整套拥有脸、发型、配饰、颈和裸露手部肤色，上衣拥有袖子和动作道具，
  下部拥有完整长裤和鞋。三部分共用颈、腰和脚底锚点。`upper_front` /
  `upper_back` 是桌后裁切姿势：下部单元有意透明，由上衣单元延伸到统一底锚；
  其余 13 个姿势的下部均为完整长裤和鞋。
- `draw_workers.py`：入口脚本；默认调用 V3 直接绘制器。旧 V2 RGB 拆层辅助函数
  只为复现保留的回退素材，不进入运行时资源清单。
- `draw_furniture.py`：除原办公家具外，生成 6 张窗景、固定编号的 8 张
  `448×280` 工位图，以及茶水间后景/前景。Boss 三件套不参与重绘，哈希是
  生成器回归测试的一部分。
- `make_props.py`：绿植×2/空调/复印机/躺椅/挂钟/饮水机（ImageDraw 硬边图形
  + 抖动噪点）。
- 重建：`cd tools && python3 draw_workers.py && python3 draw_furniture.py && python3 make_props.py`
  产物直接落在 `public/assets/`；运行时仍为零依赖。
- 新增 sprite 后记得同步 `public/js/sprites.js` 的 MANIFEST 显示宽度。

参考形象（用户提供）：worker.jpeg（员工）、boss.jpeg（老板）、desk.jpeg
（工位桌），位于仓库上级目录，仅作设计参考，不再参与构建。

---

## 10. 开发与测试工作流

```bash
# 改代码后
./install.sh                                  # 同步进 Codex 插件缓存
launchctl kickstart -k gui/$(id -u)/ai.pixeloffice.bridge   # 重启桥接

# 视觉/行为回归
node server/server.mjs --demo --port 8792     # 剧本员工
node server/server.mjs --replay ~/.codex/sessions/2026/08/16/rollout-....jsonl --speed 60
# 用 Playwright MCP 打开 http://localhost:8792/ 截图 + __officeDebug() 断言
```

建议的断言点：全员到齐（可见 agents 数）、工位固定配置和递补、气泡不越界
（截图）、交付队列、12 个等候位不重叠、茶水间前景遮挡、失败红气泡、
截止前/后召回、`29:59`/`30:00` 生命周期边界、6 个窗景边界及 10 分钟渐变。
生成器测试还应组合全部 `729×15=10,935` 个角色姿势，并断言三部分各 9 套、
15 个姿势、透明断层/裁切、颈腰接缝、脚底锚点、脸手肤色一致、A/B 走路帧差异、
完整 fallback、8 张工位、6 张窗景齐全，以及 Boss 素材哈希不变。

---

## 11. 踩坑记录（血泪史，请勿重蹈）

1. **`.mjs` 即 ESM**：`require is not defined`——桥接第一崩。
2. **首行缓冲 8KB 不够**：session_meta 单行 31KB，子线程发现率 0 → 改 256KB。
3. **`session_meta.type` 在记录顶层**而非 payload 内，索引全空。
4. **子线程 `session_id` 是父会话**，自身 id 在 `id` 字段。
5. **fork 上下文污染**：子线程文件开头是父会话历史，必须按 bornAt 过滤。
6. **UUID 前 8 位撞车**（时间序 UUID），内部短 id 用尾部 8 位。
7. **插件缓存软链 = "not installed"**，必须实体拷贝。
8. **休息位未分配**：所有休息员工叠在同一坐标——引入 `claimRestSpot`。
9. **气泡锚定工位**：员工走开后气泡仍从电脑弹出——改为按当前 sprite
   动态计算头部锚点，交付途中继续按状态隐藏。
10. **云形描边露内缝线**：Path2D 多圆并集 stroke 会画出内部圆边——两遍
    填充剪影法解决。
11. **config.toml UNC 前缀**：Windows 残留路径搞挂整个 plugin 命令。
12. **MCP 宿主 PATH 无 node**：必须用 launcher 脚本显式找 node。

---

## 12. 已知限制与后续方向

**限制：**
- 气泡更新粒度 = 整条消息（日志按条落盘），非逐 token。
- 仅跟踪"最新根会话"一棵树；多会话并发时只显示最新者。
- 子智能体完成判定依赖其线程文件的 `task_complete`；异常被杀（无完成记录）
  的 agent 会停在 working 态，暂无超时兜底。
- 侧边栏自注册依赖 app 的内部 JSON，app 版本升级可能换格式（已做 try/catch
  降级，失效不影响主功能）。

**方向（按价值排序）：**
1. 失败/中断检测超时兜底（N 分钟无输出且无完成 → 标记疑似卡死）。
2. 多会话 Tab 切换（索引里已有全部根会话，加个切换器即可）。
3. 抽屉输出历史按阶段折叠与筛选。
4. 历史回放模式暴露到页面 UI（现在只有 CLI）。

---

## 13. 文件清单

| 文件 | 职责 |
|---|---|
| `server/server.mjs` | 桥接：日志索引/tail、状态机、SSE、静态服务、侧边栏注册、demo/replay |
| `server/appearance.mjs` | V3 外观种子、版本和三部分协议 |
| `server/mcp.mjs` | 插件 MCP：拉起桥接、状态工具 |
| `scripts/launch_pixel_office_mcp` | MCP 的 node 查找启动器 |
| `public/js/sprites.js` | 资源清单、三段式渲染与 LAYOUT 坐标 |
| `public/js/scene.js` | 静态背景层、时间窗景与茶水间 |
| `public/js/actors.js` | 员工/老板状态机、动画、V2 读取兼容、z-order、名牌 |
| `public/js/bubbles.js` | 云朵/喊话气泡引擎、换行/滚动/裁剪 |
| `public/js/main.js` | SSE 客户端、主循环、抽屉交互与调试状态 |
| `tools/pixel_art.py` | 像素引擎与全局调色板 |
| `tools/draw_workers.py` | 员工素材入口与保留的 V2 回退生成逻辑 |
| `tools/worker_parts.py` | V3 三段式 9×9×9 外观与共享 15 姿势骨架 |
| `tools/render_worker_catalog.py` | 15 姿势与 729 组合的视觉验收目录 |
| `tools/draw_furniture.py` | 工位、窗景、茶水间和家具素材生成 |
| `tools/make_props.py` | 办公室小道具生成 |
| `.codex-plugin/plugin.json` | 插件清单 |
| `.mcp.json` | MCP 注册 |
| `skills/pixel-office/SKILL.md` | 触发词与主动行为指令 |
| `install.sh` | marketplace 生成、配置注册、插件物化与 launchd |
