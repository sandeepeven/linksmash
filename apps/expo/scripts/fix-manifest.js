/**
 * Post-build script to fix duplicated intent filter names in AndroidManifest.xml
 *
 * This script runs after prebuild to fix the duplication issue that occurs
 * during Expo's manifest generation process.
 */

const fs = require("fs");
const path = require("path");

const manifestPath = path.join(
  __dirname,
  "..",
  "android",
  "app",
  "src",
  "main",
  "AndroidManifest.xml"
);

if (!fs.existsSync(manifestPath)) {
  console.log("AndroidManifest.xml not found, skipping fix.");
  process.exit(0);
}

let manifestContent = fs.readFileSync(manifestPath, "utf8");
const originalContent = manifestContent;

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

if (manifestContent !== originalContent) {
  fs.writeFileSync(manifestPath, manifestContent, "utf8");
  console.log("Fixed duplicated intent filter names in AndroidManifest.xml");
} else {
  console.log("No duplicated intent filter names found in AndroidManifest.xml");
}
