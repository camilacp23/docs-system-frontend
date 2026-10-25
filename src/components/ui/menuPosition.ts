// menuPosition: where a floating menu goes, for ActionMenu. menuPosition(button, menu, viewport) -> { top, left }
// (fixed coordinates). Below the button and aligned to its right edge; above it when it does not fit below; never
// outside the window sideways.
/** Space kept between the menu and the edges of the window, and between the menu and its button. */
const EDGE_GAP = 8;
const BUTTON_GAP = 4;

/** Where the menu goes: below the button, or above it when it does not fit below; inside the window sideways. */
export function menuPosition(
  button: { top: number; bottom: number; right: number },
  menu: { width: number; height: number },
  viewport: { width: number; height: number },
): { top: number; left: number } {
  const below = button.bottom + BUTTON_GAP;
  const fitsBelow = below + menu.height <= viewport.height - EDGE_GAP;
  const top = fitsBelow ? below : Math.max(EDGE_GAP, button.top - BUTTON_GAP - menu.height);
  const left = Math.min(
    Math.max(EDGE_GAP, button.right - menu.width),
    Math.max(EDGE_GAP, viewport.width - menu.width - EDGE_GAP),
  );
  return { top, left };
}
