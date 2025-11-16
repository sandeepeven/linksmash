/**
 * Expo Config Plugin for react-native-receive-sharing-intent
 *
 * This plugin modifies MainActivity.kt to override onNewIntent method
 * to handle incoming share intents when the app is already running.
 */

const { withMainActivity } = require("@expo/config-plugins");

const withMainActivityOnNewIntent = (config) => {
  return withMainActivity(config, (config) => {
    let mainActivityContent = config.modResults.contents;

    // Check if file is Kotlin (.kt) or Java (.java)
    const isKotlin = config.modResults.path.endsWith(".kt");

    // Remove any existing incorrect Java syntax onNewIntent if present
    // This handles the case where the plugin was run before and inserted Java code
    mainActivityContent = mainActivityContent.replace(
      /[\s]*@Override\s*protected\s+void\s+onNewIntent\([^)]*\)\s*\{[^}]*\}[\s]*/g,
      ""
    );

    // Remove any incorrect Kotlin syntax that might have the wrong method call
    mainActivityContent = mainActivityContent.replace(
      /[\s]*override\s+fun\s+onNewIntent\([^)]*\)\s*\{[^}]*ReceiveSharingIntentPackage\.getInstance\(\)[^}]*\}[\s]*/g,
      ""
    );

    // Add onNewIntent method if not present (in Kotlin or Java syntax)
    if (!mainActivityContent.includes("onNewIntent")) {
      const onNewIntentMethod = isKotlin
        ? `
  override fun onNewIntent(intent: android.content.Intent?) {
    super.onNewIntent(intent)
    setIntent(intent)
    // The react-native-receive-sharing-intent library will read from the intent
    // when getReceivedFiles is called from JavaScript
  }`
        : `
  @Override
  protected void onNewIntent(android.content.Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    // The react-native-receive-sharing-intent library will read from the intent
    // when getReceivedFiles is called from JavaScript
  }`;

      // Insert before the last closing brace of the class
      const lastBraceIndex = mainActivityContent.lastIndexOf("}");
      if (lastBraceIndex > 0) {
        mainActivityContent =
          mainActivityContent.slice(0, lastBraceIndex) +
          onNewIntentMethod +
          "\n    " +
          mainActivityContent.slice(lastBraceIndex);
      }
    }

    config.modResults.contents = mainActivityContent;
    return config;
  });
};

module.exports = withMainActivityOnNewIntent;
