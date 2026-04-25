# gsplat-grounding

Drop a character into a Gaussian-splat scene and have them walk on the visible floor — without authoring a collider mesh.

The floor reference is derived **at runtime, in the browser**, by sampling splat-centroid density. The same `.spz` (or `.ply` / `.splat` / `.ksplat`) acts as both the visual environment and the collision source.

**🟢 Live demo: https://rumaihi111.github.io/gsplat-grounding/**

Drag any splat file onto the page. A capsule character spawns at the world centroid and walks back and forth, feet snapped to the heightmap derived from your splat's data.

## Run locally

```bash
git clone https://github.com/rumaihi111/gsplat-grounding
cd gsplat-grounding
python3 -m http.server 8000
# open http://localhost:8000
```

No `npm install`, no build step. Three.js and the splat renderer load from CDNs via an importmap.

## Use it in your own project

The whole library is one file: [`src/splat-grounding.js`](src/splat-grounding.js). Copy it into your three.js project and import:

```js
import {
  sampleSplatCenters,
  buildSplatFloorHM,
  sampleSplatFloor,
  groundCharacter,
  buildFloorCarpet,
} from './splat-grounding.js';

// 1. Load your splat with @mkkellogg/gaussian-splats-3d as usual.
const viewer = new GaussianSplats3D.Viewer({ /* your options */ });
await viewer.addSplatScene('./scene.spz');

// 2. Build the floor heightmap from splat density (do this once per splat load).
const samples = sampleSplatCenters(viewer.splatMesh, 30000);
const floorHM = buildSplatFloorHM(samples);

// 3. Per frame, after your AnimationMixer.update(), snap your character.
function tick() {
  mixer.update(dt);              // your character's animation
  groundCharacter(walker, floorHM);
  renderer.render(scene, camera);
}
```

Need to debug? Drop the carpet into your scene:

```js
scene.add(buildFloorCarpet(floorHM));   // green wireframe over the derived floor
```

## How it works

### Build the heightmap (once, at load)

1. Pull each splat's xyz centroid via `splatMesh.getSplatCenter(i, vec)` (mkkellogg API), transform by `matrixWorld` to get world-space coords. Stride down to ~30k samples.
2. Compute the world's xy footprint from the 5th–95th percentile of sample positions (ignores stray sky/noise points).
3. Bin the footprint into a 32×32 grid.
4. **Per cell**, gather every sample within `1.5 × cellSize` xy distance, sort by z, take **p15** — the top of the lowest 15% of nearby splats. That sits on the visible floor surface, above sub-floor outliers and below furniture/booth bases.
5. Fill remaining empty cells from neighbours (3 passes).

### Snap the character (every frame)

1. Bilinear-interp the heightmap at the character's `(x, y)` → `floorZ`.
2. Update your AnimationMixer first (so bones reflect the current frame).
3. Compute the character's *live skinned* `Box3.setFromObject(walker, true)` — `precise=true` makes three.js transform every skinned vertex into world space and find the actual lowest point, not the rest pose.
4. Shift `walker.position.z` so `bbox.min.z === floorZ`. Whichever foot is lowest at this instant of the cycle plants on the floor.

### What you get visually

- **Walking animation**: planted foot stays put, swing foot lifts off, hips bob naturally.
- **Slight slope** in the splat's reconstructed floor → character follows the slope.
- **Furniture / booth bases / table legs**: ignored, because they show up as the high z-percentile in their cells, not p15.

## API

```ts
sampleSplatCenters(splatMesh, targetCount = 30000)
  → Array<[x, y, z]>

buildSplatFloorHM(samples, opts?)
  → { heights: Float32Array, nx, ny, xMin, yMin, cellX, cellY }

  opts:
    nx, ny              grid resolution (default 32×32)
    floorPercentile     p-value for floor band (default 0.15)
    radiusFactor        gather radius in cells (default 1.5)
    minSamplesPerCell   skip cells with fewer (default 8)
    fillPasses          neighbour-fill iterations (default 3)

sampleSplatFloor(hm, x, y)
  → number | null   bilinear-interp z at (x, y); null if outside or all-NaN

groundCharacter(walker, hm)
  → void   shifts walker.position.z so the live skinned bbox.min sits on hm

buildFloorCarpet(hm, { color?, opacity? })
  → THREE.Mesh   wireframe debug viz of the heightmap
```

## Limitations

This is a **single-floor** approximation: `z = f(x, y)`, one Z per xy.

- ✅ flat-ish indoor floors with mild slopes (rooms, galleries, diners, halls)
- ✅ outdoor terrain with smooth elevation changes
- ❌ stairs, balconies, multi-storey buildings (you can't walk on top of *and* under the same xy)
- ❌ overhangs (low ceiling, walking under a table)
- ❌ very sparse splats — cells with fewer than 8 samples fall back to neighbours

For multi-floor support, the heightmap would need to store *all* dense z-bands per cell and let the walker pick the band closest to its current z. That's not in this lib yet.

## Splat orientation

Splats from different sources use different up-axes. The demo applies `splatRoot.rotation.x = -Math.PI / 2` because Marble Labs exports Y-down. For other sources:

| source | orientation | rotation |
|---|---|---|
| Marble Labs | Y-down | `rotation.x = -π/2` |
| Lyra (NVIDIA) | Y-up | `rotation.x = +π/2` |
| Polycam | varies | check sample bounds |

If your character ends up upside-down, flip the sign of the rotation.

## Performance

The current pipeline runs the splat sort on the CPU (`gpuAcceleratedSort: false`) because mkkellogg's GPU-sort path needs cross-origin-isolation headers (`Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`) that `python -m http.server` doesn't set. Expect 10–30 fps on a 500k splat.

For ~60 fps with the GPU-sort path, you'll need to:

1. Vendor `@mkkellogg/gaussian-splats-3d` locally instead of the CDN.
2. Serve with COOP/COEP headers (any modern dev server: `vite`, `http-server -S`, etc.).
3. Set `gpuAcceleratedSort: true` and `sharedMemoryForWorkers: true` in `Viewer` options.

## Credits

- [@mkkellogg](https://github.com/mkkellogg) for [`@mkkellogg/gaussian-splats-3d`](https://github.com/mkkellogg/GaussianSplats3D) — handles all the actual splat decoding and rendering.
- [three.js](https://threejs.org/) for the renderer, `Box3.setFromObject(obj, true)` (skinned bbox), `AnimationMixer`, and everything else underneath.

## License

MIT — see [LICENSE](LICENSE).
