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
    title="STEMLens Lab",
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
    return {"status": "ok", "service": "stemlens-lab"}


@app.post("/api/mission")
async def create_mission(payload: MissionRequest) -> dict[str, Any]:
    mission = _try_hf_mission(payload)
    source = "huggingface-deepseek" if mission else "local-fallback"
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
    model = os.getenv("HF_TEXT_MODEL", "deepseek-ai/DeepSeek-V3-0324")
    prompt = (
        "Create one compact JSON object for an interactive STEM education micro-lab. "
        "No markdown. Keys: title, hook, learning_goal, misconception, stages, check_question, success_hint. "
        "stages must be 3 short objects with title and action. "
        f"Topic: {payload.topic}\n"
        f"Grade band: {payload.grade_band}\n"
        f"Student struggle: {payload.struggle}\n"
        f"Learning style: {payload.learning_style}\n"
    )
    try:
        client = InferenceClient(model=model, token=token)
        text = client.text_generation(prompt, max_new_tokens=550, temperature=0.45, return_full_text=False)
        parsed = _extract_json(text)
        return _normalize_mission(parsed, payload) if parsed else None
    except Exception:
        return None


def _try_hf_feedback(payload: FeedbackRequest) -> str | None:
    token = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACEHUB_API_TOKEN") or os.getenv("HF_API_KEY")
    if not token or InferenceClient is None:
        return None
    model = os.getenv("HF_TEXT_MODEL", "deepseek-ai/DeepSeek-V3-0324")
    prompt = (
        "Give concise, kind STEM tutoring feedback in 4 sentences or less. "
        "Correct misconceptions, mention the simulation if useful, and end with one next step.\n"
        f"Topic: {payload.topic}\n"
        f"Question: {payload.question}\n"
        f"Student answer: {payload.answer}\n"
    )
    try:
        client = InferenceClient(model=model, token=token)
        text = client.text_generation(prompt, max_new_tokens=220, temperature=0.35, return_full_text=False)
        return _clean_text(text, fallback=_fallback_feedback(payload))
    except Exception:
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
    answer = payload.answer.strip()
    if not answer:
        return "Start with a short prediction first. A useful answer names the variable you changed, what you observed, and why that observation makes sense."
    if len(answer.split()) < 8:
        return "Good start, but make it more testable. Add one observation from the simulation and connect it to the main concept."
    return "This is on the right track. Now strengthen it by naming the exact variable relationship and explaining what would happen if you changed only one slider."


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
