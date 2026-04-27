import { S3Client } from "@aws-sdk/client-s3";

export const s3Client = new S3Client({
    forcePathStyle: true,
    credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY!,
        secretAccessKey: process.env.MINIO_SECRET_KEY!,
    },
    region: "ap-south-1",
    endpoint: process.env.MINIO_ENDPOINT
});
