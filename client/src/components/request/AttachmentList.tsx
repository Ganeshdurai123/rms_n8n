import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { FileIcon, Upload, Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import type { Attachment, Role } from '@/lib/types';

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function getUserName(
  user: Attachment['uploadedBy'],
): string {
  if (!user || typeof user === 'string') return 'Unknown';
  return `${user.firstName} ${user.lastName}`;
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

  return new Date(dateStr).toLocaleDateString();
}

interface AttachmentListProps {
  attachments: Attachment[];
  programId: string;
  requestId: string;
  onAttachmentAdded: () => void;
  userId: string;
  userRole: Role;
}

export function AttachmentList({
  attachments,
  programId,
  requestId,
  onAttachmentAdded,
  userId,
  userRole,
}: AttachmentListProps) {
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      await api.post(
        `/programs/${programId}/requests/${requestId}/attachments`,
        formData,
      );
      toast.success('File uploaded successfully');
      onAttachmentAdded();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to upload file';
      toast.error(message);
    } finally {
      setUploading(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = async (attachment: Attachment) => {
    try {
      const response = await api.get(
        `/programs/${programId}/requests/${requestId}/attachments/${attachment._id}`,
        { responseType: 'blob' },
      );

      const blob = new Blob([response.data as BlobPart], {
        type: attachment.mimeType || 'application/octet-stream',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to download file';
      toast.error(message);
    }
  };

  const handleDelete = async (attachmentId: string) => {
    setDeletingId(attachmentId);
    try {
      await api.delete(
        `/programs/${programId}/requests/${requestId}/attachments/${attachmentId}`,
      );
      toast.success('Attachment deleted');
      onAttachmentAdded(); // Re-fetch data
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete attachment';
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  const canDelete = (attachment: Attachment): boolean => {
    if (userRole === 'admin' || userRole === 'manager') return true;
    const uploaderId =
      typeof attachment.uploadedBy === 'string'
        ? attachment.uploadedBy
        : attachment.uploadedBy?._id;
    return uploaderId === userId;
  };

  return (
    <div className="space-y-4">
      {/* Upload button */}
      <div className="flex justify-end">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleUpload}
          disabled={uploading}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="h-4 w-4 mr-1" />
          {uploading ? 'Uploading...' : 'Upload File'}
        </Button>
      </div>

      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No attachments yet.
        </p>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment._id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card"
            >
              <FileIcon className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {attachment.originalName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.size)} -- uploaded by{' '}
                  {getUserName(attachment.uploadedBy)} {relativeTime(attachment.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleDownload(attachment)}
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </Button>

                {canDelete(attachment) && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        disabled={deletingId === attachment._id}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete attachment?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete &quot;{attachment.originalName}&quot;. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(attachment._id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
