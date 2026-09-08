import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmDeleteTaskProps {
  /** The task about to be deleted, or null when the dialog is closed. */
  taskName: string | null;
  completionCount?: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * Deleting a task also drops every completion, streak and earning attached to
 * it, and there is no undo. Trash used to be a bare one-click icon button.
 */
export function ConfirmDeleteTask({
  taskName,
  completionCount = 0,
  onOpenChange,
  onConfirm,
}: ConfirmDeleteTaskProps) {
  return (
    <AlertDialog open={taskName !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{taskName}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {completionCount > 0
              ? `This also deletes ${completionCount} recorded completion${completionCount === 1 ? '' : 's'}, along with the task's streak and earnings history. Money already in your wallet stays there.`
              : 'This removes the task and its history. It cannot be undone.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete task
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
