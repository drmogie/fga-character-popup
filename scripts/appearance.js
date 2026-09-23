// Decides which set of appearance settings (size/position/flip/fade/image
// source) actually applies for a given actor's popup. Configured from the
// "Configure Character Appearance" GM window, which edits three settings:
//
//   genericPlayerOverride   — the shared default every player character uses
//   npcDispositionOverrides — one bucket each for Hostile / Neutral / Friendly NPCs
//   perActorSettings        — per-character overrides, player characters only
//
// Placement/size/flip/fade timing are ALL GM-only — there's no such thing
// as "each viewer's own settings" for those anymore, so resolution is a
// simple two-step lookup:
//
// For a player character:
//   1. perActorSettings[actor.id].mode === "override" — a custom look just
//      for this one character, for the occasional case that needs it.
//   2. Otherwise: the shared default from genericPlayerOverride.
//
// For an NPC: whichever of the three disposition buckets matches the
// actor's own token disposition (Foundry's own field), if that bucket has
// been turned on; otherwise the module's built-in fallback look.
//
// Image source (portrait vs. token) is the one exception — it's still the
// viewer's own choice (see player-settings-form.js). An override can
// optionally pin one anyway, but leaving it blank always falls back to
// whichever image source THIS VIEWER has personally chosen.

import { MODULE_ID } from "./constants.js";

// Fallback look for an NPC with no matching disposition-bucket override —
// the module's own built-in default, never GM-edited directly. Player
// characters never fall through to this; they always resolve through
// genericPlayerOverride instead (see resolveGenericPlayer below).
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

/** The one appearance field still owned by the viewer, not the GM. */
export function viewerImageSource() {
  return game.settings.get(MODULE_ID, "imageSource");
}

/** An override's imageSource field is "" (inherit) unless the GM pinned one. */
function resolveImageSource(overrideImageSource) {
  return overrideImageSource || viewerImageSource();
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

/**
 * The shared default every player character uses. genericPlayerOverride
 * used to carry an optional "mode" ("player" vs "override") from back when
 * players had their own settings to fall back to — that field may still be
 * sitting in old saved data, but it's never read anymore: these fields
 * always apply now, unconditionally, unless a specific character has its
 * own perActorSettings override (see getEffectiveAppearance).
 */
function resolveGenericPlayer() {
  const generic = game.settings.get(MODULE_ID, "genericPlayerOverride") ?? {};
  return fieldsFrom({ ...MODULE_DEFAULT_FIELDS, imageSource: "", ...generic }, "shared-default");
}

export function getEffectiveAppearance(actor) {
  const isPC = !!actor?.hasPlayerOwner;

  if (isPC) {
    const perActor = game.settings.get(MODULE_ID, "perActorSettings") ?? {};
    const entry = actor ? perActor[actor.id] : null;

    if (entry?.mode === "override") return fieldsFrom(entry, "character");
    return resolveGenericPlayer(); // no entry, or an old "gm"/"player" mode value — both mean "use the shared default"
  }

  const bucketKey = getDispositionKey(actor);
  const buckets = game.settings.get(MODULE_ID, "npcDispositionOverrides") ?? {};
  const bucket = buckets[bucketKey];
  if (bucket?.mode === "override") return fieldsFrom(bucket, `npc-${bucketKey}`);
  return moduleDefault();
}
