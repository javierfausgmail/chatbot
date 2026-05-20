import json
import os
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

JOBS = {}
OUTPUT_ROOT = Path(os.environ.get("OUTPUT_ROOT", "/outputs"))


def run_job(job_id, scene, output_dir):
    JOBS[job_id]["status"] = "running"
    target = Path(output_dir)
    target.mkdir(parents=True, exist_ok=True)
    scene_file = target / "scene.json"
    scene_file.write_text(json.dumps(scene, indent=2), encoding="utf-8")

    try:
        subprocess.run(
            [
                "blender",
                "--background",
                "--python",
                "/worker/generate_scene.py",
                "--",
                str(scene_file),
                str(target),
            ],
            check=True,
            timeout=180,
        )
        files = []
        for filename, fmt in [
            ("model.glb", "glb"),
            ("model.blend", "blend"),
            ("model.stl", "stl"),
            ("scene.json", "scene"),
        ]:
            path = target / filename
            if path.exists():
                files.append({"format": fmt, "filename": filename, "size": path.stat().st_size})
        required = {"glb", "blend", "stl", "scene"}
        exported = {file["format"] for file in files}
        missing = sorted(required - exported)
        if missing:
            raise RuntimeError(f"Missing generated files: {', '.join(missing)}")
        JOBS[job_id].update({"status": "completed", "files": files, "error": None})
    except Exception as exc:
        JOBS[job_id].update({"status": "failed", "error": str(exc), "files": []})


class Handler(BaseHTTPRequestHandler):
    def _json(self, status, body):
        data = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/health":
            return self._json(200, {"ok": True})
        if self.path.startswith("/jobs/"):
            job_id = self.path.split("/jobs/", 1)[1]
            job = JOBS.get(job_id)
            if not job:
                return self._json(404, {"error": "not found"})
            return self._json(200, job)
        return self._json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/jobs":
            return self._json(404, {"error": "not found"})
        length = int(self.headers.get("content-length", "0"))
        payload = json.loads(self.rfile.read(length).decode("utf-8"))
        job_id = payload["jobId"]
        output_dir = payload.get("outputDir") or str(OUTPUT_ROOT / job_id)
        JOBS[job_id] = {"jobId": job_id, "status": "queued", "files": [], "error": None}
        thread = threading.Thread(
            target=run_job,
            args=(job_id, payload["scene"], output_dir),
            daemon=True,
        )
        thread.start()
        return self._json(202, JOBS[job_id])

    def log_message(self, format, *args):
        return


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", 8010), Handler)
    server.serve_forever()
