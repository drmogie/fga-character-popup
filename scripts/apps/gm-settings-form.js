// The GM-only GUI form: how long popups stay up, which kinds of chat
// messages trigger one, and the HP-aura rules (bloodied red, healed green,
// revived gold). Appearance overrides (forcing a shared look for players,
// NPC groups, or a specific character) live in their own separate window
// now — see appearance-overrides-form.js / "Configure Character Appearance".

import { MODULE_ID, FALLBACK_IMAGE } from "../constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class GMSettingsForm extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "fga-character-popup-gm-settings",
    tag: "form",
    window: {
      title: "FGA Character Popup — GM Rules",
      icon: "fa-solid fa-crown",
      contentClasses: ["ccp-settings-form"],
      resizable: true
    },
    position: { width: 420, height: 560 },
    form: {
      handler: GMSettingsForm.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: true
    }
  };

  static PARTS = {
    form: { template: `modules/${MODULE_ID}/templates/gm-settings.hbs` }
  };

  async _prepareContext(_options) {
    return {
      duration: game.settings.get(MODULE_ID, "duration"),
      noTimeout: game.settings.get(MODULE_ID, "noTimeout"),
      triggerIC: game.settings.get(MODULE_ID, "triggerIC"),
      triggerEmote: game.settings.get(MODULE_ID, "triggerEmote"),
      triggerRolls: game.settings.get(MODULE_ID, "triggerRolls"),
      triggerNPCs: game.settings.get(MODULE_ID, "triggerNPCs"),

      bloodiedEnabled: game.settings.get(MODULE_ID, "bloodiedEnabled"),
      bloodiedThreshold: game.settings.get(MODULE_ID, "bloodiedThreshold"),
      bloodiedAutoPopup: game.settings.get(MODULE_ID, "bloodiedAutoPopup"),

      healAuraEnabled: game.settings.get(MODULE_ID, "healAuraEnabled"),
      previewImg: game.user.character?.img || FALLBACK_IMAGE
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const root = this.element;

    const durationRange = root.querySelector("#ccp-duration-range");
    const durationOutput = root.querySelector("#ccp-duration-output");
    durationRange?.addEventListener("input", () => {
      if (durationOutput) durationOutput.textContent = durationRange.value;
    });

    const noTimeoutCheckbox = root.querySelector("#ccp-no-timeout");
    const toggleDurationDisabled = () => {
      if (durationRange) durationRange.disabled = !!noTimeoutCheckbox?.checked;
    };
    noTimeoutCheckbox?.addEventListener("change", toggleDurationDisabled);
    toggleDurationDisabled();

    const bloodiedRange = root.querySelector("#ccp-bloodied-range");
    const bloodiedOutput = root.querySelector("#ccp-bloodied-output");
    bloodiedRange?.addEventListener("input", () => {
      if (bloodiedOutput) bloodiedOutput.textContent = bloodiedRange.value;
    });

    const bloodiedCheckbox = root.querySelector("input[name='bloodiedEnabled']");
    const bloodiedSection = root.querySelector(".ccp-bloodied-section");
    const toggleBloodiedSection = () => {
      if (!bloodiedSection || !bloodiedCheckbox) return;
      bloodiedSection.style.display = bloodiedCheckbox.checked ? "" : "none";
    };
    bloodiedCheckbox?.addEventListener("change", toggleBloodiedSection);
    toggleBloodiedSection();

    const healCheckbox = root.querySelector("input[name='healAuraEnabled']");
    const healSection = root.querySelector(".ccp-heal-section");
    const toggleHealSection = () => {
      if (!healSection || !healCheckbox) return;
      healSection.style.display = healCheckbox.checked ? "" : "none";
    };
    healCheckbox?.addEventListener("change", toggleHealSection);
    toggleHealSection();
  }

  static async #onSubmit(_event, _form, formData) {
    const data = formData.object;

    // A disabled duration slider (while "no timeout" is checked) isn't
    // submitted at all, so fall back to whatever's already saved instead
    // of writing NaN over it.
    const duration =
      data.duration !== undefined ? Number(data.duration) : game.settings.get(MODULE_ID, "duration");
    await game.settings.set(MODULE_ID, "duration", duration);
    await game.settings.set(MODULE_ID, "noTimeout", !!data.noTimeout);

    await game.settings.set(MODULE_ID, "triggerIC", !!data.triggerIC);
    await game.settings.set(MODULE_ID, "triggerEmote", !!data.triggerEmote);
    await game.settings.set(MODULE_ID, "triggerRolls", !!data.triggerRolls);
    await game.settings.set(MODULE_ID, "triggerNPCs", !!data.triggerNPCs);

    await game.settings.set(MODULE_ID, "bloodiedEnabled", !!data.bloodiedEnabled);
    await game.settings.set(MODULE_ID, "bloodiedThreshold", Number(data.bloodiedThreshold));
    await game.settings.set(MODULE_ID, "bloodiedAutoPopup", !!data.bloodiedAutoPopup);

    await game.settings.set(MODULE_ID, "healAuraEnabled", !!data.healAuraEnabled);

    ui.notifications.info("FGA Character Popup: GM rules saved.");
  }
}
