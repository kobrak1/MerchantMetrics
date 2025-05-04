// Import background images directly using Vite's asset handling
import forestBg from '../../bg-images/forest-bg.png';
import cityBg from '../../bg-images/city-bg.png';
import oceanBg from '../../bg-images/ocean-bg.png';

// Export the image URLs that can be used in CSS
export const backgroundImages = {
  forest: `url(${forestBg})`,
  city: `url(${cityBg})`,
  ocean: `url(${oceanBg})`,
  none: 'none'
};