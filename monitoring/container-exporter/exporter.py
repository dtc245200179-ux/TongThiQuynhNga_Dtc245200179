import concurrent.futures
import http.client
import json
import logging
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("booking_container_exporter")

DOCKER_API_URL = os.getenv("DOCKER_API_URL", "http://docker-socket-proxy:2375")
DOCKER_API = urlsplit(DOCKER_API_URL)
PROJECT_NAME = os.getenv("EXPORTER_PROJECT_NAME", "").strip()


def docker_get(path):
    connection = http.client.HTTPConnection(
        DOCKER_API.hostname,
        DOCKER_API.port or 80,
        timeout=5,
    )
    try:
        connection.request("GET", path)
        response = connection.getresponse()
        payload = response.read()
        if response.status != 200:
            raise RuntimeError(
                f"Docker API GET {path} returned HTTP {response.status}: "
                f"{payload.decode(errors='replace')[:300]}"
            )
        return json.loads(payload)
    finally:
        connection.close()


def metric_label(value):
    return str(value).replace("\\", "\\\\").replace("\n", "\\n").replace('"', '\\"')


def metrics_text():
    containers = docker_get("/containers/json?all=0")
    lines = [
        "# HELP booking_container_exporter_up Whether the Docker API is reachable.",
        "# TYPE booking_container_exporter_up gauge",
        "booking_container_exporter_up 1",
        "# HELP booking_container_cpu_usage_seconds_total Cumulative container CPU time in seconds.",
        "# TYPE booking_container_cpu_usage_seconds_total counter",
        "# HELP booking_container_memory_usage_bytes Container memory currently in use.",
        "# TYPE booking_container_memory_usage_bytes gauge",
        "# HELP booking_container_memory_limit_bytes Container memory limit.",
        "# TYPE booking_container_memory_limit_bytes gauge",
        "# HELP booking_container_network_receive_bytes_total Cumulative container network bytes received.",
        "# TYPE booking_container_network_receive_bytes_total counter",
        "# HELP booking_container_network_transmit_bytes_total Cumulative container network bytes sent.",
        "# TYPE booking_container_network_transmit_bytes_total counter",
    ]
    labels_by_container = {}

    for container in containers:
        labels = container.get("Labels") or {}
        if PROJECT_NAME and labels.get("com.docker.compose.project") != PROJECT_NAME:
            continue

        container_id = container["Id"]
        names = container.get("Names") or [container_id[:12]]
        labels_by_container[container_id] = {
            "container": names[0].lstrip("/"),
            "container_id": container_id[:12],
            "service": labels.get("com.docker.compose.service", "unknown"),
        }

    def collect_container(container_id, labels):
        stats = docker_get(f"/containers/{container_id}/stats?stream=false")
        label_text = ",".join(
            f'{key}="{metric_label(value)}"'
            for key, value in labels.items()
        )
        cpu_usage = stats.get("cpu_stats", {}).get("cpu_usage", {}).get("total_usage", 0)
        memory_stats = stats.get("memory_stats", {})
        network_stats = stats.get("networks") or {}
        received = sum(network.get("rx_bytes", 0) for network in network_stats.values())
        transmitted = sum(network.get("tx_bytes", 0) for network in network_stats.values())
        values = {
            "booking_container_cpu_usage_seconds_total": cpu_usage / 1_000_000_000,
            "booking_container_memory_usage_bytes": memory_stats.get("usage", 0),
            "booking_container_memory_limit_bytes": memory_stats.get("limit", 0),
            "booking_container_network_receive_bytes_total": received,
            "booking_container_network_transmit_bytes_total": transmitted,
        }
        return [
            f"{name}{{{label_text}}} {value}"
            for name, value in values.items()
        ]

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        futures = [
            executor.submit(collect_container, container_id, labels)
            for container_id, labels in labels_by_container.items()
        ]
        for future in futures:
            lines.extend(future.result())

    logger.info("Collected metrics for %d containers", len(labels_by_container))
    return "\n".join(lines) + "\n"


class MetricsHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"ok\n")
            return
        if self.path != "/metrics":
            self.send_error(404)
            return

        try:
            body = metrics_text().encode()
        except (
            http.client.HTTPException,
            OSError,
            RuntimeError,
            ValueError,
            KeyError,
            TypeError,
        ):
            logger.exception("Unable to collect Docker container metrics")
            self.send_error(503, "Docker API metrics are unavailable")
            return

        self.send_response(200)
        self.send_header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format_string, *args):
        logger.info("%s - %s", self.address_string(), format_string % args)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", 9105), MetricsHandler)
    logger.info("Container exporter listening on :9105 for project %r", PROJECT_NAME)
    server.serve_forever()
