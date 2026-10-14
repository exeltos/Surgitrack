import {useId} from 'react';

/** The SurgiTrack mark: a bold «S» in a scan frame with a red scan line (the app icon). */
export default function BrandMark({className, size}: {className?: string; size?: number}) {
  const gradient = `brand-${useId().replace(/:/g, '')}`;
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a8fa3" />
          <stop offset="1" stopColor="#0f3445" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill={`url(#${gradient})`} />
      <path
        d="M130 186v-38a18 18 0 0 1 18-18h38M326 130h38a18 18 0 0 1 18 18v38M382 326v38a18 18 0 0 1-18 18h-38M186 382h-38a18 18 0 0 1-18-18v-38"
        fill="none"
        stroke="#9be3ef"
        strokeWidth="22"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        transform="translate(173.48 338) scale(0.12207 -0.12207)"
        fill="#fff"
        d="M691 -20C1060 -20 1280 149 1280 432C1280 670 1113 814 825 877L696 907C563 937 476 981 476 1073C476 1156 549 1217 690 1217C832 1217 911 1154 921 1046H1260C1256 1322 1036 1510 691 1510C353 1510 111 1325 111 1049C111 825 267 696 524 637L682 600C845 563 923 518 923 433C923 338 833 273 687 273C526 273 419 347 411 492H72C78 148 318 -20 691 -20Z"
      />
      <rect x="150" y="250" width="212" height="10" rx="5" fill="#ff5a4e" />
    </svg>
  );
}
