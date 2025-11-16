/**
 * LinkCard Component
 *
 * This component displays a link card with metadata (title, description, image, URL, tag).
 * It handles missing metadata gracefully and is styled for a white background.
 * Pressing the card opens the URL, long pressing navigates to the edit screen.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinkData } from "../types/link";

/**
 * Navigation param types
 */
type RootStackParamList = {
  Home: undefined;
  EditLink: {
    linkData: LinkData;
  };
};

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Home"
>;

/**
 * Props for the LinkCard component
 *
 * @property linkData - The link data object containing URL and metadata
 * @property index - The index of the link in the list (used for navigation)
 */
interface LinkCardProps {
  linkData: LinkData;
  index: number;
}

/**
 * LinkCard component that displays link metadata in a card format
 *
 * @param linkData - The link data object containing URL and metadata
 * @param index - The index of the link in the list
 * @returns JSX.Element - The rendered link card component
 */
export const LinkCard: React.FC<LinkCardProps> = ({ linkData, index }) => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const displayImageUri =
    linkData.image ||
    (Array.isArray(linkData.sharedImages) && linkData.sharedImages.length > 0
      ? linkData.sharedImages[0]
      : null);
  const [imageLoading, setImageLoading] = useState<boolean>(!!displayImageUri);
  const [imageErrored, setImageErrored] = useState<boolean>(false);

  /**
   * Handles opening the URL when the card is pressed
   */
  const handlePress = async () => {
    try {
      const url = linkData.url;
      await Linking.openURL(url);
    } catch (error) {
      console.error("Error opening URL:", error);
      Alert.alert("Error", "Failed to open URL");
    }
  };

  /**
   * Handles navigation to edit screen when the card is long pressed
   */
  const handleLongPress = () => {
    navigation.navigate("EditLink", {
      linkData,
    });
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
    >
      {/* Content Section - Left Side */}
      <View style={styles.content}>
        {linkData.title ? (
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
            {linkData.title}
          </Text>
        ) : null}

        {linkData.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {linkData.description}
          </Text>
        ) : null}

        {/* Tag Badge */}
        {linkData.tag && (
          <View style={styles.tagContainer}>
            <Text style={styles.tagText}>{linkData.tag}</Text>
          </View>
        )}
      </View>

      {/* Image Section - Right Side */}
      {displayImageUri ? (
        <View style={styles.imageContainer}>
          {imageLoading && (
            <View style={styles.imageLoaderOverlay}>
              <ActivityIndicator size="small" color="#0066cc" />
            </View>
          )}
          {!imageErrored && (
            <Image
              source={{ uri: displayImageUri }}
              style={styles.image}
              resizeMode="cover"
              onLoadEnd={() => setImageLoading(false)}
              onError={() => {
                setImageLoading(false);
                setImageErrored(true);
              }}
            />
          )}
          {imageErrored && (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderText}>No image</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imagePlaceholderText}>No image</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

/**
 * Styles for the LinkCard component
 */
const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: "hidden",
    flexDirection: "row",
    minHeight: 80,
    maxHeight: 120,
  },
  content: {
    flex: 1,
    padding: 12,
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: "#666666",
    marginBottom: 6,
    lineHeight: 18,
  },
  imageContainer: {
    width: 100,
    height: "100%",
    backgroundColor: "#f0f0f0",
  },
  image: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f0f0f0",
  },
  imageLoaderOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  imagePlaceholder: {
    width: 100,
    height: "100%",
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholderText: {
    color: "#999999",
    fontSize: 11,
  },
  tagContainer: {
    alignSelf: "flex-start",
    backgroundColor: "#0066cc",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 4,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 11,
    color: "#ffffff",
    fontWeight: "600",
  },
});
