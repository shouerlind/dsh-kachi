window.__ModuleLoader__.load({ id: "dsh-kachi", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/shared/slots.ts
var SLOT_IDS = [
  "boot",
  "notifyImportant",
  "taskComplete",
  "error",
  "menuMove",
  "send",
  "button",
  "confirm",
  "cancel",
  "sessionNew",
  "sessionClose",
  "reconnect",
  "warn"
];
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
var EVENT_SOUNDS = {
  boot: { slot: "boot", level: "foreground", volume: 100, throttle: "slot" },
  "approval-request": { slot: "notifyImportant", level: "intervention", volume: 100, throttle: "slot" },
  "questions-request": { slot: "notifyImportant", level: "intervention", volume: 100, throttle: "slot" },
  "turn-start": { slot: "menuMove", level: "foreground", volume: 100, throttle: "slot" },
  "user-message": { slot: "send", level: "foreground", volume: 100, throttle: "slot" },
  "turn-end-completed": { slot: "taskComplete", level: "intervention", volume: 100, throttle: "slot" },
  "turn-end-error": { slot: "error", level: "intervention", volume: 100, throttle: "slot" },
  "turn-end-cancelled": { slot: "cancel", level: "foreground", volume: 100, throttle: "slot" },
  "tool-call": { slot: "button", level: "foreground", volume: 100, throttle: "slot" },
  "tool-result-ok": { slot: "confirm", level: "foreground", volume: 100, throttle: "slot" },
  "tool-result-fail": { slot: "error", level: "foreground", volume: 70, throttle: "slot" },
  "session-added": { slot: "sessionNew", level: "foreground", volume: 100, throttle: "slot" },
  "session-removed": { slot: "sessionClose", level: "foreground", volume: 100, throttle: "slot" },
  "session-error": { slot: "error", level: "intervention", volume: 100, throttle: "slot" },
  "jobs-completed": { slot: "taskComplete", level: "foreground", volume: 60, throttle: "slot" },
  "jobs-failed": { slot: "error", level: "intervention", volume: 100, throttle: "slot" },
  reconnecting: { slot: "warn", level: "foreground", volume: 100, throttle: "slot" },
  reconnected: { slot: "reconnect", level: "foreground", volume: 100, throttle: "slot" },
  "own-click": { slot: "button", level: "foreground", volume: 100, throttle: "slot" },
  // composer 交互音(SPEC §5 行 21-24):volume 全 100,档位由槽位默认音量
  // 承接(confirm@80 / menuMove@40 / cancel@90;确认与取消刻意接近但保留
  // 取消略重 —— 用户决议「不要差太大,也要有点差距」)。节流一律按事件
  // 各自计闸(SPEC §4 例外②)。
  "menu-open": { slot: "confirm", level: "foreground", volume: 100, throttle: "event" },
  "menu-move": { slot: "menuMove", level: "foreground", volume: 100, throttle: "event" },
  "menu-item-click": { slot: "confirm", level: "foreground", volume: 100, throttle: "event" },
  "menu-close": { slot: "cancel", level: "foreground", volume: 100, throttle: "event" },
  // 全站按钮泛化(2026-09-08,§5 行 25/26):点击=按键音,悬停/键盘焦点=
  // 菜单移动音;音量由槽位默认档承接(button@30 / menuMove@40)。
  "ui-click": { slot: "button", level: "foreground", volume: 100, throttle: "event" },
  "ui-hover": { slot: "menuMove", level: "foreground", volume: 100, throttle: "event" }
};
function soundUrl(file, opts) {
  const base = opts?.base ?? "/dsh-kachi";
  return opts?.pack ? `${base}/sounds/pack/${file}` : `${base}/sounds/${file}`;
}
var SLOT_LABELS = {
  boot: "\u5F00\u673A\u97F3",
  notifyImportant: "\u901A\u77E5\u91CD\u8981\u97F3",
  taskComplete: "\u4EFB\u52A1\u5B8C\u6210\u97F3",
  error: "\u9519\u8BEF\u97F3",
  menuMove: "\u83DC\u5355\u79FB\u52A8\u97F3",
  send: "\u53D1\u9001\u97F3",
  button: "\u6309\u952E\u97F3",
  confirm: "\u786E\u8BA4\u97F3",
  cancel: "\u53D6\u6D88\u97F3",
  sessionNew: "\u65B0\u5EFA\u97F3",
  sessionClose: "\u5173\u95ED\u97F3",
  reconnect: "\u6062\u590D\u97F3",
  warn: "\u8B66\u793A\u97F3"
};
var MONOPHONIC_SLOTS = /* @__PURE__ */ new Set(["menuMove"]);
var MONOPHONIC_MIN_INTERVAL_MS = 50;
var INTERACTION_MIN_INTERVAL_MS = 50;
function isDefaultSound(file) {
  return Object.values(DEFAULT_SLOT_SOUNDS).includes(file);
}
function toSlotFile(file) {
  return { file, pack: !isDefaultSound(file) };
}

// src/client/engine/audio-engine.ts
function volumeGain(percent) {
  const v = Math.min(100, Math.max(0, percent)) / 100;
  return v * v;
}
function defaultVisibility() {
  return typeof document !== "undefined" && document.visibilityState === "hidden" ? "hidden" : "visible";
}
function createEngine(options) {
  const audioBase = options.audioBase ?? "/dsh-kachi";
  const fetchImpl = options.fetchImpl ?? ((url) => fetch(url));
  const visibility = options.visibility ?? defaultVisibility;
  const now = options.now ?? (() => performance.now());
  const ctx = options.createContext();
  const master = ctx.createGain();
  master.connect(ctx.destination);
  let masterVolume = 100;
  master.gain.value = volumeGain(masterVolume);
  const slotGains = /* @__PURE__ */ new Map();
  const slotVolumes = /* @__PURE__ */ new Map();
  for (const slot of SLOT_IDS) {
    const gain = ctx.createGain();
    gain.connect(master);
    const percent = DEFAULT_SLOT_VOLUMES[slot];
    gain.gain.value = volumeGain(percent);
    slotGains.set(slot, gain);
    slotVolumes.set(slot, percent);
  }
  const buffers = /* @__PURE__ */ new Map();
  const slotFiles = /* @__PURE__ */ new Map();
  for (const slot of SLOT_IDS) {
    slotFiles.set(slot, { file: DEFAULT_SLOT_SOUNDS[slot], pack: false });
  }
  let unlocked = false;
  let closed = false;
  let enabled = true;
  let throttleMs = 200;
  const lastPlayedAt = /* @__PURE__ */ new Map();
  const activeSources = /* @__PURE__ */ new Map();
  const lastEventGateAt = /* @__PURE__ */ new Map();
  function bufferKey(slotFile) {
    return slotFile.pack ? `pack/${slotFile.file}` : slotFile.file;
  }
  async function ensureBuffer(slotFile) {
    if (closed) return void 0;
    const key = bufferKey(slotFile);
    const cached = buffers.get(key);
    if (cached) return cached;
    try {
      const data = await fetchImpl(soundUrl(slotFile.file, { pack: slotFile.pack, base: audioBase }));
      if (!data.ok) return void 0;
      const bytes = await data.arrayBuffer();
      const buffer = await ctx.decodeAudioData(bytes);
      if (closed) return void 0;
      buffers.set(key, buffer);
      return buffer;
    } catch {
      return void 0;
    }
  }
  void Promise.all([...slotFiles.values()].map((f) => ensureBuffer(f))).catch(() => {
  });
  return {
    async unlock() {
      if (unlocked) return true;
      if (closed) return false;
      try {
        await ctx.resume();
        unlocked = true;
        return true;
      } catch {
        return false;
      }
    },
    async play(eventId) {
      if (closed || !unlocked || !enabled) return;
      const mapping = EVENT_SOUNDS[eventId];
      if (!mapping) return;
      if (visibility() === "hidden" && mapping.level !== "intervention") return;
      const monophonic = MONOPHONIC_SLOTS.has(mapping.slot);
      if (mapping.throttle === "event") {
        const lastAt = lastEventGateAt.get(eventId);
        if (lastAt !== void 0 && now() - lastAt < INTERACTION_MIN_INTERVAL_MS) return;
        lastEventGateAt.set(eventId, now());
      } else {
        const windowMs = monophonic ? MONOPHONIC_MIN_INTERVAL_MS : throttleMs;
        const playedAt = lastPlayedAt.get(mapping.slot);
        if (windowMs > 0 && playedAt !== void 0 && now() - playedAt < windowMs) return;
        lastPlayedAt.set(mapping.slot, now());
      }
      const slotFile = slotFiles.get(mapping.slot);
      const slotGain = slotGains.get(mapping.slot);
      if (!slotFile || !slotGain) return;
      const buffer = await ensureBuffer(slotFile);
      if (buffer === void 0 || closed || ctx.state !== "running") return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      if (mapping.volume < 100) {
        const shot = ctx.createGain();
        shot.gain.value = mapping.volume / 100;
        shot.connect(slotGain);
        source.connect(shot);
      } else {
        source.connect(slotGain);
      }
      if (monophonic) {
        const previous = activeSources.get(mapping.slot);
        if (previous !== void 0) {
          try {
            previous.stop();
          } catch {
          }
        }
        activeSources.set(mapping.slot, source);
      }
      source.start();
    },
    setMasterVolume(percent) {
      masterVolume = percent;
      master.gain.value = volumeGain(percent);
    },
    setSlotVolume(slot, percent) {
      slotVolumes.set(slot, percent);
      const gain = slotGains.get(slot);
      if (gain) gain.gain.value = volumeGain(percent);
    },
    async setSlotSound(slot, file) {
      slotFiles.set(slot, file);
      await ensureBuffer(file);
    },
    currentSlotFile(slot) {
      return slotFiles.get(slot)?.file;
    },
    setThrottleMs(ms) {
      throttleMs = Math.max(0, ms);
    },
    setEnabled(value) {
      enabled = value;
    },
    async preview(file) {
      if (closed || !unlocked) return;
      const buffer = await ensureBuffer(file);
      if (buffer === void 0 || closed || ctx.state !== "running") return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(master);
      source.start();
    },
    dispose() {
      closed = true;
      buffers.clear();
      void ctx.close().catch(() => {
      });
    }
  };
}

// src/client/engine/unlock.ts
function installUnlock(target, unlock) {
  let settled = false;
  let inFlight = false;
  const handler = () => {
    if (settled || inFlight) return;
    inFlight = true;
    void unlock().then((ok) => {
      if (ok) {
        settled = true;
        remove();
      }
    }).catch(() => {
    }).finally(() => {
      inFlight = false;
    });
  };
  const remove = () => {
    target.removeEventListener("pointerdown", handler, true);
    target.removeEventListener("keydown", handler, true);
  };
  target.addEventListener("pointerdown", handler, true);
  target.addEventListener("keydown", handler, true);
  return remove;
}

// src/client/wiring/layer-a.ts
var REMOTE_EVENTS = {
  questions: "user-questions/request",
  sessionError: "api-session/error"
};
function wireLayerA(remote, engine) {
  const offQuestions = remote.$on(
    REMOTE_EVENTS.questions,
    async (_request, next) => {
      void engine.play("questions-request");
      return next();
    }
  );
  const offError = remote.$on(REMOTE_EVENTS.sessionError, (_sessionId, _message) => {
    void engine.play("session-error");
  });
  return () => {
    offQuestions();
    offError();
  };
}

// src/client/wiring/sessions-tracker.ts
function trackSessions(sessions, hooks) {
  const tracked = /* @__PURE__ */ new Set();
  const dispatch = (initial) => {
    const ids = sessions.list.getSnapshot().ids;
    const next = new Set(ids);
    for (const id of ids) {
      if (tracked.has(id)) continue;
      const binding = sessions.binding(id);
      if (binding === void 0) continue;
      tracked.add(id);
      hooks.onAdded(binding, initial);
    }
    for (const id of [...tracked]) {
      if (!next.has(id)) {
        tracked.delete(id);
        hooks.onRemoved(id);
      }
    }
  };
  const detach = sessions.list.subscribe(() => dispatch(false));
  dispatch(true);
  return () => {
    detach();
    tracked.clear();
  };
}

// src/client/wiring/layer-b.ts
function journalToEvent(event) {
  switch (event.type) {
    case "turn/start":
      return "turn-start";
    case "turn/end": {
      const reason = event.data?.reason;
      switch (reason?.kind) {
        case "completed":
          return "turn-end-completed";
        case "error":
        case "max-tokens":
          return "turn-end-error";
        case "aborted":
          return reason.reason?.kind === "user" ? "turn-end-cancelled" : void 0;
        default:
          return void 0;
      }
    }
    case "tool/call":
      return "tool-call";
    case "tool/result":
      return event.data?.error !== void 0 ? "tool-result-fail" : "tool-result-ok";
    case "user/message":
      return event.data?.source?.kind === "user" ? "user-message" : void 0;
    case "approval/asked":
      return "approval-request";
    default:
      return void 0;
  }
}
function wireLayerB(sessions, engine) {
  const cleanups = /* @__PURE__ */ new Map();
  const disposeTracker = trackSessions(sessions, {
    onAdded(binding) {
      const source = binding.eventSource;
      let lastSeq = -1;
      const push = () => {
        const snapshot = source.getSnapshot();
        if (snapshot === void 0) {
          return;
        }
        const { kind, entries } = snapshot.change;
        if (kind === "replace") {
          for (const entry of entries) {
            if (entry.type !== "event" || entry.event === void 0) continue;
            lastSeq = Math.max(lastSeq, entry.event.seq);
          }
          return;
        }
        if (kind !== "append") {
          return;
        }
        for (const entry of entries) {
          if (entry.type !== "event" || entry.event === void 0) continue;
          const seq = entry.event.seq;
          if (seq <= lastSeq) continue;
          lastSeq = seq;
          const event = journalToEvent(entry.event);
          if (event !== void 0) void engine.play(event);
        }
      };
      const detach = source.subscribe(push);
      push();
      cleanups.set(binding.sessionId, () => {
        detach();
      });
    },
    onRemoved(sessionId) {
      cleanups.get(sessionId)?.();
      cleanups.delete(sessionId);
    }
  });
  return () => {
    disposeTracker();
    for (const cleanup of cleanups.values()) cleanup();
    cleanups.clear();
  };
}

// src/client/wiring/layer-c.ts
function wireConnection(state, engine) {
  let last;
  let everConnected = false;
  const push = () => {
    const next = state.getSnapshot();
    if (next === last) return;
    last = next;
    if (next === "connecting") {
      if (everConnected) void engine.play("reconnecting");
      return;
    }
    if (next === "connected") {
      if (everConnected) void engine.play("reconnected");
      everConnected = true;
    }
  };
  const detach = state.subscribe(push);
  push();
  return detach;
}
function diffJobs(state, jobs) {
  const completed = [];
  const failed = [];
  const present = /* @__PURE__ */ new Set();
  for (const job of jobs) {
    present.add(job.id);
    const prev = state.seen.get(job.id);
    if (prev === void 0) {
      if (job.status === "running" || job.status === "stopping") state.seen.set(job.id, job.status);
      continue;
    }
    if (job.status === "completed") {
      completed.push(job.id);
      state.seen.delete(job.id);
    } else if (job.status === "failed") {
      failed.push(job.id);
      state.seen.delete(job.id);
    } else if (job.status === "killed") {
      state.seen.delete(job.id);
    } else {
      state.seen.set(job.id, job.status);
    }
  }
  for (const id of [...state.seen.keys()]) {
    if (!present.has(id)) state.seen.delete(id);
  }
  return { completed, failed };
}
function wireLayerC(sessions, engine) {
  const jobState = { seen: /* @__PURE__ */ new Map() };
  const disposeTracker = trackSessions(sessions, {
    onAdded(_binding, initial) {
      if (!initial) void engine.play("session-added");
    },
    onRemoved() {
      void engine.play("session-removed");
    }
  });
  const jobsListener = () => {
    const snapshot = sessions.list.getSnapshot();
    const jobs = Object.values(snapshot.jobsBySession ?? {}).flat();
    const report = diffJobs(jobState, jobs);
    for (const _ of report.completed) void engine.play("jobs-completed");
    for (const _ of report.failed) void engine.play("jobs-failed");
  };
  const detachList = sessions.list.subscribe(jobsListener);
  jobsListener();
  return () => {
    disposeTracker();
    detachList();
  };
}

// src/client/settings/row.ts
var OWN_ROW_CLASS = "kachi-row";
var OWN_ROW_SELECTOR = `.${OWN_ROW_CLASS}`;

// src/client/wiring/interaction.ts
var TRIGGER_SELECTOR = '[aria-haspopup="menu"],[aria-haspopup="listbox"]';
var MENU_SELECTOR = '[role="menu"],[role="listbox"]';
var ITEM_SELECTOR = '[role="menuitem"],[role="menuitemradio"],[role="option"]';
var BUTTON_SELECTOR = 'button,[role="button"]';
var MENU_DIFF_DELAY_MS = 50;
var SEAT_SELECTOR = "[data-composer-seat]";
var UI_TARGET_SELECTOR = 'button,[role="button"],[role="treeitem"]';
var OPEN_SUPPRESS_MS = 150;
function createInteractionSound(deps) {
  let openedAt = Number.NEGATIVE_INFINITY;
  let lastEntered = null;
  let lastMoved = null;
  let pressedItem = null;
  let lastUi = null;
  let pressedUi = null;
  let suppressUiClick = false;
  function moveSound(target) {
    if (target === lastMoved) return;
    lastMoved = target;
    deps.play("menu-move");
  }
  function uiMoveSound(target) {
    if (target === lastUi) return;
    lastUi = target;
    if (target === null) return;
    deps.play("ui-hover");
  }
  return {
    menuOpen(expandedBefore) {
      if (expandedBefore) {
        deps.play("menu-close");
        return;
      }
      openedAt = deps.now();
      lastEntered = null;
      lastMoved = null;
      pressedItem = null;
      pressedUi = null;
      deps.play("menu-open");
    },
    itemHover(item) {
      if (item === lastEntered) return;
      lastEntered = item;
      if (item === null) {
        lastMoved = null;
        return;
      }
      if (deps.now() - openedAt < OPEN_SUPPRESS_MS) return;
      moveSound(item);
    },
    pressItem(item) {
      pressedItem = item;
      suppressUiClick = false;
    },
    itemFocus(item) {
      if (item !== null && item === pressedItem) {
        pressedItem = null;
        return;
      }
      moveSound(item);
    },
    pressOutside(location, menuInDom) {
      if (!menuInDom || location.onTrigger || location.insideMenu) return;
      suppressUiClick = true;
      deps.play("menu-close");
    },
    escape(menuInDom) {
      if (menuInDom) deps.play("menu-close");
    },
    itemClick() {
      deps.play("menu-item-click");
    },
    menuDiff(before, after) {
      if (after) deps.play("menu-open");
      else if (before) deps.play("menu-close");
    },
    pressUi(target) {
      pressedUi = target;
    },
    uiHover(target) {
      uiMoveSound(target);
    },
    uiFocus(target) {
      if (target !== null && target === pressedUi) {
        pressedUi = null;
        return;
      }
      uiMoveSound(target);
    },
    uiClick() {
      if (suppressUiClick) {
        suppressUiClick = false;
        return;
      }
      deps.play("ui-click");
    }
  };
}
function wireInteraction(doc, engine) {
  const sound = createInteractionSound({
    play: (event) => {
      void engine.play(event);
    },
    now: () => performance.now()
  });
  const asElement = (target) => target instanceof Element ? target : null;
  const inSeat = (el) => el !== null && el.closest(SEAT_SELECTOR) !== null ? el : null;
  const genericButton = (target) => {
    const btn = target.closest(UI_TARGET_SELECTOR);
    if (btn === null) return null;
    if (btn.closest(MENU_SELECTOR) !== null || btn.closest(OWN_ROW_SELECTOR) !== null) return null;
    return btn;
  };
  const menuAlive = () => [...doc.querySelectorAll(MENU_SELECTOR)].some((menu) => menu.checkVisibility?.() ?? true);
  let diffTimer;
  const scheduleMenuDiff = () => {
    const before = menuAlive();
    if (diffTimer !== void 0) clearTimeout(diffTimer);
    diffTimer = setTimeout(() => {
      diffTimer = void 0;
      sound.menuDiff(before, menuAlive());
    }, MENU_DIFF_DELAY_MS);
  };
  const onClick = (e) => {
    const target = asElement(e.target);
    if (target === null) return;
    if (target.closest(ITEM_SELECTOR) !== null) {
      sound.itemClick();
      return;
    }
    const trigger = target.closest(TRIGGER_SELECTOR);
    if (trigger !== null) {
      const expandedBefore = trigger.getAttribute("aria-expanded") === "true";
      sound.menuOpen(expandedBefore);
      return;
    }
    if (inSeat(target.closest(BUTTON_SELECTOR)) !== null) {
      scheduleMenuDiff();
      return;
    }
    if (genericButton(target) !== null) {
      sound.uiClick();
    }
  };
  const onPress = (e) => {
    const target = asElement(e.target);
    if (target === null) return;
    const location = {
      // 座席内无标记按钮(含胶囊)的开关由菜单差分发声,点外取消音豁免它们防双响。
      onTrigger: target.closest(TRIGGER_SELECTOR) !== null || inSeat(target.closest(BUTTON_SELECTOR)) !== null,
      insideMenu: target.closest(MENU_SELECTOR) !== null
    };
    sound.pressItem(target.closest(ITEM_SELECTOR));
    sound.pressUi(genericButton(target));
    sound.pressOutside(location, menuAlive());
  };
  const onHover = (e) => {
    const target = asElement(e.target);
    if (target === null) return;
    const item = target.closest(ITEM_SELECTOR);
    if (item !== null) {
      sound.itemHover(item);
      return;
    }
    if (target.closest(MENU_SELECTOR) !== null) return;
    sound.uiHover(genericButton(target));
  };
  const onFocus = (e) => {
    const target = asElement(e.target);
    if (target === null) return;
    const item = target.closest(ITEM_SELECTOR);
    if (item !== null) {
      sound.itemFocus(item);
      return;
    }
    if (target.closest(MENU_SELECTOR) !== null) return;
    sound.uiFocus(genericButton(target));
  };
  const onKey = (e) => {
    if (e.key !== "Escape") return;
    sound.escape(menuAlive());
  };
  doc.addEventListener("click", onClick, { capture: true, passive: true });
  doc.addEventListener("pointerdown", onPress, { capture: true, passive: true });
  doc.addEventListener("mouseover", onHover, { passive: true });
  doc.addEventListener("focusin", onFocus, { passive: true });
  doc.addEventListener("keydown", onKey, { passive: true });
  return () => {
    doc.removeEventListener("click", onClick, { capture: true });
    doc.removeEventListener("pointerdown", onPress, { capture: true });
    doc.removeEventListener("mouseover", onHover);
    doc.removeEventListener("focusin", onFocus);
    doc.removeEventListener("keydown", onKey);
    if (diffTimer !== void 0) clearTimeout(diffTimer);
  };
}

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

// src/client/settings/controller.ts
function createSettingsController(scope) {
  let optimistic = {};
  const listeners = /* @__PURE__ */ new Set();
  function derive() {
    const snapshot = scope.getSnapshot();
    const value = snapshot.value;
    const base = value === void 0 || typeof value !== "object" ? DEFAULT_SETTINGS : { ...DEFAULT_SETTINGS, ...value };
    return { ...base, ...optimistic };
  }
  let cache = derive();
  const notify = () => {
    cache = derive();
    for (const listener of [...listeners]) listener();
  };
  const detach = scope.subscribe(notify);
  return {
    getSnapshot() {
      return cache;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(field, value) {
      optimistic = { ...optimistic, [field]: value };
      notify();
      void scope.set(field, value).catch(() => {
      });
    }
  };
}
function bindKachiSettings(bind) {
  return createSettingsController(bind({ namespace: SETTINGS_NAMESPACE }));
}

// src/client/settings/policy.ts
function applyKachiSettings(settings, target) {
  target.setEnabled(settings.enabled);
  target.setMasterVolume(settings.masterVolume);
  target.setThrottleMs(settings.throttleMs);
  for (const slot of SLOT_IDS) {
    const volume = settings.slotVolumes[slot];
    if (volume !== void 0) target.setSlotVolume(slot, volume);
    const file = settings.slotSounds[slot];
    if (file !== void 0 && file !== target.currentFile(slot)) target.setSlotSound(slot, file);
  }
}
function shouldPlayBoot(settings) {
  return settings.enabled && settings.bootSound;
}

// src/client/settings/settings-ui.tsx
var import_react = require("react");

// src/client/pack-manifest.json
var pack_manifest_default = [{ file: "EntAlbum.wav", dur: 0.07, bytes: 6464 }, { file: "EntController.wav", dur: 0.03, bytes: 3082 }, { file: "EntFlc.wav", dur: 0.09, bytes: 9116 }, { file: "EntMypage.wav", dur: 0.04, bytes: 3940 }, { file: "EntNews.wav", dur: 0.76, bytes: 72988 }, { file: "EntNso.wav", dur: 0.11, bytes: 10650 }, { file: "EntSet.wav", dur: 0.02, bytes: 1808 }, { file: "EntShop.wav", dur: 0.01, bytes: 920 }, { file: "EntSplay.wav", dur: 0.15, bytes: 14250 }, { file: "EntVgc.wav", dur: 0.07, bytes: 7086 }, { file: "SeAccountDecide.wav", dur: 0, bytes: 188 }, { file: "SeAccountFocus.wav", dur: 0, bytes: 312 }, { file: "SeAlbumBtnFocus.wav", dur: 0, bytes: 346 }, { file: "SeAppletBtnFocus.wav", dur: 0.05, bytes: 5300 }, { file: "SeAppletGrayBtnFocus.wav", dur: 0.73, bytes: 140804 }, { file: "SeBatteryRateIn.wav", dur: 0.09, bytes: 9116 }, { file: "SeBatteryRateOut.wav", dur: 0.11, bytes: 10650 }, { file: "SeBodyInHighlight.wav", dur: 0.03, bytes: 3092 }, { file: "SeBtnDecide.wav", dur: 0.05, bytes: 5300 }, { file: "SeBtnDecideRepeat.wav", dur: 0.7, bytes: 134548 }, { file: "SeBtnFocus.wav", dur: 0.73, bytes: 140804 }, { file: "SeBtnPreDecide.wav", dur: 0.01, bytes: 1138 }, { file: "SeCheckBtnPress.wav", dur: 0, bytes: 234 }, { file: "SeCheckBtnPressFinish.wav", dur: 0.09, bytes: 8236 }, { file: "SeCheckboxFocus.wav", dur: 0.09, bytes: 8236 }, { file: "SeCheckboxOff.wav", dur: 0.05, bytes: 5302 }, { file: "SeCheckboxOn.wav", dur: 0.1, bytes: 9644 }, { file: "SeChildMoonComplete.wav", dur: 0.03, bytes: 3298 }, { file: "SeCntStickCheckCenter.wav", dur: 0, bytes: 188 }, { file: "SeCntStickCheckOut.wav", dur: 0, bytes: 312 }, { file: "SeCntStickSeq.wav", dur: 0, bytes: 472 }, { file: "SeDeviceFound_Dtt.wav", dur: 0.82, bytes: 78938 }, { file: "SeDialogOpen.wav", dur: 0.03, bytes: 3092 }, { file: "SeDialogOpen_Accent.wav", dur: 0.8, bytes: 76844 }, { file: "SeDialogParentalControllOn.wav", dur: 1, bytes: 96044 }, { file: "SeDialogPtclRating.wav", dur: 1, bytes: 96038 }, { file: "SeEntChildLockGuideIn.wav", dur: 0.03, bytes: 3082 }, { file: "SeEntLaunchEffect.wav", dur: 0.02, bytes: 1808 }, { file: "SeEntLaunchEffectHome.wav", dur: 0.07, bytes: 6464 }, { file: "SeEntSpeacialNewsBalloonAppear.wav", dur: 0.09, bytes: 9116 }, { file: "SeFlcGroupAdd.wav", dur: 0.03, bytes: 3298 }, { file: "SeFlcGroupDelete.wav", dur: 0.08, bytes: 6992 }, { file: "SeFlcIconDecide.wav", dur: 0.01, bytes: 920 }, { file: "SeFlcIconFloat.wav", dur: 0.8, bytes: 76844 }, { file: "SeFlcIconLoaded.wav", dur: 0.03, bytes: 3082 }, { file: "SeFlcIconLoadedInner.wav", dur: 0.07, bytes: 6464 }, { file: "SeFlcIconMove.wav", dur: 0.03, bytes: 3092 }, { file: "SeFlcIconSink.wav", dur: 0.82, bytes: 78938 }, { file: "SeFooterDecideBack.wav", dur: 0.09, bytes: 9116 }, { file: "SeFooterDecideFinish.wav", dur: 0.11, bytes: 10650 }, { file: "SeFooterFocus.wav", dur: 0.01, bytes: 920 }, { file: "SeFullLancherBtnFocus.wav", dur: 0.7, bytes: 134548 }, { file: "SeGameIconAdd.wav", dur: 0.07, bytes: 7066 }, { file: "SeGameIconCardInsert.wav", dur: 0.05, bytes: 5302 }, { file: "SeGameIconDecide.wav", dur: 0, bytes: 234 }, { file: "SeGameIconDecideSupend.wav", dur: 0.09, bytes: 8236 }, { file: "SeGameIconEffect.wav", dur: 0.1, bytes: 9644 }, { file: "SeGameIconFocus.wav", dur: 0.11, bytes: 10494 }, { file: "SeGameIconLimit.wav", dur: 0.15, bytes: 14250 }, { file: "SeGameIconScroll.wav", dur: 0.04, bytes: 3940 }, { file: "SeGameIconSplayPict.wav", dur: 11.19, bytes: 1074136 }, { file: "SeGiftProgressBarComplete.wav", dur: 0, bytes: 312 }, { file: "SeGiftReceive.wav", dur: 0, bytes: 346 }, { file: "SeGiftSend.wav", dur: 0, bytes: 472 }, { file: "SeGiftSystemNameAppear.wav", dur: 0, bytes: 188 }, { file: "SeHelpBtnFocus.wav", dur: 0.05, bytes: 5300 }, { file: "SeIconFloat.wav", dur: 0.01, bytes: 920 }, { file: "SeIconMove.wav", dur: 0.11, bytes: 10650 }, { file: "SeIconSink.wav", dur: 0.09, bytes: 9116 }, { file: "SeInsertError.wav", dur: 0, bytes: 188 }, { file: "SeInsertTimer.wav", dur: 0, bytes: 312 }, { file: "SeKeyError.wav", dur: 0.03, bytes: 3082 }, { file: "SeKeyErrorCursor.wav", dur: 0, bytes: 472 }, { file: "SeKeyErrorScroll.wav", dur: 0, bytes: 346 }, { file: "SeKeyErrorTouch.wav", dur: 0.73, bytes: 140804 }, { file: "SeKeyRecieved.wav", dur: 0.7, bytes: 134548 }, { file: "SeMeter.wav", dur: 0, bytes: 346 }, { file: "SeMeterKeyDecide.wav", dur: 0.73, bytes: 140804 }, { file: "SeMigCompleteIn.wav", dur: 0, bytes: 472 }, { file: "SeMigCompleteOut.wav", dur: 0, bytes: 346 }, { file: "SeMigReadyIn.wav", dur: 0, bytes: 188 }, { file: "SeMigReadyOut.wav", dur: 0, bytes: 312 }, { file: "SeMypageBtnFocus.wav", dur: 0.01, bytes: 1138 }, { file: "SeNaviDecide.wav", dur: 0, bytes: 472 }, { file: "SeNaviFocus.wav", dur: 0, bytes: 312 }, { file: "SeNetTest_01.wav", dur: 0.04, bytes: 3940 }, { file: "SeNetTest_02.wav", dur: 0.76, bytes: 72988 }, { file: "SeNetTest_03.wav", dur: 0.02, bytes: 1808 }, { file: "SeNetTest_04.wav", dur: 0.07, bytes: 6464 }, { file: "SeNetTest_05.wav", dur: 0.03, bytes: 3082 }, { file: "SeNewsBad.wav", dur: 0.7, bytes: 134548 }, { file: "SeNewsBookmark.wav", dur: 0.09, bytes: 8236 }, { file: "SeNewsBtnFocus.wav", dur: 0, bytes: 312 }, { file: "SeNewsChannelCancel.wav", dur: 0, bytes: 234 }, { file: "SeNewsChannelRegister.wav", dur: 0.11, bytes: 10494 }, { file: "SeNewsNice.wav", dur: 0.05, bytes: 5300 }, { file: "SeNewsUncheck.wav", dur: 0.01, bytes: 1138 }, { file: "SeNsoBtnFocus.wav", dur: 0, bytes: 188 }, { file: "SeNtfBtnDecide.wav", dur: 0, bytes: 346 }, { file: "SeNtfBtnFocus.wav", dur: 0, bytes: 472 }, { file: "SeNtfInImage.wav", dur: 0, bytes: 312 }, { file: "SeNtfInImageInner.wav", dur: 0, bytes: 188 }, { file: "SeOptPointGet.wav", dur: 0, bytes: 188 }, { file: "SePage.wav", dur: 0.73, bytes: 140804 }, { file: "SeRadioBtnFocus.wav", dur: 0.07, bytes: 7066 }, { file: "SeRadioBtnOn.wav", dur: 0.04, bytes: 3940 }, { file: "SeRefreshIn.wav", dur: 0.02, bytes: 1808 }, { file: "SeRefreshOut.wav", dur: 0.76, bytes: 72988 }, { file: "SeSaveBackupChecked.wav", dur: 0.07, bytes: 7086 }, { file: "SeSelectCheck.wav", dur: 0.8, bytes: 76844 }, { file: "SeSelectFocus.wav", dur: 0.15, bytes: 14250 }, { file: "SeSelectUncheck.wav", dur: 0.82, bytes: 78938 }, { file: "SeSetNaviFocus.wav", dur: 0.07, bytes: 7066 }, { file: "SeSetStickPush.wav", dur: 0.1, bytes: 9644 }, { file: "SeShopBtnFocus.wav", dur: 0, bytes: 472 }, { file: "SeSliderFocus.wav", dur: 0.76, bytes: 72988 }, { file: "SeSliderRelease.wav", dur: 0.07, bytes: 6464 }, { file: "SeSliderTickOver.wav", dur: 0.02, bytes: 1808 }, { file: "SeStartVgc.wav", dur: 0.44, bytes: 42376 }, { file: "SeSuccess.wav", dur: 0.11, bytes: 10494 }, { file: "SeSurroundTest.wav", dur: 0.05, bytes: 5300 }, { file: "SeSurroundTestSw.wav", dur: 0.7, bytes: 134548 }, { file: "SeTestTone.wav", dur: 0.07, bytes: 7086 }, { file: "SeToggleBtnFocus.wav", dur: 0.01, bytes: 1138 }, { file: "SeToggleBtnOff.wav", dur: 0, bytes: 234 }, { file: "SeToggleBtnOn.wav", dur: 0.11, bytes: 10494 }, { file: "SeTouch.wav", dur: 0, bytes: 312 }, { file: "SeTouchCheck.wav", dur: 0.05, bytes: 5302 }, { file: "SeTouchInner.wav", dur: 0, bytes: 188 }, { file: "SeTouchUnfocus.wav", dur: 0, bytes: 346 }, { file: "SeUnlock.wav", dur: 0.05, bytes: 5300 }, { file: "SeUnlockFocusTouch.wav", dur: 0.73, bytes: 140804 }, { file: "SeUnlockHome.wav", dur: 0.04, bytes: 3940 }, { file: "SeUnlockKeyL.wav", dur: 0.7, bytes: 134548 }, { file: "SeUnlockKeyR.wav", dur: 0.01, bytes: 1138 }, { file: "SeUnlockKeyZL.wav", dur: 0.11, bytes: 10494 }, { file: "SeUnlockKeyZR.wav", dur: 0, bytes: 234 }, { file: "SeUnlockMinus.wav", dur: 0.07, bytes: 7066 }, { file: "SeUnlockPlus.wav", dur: 0.05, bytes: 5302 }, { file: "SeUnlockReset.wav", dur: 0.76, bytes: 72988 }, { file: "SeUnlockStickL.wav", dur: 0.09, bytes: 8236 }, { file: "SeUnlockStickR.wav", dur: 0.1, bytes: 9644 }, { file: "SeUnlockTimeout.wav", dur: 0.01, bytes: 920 }, { file: "SeVgcBtnCard_Check.wav", dur: 0.01, bytes: 1138 }, { file: "SeVgcBtnCard_Decide.wav", dur: 0.7, bytes: 134548 }, { file: "SeVgcBtnCard_Invalid_Select.wav", dur: 0, bytes: 346 }, { file: "SeVgcBtnCard_Loaded.wav", dur: 0, bytes: 312 }, { file: "SeVgcBtnCard_Loaded_Inner.wav", dur: 0, bytes: 188 }, { file: "SeVgcBtnCard_Reserved_Invalid_Select.wav", dur: 0.05, bytes: 5300 }, { file: "SeVgcBtnCard_Reserved_Select.wav", dur: 0.73, bytes: 140804 }, { file: "SeVgcBtnCard_Select.wav", dur: 0, bytes: 472 }, { file: "SeVgcBtnCard_Uncheck.wav", dur: 0.11, bytes: 10494 }, { file: "SeVgcCard_Appear_01.wav", dur: 0.07, bytes: 7066 }, { file: "SeVgcCard_Appear_02.wav", dur: 0.04, bytes: 3940 }, { file: "SeVgcCard_Appear_03.wav", dur: 0.76, bytes: 72988 }, { file: "SeVgcCard_Appear_04.wav", dur: 0.02, bytes: 1808 }, { file: "SeVgcCard_Eject.wav", dur: 0.82, bytes: 78938 }, { file: "SeVgcCard_Eject_Start.wav", dur: 0.8, bytes: 76844 }, { file: "SeVgcCard_Eject_Start_Wait.wav", dur: 0.15, bytes: 14250 }, { file: "SeVgcCard_Insert.wav", dur: 0.07, bytes: 7086 }, { file: "SeVgcCard_Insert_Others.wav", dur: 0.11, bytes: 10650 }, { file: "SeVgcCard_Insert_Start.wav", dur: 0.01, bytes: 920 }, { file: "SeVgcCard_Insert_Start_Others.wav", dur: 0.09, bytes: 9116 }, { file: "SeVgcCard_Leave.wav", dur: 0.1, bytes: 9644 }, { file: "SeVgcCard_Leave_Short.wav", dur: 0.05, bytes: 5302 }, { file: "SeVgcCard_Move.wav", dur: 0.08, bytes: 6992 }, { file: "SeVgcCard_Move_Insert.wav", dur: 0.03, bytes: 3082 }, { file: "SeVgcCard_Move_Insert_2.wav", dur: 0.07, bytes: 6464 }, { file: "SeVgcCard_Move_Mine.wav", dur: 0.03, bytes: 3298 }, { file: "SeVgcCard_Move_Others.wav", dur: 0.03, bytes: 3092 }, { file: "SeVgcCard_Overlap.wav", dur: 0, bytes: 234 }, { file: "SeVgcCard_Overlap_Short.wav", dur: 0.09, bytes: 8236 }, { file: "SeVgcCard_Status_Eject.wav", dur: 0.11, bytes: 10564 }, { file: "SeVgcCard_Status_FamilyLend.wav", dur: 0.33, bytes: 31304 }, { file: "SeVgcCard_Status_FamilyReturn.wav", dur: 0.41, bytes: 39360 }, { file: "SeVgcCard_Status_Insert.wav", dur: 0.13, bytes: 12706 }, { file: "SeVgcCard_Status_Invisible.wav", dur: 0.13, bytes: 12476 }, { file: "SeVgcCard_Status_Visible.wav", dur: 0.11, bytes: 10692 }, { file: "SeVgc_Connect.wav", dur: 1, bytes: 96038 }, { file: "SeVgc_Connect_Recieve.wav", dur: 0.44, bytes: 42376 }, { file: "SeVgc_Deleted.wav", dur: 0.17, bytes: 15970 }, { file: "SeVgc_Dialog_Check.wav", dur: 0.5, bytes: 48044 }, { file: "SeVgc_Error.wav", dur: 0.99, bytes: 189320 }, { file: "SeVgc_FamilyReturn.wav", dur: 0.1, bytes: 9436 }, { file: "SeVgc_Found_Device.wav", dur: 11.19, bytes: 1074136 }, { file: "SeVgc_Info_OperateOthers.wav", dur: 0.05, bytes: 4904 }, { file: "SeVgc_Paring_Fix.wav", dur: 1, bytes: 96044 }, { file: "SeVgc_Paring_Guide.wav", dur: 1.23, bytes: 118046 }, { file: "SeVgc_RefreshIn.wav", dur: 0.01, bytes: 1324 }, { file: "SeWaiting.wav", dur: 0.07, bytes: 7086 }, { file: "SeWarning.wav", dur: 0.01, bytes: 1138 }, { file: "SeWarning_Dtt.wav", dur: 0.15, bytes: 14250 }, { file: "Se_EntLockBackMain.wav", dur: 0, bytes: 312 }, { file: "Se_EntLockBackNews.wav", dur: 0, bytes: 188 }, { file: "Se_EntLockInMain.wav", dur: 0, bytes: 346 }, { file: "Se_EntLockInNews.wav", dur: 0, bytes: 472 }, { file: "StartupAlbum.wav", dur: 0.7, bytes: 134548 }, { file: "StartupController.wav", dur: 0.01, bytes: 1138 }, { file: "StartupFlc.wav", dur: 0.07, bytes: 7066 }, { file: "StartupMenu_Applet.wav", dur: 0, bytes: 472 }, { file: "StartupMenu_Ent.wav", dur: 0, bytes: 188 }, { file: "StartupMenu_Game.wav", dur: 0, bytes: 312 }, { file: "StartupMypage.wav", dur: 0, bytes: 346 }, { file: "StartupNews.wav", dur: 0.73, bytes: 140804 }, { file: "StartupNso.wav", dur: 0, bytes: 234 }, { file: "StartupSet.wav", dur: 0.05, bytes: 5300 }, { file: "StartupShop.wav", dur: 0.11, bytes: 10494 }, { file: "StartupSleep.wav", dur: 0.05, bytes: 5302 }, { file: "StartupSplay.wav", dur: 0.09, bytes: 8236 }, { file: "StartupVgc.wav", dur: 0.1, bytes: 9644 }, { file: "none.wav", dur: 0, bytes: 188 }];

// src/client/settings/settings-ui.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var PACK = pack_manifest_default;
var styleInjected = false;
function ensureStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement("style");
  style.textContent = [
    `.${OWN_ROW_CLASS}{display:flex;flex-direction:column;gap:10px;padding:10px 0;font:13px/1.5 system-ui,sans-serif;}`,
    ".kachi-title{font-weight:600;}",
    ".kachi-field{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}",
    ".kachi-field .kachi-name{min-width:72px;color:var(--dsw-text-secondary, #888);}",
    ".kachi-val{min-width:42px;text-align:right;font-variant-numeric:tabular-nums;}",
    ".kachi-slot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}",
    ".kachi-slotname{min-width:72px;font-weight:500;}",
    ".kachi-slot select{max-width:230px;}",
    ".kachi-slot .kachi-val{min-width:36px;}"
  ].join("\n");
  document.head.append(style);
}
function GeneralRow({ settings, click }) {
  ensureStyle();
  const settingsView = (0, import_react.useSyncExternalStore)(settings.subscribe, settings.getSnapshot);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: OWN_ROW_CLASS, onClick: click, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "kachi-field", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "input",
        {
          type: "checkbox",
          checked: settingsView.enabled,
          onChange: (e) => settings.set("enabled", e.target.checked)
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kachi-title", children: "\u542F\u7528 Switch \u97F3\u6548(dsh-kachi)" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kachi-field", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kachi-name", children: "\u603B\u97F3\u91CF" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "input",
        {
          type: "range",
          min: 0,
          max: 100,
          value: settingsView.masterVolume,
          onChange: (e) => settings.set("masterVolume", Number(e.target.value))
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "kachi-val", children: [
        settingsView.masterVolume,
        "%"
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kachi-field", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "kachi-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "checkbox",
            checked: settingsView.bootSound,
            onChange: (e) => settings.set("bootSound", e.target.checked)
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u5F00\u673A\u97F3" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kachi-name", children: "\u8282\u6D41\u7A97" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "input",
        {
          type: "number",
          min: 0,
          max: 2e3,
          step: 50,
          value: settingsView.throttleMs,
          onChange: (e) => settings.set("throttleMs", Math.max(0, Number(e.target.value) || 0))
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "ms(\u540C\u7C7B\u97F3\u6548\u53BB\u91CD)" })
    ] })
  ] });
}
function durLabel(dur) {
  return dur === null ? "" : dur < 0.1 ? `(<0.1s)` : `(${dur.toFixed(2)}s)`;
}
function SlotsRow({ settings, preview, click }) {
  ensureStyle();
  const settingsView = (0, import_react.useSyncExternalStore)(settings.subscribe, settings.getSnapshot);
  const setSlotSound = (slot, file) => {
    settings.set("slotSounds", { ...settingsView.slotSounds, [slot]: file });
    preview(file);
  };
  const setSlotVolume = (slot, percent) => {
    settings.set("slotVolumes", { ...settingsView.slotVolumes, [slot]: percent });
  };
  const previewSlot = (slot) => {
    const file = settingsView.slotSounds[slot];
    if (file !== void 0) preview(file);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: OWN_ROW_CLASS, onClick: click, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kachi-title", children: "\u97F3\u6548\u69FD\u4F4D(\u9009\u97F3 / \u8BD5\u542C / \u97F3\u91CF;\u6807\u6CE8\u65F6\u957F,\u9009\u97F3\u987B\u8BED\u4E49\u4E0E\u65F6\u957F \u22650.1s \u517C\u987E)" }),
    SLOT_IDS.map((slot) => {
      const current = settingsView.slotSounds[slot] ?? "";
      const volume = settingsView.slotVolumes[slot] ?? 100;
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "kachi-slot", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "kachi-slotname", children: SLOT_LABELS[slot] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { value: current, onChange: (e) => setSlotSound(slot, e.target.value), children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("optgroup", { label: "\u9ED8\u8BA4(13 \u69FD\u4F4D)", children: SLOT_IDS.map((s) => {
            const def = DEFAULT_SLOT_SOUNDS[s];
            return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", { value: def, children: [
              SLOT_LABELS[s],
              " \xB7 ",
              def
            ] }, s);
          }) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("optgroup", { label: `\u5168\u5305(${PACK.length})`, children: PACK.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", { value: entry.file, children: [
            entry.file,
            " ",
            durLabel(entry.dur)
          ] }, entry.file)) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => previewSlot(slot), children: "\u8BD5\u542C" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "range",
            min: 0,
            max: 100,
            value: volume,
            onChange: (e) => setSlotVolume(slot, Number(e.target.value))
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "kachi-val", children: [
          volume,
          "%"
        ] })
      ] }, slot);
    })
  ] });
}

// src/client/index.ts
var inject = ["sessions", "settingsScope", "slots", "locale", "remote", "connection"];
function apply(ctx) {
  const engine = createEngine({ createContext: () => new AudioContext() });
  const controller = bindKachiSettings((spec) => ctx.settingsScope.bind(spec));
  const injectFace = {
    settings: controller,
    preview: (file) => {
      void engine.preview(toSlotFile(file));
    },
    // 自家注入组件点击 → 按键音(SPEC §5 行 18)。
    click: () => {
      void engine.play("own-click");
    }
  };
  const settingsTarget = {
    setEnabled: (enabled) => engine.setEnabled(enabled),
    setMasterVolume: (percent) => engine.setMasterVolume(percent),
    setThrottleMs: (ms) => engine.setThrottleMs(ms),
    setSlotVolume: (slot, percent) => engine.setSlotVolume(slot, percent),
    setSlotSound: (slot, file) => {
      void engine.setSlotSound(slot, toSlotFile(file));
    },
    currentFile: (slot) => engine.currentSlotFile(slot)
  };
  ctx.effect(
    () => {
      const detach = controller.subscribe(() => applyKachiSettings(controller.getSnapshot(), settingsTarget));
      applyKachiSettings(controller.getSnapshot(), settingsTarget);
      return detach;
    },
    "dsh-kachi: settings apply"
  );
  const removeUnlock = installUnlock(window, async () => {
    const ok = await engine.unlock();
    if (ok) {
      removeHint();
      if (shouldPlayBoot(controller.getSnapshot())) void engine.play("boot");
      return true;
    }
    notifyFallback();
    return false;
  });
  ctx.effect(() => ctx.locale.register("dsh-kachi", { zh: { title: "Switch \u97F3\u6548" }, en: { title: "Switch sounds" } }), "dsh-kachi: dictionaries");
  ctx.effect(() => wireLayerA(ctx.remote, engine), "dsh-kachi: remote event wiring");
  ctx.effect(() => wireLayerB(ctx.sessions, engine), "dsh-kachi: journal wiring");
  ctx.effect(() => wireLayerC(ctx.sessions, engine), "dsh-kachi: lifecycle wiring");
  ctx.effect(() => wireConnection(ctx.connection.state, engine), "dsh-kachi: connection wiring");
  ctx.effect(() => wireInteraction(window.document, engine), "dsh-kachi: interaction wiring");
  const settingsUIDisposers = [
    ctx.slots.inject(
      "settings.general.item",
      () => ctx.slots.register(
        { name: "settings.general.item", id: "dsh-kachi-general", order: 60, locale: "dsh-kachi", inject: () => injectFace },
        GeneralRow
      )
    ),
    ctx.slots.inject(
      "settings.general.item",
      () => ctx.slots.register(
        { name: "settings.general.item", id: "dsh-kachi-slots", order: 61, locale: "dsh-kachi", inject: () => injectFace },
        SlotsRow
      )
    )
  ];
  ctx.effect(
    () => () => {
      removeUnlock();
      removeHint();
      for (const dispose of settingsUIDisposers) dispose();
      engine.dispose();
    },
    "dsh-kachi: engine lifecycle"
  );
}
var HINT_ID = "dsh-kachi-unlock-hint";
var hintShown = false;
var notified = false;
function notifyFallback() {
  showHint();
  if (notified) return;
  notified = true;
  try {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted") {
      new Notification("dsh-kachi \u97F3\u6548\u672A\u542F\u7528", { body: "\u70B9\u51FB dsh \u9875\u9762\u4EFB\u610F\u5904\u4EE5\u89E3\u9501 Switch \u97F3\u6548\u3002" });
    } else if (Notification.permission === "default") {
      void Notification.requestPermission().then((p) => {
        if (p === "granted") new Notification("dsh-kachi \u97F3\u6548\u672A\u542F\u7528", { body: "\u70B9\u51FB dsh \u9875\u9762\u4EFB\u610F\u5904\u4EE5\u89E3\u9501 Switch \u97F3\u6548\u3002" });
      }).catch(() => {
      });
    }
  } catch {
  }
}
function showHint() {
  if (hintShown || typeof document === "undefined") return;
  hintShown = true;
  const style = document.createElement("style");
  style.textContent = "#dsh-kachi-unlock-hint{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483000;padding:6px 14px;border-radius:8px;background:rgba(30,30,34,.88);color:#f4f4f6;font:13px/1.5 system-ui,sans-serif;pointer-events:none;}";
  const hint = document.createElement("div");
  hint.id = HINT_ID;
  hint.textContent = "\u70B9\u6309\u9875\u9762\u4EFB\u610F\u5904\u4EE5\u542F\u7528 Switch \u97F3\u6548(dsh-kachi)";
  document.head.append(style);
  document.body.append(hint);
}
function removeHint() {
  document.getElementById(HINT_ID)?.remove();
  hintShown = false;
}
return module.exports; } });
//# sourceMappingURL=client.js.map
