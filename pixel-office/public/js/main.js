/* boot, SSE wiring, game loop, UI interactions */
"use strict";

(function main() {
  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const office = new Office();
  const scene = new Scene();
  // debug hook (harmless in production)
  window.__officeDebug = () => [...office.workers.values()].map(w => ({
    id: w.id,
    name: w.name, state: w.state, x: Math.round(w.x), y: Math.round(w.y),
    deskIdx: w.deskIdx, waitingForDesk: !w.desk && ["spawning", "working", "recalled"].includes(w.state),
    deskVariant: deskVariantName(w.deskIdx),
    appearance: { ...w.appearance }, appearanceVersion: w.appearanceVersion,
    appearanceGeneration: w.appearanceGeneration, terminalAt: w.terminalAt, leaveAt: w.leaveAt,
    waitArea: w.waitArea, waitZone: w.waitSpot?.zone || null,
    waitKind: w.waitSpot?.kind || null,
    windowPhase: scene.windowPhase, windowBlend: scene.windowBlend,
    wp: w.waypoints.length, queue: [...deliveryQueue],
    zzz: w.zzz.map(z => ({ x: Math.round(z.x), y: Math.round(z.y), t: Math.round(z.t) })),
    visible: w.bubble.visible, head: w.headPos(), hitBounds: w.hitBounds(),
    task: w.task, progressCount: w.history.length,
  }));

  const connPill = document.getElementById("conn-pill");
  const sessionLabel = document.getElementById("session-label");
  const agentCount = document.getElementById("agent-count");
  const idleHint = document.getElementById("idle-hint");
  const offlineHint = document.getElementById("offline-hint");
  const drawer = document.getElementById("drawer");
  const drawerBody = document.getElementById("drawer-body");
  const drawerName = document.getElementById("drawer-name");
  const drawerState = document.getElementById("drawer-state");
  const drawerTask = document.getElementById("drawer-task");
  const drawerProgress = document.getElementById("drawer-progress");
  const drawerProgressCount = document.getElementById("drawer-progress-count");
  let drawerAgentId = null;

  const STATE_LABEL = {
    spawning: "报到中", working: "工作中", delivering: "交付中",
    resting: "休息中", failed: "出错了", failed_idle: "待返工",
    recalled: "被召回", completed: "交付中", waiting: "等待下班",
    clockout_walk: "下班中", clockout_fade: "离场中", offstage: "已离场",
  };

  function setConn(cls, text) {
    connPill.className = "pill " + cls;
    connPill.textContent = text;
  }

  function refreshChrome(snapshot) {
    // Archived records are history only; the visible worker Map is the active
    // count shown in the office chrome.
    const n = office.workers.size;
    agentCount.textContent = `${n} 名员工`;
    if (snapshot) {
      sessionLabel.textContent = snapshot.sessionLabel || "";
      if (snapshot.demo) setConn("pill-ok", "演示模式");
      else setConn("pill-ok", "实时监听中");
    }
    idleHint.classList.toggle("hidden", n > 0);
  }

  /* ------------------------------------------------------------ SSE */
  let es = null, retries = 0, gotSnapshot = false;

  function applySnapshot(s) {
    const selectedId = drawerAgentId;
    const wallNow = Date.now();
    const animNow = performance.now();
    office.reset();
    const agents = s.agents || [];
    const isTerminal = (a) => a.terminalAt != null
      || ["completed", "failed", "failed_idle", "resting"].includes(a.state);
    const isVisibleTerminal = (a) => {
      const leaveAt = toWallTime(a.leaveAt);
      return isTerminal(a) && leaveAt != null && leaveAt > wallNow;
    };

    // Active workers claim the fixed desks first. Terminal workers never
    // claim desks because their desk was released when the terminal state was
    // entered on the server.
    for (const a of agents.filter(agent => !isTerminal(agent))) {
      const w = office.spawn(a.id, a.name, a.state === "working", a);
      w.setText(a.text || "");
      w.setTask(a.task || a.name);
      w.setHistory(a.history || []);
      if (a.state === "working") {
        if (w.desk) {
          w.state = "working";
          w.x = w.desk.x - 12;
          w.y = w.desk.y + 4;
          w.waypoints = [];
        } else {
          // Active overflow workers walk to the door queue and remain promotable.
          w.state = "spawning";
        }
      }
    }
    office.promoteWaiting();

    for (const a of agents.filter(isTerminal)) {
      if (!isVisibleTerminal(a)) {
        office.archiveSnapshot(a);
        continue;
      }
      const w = office.spawn(a.id, a.name, false, a);
      w.setText(a.text || "");
      w.setTask(a.task || a.name);
      w.setHistory(a.history || []);
      w.hydrateTerminal(a.state, wallNow, animNow, a);
    }
    refreshChrome(s);
    const selected = selectedId && office.get(selectedId);
    if (selected) openDrawer(selected);
    else closeDrawer();
  }

  function connect() {
    if (es) es.close();
    es = new EventSource("/events");
    es.onopen = () => { retries = 0; offlineHint.classList.add("hidden"); };
    es.onerror = () => {
      setConn("pill-err", "连接断开");
      if (++retries >= 4) {
        offlineHint.classList.remove("hidden");
        es.close();
      }
    };
    es.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      const animNow = performance.now();
      const wallNow = Date.now();
      switch (msg.type) {
        case "snapshot":
          gotSnapshot = true;
          applySnapshot(msg);
          break;
        case "spawn": {
          const w = office.spawn(msg.id, msg.name, true, msg);
          w.setTask(msg.task || msg.name);
          w.setText("开始干活…");
          refreshChrome();
          break;
        }
        case "task": {
          office.updateRecord(msg.id, msg);
          const visible = office.get(msg.id);
          if (visible && drawerAgentId === msg.id) renderDrawer(visible);
          else if (!visible && drawerAgentId === msg.id) closeDrawer();
          break;
        }
        case "progress": {
          const record = office.getRecord(msg.id);
          if (record) {
            const visible = office.get(msg.id);
            if (visible) visible.appendProgress(msg.text);
            else office.updateRecord(msg.id, { progress: msg.text });
            if (visible && drawerAgentId === msg.id) renderProgress(visible);
            else if (!visible && drawerAgentId === msg.id) closeDrawer();
          }
          break;
        }
        case "output": {
          office.updateRecord(msg.id, msg);
          if (!office.get(msg.id) && drawerAgentId === msg.id) closeDrawer();
          break;
        }
        case "state": {
          const w = office.get(msg.id);
          if (msg.state === "completed") {
            if (w && msg.summary) w.setText(msg.summary);
            else if (msg.summary) office.updateRecord(msg.id, { text: msg.summary });
            office.complete(msg.id, wallNow, animNow, msg);
          } else if (msg.state === "recalled") {
            office.recall(msg.id, msg, wallNow, animNow);
          } else if (msg.state === "failed") {
            office.fail(msg.id, wallNow, animNow, msg);
          } else if (msg.state === "working") {
            office.recall(msg.id, msg, wallNow, animNow);
          }
          const visible = office.get(msg.id);
          if (visible && drawerAgentId === msg.id) renderDrawerState(visible);
          else if (!visible && drawerAgentId === msg.id) closeDrawer();
          refreshChrome();
          break;
        }
        case "session":
          refreshChrome();
          break;
        case "reset":
          office.reset();
          closeDrawer();
          refreshChrome();
          break;
      }
    };
  }

  document.getElementById("reload-btn").onclick = () => { retries = 0; connect(); };

  /* ------------------------------------------------------------ drawer */
  function renderDrawerState(w) {
    drawerState.textContent = STATE_LABEL[w.state] || w.state;
    drawerState.className = "pill st-" + (w.state === "failed_idle" ? "failed" : w.state);
  }

  function renderProgress(w) {
    const stickToBottom = drawerBody.scrollTop + drawerBody.clientHeight
      >= drawerBody.scrollHeight - 24;
    drawerProgress.replaceChildren();
    drawerProgressCount.textContent = w.history.length + " 条";
    if (!w.history.length) {
      const empty = document.createElement("p");
      empty.className = "drawer-empty";
      empty.textContent = "（还没有输出）";
      drawerProgress.appendChild(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    w.history.forEach((text, index) => {
      const entry = document.createElement("article");
      entry.className = "progress-entry";
      entry.setAttribute("role", "listitem");
      const label = document.createElement("span");
      label.className = "progress-index";
      label.textContent = "进展 " + (index + 1);
      const content = document.createElement("pre");
      content.textContent = text;
      entry.append(label, content);
      fragment.appendChild(entry);
    });
    drawerProgress.setAttribute("role", "list");
    drawerProgress.appendChild(fragment);
    if (stickToBottom) drawerBody.scrollTop = drawerBody.scrollHeight;
  }

  function renderDrawer(w) {
    drawerName.textContent = w.name;
    drawerTask.textContent = w.task || "（未提供任务说明）";
    renderDrawerState(w);
    renderProgress(w);
  }

  function openDrawer(w) {
    drawerAgentId = w.id;
    renderDrawer(w);
    drawer.classList.remove("hidden");
  }

  function closeDrawer() {
    drawer.classList.add("hidden");
    drawerAgentId = null;
  }
  document.getElementById("drawer-close").onclick = closeDrawer;

  function canvasPoint(ev) {
    const r = canvas.getBoundingClientRect();
    const scale = Math.min(r.width / LAYOUT.W, r.height / LAYOUT.H);
    const left = r.left + (r.width - LAYOUT.W * scale) / 2;
    const top = r.top + (r.height - LAYOUT.H * scale) / 2;
    const x = (ev.clientX - left) / scale;
    const y = (ev.clientY - top) / scale;
    if (x < 0 || x > LAYOUT.W || y < 0 || y > LAYOUT.H) return null;
    return { x, y };
  }

  canvas.addEventListener("click", (ev) => {
    const point = canvasPoint(ev);
    if (!point) { closeDrawer(); return; }
    // Employees with lower feet are drawn later, so test those first.
    const workers = [...office.workers.values()].sort((a, b) => {
      const ab = a.hitBounds(), bb = b.hitBounds();
      return (bb.y + bb.h) - (ab.y + ab.h);
    });
    for (const w of workers) {
      if (w.hitTest(point.x, point.y)) { openDrawer(w); return; }
    }
    closeDrawer();
  });
  canvas.addEventListener("mousemove", (ev) => {
    const point = canvasPoint(ev);
    canvas.style.cursor = point && [...office.workers.values()]
      .some(w => w.hitTest(point.x, point.y)) ? "pointer" : "default";
  });

  /* ------------------------------------------------------------ loop */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(100, now - last);
    last = now;
    const wallNow = Date.now();
    office.update(now, dt, wallNow);
    refreshChrome();
    ctx.clearRect(0, 0, LAYOUT.W, LAYOUT.H);
    scene.draw(ctx, wallNow);
    office.draw(ctx, now);
    if (drawerAgentId) {
      const visible = office.get(drawerAgentId);
      if (visible) renderDrawerState(visible);
      else closeDrawer();
    }
    requestAnimationFrame(frame);
  }

  // show the idle hint only when truly idle for a while
  setTimeout(() => {
    if (office.workers.size === 0 && gotSnapshot) idleHint.classList.remove("hidden");
  }, 6000);

  ctx.fillStyle = "#3a2c1e";
  ctx.fillRect(0, 0, LAYOUT.W, LAYOUT.H);
  ctx.fillStyle = "#ffe9c9";
  ctx.font = "16px sans-serif";
  ctx.fillText("办公室装修中…", 40, 60);

  SPRITES.load().then(() => {
    scene.build();
    connect();
    requestAnimationFrame(frame);
  });
})();
