import path from "node:path";
import { activeWindow } from "get-windows";
import { desktopCapturer } from "electron";
import type { ActiveWindowInfo, CapturedFrame, FrameCapture, WindowProbe } from "../../core/observation/types.js";

export class WindowsActiveWindowProbe implements WindowProbe {
  async getActiveWindow(): Promise<ActiveWindowInfo | null> {
    const current = await activeWindow();
    if (!current) return null;
    return {
      application: path.basename(current.owner.path || current.owner.name),
      title: current.title,
      windowId: current.id,
    };
  }
}

export class ElectronWindowCapture implements FrameCapture {
  async capture(window: ActiveWindowInfo): Promise<CapturedFrame | null> {
    const sources = await desktopCapturer.getSources({ types: ["window"], thumbnailSize: { width: 1280, height: 720 }, fetchWindowIcons: false });
    const byId = window.windowId === undefined ? undefined : sources.find((source) => source.id.startsWith(`window:${window.windowId}:`));
    const source = byId ?? sources.find((candidate) => candidate.name === window.title);
    if (!source || source.thumbnail.isEmpty()) return null;
    return {
      sample: source.thumbnail.resize({ width: 48, height: 27, quality: "good" }).toBitmap(),
      png: source.thumbnail.toPNG(),
    };
  }
}
