"use client";

type WaveVariant = "wave1" | "wave2" | "wave3";

const waves: Record<WaveVariant, string> = {
  wave1: "M0,64 C320,120 640,10 960,80 C1280,150 1440,40 1440,40 L1440,0 L0,0 Z",
  wave2: "M0,40 C180,90 360,20 540,60 C720,100 900,30 1080,70 C1260,110 1440,50 1440,50 L1440,0 L0,0 Z",
  wave3: "M0,80 C240,30 480,100 720,50 C960,0 1200,70 1440,30 L1440,0 L0,0 Z",
};

export default function WaveDivider({
  variant = "wave1",
  fillColor = "#ffffff",
  flip = false,
  className = "",
}: {
  variant?: WaveVariant;
  fillColor?: string;
  flip?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`w-full overflow-hidden leading-[0] pointer-events-none ${flip ? "rotate-180" : ""} ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="w-full h-[50px] md:h-[80px]"
      >
        <path d={waves[variant]} fill={fillColor} />
      </svg>
    </div>
  );
}
