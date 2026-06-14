const state = {
  mission: null,
  simulation: "projectile",
  stagesProgress: { predict: 'active', experiment: 'pending', explain: 'pending' },
  isProjectileAnimating: false,
  projectileAnimT: 0,
  ohmOffset: 0,
  linearTime: 0
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

function updateChecklistUI() {
  const keys = ['predict', 'experiment', 'explain'];
  keys.forEach((key, index) => {
    const el = document.getElementById(`stage-${index}`);
    if (el) {
      el.className = `stage ${state.stagesProgress[key]}`;
    }
  });
}

function updateSliderLabels() {
  const vals = {
    speed: document.getElementById("speed").value,
    angle: document.getElementById("angle").value,
    gravity: document.getElementById("gravity").value,
    voltage: document.getElementById("voltage").value,
    resistance: document.getElementById("resistance").value,
    slope: Number(document.getElementById("slope").value).toFixed(1),
    intercept: Number(document.getElementById("intercept").value).toFixed(1)
  };
  for (const [id, val] of Object.entries(vals)) {
    const el = document.getElementById(`${id}Val`);
    if (el) el.textContent = val;
  }
}

function renderMission(mission) {
  state.mission = mission;
  state.simulation = mission.simulation || "projectile";

  const answerEl = document.getElementById("studentAnswer");
  if (answerEl) answerEl.value = "";
  const feedbackEl = document.getElementById("feedback");
  if (feedbackEl) feedbackEl.textContent = "Feedback will appear here.";

  // Reset stages progress
  state.stagesProgress = { predict: 'active', experiment: 'pending', explain: 'pending' };

  // Reset launch animation
  state.isProjectileAnimating = false;
  state.projectileAnimT = 0;
  const launchBtn = document.getElementById("launchProj");
  if (launchBtn) {
    launchBtn.disabled = false;
    launchBtn.textContent = "Launch 🚀";
    if (state.simulation === "projectile") {
      launchBtn.classList.remove("hidden");
    } else {
      launchBtn.classList.add("hidden");
    }
  }

  document.getElementById("sourceLabel").textContent =
    mission.source.startsWith("huggingface-") ? "Generated with Hugging Face / " + mission.source.replace("huggingface-", "") : "Generated locally";
  document.getElementById("missionTitle").textContent = mission.title;
  document.getElementById("missionHook").textContent = mission.hook;
  document.getElementById("learningGoal").textContent = mission.learning_goal;
  document.getElementById("misconception").textContent = mission.misconception;
  document.getElementById("checkQuestion").textContent = mission.check_question;

  const stages = document.getElementById("stages");
  stages.innerHTML = "";
  mission.stages.forEach((stage, index) => {
    const card = document.createElement("article");
    card.className = "stage pending";
    card.id = `stage-${index}`;
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

  updateSliderLabels();
  updateChecklistUI();
  updateHelperChips();
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
    
    // Complete explaining stage
    state.stagesProgress.explain = 'completed';
    updateChecklistUI();
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
  
  state.isProjectileAnimating = false;
  state.projectileAnimT = 0;
  const launchBtn = document.getElementById("launchProj");
  if (launchBtn) {
    launchBtn.disabled = false;
    launchBtn.textContent = "Launch 🚀";
  }
  
  updateSliderLabels();
});

// Setup input listeners for sliders to trigger Experiment stage completed
document.querySelectorAll("input[type='range']").forEach((input) => {
  input.addEventListener("input", () => {
    updateSliderLabels();
    if (state.stagesProgress.experiment === 'active') {
      state.stagesProgress.experiment = 'completed';
      state.stagesProgress.explain = 'active';
      updateChecklistUI();
    }
  });
});

// Setup Topic dropdown to change default struggles
const topicDropdown = document.getElementById("topic");
const struggleTextarea = document.getElementById("struggle");
if (topicDropdown && struggleTextarea) {
  const struggles = {
    "Projectile motion": "I mix up velocity, acceleration, and gravity.",
    "Ohm's law and circuits": "I don't understand how resistance limits current, and how voltage changes things.",
    "Linear equations and slope": "I struggle to see the difference between changing the slope and changing the y-intercept."
  };
  topicDropdown.addEventListener("change", () => {
    const selected = topicDropdown.value;
    if (struggles[selected]) {
      struggleTextarea.value = struggles[selected];
    }
  });
}

// Setup explanation textarea listener to trigger Predict stage completed
const studentAnswer = document.getElementById("studentAnswer");
if (studentAnswer) {
  studentAnswer.addEventListener("input", () => {
    if (studentAnswer.value.trim().length > 0) {
      if (state.stagesProgress.predict === 'active') {
        state.stagesProgress.predict = 'completed';
        state.stagesProgress.experiment = 'active';
        updateChecklistUI();
      }
    } else {
      if (state.stagesProgress.predict === 'completed' && state.stagesProgress.experiment === 'active') {
        state.stagesProgress.predict = 'active';
        state.stagesProgress.experiment = 'pending';
        updateChecklistUI();
      }
    }
  });
}

// Projectile Launch handler
const launchProjBtn = document.getElementById("launchProj");
if (launchProjBtn) {
  launchProjBtn.addEventListener("click", () => {
    if (state.isProjectileAnimating) return;
    
    state.isProjectileAnimating = true;
    state.projectileAnimT = 0;
    launchProjBtn.disabled = true;
    launchProjBtn.textContent = "Flying... 🚀";
    
    // Auto-advance Experiment step
    if (state.stagesProgress.experiment === 'active') {
      state.stagesProgress.experiment = 'completed';
      state.stagesProgress.explain = 'active';
      updateChecklistUI();
    }
  });
}

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

  // Draw full trajectory (dotted)
  ctx.strokeStyle = "rgba(156, 255, 199, 0.4)";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  for (let i = 0; i <= 90; i++) {
    const t = (flightTime * i) / 90;
    const x = 60 + vx * t * scaleX;
    const y = 310 - (vy * t - 0.5 * gravity * t * t) * scaleY;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]); // reset

  // Determine current flight time draw limit
  const currentT = state.isProjectileAnimating ? state.projectileAnimT : flightTime;

  // Draw solid path traveled so far
  ctx.strokeStyle = "#9cffc7";
  ctx.lineWidth = 4;
  ctx.shadowBlur = 6;
  ctx.shadowColor = "#9cffc7";
  ctx.beginPath();
  const steps = Math.ceil((currentT / flightTime) * 90) || 1;
  for (let i = 0; i <= steps; i++) {
    const t = Math.min(currentT, (flightTime * i) / 90);
    const x = 60 + vx * t * scaleX;
    const y = 310 - (vy * t - 0.5 * gravity * t * t) * scaleY;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0; // reset

  // Draw glowing ball at current path end
  const bx = 60 + vx * currentT * scaleX;
  const by = 310 - (vy * currentT - 0.5 * gravity * currentT * currentT) * scaleY;
  
  ctx.fillStyle = "#ffd166";
  ctx.shadowBlur = 12;
  ctx.shadowColor = "#ffd166";
  ctx.beginPath();
  ctx.arc(bx, by, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0; // reset

  document.getElementById("metrics").innerHTML = [
    metric("Range", `${range.toFixed(1)} m`),
    metric("Max height", `${maxHeight.toFixed(1)} m`),
    metric("Time aloft", `${flightTime.toFixed(2)} s`),
  ].join("");
}

function getCircuitPoint(s) {
  s = s % 1130;
  if (s < 420) {
    return { x: 150 + s, y: 115 };
  } else if (s < 565) {
    return { x: 570, y: 115 + (s - 420) };
  } else if (s < 985) {
    return { x: 570 - (s - 565), y: 260 };
  } else {
    return { x: 150, y: 260 - (s - 985) };
  }
}

function drawOhm() {
  clearCanvas();
  const voltage = Number(document.getElementById("voltage").value);
  const resistance = Number(document.getElementById("resistance").value);
  const current = voltage / resistance;

  // Draw wire shadow / border
  ctx.strokeStyle = "rgba(120, 233, 255, 0.2)";
  ctx.lineWidth = 14;
  ctx.strokeRect(150, 115, 420, 145);

  // Draw core wire
  ctx.strokeStyle = "#29433c";
  ctx.lineWidth = 8;
  ctx.strokeRect(150, 115, 420, 145);

  // Draw battery
  ctx.fillStyle = "#ffd166";
  ctx.fillRect(130, 155, 44, 66);
  ctx.fillStyle = "#0d1717";
  ctx.fillRect(138, 175, 28, 26);
  ctx.fillStyle = "#ffd166";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText("+", 148, 171);
  ctx.fillText("-", 149, 212);

  // Draw resistor
  ctx.fillStyle = "#ff8f70";
  ctx.fillRect(360, 103, 90, 24);
  // Resistor stripes
  ctx.fillStyle = "#8a3e2d";
  ctx.fillRect(380, 103, 8, 24);
  ctx.fillRect(400, 103, 8, 24);
  ctx.fillRect(420, 103, 8, 24);

  // Draw labels
  ctx.fillStyle = "#f4fbf4";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText(`${voltage}V`, 75, 194);
  ctx.fillText(`${resistance}Ω`, 380, 90);
  ctx.fillText(`${current.toFixed(2)}A`, 330, 210);

  // Pulse animation on capacitor/load
  const pulse = Math.min(85, current * 16);
  ctx.fillStyle = "rgba(120, 233, 255, .15)";
  ctx.beginPath();
  ctx.arc(560, 188, pulse + 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(156, 255, 199, .4)";
  ctx.beginPath();
  ctx.arc(560, 188, pulse, 0, Math.PI * 2);
  ctx.fill();

  // Draw moving charge particles along perimeter
  const numParticles = 14;
  const spacing = 1130 / numParticles;
  ctx.fillStyle = "#78e9ff";
  ctx.shadowBlur = 8;
  ctx.shadowColor = "#78e9ff";
  for (let i = 0; i < numParticles; i++) {
    const s = (state.ohmOffset + i * spacing) % 1130;
    const pt = getCircuitPoint(s);
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0; // reset

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

  // Grid axes
  ctx.strokeStyle = "#abc2ba";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, originY);
  ctx.lineTo(canvas.width, originY);
  ctx.moveTo(originX, 0);
  ctx.lineTo(originX, canvas.height);
  ctx.stroke();

  // Function line
  ctx.strokeStyle = "#9cffc7";
  ctx.lineWidth = 4;
  ctx.shadowBlur = 4;
  ctx.shadowColor = "#9cffc7";
  ctx.beginPath();
  for (let px = 0; px <= canvas.width; px++) {
    const x = (px - originX) / scale;
    const y = slope * x + intercept;
    const py = originY - y * scale;
    if (px === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.shadowBlur = 0; // reset

  // Formula label
  ctx.fillStyle = "#ffd166";
  ctx.font = "bold 24px sans-serif";
  ctx.fillText(`y = ${slope}x ${intercept >= 0 ? "+" : "-"} ${Math.abs(intercept)}`, 34, 44);

  // Glowing tracer gliding along line
  const glideT = (Math.sin(state.linearTime * 1.5) + 1) / 2; // oscillates 0 to 1
  const tpx = glideT * canvas.width;
  const tgraphX = (tpx - originX) / scale;
  const tgraphY = slope * tgraphX + intercept;
  const tpy = originY - tgraphY * scale;

  ctx.fillStyle = "#ffd166";
  ctx.shadowBlur = 12;
  ctx.shadowColor = "#ffd166";
  ctx.beginPath();
  ctx.arc(tpx, tpy, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0; // reset

  document.getElementById("metrics").innerHTML = [
    metric("Slope", slope.toFixed(1)),
    metric("Y-intercept", intercept.toFixed(1)),
    metric("Model", "y = mx + b"),
  ].join("");
}

// Global Animation Loop
let lastGlobalTime = performance.now();
function globalAnimLoop(now) {
  const dt = (now - lastGlobalTime) / 1000;
  lastGlobalTime = now;

  // Ohm's current particles offset
  const voltage = Number(document.getElementById("voltage").value);
  const resistance = Number(document.getElementById("resistance").value);
  const current = voltage / resistance;
  const ohmSpeed = current * 68; // pixels per second
  state.ohmOffset = (state.ohmOffset + ohmSpeed * dt) % 1130;

  // Linear tracer time
  state.linearTime += dt;

  // Projectile animation
  if (state.isProjectileAnimating) {
    const speed = Number(document.getElementById("speed").value);
    const angleDeg = Number(document.getElementById("angle").value);
    const gravity = Number(document.getElementById("gravity").value);
    const angle = (angleDeg * Math.PI) / 180;
    const vy = speed * Math.sin(angle);
    const flightTime = (2 * vy) / gravity;
    const speedFactor = Math.max(0.8, flightTime / 1.4);
    state.projectileAnimT += dt * speedFactor;
    if (state.projectileAnimT >= flightTime) {
      state.projectileAnimT = flightTime;
      state.isProjectileAnimating = false;
      const btn = document.getElementById("launchProj");
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Launch 🚀";
      }
    }
  }

  draw();
  requestAnimationFrame(globalAnimLoop);
}

// Initial default lab load (mimicking main.py initial mission rendering)
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

// Start Global Loop
requestAnimationFrame(globalAnimLoop);

const chipsData = {
  projectile: [
    "Range increased",
    "Time aloft increased",
    "Max height increased",
    "45° angle maximizes range",
    "Gravity pulls it down faster",
    "Independent motions"
  ],
  ohm: [
    "Current increases",
    "Current decreases",
    "Resistance limits flow",
    "Voltage pushes current",
    "V = IR relation",
    "Doubling resistance halves current"
  ],
  linear: [
    "Slope increases steepness",
    "Negative slope goes downwards",
    "Y-intercept shifts starting point",
    "y = mx + b line model",
    "Zero slope is flat horizontal"
  ]
};

function updateHelperChips() {
  const container = document.getElementById("helperChips");
  if (!container) return;
  container.innerHTML = "";
  
  const currentChips = chipsData[state.simulation] || [];
  currentChips.forEach(text => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.textContent = text;
    chip.addEventListener("click", () => {
      const textarea = document.getElementById("studentAnswer");
      if (textarea.value.trim() === "") {
        textarea.value = text;
      } else {
        textarea.value += " and " + text.toLowerCase();
      }
      textarea.dispatchEvent(new Event('input'));
    });
    container.appendChild(chip);
  });
}

// Voice Recognition setup
const voiceBtn = document.getElementById("voiceBtn");
if (voiceBtn && studentAnswer) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    voiceBtn.addEventListener("click", () => {
      if (voiceBtn.classList.contains("listening")) {
        recognition.stop();
      } else {
        voiceBtn.classList.add("listening");
        voiceBtn.textContent = "🎙️ Listening...";
        recognition.start();
      }
    });

    recognition.onresult = (event) => {
      const speechToText = event.results[0][0].transcript;
      if (studentAnswer.value.trim() === "") {
        studentAnswer.value = speechToText;
      } else {
        studentAnswer.value += " " + speechToText;
      }
      studentAnswer.dispatchEvent(new Event('input'));
    };

    recognition.onspeechend = () => {
      recognition.stop();
    };

    recognition.onend = () => {
      voiceBtn.classList.remove("listening");
      voiceBtn.textContent = "🎤 Speak Answer";
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      voiceBtn.classList.remove("listening");
      voiceBtn.textContent = "🎤 Speak Answer";
    };
  } else {
    voiceBtn.style.display = "none";
  }
}
