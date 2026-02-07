/**
 * Storage Service
 *
 * This file provides functions for managing link data in local storage using AsyncStorage.
 * It handles saving, retrieving, and deleting links from the database.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinkData } from "../types/link";

/**
 * Storage key for links in AsyncStorage
 */
const STORAGE_KEY = "linksmash_links";

/**
 * Storage key for allow editing before save setting
 */
const ALLOW_EDITING_BEFORE_SAVE_KEY = "linksmash_allow_editing_before_save";

/**
 * Saves a link object with metadata to AsyncStorage
 *
 * @param linkData - The link data object to save
 * @returns Promise<void> - Resolves when the link is saved successfully
 * @throws Error if storage operation fails
 */
export async function saveLink(linkData: LinkData): Promise<void> {
  try {
    // Validate link data
    if (!linkData || !linkData.url) {
      throw new Error("Invalid link data: URL is required");
    }

    // Retrieve existing links from storage
    const existingLinksJson = await AsyncStorage.getItem(STORAGE_KEY);
    let existingLinks: LinkData[] = [];

    if (existingLinksJson) {
      try {
        existingLinks = JSON.parse(existingLinksJson);
        // Validate that parsed data is an array
        if (!Array.isArray(existingLinks)) {
          console.warn(
            "Corrupted storage data detected, resetting links array"
          );
          existingLinks = [];
        }
        existingLinks = existingLinks.map((link) => ({
          ...link,
          folderId: link.folderId ?? null, // Ensure folderId exists, default to null
          sharedImages: Array.isArray(link.sharedImages)
            ? link.sharedImages
            : [],
        }));
      } catch (parseError) {
        console.error("Error parsing stored links JSON:", parseError);
        // If JSON is corrupted, start with empty array
        existingLinks = [];
      }
    }

    // Add the new link to the array
    existingLinks.push(linkData);

    // Save the updated array back to storage
    const serializedData = JSON.stringify(existingLinks);
    await AsyncStorage.setItem(STORAGE_KEY, serializedData);
  } catch (error) {
    console.error("Error saving link to storage:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to save link to storage: ${error.message}`);
    }
    throw new Error("Failed to save link to storage: Unknown error");
  }
}

/**
 * Retrieves all stored links from AsyncStorage
 *
 * @returns Promise<LinkData[]> - Array of all stored links
 * @throws Error if storage operation fails
 */
export async function getLinks(): Promise<LinkData[]> {
  try {
    const linksJson = await AsyncStorage.getItem(STORAGE_KEY);

    if (!linksJson) {
      return [];
    }

    try {
      const links: LinkData[] = JSON.parse(linksJson);

      // Validate that parsed data is an array
      if (!Array.isArray(links)) {
        console.error("Corrupted storage data: links is not an array");
        // Return empty array and clear corrupted data
        await AsyncStorage.removeItem(STORAGE_KEY);
        return [];
      }

      // Validate each link has required fields
      const validLinks = links.filter((link) => {
        if (!link || typeof link !== "object" || !link.url) {
          console.warn("Invalid link entry found, skipping:", link);
          return false;
        }
        return true;
      });

      return validLinks.map((link) => ({
        ...link,
        folderId: link.folderId ?? null, // Ensure folderId exists, default to null (migration)
        sharedImages: Array.isArray(link.sharedImages) ? link.sharedImages : [],
      }));
    } catch (parseError) {
      console.error("Error parsing links JSON:", parseError);
      // If JSON is corrupted, clear it and return empty array
      await AsyncStorage.removeItem(STORAGE_KEY);
      return [];
    }
  } catch (error) {
    console.error("Error retrieving links from storage:", error);
    if (error instanceof Error) {
      throw new Error(
        `Failed to retrieve links from storage: ${error.message}`
      );
    }
    throw new Error("Failed to retrieve links from storage: Unknown error");
  }
}

/**
 * Deletes a link by URL from AsyncStorage
 *
 * @param url - The URL of the link to delete
 * @returns Promise<void> - Resolves when the link is deleted successfully
 * @throws Error if storage operation fails or URL is not found
 */
export async function deleteLink(url: string): Promise<void> {
  try {
    const existingLinks = await getLinks();

    // Find the index of the link with the matching URL
    const index = existingLinks.findIndex((link) => link.url === url);

    if (index === -1) {
      throw new Error("Link not found");
    }

    // Remove the link at the found index
    existingLinks.splice(index, 1);

    // Save the updated array back to storage
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(existingLinks));
  } catch (error) {
    console.error("Error deleting link from storage:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to delete link from storage: ${error.message}`);
    }
    throw new Error("Failed to delete link from storage: Unknown error");
  }
}

/**
 * Updates an existing link by URL
 * The URL field cannot be changed (it is preserved from the original link)
 *
 * @param url - The URL of the link to update
 * @param updatedLinkData - Partial link data with fields to update (URL will be ignored)
 * @returns Promise<void> - Resolves when the link is updated successfully
 * @throws Error if storage operation fails or URL is not found
 */
export async function updateLink(
  url: string,
  updatedLinkData: Partial<LinkData>
): Promise<void> {
  try {
    const existingLinks = await getLinks();

    // Find the index of the link with the matching URL
    const index = existingLinks.findIndex((link) => link.url === url);

    if (index === -1) {
      throw new Error("Link not found");
    }

    // Get the original link
    const originalLink = existingLinks[index];

    // Create updated link - preserve URL and createdAt, update other fields
    const updatedLink: LinkData = {
      ...originalLink,
      ...updatedLinkData,
      url: originalLink.url, // URL cannot be changed
      createdAt: originalLink.createdAt, // CreatedAt cannot be changed
      folderId: updatedLinkData.folderId !== undefined ? updatedLinkData.folderId : originalLink.folderId ?? null, // Handle folderId update
    };

    // Replace the link at the found index
    existingLinks[index] = updatedLink;

    // Save the updated array back to storage
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(existingLinks));
  } catch (error) {
    console.error("Error updating link in storage:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to update link in storage: ${error.message}`);
    }
    throw new Error("Failed to update link in storage: Unknown error");
  }
}

/**
 * Retrieves the "allow editing before save" setting from AsyncStorage
 * Defaults to true if the setting doesn't exist
 *
 * @returns Promise<boolean> - The setting value (true = ON, false = OFF)
 * @throws Error if storage operation fails
 */
export async function getAllowEditingBeforeSave(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(ALLOW_EDITING_BEFORE_SAVE_KEY);
    if (value === null) {
      // Default to true if not set
      await setAllowEditingBeforeSave(true);
      return true;
    }
    return value === "true";
  } catch (error) {
    console.error("Error retrieving allow editing before save setting:", error);
    // Default to true on error
    return true;
  }
}

/**
 * Sets the "allow editing before save" setting in AsyncStorage
 *
 * @param value - The setting value (true = ON, false = OFF)
 * @returns Promise<void> - Resolves when the setting is saved successfully
 * @throws Error if storage operation fails
 */
export async function setAllowEditingBeforeSave(
  value: boolean
): Promise<void> {
  try {
    await AsyncStorage.setItem(ALLOW_EDITING_BEFORE_SAVE_KEY, String(value));
  } catch (error) {
    console.error("Error saving allow editing before save setting:", error);
    if (error instanceof Error) {
      throw new Error(
        `Failed to save allow editing before save setting: ${error.message}`
      );
    }
    throw new Error(
      "Failed to save allow editing before save setting: Unknown error"
    );
  }
}
