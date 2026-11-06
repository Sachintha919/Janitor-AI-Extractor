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
  assert.deepEqual(result.character.tags, ["romance", "fantasy"]);
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
  assert.deepEqual(result.character.tags, ["a", "b"]);
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
