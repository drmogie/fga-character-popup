// The GUI form each player uses to set up their own popup. Placement,
// size, flip, and fade timing all moved to GM-only control (see "Configure
// Character Appearance") — what's left as always the player's own choice
// is which image shows (portrait or token, a per-viewer preference) and
// their own character's chat bubble color (a property of the CHARACTER,
// stored as an Actor flag, so every viewer sees the same color for that
// character — see appearance.js's actorBubbleColor). Text color is always
// the bubble color's exact inverse, computed automatically. The portrait
// preview is read-only: it shows the character's CURRENT effective look
// (whatever the GM has set, via getEffectiveAppearance) so the player can
// still see roughly how their popup will look, just not change it from
// here. The bubble preview, unlike the portrait one, IS live — it updates
// as the color picker below it changes. Both the color picker and its
// preview only show up when the player has a character assigned, since
// there's no actor to store the flag on otherwise.

import {
  MODULE_ID,
  buildImageSourceOptions,
  FALLBACK_IMAGE,
  invertHexColor,
  hexToRgb
} from "../constants.js";
import { applyPositionStyle } from "../position.js";
import { getEffectiveAppearance, actorBubbleColor } from "../appearance.js";

/** A semi-transparent border shade derived from the bubble's foreground (text) color — matches popup.js's own. */
function hexToBorderRgba(hex) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, 0.35)`;
}

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class PlayerSettingsForm extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "fga-character-popup-player-settings",
    tag: "form",
    window: {
      title: "FGA Character Popup — Your Settings",
      icon: "fa-solid fa-image",
      contentClasses: ["ccp-settings-form"],
      resizable: true
    },
    position: { width: 400, height: 520 },
    form: {
      handler: PlayerSettingsForm.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: true
    }
  };

  static PARTS = {
    form: { template: `modules/${MODULE_ID}/templates/player-settings.hbs` }
  };

  async _prepareContext(_options) {
    const currentImageSource = game.settings.get(MODULE_ID, "imageSource");
    const character = game.user.character;
    const appearance = character ? getEffectiveAppearance(character) : null;

    // Is the GM currently pinning a specific image source for this
    // character, rather than leaving it as "inherit"? Checked directly off
    // the raw override entries (whichever one actually applies to this
    // character — a per-character override, else the shared default).
    const perActorSettings = game.settings.get(MODULE_ID, "perActorSettings") ?? {};
    const actorEntry = character ? perActorSettings[character.id] : null;
    const generic = game.settings.get(MODULE_ID, "genericPlayerOverride") ?? {};
    const pinnedImageSource = actorEntry?.mode === "override" ? actorEntry.imageSource || null : generic.imageSource || null;

    const imageSourceNote = pinnedImageSource
      ? `The GM has pinned your character's image to ${
          pinnedImageSource === "token" ? "Token Image" : "Character Portrait"
        } right now, so this choice won't take effect until they unpin it.`
      : "Always your own choice, even though the GM controls the size/position/flip.";

    // Only meaningful with a character assigned — it's stored as a flag
    // on that Actor document, not a setting, so there's nowhere to save
    // it without one (see file header).
    const bubbleColor = actorBubbleColor(character);
    const bubbleFg = invertHexColor(bubbleColor);

    return {
      imageSources: buildImageSourceOptions(currentImageSource),
      previewImg: character?.img || FALLBACK_IMAGE,
      previewName: character?.name || "Character",
      appearance,
      imageSourceNote,
      hasCharacter: !!character,
      chatBubbleColor: { color: bubbleColor, fg: bubbleFg, border: hexToBorderRgba(bubbleFg) }
    };
  }

  /** The portrait preview is read-only (no editable fields feed it), so just render it once from the GM-set appearance. The bubble-color preview below it IS live, and wires up regardless of whether a portrait preview is even showing (a player with no character assigned still has their own bubble color to set). */
  async _onRender(context, options) {
    await super._onRender(context, options);
    const root = this.element;

    const previewThumb = root.querySelector("#ccp-preview-thumb");
    const previewImg = root.querySelector("#ccp-preview-img");
    if (previewThumb && previewImg && context.appearance) {
      applyPositionStyle(previewThumb, {
        preset: context.appearance.positionPreset,
        x: context.appearance.positionX,
        y: context.appearance.positionY
      });

      let transform = `scale(${context.appearance.scale})`;
      if (context.appearance.flipHorizontal) transform += " scaleX(-1)";
      if (context.appearance.flipVertical) transform += " scaleY(-1)";
      previewImg.style.transform = transform;
    }

    const bubbleColorInput = root.querySelector("input[name='chatBubbleColor']");
    const bubblePreview = root.querySelector("#ccp-player-bubble-preview");
    const syncBubbleColorPreview = () => {
      if (!bubblePreview || !bubbleColorInput) return;
      const bg = bubbleColorInput.value;
      const fg = invertHexColor(bg);
      bubblePreview.style.setProperty("--ccp-bubble-bg", bg);
      bubblePreview.style.setProperty("--ccp-bubble-fg", fg);
      bubblePreview.style.setProperty("--ccp-bubble-border", hexToBorderRgba(fg));
    };
    bubbleColorInput?.addEventListener("input", syncBubbleColorPreview);
    syncBubbleColorPreview();
  }

  static async #onSubmit(_event, _form, formData) {
    const data = formData.object;
    await game.settings.set(MODULE_ID, "imageSource", data.imageSource);

    // Bubble color is a flag on the player's own character (see file
    // header) — only present in the submitted data at all when a
    // character was assigned and the field was actually rendered.
    const character = game.user.character;
    if (character && data.chatBubbleColor) {
      try {
        await character.setFlag(MODULE_ID, "bubbleColor", data.chatBubbleColor);
      } catch (err) {
        console.error("FGA Character Popup | couldn't save bubble color to your character", err);
        ui.notifications.warn(
          "FGA Character Popup: your image choice saved, but your bubble color didn't — you may not have permission to edit your character. Ask your GM."
        );
        ui.notifications.info("FGA Character Popup: your settings were saved.");
        return;
      }
    }

    ui.notifications.info("FGA Character Popup: your settings were saved.");
  }
}
