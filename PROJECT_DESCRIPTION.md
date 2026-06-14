# STEMViz

## One-Page Project Description

STEMViz is an AI-powered STEM education app that turns a student's confusion into a small interactive learning lab.

Instead of giving a generic chatbot explanation, STEMViz asks the learner what topic they are studying and what feels confusing. It then creates a short learning mission with a goal, a misconception to repair, a three-step activity, an interactive simulation, and a feedback prompt.

## Problem

Many students struggle in STEM because formulas are introduced before the underlying behavior is visible. A student may memorize `V = IR`, `y = mx + b`, or projectile motion equations without understanding what the variables actually do.

This makes learning feel abstract, especially for students who need visual or hands-on explanations.

## Solution

STEMViz creates micro-labs that combine:

- AI-generated lesson framing
- interactive STEM simulations
- misconception-focused prompts
- concise feedback on the student's explanation

The current prototype includes:

- Projectile motion sandbox
- Ohm's law circuit meter
- Linear equation graph explorer

## User Flow

1. Student selects a topic.
2. Student writes what feels confusing.
3. The app generates a learning mission.
4. Student experiments with the simulation.
5. Student explains what changed.
6. The app gives feedback and a next step.

## Technical Implementation

The backend is built with FastAPI. It attempts Hugging Face inference using a DeepSeek text model when credentials are configured. If the model is unavailable, deterministic STEM templates keep the prototype functional during a live demo.

The frontend is custom HTML, CSS, and JavaScript. Simulations are drawn on a canvas and update instantly as students move sliders.

## Impact

STEMViz is designed for students who do not learn best from static text. It makes STEM concepts visible, testable, and explainable in a short loop. This can support self-study, classroom review, tutoring, and accessibility-focused STEM education.

## Why This Is Different

Most AI education tools stop at explanation. STEMViz turns explanation into interaction. The student does not only read; they predict, simulate, observe, and explain.
