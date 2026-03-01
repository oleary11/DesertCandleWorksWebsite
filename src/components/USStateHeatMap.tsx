"use client";

import React, { useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";

// Free public CDN — US state boundary data (geographic shapes only, not analytics)
const GEO_URL =
  "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

// FIPS numeric code → state abbreviation
// Vercel's x-vercel-ip-country-region header returns state abbreviations (e.g. "AZ")
const FIPS_TO_ABBR: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA",
  "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL",
  "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN",
  "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME",
  "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
  "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
  "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
  "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
  "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI",
  "56": "WY",
};

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "Washington D.C.", FL: "Florida",
  GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana",
  IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine",
  MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island",
  SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin",
  WY: "Wyoming",
};

// Teal color scale from 0 visitors → many visitors
function getColor(visitors: number, max: number): string {
  if (visitors === 0 || max === 0) return "#e5e7eb"; // gray-200
  const ratio = visitors / max;
  if (ratio < 0.15) return "#ccfbf1"; // teal-100
  if (ratio < 0.35) return "#5eead4"; // teal-300
  if (ratio < 0.60) return "#14b8a6"; // teal-500
  if (ratio < 0.85) return "#0d9488"; // teal-600
  return "#0f766e";                   // teal-700
}

type Tooltip = {
  abbr: string;
  visitors: number;
  x: number;
  y: number;
};

type Props = {
  regions: Array<{ region: string; views: number }>;
};

export default function USStateHeatMap({ regions }: Props) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const visitorsByState: Record<string, number> = {};
  for (const r of regions) {
    visitorsByState[r.region] = r.views;
  }
  const maxVisitors = Math.max(...Object.values(visitorsByState), 1);

  return (
    <div className="relative select-none">
      <ComposableMap
        projection="geoAlbersUsa"
        style={{ width: "100%", height: "auto" }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const abbr = FIPS_TO_ABBR[geo.id] ?? "";
              const visitors = visitorsByState[abbr] ?? 0;
              const fill = getColor(visitors, maxVisitors);

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  stroke="#ffffff"
                  strokeWidth={0.5}
                  onMouseEnter={(e: React.MouseEvent) =>
                    setTooltip({ abbr, visitors, x: e.clientX, y: e.clientY })
                  }
                  onMouseMove={(e: React.MouseEvent) =>
                    setTooltip((prev) =>
                      prev ? { ...prev, x: e.clientX, y: e.clientY } : null
                    )
                  }
                  onMouseLeave={() => setTooltip(null)}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none", fill: "#0d9488", cursor: "default" },
                    pressed: { outline: "none" },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>

      {/* Floating tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-lg"
          style={{ left: tooltip.x + 14, top: tooltip.y - 36 }}
        >
          <span className="font-semibold">
            {STATE_NAMES[tooltip.abbr] ?? tooltip.abbr}
          </span>
          <span className="text-gray-300 ml-1.5">
            {tooltip.visitors.toLocaleString()}{" "}
            {tooltip.visitors === 1 ? "visitor" : "visitors"}
          </span>
        </div>
      )}

      {/* Color legend */}
      <div className="flex items-center gap-2 mt-1 text-xs text-[var(--color-muted)]">
        <span>0</span>
        <div className="flex gap-px">
          {["#e5e7eb", "#ccfbf1", "#5eead4", "#14b8a6", "#0d9488", "#0f766e"].map((c) => (
            <div
              key={c}
              className="w-6 h-3 rounded-sm"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <span>{maxVisitors.toLocaleString()} visitors</span>
      </div>
    </div>
  );
}
