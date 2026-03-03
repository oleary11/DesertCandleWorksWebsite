export default function CandleSpinner() {
  return (
    <svg id="loading-candle" width="48" height="96" viewBox="0 0 48 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>{`
          @keyframes cl-fade {
            0%, 80%  { opacity: 1; }
            89%      { opacity: 0; }
            93%      { opacity: 0; }
            100%     { opacity: 1; }
          }
          @keyframes cl-burn-body {
            0%        { transform: scaleY(1); }
            82%       { transform: scaleY(0.18); }
            92.9%     { transform: scaleY(0.18); }
            93%, 100% { transform: scaleY(1); }
          }
          @keyframes cl-burn-down {
            0%        { transform: translateY(0px); }
            82%       { transform: translateY(41px); }
            92.9%     { transform: translateY(41px); }
            93%, 100% { transform: translateY(0px); }
          }
          @keyframes cl-flicker {
            0%,100% { transform: scaleX(1) scaleY(1); opacity: 1; }
            20%     { transform: scaleX(0.88) scaleY(1.09); opacity: 0.92; }
            50%     { transform: scaleX(1.1) scaleY(0.94); opacity: 1; }
            75%     { transform: scaleX(0.92) scaleY(1.05); opacity: 0.96; }
          }
          @keyframes cl-glow {
            0%,100% { opacity: 0.38; }
            50%     { opacity: 0.62; }
          }
          #loading-candle .cl-fade  { animation: cl-fade 3s ease-in-out infinite; }
          #loading-candle .cl-body  { transform-box: fill-box; transform-origin: center bottom; animation: cl-burn-body 3s ease-in infinite; }
          #loading-candle .cl-down  { animation: cl-burn-down 3s ease-in infinite; }
          #loading-candle .cl-flame { transform-box: fill-box; transform-origin: center bottom; animation: cl-flicker 0.48s ease-in-out infinite; }
          #loading-candle .cl-glow  { animation: cl-glow 0.6s ease-in-out infinite; }
        `}</style>
      </defs>

      {/* Fixed base plate */}
      <rect x="6" y="82" width="36" height="10" rx="3" fill="#D6CEC4" />
      <rect x="8" y="82" width="32" height="4" rx="2" fill="#C4BAB0" />

      {/* Fade group — handles opacity for smooth reset transition */}
      <g className="cl-fade">
        {/* Candle body — scaleY from bottom center keeps base fixed, top surface drops */}
        <rect className="cl-body" x="10" y="32" width="28" height="50" rx="4" fill="#F5F0EB" />

        {/* Down group — all top-surface elements move down with burning */}
        <g className="cl-down">
          <rect x="10" y="32" width="28" height="7" rx="4" fill="#E7E0D8" />
          <ellipse cx="16" cy="37" rx="2.5" ry="4" fill="#EDE8E2" opacity="0.7" />
          <rect x="23" y="25" width="2" height="9" rx="1" fill="#44403C" />
          <circle className="cl-glow" cx="24" cy="20" r="9" fill="#FCD34D" opacity="0.38" />
          <ellipse className="cl-flame" cx="24" cy="13" rx="6" ry="10" fill="#F97316" />
          <ellipse className="cl-flame" cx="24" cy="15" rx="4" ry="7" fill="#FB923C" />
          <ellipse className="cl-flame" cx="24" cy="17" rx="2.5" ry="5" fill="#FEF08A" />
        </g>
      </g>
    </svg>
  );
}
