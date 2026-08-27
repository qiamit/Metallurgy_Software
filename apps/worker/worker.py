"""RQ worker entrypoint — processes deferred analysis jobs when Redis is available.

For MVP, analysis also runs inline in the API. This worker supports scale-out.
"""

from __future__ import annotations

import asyncio
import os

from redis import Redis
from rq import Worker, Queue, Connection

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")


def run_worker() -> None:
    redis_conn = Redis.from_url(REDIS_URL)
    with Connection(redis_conn):
        worker = Worker([Queue("analysis")])
        worker.work(with_scheduler=False)


if __name__ == "__main__":
    run_worker()
