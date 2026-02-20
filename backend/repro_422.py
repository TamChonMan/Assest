from fastapi.testclient import TestClient
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from main import app

client = TestClient(app)

def test_repro():
    print("Testing raw list body...")
    res = client.put("/assets/1/tags", json=[1])
    print(f"Status: {res.status_code}")
    print(f"Response: {res.text}")

    print("\nTesting wrapped body...")
    res = client.put("/assets/1/tags", json={"tag_ids": [1]})
    print(f"Status: {res.status_code}")
    print(f"Response: {res.text}")

if __name__ == "__main__":
    test_repro()
