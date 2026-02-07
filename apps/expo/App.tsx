/**
 * Main App Component
 *
 * This is the main application component that handles:
 * - Setting up React Navigation
 * - Receiving shared links from other apps
 * - Fetching metadata for shared links
 * - Storing links in local storage
 * - Displaying stored links in a list
 */

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  View,
  FlatList,
  Text,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  TextInput,
  Share,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  GestureHandlerRootView,
  Swipeable,
} from "react-native-gesture-handler";
import {
  NavigationContainer,
  useFocusEffect,
  useNavigation,
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavLightTheme,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ReceiveSharingIntent from "react-native-receive-sharing-intent";
import { LinkData } from "./types/link";
import {
  saveLink,
  getLinks,
  deleteLink,
  getAllowEditingBeforeSave,
} from "./services/storage";
import { LinkCard } from "./components/LinkCard";
import { SafeAreaWrapper } from "./components/SafeAreaWrapper";
import { EditLinkScreen } from "./screens/EditLinkScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { FoldersScreen } from "./screens/FoldersScreen";
import { FolderDetailScreen } from "./screens/FolderDetailScreen";
import { LinkEditModal } from "./components/LinkEditModal";
import { processLinkWithoutAPI } from "./services/linkProcessor";
import { useTheme, createTheme } from "./utils/theme";
import { getFolders } from "./services/folderStorage";
import { Folder } from "./types/folder";

/**
 * Navigation param types
 */
type RootStackParamList = {
  Home: undefined;
  EditLink: {
    linkData: LinkData;
  };
  Folders: undefined;
  FolderDetail: {
    folderId: string;
  };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Client-side HTML parsing is used to extract metadata from URLs
 * No backend API required - metadata is fetched and parsed directly in the app
 */

export default function App() {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";
  const theme = useMemo(() => createTheme(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [links, setLinks] = useState<LinkData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [pendingLinkData, setPendingLinkData] = useState<LinkData | null>(null);

  /**
   * Loads all stored links from AsyncStorage
   */
  const loadStoredLinks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const storedLinks = await getLinks();
      // Sort links by creation date (newest first)
      const uniqueLinks = storedLinks
        .map((link) => ({
          ...link,
          normalizedUrl: link.url.toLowerCase().trim(),
        }))
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .filter((link, index, array) => {
          const firstIndex = array.findIndex(
            (candidate) => candidate.normalizedUrl === link.normalizedUrl
          );
          return firstIndex === index;
        })
        .map((link) => {
          const { normalizedUrl, ...rest } = link as LinkData & {
            normalizedUrl?: string;
          };
          return rest;
        });
      setLinks(uniqueLinks);
    } catch (error) {
      console.error("Error loading stored links:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to load stored links";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Handles processing a shared URL
   * Checks "allow editing before save" setting:
   * - If ON: Shows modal for editing before saving
   * - If OFF: Saves link immediately
   *
   * @param input - The shared URL or text containing a URL to process
   * @param attachedImages - Optional array of attached image URIs
   */
  const handleSharedUrl = async (
    input: string,
    attachedImages: string[] = []
  ) => {
    const normalizedImages = Array.from(
      new Set(
        (attachedImages || [])
          .filter((uri): uri is string => Boolean(uri && uri.trim()))
          .map((uri) => uri.trim())
      )
    );

    if (!input || input.trim() === "") {
      console.warn("Empty input received, skipping");
      setError("Received empty content, skipping");
      return;
    }

    try {
      setError(null);

      // Process link data
      const linkData = processLinkWithoutAPI(input, normalizedImages);

      // Validate that linkData has a valid URL
      if (!linkData || !linkData.url || linkData.url.trim() === "") {
        throw new Error("Failed to extract valid URL from shared content");
      }

      // Check if "allow editing before save" is enabled
      const allowEditing = await getAllowEditingBeforeSave();

      if (allowEditing) {
        // Show modal for editing
        setPendingLinkData(linkData);
        setModalVisible(true);
      } else {
        // Save immediately without modal
        await saveLink(linkData);
        await loadStoredLinks();
      }
    } catch (error) {
      console.error("Error processing shared URL:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to process shared link";
      setError(`Failed to process link: ${errorMessage}`);
    }
  };

  /**
   * Handles modal close
   */
  const handleModalClose = () => {
    setModalVisible(false);
    setPendingLinkData(null);
  };

  /**
   * Handles modal save - refreshes the links list
   */
  const handleModalSave = async () => {
    await loadStoredLinks();
  };

  useEffect(() => {
    // Load stored links on app mount
    loadStoredLinks();

    // Set up listener for incoming shared content
    const processSharedFiles = async (files: any[]) => {
      if (!files || files.length === 0) {
        console.log("No shared content received from intent.");
        return;
      }

      const imageUris: string[] = [];
      let primaryContent: string | null = null; // Changed to store full content, not just URL

      for (const file of files) {
        if (!file || typeof file !== "object") {
          continue;
        }

        const mimeType: string | undefined = file.mimeType;
        if (mimeType && mimeType.startsWith("image/")) {
          const candidateUri: string | undefined =
            file.filePath || file.contentUri || file.weblink || file.uri;
          if (
            candidateUri &&
            !imageUris.includes(candidateUri) &&
            candidateUri.trim() !== ""
          ) {
            imageUris.push(candidateUri);
          }
        }

        // Collect full content (text + URL) for parsing
        const rawContent: string | undefined =
          file.weblink || file.text || file.url || file.contentUri;
        if (rawContent && !primaryContent) {
          // Store the full content, not just extracted URL
          // This allows the parser to extract title/description from text+link combinations
          primaryContent = rawContent;
        }
      }

      if (primaryContent) {
        // Pass full content to handleSharedUrl for parsing
        await handleSharedUrl(primaryContent, imageUris);
      } else if (imageUris.length > 0) {
        console.warn(
          "Shared content contained images but no valid URL. Images will be ignored."
        );
      } else {
        console.warn("Received shared content without a usable URL.");
      }
    };

    const successHandler = async (files: any[]) => {
      await processSharedFiles(files);
    };

    const errorHandler = (error: any) => {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (
        errorMessage &&
        !errorMessage.includes("NullPointerException") &&
        !errorMessage.includes("null object reference")
      ) {
        console.error("Error receiving shared files:", error);
        setError(`Error receiving shared content: ${errorMessage}`);
      } else {
        console.log("No shared content available (app opened normally)");
      }
    };

    ReceiveSharingIntent.getReceivedFiles(
      successHandler,
      errorHandler,
      "ShareMedia" // Share extension name (can be customized)
    );
  }, []);

  /**
   * Renders the empty state when no links are stored
   */
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No links saved yet</Text>
      <Text style={styles.emptySubtext}>
        Share a link from another app to get started
      </Text>
    </View>
  );

  /**
   * Renders a loading indicator
   */
  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#0066cc" />
      <Text style={styles.loadingText}>Loading links...</Text>
    </View>
  );

  return (
    <NavigationContainer theme={isDarkMode ? NavDarkTheme : NavLightTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.surface,
          },
          headerTintColor: theme.text,
          headerTitleStyle: {
            fontWeight: "600",
          },
        }}
      >
        <Stack.Screen name="Home" options={{ headerShown: false }}>
          {() => (
            <>
              <HomeScreen
                links={links}
                loading={loading}
                error={error}
                setError={setError}
                loadStoredLinks={loadStoredLinks}
                renderEmptyState={renderEmptyState}
                renderLoading={renderLoading}
              />
              {pendingLinkData && (
                <LinkEditModal
                  visible={modalVisible}
                  linkData={pendingLinkData}
                  onClose={handleModalClose}
                  onSave={handleModalSave}
                />
              )}
            </>
          )}
        </Stack.Screen>
        <Stack.Screen
          name="EditLink"
          options={{ title: "Edit Link" }}
          component={EditLinkScreen}
        />
        <Stack.Screen
          name="Folders"
          options={{ title: "Folders" }}
          component={FoldersScreen}
        />
        <Stack.Screen
          name="FolderDetail"
          options={{ title: "Folder" }}
          component={FolderDetailScreen}
        />
        <Stack.Screen
          name="Settings"
          options={{ title: "Settings" }}
          component={SettingsScreen}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

/**
 * HomeScreen Component
 *
 * Displays the list of saved links
 */
interface HomeScreenProps {
  links: LinkData[];
  loading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  loadStoredLinks: () => Promise<void>;
  renderEmptyState: () => React.ReactElement;
  renderLoading: () => React.ReactElement;
}

const HomeScreen: React.FC<HomeScreenProps> = ({
  links,
  loading,
  error,
  setError,
  loadStoredLinks,
  renderEmptyState,
  renderLoading,
}) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";
  const theme = useMemo(() => createTheme(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  // Refresh links when screen comes into focus
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"Home" | "Folders" | "Settings">("Home");
  const [isTabBarVisible, setIsTabBarVisible] = useState<boolean>(true);
  const [folders, setFolders] = useState<Folder[]>([]);
  const scrollY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const tabBarTranslateY = useRef(new Animated.Value(0)).current;

  // Create folder map for quick lookup
  const folderMap = useMemo(() => {
    const map = new Map<string, string>();
    folders.forEach((folder) => {
      map.set(folder.id, folder.name);
    });
    return map;
  }, [folders]);

  // Load folders
  useEffect(() => {
    const loadFolders = async () => {
      try {
        const allFolders = await getFolders();
        setFolders(allFolders);
      } catch (error) {
        console.error("Error loading folders:", error);
      }
    };
    loadFolders();
  }, []);

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    links.forEach((link) => {
      const tag = link.tag?.trim();
      if (tag) {
        tagSet.add(tag);
      }
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [links]);

  const filteredLinks = useMemo(() => {
    let filtered = links;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((link) => {
        const titleMatch = link.title?.toLowerCase().includes(query);
        const descriptionMatch = link.description
          ?.toLowerCase()
          .includes(query);
        const urlMatch = link.url.toLowerCase().includes(query);
        const tagMatch = link.tag?.toLowerCase().includes(query);
        return titleMatch || descriptionMatch || urlMatch || tagMatch;
      });
    }

    // Apply tag filter
    if (selectedTag) {
      filtered = filtered.filter((link) => link.tag?.trim() === selectedTag);
    }

    return filtered;
  }, [links, selectedTag, searchQuery]);

  // Reload links and folders when screen comes into focus (e.g., after editing)
  useFocusEffect(
    React.useCallback(() => {
      loadStoredLinks();
      const loadFolders = async () => {
        try {
          const allFolders = await getFolders();
          setFolders(allFolders);
        } catch (error) {
          console.error("Error loading folders:", error);
        }
      };
      loadFolders();
      setActiveTab("Home");
    }, [loadStoredLinks])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStoredLinks();
    setRefreshing(false);
  };

  const handleTagPress = (tag: string) => {
    setSelectedTag((current) => (current === tag ? null : tag));
  };

  return (
    <SafeAreaWrapper style={styles.safeArea}>
      <GestureHandlerRootView style={styles.container}>
        <StatusBar style={isDarkMode ? "light" : "dark"} />

        {loading ? (
          renderLoading()
        ) : (
          <>
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

            {availableTags.length > 0 && (
              <View style={styles.tagBarContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tagBarContent}
                >
                  {availableTags.map((tag) => {
                    const isSelected = selectedTag === tag;
                    return (
                      <TouchableOpacity
                        key={tag}
                        style={[
                          styles.tagChip,
                          isSelected && styles.tagChipSelected,
                        ]}
                        onPress={() => handleTagPress(tag)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.tagChipText,
                            isSelected && styles.tagChipTextSelected,
                          ]}
                        >
                          {tag}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

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
                            await loadStoredLinks();
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
                  : { paddingTop: 12, paddingBottom: 80 }
              }
              showsVerticalScrollIndicator={true}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                {
                  useNativeDriver: false,
                  listener: (event: any) => {
                    const currentScrollY = event.nativeEvent.contentOffset.y;
                    const scrollDifference =
                      currentScrollY - lastScrollY.current;

                    // Hide tab bar when scrolling up (positive difference means scrolling down in content)
                    if (
                      scrollDifference > 10 &&
                      isTabBarVisible &&
                      currentScrollY > 10
                    ) {
                      setIsTabBarVisible(false);
                      Animated.timing(tabBarTranslateY, {
                        toValue: 100,
                        duration: 200,
                        useNativeDriver: true,
                      }).start();
                    }
                    // Show tab bar when scrolling down past 10px threshold (negative difference means scrolling up in content)
                    else if (scrollDifference < -10 && !isTabBarVisible) {
                      setIsTabBarVisible(true);
                      Animated.timing(tabBarTranslateY, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: true,
                      }).start();
                    }

                    lastScrollY.current = currentScrollY;
                  },
                }
              )}
              scrollEventThrottle={16}
            />
          </>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorDismiss} onPress={() => setError(null)}>
              Dismiss
            </Text>
          </View>
        )}

        {/* Bottom Tab Navigation */}
        <Animated.View
          style={[
            styles.bottomTabBar,
            {
              transform: [
                {
                  translateY: tabBarTranslateY,
                },
              ],
            },
          ]}
        >
          <SafeAreaView edges={["bottom"]} style={styles.bottomTabSafeArea}>
            <TouchableOpacity
              style={[
                styles.bottomTabItem,
                activeTab === "Home" && styles.bottomTabItemActive,
              ]}
              onPress={() => {
                setActiveTab("Home");
                // Already on Home screen, no navigation needed
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.bottomTabIcon}>🏠</Text>
              <Text
                style={[
                  styles.bottomTabLabel,
                  activeTab === "Home" && styles.bottomTabLabelActive,
                ]}
              >
                Home
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.bottomTabItem,
                activeTab === "Folders" && styles.bottomTabItemActive,
              ]}
              onPress={() => {
                setActiveTab("Folders");
                navigation.navigate("Folders");
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.bottomTabIcon}>📁</Text>
              <Text
                style={[
                  styles.bottomTabLabel,
                  activeTab === "Folders" && styles.bottomTabLabelActive,
                ]}
              >
                Folders
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.bottomTabItem,
                activeTab === "Settings" && styles.bottomTabItemActive,
              ]}
              onPress={() => {
                setActiveTab("Settings");
                navigation.navigate("Settings");
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.bottomTabIcon}>⚙️</Text>
              <Text
                style={[
                  styles.bottomTabLabel,
                  activeTab === "Settings" && styles.bottomTabLabelActive,
                ]}
              >
                Settings
              </Text>
            </TouchableOpacity>
          </SafeAreaView>
        </Animated.View>
      </GestureHandlerRootView>
    </SafeAreaWrapper>
  );
};

/**
 * Styles for the App component (dynamic by theme)
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
    tagBarContainer: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      backgroundColor: theme.surface,
    },
    tagBarContent: {
      gap: 8,
      alignItems: "center",
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
    tagChip: {
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 16,
      backgroundColor: theme.chipBg,
      borderWidth: 1,
      borderColor: theme.chipBorder,
    },
    tagChipSelected: {
      backgroundColor: theme.chipSelectedBg,
      borderColor: theme.chipSelectedBorder,
    },
    tagChipText: {
      fontSize: 10,
      color: theme.textMuted,
      fontWeight: "600",
    },
    tagChipTextSelected: {
      color: "#ffffff",
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
      position: "absolute",
      bottom: 20,
      left: 16,
      right: 16,
      backgroundColor: theme.errorBg,
      borderRadius: 8,
      padding: 16,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    errorText: {
      flex: 1,
      fontSize: 14,
      color: "#ffffff",
      marginRight: 12,
    },
    errorDismiss: {
      fontSize: 14,
      color: "#ffffff",
      fontWeight: "600",
      textDecorationLine: "underline",
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
    bottomTabBar: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: -2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3.84,
      elevation: 5,
    },
    bottomTabSafeArea: {
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "center",
      paddingVertical: 3,
    },
    bottomTabItem: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 4,
    },
    bottomTabItemActive: {
      // Active state styling if needed
    },
    bottomTabIcon: {
      fontSize: 24,
      marginBottom: 4,
    },
    bottomTabLabel: {
      fontSize: 12,
      color: theme.textMuted,
      fontWeight: "500",
    },
    bottomTabLabelActive: {
      color: "#0066cc",
      fontWeight: "600",
    },
  });
}
