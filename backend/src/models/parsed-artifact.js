const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  screenshot_id: { type: Number, required: true, unique: true },
  text: { type: String, default: '' },
  structured: {
    type: new mongoose.Schema({
      parserVersion: String,
      usernames: [String],
      dates: [String],
      messages: [{ _id: false, lineNumber: Number, text: String }],
    }, { _id: false }),
    default: undefined,
  },
  status: { type: String, enum: ['pending', 'parsed', 'failed'], default: 'pending' },
  error: { type: String, default: null },
  data: mongoose.Schema.Types.Mixed,
}, { collection: 'parsed_artifacts', timestamps: true, versionKey: false });

module.exports = mongoose.model('ParsedArtifact', schema);
