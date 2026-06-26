# Main — builds the world, renders the sim, drives the camera + HUD.
# Attach to the root Node3D of Main.tscn (already wired). Reads sim state only.
extends Node3D

var sim: Sim
var being_nodes := {}            # being id -> {node, anim, walk, fitted}
var glb_cache := {}              # mesh stem -> PackedScene
var cam_pivot: Node3D
var camera: Camera3D
var cam_dist := 90.0
var cam_yaw := 0.6
var cam_pitch := 0.9
var sun: DirectionalLight3D

# HUD labels
var lbl_top: Label
var lbl_tribes: Label
var lbl_log: Label

func _ready() -> void:
	randomize()
	sim = Sim.new("pangaea-" + str(randi() % 100000))
	_build_environment()
	_build_terrain()
	_build_water()
	_build_camera()
	_build_hud()

# ---------- world rendering ----------
func _build_environment() -> void:
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color(0.35, 0.5, 0.7)
	sky_mat.sky_horizon_color = Color(0.7, 0.75, 0.8)
	sky_mat.ground_bottom_color = Color(0.2, 0.2, 0.22)
	sky.sky_material = sky_mat
	e.sky = sky
	e.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	e.ambient_light_energy = 0.6
	e.fog_enabled = true
	e.fog_light_color = Color(0.6, 0.68, 0.78)
	e.fog_density = 0.0012
	env.environment = e
	add_child(env)

	sun = DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-55, -45, 0)
	sun.light_energy = 1.3
	sun.shadow_enabled = true
	add_child(sun)

func _build_terrain() -> void:
	var w := sim.world
	var n := w.seg
	var S := Config.WORLD_SIZE
	var verts := PackedVector3Array()
	var colors := PackedColorArray()
	var indices := PackedInt32Array()
	verts.resize((n + 1) * (n + 1))
	colors.resize((n + 1) * (n + 1))
	for iy in range(n + 1):
		for ix in range(n + 1):
			var id := iy * (n + 1) + ix
			var x := (float(ix) / n - 0.5) * S
			var z := (float(iy) / n - 0.5) * S
			var hgt: float = max(w.h[id], Config.SEA_LEVEL - 0.6)
			verts[id] = Vector3(x, hgt, z)
			var c: Color = Config.BIOME_COLOR.get(w.biome[id], Color(0.3, 0.3, 0.3))
			var shade: float = 0.85 + clampf(hgt / Config.MAX_HEIGHT * 0.3, -0.15, 0.25)
			colors[id] = Color(c.r * shade, c.g * shade, c.b * shade)
	for iy in range(n):
		for ix in range(n):
			var a := iy * (n + 1) + ix
			var b := a + 1
			var c := a + (n + 1)
			var d := c + 1
			indices.append_array([a, c, b, b, c, d])
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = verts
	arr[Mesh.ARRAY_COLOR] = colors
	arr[Mesh.ARRAY_INDEX] = indices
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	# recompute smooth normals via a SurfaceTool pass
	var st := SurfaceTool.new()
	st.create_from(mesh, 0)
	st.generate_normals()
	var final_mesh := st.commit()
	var mi := MeshInstance3D.new()
	mi.mesh = final_mesh
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.95
	mi.material_override = mat
	add_child(mi)
	mi.create_trimesh_collision()  # so raycasts/clicks can hit the ground later

func _build_water() -> void:
	var plane := PlaneMesh.new()
	plane.size = Vector2(Config.WORLD_SIZE * 1.6, Config.WORLD_SIZE * 1.6)
	var mi := MeshInstance3D.new()
	mi.mesh = plane
	mi.position.y = Config.SEA_LEVEL + 0.15
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.11, 0.29, 0.42, 0.82)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.roughness = 0.2
	mat.metallic = 0.3
	mi.material_override = mat
	add_child(mi)

# ---------- camera ----------
func _build_camera() -> void:
	cam_pivot = Node3D.new()
	cam_pivot.position = sim.tribes[0].home
	add_child(cam_pivot)
	camera = Camera3D.new()
	camera.far = 3000.0
	cam_pivot.add_child(camera)
	_update_camera()

func _update_camera() -> void:
	var offset := Vector3(
		sin(cam_yaw) * cos(cam_pitch),
		sin(cam_pitch),
		cos(cam_yaw) * cos(cam_pitch)
	) * cam_dist
	camera.position = offset
	camera.look_at(cam_pivot.global_position, Vector3.UP)

# ---------- beings ----------
func _glb(stem: String) -> PackedScene:
	if not glb_cache.has(stem):
		var path := "res://assets/models/%s.glb" % stem
		glb_cache[stem] = load(path) if ResourceLoader.exists(path) else null
	return glb_cache[stem]

func _being_mesh_stem(b) -> String:
	if b.stage() == "child": return "child"
	if b.stage() == "elder": return "elder"
	var rm := str(b.tribe.race.mesh) if b.tribe else "being"
	if rm != "being": return rm
	return "woman" if b.sex == "f" else "being"

func _spawn_being_node(b) -> void:
	var stem := _being_mesh_stem(b)
	var scene := _glb(stem)
	if scene == null:
		scene = _glb("being")
	var model: Node3D
	if scene:
		model = scene.instantiate()
	else:
		model = MeshInstance3D.new()
		(model as MeshInstance3D).mesh = CapsuleMesh.new()
	# a holder we move/rotate; the model sits inside with its own fit offset
	var holder := Node3D.new()
	holder.add_child(model)
	add_child(holder)
	var anim := model.find_child("AnimationPlayer", true, false) as AnimationPlayer
	var walk := ""
	if anim:
		for a in anim.get_animation_list():
			if a.to_lower() != "reset":
				walk = a
				break
	_fit_height(model, 1.9 * b.build)
	if anim and walk != "":
		anim.play(walk)
	being_nodes[b.id] = {"node": holder, "anim": anim, "walk": walk}

func _fit_height(model: Node3D, target_h: float) -> void:
	var aabb := _subtree_aabb(model)
	if aabb.size.y > 0.001:
		var s := target_h / aabb.size.y
		model.scale = Vector3.ONE * s
		var a2 := _subtree_aabb(model)
		model.position.y = -a2.position.y  # base to y=0, preserved inside the holder

func _subtree_aabb(root: Node3D) -> AABB:
	var out := AABB()
	var first := true
	for mi in _mesh_instances(root):
		var a: AABB = mi.get_aabb()
		a = _relative_xform(root, mi) * a   # mi's AABB expressed in root-local space
		if first:
			out = a; first = false
		else:
			out = out.merge(a)
	return out

func _relative_xform(root: Node3D, node: Node3D) -> Transform3D:
	if node == root:
		return Transform3D.IDENTITY
	var xf := node.transform
	var p := node.get_parent()
	while p and p != root and p is Node3D:
		xf = (p as Node3D).transform * xf
		p = p.get_parent()
	return xf

func _mesh_instances(root: Node) -> Array:
	var out := []
	if root is MeshInstance3D:
		out.append(root)
	for c in root.get_children():
		out.append_array(_mesh_instances(c))
	return out

func _sync_beings() -> void:
	var live := {}
	for b in sim.beings:
		live[b.id] = true
		if not being_nodes.has(b.id):
			_spawn_being_node(b)
		var rec = being_nodes[b.id]
		var node: Node3D = rec.node
		node.global_position = Vector3(b.pos.x, b.pos.y, b.pos.z)
		node.rotation.y = -b.heading + PI / 2.0
		var dist := camera.global_position.distance_to(node.global_position)
		node.visible = dist < 320.0
		if rec.anim and rec.walk != "":
			rec.anim.speed_scale = 1.2 if b.moving else 0.0
	# remove gone
	for id in being_nodes.keys():
		if not live.has(id):
			being_nodes[id].node.queue_free()
			being_nodes.erase(id)

# ---------- HUD ----------
func _build_hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	lbl_top = _mk_label(layer, Vector2(16, 12), 22)
	lbl_tribes = _mk_label(layer, Vector2(16, 100), 15)
	lbl_log = _mk_label(layer, Vector2(16, 320), 13)
	var help := _mk_label(layer, Vector2(16, 0), 13)
	help.anchor_top = 1.0; help.anchor_bottom = 1.0
	help.position = Vector2(16, -28)
	help.text = "WASD pan · wheel zoom · Q/E rotate · 1-5 speed · Space pause"

func _mk_label(parent: Node, pos: Vector2, size: int) -> Label:
	var l := Label.new()
	l.position = pos
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", Color(0.9, 0.9, 0.95))
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	l.add_theme_constant_override("outline_size", 4)
	parent.add_child(l)
	return l

func _update_hud() -> void:
	lbl_top.text = "AEON — Year %d   ·   %d souls   ·   %s" % [
		sim.year, sim.beings.size(), Config.TIME_LABELS[sim.speed_index]]
	var t := "PEOPLES\n"
	for tr in sim.tribes:
		t += "● %s (%s) — %d\n" % [tr.tribe_name, tr.race.name, sim.members_of(tr).size()]
	lbl_tribes.text = t
	lbl_log.text = "CHRONICLE\n" + "\n".join(sim.log_lines.slice(max(0, sim.log_lines.size() - 8)))

# ---------- loop & input ----------
func _process(delta: float) -> void:
	sim.update(delta)
	_sync_beings()
	_update_hud()
	# day/night sun
	var f: float = fmod(sim.day, 1.0)
	var elev: float = sin(f * PI)
	sun.light_energy = 0.3 + elev * 1.4
	# camera pan
	var pan := Vector3.ZERO
	if Input.is_key_pressed(KEY_W): pan.z -= 1
	if Input.is_key_pressed(KEY_S): pan.z += 1
	if Input.is_key_pressed(KEY_A): pan.x -= 1
	if Input.is_key_pressed(KEY_D): pan.x += 1
	if pan != Vector3.ZERO:
		var fwd := Vector3(sin(cam_yaw), 0, cos(cam_yaw))
		var right := Vector3(cos(cam_yaw), 0, -sin(cam_yaw))
		cam_pivot.position += (right * pan.x + fwd * pan.z).normalized() * cam_dist * delta * 0.8
		cam_pivot.position.y = sim.world.height_at(cam_pivot.position.x, cam_pivot.position.z)
	if Input.is_key_pressed(KEY_Q): cam_yaw -= delta * 1.2
	if Input.is_key_pressed(KEY_E): cam_yaw += delta * 1.2
	_update_camera()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			cam_dist = max(8.0, cam_dist * 0.9)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			cam_dist = min(900.0, cam_dist * 1.1)
	elif event is InputEventKey and event.pressed:
		if event.keycode == KEY_SPACE:
			sim.set_speed(0 if sim.speed_index != 0 else 1)
		elif event.keycode >= KEY_1 and event.keycode <= KEY_5:
			sim.set_speed(event.keycode - KEY_1)
