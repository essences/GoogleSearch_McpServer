from flask import Flask, request, jsonify
from flask_cors import CORS
from bs4 import BeautifulSoup
import requests
import trafilatura
from markdownify import markdownify
from urllib.parse import urlparse
import re
from typing import Dict, Optional

app = Flask(__name__)
CORS(app)

class LinkViewer:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
    def is_valid_url(self, url: str) -> bool:
        """Check if URL is valid and supported"""
        try:
            result = urlparse(url)
            return all([result.scheme, result.netloc])
        except:
            return False
    
    def _clean_markdown(self, md_text: str) -> str:
        """Clean up markdown text for better readability"""
        # Remove multiple blank lines
        md_text = re.sub(r'\n\s*\n\s*\n', '\n\n', md_text)
        # Remove excessive spaces
        md_text = re.sub(r' +', ' ', md_text)
        # Ensure headers have space after #
        md_text = re.sub(r'#([A-Za-z0-9])', r'# \1', md_text)
        return md_text.strip()
            
    def extract_content(self, url: str) -> Dict:
        """
        Extract webpage content and convert to Markdown
        Returns structured data including markdown content
        """
        if not self.is_valid_url(url):
            raise ValueError("Invalid URL provided")
            
        try:
            # Fetch the webpage
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            
            # Parse with BeautifulSoup
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Extract metadata
            meta_tags = {}
            for tag in soup.find_all('meta'):
                name = tag.get('name', tag.get('property', ''))
                content = tag.get('content', '')
                if name and content:
                    meta_tags[name] = content
            
            # Try trafilatura first for main content
            main_content_html = trafilatura.extract(response.text, 
                                                  include_links=True,
                                                  include_tables=True,
                                                  output_format='html')
            
            if main_content_html:
                # Convert main content to markdown
                markdown_content = markdownify(main_content_html, heading_style="ATX")
            else:
                # Fallback: Convert relevant body content
                # Remove unwanted elements first
                for element in soup.select('script, style, nav, footer, header, aside'):
                    element.decompose()
                
                main_content_html = str(soup.find('main') or soup.find('article') or soup.find('body'))
                markdown_content = markdownify(main_content_html, heading_style="ATX")
            
            # Clean up the markdown
            markdown_content = self._clean_markdown(markdown_content)
            
            # Calculate content stats
            word_count = len(re.findall(r'\w+', markdown_content))
            
            # Structure the extracted data
            extracted_data = {
                'url': url,
                'title': soup.title.string if soup.title else '',
                'description': meta_tags.get('description', ''),
                'markdown_content': markdown_content,
                'meta_tags': meta_tags,
                'stats': {
                    'word_count': word_count,
                    'approximate_chars': len(markdown_content)
                },
                'content_preview': {
                    'first_500_chars': markdown_content[:500] + '...' if len(markdown_content) > 500 else markdown_content
                }
            }
            
            return extracted_data
            
        except requests.RequestException as e:
            raise Exception(f"Failed to fetch content: {str(e)}")
        except Exception as e:
            raise Exception(f"Error processing content: {str(e)}")

# Initialize the LinkViewer
viewer = LinkViewer()

@app.route('/analyze', methods=['POST'])
def analyze_link():
    """Endpoint to analyze a webpage and convert to markdown"""
    data = request.get_json()
    
    if not data or 'url' not in data:
        return jsonify({'error': 'Missing URL'}), 400
        
    try:
        content = viewer.extract_content(data['url'])
        return jsonify(content), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'Analysis failed: {str(e)}'}), 500

@app.route('/batch_analyze', methods=['POST'])
def batch_analyze():
    """Endpoint to analyze multiple URLs"""
    data = request.get_json()
    
    if not data or 'urls' not in data:
        return jsonify({'error': 'Missing URLs'}), 400
        
    results = {}
    for url in data['urls']:
        try:
            results[url] = viewer.extract_content(url)
        except Exception as e:
            results[url] = {'error': str(e)}
    
    return jsonify(results), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5004)