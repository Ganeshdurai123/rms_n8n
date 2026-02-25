import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface ProgramMember {
  _id: string;
  firstName: string;
  lastName: string;
}

interface AssignRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: ProgramMember[];
  currentAssigneeId?: string | null;
  onAssign: (userId: string) => Promise<void>;
}

export function AssignRequestDialog({
  open,
  onOpenChange,
  members,
  currentAssigneeId,
  onAssign,
}: AssignRequestDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>(
    currentAssigneeId || '',
  );
  const [isAssigning, setIsAssigning] = useState(false);

  async function handleAssign() {
    if (!selectedUserId) return;
    setIsAssigning(true);
    try {
      await onAssign(selectedUserId);
      onOpenChange(false);
    } finally {
      setIsAssigning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Assign Request</DialogTitle>
          <DialogDescription>
            Select a team member to assign this request to.
          </DialogDescription>
        </DialogHeader>

        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a member" />
          </SelectTrigger>
          <SelectContent>
            {members.map((member) => (
              <SelectItem key={member._id} value={member._id}>
                {member.firstName} {member.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isAssigning}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedUserId || isAssigning}
          >
            {isAssigning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Assigning...
              </>
            ) : (
              'Assign'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
