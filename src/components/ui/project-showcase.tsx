"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { HalomotButton } from "./halomot-button";

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

const defaultColors = {
  name: "var(--project-showcase-name-color)",
  position: "var(--project-showcase-position-color)",
  testimony: "var(--project-showcase-testimony-color)",
};

const defaultFontSizes = {
  name: "var(--project-showcase-name-size)",
  position: "var(--project-showcase-position-size)",
  testimony: "var(--project-showcase-testimony-size)",
};

const defaultSpacing = {
  lineHeight: "var(--project-showcase-line-height)",
  nameTop: "0",
  nameBottom: "var(--project-showcase-name-bottom)",
  positionTop: "0",
  positionBottom: "var(--project-showcase-position-bottom)",
  testimonyTop: "var(--project-showcase-testimony-top)",
  testimonyBottom: "var(--project-showcase-testimony-bottom)",
};

const defaultInscriptions = {
  previousButton: "Previous",
  nextButton: "Next",
  openWebAppButton: "Open Web App",
};

function resolveSpacing(value: string) {
  return /^\d+(\.\d+)?$/.test(value) ? `${Number(value) * 0.25}rem` : value;
}

export function ProjectShowcase({
  testimonials,
  autoplay = false,
  colors = {},
  fontSizes = {},
  spacing = {},
  imageAspectRatio = 1.6,
  isRTL = false,
  onItemClick,
  outerRounding = "18px",
  innerRounding = "17px",
  outlineColor = "rgba(255, 255, 255, 0.1)",
  hoverOutlineColor = "rgba(96, 165, 250, 0.6)",
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
  const prefersReducedMotion = useReducedMotion();
  const itemCount = testimonials.length;
  const hasMultipleItems = itemCount > 1;
  const currentColors = { ...defaultColors, ...colors };
  const currentFontSizes = { ...defaultFontSizes, ...fontSizes };
  const currentSpacing = { ...defaultSpacing, ...spacing };
  const currentInscriptions = { ...defaultInscriptions, ...buttonInscriptions };

  const handleNext = useCallback(() => {
    setActive((current) => (current + 1) % Math.max(itemCount, 1));
  }, [itemCount]);

  const handlePrevious = useCallback(() => {
    setActive(
      (current) =>
        (current - 1 + Math.max(itemCount, 1)) % Math.max(itemCount, 1),
    );
  }, [itemCount]);

  useEffect(() => {
    if (active >= itemCount) setActive(0);
  }, [active, itemCount]);

  useEffect(() => {
    if (
      !autoplay ||
      !hasMultipleItems ||
      isPaused ||
      prefersReducedMotion ||
      itemCount === 0
    ) {
      return;
    }

    const interval = window.setInterval(handleNext, 5000);
    return () => window.clearInterval(interval);
  }, [autoplay, handleNext, hasMultipleItems, isPaused, itemCount, prefersReducedMotion]);

  if (itemCount === 0) return null;

  const item = testimonials[active] ?? testimonials[0];
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.2, 0, 0, 1] as const };
  const contentStyle: CSSProperties = {
    lineHeight: currentSpacing.lineHeight,
  };

  return (
    <div
      className="project-showcase relative mx-auto w-full overflow-hidden rounded-[2rem] bg-navy-950 p-4 sm:p-6 lg:p-8"
      dir={isRTL ? "rtl" : "ltr"}
      style={{
        paddingTop: spacing.top ? resolveSpacing(spacing.top) : undefined,
        paddingBottom: spacing.bottom ? resolveSpacing(spacing.bottom) : undefined,
      }}
    >
      <div className="relative grid items-stretch gap-8 lg:grid-cols-[minmax(0,1.12fr)_minmax(18rem,0.88fr)] lg:gap-12">
        <div className="relative min-w-0" style={{ aspectRatio: imageAspectRatio }}>
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={item.src}
              className="absolute inset-0"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={transition}
            >
              <ImageContainer
                item={item}
                outerRounding={outerRounding}
                innerRounding={innerRounding}
                outlineColor={outlineColor}
                hoverOutlineColor={hoverOutlineColor}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex min-w-0 flex-col justify-center py-1 sm:py-3" style={contentStyle}>
          <div className="mb-6 flex flex-wrap items-center gap-3">
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

          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={`${item.name}-${active}`}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={transition}
              aria-live={hasMultipleItems ? "polite" : undefined}
            >
              <h3
                className="font-display font-semibold leading-none tracking-wide"
                style={{
                  color: currentColors.name,
                  fontSize: currentFontSizes.name,
                  marginTop: currentSpacing.nameTop,
                  marginBottom: currentSpacing.nameBottom,
                }}
                translate="no"
              >
                {item.name}
              </h3>
              <p
                className="font-semibold"
                style={{
                  color: currentColors.position,
                  fontSize: currentFontSizes.position,
                  marginTop: currentSpacing.positionTop,
                  marginBottom: currentSpacing.positionBottom,
                }}
              >
                {item.designation}
              </p>
              <p
                className="max-w-[39rem] leading-relaxed"
                style={{
                  color: currentColors.testimony,
                  fontSize: currentFontSizes.testimony,
                  marginTop: currentSpacing.testimonyTop,
                  marginBottom: currentSpacing.testimonyBottom,
                }}
              >
                {item.quote}
              </p>
            </motion.div>
          </AnimatePresence>

          {hasMultipleItems && (
            <div className="mb-5 flex flex-wrap items-center gap-3" role="group" aria-label="Project showcase controls">
              <HalomotButton
                inscription={currentInscriptions.previousButton}
                onClick={handlePrevious}
                gradient={halomotButtonGradient}
                backgroundColor={halomotButtonBackground}
                textColor={halomotButtonTextColor}
                hoverTextColor={halomotButtonHoverTextColor}
                outerBorderRadius={halomotButtonOuterBorderRadius}
                innerBorderRadius={halomotButtonInnerBorderRadius}
                padding="0.7rem 1rem"
              />
              <HalomotButton
                inscription={currentInscriptions.nextButton}
                onClick={handleNext}
                gradient={halomotButtonGradient}
                backgroundColor={halomotButtonBackground}
                textColor={halomotButtonTextColor}
                hoverTextColor={halomotButtonHoverTextColor}
                outerBorderRadius={halomotButtonOuterBorderRadius}
                innerBorderRadius={halomotButtonInnerBorderRadius}
                padding="0.7rem 1rem"
              />
              {autoplay && (
                <button
                  type="button"
                  className="min-h-[44px] rounded-lg px-3 text-sm font-semibold text-slate-300 underline decoration-slate-500 underline-offset-4 transition-colors duration-150 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                  onClick={() => setIsPaused((current) => !current)}
                >
                  {isPaused ? "Resume rotation" : "Pause rotation"}
                </button>
              )}
              <span className="ms-auto text-sm tabular-nums text-slate-500" aria-hidden="true">
                {String(active + 1).padStart(2, "0")} / {String(itemCount).padStart(2, "0")}
              </span>
            </div>
          )}

          {item.link && (
            <div className="mt-auto pt-2">
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
      </div>
    </div>
  );
}

type ImageContainerProps = {
  item: ProjectShowcaseItem;
  outerRounding: string;
  innerRounding: string;
  outlineColor: string;
  hoverOutlineColor: string;
};

type ImageContainerStyle = CSSProperties & {
  "--project-outline": string;
  "--project-outline-hover": string;
};

function ImageContainer({
  item,
  outerRounding,
  innerRounding,
  outlineColor,
  hoverOutlineColor,
}: ImageContainerProps) {
  const style: ImageContainerStyle = {
    borderRadius: outerRounding,
    "--project-outline": outlineColor,
    "--project-outline-hover": hoverOutlineColor,
  };

  return (
    <figure className="project-showcase-image-container relative h-full w-full p-px" style={style}>
      <div className="relative h-full w-full overflow-hidden" style={{ borderRadius: innerRounding }}>
        <img
          src={item.src}
          alt={item.imageAlt ?? `${item.name} project preview`}
          width={item.imageWidth ?? 1600}
          height={item.imageHeight ?? 1000}
          loading="lazy"
          decoding="async"
          draggable={false}
          className={`project-showcase-image h-full w-full object-cover ${
            item.imageObjectPosition === "top" ? "object-top" : "object-center"
          }`}
        />
      </div>
      {item.imageCredit && item.imageCreditLink && (
        <figcaption className="absolute bottom-3 right-3 text-[0.65rem] text-slate-300 sm:bottom-4 sm:right-4">
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
  );
}

export default ProjectShowcase;
