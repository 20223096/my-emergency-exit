import pytest

from app.core.graph import repository
from app.core.multi_agent import simulate_multi_agent
from app.models.schemas import MultiAgentSimulationRequest

MAP_ID = "seoul-station-line4-prototype-v1"


def request(**updates):
    values = dict(
        map_id=MAP_ID,
        start_counts={"S1": 0, "S2": 0, "S3": 1},
        walking_speed_mps=1.2,
        stair_speed_mps=0.8,
        corridor_capacity_per_s=2,
        stair_capacity_per_s=1,
        time_step_s=1,
        max_elapsed_s=3600,
    )
    values.update(updates)
    return MultiAgentSimulationRequest(**values)


def test_one_person_matches_single_route_time_and_exit():
    result = simulate_multi_agent(repository.get_map(MAP_ID), request())
    assert result.arrivals_by_exit == {"EXIT_11": 1}
    assert result.last_arrival_time_s == 52.5
    assert result.average_arrival_time_s == 52.5
    assert result.not_arrived_people == 0


def test_fifo_capacity_is_deterministic_and_conserves_people():
    first = simulate_multi_agent(repository.get_map(MAP_ID), request(start_counts={"S1": 20, "S2": 20, "S3": 20}))
    second = simulate_multi_agent(repository.get_map(MAP_ID), request(start_counts={"S1": 20, "S2": 20, "S3": 20}))
    assert first == second
    assert first.total_initial_people == sum(first.end_state_counts.values())
    assert first.arrived_people == 60
    for metric in first.edge_metrics:
        if metric.min_admission_interval_s is not None:
            assert metric.min_admission_interval_s + 1e-9 >= 1 / metric.capacity_per_s


def test_blocked_edges_are_never_admitted_and_fire_changes_exit():
    result = simulate_multi_agent(repository.get_map(MAP_ID), request(
        start_counts={"S3": 20}, blocked_edge_ids=["STAIR_A"],
    ))
    assert result.arrivals_by_exit == {"EXIT_13": 20}
    assert "STAIR_A" not in {metric.edge_id for metric in result.edge_metrics}


def test_no_route_is_distinct_from_timeout():
    no_route = simulate_multi_agent(repository.get_map(MAP_ID), request(
        start_counts={"S3": 10}, blocked_edge_ids=["STAIR_A", "STAIR_B"],
    ))
    assert no_route.end_reason == "NO_REACHABLE_ROUTES"
    assert no_route.no_route_people == no_route.not_arrived_people == 10
    assert no_route.end_state_counts["waiting"] == 0

    timeout = simulate_multi_agent(repository.get_map(MAP_ID), request(
        start_counts={"S3": 100}, stair_capacity_per_s=0.1, max_elapsed_s=20,
    ))
    assert timeout.end_reason == "TIMEOUT_WITH_ACTIVE_AGENTS"
    assert timeout.no_route_people == 0
    assert timeout.not_arrived_people > 0
    assert timeout.total_initial_people == sum(timeout.end_state_counts.values())


def test_partial_no_route_agents_are_not_in_arrival_average():
    result = simulate_multi_agent(repository.get_map(MAP_ID), request(
        start_counts={"S1": 1, "S3": 1}, blocked_edge_ids=["STAIR_A", "STAIR_B"],
    ))
    assert result.arrived_people == 1 and result.no_route_people == 1
    assert result.average_arrival_time_s == 25
    assert result.end_reason == "COMPLETED_WITH_NO_ROUTE_AGENTS"


def test_api_simulate_and_compare(client):
    body = request(start_counts={"S3": 3}, blocked_edge_ids=["E11_OUT"]).model_dump()
    simulated = client.post("/api/multi-agent/simulate", json=body)
    assert simulated.status_code == 200
    assert simulated.json()["arrivals_by_exit"] == {"EXIT_12": 3}
    compared = client.post("/api/multi-agent/compare", json=body)
    assert compared.status_code == 200
    assert compared.json()["baseline"]["arrivals_by_exit"] == {"EXIT_11": 3}
    assert compared.json()["scenario"]["arrivals_by_exit"] == {"EXIT_12": 3}


def test_api_rejects_unknown_exit_even_with_zero_people(client):
    body = request(start_counts={"S1": 0}, blocked_exit_ids=["NOT_AN_EXIT"]).model_dump()
    response = client.post("/api/multi-agent/simulate", json=body)
    assert response.status_code == 422
    assert "unknown exit" in response.json()["detail"]


@pytest.mark.parametrize(("count", "blocked", "max_elapsed", "exit_id", "arrived", "no_route", "last"), [
    (1, [], 3600, "EXIT_11", 1, 0, 52.5),
    (20, [], 3600, "EXIT_11", 20, 0, 71.5),
    (100, [], 3600, "EXIT_11", 100, 0, 151.5),
    (100, ["E11_OUT"], 3600, "EXIT_12", 100, 0, 154.833),
    (100, ["STAIR_A"], 3600, "EXIT_13", 100, 0, 160.667),
    (100, ["STAIR_A", "STAIR_B"], 3600, None, 0, 100, None),
    (300, [], 60, "EXIT_11", 8, 0, 59.5),
])
def test_documented_s3_scenario_regressions(count, blocked, max_elapsed, exit_id, arrived, no_route, last):
    result = simulate_multi_agent(repository.get_map(MAP_ID), request(
        start_counts={"S3": count}, blocked_edge_ids=blocked, max_elapsed_s=max_elapsed,
    ))
    assert result.arrived_people == arrived
    assert result.no_route_people == no_route
    assert result.last_arrival_time_s == last
    assert (next(iter(result.arrivals_by_exit), None)) == exit_id
