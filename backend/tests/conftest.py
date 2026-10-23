import pytest
from fastapi.testclient import TestClient

from app.core.graph import repository
from app.main import app


@pytest.fixture(scope="session")
def indoor_map():
    return repository.get_map("virtual-station-v1")


@pytest.fixture(scope="session")
def client():
    return TestClient(app)
