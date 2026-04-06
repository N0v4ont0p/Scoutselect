import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function MethodologyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/" className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        <ArrowLeft className="w-4 h-4" /> Home
      </Link>
      <h1 className="text-3xl font-black mb-2">Methodology</h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>How ScoutSelect computes alliance scores, OPR, and win probabilities.</p>

      {[
        {
          title: "Offensive Power Rating (OPR)",
          body: `OPR is computed by solving the linear system A·x = b via Gaussian elimination with partial pivoting. A[i][j] = 1 if team j played on alliance side i; b[i] = alliance score in that match. Solved separately for total, auto, teleop, and endgame.`,
          code: `A^T · A · x = A^T · b`,
        },
        {
          title: "Bayesian Shrinkage",
          body: `Teams with fewer than 5 qual matches are shrunk toward the event median to prevent overconfidence on small samples.`,
          code: `α = min(matchCount, 5) / 5\nexpected = α × observed + (1 − α) × median`,
        },
        {
          title: "Synergy Score",
          body: `Each team is represented as a normalised role fingerprint in (auto, teleop, endgame) space. Euclidean distance drives complementarity; shared dominance creates an overlap penalty.`,
          code: `fp = (auto/total, teleop/total, endgame/total)\ncomplementarity = (dist / √2) × 60\noverlap = min_phase_overlap × 20\nsynergy = combined + complementarity − overlap`,
        },
        {
          title: "Monte Carlo Win Probability",
          body: `1,000 simulations. Each run samples each team's score from N(μ, σ) using the Box-Muller transform, sums per alliance, and tallies the winner.`,
          code: `u1, u2 ~ Uniform(0,1)\nz = √(−2 ln u1) · cos(2π u2)\nsample = μ + σ·z`,
        },
        {
          title: "Consistency & Reliability",
          body: `Consistency is derived from the IQR of a team's scores (lower spread = higher consistency). Reliability is a composite of consistency (60%) and match count (40%).`,
          code: `consistency = 100 − (IQR / 400) × 100\nreliability = 0.6 × consistency + 0.4 × clamp(matchCount/5, 0, 1) × 100`,
        },
      ].map((s) => (
        <div key={s.title} className="glass rounded-xl p-5 mb-4">
          <h2 className="font-bold text-lg mb-2">{s.title}</h2>
          <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>{s.body}</p>
          <pre className="text-xs p-3 rounded-lg overflow-x-auto font-mono"
            style={{ background: "var(--surface-2)", color: "var(--accent)" }}>{s.code}</pre>
        </div>
      ))}
    </div>
  );
}
