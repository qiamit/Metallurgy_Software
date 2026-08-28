"use client";

import {
  ArrowUpRight,
  Circle,
  Contrast,
  CornerUpLeft,
  Crop,
  Crosshair,
  Diamond,
  Eraser,
  FlipHorizontal2,
  FlipVertical2,
  Hand,
  Highlighter,
  ImageMinus,
  Minus,
  MousePointer2,
  PaintBucket,
  Pencil,
  Pipette,
  Plus,
  RectangleHorizontal,
  RotateCw,
  Sun,
  Type,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { EditTool, ImageAdjustments } from "@/lib/imageEditor";

type ToolbarPlacement = "left" | "right" | "bottom";

type ImageEditToolbarProps = {
  placement: ToolbarPlacement;
  disabled?: boolean;
  activeTool: EditTool;
  onToolChange: (tool: EditTool) => void;
  adjustments: ImageAdjustments;
  onAdjustmentsChange: (next: ImageAdjustments) => void;
  strokeColor: string;
  onStrokeColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
  onReset: () => void;
  onClearAnnotations: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

function ToolButton({
  active,
  disabled,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      className={`image-edit-tool ${active ? "image-edit-tool-active" : ""}`}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function barClass(placement: ToolbarPlacement) {
  if (placement === "left") {
    return "image-edit-bar image-edit-bar-vertical image-edit-bar-left shrink-0";
  }
  if (placement === "right") {
    return "image-edit-bar image-edit-bar-vertical image-edit-bar-right shrink-0";
  }
  return "image-edit-bar image-edit-bar-bottom shrink-0";
}

export function ImageEditToolbar({
  placement,
  disabled,
  activeTool,
  onToolChange,
  adjustments,
  onAdjustmentsChange,
  strokeColor,
  onStrokeColorChange,
  strokeWidth,
  onStrokeWidthChange,
  onReset,
  onClearAnnotations,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: ImageEditToolbarProps) {
  function patch(partial: Partial<ImageAdjustments>) {
    onAdjustmentsChange({ ...adjustments, ...partial });
  }

  if (placement === "left") {
    return (
      <aside className={barClass("left")} aria-label="Image Tools Left">
        <div className="image-edit-bar-section">
          <ToolButton
            active={activeTool === "select"}
            disabled={disabled}
            label="Select"
            onClick={() => onToolChange("select")}
          >
            <MousePointer2 size={16} />
          </ToolButton>
          <ToolButton
            active={activeTool === "hand"}
            disabled={disabled}
            label="Pan"
            onClick={() => onToolChange("hand")}
          >
            <Hand size={16} />
          </ToolButton>
          <ToolButton
            active={activeTool === "crop"}
            disabled={disabled}
            label="Crop"
            onClick={() => onToolChange("crop")}
          >
            <Crop size={16} />
          </ToolButton>
        </div>

        <div className="image-edit-bar-section">
          <ToolButton
            active={activeTool === "pencil"}
            disabled={disabled}
            label="Pencil"
            onClick={() => onToolChange("pencil")}
          >
            <Pencil size={16} />
          </ToolButton>
          <ToolButton
            active={activeTool === "highlighter"}
            disabled={disabled}
            label="Highlighter"
            onClick={() => onToolChange("highlighter")}
          >
            <Highlighter size={16} />
          </ToolButton>
          <ToolButton
            active={activeTool === "eraser"}
            disabled={disabled}
            label="Eraser"
            onClick={() => onToolChange("eraser")}
          >
            <Eraser size={16} />
          </ToolButton>
          <ToolButton
            active={activeTool === "text"}
            disabled={disabled}
            label="Text"
            onClick={() => onToolChange("text")}
          >
            <Type size={16} />
          </ToolButton>
          <ToolButton
            active={activeTool === "line"}
            disabled={disabled}
            label="Line"
            onClick={() => onToolChange("line")}
          >
            <Minus size={16} className="rotate-45" />
          </ToolButton>
          <ToolButton
            active={activeTool === "arrow"}
            disabled={disabled}
            label="Arrow"
            onClick={() => onToolChange("arrow")}
          >
            <ArrowUpRight size={16} />
          </ToolButton>
          <ToolButton
            active={activeTool === "rectangle"}
            disabled={disabled}
            label="Rectangle"
            onClick={() => onToolChange("rectangle")}
          >
            <RectangleHorizontal size={16} />
          </ToolButton>
          <ToolButton
            active={activeTool === "ellipse"}
            disabled={disabled}
            label="Ellipse"
            onClick={() => onToolChange("ellipse")}
          >
            <Circle size={16} />
          </ToolButton>
          <ToolButton
            active={activeTool === "diamond"}
            disabled={disabled}
            label="Diamond"
            onClick={() => onToolChange("diamond")}
          >
            <Diamond size={16} />
          </ToolButton>
        </div>

        <div className="image-edit-bar-section">
          <ToolButton
            active={activeTool === "fill"}
            disabled={disabled}
            label="Fill"
            onClick={() => onToolChange("fill")}
          >
            <PaintBucket size={16} />
          </ToolButton>
          <ToolButton
            active={activeTool === "marker"}
            disabled={disabled}
            label="Marker"
            onClick={() => onToolChange("marker")}
          >
            <Crosshair size={16} />
          </ToolButton>
          <ToolButton
            active={activeTool === "eyedropper"}
            disabled={disabled}
            label="Eyedropper"
            onClick={() => onToolChange("eyedropper")}
          >
            <Pipette size={16} />
          </ToolButton>
          <input
            aria-label="Stroke Color"
            className="image-edit-color"
            disabled={disabled}
            onChange={(e) => onStrokeColorChange(e.target.value)}
            title="Stroke Color"
            type="color"
            value={strokeColor}
          />
        </div>
      </aside>
    );
  }

  if (placement === "right") {
    return (
      <aside className={barClass("right")} aria-label="Image Tools Right">
        <div className="image-edit-bar-section">
          <ToolButton
            disabled={disabled}
            label="Zoom In"
            onClick={() => {
              onToolChange("zoom-in");
              patch({ zoom: Math.min(400, adjustments.zoom + 25) });
            }}
          >
            <ZoomIn size={16} />
          </ToolButton>
          <ToolButton
            disabled={disabled}
            label="Zoom Out"
            onClick={() => {
              onToolChange("zoom-out");
              patch({ zoom: Math.max(50, adjustments.zoom - 25) });
            }}
          >
            <ZoomOut size={16} />
          </ToolButton>
        </div>

        <div className="image-edit-bar-section">
          <ToolButton
            disabled={disabled}
            label="Rotate 90°"
            onClick={() =>
              patch({
                rotation: ((adjustments.rotation + 90) % 360) as ImageAdjustments["rotation"],
              })
            }
          >
            <RotateCw size={16} />
          </ToolButton>
          <ToolButton
            disabled={disabled}
            label="Flip Horizontal"
            onClick={() => patch({ flipH: !adjustments.flipH })}
          >
            <FlipHorizontal2 size={16} />
          </ToolButton>
          <ToolButton
            disabled={disabled}
            label="Flip Vertical"
            onClick={() => patch({ flipV: !adjustments.flipV })}
          >
            <FlipVertical2 size={16} />
          </ToolButton>
        </div>

        <div className="image-edit-bar-section">
          <ToolButton disabled={disabled || !canUndo} label="Undo" onClick={onUndo}>
            <CornerUpLeft size={16} />
          </ToolButton>
          <ToolButton disabled={disabled || !canRedo} label="Redo" onClick={onRedo}>
            <CornerUpLeft size={16} className="scale-x-[-1]" />
          </ToolButton>
        </div>

        <div className="image-edit-bar-section mt-auto">
          <ToolButton
            disabled={disabled}
            label="Grayscale"
            onClick={() => patch({ grayscale: !adjustments.grayscale })}
          >
            <ImageMinus size={16} />
          </ToolButton>
          <ToolButton
            disabled={disabled}
            label="Invert Colors"
            onClick={() => patch({ invert: !adjustments.invert })}
          >
            <Contrast size={16} className="rotate-90" />
          </ToolButton>
          <ToolButton disabled={disabled} label="Clear Drawings" onClick={onClearAnnotations}>
            <Eraser size={16} className="opacity-60" />
          </ToolButton>
          <ToolButton disabled={disabled} label="Reset All Edits" onClick={onReset}>
            <RotateCw size={16} className="opacity-60" />
          </ToolButton>
        </div>
      </aside>
    );
  }

  return (
    <aside className={barClass("bottom")} aria-label="Image Adjustments Bottom">
      <div className="image-edit-bar-section image-edit-bar-sliders">
        <label className="image-edit-slider-label" title="Brightness">
          <Sun size={12} />
          <span className="image-edit-slider-name">Brightness</span>
          <input
            disabled={disabled}
            max={150}
            min={50}
            onChange={(e) => patch({ brightness: Number(e.target.value) })}
            type="range"
            value={adjustments.brightness}
          />
        </label>
        <label className="image-edit-slider-label" title="Contrast">
          <Contrast size={12} />
          <span className="image-edit-slider-name">Contrast</span>
          <input
            disabled={disabled}
            max={150}
            min={50}
            onChange={(e) => patch({ contrast: Number(e.target.value) })}
            type="range"
            value={adjustments.contrast}
          />
        </label>
        <label className="image-edit-slider-label" title="Saturation">
          <Plus size={12} />
          <span className="image-edit-slider-name">Saturation</span>
          <input
            disabled={disabled}
            max={200}
            min={0}
            onChange={(e) => patch({ saturation: Number(e.target.value) })}
            type="range"
            value={adjustments.saturation}
          />
        </label>
        <label className="image-edit-slider-label" title="Black Point">
          <Circle size={12} className="fill-black stroke-[var(--ink)]" />
          <span className="image-edit-slider-name">Black</span>
          <input
            disabled={disabled}
            max={Math.min(100, adjustments.whitePoint - 1)}
            min={0}
            onChange={(e) => patch({ blackPoint: Number(e.target.value) })}
            type="range"
            value={adjustments.blackPoint}
          />
        </label>
        <label className="image-edit-slider-label" title="White Point">
          <Circle size={12} className="fill-white stroke-[var(--ink)]" />
          <span className="image-edit-slider-name">White</span>
          <input
            disabled={disabled}
            max={100}
            min={Math.max(1, adjustments.blackPoint + 1)}
            onChange={(e) => patch({ whitePoint: Number(e.target.value) })}
            type="range"
            value={adjustments.whitePoint}
          />
        </label>
        <label className="image-edit-slider-label" title="Stroke Width">
          <Pencil size={12} />
          <span className="image-edit-slider-name">Stroke</span>
          <input
            disabled={disabled}
            max={24}
            min={1}
            onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
            type="range"
            value={strokeWidth}
          />
        </label>
      </div>
    </aside>
  );
}
