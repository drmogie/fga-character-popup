// Shared constants and small helpers used across the module's files.
// Keeping these in their own tiny file avoids circular-import problems
// between settings.js and the settings-form classes.

export const MODULE_ID = "fga-character-popup";

// The 3x3 quick-set grid, plus "custom" for the manual X/Y sliders.
// Keys are used internally; labels are what the player sees in the dropdown.
export const POSITION_PRESETS = {
  custom: "Custom (use sliders below)",
  "top-left": "Top Left",
  "top-center": "Top Center",
  "top-right": "Top Right",
  "center-left": "Center Left",
  center: "Center",
  "center-right": "Center Right",
  "bottom-left": "Bottom Left",
  "bottom-center": "Bottom Center",
  "bottom-right": "Bottom Right"
};

/** Build the {key, label, selected} list the position <select> template needs. */
export function buildPositionPresetOptions(currentKey) {
  return Object.entries(POSITION_PRESETS).map(([key, label]) => ({
    key,
    label,
    selected: key === currentKey
  }));
}

/** Build the {key, label, selected} list the image-source <select> template needs. */
export function buildImageSourceOptions(currentKey) {
  return [
    { key: "portrait", label: "Character Portrait", selected: currentKey === "portrait" },
    { key: "token", label: "Token Image", selected: currentKey === "token" }
  ];
}

/**
 * Same as buildImageSourceOptions, but for a GM override field where
 * leaving it unset ("") means "inherit — each viewer keeps their own choice."
 */
export function buildImageSourceOverrideOptions(currentKey) {
  return [
    { key: "", label: "Inherit — each viewer's own choice", selected: !currentKey },
    { key: "portrait", label: "Character Portrait", selected: currentKey === "portrait" },
    { key: "token", label: "Token Image", selected: currentKey === "token" }
  ];
}

// Used as a preview image / popup fallback if an actor somehow has no image set.
export const FALLBACK_IMAGE = "icons/svg/mystery-man.svg";

// Default size for the optional chat-bubble overlay (see chatBubbleStyle
// setting, popup.js's buildChatBubble, and the GM Rules form).
export const DEFAULT_CHAT_BUBBLE_STYLE = { widthPx: 420, heightPx: 90 };
