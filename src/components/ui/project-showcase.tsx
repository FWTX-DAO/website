"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HalomotButton } from "./halomot-button";
import { cn } from "@lib/utils";

export type ProjectShowcaseItem = {
  quote: string;
  name: string;
  designation: string;
  src: string;
  link?: string;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageCredit?: string;
  imageCreditLink?: string;
  kicker?: string;
  ctaLabel?: string;
  imageObjectPosition?: "center" | "top";
};

type ProjectShowcaseProps = {
  testimonials: ProjectShowcaseItem[];
  autoplay?: boolean;
  colors?: { name?: string; position?: string; testimony?: string };
  fontSizes?: { name?: string; position?: string; testimony?: string };
  spacing?: {
    top?: string;
    bottom?: string;
    lineHeight?: string;
    nameTop?: string;
    nameBottom?: string;
    positionTop?: string;
    positionBottom?: string;
    testimonyTop?: string;
    testimonyBottom?: string;
  };
  imageAspectRatio?: number;
  isRTL?: boolean;
  onItemClick?: (link: string) => void;
  outerRounding?: string;
  innerRounding?: string;
  outlineColor?: string;
  hoverOutlineColor?: string;
  buttonInscriptions?: Partial<{
    previousButton: string;
    nextButton: string;
    openWebAppButton: string;
  }>;
  halomotButtonGradient?: string;
  halomotButtonBackground?: string;
  halomotButtonTextColor?: string;
  halomotButtonOuterBorderRadius?: string;
  halomotButtonInnerBorderRadius?: string;
  halomotButtonHoverTextColor?: string;
};

const defaultInscriptions = {
  previousButton: "Previous project",
  nextButton: "Next project",
  openWebAppButton: "Open Web App",
};

function Chevron({ direction }: { direction: "prev" | "next" }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d={direction === "prev" ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"}
      />
    </svg>
  );
}

export function ProjectShowcase({
  testimonials,
  autoplay = false,
  isRTL = false,
  onItemClick,
  buttonInscriptions = {},
  halomotButtonGradient = "var(--project-showcase-button-gradient)",
  halomotButtonBackground = "var(--project-showcase-button-background)",
  halomotButtonTextColor = "var(--project-showcase-button-text-color)",
  halomotButtonOuterBorderRadius = "var(--project-showcase-button-outer-radius)",
  halomotButtonInnerBorderRadius = "var(--project-showcase-button-inner-radius)",
  halomotButtonHoverTextColor = "var(--project-showcase-button-hover-text-color)",
}: ProjectShowcaseProps) {
  const [active, setActive] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const itemCount = testimonials.length;
  const hasMultipleItems = itemCount > 1;
  const fitsTwoUp = itemCount === 2;
  const currentInscriptions = { ...defaultInscriptions, ...buttonInscriptions };

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const scrollToIndex = useCallback(
    (index: number) => {
      const track = trackRef.current;
      const card = cardRefs.current[index];
      if (!track || !card) return;
      const nextLeft = track.scrollLeft + (card.getBoundingClientRect().left - track.getBoundingClientRect().left);
      track.scrollTo({
        left: nextLeft,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    },
    [prefersReducedMotion],
  );

  const handleNext = useCallback(() => {
    const next = (active + 1) % Math.max(itemCount, 1);
    setActive(next);
    scrollToIndex(next);
  }, [active, itemCount, scrollToIndex]);

  const handlePrevious = useCallback(() => {
    const next = (active - 1 + Math.max(itemCount, 1)) % Math.max(itemCount, 1);
    setActive(next);
    scrollToIndex(next);
  }, [active, itemCount, scrollToIndex]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || itemCount === 0) return;

    const cards = cardRefs.current.filter((card): card is HTMLElement => Boolean(card));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = cards.indexOf(visible.target as HTMLElement);
        if (index >= 0) setActive(index);
      },
      { root: track, threshold: 0.55 },
    );

    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [itemCount]);

  useEffect(() => {
    if (!autoplay || !hasMultipleItems || isPaused || prefersReducedMotion || itemCount === 0) {
      return;
    }

    const interval = window.setInterval(handleNext, 5000);
    return () => window.clearInterval(interval);
  }, [autoplay, handleNext, hasMultipleItems, isPaused, itemCount, prefersReducedMotion]);

  if (itemCount === 0) return null;

  return (
    <div
      className="project-showcase relative mx-auto w-full overflow-hidden rounded-[2rem] bg-navy-950 p-4"
      dir={isRTL ? "rtl" : "ltr"}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsPaused(false);
        }
      }}
    >
      <div
        className="relative"
        role="region"
        aria-roledescription="carousel"
        aria-label="Civic Innovation Lab projects"
      >
        <div
          ref={trackRef}
          className={cn(
            "project-showcase-track flex gap-4",
            fitsTwoUp && "project-showcase-track--fit",
            !fitsTwoUp && "lg:gap-5",
          )}
        >
          {testimonials.map((item, index) => (
            <article
              key={item.name}
              ref={(node) => {
                cardRefs.current[index] = node;
              }}
              data-project-card
              aria-label={`${item.name}, ${index + 1} of ${itemCount}`}
              aria-current={active === index ? "true" : undefined}
              className={cn(
                "project-showcase-card flex h-full min-w-[85%] snap-start snap-always flex-col overflow-hidden rounded-2xl bg-navy-900/55",
                fitsTwoUp ? "lg:min-w-0" : "lg:min-w-[calc(50%-0.625rem)]",
              )}
            >
              <figure className="project-showcase-image-container relative aspect-[16/10] w-full overflow-hidden">
                <img
                  src={item.src}
                  alt={item.imageAlt ?? `${item.name} project preview`}
                  width={item.imageWidth ?? 1600}
                  height={item.imageHeight ?? 1000}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className={cn(
                    "project-showcase-image h-full w-full object-cover",
                    item.imageObjectPosition === "top" ? "object-top" : "object-center",
                  )}
                />
                {item.imageCredit && item.imageCreditLink && (
                  <figcaption className="absolute bottom-3 right-3 text-[0.65rem] text-slate-300">
                    <a
                      href={item.imageCreditLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block min-h-[24px] rounded-md bg-navy-950/75 px-2.5 py-1.5 underline decoration-slate-500 underline-offset-2 backdrop-blur-md transition-colors duration-150 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                    >
                      {item.imageCredit}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </figcaption>
                )}
              </figure>

              <div className="flex flex-1 flex-col px-5 py-5 sm:px-6 sm:py-6">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">
                    <span className="project-showcase-status-dot h-1.5 w-1.5 rounded-full" aria-hidden="true" />
                    Live lab project
                  </span>
                  {item.kicker && (
                    <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-300">
                      {item.kicker}
                    </span>
                  )}
                </div>

                <h3
                  className="font-display font-semibold leading-none tracking-wide text-balance"
                  style={{
                    color: "var(--project-showcase-name-color)",
                    fontSize: "var(--project-showcase-name-size)",
                    marginBottom: "var(--project-showcase-name-bottom)",
                  }}
                  translate="no"
                >
                  {item.name}
                </h3>
                <p
                  className="font-semibold"
                  style={{
                    color: "var(--project-showcase-position-color)",
                    fontSize: "var(--project-showcase-position-size)",
                  }}
                >
                  {item.designation}
                </p>
                <p
                  className="mt-4 max-w-[39rem] text-pretty leading-relaxed"
                  style={{
                    color: "var(--project-showcase-testimony-color)",
                    fontSize: "var(--project-showcase-testimony-size)",
                    lineHeight: "var(--project-showcase-line-height)",
                  }}
                >
                  {item.quote}
                </p>

                {item.link && (
                  <div className="mt-auto pt-6">
                    <HalomotButton
                      inscription={item.ctaLabel ?? currentInscriptions.openWebAppButton}
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => onItemClick?.(item.link ?? "")}
                      fillWidth
                      gradient={halomotButtonGradient}
                      backgroundColor={halomotButtonBackground}
                      textColor={halomotButtonTextColor}
                      hoverTextColor={halomotButtonHoverTextColor}
                      outerBorderRadius={halomotButtonOuterBorderRadius}
                      innerBorderRadius={halomotButtonInnerBorderRadius}
                    />
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>

        {hasMultipleItems && (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 top-0 z-10 flex aspect-[16/10] w-[85%] items-center justify-between px-2",
              fitsTwoUp && "lg:hidden",
            )}
          >
            <button
              type="button"
              className="project-showcase-control pointer-events-auto"
              aria-label={currentInscriptions.previousButton}
              onClick={handlePrevious}
            >
              <Chevron direction="prev" />
            </button>
            <button
              type="button"
              className="project-showcase-control pointer-events-auto"
              aria-label={currentInscriptions.nextButton}
              onClick={handleNext}
            >
              <Chevron direction="next" />
            </button>
            <div
              className="pointer-events-auto absolute inset-x-0 bottom-3 mx-auto flex w-max items-center justify-center gap-2 rounded-full bg-navy-950/55 px-2.5 py-1.5 backdrop-blur-md"
              role="group"
              aria-label="Choose a project"
            >
              {testimonials.map((item, index) => (
                <button
                  key={item.name}
                  type="button"
                  aria-label={`Show ${item.name}`}
                  aria-current={active === index ? "true" : undefined}
                  className={cn(
                    "project-showcase-dot",
                    active === index && "project-showcase-dot--active",
                  )}
                  onClick={() => {
                    setActive(index);
                    scrollToIndex(index);
                  }}
                />
              ))}
            </div>
            <span className="sr-only" aria-live="polite">
              {`${testimonials[active]?.name ?? ""}, ${active + 1} of ${itemCount}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectShowcase;
