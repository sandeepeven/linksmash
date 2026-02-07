/**
 * Folder Data Model
 *
 * This file defines the TypeScript interface for folder data stored in the database.
 * Folders allow users to organize their links into collections.
 */

/**
 * Interface representing a folder stored in the database
 *
 * @property id - Unique identifier for the folder (UUID or timestamp-based)
 * @property name - The name of the folder
 * @property isPublic - Whether the folder is public (for future use)
 * @property createdAt - ISO timestamp string indicating when the folder was created
 * @property order - Optional order value for sorting folders (lower values appear first)
 * @property linkCount - Optional computed property for the number of links in the folder (not stored)
 */
export interface Folder {
  id: string;
  name: string;
  isPublic: boolean;
  createdAt: string;
  order?: number;
  linkCount?: number;
}

