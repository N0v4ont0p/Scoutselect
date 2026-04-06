"use client";
import Link from "next/link";
import { Home, Globe } from "lucide-react";
import { useI18n } from "@/context/LanguageContext";

const SECTIONS_EN = [
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
];

const SECTIONS_ZH = [
  {
    title: "进攻效率评分 (OPR)",
    body: `OPR 通过带部分主元的高斯消元法求解线性方程组 A·x = b 来计算。A[i][j]=1 表示队伍 j 参与了联盟侧 i 的比赛；b[i] 为该场比赛的联盟得分。分别对总分、自动段、手控段和末段求解。`,
    code: `A^T · A · x = A^T · b`,
  },
  {
    title: "贝叶斯收缩",
    body: `资格赛场次少于 5 场的队伍，其 OPR 会向赛事中位数收缩，以防止小样本过拟合。`,
    code: `α = min(场次数, 5) / 5\n预期值 = α × 观测值 + (1 − α) × 中位数`,
  },
  {
    title: "协同得分",
    body: `每支队伍在（自动段、手控段、末段）空间中被表示为归一化角色指纹。欧氏距离驱动互补性；共同主导则产生重叠惩罚。`,
    code: `fp = (auto/total, teleop/total, endgame/total)\n互补性 = (dist / √2) × 60\n重叠 = min_phase_overlap × 20\n协同 = combined + 互补性 − 重叠`,
  },
  {
    title: "蒙特卡洛胜率预测",
    body: `1,000 次模拟。每次运行使用 Box-Muller 变换从 N(μ, σ) 分布中采样每支队伍的得分，按联盟求和后统计胜者。`,
    code: `u1, u2 ~ Uniform(0,1)\nz = √(−2 ln u1) · cos(2π u2)\nsample = μ + σ·z`,
  },
  {
    title: "稳定性与可靠性",
    body: `稳定性由队伍得分的四分位距（IQR）决定（波动越小 = 稳定性越高）。可靠性是稳定性（60%）与场次数（40%）的综合指标。`,
    code: `稳定性 = 100 − (IQR / 400) × 100\n可靠性 = 0.6 × 稳定性 + 0.4 × clamp(场次/5, 0, 1) × 100`,
  },
];

export default function MethodologyPage() {
  const { t, lang, toggle } = useI18n();
  const sections = lang === "zh" ? SECTIONS_ZH : SECTIONS_EN;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <Link href="/"
          className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all"
          style={{ color: "var(--text-muted)" }}>
          <Home className="w-4 h-4" />
          {t.methodology.back}
        </Link>
        <button onClick={toggle} className="lang-btn flex items-center gap-1.5">
          <Globe className="w-3 h-3" />
          {t.nav.toggleLang}
        </button>
      </div>

      <h1 className="text-3xl font-black mb-2 animate-slide-up">{t.methodology.title}</h1>
      <p className="text-sm mb-8 animate-slide-up stagger-1" style={{ color: "var(--text-muted)" }}>
        {t.methodology.subtitle}
      </p>

      {sections.map((s, i) => (
        <div key={s.title}
          className="glass rounded-2xl p-5 mb-4 animate-fade-in"
          style={{ animationDelay: `${i * 0.08}s`, opacity: 0, animationFillMode: "forwards", border: "1px solid var(--border)" }}>
          <h2 className="font-bold text-lg mb-2">{s.title}</h2>
          <p className="text-sm mb-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>{s.body}</p>
          <pre className="text-xs p-3 rounded-xl overflow-x-auto font-mono"
            style={{ background: "var(--surface-2)", color: "var(--accent)", border: "1px solid var(--border)" }}>
            {s.code}
          </pre>
        </div>
      ))}
    </div>
  );
}

