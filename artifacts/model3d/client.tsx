import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Box3,
  Color,
  DirectionalLight,
  GridHelper,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Artifact } from "@/components/chat/create-artifact";
import { DownloadIcon, MessageIcon } from "@/components/chat/icons";
import { useArtifact } from "@/hooks/use-artifact";
import type { Generated3DFile, Model3DArtifactContent } from "@/lib/3d/types";

function parseModel3DContent(content: string): Model3DArtifactContent | null {
  try {
    return JSON.parse(content) as Model3DArtifactContent;
  } catch {
    return null;
  }
}

function ModelViewer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const containerEl = container;

    const scene = new Scene();
    scene.background = new Color(0xf8_fa_fc);

    const camera = new PerspectiveCamera(45, 1, 0.1, 10_000);
    camera.position.set(180, 180, 180);

    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    containerEl.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new HemisphereLight(0xff_ff_ff, 0x44_44_44, 2.2));
    const directionalLight = new DirectionalLight(0xff_ff_ff, 1.5);
    directionalLight.position.set(120, 160, 80);
    scene.add(directionalLight);
    scene.add(new GridHelper(200, 20, 0x94_a3_b8, 0xe2_e8_f0));

    let animationFrame = 0;
    let disposed = false;

    function resize() {
      const { width, height } = containerEl.getBoundingClientRect();
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    }

    resize();
    window.addEventListener("resize", resize);

    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        if (disposed) {
          return;
        }

        const model = gltf.scene;
        scene.add(model);

        const box = new Box3().setFromObject(model);
        const center = box.getCenter(new Vector3());
        const size = box.getSize(new Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 1);

        model.position.sub(center);
        camera.position.set(maxDim * 1.5, maxDim * 1.2, maxDim * 1.5);
        controls.target.set(0, 0, 0);
        controls.update();
      },
      undefined,
      () => toast.error("Failed to load 3D preview")
    );

    function animate() {
      controls.update();
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [url]);

  return (
    <div
      className="h-[420px] w-full overflow-hidden rounded-xl border bg-muted/20"
      ref={containerRef}
    />
  );
}

export const model3DArtifact = new Artifact<"model3d">({
  kind: "model3d",
  description:
    "Useful for printable 3D models and downloadable GLB/BLEND/STL files.",
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === "data-model3dDelta") {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: streamPart.data,
        isVisible: true,
        status: "streaming",
      }));
    }
  },
  content: ({ content }) => {
    const { setArtifact } = useArtifact();
    const model = parseModel3DContent(content);
    const glb = model?.files.find((file) => file.format === "glb");
    const printable = model?.files.find((file) => file.format === "stl");
    const source = model?.files.find((file) => file.format === "blend");
    const scene = model?.files.find((file) => file.format === "scene");
    const downloadableFiles = [glb, source, printable, scene].filter(
      (file): file is Generated3DFile => Boolean(file)
    );

    const shouldPoll =
      model?.status === "queued" || model?.status === "running";

    useEffect(() => {
      if (!model?.jobId || !shouldPoll) {
        return;
      }

      const interval = setInterval(async () => {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/3d/jobs/${model.jobId}`
        );
        if (!response.ok) {
          return;
        }
        const updated = (await response.json()) as Model3DArtifactContent;
        setArtifact((currentArtifact) => {
          if (currentArtifact.documentId !== updated.jobId) {
            return currentArtifact;
          }

          return {
            ...currentArtifact,
            content: JSON.stringify(updated),
            status:
              updated.status === "completed" || updated.status === "failed"
                ? "idle"
                : currentArtifact.status,
          };
        });
      }, 3000);

      return () => clearInterval(interval);
    }, [model?.jobId, setArtifact, shouldPoll]);

    if (!model) {
      return (
        <div className="p-8 text-muted-foreground">Preparing 3D model...</div>
      );
    }

    return (
      <div className="flex flex-col gap-5 p-6 md:p-10">
        <div>
          <div className="text-sm uppercase tracking-wide text-muted-foreground">
            Printable 3D model
          </div>
          <h2 className="text-2xl font-semibold">{model.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Provider: {model.provider} · Units: {model.units} · Status:{" "}
            {model.status}
          </p>
        </div>

        {glb ? (
          <ModelViewer url={glb.url} />
        ) : (
          <div className="rounded-xl border p-8 text-muted-foreground">
            {model.status === "failed"
              ? model.error
              : "Blender is generating the model files..."}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {downloadableFiles.map((file) => (
            <a
              className="rounded-lg border p-4 transition-colors hover:bg-muted"
              href={file.url}
              key={file.format}
              rel="noreferrer"
              target="_blank"
            >
              <div className="font-medium uppercase">.{file.format}</div>
              <div className="text-sm text-muted-foreground">
                Download {file.format}
              </div>
            </a>
          ))}
        </div>

        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer font-medium">
            Generation recipe
          </summary>
          <pre className="mt-3 overflow-auto rounded bg-muted p-3 text-xs">
            {JSON.stringify(model.scene, null, 2)}
          </pre>
        </details>
      </div>
    );
  },
  actions: [
    {
      icon: <DownloadIcon size={18} />,
      description: "Copy model metadata",
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success("Copied model metadata");
      },
    },
  ],
  toolbar: [
    {
      icon: <MessageIcon />,
      description: "Request a new model revision",
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: "user",
          parts: [
            {
              type: "text",
              text: "Create a new revised version of this 3D model using the previous model as reference.",
            },
          ],
        });
      },
    },
  ],
});
