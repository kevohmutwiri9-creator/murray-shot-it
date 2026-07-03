import { initFirebase } from "./firebase-config.js";
import { bootFeedPage } from "./feed-page.js";

try {
  const firebase = initFirebase();
  await bootFeedPage(firebase);
} catch (error) {
  console.error("Error booting feed page:", error);
  // Don't show alert - permission errors are handled by bootFeedPage
}

// Emoji picker functionality
const emojiBtn = document.getElementById('emojiBtn');
const postText = document.getElementById('postText');
const commonEmojis = ['😀', '😂', '🥰', '😎', '🤔', '👍', '❤️', '🔥', '✨', '🎉', '💯', '🙌', '👏', '💪', '🌟', '📸', '🎬', '🎵', '💬', '📍'];

if (emojiBtn && postText) {
  let emojiPicker = null;
  
  emojiBtn.addEventListener('click', () => {
    if (emojiPicker) {
      emojiPicker.remove();
      emojiPicker = null;
      return;
    }
  
    emojiPicker = document.createElement('div');
    emojiPicker.className = 'absolute z-50 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-3 grid grid-cols-5 gap-2 animate-scale-in';
    emojiPicker.style.top = 'auto';
    emojiPicker.style.bottom = '100%';
    emojiPicker.style.left = '0';
    emojiPicker.style.marginBottom = '8px';
  
    commonEmojis.forEach(emoji => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg p-2 transition';
      btn.textContent = emoji;
      btn.addEventListener('click', () => {
        const start = postText.selectionStart;
        const end = postText.selectionEnd;
        const text = postText.value;
        postText.value = text.substring(0, start) + emoji + text.substring(end);
        postText.focus();
        postText.selectionStart = postText.selectionEnd = start + emoji.length;
        postText.dispatchEvent(new Event('input'));
        emojiPicker.remove();
        emojiPicker = null;
      });
      emojiPicker.appendChild(btn);
    });
  
    emojiBtn.parentElement.style.position = 'relative';
    emojiBtn.parentElement.appendChild(emojiPicker);
  
    // Close when clicking outside
    const closeEmojiPicker = (e) => {
      if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
        emojiPicker.remove();
        emojiPicker = null;
        document.removeEventListener('click', closeEmojiPicker);
      }
    };
    setTimeout(() => document.addEventListener('click', closeEmojiPicker), 0);
  });
}

// Drag and drop functionality for media
const mediaDropZone = document.getElementById('mediaDropZone');
const postFile = document.getElementById('postFile');

if (mediaDropZone && postFile) {
  mediaDropZone.addEventListener('click', () => postFile.click());

  mediaDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    mediaDropZone.classList.add('border-accent', 'bg-accent/5');
  });

  mediaDropZone.addEventListener('dragleave', () => {
    mediaDropZone.classList.remove('border-accent', 'bg-accent/5');
  });

  mediaDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    mediaDropZone.classList.remove('border-accent', 'bg-accent/5');
  
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      postFile.files = files;
      postFile.dispatchEvent(new Event('change'));
    }
  });
}
