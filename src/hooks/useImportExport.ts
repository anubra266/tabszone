import { useState } from "react";
import type { TabGroup, ImportData, ImportGroup, ImportTab } from "../types";
import { saveTabGroups } from "../utils/storage";

export const useImportExport = () => {
  const [importDialogOpen, setImportDialogOpen] = useState<boolean>(false);
  const [importJsonText, setImportJsonText] = useState<string>("");

  const handleExportGroups = (allGroups: TabGroup[]) => {
    const savedOnly = allGroups.filter((group) => group.isSaved);
    const exportData = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      groups: savedOnly.map((group) => ({
        name: group.name,
        createdAt: group.createdAt,
        thumbnail: group.thumbnail,
        tabs: group.tabs.map((tab) => ({
          title: tab.title,
          url: tab.url,
          favicon: tab.favicon,
        })),
      })),
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tabszone-backup-${
      new Date().toISOString().split("T")[0]
    }.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFromText = async (
    currentGroups: TabGroup[],
    onGroupsUpdate: (groups: TabGroup[]) => void
  ) => {
    try {
      if (!importJsonText.trim()) {
        return;
      }

      const importData: ImportData = JSON.parse(importJsonText);

      if (!importData.groups || !Array.isArray(importData.groups)) {
        throw new Error("Invalid file format");
      }

      const importedGroups: TabGroup[] = importData.groups.map(
        (group: ImportGroup, index: number) => ({
          id: Date.now() + index,
          name: group.name || "Imported Group",
          tabCount: group.tabs?.length || 0,
          createdAt: group.createdAt || new Date().toLocaleString(),
          thumbnail: group.thumbnail,
          tabs:
            group.tabs?.map((tab: ImportTab) => ({
              title: tab.title || "Untitled",
              url: tab.url || "",
              favicon:
                tab.favicon ||
                `https://picsum.photos/32/32?random=${Math.floor(
                  Math.random() * 1000
                )}`,
            })) || [],
          isSaved: true,
        })
      );

      const updatedGroups = [...currentGroups, ...importedGroups];
      onGroupsUpdate(updatedGroups);
      await saveTabGroups(updatedGroups);

      // Close dialog and reset
      setImportDialogOpen(false);
      setImportJsonText("");
    } catch (error) {
      // Import failed, keep dialog open for user to retry
      console.error("Failed to import groups:", error);
    }
  };

  return {
    importDialogOpen,
    setImportDialogOpen,
    importJsonText,
    setImportJsonText,
    handleExportGroups,
    handleImportFromText,
  };
};
