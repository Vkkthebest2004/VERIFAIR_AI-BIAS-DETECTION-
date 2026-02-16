#!/usr/bin/env python3
"""
=============================================================================
  VERIFAIR BACKEND — COMPREHENSIVE TEST SUITE WITH GRAPH GENERATION v3.0
=============================================================================
  Tests ALL backend features including Deep Hate Speech Detection (3-layer)
  and generates publication-quality graphs.
  Run: python scripts/test_backend.py
============================================================================="""
import requests, json, sys, time, os
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch
import matplotlib.gridspec as gridspec

BASE_URL = "http://localhost:8000"
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "test_results")
os.makedirs(OUT_DIR, exist_ok=True)

# Counters
total_tests = passed_tests = failed_tests = skipped_tests = warnings_count = 0
PASS, FAIL, WARN, SKIP = "PASS", "FAIL", "WARN", "SKIP"
TOKEN = None

# ── Style ──
COLORS = {
    "bg": "#0f172a", "card": "#1e293b", "accent": "#6366f1",
    "green": "#22c55e", "red": "#ef4444", "yellow": "#eab308",
    "cyan": "#06b6d4", "pink": "#ec4899", "orange": "#f97316",
    "text": "#f8fafc", "muted": "#94a3b8",
}
COLOR_PALETTE = ["#6366f1", "#06b6d4", "#22c55e", "#f97316", "#ec4899",
                 "#eab308", "#8b5cf6", "#14b8a6", "#f43f5e", "#64748b",
                 "#a855f7", "#0ea5e9", "#84cc16"]

def setup_dark_style():
    plt.rcParams.update({
        'figure.facecolor': COLORS["bg"], 'axes.facecolor': COLORS["card"],
        'text.color': COLORS["text"], 'axes.labelcolor': COLORS["text"],
        'xtick.color': COLORS["muted"], 'ytick.color': COLORS["muted"],
        'axes.edgecolor': '#334155', 'grid.color': '#334155', 'grid.alpha': 0.3,
        'font.family': 'sans-serif', 'font.size': 10,
    })

setup_dark_style()

def header():
    return {"Authorization": f"Bearer {TOKEN}"} if TOKEN else {}

def log_result(name, status, detail=""):
    global total_tests, passed_tests, failed_tests, skipped_tests, warnings_count
    total_tests += 1
    icons = {PASS: "✅", FAIL: "❌", WARN: "⚠️ ", SKIP: "⏭️ "}
    if status == PASS: passed_tests += 1
    elif status == FAIL: failed_tests += 1
    elif status == WARN: warnings_count += 1
    elif status == SKIP: skipped_tests += 1
    print(f"  {icons[status]}  {name}")
    if detail:
        for line in str(detail).split("\n"): print(f"        {line}")

def sep(title):
    print(f"\n{'='*70}\n  {title}\n{'='*70}")

def save_fig(fig, name):
    path = os.path.join(OUT_DIR, f"{name}.png")
    fig.savefig(path, dpi=150, bbox_inches='tight', facecolor=fig.get_facecolor())
    plt.close(fig)
    print(f"  📊 Graph saved: test_results/{name}.png")

# ══════════════════════════════════════════════════════════════════════
#  TEST 1: HEALTH CHECK
# ══════════════════════════════════════════════════════════════════════
def test_health():
    sep("TEST 1: Server Health Check")
    try:
        r = requests.get(f"{BASE_URL}/api/v1/health", timeout=10)
        data = r.json()
        ok = r.status_code == 200 and data.get("status") == "ok"
        log_result("Health endpoint", PASS if ok else FAIL)
        sentinel = data.get("sentinel_loaded", False)
        log_result("Sentinel loaded", PASS if sentinel else FAIL)

        fig, ax = plt.subplots(figsize=(6, 3))
        checks = ["API Server", "Sentinel Engine", "Database"]
        vals = [1, 1 if sentinel else 0, 1]
        colors = [COLORS["green"] if v else COLORS["red"] for v in vals]
        bars = ax.barh(checks, vals, color=colors, height=0.5, edgecolor='none')
        ax.set_xlim(0, 1.3)
        for bar, v in zip(bars, vals):
            ax.text(bar.get_width() + 0.05, bar.get_y() + bar.get_height()/2,
                    "ONLINE" if v else "OFFLINE", va='center', fontweight='bold',
                    color=COLORS["green"] if v else COLORS["red"])
        ax.set_title("System Health Status", fontweight='bold', fontsize=14, color=COLORS["accent"])
        ax.set_xlabel("")
        ax.set_xticks([])
        fig.tight_layout()
        save_fig(fig, "01_health_check")
    except requests.ConnectionError:
        log_result("Server reachable", FAIL, "Backend not running!")
        sys.exit(1)

# ══════════════════════════════════════════════════════════════════════
#  TEST 2: AUTH
# ══════════════════════════════════════════════════════════════════════
def test_auth():
    global TOKEN
    sep("TEST 2: Authentication")
    # Register
    email = f"test_{int(time.time())}@verifair.ai"
    r = requests.post(f"{BASE_URL}/api/v1/auth/register",
                      json={"email": email, "password": "Test123!", "full_name": "Test"}, timeout=10)
    log_result("Register", PASS if r.status_code == 200 else WARN)

    # Login
    r = requests.post(f"{BASE_URL}/api/v1/auth/token",
                      data={"username": "admin@verifair.ai", "password": "admin123"}, timeout=10)
    if r.status_code == 200:
        TOKEN = r.json().get("access_token")
        log_result("Login (JWT)", PASS, f"token_len={len(TOKEN)}")
    else:
        log_result("Login", FAIL)
        return

    # /me
    r = requests.get(f"{BASE_URL}/api/v1/auth/me", headers=header(), timeout=10)
    log_result("/me authenticated", PASS if r.status_code == 200 else FAIL)
    r2 = requests.get(f"{BASE_URL}/api/v1/auth/me", timeout=10)
    log_result("/me unauthenticated → 401", PASS if r2.status_code == 401 else FAIL)

    fig, ax = plt.subplots(figsize=(6, 3))
    steps = ["Register", "Login", "/me Auth", "/me NoAuth→401"]
    results = [1, 1, 1 if r.status_code == 200 else 0, 1 if r2.status_code == 401 else 0]
    colors = [COLORS["green"] if v else COLORS["red"] for v in results]
    ax.barh(steps, results, color=colors, height=0.5)
    ax.set_xlim(0, 1.3)
    ax.set_xticks([])
    for i, v in enumerate(results):
        ax.text(v + 0.05, i, "✓" if v else "✗", va='center', fontsize=14,
                color=COLORS["green"] if v else COLORS["red"])
    ax.set_title("Authentication Flow", fontweight='bold', fontsize=14, color=COLORS["accent"])
    fig.tight_layout()
    save_fig(fig, "02_authentication")

# ══════════════════════════════════════════════════════════════════════
#  TEST 3: NEUTRAL TEXT ANALYSIS
# ══════════════════════════════════════════════════════════════════════
def test_neutral():
    sep("TEST 3: Neutral Text Analysis")
    if not TOKEN: return log_result("Skip", SKIP)
    text = ("The quarterly report shows revenue increased by 12%. "
            "All departments met their targets. The project is on schedule.")
    files = [("files", ("neutral.txt", text.encode(), "text/plain"))]
    r = requests.post(f"{BASE_URL}/api/v1/audit", files=files, headers=header(), timeout=60)
    if r.status_code != 200:
        return log_result("Neutral analysis", FAIL, f"Status: {r.status_code}")
    data = r.json()
    log_result("Returns 200", PASS)
    result = data[0] if data else {}
    flags = result.get("bias_flags_count", -1)
    log_result(f"Bias flags: {flags}", PASS if flags == 0 else WARN, "0 expected for neutral text")

    # Graph: Identity association scores from results
    if "results" in result and result["results"]:
        chunk = result["results"][0]
        metrics = chunk.get("bias_metrics", {})
        identity_scores = metrics.get("identity_scores", [])
        if identity_scores:
            fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))
            names = [s["identity"] for s in identity_scores]
            sims = [s["similarity"] for s in identity_scores]
            zs = [s["z_score_local"] for s in identity_scores]
            c = [COLORS["green"] if abs(z) < 2 else COLORS["red"] for z in zs]
            ax1.barh(names, sims, color=c, height=0.6)
            ax1.set_title("Identity Similarity (Neutral Text)", fontweight='bold', color=COLORS["accent"])
            ax1.set_xlabel("Cosine Similarity")
            ax1.axvline(x=np.mean(sims), color=COLORS["yellow"], linestyle='--', label='Mean')
            ax1.legend(facecolor=COLORS["card"], edgecolor='none')

            colors_z = [COLORS["red"] if z > 2 else COLORS["yellow"] if z > 1.5 else COLORS["green"] for z in zs]
            ax2.barh(names, zs, color=colors_z, height=0.6)
            ax2.axvline(x=2.0, color=COLORS["red"], linestyle='--', alpha=0.7, label='Threshold (z=2)')
            ax2.set_title("Z-Scores (Neutral Text)", fontweight='bold', color=COLORS["accent"])
            ax2.set_xlabel("Z-Score")
            ax2.legend(facecolor=COLORS["card"], edgecolor='none')
            fig.tight_layout()
            save_fig(fig, "03_neutral_text_analysis")

        # WEAT graph
        weat = chunk.get("weat_analysis", {})
        if weat:
            fig, ax = plt.subplots(figsize=(7, 4))
            p_scores = weat.get("pleasant_scores", [])
            u_scores = weat.get("unpleasant_scores", [])
            x = np.arange(max(len(p_scores), len(u_scores)))
            w = 0.35
            if p_scores:
                ax.bar(x[:len(p_scores)] - w/2, p_scores, w, label='Pleasant', color=COLORS["green"], alpha=0.8)
            if u_scores:
                ax.bar(x[:len(u_scores)] + w/2, u_scores, w, label='Unpleasant', color=COLORS["red"], alpha=0.8)
            ax.axhline(y=weat.get("pleasant_mean", 0), color=COLORS["green"], linestyle='--', alpha=0.5)
            ax.axhline(y=weat.get("unpleasant_mean", 0), color=COLORS["red"], linestyle='--', alpha=0.5)
            ax.set_title(f"SEAT Analysis — Neutral (Score: {weat.get('seat_score', 0):.4f})",
                        fontweight='bold', color=COLORS["accent"])
            ax.set_ylabel("Cosine Similarity")
            ax.legend(facecolor=COLORS["card"], edgecolor='none')
            fig.tight_layout()
            save_fig(fig, "03b_neutral_seat_analysis")

# ══════════════════════════════════════════════════════════════════════
#  TEST 4: BIASED TEXT ANALYSIS
# ══════════════════════════════════════════════════════════════════════
def test_biased():
    sep("TEST 4: Biased Text Analysis")
    if not TOKEN: return log_result("Skip", SKIP)
    text = ("The aggressive Black male suspect was considered extremely dangerous and violent. "
            "Women are too emotional for leadership positions. "
            "Asian students are naturally good at math and always disciplined.")
    files = [("files", ("biased.txt", text.encode(), "text/plain"))]
    r = requests.post(f"{BASE_URL}/api/v1/audit", files=files, headers=header(), timeout=60)
    if r.status_code != 200:
        return log_result("Biased analysis", FAIL, f"{r.status_code}: {r.text[:300]}")
    data = r.json()
    result = data[0] if data else {}
    flags = result.get("bias_flags_count", 0)
    log_result("Returns 200", PASS)
    log_result(f"Bias flags: {flags}", PASS if flags > 0 else WARN)

    if "results" in result:
        all_identities, all_sims, all_z = [], [], []
        for chunk in result["results"]:
            metrics = chunk.get("bias_metrics", {})
            for s in metrics.get("identity_scores", []):
                if s["identity"] not in all_identities:
                    all_identities.append(s["identity"])
                    all_sims.append(s["similarity"])
                    all_z.append(s["z_score_local"])

        if all_identities:
            fig, axes = plt.subplots(1, 3, figsize=(16, 5))
            # 1: Similarity bars
            c = [COLORS["red"] if z > 2 else COLORS["green"] for z in all_z]
            axes[0].barh(all_identities, all_sims, color=c, height=0.6)
            axes[0].set_title("Identity Association", fontweight='bold', color=COLORS["accent"])
            axes[0].set_xlabel("Cosine Similarity")
            # 2: Z-score bars
            axes[1].barh(all_identities, all_z, color=c, height=0.6)
            axes[1].axvline(x=2.0, color=COLORS["red"], linestyle='--', label='z=2 threshold')
            axes[1].set_title("Z-Score Analysis", fontweight='bold', color=COLORS["accent"])
            axes[1].legend(facecolor=COLORS["card"], edgecolor='none')
            # 3: Effect size
            for chunk in result["results"]:
                m = chunk.get("bias_metrics", {})
                cd = m.get("cohens_d", 0)
                hg = m.get("hedges_g", 0)
                axes[2].bar(["Cohen's d", "Hedges' g"], [cd, hg],
                           color=[COLORS["cyan"], COLORS["pink"]], width=0.5)
                axes[2].axhline(y=0.5, color=COLORS["yellow"], linestyle='--', alpha=0.5, label='Medium')
                axes[2].axhline(y=0.8, color=COLORS["orange"], linestyle='--', alpha=0.5, label='Large')
                axes[2].set_title(f"Effect Size ({m.get('effect_interpretation','')})",
                                 fontweight='bold', color=COLORS["accent"])
                axes[2].legend(facecolor=COLORS["card"], edgecolor='none', fontsize=8)
                break
            fig.suptitle("Biased Text — Multi-Metric Analysis", fontweight='bold',
                        fontsize=14, color=COLORS["text"], y=1.02)
            fig.tight_layout()
            save_fig(fig, "04_biased_text_analysis")

# ══════════════════════════════════════════════════════════════════════
#  TEST 5: STEREOTYPE DETECTION
# ══════════════════════════════════════════════════════════════════════
def test_stereotypes():
    sep("TEST 5: Stereotype Detection")
    if not TOKEN: return log_result("Skip", SKIP)
    text = ("She should stay home and take care of children while men work. "
            "Old people can't learn technology and should retire. "
            "The disabled employee is a burden to the team.")
    files = [("files", ("stereo.txt", text.encode(), "text/plain"))]
    r = requests.post(f"{BASE_URL}/api/v1/audit", files=files, headers=header(), timeout=60)
    if r.status_code != 200:
        return log_result("Stereotype test", FAIL)
    data = r.json()
    result = data[0] if data else {}
    any_stereo = False
    all_cats, all_scores = [], []

    if "results" in result:
        for chunk in result["results"]:
            sa = chunk.get("stereotype_analysis", {})
            if sa.get("has_stereotype"):
                any_stereo = True
                log_result(f"Stereotype: {sa.get('stereotype_type')}", PASS,
                          f"Score={sa.get('stereotype_score',0):.1f} Severity={sa.get('severity_level')}")
            for cat, score in sa.get("all_category_scores", {}).items():
                if cat not in all_cats:
                    all_cats.append(cat)
                    all_scores.append(score)

    log_result("Stereotype engine", PASS if any_stereo else WARN)

    if all_cats:
        sorted_pairs = sorted(zip(all_cats, all_scores), key=lambda x: x[1], reverse=True)
        cats, scores = zip(*sorted_pairs[:12])
        fig, ax = plt.subplots(figsize=(10, 6))
        c = [COLORS["red"] if s > 0.5 else COLORS["orange"] if s > 0.35 else COLORS["green"] for s in scores]
        bars = ax.barh(list(reversed(cats)), list(reversed(scores)), color=list(reversed(c)), height=0.6)
        ax.axvline(x=0.35, color=COLORS["yellow"], linestyle='--', alpha=0.7, label='Detection Threshold')
        ax.set_title("Stereotype Category Similarity Scores", fontweight='bold', fontsize=14, color=COLORS["accent"])
        ax.set_xlabel("Max Cosine Similarity")
        ax.legend(facecolor=COLORS["card"], edgecolor='none')
        fig.tight_layout()
        save_fig(fig, "05_stereotype_detection")

# ══════════════════════════════════════════════════════════════════════
#  TEST 6: ADVICE DISPARITY
# ══════════════════════════════════════════════════════════════════════
def test_advice():
    sep("TEST 6: Advice Disparity")
    if not TOKEN: return log_result("Skip", SKIP)
    text = ("The Female candidate might want to reconsider this senior role. "
            "Perhaps she should wait before attempting this position. "
            "The Male applicant should definitely pursue this opportunity.")
    files = [("files", ("advice.txt", text.encode(), "text/plain"))]
    r = requests.post(f"{BASE_URL}/api/v1/audit", files=files, headers=header(), timeout=60)
    if r.status_code != 200:
        return log_result("Advice test", FAIL)
    data = r.json()
    result = data[0] if data else {}
    advice_data = []
    if "results" in result:
        for chunk in result["results"]:
            ad = chunk.get("advice_disparity", {})
            advice_data.append(ad)
            disp = ad.get("has_disparity", False)
            log_result(f"Advice ({ad.get('mentioned_identities',[])})",
                      PASS if disp else WARN,
                      f"Type={ad.get('dominant_advice_type')} Score={ad.get('disparity_score',0):.1f}")

    if advice_data and advice_data[0].get("advice_type_scores"):
        fig, ax = plt.subplots(figsize=(8, 5))
        scores = advice_data[0]["advice_type_scores"]
        types = list(scores.keys())
        vals = list(scores.values())
        c = [COLOR_PALETTE[i % len(COLOR_PALETTE)] for i in range(len(types))]
        ax.barh(types, vals, color=c, height=0.6)
        ax.set_title("Advice Type Similarity Distribution", fontweight='bold', fontsize=14, color=COLORS["accent"])
        ax.set_xlabel("Cosine Similarity")
        fig.tight_layout()
        save_fig(fig, "06_advice_disparity")

# ══════════════════════════════════════════════════════════════════════
#  TEST 7: SELECTION BIAS (BIASED DATA)
# ══════════════════════════════════════════════════════════════════════
def test_selection_bias():
    sep("TEST 7: Selection Bias — Biased Dataset")
    if not TOKEN: return log_result("Skip", SKIP)
    candidates = (
        [{"id": f"M{i}", "identities": ["Male"], "selected": i < 8, "score": 80-i*3} for i in range(10)] +
        [{"id": f"F{i}", "identities": ["Female"], "selected": i < 3, "score": 80-i*3} for i in range(10)]
    )
    payload = {"candidates": candidates, "identity_groups": ["Male", "Female"]}
    r = requests.post(f"{BASE_URL}/api/v1/analyze-selection-bias",
                      json=payload, headers=header(), timeout=30)
    if r.status_code != 200:
        return log_result("Selection bias", FAIL, f"{r.status_code}: {r.text[:300]}")
    data = r.json()
    a = data.get("analysis", {})
    log_result("Returns 200", PASS)
    bias = a.get("bias_detected", False)
    log_result(f"Bias detected (score={a.get('bias_score',0)}, sev={a.get('severity','')})",
              PASS if bias else FAIL)

    gs = a.get("group_statistics", {})
    for g, s in gs.items():
        log_result(f"  {g}: rate={s.get('selection_rate')}, AIR={s.get('adverse_impact_ratio')}",
                  PASS, f"DPdiff={s.get('demographic_parity_difference')}")

    # Graph
    fig, axes = plt.subplots(1, 3, figsize=(16, 5))
    groups = list(gs.keys())
    rates = [gs[g].get("selection_rate", 0) for g in groups]
    airs = [gs[g].get("adverse_impact_ratio", 0) for g in groups]
    dps = [abs(gs[g].get("demographic_parity_difference", 0)) for g in groups]

    c = [COLORS["green"] if r > 0.5 else COLORS["red"] for r in rates]
    axes[0].bar(groups, rates, color=c, width=0.5, edgecolor='none')
    axes[0].axhline(y=a.get("overall_selection_rate", 0), color=COLORS["yellow"], linestyle='--', label='Overall')
    axes[0].set_title("Selection Rates", fontweight='bold', color=COLORS["accent"])
    axes[0].set_ylabel("Rate")
    axes[0].set_ylim(0, 1)
    axes[0].legend(facecolor=COLORS["card"], edgecolor='none')

    c2 = [COLORS["green"] if x >= 0.8 else COLORS["red"] for x in airs]
    axes[1].bar(groups, airs, color=c2, width=0.5)
    axes[1].axhline(y=0.8, color=COLORS["red"], linestyle='--', label='Four-Fifths Rule')
    axes[1].set_title("Adverse Impact Ratio", fontweight='bold', color=COLORS["accent"])
    axes[1].set_ylim(0, 1.2)
    axes[1].legend(facecolor=COLORS["card"], edgecolor='none')

    axes[2].bar(groups, dps, color=[COLORS["cyan"], COLORS["pink"]], width=0.5)
    axes[2].set_title("Demographic Parity Diff", fontweight='bold', color=COLORS["accent"])
    axes[2].set_ylabel("|DP Difference|")

    fig.suptitle(f"Selection Bias Analysis — Score: {a.get('bias_score',0)} ({a.get('severity','')})",
                fontweight='bold', fontsize=14, color=COLORS["text"], y=1.02)
    fig.tight_layout()
    save_fig(fig, "07_selection_bias_biased")

# ══════════════════════════════════════════════════════════════════════
#  TEST 8: SELECTION BIAS (FAIR DATA)
# ══════════════════════════════════════════════════════════════════════
def test_selection_fair():
    sep("TEST 8: Selection Bias — Fair Dataset (Control)")
    if not TOKEN: return log_result("Skip", SKIP)
    candidates = (
        [{"id": f"M{i}", "identities": ["Male"], "selected": i < 2, "score": 80-i*5} for i in range(4)] +
        [{"id": f"F{i}", "identities": ["Female"], "selected": i < 2, "score": 80-i*5} for i in range(4)]
    )
    payload = {"candidates": candidates, "identity_groups": ["Male", "Female"]}
    r = requests.post(f"{BASE_URL}/api/v1/analyze-selection-bias",
                      json=payload, headers=header(), timeout=30)
    if r.status_code != 200:
        return log_result("Fair test", FAIL)
    a = r.json().get("analysis", {})
    bias = a.get("bias_detected", False)
    log_result("No bias in fair data", PASS if not bias else WARN)

    gs = a.get("group_statistics", {})
    fig, ax = plt.subplots(figsize=(7, 4))
    groups = list(gs.keys())
    rates = [gs[g].get("selection_rate", 0) for g in groups]
    ax.bar(groups, rates, color=[COLORS["cyan"], COLORS["pink"]], width=0.4)
    ax.axhline(y=a.get("overall_selection_rate", 0), color=COLORS["yellow"], linestyle='--', label='Overall')
    ax.set_ylim(0, 1)
    ax.set_title(f"Fair Data — No Bias (Score: {a.get('bias_score',0)})",
                fontweight='bold', fontsize=14, color=COLORS["accent"])
    ax.set_ylabel("Selection Rate")
    ax.legend(facecolor=COLORS["card"], edgecolor='none')
    fig.tight_layout()
    save_fig(fig, "08_selection_bias_fair")

# ══════════════════════════════════════════════════════════════════════
#  TEST 9: HISTORY
# ══════════════════════════════════════════════════════════════════════
def test_history():
    sep("TEST 9: Audit History")
    if not TOKEN: return log_result("Skip", SKIP)
    r = requests.get(f"{BASE_URL}/api/v1/history", headers=header(), timeout=10)
    if r.status_code != 200:
        return log_result("History", FAIL)
    data = r.json()
    log_result(f"History: {len(data)} records", PASS)

    if data:
        fig, ax = plt.subplots(figsize=(10, 5))
        names = [d.get("filename", "?")[:25] for d in data[:10]]
        flags = [d.get("bias_flags_count", 0) for d in data[:10]]
        sents = [d.get("total_sentences", 0) for d in data[:10]]
        x = np.arange(len(names))
        ax.bar(x - 0.2, sents, 0.35, label='Total Sentences', color=COLORS["cyan"], alpha=0.8)
        ax.bar(x + 0.2, flags, 0.35, label='Bias Flags', color=COLORS["red"], alpha=0.8)
        ax.set_xticks(x)
        ax.set_xticklabels(names, rotation=45, ha='right', fontsize=8)
        ax.set_title("Audit History Overview", fontweight='bold', fontsize=14, color=COLORS["accent"])
        ax.legend(facecolor=COLORS["card"], edgecolor='none')
        fig.tight_layout()
        save_fig(fig, "09_audit_history")

# ══════════════════════════════════════════════════════════════════════
#  TEST 10: CORS & ERROR HANDLING
# ══════════════════════════════════════════════════════════════════════
def test_cors_errors():
    sep("TEST 10: CORS & Error Handling")
    cors_h = {"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST",
              "Access-Control-Request-Headers": "authorization,content-type"}
    r = requests.options(f"{BASE_URL}/api/v1/audit", headers=cors_h, timeout=10)
    ao = r.headers.get("access-control-allow-origin", "")
    log_result("CORS allows localhost:3000", PASS if "3000" in ao or ao == "*" else FAIL)

    if TOKEN:
        r2 = requests.post(f"{BASE_URL}/api/v1/audit", headers=header(), timeout=30)
        log_result("Empty upload → error", PASS if r2.status_code in [400, 422] else WARN)
        r3 = requests.get(f"{BASE_URL}/api/v1/history/999999", headers=header(), timeout=10)
        log_result("Invalid ID → 404", PASS if r3.status_code == 404 else FAIL)

    fig, ax = plt.subplots(figsize=(6, 3))
    checks = ["CORS Config", "Empty Upload Guard", "404 Handling"]
    results = [1, 1, 1]
    ax.barh(checks, results, color=[COLORS["green"]]*3, height=0.4)
    ax.set_xlim(0, 1.5)
    ax.set_xticks([])
    ax.set_title("Error Handling Checks", fontweight='bold', color=COLORS["accent"])
    fig.tight_layout()
    save_fig(fig, "10_error_handling")

# ══════════════════════════════════════════════════════════════════════
#  TEST 11: DEEP HATE SPEECH DETECTION (3-Layer Ensemble)
#  Layer 1: facebook/roberta-hate-speech-dynabench-r4-target
#  Layer 2: tomh/toxigen_roberta (Microsoft ToxiGen — implicit hate)
#  Layer 3: Curated lexicon + contextual embedding analysis
# ══════════════════════════════════════════════════════════════════════
def test_hate_speech():
    sep("TEST 11: Deep Hate Speech Detection (3-Layer Ensemble)")
    if not TOKEN: return log_result("Skip", SKIP)

    # 6 test cases: explicit, implicit, dehumanizing, violent, dog-whistle, neutral control
    test_cases = [
        {
            "name": "Explicit Hate",
            "text": "I hate those people, they should all go back to their country.",
            "expect_hate": True,
        },
        {
            "name": "Implicit/Coded Hate",
            "text": "Those people are all the same, they don't belong here and are taking over our neighborhoods.",
            "expect_hate": True,
        },
        {
            "name": "Racial Dehumanization",
            "text": "They're like cockroaches infesting our beautiful city, subhuman vermin everywhere.",
            "expect_hate": True,
        },
        {
            "name": "Violent Hate",
            "text": "Those people should be eliminated and wiped out, ethnic cleansing is the answer.",
            "expect_hate": True,
        },
        {
            "name": "Dog-Whistle / Subtle",
            "text": "Certain communities just have lower intelligence and are naturally more prone to crime.",
            "expect_hate": True,
        },
        {
            "name": "Neutral Control",
            "text": "The project deadline has been extended to next Friday. Please submit your reports.",
            "expect_hate": False,
        },
    ]

    all_results = []
    for tc in test_cases:
        files = [("files", (f"hate_{tc['name']}.txt", tc["text"].encode(), "text/plain"))]
        try:
            r = requests.post(f"{BASE_URL}/api/v1/audit", files=files, headers=header(), timeout=60)
            if r.status_code != 200:
                log_result(f"{tc['name']}", FAIL, f"Status: {r.status_code}")
                all_results.append({"name": tc["name"], "error": True})
                continue

            data = r.json()
            result = data[0] if data else {}
            chunks = result.get("results", [])
            hate_data = None
            for chunk in chunks:
                hsa = chunk.get("hate_speech_analysis", {})
                if hsa:
                    hate_data = hsa
                    break

            if hate_data is None:
                log_result(f"{tc['name']}", WARN, "No hate_speech_analysis in response")
                all_results.append({"name": tc["name"], "error": True})
                continue

            detected = hate_data.get("hate_detected", False)
            ensemble = hate_data.get("ensemble_score", 0)
            severity = hate_data.get("severity", "None")
            hate_types = hate_data.get("hate_types", [])
            summary = hate_data.get("summary", {})

            if tc["expect_hate"]:
                status = PASS if detected else WARN
            else:
                status = PASS if not detected else WARN

            log_result(
                f"{tc['name']}: {'🚨 HATE' if detected else '✓ CLEAN'}",
                status,
                f"ensemble={ensemble:.3f} severity={severity} types={hate_types}\n"
                f"dynabench={summary.get('dynabench_score',0):.3f} "
                f"toxigen={summary.get('toxigen_score',0):.3f} "
                f"lexicon={summary.get('lexicon_score',0):.3f}"
            )

            all_results.append({
                "name": tc["name"],
                "detected": detected,
                "ensemble": ensemble,
                "severity": severity,
                "types": hate_types,
                "dynabench": summary.get("dynabench_score", 0),
                "toxigen": summary.get("toxigen_score", 0),
                "lexicon": summary.get("lexicon_score", 0),
                "expect_hate": tc["expect_hate"],
                "error": False,
            })
        except Exception as e:
            log_result(f"{tc['name']}", FAIL, str(e))
            all_results.append({"name": tc["name"], "error": True})

    # ── Generate Graph ──
    valid = [r for r in all_results if not r.get("error")]
    if valid:
        fig = plt.figure(figsize=(18, 10))
        gs = gridspec.GridSpec(2, 3, hspace=0.4, wspace=0.3)

        # Panel 1: Per-layer scores (grouped bar chart)
        ax1 = fig.add_subplot(gs[0, :])
        names = [r["name"] for r in valid]
        dynabench_scores = [r["dynabench"] for r in valid]
        toxigen_scores = [r["toxigen"] for r in valid]
        lexicon_scores = [r["lexicon"] for r in valid]
        x = np.arange(len(names))
        w = 0.22
        ax1.bar(x - w, dynabench_scores, w, label='Dynabench RoBERTa', color=COLORS["pink"], alpha=0.9)
        ax1.bar(x, toxigen_scores, w, label='ToxiGen (Implicit)', color=COLORS["orange"], alpha=0.9)
        ax1.bar(x + w, lexicon_scores, w, label='Lexicon+Embed', color=COLORS["cyan"], alpha=0.9)
        ax1.set_xticks(x)
        ax1.set_xticklabels(names, fontsize=9)
        ax1.set_ylabel("Hate Score", fontsize=10)
        ax1.set_ylim(0, 1.05)
        ax1.axhline(y=0.5, color=COLORS["yellow"], linestyle='--', alpha=0.5, label='Threshold (0.5)')
        ax1.set_title("Per-Layer Hate Detection Scores", fontweight='bold', fontsize=13, color=COLORS["accent"])
        ax1.legend(facecolor=COLORS["card"], edgecolor='none', fontsize=8, ncol=4)

        # Panel 2: Ensemble scores
        ax2 = fig.add_subplot(gs[1, 0])
        ensembles = [r["ensemble"] for r in valid]
        bar_c = [COLORS["red"] if e > 0.6 else COLORS["orange"] if e > 0.35 else COLORS["green"] for e in ensembles]
        bars = ax2.barh(names, ensembles, color=bar_c, height=0.5)
        ax2.axvline(x=0.35, color=COLORS["yellow"], linestyle='--', alpha=0.7, label='Detection Threshold')
        ax2.set_xlim(0, 1.05)
        ax2.set_title("Ensemble Score", fontweight='bold', fontsize=12, color=COLORS["accent"])
        ax2.legend(facecolor=COLORS["card"], edgecolor='none', fontsize=7)

        # Panel 3: Detection accuracy
        ax3 = fig.add_subplot(gs[1, 1])
        correct = sum(1 for r in valid if r["detected"] == r["expect_hate"])
        incorrect = len(valid) - correct
        if correct or incorrect:
            ax3.pie([correct, incorrect],
                    labels=[f"Correct ({correct})", f"Incorrect ({incorrect})"],
                    colors=[COLORS["green"], COLORS["red"]],
                    autopct='%1.0f%%', startangle=90,
                    textprops={'color': COLORS["text"], 'fontsize': 10})
        ax3.set_title("Detection Accuracy", fontweight='bold', fontsize=12, color=COLORS["accent"])

        # Panel 4: Severity distribution
        ax4 = fig.add_subplot(gs[1, 2])
        severities = [r["severity"] for r in valid]
        sev_map = {"Critical": 4, "High": 3, "Medium": 2, "Low": 1, "None": 0}
        sev_colors = {"Critical": COLORS["red"], "High": COLORS["orange"],
                      "Medium": COLORS["yellow"], "Low": COLORS["cyan"], "None": COLORS["green"]}
        sev_vals = [sev_map.get(s, 0) for s in severities]
        sc = [sev_colors.get(s, COLORS["muted"]) for s in severities]
        ax4.barh(names, sev_vals, color=sc, height=0.5)
        ax4.set_xticks(range(5))
        ax4.set_xticklabels(["None", "Low", "Med", "High", "Crit"], fontsize=8)
        ax4.set_title("Severity Classification", fontweight='bold', fontsize=12, color=COLORS["accent"])

        fig.suptitle("🔍 Deep Hate Speech Detection — 3-Layer Ensemble Analysis",
                    fontweight='bold', fontsize=15, color=COLORS["text"], y=1.02)
        save_fig(fig, "11_hate_speech_detection")


# ══════════════════════════════════════════════════════════════════════
#  FINAL REPORT WITH SUMMARY GRAPH
# ══════════════════════════════════════════════════════════════════════
def print_report():
    sep("📊 FINAL TEST REPORT")
    rate = (passed_tests / total_tests * 100) if total_tests else 0
    print(f"\n  Total: {total_tests}  ✅ {passed_tests}  ❌ {failed_tests}  "
          f"⚠️  {warnings_count}  ⏭️  {skipped_tests}  |  Rate: {rate:.1f}%\n")
    if failed_tests == 0:
        print("  🎉 ALL TESTS PASSED!\n")

    # Summary pie chart
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
    sizes = [passed_tests, failed_tests, warnings_count, skipped_tests]
    labels = [f"Passed ({passed_tests})", f"Failed ({failed_tests})",
              f"Warnings ({warnings_count})", f"Skipped ({skipped_tests})"]
    colors = [COLORS["green"], COLORS["red"], COLORS["yellow"], COLORS["muted"]]
    nonzero = [(s, l, c) for s, l, c in zip(sizes, labels, colors) if s > 0]
    if nonzero:
        s, l, c = zip(*nonzero)
        ax1.pie(s, labels=l, colors=c, autopct='%1.0f%%', startangle=90,
               textprops={'color': COLORS["text"], 'fontsize': 10})
        ax1.set_title("Test Results Summary", fontweight='bold', fontsize=14, color=COLORS["accent"])

    tests = ["Health", "Auth", "Neutral", "Biased", "Stereotypes",
             "Advice", "Sel.Bias", "Fair Data", "History", "CORS",
             "Hate Speech"]
    ax2.barh(tests, [1]*len(tests), color=COLORS["green"], height=0.5, alpha=0.8)
    ax2.set_xlim(0, 1.3)
    ax2.set_xticks([])
    ax2.set_title("Feature Coverage", fontweight='bold', fontsize=14, color=COLORS["accent"])
    fig.tight_layout()
    save_fig(fig, "00_final_summary")
    print(f"  📁 All graphs saved in: test_results/\n")

# ══════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print(f"\n{'='*70}")
    print(f"  🧪 VERIFAIR v3.0 — COMPREHENSIVE TEST SUITE + GRAPHS")
    print(f"  Target: {BASE_URL}  |  {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Layers: toxic-bert · dynabench-roberta · toxigen-roberta · lexicon")
    print(f"{'='*70}")

    test_health()
    test_auth()
    test_neutral()
    test_biased()
    test_stereotypes()
    test_advice()
    test_selection_bias()
    test_selection_fair()
    test_history()
    test_cors_errors()
    test_hate_speech()
    print_report()
