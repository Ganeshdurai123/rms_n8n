import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import type { Comment } from '@/lib/types';

function getUserName(
  author: Comment['authorId'],
): { name: string; initial: string } {
  if (!author || typeof author === 'string') {
    return { name: 'Unknown', initial: '?' };
  }
  const name = `${author.firstName} ${author.lastName}`;
  const initial = author.firstName.charAt(0).toUpperCase();
  return { name, initial };
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  return new Date(dateStr).toLocaleDateString();
}

interface CommentTimelineProps {
  comments: Comment[];
  programId: string;
  requestId: string;
  onCommentAdded: () => void;
}

export function CommentTimeline({
  comments,
  programId,
  requestId,
  onCommentAdded,
}: CommentTimelineProps) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      await api.post(
        `/programs/${programId}/requests/${requestId}/comments`,
        { content: trimmed },
      );
      setContent('');
      toast.success('Comment added');
      onCommentAdded();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to add comment';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No comments yet. Be the first to add one.
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => {
            const { name, initial } = getUserName(comment.authorId);
            return (
              <div key={comment._id} className="flex gap-3">
                <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                  <AvatarFallback>{initial}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{name}</span>
                    <span className="text-xs text-muted-foreground">
                      {relativeTime(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap break-words">
                    {comment.content}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Separator />

      <form onSubmit={handleSubmit} className="space-y-3">
        <Textarea
          placeholder="Write a comment..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          disabled={submitting}
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={submitting || !content.trim()}
          >
            <Send className="h-4 w-4 mr-1" />
            {submitting ? 'Sending...' : 'Add Comment'}
          </Button>
        </div>
      </form>
    </div>
  );
}
