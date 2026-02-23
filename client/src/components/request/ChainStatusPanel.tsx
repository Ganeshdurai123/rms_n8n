import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Check, Circle, Clock, XCircle } from 'lucide-react';
import type { RequestChain, RequestStatus } from '@/lib/types';

const STATUS_VARIANT: Record<string, string> = {
  draft: 'bg-secondary text-secondary-foreground',
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  in_review: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  completed: 'bg-muted text-muted-foreground',
};

const CHAIN_STATUS_VARIANT: Record<string, string> = {
  active: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
};

type StepCategory = 'completed' | 'active' | 'pending' | 'rejected';

function getStepCategory(status: RequestStatus): StepCategory {
  if (status === 'completed') return 'completed';
  if (status === 'rejected') return 'rejected';
  if (status === 'submitted' || status === 'in_review' || status === 'approved') return 'active';
  return 'pending';
}

function StepIcon({ category }: { category: StepCategory }) {
  switch (category) {
    case 'completed':
      return <Check className="h-3.5 w-3.5 text-white" />;
    case 'active':
      return <Clock className="h-3.5 w-3.5 text-white" />;
    case 'rejected':
      return <XCircle className="h-3.5 w-3.5 text-white" />;
    default:
      return <Circle className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

const CIRCLE_CLASS: Record<StepCategory, string> = {
  completed: 'bg-green-600',
  active: 'bg-blue-600',
  rejected: 'bg-red-600',
  pending: 'bg-muted border border-border',
};

interface ChainStatusPanelProps {
  chain: RequestChain;
  currentRequestId: string;
}

export function ChainStatusPanel({ chain, currentRequestId }: ChainStatusPanelProps) {
  const sortedSteps = [...chain.steps].sort((a, b) => a.sequence - b.sequence);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Chain: {chain.name}</CardTitle>
          <Badge
            variant="secondary"
            className={cn('capitalize', CHAIN_STATUS_VARIANT[chain.status] || '')}
          >
            {chain.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {sortedSteps.map((step, idx) => {
            const isPopulated = typeof step.requestId === 'object';
            const reqId = isPopulated ? step.requestId._id : step.requestId;
            const title = isPopulated ? step.requestId.title : 'Untitled';
            const status: RequestStatus = isPopulated ? step.requestId.status : 'draft';
            const category = getStepCategory(status);
            const isCurrent = reqId === currentRequestId;
            const isLast = idx === sortedSteps.length - 1;

            return (
              <div key={reqId} className="flex items-stretch">
                {/* Step indicator column */}
                <div className="flex flex-col items-center mr-3">
                  <div
                    className={cn(
                      'flex items-center justify-center w-6 h-6 rounded-full shrink-0',
                      CIRCLE_CLASS[category],
                    )}
                  >
                    <StepIcon category={category} />
                  </div>
                  {!isLast && (
                    <div className="w-px flex-1 min-h-[20px] bg-border" />
                  )}
                </div>

                {/* Step content */}
                <div
                  className={cn(
                    'pb-4 flex-1 min-w-0',
                    isCurrent && 'bg-accent/50 -mx-2 px-2 rounded-md',
                  )}
                >
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-xs text-muted-foreground font-mono">
                      #{step.sequence}
                    </span>
                    <span
                      className={cn(
                        'text-sm truncate',
                        category === 'completed' && 'text-muted-foreground',
                        category === 'active' && 'font-semibold',
                        category === 'pending' && 'text-muted-foreground/70',
                        category === 'rejected' && 'line-through text-muted-foreground',
                      )}
                    >
                      {title}
                    </span>
                    <Badge
                      variant="secondary"
                      className={cn('capitalize text-[10px] px-1.5 py-0 shrink-0', STATUS_VARIANT[status] || '')}
                    >
                      {status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
