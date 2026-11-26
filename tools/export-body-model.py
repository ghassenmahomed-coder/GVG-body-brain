import bpy, bmesh, re, json
from mathutils import Matrix
import sys
bpy.ops.wm.open_mainfile(filepath=sys.argv[-2])  # usage: python export-body-model.py Startup.blend out.glb
dg = bpy.context.evaluated_depsgraph_get()

SKIP = re.compile(r"fascia|bursa|sheath|retinacul|aponeuros|septum|ligament|tendon|linea alba|laryng|arytenoid|cricoid|thyro|pharyn|palat|tongue|lingu|glossus|uvula|tarsus|ocul|rectus (superior|inferior|medialis|lateralis)|oblique muscle\.|levator palpebrae|tendinous ring|levator ani|coccyge|iliococcyg|pubococcyg|puborectal|sphincter|diaphragm|perine|cremaster|stapedius|tensor tympani|tensor veli|ischiocavernos|bulbospong|transversus perinei|intercostal|subcostal|transversus thoracis|levatores|interspinal|intertransvers|rotatores|suboccipital|capitis|scalene|longus colli|longus capitis|digastric|hyoid|stylo|platysma|epicranial|frontalis|occipitalis|auricular|temporoparietal", re.I)
RULES = [
 ("chest", r"pectoralis|serratus anterior"),
 ("shoulders", r"deltoid|supraspinatus|infraspinatus|teres minor|subscapularis"),
 ("biceps", r"biceps brachii|brachialis muscle|coracobrachialis"),
 ("triceps", r"triceps brachii|anconeus"),
 ("abs", r"rectus abdominis|abdominal oblique|transversus abdominis|pyramidalis"),
 ("back", r"latissimus|trapezius|rhomboid|iliocostalis|longissimus|spinalis|teres major|levator scapulae|multifidus|quadratus lumborum|semispinalis|splenius|serratus posterior"),
 ("glutes", r"gluteus|tensor fasciae latae|piriformis|gemellus|obturator internus|quadratus femoris"),
 ("hamstrings", r"biceps femoris|semitendinosus|semimembranosus"),
 ("quads", r"rectus femoris|vastus|sartorius|adductor (longus|brevis|magnus|minimus)|gracilis|pectineus|iliacus|psoas|obturator externus|articularis genus"),
 ("calves", r"gastrocnemius|soleus|plantaris|popliteus|tibialis|fibularis|peroneus|hallucis|digitorum longus|flexor digitorum brevis|digiti minimi of foot|of foot|quadratus plantae"),
]
def classify(o):
    n = o.name.lower()
    if SKIP.search(n): return None
    for g, rx in RULES:
        if re.search(rx, n): return g
    cols = " ".join(c.name.lower() for c in o.users_collection)
    par = (o.parent.name.lower() if o.parent else "")
    if "upper limb" in cols or "forearm" in cols or "hand" in cols or "forearm" in par or "hand" in par: return "forearms"
    if "head" in cols or "facial" in cols or "masticat" in par: return "other"
    if "lower limb" in cols: return "calves"
    return "other"

ms = bpy.data.collections["4: Muscular system"]
buckets, names = {}, {}
for o in ms.all_objects:
    if o.type != 'MESH' or len(o.data.polygons) == 0 or o.name.endswith('.g'): continue
    g = classify(o)
    if not g: continue
    buckets.setdefault(g, []).append(o); names.setdefault(g, []).append(o.name)

def merged(objs, name):
    bm = bmesh.new()
    for o in objs:
        ev = o.evaluated_get(dg); me = ev.to_mesh()
        me.transform(o.matrix_world)
        bm.from_mesh(me); ev.to_mesh_clear()
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); return ob

out = bpy.data.scenes.new("Export"); bpy.context.window.scene = out
TARGET = {"other": 14000, "back": 14000, "quads": 11000, "calves": 9000, "forearms": 9000, "abs": 8000, "chest": 7000, "glutes": 7000, "hamstrings": 6000, "shoulders": 6000, "biceps": 4000, "triceps": 4000}
def decimate(ob, tris):
    out.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    m = ob.modifiers.new("d", 'DECIMATE')
    cur = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    m.ratio = min(1.0, tris / max(cur, 1))
    ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
    new = bpy.data.meshes.new_from_object(ev); ob.modifiers.clear(); ob.data = new
    return cur, sum(len(p.vertices) - 2 for p in new.polygons)

stats = {}
dg = bpy.context.evaluated_depsgraph_get()
for g, objs in buckets.items():
    ob = merged(objs, g); stats[g] = (len(objs),) + decimate(ob, TARGET[g])
rg = bpy.data.collections["9: Regions of human body"]
skin = merged([o for o in rg.all_objects if o.type == 'MESH' and len(o.data.polygons) > 0 and not o.name.endswith('.g')], "skin")
stats["skin"] = (0,) + decimate(skin, 26000)
for ob in out.collection.objects:
    for p in ob.data.polygons: p.use_smooth = True
print(json.dumps(stats))
json.dump(names, open(sys.argv[-1].replace(".glb", "-groups.json"), "w"), indent=1)
bpy.ops.export_scene.gltf(filepath=sys.argv[-1], export_format='GLB', use_active_scene=True, export_materials='NONE', export_normals=True, export_texcoords=False, export_apply=True)
