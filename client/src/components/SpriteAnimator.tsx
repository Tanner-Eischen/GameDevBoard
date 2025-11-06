import { useEffect, useRef, useState } from 'react';
import { Image } from 'react-konva';
import type { SpriteInstance, SpriteDefinition } from '@shared/schema';
import Konva from 'konva';

interface SpriteAnimatorProps {
  sprite: SpriteInstance;
  definition: SpriteDefinition;
  isSelected: boolean;
  isPreviewing: boolean;
  onClick: () => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
}

export function SpriteAnimator({
  sprite,
  definition,
  isSelected,
  isPreviewing,
  onClick,
  onDragEnd,
}: SpriteAnimatorProps) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const animationRef = useRef<NodeJS.Timeout>();

  // Load sprite sheet
  useEffect(() => {
    if (!definition.imageUrl) return;
    
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setImage(img);
    img.src = definition.imageUrl;
    
    return () => {
      if (img) img.onload = null;
    };
  }, [definition.imageUrl]);

  // Handle animation
  useEffect(() => {
    if (!isPreviewing) {
      setCurrentFrame(0);
      return;
    }

    // Resolve animation or build a fallback if none exists
    const explicitAnim = definition.animations[sprite.currentAnimation];
    let frames: number[] | null = null;
    let fps = 8;
    let loop = true;

    if (explicitAnim && explicitAnim.frames.length > 0) {
      frames = explicitAnim.frames;
      fps = explicitAnim.fps || 8;
      loop = explicitAnim.loop !== false;
    } else if (image && definition.frameWidth > 0 && definition.frameHeight > 0) {
      // Fallback: iterate all frames in the sheet grid
      const cols = Math.floor(image.width / definition.frameWidth);
      const rows = Math.floor(image.height / definition.frameHeight);
      const total = Math.max(1, cols * rows);
      frames = Array.from({ length: total }, (_, i) => i);
      fps = 8; // sensible default
      loop = true;
    }

    if (!frames || frames.length === 0) return;

    let frameIndex = 0;
    const interval = 1000 / Math.max(1, fps);

    const animate = () => {
      setCurrentFrame(frames![frameIndex]);
      frameIndex = (frameIndex + 1) % frames!.length;

      if (loop || frameIndex !== 0) {
        animationRef.current = setTimeout(animate, interval);
      }
    };

    animate();

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [sprite.currentAnimation, definition.animations, isPreviewing, image, definition.frameWidth, definition.frameHeight]);

  if (!image) return null;

  const animation = definition.animations[sprite.currentAnimation];
  const frameToShow = currentFrame;
  
  // Calculate crop position
  const cols = Math.floor(image.width / definition.frameWidth);
  const cropX = (frameToShow % cols) * definition.frameWidth;
  const cropY = Math.floor(frameToShow / cols) * definition.frameHeight;

  return (
    <Image
      image={image}
      x={sprite.x}
      y={sprite.y}
      width={definition.frameWidth * sprite.scale}
      height={definition.frameHeight * sprite.scale}
      crop={{
        x: cropX,
        y: cropY,
        width: definition.frameWidth,
        height: definition.frameHeight,
      }}
      rotation={sprite.rotation}
      scaleX={sprite.flipX ? -1 : 1}
      scaleY={sprite.flipY ? -1 : 1}
      offsetX={sprite.flipX ? definition.frameWidth * sprite.scale : 0}
      offsetY={sprite.flipY ? definition.frameHeight * sprite.scale : 0}
      draggable={isSelected}
      onClick={onClick}
      onDragEnd={onDragEnd}
      stroke={isSelected ? '#60a5fa' : undefined}
      strokeWidth={isSelected ? 2 : 0}
    />
  );
}