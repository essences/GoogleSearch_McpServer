import axios from 'axios';
import { WebpageContent, WebpageAnalysisResponse } from './types.js';

export class ContentFetcher {
  private readonly baseUrl: string;

  constructor(port: number = 5002) {
    this.baseUrl = `http://localhost:${port}`;
  }

  async fetchContent(url: string): Promise<WebpageContent> {
    try {
      const response = await axios.post(`${this.baseUrl}/analyze`, { url });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to fetch content: ${error.response?.data?.error || error.message}`);
      }
      throw error;
    }
  }

  async batchFetchContent(urls: string[]): Promise<WebpageAnalysisResponse> {
    try {
      const response = await axios.post(`${this.baseUrl}/batch_analyze`, { urls });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to batch fetch content: ${error.response?.data?.error || error.message}`);
      }
      throw error;
    }
  }
}
