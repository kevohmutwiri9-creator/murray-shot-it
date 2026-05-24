# Murray Shot - Professional Photography & Advertising Website

A modern, responsive website for showcasing photography work and social media advertising campaigns.

## Features

- **Hero Section**: Eye-catching landing with "Murray Shot" branding
- **Photo Gallery**: Display your photography portfolio
- **Social Media Ads**: Showcase Instagram, Facebook, and WhatsApp campaigns
- **Contact Section**: Phone, WhatsApp, Email, and social media links
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **Modern UI**: Beautiful gradients, animations, and smooth transitions

## Getting Started

### Quick Start (No Installation Required)

Simply open `index.html` in your web browser. That's it!

The website uses TailwindCSS via CDN, so no installation or build process is needed.

### Update Contact Information

Find and replace these values in `index.html`:

- Phone number: Search for `+1 (555) 123-4567` and replace with your number
- WhatsApp: Search for `15551234567` in the WhatsApp links and replace with your number (without dashes or spaces)
- Email: Search for `contact@murrayshot.com` and replace with your email
- Instagram: Search for `https://instagram.com/murrayshot` and replace with your profile
- Facebook: Search for `https://facebook.com/murrayshot` and replace with your page

### Add Your Photos (and enable gallery preview)

The gallery tiles are currently **placeholders**. You can add real images/videos and enable preview in the lightbox.

1. Create an `images` folder in the same directory as `index.html`
2. Add your media files (e.g., `photo1.jpg`, `video1.mp4`)
3. In `index.html`, update each gallery tile:
   - Set `data-gallery-kind="placeholder"` (current default)
   - When ready, switch to real preview by adding an `<img>`/`<video>` and updating the lightbox JS accordingly.

Current behavior:
- Clicking a tile opens a lightbox with the tile title.
- Because no real media is wired yet, it shows: **“Add your real photos to enable previews.”**

After you provide your real phone/WhatsApp/social links, you can also finalize the rest of the contact section styling/content.

### Update Social Media Ads

Find the Ads section in `index.html` (around line 225) and update the campaign titles and descriptions to match your actual advertising work.

### Change Colors

Edit the TailwindCSS configuration in the `<script>` tag at the top of `index.html` (lines 12-26):

```javascript
colors: {
  primary: '#1a1a2e',      // Main dark color
  secondary: '#16213e',    // Secondary dark color
  accent: '#e94560',       // Accent color (pink/red)
  light: '#f8f9fa',        // Light background
}
```

## Deployment

Since this is a static HTML file, you can deploy it anywhere:

- **GitHub Pages**: Push to a GitHub repository and enable Pages
- **Netlify**: Drag and drop the folder to Netlify
- **Vercel**: Import your repository
- **Any web hosting**: Upload `index.html` and your `images` folder

## License

© 2024 Murray Shot. All rights reserved.
