"use client";

import * as React from "react";
import { NodeViewWrapper, ReactNodeViewRenderer, NodeViewProps } from "@tiptap/react";
import { Node, mergeAttributes } from "@tiptap/core";
import { AlignLeft, AlignCenter, AlignRight, Trash2 } from "lucide-react";

export function ResizableImageComponent({ node, updateAttributes, selected, deleteNode }: NodeViewProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragWidth, setDragWidth] = React.useState<number | null>(null);

  const src = node.attrs.src;
  const alt = node.attrs.alt || "";
  const align = node.attrs.align || "center";
  const rawWidth = node.attrs.width || "100%";

  const handleMouseDown = (e: React.MouseEvent, direction: "left" | "right") => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const targetElement = containerRef.current?.querySelector("img");
    const startWidth = targetElement ? targetElement.getBoundingClientRect().width : 300;

    setIsDragging(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const factor = direction === "right" ? 1 : -1;
      const newWidth = Math.max(120, Math.min(startWidth + deltaX * factor, 1200));
      setDragWidth(newWidth);
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);

      const deltaX = upEvent.clientX - startX;
      const factor = direction === "right" ? 1 : -1;
      const finalWidth = Math.round(Math.max(120, Math.min(startWidth + deltaX * factor, 1200)));

      setIsDragging(false);
      setDragWidth(null);
      updateAttributes({ width: `${finalWidth}px` });
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const currentDisplayWidth = dragWidth !== null ? `${dragWidth}px` : rawWidth;

  const getAlignClass = () => {
    if (align === "left") return "mr-auto ml-0";
    if (align === "right") return "ml-auto mr-0";
    return "mx-auto";
  };

  const showControls = selected || isHovered || isDragging;

  return (
    <NodeViewWrapper
      ref={containerRef}
      className={`my-3 select-none flex flex-col ${getAlignClass()} transition-all`}
      style={{ width: currentDisplayWidth, maxWidth: "100%" }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative group w-full">
        {showControls && (
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 px-2 py-1 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md rounded-lg shadow-lg border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => updateAttributes({ width: "25%" })}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${rawWidth === "25%" ? "bg-blue-600 text-white" : "hover:bg-slate-100 dark:hover:bg-white/10"}`}
            >
              25%
            </button>
            <button
              type="button"
              onClick={() => updateAttributes({ width: "50%" })}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${rawWidth === "50%" ? "bg-blue-600 text-white" : "hover:bg-slate-100 dark:hover:bg-white/10"}`}
            >
              50%
            </button>
            <button
              type="button"
              onClick={() => updateAttributes({ width: "75%" })}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${rawWidth === "75%" ? "bg-blue-600 text-white" : "hover:bg-slate-100 dark:hover:bg-white/10"}`}
            >
              75%
            </button>
            <button
              type="button"
              onClick={() => updateAttributes({ width: "100%" })}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${rawWidth === "100%" ? "bg-blue-600 text-white" : "hover:bg-slate-100 dark:hover:bg-white/10"}`}
            >
              100%
            </button>
            <div className="w-[1px] h-3 bg-slate-200 dark:bg-white/10 mx-0.5" />
            <button
              type="button"
              onClick={() => updateAttributes({ align: "left" })}
              className={`p-1 rounded transition-colors ${align === "left" ? "bg-blue-600 text-white" : "hover:bg-slate-100 dark:hover:bg-white/10"}`}
              title="Align Left"
            >
              <AlignLeft className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => updateAttributes({ align: "center" })}
              className={`p-1 rounded transition-colors ${align === "center" ? "bg-blue-600 text-white" : "hover:bg-slate-100 dark:hover:bg-white/10"}`}
              title="Align Center"
            >
              <AlignCenter className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => updateAttributes({ align: "right" })}
              className={`p-1 rounded transition-colors ${align === "right" ? "bg-blue-600 text-white" : "hover:bg-slate-100 dark:hover:bg-white/10"}`}
              title="Align Right"
            >
              <AlignRight className="w-3 h-3" />
            </button>
            <div className="w-[1px] h-3 bg-slate-200 dark:bg-white/10 mx-0.5" />
            <button
              type="button"
              onClick={() => deleteNode()}
              className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              title="Delete Image"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}

        <div
          className={`relative rounded-xl overflow-visible transition-all duration-150 ${
            showControls
              ? "ring-2 ring-[#0D99FF] ring-offset-2 ring-offset-transparent shadow-lg"
              : "border border-transparent"
          }`}
        >
          <img
            src={src}
            alt={alt}
            draggable={false}
            className="w-full h-auto object-contain rounded-xl block pointer-events-auto"
            style={{ maxHeight: "75vh" }}
          />

          {showControls && (
            <>
              <div
                onMouseDown={(e) => handleMouseDown(e, "left")}
                className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-[#0D99FF] rounded-[3px] shadow-sm z-20 cursor-nwse-resize hover:scale-125 transition-transform"
              />
              <div
                onMouseDown={(e) => handleMouseDown(e, "right")}
                className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-[#0D99FF] rounded-[3px] shadow-sm z-20 cursor-nesw-resize hover:scale-125 transition-transform"
              />
              <div
                onMouseDown={(e) => handleMouseDown(e, "left")}
                className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-[#0D99FF] rounded-[3px] shadow-sm z-20 cursor-nesw-resize hover:scale-125 transition-transform"
              />
              <div
                onMouseDown={(e) => handleMouseDown(e, "right")}
                className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-[#0D99FF] rounded-[3px] shadow-sm z-20 cursor-nwse-resize hover:scale-125 transition-transform"
              />
            </>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

export const ResizableImageExtension = Node.create({
  name: "image",
  group: "block",
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
      width: {
        default: "100%",
        parseHTML: (element) => element.getAttribute("data-width") || element.style.width || "100%",
        renderHTML: (attributes) => ({
          "data-width": attributes.width,
        }),
      },
      align: {
        default: "center",
        parseHTML: (element) => element.getAttribute("data-align") || "center",
        renderHTML: (attributes) => ({
          "data-align": attributes.align,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "img[src]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const width = HTMLAttributes["data-width"] || "100%";
    const align = HTMLAttributes["data-align"] || "center";
    const margin = align === "left" ? "0 auto 0 0" : align === "right" ? "0 0 0 auto" : "0 auto";
    const style = `width: ${width}; max-width: 100%; height: auto; display: block; margin: ${margin};`;

    return ["img", mergeAttributes(HTMLAttributes, { style, class: "editor-image rounded-xl" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent);
  },

  addCommands() {
    return {
      setImage:
        (options: { src: string; alt?: string; title?: string; width?: string; align?: string }) =>
        ({ commands }: any) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    } as any;
  },
});
