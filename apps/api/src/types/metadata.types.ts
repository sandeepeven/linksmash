/**
 * Metadata Types
 *
 * This file defines TypeScript interfaces for metadata responses.
 * Matches the LinkData interface from the Expo app for compatibility.
 */

/**
 * Interface representing metadata response matching LinkData from Expo app
 */
export interface MetadataResponse {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  tag: string | null;
  metadataFetched: boolean;
}

