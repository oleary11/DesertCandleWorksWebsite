import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Desert Candle Works - All-Natural Candles in Scottsdale, AZ";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #FDF6E3 0%, #F5E6D3 50%, #E8D5C4 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Decorative desert elements */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "120px",
            background: "linear-gradient(to top, #D4A574 0%, transparent 100%)",
            opacity: 0.3,
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "40px",
          }}
        >
          {/* Brand name */}
          <h1
            style={{
              fontSize: "72px",
              fontWeight: 700,
              color: "#2D2A26",
              margin: 0,
              letterSpacing: "-2px",
              textAlign: "center",
            }}
          >
            Desert Candle Works
          </h1>

          {/* Tagline */}
          <p
            style={{
              fontSize: "32px",
              color: "#5C5650",
              margin: "20px 0 0 0",
              textAlign: "center",
              maxWidth: "800px",
            }}
          >
            All-Natural Coconut Apricot Wax Candles
          </p>

          {/* Location badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: "30px",
              padding: "12px 24px",
              background: "rgba(255, 255, 255, 0.7)",
              borderRadius: "50px",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "20px" }}>📍</span>
            <span
              style={{
                fontSize: "20px",
                color: "#6B6560",
                fontWeight: 500,
              }}
            >
              Handmade in Scottsdale, Arizona
            </span>
          </div>

          {/* Features */}
          <div
            style={{
              display: "flex",
              gap: "40px",
              marginTop: "40px",
            }}
          >
            {["🌿 100% Natural", "♻️ Upcycled Bottles", "🔥 Clean Burning"].map(
              (feature) => (
                <span
                  key={feature}
                  style={{
                    fontSize: "18px",
                    color: "#7A756E",
                  }}
                >
                  {feature}
                </span>
              )
            )}
          </div>
        </div>

        {/* Website URL */}
        <div
          style={{
            position: "absolute",
            bottom: "30px",
            fontSize: "18px",
            color: "#8A857E",
          }}
        >
          www.desertcandleworks.com
        </div>
      </div>
    ),
    { ...size }
  );
}
