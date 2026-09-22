// The GM-only "Configure Character Appearance" window: a two-pane GUI for
// fine-grained control over popup looks. The left list has every
// controllable target; the right side shows that target's own mode and
// fields.
//
// Three modes, meaning depends on the target:
//   - Generic Player:      "player" (everyone uses their own settings) or
//                           "override" (GM sets one shared look for every
//                           player character).
//   - An NPC disposition
//     bucket (Hostile/
//     Neutral/Friendly):    "default" (the module's built-in look) or
//                           "override" (a custom look for that whole group).
//   - An individual
//     character:            "gm" (follow whatever Generic Player currently
//                           resolves to), "player" (always use that
//                           viewer's own settings, bypassing any GM
//                           override), or "override" (a custom look just
//                           for this one character).
//
// Everything is edited in an in-memory working copy so switching between
// targets in the list doesn't lose unsaved edits on the one you switched
// away from — only Save writes it back to the three underlying settings
// (genericPlayerOverride, npcDispositionOverrides, perActorSettings).

import {
  MODULE_ID,
  buildPositionPresetOptions,
  buildImageSourceOverrideOptions,
  FALLBACK_IMAGE
} from "../constants.js";
import { applyPositionStyle } from "../position.js";
import { getDispositionKey } from "../appearance.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const DISPOSITION_BUCKETS = [
  { id: "npc-hostile", key: "hostile", label: "NPCs — Hostile" },
  { id: "npc-neutral", key: "neutral", label: "NPCs — Neutral" },
  { id: "npc-friendly", key: "friendly", label: "NPCs — Friendly" }
];

const DEFAULT_FIELDS = {
  scale: 1,
  positionPreset: "bottom-right",
  positionX: 80,
  positionY: 60,
  flipHorizontal: false,
  flipVertical: false,
  fadeOut: true,
  imageSource: ""
};

const MODE_OPTIONS = {
  generic: [
    { key: "player", label: "Each player uses their own settings" },
    { key: "override", label: "GM sets one shared look for every player" }
  ],
  "npc-bucket": [
    { key: "default", label: "Use the module's default appearance" },
    { key: "override", label: "Set a custom look for this group" }
  ],
  actor: [
    { key: "gm", label: "Follow the Generic Player setting" },
    { key: "player", label: "Always use this player's own settings (ignore GM overrides)" },
    { key: "override", label: "Set a custom look just for this character" }
  ]
};

function playerActors() {
  return game.actors.contents
    .filter((a) => a.hasPlayerOwner)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export class AppearanceOverridesForm extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "fga-character-popup-appearance-overrides",
    tag: "form",
    window: {
      title: "FGA Character Popup — Appearance Overrides",
      icon: "fa-solid fa-people-arrows",
      contentClasses: ["ccp-settings-form"],
      resizable: true
    },
    position: { width: 720, height: 640 },
    form: {
      handler: AppearanceOverridesForm.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: true
    }
  };

  static PARTS = {
    form: { template: `modules/${MODULE_ID}/templates/appearance-overrides.hbs` }
  };

  constructor(...args) {
    super(...args);
    this._working = {};

    const generic = game.settings.get(MODULE_ID, "genericPlayerOverride") ?? {};
    this._working["generic-player"] = { mode: "player", ...DEFAULT_FIELDS, ...generic };

    const npcSaved = game.settings.get(MODULE_ID, "npcDispositionOverrides") ?? {};
    for (const bucket of DISPOSITION_BUCKETS) {
      this._working[bucket.id] = { mode: "default", ...DEFAULT_FIELDS, ...(npcSaved[bucket.key] ?? {}) };
    }

    const actorSaved = game.settings.get(MODULE_ID, "perActorSettings") ?? {};
    for (const actor of playerActors()) {
      this._working[actor.id] = { mode: "gm", ...DEFAULT_FIELDS, ...(actorSaved[actor.id] ?? {}) };
    }

    this._selectedId = "generic-player";
  }

  _entryType(id) {
    if (id === "generic-player") return "generic";
    if (DISPOSITION_BUCKETS.some((b) => b.id === id)) return "npc-bucket";
    return "actor";
  }

  _entryLabel(id) {
    if (id === "generic-player") return "Generic Player";
    const bucket = DISPOSITION_BUCKETS.find((b) => b.id === id);
    if (bucket) return bucket.label;
    return game.actors.get(id)?.name ?? "Unknown Character";
  }

  _entryPreviewImg(id) {
    if (id === "generic-player") return game.user.character?.img || FALLBACK_IMAGE;
    const bucket = DISPOSITION_BUCKETS.find((b) => b.id === id);
    if (bucket) {
      // Use any NPC currently in that disposition bucket as a stand-in for the preview, if one exists.
      const sample = game.actors.contents.find((a) => !a.hasPlayerOwner && getDispositionKey(a) === bucket.key);
      return sample?.img || FALLBACK_IMAGE;
    }
    return game.actors.get(id)?.img || FALLBACK_IMAGE;
  }

  async _prepareContext(_options) {
    if (!this._working[this._selectedId]) this._selectedId = "generic-player";

    const actors = playerActors();
    const entries = [
      { id: "generic-player", label: "Generic Player", selected: this._selectedId === "generic-player" },
      ...DISPOSITION_BUCKETS.map((b) => ({ id: b.id, label: b.label, selected: this._selectedId === b.id }))
    ];
    const actorEntries = actors.map((a) => ({
      id: a.id,
      label: a.name,
      selected: this._selectedId === a.id
    }));

    const type = this._entryType(this._selectedId);
    const entry = this._working[this._selectedId] ?? { mode: "gm", ...DEFAULT_FIELDS };
    const preset = entry.positionPreset ?? "bottom-right";

    return {
      entries,
      actorEntries,
      selectedLabel: this._entryLabel(this._selectedId),
      modeOptions: MODE_OPTIONS[type].map((o) => ({ ...o, selected: o.key === entry.mode })),
      scale: entry.scale,
      positionPresets: buildPositionPresetOptions(preset),
      positionX: entry.positionX,
      positionY: entry.positionY,
      flipHorizontal: entry.flipHorizontal,
      flipVertical: entry.flipVertical,
      fadeOut: entry.fadeOut,
      imageSources: buildImageSourceOverrideOptions(entry.imageSource),
      previewImg: this._entryPreviewImg(this._selectedId)
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const root = this.element;

    linkSliderAndNumber(root, "#ccp-ov-x-range", "#ccp-ov-x-number");
    linkSliderAndNumber(root, "#ccp-ov-y-range", "#ccp-ov-y-number");

    const scaleRange = root.querySelector("#ccp-ov-scale-range");
    const scaleOutput = root.querySelector("#ccp-ov-scale-output");
    scaleRange?.addEventListener("input", () => {
      if (scaleOutput) scaleOutput.textContent = `${scaleRange.value}x`;
    });

    const positionSelect = root.querySelector("select[name='entryPositionPreset']");
    const customRow = root.querySelector(".ccp-ov-custom-position");
    const toggleCustomRow = () => {
      if (!customRow || !positionSelect) return;
      customRow.style.display = positionSelect.value === "custom" ? "" : "none";
    };
    positionSelect?.addEventListener("change", toggleCustomRow);
    toggleCustomRow();

    const modeSelect = root.querySelector("select[name='entryMode']");
    const fieldsSection = root.querySelector(".ccp-ov-fields");
    const toggleFields = () => {
      if (!fieldsSection || !modeSelect) return;
      fieldsSection.style.display = modeSelect.value === "override" ? "" : "none";
    };
    modeSelect?.addEventListener("change", toggleFields);
    toggleFields();

    // Switching the target in the left-hand list: stash whatever's
    // currently on screen into the in-memory working copy (so it's not
    // lost), point at the newly-picked target, then re-render so
    // _prepareContext loads its own saved-or-in-progress values.
    root.querySelectorAll(".ccp-overrides-list button[data-entry-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (this._selectedId) {
          this._working[this._selectedId] = readEntryFields(root, modeSelect?.value ?? "gm");
        }
        this._selectedId = btn.dataset.entryId;
        this.render();
      });
    });

    wireUpOverridePreview(root);
  }

  static async #onSubmit(_event, _form, formData) {
    const data = formData.object;

    // Fold whatever's currently shown into the working copy before
    // persisting — covers the case where the GM never touched the list, so
    // there was no switch-triggered sync to capture their edits.
    if (this._selectedId) {
      this._working[this._selectedId] = readEntryFieldsFromData(data, data.entryMode);
    }

    const generic = this._working["generic-player"];
    await game.settings.set(MODULE_ID, "genericPlayerOverride", toSavedShape(generic));

    const npcOverrides = {};
    for (const bucket of DISPOSITION_BUCKETS) {
      npcOverrides[bucket.key] = toSavedShape(this._working[bucket.id]);
    }
    await game.settings.set(MODULE_ID, "npcDispositionOverrides", npcOverrides);

    const perActor = {};
    for (const actor of playerActors()) {
      const entry = this._working[actor.id];
      if (entry) perActor[actor.id] = toSavedShape(entry);
    }
    await game.settings.set(MODULE_ID, "perActorSettings", perActor);

    ui.notifications.info("FGA Character Popup: appearance overrides saved.");
  }
}

function toSavedShape(entry) {
  return {
    mode: entry.mode,
    scale: Number(entry.scale),
    positionPreset: entry.positionPreset,
    positionX: Number(entry.positionX),
    positionY: Number(entry.positionY),
    flipHorizontal: !!entry.flipHorizontal,
    flipVertical: !!entry.flipVertical,
    fadeOut: !!entry.fadeOut,
    imageSource: entry.imageSource || ""
  };
}

function linkSliderAndNumber(root, rangeSelector, numberSelector) {
  const range = root.querySelector(rangeSelector);
  const number = root.querySelector(numberSelector);
  if (!range || !number) return;
  range.addEventListener("input", () => (number.value = range.value));
  number.addEventListener("input", () => (range.value = number.value));
}

/** Read the currently-displayed target's fields straight out of the DOM (used when switching targets). */
function readEntryFields(root, mode) {
  return {
    mode,
    scale: Number(root.querySelector("#ccp-ov-scale-range")?.value ?? DEFAULT_FIELDS.scale),
    positionPreset: root.querySelector("select[name='entryPositionPreset']")?.value ?? DEFAULT_FIELDS.positionPreset,
    positionX: Number(root.querySelector("#ccp-ov-x-number")?.value ?? DEFAULT_FIELDS.positionX),
    positionY: Number(root.querySelector("#ccp-ov-y-number")?.value ?? DEFAULT_FIELDS.positionY),
    flipHorizontal: !!root.querySelector("input[name='entryFlipHorizontal']")?.checked,
    flipVertical: !!root.querySelector("input[name='entryFlipVertical']")?.checked,
    fadeOut: !!root.querySelector("input[name='entryFadeOut']")?.checked,
    imageSource: root.querySelector("select[name='entryImageSource']")?.value || ""
  };
}

/** Same idea, but reading from a submitted FormDataExtended's .object instead of the live DOM. */
function readEntryFieldsFromData(data, mode) {
  return {
    mode,
    scale: Number(data.entryScale ?? DEFAULT_FIELDS.scale),
    positionPreset: data.entryPositionPreset ?? DEFAULT_FIELDS.positionPreset,
    positionX: Number(data.entryPositionX ?? DEFAULT_FIELDS.positionX),
    positionY: Number(data.entryPositionY ?? DEFAULT_FIELDS.positionY),
    flipHorizontal: !!data.entryFlipHorizontal,
    flipVertical: !!data.entryFlipVertical,
    fadeOut: !!data.entryFadeOut,
    imageSource: data.entryImageSource || ""
  };
}

/** Same idea as the other forms' live preview, scoped to this form's own field ids. */
function wireUpOverridePreview(root) {
  const previewThumb = root.querySelector("#ccp-ov-preview-thumb");
  const previewImg = root.querySelector("#ccp-ov-preview-img");
  if (!previewThumb || !previewImg) return;

  const update = () => {
    const scale = Number(root.querySelector("#ccp-ov-scale-range")?.value ?? 1);
    const flipH = root.querySelector("input[name='entryFlipHorizontal']")?.checked;
    const flipV = root.querySelector("input[name='entryFlipVertical']")?.checked;
    const preset = root.querySelector("select[name='entryPositionPreset']")?.value ?? "bottom-right";
    const x = Number(root.querySelector("#ccp-ov-x-number")?.value ?? 50);
    const y = Number(root.querySelector("#ccp-ov-y-number")?.value ?? 50);

    applyPositionStyle(previewThumb, { preset, x, y });

    let transform = `scale(${scale})`;
    if (flipH) transform += " scaleX(-1)";
    if (flipV) transform += " scaleY(-1)";
    previewImg.style.transform = transform;
  };

  const watchedSelectors = [
    "#ccp-ov-scale-range",
    "input[name='entryFlipHorizontal']",
    "input[name='entryFlipVertical']",
    "select[name='entryPositionPreset']",
    "#ccp-ov-x-number",
    "#ccp-ov-y-number",
    "#ccp-ov-x-range",
    "#ccp-ov-y-range"
  ];
  root.querySelectorAll(watchedSelectors.join(", ")).forEach((el) => el.addEventListener("input", update));

  update();
}
