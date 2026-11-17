const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  screenshot_id: { type: Number, required: true, unique: true },
  text: { type: String, default: '' },
  data: mongoose.Schema.Types.Mixed,
}, { collection: 'parsed_artifacts', timestamps: true, versionKey: false });

module.exports = mongoose.model('ParsedArtifact', schema);
