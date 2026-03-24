import { action } from "../_generated/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v } from "convex/values";
import { s3Client } from "../s3";

export const getPresignedUrl = action({
  args: {
    key: v.string(),
    contentType: v.string()
  },
  handler: async (ctx, args) => {
    // Make sure these environment variables are set in your Convex dashboard

    const command = new PutObjectCommand({
      Bucket: process.env.MINIO_BUCKET,
      Key: args.key,
      ContentType: args.contentType,
    });

    // Generate the presigned URL valid for 1 hour
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return { url, key: args.key };
  },
});
