import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useSocket } from '@/lib/socket';
import type { RequestDetail } from '@/lib/types';
import { RequestInfo } from '@/components/request/RequestInfo';
import { AssignRequestDialog } from '@/components/request/AssignRequestDialog';
import { ChainStatusPanel } from '@/components/request/ChainStatusPanel';
import { CommentTimeline } from '@/components/request/CommentTimeline';
import { AttachmentList } from '@/components/request/AttachmentList';
import { AuditTimeline } from '@/components/request/AuditTimeline';
import { ActivityFeed } from '@/components/request/ActivityFeed';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, MessageSquare, Paperclip, History } from 'lucide-react';
import { toast } from 'sonner';

interface ProgramMember {
  _id: string;
  firstName: string;
  lastName: string;
}

export function RequestDetailPage() {
  const { programId, requestId } = useParams<{
    programId: string;
    requestId: string;
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<ProgramMember[]>([]);
  const [showAssignDialog, setShowAssignDialog] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!programId || !requestId) return;

    try {
      setError(null);
      const { data } = await api.get(
        `/programs/${programId}/requests/${requestId}/detail`,
      );
      // API returns { data: { request, comments, attachments, auditTrail, chain } }
      setDetail(data.data || data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load request details';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [programId, requestId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleRefresh = useCallback(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Fetch program members for assignment dialog
  useEffect(() => {
    if (!programId) return;
    let cancelled = false;

    async function fetchMembers() {
      try {
        const { data } = await api.get(`/programs/${programId}/members`, {
          params: { limit: 100 },
        });
        if (!cancelled) {
          const memberList = data.data || data;
          const mapped: ProgramMember[] = (
            Array.isArray(memberList) ? memberList : []
          ).map(
            (m: {
              userId?: { _id: string; firstName: string; lastName: string };
              _id: string;
              firstName?: string;
              lastName?: string;
            }) => {
              if (m.userId) {
                return {
                  _id: m.userId._id,
                  firstName: m.userId.firstName,
                  lastName: m.userId.lastName,
                };
              }
              return {
                _id: m._id,
                firstName: m.firstName || '',
                lastName: m.lastName || '',
              };
            },
          );
          setMembers(mapped);
        }
      } catch {
        // Silently handle -- members not critical for page load
      }
    }

    fetchMembers();
    return () => {
      cancelled = true;
    };
  }, [programId]);

  const handleAssign = useCallback(
    async (userId: string) => {
      if (!programId || !requestId) return;
      try {
        await api.patch(
          `/programs/${programId}/requests/${requestId}/assign`,
          { assignedTo: userId },
        );
        toast.success('Request assigned successfully');
        fetchDetail();
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : (err as { response?: { data?: { message?: string } } })?.response
                ?.data?.message || 'Failed to assign request';
        toast.error(message);
        throw err; // Re-throw so dialog stays open on error
      }
    },
    [programId, requestId, fetchDetail],
  );

  const canAssign =
    user?.role === 'admin' || user?.role === 'manager';

  const currentAssigneeId = detail?.request.assignedTo
    ? typeof detail.request.assignedTo === 'string'
      ? detail.request.assignedTo
      : detail.request.assignedTo._id
    : null;

  // Real-time Socket.IO updates -- re-fetch when events affect this request
  const socketEvents = useMemo(() => {
    const refreshIfMatch = (payload: Record<string, unknown>) => {
      if (payload.requestId === requestId) {
        fetchDetail();
      }
    };

    return {
      'request:updated': refreshIfMatch,
      'request:status_changed': refreshIfMatch,
      'request:assigned': refreshIfMatch,
      'comment:added': refreshIfMatch,
      'comment:deleted': refreshIfMatch,
      'attachment:uploaded': refreshIfMatch,
      'attachment:deleted': refreshIfMatch,
    };
  }, [requestId, fetchDetail]);

  useSocket(socketEvents);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-6 py-4 border-b">
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="flex-1 overflow-auto px-6 py-6 space-y-6">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-60 w-full" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !detail) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-6 py-4 border-b">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/programs/${programId}/sheet`)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Sheet View
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <p className="text-destructive text-lg">
            {error || 'Request not found'}
          </p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with back button */}
      <div className="px-6 py-4 border-b">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/programs/${programId}/sheet`)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Sheet View
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-6 space-y-6">
        {/* Request Info Card */}
        <RequestInfo
          detail={detail}
          canAssign={canAssign}
          onAssignClick={() => setShowAssignDialog(true)}
        />

        {/* Assign Request Dialog */}
        {canAssign && (
          <AssignRequestDialog
            open={showAssignDialog}
            onOpenChange={setShowAssignDialog}
            members={members}
            currentAssigneeId={currentAssigneeId}
            onAssign={handleAssign}
          />
        )}

        {/* Chain Status Panel (shown when request belongs to a chain) */}
        {detail.chain && (
          <ChainStatusPanel chain={detail.chain} currentRequestId={requestId!} />
        )}

        {/* Tabbed section */}
        <Tabs defaultValue="comments">
          <TabsList>
            <TabsTrigger value="comments">
              <MessageSquare className="h-4 w-4 mr-1.5" />
              Comments ({detail.comments.length})
            </TabsTrigger>
            <TabsTrigger value="attachments">
              <Paperclip className="h-4 w-4 mr-1.5" />
              Attachments ({detail.attachments.length})
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-1.5" />
              History ({detail.auditTrail.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="comments">
            <CommentTimeline
              comments={detail.comments}
              programId={programId!}
              requestId={requestId!}
              onCommentAdded={handleRefresh}
            />
          </TabsContent>

          <TabsContent value="attachments">
            <AttachmentList
              attachments={detail.attachments}
              programId={programId!}
              requestId={requestId!}
              onAttachmentAdded={handleRefresh}
              userId={user?._id || ''}
              userRole={user?.role || 'client'}
            />
          </TabsContent>

          <TabsContent value="history">
            <AuditTimeline auditTrail={detail.auditTrail} />
          </TabsContent>
        </Tabs>

        {/* Activity Feed -- recent real-time events in this program */}
        {programId && (
          <div className="border rounded-lg p-4 bg-muted/20">
            <ActivityFeed programId={programId} />
          </div>
        )}
      </div>
    </div>
  );
}
