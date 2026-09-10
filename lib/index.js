// src/host/index.ts
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// src/shared/sound-envelope.ts
var ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function encodeBase64(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += ALPHABET[b0 >> 2];
    out += ALPHABET[(b0 & 3) << 4 | (b1 ?? 0) >> 4];
    out += b1 === void 0 ? "=" : ALPHABET[(b1 & 15) << 2 | (b2 ?? 0) >> 6];
    out += b2 === void 0 ? "=" : ALPHABET[b2 & 63];
  }
  return out;
}
var LOOKUP = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let i = 0; i < ALPHABET.length; i++) table[ALPHABET.charCodeAt(i)] = i;
  return table;
})();

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
function resolveSoundFile(rel) {
  if (rel.startsWith("pack/")) {
    const file = rel.slice("pack/".length);
    return FILE_RE.test(file) ? `pack/${file}` : void 0;
  }
  return FILE_RE.test(rel) ? rel : void 0;
}

// src/host/index.ts
var inject = ["settings", "webServer"];
var SOUND_ROOT = (() => {
  const candidates = ["../assets/sounds/", "../../assets/sounds/"];
  for (const rel of candidates) {
    const dir = fileURLToPath(new URL(rel, import.meta.url));
    if (existsSync(dir)) return dir;
  }
  return fileURLToPath(new URL(candidates[0], import.meta.url));
})();
var SOUND_PATH = "/dsh-kachi/sound";
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
function notFound(res) {
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
}
async function serveSound(req, res) {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname !== SOUND_PATH) {
    notFound(res);
    return;
  }
  const rel = resolveSoundFile(url.searchParams.get("file") ?? "");
  if (rel === void 0) {
    notFound(res);
    return;
  }
  const bytes = await readFile(join(SOUND_ROOT, rel)).catch(() => void 0);
  if (bytes === void 0) {
    notFound(res);
    return;
  }
  const body = JSON.stringify({ b64: encodeBase64(bytes) });
  res.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    // 与旧静态路由同级:文件身份即整个 URL(file 参数),可放心长缓存。
    "cache-control": "public, max-age=86400"
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(body);
}
export {
  apply,
  inject
};
//# sourceMappingURL=index.js.map
