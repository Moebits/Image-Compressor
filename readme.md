## Image Compressor

<img src="assets/images/readme">

This is a bulk image compressor, resizer, and renamer. Great for organizing your anime art collection. You can reduce the size of images/GIFs, delete duplicate images, and rename pictures according to the source (from saucenao).

### Features:
- Compress and resize images (PNG/JPG/WEBP) and GIFs
- Rename pictures according to the source from saucenao (original title, artist, pixiv ID, etc.)
- Delete duplicate images (the one with the greatest dimensions is retained)
- Choose to overwrite images or write to a folder
- Ignore images under a certain file size (to avoid over-compression)

Note: Quality only affects JPG/WEBP export, PNG and GIF compression are automatic.

### Rename Template:
You can customize the output names. If it results in a blank name (eg. not found) it will default to using the same name as the input. If the "Overwrite" option is on, the original file is overwritten with the compressed file first and then renamed after. These are all the special replacements:

{name} - The name of the original file.
{title} - The title of the Pixiv illustration, if found.
{englishTitle} - The title, but translated to English.
{id} - The Pixiv ID of the illustration, if found.
{artist} - The artist of the illustration, if found.
{width} - The destination width.
{height} - The destination height.

### Keyboard Shortcuts
- Ctrl O - Open images
- Drag and drop - Open images

### Installation

Download the installer from the [releases](https://github.com/Tenpi/Image-Compressor/releases) tab.

### Bugs and Requests

Open an issue on my GitHub repository. 

### Also See

- [Waifu2x GUI](https://github.com/Tenpi/Waifu2x-GUI) for upscaling images
- [Pixiv Downloader](https://github.com/Tenpi/Pixiv-Downloader) for downloading images
- [Photo Viewer](https://github.com/Tenpi/Photo-Viewer) for editing images
