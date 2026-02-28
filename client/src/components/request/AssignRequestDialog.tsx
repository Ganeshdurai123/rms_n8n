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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  currentDueDate?: string | null;
  onAssign: (userId: string, dueDate: string | null) => Promise<void>;
}

export function AssignRequestDialog({
  open,
  onOpenChange,
  members,
  currentAssigneeId,
  currentDueDate,
  onAssign,
}: AssignRequestDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>(
    currentAssigneeId || '',
  );

  // Convert standard ISO date string to YYYY-MM-DD for the date input
  const initialDateStr = currentDueDate ? new Date(currentDueDate).toISOString().split('T')[0] : '';
  const [dueDate, setDueDate] = useState<string>(initialDateStr);
  const [isAssigning, setIsAssigning] = useState(false);

  async function handleAssign() {
    if (!selectedUserId) return;
    setIsAssigning(true);
    try {
      await onAssign(selectedUserId, dueDate || null);
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

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Assignee</Label>
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
          </div>

          <div className="space-y-2">
            <Label>Due Date (Optional)</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              placeholder="Select a date"
            />
          </div>
        </div>

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
