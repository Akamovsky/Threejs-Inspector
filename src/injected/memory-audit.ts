import type { AuditedResourceItem, MemoryAuditData } from '../types/three-data';

export class MemoryAuditor {
  public static calculateGeometryBytes(geo: any): number {
    if (!geo) return 0;
    let bytes = 0;

    if (geo.attributes) {
      for (const key of Object.keys(geo.attributes)) {
        const attr = geo.attributes[key];
        if (attr && attr.array) {
          bytes += attr.array.byteLength || 0;
        }
      }
    }

    if (geo.index && geo.index.array) {
      bytes += geo.index.array.byteLength || 0;
    }

    return bytes;
  }

  public static calculateTextureBytes(texture: any): number {
    if (!texture || !texture.image) return 0;
    const img = texture.image;
    const w = img.width || 0;
    const h = img.height || 0;
    if (w === 0 || h === 0) return 0;

    // RGBA 4 bytes per pixel, 1.33x for mipmaps if enabled
    const baseBytes = w * h * 4;
    const mipFactor = texture.generateMipmaps !== false ? 1.333 : 1;
    return Math.round(baseBytes * mipFactor);
  }

  public static audit(scenes: Iterable<any>, allKnownGeometries: Map<string, any>, allKnownTextures: Map<string, any>): MemoryAuditData {
    const activeGeoUuids = new Set<string>();
    const activeTexUuids = new Set<string>();

    // Scan all active scene graphs
    for (const scene of scenes) {
      scene.traverse((obj: any) => {
        if (!obj || obj.__isInspectorObject) return;

        if (obj.geometry && obj.geometry.uuid) {
          activeGeoUuids.add(obj.geometry.uuid);
          if (!allKnownGeometries.has(obj.geometry.uuid)) {
            allKnownGeometries.set(obj.geometry.uuid, obj.geometry);
          }
        }

        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m: any) => {
            const slots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap', 'envMap'];
            slots.forEach((s) => {
              const tex = m[s];
              if (tex && tex.isTexture && tex.uuid) {
                activeTexUuids.add(tex.uuid);
                if (!allKnownTextures.has(tex.uuid)) {
                  allKnownTextures.set(tex.uuid, tex);
                }
              }
            });
          });
        }
      });
    }

    const resources: AuditedResourceItem[] = [];
    let totalTexturesBytes = 0;
    let totalGeometriesBytes = 0;
    let orphansCount = 0;

    // Audit Geometries
    for (const [uuid, geo] of allKnownGeometries.entries()) {
      const bytes = this.calculateGeometryBytes(geo);
      totalGeometriesBytes += bytes;
      const inScene = activeGeoUuids.has(uuid);
      if (!inScene) orphansCount++;

      resources.push({
        uuid,
        name: geo.name || geo.type || 'BufferGeometry',
        type: 'geometry',
        memoryBytes: bytes,
        memoryMB: +(bytes / (1024 * 1024)).toFixed(2),
        inScene,
        details: `${geo.attributes?.position?.count || 0} vertices`
      });
    }

    // Audit Textures
    for (const [uuid, tex] of allKnownTextures.entries()) {
      const bytes = this.calculateTextureBytes(tex);
      totalTexturesBytes += bytes;
      const inScene = activeTexUuids.has(uuid);
      if (!inScene) orphansCount++;

      const w = tex.image?.width || '?';
      const h = tex.image?.height || '?';

      resources.push({
        uuid,
        name: tex.name || 'Texture',
        type: 'texture',
        memoryBytes: bytes,
        memoryMB: +(bytes / (1024 * 1024)).toFixed(2),
        inScene,
        details: `${w}x${h}px`
      });
    }

    const totalBytes = totalTexturesBytes + totalGeometriesBytes;

    return {
      totalVramMB: +(totalBytes / (1024 * 1024)).toFixed(2),
      texturesVramMB: +(totalTexturesBytes / (1024 * 1024)).toFixed(2),
      geometriesVramMB: +(totalGeometriesBytes / (1024 * 1024)).toFixed(2),
      orphansCount,
      resources
    };
  }
}
