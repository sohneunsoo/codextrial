import type { ActivityCategory, VisionAnalysis } from "../../shared";
import type { ScreenshotInput, VisionClassifier } from "./VisionClassifier";
import { nativeImage } from "electron";

const CATEGORY_KEYWORDS: Array<{ category: ActivityCategory; words: string[]; risk?: string }> = [
  { category: "design_visual_editing", words: ["powerpoint", "canva", "figma", "photoshop", "illustrator", "slide", "deck"] },
  { category: "coding", words: ["visual studio code", "typescript", "javascript", "github", "terminal", "powershell", "function"] },
  { category: "writing_document_editing", words: ["word", "docs", "notion", "editor", "document", "outline"] },
  { category: "research_reading", words: ["paper", "article", "wikipedia", "research", "documentation", "docs"] },
  { category: "video_tutorial", words: ["tutorial", "course", "lesson", "how to", "after effects", "premiere"] },
  { category: "video_entertainment", words: ["shorts", "netflix", "twitch", "music video"], risk: "entertainment video" },
  { category: "sns_feed_scrolling", words: ["instagram", "x.com", "twitter", "facebook", "reddit", "tiktok", "feed"], risk: "social feed" },
  { category: "chat_messaging", words: ["chatgpt", "claude", "slack", "discord", "kakao", "teams", "message"] },
  { category: "shopping", words: ["amazon", "coupang", "cart", "checkout", "shopping", "product"], risk: "shopping" }
];

export class HeuristicVisionClassifier implements VisionClassifier {
  async analyzeScreenshot(input: ScreenshotInput): Promise<VisionAnalysis> {
    const observableText = this.extractObservableText(input);
    const imageFeatures = this.extractImageFeatures(input.dataUrl);
    const lower = observableText.toLowerCase();
    const matches = CATEGORY_KEYWORDS.map((entry) => ({
      ...entry,
      score: entry.words.reduce((score, word) => score + (lower.includes(word) ? 1 : 0), 0)
    })).filter((entry) => entry.score > 0);

    const best = matches.sort((a, b) => b.score - a.score)[0];
    const imageGuess = this.categoryFromImageFeatures(imageFeatures);
    const category = best?.category ?? imageGuess.category;
    const confidence = best ? Math.min(0.82, 0.42 + best.score * 0.14) : imageGuess.confidence;
    const possibleRiskFlags = matches.map((match) => match.risk).filter(Boolean) as string[];

    return {
      category,
      confidence,
      visibleTextSummary: observableText || "No OCR text available in the MVP heuristic classifier.",
      visualSummary: this.visualSummary(input, category, imageFeatures),
      possibleRiskFlags,
      source: "heuristic"
    };
  }

  private extractObservableText(input: ScreenshotInput): string {
    // TODO(local VLM/OCR): plug in a local OCR engine such as Windows.Media.Ocr, Tesseract,
    // or a local multimodal model. The interface is intentionally screenshot-first; title text
    // is only a temporary fallback so the MVP remains usable without cloud calls.
    return [input.activeWindowTitle, input.displayName].filter(Boolean).join(" | ");
  }

  private extractImageFeatures(dataUrl: string): { darkRatio: number; lightRatio: number; colorfulness: number; width: number; height: number } {
    const image = nativeImage.createFromDataURL(dataUrl).resize({ width: 160 });
    const size = image.getSize();
    const bitmap = image.toBitmap();
    let darkPixels = 0;
    let lightPixels = 0;
    let colorDistance = 0;
    const pixels = Math.max(1, bitmap.length / 4);

    for (let index = 0; index < bitmap.length; index += 4) {
      const blue = bitmap[index] ?? 0;
      const green = bitmap[index + 1] ?? 0;
      const red = bitmap[index + 2] ?? 0;
      const brightness = (red + green + blue) / 3;
      if (brightness < 45) darkPixels += 1;
      if (brightness > 220) lightPixels += 1;
      colorDistance += Math.max(red, green, blue) - Math.min(red, green, blue);
    }

    return {
      darkRatio: darkPixels / pixels,
      lightRatio: lightPixels / pixels,
      colorfulness: colorDistance / pixels / 255,
      width: size.width,
      height: size.height
    };
  }

  private categoryFromImageFeatures(features: ReturnType<HeuristicVisionClassifier["extractImageFeatures"]>): { category: ActivityCategory; confidence: number } {
    // Image-only heuristics are intentionally low confidence. They help the MVP inspect
    // screenshot pixels first, while avoiding strong judgments without OCR or a local VLM.
    if (features.darkRatio > 0.62 && features.colorfulness > 0.18) {
      return { category: "video_entertainment", confidence: 0.38 };
    }
    if (features.lightRatio > 0.7 && features.colorfulness < 0.08) {
      return { category: "writing_document_editing", confidence: 0.34 };
    }
    return { category: "idle_unknown", confidence: 0.25 };
  }

  private visualSummary(input: ScreenshotInput, category: ActivityCategory, features: ReturnType<HeuristicVisionClassifier["extractImageFeatures"]>): string {
    const imageSizeHint = Math.round((input.dataUrl.length * 3) / 4 / 1024);
    return `Screen image captured for local analysis (${imageSizeHint} KB transient data). Pixel features: ${Math.round(features.darkRatio * 100)}% dark, ${Math.round(features.lightRatio * 100)}% light, ${Math.round(features.colorfulness * 100)}% color variation. Heuristic category: ${category.replaceAll("_", " ")}.`;
  }
}
