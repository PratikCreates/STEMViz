# Devpost Submission Draft: STEMLens Lab

Here is the structured content ready to copy-paste into the Devpost submission fields.

---

## Pitch

**AI-generated STEM micro-labs that turn students' confusion into interactive experiments and a misconception repair loop.**

---

## Inspiration

STEM education is often taught "formula-first"—students memorize equations like `V = IR` or the kinematic equations of projectile motion before they understand the real-world behavior behind them. For visual or hands-on learners, this abstract start is a major barrier. 

We wanted to build a tool that does not simply explain with text (like a typical chatbot), but instead creates a **dynamic sandbox** where students can play with the concepts, isolate variables, make observations, and explain them to receive feedback.

---

## What it does

STEMLens Lab asks a student three simple questions:
1. What STEM topic are you studying? (e.g., Projectile motion, Ohm's law, Linear equations)
2. What is your grade band? (Middle school, High school, Early college)
3. What feels confusing? (e.g., *"I mix up velocity, acceleration, and gravity."*)

The app then generates:
- **A Learning Mission:** A goal, a key misconception to repair, and a three-step activity.
- **An Interactive Simulation:** A canvas-based sandbox corresponding to the topic, with dynamic sliders.
- **A Misconception Check:** A targeted question that challenges the student's specific confusion.
- **An Explanation Feedback Loop:** The student types an explanation after testing the simulation, and receives constructive, kind tutoring feedback to refine their understanding.

---

## How we built it

- **Frontend:** Built with vanilla HTML5, CSS3, and JavaScript, leveraging `<canvas>` for high-performance interactive physics and math simulations that respond instantly to slider adjustments.
- **Backend:** Built with FastAPI (Python 3.11).
- **AI Integration:** Features a Hugging Face Inference API client utilizing `deepseek-ai/DeepSeek-V3-0324` to dynamically generate targeted lesson structures and tailor tutoring feedback.
- **Robust Fallback:** If Hugging Face credentials are not configured or the model is overloaded, the app seamlessly falls back to pre-defined deterministic STEM templates. The app remains fully functional for demonstration.
- **Deployment:** Containerized via Docker and deployed serverless to Google Cloud Run for rapid scaling and low-latency response times.

---

## Challenges we ran into

One major challenge was ensuring that the AI-generated mission would reliably match the interactive capabilities of the canvas simulations. We solved this by using structured fallback schemas and mapping topics to dedicated sandbox layouts (Ohm's Law circuit meter, Projectile motion physics engine, Linear equations coordinate graph).

We also worked to ensure the application could run in offline/credential-less environments during judge evaluation, which we achieved by writing a robust fallback template router.

---

## Accomplishments that we're proud of

- Successfully deploying a zero-latency canvas simulation that works alongside real-time AI lesson planning.
- Designing a premium, sleek, modern dark-themed user interface that feels professional, engaging, and polished.
- Meeting the "AI x STEM Education" theme directly by focusing on *how* students learn (interactively repairing misconceptions) rather than just automating answers.

---

## What we learned

We learned how crucial it is to design AI education tools with visual anchors. Chatbot-only interfaces often fail to build visual intuition. By connecting the LLM's prompts to physical sliders, students learn relationships, not just strings of text.

---

## What's next for STEMLens Lab

- **More labs:** Add chemistry molecule balancing and biology cell diffusion sandboxes.
- **Teacher dashboard:** Let teachers configure custom sandboxes, monitor student misconception repair rates, and assign specific micro-labs.
- **State Persistence:** Implement learner profile saving so students can track their learning history.
