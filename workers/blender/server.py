import json
import os
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

JOBS = {}
OUTPUT_ROOT = Path(os.environ.get("OUTPUT_ROOT", "/outputs")).resolve()


def debug_enabled(name):
    return os.environ.get(name, "0").lower() in {"1", "true", "yes", "on"}


def log(message):
    print(f"[blender-worker] {message}", flush=True)


def setup_debugpy():
    if not debug_enabled("DEBUGPY"):
        return

    import debugpy

    debugpy.listen(("0.0.0.0", 5678))
    log("debugpy listening on 0.0.0.0:5678")

    if debug_enabled("DEBUGPY_WAIT"):
        log("waiting for debugger attach")
        debugpy.wait_for_client()
        log("debugger attached")


def safe_output_dir(job_id):
    safe_job_id = "".join(c for c in str(job_id) if c.isalnum() or c in {"-", "_"})
    if not safe_job_id:
        raise RuntimeError("Invalid jobId")

    target = (OUTPUT_ROOT / safe_job_id).resolve()

    if OUTPUT_ROOT not in target.parents and target != OUTPUT_ROOT:
        raise RuntimeError(f"Unsafe output path: {target}")

    return target


def run_job(job_id, scene):
    JOBS[job_id]["status"] = "running"

    try:
        target = safe_output_dir(job_id)

        if target.exists() and not target.is_dir():
            raise RuntimeError(f"Output path exists but is not a directory: {target}")

        target.mkdir(parents=True, exist_ok=True)

        scene_file = target / "scene.json"
        scene_file.write_text(json.dumps(scene, indent=2), encoding="utf-8")

        log(f"job {job_id} running; output={target}")

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
                files.append(
                    {
                        "format": fmt,
                        "filename": filename,
                        "size": path.stat().st_size,
                    }
                )

        required = {"glb", "blend", "stl", "scene"}
        exported = {file["format"] for file in files}
        missing = sorted(required - exported)

        if missing:
            raise RuntimeError(f"Missing generated files: {', '.join(missing)}")

        JOBS[job_id].update(
            {
                "status": "completed",
                "files": files,
                "error": None,
            }
        )

        log(f"job {job_id} completed; files={', '.join(file['filename'] for file in files)}")

    except Exception as exc:
        JOBS[job_id].update(
            {
                "status": "failed",
                "error": str(exc),
                "files": [],
            }
        )
        log(f"job {job_id} failed; error={exc}")


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

        try:
            length = int(self.headers.get("content-length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8"))

            job_id = payload["jobId"]
            scene = payload["scene"]

            target = safe_output_dir(job_id)

            JOBS[job_id] = {
                "jobId": job_id,
                "status": "queued",
                "files": [],
                "error": None,
                "outputDir": str(target),
            }

            log(f"job {job_id} queued; output={target}")

            thread = threading.Thread(
                target=run_job,
                args=(job_id, scene),
                daemon=True,
            )
            thread.start()

            return self._json(202, JOBS[job_id])

        except KeyError as exc:
            return self._json(400, {"error": f"Missing required field: {exc}"})

        except json.JSONDecodeError:
            return self._json(400, {"error": "Invalid JSON payload"})

        except Exception as exc:
            return self._json(500, {"error": str(exc)})

    def log_message(self, format, *args):
        return


if __name__ == "__main__":
    setup_debugpy()

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

    server = ThreadingHTTPServer(("0.0.0.0", 8010), Handler)
    log(f"listening on 0.0.0.0:8010; output_root={OUTPUT_ROOT}")
    server.serve_forever()