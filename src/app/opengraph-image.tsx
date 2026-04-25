import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "ScoutSelect — FTC Alliance Selection Tool";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #080b14 0%, #0d1117 50%, #161b27 100%)",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}>
        {/* Glow blob */}
        <div
          style={{
            position: "absolute",
            top: 60,
            left: "50%",
            transform: "translateX(-50%)",
            width: 600,
            height: 300,
            background: "radial-gradient(ellipse at center, rgba(99,102,241,0.25) 0%, transparent 70%)",
            borderRadius: "50%",
          }}
        />

        {/* Logo badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "rgba(99,102,241,0.15)",
            border: "1px solid rgba(99,102,241,0.35)",
            borderRadius: 100,
            padding: "8px 20px",
            marginBottom: 32,
          }}>
          <span style={{ fontSize: 20, color: "#6366f1" }}>⚡</span>
          <span style={{ fontSize: 16, color: "#6366f1", fontWeight: 600, letterSpacing: 2 }}>
            FTC ALLIANCE SELECTION TOOL
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 96,
            fontWeight: 900,
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #6366f1 100%)",
            backgroundClip: "text",
            color: "transparent",
            marginBottom: 20,
            letterSpacing: -3,
          }}>
          ScoutSelect
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 28,
            color: "#94a3b8",
            textAlign: "center",
            maxWidth: 800,
            lineHeight: 1.4,
          }}>
          Data-informed alliance picks for FIRST Tech Challenge teams
        </div>

        {/* Feature pills */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 48,
          }}>
          {["Team Lookup", "Event Analysis", "Pick Optimizer", "Win Probability"].map((label) => (
            <div
              key={label}
              style={{
                background: "rgba(99,102,241,0.12)",
                border: "1px solid rgba(99,102,241,0.25)",
                borderRadius: 8,
                padding: "8px 16px",
                color: "#a5b4fc",
                fontSize: 16,
                fontWeight: 500,
              }}>
              {label}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            fontSize: 14,
            color: "#475569",
          }}>
          scoutselect.org · Free · No login required · Powered by FTCScout
        </div>
      </div>
    ),
    { ...size }
  );
}
