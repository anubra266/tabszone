import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { TabGroup } from "../types";

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupToDelete: TabGroup | null;
  onConfirmDelete: () => void;
}

export const DeleteDialog: React.FC<DeleteDialogProps> = ({
  open,
  onOpenChange,
  groupToDelete,
  onConfirmDelete,
}) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Tab Group</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{groupToDelete?.name}"? This action
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirmDelete}
            className="bg-destructive text-destructive-foreground"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
