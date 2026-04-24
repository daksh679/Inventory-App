import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import { storageBucket, supabaseAdmin } from "@/lib/storage";

let schemaReadyPromise;

export function buildStoragePath(userId, fileExtension = "jpg") {
  return `${userId}/${randomUUID()}.${fileExtension}`;
}

function dataUrlToBuffer(dataUrl) {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid image payload.");
  }

  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

function inferExtension(contentType) {
  const map = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  return map[contentType] || "jpg";
}

export async function ensureWardrobeSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS wardrobe_items (
          id UUID PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT '',
          color TEXT NOT NULL DEFAULT '',
          occasion TEXT NOT NULL DEFAULT '',
          season TEXT NOT NULL DEFAULT '',
          notes TEXT NOT NULL DEFAULT '',
          image_path TEXT NOT NULL,
          image_url TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS wardrobe_items_user_id_created_at_idx
        ON wardrobe_items (user_id, created_at DESC);
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS outfit_selections (
          user_id TEXT PRIMARY KEY,
          top_item_id UUID,
          bottom_item_id UUID,
          shoes_item_id UUID,
          accessory_item_id UUID,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
    })();
  }

  return schemaReadyPromise;
}

export async function listWardrobeItems(userId) {
  await ensureWardrobeSchema();
  const result = await db.query(
    `
      SELECT id, name, category, type, color, occasion, season, notes, image_url AS image, created_at
      FROM wardrobe_items
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
    [userId],
  );

  return result.rows;
}

export async function getOutfitSelection(userId) {
  await ensureWardrobeSchema();
  const result = await db.query(
    `
      SELECT
        COALESCE(top_item_id::text, '') AS top,
        COALESCE(bottom_item_id::text, '') AS bottom,
        COALESCE(shoes_item_id::text, '') AS shoes,
        COALESCE(accessory_item_id::text, '') AS accessory
      FROM outfit_selections
      WHERE user_id = $1
    `,
    [userId],
  );

  return result.rows[0] || {};
}

export async function createWardrobeItem(userId, payload) {
  await ensureWardrobeSchema();

  const name = String(payload.name || "").trim();
  if (!name) {
    throw new Error("Item name is required.");
  }

  const category = String(payload.category || "").trim();
  if (!["top", "bottom", "shoes", "accessory"].includes(category)) {
    throw new Error("Invalid category.");
  }

  const dataUrl = String(payload.imageData || "");
  if (!dataUrl) {
    throw new Error("A clothing image is required.");
  }

  const { contentType, buffer } = dataUrlToBuffer(dataUrl);
  const imagePath = buildStoragePath(userId, inferExtension(contentType));
  const upload = await supabaseAdmin.storage.from(storageBucket).upload(imagePath, buffer, {
    contentType,
    upsert: false,
  });

  if (upload.error) {
    throw new Error(upload.error.message || "Image upload failed.");
  }

  const publicUrl = supabaseAdmin.storage.from(storageBucket).getPublicUrl(imagePath).data.publicUrl;
  const id = randomUUID();

  const result = await db.query(
    `
      INSERT INTO wardrobe_items (
        id, user_id, name, category, type, color, occasion, season, notes, image_path, image_url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, name, category, type, color, occasion, season, notes, image_url AS image, created_at
    `,
    [
      id,
      userId,
      name,
      category,
      String(payload.type || "").trim(),
      String(payload.color || "").trim(),
      String(payload.occasion || "").trim(),
      String(payload.season || "").trim(),
      String(payload.notes || "").trim(),
      imagePath,
      publicUrl,
    ],
  );

  return result.rows[0];
}

export async function deleteWardrobeItem(userId, itemId) {
  await ensureWardrobeSchema();

  const deleted = await db.query(
    `
      DELETE FROM wardrobe_items
      WHERE user_id = $1 AND id = $2
      RETURNING image_path
    `,
    [userId, itemId],
  );

  if (!deleted.rowCount) {
    return false;
  }

  await db.query(
    `
      INSERT INTO outfit_selections (user_id, top_item_id, bottom_item_id, shoes_item_id, accessory_item_id, updated_at)
      VALUES ($1, NULL, NULL, NULL, NULL, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        top_item_id = CASE WHEN outfit_selections.top_item_id = $2::uuid THEN NULL ELSE outfit_selections.top_item_id END,
        bottom_item_id = CASE WHEN outfit_selections.bottom_item_id = $2::uuid THEN NULL ELSE outfit_selections.bottom_item_id END,
        shoes_item_id = CASE WHEN outfit_selections.shoes_item_id = $2::uuid THEN NULL ELSE outfit_selections.shoes_item_id END,
        accessory_item_id = CASE WHEN outfit_selections.accessory_item_id = $2::uuid THEN NULL ELSE outfit_selections.accessory_item_id END,
        updated_at = NOW()
    `,
    [userId, itemId],
  );

  const imagePath = deleted.rows[0].image_path;
  if (imagePath) {
    await supabaseAdmin.storage.from(storageBucket).remove([imagePath]);
  }

  return true;
}

export async function saveOutfitSelection(userId, selection) {
  await ensureWardrobeSchema();

  const normalize = (value) => {
    const trimmed = String(value || "").trim();
    return trimmed || null;
  };

  const top = normalize(selection.top);
  const bottom = normalize(selection.bottom);
  const shoes = normalize(selection.shoes);
  const accessory = normalize(selection.accessory);

  await db.query(
    `
      INSERT INTO outfit_selections (user_id, top_item_id, bottom_item_id, shoes_item_id, accessory_item_id, updated_at)
      VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5::uuid, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        top_item_id = EXCLUDED.top_item_id,
        bottom_item_id = EXCLUDED.bottom_item_id,
        shoes_item_id = EXCLUDED.shoes_item_id,
        accessory_item_id = EXCLUDED.accessory_item_id,
        updated_at = NOW()
    `,
    [userId, top, bottom, shoes, accessory],
  );

  return {
    top: top || "",
    bottom: bottom || "",
    shoes: shoes || "",
    accessory: accessory || "",
  };
}
