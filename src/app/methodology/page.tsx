"use client";
import Link from "next/link";
import { Home, Globe } from "lucide-react";
import { useI18n } from "@/context/LanguageContext";

interface Section {
  title: string;
  tag?: string;
  body: string;
  code?: string;
}

const SECTIONS_EN: Section[] = [
  // ── Pipeline overview ─────────────────────────────────────────────────────
  {
    title: "Algorithm Pipeline Overview",
    tag: "Overview",
    body: `ScoutSelect processes live FTCScout data through a five-stage pipeline:
1. Fetch – pull match scores, rankings, and team rosters from the FTCScout GraphQL API.
2. Compute – calculate OPR, team metrics (avg, IQR, trend), and synergy fingerprints.
3. Simulate – run a greedy snake-draft to model pick availability.
4. Project – optimise pick lists and pitch rankings per team.
5. Forecast – Monte Carlo win-probability across projected alliance matchups.
All stages run client-side in the browser with no server state; refreshing re-runs the full pipeline.`,
  },

  // ── Phase Detection ───────────────────────────────────────────────────────
  {
    title: "Event Phase Detection",
    tag: "Phase",
    body: `The dashboard automatically detects which phase an event is in and shows the right UI for it. The phase is inferred from match counts alone — no manual input required. A manual override dropdown lets scouters force a phase if the API lags.`,
    code: `if totalMatches == 0          → "upcoming"
if playoffMatches > 0:
  if playoffMatches >= 13     → "complete"
  else                        → "playoffs_running"
if qualMatches > 0 and playoffMatches == 0:
  if qualMatches >= total×0.95 → "alliance_selection"
  else                        → "quals_running"`,
  },

  // ── Alliance Role ─────────────────────────────────────────────────────────
  {
    title: "Alliance Role Detection",
    tag: "Role",
    body: `Each team is classified as captain, borderline, or picked based on their qualification rank and the estimated number of alliances for the event. Borderline teams receive both the captain and picked views so they can prepare for either scenario. Number of alliances scales with total team count.`,
    code: `numAlliances: ≤8 teams → 2, ≤12 → 3, ≤20 → 4, ≤32 → 6, else → 8

if rank ≤ numAlliances         → "captain"
if rank ≤ numAlliances + 2     → "borderline"
else                           → "picked"`,
  },

  // ── OPR ──────────────────────────────────────────────────────────────────
  {
    title: "Offensive Power Rating (OPR)",
    tag: "OPR",
    body: `OPR attributes each team an individual contribution to alliance scores by solving the over-determined linear system A·x = b via Gaussian elimination with partial pivoting. Each row of A is one alliance in one match; each column is a team (1 if playing, 0 otherwise). b is the alliance's score. Solved independently for total, auto, teleop, and endgame to produce per-phase OPRs.`,
    code: `A[alliance_i][team_j] = 1  if team j played for alliance i
b[alliance_i]           = alliance score in that match

Solve: A^T·A · x = A^T·b   (normal equations)
Result x[j] = team j's OPR contribution`,
  },

  // ── Bayesian Shrinkage ────────────────────────────────────────────────────
  {
    title: "Bayesian Shrinkage",
    tag: "Stats",
    body: `Teams with fewer than 5 qualification matches produce unreliable OPR estimates. A Bayesian shrinkage weight pulls those estimates toward the event median, reducing over-confidence on tiny samples. Teams with ≥5 matches use their full observed OPR.`,
    code: `α = min(matchCount, 5) / 5
smoothed = α × observed_OPR + (1 − α) × event_median`,
  },

  // ── Consistency & Reliability ─────────────────────────────────────────────
  {
    title: "Consistency & Reliability",
    tag: "Metrics",
    body: `Consistency measures score stability using the inter-quartile range (IQR) of a team's match scores — a tighter IQR means more predictable performance. Reliability is a composite weighting consistency (60%) and match volume (40%), so teams with few matches are penalised even if their scores look consistent.`,
    code: `consistency = 100 − (IQR / 400) × 100
reliability = 0.6 × consistency
            + 0.4 × clamp(matchCount / 5, 0, 1) × 100`,
  },

  // ── Synergy ──────────────────────────────────────────────────────────────
  {
    title: "Synergy Score",
    tag: "Synergy",
    body: `Each team is encoded as a normalised role fingerprint in (auto, teleop, endgame) space. Two teams with different dominant phases are complementary (high Euclidean distance → positive bonus). Two teams that both dominate the same phase create an overlap penalty. The net synergy score is added to projected alliance strength.`,
    code: `fingerprint = (avgAuto/avgTotal, avgDc/avgTotal, avgEndgame/avgTotal)

dist            = Euclidean distance between two fingerprints
complementarity = (dist / √2) × 60          // max +60
overlapPenalty  = min(fp_a[phase], fp_b[phase]) × 20  // max −20

synergy = complementarity − overlapPenalty`,
  },

  // ── Draft Simulation ──────────────────────────────────────────────────────
  {
    title: "Snake-Draft Simulation",
    tag: "Draft",
    body: `To model which teams will still be available when you pick, ScoutSelect simulates a greedy snake draft. Each captain, in rank order, picks the available team that maximises their projected 2-team alliance strength. The draft reverses direction for pick 2 (round 2 picks in reverse rank order). This produces a draft-adjusted availability flag for each candidate pick.`,
    code: `Round 1 (pick 1): captain 1 → captain 2 → … → captain N
Round 2 (pick 2): captain N → captain N-1 → … → captain 1

Each captain greedily picks: argmax_t allianceStrength(captain, t)
Output: available_r1[team], available_r2[team]`,
  },

  // ── Alliance Strength ─────────────────────────────────────────────────────
  {
    title: "Alliance Strength",
    tag: "Strength",
    body: `Alliance strength combines the sum of team OPRs with a pairwise synergy bonus averaged across all team pairs in the alliance. The synergy bonus is scaled by 0.4 to prevent it from overwhelming the raw OPR signal.`,
    code: `totalOPR = sum of OPRs for all teams in alliance

for each pair (i, j):
  bonus += synergy(i,j).complementarity − synergy(i,j).overlapPenalty

pairsCount = N × (N−1) / 2
allianceStrength = totalOPR + (bonus / pairsCount) × 0.4`,
  },

  // ── Picklist ─────────────────────────────────────────────────────────────
  {
    title: "Picklist Generation & Modes",
    tag: "Picks",
    body: `For a captain, ScoutSelect evaluates every available team as a potential pick 1, then for each simulates the best pick 2 from the remaining pool, producing a projected 3-team alliance strength. Results are ranked by that projected strength and annotated with availability from the draft simulation. Four ranking modes shift the weighting:
• Safe — prioritises reliability and consistency.
• Balanced — equal weight on OPR, synergy, and reliability.
• Ceiling — maximises peak (high-score) potential.
• Counter — maximises win probability against the projected #1 alliance.`,
    code: `score(pick1) = allianceStrength(captain, pick1, best_pick2)

Modes adjust weights on: opr, synergy, reliability, highScore
Draft simulation annotates: "Available R1", "Likely gone", etc.`,
  },

  // ── Pitch Strategy ────────────────────────────────────────────────────────
  {
    title: "Pitch Strategy Engine",
    tag: "Pitch",
    body: `For teams in the picked pool, ScoutSelect ranks every captain by how much you improve their alliance. The improvement delta is the difference in projected alliance strength with and without you as pick 1. Captains where you provide the largest delta are most likely to want you. Talking points and red flags are generated automatically from your metrics.`,
    code: `delta(captain) = allianceStrength(captain, you)
               − allianceStrength(captain, their_best_alternative)

Ranked descending by delta → priority approach order

talkingPoints generated from: avgAuto, avgEndgame, reliability,
                               synergy.complementarity, trend
redFlags generated from:      matchCount < 5, consistency < 50,
                               avgEndgame < 5`,
  },

  // ── Monte Carlo ───────────────────────────────────────────────────────────
  {
    title: "Monte Carlo Win Probability",
    tag: "Monte Carlo",
    body: `Win probabilities are computed by running 2,000 simulated matches against each projected opponent alliance. In each simulation, every team's contribution is sampled from a normal distribution N(μ, σ) using the Box-Muller transform (μ = OPR, σ = score standard deviation). Alliance scores are summed and the winner tallied. The final win probability is the fraction of simulations won.`,
    code: `for each simulation (n = 2,000):
  for each team t in alliance:
    u1, u2 ~ Uniform(0,1)
    z = √(−2 ln u1) · cos(2π u2)   // Box-Muller
    score_t = μ_t + σ_t · z

  red_score  = sum(scores for red teams)
  blue_score = sum(scores for blue teams)
  tally winner

P(win) = wins / 2000`,
  },
];

const SECTIONS_ZH: Section[] = [
  {
    title: "算法流程概览",
    tag: "概览",
    body: `ScoutSelect 通过五个阶段处理来自 FTCScout 的实时数据：
1. 获取 — 从 FTCScout GraphQL API 拉取比赛得分、排名和队伍名单。
2. 计算 — 计算 OPR、队伍指标（均值、IQR、趋势）和协同指纹。
3. 模拟 — 运行贪心蛇形选拔赛以模拟选人可用性。
4. 预测 — 为每支队伍优化选人列表和推销排名。
5. 预报 — 对预测联盟对阵进行蒙特卡洛胜率计算。
所有阶段均在浏览器客户端运行，无服务器状态；刷新页面将重新运行完整流程。`,
  },
  {
    title: "赛事阶段检测",
    tag: "阶段",
    body: `系统仅根据比赛场次数自动判断赛事所处阶段，无需手动输入。控制台下拉菜单允许手动覆盖阶段（适用于 API 数据延迟的情况）。`,
    code: `若 totalMatches == 0              → "即将举行"
若 playoffMatches > 0:
  若 playoffMatches >= 13         → "已完成"
  否则                            → "淘汰赛进行中"
若 qualMatches > 0 且 playoffMatches == 0:
  若 qualMatches >= total×0.95   → "联盟选拔"
  否则                            → "资格赛进行中"`,
  },
  {
    title: "联盟角色识别",
    tag: "角色",
    body: `根据队伍的资格赛排名和赛事预计联盟数量，将每支队伍分类为"队长"、"临界"或"可被选"。临界队伍同时显示队长和被选两种视图。联盟数量随参赛队伍总数动态调整。`,
    code: `联盟数：≤8队 → 2, ≤12 → 3, ≤20 → 4, ≤32 → 6, 其他 → 8

若排名 ≤ 联盟数              → "队长"
若排名 ≤ 联盟数 + 2          → "临界"
否则                         → "可被选"`,
  },
  {
    title: "进攻效率评分 (OPR)",
    tag: "OPR",
    body: `OPR 通过求解超定线性方程组 A·x = b（带部分主元的高斯消元法）为每支队伍分配个人得分贡献。A 的每行对应一场比赛中的某个联盟侧；每列对应一支队伍（参赛为1，否则为0）。b 为该联盟在该场比赛的得分。分别对总分、自动段、手控段和末段独立求解。`,
    code: `A[联盟_i][队伍_j] = 1  若队伍 j 为联盟 i 上场
b[联盟_i]           = 该场比赛联盟得分

求解: A^T·A · x = A^T·b   （正规方程）
结果 x[j] = 队伍 j 的 OPR 贡献`,
  },
  {
    title: "贝叶斯收缩",
    tag: "统计",
    body: `资格赛场次少于 5 场的队伍 OPR 估计值不可靠。贝叶斯收缩权重将这些估计值拉向赛事中位数，减少小样本的过度自信。场次 ≥5 的队伍使用完整观测 OPR。`,
    code: `α = min(场次数, 5) / 5
平滑值 = α × 观测OPR + (1 − α) × 赛事中位数`,
  },
  {
    title: "稳定性与可靠性",
    tag: "指标",
    body: `稳定性使用队伍比赛得分的四分位距（IQR）衡量得分稳定性——IQR 越小，表现越可预测。可靠性综合稳定性（60%）和比赛场次（40%），场次少的队伍即使得分看似稳定也会受到惩罚。`,
    code: `稳定性 = 100 − (IQR / 400) × 100
可靠性 = 0.6 × 稳定性
       + 0.4 × clamp(场次 / 5, 0, 1) × 100`,
  },
  {
    title: "协同得分",
    tag: "协同",
    body: `每支队伍在（自动段、手控段、末段）空间中被编码为归一化角色指纹。主导阶段不同的两支队伍具有互补性（欧氏距离大 → 正加成）。两支队伍同时主导同一阶段则产生重叠惩罚。净协同得分加入预测联盟实力。`,
    code: `指纹 = (avgAuto/avgTotal, avgDc/avgTotal, avgEndgame/avgTotal)

dist     = 两指纹间的欧氏距离
互补性   = (dist / √2) × 60          // 最大 +60
重叠惩罚 = min(fp_a[阶段], fp_b[阶段]) × 20  // 最大 −20

协同 = 互补性 − 重叠惩罚`,
  },
  {
    title: "蛇形选拔模拟",
    tag: "选拔",
    body: `为模拟轮到您选人时哪些队伍仍可用，ScoutSelect 模拟一次贪心蛇形选拔。每位队长按排名顺序贪心选择使其预测双人联盟实力最大化的可用队伍。第二轮以反向排名顺序进行，为每个候选选人生成可用性标注。`,
    code: `第1轮（选1）：队长1 → 队长2 → … → 队长N
第2轮（选2）：队长N → 队长N-1 → … → 队长1

每位队长贪心选择: argmax_t allianceStrength(队长, t)
输出: available_r1[队伍], available_r2[队伍]`,
  },
  {
    title: "联盟实力",
    tag: "实力",
    body: `联盟实力将联盟中所有队伍 OPR 之和与联盟内所有队伍对的平均协同加成相结合。协同加成按 0.4 缩放，防止其淹没原始 OPR 信号。`,
    code: `totalOPR = 联盟内所有队伍 OPR 之和

对每对 (i, j):
  bonus += synergy(i,j).互补性 − synergy(i,j).重叠惩罚

对数 = N × (N−1) / 2
联盟实力 = totalOPR + (bonus / 对数) × 0.4`,
  },
  {
    title: "选人列表生成与模式",
    tag: "选人",
    body: `对于队长，ScoutSelect 评估每支可用队伍作为第1选人的潜力，并为每支队伍从剩余池中模拟最佳第2选人，生成预测三人联盟实力。结果按该预测实力排序，并附有选拔模拟的可用性标注。四种排名模式调整权重：
• 稳健 — 优先考虑可靠性和稳定性。
• 均衡 — OPR、协同和可靠性等权。
• 天花板 — 最大化峰值（最高分）潜力。
• 克制 — 最大化对抗预测第1联盟的胜率。`,
    code: `score(选1) = allianceStrength(队长, 选1, best_选2)

模式调整权重: opr, synergy, reliability, highScore
选拔模拟标注: "第1轮可用"、"可能已被选走" 等`,
  },
  {
    title: "推销策略引擎",
    tag: "推销",
    body: `对于处于被选池中的队伍，ScoutSelect 按您对每位队长联盟提升幅度从大到小排名。提升增量为有您和没有您时预测联盟实力之差。您提供最大增量的队长最有可能想要您。系统根据您的指标自动生成推销要点和风险提示。`,
    code: `delta(队长) = allianceStrength(队长, 我)
            − allianceStrength(队长, 其最佳替代)

按 delta 降序排列 → 优先接触顺序

推销要点来源: avgAuto, avgEndgame, reliability,
              synergy.complementarity, trend
风险提示来源: matchCount < 5, consistency < 50,
              avgEndgame < 5`,
  },
  {
    title: "蒙特卡洛胜率预测",
    tag: "蒙特卡洛",
    body: `通过对每支预测对手联盟运行 2,000 次模拟比赛来计算胜率。在每次模拟中，每支队伍的贡献从正态分布 N(μ, σ) 中采样（使用 Box-Muller 变换，μ = OPR，σ = 得分标准差）。对联盟得分求和后统计胜者，最终胜率为胜利模拟次数的比例。`,
    code: `对每次模拟 (n = 2,000):
  对联盟中每支队伍 t:
    u1, u2 ~ Uniform(0,1)
    z = √(−2 ln u1) · cos(2π u2)   // Box-Muller
    score_t = μ_t + σ_t · z

  红方得分 = 红方队伍得分之和
  蓝方得分 = 蓝方队伍得分之和
  统计胜者

P(胜) = 胜利次数 / 2000`,
  },
];

const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  Overview:    { bg: "rgba(99,102,241,0.12)",  color: "var(--accent)" },
  Phase:       { bg: "rgba(245,158,11,0.12)",  color: "var(--warning)" },
  Role:        { bg: "rgba(99,102,241,0.12)",  color: "var(--accent)" },
  OPR:         { bg: "rgba(34,197,94,0.12)",   color: "var(--success)" },
  Stats:       { bg: "rgba(34,197,94,0.12)",   color: "var(--success)" },
  Metrics:     { bg: "rgba(34,197,94,0.12)",   color: "var(--success)" },
  Synergy:     { bg: "rgba(239,68,68,0.1)",    color: "var(--danger)" },
  Draft:       { bg: "rgba(245,158,11,0.12)",  color: "var(--warning)" },
  Strength:    { bg: "rgba(99,102,241,0.12)",  color: "var(--accent)" },
  Picks:       { bg: "rgba(34,197,94,0.12)",   color: "var(--success)" },
  Pitch:       { bg: "rgba(239,68,68,0.1)",    color: "var(--danger)" },
  "Monte Carlo":{ bg: "rgba(99,102,241,0.12)", color: "var(--accent)" },
  // ZH tags (same colours, matched by value)
  概览:         { bg: "rgba(99,102,241,0.12)",  color: "var(--accent)" },
  阶段:         { bg: "rgba(245,158,11,0.12)",  color: "var(--warning)" },
  角色:         { bg: "rgba(99,102,241,0.12)",  color: "var(--accent)" },
  统计:         { bg: "rgba(34,197,94,0.12)",   color: "var(--success)" },
  指标:         { bg: "rgba(34,197,94,0.12)",   color: "var(--success)" },
  协同:         { bg: "rgba(239,68,68,0.1)",    color: "var(--danger)" },
  选拔:         { bg: "rgba(245,158,11,0.12)",  color: "var(--warning)" },
  实力:         { bg: "rgba(99,102,241,0.12)",  color: "var(--accent)" },
  选人:         { bg: "rgba(34,197,94,0.12)",   color: "var(--success)" },
  推销:         { bg: "rgba(239,68,68,0.1)",    color: "var(--danger)" },
  蒙特卡洛:     { bg: "rgba(99,102,241,0.12)",  color: "var(--accent)" },
};

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

      {sections.map((s, i) => {
        const tagStyle = s.tag ? (TAG_COLORS[s.tag] ?? { bg: "var(--surface-2)", color: "var(--text-muted)" }) : null;
        return (
          <div key={s.title}
            className="glass rounded-2xl p-5 mb-4 animate-fade-in"
            style={{ animationDelay: `${i * 0.06}s`, opacity: 0, animationFillMode: "forwards", border: "1px solid var(--border)" }}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <h2 className="font-bold text-lg leading-snug">{s.title}</h2>
              {s.tag && tagStyle && (
                <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider mt-1"
                  style={{ background: tagStyle.bg, color: tagStyle.color }}>
                  {s.tag}
                </span>
              )}
            </div>
            <p className="text-sm mb-3 leading-relaxed whitespace-pre-line" style={{ color: "var(--text-muted)" }}>{s.body}</p>
            {s.code && (
              <pre className="text-xs p-3 rounded-xl overflow-x-auto font-mono"
                style={{ background: "var(--surface-2)", color: "var(--accent)", border: "1px solid var(--border)" }}>
                {s.code}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}

