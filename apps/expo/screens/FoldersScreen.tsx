/**
 * Folders Screen Component
 *
 * This screen displays all folders and allows users to create, edit, and delete folders.
 * Long-press any folder to enter reorder mode; drag via handle to reorder; tick to save.
 */

import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Swipeable } from "react-native-gesture-handler";
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from "react-native-draggable-flatlist";
import { SafeAreaWrapper } from "../components/SafeAreaWrapper";
import {
  getFolders,
  saveFolder,
  deleteFolder,
  reorderFolders,
} from "../services/folderStorage";
import { Folder } from "../types/folder";
import { Theme, radius, useThemedStyles } from "../utils/theme";

/**
 * Navigation param types
 */
type RootStackParamList = {
  Folders: undefined;
  FolderDetail: {
    folderId: string;
  };
};

type FoldersScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Folders"
>;

/** Drag handle icon - triple-line reorder indicator */
const DRAG_HANDLE_ICON = "≡";

/**
 * FoldersScreen component for managing folders
 */
export const FoldersScreen: React.FC = () => {
  const navigation = useNavigation<FoldersScreenNavigationProp>();
  const { theme, styles } = useThemedStyles(createStyles);

  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showCreateInput, setShowCreateInput] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>("");
  const [creating, setCreating] = useState<boolean>(false);
  const [isReorderMode, setIsReorderMode] = useState<boolean>(false);
  const [preReorderFolders, setPreReorderFolders] = useState<Folder[]>([]);
  const [folderToEdit, setFolderToEdit] = useState<Folder | null>(null);
  const [editFolderName, setEditFolderName] = useState<string>("");
  const swipeableRefs = useRef<Record<string, Swipeable | null>>({});

  /**
   * Loads all folders from storage.
   * Only the first load shows the spinner; refocus refreshes in place.
   */
  const loadFolders = useCallback(async () => {
    try {
      const allFolders = await getFolders();
      setFolders(allFolders);
    } catch (error) {
      console.error("Error loading folders:", error);
      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "Failed to load folders. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFolders();
    }, [loadFolders])
  );

  /**
   * Enters reorder mode - long-press on any folder
   */
  const enterReorderMode = useCallback(() => {
    setPreReorderFolders([...folders]);
    setIsReorderMode(true);
  }, [folders]);

  /**
   * Saves reorder and exits reorder mode
   */
  const handleReorderDone = useCallback(async () => {
    try {
      const folderIds = folders.map((f) => f.id);
      await reorderFolders(folderIds);
      setIsReorderMode(false);
    } catch (error) {
      console.error("Error saving folder order:", error);
      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "Failed to save folder order. Please try again."
      );
    }
  }, [folders]);

  /**
   * Discards reorder changes and exits reorder mode
   */
  const handleReorderCancel = useCallback(() => {
    setFolders([...preReorderFolders]);
    setIsReorderMode(false);
  }, [preReorderFolders]);

  /**
   * Handles creating a new folder
   */
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      Alert.alert("Error", "Folder name cannot be empty");
      return;
    }

    try {
      setCreating(true);
      await saveFolder({
        name: newFolderName.trim(),
        isPublic: false,
      });
      setNewFolderName("");
      setShowCreateInput(false);
      await loadFolders();
    } catch (error) {
      console.error("Error creating folder:", error);
      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "Failed to create folder. Please try again."
      );
    } finally {
      setCreating(false);
    }
  };

  /**
   * Opens the edit-folder modal for the given folder and closes the swipe row
   */
  const handleOpenEditFolder = useCallback((folder: Folder) => {
    swipeableRefs.current[folder.id]?.close();
    setFolderToEdit(folder);
    setEditFolderName(folder.name);
  }, []);

  /**
   * Closes the edit-folder modal without saving
   */
  const handleCloseEditFolder = useCallback(() => {
    setFolderToEdit(null);
    setEditFolderName("");
  }, []);

  /**
   * Saves the edited folder name and closes the modal
   */
  const handleSaveEditFolder = useCallback(async () => {
    if (!folderToEdit) return;
    const trimmed = editFolderName.trim();
    if (!trimmed || trimmed === folderToEdit.name) return;
    try {
      await saveFolder({
        id: folderToEdit.id,
        name: trimmed,
        isPublic: folderToEdit.isPublic,
      });
      await loadFolders();
      handleCloseEditFolder();
    } catch (error) {
      console.error("Error renaming folder:", error);
      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "Failed to rename folder. Please try again."
      );
    }
  }, [folderToEdit, editFolderName, loadFolders, handleCloseEditFolder]);

  /**
   * Handles deleting a folder
   */
  const handleDeleteFolder = async (folder: Folder) => {
    Alert.alert(
      "Delete Folder",
      `Are you sure you want to delete "${folder.name}"? Links in this folder will not be deleted, but will no longer be assigned to a folder.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteFolder(folder.id);
              await loadFolders();
            } catch (error) {
              console.error("Error deleting folder:", error);
              Alert.alert(
                "Error",
                error instanceof Error
                  ? error.message
                  : "Failed to delete folder. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  /**
   * Renders folder row content (shared between normal and reorder modes)
   */
  const renderFolderContent = (item: Folder) => (
    <>
      <View style={styles.folderIconContainer}>
        <Text style={styles.folderIcon}>📁</Text>
      </View>
      <View style={styles.folderContent}>
        <Text style={styles.folderName}>{item.name}</Text>
        <View style={styles.folderMeta}>
          <Text style={styles.folderLinkCount}>
            {item.linkCount || 0}{" "}
            {item.linkCount === 1 ? "link" : "links"}
          </Text>
          {item.isPublic && (
            <View style={styles.publicBadge}>
              <Text style={styles.publicBadgeText}>Public</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.folderCheckmark}>
        {item.isPublic && (
          <Text style={styles.checkmarkIcon}>✓</Text>
        )}
      </View>
    </>
  );

  /**
   * Renders a folder item in normal mode (FlatList with Swipeable)
   */
  const renderNormalFolderItem = ({
    item,
  }: {
    item: Folder;
    index: number;
  }) => {
    const renderRightActions = () => (
      <View style={styles.swipeDeleteContainer}>
        <TouchableOpacity
          style={styles.swipeDeleteButton}
          onPress={() => handleDeleteFolder(item)}
        >
          <Text style={styles.swipeDeleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );

    const renderLeftActions = () => (
      <View style={styles.swipeEditContainer}>
        <TouchableOpacity
          style={styles.swipeEditButton}
          onPress={() => handleOpenEditFolder(item)}
        >
          <Text style={styles.swipeEditText}>Edit</Text>
        </TouchableOpacity>
      </View>
    );

    return (
      <Swipeable
        ref={(ref) => {
          swipeableRefs.current[item.id] = ref;
        }}
        renderRightActions={renderRightActions}
        renderLeftActions={renderLeftActions}
      >
        <TouchableOpacity
          style={styles.folderItem}
          activeOpacity={0.7}
          onLongPress={enterReorderMode}
          onPress={() =>
            navigation.navigate("FolderDetail", { folderId: item.id })
          }
        >
          {renderFolderContent(item)}
        </TouchableOpacity>
      </Swipeable>
    );
  };

  /**
   * Renders a folder item in reorder mode (DraggableFlatList with drag handle)
   */
  const renderReorderFolderItem = ({
    item,
    drag,
    isActive,
  }: RenderItemParams<Folder>) => (
    <ScaleDecorator>
      <View style={[styles.folderItem, isActive && styles.folderItemActive]}>
        <TouchableOpacity
          style={styles.dragHandle}
          onLongPress={drag}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.dragHandleIcon}>{DRAG_HANDLE_ICON}</Text>
        </TouchableOpacity>
        {renderFolderContent(item)}
      </View>
    </ScaleDecorator>
  );

  /**
   * Renders the empty state when no folders exist
   */
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📁</Text>
      <Text style={styles.emptyText}>No folders yet</Text>
      <Text style={styles.emptySubtext}>
        Create a folder to organize your links
      </Text>
    </View>
  );

  return (
    <SafeAreaWrapper edges={["bottom", "left", "right"]}>
      <View style={styles.container}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <>
            {/* Conditional Header */}
            {isReorderMode ? (
              <View style={styles.reorderHeader}>
                <TouchableOpacity
                  style={styles.reorderCancelButton}
                  onPress={handleReorderCancel}
                >
                  <Text style={styles.reorderCancelText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.reorderHint}>Drag to reorder</Text>
                <TouchableOpacity
                  style={styles.reorderDoneButton}
                  onPress={handleReorderDone}
                >
                  <Text style={styles.reorderDoneIcon}>✓</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {showCreateInput && (
                  <View style={styles.createInputContainer}>
                    <TextInput
                      style={styles.createInput}
                      placeholder="Folder name"
                      placeholderTextColor={theme.textMuted}
                      value={newFolderName}
                      onChangeText={setNewFolderName}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={handleCreateFolder}
                      editable={!creating}
                    />
                    <View style={styles.createButtonContainer}>
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => {
                          setShowCreateInput(false);
                          setNewFolderName("");
                        }}
                        disabled={creating}
                      >
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.createButton,
                          creating && styles.createButtonDisabled,
                        ]}
                        onPress={handleCreateFolder}
                        disabled={creating || !newFolderName.trim()}
                      >
                        {creating ? (
                          <ActivityIndicator size="small" color={theme.onPrimary} />
                        ) : (
                          <Text style={styles.createButtonText}>Create</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                {!showCreateInput && (
                  <TouchableOpacity
                    style={styles.addFolderButton}
                    onPress={() => setShowCreateInput(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.addFolderButtonText}>
                      + Create Folder
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* Folders List */}
            {isReorderMode ? (
              <DraggableFlatList<Folder>
                data={folders}
                keyExtractor={(item: Folder) => item.id}
                renderItem={renderReorderFolderItem}
                onDragEnd={({ data }: { data: Folder[] }) => setFolders(data)}
                ListEmptyComponent={renderEmptyState}
                contentContainerStyle={
                  folders.length === 0
                    ? styles.emptyListContainer
                    : styles.listContainer
                }
              />
            ) : (
              <FlatList
                data={folders}
                keyExtractor={(item: Folder) => item.id}
                renderItem={renderNormalFolderItem}
                ListEmptyComponent={renderEmptyState}
                contentContainerStyle={
                  folders.length === 0
                    ? styles.emptyListContainer
                    : styles.listContainer
                }
                showsVerticalScrollIndicator={true}
              />
            )}
          </>
        )}

        {/* Edit folder name modal */}
        <Modal
          visible={folderToEdit !== null}
          transparent
          onRequestClose={handleCloseEditFolder}
          animationType="fade"
          statusBarTranslucent
        >
          <Pressable
            style={styles.editModalOverlay}
            onPress={handleCloseEditFolder}
          >
            <Pressable
              style={styles.editModalCard}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={styles.editModalTitle}>Rename folder</Text>
              <TextInput
                style={styles.editModalInput}
                placeholder="Folder name"
                placeholderTextColor={theme.textMuted}
                value={editFolderName}
                onChangeText={setEditFolderName}
                returnKeyType="done"
                onSubmitEditing={handleSaveEditFolder}
                autoFocus
                editable={!!folderToEdit}
              />
              <View style={styles.editModalButtonRow}>
                <TouchableOpacity
                  style={styles.editModalCancelButton}
                  onPress={handleCloseEditFolder}
                >
                  <Text style={styles.editModalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.editModalSaveButton,
                    (!editFolderName.trim() ||
                      editFolderName.trim() === folderToEdit?.name) &&
                      styles.editModalSaveButtonDisabled,
                  ]}
                  onPress={handleSaveEditFolder}
                  disabled={
                    !editFolderName.trim() ||
                    editFolderName.trim() === folderToEdit?.name
                  }
                >
                  <Text
                    style={[
                      styles.editModalSaveText,
                      (!editFolderName.trim() ||
                        editFolderName.trim() === folderToEdit?.name) &&
                        styles.editModalSaveTextDisabled,
                    ]}
                  >
                    Save
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </SafeAreaWrapper>
  );
};

/**
 * Styles for the FoldersScreen component
 */
function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    reorderHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      backgroundColor: theme.surface,
    },
    reorderCancelButton: {
      paddingVertical: 8,
      paddingHorizontal: 4,
      minWidth: 60,
    },
    reorderCancelText: {
      fontSize: 16,
      color: theme.textMuted,
    },
    reorderHint: {
      fontSize: 14,
      color: theme.textMuted,
    },
    reorderDoneButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    reorderDoneIcon: {
      fontSize: 24,
      color: "#ffffff",
      fontWeight: "bold",
    },
    createInputContainer: {
      margin: 16,
      marginBottom: 8,
      padding: 12,
      borderRadius: radius.md,
      backgroundColor: theme.surface,
    },
    createInput: {
      borderRadius: radius.sm,
      padding: 12,
      fontSize: 16,
      color: theme.text,
      backgroundColor: theme.inputBg,
      marginBottom: 12,
    },
    createButtonContainer: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 12,
    },
    cancelButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    cancelButtonText: {
      fontSize: 16,
      color: theme.textMuted,
    },
    createButton: {
      backgroundColor: theme.primary,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    createButtonDisabled: {
      opacity: 0.6,
    },
    createButtonText: {
      fontSize: 16,
      color: "#ffffff",
      fontWeight: "600",
    },
    addFolderButton: {
      marginTop: 12,
      marginHorizontal: 16,
      marginBottom: 8,
      height: 48,
      justifyContent: "center",
      backgroundColor: theme.primarySoft,
      borderRadius: radius.md,
      alignItems: "center",
    },
    addFolderButtonText: {
      fontSize: 16,
      color: theme.primary,
      fontWeight: "600",
    },
    listContainer: {
      paddingTop: 4,
      paddingBottom: 80,
    },
    emptyListContainer: {
      flexGrow: 1,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
    },
    emptyIcon: {
      fontSize: 64,
      marginBottom: 16,
    },
    emptyText: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.text,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: theme.textMuted,
      textAlign: "center",
    },
    folderItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginHorizontal: 16,
      marginVertical: 5,
      borderRadius: radius.md,
      backgroundColor: theme.card,
      borderWidth: theme.isDark ? StyleSheet.hairlineWidth : 0,
      borderColor: theme.border,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: theme.isDark ? 0 : 0.05,
      shadowRadius: 6,
      elevation: theme.isDark ? 0 : 1,
    },
    folderItemActive: {
      opacity: 0.95,
      shadowOpacity: 0.2,
      elevation: 8,
    },
    dragHandle: {
      width: 44,
      height: 44,
      justifyContent: "center",
      alignItems: "center",
      marginLeft: -8,
      marginRight: 8,
    },
    dragHandleIcon: {
      fontSize: 24,
      color: theme.textMuted,
      fontWeight: "bold",
    },
    folderIconContainer: {
      marginRight: 16,
    },
    folderIcon: {
      fontSize: 28,
    },
    folderContent: {
      flex: 1,
    },
    folderName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 4,
    },
    folderMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    folderLinkCount: {
      fontSize: 14,
      color: theme.textMuted,
    },
    publicBadge: {
      backgroundColor: theme.chipBg,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    publicBadgeText: {
      fontSize: 10,
      color: theme.textMuted,
      fontWeight: "600",
    },
    folderCheckmark: {
      width: 24,
      alignItems: "center",
    },
    checkmarkIcon: {
      fontSize: 18,
      color: theme.primary,
      fontWeight: "bold",
    },
    swipeDeleteContainer: {
      backgroundColor: theme.errorBg,
      justifyContent: "center",
      alignItems: "flex-end",
      paddingHorizontal: 20,
      marginVertical: 5,
      marginHorizontal: 16,
      borderRadius: radius.md,
      overflow: "hidden",
    },
    swipeDeleteButton: {
      justifyContent: "center",
      alignItems: "center",
      height: "100%",
    },
    swipeDeleteText: {
      color: "#ffffff",
      fontWeight: "700",
      fontSize: 16,
    },
    swipeEditContainer: {
      backgroundColor: theme.primary,
      justifyContent: "center",
      alignItems: "flex-start",
      paddingHorizontal: 20,
      marginVertical: 5,
      marginHorizontal: 16,
      borderRadius: radius.md,
      overflow: "hidden",
    },
    swipeEditButton: {
      justifyContent: "center",
      alignItems: "center",
      height: "100%",
    },
    swipeEditText: {
      color: "#ffffff",
      fontWeight: "700",
      fontSize: 16,
    },
    editModalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 16,
    },
    editModalCard: {
      width: "100%",
      maxWidth: 420,
      backgroundColor: theme.surface,
      borderRadius: radius.lg,
      padding: 20,
    },
    editModalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 12,
    },
    editModalInput: {
      borderRadius: radius.sm,
      padding: 12,
      fontSize: 16,
      color: theme.text,
      backgroundColor: theme.inputBg,
      marginBottom: 16,
    },
    editModalButtonRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 12,
    },
    editModalCancelButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    editModalCancelText: {
      fontSize: 16,
      color: theme.textMuted,
    },
    editModalSaveButton: {
      backgroundColor: theme.primary,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    editModalSaveButtonDisabled: {
      opacity: 0.6,
    },
    editModalSaveText: {
      fontSize: 16,
      color: "#ffffff",
      fontWeight: "600",
    },
    editModalSaveTextDisabled: {
      color: "rgba(255, 255, 255, 0.8)",
    },
  });
}
