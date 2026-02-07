/**
 * Settings Screen Component
 *
 * This screen allows users to configure app settings.
 * Currently includes the "allow editing before save" toggle.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  useColorScheme,
  Linking,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  getAllowEditingBeforeSave,
  setAllowEditingBeforeSave,
} from "../services/storage";
import { SafeAreaWrapper } from "../components/SafeAreaWrapper";

/**
 * SettingsScreen component for managing app settings
 */
export const SettingsScreen: React.FC = () => {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";
  const [allowEditing, setAllowEditing] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  /**
   * Loads the current setting value from storage
   */
  const loadSetting = useCallback(async () => {
    try {
      setLoading(true);
      const value = await getAllowEditingBeforeSave();
      setAllowEditing(value);
    } catch (error) {
      console.error("Error loading setting:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Handles toggle change and saves to storage
   */
  const handleToggleChange = async (value: boolean) => {
    try {
      setAllowEditing(value);
      await setAllowEditingBeforeSave(value);
    } catch (error) {
      console.error("Error saving setting:", error);
      // Revert on error
      const currentValue = await getAllowEditingBeforeSave();
      setAllowEditing(currentValue);
    }
  };

  // Load setting when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadSetting();
    }, [loadSetting])
  );

  const theme = {
    background: isDarkMode ? "#0b0b0c" : "#ffffff",
    surface: isDarkMode ? "#161718" : "#ffffff",
    text: isDarkMode ? "#f2f4f7" : "#000000",
    textMuted: isDarkMode ? "#c7c9ce" : "#666666",
    border: isDarkMode ? "#2a2c2f" : "#e0e0e0",
  };

  const styles = createStyles(theme);

  return (
    <SafeAreaWrapper style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.settingRow}>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Allow editing before save</Text>
            <Text style={styles.settingDescription}>
              When enabled, a modal will appear when sharing a link, allowing you
              to edit details before saving. When disabled, links are saved
              immediately.
            </Text>
          </View>
          <Switch
            value={allowEditing}
            onValueChange={handleToggleChange}
            disabled={loading}
            trackColor={{ false: theme.border, true: "#0066cc" }}
            thumbColor={allowEditing ? "#ffffff" : "#f4f3f4"}
            ios_backgroundColor={theme.border}
          />
        </View>

        <View style={styles.aboutSpacer} />
        <View style={styles.aboutSection}>
          <Text style={styles.aboutText}>Made using Cursor</Text>
          <Text style={styles.aboutText}>Made by Sandeep Singh</Text>
          <TouchableOpacity
            onPress={() =>
              Linking.openURL("https://www.github.com/sandeepeven")
            }
            activeOpacity={0.7}
          >
            <Text style={styles.aboutLink}>Github</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaWrapper>
  );
};

/**
 * Styles for the SettingsScreen component
 */
function createStyles(theme: {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
}) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    container: {
      flex: 1,
      backgroundColor: theme.background,
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    settingRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    settingContent: {
      flex: 1,
      marginRight: 16,
    },
    settingLabel: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 8,
    },
    settingDescription: {
      fontSize: 14,
      color: theme.textMuted,
      lineHeight: 20,
    },
    aboutSpacer: {
      flex: 1,
    },
    aboutSection: {
      paddingBottom: 24,
      alignItems: "center",
    },
    aboutText: {
      fontSize: 16,
      color: theme.textMuted,
      marginBottom: 4,
    },
    aboutLink: {
      fontSize: 16,
      color: theme.textMuted,
      marginTop: 4,
      textDecorationLine: "underline",
    },
  });
}

