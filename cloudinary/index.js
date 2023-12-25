const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
    cloud_name: 'dibljzlwi',
    api_key: '366627969478312',
    api_secret: 'hEbpPEmqFUQBtQ7GJyJU1Ji4eeg'
});

const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'Entertainment',
        allowed_formats: ['jpeg', 'png', 'jpg', 'mp3', 'mp4','mkv','ts'],
        resource_type: 'auto'
    }
});

module.exports = {
    cloudinary,
    storage
}