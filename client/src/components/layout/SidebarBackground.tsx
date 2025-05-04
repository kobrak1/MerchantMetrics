import React from 'react';

// Import the background images
import forestBg from '/client/bg-images/forest-bg.png';
import cityBg from '/client/bg-images/city-bg.png';
import oceanBg from '/client/bg-images/ocean-bg.png';

interface SidebarBackgroundProps {
  background: string | undefined;
  className: string;
  children: React.ReactNode;
}

export default function SidebarBackground({
  background,
  className,
  children
}: SidebarBackgroundProps) {
  // Function to get the correct background image
  const getBackgroundImage = () => {
    if (!background || background === 'none') {
      return undefined;
    }

    switch (background) {
      case 'forest-bg.png':
        return `url(${forestBg})`;
      case 'city-bg.png':
        return `url(${cityBg})`;
      case 'ocean-bg.png':
        return `url(${oceanBg})`;
      default:
        return `url(${forestBg})`;
    }
  };

  const backgroundImage = getBackgroundImage();

  return (
    <div
      style={
        backgroundImage
          ? {
              backgroundImage,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }
          : undefined
      }
      className={className}
    >
      {children}
    </div>
  );
}