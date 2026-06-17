// src/utils/dom/domParser.ts
import axios from 'axios';
import { logger } from '../logger';

/**
 * Validates if a string is a valid URL with allowed protocols
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    // Only allow http and https protocols
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function getDOMSnapshot(url: string): Promise<string> {
  if (!isValidUrl(url)) {
    throw new Error(`Invalid URL: ${url}. Only http:// and https:// URLs are allowed.`);
  }

  try {
    logger.info(`Fetching DOM from: ${url}`);
    const response = await axios.get(url, {
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400,
    });
    logger.info('DOM fetched successfully');
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`Connection refused: ${url}. Please check if the URL is accessible.`);
      } else if (error.response) {
        throw new Error(
          `Failed to fetch DOM: HTTP ${error.response.status} - ${error.response.statusText}`
        );
      } else if (error.request) {
        throw new Error(`No response received from ${url}. Check your network connection.`);
      }
    }
    logger.error(`Failed to fetch DOM from ${url}: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Alias for backward compatibility
export const fetchDOM = getDOMSnapshot;
