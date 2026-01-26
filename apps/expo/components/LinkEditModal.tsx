/**
 * Link Edit Modal Component
 *
 * This modal appears when a link is shared to the app (if "allow editing before save" is enabled).
 * It allows users to edit link details before saving, with automatic metadata fetching.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { LinkData } from "../types/link";
import { fetchLinkMetadata } from "../services/metadata";
import { saveLink } from "../services/storage";
import { Toast } from "./Toast";

/**
 * Props for the LinkEditModal component
 *
 * @property visible - Whether the modal is visible
 * @property linkData - The initial link data to display
 * @property onClose - Callback function called when modal is closed
 * @property onSave - Callback function called after successful save
 */
interface LinkEditModalProps {
  visible: boolean;
  linkData: LinkData;
  onClose: () => void;
  onSave: () => void;
}

/**
 * LinkEditModal component for editing link details before saving
 *
 * @param visible - Whether the modal is visible
 * @param linkData - The initial link data
 * @param onClose - Callback when modal closes
 * @param onSave - Callback after save
 * @returns JSX.Element - The rendered modal component
 */
export const LinkEditModal: React.FC<LinkEditModalProps> = ({
  visible,
  linkData,
  onClose,
  onSave,
}) => {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";
  const [title, setTitle] = useState<string>(linkData.title || "");
  const [description, setDescription] = useState<string>(
    linkData.description || ""
  );
  const [image, setImage] = useState<string>(linkData.image || "");
  const [tag, setTag] = useState<string>(linkData.tag || "");
  const [fetchingMetadata, setFetchingMetadata] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>("");

  const descriptionInputRef = useRef<TextInput | null>(null);
  const imageInputRef = useRef<TextInput | null>(null);
  const tagInputRef = useRef<TextInput | null>(null);

  /**
   * Resets form fields when modal opens with new link data
   */
  useEffect(() => {
    if (visible) {
      setTitle(linkData.title || "");
      setDescription(linkData.description || "");
      setImage(linkData.image || "");
      setTag(linkData.tag || "");
      setFetchingMetadata(false);
      setSaving(false);
      setShowToast(false);

      // Auto-fetch metadata when modal opens
      fetchMetadata();
    }
  }, [visible, linkData.url]);

  /**
   * Fetches metadata from the API and populates form fields
   */
  const fetchMetadata = async () => {
    try {
      setFetchingMetadata(true);
      const fetchedMetadata = await fetchLinkMetadata(linkData.url);

      // Populate form fields with fetched metadata
      setTitle(fetchedMetadata.title || "");
      setDescription(fetchedMetadata.description || "");
      setImage(fetchedMetadata.image || "");
      setTag(fetchedMetadata.tag || "");
    } catch (error) {
      console.error("Error fetching metadata:", error);
      // Show toast error
      setToastMessage("Unable to fetch link details. Using default values.");
      setShowToast(true);
    } finally {
      setFetchingMetadata(false);
    }
  };

  /**
   * Handles saving the link with edited values
   */
  const handleSave = async () => {
    try {
      setSaving(true);

      // Prepare link data with edited values
      const updatedLinkData: LinkData = {
        ...linkData,
        title: title.trim() || null,
        description: description.trim() || null,
        image: image.trim() || null,
        tag: tag.trim() || null,
        metadataFetched: true,
      };

      // Save to storage
      await saveLink(updatedLinkData);

      // Call onSave callback to refresh the list
      onSave();

      // Close modal
      onClose();
    } catch (error) {
      console.error("Error saving link:", error);
      setToastMessage(
        error instanceof Error
          ? error.message
          : "Failed to save link. Please try again."
      );
      setShowToast(true);
    } finally {
      setSaving(false);
    }
  };

  const theme = {
    background: isDarkMode ? "#0b0b0c" : "#ffffff",
    surface: isDarkMode ? "#161718" : "#ffffff",
    text: isDarkMode ? "#f2f4f7" : "#000000",
    textMuted: isDarkMode ? "#c7c9ce" : "#666666",
    border: isDarkMode ? "#2a2c2f" : "#e0e0e0",
    backdrop: "rgba(0, 0, 0, 0.5)",
  };

  const styles = createStyles(theme);

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Link Details</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalContentWrapper}>
              <KeyboardAwareScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                enableOnAndroid
                keyboardShouldPersistTaps="handled"
              >
                {/* Loader overlay during metadata fetch */}
                {fetchingMetadata && (
                  <View style={styles.loaderOverlay}>
                    <ActivityIndicator size="large" color="#0066cc" />
                    <Text style={styles.loaderText}>Fetching metadata...</Text>
                  </View>
                )}

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
                    editable={!fetchingMetadata}
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
                    editable={!fetchingMetadata}
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
                    editable={!fetchingMetadata}
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
                    editable={!fetchingMetadata}
                  />
                </View>
              </KeyboardAwareScrollView>

              {/* Save Button - Positioned absolutely at bottom */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    (saving || fetchingMetadata) && styles.saveButtonDisabled,
                  ]}
                  onPress={handleSave}
                  disabled={saving || fetchingMetadata}
                  activeOpacity={0.7}
                >
                  {saving ? (
                    <View style={styles.buttonContent}>
                      <ActivityIndicator size="small" color="#ffffff" />
                      <Text style={[styles.saveButtonText, { marginLeft: 8 }]}>
                        Saving...
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Toast for error messages */}
      <Toast
        message={toastMessage}
        visible={showToast}
        onDismiss={() => setShowToast(false)}
      />
    </>
  );
};

/**
 * Styles for the LinkEditModal component
 */
function createStyles(theme: {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  backdrop: string;
}) {
  return StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.backdrop,
      justifyContent: "flex-end",
    },
    modalContainer: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "82%",
      minHeight: "70%",
      position: "relative",
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.text,
    },
    closeButton: {
      padding: 4,
    },
    closeButtonText: {
      fontSize: 24,
      color: theme.textMuted,
      fontWeight: "300",
    },
    modalContentWrapper: {
      flex: 1,
      position: "relative",
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingBottom: 100,
    },
    loaderOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(255, 255, 255, 0.9)",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10,
    },
    loaderText: {
      marginTop: 12,
      fontSize: 14,
      color: theme.textMuted,
    },
    fieldContainer: {
      marginBottom: 24,
    },
    label: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: theme.text,
      backgroundColor: theme.background,
    },
    inputDisabled: {
      backgroundColor: theme.background === "#0b0b0c" ? "#1a1a1a" : "#f5f5f5",
      color: theme.textMuted,
    },
    textArea: {
      minHeight: 100,
      paddingTop: 12,
    },
    helpText: {
      fontSize: 12,
      color: theme.textMuted,
      marginTop: 4,
    },
    buttonContainer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 16,
      backgroundColor: theme.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    saveButton: {
      backgroundColor: "#0066cc",
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    buttonContent: {
      flexDirection: "row",
      alignItems: "center",
    },
    saveButtonText: {
      color: "#ffffff",
      fontSize: 16,
      fontWeight: "600",
    },
  });
}
