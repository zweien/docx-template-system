// src/lib/constants/upload.ts

/**
 * 上传文件的基础目录
 * 可通过环境变量 UPLOAD_DIR 自定义
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR || "public/uploads";

/**
 * 文档收集模块的私有文件目录，不应暴露在 public 静态目录下
 */
export const COLLECTION_UPLOAD_DIR =
  process.env.COLLECTION_UPLOAD_DIR || ".data/uploads";
