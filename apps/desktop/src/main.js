const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const FormData = require("form-data");
const fetch = require("node-fetch");

/**
 * Electron local bridge (Phase 3)
 * - Lists cameras via Chromium getUserMedia in renderer
 * - Uploads captured frames to Metallurgy SaaS API
 * Extend here with vendor SDK native addons when proprietary drivers are required.
 */

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: "Metallurgy Camera Bridge",
  });
  win.loadFile(path.join(__dirname, "index.html"));
}

ipcMain.handle("upload-frame", async (_event, payload) => {
  const { apiUrl, token, orgId, sampleId, analysisType, calibrationId, runAi, filePath } =
    payload;
  const form = new FormData();
  form.append("sample_id", sampleId);
  form.append("analysis_type", analysisType);
  if (calibrationId) form.append("calibration_id", calibrationId);
  form.append("run_ai", String(!!runAi));
  form.append("file", fs.createReadStream(filePath), "bridge-capture.jpg");

  const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/orgs/${orgId}/jobs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      ...form.getHeaders(),
    },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || res.statusText);
  return JSON.parse(text);
});

ipcMain.handle("save-temp-frame", async (_event, dataUrl) => {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  const filePath = path.join(app.getPath("temp"), `metallurgy-frame-${Date.now()}.jpg`);
  fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
  return filePath;
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
