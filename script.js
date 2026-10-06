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
