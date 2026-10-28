/**
 * Main App Component
 *
 * This is the main application component that handles:
 * - Setting up React Navigation
 * - Receiving shared links from other apps (via expo-share-intent)
 * - Saving shared links to local storage
 * - Holding the links list shared with the Home screen
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  NavigationContainer,
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavLightTheme,
} from "@react-navigation/native";
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
  getAllowEditingBeforeSave,
  normalizeUrl,
} from "./services/storage";
import { ToastProvider, useToast } from "./components/Toast";
import { HomeScreen } from "./screens/HomeScreen";
import { EditLinkScreen } from "./screens/EditLinkScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { FoldersScreen } from "./screens/FoldersScreen";
import { FolderDetailScreen } from "./screens/FolderDetailScreen";
import { LinkEditModal } from "./components/LinkEditModal";
import { processLinkWithoutAPI } from "./services/linkProcessor";
import { useTheme } from "./utils/theme";

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
