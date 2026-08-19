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
    name: w.name, state: w.state, x: Math.round(w.x), y: Math.round(w.y),
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
    recalled: "被召回", completed: "交付中",
  };

  function setConn(cls, text) {
    connPill.className = "pill " + cls;
    connPill.textContent = text;
  }

  function refreshChrome(snapshot) {
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
    office.reset();
    for (const a of s.agents || []) {
      const w = office.spawn(a.id, a.name);
      w.setText(a.text || "");
      w.setTask(a.task || a.name);
      w.setHistory(a.history || []);
      if (a.state === "working") w.state = "working";
      else if (a.state === "failed") { w.state = "failed_idle"; w.bubble.mood = "error"; }
      else if (a.state === "completed" || a.state === "resting") {
        // join mid-story: place him in the rest corner
        w.state = "resting";
        const s = claimRestSpot(w.id);
        w.restSpot = s;
        w.x = s.kind === "chaise" ? s.x - 46 : s.x;
        w.y = s.y;
        w.waypoints = [];
        w.bubble.mood = "dim";
      }
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
      const now = performance.now();
      switch (msg.type) {
        case "snapshot":
          gotSnapshot = true;
          applySnapshot(msg);
          break;
        case "spawn": {
          const w = office.spawn(msg.id, msg.name);
          w.setTask(msg.task || msg.name);
          w.setText("开始干活…");
          refreshChrome();
          break;
        }
        case "task": {
          const w = office.get(msg.id);
          if (w) {
            w.setTask(msg.task);
            if (drawerAgentId === w.id) renderDrawer(w);
          }
          break;
        }
        case "progress": {
          const w = office.get(msg.id);
          if (w && w.appendProgress(msg.text) && drawerAgentId === w.id) {
            renderProgress(w);
          }
          break;
        }
        case "output": {
          const w = office.get(msg.id);
          if (w) w.setText(msg.text);
          break;
        }
        case "state": {
          const w = office.get(msg.id);
          if (!w) break;
          if (msg.state === "completed") {
            if (msg.summary) w.setText(msg.summary);
            w.onCompleted(now);
          } else if (msg.state === "recalled") {
            w.onRecalled();
          } else if (msg.state === "failed") {
            w.onFailed(now);
          } else if (msg.state === "working") {
            w.onRecalled();
          }
          if (drawerAgentId === w.id) renderDrawerState(w);
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
    office.update(now, dt);
    ctx.clearRect(0, 0, LAYOUT.W, LAYOUT.H);
    scene.draw(ctx);
    office.draw(ctx, now);
    if (drawerAgentId) {
      const w = office.get(drawerAgentId);
      if (w) renderDrawerState(w);
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
