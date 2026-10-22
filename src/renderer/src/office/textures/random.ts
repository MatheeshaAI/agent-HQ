/** Small deterministic PRNG (Park–Miller) so procedural textures and layouts are stable between runs. */
export function seededRandom(seed: number): () => number {
  let s = Math.max(1, Math.floor(seed)) % 2147483647
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}
