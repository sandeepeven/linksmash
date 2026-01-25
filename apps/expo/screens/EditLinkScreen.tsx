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
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { updateLink } from "../services/storage";
import { LinkData } from "../types/link";
import { SafeAreaWrapper } from "../components/SafeAreaWrapper";

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

  const descriptionInputRef = useRef<TextInput | null>(null);
  const imageInputRef = useRef<TextInput | null>(null);
  const tagInputRef = useRef<TextInput | null>(null);

  const [title, setTitle] = useState<string>(linkData.title || "");
  const [description, setDescription] = useState<string>(
    linkData.description || ""
  );
  const [image, setImage] = useState<string>(linkData.image || "");
  const [tag, setTag] = useState<string>(linkData.tag || "");
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
            <ActivityIndicator size="small" color="#0066cc" />
          ) : (
            <Text style={styles.saveButton} onPress={handleSave}>
              Save
            </Text>
          )}
        </View>
      ),
    });
  }, [navigation, title, description, image, tag, saving]);

  return (
    <SafeAreaWrapper style={styles.safeArea}>
      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        enableOnAndroid
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={200}
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
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => tagInputRef.current?.blur()}
          />
        </View>

        {/* Share Button */}
        <View style={styles.fieldContainer}>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShare}
            activeOpacity={0.7}
          >
            <Text style={styles.shareButtonText}>SHARE</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaWrapper>
  );
};

/**
 * Styles for the EditLinkScreen component
 */
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    paddingHorizontal: 16,
    marginBottom: 200,
  },
  fieldContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cccccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#000000",
    backgroundColor: "#ffffff",
  },
  inputDisabled: {
    backgroundColor: "#f5f5f5",
    color: "#666666",
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  helpText: {
    fontSize: 12,
    color: "#999999",
    marginTop: 4,
  },
  headerButtonContainer: {
    marginRight: 16,
  },
  saveButton: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0066cc",
  },
  shareButton: {
    backgroundColor: "#0066cc",
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  shareButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
