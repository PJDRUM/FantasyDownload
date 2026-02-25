// src/components/Rankings/SortableRow.tsx
import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export default function SortableRow({
  id,
  children,
  disabled = false,
  innerRef,
  style,
}: {
  id: string;
  children: React.ReactNode;
  disabled?: boolean;
  innerRef?: (el: HTMLDivElement | null) => void;
  style?: React.CSSProperties;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const attachProps = disabled ? {} : { ...attributes, ...listeners };

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        innerRef?.(el);
      }}
      {...attachProps}
      style={{
        ...style,
        transform: CSS.Transform.toString(transform),
        transition,
        cursor: disabled ? "default" : "grab",
        // keep the dragged item above tier overlays / neighbors
        zIndex: isDragging ? 5 : (style as any)?.zIndex,
      }}
    >
      {children}
    </div>
  );
}
