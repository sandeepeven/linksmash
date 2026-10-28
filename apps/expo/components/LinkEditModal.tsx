/**
 * Link Edit Modal Component
 *
 * This modal appears when a link is shared to the app (if "allow editing before save" is enabled).
 * It allows users to edit link details before saving, with automatic metadata fetching.
 * Fields stay editable while metadata loads, and fetched values never overwrite
 * anything the user has already typed.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  Platform,
  Dimensions,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { LinkData } from "../types/link";
import { fetchLinkMetadata } from "../services/metadata";
import { saveLink } from "../services/storage";
import { Toast } from "./Toast";
import { FolderSelector } from "./FolderSelector";
import { Theme, radius, useThemedStyles } from "../utils/theme";

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

type EditableField = "title" | "description" | "image" | "tag";

const SCREEN_HEIGHT = Dimensions.get("window").height;

/**
 * LinkEditModal component for editing link details before saving
 *
 * @returns JSX.Element - The rendered modal component
 */
export const LinkEditModal: React.FC<LinkEditModalProps> = ({
  visible,
  linkData,
  onClose,
  onSave,
}) => {
  const { theme, styles } = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState<string>(linkData.title || "");
  const [description, setDescription] = useState<string>(
    linkData.description || ""
  );
  const [image, setImage] = useState<string>(linkData.image || "");
  const [tag, setTag] = useState<string>(linkData.tag || "");
  const [folderId, setFolderId] = useState<string | null>(
    linkData.folderId || null
  );
  const [fetchingMetadata, setFetchingMetadata] = useState<boolean>(false);
  const [metadataFetched, setMetadataFetched] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>("");

  const descriptionInputRef = useRef<TextInput | null>(null);
  const imageInputRef = useRef<TextInput | null>(null);
  const tagInputRef = useRef<TextInput | null>(null);
  const editedFieldsRef = useRef<Set<EditableField>>(new Set());
  const closingRef = useRef(false);

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  /**
   * Wraps a setter so we remember the user touched this field
   */
  const editField =
    (field: EditableField, setter: (value: string) => void) =>
    (value: string) => {
      editedFieldsRef.current.add(field);
      setter(value);
    };

  /**
   * Fetches metadata and fills in fields the user hasn't edited yet
   */
  const fetchMetadata = useCallback(
    async (isActive: () => boolean) => {
      // Validate that linkData has a valid URL before fetching
      if (!linkData || !linkData.url || linkData.url.trim() === "") {
        console.warn("Cannot fetch metadata: invalid or missing URL");
        return;
      }

      try {
        setFetchingMetadata(true);
        const fetchedMetadata = await fetchLinkMetadata(linkData.url);
        if (!isActive()) return;

        const edited = editedFieldsRef.current;
        if (fetchedMetadata.title && !edited.has("title")) {
          setTitle(fetchedMetadata.title);
        }
        if (fetchedMetadata.description && !edited.has("description")) {
          setDescription(fetchedMetadata.description);
        }
        if (fetchedMetadata.image && !edited.has("image")) {
          setImage(fetchedMetadata.image);
        }
        if (fetchedMetadata.tag && !edited.has("tag")) {
          setTag(fetchedMetadata.tag);
        }
        setMetadataFetched(true);
      } catch (error) {
        console.error("Error fetching metadata:", error);
        if (!isActive()) return;
        setToastMessage("Couldn't fetch link details — you can still save.");
        setShowToast(true);
      } finally {
        if (isActive()) setFetchingMetadata(false);
      }
    },
    [linkData.url]
  );

  /**
   * Resets form fields when modal opens with new link data
   */
  useEffect(() => {
    if (!visible || !linkData || !linkData.url) return;
    let active = true;

    // Initialize form fields from linkData
    setTitle(linkData.title || "");
    setDescription(linkData.description || "");
    setImage(linkData.image || "");
    setTag(linkData.tag || "");
    setFolderId(linkData.folderId || null);
    setMetadataFetched(false);
    setSaving(false);
    setShowToast(false);
    editedFieldsRef.current = new Set();
    closingRef.current = false;

    // Auto-fetch metadata when modal opens
    fetchMetadata(() => active);
    return () => {
      active = false;
    };
  }, [visible, linkData.url, fetchMetadata]);

  /**
   * Animate the sheet in when shown
   */
  useEffect(() => {
    if (!visible) return;
    backdropOpacity.setValue(0);
    sheetTranslateY.setValue(SCREEN_HEIGHT);
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 210,
        mass: 0.9,
      }),
    ]).start();
  }, [visible, linkData.url, backdropOpacity, sheetTranslateY]);

  /**
   * Animate out, then notify the parent
   */
  const animateClose = useCallback(
    (after?: () => void) => {
      if (closingRef.current) return;
      closingRef.current = true;
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: SCREEN_HEIGHT,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        after?.();
        onClose();
      });
    },
    [backdropOpacity, sheetTranslateY, onClose]
  );

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
        folderId: folderId,
        // If the fetch hasn't finished and nothing was edited, let the card
        // fetch it later; otherwise never overwrite the user's edits.
        metadataFetched: metadataFetched || editedFieldsRef.current.size > 0,
      };

      // Save to storage
      await saveLink(updatedLinkData);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );

      // Close modal, then refresh the list
      animateClose(onSave);
    } catch (error) {
      console.error("Error saving link:", error);
      setToastMessage(
        error instanceof Error
          ? error.message
          : "Failed to save link. Please try again."
      );
      setShowToast(true);
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      statusBarTranslucent
      onRequestClose={() => animateClose()}
    >
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => animateClose()}
            accessibilityLabel="Dismiss"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.modalContainer,
            { transform: [{ translateY: sheetTranslateY }] },
          ]}
        >
          <View style={styles.grabber} />
          <View style={styles.modalHeader}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.modalTitle}>Save link</Text>
              <View style={styles.statusRow}>
                {fetchingMetadata ? (
                  <>
                    <ActivityIndicator size="small" color={theme.primary} />
                    <Text style={styles.statusText}>Fetching details…</Text>
                  </>
                ) : (
                  <Text style={styles.statusText} numberOfLines={1}>
                    {linkData.url}
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity
              onPress={() => animateClose()}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Close"
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <KeyboardAwareScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            enableOnAndroid
            extraScrollHeight={Platform.OS === "ios" ? 24 : 80}
            keyboardShouldPersistTaps="handled"
          >
            {/* Title Field */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={editField("title", setTitle)}
                placeholder={fetchingMetadata ? "Loading…" : "Enter title"}
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
                onChangeText={editField("description", setDescription)}
                placeholder={
                  fetchingMetadata ? "Loading…" : "Enter description"
                }
                placeholderTextColor={theme.textSubtle}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                autoCapitalize="sentences"
                autoCorrect={true}
              />
            </View>

            {/* Tag Field */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Tag</Text>
              <TextInput
                ref={tagInputRef}
                style={styles.input}
                value={tag}
                onChangeText={editField("tag", setTag)}
                placeholder="e.g. shopping, news, social"
                placeholderTextColor={theme.textSubtle}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => imageInputRef.current?.focus()}
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

            {/* Image URL Field */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Image URL</Text>
              <TextInput
                ref={imageInputRef}
                style={styles.input}
                value={image}
                onChangeText={editField("image", setImage)}
                placeholder="https://…"
                placeholderTextColor={theme.textSubtle}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="done"
              />
            </View>
          </KeyboardAwareScrollView>

          {/* Save Button */}
          <View
            style={[
              styles.buttonContainer,
              { paddingBottom: Math.max(insets.bottom, 12) + 4 },
            ]}
          >
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color={theme.onPrimary} />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Toast inside the Modal so it renders above the sheet */}
        <Toast
          message={toastMessage}
          visible={showToast}
          onDismiss={() => setShowToast(false)}
          bottomOffset={96}
        />
      </View>
    </Modal>
  );
};

/**
 * Styles for the LinkEditModal component
 */
function createStyles(theme: Theme) {
  return StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: "flex-end",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.backdrop,
    },
    modalContainer: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      height: "82%",
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 16,
    },
    grabber: {
      alignSelf: "center",
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.border,
      marginTop: 8,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 14,
    },
    headerTextWrap: {
      flex: 1,
      marginRight: 12,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.text,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 4,
      minHeight: 20,
    },
    statusText: {
      flexShrink: 1,
      fontSize: 13,
      color: theme.textMuted,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.inputBg,
      justifyContent: "center",
      alignItems: "center",
    },
    closeButtonText: {
      fontSize: 14,
      color: theme.textMuted,
      fontWeight: "700",
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    fieldContainer: {
      marginBottom: 16,
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
      backgroundColor: theme.inputBg,
    },
    textArea: {
      minHeight: 96,
      paddingTop: 12,
    },
    buttonContainer: {
      paddingHorizontal: 20,
      paddingTop: 10,
      backgroundColor: theme.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    saveButton: {
      backgroundColor: theme.primary,
      borderRadius: radius.md,
      height: 50,
      alignItems: "center",
      justifyContent: "center",
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      color: theme.onPrimary,
      fontSize: 16,
      fontWeight: "700",
    },
  });
}
