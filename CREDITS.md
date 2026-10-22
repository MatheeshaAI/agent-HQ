# Credits

Third-party assets bundled with Agent HQ (all files live under `resources/`).

| File | Asset | Source | Licence |
| --- | --- | --- | --- |
| `resources/models/avatar.glb` | Ready Player Me avatar (`readyplayer.me.glb`) from the three.js examples | https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/readyplayer.me.glb | Ready Player Me avatar, used as distributed in the three.js repository; subject to the Ready Player Me terms of use (https://readyplayer.me/terms) |
| `resources/models/plant.glb` | DiffuseTransmissionPlant, Khronos glTF Sample Assets | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/DiffuseTransmissionPlant | © 2024 Darmstadt Graphics Group GmbH, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/) |
| `resources/models/vase-flowers.glb` | GlassVaseFlowers, Khronos glTF Sample Assets | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/GlassVaseFlowers | © 2023 Public, CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/): glass vase by Eric Chadwick, flowers by Rico Cilliers |
| `resources/textures/hardwood2_diffuse.jpg`, `hardwood2_bump.jpg`, `hardwood2_roughness.jpg` | Hardwood floor textures from the three.js examples | https://github.com/mrdoob/three.js/tree/dev/examples/textures | MIT (three.js, https://github.com/mrdoob/three.js/blob/dev/LICENSE) |

Fonts: Inter (via `@fontsource/inter`), © The Inter Project Authors, SIL Open Font License 1.1.

All other textures in the 3D office (floor tiles, rug, walnut grain, screen content, signage, the knowledge-graph wall) are generated procedurally at runtime.

The in-app models were modified at runtime only: the avatar's hat is removed, its clothing, skin and hair re-coloured (with a procedural hair cap) and its pose set to seated; only the plant's leaves are used, re-coloured and set on procedural planters (stretched upwards for the rubber-plant accents), while its pot, soil, fireflies and lights are dropped; the vase's transmission glass is replaced by a simple transparent material. The office palms are procedural.
