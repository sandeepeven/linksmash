/**
 * Folder Detail Screen Component
 *
 * This screen displays all links belonging to a specific folder.
 * Similar to HomeScreen but filtered by folderId.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Platform,
  ListRenderItem,
} from "react-native";
import { useNavigation, useRoute, RouteProp, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaWrapper } from "../components/SafeAreaWrapper";
import { LINK_ROW_HEIGHT } from "../components/LinkCard";
import { SwipeableLinkRow } from "../components/SwipeableLinkRow";
import { useToast } from "../components/Toast";
import { getLinks, deleteLink, saveLink } from "../services/storage";
import { getFolder, getFolders } from "../services/folderStorage";
import { LinkData } from "../types/link";
import { Folder } from "../types/folder";
import { Theme, radius, useThemedStyles } from "../utils/theme";

/**
 * Navigation param types
 */
type RootStackParamList = {
  FolderDetail: {
    folderId: string;
  };
  EditLink: {
    linkData: LinkData;
  };
};

type FolderDetailScreenRouteProp = RouteProp<RootStackParamList, "FolderDetail">;
type FolderDetailScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "FolderDetail"
>;

const getItemLayout = (_: unknown, index: number) => ({
  length: LINK_ROW_HEIGHT,
  offset: LINK_ROW_HEIGHT * index,
  index,
});

const keyExtractor = (item: LinkData) => item.url;

/**
 * Gets display name for a folder, handling untitled folders
 *
 * @param folder - The folder to get display name for
 * @param allFolders - All folders to check for untitled naming
 * @returns string - Display name for the folder
 */
function getFolderDisplayName(folder: Folder, allFolders: Folder[]): string {
  if (folder.name && folder.name.trim() !== "") {
    return folder.name;
  }

  // Find all untitled folders and sort by creation date
  const untitledFolders = allFolders
    .filter((f) => !f.name || f.name.trim() === "")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const index = untitledFolders.findIndex((f) => f.id === folder.id);

  if (index === 0) {
    return "Untitled Folder";
  }

  return `Untitled Folder ${index + 1}`;
}

/**
 * FolderDetailScreen component for displaying links in a folder
 */
export const FolderDetailScreen: React.FC = () => {
  const navigation = useNavigation<FolderDetailScreenNavigationProp>();
  const route = useRoute<FolderDetailScreenRouteProp>();
  const { folderId } = route.params;

  const { theme, styles } = useThemedStyles(createStyles);
  const toast = useToast();

  const [links, setLinks] = useState<LinkData[]>([]);
  const [folder, setFolder] = useState<Folder | null>(null);
  const [allFolders, setAllFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  /**
   * Loads folder and links data.
   * Only the first load shows the spinner; refocus refreshes in place.
   */
  const loadData = useCallback(async () => {
    try {
      setError(null);

      // Load folder, all folders (for display name) and links in parallel
      const [folderData, allFoldersData, allLinks] = await Promise.all([
        getFolder(folderId),
        getFolders(),
        getLinks(),
      ]);

      if (!folderData) {
        setError("Folder not found");
        return;
      }

      setFolder(folderData);
      setAllFolders(allFoldersData);

      // Filter by folderId and sort by creation date (newest first)
      const sortedLinks = allLinks
        .filter((link) => link.folderId === folderId)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

      setLinks(sortedLinks);
    } catch (error) {
      console.error("Error loading folder data:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to load folder data"
      );
    } finally {
      setLoading(false);
    }
  }, [folderId]);

  /**
   * Reload data when screen comes into focus
   */
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  /**
   * Handles pull-to-refresh
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  /**
   * Filtered links based on search query
   */
  const filteredLinks = useMemo(() => {
    if (!searchQuery.trim()) {
      return links;
    }

    const query = searchQuery.toLowerCase().trim();
    return links.filter((link) => {
      const titleMatch = link.title?.toLowerCase().includes(query);
      const descriptionMatch = link.description?.toLowerCase().includes(query);
      const urlMatch = link.url.toLowerCase().includes(query);
      const tagMatch = link.tag?.toLowerCase().includes(query);
      return titleMatch || descriptionMatch || urlMatch || tagMatch;
    });
  }, [links, searchQuery]);

  /**
   * Folder display name
   */
  const folderDisplayName = useMemo(() => {
    if (!folder || !allFolders.length) {
      return "Untitled Folder";
    }
    return getFolderDisplayName(folder, allFolders);
  }, [folder, allFolders]);

  /**
   * Set header title
   */
  useEffect(() => {
    navigation.setOptions({
      title: folderDisplayName,
    });
  }, [navigation, folderDisplayName]);

  /**
   * Create folder map for LinkCard
   */
  const folderMap = useMemo(() => {
    const map = new Map<string, string>();
    allFolders.forEach((f) => {
      map.set(f.id, f.name);
    });
    return map;
  }, [allFolders]);

  const handleDeleteLink = useCallback(
    async (link: LinkData) => {
      setLinks((current) => current.filter((l) => l.url !== link.url));
      try {
        await deleteLink(link.url);
        toast.show("Link deleted", {
          actionLabel: "Undo",
          onAction: async () => {
            try {
              await saveLink(link);
            } finally {
              loadData();
            }
          },
        });
      } catch (e) {
        console.error("Failed to delete link:", e);
        toast.show("Failed to delete link");
        loadData();
      }
    },
    [loadData, toast]
  );

  const handleShareLink = useCallback(
    async (link: LinkData) => {
      try {
        await Share.share({ message: link.url });
      } catch (e) {
        console.error("Failed to share link:", e);
        toast.show("Failed to share link");
      }
    },
    [toast]
  );

  const handleMetadataFetched = useCallback(
    (url: string, patch: Partial<LinkData>) => {
      setLinks((current) =>
        current.map((link) => (link.url === url ? { ...link, ...patch } : link))
      );
    },
    []
  );

  const renderItem: ListRenderItem<LinkData> = useCallback(
    ({ item }) => (
      <SwipeableLinkRow
        linkData={item}
        folderName={item.folderId ? folderMap.get(item.folderId) || null : null}
        onDelete={handleDeleteLink}
        onShare={handleShareLink}
        onMetadataFetched={handleMetadataFetched}
      />
    ),
    [folderMap, handleDeleteLink, handleShareLink, handleMetadataFetched]
  );

  /**
   * Renders empty state
   */
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>{searchQuery.trim() ? "🔍" : "📂"}</Text>
      <Text style={styles.emptyText}>
        {searchQuery.trim() ? "No matching links" : "No links in this folder"}
      </Text>
      <Text style={styles.emptySubtext}>
        {searchQuery.trim()
          ? "Try a different search"
          : "Long-press a link and pick this folder to add it here"}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaWrapper edges={["bottom", "left", "right"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaWrapper>
    );
  }

  if (error) {
    return (
      <SafeAreaWrapper edges={["bottom", "left", "right"]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper edges={["bottom", "left", "right"]}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchField}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search in folder"
            placeholderTextColor={theme.textSubtle}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setSearchQuery("")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Links List */}
      <FlatList
        data={filteredLinks}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={11}
        removeClippedSubviews={Platform.OS === "android"}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={
          filteredLinks.length === 0
            ? styles.emptyListContainer
            : { paddingTop: 4, paddingBottom: 24 }
        }
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
    </SafeAreaWrapper>
  );
};

/**
 * Styles for the FolderDetailScreen component
 */
function createStyles(theme: Theme) {
  return StyleSheet.create({
    searchContainer: {
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    searchField: {
      flexDirection: "row",
      alignItems: "center",
      height: 42,
      borderRadius: radius.md,
      backgroundColor: theme.inputBg,
      paddingHorizontal: 12,
    },
    searchIcon: {
      fontSize: 18,
      color: theme.textSubtle,
      marginRight: 6,
    },
    searchInput: {
      flex: 1,
      height: "100%",
      fontSize: 16,
      color: theme.text,
      paddingVertical: 0,
    },
    clearButton: {
      marginLeft: 8,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.textSubtle,
      justifyContent: "center",
      alignItems: "center",
    },
    clearButtonText: {
      fontSize: 11,
      color: theme.inputBg,
      fontWeight: "700",
    },
    emptyListContainer: {
      flexGrow: 1,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 40,
    },
    emptyIcon: {
      fontSize: 48,
      marginBottom: 12,
    },
    emptyText: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.textMuted,
      textAlign: "center",
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    errorContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
    },
    errorText: {
      fontSize: 16,
      color: theme.danger,
      textAlign: "center",
    },
  });
}
