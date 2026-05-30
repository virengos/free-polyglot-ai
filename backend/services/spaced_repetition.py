"""
SM-2 Spaced Repetition Algorithm
Based on: https://www.supermemo.com/en/blog/application-of-a-computer-to-improve-the-results-obtained-in-working-with-the-supermemo-method

quality: 0 = complete blackout
         1 = incorrect, but remembered on seeing answer
         2 = incorrect, but easy to recall on hint
         3 = correct, with serious difficulty
         4 = correct, after a hesitation
         5 = perfect recall
"""

import datetime
from typing import Tuple


MIN_EASE_FACTOR = 1.3
DEFAULT_EASE_FACTOR = 2.5


def sm2_review(
    ease_factor: float,
    interval: int,
    repetitions: int,
    quality: int,
) -> Tuple[float, int, int, int, datetime.datetime]:
    """
    Returns: (new_ease_factor, new_interval, new_repetitions, memory_strength, next_review)
    """
    if quality < 0 or quality > 5:
        raise ValueError("quality must be 0–5")

    if quality >= 3:
        # Correct answer
        if repetitions == 0:
            new_interval = 1
        elif repetitions == 1:
            new_interval = 6
        else:
            new_interval = round(interval * ease_factor)
        new_repetitions = repetitions + 1
    else:
        # Wrong answer → reset
        new_interval = 1
        new_repetitions = 0

    # Update ease factor
    new_ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_ease_factor = max(MIN_EASE_FACTOR, new_ease_factor)

    # Cap interval at 365 days
    new_interval = min(new_interval, 365)

    # Memory strength 0–100 (logarithmic growth with interval)
    # 1 day  →  10
    # 7 days →  40
    # 30d    →  70
    # 90d    →  85
    # 180d+  →  100
    import math
    if new_interval <= 0:
        memory_strength = 0
    else:
        memory_strength = min(100, int(math.log(new_interval + 1, 2) * 20))

    next_review = datetime.datetime.utcnow() + datetime.timedelta(days=new_interval)

    return new_ease_factor, new_interval, new_repetitions, memory_strength, next_review


def xp_for_review(quality: int, mode: str) -> int:
    """XP earned for a single review."""
    base = {
        "flashcard": 5,
        "multiple_choice": 8,
        "write": 12,
    }.get(mode, 5)

    if quality >= 4:
        return base
    elif quality == 3:
        return max(1, base // 2)
    else:
        return 0  # no XP for wrong answers


def xp_for_level(level: int) -> int:
    """Total XP needed to reach a given level."""
    return level * level * 100


def compute_level(total_xp: int) -> int:
    level = 1
    while xp_for_level(level + 1) <= total_xp:
        level += 1
    return level
