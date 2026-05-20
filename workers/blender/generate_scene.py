import json
import math
import sys
from pathlib import Path

import bpy

try:
    bpy.ops.preferences.addon_enable(module="io_mesh_stl")
except Exception:
    pass


def mm(value):
    return value / 1000.0


def vec(values):
    return tuple(mm(v) for v in values)


def rotate(obj, values):
    obj.rotation_euler = tuple(math.radians(v) for v in values)


def apply_bevel(obj, amount_mm):
    if not amount_mm:
        return
    bevel = obj.modifiers.new("printable_bevel", "BEVEL")
    bevel.width = mm(amount_mm)
    bevel.segments = 3
    bevel.affect = "EDGES"
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    obj.select_set(False)


def create_object(spec):
    obj_type = spec["type"]
    if obj_type == "box":
        bpy.ops.mesh.primitive_cube_add(size=1, location=vec(spec.get("position", [0, 0, 0])))
        obj = bpy.context.object
        obj.dimensions = vec(spec.get("size", [10, 10, 10]))
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    elif obj_type == "cylinder":
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=64,
            radius=mm(spec.get("radius", 5)),
            depth=mm(spec.get("depth", 10)),
            location=vec(spec.get("position", [0, 0, 0])),
        )
        obj = bpy.context.object
    elif obj_type == "sphere":
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=64,
            ring_count=32,
            radius=mm(spec.get("radius", 5)),
            location=vec(spec.get("position", [0, 0, 0])),
        )
        obj = bpy.context.object
    elif obj_type == "wedge":
        size = spec.get("size", [20, 20, 10])
        sx, sy, sz = [mm(v) for v in size]
        mesh = bpy.data.meshes.new(spec["id"] + "Mesh")
        verts = [
            (-sx / 2, -sy / 2, -sz / 2),
            (sx / 2, -sy / 2, -sz / 2),
            (-sx / 2, sy / 2, -sz / 2),
            (sx / 2, sy / 2, -sz / 2),
            (-sx / 2, -sy / 2, sz / 2),
            (sx / 2, -sy / 2, sz / 2),
        ]
        faces = [(0, 1, 3, 2), (0, 4, 5, 1), (2, 3, 5, 4), (0, 2, 4), (1, 5, 3), (4, 2, 3, 5)]
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(spec["id"], mesh)
        bpy.context.collection.objects.link(obj)
        obj.location = vec(spec.get("position", [0, 0, 0]))
    elif obj_type == "text":
        bpy.ops.object.text_add(location=vec(spec.get("position", [0, 0, 0])))
        text = bpy.context.object
        text.data.body = spec.get("text", "Text")
        text.data.align_x = "CENTER"
        text.data.align_y = "CENTER"
        text.data.size = mm(spec.get("size", [20, 5, 2])[0])
        text.data.extrude = mm(spec.get("size", [20, 5, 2])[2])
        bpy.ops.object.convert(target="MESH")
        obj = bpy.context.object
    else:
        raise ValueError(f"Unsupported object type: {obj_type}")

    obj.name = spec["id"]
    rotate(obj, spec.get("rotation", [0, 0, 0]))
    apply_bevel(obj, spec.get("fillet"))
    return obj


def boolean_difference(target, cutters):
    bpy.context.view_layer.objects.active = target
    for cutter in cutters:
        cutter_name = cutter.name
        modifier = target.modifiers.new(f"subtract_{cutter.name}", "BOOLEAN")
        modifier.operation = "DIFFERENCE"
        modifier.object = cutter
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        bpy.data.objects.remove(cutter, do_unlink=True)
        yield cutter_name


def main(scene_file, output_dir):
    scene = json.loads(Path(scene_file).read_text(encoding="utf-8"))
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 0.001

    objects = {spec["id"]: create_object(spec) for spec in scene["objects"]}

    for operation in scene.get("operations", []):
        if operation["type"] == "difference":
            target_id = operation.get("target") or operation["objects"][0]
            target = objects[target_id]
            cutters = [objects[obj_id] for obj_id in operation["objects"] if obj_id != target_id and obj_id in objects]
            for cutter_name in boolean_difference(target, cutters):
                objects.pop(cutter_name, None)

    for obj in objects.values():
        obj.select_set(True)

    bpy.ops.wm.save_as_mainfile(filepath=str(output / "model.blend"))
    bpy.ops.export_scene.gltf(filepath=str(output / "model.glb"), export_format="GLB", use_selection=True)
    bpy.ops.export_mesh.stl(filepath=str(output / "model.stl"), use_selection=True)


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1 :]
    main(argv[0], argv[1])
