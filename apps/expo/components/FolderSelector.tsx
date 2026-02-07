/**
 * Folder Selector Component
 *
 * This component provides a dropdown/picker interface for selecting a folder
 * to assign to a link. Used in EditLinkScreen and LinkEditModal.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  useColorScheme,
} from "react-native";
import { Folder } from "../types/folder";
import { getFolders } from "../services/folderStorage";
import { createTheme } from "../utils/theme";

/**
 * Props for the FolderSelector component
 *
 * @property selectedFolderId - The currently selected folder ID (or null for "None")
 * @property onSelect - Callback function called when a folder is selected
 */
interface FolderSelectorProps {
  selectedFolderId: string | null;
  onSelect: (folderId: string | null) => void;
}

/**
 * FolderSelector component for selecting/assigning folders
 *
 * @param selectedFolderId - The currently selected folder ID
 * @param onSelect - Callback when folder is selected
 * @returns JSX.Element - The rendered folder selector component
 */
export const FolderSelector: React.FC<FolderSelectorProps> = ({
  selectedFolderId,
  onSelect,
}) => {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";
  const theme = createTheme(isDarkMode);
  const styles = createStyles(theme);

  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  /**
   * Loads all folders from storage
   */
  useEffect(() => {
    const loadFolders = async () => {
      try {
        setLoading(true);
        const allFolders = await getFolders();
        // Sort by name alphabetically
        const sortedFolders = allFolders.sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        setFolders(sortedFolders);
      } catch (error) {
        console.error("Error loading folders:", error);
      } finally {
        setLoading(false);
      }
    };

    loadFolders();
  }, []);

  /**
   * Gets the display name for the selected folder
   */
  const getSelectedFolderName = (): string => {
    if (!selectedFolderId) {
      return "None";
    }
    const folder = folders.find((f) => f.id === selectedFolderId);
    return folder ? folder.name : "None";
  };

  /**
   * Handles folder selection
   */
  const handleSelect = (folderId: string | null) => {
    onSelect(folderId);
    setModalVisible(false);
  };

  /**
   * Renders a folder option in the modal
   */
  const renderFolderOption = ({ item }: { item: Folder }) => {
    const isSelected = item.id === selectedFolderId;
    return (
      <TouchableOpacity
        style={[styles.optionItem, isSelected && styles.optionItemSelected]}
        onPress={() => handleSelect(item.id)}
        activeOpacity={0.7}
      >
        <Text style={styles.optionIcon}>📁</Text>
        <Text
          style={[
            styles.optionText,
            isSelected && styles.optionTextSelected,
          ]}
        >
          {item.name}
        </Text>
        {isSelected && (
          <Text style={styles.checkmarkIcon}>✓</Text>
        )}
      </TouchableOpacity>
    );
  };

  /**
   * Renders the "None" option
   */
  const renderNoneOption = () => {
    const isSelected = selectedFolderId === null;
    return (
      <TouchableOpacity
        style={[styles.optionItem, isSelected && styles.optionItemSelected]}
        onPress={() => handleSelect(null)}
        activeOpacity={0.7}
      >
        <Text style={styles.optionText}>None</Text>
        {isSelected && (
          <Text style={styles.checkmarkIcon}>✓</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <>
      <TouchableOpacity
        style={styles.selectorButton}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.selectorButtonText}>{getSelectedFolderName()}</Text>
        <Text style={styles.selectorArrow}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Folder</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={folders}
              keyExtractor={(item) => item.id}
              renderItem={renderFolderOption}
              ListHeaderComponent={renderNoneOption}
              contentContainerStyle={styles.optionsList}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No folders available</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </>
  );
};

/**
 * Styles for the FolderSelector component
 */
function createStyles(theme: ReturnType<typeof createTheme>) {
  return StyleSheet.create({
    selectorButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 12,
      backgroundColor: theme.background,
    },
    selectorButtonText: {
      fontSize: 16,
      color: theme.text,
    },
    selectorArrow: {
      fontSize: 12,
      color: theme.textMuted,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    modalContainer: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "70%",
      minHeight: "50%",
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
    optionsList: {
      paddingVertical: 8,
    },
    optionItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    optionItemSelected: {
      backgroundColor: theme.chipBg,
    },
    optionIcon: {
      fontSize: 20,
      marginRight: 12,
    },
    optionText: {
      flex: 1,
      fontSize: 16,
      color: theme.text,
    },
    optionTextSelected: {
      fontWeight: "600",
      color: "#0066cc",
    },
    checkmarkIcon: {
      fontSize: 18,
      color: "#0066cc",
      fontWeight: "bold",
    },
    emptyContainer: {
      padding: 32,
      alignItems: "center",
    },
    emptyText: {
      fontSize: 16,
      color: theme.textMuted,
    },
  });
}

