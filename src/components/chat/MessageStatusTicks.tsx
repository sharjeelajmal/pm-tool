"use client";

import * as React from "react";

interface MessageStatusTicksProps {
  readBy?: string[];
  deliveredTo?: string[];
  currentUsername?: string;
  className?: string;
}

export function MessageStatusTicks({
  readBy = [],
  deliveredTo = [],
  currentUsername,
  className = "",
}: MessageStatusTicksProps) {
  const normCurrent = (currentUsername || "").toLowerCase().trim();
  const isRead = readBy.some((u) => u && u.toLowerCase().trim() !== normCurrent);
  const isDelivered = deliveredTo.some((u) => u && u.toLowerCase().trim() !== normCurrent);

  if (isRead) {
    return (
      <span
        className={`inline-flex items-center text-sky-400 dark:text-sky-400 ${className}`}
        title="Read"
      >
        <svg
          width="15"
          height="11"
          viewBox="0 0 16 11"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1 6.5l3.5 3.5L11 2" />
          <path d="M5 6.5l3.5 3.5L15 2" />
        </svg>
      </span>
    );
  }

  if (isDelivered) {
    return (
      <span
        className={`inline-flex items-center text-slate-300 dark:text-slate-400 ${className}`}
        title="Delivered"
      >
        <svg
          width="15"
          height="11"
          viewBox="0 0 16 11"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1 6.5l3.5 3.5L11 2" />
          <path d="M5 6.5l3.5 3.5L15 2" />
        </svg>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center text-slate-300 dark:text-slate-400 ${className}`}
      title="Sent"
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 12 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1 6.5l3.5 3.5L11 2" />
      </svg>
    </span>
  );
}
