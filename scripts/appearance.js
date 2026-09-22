// Decides which set of appearance settings (size/position/flip/fade/image
// source) actually applies for a given actor's popup. Configured from the
// "Configure Character Appearance" GM window, which edits three settings:
//
//   genericPlayerOverride   — the shared default for every player character
//   npcDispositionOverrides — one bucket each for Hostile / Neutral / Friendly NPCs
//   perActorSettings        — per-character overrides, player characters only
//
// For a player character, in order:
//   1. perActorSettings[actor.id].mode === "override" — a custom look just
//      for this character, wins over everything else.
//   2. perActorSettings[actor.id].mode === "player" — an explicit "always
//      use this player's own settings," bypassing the Generic Player
//      override even if it's on.
//   3. Otherwise (mode "gm", or no entry at all): follow whatever the
//      Generic Player bucket currently resolves to — either its own
//      "override" look, or (if it's set to "player") each viewer's own
//      individual settings.
//
// For an NPC: whichever of the three disposition buckets matches the
// actor's own token disposition (Foundry's own field), if that bucket has
// been turned on; otherwise the module's built-in default look.
//
// Image source (portrait vs. token) works the same way at every level: an
// override can optionally pin one, but leaving it blank always falls back
// to whichever image source THIS VIEWER has personally chosen — so a GM
// standardizing size/position for the table doesn't take anyone's own art
// preference away unless they deliberately pin one.

import { MODULE_ID } from "./constants.js";

const MODULE_DEFAULT_FIELDS = {
  scale: 1,
  positionPreset: "bottom-right",
  positionX: 80,
  positionY: 60,
  flipHorizontal: false,
  flipVertical: false,
  fadeOut: true
};

/** Which NPC disposition bucket ("hostile" | "neutral" | "friendly") an actor falls into. */
export function getDispositionKey(actor) {
  // An unlinked token's actor carries a live link back to its own
  // TokenDocument via `.token`, whose disposition can be set differently
  // from the actor's prototype default (e.g. the same "Bandit" actor used
  // for both a hostile ambusher and a since-surrendered prisoner) — prefer
  // that when it's there, same as the HP/status fix in main.js.
  const disposition = actor?.token?.disposition ?? actor?.prototypeToken?.disposition;
  if (disposition === CONST.TOKEN_DISPOSITIONS.HOSTILE) return "hostile";
  if (disposition === CONST.TOKEN_DISPOSITIONS.FRIENDLY) return "friendly";
  // Neutral, Secret, or anything unexpected all fall back to Neutral.
  return "neutral";
}

function viewerImageSource() {
  return game.settings.get(MODULE_ID, "imageSource");
}

/** An override's imageSource field is "" (inherit) unless the GM pinned one. */
function resolveImageSource(overrideImageSource) {
  return overrideImageSource || viewerImageSource();
}

function ownSettings(overriddenBy = null) {
  return {
    scale: game.settings.get(MODULE_ID, "scale"),
    positionPreset: game.settings.get(MODULE_ID, "positionPreset"),
    positionX: game.settings.get(MODULE_ID, "positionX"),
    positionY: game.settings.get(MODULE_ID, "positionY"),
    flipHorizontal: game.settings.get(MODULE_ID, "flipHorizontal"),
    flipVertical: game.settings.get(MODULE_ID, "flipVertical"),
    fadeOut: game.settings.get(MODULE_ID, "fadeOut"),
    imageSource: resolveImageSource(null),
    overriddenBy
  };
}

function moduleDefault() {
  return {
    ...MODULE_DEFAULT_FIELDS,
    imageSource: resolveImageSource(null),
    overriddenBy: null
  };
}

function fieldsFrom(entry, overriddenBy) {
  return {
    scale: entry.scale,
    positionPreset: entry.positionPreset,
    positionX: entry.positionX,
    positionY: entry.positionY,
    flipHorizontal: entry.flipHorizontal,
    flipVertical: entry.flipVertical,
    fadeOut: entry.fadeOut,
    imageSource: resolveImageSource(entry.imageSource),
    overriddenBy
  };
}

function resolveGenericPlayer() {
  const generic = game.settings.get(MODULE_ID, "genericPlayerOverride");
  if (generic?.mode === "override") return fieldsFrom(generic, "global");
  return ownSettings(null);
}

export function getEffectiveAppearance(actor) {
  const isPC = !!actor?.hasPlayerOwner;

  if (isPC) {
    const perActor = game.settings.get(MODULE_ID, "perActorSettings") ?? {};
    const entry = actor ? perActor[actor.id] : null;

    if (entry?.mode === "override") return fieldsFrom(entry, "character");
    if (entry?.mode === "player") return ownSettings(null);
    return resolveGenericPlayer(); // mode "gm", or no entry — follow the Generic Player bucket
  }

  const bucketKey = getDispositionKey(actor);
  const buckets = game.settings.get(MODULE_ID, "npcDispositionOverrides") ?? {};
  const bucket = buckets[bucketKey];
  if (bucket?.mode === "override") return fieldsFrom(bucket, `npc-${bucketKey}`);
  return moduleDefault();
}
