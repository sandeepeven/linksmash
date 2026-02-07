/**
 * Link Data Model
 *
 * This file defines the TypeScript interface for link data stored in the database.
 * Each link represents a shared URL along with its fetched metadata.
 */

/**
 * Interface representing a link stored in the database
 *
 * @property url - The shared URL
 * @property title - The title extracted from metadata (Open Graph or meta tag)
 * @property description - The description extracted from metadata (Open Graph or meta tag)
 * @property image - The image URL extracted from metadata (Open Graph or Twitter card)
 * @property tag - The automatically detected or manually assigned tag (e.g., "shopping", "news", "social")
 * @property folderId - Optional ID of the folder this link belongs to
 * @property createdAt - ISO timestamp string indicating when the link was saved
 * @property metadataFetched - Boolean flag indicating whether metadata was successfully fetched
 */
export interface LinkData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  tag: string | null;
  /**
   * Optional ID of the folder this link belongs to.
   * If null, the link is not assigned to any folder.
   */
  folderId: string | null;
  /**
   * Array of URIs pointing to images shared alongside the link.
   * These may include local file paths (file:// or content://) or remote URLs.
   */
  sharedImages: string[];
  createdAt: string;
  metadataFetched: boolean;
}

/**
 * Interface representing the response from my.linkpreview.net API
 *
 * @property title - The title of the webpage
 * @property description - The description of the webpage
 * @property image - The image URL for the webpage
 * @property url - The original URL
 * @property error - Optional error message if the API request fails
 */
export interface LinkPreviewResponse {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  error?: string;
}
