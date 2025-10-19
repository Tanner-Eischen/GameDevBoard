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

    const animation = definition.animations[sprite.currentAnimation];
    if (!animation || animation.frames.length === 0) return;

    let frameIndex = 0;
    const interval = 1000 / animation.fps;

    const animate = () => {
      setCurrentFrame(animation.frames[frameIndex]);
      frameIndex = (frameIndex + 1) % animation.frames.length;
      
      if (animation.loop || frameIndex !== 0) {
        animationRef.current = setTimeout(animate, interval);
      }
    };

    animate();

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [sprite.currentAnimation, definition.animations, isPreviewing]);

  if (!image) return null;

  const animation = definition.animations[sprite.currentAnimation];
  const frameToShow = animation ? animation.frames[currentFrame] || 0 : 0;
  
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
      scaleX={sprite.flipX ? -sprite.scale : sprite.scale}
      scaleY={sprite.flipY ? -sprite.scale : sprite.scale}
      offsetX={sprite.flipX ? definition.frameWidth : 0}
      draggable={isSelected}
      onClick={onClick}
      onDragEnd={onDragEnd}
      stroke={isSelected ? '#60a5fa' : undefined}
      strokeWidth={isSelected ? 2 : 0}
    />
  );
}