// Post-processing: ambient occlusion, bloom on emissive screens/neon/lamps only, ACES tone mapping, SMAA, vignette.
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'

export default function Effects(): JSX.Element {
  return (
    <EffectComposer multisampling={0} frameBufferType={THREE.HalfFloatType} enableNormalPass={false}>
      <N8AO aoRadius={0.7} intensity={2.2} distanceFalloff={0.6} halfRes quality="medium" />
      <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.85} radius={0.72} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <SMAA />
      <Vignette offset={0.32} darkness={0.55} />
    </EffectComposer>
  )
}
