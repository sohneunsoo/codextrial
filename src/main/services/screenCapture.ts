import { desktopCapturer } from "electron";
import type { ScreenshotInput } from "../vision/VisionClassifier";

export class ScreenCaptureService {
  async capturePrimaryScreen(): Promise<ScreenshotInput> {
    const sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: { width: 1280, height: 720 },
      fetchWindowIcons: false
    });

    const screen = sources.find((source) => source.id.startsWith("screen:")) ?? sources[0];
    if (!screen) {
      throw new Error("No screen source was available for capture.");
    }

    return {
      dataUrl: screen.thumbnail.toDataURL(),
      activeWindowTitle: screen.name,
      displayName: screen.name
    };
  }
}
