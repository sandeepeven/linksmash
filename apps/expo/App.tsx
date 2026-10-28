/**
 * Main App Component
 *
 * This is the main application component that handles:
 * - Setting up React Navigation
 * - Receiving shared links from other apps (via expo-share-intent)
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
  TextInput,
  Share,
  Animated,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ListRenderItem,
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  NavigationContainer,
  useFocusEffect,
  useNavigation,
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavLightTheme,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  ShareIntent,
  ShareIntentProvider,
  useShareIntentContext,
} from "expo-share-intent";
import * as Haptics from "expo-haptics";
import { LinkData } from "./types/link";
import {
  saveLink,
  getLinks,
  deleteLink,
  getAllowEditingBeforeSave,
  normalizeUrl,
} from "./services/storage";
import { LINK_ROW_HEIGHT } from "./components/LinkCard";
import { SwipeableLinkRow } from "./components/SwipeableLinkRow";
import { SafeAreaWrapper } from "./components/SafeAreaWrapper";
import { ToastProvider, useToast } from "./components/Toast";
import { EditLinkScreen } from "./screens/EditLinkScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { FoldersScreen } from "./screens/FoldersScreen";
import { FolderDetailScreen } from "./screens/FolderDetailScreen";
import { LinkEditModal } from "./components/LinkEditModal";
import { processLinkWithoutAPI } from "./services/linkProcessor";
import { Theme, radius, useTheme, useThemedStyles } from "./utils/theme";
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

/**
 * Sorts newest first and drops duplicate URLs (older app versions stored them)
 */
function sortAndDedupeLinks(storedLinks: LinkData[]): LinkData[] {
  const seen = new Set<string>();
  return [...storedLinks]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .filter((link) => {
      const key = normalizeUrl(link.url);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Pulls the text/URL and attached images out of a share intent
 */
function extractSharedContent(intent: ShareIntent): {
  content: string | null;
  images: string[];
  subject: string | null;
} {
  const text = intent.text?.trim() || null;
  const webUrl = intent.webUrl?.trim() || null;

  // Keep the full text (the parser extracts title/description from it), but
  // make sure the URL is present if the sender put it in a separate field.
  let content = text;
  if (webUrl && (!text || !text.includes(webUrl))) {
    content = text ? `${text}\n${webUrl}` : webUrl;
  }

  const images = Array.from(
    new Set(
      (intent.files ?? [])
        .filter((file) => file?.mimeType?.startsWith("image/") && file.path)
        .map((file) => file.path.trim())
    )
  );

  return { content, images, subject: intent.meta?.title?.trim() || null };
}

export default function App() {
  return (
    <ShareIntentProvider options={{ resetOnBackground: true }}>
      <GestureHandlerRootView style={rootStyles.flex}>
        <SafeAreaProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ShareIntentProvider>
  );
}

const rootStyles = StyleSheet.create({ flex: { flex: 1 } });

function AppContent() {
  const theme = useTheme();
  const toast = useToast();
  const { hasShareIntent, shareIntent, resetShareIntent, error: shareError } =
    useShareIntentContext();

  const [links, setLinks] = useState<LinkData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [pendingLinkData, setPendingLinkData] = useState<LinkData | null>(null);
  const handledIntentRef = useRef<ShareIntent | null>(null);

  /**
   * Loads all stored links from AsyncStorage.
   * Only the very first load shows the full-screen spinner; later refreshes
   * swap the data in place so the list never flashes or loses scroll position.
   */
  const loadStoredLinks = useCallback(async () => {
    try {
      const storedLinks = await getLinks();
      setLinks(sortAndDedupeLinks(storedLinks));
    } catch (error) {
      console.error("Error loading stored links:", error);
      toast.show(
        error instanceof Error ? error.message : "Failed to load stored links"
      );
    } finally {
      setLoading(false);
    }
  }, [toast]);

  /**
   * Applies a partial update to one link in memory (e.g. fetched metadata)
   */
  const updateLinkInState = useCallback(
    (url: string, patch: Partial<LinkData>) => {
      setLinks((current) =>
        current.map((link) =>
          link.url === url ? { ...link, ...patch } : link
        )
      );
    },
    []
  );

  /**
   * Handles processing a shared URL
   * Checks "allow editing before save" setting:
   * - If ON: Shows modal for editing before saving
   * - If OFF: Saves link immediately
   *
   * @param input - The shared URL or text containing a URL to process
   * @param attachedImages - Optional array of attached image URIs
   * @param subject - Optional title sent by the sharing app (EXTRA_SUBJECT)
   */
  const handleSharedUrl = useCallback(
    async (input: string, attachedImages: string[], subject: string | null) => {
      try {
        // Process link data
        const linkData = processLinkWithoutAPI(input, attachedImages);
        if (!linkData.title && subject) {
          linkData.title = subject;
        }

        // Check if "allow editing before save" is enabled
        const allowEditing = await getAllowEditingBeforeSave();

        if (allowEditing) {
          setPendingLinkData(linkData);
        } else {
          await saveLink(linkData);
          // Show it immediately, then reconcile with storage
          setLinks((current) =>
            sortAndDedupeLinks([linkData, ...current])
          );
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          ).catch(() => {});
          toast.show("Link saved");
          loadStoredLinks();
        }
      } catch (error) {
        console.error("Error processing shared URL:", error);
        toast.show(
          error instanceof Error && error.message.includes("No valid URL")
            ? "No link found in the shared content"
            : "Couldn't save the shared link"
        );
      }
    },
    [loadStoredLinks, toast]
  );

  // Initial load
  useEffect(() => {
    loadStoredLinks();
  }, [loadStoredLinks]);

  /**
   * Consume incoming share intents. The intent is cleared on the native side
   * right away so it is never re-processed when the app resumes later
   * (the old library re-read the stale intent on every foreground, which is
   * what made the app look "stuck" when coming back from other apps).
   */
  useEffect(() => {
    if (!hasShareIntent || handledIntentRef.current === shareIntent) return;
    handledIntentRef.current = shareIntent;
    const { content, images, subject } = extractSharedContent(shareIntent);
    resetShareIntent();

    if (!content) {
      toast.show("No link found in the shared content");
      return;
    }
    handleSharedUrl(content, images, subject);
  }, [hasShareIntent, shareIntent, resetShareIntent, handleSharedUrl, toast]);

  useEffect(() => {
    if (shareError) {
      console.error("Error receiving shared content:", shareError);
      toast.show("Couldn't read the shared content");
    }
  }, [shareError, toast]);

  /**
   * Handles modal close
   */
  const handleModalClose = useCallback(() => {
    setPendingLinkData(null);
  }, []);

  /**
   * Handles modal save - refreshes the links list
   */
  const handleModalSave = useCallback(async () => {
    toast.show("Link saved");
    await loadStoredLinks();
  }, [loadStoredLinks, toast]);

  const navTheme = useMemo(() => {
    const base = theme.isDark ? NavDarkTheme : NavLightTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.primary,
        background: theme.background,
        card: theme.surface,
        text: theme.text,
        border: theme.border,
      },
    };
  }, [theme]);

  return (
    <>
      <StatusBar style={theme.isDark ? "light" : "dark"} />
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: theme.surface,
            },
            headerTintColor: theme.text,
            headerTitleStyle: {
              fontWeight: "600",
            },
            headerShadowVisible: false,
            headerBackButtonDisplayMode: "minimal",
            contentStyle: { backgroundColor: theme.background },
            animation: Platform.OS === "android" ? "slide_from_right" : "default",
          }}
        >
          <Stack.Screen name="Home" options={{ headerShown: false }}>
            {() => (
              <HomeScreen
                links={links}
                loading={loading}
                loadStoredLinks={loadStoredLinks}
                setLinks={setLinks}
                updateLinkInState={updateLinkInState}
              />
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

      {/* Rendered outside the navigator so it shows on top of any screen */}
      {pendingLinkData && (
        <LinkEditModal
          visible
          linkData={pendingLinkData}
          onClose={handleModalClose}
          onSave={handleModalSave}
        />
      )}
    </>
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
  loadStoredLinks: () => Promise<void>;
  setLinks: React.Dispatch<React.SetStateAction<LinkData[]>>;
  updateLinkInState: (url: string, patch: Partial<LinkData>) => void;
}

/** Buffer (px) below which content is treated as non-scrollable */
const SCROLL_BUFFER = 20;
/** Extra bottom padding (px) so last items clear the tab bar */
const BOTTOM_PADDING_EXTRA = 50;
/** Base bottom padding (px) for tab bar clearance */
const TAB_BAR_BASE_PADDING = 80;
/** How far (px) the tab bar slides down when hidden */
const TAB_BAR_HIDE_OFFSET = 120;

const getItemLayout = (_: unknown, index: number) => ({
  length: LINK_ROW_HEIGHT,
  offset: LINK_ROW_HEIGHT * index,
  index,
});

const keyExtractor = (item: LinkData) => item.url;

const HomeScreen: React.FC<HomeScreenProps> = ({
  links,
  loading,
  loadStoredLinks,
  setLinks,
  updateLinkInState,
}) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme, styles } = useThemedStyles(createStyles);
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [folders, setFolders] = useState<Folder[]>([]);
  // Scroll-driven state lives in refs so scrolling never re-renders the list
  const isTabBarVisibleRef = useRef(true);
  const isContentScrollableRef = useRef(true);
  const lastScrollY = useRef(0);
  const tabBarTranslateY = useRef(new Animated.Value(0)).current;
  const contentHeightRef = useRef(0);
  const layoutHeightRef = useRef(0);

  // Create folder map for quick lookup
  const folderMap = useMemo(() => {
    const map = new Map<string, string>();
    folders.forEach((folder) => {
      map.set(folder.id, folder.name);
    });
    return map;
  }, [folders]);

  const setTabBarVisible = useCallback(
    (visible: boolean) => {
      if (isTabBarVisibleRef.current === visible) return;
      isTabBarVisibleRef.current = visible;
      Animated.spring(tabBarTranslateY, {
        toValue: visible ? 0 : TAB_BAR_HIDE_OFFSET,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
        mass: 0.8,
      }).start();
    },
    [tabBarTranslateY]
  );

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

  // Clear a tag filter whose last link was deleted / retagged
  useEffect(() => {
    if (selectedTag && !availableTags.includes(selectedTag)) {
      setSelectedTag(null);
    }
  }, [availableTags, selectedTag]);

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
    useCallback(() => {
      loadStoredLinks();
      getFolders()
        .then(setFolders)
        .catch((error) => console.error("Error loading folders:", error));
      setTabBarVisible(true);
    }, [loadStoredLinks, setTabBarVisible])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStoredLinks();
    setRefreshing(false);
  }, [loadStoredLinks]);

  const handleTagPress = useCallback((tag: string | null) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedTag((current) => (current === tag ? null : tag));
  }, []);

  /**
   * Deletes optimistically and offers an Undo
   */
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
              loadStoredLinks();
            }
          },
        });
      } catch (e) {
        console.error("Failed to delete link:", e);
        toast.show("Failed to delete link");
        loadStoredLinks();
      }
    },
    [loadStoredLinks, setLinks, toast]
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

  const updateScrollability = useCallback(() => {
    const scrollable =
      contentHeightRef.current > layoutHeightRef.current + SCROLL_BUFFER;
    isContentScrollableRef.current = scrollable;
    // Keep tab bar visible when content is not scrollable (few items)
    if (!scrollable) setTabBarVisible(true);
  }, [setTabBarVisible]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentScrollY = event.nativeEvent.contentOffset.y;
      const scrollDifference = currentScrollY - lastScrollY.current;

      if (
        scrollDifference > 10 &&
        currentScrollY > 10 &&
        isContentScrollableRef.current
      ) {
        // Scrolling down: hide tab bar
        setTabBarVisible(false);
      } else if (scrollDifference < -10 || currentScrollY <= 0) {
        // Scrolling up or back at the top: show tab bar
        setTabBarVisible(true);
      }

      lastScrollY.current = currentScrollY;
    },
    [setTabBarVisible]
  );

  const renderItem: ListRenderItem<LinkData> = useCallback(
    ({ item }) => (
      <SwipeableLinkRow
        linkData={item}
        folderName={item.folderId ? folderMap.get(item.folderId) || null : null}
        onDelete={handleDeleteLink}
        onShare={handleShareLink}
        onMetadataFetched={updateLinkInState}
      />
    ),
    [folderMap, handleDeleteLink, handleShareLink, updateLinkInState]
  );

  const isFiltering = searchQuery.trim().length > 0 || selectedTag !== null;

  /**
   * Renders the empty state (distinguishes "nothing saved" from "no matches")
   */
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>{isFiltering ? "🔍" : "🔗"}</Text>
      <Text style={styles.emptyText}>
        {isFiltering ? "No matching links" : "No links saved yet"}
      </Text>
      <Text style={styles.emptySubtext}>
        {isFiltering
          ? "Try a different search or tag"
          : "Share a link from any app and pick LinkSmash to save it here"}
      </Text>
    </View>
  );

  const renderTabItem = (
    label: string,
    icon: string,
    active: boolean,
    onPress: () => void
  ) => (
    <TouchableOpacity
      key={label}
      style={styles.bottomTabItem}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <View style={[styles.bottomTabIconWrap, active && styles.bottomTabIconWrapActive]}>
        <Text style={styles.bottomTabIcon}>{icon}</Text>
      </View>
      <Text
        style={[styles.bottomTabLabel, active && styles.bottomTabLabelActive]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaWrapper edges={["top", "left", "right"]}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>LinkSmash</Text>
            <Text style={styles.headerCount}>
              {links.length} {links.length === 1 ? "link" : "links"}
            </Text>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchField}>
              <Text style={styles.searchIcon}>⌕</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search links"
                placeholderTextColor={theme.textSubtle}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="never"
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

          {availableTags.length > 0 && (
            <View style={styles.tagBarContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tagBarContent}
                keyboardShouldPersistTaps="handled"
              >
                {[null, ...availableTags].map((tag) => {
                  const isSelected = selectedTag === tag;
                  return (
                    <TouchableOpacity
                      key={tag ?? "__all"}
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
                        {tag ?? "All"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

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
                : {
                    paddingTop: 6,
                    paddingBottom: TAB_BAR_BASE_PADDING + BOTTOM_PADDING_EXTRA,
                  }
            }
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            refreshing={refreshing}
            onRefresh={handleRefresh}
            onScroll={handleScroll}
            scrollEventThrottle={32}
            onContentSizeChange={(_, height) => {
              contentHeightRef.current = height;
              updateScrollability();
            }}
            onLayout={(e) => {
              layoutHeightRef.current = e.nativeEvent.layout.height;
              updateScrollability();
            }}
          />
        </>
      )}

      {/* Bottom Tab Navigation */}
      <Animated.View
        style={[
          styles.bottomTabBar,
          { transform: [{ translateY: tabBarTranslateY }] },
        ]}
      >
        <SafeAreaView edges={["bottom"]} style={styles.bottomTabSafeArea}>
          {renderTabItem("Home", "🏠", true, () => {})}
          {renderTabItem("Folders", "📁", false, () =>
            navigation.navigate("Folders")
          )}
          {renderTabItem("Settings", "⚙️", false, () =>
            navigation.navigate("Settings")
          )}
        </SafeAreaView>
      </Animated.View>
    </SafeAreaWrapper>
  );
};

/**
 * Styles for the App component (dynamic by theme)
 */
function createStyles(theme: Theme) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 4,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: "800",
      color: theme.text,
      letterSpacing: -0.5,
    },
    headerCount: {
      fontSize: 13,
      color: theme.textSubtle,
      fontWeight: "500",
    },
    searchContainer: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 8,
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
    tagBarContainer: {
      paddingBottom: 8,
    },
    tagBarContent: {
      gap: 8,
      paddingHorizontal: 16,
      alignItems: "center",
    },
    tagChip: {
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: radius.pill,
      backgroundColor: theme.chipBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.chipBorder,
    },
    tagChipSelected: {
      backgroundColor: theme.chipSelectedBg,
      borderColor: theme.chipSelectedBorder,
    },
    tagChipText: {
      fontSize: 13,
      color: theme.textMuted,
      fontWeight: "600",
      textTransform: "capitalize",
    },
    tagChipTextSelected: {
      color: theme.onPrimary,
    },
    emptyListContainer: {
      flexGrow: 1,
      paddingBottom: TAB_BAR_BASE_PADDING,
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
    bottomTabBar: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      shadowColor: theme.shadow,
      shadowOffset: {
        width: 0,
        height: -2,
      },
      shadowOpacity: theme.isDark ? 0 : 0.06,
      shadowRadius: 8,
      elevation: 8,
    },
    bottomTabSafeArea: {
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "center",
      paddingTop: 6,
      paddingBottom: 4,
    },
    bottomTabItem: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 2,
    },
    bottomTabIconWrap: {
      width: 56,
      height: 30,
      borderRadius: radius.pill,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 2,
    },
    bottomTabIconWrapActive: {
      backgroundColor: theme.primarySoft,
    },
    bottomTabIcon: {
      fontSize: 20,
    },
    bottomTabLabel: {
      fontSize: 12,
      color: theme.textMuted,
      fontWeight: "500",
    },
    bottomTabLabelActive: {
      color: theme.primary,
      fontWeight: "700",
    },
  });
}
