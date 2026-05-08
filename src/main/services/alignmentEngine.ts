import type { AlignmentResult, FocusSession, VisionAnalysis } from "../../shared";

const PRODUCTIVE_CATEGORY_HINTS = new Set([
  "writing_document_editing",
  "coding",
  "design_visual_editing",
  "research_reading",
  "chat_messaging"
]);

const RISKY_CATEGORY_HINTS = new Set(["video_entertainment", "sns_feed_scrolling", "shopping"]);

export function scoreAlignment(session: FocusSession, analysis: VisionAnalysis): AlignmentResult {
  const goal = normalize(session.goal);
  const allowed = normalize(session.allowedActivities);
  const risky = normalize(session.riskyActivities);
  const observed = normalize([
    analysis.category.replaceAll("_", " "),
    analysis.visibleTextSummary,
    analysis.visualSummary,
    analysis.possibleRiskFlags.join(" ")
  ].join(" "));

  const allowedHit = tokenOverlap(observed, `${goal} ${allowed}`);
  const riskyHit = tokenOverlap(observed, risky);
  const categoryIsUsuallyProductive = PRODUCTIVE_CATEGORY_HINTS.has(analysis.category);
  const categoryIsUsuallyRisky = RISKY_CATEGORY_HINTS.has(analysis.category);

  if (analysis.confidence < 0.35 || analysis.category === "idle_unknown") {
    return { state: "unknown", confidence: analysis.confidence, rationale: "The screen activity was not clear enough to judge." };
  }

  if (allowedHit >= 1 || (categoryIsUsuallyProductive && riskyHit === 0)) {
    return {
      state: allowedHit >= 2 ? "aligned" : "weakly_aligned",
      confidence: Math.min(0.9, analysis.confidence + allowedHit * 0.08),
      rationale: "The visible activity appears related to the session goal or allowed activities."
    };
  }

  if (categoryIsUsuallyRisky || riskyHit >= 1 || analysis.possibleRiskFlags.length > 0) {
    return {
      state: analysis.confidence >= 0.55 ? "drift" : "unknown",
      confidence: analysis.confidence,
      rationale: analysis.confidence >= 0.55 ? "This may be drifting from your session goal." : "There are possible risk signals, but confidence is low."
    };
  }

  if (analysis.category === "video_tutorial" || analysis.category === "research_reading") {
    return {
      state: "weakly_aligned",
      confidence: Math.max(0.45, analysis.confidence - 0.05),
      rationale: "Current screen seems weakly related."
    };
  }

  return { state: "unknown", confidence: analysis.confidence, rationale: "The activity was not clearly aligned or drifting." };
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9가-힣\s]/gi, " ").replace(/\s+/g, " ").trim();
}

function tokenOverlap(left: string, right: string): number {
  const stopWords = new Set(["the", "and", "for", "with", "work", "on", "make", "current", "screen"]);
  const leftTokens = new Set(left.split(" ").filter((token) => token.length > 2 && !stopWords.has(token)));
  return right.split(" ").filter((token) => leftTokens.has(token) && !stopWords.has(token)).length;
}
