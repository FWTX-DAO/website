"use client";

import { cn } from "@lib/utils";
import { useCallback, useEffect, useRef, type CSSProperties } from "react";

import fslLogo from "@assets/partners/fsl.svg";
import fwifLogo from "@assets/partners/fwif.png";
import liquidacreLogo from "@assets/partners/liquidacre.png";
import ndfLogo from "@assets/partners/ndf.png";
import oLinksLogo from "@assets/partners/olinks.png";
import simbaLogo from "@assets/partners/simba.svg";
import tbcLogo from "@assets/partners/tbc.jpg";
import tcuLogo from "@assets/partners/tcu.svg";
import techfwLogo from "@assets/partners/techfw.avif";
import tekimaxLogo from "@assets/partners/tekimax.png";
import utsaLogo from "@assets/partners/utsa.svg";
import yLogo from "@assets/partners/y2.svg";

type ImageAsset = string | { src: string };

type Pixel = {
  x: number;
  y: number;
  color: string;
  ctx: CanvasRenderingContext2D;
  speed: number;
  size: number;
  sizeStep: number;
  minSize: number;
  maxSizeInt: number;
  maxSize: number;
  delay: number;
  counter: number;
  counterStep: number;
  isIdle: boolean;
  isReverse: boolean;
  isShimmer: boolean;
  draw: () => void;
  appear: () => void;
  disappear: () => void;
  shimmer: () => void;
};

function createPixel(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  color: string,
  baseSpeed: number,
  delay: number,
): Pixel {
  const rand = (min: number, max: number) => Math.random() * (max - min) + min;

  const p: Pixel = {
    x,
    y,
    color,
    ctx,
    speed: rand(0.1, 0.9) * baseSpeed,
    size: 0,
    sizeStep: Math.random() * 0.4,
    minSize: 0.5,
    maxSizeInt: 2,
    maxSize: rand(0.5, 2),
    delay,
    counter: 0,
    counterStep: Math.random() * 4 + (canvas.width + canvas.height) * 0.01,
    isIdle: false,
    isReverse: false,
    isShimmer: false,
    draw() {
      const offset = p.maxSizeInt * 0.5 - p.size * 0.5;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x + offset, p.y + offset, p.size, p.size);
    },
    appear() {
      p.isIdle = false;
      if (p.counter <= p.delay) {
        p.counter += p.counterStep;
        return;
      }
      if (p.size >= p.maxSize) p.isShimmer = true;
      if (p.isShimmer) p.shimmer();
      else p.size += p.sizeStep;
      p.draw();
    },
    disappear() {
      p.isShimmer = false;
      p.counter = 0;
      if (p.size <= 0) {
        p.isIdle = true;
        return;
      }
      p.size -= 0.1;
      p.draw();
    },
    shimmer() {
      if (p.size >= p.maxSize) p.isReverse = true;
      else if (p.size <= p.minSize) p.isReverse = false;
      if (p.isReverse) p.size -= p.speed;
      else p.size += p.speed;
    },
  };

  return p;
}

type PixelCanvasProps = {
  colors: string[];
  gap?: number;
  speed?: number;
};

function PixelCanvas({ colors, gap = 5, speed = 30 }: PixelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pixelsRef = useRef<Pixel[]>([]);
  const animationRef = useRef<number>(0);
  const lastFrameRef = useRef(0);
  const reducedMotionRef = useRef(false);

  const init = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = wrap.getBoundingClientRect();
    const w = Math.floor(width);
    const h = Math.floor(height);
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const effectiveSpeed = reducedMotionRef.current
      ? 0
      : Math.min(speed, 100) * 0.001;
    const pixels: Pixel[] = [];

    for (let x = 0; x < w; x += gap) {
      for (let y = 0; y < h; y += gap) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        const dx = x - w / 2;
        const dy = y - h / 2;
        const delay = reducedMotionRef.current ? 0 : Math.sqrt(dx * dx + dy * dy);
        pixels.push(createPixel(ctx, canvas, x, y, color, effectiveSpeed, delay));
      }
    }

    pixelsRef.current = pixels;
  }, [colors, gap, speed]);

  const animate = useCallback((mode: "appear" | "disappear") => {
    cancelAnimationFrame(animationRef.current);
    const frameInterval = 1000 / 60;

    const loop = () => {
      animationRef.current = requestAnimationFrame(loop);

      const now = performance.now();
      const elapsed = now - lastFrameRef.current;
      if (elapsed < frameInterval) return;
      lastFrameRef.current = now - (elapsed % frameInterval);

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const pixels = pixelsRef.current;
      for (const pixel of pixels) pixel[mode]();

      if (pixels.every((p) => p.isIdle)) {
        cancelAnimationFrame(animationRef.current);
      }
    };

    lastFrameRef.current = performance.now();
    animationRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    init();

    const resizeObserver = new ResizeObserver(() => init());
    if (wrapRef.current) resizeObserver.observe(wrapRef.current);

    const card = wrapRef.current?.parentElement;
    const handleEnter = () => animate("appear");
    const handleLeave = () => animate("disappear");
    card?.addEventListener("mouseenter", handleEnter);
    card?.addEventListener("mouseleave", handleLeave);
    card?.addEventListener("focus", handleEnter);
    card?.addEventListener("blur", handleLeave);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationRef.current);
      card?.removeEventListener("mouseenter", handleEnter);
      card?.removeEventListener("mouseleave", handleLeave);
      card?.removeEventListener("focus", handleEnter);
      card?.removeEventListener("blur", handleLeave);
    };
  }, [init, animate]);

  return (
    <div ref={wrapRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}

type PartnerLogo = {
  name: string;
  href: string;
  asset: ImageAsset;
  brand: string;
  pixelColors: string[];
  row: number;
  col: number;
  className?: string;
  lightPlate?: boolean;
  preserveColor?: boolean;
  keepLight?: boolean;
  maskClassName?: string;
};

const PARTNERS: PartnerLogo[] = [
  {
    name: "Yeetum Intelligence Platform",
    href: "https://y2.dev",
    asset: yLogo,
    brand: "#46D6FF",
    pixelColors: ["#46D6FF", "#3B82F6", "#8B5CF6"],
    row: 1,
    col: 1,
    keepLight: true,
    maskClassName: "h-16 w-36",
  },
  {
    name: "Texas Blockchain Council",
    href: "https://texasblockchaincouncil.org/",
    asset: tbcLogo,
    brand: "#F59E0B",
    pixelColors: ["#F59E0B", "#F97316", "#FCD34D"],
    row: 1,
    col: 2,
    lightPlate: true,
    preserveColor: true,
  },
  {
    name: "National DigiFoundry",
    href: "https://www.digifoundry.org/",
    asset: ndfLogo,
    brand: "#60A5FA",
    pixelColors: ["#60A5FA", "#38BDF8", "#93C5FD"],
    row: 1,
    col: 3,
    keepLight: true,
    maskClassName: "h-14 w-40",
  },
  {
    name: "Fort Worth Innovators Forum",
    href: "https://ipser.com",
    asset: fwifLogo,
    brand: "#F97316",
    pixelColors: ["#F97316", "#FB923C", "#FDBA74"],
    row: 1,
    col: 4,
    lightPlate: true,
    preserveColor: true,
  },
  {
    name: "O'Links Corporation",
    href: "https://olinkscorp.com/",
    asset: oLinksLogo,
    brand: "#22D3EE",
    pixelColors: ["#22D3EE", "#06B6D4", "#67E8F9"],
    row: 2,
    col: 1,
    className: "max-h-16",
    lightPlate: true,
    preserveColor: true,
  },
  {
    name: "Texas Christian University",
    href: "https://cse.tcu.edu/",
    asset: tcuLogo,
    brand: "#7C3AED",
    pixelColors: ["#7C3AED", "#A78BFA", "#C4B5FD"],
    row: 3,
    col: 1,
    keepLight: true,
    maskClassName: "h-14 w-28",
  },
  {
    name: "University of Texas San Antonio",
    href: "https://www.utsa.edu/",
    asset: utsaLogo,
    brand: "#F97316",
    pixelColors: ["#F97316", "#2563EB", "#FDBA74"],
    row: 2,
    col: 4,
  },
  {
    name: "Simba Chain",
    href: "https://simbachain.com/",
    asset: simbaLogo,
    brand: "#0EA5E9",
    pixelColors: ["#0EA5E9", "#38BDF8", "#0284C7"],
    row: 3,
    col: 4,
    keepLight: true,
    maskClassName: "h-10 w-36",
  },
  {
    name: "LiquidAcre",
    href: "https://liquidacre.com/",
    asset: liquidacreLogo,
    brand: "#22C55E",
    pixelColors: ["#22C55E", "#84CC16", "#86EFAC"],
    row: 4,
    col: 1,
    keepLight: true,
    maskClassName: "h-10 w-44",
  },
  {
    name: "TechFW",
    href: "https://techfw.org/",
    asset: techfwLogo,
    brand: "#3B82F6",
    pixelColors: ["#3B82F6", "#60A5FA", "#93C5FD"],
    row: 4,
    col: 2,
  },
  {
    name: "Tekimax",
    href: "https://tekimax.com",
    asset: tekimaxLogo,
    brand: "#14B8A6",
    pixelColors: ["#14B8A6", "#2DD4BF", "#5EEAD4"],
    row: 4,
    col: 3,
    keepLight: true,
    maskClassName: "h-12 w-44",
  },
  {
    name: "Fullstack",
    href: "https://www.fullstack.com/",
    asset: fslLogo,
    brand: "#F59E0B",
    pixelColors: ["#F59E0B", "#FB923C", "#FDE68A"],
    row: 4,
    col: 4,
    keepLight: true,
    maskClassName: "h-10 w-44",
  },
];

function imageSrc(asset: ImageAsset) {
  return typeof asset === "string" ? asset : asset.src;
}

function LogoCard({
  logo,
  positioned = false,
}: {
  logo: PartnerLogo;
  positioned?: boolean;
}) {
  return (
    <a
      href={logo.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={logo.name}
      className={cn(
        "group relative isolate grid min-h-[96px] place-items-center overflow-hidden bg-navy-900/80",
        "transition duration-300 hover:z-[2] focus-visible:z-[2] focus-visible:outline-none",
        "hover:bg-navy-900 focus-visible:bg-navy-900",
        "focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950",
        "hover:shadow-[0_8px_24px_-8px_color-mix(in_srgb,var(--brand)_35%,transparent),0_0_0_1px_color-mix(in_srgb,var(--brand)_55%,transparent)]",
      )}
      style={
        {
          "--brand": logo.brand,
          ...(positioned ? { gridRow: logo.row, gridColumn: logo.col } : {}),
        } as CSSProperties
      }
    >
      <PixelCanvas colors={logo.pixelColors} gap={5} speed={30} />
      <span
        className={cn(
          "relative z-[1] grid place-items-center transition-transform duration-300",
          "group-hover:scale-[1.06] group-focus-visible:scale-[1.06]",
          logo.lightPlate
            ? "max-w-[86%] rounded-md bg-white px-3 py-2.5 shadow-sm shadow-black/10"
            : "max-w-[78%]",
        )}
      >
        {logo.keepLight ? (
          <span
            aria-hidden="true"
            className={cn(
              "block max-h-16 max-w-full bg-slate-200 opacity-80 transition-opacity duration-300",
              "group-hover:bg-white group-hover:opacity-100 group-focus-visible:bg-white group-focus-visible:opacity-100",
              logo.maskClassName ?? "h-12 w-36",
            )}
            style={
              {
                WebkitMaskImage: `url(${imageSrc(logo.asset)})`,
                maskImage: `url(${imageSrc(logo.asset)})`,
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
                maskPosition: "center",
                WebkitMaskSize: "contain",
                maskSize: "contain",
              } as CSSProperties
            }
          />
        ) : (
          <img
            src={imageSrc(logo.asset)}
            alt=""
            loading="lazy"
            decoding="async"
            className={cn(
              "h-auto max-h-12 w-auto max-w-full object-contain transition-all duration-300",
              logo.preserveColor
                ? "opacity-100"
                : cn(
                    "grayscale brightness-0 invert opacity-65",
                    "group-hover:grayscale-0 group-hover:brightness-100 group-hover:invert-0 group-hover:opacity-100",
                    "group-focus-visible:grayscale-0 group-focus-visible:brightness-100 group-focus-visible:invert-0 group-focus-visible:opacity-100",
                  ),
              logo.className,
            )}
          />
        )}
      </span>
    </a>
  );
}

type PixelLogoGridProps = {
  badge?: string;
  heading?: string;
};

function CenterPanel({ badge, heading }: Required<PixelLogoGridProps>) {
  return (
    <div className="flex h-full min-h-[190px] flex-col items-center justify-center gap-4 bg-navy-900/90 p-6 text-center">
      <span className="inline-flex items-center rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-200 shadow-sm">
        {badge}
      </span>
      <h2 className="max-w-[440px] px-2 font-display text-4xl font-semibold leading-none tracking-wide text-white md:text-5xl">
        {heading}
      </h2>
    </div>
  );
}

export function PixelLogoGrid({
  badge = "Partners & Collaborators",
  heading = "Building the future of Fort Worth together",
}: PixelLogoGridProps = {}) {
  return (
    <section className="mt-24 w-full px-4">
      <div
        className="mx-auto hidden max-w-5xl grid-cols-4 gap-px border border-blue-400/15 bg-blue-400/15 shadow-[0_24px_80px_-48px_rgba(59,130,246,0.7)] md:grid"
        style={{ gridTemplateRows: "repeat(4, 112px)" }}
      >
        {PARTNERS.map((logo) => (
          <LogoCard key={logo.name} logo={logo} positioned />
        ))}

        <div className="h-full" style={{ gridColumn: "2 / span 2", gridRow: "2 / span 2" }}>
          <CenterPanel badge={badge} heading={heading} />
        </div>
      </div>

      <div className="mx-auto max-w-2xl md:hidden">
        <CenterPanel badge={badge} heading={heading} />
        <div className="grid grid-cols-2 gap-px border border-blue-400/15 bg-blue-400/15">
          {PARTNERS.map((logo) => (
            <LogoCard key={logo.name} logo={logo} />
          ))}
        </div>
      </div>
    </section>
  );
}

export const Component = PixelLogoGrid;
export default PixelLogoGrid;
