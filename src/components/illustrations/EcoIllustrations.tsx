import React from 'react';

/**
 * Custom modern SVG illustrations for URJASAATHI
 * Follows Deep Forest Green (#14532D), Emerald (#059669), Lime Green (#A3E635),
 * and soft neutrals to create an Apple/SaaS clean tech aesthetic.
 */

export const SolarRoofIllustration: React.FC<{ className?: string }> = ({ className = "w-48 h-32" }) => (
  <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="skyGrad" x1="160" y1="0" x2="160" y2="160" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F0FDF4" />
        <stop offset="1" stopColor="#DCFCE7" stopOpacity="0.4" />
      </linearGradient>
      <linearGradient id="sunGrad" x1="260" y1="20" x2="300" y2="60" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FACC15" />
        <stop offset="1" stopColor="#EAB308" />
      </linearGradient>
      <linearGradient id="panelGrad" x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#047857" />
        <stop offset="1" stopColor="#065F46" />
      </linearGradient>
      <linearGradient id="roofGrad" x1="80" y1="70" x2="240" y2="120" gradientUnits="userSpaceOnUse">
        <stop stopColor="#1E293B" />
        <stop offset="1" stopColor="#0F172A" />
      </linearGradient>
    </defs>
    {/* Soft Sky Background */}
    <rect width="320" height="200" rx="16" fill="url(#skyGrad)" />
    
    {/* Radiant Sun */}
    <circle cx="270" cy="45" r="24" fill="url(#sunGrad)" opacity="0.9" />
    <circle cx="270" cy="45" r="34" stroke="#FDE047" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.6" />
    
    {/* Distant Hills */}
    <path d="M-20 180 Q60 120 160 150 T340 140 L340 200 L-20 200 Z" fill="#BBF7D0" opacity="0.5" />
    <path d="M40 180 Q140 130 240 165 T360 155 L360 200 L40 200 Z" fill="#86EFAC" opacity="0.4" />
    
    {/* Modern Eco-Home Body */}
    <rect x="75" y="110" width="170" height="80" rx="4" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="2" />
    
    {/* Roof */}
    <polygon points="60,110 160,65 260,110" fill="url(#roofGrad)" />
    
    {/* Solar PV Panels (Left & Right Array) */}
    <polygon points="90,105 155,75 155,95 90,115" fill="url(#panelGrad)" stroke="#34D399" strokeWidth="1.5" />
    <line x1="122" y1="90" x2="122" y2="105" stroke="#6EE7B7" strokeWidth="1" />
    <line x1="90" y1="110" x2="155" y2="85" stroke="#6EE7B7" strokeWidth="1" />

    <polygon points="165,75 230,105 230,115 165,95" fill="url(#panelGrad)" stroke="#34D399" strokeWidth="1.5" />
    <line x1="197" y1="90" x2="197" y2="105" stroke="#6EE7B7" strokeWidth="1" />
    <line x1="165" y1="85" x2="230" y2="110" stroke="#6EE7B7" strokeWidth="1" />

    {/* Windows & Eco Door */}
    <rect x="95" y="125" width="30" height="30" rx="4" fill="#E0F2FE" stroke="#38BDF8" strokeWidth="1.5" />
    <line x1="110" y1="125" x2="110" y2="155" stroke="#38BDF8" strokeWidth="1" />
    <line x1="95" y1="140" x2="125" y2="140" stroke="#38BDF8" strokeWidth="1" />

    <rect x="195" y="125" width="30" height="30" rx="4" fill="#E0F2FE" stroke="#38BDF8" strokeWidth="1.5" />
    <line x1="210" y1="125" x2="210" y2="155" stroke="#38BDF8" strokeWidth="1" />
    <line x1="195" y1="140" x2="225" y2="140" stroke="#38BDF8" strokeWidth="1" />

    <rect x="145" y="135" width="30" height="55" rx="3" fill="#14532D" />
    <circle cx="168" cy="162" r="2" fill="#A3E635" />

    {/* Smart Meter / Inverter on Wall */}
    <rect x="228" y="145" width="12" height="18" rx="2" fill="#059669" />
    <circle cx="234" cy="152" r="2.5" fill="#A3E635" />

    {/* Clean Sprout Beside Home */}
    <path d="M50 185 Q50 165 40 160 Q55 165 50 185" fill="#15803D" />
    <path d="M50 185 Q55 170 65 172 Q52 178 50 185" fill="#22C55E" />
    <line x1="50" y1="185" x2="50" y2="175" stroke="#14532D" strokeWidth="1.5" />

    {/* Ground Baseline */}
    <line x1="20" y1="190" x2="300" y2="190" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const WindFarmIllustration: React.FC<{ className?: string }> = ({ className = "w-48 h-32" }) => (
  <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="windSky" x1="160" y1="0" x2="160" y2="200" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F8FAFC" />
        <stop offset="1" stopColor="#E2E8F0" />
      </linearGradient>
    </defs>
    <rect width="320" height="200" rx="16" fill="url(#windSky)" />
    
    {/* Breeze Waves */}
    <path d="M30 40 Q80 25 140 40 T250 35" stroke="#93C5FD" strokeWidth="2" strokeLinecap="round" strokeDasharray="8 6" opacity="0.7" />
    <path d="M60 65 Q110 50 180 65 T290 60" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeDasharray="10 8" opacity="0.6" />

    {/* Rolling Green Hills (Gujarat Coastal & Kutch) */}
    <path d="M-10 160 Q80 110 180 145 T340 135 L340 200 L-10 200 Z" fill="#A7F3D0" />
    <path d="M30 170 Q140 130 250 160 T360 150 L360 200 L30 200 Z" fill="#6EE7B7" />
    <path d="M-20 185 Q80 165 200 180 T340 170 L340 200 L-20 200 Z" fill="#34D399" />

    {/* Turbine 1 (Tall / Foreground) */}
    <line x1="120" y1="95" x2="120" y2="175" stroke="#334155" strokeWidth="3.5" strokeLinecap="round" />
    <circle cx="120" cy="95" r="4.5" fill="#0F172A" />
    <line x1="120" y1="95" x2="120" y2="55" stroke="#059669" strokeWidth="3" strokeLinecap="round" />
    <line x1="120" y1="95" x2="85" y2="115" stroke="#059669" strokeWidth="3" strokeLinecap="round" />
    <line x1="120" y1="95" x2="155" y2="115" stroke="#059669" strokeWidth="3" strokeLinecap="round" />

    {/* Turbine 2 (Mid-distance) */}
    <line x1="210" y1="110" x2="210" y2="165" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="210" cy="110" r="3.5" fill="#1E293B" />
    <line x1="210" y1="110" x2="195" y2="80" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
    <line x1="210" y1="110" x2="235" y2="95" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
    <line x1="210" y1="110" x2="200" y2="135" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />

    {/* Turbine 3 (Distant) */}
    <line x1="60" y1="130" x2="60" y2="170" stroke="#64748B" strokeWidth="2" strokeLinecap="round" />
    <circle cx="60" cy="130" r="2.5" fill="#334155" />
    <line x1="60" y1="130" x2="60" y2="105" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="60" y1="130" x2="40" y2="142" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="60" y1="130" x2="80" y2="142" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const SmartGridIllustration: React.FC<{ className?: string }> = ({ className = "w-48 h-32" }) => (
  <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="gridBg" x1="0" y1="0" x2="320" y2="200" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F0FDF4" />
        <stop offset="1" stopColor="#E6F4EA" />
      </linearGradient>
    </defs>
    <rect width="320" height="200" rx="16" fill="url(#gridBg)" />

    {/* High Voltage Pylon */}
    <line x1="70" y1="50" x2="50" y2="160" stroke="#334155" strokeWidth="2.5" />
    <line x1="70" y1="50" x2="90" y2="160" stroke="#334155" strokeWidth="2.5" />
    <line x1="40" y1="80" x2="100" y2="80" stroke="#334155" strokeWidth="2" />
    <line x1="45" y1="110" x2="95" y2="110" stroke="#334155" strokeWidth="2" />
    <line x1="55" y1="80" x2="85" y2="110" stroke="#64748B" strokeWidth="1.5" />
    <line x1="85" y1="80" x2="55" y2="110" stroke="#64748B" strokeWidth="1.5" />
    <line x1="53" y1="110" x2="87" y2="140" stroke="#64748B" strokeWidth="1.5" />
    <line x1="87" y1="110" x2="53" y2="140" stroke="#64748B" strokeWidth="1.5" />

    {/* Energy Transmission Line with Glowing Pulse */}
    <path d="M100 80 Q180 120 230 110" stroke="#059669" strokeWidth="2.5" strokeDasharray="6 4" />
    <circle cx="160" cy="105" r="4" fill="#A3E635">
      <animate attributeName="cx" values="100;230" dur="2s" repeatCount="indefinite" />
      <animate attributeName="cy" values="80;110" dur="2s" repeatCount="indefinite" />
    </circle>

    {/* Receiving Substation / Smart Battery */}
    <rect x="220" y="100" width="60" height="60" rx="8" fill="#FFFFFF" stroke="#059669" strokeWidth="2" />
    <rect x="235" y="115" width="30" height="30" rx="4" fill="#DCFCE7" />
    <path d="M250 120 L245 130 L255 130 L250 140" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

    {/* Eco Leaf Badge */}
    <circle cx="270" cy="95" r="12" fill="#14532D" />
    <path d="M266 97 Q270 91 274 95 Q274 99 266 97" fill="#A3E635" />

    {/* Ground */}
    <line x1="20" y1="170" x2="300" y2="170" stroke="#CBD5E1" strokeWidth="2" />
  </svg>
);
