import { google } from "googleapis";
import { Readable } from "stream";
import { getDriveImageUrl } from "./drive-utils";

const IMAGE_FOLDER_ID = "1WJiXLo7XVy8YDoSN1pNPCRatGzDA7yb9";
export const O2D_UPLOADS_FOLDER_ID = "19ZqWS5zYD2P4SIpcGNQR8gXcDiagH2rq";
export const I2R_UPLOADS_FOLDER_ID = "16rv4h7PBrc1n0EtC91RNfRGeIxrGFSQo";
export const O2DKB_UPLOADS_FOLDER_ID = "15Aw-m9qixPsONxIh5b3ND1l5RIDaHmXJ";
export const RECHARGE_UPLOADS_FOLDER_ID = "1G_zO-DZbWVg67-AN6stxITjdz6i6Yj1w";

async function getDriveClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXTAUTH_URL
  );

  const tokens = JSON.parse(process.env.GOOGLE_OAUTH_TOKENS || "{}");
  oauth2Client.setCredentials(tokens);

  return google.drive({ version: "v3", auth: oauth2Client });
}

/**
 * Uploads a file and returns its Drive id. By default the file is opened to
 * "anyone with the link" (existing behaviour for CVs, voice notes etc.).
 * Pass { private: true } for ID documents (Aadhaar, PAN, bank) — those are
 * served only through Sarthi to logged-in HR/admins (Sahil, 2026-10-27).
 */
export async function uploadFileToDrive(file: File, folderId?: string, opts?: { private?: boolean }): Promise<string | null> {
  try {
    const drive = await getDriveClient();
    
    // Convert File to Buffer then to Readable Stream
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const fileMetadata = {
      name: `${Date.now()}-${file.name}`,
      parents: [folderId || IMAGE_FOLDER_ID],
    };

    const media = {
      mimeType: file.type,
      body: stream,
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, webViewLink, webContentLink",
    });

    const fileId = response.data.id;
    if (!fileId) return null;

    // Set permission to anyone with the link can view (not for private documents)
    if (!opts?.private) await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    // Return the direct download link or webViewLink
    // Note: To display directly in <img>, we often use a proxy or the webContentLink
    return fileId; 
  } catch (error) {
    console.error("Error uploading to Google Drive:", error);
    return null;
  }
}

export async function uploadBase64ToDrive(base64Data: string, folderId?: string): Promise<string | null> {
  try {
    const drive = await getDriveClient();
    
    // Extract mime type and base64 string
    const match = base64Data.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
      console.error("Invalid base64 string format");
      return null;
    }
    const mimeType = match[1];
    const base64Str = match[2];

    const buffer = Buffer.from(base64Str, 'base64');
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const fileMetadata = {
      name: `attendance-${Date.now()}.${mimeType.split('/')[1]}`,
      parents: [folderId || IMAGE_FOLDER_ID],
    };

    const media = {
      mimeType: mimeType,
      body: stream,
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, webViewLink, webContentLink",
    });

    const fileId = response.data.id;
    if (!fileId) return null;

    // Set permission to anyone with the link can view
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    return fileId; // Return file ID
  } catch (error) {
    console.error("Error uploading base64 to Google Drive:", error);
    return null;
  }
}

export async function getFileStream(fileId: string) {
  try {
    const drive = await getDriveClient();
    const response = await drive.files.get(
      { fileId: fileId, alt: "media" },
      { responseType: "stream" }
    );
    
    // Also get metadata for MIME type
    const metadata = await drive.files.get({
      fileId: fileId,
      fields: "mimeType, size, name"
    });

    return {
      stream: response.data,
      mimeType: metadata.data.mimeType,
      size: metadata.data.size,
      name: metadata.data.name
    };
  } catch (error) {
    console.error("Error getting file stream from Drive:", error);
    return null;
  }
}

export { getDriveImageUrl };

/**
 * Name / type / size of an uploaded file, and whether it is shared by link
 * (every upload except private employee documents). Used by the file viewer.
 */
export async function getFileMeta(fileId: string): Promise<{ name: string; mimeType: string; size: number; isPublic: boolean } | null> {
  try {
    const drive = await getDriveClient();
    const res = await drive.files.get({ fileId, fields: "name, mimeType, size, permissions(type, role)" });
    const perms = (res.data.permissions || []) as { type?: string }[];
    return {
      name: res.data.name || "file",
      mimeType: res.data.mimeType || "",
      size: Number(res.data.size || 0),
      isPublic: perms.some((p) => p.type === "anyone"),
    };
  } catch (error) {
    console.error("getFileMeta failed", fileId, error);
    return null;
  }
}
