import { useState } from 'react';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Send, Play, CheckCircle2, XCircle } from 'lucide-react';
import type { RequestStatus, Role } from '@/lib/types';
import { cn } from '@/lib/utils';

interface StatusTransitionButtonsProps {
    requestId: string;
    programId: string;
    currentStatus: RequestStatus;
    userRole: Role;
    userId: string;
    creatorId: string;
    onTransition: () => void;
    className?: string;
}

/**
 * Component to handle request status transitions.
 * Logic mirrors server/src/modules/request/stateMachine.ts
 */
export function StatusTransitionButtons({
    requestId,
    programId,
    currentStatus,
    userRole,
    userId,
    creatorId,
    onTransition,
    className,
}: StatusTransitionButtonsProps) {
    const [loading, setLoading] = useState<string | null>(null);

    const isAdminOrManager = userRole === 'admin' || userRole === 'manager';
    const isCreator = userId === creatorId;

    const handleTransition = async (targetStatus: RequestStatus) => {
        try {
            setLoading(targetStatus);
            await api.patch(`/programs/${programId}/requests/${requestId}/transition`, {
                status: targetStatus,
            });
            toast.success(`Request status changed to ${targetStatus.replace('_', ' ')}`);
            onTransition();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to change status';
            toast.error(message);
        } finally {
            setLoading(null);
        }
    };

    const buttons = [];

    // Submit Logic
    if ((currentStatus === 'draft' || currentStatus === 'rejected') && (isCreator || isAdminOrManager)) {
        buttons.push({
            status: 'submitted' as RequestStatus,
            label: currentStatus === 'draft' ? 'Submit Request' : 'Resubmit Request',
            icon: <Send className="h-4 w-4 mr-2" />,
            variant: 'default' as const,
        });
    }

    // Management Logic
    if (isAdminOrManager) {
        if (currentStatus === 'submitted') {
            buttons.push({
                status: 'in_review' as RequestStatus,
                label: 'Start Review',
                icon: <Play className="h-4 w-4 mr-2" />,
                variant: 'default' as const,
            });
            buttons.push({
                status: 'rejected' as RequestStatus,
                label: 'Reject',
                icon: <XCircle className="h-4 w-4 mr-2" />,
                variant: 'destructive' as const,
            });
        }

        if (currentStatus === 'in_review') {
            buttons.push({
                status: 'approved' as RequestStatus,
                label: 'Approve',
                icon: <CheckCircle2 className="h-4 w-4 mr-2" />,
                variant: 'default' as const,
            });
            buttons.push({
                status: 'rejected' as RequestStatus,
                label: 'Reject',
                icon: <XCircle className="h-4 w-4 mr-2" />,
                variant: 'destructive' as const,
            });
        }

        if (currentStatus === 'approved') {
            buttons.push({
                status: 'completed' as RequestStatus,
                label: 'Mark Completed',
                icon: <CheckCircle2 className="h-4 w-4 mr-2" />,
                variant: 'default' as const,
            });
        }
    }

    if (buttons.length === 0) return null;

    return (
        <div className={cn("flex flex-wrap gap-2", className)}>
            {buttons.map((btn) => (
                <Button
                    key={btn.status}
                    variant={btn.variant}
                    size="sm"
                    disabled={!!loading}
                    onClick={() => handleTransition(btn.status)}
                >
                    {loading === btn.status ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                        btn.icon
                    )}
                    {btn.label}
                </Button>
            ))}
        </div>
    );
}
