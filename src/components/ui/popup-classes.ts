// Shared across popover.tsx and dropdown-menu.tsx, which each render a
// base-ui Positioner + Popup pair with identical open/close transitions.

export const popupPositionerClassName = "isolate z-50 outline-none";

export const popupTransitionClassName =
  "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95";
