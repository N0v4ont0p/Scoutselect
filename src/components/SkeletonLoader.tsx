function Shimmer({ className = '' }: { className?: string }) {
  return <div className={`rounded-lg skeleton-shimmer ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div className="glass rounded-xl p-4 space-y-3">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <Shimmer className="h-4 w-24" />
          <Shimmer className="h-5 w-40" />
        </div>
        <Shimmer className="h-10 w-10 rounded-lg" />
      </div>
      <div className="space-y-2 pt-1">
        <Shimmer className="h-2 w-full" />
        <Shimmer className="h-2 w-full" />
        <Shimmer className="h-2 w-3/4" />
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="glass rounded-xl p-4 text-center space-y-2">
      <Shimmer className="h-7 w-12 mx-auto" />
      <Shimmer className="h-3 w-16 mx-auto" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Top bar skeleton */}
      <div className="sticky top-0 z-10 glass border-b px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Shimmer className="h-5 w-5 rounded" />
          <div className="flex-1 space-y-1">
            <Shimmer className="h-4 w-40" />
            <Shimmer className="h-3 w-32" />
          </div>
          <Shimmer className="h-6 w-20 rounded-full" />
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <CardSkeleton />
        <Shimmer className="h-10 w-full" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
        <Shimmer className="h-10 w-full rounded-lg" />
        {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    </div>
  );
}

