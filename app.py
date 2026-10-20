import json
import os
import random
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Path to quotes dataset
DATA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "quotes.json")


def load_quotes():
    """Load quotes dataset from JSON file."""
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


@app.route("/")
def index():
    """Render the single-page application UI."""
    return render_template("index.html")


@app.route("/api/quotes/random")
def get_random_quote():
    """
    Return a single random quote.
    Supports optional filters: ?category=... and ?author=...
    """
    quotes = load_quotes()
    category = request.args.get("category", "").strip().lower()
    author = request.args.get("author", "").strip().lower()

    filtered = quotes
    if category:
        filtered = [q for q in filtered if q.get("category", "").lower() == category]
    if author:
        filtered = [q for q in filtered if author in q.get("author", "").lower()]

    if not filtered:
        return jsonify({"error": "No quotes found matching criteria"}), 404

    return jsonify(random.choice(filtered))


@app.route("/api/quotes")
def get_quotes():
    """
    Return filtered quotes.
    Query parameters:
      - q: search in quote text and author name
      - author: filter by author name (case-insensitive substring)
      - category: filter by category (case-insensitive exact)
    """
    quotes = load_quotes()
    query = request.args.get("q", "").strip().lower()
    author = request.args.get("author", "").strip().lower()
    category = request.args.get("category", "").strip().lower()

    results = quotes

    if category:
        results = [q for q in results if q.get("category", "").lower() == category]

    if author:
        results = [q for q in results if author in q.get("author", "").lower()]

    if query:
        results = [
            q for q in results
            if query in q.get("quote", "").lower()
            or query in q.get("author", "").lower()
            or any(query in tag.lower() for tag in q.get("tags", []))
        ]

    return jsonify({
        "count": len(results),
        "total": len(quotes),
        "quotes": results
    })


@app.route("/api/categories")
def get_categories():
    """Return distinct categories along with quote count."""
    quotes = load_quotes()
    counts = {}
    for q in quotes:
        cat = q.get("category", "General")
        counts[cat] = counts.get(cat, 0) + 1

    category_list = [
        {"name": cat, "count": count}
        for cat, count in sorted(counts.items())
    ]
    return jsonify(category_list)


@app.route("/api/authors")
def get_authors():
    """Return distinct sorted list of author names."""
    quotes = load_quotes()
    authors = sorted({q.get("author", "") for q in quotes if q.get("author")})
    return jsonify(authors)


@app.route("/api/stats")
def get_stats():
    """Return summary statistics."""
    quotes = load_quotes()
    categories = {q.get("category", "") for q in quotes}
    authors = {q.get("author", "") for q in quotes}
    return jsonify({
        "total_quotes": len(quotes),
        "total_authors": len(authors),
        "total_categories": len(categories)
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)
