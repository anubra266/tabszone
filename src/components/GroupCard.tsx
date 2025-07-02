import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Save,
  Trash2,
  MoreVertical,
  ExternalLink,
  Clock,
  Globe,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { TabGroup, Tab } from "../types";
import { getThumbnailForGroup } from "../utils/thumbnails";

interface GroupCardProps {
  group: TabGroup;
  thumbnailCache: Map<string, string>;
  expandedGroups: Set<number>;
  onToggleExpansion: (groupId: number) => void;
  onSaveGroup: (group: TabGroup) => void;
  onOpenGroup: (group: TabGroup) => void;
  onDeleteGroup: (group: TabGroup) => void;
  onRenameGroup: (groupId: number, newName: string) => void;
  onOpenSingleTab: (tab: Tab, group: TabGroup) => void;
}

export const GroupCard: React.FC<GroupCardProps> = ({
  group,
  thumbnailCache,
  expandedGroups,
  onToggleExpansion,
  onSaveGroup,
  onOpenGroup,
  onDeleteGroup,
  onRenameGroup,
  onOpenSingleTab,
}) => {
  const [editingGroup, setEditingGroup] = useState<number | null>(null);
  const [newGroupName, setNewGroupName] = useState<string>("");

  const handleStartEdit = () => {
    setEditingGroup(group.id);
    setNewGroupName(group.name);
  };

  const handleSaveRename = () => {
    if (editingGroup === null) return;
    onRenameGroup(editingGroup, newGroupName);
    setEditingGroup(null);
    setNewGroupName("");
  };

  const handleCancelEdit = () => {
    setEditingGroup(null);
    setNewGroupName("");
  };

  return (
    <Card className="hover:bg-accent/50 transition-colors py-0 rounded-md">
      <CardContent className="p-3">
        <div className="space-y-2">
          {/* Top Row: Thumbnail and Title/Info */}
          <div className="flex gap-3">
            {/* Thumbnail */}
            <div className="flex-shrink-0">
              {getThumbnailForGroup(group, thumbnailCache) ? (
                <img
                  src={getThumbnailForGroup(group, thumbnailCache)}
                  alt={`${group.name} thumbnail`}
                  className="w-20 h-15 object-cover rounded border"
                />
              ) : (
                <div className="w-20 h-15">
                  <svg
                    width="80"
                    height="60"
                    viewBox="0 0 80 60"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="rounded border bg-muted"
                  >
                    <rect width="80" height="60" fill="hsl(var(--muted))" />
                    <g opacity="0.4">
                      <rect
                        x="20"
                        y="15"
                        width="40"
                        height="3"
                        rx="1.5"
                        fill="hsl(var(--muted-foreground))"
                      />
                      <rect
                        x="15"
                        y="22"
                        width="50"
                        height="2"
                        rx="1"
                        fill="hsl(var(--muted-foreground))"
                      />
                      <rect
                        x="25"
                        y="28"
                        width="30"
                        height="2"
                        rx="1"
                        fill="hsl(var(--muted-foreground))"
                      />
                      <rect
                        x="20"
                        y="38"
                        width="40"
                        height="8"
                        rx="4"
                        fill="hsl(var(--muted-foreground))"
                      />
                    </g>
                  </svg>
                </div>
              )}
            </div>

            {/* Title and Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  {/* Title Line */}
                  <div className="flex items-center gap-2 mb-1">
                    {editingGroup === group.id ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 flex-shrink-0"
                          onClick={() => onToggleExpansion(group.id)}
                        >
                          {expandedGroups.has(group.id) ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                        </Button>
                        <Input
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          className="h-6 text-sm flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveRename();
                            if (e.key === "Escape") handleCancelEdit();
                          }}
                          onBlur={handleSaveRename}
                          autoFocus
                        />
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 flex-shrink-0"
                          onClick={() => onToggleExpansion(group.id)}
                        >
                          {expandedGroups.has(group.id) ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                        </Button>
                        <h3
                          className="font-medium text-sm truncate cursor-text hover:text-primary flex-1"
                          onClick={handleStartEdit}
                          title="Click to edit name"
                        >
                          {group.name}
                        </h3>
                      </>
                    )}
                  </div>

                  {/* Info Line */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {group.tabCount} tabs
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {group.createdAt === "Active"
                        ? "Active"
                        : new Date(group.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* More Options */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 flex-shrink-0"
                    >
                      <MoreVertical className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    {group.isSaved ? (
                      <>
                        <DropdownMenuItem onClick={() => onOpenGroup(group)}>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open All
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDeleteGroup(group)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <DropdownMenuItem onClick={() => onSaveGroup(group)}>
                        <Save className="w-4 h-4 mr-2" />
                        Save Group
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Bottom Row: Tab Preview */}
          {!expandedGroups.has(group.id) && (
            <div className="flex flex-wrap gap-1">
              {group.tabs.slice(0, 4).map((tab, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 bg-muted rounded px-2 py-1 text-xs"
                >
                  <img
                    src={tab.favicon}
                    alt=""
                    className="w-3 h-3 rounded-sm object-cover flex-shrink-0"
                  />
                  <span className="truncate max-w-24">
                    {tab.title.split(" - ")[0]}
                  </span>
                </div>
              ))}
              {group.tabs.length > 4 && (
                <div className="bg-muted rounded px-2 py-1 text-xs">
                  +{group.tabs.length - 4} more
                </div>
              )}
            </div>
          )}

          {/* Action Button Row */}
          <div className="flex justify-end">
            {group.isSaved ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenGroup(group)}
                className="h-7 text-xs"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Open All
              </Button>
            ) : (
              <Button
                size="sm"
                variant="default"
                onClick={() => onSaveGroup(group)}
                className="h-7 text-xs"
              >
                <Save className="w-3 h-3 mr-1" />
                Save
              </Button>
            )}
          </div>
        </div>

        {/* Expanded Tab List - Full Width */}
        {expandedGroups.has(group.id) && (
          <div className="mt-3 pt-3 border-t space-y-1 max-h-32 overflow-y-auto">
            {group.tabs.map((tab, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer group transition-colors"
                onClick={() => onOpenSingleTab(tab, group)}
              >
                <img
                  src={tab.favicon}
                  alt=""
                  className="w-4 h-4 rounded-sm object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate group-hover:text-primary">
                    {tab.title}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {tab.url}
                  </div>
                </div>
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
