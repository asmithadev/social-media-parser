const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  screenshot_id: { type: Number, required: true, unique: true },
  text: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'parsed', 'failed'], default: 'pending' },
  error: { type: String, default: null },
  data: mongoose.Schema.Types.Mixed,
}, { collection: 'parsed_artifacts', timestamps: true, versionKey: false });

module.exports = mongoose.model('ParsedArtifact', schema);
