const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

const dataUrlPattern = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

function hasExpectedSignature(format: string, data: Buffer) {
  if (format === "png") {
    return data.length >= 8 && data.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }

  if (format === "jpeg") {
    return data.length >= 3
      && data[0] === 0xff
      && data[1] === 0xd8
      && data[2] === 0xff;
  }

  return format === "webp"
    && data.length >= 12
    && data.subarray(0, 4).toString("ascii") === "RIFF"
    && data.subarray(8, 12).toString("ascii") === "WEBP";
}

export function validateProfileImageDataUrl(value: unknown) {
  if (typeof value !== "string") {
    return { valid: false as const, message: "Choose a valid profile image." };
  }

  const match = dataUrlPattern.exec(value);
  if (!match) {
    return {
      valid: false as const,
      message: "Profile images must be PNG, JPEG, or WebP files.",
    };
  }

  const data = Buffer.from(match[2], "base64");
  if (!data.length || data.length > MAX_PROFILE_IMAGE_BYTES) {
    return {
      valid: false as const,
      message: "Profile images must be smaller than 5 MB.",
    };
  }

  if (!hasExpectedSignature(match[1], data)) {
    return { valid: false as const, message: "The uploaded image is not valid." };
  }

  return { valid: true as const, value };
}
