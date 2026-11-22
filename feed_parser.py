import re
import html
import requests
import xml.etree.ElementTree as ET
from urllib.parse import quote

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
ATOM_NS = {"atom": "http://www.w3.org/2005/Atom"}


def strip_html_tags(text: str) -> str:
    """Removes HTML tags and normalizes whitespace."""
    if not text:
        return ""
    clean = re.sub(r"<[^>]+>", " ", text)
    clean = html.unescape(clean)
    return " ".join(clean.split())


def extract_links_from_html(html_text: str) -> list[dict]:
    """Extracts href links and their anchor text from HTML snippet."""
    links = []
    pattern = re.compile(r'<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)</a>', re.IGNORECASE)
    for match in pattern.finditer(html_text):
        url = match.group(1).strip()
        text = strip_html_tags(match.group(2)).strip()
        if url:
            links.append({"url": url, "text": text or url})
    return links


def format_tweet_text(category: str, date_str: str, summary: str, link: str) -> str:
    """
    Crafts a concise, engaging tweet draft within 280 characters.
    URL counts as 23 characters on X/Twitter.
    """
    prefix = f"⚡ Google #BigQuery [{category}] ({date_str}): "
    suffix = f" {link} #GoogleCloud #DataEngineering"
    
    # Twitter t.co wraps URLs to ~23 chars, but in raw text limit to ~280
    max_summary_len = 280 - len(prefix) - len(suffix)
    if max_summary_len < 40:
        suffix = f" {link} #BigQuery"
        max_summary_len = 280 - len(prefix) - len(suffix)

    if len(summary) > max_summary_len:
        truncated_summary = summary[: max_summary_len - 3].rstrip() + "..."
    else:
        truncated_summary = summary

    return f"{prefix}{truncated_summary}{suffix}"


def fetch_and_parse_feed(feed_url: str = FEED_URL) -> dict:
    """
    Fetches the Atom feed from Google Cloud and parses each entry and update.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) BigQueryReleaseNotesApp/1.0"
    }
    
    response = requests.get(feed_url, headers=headers, timeout=12)
    response.raise_for_status()

    root = ET.fromstring(response.content)

    feed_title_el = root.find("atom:title", ATOM_NS)
    feed_title = feed_title_el.text if feed_title_el is not None else "BigQuery Release Notes"

    feed_updated_el = root.find("atom:updated", ATOM_NS)
    feed_updated = feed_updated_el.text if feed_updated_el is not None else ""

    entries = root.findall("atom:entry", ATOM_NS)
    
    all_updates = []
    categories_found = set()

    for entry_idx, entry in enumerate(entries):
        title_el = entry.find("atom:title", ATOM_NS)
        entry_title = title_el.text.strip() if title_el is not None and title_el.text else "Release Update"

        updated_el = entry.find("atom:updated", ATOM_NS)
        entry_updated = updated_el.text.strip() if updated_el is not None and updated_el.text else ""

        link_el = entry.find("atom:link", ATOM_NS)
        entry_link = link_el.attrib.get("href", "").strip() if link_el is not None else ""

        content_el = entry.find("atom:content", ATOM_NS)
        content_raw = content_el.text if content_el is not None and content_el.text else ""

        # Check for <h3> headers dividing updates
        parts = re.split(r"<h3>(.*?)</h3>", content_raw)

        if len(parts) > 1:
            item_counter = 0
            for i in range(1, len(parts), 2):
                cat = parts[i].strip() or "General"
                item_html = parts[i + 1].strip()
                summary = strip_html_tags(item_html)
                categories_found.add(cat)

                item_id = f"entry-{entry_idx}-item-{item_counter}"
                item_counter += 1

                extracted_links = extract_links_from_html(item_html)

                tweet = format_tweet_text(cat, entry_title, summary, entry_link)
                tweet_intent_url = f"https://twitter.com/intent/tweet?text={quote(tweet)}"

                all_updates.append({
                    "id": item_id,
                    "entry_index": entry_idx,
                    "entry_title": entry_title,
                    "entry_updated": entry_updated,
                    "entry_link": entry_link,
                    "category": cat,
                    "html": item_html,
                    "summary": summary,
                    "links": extracted_links,
                    "tweet_text": tweet,
                    "tweet_intent_url": tweet_intent_url
                })
        else:
            # Fallback if no <h3> tags found
            summary = strip_html_tags(content_raw)
            cat = "General"
            categories_found.add(cat)
            item_id = f"entry-{entry_idx}-item-0"
            tweet = format_tweet_text(cat, entry_title, summary, entry_link)
            tweet_intent_url = f"https://twitter.com/intent/tweet?text={quote(tweet)}"

            all_updates.append({
                "id": item_id,
                "entry_index": entry_idx,
                "entry_title": entry_title,
                "entry_updated": entry_updated,
                "entry_link": entry_link,
                "category": cat,
                "html": content_raw,
                "summary": summary,
                "links": extract_links_from_html(content_raw),
                "tweet_text": tweet,
                "tweet_intent_url": tweet_intent_url
            })

    sorted_categories = sorted(list(categories_found))

    return {
        "status": "success",
        "feed_title": feed_title,
        "feed_updated": feed_updated,
        "feed_url": feed_url,
        "total_entries": len(entries),
        "total_updates": len(all_updates),
        "categories": ["All"] + sorted_categories,
        "updates": all_updates
    }
