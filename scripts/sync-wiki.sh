#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# sync-wiki.sh — Synchronisiert agent_doc/ nach GitHub Pages (pages Branch)
#
# Voraussetzungen:
#   - rsvg-convert installiert (brew install librsvg)
#   - pages Branch muss existieren (einmalig: git checkout --orphan pages)
#
# Nutzung:
#   ./scripts/sync-wiki.sh              # Normaler Sync (commit + push)
#   ./scripts/sync-wiki.sh --dry-run    # Nur transformieren, kein commit/push
# ============================================================================

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
    echo "[DRY-RUN] Kein commit/push — nur Transformation und Vorschau."
fi

# --- Pfade ---
MAIN_REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PAGES_DIR="${MAIN_REPO_DIR}/../agentic-engineering-research-pages"
REMOTE_URL=$(git -C "$MAIN_REPO_DIR" remote get-url origin)

AEP_SRC="${MAIN_REPO_DIR}/agent_doc/01_agentic-engineering-patterns"
TUMR_SRC="${MAIN_REPO_DIR}/agent_doc/tool_use_memory_rag_patterns"
SZH_SRC="${MAIN_REPO_DIR}/agent_doc/skills_zero-to-hero"
SSF_SRC="${MAIN_REPO_DIR}/agent_doc/skill_systeme_frameworks"
CMA_SRC="${MAIN_REPO_DIR}/agent_doc/cobol-migration_aws"
GCC_SRC="${MAIN_REPO_DIR}/agent_doc/github_copilot_cli"
PTJ_SRC="${MAIN_REPO_DIR}/agent_doc/pl1_to_java"
TEMPLATES="${MAIN_REPO_DIR}/scripts/wiki-templates"

# --- Pages-Verzeichnis vorbereiten ---
if [[ "$DRY_RUN" == true ]] && [[ ! -d "$PAGES_DIR" ]]; then
    echo "[DRY-RUN] Pages-Verzeichnis nicht vorhanden — erstelle temporaeres Verzeichnis."
    mkdir -p "$PAGES_DIR"
elif [[ -d "$PAGES_DIR/.git" ]]; then
    echo "Pages-Repo gefunden — aktualisiere..."
    git -C "$PAGES_DIR" pull --rebase 2>/dev/null || true
elif [[ "$DRY_RUN" != true ]]; then
    echo "Klone pages Branch..."
    git clone --branch pages --single-branch "$REMOTE_URL" "$PAGES_DIR"
fi

# Inhalt wird additiv synchronisiert — bestehende Dateien werden ueberschrieben,
# aber nicht geloeschte Dateien entfernt. Fuer vollstaendigen Reset: manuell bereinigen.

# --- images/ Verzeichnis ---
PAGES_IMAGES="${PAGES_DIR}/images"
mkdir -p "$PAGES_IMAGES"

# ============================================================================
# SVG -> PNG Konvertierung
# ============================================================================
echo ""
echo "=== SVG -> PNG Konvertierung ==="

convert_svgs() {
    local src_dir="$1"
    local prefix="$2"
    local count=0

    for svg_file in "$src_dir"/svg/*.svg; do
        [[ -f "$svg_file" ]] || continue
        local base
        base=$(basename "$svg_file" .svg)
        local png_file="${PAGES_IMAGES}/${prefix}-${base}.png"

        rsvg-convert -w 1200 "$svg_file" -o "$png_file"
        count=$((count + 1))
    done
    echo "  ${prefix}: ${count} SVGs konvertiert"
}

convert_svgs "$AEP_SRC" "aep"
convert_svgs "$TUMR_SRC" "tumr"
convert_svgs "$SZH_SRC" "szh"
convert_svgs "$CMA_SRC" "cma"
convert_svgs "$GCC_SRC" "gcc"
convert_svgs "$PTJ_SRC" "ptj"

# ============================================================================
# Hilfsfunktion: Front-Matter voranstellen und SVG-Refs ersetzen
# ============================================================================
transform_file() {
    local src_path="$1"
    local dest_path="$2"
    local img_prefix="$3"
    local front_matter="$4"

    if [[ ! -f "$src_path" ]]; then
        echo "  WARNUNG: $src_path nicht gefunden — uebersprungen"
        return
    fi

    local content
    content=$(<"$src_path")

    # SVG-Referenzen -> PNG im images/ Verzeichnis
    content=$(printf '%s' "$content" | sed -E "s|\\]\\(svg/([^)]+)\\.svg\\)|](images/${img_prefix}-\\1.png)|g")

    # Front-Matter + Inhalt schreiben
    printf '%s\n\n%s\n' "$front_matter" "$content" > "$dest_path"
}

# ============================================================================
# AEP-Dateien transformieren
# ============================================================================
echo ""
echo "=== AEP-Dateien transformieren ==="

# sed-Ausdruecke fuer Kapitel-Link-Transformation
AEP_LINK_SED=""
AEP_LINK_SED="$AEP_LINK_SED -e s|](01_grundlagen\\.md)|](AEP-01-Grundlagen)|g"
AEP_LINK_SED="$AEP_LINK_SED -e s|](02_architektur_prinzipien\\.md)|](AEP-02-Architektur-Prinzipien)|g"
AEP_LINK_SED="$AEP_LINK_SED -e s|](03_workflow_patterns\\.md)|](AEP-03-Workflow-Patterns)|g"
AEP_LINK_SED="$AEP_LINK_SED -e s|](04_reasoning_planning_patterns\\.md)|](AEP-04-Reasoning-Planning-Patterns)|g"
AEP_LINK_SED="$AEP_LINK_SED -e s|](05_multi_agent_patterns\\.md)|](AEP-05-Multi-Agent-Patterns)|g"
AEP_LINK_SED="$AEP_LINK_SED -e s|](06_tool_use_context_engineering\\.md)|](AEP-06-Tool-Use-Context-Engineering)|g"
AEP_LINK_SED="$AEP_LINK_SED -e s|](07_resilience_error_handling\\.md)|](AEP-07-Resilience-Error-Handling)|g"
AEP_LINK_SED="$AEP_LINK_SED -e s|](08_safety_security_guardrails\\.md)|](AEP-08-Safety-Security-Guardrails)|g"
AEP_LINK_SED="$AEP_LINK_SED -e s|](09_human_in_the_loop\\.md)|](AEP-09-Human-in-the-Loop)|g"
AEP_LINK_SED="$AEP_LINK_SED -e s|](10_observability_evaluation\\.md)|](AEP-10-Observability-Evaluation)|g"
AEP_LINK_SED="$AEP_LINK_SED -e s|](11_frameworks_implementierung\\.md)|](AEP-11-Frameworks-Implementierung)|g"
AEP_LINK_SED="$AEP_LINK_SED -e s|](12_agentic_coding_patterns\\.md)|](AEP-12-Agentic-Coding-Patterns)|g"

# AEP Dateien: "quelldatei:wikiname:nav_order:titel" (eine Zeile pro Datei)
while IFS=: read -r src_file dest_name nav_order title; do
    [[ -z "$src_file" ]] && continue

    front_matter="---
title: \"${title}\"
parent: Agentic Engineering Patterns
nav_order: ${nav_order}
---"

    transform_file "${AEP_SRC}/${src_file}" "${PAGES_DIR}/${dest_name}.md" "aep" "$front_matter"

    # Kapitel-Links umschreiben
    sed -i '' $AEP_LINK_SED "${PAGES_DIR}/${dest_name}.md" 2>/dev/null || \
    sed -i    $AEP_LINK_SED "${PAGES_DIR}/${dest_name}.md"

    echo "  ${src_file} -> ${dest_name}.md"
done <<'AEP_EOF'
00_uebersicht.md:AEP-00-Uebersicht:1:Uebersicht
01_grundlagen.md:AEP-01-Grundlagen:2:01 Grundlagen
02_architektur_prinzipien.md:AEP-02-Architektur-Prinzipien:3:02 Architektur-Prinzipien
03_workflow_patterns.md:AEP-03-Workflow-Patterns:4:03 Workflow Patterns
04_reasoning_planning_patterns.md:AEP-04-Reasoning-Planning-Patterns:5:04 Reasoning und Planning
04_reasoning_planning_patterns_quellen.md:AEP-04-Reasoning-Planning-Quellen:6:04 Reasoning Quellen
05_multi_agent_patterns.md:AEP-05-Multi-Agent-Patterns:7:05 Multi-Agent Patterns
06_tool_use_context_engineering.md:AEP-06-Tool-Use-Context-Engineering:8:06 Tool Use und Context
07_resilience_error_handling.md:AEP-07-Resilience-Error-Handling:9:07 Resilience
08_safety_security_guardrails.md:AEP-08-Safety-Security-Guardrails:10:08 Safety und Security
09_human_in_the_loop.md:AEP-09-Human-in-the-Loop:11:09 Human-in-the-Loop
10_observability_evaluation.md:AEP-10-Observability-Evaluation:12:10 Observability
11_frameworks_implementierung.md:AEP-11-Frameworks-Implementierung:13:11 Frameworks
12_agentic_coding_patterns.md:AEP-12-Agentic-Coding-Patterns:14:12 Agentic Coding
_quellen.md:AEP-Quellen:15:Quellen
AEP_EOF

# ============================================================================
# SZH-Dateien transformieren (Skills Zero to Hero)
# ============================================================================
echo ""
echo "=== SZH-Dateien transformieren ==="

SZH_LINK_SED=""
SZH_LINK_SED="$SZH_LINK_SED -e s|](01_grundlagen_skills\\.md)|](SZH-01-Grundlagen-Skills)|g"
SZH_LINK_SED="$SZH_LINK_SED -e s|](02_agent_skills_standard\\.md)|](SZH-02-Agent-Skills-Standard)|g"
SZH_LINK_SED="$SZH_LINK_SED -e s|](03_skill_anatomie\\.md)|](SZH-03-Skill-Anatomie)|g"
SZH_LINK_SED="$SZH_LINK_SED -e s|](04_skill_prinzipien\\.md)|](SZH-04-Skill-Prinzipien)|g"
SZH_LINK_SED="$SZH_LINK_SED -e s|](05_skill_patterns\\.md)|](SZH-05-Skill-Patterns)|g"
SZH_LINK_SED="$SZH_LINK_SED -e s|](06_skill_planung_erstellung\\.md)|](SZH-06-Skill-Planung-Erstellung)|g"
SZH_LINK_SED="$SZH_LINK_SED -e s|](07_claude_code_skills\\.md)|](SZH-07-Claude-Code-Skills)|g"
SZH_LINK_SED="$SZH_LINK_SED -e s|](08_skill_oekosystem\\.md)|](SZH-08-Skill-Oekosystem)|g"
SZH_LINK_SED="$SZH_LINK_SED -e s|](09_advanced_patterns\\.md)|](SZH-09-Advanced-Patterns)|g"
SZH_LINK_SED="$SZH_LINK_SED -e s|](10_anti_patterns\\.md)|](SZH-10-Anti-Patterns)|g"
SZH_LINK_SED="$SZH_LINK_SED -e s|](11_skill_landkarte\\.md)|](SZH-11-Skill-Landkarte)|g"

while IFS=: read -r src_file dest_name nav_order title; do
    [[ -z "$src_file" ]] && continue

    front_matter="---
title: \"${title}\"
parent: Skills Zero to Hero
nav_order: ${nav_order}
---"

    transform_file "${SZH_SRC}/${src_file}" "${PAGES_DIR}/${dest_name}.md" "szh" "$front_matter"

    # Kapitel-Links umschreiben
    sed -i '' $SZH_LINK_SED "${PAGES_DIR}/${dest_name}.md" 2>/dev/null || \
    sed -i    $SZH_LINK_SED "${PAGES_DIR}/${dest_name}.md"

    echo "  ${src_file} -> ${dest_name}.md"
done <<'SZH_EOF'
00_uebersicht.md:SZH-00-Uebersicht:1:Uebersicht
01_grundlagen_skills.md:SZH-01-Grundlagen-Skills:2:01 Grundlagen Skills
02_agent_skills_standard.md:SZH-02-Agent-Skills-Standard:3:02 Agent Skills Standard
03_skill_anatomie.md:SZH-03-Skill-Anatomie:4:03 Skill Anatomie
04_skill_prinzipien.md:SZH-04-Skill-Prinzipien:5:04 Skill Prinzipien
05_skill_patterns.md:SZH-05-Skill-Patterns:6:05 Skill Patterns
06_skill_planung_erstellung.md:SZH-06-Skill-Planung-Erstellung:7:06 Skill Planung und Erstellung
07_claude_code_skills.md:SZH-07-Claude-Code-Skills:8:07 Claude Code Skills
08_skill_oekosystem.md:SZH-08-Skill-Oekosystem:9:08 Skill Oekosystem
09_advanced_patterns.md:SZH-09-Advanced-Patterns:10:09 Advanced Patterns
10_anti_patterns.md:SZH-10-Anti-Patterns:11:10 Anti-Patterns
11_skill_landkarte.md:SZH-11-Skill-Landkarte:12:11 Skill Landkarte
_quellen.md:SZH-Quellen:13:Quellen
skill_design_best_practices_quellen.md:SZH-Best-Practices-Quellen:14:Best Practices Quellen
SZH_EOF

# ============================================================================
# SSF-Dateien transformieren (Skill-Systeme und Frameworks)
# ============================================================================
echo ""
echo "=== SSF-Dateien transformieren ==="

# Backtick-Referenzen -> Standard-Markdown-Links
SSF_LINK_SED=""
SSF_LINK_SED="$SSF_LINK_SED -e s|\`00_uebersicht\\.md\`|[00_uebersicht](SSF-00-Uebersicht)|g"
SSF_LINK_SED="$SSF_LINK_SED -e s|\`01_langchain_langgraph\\.md\`|[01_langchain_langgraph](SSF-01-LangChain-LangGraph)|g"
SSF_LINK_SED="$SSF_LINK_SED -e s|\`02_crewai\\.md\`|[02_crewai](SSF-02-CrewAI)|g"
SSF_LINK_SED="$SSF_LINK_SED -e s|\`03_autogpt_autogen\\.md\`|[03_autogpt_autogen](SSF-03-AutoGPT-AutoGen)|g"
SSF_LINK_SED="$SSF_LINK_SED -e s|\`04_openai_agents_sdk\\.md\`|[04_openai_agents_sdk](SSF-04-OpenAI-Agents-SDK)|g"
SSF_LINK_SED="$SSF_LINK_SED -e s|\`05_claude_agent_sdk\\.md\`|[05_claude_agent_sdk](SSF-05-Claude-Agent-SDK)|g"
SSF_LINK_SED="$SSF_LINK_SED -e s|\`06_semantic_kernel\\.md\`|[06_semantic_kernel](SSF-06-Semantic-Kernel)|g"
SSF_LINK_SED="$SSF_LINK_SED -e s|\`07_amazon_bedrock_agents\\.md\`|[07_amazon_bedrock_agents](SSF-07-Amazon-Bedrock-Agents)|g"
SSF_LINK_SED="$SSF_LINK_SED -e s|\`08_vergleich_und_best_practices\\.md\`|[08_vergleich_und_best_practices](SSF-08-Vergleich-und-Best-Practices)|g"
SSF_LINK_SED="$SSF_LINK_SED -e s|\`_quellen\\.md\`|[_quellen](SSF-Quellen)|g"

while IFS=: read -r src_file dest_name nav_order title; do
    [[ -z "$src_file" ]] && continue

    front_matter="---
title: \"${title}\"
parent: Skill-Systeme und Frameworks
nav_order: ${nav_order}
---"

    transform_file "${SSF_SRC}/${src_file}" "${PAGES_DIR}/${dest_name}.md" "szh" "$front_matter"

    # Cross-Directory SVG-Referenzen umschreiben (../skills_zero-to-hero/svg/ -> images/szh-)
    sed -i '' -E "s|\]\(\.\./skills_zero-to-hero/svg/([^)]+)\.svg\)|](images/szh-\1.png)|g" "${PAGES_DIR}/${dest_name}.md" 2>/dev/null || \
    sed -i    -E "s|\]\(\.\./skills_zero-to-hero/svg/([^)]+)\.svg\)|](images/szh-\1.png)|g" "${PAGES_DIR}/${dest_name}.md"

    # Backtick-Referenzen umschreiben
    sed -i '' $SSF_LINK_SED "${PAGES_DIR}/${dest_name}.md" 2>/dev/null || \
    sed -i    $SSF_LINK_SED "${PAGES_DIR}/${dest_name}.md"

    echo "  ${src_file} -> ${dest_name}.md"
done <<'SSF_EOF'
00_uebersicht.md:SSF-00-Uebersicht:1:Uebersicht
01_langchain_langgraph.md:SSF-01-LangChain-LangGraph:2:01 LangChain und LangGraph
02_crewai.md:SSF-02-CrewAI:3:02 CrewAI
03_autogpt_autogen.md:SSF-03-AutoGPT-AutoGen:4:03 AutoGPT und AutoGen
04_openai_agents_sdk.md:SSF-04-OpenAI-Agents-SDK:5:04 OpenAI Agents SDK
05_claude_agent_sdk.md:SSF-05-Claude-Agent-SDK:6:05 Claude Agent SDK
06_semantic_kernel.md:SSF-06-Semantic-Kernel:7:06 Semantic Kernel
07_amazon_bedrock_agents.md:SSF-07-Amazon-Bedrock-Agents:8:07 Amazon Bedrock Agents
08_vergleich_und_best_practices.md:SSF-08-Vergleich-und-Best-Practices:9:08 Vergleich und Best Practices
_quellen.md:SSF-Quellen:10:Quellen
SSF_EOF

# ============================================================================
# TUMR-Dateien transformieren
# ============================================================================
echo ""
echo "=== TUMR-Dateien transformieren ==="

# Backtick-Referenzen -> Standard-Markdown-Links
TUMR_LINK_SED=""
TUMR_LINK_SED="$TUMR_LINK_SED -e s|\`tool_use_patterns\\.md\`|[tool_use_patterns](TUMR-Tool-Use-Patterns)|g"
TUMR_LINK_SED="$TUMR_LINK_SED -e s|\`memory_patterns\\.md\`|[memory_patterns](TUMR-Memory-Patterns)|g"
TUMR_LINK_SED="$TUMR_LINK_SED -e s|\`rag_patterns\\.md\`|[rag_patterns](TUMR-RAG-Patterns)|g"
TUMR_LINK_SED="$TUMR_LINK_SED -e s|\`context_engineering\\.md\`|[context_engineering](TUMR-Context-Engineering)|g"
TUMR_LINK_SED="$TUMR_LINK_SED -e s|\`mcp_patterns\\.md\`|[mcp_patterns](TUMR-MCP-Patterns)|g"
TUMR_LINK_SED="$TUMR_LINK_SED -e s|\`_quellen\\.md\`|[_quellen](TUMR-Quellen)|g"

# TUMR Dateien: "quelldatei:wikiname:nav_order:titel" (eine Zeile pro Datei)
while IFS=: read -r src_file dest_name nav_order title; do
    [[ -z "$src_file" ]] && continue

    front_matter="---
title: \"${title}\"
parent: \"Tool Use, Memory & RAG\"
nav_order: ${nav_order}
---"

    transform_file "${TUMR_SRC}/${src_file}" "${PAGES_DIR}/${dest_name}.md" "tumr" "$front_matter"

    # Backtick-Referenzen umschreiben
    sed -i '' $TUMR_LINK_SED "${PAGES_DIR}/${dest_name}.md" 2>/dev/null || \
    sed -i    $TUMR_LINK_SED "${PAGES_DIR}/${dest_name}.md"

    echo "  ${src_file} -> ${dest_name}.md"
done <<'TUMR_EOF'
gesamtbericht.md:TUMR-Gesamtbericht:1:Gesamtbericht
tool_use_patterns.md:TUMR-Tool-Use-Patterns:2:Tool Use Patterns
memory_patterns.md:TUMR-Memory-Patterns:3:Memory Patterns
rag_patterns.md:TUMR-RAG-Patterns:4:RAG Patterns
context_engineering.md:TUMR-Context-Engineering:5:Context Engineering
mcp_patterns.md:TUMR-MCP-Patterns:6:MCP Patterns
_quellen.md:TUMR-Quellen:7:Quellen
TUMR_EOF

# ============================================================================
# CMA-Dateien transformieren (COBOL Migration mit AWS)
# ============================================================================
echo ""
echo "=== CMA-Dateien transformieren ==="

# Backtick-Referenzen -> Standard-Markdown-Links (Cross-References zwischen CMA-Dokumenten)
CMA_LINK_SED=""
CMA_LINK_SED="$CMA_LINK_SED -e s|\`cobol_migrations_guide\\.md\`|[cobol_migrations_guide](CMA-00-Guide)|g"
CMA_LINK_SED="$CMA_LINK_SED -e s|\`aws_mainframe_modernization_deep_dive\\.md\`|[aws_mainframe_modernization_deep_dive](CMA-01-AWS-Mainframe-Modernization)|g"
CMA_LINK_SED="$CMA_LINK_SED -e s|\`aws_transform_deep_dive\\.md\`|[aws_transform_deep_dive](CMA-02-AWS-Transform)|g"
CMA_LINK_SED="$CMA_LINK_SED -e s|\`aws_migration_hub\\.md\`|[aws_migration_hub](CMA-03-AWS-Migration-Hub)|g"
CMA_LINK_SED="$CMA_LINK_SED -e s|\`cobol_to_java_aws_migrationsguide\\.md\`|[cobol_to_java_aws_migrationsguide](CMA-04-COBOL-zu-Java)|g"
CMA_LINK_SED="$CMA_LINK_SED -e s|\`best_practices_und_patterns\\.md\`|[best_practices_und_patterns](CMA-05-Best-Practices)|g"
CMA_LINK_SED="$CMA_LINK_SED -e s|\`cobol_migration_weitere_tools\\.md\`|[cobol_migration_weitere_tools](CMA-06-Weitere-Tools)|g"
CMA_LINK_SED="$CMA_LINK_SED -e s|\`_quellen\\.md\`|[_quellen](CMA-Quellen)|g"

while IFS=: read -r src_file dest_name nav_order title; do
    [[ -z "$src_file" ]] && continue

    front_matter="---
title: \"${title}\"
parent: \"COBOL Migration mit AWS\"
nav_order: ${nav_order}
---"

    transform_file "${CMA_SRC}/${src_file}" "${PAGES_DIR}/${dest_name}.md" "cma" "$front_matter"

    # Backtick-Referenzen umschreiben
    sed -i '' $CMA_LINK_SED "${PAGES_DIR}/${dest_name}.md" 2>/dev/null || \
    sed -i    $CMA_LINK_SED "${PAGES_DIR}/${dest_name}.md"

    echo "  ${src_file} -> ${dest_name}.md"
done <<'CMA_EOF'
cobol_migrations_guide.md:CMA-00-Guide:1:00 Guide und Decision Framework
aws_mainframe_modernization_deep_dive.md:CMA-01-AWS-Mainframe-Modernization:2:01 AWS Mainframe Modernization (M2)
aws_transform_deep_dive.md:CMA-02-AWS-Transform:3:02 AWS Transform Deep Dive
aws_migration_hub.md:CMA-03-AWS-Migration-Hub:4:03 AWS Migration Hub
cobol_to_java_aws_migrationsguide.md:CMA-04-COBOL-zu-Java:5:04 COBOL zu Java mit AWS
best_practices_und_patterns.md:CMA-05-Best-Practices:6:05 Best Practices und Patterns
cobol_migration_weitere_tools.md:CMA-06-Weitere-Tools:7:06 Weitere Tools (IBM, Google, Azure, ISVs)
_quellen.md:CMA-Quellen:8:Quellen
CMA_EOF

# ============================================================================
# GCC-Dateien transformieren (GitHub Copilot CLI)
# ============================================================================
echo ""
echo "=== GCC-Dateien transformieren ==="

# Backtick-Referenzen -> Standard-Markdown-Links (Cross-References zwischen GCC-Dokumenten)
GCC_LINK_SED=""
GCC_LINK_SED="$GCC_LINK_SED -e s|\`feature_uebersicht\\.md\`|[feature_uebersicht](GCC-01-Feature-Uebersicht)|g"
GCC_LINK_SED="$GCC_LINK_SED -e s|\`installations_und_setup_guide\\.md\`|[installations_und_setup_guide](GCC-02-Installation-und-Setup)|g"
GCC_LINK_SED="$GCC_LINK_SED -e s|\`senior_developer_guide\\.md\`|[senior_developer_guide](GCC-03-Senior-Developer-Guide)|g"
GCC_LINK_SED="$GCC_LINK_SED -e s|\`agentic_engineering_mcp_security\\.md\`|[agentic_engineering_mcp_security](GCC-04-Agentic-MCP-Security)|g"
GCC_LINK_SED="$GCC_LINK_SED -e s|\`workflows_und_vergleich\\.md\`|[workflows_und_vergleich](GCC-05-Workflows-und-Vergleich)|g"
GCC_LINK_SED="$GCC_LINK_SED -e s|\`cheat_sheet\\.md\`|[cheat_sheet](GCC-06-Cheat-Sheet)|g"
GCC_LINK_SED="$GCC_LINK_SED -e s|\`_quellen\\.md\`|[_quellen](GCC-Quellen)|g"

while IFS=: read -r src_file dest_name nav_order title; do
    [[ -z "$src_file" ]] && continue

    front_matter="---
title: \"${title}\"
parent: \"GitHub Copilot CLI\"
nav_order: ${nav_order}
---"

    transform_file "${GCC_SRC}/${src_file}" "${PAGES_DIR}/${dest_name}.md" "gcc" "$front_matter"

    # Backtick-Referenzen umschreiben
    sed -i '' $GCC_LINK_SED "${PAGES_DIR}/${dest_name}.md" 2>/dev/null || \
    sed -i    $GCC_LINK_SED "${PAGES_DIR}/${dest_name}.md"

    echo "  ${src_file} -> ${dest_name}.md"
done <<'GCC_EOF'
feature_uebersicht.md:GCC-01-Feature-Uebersicht:1:01 Feature Uebersicht
installations_und_setup_guide.md:GCC-02-Installation-und-Setup:2:02 Installation und Setup
senior_developer_guide.md:GCC-03-Senior-Developer-Guide:3:03 Senior Developer Guide
agentic_engineering_mcp_security.md:GCC-04-Agentic-MCP-Security:4:04 Agentic Engineering, MCP, Security
workflows_und_vergleich.md:GCC-05-Workflows-und-Vergleich:5:05 Workflows und Vergleich
cheat_sheet.md:GCC-06-Cheat-Sheet:6:06 Cheat Sheet
_quellen.md:GCC-Quellen:7:Quellen
GCC_EOF

# ============================================================================
# PTJ-Dateien transformieren (PL/I zu Java Migration)
# ============================================================================
echo ""
echo "=== PTJ-Dateien transformieren ==="

# Backtick-Referenzen -> Standard-Markdown-Links
PTJ_LINK_SED=""
PTJ_LINK_SED="$PTJ_LINK_SED -e s|\`pl1_zu_java_hauptguide\\.md\`|[pl1_zu_java_hauptguide](PTJ-00-Hauptguide)|g"
PTJ_LINK_SED="$PTJ_LINK_SED -e s|\`pl1_sprachmerkmale_und_konvertierung\\.md\`|[pl1_sprachmerkmale_und_konvertierung](PTJ-01-Sprachmerkmale)|g"
PTJ_LINK_SED="$PTJ_LINK_SED -e s|\`aws_feature_uebersicht_fuer_pl1\\.md\`|[aws_feature_uebersicht_fuer_pl1](PTJ-02-AWS-Features)|g"
PTJ_LINK_SED="$PTJ_LINK_SED -e s|\`agentic_engineering_workflows\\.md\`|[agentic_engineering_workflows](PTJ-03-Agentic-Workflows)|g"
PTJ_LINK_SED="$PTJ_LINK_SED -e s|\`migration_50_prozent_szenarien\\.md\`|[migration_50_prozent_szenarien](PTJ-04-50-Prozent-Szenarien)|g"
PTJ_LINK_SED="$PTJ_LINK_SED -e s|\`testabdeckung_und_teststrategien\\.md\`|[testabdeckung_und_teststrategien](PTJ-05-Teststrategien)|g"
PTJ_LINK_SED="$PTJ_LINK_SED -e s|\`best_practices_pl1\\.md\`|[best_practices_pl1](PTJ-06-Best-Practices)|g"
PTJ_LINK_SED="$PTJ_LINK_SED -e s|\`loesungshorizont_erweitert\\.md\`|[loesungshorizont_erweitert](PTJ-07-Loesungshorizont)|g"
PTJ_LINK_SED="$PTJ_LINK_SED -e s|\`_quellen\\.md\`|[_quellen](PTJ-Quellen)|g"

while IFS=: read -r src_file dest_name nav_order title; do
    [[ -z "$src_file" ]] && continue

    front_matter="---
title: \"${title}\"
parent: \"PL/I zu Java Migration\"
nav_order: ${nav_order}
---"

    transform_file "${PTJ_SRC}/${src_file}" "${PAGES_DIR}/${dest_name}.md" "ptj" "$front_matter"

    # Backtick-Referenzen umschreiben
    sed -i '' $PTJ_LINK_SED "${PAGES_DIR}/${dest_name}.md" 2>/dev/null || \
    sed -i    $PTJ_LINK_SED "${PAGES_DIR}/${dest_name}.md"

    echo "  ${src_file} -> ${dest_name}.md"
done <<'PTJ_EOF'
pl1_zu_java_hauptguide.md:PTJ-00-Hauptguide:1:00 Hauptguide
pl1_sprachmerkmale_und_konvertierung.md:PTJ-01-Sprachmerkmale:2:01 Sprachmerkmale und Konvertierung
aws_feature_uebersicht_fuer_pl1.md:PTJ-02-AWS-Features:3:02 AWS Feature Uebersicht
agentic_engineering_workflows.md:PTJ-03-Agentic-Workflows:4:03 Agentic Engineering Workflows
migration_50_prozent_szenarien.md:PTJ-04-50-Prozent-Szenarien:5:04 50-Prozent-Szenarien
testabdeckung_und_teststrategien.md:PTJ-05-Teststrategien:6:05 Testabdeckung und Teststrategien
best_practices_pl1.md:PTJ-06-Best-Practices:7:06 Best Practices
loesungshorizont_erweitert.md:PTJ-07-Loesungshorizont:8:07 Erweiterter Loesungshorizont
_quellen.md:PTJ-Quellen:9:Quellen
PTJ_EOF

# ============================================================================
# Templates kopieren
# ============================================================================
echo ""
echo "=== Templates kopieren ==="
cp "$TEMPLATES/index.md"                       "$PAGES_DIR/index.md"
cp "$TEMPLATES/_config.yml"                    "$PAGES_DIR/_config.yml"
cp "$TEMPLATES/agentic-engineering-patterns.md" "$PAGES_DIR/agentic-engineering-patterns.md"
cp "$TEMPLATES/tool-use-memory-rag.md"          "$PAGES_DIR/tool-use-memory-rag.md"
cp "$TEMPLATES/skills-zero-to-hero.md"          "$PAGES_DIR/skills-zero-to-hero.md"
cp "$TEMPLATES/skill-systeme-frameworks.md"     "$PAGES_DIR/skill-systeme-frameworks.md"
cp "$TEMPLATES/cobol-migration-aws.md"          "$PAGES_DIR/cobol-migration-aws.md"
cp "$TEMPLATES/github-copilot-cli.md"           "$PAGES_DIR/github-copilot-cli.md"
cp "$TEMPLATES/pl1-to-java.md"                 "$PAGES_DIR/pl1-to-java.md"
cp "$TEMPLATES/workflow.svg"                    "$PAGES_IMAGES/workflow.svg"
rsvg-convert -w 1400 "$TEMPLATES/workflow.svg" -o "$PAGES_IMAGES/workflow.png"
echo "  index.md, _config.yml, Sektions-Seiten, workflow.svg/png kopiert"

# ============================================================================
# Commit und Push
# ============================================================================
echo ""
if [[ "$DRY_RUN" == true ]]; then
    echo "=== DRY-RUN Ergebnis ==="
    echo ""
    echo "Markdown-Dateien:"
    find "$PAGES_DIR" -maxdepth 1 -name "*.md" -exec basename {} \; | sort
    echo ""
    png_count=$(find "$PAGES_IMAGES" -name "*.png" 2>/dev/null | wc -l | tr -d ' ')
    echo "${png_count} PNG-Dateien in images/"
    echo ""
    echo "Konfiguration:"
    find "$PAGES_DIR" -maxdepth 1 -name "*.yml" -exec basename {} \; | sort
    echo ""
    echo "Dry-Run abgeschlossen. Output: $PAGES_DIR"
else
    echo "=== Commit und Push ==="
    cd "$PAGES_DIR"
    git add -A
    if git diff --cached --quiet; then
        echo "Keine Aenderungen — nichts zu publizieren."
    else
        git commit -m "Sync von agent_doc/ — AEP, TUMR, SZH, SSF, CMA, GCC, PTJ ($(date +%Y-%m-%d))"
        git push
        echo "GitHub Pages erfolgreich aktualisiert."
    fi
fi
