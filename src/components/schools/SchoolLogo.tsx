"use client";

import type { School } from "@/lib/types";
import { schoolLogoUrl } from "@/lib/utils";
import { useState } from "react";

const MONOGRAM_TINTS = ["#175E54", "#3E5C8A", "#A33B34", "#7A4A8A", "#B06A2E", "#2F6B3A"];

export function SchoolLogo({ school, size = 44 }: { school: School; size?: number }) {
  const [failed, setFailed] = useState(false);
  const url = schoolLogoUrl(school.domain);
  const tint = MONOGRAM_TINTS[(school.name.charCodeAt(0) + school.name.length) % MONOGRAM_TINTS.length];

  if (!url || failed) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-xl font-display font-semibold text-white"
        style={{ width: size, height: size, backgroundColor: tint, fontSize: size * 0.4 }}
        aria-hidden
      >
        {school.name.slice(0, 1)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-xl bg-white object-contain p-1 ring-1 ring-paper-line"
      onError={() => setFailed(true)}
    />
  );
}
