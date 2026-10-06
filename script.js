const techniques = [
  "Feynman Technique",
  "Blurting",
  "Interleaving",
  "Mind Mapping",
  "Sleep",
];

const NS = "http://www.w3.org/2000/svg";
const CX = 350, CY = 350;
const R_OUT = 320, R_IN = 170, R_MID = (R_OUT + R_IN) / 2;
const GAP = 1.6; // degrees of space between segments
const STEP = 360 / techniques.length;

const wheel = document.getElementById("wheel");
const menu = document.getElementById("menu");
const view = document.getElementById("view");
const viewTitle = document.getElementById("view-title");
const backBtn = document.getElementById("back");

const rad = (deg) => (deg * Math.PI) / 180;
const pt = (r, deg) => [CX + r * Math.cos(rad(deg)), CY + r * Math.sin(rad(deg))];

function el(name, attrs = {}) {
  const node = document.createElementNS(NS, name);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  return node;
}

function arc(r, a0, a1, sweep) {
  const [x, y] = pt(r, sweep ? a1 : a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `A ${r} ${r} 0 ${large} ${sweep} ${x} ${y}`;
}

// Centre label (shows the hovered technique, like the GTA wheel)
const centerName = el("text", { class: "center-name", x: CX, y: CY - 8 });
const centerCount = el("text", { class: "center-count", x: CX, y: CY + 28 });

function setCenter(i) {
  centerName.textContent = i === null ? "Choose a technique" : techniques[i];
  centerCount.textContent = i === null ? "" : `${i + 1} / ${techniques.length}`;
}

techniques.forEach((name, i) => {
  // Segment i is centred on the top (-90deg) and goes clockwise
  const mid = -90 + i * STEP;
  const a0 = mid - STEP / 2 + GAP / 2;
  const a1 = mid + STEP / 2 - GAP / 2;

  const [ox0, oy0] = pt(R_OUT, a0);
  const [ix1, iy1] = pt(R_IN, a1);

  const bodyPath =
    `M ${ox0} ${oy0} ${arc(R_OUT, a0, a1, 1)} L ${ix1} ${iy1} ${arc(R_IN, a0, a1, 0)} Z`;
  const hlPath = `M ${ox0} ${oy0} ${arc(R_OUT + 4, a0, a1, 1)}`;

  const g = el("g", {
    class: "seg",
    tabindex: "0",
    role: "button",
    "aria-label": name,
  });
  g.appendChild(el("path", { class: "body", d: bodyPath }));
  g.appendChild(el("path", { class: "hl", d: hlPath }));

  const [tx, ty] = pt(R_MID, mid);
  const label = el("text", { x: tx, y: ty });
  label.textContent = name;
  g.appendChild(label);

  g.addEventListener("mouseenter", () => setCenter(i));
  g.addEventListener("focus", () => setCenter(i));
  g.addEventListener("mouseleave", () => setCenter(null));
  g.addEventListener("blur", () => setCenter(null));
  g.addEventListener("click", () => openView(i));
  g.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openView(i);
    }
  });

  wheel.appendChild(g);
});

wheel.appendChild(centerName);
wheel.appendChild(centerCount);
setCenter(null);

function openView(i) {
  if (i === 0) {
    menu.hidden = true;
    feyView.hidden = false;
    return;
  }
  if (i === 3) {
    menu.hidden = true;
    mmView.hidden = false;
    return;
  }
  viewTitle.textContent = techniques[i];
  menu.hidden = true;
  view.hidden = false;
  backBtn.focus();
}

backBtn.addEventListener("click", () => {
  view.hidden = true;
  menu.hidden = false;
});

/* ---------- Feynman screen ---------- */
const feyView = document.getElementById("feynman");
const minIn = document.getElementById("min");
const secIn = document.getElementById("sec");
const startBtn = document.getElementById("start");
const resetBtn = document.getElementById("reset");
const face = document.getElementById("face");
const ring = document.getElementById("ring");
const notes = document.getElementById("notes");
const statusEl = document.getElementById("status");
const interimEl = document.getElementById("interim");

const CIRC = 2 * Math.PI * 150;
ring.style.strokeDasharray = CIRC;

const MAX_SECONDS = 300;
let total = 60, endTime = 0, tick = null, running = false;
let recog = null, wantMic = false;

function readInputs() {
  let m = Math.min(5, Math.max(0, parseInt(minIn.value, 10) || 0));
  let s = Math.min(59, Math.max(0, parseInt(secIn.value, 10) || 0));
  if (m * 60 + s > MAX_SECONDS) s = 0;
  if (m === 0 && s === 0) s = 1;
  minIn.value = m;
  secIn.value = String(s).padStart(2, "0");
  return m * 60 + s;
}

function render(remaining) {
  const t = Math.max(0, Math.ceil(remaining));
  face.textContent = Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
  ring.style.strokeDashoffset = CIRC * (1 - Math.max(0, remaining) / total);
}

function setStatus(text, live = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("live", live);
}

/* Microphone -> text box */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

function appendText(t) {
  t = t.trim();
  if (!t) return;
  const needsSpace = notes.value && !/\s$/.test(notes.value);
  notes.value += (needsSpace ? " " : "") + t;
  notes.scrollTop = notes.scrollHeight;
}

function startMic() {
  if (!SR) {
    setStatus("Speech-to-text isn't supported in this browser. Type your explanation instead (Chrome, Edge and Safari work).");
    return;
  }
  recog = new SR();
  recog.continuous = true;
  recog.interimResults = true;
  recog.lang = navigator.language || "en-US";
  wantMic = true;

  recog.onstart = () => setStatus("Listening", true);
  recog.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const text = e.results[i][0].transcript;
      if (e.results[i].isFinal) appendText(text);
      else interim += text;
    }
    interimEl.textContent = interim;
  };
  recog.onerror = (e) => {
    if (e.error === "no-speech" || e.error === "aborted") return;
    wantMic = false;
    setStatus(
      e.error === "not-allowed" || e.error === "service-not-allowed"
        ? "Microphone blocked. Allow access in your browser's site settings, or type instead."
        : "Speech recognition stopped (" + e.error + "). You can keep typing."
    );
  };
  recog.onend = () => {
    interimEl.textContent = "";
    if (wantMic && running) {
      try { recog.start(); } catch (err) {}
    }
  };
  try { recog.start(); } catch (err) {}
}

function stopMic() {
  wantMic = false;
  if (recog) {
    recog.onend = null;
    try { recog.stop(); } catch (err) {}
    recog = null;
  }
  interimEl.textContent = "";
}

/* Timer */
function stopAll() {
  clearInterval(tick);
  running = false;
  minIn.disabled = secIn.disabled = startBtn.disabled = false;
  stopMic();
}

function finish() {
  stopAll();
  render(0);
  setStatus("Time's up.");
}

startBtn.addEventListener("click", () => {
  if (running) return;
  total = readInputs();
  endTime = Date.now() + total * 1000;
  running = true;
  minIn.disabled = secIn.disabled = startBtn.disabled = true;
  setStatus("");
  startMic();
  render(total);
  tick = setInterval(() => {
    const remaining = (endTime - Date.now()) / 1000;
    if (remaining <= 0) finish();
    else render(remaining);
  }, 100);
});

resetBtn.addEventListener("click", () => {
  stopAll();
  total = readInputs();
  render(total);
  setStatus("");
});

[minIn, secIn].forEach((input) =>
  input.addEventListener("change", () => {
    total = readInputs();
    render(total);
  })
);

document.getElementById("fey-back").addEventListener("click", () => {
  stopAll();
  feyView.hidden = true;
  menu.hidden = false;
});

render(total);

/* ---------- Mind map screen ---------- */
const mmView = document.getElementById("mindmap");
const mmSvg = document.getElementById("mm-svg");
const mmLayer = document.getElementById("mm-layer");
const mmOverlay = document.getElementById("mm-overlay");
const sizeIn = document.getElementById("mm-size");
const colorIn = document.getElementById("mm-color");

const CLOUD = "M25 55 C10 55 3 42 12 34 C5 22 17 10 30 14 C35 3 55 2 62 12 C72 4 92 10 90 26 C100 32 98 50 82 52 C78 58 62 60 55 54 C48 60 32 60 25 55 Z";
const CURSORS = { nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize" };
const MIN = 40;

let items = [], selId = null, nextId = 1, drag = null, editingId = null;

const getItem = (id) => items.find((i) => i.id === id);
const isArrow = (it) => it.type === "arrow" || it.type === "double";
const clampSize = (v) => Math.min(72, Math.max(8, parseInt(v, 10) || 20));

function mmPoint(e) {
  const r = mmSvg.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function addItem(type) {
  const r = mmSvg.getBoundingClientRect();
  const off = (items.length % 6) * 24;
  let it;
  if (type === "arrow" || type === "double") {
    const y = r.height / 2 + off;
    it = { type, x1: r.width / 2 - 90 + off, y1: y, x2: r.width / 2 + 90 + off, y2: y };
  } else {
    const w = type === "box" ? 190 : type === "circle" ? 150 : 200;
    const h = type === "box" ? 100 : type === "circle" ? 150 : 120;
    it = { type, x: r.width / 2 - w / 2 + off, y: r.height / 2 - h / 2 + off, w, h,
           text: "Text", size: clampSize(sizeIn.value), color: colorIn.value };
  }
  it.id = nextId++;
  items.push(it);
  select(it.id);
}

function select(id) {
  selId = id;
  const it = getItem(id);
  if (it && !isArrow(it)) {
    sizeIn.value = it.size;
    colorIn.value = it.color;
  }
  renderMap();
}

function buildNode(it) {
  const sel = it.id === selId;
  const g = el("g", { class: "item" + (sel ? " sel" : ""), "data-id": it.id });

  if (isArrow(it)) {
    const c = { x1: it.x1, y1: it.y1, x2: it.x2, y2: it.y2 };
    if (sel) g.appendChild(el("line", { ...c, class: "halo" }));
    const line = el("line", { ...c, class: "arrow", "marker-end": "url(#mm-head)" });
    if (it.type === "double") line.setAttribute("marker-start", "url(#mm-head)");
    g.appendChild(line);
    g.appendChild(el("line", { ...c, class: "hit" }));
    return g;
  }

  let ix = 8, iy = 8;
  if (it.type === "box") {
    g.appendChild(el("rect", { class: "body", x: it.x, y: it.y, width: it.w, height: it.h, rx: 18 }));
  } else if (it.type === "circle") {
    g.appendChild(el("ellipse", { class: "body", cx: it.x + it.w / 2, cy: it.y + it.h / 2, rx: it.w / 2, ry: it.h / 2 }));
    ix = it.w * 0.15; iy = it.h * 0.15;
  } else {
    g.appendChild(el("path", { class: "body", d: CLOUD,
      transform: `translate(${it.x} ${it.y}) scale(${it.w / 100} ${it.h / 60})` }));
    ix = it.w * 0.17; iy = it.h * 0.22;
  }

  const fo = el("foreignObject", { x: it.x + ix, y: it.y + iy, width: Math.max(1, it.w - 2 * ix), height: Math.max(1, it.h - 2 * iy) });
  const div = document.createElement("div");
  div.className = "txt";
  div.textContent = it.text;
  div.style.fontSize = it.size + "px";
  div.style.color = it.color;
  fo.appendChild(div);
  g.appendChild(fo);
  return g;
}

function renderMap() {
  mmLayer.replaceChildren(...items.map(buildNode));
  mmOverlay.replaceChildren();
  const it = getItem(selId);
  if (!it) return;

  let pts;
  if (isArrow(it)) {
    pts = { p1: [it.x1, it.y1], p2: [it.x2, it.y2] };
    for (const k in pts) {
      mmOverlay.appendChild(el("circle", { class: "handle", cx: pts[k][0], cy: pts[k][1], r: 7, "data-h": k, style: "cursor:crosshair" }));
    }
    return;
  }
  const { x, y, w, h } = it;
  mmOverlay.appendChild(el("rect", { class: "selbox", x, y, width: w, height: h }));
  pts = { nw: [x, y], n: [x + w / 2, y], ne: [x + w, y], e: [x + w, y + h / 2],
          se: [x + w, y + h], s: [x + w / 2, y + h], sw: [x, y + h], w: [x, y + h / 2] };
  for (const k in pts) {
    mmOverlay.appendChild(el("rect", { class: "handle", x: pts[k][0] - 5, y: pts[k][1] - 5, width: 10, height: 10,
      "data-h": k, style: "cursor:" + CURSORS[k] }));
  }
}

mmSvg.addEventListener("pointerdown", (e) => {
  const g = e.target.closest(".item");
  if (editingId !== null) {
    if (g && +g.dataset.id === editingId) return; // let the caret move inside the text
    document.activeElement.blur();
  }
  const h = e.target.dataset ? e.target.dataset.h : null;
  const p = mmPoint(e);
  if (h && getItem(selId)) {
    drag = { mode: h, start: p, orig: { ...getItem(selId) } };
  } else if (g) {
    const id = +g.dataset.id;
    select(id);
    drag = { mode: "move", start: p, orig: { ...getItem(id) } };
  } else {
    select(null);
    return;
  }
  e.preventDefault();
});

window.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const it = getItem(selId);
  if (!it) return;
  const p = mmPoint(e);
  const dx = p.x - drag.start.x, dy = p.y - drag.start.y, o = drag.orig, m = drag.mode;

  if (isArrow(it)) {
    if (m === "p1") { it.x1 = o.x1 + dx; it.y1 = o.y1 + dy; }
    else if (m === "p2") { it.x2 = o.x2 + dx; it.y2 = o.y2 + dy; }
    else { it.x1 = o.x1 + dx; it.y1 = o.y1 + dy; it.x2 = o.x2 + dx; it.y2 = o.y2 + dy; }
  } else if (m === "move") {
    it.x = o.x + dx; it.y = o.y + dy;
  } else {
    if (m.includes("e")) it.w = Math.max(MIN, o.w + dx);
    if (m.includes("s")) it.h = Math.max(MIN, o.h + dy);
    if (m.includes("w")) { it.w = Math.max(MIN, o.w - dx); it.x = o.x + o.w - it.w; }
    if (m.includes("n")) { it.h = Math.max(MIN, o.h - dy); it.y = o.y + o.h - it.h; }
  }
  renderMap();
});

window.addEventListener("pointerup", () => { drag = null; });

mmSvg.addEventListener("dblclick", (e) => {
  const g = e.target.closest(".item");
  if (!g) return;
  const it = getItem(+g.dataset.id);
  if (!it || isArrow(it)) return;
  editingId = it.id;
  g.classList.add("editing");
  const div = g.querySelector(".txt");
  div.contentEditable = "true";
  div.focus();
  const range = document.createRange();
  range.selectNodeContents(div);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  div.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === "Escape") { ev.preventDefault(); div.blur(); }
  });
  div.addEventListener("blur", () => {
    it.text = div.textContent;
    editingId = null;
    renderMap();
  }, { once: true });
});

document.querySelectorAll("[data-add]").forEach((b) =>
  b.addEventListener("click", () => addItem(b.dataset.add))
);

function deleteSelected() {
  if (selId === null) return;
  items = items.filter((i) => i.id !== selId);
  selId = null;
  renderMap();
}
document.getElementById("mm-del").addEventListener("click", deleteSelected);

document.addEventListener("keydown", (e) => {
  if (mmView.hidden || editingId !== null || document.activeElement.tagName === "INPUT") return;
  if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelected(); }
});

sizeIn.addEventListener("input", () => {
  const it = getItem(selId);
  if (it && !isArrow(it)) { it.size = clampSize(sizeIn.value); renderMap(); }
});
colorIn.addEventListener("input", () => {
  const it = getItem(selId);
  if (it && !isArrow(it)) { it.color = colorIn.value; renderMap(); }
});

document.getElementById("mm-back").addEventListener("click", () => {
  mmView.hidden = true;
  menu.hidden = false;
});
