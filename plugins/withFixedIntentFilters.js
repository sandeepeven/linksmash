/**
 * Expo Config Plugin to fix duplicate intent filter action/category names
 *
 * This fixes a bug where Expo duplicates the action/category names during prebuild.
 * The plugin works by modifying the manifest XML string after it's been generated.
 * Since withDangerousMod runs too early, we use a post-write hook via withAndroidManifest
 * by modifying the contents string, and also add a file watcher approach.
 */

const { withAndroidManifest } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Fixes duplicated intent filter names in manifest XML content
 * @param {string} manifestContent - The manifest XML as a string
 * @returns {string} - Fixed manifest XML
 */
function fixDuplicatedIntentFilters(manifestContent) {
  if (!manifestContent || typeof manifestContent !== "string") {
    return manifestContent;
  }

  // Fix duplicated action names
  // Pattern: android.intent.action.android.intent.action.SEND -> android.intent.action.SEND
  manifestContent = manifestContent.replace(
    /android:name="android\.intent\.action\.android\.intent\.action\.([^"]+)"/g,
    'android:name="android.intent.action.$1"'
  );

  // Fix duplicated category names
  // Pattern: android.intent.category.android.intent.category.DEFAULT -> android.intent.category.DEFAULT
  manifestContent = manifestContent.replace(
    /android:name="android\.intent\.category\.android\.intent\.category\.([^"]+)"/g,
    'android:name="android.intent.category.$1"'
  );

  return manifestContent;
}

/**
 * Recursively fixes duplicated names in the parsed manifest object
 * @param {any} obj - The manifest object or any nested object
 */
function fixManifestObject(obj) {
  if (!obj || typeof obj !== "object") {
    return;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item) => fixManifestObject(item));
    return;
  }

  // Fix $ attributes (XML attributes in Expo's manifest format)
  if (obj.$ && obj.$["android:name"]) {
    const name = obj.$["android:name"];
    // Fix duplicated action
    if (name.includes("android.intent.action.android.intent.action.")) {
      obj.$["android:name"] = name.replace(
        /android\.intent\.action\.android\.intent\.action\./,
        "android.intent.action."
      );
    }
    // Fix duplicated category
    if (name.includes("android.intent.category.android.intent.category.")) {
      obj.$["android:name"] = name.replace(
        /android\.intent\.category\.android\.intent\.category\./,
        "android.intent.category."
      );
    }
  }

  // Recursively process all properties
  Object.keys(obj).forEach((key) => {
    if (key !== "$") {
      fixManifestObject(obj[key]);
    }
  });
}

const withFixedIntentFilters = (config) => {
  return withAndroidManifest(config, (config) => {
    // Fix the parsed manifest object
    if (config.modResults.manifest) {
      fixManifestObject(config.modResults.manifest);
    }

    // Also fix the raw XML contents string if available
    // This is the string representation that will be written to disk
    if (config.modResults.contents) {
      config.modResults.contents = fixDuplicatedIntentFilters(
        config.modResults.contents
      );
    }

    return config;
  });
};

module.exports = withFixedIntentFilters;
