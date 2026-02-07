/**
 * Folder Storage Service
 *
 * This file provides functions for managing folder data in local storage using AsyncStorage.
 * It handles saving, retrieving, updating, and deleting folders from the database.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Folder } from "../types/folder";
import { getLinks } from "./storage";

/**
 * Storage key for folders in AsyncStorage
 */
const STORAGE_KEY = "linksmash_folders";

/**
 * Generates a unique ID for a folder using timestamp
 *
 * @returns string - Unique folder ID
 */
function generateFolderId(): string {
  return `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Saves a folder object to AsyncStorage
 *
 * @param folder - The folder object to save (id will be generated if not provided)
 * @returns Promise<string> - The folder ID
 * @throws Error if storage operation fails
 */
export async function saveFolder(
  folder: Omit<Folder, "id" | "createdAt"> & { id?: string }
): Promise<string> {
  try {
    // Validate folder data
    if (!folder || !folder.name || folder.name.trim() === "") {
      throw new Error("Invalid folder data: name is required");
    }

    // Retrieve existing folders from storage
    const existingFoldersJson = await AsyncStorage.getItem(STORAGE_KEY);
    let existingFolders: Folder[] = [];

    if (existingFoldersJson) {
      try {
        existingFolders = JSON.parse(existingFoldersJson);
        // Validate that parsed data is an array
        if (!Array.isArray(existingFolders)) {
          console.warn(
            "Corrupted storage data detected, resetting folders array"
          );
          existingFolders = [];
        }
      } catch (parseError) {
        console.error("Error parsing stored folders JSON:", parseError);
        // If JSON is corrupted, start with empty array
        existingFolders = [];
      }
    }

    // Generate ID and createdAt if not provided
    const folderId = folder.id || generateFolderId();
    const createdAt = new Date().toISOString();

    // Check if folder with same name already exists
    const duplicateName = existingFolders.find(
      (f) =>
        f.name.trim().toLowerCase() === folder.name.trim().toLowerCase() &&
        f.id !== folderId
    );
    if (duplicateName) {
      throw new Error("A folder with this name already exists");
    }

    // Auto-assign order if not provided (place at end)
    let order = folder.order;
    if (order === undefined) {
      const maxOrder = existingFolders.reduce(
        (max, f) => Math.max(max, f.order ?? -1),
        -1
      );
      order = maxOrder + 1;
    }

    // Create folder object
    const folderToSave: Folder = {
      id: folderId,
      name: folder.name.trim(),
      isPublic: folder.isPublic ?? false,
      createdAt: folder.createdAt || createdAt,
      order: order,
    };

    // Check if updating existing folder
    const existingIndex = existingFolders.findIndex((f) => f.id === folderId);
    if (existingIndex !== -1) {
      // Update existing folder
      existingFolders[existingIndex] = {
        ...existingFolders[existingIndex],
        ...folderToSave,
        createdAt: existingFolders[existingIndex].createdAt, // Preserve original createdAt
        order:
          folder.order !== undefined
            ? folder.order
            : existingFolders[existingIndex].order ?? order, // Preserve order if not updating
      };
    } else {
      // Add new folder
      existingFolders.push(folderToSave);
    }

    // Save the updated array back to storage
    const serializedData = JSON.stringify(existingFolders);
    await AsyncStorage.setItem(STORAGE_KEY, serializedData);

    return folderId;
  } catch (error) {
    console.error("Error saving folder to storage:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to save folder to storage: ${error.message}`);
    }
    throw new Error("Failed to save folder to storage: Unknown error");
  }
}

/**
 * Retrieves all stored folders from AsyncStorage
 *
 * @returns Promise<Folder[]> - Array of all stored folders
 * @throws Error if storage operation fails
 */
export async function getFolders(): Promise<Folder[]> {
  try {
    const foldersJson = await AsyncStorage.getItem(STORAGE_KEY);

    if (!foldersJson) {
      return [];
    }

    try {
      const folders: Folder[] = JSON.parse(foldersJson);

      // Validate that parsed data is an array
      if (!Array.isArray(folders)) {
        console.error("Corrupted storage data: folders is not an array");
        // Return empty array and clear corrupted data
        await AsyncStorage.removeItem(STORAGE_KEY);
        return [];
      }

      // Validate each folder has required fields
      const validFolders = folders.filter((folder) => {
        if (
          !folder ||
          typeof folder !== "object" ||
          !folder.id ||
          !folder.name
        ) {
          console.warn("Invalid folder entry found, skipping:", folder);
          return false;
        }
        return true;
      });

      // Calculate link counts for each folder
      const links = await getLinks();
      const foldersWithCounts = validFolders.map((folder) => {
        const linkCount = links.filter(
          (link) => link.folderId === folder.id
        ).length;
        return {
          ...folder,
          linkCount,
        };
      });

      // Sort by order field (fallback to createdAt if order not set)
      const sortedFolders = foldersWithCounts.sort((a, b) => {
        const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.order ?? Number.MAX_SAFE_INTEGER;

        if (orderA !== orderB) {
          return orderA - orderB;
        }

        // If order is same or both undefined, sort by createdAt
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });

      return sortedFolders;
    } catch (parseError) {
      console.error("Error parsing folders JSON:", parseError);
      // If JSON is corrupted, clear it and return empty array
      await AsyncStorage.removeItem(STORAGE_KEY);
      return [];
    }
  } catch (error) {
    console.error("Error retrieving folders from storage:", error);
    if (error instanceof Error) {
      throw new Error(
        `Failed to retrieve folders from storage: ${error.message}`
      );
    }
    throw new Error("Failed to retrieve folders from storage: Unknown error");
  }
}

/**
 * Retrieves a folder by ID from AsyncStorage
 *
 * @param id - The folder ID
 * @returns Promise<Folder | null> - The folder or null if not found
 * @throws Error if storage operation fails
 */
export async function getFolder(id: string): Promise<Folder | null> {
  try {
    const folders = await getFolders();
    return folders.find((folder) => folder.id === id) || null;
  } catch (error) {
    console.error("Error retrieving folder from storage:", error);
    if (error instanceof Error) {
      throw new Error(
        `Failed to retrieve folder from storage: ${error.message}`
      );
    }
    throw new Error("Failed to retrieve folder from storage: Unknown error");
  }
}

/**
 * Updates an existing folder by ID
 *
 * @param id - The folder ID to update
 * @param updates - Partial folder data with fields to update
 * @returns Promise<void> - Resolves when the folder is updated successfully
 * @throws Error if storage operation fails or folder is not found
 */
export async function updateFolder(
  id: string,
  updates: Partial<Omit<Folder, "id" | "createdAt">>
): Promise<void> {
  try {
    const folders = await getFolders();

    // Find the index of the folder with the matching ID
    const index = folders.findIndex((folder) => folder.id === id);

    if (index === -1) {
      throw new Error("Folder not found");
    }

    // Get the original folder
    const originalFolder = folders[index];

    // Check for duplicate name if name is being updated
    if (updates.name) {
      const duplicateName = folders.find(
        (f) =>
          f.name.trim().toLowerCase() === updates.name!.trim().toLowerCase() &&
          f.id !== id
      );
      if (duplicateName) {
        throw new Error("A folder with this name already exists");
      }
    }

    // Create updated folder - preserve ID and createdAt
    const updatedFolder: Folder = {
      ...originalFolder,
      ...updates,
      id: originalFolder.id, // ID cannot be changed
      createdAt: originalFolder.createdAt, // CreatedAt cannot be changed
      name: updates.name ? updates.name.trim() : originalFolder.name,
    };

    // Replace the folder at the found index
    folders[index] = updatedFolder;

    // Save the updated array back to storage (without linkCount, order preserved)
    const foldersToSave = folders.map(({ linkCount, ...folder }) => folder);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(foldersToSave));
  } catch (error) {
    console.error("Error updating folder in storage:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to update folder in storage: ${error.message}`);
    }
    throw new Error("Failed to update folder in storage: Unknown error");
  }
}

/**
 * Deletes a folder by ID from AsyncStorage
 * Note: This does not delete links in the folder, they will become orphaned (folderId set to null)
 *
 * @param id - The folder ID to delete
 * @returns Promise<void> - Resolves when the folder is deleted successfully
 * @throws Error if storage operation fails or folder is not found
 */
export async function deleteFolder(id: string): Promise<void> {
  try {
    const folders = await getFolders();

    // Find the index of the folder with the matching ID
    const index = folders.findIndex((folder) => folder.id === id);

    if (index === -1) {
      throw new Error("Folder not found");
    }

    // Remove the folder at the found index
    folders.splice(index, 1);

    // Save the updated array back to storage (without linkCount and order preserved)
    const foldersToSave = folders.map(({ linkCount, ...folder }) => folder);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(foldersToSave));
  } catch (error) {
    console.error("Error deleting folder from storage:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to delete folder from storage: ${error.message}`);
    }
    throw new Error("Failed to delete folder from storage: Unknown error");
  }
}

/**
 * Reorders folders based on the provided array of folder IDs
 * Updates the order field for all folders to match the new order
 *
 * @param folderIds - Array of folder IDs in the desired order
 * @returns Promise<void> - Resolves when folders are reordered successfully
 * @throws Error if storage operation fails
 */
export async function reorderFolders(folderIds: string[]): Promise<void> {
  try {
    const folders = await getFolders();

    // Create a map of folder IDs to folders
    const folderMap = new Map<string, Folder>();
    folders.forEach((folder) => {
      folderMap.set(folder.id, folder);
    });

    // Update order for each folder based on its position in folderIds array
    const updatedFolders = folderIds.map((folderId, index) => {
      const folder = folderMap.get(folderId);
      if (!folder) {
        throw new Error(`Folder with ID ${folderId} not found`);
      }
      return {
        ...folder,
        order: index,
      };
    });

    // Add any folders not in the reorder list (shouldn't happen, but handle gracefully)
    folders.forEach((folder) => {
      if (!folderIds.includes(folder.id)) {
        updatedFolders.push({
          ...folder,
          order: folder.order ?? updatedFolders.length,
        });
      }
    });

    // Save the updated folders (without linkCount)
    const foldersToSave = updatedFolders.map(
      ({ linkCount, ...folder }) => folder
    );
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(foldersToSave));
  } catch (error) {
    console.error("Error reordering folders:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to reorder folders: ${error.message}`);
    }
    throw new Error("Failed to reorder folders: Unknown error");
  }
}

/**
 * Gets the count of links in a folder
 *
 * @param id - The folder ID
 * @returns Promise<number> - The number of links in the folder
 * @throws Error if storage operation fails
 */
export async function getFolderLinkCount(id: string): Promise<number> {
  try {
    const links = await getLinks();
    return links.filter((link) => link.folderId === id).length;
  } catch (error) {
    console.error("Error getting folder link count:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to get folder link count: ${error.message}`);
    }
    throw new Error("Failed to get folder link count: Unknown error");
  }
}
