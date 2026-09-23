// The GUI form each player uses to set up their own popup. Placement,
// size, flip, and fade timing all moved to GM-only control (see "Configure
// Character Appearance") — the one thing left that's always the viewer's
// own choice is which image shows, portrait or token. The preview here is
// read-only: it shows the character's CURRENT effective look (whatever the
// GM has set, via getEffectiveAppearance) so the player can still see
// roughly how their popup will look, just not change it from here.

import { MODULE_ID, buildImageSourceOptions, FALLBACK_IMAGE } from "../constants.js";
import { applyPositionStyle } from "../position.js";
import { getEffectiveAppearance } from "../appearance.js";

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
    position: { width: 380, height: 340 },
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

    return {
      imageSources: buildImageSourceOptions(currentImageSource),
      previewImg: character?.img || FALLBACK_IMAGE,
      appearance,
      imageSourceNote,
      hasCharacter: !!character
    };
  }

  /** The preview is read-only (no editable fields feed it), so just render it once from the GM-set appearance. */
  async _onRender(context, options) {
    await super._onRender(context, options);
    const root = this.element;

    const previewThumb = root.querySelector("#ccp-preview-thumb");
    const previewImg = root.querySelector("#ccp-preview-img");
    if (!previewThumb || !previewImg || !context.appearance) return;

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

  static async #onSubmit(_event, _form, formData) {
    const data = formData.object;
    await game.settings.set(MODULE_ID, "imageSource", data.imageSource);
    ui.notifications.info("FGA Character Popup: your settings were saved.");
  }
}
