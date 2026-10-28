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
  Linking,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  getAllowEditingBeforeSave,
  setAllowEditingBeforeSave,
} from "../services/storage";
import { SafeAreaWrapper } from "../components/SafeAreaWrapper";
import { Theme, radius, useThemedStyles } from "../utils/theme";

/**
 * SettingsScreen component for managing app settings
 */
export const SettingsScreen: React.FC = () => {
  const { theme, styles } = useThemedStyles(createStyles);
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

  return (
    <SafeAreaWrapper edges={["bottom", "left", "right"]}>
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Saving</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Allow editing before save</Text>
            <Text style={styles.settingDescription}>
              Review the title, tag and folder before a shared link is saved.
              When off, links are saved instantly.
            </Text>
          </View>
          <Switch
            value={allowEditing}
            onValueChange={handleToggleChange}
            disabled={loading}
            trackColor={{ false: theme.border, true: theme.primary }}
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
function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      paddingHorizontal: 16,
      paddingTop: 20,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginBottom: 8,
      marginLeft: 4,
    },
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 16,
      borderRadius: radius.md,
      backgroundColor: theme.surface,
      borderWidth: theme.isDark ? StyleSheet.hairlineWidth : 0,
      borderColor: theme.border,
    },
    settingContent: {
      flex: 1,
      marginRight: 16,
    },
    settingLabel: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 4,
    },
    settingDescription: {
      fontSize: 13,
      color: theme.textMuted,
      lineHeight: 18,
    },
    aboutSpacer: {
      flex: 1,
    },
    aboutSection: {
      paddingBottom: 24,
      alignItems: "center",
    },
    aboutText: {
      fontSize: 13,
      color: theme.textSubtle,
      marginBottom: 4,
    },
    aboutLink: {
      fontSize: 13,
      color: theme.primary,
      marginTop: 4,
      fontWeight: "600",
    },
  });
}
