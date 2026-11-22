import os
import time
import io
import csv
from flask import Flask, render_template, jsonify, request, Response
from feed_parser import fetch_and_parse_feed

app = Flask(__name__)

# Simple in-memory cache to prevent excessive requests
_cache = {
    "data": None,
    "timestamp": 0
}
CACHE_TTL_SECONDS = 120  # 2 minutes auto-cache; refresh button bypasses cache


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/feed")
def get_feed():
    force_refresh = request.args.get("refresh", "false").lower() in ("true", "1", "yes")
    now = time.time()

    if not force_refresh and _cache["data"] and (now - _cache["timestamp"] < CACHE_TTL_SECONDS):
        cached_response = dict(_cache["data"])
        cached_response["cached"] = True
        cached_response["cached_age_seconds"] = int(now - _cache["timestamp"])
        return jsonify(cached_response)

    try:
        data = fetch_and_parse_feed()
        _cache["data"] = data
        _cache["timestamp"] = now
        data_copy = dict(data)
        data_copy["cached"] = False
        data_copy["fetched_at"] = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(now))
        return jsonify(data_copy)
    except Exception as e:
        # If upstream fails but we have stale cache, return stale cache with warning
        if _cache["data"]:
            stale_copy = dict(_cache["data"])
            stale_copy["warning"] = f"Failed to fetch upstream feed ({str(e)}). Showing cached data."
            stale_copy["cached"] = True
            return jsonify(stale_copy)
        
        return jsonify({
            "status": "error",
            "message": f"Unable to fetch BigQuery release notes: {str(e)}"
        }), 502


@app.route("/api/export-csv")
def export_csv():
    category = request.args.get("category", "All")
    query = request.args.get("q", "").strip().lower()

    if not _cache["data"]:
        try:
            _cache["data"] = fetch_and_parse_feed()
            _cache["timestamp"] = time.time()
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 502

    updates = _cache["data"].get("updates", [])
    filtered = []
    for item in updates:
        if category != "All" and item.get("category") != category:
            continue
        if query:
            summary = item.get("summary", "").lower()
            date_title = item.get("entry_title", "").lower()
            cat = item.get("category", "").lower()
            if query not in summary and query not in date_title and query not in cat:
                continue
        filtered.append(item)

    output = io.StringIO()
    # Write UTF-8 BOM for Microsoft Excel compatibility
    output.write("\ufeff")
    writer = csv.writer(output, quoting=csv.QUOTE_ALL)
    writer.writerow(["Date", "Category", "Summary", "Link", "Tweet Draft"])

    for item in filtered:
        writer.writerow([
            item.get("entry_title", ""),
            item.get("category", ""),
            item.get("summary", ""),
            item.get("entry_link", ""),
            item.get("tweet_text", "")
        ])

    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=bigquery-release-notes.csv",
            "Content-Type": "text/csv; charset=utf-8"
        }
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() in ("true", "1")
    print(f"Starting BigQuery Release Notes App on http://127.0.0.1:{port}")
    app.run(host="127.0.0.1", port=port, debug=debug)
