// Cloudinary configuration
// This file exports the Cloudinary client for server-side operations (if needed)
// For client-side uploads, we use the Upload Widget via next-cloudinary

import { v2 as cloudinary } from 'cloudinary';

// Note: Currently using unsigned uploads via widget (no server-side config needed)
// If we need server-side operations in the future, configure here:
// cloudinary.config({
//   cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
// });

export default cloudinary;
