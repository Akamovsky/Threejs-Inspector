import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export class ExporterManager {
  private static triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }

  public static exportToGLTF(objectOrScene: any, filename = 'threejs-export.glb') {
    if (!objectOrScene) return;

    try {
      const exporter = new GLTFExporter();
      exporter.parse(
        objectOrScene,
        (result) => {
          if (result instanceof ArrayBuffer) {
            const blob = new Blob([result], { type: 'model/gltf-binary' });
            this.triggerDownload(blob, filename.endsWith('.glb') ? filename : `${filename}.glb`);
          } else {
            const output = JSON.stringify(result, null, 2);
            const blob = new Blob([output], { type: 'application/json' });
            this.triggerDownload(blob, filename.endsWith('.gltf') ? filename : `${filename}.gltf`);
          }
        },
        (error) => {
          console.error('[Three.js Inspector] GLTF export failed:', error);
        },
        { binary: true }
      );
    } catch (e) {
      console.error('[Three.js Inspector] Error exporting GLTF:', e);
    }
  }

  public static captureCanvasScreenshot(canvas: HTMLCanvasElement, filename = 'threejs-screenshot.png') {
    if (!canvas) return;

    try {
      canvas.toBlob((blob) => {
        if (blob) {
          this.triggerDownload(blob, filename);
        } else {
          const dataUrl = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => document.body.removeChild(a), 500);
        }
      }, 'image/png');
    } catch (e) {
      console.error('[Three.js Inspector] Screenshot capture failed:', e);
    }
  }

  public static getTextureThumbnail(texture: any, maxSize = 96): string | undefined {
    if (!texture) return undefined;

    try {
      const img = texture.image;
      if (!img) return undefined;

      // Direct data URL or image source
      if (typeof img.src === 'string' && img.src.startsWith('data:')) {
        return img.src;
      }

      // Canvas / ImageBitmap / HTMLImageElement
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return undefined;

      const w = img.width || img.videoWidth || 64;
      const h = img.height || img.videoHeight || 64;
      const scale = Math.min(1, maxSize / Math.max(w, h));
      canvas.width = Math.max(16, Math.round(w * scale));
      canvas.height = Math.max(16, Math.round(h * scale));

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    } catch (e) {
      return undefined;
    }
  }

  public static downloadTexture(texture: any, filename = 'texture.png') {
    if (!texture || !texture.image) return;

    try {
      const img = texture.image;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = img.width || 256;
      canvas.height = img.height || 256;
      ctx.drawImage(img, 0, 0);

      canvas.toBlob((blob) => {
        if (blob) {
          this.triggerDownload(blob, filename);
        }
      }, 'image/png');
    } catch (e) {
      console.error('[Three.js Inspector] Download texture failed:', e);
    }
  }
}
