import assert from "node:assert/strict";
import test from "node:test";

const {
  escapeRegexLiteral,
  isReferralDescriptionCategory,
  referralDescriptionPattern,
} = await import(
  "../src/lib/admin/transactionDescriptionFilters.ts"
);

test("referral description categories match their exact bonus descriptions", async () => {
  const cases = [
    ["referrer_bonus", "Referral bonus", "Welcome referral bonus"],
    [
      "welcome_referral_bonus",
      "Welcome referral bonus (reconciled)",
      "Admin referral welcome bonus",
    ],
    [
      "admin_referral_welcome_bonus",
      "Admin referral welcome bonus",
      "Referral bonus",
    ],
  ];

  for (const [category, match, nonMatch] of cases) {
    assert.equal(isReferralDescriptionCategory(category), true);
    const descriptionPattern = referralDescriptionPattern(category);

    assert.equal(descriptionPattern.test(match), true);
    assert.equal(descriptionPattern.test(nonMatch), false);
  }
  assert.equal(isReferralDescriptionCategory("unrecognized"), false);
});

test("description search escapes regex metacharacters", () => {
  const pattern = new RegExp(escapeRegexLiteral("bonus (.*)"), "i");
  assert.equal(pattern.test("Welcome bonus (.*)"), true);
  assert.equal(pattern.test("Welcome bonus anything"), false);
});
