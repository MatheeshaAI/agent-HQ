// Post-processing: ambient occlusion, a tight bloom on emissive screens/neon/lamps only, ACES tone mapping,
// SMAA and a vignette into black.
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'

export default function Effects(): JSX.Element {
  return (
    <EffectComposer multisampling={0} frameBufferType={THREE.HalfFloatType} enableNormalPass={false}>
      <N8AO aoRadius={0.55} intensity={1.7} distanceFalloff={1.2} halfRes quality="medium" />
      <Bloom mipmapBlur luminanceThreshold={1.05} luminanceSmoothing={0.12} intensity={0.55} radius={0.45} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <SMAA />
      <Vignette offset={0.28} darkness={0.62} />
    </EffectComposer>
  )
}
