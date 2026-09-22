// Builds and shows the floating portrait popup, and cleans it up afterward.
// This is a plain DOM element appended to the page (not a Foundry "Application"
// window) since we don't want title bars or resize handles — just an image
// that appears, sits where it's configured to, and goes away again.

import { MODULE_ID } from "./constants.js";
import { applyPositionStyle } from "./position.js";
import { getEffectiveAppearance } from "./appearance.js";

const POPUP_ID = "ccp-popup";

/**
 * Show the popup for a given actor. Which appearance settings apply —
 * this viewer's own, a GM appearance override, or a per-character
 * override just for this actor — is decided in appearance.js.
 * @param {Actor} actor
 * @param {{statusIcons?: {id: string, name: string, img: string}[], forceAura?: "healed"|"revived"}} [options]
 *   `statusIcons` — condition icons to overlay centered on the popup, only
 *   ever passed by the status-icon auto-popup trigger in main.js.
 *   `forceAura` — passed by main.js's heal/revive detection when HP just
 *   went up, to show the green ("healed") or gold ("revived") aura
 *   instead of re-deriving the aura from the actor's *current* state the
 *   way the bloodied check below does. Healed/revived are one-time
 *   events, not something recomputable from current data alone, so they
 *   have to be told explicitly rather than detected here.
 */
export function showCharacterPopup(actor, options = {}) {
  if (!actor) return;

  const appearance = getEffectiveAppearance(actor);

  const img =
    appearance.imageSource === "token"
      ? actor.prototypeToken?.texture?.src || actor.img
      : actor.img;
  if (!img) return;

  const duration = game.settings.get(MODULE_ID, "duration"); // always GM-controlled

  // If a popup is already showing (e.g. someone typing fast), replace it
  // rather than stacking multiple copies on screen.
  document.getElementById(POPUP_ID)?.remove();

  const wrapper = document.createElement("div");
  wrapper.id = POPUP_ID;
  wrapper.classList.add("ccp-position");
  applyPositionStyle(wrapper, {
    preset: appearance.positionPreset,
    x: appearance.positionX,
    y: appearance.positionY
  });

  const image = document.createElement("img");
  image.src = img;
  image.alt = actor.name ?? "";

  let imageTransform = `scale(${appearance.scale})`;
  if (appearance.flipHorizontal) imageTransform += " scaleX(-1)";
  if (appearance.flipVertical) imageTransform += " scaleY(-1)";
  image.style.transform = imageTransform;

  // Healed/revived (forced, event-based) take priority over bloodied
  // (recomputed from current state) when both could apply — e.g. someone
  // healed back up to 40% HP is still technically "bloodied" by the
  // threshold, but the aura that actually matters in that moment is the
  // green heal, not the red one.
  if (options.forceAura === "revived") wrapper.classList.add("ccp-revived");
  else if (options.forceAura === "healed") wrapper.classList.add("ccp-healed");
  else if (isBloodied(actor)) wrapper.classList.add("ccp-bloodied");

  wrapper.appendChild(image);

  const statusIcons = options.statusIcons ?? [];
  if (statusIcons.length) {
    const iconsLayer = document.createElement("div");
    iconsLayer.classList.add("ccp-status-icons");
    const iconScale = game.settings.get(MODULE_ID, "statusIconScale");
    iconsLayer.style.setProperty("--ccp-status-icon-scale", iconScale);
    for (const icon of statusIcons) {
      const iconImg = document.createElement("img");
      iconImg.src = icon.img;
      iconImg.alt = icon.name ?? "";
      iconImg.title = icon.name ?? "";
      iconsLayer.appendChild(iconImg);
    }
    wrapper.appendChild(iconsLayer);
  }

  document.body.appendChild(wrapper);

  // "Keep on screen" — skip the auto-hide timer entirely. The popup still
  // gets replaced the next time showCharacterPopup runs (see the
  // document.getElementById(POPUP_ID)?.remove() above), it just never
  // times out on its own.
  if (game.settings.get(MODULE_ID, "noTimeout")) return;

  const removePopup = () => wrapper.remove();

  if (appearance.fadeOut) {
    setTimeout(() => {
      wrapper.classList.add("ccp-fade-out");
      wrapper.addEventListener("transitionend", removePopup, { once: true });
    }, duration * 1000);
  } else {
    setTimeout(removePopup, duration * 1000);
  }
}

/**
 * Whether this actor is at or below the GM's "bloodied" HP threshold —
 * only checked at all if the GM has turned the feature on. Prefers the
 * dnd5e system's own computed `hp.pct` (0-100) when available, falling
 * back to a manual value/max calculation for safety.
 *
 * Exported so main.js can use the same check to detect the *moment* an
 * actor crosses into bloodied (see the updateActor hook there), not just
 * to decorate a popup that's already showing for some other reason.
 * @param {Actor} actor
 */
export function isBloodied(actor) {
  if (!game.settings.get(MODULE_ID, "bloodiedEnabled")) return false;

  const hp = actor.system?.attributes?.hp;
  if (!hp) return false;

  let pct = hp.pct;
  if (typeof pct !== "number") {
    if (typeof hp.value !== "number" || typeof hp.max !== "number" || hp.max <= 0) return false;
    pct = (hp.value / hp.max) * 100;
  }

  const threshold = game.settings.get(MODULE_ID, "bloodiedThreshold");
  return pct <= threshold;
}
