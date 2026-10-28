/**
 * Home Screen Component
 *
 * Displays the list of saved links with search, tag filters and the
 * bottom tab bar (which hides while scrolling down).
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
  BackHandler,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ListRenderItem,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { LinkData } from "../types/link";
import { Folder } from "../types/folder";
import { saveLink, deleteLink } from "../services/storage";
import { getFolders } from "../services/folderStorage";
import { LINK_ROW_HEIGHT } from "../components/LinkCard";
import { SwipeableLinkRow } from "../components/SwipeableLinkRow";
import { SafeAreaWrapper } from "../components/SafeAreaWrapper";
import { useToast } from "../components/Toast";
import { Theme, radius, useThemedStyles } from "../utils/theme";

/**
 * Navigation param types
 */
type RootStackParamList = {
  Home: undefined;
  Folders: undefined;
  Settings: undefined;
};

export interface HomeScreenProps {
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
/** Window (ms) for the second back press that exits the app */
const EXIT_BACK_PRESS_WINDOW = 2000;

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const getItemLayout = (_: unknown, index: number) => ({
  length: LINK_ROW_HEIGHT,
  offset: LINK_ROW_HEIGHT * index,
  index,
});

const keyExtractor = (item: LinkData) => item.url;

export const HomeScreen: React.FC<HomeScreenProps> = ({
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
  const lastBackPressRef = useRef(0);

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

  /**
   * Android: press back twice on Home to exit, first press shows a hint
   */
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          const now = Date.now();
          if (now - lastBackPressRef.current < EXIT_BACK_PRESS_WINDOW) {
            toast.hide();
            return false; // let the system exit the app
          }
          lastBackPressRef.current = now;
          toast.show("Press back again to exit", {
            duration: EXIT_BACK_PRESS_WINDOW,
          });
          return true;
        }
      );
      return () => subscription.remove();
    }, [toast])
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
    icon: IoniconName,
    activeIcon: IoniconName,
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
        <Ionicons
          name={active ? activeIcon : icon}
          size={22}
          color={active ? theme.primary : theme.textMuted}
        />
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
          {renderTabItem("Home", "home-outline", "home", true, () => {})}
          {renderTabItem("Folders", "folder-outline", "folder", false, () =>
            navigation.navigate("Folders")
          )}
          {renderTabItem("Settings", "settings-outline", "settings", false, () =>
            navigation.navigate("Settings")
          )}
        </SafeAreaView>
      </Animated.View>
    </SafeAreaWrapper>
  );
};

/**
 * Styles for the HomeScreen component (dynamic by theme)
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
