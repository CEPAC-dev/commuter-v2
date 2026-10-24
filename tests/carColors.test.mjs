import test from "node:test";
import assert from "node:assert/strict";
import {
  CAR_COLOR_OPTIONS,
  getCarColorDisplay,
  getCarColorOptionLabel,
  isKnownCarColor,
  normalizeCarColor,
} from "../src/lib/carColors.ts";

const expectedValues = [
  "أبيض", "أسود", "رمادي", "رمادي/فيراني", "فضي", "أزرق", "أزرق/سماوي",
  "أزرق/كحلي", "أحمر", "أحمر/نبيتي", "بيج", "بيج/كافيه", "بني", "بني غامق",
  "ذهبي", "ذهبي فاتح", "أصفر", "أخضر", "أخضر/زيتي", "أخضر فاتح", "برتقالي",
  "برتقالي/نحاسي", "بنفسجي", "أخرى",
];

test("car color values are unique and unchanged", () => {
  const values = CAR_COLOR_OPTIONS.map((option) => option.value);
  assert.deepEqual(values, expectedValues);
  assert.equal(new Set(values).size, values.length);
  assert.ok(values.every((value) => !/\s\/|\/\s/.test(value)));
});

test("every car color option has translated labels", () => {
  for (const option of CAR_COLOR_OPTIONS) {
    assert.ok(option.labelAr.trim());
    assert.ok(option.labelEn.trim());
    assert.ok(option.fullEn.trim());
    assert.equal(getCarColorOptionLabel(option, "ar"), option.labelAr);
    assert.equal(getCarColorOptionLabel(option, "en"), option.labelEn);
    if (option.value.includes("/")) {
      assert.equal(
        option.labelAr,
        option.value.slice(option.value.indexOf("/") + 1),
      );
    }
  }
});

test("known colors display in English while Arabic and custom values stay stored", () => {
  assert.equal(getCarColorDisplay("برتقالي/نحاسي", "en"), "Orange/Copper");
  assert.equal(getCarColorDisplay("برتقالي/نحاسي", "ar"), "برتقالي/نحاسي");
  assert.equal(getCarColorDisplay("White", "en"), "White");
  assert.equal(getCarColorDisplay("White", "ar"), "White");
  assert.equal(getCarColorDisplay("ultraviolet", "en"), "ultraviolet");
  assert.equal(getCarColorDisplay("ultraviolet", "ar"), "ultraviolet");
});

test("car color validation accepts listed and custom plain text values", () => {
  assert.equal(normalizeCarColor("أسود"), "أسود");
  assert.equal(isKnownCarColor("أسود"), true);
  assert.equal(normalizeCarColor("  chartreuse pearl  "), "chartreuse pearl");
  assert.equal(isKnownCarColor("chartreuse pearl"), false);
});

test("car color validation rejects empty, whitespace, and overlong values", () => {
  assert.equal(normalizeCarColor(""), null);
  assert.equal(normalizeCarColor(" \t\n "), null);
  assert.equal(normalizeCarColor("x".repeat(41)), null);
  assert.equal(normalizeCarColor("<script>"), null);
});
