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

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  View,
  FlatList,
  Text,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import {
  GestureHandlerRootView,
  Swipeable,
} from "react-native-gesture-handler";
import { NavigationContainer, useFocusEffect } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ReceiveSharingIntent from "react-native-receive-sharing-intent";
import { LinkData } from "./types/link";
import { fetchLinkMetadata } from "./services/metadata";
import { saveLink, getLinks, deleteLink } from "./services/storage";
import { LinkCard } from "./components/LinkCard";
import { SafeAreaWrapper } from "./components/SafeAreaWrapper";
import { EditLinkScreen } from "./screens/EditLinkScreen";

/**
 * Navigation param types
 */
type RootStackParamList = {
  Home: undefined;
  EditLink: {
    linkData: LinkData;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * API key for my.linkpreview.net service
 * TODO: Replace with your actual API key from my.linkpreview.net
 * You can also move this to a config file or environment variable
 */
const LINKPREVIEW_API_KEY = "da52d1650cba9ba537069b787a0c8aae";

export default function App() {
  const [links, setLinks] = useState<LinkData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [processingShare, setProcessingShare] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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
   * Extracts a URL from text that might contain both description and URL
   * Uses the linkParser service for consistency
   *
   * @param text - The text that might contain a URL
   * @returns string | null - The extracted URL or null if no URL found
   */
  const extractUrlFromText = (text: string): string | null => {
    const { extractUrlFromText: extractUrl } = require("./services/linkParser");
    return extractUrl(text);
  };

  /**
   * Handles processing a shared URL
   * Uses the new link processor service with platform-based parsing strategy
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
      setProcessingShare(true);
      setError(null);

      // Check if API key is configured
      const apiKeyConfigured =
        LINKPREVIEW_API_KEY && LINKPREVIEW_API_KEY.trim() !== "";

      const {
        processLink,
        processLinkWithoutAPI,
      } = require("./services/linkProcessor");

      let linkData: LinkData;

      if (apiKeyConfigured) {
        // Use new link processor with API support
        linkData = await processLink(
          input,
          LINKPREVIEW_API_KEY,
          normalizedImages
        );
      } else {
        // Use link processor without API (parsing only)
        console.warn("API key not configured. Using parsing strategy only.");
        linkData = processLinkWithoutAPI(input, normalizedImages);
      }

      // Save the link to storage
      await saveLink(linkData);

      // Reload links to update the UI
      await loadStoredLinks();
    } catch (error) {
      console.error("Error processing shared URL:", error);

      // Extract error message for user feedback
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to process shared link";

      // Even if processing fails, try to save with minimal data
      try {
        const { processLinkWithoutAPI } = require("./services/linkProcessor");
        const linkData = processLinkWithoutAPI(input, normalizedImages);
        await saveLink(linkData);
        await loadStoredLinks();

        // Show warning that link was saved with limited metadata
        if (errorMessage.includes("API") || errorMessage.includes("timeout")) {
          setError(`Link saved but metadata unavailable: ${errorMessage}`);
        } else {
          setError(`Link saved with limited metadata: ${errorMessage}`);
        }
      } catch (saveError) {
        console.error("Error saving link after processing failure:", saveError);
        const saveErrorMessage =
          saveError instanceof Error
            ? saveError.message
            : "Failed to save link";
        setError(`Failed to save link: ${saveErrorMessage}`);
      }
    } finally {
      setProcessingShare(false);
    }
  };

  useEffect(() => {
    // Load stored links on app mount
    loadStoredLinks();

    // Set up listener for incoming shared content
    const processSharedFiles = async (files: any[]) => {
      console.log("processSharedFiles>files:", files);
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
      setProcessingShare(false);
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
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: "#ffffff",
          },
          headerTintColor: "#000000",
          headerTitleStyle: {
            fontWeight: "600",
          },
        }}
      >
        <Stack.Screen name="Home" options={{ headerShown: false }}>
          {() => (
            <HomeScreen
              links={links}
              loading={loading}
              processingShare={processingShare}
              error={error}
              setError={setError}
              loadStoredLinks={loadStoredLinks}
              renderEmptyState={renderEmptyState}
              renderLoading={renderLoading}
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name="EditLink"
          options={{ title: "Edit Link" }}
          component={EditLinkScreen}
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
  processingShare: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  loadStoredLinks: () => Promise<void>;
  renderEmptyState: () => React.ReactElement;
  renderLoading: () => React.ReactElement;
}

const HomeScreen: React.FC<HomeScreenProps> = ({
  links,
  loading,
  processingShare,
  error,
  setError,
  loadStoredLinks,
  renderEmptyState,
  renderLoading,
}) => {
  // Refresh links when screen comes into focus
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

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
    if (!selectedTag) {
      return links;
    }
    return links.filter((link) => link.tag?.trim() === selectedTag);
  }, [links, selectedTag]);

  // Reload links when screen comes into focus (e.g., after editing)
  useFocusEffect(
    React.useCallback(() => {
      loadStoredLinks();
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
        <StatusBar style="auto" />

        {loading ? (
          renderLoading()
        ) : (
          <>
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
                >
                  <LinkCard linkData={item} index={index} />
                </Swipeable>
              )}
              ListEmptyComponent={renderEmptyState}
              contentContainerStyle={
                filteredLinks.length === 0
                  ? styles.emptyListContainer
                  : { paddingTop: 12, paddingBottom: 12 }
              }
              showsVerticalScrollIndicator={true}
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          </>
        )}

        {processingShare && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.processingText}>Processing shared link...</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorDismiss} onPress={() => setError(null)}>
              Dismiss
            </Text>
          </View>
        )}
      </GestureHandlerRootView>
    </SafeAreaWrapper>
  );
};

/**
 * Styles for the App component
 */
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  tagBarContainer: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
    backgroundColor: "#ffffff",
  },
  tagBarContent: {
    gap: 8,
    alignItems: "center",
  },
  tagChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "#f2f4f7",
    borderWidth: 1,
    borderColor: "#d0d5dd",
  },
  tagChipSelected: {
    backgroundColor: "#0066cc",
    borderColor: "#004a99",
  },
  tagChipText: {
    fontSize: 14,
    color: "#475467",
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
    color: "#333333",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#666666",
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
    color: "#666666",
  },
  processingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  processingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#ffffff",
    fontWeight: "500",
  },
  errorContainer: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: "#ff4444",
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
    backgroundColor: "#ff4444",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    marginVertical: 8,
    borderRadius: 8,
  },
  swipeDeleteText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
});
