const sharp = require('sharp');
sharp.cache(false);

/**
 * QC Metrics — Sharp.js deterministic per-image numeric checks.
 *
 * Complementary to Cohesion Validator (2.8) which is Vision-based (semantic).
 * This runs instantly, no API, post-gen per slot:
 *   - Dimensions verification
 *   - Luminance stats + WCAG-approximate contrast ratio
 *   - Clutter density (Sobel edge ratio)
 *   - Product centering (weighted center of mass)
 *   - White space top (top 20% bright ratio)
 *   - Mobile crop safety (mass within center 60%)
 *
 * Slot-specific thresholds → slot 1 hero gets stricter centering,
 * clutter, mobile-crop checks via flag().
 */
class QCMetrics {
  async analyze(imagePath, slotNumber) {
    if (!imagePath) return null;

    const meta = await sharp(imagePath).metadata();

    const small = await sharp(imagePath)
      .resize(256, 256, { fit: 'inside' })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const buf = small.data;
    const w = small.info.width;
    const h = small.info.height;

    return {
      slot: slotNumber,
      path: imagePath,
      dimensions: { width: meta.width, height: meta.height, format: meta.format },
      luminance: this._luminanceStats(buf),
      contrast_ratio: this._contrastRatio(buf),
      clutter_density: this._clutterDensity(buf, w, h),
      centering: this._centering(buf, w, h),
      white_space_top: this._whiteSpaceTop(buf, w, h),
      mobile_crop_safety: this._mobileCropSafety(buf, w, h),
      flags: []
    };
  }

  _luminanceStats(buf) {
    let min = 255, max = 0, sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = buf[i];
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
    }
    return { min, max, mean: sum / buf.length };
  }

  _contrastRatio(buf) {
    const lum = this._luminanceStats(buf);
    const lMax = (lum.max / 255 + 0.05);
    const lMin = (lum.min / 255 + 0.05);
    return Number((lMax / lMin).toFixed(2));
  }

  _clutterDensity(buf, w, h) {
    let edges = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const gx = Math.abs(buf[i - 1] - buf[i + 1]);
        const gy = Math.abs(buf[i - w] - buf[i + w]);
        if (gx + gy > 60) edges++;
      }
    }
    return Number((edges / ((w - 2) * (h - 2))).toFixed(4));
  }

  _centering(buf, w, h) {
    let sumX = 0, sumY = 0, sumW = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = 255 - buf[y * w + x];
        sumX += x * v;
        sumY += y * v;
        sumW += v;
      }
    }
    if (sumW === 0) return { x_offset: 0, y_offset: 0 };
    return {
      x_offset: Number((((sumX / sumW) - w / 2) / w).toFixed(3)),
      y_offset: Number((((sumY / sumW) - h / 2) / h).toFixed(3))
    };
  }

  _whiteSpaceTop(buf, w, h) {
    const topRows = Math.floor(h * 0.2);
    let bright = 0;
    for (let y = 0; y < topRows; y++) {
      for (let x = 0; x < w; x++) {
        if (buf[y * w + x] > 230) bright++;
      }
    }
    return Number((bright / (topRows * w)).toFixed(3));
  }

  _mobileCropSafety(buf, w, h) {
    const cx0 = Math.floor(w * 0.2), cx1 = Math.floor(w * 0.8);
    const cy0 = Math.floor(h * 0.2), cy1 = Math.floor(h * 0.8);
    let totalMass = 0, centerMass = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = 255 - buf[y * w + x];
        totalMass += v;
        if (x >= cx0 && x < cx1 && y >= cy0 && y < cy1) centerMass += v;
      }
    }
    if (totalMass === 0) return 1;
    return Number((centerMass / totalMass).toFixed(3));
  }

  flag(metrics, slotNumber) {
    const flags = [];
    const expectedSize = slotNumber === 'aplus' ? [1464, 600] : [2000, 2000];
    if (metrics.dimensions.width !== expectedSize[0] || metrics.dimensions.height !== expectedSize[1]) {
      flags.push(`DIMENSIONS_OFF: got ${metrics.dimensions.width}x${metrics.dimensions.height}, expected ${expectedSize[0]}x${expectedSize[1]}`);
    }
    if (metrics.contrast_ratio < 3.0) flags.push(`CONTRAST_LOW: ${metrics.contrast_ratio} (min 3.0)`);
    if (slotNumber === 1 && metrics.clutter_density > 0.15) flags.push(`CLUTTER_HIGH for hero: ${metrics.clutter_density} (max 0.15)`);
    if (slotNumber === 1 && Math.abs(metrics.centering.x_offset) > 0.15) flags.push(`OFF_CENTER slot 1: ${metrics.centering.x_offset}`);
    if (slotNumber === 1 && metrics.mobile_crop_safety < 0.8) flags.push(`MOBILE_CROP_RISK: ${metrics.mobile_crop_safety}`);
    metrics.flags = flags;
    return flags;
  }
}

module.exports = QCMetrics;
