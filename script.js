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
  viewTitle.textContent = techniques[i];
  menu.hidden = true;
  view.hidden = false;
  backBtn.focus();
}

backBtn.addEventListener("click", () => {
  view.hidden = true;
  menu.hidden = false;
});
