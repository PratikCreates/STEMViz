from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

try:
    from huggingface_hub import InferenceClient
except ImportError:  # pragma: no cover - dependency is declared, fallback keeps import safe.
    InferenceClient = None  # type: ignore[assignment]


ROOT = Path(__file__).resolve().parents[1]
STATIC_DIR = ROOT / "static"
load_dotenv(ROOT / ".env", override=False)


class MissionRequest(BaseModel):
    topic: str = Field(default="Projectile motion")
    grade_band: str = Field(default="High school")
    struggle: str = Field(default="I mix up velocity, acceleration, and gravity.")
    learning_style: str = Field(default="visual")


class FeedbackRequest(BaseModel):
    topic: str
    question: str
    answer: str
    mission: dict[str, Any] | None = None


app = FastAPI(
    title="STEMViz",
    summary="AI-generated STEM micro-labs with interactive simulations.",
    version="0.1.0",
)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
async def home() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/favicon.ico", include_in_schema=False)
async def favicon() -> FileResponse:
    return FileResponse(STATIC_DIR / "favicon.svg", media_type="image/svg+xml")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "stemviz"}


@app.post("/api/mission")
async def create_mission(payload: MissionRequest) -> dict[str, Any]:
    mission = _try_hf_mission(payload)
    source = f"huggingface-{mission.get('model_used', 'deepseek')}" if mission else "local-fallback"
    if mission is None:
        mission = _fallback_mission(payload)
    mission["source"] = source
    mission["simulation"] = _simulation_key(payload.topic)
    return {"ok": True, "mission": mission}


@app.post("/api/feedback")
async def feedback(payload: FeedbackRequest) -> dict[str, Any]:
    response = _try_hf_feedback(payload)
    if response is None:
        response = _fallback_feedback(payload)
    return {"ok": True, "feedback": response}


def _try_hf_mission(payload: MissionRequest) -> dict[str, Any] | None:
    token = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACEHUB_API_TOKEN") or os.getenv("HF_API_KEY")
    if not token or InferenceClient is None:
        return None
    configured_model = os.getenv("HF_TEXT_MODEL")
    candidate_models = [configured_model] if configured_model else []
    candidate_models.extend([
        "deepseek-ai/DeepSeek-V4-Pro",
        "deepseek-ai/DeepSeek-V4-Flash",
        "deepseek-ai/DeepSeek-V4"
    ])
    prompt = (
        "Create one compact JSON object for an interactive STEM education micro-lab. "
        "No markdown. Keys: title, hook, learning_goal, misconception, stages, check_question, success_hint. "
        "stages must be 3 short objects with title and action. "
        f"Topic: {payload.topic}\n"
        f"Grade band: {payload.grade_band}\n"
        f"Student struggle: {payload.struggle}\n"
        f"Learning style: {payload.learning_style}\n"
    )
    for model in candidate_models:
        try:
            client = InferenceClient(model=model, token=token)
            text = client.text_generation(prompt, max_new_tokens=550, temperature=0.45, return_full_text=False)
            parsed = _extract_json(text)
            if parsed:
                normalized = _normalize_mission(parsed, payload)
                normalized["model_used"] = model.split("/")[-1]
                return normalized
        except Exception:
            continue
    return None


def _try_hf_feedback(payload: FeedbackRequest) -> str | None:
    token = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACEHUB_API_TOKEN") or os.getenv("HF_API_KEY")
    if not token or InferenceClient is None:
        return None
    configured_model = os.getenv("HF_TEXT_MODEL")
    candidate_models = [configured_model] if configured_model else []
    candidate_models.extend([
        "deepseek-ai/DeepSeek-V4-Pro",
        "deepseek-ai/DeepSeek-V4-Flash",
        "deepseek-ai/DeepSeek-V4"
    ])
    prompt = (
        "Give concise, kind STEM tutoring feedback in 4 sentences or less. "
        "Correct misconceptions, mention the simulation if useful, and end with one next step.\n"
        f"Topic: {payload.topic}\n"
        f"Question: {payload.question}\n"
        f"Student answer: {payload.answer}\n"
    )
    for model in candidate_models:
        try:
            client = InferenceClient(model=model, token=token)
            text = client.text_generation(prompt, max_new_tokens=220, temperature=0.35, return_full_text=False)
            cleaned = _clean_text(text, fallback="")
            if cleaned:
                return cleaned
        except Exception:
            continue
    return None


def _fallback_mission(payload: MissionRequest) -> dict[str, Any]:
    topic = payload.topic.strip() or "STEM concept"
    sim = _simulation_key(topic)
    templates = {
        "projectile": {
            "misconception": "Horizontal motion and vertical motion are connected by time, not by a shared force.",
            "check": "If launch speed stays fixed, what changes when the angle increases from 20 degrees to 45 degrees?",
            "hint": "Change one slider at a time and compare range, height, and time aloft.",
        },
        "ohm": {
            "misconception": "Current is not created by resistance; resistance limits current for a given voltage.",
            "check": "What happens to current when voltage stays fixed and resistance doubles?",
            "hint": "Watch the current meter while changing only resistance.",
        },
        "linear": {
            "misconception": "Slope controls steepness; intercept controls where the line starts on the y-axis.",
            "check": "How does the graph change when slope changes but intercept stays the same?",
            "hint": "Freeze one slider and move the other to isolate each parameter.",
        },
    }
    detail = templates.get(sim, templates["projectile"])
    return {
        "title": f"{topic}: Micro-Lab",
        "hook": f"Turn {topic.lower()} from a rule to something you can test.",
        "learning_goal": f"Build a working mental model of {topic.lower()} by predicting, simulating, and explaining.",
        "misconception": detail["misconception"],
        "stages": [
            {"title": "Predict", "action": "Write what you expect before touching the simulation."},
            {"title": "Experiment", "action": "Move one control at a time and compare the visual result."},
            {"title": "Explain", "action": "Use the evidence to repair the misconception in your own words."},
        ],
        "check_question": detail["check"],
        "success_hint": detail["hint"],
    }


def _fallback_feedback(payload: FeedbackRequest) -> str:
    answer = payload.answer.strip().lower()
    topic = payload.topic.lower()
    if not answer:
        return "Please enter an explanation first. Try using the helper chips below to describe what you observed in the simulation!"
    if len(answer.split()) < 4:
        return "Your response is a bit too short. Try to explain what you saw on the screen using a few more details or keywords."
    if "projectile" in topic or "motion" in topic or "gravity" in topic:
        if "range" not in answer and "height" not in answer and "time" not in answer:
            return "Good start! But try to name what changed in the simulation (like the Range, Max Height, or Time Aloft) when you adjusted the sliders."
        if "gravity" in answer and "pull" in answer:
            return "Excellent observation! You noticed how gravity pulls the projectile down. Indeed, increasing gravity shortens the flight time and range."
        if "45" in answer or "angle" in answer:
            return "Spot on! You correctly observed that the launch angle directly shapes the path. A 45-degree angle balances horizontal and vertical velocity to maximize range."
        return "You're on the right track. Remember: horizontal speed stays constant, while gravity accelerates the vertical motion downwards over time."
    elif "ohm" in topic or "circuit" in topic or "voltage" in topic:
        if "current" not in answer and "resistance" not in answer and "voltage" not in answer:
            return "Good start! Mention how the voltage (V), resistance (Ω), or current (A) changed on the circuit meter when you moved the sliders."
        if "resistance" in answer and ("increase" in answer or "double" in answer) and ("decrease" in answer or "half" in answer or "halves" in answer):
            return "Perfect! You've nailed Ohm's Law. Increasing resistance restricts the current flow, showing that current and resistance are inversely proportional."
        if "voltage" in answer and "increase" in answer and "current" in answer:
            return "Exactly! Raising the voltage pushes more current through the circuit, showing they are directly proportional for a constant resistance."
        return "Good observation. Think of voltage as the push, resistance as the restriction, and current as the actual flow rate: I = V/R."
    elif "linear" in topic or "slope" in topic or "line" in topic or "equation" in topic:
        if "slope" not in answer and "intercept" not in answer and "line" not in answer:
            return "Great attempt! Discuss how the slope (m) or y-intercept (b) changed the steepness or vertical start of the line on the graph."
        if "slope" in answer and ("steeper" in answer or "steep" in answer or "direction" in answer):
            return "Excellent! You observed how slope controls the steepness and direction (positive goes up, negative goes down)."
        if "intercept" in answer or "start" in answer or "y-axis" in answer:
            return "Perfect! The y-intercept represents the point where the line crosses the vertical y-axis (when x = 0)."
        return "Nice work. The line follows y = mx + b, where m is the rate of change (slope) and b is the initial starting point (intercept)."
    return "This is a solid explanation. Try to connect your observation directly to the learning goal and misconception shown in the mission card!"


def _simulation_key(topic: str) -> str:
    lowered = topic.lower()
    if any(word in lowered for word in ["circuit", "ohm", "voltage", "current", "resistance"]):
        return "ohm"
    if any(word in lowered for word in ["linear", "slope", "line", "algebra", "equation"]):
        return "linear"
    return "projectile"


def _extract_json(text: str) -> dict[str, Any] | None:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        data = json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _normalize_mission(data: dict[str, Any], payload: MissionRequest) -> dict[str, Any]:
    fallback = _fallback_mission(payload)
    stages = data.get("stages") if isinstance(data.get("stages"), list) else fallback["stages"]
    normalized_stages = []
    for item in stages[:3]:
        if isinstance(item, dict):
            normalized_stages.append(
                {
                    "title": _clean_text(str(item.get("title", "")), fallback="Explore"),
                    "action": _clean_text(str(item.get("action", "")), fallback="Try one focused experiment."),
                }
            )
    while len(normalized_stages) < 3:
        normalized_stages.append(fallback["stages"][len(normalized_stages)])
    return {
        "title": _clean_text(str(data.get("title", "")), fallback=fallback["title"]),
        "hook": _clean_text(str(data.get("hook", "")), fallback=fallback["hook"]),
        "learning_goal": _clean_text(str(data.get("learning_goal", "")), fallback=fallback["learning_goal"]),
        "misconception": _clean_text(str(data.get("misconception", "")), fallback=fallback["misconception"]),
        "stages": normalized_stages,
        "check_question": _clean_text(str(data.get("check_question", "")), fallback=fallback["check_question"]),
        "success_hint": _clean_text(str(data.get("success_hint", "")), fallback=fallback["success_hint"]),
    }


def _clean_text(text: str, *, fallback: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return fallback
    return text[:700]
