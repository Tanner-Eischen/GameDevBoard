import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { isAuthenticated } from '../replitAuth';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Ensure sprites directory exists
const ensureSpritesDir = async () => {
  const spritesDir = path.join(process.cwd(), 'public', 'sprites');
  try {
    await fs.access(spritesDir);
  } catch {
    await fs.mkdir(spritesDir, { recursive: true });
  }
  return spritesDir;
};

// Upload sprite image - protected by authentication
router.post('/upload', isAuthenticated, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const spritesDir = await ensureSpritesDir();
    const fileExtension = path.extname(req.file.originalname);
    const filename = `${uuidv4()}${fileExtension}`;
    const filepath = path.join(spritesDir, filename);

    // Write file to disk
    await fs.writeFile(filepath, req.file.buffer);

    // Return the public URL
    const imageUrl = `/sprites/${filename}`;
    
    res.json({ 
      success: true, 
      imageUrl,
      filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    console.error('Error uploading sprite:', error);
    res.status(500).json({ error: 'Failed to upload sprite image' });
  }
});

// Get all sprite files - protected by authentication
router.get('/files', isAuthenticated, async (req, res) => {
  try {
    const spritesDir = await ensureSpritesDir();
    const files = await fs.readdir(spritesDir);
    
    const spriteFiles = files
      .filter(file => /\.(png|jpg|jpeg|gif|webp)$/i.test(file))
      .map(file => ({
        filename: file,
        url: `/sprites/${file}`,
        path: path.join(spritesDir, file)
      }));

    res.json({ files: spriteFiles });
  } catch (error) {
    console.error('Error listing sprite files:', error);
    res.status(500).json({ error: 'Failed to list sprite files' });
  }
});

// Delete sprite file - protected by authentication
router.delete('/files/:filename', isAuthenticated, async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Validate filename to prevent path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const spritesDir = await ensureSpritesDir();
    const filepath = path.join(spritesDir, filename);

    // Check if file exists
    try {
      await fs.access(filepath);
    } catch {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete the file
    await fs.unlink(filepath);
    
    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting sprite file:', error);
    res.status(500).json({ error: 'Failed to delete sprite file' });
  }
});

// Get sprite metadata - protected by authentication
router.get('/metadata/:filename', isAuthenticated, async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Validate filename
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const spritesDir = await ensureSpritesDir();
    const filepath = path.join(spritesDir, filename);

    // Check if file exists and get stats
    try {
      const stats = await fs.stat(filepath);
      res.json({
        filename,
        url: `/sprites/${filename}`,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      });
    } catch {
      return res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    console.error('Error getting sprite metadata:', error);
    res.status(500).json({ error: 'Failed to get sprite metadata' });
  }
});

export default router;