// Registers every setting this module uses, plus the three settings-menu
// buttons (one for players, two GM-only) that open the nice GUI forms
// instead of Foundry's plain default settings list.

import { MODULE_ID, DEFAULT_CHAT_BUBBLE_STYLE, DEFAULT_CHAT_BUBBLE_COLOR } from "./constants.js";
import { PlayerSettingsForm } from "./apps/player-settings-form.js";
import { GMSettingsForm } from "./apps/gm-settings-form.js";
import { AppearanceOverridesForm } from "./apps/appearance-overrides-form.js";
import { StatusIconsForm } from "./apps/status-icons-form.js";
import { DEFAULT_STATUS_CLASSIFICATIONS } from "./status-effects.js";

export function registerSettings() {
  registerPlayerSettings();
  registerGMSettings();
  registerAppearanceOverrideSettings();
  registerStatusIconSettings();
}

// Position, size, flip, and fade timing used to live here as per-player
// (client-scoped) settings — they're all GM-only now (see "Configure
// Character Appearance"), so the only thing left that's always the
// viewer's own choice is which image shows.
function registerPlayerSettings() {
  game.settings.register(MODULE_ID, "imageSource", {
    scope: "client",
    config: false,
    type: String,
    default: "portrait"
  });

  game.settings.registerMenu(MODULE_ID, "playerSettingsMenu", {
    name: "Popup Appearance",
    label: "Configure Your Popup",
    hint: "Choose which image (portrait or token) shows on your own popup. Everything else — size, position, flip, and fade timing — is set by the GM.",
    icon: "fa-solid fa-image",
    type: PlayerSettingsForm,
    restricted: false
  });
}

function registerGMSettings() {
  game.settings.register(MODULE_ID, "duration", {
    scope: "world",
    config: false,
    type: Number,
    default: 5
  });
  game.settings.register(MODULE_ID, "triggerIC", {
    scope: "world",
    config: false,
    type: Boolean,
    default: true
  });
  game.settings.register(MODULE_ID, "triggerEmote", {
    scope: "world",
    config: false,
    type: Boolean,
    default: true
  });
  game.settings.register(MODULE_ID, "triggerRolls", {
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });
  game.settings.register(MODULE_ID, "triggerNPCs", {
    scope: "world",
    config: false,
    type: Boolean,
    default: true
  });

  // "Bloodied" red aura — on by GM choice, threshold is GM-configurable.
  game.settings.register(MODULE_ID, "bloodiedEnabled", {
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });
  game.settings.register(MODULE_ID, "bloodiedThreshold", {
    scope: "world",
    config: false,
    type: Number,
    default: 50
  });
  game.settings.register(MODULE_ID, "bloodiedAutoPopup", {
    scope: "world",
    config: false,
    type: Boolean,
    default: true
  });

  // "Healed" green aura / "Revived" gold aura — a single toggle covers
  // both, since they're just the two possible outcomes of the same kind
  // of event (HP going up). Unlike bloodied, there's no meaningful
  // "state" version of this — a heal is a one-time moment, not something
  // to keep showing on unrelated later popups — so this always auto-pops
  // when it fires; see main.js's updateActor hook.
  game.settings.register(MODULE_ID, "healAuraEnabled", {
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });

  // "Keep on screen" — skips the auto-hide timer entirely when on.
  game.settings.register(MODULE_ID, "noTimeout", {
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });

  // Chat bubble — a fixed top-center box showing the actual message text,
  // same idea as FGA Scene Director's speech bubble. Only ever shown for a
  // popup triggered by a real chat message (see main.js's extractChatText);
  // the bloodied/healed/revived/status-icon triggers have no line to show.
  game.settings.register(MODULE_ID, "chatBubbleEnabled", {
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });
  game.settings.register(MODULE_ID, "chatBubbleStyle", {
    scope: "world",
    config: false,
    type: Object,
    default: DEFAULT_CHAT_BUBBLE_STYLE
  });
  // Bubble background color, as a "#rrggbb" hex string — text color is
  // never stored separately, it's always computed as this color's literal
  // RGB inverse at render time (see constants.js's invertHexColor and
  // popup.js's buildChatBubble).
  game.settings.register(MODULE_ID, "chatBubbleColor", {
    scope: "world",
    config: false,
    type: String,
    default: DEFAULT_CHAT_BUBBLE_COLOR
  });

  game.settings.registerMenu(MODULE_ID, "gmSettingsMenu", {
    name: "Popup Rules (GM Only)",
    label: "Configure Popup Rules",
    hint: "Set how long popups stay up, which chat messages trigger them, the bloodied/healed/revived aura rules, and the optional chat bubble.",
    icon: "fa-solid fa-crown",
    type: GMSettingsForm,
    restricted: true
  });
}

// The GM's appearance-control window: a shared default that applies to
// every player character, one bucket each for Hostile/Neutral/Friendly
// NPCs, and per-character overrides for individual player characters. See
// appearance.js for how these three settings are resolved into what
// actually shows on screen. Placement/size/flip/fade are ALL GM-only now —
// "genericPlayerOverride" is no longer optional (its old "mode" field is
// kept in saved data for backward compatibility but is never read anymore;
// its fields always apply as the shared default unless a specific
// character has its own "override" entry in perActorSettings).
function registerAppearanceOverrideSettings() {
  game.settings.register(MODULE_ID, "genericPlayerOverride", {
    scope: "world",
    config: false,
    type: Object,
    default: {
      scale: 1,
      positionPreset: "bottom-right",
      positionX: 80,
      positionY: 60,
      flipHorizontal: false,
      flipVertical: false,
      fadeOut: true,
      imageSource: ""
    }
  });

  // Keyed "hostile" | "neutral" | "friendly" (Foundry's own token
  // disposition field decides which bucket an NPC falls into).
  game.settings.register(MODULE_ID, "npcDispositionOverrides", {
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  // Keyed by actor id — individual player-character overrides, for the
  // occasional character whose popup needs to look different from the
  // shared default (e.g. a bigger portrait for one specific PC).
  // {"<actorId>": {mode: "gm"|"override", scale, positionPreset,
  //                positionX, positionY, flipHorizontal, flipVertical,
  //                fadeOut, imageSource}, ...}
  game.settings.register(MODULE_ID, "perActorSettings", {
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  game.settings.registerMenu(MODULE_ID, "appearanceOverridesMenu", {
    name: "Appearance Overrides (GM Only)",
    label: "Configure Character Appearance",
    hint: "Set the shared default look every player character uses, tweak individual characters or NPC groups that need something different, and pick a target on the left to get started.",
    icon: "fa-solid fa-people-arrows",
    type: AppearanceOverridesForm,
    restricted: true
  });
}

// A character's popup can also pop up on its own the instant a classified
// condition is applied to them, with that condition's own icon shown on
// top of the portrait. See status-effects.js for the default Buff/Debuff/
// Off classifications, and main.js's createActiveEffect hook for the
// actual trigger logic.
function registerStatusIconSettings() {
  // Keyed by condition id (as CONFIG.statusEffects defines them) —
  // "buff" | "debuff" | "off". Missing entries (a condition the live
  // system exposes that isn't in this map) are treated as "off."
  game.settings.register(MODULE_ID, "statusIconClassifications", {
    scope: "world",
    config: false,
    type: Object,
    default: DEFAULT_STATUS_CLASSIFICATIONS
  });
  game.settings.register(MODULE_ID, "statusIconBuffsEnabled", {
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });
  game.settings.register(MODULE_ID, "statusIconDebuffsEnabled", {
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });
  game.settings.register(MODULE_ID, "statusIconScale", {
    scope: "world",
    config: false,
    type: Number,
    default: 1
  });

  game.settings.registerMenu(MODULE_ID, "statusIconsMenu", {
    name: "Status Icons (GM Only)",
    label: "Configure Status Icons",
    hint: "Pick which conditions pop up a character's portrait the instant they're applied, with that condition's own icon shown on top.",
    icon: "fa-solid fa-hand-sparkles",
    type: StatusIconsForm,
    restricted: true
  });
}
