from flask import Flask, request, jsonify, send_from_directory
import json
from googleapiclient.discovery import build
from typing import Dict, List
from flask_cors import CORS
import os

app = Flask(__name__, static_folder='static')
CORS(app)  # Enable CORS for frontend development

class MCPServer:
    def __init__(self):
        self.api_key = None
        self.cse_id = None
        self.search_service = None
        self.load_settings()
    
    def load_settings(self):
        """Load Google API credentials from environment variables or api-keys.json"""
        try:
            # First try to get from environment variables
            self.api_key = os.environ.get('GOOGLE_API_KEY')
            self.cse_id = os.environ.get('GOOGLE_SEARCH_ENGINE_ID')
            
            # If not found in environment variables, try api-keys.json
            if not self.api_key or not self.cse_id:
                with open('api-keys.json', 'r') as f:
                    config = json.load(f)
                
                self.api_key = config.get('api_key')
                self.cse_id = config.get('search_engine_id')
            
            if not self.api_key or not self.cse_id:
                raise ValueError("Missing API credentials. Please set GOOGLE_API_KEY and GOOGLE_SEARCH_ENGINE_ID environment variables or configure api-keys.json")
            
            self.initialize_google_search()
        except Exception as e:
            raise ValueError(f"Failed to load API credentials: {str(e)}")
    
    def initialize_google_search(self):
        """Initialize Google Custom Search API service"""
        self.search_service = build("customsearch", "v1", developerKey=self.api_key)
    
    def perform_search(self, query: str, num_results: int = 10, date_restrict: str = None, 
                      language: str = None, country: str = None, safe_search: str = None) -> List[Dict]:
        """
        Perform a Google search and return formatted results
        
        Parameters:
        - query: Search query string
        - num_results: Number of results to return (max 10)
        - date_restrict: Restrict results to a date range (e.g., 'd1', 'w2', 'm3', 'y1')
        - language: Restrict results to a specific language (e.g., 'en', 'es', 'fr')
        - country: Restrict results to a specific country (e.g., 'us', 'uk', 'ca')
        - safe_search: Safe search level ('off', 'medium', 'high')
        """
        if not self.search_service:
            raise ValueError("Google Search API not initialized")
            
        try:
            # Build search parameters
            search_params = {
                'q': query,
                'cx': self.cse_id,
                'num': min(num_results, 10)
            }
            
            # Add optional parameters if provided
            if date_restrict:
                search_params['dateRestrict'] = date_restrict
            if language:
                search_params['lr'] = f'lang_{language}'
            if country:
                search_params['cr'] = f'country{country.upper()}'
            if safe_search:
                search_params['safe'] = safe_search
                
            # Execute search with parameters
            result = self.search_service.cse().list(**search_params).execute()
            
            formatted_results = []
            if 'items' in result:
                for item in result['items']:
                    formatted_results.append({
                        'title': item.get('title', ''),
                        'link': item.get('link', ''),
                        'snippet': item.get('snippet', ''),
                        'pagemap': item.get('pagemap', {}),
                        'datePublished': item.get('pagemap', {}).get('metatags', [{}])[0].get('article:published_time', ''),
                        'source': 'google_search'
                    })
                    
            return formatted_results
            
        except Exception as e:
            print(f"Search error: {str(e)}")
            return []

# Initialize the MCP server
mcp = MCPServer()

@app.route('/')
def serve_frontend():
    """Serve the frontend HTML"""
    return send_from_directory('static', 'index.html')

@app.route('/search', methods=['POST'])
def search():
    """Endpoint to perform Google search"""
    data = request.get_json()
    
    if not data or 'query' not in data:
        return jsonify({'error': 'Missing search query'}), 400
        
    # Extract search parameters
    query = data['query']
    num_results = data.get('num_results', 10)
    date_restrict = data.get('date_restrict')
    language = data.get('language')
    country = data.get('country')
    safe_search = data.get('safe_search')
    
    try:
        results = mcp.perform_search(
            query=query, 
            num_results=num_results,
            date_restrict=date_restrict,
            language=language,
            country=country,
            safe_search=safe_search
        )
        return jsonify({'results': results}), 200
    except Exception as e:
        return jsonify({'error': f'Search failed: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002)
