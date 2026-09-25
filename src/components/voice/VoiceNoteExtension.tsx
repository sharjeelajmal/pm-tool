"use client";

import * as React from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import { VoiceNotePlayer } from "./VoiceNotePlayer";

export function VoiceNoteNodeView({ node, deleteNode }: NodeViewProps) {
  const src = node.attrs.src;

  return (
    <NodeViewWrapper className="my-4 flex items-center justify-center select-none">
      <VoiceNotePlayer src={src} onDelete={deleteNode} />
    </NodeViewWrapper>
  );
}

export const VoiceNoteExtension = Node.create({
  name: "audio",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "audio[src]",
      },
      {
        tag: "div.audio-wrapper audio[src]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      { class: "audio-wrapper my-4 flex items-center justify-center" },
      ["audio", mergeAttributes(HTMLAttributes, { controls: true, class: "w-full max-w-md" })],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VoiceNoteNodeView);
  },
});
