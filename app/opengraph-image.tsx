import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#f8fafc",
          color: "#0f172a",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          padding: "72px",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 28, width: "100%" }}>
          <div style={{ color: "#4f46e5", fontSize: 34, fontWeight: 800 }}>Agentify</div>
          <div style={{ fontSize: 74, fontWeight: 900, lineHeight: 1.02, maxWidth: 900 }}>
            AI business assistant for support, sales, and lead capture
          </div>
          <div style={{ color: "#475569", fontSize: 30, lineHeight: 1.35, maxWidth: 780 }}>
            Train from your website. Embed the widget. Share hosted chat. Convert visitors around the clock.
          </div>
        </div>
      </div>
    ),
    size
  );
}
