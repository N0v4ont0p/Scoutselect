export type Lang = "en" | "zh";

export const translations = {
  en: {
    // Nav
    nav: {
      brand: "⚡ ScoutSelect",
      teams: "Teams",
      events: "Events",
      seasons: "Seasons",
      compare: "Compare",
      methodology: "Methodology",
      toggleLang: "中文",
    },
    // Home
    home: {
      badge: "FTC Alliance Intelligence",
      headline: "ScoutSelect",
      subheadline: "Alliance selection intelligence for FTC teams. Know who to pick — and who to pitch yourself to.",
      searchPlaceholder: "Search team number or name…",
      seasonsTitle: "Seasons",
      footer: "Built by",
      footerPowered: "Powered by",
      features: {
        role: { title: "Alliance Role Detector", desc: "Enter your team — ScoutSelect instantly tells you if you're a captain, in the pick pool, or on the bubble, based on live rankings." },
        pick: { title: "Smart Pick Optimizer", desc: "Snake-draft simulation models who other captains will take before your turn, giving you availability-adjusted pick rankings." },
        pitch: { title: "Pitch Strategy Engine", desc: "Ranked list of captains who need YOU most, with calculated improvement deltas and ready-to-say talking points for each." },
        synergy: { title: "Synergy & Fit Scoring", desc: "Role fingerprints in auto/teleop/endgame space expose complementarity gaps — no more guessing who fills what hole." },
        win: { title: "Win Probability Projections", desc: "Monte Carlo simulation (2,000 runs) forecasts your win probability against every projected opponent alliance." },
        discover: { title: "Team-First Discovery", desc: "Enter your team number to see your events by name. No event codes to memorise. Click any event to analyse." },
      },
    },
    // Teams search
    teams: {
      title: "Team Search",
      placeholder: "Team number or name…",
      back: "Home",
      notFound: 'No teams found for "{query}"',
      error: "Search error — please try again",
    },
    // Team detail
    teamDetail: {
      back: "Home",
      notFound: "Team {num} not found.",
      eventsTitle: "{season} Events",
      noEvents: "No events found for this season.",
      complete: "Complete",
    },
    // Events
    events: {
      badge: "Alliance Analysis",
      title: "Analyze Your Event",
      subtitle: "Enter your team number to see your events — then click any to get full alliance selection analysis.",
      teamLabel: "Your Team Number",
      teamPlaceholder: "e.g. 19859",
      seasonLabel: "Season",
      findBtn: "Find My Events",
      loading: "Loading events…",
      noEvents: "No events found for Team {team} in {season}.",
      liveNow: "🔴 Live Now",
      upcoming: "📅 Upcoming",
      past: "✅ Past Events",
      analyzeBtn: "Analyze Live →",
      viewBtn: "View Analysis →",
      previewBtn: "Preview →",
      manualToggle: "Enter event code manually",
      manualHint: "If you know the FTCScout event code, enter it here directly.",
      manualPlaceholder: "Event code (e.g. USMDCMPF1)",
      manualGo: "Go →",
    },
    // Seasons
    seasons: {
      title: "Seasons",
      seasonLabel: "{start}–{end}",
    },
    // Season detail
    seasonDetail: {
      back: "Seasons",
      subtitle: "{start}–{end} FTC Season",
      enterCode: "Enter an event code to open the analytics dashboard for a {name} event.",
      openLookup: "Open Event Lookup",
    },
    // Compare
    compare: {
      back: "Home",
      title: "Compare Teams",
      seasonLabel: "Season",
      eventCodeLabel: "Event Code",
      eventCodePlaceholder: "e.g. USMDCMPF1",
      teamPlaceholder: "Team {n} number",
      addTeam: "Add Team",
      compareBtn: "Compare",
      loading: "Loading…",
      matches: "{n} matches",
      reliability: "Reliability {n}/100",
      stats: {
        opr: "OPR",
        avgTotal: "Avg Total",
        auto: "Auto",
        teleop: "Teleop",
        endgame: "Endgame",
      },
    },
    // Methodology
    methodology: {
      back: "Home",
      title: "Methodology",
      subtitle: "How ScoutSelect computes alliance scores, OPR, and win probabilities.",
    },
    // Common
    common: {
      error: "Error — please try again",
      back: "Back",
    },
  },

  zh: {
    // Nav
    nav: {
      brand: "⚡ ScoutSelect",
      teams: "队伍",
      events: "赛事",
      seasons: "赛季",
      compare: "对比",
      methodology: "算法说明",
      toggleLang: "English",
    },
    // Home
    home: {
      badge: "FTC 联盟选择智能系统",
      headline: "ScoutSelect",
      subheadline: "为 FTC 队伍打造的联盟选择智能分析平台。精准识别应选队伍 — 以及向哪位队长推销自己。",
      searchPlaceholder: "搜索队伍编号或名称…",
      seasonsTitle: "赛季",
      footer: "由",
      footerPowered: "数据来源",
      features: {
        role: { title: "联盟角色识别器", desc: "输入队伍编号 — ScoutSelect 根据实时排名即时告知您是队长候选、可被选择，还是处于临界状态。" },
        pick: { title: "智能选人优化器", desc: "蛇形选人模拟模型预测其他队长在轮到您之前会选谁，并给出经可用性调整的选人排名。" },
        pitch: { title: "推销策略引擎", desc: "列出最需要您的队长排名，附带计算好的得分提升量和现成的沟通话术。" },
        synergy: { title: "协同与契合评分", desc: "自动/手控/末段得分空间中的角色指纹揭示互补缺口 — 不再凭猜测判断谁能填补哪个短板。" },
        win: { title: "胜率预测", desc: "蒙特卡洛模拟（2,000 次运行）预测您对阵每个预测对手联盟的胜率。" },
        discover: { title: "队伍优先发现", desc: "输入队伍编号即可按名称查看您的赛事。无需记忆赛事代码。点击任意赛事即可分析。" },
      },
    },
    // Teams search
    teams: {
      title: "队伍搜索",
      placeholder: "队伍编号或名称…",
      back: "首页",
      notFound: '未找到"{query}"相关队伍',
      error: "搜索出错 — 请重试",
    },
    // Team detail
    teamDetail: {
      back: "首页",
      notFound: "未找到队伍 {num}。",
      eventsTitle: "{season} 赛事",
      noEvents: "本赛季暂无赛事记录。",
      complete: "已完成",
    },
    // Events
    events: {
      badge: "联盟分析",
      title: "分析您的赛事",
      subtitle: "输入队伍编号查看您参加的赛事 — 点击任意赛事获取完整联盟选择分析。",
      teamLabel: "您的队伍编号",
      teamPlaceholder: "例：19859",
      seasonLabel: "赛季",
      findBtn: "查找我的赛事",
      loading: "加载赛事中…",
      noEvents: "在 {season} 中未找到队伍 {team} 的赛事。",
      liveNow: "🔴 直播中",
      upcoming: "📅 即将举行",
      past: "✅ 历史赛事",
      analyzeBtn: "实时分析 →",
      viewBtn: "查看分析 →",
      previewBtn: "预览 →",
      manualToggle: "手动输入赛事代码",
      manualHint: "如果您知道 FTCScout 赛事代码，可在此直接输入。",
      manualPlaceholder: "赛事代码（例：USMDCMPF1）",
      manualGo: "前往 →",
    },
    // Seasons
    seasons: {
      title: "赛季",
      seasonLabel: "{start}–{end}",
    },
    // Season detail
    seasonDetail: {
      back: "赛季列表",
      subtitle: "{start}–{end} FTC 赛季",
      enterCode: "输入赛事代码以打开 {name} 赛事的分析面板。",
      openLookup: "打开赛事查询",
    },
    // Compare
    compare: {
      back: "首页",
      title: "队伍对比",
      seasonLabel: "赛季",
      eventCodeLabel: "赛事代码",
      eventCodePlaceholder: "例：USMDCMPF1",
      teamPlaceholder: "队伍 {n} 编号",
      addTeam: "添加队伍",
      compareBtn: "对比",
      loading: "加载中…",
      matches: "{n} 场比赛",
      reliability: "可靠性 {n}/100",
      stats: {
        opr: "OPR",
        avgTotal: "平均总分",
        auto: "自动段",
        teleop: "手控段",
        endgame: "末段",
      },
    },
    // Methodology
    methodology: {
      back: "首页",
      title: "算法说明",
      subtitle: "ScoutSelect 如何计算联盟得分、OPR 及胜率。",
    },
    // Common
    common: {
      error: "出现错误 — 请重试",
      back: "返回",
    },
  },
};

export type Translations = (typeof translations)["en"] | (typeof translations)["zh"];
