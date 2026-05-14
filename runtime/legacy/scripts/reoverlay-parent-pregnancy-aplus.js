#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { createAplusModule } = require('../utils/image-utils');
sharp.cache(false);

const skuDir = path.resolve(process.argv[2] || '../../data/PARENT PREGNANCY');
const outDir = path.join(skuDir, 'output', 'aplus');
const brief = JSON.parse(fs.readFileSync(path.join(skuDir, 'brief.json'), 'utf8'));
const dnaPath = path.join(skuDir, 'research', `${brief.sku}_design-dna.json`);
let dna = {};
try { dna = JSON.parse(fs.readFileSync(dnaPath, 'utf8')); } catch (_) {}

function tl(text, x, y, fontSize, overrides = {}) {
  return { text, x, y, fontSize, textAlign: 'left', shadow: true, color: '#FFFFFF', fontFamily: 'Arial', fontWeight: '700', maxWidth: 600, width: 680, height: 100, ...overrides };
}
function moduleText(n) {
  const heading = dna.typography?.heading || 'Arial';
  const body = dna.typography?.body || 'Arial';
  const t = (text, x, y, sz, ov={}) => tl(text, x, y, sz, { fontFamily: body, ...ov });
  return ({
    1: [
      t('The First Hello,\nMade To Keep', 58, 48, 40, { fontFamily: heading, fontWeight: 'bold', maxWidth: 520, width: 600, height: 130 }),
      t('Handmade wooden pregnancy announcement keepsakes for Daddy, Grandpa, and baby reveal moments.', 58, 195, 21, { maxWidth: 600, width: 680, height: 90 }),
      t('For Daddy · For Grandpa · Universal Baby Reveal', 58, 525, 21, { maxWidth: 720, width: 780, height: 55 })
    ],
    2: [
      t('Turn A Tiny Secret\nInto Their Favorite Memory', 58, 56, 34, { fontFamily: heading, fontWeight: 'bold', maxWidth: 560, width: 640, height: 120 }),
      t('A reveal gift they can hold, open, and keep long after the first happy tears.', 58, 200, 21, { maxWidth: 560, width: 640, height: 85 }),
      t('A simple announcement', 70, 485, 17, { maxWidth: 300, width: 360, height: 45 }),
      t('A keepsake moment', 850, 485, 17, { maxWidth: 330, width: 390, height: 45 })
    ],
    3: [
      t('Choose The Reveal\nThat Fits Your Story', 56, 32, 32, { fontFamily: heading, fontWeight: 'bold', maxWidth: 560, width: 640, height: 110 }),
      t('For Daddy\nBest for husband reveals\nHi Daddy message', 70, 410, 18, { maxWidth: 330, width: 380, height: 135, bgColor: '#7A2730', bgPadding: 12 }),
      t('For Grandpa\nBest for grandpa-to-be\nLittle secret message', 535, 410, 18, { maxWidth: 330, width: 380, height: 135, bgColor: '#7A2730', bgPadding: 12 }),
      t('Universal Baby Reveal\nBest for family keepsakes\nComing Soon message', 1000, 410, 18, { maxWidth: 340, width: 390, height: 135, bgColor: '#7A2730', bgPadding: 12 })
    ],
    4: [
      t('Not Sure Which One To Pick?', 62, 38, 34, { fontFamily: heading, fontWeight: 'bold', maxWidth: 620, width: 700, height: 85 }),
      t('For the first person you want to call “Daddy”\nChoose For Daddy', 80, 420, 17, { maxWidth: 340, width: 390, height: 115, bgColor: '#7A2730', bgPadding: 12 }),
      t('For the proudest future grandpa\nChoose For Grandpa', 535, 420, 17, { maxWidth: 340, width: 390, height: 115, bgColor: '#7A2730', bgPadding: 12 }),
      t('For a neutral family reveal or nursery display\nChoose Universal Baby Reveal', 990, 420, 17, { maxWidth: 360, width: 410, height: 115, bgColor: '#7A2730', bgPadding: 12 })
    ],
    5: [
      t('More Than A Card.\nA First Keepsake.', 855, 82, 36, { fontFamily: heading, fontWeight: 'bold', maxWidth: 460, width: 530, height: 125, bgColor: '#7A2730', bgPadding: 14 }),
      t('Personal, handmade, and ready to become part of the baby story.', 855, 245, 21, { maxWidth: 460, width: 530, height: 85, bgColor: '#7A2730', bgPadding: 12 }),
      t('Start With One · Build The Collection', 855, 365, 22, { maxWidth: 460, width: 530, height: 60, bgColor: '#7A2730', bgPadding: 12 }),
      t('Handmade Wood · Ultrasound Frame · Gift-Ready Moment', 855, 505, 17, { maxWidth: 460, width: 530, height: 60, bgColor: '#7A2730', bgPadding: 12 })
    ]
  })[n] || [];
}

(async () => {
  for (let n = 1; n <= 5; n++) {
    const raw = path.join(outDir, `${brief.sku}_aplus_m${n}_raw.jpg`);
    const final = path.join(outDir, `${brief.sku}_aplus_module${n}.jpg`);
    await createAplusModule(raw, moduleText(n), final);
  }
})();
