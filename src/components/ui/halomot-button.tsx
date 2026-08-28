"use client";

import type { CSSProperties, ReactElement } from "react";

type HalomotButtonProps = {
  gradient?: string;
  inscription: string;
  onClick?: () => void;
  fillWidth?: boolean;
  fixedWidth?: string;
  href?: string;
  target?: "_blank" | "_self";
  rel?: string;
  backgroundColor?: string;
  icon?: ReactElement;
  borderWidth?: string;
  padding?: string;
  outerBorderRadius?: string;
  innerBorderRadius?: string;
  textColor?: string;
  hoverTextColor?: string;
  ariaLabel?: string;
};

type HalomotStyle = CSSProperties & {
  [key: `--halomot-${string}`]: string;
};

export function HalomotButton({
  gradient = "linear-gradient(135deg, #2563eb, #38bdf8)",
  inscription,
  onClick,
  fillWidth = false,
  fixedWidth,
  href,
  target,
  rel,
  backgroundColor = "#0f1629",
  icon,
  borderWidth = "1px",
  padding = "0.875rem 1.25rem",
  outerBorderRadius = "13px",
  innerBorderRadius = "12px",
  textColor = "#f8fafc",
  hoverTextColor = "#ffffff",
  ariaLabel,
}: HalomotButtonProps) {
  const style: HalomotStyle = {
    "--halomot-gradient": gradient,
    "--halomot-background": backgroundColor,
    "--halomot-text": textColor,
    "--halomot-hover-text": hoverTextColor,
    "--halomot-border-width": borderWidth,
    "--halomot-padding": padding,
    "--halomot-outer-radius": outerBorderRadius,
    "--halomot-inner-radius": innerBorderRadius,
    ...(fixedWidth ? { width: fixedWidth } : {}),
  };

  const className = `halomot-button${fillWidth ? " halomot-button--fill" : ""}`;
  const content = (
    <span className="halomot-button__inner">
      {icon && (
        <span className="halomot-button__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span>{inscription}</span>
      {target === "_blank" && <span className="sr-only"> (opens in a new tab)</span>}
    </span>
  );

  if (href) {
    return (
      <a
        href={href}
        target={target}
        rel={rel ?? (target === "_blank" ? "noopener noreferrer" : undefined)}
        onClick={onClick}
        aria-label={ariaLabel}
        className={className}
        style={style}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={className}
      style={style}
    >
      {content}
    </button>
  );
}
