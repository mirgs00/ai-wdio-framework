import axios from 'axios';
import { logger } from '../logger';

/**
 * Fetches the full HTML DOM of a given URL.
 * @param url The page URL to fetch
 * @returns The raw HTML string
 */
export async function fetchDOM(url: string): Promise<string> {
  logger.info(`Fetching DOM from: ${url}`);
  const response = await axios.get(url);
  logger.info('DOM fetched successfully');
  return response.data;
}
