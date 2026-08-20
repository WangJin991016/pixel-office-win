# Pixel Office for Windows — 开发文档

> 版本：`0.3.2+codex.20260820`
>
> 平台：Windows 10 / Windows 11
>
> 运行时：Node.js 18+，零 npm 依赖

## 设计边界

Pixel Office 是 Codex Desktop 的只读可视化插件。它观察最新的 Codex 根任务树和 subagent rollout，把生命周期转换为像素办公室动画。

- 只支持并测试 Windows。
- 默认读取 `%CODEX_HOME%\sessions`；未设置时读取 `%USERPROFILE%\.codex\sessions`。
- HTTP 服务默认绑定 `127.0.0.1`。
- 不创建代理，不修改 rollout，不向外部网络发送任务内容。
- 不安装 Windows 服务或登录任务。
- 运行时只使用 Node.js 标准库；前端没有框架和构建步骤。

## 仓库结构

```text
.
├─ .agents/plugins/marketplace.json   Git marketplace 清单
├─ README.md                          Windows 用户文档
└─ pixel-office/
   ├─ .codex-plugin/plugin.json       插件元数据
   ├─ .mcp.json                       MCP server 注册
   ├─ skills/pixel-office/            自动触发与右侧页面规则
   ├─ server/                         日志桥接、MCP 和外观协议
   ├─ public/                         页面、动画与 PNG
   ├─ tools/                          Python/Pillow 素材生成器
   └─ tests/                          Node、Python 与浏览器测试
```

## Windows 安装与启动

仓库根目录本身是 Codex Git marketplace：

```powershell
codex plugin marketplace add WangJin991016/pixel-office-win --ref main
codex plugin add pixel-office@pixel-office-win
```

插件的 `.mcp.json` 直接用 `node` 启动 `server/mcp.mjs`。MCP 在任务加载时检查 `127.0.0.1:8791`，仅在服务未运行时拉起桥接。

`skills/pixel-office/SKILL.md` 在观察到 subagent 时调用 `pixel_office_status`，再请求 Codex Desktop 宿主工具打开右侧页面。宿主能力不可用时使用直接 URL。

服务端不写 Codex Desktop 的内部侧栏配置文件。

## 运行模式

从 `pixel-office` 目录运行：

```powershell
# 实时
node .\server\server.mjs --host 127.0.0.1 --port 8791

# 演示
node .\server\server.mjs --demo --host 127.0.0.1 --port 8792

# 回放
node .\server\server.mjs --replay "A:\path\to\rollout.jsonl" --speed 20

# 自定义会话目录
node .\server\server.mjs --sessions-dir "A:\path\to\sessions" --port 8791
```

实时模式每 700 ms 增量读取 rollout；输出事件最多每 450 ms 广播一次。服务选择最新根任务树，切换根任务时向前端发送 `reset`。

## HTTP 与 SSE

| 端点 | 说明 |
| --- | --- |
| `GET /` | 办公室页面 |
| `GET /api/state` | 当前完整快照 |
| `GET /events` | SSE；连接时先发送 snapshot |
| `GET /assets/*`、`/css/*`、`/js/*` | 静态资源 |

代理快照包含身份、状态、任务、历史输出、`workStartedAt`、`terminalAt`、`leaveAt`、`appearanceVersion`、`appearanceGeneration` 和 `appearance`。

SSE 事件包括 `snapshot`、`spawn`、`task`、`progress`、`output`、`state`、`session` 和 `reset`。

这些本地端点没有身份验证，可能包含提示词和代理输出。保持 `127.0.0.1` 绑定，不要端口转发。

## 生命周期

```text
spawning → working
working → delivering → waiting
working → waiting(error)
waiting / delivering / clockout → recalled → working
waiting → clockout_walk → clockout_fade → offstage
```

- 完成和失败都立即释放工位，并促进入口等待者。
- 完成员工进入交付队列；失败员工直接前往等候区并保持红色气泡。
- 实时模式 `leaveAt = terminalAt + 1_800_000`。
- 演示模式等候 30 秒；回放模式按 `--speed` 缩放。
- 页面休眠、刷新和 SSE 重连不会重置绝对截止时间。
- 截止前召回保留外观；离场后新工作增加外观代次。
- `workStartedAt` 防止旧一轮迟到终态覆盖新任务。
- 没有 `leaveAt` 的旧终态 snapshot 不会恢复到画面。

## 工位与队列

8 个物理工位永久绑定 `deskVariant 0..7`。

超过 8 名活跃代理时，每名无工位代理通过 `activeOverflowOwners` 领取唯一入口位置。分配工位、进入终态、归档或重置时释放位置。测试覆盖 20 名活跃代理：8 人入座，12 个溢出位置唯一且可复用。

交付队列前 8 人使用中央固定位置，第 9 人以后按左右交替扩展平行队列。测试覆盖 20 名同时完成代理，并断言 20 个交付目标全部唯一。

终态员工优先使用 6 个分散休息位和 6 个茶水间位置；占满后使用休息溢出位，不重新占用工位或堵住茶水间入口。

## V3 三段式外观

`appearanceVersion: 3` 的 `appearance` 包含 `head`、`upper`、`lower` 三个 `0..8` 索引。种子由会话、线程、外观代次和部件名稳定生成。

运行时图集：

- `worker_part_head.png`
- `worker_part_upper.png`
- `worker_part_lower.png`
- `worker_fallback.png`

三个部件各有 9 套设计和 15 个姿势，每格 104×192 物理像素，对应 26×48 逻辑像素。绘制顺序是 `lower → upper → head`，并共享颈、腰和脚底锚点。任一部件加载失败时使用完整 fallback。

## 场景

- 画布逻辑分辨率 1280×720。
- 8 套固定工位。
- 6 段窗景：dawn、morning、noon、afternoon、dusk、night。
- 每段最后 10 分钟交叉淡化；减少动态效果时直接切换。
- 角色按脚底 Y 排序；茶水间前景参与遮挡；气泡最后绘制。
- `window.__officeDebug()` 提供代理状态、坐标、路径、队列、外观、离场时间、等候区、工位编号和窗景阶段。

## 素材生成

只有修改美术源代码时才安装 Pillow：

```powershell
py -3 -m pip install Pillow
Set-Location .\pixel-office\tools
py -3 .\draw_workers.py
py -3 .\draw_furniture.py
py -3 .\make_props.py
```

生成器直接更新 `public/assets`。提交生成结果时必须同时提交对应 `tools` 源码。

## 测试

从 `pixel-office` 目录运行：

```powershell
node --test `
  .\tests\server-appearance-03.test.mjs `
  .\tests\client-lifecycle-02.test.cjs

node .\tests\scene-render-02.test.cjs
py -3 .\tests\assets-02.test.py
```

测试覆盖外观稳定性、V2 读取兼容、生命周期边界、失败/完成/召回、8 工位递补、20 人活跃溢出、20 人交付、6 个时间阶段、729×15 角色组合、fallback、工位、窗景和 Boss 哈希。

浏览器测试需要外部 Playwright 模块和 Chromium 或 Edge：

```powershell
node .\tests\browser-render-03.test.cjs <playwright-module> <browser-exe> http://127.0.0.1:8792/ <screenshot-path>
```

运行浏览器测试前先在 8792 启动演示服务。运行时本身不依赖 Playwright。

## 发布检查

1. `git status --short` 只包含预期文件。
2. `git diff --check` 无空白错误。
3. manifest、MCP、README 和本文版本一致。
4. marketplace 指向 `./pixel-office`，不包含绝对路径或符号链接。
5. 仓库不包含 macOS 安装脚本、调试日志、机器专用 marketplace 或来源不明参考图。
6. Node、场景、资产和隔离端口 demo 验证通过。
7. 目标 GitHub 分支可以普通快进；禁止 force push。
8. 推送后核对远端 commit、README、marketplace 与插件版本。

## 已知限制

- 只跟踪最新根任务树。
- 气泡按完整日志消息更新，不是逐 token。
- 无终态事件的异常消失代理没有超时兜底。
- 自动打开右侧页面依赖 Codex Desktop 宿主工具；直接 URL 是回退入口。
