import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useSocket } from '@/lib/socket';
import type { RequestDetail } from '@/lib/types';
import { RequestInfo } from '@/components/request/RequestInfo';
import { ChainStatusPanel } from '@/components/request/ChainStatusPanel';
import { CommentTimeline } from '@/components/request/CommentTimeline';
import { AttachmentList } from '@/components/request/AttachmentList';
import { AuditTimeline } from '@/components/request/AuditTimeline';
import { ActivityFeed } from '@/components/request/ActivityFeed';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, MessageSquare, Paperclip, History } from 'lucide-react';

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

  const fetchDetail = useCallback(async () => {
    if (!programId || !requestId) return;

    try {
      setError(null);
      const { data } = await api.get(
        `/programs/${programId}/requests/${requestId}/detail`,
      );
      setDetail(data);
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
        <RequestInfo detail={detail} />

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
