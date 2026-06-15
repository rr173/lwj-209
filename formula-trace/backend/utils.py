from typing import Iterable
import math


def pearson_correlation(x: list[float], y: list[float]) -> float | None:
    n = len(x)
    if n < 3 or len(y) != n:
        return None
    sum_x = sum(x)
    sum_y = sum(y)
    sum_xy = sum(xi * yi for xi, yi in zip(x, y))
    sum_x_sq = sum(xi ** 2 for xi in x)
    sum_y_sq = sum(yi ** 2 for yi in y)
    numerator = n * sum_xy - sum_x * sum_y
    denominator = math.sqrt((n * sum_x_sq - sum_x ** 2) * (n * sum_y_sq - sum_y ** 2))
    if denominator == 0:
        return None
    return numerator / denominator


def calculate_overall_score(
    skin_feel: float, stability: float, cost: float, min_cost: float, max_cost: float) -> float | None:
    if skin_feel is None or stability is None or cost is None:
        return None
    cost_range = max_cost - min_cost if max_cost > min_cost else 1
    normalized_cost = (cost - min_cost) / cost_range
    return skin_feel * 0.4 + stability * 0.4 - normalized_cost * 0.2


def compute_batch_scores(batches: Iterable) -> tuple[dict, float, float]:
    valid_batches = [
        b for b in batches
        if b.skin_feel_score is not None
        and b.stability_score is not None
        and b.cost_per_kg is not None
    ]
    if not valid_batches:
        return {}, 0, 0
    costs = [b.cost_per_kg for b in valid_batches]
    min_cost = min(costs)
    max_cost = max(costs)
    score_map = {}
    for b in valid_batches:
        score = calculate_overall_score(
            b.skin_feel_score,
            b.stability_score,
            b.cost_per_kg,
            min_cost,
            max_cost
        )
        score_map[b.id] = score
    return score_map, min_cost, max_cost
