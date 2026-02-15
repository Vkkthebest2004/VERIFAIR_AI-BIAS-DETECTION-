# 🎓 Verifair — Judge's Q&A Cheat Sheet
**What You Need to Know to Win**

This guide covers the **core concepts** judges are most likely to ask about. If you understand these 5 topics, you can answer 90% of technical questions.

---

## 🔒 Concept 1: Vector Embeddings (The "Brain")
**Likely Question:** *"How does your AI actually 'understand' the text?"*

### What to Learn:
- **Embeddings** are lists of numbers (vectors) that represent the *meaning* of text.
- We use a specific model called **`all-mpnet-base-v2`**.
- It converts every sentence into a **768-dimensional vector** (a list of 768 numbers).
- Similar sentences stay close together in this 768-dim space; opposites correspond to different directions.

### The "Winning" Answer:
> "We use **Sentence-Transformers** to convert text into high-dimensional vectors. Specifically, we use the `all-mpnet-base-v2` model because it's the current state-of-the-art for semantic search. It maps sentences to a 768-dimensional vector space where we can mathematically measure the distance between a user's text and concepts like 'Gender' or 'Race'."

---

## 📐 Concept 2: Cosine Similarity & Z-Scores
**Likely Question:** *"How do you measure bias mathematically? How do you know it's significant?"*

### What to Learn:
- **Cosine Similarity** measures the angle between two vectors.
    - 1.0 = Identical meaning
    - 0.0 = Unrelated
    - -1.0 = Opposite
- **Z-Score (Standard Score)**: Raw similarity isn't enough because some words are naturally closer than others.
    - We calculate the "average distance" in neutral text (the baseline).
    - The Z-score tells us **how many standard deviations** away from "neutral" the text is.

### The "Winning" Answer:
> "We don't just use raw similarity. We calculate **Cosine Similarity** to find the angle between the input text and identity terms. Then, we use **Z-Score Normalization** against a baseline of neutral business text. We only flag bias if the Z-score is greater than 2.0, which gives us a 95% statistical confidence interval that the association isn't random noise."

---

## 🤖 Concept 3: Ensemble Learning (Hate Speech)
**Likely Question:** *"Why do you use three different models for hate speech? Isn't one enough?"*

### What to Learn:
- **Ensemble Learning** means combining multiple models to get a better result than any single model could achieve.
- **Model 1 (Dynabench):** Good at *explicit* hate (slurs, swearing).
- **Model 2 (ToxiGen):** Good at *implicit* hate (subtle discrimination, "dog whistles").
- **Model 3 (Lexicon):** Good at specific symbols or known hate terms.

### The "Winning" Answer:
> "One model isn't enough because bias is complex. We use a **Weighted Ensemble** approach. We combine Facebook's Dynabench model to catch explicit slurs with Microsoft's ToxiGen model to catch implicit, subtle hate. By weighting them together (40% ToxiGen, 35% Dynabench, 25% Lexicon), we reduce false positives and catch nuanced bias that single models miss."

---

## 🧠 Concept 4: RAG-Lite & LLM Explanations
**Likely Question:** *"How does the AI explain the bias? Are you just prompting ChatGPT?"*

### What to Learn:
- You are using **Llama 3.2** (a 3-billion parameter model) running *locally* via Ollama.
- This is a **Privacy-First** approach—no data leaves the user's computer to go to OpenAI/Google.
- You provide the LLM with the *specific metadata* (Z-scores, flagged words) in the prompt.

### The "Winning" Answer:
> "We use a local instance of **Llama 3.2** via Ollama. We dynamically construct a prompt that feeds the LLM the exact statistical findings—the Z-scores and flagged categories—and ask it to translate those stats into a plain-English explanation for an HR manager. This keeps all sensitive data local and secure."

---

## ⚖️ Concept 5: The "Four-Fifths Rule" (Selection Bias)
**Likely Question:** *"How do you measure fairness in your CSV analysis?"*

### What to Learn:
- This is a legal standard used by the **EEOC** (Equal Employment Opportunity Commission) in the US.
- **Rule:** The selection rate for a protected group (e.g., women) must be at least **80% (4/5ths)** of the selection rate for the highest group (e.g., men).
- If it's lower, it's evidence of **Adverse Impact**.

### The "Winning" Answer:
> "For our CSV analysis, we implement the **EEOC's Four-Fifths Rule**. We calculate the selection rate for every demographic group and check if any group falls below 80% of the highest selection rate. This allows us to flag legally significant 'Adverse Impact' rather than just vague unfairness."

---

## 💣 Likely "Curveball" Questions (And How to Dodge Them)

**Q: "What if the text mentions 'women' in a positive way? Will you flag it?"**
> **A:** "Great question. That's why we use **WEAT/SEAT analysis** in parallel. It checks the *valence* (positive/negative association). If the association is strong but the sentiment is positive, our Explainer engine sees that context and won't describe it as harmful bias, though we might still flag it as a 'Positive Stereotype' if it generalizes too broadly."

**Q: "Is this model biased itself?"**
> **A:** "All AI models have some inherent bias. That's why we don't rely on just one. By using **sentence embeddings** (math-based) alongside **three different neural classifiers** (pattern-based) and a **hard-coded lexicon** (rule-based), we cross-reference findings to minimize the bias of any single tool."

**Q: "Can this handle other languages?"**
> **A:** "Currently, our models are optimized for English. However, because we use **Multilingual Sentence Transformers** (like `paraphrase-multilingual-mpnet-base-v2`), the mathematical core could easily be adapted to support 50+ languages with a simple config change."

---

## 📝 Summary: The Tech Stack to Memorize

1.  **Frontend:** Next.js, React, Tailwind, Plotly.js (Visualization).
2.  **Backend:** FastAPI, Python, SQLAlchemy (DB).
3.  **AI Engine:** Pytorch, Sentence-Transformers (`all-mpnet-base-v2`), HuggingFace Transformers.
4.  **Math:** Cosine Similarity, Z-Score, Cohen's d.
5.  **LLM:** Llama 3.2 (Local via Ollama).
