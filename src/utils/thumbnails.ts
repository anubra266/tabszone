import type { TabGroup } from "../types";

export const getThumbnailCacheKey = (groupId: number, windowId?: number) => {
  return `thumbnail_${windowId || groupId}`;
};

export const captureActiveTabScreenshot = async (
  windowId: number
): Promise<string | undefined> => {
  try {
    // Get the active tab in the specified window
    const tabs = await chrome.tabs.query({ windowId, active: true });
    if (!tabs[0]) return undefined;

    // Capture screenshot of the active tab
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
      format: "jpeg",
      quality: 80,
    });

    return dataUrl;
  } catch (error) {
    console.error("Failed to capture screenshot:", error);
    return undefined;
  }
};

export const getThumbnailForGroup = (
  group: TabGroup,
  thumbnailCache: Map<string, string>
): string | undefined => {
  const cacheKey = getThumbnailCacheKey(group.id, group.windowId);
  return thumbnailCache.get(cacheKey) || group.thumbnail;
};
