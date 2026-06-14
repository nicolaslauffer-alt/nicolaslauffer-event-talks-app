import os
import json
import time
import requests
import xml.etree.ElementTree as ET
import hashlib
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "notes_cache.json")
CACHE_DURATION = 3600  # Cache for 1 hour by default

def parse_html_updates(html_content, date_str, link):
    if not html_content:
        return []
    
    soup = BeautifulSoup(html_content, 'html.parser')
    updates = []
    
    headings = soup.find_all('h3')
    if not headings:
        # If there are no h3 tags, treat the whole content as one update
        content_text = soup.get_text().strip()
        content_hash = hashlib.md5((date_str + "Update" + content_text).encode('utf-8')).hexdigest()[:8]
        return [{
            'id': f"up-{content_hash}",
            'type': 'Update',
            'content_html': str(soup),
            'content_text': content_text,
            'date': date_str,
            'link': link
        }]
    
    for h3 in headings:
        update_type = h3.get_text().strip()
        
        # Collect siblings until next h3
        elements = []
        sibling = h3.next_sibling
        while sibling and sibling.name != 'h3':
            # Skip empty text elements
            if sibling.name or str(sibling).strip():
                elements.append(sibling)
            sibling = sibling.next_sibling
        
        # Build HTML content for this update
        html_parts = []
        for el in elements:
            html_parts.append(str(el))
        content_html = "".join(html_parts).strip()
        
        # Build clean plain text version
        sub_soup = BeautifulSoup(content_html, 'html.parser')
        
        # Format links for plain text (e.g. "Google (https://google.com)")
        for a in sub_soup.find_all('a'):
            href = a.get('href', '')
            if href and not href.startswith('#'):
                # Handle relative URLs if any (Google docs URLs are usually absolute, but let's make sure)
                if href.startswith('/'):
                    href = 'https://cloud.google.com' + href
                a.replace_with(f"{a.get_text()} ({href})")
        
        # Format bullet points for plain text
        for ul in sub_soup.find_all('ul'):
            for li in ul.find_all('li'):
                li.replace_with(f"• {li.get_text()}\n")
        
        # Replace code tags with backticks for markdown-like look in Tweet
        for code in sub_soup.find_all('code'):
            code.replace_with(f"`{code.get_text()}`")
            
        content_text = sub_soup.get_text().strip()
        # Clean up excessive newlines
        content_text = "\n".join([line.strip() for line in content_text.split('\n') if line.strip()])
        
        content_hash = hashlib.md5((date_str + update_type + content_text).encode('utf-8')).hexdigest()[:8]
        
        updates.append({
            'id': f"up-{content_hash}",
            'type': update_type,
            'content_html': content_html,
            'content_text': content_text,
            'date': date_str,
            'link': link
        })
        
    return updates

def fetch_and_parse_feed():
    try:
        response = requests.get(FEED_URL, timeout=15)
        response.raise_for_status()
        xml_content = response.content
        
        root = ET.fromstring(xml_content)
        # Handle namespaces
        ns = {'ns': 'http://www.w3.org/2005/Atom'}
        
        all_updates = []
        
        # Feed-level info
        feed_title_el = root.find('ns:title', ns)
        feed_title = feed_title_el.text if feed_title_el is not None else "BigQuery Release Notes"
        
        for entry in root.findall('ns:entry', ns):
            title_el = entry.find('ns:title', ns)
            date_str = title_el.text if title_el is not None else "Unknown Date"
            
            link_el = entry.find("ns:link[@rel='alternate']", ns)
            if link_el is None:
                link_el = entry.find("ns:link", ns)
            link = link_el.attrib.get('href', '') if link_el is not None else ''
            
            content_el = entry.find('ns:content', ns)
            html_content = content_el.text if content_el is not None else ''
            
            # Extract individual updates from this entry
            updates = parse_html_updates(html_content, date_str, link)
            all_updates.extend(updates)
            
        # Sort updates by date descending (though feed is usually already sorted)
        # Note: XML entries are usually ordered newest first, which is what we want.
        
        cache_data = {
            'timestamp': time.time(),
            'feed_title': feed_title,
            'updates': all_updates
        }
        
        # Save to cache file
        with open(CACHE_FILE, 'w') as f:
            json.dump(cache_data, f, indent=2)
            
        return cache_data, False  # data, is_cached
    except Exception as e:
        print(f"Error fetching feed: {e}")
        # Try to return cached data if available, even if expired
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, 'r') as f:
                    cache_data = json.load(f)
                cache_data['error'] = f"Failed to fetch live data: {str(e)}. Displaying cached data."
                return cache_data, True
            except Exception as cache_err:
                print(f"Error reading cache: {cache_err}")
        
        return {'error': f"Failed to fetch feed and no cached data is available. Error: {str(e)}", 'updates': []}, False

def get_notes(force_refresh=False):
    if not force_refresh and os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r') as f:
                cache_data = json.load(f)
            
            # Check if cache is still valid
            if time.time() - cache_data.get('timestamp', 0) < CACHE_DURATION:
                return cache_data, True  # data, is_cached
        except Exception as e:
            print(f"Error reading cache, will fetch live: {e}")
            
    # Fetch live data
    return fetch_and_parse_feed()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/notes')
def api_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    data, is_cached = get_notes(force_refresh)
    
    response_data = {
        'success': 'error' not in data,
        'cached': is_cached,
        'timestamp': data.get('timestamp', time.time()),
        'feed_title': data.get('feed_title', 'BigQuery Release Notes'),
        'updates': data.get('updates', [])
    }
    if 'error' in data:
        response_data['error'] = data['error']
        
    return jsonify(response_data)

if __name__ == '__main__':
    app.run(debug=True, port=5001)
