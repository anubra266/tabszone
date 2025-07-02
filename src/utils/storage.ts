import type { TabGroup } from "../types";

export const saveTabGroups = async (groups: TabGroup[]) => {
  try {
    // Only save the saved groups (filter out live windows)
    const savedOnly = groups.filter((group) => group.isSaved);
    await chrome.storage.local.set({ tabGroups: savedOnly });
  } catch (error) {
    console.error("Failed to save tab groups:", error);
  }
};

export const loadTabGroups = async (): Promise<TabGroup[]> => {
  try {
    const result = await chrome.storage.local.get(["tabGroups"]);
    return result.tabGroups
      ? result.tabGroups.map((group: TabGroup) => ({
          ...group,
          isSaved: true,
        }))
      : [];
  } catch (error) {
    console.error("Failed to load tab groups:", error);
    return [];
  }
};

// Window group names management
export const loadWindowGroupNames = async (): Promise<Map<number, string>> => {
  try {
    const result = await chrome.storage.local.get(["windowGroupNames"]);
    const storedNames = result.windowGroupNames || {};
    const namesMap = new Map<number, string>();

    // Convert stored object back to Map
    for (const [windowId, name] of Object.entries(storedNames)) {
      namesMap.set(parseInt(windowId), name as string);
    }

    return namesMap;
  } catch (error) {
    console.error("Failed to load window group names:", error);
    return new Map();
  }
};

export const saveWindowGroupNames = async (namesMap: Map<number, string>) => {
  try {
    // Convert Map to plain object for storage
    const namesObject: Record<string, string> = {};
    for (const [windowId, name] of namesMap) {
      namesObject[windowId.toString()] = name;
    }

    await chrome.storage.local.set({ windowGroupNames: namesObject });
  } catch (error) {
    console.error("Failed to save window group names:", error);
  }
};

// Thumbnail cache management
export const loadThumbnailCache = async (): Promise<Map<string, string>> => {
  try {
    const result = await chrome.storage.local.get(["thumbnailCache"]);
    const cache = result.thumbnailCache
      ? new Map(Object.entries(result.thumbnailCache))
      : new Map();
    return cache;
  } catch (error) {
    console.error("Failed to load thumbnail cache:", error);
    return new Map();
  }
};

export const saveThumbnailCache = async (cache: Map<string, string>) => {
  try {
    const cacheObj = Object.fromEntries(cache);
    await chrome.storage.local.set({ thumbnailCache: cacheObj });
  } catch (error) {
    console.error("Failed to save thumbnail cache:", error);
  }
};
