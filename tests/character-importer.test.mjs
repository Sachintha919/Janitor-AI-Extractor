import test from "node:test";
import assert from "node:assert/strict";
import { parseSource } from "../assets/js/importers/character-importer.js";

test("parses common Character Card V2 data fields", () => {
  const result = parseSource(JSON.stringify({
    spec: "chara_card_v2", spec_version: "2.0",
    data: {
      name: "Jane", description: "A character", personality: "Kind", scenario: "A garden",
      first_mes: "Hello", alternate_greetings: ["Hi", "Hey"], tags: ["romance", "fantasy"],
      creator: "Tester", character_version: "1.2"
    }
  }));
  assert.equal(result.character.name, "Jane");
  assert.equal(result.character.first_mes, "Hello");
  assert.deepEqual(result.character.alternate_greetings, ["Hi", "Hey"]);
  assert.equal(result.character.creator, "Tester");
});

test("preserves unknown character fields", () => {
  const result = parseSource(JSON.stringify({
    data: { name: "A", custom_setting: { enabled: true, note: "keep me" }, creator_notes: "Notes" }
  }));
  assert.equal(result.character.name, "A");
  assert.deepEqual(result.extraFields.custom_setting, { enabled: true, note: "keep me" });
});

test("discovers image URLs and lorebook objects in imported JSON", () => {
  const result = parseSource(JSON.stringify({
    data: { name: "Asset test", avatar: "https://cdn.example.test/avatar.png",
      character_book: { entries: [{ keys: ["rose"], content: "A rose" }] } }
  }));
  assert.equal(result.assets.length, 1);
  assert.match(result.assets[0].url, /avatar\.png/);
  assert.equal(result.lorebooks.length, 1);
  assert.equal(result.lorebooks[0].name, "character_book");
});

test("parses labelled text definitions", () => {
  const result = parseSource("Character Name: Mira\nPersonality: Curious\nScenario: At home\nFirst Message: Hello there");
  assert.equal(result.character.name, "Mira");
  assert.equal(result.character.personality, "Curious");
  assert.equal(result.character.scenario, "At home");
  assert.equal(result.character.first_mes, "Hello there");
});

test("retains structured arrays", () => {
  const result = parseSource(JSON.stringify({ name: "Array test", alternate_greetings: ["One", "Two"], tags: ["a", "b"] }));
  assert.deepEqual(result.character.alternate_greetings, ["One", "Two"]);
});


test("extracts every Janitor AI accordion section and ignores token counters", async () => {
  const { extractJanitorSections } = await import("../assets/js/importers/character-importer.js");
  const fixtures = [
    ["Scenario (202 tokens)", "Jane owns a flower shop.\n{{user}} is her new assistant."],
    ["Personality (1384 tokens)", "Warm, cheerful and nurturing.\nPrivately struggles with loneliness."],
    ["Initial Messages (399 tokens)", "The bell above the door jingles.\n\n\"Welcome to my shop!\""],
    ["Example Dialogs (890 tokens)", "{{user}}: Hello.\n{{char}}: Jane smiles."]
  ];
  const sections = fixtures.map(([heading, body], index) => {
    const button = {
      querySelector: () => ({ textContent: heading }),
      getAttribute: () => "panel-info-" + index
    };
    return { querySelector: selector => selector.includes("button") ? button : null };
  });
  const panels = new Map(fixtures.map(([heading, body], index) => [
    "panel-info-" + index,
    { querySelector: () => ({ innerText: body, textContent: body }) }
  ]));
  const doc = {
    querySelectorAll: () => sections,
    getElementById: id => panels.get(id) || null,
    querySelector: () => null
  };
  const result = extractJanitorSections(doc);
  assert.equal(result.character.scenario, fixtures[0][1]);
  assert.equal(result.character.personality, fixtures[1][1]);
  assert.equal(result.character.first_mes, fixtures[2][1]);
  assert.equal(result.character.mes_example, fixtures[3][1]);
  assert.deepEqual(result.extraFields, {});
});


test("omits non-essential metadata from normal definitions and extra fields", () => {
  const result = parseSource(JSON.stringify({
    data: {
      name: "Field filter test",
      personality: "Warm",
      creator_notes: "Do not show",
      system_prompt: "Do not show",
      post_history_instructions: "Do not show",
      creator: "Do not show",
      group_only_greetings: ["Do not show"],
      tags: ["Do not show"],
      extensions: { custom: true }
    }
  }));
  for (const key of ["creator_notes","system_prompt","post_history_instructions","creator","group_only_greetings","tags","extensions"]) {
    assert.equal(Object.hasOwn(result.character, key), false, key + " should not be a standard definition");
    assert.equal(Object.hasOwn(result.extraFields, key), false, key + " should not appear in extra fields");
  }
  assert.equal(result.character.personality, "Warm");
});


test("omits creator-only metadata from normal definition extraction", () => {
  const result = parseSource(JSON.stringify({
    data: {
      name: "Core fields",
      personality: "Warm",
      scenario: "At the flower shop",
      creator_notes: "Do not show",
      system_prompt: "Do not show",
      post_history_instructions: "Do not show",
      creator: "Do not show",
      group_only_greetings: ["Do not show"],
      tags: ["Do not show"],
      extensions: { hidden: true }
    }
  }));
  assert.equal(result.character.name, "Core fields");
  assert.equal(result.character.personality, "Warm");
  for (const key of ["creator_notes", "system_prompt", "post_history_instructions", "creator", "group_only_greetings", "tags", "extensions"]) {
    assert.equal(Object.hasOwn(result.character, key), false);
    assert.equal(Object.hasOwn(result.extraFields, key), false);
  }
});

test("stores visible Character Book text in Lorebooks as well as Definitions", () => {
  const result = parseSource(JSON.stringify({
    name: "Lore test",
    personality: "A test character",
    character_book: "Village history\\nThe old garden has a hidden gate."
  }));
  assert.equal(result.character.character_book, "Village history\\nThe old garden has a hidden gate.");
  assert.equal(result.lorebooks.length, 1);
  assert.equal(result.lorebooks[0].name, "Character Book");
  assert.match(result.lorebooks[0].data, /hidden gate/);
});
