import { Suspense } from "react";
import EventAnalysisContent from "./_analysis";

export default function EventAnalysisPage() {
  return (
    <Suspense fallback={
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-4">
        {[120, 80, 220, 160, 320].map((w, i) => (
          <div key={i} className="shimmer rounded-xl" style={{ height: 20, width: w }} />
        ))}
        <div className="shimmer rounded-2xl" style={{ height: 180 }} />
        <div className="shimmer rounded-2xl" style={{ height: 320 }} />
      </div>
    }>
      <EventAnalysisContent />
    </Suspense>
  );
}
