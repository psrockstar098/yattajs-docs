import Image from "next/image";
import React from "react";

interface Render2Props {
  className?: string;
}

const Render_2: React.FC<Render2Props> = ({ className = "" }) => {
  return (
    <div
      className={`relative w-full aspect-[1774/887] select-none ${className}`}
      style={{
        // Forces hardware texture smoothing on WebKit & Chromium
        imageRendering: "-webkit-optimize-contrast",
      }}
    >
      <Image
        src="/logo.png"
        alt="Yatta"
        fill
        priority
        unoptimized
        className="object-contain"
      />
    </div>
  );
};

export default Render_2;
