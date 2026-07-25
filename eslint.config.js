import js from "@eslint/js";
import globals from "globals";

/**
 * The extension ships as classic scripts loaded together, so their top-level
 * declarations share one global lexical environment. ESLint sees each file on its own
 * and would flag every cross-file reference as undefined, so the names each file
 * publishes are declared here.
 *
 * Keep this in step with the top-level `const`s and `function`s in those three files.
 */
const SHARED_EXTENSION_GLOBALS = {
  // defaults.js
  DEFAULT_CONFIGURATION: "readonly",
  applyConfigurationDefaults: "readonly",
  configurationNeedsUpgrade: "readonly",
  // rules.js
  REMOVAL_RULES: "readonly",
  AD_CONTAINERS: "readonly",
  AD_LABEL: "readonly",
  URL_COLOR_TARGETS: "readonly",
  EMOJI_TEXT_CLASSES: "readonly",
  gatingClass: "readonly",
  ruleIsEnabled: "readonly",
  targetSelector: "readonly",
  targetNeedsHas: "readonly",
  buildRemovalStyleSheet: "readonly",
  buildColorStyleSheet: "readonly",
  allGatingClasses: "readonly",
  gatingClassesFor: "readonly",
};

export default [
  {
    ignores: ["node_modules/**"],
  },

  // The extension itself: classic scripts running in a browser.
  {
    files: ["Google Search Customizer v1/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        ...SHARED_EXTENSION_GLOBALS,
      },
    },
    rules: {
      ...js.configs.recommended.rules,

      // `no-redeclare` would otherwise fire on the file that actually declares each of
      // the shared names above.
      "no-redeclare": ["error", { builtinGlobals: false }],

      // The one that matters most here. Both bugs introduced during the CSS rework were
      // a statement reading a `const` declared further down the file — hoisting saves
      // function calls but not bindings. Functions are exempt because the code relies on
      // calling them before their declaration.
      "no-use-before-define": ["error", { variables: true, functions: false, classes: true }],

      // Every callback the extension registers with chrome.* is used for its side
      // effects, so unused parameters are normal; unused variables are not.
      "no-unused-vars": ["error", { args: "none" }],

      eqeqeq: "off", // The existing code uses == throughout; not worth the churn.
    },
  },

  // The test suite: ES modules running in Node.
  {
    files: ["tests/**/*.js", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["error", { args: "none" }],
    },
  },
];
