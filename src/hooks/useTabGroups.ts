import { useState, useEffect } from "react";
import type { TabGroup, Tab } from "../types";
import {
  saveTabGroups,
  loadTabGroups,
  loadWindowGroupNames,
  saveWindowGroupNames,
  loadThumbnailCache,
  saveThumbnailCache,
} from "../utils/storage";
import {
  captureActiveTabScreenshot,
  getThumbnailCacheKey,
} from "../utils/thumbnails";

export const useTabGroups = () => {
  const [allGroups, setAllGroups] = useState<TabGroup[]>([]);
  const [currentWindowId, setCurrentWindowId] = useState<number | null>(null);
  const [thumbnailCache, setThumbnailCache] = useState<Map<string, string>>(
    new Map()
  );
  const [windowGroupNames, setWindowGroupNames] = useState<Map<number, string>>(
    new Map()
  );

  // Load all groups (saved + live windows)
  const loadAllGroups = async (cache?: Map<string, string>) => {
    try {
      // Use provided cache or fallback to current state
      const currentCache = cache || thumbnailCache;

      // Always load the latest window group names from storage
      const currentWindowGroupNames = await loadWindowGroupNames();
      setWindowGroupNames(currentWindowGroupNames);

      // Get current window
      const currentWindow = await chrome.windows.getCurrent();
      setCurrentWindowId(currentWindow.id || null);

      // Get all windows and their tabs
      const windows = await chrome.windows.getAll({ populate: true });

      const liveGroups: TabGroup[] = [];

      for (const window of windows) {
        const tabs = window.tabs || [];
        // Filter out chrome:// internal pages
        const filteredTabs = tabs.filter(
          (tab) => tab.url && !tab.url.startsWith("chrome://")
        );

        const windowTabs: Tab[] = filteredTabs.map((tab) => ({
          title: tab.title || "Untitled",
          favicon:
            tab.favIconUrl ||
            `https://picsum.photos/32/32?random=${Math.floor(
              Math.random() * 1000
            )}`,
          url: tab.url || "",
          tabId: tab.id, // Include tab ID for active tabs
        }));

        // Skip windows with no valid tabs
        if (windowTabs.length === 0) {
          continue;
        }

        // Check if we have a stored name for this window (from opened saved group)
        // Otherwise, use the first tab's title for window name
        let windowName = window.id
          ? currentWindowGroupNames.get(window.id)
          : undefined;
        if (!windowName) {
          const firstTabTitle = windowTabs[0]?.title || "Untitled";
          windowName =
            firstTabTitle.length > 30
              ? firstTabTitle.substring(0, 30) + "..."
              : firstTabTitle;
        }

        // Check cache first, then capture if needed
        let thumbnail = undefined;
        if (window.id) {
          const cacheKey = getThumbnailCacheKey(window.id, window.id);
          thumbnail = currentCache.get(cacheKey);

          // Only capture new screenshot if not in cache
          if (!thumbnail) {
            thumbnail = await captureActiveTabScreenshot(window.id);
            if (thumbnail) {
              const newCache = new Map(currentCache);
              newCache.set(cacheKey, thumbnail);
              setThumbnailCache(newCache);
              await saveThumbnailCache(newCache);
            }
          }
        }

        liveGroups.push({
          id: window.id || Date.now(),
          name: windowName,
          tabCount: windowTabs.length,
          createdAt: "Active",
          tabs: windowTabs,
          thumbnail,
          isSaved: false,
          windowId: window.id,
        });
      }

      // Get saved groups
      const savedGroups = await loadTabGroups();

      // Clean up window group names for windows that no longer exist
      const currentWindowIds = new Set(
        windows.map((w) => w.id).filter(Boolean)
      );
      const updatedWindowGroupNames = new Map(currentWindowGroupNames);
      let shouldUpdateNames = false;

      for (const [windowId] of currentWindowGroupNames) {
        if (!currentWindowIds.has(windowId)) {
          updatedWindowGroupNames.delete(windowId);
          shouldUpdateNames = true;
        }
      }

      if (shouldUpdateNames) {
        setWindowGroupNames(updatedWindowGroupNames);
        await saveWindowGroupNames(updatedWindowGroupNames);
      }

      // Combine live windows and saved groups
      setAllGroups([...liveGroups, ...savedGroups]);
    } catch (error) {
      console.error("Failed to load groups:", error);
    }
  };

  const handleSaveGroup = async (group: TabGroup) => {
    try {
      // Capture thumbnail before saving if it's an active group
      let thumbnail = group.thumbnail;
      if (!thumbnail && group.windowId) {
        thumbnail = await captureActiveTabScreenshot(group.windowId);
      }

      const newSavedGroup: TabGroup = {
        ...group,
        id: Date.now(),
        createdAt: new Date().toLocaleString(),
        thumbnail,
        isSaved: true,
        windowId: undefined, // Remove windowId for saved groups
        // Remove tabId from tabs since they're no longer live
        tabs: group.tabs.map((tab) => ({
          title: tab.title,
          favicon: tab.favicon,
          url: tab.url,
        })),
      };

      const updatedGroups = [...allGroups, newSavedGroup];
      setAllGroups(updatedGroups);
      await saveTabGroups(updatedGroups);

      // Close the window after saving
      if (group.windowId) {
        try {
          await chrome.windows.remove(group.windowId);

          // Refresh groups to update the UI
          setTimeout(async () => {
            await loadAllGroups();
          }, 200);
        } catch (error) {
          console.warn(`Failed to close window ${group.windowId}:`, error);
        }
      }
    } catch (error) {
      console.error("Failed to save group:", error);
    }
  };

  const handleOpenGroup = async (group: TabGroup) => {
    try {
      const window = await chrome.windows.create({});
      if (!window) {
        throw new Error("Failed to create window");
      }

      for (const tab of group.tabs) {
        await chrome.tabs.create({
          windowId: window.id,
          url: tab.url,
        });
      }
      // Close the default empty tab
      const tabs = await chrome.tabs.query({ windowId: window.id });
      if (tabs.length > group.tabs.length) {
        const tabId = tabs[0].id;
        if (tabId) chrome.tabs.remove(tabId);
      }

      // Preserve the thumbnail in cache when converting saved group to active
      if (group.isSaved && group.thumbnail && window.id) {
        const cacheKey = getThumbnailCacheKey(window.id, window.id);
        const newCache = new Map(thumbnailCache);
        newCache.set(cacheKey, group.thumbnail);
        setThumbnailCache(newCache);
        await saveThumbnailCache(newCache);
      }

      // Store the group name for this window so it retains its name when converted to active
      if (group.isSaved && window.id) {
        const newWindowGroupNames = new Map(windowGroupNames);
        newWindowGroupNames.set(window.id, group.name);
        setWindowGroupNames(newWindowGroupNames);
        await saveWindowGroupNames(newWindowGroupNames);
      }

      // Remove the group from saved groups since it's now active
      if (group.isSaved) {
        const updatedGroups = allGroups.filter((g) => g.id !== group.id);
        setAllGroups(updatedGroups);
        await saveTabGroups(updatedGroups);
      }

      // Small delay to ensure window is fully created, then refresh groups
      setTimeout(async () => {
        await loadAllGroups();
      }, 500);
    } catch (error) {
      console.error("Failed to open tab group:", error);
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    const updatedGroups = allGroups.filter((g) => g.id !== groupId);
    setAllGroups(updatedGroups);
    await saveTabGroups(updatedGroups);
  };

  const handleRenameGroup = async (groupId: number, newName: string) => {
    // Find the original group to check if name actually changed
    const originalGroup = allGroups.find((g) => g.id === groupId);
    if (originalGroup && originalGroup.name !== newName.trim()) {
      const updatedGroups = allGroups.map((g) =>
        g.id === groupId ? { ...g, name: newName.trim() } : g
      );
      setAllGroups(updatedGroups);
      await saveTabGroups(updatedGroups);
    }
  };

  const handleOpenSingleTab = async (tab: Tab, group: TabGroup) => {
    try {
      // If it's an active tab (has tabId and windowId), focus the existing tab
      if (tab.tabId && group.windowId && !group.isSaved) {
        // Focus the window first
        await chrome.windows.update(group.windowId, { focused: true });
        // Then activate the specific tab
        await chrome.tabs.update(tab.tabId, { active: true });
      } else {
        // For saved groups, create a new tab
        await chrome.tabs.create({ url: tab.url });
      }
    } catch (error) {
      console.error("Failed to open tab:", error);
    }
  };

  // Initialize on mount
  useEffect(() => {
    const initializeApp = async () => {
      const cache = await loadThumbnailCache();
      setThumbnailCache(cache);
      await loadAllGroups(cache);
    };
    initializeApp();
  }, []);

  return {
    allGroups,
    currentWindowId,
    thumbnailCache,
    loadAllGroups,
    handleSaveGroup,
    handleOpenGroup,
    handleDeleteGroup,
    handleRenameGroup,
    handleOpenSingleTab,
  };
};
