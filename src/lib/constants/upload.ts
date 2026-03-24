// src/lib/constants/upload.ts

/**
 * 上传文件的基础目录
 * 可通过环境变量 UPLOAD_DIR 自定义
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR || "public/uploads";
