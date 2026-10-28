/**
 * Edit Link Screen Component
 *
 * This screen allows users to edit link metadata (title, description, image, tag).
 * The URL field is read-only and cannot be modified.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Share,
  Platform,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { updateLink } from "../services/storage";
import { LinkData } from "../types/link";
import { SafeAreaWrapper } from "../components/SafeAreaWrapper";
import { FolderSelector } from "../components/FolderSelector";
import { Theme, radius, useThemedStyles } from "../utils/theme";

/**
 * Navigation param types
 */
type RootStackParamList = {
  EditLink: {
    linkData: LinkData;
  };
};

type EditLinkScreenRouteProp = RouteProp<RootStackParamList, "EditLink">;
type EditLinkScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "EditLink"
>;

/**
 * EditLinkScreen component for editing link metadata
 */
export const EditLinkScreen: React.FC = () => {
  const navigation = useNavigation<EditLinkScreenNavigationProp>();
  const route = useRoute<EditLinkScreenRouteProp>();
  const { linkData } = route.params;
  const { theme, styles } = useThemedStyles(createStyles);

  const descriptionInputRef = useRef<TextInput | null>(null);
  const imageInputRef = useRef<TextInput | null>(null);
  const tagInputRef = useRef<TextInput | null>(null);

  const [title, setTitle] = useState<string>(linkData.title || "");
  const [description, setDescription] = useState<string>(
    linkData.description || ""
  );
  const [image, setImage] = useState<string>(linkData.image || "");
  const [tag, setTag] = useState<string>(linkData.tag || "");
  const [folderId, setFolderId] = useState<string | null>(
    linkData.folderId || null
  );
  const [saving, setSaving] = useState<boolean>(false);

  /**
   * Handles sharing the link URL
   */
  const handleShare = async () => {
    try {
      await Share.share({
        message: linkData.url,
      });
    } catch (error) {
      console.error("Error sharing link:", error);
      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "Failed to share link. Please try again."
      );
    }
  };

  /**
   * Saves the updated link data
   */
  const handleSave = async () => {
    try {
      setSaving(true);

      // Prepare updated link data
      const updatedLinkData: Partial<LinkData> = {
        title: title.trim() || null,
        description: description.trim() || null,
        image: image.trim() || null,
        tag: tag.trim() || null,
        folderId: folderId,
      };

      // Update the link in storage (using URL to find the link)
      await updateLink(linkData.url, updatedLinkData);

      // Navigate back
      navigation.goBack();
    } catch (error) {
      console.error("Error saving link:", error);
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to save link changes"
      );
    } finally {
      setSaving(false);
    }
  };

  // Set up save button in header
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerButtonContainer}>
          {saving ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <TouchableOpacity
              onPress={handleSave}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.saveButton}>Save</Text>
            </TouchableOpacity>
          )}
        </View>
      ),
    });
  }, [navigation, title, description, image, tag, folderId, saving, styles]);

  return (
    <SafeAreaWrapper edges={["bottom", "left", "right"]}>
      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        enableOnAndroid
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={80}
      >
        {/* URL Field (Read-only) */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>URL</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={linkData.url}
            editable={false}
            selectTextOnFocus={false}
            placeholder="URL"
            multiline
          />
          <Text style={styles.helpText}>URL cannot be modified</Text>
        </View>

        {/* Title Field */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter title"
            placeholderTextColor={theme.textSubtle}
            autoCapitalize="sentences"
            autoCorrect={true}
            returnKeyType="next"
            onSubmitEditing={() => {
              descriptionInputRef.current?.focus();
            }}
          />
        </View>

        {/* Description Field */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            ref={descriptionInputRef}
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Enter description"
            placeholderTextColor={theme.textSubtle}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            autoCapitalize="sentences"
            autoCorrect={true}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => {
              imageInputRef.current?.focus();
            }}
          />
        </View>

        {/* Image URL Field */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Image URL</Text>
          <TextInput
            ref={imageInputRef}
            style={styles.input}
            value={image}
            onChangeText={setImage}
            placeholder="Enter image URL"
            placeholderTextColor={theme.textSubtle}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="next"
            onSubmitEditing={() => {
              tagInputRef.current?.focus();
            }}
          />
        </View>

        {/* Tag Field */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Tag</Text>
          <TextInput
            ref={tagInputRef}
            style={styles.input}
            value={tag}
            onChangeText={setTag}
            placeholder="Enter tag (e.g., shopping, news, social)"
            placeholderTextColor={theme.textSubtle}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => tagInputRef.current?.blur()}
          />
        </View>

        {/* Folder Field */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Folder</Text>
          <FolderSelector
            selectedFolderId={folderId}
            onSelect={setFolderId}
          />
        </View>

        {/* Share Button */}
        <View style={styles.fieldContainer}>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShare}
            activeOpacity={0.7}
          >
            <Text style={styles.shareButtonText}>Share link</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaWrapper>
  );
};

/**
 * Styles for the EditLinkScreen component
 */
function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 40,
    },
    fieldContainer: {
      marginBottom: 18,
    },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.textMuted,
      marginBottom: 6,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    input: {
      borderRadius: radius.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.text,
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    inputDisabled: {
      backgroundColor: theme.inputBg,
      color: theme.textMuted,
      fontSize: 14,
    },
    textArea: {
      minHeight: 100,
      paddingTop: 12,
    },
    helpText: {
      fontSize: 12,
      color: theme.textSubtle,
      marginTop: 4,
    },
    headerButtonContainer: {
      marginRight: Platform.OS === "android" ? 0 : 4,
    },
    saveButton: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.primary,
    },
    shareButton: {
      backgroundColor: theme.primarySoft,
      borderRadius: radius.md,
      height: 50,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 8,
    },
    shareButtonText: {
      color: theme.primary,
      fontSize: 16,
      fontWeight: "700",
    },
  });
}
