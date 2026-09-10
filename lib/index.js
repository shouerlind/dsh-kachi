// src/host/index.ts
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// src/host/settings-schema.ts
import Schema from "@deepseek-ai/schemastery";

// src/shared/slots.ts
var DEFAULT_SLOT_SOUNDS = {
  boot: "boot.wav",
  notifyImportant: "notify-important.wav",
  taskComplete: "task-complete.wav",
  error: "error.wav",
  menuMove: "menu-move.wav",
  send: "send.wav",
  button: "button.wav",
  confirm: "confirm.wav",
  cancel: "cancel.wav",
  sessionNew: "session-new.wav",
  sessionClose: "session-close.wav",
  reconnect: "reconnect.wav",
  warn: "warn.wav"
};
var DEFAULT_SLOT_VOLUMES = {
  boot: 100,
  notifyImportant: 100,
  taskComplete: 100,
  error: 100,
  menuMove: 40,
  send: 100,
  button: 30,
  confirm: 80,
  cancel: 90,
  sessionNew: 100,
  sessionClose: 100,
  reconnect: 100,
  warn: 90
};

// src/shared/settings.ts
var SETTINGS_NAMESPACE = "dsh-kachi";
var DEFAULT_SETTINGS = {
  enabled: true,
  masterVolume: 100,
  bootSound: true,
  throttleMs: 200,
  slotSounds: { ...DEFAULT_SLOT_SOUNDS },
  slotVolumes: { ...DEFAULT_SLOT_VOLUMES }
};

// src/host/settings-schema.ts
var KACHI_SETTINGS_NAMESPACE = SETTINGS_NAMESPACE;
var kachiSettingsSchema = Schema.object({
  enabled: Schema.boolean().default(true).description("\u603B\u5F00\u5173:\u4E00\u952E\u9759\u97F3\u6574\u4E2A\u63D2\u4EF6"),
  masterVolume: Schema.number().min(0).max(100).default(100).description("\u603B\u97F3\u91CF(0-100,\u5E73\u65B9\u6620\u5C04)"),
  bootSound: Schema.boolean().default(true).description("\u5F00\u673A\u97F3(\u6BCF\u6B21\u9875\u9762\u52A0\u8F7D\u64AD\u653E)"),
  throttleMs: Schema.number().min(0).max(2e3).default(200).description("\u8282\u6D41\u65F6\u95F4\u7A97(\u6BEB\u79D2)"),
  slotSounds: Schema.dict(Schema.string()).default(DEFAULT_SETTINGS.slotSounds).description("\u6BCF\u69FD\u4F4D\u9009\u97F3(\u6587\u4EF6\u540D)"),
  slotVolumes: Schema.dict(Schema.number()).default(DEFAULT_SETTINGS.slotVolumes).description("\u6BCF\u69FD\u4F4D\u97F3\u91CF(0-100)")
}).description("dsh-kachi Switch \u97F3\u6548");

// src/host/sound-files.ts
var FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.wav$/;
var PREFIX = "/dsh-kachi/sounds/";
function resolveSoundFile(pathname) {
  if (!pathname.startsWith(PREFIX)) return void 0;
  const rest = pathname.slice(PREFIX.length);
  if (rest.startsWith("pack/")) {
    const file = rest.slice("pack/".length);
    return FILE_RE.test(file) ? `pack/${file}` : void 0;
  }
  return FILE_RE.test(rest) ? rest : void 0;
}

// src/host/index.ts
var inject = ["settings", "webServer"];
var SOUND_ROOT = fileURLToPath(new URL("../assets/sounds/", import.meta.url));
function apply(ctx) {
  ctx.effect(
    () => ctx.webServer.register({
      kind: "prefix",
      path: "/dsh-kachi",
      handler: (req, res) => {
        void serveSound(req, res);
      }
    }),
    "dsh-kachi: sound routes"
  );
  ctx.effect(() => {
    ctx.settings.register(KACHI_SETTINGS_NAMESPACE, kachiSettingsSchema);
    return () => {
    };
  }, "dsh-kachi: settings namespace");
}
async function serveSound(req, res) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const rel = resolveSoundFile(url.pathname);
  if (rel === void 0) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
    return;
  }
  const filePath = join(SOUND_ROOT, rel);
  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
    return;
  }
  if (!fileStat.isFile()) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
    return;
  }
  res.writeHead(200, {
    "content-type": "audio/wav",
    "content-length": fileStat.size,
    "cache-control": "public, max-age=86400"
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  const stream = createReadStream(filePath);
  stream.pipe(res);
  stream.on("error", () => {
    res.destroy();
  });
}
export {
  apply,
  inject
};
//# sourceMappingURL=index.js.map
