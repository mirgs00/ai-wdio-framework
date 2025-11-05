import axios from 'axios';

/**
 * Fetches the full HTML DOM of a given URL.
 * @param url The page URL to fetch
 * @returns The raw HTML string
 */
export async function fetchDOM(url: string): Promise<string> {
  console.log(`🌐 Fetching DOM from: ${url}`);
  const response = await axios.get(url);
  console.log('✅ DOM fetched successfully');
  return response.data;
}
