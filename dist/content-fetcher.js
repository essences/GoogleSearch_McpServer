import axios from 'axios';
export class ContentFetcher {
    constructor(port = 5004) {
        this.baseUrl = `http://localhost:${port}`;
    }
    async fetchContent(url) {
        try {
            const response = await axios.post(`${this.baseUrl}/analyze`, { url });
            return response.data;
        }
        catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Failed to fetch content: ${error.response?.data?.error || error.message}`);
            }
            if (error instanceof Error) {
                throw new Error(`Failed to fetch content: ${error.message}`);
            }
            throw new Error('Failed to fetch content: Unknown error');
        }
    }
    async batchFetchContent(urls) {
        try {
            const response = await axios.post(`${this.baseUrl}/batch_analyze`, { urls });
            return response.data;
        }
        catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Failed to batch fetch content: ${error.response?.data?.error || error.message}`);
            }
            if (error instanceof Error) {
                throw new Error(`Failed to batch fetch content: ${error.message}`);
            }
            throw new Error('Failed to batch fetch content: Unknown error');
        }
    }
}
