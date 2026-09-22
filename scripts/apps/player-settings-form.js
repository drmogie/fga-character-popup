// The GUI form each player uses to set up their own popup:
// image size, image source, position (grid or custom X/Y), and flip.
// These are all "client" scoped settings, so every player has their own —
// unless the GM has turned on "control everyone's appearance", in which
// case these are shown but don't take effect (a hint at the top says so).

import { MODULE_ID, buildPositionPresetOptions, buildImageSourceOptions, FALLBACK_IMAGE } from "../constants.js";
import { applyPositionStyle } from "../position.js";

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
    position: { width: 420, height: 600 },
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
    const currentPreset = game.settings.get(MODULE_ID, "positionPreset");
    const currentImageSource = game.settings.get(MODULE_ID, "imageSource");

    // Tell the player specifically what's currently overriding them, if
    // anything. Precedence (see appearance.js): a per-character override on
    // their own character wins; an explicit "always use my own settings"
    // entry beats the shared Generic Player override; otherwise the shared
    // Generic Player override applies if it's on.
    const character = game.user.character;
    const perActorSettings = game.settings.get(MODULE_ID, "perActorSettings") ?? {};
    const actorEntry = character ? perActorSettings[character.id] : null;
    const generic = game.settings.get(MODULE_ID, "genericPlayerOverride") ?? {};

    let winningOverride = null;
    let overrideNote = null;
    if (actorEntry?.mode === "override") {
      winningOverride = actorEntry;
      overrideNote = `The GM currently has your character, ${character.name}, individually overridden, so most of the settings below won't take effect until they turn that off.`;
    } else if (actorEntry?.mode === "player") {
      overrideNote = null; // the GM explicitly left this character on your own settings
    } else if (generic.mode === "override") {
      winningOverride = generic;
      overrideNote = `The GM currently has "everyone uses the GM's look" turned on for players, so most of the settings below won't take effect until they turn that off.`;
    }

    const imageSourceNote = winningOverride?.imageSource
      ? `The GM has pinned your character's image to ${
          winningOverride.imageSource === "token" ? "Token Image" : "Character Portrait"
        } right now, so this choice won't take effect until they unpin it.`
      : "Always your own choice, even when the GM controls the rest.";

    return {
      scale: game.settings.get(MODULE_ID, "scale"),
      positionX: game.settings.get(MODULE_ID, "positionX"),
      positionY: game.settings.get(MODULE_ID, "positionY"),
      flipHorizontal: game.settings.get(MODULE_ID, "flipHorizontal"),
      flipVertical: game.settings.get(MODULE_ID, "flipVertical"),
      fadeOut: game.settings.get(MODULE_ID, "fadeOut"),
      positionPresets: buildPositionPresetOptions(currentPreset),
      imageSources: buildImageSourceOptions(currentImageSource),
      previewImg: game.user.character?.img || FALLBACK_IMAGE,
      overrideNote,
      imageSourceNote
    };
  }

  /** Wire up live slider <-> number box syncing, the custom X/Y toggle, and the preview. */
  async _onRender(context, options) {
    await super._onRender(context, options);
    const root = this.element;

    const scaleRange = root.querySelector("#ccp-scale-range");
    const scaleOutput = root.querySelector("#ccp-scale-output");
    scaleRange?.addEventListener("input", () => {
      if (scaleOutput) scaleOutput.textContent = `${scaleRange.value}x`;
    });

    linkSliderAndNumber(root, "#ccp-x-range", "#ccp-x-number");
    linkSliderAndNumber(root, "#ccp-y-range", "#ccp-y-number");

    const positionSelect = root.querySelector("select[name='positionPreset']");
    const customRow = root.querySelector(".ccp-custom-position");
    const toggleCustomRow = () => {
      if (!customRow || !positionSelect) return;
      customRow.style.display = positionSelect.value === "custom" ? "" : "none";
    };
    positionSelect?.addEventListener("change", toggleCustomRow);
    toggleCustomRow();

    wireUpLivePreview(root);
  }

  static async #onSubmit(_event, _form, formData) {
    const data = formData.object;
    await game.settings.set(MODULE_ID, "scale", Number(data.scale));
    await game.settings.set(MODULE_ID, "positionPreset", data.positionPreset);
    await game.settings.set(MODULE_ID, "positionX", Number(data.positionX));
    await game.settings.set(MODULE_ID, "positionY", Number(data.positionY));
    await game.settings.set(MODULE_ID, "flipHorizontal", !!data.flipHorizontal);
    await game.settings.set(MODULE_ID, "flipVertical", !!data.flipVertical);
    await game.settings.set(MODULE_ID, "fadeOut", !!data.fadeOut);
    await game.settings.set(MODULE_ID, "imageSource", data.imageSource);
    ui.notifications.info("FGA Character Popup: your settings were saved.");
  }
}

function linkSliderAndNumber(root, rangeSelector, numberSelector) {
  const range = root.querySelector(rangeSelector);
  const number = root.querySelector(numberSelector);
  if (!range || !number) return;
  range.addEventListener("input", () => (number.value = range.value));
  number.addEventListener("input", () => (range.value = number.value));
}

/**
 * Shared by both settings forms: reads the current form values and updates
 * a small "your screen" preview box live, so you can see roughly how the
 * popup will look before saving. Only visible to whoever has the form open.
 *
 * Expects the template to include elements with these ids/names:
 * #ccp-preview-thumb, #ccp-preview-img, #ccp-scale-range,
 * input[name=flipHorizontal], input[name=flipVertical],
 * select[name=positionPreset], #ccp-x-number, #ccp-y-number
 */
export function wireUpLivePreview(root) {
  const previewThumb = root.querySelector("#ccp-preview-thumb");
  const previewImg = root.querySelector("#ccp-preview-img");
  if (!previewThumb || !previewImg) return;

  const update = () => {
    const scale = Number(root.querySelector("#ccp-scale-range")?.value ?? 1);
    const flipH = root.querySelector("input[name='flipHorizontal']")?.checked;
    const flipV = root.querySelector("input[name='flipVertical']")?.checked;
    const preset = root.querySelector("select[name='positionPreset']")?.value ?? "bottom-right";
    const x = Number(root.querySelector("#ccp-x-number")?.value ?? 50);
    const y = Number(root.querySelector("#ccp-y-number")?.value ?? 50);

    applyPositionStyle(previewThumb, { preset, x, y });

    let transform = `scale(${scale})`;
    if (flipH) transform += " scaleX(-1)";
    if (flipV) transform += " scaleY(-1)";
    previewImg.style.transform = transform;
  };

  const watchedSelectors = [
    "#ccp-scale-range",
    "input[name='flipHorizontal']",
    "input[name='flipVertical']",
    "select[name='positionPreset']",
    "#ccp-x-number",
    "#ccp-y-number",
    "#ccp-x-range",
    "#ccp-y-range"
  ];
  root.querySelectorAll(watchedSelectors.join(", ")).forEach((el) => el.addEventListener("input", update));

  update();
}
