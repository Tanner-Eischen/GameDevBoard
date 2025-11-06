import express, { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { isAuthenticated } from '../replitAuth';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Validation schemas
const spriteIdSchema = z.object({
  spriteId: z.string().min(1, 'Sprite ID is required')
});

const animationIdSchema = z.object({
  animationId: z.string().min(1, 'Animation ID is required')
});

const stateMachineIdSchema = z.object({
  stateMachineId: z.string().min(1, 'State Machine ID is required')
});

const timelineIdSchema = z.object({
  timelineId: z.string().min(1, 'Timeline ID is required')
});

const filenameSchema = z.object({
  filename: z.string().min(1, 'Filename is required').refine(
    (filename) => !filename.includes('..') && !filename.includes('/') && !filename.includes('\\'),
    'Invalid filename - path traversal not allowed'
  )
});

const spritesheetParseSchema = z.object({
  frameWidth: z.string().transform(val => parseInt(val)).refine(val => val > 0, 'Frame width must be positive'),
  frameHeight: z.string().transform(val => parseInt(val)).refine(val => val > 0, 'Frame height must be positive'),
  columns: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  rows: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  padding: z.string().optional().transform(val => val ? parseInt(val) : 0),
  margin: z.string().optional().transform(val => val ? parseInt(val) : 0)
});

// Configure multer for file uploads with enhanced security
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: VALIDATION_LIMITS.SPRITESHEET_MAX_SIZE,
    files: 1, // Only allow one file at a time
    fieldSize: 1024 * 1024, // 1MB field size limit
  },
  fileFilter: (req, file, cb) => {
    // Validate file type by MIME type
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype as any)) {
      return cb(new Error(`Invalid file type. Only ${ALLOWED_IMAGE_TYPES.join(', ')} files are allowed.`));
    }
    
    // Validate filename
    const filenameValidation = validateFilename(file.originalname);
    if (!filenameValidation.isValid) {
      return cb(new Error(filenameValidation.error || 'Invalid filename'));
    }
    
    cb(null, true);
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
    const fileExtension = path.extname(filenameValidation.sanitized!);
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
      sanitizedName: filenameValidation.sanitized,
      size: req.file.size,
      mimeType: fileValidation.mimeType
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logError(error, 'UPLOAD_SPRITE');
    throw handleFileError(error);
  }
}));

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
    logError(error, 'GET_SPRITE_FILES');
    throw handleFileError(error);
  }
}));

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
      throw new ApiError('File not found', 404, ErrorCode.NOT_FOUND);
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
    const updateData = validateParams(insertAnimationSchema.partial(), req.body);
    
    // Handle metadata separately to avoid type conflicts
    const updatePayload: any = { ...updateData };
    if (updateData.metadata) {
      updatePayload.metadata = {
        ...updateData.metadata,
        updatedAt: new Date()
      };
    }
    
    const [updatedAnimation] = await db
      .update(animations)
      .set({
        ...updatePayload,
        updatedAt: sql`NOW()`
      })
      .where(and(eq(animations.id, animationId), eq(animations.spriteId, spriteId)))
      .returning();
    
    if (!updatedAnimation) {
      throw new ApiError('Animation not found', 404, ErrorCode.NOT_FOUND);
    }
    
    res.json(updatedAnimation);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logError(error, 'UPDATE_ANIMATION');
    throw handleDatabaseError(error);
  }
}));

// Delete animation
router.delete('/:spriteId/animations/:animationId', asyncHandler(async (req, res) => {
  const { spriteId } = validateParams(spriteIdSchema, req.params);
  const { animationId } = validateParams(animationIdSchema, req.params);
  
  try {
    const result = await db
      .delete(animations)
      .where(and(eq(animations.id, animationId), eq(animations.spriteId, spriteId)));
    
    res.json({ success: true, message: 'Animation deleted successfully' });
  } catch (error) {
    logError(error, 'DELETE_ANIMATION');
    throw handleDatabaseError(error);
  }
}));

// === STATE MACHINE ENDPOINTS ===

// Create state machine for sprite
router.post('/:spriteId/state-machines', asyncHandler(async (req, res) => {
  const { spriteId } = validateParams(spriteIdSchema, req.params);
  
  try {
    const stateMachineData = validateParams(insertStateMachineSchema, { ...req.body, spriteId });
    
    const [newStateMachine] = await db.insert(stateMachines).values(stateMachineData as any).returning();
    res.json(newStateMachine);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logError(error, 'CREATE_STATE_MACHINE');
    throw handleDatabaseError(error);
  }
}));

// Get state machines for sprite
router.get('/:spriteId/state-machines', asyncHandler(async (req, res) => {
  const { spriteId } = validateParams(spriteIdSchema, req.params);
  
  try {
    const spriteStateMachines = await db
      .select()
      .from(stateMachines)
      .where(eq(stateMachines.spriteId, spriteId));
    
    res.json(spriteStateMachines);
  } catch (error) {
    logError(error, 'GET_STATE_MACHINES');
    throw handleDatabaseError(error);
  }
}));

// Update state machine
router.put('/:spriteId/state-machines/:stateMachineId', asyncHandler(async (req, res) => {
  const { spriteId } = validateParams(spriteIdSchema, req.params);
  const { stateMachineId } = validateParams(stateMachineIdSchema, req.params);
  
  try {
    const updateData = validateParams(insertStateMachineSchema.partial(), req.body);
    
    const [updatedStateMachine] = await db
      .update(stateMachines)
      .set({
        ...(updateData as any),
        updatedAt: sql`NOW()`
      })
      .where(and(eq(stateMachines.id, stateMachineId), eq(stateMachines.spriteId, spriteId)))
      .returning();
    
    if (!updatedStateMachine) {
      throw new ApiError('State machine not found', 404, ErrorCode.NOT_FOUND);
    }
    
    res.json(updatedStateMachine);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logError(error, 'UPDATE_STATE_MACHINE');
    throw handleDatabaseError(error);
  }
}));

// === TIMELINE ENDPOINTS ===

// Create timeline for sprite
router.post('/:spriteId/timelines', asyncHandler(async (req, res) => {
  const { spriteId } = validateParams(spriteIdSchema, req.params);
  
  try {
    const timelineData = validateParams(insertTimelineSchema, { ...req.body, spriteId });
    
    const [newTimeline] = await db.insert(timelines).values(timelineData as any).returning();
    res.json(newTimeline);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logError(error, 'CREATE_TIMELINE');
    throw handleDatabaseError(error);
  }
}));

// Get timelines for sprite
router.get('/:spriteId/timelines', asyncHandler(async (req, res) => {
  const { spriteId } = validateParams(spriteIdSchema, req.params);
  
  try {
    const spriteTimelines = await db
      .select()
      .from(timelines)
      .where(eq(timelines.spriteId, spriteId));
    
    res.json(spriteTimelines);
  } catch (error) {
    logError(error, 'GET_TIMELINES');
    throw handleDatabaseError(error);
  }
}));

// Update timeline
router.put('/:spriteId/timelines/:timelineId', asyncHandler(async (req, res) => {
  const { spriteId } = validateParams(spriteIdSchema, req.params);
  const { timelineId } = validateParams(timelineIdSchema, req.params);
  
  try {
    const updateData = validateParams(insertTimelineSchema.partial(), req.body);
    
    const [updatedTimeline] = await db
      .update(timelines)
      .set({
        ...(updateData as any),
        updatedAt: sql`NOW()`
      })
      .where(and(eq(timelines.id, timelineId), eq(timelines.spriteId, spriteId)))
      .returning();
    
    if (!updatedTimeline) {
      throw new ApiError('Timeline not found', 404, ErrorCode.NOT_FOUND);
    }
    
    res.json(updatedTimeline);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logError(error, 'UPDATE_TIMELINE');
    throw handleDatabaseError(error);
  }
}));

// === SPRITESHEET PARSING ENDPOINTS ===

// Parse spritesheet and extract frame data
router.post('/parse-spritesheet', upload.single('spritesheet'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError('No spritesheet file provided', 400, ErrorCode.VALIDATION_ERROR);
  }

  try {
    const { frameWidth, frameHeight, columns, rows, padding, margin } = validateParams(spritesheetParseSchema, req.body);

    // Save the spritesheet file
    const spritesDir = await ensureSpritesDir();
    const fileExtension = path.extname(req.file.originalname);
    const filename = `spritesheet_${uuidv4()}${fileExtension}`;
    const filepath = path.join(spritesDir, filename);
    await fs.writeFile(filepath, req.file.buffer);

    // Calculate frame positions
    const frames = [];
    const cols = columns || Math.floor((req.file.size / (frameWidth * frameHeight)));
    const rowCount = rows || Math.ceil(frames.length / cols);
    
    for (let row = 0; row < rowCount; row++) {
      for (let col = 0; col < cols; col++) {
        frames.push({
          x: margin + col * (frameWidth + padding),
          y: margin + row * (frameHeight + padding),
          width: frameWidth,
          height: frameHeight,
          frameIndex: row * cols + col
        });
      }
    }

    const spritesheetData = {
      imageUrl: `/sprites/${filename}`,
      frameWidth,
      frameHeight,
      columns: cols,
      rows: rowCount,
      totalFrames: frames.length,
      padding,
      margin,
      frames
    };

    res.json({
      success: true,
      spritesheetData,
      imageUrl: `/sprites/${filename}`,
      filename,
      totalFrames: frames.length
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logError(error, 'PARSE_SPRITESHEET');
    throw handleFileError(error);
  }
}));

// Get sprite metadata (for future use with database)
router.get('/metadata/:filename', asyncHandler(async (req, res) => {
  const { filename } = validateParams(filenameSchema, req.params);

  try {
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
      throw new ApiError('File not found', 404, ErrorCode.NOT_FOUND);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logError(error, 'GET_SPRITE_METADATA');
    throw handleFileError(error);
  }
}));

export default router;