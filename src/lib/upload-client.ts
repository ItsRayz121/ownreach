export interface UploadResult {
  url: string;
  width: number;
  height: number;
  publicId: string;
}

export async function uploadImage(
  file: File,
  folder: "avatars" | "covers" | "posts" | "community-avatars" | "messages"
): Promise<UploadResult> {
  const signRes = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder }),
  });
  if (!signRes.ok) {
    const data = await signRes.json().catch(() => ({}));
    throw new Error(data.error ?? "Couldn't start the upload.");
  }
  const { signature, timestamp, folder: signedFolder, transformation, apiKey, cloudName } = await signRes.json();

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("folder", signedFolder);
  // Must exactly match what the sign route included in the signed payload —
  // Cloudinary rejects the signature otherwise.
  if (transformation) form.append("transformation", transformation);

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });

  if (!uploadRes.ok) {
    throw new Error("Image upload failed.");
  }

  const data = await uploadRes.json();
  return { url: data.secure_url, width: data.width, height: data.height, publicId: data.public_id };
}
