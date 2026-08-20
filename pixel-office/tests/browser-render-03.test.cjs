"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");


async function main() {
  const playwrightModule = process.argv[2] || "playwright";
  const executablePath = process.argv[3];
  const officeUrl = process.argv[4] || "http://127.0.0.1:8792/";
  const screenshotPath = process.argv[5];
  const { chromium } = require(playwrightModule);
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const runtimeErrors = [];
    page.on("pageerror", error => runtimeErrors.push(String(error)));
    page.on("console", message => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });

    const response = await page.goto(officeUrl, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200);
    await page.waitForFunction(() => (
      typeof SPRITES !== "undefined"
      && SPRITES.hasWorkerAtlas()
      && typeof window.__officeDebug === "function"
    ));

    const bossControl = await page.evaluate(() => {
      const button = document.getElementById("boss-sprite-btn");
      if (!button) return null;
      const initial = {
        text: button.textContent,
        pressed: button.getAttribute("aria-pressed"),
      };
      button.click();
      const toggled = {
        text: button.textContent,
        pressed: button.getAttribute("aria-pressed"),
      };
      button.click();
      return {
        initial,
        toggled,
        restored: {
          text: button.textContent,
          pressed: button.getAttribute("aria-pressed"),
        },
      };
    });
    assert.deepEqual(bossControl, {
      initial: { text: "更换总经理", pressed: "true" },
      toggled: { text: "更换总经理", pressed: "false" },
      restored: { text: "更换总经理", pressed: "true" },
    });

    const result = await page.evaluate(() => {
      const poses = [
        "stand_front", "stand_side", "stand_back", "walk_front", "walk_front_b",
        "walk_side_a", "walk_side_b", "walk_back", "walk_back_b", "documents",
        "coffee", "briefcase", "sit", "upper_front", "upper_back",
      ];
      const canvas = document.createElement("canvas");
      canvas.width = 80;
      canvas.height = 120;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      let calls = 0;
      for (let head = 0; head < 9; head++) {
        for (let upper = 0; upper < 9; upper++) {
          for (let lower = 0; lower < 9; lower++) {
            const appearance = { head, upper, lower };
            for (const pose of poses) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              if (!SPRITES.drawWorker(ctx, pose, appearance, 40, 116, { width: 52 })) {
                throw new Error(`drawWorker returned false for ${head}/${upper}/${lower}/${pose}`);
              }
              calls++;
            }
          }
        }
      }
      return {
        calls,
        atlasLayerOrder: [...SPRITES.atlasLayerOrder],
        agents: window.__officeDebug(),
      };
    });
    assert.equal(result.calls, 729 * 15);
    assert.deepEqual(result.atlasLayerOrder, [
      "worker_part_lower", "worker_part_upper", "worker_part_head",
    ]);
    assert.ok(result.agents.length > 0, "demo should expose at least one agent");
    for (const agent of result.agents) {
      assert.equal(agent.appearanceVersion, 3);
      assert.deepEqual(Object.keys(agent.appearance).sort(), ["head", "lower", "upper"]);
      for (const value of Object.values(agent.appearance)) {
        assert.ok(Number.isInteger(value) && value >= 0 && value < 9);
      }
    }
    assert.deepEqual(runtimeErrors, []);
    if (screenshotPath) {
      await page.screenshot({ path: path.resolve(screenshotPath), fullPage: true });
    }

    // Load only the renderer/actor scripts on a clean page so the live SSE
    // office cannot affect the deterministic 20-worker queue probes.
    const stressPage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const baseUrl = new URL(officeUrl);
    await stressPage.setContent(`<!doctype html><html><body>
      <script src="${new URL("js/sprites.js", baseUrl)}"></script>
      <script src="${new URL("js/bubbles.js", baseUrl)}"></script>
      <script src="${new URL("js/actors.js", baseUrl)}"></script>
    </body></html>`, { waitUntil: "networkidle" });
    const stress = await stressPage.evaluate(() => {
      const coordinateKey = point => `${Math.round(point.x)}:${Math.round(point.y)}`;
      const activeOffice = new Office();
      const activeWorkers = Array.from({ length: 20 }, (_, index) =>
        activeOffice.spawn(`browser-overflow-${index}`, `Overflow ${index}`, true));
      activeWorkers.forEach(worker => { worker.state = "working"; });
      const activeTargets = activeWorkers.filter(worker => !worker.desk)
        .map(worker => worker.waypoints.at(-1) || { x: worker.x, y: worker.y });

      activeOffice.reset();
      const deliveryOffice = new Office();
      const deliveryWorkers = Array.from({ length: 20 }, (_, index) =>
        deliveryOffice.spawn(`browser-delivery-${index}`, `Delivery ${index}`, true));
      deliveryWorkers.forEach(worker => { worker.state = "working"; });
      deliveryWorkers.forEach((worker, index) => deliveryOffice.complete(
        worker.id, index, index, { terminalAt: index, leaveAt: 30000 + index },
      ));
      const deliveryTargets = deliveryWorkers.map(worker => worker.waypoints.at(-1));
      return {
        activeCount: activeTargets.length,
        activeUnique: new Set(activeTargets.map(coordinateKey)).size,
        deliveryCount: deliveryTargets.length,
        deliveryUnique: new Set(deliveryTargets.map(coordinateKey)).size,
        deliveryInBounds: deliveryTargets.every(point => point
          && point.x >= 0 && point.x <= LAYOUT.W && point.y >= 0 && point.y <= LAYOUT.H),
      };
    });
    assert.deepEqual(stress, {
      activeCount: 12,
      activeUnique: 12,
      deliveryCount: 20,
      deliveryUnique: 20,
      deliveryInBounds: true,
    });
    await stressPage.close();

    // Abort one V3 module on a fresh page. All 15 poses must still draw from
    // the complete monolithic fallback; a partial two-layer worker is invalid.
    const fallbackPage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await fallbackPage.route("**/worker_part_upper.png*", route => route.abort());
    await fallbackPage.goto(officeUrl, { waitUntil: "networkidle" });
    await fallbackPage.waitForFunction(() => (
      typeof SPRITES !== "undefined"
      && !SPRITES.hasWorkerAtlas()
      && typeof window.__officeDebug === "function"
    ));
    const fallback = await fallbackPage.evaluate(() => {
      const poses = [
        "stand_front", "stand_side", "stand_back", "walk_front", "walk_front_b",
        "walk_side_a", "walk_side_b", "walk_back", "walk_back_b", "documents",
        "coffee", "briefcase", "sit", "upper_front", "upper_back",
      ];
      const canvas = document.createElement("canvas");
      canvas.width = 80;
      canvas.height = 120;
      const ctx = canvas.getContext("2d");
      return poses.map(pose => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const drawn = SPRITES.drawWorker(
          ctx, pose, { head: 8, upper: 8, lower: 8 }, 40, 116, { width: 52 },
        );
        const opaque = Array.from(ctx.getImageData(0, 0, 80, 120).data)
          .some((value, index) => index % 4 === 3 && value > 0);
        return { pose, drawn, opaque };
      });
    });
    assert.ok(fallback.every(entry => entry.drawn && entry.opaque), JSON.stringify(fallback));
    await fallbackPage.close();

    console.log(JSON.stringify({
      status: "ok",
      renderCalls: result.calls,
      demoAgents: result.agents.length,
      fallbackPoses: fallback.length,
      overflowTargets: stress.activeUnique,
      deliveryTargets: stress.deliveryUnique,
      screenshotPath: screenshotPath ? path.resolve(screenshotPath) : null,
    }));
  } finally {
    await browser.close();
  }
}


main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
