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
  useColorScheme,
  Share,
} from "react-native";
import { useNavigation, useRoute, RouteProp, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  GestureHandlerRootView,
  Swipeable,
} from "react-native-gesture-handler";
import { SafeAreaWrapper } from "../components/SafeAreaWrapper";
import { LinkCard } from "../components/LinkCard";
import { getLinks, deleteLink } from "../services/storage";
import { getFolder, getFolders } from "../services/folderStorage";
import { LinkData } from "../types/link";
import { Folder } from "../types/folder";
import { createTheme } from "../utils/theme";

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

  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";
  const theme = createTheme(isDarkMode);
  const styles = createStyles(theme);

  const [links, setLinks] = useState<LinkData[]>([]);
  const [folder, setFolder] = useState<Folder | null>(null);
  const [allFolders, setAllFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  /**
   * Loads folder and links data
   */
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load folder and all folders for display name calculation
      const [folderData, allFoldersData] = await Promise.all([
        getFolder(folderId),
        getFolders(),
      ]);

      if (!folderData) {
        setError("Folder not found");
        setLoading(false);
        return;
      }

      setFolder(folderData);
      setAllFolders(allFoldersData);

      // Load all links and filter by folderId
      const allLinks = await getLinks();
      const folderLinks = allLinks.filter(
        (link) => link.folderId === folderId
      );

      // Sort by creation date (newest first)
      const sortedLinks = folderLinks.sort(
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

  /**
   * Renders empty state
   */
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No links in this folder</Text>
      <Text style={styles.emptySubtext}>
        Links assigned to this folder will appear here
      </Text>
    </View>
  );

  /**
   * Renders loading state
   */
  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#0066cc" />
      <Text style={styles.loadingText}>Loading links...</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaWrapper style={styles.safeArea}>
        {renderLoading()}
      </SafeAreaWrapper>
    );
  }

  if (error) {
    return (
      <SafeAreaWrapper style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper style={styles.safeArea}>
      <GestureHandlerRootView style={styles.container}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search links..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setSearchQuery("")}
              activeOpacity={0.7}
            >
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Links List */}
        <FlatList
          data={filteredLinks}
          keyExtractor={(item, index) => `${item.url}-${index}`}
          renderItem={({ item, index }) => (
            <Swipeable
              renderRightActions={() => (
                <View style={styles.swipeDeleteContainer}>
                  <Text
                    style={styles.swipeDeleteText}
                    onPress={async () => {
                      try {
                        await deleteLink(item.url);
                        await loadData();
                      } catch (e) {
                        console.error("Failed to delete link:", e);
                        setError("Failed to delete link");
                      }
                    }}
                  >
                    Delete
                  </Text>
                </View>
              )}
              renderLeftActions={() => (
                <View style={styles.swipeShareContainer}>
                  <Text
                    style={styles.swipeShareText}
                    onPress={async () => {
                      try {
                        await Share.share({
                          message: item.url,
                        });
                      } catch (e) {
                        console.error("Failed to share link:", e);
                        setError("Failed to share link");
                      }
                    }}
                  >
                    Share
                  </Text>
                </View>
              )}
            >
              <LinkCard
                linkData={item}
                index={index}
                folderName={item.folderId ? folderMap.get(item.folderId) || null : null}
              />
            </Swipeable>
          )}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={
            filteredLinks.length === 0
              ? styles.emptyListContainer
              : { paddingTop: 12, paddingBottom: 20 }
          }
          showsVerticalScrollIndicator={true}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      </GestureHandlerRootView>
    </SafeAreaWrapper>
  );
};

/**
 * Styles for the FolderDetailScreen component
 */
function createStyles(theme: ReturnType<typeof createTheme>) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      backgroundColor: theme.surface,
    },
    searchInput: {
      flex: 1,
      height: 40,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      fontSize: 16,
      color: theme.text,
      backgroundColor: theme.background,
    },
    clearButton: {
      marginLeft: 8,
      padding: 8,
    },
    clearButtonText: {
      fontSize: 18,
      color: theme.textMuted,
      fontWeight: "300",
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
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: theme.textMuted,
    },
    errorContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
    },
    errorText: {
      fontSize: 16,
      color: theme.errorBg,
      textAlign: "center",
    },
    swipeDeleteContainer: {
      backgroundColor: theme.errorBg,
      justifyContent: "center",
      alignItems: "flex-end",
      paddingHorizontal: 20,
      marginVertical: 6,
      marginHorizontal: 16,
      borderRadius: 8,
      overflow: "hidden",
    },
    swipeDeleteText: {
      color: "#ffffff",
      fontWeight: "700",
      fontSize: 16,
    },
    swipeShareContainer: {
      backgroundColor: "#0066cc",
      justifyContent: "center",
      alignItems: "flex-start",
      paddingHorizontal: 20,
      marginVertical: 6,
      marginHorizontal: 16,
      borderRadius: 8,
      overflow: "hidden",
    },
    swipeShareText: {
      color: "#ffffff",
      fontWeight: "700",
      fontSize: 16,
    },
  });
}

