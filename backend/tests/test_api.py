def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_maps_and_scenarios(client):
    maps = client.get("/api/maps")
    assert maps.status_code == 200 and maps.json()[0]["id"] == "virtual-station-v1"
    detail = client.get("/api/maps/virtual-station-v1")
    assert detail.status_code == 200 and len(detail.json()["edges"]) >= 10
    scenarios = client.get("/api/scenarios")
    assert scenarios.status_code == 200 and len(scenarios.json()) >= 4


def test_calculate_and_compare(client):
    body = {"map_id": "virtual-station-v1", "start_node_id": "S1", "reaction_delay_s": 3}
    calculated = client.post("/api/routes/calculate", json=body)
    assert calculated.status_code == 200 and calculated.json()["reachable"]
    compared = client.post("/api/routes/compare", json=body)
    assert compared.status_code == 200 and not compared.json()["path_changed"]


def test_api_errors_are_clear(client):
    missing_map = client.post("/api/routes/calculate", json={"map_id": "missing", "start_node_id": "S1"})
    assert missing_map.status_code == 404 and "does not exist" in missing_map.json()["detail"]
    bad_node = client.post("/api/routes/calculate", json={"map_id": "virtual-station-v1", "start_node_id": "bad"})
    assert bad_node.status_code == 422 and "start_node_id" in bad_node.json()["detail"]
    negative = client.post("/api/routes/calculate", json={
        "map_id": "virtual-station-v1", "start_node_id": "S1", "congestion_delays": {"A01": -2}
    })
    assert negative.status_code == 422


def test_frontend_map_and_route_references_are_complete(client):
    indoor_map = client.get("/api/maps/virtual-station-v1").json()
    nodes = {node["id"]: node for node in indoor_map["nodes"]}
    edges = {edge["id"]: edge for edge in indoor_map["edges"]}
    assert all(isinstance(node["x"], (int, float)) and isinstance(node["y"], (int, float))
               for node in nodes.values())
    assert all(edge["source"] in nodes and edge["target"] in nodes for edge in edges.values())

    route = client.post("/api/routes/calculate", json={
        "map_id": "virtual-station-v1", "start_node_id": "S1"
    }).json()
    assert all(node_id in nodes for node_id in route["path_nodes"])
    assert all(edge_id in edges for edge_id in route["path_edges"])
    assert len(route["path_edges"]) == len(route["path_nodes"]) - 1


def test_cors_allows_local_react_origin_only(client):
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
    }
    allowed = client.options("/api/routes/calculate", headers=headers)
    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"

    denied = client.options("/api/routes/calculate", headers={**headers, "Origin": "https://example.com"})
    assert denied.status_code == 400
    assert "access-control-allow-origin" not in denied.headers


def test_zero_walking_speed_returns_422(client):
    response = client.post("/api/routes/calculate", json={
        "map_id": "virtual-station-v1", "start_node_id": "S1", "walking_speed_mps": 0
    })
    assert response.status_code == 422


def test_closing_all_exits_returns_unreachable(client):
    response = client.post("/api/routes/calculate", json={
        "map_id": "virtual-station-v1",
        "start_node_id": "S1",
        "blocked_exit_ids": ["E1", "E2", "E3"],
    })
    assert response.status_code == 200
    assert response.json()["reachable"] is False
    assert response.json()["selected_exit_id"] is None


def test_120_second_congestion_changes_exit_and_reports_deltas(client):
    response = client.post("/api/routes/compare", json={
        "map_id": "virtual-station-v1",
        "start_node_id": "S1",
        "walking_speed_mps": 1.2,
        "reaction_delay_s": 5,
        "congestion_delays": {"A04": 120},
    })
    assert response.status_code == 200
    result = response.json()
    assert result["baseline"]["selected_exit_id"] == "E1"
    assert result["scenario"]["selected_exit_id"] == "E2"
    assert result["distance_delta_m"] == 13
    assert result["total_time_delta_s"] == 10.833


def test_api_reaction_delay_is_added_once(client):
    base = {"map_id": "virtual-station-v1", "start_node_id": "S1", "walking_speed_mps": 1.2}
    no_delay = client.post("/api/routes/calculate", json={**base, "reaction_delay_s": 0}).json()
    delayed = client.post("/api/routes/calculate", json={**base, "reaction_delay_s": 5}).json()
    assert no_delay["movement_time_s"] == delayed["movement_time_s"] == 50
    assert no_delay["total_time_s"] == 50
    assert delayed["total_time_s"] == 55
