import re
import time
import requests
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Constants
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_DURATION = 3600  # Cache feed for 1 hour

# In-memory cache
feed_cache = {
    "data": None,
    "last_fetched": 0
}

def parse_html_content(html):
    """
    Parses the CDATA HTML content of an entry to extract distinct release items.
    Updates are structured under <h3> tags in the feed.
    """
    if not html:
        return []
    
    # Use regex to find all <h3>...</h3> tags and their contents
    matches = list(re.finditer(r'<h3[^>]*>(.*?)</h3>', html, re.DOTALL | re.IGNORECASE))
    
    if not matches:
        # If no h3 tags are found, return the entire content as a single update item
        return [{
            "type": "General",
            "content_html": html
        }]
    
    items = []
    for i in range(len(matches)):
        start_idx = matches[i].end()
        end_idx = matches[i+1].start() if i + 1 < len(matches) else len(html)
        
        item_type = matches[i].group(1).strip()
        item_content = html[start_idx:end_idx].strip()
        
        # Clean up tags or trailing whitespace
        # Ensure target links open in a new tab
        item_content = re.sub(r'<a href="', '<a target="_blank" rel="noopener noreferrer" href="', item_content)
        
        items.append({
            "type": item_type,
            "content_html": item_content
        })
        
    return items

def fetch_and_parse_feed():
    """
    Fetches the XML feed from Google Cloud and parses it.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    try:
        response = requests.get(FEED_URL, headers=headers, timeout=15)
        response.raise_for_status()
    except Exception as e:
        raise RuntimeError(f"Failed to download release notes feed: {str(e)}")
        
    try:
        root = ET.fromstring(response.content)
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        
        # Parse main feed metadata
        feed_title_el = root.find('atom:title', ns)
        feed_title = feed_title_el.text if feed_title_el is not None else "BigQuery Release Notes"
        
        feed_updated_el = root.find('atom:updated', ns)
        feed_updated = feed_updated_el.text if feed_updated_el is not None else ""
        
        entries = []
        for entry_el in root.findall('atom:entry', ns):
            title_el = entry_el.find('atom:title', ns)
            title = title_el.text if title_el is not None else "Release Note"
            
            updated_el = entry_el.find('atom:updated', ns)
            updated = updated_el.text if updated_el is not None else ""
            
            id_el = entry_el.find('atom:id', ns)
            entry_id = id_el.text if id_el is not None else ""
            
            link_el = entry_el.find('atom:link[@rel="alternate"]', ns)
            link = link_el.attrib.get('href') if link_el is not None else "https://cloud.google.com/bigquery/docs/release-notes"
            
            content_el = entry_el.find('atom:content', ns)
            raw_html = content_el.text if content_el is not None else ""
            
            # Extract individual updates
            items = parse_html_content(raw_html)
            
            entries.append({
                "id": entry_id,
                "date": title,
                "updated": updated,
                "link": link,
                "items": items
            })
            
        return {
            "title": feed_title,
            "updated": feed_updated,
            "entries": entries,
            "source": "live"
        }
    except Exception as e:
        raise RuntimeError(f"Failed to parse release notes feed XML: {str(e)}")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    current_time = time.time()
    
    # Check cache validity
    if not force_refresh and feed_cache["data"] and (current_time - feed_cache["last_fetched"] < CACHE_DURATION):
        data = feed_cache["data"].copy()
        data["source"] = "cache"
        data["cached_at"] = feed_cache["last_fetched"]
        return jsonify(data)
        
    try:
        data = fetch_and_parse_feed()
        feed_cache["data"] = data
        feed_cache["last_fetched"] = current_time
        return jsonify(data)
    except Exception as e:
        # If live fetch fails, fall back to cache if available
        if feed_cache["data"]:
            data = feed_cache["data"].copy()
            data["source"] = "cache_fallback"
            data["error_details"] = str(e)
            return jsonify(data)
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
