const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

let ImageGenerator;
try { ImageGenerator = require('./image-generator'); } catch(e) {}
const promptGuard = require('../utils/prompt-guard');

/**
 * Video Producer Agent v4
 *
 * Pipeline 3 bước:
 *   Phase 1: Storyboard — build scene concepts từ brief + theme
 *   Phase 2: Scene Images — AI generate ảnh start frame (KIE nano-banana-pro)
 *   Phase 3: Video — Kling 3.0 multi-shot (1 request, 5 scenes, @element product ref)
 *
 * API: KIE.ai
 *   - Image gen: nano-banana-pro (async createTask → poll)
 *   - Video gen: kling-3.0/video (multi-shot + element references)
 *   - Fallback: kling-2.6/image-to-video (single scene)
 *   - Upload: KIE File Upload API (base64)
 */

class VideoProducer {
  constructor(kieClient) {
    this.kie = kieClient;

    // Reuse ImageGenerator for scene image generation
    this.imageGen = ImageGenerator ? new ImageGenerator(kieClient) : null;
  }

  // ═══════════════════════════════════════
  //  UPLOAD — KIE.ai File Upload API
  // ═══════════════════════════════════════

  async uploadImage(localPath) {
    return this.kie.uploadFromLocal(localPath, 'video-frames', {
      maxSize: 1280, quality: 90, format: 'jpeg'
    });
  }

  // ═══════════════════════════════════════
  //  PHASE 1: STORYBOARD
  // ═══════════════════════════════════════

  generateStoryboard(brief, designDNA, theme) {
    console.log(`[VideoProducer] Creating storyboard for ${brief.sku}`);

    const scenes = this._buildScenes(brief, designDNA, theme);
    const video_style = brief.video_style || 'lifestyle';
    const duration = scenes.length >= 8 ? '15 seconds' : '20-25 seconds';

    const storyboard = {
      sku: brief.sku,
      product: brief.product_name,
      video_style: video_style,
      duration: duration,
      format: '1920x1080 (landscape)',
      mood: designDNA.mood,
      music_suggestion: this._suggestMusic(brief, theme),
      scenes: scenes,
      kling_prompts: scenes.map(s => s.kling_prompt),
      created_at: new Date().toISOString()
    };

    console.log(`[VideoProducer] Storyboard [${video_style}]: ${scenes.length} scenes`);
    return { storyboard };
  }

  // ═══════════════════════════════════════
  //  PHASE 2: GENERATE SCENE IMAGES
  // ═══════════════════════════════════════

  /**
   * Generate scene start frames — parallel or sequential based on options.
   * @param {Object} storyboard
   * @param {string} outputDir
   * @param {string[]} inputImages
   * @param {Object} [options] - { parallel: true }
   */
  async generateSceneImages(storyboard, outputDir, inputImages = [], options = {}) {
    if (!this.imageGen) {
      console.warn('[VideoProducer] ImageGenerator not available — skipping');
      return {};
    }

    const framesDir = path.join(outputDir, 'scene_frames');
    if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir, { recursive: true });

    const parallel = options.parallel !== false;
    console.log(`[VideoProducer] Scene frames: ${storyboard.scenes.length} scenes, ${parallel ? 'PARALLEL' : 'SEQUENTIAL'}`);

    const sceneImages = {};

    if (parallel) {
      const settled = await Promise.allSettled(
        storyboard.scenes.map(scene => this._generateOneSceneFrame(scene, framesDir, storyboard.sku, inputImages))
      );
      settled.forEach((r, i) => {
        const n = storyboard.scenes[i].scene;
        if (r.status === 'fulfilled' && r.value) sceneImages[n] = r.value;
        else console.error(`[Scene ${n}] Failed: ${r.reason?.message || 'Unknown'}`);
      });
    } else {
      for (const scene of storyboard.scenes) {
        try { const p = await this._generateOneSceneFrame(scene, framesDir, storyboard.sku, inputImages); if (p) sceneImages[scene.scene] = p; }
        catch (err) { console.error(`[Scene ${scene.scene}] Error: ${err.message}`); }
      }
    }

    console.log(`[VideoProducer] Scene frames: ${Object.keys(sceneImages).length}/${storyboard.scenes.length} OK`);
    return sceneImages;
  }

  async _generateOneSceneFrame(scene, framesDir, sku, inputImages) {
    const n = scene.scene;
    const outputPath = path.join(framesDir, `${sku}_scene${n}_frame.jpg`);

    if (fs.existsSync(outputPath)) {
      console.log(`[Scene ${n}] Cached, skipping`);
      return outputPath;
    }

    console.log(`[Scene ${n}] ${scene.title} — generating frame`);

    // Sanitize through prompt-guard — same RULE-015 protection as listing slots.
    // Uses 'video_scene' constraint key (defined in slot-constraints.json).
    const { prompt: cleanPrompt } = promptGuard.sanitize(scene.image_prompt, 'video_scene');

    const gen = await this.imageGen.generate(cleanPrompt, outputPath, {
      aspectRatio: '16:9',
      referenceImages: inputImages.slice(0, 3)
    });
    if (!gen.success) throw new Error(gen.error || 'Generation failed');

    const resizedPath = outputPath.replace('.jpg', '_hd.jpg');
    await sharp(outputPath).resize(1920, 1080, { fit: 'cover' }).jpeg({ quality: 95 }).toFile(resizedPath);
    fs.unlinkSync(outputPath);
    fs.renameSync(resizedPath, outputPath);

    console.log(`[Scene ${n}] Frame OK`);
    return outputPath;
  }

  // ═══════════════════════════════════════
  //  PHASE 3: KLING 3.0 MULTI-SHOT VIDEO
  // ═══════════════════════════════════════

  /**
   * Generate video via Kling 3.0 multi-shot (1 request for all scenes)
   * with @element product reference for consistency
   *
   * @param {Object} storyboard
   * @param {string} outputDir
   * @param {Object} sceneImages - { sceneNum: imagePath } từ Phase 2
   * @param {string[]} [productRefImages] - product reference image paths for @element
   */
  async generateVideos(storyboard, outputDir, sceneImages = {}, productRefImages = []) {
    if (!this.kie) {
      console.warn('[VideoProducer] No KIE client — skipping video generation');
      return [];
    }

    console.log(`\n--- Phase 2c: Kling 3.0 Multi-Shot Video ---`);

    // Bước 1: Upload first frame (scene 1) for video start
    const firstScenePath = sceneImages[1];
    let firstFrameUrl = null;
    if (firstScenePath && fs.existsSync(firstScenePath)) {
      try {
        firstFrameUrl = await this.uploadImage(firstScenePath);
        console.log(`[VideoProducer] First frame uploaded`);
      } catch (err) {
        console.error(`[VideoProducer] First frame upload failed: ${err.message}`);
      }
    }

    // Bước 2: Upload product reference images for @element
    const elementUrls = [];
    for (const refPath of productRefImages.slice(0, 4)) {
      try {
        if (refPath.startsWith('http')) {
          elementUrls.push(refPath);
        } else if (fs.existsSync(refPath)) {
          elementUrls.push(await this.kie.uploadFromLocal(refPath, 'video-elements', {
            maxSize: 1024, quality: 90, format: 'jpeg'
          }));
        }
      } catch (err) {
        console.error(`[VideoProducer] Element ref upload failed: ${err.message}`);
      }
    }

    // Bước 3: Build multi-shot request
    const scenes = storyboard.scenes;
    const durationPerScene = Math.min(3, Math.floor(15 / scenes.length)); // max 15s total
    const totalDuration = String(durationPerScene * scenes.length);

    // Build multi_prompt array with @element_product references
    const multiPrompt = scenes.map(scene => ({
      prompt: elementUrls.length > 0
        ? `${scene.kling_prompt} @element_product`
        : scene.kling_prompt,
      duration: durationPerScene
    }));

    const videoInput = {
      multi_shots: true,
      duration: totalDuration,
      aspect_ratio: '16:9',
      mode: 'pro',
      sound: true,  // Required: multi_shots requires sound=true
      multi_prompt: multiPrompt
    };

    // Add first frame if available
    if (firstFrameUrl) {
      videoInput.image_urls = [firstFrameUrl];
    }

    // Add element references if available (min 2 images required)
    if (elementUrls.length >= 2) {
      videoInput.kling_elements = [{
        name: 'element_product',
        description: storyboard.product,
        element_input_urls: elementUrls.slice(0, 4)
      }];
      console.log(`[VideoProducer] @element_product: ${elementUrls.length} reference images`);
    }

    console.log(`[VideoProducer] Multi-shot: ${scenes.length} scenes × ${durationPerScene}s = ${totalDuration}s`);
    console.log(`[VideoProducer] Mode: pro (1920x1080), sound: on (required for multi-shot)`);

    // Bước 4: Submit and poll via KIE unified API
    try {
      const result = await this.kie.run('kling-3.0/video', videoInput, 'video', 'Kling 3.0 multi-shot');

      const videoUrl = result.resultUrls?.[0];
      if (!videoUrl) throw new Error('No video URL in result');

      // Download final video
      const outputPath = path.join(outputDir, `${storyboard.sku}_tvc_multishot.mp4`);
      console.log(`[VideoProducer] Downloading multi-shot video...`);
      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) throw new Error(`Download failed: ${videoResponse.status}`);

      const buffer = Buffer.from(await videoResponse.arrayBuffer());
      fs.writeFileSync(outputPath, buffer);
      console.log(`[VideoProducer] Saved: ${outputPath} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);

      return scenes.map(s => ({ scene: s.scene, success: true, path: outputPath }));

    } catch (error) {
      console.error(`[VideoProducer] Multi-shot failed: ${error.message}`);
      console.log(`[VideoProducer] Falling back to single-scene mode (kling-2.6)...`);

      // Fallback: generate each scene individually via kling-2.6/image-to-video
      return this._generateVideosFallback(storyboard, outputDir, sceneImages);
    }
  }

  /**
   * Fallback: generate each scene as individual video via kling-2.6/image-to-video
   * Now runs ALL scenes in PARALLEL
   */
  async _generateVideosFallback(storyboard, outputDir, sceneImages) {
    console.log(`\n[VideoProducer] Fallback: kling-2.6 PARALLEL (${storyboard.scenes.length} scenes)`);

    const settled = await Promise.allSettled(
      storyboard.scenes.map(scene => this._generateOneVideoFallback(scene, outputDir, sceneImages, storyboard.sku))
    );

    const results = settled.map((r, i) => {
      const sceneNum = storyboard.scenes[i].scene;
      if (r.status === 'fulfilled') return r.value;
      return { scene: sceneNum, success: false, reason: r.reason?.message || 'Unknown' };
    });

    results.sort((a, b) => a.scene - b.scene);
    console.log(`\n[VideoProducer] Fallback: ${results.filter(r => r.success).length}/${storyboard.scenes.length} scenes OK`);
    return results;
  }

  async _generateOneVideoFallback(scene, outputDir, sceneImages, sku) {
    const imgPath = sceneImages[scene.scene];
    if (!imgPath || !fs.existsSync(imgPath)) {
      return { scene: scene.scene, success: false, reason: 'No start frame' };
    }

    const frameUrl = await this.uploadImage(imgPath);
    const result = await this.kie.run('kling-2.6/image-to-video', {
      prompt: scene.kling_prompt,
      image_urls: [frameUrl],
      duration: '5',
      sound: false
    }, 'video', `Scene ${scene.scene}`);

    const videoUrl = result.resultUrls?.[0];
    if (!videoUrl) throw new Error('No video URL');

    const outputPath = path.join(outputDir, `${sku}_scene${scene.scene}.mp4`);
    console.log(`[Scene ${scene.scene}] Downloading video...`);
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) throw new Error(`Download failed: ${videoResponse.status}`);

    const buffer = Buffer.from(await videoResponse.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);
    console.log(`[Scene ${scene.scene}] Video saved (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
    return { scene: scene.scene, success: true, path: outputPath };
  }

  // ═══════════════════════════════════════
  //  SCENE BUILDERS — image_prompt + kling_prompt
  // ═══════════════════════════════════════

  _buildScenes(brief, dna, theme) {
    const style = brief.video_style || 'lifestyle';
    let scenes;
    if (style === 'tvc') scenes = this._buildScenesTVC(brief, dna, theme);
    else if (style === 'lifestyle') scenes = this._buildScenesLifestyle(brief, dna, theme);
    else scenes = this._buildScenesLegacy(brief, dna, theme);

    const zeroHallucinationRule = " CRITICAL: Do NOT alter the original product structure. Do NOT add, remove, or modify any patterns, text, or shapes. Maintain 100% exact conformity to the reference image.";
    
    return scenes.map(s => {
      if (s.kling_prompt) {
        s.kling_prompt += zeroHallucinationRule;
      }
      return s;
    });
  }

  _buildScenesTVC(brief, dna, theme) {
    return [
      {
        scene: 1, title: 'The High-End Reveal', duration: '0.0s - 2.0s',
        image_prompt: '', kling_prompt: `Fast dynamic snap-zoom out. Starting from an extreme close-up of the engraved wood, pulling back quickly to reveal the entire '${brief.product_name}' standing upright. High-end commercial studio lighting, absolute crisp contrast, highly reflective glossy finish. Premium product advertisement style, Red Komodo 6k footage.`
      },
      {
        scene: 2, title: 'The Premium Material', duration: '2.0s - 4.0s',
        image_prompt: '', kling_prompt: `Slow, precision robotic camera track sweeping across the front surface of the '${brief.product_name}'. Hard studio rim lights dynamically reflect off the perfectly clear acrylic panel, showcasing the premium wood texture underneath. Flawless commercial product shot, insanely detailed.`
      },
      {
        scene: 3, title: 'The Wow Action', duration: '4.0s - 5.5s',
        image_prompt: '', kling_prompt: `High-speed slow-motion. A vibrant, colorful token is elegantly dropped into the top of the '${brief.product_name}'. The camera follows the token falling at 120fps. Dramatic interplay of light and shadow, popping colors, highly cinematic and mesmerizing commercial motion.`
      },
      {
        scene: 4, title: 'The Dynamic Spin', duration: '5.5s - 7.5s',
        image_prompt: '', kling_prompt: `Fast, energetic 180-degree orbital spin around the '${brief.product_name}' sitting on its easel stand. Background is a highly stylized, modern, clean, premium desk setup. Vibrant studio lighting illuminating the inner colorful tokens. High-end TV commercial motion.`
      },
      {
        scene: 5, title: 'The User Interaction', duration: '7.5s - 9.5s',
        image_prompt: '', kling_prompt: `Medium-close shot, smooth slider push. A perfectly framed, clean hand confidently places another brightly lit colorful token into the '${brief.product_name}'. Subtle lens flare hits the lens. Upbeat, premium lifestyle commercial aesthetic, visually striking.`
      },
      {
        scene: 6, title: 'The Impact', duration: '9.5s - 11.0s',
        image_prompt: '', kling_prompt: `Macro low-angle hero shot. The interior of the '${brief.product_name}' is now bursting with vibrant, colorful tokens. A sweeping spotlight passes over the product, making the colors pop intensely against the warm wood. Perfect commercial lighting, high saturation, sharp focus.`
      },
      {
        scene: 7, title: 'The Lifestyle Integration', duration: '11.0s - 13.0s',
        image_prompt: '', kling_prompt: `Wide establishing shot with a slow crane pull-back. The '${brief.product_name}' takes center stage on a perfectly styled, luxurious, modern desk. Beautifully controlled set lighting with deep aesthetic shadows. Visually massive, aspirational commercial vibe.`
      },
      {
        scene: 8, title: 'The Ultimate Hero Hold', duration: '13.0s - 15.0s',
        image_prompt: '', kling_prompt: `Static, ultra-sharp hero product shot. The '${brief.product_name}' stands perfectly illuminated from all angles, glowing with premium quality. Negative space left perfectly balanced for commercial text/graphics overlay. Masterpiece product photography motion, bold and triumphant. Fade to perfectly smooth black.`
      }
    ];
  }

  _buildScenesLifestyle(brief, dna, theme) {
    return [
      {
        scene: 1, title: 'Establishing Reveal', duration: '0.0s - 1.5s',
        image_prompt: '', kling_prompt: `Close-up static shot. Warm morning sunlight filtering through a window, casting soft shadows across a wooden desk. A '${brief.product_name}' stands upright on its easel stand, holding a few colorful round tokens inside. Cinematic depth of field, background completely blurred, high visual fidelity, photorealistic.`
      },
      {
        scene: 2, title: 'Slow Push-In', duration: '1.5s - 3.5s',
        image_prompt: '', kling_prompt: `Slow, smooth push-in camera movement towards the clear front of the '${brief.product_name}' standing upright on the desk. The camera focuses on the vibrant details of the colorful tokens inside. Natural window lighting, cozy childhood ambiance, highly detailed textures.`
      },
      {
        scene: 3, title: 'Action Anticipation', duration: '3.5s - 5.5s',
        image_prompt: '', kling_prompt: `Close-up shot, shallow depth of field. A small child's hand reaches into the frame from the side, picking up a loose, colorful token resting on the wooden desk right in front of the upright '${brief.product_name}'. Soft, glowing natural backlight.`
      },
      {
        scene: 4, title: 'Action Detail', duration: '5.5s - 7.0s',
        image_prompt: '', kling_prompt: `Extreme close-up macro shot. The child's hand gently dropping a bright, colorful token into the top slot of the '${brief.product_name}'. Sunlight gracefully catches the edge of the token as it falls. Crisp details of the grain texture and glossy layer.`
      },
      {
        scene: 5, title: 'Camera Arc', duration: '7.0s - 8.5s',
        image_prompt: '', kling_prompt: `Slow camera arc from left to right around the '${brief.product_name}' standing steadily on its easel. Sun flares beautifully peek through the transparent surface, revealing the accumulation of colorful tokens inside. Warm, joyful holiday lighting, cinematic rim light.`
      },
      {
        scene: 6, title: 'Rack Focus', duration: '8.5s - 10.0s',
        image_prompt: '', kling_prompt: `Rack focus effect. Starting with a soft blur, then elegantly coming into sharp macro focus on the colorful tokens gathered at the bottom of the '${brief.product_name}'. The engraved text at the bottom becomes perfectly crisp and clear.`
      },
      {
        scene: 7, title: 'Wide Context', duration: '10.0s - 11.5s',
        image_prompt: '', kling_prompt: `Medium wide shot. A neat, aesthetic child's study desk bathed in golden hour sunlight. The '${brief.product_name}' sits proudly on its stand as the centerpiece, surrounded by a few loose tokens, a cute pencil cup, and a partially open notebook. Cozy, inspiring atmosphere, 8k resolution.`
      },
      {
        scene: 8, title: 'Final Action', duration: '11.5s - 13.0s',
        image_prompt: '', kling_prompt: `Close-up fast dynamic pan. A child's hand enthusiastically drops three more colorful tokens into the top of the '${brief.product_name}' in rapid succession. Bright, cheerful lighting highlighting the vibrant colors and shiny surfaces.`
      },
      {
        scene: 9, title: 'Hero Hold', duration: '13.0s - 15.0s',
        image_prompt: '', kling_prompt: `Static hero shot, lingering hold. The camera pauses on the '${brief.product_name}' standing perfectly lit on the desk, now noticeably fuller with colorful tokens. Soft, magical bokeh background. Evokes a strong feeling of achievement, pride, and reward. Fade to black.`
      }
    ];
  }

  _buildScenesLegacy(brief, dna, theme) {
    const mood = (theme.mood || []).join(', ') || 'warm and inviting';
    const lighting = theme.lighting || 'warm soft lighting';
    const surface = theme.surfaces?.[0] || 'wooden table';
    const context = theme.lifestyle_contexts?.[0] || 'cozy home setting';

    return [
      {
        scene: 1,
        title: 'Opening — Attention Grab',
        duration: '0-4s',
        description: `Close-up of ${brief.product_name} catching light, slow reveal`,
        // Prompt cho Fal.ai image gen — tạo ảnh start frame
        image_prompt: `Cinematic close-up of the exact product from reference images, ` +
          `${brief.product_name}, on a clean ${surface}, ` +
          `${lighting}, ${mood} atmosphere, ` +
          `shallow depth of field, dramatic product hero shot, ` +
          `wide 16:9 composition, photorealistic, professional product photography, 4K, ` +
          `no text, no watermark`,
        // Prompt cho Kling — mô tả camera motion trên ảnh start frame
        kling_prompt: `The product slowly rotates to catch light, cinematic close-up, ` +
          `${lighting}, ${mood} atmosphere, ` +
          `shallow depth of field, professional product video, 4K`,
        transition: 'Slow fade in'
      },
      {
        scene: 2,
        title: 'Context — Lifestyle',
        duration: '4-8s',
        description: `Product in lifestyle setting`,
        image_prompt: `The exact product from reference images displayed in a ${context}, ` +
          `placed on a ${surface} with relevant props, ` +
          `${lighting}, ${mood} atmosphere, ` +
          `wide 16:9 cinematic composition, storytelling lifestyle scene, ` +
          `depth of field with blurred background, photorealistic, 4K, ` +
          `no text, no watermark`,
        kling_prompt: `Camera slowly pans around the scene revealing the full setting, ` +
          `gentle ambient movement in the background, leaves swaying, light shifting, ` +
          `${mood} atmosphere, ${lighting}, lifestyle product video, cinematic, 4K`,
        transition: 'Smooth pan'
      },
      {
        scene: 3,
        title: 'Detail — Quality',
        duration: '8-13s',
        description: `Close-up showing material quality, craftsmanship`,
        image_prompt: `Extreme close-up macro shot of the exact product from reference images, ` +
          `showing ${(brief.materials || []).join(' and ')} texture and craftsmanship details, ` +
          `fine grain of the wood visible, vivid UV print colors, ` +
          `${lighting}, wide 16:9 composition, ` +
          `macro product photography, professional quality, 4K, ` +
          `no text, no watermark`,
        kling_prompt: `Camera slowly zooms in to reveal fine details and texture of the product, ` +
          `${lighting}, smooth slow camera movement, macro product video, ` +
          `professional quality, 4K`,
        transition: 'Cut or dissolve'
      },
      {
        scene: 4,
        title: 'Emotion — Gift Moment',
        duration: '13-19s',
        description: `Gift-giving moment, emotional scene`,
        image_prompt: `${this._buildEmotionalScene(brief)}, ` +
          `the exact product from reference images clearly visible, ` +
          `${lighting}, ${mood} atmosphere, ` +
          `wide 16:9 cinematic composition, emotional storytelling, ` +
          `photorealistic, professional photography, 4K, ` +
          `no text, no watermark`,
        kling_prompt: `The people in the scene come alive with natural gentle movement, ` +
          `a warm emotional gift-giving moment, subtle expressions of joy and appreciation, ` +
          `${mood} atmosphere, ${lighting}, cinematic product video, 4K`,
        transition: 'Warm dissolve'
      },
      {
        scene: 5,
        title: 'Close — Product + CTA',
        duration: '19-24s',
        description: `Final beauty shot, product centered`,
        image_prompt: `Beautiful hero beauty shot of the exact product from reference images, ` +
          `centered on an elegant display surface, ` +
          `${dna.colorPalette} color scheme, ${lighting}, ` +
          `clean space around product for text overlay, ` +
          `wide 16:9 premium product photography, ` +
          `${mood} atmosphere, photorealistic, 4K, ` +
          `no text, no watermark`,
        kling_prompt: `Gentle camera push-in towards the product, soft ambient light shifts, ` +
          `${mood} atmosphere, premium beauty shot, ` +
          `centered composition, professional product video, 4K`,
        transition: 'Fade to end card'
      }
    ];
  }

  _buildEmotionalScene(brief) {
    const scenes = {
      teacher_gift: 'A young girl with a ponytail giving the product (inserted in a small potted plant) to her teacher in a bright classroom, both smiling warmly, classroom chalkboard in background',
      christmas: 'Hands carefully opening a gift box under a Christmas tree revealing the product, warm festive lighting, red and green decorations',
      mothers_day: 'A daughter presenting the product to her mother in a bright sunny kitchen, both smiling, flowers on the table',
      valentines: 'A couple sharing a romantic moment, one person presenting the product as a surprise gift, candlelight',
      birthday: 'A person excitedly unwrapping the product at a birthday celebration, balloons and cake in background',
      general_gift: 'A heartfelt gift-giving moment between two people, one presenting the product with a warm smile'
    };
    return scenes[brief.occasion] || scenes.general_gift;
  }

  _suggestMusic(brief, theme) {
    const musicMap = {
      christmas: 'Gentle holiday instrumental — soft piano + bells, warm and festive',
      mothers_day: 'Tender acoustic guitar + soft strings, emotional and warm',
      valentines: 'Romantic piano melody, gentle and intimate',
      easter: 'Light cheerful acoustic, fresh and bright',
      teacher_gift: 'Warm uplifting instrumental, appreciation feel',
      birthday: 'Happy celebratory melody, joyful and bright',
      general_gift: 'Warm acoustic instrumental, heartfelt and premium feel'
    };
    return musicMap[brief.occasion] || 'Warm acoustic instrumental, emotional and inviting';
  }

  save(storyboard, outputDir) {
    const dir = path.join(outputDir, 'video');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const storyboardPath = path.join(dir, `${storyboard.sku}_storyboard.json`);
    fs.writeFileSync(storyboardPath, JSON.stringify(storyboard, null, 2));

    const promptsPath = path.join(dir, `${storyboard.sku}_kling_prompts.txt`);
    const promptsText = storyboard.scenes.map((s, i) =>
      `=== SCENE ${i + 1}: ${s.title} (${s.duration}) ===\n` +
      `Image Prompt:\n${s.image_prompt}\n\n` +
      `Kling Motion Prompt:\n${s.kling_prompt}\n`
    ).join('\n---\n\n');
    fs.writeFileSync(promptsPath, promptsText);

    console.log(`[VideoProducer] Saved: ${storyboardPath}`);
    console.log(`[VideoProducer] Saved: ${promptsPath}`);

    return { storyboardPath, promptsPath };
  }
}

module.exports = VideoProducer;
