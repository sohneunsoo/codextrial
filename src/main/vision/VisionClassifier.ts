import type { VisionAnalysis } from "../../shared";

export interface ScreenshotInput {
  dataUrl: string;
  activeWindowTitle?: string;
  displayName?: string;
}

export interface VisionClassifier {
  analyzeScreenshot(input: ScreenshotInput): Promise<VisionAnalysis>;
}
