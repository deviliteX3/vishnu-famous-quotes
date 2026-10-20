import json
import os
import sys

# Ensure parent directory is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from app import app, DATA_PATH


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_dataset_contains_100_quotes():
    """Verify that quotes.json contains exactly 100 well-formatted quotes."""
    assert os.path.exists(DATA_PATH), "Dataset file does not exist"
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        quotes = json.load(f)

    assert len(quotes) == 100, f"Expected 100 quotes, found {len(quotes)}"

    ids = set()
    for q in quotes:
        assert "id" in q and isinstance(q["id"], int)
        assert "quote" in q and len(q["quote"].strip()) > 0
        assert "author" in q and len(q["author"].strip()) > 0
        assert "category" in q and len(q["category"].strip()) > 0
        assert "tags" in q and isinstance(q["tags"], list)
        ids.add(q["id"])

    assert len(ids) == 100, "Quote IDs must be unique"


def test_index_route(client):
    """Verify that GET / renders successfully."""
    response = client.get("/")
    assert response.status_code == 200
    assert b"<!DOCTYPE html>" in response.data or b"<html" in response.data


def test_random_quote(client):
    """Verify that GET /api/quotes/random returns a valid quote."""
    response = client.get("/api/quotes/random")
    assert response.status_code == 200
    data = response.get_json()
    assert "quote" in data
    assert "author" in data
    assert "category" in data


def test_random_quote_with_category(client):
    """Verify random quote filtered by category."""
    response = client.get("/api/quotes/random?category=Philosophy+%26+Life")
    assert response.status_code == 200
    data = response.get_json()
    assert data["category"] == "Philosophy & Life"


def test_random_quote_not_found(client):
    """Verify 404 when filter yields zero results."""
    response = client.get("/api/quotes/random?author=NonExistentPersonXYZ")
    assert response.status_code == 404
    data = response.get_json()
    assert "error" in data


def test_get_all_quotes(client):
    """Verify GET /api/quotes returns 100 quotes."""
    response = client.get("/api/quotes")
    assert response.status_code == 200
    data = response.get_json()
    assert data["total"] == 100
    assert data["count"] == 100
    assert len(data["quotes"]) == 100


def test_search_by_author(client):
    """Verify search filter by author."""
    response = client.get("/api/quotes?author=Einstein")
    assert response.status_code == 200
    data = response.get_json()
    assert data["count"] > 0
    for q in data["quotes"]:
        assert "einstein" in q["author"].lower()


def test_search_by_category(client):
    """Verify filter by category."""
    response = client.get("/api/quotes?category=Science+%26+Technology")
    assert response.status_code == 200
    data = response.get_json()
    assert data["count"] > 0
    for q in data["quotes"]:
        assert q["category"] == "Science & Technology"


def test_search_by_query(client):
    """Verify full-text query across quotes and tags."""
    response = client.get("/api/quotes?q=imagination")
    assert response.status_code == 200
    data = response.get_json()
    assert data["count"] >= 1
    # Einstein's imagination quote should be in results
    authors = [q["author"] for q in data["quotes"]]
    assert any("Einstein" in a or "Picasso" in a for a in authors)


def test_get_categories(client):
    """Verify categories endpoint."""
    response = client.get("/api/categories")
    assert response.status_code == 200
    categories = response.get_json()
    assert len(categories) >= 5
    cat_names = [c["name"] for c in categories]
    assert "Philosophy & Life" in cat_names
    assert "Science & Technology" in cat_names
    total_count = sum(c["count"] for c in categories)
    assert total_count == 100


def test_get_authors(client):
    """Verify authors endpoint returns sorted distinct authors."""
    response = client.get("/api/authors")
    assert response.status_code == 200
    authors = response.get_json()
    assert len(authors) > 20
    assert "Albert Einstein" in authors
    assert "Socrates" in authors
    assert authors == sorted(authors)


def test_get_stats(client):
    """Verify stats endpoint."""
    response = client.get("/api/stats")
    assert response.status_code == 200
    data = response.get_json()
    assert data["total_quotes"] == 100
    assert data["total_categories"] >= 5
    assert data["total_authors"] > 20
