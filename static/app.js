const state = {
  mission: null,
  simulation: "projectile",
};

const form = document.getElementById("missionForm");
const statusEl = document.getElementById("status");
const canvas = document.getElementById("simCanvas");
const ctx = canvas.getContext("2d");

const controls = {
  projectile: document.getElementById("projectileControls"),
  ohm: document.getElementById("ohmControls"),
  linear: document.getElementById("linearControls"),
};

function setStatus(message) {
  statusEl.textContent = message;
}

function metric(label, value) {
  return `<div class="metric"><small>${label}</small><strong>${value}</strong></div>`;
}

function renderMission(mission) {
  state.mission = mission;
  state.simulation = mission.simulation || "projectile";
  document.getElementById("sourceLabel").textContent =
    mission.source === "huggingface-deepseek" ? "Generated with Hugging Face / DeepSeek" : "Generated locally";
  document.getElementById("missionTitle").textContent = mission.title;
  document.getElementById("missionHook").textContent = mission.hook;
  document.getElementById("learningGoal").textContent = mission.learning_goal;
  document.getElementById("misconception").textContent = mission.misconception;
  document.getElementById("checkQuestion").textContent = mission.check_question;

  const stages = document.getElementById("stages");
  stages.innerHTML = "";
  mission.stages.forEach((stage, index) => {
    const card = document.createElement("article");
    card.className = "stage";
    card.innerHTML = `<strong>${index + 1}. ${stage.title}</strong><p>${stage.action}</p>`;
    stages.appendChild(card);
  });

  Object.values(controls).forEach((el) => el.classList.add("hidden"));
  controls[state.simulation].classList.remove("hidden");
  document.getElementById("simTitle").textContent = {
    projectile: "Projectile sandbox",
    ohm: "Circuit meter",
    linear: "Line explorer",
  }[state.simulation];
  draw();
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Request failed");
  return data;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Generating a micro-lab...");
  try {
    const data = await postJson("/api/mission", {
      topic: document.getElementById("topic").value,
      grade_band: document.getElementById("gradeBand").value,
      struggle: document.getElementById("struggle").value,
      learning_style: document.getElementById("learningStyle").value,
    });
    renderMission(data.mission);
    setStatus("Lab ready. Try the simulation, then explain what changed.");
  } catch (error) {
    setStatus(`Error: ${error.message}`);
  }
});

document.getElementById("getFeedback").addEventListener("click", async () => {
  const answer = document.getElementById("studentAnswer").value;
  const question = document.getElementById("checkQuestion").textContent;
  document.getElementById("feedback").textContent = "Reading your explanation...";
  try {
    const data = await postJson("/api/feedback", {
      topic: document.getElementById("topic").value,
      question,
      answer,
      mission: state.mission,
    });
    document.getElementById("feedback").textContent = data.feedback;
  } catch (error) {
    document.getElementById("feedback").textContent = `Error: ${error.message}`;
  }
});

document.getElementById("resetSim").addEventListener("click", () => {
  document.getElementById("speed").value = 52;
  document.getElementById("angle").value = 42;
  document.getElementById("gravity").value = 9.8;
  document.getElementById("voltage").value = 12;
  document.getElementById("resistance").value = 6;
  document.getElementById("slope").value = 2;
  document.getElementById("intercept").value = 1;
  draw();
});

document.querySelectorAll("input[type='range'], select").forEach((input) => {
  input.addEventListener("input", draw);
});

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#06100f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(156, 255, 199, .18)";
  ctx.lineWidth = 1;
  for (let x = 40; x < canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 40; y < canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function draw() {
  if (state.simulation === "ohm") drawOhm();
  else if (state.simulation === "linear") drawLinear();
  else drawProjectile();
}

function drawProjectile() {
  clearCanvas();
  const speed = Number(document.getElementById("speed").value);
  const angleDeg = Number(document.getElementById("angle").value);
  const gravity = Number(document.getElementById("gravity").value);
  const angle = (angleDeg * Math.PI) / 180;
  const vx = speed * Math.cos(angle);
  const vy = speed * Math.sin(angle);
  const flightTime = (2 * vy) / gravity;
  const range = vx * flightTime;
  const maxHeight = (vy * vy) / (2 * gravity);
  const scaleX = 600 / Math.max(range, 1);
  const scaleY = 250 / Math.max(maxHeight, 1);

  ctx.strokeStyle = "#9cffc7";
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i <= 90; i++) {
    const t = (flightTime * i) / 90;
    const x = 60 + vx * t * scaleX;
    const y = 310 - (vy * t - 0.5 * gravity * t * t) * scaleY;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.arc(60, 310, 8, 0, Math.PI * 2);
  ctx.fill();

  document.getElementById("metrics").innerHTML = [
    metric("Range", `${range.toFixed(1)} m`),
    metric("Max height", `${maxHeight.toFixed(1)} m`),
    metric("Time aloft", `${flightTime.toFixed(2)} s`),
  ].join("");
}

function drawOhm() {
  clearCanvas();
  const voltage = Number(document.getElementById("voltage").value);
  const resistance = Number(document.getElementById("resistance").value);
  const current = voltage / resistance;

  ctx.strokeStyle = "#78e9ff";
  ctx.lineWidth = 8;
  ctx.strokeRect(150, 115, 420, 145);

  ctx.fillStyle = "#ffd166";
  ctx.fillRect(130, 155, 44, 66);
  ctx.fillStyle = "#ff8f70";
  ctx.fillRect(360, 105, 90, 42);

  ctx.fillStyle = "#f4fbf4";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText(`${voltage}V`, 123, 245);
  ctx.fillText(`${resistance}Ω`, 360, 98);
  ctx.fillText(`${current.toFixed(2)}A`, 330, 210);

  const pulse = Math.min(90, current * 18);
  ctx.fillStyle = "rgba(156, 255, 199, .55)";
  ctx.beginPath();
  ctx.arc(560, 188, pulse, 0, Math.PI * 2);
  ctx.fill();

  document.getElementById("metrics").innerHTML = [
    metric("Voltage", `${voltage} V`),
    metric("Resistance", `${resistance} Ω`),
    metric("Current", `${current.toFixed(2)} A`),
  ].join("");
}

function drawLinear() {
  clearCanvas();
  const slope = Number(document.getElementById("slope").value);
  const intercept = Number(document.getElementById("intercept").value);
  const originX = canvas.width / 2;
  const originY = canvas.height / 2;
  const scale = 28;

  ctx.strokeStyle = "#abc2ba";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, originY);
  ctx.lineTo(canvas.width, originY);
  ctx.moveTo(originX, 0);
  ctx.lineTo(originX, canvas.height);
  ctx.stroke();

  ctx.strokeStyle = "#9cffc7";
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let px = 0; px <= canvas.width; px++) {
    const x = (px - originX) / scale;
    const y = slope * x + intercept;
    const py = originY - y * scale;
    if (px === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  ctx.fillStyle = "#ffd166";
  ctx.font = "bold 24px sans-serif";
  ctx.fillText(`y = ${slope}x ${intercept >= 0 ? "+" : "-"} ${Math.abs(intercept)}`, 34, 44);

  document.getElementById("metrics").innerHTML = [
    metric("Slope", slope.toFixed(1)),
    metric("Y-intercept", intercept.toFixed(1)),
    metric("Model", "y = mx + b"),
  ].join("");
}

renderMission({
  title: "Projectile motion: Micro-Lab",
  hook: "Turn projectile motion from a rule to something you can test.",
  learning_goal: "Build a working mental model by predicting, simulating, and explaining.",
  misconception: "Horizontal motion and vertical motion are connected by time, not by a shared force.",
  stages: [
    { title: "Predict", action: "Write what you expect before touching the simulation." },
    { title: "Experiment", action: "Move one control at a time and compare the visual result." },
    { title: "Explain", action: "Use the evidence to repair the misconception in your own words." },
  ],
  check_question: "If launch speed stays fixed, what changes when the angle increases from 20 degrees to 45 degrees?",
  success_hint: "Change one slider at a time and compare range, height, and time aloft.",
  simulation: "projectile",
  source: "local-fallback",
});
